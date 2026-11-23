import * as T from 'three'
import { roof } from './kit.js'
import {
  bridgeBeacons,
  keystoneLamp,
  vaultLamps,
  cageLamp,
  keeperDesk,
  screenWick,
  screenedBay,
  silkLantern,
  silkScreen,
} from './gateLamps.js'
import { gatePalette } from './gateSilk.js'
import { DECK, stoneBridge } from './gateStone.js'
import { gateFinish, raisedFret, sign, streamer, tideDrum } from './gateCraft.js'

const MID = 16.32,
  HIGH = 21.0,
  WING = 15.04
const mix = (a, b, t) => a + (b - a) * t

function post(b, m, x, z, base, top, r = 0.18, slim = false) {
  b.tube(m.coping, [x, base, z], [x, base + 0.109, z], r * 1.5, r * 1.54, 8, 0.94, false)
  b.tube(m.patina, [x, base + 0.109, z], [x, base + 0.237, z], r * 1.54, r, 8, 0.86, false)
  b.tube(m.vermilion, [x, base + 0.22, z], [x, top - 0.147, z], r, r * 0.89, 8, slim ? 0.81 : 0.9, false)
  b.tube(m.bronze, [x, base + 0.243, z], [x, base + 0.281, z], r * 1.045, r * 1.05, 8, 1.04, false)
  b.tube(m.teal, [x, top - 0.263, z], [x, top - 0.136, z], r * 0.96, r * 1.66, 4, 0.92, false)
  b.tube(m.timber, [x, top - 0.137, z], [x, top + 0.018, z], r * 1.66, r * 2.01, 4, 0.96, false)
}

function bracket(b, m, x, y, z, scale = 1) {
  b.at(x, y, z, 0, () =>
    b.scaleBy(scale, () => {
      for (const [dx, dy, w, d, mat] of [
        [0, -0.21, 0.59, 0.38, m.teal],
        [0, -0.069, 0.84, 0.42, m.vermilion],
        [0, 0.045, 0.96, 0.46, m.wood],
      ])
        b.box(mat, dx, dy, 0, w, 0.13, d)
      for (const s of [-1, 1]) {
        raisedFret(b, m.teal, [s * 0.17, -0.3, 0], [s * 0.43, -0.12, 0], 0.118, 0.21)
        b.face(m.bronze, [
          [s * 0.335, -0.102, 0.214],
          [s * 0.451, -0.102, 0.214],
          [s * 0.451, -0.036, 0.214],
          [s * 0.335, -0.036, 0.214],
        ])
        b.beam(m.timber, [0, -0.289, s * 0.11], [0, -0.017, s * 0.5], 0.138, 0.133)
      }
    })
  )
}

function frieze(b, m, x0, x1, y, z, small = false) {
  const x = (x0 + x1) / 2,
    w = x1 - x0,
    h = small ? 0.22 : 0.32
  b.box(m.timber, x, y, z, w, h, 0.204)
  b.box(m.patina, x, y + 0.076, z + 0.11, w - 0.04, h * 0.32, 0.035, 0.82)
  b.box(m.bronze, x, y - h * 0.43, z + 0.114, w - 0.03, 0.034, 0.031, 0.87)
  const n = Math.max(2, Math.round(w / 1.32))
  for (let i = 0; i < n; i++) {
    const c = x0 + (w * (i + 0.5)) / n,
      dx = Math.min(0.23, (w / n) * 0.26)
    b.face(
      m.bronze,
      [
        [c - dx, y + 0.021, z + 0.132],
        [c, y + 0.069, z + 0.132],
        [c + dx, y + 0.021, z + 0.132],
        [c, y - 0.021, z + 0.132],
      ],
      0.87
    )
  }
}

