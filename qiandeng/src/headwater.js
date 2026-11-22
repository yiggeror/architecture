import * as T from 'three'
import { generator } from './mesh.js'
import { cascades, flowingWater } from './headwaterFlow.js'
import { shoulders, waterworks, stoneSpine, patternedRail, mineralSurface } from './headwaterCarving.js'

export const HEAD_LEVEL = 26.55
const low = 1.35,
  middle = 13.95,
  top = HEAD_LEVEL
const mix = (a, c, v) => a + (c - a) * v
const front = [
  [-46.95, -71.38],
  [-36.7, -71.13],
  [-25.5, -71.55],
  [-17.3, -71.52],
  [-12.0, -72.07],
  [-8.41, -74.53],
  [15.26, -74.53],
  [19.81, -72.42],
  [24.3, -71.62],
  [34.8, -71.18],
  [43.52, -71.52],
  [54.4, -71.64],
]
const rim = [
  ...front,
  [54.4, -98.94],
  [54.23, -116.94],
  [50.27, -121.16],
  [33.0, -121.69],
  [13.4, -121.24],
  [-6.6, -121.75],
  [-23.3, -121.41],
  [-42.75, -121.12],
  [-46.95, -117.25],
  [-46.95, -98.55],
]
const roofEdge = [
  [-46.95, -70.91, -117.25],
  [-42.75, -70.73, -121.12],
  [-25.5, -70.66, -121.4],
  [-20.71, -70.64, -121.47],
  [-17.4, -66.08, -121.55],
  [-6.6, -66.08, -121.75],
  [13.4, -66.08, -121.24],
  [20.37, -66.08, -121.4],
  [23.3, -70.44, -121.49],
  [33.0, -70.64, -121.69],
  [50.27, -70.83, -121.16],
  [54.4, -71.05, -116.94],
]
function makeFinishes(m) {
  if (m.headBasalt) return
  m.headBasalt = m.foundation.clone()
  m.headBasalt.name = 'headBasalt'
  m.headBasalt.color.set(0x62716f)
  m.headLime = m.coping.clone()
  m.headLime.name = 'headLime'
  m.headLime.color.set(0xb0b3a4)
  m.headWet = m.stone.clone()
  m.headWet.name = 'headWet'
  m.headWet.color.set(0x586d70)
  m.headWet.roughness = 0.35
  m.headAshlar = m.stone.clone()
  m.headAshlar.name = 'headAshlar'
  m.headAshlar.color.set(0x87918f)
  const [map, normalMap] = mineralSurface()
  for (const key of ['headBasalt', 'headLime', 'headWet', 'headAshlar']) {
    m[key].map = map
    m[key].normalMap = normalMap
    m[key].normalScale.set(0.21, 0.21)
  }
}

