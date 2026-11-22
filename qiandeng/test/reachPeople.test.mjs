import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from 'three'
import { locate, traffic } from '../src/fleetRoute.js'
import { Mason } from '../src/mesh.js'
import { materials } from '../src/kit.js'
import { reachLand } from '../src/reachLand.js'
import { reachTerraces } from '../src/reachMap.js'
import { courtyardCollision } from '../src/collision.js'
import { reachStreetPlan } from '../src/reachWardPlan.js'
import { reachResidents, residentPose, nearbyResidents, residentLimit } from '../src/reachPeople.js'
import { riverPeople } from '../src/peopleRiver.js'
import { stations, updateLens } from '../src/stations.js'

test('the night watch and the festival trades walk on the paved strips outside real shopfronts', () => {
  const residents = reachResidents()
  assert.ok(residents.length >= 24 && residents.length <= 50)
  assert.ok(residents.some((p) => p.y > 175))
  assert.deepEqual(new Set(residents.map((p) => p.row.group)), new Set(reachTerraces.map((r) => r.group)))
  assert.ok(
    ['umbrella', 'lantern', 'watch', 'carrier', 'porter', 'basket'].every((job) =>
      residents.some((p) => p.job === job)
    )
  )
  assert.ok(residents.filter((p) => p.job === 'watch').every((p) => p.dayJob === 'walk'))
  for (const p of residents) {
    const street = reachStreetPlan(p.row)
    assert.ok(street.address.some((h) => h.id === p.shopId))
    const clearance = p.job === 'umbrella' ? 0.94 : 0.65
    for (let t = 0; t <= 180; t += 0.67) {
      const at = residentPose(p, t, {}),
        dx = at.x - p.row.x,
        dz = at.z - p.row.z
      const u = dx * p.cos - dz * p.sin,
        v = dx * p.sin + dz * p.cos
      assert.ok(Math.abs(at.y - p.row.y - 0.004) < 1e-8, p.streetId)
      assert.ok(v + clearance < p.row.depth / 2, p.streetId + ' quay edge')
      assert.ok(Math.abs(u) < p.row.width / 2 - 4.8, p.streetId + ' stair landing')
      for (const h of street.address)
        if (Math.abs(u - h.x) < h.width / 2 + clearance) {
          assert.ok(v - clearance > h.front, p.streetId + ' shopfront')
        }
      if (p.streetId === '锦浦-0')
        assert.ok(Math.abs(u - 2.7) > 3 + clearance, p.streetId + ' bridge landing')
      assert.ok(Number.isFinite(at.yaw) && Math.abs(at.stride) <= 1.001)
    }
  }
})

test('outlying residents reuse the river instance batches and leave them at distance', () => {
  const residents = reachResidents(),
    nearby = [],
    t = 1.93
  const visitors = nearbyResidents(residents, t, new T.Vector3(6.25, 4.95, 47), nearby)
  assert.equal(visitors.length, 0)
  for (const p of residents) {
    const eye = residentPose(p, t, {})
    const local = nearbyResidents(residents, t, eye, nearby)
    assert.ok(local.includes(p) && local.length <= residentLimit)
    assert.ok(local.every((q) => q.distance2 <= 66 ** 2))
  }
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera()
  const ships = traffic.map((spec) => ({ spec, group: new T.Group() }))
  const people = riverPeople(scene, {}, ships),
    count = scene.children.length
  camera.position.set(1200, 180, 1000)
  people(t, false, camera)
  const distant = scene.children.map((m) => m.count)
  assert.ok(distant.every((count) => count === 0))
  const at = residentPose(residents.at(-1), t, {})
  camera.position.set(at.x + 3, at.y + 1.66, at.z + 2)
  camera.lookAt(at.x, at.y + 1, at.z)
  people(t, false, camera)
  assert.ok(scene.getObjectByName('人群·face').count > 0)
  assert.equal(scene.children.length, count)
  assert.ok(scene.children.every((m) => m.count <= m.instanceMatrix.count))
  camera.position.set(1200, 180, 1000)
  people(t, false, camera)
  assert.deepEqual(
    scene.children.map((m) => m.count),
    distant
  )
})

test('a stationary turn refreshes the crowd, while an overhead look retains the pavement below it', () => {
  const resident = reachResidents().at(-1),
    t = 6.25,
    where = residentPose(resident, t, {})
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(54, 1.55, 0.075, 1000)
  const people = riverPeople(
    scene,
    {},
    traffic.map((spec) => ({ spec, group: new T.Group() }))
  )
  const matrix = new T.Matrix4()
  function visible() {
    const heads = scene.getObjectByName('人群·faceFar')
    for (let i = 0; i < heads.count; i++) {
      heads.getMatrixAt(i, matrix)
      const e = matrix.elements
      if (Math.hypot(e[12] - where.x, e[14] - where.z) < 0.3 && Math.abs(e[13] - where.y) < 2) return true
    }
    return false
  }
  camera.position.set(where.x, where.y + 2.2, where.z + 27)
  camera.lookAt(where.x, where.y + 1, where.z)
  people(t, false, camera)
  assert.equal(visible(), true)
  camera.lookAt(where.x, where.y + 2.2, where.z + 80)
  people(t, false, camera)
  assert.equal(visible(), false)
  camera.position.set(where.x, where.y + 43, where.z + 0.002)
  camera.lookAt(where.x, where.y, where.z)
  people(t, false, camera)
  assert.equal(visible(), true)
  // An elevated walker can be outside the direct frame while reflected in
  // either the main river (0 m) or the outer channel (-16 m).
  camera.position.set(where.x, where.y + 2.2, where.z + 27)
  camera.fov = 24
  camera.updateProjectionMatrix()
  for (const level of [0, -16]) {
    camera.lookAt(where.x, 2 * level - where.y - 1.2, where.z)
    camera.updateMatrixWorld()
    const head = new T.Vector3(where.x, where.y + 1.2, where.z).project(camera)
    assert.ok(Math.abs(head.y) > 1)
    people(t, false, camera)
    assert.equal(visible(), true)
  }
})

