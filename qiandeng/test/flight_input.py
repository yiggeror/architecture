"""Measure free-flight speed and gesture handling in Chromium.

    python test/flight_input.py --frame-profile

This builds a temporary city from the project sources. Pass --url to reuse a
served review build. The hook places the camera in open space, then trusted
keyboard and touch events exercise the shipped navigation and collision code.
"""

import argparse
import json
import math
import subprocess
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from shutil import which
from tempfile import TemporaryDirectory
from threading import Thread
from time import sleep

from playwright.sync_api import sync_playwright

from viewer import Viewer, angle, require, travel


@contextmanager
def review_address(url):
    if url:
        yield url
        return
    project = Path(__file__).resolve().parents[1]
    with TemporaryDirectory(prefix="qiandeng-flight-") as work:
        folder = Path(work)
        subprocess.run(
            [
                project / "node_modules/.bin/esbuild",
                "src/main.js",
                "--bundle",
                "--minify",
                "--format=iife",
                "--target=es2020",
                "--define:__CITY_REVIEW__=true",
                f"--outfile={folder / 'city.js'}",
            ],
            cwd=project,
            check=True,
        )
        shell = (project / "shell.html").read_text()
        script = (folder / "city.js").read_text().replace("</script", "<\\/script")
        (folder / "index.html").write_text(shell.replace("/* COURTYARD */", script))
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(SimpleHTTPRequestHandler, directory=work))
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            yield f"http://127.0.0.1:{server.server_port}/"
        finally:
            server.shutdown()
            server.server_close()


def profile(view):
    return view.page.evaluate("""async () => {
      const intervals=[], submitted=[], calls=[], renderer=cityReview.renderer, render=renderer.render;
      let previous=await new Promise(requestAnimationFrame), triangles=0, batches=0;
      renderer.render=function(...args) {
        const beforeTriangles=this.info.render.triangles, beforeCalls=this.info.render.calls;
        const out=render.apply(this,args);
        triangles+=this.info.render.triangles-(this.info.autoReset?0:beforeTriangles);
        batches+=this.info.render.calls-(this.info.autoReset?0:beforeCalls);
        return out;
      };
      try {
      for(let i=0;i<8;i++) {
        const now=await new Promise(requestAnimationFrame); intervals.push(now-previous); previous=now;
        submitted.push(triangles); calls.push(batches); triangles=0; batches=0;
      }
      } finally { renderer.render=render; }
      for(const values of [intervals,submitted,calls]) values.sort((a,b)=>a-b);
      return {frame_p50_ms:+intervals[4].toFixed(1),frame_max_ms:+intervals[7].toFixed(1),
        frame_p50_draw_calls:calls[4],frame_p50_draw_triangles:submitted[4],
        heap_mib:performance.memory?+(performance.memory.usedJSHeapSize/1048576).toFixed(1):null,
        static_triangles:Math.round(cityReview.regionStats.reduce((a,b)=>a+b.faces,0))};
    }""")


EVENTS = """() => {
  window.flightInputEvents=[];
  for (const name of ['keydown','keyup','pointerdown','pointerup','pointercancel'])
    document.addEventListener(name,e=>flightInputEvents.push({name, trusted:e.isTrusted,
      ms:performance.now(),code:e.code,target:e.target.closest('#stick')?'stick':'canvas'}),true);
}"""


def position(view, height):
    # Clear all buildings and set a level gaze, so altitude stays fixed during timing.
    view.page.evaluate("y=>{cityReview.pose([1600,y,1900],[1600,y,1800]);cityReview.play()}", height)
    view.page.evaluate("flightInputEvents.length=0")
    return view.pose()


def rate(view, start, begin, end, target):
    records = view.page.evaluate("flightInputEvents")
    events = [r for r in records if target(r) and r["name"] in [begin, end]]
    require(len(events) == 2 and all(r["trusted"] for r in events), "trusted press and release")
    seconds = (events[1]["ms"] - events[0]["ms"]) / 1000
    length = travel(start, view.pose())
    return round(length / seconds, 2)


