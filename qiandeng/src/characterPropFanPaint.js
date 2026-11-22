import * as T from 'three'

let paper

// Two impressions on a single sheet. The horizontal coordinate follows the
// spread of the pleats and the vertical coordinate follows a bamboo slip.
export function fanPainting() {
  if (paper) return paper
  const width = 512,
    half = 256,
    pixels = new Uint8Array(width * half * 2 * 4)
  let salt = 982451653
  const noise = () => ((salt = (Math.imul(salt, 1664525) + 1013904223) | 0) >>> 0) / 4294967296
  for (let y = 0; y < half * 2; y++) {
    const v = (y % half) / half,
      back = y >= half
    for (let x = 0; x < width; x++) {
      const k = (y * width + x) * 4,
        u = x / width
      const fibre =
        (noise() - 0.5) * 6 +
        1.2 * Math.cos(x * 0.076 + Math.sin(y * 0.093) * 0.7) +
        0.9 * Math.sin(y * 1.61 + x * 0.004) +
        2 * Math.cos(u * 9 - v * 3.2)
      const fox = 3.6 * Math.pow(Math.abs(v * 2 - 1), 6)
      pixels[k] = (back ? 222 : 231) + fibre - fox
      pixels[k + 1] = (back ? 221 : 225) + fibre - fox
      pixels[k + 2] = (back ? 196 : 199) + fibre - fox
      pixels[k + 3] = 255
    }
  }
  let offset = 0
  function blend(x, y, color, alpha) {
    const k = ((y + offset) * width + x) * 4
    for (let c = 0; c < 3; c++) pixels[k + c] += (color[c] - pixels[k + c]) * alpha
  }
  function wash(points, color, opacity = 1) {
    const ymin = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1])))),
      ymax = Math.min(half - 1, Math.ceil(Math.max(...points.map((p) => p[1]))))
    for (let y = ymin; y <= ymax; y++) {
      const hits = [],
        sample = y + 0.5
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[j],
          b = points[i]
        if (a[1] > sample !== b[1] > sample)
          hits.push(a[0] + ((sample - a[1]) * (b[0] - a[0])) / (b[1] - a[1]))
      }
      hits.sort((a, b) => a - b)
      for (let i = 0; i + 1 < hits.length; i += 2) {
        const l = hits[i],
          r = hits[i + 1]
        for (let x = Math.max(0, Math.floor(l)); x < Math.min(width, Math.ceil(r)); x++) {
          const coverage = Math.min(x + 1, r) - Math.max(x, l)
          if (coverage > 0) blend(x, y, color, opacity * coverage)
        }
      }
    }
  }
  // A calligraphic stroke keeps its changing width across each paper crease.
  function brush(a, b, c, weight, color, opacity = 1, leaf = false) {
    const left = [],
      right = []
    for (let j = 0; j <= 16; j++) {
      const t = j / 16,
        e = 1 - t,
        x = e * e * a[0] + 2 * t * e * b[0] + t * t * c[0],
        y = e * e * a[1] + 2 * t * e * b[1] + t * t * c[1],
        dx = e * (b[0] - a[0]) + t * (c[0] - b[0]),
        dy = e * (b[1] - a[1]) + t * (c[1] - b[1]),
        len = Math.hypot(dx, dy) || 1
      const r = weight * (leaf ? Math.sin(Math.PI * Math.pow(t, 0.74)) ** 0.79 : 0.42 + 0.58 * e)
      left.push([x - (r * dy) / len, y + (r * dx) / len])
      right.push([x + (r * dy) / len, y - (r * dx) / len])
    }
    wash(left.concat(right.reverse()), color, opacity)
  }
  const black = [32, 62, 56],
    deep = [41, 76, 65],
    dark = [50, 91, 76],
    middle = [75, 114, 94],
    light = [120, 149, 126],
    ochre = [158, 126, 72],
    seal = [158, 58, 48]
  function culm(nodes, weight, ink, opacity) {
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1],
        c = nodes[i],
        b = [(a[0] + c[0]) / 2 + 0.8, (a[1] + c[1]) / 2 - 0.15],
        k = weight * (1 - (0.69 * (i - 1)) / (nodes.length - 1))
      brush(a, b, c, k, ink, opacity)
      if (i < nodes.length - 1) {
        brush(
          [c[0] - k * 1.28, c[1] + k * 0.28],
          c,
          [c[0] + k * 1.14, c[1] - k * 0.52],
          k * 0.42,
          black,
          opacity,
        )
        brush(
          [c[0] - k * 0.7, c[1] + k * 0.7],
          [c[0], c[1] + k * 0.64],
          [c[0] + k * 0.66, c[1] + k * 0.15],
          k * 0.15,
          [186, 182, 136],
          opacity,
        )
      }
    }
  }
  function spray(a, b, c, leaves, size, ink, opacity) {
    brush(a, b, c, size * 0.46, ink, opacity)
    for (let i = 0; i < leaves.length; i++) {
      const [t, dx, dy, w] = leaves[i],
        e = 1 - t,
        x = e * e * a[0] + 2 * t * e * b[0] + t * t * c[0],
        y = e * e * a[1] + 2 * t * e * b[1] + t * t * c[1],
        bend = dy < 0 ? -1 : 1
      brush(
        [x, y],
        [x + dx * 0.53 - dy * 0.15 * bend, y + dy * 0.51 + dx * 0.15 * bend],
        [x + dx, y + dy],
        w * size,
        ink,
        opacity,
        true,
      )
    }
  }
  // Misted culms behind the foreground branch. Leaves gather at real joints
  // and bend down from them, leaving a clear expanse of silk beside the seal.
  culm(
    [
      [-13, -18],
      [17, 43],
      [41, 99],
      [61, 151],
      [82, 210],
      [95, 268],
    ],
    3.4,
    light,
    0.7,
  )
  const wisps = [
    [0.23, -21, 25, 1.4],
    [0.37, 11, 40, 1.6],
    [0.56, -25, 19, 1.2],
    [0.72, 23, 22, 1.5],
    [0.93, 13, 37, 1.3],
  ]
  spray([39, 98], [72, 139], [101, 161], wisps, 1.9, light, 0.72)
  spray([61, 151], [39, 185], [28, 223], wisps, 1.6, light, 0.77)
  culm(
    [
      [4, -18],
      [51, 16],
      [97, 51],
      [143, 88],
      [188, 129],
      [227, 169],
      [262, 217],
      [283, 262],
    ],
    5.5,
    deep,
    0.94,
  )
  culm(
    [
      [13, -17],
      [30, 39],
      [54, 93],
      [62, 151],
      [81, 202],
      [81, 259],
    ],
    3.6,
    middle,
    0.92,
  )
  const twigs = [
    [
      [52, 18],
      [82, 22],
      [114, 16],
      [
        [0.34, 28, -28, 1.6],
        [0.58, 30, -12, 1.8],
        [0.78, 31, 7, 1.3],
        [0.95, 32, -6, 1.4],
      ],
      2.6,
      dark,
    ],
    [
      [96, 51],
      [135, 61],
      [180, 52],
      [
        [0.29, 22, -38, 1.9],
        [0.48, 33, 21, 1.5],
        [0.67, 44, -24, 1.6],
        [0.78, 24, -34, 1.55],
        [0.91, 38, 2, 1.3],
      ],
      2.7,
      deep,
    ],
    [
      [141, 88],
      [149, 115],
      [147, 149],
      [
        [0.23, -34, 26, 1.65],
        [0.43, 12, 38, 1.7],
        [0.68, -17, 40, 1.6],
        [0.86, 14, 42, 1.3],
      ],
      2.35,
      dark,
    ],
    [
      [186, 128],
      [223, 133],
      [268, 125],
      [
        [0.2, 17, -36, 2.1],
        [0.39, 34, 21, 1.7],
        [0.54, 32, -35, 2.0],
        [0.66, 30, -19, 1.65],
        [0.79, 42, 4, 1.75],
        [0.92, 37, -19, 1.5],
      ],
      2.55,
      black,
    ],
    [
      [224, 169],
      [245, 180],
      [281, 176],
      [
        [0.23, 14, 32, 1.5],
        [0.39, 23, -27, 1.6],
        [0.68, 37, 7, 1.55],
        [0.86, 43, -12, 1.6],
      ],
      2.3,
      dark,
    ],
    [
      [261, 216],
      [279, 224],
      [308, 226],
      [
        [0.27, 6, 31, 1.6],
        [0.41, 29, 19, 1.7],
        [0.61, 26, -21, 1.75],
        [0.9, 40, 3, 1.45],
      ],
      2.2,
      deep,
    ],
    [
      [54, 93],
      [37, 119],
      [23, 131],
      [
        [0.2, -36, 7, 1.9],
        [0.43, -23, 26, 1.8],
        [0.59, 7, 35, 1.4],
        [0.88, -16, 28, 1.6],
      ],
      2.25,
      dark,
    ],
    [
      [62, 151],
      [94, 170],
      [113, 199],
      [
        [0.15, 35, -9, 1.6],
        [0.37, 28, 4, 1.5],
        [0.6, -5, 33, 1.4],
        [0.87, 25, 18, 1.45],
      ],
      2,
      middle,
    ],
    [
      [81, 201],
      [63, 217],
      [48, 235],
      [
        [0.22, -31, 0, 1.65],
        [0.43, -25, 17, 1.6],
        [0.66, 0, 31, 1.5],
        [0.89, -17, 26, 1.47],
      ],
      2,
      dark,
    ],
  ]
  for (const [a, b, c, leaves, size, ink] of twigs) spray(a, b, c, leaves, size, ink, 0.97)

  function line(x, y, xx, yy, w, ink, alpha = 1) {
    brush([x, y], [(x + xx) / 2, (y + yy) / 2], [xx, yy], w, ink, alpha)
  }
  function stamp(x, y) {
    const vermilion = [x, y, x + 20, y + 22]
    const [l, d, r, u] = vermilion
    wash(
      [
        [l, d + 1],
        [r, d],
        [r - 1, u],
        [l + 1, u - 1],
      ],
      seal,
      0.91,
    )
    const goldPaper = [223, 205, 171]
    // A pair of seal-script bamboo radicals, in reserve on the red impression.
    for (const k of [0, 8]) {
      line(l + 3 + k, d + 15, l + 5 + k, d + 19, 0.8, goldPaper)
      line(l + 4 + k, d + 15, l + 8 + k, d + 15, 0.83, goldPaper)
      line(l + 5 + k, d + 15, l + 5 + k, d + 4, 0.87, goldPaper)
      line(l + 8 + k, d + 14, l + 9 + k, d + 8, 0.66, goldPaper)
    }
  }
  stamp(416, 72)
  // Two characters of the colophon, 竹影. The left margin carries only the
  // signature thread and a red studio chop, leaving most of the ground bare.
  const x = 434,
    y = 136,
    call = [53, 70, 60]
  const glyphs = [
    [-9, 19, -13, 9],
    [-10, 13, -3, 13],
    [-7, 13, -7, 1],
    [2, 20, -1, 10],
    [2, 14, 11, 14],
    [6, 14, 6, 1],
    [-10, -3, 0, -3],
    [-10, -4, -10, -12],
    [0, -4, 0, -12],
    [-10, -8, 0, -8],
    [-10, -12, 0, -12],
    [-6, -14, -4, -17],
    [-12, -17, 1, -17],
    [-9, -19, -9, -23],
    [-9, -19, -1, -19],
    [-1, -19, -1, -23],
    [-9, -23, -1, -23],
    [-5, -23, -5, -30],
    [-8, -25, -12, -29],
    [0, -25, 2, -28],
    [11, -4, 4, -10],
    [11, -12, 4, -18],
    [13, -20, 3, -30],
  ]
  for (const [a, b, c, d] of glyphs) line(x + a, y + b, x + c, y + d, 1.38, call, 0.94)
  function edgeBands() {
    for (const [v, w, a] of [
      [7, 0.6, 0.67],
      [10, 0.29, 0.55],
      [242, 0.48, 0.66],
      [247, 1, 0.79],
    ])
      wash(
        [
          [0, v - w],
          [width, v - w],
          [width, v + w],
          [0, v + w],
        ],
        ochre,
        a,
      )
  }
  edgeBands()

  offset = half
  // On the reverse, water and unpainted mist part three overlapping ridges.
  // Different peaks and a boatman's skiff give a reader walking round the fan
  // a second painting, with the darker wood ribs exposed below the paper.
  function ridge(nodes, color, opacity) {
    const points = []
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1],
        b = nodes[i],
        n = Math.max(1, Math.ceil((b[0] - a[0]) / 3))
      for (let j = 0; j < n; j++) {
        const t = j / n
        points.push([
          a[0] + (b[0] - a[0]) * t,
          a[1] * (1 - t) + b[1] * t + Math.sin(i * 2.3 + t * 9) * Math.sin(Math.PI * t) * 2.1,
        ])
      }
    }
    points.push(nodes.at(-1))
    wash(
      points.concat([
        [nodes.at(-1)[0], 32],
        [nodes[0][0], 32],
      ]),
      color,
      opacity,
    )
  }
  ridge(
    [
      [-3, 84],
      [21, 93],
      [47, 136],
      [59, 141],
      [77, 121],
      [98, 148],
      [124, 174],
      [139, 165],
      [154, 185],
      [177, 151],
      [199, 132],
      [215, 138],
      [236, 115],
      [265, 97],
      [293, 105],
      [318, 143],
      [341, 163],
      [362, 132],
      [384, 151],
      [403, 119],
      [432, 111],
      [455, 88],
      [482, 98],
      [514, 88],
    ],
    [122, 148, 139],
    0.52,
  )
  ridge(
    [
      [-3, 103],
      [18, 108],
      [53, 78],
      [86, 82],
      [119, 109],
      [141, 98],
      [171, 122],
      [190, 158],
      [209, 142],
      [235, 98],
      [263, 108],
      [287, 87],
      [315, 93],
      [339, 73],
      [362, 87],
      [385, 85],
      [410, 109],
      [427, 105],
      [455, 70],
      [488, 62],
      [514, 76],
    ],
    [87, 127, 119],
    0.64,
  )
  ridge(
    [
      [-3, 72],
      [25, 76],
      [45, 60],
      [59, 66],
      [88, 54],
      [125, 57],
      [159, 44],
      [188, 54],
      [219, 45],
      [249, 59],
      [276, 61],
      [289, 72],
      [315, 76],
      [334, 91],
      [349, 116],
      [360, 107],
      [377, 117],
      [397, 88],
      [420, 76],
      [439, 83],
      [458, 97],
      [483, 82],
      [514, 88],
    ],
    [67, 99, 89],
    0.73,
  )
  for (let i = 0; i < 27; i++) {
    const u = 18 + noise() * 466,
      v = 24 + noise() * 25,
      w = 3 + noise() * 30
    line(u, v, u + w, v + 0.22 + noise() * 0.35, 0.6, [82, 114, 102], 0.42)
  }
  brush([221, 37], [233, 30], [248, 38], 2.3, black, 0.88)
  line(234, 36, 232, 47, 1.15, black, 0.93)
  line(229, 46, 238, 46, 0.9, black, 0.94)
  line(234, 44, 242, 34, 0.67, black, 0.8)
  stamp(41, 177)
  edgeBands()
  paper = new T.DataTexture(pixels, width, half * 2, T.RGBAFormat)
  paper.name = '疏竹与远浦 · 双面扇笺'
  paper.colorSpace = T.SRGBColorSpace
  paper.generateMipmaps = true
  paper.minFilter = T.LinearMipmapLinearFilter
  paper.magFilter = T.LinearFilter
  paper.anisotropy = 4
  paper.needsUpdate = true
  return paper
}
