import * as T from 'three'
import { add } from './mesh.js'
import { TAU, stair, rail, perimeter, plinth, floorDeck, lightBox, ring, eaves } from './summitCraft.js'
import { palaceStandards } from './summitOrnaments.js'
import { palaceMaterials, silk, plaque } from './summitSilk.js'
import { galleryHall, roundRoom, readingRoom, bells } from './summitRooms.js'

const axisX = 4,
  axisZ = -101.45
const levels = [13.52, 24.65, 34.42, 44.18]
const twilightLights = [
  [-12, 5.96, -73.1, 0xffb876, 18, 10],
  [22.5, 5.96, -73.1, 0xffbe81, 18, 10],
  [4, 11.5, -89.0, 0xffad65, 25, 14],
  [6.1, 17.1, -97.5, 0xffa468, 53, 19],
  [-28, 14.72, -96.8, 0xffac66, 38, 15],
  [-40.25, 21.15, -111.3, 0xffba71, 22, 11],
  [31.6, 25.75, -101.9, 0xffb368, 37, 15],
  [15.1, 26.0, -105.2, 0xf2c983, 12, 9],
  [4, 39.5, -101.5, 0xf5bd79, 26, 14],
  [4, 51.9, -101.45, 0xffd390, 52, 16],
]
function steadyLamp(b, m, x, y, z, r = 0.46) {
  b.box(m.stone, x, y + 0.2, z, 0.69, 0.4, 0.69)
  b.tube(m.teal, [x, y + 0.39, z], [x, y + 1.22, z], 0.25, 0.195, 8)
  b.box(m.bronze, x, y + 1.29, z, 0.66, 0.15, 0.66)
  lightBox(b, m, x, y + 1.66, z, r, 0.82)
  b.tube(m.bronze, [x, y + 2.07, z], [x, y + 2.25, z], 0.35, 0.08, 8)
}
function starCarpet(b, m, x, front, low, back, high, w) {
  const surface = (a, t, h = 0) => [x + a, low + (high - low) * t + 0.1 + h, front + (back - front) * t]
  b.face(m.patina, [surface(-w, 0), surface(w, 0), surface(w, 1), surface(-w, 1)], 0.91)
  for (const s of [-1, 1])
    b.beam(m.bronze, surface(s * (w - 0.1), 0, 0.025), surface(s * (w - 0.1), 1, 0.025), 0.085, 0.07)
  const stars = [
    [-0.43, 0.08],
    [0.16, 0.23],
    [-0.29, 0.37],
    [0.42, 0.48],
    [0.18, 0.64],
    [-0.42, 0.77],
    [0.25, 0.89],
  ]
  for (let i = 0; i < stars.length; i++) {
    const [a, t] = stars[i],
      p = surface(a * w, t, 0.041)
    if (i) {
      const [e, f] = stars[i - 1]
      b.beam(m.bronze, surface(e * w, f, 0.041), p, 0.071, 0.038)
    }
    const g = Array.from({ length: 8 }, (_, i) =>
      surface(a * w + 0.13 * Math.cos((i * TAU) / 8), t + 0.013 * Math.sin((i * TAU) / 8), 0.065)
    )
    b.face(m.pearl, g)
  }
}
function landing(b, m) {
  plinth(b, m, 0, -93.95, 99.2, 43.9, 1.3, 3.32, 0.41)
  plinth(b, m, -0.2, -99.75, 88.7, 32.6, 3.31, 8.38, 0.43)
  plinth(b, m, axisX, -104.0, 27.6, 22.0, 8.37, levels[0], 0.36)
  plinth(b, m, -29.2, -98.59, 28.9, 19.58, 8.37, 11.42, 0.34)
  plinth(b, m, -39.8, -109.55, 15.1, 15.0, 1.3, 14.32, 0.46)
  plinth(b, m, 31.7, -105.2, 20.3, 21.3, 8.37, 13.48, 0.47)
  stair(b, m, 4, -67.15, 1.35, 3.32, 11.7, 4.85)
  stair(b, m, 4, -73.03, 3.32, 8.38, 12.9, 10.42)
  stair(b, m, 4, -84.0, 8.38, levels[0], 8.38, 9.0)
  starCarpet(b, m, 4, -73.03, 3.32, -83.45, 8.38, 0.92)
  starCarpet(b, m, 4, -84, 8.38, -93.0, levels[0], 0.6)
  stair(b, m, -28.6, -83.74, 8.38, 11.42, 4.7, 5.06)
  stair(b, m, 40.0, -85.25, 8.38, 13.48, 3.1, 9.3)
  stair(b, m, -41.98, -96.94, 11.42, 14.32, 2.65, 5.12)
  stair(b, m, -14.75, -99.6, 11.42, levels[0], 2.44, 4.95, -Math.PI / 2)
  // Slate joint strips tie the landings into the side walks.
  for (const [cx, cz, w, d, y] of [
    [-16, -81.1, 19, 2.1, 3.32],
    [21.6, -80.4, 18.5, 2.3, 3.32],
    [-14.65, -85.98, 18, 2.3, 8.38],
    [23, -85.51, 21, 2.1, 8.38],
    [4, -92.99, 8.1, 0.59, levels[0]],
  ]) {
    b.box(m.stone, cx, y + 0.014, cz, w, 0.028, d, 1.03)
    for (let k = 0; k < Math.floor(w / 2.3); k++)
      b.box(m.ink, cx - w / 2 + (k + 1) * 2.3, y + 0.031, cz, 0.023, 0.004, d, 0.77)
  }
  for (const s of [-1, 1]) {
    for (const [y, z, offset] of [
      [1.35, -67.55, 7.45],
      [3.32, -73.61, 7.33],
      [8.38, -84.34, 5.28],
      [13.52, -93.36, 4.45],
    ]) {
      steadyLamp(b, m, 4 + s * offset, y, z, 0.39)
    }
  }
  for (const [x1, x2, z, y] of [
    [-38.8, -29.7, -72.56, 3.32],
    [-13.7, -3.43, -72.34, 3.32],
    [11.4, 17.2, -72.34, 3.32],
    [35.3, 39.3, -72.56, 3.32],
    [-34.3, -31.7, -83.67, 8.38],
    [-25.3, -3.09, -83.67, 8.38],
    [11.1, 35.3, -83.67, 8.38],
    [-22, -15.9, -88.97, 11.42],
    [-8.3, -0.63, -93.25, 13.52],
    [8.65, 15.82, -93.25, 13.52],
  ]) {
    rail(b, m, [x1, y, z], [x2, y, z], 3.2)
  }
  // Pierced bronze screens divide the promenade into a pair of waterside loggias.
  galleryHall(b, m, -20.0, 3.32, -75.96, 17.3, 4.78, 3.32, 2, 2, true)
  galleryHall(b, m, 25.8, 3.32, -76.56, 15.8, 5.55, 3.55, 2, 1, true)
  for (const [x, z, w] of [
    [-20, -75.99, 12.9],
    [25.8, -76.61, 11.7],
  ]) {
    b.box(m.darkwood, x, 3.92, z - 0.88, w * 0.72, 0.13, 0.64)
    for (const s of [-1, 1]) b.box(m.wood, x + s * w * 0.27, 3.62, z - 0.88, 0.17, 0.59, 0.47)
    for (const s of [-1, 1])
      b.at(x + s * w * 0.32, 4.03, z - 0.96, 0, () => {
        b.box(m.teal, 0, 1.15, 0, 1.92, 2.23, 0.12)
        silk(b, m.summitScreen, 0, 1.15, 0.077, 1.71, 2, 2, 0.84)
      })
  }
  for (const x of [-14, 14]) {
    b.box(m.coping, x, 1.41, -66.55, 3.5, 0.12, 1.05, 0.94)
    for (const dx of [-0.89, 0.89]) {
      b.tube(m.patina, [x + dx, 1.45, -66.4], [x + dx, 1.99, -66.4], 0.21, 0.16, 8)
      ring(b, m.bronze, [x + dx, 1.72, -66.16], 0.14, 0.028, 'xy', 12)
    }
  }
}
function spiral(b, m) {
  let angle = Math.PI / 2
  for (let f = 1; f < levels.length; f++) {
    const low = levels[f - 1],
      high = levels[f],
      n = Math.ceil((high - low) / 0.191),
      dh = (high - low) / n
    const inside = 1.04,
      edge = f === 3 ? 2.89 : 3.2,
      stepAngle = 0.145
    for (let i = 0; i < n; i++) {
      const start = angle + i * stepAngle,
        end = start + stepAngle
      const y = low + (i + 1) * dh,
        outer = i === n - 1 ? edge + 0.56 : edge
      const p = (a, r, yy) => [Math.cos(a) * r, yy, Math.sin(a) * r]
      const top = [p(start, inside, y), p(end, inside, y), p(end, outer, y), p(start, outer, y)]
      b.face(m.wood, top, 0.96 + (0.1 * (i % 3)) / 2)
      b.face(m.darkwood, top.map((v) => add(v, [0, -0.16, 0])).reverse(), 0.89)
      b.face(
        m.bronze,
        [p(start, inside, y - dh), p(start, outer, y - dh), p(start, outer, y), p(start, inside, y)],
        0.7
      )
      b.face(m.timber, [
        p(start, outer, y),
        p(end, outer, y),
        p(end, outer, y - 0.16),
        p(start, outer, y - 0.16),
      ])
      if (i % 2 === 0) {
        const stride = Math.min(2, n - i)
        b.tube(
          m.bronze,
          p(start, inside, y + 0.82),
          p(start + stepAngle * stride, inside, y + dh * stride + 0.82),
          0.051,
          0.051,
          4,
          1,
          false
        )
      }
      if (i % 4 === 0) {
        b.tube(m.patina, p(start, inside, y), p(start, inside, y + 0.84), 0.056, 0.043, 5)
        b.beam(m.teal, p(start, 0.55, y - 0.52), p(start, outer - 0.31, y - 0.13), 0.17, 0.15)
      }
      if (i > 2 && i < n - 4) {
        if (i % 2 === 1) {
          const stride = Math.min(2, n - 4 - i)
          b.tube(
            m.wood,
            p(start, edge - 0.07, y + 0.98),
            p(start + stepAngle * stride, edge - 0.07, y + dh * stride + 0.98),
            0.056,
            0.056,
            5,
            1,
            false
          )
        }
        if (i % 3 === 0)
          b.tube(m.bronze, p(start, edge - 0.07, y), p(start, edge - 0.07, y + 1.01), 0.044, 0.039, 5)
      }
    }
    angle += n * stepAngle
  }
  b.tube(m.patina, [0, levels[0], 0], [0, 46.72, 0], 0.54, 0.43, 14)
  for (let y = levels[0] + 0.8; y < 46; y += 2.4)
    b.tube(m.bronze, [0, y, 0], [0, y + 0.14, 0], 0.58, 0.56, 14)
}
function planisphere(b, m, x, y, z, r, side = 0) {
  b.at(x, y, z, side, () => {
    const loop = Array.from({ length: 48 }, (_, i) => [
      r * Math.cos((i * TAU) / 48),
      r * Math.sin((i * TAU) / 48),
      0,
    ])
    b.face(
      m.summitScreen,
      loop,
      1,
      loop.map((p) => [0.75 + 0.125 + (p[0] / r) * 0.121, 0.75 + (p[1] / r) * 0.239])
    )
    ring(b, m.summitGold, [0, 0, 0.082], r, 0.09, 'xy', 44)
    ring(b, m.bronze, [0, 0, 0.089], r * 0.75, 0.04, 'xy', 38)
    for (let i = 0; i < 24; i++) {
      const a = (i * TAU) / 24,
        r0 = i % 3 === 0 ? 0.75 : 0.84,
        r1 = 0.955
      b.beam(
        m.darkwood,
        [Math.cos(a) * r * r0, Math.sin(a) * r * r0, 0.1],
        [Math.cos(a) * r * r1, Math.sin(a) * r * r1, 0.1],
        i % 3 === 0 ? 0.093 : 0.048,
        0.077
      )
    }
    b.beam(m.teal, [-0.18 * r, -0.06 * r, 0.19], [0.7 * r, 0.41 * r, 0.19], 0.15, 0.12)
    b.beam(m.bronze, [0.08 * r, 0.15 * r, 0.24], [-0.35 * r, -0.82 * r, 0.24], 0.11, 0.11)
    b.tube(m.bronze, [0, 0, 0.2], [0, 0, 0.36], 0.21, 0.15, 12)
  })
}
function mainTower(b, m) {
  roundRoom(b, m, {
    x: axisX,
    z: axisZ,
    rx: 8.9,
    rz: 6.65,
    bottom: levels[0],
    top: 21.65,
    clip: 0.4,
    doors: [0, 2, 4, 6],
    design: 0,
    broad: true,
  })
  eaves(b, m, {
    x: axisX,
    z: axisZ,
    y: 21.73,
    outer: [13.05, 10.44],
    inner: [6.24, 4.9],
    rise: 2.53,
    lift: 1.24,
    clip: 0.37,
    pendants: true,
  })
  roundRoom(b, m, {
    x: axisX,
    z: axisZ,
    rx: 6.47,
    rz: 4.99,
    bottom: levels[1],
    top: 31.54,
    clip: 0.48,
    doors: [0, 2, 4, 6],
    openFaces: [1, 5],
    design: 1,
  })
  eaves(b, m, {
    x: axisX,
    z: axisZ,
    y: 31.61,
    outer: [9.8, 8.15],
    inner: [4.65, 4.1],
    rise: 2.4,
    lift: 0.97,
    clip: 0.54,
    metal: true,
  })
  roundRoom(b, m, {
    x: axisX,
    z: axisZ,
    rx: 4.9,
    rz: 4.63,
    bottom: levels[2],
    top: 40.0,
    clip: 0.62,
    openFaces: [0, 1, 2, 4, 5, 6],
    design: 3,
  })
  eaves(b, m, {
    x: axisX,
    z: axisZ,
    y: 40.05,
    outer: [8.21, 7.77],
    inner: [3.38, 3.36],
    rise: 3.77,
    lift: 1.18,
    clip: 0.6,
    metal: true,
    pendants: true,
  })
  b.at(axisX, 0, axisZ, 0, () => {
    floorDeck(b, m, 8.71, 7.11, levels[1], 0.31, 3.39, 0.41)
    floorDeck(b, m, 6.22, 5.78, levels[2], 0.29, 3.41, 0.51)
    floorDeck(b, m, 4.21, 4.18, levels[3], 0.24, 3.15, 0.6)
    perimeter(b, m, 8.55, 6.94, levels[1], 0.41, { 2: [[0, 0.76]], 3: [[0.34, 1]], 6: [], 1: [] }, 'gold')
    perimeter(b, m, 6.03, 5.58, levels[2], 0.51, {}, 'gold')
    perimeter(b, m, 4.03, 3.99, levels[3], 0.6, {}, 'gold')
    spiral(b, m)
    for (const [x, z] of [
      [-5.15, -2.79],
      [5.26, -2.68],
    ]) {
      b.box(m.teal, x, levels[0] + 0.65, z, 1.79, 1.26, 1.16)
      b.box(m.wood, x, levels[0] + 1.32, z, 1.98, 0.15, 1.31)
      ring(b, m.bronze, [x, levels[0] + 1.47, z], 0.48, 0.036, 'xz', 20)
      b.tube(m.patina, [x - 0.31, levels[0] + 1.49, z], [x + 0.28, levels[0] + 2.0, z + 0.11], 0.08, 0.028, 7)
    }
    plaque(b, m, 0, 20.31, 6.83, 4.74, 1.04, 0)
    for (const sy of [-1, 1])
      for (const sx of [-1, 1]) {
        const px = sx * 5.58,
          pz = sy * 5.65
        b.tube(m.bronze, [px, 20.76, pz], [px, 19.96, pz], 0.041, 0.036, 5)
        lightBox(b, m, px, 19.36, pz, 0.47, 1.09, m.lantern)
      }
    for (const sx of [-1, 1]) {
      const a = [sx * 3.16, 44.18, -1.28],
        p = [sx * 4.2, 46.11, -0.38],
        q = [sx * 5.36, 49.39, 0],
        e = [sx * 5.56, 51.9, 0]
      b.tube(m.patina, a, p, 0.34, 0.29, 8)
      b.tube(m.summitGold, p, q, 0.31, 0.18, 8)
      b.tube(m.summitGold, q, e, 0.18, 0.13, 8)
      b.beam(m.bronze, [sx * 3.43, 44.31, 1.29], [sx * 4.88, 48.53, 0], 0.21, 0.22)
      b.tube(m.summitGold, [sx * 5.24, 51.9, 0], [sx * 5.77, 51.9, 0], 0.34, 0.31, 9)
    }
    b.tube(m.patina, [-5.52, 51.9, 0], [5.52, 51.9, 0], 0.085, 0.085, 7)
    ring(b, m.summitGold, [0, 51.9, 0], 5.57, 0.17, 'xy', 64, 1.05)
    ring(b, m.bronze, [0, 51.9, 0], 5.19, 0.087, 'xy', 60)
    for (let j = 0; j < 32; j++) {
      const a = (j * TAU) / 32,
        r = j % 4 === 0 ? 5.03 : 5.28
      b.beam(
        m.summitMark,
        [r * Math.cos(a), 51.9 + r * Math.sin(a), 0],
        [5.6 * Math.cos(a), 51.9 + 5.6 * Math.sin(a), 0],
        j % 4 === 0 ? 0.13 : 0.074,
        0.1
      )
    }
    b.tube(m.summitGold, [0, 57.27, 0], [0, 58.82, 0], 0.27, 0.018, 9)
  })
}

