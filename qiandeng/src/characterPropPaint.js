import * as T from 'three'

const maps = new Map()
const schemes = [
  ['#efccab', '#a54d45', '#742f39', '#a66467', '#e8a4a1'],
  ['#dfdbc0', '#607f76', '#314e50', '#826b77', '#d28e96'],
  ['#ecd3a1', '#a47c49', '#694641', '#936668', '#eba5a1'],
  ['#e9cda7', '#64867a', '#573e40', '#824d55', '#d58491'],
]
const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]
// An ink painting in whole-canopy coordinates: branches continue across the
// seams; the paper has radial shade, fine woven fibres and a vermilion seal.
export function umbrellaPainting(variant = 0) {
  const s = variant % schemes.length
  if (maps.has(s)) return maps.get(s)
  const [base, edge, ink, bark, flower] = schemes[s].map(rgb),
    size = 384,
    data = new Uint8Array(size * size * 4)
  let random = 37911 + s * 934
  const rng = () => ((random = (Math.imul(random, 1664525) + 1013904223) | 0) >>> 0) / 4294967296
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (2 * x + 1) / size - 1,
        v = (2 * y + 1) / size - 1,
        r = Math.hypot(u, v),
        a = Math.atan2(v, u)
      const ring = (r > 0.938 && r < 0.973) || (r > 0.867 && r < 0.875) || (r > 0.894 && r < 0.899),
        t = ring ? 0.72 : 0,
        gilt = s === 3 && ((r > 0.925 && r < 0.931) || (r > 0.977 && r < 0.984))
      const rib = 0.034 * Math.pow(0.5 + 0.5 * Math.cos(20 * a), 17) * Math.min(1, 2 * r)
      const fibre = (rng() - 0.5) * 7 + (Math.sin(x * 0.74 + y * 0.9) + Math.cos(y * 2.4 - x * 0.17)) * 1.0
      const k = 4 * (y * size + x)
      for (let c = 0; c < 3; c++)
        data[k + c] = Math.max(
          0,
          Math.min(
            255,
            (gilt ? [167, 130, 74][c] : (1 - t) * base[c] + t * edge[c]) *
              (1 - rib + 0.024 * Math.cos(20 * a) * r) +
              fibre,
          ),
        )
      data[k + 3] = 255
    }
  function dab(x, y, rx, ry, angle, color, opacity = 1) {
    const c = Math.cos(angle),
      sn = Math.sin(angle),
      span = Math.max(rx, ry) + 1
    for (let j = Math.max(0, Math.floor(y - span)); j <= Math.min(size - 1, y + span); j++)
      for (let i = Math.max(0, Math.floor(x - span)); i <= Math.min(size - 1, x + span); i++) {
        const dx = i - x,
          dy = j - y,
          q = Math.hypot((c * dx + sn * dy) / rx, (-sn * dx + c * dy) / ry)
        if (q >= 1) continue
        const a = Math.min(1, (1 - q) * Math.min(rx, ry)) * opacity,
          k = 4 * (j * size + i)
        for (let n = 0; n < 3; n++) data[k + n] = data[k + n] * (1 - a) + color[n] * a
      }
  }
  function brush(a, b, c, width, color, opacity = 1) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]))
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        e = 1 - t
      dab(
        e * e * a[0] + 2 * e * t * b[0] + t * t * c[0],
        e * e * a[1] + 2 * e * t * b[1] + t * t * c[1],
        width * (1 - 0.62 * t) + 0.35,
        width * (1 - 0.62 * t) + 0.35,
        0,
        color,
        opacity,
      )
    }
  }
  function plum(x, y, sz) {
    const rot = rng() * 2,
      open = 0.74 + rng() * 0.23
    for (let k = 0; k < 5; k++) {
      const a = rot + (k * 2 * Math.PI) / 5,
        dx = Math.cos(a),
        dy = Math.sin(a)
      dab(x + dx * sz * 0.52, y + dy * sz * 0.52, sz * 0.51, sz * 0.38, a, bark, 0.77)
      dab(x + dx * sz * 0.55, y + dy * sz * 0.55, sz * 0.44, sz * 0.3, a, flower, 0.92)
      dab(x + dx * sz * 0.39, y + dy * sz * 0.39, sz * 0.19, sz * 0.115, a, [246, 198, 159], open)
    }
    dab(x, y, sz * 0.15, sz * 0.15, 0, ink)
    for (let k = 0; k < 4; k++) {
      const a = k * 1.63
      dab(x + Math.cos(a) * sz * 0.2, y + Math.sin(a) * sz * 0.2, 1.2, 0.9, 0, [241, 204, 119])
    }
  }
  const branches = [
    [[28, 260], [89, 203], [159, 177], 4.9],
    [[80, 218], [107, 176], [128, 132], 2.7],
    [[117, 197], [139, 193], [173, 158], 2.1],
    [[79, 220], [75, 198], [69, 183], 1.7],
    [[100, 188], [87, 165], [93, 149], 1.6],
    [[135, 189], [149, 202], [166, 196], 1.4],
    [[253, 70], [287, 93], [324, 128], 3.0],
    [[281, 86], [289, 67], [300, 60], 1.6],
    [[289, 103], [314, 98], [321, 86], 1.2],
  ]
  for (const [a, b, c, w] of branches) {
    brush(a, b, c, w, bark, 0.83)
    brush([a[0] + 1, a[1] - 1], [b[0] + 1, b[1] - 2], c, w * 0.33, ink, 0.87)
    for (let n = 0; n < 4; n++) {
      const t = 0.16 + 0.81 * rng(),
        e = 1 - t
      const x = e * e * a[0] + 2 * e * t * b[0] + t * t * c[0],
        y = e * e * a[1] + 2 * e * t * b[1] + t * t * c[1]
      plum(x + rng() * 8 - 4, y + rng() * 9 - 4, 4 + rng() * 4)
    }
  }
  // Swallows with split tails in a paler unpainted expanse.
  for (const [x, y, k] of [
    [237, 238, 1],
    [268, 249, 0.69],
  ]) {
    brush([x, y], [x - 8 * k, y - 10 * k], [x - 22 * k, y - 8 * k], 2.4 * k, ink)
    brush([x, y], [x + 5 * k, y - 11 * k], [x + 16 * k, y - 16 * k], 2.5 * k, ink)
    dab(x, y, 5 * k, 1.8 * k, -0.28, ink)
    brush([x - 2 * k, y], [x - 5 * k, y + 4 * k], [x - 9 * k, y + 4 * k], k, ink)
    brush([x - 2 * k, y], [x - 3 * k, y + 3 * k], [x - 6 * k, y + 7 * k], k, ink)
  }
  for (const [x, y, w, h] of [
    [268, 279, 7, 2],
    [268, 290, 7, 2],
    [265, 285, 2, 7],
    [271, 285, 2, 7],
    [268, 285, 1.4, 4],
  ])
    dab(x, y, w, h, 0, [149, 53, 48], 0.9)
  const texture = new T.DataTexture(data, size, size, T.RGBAFormat)
  texture.colorSpace = T.SRGBColorSpace
  texture.generateMipmaps = true
  texture.minFilter = T.LinearMipmapLinearFilter
  texture.magFilter = T.LinearFilter
  texture.anisotropy = 4
  texture.needsUpdate = true
  maps.set(s, texture)
  return texture
}