// A pierced paper fan is mounted between two posts. A real aperture above its
// shoulder admits views of blue evening through the gallery behind it.
function fanWindow(b, m, x, y, z, w, h, flip, glow) {
  const points = [
    [x - w / 2, y, z],
    [x + w / 2, y, z],
  ]
  const axis = y + h * 0.28,
    n = 12
  for (let j = 0; j <= n; j++) {
    const a = (Math.PI * j) / n
    points.push([x + w * 0.5 * Math.cos(a), axis + h * 0.72 * Math.sin(a), z])
  }
  silkScreen(b, m, points, x, y, w, h, flip, flip ? [0.92, 0.82, 0.76] : [1, 0.96, 0.85])
  screenWick(b, m, x, y, z, w, h, flip, glow)
  for (let j = 1; j < points.length; j++) raisedFret(b, m.darkwood, points[j - 1], points[j], 0.079, 0.18)
  raisedFret(b, m.darkwood, points.at(-1), points[0], 0.079, 0.18)
  b.box(m.darkwood, x, axis, z, w, 0.074, 0.097)
  for (let j = 1; j < 6; j++) {
    const a = (Math.PI * j) / 6
    raisedFret(
      b,
      m.timber,
      [x + w * 0.12 * Math.cos(a), axis + 0.13 * h * Math.sin(a), z],
      [x + w * 0.5 * Math.cos(a), axis + h * 0.72 * Math.sin(a), z],
      0.057,
      0.091
    )
  }
  const ring = Array.from({ length: 11 }, (_, i) => [
    x + w * 0.235 * Math.cos((i * Math.PI) / 10),
    axis + h * 0.33 * Math.sin((i * Math.PI) / 10),
    z,
  ])
  for (let j = 1; j < ring.length; j++) raisedFret(b, m.timber, ring[j - 1], ring[j], 0.039, 0.053)
  for (const s of [-1, 0, 1]) b.box(m.wood, x + s * w * 0.25, y + 0.14 * h, z, 0.038, h * 0.28, 0.066)
}

function skirt(b, m, width, depth, coreWidth, coreDepth, eave, inner, lift) {
  const W = width / 2,
    D = depth / 2,
    wi = coreWidth / 2,
    di = coreDepth / 2
  for (const side of [-1, 1])
    for (const end of [false, true]) {
      const pt = (s, v, h = 0) => {
        const x = end ? side * mix(W, wi, v) : s * mix(W, wi, v),
          z = end ? s * mix(D, di, v) : side * mix(D, di, v)
        return [
          x,
          eave + (inner - eave) * (0.22 * v + 0.78 * v * v) + lift * Math.abs(s) ** 3.8 * (1 - v) ** 2.2 + h,
          z,
        ]
      }
      const cols = Math.ceil((end ? depth : width) / 0.96),
        rows = 4
      for (let i = 0; i < cols; i++) {
        const a = -1 + (2 * i) / cols,
          c = -1 + (2 * (i + 1)) / cols
        for (let j = 0; j < rows; j++) {
          const v = j / rows,
            vv = (j + 1) / rows,
            p = [pt(a, v), pt(c, v), pt(c, vv), pt(a, vv)]
          const uv = p.map((q, k) => [
            (end ? q[2] : q[0]) * 0.73,
            (k < 2 ? v : vv) * (end ? W - wi : D - di) * 0.81,
          ])
          b.face(m.roof, p, [0.84, 0.98, 0.97], uv)
        }
        b.face(m.darkwood, [pt(a, 0, -0.19), pt(c, 0, -0.19), pt(c, 1, -0.18), pt(a, 1, -0.18)], 0.56)
        b.face(m.roofEdge, [pt(a, 0, -0.156), pt(c, 0, -0.156), pt(c, 0, 0.02), pt(a, 0, 0.02)])
        b.face(m.bronze, [pt(a, 0, 0.02), pt(c, 0, 0.02), pt(c, 0, 0.059), pt(a, 0, 0.059)], 0.98)
        if (i % 3 === 0) b.beam(m.wood, pt(a, 0, -0.196), pt(a, 0.74, -0.201), 0.101, 0.116)
      }
      if (end) continue
      for (const s of [-1, 1]) {
        for (let j = 1; j <= 5; j++)
          b.tube(m.patina, pt(s, (j - 1) / 5, 0.063), pt(s, j / 5, 0.063), 0.109, 0.1, 7, 1, false)
        const p = pt(s, 0, 0.077),
          q = [p[0] + s * 0.24, p[1] + 0.17, p[2] + side * 0.18],
          tip = [q[0] + s * 0.09, q[1] + 0.227, q[2] + side * 0.072]
        b.tube(m.roofEdge, p, q, 0.118, 0.069, 7)
        b.tube(m.bronze, q, tip, 0.072, 0.018, 7)
      }
    }
}

