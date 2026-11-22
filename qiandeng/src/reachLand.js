import { cross, sub } from './mesh.js'
import {
  LandBatch,
  blend,
  hash,
  landFinishes,
  mix,
  noise,
  panel,
  rgb,
  smooth,
  texel,
  tint,
} from './land-kit.js'
import { rooflineSites } from './reachRooflineSites.js'
import { palaceSites, reachPoint, reachTerraces } from './reachMap.js'

const quay = [0x939e98, 0xb0afa0, 0x798e92, 0x91a49b].map(rgb)
const bed = [0x506f64, 0x728773, 0x5a7476, 0x7a8173, 0x637883, 0x8e9b9d].map(rgb)
const dark = rgb(0x44565a)
const green = rgb(0x77947f)
const groups = [...new Set(reachTerraces.map((r) => r.group))].map((name) =>
  reachTerraces.filter((r) => r.group === name).sort((a, b) => a.row - b.row)
)
const streetFlightCount = groups.reduce((n, rows) => n + rows.length - 1, 0)
function point(row, u, v, y = row.y) {
  const [x, z] = reachPoint(row, u, v)
  return [x, y, z]
}
function face(b, m, points, colors) {
  let c = Array.isArray(colors[0]) ? colors : points.map(() => colors)
  if (m.name === 'upperGardens') {
    const clipped = cutSoil(points, c)
    if (clipped) {
      for (const vs of clipped)
        cleanFace(
          b,
          m,
          vs.map((v) => v.p),
          vs.map((v) => v.c)
        )
      return
    }
  }
  cleanFace(b, m, points, c)
}
function cleanFace(b, m, points, c) {
  // Portal spandrels and mitred landings sometimes contribute collinear
  // corners. No zero normal may reach the world-space lighting program.
  if (
    points.length > 3 &&
    Math.hypot(...cross(sub(points[1], points[0]), sub(points[2], points[0]))) < 1e-7
  ) {
    const keep = points
      .map((_, i) => i)
      .filter(
        (i) =>
          Math.hypot(
            ...cross(
              sub(points[i], points[(i + points.length - 1) % points.length]),
              sub(points[(i + 1) % points.length], points[i])
            )
          ) > 1e-7
      )
    points = keep.map((i) => points[i])
    c = keep.map((i) => c[i])
  }
  if (
    points.length < 3 ||
    Math.hypot(...cross(sub(points[1], points[0]), sub(points[2], points[0]))) < 1e-7
  )
    return
  panel(b, m, points, c)
}

// A small vaulted outlet is cut through the dressed face. Its springers,
// intrados, wet sill and back are visible to someone standing below the bank.
function outlet(b, m, row, u0, u1, v, base, top, tone) {
  const at = (u, y, d = 0) => point(row, u, v + d, y)
  const mid = (u0 + u1) / 2,
    w = Math.min(1.15, (u1 - u0) * 0.24),
    h = top - base
  const floor = base + Math.min(0.35, h * 0.085),
    spring = floor + Math.min(1.05, h * 0.19),
    height = Math.min(1.65, h * 0.34)
  const sides = 8,
    arc = []
  for (let j = 0; j <= sides; j++) {
    const a = Math.PI * (1 - j / sides)
    arc.push([mid + w * Math.cos(a), spring + height * Math.sin(a)])
  }
  const L = at(u0, top),
    R = at(u1, top),
    F = arc.map(([u, y]) => at(u, y)),
    inner = arc.map(([u, y]) => at(u, y, -1.19))
  face(b, m.quayPaving, [at(u1, base), at(u0, base), at(u0, floor), at(u1, floor)], tone)
  face(b, m.quayPaving, [at(u0, floor), at(mid - w, floor), F[0], L], tone)
  face(b, m.quayPaving, [at(mid + w, floor), at(u1, floor), R, F.at(-1)], tone)
  for (let j = 0; j < sides; j++) {
    const cap = j < sides / 2 ? L : R
    face(b, m.quayPaving, [F[j], F[j + 1], cap], tone)
    face(b, m.quayCoping, [F[j], inner[j], inner[j + 1], F[j + 1]], tint(tone, 0.61))
    const a0 = Math.PI * (1 - (j + 0.035) / sides),
      a1 = Math.PI * (1 - (j + 0.965) / sides)
    const vous = (a, r) => at(mid + (w + r) * Math.cos(a), spring + (height + r) * Math.sin(a), 0.092)
    face(
      b,
      m.quayCoping,
      [vous(a0, 0), vous(a1, 0), vous(a1, 0.25), vous(a0, 0.25)],
      tint(quay[1], j % 2 ? 0.95 : 1.05)
    )
  }
  face(b, m.quayPaving, [L, F[sides / 2], R], tone)
  face(b, m.quayCoping, [at(mid - w, floor), at(mid - w, floor, -1.19), inner[0], F[0]], tone)
  face(b, m.quayCoping, [at(mid + w, floor, -1.19), at(mid + w, floor), F.at(-1), inner.at(-1)], tone)
  face(
    b,
    m.quayCoping,
    [at(mid - w, floor), at(mid + w, floor), at(mid + w, floor, -1.19), at(mid - w, floor, -1.19)],
    quay[2]
  )
  face(
    b,
    m.quayPaving,
    [at(mid - w, floor, -1.19), at(mid + w, floor, -1.19), ...inner.slice().reverse()],
    dark
  )
  for (const sign of [-1, 1]) {
    const u = mid + sign * w
    face(
      b,
      m.quayCoping,
      [
        at(u, floor, 0.09),
        at(u + sign * 0.25, floor, 0.09),
        at(u + sign * 0.25, spring, 0.09),
        at(u, spring, 0.09),
      ],
      quay[1]
    )
  }
}
function buttress(b, m, row, u, v, lo, hi, pitch) {
  const wide = pitch ? 1.03 : 0.69,
    nose = pitch ? 1.53 : 1.08
  const levels = [
    [lo + 0.08, wide, nose],
    [lo + 0.52, wide * 0.84, nose * 0.88],
    [hi - 0.7, wide * 0.57, 0.27],
    [hi - 0.45, wide * 0.67, 0.28],
  ]
  let prev
  for (const [h, w, d] of levels) {
    const ring = [
      [-w, -0.055],
      [-w, d * 0.72],
      [-w * 0.6, d],
      [w * 0.6, d],
      [w, d * 0.72],
      [w, -0.055],
    ].map(([x, z]) => point(row, u + x, v + z, h))
    if (prev)
      for (let j = 0; j < ring.length - 1; j++)
        face(
          b,
          m.quayCoping,
          [prev[j], prev[j + 1], ring[j + 1], ring[j]],
          tint(quay[2], 0.93 + 0.045 * (j % 3))
        )
    prev = ring
  }
  face(b, m.quayCoping, prev, quay[1])
}
function shelfTrim(b, m, row, base, seed) {
  const v = row.depth / 2,
    w = row.width / 2,
    d = row.y - base
  const cap = (u, y, f) => point(row, u, v + f, y)
  const slices = Math.ceil(row.width / 5.1)
  for (let j = 0; j < slices; j++) {
    const a = mix(-w, w, j / slices) + 0.008,
      c = mix(-w, w, (j + 1) / slices) - 0.008
    const tone = tint(quay[(j + seed) % 4], 0.94 + 0.15 * hash(j, seed, 13))
    face(
      b,
      m.quayCoping,
      [
        cap(a, row.y + 0.013, -0.56),
        cap(a, row.y + 0.013, 0.26),
        cap(c, row.y + 0.013, 0.26),
        cap(c, row.y + 0.013, -0.56),
      ],
      tone
    )
    if (j % 4 === 1) {
      const u = (a + c) / 2
      face(
        b,
        m.quayPaving,
        [
          cap(u - 0.3, row.y + 0.027, -0.66),
          cap(u + 0.3, row.y + 0.027, -0.66),
          cap(u + 0.3, row.y + 0.027, -0.86),
          cap(u - 0.3, row.y + 0.027, -0.86),
        ],
        dark
      )
      for (let k = -1; k <= 1; k++) {
        const x = u + k * 0.15
        face(
          b,
          m.quayCoping,
          [
            cap(x - 0.025, row.y + 0.031, -0.64),
            cap(x + 0.025, row.y + 0.031, -0.64),
            cap(x + 0.022, row.y + 0.031, -0.88),
            cap(x - 0.022, row.y + 0.031, -0.88),
          ],
          quay[1]
        )
      }
    }
  }
  face(
    b,
    m.quayCoping,
    [
      cap(-w, row.y - 0.2, 0.31),
      cap(w, row.y - 0.2, 0.31),
      cap(w, row.y + 0.013, 0.26),
      cap(-w, row.y + 0.013, 0.26),
    ],
    quay[1]
  )
  face(
    b,
    m.quayCoping,
    [
      cap(-w, row.y - 0.32, 0.05),
      cap(w, row.y - 0.32, 0.05),
      cap(w, row.y - 0.2, 0.31),
      cap(-w, row.y - 0.2, 0.31),
    ],
    quay[2]
  )
  for (let u = -w + 5.3; u < w - 4; u += 19.2 + 1.7 * hash(Math.round(u), seed, 4)) {
    buttress(b, m, row, u, v, base, row.y, Boolean(seed % 2))
  }
  if (d > 9) {
    const y = base + d * 0.49
    face(
      b,
      m.quayCoping,
      [cap(-w, y, 0.1), cap(w, y, 0.1), cap(w, y + 0.21, 0.09), cap(-w, y + 0.21, 0.09)],
      tint(quay[1], 0.85)
    )
  }
}

