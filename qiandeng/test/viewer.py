"""Exercise an actual 千灯渡 HTML build in Chromium. The Three.js observer only reads poses.

Start an HTTP server for the build and run the following command from the project directory.
    python test/viewer.py --url http://localhost:4173/ --screenshots /tmp/qiandeng-views
The review HTML can be passed to --url as well. Install Python Playwright and Pillow first.
"""

import argparse
import io
import json
import math
from pathlib import Path
from shutil import which
from time import monotonic

from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import Error as BrowserError
from playwright.sync_api import sync_playwright

DEVICES = {"320": (320, 568), "390": (390, 844), "desktop": (1100, 690)}
LABELS = ["灯河", "水关", "灯市", "云阙", "全城"]
# World-space roof corners and finials surveyed from the city meshes. Keep
# these independent of the camera's own fitting volume and its target point.
PANORAMA_LANDMARKS = {
    "南栈南檐": [169.01, 15.29, 203.80],
    "南栈东檐": [211.31, 38.36, 180.42],
    "南栈上街": [177.38, 47.04, 117.59],
    "星渡西埠": [12.06, 80.93, -562.53],
    "岑楼东北脊": [311.40, 205.77, -515.95],
    "玉京东檐": [351.22, 158.18, -309.91],
    "桂浦山脊": [-153.10, 125.42, -312.35],
    "西津西檐": [-152.56, 55.25, 12.68],
    "书坊西檐": [-175.03, 79.10, -135.74],
    "山城西关": [-119.62, 125.72, -203.36],
    "东观楼顶": [85.86, 141.74, -216.74],
    "凤阙宝顶": [150.09, 202.78, -356.00],
    "南口灯塔": [-18.06, 13.72, 82.21],
    "旧城宫阙": [7.80, 84.02, -101.45],
    "水关正脊": [-3.92, 28.41, -9.10],
}
# The official Three.js devtools hook observes both the minified single file and
# the review build. All camera movement comes from browser input.
OBSERVER = """window.__THREE_DEVTOOLS__ = new EventTarget();
__THREE_DEVTOOLS__.addEventListener('observe', ({detail: scene}) => {
  if (!scene.isScene) return;
  const previous = scene.onAfterRender;
  scene.onAfterRender = function(renderer, root, camera, ...args) {
    if (camera.isPerspectiveCamera && (camera.layers.mask & 2)) {
      window.viewerCamera = camera;
      if (!window.viewerWorld || root.children.some(o=>o.isScene)) window.viewerWorld = root;
      window.viewerFrames = (window.viewerFrames || 0) + 1;
    }
    previous.call(this, renderer, root, camera, ...args);
  };
});
window.viewerPose = () => {
  const c = window.viewerCamera;
  return {eye: c.position.toArray(), gaze: c.getWorldDirection(c.position.clone()).toArray()};
};
window.viewerMenu = [];
for (const type of ['contextmenu', 'selectstart'])
  document.addEventListener(type, e => viewerMenu.push([type, e.defaultPrevented, e.isTrusted]));
"""

