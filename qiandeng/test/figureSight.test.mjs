import assert from 'node:assert/strict'
import test from 'node:test'
import * as T from 'three'
import { scenicVisibility } from '../src/scenicVisibility.js'

function inspection(mesh, actor, ship) {
  const city = new T.Scene(), stone = new T.Scene()
  const eye = new T.PerspectiveCamera(55, 1, .1, 100)
  city.add(stone, actor)
  const observe = scenicVisibility(stone)
  const geometry = mesh.geometry
  stone.userData.trackFigure(actor, ship)
  return (x, z) => {
    eye.position.set(x, 0, z)
    eye.lookAt(0, 0, -6)
    eye.updateMatrixWorld()
    city.updateMatrixWorld(true)
    observe(eye)
    city.onBeforeRender(null, city, eye)
    const visible = mesh.visible
    city.onAfterRender(null, city, eye)
    assert.equal(mesh.visible, true)
    assert.equal(mesh.geometry, geometry)
    return visible
  }
}

test('an opaque vessel panel hides the passenger only from its covered side', () => {
  const mesh = new T.Mesh(new T.SphereGeometry(.25, 36, 20))
  const actor = new T.Group()
  actor.position.z = -6
  actor.add(mesh)
  const ship = {
    group: new T.Group(),
    deckSight: { vertices: new Float32Array([-1,-1,-3, 1,-1,-3, 1,1,-3, -1,1,-3]), faces: [0,1,2,3] },
  }
  const inspect = inspection(mesh, actor, ship)
  assert.equal(inspect(0, 0), false)
  assert.equal(inspect(3, -4), true)
  assert.equal(inspect(0, -8), true)
  assert.equal(inspect(0, 0), false)
  ship.group.visible = false
  assert.equal(inspect(0, 0), true)
})

test('posed clothing can enter and leave the frustum with its moving bone', () => {
  const g = new T.SphereGeometry(.25, 36, 20), count = g.attributes.position.count
  const weights = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) weights[i * 4] = 1
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(count * 4), 4))
  g.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4))
  const mesh = new T.SkinnedMesh(g), joint = new T.Bone(), actor = new T.Group()
  actor.add(mesh, joint)
  mesh.bind(new T.Skeleton([joint]), new T.Matrix4())
  mesh.frustumCulled = false
  actor.position.z = -6
  const inspect = inspection(mesh, actor)
  assert.equal(inspect(0, 0), true)
  joint.position.x = 15
  assert.equal(inspect(0, 0), false)
  joint.position.x = 0
  assert.equal(inspect(0, 0), true)
})