// Weathering exposes short, grass-topped beds on the taller end slopes.
// The rear edge is interpolated on one of the host's own triangles.
function beddingShelf(b, m, p, cx, cz, seed, trees) {
  if (Math.max(p[0][1], p[1][1]) - p[2][1] < 11 || Math.hypot(p[0][0] - p[1][0], p[0][2] - p[1][2]) < 4.3)
    return
  const f = 0.31 + 0.3 * hash(seed, 1, 82)
  const a = p[0].map((v, k) => mix(v, p[2][k], f)),
    c = p[1].map((v, k) => mix(v, p[2][k], f))
  if (Math.min(a[1], c[1]) < 0.8 || Math.abs(a[1] - c[1]) > 0.52 * Math.hypot(a[0] - c[0], a[2] - c[2]))
    return
  const out = (q, reach, dip) => {
    const x = q[0] - cx,
      z = q[2] - cz,
      n = Math.hypot(x, z)
    return [q[0] + (x / n) * reach, q[1] - dip, q[2] + (z / n) * reach]
  }
  const r = 1.0 + 1.32 * hash(seed, 3, 78),
    aa = out(a, -0.27, 0.16),
    cc = out(c, -0.27, 0.16),
    dd = out(c, r * 0.63, 0.34),
    bb = out(a, r, 0.38)
  face(b, m.upperGardens, [aa, cc, dd, bb], blend(bed[1], green, 0.51))
  face(
    b,
    m.upperGardens,
    [bb, dd, out(c, r * 0.5, 1.04), out(a, r * 0.79, 1.28)],
    blend(bed[2], quay[0], 0.34)
  )
  if (seed % 4 === 0) trees.push([centroid(aa, dd, bb), seed])
}

