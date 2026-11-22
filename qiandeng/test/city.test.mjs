import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { Mason } from '../src/mesh.js'
import { materials } from '../src/kit.js'
import { wards } from '../src/wards.js'
import { watergate } from '../src/watergate.js'
import { garden } from '../src/garden.js'
import { harbor } from '../src/harbor.js'
import { launchQuays } from '../src/festivalSky.js'
import { courtyardCollision } from '../src/collision.js'
import { lightRegistry } from '../src/lighting.js'

const m = materials(),
  world = lightRegistry()
function region(build) {
  const b = new Mason(new T.Scene())
  build(b, m, world)
  return b
}
const quay = region(harbor),
  market = region(wards),
  gate = region(watergate),
  yard = region(garden),
  floats = region(launchQuays)
function shape(b, keep = () => true) {
  const xyz = [],
    index = []
  for (const [mat, part] of b.groups) {
    if (!keep(mat)) continue
    const base = xyz.length / 3
    for (const v of part.p) xyz.push(v)
    for (const i of part.ix) index.push(base + i)
  }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(xyz, 3))
  g.setIndex(index)
  g.computeBoundingBox()
  return g
}
test('independent roofs clear neighbouring shops, the festival rigging and the garden walls', () => {
  const identity = new T.Matrix4(),
    top = (mat) => mat === m.roof || mat === m.roofEdge
  for (const [a, b, name] of [
    [market, quay, 'shop eaves / river canopy'],
    [gate, market, 'gate eaves / houses'],
    [market, yard, 'shop eaves / garden'],
    [yard, market, 'garden eaves / shops'],
    [gate, quay, 'gate eaves / harbor lighting'],
  ]) {
    const roof = shape(a, top),
      other = shape(b)
    assert.ok(roof.index.count > 100)
    if (!roof.boundingBox.intersectsBox(other.boundingBox)) continue
    const tree = new MeshBVH(roof),
      bTree = new MeshBVH(other)
    assert.equal(
      tree.bvhcast(bTree, identity, { intersectsTriangles: (a, b) => a.intersectsTriangle(b) }),
      false,
      name
    )
  }
})
test('launch rafts clear the quayside water stairs and overhead festival ropes', () => {
  const a = new MeshBVH(shape(quay)),
    b = new MeshBVH(shape(floats))
  assert.equal(
    a.bvhcast(b, new T.Matrix4(), { intersectsTriangles: (a, b) => a.intersectsTriangle(b) }),
    false
  )
})
test('the garden moon door opens through both plaster faces and the pond blocks downward flight', () => {
  const city = new T.Scene()
  const b = new Mason(city)
  garden(b, m, world)
  b.finish()
  const collision = courtyardCollision(city),
    v = new T.Vector3(-46.7, 3.24, 78.73)
  collision.move(v, 0, 0, 2.23, 0)
  assert.ok(v.z > 80.9)
  const post = new T.Vector3(-48.23, 3.28, 78.84)
  collision.move(post, 0, 0, 1.9, 0)
  assert.ok(post.z < 79.4)
  const above = new T.Vector3(-44.52, 2.53, 82.99)
  collision.move(above, 0, -1.7, 0, 0)
  assert.ok(above.y > 1.75 && above.y < 1.8, above.y)
})

test('a flying camera meets the moving astronomical instrument at its rendered altitude', async () => {
  const { clockworkContact } = await import('../src/clockwork.js')
  const { summit, summitMotion } = await import('../src/summit.js')
  const sky = new T.Group()
  sky.position.set(3.8, 25.2, 0)
  const localPalette = materials()
  summit(new Mason(new T.Scene()), localPalette, world)
  const motion = summitMotion(sky, localPalette, world),
    contact = clockworkContact(sky)
  for (const t of [0, 7, 21]) {
    motion.update(t, false)
    contact.update()
    let hit = false
    for (let z = -98; z > -101.5; z -= 0.07) {
      if (contact.block(new T.Vector3(7.8, 77.1, z), new T.Vector3(7.8, 77.1, z - 0.07), 0.155)) {
        hit = true
        break
      }
    }
    assert.ok(hit)
  }
})
