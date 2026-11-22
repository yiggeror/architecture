import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import * as T from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { courtyardCollision } from '../src/collision.js'
import { Mason } from '../src/mesh.js'
import { materials } from '../src/kit.js'
import { land } from '../src/land.js'
import { lightRegistry } from '../src/lighting.js'
import { reachBridges, reachBridgeRoutes as routes, reachWharfOffset } from '../src/reachBridges.js'
import { reachLand, reachWalks } from '../src/reachLand.js'
import { reachPoint, reachTerraces } from '../src/reachMap.js'
import { frameHouse } from '../src/reachWardFrame.js'
import { reachMaterials } from '../src/reachWardArt.js'
import { reachStreetPlan } from '../src/reachWardPlan.js'
import { wardAddresses, buildAddress } from '../src/wards.js'
import { wardPaint } from '../src/wardsPaint.js'

let collision, bridge, terrain, bridgeMeshes, originalQuay, neighbouringShops
const eyeHeight = 1.62
before(() => {
  const scene = new T.Scene(),
    b = new Mason(scene),
    m = materials(),
    world = lightRegistry()
  reachBridges(b, m, world)
  b.finish()
  bridgeMeshes = scene.children.slice()
  bridge = courtyardCollision(scene, null)
  const start = scene.children.length
  land(b, m, world)
  b.finish()
  originalQuay = scene.children.slice(start).filter((mesh) => mesh.material === m.quayCoping)
  reachLand(b, m)
  b.finish()
  terrain = scene.children.slice(start)
  const firstShop = scene.children.length
  wardPaint(m)
  for (const h of wardAddresses.filter((h) => h.x > 48 && h.z > 18 && h.z < 66))
    buildAddress(b, m, world, h)
  reachMaterials(m)
  for (const row of reachTerraces.filter((t) => t.id === '锦浦-0' || t.id === '南栈-0')) {
    b.at(row.x, row.y, row.z, row.yaw, () => {
      for (const h of reachStreetPlan(row).address) b.at(h.x, 0, h.z, 0, () => frameHouse(b, m, h))
    })
  }
  b.finish()
  neighbouringShops = scene.children.slice(firstShop)
  collision = courtyardCollision(scene, null)
})
function close(n, expected, allow = 0.044) {
  assert.ok(Math.abs(n - expected) < allow, 'Expected ' + expected.toFixed(3) + ', got ' + String(n))
}
function to(eye, point, wlk = true, model = collision) {
  const [x, z] = point
  model.move(eye, x - eye.x, 0, z - eye.z, wlk ? eyeHeight : 0)
  close(eye.x, x)
  close(eye.z, z)
}
function start(p, y) {
  const eye = new T.Vector3(p[0], y + eyeHeight + 0.09, p[1])
  assert.equal(collision.land(eye, eyeHeight), true, 'No footing at ' + p)
  close(eye.y, y + eyeHeight, 0.085)
  return eye
}
test('the old engravers’ alley crosses the hillside path and both bridge houses to the Silk Quay', () => {
  const { east } = routes,
    eye = start([59.13, 53.4], 1.35)
  const quay = reachWalks.find((s) => s.id === '锦浦桥口').points.at(-1)
  const way = [
    [59.13, 48.72],
    [59.13, 39.05],
    east.a,
    ...[8, 13.3, 20, 30.5, 36.0, 46.7].map((s) => east.point(s)),
    east.c,
    [quay[0], quay[2]]
  ]
  for (const p of way) to(eye, p)
  close(eye.y, 9 + eyeHeight)
  for (const p of way.slice(0, -1).reverse()) to(eye, p)
  to(eye, [59.13, 53.4])
  close(eye.y, 1.35 + eyeHeight)
  const trees = new Map(),
    identity = new T.Matrix4()
  function tree(mesh) {
    if (!trees.has(mesh)) trees.set(mesh, new MeshBVH(mesh.geometry, { indirect: true }))
    return trees.get(mesh)
  }
  for (const mesh of [...bridgeMeshes, ...neighbouringShops]) mesh.geometry.computeBoundingBox()
  for (const beam of bridgeMeshes)
    for (const shop of neighbouringShops) {
      if (!beam.geometry.boundingBox.intersectsBox(shop.geometry.boundingBox)) continue
      const cuts = tree(beam).bvhcast(tree(shop), identity, {
        intersectsTriangles: (a, b) => a.intersectsTriangle(b)
      })
      assert.equal(
        cuts,
        false,
        'Bridge ' + beam.material.name + ' intersects shop ' + shop.material.name
      )
    }
})
test('the bridge approach spans the original winding garden steps, lookout and stone lantern', () => {
  const path = new T.CatmullRomCurve3(
    [
      [60.1, 39.5],
      [63.4, 40.1],
      [65.8, 36.6],
      [66.9, 40.2],
      [70.4, 41.1],
      [72.2, 37.6]
    ].map(([x, z]) => new T.Vector3(x, 0, z))
  )
  const ray = new T.Raycaster(),
    up = new T.Vector3(0, 1, 0),
    down = new T.Vector3(0, -1, 0)
  function checkClearance(x, z, height) {
    ray.set(new T.Vector3(x, 16, z), down)
    ray.far = 16
    const stone = ray.intersectObjects(originalQuay, false)[0]
    assert.ok(stone, 'Missing original stair or lamp at ' + [x, z])
    ray.set(stone.point.clone().addScaledVector(up, 0.04), up)
    ray.far = height
    assert.equal(
      ray.intersectObjects(bridgeMeshes, false).length,
      0,
      'Overhead obstruction at ' + [x, z]
    )
  }
  for (let i = 1; i <= 63; i++) {
    const p = path.getPointAt(i / 64)
    checkClearance(p.x, p.z, 1.98)
  }
  checkClearance(73.98, 37.6, 0.35)
  const eye = start([72.2, 37.6], 10.35)
  for (const p of [
    [73.16, 37.36],
    [71.85, 38.49],
    [70.72, 36.84],
    [72.2, 37.6]
  ])
    to(eye, p)
  close(eye.y, 10.35 + eyeHeight)
})
test('the timber arch bridge connects the western court and eastern court landings in both directions', () => {
  const west = reachWalks.find((p) => p.id === '西桥台').points.at(-1),
    east = reachWalks.find((p) => p.id === '东桥台').points.at(-1)
  const eye = start([west[0], west[2]], 38),
    r = routes.north
  const route = [
    r.a,
    ...[12.1, 19, 30, 43, 56, 65, 72.2, 83, 91].map((t) => r.point(t)),
    r.c,
    [east[0], east[2]]
  ]
  for (const p of route) to(eye, p)
  close(eye.y, 42 + eyeHeight)
  for (const p of route.reverse()) to(eye, p)
  to(eye, [west[0], west[2]])
  close(eye.y, 38 + eyeHeight)
})
test('both internal flights open into a usable upper room without penetrating the hillside', () => {
  for (const [axis, cx, base] of [
    [routes.east, 30.735, 12.57],
    [routes.north, 71.46, 43.72]
  ]) {
    const eye = start(axis.point(cx - 3.49, -1.86), base)
    const turns = [
      axis.point(cx + 3.27, -1.86),
      axis.point(cx + 3.27, 0.04),
      axis.point(cx - 2.79, 0.04)
    ]
    for (const p of turns) to(eye, p)
    close(eye.y, base + 3.94 + eyeHeight)
    const ray = new T.Raycaster()
    for (const s of [-3.65, -2, 0, 2, 3.65])
      for (const h of [0.65, 1.74, 3.04]) {
        const [x, z] = axis.point(cx + s, -2.59),
          [xx, zz] = axis.point(cx + s, 2.59)
        ray.set(new T.Vector3(x, base + 3.94 + h, z), new T.Vector3(xx - x, 0, zz - z).normalize())
        ray.far = 5.18
        assert.equal(
          ray.intersectObjects(terrain, false).length,
          0,
          'A terrace shoulder penetrates the gallery at ' + [x, base + 3.94 + h, z]
        )
      }
  }
})
test('boats and flying visitors can pass the actual stone, woven-wood, and sluice openings', () => {
  for (const [r, positions, heights] of [
    [routes.east, [22.2, 26.5, 29.7], [-14, -6, 2, 8.08]],
    [routes.east, [43.1, 45.1, 46.8], [-14, -6, -4, 4.7]],
    [routes.north, [41.8, 49.9, 57.1], [-14, 20, 35.1]],
    [routes.port, [14, 18.1, 20.3], [-14.7, -6.1, 0.4]]
  ])
    for (const s of positions)
      for (const y of heights) {
        const a = r.point(s, -5.6),
          c = r.point(s, 5.6),
          eye = new T.Vector3(a[0], y, a[1])
        to(eye, c, false)
        to(eye, a, false)
      }
  const [x, z] = routes.east.point(26.55),
    eye = new T.Vector3(x, 8, z)
  bridge.move(eye, 0, 6, 0, 0)
  assert.ok(eye.y > 10.3 && eye.y < 10.8, 'The pictured arch has no stone intrados')
})
test('the back-port street and the cargo quay at river level are connected by all three return flights', () => {
  const { port, portNorth, portSouth } = routes
  const eye = start(portNorth.a, 9)
  to(eye, portNorth.c)
  to(eye, port.point(25.48))
  close(eye.y, 8 + eyeHeight)
  const route = [
    [25.48, 2.62],
    [25.48, 16.1],
    [28.37, 16.1],
    [28.37, 2.11],
    [31.22, 2.11],
    [31.22, 17.55],
    [28.02, 17.55]
  ]
  for (const [x, z] of route) to(eye, port.point(x, z + reachWharfOffset))
  close(eye.y, -14.77 + eyeHeight)
  for (const [x, z] of route.slice(0, -1).reverse()) to(eye, port.point(x, z + reachWharfOffset))
  to(eye, port.point(25.48))
  to(eye, port.c)
  to(eye, portSouth.a)
  close(eye.y, 8 + eyeHeight)
  const south = reachTerraces.find((t) => t.id === '南栈-0')
  to(eye, reachPoint(south, -48.1, south.depth / 2 - 1.3))
})
