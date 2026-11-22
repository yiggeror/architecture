import * as T from 'three'
import { add, scaled, sub, unit, cross, lerp3 } from './mesh.js'

export const TAU = Math.PI * 2
const mix = (a, b, t) => a + (b - a) * t
const polar = (a, r, y = 0) => [Math.cos(a) * r, y, Math.sin(a) * r]
const atY = (p, y) => [p[0], y, p[1]]
const normal = (b, m, p, c = 1) => {
  const n = cross(sub(p[1], p[0]), sub(p[2], p[0]))
  b.face(m, n[1] < 0 ? p.slice().reverse() : p, c)
}

export function footprint(rx, rz, clip = 0.16) {
  const dx = Math.min(rx, rz) * clip
  return [
    [-rx + dx, rz],
    [rx - dx, rz],
    [rx, rz - dx],
    [rx, -rz + dx],
    [rx - dx, -rz],
    [-rx + dx, -rz],
    [-rx, -rz + dx],
    [-rx, rz - dx],
  ]
}
function cappedRing(b, m, outer, inner, y, shade) {
  if (!inner.length) {
    normal(
      b,
      m,
      outer.map((p) => atY(p, y)),
      shade
    )
    return
  }
  const vec = (pts) => pts.map((p) => new T.Vector2(...p))
  const tris = T.ShapeUtils.triangulateShape(vec(outer), [vec(inner)])
  const pts = [...outer, ...inner].map((p) => atY(p, y))
  for (const tri of tris)
    normal(
      b,
      m,
      tri.map((i) => pts[i]),
      shade
    )
}
export function floorDeck(b, m, rx, rz, top, thick, hole = 0, clip = 0.3) {
  const outer = footprint(rx, rz, clip)
  const inner = hole
    ? Array.from({ length: 36 }, (_, i) => [hole * Math.cos((i * TAU) / 36), hole * Math.sin((i * TAU) / 36)])
    : []
  cappedRing(b, m.tiles, outer, inner, top, 1.07)
  cappedRing(b, m.darkwood, outer, inner, top - thick, 0.88)
  for (const loop of [outer, inner]) {
    for (let i = 0; i < loop.length; i++) {
      const j = (i + 1) % loop.length
      b.face(m.timber, [
        atY(loop[i], top),
        atY(loop[j], top),
        atY(loop[j], top - thick),
        atY(loop[i], top - thick),
      ])
    }
  }
}

