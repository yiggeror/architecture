import * as T from 'three'
import { Mason } from './mesh.js'
import { lantern, roof } from './kit.js'
import { buildCarp, cord, oval } from './fleetCarp.js'
import { crewFixtures, sweepPoint } from './characterPropCrew.js'

const tau = Math.PI * 2
function breadth(boat, u) {
  return (
    boat.beam * 0.5 * (0.021 + 0.979 * Math.max(0, 1 - Math.pow(Math.abs(u), 2.55)) ** 0.69) * (1 - 0.055 * u)
  )
}
function top(boat, u) {
  return boat.deck + 0.105 + Math.abs(u) ** 3.4 * (0.4 + 0.16 * u)
}
function hull(b, m, boat, boxes, opaquePanels) {
  const n = 26,
    deep = boat.kind === 'carp' ? 0.57 : 0.39
  function p(u, j, sg) {
    const levels = [0, 0.18, 0.52, 0.82, 1],
      flaring = [0.08, 0.53, 0.8, 0.97, 1]
    const y0 = -deep + Math.abs(u) ** 3 * 0.39,
      hi = top(boat, u)
    return [sg * breadth(boat, u) * flaring[j], y0 + (hi - y0) * levels[j], (u * boat.length) / 2]
  }
  for (let i = 0; i < n; i++) {
    const a = (i * 2) / n - 1,
      c = ((i + 1) * 2) / n - 1
    for (const sg of [-1, 1]) {
      for (let j = 0; j < 4; j++) {
        const q = [p(a, j, sg), p(a, j + 1, sg), p(c, j + 1, sg), p(c, j, sg)]
        b.face(j === 3 ? m.timber : m.darkwood, sg > 0 ? q : q.reverse(), 0.88 + 0.09 * ((i + j) % 3))
      }
      if (i % 2 === 0) {
        const e = ((i + 2) * 2) / n - 1
        cord(b, m.bronze, [p(a, 3, sg), p(c, 3, sg), p(e, 3, sg)], 0.024, 5)
      }
      b.beam(m.wood, p(a, 4, sg), p(c, 4, sg), boat.kind === 'carp' ? 0.115 : 0.078, 0.093)
    }
    const deck = (u, sg) => [
      sg * breadth(boat, u) * 0.96,
      boat.deck + 0.12 * Math.abs(u) ** 4,
      (u * boat.length) / 2,
    ]
    const planks = [deck(a, -1), deck(c, -1), deck(c, 1), deck(a, 1)]
    b.face(m.wood, planks, 0.8 + (0.15 * ((i * 7) % 4)) / 3)
    opaquePanels.push(...planks.flat())
    b.beam(m.darkwood, deck(a, -1), deck(a, 1), 0.015, 0.019, 0.86)
    if (i % 2 === 0) {
      const edge = ((i + 2) * 2) / n - 1,
        w = Math.max(0.11, breadth(boat, (a + edge) / 2) * 0.96)
      boxes.push([-w, -deep, (a * boat.length) / 2, w, boat.deck + 0.095, (edge * boat.length) / 2])
    }
  }
  for (const s of [-1, 1]) {
    const bow = (s * boat.length) / 2
    cord(
      b,
      m.gold,
      [
        [0, top(boat, s) - 0.35, bow * 0.97],
        [0, top(boat, s) + 0.13, bow],
        [0, top(boat, s) + 0.27, bow + s * 0.08],
      ],
      0.05,
    )
  }
}
function bench(b, m, x, y, z, w, d) {
  b.box(m.wood, x, y + 0.31, z, w, 0.105, d)
  for (const sg of [-1, 1])
    b.box(m.darkwood, x + sg * w * 0.3, y + 0.14, z + sg * d * 0.29, 0.093, 0.27, 0.13)
}
function crate(b, m, x, y, z, w, h, d) {
  b.box(m.reed, x, y + h / 2, z, w, h, d, 0.86)
  for (const sg of [-1, 1]) {
    b.box(m.rope, x + sg * w * 0.25, y + h * 0.5, z, 0.046, h + 0.012, d + 0.02)
    b.box(m.darkwood, x, y + h * 0.5, z + sg * d * 0.49, w + 0.013, 0.045, 0.038)
  }
}
function basket(b, m, x, y, z, r) {
  b.tube(m.reed, [x, y, z], [x, y + r * 1.33, z], r * 0.7, r, 12, 0.91)
  b.tube(m.darkwood, [x, y + r * 1.33 + 0.008, z], [x, y + r * 1.33 + 0.025, z], r * 0.79, r * 0.8, 12, 0.82)
  for (let k = 1; k <= 4; k++)
    b.tube(
      m.rope,
      [x, y + r * 0.29 * k, z],
      [x, y + r * 0.29 * k + 0.024, z],
      r * (0.7 + 0.066 * k),
      r * (0.72 + 0.066 * k),
      12,
    )
}
function canopy(b, m, z, len, w, eave, body, opaquePanels) {
  const hw = w * 0.5
  function p(t, d) {
    return [hw * Math.cos(t), eave + hw * 0.82 * Math.sin(t), z + d]
  }
  const strips = 11
  // Each straight strip is opaque along its entire length including the seven
  // painted sections. Record its real outline for passengers under the arch.
  for (let i = 0; i < strips; i++) {
    const a = i * Math.PI / strips, c = (i + 1) * Math.PI / strips
    opaquePanels.push(...p(a, -len / 2), ...p(c, -len / 2), ...p(c, len / 2), ...p(a, len / 2))
  }
  for (let i = 0; i < strips; i++)
    for (let j = 0; j < 7; j++) {
      const a = (i * Math.PI) / strips,
        c = ((i + 1) * Math.PI) / strips,
        lo = (j / 7 - 0.5) * len,
        hi = ((j + 1) / 7 - 0.5) * len
      b.face(body, [p(a, lo), p(c, lo), p(c, hi), p(a, hi)], 0.8 + (0.12 * ((i + j) % 3)) / 2)
    }
  for (let j = 0; j <= 7; j++) {
    const d = (j / 7 - 0.5) * len,
      hoop = Array.from({ length: strips + 1 }, (_, i) => p((i * Math.PI) / strips, d))
    cord(b, m.darkwood, hoop, 0.023, 5)
    if (j % 2 === 0 || j === 7)
      for (const s of [-1, 1]) b.tube(m.wood, [s * hw, 0.62, z + d], [s * hw, eave, z + d], 0.035, 0.028, 6)
  }
}
function handrail(b, m, boat, z0, z1, h, panels) {
  const w = boat.beam * 0.43
  for (const sg of [-1, 1]) {
    let from = z0
    for (const sweep of crewFixtures(boat).sweeps.filter((o) => o.side === sg)) {
      const low = Math.max(z0, sweep.z - 0.13),
        high = Math.min(z1, sweep.z + 0.59)
      if (high <= low) continue
      if (low - from > 0.16) section(sg, from, low)
      from = high
      b.box(m.wood, sg * w, boat.deck + 0.12, (low + high) / 2, 0.086, 0.067, high - low)
    }
    if (z1 - from > 0.16) section(sg, from, z1)
  }
  function section(sg, z0, z1) {
    for (const y of [boat.deck + 0.15, boat.deck + h])
      b.box(m.vermilion, sg * w, y, (z0 + z1) / 2, 0.083, 0.098, z1 - z0)
    const n = Math.ceil((z1 - z0) / 0.98)
    for (let i = 0; i < n; i++) {
      const lo = z0 + ((z1 - z0) * i) / n,
        hi = z0 + ((z1 - z0) * (i + 1)) / n,
        mid = (lo + hi) * 0.5,
        base = boat.deck
      b.box(m.darkwood, sg * w, base + h * 0.59, lo, 0.077, h * 0.95, 0.079)
      if (!panels) {
        b.beam(m.gold, [sg * w, base + 0.21, lo + 0.06], [sg * w, base + h - 0.07, hi - 0.06], 0.035)
        continue
      }
      const outer = sg * (w + 0.021),
        l = lo + 0.043,
        r = hi - 0.043,
        bot = base + h * 0.27,
        cap = base + h * 0.84
      const u = (i % 4) * 0.25 + 0.0006,
        v = u + 0.2488
      const q = [
        [outer, bot, l],
        [outer, bot, r],
        [outer, cap, r],
        [outer, cap, l],
      ]
      b.face(panels, q, 1, [
        [u, 0],
        [v, 0],
        [v, 1],
        [u, 1],
      ])
      for (const qz of [l, r]) b.box(m.bronze, outer, (bot + cap) * 0.5, qz, 0.032, cap - bot, 0.024)
      for (const yy of [bot, cap]) b.box(m.bronze, outer, yy, mid, 0.033, 0.026, r - l)
    }
    b.box(m.darkwood, sg * w, boat.deck + h * 0.59, z1, 0.077, h * 0.95, 0.079)
  }
}
function pavilion(b, m, boat, cab, boxes, deckLanterns) {
  const w = boat.beam * 0.82,
    len = boat.length * 0.49,
    z = 0.32,
    base = boat.deck
  const eave = base + (cab ? 1.9 : 1.74)
  for (const s of [-1, 1]) {
    for (let j = 0; j < 4; j++) {
      const q = z + len * (j / 3 - 0.5)
      b.box(m.vermilion, s * w * 0.46, (base + eave) / 2, q, 0.091, eave - base, 0.091)
      boxes.push([s * w * 0.46 - 0.052, base, q - 0.052, s * w * 0.46 + 0.052, eave, q + 0.052])
    }
    for (const yy of [base + 0.23, eave - 0.15, eave - 0.34])
      b.box(m.wood, s * w * 0.45, yy, z, 0.079, 0.076, len)
    for (let j = 0; j < 3; j++) {
      const q = z + len * ((j + 0.5) / 3 - 0.5),
        p = len / 3
      if (cab && j !== 1) {
        b.box(m.paper, s * w * 0.45, base + 1.04, q, 0.036, 1.05, p - 0.11)
        boxes.push([
          s * w * 0.45 - 0.04,
          base + 0.12,
          q - p * 0.46,
          s * w * 0.45 + 0.04,
          eave - 0.3,
          q + p * 0.46,
        ])
        for (const a of [-1, 0, 1])
          b.box(m.darkwood, s * w * 0.468, base + 1.05, q + a * p * 0.27, 0.066, 1.05, 0.034)
        for (const a of [-1, 1])
          b.beam(
            m.darkwood,
            [s * w * 0.48, base + 0.77, q],
            [s * w * 0.48, base + 1.08, q + a * p * 0.25],
            0.03,
          )
      } else {
        const x = s * w * 0.45
        b.face(m.redSilk, [
          [x, eave - 0.18, q - p * 0.47],
          [x, eave - 0.18, q + p * 0.47],
          [x, eave - 0.36, q + p * 0.47],
          [x, eave - 0.52, q + p * 0.22],
          [x, eave - 0.38, q],
          [x, eave - 0.49, q - p * 0.26],
          [x, eave - 0.35, q - p * 0.47],
        ])
      }
    }
  }
  roof(b, m, 0, eave, z, w + 0.38, len + 0.62, cab ? 0.75 : 0.56, {
    detail: false,
    lift: 0.15,
    hip: 0.21,
    shade: cab ? m.teal : m.redSilk,
    trim: m.gold,
  })
  boxes.push([-w * 0.55, eave - 0.12, z - len * 0.55, w * 0.55, eave + 0.36, z + len * 0.55])
  boxes.push([-w * 0.28, eave + 0.31, z - len * 0.43, w * 0.28, eave + (cab ? 0.75 : 0.56), z + len * 0.43])
  for (const side of [-1, 1])
    for (const end of [-1, 1]) {
      const offset = new T.Vector3(side * w * 0.48, eave - 0.46, z + end * len * 0.5)
      const bright = side === -1 && end === 1
      const style = cab || (!bright && end === -1) ? 'red' : 'amber'
      lantern(b, m, offset.x, offset.y, offset.z, bright ? 0.17 : 0.14, bright ? 0.44 : 0.38, style)
      deckLanterns.push({
        offset, position: new T.Vector3(), tint: new T.Color(style === 'red' ? 0xf49a6b : 0xffdcaa),
        power: bright ? 14.5 : style === 'red' ? 2.9 : 4.8, range: 5.5,
      })
    }
  return eave
}
function drum(b, m, x, y, z, r) {
  b.tube(m.vermilion, [x, y, z], [x, y + 0.4, z], r * 0.8, r, 14)
  b.tube(m.darkwood, [x, y + 0.4, z], [x, y + 0.43, z], r + 0.018, r + 0.018, 14)
  b.tube(m.pearl, [x, y + 0.43, z], [x, y + 0.46, z], r * 0.96, r * 0.96, 16)
  for (let i = 0; i < 12; i++) {
    const t = (i * tau) / 12
    oval(b, m.gold, [x + r * Math.cos(t), y + 0.35, z + r * Math.sin(t)], [0.035, 0.036, 0.037], 1, 6, 4)
  }
}
function paradeBarge(b, m, silk, panels, boat, boxes) {
  const base = boat.deck
  handrail(b, m, boat, -5.45, 5.55, 0.69, panels)
  for (const z of [-2.37, 0.16, 2.27]) {
    for (const s of [-1, 1]) {
      b.beam(m.vermilion, [s * 0.81, base + 0.03, z], [s * 0.2, 2.33, z], 0.13, 0.11)
      b.box(m.gold, s * 0.69, base + 0.38, z, 0.22, 0.13, 0.25)
    }
    b.box(m.darkwood, 0, base + 0.14, z, 1.86, 0.18, 0.39)
  }
  for (const z of [-4.95, -1.83, 1.6, 4.89])
    for (const sg of [-1, 1]) {
      const x = sg * boat.beam * 0.434
      b.tube(m.vermilion, [x, base + 0.04, z], [x, base + 1.75, z], 0.052, 0.04, 8)
      b.beam(m.gold, [x, base + 1.59, z], [x + sg * 0.27, base + 1.74, z], 0.049)
      lantern(b, m, x + sg * 0.2, base + 1.37, z, 0.16, 0.42, Math.abs(z) > 3 ? 'red' : 'amber')
    }
  for (const s of [-1, 1]) {
    for (const sg of [-1, 1]) {
      const lip = [],
        seam = []
      for (let j = 0; j <= 9; j++) {
        const q = j / 9,
          u = s * (0.744 + 0.25 * q),
          z = u * boat.length * 0.5,
          w = breadth(boat, u)
        const x = sg * w * 0.91,
          base = top(boat, u) - 0.06
        const a = [x, base, z],
          c = [x * 0.99, base + 0.12 + 0.46 * q * q + 0.075 * Math.sin(q * 3.6), z + 0.1 * s * q * q]
        if (j) b.face(m.vermilion, [seam[j - 1], a, c, lip[j - 1]], [0.88, 0.74, 0.7])
        lip.push(c)
        seam.push(a)
      }
      cord(b, m.gold, lip, 0.036, 6)
      cord(b, m.wood, seam, 0.06, 6)
      const c = lip.at(-1)
      const crest = Array.from({ length: 11 }, (_, i) => {
        const f = i / 10,
          a = 1.8 * f * Math.PI
        return [
          c[0] + sg * 0.028 * Math.sin(a),
          c[1] + 0.11 + 0.108 * Math.sin(a - 1.3),
          c[2] + s * (0.056 + 0.135 * Math.sin(a)),
        ]
      })
      cord(b, m.bronze, crest, 0.033, 6)
    }
  }
  drum(b, m, 0, base + 0.1, 5.13, 0.49)
  buildCarp(b, m, silk)
  for (const [lo, hi, y, w] of [
    [-3.22, -2.3, 3.13, 0.43],
    [-2.3, -1.2, 3.65, 0.7],
    [-1.2, 1.43, 4.02, 0.91],
    [1.43, 2.59, 3.96, 0.75],
    [2.59, 3.47, 3.75, 0.48],
  ])
    boxes.push([-w, 2.18, lo, w, y, hi])
}
export function buildVessel(scene, m, boat, silk, panels) {
  const group = new T.Group(),
    b = new Mason(group),
    boxes = [],
    deckLanterns = []
  group.name = boat.name
  const opaquePanels = []
  hull(b, m, boat, boxes, opaquePanels)
  const d = boat.deck,
    passenger = boat.kind === 'pavilion',
    music = boat.kind === 'music'
  if (boat.kind === 'carp') paradeBarge(b, m, silk, panels, boat, boxes)
  else if (passenger || music) {
    handrail(b, m, boat, -boat.length * 0.32, boat.length * 0.35, 0.51, false)
    pavilion(b, m, boat, passenger, boxes, deckLanterns)
    if (music) drum(b, m, 0, d + 0.05, boat.length * 0.3, 0.29)
  } else if (boat.kind === 'covered') {
    const eave = d + 0.82,
      len = boat.length * 0.47,
      w = boat.beam * 0.8
    canopy(b, m, 0.13, len, w, eave, boat.beam < 1.9 ? m.ink : m.reed, opaquePanels)
    for (let i = -2; i <= 2; i++) {
      const v = i * 0.19 * w * 0.95,
        y = eave + 0.5 * w * 0.82 * Math.sqrt(Math.max(0, 1 - (v / (w * 0.5)) ** 2))
      boxes.push([v - 0.1 * w, y - 0.15, 0.13 - len * 0.5, v + 0.1 * w, y + 0.03, 0.13 + len * 0.5])
    }
    basket(b, m, 0.12, d + 0.01, boat.length * 0.31, 0.29)
    lantern(b, m, 0.52, d + 1.15, -len * 0.5, 0.12, 0.3, 'amber')
  } else if (boat.kind === 'cargo') {
    for (let j = 0; j < 3; j++)
      for (const side of [-1, 1]) {
        const z = 0.86 * j - 0.93,
          w = 0.69
        crate(b, m, side * 0.4, d + 0.02, z, w, 0.43, 0.73)
        if ((j === 1 && side === 1) || j === 0) crate(b, m, side * 0.39, d + 0.47, z, 0.56, 0.31, 0.6)
      }
    for (const z of [1.72, -1.98]) basket(b, m, 0.04, d + 0.04, z, 0.37)
    canopy(b, m, 2.42, 1.25, 1.35, d + 0.88, m.reed, opaquePanels)
    boxes.push([-0.83, d - 0.01, -1.36, 0.82, d + 0.81, 1.35])
  } else {
    for (const side of [-1, 1])
      cord(
        b,
        m.rope,
        [
          [side * 0.67, d + 0.47, side < 0 ? -1.51 : -1.91],
          [side * 0.78, d + 0.36, 0.1],
          [side * 0.67, d + 0.49, 1.8],
        ],
        0.024,
      )
  }
  // One local yaw pivot per sweep. Its blade and timber shaft are a single rigid piece.
  const fixtures = crewFixtures(boat),
    oars = []
  for (const seat of fixtures.benches) bench(b, m, seat.x, d, seat.z, seat.w, seat.d)
  for (const station of fixtures.sweeps) {
    const pivot = new T.Group(),
      o = new Mason(pivot),
      pin = station.pin
    pivot.position.fromArray(pin)
    const s = station.side
    b.tube(m.bronze, [pin[0], d + 0.04, pin[2]], [pin[0], pin[1] + 0.045, pin[2]], 0.047, 0.03, 8)
    b.box(m.wood, pin[0], pin[1] - 0.193, pin[2], 0.14, 0.064, 0.155)
    buildSweep(o, { wood: m.wood, binding: m.rope, ring: m.bronze }, station, boat.deck)
    o.finish()
    group.add(pivot)
    oars.push({ pivot, s, z: station.z, station })
  }
  b.finish()
  scene.add(group)
  const deckSight = {
    vertices: new Float32Array(opaquePanels),
    faces: Uint16Array.from({ length: opaquePanels.length / 3 }, (_, i) => i),
  }
  return { group, boxes, oars, deckLanterns, deckSight }
}

