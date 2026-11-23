import * as T from 'three'

// Animated batches contain bodies on both banks and in the sky. The reflected
// camera and visitor each need a different subset, with the same matrices,
// per-body color and silk pattern selected by the animation.
export function instanceVisibility(city) {
  const batches = [], changed = []
  const matrix = new T.Matrix4(), sphere = new T.Sphere(), box = new T.Box3()
  city?.traverse(o => {
    if (o.isInstancedMesh && !o.frustumCulled && o.instanceMatrix.count > 1)
      batches.push({ o, ids: new Uint32Array(o.instanceMatrix.count), attributes: new WeakMap() })
  })

  function compact(attr, batch, count) {
    let dest = batch.attributes.get(attr)
    if (!dest) {
      dest = new T.InstancedBufferAttribute(new attr.array.constructor(attr.array.length), attr.itemSize, attr.normalized)
      dest.setUsage(T.DynamicDrawUsage)
      batch.attributes.set(attr, dest)
    }
    const size = attr.itemSize
    for (let i = 0; i < count; i++) {
      const offset = batch.ids[i] * size
      for (let k = 0; k < size; k++) dest.array[i * size + k] = attr.array[offset + k]
    }
    dest.clearUpdateRanges()
    dest.addUpdateRange(0, count * size)
    dest.needsUpdate = true
    return dest
  }

  function prepare(camera, frustum, depth) {
    for (const batch of batches) {
      const { o, ids } = batch
      if (!o.visible || !o.count || !o.layers.test(camera.layers)) continue
      const g = o.geometry
      if (!g.boundingSphere) g.computeBoundingSphere()
      let count = 0
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, matrix)
        matrix.premultiply(o.matrixWorld)
        sphere.copy(g.boundingSphere).applyMatrix4(matrix)
        sphere.radius += .08
        if (!frustum.intersectsSphere(sphere)) continue
        if (depth && depth.hides(sphere.getBoundingBox(box))) continue
        ids[count++] = i
      }
      if (count === o.count) continue
      const source = { o, count: o.count, matrix: o.instanceMatrix, color: o.instanceColor, extra: [] }
      changed.push(source)
      o.count = count
      if (!count) { o.visible = false; continue }
      o.instanceMatrix = compact(source.matrix, batch, count)
      if (source.color) o.instanceColor = compact(source.color, batch, count)
      for (const key of Object.keys(g.attributes)) {
        const attr = g.attributes[key]
        if (attr.isInstancedBufferAttribute) {
          source.extra.push(key, attr)
          g.setAttribute(key, compact(attr, batch, count))
        }
      }
    }
  }
  function restore() {
    for (const source of changed) {
      const o = source.o
      o.count = source.count
      o.visible = true
      o.instanceMatrix = source.matrix
      o.instanceColor = source.color
      for (let i = 0; i < source.extra.length; i += 2)
        o.geometry.setAttribute(source.extra[i], source.extra[i + 1])
    }
    changed.length = 0
  }
  return { prepare, restore }
}
