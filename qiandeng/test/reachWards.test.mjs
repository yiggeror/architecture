import test from 'node:test'
import assert from 'node:assert/strict'
import { Box3, Scene, Vector3 } from 'three'
import { Mason } from '../src/mesh.js'
import { materials } from '../src/kit.js'
import { courtyardCollision } from '../src/collision.js'
import { reachPoint } from '../src/reachMap.js'
import { reachStreets, reachWards } from '../src/reachWards.js'
import { frameHouse } from '../src/reachWardFrame.js'
import { reachMaterials } from '../src/reachWardArt.js'
import { bridgeGallery } from '../src/reachWardBridges.js'
import { inside, streetFront } from '../src/reachWardLife.js'

const m = materials()
reachMaterials(m)
const occupants = reachStreets.flatMap((s) => s.address),
  p = new Vector3()
const parcels = reachStreets.flatMap((st) =>
  st.address.map((h) => {
    const model = new Mason(new Scene()),
      bounds = new Box3()
    frameHouse(model, m, h)
    streetFront(model, m, h)
    inside(model, m, h)
    for (const v of model.groups.values())
      for (let i = 0; i < v.p.length; i += 3) bounds.expandByPoint(p.fromArray(v.p, i))
    assert.ok(Number.isFinite(bounds.min.x) && Number.isFinite(bounds.max.x), h.id)
    const t = st.terrace,
      l = h.x + bounds.min.x,
      r = h.x + bounds.max.x,
      back = h.z + bounds.min.z,
      front = h.z + bounds.max.z
    const quad = [
      [l, back],
      [r, back],
      [r, front],
      [l, front],
    ].map(([a, b]) => reachPoint(t, a, b))
    return { st, h, t, l, r, back, front, quad, bottom: t.y + bounds.min.y, top: t.y + bounds.max.y }
  })
)
function strip(points, a, b) {
  const u = b[1] - a[1],
    v = a[0] - b[0],
    values = points.map(([x, z]) => u * x + v * z)
  return [Math.min(...values), Math.max(...values)]
}
function separated(a, b) {
  for (const q of [a, b])
    for (let i = 0; i < 2; i++) {
      const p = q[i],
        r = q[i + 1],
        s = strip(a, p, r),
        t = strip(b, p, r)
      if (s[1] < t[0] || t[1] < s[0]) return true
    }
  return false
}
test('the river neighborhoods keep their actual roofs, signs and awnings inside their terrace and off the civic street', () => {
  assert.ok(occupants.length >= 360)
  assert.equal(new Set(occupants.map((h) => h.id)).size, occupants.length)
  assert.equal(new Set(occupants.map((h) => h.kind)).size, 8)
  assert.equal(new Set(occupants.map((h) => h.trade)).size, 6)
  assert.ok(occupants.some((h) => h.floors === 1) && occupants.some((h) => h.floors >= 5))
  for (const h of parcels) {
    assert.ok(h.l >= -h.t.width / 2 + 2.14 && h.r <= h.t.width / 2 - 2.14, h.h.id + ' end lane')
    assert.ok(h.front <= h.t.depth / 2 - 2.48, h.h.id + ' quay')
    assert.ok(h.back >= -h.t.depth / 2 + 0.8, h.h.id + ' rear')
  }
  for (const st of reachStreets) {
    const hd = parcels.filter((q) => q.st === st),
      left = hd.filter((q) => q.h.part === 0).at(-1),
      right = hd.find((q) => q.h.part === 1)
    assert.ok(right.l - left.r >= 3.55, st.terrace.id + ' cut-through')
  }
})
test('independent house envelopes do not intersect, including returns of other sloping districts', () => {
  for (let i = 0; i < parcels.length; i++)
    for (let j = i + 1; j < parcels.length; j++) {
      const a = parcels[i],
        b = parcels[j]
      if (a.top < b.bottom || b.top < a.bottom) continue
      assert.ok(separated(a.quad, b.quad), a.h.id + ' intersects ' + b.h.id)
    }
})
test('the public path under a bridge and its two open gallery doors are traversable through built collision geometry', () => {
  const row = reachStreets.find((s) => s.bridge?.covered),
    g = row.bridge,
    scene = new Scene(),
    builder = new Mason(scene)
  for (const id of [g.left, g.right]) {
    const h = row.address.find((a) => a.id === id)
    builder.at(h.x, 0, h.z, 0, () => frameHouse(builder, m, h))
  }
  bridgeGallery(builder, m, row)
  builder.finish()
  const collision = courtyardCollision(scene)
  const x = (g.leftX + g.rightX) / 2,
    under = new Vector3(x, 1.6, g.z + 3.4)
  collision.move(under, 0, 0, -6.8, 0)
  assert.ok(under.z < g.z - 3.38)
  const eye = new Vector3(g.leftX - 0.56, g.level + 1.33, g.z)
  assert.ok(collision.clearance(eye) < 0.001)
  collision.move(eye, g.rightX - g.leftX + 1.13, 0, 0, 0)
  assert.ok(eye.x > g.rightX + 0.54)
  assert.ok(Math.abs(collision.floor(x, g.z, g.level + 0.12, 0.5) - g.level) < 0.008)
})
test('a customer may enter the shop, climb its physical treads and clear the cut in the upper floor', () => {
  const h = occupants.find((a) => a.stair && a.open && !a.bridge && a.width > 9),
    scene = new Scene(),
    b = new Mason(scene)
  frameHouse(b, m, h)
  b.finish()
  const c = courtyardCollision(scene)
  const w = h.width - 1.28,
    d = h.depth - 1.45,
    side = h.phase % 2 ? -1 : 1,
    x = side * w * 0.34,
    top = -d / 2 + 1.04,
    run = Math.min(5.75, d - 2.05),
    n = Math.ceil(h.ground / 0.217)
  const entering = new Vector3(0.5, 1.54, h.depth / 2 + 0.7)
  c.move(entering, 0, 0, -3.2, 0)
  assert.ok(entering.z < h.depth / 2 - 2.45)
  for (let i = 0; i < n; i++) {
    const y = 0.2 + h.ground * (1 - i / n),
      z = top + ((i + 0.49) * run) / n
    assert.ok(Math.abs(c.floor(x, z, y + 0.087, 0.15) - y) < 0.006, `tread ${i}`)
    assert.ok(c.clearance(new Vector3(x, y + 1.52, z)) < 0.001, `headroom on ${i}`)
  }
})
test('small interiors have a distance cutoff while world-position surfaces and registered practical lamps remain', () => {
  const scene = new Scene(),
    lit = []
  reachWards(new Mason(scene), m, {
    addLightAt(b, x, y, z, col, power, r) {
      lit.push([...b.point([x, y, z]), col, power, r])
    },
  })
  const lod = scene.children.filter((o) => o.isLOD),
    solid = scene.children.filter((o) => o.isMesh && o.material === m.reachFrame)
  assert.ok(lod.length >= reachStreets.length && solid.length >= reachStreets.length)
  for (const o of lod) {
    assert.equal(o.levels.length, 2)
    assert.ok(o.levels[1].distance > 120)
    assert.equal(o.levels[1].object.children.length, 0)
    assert.equal(o.levels[0].object.userData.noCollision, true)
  }
  assert.ok(lit.length > occupants.length * 0.45 && lit.length < occupants.length * 1.35)
  assert.ok(lit.every((rec) => rec.every(Number.isFinite)))
  let all = 0,
    fine = 0
  scene.traverse((o) => {
    if (o.isMesh) {
      all += o.geometry.index.count / 3
      if (o.parent.isLOD) fine += o.geometry.index.count / 3
    }
  })
  assert.ok(all / occupants.length < 695 && fine > all * 0.1)
})
