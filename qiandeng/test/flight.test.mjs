import assert from 'node:assert/strict'
import test from 'node:test'
import * as T from 'three'
import { courtyardCollision } from '../src/collision.js'
import { Mason } from '../src/mesh.js'
import { materials } from '../src/kit.js'
import { lightRegistry } from '../src/lighting.js'
import { ridgePalaces } from '../src/ridgePalaces.js'

const stone = new T.MeshStandardMaterial(),
  radius = 0.155
const v = (x, y, z) => new T.Vector3(x, y, z)
function near(value, target, tolerance = 0.001) {
  assert.ok(Math.abs(value - target) <= tolerance, `expected ${target}, received ${value}`)
}
function plane(scene, normal, position, width = 160, height = 140) {
  const panel = new T.Mesh(new T.PlaneGeometry(width, height), stone)
  panel.position.copy(position)
  panel.quaternion.setFromUnitVectors(v(0, 0, 1), normal)
  scene.add(panel)
  return panel
}

test('hundred-metre flight meets a zero-thickness face from either side and slides along a slanted wall', () => {
  const scene = new T.Scene(),
    n = v(0.6, 0, 0.8),
    along = v(-0.8, 0, 0.6),
    centre = v(-148, 29, 81)
  plane(scene, n, centre)
  const world = courtyardCollision(scene)
  for (const side of [-1, 1]) {
    const eye = centre
      .clone()
      .addScaledVector(n, 88 * side)
      .addScaledVector(along, -13)
    const delta = n
      .clone()
      .multiplyScalar(-216 * side)
      .addScaledVector(along, 51)
    world.move(eye, delta.x, 0, delta.z)
    near(eye.y, centre.y)
    near(eye.clone().sub(centre).dot(n), radius * side)
    near(eye.clone().sub(centre).dot(along), 38)
    assert.equal(world.clearance(eye), 0)
  }
})

test('pitched roof, narrow eave and concave corner preserve a swept camera radius', () => {
  const scene = new T.Scene(),
    centre = v(4, 190, -198),
    n = v(0, 0.8, 0.6)
  plane(scene, n, centre)
  const other = new T.Scene()
  plane(other, v(1, 0, 0), v(0, 0, 0))
  plane(other, v(0, 0, 1), v(0, 0, 0))
  const roof = courtyardCollision(scene),
    corner = courtyardCollision(other)
  const below = centre.clone().add(v(0, -82, 0))
  roof.move(below, 0, 216, 0)
  near(below.x, centre.x)
  near(below.z, centre.z)
  near(centre.y - below.y, radius / n.y)
  const above = centre.clone().addScaledVector(n, 2)
  const downSlope = v(0, -0.6, 0.8),
    motion = downSlope.clone().multiplyScalar(43).addScaledVector(n, -8)
  roof.move(above, motion.x, motion.y, motion.z)
  near(above.clone().sub(centre).dot(n), radius)
  near(above.clone().sub(centre).dot(downSlope), 43)
  const eye = v(12, 7, 18)
  corner.move(eye, -96, 5, -94)
  near(eye.x, radius)
  near(eye.z, radius)
  near(eye.y, 12)
  corner.move(eye, 12, 0, 0)
  near(eye.x, 12 + radius)
})

test('a 227 m descent and a glancing pass follow the glazed roof of the actual northern palace', () => {
  const scene = new T.Scene(),
    mason = new Mason(scene)
  ridgePalaces(mason, materials(), lightRegistry())
  mason.finish()
  const world = courtyardCollision(scene),
    eye = v(155, 300, -351)
  const down = new T.Raycaster(eye.clone(), v(0, -1, 0))
  const roof = down.intersectObjects(scene.children)[0]
  assert.equal(roof.object.material.name, 'ridgeGlaze')
  assert.ok(roof.point.y > 175 && Math.abs(roof.face.normal.y) < 0.9)
  world.move(eye, 0, -227, 0)
  near(eye.y, roof.point.y + radius / Math.abs(roof.face.normal.y), 0.003)
  const at = eye.clone()
  for (let i = 0; i < 5; i++) {
    world.move(eye, 0.4, -0.4, 0)
    assert.equal(world.clearance(eye), 0)
  }
  assert.ok(eye.x - at.x > 1.95 && at.y - eye.y > 0.5 && eye.z - at.z > 0.6)
})

test('the tip of a thin eave stops a grazing sphere even when its centreline clears every triangle', () => {
  const scene = new T.Scene()
  plane(scene, v(0, 0, 1), v(0, 0, 0), 2, 2)
  const world = courtyardCollision(scene),
    over = 0.125
  const eye = v(1 + over, 0.11, 5)
  world.move(eye, 0, 0, -5)
  assert.ok(eye.x > 1.15 && world.clearance(eye) <= 0.00035, eye.toArray())
  const edge = v(1, 1 + over, 5)
  world.move(edge, 0, 0, -5)
  // A purely horizontal command cannot drift upward to go over the eave.
  near(edge.y, 1 + over)
  near(edge.z, Math.sqrt(radius ** 2 - over ** 2), 0.002)
  const outside = v(1.17, 0.11, 5)
  world.move(outside, 0, 0, -194)
  near(outside.z, -189)
})