function waterfront(b, m, rows, id, trees) {
  const first = rows[0],
    last = rows.at(-1),
    n = Math.ceil(Math.max(...rows.map((r) => r.width)) / 7.1)
  const profiles = []
  function surface(line, material, shade) {
    if (profiles.length && material) {
      const prev = profiles.at(-1)
      for (let i = 0; i < n; i++) {
        const p = [prev[i], prev[i + 1], line[i + 1], line[i]]
        face(
          b,
          material,
          p,
          p.map(([x, y, z]) => shade(x, y, z))
        )
      }
    }
    if (material === m.upperGardens && profiles.length) {
      const prev = profiles.at(-1)
      for (let i = 1; i < n - 1; i++)
        if ((i + id + profiles.length) % 3 === 0) {
          const p = centroid(prev[i], line[i], line[i + 1])
          if (p[1] > -5) trees.push([p, id * 31 + i + profiles.length])
        }
    }
    profiles.push(line)
  }
  function station(row, v, h, expand = 0) {
    return Array.from({ length: n + 1 }, (_, i) => {
      const t = (2 * i) / n - 1,
        delta = typeof v === 'function' ? v(t) : v,
        y = typeof h === 'function' ? h(t) : h
      const p = point(row, t * (row.width / 2 + expand), delta, y)
      if (expand) clearSoil(p)
      return p
    })
  }
  const rock = (x, y, z) => blend(bed[2], bed[4], 0.26 + 0.43 * noise(x * 0.094, z * 0.061, 23)),
    bank = (x, y, z) => blend(bed[0], bed[3], 0.2 + 0.67 * noise(x * 0.075, z * 0.093, 33)),
    grass = (x, y, z) => blend(bed[1], green, 0.12 + 0.62 * noise(x * 0.135, z * 0.121, 25)),
    floor = (x, y, z) => blend(quay[0], quay[1], 0.16 + 0.58 * noise(x * 0.093, z * 0.056, 5)),
    gutter = () => quay[2],
    soil = (x, y, z) => blend(bed[3], quay[0], 0.46 + 0.32 * noise(x * 0.11, z * 0.1, 6))
  const ripple = (t) => Math.sin(5.1 * t + id) * 1.55 + 1.95 * noise(5.1 * t + id, 3.1, 8)
  // Long green tongues alternate with quiet coves. The channel beside the
  // central island stays narrow and the lower shore widens upstream.
  const spur = (t) =>
    Math.max(0, 5 + 3.5 * Math.sin(t * 4.7 + id * 2) + 7.7 * noise(t * 4.2 + id, 1, 21)) *
    (0.63 + first.y * 0.013)
  const backfan = (t) =>
    (0.45 + 0.6 * noise(4.6 * t + id, 1, 26) + 0.24 * Math.sin(2.8 * t + id)) * (20 + 0.57 * last.y)
  const d = first.depth / 2,
    frontToe = first.y - Math.min(7.1, 3.2 + first.y * 0.072)
  surface(
    station(
      first,
      (t) => d + 10.5 + ripple(t) * 2.3 + 1.45 * spur(t),
      (t) => -25.7 + 1.9 * ripple(t),
      3.4
    )
  )
  surface(
    station(
      first,
      (t) => d + 8.6 + ripple(t) * 1.57 + 1.15 * spur(t),
      (t) => mix(-19.4, frontToe, 0.22) + ripple(t) * 0.91,
      4.9
    ),
    m.upperGardens,
    rock
  )
  surface(
    station(
      first,
      (t) => d + 6.1 + ripple(t) * 1.11 + 0.68 * spur(t),
      (t) => mix(-18.9, frontToe, 0.57) + ripple(t) * 0.82,
      3.2
    ),
    m.upperGardens,
    bank
  )
  surface(
    station(
      first,
      (t) => d + 2.4 + ripple(t) * 0.52 + 0.25 * spur(t),
      (t) => frontToe - 1.82 + 0.42 * ripple(t),
      1.5
    ),
    m.upperGardens,
    grass
  )
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex],
      half = row.depth / 2,
      w = row.width / 2,
      base = rowIndex ? rows[rowIndex - 1].y : frontToe
    surface(
      station(row, half, base),
      rowIndex ? m.laneBrickwork : m.upperGardens,
      rowIndex ? gutter : grass
    )
    const high = station(row, half, row.y),
      low = profiles.at(-1)
    for (let i = 0; i < n; i++) {
      const u1 = mix(-w, w, i / n),
        u2 = mix(-w, w, (i + 1) / n),
        tone = blend(quay[2], quay[0], 0.28 + 0.35 * hash(i, id, rowIndex + 5))
      if ((i + id + rowIndex) % 7 === 3 && u2 - u1 > 3) outlet(b, m, row, u1, u2, half, base, row.y, tone)
      else face(b, m.quayPaving, [low[i], low[i + 1], high[i + 1], high[i]], tone)
    }
    profiles.push(high)
    surface(station(row, half - 0.93, row.y), m.quayCoping, gutter)
    surface(station(row, half - 3.4, row.y), m.quayPaving, floor)
    surface(station(row, half - 3.62, row.y), m.quayCoping, gutter)
    surface(station(row, -half + 1.18, row.y), m.laneBrickwork, soil)
    surface(station(row, -half, row.y), m.quayPaving, floor)
    shelfTrim(b, m, row, base, id + rowIndex)
  }
  const rear = -last.depth / 2
  const marks = rooflineSites.filter((p) => p.row.id === last.id)
  const ledge = (t) =>
    marks.reduce((offset, p) => {
      const u = Math.abs((t * last.width) / 2 - p.along),
        rad = p.radius
      const extent = 2 * rad + 1.6 - 0.13 * rad * Math.min(1, u / rad) ** 2
      return Math.max(offset, extent * (1 - smooth(rad + 1.7, rad + 9.5, u)))
    }, 0)
  surface(
    station(last, (t) => rear - 0.27 - ledge(t), last.y - 0.067),
    m.quayPaving,
    floor
  )
  surface(
    station(
      last,
      (t) => rear - ledge(t) - 1.6 - 0.39 * ripple(t),
      (t) => last.y + 0.44 + 0.25 * ripple(t),
      0.38
    ),
    m.upperGardens,
    grass
  )
  surface(
    station(
      last,
      (t) => rear - ledge(t) - 3.7 - 0.62 * ripple(t) - 0.12 * backfan(t),
      (t) => last.y + 1.25 + 0.81 * ripple(t),
      1.4
    ),
    m.upperGardens,
    grass
  )
  surface(
    station(
      last,
      (t) => rear - ledge(t) * 0.95 - 6.6 - 1.5 * ripple(t) - 0.38 * backfan(t),
      (t) => mix(-18, last.y, 0.72) + 1.5 * ripple(t),
      2.8
    ),
    m.upperGardens,
    bank
  )
  surface(
    station(
      last,
      (t) => rear - ledge(t) * 0.8 - 10.9 - 2.0 * ripple(t) - 0.72 * backfan(t),
      (t) => mix(-19, last.y, 0.47) + 1.2 * ripple(t),
      3.2
    ),
    m.upperGardens,
    grass
  )
  surface(
    station(
      last,
      (t) => rear - ledge(t) * 0.68 - 14.5 - 2.8 * ripple(t) - 1.1 * backfan(t),
      (t) => -23.2 + 1.1 * ripple(t),
      3.7
    ),
    m.upperGardens,
    rock
  )
  const rim = [
    ...profiles[0],
    ...profiles.slice(1).map((p) => p[n]),
    ...profiles.at(-1).slice(0, n).reverse(),
    ...profiles
      .slice(1, -1)
      .reverse()
      .map((p) => p[0]),
  ]
  const cx = (first.x + last.x) / 2,
    cz = (first.z + last.z) / 2
  let prev = rim
  for (const [y, vertical, side] of [
    [-22, 0.14, 3.9],
    [-25, 0.48, 10.6],
    [-26, 0.93, 15.1],
    [-34, 1, -2.8],
  ]) {
    const ring = rim.map(([x, h, z], i) => {
      const norm = Math.hypot(x - cx, z - cz),
        k =
          side *
          (1 + 0.03 * Math.max(0, h - 14)) *
          (0.63 + 0.59 * noise(i * 0.18, id, 11) + 0.35 * Math.sin(i * 0.3 + id))
      return clearSoil([
        x + ((x - cx) / norm) * k,
        mix(h, y - 2 * noise(i * 0.18, id, 19), vertical),
        z + ((z - cz) / norm) * k,
      ])
    })
    for (let i = 0; i < rim.length; i++) {
      const j = (i + 1) % rim.length,
        p = [prev[j], prev[i], ring[i], ring[j]],
        colors = p.map(([x, h, z]) => (vertical > 0.8 ? rock(x, h, z) : bank(x, h, z)))
      face(b, m.upperGardens, p, colors)
      if ((vertical === 0.48 || vertical === 0.93) && noise(i * 0.13, id * 0.61 + vertical, 26) > 0.49)
        beddingShelf(b, m, p, cx, cz, id * 173 + i + (vertical === 0.48 ? 17 : 41), trees)
      if ((vertical === 0.14 || vertical === 0.48) && i % 4 === id % 4) {
        const foot = centroid(p[0], p[1], p[2])
        if (foot[1] > 3) trees.push([foot, id * 79 + i])
      }
    }
    prev = ring
  }
  for (let i = 0; i < rim.length; i++)
    face(b, m.upperGardens, [prev[(i + 1) % rim.length], prev[i], [cx, -39, cz]], bed[4])
}

