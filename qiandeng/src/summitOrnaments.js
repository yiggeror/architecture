import { add } from './mesh.js'
import { TAU, lightBox } from './summitCraft.js'

function oval(b, m, c, rx, ry, rz, lean = 0) {
  const n = 9,
    rows = 5
  const point = (lat, a) => {
    const y = ry * Math.sin(lat)
    return [
      c[0] + rx * Math.cos(lat) * Math.cos(a),
      c[1] + y,
      c[2] + rz * Math.cos(lat) * Math.sin(a) + lean * y,
    ]
  }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n,
        k = ((i + 1) * TAU) / n,
        u = -Math.PI / 2 + (Math.PI * j) / rows,
        v = u + Math.PI / rows
      const p = [point(u, a), point(u, k), point(v, k), point(v, a)]
      b.face(m, j === 0 ? [p[0], p[2], p[3]] : j === rows - 1 ? p.slice(0, 3) : p, 1)
    }
}
function crane(b, m, x, y, z, turn, size) {
  b.at(x, y, z, turn, () =>
    b.scaleBy(size, () => {
      // The oil lamp hangs from the hooked beak of each bronze celestial crane.
      b.tube(m.stone, [0, 0, 0], [0, 0.21, 0], 0.78, 0.88, 8)
      b.tube(m.patina, [0, 0.21, 0], [0, 0.33, 0], 0.76, 0.69, 8)
      for (const [xx, zz] of [
        [-0.19, -0.13],
        [0.2, 0.18],
      ]) {
        b.tube(m.summitGold, [xx, 0.31, zz], [xx * 1.1, 0.99, zz - 0.16], 0.047, 0.051, 6, 1, false)
        b.tube(m.bronze, [xx * 1.1, 0.98, zz - 0.16], [xx * 0.65, 1.44, zz - 0.06], 0.055, 0.083, 6, 1, false)
        for (const d of [-0.6, 0, 0.65])
          b.tube(
            m.bronze,
            [xx, 0.36, zz],
            [xx + Math.sin(d) * 0.21, 0.33, zz + Math.cos(d) * 0.24],
            0.033,
            0.009,
            4,
            1,
            false
          )
      }
      oval(b, m.patina, [0, 1.6, -0.14], 0.39, 0.4, 0.72, -0.34)
      const path = [
        [0, 1.7, 0.24],
        [0, 1.98, 0.5],
        [0, 2.26, 0.53],
        [0, 2.54, 0.39],
        [0, 2.79, 0.43],
        [0, 2.89, 0.66],
      ]
      for (let i = 1; i < path.length; i++)
        b.tube(m.patina, path[i - 1], path[i], 0.168 - i * 0.013, 0.151 - i * 0.013, 7, 1, false)
      oval(b, m.bronze, [0, 2.89, 0.71], 0.126, 0.113, 0.21, 0.14)
      oval(b, m.vermilion, [0, 2.97, 0.68], 0.12, 0.064, 0.11)
      b.tube(m.summitGold, [0, 2.89, 0.85], [0, 2.8, 1.31], 0.071, 0.012, 6)
      b.tube(m.bronze, [0, 2.81, 1.25], [0, 2.41, 1.25], 0.014, 0.014, 4, 1, false)
      lightBox(b, m, 0, 2.17, 1.25, 0.19, 0.47)
      for (const side of [-1, 1]) {
        const root = [side * 0.27, 1.78, 0.19]
        for (let j = 0; j < 5; j++) {
          const flare = j / 4,
            mid = [side * (0.41 + 0.12 * flare), 1.71 + 0.19 * flare, -0.21 - 0.09 * j]
          const point = [side * (0.43 + 0.19 * flare), 1.36 + 0.38 * flare, -0.76 - 0.11 * j]
          b.face(
            m.bronze,
            [root, add(mid, [0, 0.07, -0.03]), point, add(mid, [0, -0.035, 0.04])],
            0.91 + flare * 0.15
          )
        }
      }
    })
  )
}
function standard(b, m, x, y, z, h, turn, reverse) {
  b.at(x, y, z, turn, () => {
    b.box(m.coping, 0, 0.2, 0, 0.77, 0.4, 0.77)
    b.tube(m.patina, [0, 0.39, 0], [0, h - 0.2, 0], 0.1, 0.069, 7)
    b.tube(m.summitGold, [0, h - 0.2, 0], [0, h + 0.32, 0], 0.14, 0.011, 6)
    b.tube(m.bronze, [-0.12, h - 0.24, 0], [1.38, h - 0.24, 0], 0.067, 0.05, 6)
    const rows = 10,
      cols = 5
    const p = (u, t) => {
      const length = h * 0.6,
        flare = reverse ? -1 : 1
      return [
        0.12 + u * 1.12 + 0.25 * t * t,
        h - 0.26 - length * t - (t > 0.85 ? 0.17 * Math.cos((u - 0.5) * TAU) : 0),
        flare * (0.24 * Math.sin(Math.PI * 2 * u + 3.4 * t) * Math.sin(t * Math.PI * 0.6) + t * 0.23),
      ]
    }
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const a = i / cols,
          c = (i + 1) / cols,
          u = j / rows,
          v = (j + 1) / rows
        b.face(
          m.redSilk,
          [p(a, u), p(c, u), p(c, v), p(a, v)],
          (reverse ? 0.76 : 1.02) * (0.86 + 0.15 * Math.cos(a * 4))
        )
      }
    for (const u of [0.045, 0.95])
      for (let j = 0; j < rows; j++) {
        const a = j / rows,
          c = (j + 1) / rows
        b.face(
          m.summitGold,
          [p(u, a), p(u + 0.018, a), p(u + 0.018, c), p(u, c)].map((q) => add(q, [0, 0, 0.009]))
        )
      }
    const points = [
      [0.31, 0.25],
      [0.66, 0.34],
      [0.33, 0.46],
      [0.67, 0.51],
      [0.55, 0.7],
    ]
    for (let j = 1; j < points.length; j++)
      b.beam(
        m.summitGold,
        add(p(...points[j - 1]), [0, 0, 0.022]),
        add(p(...points[j]), [0, 0, 0.022]),
        0.027,
        0.026
      )
  })
}
export function palaceStandards(b, m) {
  for (const [x, y, z, az, s] of [
    [-2.82, 3.32, -75.3, -0.54, 1.14],
    [10.9, 3.32, -75.33, 0.49, 1.04],
    [-1.46, 13.52, -94.01, -0.32, 0.82],
    [9.46, 13.52, -94.0, 0.38, 0.87],
  ])
    crane(b, m, x, y, z, az, s)
  for (const [x, y, z, h, turn, rev] of [
    [-4.71, 8.38, -85.52, 4.8, -0.31, false],
    [12.78, 8.38, -85.54, 4.8, 0.27, true],
    [-36.4, 11.42, -90.32, 4.9, -0.76, true],
    [34.8, 8.38, -84.82, 4.5, 0.75, false],
    [-7.6, 13.52, -106.42, 6.04, -1.04, false],
    [15.37, 13.52, -107.02, 6.04, 0.81, true],
  ])
    standard(b, m, x, y, z, h, turn, rev)
}
