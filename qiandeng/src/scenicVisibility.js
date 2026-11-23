import * as T from 'three'
import { instanceVisibility } from './instanceVisibility.js'

// A cell holds the farthest depth of a real opaque face that covers the entire
// cell. An object is hidden only if its nearest box corner is behind every
// cell it touches. Windows, branches, door openings and silhouettes stay open.
function depthTiles() {
  const columns = 64, rows = 48
  const depth = new Float32Array(columns * rows)
  const px = new Float64Array(4), py = new Float64Array(4)
  const dx = new Float64Array(4), dy = new Float64Array(4), inset = new Float64Array(4)
  let matrix
  function clear(view) {
    matrix = view.elements
    depth.fill(Infinity)
  }
  function paint(position, faces) {
    const m = matrix
    for (let start = 0; start < faces.length; start += 4) {
      const count = faces[start + 3] < 0 ? 3 : 4
      let left = columns, right = 0, bottom = rows, top = 0, far = 0, clipped = false
      for (let k = 0; k < count; k++) {
        const off = faces[start + k] * 3
        const x = position[off], y = position[off + 1], z = position[off + 2]
        const w = m[3] * x + m[7] * y + m[11] * z + m[15]
        const clipZ = m[2] * x + m[6] * y + m[10] * z + m[14]
        // Mirrors use an oblique near plane. An intersecting face cannot
        // occlude with its complete outline in that view.
        if (w <= 0.001 || Math.abs(clipZ) >= w - 1e-5) { clipped = true; break }
        const u = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w + 1) * (columns / 2)
        const v = ((m[1] * x + m[5] * y + m[9] * z + m[13]) / w + 1) * (rows / 2)
        px[k] = u; py[k] = v
        left = Math.min(left, u); right = Math.max(right, u)
        bottom = Math.min(bottom, v); top = Math.max(top, v)
        far = Math.max(far, w)
      }
      if (clipped || right - left < 1 || top - bottom < 1) continue
      const sign = Math.sign((px[1] - px[0]) * (py[2] - py[0]) - (py[1] - py[0]) * (px[2] - px[0]))
      if (!sign) continue
      for (let k = 0; k < count; k++) {
        const j = (k + 1) % count, next = (j + 1) % count
        dx[k] = (px[j] - px[k]) * sign; dy[k] = (py[j] - py[k]) * sign
        if (dx[k] * (py[next] - py[j]) - dy[k] * (px[next] - px[j]) < -1e-8) { clipped = true; break }
        inset[k] = .5001 * (Math.abs(dx[k]) + Math.abs(dy[k])) + 1e-6
      }
      if (clipped) continue
      const x0 = Math.max(0, Math.ceil(left)), x1 = Math.min(columns, Math.floor(right))
      const y0 = Math.max(0, Math.ceil(bottom)), y1 = Math.min(rows, Math.floor(top))
      for (let j = y0; j < y1; j++) {
        for (let i = x0; i < x1; i++) {
          const slot = j * columns + i
          if (depth[slot] <= far) continue
          let k = 0
          for (; k < count; k++)
            if (dx[k] * (j + .5 - py[k]) - dy[k] * (i + .5 - px[k]) <= inset[k]) break
          if (k === count) depth[slot] = far + .03
        }
      }
    }
  }
  function hides(box) {
    const m = matrix, a = box.min, b = box.max
    const x = (a.x + b.x) * .5, y = (a.y + b.y) * .5, z = (a.z + b.z) * .5
    const sx = b.x - x, sy = b.y - y, sz = b.z - z
    const w = m[3] * x + m[7] * y + m[11] * z + m[15]
    const sw = Math.abs(m[3]) * sx + Math.abs(m[7]) * sy + Math.abs(m[11]) * sz
    const near = w - sw, far = w + sw
    if (near <= .01) return false
    const u = m[0] * x + m[4] * y + m[8] * z + m[12]
    const su = Math.abs(m[0]) * sx + Math.abs(m[4]) * sy + Math.abs(m[8]) * sz
    const v = m[1] * x + m[5] * y + m[9] * z + m[13]
    const sv = Math.abs(m[1]) * sx + Math.abs(m[5]) * sy + Math.abs(m[9]) * sz
    const x0 = Math.max(0, Math.floor((1 + (u - su) / (u < su ? near : far)) * (columns / 2) - .001))
    const x1 = Math.min(columns, Math.ceil((1 + (u + su) / (u < -su ? far : near)) * (columns / 2) + .001))
    const y0 = Math.max(0, Math.floor((1 + (v - sv) / (v < sv ? near : far)) * (rows / 2) - .001))
    const y1 = Math.min(rows, Math.ceil((1 + (v + sv) / (v < -sv ? far : near)) * (rows / 2) + .001))
    if (x0 >= x1 || y0 >= y1) return false
    for (let j = y0; j < y1; j++) {
      for (let i = x0; i < x1; i++) if (depth[j * columns + i] >= near) return false
    }
    return true
  }
  return { clear, paint, hides }
}

