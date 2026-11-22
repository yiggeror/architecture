"""Exercise the single-file 千灯渡 character album in Chromium and a touch viewport.

Run after ``npm run build``. Python Playwright, Pillow and Chromium are required.
Use --url to check a different bundle and --screenshots DIR to keep the proof sheets.
"""

import argparse
import io
import json
import math
import struct
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from shutil import which
from threading import Thread
from urllib.parse import quote, urljoin
from urllib.request import urlopen

from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

CAST = [47, 0, 9, 53, 64, 51, 55, 38, 4, 5, 36, 14]
# Observe real render state through the Three.js devtools event. All movement,
# posing, rebuilding and time changes in the test still go through the album UI.
OBSERVER = """window.__THREE_DEVTOOLS__ = new EventTarget();
__THREE_DEVTOOLS__.addEventListener('observe', ({detail: scene}) => {
  if (!scene.isScene) return;
  scene.onAfterRender = (renderer,root,camera) => {
    window.captureActor = () => {
      const n=root.children.find(o=>Number.isInteger(o.userData.personId));
      const bone=name=>n.getObjectByName(name), h=bone('head'), v=h.position.clone();
      const landmark=b=>b.getWorldPosition(v).toArray();
      const joints=['head','lHand','rHand','lFoot','rFoot'].map(k=>landmark(bone(k))).flat();
      return {id:n.userData.personId, head:h.getWorldPosition(v).project(camera).toArray(), joints,
        eye:camera.position.toArray(),yaw:camera.quaternion.toArray(),
        triangles:renderer.info.render.triangles, alive:!renderer.getContext().isContextLost()};
    };
  };
});"""


@contextmanager
def local_build(remote):
    if remote:
        yield remote
        return
    directory = Path(__file__).resolve().parents[1]
    if not (directory / 'studio.html').is_file():
        raise SystemExit('Run npm run build in qiandeng first.')
    handler = partial(SimpleHTTPRequestHandler, directory=directory)
    with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f'http://127.0.0.1:{server.server_port}/studio.html'
        finally:
            server.shutdown()
            thread.join()


def settled(page):
    page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')


def sample(page):
    settled(page)
    return page.evaluate('captureActor()')


def open_album(context, url):
    page = context.new_page()
    page.set_default_timeout(120000)
    errors, requests = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
    page.on('request', lambda req: requests.append(req.url) if req.url.startswith(('http:', 'https:')) else None)
    page.goto(url, wait_until='load', timeout=90000)
    page.wait_for_function('document.documentElement.dataset.ready === "true" && !!window.captureActor')
    return page, errors, requests


def scrub(page, step):
    page.locator('#scrub').evaluate("(s,step)=>{ s.value=step; s.dispatchEvent(new Event('input')); }", step)
    return sample(page)


def source_frame(page):
    return Image.open(io.BytesIO(page.locator('#figure').screenshot())).convert('RGB')


def diff(first, second):
    return sum(ImageStat.Stat(ImageChops.difference(first, second)).mean) / 3


def choose(page, person):
    page.click('#catalog-open')
    page.click(f'[data-cast="{person}"]')
    assert not page.locator('#catalog').is_visible()
    assert page.locator('html').get_attribute('data-person') == str(person)


def shot(page, folder, name):
    if folder:
        settled(page)
        page.screenshot(path=folder / (name + '.png'))


def require_camera_change(a, b):
    assert math.dist(a['yaw'], b['yaw']) > .1 or math.dist(a['eye'], b['eye']) > .11


