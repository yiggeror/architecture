import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from 'three'
import { Mason } from '../src/mesh.js'
import { materials } from '../src/kit.js'
import { summit, summitMotion } from '../src/summit.js'
import { courtyardCollision } from '../src/collision.js'

const scene = new T.Scene()
const mat = materials()
const builder = new Mason(scene)
// The north bank meets the first flight at the surveyed ground elevation.
builder.box(mat.earth, 0, 1.1, -96.9, 121, 0.5, 63.8)
summit(builder, mat, { lamp() {} })
builder.finish()
const collision = courtyardCollision(scene, null)
const eyeHeight = 1.62
const floors = [13.52, 24.65, 34.42, 44.18]
function to(eye, x, z, standing = true) {
  collision.move(eye, x - eye.x, 0, z - eye.z, standing ? eyeHeight : 0)
  assert.ok(
    Math.hypot(eye.x - x, eye.z - z) < 0.096,
    'Clear passage to ' + [x.toFixed(2), z.toFixed(2)] + ' from ' + eye.toArray().map((n) => n.toFixed(2))
  )
}
function nearEye(eye, floor) {
  assert.ok(Math.abs(eye.y - (floor + eyeHeight)) < 0.055, 'Actual eye elevation ' + eye.y)
}

test('walk from the imperial quay to every observatory landing and exit onto the armillary deck', () => {
  const eye = new T.Vector3(6.22, 1.35 + eyeHeight, -66.6)
  for (const [z, floor] of [
    [-72.21, 3.32],
    [-83.59, 8.38],
    [-93.3, 13.52],
  ]) {
    to(eye, 6.22, z)
    nearEye(eye, floor)
  }
  for (const [x, z] of [
    [5.61, -96.77],
    [4, -98.16],
    [4, -99.23],
  ])
    to(eye, x, z)
  let angle = Math.PI / 2
  const radius = 2.22
  for (let j = 1; j < floors.length; j++) {
    const count = Math.ceil((floors[j] - floors[j - 1]) / 0.191)
    for (let i = 0; i < count; i++) {
      const step = angle + (i + 0.55) * 0.145
      to(eye, 4 + radius * Math.cos(step), -101.45 + radius * Math.sin(step))
    }
    nearEye(eye, floors[j])
    const exit = angle + (count - 0.45) * 0.145
    if (j === floors.length - 1) {
      to(eye, 4 + 3.7 * Math.cos(exit), -101.45 + 3.7 * Math.sin(exit))
      nearEye(eye, floors[j])
    }
    angle += count * 0.145
  }
})

test('the east skywalk joins both galleries and the arch beneath stays open to flight', () => {
  const eye = new T.Vector3(11.18, 24.65 + eyeHeight, -105.16)
  to(eye, 26.07, -105.16)
  nearEye(eye, 24.65)
  to(eye, 11.18, -105.16)
  nearEye(eye, 24.65)
  const flight = new T.Vector3(18.35, 21.3, -101.25)
  to(flight, 18.35, -109.4, false)
  assert.equal(flight.y, 21.3)
})

test('the western archive leaves an open exterior route to the bell pavilion', () => {
  const eye = new T.Vector3(-41.98, 11.42 + eyeHeight, -96.6)
  to(eye, -41.98, -102.27)
  nearEye(eye, 14.32)
  to(eye, -39.89, -103.88)
  to(eye, -39.89, -106.16)
  nearEye(eye, 14.46)
})

test('the telescope shaft opens through the roofs and the stepped canopies retain vertical clearance', () => {
  const roofMeshes = scene.children.filter((o) => o.material === mat.roof)
  function heights(x, z) {
    const ray = new T.Raycaster(new T.Vector3(x, 61, z), new T.Vector3(0, -1, 0), 0, 51)
    return ray
      .intersectObjects(roofMeshes)
      .map((hit) => hit.point.y)
      .filter((h, i, list) => i === 0 || Math.abs(h - list[i - 1]) > 0.08)
  }
  assert.deepEqual(heights(5.67, -100.32), [])
  const overlap = heights(11.38, -100.43)
  assert.ok(overlap.some((y) => y > 23 && y < 25))
  assert.ok(overlap.some((y) => y > 31 && y < 33))
  for (let i = 1; i < overlap.length; i++) assert.ok(overlap[i - 1] - overlap[i] > 5.7)
})

test('the crowned instrument rotates, stays above the public deck and is luminous at night', () => {
  const motionScene = new T.Scene(),
    motion = summitMotion(motionScene, mat, {})
  const machine = motionScene.children[0]
  motion.update(0, true)
  const axis = machine.children[0],
    first = axis.quaternion.clone()
  motion.update(4, false)
  assert.ok(first.angleTo(axis.quaternion) > 0.2)
  const bounds = new T.Box3().setFromObject(machine)
  assert.ok(bounds.min.y > 46.05)
  assert.ok(machine.children.some((o) => o.isMesh && o.material.emissiveIntensity > 1))
})