function deck(b, m) {
  for (let j = 1; j < roofEdge.length; j++) {
    const [a, af, ab] = roofEdge[j - 1],
      [c, cf, cb] = roofEdge[j]
    b.face(
      m.headLime,
      [
        [a, top, af],
        [c, top, cf],
        [c, top, cb],
        [a, top, ab],
      ],
      0.95
    )
    for (const [p, q] of [
      [af, cf],
      [ab, cb],
    ]) {
      const h = top - 0.41
      b.face(
        m.coping,
        [
          [a, h, p],
          [c, h, q],
          [c, top, q],
          [a, top, p],
        ],
        0.93
      )
      b.face(
        m.bronze,
        [
          [a, h + 0.05, p + 0.013 * Math.sign(p + 94)],
          [c, h + 0.05, q + 0.013 * Math.sign(q + 94)],
          [c, h + 0.103, q + 0.013 * Math.sign(q + 94)],
          [a, h + 0.103, p + 0.013 * Math.sign(p + 94)],
        ],
        0.88
      )
    }
    const count = Math.max(1, Math.round((c - a) / 2.67))
    for (let k = 0; k < count; k++) {
      const x = mix(a, c, (k + 0.5) / count),
        f = mix(af, cf, (k + 0.5) / count),
        r = mix(ab, cb, (k + 0.5) / count)
      b.box(m.ink, x, top + 0.0015, (f + r) / 2, 0.02, 0.006, f - r - 0.035, 0.69)
    }
    for (let z = -68.04; z > -121.5; z -= 2.48) {
      if (z > Math.max(af, cf) || z < Math.min(ab, cb)) continue
      let left = 0,
        right = 1
      if (z > af) left = (z - af) / (cf - af)
      if (z > cf) right = (z - af) / (cf - af)
      if (z < ab) left = Math.max(left, (z - ab) / (cb - ab))
      if (z < cb) right = Math.min(right, (z - ab) / (cb - ab))
      const l = mix(a, c, left),
        r = mix(a, c, right)
      if (r - l > 0.04)
        b.face(
          m.ink,
          [
            [l, top + 0.002, z - 0.008],
            [r, top + 0.002, z - 0.008],
            [r, top + 0.002, z + 0.008],
            [l, top + 0.002, z + 0.008],
          ],
          0.72
        )
    }
  }
  const breaks = [...new Set([...front, ...roofEdge].map(([x]) => x))].sort((a, c) => a - c)
  const edge = (points, x) => {
    const i = points.findIndex((p) => p[0] >= x)
    if (i === 0) return points[i][1]
    const a = points[i - 1],
      c = points[i]
    return mix(a[1], c[1], (x - a[0]) / (c[0] - a[0]))
  }
  for (let i = 1; i < breaks.length; i++) {
    const a = breaks[i - 1],
      c = breaks[i]
    b.face(
      m.headBasalt,
      [
        [a, top - 0.409, edge(front, a) - 0.12],
        [c, top - 0.409, edge(front, c) - 0.12],
        [c, top - 0.409, edge(roofEdge, c)],
        [a, top - 0.409, edge(roofEdge, a)],
      ],
      0.81
    )
  }
  for (const x of [-16.2, -13.4, -7.52, -1.58, 6.95, 14.26, 18.73]) {
    const z = edge(front, x),
      f = edge(roofEdge, x),
      length = f - z
    b.beam(m.headLime, [x, 24.67, z - 0.33], [x, top - 0.65, f - 0.56], 0.49, 0.43, 0.88)
    b.box(m.headWet, x, top - 0.53, (z + f) / 2, 0.65, 0.36, length, 0.86)
    b.box(m.patina, x, top - 0.45, f - 0.38, 0.96, 0.24, 0.71, 0.94)
    b.box(m.bronze, x, top - 0.66, f - 0.36, 0.46, 0.11, 0.49, 0.83)
  }
  for (const [a, c] of [
    [-13.3, -7.56],
    [-7.48, -1.61],
    [-1.54, 6.9],
    [7.03, 14.2],
    [14.33, 18.68],
  ]) {
    for (const z of [-70.76, -68.39]) {
      b.box(m.patina, (a + c) / 2, top - 0.55, z, c - a, 0.16, 0.15, 0.77)
      const y = top - 0.422,
        mid = (a + c) / 2
      const points = [
        [a + 0.85, y, z + 0.61],
        [mid, y, z + 1.08],
        [c - 0.85, y, z + 0.61],
        [mid, y, z + 0.14],
      ]
      b.face(m.teal, points, [0.78, 0.8, 0.75])
      for (let i = 0; i < 4; i++) {
        const p = points[i],
          q = points[(i + 1) % 4]
        b.face(
          m.bronze,
          [
            [p[0], y - 0.008, p[2] - 0.031],
            [q[0], y - 0.008, q[2] - 0.031],
            [q[0], y - 0.008, q[2] + 0.031],
            [p[0], y - 0.008, p[2] + 0.031],
          ],
          0.84
        )
      }
    }
  }
  for (const [a, c] of [
    [-17.25, -12.11],
    [-8.31, 15.72],
    [19.77, 20.31],
  ])
    patternedRail(b, m, [a, -66.15], [c, -66.15])
  for (const [a, c] of [
    [-46.88, -43.0],
    [-43.0, -31.3],
    [-28.3, -20.83],
    [23.65, 35.64],
    [39.06, 54.24],
  ])
    patternedRail(b, m, [a, edge(roofEdge, a) - 0.09], [c, edge(roofEdge, c) - 0.09])
  for (let i = 1; i < roofEdge.length; i += 2) {
    const [x, , z] = roofEdge[i - 1],
      [cx, , cz] = roofEdge[i]
    patternedRail(b, m, [x + 0.21, z + 0.1], [cx - 0.21, cz + 0.1])
  }
}

