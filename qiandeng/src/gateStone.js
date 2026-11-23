import { generator } from './mesh.js'
import { raisedFret } from './gateCraft.js'
import { dressMasonry, portalUV, vaultUV } from './gateStoneLight.js'

export const DECK = 10.36
export const Z_HALF = 4.35
export const BANK_EDGE = 22.38
const random = generator(564281)
const tau = Math.PI * 2
const arches = [
  { x: -13.12, rx: 3.76, h: 4.68, spring: 1.82, band: 0.54, count: 23 },
  { x: 0, rx: 7.5, h: 5.96, spring: 3.12, band: 0.65, count: 39 },
  { x: 13.12, rx: 3.76, h: 4.68, spring: 1.82, band: 0.54, count: 23 },
]
const foot = -0.9
const wallTop = DECK - 0.47
const archPoint = (a, t, z, add = 0) => [
  a.x + (a.rx + add) * Math.cos(t),
  a.spring + (a.h + add) * Math.sin(t),
  z,
]

function bolster(b, m, a) {
  const n = a.count,
    depthSections = a.x === 0 ? 7 : 5
  // The barrel consists of full-width courses. The tiles visible on its soffit
  // have alternating, genuinely staggered joints from one ring to the next.
  for (let k = 0; k < n; k++) {
    const t0 = (Math.PI * k) / n,
      t1 = (Math.PI * (k + 1)) / n
    const front = archPoint(a, t0, Z_HALF),
      next = archPoint(a, t1, Z_HALF)
    for (const side of [-1, 1]) {
      const z = side * Z_HALF,
        left = archPoint(a, t0, z),
        right = archPoint(a, t1, z)
      b.face(m.foundation, [left, right, [right[0], wallTop, z], [left[0], wallTop, z]], 0.77)
    }
    b.face(m.foundation, [front, archPoint(a, t0, -Z_HALF), archPoint(a, t1, -Z_HALF), next], 0.67)
  }
  for (let strip = 0; strip < depthSections; strip++) {
    const z0 = -Z_HALF + (2 * Z_HALF * strip) / depthSections + 0.012
    const z1 = -Z_HALF + (2 * Z_HALF * (strip + 1)) / depthSections - 0.012
    const offset = (strip % 2) * 0.5
    for (let k = -1; k < n; k++) {
      const lo = Math.max(0, k + offset),
        hi = Math.min(n, k + 1 + offset)
      if (hi <= lo) continue
      const t0 = (Math.PI * (lo + 0.02)) / n,
        t1 = (Math.PI * (hi - 0.02)) / n
      const v = 0.75 + 0.25 * random()
      // A slight rebate gives the radial mortar shadow a visible edge at water level.
      b.face(
        m.gateCutStone,
        [
          archPoint(a, t0, z0, -0.019),
          archPoint(a, t1, z0, -0.019),
          archPoint(a, t1, z1, -0.019),
          archPoint(a, t0, z1, -0.019),
        ],
        [v * 0.82, v * 0.91, v * 0.95],
        [vaultUV(a, t0, z0), vaultUV(a, t1, z0), vaultUV(a, t1, z1), vaultUV(a, t0, z1)]
      )
    }
  }
  for (const sign of [-1, 1]) {
    const x = a.x + sign * (a.rx - 0.022),
      rows = Math.ceil((a.spring - foot) / 0.7)
    for (let j = 0; j < rows; j++) {
      const bottom = foot + ((a.spring - foot) * j) / rows + 0.014,
        top = foot + ((a.spring - foot) * (j + 1)) / rows - 0.012
      const cols = 6,
        step = (2 * Z_HALF) / cols
      for (let k = -1; k <= cols; k++) {
        const z0 = Math.max(-Z_HALF, -Z_HALF + step * (k + (j % 2) * 0.5)),
          z1 = Math.min(Z_HALF, -Z_HALF + step * (k + 1 + (j % 2) * 0.5))
        if (z1 - z0 < 0.035) continue
        const tint = (0.8 + 0.15 * random()) * (bottom < 0.68 ? 0.85 : 1)
        b.face(
          m.stone,
          [
            [x, bottom, z0 + 0.014],
            [x, bottom, z1 - 0.014],
            [x, top, z1 - 0.014],
            [x, top, z0 + 0.014],
          ],
          [tint * 0.88, tint * 0.96, tint]
        )
      }
    }
  }
  for (const side of [-1, 1]) {
    const zz = side * (Z_HALF + 0.144)
    for (let k = 0; k < n; k++) {
      const t0 = (Math.PI * (k + 0.012)) / n,
        t1 = (Math.PI * (k + 0.988)) / n,
        isKey = k === (n - 1) / 2
      const band = a.band + (isKey ? 0.22 : 0),
        z = zz + side * (isKey ? 0.095 : 0)
      const p = archPoint(a, t0, z),
        q = archPoint(a, t1, z),
        u = archPoint(a, t1, z, band),
        v = archPoint(a, t0, z, band)
      const tone = 0.8 + 0.2 * random()
      const face = [p, q, u, v]
      b.face(m.gateCutStone, face, [tone * 1.4, tone * 1.25, tone * 1.03], face.map(portalUV))
      b.face(
        m.stone,
        [p, q, archPoint(a, t1, side * (Z_HALF - 0.005)), archPoint(a, t0, side * (Z_HALF - 0.005))],
        0.84
      )
      b.face(
        m.stone,
        [v, u, archPoint(a, t1, side * Z_HALF, band), archPoint(a, t0, side * Z_HALF, band)],
        0.91
      )
      if (isKey) {
        const point = (dx, y, d) => [a.x + dx, y, z + side * d],
          cy = a.spring + a.h + band * 0.52
        b.face(
          m.bronze,
          [
            point(-0.19, cy, 0.012),
            point(0, cy + 0.225, 0.015),
            point(0.19, cy, 0.012),
            point(0, cy - 0.209, 0.016),
          ],
          [0.97, 0.83, 0.59]
        )
      }
      if (k % 2 === 0) {
        // Cut thread in the outer archivolt follows the masonry, on every second block.
        raisedFret(
          b,
          m.bronze,
          archPoint(a, t0, z + side * 0.015, band * 0.83),
          archPoint(a, t1, z + side * 0.015, band * 0.83),
          0.025,
          0.009,
          0.79
        )
      }
    }
    for (const sign of [-1, 1]) {
      const x = a.x + sign * (a.rx + a.band * 0.5)
      const n = Math.ceil((a.spring - foot) / 0.66)
      for (let j = 0; j < n; j++)
        b.box(
          m.coping,
          x,
          foot + ((a.spring - foot) * (j + 0.5)) / n,
          side * (Z_HALF + 0.076),
          a.band - 0.02,
          (a.spring - foot) / n - 0.024,
          0.146,
          0.78 + 0.16 * random()
        )
    }
  }
}

