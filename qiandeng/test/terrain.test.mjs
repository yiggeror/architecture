import assert from 'node:assert/strict'
import test from 'node:test'
import * as T from 'three'
import { courtyardCollision } from '../src/collision.js'
import { materials } from '../src/kit.js'
import { land, landBounds, landMotion, terraceHeight } from '../src/land.js'
import { Mason } from '../src/mesh.js'

const scene = new T.Scene()
const m = materials(),
  builder = new Mason(scene)
land(builder, m, { lamp() {} })
builder.finish()
const falls = landMotion(scene, m, {})
const river = landBounds.river
const surface = new T.Mesh(
  new T.PlaneGeometry(river.east - river.west, river.south - river.north),
  new T.MeshBasicMaterial({ side: T.DoubleSide })
)
surface.rotation.x = -Math.PI / 2
surface.position.set((river.west + river.east) / 2, river.level, (river.north + river.south) / 2)
scene.add(surface)

test('the city plateau, riverbed, end walls and folded underside form one oriented closed hull', () => {
  const hulls = scene.children.filter((object) => object.userData.terrainHull)
  const edges = new Map()
  let triangles = 0,
    lowest = Infinity
  for (const mesh of hulls) {
    const { position, normal } = mesh.geometry.attributes,
      ix = mesh.geometry.index
    const key = (i) =>
      [position.getX(i), position.getY(i), position.getZ(i)].map((n) => Math.round(n * 1e5)).join(',')
    for (let i = 0; i < position.count; i++) {
      lowest = Math.min(lowest, position.getY(i))
      assert(Number.isFinite(normal.getX(i) + normal.getY(i) + normal.getZ(i)))
    }
    for (let j = 0; j < ix.count; j += 3) {
      const face = [0, 1, 2].map((i) => key(ix.getX(j + i)))
      assert.equal(new Set(face).size, 3)
      triangles++
      for (let i = 0; i < 3; i++) {
        const a = face[i],
          c = face[(i + 1) % 3],
          label = a < c ? a + '|' + c : c + '|' + a
        const old = edges.get(label) || [0, 0]
        old[0]++
        old[1] += a < c ? 1 : -1
        edges.set(label, old)
      }
    }
  }
  assert(triangles > 1000)
  assert(lowest < -35)
  for (const [key, [uses, winding]] of edges) {
    assert.equal(uses, 2, 'open or multiply used edge ' + key)
    assert.equal(winding, 0, 'inconsistent winding at ' + key)
  }
})

test('both quays and the palace apron support a walker while the navigable river remains open', () => {
  const collision = courtyardCollision(scene, surface)
  for (const sign of [-1, 1]) {
    for (let z = -63.5; z <= 85; z += 2.5)
      for (const x of [18.25, 20.45, 32.8, 46]) {
        const level = collision.floor(sign * x, z, 2.5, 4)
        assert(level !== null && level >= 1.345 && level <= 1.43, 'dry quay at ' + [sign * x, z])
      }
    const eye = new T.Vector3(sign * 19.24, 3.72, 82)
    assert(collision.land(eye, 1.66))
    for (let z = 81.55; z > -61; z -= 0.45) {
      collision.move(eye, 0, 0, z - eye.z, 1.66)
      assert(Math.abs(eye.z - z) < 0.025, 'continuous walk at ' + [sign, z])
    }
  }
  for (const z of [-121.5, -90, -68.2, -66.25])
    for (const x of [-58, -16, 0, 16, 58]) {
      const level = collision.floor(x, z, 2.1, 3)
      assert(level !== null && level >= 1.345 && level <= 1.43)
      assert.equal(terraceHeight(x, z), 1.35)
    }
  for (const z of [-65.6, -35, 0, 42, 87.7])
    for (const x of [-16.6, -8, 0, 8, 16.6]) {
      assert.equal(terraceHeight(x, z), null)
      assert.equal(collision.floor(x, z, 1.8, 5), null)
    }
  assert.equal(terraceHeight(110, 7), null)
})

test('the three main waterfall lips overlap across the river mouth and descend past the escarpment', () => {
  const sheets = scene.children.filter((o) => o.name === '南峡三叠瀑')
  assert.equal(sheets.length, 3)
  const spans = sheets
    .map((sheet) => {
      assert(sheet.userData.noCollision)
      const { position, uv } = sheet.geometry.attributes
      let min = Infinity,
        max = -Infinity,
        foot = Infinity,
        endZ = -Infinity
      for (let i = 0; i < uv.count; i++) {
        if (uv.getY(i) === 0) {
          min = Math.min(min, position.getX(i))
          max = Math.max(max, position.getX(i))
          assert(Math.abs(position.getY(i) - river.level) < 0.03)
          assert(Math.abs(position.getZ(i) - river.south) < 0.11)
        }
        if (uv.getY(i) === 1) {
          foot = Math.min(foot, position.getY(i))
          endZ = Math.max(endZ, position.getZ(i))
        }
      }
      assert(foot < -40 && endZ > river.south + 3.0)
      return [min, max]
    })
    .sort((a, b) => a[0] - b[0])
  assert(spans[0][0] <= river.west + 0.01)
  assert(spans.at(-1)[1] >= river.east - 0.01)
  for (let i = 1; i < spans.length; i++) assert(spans[i][0] <= spans[i - 1][1])
  falls.update(24.5, true)
  assert.equal(sheets[0].material.uniforms.time.value, 24.5)
  assert.equal(sheets[0].material.uniforms.day.value, 1)
})
