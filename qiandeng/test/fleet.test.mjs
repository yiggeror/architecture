import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { Mason } from '../src/mesh.js'
import { materials } from '../src/kit.js'
import { stoneBridge, Z_HALF } from '../src/gateStone.js'
import { launchQuays } from '../src/festivalSky.js'
import { harbor } from '../src/harbor.js'
import { locate, route, traffic } from '../src/fleetRoute.js'
import { procession } from '../src/procession.js'
import { stations, updateLens } from '../src/stations.js'

const scene = new T.Scene(),
  finishes = materials(),
  lights = []
const world = {
  movingLamp() {
    const light = { position: new T.Vector3(), strength: 1 }
    lights.push(light)
    return light
  },
}
const parade = procession(scene, finishes, world)
const ships = traffic.map((boat) => scene.getObjectByName(boat.name))

function strokeEnvelopes() {
  const swept = ships.map(() => new T.Box3()), box = new T.Box3(), local = new T.Matrix4()
  const camera = new T.PerspectiveCamera()
  camera.position.set(0, 60, 20)
  // The oar period is 2π / 1.73 seconds. Include a full stroke on each side.
  for (let t = 0; t < 4; t += 0.065) {
    parade.update(t, false, camera)
    for (const [i, ship] of ships.entries()) ship.traverse((mesh) => {
      if (!mesh.isMesh) return
      const g = mesh.geometry
      if (!g.boundingBox || g.attributes.position.usage === T.DynamicDrawUsage) g.computeBoundingBox()
      local.multiplyMatrices(world.rainShips[i].inverse, mesh.matrixWorld)
      swept[i].union(box.copy(g.boundingBox).applyMatrix4(local))
    })
  }
  return swept.map((b) => ({
    beam: 2 * Math.max(-b.min.x, b.max.x) + 0.15,
    length: 2 * Math.max(-b.min.z, b.max.z) + 0.15,
  }))
}
const sweeps = strokeEnvelopes()

test('the river arrival frames three open arches, the armillary and the fish in both orientations', () => {
  const station = stations[0],
    camera = new T.PerspectiveCamera(),
    v = new T.Vector3(),
    uv = new T.Vector2()
  const project = (point) => {
    point.project(camera)
    return uv.set((1 + point.x) / 2, (1 - point.y) / 2)
  }
  const inRange = (value, lo, hi) => assert.ok(value >= lo && value <= hi, `${value} outside [${lo}, ${hi}]`)
  camera.userData.portraitLens = station.portraitLens
  for (const [w, h] of [[575, 1076], [390, 844], [1280, 720]]) {
    const portrait = w < h
    updateLens(camera, w, h)
    camera.userData.viewportHeight = h
    camera.position.fromArray(portrait ? station.portraitEye : station.eye)
    camera.lookAt(...(portrait ? station.portraitTarget : station.target))
    camera.updateMatrixWorld()
    parade.update(0, false, camera)

    const crown = project(v.set(0, 9.08, -4.5))
    inRange(crown.x, 0.49, 0.53)
    inRange(crown.y, 0.515, 0.545)
    inRange(project(v.set(0, 11.34, -4.68)).y, 0.48, 0.51)
    for (const x of [-16.88, 16.88]) inRange(project(v.set(x, 1.82, -4.5)).x, 0.025, 0.99)
    const instrument = project(v.set(7.8, 77.1, -101.45))
    inRange(instrument.x, 0.50, 0.57)
    inRange(instrument.y, 0.19, 0.26)

    const fish = new T.Box2()
    ships[0].traverseVisible((mesh) => {
      if (!mesh.isMesh) return
      const vertices = mesh.geometry.attributes.position
      for (let i = 0; i < vertices.count; i++) {
        v.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld)
        if (v.y >= -0.02) fish.expandByPoint(project(v))
      }
    })
    inRange(fish.min.x, portrait ? 0.0 : 0.27, portrait ? 0.095 : 0.36)
    inRange(fish.max.x, portrait ? 0.37 : 0.42, 0.48)
    inRange(fish.min.y, 0.535, 0.60)
    inRange(fish.max.y, 0.635, 0.73)
    for (const [i, lo, hi] of [[1, 0.47, 0.54], [4, portrait ? 0.86 : 0.61, portrait ? 0.98 : 0.70]]) {
      const boat = project(v.set(0, 1.1, 0).applyMatrix4(ships[i].matrixWorld))
      inRange(boat.x, lo, hi)
      inRange(boat.y, 0.59, 0.68)
    }
    const hood = [], ray = new T.Raycaster()
    ships[6].traverseVisible((mesh) => { if (mesh.material === finishes.ink) hood.push(mesh) })
    const canopyAt = (x, y) => {
      ray.setFromCamera(uv.set(2 * x - 1, 1 - 2 * y), camera)
      return ray.intersectObjects(hood, false).length > 0
    }
    assert.equal(canopyAt(0.46, portrait ? 0.78 : 0.84), false)
    assert.equal(canopyAt(0.46, portrait ? 0.83 : 0.88), true)
    if (w === 575) {
      for (const x of [0.26, 0.66]) assert.ok(canopyAt(x, 0.99))
      for (const x of [0.19, 0.75]) assert.ok(!canopyAt(x, 0.99))
    }
    const forward = camera.getWorldDirection(v).multiplyScalar(2).add(camera.position)
    assert.equal(parade.block(camera.position, forward, 0.155), false)
  }
})