function ridgeFish(b, m, x, y, side, k = 1) {
  b.at(x, y, 0, 0, () =>
    b.scaleBy(k, () => {
      const outline = [
        [-0.26, -0.06],
        [-0.05, 0.04],
        [0.03, 0.23],
        [0.06, 0.44],
        [0.17, 0.62],
        [0.39, 0.71],
        [0.51, 0.68],
        [0.48, 0.56],
        [0.63, 0.58],
        [0.74, 0.47],
        [0.61, 0.43],
        [0.53, 0.41],
        [0.48, 0.29],
        [0.54, 0.18],
        [0.75, 0.21],
        [0.91, 0.33],
        [0.98, 0.42],
        [0.98, 0.25],
        [0.89, 0.1],
        [0.68, -0.05],
        [0.46, -0.1],
      ]
      const tris = T.ShapeUtils.triangulateShape(
        outline.map((p) => new T.Vector2(...p)),
        []
      )
      for (const z of [-0.104, 0.104])
        for (const f of tris)
          b.face(
            m.patina,
            f.map((i) => [side * outline[i][0], outline[i][1], z]),
            0.94
          )
      for (let j = 0; j < outline.length; j++) {
        const [a, d] = outline[j],
          [c, e] = outline[(j + 1) % outline.length]
        b.face(
          m.bronze,
          [
            [side * a, d, -0.104],
            [side * c, e, -0.104],
            [side * c, e, 0.104],
            [side * a, d, 0.104],
          ],
          0.83
        )
      }
      b.tube(m.bronze, [side * 0.348, 0.56, -0.134], [side * 0.348, 0.56, 0.134], 0.038, 0.038, 8)
      for (const f of [-1, 1])
        for (let j = 0; j < 3; j++)
          b.beam(
            m.bronze,
            [side * (0.2 + j * 0.055), 0.22 + j * 0.017, f * 0.117],
            [side * (0.25 + j * 0.065), 0.402 + j * 0.027, f * 0.117],
            0.02,
            0.02
          )
    })
  )
}
function galleryRail(b, m, x0, x1, z, y) {
  const w = x1 - x0,
    c = (x0 + x1) / 2,
    n = Math.max(2, Math.ceil(w / 0.69))
  b.box(m.timber, c, y + 0.18, z, w, 0.083, 0.118)
  b.box(m.vermilion, c, y + 0.86, z, w + 0.04, 0.111, 0.143)
  b.box(m.bronze, c, y + 0.885, z + 0.073, w, 0.027, 0.019, 0.83)
  for (let i = 0; i <= n; i++) {
    const x = x0 + (w * i) / n
    raisedFret(b, m.darkwood, [x, y + 0.16, z], [x, y + 0.831, z], 0.058, 0.073)
    if (i < n) {
      const dx = w / n
      raisedFret(b, m.timber, [x, y + 0.37, z], [x + dx * 0.5, y + 0.59, z], 0.042, 0.049)
      raisedFret(b, m.timber, [x + dx * 0.5, y + 0.59, z], [x + dx, y + 0.37, z], 0.042, 0.049)
    }
  }
}
function floorWithStair(b, m) {
  const x0 = -5.84,
    x1 = 5.32,
    z = -1.72,
    w = 1.23,
    steps = 33,
    run = (x1 - x0) / steps,
    rise = (MID - DECK) / steps
  for (let i = 0; i < steps; i++) {
    const x = x0 + run * i,
      y = DECK + (i + 1) * rise
    b.box(m.wood, x + run / 2, y - 0.04, z, run + 0.025, 0.08, w)
    b.box(m.timber, x + 0.027, y - rise * 0.5 - 0.026, z, 0.044, rise, w - 0.025)
  }
  for (const s of [-1, 1]) {
    const zz = z + s * 0.636
    b.beam(m.wood, [x0, DECK + 0.041, zz], [x1, MID - 0.075, zz], 0.121, 0.157)
    b.beam(m.timber, [x0, DECK + 0.85, zz], [x1, MID + 0.83, zz], 0.074, 0.083)
    for (let i = 0; i <= steps; i += 3)
      b.box(m.wood, x0 + run * i, DECK + i * rise + 0.455, zz, 0.056, 0.802, 0.053)
  }
  // Clear headroom over the flight and a flat landing outside its top edge.
  const deck = (a, c, l, r) => {
    b.box(m.timber, (a + c) / 2, MID - 0.139, (l + r) / 2, c - a, 0.277, r - l)
    b.box(m.wood, (a + c) / 2, MID - 0.013, (l + r) / 2, c - a - 0.002, 0.035, r - l - 0.002)
  }
  deck(-6.3, 6.3, -1.017, 2.91)
  deck(-6.3, 6.3, -2.91, -2.424)
  deck(-6.3, 0.91, -2.424, -1.017)
  deck(5.31, 6.3, -2.424, -1.017)
  galleryRail(b, m, 0.91, 5.24, -1.018, MID)
}
function apron(b, m, x, y, z, w, h) {
  b.box(m.wood, x, y + h / 2, z, w, h, 0.171)
  b.box(m.ink, x, y + h * 0.49, z + 0.088, w - 0.19, h * 0.65, 0.029)
  b.box(m.teal, x, y + h * 0.5, z + 0.113, w - 0.29, h * 0.51, 0.02, 0.75)
  for (const s of [-1, 1]) b.box(m.bronze, x + s * w * 0.32, y + h * 0.5, z + 0.128, 0.084, h * 0.12, 0.024)
}