test('nested and instanced walls honor rotated parents, unequal scales, openings and mixed materials', () => {
  const scene = new T.Scene(),
    block = new T.Group()
  block.position.set(-171, 45, 236)
  block.rotation.y = 0.38
  block.scale.set(1.8, 1.12, 0.76)
  scene.add(block)
  const g = new T.BoxGeometry(4, 6, 0.012)
  const windows = new T.InstancedMesh(g, stone, 3),
    local = new T.Object3D()
  windows.rotation.y = 0.24
  block.add(windows)
  for (let i = 0; i < 3; i++) {
    local.position.set((i - 1) * 12, 2, 0)
    local.rotation.y = i % 2 ? 0.43 : -0.23
    local.scale.set(i === 0 ? -0.7 : 1.07, 0.9, 0.6)
    local.updateMatrix()
    windows.setMatrixAt(i, local.matrix)
  }
  const mesh = new T.Mesh(new T.BoxGeometry(8, 0.16, 7), stone)
  mesh.position.set(-2, 9, 5)
  mesh.rotation.z = 0.17
  block.add(mesh)
  const ghost = new T.Group()
  ghost.userData.noCollision = true
  plane(ghost, v(0, 0, 1), v(0, 0, 0))
  ghost.position.set(199, 2, 199)
  scene.add(ghost)
  const world = courtyardCollision(scene),
    transform = new T.Matrix4()
  for (let i = 0; i < 3; i++) {
    windows.getMatrixAt(i, transform)
    transform.premultiply(windows.matrixWorld)
    const q = v(0, 0, 0.006).applyMatrix4(transform)
    const n = v(0, 0, 1).applyNormalMatrix(new T.Matrix3().getNormalMatrix(transform))
    const eye = q.clone().addScaledVector(n, 8),
      d = n.clone().multiplyScalar(-158)
    world.move(eye, d.x, d.y, d.z)
    near(eye.clone().sub(q).dot(n), radius)
    assert.equal(world.clearance(eye), 0)
  }
  const top = v(0, 0.08, 0).applyMatrix4(mesh.matrixWorld)
  near(world.floor(top.x, top.z, top.y + 6, 8), top.y)
  const open = v(199, 2, 219)
  world.move(open, 0, 0, -45)
  near(open.z, 174)
  const soft = stone.clone()
  soft.userData.noCollision = true
  const fabric = new T.Mesh(new T.BoxGeometry(8, 5, 8), [soft, soft, soft, soft, stone, stone])
  const mixed = new T.Scene()
  mixed.add(fabric)
  const mixedWorld = courtyardCollision(mixed),
    edge = v(9, 0, 0),
    front = v(0, 0, 25)
  mixedWorld.move(edge, -9, 0, 0)
  near(edge.x, 0)
  mixedWorld.move(front, 0, 0, -60)
  near(front.z, 4 + radius)
})

test('transformed finite water surfaces meet flight from above and below while the external sky has no altitude cap', () => {
  const scene = new T.Scene(),
    water = [],
    shader = new T.ShaderMaterial()
  for (const [x, y, z] of [
    [0, 0, 3],
    [78, 12, -230],
    [-92, -16, -127],
  ]) {
    const g = new T.Group(),
      s = new T.Mesh(new T.PlaneGeometry(30, 42), shader)
    g.position.set(x, y, z)
    g.rotation.y = 0.43
    s.rotation.x = -Math.PI / 2
    g.add(s)
    g.updateMatrixWorld()
    water.push(s)
  }
  const world = courtyardCollision(scene, water)
  for (const s of water) {
    const centre = s.getWorldPosition(v(0, 0, 0)),
      above = centre.clone().add(v(0, 112, 0)),
      below = centre.clone().add(v(0, -96, 0))
    world.move(above, 0, -207, 0)
    near(above.y, centre.y + radius)
    world.move(below, 0, 185, 0)
    near(below.y, centre.y - radius)
    assert.equal(world.floor(centre.x, centre.z, centre.y + 10, 15), null)
  }
  const eye = v(-104, 81, 282)
  world.move(eye, 0, 5400, 0)
  near(eye.y, 5481)
  world.move(eye, 3600, -6200, -900)
  near(eye.y, -719)
  near(eye.x, 3496)
  near(eye.z, -618)
})

test('large empty flights use one dynamic sweep; moving barriers stop long coalesced input at first contact', () => {
  const scene = new T.Scene(),
    material = new T.MeshStandardMaterial()
  const repeated = new T.InstancedMesh(new T.BoxGeometry(2, 5, 2), material, 2400)
  const m = new T.Matrix4()
  for (let i = 0; i < 2400; i++)
    repeated.setMatrixAt(i, m.makeTranslation((i % 60) * 9, 2.5, Math.floor(i / 60) * 10))
  scene.add(repeated)
  let calls = 0
  const world = courtyardCollision(scene, null, (a, b, r) => {
    calls++
    return a.y < 10 && a.x < 601 - r && b.x >= 601 - r
  })
  const sky = v(-40, 900, 96)
  world.move(sky, 3700, 0, 400)
  near(sky.x, 3660)
  assert.equal(calls, 1)
  const eye = v(550, 1.9, 0)
  world.move(eye, 202, 0, 0)
  near(eye.x, 601 - radius, 0.001)
  assert.ok(calls < 25)
  const diagonal = v(550, 1.9, 10)
  world.move(diagonal, 202, 0, 91)
  near(diagonal.x, 601 - radius, 0.001)
  near(diagonal.z, 101)
})
