import { generator } from './mesh.js'
import * as T from 'three'

const tau = Math.PI * 2
const level = 26.55

// A seamless limestone grain. The broad seams are mineral deposits; the tiny
// pores darken the wet shelves where the individual cut blocks meet the water.
export function mineralSurface() {
  const random = generator(66391),
    size = 192
  const frequencies = [3, 7, 19, 53],
    fields = frequencies.map((n) => Array.from({ length: n * n }, random))
  const color = new Uint8Array(size * size * 4),
    normal = new Uint8Array(size * size * 4),
    relief = new Float32Array(size * size)
  const smooth = (t) => t * t * (3 - 2 * t),
    mix = (a, c, t) => a + (c - a) * t
  function noise(layer, u, v) {
    const n = frequencies[layer],
      a = u * n,
      c = v * n,
      i = Math.floor(a),
      j = Math.floor(c),
      f = fields[layer]
    const get = (x, y) => f[(((x % n) + n) % n) + n * (((y % n) + n) % n)]
    return mix(
      mix(get(i, j), get(i + 1, j), smooth(a - i)),
      mix(get(i, j + 1), get(i + 1, j + 1), smooth(a - i)),
      smooth(c - j)
    )
  }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = x + y * size,
        u = x / size,
        v = y / size
      const large = noise(0, u, v),
        move = noise(1, u, v),
        grit = noise(2, u + 0.08 * large, v),
        fine = noise(3, u, v)
      const line = Math.exp(-Math.abs(0.52 - (0.51 * large + 0.33 * move + 0.16 * grit)) * 165)
      const fleck = random(),
        base =
          209 + 13 * (large - 0.45) + 13 * (grit - 0.48) + 9 * (fine - 0.5) + 12 * (fleck - 0.5) + 9 * line
      color.set([base + 1.5 + 3 * move, base + 2.5 + 3.8 * large, base - 0.9 + 3 * grit, 255], i * 4)
      relief[i] = 0.22 * move + 0.56 * grit + 0.17 * fine + 0.03 * fleck - 0.025 * line
    }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = x + y * size,
        dx = relief[((x + 1) % size) + y * size] - relief[((x + size - 1) % size) + y * size]
      const dy = relief[x + ((y + 1) % size) * size] - relief[x + ((y + size - 1) % size) * size]
      normal.set([128 - 138 * dx, 128 - 138 * dy, 252, 255], i * 4)
    }
  function texture(out, srgb) {
    const t = new T.DataTexture(out, size, size)
    t.wrapS = t.wrapT = T.RepeatWrapping
    t.repeat.set(0.35, 0.35)
    t.generateMipmaps = true
    t.minFilter = T.LinearMipmapLinearFilter
    t.magFilter = T.LinearFilter
    t.anisotropy = 6
    if (srgb) t.colorSpace = T.SRGBColorSpace
    t.needsUpdate = true
    return t
  }
  return [texture(color, true), texture(normal, false)]
}

