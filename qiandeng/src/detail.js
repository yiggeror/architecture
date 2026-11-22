import * as T from 'three'
import { combineGeometry, farIndices, indexView, spatialSections } from './scenicGeometry.js'

// Both quantities are in metres. The first is the world span of one screen
// pixel. The second limits the smallest feature in a band of viewing distances.
const pixelSpans = [0, 0.084, 0.195, 0.43, 0.85, 1.62, 3]
const gridSizes = [0, 0.15, 0.37, 0.83, 1.66, 3.05, 5.5]
const districtWidths = [260, 95, 43]
const batchLevels = [4, 2, 1]
const identity = new T.Matrix4()
const cacheBudget = 64 * 1024 * 1024

function levelAt(pixelSpan) {
  let level = 0
  while (level + 1 < pixelSpans.length && pixelSpan >= pixelSpans[level + 1]) level++
  return level
}

function indexAt(item, level) {
  return (item.indices[level] ??= farIndices(item.g, gridSizes[level], item.glow, item.surface))
}

function districts(items, width) {
  const groups = new Map()
  for (const item of items) {
    const col = Math.floor(item.mid.x / width + 0.41)
    const row = Math.floor(item.mid.z / width + 0.48)
    const key = col * 65536 + row
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  return groups.values()
}

export function scenicDetail(statics) {
  statics.updateMatrixWorld(true)
  const materials = new Map()
  const roots = []
  const empty = new T.BufferGeometry()
  const cached = new Map()
  let cacheBytes = 0

  function record(o, gate = 0, split = true) {
    const g = o.geometry
    const mat = o.material
    if (
      !o.visible ||
      !o.isMesh ||
      o.isInstancedMesh ||
      o.isSkinnedMesh ||
      !g?.index ||
      !mat?.isMeshStandardMaterial ||
      (mat.transparent && mat.name !== '坊间透绢') ||
      mat.userData.collisionOnly ||
      g.groups.length ||
      !o.matrixWorld.equals(identity) ||
      !g.attributes.normal ||
      !g.attributes.color ||
      !g.attributes.uv ||
      Object.keys(g.attributes).length !== 4 ||
      Object.keys(g.morphAttributes).length ||
      Object.values(g.attributes).some((a) => !a.array || a.normalized)
    )
      return

    if (!g.boundingBox) g.computeBoundingBox()
    const bounds = g.boundingBox
    const size = bounds.getSize(new T.Vector3())
    const width = Math.max(size.x, size.z)
    if (split && !gate && width > 88 && g.index.count > 4400) {
      const parts = spatialSections(g, 55, 1466)
      if (parts.length > 1) {
        // Navigation and rainfall keep their original continuous terrain. These
        // smaller render bounds let the opposite hillside choose its own detail.
        o.visible = false
        for (const section of parts) {
          const mesh = new T.Mesh(section, mat)
          mesh.receiveShadow = o.receiveShadow
          mesh.castShadow = o.castShadow
          mesh.renderOrder = o.renderOrder
          mesh.layers.mask = o.layers.mask
          mesh.userData = { ...o.userData, noCollision: true, noWeather: true }
          statics.add(mesh)
          record(mesh, 0, false)
        }
        return
      }
    }
    const glow =
      /lantern|paper|window|screen|sign|lamp|绢|窗|灯|金字/i.test(mat.name) ||
      (mat.emissiveIntensity > 0.24 && mat.emissive.getHex() > 0 && mat.userData.cast === false)
    const surface =
      o.userData.terrainHull ||
      /limestone|gorge|karst|cityPlinth|quayPaving|laneBrickwork|upperGardens/i.test(mat.name)
    const item = {
      o,
      g,
      bounds,
      glow,
      surface,
      gate,
      mid: bounds.getCenter(new T.Vector3()),
      levels: [g],
      indices: [g.index.array],
    }
    if (width > 190) {
      roots.push(item)
      return
    }
    const key = [mat.id, o.layers.mask, o.castShadow, o.receiveShadow, o.renderOrder].join('/')
    if (!materials.has(key)) materials.set(key, [])
    materials.get(key).push(item)
  }

  for (const o of [...statics.children]) {
    if (o.isMesh) record(o)
    else if (o.isLOD && o.levels.length === 2) {
      // Use the artist's distant tower model beyond its original switch.
      // Its near storeys and the shops' walk-in interior LODs stay independent.
      const far = o.levels[1]
      if (far.object.isGroup && far.object.children.length)
        far.object.traverse((child) => {
          if (child.isMesh) record(child, far.distance * (1 + far.hysteresis) + 8)
        })
    }
  }

  function pack(items, depth) {
    if (items.length === 1) return items[0]
    const children =
      depth + 1 < districtWidths.length
        ? Array.from(districts(items, districtWidths[depth + 1]), (list) => pack(list, depth + 1))
        : items
    if (children.length === 1) return children[0]
    const bounds = new T.Box3()
    let gate = 0
    for (const item of items) {
      bounds.union(item.bounds)
      gate = Math.max(gate, item.gate)
    }
    const first = items[0].o
    const proxy = new T.Mesh(empty, first.material)
    proxy.name = '远景 ' + first.material.name
    proxy.layers.mask = first.layers.mask
    proxy.renderOrder = first.renderOrder
    proxy.castShadow = first.castShadow
    proxy.receiveShadow = first.receiveShadow
    proxy.visible = false
    proxy.userData.noCollision = true
    proxy.userData.noWeather = true
    statics.add(proxy)
    return {
      bounds,
      gate,
      minimum: batchLevels[depth],
      items,
      children,
      proxy,
      glow: items[0].glow,
      cache: new Map(),
      active: false,
    }
  }

  for (const list of materials.values()) {
    for (const zone of districts(list, districtWidths[0])) roots.push(pack(zone, 0))
  }
  const lastEye = new T.Vector3(Infinity, 0, 0)
  const lastRotation = new T.Quaternion()
  let movedAt = -Infinity

  function hide(node) {
    if (node.o) {
      node.o.visible = false
      return
    }
    node.proxy.visible = false
    node.active = false
    for (const child of node.children) hide(child)
  }

  function release(geometry, entry) {
    if (entry.node.proxy.geometry === geometry) entry.node.proxy.geometry = empty
    entry.node.cache.delete(entry.variant)
    cached.delete(geometry)
    cacheBytes -= entry.bytes
    geometry.dispose()
  }

  function choose(node, eye, scale) {
    const distance = node.bounds.distanceToPoint(eye)
    const level = levelAt(distance * scale)
    if (node.o) {
      const geometry = (node.levels[level] ??= indexView(node.g, indexAt(node, level)))
      node.o.geometry = geometry
      node.o.visible = geometry.index.count > 0
      return
    }
    if (level < node.minimum || distance < node.gate) {
      node.proxy.visible = false
      node.active = false
      for (const child of node.children) choose(child, eye, scale)
      return
    }
    // Silk lanterns, window art and signage keep their luminous silhouette and
    // UVs at all distances, so one merged buffer serves all their levels.
    const variant = node.glow ? 0 : level
    let geometry = node.cache.get(variant)
    if (!geometry) {
      const pieces = node.items.map((item) => [item.g, indexAt(item, variant)])
      geometry = combineGeometry(pieces, node.bounds)
      const bytes = Object.values(geometry.attributes).reduce(
        (sum, attr) => sum + attr.array.byteLength,
        geometry.index.array.byteLength
      )
      cached.set(geometry, { node, variant, bytes })
      cacheBytes += bytes
      node.cache.set(variant, geometry)
      if (node.cache.size > 2) {
        const oldest = node.cache.values().next().value
        release(oldest, cached.get(oldest))
      }
    } else if (!node.active || node.proxy.geometry !== geometry) {
      const entry = cached.get(geometry)
      cached.delete(geometry)
      cached.set(geometry, entry)
    }
    if (!node.active) {
      for (const child of node.children) hide(child)
      node.active = true
    }
    node.proxy.geometry = geometry
    node.proxy.visible = geometry.index.count > 0
  }

  function update(camera, height, small) {
    const now = performance.now()
    const eye = camera.position
    if (
      Number.isFinite(lastEye.x) &&
      (lastEye.distanceToSquared(eye) > 0.0001 || lastRotation.angleTo(camera.quaternion) > 0.0003)
    )
      movedAt = now
    lastEye.copy(eye)
    lastRotation.copy(camera.quaternion)
    const focus = height / (2 * Math.tan((camera.fov * Math.PI) / 360))
    const moving = now - movedAt < 235
    const scale =
      ((small ? 1.46 : 1.13) * (moving ? 1.41 : 1) * (camera.aspect < 0.82 ? 1.17 : 1)) / focus
    for (const root of roots) choose(root, eye, scale)
    // Touring several valleys must not retain all their historical GPU buffers.
    if (cacheBytes > cacheBudget) {
      for (const [geometry, entry] of cached) {
        if (!entry.node.proxy.visible || entry.node.proxy.geometry !== geometry) release(geometry, entry)
        if (cacheBytes <= cacheBudget) break
      }
    }
  }
  return { update }
}