// The thinner turned section is where both hands close. The broad blade
// follows the same centreline all the way down to the water.
export function buildSweep(b, m, station, deck) {
  const point = (t) => sweepPoint(station, t).toArray()
  b.tube(m.wood, point(station.handleEnd), point(0.5), 0.017, 0.02, 12)
  b.tube(m.wood, point(0.5), point(-1.52), 0.02, 0.039, 10)
  for (const t of [0.85, 0.52, 0.12, -0.13])
    b.tube(m.binding, point(t), point(t - 0.017), t > 0.4 ? 0.021 : 0.033, t > 0.4 ? 0.021 : 0.033, 10)
  b.tube(m.ring, point(0.893), point(0.875), 0.02, 0.02, 9)
  const bladeEnd = 1.9 + Math.max(0, deck - 0.48) * 1.13
  const cup = 0.032 + Math.max(0, deck - 0.53) * 0.23
  const sections = [
    [-1.25, 0.047],
    [-1.5, 0.092],
    [-bladeEnd + 0.11, 0.107],
    [-bladeEnd, 0.063],
  ]
  const k = station.side,
    across = [0.802, 0, 0.598 * k]
  let prev
  for (const [t, w] of sections) {
    const p = point(t)
    p[1] -= cup * ((-t - 1.25) / (bladeEnd - 1.25)) ** 1.7
    const ring = [
      [-w, 0],
      [0, 0.027],
      [w, 0],
      [0, -0.014],
    ].map(([f, h]) => [p[0] + f * across[0], p[1] + h, p[2] + f * across[2]])
    if (prev)
      for (let j = 0; j < 4; j++)
        b.face(m.wood, [prev[j], prev[(j + 1) % 4], ring[(j + 1) % 4], ring[j]], j === 1 ? 0.89 : 0.78)
    prev = ring
  }
  b.face(m.wood, prev, 0.85)
}