// The face of each limestone shoulder steps in along the old bedding planes.
// Neighbouring slabs share a root and separate into narrow teeth at the summit.
function crag(b, m, random, x, z, rx, rz, h, lean) {
  const sides = 8
  const radii = Array.from({ length: sides }, () => 0.76 + random() * 0.33)
  const angles = radii.map((_, i) => (tau * (i + 0.28 * random())) / sides)
  const strata = [
    [0, 1.0],
    [0.18, 1.035],
    [0.22, 0.87],
    [0.57, 0.82],
    [0.61, 0.65],
    [0.87, 0.51],
    [1, 0.29],
  ]
  const rings = strata.map(([v, r], k) =>
    angles.map((a, j) => {
      const twist = 0.13 * v + 0.03 * (j % 3),
        scar = k % 2 ? 0.94 : 1.02
      return [
        x + lean * v + rx * Math.cos(a + twist) * r * radii[j] * scar,
        1.23 + h * v + (v === 0 ? 0 : h * 0.049 * Math.sin(a * 2.0 + v * 0.37)),
        z + rz * (Math.sin(a + twist) * r * radii[j] - 0.15 * v),
      ]
    })
  )
  for (let k = 1; k < rings.length; k++)
    for (let j = 0; j < sides; j++) {
      const nn = (j + 1) % sides,
        color = 0.69 + 0.18 * random() + (0.1 * k) / strata.length
      const mat = k === 2 || k === 4 ? m.headWet : (k + j) % 4 === 0 ? m.headBasalt : m.headAshlar
      const p = rings[k - 1][j],
        q = rings[k - 1][nn],
        r = rings[k][nn],
        s = rings[k][j]
      b.face(mat, [p, s, r], [color * 0.84, color * 0.96, color])
      b.face(mat, [p, r, q], [color * 0.89, color * 0.96, color * 0.97])
      if (k === 4 && j % 3 === 1) {
        const crest = rings[k][nn],
          left = rings[k][j]
        b.face(
          m.moss,
          [
            [left[0], left[1] + 0.016, left[2]],
            [crest[0], crest[1] + 0.022, crest[2]],
            [x + lean * 0.57, 1.23 + h * 0.604, z],
          ],
          0.66
        )
      }
    }
  b.face(m.moss, rings.at(-1).slice().reverse(), 0.7)
}
export function shoulders(b, m) {
  const random = generator(49355)
  for (const [x, z, w, d, h, lean] of [
    [-43, -71.68, 4.4, 1.35, 15.8, 1.8],
    [-37, -71.72, 5.5, 1.46, 22.6, -0.91],
    [-31.2, -71.98, 4.0, 1.82, 12.7, -1.8],
    [-26.8, -71.83, 2.8, 1.72, 17.6, 1.05],
    [-19.7, -72.02, 4.5, 1.73, 13.8, 1.54],
    [-13.3, -72.13, 3.0, 2.42, 17.45, -0.83],
    [20.7, -72.33, 3.7, 2.2, 19.1, 1.1],
    [26.8, -71.74, 5, 1.59, 13.1, -1.9],
    [31.5, -71.59, 4.1, 1.79, 22.8, 1.21],
    [36.5, -71.81, 4.2, 1.64, 16.45, -1.3],
    [44.2, -71.94, 4.2, 1.56, 14.85, 1.8],
    [49.7, -71.76, 3.92, 1.69, 18.56, -0.91],
    [-45.9, -116.25, 2.84, 5.3, 17.28, -0.47],
    [52.8, -116.7, 3.43, 4.53, 12.48, 0.85],
    [-39.12, -120.25, 4.24, 2.44, 18.15, 1.24],
    [-31.3, -121.04, 4.34, 1.59, 14.1, -0.72],
    [-24.7, -121.1, 4.62, 1.64, 21.2, -1.1],
    [-13.8, -121.4, 5.4, 1.64, 14.26, 0.89],
    [-2.1, -121.23, 4.44, 1.71, 18.86, -1.4],
    [7.2, -121.25, 4.28, 1.83, 22.2, 0.81],
    [16.75, -121.2, 5.22, 1.7, 12.93, -1.6],
    [29.6, -121.4, 5.11, 1.91, 16.75, 1.12],
    [39.4, -121.17, 4.3, 1.72, 21.37, -1.06],
    [47.9, -120.65, 3.59, 1.83, 14.07, 0.75],
  ])
    crag(b, m, random, x, z, w, d, h, lean)
}