// Horizontal terraces retain the entire nominal palace footprint. The front
// apron overhangs the lower switchbacks; the other three banks feather into
// the water on long wooded shoulders.
function palaceRidge(b, m, site, id, trees) {
  const { x: cx, y: top, z: cz, width, depth } = site,
    w = width / 2 + 2.4,
    d = depth / 2 + 3.6
  const corners = [
    [-w + 1.5, d],
    [w - 1.5, d],
    [w, d - 1.5],
    [w, -d + 1.5],
    [w - 1.5, -d],
    [-w + 1.5, -d],
    [-w, -d + 1.5],
    [-w, d - 1.5],
  ]
  const rim = []
  for (let j = 0; j < corners.length; j++) {
    const p = corners[j],
      q = corners[(j + 1) % corners.length],
      n = Math.ceil(Math.hypot(p[0] - q[0], p[1] - q[1]) / 4.8)
    for (let i = 0; i < n; i++) rim.push([mix(p[0], q[0], i / n), mix(p[1], q[1], i / n)])
  }
  const core = rim.map(([u, v]) => [cx + u * 0.91, top, cz + v * 0.88]),
    edge = rim.map(([u, v]) => [cx + u, top, cz + v])
  // The roofed court occupies the centre; the open exterior has broad stone bands.
  for (let i = 0; i < core.length; i++)
    face(b, m.laneBrickwork, [core[i], core[(i + 1) % core.length], [cx, top, cz]], quay[0])
  for (let i = 0; i < rim.length; i++) {
    const j = (i + 1) % rim.length
    face(b, m.quayPaving, [core[i], edge[i], edge[j], core[j]], tint(quay[1], 0.95 + 0.07 * hash(i, id, 3)))
  }
  let prev = edge
  const levels = [
    [-0.28, 0.38, 0],
    [-0.56, 0.3, 0],
    [-1.55, -0.2, 0],
    [-2.14, 0.11, 0],
    [-3.3, -0.55, 0],
    [-5.5, 0.3, 0],
    [-10, 1.7, 0.06],
    [-15.2, 3.2, 0.12],
    [-16.2, 3.1, 0.27],
    [-18.8, 5.6, 0.45],
    [-22.6, 8.5, 0.62],
    [-24.7, 8, 0.82],
    [-26.8, 7.0, 1],
    [-34, 2.9, 1],
    [-39, -3, 1],
  ]
  levels.forEach(([dy, offset, blendDepth], k) => {
    const next = rim.map(([u, v], i) => {
      const norm = Math.hypot(u, v),
        waves = noise(u * 0.088 + id, v * 0.088, 65) - 0.44
      const r = offset * (0.73 + waves * 1.4) * (k > 6 ? 1.82 : 1) + (0.5 * waves * k) / 7
      const zOffset = v > 0.72 * d ? (k < 6 ? Math.min(r, 0.34) : -Math.abs(r) * 0.49) : r
      const y = mix(top + dy, dy, blendDepth) + (k < 5 ? 0 : waves * (1.9 + 1.23 * blendDepth))
      const p = [cx + u + (u / norm) * r, y, cz + v + (v / norm) * zOffset]
      return k > 5 ? clearSoil(p) : p
    })
    for (let i = 0; i < rim.length; i++) {
      const j = (i + 1) % rim.length,
        p = [prev[j], prev[i], next[i], next[j]]
      const cap = k < 5,
        material = cap ? (k === 2 ? m.quayPaving : m.quayCoping) : m.upperGardens
      const col = p.map(([x, y, z]) =>
        cap
          ? tint(quay[(k + 1) % 4], 0.91 + 0.09 * noise(x * 0.17, z * 0.12, 6))
          : blend(
              bed[k > 10 ? 2 : 0],
              k > 11 ? bed[4] : bed[1],
              0.16 + 0.68 * noise(x * 0.091 + 0.33 * k, z * 0.104, 38)
            )
      )
      face(b, material, p, col)
      if ((k === 6 || k === 8 || k === 10) && (i + id) % 3 === 1) {
        const foot = centroid(p[0], p[1], p[2])
        if (foot[1] > -3) trees.push([foot, 70 * id + 9 * k + i])
      }
    }
    prev = next
  })
  for (let i = 0; i < rim.length; i++)
    face(b, m.upperGardens, [prev[(i + 1) % rim.length], prev[i], [cx, -42, cz]], bed[4])
}