export function rail(b, m, a, c, spacing = 2.5, style = 'stone') {
  const n = Math.max(1, Math.round(Math.hypot(c[0] - a[0], c[2] - a[2]) / spacing)),
    stone = style === 'stone'
  const cap = stone ? m.coping : m.bronze,
    post = stone ? m.stone : m.teal,
    wood = stone ? m.pearl : m.darkwood
  const rise = (p, h) => add(p, [0, h, 0])
  b.beam(cap, rise(a, 0.99), rise(c, 0.99), stone ? 0.16 : 0.105, 0.11)
  b.beam(wood, rise(a, 0.35), rise(c, 0.35), stone ? 0.105 : 0.068, 0.09)
  for (let i = 0; i <= n; i++) {
    const p = lerp3(a, c, i / n)
    b.tube(post, p, rise(p, 1.02), 0.123, 0.115, 4, 1, false)
    b.box(cap, p[0], p[1] + 1.05, p[2], 0.23, 0.1, 0.23)
    if (i < n && !stone) {
      const q = lerp3(a, c, (i + 0.5) / n),
        dx = ((c[0] - a[0]) / n) * 0.24,
        dz = ((c[2] - a[2]) / n) * 0.24
      const diamond = [
        [-dx, 0.65, -dz],
        [0, 0.91, 0],
        [dx, 0.65, dz],
        [0, 0.39, 0],
        [-dx, 0.65, -dz],
      ]
      for (let j = 1; j < diamond.length; j++)
        b.tube(m.bronze, add(q, diamond[j - 1]), add(q, diamond[j]), 0.038, 0.038, 3, 1, false)
    }
  }
}
export function perimeter(b, m, rx, rz, y, clip, skip, style = 'stone') {
  const loop = footprint(rx, rz, clip)
  for (let i = 0; i < loop.length; i++) {
    const j = (i + 1) % loop.length,
      a = atY(loop[i], y),
      c = atY(loop[j], y)
    const intervals = skip[i] || [[0, 1]]
    for (const [lo, hi] of intervals)
      if (hi - lo > 0.008) rail(b, m, lerp3(a, c, lo), lerp3(a, c, hi), style === 'stone' ? 3.2 : 2.0, style)
  }
}
export function plinth(b, m, x, z, w, d, bottom, top, chamfer = 0.21) {
  b.at(x, 0, z, 0, () => {
    const height = top - bottom,
      rx = w / 2,
      rz = d / 2
    const profiles = [
      [0, bottom, m.foundation],
      [0.07, bottom + 0.16, m.stone],
      [-0.1, bottom + 0.35, m.foundation],
      [-0.29, top - 0.46, m.foundation],
      [-0.12, top - 0.32, m.patina],
      [0.1, top - 0.17, m.coping],
      [0, top, m.coping],
    ]
    const rings = profiles.map(([o, y]) => footprint(rx + o, rz + o, chamfer).map((p) => atY(p, y)))
    normal(b, m.tiles, rings.at(-1), 1.03)
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < 8; i++) {
        const k = (i + 1) % 8,
          a = rings[j - 1][i],
          c = rings[j - 1][k],
          u = rings[j][i],
          v = rings[j][k]
        if (j === 3) {
          const count = Math.max(1, Math.round(Math.hypot(c[0] - a[0], c[2] - a[2]) / 3.1))
          const rows = Math.max(1, Math.round((height - 0.8) / 0.91))
          for (let r = 0; r < rows; r++)
            for (let h = 0; h <= count; h++) {
              const s = Math.max(0, (h - (r % 2) * 0.5) / count),
                t = Math.min(1, (h + 1 - (r % 2) * 0.5) / count)
              if (t <= s) continue
              const L = lerp3(a, u, r / rows),
                R = lerp3(c, v, r / rows),
                U = lerp3(a, u, (r + 1) / rows),
                V = lerp3(c, v, (r + 1) / rows)
              b.face(
                m.foundation,
                [lerp3(L, R, s), lerp3(L, R, t), lerp3(U, V, t), lerp3(U, V, s)],
                0.83 + (0.16 * ((h * 7 + r * 13 + i * 5) % 11)) / 10
              )
            }
        } else b.face(profiles[j][2], [a, c, v, u], j === 4 ? 0.78 : 1)
      }
    for (const i of [0, 2, 4, 6]) {
      const a = rings[3][i],
        c = rings[3][(i + 1) % 8],
        len = Math.hypot(c[0] - a[0], c[2] - a[2])
      const count = Math.max(1, Math.floor(len / 6.8)),
        out = unit(cross(sub(c, a), [0, 1, 0]))
      for (let k = 0; k < count; k++) {
        const q = add(lerp3(a, c, (k + 0.5) / count), scaled(out, 0.04))
        b.at(q[0], top - 0.78, q[2], Math.atan2(out[0], out[2]), () => {
          b.box(m.coping, 0, 0, 0.07, 0.87, 0.28, 0.16, 0.92)
          b.box(m.bronze, 0, 0, 0.16, 0.61, 0.052, 0.024, 0.75)
        })
      }
    }
  })
}
export function stair(b, m, x, z, low, high, width, run, rotation = 0, rails = true) {
  const n = Math.ceil((high - low) / 0.197),
    step = (high - low) / n,
    tread = run / n
  b.at(x, 0, z, rotation, () => {
    for (let i = 0; i < n; i++) {
      const y = low + (i + 1) * step,
        near = -i * tread,
        far = -(i + 1) * tread,
        w = width / 2
      b.face(
        m.stone,
        [
          [-w, y, near],
          [w, y, near],
          [w, y, far],
          [-w, y, far],
        ],
        0.96 + 0.06 * (i % 3)
      )
      b.face(
        m.coping,
        [
          [-w, y - step, near],
          [w, y - step, near],
          [w, y, near],
          [-w, y, near],
        ],
        i % 5 === 0 ? 1.08 : 0.89
      )
      for (const s of [-1, 1])
        b.face(
          m.foundation,
          [
            [s * w, low - 0.15, near],
            [s * w, low - 0.15, far],
            [s * w, y, far],
            [s * w, y, near],
          ],
          0.88
        )
      if (i % 5 === 0) b.box(m.bronze, 0, y + 0.0025, near - 0.064, width * 0.88, 0.005, 0.036, 0.8)
    }
    if (rails)
      for (const s of [-1, 1])
        rail(b, m, [s * (width / 2 - 0.13), low, 0], [s * (width / 2 - 0.13), high, -run], 2.65, 'stone')
  })
}
export function pillar(b, m, x, z, y, h, r = 0.33) {
  b.tube(m.stone, [x, y, z], [x, y + 0.37, z], r * 1.55, r * 1.29, 8, 1, false)
  b.tube(m.bronze, [x, y + 0.36, z], [x, y + 0.46, z], r * 1.32, r * 1.11, 8, 1, false)
  b.tube(m.vermilion, [x, y + 0.45, z], [x, y + h - 0.31, z], r, r * 0.88, 9, 1, false)
  b.box(m.teal, x, y + h - 0.28, z, r * 2.48, 0.33, r * 2.48)
  const crown = [
    [x - r * 1.57, z - r * 1.34],
    [x + r * 1.57, z - r * 1.34],
    [x + r * 1.57, z + r * 1.34],
    [x - r * 1.57, z + r * 1.34],
  ]
  for (let i = 0; i < 4; i++) {
    const a = crown[i],
      c = crown[(i + 1) % 4]
    b.face(m.bronze, [
      [a[0], y + h - 0.16, a[1]],
      [c[0], y + h - 0.16, c[1]],
      [c[0], y + h, c[1]],
      [a[0], y + h, a[1]],
    ])
  }
}
export function lightBox(b, m, x, y, z, r = 0.36, h = 0.72, mat = m.lantern) {
  const n = 6
  const rings = [
    [0.64, -0.52],
    [1, -0.32],
    [1, 0.32],
    [0.64, 0.52],
  ].map(([rad, level]) =>
    Array.from({ length: n }, (_, i) => add([x, y + level * h, z], polar((TAU * (i + 0.5)) / n, rad * r)))
  )
  for (let k = 1; k < rings.length; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      b.face(
        k === 2 ? mat : m.bronze,
        [rings[k - 1][i], rings[k - 1][j], rings[k][j], rings[k][i]],
        0.96 + 0.055 * (i % 2)
      )
    }
  b.face(m.bronze, rings[0])
  b.face(m.bronze, rings[3].slice().reverse())
  for (let i = 0; i < n; i += 2) b.beam(m.bronze, rings[1][i], rings[2][i], r * 0.065, r * 0.065)
  b.tube(m.vermilion, [x, y - h * 0.85, z], [x, y - h * 0.51, z], r * 0.035, r * 0.085, 4)
}
export function ring(b, m, center, radius, tube, plane = 'xy', count = 36, shade = 1) {
  const p = (a) =>
    plane === 'xy'
      ? [center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a), center[2]]
      : plane === 'yz'
        ? [center[0], center[1] + radius * Math.sin(a), center[2] + radius * Math.cos(a)]
        : [center[0] + radius * Math.cos(a), center[1], center[2] + radius * Math.sin(a)]
  const segments = radius < 0.67 ? Math.min(18, count) : radius < 3 ? Math.min(36, count) : count,
    sides = tube >= 0.12 ? 5 : 4
  for (let i = 0; i < segments; i++)
    b.tube(m, p((i * TAU) / segments), p(((i + 1) * TAU) / segments), tube, tube, sides, shade, false)
}
export function eaves(
  b,
  m,
  { x = 0, z = 0, y, outer, inner, rise, lift = 0.86, clip = 0.38, metal = false, pendants = false }
) {
  const lo = footprint(...outer, clip),
    hi = footprint(...inner, clip)
  b.at(x, y, z, 0, () => {
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8,
        L = lo[i],
        R = lo[j],
        U = hi[i],
        V = hi[j]
      const p = (s, t, offset = 0) => {
        const xx = mix(mix(L[0], R[0], s), mix(U[0], V[0], s), t)
        const zz = mix(mix(L[1], R[1], s), mix(U[1], V[1], s), t)
        return [
          xx,
          rise * (0.12 * t + 0.88 * t ** 1.64) +
            lift * (1 - t) ** 2.45 * Math.abs(s * 2 - 1) ** 3.85 +
            offset,
          zz,
        ]
      }
      const length = Math.hypot(R[0] - L[0], R[1] - L[1]),
        cols = Math.max(2, Math.ceil(length / 1.62)),
        rows = 5
      for (let col = 0; col < cols; col++) {
        const a = col / cols,
          c = (col + 1) / cols
        for (let row = 0; row < rows; row++) {
          const u = row / rows,
            v = (row + 1) / rows
          const surface = [p(a, u), p(c, u), p(c, v), p(a, v)]
          const uv = (s, t) => [
            length * s * 0.69,
            t * Math.max(outer[0] - inner[0], outer[1] - inner[1]) * 0.79,
          ]
          b.face(m.roof, surface, 0.82 + 0.11 * (i % 3), [uv(a, u), uv(c, u), uv(c, v), uv(a, v)])
          if (row < 3)
            b.face(m.darkwood, [p(a, u, -0.19), p(a, v, -0.19), p(c, v, -0.19), p(c, u, -0.19)], 0.85)
        }
        b.face(
          m.summitGold,
          [p(a, 0, 0.095), p(c, 0, 0.095), p(c, 0, -0.045), p(a, 0, -0.045)],
          metal ? 1.09 : 0.81
        )
        b.face(m.vermilion, [p(a, 0, -0.045), p(c, 0, -0.045), p(c, 0, -0.212), p(a, 0, -0.212)])
        b.face(m.bronze, [p(a, 0, 0.094), p(a, 0.049, 0.07), p(c, 0.049, 0.07), p(c, 0, 0.094)], 0.9)
        if (col % 2 === 0) b.beam(m.wood, p(a, 0, -0.22), p(a, 0.61, -0.25), 0.13, 0.14)
      }
      const rib = Array.from({ length: 6 }, (_, k) => p(0, k / 5, 0.113))
      for (let k = 1; k < rib.length; k++)
        b.tube(metal ? m.bronze : m.roofEdge, rib[k - 1], rib[k], 0.13, 0.12, 5, 1, false)
      const tip = p(0, 0, 0.14),
        out = unit([L[0], 0, L[1]])
      const flank = add(tip, add(scaled(out, 0.43), [0, 0.3, 0])),
        crest = add(tip, add(scaled(out, 0.7), [0, 0.83, 0]))
      b.tube(m.bronze, tip, flank, 0.17, 0.113, 6)
      b.tube(m.bronze, flank, crest, 0.113, 0.018, 6)
      if (pendants && i % 2 === 0) {
        const hook = p(0.13, 0, -0.17)
        b.tube(m.bronze, hook, add(hook, [0, -0.6, 0]), 0.028, 0.021, 5)
        lightBox(b, m, hook[0], hook[1] - 0.97, hook[2], 0.28, 0.61, m.paper)
      }
    }
  })
}