function outline(x, y, hw, stem, arch, n = 16) {
  const path = [
    [x - hw, y],
    [x + hw, y],
  ]
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI * i) / n
    path.push([x + hw * Math.cos(a), y + stem + arch * Math.sin(a)])
  }
  return path
}
function frontFace(b, mat, outer, holes, depth, tint) {
  const vecs = (p) => p.map(([x, y]) => new T.Vector2(x, y))
  const triang = T.ShapeUtils.triangulateShape(vecs(outer), holes.map(vecs)),
    all = outer.concat(...holes)
  for (const face of triang)
    b.face(
      mat,
      face.map((i) => [all[i][0], all[i][1], depth(all[i][1])]),
      tint
    )
}
function crownArch(b, m, slot, depth, width = 0.25) {
  const { x, y, w, spring, rise } = slot
  const n = 15
  for (let j = 0; j < n; j++) {
    const a = (Math.PI * (j + 0.012)) / n,
      c = (Math.PI * (j + 0.988)) / n
    const p = (q, t, z) => [x + (w * 0.5 + t) * Math.cos(q), y + spring + (rise + t) * Math.sin(q), z]
    const z = depth(y + spring) + 0.051
    b.face(
      m.headLime,
      [p(a, 0, z), p(c, 0, z), p(c, width, z), p(a, width, z)],
      0.82 + (0.15 * ((j * 17) % 13)) / 13
    )
    b.face(m.headBasalt, [p(a, 0, z), p(c, 0, z), p(c, 0, -0.735), p(a, 0, -0.735)], 0.75)
  }
  for (const s of [-1, 1]) {
    b.box(
      m.headLime,
      x + (s * (w + width)) / 2,
      y + spring / 2,
      depth(y + spring / 2) + 0.035,
      width,
      spring,
      0.12,
      0.84
    )
    b.face(
      m.headWet,
      [
        [x + (s * w) / 2, y, depth(y)],
        [x + (s * w) / 2, y + spring, depth(y + spring)],
        [x + (s * w) / 2, y + spring, -0.73],
        [x + (s * w) / 2, y, -0.73],
      ],
      0.75
    )
  }
  b.box(m.coping, x, y - 0.03, -0.33, w + width * 2, 0.11, 1.23, 0.86)
}
function chamber(b, m, world, width, id, area, random) {
  const depth = (y) => 0.41 * (1 - (y - low) / (top - low))
  const slots = []
  if (area === 'throat') {
    slots.push(
      { x: 4.02, y: 10.31, w: 2.92, spring: 1.94, rise: 1.15 },
      { x: 11.36, y: 17.06, w: 4.61, spring: 2.03, rise: 1.53 },
      { x: 19.15, y: 10.45, w: 3.18, spring: 1.92, rise: 1.23 },
      { x: 11.6, y: 2.62, w: 4.78, spring: 2.88, rise: 1.63 }
    )
  } else if (width > 7.2) {
    const n = Math.max(1, Math.floor(width / 7.24))
    for (let k = 0; k < n; k++) {
      const y = 3.95 + 1.05 * ((id + k) % 3)
      slots.push({
        x: (width * (k + 0.5)) / n,
        y,
        w: 2.44 + 0.47 * ((id + 2 * k) % 3),
        spring: 2.31 + 0.44 * ((k + id) % 2),
        rise: 1.1 + 0.16 * ((id + k) % 3),
      })
    }
  }
  const holes = slots.map((s) => outline(s.x, s.y, s.w / 2, s.spring, s.rise))
  frontFace(
    b,
    m.headBasalt,
    [
      [0, low],
      [width, low],
      [width, top - 0.32],
      [0, top - 0.32],
    ],
    holes,
    depth,
    0.88
  )
  b.face(
    m.ink,
    [
      [0, low, -0.75],
      [width, low, -0.75],
      [width, top - 0.32, -0.75],
      [0, top - 0.32, -0.75],
    ],
    0.63
  )
  for (const [i, s] of slots.entries()) {
    crownArch(b, m, s, depth, 0.3)
    for (const side of [-1, 1])
      b.box(m.patina, s.x + side * s.w * 0.22, s.y + s.spring * 0.52, -0.43, 0.071, s.spring, 0.084, 0.81)
    b.box(m.timber, s.x, s.y + s.spring * 0.62, -0.425, s.w * 0.91, 0.089, 0.098, 0.69)
    if (area === 'throat') {
      const shade = i === 3 ? 0.62 : 0.86
      for (const d of [-1, 1]) {
        b.box(
          i === 2 ? m.redSilk : m.paper,
          s.x + d * s.w * 0.27,
          s.y + s.spring * 0.6,
          -0.687,
          s.w * 0.18,
          s.spring * 0.84,
          0.019,
          shade
        )
        b.box(m.darkwood, s.x + d * s.w * 0.27, s.y + s.spring * 0.66, -0.655, s.w * 0.19, 0.1, 0.057, 0.75)
      }
      b.beam(
        m.patina,
        [s.x - s.w * 0.29, s.y + s.spring * 0.91, -0.602],
        [s.x, s.y + s.spring * 1.28, -0.602],
        0.098,
        0.078,
        0.81
      )
      b.beam(
        m.patina,
        [s.x, s.y + s.spring * 1.28, -0.602],
        [s.x + s.w * 0.29, s.y + s.spring * 0.91, -0.602],
        0.098,
        0.078,
        0.81
      )
    }
    if ((i + id) % 2 === 0 || area === 'throat') {
      const ly = s.y + s.spring * 0.73
      b.tube(m.lantern, [s.x, ly - 0.26, -0.49], [s.x, ly + 0.26, -0.49], 0.172, 0.172, 8, 0.81, false)
      for (const sign of [-1, 1]) b.box(m.patina, s.x, ly + sign * 0.27, -0.49, 0.41, 0.061, 0.41)
      world.lamp(
        ...b.point([s.x, ly, -0.4]),
        i === 2 && area === 'throat' ? 0xf4754e : 0xffbc75,
        area === 'throat' ? 24 : 13.8,
        area === 'throat' ? 9 : 7.8
      )
    }
  }
  const count = 17
  for (let j = 0; j < count; j++) {
    const bottom = low + ((top - low - 0.33) * j) / count + 0.022,
      h = (top - low - 0.33) / count - 0.047
    const cell = 2.12 + 0.32 * (j % 3),
      n = Math.ceil(width / cell)
    for (let k = -1; k < n; k++) {
      const x0 = Math.max(0, (width * (k + (j % 2) * 0.5)) / n) + 0.017,
        x1 = Math.min(width, (width * (k + 1 + (j % 2) * 0.5)) / n) - 0.016
      if (
        x1 <= x0 + 0.04 ||
        slots.some(
          (s) =>
            x0 < s.x + s.w * 0.5 + 0.3 &&
            x1 > s.x - s.w * 0.5 - 0.3 &&
            bottom < s.y + s.spring + s.rise + 0.32 &&
            bottom + h > s.y - 0.14
        )
      )
        continue
      const shade = 0.82 + 0.21 * random(),
        z0 = depth(bottom) + 0.028,
        z1 = depth(bottom + h) + 0.028
      b.face(
        j % 6 === 2 ? m.headWet : m.headAshlar,
        [
          [x0, bottom, z0],
          [x1, bottom, z0],
          [x1, bottom + h, z1],
          [x0, bottom + h, z1],
        ],
        [shade * 0.86, shade * 0.98, shade * 0.95]
      )
    }
  }
  for (const y of [2.06, 10.58, 18.87, 24.82]) {
    const z = depth(y) + 0.092
    b.box(
      y > 23 ? m.headLime : m.headBasalt,
      width / 2,
      y,
      z,
      width + 0.019,
      y > 23 ? 0.27 : 0.143,
      0.28,
      y > 23 ? 0.94 : 0.84
    )
    if (y > 23) b.box(m.bronze, width / 2, y + 0.015, z + 0.146, width, 0.041, 0.018, 0.7)
  }
}
function retaining(b, m, world) {
  const random = generator(38064)
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i],
      c = rim[(i + 1) % rim.length]
    const w = Math.hypot(c[0] - a[0], c[1] - a[1]),
      ang = Math.atan2(-(c[1] - a[1]), c[0] - a[0])
    b.at(a[0], 0, a[1], ang, () =>
      chamber(b, m, world, w, i, i === 5 ? 'throat' : i < front.length - 1 ? 'front' : 'outer', random)
    )
  }
}
function guard(b, m, a, c, z, base, hand = true) {
  const n = Math.max(1, Math.ceil((c - a) / 2.04)),
    w = (c - a) / n
  b.box(m.headLime, (a + c) / 2, base + 0.92, z, c - a, 0.103, 0.15, 0.92)
  b.box(m.headBasalt, (a + c) / 2, base + 0.14, z, c - a, 0.13, 0.19, 0.82)
  for (let k = 0; k <= n; k++) {
    const x = a + k * w
    b.box(m.stone, x, base + 0.51, z, 0.15, 0.995, 0.171, 0.9)
    if (hand && k < n) {
      const cx = x + w / 2
      for (const sign of [-1, 1])
        b.beam(
          m.patina,
          [cx - w * 0.33, base + 0.55, z],
          [cx, base + 0.55 + sign * 0.2, z],
          0.029,
          0.036,
          0.88
        )
      for (const sign of [-1, 1])
        b.beam(
          m.patina,
          [cx, base + 0.55 + sign * 0.2, z],
          [cx + w * 0.33, base + 0.55, z],
          0.029,
          0.036,
          0.88
        )
    }
  }
}
function beacon(b, m, world, x, z, y, k = 1) {
  b.at(x, y, z, 0, () =>
    b.scaleBy(k, () => {
      b.box(m.headLime, 0, 0.183, 0, 0.69, 0.366, 0.69)
      b.tube(m.headBasalt, [0, 0.35, 0], [0, 1.11, 0], 0.26, 0.17, 8)
      b.tube(m.patina, [0, 1.08, 0], [0, 1.21, 0], 0.28, 0.31, 8)
      b.tube(m.lantern, [0, 1.22, 0], [0, 1.79, 0], 0.224, 0.215, 8, 0.9, false)
      for (let j = 0; j < 4; j++) {
        const a = Math.PI * (0.25 + j * 0.5)
        b.box(m.bronze, 0.225 * Math.cos(a), 1.5, 0.225 * Math.sin(a), 0.041, 0.59, 0.041)
      }
      b.tube(m.patina, [0, 1.79, 0], [0, 2.02, 0], 0.364, 0.082, 8)
      world.lamp(...b.point([0, 1.52, 0]), 0xffbc79, 10.8 * k, 7.55 * k)
    })
  )
}
function stairArcade(b, m, world, profile, width, side, y0) {
  const length = profile.at(-1)[1],
    s = side,
    w = width / 2,
    depth = () => 0
  const high = (x) => profile.find((p) => x <= p[1] + 0.001)?.[2] ?? profile.at(-1)[2]
  b.at(0, 0, s * w, s === 1 ? 0 : Math.PI, () => {
    const outer = [
      [0, low - 0.065],
      [s * length, low - 0.065],
    ]
    for (const [a, c, y] of profile.slice().reverse()) outer.push([s * c, y - 0.067], [s * a, y - 0.067])
    const slots = []
    for (const t of [0.36, 0.65, 0.89]) {
      const x = length * t,
        y = y0 > 10 ? 2.63 + (t > 0.5 ? 1.1 : 0) : 1.63
      if (high(x - 1.24) < y + 2.95) continue
      slots.push({ x: s * x, y, w: y0 > 10 ? 2.72 : 2.12, spring: y0 > 10 ? 2.31 : 1.51, rise: 1.07 })
    }
    frontFace(
      b,
      m.headBasalt,
      outer,
      slots.map((v) => outline(v.x, v.y, v.w / 2, v.spring, v.rise)),
      depth,
      0.83
    )
    frontFace(b, m.ink, outer, [], () => -0.751, 0.7)
    for (const v of slots) {
      crownArch(b, m, v, depth, 0.24)
      b.box(m.timber, v.x, v.y + v.spring * 0.67, -0.54, v.w - 0.13, 0.09, 0.12, 0.76)
      for (const d of [-1, 1])
        b.box(
          m.patina,
          v.x + d * v.w * 0.22,
          v.y + v.spring * 0.57,
          -0.56,
          0.078,
          v.spring * 1.12,
          0.078,
          0.82
        )
      if (v.y > 2.1) {
        const yy = v.y + v.spring * 0.67
        b.tube(m.lantern, [v.x, yy - 0.28, -0.6], [v.x, yy + 0.28, -0.6], 0.15, 0.18, 6, 0.77, false)
        world.lamp(...b.point([v.x, yy, -0.48]), 0xffa667, 10.4, 6.9)
      }
    }
    for (let j = 0, lo = low + 0.085; lo < profile.at(-1)[2]; j++, lo += 1.23) {
      const start = profile.find((p) => p[2] >= lo + 1.22)?.[0]
      if (start === undefined) continue
      for (let k = -1; k < length / 2.7; k++) {
        const a = Math.max(start, (k + 0.46 * (j % 2)) * 2.74) + 0.021,
          c = Math.min(length, (k + 1 + 0.46 * (j % 2)) * 2.74) - 0.022
        if (c - a < 0.077) continue
        if (
          slots.some(
            (v) =>
              a < Math.abs(v.x) + v.w / 2 + 0.29 &&
              c > Math.abs(v.x) - v.w / 2 - 0.29 &&
              lo < v.y + v.spring + v.rise + 0.28 &&
              lo + 1.18 > v.y - 0.13
          )
        )
          continue
        const shade = 0.82 + (0.16 * ((3 * j + 7 * k + 19) % 13)) / 13
        b.face(
          j % 7 === 2 ? m.headWet : m.headAshlar,
          [
            [s * a, lo, 0.022],
            [s * c, lo, 0.022],
            [s * c, lo + 1.18, 0.022],
            [s * a, lo + 1.18, 0.022],
          ],
          [shade * 0.86, shade * 0.97, shade]
        )
      }
    }
  })
}
function staircase(b, m, world, a, c, y0, y1, width, flightCount, side) {
  const dx = c[0] - a[0],
    dz = c[1] - a[1],
    len = Math.hypot(dx, dz),
    ang = Math.atan2(-dz, dx)
  b.at(a[0], 0, a[1], ang, () => {
    const steps = 70,
      rise = (y1 - y0) / steps,
      landing = 1.53,
      tread = (len - (flightCount - 1) * landing) / steps
    const breaks = new Set(
      Array.from({ length: flightCount - 1 }, (_, k) => Math.round(((k + 1) * steps) / flightCount))
    )
    let x = 0,
      y = y0,
      section = 0,
      sY = y
    const profile = []
    const curb = (a, ay, c, cy) => {
      for (const s of [-1, 1]) {
        const z = s * (width / 2 - 0.055)
        b.beam(m.headBasalt, [a, ay + 0.13, z], [c, cy + 0.13, z], 0.183, 0.2, 0.84)
        b.beam(m.coping, [a, ay + 0.93, z], [c, cy + 0.93, z], 0.146, 0.116)
      }
    }
    for (let j = 1; j <= steps; j++) {
      const xx = x + tread,
        yy = y + rise
      const inner = (-side * width) / 2
      b.face(
        m.headBasalt,
        [
          [x, low - 0.065, inner],
          [xx, low - 0.065, inner],
          [xx, yy - 0.015, inner],
          [x, yy - 0.015, inner],
        ],
        0.84
      )
      const bottom = j === 1 ? low - 0.065 : y - 0.082
      b.face(
        m.headWet,
        [
          [x, bottom, -width / 2],
          [x, bottom, width / 2],
          [x, yy - 0.015, width / 2],
          [x, yy - 0.015, -width / 2],
        ],
        0.89
      )
      b.box(
        m.headLime,
        (x + xx) / 2,
        yy - 0.039,
        0,
        tread - 0.005,
        0.078,
        width + 0.019,
        0.9 + (j % 4) * 0.021
      )
      profile.push([x, xx, yy])
      if (j % 5 === 0)
        for (const s of [-1, 1]) {
          const z = s * (width / 2 - 0.055)
          b.box(m.stone, xx - 0.13, yy + 0.49, z, 0.154, 0.966, 0.18)
          b.box(m.coping, xx - 0.13, yy + 0.972, z, 0.223, 0.091, 0.245, 0.94)
        }
      if (j % 7 === 2) b.box(m.bronze, xx - 0.1, yy + 0.003, 0, 0.011, 0.006, width - 0.51, 0.77)
      x = xx
      y = yy
      if (breaks.has(j)) {
        curb(section, sY, x, y)
        b.box(
          m.stone,
          x + landing / 2,
          (low - 0.065 + y - 0.014) / 2,
          0,
          landing + 0.004,
          y - 0.014 - (low - 0.065),
          width + 0.32,
          0.88
        )
        b.box(m.coping, x + landing / 2, y - 0.051, 0, landing, 0.102, width + 0.33, 0.93)
        curb(x, y, x + landing, y)
        beacon(b, m, world, x + landing * 0.52, width / 2 + 0.21, y, 0.71)
        profile.push([x, x + landing, y])
        x += landing
        section = x
        sY = y
      }
    }
    curb(section, sY, x, y)
    stairArcade(b, m, world, profile, width, side, y0)
  })
}
function approaches(b, m, world) {
  for (const side of [-1, 1]) {
    const start = side < 0 ? -18.6 : 18.9,
      turn = side < 0 ? -49.65 : 56.88,
      inner = side < 0 ? -46.55 : 54.03
    b.box(m.coping, start, low - 0.038, -67.59, 2.7, 0.075, 4.8, 0.93)
    staircase(
      b,
      m,
      world,
      [start + side * 1.08, -68.19],
      [turn - side * 2.05, -68.19],
      low,
      middle,
      3.89,
      4,
      side
    )
    b.box(m.headBasalt, turn, (low + middle) / 2 - 0.042, -68.19, 4.26, middle - low + 0.072, 4.05, 0.84)
    b.box(m.coping, turn, middle - 0.055, -68.19, 4.27, 0.11, 4.1)
    b.at(turn, 0, -68.19, 0, () => guard(b, m, -2.08, 2.08, 1.99, middle, false))
    beacon(b, m, world, turn + side * 1.79, -66.43, middle, 0.99)
    staircase(b, m, world, [turn, -70.22], [turn, -99.48], middle, top, 3.96, 4, side)
    const outer = turn + side * 2.11
    b.box(
      m.headBasalt,
      (inner + outer) / 2,
      (low + top) / 2 - 0.035,
      -101.48,
      Math.abs(outer - inner),
      top - low + 0.05,
      4.1,
      0.86
    )
    b.box(m.coping, (inner + outer) / 2, top - 0.043, -101.48, Math.abs(outer - inner), 0.086, 4.13)
    b.at((inner + outer) / 2, 0, -103.43, Math.PI, () =>
      guard(b, m, -Math.abs(outer - inner) / 2, Math.abs(outer - inner) / 2, 0, top, false)
    )
    beacon(b, m, world, turn + side * 1.72, -102.98, top, 0.92)
  }
}

