import { lantern } from './kit.js'

const tau = Math.PI * 2
function segment(b, mat, points, r) {
  for (let i = 1; i < points.length; i++) b.tube(mat, points[i - 1], points[i], r, r, 7, 1, false)
}
function petalBowl(b, m, x, y, z, r) {
  const phi = (i, d) => (tau * (i + d)) / 10
  const loc = (a, s, h) => [x + Math.cos(a) * s * r, y + h * r, z + Math.sin(a) * s * r]
  for (let i = 0; i < 10; i++) {
    const a = phi(i, 0),
      d = phi(i, 0.5),
      e = phi(i, 1)
    const base = loc(d, 0.37, 0),
      l = loc(a, 0.71, 0.19),
      rgt = loc(e, 0.71, 0.19),
      t = loc(d, 1, 0.65),
      spine = loc(d, 0.84, 0.38)
    b.face(m.patina, [base, l, spine], 0.92)
    b.face(m.bronze, [base, spine, rgt], 0.88)
    b.face(m.teal, [l, t, spine], 1.18)
    b.face(m.bronze, [spine, t, rgt], 0.98)
    b.beam(m.gold, l, t, 0.027, 0.026)
    b.beam(m.gold, t, rgt, 0.027, 0.026)
  }
}
function measuringPost(b, m, world, x, z, h, sign) {
  b.at(x, 1.35, z, 0, () => {
    const stone = m.coping
    b.box(m.foundation, 0, 0.13, 0, 1.27, 0.26, 1.21)
    b.tube(stone, [0, 0.26, 0], [0, 0.56, 0], 0.68, 0.53, 8)
    b.tube(m.patina, [0, 0.56, 0], [0, 0.98, 0], 0.52, 0.32, 8)
    b.tube(m.timber, [0, 0.91, 0], [0, h - 0.23, 0], 0.262, 0.145, 12)
    for (const fy of [1.03, 1.2, 2.66, h * 0.63, h - 0.3, h - 0.04])
      b.tube(m.bronze, [0, fy, 0], [0, fy + 0.074, 0], fy > 3 ? 0.195 : 0.307, fy > 3 ? 0.192 : 0.303, 10)
    for (const side of [-1, 1]) {
      const arm = [
        [0, h - 0.1, 0],
        [side * 0.53, h + 0.11, -0.02],
        [side * 0.91, h + 0.39, -0.02],
        [side * 1.18, h + 0.86, 0],
        [side * 1.07, h + 1.13, 0],
      ]
      segment(b, m.bronze, arm, 0.082)
      segment(
        b,
        m.patina,
        [
          [0, h - 0.85, 0],
          [side * 0.4, h - 0.36, 0],
          [side * 0.53, h + 0.1, 0],
        ],
        0.1
      )
      b.tube(m.gold, arm[4], [side * 0.88, h + 1.33, 0], 0.074, 0.012, 6)
    }
    petalBowl(b, m, 0, h + 0.1, 0, 0.52)
    lantern(b, m, 0, h + 0.92, 0, 0.42, 0.9)
    for (const fy of [2.09, 2.31, 2.52])
      for (const sz of [-1, 1]) b.box(m.gold, 0, fy, sz * 0.252, 0.127, 0.032, 0.017)
    for (const side of [-1, 1]) {
      const dx = side * 0.52
      b.beam(m.darkwood, [0, 3.36, 0], [dx, 3.4, 0], 0.113, 0.105)
      b.beam(m.patina, [0, 3.02, 0], [dx * 0.86, 3.4, 0], 0.059, 0.07)
      b.tube(m.bronze, [dx, 3.4, 0], [dx, 3.14, 0], 0.025, 0.024, 6)
      lantern(b, m, dx, 2.79, 0, 0.19, 0.58, side * sign > 0 ? 'red' : 'amber')
    }
  })
  world.lamp(x, 1.35 + h + 0.9, z, 0xffbd70, 22, 10)
  world.lamp(x, 4.11, z, 0xff964e, 26, 9)
}
function canopy(b, m, world, zWest, zEast, westH, eastH, sag, n, accent) {
  const lo = -17.85,
    hi = 17.86
  measuringPost(b, m, world, lo, zWest, westH, 1)
  measuringPost(b, m, world, hi, zEast, eastH, -1)
  function point(u) {
    return [
      lo + (hi - lo) * u,
      1.35 + westH * (1 - u) + eastH * u - 4 * sag * u * (1 - u),
      zWest * (1 - u) + zEast * u,
    ]
  }
  const marks = Array.from({ length: 43 }, (_, i) => point(i / 42))
  segment(b, m.rope, marks, 0.033)
  for (let j = 1; j < n; j++) {
    const u = j / n,
      [x, y, z] = point(u),
      large = j % 4 === 2,
      r = large ? 0.34 : 0.245,
      h = large ? 0.8 : 0.55,
      drop = 0.25 + 0.14 * (j % 3)
    b.tube(m.bronze, [x, y, z], [x, y - drop, z], 0.016, 0.014, 5)
    lantern(b, m, x, y - drop - h * 0.52, z, r, h, accent && j % 3 === 0 ? 'red' : 'amber')
    if (large || j % 3 === 1)
      world.lamp(x, y - drop - h * 0.5, z, j % 3 === 0 ? 0xff7d42 : 0xffae5f, large ? 17 : 9, large ? 9 : 7)
  }
}
// The southern spillway's pair of channel beacons are built on separate piles.
function starBeacon(b, m, world, x, z, h) {
  const n = 8,
    p = (i, r, y) => [Math.cos((tau * i) / n) * r, y, Math.sin((tau * i) / n) * r]
  b.at(x, 1.35, z, 0, () => {
    for (const [a, c, r1, r2, mat] of [
      [-0.14, 0.19, 1.27, 1.27, m.foundation],
      [0.19, 0.44, 1.27, 1.04, m.coping],
      [0.44, 0.75, 1.03, 0.84, m.patina],
      [0.75, h - 2.16, 0.7, 0.45, m.timber],
      [h - 2.16, h - 1.94, 0.55, 0.97, m.bronze],
      [h - 0.04, h + 0.13, 1.04, 1.22, m.bronze],
      [h + 0.13, h + 0.78, 1.22, 0.24, m.roof],
      [h + 0.78, h + 1.52, 0.17, 0.017, m.gold],
    ]) {
      b.tube(mat, [0, a, 0], [0, c, 0], r1, r2, n)
    }
    for (let i = 0; i < n; i++) {
      const a = p(i, 0.96, h - 1.94),
        f = p(i + 1, 0.96, h - 1.94),
        u = p(i, 1.0, h - 0.046),
        v = p(i + 1, 1.0, h - 0.046)
      b.face(m.lantern, [a, f, v, u], 0.85 + 0.12 * (i % 3))
      b.beam(m.darkwood, a, u, 0.085, 0.083)
      const mid = u.map((s, j) => (s + v[j]) / 2),
        low = a.map((s, j) => (s + f[j]) / 2)
      const q = a.map((s, j) => (s + u[j]) / 2),
        r = f.map((s, j) => (s + v[j]) / 2)
      for (const [i, k] of [
        [mid, q],
        [q, low],
        [low, r],
        [r, mid],
      ])
        b.beam(m.bronze, i, k, 0.04, 0.04)
      const foot = p(i, 0.71, 1.15),
        top = p(i, 0.49, h - 2.22)
      b.beam(m.patina, foot, top, 0.063, 0.07)
      const tip = p(i, 1.54, h + 0.5)
      b.beam(m.bronze, u, tip, 0.075, 0.085)
      b.tube(m.gold, tip, p(i, 1.67, h + 0.89), 0.063, 0.012, 7)
    }
    for (const h0 of [0.9, 1.04, h * 0.47, h * 0.47 + 0.13, h - 2.35])
      b.tube(m.bronze, [0, h0, 0], [0, h0 + 0.065, 0], h0 < 1.5 ? 0.76 : 0.62, h0 < 1.5 ? 0.75 : 0.61, 8)
    petalBowl(b, m, 0, h - 2.22, 0, 1.18)
  })
  world.lamp(x, h + 0.35, z, 0xffb363, 48, 15)
}
// A set of river steps projects from the guilloche quay. The lower treads flood.
function waterStairs(b, m, sign, z) {
  for (let i = 0; i < 7; i++) {
    const y = 1.35 - (i + 1) * 0.206,
      inner = 17 - i * 0.27
    b.box(m.foundation, sign * (inner - 0.14), (-1.21 + y) / 2, z, 0.286, y + 1.21, 3.62)
    b.box(m.coping, sign * (inner - 0.14), y - 0.029, z, 0.294, 0.058, 3.73, 0.9 + 0.022 * (i % 3))
  }
  for (const dz of [-2.02, 2.02]) {
    b.tube(m.stone, [sign * 17.46, 1.35, z + dz], [sign * 17.46, 1.8, z + dz], 0.22, 0.19, 8)
    b.tube(m.patina, [sign * 17.46, 1.8, z + dz], [sign * 17.46, 1.91, z + dz], 0.17, 0.115, 8)
  }
}
export function harbor(b, m, world) {
  canopy(b, m, world, 29.9, 17.6, 11.7, 13.05, 1.96, 19, true)
  canopy(b, m, world, -38.4, -43.3, 10.7, 9.7, 1.47, 15, true)
  for (const s of [-1, 1]) {
    starBeacon(b, m, world, s * 18.05, 82.2, s < 0 ? 10.85 : 13.75)
    waterStairs(b, m, s, s < 0 ? 53.6 : 45.1)
  }
}