// An eight-corner pier carries the projecting basin rather than a solid box.
function batter(b, m, z, y1, y2, w1, d1, w2, d2, shade) {
  function outline(w, d, y) {
    const r = Math.min(w, d) * 0.14
    return [
      [-w / 2 + r, d / 2],
      [w / 2 - r, d / 2],
      [w / 2, d / 2 - r],
      [w / 2, -d / 2 + r],
      [w / 2 - r, -d / 2],
      [-w / 2 + r, -d / 2],
      [-w / 2, -d / 2 + r],
      [-w / 2, d / 2 - r],
    ].map(([x, dz]) => [x, y, z + dz])
  }
  const a = outline(w1, d1, y1),
    c = outline(w2, d2, y2)
  for (let i = 0; i < a.length; i++) b.face(m, [a[i], a[(i + 1) % 8], c[(i + 1) % 8], c[i]], shade)
  b.face(m, c, shade)
}
function seal(b, m, x, y, z, r) {
  const n = 24,
    disc = (a, rad, dep) => [x + Math.cos(a) * rad, y + Math.sin(a) * rad, z + dep]
  b.face(
    m.patina,
    Array.from({ length: n }, (_, i) => disc((tau * i) / n, r, 0)),
    0.77
  )
  for (let i = 0; i < n; i++) {
    const a = (tau * i) / n,
      c = (tau * (i + 1)) / n
    b.face(
      m.bronze,
      [disc(a, r, 0.017), disc(c, r, 0.017), disc(c, 0.87 * r, 0.024), disc(a, 0.87 * r, 0.024)],
      0.87
    )
  }
  // Three engraved running waves; the outer curves point back into the channel.
  for (let line = 0; line < 3; line++)
    for (let i = 0; i < 8; i++) {
      const point = (k, offset) => {
        const u = k / 8
        return [
          x + (u - 0.5) * r * 1.41,
          y + r * ((line - 1) * 0.295 + 0.142 * Math.sin(u * tau * 1.14 + line * 0.61)) + offset,
          z + 0.037,
        ]
      }
      b.face(
        m.pearl,
        [point(i, -r * 0.029), point(i + 1, -r * 0.029), point(i + 1, r * 0.029), point(i, r * 0.029)],
        0.93
      )
    }
}
function pierLight(b, m, world, x, y, z, tint) {
  b.box(m.headLime, x, y - 0.57, z - 0.2, 0.85, 0.25, 0.95)
  b.tube(m.patina, [x, y - 0.47, z], [x, y - 0.36, z], 0.39, 0.3, 8)
  b.tube(m.lantern, [x, y - 0.36, z], [x, y + 0.36, z], 0.244, 0.245, 8, [0.94, 0.87, 0.73], false)
  for (const s of [-1, 1]) b.box(m.patina, x + s * 0.235, y, z, 0.036, 0.77, 0.039)
  b.tube(m.patina, [x, y + 0.36, z], [x, y + 0.58, z], 0.36, 0.11, 8)
  world.lamp(...b.point([x, y, z + 0.09]), tint, 22.3, 9.0)
}
function basinPier(b, m, world, x, z, side) {
  b.at(x, 0, z, 0, () => {
    batter(b, m.headBasalt, 0, 1.24, 2.24, 3.3, 3.8, 3.1, 3.58, 0.89)
    batter(b, m.headWet, -0.08, 2.24, 7.08, 3.14, 3.6, 2.46, 2.95, 0.89)
    batter(b, m.coping, -0.12, 7.08, 7.42, 2.71, 3.15, 2.75, 3.18, 0.87)
    batter(b, m.headWet, -0.22, 7.42, 15.15, 2.58, 2.96, 2.03, 2.57, 0.93)
    batter(b, m.patina, -0.22, 15.15, 15.42, 2.29, 2.78, 2.46, 2.91, 0.9)
    batter(b, m.headLime, -0.3, 15.42, 15.96, 2.55, 3.14, 2.69, 3.28, 0.91)
    batter(b, m.headWet, -0.45, 15.96, 23.84, 2.05, 2.53, 1.77, 2.16, 0.9)
    batter(b, m.coping, -0.28, 23.84, 24.53, 2.29, 2.82, 2.65, 3.93, 0.91)
    for (const d of [-1, 1])
      b.beam(m.headLime, [d * 0.78, 22.68, 0.46], [d * 0.92, 25.86, 3.29], 0.33, 0.48, 0.89)
    b.box(m.headWet, 0, 25.81, 1.19, 2.38, 0.54, 4.66, 0.83)
    b.box(m.patina, 0, 25.46, 1.77, 1.96, 0.16, 3.59, 0.77)
    for (const y of [2.39, 7.25, 15.3, 24.32])
      b.box(
        m.bronze,
        0,
        y,
        y < 3 ? 1.73 : y < 8 ? 1.49 : y < 20 ? 1.27 : 1.7,
        y < 3 ? 2.55 : 1.98,
        0.067,
        0.081,
        0.82
      )
    seal(b, m, 0, 11.8, 1.15, 0.77)
    for (const [y, zz] of [
      [5.74, 1.64],
      [20.85, 0.83],
    ])
      pierLight(b, m, world, 0, y, zz, side < 0 ? 0xff9a5b : 0xffbb76)
    // Copper drops keep the crown moulding clear of falling water.
    for (const d of [-1, 1]) {
      b.tube(m.patina, [d * 0.84, 25.5, 2.76], [d * 0.84, 24.48, 2.76], 0.048, 0.048, 5, 0.88, false)
      b.tube(m.bronze, [d * 0.84, 24.49, 2.76], [d * 0.84, 24.19, 2.76], 0.06, 0.13, 7)
    }
  })
}
function wheel(b, m, x, y, z, r) {
  const n = 20,
    at = (a, r, d) => [x + r * Math.cos(a), y + r * Math.sin(a), z + d]
  for (let i = 0; i < n; i++) {
    const a = (tau * i) / n,
      c = (tau * (i + 1)) / n
    b.face(m.bronze, [at(a, r, 0), at(c, r, 0), at(c, r - 0.077, 0.005), at(a, r - 0.077, 0.005)], 0.87)
    b.face(m.patina, [at(a, r, -0.075), at(c, r, -0.075), at(c, r, 0), at(a, r, 0)], 0.91)
  }
  for (let i = 0; i < 4; i++) {
    const a = ((i + 0.33) * Math.PI) / 4
    b.beam(m.patina, at(a, r - 0.046, 0), at(a + Math.PI, r - 0.046, 0), 0.068, 0.07, 0.86)
  }
  b.tube(m.headBasalt, [x, y, z - 0.59], [x, y, z + 0.1], 0.135, 0.164, 8)
  b.box(m.bronze, x, y, z + 0.132, 0.16, 0.16, 0.077, 0.92)
}
export function waterworks(b, m, world) {
  basinPier(b, m, world, -9.23, -70.65, -1)
  basinPier(b, m, world, 16.42, -70.68, 1)
  // Removable grate frames and counterweighted spindles between the three valves.
  for (const [x, w, side] of [
    [-7.1, 0.62, 1],
    [-0.8, 0.87, -1],
    [7.22, 0.78, 1],
    [13.96, 0.65, -1],
  ]) {
    const y = 22.6,
      z = -73.04
    b.box(m.headLime, x, y, z - 0.22, w + 0.47, 1.81, 0.65, 0.83)
    b.beam(m.patina, [x, y + 0.07, z], [x, y + 0.64, z + 0.55], 0.31, 0.36, 0.9)
    b.box(m.patina, x, y + 0.49, z + 0.2, w + 0.49, 0.16, 0.89, 0.9)
    wheel(b, m, x, y + 0.49, z + 0.68, w * 0.72)
    b.tube(
      m.rope,
      [x + side * w * 0.63, y + 0.38, z + 0.58],
      [x + side * w * 0.63, 20.6, z + 0.58],
      0.038,
      0.038,
      5,
      0.83,
      false
    )
    b.tube(
      m.patina,
      [x + side * w * 0.63, 20.04, z + 0.58],
      [x + side * w * 0.63, 20.61, z + 0.58],
      0.172,
      0.132,
      7,
      0.87
    )
  }
  for (const [x, y, front] of [
    [-1.66, 16.03, -70.28],
    [6.83, 16.03, -70.28],
    [-1.69, 8.73, -67.98],
    [9.27, 8.73, -67.98],
  ]) {
    const width = 0.73
    b.face(
      m.headWet,
      [
        [x - width, y - 0.41, front - 0.63],
        [x + width, y - 0.41, front - 0.63],
        [x + 0.3, y - 1.98, front - 1.4],
        [x - 0.3, y - 1.98, front - 1.4],
      ],
      0.87
    )
    for (const side of [-1, 1])
      b.beam(
        m.bronze,
        [x + side * 0.48, y - 0.35, front - 0.03],
        [x + side * 0.25, y - 2.15, front - 1.23],
        0.087,
        0.097,
        0.85
      )
  }
}