function westHalls(b, m) {
  galleryHall(b, m, -29.15, 11.42, -96.08, 21.4, 9.44, 5.75, 2, 2)
  readingRoom(b, m, -29.15, 11.56, -96.08)
  b.at(-39.8, 0, -110.52, 0, () => {
    floorDeck(b, m, 5.87, 5.54, 14.46, 0.24, 0, 0.62)
    roundRoom(b, m, {
      x: 0,
      z: 0,
      rx: 4.17,
      rz: 3.92,
      bottom: 14.46,
      top: 23.48,
      clip: 0.68,
      openFaces: [0, 1, 2, 3, 4, 5, 6, 7],
    })
    bells(b, m, 0, 17.85, 0)
    // A carved sounding chest beneath the chimes also braces the tower posts.
    b.box(m.teal, 0, 16.15, 0, 5.83, 3.32, 2.39, 0.88)
    for (const side of [-1, 1])
      for (let j = 0; j < 3; j++)
        b.at((j - 1) * 1.76, 16.08, side * 1.21, side > 0 ? 0 : Math.PI, () => {
          silk(b, m.summitScreen, 0, 0, 0.015, 1.4, 1.97, 1, 0.88)
          b.box(m.bronze, 0, -1.06, 0.02, 1.57, 0.081, 0.14)
        })
    perimeter(
      b,
      m,
      5.53,
      5.23,
      14.46,
      0.65,
      {
        0: [
          [0, 0.24],
          [0.79, 1],
        ],
        2: [],
      },
      'gold'
    )
    eaves(b, m, {
      y: 23.55,
      outer: [6.86, 6.47],
      inner: [2.62, 2.27],
      rise: 3.66,
      lift: 1.08,
      clip: 0.63,
      metal: true,
    })
    b.tube(m.teal, [0, 27.12, 0], [0, 28.02, 0], 2.74, 2.04, 8)
    b.tube(m.summitGold, [0, 28.01, 0], [0, 30.61, 0], 2.22, 0.16, 8)
    b.tube(m.patina, [0, 30.28, 0], [0, 32.64, 0], 0.2, 0.105, 8)
    const wings = [
      [-1.55, 31.68, 0],
      [-0.4, 31.46, 0],
      [0, 31.87, 0],
      [1.79, 32.71, 0],
      [0.96, 32.02, 0],
      [0.15, 31.57, 0],
      [-1.4, 31.89, 0],
    ]
    b.face(m.summitGold, wings)
    b.beam(m.summitGold, [-1.79, 31.56, 0], [1.96, 32.71, 0], 0.091, 0.12)
  })
}
function skyWalk(b, m) {
  const z = -105.16,
    y = 24.65,
    a = 12.3,
    c = 24.52,
    width = 2.39
  const n = 16
  for (let i = 0; i < n; i++)
    b.box(
      m.wood,
      a + ((c - a) * (i + 0.5)) / n,
      y - 0.109,
      z,
      (c - a) / n - 0.013,
      0.217,
      width,
      1 - (0.11 * (i % 3)) / 2
    )
  for (const s of [-1, 1]) {
    const zz = z + s * (width / 2 - 0.055)
    rail(b, m, [a, y, zz], [c, y, zz], 2.23, 'gold')
    b.beam(m.vermilion, [a, y - 0.37, zz], [c, y - 0.37, zz], 0.31, 0.35)
    const spring = (i) => [a + ((c - a) * i) / 8, y - 0.51 - 1.7 * (1 - Math.sin((Math.PI * i) / 8)), zz]
    for (let i = 1; i <= 8; i++) {
      b.beam(m.teal, spring(i - 1), spring(i), 0.22, 0.26)
      if (i % 2 === 0) b.beam(m.bronze, spring(i), [spring(i)[0], y - 0.37, zz], 0.12, 0.12)
    }
  }
  // The exposed lattice arch thrusts into corbels on both observatory decks.
  for (const k of [0, 1])
    for (const s of [-1, 1]) {
      const x = k ? c : a,
        sign = k ? -1 : 1
      b.beam(m.timber, [x, y - 2.52, z + s * 0.88], [x + sign * 1.91, y - 0.37, z + s * 0.88], 0.42, 0.44)
      b.box(m.bronze, x + sign * 0.25, y - 2.31, z + s * 0.88, 0.69, 0.37, 0.66)
    }
  for (const x of [a + 2.01, c - 2.07]) {
    const zz = z + width / 2 - 0.06
    b.tube(m.teal, [x, y, zz], [x, y + 2.59, zz], 0.1, 0.073, 7)
    b.beam(m.bronze, [x, y + 2.55, zz], [x + 0.39, y + 2.66, zz], 0.09, 0.09)
    lightBox(b, m, x + 0.39, y + 2.21, zz, 0.25, 0.64)
  }
}
function eastHalls(b, m) {
  galleryHall(b, m, 27.9, 8.38, -89.34, 18.0, 6.16, 4.47, 1, 1)
  const x = 31.7,
    z = -105.2
  roundRoom(b, m, {
    x,
    z,
    rx: 6.16,
    rz: 5.52,
    bottom: 13.48,
    top: 20.21,
    clip: 0.54,
    doors: [0, 2, 4, 6],
    design: 2,
  })
  eaves(b, m, {
    x,
    z,
    y: 20.35,
    outer: [8.42, 7.38],
    inner: [4.77, 4.32],
    rise: 3.0,
    lift: 0.85,
    clip: 0.59,
    pendants: true,
  })
  b.at(x, 0, z, 0, () => {
    floorDeck(b, m, 7.36, 6.17, 24.65, 0.32, 0, 0.57)
    b.tube(m.teal, [0, 22.94, 0], [0, 24.4, 0], 4.6, 4.83, 8)
    perimeter(
      b,
      m,
      7.21,
      6.02,
      24.65,
      0.58,
      {
        6: [
          [0, 0.3],
          [0.7, 1],
        ],
      },
      'gold'
    )
    roundRoom(b, m, {
      x: 0,
      z: 0,
      rx: 4.49,
      rz: 4.4,
      bottom: 24.65,
      top: 31.38,
      clip: 0.6,
      openFaces: [1, 3, 5, 6, 7],
      design: 3,
      doors: [2, 4],
    })
    // The water clock's circular dial projects beyond the pedestal on two faces.
    for (const s of [-1, 1]) {
      b.at(0, 0, s * 4.71, s > 0 ? 0 : Math.PI, () => {
        b.box(m.darkwood, 0, 27.96, 0, 3.68, 4.73, 0.31)
        planisphere(b, m, 0, 28.23, 0.19, 2.11)
        silk(b, m.summitSign, 0, 25.49, 0.21, 2.65, 0.67, 7)
      })
    }
    // Cisterns, shutters and a long outlet are visible around the drum.
    for (let i = 0; i < 3; i++) {
      const r = 1.15 - i * 0.19,
        y = 14.3 + i * 1.39,
        xx = -1.73 + i * 0.38
      b.tube(m.bronze, [xx, y, 0], [xx, y + 0.77, 0], r * 0.79, r, 12, 0.87)
      b.tube(m.patina, [xx, y + 0.76, 0], [xx, y + 0.86, 0], r * 1.04, r * 1.03, 12)
      b.tube(m.bronze, [xx + r * 0.75, y + 0.54, 0], [xx + r * 1.14, y + 0.45, 0], 0.143, 0.089, 7)
    }
    eaves(b, m, {
      y: 31.49,
      outer: [7.55, 7.11],
      inner: [2.7, 2.66],
      rise: 3.81,
      lift: 1.1,
      clip: 0.67,
      metal: true,
    })
    b.tube(m.darkwood, [0, 35.14, 0], [0, 36.11, 0], 2.72, 2.68, 8)
    b.tube(m.summitGold, [0, 36.08, 0], [0, 38.58, 0], 2.98, 0.31, 8)
    b.tube(m.patina, [0, 38.55, 0], [0, 39.08, 0], 0.36, 0.32, 9)
    lightBox(b, m, 0, 39.69, 0, 0.67, 1.33)
    b.tube(m.summitGold, [0, 40.35, 0], [0, 41.81, 0], 0.22, 0.012, 7)
  })
  skyWalk(b, m)
}
function rearCloister(b, m) {
  // An open loggia turns the rear wall into a second public façade.
  for (const [x, w] of [
    [-18.55, 13.1],
    [12.4, 11.4],
  ]) {
    plinth(b, m, x, -117.22, w + 1.4, 2.7, 1.3, 8.37, 0.27)
    galleryHall(b, m, x, 8.38, -115.54, w, 3.66, 3.6, 2, undefined, true)
  }
  for (const [x, z, y] of [
    [-46.8, -108, 3.32],
    [45.7, -105.0, 3.32],
    [-23.3, -113.4, 8.38],
    [18.4, -112.5, 8.38],
  ]) {
    steadyLamp(b, m, x, y, z, 0.34)
  }
}
export function summit(b, m, world) {
  palaceMaterials(m)
  landing(b, m)
  mainTower(b, m)
  westHalls(b, m)
  eastHalls(b, m)
  rearCloister(b, m)
  palaceStandards(b, m)
  for (const [x, y, z, color, power, range] of twilightLights) world.lamp(x, y, z, color, power, range)
  for (const [x, y, z, power, range] of [
    [-27.1, 6, -74.2, 22, 10],
    [-14.0, 6, -74.2, 22, 10],
    [20.2, 6.4, -74.3, 20, 10],
    [31.1, 6.4, -74.4, 19, 10],
    [-2.7, 5.9, -74.1, 13, 8],
    [11.1, 5.72, -74.0, 14, 8],
    [-2.5, 19.0, -95.0, 27, 13],
    [10.1, 19.3, -94.9, 30, 13],
    [-1.5, 28.6, -97.1, 30, 12],
    [9.5, 28.6, -97.2, 32, 12],
    [3.84, 36.7, -98.42, 19, 10],
    [36.1, 28.1, -104.8, 26, 12],
    [-37.8, 20.7, -108.1, 25, 11],
    [31.2, 16.1, -100.1, 26, 12],
    [21.9, 12.4, -87.3, 23, 9],
    [-35.2, 15.8, -92.3, 22, 12],
    [-17.2, 11, -115.1, 16, 9],
    [12.5, 11.2, -115.3, 18, 10],
  ])
    world.lamp(x, y, z, 0xffbc77, power, range)
}