function terminal(row, sign, front = true, extra = -1.4) {
  return point(row, sign * (row.width / 2 + extra), front ? row.depth / 2 - 1.62 : -row.depth / 2 + 1.18)
}
function publicRoutes() {
  const list = []
  groups.forEach((rows, id) => {
    for (let j = 1; j < rows.length; j++) {
      const lower = rows[j - 1],
        upper = rows[j],
        h = upper.y - lower.y
      const favored = (id + j) % 2 ? 1 : -1
      function flight(side) {
        const outer = Math.max(lower.width, upper.width) / 2 + 8.6
        return [
          terminal(lower, side),
          terminal(lower, side, true, 2.0),
          point(lower, outer * side, lower.depth / 2 + 2.9, lower.y + h * 0.17),
          point(upper, outer * side, upper.depth / 2 - 4.25, lower.y + h * 0.81),
          terminal(upper, side, true, 2.0),
          terminal(upper, side),
        ]
      }
      function clearance(points) {
        let least = 40
        for (const p of points.slice(1, -1))
          for (const r of [...reachTerraces, ...palaceSites]) {
            if (r.group === lower.group) continue
            const co = Math.cos(r.yaw || 0),
              si = Math.sin(r.yaw || 0),
              dx = p[0] - r.x,
              dz = p[2] - r.z
            const ux = Math.abs(dx * co - dz * si) - r.width / 2,
              vz = Math.abs(dx * si + dz * co) - r.depth / 2
            least = Math.min(least, Math.hypot(Math.max(0, ux), Math.max(0, vz)))
          }
        return least
      }
      const a = flight(favored),
        b = flight(-favored)
      const points =
        upper.group === '锦浦' && j === 2
          ? flight(1)
          : upper.group === '岑楼' || j >= 4 || clearance(a) + 2 >= clearance(b)
            ? a
            : b
      list.push({ id: upper.id, group: upper.group, points, width: 2.35 })
    }
  })
  const east = point(groups[0][0], 2.73, groups[0][0].depth / 2 - 1.25)
  const book = groups.find((r) => r[0].group === '书坊'),
    silk = groups.find((r) => r[0].group === '织云'),
    deer = groups.find((r) => r[0].group === '鹿鸣')
  list.push(
    { id: '锦浦桥口', width: 4.85, points: [[111, 9, 28], east] },
    {
      id: '西桥台',
      width: 6.8,
      points: [
        [-35, 38, -181],
        [-43.25, 38, -180.57],
      ],
    },
    {
      id: '东桥台',
      width: 6.8,
      points: [
        [60, 42, -186],
        [67.52, 42, -186.4],
      ],
    },
    {
      id: '西台临江阶',
      width: 2.9,
      points: [
        [-43.25, 38, -180.57],
        [-57, 40.8, -178.0],
        [-66.8, 43.6, -168.7],
        [-80, 46, -172],
      ],
    },
    {
      id: '西台山门',
      width: 3.2,
      points: [
        terminal(book[1], 1),
        [-101.1, 38, -164.1],
        [-91.4, 41.4, -164.5],
        [-80, 46, -172],
        [-90.6, 49.3, -174.5],
        [-101.0, 54, -177],
        [-105, 54, -177.5],
      ],
    },
    {
      id: '东台临江阶',
      width: 2.9,
      points: [
        [67.52, 42, -186.4],
        [82.2, 45.8, -176.7],
        [98.5, 50.2, -175.7],
        [110.2, 53.8, -171.8],
        [106.8, 58.5, -180.8],
        [92.8, 62.4, -182.2],
        [82.9, 66, -186.3],
        [78, 66, -187],
      ],
    },
    {
      id: '东台市巷',
      width: 2.5,
      points: [
        terminal(silk[0], -1),
        [118.6, 37, -214.6],
        [116.6, 41, -199.4],
        [116.1, 45.3, -185.8],
        [98.5, 50.2, -175.7],
      ],
    },
    {
      id: '后阙飞阶',
      width: 3.1,
      points: [
        terminal(deer[2], 1),
        [178.0, 72, -301.45],
        [179.4, 76.6, -314.0],
        [185, 81.3, -323.1],
        [171, 85.6, -321.7],
        [149.2, 90.6, -315.2],
        [137.3, 94.6, -317.9],
        [152.5, 98, -324.7],
        [155, 98, -325],
      ],
    }
  )
  return list
}
export const reachWalks = publicRoutes()

// Where independently curved watersheds meet a street or a stair, subdivide
// the intersecting soil face at the real footprint. Deforming corner heights
// alone would allow a long sliver to pass through a walker in the middle.
const exclusions = new Map()
function carveBox(x, z, ux, uz, halfU, halfV, height) {
  const vx = -uz,
    vz = ux,
    dx = Math.abs(ux) * halfU + Math.abs(vx) * halfV,
    dz = Math.abs(uz) * halfU + Math.abs(vz) * halfV
  const r = {
    x,
    z,
    ux,
    uz,
    vx,
    vz,
    halfU,
    halfV,
    height,
    minX: x - dx,
    maxX: x + dx,
    minZ: z - dz,
    maxZ: z + dz,
  }
  for (let i = Math.floor(r.minX / 30); i <= Math.floor(r.maxX / 30); i++)
    for (let j = Math.floor(r.minZ / 30); j <= Math.floor(r.maxZ / 30); j++) {
      const k = i + j * 1024
      if (!exclusions.has(k)) exclusions.set(k, [])
      exclusions.get(k).push(r)
    }
}
for (const row of reachTerraces) {
  carveBox(
    row.x,
    row.z,
    Math.cos(row.yaw),
    -Math.sin(row.yaw),
    row.width / 2 + 0.28,
    row.depth / 2 + 0.25,
    () => row.y - 0.44
  )
}
function protectWay(p, q, width) {
  const dx = q[0] - p[0],
    dz = q[2] - p[2],
    run = Math.hypot(dx, dz),
    ux = dx / run,
    uz = dz / run
  const grade = (x, z) =>
    p[1] + Math.max(0, Math.min(1, ((x - p[0]) * ux + (z - p[2]) * uz) / run)) * (q[1] - p[1]) - 1.08
  carveBox(
    (p[0] + q[0]) / 2,
    (p[2] + q[2]) / 2,
    ux,
    uz,
    run / 2 + width / 2 + 0.36,
    width / 2 + 0.57,
    grade
  )
}
for (const { points, width } of reachWalks)
  for (let j = 1; j < points.length; j++) protectWay(points[j - 1], points[j], width)
protectWay([-35, 37, -181], [60, 41, -186], 7.1)
const shippingCuts = [
  { x: 104.76, z: 29.36, w: 5.35, d: 5.55 },
  { x: 112.0, z: 94.2, w: 10.2, d: 6.8 },
]
for (const c of shippingCuts) carveBox(c.x, c.z, 1, 0, c.w, c.d, () => -18.3)
function cutSoil(points, colors) {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity
  for (const [x, y, z] of points) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  const nearby = new Set()
  for (let i = Math.floor(minX / 30); i <= Math.floor(maxX / 30); i++)
    for (let j = Math.floor(minZ / 30); j <= Math.floor(maxZ / 30); j++)
      for (const r of exclusions.get(i + j * 1024) || []) {
        if (r.minX < maxX && r.maxX > minX && r.minZ < maxZ && r.maxZ > minZ) nearby.add(r)
      }
  if (!nearby.size) return null
  const cut = (poly, n, inner, outer) => {
    let p = poly.at(-1),
      a = n(p.p)
    for (const q of poly) {
      const c = n(q.p)
      if (c < 0 !== a < 0) {
        const f = a / (a - c),
          v = { p: p.p.map((t, i) => mix(t, q.p[i], f)), c: p.c.map((t, i) => mix(t, q.c[i], f)) }
        inner.push(v)
        outer.push(v)
      }
      if (c >= 0) inner.push(q)
      else outer.push(q)
      p = q
      a = c
    }
  }
  let all = [points.map((p, i) => ({ p, c: colors[i] }))],
    changed = false
  for (const r of nearby) {
    const dist = (p, k) => {
      const x = p[0] - r.x,
        z = p[2] - r.z
      return k === 0
        ? r.halfU + x * r.ux + z * r.uz
        : k === 1
          ? r.halfU - x * r.ux - z * r.uz
          : k === 2
            ? r.halfV + x * r.vx + z * r.vz
            : r.halfV - x * r.vx - z * r.vz
    }
    const next = []
    for (const poly of all) {
      if (poly.every((v) => v.p[1] <= r.height(v.p[0], v.p[2]) + 0.0002)) {
        next.push(poly)
        continue
      }
      let middle = poly
      const outside = []
      for (let k = 0; k < 4; k++) {
        const inner = [],
          outer = []
        cut(middle, (p) => dist(p, k), inner, outer)
        if (outer.length >= 3) outside.push(outer)
        if (inner.length < 3) {
          middle = []
          break
        }
        middle = inner
      }
      if (middle.length < 3 || middle.every((v) => v.p[1] <= r.height(v.p[0], v.p[2]) + 0.0002)) {
        next.push(poly)
        continue
      }
      changed = true
      next.push(...outside)
      const lowered = middle.map((v) => ({
        p: [v.p[0], Math.min(v.p[1], r.height(v.p[0], v.p[2])), v.p[2]],
        c: v.c,
      }))
      next.push(lowered)
      for (let i = 0; i < middle.length; i++) {
        const j = (i + 1) % middle.length
        if (lowered[i].p[1] === middle[i].p[1] && lowered[j].p[1] === middle[j].p[1]) continue
        for (let k = 0; k < 4; k++)
          if (Math.abs(dist(middle[i].p, k)) + Math.abs(dist(middle[j].p, k)) < 0.0001) {
            next.push([middle[j], middle[i], lowered[i], lowered[j]])
            break
          }
      }
    }
    all = next
  }
  return changed ? all : null
}