// Exact intersections with each extrados split courses at the arch springing;
// the ashlar faces can never cut into the empty navigation volume.
function outsideHeight(x) {
  let y = foot
  for (const a of arches) {
    const rad = a.rx + a.band,
      rel = (x - a.x) / rad
    if (Math.abs(rel) <= 1) y = Math.max(y, a.spring + (a.h + a.band) * Math.sqrt(Math.max(0, 1 - rel * rel)))
  }
  return y
}
function ashlar(b, m) {
  const rows = 15
  for (let j = 0; j < rows; j++) {
    const y0 = foot + ((wallTop - foot) * j) / rows + 0.021,
      y1 = foot + ((wallTop - foot) * (j + 1)) / rows - 0.016
    const cuts = []
    for (const a of arches) {
      const rad = a.rx + a.band
      cuts.push(a.x - rad, a.x + rad)
      for (const y of [y0, y1]) {
        const s = (y - a.spring) / (a.h + a.band)
        if (s <= 0 || s >= 1) continue
        const dx = rad * Math.sqrt(1 - s * s)
        cuts.push(a.x - dx, a.x + dx)
      }
    }
    let x0 = -BANK_EDGE
    while (x0 < BANK_EDGE - 0.05) {
      const w = 1.2 + random() * 1.08,
        x1 = Math.min(BANK_EDGE, x0 + w)
      const left = x0 + 0.016,
        right = x1 - 0.015
      const xx = [left, ...cuts.filter((x) => x > left + 0.002 && x < right - 0.002), right].sort(
        (a, c) => a - c
      )
      const shade = 0.78 + random() * 0.29
      for (let i = 1; i < xx.length; i++) {
        const l = xx[i - 1],
          r = xx[i]
        if (outsideHeight((l + r) / 2) > y1 - 0.005) continue
        const bl = Math.min(y1, Math.max(y0, outsideHeight(l + 0.0001) - 0.055)),
          br = Math.min(y1, Math.max(y0, outsideHeight(r - 0.0001) - 0.055))
        for (const side of [-1, 1]) {
          const z = side * (Z_HALF + 0.026 + (shade - 0.78) * 0.027)
          const front = [
            [l, bl, z],
            [r, br, z],
            [r, y1, z],
            [l, y1, z],
          ]
          b.face(m.gateCutStone, front, [shade * 0.94, shade, shade * 0.95], front.map(portalUV))
          b.face(
            m.foundation,
            [
              [l, bl, z],
              [r, br, z],
              [r, br, side * Z_HALF],
              [l, bl, side * Z_HALF],
            ],
            0.83
          )
        }
      }
      x0 = x1
    }
  }
}