def horizontal_strafe(before, after):
    delta = [b - a for a, b in zip(before["eye"], after["eye"])]
    distance = math.hypot(*delta)
    require(distance > 0.35 and abs(delta[1]) < 0.00001, f"horizontal strafe {delta}")
    dot = sum(d * g for d, g in zip(delta, before["gaze"]))
    require(abs(dot) < distance * 0.002, f"strafe/gaze dot {dot}")
    return round(distance, 3)


def interrupted_keyboard(view):
    # Software WebGL can occupy the foreground main thread for more than a second.
    before = position(view, 300)
    view.page.keyboard.down("w")
    view.page.evaluate("() => {const start=performance.now(); while(performance.now()-start<1800){} }")
    view.page.keyboard.up("w")
    measured = rate(view, before, "keydown", "keyup", lambda event: event.get("code") == "KeyW")
    require(104 < measured < 112, f"foreground stall lost held input at {measured:.2f} m/s")

    view.page.evaluate("""() => {
        window.flightFreezeEye=null;
        document.addEventListener('freeze',()=>{flightFreezeEye=viewerPose().eye;},{once:true});
    }""")
    before = position(view, 300)
    view.page.keyboard.down("w")
    view.page.wait_for_function("p=>viewerPose().eye[2]<p[2]-.1", arg=before["eye"])
    view.cdp.send("Page.setWebLifecycleState", {"state": "frozen"})
    sleep(0.45)
    view.cdp.send("Page.setWebLifecycleState", {"state": "active"})
    view.page.bring_to_front()
    view.page.wait_for_function("!!window.flightFreezeEye")
    view.page.wait_for_timeout(170)
    view.page.keyboard.up("w")
    drift = math.dist(view.page.evaluate("flightFreezeEye"), view.pose()["eye"])
    require(drift < 1e-7, f"resume advanced the old key by {drift:.5f} m")
    return {"foreground_stall_m_s": measured, "resume_drift_m": drift}


def desktop(view):
    result = {}
    view.page.evaluate(EVENTS)
    for label, height, shift, expected in [
        ("street", 3, False, 10),
        ("tower", 190, False, 100.16),
        ("sky", 300, False, 108),
        ("sky_shift", 300, True, 216),
    ]:
        before = position(view, height)
        if shift:
            view.page.keyboard.down("Shift")
        view.page.keyboard.down("w")
        view.page.wait_for_timeout(440)
        view.page.keyboard.up("w")
        if shift:
            view.page.keyboard.up("Shift")
        measured = rate(view, before, "keydown", "keyup", lambda e: e.get("code") == "KeyW")
        require(abs(measured - expected) < max(0.45, expected * 0.045), f"{label}: {measured:.2f} m/s")
        result[label + "_m_s"] = measured
    result.update(interrupted_keyboard(view))
    view.page.locator("#viewpoints button").first.click()
    view.page.evaluate("cityReview.camera.position.set(1600,80,1900);cityReview.camera.updateMatrixWorld()")
    before = view.pose()
    view.pitch(1)
    look = view.pose()
    require(look["eye"] == before["eye"] and look["gaze"][1] > 0.35, "mouse drag pitches the free camera")
    view.page.mouse.wheel(0, -120)
    view.page.wait_for_function(
        "xyz=>Math.hypot(...viewerPose().eye.map((x,i)=>x-xyz[i]))>.1", arg=look["eye"]
    )
    result["wheel_forward_m"] = round(travel(look, view.pose()), 3)
    start = view.pose()
    view.page.keyboard.down("s")
    view.page.wait_for_timeout(260)
    view.page.keyboard.up("s")
    result["pitched_s_m"] = round(travel(start, view.pose(), -1), 3)
    start = view.pose()
    view.page.keyboard.down("a")
    view.page.wait_for_timeout(260)
    view.page.keyboard.up("a")
    result["lateral_m"] = horizontal_strafe(start, view.pose())
    return result