def verify_glb(download, filename):
    assert download.suggested_filename == filename
    data = Path(download.path()).read_bytes()
    signature, version, count = struct.unpack_from('<4sII', data)
    assert (signature, version, count) == (b'glTF', 2, len(data))
    length, kind = struct.unpack_from('<I4s', data, 12)
    assert kind == b'JSON'
    asset = json.loads(data[20:20 + length])
    images = asset['images']
    assert len(images) >= 3 and all('bufferView' in image for image in images)
    assert all('uri' not in buffer for buffer in asset['buffers'])
    assert max(len(skin['joints']) for skin in asset['skins']) >= 20
    assert any('JOINTS_0' in primitive['attributes'] and 'WEIGHTS_0' in primitive['attributes']
               for mesh in asset['meshes'] for primitive in mesh['primitives'])
    assert any(sum(channel['target']['path'] == 'rotation' for channel in clip['channels']) >= 10
               for clip in asset['animations'])
    eyelids = next(clip for clip in asset['animations'] if clip['name'] == '眨眼')
    assert len(eyelids['channels']) == 1
    target = eyelids['channels'][0]['target']
    assert target['path'] == 'weights' and asset['nodes'][target['node']]['name'] == '上下眼睑'
    eyelid_mesh = asset['meshes'][asset['nodes'][target['node']]['mesh']]
    names = eyelid_mesh['extras']['targetNames']
    blink_index = names.index('闭眼')
    binary = 20 + length + 8

    def weights(clip, channel):
        sampler = clip['samplers'][channel['sampler']]
        times = asset['accessors'][sampler['input']]
        values = asset['accessors'][sampler['output']]
        assert values['type'] == 'SCALAR' and values['componentType'] == 5126
        assert values['count'] == times['count'] * len(names)
        view = asset['bufferViews'][values['bufferView']]
        start = binary + view.get('byteOffset', 0) + values.get('byteOffset', 0)
        return list(struct.iter_unpack('<' + 'f' * len(names), data[start:start + 4 * values['count']]))

    blink = weights(eyelids, eyelids['channels'][0])
    assert blink[0][blink_index] == blink[-1][blink_index] == 0
    assert max(row[blink_index] for row in blink) == 1
    assert all(value == 0 for row in blink for i, value in enumerate(row) if i != blink_index)

    action = next(clip for clip in asset['animations'] if clip is not eyelids)
    lid_channel = next(channel for channel in action['channels'] if channel['target'] == target)
    performance = weights(action, lid_channel)
    assert min(row[blink_index] for row in performance) < max(row[blink_index] for row in performance)
    if '扬眉' in names:
        brow_index = names.index('扬眉')
        brows = [row[brow_index] for row in performance]
        assert min(brows) >= 0 and max(brows) <= 1 and max(brows) - min(brows) > .1
    return {'bytes':count, 'images':len(images), 'clips':len(asset['animations'])}