function audienceHall(b, m, glow) {
  const lower = [-6.27, -3.88, -1.61, 1.61, 3.88, 6.27]
  for (const s of [-1, 1]) {
    b.at(0, 0, s * 3.07, s === 1 ? 0 : Math.PI, () => {
      for (const x of lower) {
        post(b, m, x, 0, DECK, 15.18, 0.199)
        bracket(b, m, x, 15.14, 0, 1.02)
      }
      frieze(b, m, -6.48, 6.48, 15.34, 0)
      for (const x of [-4.96, 5.03]) {
        apron(b, m, x, DECK, 0, 2.05, 0.79)
        screenedBay(b, m, x, DECK + 2.12, 0, 1.93, 2.25, 'bars', x * s > 0, glow)
      }
      // The north facade and the south facade each have three clear doors between
      // the open carved transoms. The long bridge gallery remains open side to side.
      for (const x of [-2.74, 0, 2.74]) {
        const w = x === 0 ? 3.03 : 1.98
        b.box(m.timber, x, DECK + 3.58, 0, w, 0.08, 0.149)
        const count = x === 0 ? 6 : 4
        for (let i = 0; i < count; i++) {
          const xx = x - w * 0.5 + (w * (i + 0.5)) / count
          b.beam(m.wood, [xx - 0.15, DECK + 3.63, 0], [xx, DECK + 3.88, 0], 0.052, 0.061)
          b.beam(m.wood, [xx, DECK + 3.88, 0], [xx + 0.15, DECK + 3.63, 0], 0.052, 0.061)
        }
      }
      sign(b, m, 0, 14.43, 0.27, 2.85, 0.72, s < 0)
    })
    {
      const x = s * 6.17
      b.beam(m.timber, [x, 15.12, -3.19], [x, 15.12, 3.19], 0.221, 0.253)
      b.beam(m.wood, [x, 15.26, -2.75], [x, 16.14, -1.72], 0.132, 0.138)
      b.beam(m.wood, [x, 16.14, 1.72], [x, 15.26, 2.75], 0.132, 0.138)
    }
  }
  floorWithStair(b, m)
  keeperDesk(b, m, -3.89, DECK, 1.48, glow)
  for (const x of [-4.95, -2.67, 0, 2.62, 4.85])
    b.beam(m.timber, [x, MID - 0.39, -1.017], [x, MID - 0.39, 2.705], 0.176, 0.163)
  skirt(b, m, 17.3, 9.5, 12.6, 5.82, 15.08, MID, 0.51)
  for (const s of [-1, 1]) {
    b.at(0, 0, s * (s === 1 ? 1.96 : 2.65), s === 1 ? 0 : Math.PI, () => {
      for (const x of [-4.6, -1.62, 1.62, 4.6]) {
        post(b, m, x, 0, MID, 20.03, 0.153, true)
        bracket(b, m, x, 20.04, 0, 0.85)
      }
      frieze(b, m, -4.82, 4.82, 20.15, 0)
      for (const x of [-3.12, 3.12]) {
        apron(b, m, x, MID, 0, 2.72, 0.65)
        fanWindow(b, m, x, MID + 0.66, 0, 2.55, 2.19, x < 0, glow)
      }
    })
    b.at(0, 0, s * 2.81, s === 1 ? 0 : Math.PI, () => galleryRail(b, m, -6.15, 6.15, 0, MID))
    b.at(s * 6.13, 0, 0, (s * Math.PI) / 2, () => galleryRail(b, m, -2.75, 2.75, 0, MID))
  }
  keeperDesk(b, m, -2.79, MID, -0.11, glow)
  b.box(m.timber, 0, HIGH - 0.158, 0, 9.62, 0.312, 4.6)
  b.box(m.wood, 0, HIGH - 0.027, 0, 9.6, 0.066, 4.62)
  skirt(b, m, 14.3, 8.01, 9.63, 4.64, 19.91, HIGH, 0.56)
  for (const s of [-1, 1]) {
    b.at(0, 0, s * 1.86, s === 1 ? 0 : Math.PI, () => {
      for (const x of [-3.94, -1.63, 1.63, 3.94]) {
        post(b, m, x, 0, HIGH, 24.81, 0.134, true)
        bracket(b, m, x, 24.83, 0, 0.85)
      }
      frieze(b, m, -4.12, 4.12, 24.94, 0)
      for (const x of [-2.78, 2.78]) {
        apron(b, m, x, HIGH, 0, 1.97, 0.43)
        screenedBay(b, m, x, HIGH + 1.52, 0, 1.86, 1.94, 'lattice', x * s < 0, glow)
      }
      galleryRail(b, m, -1.54, 1.54, 0, HIGH)
    })
    b.beam(m.timber, [s * 3.93, 24.94, -2.53], [s * 3.93, 24.94, 2.53], 0.13, 0.158)
    b.at(s * 4.67, 0, 0, (s * Math.PI) / 2, () => galleryRail(b, m, -2.15, 2.15, 0, HIGH))
    for (const x of [-3.54, 3.54]) {
      b.beam(m.bronze, [x, 24.2, s * 1.9], [x, 24.2, s * 4.1], 0.081, 0.079)
      streamer(b, m, x, 24.11, s * 4.12, 1.017, 6.31, x * s < 0 ? 'tide' : 'fire')
    }
  }
  tideDrum(b, m, HIGH)
  roof(b, m, 0, 24.88, 0, 12.75, 8.1, 2.73, { hip: 0.225, lift: 0.68 })
  for (const s of [-1, 1]) ridgeFish(b, m, s * 3.54, 27.72, s, 0.97)
}

