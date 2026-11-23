import { raisedFret, tideDesk } from './gateCraft.js'

// Coordinates lie in the gate's frame. The registered sources and the stone
// lightmap use the same positions, enclosure radii and flame heights.
export const bridgeBeacons = [
  { x: 8.43, base: 4.66, z: 4.98, radius: 0.458, height: 1.1, power: 13.4 },
  { x: 17.96, base: 4.08, z: 4.98, radius: 0.365, height: 0.88, power: 8.5 },
]
export const keystoneLamp = { x: 0, y: 9.96, z: 4.94, radius: 0.245, height: 0.45, power: 5.0 }
export const vaultLamps = [
  { x: 7.03, y: 4.42, z: 3.25, anchor: 4.98, radius: 0.29, power: 8.8, range: 5.7 },
  { x: 6.62, y: 5.42, z: 1.05, anchor: 5.89, radius: 0.235, power: 4.1, range: 4.8 },
  { x: 15.98, y: 4.07, z: 2.69, anchor: 4.67, radius: 0.245, power: 6.4, range: 4.9 },
]
const TAU = Math.PI * 2
const shell = [
  [-0.5, 0.42],
  [-0.38, 0.78],
  [-0.1, 1],
  [0.24, 0.94],
  [0.5, 0.44],
]

function collar(b, mat, x, y, z, radius, height, flare = 1, sides = 8, caps = false) {
  b.tube(mat, [x, y - height / 2, z], [x, y + height / 2, z], radius, radius * flare, sides, 1, caps)
}

// One contiguous swatch wraps all the way around the balloon. Main bamboo
// ribs stand proud of the silk; the finer internal hoops show through it.
export function silkLantern(b, m, x, y, z, r, h, red = false) {
  const sides = r < 0.27 ? 8 : 12
  const pt = (t, row, relief = 0) => [
    x + (r * row[1] + relief) * Math.cos(t),
    y + h * row[0],
    z + (r * row[1] + relief) * Math.sin(t),
  ]
  const uv = (u, row) => [u, (red ? 0 : 0.5) + 0.003 + (0.5 + row[0]) * 0.494]
  for (let j = 0; j < sides; j++) {
    const a = (j * TAU) / sides,
      c = ((j + 1) * TAU) / sides
    for (let i = 1; i < shell.length; i++) {
      const lo = shell[i - 1],
        hi = shell[i]
      b.face(m.gateLantern, [pt(a, lo), pt(a, hi), pt(c, hi), pt(c, lo)], 1, [
        uv(j / sides, lo),
        uv(j / sides, hi),
        uv((j + 1) / sides, hi),
        uv((j + 1) / sides, lo),
      ])
      if (j % 2 === 0 && r >= 0.27) {
        const spread = 0.035
        b.face(
          m.darkwood,
          [
            pt(a - spread, lo, 0.003),
            pt(a - spread, hi, 0.003),
            pt(a + spread, hi, 0.003),
            pt(a + spread, lo, 0.003),
          ],
          [0.69, 0.6, 0.47]
        )
      }
    }
  }
  for (const side of [-1, 1]) {
    collar(b, m.darkwood, x, y + side * h * 0.5, z, r * 0.51, h * 0.082, 1, 8, true)
    collar(b, m.bronze, x, y + side * h * 0.536, z, r * 0.47, h * 0.017, 1, 8, false)
  }
  collar(b, m.bronze, x, y - h * 0.594, z, r * 0.113, h * 0.11, 1.65, 7)
  collar(b, m.vermilion, x, y - h * 0.76, z, r * 0.084, h * 0.25, 1.39, 6, false)
}