def desktop(browser, url, folder):
    context = browser.new_context(viewport={'width': 1120, 'height': 720}, reduced_motion='reduce')
    context.add_init_script(OBSERVER)
    page, errors, requests = open_album(context, url)
    assert page.locator('html').get_attribute('data-person') == '47'
    assert page.locator('#cast-list li').count() == len(CAST)
    assert not page.locator('#trials').evaluate('el=>el.open')
    assert page.locator('#city-link').get_attribute('href') == 'index.html#person=47'
    assert page.locator('#person-name').inner_text() == '沈青蘅'
    shot(page, folder, 'desktop-portrait')
    page.click('#catalog-open')
    page.select_option('#role-filter', 'row')
    assert page.locator('#cast-list li:visible').count() == 1
    page.click('[data-cast="0"]')
    details = {}
    for person in CAST:
        choose(page, person)
        page.click('[data-view-choice="full"]')
        first = scrub(page, 0)
        middle = scrub(page, 373)
        end = scrub(page, 1000)
        assert middle['id'] == person and middle['alive'] and middle['triangles'] > 12000
        assert math.dist(first['joints'], middle['joints']) > .002, person
        assert math.dist(first['joints'], end['joints']) < .000001, person
        assert abs(middle['head'][0]) < .99 and abs(middle['head'][1]) < .99, person
        assert page.locator('#city-link').get_attribute('href') == f'index.html#person={person}'
        assert page.locator('html').get_attribute('data-playing') == 'false'
        details[person] = [page.locator('#timecode').inner_text().split(' / ')[-1], middle['triangles']]
        if person in {0, 9, 38, 36}:
            scrub(page, 350)
            shot(page, folder, f'full-{person}')
    choose(page, 47)
    page.click('[data-view-choice="portrait"]')
    page.click('[data-light-choice="night"]')
    shot(page, folder, 'desktop-night')
    night = source_frame(page)
    page.click('[data-light-choice="day"]')
    settled(page)
    assert diff(night, source_frame(page)) > 10
    page.click('[data-view-choice="hand"]')
    assert page.locator('[data-hand="l"]').get_attribute('aria-pressed') == 'true'
    page.click('[data-hand="r"]')
    right = sample(page)
    page.click('[data-hand="l"]')
    require_camera_change(right, sample(page))
    shot(page, folder, 'hand-grip')
    page.click('[data-view-choice="portrait"]')
    baseline = scrub(page, 483)
    bounds = page.locator('#figure').bounding_box()
    x, y = bounds['x'] + bounds['width'] * .4, bounds['y'] + bounds['height'] * .5
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 76, y + 18, steps=6)
    page.mouse.up()
    require_camera_change(baseline, sample(page))
    page.click('#reset-view')
    before_wheel = sample(page)
    page.mouse.move(x, y)
    page.mouse.wheel(0, -250)
    page.wait_for_function('eye=>Math.hypot(...captureActor().eye.map((x,i)=>x-eye[i])) > .04',
                           arg=before_wheel['eye'])
    page.click('#reset-view')
    page.click('[data-zoom="in"]')
    page.locator('#figure').press('ArrowRight')
    page.click('#trials summary')
    assert page.evaluate("""document.querySelector('#timecode').getBoundingClientRect().bottom <=
                            document.querySelector('.leaf').getBoundingClientRect().bottom""")
    fixed = sample(page)
    original = source_frame(page)
    page.click('#clay-face')
    settled(page)
    assert page.locator('#clay-face').get_attribute('aria-pressed') == 'true'
    assert diff(original, source_frame(page)) > 3
    assert math.dist(fixed['eye'], sample(page)['eye']) < .000001
    page.click('#clay-face')
    settled(page)
    assert diff(original, source_frame(page)) < .08
    # Compare woven motifs where their cut panels are actually in frame.
    page.click('[data-view-choice="full"]')
    settled(page)
    page.select_option('#trial-pattern', 'plain')
    settled(page)
    plain = source_frame(page)
    for pattern in ('plum', 'reed', 'cloud'):
        page.select_option('#trial-pattern', pattern)
        settled(page)
        assert diff(plain, source_frame(page)) > .04, pattern
    page.click('#trial-reset')
    page.click('[data-view-choice="portrait"]')
    page.click('[data-zoom="in"]')
    page.locator('#figure').press('ArrowRight')
    # Keep keyboard focus on the same form control for both pixel comparisons.
    page.locator('#trial-hair').focus()
    fixed = sample(page)
    original = source_frame(page)
    page.select_option('#trial-hair', 'braid')
    page.select_option('#trial-garment', 'changshan')
    page.select_option('#trial-pattern', 'plum')
    page.locator('#trial-jaw').evaluate("s=>{ s.value=.96; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); }")
    remade = sample(page)
    assert page.locator('#trial-status').inner_text() == '试样中'
    assert page.locator('#scrub').input_value() == '483'
    assert math.dist(fixed['eye'], remade['eye']) < .000001
    assert math.dist(fixed['yaw'], remade['yaw']) < .000001
    assert math.dist(fixed['joints'], remade['joints']) < .000001
    assert diff(original, source_frame(page)) > 2
    shot(page, folder, 'same-instant-variant')
    with page.expect_download(timeout=120000) as received:
        page.click('#export-figure')
    exported = verify_glb(received.value, '沈青蘅-持伞.glb')
    again = sample(page)
    assert page.locator('#scrub').input_value() == '483'
    assert math.dist(remade['eye'], again['eye']) < .000001 and math.dist(remade['joints'], again['joints']) < .000001
    page.click('#trial-reset')
    page.locator('#trial-hair').focus()
    restored = sample(page)
    assert page.locator('#trial-status').inner_text() == '原样'
    assert math.dist(fixed['joints'], restored['joints']) < .000001
    assert diff(original, source_frame(page)) < .2
    page.click('[data-view-choice="full"]')
    whole = sample(page)
    page.select_option('#trial-garment', 'duan')
    assert math.dist(whole['eye'], sample(page)['eye']) < .000001
    page.click('#trial-reset')
    page.click('#trials summary')
    page.click('#playback')
    page.wait_for_function("document.querySelector('#scrub').value !== '483'")
    page.click('#playback')
    assert page.locator('html').get_attribute('data-playing') == 'false'
    page.click('#previous')
    assert page.locator('html').get_attribute('data-person') == str(CAST[-1])
    originals = {}
    for person, filename in [(47, '沈青蘅-持伞.glb'), (9, '叶素弦-琵琶.glb'),
                             (64, '许砚清-行旅.glb'), (4, '吴照-击鼓.glb')]:
        choose(page, person)
        if not page.locator('#trials').evaluate('el=>el.open'):
            page.click('#trials summary')
        assert page.locator('#trial-status').inner_text() == '原样'
        with page.expect_download(timeout=120000) as original_file:
            page.click('#export-figure')
        originals[person] = verify_glb(original_file.value, filename)
    assert len(set(requests)) == 1, requests
    assert not errors, errors
    context.close()
    return {'cast':details, 'GLB':exported, 'original_costumes':originals}


