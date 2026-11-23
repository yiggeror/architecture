import assert from 'node:assert/strict'
import test from 'node:test'
import * as T from 'three'
import { courtyardCollision } from '../src/collision.js'
import { navigation } from '../src/walk.js'

class Control extends EventTarget {
  dataset = {}
  style = {}
  attributes = new Map()
  captures = new Set()
  clientWidth = 400
  clientHeight = 400
  setAttribute(k, v) { this.attributes.set(k, v) }
  removeAttribute(k) { this.attributes.delete(k) }
  setPointerCapture(id) { this.captures.add(id) }
  hasPointerCapture(id) { return this.captures.has(id) }
  releasePointerCapture(id) { this.captures.delete(id) }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 } }
  append() {}
  focus() {}
}

function pilot(t, scene = new T.Scene()) {
  let now = 0
  t.mock.method(performance, 'now', () => now)
  const document = new EventTarget(), window = new EventTarget()
  const canvas = new Control(), stick = new Control(), knob = new Control()
  const parts = { stick, court: new Control(), viewpoints: new Control() }
  stick.querySelector = () => knob
  document.createElement = () => new Control()
  document.getElementById = (id) => parts[id]
  globalThis.document = document
  globalThis.addEventListener = window.addEventListener.bind(window)
  t.after(() => { delete globalThis.document; delete globalThis.addEventListener })
  const camera = new T.PerspectiveCamera(56, 1, .1, 1000)
  const world = courtyardCollision(scene), move = t.mock.method(world, 'move')
  const flight = navigation(canvas, camera, world)
  flight.arrive([0, 3, 0], [0, 3, -1])
  function send(target, type, at, fields = {}, delivered = at) {
    now = delivered
    const event = Object.assign(new Event(type, { cancelable: true }), fields)
    Object.defineProperty(event, 'timeStamp', { value: at })
    target.dispatchEvent(event)
  }
  return {
    camera, move, stick, canvas, window, send,
    draw(at) { now = at; flight.step(at) },
    key(type, code, at, delivered) { send(window, type, at, { code }, delivered) },
    thumb(type, at, y = 19, delivered) {
      send(stick, type, at, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 50, clientY: y }, delivered)
    },
  }
}

function near(value, expected) {
  assert.ok(Math.abs(value - expected) < .00001, `expected ${expected}, saw ${value}`)
}

test('a fresh push moves on the first drawable frame even when the press was dispatched just before it', (t) => {
  const p = pilot(t)
  p.draw(0)
  p.thumb('pointerdown', 999)
  p.draw(1000)
  assert.ok(-p.camera.position.z >= .08 && -p.camera.position.z <= .17, p.camera.position.z)
  for (let i = 1; i <= 6; i++) p.draw(1000 + i * 16)
  near(-p.camera.position.z, .97)
})

test('a delayed fresh press shows one frame on arrival and subsequent frames resume the held speed', (t) => {
  const p = pilot(t)
  p.draw(900)
  p.thumb('pointerdown', 1000, 19, 1220)
  p.draw(1580)
  near(-p.camera.position.z, 1 / 6)
  p.draw(1630)
  near(-p.camera.position.z, 1 / 6 + .5)
})

test('a completed tap retains its duration beside a delayed held onset in the same frame', (t) => {
  const p = pilot(t)
  p.draw(900)
  p.key('keydown', 'KeyD', 910)
  p.key('keyup', 'KeyD', 945)
  p.thumb('pointerdown', 1000, 19, 1220)
  p.draw(1580)
  near(p.camera.position.x, .35)
  near(p.camera.position.z, -1 / 6)
})

test('a complete tap delivered after its physical timestamps moves once on the next frame', (t) => {
  const p = pilot(t)
  p.draw(800)
  p.key('keydown', 'KeyW', 710, 1000)
  p.key('keyup', 'KeyW', 745, 1000)
  near(p.camera.position.z, 0)
  p.draw(1200)
  near(p.camera.position.z, -.35)
  p.draw(4200)
  near(p.camera.position.z, -.35)
})

