import * as T from 'three'

// Collapse subpixel battens, tassels and tiles to the same world grid in
// adjacent batches. Surviving faces retain their artwork and vertex normals.
function reduced(original, cell) {
  const source = original.attributes.position,
    index = original.index?.array
  if (!index || index.length < 2200) return original
  const pos = source.array,
    loc = new Int32Array(source.count),
    grid = new Int32Array(pos.length)
  for (let i = 0; i < source.count; i++) {
    const k = i * 3,
      x = Math.round(pos[k] / cell),
      y = Math.round(pos[k + 1] / cell),
      z = Math.round(pos[k + 2] / cell)
    grid[k] = x
    grid[k + 1] = y
    grid[k + 2] = z
    loc[i] = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)
  }
  const wanted = []
  for (let k = 0; k < index.length; k += 3) {
    const a = index[k],
      b = index[k + 1],
      c = index[k + 2]
    if (loc[a] === loc[b] || loc[a] === loc[c] || loc[b] === loc[c]) continue
    const aa = a * 3,
      bb = b * 3,
      cc = c * 3
    const x = grid[bb] - grid[aa],
      y = grid[bb + 1] - grid[aa + 1],
      z = grid[bb + 2] - grid[aa + 2]
    const u = grid[cc] - grid[aa],
      v = grid[cc + 1] - grid[aa + 1],
      w = grid[cc + 2] - grid[aa + 2]
    if (y * w === z * v && z * u === x * w && x * v === y * u) continue
    wanted.push(a, b, c)
  }
  if (wanted.length > index.length * 0.81) return original
  const g = new T.BufferGeometry(),
    used = new Map(),
    ix = [],
    positions = []
  for (const vertex of wanted) {
    let local = used.get(vertex)
    if (local === undefined) {
      local = used.size
      used.set(vertex, local)
      const n = vertex * 3
      // Only the fine elements have collapsed. Use the common grid on their edges
      // so a far column remains a continuous column around its full silhouette.
      positions.push(grid[n] * cell, grid[n + 1] * cell, grid[n + 2] * cell)
    }
    ix.push(local)
  }
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  for (const [name, attr] of Object.entries(original.attributes)) {
    if (name === 'position') continue
    const arr = new Float32Array(used.size * attr.itemSize),
      src = attr.array
    for (const [old, i] of used) {
      const stride = attr.itemSize
      for (let j = 0; j < stride; j++) arr[i * stride + j] = src[old * stride + j]
    }
    g.setAttribute(name, new T.BufferAttribute(arr, attr.itemSize))
  }
  g.setIndex(ix)
  g.boundingSphere = original.boundingSphere
  g.boundingBox = original.boundingBox
  return g
}
export function scenicDetail(statics) {
  const batches = statics.children
    .filter(
      (o) =>
        o.isMesh &&
        o.geometry?.index?.count > 2200 &&
        !o.userData.terrainHull &&
        !/mountain|limestone|gorge|pineCrown|karst/i.test(o.material.name)
    )
    .map((o) => {
      const g = o.geometry
      g.computeBoundingSphere()
      return { o, g, levels: [g], sphere: g.boundingSphere }
    })
  function update(camera, height, small) {
    const focal = height / (2 * Math.tan((camera.fov * Math.PI) / 360)),
      eye = camera.position
    for (const b of batches) {
      const d = Math.max(0, eye.distanceTo(b.sphere.center) - b.sphere.radius * 0.79),
        scale = d / focal
      const level = scale > (small ? 0.158 : 0.23) ? 2 : scale > (small ? 0.079 : 0.135) ? 1 : 0
      if (!b.levels[level]) b.levels[level] = reduced(b.g, level === 1 ? 0.112 : 0.262)
      b.o.geometry = b.levels[level]
    }
  }
  return { update }
}
