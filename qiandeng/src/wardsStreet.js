import { lamp, glow } from './wardsTrade.js'
import { art, artPolygon, picture } from './wardsPaint.js'
const S = [-1, 1]
function cord(b, m, a, c, sag, width, tint = 1) {
  if (Math.hypot(a[0] - c[0], a[2] - c[2]) < 0.00001) {
    for (const [dx, dz] of [
      [width, 0],
      [0, width],
    ])
      b.face(
        m,
        [
          [a[0] - dx, a[1], a[2] - dz],
          [a[0] + dx, a[1], a[2] + dz],
          [c[0] + dx, c[1], c[2] + dz],
          [c[0] - dx, c[1], c[2] - dz],
        ],
        tint
      )
    return
  }
  const N = Math.max(3, Math.ceil(Math.hypot(a[0] - c[0], a[2] - c[2]) / 1.4))
  let prev = a
  for (let i = 1; i <= N; i++) {
    const t = i / N,
      p = a.map((v, k) => v + (c[k] - v) * t)
    p[1] -= 4 * t * (1 - t) * sag
    const dx = Math.abs(a[2] - c[2]) > Math.abs(a[0] - c[0]) ? width : 0,
      dz = dx ? 0 : width
    b.face(
      m,
      [
        [prev[0] - dx, prev[1], prev[2] - dz],
        [prev[0] + dx, prev[1], prev[2] + dz],
        [p[0] + dx, p[1], p[2] + dz],
        [p[0] - dx, p[1], p[2] - dz],
      ],
      tint
    )
    b.face(
      m,
      [
        [prev[0], prev[1] - width, prev[2]],
        [prev[0], prev[1] + width, prev[2]],
        [p[0], p[1] + width, p[2]],
        [p[0], p[1] - width, p[2]],
      ],
      tint
    )
    prev = p
  }
}
function mast(b, m, s, z, top) {
  const x = s * 21.91,
    Y = top,
    tip = s * 17.19
  b.box(m.foundation, x, 1.58, z, 0.4, 0.44, 0.44)
  b.tube(m.vermilion, [x, 1.73, z], [x, Y + 0.09, z], 0.097, 0.073, 8, 1, false)
  b.box(m.bronze, x, 2.09, z, 0.2, 0.16, 0.2)
  b.beam(m.wood, [x + s * 0.35, Y, z], [tip, Y + 0.34, z], 0.105, 0.135)
  b.beam(m.timber, [x, Y - 1.55, z], [x - s * 1.7, Y + 0.075, z], 0.09, 0.094)
  b.tube(m.bronze, [x, Y + 0.06, z], [x, Y + 0.28, z], 0.097, 0.04, 8)
  return tip
}
function swag(b, m, z0, z1, x0, x1, h, fall, id) {
  const uv = (t, v) => [t, 1 - v],
    p = (t, v) => [
      x0 + (x1 - x0) * v + 0.053 * Math.sin(5 * t) * v,
      h - 0.42 * v - 4 * fall * t * (1 - t) - 0.054 * Math.sin(t * 17) * v,
      z0 + (z1 - z0) * t,
    ]
  for (let j = 0; j < 10; j++) {
    const a = j / 10,
      c = (j + 1) / 10
    artPolygon(
      b,
      m.wardPaint,
      id,
      [p(a, 0), p(a, 1), p(c, 1), p(c, 0)],
      [uv(a, 0), uv(a, 1), uv(c, 1), uv(c, 0)]
    )
    if (j % 2 === 0) {
      const L = p(a, 1),
        R = p(c, 1),
        mid = p((a + c) / 2, 1)
      mid[1] -= 0.32
      artPolygon(
        b,
        m.wardPaint,
        id,
        [L, R, mid],
        [
          [a, 0.34],
          [c, 0.34],
          [(a + c) / 2, 0],
        ]
      )
    }
  }
}
function lightString(b, m, world, s, a, c, Y, inset, sequence, sag = 0.57) {
  const x = s * inset
  cord(b, m.rope, [x, Y, a], [x, Y, c], sag, 0.021)
  const n = Math.max(2, Math.round((c - a) / 2.03))
  for (let j = 0; j < n; j++) {
    const t = (j + 0.55) / n,
      z = a + (c - a) * t,
      height = Y - 4 * t * (1 - t) * sag,
      drop = 0.1 + 0.12 * ((j + sequence) % 3),
      r = 0.21 + 0.075 * ((j + sequence) % 3),
      h = 0.55 + 0.11 * ((j + sequence) % 3)
    cord(b, m.rope, [x, height, z], [x, height - drop, z], 0, 0.011)
    lamp(b, m, x, height - drop - h * 0.48, z, r, h, (j + sequence) % 4 === 0 ? 2 : (j + sequence) % 2, false)
    if (j % 3 === 1)
      glow(world, b, x, height - drop - h * 0.53, z, (j + sequence) % 2 ? 0xffc078 : 0xff8350, 13.5, 7.3)
  }
}
function festivalSpan(b, m, world, s, a, c, sequence) {
  const height = 6.73 + 0.21 * (sequence % 3)
  mast(b, m, s, a, height)
  mast(b, m, s, c, height)
  lightString(b, m, world, s, a, c, height + 0.27, 17.91, sequence, 0.64)
  lightString(b, m, world, s, a + 0.07, c - 0.07, height + 0.096, 20.34, sequence + 1, 0.46)
  // Narrow bolts alternate with open sky. The copper-edged valances are cut into swallow tails.
  const patches = Math.max(1, Math.floor((c - a) / 3.7))
  for (let j = 0; j < patches; j++) {
    const step = (c - a) / patches,
      l = a + step * (j + 0.1),
      r = a + step * (j + 0.71)
    swag(
      b,
      m,
      l,
      r,
      s * 21.77,
      s * (j % 2 ? 19.02 : 18.62),
      height - 0.04,
      0.28,
      art.redBrocade + ((j + sequence) % 4)
    )
  }
  cord(b, m.rope, [s * 21.85, height - 0.04, a], [s * 21.85, height - 0.04, c], 0.25, 0.018)
}
function rearFence(b, m, x, z, w, a, height) {
  b.at(x, 1.35, z, a, () => {
    b.box(m.foundation, 0, 0.15, 0, w + 0.07, 0.29, 0.29)
    b.box(m.plaster, 0, height * 0.55, 0, w, height - 0.2, 0.19)
    b.box(m.roof, 0, height + 0.033, 0, w + 0.11, 0.115, 0.32)
    for (const k of S) b.box(m.coping, k * w * 0.48, height * 0.51, 0, 0.117, height + 0.15, 0.245)
    const n = Math.max(1, Math.round(w / 2.2))
    for (let i = 0; i < n; i++) {
      const xx = (i / n + 0.5 / n - 0.5) * w
      picture(b, m.wardPaint, art.fret, xx, height * 0.69, 0.105, Math.min(0.62, (w / n) * 0.56), 0.27)
      b.at(xx, 0, 0, Math.PI, () =>
        picture(b, m.wardPaint, art.fret, 0, height * 0.69, 0.105, Math.min(0.62, (w / n) * 0.56), 0.27)
      )
    }
  })
}
function tradeCart(b, m, x, z, angle, kind) {
  b.at(x, 1.35, z, angle, () => {
    b.box(m.darkwood, 0, 0.48, 0, 0.78, 0.105, 1.37)
    for (const side of S) {
      b.box(m.wood, side * 0.383, 0.66, 0, 0.055, 0.34, 1.39)
      b.beam(m.wood, [side * 0.32, 0.43, -0.11], [side * 0.43, 0.8, -1.25], 0.067, 0.069)
      const pt = (a, r) => [side * 0.5, 0.4 + r * Math.sin(a), 0.15 + r * Math.cos(a)]
      for (let j = 0; j < 10; j++) {
        const a = (j * Math.PI) / 5,
          c = ((j + 1) * Math.PI) / 5
        const l = pt(a, 0.33),
          r = pt(c, 0.33)
        b.face(m.wood, [l, r, pt(c, 0.292), pt(a, 0.292)])
        if (j % 2 === 0) {
          const q = pt(a, 0.29),
            p = pt(a, 0)
          b.face(m.reed, [p, [p[0], p[1] + 0.025, p[2] + 0.023], [q[0], q[1] + 0.025, q[2] + 0.023], q])
        }
      }
    }
    for (const y of [0.58, 0.74]) b.box(m.wood, 0, y, 0.65, 0.75, 0.068, 0.069)
    for (let i = 0; i < 3; i++) {
      const z = (i - 1) * 0.37
      if (kind === 'cloth') b.tube(i % 2 ? m.teal : m.wine, [-0.28, 0.7, z], [0.28, 0.7, z], 0.12, 0.12, 8)
      else {
        b.box(m.wood, 0, 0.73, z, 0.59, 0.33, 0.32)
        b.box(m.reed, 0, 0.9, z, 0.61, 0.039, 0.33)
      }
    }
  })
}
function laneTrellis(b, m, world, x, z, brocade) {
  b.at(x, 1.35, z, 0, () => {
    const width = 3.43,
      top = 4.07
    for (const s of S) {
      b.box(m.foundation, (s * width) / 2, 0.19, 0, 0.31, 0.38, 0.31)
      b.tube(
        m.timber,
        [(s * width) / 2, 0.31, 0],
        [(s * width) / 2, top + 0.13, 0],
        0.084,
        0.066,
        7,
        1,
        false
      )
      b.beam(m.wood, [(s * width) / 2, top - 0.73, 0], [s * (width / 2 - 0.56), top + 0.02, 0], 0.1, 0.106)
      b.box(m.bronze, (s * width) / 2, top + 0.12, 0, 0.24, 0.095, 0.25)
      b.tube(
        m.rope,
        [s * (width / 2 - 0.32), top - 0.18, 0],
        [s * (width / 2 - 0.32), top - 0.42, 0],
        0.014,
        0.014,
        5,
        1,
        false
      )
      lamp(b, m, s * (width / 2 - 0.32), top - 0.66, 0, 0.16, 0.45, brocade ? 0 : 1)
    }
    b.box(m.teal, 0, top, 0, width + 0.45, 0.25, 0.22)
    picture(b, m.wardPaint, art.fret, 0, top, 0.12, width + 0.17, 0.15)
    if (brocade) {
      const pts = [
        [-0.51, top - 0.19, 0.05],
        [-0.46, top - 0.81, 0.12],
        [0, top - 1.04, 0.163],
        [0.43, top - 0.8, 0.12],
        [0.51, top - 0.19, 0.05],
      ]
      artPolygon(b, m.wardPaint, art.blueBrocade, pts, [
        [0, 1],
        [0.05, 0.3],
        [0.5, 0],
        [0.95, 0.3],
        [1, 1],
      ])
    }
    glow(world, b, 0, top - 0.76, 0.19, 0xffae6d, 9.8, 5.8)
  })
}
export function districtStreets(b, m, world) {
  festivalSpan(b, m, world, -1, 33.85, 42.1, 1)
  festivalSpan(b, m, world, -1, 18.0, 30.15, 0)
  festivalSpan(b, m, world, -1, 5.79, 14.05, 3)
  festivalSpan(b, m, world, 1, 26.1, 34.77, 2)
  festivalSpan(b, m, world, 1, -39.88, -33.1, 3)
  laneTrellis(b, m, world, -32.75, 25.88, true)
  laneTrellis(b, m, world, 45.95, -38.72, false)
  tradeCart(b, m, -31.07, 20.53, -0.085, 'books')
  tradeCart(b, m, 34.49, 46.83, 0.1, 'cloth')
  // Rear garden walls turn the last row into inhabited court blocks with real corner entrances.
  for (const side of S) {
    for (const [z, w, off, ht] of [
      [8.4, 5.85, 0.05, 1.63],
      [24.4, 11.9, 0.18, 1.37],
      [44.5, 11.5, 0.16, 1.45],
      [73.2, 7.3, 0.0, 1.52],
      [-25.4, 5.8, 0.14, 1.6],
      [-51.7, 11, 0.18, 1.44],
    ]) {
      rearFence(b, m, side * (57.76 + off * 0.4), z, w, Math.PI / 2, ht)
      rearFence(b, m, side * 57.06, z + w / 2 - 1.04, 1.58, 0, ht - 0.19)
    }
  }
}