test('a joystick throw and return in one coalesced pointer event retain their physical duration', (t) => {
  const p = pilot(t)
  p.thumb('pointerdown', 10, 50)
  p.send(p.stick, 'pointermove', 90, {
    pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 50,
    getCoalescedEvents: () => [
      { timeStamp: 30, clientX: 50, clientY: 19 },
      { timeStamp: 70, clientX: 50, clientY: 50 },
    ],
  }, 800)
  p.thumb('pointerup', 95, 50, 800)
  p.draw(900)
  near(p.camera.position.z, -.4)
})

test('an 8 kHz pointer retains a full drawable interval when its near-full throw jitters', (t) => {
  const p = pilot(t)
  p.draw(10)
  p.thumb('pointerdown', 10)
  const points = Array.from({ length: 800 }, (_, i) => ({
    timeStamp: 10 + (i + 1) / 8, clientX: 50, clientY: i % 2 ? 19.1 : 19.2,
  }))
  p.send(p.stick, 'pointermove', 110, {
    pointerId: 1, clientX: 50, clientY: points[points.length - 1].clientY, getCoalescedEvents: () => points,
  })
  p.draw(110)
  assert.ok(-p.camera.position.z > .98 && -p.camera.position.z <= 1, p.camera.position.z)
  assert.equal(p.move.mock.callCount(), 1)
})

test('several seconds of thumb events before a draw share one bounded collision sweep', (t) => {
  const p = pilot(t)
  p.thumb('pointerdown', 50)
  for (let at = 70; at <= 3050; at += 10) p.thumb('pointermove', at, at % 20 ? 18 : 20)
  p.thumb('pointerup', 3060)
  near(p.camera.position.z, 0)
  assert.equal(p.move.mock.callCount(), 0)
  p.draw(4000)
  assert.ok(-p.camera.position.z > .5 && -p.camera.position.z <= 1.001, p.camera.position.z)
  assert.equal(p.move.mock.callCount(), 1)
  const stopped = p.camera.position.clone()
  p.draw(6000)
  assert.deepEqual(p.camera.position, stopped)
})

test('releasing a previously visible hold during a stall adds at most one frame of travel', (t) => {
  const p = pilot(t)
  p.thumb('pointerdown', 0)
  p.draw(40)
  near(p.camera.position.z, -.4)
  for (let at = 70; at <= 3000; at += 10) p.thumb('pointermove', at, at % 20 ? 18 : 20)
  p.thumb('pointerup', 3030)
  p.draw(4000)
  assert.ok(-p.camera.position.z >= .4 && -p.camera.position.z <= .57, p.camera.position.z)
})

test('cancelling a stick discards its unpainted travel while a held keyboard strafe continues', (t) => {
  const p = pilot(t)
  p.key('keydown', 'KeyD', 10)
  p.thumb('pointerdown', 20)
  p.thumb('pointermove', 40, 22)
  p.thumb('pointercancel', 55)
  p.draw(70)
  near(p.camera.position.x, .6)
  near(p.camera.position.z, 0)
  p.key('keyup', 'KeyD', 71)
  p.thumb('pointerdown', 80)
  p.thumb('pointermove', 100, 20)
  p.thumb('lostpointercapture', 120)
  p.draw(200)
  near(p.camera.position.z, 0)
})

test('blur discards a completed tap and wheel input awaiting a draw', (t) => {
  const p = pilot(t)
  p.thumb('pointerdown', 10)
  p.thumb('pointerup', 45)
  p.send(p.canvas, 'wheel', 46, { deltaMode: 0, deltaX: 0, deltaY: -120 })
  p.send(p.window, 'blur', 50)
  p.draw(1000)
  assert.deepEqual(p.camera.position.toArray(), [0, 3, 0])
})