LAYOUT = """() => {
  const rows = {};
  for (const e of document.querySelectorAll('.brand,.phase,#stick,#travel-hint,#viewpoints,button')) {
    const r = e.getBoundingClientRect();
    if (!r.width) continue;
    const id = e.id || e.className || e.textContent.trim();
    const points = [[.5,.5], [.12,.5], [.88,.5], [.5,.12], [.5,.88]];
    rows[id] = {bounds:[r.left,r.top,r.right,r.bottom], width:r.width, height:r.height,
      hit: points.every(([x,y]) => e.contains(document.elementFromPoint(r.x+x*r.width,r.y+y*r.height)))};
  }
  return {rows, wide:document.documentElement.scrollWidth, tall:document.documentElement.scrollHeight,
    look: document.elementFromPoint(.78*innerWidth,.53*innerHeight)?.matches('canvas')};
}"""


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def angle(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    return math.degrees(math.acos(max(-1, min(1, dot))))


def travel(a, b, direction=1):
    delta = [y - x for x, y in zip(a["eye"], b["eye"])]
    length = math.hypot(*delta)
    require(length > 0.12, f"flight distance {length:.6f} m")
    cosine = sum(d * f for d, f in zip(delta, a["gaze"])) / length
    require(cosine * direction > 0.998, f"travel/gaze cosine {cosine:.8f}, expected sign {direction}")
    return length


def rect_gap(a, b):
    dx = max(0, a[0] - b[2], b[0] - a[2])
    dy = max(0, a[1] - b[3], b[1] - a[3])
    return math.hypot(dx, dy)


class Viewer:
    def __init__(self, browser, url, device, pictures):
        self.device = device
        self.width, self.height = DEVICES[device]
        self.mobile = device != "desktop"
        self.pictures = pictures
        self.context = browser.new_context(
            viewport={"width": self.width, "height": self.height},
            device_scale_factor=1,
            is_mobile=self.mobile,
            has_touch=self.mobile,
        )
        self.context.add_init_script(OBSERVER)
        self.page = self.context.new_page()
        self.page.set_default_timeout(65000)
        self.cdp = self.context.new_cdp_session(self.page)
        self.errors = []
        self.fingers = set()
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        started = monotonic()
        self.page.goto(url, wait_until="domcontentloaded")
        self.page.wait_for_function(
            "document.documentElement.dataset.ready && !!window.viewerCamera", timeout=155000
        )
        self.data = {"load_seconds": round(monotonic() - started, 2), "arrival": self.pose()["eye"]}

    def pose(self):
        return self.page.evaluate("viewerPose()")

    def button(self, name):
        button = self.page.get_by_role("button", name=name, exact=True)
        box = button.bounding_box()
        x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        if self.mobile:
            self.page.touchscreen.tap(x, y)
        else:
            self.page.mouse.click(x, y)

    def shot(self, name, compare=False):
        if not self.pictures and not compare:
            return None
        frame = self.page.evaluate("viewerFrames")
        self.page.wait_for_function("previous => viewerFrames >= previous + 1", arg=frame)
        data = self.page.screenshot()
        if self.pictures:
            (self.pictures / f"{self.device}-{name}.png").write_bytes(data)
        image = Image.open(io.BytesIO(data)).convert("RGB")
        return image.crop((0, int(0.18 * self.height), self.width, int(0.74 * self.height))).resize(
            (80, 44)
        )

    def touch(self, event, *points):
        fingers = [
            {"id": i, "x": x, "y": y, "radiusX": 5, "radiusY": 5, "force": 0.75} for i, x, y in points
        ]
        self.cdp.send("Input.dispatchTouchEvent", {"type": event, "touchPoints": fingers})
        ids = {point["id"] for point in fingers}
        if event in ("touchStart", "touchMove"):
            self.fingers.update(ids)
        elif event == "touchEnd" and ids:
            self.fingers.difference_update(ids)
        else:
            self.fingers.clear()

    def drag(self, start, finish):
        if self.mobile:
            self.touch("touchStart", (2, *start))
            self.touch("touchMove", (2, *finish))
            self.touch("touchEnd")
        else:
            self.page.mouse.move(*start)
            self.page.mouse.down()
            self.page.mouse.move(*finish)
            self.page.mouse.up()

    def pitch(self, sign):
        x, y0, y1 = self.width * 0.72, self.height * 0.76, self.height * 0.20
        if sign < 0:
            y0, y1 = y1, y0
        for _ in range(4):
            if self.pose()["gaze"][1] * sign > 0.99993:
                break
            self.drag((x, y0), (x, y1))
        y = self.pose()["gaze"][1]
        require(y * sign > 0.99993, f"could only pitch to {math.degrees(math.asin(y)):.3f}°")
        return round(math.degrees(math.asin(y)), 3)

    def layout(self):
        page = self.page
        page.wait_for_function('document.fonts.status === "loaded"')
        view = page.evaluate(LAYOUT)
        rows = view["rows"]
        require(view["look"] and view["wide"] <= self.width and view["tall"] <= self.height, str(view))
        require(page.locator("#viewpoints button").all_text_contents() == LABELS, str(rows.keys()))
        targets = LABELS + ["雨夜", "白昼"] + (["stick"] if self.mobile else [])
        for name in targets:
            row = rows[name]
            x1, y1, x2, y2 = row["bounds"]
            if self.mobile:
                require(min(row["width"], row["height"]) >= 44, f"{name} touch target too small: {row}")
            require(
                0 <= x1 < x2 <= self.width + 0.01 and 0 <= y1 < y2 <= self.height + 0.01 and row["hit"],
                f"{name}: {row}",
            )
        groups = ["brand", "phase", "travel-hint", "viewpoints"] + (["stick"] if self.mobile else [])
        for i, first in enumerate(groups):
            for second in groups[i + 1 :]:
                require(
                    rect_gap(rows[first]["bounds"], rows[second]["bounds"]) > 0,
                    f"{first} touches {second}",
                )
        self.data["layout"] = {
            "station_width": round(rows["灯河"]["width"], 2),
            "station_height": rows["灯河"]["height"],
            "station_bounds": rows["viewpoints"]["bounds"],
            "hit_samples": 5 * len(targets),
        }
        if self.mobile:
            self.data["layout"]["stick_bounds"] = rows["stick"]["bounds"]
            self.data["layout"]["stick_to_station_px"] = round(
                rect_gap(rows["stick"]["bounds"], rows["viewpoints"]["bounds"]), 2
            )
        self.shot("arrival")

    def arrivals(self):
        poses = {}
        for label in LABELS:
            self.button(label)
            selected = self.page.locator("#viewpoints [aria-pressed=true]").all_text_contents()
            require(selected == [label], f"{label} selected {selected}")
            poses[label] = self.pose()["eye"]
        positions = list(poses.values())
        nearest = min(math.dist(a, b) for i, a in enumerate(positions) for b in positions[i + 1 :])
        require(nearest > 3, f"stations shared a location within {nearest:.2f} m")
        self.data["arrivals"] = {"stops": poses, "minimum_separation_m": round(nearest, 2)}

    def daylight(self):
        self.button("全城")
        # Make this a free camera pose with its station deselected.
        self.drag((0.55 * self.width, 0.5 * self.height), (0.61 * self.width, 0.53 * self.height))
        before = self.pose()
        require(
            self.page.locator("#viewpoints [aria-pressed=true]").count() == 0,
            "free camera retained a station marker",
        )
        images = []
        for label, key in [("雨夜", "night"), ("白昼", "day"), ("雨夜", "night")]:
            self.button(label)
            require(
                self.page.locator("html").get_attribute("data-mode") == key
                and self.page.get_by_role("button", name=label).get_attribute("aria-pressed") == "true",
                f"{key} did not activate",
            )
            require(self.pose() == before, f"{key} moved the viewpoint")
            if len(images) < 2:
                images.append(self.shot(key, compare=True))
        change = sum(ImageStat.Stat(ImageChops.difference(*images)).mean) / 3
        require(change > 8, f"central image changed only {change:.1f} / 255")
        self.data["mode"] = {"eye_drift_m": 0, "angle_drift_deg": 0, "mean_rgb_change": round(change, 2)}

    def panorama(self):
        self.button("全城")
        # The click places the real eye immediately. Wait for a render begun
        # after the click so the distant camera's far plane has also updated.
        frame = self.page.evaluate("viewerFrames")
        self.page.wait_for_function("frame=>viewerFrames>frame", arg=frame)
        start = self.pose()
        gaze = start["gaze"]
        yaw = math.atan2(gaze[0], -gaze[2])
        sweep = 0
        frustum = self.page.evaluate(
            """pts=>{
              const scores={}, point=viewerCamera.position.clone(), matrix=viewerCamera.matrixWorld.clone();
              function keep(name,score) {
                if (scores[name]===undefined || score>scores[name]) {
                  scores[name]=score; pts[name]=point.toArray();
                }
              }
              function vertices(o,read) {
                const pos=o.geometry.attributes.position, count=o.isInstancedMesh?o.count:1;
                if (!pos || !pos.count) return;
                for (let i=0;i<count;i++) {
                  if (o.isInstancedMesh) { o.getMatrixAt(i,matrix); matrix.premultiply(o.matrixWorld); }
                  else matrix.copy(o.matrixWorld);
                  for (let j=0;j<pos.count;j++) { point.fromBufferAttribute(pos,j).applyMatrix4(matrix); read(); }
                }
              }
              viewerWorld.traverse(o=>{
                if (o.isMesh && !o.userData.noCollision && o.material.name==='江城街坊') vertices(o,()=>{
                  if(point.z < -545) {keep('星渡北檐',-point.z); keep('星渡最高屋脊',point.y);}
                  if(point.x > 90 && point.z > 90) keep('南栈最南屋角',point.z);
                });
                if (!o.isLOD || !o.name.endsWith('街后楼')) return;
                const ward=o.name.slice(0,-3);
                if (!['南栈','玉京','桂浦','铜雀','画桥','岑楼','星渡'].includes(ward)) return;
                const model=o.levels[0].object; model.updateWorldMatrix(true,true);
                model.traverse(m=>{if(m.isMesh) vertices(m,()=>keep(ward+'后山最高楼尖',point.y));});
              });
              const points=Object.fromEntries(Object.entries(pts).map(([name,p])=>{
                point.fromArray(p);
                const distance=-point.clone().applyMatrix4(viewerCamera.matrixWorldInverse).z;
                return [name,[...point.project(viewerCamera).toArray(),distance,...p]];
              }));
              return {near:viewerCamera.near,far:viewerCamera.far,points};
            }""",
            PANORAMA_LANDMARKS,
        )
        projected = frustum["points"]
        for label in ["南栈最南屋角", "星渡北檐", "星渡最高屋脊", "星渡后山最高楼尖", "铜雀后山最高楼尖", "画桥后山最高楼尖"]:
            require(label in projected, f"missing built landmark {label}")
        span = [max(abs(p[i]) for p in projected.values()) for i in range(2)]
        coverage = [
            (max(p[i] for p in projected.values()) - min(p[i] for p in projected.values())) / 2
            for i in range(2)
        ]
        for name, p in projected.items():
            x, y, z, distance = p[:4]
            require(
                abs(x) < 0.985 and abs(y) < 0.985 and -1 < z < 1 and frustum["near"] < distance < frustum["far"],
                f"{name} clips out of the actual camera frustum: ({x:.3f}, {y:.3f}, {z:.6f})",
            )
        self.shot("panorama")
        for _ in range(8):
            self.drag((0.21 * self.width, 0.50 * self.height), (0.76 * self.width, 0.50 * self.height))
            gaze = self.pose()["gaze"]
            latest = math.atan2(gaze[0], -gaze[2])
            sweep += math.remainder(latest - yaw, 2 * math.pi)
            yaw = latest
            if sweep > 2 * math.pi:
                break
        require(sweep > 2 * math.pi, f"yaw sweep only {math.degrees(sweep):.1f} degrees")
        up = self.pitch(1)
        self.shot("sky")
        down = self.pitch(-1)
        self.shot("down")
        require(self.pose()["eye"] == start["eye"], "looking around panned the camera")
        self.data["panorama"] = {
            "eye": start["eye"],
            "far_clip_m": frustum["far"],
            "deepest_landmark_m": round(max(p[3] for p in projected.values()), 3),
            "max_ndc_z": round(max(p[2] for p in projected.values()), 9),
            "max_abs_ndc_xy": [round(a, 3) for a in span],
            "width_height_coverage": [round(a, 3) for a in coverage],
            "landmark_projections": {name: [round(p[0], 3), round(p[1], 3)] for name, p in projected.items()},
            "northern_roof_world": [round(c, 2) for c in projected["星渡北檐"][4:]],
            "northern_tower_world": [round(c, 2) for c in projected["星渡后山最高楼尖"][4:]],
            "yaw_sweep_deg": round(math.degrees(sweep), 1),
            "pitch_deg": [down, up],
        }

    def orientation(self):
        self.button("全城")
        portrait = self.pose()
        self.page.set_viewport_size({"width": self.height, "height": self.width})
        self.page.wait_for_function(
            "value=>Math.abs(viewerCamera.aspect-value)<.001", arg=self.height / self.width
        )
        landscape = self.pose()
        require(
            math.dist(portrait["eye"], landscape["eye"]) > 8, "panorama did not reframe after rotation"
        )
        self.drag((0.55 * self.height, 0.53 * self.width), (0.62 * self.height, 0.47 * self.width))
        roaming = self.pose()
        self.page.set_viewport_size({"width": self.width, "height": self.height})
        self.page.wait_for_function(
            "value=>Math.abs(viewerCamera.aspect-value)<.001", arg=self.width / self.height
        )
        require(self.pose() == roaming, "free flight jumped when the phone rotated")
        self.data["orientation"] = {
            "panorama_reframe_m": round(math.dist(portrait["eye"], landscape["eye"]), 2),
            "free_pose_change_m": 0,
        }

    def stick_geometry(self):
        rect = self.page.locator("#stick").bounding_box()
        return rect["x"] + rect["width"] / 2, rect["y"] + rect["height"] / 2, rect["height"]

    def flight(self):
        self.button("灯河")
        x, y, size = self.stick_geometry()
        arrival = self.pose()
        self.touch("touchStart", (1, x, y - size * 0.32))
        self.page.wait_for_function("p=>Math.hypot(...viewerPose().eye.map((v,i)=>v-p[i]))>=4", arg=arrival["eye"])
        self.touch("touchEnd")
        departure = self.pose()
        arrival_travel = travel(arrival, departure)
        require(departure["eye"][1] > arrival["eye"][1] + 0.06, "the opening sightline did not climb")
        self.button("灯河")
        self.pitch(1)
        initial = self.pose()
        # The opening can stand beside either quay. Use the physical span to
        # frame its far bank in portrait before looking straight down.
        aim = self.page.evaluate("""eye=>Math.max(eye[1]+70, 2+
          Math.max(Math.abs(eye[0]-22),Math.abs(eye[0]+22))/
          (.78*viewerCamera.aspect*Math.tan(viewerCamera.getEffectiveFOV()*Math.PI/360)))""", initial["eye"])
        self.touch("touchStart", (1, x, y - size * 0.32))
        self.page.wait_for_function(
            "height => viewerPose().eye[1] >= height", arg=aim, timeout=110000
        )
        self.touch("touchEnd")
        top = self.pose()
        climb = travel(initial, top)
        self.pitch(-1)
        overhead = self.pose()
        require(overhead["eye"] == top["eye"], "looking down moved the camera")
        quay_extent = self.page.evaluate(
            """z=> Math.max(...[-22,22].map(x=>
          Math.abs(viewerCamera.position.clone().set(x,1.35,z).project(viewerCamera).x)))""",
            initial["eye"][2],
        )
        require(quay_extent < 0.88, f"overhead shot does not include both quays: {quay_extent:.3f}")
        self.shot("above-river")
        self.touch("touchStart", (1, x, y - size * 0.12))
        self.page.wait_for_function("height => viewerPose().eye[1] < height - 2", arg=top["eye"][1])
        self.touch("touchEnd")
        downward = travel(overhead, self.pose())
        self.pitch(1)
        before_reverse = self.pose()
        # Ease the physical stick back towards neutral as the rooflines draw
        # near. This also works on software-rendered frames over a second long.
        target = initial["eye"][1]
        for _ in range(14):
            start_y = self.pose()["eye"][1]
            error = target - start_y
            if abs(error) <= 0.5:
                break
            sign = math.copysign(1, error)
            throw = 0.75 if abs(error) > 28 else 0.48 if abs(error) > 8 else 0.29 if abs(error) > 2 else 0.15
            self.touch("touchStart", (1, x, y - sign * size * 0.31 * throw))
            self.page.wait_for_function(
                "([y,sign,advance])=>sign*(viewerPose().eye[1]-y)>=advance",
                arg=[start_y, sign, max(0.12, abs(error)*0.65)],
            )
            self.touch("touchEnd")
        landing = self.pose()
        descent = travel(before_reverse, landing, -1)
        require(
            math.dist(initial["eye"], landing["eye"]) < 1.05,
            f"landing offset {math.dist(initial['eye'], landing['eye']):.2f} m",
        )
        self.page.wait_for_timeout(400)
        require(self.pose() == landing, "release did not hover")
        self.data["flight"] = {
            "initial_forward_m": round(arrival_travel, 2),
            "climb_m": round(climb, 2),
            "look_down_forward_m": round(downward, 2),
            "reverse_m": round(descent, 2),
            "arrival_altitude_m": round(initial["eye"][1], 2),
            "maximum_altitude_m": round(top["eye"][1], 2),
            "overhead_quays_abs_ndc": round(quay_extent, 3),
            "landing_offset_m": round(math.dist(initial["eye"], landing["eye"]), 2),
        }

    def two_fingers(self):
        self.button("全城")
        x, y, size = self.stick_geometry()
        w, h = self.width, self.height
        left = (1, x, y)
        right = (2, 0.67 * w, 0.55 * h)
        self.touch("touchStart", left)
        self.touch("touchStart", left, right)
        require(
            self.page.locator("#stick[data-active],canvas[data-dragging]").count() == 2,
            "two controls did not capture simultaneously",
        )
        left = (1, x, y - 0.32 * size)
        self.touch("touchMove", left, right)
        self.page.wait_for_timeout(220)
        right = (2, 0.84 * w, 0.55 * h - 0.33 * w)
        before = self.pose()
        self.touch("touchMove", left, right)
        # Pointer moves are coalesced until a composition frame on software WebGL.
        self.page.wait_for_function(
            "gaze => viewerPose().gaze.some((v,i)=>Math.abs(v-gaze[i]) > .1)",
            arg=before["gaze"],
            timeout=14000,
        )
        turned = self.pose()
        turn_angle = angle(before["gaze"], turned["gaze"])
        require(turn_angle > 20, f"two-finger turn {turn_angle:.1f} degrees")
        self.page.wait_for_function("y => viewerPose().eye[1] > y + 0.4", arg=turned["eye"][1])
        after = self.pose()
        length = travel(turned, after)
        self.touch("touchEnd", right)
        looking_released = self.pose()
        require(
            self.page.locator("#stick[data-active]").count() == 1
            and self.page.locator("canvas[data-dragging]").count() == 0,
            "releasing look also released joystick",
        )
        self.page.wait_for_function(
            "y => viewerPose().eye[1] > y + 0.25", arg=looking_released["eye"][1]
        )
        self.touch("touchEnd")
        self.touch("touchStart", left)
        self.touch("touchStart", left, right)
        self.touch("touchEnd", left)
        stopped = self.pose()
        self.touch("touchMove", (2, 0.64 * w, 0.62 * h))
        self.touch("touchEnd")
        after_look = self.pose()
        require(
            stopped["eye"] == after_look["eye"] and angle(stopped["gaze"], after_look["gaze"]) > 12,
            "releasing stick failed to leave independently steerable hover",
        )
        self.data["two_fingers"] = {
            "turn_deg": round(turn_angle, 1),
            "gaze_aligned_m": round(length, 2),
            "after_release_m": 0,
        }

    def long_press(self):
        x, y, _ = self.stick_geometry()
        right = (2, 0.74 * self.width, 0.34 * self.height)
        self.touch("touchStart", (1, x, y))
        self.touch("touchStart", (1, x, y), right)
        self.page.wait_for_timeout(850)
        active = self.page.locator("#stick[data-active],canvas[data-dragging]").count()
        self.touch("touchEnd")
        title = self.page.locator(".brand h1").bounding_box()
        self.touch("touchStart", (2, title["x"] + title["width"] / 2, title["y"] + title["height"] / 2))
        self.page.wait_for_timeout(850)
        self.touch("touchEnd")
        # Chromium suppresses touch contextmenu entirely on some platforms. A
        # real secondary click also exercises the browser's cancelable default.
        self.page.mouse.click(right[1], right[2], button="right")
        result = self.page.evaluate("""() => {
          const native = viewerMenu.slice();
          const probes = ['#stick','canvas','.brand h1'].flatMap(s=> ['selectstart','contextmenu'].map(t=>
              !document.querySelector(s).dispatchEvent(new Event(t,{cancelable:true,bubbles:true}))));
          return {native, probes, selected:getSelection().toString(),
            userSelect:getComputedStyle(document.querySelector('.brand h1')).userSelect,
            stickAction:getComputedStyle(document.querySelector('#stick')).touchAction,
            canvasAction:getComputedStyle(document.querySelector('canvas')).touchAction,
            scroll:[scrollX,scrollY]};
        }""")
        require(
            active == 2
            and result["userSelect"] == "none"
            and result["stickAction"] == result["canvasAction"] == "none"
            and result["scroll"] == [0, 0]
            and not result["selected"]
            and all(result["probes"])
            and all(prevented for _, prevented, _ in result["native"])
            and any(t == "contextmenu" and trusted for t, _, trusted in result["native"]),
            str(result),
        )
        self.data["long_press"] = {
            "held_ms": 850,
            "trusted_menu_events": sum(
                t == "contextmenu" and trusted for t, _, trusted in result["native"]
            ),
            "cancelled_probes": sum(result["probes"]),
            "selection_chars": len(result["selected"]),
            "scroll": result["scroll"],
        }

    def keyboard(self):
        self.button("全城")
        self.page.locator("canvas").focus()
        self.page.keyboard.press("Tab")
        focus = lambda: self.page.evaluate("document.activeElement.textContent.trim()")
        require(self.page.evaluate("document.activeElement.id") == "character-album", "album link unfocusable")
        self.page.keyboard.press("Tab")
        require(focus() == "雨夜", "Tab did not reach first mode button")
        self.page.keyboard.press("Tab")
        require(focus() == "白昼", "day button unfocusable")
        before = self.pose()
        self.page.keyboard.press("Enter")
        require(
            self.pose() == before and self.page.locator("html").get_attribute("data-mode") == "day",
            "keyboard mode switched camera or failed",
        )
        self.page.keyboard.press("Shift+Tab")
        require(focus() == "雨夜", "Shift+Tab lost")
        self.page.keyboard.press("Space")
        self.page.keyboard.press("Tab")
        self.page.keyboard.press("Tab")
        require(focus() == LABELS[0], "stations unreachable by keyboard")
        self.page.keyboard.press("Enter")
        require(
            self.page.locator("#viewpoints [aria-pressed=true]").text_content() == LABELS[0],
            "Enter did not activate station",
        )
        self.button("全城")
        self.page.locator("canvas").focus()
        self.pitch(1)
        before = self.pose()
        self.page.keyboard.down("w")
        self.page.wait_for_timeout(330)
        self.page.keyboard.up("w")
        after = self.pose()
        length = travel(before, after)
        self.cdp.send("Emulation.setFocusEmulationEnabled", {"enabled": False})
        self.page.keyboard.down("w")
        self.page.wait_for_timeout(280)
        other = self.context.new_page()
        other.bring_to_front()
        self.page.wait_for_function("!document.hasFocus()")
        stopped = self.pose()
        self.page.wait_for_timeout(450)
        require(self.pose() == stopped, "camera drifted while focus was elsewhere")
        self.page.bring_to_front()
        other.close()
        self.page.keyboard.up("w")
        self.page.wait_for_timeout(180)
        require(self.pose() == stopped, "stuck key after focus returned")
        self.data["keyboard"] = {
            "tab_order": ["画面", "人物图录", "雨夜", "白昼", "灯河"],
            "w_m": round(length, 2),
            "blur_drift_m": 0,
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:4173/")
    parser.add_argument("--device", choices=["all", *DEVICES], default="all")
    parser.add_argument("--screenshots", type=Path)
    parser.add_argument(
        "--checks",
        nargs="+",
        choices=[
            "layout",
            "arrivals",
            "daylight",
            "panorama",
            "orientation",
            "flight",
            "two_fingers",
            "long_press",
            "keyboard",
        ],
    )
    args = parser.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    failed = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=which("chromium"),
            args=[
                "--no-sandbox",
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
                "--disable-dev-shm-usage",
            ],
        )
        for name in DEVICES if args.device == "all" else [args.device]:
            viewer = Viewer(browser, args.url, name, args.screenshots)
            parts = ["layout", "arrivals", "daylight", "panorama"] + (
                ["flight", "two_fingers", "long_press", "orientation"] if viewer.mobile else ["keyboard"]
            )
            print(name, "opened", viewer.data, flush=True)
            for part in parts:
                if args.checks and part not in args.checks:
                    continue
                try:
                    getattr(viewer, part)()
                    print(name, part, "passed", flush=True)
                except (AssertionError, BrowserError) as error:
                    failed.append(f"{name}/{part}: {error}")
                    print("FAIL", failed[-1], flush=True)
                    if viewer.fingers:
                        viewer.touch("touchCancel")
            if viewer.errors:
                failed.append(f"{name}/browser: {viewer.errors}")
            print("RESULT", name, json.dumps(viewer.data, ensure_ascii=False), flush=True)
            viewer.context.close()
        browser.close()
    if failed:
        raise SystemExit("\n".join(failed))


if __name__ == "__main__":
    main()
