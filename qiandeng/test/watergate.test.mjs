import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import * as T from 'three'
import { courtyardCollision } from '../src/collision.js'
import { materials } from '../src/kit.js'
import { lightRegistry } from '../src/lighting.js'
import { Mason } from '../src/mesh.js'
import { watergate } from '../src/watergate.js'

const eyeHeight = 1.64
let collision

before(() => {
  // Exercise the same mesh, spatial batches and capsule used by the browser.
  const scene = new T.Scene()
  const mason = new Mason(scene)
  watergate(mason, materials(), lightRegistry())
  mason.finish()
  collision = courtyardCollision(scene, null)
})

function near(actual, expected, tolerance = 0.015) {
  assert.ok(Math.abs(actual - expected) < tolerance, `expected ${expected}, received ${actual}`)
}

test('the central navigation box and both smaller parade passages are open at both portals', () => {
  // Include all four edges of the 11 m × 6.7 m opening, and the full beam
  // of the 3.3 m-wide flagship on its return along the eastern arch centreline.
  const openings = [
    { xs: [-5.5, -2.75, 0, 2.75, 5.5], ys: [0.2, 3.12, 5.3, 6.7] },
    { xs: [-14.77, -13.12, -11.47, 11.47, 13.12, 14.77], ys: [0.2, 1.82, 3.6, 5.7] },
  ]
  for (const { xs, ys } of openings) {
    for (const x of xs) {
      for (const y of ys) {
        const eye = new T.Vector3(x, y, -1.85)
        for (const destination of [-16.15, -1.85]) {
          collision.move(eye, 0, 0, destination - eye.z, 0)
          near(eye.x, x)
          near(eye.y, y)
          near(eye.z, destination)
        }
      }
    }
  }
})

test('the solid piers and three masonry vaults stop flight where the drawn bridge is solid', () => {
  for (const [x, soffit] of [
    [-13.12, 6.5],
    [0, 9.08],
    [13.12, 6.5],
  ]) {
    const eye = new T.Vector3(x, 2.45, -9)
    collision.move(eye, 0, 14, 0, 0)
    assert.ok(eye.y > soffit - 0.3 && eye.y < soffit - 0.13, `unsealed vault at x=${x}`)
    near(collision.floor(x, -9, 10.55, 0.65), 10.362)
  }
  for (const x of [-18.1, -8.43, 8.43, 18.1]) {
    const eye = new T.Vector3(x, 7.51, -1.8)
    collision.move(eye, 0, 0, -15.7, 0)
    assert.ok(eye.z > -4.66 && eye.z < -4.03, `passed through a bridge pier at x=${x}`)
  }
})

test('the full processional route reaches both bank landings through both flanking towers', () => {
  const eye = new T.Vector3(-51.1, 3.67, -9)
  assert.equal(collision.land(eye, eyeHeight), true)
  const route = [
    [-41.27, 4.292],
    [-31.11, 7.418],
    [-21.9, 10.362],
    [-17.14, 10.362],
    [0, 10.362],
    [17.14, 10.362],
    [21.9, 10.362],
    [31.11, 7.418],
    [41.27, 4.292],
    [51.1, 1.3505],
  ]
  for (const [x, y] of route) {
    collision.move(eye, x - eye.x, 0, 0, eyeHeight)
    near(eye.x, x)
    near(eye.y, y + eyeHeight, 0.024)
    near(eye.z, -9)
  }
  // Different stride lengths on the way back also traverse the mortar joints.
  for (let i = 0; i < 1442; i++) collision.move(eye, -0.0708, 0, 0, eyeHeight)
  near(eye.x, 51.1 - 1442 * 0.0708)
  near(eye.y, 1.3505 + eyeHeight)
})

test('the real interior flight clears the upper gallery floor and its rear columns', () => {
  const eye = new T.Vector3(-6.23, 12.11, -10.72)
  assert.equal(collision.land(eye, eyeHeight), true)
  for (const x of [-3.1, 0.2, 2.8, 5.69]) {
    collision.move(eye, x - eye.x, 0, 0, eyeHeight)
    near(eye.x, x)
    near(eye.z, -10.72)
  }
  near(eye.y, 16.325 + eyeHeight)
  collision.move(eye, 0, 0, 2.55, eyeHeight)
  near(eye.z, -8.17)
  near(eye.y, 16.325 + eyeHeight)
})
