import { cross, generator, sub, unit } from './mesh.js'
import {
  LandBatch,
  blend,
  hash,
  landFinishes,
  limit,
  mix,
  noise,
  panel,
  rgb,
  smooth,
  tau,
  tint,
  top,
} from './land-kit.js'
import { civicStones, carvedCliff } from './land-stone.js'
import { distantRanges, plantedShoulders } from './land-garden.js'
import { createFalls } from './land-falls.js'

export const landBounds = { river: { west: -17, east: 17, north: -66, south: 88, level: 0 }, terrace: 1.35 }
const deck = landBounds.terrace
const hills = [
  [-68, -88, 8.6, 12.0, 13.2],
  [-74, -46, 9.9, 16.1, 18.5],
  [-70, 16, 12, 22, 12.0],
  [-72, 60, 10.4, 15, 9.2],
  [71, -104, 8.8, 16, 12],
  [72, -59, 9, 20, 13.8],
  [72, 3, 8, 17.5, 12.6],
  [70, 47, 10, 21, 10.4],
  [-44, -134, 17.0, 9.0, 9.7],
  [40, -132, 20, 9, 11.3],
  [-40, 97, 13, 6, 5.7],
  [44, 96, 15, 7, 6.4],
]
function chart(u, v) {
  const s = Math.sign(u),
    w = smooth(60, 80, Math.abs(u))
  const x =
    u +
    s *
      w *
      (3.7 * Math.sin(v * 0.091 + s * 1.4) +
        4.0 * Math.cos(v * 0.046 - 0.4 * s) +
        3.1 * Math.sin(v * 0.163 - 1.1 * s))
  let z = v
  if (v < -122) {
    const f = (-122 - v) / 20
    z = -122 - f * (17.8 + 5.4 * Math.cos(u * 0.087) + 4.0 * Math.sin(u * 0.172 + 0.7))
  } else if (v > 86) {
    const f = (v - 86) / 16
    z =
      86 +
      f * (2 + smooth(17, 39, Math.abs(u)) * (13.6 + 4.8 * Math.cos(u * 0.13) + 2.5 * Math.sin(u * 0.27)))
  }
  return [x, z]
}
function dryGrade(x, z) {
  const k = Math.max(
    smooth(60, 70, Math.abs(x)),
    smooth(-122, -133, z),
    smooth(86, 97, z) * smooth(18, 34, Math.abs(x))
  )
  if (k === 0) return deck
  let main = 0,
    rest = 0
  for (const [a, b, w, d, h] of hills) {
    const dx = (x - a) / w,
      dz = (z - b) / d
    const v = h * Math.exp(-(dx * dx + dz * dz) * 0.9)
    main = Math.max(main, v)
    rest += v
  }
  const relief = (noise(x * 0.107, z * 0.107, 25) - 0.5) * 2.4 + (noise(x * 0.046, z * 0.046, 12) - 0.5) * 2.8
  const raw = 0.88 + main * 0.82 + rest * 0.18 + relief
  const f = raw * 0.55 + 0.33 * Math.sin(0.21 * x + 0.11 * z),
    phase = f - Math.floor(f)
  return deck + k * (raw + 0.77 * (smooth(0.29, 0.73, phase) - phase))
}
export function terraceHeight(x, z) {
  if (Math.abs(x) < 17 && z > -66 && z <= 88) return null
  if (Math.abs(x) > 60 || z < -122 || z > 86) {
    if (x < -93 || x > 93 || z < -153 || z > 111) return null
    let inside = false,
      boundary = false
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i],
        c = outline[(i + 1) % outline.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1]
      const area = dx * (z - a[1]) - dz * (x - a[0])
      if (
        Math.abs(area) < 1e-7 &&
        x >= Math.min(a[0], c[0]) - 1e-8 &&
        x <= Math.max(a[0], c[0]) + 1e-8 &&
        z >= Math.min(a[1], c[1]) - 1e-8 &&
        z <= Math.max(a[1], c[1]) + 1e-8
      )
        boundary = true
      if (a[1] > z !== c[1] > z && x < a[0] + (dx * (z - a[1])) / dz) inside = !inside
    }
    if (!inside && !boundary) return null
  }
  return dryGrade(x, z)
}
function bed(x, z) {
  const t = 1 - Math.pow(Math.abs(x / 17), 2.5)
  const head = smooth(-66, -60, z),
    lip = smooth(75, 88, z)
  return -1.62 - 1.08 * t * head + 0.25 * Math.sin(0.12 * z + 0.27 * x) * t + 0.87 * lip
}
const stoneColors = [0x526771, 0x667c7b, 0x485763, 0x7d7d71, 0x8a7466, 0x536d65].map(rgb)
const townColors = [0x808680, 0xa09b88, 0x818e88, 0x7b827e].map(rgb)
const gardenColors = [0x516e57, 0x788267, 0x657b6a, 0x90896d].map(rgb)
const strata = [
  [0, 1],
  [1.7, 1.001],
  [3.8, 0.989],
  [5.2, 0.994],
  [6.6, 0.978],
  [9.3, 0.969],
  [11.0, 0.968],
  [13.5, 0.949],
  [18, 0.926],
  [22, 0.886],
  [26.0, 0.86],
  [30.5, 0.797],
  [34.8, 0.705],
  [38.2, 0.57],
  [39.8, 0.415],
  [40.6, 0.275],
  [41.1, 0.138],
  [41.7, 0.055],
]
const azimuth = (p) => Math.atan2((p[2] + 15) / 112, p[0] / 78)
function rimNoise(a, count, seed) {
  const u = ((a / tau + 2) % 1) * count,
    i = Math.floor(u)
  return mix(hash(i % count, 0, seed), hash((i + 1) % count, 0, seed), smooth(0, 1, u - i)) * 2 - 1
}
function rootRibs(x, z) {
  const a = Math.abs(x - 0.35 * z - 7 * Math.sin(z * 0.065) + 6)
  const b = Math.abs(z + 0.45 * x - 4.0 * Math.sin(x * 0.17) + 19)
  const c = Math.abs(x + 0.49 * z + 3.9 * Math.cos(z * 0.135) - 24)
  return 7.5 * Math.exp(-a / 5.6) + 5.3 * Math.exp(-b / 3.9) + 3.8 * Math.exp(-c / 4.7)
}
function rockChart(p, level) {
  if (level === 0) return p
  const [depth, scale] = strata[level],
    a = azimuth(p),
    near = rimNoise(a, 16, 8)
  const end = rimNoise(a, 36, 13),
    high = rimNoise(a, 57, 14)
  const toe = smooth(4, 30, depth) * (1 - smooth(34, 41.5, depth))
  const hang = Math.max(0, near + 0.4 * end)
  const exposure = 0.18 + 0.82 * smooth(-0.48, 0.76, near + 0.35 * end)
  const plain = depth < 20 ? 1 - 0.00435 * depth : scale
  const ripple =
    (0.046 * end + 0.019 * high) * Math.sin(Math.PI * (1 - scale)) +
    0.04 * smooth(1.2, 12, depth) * (1 - smooth(29, 41, depth)) * rimNoise(a + 0.008 * depth, 18, 32)
  const r = mix(plain, scale, exposure) + ripple
  const lean = 1 - r,
    warp = 0.022 * Math.sin(3 * a + 0.138 * depth) * smooth(0, 9, depth)
  const x = p[0] * r - (p[2] + 15) * warp + 5.1 * lean * lean
  const z = -15 + (p[2] + 15) * r + p[0] * warp - 4.3 * lean * lean
  const band =
    (1 - Math.exp(-0.24 * depth)) * (1 - smooth(23, 40, depth)) * (2.3 * Math.sin(a * 4 + 0.46) + 1.7 * end)
  const y =
    p[1] * (1 - smooth(0, 15, depth)) -
    depth * (1 + 0.12 * near + 0.083 * end + 0.024 * high) -
    band -
    toe * 9.5 * hang
  return [
    x,
    mix(y, -40.9 - 0.42 * (depth - 40), 0.94 * smooth(37.6, 41.7, depth)) -
      smooth(22, 36.6, depth) * rootRibs(x, z),
    z,
  ]
}
function rockColor(p, j) {
  const a = azimuth(p),
    d = strata[j][0],
    n = rimNoise(a + 0.006 * d, 13, 1),
    vein = rimNoise(a - 0.009 * d, 22, 16)
  let c = blend(stoneColors[0], stoneColors[3], limit(0.42 + 0.37 * n + 0.22 * vein))
  c = blend(c, stoneColors[4], 0.48 * smooth(0.23, 0.88, rimNoise(a + 0.002 * d, 10, 37)))
  if (j < 3) c = blend(c, stoneColors[5], 0.24)
  if (j > 12) c = blend(c, stoneColors[2], 0.22)
  return tint(c, 0.97 + 0.1 * vein + ([2, 5, 10].includes(j) ? 0.045 : 0))
}
function colorsAt(p, wet, inside) {
  const [x, y, z] = p,
    n = noise(x * 0.079, z * 0.079, 12),
    i = noise(x * 0.037, z * 0.037, 9)
  if (wet) return blend(rgb(0x465e5a), rgb(0x748276), 0.34 * n + 0.42 * i + 0.09 * (y + 2))
  if (inside) return blend(townColors[0], townColors[1], 0.16 + 0.64 * n)
  const c = blend(gardenColors[0], gardenColors[1], smooth(0.24, 0.79, n))
  const slope =
    Math.hypot(dryGrade(x + 0.55, z) - dryGrade(x - 0.55, z), dryGrade(x, z + 0.55) - dryGrade(x, z - 0.55)) /
    1.1
  const bare = limit(0.49 * smooth(0.28, 0.86, slope) + 0.29 * smooth(4, 14, y) + 0.17 * i)
  return blend(c, blend(stoneColors[1], stoneColors[3], n), bare)
}
function ticks(bounds, step) {
  const vals = [bounds[0]]
  for (let i = 1; i < bounds.length; i++) {
    const count = Math.ceil((bounds[i] - bounds[i - 1]) / step)
    for (let j = 1; j <= count; j++)
      vals.push(j === count ? bounds[i] : mix(bounds[i - 1], bounds[i], j / count))
  }
  return vals
}
const xs = ticks(
  [-80, -72, -66, -60, -50, -46, -32.8, -22, -17, 0, 17, 22, 32.8, 46, 50, 60, 66, 72, 80],
  3.4
)
const zs = ticks([-142, -132, -122, -110, -90, -66, -55, -33, -18, -9, 1, 14, 34, 53, 68, 81, 86, 102], 3.3)
const outline = [
  ...xs.map((u) => chart(u, zs[0])),
  ...zs.slice(1).map((v) => chart(xs.at(-1), v)),
  ...xs
    .slice(0, -1)
    .reverse()
    .map((u) => chart(u, zs.at(-1))),
  ...zs
    .slice(1, -1)
    .reverse()
    .map((v) => chart(xs[0], v)),
]
function sectionNode(i, j, wet) {
  const [x, z] = chart(xs[i], zs[j])
  return [x, wet ? bed(x, z) : dryGrade(x, z), z]
}
const wetCell = (i, j) =>
  i >= 0 &&
  i < xs.length - 1 &&
  j >= 0 &&
  j < zs.length - 1 &&
  xs[i] >= -17 &&
  xs[i + 1] <= 17 &&
  zs[j] >= -66