test('the opening fits the passenger budget and the smallest lamps still walk along the quay', () => {
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(),
    station = stations[0]
  const ships = traffic.map((spec, i) => {
    const group = new T.Group(),
      route = locate(spec, 0, {}),
      rock = 0.65 + spec.beam * 0.14
    group.position.set(route.x, 0.025 * Math.sin(i) + 0.012 * Math.sin(0.35 * i), route.z)
    group.rotation.set(
      (0.0075 * Math.sin(i * 0.8)) / rock,
      Math.atan2(route.dx, route.dz),
      (0.012 * Math.sin(i * 0.95)) / rock,
      'YXZ'
    )
    group.updateMatrixWorld()
    return { spec, group }
  })
  const people = riverPeople(scene, {}, ships)
  const triangles = () =>
    scene.children.reduce((sum, m) => {
      const vertices = m.geometry.index?.count ?? m.geometry.attributes.position.count
      return sum + (m.count * vertices) / 3
    }, 0)
  const batch = (id) => scene.getObjectByName('人群·' + id)

  for (const [width, height] of [[864, 520], [1280, 800], [390, 700]]) {
    const portrait = width < height
    camera.position.fromArray(portrait ? station.portraitEye : station.eye)
    camera.lookAt(...(portrait ? station.portraitTarget : station.target))
    updateLens(camera, width, height)
    camera.userData.viewportHeight = height
    people(0, false, camera)
    assert.ok(triangles() <= 17000, width + ' × ' + height + ' opening')
    assert.ok(batch('headLow').count > 0 && batch('lightFar').count > 0)
  }

  const original = triangles()
  camera.userData.viewportHeight = 200
  people(0, false, camera)
  assert.ok(triangles() < original)

  camera.position.set(0, 148, 43)
  camera.lookAt(0, 1.4, 5)
  people(0, false, camera)
  assert.ok(batch('headLow').count >= 22)
  for (const id of ['face', 'faceFar', 'spokes', 'sleeve', 'sleeveFar', 'rod', 'rodFar'])
    assert.equal(batch(id).count, 0, id)
  const lamp = batch('lightFar'),
    lights = new T.Matrix4()
  function lanterns() {
    return Array.from({ length: lamp.count }, (_, i) => {
      lamp.getMatrixAt(i, lights)
      return new T.Vector3().setFromMatrixPosition(lights)
    })
  }
  const before = lanterns()
  people(2, false, camera)
  assert.ok(before.length > 0 && lanterns().some((p, i) => p.distanceTo(before[i]) > 0.13))
  camera.lookAt(0, 260, 44)
  people(2, false, camera)
  assert.equal(triangles(), 0)
})

test('the public paving and embankment walls clear the people and parasols at every street level', () => {
  const scene = new T.Scene(),
    builder = new Mason(scene)
  reachLand(builder, materials())
  builder.finish()
  const geometry = courtyardCollision(scene, null),
    point = new T.Vector3()
  for (const p of reachResidents()) {
    for (let t = 0; t < 130; t += 2.37) {
      const pose = residentPose(p, t, {}),
        ground = geometry.floor(pose.x, pose.z, pose.y + 2.38, 2.52)
      assert.ok(ground !== null && Math.abs(ground - p.row.y) < 0.008, p.streetId + ' paving')
      const c = Math.cos(pose.yaw),
        s = Math.sin(pose.yaw)
      const checks = [
        [0, 0.57, 0, 0.018],
        [0, 1.39, 0, 0.04],
        [-0.13, 1.12, 0, 0.1],
        [0.13, 1.12, 0, 0.1],
      ]
      if (p.job === 'umbrella')
        for (let j = 0; j < 8; j++) {
          const angle = (j * Math.PI) / 4
          checks.push([0.26 + 0.6 * Math.cos(angle), 1.92, 0.14 + 0.6 * Math.sin(angle), 0.115])
        }
      if (p.job === 'carrier') for (const z of [-0.55, 0.55]) checks.push([-0.16, 0.62, z, 0.02])
      if (p.job === 'lantern' || p.job === 'watch') checks.push([-0.29, 0.9, 0.16, 0.02])
      for (const [x, y, z, limit] of checks) {
        point.set(pose.x + p.size * (c * x + s * z), pose.y + p.size * y, pose.z + p.size * (-s * x + c * z))
        assert.ok(
          geometry.clearance(point) <= limit,
          p.streetId + ' ' + p.job + ' at ' + point.toArray().join(',')
        )
      }
    }
  }
})