export function stoneSpine(b, m, world, x, z, angle, scale) {
  b.at(x, 0, z, angle, () =>
    b.scaleBy(scale, () => {
      batter(b, m.headWet, 0, 1.3, 11.86, 3.42, 2.43, 2.46, 1.55, 0.85)
      batter(b, m.headLime, -0.07, 11.86, 12.27, 2.75, 1.75, 2.82, 1.91, 0.91)
      batter(b, m.headBasalt, -0.17, 12.27, 21.89, 2.35, 1.49, 1.68, 1.2, 0.91)
      batter(b, m.coping, -0.1, 21.89, 22.41, 1.96, 1.68, 2.35, 1.86, 0.89)
      for (const d of [-1, 1])
        b.beam(m.coping, [d * 0.69, 21.38, 0.15], [d * 0.75, 24.17, 0.91], 0.22, 0.26, 0.87)
      b.box(m.headLime, 0, 24.19, 0.19, 2.78, 0.26, 1.85, 0.91)
      seal(b, m, 0, 17.01, 0.57, 0.58)
      pierLight(b, m, world, 0, 9.52, 1.13, 0xffba80)
    })
  )
}
export function patternedRail(b, m, a, c) {
  const n = Math.max(1, Math.round(Math.hypot(c[0] - a[0], c[1] - a[1]) / 2.74))
  const dx = (c[0] - a[0]) / n,
    dz = (c[1] - a[1]) / n,
    ang = Math.atan2(-dz, dx),
    w = Math.hypot(dx, dz)
  b.at(a[0], level, a[1], ang, () => {
    b.box(m.headLime, (w * n) / 2, 0.92, 0, w * n, 0.114, 0.166, 0.93)
    b.box(m.headBasalt, (w * n) / 2, 0.18, 0, w * n, 0.13, 0.196, 0.84)
    for (let i = 0; i <= n; i++) {
      b.box(m.stone, w * i, 0.51, 0, 0.166, 1.02, 0.194, 0.93)
      if (i === n) break
      const start = w * (i + 0.15),
        end = w * (i + 0.85),
        cx = (start + end) / 2
      for (const line of [-1, 1]) {
        const py = 0.52,
          yy = py + line * 0.24
        b.face(
          m.patina,
          [
            [start, py - 0.026, 0.014],
            [cx, yy - 0.026, 0.014],
            [cx, yy + 0.026, 0.014],
            [start, py + 0.026, 0.014],
          ],
          0.91
        )
        b.face(
          m.patina,
          [
            [cx, yy - 0.026, 0.014],
            [end, py - 0.026, 0.014],
            [end, py + 0.026, 0.014],
            [cx, yy + 0.026, 0.014],
          ],
          0.91
        )
      }
      b.box(m.bronze, cx, 0.52, 0, 0.072, 0.09, 0.09, 0.85)
    }
  })
}