function oilWick(b, m, x, y, z, r, h) {
  const stem = (mat, rowA, rowB, ra, rb, bend = 0) =>
    b.tube(mat, [x, y + rowA * h, z], [x + bend * r, y + rowB * h, z], ra * r, rb * r, 6, 1, false)
  stem(m.patina, 0, 0.12, 0.58, 0.9)
  stem(m.bronze, 0.12, 0.19, 0.94, 1.0)
  stem(m.ink, 0.18, 0.28, 0.19, 0.16)
  stem(m.gateWick, 0.255, 0.52, 0.14, 0.38)
  stem(m.gateWick, 0.52, 1, 0.38, 0.018, 0.15)
}

// A honey-coloured burner is visible through the open sides of the cap and
// cage. The cutwaters use the same construction at a larger scale.
export function cageLamp(b, m, x, y, z, r, h) {
  const sides = 6
  const y0 = y - h * 0.4,
    y1 = y + h * 0.31
  collar(b, m.darkwood, x, y - h * 0.43, z, r * 0.47, h * 0.16, 1.85, sides, true)
  collar(b, m.darkwood, x, y - h * 0.33, z, r * 0.98, h * 0.07, 1.02, sides)
  for (let j = 0; j < sides; j++) {
    const a = (TAU * j) / sides,
      c = (TAU * (j + 1)) / sides
    const point = (t, yy, k) => [x + r * k * Math.cos(t), yy, z + r * k * Math.sin(t)]
    const spread = 0.067
    b.face(m.darkwood, [
      point(a - spread, y0, 0.82),
      point(a - spread, y1, 0.98),
      point(a + spread, y1, 0.98),
      point(a + spread, y0, 0.82),
    ])
    // Pierce the apron above each flame with alternating scalloped points.
    b.face(m.darkwood, [
      point(a, y1, 0.97),
      point(c, y1, 0.97),
      point(c, y1 - h * 0.076, 0.97),
      point((a + c) * 0.5, y1 - h * 0.036, 0.87),
      point(a, y1 - h * 0.076, 0.97),
    ])
  }
  collar(b, m.darkwood, x, y + h * 0.35, z, r * 1.17, h * 0.12, 0.81, sides, true)
  collar(b, m.patina, x, y + h * 0.45, z, r * 0.99, h * 0.16, 0.48, sides)
  collar(b, m.bronze, x, y + h * 0.594, z, r * 0.27, h * 0.13, 0.24, sides, true)
  oilWick(b, m, x, y - h * 0.31, z, r * 0.7, h * 0.6)
}

// The same height and offset locate the paper's transmitted pool and the
// burner on the gallery side of the screen. Neither encroaches on the door.
export function screenWick(b, m, x, bottom, z, width, height, flip, glow) {
  const cx = x + (flip ? 0.182 : -0.182) * width
  const cy = bottom + 0.317 * height
  const zz = z - 0.43,
    base = cy - 0.16
  b.box(m.darkwood, cx, base - 0.062, z - 0.24, 0.43, 0.085, 0.53)
  b.beam(m.bronze, [cx, base - 0.32, z - 0.03], [cx, base - 0.09, zz], 0.046, 0.052)
  oilWick(b, m, cx, base - 0.014, zz, 0.119, 0.294)
  glow(cx, cy, zz, 0xffa260, 2.6, 3.9)
}

export function silkScreen(b, m, points, x, bottom, width, height, flip, tint = 1) {
  const inset = 0.104
  const z = points[0][2]
  b.face(
    m.gateScreen,
    points.map(([xx, yy, zz]) => [xx, yy, zz - inset]),
    tint,
    points.map(([xx, yy]) => [((flip ? -1 : 1) * (xx - x)) / width + 0.5, (yy - bottom) / height])
  )
  // A second sash holds the gauze from the room side. The two uprights
  // and crossbar are between the wick and the screen.
  const fan = points.length > 4,
    inner = z - 0.166
  for (const u of [0.21, 0.8]) {
    const where = (flip ? -1 : 1) * (u - 0.5)
    const rise = fan ? 0.28 + 0.72 * Math.sqrt(1 - (2 * where) ** 2) : 1
    b.box(
      m.wood,
      x + where * width,
      bottom + height * rise * 0.5,
      inner,
      0.015 * width,
      height * rise,
      0.041,
      0.79
    )
  }
  const reach = fan ? Math.sqrt(1 - ((0.63 - 0.28) / 0.72) ** 2) : 1
  b.box(m.wood, x, bottom + height * 0.63, inner, width * reach, height * 0.017, 0.043, 0.8)
}