function nose(b, m, x, width, height) {
  for (const sign of [-1, 1]) {
    const rim = (k, y, d) => [
      [x - width * k, y, sign * (Z_HALF - 0.03)],
      [x - width * k, y, sign * (Z_HALF + 0.7 * d)],
      [x, y, sign * (Z_HALF + 1.76 * d)],
      [x + width * k, y, sign * (Z_HALF + 0.7 * d)],
      [x + width * k, y, sign * (Z_HALF - 0.03)],
    ]
    const courses = [
      [-0.83, 1, 1],
      [0.25, 1, 1],
      [0.43, 1.02, 1.015],
      [0.57, 0.94, 0.96],
      [height - 0.72, 0.83, 0.78],
      [height - 0.66, 0.89, 0.84],
      [height - 0.49, 0.89, 0.84],
      [height - 0.38, 0.72, 0.71],
      [height, 0.23, 0.3],
    ]
    for (let j = 1; j < courses.length; j++) {
      const [lo, k0, d0] = courses[j - 1],
        [hi, k1, d1] = courses[j]
      const a = rim(k0, lo, d0),
        c = rim(k1, hi, d1)
      for (let p = 1; p < a.length; p++)
        b.face(
          j === 2 || j === 6 ? m.coping : m.stone,
          [a[p - 1], a[p], c[p], c[p - 1]],
          0.79 + (0.12 * p) / 5
        )
      if (j === courses.length - 1) b.face(m.coping, c, 0.87)
    }
  }
}

export function parapet(b, m, x0, x1, z, base, low = false) {
  const n = Math.max(1, Math.round((x1 - x0) / 2.03))
  const h = low ? 0.77 : 0.98
  for (const [height, w, d, mat] of [
    [0.14, 0.19, 0.18, m.stone],
    [h - 0.08, 0.12, 0.155, m.coping],
    [h, 0.079, 0.175, m.coping],
  ])
    b.box(mat, (x0 + x1) / 2, base + height, z, x1 - x0, w, d)
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n
    b.box(m.stone, x, base + h * 0.5, z, 0.18, h, 0.198, 0.92)
    b.box(m.coping, x, base + h + 0.055, z, 0.256, 0.125, 0.266)
    b.tube(m.coping, [x, base + h + 0.105, z], [x, base + h + 0.222, z], 0.12, 0.054, 8, 0.96)
    if (i === n) continue
    const d = (x1 - x0) / n,
      c = x + d / 2,
      yy = base + h * 0.54
    for (const side of [-1, 1]) {
      const a = [c + side * d * 0.35, yy, z],
        u = [c + side * d * 0.19, yy + h * 0.17, z],
        v = [c + side * d * 0.19, yy - h * 0.16, z]
      raisedFret(b, m.coping, a, u, 0.055, 0.059)
      raisedFret(b, m.coping, a, v, 0.055, 0.059)
      raisedFret(b, m.coping, u, [c, yy + h * 0.17, z], 0.055, 0.059)
      raisedFret(b, m.coping, v, [c, yy - h * 0.16, z], 0.055, 0.059)
    }
  }
}

