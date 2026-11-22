import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import * as T from 'three'
import { courtyardCollision } from '../src/collision.js'
import { HEAD_LEVEL, headwater, headwaterMotion } from '../src/headwater.js'
import { cascades } from '../src/headwaterFlow.js'
import { materials } from '../src/kit.js'
import { land } from '../src/land.js'
import { lightRegistry } from '../src/lighting.js'
import { Mason } from '../src/mesh.js'
import { summit } from '../src/summit.js'

let collision, headCollision, water, motion, staticTriangles, lights
const eyeHeight = 1.62

before(() => {
  const platform = new T.Scene(),
    mat = materials(),
    world = lightRegistry(),
    mason = new Mason(platform)
  headwater(mason, mat, world)
  lights = world.lights.slice()
  mason.finish()
  staticTriangles = platform.children.reduce((sum, mesh) => sum + mesh.geometry.index.count / 3, 0)
  headCollision = courtyardCollision(platform, null)
  const group = new T.Scene()
  motion = headwaterMotion(group, mat, world)
  water = group.children[0]
  // Use the old quay, raised palace foundation and the actual walking capsule.
  land(mason, mat, world)
  mason.at(3.8, 25.2, 0, 0, () => summit(mason, mat, { lamp() {} }))
  mason.finish()
  collision = courtyardCollision(platform, null)
})

function near(actual, expected, tolerance = 0.045) {
  assert.ok(Math.abs(actual - expected) < tolerance, 'Expected ' + expected + ', received ' + actual)
}
function walk(eye, x, z) {
  collision.move(eye, x - eye.x, 0, z - eye.z, eyeHeight)
  near(eye.x, x)
  near(eye.z, z)
}
test('both stone stairs lead from their quay through each return landing to the raised palace', () => {
  for (const [foot, turn, aisle, shoulder] of [
    [-18.6, -49.65, -46.36, -15.53],
    [18.9, 56.88, 53.95, 19.35],
  ]) {
    const eye = new T.Vector3(foot, 3.12, -59.75)
    assert.equal(collision.land(eye, eyeHeight), true)
    near(eye.y, 1.35 + eyeHeight)
    walk(eye, foot, -65.34)
    walk(eye, foot, -68.19)
    walk(eye, turn, -68.19)
    near(eye.y, 13.95 + eyeHeight)
    walk(eye, turn, -101.38)
    near(eye.y, HEAD_LEVEL + eyeHeight)
    walk(eye, aisle, -101.38)
    walk(eye, aisle, -71.48)
    walk(eye, shoulder, -71.48)
    walk(eye, shoulder, -66.8)
    walk(eye, 10.02, -66.8)
    near(eye.y, HEAD_LEVEL + eyeHeight)
    walk(eye, 10.02, -72.21)
    near(eye.y, 28.52 + eyeHeight)
    for (const [x, z] of [
      [10.02, -66.8],
      [shoulder, -66.8],
      [shoulder, -71.48],
      [aisle, -71.48],
      [aisle, -101.38],
      [turn, -101.38],
      [turn, -68.19],
      [foot, -68.19],
      [foot, -65.34],
      [foot, -59.75],
    ])
      walk(eye, x, z)
    near(eye.y, 1.35 + eyeHeight)
  }
})