test('a pre-blur press drained after focus returns cannot restart flight', (t) => {
  const p = pilot(t)
  p.send(p.window, 'blur', 300)
  p.key('keydown', 'KeyW', 290, 400)
  p.thumb('pointerdown', 295, 19, 410)
  p.draw(500)
  assert.deepEqual(p.camera.position.toArray(), [0, 3, 0])
  assert.equal(p.stick.attributes.has('data-active'), false)
  p.key('keydown', 'KeyW', 510)
  p.draw(550)
  near(p.camera.position.z, -.4)
})

test('two thumbs steer each portion of a held flight along the gaze at that time', (t) => {
  const p = pilot(t)
  p.thumb('pointerdown', 10)
  const touch = { pointerId: 2, pointerType: 'touch', button: 0, clientX: 0, clientY: 200 }
  p.send(p.canvas, 'pointerdown', 12, touch)
  p.send(p.canvas, 'pointermove', 50, { ...touch, clientX: 400 * Math.PI / (2 * 2.05) })
  p.draw(90)
  near(p.camera.position.z, -.4)
  near(p.camera.position.x, .4)
  near(p.camera.position.y, 3)
})

test('a wheel notch travels along the gaze when the notch occurred', (t) => {
  const p = pilot(t)
  p.send(p.canvas, 'wheel', 20, { deltaMode: 0, deltaX: 0, deltaY: -100 })
  const mouse = { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 0, clientY: 200 }
  p.send(p.canvas, 'pointerdown', 21, mouse)
  p.send(p.canvas, 'pointermove', 25, { ...mouse, clientX: Math.PI / .008 })
  p.draw(70)
  near(p.camera.position.x, 0)
  near(p.camera.position.z, -2.142857142857143)
})

test('repeated mouse pans during a stall travel at most one viewport on the next frame', (t) => {
  const p = pilot(t)
  const mouse = { pointerId: 1, pointerType: 'mouse', button: 2, clientX: 0, clientY: 200 }
  for (let at = 0; at < 1000; at += 10) {
    p.send(p.canvas, 'pointerdown', at, mouse)
    p.send(p.canvas, 'pointermove', at + 3, { ...mouse, clientX: 300 })
    p.send(p.canvas, 'pointerup', at + 6, mouse)
  }
  p.draw(1000)
  near(p.camera.position.x, 3.6)
  assert.equal(p.move.mock.callCount(), 1)
})

test('street throttle, sprint speed at altitude, and held arrow turn retain their rates at 60 Hz', (t) => {
  const p = pilot(t)
  p.thumb('pointerdown', 0, 34.5)
  for (let i = 1; i <= 60; i++) p.draw(i * 1000 / 60)
  p.thumb('pointerup', 1000)
  near(p.camera.position.z, -2.9730177875)
  p.camera.position.set(0, 300, 0)
  p.key('keydown', 'ShiftLeft', 1000)
  p.key('keydown', 'KeyW', 1000)
  for (let i = 1; i <= 60; i++) p.draw(1000 + i * 1000 / 60)
  near(p.camera.position.z, -216)
  p.key('keyup', 'KeyW', 2000)
  p.key('keydown', 'ArrowRight', 2000)
  for (let i = 1; i <= 60; i++) p.draw(2000 + i * 1000 / 60)
  near(p.camera.rotation.y, -1.7)
})

test('a burst of wheel events shares one dolly and the actual wall stops the camera', (t) => {
  const scene = new T.Scene()
  const wall = new T.Mesh(new T.PlaneGeometry(20, 20), new T.MeshStandardMaterial())
  wall.position.set(0, 3, -3)
  scene.add(wall)
  const p = pilot(t, scene)
  for (let i = 1; i <= 100; i++)
    p.send(p.canvas, 'wheel', i, { deltaMode: 0, deltaX: 0, deltaY: -120 })
  assert.equal(p.move.mock.callCount(), 0)
  p.draw(1000)
  assert.equal(p.move.mock.callCount(), 1)
  assert.ok(p.camera.position.z > -2.846 && p.camera.position.z < -2.844, p.camera.position.z)
  const distance = p.move.mock.calls[0].arguments[3]
  assert.ok(distance >= -5 && distance < -3, distance)
})
