import assert from 'node:assert/strict'
import test from 'node:test'
import * as T from 'three'
import { Mason } from '../src/mesh.js'
import { scenicVisibility } from '../src/scenicVisibility.js'
import { reflectionWindow } from '../src/reflectionWindow.js'

function aim(x, y, z, tx, ty, tz) {
  const view = new T.PerspectiveCamera(54, 1.3, .1, 200)
  view.position.set(x, y, z)
  view.lookAt(tx, ty, tz)
  view.updateMatrixWorld()
  return view
}
function render(scene, camera, inspect) {
  scene.onBeforeRender(null, scene, camera, null)
  try { inspect() } finally { scene.onAfterRender(null, scene, camera) }
}

test('both city passes hide fully covered masonry and restore it when the visitor rounds the wall', () => {
  const city = new T.Scene(), stone = new T.Scene()
  city.add(stone)
  const wood = new T.MeshStandardMaterial({ side: T.DoubleSide })
  const b = new Mason(stone)
  b.face(wood, [[-4, -4, -4], [4, -4, -4], [4, 4, -4], [-4, 4, -4]])
  b.finish()
  const grain = new T.MeshStandardMaterial({ side: T.DoubleSide })
  b.box(grain, .45, .1, -9, .6, .5, .4); b.finish()
  const item = stone.children[1], original = item.geometry
  stone.updateMatrixWorld(true)
  const observe = scenicVisibility(stone)
  const front = aim(0, 0, 0, 0, 0, -1), side = aim(8, .2, -9, 0, .1, -9)
  observe(front)
  assert.equal(front.userData.hiddenReceiver(new T.Box3().setFromObject(item)), true)
  for (const root of [stone, city]) {
    render(root, front, () => assert.equal(item.visible, false))
    assert.equal(item.visible, true)
  }
  observe(side)
  render(city, side, () => assert.equal(item.visible, true))
  assert.equal(item.geometry, original)
})

test('transparent silk keeps the house visible behind it', () => {
  const stone = new T.Scene(), b = new Mason(stone)
  b.face(new T.MeshStandardMaterial({ transparent: true, opacity: .3, side: T.DoubleSide }),
    [[-4, -4, -4], [4, -4, -4], [4, 4, -4], [-4, 4, -4]])
  b.box(new T.MeshStandardMaterial(), 0, .2, -9, .5, .5, .5)
  b.finish(); stone.updateMatrixWorld(true)
  scenicVisibility(stone)
  render(stone, aim(0, 0, 0, 0, 0, -1), () => assert.ok(stone.children.every(o => o.visible)))
})

test('each lens submits its visible lanterns with matching transforms, per-instance pigments and colors', () => {
  const city = new T.Scene(), stone = new T.Scene(), g = new T.BoxGeometry(.5, .5, .5)
  const lights = new T.InstancedMesh(g, new T.MeshBasicMaterial(), 3)
  const pigment = new T.InstancedBufferAttribute(new Float32Array([11, 22, 33]), 1)
  g.setAttribute('lantern', pigment)
  ;[-13, 0, 14].forEach((x, i) => {
    lights.setMatrixAt(i, new T.Matrix4().makeTranslation(x, 1, -6))
    lights.setColorAt(i, new T.Color(i / 2, .2, .6))
  })
  lights.frustumCulled = false
  city.add(stone, lights); city.updateMatrixWorld(true)
  const original = lights.instanceMatrix, color = lights.instanceColor
  scenicVisibility(stone)
  for (const [x, index] of [[0, 1], [14, 2], [-13, 0]]) {
    render(city, aim(x, 1, 0, x, 1, -6), () => {
      assert.equal(lights.count, 1)
      assert.equal(lights.instanceMatrix.array[12], x)
      assert.equal(lights.instanceColor.array[0], index / 2)
      assert.equal(g.attributes.lantern.array[0], 11 * (index + 1))
    })
    assert.equal(lights.count, 3)
    assert.equal(lights.instanceMatrix, original)
    assert.equal(lights.instanceColor, color)
    assert.equal(g.attributes.lantern, pigment)
  }
})

test('the reflection scissor contains every projected pond corner plus wave texture taps', () => {
  const target = new T.WebGLRenderTarget(400, 260), mirror = aim(0, -4, 0, 0, 0, -30)
  const pond = new T.Box3(new T.Vector3(-3, -.01, -35), new T.Vector3(3, .01, -26))
  const observer = new T.Frustum().setFromProjectionMatrix(
    new T.Matrix4().multiplyMatrices(mirror.projectionMatrix, mirror.matrixWorldInverse))
  const crop = reflectionWindow(target, 0, false)
  assert.ok(crop.measure(mirror, [pond], observer))
  crop.clip(mirror)
  assert.equal(target.scissorTest, true)
  assert.ok(target.scissor.z < 130 && target.scissor.w < 100)
  for (const x of [-3, 3]) for (const z of [-35, -26]) {
    const p = new T.Vector3(x, 0, z)
    assert.ok(mirror.userData.reflectionFrustum.containsPoint(p))
    p.project(mirror)
    assert.ok((p.x + 1) * 200 > target.scissor.x + 3)
    assert.ok((p.x + 1) * 200 < target.scissor.x + target.scissor.z - 3)
  }
  assert.equal(crop.measure(mirror, [pond], observer, () => true), false)
})
