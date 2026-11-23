import * as T from 'three'

// Work in homogeneous clip space so a shoreline crossing the near plane still
// produces a finite rectangle. Texture coordinates remain those of the full
// mirror, including the shimmer sampled by wet paving outside the canal.
export function reflectionWindow(target, level, primary) {
  const buffers = Array.from({ length: 2 }, () => Array.from({ length: 12 }, () => new T.Vector4()))
  const bounds = new T.Box2(), uv = new T.Vector2()
  const view = new T.Matrix4(), crop = new T.Matrix4(), frustum = new T.Frustum()
  function distance(p, plane) {
    switch (plane) {
      case 0: return p.w + p.z
      case 1: return p.w + p.x
      case 2: return p.w - p.x
      case 3: return p.w + p.y
      case 4: return p.w - p.y
      default: return p.w - p.z
    }
  }
  function patch(left, right, near, far) {
    let input = buffers[0], output = buffers[1], count = 4
    input[0].set(left, level, near, 1).applyMatrix4(view)
    input[1].set(right, level, near, 1).applyMatrix4(view)
    input[2].set(right, level, far, 1).applyMatrix4(view)
    input[3].set(left, level, far, 1).applyMatrix4(view)
    for (let side = 0; side < 6 && count; side += primary ? 5 : 1) {
      let written = 0, a = input[count - 1], da = distance(a, side)
      for (let i = 0; i < count; i++) {
        const b = input[i], db = distance(b, side)
        if ((da > 0) !== (db > 0)) output[written++].lerpVectors(a, b, da / (da - db))
        if (db > 0) output[written++].copy(b)
        a = b; da = db
      }
      const swap = input; input = output; output = swap; count = written
    }
    for (let i = 0; i < count; i++) {
      const p = input[i]
      bounds.expandByPoint(uv.set(T.MathUtils.clamp(.5 + .5 * p.x / p.w, 0, 1), T.MathUtils.clamp(.5 + .5 * p.y / p.w, 0, 1)))
    }
  }
  const pieces = new WeakMap()
  function patches(box) {
    let list = pieces.get(box)
    if (list) return list
    const a = box.min, b = box.max
    const nx = Math.max(1, Math.ceil((b.x - a.x) / 16)), nz = Math.max(1, Math.ceil((b.z - a.z) / 16))
    if (nx * nz === 1) return [box]
    list = []
    for (let x = 0; x < nx; x++) for (let z = 0; z < nz; z++) {
      list.push(new T.Box3(
        new T.Vector3(a.x + (b.x - a.x) * x / nx, a.y, a.z + (b.z - a.z) * z / nz),
        new T.Vector3(a.x + (b.x - a.x) * (x + 1) / nx, b.y, a.z + (b.z - a.z) * (z + 1) / nz)
      ))
    }
    pieces.set(box, list)
    return list
  }
  function measure(camera, boxes, observerFrustum, hidden) {
    bounds.makeEmpty()
    view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    if (primary && Math.abs(camera.position.y - level) < 3.3) {
      // An eye below a wet upper step can project its reflected contact point
      // behind the lens. The shader clamps that lookup to the full map edge.
      bounds.min.set(0, 0); bounds.max.set(1, 1)
    } else for (const region of boxes) {
      if (!observerFrustum.intersectsBox(region) || hidden?.(region)) continue
      for (const box of patches(region)) {
        if (!observerFrustum.intersectsBox(box) || hidden?.(box)) continue
        patch(box.min.x, box.max.x, box.min.z, box.max.z)
      }
    }
    if (bounds.isEmpty()) return false
    // Wave normals, the two displaced filter taps and a complete boundary
    // texel fit inside this guard at every existing reflection resolution.
    const w = target.width, h = target.height
    const margin = primary ? .055 : .012
    const marginX = margin * w + 3, marginY = margin * h + 3
    const left = Math.max(0, Math.floor(bounds.min.x * w - marginX))
    const right = Math.min(w, Math.ceil(bounds.max.x * w + marginX))
    const bottom = Math.max(0, Math.floor(bounds.min.y * h - marginY))
    const top = Math.min(h, Math.ceil(bounds.max.y * h + marginY))
    target.scissor.set(left, bottom, right - left, top - bottom)
    target.scissorTest = right - left < w || top - bottom < h
    const sx = (right - left) / w, sy = (top - bottom) / h
    crop.set(1 / sx, 0, 0, (1 - (left + right) / w) / sx,
             0, 1 / sy, 0, (1 - (bottom + top) / h) / sy,
             0, 0, 1, 0, 0, 0, 0, 1)
    return true
  }
  function clip(camera) {
    // Keep the GPU projection and pixel footprint for point sprites and rain.
    // A matching CPU frustum rejects geometry wholly outside the scissor.
    view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).premultiply(crop)
    camera.userData.reflectionFrustum = frustum.setFromProjectionMatrix(view)
  }
  return { measure, clip }
}
