import * as T from 'three'
import { Mason } from './mesh.js'
import { umbrellaPainting } from './characterPropPaint.js'

export const tau = 2 * Math.PI
export const colors = {
  ink: 0x302726,
  wood: 0x995d37,
  honey: 0xd2a167,
  reed: 0xcfac71,
  rope: 0xaf8c5c,
  gold: 0xc2935b,
  darkGold: 0x846847,
  red: 0xaa4c42,
  teal: 0x47736c,
  ivory: 0xecd7ab,
  pearl: 0xf0e8d3,
  black: 0x362b29,
  paper: 0xe7cd9b,
  amber: 0xf3b560,
}
const rgb = new Map()
export function pigment(hex) {
  if (!rgb.has(hex)) rgb.set(hex, new T.Color(hex).toArray())
  return rgb.get(hex)
}
export function finishes(profile, job) {
  const common = { color: 0xffffff, side: T.DoubleSide, vertexColors: true }
  const matte = new T.MeshStandardMaterial({ ...common, name: '竹木丝帛', roughness: 0.73 }),
    metal = new T.MeshStandardMaterial({
      ...common,
      name: '器用旧铜与银',
      roughness: 0.38,
      metalness: 0.55,
    })
  const m = { matte, metal }
  if (job === 'umbrella') {
    const variant = profile.design === 'silk' ? 3 : Math.abs(profile.id ?? 0) % 3
    m.parasol = new T.MeshPhysicalMaterial({
      ...common, side: T.FrontSide, name: '上层桐油梅枝双燕', roughness: .55,
      clearcoat: .21, clearcoatRoughness: .36, map: umbrellaPainting(variant),
    })
    m.lining = new T.MeshStandardMaterial({
      ...common, side: T.FrontSide, name: '内层竹纸透墨', roughness: .86, map: umbrellaPainting(variant, true),
    })
  }
  if (job === 'lantern' || job === 'watch')
    m.glow = new T.MeshStandardMaterial({
      ...common,
      name: '人物的暖绢灯',
      emissive: 0xffa451,
      emissiveIntensity: 0.37,
      roughness: 0.82,
    })
  return m
}
export function piece(name, fn) {
  const group = new T.Group()
  group.name = name
  const b = new Mason(group)
  fn(b)
  b.finish()
  return group
}
export function rod(b, m, c, a, e, r, r2 = r, n = 9) {
  b.tube(m, a, e, r, r2, n, pigment(c))
}
export function box(b, m, c, p, d) {
  b.box(m, ...p, ...d, pigment(c))
}
export function face(b, m, c, points) {
  b.face(m, points, pigment(c))
}
export function stroke(b, m, c, points, r, n = 5) {
  for (let j = 1; j < points.length; j++) b.tube(m, points[j - 1], points[j], r, r, n, pigment(c), false)
}
export function ring(b, m, c, x, y, z, rx, rz, r, n = 22) {
  const p = Array.from({ length: n + 1 }, (_, i) => [
    x + rx * Math.cos((tau * i) / n),
    y,
    z + rz * Math.sin((tau * i) / n),
  ])
  stroke(b, m, c, p, r, 5)
}
export function oval(b, m, c, p, size, n = 10, k = 6) {
  const at = (j, i) => {
    const a = (tau * i) / n,
      t = -Math.PI / 2 + (Math.PI * j) / k
    return [
      p[0] + size[0] * Math.cos(t) * Math.sin(a),
      p[1] + size[1] * Math.sin(t),
      p[2] + size[2] * Math.cos(t) * Math.cos(a),
    ]
  }
  const normal = (v) =>
    new T.Vector3(...v.map((val, i) => (val - p[i]) / (size[i] * size[i]))).normalize().toArray()
  for (let j = 0; j < k; j++)
    for (let i = 0; i < n; i++) {
      let points = [at(j, i), at(j, i + 1), at(j + 1, i + 1), at(j + 1, i)]
      if (j === 0) points.splice(0, 1)
      if (j === k - 1) points.splice(2, 1)
      b.face(m, points, pigment(c), null, points.map(normal))
    }
}
// Twined bamboo basket, with a real hollow interior and over/under crossings at its lip.
export function hamper(b, m, c, x, y, z, rx, rz, h, full = true) {
  const n = 28,
    rows = 10,
    pt = (i, l, off = 0) => {
      const a = (tau * i) / n,
        f = Math.max(0, Math.min(1, l)),
        s = 0.73 + 0.29 * Math.sin(f * 1.34)
      return [x + (rx * s + off) * Math.cos(a), y + h * l, z + (rz * s + off) * Math.sin(a)]
    }
  const base = Array.from({ length: n }, (_, i) => pt(i, 0))
  face(b, m.matte, 0x92734a, base)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < rows; j++) {
      const l = j / rows,
        u = (j + 1) / rows,
        under = (j + i) % 2 ? 0.0011 : -0.0011
      face(b, m.matte, i % 3 ? 0xbd9561 : 0xd3ab70, [
        pt(i - 0.18, l, -under),
        pt(i + 0.18, l, -under),
        pt(i + 0.18, u, under),
        pt(i - 0.18, u, under),
      ])
      const k = (j + 0.49) / rows,
        g = 0.25 / rows
      face(b, m.matte, j % 3 ? c : 0xb78b55, [
        pt(i, k - g, under),
        pt(i + 1, k - g, -under),
        pt(i + 1, k + g, -under),
        pt(i, k + g, under),
      ])
    }
  ring(b, m.matte, c, x, y + h, z, rx * 1.017, rz * 1.017, 0.0056, 28)
  ring(b, m.matte, 0xa38151, x, y + 0.006, z, rx * 0.745, rz * 0.745, 0.0046, 24)
  if (full) {
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4,
        rad = Math.sqrt(i / 7)
      const xx = x + Math.cos(a) * rad * rx * 0.71,
        zz = z + Math.sin(a) * rad * rz * 0.65,
        yy = y + h * (0.79 + 0.11 * Math.sin(a))
      oval(
        b,
        m.matte,
        [0xcc8b54, 0xc68355, 0xdcab66, 0x9eaa65][i % 4],
        [xx, yy, zz],
        [rx * 0.23, h * 0.21, rz * 0.24],
        9,
        5,
      )
      rod(
        b,
        m.matte,
        colors.wood,
        [xx, yy + h * 0.14, zz],
        [xx + 0.004, yy + h * 0.22, zz + 0.003],
        0.0025,
        0.002,
        5,
      )
    }
  }
}
