import assert from 'node:assert/strict'
import test from 'node:test'
import * as T from 'three'
import { scenicDetail } from '../src/detail.js'
import { Mason } from '../src/mesh.js'
import { spatialSections } from '../src/scenicGeometry.js'

function visible(scene, material) {
  const meshes = []
  scene.traverseVisible((o) => {
    if (o.isMesh && (!material || o.material === material)) meshes.push(o)
  })
  return meshes
}

function triangles(meshes) {
  return meshes.reduce((count, o) => count + o.geometry.index.count / 3, 0)
}

function view(scene, detail, camera, x, y, z) {
  camera.position.set(x, y, z)
  camera.lookAt(x, y, -20)
  camera.updateMatrixWorld()
  detail.update(camera, 600, true)
  scene.traverse((o) => {
    if (o.isLOD) o.update(camera)
  })
}

test('street meshes reduce subpixel joinery, keep the glowing window UVs and restore the exact room on approach', () => {
  const scene = new T.Scene()
  const wood = new T.MeshStandardMaterial({ name: 'timber' })
  const windows = new T.MeshStandardMaterial({ name: 'silkWindow', emissive: 0xffa538 })
  windows.userData.cast = false
  for (const x of [-8, 0, 8, 16]) {
    const b = new Mason(scene)
    b.box(wood, x, 2.5, -20, 6, 5, 0.8)
    for (let j = 0; j < 21; j++) b.box(wood, x - 2.5 + j * 0.25, 2.5, -19.2, 0.07, 3.3, 0.12)
    b.face(
      windows,
      [
        [x - 2, 1, -19.4],
        [x + 2, 1, -19.4],
        [x + 2, 4, -19.4],
        [x - 2, 4, -19.4],
      ],
      0.91,
      [
        [0.22, 0.1],
        [0.31, 0.1],
        [0.31, 0.26],
        [0.22, 0.26],
      ]
    )
    b.finish()
  }
  const originals = scene.children.map((o) => [o, o.geometry])
  const fullWood = triangles(visible(scene, wood))
  const originalWindows = visible(scene, windows).flatMap((o) => [...o.geometry.attributes.uv.array])
  const camera = new T.PerspectiveCamera(56, 1.6, 0.08, 1900)
  const detail = scenicDetail(scene)
  view(scene, detail, camera, 2, 2, -16)
  assert.equal(visible(scene).length, originals.length)
  view(scene, detail, camera, 2, 17, 610)
  assert.equal(visible(scene, wood).length, 1)
  assert.ok(triangles(visible(scene, wood)) < fullWood / 4)
  assert.ok(triangles(visible(scene, wood)) >= 4)
  const [frame] = visible(scene, wood)
  assert.equal(frame.castShadow, true)
  const [silk] = visible(scene, windows)
  assert.equal(silk.castShadow, false)
  assert.equal(triangles([silk]), 8)
  assert.deepEqual([...silk.geometry.attributes.uv.array], originalWindows)
  view(scene, detail, camera, 2, 2, -16)
  for (const [o, original] of originals) {
    assert.equal(o.visible, true)
    assert.equal(o.geometry, original)
  }
})

test('batched distant skyline models yield to their authored upper floors when approaching', () => {
  const scene = new T.Scene()
  const near = new T.MeshStandardMaterial({ name: 'entered hall' })
  const far = new T.MeshStandardMaterial({ name: 'tower silhouette' })
  for (const x of [-7, 7]) {
    const tower = new T.LOD()
    tower.position.set(x, 0, -20)
    for (const [mat, switchDistance] of [
      [near, 0],
      [far, 116],
    ]) {
      const halls = new T.Group()
      const b = new Mason(halls)
      b.box(mat, x, 8, -20, 10, 16, 8)
      b.finish()
      halls.position.copy(tower.position).multiplyScalar(-1)
      tower.addLevel(halls, switchDistance, 0.12)
    }
    scene.add(tower)
  }
  const camera = new T.PerspectiveCamera(56, 1.6, 0.08, 1900)
  const detail = scenicDetail(scene)
  view(scene, detail, camera, 0, 9, 750)
  assert.equal(visible(scene, near).length, 0)
  assert.equal(visible(scene, far).length, 1)
  view(scene, detail, camera, 0, 9, -12)
  assert.equal(visible(scene, far).length, 0)
  assert.equal(visible(scene, near).length, 2)
})

test('partitioning a hillside preserves the exact triangles and all per-corner paint across tile boundaries', () => {
  const scene = new T.Scene(),
    b = new Mason(scene),
    mat = new T.MeshStandardMaterial()
  for (const x of [-24, -15, -7, 1, 9, 17, 26])
    b.face(
      mat,
      [
        [x, 0, 0],
        [x, 1, 3],
        [x + 11, 1.5, 3],
      ],
      [0.61, 0.73, 0.89],
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ]
    )
  b.finish()
  const g = scene.children[0].geometry
  function corners(geometries) {
    const values = []
    for (const item of geometries) {
      const attrs = Object.values(item.attributes)
      for (const index of item.index.array) {
        const corner = attrs.flatMap((a) => [
          ...a.array.subarray(index * a.itemSize, (index + 1) * a.itemSize),
        ])
        values.push(corner.join('/'))
      }
    }
    return values.sort()
  }
  const parts = spatialSections(g, 11, 1)
  assert.ok(parts.length >= 4)
  assert.deepEqual(corners(parts), corners([g]))
  assert.ok(parts.every((p) => !p.boundingBox.isEmpty() && p.boundingSphere.radius > 0))
})