function wingHouse(b, m, hand, glow) {
  for (const s of [-1, 1]) {
    b.at(0, 0, s * 2.29, s === 1 ? 0 : Math.PI, () => {
      for (const x of [-2.77, 0, 2.77]) {
        post(b, m, x, 0, DECK, 14.0, 0.159)
        bracket(b, m, x, 14.03, 0, 0.79)
      }
      frieze(b, m, -2.97, 2.97, 14.15, 0, true)
      const x = hand * s * 1.39
      apron(b, m, x, DECK, 0, 2.53, 0.68)
      fanWindow(b, m, x, DECK + 0.73, 0, 2.26, 1.81, x < 0, glow)
      screenedBay(b, m, -x, DECK + 2.81, 0, 2.45, 0.59, 'lattice', false, glow)
    })
    b.at(s * 2.77, 0, 0, (s * Math.PI) / 2, () => {
      frieze(b, m, -2.29, 2.29, 14.14, 0, true)
      for (const x of [-1.59, 1.59]) apron(b, m, x, DECK, 0, 1.07, 0.65)
    })
  }
  b.box(m.timber, 0, WING - 0.12, 0, 5.84, 0.24, 5.17)
  b.box(m.wood, 0, WING - 0.017, 0, 5.82, 0.047, 5.15)
  skirt(b, m, 8.45, 7.44, 5.84, 5.17, 13.94, WING, 0.42)
  for (const s of [-1, 1]) {
    b.at(0, 0, s * 1.76, s === 1 ? 0 : Math.PI, () => {
      for (const x of [-1.98, 1.98]) {
        post(b, m, x, 0, WING, 17.96, 0.13)
        bracket(b, m, x, 18.0, 0, 0.78)
      }
      frieze(b, m, -2.17, 2.17, 18.09, 0, true)
      const open = hand * s > 0
      if (open) {
        for (const x of [-1.4, 1.4]) screenedBay(b, m, x, WING + 1.31, 0, 0.88, 1.91, 'bars', x < 0, glow)
        galleryRail(b, m, -0.88, 0.88, 0, WING)
      } else {
        apron(b, m, 0, WING, 0, 3.61, 0.69)
        fanWindow(b, m, 0, WING + 0.7, 0, 3.28, 1.78, hand < 0, glow)
      }
    })
    b.at(s * 2.78, 0, 0, (s * Math.PI) / 2, () => galleryRail(b, m, -2.42, 2.42, 0, WING))
  }
  keeperDesk(b, m, -hand * 0.69, WING, -0.11, glow)
  roof(b, m, 0, 18.0, 0, 7.25, 6.43, 1.87, { hip: 0.27, lift: 0.49 })
  for (const s of [-1, 1]) ridgeFish(b, m, s * 1.68, 19.96, s, 0.64)
}
function skywalk(b, m, hand) {
  for (const s of [-1, 1]) {
    const z = s * 1.77
    for (const x of [8.09, 10.66, 13.33]) post(b, m, hand * x, z, DECK, 13.29, 0.126, true)
    b.beam(m.timber, [hand * 7.02, 13.28, z], [hand * 14.21, 13.28, z], 0.168, 0.192)
    b.at(hand * 10.66, 0, z, s === 1 ? 0 : Math.PI, () => galleryRail(b, m, -2.53, 2.53, 0, DECK))
  }
  roof(b, m, hand * 10.56, 13.39, 0, 7.56, 4.71, 0.68, { hip: 0.13, lift: 0.22, detail: false })
}