def touch_motion(context, page, pinch):
    shape = page.locator('#figure').bounding_box()
    x = shape['x'] + .5 * shape['width']
    y = shape['y'] + .5 * shape['height']
    cdp = context.new_cdp_session(page)
    for i, spread in enumerate((28, 35, 44, 55, 70, 84)):
        fingers = [{'id': 0, 'x': x - spread, 'y': y}]
        if pinch:
            fingers.append({'id': 1, 'x': x + spread, 'y': y})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart' if i == 0 else 'touchMove', 'touchPoints': fingers})
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    cdp.detach()


def phone(browser, url, width, height, folder):
    context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=True,
                                  is_mobile=True, device_scale_factor=1.5, reduced_motion='reduce')
    context.add_init_script(OBSERVER)
    page, errors, requests = open_album(context, url + '#person=9')
    assert page.locator('#person-name').inner_text() == '叶素弦'
    check_layout = """() => { const shell=document.documentElement,port=document.querySelector('#figure').getBoundingClientRect();
      const button=document.querySelector('#playback').getBoundingClientRect();return [shell.scrollWidth,shell.scrollHeight,
      port.height,button.bottom,innerWidth,innerHeight] }"""
    for opened in (False, True):
        if opened:
            page.click('#trials summary')
        total_width, total_height, canvas_height, bottom, vw, vh = page.evaluate(check_layout)
        assert total_width <= vw and total_height <= vh + 1, [width, opened, total_width, total_height, vw, vh]
        assert canvas_height > 170 and bottom <= vh, [width, opened, canvas_height, bottom, vh]
    page.click('#trials summary')
    shot(page, folder, f'phone-{width}')
    for pinch in (False, True):
        start = sample(page)
        touch_motion(context, page, pinch=pinch)
        require_camera_change(start, sample(page))
        page.click('#reset-view')
    page.click('[data-view-choice="full"]')
    page.click('[data-light-choice="night"]')
    shot(page, folder, f'phone-{width}-full-night')
    page.click('#catalog-open')
    page.select_option('#role-filter', 'flute')
    page.click('[data-cast="5"]')
    assert page.locator('#person-name').inner_text() == '阮竹生'
    assert len(set(requests)) == 1 and not errors, [requests, errors]
    context.close()


def download_name(browser, url):
    # Supply the actual self-contained studio bytes under the exported Chinese
    # filename, so this works for source checkouts as well as download folders.
    with urlopen(url) as response:
        html = response.read()
    alias = urljoin(url, quote('千灯渡-人物图录.html'))
    context = browser.new_context(reduced_motion='reduce')
    context.add_init_script(OBSERVER)
    context.route(alias, lambda route: route.fulfill(status=200, content_type='text/html; charset=utf-8', body=html))
    context.set_offline(True)
    page, errors, requests = open_album(context, alias + '#person=53')
    assert page.locator('#city-link').get_attribute('href') == '千灯渡.html#person=53'
    page.click('[data-view-choice="hand"]')
    page.click('[data-light-choice="night"]')
    page.click('#trials summary')
    with page.expect_download(timeout=120000) as received:
        page.click('#export-figure')
    verify_glb(received.value, '周守义-巡更.glb')
    assert sample(page)['alive'] and len(set(requests)) == 1 and not errors, [requests, errors]
    context.close()


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('--url')
    args.add_argument('--screenshots', type=Path)
    parsed = args.parse_args()
    if parsed.screenshots:
        parsed.screenshots.mkdir(parents=True, exist_ok=True)
    with local_build(parsed.url) as url, sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=which('chromium') or which('google-chrome'),
                                             args=['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        try:
            result = desktop(browser, url, parsed.screenshots)
            for w, h in ((390, 844), (320, 568)):
                phone(browser, url, w, h, parsed.screenshots)
            download_name(browser, url)
            print(json.dumps({**result, 'touch': ['390×844', '320×568'], 'download': '千灯渡.html'}, ensure_ascii=False))
        finally:
            browser.close()


if __name__ == '__main__':
    main()