function centroid(a, b, c) {
  return a.map((v, i) => (v + b[i] + c[i]) / 3)
}
const routeSegments = reachWalks.flatMap(({ points, width }) =>
  points.slice(1).map((q, i) => {
    const p = points[i],
      dx = q[0] - p[0],
      dz = q[2] - p[2],
      rr = width / 2 + 6,
      pad = rr + 8.0
    return {
      p,
      q,
      dx,
      dz,
      rr,
      ls: dx * dx + dz * dz,
      x0: Math.min(p[0], q[0]) - pad,
      x1: Math.max(p[0], q[0]) + pad,
      z0: Math.min(p[2], q[2]) - pad,
      z1: Math.max(p[2], q[2]) + pad,
    }
  })
)
const hillsideClearance = reachTerraces.map((row) => ({
  ...row,
  co: Math.cos(row.yaw),
  si: Math.sin(row.yaw),
}))
function clearSoil(p) {
  const [x, y, z] = p
  for (const c of shippingCuts) {
    const d = Math.hypot(Math.max(0, Math.abs(x - c.x) - c.w), Math.max(0, Math.abs(z - c.z) - c.d))
    if (d < 8) p[1] = Math.min(p[1], mix(-19.6, y, smooth(0, 8, d)))
  }
  for (const r of hillsideClearance) {
    if (p[1] < r.y - 0.9) continue
    const dx = x - r.x,
      dz = z - r.z,
      u = Math.max(0, Math.abs(dx * r.co - dz * r.si) - r.width / 2),
      v = Math.max(0, Math.abs(dx * r.si + dz * r.co) - r.depth / 2)
    const d = Math.hypot(u, v)
    p[1] = Math.min(p[1], r.y - 0.75 + d * (0.82 + 0.0048 * d))
  }
  for (const s of routeSegments) {
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue
    const t = Math.min(1, Math.max(0, ((x - s.p[0]) * s.dx + (z - s.p[2]) * s.dz) / s.ls))
    const dist = Math.hypot(x - s.p[0] - s.dx * t, z - s.p[2] - s.dz * t)
    const grade = mix(s.p[1], s.q[1], t) - 4.4
    p[1] = Math.min(p[1], mix(grade, y, smooth(s.rr, s.rr + 8.0, dist)))
  }
  return p
}

// Low wooded necks link the upstream ends of neighbouring banks. The spines
// follow the landward side of the street plan, leaving the water channels open.
const riverNecks = [
  ['锦浦', '南栈'],
  ['锦浦', '东市'],
  ['西津', '书坊'],
  ['书坊', 0],
  [0, '桂浦'],
  ['桂浦', '花津'],
  ['花津', '画桥'],
  ['东市', '织云'],
  ['织云', '鹿鸣'],
  ['鹿鸣', 2],
  [2, '玉京'],
  ['玉京', '岑楼'],
  ['画桥', '铜雀'],
  ['铜雀', '星渡'],
]
function necks(b, m, trees) {
  function anchors(key) {
    if (typeof key === 'number') {
      const r = palaceSites[key]
      return [
        [-1, 0],
        [1, 0],
        [-0.86, -0.9],
        [0.86, -0.9],
        [0, -1],
      ].map(([u, v]) => [r.x + (u * r.width) / 2, r.y - 7, r.z + (v * r.depth) / 2])
    }
    const rows = groups.find((r) => r[0].group === key),
      back = rows.at(-1)
    return [-0.94, -0.58, 0, 0.58, 0.94].map((u) =>
      point(back, (u * back.width) / 2, -back.depth / 2 - 4, back.y - 4.2)
    )
  }
  for (let id = 0; id < riverNecks.length; id++) {
    const [nameA, nameB] = riverNecks[id],
      aa = anchors(nameA),
      cc = anchors(nameB)
    let a,
      c,
      d = Infinity
    for (const p of aa)
      for (const q of cc) {
        const dist = Math.hypot(p[0] - q[0], p[2] - q[2])
        if (dist < d) {
          a = p
          c = q
          d = dist
        }
      }
    if (d < 7) continue
    const nx = -(c[2] - a[2]) / d,
      nz = (c[0] - a[0]) / d,
      n = Math.max(6, Math.ceil(d / 5.7)),
      sides = 7
    const curve = (id % 2 ? 1 : -1) * Math.min(17, d * 0.17),
      saddle = Math.min(23, Math.min(a[1], c[1]) * 0.29) + 3.2 * Math.sin(id)
    const grid = []
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        s = Math.sin(Math.PI * t),
        t0 = t < 0.5 ? 2 * t : (1 - t) * 2
      const rim = Math.min(a[1], c[1]),
        h = saddle + (mix(a[1], c[1], t) - saddle) * (1 - smooth(0, 0.87, t0))
      const bend = curve * s * (0.76 + 0.22 * Math.sin(t * 5.0 + id)),
        width = (12 + 0.095 * rim) * (1.08 + 0.18 * Math.sin(t * 8.2 + id))
      const line = []
      for (let j = 0; j < sides; j++) {
        const f = (2 * j) / (sides - 1) - 1,
          branch =
            1 + 0.22 * Math.sin(t * 10.4 + id * 0.79 + Math.sign(f) * 1.5) + 0.11 * Math.cos(t * 19.3 - id)
        const across = bend + f * width * branch,
          edge = Math.abs(f),
          spine = smooth(0, 1, edge ** 1.62)
        const y = mix(h, -24, spine) + 3.25 * s * (noise(t * 6.5 + id, f * 2.4, 44) - 0.48)
        line.push(clearSoil([mix(a[0], c[0], t) + nx * across, y, mix(a[2], c[2], t) + nz * across]))
      }
      grid.push(line)
    }
    for (let i = 0; i < n; i++)
      for (let j = 0; j < sides - 1; j++) {
        const ps = [grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]]
        const colors = ps.map(([x, y, z]) =>
          blend(bed[Math.abs(j - 3) > 1 ? 2 : 0], bed[1], 0.18 + 0.65 * noise(x * 0.072, z * 0.058, 50))
        )
        face(b, m.upperGardens, ps, colors)
        if (i > 0 && i < n - 1 && j > 0 && j < 5 && hash(i, j, id + 15) > 0.77) {
          const p = centroid(ps[0], ps[1], ps[2])
          if (p[1] > -4) trees.push([p, id * 31 + i * j])
        }
      }
    const rim = [
      ...grid.map((l) => l[0]),
      ...grid[n].slice(1),
      ...grid
        .slice(0, -1)
        .reverse()
        .map((l) => l.at(-1)),
      ...grid[0].slice(1, -1).reverse(),
    ]
    const cx = (a[0] + c[0]) / 2,
      cz = (a[2] + c[2]) / 2
    const bottom = rim.map(([x, y, z]) => [
      mix(x, cx, 0.13),
      -31.7 - 0.034 * Math.hypot(x - cx, z - cz),
      mix(z, cz, 0.13),
    ])
    for (let i = 0; i < rim.length; i++) {
      const j = (i + 1) % rim.length
      face(b, m.upperGardens, [rim[i], rim[j], bottom[j], bottom[i]], bed[2])
      face(b, m.upperGardens, [bottom[i], bottom[j], [cx, -40, cz]], bed[4])
    }
  }
}