// Balloons of honey silk and smaller persimmon shades share a braided suspension cord.
function lanternChain(b, m, x, z, top, n, span, glow) {
  b.tube(m.bronze, [x, top - 0.21 - (n - 1) * span - 0.34, z], [x, top + 0.026, z], 0.018, 0.018, 6, 1, false)
  for (let j = 0; j < n; j++) {
    const y = top - 0.43 - j * span,
      rr = j % 2 ? 0.27 : 0.37,
      h = j % 2 ? 0.49 : 0.65
    const red = j % 2 === 0
    silkLantern(b, m, x, y, z, rr, h, red)
    glow(x, y, z, red ? 0xff692e : 0xffb15a, red ? 2.0 : 3.0, red ? 3.35 : 4.1)
  }
  b.tube(
    m.vermilion,
    [x, top - 0.82 - (n - 1) * span - 0.28, z],
    [x, top - 0.82 - (n - 1) * span, z],
    0.04,
    0.085,
    8
  )
}
function ceremonialPillar(b, m, x, z, base) {
  b.box(m.stone, x, base + 0.16, z, 0.93, 0.32, 0.92)
  b.tube(m.coping, [x, base + 0.31, z], [x, base + 0.56, z], 0.43, 0.3, 8)
  b.tube(m.vermilion, [x, base + 0.53, z], [x, base + 3.65, z], 0.178, 0.137, 10)
  for (const y of [0.63, 0.74, 2.74, 3.41])
    b.tube(m.bronze, [x, base + y, z], [x, base + y + 0.056, z], 0.191, 0.182, 8)
  b.tube(m.teal, [x, base + 2.94, z], [x, base + 3.13, z], 0.37, 0.28, 8)
  cageLamp(b, m, x, base + 3.47, z, 0.33, 0.72)
  b.tube(m.teal, [x, base + 3.82, z], [x, base + 4.1, z], 0.5, 0.14, 8)
  b.tube(m.bronze, [x, base + 4.09, z], [x, base + 4.46, z], 0.13, 0.018, 8)
}