export function screenedBay(b, m, x, y, z, w, h, pattern, flip, glow) {
  const base = y - h * 0.5,
    top = y + h * 0.5,
    left = x - w * 0.5,
    right = x + w * 0.5
  if (h > 0.74) {
    silkScreen(
      b,
      m,
      [
        [left, base, z],
        [right, base, z],
        [right, top, z],
        [left, top, z],
      ],
      x,
      base,
      w,
      h,
      flip,
      flip ? [0.94, 0.88, 0.75] : [1, 0.95, 0.85]
    )
    screenWick(b, m, x, base, z, w, h, flip, glow)
  }
  const d = 0.24
  for (const s of [-1, 1]) {
    b.box(m.darkwood, x + s * w * 0.5, y, z - 0.052, 0.095, h + 0.11, d)
    b.box(m.timber, x, y + s * h * 0.5, z - 0.054, w + 0.13, 0.099, d)
  }
  const n = Math.max(1, Math.round(w / 0.84)),
    sw = w / n
  for (let i = 0; i < n; i++) {
    const cx = left + (i + 0.5) * sw
    if (i) b.box(m.darkwood, cx - 0.5 * sw, y, z - 0.005, 0.065, h, 0.14)
    for (const s of [-1, 1]) b.box(m.darkwood, cx, y + s * h * 0.324, z, sw, 0.054, 0.095)
    if (pattern === 'bars') {
      b.box(m.darkwood, cx, y, z, 0.045, h, 0.1)
    } else {
      const dx = sw * 0.31,
        dy = Math.min(0.29, h * 0.17)
      const pts = [
        [cx - dx, y, z],
        [cx, y + dy, z],
        [cx + dx, y, z],
        [cx, y - dy, z],
        [cx - dx, y, z],
      ]
      for (let k = 1; k < pts.length; k++) raisedFret(b, m.darkwood, pts[k - 1], pts[k], 0.053, 0.095)
      for (const s of [-1, 1])
        b.box(m.darkwood, cx, y + s * (dy + h * 0.324) * 0.5, z, 0.047, h * 0.324 - dy, 0.088)
    }
  }
}

// A little oil stand and hammered back-plate cast the keeper's light across
// the tide chart, with the open lip of the reflector facing the manuscript.
export function keeperDesk(b, m, x, y, z, glow) {
  tideDesk(b, m, x, y, z)
  const px = x - 0.67,
    py = y + 0.874,
    pz = z - 0.15
  collar(b, m.patina, px, py + 0.024, pz, 0.135, 0.047, 0.85, 8, true)
  oilWick(b, m, px, py + 0.046, pz, 0.109, 0.26)
  b.beam(m.bronze, [px - 0.075, py + 0.054, pz], [px - 0.124, py + 0.3, pz], 0.025, 0.026)
  const point = (a, k, h) => [px - k * Math.cos(a), py + h, pz + k * Math.sin(a)]
  for (let i = 0; i < 6; i++) {
    const a = -1.1 + (i * 2.2) / 6,
      c = a + 2.2 / 6
    b.face(
      m.bronze,
      [point(a, 0.156, 0.1), point(c, 0.156, 0.1), point(c, 0.174, 0.22), point(a, 0.174, 0.22)],
      [0.88, 0.78, 0.61]
    )
    b.face(
      m.bronze,
      [point(a, 0.174, 0.22), point(c, 0.174, 0.22), point(c, 0.115, 0.306), point(a, 0.115, 0.306)],
      [0.82, 0.74, 0.58]
    )
  }
  glow(px, py + 0.196, pz, 0xffab63, 3.2, 3.7)
}