function hullSeparation(a, p, b, q) {
  let greatest = -Infinity
  for (const [x, z] of [
    [p.dx, p.dz],
    [p.dz, -p.dx],
    [q.dx, q.dz],
    [q.dz, -q.dx],
  ]) {
    const support = (boat, at) =>
      (Math.abs(x * at.dx + z * at.dz) * boat.length + Math.abs(x * at.dz - z * at.dx) * boat.beam) / 2
    const gap = Math.abs(x * (q.x - p.x) + z * (q.z - p.z)) - support(a, p) - support(b, q)
    greatest = Math.max(gap, greatest)
  }
  return greatest
}

test('full-size hulls meet, turn and clear both shores over one complete loop', () => {
  const previous = traffic.map((boat) => locate(boat, 0, {}))
  for (let t = 0; t <= route.duration; t += 0.22) {
    const poses = traffic.map((boat) => locate(boat, t, {}))
    for (let i = 0; i < traffic.length; i++) {
      const boat = traffic[i],
        p = poses[i]
      for (const side of [-boat.beam / 2, boat.beam / 2])
        for (const end of [-boat.length / 2, boat.length / 2]) {
          const x = p.x + p.dz * side + p.dx * end,
            z = p.z - p.dx * side + p.dz * end
          assert.ok(Math.abs(x) < 17 && z > -66 && z < 88, boat.name)
        }
      for (let j = 0; j < i; j++) {
        assert.ok(
          hullSeparation(boat, p, traffic[j], poses[j]) > 0.35,
          'hulls approach ' + boat.name + ' / ' + traffic[j].name
        )
        assert.ok(
          hullSeparation(sweeps[i], p, sweeps[j], poses[j]) > 0.65,
          'oars approach ' + boat.name + ' / ' + traffic[j].name
        )
      }
      assert.ok(Math.hypot(p.x - previous[i].x, p.z - previous[i].z) < 0.25)
      previous[i] = p
    }
  }
  for (const boat of traffic) {
    const a = locate(boat, 0, {}),
      b = locate(boat, route.duration, {})
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.00001)
  }
})

