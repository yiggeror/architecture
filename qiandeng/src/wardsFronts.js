import { art, artPolygon, picture, bannerSlot } from './wardsPaint.js'
import { houseDimensions } from './wardsFrame.js'
const tau = Math.PI * 2
const cream = [1.09, 0.97, 0.76],
  sides = [-1, 1]
function awning(b, m, h, x, z, w, depth, high, low, slot, cut, skew = 0) {
  const cols = 8,
    point = (t, v) => [
      x + (t - 0.5) * w + skew * v,
      high +
        (low - high) * v -
        0.19 * Math.sin(Math.PI * v) -
        0.09 * v * Math.sin(t * Math.PI) +
        0.033 * v * Math.cos(t * tau * 4),
      z + depth * v,
    ]
  for (let j = 0; j < cols; j++) {
    const a = j / cols,
      c = (j + 1) / cols
    for (let k = 0; k < 3; k++) {
      const u = k / 3,
        v = (k + 1) / 3
      artPolygon(
        b,
        m.wardPaint,
        slot,
        [point(a, u), point(a, v), point(c, v), point(c, u)],
        [
          [a, 1 - u],
          [a, 1 - v],
          [c, 1 - v],
          [c, 1 - u],
        ],
        0.86 + (j % 2) * 0.08
      )
    }
    const l = point(a, 1),
      r = point(c, 1),
      mid = point((a + c) / 2, 1),
      down = (p, dy) => [p[0], p[1] - dy, p[2] + 0.03]
    artPolygon(
      b,
      m.wardPaint,
      slot,
      [l, down(l, 0.14), down(mid, cut ? 0.3 : 0.175), down(r, 0.14), r],
      [
        [a, 0.24],
        [a, 0.07],
        [(a + c) / 2, 0],
        [c, 0.07],
        [c, 0.24],
      ]
    )
  }
  for (const q of [-0.5, 0.5]) {
    const back = point(q + 0.5, 0),
      outer = point(q + 0.5, 1)
    b.beam(m.wood, [back[0], high - 0.82, z - 0.06], [outer[0], outer[1] - 0.035, outer[2]], 0.047, 0.064)
    b.beam(m.reed, back, outer, 0.049, 0.047)
  }
  b.beam(m.wood, point(0, 0), point(1, 0), 0.065, 0.073)
}
function wallBlind(b, m, x, y, z, w, h) {
  picture(b, m.wardPaint, art.slats, x, y, z, w, h, [0.96, 0.93, 0.73])
  b.tube(m.reed, [x - w * 0.54, y - h / 2 - 0.012, z], [x + w * 0.54, y - h / 2 - 0.012, z], 0.055, 0.058, 7)
  for (const s of sides)
    b.face(m.rope, [
      [x + s * w * 0.28 - 0.014, y - h * 0.49, z + 0.014],
      [x + s * w * 0.28 + 0.014, y - h * 0.49, z + 0.014],
      [x + s * w * 0.28 + 0.014, y + h * 0.49, z + 0.014],
      [x + s * w * 0.28 - 0.014, y + h * 0.49, z + 0.014],
    ])
}
function gildedBlade(b, m, h, x, z, top, hh) {
  b.at(x, 0, z, Math.PI / 2, () => {
    const w = 0.86,
      dy = top - hh * 0.5
    for (const side of sides) {
      const yy = dy + side * hh * 0.4
      b.beam(m.wood, [-0.83, yy, -0.02], [0, yy, 0], 0.081, 0.1)
      b.beam(m.bronze, [-0.79, yy - 0.32, -0.02], [-0.23, yy, -0.02], 0.038, 0.045)
    }
    b.box(m.teal, 0, dy, 0, w + 0.17, hh + 0.12, 0.173)
    picture(b, m.wardSigns, bannerSlot(h.id), 0, dy, 0.095, w, hh, 1, true)
    b.at(0, 0, 0, Math.PI, () => picture(b, m.wardSigns, bannerSlot(h.id), 0, dy, 0.095, w, hh, 1, true))
    for (const s of sides) {
      b.box(m.bronze, s * (w + 0.06) * 0.5, dy, 0, 0.043, hh + 0.22, 0.205)
      b.beam(m.bronze, [s * (w * 0.51), top + 0.04, 0], [s * (w * 0.64), top + 0.28, 0], 0.08, 0.071)
    }
  })
}
function waveFlag(b, m, h, x, z, high) {
  b.tube(m.reed, [x - 0.05, 0.24, z], [x + 0.12, high + 0.12, z + 0.08], 0.059, 0.031, 7, 1, false)
  b.beam(m.bronze, [x + 0.12, high + 0.12, z + 0.08], [x + 0.18, high + 0.3, z + 0.08], 0.047, 0.043)
  b.at(x + 0.14, high - 0.08, z + 0.09, Math.PI / 2, () => {
    const p = (u, v) => [u * 1.38, 0.24 * u - hyp(u, v), 0.17 * Math.sin(5.2 * u + v * 0.9) - 0.08 * v * u],
      hyp = (u, v) => v * (0.83 - 0.19 * u + 0.035 * Math.sin(u * 8))
    for (let j = 0; j < 7; j++)
      for (let k = 0; k < 3; k++) {
        const a = j / 7,
          c = (j + 1) / 7,
          u = k / 3,
          v = (k + 1) / 3
        artPolygon(
          b,
          m.wardSigns,
          h.id,
          [p(a, v), p(c, v), p(c, u), p(a, u)],
          [
            [a, 1 - v],
            [c, 1 - v],
            [c, 1 - u],
            [a, 1 - u],
          ],
          1,
          true
        )
      }
  })
}
function twig(b, mat, a, c, r, tint) {
  const x = a[0],
    y = a[1],
    z = a[2],
    X = c[0],
    Y = c[1],
    Z = c[2]
  b.face(
    mat,
    [
      [x - r, y, z],
      [x + r, y, z],
      [X + r * 0.6, Y, Z],
      [X - r * 0.6, Y, Z],
    ],
    tint
  )
  b.face(
    mat,
    [
      [x, y, z - r],
      [x, y, z + r],
      [X, Y, Z + r * 0.6],
      [X, Y, Z - r * 0.6],
    ],
    tint
  )
}
function herbs(b, m, x, z, bamboo = false) {
  b.at(x, 0, z, 0, () => {
    const r = bamboo ? 0.33 : 0.28,
      base = 0.19
    b.tube(m.ceramic, [0, base, 0], [0, base + 0.1, 0], r * 0.62, r * 0.74, 8, [0.67, 0.84, 0.74], false)
    b.tube(m.ceramic, [0, base + 0.1, 0], [0, base + 0.43, 0], r * 0.74, r, 8, [0.67, 0.84, 0.74], false)
    b.tube(m.patina, [0, base + 0.43, 0], [0, base + 0.48, 0], r + 0.027, r + 0.027, 8, 0.87, false)
    b.tube(m.earth, [0, base + 0.47, 0], [0, base + 0.49, 0], r * 0.87, r * 0.87, 8)
    for (let j = 0; j < (bamboo ? 4 : 5); j++) {
      const a = (tau * j) / (bamboo ? 4 : 5) + 0.38,
        hh = bamboo ? 1.77 + (0.49 * ((j * 3) % 5)) / 4 : 0.68 + 0.42 * (j % 3),
        x0 = 0.11 * Math.cos(a),
        z0 = 0.11 * Math.sin(a),
        u = 0.24 * Math.cos(a),
        v = 0.24 * Math.sin(a)
      const leaf = (ax, ay, az, angle, size, col) => {
        const tip = [ax + Math.cos(angle) * size, ay + 0.21 * size, az + Math.sin(angle) * size],
          dx = -Math.sin(angle) * size * 0.135,
          dz = Math.cos(angle) * size * 0.135,
          mid = [(ax + tip[0]) / 2, ay + 0.118, (az + tip[2]) / 2]
        b.face(
          m.leaf,
          [[ax, ay, az], [mid[0] + dx, mid[1], mid[2] + dz], tip, [mid[0] - dx, mid[1] - 0.017, mid[2] - dz]],
          col
        )
      }
      twig(
        b,
        bamboo ? m.reed : m.bark,
        [x0, base + 0.48, z0],
        [x0 + u, base + 0.48 + hh, z0 + v],
        bamboo ? 0.02 : 0.024,
        [0.7, 0.83, 0.65]
      )
      for (let k = 0; k < 4; k++) {
        const h = 0.48 + hh * (0.32 + 0.18 * k),
          angle = a + k * 1.22,
          xx = x0 + u * (0.32 + 0.18 * k),
          zz = z0 + v * (0.32 + 0.18 * k),
          lx = xx + 0.2 * Math.cos(angle),
          lz = zz + 0.2 * Math.sin(angle)
        twig(b, m.reed, [xx, base + h, zz], [lx, base + h + 0.12, lz], 0.011, 0.72)
        for (const s of sides)
          leaf(lx, base + h + 0.12, lz, angle + s * 0.56, bamboo ? 0.36 : 0.255, [
            0.61 + 0.12 * (k % 3),
            0.83 + 0.08 * (j % 2),
            0.65,
          ])
        if (!bamboo && k >= 2)
          b.face(
            m.plaster,
            [
              [lx - 0.044, base + h + 0.17, lz],
              [lx, base + h + 0.2, lz - 0.045],
              [lx + 0.048, base + h + 0.17, lz],
              [lx, base + h + 0.16, lz + 0.046],
            ],
            [1.02, 0.54, 0.52]
          )
      }
    }
  })
}
function net(b, m, x, z, w, h) {
  const p = (i, j) => [
    x + (i * w) / 8,
    0.62 + (j * h) / 5 - 0.16 * Math.sin((i * Math.PI) / 8),
    z + 0.09 * Math.sin((j * Math.PI) / 5) * Math.sin((i * Math.PI) / 8),
  ]
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 5; j++) {
      const a = p(i, j),
        c = p(i + 1, j + 1),
        d = p(i + 1, j),
        q = p(i, j + 1)
      b.face(m.rope, [a, [a[0] + 0.018, a[1], a[2]], [c[0] + 0.018, c[1], c[2]], c])
      b.face(m.rope, [d, [d[0] + 0.014, d[1], d[2]], [q[0] + 0.014, q[1], q[2]], q])
    }
}
export function fronts(b, m, h) {
  const d = houseDimensions(h),
    front = d.d / 2 + 0.23,
    w = d.w,
    top = groundHeight(d)
  if (h.quay) {
    if (h.trade === 'tea') {
      awning(b, m, h, -w * 0.13, front, w * 0.69, 1.27, top - 0.32, top - 0.79, art.creamBrocade, false, 0.1)
      wallBlind(b, m, w * 0.3, top - 0.8, front - 0.12, w * 0.22, 0.61)
    } else if (['silk', 'print', 'jewels'].includes(h.trade)) {
      awning(
        b,
        m,
        h,
        -w * 0.13,
        front,
        w * 0.61,
        1.44,
        top - 0.27,
        top - 0.88,
        h.id % 2 ? art.blueBrocade : art.redBrocade,
        true,
        -0.16
      )
      waveFlag(b, m, h, w * 0.42, front - 0.18, top + 1.24)
    } else if (h.trade === 'boat' || h.trade === 'fish') {
      awning(b, m, h, -w * 0.11, front, w * 0.73, 1.36, top - 0.12, top - 0.74, art.leafBrocade, false, 0.32)
      net(b, m, w * 0.18, front - 0.17, w * 0.25, 1.35)
    } else if (h.trade === 'guild' || h.trade === 'stage') {
      for (const s of sides)
        awning(
          b,
          m,
          h,
          s * w * 0.325,
          front,
          w * 0.26,
          1.21,
          top - 0.05,
          top - 0.72,
          s < 0 ? art.redBrocade : art.leafBrocade,
          true,
          s * 0.08
        )
      gildedBlade(b, m, h, w * 0.41, front + 0.12, top + d.uH - 0.38, 2.78)
    } else if (h.trade === 'apothecary') {
      awning(b, m, h, w * 0.13, front, w * 0.68, 1.48, top - 0.19, top - 0.89, art.leafBrocade, false, 0.12)
      herbs(b, m, -w * 0.4, front - 0.16, true)
    } else if (h.trade === 'wine') {
      waveFlag(b, m, h, -w * 0.44, front - 0.02, top + 1.35)
      wallBlind(b, m, -w * 0.21, top - 0.91, front - 0.11, w * 0.32, 0.85)
    } else if (h.phase % 2 === 0) {
      awning(b, m, h, w * 0.2, front, w * 0.43, 1.15, top - 0.19, top - 0.83, art.blueBrocade, true)
    }
    if ([0, 1, 5, 6, 11, 14, 16, 21].includes(h.id))
      herbs(b, m, w * 0.44, front - 0.28, [1, 5, 14].includes(h.id))
  } else if (h.id % 5 === 0) {
    wallBlind(b, m, w * 0.23, top - 0.72, front - 0.31, w * 0.32, 0.84)
    herbs(b, m, -w * 0.37, front - 0.25, h.id % 2 === 0)
  }
  // Servicing happens at the back lane. The blind and a small wall sign mark the secondary counter.
  if (h.id % 4 === 1) {
    b.at(0, 0, -d.d / 2 - 0.1, Math.PI, () => {
      wallBlind(b, m, w * 0.14, top - 0.78, 0.04, w * 0.31, 0.92)
      picture(b, m.wardSigns, h.id, -w * 0.27, top - 0.55, 0.032, 1.24, 0.37, 1, true)
    })
  }
}
const groundHeight = (d) => 0.18 + d.gH