test('the raised foundations, mooring landings and palace stair have continuous surveyed support', () => {
  for (const x of [-45.72, -30, -12.01, 0, 7.8, 21, 42, 53.32])
    for (const z of [-72.1, -80.39, -99.16, -115.84])
      near(headCollision.floor(x, z, 26.73, 0.3), HEAD_LEVEL, 0.016)
  for (const x of [-11.82, -10.2, -8.56, 7.8, 16.18, 17.8, 19.41])
    near(headCollision.floor(x, -66.28, 26.73, 0.3), HEAD_LEVEL, 0.016)
})
test('the three waterfall levels and foam stay inside the northern channel', () => {
  const sheet = water.getObjectByName('跌水丝幕'),
    foam = water.getObjectByName('分水池涟漪')
  const spray = water.getObjectByName('瀑脚飞沫')
  assert.ok(sheet?.isMesh && foam?.isMesh && spray?.isPoints)
  for (const object of [sheet, foam, spray]) {
    object.geometry.computeBoundingBox()
    assert.ok(object.geometry.boundingBox.max.z < -65.55)
    assert.equal(object.userData.noCollision, true)
  }
  const position = sheet.geometry.attributes.position,
    uv = sheet.geometry.attributes.uv
  const channel = sheet.geometry.attributes.channel
  for (const [tier, stage] of cascades.entries())
    for (let i = 0; i < stage.streams.length; i++) {
      const endpoints = [[], []]
      for (let j = 0; j < position.count; j++) {
        if (Math.abs(channel.getX(j) - (4 * tier + i + 0.53)) > 0.006) continue
        const v = uv.getY(j)
        if (v === 0 || v === 1) endpoints[v].push(position.getY(j))
      }
      for (const [index, level] of [stage.y, stage.end].entries()) {
        assert.ok(endpoints[index].length > 6)
        for (const y of endpoints[index]) near(y, level, 0.002)
      }
      if (tier < 2)
        near(
          headCollision.floor(stage.streams[i][0], stage.out - 0.21, stage.end + 0.15, 0.95),
          stage.end,
          0.14
        )
    }
  const flight = new T.Vector3(-15.45, 3.1, -65.35)
  collision.move(flight, 30.9, 0, 0, 0)
  near(flight.x, 15.45)
  near(flight.z, -65.35)
})
test('running sheet, cauldron foam and airborne spray share a live continuous day-night signal', () => {
  motion.update(0, 0)
  motion.update(19.7, 0.44)
  for (const o of water.children) {
    near(o.material.uniforms.time.value, 19.7)
    near(o.material.uniforms.day.value, 0.44)
    assert.ok(o.material.transparent)
  }
  assert.ok(lights.length > 24)
  const triangles = water.children.reduce(
    (n, o) => n + (o.isMesh ? o.geometry.index.count / 3 : 0),
    staticTriangles
  )
  assert.ok(triangles >= 30000 && triangles <= 45000, 'North terrace geometry budget: ' + triangles)
})

test('source channels pass through cut stone apertures and stop at the spandrels between them', () => {
  for (const [x] of cascades[0].streams) {
    const eye = new T.Vector3(x, 24.4, -72.06)
    headCollision.move(eye, 0, 0, -2.03, 0)
    near(eye.z, -74.09)
    near(eye.x, x)
    near(headCollision.floor(x, -72.66, 24.16, 0.4), 23.935, 0.018)
  }
  for (const x of [-1.94, 7.67]) {
    const eye = new T.Vector3(x, 24.4, -72.06)
    headCollision.move(eye, 0, 0, -2.03, 0)
    assert.ok(eye.z > -73.46 && eye.z < -73.27, 'Open spandrel at ' + x + ', ' + eye.z)
  }
  // The river reflects the gallery lamps through the translucent lower curtains.
  for (const y of [4.71, 11.78, 18.54]) {
    assert.ok(lights.some((l) => Math.abs(l.p[1] - y) < 0.85 && l.p[0] > -6 && l.p[0] < 13 && l.p[2] < -73))
  }
})

test('the final falling sheet clears the original imperial quay before it meets the river', () => {
  const sheet = water.getObjectByName('跌水丝幕').geometry
  const p = sheet.attributes.position,
    indices = sheet.index.array,
    h = 1.384
  let samples = 0
  for (let j = 0; j < indices.length; j += 3)
    for (let k = 0; k < 3; k++) {
      const a = indices[j + k],
        b = indices[j + ((k + 1) % 3)],
        ay = p.getY(a),
        by = p.getY(b)
      if (ay <= h || by > h) continue
      const t = (h - ay) / (by - ay),
        x = p.getX(a) + (p.getX(b) - p.getX(a)) * t,
        z = p.getZ(a) + (p.getZ(b) - p.getZ(a)) * t
      // Include the largest animated sway at this elevation when casting onto the quay.
      assert.equal(
        collision.floor(x, z - 0.014, h + 0.053, 0.255),
        null,
        'The riverbank clips a sheet at ' + [x, z]
      )
      samples++
    }
  assert.ok(samples > 100)
})