test('moving hulls, oars, cabins, pennants and carp fit the built masonry in both directions', () => {
  const stone = new T.Group(),
    mason = new Mason(stone)
  mason.at(0, 0, -9, 0, () => stoneBridge(mason, finishes))
  mason.finish()
  const trees = stone.children.map((mesh) => new MeshBVH(mesh.geometry, { indirect: true }))
  const ray = new T.Ray(new T.Vector3(), new T.Vector3(0, 1, 0))
  // Survey the actual vault stones, including the low front archivolts.
  const step = 0.1,
    low = new Map()
  function ceiling(x) {
    const k = Math.round(x / step)
    if (!low.has(k)) {
      let h = Infinity
      for (const z of [-9 - Z_HALF - 0.09, -9 - Z_HALF + 0.02, -9, -9 + Z_HALF - 0.02, -9 + Z_HALF + 0.09]) {
        ray.origin.set(k * step, 0.0, z)
        for (const tree of trees) {
          const hit = tree.raycastFirst(ray, T.DoubleSide, 0, 12)
          if (hit) h = Math.min(h, hit.distance)
        }
      }
      low.set(k, h)
    }
    return low.get(k)
  }
  const visits = ships.map(() => new Set()),
    box = new T.Box3()
  for (let t = 0; t < route.duration; t += 0.85) {
    if (!traffic.some((boat) => Math.abs(locate(boat, t, {}).z + 9) < 13)) continue
    parade.update(t, false)
    for (let i = 0; i < ships.length; i++) {
      const ship = ships[i]
      if (Math.abs(ship.position.z + 9) > 13) continue
      ship.updateMatrixWorld(true)
      ship.traverse((mesh) => {
        if (!mesh.isMesh) return
        mesh.geometry.computeBoundingBox()
        box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld)
        if (box.max.z < -9 - Z_HALF - 0.2 || box.min.z > -9 + Z_HALF + 0.2) return
        let closeToVault = false
        for (const x of [box.min.x, (box.min.x + box.max.x) / 2, box.max.x]) {
          const opening = Math.abs(x) < 7.5 ? 'central' : Math.abs(x - 13.12) < 3.76 ? 'east' : null
          assert.ok(opening, ship.name + ' touches a pier at ' + x)
          if (box.max.y + 0.13 >= ceiling(x)) closeToVault = true
          visits[i].add(opening)
        }
        if (closeToVault) {
          // At the exit the raised bow is in open water while the stern is
          // still inside the arch. Measure the actual bronze, timber and stone.
          const g = mesh.geometry
          if (!g.boundsTree) g.boundsTree = new MeshBVH(g, { indirect: true })
          else if (g.attributes.position.usage === T.DynamicDrawUsage) g.boundsTree.refit()
          for (const tree of trees) {
            const hit = tree.closestPointToGeometry(g, mesh.matrixWorld, {}, null, 0.13, 0.13)
            assert.ok(!hit || hit.distance >= 0.13, `${ship.name} at ${t.toFixed(2)}s touches vault stone`)
          }
        }
      })
    }
  }
  for (const crossed of visits) assert.deepEqual(crossed, new Set(['central', 'east']))
})

