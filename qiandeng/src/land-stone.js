import * as T from 'three'
import { generator, sub, cross, unit } from './mesh.js'
import { blend, hash, limit, mix, panel, rgb, smooth, tau, tint, top } from './land-kit.js'

const slab = [0xa4aaa0, 0x9da299, 0x9b9b8d, 0xaab0a5, 0x859595, 0xa49c92].map(rgb)
const ink = rgb(0x43585b),
  pearl = rgb(0xb5af99),
  jade = rgb(0x728a84),
  bronze = rgb(0x9c8d69)
const y = 1.35
const rect = (b, m, x0, x1, z0, z1, h, c, angle = 0) => {
  const p = [
      [x0, h, z0],
      [x0, h, z1],
      [x1, h, z1],
      [x1, h, z0],
    ],
    s = Math.sin(angle),
    co = Math.cos(angle)
  top(
    b,
    m,
    p,
    c,
    p.map(([x, , z]) => [co * x + s * z, co * z - s * x])
  )
}
function oval(b, m, cx, cz, r0, r1, level, color, curve = (t) => 1, n = 44) {
  for (let i = 0; i < n; i++) {
    const a = (tau * i) / n,
      c = (tau * (i + 1)) / n
    const p = (s, r) => [cx + Math.cos(s) * r * curve(s), level, cz + Math.sin(s) * r * curve(s)]
    top(b, m, [p(a, r0), p(c, r0), p(c, r1), p(a, r1)], color)
  }
}
function lozenge(b, m, x, z, r, level) {
  const field = []
  for (let j = 0; j < 40; j++) {
    const a = (tau * j) / 40
    field.push([x + r * Math.cos(a), level, z + r * Math.sin(a)])
  }
  top(b, m.quayPaving, field, tint(slab[1], 1.03))
  oval(b, m.quayCoping, x, z, r * 0.963, r, level + 0.006, ink)
  oval(b, m.quayCoping, x, z, r * 0.878, r * 0.905, level + 0.007, bronze)
  oval(b, m.quayCoping, x, z, r * 0.61, r * 0.65, level + 0.006, jade, (a) => 1 + 0.24 * Math.cos(4 * a))
  oval(b, m.quayCoping, x, z, r * 0.34, r * 0.38, level + 0.006, ink, (a) => 1 - 0.25 * Math.cos(4 * a))
  oval(b, m.quayCoping, x, z, r * 0.12, r * 0.16, level + 0.006, bronze)
}
function chamfered(b, m, plan, hi, lo, color) {
  const ring = []
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i]
    for (const j of [(i + plan.length - 1) % plan.length, (i + 1) % plan.length]) {
      const q = plan[j],
        dist = Math.hypot(q[0] - p[0], q[1] - p[1]),
        f = Math.min(0.18, 0.062 / dist)
      ring.push([mix(p[0], q[0], f), mix(p[1], q[1], f)])
    }
  }
  const cap = ring.map(([x, z]) => [x, hi, z])
  top(b, m, cap, color)
  for (let i = 0; i < ring.length; i++) {
    const k = (i + 1) % ring.length,
      a = ring[i],
      c = ring[k]
    b.face(m, [[a[0], lo, a[1]], [c[0], lo, c[1]], cap[k], cap[i]], tint(color, 0.89))
  }
}
function drainage(b, m, sign, z, rng) {
  const cx = sign * 16.903,
    h = 0.33,
    w = 0.43 + rng() * 0.16
  const half = [
    [cx, -0.06, z - w],
    [cx, -0.06, z + w],
  ]
  for (let j = 0; j <= 12; j++) {
    const a = (Math.PI * j) / 12
    half.push([cx, h + w * Math.sin(a), z + w * Math.cos(a)])
  }
  b.face(m.quayCoping, half, tint(ink, 0.32))
  for (let i = 0; i < 11; i++) {
    const a = (Math.PI * i) / 11 + 0.009,
      c = (Math.PI * (i + 1)) / 11 - 0.009
    const p = (t, r) => [cx - sign * 0.033, h + r * Math.sin(t), z + r * Math.cos(t)]
    b.face(m.quayCoping, [p(a, w), p(c, w), p(c, w + 0.17), p(a, w + 0.17)], tint(slab[i % 6], 0.81))
  }
  for (const f of [-0.67, -0.33, 0, 0.33, 0.67]) {
    const topY = h + w * Math.sqrt(1 - f * f)
    b.box(m.quayCoping, cx - sign * 0.045, (topY - 0.04) / 2, z + f * w, 0.049, topY + 0.04, 0.032, ink)
  }
  const x = sign * 17.85
  b.box(m.quayCoping, x, y + 0.031, z, 0.7, 0.02, 1.0, tint(ink, 0.49))
  for (let i = -3; i <= 3; i++) b.box(m.quayCoping, x, y + 0.048, z + i * 0.129, 0.7, 0.027, 0.062, slab[4])
}
function mooring(b, m, sign, z) {
  const x = sign * 17.3,
    h = y + 0.06
  b.box(m.quayCoping, x, h + 0.07, z, 0.4, 0.13, 0.45, slab[2])
  b.box(m.quayCoping, x, h + 0.26, z, 0.24, 0.25, 0.27, slab[4])
  b.box(m.quayCoping, x, h + 0.405, z, 0.33, 0.085, 0.34, slab[1])
  let last
  for (let j = 0; j <= 10; j++) {
    const a = (tau * j) / 10,
      p = [x - sign * 0.18, h + 0.21 + 0.12 * Math.sin(a), z + 0.13 * Math.cos(a)]
    if (last) b.tube(m.bronze || m.quayCoping, last, p, 0.022, 0.022, 5, 0.63, false)
    last = p
  }
}
function quay(b, m, sign, rng) {
  const sx = (a) => sign * a,
    shore = (a, h, z) => [sx(a), h, z]
  for (let z = -66; z < 87.99; ) {
    const end = Math.min(88, z + 1.25 + 1.38 * rng()),
      a = z + 0.012,
      c = end - 0.012
    chamfered(
      b,
      m.quayCoping,
      [
        [sx(16.9), a],
        [sx(17.54), a],
        [sx(17.54), c],
        [sx(16.9), c],
      ],
      y + 0.032,
      y - 0.176,
      slab[Math.floor(rng() * 6)]
    )
    z = end
  }
  for (const [lo, hi, size] of [
    [-0.35, 0.29, 2.04],
    [0.3, 0.76, 1.54],
    [0.77, 1.18, 2.17],
  ]) {
    for (let z = -66; z < 87.98; ) {
      const end = Math.min(88, z + size * (0.58 + rng() * 0.72)),
        a = z + 0.016,
        c = end - 0.016
      const x = 16.973 - rng() * 0.032,
        cut = 0.034
      const points = [
        shore(x, lo + cut, a),
        shore(x, lo, a + cut),
        shore(x, lo, c - cut),
        shore(x, lo + cut, c),
        shore(x, hi - cut, c),
        shore(x, hi, c - cut),
        shore(x, hi, a + cut),
        shore(x, hi - cut, a),
      ]
      const color = blend(slab[Math.floor(rng() * 6)], ink, lo < 0 ? 0.69 : 0.24 + 0.17 * rng())
      b.face(m.quayCoping, points, color)
      z = end
    }
  }
  for (let z = -66; z < 86; z += 9.5) {
    const end = Math.min(86, z + 9.5),
      shade = tint(slab[Math.floor(rng() * 6)], 0.96)
    rect(b, m.quayPaving, sx(17.46), sx(21.97), z, end, y + 0.017, shade)
  }
  rect(b, m.quayCoping, sx(17.68), sx(17.76), -66, 86, y + 0.03, ink)
  rect(b, m.quayCoping, sx(21.7), sx(21.83), -66, 86, y + 0.03, jade)
  rect(b, m.quayCoping, sx(21.85), sx(21.91), -66, 86, y + 0.03, pearl)
  for (const z of [-57, -43, -28, 6, 23, 44, 61, 80]) drainage(b, m, sign, z + (sign > 0 ? 1.15 : 0), rng)
  for (const z of [-63, -51, -36, -22, 8.5, 21.3, 32.7, 48.3, 58.2, 72.7, 83.1])
    mooring(b, m, sign, z + (sign > 0 ? 0.6 : 0))
}
export function civicStones(b, m) {
  const rng = generator(79217)
  for (const sign of [-1, 1]) {
    quay(b, m, sign, rng)
    for (const [lo, hi] of [
      [-62, -19.7],
      [2.2, 81.8],
    ]) {
      for (const [cx, width] of [
        [32.8, 3.3],
        [46.0, 3.05],
      ]) {
        rect(
          b,
          m.laneBrickwork,
          sign * (cx - width / 2),
          sign * (cx + width / 2),
          lo,
          hi,
          y + 0.014,
          cx < 39 ? slab[0] : blend(slab[3], bronze, 0.13),
          Math.PI / 4
        )
        for (const edge of [-1, 1])
          rect(
            b,
            m.quayCoping,
            sign * (cx + edge * (width / 2 - 0.12)),
            sign * (cx + (edge * width) / 2),
            lo,
            hi,
            y + 0.021,
            slab[4]
          )
      }
    }
    for (const cz of [-42.2, -31.7, 14, 35, 54, 67]) {
      rect(b, m.quayPaving, sign * 21.96, sign * 49.8, cz - 1.18, cz + 1.18, y + 0.027, slab[1], Math.PI / 2)
      for (const s of [-1, 1])
        rect(b, m.quayCoping, sign * 21.96, sign * 49.8, cz + s * 1.18, cz + s * 1.29, y + 0.032, jade)
    }
    for (const z of [-42.2, 35, 67]) lozenge(b, m, sign * 32.8, z, 1.04, y + 0.04)
    for (const z of [-26.4, 12.8, 53, 78.4]) lozenge(b, m, sign * 19.7, z, 0.84, y + 0.04)
    rect(b, m.quayPaving, sign * 45.5, sign * 58.8, -12.6, -5.37, y + 0.022, slab[3])
  }
  rect(b, m.quayPaving, -7.25, 7.25, -121.8, -66, y + 0.016, slab[3])
  for (const sign of [-1, 1])
    for (const [off, w, c] of [
      [6.58, 0.1, ink],
      [6.85, 0.22, bronze],
      [7.22, 0.13, jade],
    ])
      rect(b, m.quayCoping, sign * off, sign * (off + w), -121.8, -66, y + 0.03, c)
  for (const z of [-77.6, -98, -114.2]) lozenge(b, m, 0, z, 2.28, y + 0.034)
  for (let x = -17; x < 17; ) {
    const end = Math.min(17, x + 1.34 + 1.12 * rng())
    chamfered(
      b,
      m.quayCoping,
      [
        [x + 0.015, -66.48],
        [end - 0.015, -66.48],
        [end - 0.015, -65.92],
        [x + 0.015, -65.92],
      ],
      y + 0.034,
      y - 0.156,
      slab[Math.floor(rng() * 6)]
    )
    x = end
  }
}
export function carvedCliff(b, m, { columns, arc, rockColor, core }) {
  const rng = generator(67133),
    n = columns.length
  function sample(u, level, out = 0) {
    u = ((u % arc) + arc) % arc
    let lo = 0,
      hi = n
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (columns[mid].s > u) hi = mid
      else lo = mid
    }
    const a = columns[lo],
      c = columns[hi % n],
      f = (u - a.s) / ((hi === n ? arc : c.s) - a.s)
    const v = limit(level, 0, 16.999),
      j = Math.floor(v),
      t = v - j
    const p = a.g[j],
      q = c.g[j],
      r = c.g[j + 1],
      s = a.g[j + 1]
    const pt =
      f >= t
        ? p.map((n, i) => n * (1 - f) + q[i] * (f - t) + r[i] * t)
        : p.map((n, i) => n * (1 - t) + r[i] * f + s[i] * (t - f))
    const nm = f >= t ? unit(cross(sub(q, p), sub(r, p))) : unit(cross(sub(r, p), sub(s, p)))
    return pt.map((x, i) => x + nm[i] * out)
  }
  const rock = [0x5c717c, 0x647c77, 0x7e7d74, 0x6c696b, 0x596969].map(rgb)
  const vein = [0xa1aaa3, 0xb3aba1, 0xa9b9b5, 0x969c94].map(rgb)
  const moss = [0x738861, 0x63846b, 0x85875d, 0x788863].map(rgb)
  for (let u = 1.8; u < arc; u += 4 + rng() * 8.2) {
    const pt = sample(u, 0)
    if (pt[2] > 81 && Math.abs(pt[0]) < 19) continue
    const base = 2.8 + 8.8 * rng(),
      w = 4.1 + 9.2 * rng(),
      h = 0.58 + 1.6 * rng(),
      proj = 0.64 + 2.45 * rng()
    const outline = [
      [-0.6, -0.11],
      [-0.38, -0.54],
      [0.12, -0.65],
      [0.56, -0.24],
      [0.5, 0.4],
      [-0.09, 0.59],
      [-0.51, 0.3],
    ]
    const shell = outline.map(([s, t]) => sample(u + s * w, base + t * h, -0.48))
    const lip = outline.map(([s, t]) =>
      sample(u + s * w * 0.79, base + t * h * 0.76, proj * (0.45 - 0.25 * s))
    )
    const center = sample(u - 0.035 * w, base - 0.14 * h, proj)
    const color = blend(rockColor(pt, Math.floor(base)), rock[Math.floor(rng() * rock.length)], 0.23)
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length,
        c = tint(color, 0.85 + rng() * 0.17)
      b.face(m.rockStrake, [shell[i], shell[j], lip[j], lip[i]], c)
      b.face(m.rockStrake, [lip[i], lip[j], center], tint(color, 0.98 + 0.17 * rng()))
    }
    if (rng() < 0.65) {
      const span = 2.4 + 7.8 * rng(),
        stroke = 0.03 + 0.088 * rng(),
        slope = 0.48 * (rng() - 0.5),
        fresh = base < 5 && rng() < 0.48
      let prev
      for (let j = 0; j <= 16; j++) {
        const t = j / 16,
          v = base + 0.45 + slope * t + 0.1 * Math.sin(t * 4 + 0.4)
        const split = stroke * (0.08 + 0.92 * Math.sin(t * Math.PI))
        const pair = [
          sample(u + 0.45 * w + t * span, v - split, 0.09),
          sample(u + 0.45 * w + t * span, v + split, 0.09),
        ]
        if (prev)
          b.face(
            fresh ? m.karstNeedle : m.cliffQuartz,
            [prev[0], pair[0], pair[1], prev[1]],
            fresh ? moss[Math.floor(u) % 4] : vein[Math.floor(u) % 4]
          )
        prev = pair
      }
    }
  }
  for (let u = 4.5; u < arc; u += 21 + 19 * rng()) {
    const offset = 4 + 4 * rng(),
      span = 4.5 + 4.7 * rng(),
      sweep = (rng() - 0.5) * 19
    for (const [width, branch] of [
      [0.23, 0],
      [0.09, 3.8],
    ]) {
      let prev
      const c = vein[Math.floor(rng() * 4)]
      for (let i = 0; i <= 28; i++) {
        const t = i / 28,
          level = offset + t * span,
          at = u + sweep * t + 1.4 * Math.sin(t * 6.3 + 0.7) + branch * t * t
        const half =
          width *
          (0.08 + 0.92 * Math.pow(Math.sin(t * Math.PI), 0.61)) *
          (1 + 0.56 * t + 0.26 * Math.sin(11 * t))
        const pair = [sample(at - half, level, 0.11), sample(at + half, level, 0.11)]
        if (prev) b.face(m.cliffQuartz, [prev[0], pair[0], pair[1], prev[1]], c)
        prev = pair
      }
    }
  }
  const faces = []
  const face = (a, c, d) => {
    const det = (c[2] - d[2]) * (a[0] - d[0]) + (d[0] - c[0]) * (a[2] - d[2])
    if (Math.abs(det) < 1e-8) return
    faces.push({
      a,
      c,
      d,
      det,
      lx: Math.min(a[0], c[0], d[0]),
      hx: Math.max(a[0], c[0], d[0]),
      lz: Math.min(a[2], c[2], d[2]),
      hz: Math.max(a[2], c[2], d[2]),
    })
  }
  for (let i = 0; i < n; i++) {
    const a = columns[i].g,
      c = columns[(i + 1) % n].g
    for (let j = 10; j < a.length - 1; j++) {
      face(a[j], c[j], c[j + 1])
      face(a[j], c[j + 1], a[j + 1])
    }
    face(a.at(-1), c.at(-1), core)
  }
  function floor(x, z, offset) {
    let min = Infinity
    for (const f of faces) {
      if (x < f.lx || x > f.hx || z < f.lz || z > f.hz) continue
      const { a, c, d, det } = f,
        u = ((c[2] - d[2]) * (x - d[0]) + (d[0] - c[0]) * (z - d[2])) / det,
        v = ((d[2] - a[2]) * (x - d[0]) + (a[0] - d[0]) * (z - d[2])) / det
      if (u >= -0.000001 && v >= -0.000001 && u + v <= 1.000001)
        min = Math.min(min, u * a[1] + v * c[1] + (1 - u - v) * d[1])
    }
    return Number.isFinite(min) ? [x, min - offset, z] : null
  }
  const paths = [
    (t) => {
      const z = mix(-75, 56, t)
      return [0.35 * z + 7 * Math.sin(z * 0.065) - 6, z]
    },
    (t) => {
      const x = mix(-50, 51, t)
      return [x, -0.45 * x + 4 * Math.sin(x * 0.17) - 19]
    },
    (t) => {
      const z = mix(-68, 49, t)
      return [24 - 0.49 * z - 3.9 * Math.cos(z * 0.135), z]
    },
  ]
  for (const [index, path] of paths.entries()) {
    const chart = (t, shift, drop) => {
      const c = path(t),
        d = path(t + 0.0001),
        dx = d[0] - c[0],
        dz = d[1] - c[1],
        l = Math.hypot(dx, dz)
      return floor(c[0] - (shift * dz) / l, c[1] + (shift * dx) / l, drop)
    }
    for (const [offset, width, mat, color] of [
      [-1.25, 0.61, m.rockStrake, rock[0]],
      [-1.55, 0.18, m.cliffQuartz, vein[index]],
      [-0.72, 0.083, m.cliffQuartz, tint(vein[index], 0.79)],
    ]) {
      let last
      for (let j = 0; j <= 124; j++) {
        const t = j / 124,
          p = offset + 0.48 * Math.sin(16 * t + index) + 0.29 * Math.cos(39 * t)
        const w = width * (0.06 + 0.94 * Math.sin(Math.PI * t)) * (0.73 + 0.27 * Math.sin(t * 22.6 + index))
        const pair = [chart(t, p - w, 0.125), chart(t, p + w, 0.125)]
        if (last && pair.every(Boolean) && last.every(Boolean))
          b.face(mat, [last[0], pair[0], pair[1], last[1]], color)
        last = pair
      }
    }
    for (let t = 0.1; t < 0.97; t += 0.085 + 0.083 * rng()) {
      const s = 0.031 + 0.031 * rng(),
        w = 2.9 + 3.6 * rng(),
        lift = 0.83 + 1.95 * rng(),
        side = (rng() - 0.34) * 3.5
      const shape = [
        [-1, -0.33],
        [-0.43, -0.97],
        [0.5, -0.66],
        [0.96, 0.12],
        [0.47, 0.75],
        [-0.56, 0.91],
      ]
      const backs = shape.map(([a, c]) => chart(t + s * a, side + w * c, -0.51))
      const rim = shape.map(([a, c]) =>
        chart(t + s * a * 0.84, side + w * c * 0.71, lift * (0.44 + 0.24 * c))
      )
      const tip = chart(t - 0.18 * s, side + 0.14 * w, lift)
      if (!tip || [...rim, ...backs].some((v) => !v)) continue
      const col = blend(rock[index], rock[3], 0.12 + 0.26 * rng())
      for (let j = 0; j < shape.length; j++) {
        const k = (j + 1) % shape.length
        b.face(m.rockStrake, [backs[j], backs[k], rim[k], rim[j]], tint(col, 0.87 + 0.14 * rng()))
        b.face(m.rockStrake, [rim[j], rim[k], tip], tint(col, 0.99 + 0.12 * rng()))
      }
    }
  }
  return sample
}
