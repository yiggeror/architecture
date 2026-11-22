import * as T from 'three'
import { MeshBVH } from 'three-mesh-bvh'

// Only the moving brass mechanism needs an additional collision query. The
// staircase, fixed meridian and supports are already in the city's static BVH.
export function clockworkContact(palaceGroup) {
  const pieces = [],
    trees = new Map(),
    inverse = new T.Matrix4(),
    local = new T.Vector3(),
    old = new T.Vector3(),
    s = new T.Vector3()
  const center = new T.Vector3(),
    near = new T.Vector3(),
    pushed = new T.Vector3(),
    normal = new T.Vector3(),
    result = { point: new T.Vector3() }
  const transform = new T.Matrix4(),
    worldMatrix = new T.Matrix4()
  palaceGroup.traverse((o) => {
    if (!o.isMesh) return
    const geometry = o.geometry
    if (!trees.has(geometry)) trees.set(geometry, new MeshBVH(geometry, { indirect: true }))
    pieces.push({ object: o, tree: trees.get(geometry) })
  })
  const instrument = palaceGroup.children[0]
  function update() {
    palaceGroup.updateWorldMatrix(true, true)
    instrument.getWorldPosition(center)
  }
  function visit(point, radius, callback) {
    if (point.distanceToSquared(center) > 43.6) return false
    for (const { object, tree } of pieces) {
      const count = object.isInstancedMesh ? object.count : 1
      for (let i = 0; i < count; i++) {
        if (object.isInstancedMesh) {
          object.getMatrixAt(i, transform)
          worldMatrix.multiplyMatrices(object.matrixWorld, transform)
        } else worldMatrix.copy(object.matrixWorld)
        inverse.copy(worldMatrix).invert()
        local.copy(point).applyMatrix4(inverse)
        s.setFromMatrixScale(worldMatrix)
        const dist = radius / Math.max(0.0001, Math.min(s.x, s.y, s.z))
        if (!tree.closestPointToPoint(local, result, 0, dist)) continue
        near.copy(result.point).applyMatrix4(worldMatrix)
        if (near.distanceToSquared(point) >= radius * radius) continue
        if (callback()) return true
      }
    }
    return false
  }
  function block(from, to, radius) {
    return visit(to, radius, () => {
      old.copy(from).sub(near)
      normal.copy(to).sub(near)
      return normal.lengthSq() < old.lengthSq() || normal.dot(old) <= 0
    })
  }
  function protect(eye, clearance) {
    return visit(eye, 0.16, () => {
      normal.copy(eye).sub(near)
      if (normal.lengthSq() < 1e-12) normal.set(0, 1, 0)
      normal.normalize()
      pushed.copy(near).addScaledVector(normal, 0.162)
      if (clearance(pushed) > 0.00035) return false
      eye.copy(pushed)
      return true
    })
  }
  update()
  return { update, block, protect }
}