function fixedQuaySurvey(build, clearance) {
  const masonry = new Mason(new T.Scene()),
    cells = new Map(),
    p = new T.Vector3()
  build(masonry, finishes, { lamp() {} })
  const positions = [],
    indices = []
  for (const { p: vertices, ix } of masonry.groups.values()) {
    const base = positions.length / 3
    for (const value of vertices) positions.push(value)
    for (let n = 0; n < ix.length; n += 3) {
      p.fromArray(vertices, ix[n] * 3)
      const key = [p.x, p.y, p.z].map((v) => Math.floor(v / 6)).join(',')
      if (!cells.has(key)) cells.set(key, new T.Box3())
      const cell = cells.get(key)
      for (let j = n; j < n + 3; j++) {
        indices.push(base + ix[j])
        cell.expandByPoint(p.fromArray(vertices, ix[j] * 3))
      }
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  // These boxes cover the real triangles even when a rope or rail crosses a cell edge.
  const bounds = [...cells.values()].map((b) => b.expandByScalar(clearance))
  return { bounds, clearance, tree: new MeshBVH(geometry, { indirect: true }) }
}

test('the full oar stroke and hulls clear the four launch rafts, harbor stairs and beacon piles', () => {
  const works = [fixedQuaySurvey(launchQuays, 0.8), fixedQuaySurvey(harbor, 0.45)]
  const box = new T.Box3(),
    result = {},
    camera = new T.PerspectiveCamera()
  camera.position.set(0, 60, 20)
  const visited = new Set()
  for (let t = 0; t < route.duration; t += 0.2) {
    const nearby = traffic.map((boat, i) => {
      const p = locate(boat, t, {}),
        reach = Math.hypot(sweeps[i].length, sweeps[i].beam) * 0.5 + 0.1
      box.min.set(p.x - reach, -1, p.z - reach)
      box.max.set(p.x + reach, 5.4, p.z + reach)
      return works.filter((site) => site.bounds.some((b) => b.intersectsBox(box)))
    })
    if (!nearby.some((sites) => sites.length)) continue
    parade.update(t, false, camera)
    for (let i = 0; i < ships.length; i++) {
      if (!nearby[i].length) continue
      visited.add(ships[i].name)
      ships[i].traverse((mesh) => {
        if (!mesh.isMesh) return
        const g = mesh.geometry,
          moving = g.attributes.position.usage === T.DynamicDrawUsage
        if (!g.boundingBox || moving) g.computeBoundingBox()
        box.copy(g.boundingBox).applyMatrix4(mesh.matrixWorld)
        for (const site of nearby[i]) {
          if (!site.bounds.some((b) => b.intersectsBox(box))) continue
          if (!g.boundsTree) g.boundsTree = new MeshBVH(g, { indirect: true })
          else if (moving) g.boundsTree.refit()
          const distance = site.tree.closestPointToGeometry(
            g,
            mesh.matrixWorld,
            result,
            null,
            site.clearance,
            site.clearance
          )
          assert.ok(
            !distance || distance.distance >= site.clearance,
            `${ships[i].name} at ${t.toFixed(2)}s: ${distance?.distance.toFixed(3)} m to the quay works`
          )
        }
      })
    }
  }
  assert.equal(visited.size, traffic.length)
})

test('collision follows the real parade and leaves the passenger opening and upper air accessible', () => {
  parade.update(0, false)
  const hero = ships[0],
    cab = ships[4]
  const point = (ship, x, y, z) => new T.Vector3(x, y, z).applyMatrix4(ship.matrixWorld)
  assert.ok(parade.block(point(hero, -3, 0.28, 0), point(hero, 3, 0.28, 0), 0.15))
  assert.ok(parade.block(point(hero, -2.6, 2.8, 0.2), point(hero, 2.6, 2.8, 0.2), 0.15))
  assert.ok(!parade.block(point(hero, -3, 6.2, 0), point(hero, 3, 6.2, 0), 0.15))
  assert.ok(parade.block(point(cab, 0, 5, 0.32), point(cab, 0, 2.1, 0.32), 0.15))
  assert.ok(!parade.block(point(cab, 0, 1.53, -1), point(cab, 0, 1.53, 1), 0.15))
  const a = point(hero, -2.5, 0.32, 0),
    b = point(hero, 2.5, 0.32, 0),
    light = lights[0].position.clone()
  parade.update(12, false)
  assert.ok(!parade.block(a, b, 0.15))
  assert.ok(lights[0].position.distanceTo(light) > 10)
  const pose = hero.matrixWorld.clone()
  parade.update(12, true)
  assert.ok(hero.matrixWorld.equals(pose))
  assert.ok(lights.every((lamp) => lamp.strength < 0.1))
})

test('a moving bow displaces a hovering viewer and a passenger rides the cabin without input', () => {
  parade.update(0, false)
  const hull = ships[0],
    cab = ships[4]
  const hover = new T.Vector3(0.0, 0.44, traffic[0].length / 2 + 1.1).applyMatrix4(hull.matrixWorld)
  const initial = hover.clone()
  const passengerLocal = new T.Vector3(0, traffic[4].deck + 1.02, 0.48)
  const passenger = passengerLocal.clone().applyMatrix4(cab.matrixWorld)
  const sky = initial.clone()
  sky.y = 12
  const skyAt = sky.clone()
  let touched = false
  for (let i = 1; i <= 65; i++) {
    parade.update(i * 0.075, false)
    touched = parade.protect(hover, () => 0) || touched
    parade.protect(passenger, () => 0)
    assert.equal(
      parade.protect(sky, () => 0),
      false
    )
    const ship = world.rainShips[0],
      q = hover.clone().applyMatrix4(ship.inverse)
    for (const [x, y, z, X, Y, Z] of ship.boxes)
      assert.ok(
        !(
          q.x > x - 0.154 &&
          q.x < X + 0.154 &&
          q.y > y - 0.154 &&
          q.y < Y + 0.154 &&
          q.z > z - 0.154 &&
          q.z < Z + 0.154
        )
      )
  }
  assert.ok(touched && hover.distanceTo(initial) > 0.28)
  assert.ok(passenger.distanceTo(passengerLocal.clone().applyMatrix4(cab.matrixWorld)) < 0.001)
  assert.ok(sky.equals(skyAt))
})