// Keep runs of the authored index in their original order. Only the index of
// a partly visible mesh is streamed; its UVs, normals and vertex buffers are shared.
const runSize = 72 * 3
function sections(g, opaque) {
  const index = g.index.array, pos = g.attributes.position.array
  const boxes = [], faces = []
  const point = new T.Vector3()
  if (index.length > runSize * 2) {
    for (let i = 0; i < index.length; i += runSize) {
      const box = new T.Box3(), end = Math.min(index.length, i + runSize)
      for (let k = i; k < end; k++) box.expandByPoint(point.fromArray(pos, index[k] * 3))
      boxes.push(box)
    }
  }
  if (opaque) {
    const a = new T.Vector3(), u = new T.Vector3(), v = new T.Vector3()
    for (let i = 0; i < index.length; i += 3) {
      const ia = index[i], ib = index[i + 1], ic = index[i + 2]
      a.fromArray(pos, ia * 3)
      u.fromArray(pos, ib * 3).sub(a); v.fromArray(pos, ic * 3).sub(a)
      const area = u.cross(v).lengthSq()
      const quad = i + 5 < index.length && index[i + 3] === ia && index[i + 4] === ic
      if (area > 144) faces.push({ area, a: ia, b: ib, c: ic, d: quad ? index[i + 5] : -1 })
      if (quad) i += 3
    }
    faces.sort((a, b) => b.area - a.area)
  }
  const occluders = new Int32Array(Math.min(96, faces.length) * 4)
  for (let i = 0; i * 4 < occluders.length; i++) {
    const f = faces[i]
    occluders.set([f.a, f.b, f.c, f.d], i * 4)
  }
  const keep = new Uint8Array(boxes.length), previous = new Uint8Array(boxes.length)
  let clipped
  function visible(frustum, tiles) {
    if (!boxes.length) return g
    let count = 0, changed = false
    for (let i = 0; i < boxes.length; i++) {
      keep[i] = Number(frustum.intersectsBox(boxes[i]) && !tiles.hides(boxes[i]))
      count += keep[i]
      if (keep[i] !== previous[i]) changed = true
    }
    if (!count) return null
    if (count === boxes.length) return g
    if (!clipped) {
      clipped = new T.BufferGeometry()
      for (const name of Object.keys(g.attributes)) clipped.setAttribute(name, g.attributes[name])
      clipped.setIndex(new T.BufferAttribute(new index.constructor(index.length), 1).setUsage(T.DynamicDrawUsage))
      clipped.boundingBox = g.boundingBox
      clipped.boundingSphere = g.boundingSphere
      g.addEventListener('dispose', () => clipped.dispose())
    }
    if (changed) {
      previous.set(keep)
      let ptr = 0
      for (let i = 0; i < boxes.length;) {
        if (!keep[i]) { i++; continue }
        const first = i++ * runSize
        while (i < boxes.length && keep[i]) i++
        const end = Math.min(i * runSize, index.length)
        clipped.index.array.set(index.subarray(first, end), ptr)
        ptr += end - first
      }
      clipped.setDrawRange(0, ptr)
      clipped.index.clearUpdateRanges()
      clipped.index.addUpdateRange(0, ptr)
      clipped.index.needsUpdate = true
    }
    return clipped
  }
  return { pos, occluders, visible }
}

