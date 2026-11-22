import * as T from 'three'
import { generator } from './mesh.js'
const tau = Math.PI * 2
const random = generator(8137)
function pattern(w, h, draw) {
  const bytes = new Uint8Array(w * h * 4)
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const col = draw(i, j),
        k = (j * w + i) * 4
      for (let a = 0; a < 3; a++) bytes[k + a] = Math.min(255, Math.max(0, col[a]))
      bytes[k + 3] = 255
    }
  const tex = new T.DataTexture(bytes, w, h)
  tex.wrapS = tex.wrapT = T.RepeatWrapping
  tex.magFilter = T.LinearFilter
  tex.minFilter = T.LinearMipMapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  tex.colorSpace = T.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
export function materials() {
  const finish = (name, c, r, more = {}) =>
    new T.MeshStandardMaterial({
      name,
      color: c,
      roughness: r,
      vertexColors: true,
      side: T.DoubleSide,
      ...more,
    })
  const m = {}
  const colors = {
    plaster: [0xe9d9bd, 0.91],
    foundation: [0x62666b, 0.76],
    stone: [0x878c8d, 0.49],
    coping: [0xb0aa99, 0.5],
    earth: [0x72745d, 0.91],
    wood: [0x995e3f, 0.55],
    timber: [0x8e4234, 0.46],
    darkwood: [0x4f3231, 0.49],
    roof: [0x3e6666, 0.4],
    roofEdge: [0x688482, 0.42],
    bronze: [0xcba56e, 0.32],
    patina: [0x6c9890, 0.46],
    paper: [0xffe9c2, 0.83],
    lantern: [0xffedb7, 0.67],
    redSilk: [0xcd4d3c, 0.64],
    ceramic: [0xa2c1b0, 0.23],
    pearl: [0xe3d6b5, 0.35],
    ink: [0x343d48, 0.52],
    reed: [0xba9b6d, 0.77],
    rope: [0xad845b, 0.86],
    leaf: [0x638263, 0.77],
    bark: [0x6c5343, 0.87],
    moss: [0x71835d, 0.87],
    tiles: [0x8b8d85, 0.58],
    teal: [0x3c7774, 0.4],
    vermilion: [0xaa483a, 0.39],
    wine: [0x943c42, 0.55],
    gold: [0xe6bd77, 0.37],
  }
  for (const [k, [c, r]] of Object.entries(colors)) m[k] = finish(k, c, r)
  m.bronze.metalness = 0.43
  m.patina.metalness = 0.29
  m.gold.metalness = 0.46
  for (const [name, c, intensity] of [
    ['paper', 0xffa24e, 0.56],
    ['lantern', 0xffb258, 2.75],
    ['redSilk', 0xff5e29, 0.4],
  ]) {
    m[name].emissive.set(c)
    m[name].emissiveIntensity = intensity
    m[name].userData.emitter = true
  }
  const grain = pattern(256, 256, (x, y) => {
    const u = x / 256,
      v = y / 256,
      w = u + 0.012 * Math.sin(tau * v) + 0.005 * Math.sin(3 * tau * v + tau * u)
    const n =
      198 + 13 * Math.sin(23 * tau * w) + 6 * Math.cos(49 * tau * w + 2 * Math.sin(tau * v)) + 14 * random()
    return [n + 7, n + 1, n - 3]
  })
  const roofTexture = pattern(256, 256, (x, y) => {
    const u = x / 256,
      v = y / 256,
      col = Math.floor(u * 6),
      along = (v * 4 + (col % 2) * 0.225) % 1
    const t = (u * 6) % 1,
      cap = Math.exp(-((t - 0.145) ** 2) / 0.009),
      seam = Math.exp(-((t - 0.38) ** 2) / 0.004)
    const lip = Math.exp(-((along - 0.93) ** 2) / 0.001),
      cut = Math.exp(-((along - 0.98) ** 2) / 0.0009)
    const n = 171 + 43 * cap - 35 * seam + 27 * lip - 30 * cut + 6 * Math.sin((v + u) * tau) + 9 * random()
    return [n - 2, n + 1, n + 3]
  })
  const mineral = pattern(256, 256, (x, y) => {
    const a = (x / 256) * tau,
      c = (y / 256) * tau,
      vein = Math.sin(3 * a + c + 0.72 * Math.sin(2 * c)) + 0.23 * Math.sin(8 * a - 4 * c)
    const n =
      204 +
      10 * Math.sin(2 * a + 3 * c) +
      5 * Math.cos(11 * a - 9 * c) +
      22 * random() +
      11 * Math.exp(-vein * vein * 230)
    return [n + 1, n + 2, n]
  })
  const plaster = pattern(256, 256, (x, y) => {
    const n =
      223 +
      3 * Math.sin((x * tau) / 256 + (y * tau) / 128) +
      5 * Math.cos((x * tau) / 64 + (y * tau) / 256) +
      15 * random()
    return [n + 3, n + 2, n]
  })
  for (const k of ['timber', 'wood', 'darkwood']) m[k].map = grain
  m.roof.map = roofTexture
  for (const k of ['stone', 'coping', 'tiles', 'foundation', 'earth']) m[k].map = mineral
  m.plaster.map = plaster
  m.lantern.userData.cast = false
  m.paper.userData.cast = false
  return m
}
function polyline(b, m, points, r, sides = 6) {
  for (let i = 1; i < points.length; i++) b.tube(m, points[i - 1], points[i], r, r, sides, 1, false)
}
// The four fitted roof leaves share their hip curves exactly. The lower
// skin turns down at the edge and remains visible from the gallery below.
export function roof(b, m, x, y, z, width, depth, rise, options = {}) {
  if (depth > width * 1.035) {
    b.at(x, y, z, Math.PI / 2, () => roof(b, m, 0, 0, 0, depth, width, rise, options))
    return
  }
  const W = width / 2,
    D = depth / 2
  const ridgeEnd = Math.max(0.045, W - Math.min(W - 0.045, width * (options.hip ?? 0.23)))
  const lift = options.lift ?? Math.min(0.71, rise * 0.23)
  const detail = options.detail !== false,
    top = options.shade || m.roof,
    trim = options.trim || m.roofEdge
  const thickness = Math.min(0.16, 0.075 + width * 0.002)
  function h(s, u) {
    return rise * (0.17 * u + 0.83 * u ** 1.62) + lift * (1 - u) ** 2.35 * Math.pow(Math.abs(s), 3.5)
  }
  b.at(x, y, z, 0, () => {
    for (const sg of [-1, 1])
      for (const end of [false, true]) {
        const point = (s, u, offset = 0) =>
          end
            ? [sg * (W + (ridgeEnd - W) * u), h(s, u) + offset, s * D * (1 - u)]
            : [s * (W + (ridgeEnd - W) * u), h(s, u) + offset, sg * D * (1 - u)]
        const length = end ? depth : width,
          cols = Math.max(4, Math.ceil(length / (detail ? 2.15 : 3.4))),
          rows = detail ? 5 : 3
        for (let j = 0; j < cols; j++) {
          const a = (j * 2) / cols - 1,
            c = ((j + 1) * 2) / cols - 1
          for (let k = 0; k < rows; k++) {
            const u = k / rows,
              v = (k + 1) / rows
            const p0 = point(a, u),
              p1 = point(c, u),
              p2 = point(c, v),
              p3 = point(a, v)
            const uv = (p, t) => [(end ? p[2] : p[0]) * 0.82, t * (end ? W - ridgeEnd : D) * 0.86]
            if (end && k === rows - 1) b.face(top, [p0, p1, p2], 0.985, [uv(p0, u), uv(p1, u), uv(p2, v)])
            else b.face(top, [p0, p1, p2, p3], 0.985, [uv(p0, u), uv(p1, u), uv(p2, v), uv(p3, v)])
            const down = [
              point(a, u, -thickness),
              point(c, u, -thickness),
              point(c, v, -thickness),
              point(a, v, -thickness),
            ]
            b.face(m.darkwood, end && k === rows - 1 ? down.slice(0, 3) : down, 0.83)
          }
          b.beam(trim, point(a, 0, 0.005), point(c, 0, 0.005), thickness * 1.28, thickness)
          b.beam(
            m.wood,
            point(a, 0, -thickness * 0.96),
            point(c, 0, -thickness * 0.96),
            thickness * 1.1,
            thickness * 0.85
          )
          if (detail && j % 2 === 0)
            b.beam(m.timber, point(a, 0, -thickness - 0.061), point(a, 0.43, -thickness - 0.061), 0.12, 0.125)
        }
        if (!end)
          for (const s of [-1, 1]) {
            const ps = Array.from({ length: 8 }, (_, i) => point(s, i / 7, 0.081))
            polyline(b, trim, ps, Math.min(0.125, 0.073 + width * 0.001), 7)
            const tip = point(s, 0, 0.06)
            const w = Math.min(0.5, 0.12 + lift * 0.45)
            b.tube(
              trim,
              tip,
              [tip[0] + s * w * 0.54, tip[1] + w * 0.5, tip[2] + sg * w * 0.48],
              0.12,
              0.073,
              7
            )
            b.tube(
              m.bronze,
              [tip[0] + s * w * 0.54, tip[1] + w * 0.5, tip[2] + sg * w * 0.48],
              [tip[0] + s * w * 0.84, tip[1] + w, tip[2] + sg * w * 0.59],
              0.073,
              0.016,
              7
            )
          }
      }
    b.tube(trim, [-ridgeEnd, rise + 0.07, 0], [ridgeEnd, rise + 0.07, 0], 0.142, 0.142, 9)
    for (const s of [-1, 1]) {
      const x = s * ridgeEnd
      b.tube(trim, [x, rise + 0.08, 0], [x + s * 0.25, rise + 0.22, 0], 0.142, 0.092, 8)
      b.tube(m.bronze, [x + s * 0.25, rise + 0.22, 0], [x + s * 0.35, rise + 0.43, 0], 0.092, 0.018, 7)
    }
  })
}
export function lantern(b, m, x, y, z, r = 0.3, height = 0.7, style = 'amber') {
  const fabric = style === 'red' ? m.redSilk : style === 'jade' ? m.ceramic : m.lantern
  const count = 8
  const profile = [
    [-0.48, 0.68],
    [-0.36, 0.93],
    [-0.13, 1],
    [0.16, 1],
    [0.37, 0.91],
    [0.48, 0.68],
  ]
  const p = (i, row) => [
    x + r * row[1] * Math.cos((tau * i) / count),
    y + height * row[0],
    z + r * row[1] * Math.sin((tau * i) / count),
  ]
  for (let i = 0; i < count; i++) {
    for (let j = 1; j < profile.length; j++)
      b.face(
        fabric,
        [p(i, profile[j - 1]), p(i + 1, profile[j - 1]), p(i + 1, profile[j]), p(i, profile[j])],
        0.93 + 0.06 * (i % 3)
      )
    if (i % 2 === 0) {
      const rr = r + 0.012
      for (let j = 1; j < profile.length; j++) {
        const a = p(i, profile[j - 1]),
          c = p(i, profile[j])
        for (const q of [a, c]) {
          q[0] = x + ((q[0] - x) * rr) / r
          q[2] = z + ((q[2] - z) * rr) / r
        }
        b.beam(m.bronze, a, c, Math.max(0.013, r * 0.055), 0.014)
      }
    }
  }
  for (const s of [-0.5, 0.5])
    b.tube(m.darkwood, [x, y + height * s - 0.027, z], [x, y + height * s + 0.027, z], r * 0.79, r * 0.79, 8)
  b.tube(m.bronze, [x, y - height * 0.59, z], [x, y - height * 0.5, z], r * 0.105, r * 0.2, 7)
  b.tube(m.vermilion, [x, y - height * 0.79, z], [x, y - height * 0.59, z], r * 0.075, r * 0.09, 5)
}
export function windowBay(b, m, x, y, z, width, height, style = 'lattice') {
  const w = width,
    h = height,
    depth = 0.12
  b.box(m.paper, x, y, z, w, h, 0.044)
  for (const side of [-1, 1]) {
    b.box(m.darkwood, x + side * w * 0.5, y, z, 0.077, h + 0.06, depth)
    b.box(m.timber, x, y + side * h * 0.5, z, w + 0.08, 0.083, depth)
  }
  const n = Math.max(1, Math.round(w / (style === 'plain' ? 1.55 : 0.99))),
    sw = w / n
  for (let i = 0; i < n; i++) {
    const cx = x - w / 2 + (i + 0.5) * sw
    if (i) b.box(m.darkwood, cx - 0.5 * sw, y, z, 0.041, h, 0.093)
    if (style === 'plain') continue
    for (const s of [-1, 1]) b.box(m.darkwood, cx, y + s * h * 0.32, z, sw, 0.04, 0.082)
    if (style === 'bars') {
      b.box(m.darkwood, cx, y, z, 0.033, h, 0.082)
      continue
    }
    const dx = Math.min(sw * 0.3, 0.24),
      dy = Math.min(h * 0.2, 0.33)
    const pts = [
      [cx - dx, y, z],
      [cx, y + dy, z],
      [cx + dx, y, z],
      [cx, y - dy, z],
      [cx - dx, y, z],
    ]
    for (let j = 1; j < 5; j++) b.beam(m.darkwood, pts[j - 1], pts[j], 0.08, 0.04)
    for (const s of [-1, 1])
      b.box(m.darkwood, cx, y + s * (dy + h * 0.32) * 0.5, z, 0.032, h * 0.32 - dy, 0.077)
  }
}
