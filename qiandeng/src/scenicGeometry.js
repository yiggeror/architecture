import * as T from 'three'

// The full positions also drive navigation and rainfall. A distant view only
// needs a different index, so approaching the building recovers the exact mesh.
export function farIndices(geometry, cell, glow, surface) {
  const source = geometry.index?.array
  if (!source || !cell || glow) return source
  const positions = geometry.attributes.position.array,
    grid = new Int32Array(positions.length),
    inv = 1 / cell
  for (let i = 0; i < positions.length; i++) grid[i] = Math.round(positions[i] * inv)
  const out = new source.constructor(source.length),
    normLimit = cell * cell * 0.1
  let size = 0
  for (let i = 0; i < source.length; i += 3) {
    const a = source[i],
      b = source[i + 1],
      c = source[i + 2],
      o = a * 3,
      j = b * 3,
      k = c * 3
    const dx = grid[j] - grid[o],
      dy = grid[j + 1] - grid[o + 1],
      dz = grid[j + 2] - grid[o + 2]
    const ex = grid[k] - grid[o],
      ey = grid[k + 1] - grid[o + 1],
      ez = grid[k + 2] - grid[o + 2]
    // An entire face on a street grille or the end cap of a beam may cover
    // less than one pixel while its long sides still describe the silhouette.
    if (dy * ez === dz * ey && dz * ex === dx * ez && dx * ey === dy * ex) continue
    if (!surface) {
      const u = positions[j] - positions[o],
        v = positions[j + 1] - positions[o + 1],
        w = positions[j + 2] - positions[o + 2]
      const x = positions[k] - positions[o],
        y = positions[k + 1] - positions[o + 1],
        z = positions[k + 2] - positions[o + 2]
      const p = v * z - w * y,
        q = w * x - u * z,
        r = u * y - v * x,
        area = p * p + q * q + r * r
      const len = Math.max(
        u * u + v * v + w * w,
        x * x + y * y + z * z,
        (x - u) ** 2 + (y - v) ** 2 + (z - w) ** 2
      )
      if (area < normLimit * len) continue
    }
    out[size++] = a
    out[size++] = b
    out[size++] = c
  }
  return size > source.length * 0.94 ? source : out.slice(0, size)
}
export function indexView(original, indices) {
  if (!indices || indices === original.index.array) return original
  const g = new T.BufferGeometry()
  for (const [key, attr] of Object.entries(original.attributes)) g.setAttribute(key, attr)
  g.setIndex(new T.BufferAttribute(indices, 1))
  g.boundingBox = original.boundingBox
  g.boundingSphere = original.boundingSphere
  return g
}

// Merge the surviving world-space vertices of one material once per district.
// A shared material preserves the original normal map, emitted silk map and UVs.
export function combineGeometry(parts, bounds, workspace) {
  let vertices = 0,
    indexCount = 0
  const pieces = []
  for (const [geometry, index] of parts) {
    const src = geometry.attributes.position,
      remap = workspace ?? new Uint32Array(src.count),
      local = new Uint32Array(Math.min(index.length, src.count))
    let used = 0
    for (const old of index) {
      if (remap[old] === 0) {
        remap[old] = vertices + used + 1
        local[used++] = old
      }
    }
    if (!used) continue
    pieces.push({ geometry, index, remap, local, used, base: vertices })
    vertices += used
    indexCount += index.length
  }
  const result = new T.BufferGeometry(),
    ix = vertices > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount)
  if (!vertices) {
    result.setAttribute('position', new T.Float32BufferAttribute([], 3))
    result.setIndex(new T.BufferAttribute(ix, 1))
    return result
  }
  for (const key of ['position', 'normal', 'color', 'uv']) {
    const source = pieces[0].geometry.getAttribute(key),
      stride = source.itemSize,
      dest = new Float32Array(vertices * stride)
    for (const { geometry, local, used, base } of pieces) {
      const data = geometry.getAttribute(key).array
      let write = base * stride
      for (let i = 0; i < used; i++) {
        const start = local[i] * stride
        for (let j = 0; j < stride; j++) dest[write++] = data[start + j]
      }
    }
    result.setAttribute(key, new T.BufferAttribute(dest, stride))
  }
  let ptr = 0
  for (const { index, remap } of pieces)
    for (let i = 0; i < index.length; i++) ix[ptr++] = remap[index[i]] - 1
  // Only spatialSections supplies a workspace. Reuse a map of the original
  // hillside's vertices without clearing the whole array for each small tile.
  if (workspace)
    for (const { local, used } of pieces) for (let i = 0; i < used; i++) workspace[local[i]] = 0
  result.setIndex(new T.BufferAttribute(ix, 1))
  result.boundingBox = bounds
  result.boundingSphere = new T.Sphere()
  bounds.getBoundingSphere(result.boundingSphere)
  return result
}

// Distant trees, street blocks and terraces often share one finish across
// several hills. Keep mesh bounds local, independent of the material extent.
export function spatialSections(geometry, cell, minFaces = 4200) {
  const ix = geometry.index.array,
    position = geometry.attributes.position.array
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  if (!geometry.boundingSphere)
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new T.Sphere())
  const size = geometry.boundingBox.getSize(new T.Vector3())
  if (ix.length < minFaces * 3 || Math.max(size.x, size.z) < cell * 1.3) return [geometry]
  const sectors = new Map(),
    inv = 1 / (3 * cell)
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix[i] * 3,
      b = ix[i + 1] * 3,
      c = ix[i + 2] * 3
    const col = Math.floor((position[a] + position[b] + position[c]) * inv + 0.43),
      row = Math.floor((position[a + 2] + position[b + 2] + position[c + 2]) * inv + 0.54)
    const key = col * 65536 + row
    let s = sectors.get(key)
    if (!s) {
      s = { index: [], lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] }
      sectors.set(key, s)
    }
    s.index.push(ix[i], ix[i + 1], ix[i + 2])
    for (let d = 0; d < 3; d++) {
      s.lo[d] = Math.min(s.lo[d], position[a + d], position[b + d], position[c + d])
      s.hi[d] = Math.max(s.hi[d], position[a + d], position[b + d], position[c + d])
    }
  }
  if (sectors.size < 2) return [geometry]
  const result = [],
    workspace = new Uint32Array(geometry.attributes.position.count)
  for (const { index, lo, hi } of sectors.values()) {
    const bounds = new T.Box3(new T.Vector3(...lo), new T.Vector3(...hi))
    result.push(combineGeometry([[geometry, index]], bounds, workspace))
  }
  return result
}
