import { art, artPolygon, picture, bannerSlot } from './wardsPaint.js'
import { houseDimensions } from './wardsFrame.js'
const S = [-1, 1],
  tau = Math.PI * 2,
  ground = 0.205
const brass = [1.12, 0.94, 0.71]
export function glow(world, b, x, y, z, color, power, range) {
  if (world?.addLightAt) world.addLightAt(b, x, y, z, color, power, range)
  else if (world?.lamp) world.lamp(...b.point([x, y, z]), color, power, range)
}
export function lamp(b, m, x, y, z, r = 0.26, h = 0.64, id = 1, ornate = false) {
  const k = id % 3,
    n = ornate ? 10 : k === 0 ? 8 : 6,
    shape =
      k === 0
        ? [
            [0.51, -0.47],
            [0.91, -0.28],
            [1, 0.1],
            [0.84, 0.33],
            [0.5, 0.46],
          ]
        : k === 1
          ? [
              [0.7, -0.48],
              [0.99, -0.31],
              [0.99, 0.3],
              [0.69, 0.48],
            ]
          : [
              [0.5, -0.48],
              [1, -0.11],
              [0.96, 0.17],
              [0.56, 0.45],
            ]
  const p = (a, rr, hh) => [x + Math.cos(a) * r * rr, y + h * hh, z + Math.sin(a) * r * rr]
  for (let j = 0; j < n; j++) {
    const a = (tau * j) / n,
      an = (tau * (j + 1)) / n
    for (let i = 1; i < shape.length; i++) {
      const [rr, u] = shape[i - 1],
        [rr2, v] = shape[i]
      artPolygon(
        b,
        m.wardLampSilk,
        24 + k,
        [p(a, rr, u), p(a, rr2, v), p(an, rr2, v), p(an, rr, u)],
        [
          [j / n, 0.5 + u],
          [j / n, 0.5 + v],
          [(j + 1) / n, 0.5 + v],
          [(j + 1) / n, 0.5 + u],
        ],
        j % 3 === 0 ? 0.89 : 1
      )
      if (ornate && j % 2 === 0)
        b.face(
          m.bronze,
          [
            p(a - 0.023, rr + 0.016, u),
            p(a + 0.023, rr + 0.016, u),
            p(a + 0.023, rr2 + 0.016, v),
            p(a - 0.023, rr2 + 0.016, v),
          ],
          brass
        )
    }
  }
  for (const [rr, hh] of [shape[0], shape.at(-1)])
    b.tube(
      m.darkwood,
      [x, y + h * hh - 0.024, z],
      [x, y + h * hh + 0.024, z],
      r * rr + 0.014,
      r * rr + 0.014,
      n,
      1,
      false
    )
  b.tube(m.bronze, [x, y - h * 0.57, z], [x, y - h * 0.48, z], r * 0.15, r * 0.13, 6, 1, false)
  b.tube(
    m.vermilion,
    [x, y - h * (ornate ? 0.84 : 0.72), z],
    [x, y - h * 0.56, z],
    r * 0.11,
    r * 0.069,
    5,
    1,
    false
  )
  if (ornate)
    for (const t of [0, 0.5, 1]) {
      const off = (t - 0.5) * r * 0.18
      b.beam(m.wine, [x + off, y - h * 0.7, z], [x + off * 1.46, y - h * 0.91, z + 0.017], 0.017, 0.014)
    }
}
function hangingLamp(b, m, x, top, z, r, h, id, cord = 0.24, ornate = false) {
  b.face(m.rope, [
    [x - 0.012, top, z],
    [x + 0.012, top, z],
    [x + 0.012, top - cord, z],
    [x - 0.012, top - cord, z],
  ])
  lamp(b, m, x, top - cord - h * 0.48, z, r, h, id, ornate)
}
function vessel(b, m, x, y, z, r, h, tint, finish = m.ceramic) {
  const levels = [
      [0.47, 0],
      [0.84, 0.13],
      [1, 0.55],
      [0.8, 0.82],
      [0.57, 0.9],
      [0.6, 0.98],
      [0.47, 0.985],
    ],
    n = 8
  const p = (i, k) => [
    x + r * levels[i][0] * Math.cos((k * tau) / n),
    y + h * levels[i][1],
    z + r * levels[i][0] * Math.sin((k * tau) / n),
  ]
  for (let j = 0; j < n; j++)
    for (let i = 1; i < levels.length; i++)
      b.face(finish, [p(i - 1, j), p(i, j), p(i, j + 1), p(i - 1, j + 1)], tint)
  b.face(
    m.ink,
    Array.from({ length: n }, (_, k) => p(levels.length - 1, k)),
    0.6
  )
}
function table(b, m, x, y, z, w, d, h) {
  b.box(m.wood, x, y + h - 0.043, z, w, 0.086, d)
  for (const s of S) {
    b.box(m.darkwood, x, y + h - 0.13, z + s * d * 0.38, w * 0.9, 0.11, 0.074)
    for (const k of S)
      b.beam(
        m.wood,
        [x + s * w * 0.41, y, z + k * d * 0.36],
        [x + s * w * 0.37, y + h - 0.09, z + k * d * 0.34],
        0.081,
        0.08
      )
  }
}
function stock(b, m, h, x, y, z, w, d) {
  const hh = 0.85
  b.box(m.wood, x, y + hh / 2, z, w, hh, d)
  b.box(m.darkwood, x, y + hh - 0.038, z, w + 0.08, 0.085, d + 0.08)
  const slot = h.trade === 'fish' ? art.fish : h.trade === 'books' ? art.papers : art.shelves
  picture(b, m.wardPaint, slot, x, y + hh * 0.49, z + d / 2 + 0.006, w - 0.09, hh * 0.82)
}
function textile(b, m, idx, x, y, z, w, h, phase) {
  const nx = 7,
    ny = 4
  const p = (u, v) => [
    x + (u - 0.5) * w + 0.046 * v * v * Math.sin(phase),
    y - v * h - 0.055 * Math.sin(Math.PI * u) - v * v * 0.042 * Math.sin(u * 11 + phase),
    z + 0.065 * Math.sin(u * 15 + phase) * (0.65 + 0.7 * v) + v * v * 0.14 * Math.cos(phase + 0.9 * u),
  ]
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      const l = i / nx,
        r = (i + 1) / nx,
        u = j / ny,
        v = (j + 1) / ny
      artPolygon(
        b,
        m.wardPaint,
        idx,
        [p(l, v), p(r, v), p(r, u), p(l, u)],
        [
          [l, 1 - v],
          [r, 1 - v],
          [r, 1 - u],
          [l, 1 - u],
        ]
      )
    }
}
function shopFlag(b, m, h, x, top, z) {
  b.beam(m.wood, [x, top, z - 0.055], [x, top, z + 1.02], 0.075, 0.089)
  b.beam(m.wood, [x, top - 0.38, z], [x, top - 0.013, z + 0.55], 0.061, 0.064)
  b.at(x, top - 0.71, z + 0.56, Math.PI / 2, () => {
    const w = 0.56,
      hh = 1.19
    for (const s of S) b.tube(m.bronze, [s * 0.19, hh / 2, 0], [s * 0.19, 0.695, 0], 0.012, 0.012, 5)
    b.box(m.wood, 0, 0, 0, w + 0.035, hh + 0.035, 0.047)
    picture(b, m.wardSigns, bannerSlot(h.id), 0, 0, 0.029, w, hh, 1, true)
    b.at(0, 0, 0, Math.PI, () => picture(b, m.wardSigns, bannerSlot(h.id), 0, 0, 0.029, w, hh, 1, true))
    b.box(m.bronze, 0, -hh / 2, 0, w + 0.068, 0.043, 0.067)
  })
}
function books(b, m, x, y, z, n, scale = 1) {
  for (let j = 0; j < n; j++) {
    const a = ((j % 3) - 0.95) * 0.042
    b.at(x, y + j * 0.074 * scale, z, a, () => {
      b.box(m.plaster, 0, 0.04 * scale, 0, 0.55 * scale, 0.063 * scale, 0.32 * scale, [1.08, 0.98, 0.76])
      b.box(j % 2 ? m.teal : m.ink, 0, 0.077 * scale, 0, 0.58 * scale, 0.016 * scale, 0.34 * scale)
      b.box(m.pearl, -0.18 * scale, 0.087 * scale, 0, 0.055 * scale, 0.006 * scale, 0.22 * scale)
    })
  }
}
function foldingScreen(b, m, x, y, z) {
  for (const s of [-1, 0, 1])
    b.at(x + s * 0.62, y, z + Math.abs(s) * 0.105, -s * 0.32, () => {
      b.box(m.wood, 0, 0.82, 0, 0.68, 1.62, 0.068)
      picture(b, m.wardPaint, s === 0 ? art.peony : art.mountains, 0, 0.87, 0.039, 0.57, 1.38)
      for (const k of S) b.box(m.darkwood, k * 0.28, 0.12, 0, 0.062, 0.23, 0.1)
    })
}
function teaRoom(b, m, h, dims) {
  const x = dims.w * 0.25,
    z = -dims.d * 0.15
  table(b, m, x, ground, z, 1.41, 0.78, 0.74)
  for (const k of S) {
    table(b, m, x + k * 0.99, ground, z, 0.41, 0.46, 0.39)
    b.box(m.wood, x + k * 0.99, ground + 0.73, z - 0.19, 0.42, 0.62, 0.074)
  }
  b.box(m.ink, x, ground + 0.755, z, 1.06, 0.035, 0.58)
  vessel(b, m, x - 0.18, ground + 0.78, z, 0.112, 0.174, [0.92, 0.67, 0.46], m.ceramic)
  for (let j = 0; j < 3; j++)
    vessel(
      b,
      m,
      x + 0.12 + j * 0.13,
      ground + 0.78,
      z + ((j % 2) - 0.5) * 0.2,
      0.05,
      0.072,
      [0.94, 1.02, 0.87]
    )
  foldingScreen(b, m, -dims.w * 0.29, ground, -dims.d * 0.31)
  stock(b, m, h, -dims.w * 0.31, ground, 0.33, 1.02, 0.56)
}
function music(b, m, x, y, z) {
  b.at(x, y, z, -0.12, () => {
    table(b, m, 0, 0, 0, 1.81, 0.66, 0.65)
    const points = [
      [-0.78, -0.12],
      [-0.47, -0.18],
      [-0.12, -0.16],
      [0.23, -0.14],
      [0.74, -0.1],
      [0.84, 0],
      [0.71, 0.11],
      [0.26, 0.12],
      [-0.12, 0.17],
      [-0.46, 0.15],
      [-0.76, 0.12],
    ]
    b.face(
      m.darkwood,
      points.map(([x, z]) => [x, 0.75, z])
    )
    for (let j = 0; j < points.length; j++) {
      const a = points[j],
        c = points[(j + 1) % points.length]
      b.face(m.wood, [
        [a[0], 0.7, a[1]],
        [c[0], 0.7, c[1]],
        [c[0], 0.75, c[1]],
        [a[0], 0.75, a[1]],
      ])
    }
    for (let k = 0; k < 7; k++) {
      const zz = (k - 3) * 0.027
      b.face(m.pearl, [
        [-0.66, 0.754, zz],
        [0.68, 0.754, zz * 0.78],
        [0.68, 0.754, zz * 0.78 + 0.004],
        [-0.66, 0.754, zz + 0.004],
      ])
    }
  })
}
function boat(b, m, h, dims) {
  b.at(0, 0.22, -0.12, -0.025, () => {
    const l = Math.min(5.52, dims.w * 0.83),
      N = 13,
      pt = (t, s, k) => {
        const u = 2 * t - 1,
          f = 0.095 + 0.905 * Math.sin(t * Math.PI) ** 0.76
        return [
          (u * l) / 2,
          0.36 + 0.38 * Math.abs(u) ** 2 + k * 0.38 + Math.abs(u) ** 3 * 0.4,
          s * f * (0.2 + k * 0.62),
        ]
      }
    for (let j = 0; j < N; j++) {
      const a = j / N,
        c = (j + 1) / N
      for (const s of S) {
        for (let k = 0; k < 3; k++) {
          if (s === 1 && j > 8 && k === 2) continue
          const u = k / 3,
            v = (k + 1) / 3
          const col = [0.79 + 0.075 * ((j + k) % 3), 0.77 + 0.07 * (k % 2), 0.73]
          b.face(m.wood, [pt(a, s, u), pt(c, s, u), pt(c, s, v), pt(a, s, v)], col)
          if (k === 2) b.beam(m.darkwood, pt(a, s, 1), pt(c, s, 1), 0.064, 0.073)
        }
        if (j % 2 === 0) {
          b.beam(m.reed, pt(a, s, 0), pt(a, s, 0.94), 0.044, 0.055)
        }
      }
      b.face(m.wood, [pt(a, -1, 0), pt(a, 1, 0), pt(c, 1, 0), pt(c, -1, 0)], 0.75)
    }
    for (const t of [0.17, 0.41, 0.67, 0.84]) {
      b.beam(m.wood, pt(t, -1, 0.62), pt(t, 1, 0.62), 0.16, 0.062)
      const xx = ((t * 2 - 1) * l) / 2
      for (const s of S) b.beam(m.wood, [xx, 0.01, s * 0.59], [xx, 0.42, -s * 0.18], 0.08, 0.1)
    }
  })
  for (let j = 0; j < 3; j++) {
    const x = dims.w * 0.35 + 0.15 * j
    b.beam(m.reed, [x, ground, 0.29], [x - 0.23, 2.4 + j * 0.13, -0.39], 0.035, 0.055)
    b.beam(m.wood, [x - 0.23, 2.4 + j * 0.13, -0.39], [x - 0.31, 2.89 + j * 0.13, -0.52], 0.12, 0.043)
  }
  stock(b, m, h, -dims.w * 0.3, ground, -dims.d * 0.31, 1.27, 0.52)
}
function lanternGuild(b, m, h, dim) {
  // The original guild display is a lantern within a suspended, painted octagonal palace frame.
  const x = -0.74,
    z = dim.d / 2 - 0.12,
    top = dim.gH + dim.uH + 0.1,
    y = top - 1.54,
    r = 0.85,
    n = 8
  b.tube(m.bronze, [x, top - 0.04, z], [x, y + 0.63, z], 0.033, 0.032, 7)
  lamp(b, m, x, y, z, r * 0.64, 1.39, 1, true)
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      c = ((i + 1) * tau) / n,
      p = (t, rr, hh) => [x + r * rr * Math.cos(t), y + hh, z + r * rr * Math.sin(t)]
    b.face(m.teal, [p(a, 0.81, 0.67), p(c, 0.81, 0.67), p(c, 1, 0.53), p(a, 1, 0.53)])
    b.beam(m.bronze, p(a, 1, 0.53), p(c, 1, 0.53), 0.055, 0.043)
    b.beam(m.vermilion, p(a, 0.9, 0.54), p(a, 0.78, -0.68), 0.053, 0.052)
    b.beam(m.bronze, p(a, 0.77, -0.66), p(c, 0.77, -0.66), 0.055, 0.046)
    if (i % 2 === 0) {
      b.tube(m.vermilion, p(a, 0.8, -0.69), p(a, 0.78, -1.1), 0.048, 0.033, 6)
    }
  }
  for (const s of S) {
    const xx = s * dim.w * 0.31
    table(b, m, xx, ground, -0.24, 1.57, 0.81, 0.69)
    if (s === 1) {
      vessel(b, m, xx - 0.31, 0.9, -0.2, 0.14, 0.27, [0.86, 0.86, 0.77])
      lamp(b, m, xx + 0.26, 1.33, -0.23, 0.24, 0.58, 0, true)
    } else {
      for (let j = 0; j < 3; j++)
        lamp(b, m, xx - 0.48 + j * 0.46, 1.23 + (j % 2) * 0.15, -0.14, 0.14 + j * 0.025, 0.39 + j * 0.06, j)
    }
  }
  for (let j = 0; j < 4; j++) {
    const xx = -dim.w * 0.37 + j * 0.59
    b.tube(m.reed, [xx, 0.92, -1.18], [xx + 0.16, 1.57 + j * 0.072, -0.95], 0.019, 0.013, 6)
  }
}
function stage(b, m, h, d) {
  const platformW = d.w * 0.71,
    front = d.d * 0.24,
    back = -d.d * 0.39,
    w = platformW
  b.box(m.darkwood, 0, 0.47, (front + back) / 2, w, 0.54, front - back)
  b.box(m.wood, 0, 0.765, (front + back) / 2, w + 0.08, 0.08, front - back + 0.035)
  for (let j = 0; j < 3; j++)
    b.box(m.coping, 0, 0.67 - 0.186 * j, front + 0.13 + j * 0.28, 1.83 + j * 0.17, 0.17, 0.33)
  picture(b, m.wardPaint, art.crane, 0, 2.29, back + 0.083, w * 0.79, 2.67)
  for (const s of S) {
    b.box(m.bronze, s * w * 0.4, 2.31, back + 0.115, 0.076, 2.77, 0.071)
    const xx = s * w * 0.425
    textile(b, m, art.redBrocade, xx, 3.73, front - 0.2, w * 0.18, 2.61, 2 * s + 0.45)
    b.tube(m.bronze, [xx - 0.46, 3.78, front - 0.18], [xx + 0.46, 3.78, front - 0.18], 0.041, 0.043, 8)
  }
  const gx = -w * 0.26,
    gz = -0.56
  b.at(gx, 0.8, gz, 0, () => {
    for (const s of S) b.box(m.wood, s * 0.43, 0.83, 0, 0.088, 1.67, 0.095)
    b.box(m.wood, 0, 1.64, 0, 1.06, 0.105, 0.1)
    b.tube(m.rope, [0, 1.58, 0], [0, 1.32, 0], 0.019, 0.018, 5)
    b.tube(m.bronze, [0, 1.1, -0.04], [0, 1.1, 0.04], 0.32, 0.32, 16)
    b.tube(m.bronze, [0, 1.1, 0.037], [0, 1.1, 0.097], 0.145, 0.084, 12)
  })
  music(b, m, w * 0.19, 0.8, -0.51)
  for (let j = 0; j < 3; j++)
    hangingLamp(b, m, (j - 1) * w * 0.3, dimTop(d), front + 0.12, 0.27, 0.68, j === 1 ? 1 : 0, 0.22)
}
const dimTop = (d) => d.gH + 0.07
function drugstore(b, m, h, d) {
  const wall = -d.d * 0.35 + 0.05
  const w = d.w * 0.72,
    hi = 1.91
  b.box(m.wood, 0, 1.27, wall, w + 0.1, 2.15, 0.48)
  for (let i = 0; i < 10; i++)
    for (let j = 0; j < 5; j++) {
      const x = (i / 10 - 0.45) * w,
        y = 0.5 + j * 0.365
      b.box(j % 2 === 0 ? m.wood : m.timber, x, y, wall + 0.256, w * 0.095, 0.335, 0.055)
      b.box(m.pearl, x - 0.04, y + 0.023, wall + 0.29, 0.099, 0.057, 0.011)
      b.box(m.bronze, x + 0.067, y - 0.055, wall + 0.309, 0.049, 0.045, 0.041)
    }
  table(b, m, d.w * 0.18, ground, 0.29, 2.14, 0.77, 0.9)
  vessel(b, m, d.w * 0.25, 1.115, 0.26, 0.18, 0.31, [0.74, 0.89, 0.73])
  const x = d.w * 0.07
  b.box(m.wood, x, 1.202, 0.25, 0.43, 0.125, 0.32)
  b.tube(m.bronze, [x, 1.24, 0.25], [x, 1.86, 0.25], 0.022, 0.022, 7)
  b.beam(m.bronze, [x - 0.33, 1.83, 0.25], [x + 0.32, 1.82, 0.25], 0.024, 0.038)
  for (const s of S) {
    b.tube(m.rope, [x + s * 0.27, 1.81, 0.25], [x + s * 0.27, 1.54, 0.25], 0.008, 0.008, 5)
    b.tube(m.bronze, [x + s * 0.27, 1.48, 0.25], [x + s * 0.27, 1.55, 0.25], 0.066, 0.132, 8)
  }
}
function silk(b, m, h, d) {
  const bx = d.w * 0.07
  table(b, m, -d.w * 0.15, ground, 0.12, 1.99, 0.81, 0.78)
  for (let i = 0; i < 4; i++) {
    const xx = -d.w * 0.15 + (i - 1.5) * 0.41
    const f = [m.teal, m.vermilion, m.reed, m.ink][i]
    b.tube(f, [xx, 1.11, -0.21], [xx, 1.11, 0.48], 0.135, 0.134, 9)
    b.tube(m.reed, [xx, 1.11, -0.28], [xx, 1.11, 0.53], 0.046, 0.046, 7)
  }
  const x = d.w * 0.31,
    z = -0.19
  for (const s of S) b.tube(m.reed, [x + s * 0.84, ground, z], [x + s * 0.84, 2.78, z], 0.043, 0.038, 8)
  b.tube(m.reed, [x - 0.92, 2.7, z], [x + 0.92, 2.7, z], 0.036, 0.038, 8)
  for (let i = 0; i < 3; i++)
    textile(
      b,
      m,
      art.redBrocade + ((i + h.phase) % 4),
      x + (i - 1) * 0.53,
      2.69,
      z,
      0.45,
      1.38 + i * 0.1,
      h.phase + i
    )
}
function lodging(b, m, h, d) {
  b.at(d.w * 0.22, ground, -d.d * 0.27, 0, () => {
    b.box(m.wood, 0, 0.34, 0, 1.71, 0.64, 0.95)
    artPolygon(
      b,
      m.wardPaint,
      art.blueBrocade,
      [
        [-0.83, 0.668, -0.46],
        [-0.83, 0.668, 0.46],
        [0.83, 0.668, 0.46],
        [0.83, 0.668, -0.46],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ]
    )
    b.tube(m.plaster, [0.54, 0.79, -0.27], [0.54, 0.79, 0.27], 0.118, 0.118, 9)
    for (const s of S) b.box(m.timber, s * 0.8, 1.22, -0.43, 0.063, 2.12, 0.069)
    b.box(m.wood, 0, 2.21, -0.43, 1.68, 0.09, 0.09)
    textile(b, m, art.creamBrocade, 0, 2.18, -0.42, 1.51, 0.5, 0.3)
  })
  foldingScreen(b, m, -d.w * 0.27, ground, -0.36)
}
function standardGoods(b, m, h, d) {
  const xx = d.w * 0.235,
    z = -d.d * 0.24
  stock(b, m, h, xx, ground, z, Math.min(2.45, d.w * 0.47), 0.72)
  const base = ground + 0.87
  if (h.trade === 'books' || h.trade === 'print') {
    books(b, m, xx - 0.47, base, z, 3)
    books(b, m, xx + 0.33, base, z + 0.018, 2, 0.74)
  } else if (h.trade === 'ceramics' || h.trade === 'wine' || h.trade === 'tea' || h.trade === 'apothecary') {
    for (let i = 0; i < 3; i++)
      vessel(
        b,
        m,
        xx + (i - 1) * 0.43,
        base,
        z + 0.04 * (i % 2),
        0.105 + 0.014 * i,
        0.19 + 0.046 * i,
        [
          [0.85, 0.9, 0.73],
          [0.54, 0.84, 0.81],
          [0.7, 0.51, 0.38],
        ][i]
      )
    if (h.phase % 2) vessel(b, m, -xx, ground, -0.4, 0.3, 0.65, [0.65, 0.65, 0.56])
  } else if (h.trade === 'music') music(b, m, -xx, ground, -0.4)
  else {
    b.box(m.wood, xx, base + 0.15, z, 0.71, 0.28, 0.39)
    picture(b, m.wardPaint, art.fret, xx, base + 0.15, z + 0.2, 0.68, 0.16)
    b.box(m.reed, -xx, 0.43, -0.33, 0.73, 0.45, 0.54)
  }
}
export function furnishings(b, m, h, world) {
  const d = houseDimensions(h),
    front = d.d / 2,
    head = ground + d.gH
  if (h.outbuilding) {
    stock(b, m, h, d.w * 0.14, ground, -d.d * 0.26, d.w * 0.55, 0.61)
    picture(b, m.wardPaint, art.slats, -d.w * 0.28, 1.73, -d.d / 2 + 0.1, 0.67, 0.91)
    glow(world, b, d.w * 0.12, 2.26, 0.13, 0xffae72, 6.8, 5.9)
    return
  }
  const dress = h.row === 0 || [24, 37, 47].includes(h.id)
  if (h.id === 3) lanternGuild(b, m, h, d)
  else if (h.id === 12) boat(b, m, h, d)
  else if (h.id === 13) stage(b, m, h, d)
  else if (h.id === 14) drugstore(b, m, h, d)
  else if (dress && h.trade === 'tea') teaRoom(b, m, h, d)
  else if (dress && ['silk', 'print'].includes(h.trade)) silk(b, m, h, d)
  else if (dress && h.trade === 'inn') lodging(b, m, h, d)
  else standardGoods(b, m, h, d)
  if (h.quay || h.form === 'terrace' || h.form === 'court') {
    const n = h.quay ? (h.levels === 3 ? 4 : 2) : 1
    for (let j = 0; j < n; j++) {
      const xx =
        n === 1
          ? d.w * 0.24
          : n === 4
            ? d.w * [-0.42, -0.28, 0.28, 0.42][j]
            : (j / (n - 1) - 0.5) * d.w * 0.64
      hangingLamp(
        b,
        m,
        xx,
        head - 0.23,
        front + 0.22,
        0.23 + (j % 2) * 0.033,
        h.quay ? 0.66 : 0.51,
        (h.phase + j) % 3,
        0.18,
        h.quay && j === 0
      )
    }
  }
  if (h.quay || h.phase % 3 === 0) shopFlag(b, m, h, d.w * 0.44, head - 0.15, front + 0.09)
  if (h.levels > 1 && (h.quay || h.form === 'tower')) {
    const face = d.upperD / 2 - (h.quay ? 0.26 : 0),
      y = ground + d.gH + d.uH
    for (const s of S)
      hangingLamp(
        b,
        m,
        s * d.upperW * 0.33,
        y - 0.24,
        face + 0.39,
        h.quay ? 0.287 : 0.19,
        h.quay ? 0.74 : 0.47,
        (h.phase + (s > 0 ? 1 : 0)) % 3,
        0.22
      )
  }
  if (h.row === 0) {
    glow(world, b, d.w * 0.24, head - 0.88, front + 0.38, 0xffa05a, 27, 11.8)
    glow(world, b, -d.w * 0.24, 2.05, -0.41, h.phase % 2 ? 0xffb66e : 0xffa166, 18, 8.5)
    if (h.levels > 1) glow(world, b, -d.w * 0.22, head + d.uH - 0.86, front + 0.05, 0xffb56b, 17.5, 9.1)
  } else
    glow(world, b, d.w * 0.19, head - 0.9, front + 0.13, h.phase % 3 === 0 ? 0xff9472 : 0xffba74, 16, 7.9)
}