export function scenicVisibility(statics) {
  const supported = new WeakMap(), cache = new WeakMap()
  const identity = new T.Matrix4(), view = new T.Matrix4(), frustum = new T.Frustum()
  const tiles = depthTiles(), candidates = [], changed = []
  const instances = instanceVisibility(statics.parent)
  statics.traverse(o => {
    const m = o.material
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && m?.isMeshStandardMaterial &&
        !m.userData.collisionOnly && o.matrixWorld.equals(identity)) {
      supported.set(o, m.side === T.DoubleSide && !m.transparent && m.opacity === 1 && !m.alphaTest && m.depthWrite)
    }
  })
  function spansFor(o) {
    const g = o.geometry
    let spans = cache.get(g)
    if (!spans) { spans = sections(g, supported.get(o)); cache.set(g, spans) }
    return spans
  }
  // A mirror behind the quay or a building still intersects the camera
  // frustum. Test its receiving surface against the same opaque masonry
  // before drawing a second city. The observer grid is shared by all rivers.
  const observerTiles = depthTiles(), observerView = new T.Matrix4(), observerSight = new T.Frustum()
  let observer, fresh = false
  function hiddenReceiver(box) {
    if (!fresh) {
      fresh = true
      observerView.multiplyMatrices(observer.projectionMatrix, observer.matrixWorldInverse)
      observerTiles.clear(observerView)
      observerSight.setFromProjectionMatrix(observerView)
      for (const o of statics.children) {
        const g = o.geometry
        if (!o.visible || !supported.get(o) || !o.layers.test(observer.layers) ||
            !g?.index?.count || g.groups.length || g.drawRange.start || g.drawRange.count < g.index.count) continue
        if (!g.boundingBox) g.computeBoundingBox()
        if (!observerSight.intersectsBox(g.boundingBox)) continue
        const spans = spansFor(o)
        observerTiles.paint(spans.pos, spans.occluders)
      }
    }
    return observerTiles.hides(box)
  }
  function prepare(camera, city) {
    if (!camera.isPerspectiveCamera || statics.overrideMaterial) return
    view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    const sight = camera.userData.reflectionFrustum || frustum.setFromProjectionMatrix(view)
    if (!statics.visible) {
      if (city) instances.prepare(camera, sight, null)
      return
    }
    const depth = camera === observer && fresh ? observerTiles : tiles
    if (depth === tiles) tiles.clear(view)
    statics.traverseVisible(o => {
      if (o.isLOD && o.autoUpdate) o.update(camera)
      if (!supported.has(o) || !o.layers.test(camera.layers)) return
      const g = o.geometry
      if (!g.index?.count || !g.attributes.position || g.groups.length ||
          g.drawRange.start || g.drawRange.count < g.index.count) return
      if (!g.boundingBox) g.computeBoundingBox()
      if (!sight.intersectsBox(g.boundingBox)) {
        changed.push(o, g); o.visible = false
        return
      }
      const spans = spansFor(o)
      if (depth === tiles && supported.get(o)) depth.paint(spans.pos, spans.occluders)
      candidates.push(o, spans)
    })
    for (let i = 0; i < candidates.length; i += 2) {
      const o = candidates[i], g = o.geometry
      const geometry = depth.hides(g.boundingBox) ? null : candidates[i + 1].visible(sight, depth)
      if (geometry !== g) {
        changed.push(o, g)
        if (geometry) o.geometry = geometry
        else o.visible = false
      }
    }
    candidates.length = 0
    if (city) instances.prepare(camera, sight, depth)
  }
  function restore() {
    for (let i = 0; i < changed.length; i += 2) {
      changed[i].visible = true
      changed[i].geometry = changed[i + 1]
    }
    changed.length = 0
    instances.restore()
  }
  for (const scene of [statics, statics.parent]) {
    if (!scene?.isScene) continue
    const before = scene.onBeforeRender, after = scene.onAfterRender
    scene.onBeforeRender = function(renderer, root, camera, target) {
      before.call(this, renderer, root, camera, target)
      prepare(camera, scene !== statics)
    }
    scene.onAfterRender = function(renderer, root, camera) {
      restore()
      after.call(this, renderer, root, camera)
    }
  }
  return function observe(camera) {
    observer = camera
    fresh = false
    camera.userData.hiddenReceiver = hiddenReceiver
  }
}