export function summitMotion(scene, m, world) {
  const root = new T.Group()
  root.name = '璇玑浑仪'
  root.position.set(axisX, 51.9, axisZ)
  scene.add(root)
  const metals = m.summitGold.clone(),
    jade = m.patina.clone()
  metals.vertexColors = false
  jade.vertexColors = false
  const sun = new T.MeshStandardMaterial({
    color: 0xffdf94,
    emissive: 0xffbb57,
    emissiveIntensity: 2.1,
    roughness: 0.27,
    metalness: 0.13,
  })
  const moon = new T.MeshStandardMaterial({
    color: 0xdae8dd,
    emissive: 0xb4e3db,
    emissiveIntensity: 0.87,
    roughness: 0.3,
    metalness: 0.14,
  })
  function torus(parent, r, tube, mat) {
    const o = new T.Mesh(new T.TorusGeometry(r, tube, tube > 0.14 ? 6 : 5, r > 4.5 ? 60 : 48), mat)
    parent.add(o)
    return o
  }
  const meridian = new T.Group(),
    ecliptic = new T.Group(),
    plane = new T.Group()
  root.add(meridian, ecliptic, plane)
  const inner = torus(meridian, 4.71, 0.112, metals)
  inner.rotation.y = 0.13
  torus(meridian, 4.52, 0.054, jade)
  torus(ecliptic, 4.17, 0.163, metals)
  torus(ecliptic, 3.89, 0.077, jade)
  torus(plane, 2.89, 0.079, jade)
  const graduation = new T.IcosahedronGeometry(1, 0)
  const beadGeo = new T.IcosahedronGeometry(1, 1)
  function bead(parent, radius, angle, size, mat) {
    const p = new T.Mesh(beadGeo, mat)
    p.position.set(radius * Math.cos(angle), radius * Math.sin(angle), 0)
    p.scale.setScalar(size)
    parent.add(p)
    return p
  }
  const marker = new T.Object3D()
  for (const major of [true, false]) {
    const marks = new T.InstancedMesh(graduation, major ? moon : metals, major ? 4 : 8)
    let k = 0
    for (let i = 0; i < 12; i++) {
      if ((i % 3 === 0) !== major) continue
      marker.position.set(4.04 * Math.cos((i * TAU) / 12), 4.04 * Math.sin((i * TAU) / 12), 0)
      marker.scale.setScalar(major ? 0.221 : 0.114)
      marker.updateMatrix()
      marks.setMatrixAt(k++, marker.matrix)
    }
    marks.computeBoundingSphere()
    ecliptic.add(marks)
  }
  bead(plane, 2.89, 0.87, 0.52, moon)
  const core = bead(root, 0, 0, 1.18, sun)
  const bezel = torus(root, 1.45, 0.082, metals)
  bezel.rotation.x = 1.13
  const skyAxis = new T.Mesh(new T.CylinderGeometry(0.09, 0.12, 9.31, 8), metals)
  skyAxis.rotation.z = -0.48
  root.add(skyAxis)
  return {
    update(t, day) {
      meridian.rotation.set(0.16, t * 0.11 + 0.41, -0.34)
      ecliptic.rotation.set(0.64, t * 0.17 - 0.66, 0.89)
      plane.rotation.set(1.07, t * 0.23 + 0.42, -0.32)
      core.rotation.y = t * 0.24
      sun.emissiveIntensity = day ? 0.27 : 2.18
      moon.emissiveIntensity = day ? 0.14 : 0.93
      metals.emissiveIntensity = day ? 0.1 : 0.4
    },
  }
}
