import test from 'node:test'
import assert from 'node:assert/strict'
import { Box3, Scene, Vector3 } from 'three'
import { Mason } from '../src/mesh.js'
import { materials } from '../src/kit.js'
import { land } from '../src/land.js'
import { courtyardCollision } from '../src/collision.js'
import { lightRegistry } from '../src/lighting.js'
import { buildAddress, wards, wardAddresses, wardRoofs } from '../src/wards.js'
import { houseDimensions, houseParts, shell } from '../src/wardsFrame.js'
import { wardPaint } from '../src/wardsPaint.js'

const scene = new Scene(),
  finishes = materials(),
  registry = lightRegistry()
wardPaint(finishes)
const roofFinishes = new Set([finishes.roof, finishes.roofEdge, finishes.bronze])
const eaves = [],
  bodies = []
// Read world vertices from the actual roof skins, edge tiles, hip tips and ridge ornaments.
// Split workshops occupy one address but have two independently supported roofs.
for (const h of wardAddresses)
  for (const [index, part] of houseParts(h).entries()) {
    const b = new Mason(new Scene()),
      roof = new Box3(),
      body = new Box3(),
      v = new Vector3()
    b.at(h.x, 1.35, h.z, h.angle, () => b.at(part.x, 0, part.z, 0, () => shell(b, finishes, part.house)))
    for (const [mat, g] of b.groups)
      for (let j = 0; j < g.p.length; j += 3) {
        v.fromArray(g.p, j)
        body.expandByPoint(v)
        if (roofFinishes.has(mat)) roof.expandByPoint(v)
      }
    const name = h.name + ' ' + (index + 1)
    eaves.push({ address: h.id, name, box: roof })
    bodies.push({ address: h.id, name, box: body })
  }
const completeAddresses = wardAddresses.map((h) => {
  const house = new Mason(new Scene()),
    box = new Box3(),
    point = new Vector3()
  buildAddress(house, finishes, undefined, h)
  for (const { p } of house.groups.values())
    for (let k = 0; k < p.length; k += 3) box.expandByPoint(point.fromArray(p, k))
  return { address: h.id, name: h.name, box }
})
function separation(a, b) {
  return Math.hypot(
    Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x),
    Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z)
  )
}
function compare(items, minGap) {
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i],
        b = items[j],
        gap = separation(a.box, b.box)
      assert.ok(gap >= minGap, `${a.name} and ${b.name} leave ${gap.toFixed(3)} m`)
    }
}

test('54 premises and their split workshop wings have separate actual eaves and masonry bodies', () => {
  assert.equal(wardAddresses.length, 54)
  assert.equal(new Set(wardAddresses.map((h) => h.name)).size, 54)
  assert.equal(wardRoofs.length, 54)
  assert.ok(eaves.length > 54)
  for (const { address, box, name } of eaves) {
    const nominal = wardRoofs[address]
    assert.ok(!box.isEmpty(), name)
    assert.ok(box.min.x >= nominal.minX - 0.44 && box.max.x <= nominal.maxX + 0.44, name)
    assert.ok(box.min.z >= nominal.minZ - 0.44 && box.max.z <= nominal.maxZ + 0.44, name)
    assert.ok(box.min.z > 2 || box.max.z < -19, name)
    assert.ok(box.min.x > 21.5 || box.max.x < -21.5, name)
  }
  compare(eaves, 0.37)
  compare(bodies, 0.29)
  compare(completeAddresses, 0.17)
})

const batch = new Mason(scene)
wards(batch, finishes, registry)
let faces = 0,
  canopyLow = Infinity,
  tiny = 0