function treeBrush(b, m, foot, seed) {
  const [x, y, z] = foot,
    h = (seed % 5 === 0 ? 5.7 : 2.8) + (seed % 5 === 0 ? 6.5 : 4.3) * hash(x, z, seed + 3),
    a = 6.28 * hash(z, x, seed + 4)
  const tip = (p, angle, run, lift) => [
    p[0] + Math.cos(angle) * run,
    p[1] + lift,
    p[2] + Math.sin(angle) * run,
  ]
  const base = [x, y - 0.39, z],
    mid = tip(foot, a, h * 0.089, h * 0.49),
    crown = tip(mid, a + 0.56, h * 0.16, h * 0.44)
  const wood = tint(bed[3], 0.72)
  b.tube(m.mountainBark, base, mid, h * 0.052, h * 0.033, 4, wood, false)
  b.tube(m.mountainBark, mid, crown, h * 0.036, h * 0.011, 4, wood, false)
  const tintRGB =
    seed % 6 === 0 ? [1.52, 1.18, 0.77] : seed % 5 === 1 ? [1.11, 1.32, 0.9] : [0.82, 1.11, 0.94]
  function brush(p, az, size, tilt, fall) {
    const dx = Math.cos(az),
      dz = Math.sin(az),
      w = size * 0.48
    const pt = (k, sgn) => [
      p[0] + dx * size * k - dz * w * sgn * Math.cos(tilt),
      p[1] + k * fall + w * sgn * Math.sin(tilt),
      p[2] + dz * size * k + dx * w * sgn * Math.cos(tilt),
    ]
    b.face(m.pineBrush, [pt(0, -1), pt(1, -1), pt(1, 1), pt(0, 1)], tintRGB, [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ])
  }
  const limbs = seed % 5 === 0 ? 4 : 2,
    sprays = limbs === 4 ? 4 : 3
  for (let k = 0; k < limbs; k++) {
    const yaw = a + k * 2.38,
      t = k / limbs,
      root = mid.map((v, i) => mix(v, crown[i], t * 0.78)),
      length = h * (0.38 - 0.12 * t)
    const end = tip(root, yaw, length * 0.76, h * 0.067)
    b.tube(m.mountainBark, root, end, h * 0.024, h * 0.006, 3, wood, false)
    for (let j = 0; j < sprays; j++)
      brush(
        end,
        yaw + (j - 1.5) * 0.82,
        length * (0.92 + 0.18 * hash(k, j, seed)),
        j % 2 ? 0.85 : 0.29,
        length * (j % 2 ? 0.26 : 0.09)
      )
  }
  for (let j = 0; j < (limbs === 4 ? 4 : 2); j++)
    brush(crown, a + j * 1.57, h * 0.25, j % 2 ? 0.85 : 0.32, h * 0.075)
}

function stairWay(b, m, path, idx) {
  const { points, width } = path,
    w = width / 2
  for (let j = 0; j < points.length - 1; j++) {
    const a = points[j],
      c = points[j + 1],
      dx = c[0] - a[0],
      dz = c[2] - a[2],
      run = Math.hypot(dx, dz),
      rise = c[1] - a[1]
    const nx = -dz / run,
      nz = dx / run,
      step = Math.max(1, Math.ceil(Math.abs(rise) / 0.185))
    const corner = (f, s, y) => [mix(a[0], c[0], f) + s * nx, y, mix(a[2], c[2], f) + s * nz]
    const thickness = 0.5 + Math.min(0.52, run * 0.025),
      pad0 = Math.min(((w + 0.22) * 1.4) / run, 0.25),
      pad1 = 1 - Math.min(((w + 0.22) * 1.4) / run, 0.25)
    const t = (i) => mix(pad0, pad1, i / step)
    const y = (i) => mix(a[1], c[1], i / step)
    function top(t0, t1, h, col) {
      face(b, m.quayPaving, [corner(t0, w, h), corner(t1, w, h), corner(t1, -w, h), corner(t0, -w, h)], col)
    }
    if (pad0 > 0) top(0, pad0, a[1], quay[0])
    if (pad1 < 1) top(pad1, 1, c[1], quay[0])
    for (let i = 0; i < step; i++) {
      const u = t(i),
        v = t(i + 1),
        bottom = y(i),
        h = y(i + 1),
        col = tint(quay[(i + idx) % 4], 1.02)
      top(u, v, h, col)
      if (Math.abs(h - bottom) > 0.001)
        face(
          b,
          m.quayCoping,
          [corner(u, w, bottom), corner(u, -w, bottom), corner(u, -w, h), corner(u, w, h)],
          tint(quay[2], 0.91)
        )
      if (Math.abs(h - bottom) > 0.001)
        for (const side of [-w, w])
          face(b, m.quayCoping, [corner(u, side, bottom), corner(v, side, h), corner(u, side, h)], quay[2])
    }
    for (const side of [-w, w]) {
      const bank = [
        corner(0, side, a[1] - thickness),
        corner(1, side, c[1] - thickness),
        corner(1, side, c[1]),
      ]
      if (pad1 < 1) bank.push(corner(pad1, side, c[1]))
      if (pad0 > 0) bank.push(corner(pad0, side, a[1]))
      bank.push(corner(0, side, a[1]))
      face(b, m.quayCoping, bank, quay[2])
    }
    face(
      b,
      m.quayCoping,
      [
        corner(0, w, a[1] - thickness),
        corner(0, -w, a[1] - thickness),
        corner(1, -w, c[1] - thickness),
        corner(1, w, c[1] - thickness),
      ],
      quay[2]
    )
    for (const [f, h] of [
      [0, a[1]],
      [1, c[1]],
    ]) {
      face(
        b,
        m.quayCoping,
        [corner(f, -w, h - thickness), corner(f, w, h - thickness), corner(f, w, h), corner(f, -w, h)],
        quay[0]
      )
    }
    if (points.length > 2 && j < points.length - 2) {
      const [x, h, z] = c
      b.tube(m.quayCoping, [x, h - 0.17, z], [x, h, z], w + 0.03, w + 0.03, 8, quay[0])
    }
    if (idx >= streetFlightCount && (j % 2 === 0 || points.length < 3)) {
      const mid = corner(points.length < 3 ? 0.68 : 0.52, 0, mix(a[1], c[1], 0.52)),
        col = blend(quay[2], bed[2], 0.29)
      mid[1] -= thickness + w * Math.abs(rise / run) + 0.4
      const low = Math.min(-21.8, mid[1] - 18),
        depth = mid[1] - low
      b.tube(
        m.quayPaving,
        [mid[0], low, mid[2]],
        [mid[0], mid[1] - 0.46, mid[2]],
        Math.max(1.19, w * 0.8),
        Math.max(0.62, w * 0.5),
        8,
        col,
        false
      )
      b.tube(
        m.quayCoping,
        [mid[0], mid[1] - 1.3, mid[2]],
        [mid[0], mid[1] - 0.31, mid[2]],
        w * 0.59,
        w * 0.92,
        8,
        quay[1],
        false
      )
      if (depth > 34) {
        const y0 = low + depth * 0.61
        b.tube(
          m.quayCoping,
          [mid[0], y0, mid[2]],
          [mid[0], y0 + 0.31, mid[2]],
          w * 0.78,
          w * 0.71,
          8,
          col,
          false
        )
      }
    }
  }
}