function rosette(b, m, x, y, z, side) {
  b.at(x, y, z, side === 1 ? 0 : Math.PI, () => {
    b.tube(m.coping, [0, 0, 0], [0, 0, 0.091], 0.79, 0.76, 16)
    b.tube(m.patina, [0, 0, 0.092], [0, 0, 0.133], 0.65, 0.634, 16)
    for (let i = 0; i < 12; i++) {
      const a = (i * tau) / 12,
        c = Math.cos(a),
        s = Math.sin(a)
      const p = (r, t, z) => [r * c - t * s, r * s + t * c, z]
      b.face(
        m.bronze,
        [p(0.5, 0, 0.143), p(0.571, -0.034, 0.143), p(0.618, 0, 0.148), p(0.565, 0.029, 0.143)],
        1.03
      )
    }
    for (let j = 0; j < 3; j++) {
      const cy = -0.21 + j * 0.2
      const pts = Array.from({ length: 7 }, (_, k) => [
        -0.36 + k * 0.12,
        cy + 0.065 * Math.sin(k * 1.08),
        0.151,
      ])
      for (let i = 1; i < pts.length; i++) b.beam(m.bronze, pts[i - 1], pts[i], 0.032, 0.039)
    }
  })
}

function grandStairs(b, m, side) {
  // Measured from the upper landing out to the bank. A 49-step change of
  // level is interrupted by two broad processional landings.
  const h = (DECK - 1.35) / 49,
    total = 50 - BANK_EDGE,
    landing = 1.9,
    tread = (total - 2 * landing) / 49,
    w = 6.28
  let x = BANK_EDGE,
    y = DECK
  const levels = [],
    terraces = []
  for (let j = 0; j < 49; j++) {
    const next = x + tread,
      low = y - h
    levels.push([x, y])
    terraces.push([x, next, low])
    b.box(
      m.stone,
      (side * (x + next)) / 2,
      (0.89 + low - 0.011) / 2,
      0,
      tread + 0.003,
      low - 0.011 - 0.89,
      w,
      0.91 + (j % 3) * 0.026
    )
    b.box(m.coping, (side * (x + next)) / 2, low - 0.05, 0, tread - 0.005, 0.1, w + 0.047, 0.93)
    if (j % 4 === 1) b.box(m.bronze, side * (next - 0.087), low + 0.003, 0, 0.016, 0.009, w - 0.38, 0.71)
    x = next
    y = low
    if (j === 15 || j === 32) {
      terraces.push([x, x + landing, y])
      b.box(
        m.foundation,
        side * (x + landing / 2),
        (0.89 + y - 0.011) / 2,
        0,
        landing + 0.005,
        y - 0.011 - 0.89,
        w + 0.35
      )
      b.box(m.coping, side * (x + landing / 2), y - 0.067, 0, landing, 0.134, w + 0.36)
      levels.push([x, y], [x + landing, y])
      x += landing
    }
  }
  levels.push([50, 1.35])
  for (const z of [-w / 2, w / 2]) {
    const face = z + Math.sign(z) * 0.014
    for (let row = 0; row < 10; row++) {
      const low = 1.2 + row * 0.91,
        high = low + 0.875
      for (let k = -1; k < 12; k++) {
        const a = Math.max(BANK_EDGE, BANK_EDGE + (k + (row % 2) * 0.5) * 2.5) + 0.012
        const c = Math.min(50, BANK_EDGE + (k + 1 + (row % 2) * 0.5) * 2.5) - 0.012
        if (c - a < 0.04) continue
        const tint = 0.83 + 0.14 * random()
        let start = a,
          prevTop = null,
          end = a
        function block() {
          if (end - start > 0.003 && prevTop > low + 0.003)
            b.face(
              m.stone,
              [
                [side * start, low, face],
                [side * end, low, face],
                [side * end, prevTop, face],
                [side * start, prevTop, face],
              ],
              [tint * 0.93, tint, tint * 0.95]
            )
        }
        for (const [ta, tc, y] of terraces) {
          if (tc <= a || ta >= c) continue
          const top = Math.min(high, y - 0.125)
          if (prevTop !== null && Math.abs(prevTop - top) > 0.001) {
            block()
            start = Math.max(ta, a)
          }
          end = Math.min(tc, c)
          prevTop = top
        }
        block()
      }
    }
    let first = levels[0],
      lastSlope = -1
    for (let j = 1; j < levels.length; j++) {
      const [a, ya] = levels[j - 1],
        [c, yc] = levels[j]
      const slope = Math.abs(yc - ya) < 0.00001 ? 0 : 1
      if ((lastSlope >= 0 && slope !== lastSlope) || j === levels.length - 1) {
        const [p, py] = first,
          ex = j === levels.length - 1 ? c : a,
          ey = j === levels.length - 1 ? yc : ya
        if (ex - p > 0.001) {
          b.beam(m.coping, [side * p, py + 0.78, z], [side * ex, ey + 0.78, z], 0.137, 0.127)
          b.beam(m.stone, [side * p, py + 0.18, z], [side * ex, ey + 0.18, z], 0.158, 0.21, 0.83)
        }
        first = levels[j - 1]
      }
      lastSlope = slope
      if (j % 4 === 0 || j === 1 || j === levels.length - 1) {
        b.box(m.stone, side * c, yc + 0.46, z, 0.183, 0.96, 0.2)
        b.box(m.coping, side * c, yc + 0.91, z, 0.267, 0.157, 0.267)
      }
    }
  }
  // Flared landing, independently dressed on all sides of the gatehouse.
  b.box(m.coping, side * 50.7, 1.313, 0, 1.5, 0.075, 7.58, 0.98)
}

