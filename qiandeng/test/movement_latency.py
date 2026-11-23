"""Measure a real joystick press through the first displaced WebGL frame.

    python test/movement_latency.py ./index.html --software

The fence measures GPU completion. Scanout on a physical display is outside this probe.
"""
import argparse
import json
import statistics
import time
from pathlib import Path
from shutil import which

from playwright.sync_api import sync_playwright
from viewer import OBSERVER

MEASURE = """
window.movementSamples = [];
let pending;
window.beginMovementProbe = () => addEventListener('pointerdown', event => {
  if (!event.target.closest('#stick') || !window.viewerCamera) return;
  pending = {input: event.timeStamp, delivered: performance.now(), eye: viewerCamera.position.clone()};
}, true);
__THREE_DEVTOOLS__.addEventListener('observe', ({detail: scene}) => {
  if (!scene.isScene) return;
  const previous = scene.onAfterRender;
  scene.onAfterRender = function(renderer, ...args) {
    previous.call(this, renderer, ...args);
    if (!pending || renderer.getRenderTarget() || !renderer.domElement.closest('#court') ||
        viewerCamera.position.distanceToSquared(pending.eye) < .000001) return;
    const sample = pending;
    pending = null;
    const gl = renderer.getContext();
    const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const distance = viewerCamera.position.distanceTo(sample.eye);
    function completed() {
      const status = gl.clientWaitSync(fence, 0, 0);
      if (status === gl.TIMEOUT_EXPIRED) { setTimeout(completed, 4); return; }
      gl.deleteSync(fence);
      if (status === gl.WAIT_FAILED) throw new Error('Movement frame fence failed');
      movementSamples.push({
        eventDispatchMs: Math.round(sample.delivered-sample.input),
        gpuReadyMs: Math.round(performance.now()-sample.input),
        firstMoveMetres: +distance.toFixed(4)
      });
    }
    setTimeout(completed, 0);
  };
});
"""

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html")
    parser.add_argument("--software", action="store_true")
    parser.add_argument("--rounds", type=int, default=3)
    args = parser.parse_args()
    flags = ["--no-sandbox", "--disable-dev-shm-usage"]
    if args.software:
        flags += ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    with sync_playwright() as api:
        browser = api.chromium.launch(executable_path=which("chromium"), args=flags)
        context = browser.new_context(viewport={"width": 390, "height": 731}, device_scale_factor=1,
                                      has_touch=True, is_mobile=True)
        context.add_init_script(OBSERVER + MEASURE)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.set_default_timeout(240000)
        if args.html.startswith(("https://", "http://")):
            page.goto(args.html, wait_until="commit")
        else:
            context.set_offline(True)
            page.goto("about:blank")
            page.set_content(Path(args.html).read_text(), wait_until="domcontentloaded")
        page.wait_for_function("document.documentElement.dataset.ready === 'true' && window.viewerCamera")
        page.evaluate("beginMovementProbe()")
        bounds = page.locator("#stick").bounding_box()
        x, y = bounds["x"] + bounds["width"] * .5, bounds["y"] + bounds["height"] * .21
        touch = context.new_cdp_session(page)
        for trial in range(args.rounds):
            time.sleep(2.1)
            touch.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 1}]})
            time.sleep(3)
            touch.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
            page.wait_for_function("n => movementSamples.length >= n", arg=trial + 1)
        results = page.evaluate("movementSamples")
        print(json.dumps({"presses": results, "medianGpuReadyMs": statistics.median(
            sample["gpuReadyMs"] for sample in results), "errors": errors}, ensure_ascii=False))
        assert not errors, errors
        browser.close()

if __name__ == "__main__":
    main()