for (const group of batch.groups.values()) {
  const { p, ix } = group
  faces += ix.length / 3
  for (let j = 0; j < p.length; j += 3) {
    const [x, y, z] = [p[j], p[j + 1], p[j + 2]]
    assert.ok(Number.isFinite(x + y + z))
    if (Math.abs(x) >= 17 && Math.abs(x) <= 21.5) canopyLow = Math.min(canopyLow, y)
  }
  for (let i = 0; i < ix.length; i += 3) {
    const a = 3 * ix[i],
      b = 3 * ix[i + 1],
      c = 3 * ix[i + 2],
      ax = p[b] - p[a],
      ay = p[b + 1] - p[a + 1],
      az = p[b + 2] - p[a + 2],
      bx = p[c] - p[a],
      by = p[c + 1] - p[a + 1],
      bz = p[c + 2] - p[a + 2]
    if (Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) < 1e-10) tiny++
  }
}
batch.finish()
land(new Mason(scene), finishes, registry)
const world = courtyardCollision(scene, null),
  eyeHeight = 1.64
function location(h, x, z, y = 3.14) {
  const c = Math.cos(h.angle),
    s = Math.sin(h.angle)
  return new Vector3(h.x + x * c + z * s, y, h.z - x * s + z * c)
}
function move(eye, target) {
  world.move(eye, target.x - eye.x, 0, target.z - eye.z, eyeHeight)
}
function distance(eye, target) {
  return Math.hypot(eye.x - target.x, eye.z - target.z)
}

test('painted lantern canopies clear a person and the market mesh stays within the rendering budget', () => {
  assert.ok(canopyLow - 1.35 >= 3.55, `quayside canopy headroom ${canopyLow - 1.35} m`)
  assert.equal(tiny, 0)
  assert.ok(faces <= 175000, `${faces} triangles`)
  assert.ok(registry.lights.length >= 70)
})

test('a walker can enter all 22 river-facing establishments through their real porch bays', () => {
  for (const h of wardAddresses.filter((h) => h.quay)) {
    const d = houseDimensions(h),
      bays = Math.max(2, Math.min(4, Math.round(d.w / 2.72)))
    const door = (Math.floor((bays - 1) / 2) + 0.5) / bays - 0.5,
      front = d.d / 2
    const eye = location(h, d.w * door, front + 1.44),
      target = location(h, d.w * door, front - d.frontDepth - 0.33)
    assert.ok(world.land(eye, eyeHeight), h.name)
    move(eye, target)
    assert.ok(distance(eye, target) < 0.11, `${h.name}, ${distance(eye, target).toFixed(2)} m short`)
  }
})

test('both quay walks and both inner streets stay open end-to-end in the northern and southern wards', () => {
  for (const side of [-1, 1])
    for (const x of [18.9, 20.67, 32.75, 45.95])
      for (const [from, to] of [
        [4, 78],
        [-60, -21],
      ]) {
        const eye = new Vector3(side * x, 3.14, from),
          target = new Vector3(side * x, 0, to)
        assert.ok(world.land(eye, eyeHeight))
        move(eye, target)
        assert.ok(distance(eye, target) < 0.11, `lane x=${side * x}, z=${from} to ${to}`)
      }
})

test('the lantern guild, opera house, apothecary and print shop stairs lead onto their upper floors', () => {
  for (const h of wardAddresses.filter((h) => [3, 13, 14, 15].includes(h.id))) {
    const d = houseDimensions(h),
      stage = h.form === 'stage',
      w = stage ? d.d : d.w,
      depth = stage ? d.w : d.d
    const z = -depth * (stage ? 0.405 : 0.27),
      place = (x, z, y) => (stage ? location(h, z, -x, y) : location(h, x, z, y))
    const eye = place(-w * 0.43 + 0.12, z, 3.6),
      top = place(w * 0.22 + 0.22, z)
    assert.ok(world.land(eye, eyeHeight), h.name)
    move(eye, top)
    assert.ok(distance(eye, top) < 0.12, h.name)
    assert.ok(Math.abs(eye.y - eyeHeight - (1.35 + 0.18 + d.gH)) < 0.025, h.name)
  }
})
