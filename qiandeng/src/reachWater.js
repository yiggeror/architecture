import * as T from 'three'

// Centreline stations carry the changing half-width of the lower river. Both
// western tributaries and the long eastern bend join at one water level.
const channels = [
  [
    [-246, 320, 84],
    [-125, 229, 78],
    [2, 143, 79],
    [77, 90, 43],
    [96, 27, 31],
    [92, -52, 33],
    [71, -127, 56],
    [13, -174, 65],
    [-23, -227, 58],
    [12, -301, 62],
    [48, -352, 49],
    [103, -403, 49],
    [116, -475, 64],
    [149, -535, 58],
    [200, -618, 71],
    [299, -696, 65],
  ],
  [
    [-137, 177, 52],
    [-90, 99, 42],
    [-84, 28, 32],
    [-89, -51, 30],
    [-87, -111, 34],
    [-65, -152, 36],
    [6, -185, 47],
  ],
  [
    [98, -225, 34],
    [159, -250, 36],
    [213, -281, 37],
    [211, -339, 31],
    [182, -382, 32],
    [110, -414, 40],
  ],
]
const level = -16

function ribbonStations(stations) {
  const path = new T.CatmullRomCurve3(stations.map(([x, z, w]) => new T.Vector3(x, w, z)))
  return path.getPoints((stations.length - 1) * 5)
}

export function lowerRiver() {
  const ribbons = channels.map(ribbonStations)
  function coverage(x, z) {
    let inside = -80,
      fade = 0
    for (const line of ribbons) {
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1],
          b = line[i],
          dx = b.x - a.x,
          dz = b.z - a.z
        const t = T.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1)
        const dist = Math.hypot(x - a.x - dx * t, z - a.z - dz * t)
        const width = T.MathUtils.lerp(a.y, b.y, t)
        const depth = width - dist
        if (depth <= -14) continue
        const along = (i - 1 + t) / (line.length - 1)
        const sourceFade =
          line === ribbons[0]
            ? T.MathUtils.smoothstep(along, 0, 0.1) * (1 - T.MathUtils.smoothstep(along, 0.9, 1))
            : 1
        inside = Math.max(inside, depth)
        fade = Math.max(fade, sourceFade * T.MathUtils.smoothstep(depth, -11, 18))
      }
    }
    return { inside, fade }
  }
  const vertices = [],
    ink = [],
    ix = [],
    vertexIndex = new Map(),
    patches = new Map()
  const loX = -338,
    loZ = -774,
    pitch = 8,
    nx = 92,
    nz = 150
  const corners = Array.from({ length: (nx + 1) * (nz + 1) }, (_, k) => {
    const x = loX + (k % (nx + 1)) * pitch,
      z = loZ + Math.floor(k / (nx + 1)) * pitch
    return coverage(x, z)
  })
  function put(k) {
    if (vertexIndex.has(k)) return vertexIndex.get(k)
    const x = loX + (k % (nx + 1)) * pitch,
      z = loZ + Math.floor(k / (nx + 1)) * pitch
    vertexIndex.set(k, ink.length)
    ink.push(corners[k].fade)
    vertices.push(x, -z, 0)
    return ink.length - 1
  }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * (nx + 1) + i,
        quad = [k, k + 1, k + nx + 2, k + nx + 1]
      if (!quad.some((v) => corners[v].inside > -6 && corners[v].fade > 0.007)) continue
      const [a, b, c, d] = quad.map(put)
      ix.push(a, d, c, a, c, b)
      const key = (i >> 3) + ':' + (j >> 3)
      if (!patches.has(key)) patches.set(key, new T.Box3())
      patches.get(key).expandByPoint(new T.Vector3(loX + i * pitch, level - 0.1, loZ + j * pitch))
      patches.get(key).expandByPoint(new T.Vector3(loX + (i + 1) * pitch, level + 0.1, loZ + (j + 1) * pitch))
    }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('shore', new T.Float32BufferAttribute(ink, 1))
  geometry.setIndex(ix)
  return { geometry, point: [0, level, 0], wide: true, patches: [...patches.values()] }
}