def mobile(view):
    view.page.evaluate(EVENTS)
    x, y, width = view.stick_geometry()
    result = {}
    for label, height, throw, lo, hi in [
        ("street_full", 3, 1, 9.6, 10.4),
        ("street_half", 3, 0.5, 2.5, 3.6),
        ("street_quarter", 3, 0.25, 0.63, 1.22),
        ("tower_half", 190, 0.5, 4.5, 6.4),
        ("sky_full", 300, 1, 103, 113),
    ]:
        before = position(view, height)
        view.touch("touchStart", (1, x, y - width * 0.31 * throw))
        view.page.wait_for_timeout(480)
        view.touch("touchEnd")
        measured = rate(view, before, "pointerdown", "pointerup", lambda e: e["target"] == "stick")
        require(lo <= measured <= hi, f"{label}: {measured:.2f} m/s")
        result[label + "_m_s"] = measured
    view.page.locator("#viewpoints button").first.tap()
    view.page.evaluate("cityReview.camera.position.set(1700,20,1900);cityReview.camera.updateMatrixWorld()")
    w, h = view.width, view.height
    l = (1, x, y)
    r = (2, 0.65 * w, 0.73 * h)
    view.touch("touchStart", l)
    view.touch("touchStart", l, r)
    require(
        view.page.locator("#stick[data-active],canvas[data-dragging]").count() == 2,
        "simultaneous pointer capture",
    )
    r = (2, 0.68 * w, 0.23 * h)
    view.touch("touchMove", l, r)
    view.page.wait_for_function("viewerPose().gaze[1]>.4")
    before = view.pose()
    l = (1, x, y - 0.33 * width)
    view.touch("touchMove", l, r)
    view.page.wait_for_function("p=>Math.hypot(...viewerPose().eye.map((x,i)=>x-p[i]))>1", arg=before["eye"])
    first = view.pose()
    travel(before, first)
    r = (2, 0.89 * w, 0.49 * h)
    view.touch("touchMove", l, r)
    view.page.wait_for_function("g=>Math.abs(viewerPose().gaze[1]-g[1])>.13", arg=first["gaze"])
    steer = view.pose()
    view.page.wait_for_function("p=>Math.hypot(...viewerPose().eye.map((x,i)=>x-p[i]))>1", arg=steer["eye"])
    result["gaze_turn_deg"] = round(angle(first["gaze"], steer["gaze"]), 2)
    result["steered_travel_m"] = round(travel(steer, view.pose()), 3)
    view.touch("touchCancel")
    stopped = view.pose()
    view.page.wait_for_timeout(360)
    require(
        view.pose() == stopped
        and view.page.locator("#stick[data-active],canvas[data-dragging]").count() == 0,
        "cancellation releases both hands and holds position",
    )
    l = (1, x, y + 0.34 * width)
    view.touch("touchStart", l)
    view.page.wait_for_timeout(320)
    view.touch("touchEnd")
    end = view.pose()
    result["reverse_m"] = round(travel(stopped, end, -1), 3)
    view.page.wait_for_timeout(280)
    require(view.pose() == end, "release hovers")
    view.pitch(-1)
    start = view.pose()
    view.touch("touchStart", (1, x, y - 0.34 * width))
    view.page.wait_for_timeout(270)
    view.touch("touchEnd")
    result["looking_down_forward_m"] = round(travel(start, view.pose()), 3)
    start = view.pose()
    view.touch("touchStart", (1, x + 0.34 * width, y))
    view.page.wait_for_timeout(240)
    view.touch("touchEnd")
    result["lateral_m"] = horizontal_strafe(start, view.pose())
    require(
        view.page.locator("button").filter(has_text="上升").count() == 0
        and view.page.locator("button").filter(has_text="下降").count() == 0,
        "no altitude buttons",
    )
    result["cancel_and_release_hover_m"] = 0
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url")
    parser.add_argument("--device", choices=["all", "390", "320", "desktop"], default="all")
    parser.add_argument("--frame-profile", action="store_true")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    with review_address(args.url) as url, sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path=which("chromium"),
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
            ],
        )
        data = {}
        for device, read in [("390", mobile), ("320", mobile), ("desktop", desktop)]:
            if args.device not in ("all", device):
                continue
            view = Viewer(browser, url, device, None)
            timing = profile(view) if args.frame_profile else {}
            data[device] = read(view)
            data[device].update(timing)
            data[device]["load_seconds"] = view.data["load_seconds"]
            require(not view.errors, view.errors)
            view.context.close()
        browser.close()
    payload = json.dumps(data, indent=2, ensure_ascii=False)
    print(payload)
    if args.report:
        args.report.write_text(payload + "\n")
