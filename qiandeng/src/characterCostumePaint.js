import * as T from 'three'

const side = 256,
  size = 4 * side,
  tau = Math.PI * 2
const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
const blend = (a, b, t) => a.map((v, k) => Math.round(v + (b[k] - v) * t))
const swatches = [
  // Merchant: kingfisher waistcoat, duck-egg inset, skirt face and rolled guard.
  [0x26605a, 0x356f66],
  [0x80aa9d, 0x98b8a5],
  [0x24565a, 0x366b68],
  [0x376960, 0x477767],
  // Musician: enveloping overshirt, lotus-ash skirt, ivory pibo and mauve borders.
  [0xb27f8a, 0xc99aa0],
  [0x936978, 0xb89296],
  [0xe8cdb6, 0xf0d9be],
  [0x955f73, 0xb07d87],
  // Scholar: blue-black hechang, misty bamboo, broken water, card-woven selvedge.
  [0x354e61, 0x496576],
  [0x546e7c, 0x6e8993],
  [0x667e86, 0x849797],
  [0x405867, 0x556d75],
  // Drummer: pomegranate jacket, scale cloth, fish roundel, bronze-key borders.
  [0x9f433d, 0xb75145],
  [0x293c48, 0x374957],
  [0x803c3b, 0x9b4942],
  [0x39464b, 0x534e4c],
]
let material
export function costumeUV(cell, u, v) {
  const edge = 0.008
  return [
    ((cell % 4) + edge + (1 - 2 * edge) * u) / 4,
    (Math.floor(cell / 4) + edge + (1 - 2 * edge) * v) / 4,
  ]
}
function paintAtlas() {
  const data = new Uint8Array(size * size * 4)
  const relief = new Uint8Array(size * size)
  let ox = 0,
    oy = 0,
    pivotY = 0,
    squeeze = 1
  const pixel = (x, y) => ((oy + y) * size + ox + x) * 4
  function select(n) {
    ox = (n % 4) * side
    oy = Math.floor(n / 4) * side
  }
  // A square woven swatch is cut into long gores, wide sleeve pieces or narrow
  // borders. The cartoon of a blossom contracts in warp before it is sewn.
  function laid(y, ratio, draw) {
    const savedY = pivotY,
      savedS = squeeze
    pivotY = y
    squeeze = ratio
    draw()
    pivotY = savedY
    squeeze = savedS
  }
  const warp = (y) => pivotY + (y - pivotY) * squeeze
  function dab(x, y, col, alpha) {
    if (x < 0 || x >= side || y < 0 || y >= side || alpha <= 0) return
    const i = pixel(x, y)
    for (let k = 0; k < 3; k++) data[i + k] = Math.round(data[i + k] + (col[k] - data[i + k]) * alpha)
    relief[i >> 2] = Math.max(relief[i >> 2], Math.round(76 + alpha * 108))
  }
  function stamp(x, y, w, col, opacity = 1) {
    const r = Math.max(0.34, w * 0.5),
      x0 = Math.floor(x - r),
      x1 = Math.ceil(x + r),
      y0 = Math.floor(y - r),
      y1 = Math.ceil(y + r)
    for (let j = y0; j <= y1; j++)
      for (let i = x0; i <= x1; i++) {
        const a = Math.min(1, Math.max(0, r + 0.36 - Math.hypot(i + 0.5 - x, j + 0.5 - y)))
        if (a > 0) dab(i, j, col, a * opacity)
      }
  }
  function pen(x, y, w, col, opacity = 1) {
    stamp(x, warp(y), w, col, opacity)
  }
  function line(pts, color, width = 1, opacity = 1, taper = false) {
    const col = rgb(color)
    if (squeeze !== 1) pts = pts.map(([x, y]) => [x, warp(y)])
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i],
        n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.82)
      for (let k = 0; k <= n; k++) {
        const t = n ? k / n : 0,
          frac = (i - 1 + t) / (pts.length - 1)
        stamp(
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
          width * (taper ? 0.24 + 0.76 * Math.sin(Math.PI * frac) ** 0.42 : 1),
          col,
          opacity
        )
      }
    }
  }
  function fill(pts, color, opacity = 1) {
    if (squeeze !== 1) pts = pts.map(([x, y]) => [x, warp(y)])
    const col = rgb(color),
      start = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])))),
      end = Math.min(side - 1, Math.ceil(Math.max(...pts.map((p) => p[1]))))
    for (let y = start; y <= end; y++) {
      const hits = [],
        h = y + 0.5
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i],
          b = pts[(i + 1) % pts.length]
        if ((a[1] <= h && b[1] > h) || (b[1] <= h && a[1] > h))
          hits.push(a[0] + ((h - a[1]) * (b[0] - a[0])) / (b[1] - a[1]))
      }
      hits.sort((a, b) => a - b)
      for (let j = 0; j + 1 < hits.length; j += 2)
        for (
          let x = Math.max(0, Math.floor(hits[j]));
          x <= Math.min(side - 1, Math.ceil(hits[j + 1]));
          x++
        ) {
          const o = Math.min(x + 1, hits[j + 1]) - Math.max(x, hits[j])
          if (o > 0) dab(x, y, col, opacity * o)
        }
    }
  }
  function bez(a, b, c, d, n = 22) {
    return Array.from({ length: n + 1 }, (_, i) => {
      const f = i / n,
        g = 1 - f
      return [
        g * g * g * a[0] + 3 * g * g * f * b[0] + 3 * g * f * f * c[0] + f * f * f * d[0],
        g * g * g * a[1] + 3 * g * g * f * b[1] + 3 * g * f * f * c[1] + f * f * f * d[1],
      ]
    })
  }
  function ellipse(x, y, rx, ry, angle, color, edge) {
    const a = Math.cos(angle),
      b = Math.sin(angle),
      pts = []
    for (let j = 0; j <= 32; j++) {
      const u = (j * tau) / 32,
        dx = rx * Math.cos(u),
        dy = ry * Math.sin(u)
      pts.push([x + dx * a - dy * b, y + dx * b + dy * a])
    }
    fill(pts, color)
    if (edge) line(pts, edge, 0.76, 0.94)
    return pts
  }
  function leaf(x, y, dx, dy, w, ground, shadow, vein) {
    const l = Math.max(1, Math.hypot(dx, dy)),
      nx = -dy / l,
      ny = dx / l
    const a = [x, y],
      e = [x + dx, y + dy],
      b = [x + 0.2 * dx + nx * w, y + 0.2 * dy + ny * w],
      c = [x + 0.74 * dx + nx * w * 0.69, y + 0.74 * dy + ny * w * 0.69]
    const f = [x + 0.64 * dx - nx * w * 0.48, y + 0.64 * dy - ny * w * 0.48],
      g = [x + 0.25 * dx - nx * w * 0.75, y + 0.25 * dy - ny * w * 0.75]
    const left = bez(a, b, c, e, 19),
      right = bez(e, f, g, a, 19),
      mid = bez(
        a,
        [x + 0.38 * dx + nx * w * 0.12, y + 0.38 * dy + ny * w * 0.12],
        [x + 0.72 * dx, y + 0.72 * dy],
        e,
        19
      )
    fill([...left, ...right], ground)
    fill([...mid, ...right], shadow, 0.76)
    line([...left, ...right], vein, 0.81, 0.83, true)
    line(mid, vein, 0.87, 0.88, true)
    if (w > 4)
      for (const j of [0.3, 0.49, 0.66])
        line(
          bez(
            [x + dx * j, y + dy * j],
            [x + dx * (j + 0.09) + nx * w * 0.28, y + dy * (j + 0.09) + ny * w * 0.28],
            [x + dx * (j + 0.15) + nx * w * 0.5, y + dy * (j + 0.15) + ny * w * 0.5],
            [x + dx * (j + 0.21) + nx * w * 0.53, y + dy * (j + 0.21) + ny * w * 0.53],
            9
          ),
          vein,
          0.52,
          0.63,
          true
        )
  }
  function flower(x, y, s, rotation, palette, petals = 6) {
    for (let layer = 0; layer < 2; layer++) {
      for (let j = 0; j < petals - (layer ? 1 : 0); j++) {
        const a = rotation + (j * tau) / (petals - (layer ? 1 : 0)) + 0.4 * layer,
          l = s * (1 - 0.4 * layer) * (0.86 + 0.14 * Math.cos(j * 2.7)),
          w = l * (layer ? 0.46 : 0.43)
        const nx = Math.cos(a),
          ny = Math.sin(a),
          tx = -ny,
          ty = nx
        const place = (z, t) => [x + nx * z + tx * t, y + ny * z + ty * t]
        const contour = [
          ...bez(
            place(0, 0),
            place(l * 0.22, -w * 0.81),
            place(l * 0.76, -w * 1.2),
            place(l * 0.92, -w * 0.45),
            15
          ),
          ...bez(
            place(l * 0.92, -w * 0.45),
            place(l * 1.04, -w * 0.13),
            place(l * 0.91, w * 0.1),
            place(l * 0.99, w * 0.3),
            9
          ),
          ...bez(
            place(l * 0.99, w * 0.3),
            place(l * 0.94, w * 1.1),
            place(l * 0.3, w * 0.87),
            place(0, 0),
            17
          ),
        ]
        fill(contour, palette[layer ? 1 : j % 3 === 0 ? 2 : 0])
        line(contour, palette[3], 0.85, 0.83, true)
        for (const a of [-0.37, 0, 0.33])
          line(
            bez(
              place(0.12 * l, 0),
              place(0.36 * l, w * (a + 0.12)),
              place(0.65 * l, w * a),
              place(0.85 * l, w * a),
              10
            ),
            palette[2],
            0.7,
            0.75,
            true
          )
      }
    }
    ellipse(x, y, s * 0.13, s * 0.09, rotation, palette[3])
    for (let i = 0; i < 7; i++) {
      const a = (i * tau) / 7 + 0.11
      pen(x + Math.cos(a) * s * 0.15, y + Math.sin(a) * s * 0.14, 2.2, rgb(palette[4]))
    }
  }
  function stroke(a, b, c, d, color, w) {
    const p = bez(a, b, c, d, 36)
    line(p, color, w, 0.96, true)
    return p
  }
  function magnolia(x, y, s, mir = 1) {
    const P = (a, b) => [x + mir * a * s, y + b * s]
    const branch = (x0, y0, x1, y1, x2, y2, x3, y3, w) => {
      stroke(P(x0, y0), P(x1, y1), P(x2, y2), P(x3, y3), 0x7a6951, w * s)
      stroke(P(x0 + 0.5, y0), P(x1 + 1, y1), P(x2 + 1, y2), P(x3, y3), 0xd2b787, 0.73 * s)
    }
    branch(0, 0, 25, 31, 4, 68, 52, 119, 3.1)
    branch(18, 45, 13, 63, -15, 67, -22, 87, 1.9)
    branch(29, 84, 50, 87, 60, 72, 80, 90, 1.5)
    for (const [xx, yy, dx, dy, w] of [
      [12, 31, -24, 11, 6],
      [17, 43, 20, 4, 5],
      [17, 58, -22, 20, 5],
      [30, 81, 17, 23, 5],
      [43, 100, -14, 17, 6],
      [50, 88, 20, -6, 5],
    ]) {
      const b = P(xx, yy)
      leaf(...b, dx * s * mir, dy * s, w * s, 0x89ac96, 0x4d8479, 0xc5b384)
    }
    for (const [xx, yy, r, ang] of [
      [52, 119, 18, 1.3],
      [-22, 86, 14, 2.2],
      [80, 90, 11, 0.38],
      [19, 48, 8, 0.76],
    ]) {
      const p = P(xx, yy)
      flower(...p, r * s, ang, [0xe6d6ab, 0xf8e8ca, 0xcbb99b, 0xa18669, 0xe1bd72], 5)
    }
  }
  function lotus(x, y, s, flip = 1) {
    stroke(
      [x - 37 * s * flip, y - 71 * s],
      [x - 20 * s * flip, y - 52 * s],
      [x + 20 * s * flip, y - 35 * s],
      [x, y],
      0xb8a07a,
      2 * s
    )
    for (const [xx, yy, z, angle] of [
      [x - 29 * s * flip, y - 52 * s, 12, 0.4],
      [x + 12 * s * flip, y - 34 * s, 8, 1.4],
    ]) {
      ellipse(xx, yy, z * s, z * 0.42 * s, angle, 0xa1a78c, 0x787c77)
      line(
        bez([xx - z * s, yy], [xx - 4 * s, yy - 3 * s], [xx + 7 * s, yy + 2 * s], [xx + z * s, yy]),
        0xe1ceaa,
        1
      )
    }
    const pales = [0xddaeb0, 0xf2d5c8, 0xc8909c, 0xa4687c, 0xe6c489]
    for (let j = 0; j < 7; j++) {
      const a = (j - 3) * 0.31,
        dx = Math.sin(a) * 22 * s,
        dy = Math.cos(a) * 22 * s
      leaf(x + Math.sin(a) * 4 * s, y, dx, dy, (j === 3 ? 9 : 7) * s, pales[j % 2], pales[2], pales[3])
    }
    for (let j = -2; j <= 2; j++)
      leaf(x, y - 1 * s, j * 7 * s, (9 - Math.abs(j)) * s, 4 * s, pales[1], pales[0], pales[3])
    ellipse(x, y - 1.4 * s, 7 * s, 2.9 * s, 0, 0xc8b080)
    for (let i = 0; i < 6; i++) pen(x + (i - 2.5) * 2.1 * s, y + 1.4 * s, 1.6, rgb(0xf1db9f))
  }
  function bamboo(x, y, s, flip = 1) {
    const P = (a, b) => [x + flip * a * s, y + b * s]
    for (const [xx, yy, dx, dy, w] of [
      [0, 0, 32, 151, 2.5],
      [15, 65, -28, 29, 1.7],
      [26, 110, 38, 28, 1.6],
      [7, 37, 30, 28, 1.5],
    ]) {
      stroke(
        P(xx, yy),
        P(xx + dx * 0.26, yy + dy * 0.4),
        P(xx + dx * 0.72, yy + dy * 0.68),
        P(xx + dx, yy + dy),
        0x324f5d,
        w * s
      )
      if (w > 2)
        for (const t of [0.22, 0.44, 0.65, 0.86]) {
          const b = P(xx + dx * t, yy + dy * t)
          line(
            [
              [b[0] - 2 * s, b[1]],
              [b[0] + 2 * s, b[1] + 0.3],
            ],
            0xb5bca7,
            1.45
          )
        }
    }
    for (const [xx, yy, dx, dy, w] of [
      [2, 79, -19, 18, 3.9],
      [-5, 85, -18, -6, 3.2],
      [-12, 92, -10, 19, 2.5],
      [29, 111, 17, 23, 4],
      [38, 120, 18, -8, 3.8],
      [42, 124, 10, 24, 3.7],
      [58, 136, 19, 4, 2.8],
      [25, 126, -18, 23, 3.9],
      [34, 148, 8, 20, 2.3],
      [24, 56, 21, -8, 3],
      [20, 54, 12, 22, 3.2],
    ]) {
      const b = P(xx, yy)
      leaf(...b, dx * flip * s, dy * s, w * s, 0x749390, 0x45636b, 0xa8b4a0)
    }
  }
  function cloud(x, y, s, color = 0xd4b27c) {
    const P = (a, b) => [x + a * s, y + b * s],
      pts = [
        ...bez(P(-28, 1), P(-20, -5), P(-8, -5), P(-3, 0), 13),
        ...bez(P(-3, 0), P(-13, 5), P(-8, 13), P(-3, 11), 13),
        ...bez(P(-3, 11), P(-1, 19), P(9, 19), P(9, 11), 13),
        ...bez(P(9, 11), P(18, 17), P(21, 8), P(17, 5), 13),
        ...bez(P(17, 5), P(10, -2), P(2, -1), P(0, 2), 13),
        ...bez(P(0, 2), P(-1, 4), P(4, 7), P(6, 4), 13),
      ]
    line(pts, color, 1.05 * s, 0.94, true)
    stroke(P(0, -3), P(11, -7), P(19, -1), P(32, -3), color, 0.9 * s)
  }
  function carp(x, y, s, flop = 1) {
    const P = (a, b) => [x + a * s * flop, y + b * s],
      body = [
        ...bez(P(-17, -10), P(-9, 15), P(10, 17), P(17, 9)),
        ...bez(P(17, 9), P(19, 4), P(12, -8), P(-17, -10)),
      ]
    fill(body, 0xca8460)
    line(body, 0xe0b778, 1.32 * s)
    for (const sign of [-1, 1]) {
      const pts = [
        ...bez(P(-16, -9), P(-27, -8), P(-36, -5 + sign * 4), P(-30, -14 + sign * 9)),
        ...bez(P(-30, -14 + sign * 9), P(-26, -14), P(-22, -14), P(-16, -9)),
      ]
      fill(pts, 0xa95345)
      line(pts, 0xcda36f, 0.97 * s)
    }
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 4; i++) {
        const xx = -10 + 4 * i + 1.3 * j,
          yy = -4 + 3.3 * j
        stroke(P(xx, yy), P(xx + 1, yy - 2), P(xx + 3, yy - 1), P(xx + 3.7, yy + 0.8), 0xe8c28b, 0.62 * s)
      }
    ellipse(...P(13, 10), 1.1 * s, 1.1 * s, 0, 0x3d4650)
    stroke(P(17, 9), P(23, 14), P(27, 12), P(27, 10), 0xe7c38c, 0.8 * s)
  }
  function waves(height, num, pigment, amp = 6) {
    for (let row = 0; row < num; row++) {
      const h = height + row * 5
      for (let k = -1; k < 6; k++) {
        const x = k * 57 + row * 6
        line(
          bez([x, h], [x + 17, h + amp], [x + 27, h - amp * 1.4], [x + 56, h], 25),
          pigment,
          row % 3 === 0 ? 1.2 : 0.7,
          0.88
        )
      }
    }
  }
  const bronze = 0xc6a478,
    pearl = 0xe4d2b0
  for (let n = 0; n < 16; n++) {
    select(n)
    const [a, b] = swatches[n].map(rgb)
    for (let y = 0; y < side; y++)
      for (let x = 0; x < side; x++) {
        const grad =
          0.28 +
          0.4 * (y / side) +
          0.17 * Math.sin(x * 0.018 + y * 0.007) +
          0.06 * Math.cos(0.052 * y - 0.02 * x)
        const c = blend(a, b, grad),
          r = pixel(x, y),
          thread =
            1.4 * Math.sin(x * 1.56 + ((y >> 1) % 2) * 0.6) +
            1.6 * Math.cos(y * 1.99 + x * 0.09) +
            0.7 * Math.cos(x * 0.67 - y * 0.52)
        for (let k = 0; k < 3; k++) data[r + k] = c[k] + thread
        data[r + 3] = 255
        relief[r >> 2] = 65 + thread * 7
      }
    if (n === 0) {
      laid(11, 0.47, () => magnolia(28, 11, 1.36))
      laid(143, 0.42, () => magnolia(220, 143, 0.85, -1))
      for (const p of [
        [176, 64, 0.65],
        [126, 185, 0.52],
      ])
        cloud(...p, 0x89a597)
    }
    if (n === 1) {
      laid(16, 0.55, () => magnolia(22, 16, 1.02))
      laid(143, 0.46, () => magnolia(215, 143, 0.74, -1))
      waves(8, 3, 0xceb98a, 3)
    }
    if (n === 2) {
      // The main flowering branch sweeps across the flat horse face. Its
      // fine fan of stems is placed above the narrow woven wave guard.
      laid(29, 0.45, () => magnolia(36, 29, 1.55))
      laid(56, 0.36, () => magnolia(229, 56, 1.05, -1))
      laid(138, 0.38, () => magnolia(195, 138, 0.81, -1))
      for (const [x, y] of [
        [26, 165],
        [80, 207],
        [212, 239],
        [138, 121],
      ])
        laid(y, 0.54, () => cloud(x, y, 0.59, 0x7e9882))
      waves(13, 2, 0xb49a72, 4)
      waves(5, 2, pearl, 3)
    }
    if (n === 3) {
      for (const h of [20, 97, 177])
        for (const x of [15, 99, 182, 265]) {
          cloud(x, h, 1, bronze)
          leaf(x + 2, h + 27, 42, 16, 4, 0x83a28b, 0x577d73, bronze)
        }
    }
    if (n === 4) {
      laid(74, 0.44, () => lotus(52, 74, 1.3))
      laid(181, 0.42, () => lotus(172, 181, 0.91, -1))
      for (const [x, y, r] of [
        [142, 47, 16],
        [208, 91, 10],
        [76, 207, 13],
      ])
        laid(y, 0.48, () => flower(x, y, r, 0.35, [0xd7aaa8, 0xf3d4c1, 0xb98591, 0x976c7c, 0xd8b587], 5))
    }
    if (n === 5) {
      laid(38, 0.36, () => lotus(79, 38, 2.08))
      laid(50, 0.32, () => lotus(186, 50, 1.15, -1))
      laid(139, 0.37, () => lotus(119, 139, 0.92, -1))
      waves(8, 2, 0xd5b2a4, 2)
      for (const [x, y] of [
        [38, 155],
        [183, 187],
        [122, 223],
      ])
        laid(y, 0.3, () => ellipse(x, y, 8, 4, 0.75, 0xc39b9d, 0xe0bdb0))
    }
    if (n === 6) {
      for (const y of [19, 99, 179]) {
        lotus(70, y + 24, 0.55)
        lotus(190, y + 45, 0.44, -1)
        stroke([1, y], [70, y + 24], [120, y - 19], [255, y + 12], 0xc09991, 1.6)
      }
    }
    if (n === 7) {
      for (const [x, y] of [
        [16, 79],
        [64, 142],
        [110, 91],
        [154, 153],
        [201, 96],
        [248, 147],
      ]) {
        flower(x, y, 18, 0.46, [0xd9aaa9, 0xf2cebc, 0xba8998, 0x945e78, 0xdfbd8b], 7)
        leaf(x + 13, y + 5, 21, 18, 5, 0xb3af96, 0x9a957e, pearl)
      }
      waves(11, 3, pearl, 4)
      waves(222, 3, 0xd4af9e, 2)
    }
    if (n === 8) {
      bamboo(17, 9, 0.89)
      bamboo(225, 126, 0.57, -1)
      waves(11, 2, 0x9cafaa, 3)
    }
    if (n === 9) {
      laid(15, 0.76, () => bamboo(31, 15, 1.5))
      laid(19, 0.69, () => bamboo(183, 19, 1.03, -1))
      laid(153, 0.65, () => bamboo(205, 153, 0.79, -1))
      for (const y of [12, 23]) waves(y, 2, 0x9aaea7, 4)
    }
    if (n === 10) {
      for (const y of [8, 17, 39]) waves(y, 2, 0xb6c2b2, 4)
      for (const [x, y] of [
        [62, 84],
        [131, 143],
        [199, 201],
        [35, 231],
      ])
        laid(y, 0.48, () => cloud(x, y, 0.62, 0x9bafac))
    }
    if (n === 11) {
      for (const y of [16, 77, 138, 199])
        for (const x of [16, 100, 184]) {
          line(
            [
              [x - 17, y + 9],
              [x, y + 24],
              [x + 20, y + 9],
              [x, y - 6],
              [x - 17, y + 9],
            ],
            0xb1b4a1,
            1.2
          )
          leaf(x - 10, y + 5, 28, 9, 3, 0x87a5a0, 0x628583, 0xc2c4a9)
        }
    }
    if (n === 12) {
      for (const [x, y, z] of [
        [44, 52, 0.81],
        [191, 124, 0.64],
        [92, 209, 0.94],
      ])
        cloud(x, y, z, 0xd9a879)
      waves(11, 2, 0xcf906b, 4)
    }
    if (n === 13) {
      for (let j = -1; j < 17; j++)
        for (let i = -1; i < 13; i++) {
          const x = i * 26 + (j % 2) * 13,
            y = j * 17
          const p = bez([x - 13, y + 9], [x - 11, y - 9], [x + 8, y - 14], [x + 13, y + 9], 19)
          line(p, j % 3 === 0 ? 0x9e896a : 0x7a7d72, 1.12)
          line(bez([x - 9, y + 8], [x - 7, y - 3], [x + 5, y - 5], [x + 8, y + 6]), 0x435b61, 0.83)
        }
    }
    if (n === 14) {
      for (const [x, y, s] of [
        [128, 125, 2.15],
        [31, 32, 0.49],
        [219, 220, 0.55],
      ]) {
        ellipse(x, y, 36 * s, 37 * s, 0.25, 0x91433d, bronze)
        ellipse(x, y, 33 * s, 34 * s, 0.25, 0x693e42, 0xae8d64)
        carp(x, y + 10 * s, 0.78 * s)
        carp(x + 1 * s, y - 10 * s, 0.64 * s, -1)
      }
    }
    if (n === 15) {
      for (const y of [22, 94, 166, 239]) {
        waves(y - 12, 2, bronze, 2)
        for (const x of [22, 90, 158, 226]) cloud(x, y, 0.85, 0xd2a474)
      }
    }
  }
  const tex = new T.DataTexture(data, size, size, T.RGBAFormat)
  tex.name = '千灯四艺 · 玉兰、荷瓣、墨竹与双鱼分裁织样'
  tex.colorSpace = T.SRGBColorSpace
  tex.minFilter = T.LinearMipmapLinearFilter
  tex.magFilter = T.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  // Relief comes from the actual laid stitches and the warp/weft rather than
  // baking specular highlights into the painted flowers. Keep the glTF map
  // linear so changing lights and grazing angles reveal the embroidered areas.
  const edgeSize = size / 2,
    normals = new Uint8Array(edgeSize * edgeSize * 4)
  for (let y = 0; y < edgeSize; y++)
    for (let x = 0; x < edgeSize; x++) {
      const sx = 2 * x,
        sy = 2 * y,
        idx = 4 * (y * edgeSize + x)
      const l = relief[sy * size + Math.max(0, sx - 1)],
        r = relief[sy * size + Math.min(size - 1, sx + 1)]
      const down = relief[Math.max(0, sy - 1) * size + sx],
        up = relief[Math.min(size - 1, sy + 1) * size + sx]
      const nx = (l - r) / 96,
        ny = (down - up) / 96,
        inv = 1 / Math.hypot(nx, ny, 1)
      normals[idx] = Math.round(127.5 * (1 + nx * inv))
      normals[idx + 1] = Math.round(127.5 * (1 + ny * inv))
      normals[idx + 2] = Math.round(127.5 * (1 + inv))
      normals[idx + 3] = 255
    }
  const normal = new T.DataTexture(normals, edgeSize, edgeSize, T.RGBAFormat)
  normal.name = '妆花线迹经纬起伏'
  normal.minFilter = T.LinearMipmapLinearFilter
  normal.magFilter = T.LinearFilter
  normal.generateMipmaps = true
  normal.needsUpdate = true
  return { tex, normal }
}
export function signatureMaterial() {
  if (material) return material
  const { tex, normal } = paintAtlas()
  material = new T.MeshStandardMaterial({
    name: '分裁织锦与绣线',
    map: tex,
    normalMap: normal,
    normalScale: new T.Vector2(0.22, 0.22),
    vertexColors: true,
    roughness: 0.57,
    metalness: 0.028,
    side: T.DoubleSide,
  })
  return material
}
