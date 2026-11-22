import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from 'three'
import { Mason } from '../src/mesh.js'
import { materials } from '../src/kit.js'
import { courtyardCollision } from '../src/collision.js'
import { palaceSites } from '../src/reachMap.js'
import { reachLand } from '../src/reachLand.js'
import { ridgePalaces } from '../src/ridgePalaces.js'

const m = materials(),
  scene = new T.Scene(),
  world = {
    lights: [],
    lamp(...args) {
      this.lights.push(args)
    },
  }
const ridge = new Mason(scene)
reachLand(ridge, m, world)
ridge.finish()
const palace = new Mason(scene)
ridgePalaces(palace, m, world)
const bounds = palaceSites.map(() => new T.Box3()),
  vertex = new T.Vector3()
let triangles = 0
for (const batch of palace.groups.values()) {
  triangles += batch.ix.length / 3
  for (let i = 0; i < batch.p.length; i += 3) {
    vertex.fromArray(batch.p, i)
    const index = palaceSites.findIndex(
      (s) => Math.abs(vertex.x - s.x) <= s.width / 2 && Math.abs(vertex.z - s.z) <= s.depth / 2
    )
    assert.ok(index >= 0, 'Every projected foot and eave fits on its own surveyed mountain shelf')
    bounds[index].expandByPoint(vertex)
  }
}
palace.finish()
const city = courtyardCollision(scene),
  eyeHeight = 1.62
function enter(index, x, y, z, standing = true) {
  const s = palaceSites[index]
  return { s, standing, eye: new T.Vector3(s.x + x, s.y + y + (standing ? eyeHeight : 0), s.z + z) }
}
function go({ s, eye, standing }, x, z) {
  city.move(eye, s.x + x - eye.x, 0, s.z + z - eye.z, standing ? eyeHeight : 0)
  assert.ok(
    Math.hypot(eye.x - s.x - x, eye.z - s.z - z) < 0.085,
    'The path reaches its threshold ' + [s.x + x, s.z + z]
  )
}
function height({ s, eye, standing }, level) {
  assert.ok(
    Math.abs(eye.y - s.y - (standing ? eyeHeight : 0) - level) < 0.045,
    'Surface elevation ' + level
  )
}

test('all three separate masonry courts and their crowns fit the surveyed terrain shelves', () => {
  const crowns = bounds.map((b, i) => b.max.y - palaceSites[i].y)
  assert.ok(crowns[0] > 68 && crowns[0] < 77)
  assert.ok(crowns[1] > 73 && crowns[1] < 82)
  assert.ok(crowns[2] > 100 && crowns[2] < 110)
  assert.ok(triangles < 115000)
  for (const [i, site] of palaceSites.entries()) {
    const lens = enter(i, 0, 0, site.depth / 2 + 1)
    go(lens, 0, site.depth / 2 - 8.2)
    height(lens, [2.7, 3.1, 3.6][i])
  }
})

test('the western paired towers have a two-way skywalk and a separate open processional arch beneath', () => {
  const walk = enter(0, -14.6, 31.55, -4.38)
  go(walk, 14.43, -4.38)
  height(walk, 31.55)
  go(walk, -14.6, -4.38)
  height(walk, 31.55)
  const flight = enter(0, 0, 15.0, 14, false)
  go(flight, 0, -14.0)
  height(flight, 15.0)
  const seal = enter(0, 0, 28.2, 1.0, false)
  city.move(seal.eye, 0, 0, -8.0)
  assert.ok(
    seal.eye.z - seal.s.z > -3.05,
    'The hanging jade seal is physically present underneath the bridge'
  )
})

test('the roofed climbing gallery of Wangjiang Tower reaches its raised hall and the lookout opens toward the valley', () => {
  const walk = enter(1, -23.6, 3.1, 7.06)
  go(walk, 7.0, 7.06)
  height(walk, 20.6)
  go(walk, 8.25, 7.06)
  go(walk, 8.25, -7.65)
  height(walk, 20.6)
  go(walk, 8.25, 7.06)
  go(walk, 7.0, 7.06)
  go(walk, -22.98, 7.06)
  height(walk, 3.1)
  const prow = enter(1, 8.25, 40.64, -4.75)
  go(prow, -10.8, -4.75)
  height(prow, 40.64)
})

test('both upper side halls of the phoenix court open onto their real angled galleries', () => {
  const low = enter(2, -27.1, 22.3, 1.32)
  go(low, -21.01, 1.32)
  go(low, -8.94, -5.32)
  go(low, 1.37, -5.32)
  height(low, 22.3)
  const high = enter(2, 3.82, 43.28, -5.32)
  go(high, 14.974, -5.32)
  go(high, 23.19, -3.8)
  go(high, 29.77, -3.8)
  height(high, 43.28)
  const hall = enter(2, 3.82, 26.5, 8.5, false)
  go(hall, 3.82, -5.32)
  city.move(hall.eye, 0, 0, -7.4)
  assert.ok(hall.eye.z - hall.s.z > -10.4, 'The gilded throne screen stands behind the open centre aisle')
})