function hull(batch, m) {
  const nodes = Array.from({ length: xs.length }, (_, i) =>
    Array.from({ length: zs.length }, (_, j) => [sectionNode(i, j, false), sectionNode(i, j, true)])
  )
  const vertex = (i, j, w) => nodes[i][j][+w]
  const nx = xs.length - 1,
    nz = zs.length - 1
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const wet = wetCell(i, j)
      const v = [vertex(i, j, wet), vertex(i, j + 1, wet), vertex(i + 1, j + 1, wet), vertex(i + 1, j, wet)]
      const town = xs[i] >= -60 && xs[i + 1] <= 60 && zs[j] >= -122 && zs[j + 1] <= 86
      const mat = wet ? m.riverSilt : town ? m.cityPlinth : m.upperGardens
      const colors = v.map((p) => colorsAt(p, wet, town))
      const norms = v.map(([x, y, z]) =>
        wet
          ? unit([bed(x - 0.3, z) - bed(x + 0.3, z), 0.6, bed(x, z - 0.3) - bed(x, z + 0.3)])
          : unit([
              dryGrade(x - 0.16, z) - dryGrade(x + 0.16, z),
              0.32,
              dryGrade(x, z - 0.16) - dryGrade(x, z + 0.16),
            ])
      )
      panel(batch, mat, v, colors, null, norms)
      if (!wet) continue
      for (const [ix, jz, kx, kz, needs] of [
        [i, j, i, j + 1, i > 0 && !wetCell(i - 1, j)],
        [i + 1, j + 1, i + 1, j, i < nx - 1 && !wetCell(i + 1, j)],
        [i + 1, j, i, j, j > 0 && !wetCell(i, j - 1)],
      ]) {
        if (!needs) continue
        const p = vertex(ix, jz, true),
          q = vertex(kx, kz, true),
          a = vertex(ix, jz, false),
          c = vertex(kx, kz, false)
        const wall = [q, p, a, c]
        const col = wall.map((w) => blend(stoneColors[1], townColors[1], smooth(-0.32, 1.35, w[1]) * 0.53))
        const horizontal = a[0] === c[0] ? 2 : 0
        panel(
          batch,
          m.cityPlinth,
          wall,
          col,
          wall.map((v) => [v[horizontal], v[1]])
        )
      }
    }
  // Perimeter traverses the north shoulder clockwise, walks down both river
  // wall ends, and includes the sunken riverbed across the southern lip.
  const rim = []
  const append = (v) => {
    if (!rim.length || Math.hypot(...sub(v, rim.at(-1))) > 1e-7) rim.push(v)
  }
  const side = (indices, wet) => {
    for (const [i, j] of indices) append(vertex(i, j, wet))
  }
  for (let i = 0; i < nx; i++)
    side(
      [
        [i, 0],
        [i + 1, 0],
      ],
      false
    )
  for (let j = 0; j < nz; j++)
    side(
      [
        [nx, j],
        [nx, j + 1],
      ],
      false
    )
  for (let i = nx; i > 0; i--)
    side(
      [
        [i, nz],
        [i - 1, nz],
      ],
      wetCell(i - 1, nz - 1)
    )
  for (let j = nz; j > 0; j--)
    side(
      [
        [0, j],
        [0, j - 1],
      ],
      false
    )
  rim.pop()
  const columns = rim.map((p) => ({ p, g: strata.map((_, i) => rockChart(p, i)) }))
  let arc = 0
  for (let i = 0; i < columns.length; i++) {
    columns[i].s = arc
    arc += Math.hypot(...sub(columns[i].p, columns[(i + 1) % columns.length].p))
  }
  for (let i = 0; i < columns.length; i++) {
    const a = columns[i],
      c = columns[(i + 1) % columns.length],
      prev = columns[(i - 1 + columns.length) % columns.length],
      next = columns[(i + 2) % columns.length]
    for (let j = 0; j < strata.length - 1; j++) {
      const points = [a.g[j], c.g[j], c.g[j + 1], a.g[j + 1]]
      const normal = (row, before, after, k) => {
        const k0 = Math.max(0, k - 1),
          k1 = Math.min(strata.length - 1, k + 1)
        const across = sub(after.g[k], before.g[k]),
          down = sub(row.g[k1], row.g[k0])
        const averaged = unit(cross(across, down)),
          face = unit(cross(sub(points[1], points[0]), sub(points[3], points[0])))
        return unit(blend(face, averaged, 0.42 + 0.31 * smooth(19, 34, strata[k][0])))
      }
      const colors = [rockColor(a.p, j), rockColor(c.p, j), rockColor(c.p, j + 1), rockColor(a.p, j + 1)]
      const u2 = i === columns.length - 1 ? arc : c.s
      const uv =
        j < 12
          ? [
              [a.s, points[0][1]],
              [u2, points[1][1]],
              [u2, points[2][1]],
              [a.s, points[3][1]],
            ]
          : points.map(([x, y, z]) => [x + 0.19 * z, z - 0.22 * x + 0.15 * y])
      panel(batch, m.gorgeRock, points, colors, uv, [
        normal(a, prev, c, j),
        normal(c, a, next, j),
        normal(c, a, next, j + 1),
        normal(a, prev, c, j + 1),
      ])
    }
  }
  const core = [5.1, -41.9 - rootRibs(5.1, -19.3), -19.3]
  for (let i = 0; i < columns.length; i++) {
    const ps = [columns[i].g.at(-1), columns[(i + 1) % columns.length].g.at(-1), core],
      col = stoneColors[1]
    panel(batch, m.gorgeRock, ps, [col, col, col], null, [
      [0, -1, 0],
      [0, -1, 0],
      [0, -1, 0],
    ])
  }
  return { columns, arc, rockColor, core }
}
export function land(b, m, world) {
  landFinishes(m)
  const batch = new LandBatch(b.scene)
  const ledge = hull(batch, m),
    first = b.scene.children.length
  batch.finish()
  b.scene.children.slice(first).forEach((o) => (o.userData.terrainHull = true))
  civicStones(batch, m)
  const sample = carvedCliff(batch, m, ledge)
  plantedShoulders(batch, m, dryGrade, world, sample, ledge.arc)
  batch.finish()
  distantRanges(b.scene, m)
}
export function landMotion(scene) {
  const sources = [
    [-1, -51.5, 36, 2.15],
    [1, 29, 41, 2.7],
    [-1, 65.1, 24, 1.5],
  ].map(([sign, v, drop, width]) => {
    const path = []
    for (let i = 0; i <= 12; i++) {
      const t = i / 12,
        [x, z] = chart(sign * mix(74.5, 80, t), v + 0.88 * Math.sin(t * Math.PI * 1.6))
      path.push([x, dryGrade(x, z) + 0.072, z])
    }
    return [path, drop, width]
  })
  return createFalls(scene, sources)
}