export function stoneBridge(b, m) {
  dressMasonry(m, arches)
  const piers = [
    [-BANK_EDGE, -16.88],
    [-9.36, -7.5],
    [7.5, 9.36],
    [16.88, BANK_EDGE],
  ]
  for (const [a, c] of piers)
    b.box(m.foundation, (a + c) / 2, (foot + wallTop) / 2, 0, c - a, wallTop - foot, 2 * Z_HALF, 0.8)
  for (const arch of arches) bolster(b, m, arch)
  ashlar(b, m)
  for (const side of [-1, 1]) {
    nose(b, m, side * 8.43, 0.87, 4.66)
    nose(b, m, side * 17.96, 1.01, 4.08)
    for (const face of [-1, 1]) rosette(b, m, side * 8.49, 7.87, face * (Z_HALF + 0.12), face)
    grandStairs(b, m, side)
  }
  b.box(m.foundation, 0, DECK - 0.323, 0, 2 * BANK_EDGE + 0.025, 0.3, 2 * Z_HALF + 0.14)
  b.box(m.coping, 0, DECK - 0.205, 0, 2 * BANK_EDGE + 0.15, 0.141, 2 * Z_HALF + 0.36)
  b.box(m.stone, 0, DECK - 0.083, 0, 2 * BANK_EDGE, 0.16, 2 * Z_HALF + 0.08)
  for (let row = 0; row < 6; row++) {
    const zz = -Z_HALF + (row + 0.5) * ((2 * Z_HALF) / 6),
      step = (2 * BANK_EDGE) / 19
    for (let j = -1; j <= 19; j++) {
      const a = Math.max(-BANK_EDGE, -BANK_EDGE + (j + (row % 2) * 0.5) * step),
        c = Math.min(BANK_EDGE, -BANK_EDGE + (j + 1 + (row % 2) * 0.5) * step)
      if (c - a < 0.04) continue
      const d = Z_HALF / 6 - 0.008
      b.face(
        m.coping,
        [
          [a + 0.008, DECK + 0.002, zz + d],
          [c - 0.008, DECK + 0.002, zz + d],
          [c - 0.008, DECK + 0.002, zz - d],
          [a + 0.008, DECK + 0.002, zz - d],
        ],
        0.87 + 0.14 * random()
      )
    }
  }
  for (const side of [-1, 1]) {
    b.box(m.bronze, 0, DECK - 0.27, side * (Z_HALF + 0.185), BANK_EDGE * 2 + 0.1, 0.033, 0.02, 0.92)
    parapet(b, m, -BANK_EDGE, BANK_EDGE, side * (Z_HALF - 0.035), DECK)
  }
}