function hydraulics(b, m, world) {
  const mouths = cascades[0].streams.map(([x, w]) => ({
    x,
    w: w * 0.91,
    y: 23.45,
    spring: 0.65,
    rise: 0.85,
  }))
  frontFace(
    b,
    m.headWet,
    [
      [-8.44, 22.36],
      [15.25, 22.36],
      [15.25, 26.08],
      [-8.44, 26.08],
    ],
    mouths.map((s) => outline(s.x, s.y, s.w / 2, s.spring, s.rise)),
    () => -73.59,
    0.9
  )
  for (const s of mouths) {
    b.at(0, 0, -73.59, 0, () => crownArch(b, m, s, () => 0, 0.24))
    b.box(m.headWet, s.x, 23.82, -73.13, s.w + 0.32, 0.23, 1.27, 0.91)
    for (const sign of [-1, 1]) {
      b.box(m.patina, s.x + (sign * (s.w + 0.16)) / 2, 24.02, -73.03, 0.152, 0.36, 1.52, 0.86)
      b.beam(
        m.bronze,
        [s.x + (sign * (s.w + 0.14)) / 2, 24.19, -73.79],
        [s.x + (sign * (s.w + 0.14)) / 2, 24.19, -72.27],
        0.055,
        0.057
      )
    }
  }
  for (const [id, y, back, edge, x0, x1] of [
    [0, 16.03, -73.7, -70.28, -8.2, 14.83],
    [1, 8.73, -73.68, -67.98, -8.5, 15.18],
  ]) {
    b.box(m.headWet, (x0 + x1) / 2, y - 0.22, (back + edge) / 2, x1 - x0, 0.4, edge - back)
    b.box(m.patina, (x0 + x1) / 2, y - 0.279, edge, x1 - x0 + 0.22, 0.19, 0.265, 0.81)
    for (const s of [-1, 1]) {
      const x = s < 0 ? x0 : x1
      b.box(m.coping, x, y + 0.09, (back + edge) / 2, 0.37, 0.55, edge - back + 0.12, 0.86)
      b.box(m.bronze, x, y + 0.36, (back + edge) / 2, 0.24, 0.047, edge - back + 0.19, 0.89)
    }
    for (const x of [-7.98, -1.72, 6.87, 14.62]) {
      b.beam(m.headBasalt, [x, y - 2.81, -73.66], [x, y - 0.47, edge - 0.29], 0.44, 0.55, 0.86)
      b.beam(m.bronze, [x, y - 1.03, -73.65], [x, y - 0.43, edge - 0.43], 0.14, 0.14, 0.78)
    }
    for (const [k, s] of cascades[id + 1].streams.entries()) {
      const x = s[0] - s[1] * 0.545
      b.tube(m.headLime, [x, y - 0.12, edge - 0.16], [x, y + 0.49, edge - 0.16], 0.188, 0.129, 7, 0.91)
      if (k % 2 === 0) world.lamp(x, y + 0.31, edge - 0.51, 0xd5a86e, 10.2, 6.6)
    }
  }
}

export function headwater(b, m, world) {
  makeFinishes(m)
  retaining(b, m, world)
  deck(b, m)
  approaches(b, m, world)
  hydraulics(b, m, world)
  shoulders(b, m)
  waterworks(b, m, world)
  for (const [x, z, a, k] of [
    [-32.4, -71.24, 0, 0.98],
    [25.3, -71.53, 0, 1.03],
    [-33.7, -121.23, Math.PI, 1.05],
    [-10.0, -121.41, Math.PI, 0.96],
    [21.4, -121.22, Math.PI, 1.04],
    [45.1, -120.99, Math.PI, 0.95],
    [-46.83, -108.71, -Math.PI / 2, 1.02],
    [54.33, -110.36, Math.PI / 2, 1.01],
  ])
    stoneSpine(b, m, world, x, z, a, k)
}
export function headwaterMotion(scene, m, world) {
  return flowingWater(scene)
}