export function watergate(b, source, world) {
  const m = gatePalette(source)
  gateFinish(m)
  b.at(0, 0, -9, 0, () => {
    const glow = (x, y, z, color, power, range) => world.lamp(...b.point([x, y, z]), color, power, range)
    const pendant = (x, y, z, anchor, r, h, power, range, red = false) => {
      const wall = z - Math.sign(z) * 0.245
      b.box(m.bronze, x, anchor + 0.054, wall, 0.105, 0.19, 0.079, 0.68)
      b.beam(m.darkwood, [x, anchor + 0.034, wall], [x, anchor + 0.034, z], 0.085, 0.074)
      b.tube(m.bronze, [x, y + h * 0.49, z], [x, anchor + 0.021, z], 0.018, 0.018, 6, 1, false)
      silkLantern(b, m, x, y, z, r, h, red)
      glow(x, y, z, red ? 0xff853e : 0xffb865, power, range)
    }
    stoneBridge(b, m)
    // A modest oil niche above each central keystone reveals the dressed
    // arch crown. The wick and bracket clear the full barrel passage.
    for (const face of [-1, 1]) {
      const { x, y, z, radius, height, power } = keystoneLamp
      b.beam(m.patina, [x, y + height * 0.28, face * 4.47], [x, y + height * 0.28, face * z], 0.104, 0.077)
      cageLamp(b, m, x, y, face * z, radius, height)
      glow(x, y, face * z, 0xffbd78, power, 6.1)
    }
    audienceHall(b, m, glow)
    for (const side of [-1, 1]) {
      b.at(side * 17.14, 0, 0, 0, () => wingHouse(b, m, side, glow))
      skywalk(b, m, side)
      for (const face of [-1, 1]) {
        const x = side * 7.82,
          z = face * 4.55
        b.beam(m.timber, [x, 15.19, face * 3.0], [x, 15.19, z], 0.16, 0.16)
        lanternChain(b, m, x, z, 15.18, 5, 0.97, glow)
        const wx = side * 17.14 + side * 2.27,
          wz = face * 3.05
        b.beam(m.timber, [wx, 17.99, face * 1.76], [wx, 17.99, wz], 0.11, 0.115)
        lanternChain(b, m, wx, wz, 17.92, 3, 0.79, glow)
        // Oil lamps sit in bronze cages beneath the vaults. Their brackets
        // actually meet the radial stones at the two mouths of each tunnel.
        for (const { x: xx, y: yy, z: zz, anchor, radius: r, power, range } of vaultLamps) {
          const xxw = side * xx,
            zzw = face * zz
          b.beam(m.patina, [side * (xx + 0.48), anchor, zzw], [xxw, anchor, zzw], 0.074, 0.081)
          b.tube(m.bronze, [xxw, yy + 0.34, zzw], [xxw, anchor, zzw], 0.022, 0.022, 6, 0.8, false)
          cageLamp(b, m, xxw, yy, zzw, r, 0.67)
          glow(xxw, yy, zzw, 0xffab57, power, range)
        }
        // Both cutwaters carry tide lights. Their overhanging trays put the
        // wick ahead of the wall so the piers and the springers catch its light.
        for (const { x: offset, base: level, z, radius: r, height: h, power } of bridgeBeacons) {
          const bx = offset * side,
            bz = z * face
          b.beam(m.patina, [bx, level - 0.27, 4.56 * face], [bx, level + 0.1, bz], 0.145, 0.13)
          b.box(m.coping, bx, level + 0.065, face * 4.73, r * 1.7, 0.18, 0.94)
          const ly = level + 0.16 + h * 0.48
          cageLamp(b, m, bx, ly, bz, r, h)
          glow(bx, ly, bz, 0xffae61, power, 7.2)
        }
        pendant(side * 2.73, 13.78, face * 3.34, 15.15, 0.405, 0.89, 6.8, 5.35, side * face < 0)
        pendant(side * 1.27, 19.02, face * (face === 1 ? 2.22 : 2.89), 20.05, 0.335, 0.74, 4.7, 4.9)
        pendant(side * 1.37, 23.66, face * 2.06, 24.77, 0.37, 0.76, 4.2, 4.6, side * face > 0)
        for (const gx of [9.24, 11.93])
          pendant(
            side * gx,
            12.73,
            face * 1.94,
            13.26,
            gx < 10 ? 0.25 : 0.29,
            0.57,
            gx < 10 ? 2.7 : 4.1,
            4.25,
            gx < 10
          )
        pendant(side * 17.14 - side * 1.29, 12.99, face * 2.47, 14.05, 0.34, 0.71, 4.8, 4.8)
        pendant(side * 17.14 + side * 0.79, 17.08, face * 1.93, 17.98, 0.29, 0.64, 3.6, 4.4, face < 0)
        ceremonialPillar(b, m, side * 49.22, face * 3.77, 1.35)
        glow(side * 49.22, 4.82, face * 3.77, 0xffab65, 8.3, 6.2)
        for (const [xx, level] of [
          [31.11, 7.41796],
          [41.27, 4.29198],
        ]) {
          const sx = side * xx,
            sz = face * 3.34
          b.box(m.stone, sx, level + 0.23, sz, 0.4, 0.46, 0.44)
          b.tube(m.patina, [sx, level + 0.42, sz], [sx, level + 0.98, sz], 0.154, 0.106, 8)
          cageLamp(b, m, sx, level + 1.18, sz, 0.237, 0.48)
          b.tube(m.patina, [sx, level + 1.43, sz], [sx, level + 1.6, sz], 0.283, 0.069, 8)
          glow(sx, level + 1.18, sz, 0xffba7b, 5.5, 5.3)
        }
      }
    }
  })
}