export function dockWork(scene, m) {
  const group = new T.Group(),
    b = new Mason(group),
    stalls = []
  group.name = '码头木轮拨车'
  for (const [side, z] of [
    [-1, 39.13],
    [1, 38.35],
  ]) {
    const x = side * 17.86,
      y = 1.373
    b.at(x, y, z, 0, () => {
      b.box(m.wood, 0, 0.405, 0, 0.655, 0.095, 1.1, 0.85)
      b.tube(m.ink, [-0.44, 0.24, 0.055], [0.44, 0.24, 0.055], 0.038, 0.038, 8)
      for (const sg of [-1, 1]) {
        const wheel = Array.from({ length: 15 }, (_, i) => [
          0.395 * sg,
          0.235 + 0.225 * Math.cos((i * tau) / 14),
          0.055 + 0.225 * Math.sin((i * tau) / 14),
        ])
        cord(b, m.darkwood, wheel, 0.031, 6)
        for (let i = 0; i < 7; i++) b.tube(m.reed, [0.395 * sg, 0.235, 0.055], wheel[i * 2], 0.014, 0.012, 5)
        b.beam(m.wood, [sg * 0.27, 0.42, -0.46], [sg * 0.29, 0.63, -1.02], 0.05, 0.047)
        b.box(m.darkwood, sg * 0.273, 0.228, -0.41, 0.045, 0.423, 0.056)
      }
      crate(b, m, 0, 0.46, 0.13, 0.5, 0.276, 0.59)
      crate(b, m, 0.022, 0.752, 0.14, 0.36, 0.174, 0.46)
      basket(b, m, 0.015, 0.45, -0.3, 0.137)
    })
    stalls.push([x - 0.42, y, z - 0.55, x + 0.42, y + 0.945, z + 0.53])
  }
  b.finish()
  scene.add(group)
  return stalls
}
