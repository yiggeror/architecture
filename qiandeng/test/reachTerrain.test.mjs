import assert from 'node:assert/strict'
import test from 'node:test'
import * as T from 'three'
import { courtyardCollision } from '../src/collision.js'
import { materials } from '../src/kit.js'
import { distantRanges } from '../src/land-garden.js'
import { Mason } from '../src/mesh.js'
import { reachLand, reachWalks } from '../src/reachLand.js'
import { palaceSites, reachPoint, reachTerraces } from '../src/reachMap.js'
import { rooflineSites } from '../src/reachRooflineSites.js'

const scene = new T.Scene(),
  b = new Mason(scene)
reachLand(b, materials(), {})
b.finish()
const collision = courtyardCollision(scene)

function walk(points, label) {
  const p = points[0],
    eye = new T.Vector3(p[0], p[1] + 1.66, p[2])
  assert(collision.land(eye, 1.66), label)
  for (let j = 1; j < points.length; j++) {
    const a = points[j - 1],
      q = points[j],
      count = Math.ceil(Math.hypot(q[0] - a[0], q[2] - a[2]) / 0.23)
    for (let k = 1; k <= count; k++) {
      const f = k / count,
        x = a[0] + f * (q[0] - a[0]),
        z = a[2] + f * (q[2] - a[2])
      collision.move(eye, x - eye.x, 0, z - eye.z, 1.66)
      assert(Math.hypot(eye.x - x, eye.z - z) < 0.11, `${label} at (${x.toFixed(2)}, ${z.toFixed(2)})`)
    }
  }
  assert(Math.abs(eye.y - points.at(-1)[1] - 1.66) < 0.13, label + ' terminal grade')
}

test('every outer front street is supported across its width and walkable for its full length', () => {
  for (const r of reachTerraces) {
    for (const u of [-r.width / 2 + 0.7, -r.width * 0.27, 0, r.width * 0.27, r.width / 2 - 0.7])
      for (const v of [-r.depth / 2 + 0.6, 0, r.depth / 2 - 1.45]) {
        const [x, z] = reachPoint(r, u, v),
          y = collision.floor(x, z, r.y + 0.3, 0.67)
        assert(y !== null && Math.abs(y - r.y) < 0.1, r.id + ' at ' + [u, v])
      }
    walk(
      [-1, 1].map((side) => {
        const [x, z] = reachPoint(r, side * (r.width / 2 - 1.2), r.depth / 2 - 1.55)
        return [x, r.y, z]
      }),
      r.id
    )
  }
})

test('flights connect neighbouring elevations and both bridgeheads through the actual collider', () => {
  assert.equal(
    reachWalks.filter((p) => p.group).length,
    reachTerraces.length - new Set(reachTerraces.map((t) => t.group)).size
  )
  for (const r of reachWalks) walk(r.points, r.id)
  for (const [x, y, z] of [
    [111, 9, 28],
    [-35, 38, -181],
    [60, 42, -186],
  ])
    assert(Math.abs(collision.floor(x, z, y + 0.22, 1) - y) < 0.06)
})

test('three imperial plateaux and all upper-storey landmarks meet their architecture at the mapped grade', () => {
  for (const r of palaceSites)
    for (const u of [-0.49, 0, 0.49])
      for (const v of [-0.49, 0, 0.49]) {
        const y = collision.floor(r.x + u * r.width, r.z + v * r.depth, r.y + 0.31, 0.65)
        assert(y !== null && Math.abs(y - r.y) < 0.08, JSON.stringify(r))
      }
  for (const r of rooflineSites)
    for (let j = 0; j < 13; j++) {
      const angle = (j * Math.PI) / 6,
        distance = j === 12 ? 0 : r.radius
      const x = r.x + distance * Math.cos(angle),
        z = r.z + distance * Math.sin(angle),
        y = collision.floor(x, z, r.y + 0.24, 0.64)
      assert(
        y !== null && Math.abs(y - r.y) < 0.13,
        `${r.row.id} support at (${x.toFixed(1)}, ${z.toFixed(1)})`
      )
    }
})

test('the water hides the tapered skirts and all palace stone normals are usable in the night shader', () => {
  let count = 0,
    lowest = Infinity
  for (const mesh of scene.children) {
    count += mesh.geometry.index.count / 3
    const n = mesh.geometry.attributes.normal,
      p = mesh.geometry.attributes.position
    for (let i = 0; i < p.count; i++) {
      lowest = Math.min(lowest, p.getY(i))
      if (mesh.userData.reach?.startsWith('山台') || mesh.material.name === 'upperGardens')
        assert(
          Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) > 0.96,
          'invalid normal on ' + mesh.material.name
        )
    }
  }
  const upland = scene.children.find((mesh) => mesh.material.name === 'upperGardens').material.map.image
    .data
  for (let i = 0; i < upland.length; i += 4)
    assert(Math.min(upland[i], upland[i + 1], upland[i + 2]) >= 128, 'wrapped hillside pigment')
  const horizon = new T.Scene()
  distantRanges(horizon, {
    mountainGranite: scene.children.find((mesh) => mesh.material.name === 'upperGardens').material,
  })
  assert.equal(horizon.children.length, 5)
  let ridgeFaces = 0
  for (const ridge of horizon.children) {
    ridge.geometry.computeBoundingBox()
    const ext = ridge.geometry.boundingBox
    assert(ext.max.y < 22 && ext.max.z < -35, 'the southwestern view and palace skyline stay open')
    ridgeFaces += ridge.geometry.index.count / 3
  }
  assert(ridgeFaces < 3600, 'distant horizon budget')
  assert(lowest < -30)
  assert(count < 165000, `${count} triangles`)
  const ws = [
    [-70.59, 48.6, -344.57],
    [-69.79, 50.02, -344.36],
    [-0.22, 62.34, -449.46],
  ]
  for (const p of ws) assert.equal(collision.clearance(new T.Vector3(...p)), 0, 'pedestrian space at ' + p)
})

test('the secondary bridge arch and the Hehuan tidal gate keep an unobstructed lower water channel', () => {
  for (const [cx, cz, w, d] of [
    [104.76, 29.36, 4.5, 4.9],
    [112, 94.2, 9.3, 6.0],
  ])
    for (let i = -1; i <= 1; i += 0.25)
      for (let j = -1; j <= 1; j += 0.25) {
        const x = cx + i * w,
          z = cz + j * d
        for (const h of [-15.7, -11.0, -6.0])
          assert.equal(collision.clearance(new T.Vector3(x, h, z)), 0, `${x},${h},${z}`)
        const y = collision.floor(x, z, -4.3, 23)
        assert(y === null || y <= -18.19, `channel bottom at ${x},${z}: ${y}`)
      }
})