function terrainFinish(m) {
  const mat = m.upperGardens.clone(),
    size = 144,
    bytes = new Uint8ClampedArray(size * size * 4)
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const u = i / size,
        v = j / size,
        fine = hash(i, j, 47),
        veil = noise(u * 6, v * 6, 11, 6),
        grove = noise(u * 11, v * 11, 17, 11)
      const slope = Math.sin(
        6.283 * (2 * u - v) + 1.42 * Math.sin(6.283 * (u + v)) + 0.87 * Math.sin(6.283 * (3 * v - 2 * u))
      )
      const grain = 0.73 + 0.17 * veil + 0.072 * grove + 0.044 * fine + 0.032 * slope
      const mossy = smooth(0.43, 0.72, grove),
        quartz = 0.06 * (1 - smooth(0.02, 0.14, Math.abs(slope + 0.23))) * smooth(0.36, 0.7, veil)
      const p = 4 * (j * size + i)
      bytes[p] = 255 * (grain + 0.024 * mossy + quartz)
      bytes[p + 1] = 255 * (grain + 0.046 * mossy + quartz * 0.82)
      bytes[p + 2] = 255 * (grain - 0.039 * mossy + quartz * 0.74)
      bytes[p + 3] = 255
    }
  mat.map = texel(new Uint8Array(bytes.buffer), size, true, 0.071)
  mat.normalMap = null
  mat.roughness = 0.965
  return { ...m, upperGardens: mat }
}
function softNormals(mesh) {
  const g = mesh.geometry,
    p = g.attributes.position,
    n = g.attributes.normal,
    index = g.index.array,
    bucket = new Map(),
    sums = []
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map((v) => Math.round(v * 1000)).join(',')
    if (!bucket.has(key)) bucket.set(key, [0, 0, 0])
    sums[i] = bucket.get(key)
  }
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i],
      b = index[i + 1],
      c = index[i + 2],
      x = p.getX(b) - p.getX(a),
      y = p.getY(b) - p.getY(a),
      z = p.getZ(b) - p.getZ(a)
    const u = p.getX(c) - p.getX(a),
      v = p.getY(c) - p.getY(a),
      w = p.getZ(c) - p.getZ(a),
      nx = y * w - z * v,
      ny = z * u - x * w,
      nz = x * v - y * u
    const len = Math.hypot(nx, ny, nz)
    if (len < 1e-7) continue
    const weight = 1 / Math.sqrt(len)
    for (const ix of [a, b, c]) {
      const ar = sums[ix]
      ar[0] += nx * weight
      ar[1] += ny * weight
      ar[2] += nz * weight
    }
  }
  for (let i = 0; i < p.count; i++) {
    const s = sums[i],
      len = Math.hypot(...s)
    if (len < 1e-6) continue
    const x = (s[0] / len) * 0.85 + n.getX(i) * 0.15,
      y = (s[1] / len) * 0.85 + n.getY(i) * 0.15,
      z = (s[2] / len) * 0.85 + n.getZ(i) * 0.15,
      k = Math.hypot(x, y, z)
    n.setXYZ(i, x / k, y / k, z / k)
  }
}

export function reachLand(b, m, _world) {
  if (!m.quayCoping) landFinishes(m)
  m = terrainFinish(m)
  const from = b.scene.children.length,
    trees = []
  groups.forEach((rows, id) => {
    const batch = new LandBatch(b.scene),
      from = b.scene.children.length
    waterfront(batch, m, rows, id, trees)
    reachWalks.filter((p) => p.group === rows[0].group).forEach((p, j) => stairWay(batch, m, p, j))
    batch.finish()
    b.scene.children.slice(from).forEach((o) => (o.userData.reach = rows[0].group))
  })
  palaceSites.forEach((site, id) => {
    const batch = new LandBatch(b.scene),
      from = b.scene.children.length
    palaceRidge(batch, m, site, id, trees)
    batch.finish()
    b.scene.children.slice(from).forEach((o) => (o.userData.reach = '山台' + id))
  })
  const grove = new LandBatch(b.scene)
  necks(grove, m, trees)
  grove.finish()
  const woodlands = new Map()
  for (const [p, k] of trees) {
    if (hash(p[0], p[2], k) <= 0.44 || clearSoil([p[0], p[1] + 8, p[2]])[1] <= p[1] + 5.8) continue
    const key = Math.floor((p[2] + 25) / 148) * 2 + (p[0] > 65 ? 1 : 0)
    if (!woodlands.has(key)) woodlands.set(key, new LandBatch(b.scene))
    treeBrush(woodlands.get(key), m, p, k)
  }
  for (const woods of woodlands.values()) woods.finish()
  const links = new LandBatch(b.scene)
  reachWalks.slice(streetFlightCount).forEach((p, j) => stairWay(links, m, p, streetFlightCount + j))
  links.finish()
  for (const mesh of b.scene.children.slice(from)) if (mesh.material === m.upperGardens) softNormals(mesh)
}
