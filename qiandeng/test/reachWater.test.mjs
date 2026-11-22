import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from 'three'
import { Mason } from '../src/mesh.js'
import { materials } from '../src/kit.js'
import { land } from '../src/land.js'
import { reachLand } from '../src/reachLand.js'
import { reachBridges } from '../src/reachBridges.js'
import { reachTerraces, palaceSites } from '../src/reachMap.js'
import { lowerRiver } from '../src/reachWater.js'
import { reachBoats, reachBoatPose } from '../src/reachFerries.js'
import { lightRegistry } from '../src/lighting.js'
import { courtyardCollision } from '../src/collision.js'

function rectangleGap(a, b) {
  const axes = (r) => [
    [Math.cos(r.yaw), -Math.sin(r.yaw)],
    [Math.sin(r.yaw), Math.cos(r.yaw)],
  ]
  const span = (r, directions, x, z) =>
    (Math.abs(directions[0][0] * x + directions[0][1] * z) * r.width) / 2 +
    (Math.abs(directions[1][0] * x + directions[1][1] * z) * r.depth) / 2
  const va = axes(a),
    vb = axes(b)
  return Math.max(
    ...[...va, ...vb].map(
      ([x, z]) => Math.abs((b.x - a.x) * x + (b.z - a.z) * z) - span(a, va, x, z) - span(b, vb, x, z)
    )
  )
}

test('the inhabited terraces and palace platforms have distinct, surveyed footprints', () => {
  const sites = [
    ...reachTerraces,
    ...palaceSites.map((s, i) => ({ ...s, id: 'palace' + i, group: 'palace' + i, yaw: 0 })),
  ]
  for (const [i, a] of sites.entries())
    for (const b of sites.slice(i + 1)) {
      if (a.group === b.group) continue
      assert.ok(rectangleGap(a, b) > 0.15, a.id + ' / ' + b.id)
    }
})

test('the merchant boats stay over the reflecting river, clear of the escarpments and the other hulls', () => {
  const staticScene = new T.Scene(),
    m = materials(),
    world = lightRegistry()
  for (const make of [land, reachLand, reachBridges]) {
    const mason = new Mason(staticScene)
    make(mason, m, world)
    mason.finish()
  }
  const solid = courtyardCollision(staticScene),
    config = lowerRiver()
  const mesh = new T.Mesh(config.geometry, new T.MeshBasicMaterial({ side: T.DoubleSide }))
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(...config.point)
  mesh.updateMatrixWorld()
  const ray = new T.Raycaster(undefined, new T.Vector3(0, -1, 0)),
    q = new T.Vector3()
  const p = reachBoats.map(() => new T.Vector3()),
    facing = p.map(() => new T.Vector3())
  // Long enough to make more than two complete circuits of each route.
  for (let frame = 0; frame < 243; frame++) {
    const time = frame * 1.65
    for (const [i, spec] of reachBoats.entries()) {
      reachBoatPose(spec, time, p[i], facing[i])
      if (frame % 4 === 0) {
        ray.ray.origin.copy(p[i])
        ray.ray.origin.y = -13
        assert.ok(ray.intersectObject(mesh, false).length, spec.name + ' left the water')
      }
      for (const end of [-spec.length * 0.53, 0, spec.length * 0.53])
        for (const side of [-spec.beam * 0.65, spec.beam * 0.65]) {
          q.copy(p[i]).addScaledVector(facing[i], end)
          q.x += facing[i].z * side
          q.z -= facing[i].x * side
          q.y += 8.5
          const h = solid.floor(q.x, q.z, q.y, 10.4)
          assert.equal(h, null, spec.name + ' hit a shore at ' + q.toArray().map(Math.round))
        }
    }
    for (let i = 0; i < p.length; i++)
      for (let j = i + 1; j < p.length; j++)
        assert.ok(p[i].distanceTo(p[j]) > (reachBoats[i].length + reachBoats[j].length) * 0.55)
  }
})
