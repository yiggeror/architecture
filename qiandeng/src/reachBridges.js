import * as T from 'three'
import { terraceHeight } from './land.js'
import { reachPoint, reachTerraces } from './reachMap.js'
import { smallShade } from './gateCraft.js'
import { windowBay } from './kit.js'

const tau = 2 * Math.PI
const mix = (a, c, t) => a + (c - a) * t
const axis = (a, c) => {
  const dx = c[0] - a[0],
    dz = c[1] - a[1],
    length = Math.hypot(dx, dz),
    yaw = Math.atan2(-dz, dx)
  return {
    a,
    c,
    length,
    yaw,
    point(x, z = 0) {
      return [a[0] + (x * dx - z * dz) / length, a[1] + (x * dz + z * dx) / length]
    }
  }
}
export const reachBridgeRoutes = {
  foot: axis([59.13, 53.15], [59.13, 40.43]),
  east: axis([60.71, 39.04], [111, 28]),
  north: axis([-35, -181], [60, -186])
}
const silkQuay = reachTerraces.find((t) => t.id === '锦浦-0'),
  southQuay = reachTerraces.find((t) => t.id === '南栈-0')
const waterfront = (row, along, offset) => reachPoint(row, along, row.depth / 2 + offset)
const portNorth = axis(waterfront(silkQuay, 52.2, -1.3), waterfront(silkQuay, 52.2, 12.75))
const portSouth = axis(waterfront(southQuay, -54.2, -1.3), waterfront(southQuay, -54.2, 12.75))
const port = axis(portNorth.c, portSouth.c)
Object.assign(reachBridgeRoutes, { port, portNorth, portSouth })
export const reachWharfOffset = 7.2
const eastTop = 12.57,
  turnLevel = 8.14,
  outlookCrossing = 13.42,
  northTop = 41.96,
  northLanding = 43.72
const east = [
  [0, 8.85, turnLevel, outlookCrossing, 31],
  [8.85, 14.67, outlookCrossing, outlookCrossing, 0],
  [14.67, 16.77, outlookCrossing, eastTop, 5],
  [16.77, 35.76, eastTop, eastTop, 0],
  [35.76, 45.26, eastTop, 9, 20],
  [45.26, reachBridgeRoutes.east.length, 9, 9, 0]
]
const north = [
  [0, 5.4, 38, 38, 0],
  [5.4, 16.5, 38, northTop, 22],
  [16.5, 56.5, northTop, northTop, 0],
  [56.5, 63.2, northTop, northLanding, 10],
  [63.2, 87.5, northLanding, northLanding, 0],
  [87.5, 94.2, northLanding, 42, 10],
  [94.2, reachBridgeRoutes.north.length, 42, 42, 0]
]
const grade = (profile, x) => {
  const p = profile.find((s) => x < s[1]) || profile.at(-1)
  return mix(p[2], p[3], Math.max(0, Math.min(1, (x - p[0]) / (p[1] - p[0]))))
}

function polygonFace(b, mat, perimeter, holes, z, shade) {
  const vector = (pts) => pts.map(([x, y]) => new T.Vector2(x, y))
  const triangles = T.ShapeUtils.triangulateShape(vector(perimeter), holes.map(vector))
  const p = perimeter.concat(...holes)
  for (const tri of triangles)
    b.face(
      mat,
      tri.map((i) => [p[i][0], p[i][1], z]),
      shade
    )
}
function ribbon(b, mat, p, q, w, shade = 1) {
  const dx = q[0] - p[0],
    dy = q[1] - p[1],
    r = w / (2 * (Math.hypot(dx, dy) || 1)),
    ox = -dy * r,
    oy = dx * r
  b.face(
    mat,
    [
      [p[0] - ox, p[1] - oy, p[2]],
      [q[0] - ox, q[1] - oy, q[2]],
      [q[0] + ox, q[1] + oy, q[2]],
      [p[0] + ox, p[1] + oy, p[2]]
    ],
    shade
  )
}
function hardware(b, m, x, y, z, size, shade = 1) {
  b.face(
    m.bronze,
    [
      [x - size, y, z],
      [x, y + size, z],
      [x + size, y, z],
      [x, y - size, z]
    ],
    shade
  )
}
function surveyLamp(b, m, world, x, y, z, style = 'amber', size = 1) {
  const red = style === 'red',
    slender = style === 'needle'
  smallShade(b, m, x, y, z, (slender ? 0.2 : 0.285) * size, (slender ? 0.87 : 0.64) * size, red)
  world.lamp(
    ...b.point([x, y, z]),
    red ? 0xff7246 : slender ? 0xffc782 : 0xffad65,
    (red ? 12 : 16) * size,
    (slender ? 7.3 : 8.7) * size
  )
}
function pole(b, m, world, x, y, z, i, small = false) {
  const H = small ? 1.59 : 2.28
  b.box(m.coping, x, y + 0.115, z, 0.39, 0.23, 0.45, 0.89)
  b.tube(m.timber, [x, y + 0.2, z], [x, y + H, z], 0.114, 0.079, 7, 0.87, false)
  b.box(m.bronze, x, y + H * 0.54, z, 0.2, 0.11, 0.2, 0.89)
  const arm = z > 0 ? -0.33 : 0.33
  b.box(m.teal, x, y + H, z + arm * 0.4, 0.23, 0.14, Math.abs(arm) + 0.4, 0.95)
  surveyLamp(b, m, world, x, y + H - 0.38, z + arm, i % 5 === 0 ? 'red' : 'needle', small ? 0.68 : 0.84)
}
function rail(b, m, a, c, ya, yc, z, style = 'timber') {
  const count = Math.max(1, Math.ceil((c - a) / 2.22)),
    h = style === 'stone' ? 0.95 : 1.04
  const main = style === 'stone' ? m.coping : m.darkwood,
    post = style === 'stone' ? m.stone : m.timber
  for (const [dy, w, d] of [
    [h, 0.13, 0.14],
    [0.18, 0.12, 0.15]
  ])
    b.beam(main, [a, ya + dy, z], [c, yc + dy, z], w, d, 0.91)
  for (let i = 0; i <= count; i++) {
    const t = i / count,
      x = mix(a, c, t),
      y = mix(ya, yc, t)
    const shaft = [
      [-0.077, -0.08],
      [0.077, -0.08],
      [0.077, 0.08],
      [-0.077, 0.08]
    ]
    const ring = (k, yy, scale) => [x + shaft[k][0] * scale, yy, z + shaft[k][1] * scale]
    for (let j = 0; j < 4; j++) {
      const nn = (j + 1) % 4
      b.face(
        post,
        [ring(j, y, 1), ring(nn, y, 1), ring(nn, y + h + 0.012, 1), ring(j, y + h + 0.012, 1)],
        0.93
      )
      b.face(
        m.patina,
        [
          ring(j, y + h + 0.009, 1.32),
          ring(nn, y + h + 0.009, 1.32),
          ring(nn, y + h + 0.087, 1.18),
          ring(j, y + h + 0.087, 1.18)
        ],
        0.92
      )
    }
    b.face(
      m.patina,
      [0, 1, 2, 3].map((k) => ring(k, y + h + 0.087, 1.18)),
      0.93
    )
    if (i === count) break
    const cw = (c - a) / count,
      dy = (yc - ya) / count
    const p = (u, l) => [x + cw * u, y + dy * u + l, z]
    for (const s of [-1, 1]) {
      ribbon(b, m.patina, p(0.14, 0.55), p(0.47, 0.55 + s * 0.22), 0.055, 0.84)
      ribbon(b, m.patina, p(0.47, 0.55 + s * 0.22), p(0.84, 0.55), 0.055, 0.84)
    }
  }
}
function floorRun(b, m, a, c, ya, yc, steps, width, detailRail = true, material = m.wood) {
  const n = steps || Math.max(1, Math.ceil((c - a) / 1.24)),
    w = (c - a) / n
  for (let k = 0; k < n; k++) {
    const x = a + (k + 0.5) * w,
      y = steps ? mix(ya, yc, (k + 1) / n) : ya
    const tone = 0.86 + (0.055 * ((k * 3) % 5)) / 4
    if (steps || k === 0 || k === n - 1) b.box(material, x, y - 0.096, 0, w + 0.001, 0.192, width, tone)
    else {
      const p = (s, t, d) => [x + (s * w) / 2, y + d, (t * width) / 2]
      b.face(material, [p(-1, 1, 0), p(1, 1, 0), p(1, -1, 0), p(-1, -1, 0)], tone)
      b.face(material, [p(-1, -1, -0.192), p(1, -1, -0.192), p(1, 1, -0.192), p(-1, 1, -0.192)], tone)
      for (const t of [-1, 1])
        b.face(material, [p(-1, t, 0), p(1, t, 0), p(1, t, -0.192), p(-1, t, -0.192)], tone)
    }
    if (steps && k % 4 === 1)
      b.box(m.bronze, x - w * 0.32, y + 0.002, 0, 0.019, 0.005, width - 0.48, 0.72)
    if (!steps && k % 2 === 0) b.box(m.darkwood, x, y - 0.342, 0, 0.226, 0.31, width + 0.26, 0.81)
  }
  for (const s of [-1, 1]) {
    const z = s * (width / 2 - 0.077)
    b.beam(m.timber, [a, ya - 0.3, z], [c, yc - 0.3, z], 0.275, 0.34, 0.81)
    if (detailRail) {
      const cuts = Array.isArray(detailRail) ? detailRail : []
      const points = [a, ...cuts.flat().filter((x) => x > a && x < c), c].sort((x, y) => x - y)
      for (let j = 1; j < points.length; j++) {
        const l = points[j - 1],
          r = points[j],
          t = (l + r) / 2
        if (cuts.some(([s, e]) => t > s && t < e)) continue
        rail(
          b,
          m,
          l,
          r,
          mix(ya, yc, (l - a) / (c - a)),
          mix(ya, yc, (r - a) / (c - a)),
          z,
          material === m.coping ? 'stone' : 'timber'
        )
      }
    }
  }
}
function signs(m) {
  if (m.reachBridgeSigns) return
  const mat = m.darkwood.clone()
  mat.name = 'riverBridgeGoldLetters'
  mat.color.set(0xffffff)
  mat.emissive.set(0x95672d)
  mat.emissiveIntensity = 0.19
  if (typeof document !== 'undefined') {
    const board = document.createElement('canvas')
    board.width = 1024
    board.height = 768
    const ctx = board.getContext('2d')
    const names = [
      '锦 浦 飞 廊',
      '织 虹 书 市',
      '竹 纸 书 行',
      '过 津 茶 坊',
      '合 欢 水 闸',
      '南 栈 脚 行'
    ]
    names.forEach((label, i) => {
      const x = (i % 2) * 512,
        y = Math.floor(i / 2) * 256
      const glaze = ctx.createLinearGradient(x, y, x + 120, y + 255)
      glaze.addColorStop(0, i % 2 ? '#244041' : '#592e2d')
      glaze.addColorStop(1, i % 2 ? '#132a2e' : '#352222')
      ctx.fillStyle = glaze
      ctx.fillRect(x, y, 512, 256)
      ctx.strokeStyle = '#bd9d69'
      ctx.lineWidth = 3.7
      ctx.strokeRect(x + 10, y + 13, 492, 230)
      ctx.strokeStyle = '#766c4d'
      ctx.lineWidth = 2
      ctx.strokeRect(x + 16, y + 20, 480, 216)
      for (const dir of [-1, 1])
        for (const sign of [-1, 1]) {
          const sx = dir === 1 ? x + 26 : x + 485,
            sy = sign === 1 ? y + 31 : y + 225
          ctx.strokeStyle = '#bda06d'
          ctx.beginPath()
          ctx.moveTo(sx, sy + sign * 32)
          ctx.lineTo(sx, sy)
          ctx.lineTo(sx + dir * 39, sy)
          ctx.lineTo(sx + dir * 39, sy + sign * 10)
          ctx.lineTo(sx + dir * 14, sy + sign * 10)
          ctx.lineTo(sx + dir * 14, sy + sign * 23)
          ctx.stroke()
        }
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = 'bold 68px "Noto Serif CJK SC",serif'
      ctx.shadowColor = '#0e1214'
      ctx.shadowBlur = 3
      ctx.shadowOffsetY = 4
      ctx.fillStyle = '#f2d292'
      ctx.fillText(label, x + 255, y + 129, 401)
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0
    })
    const tex = new T.CanvasTexture(board)
    tex.colorSpace = T.SRGBColorSpace
    tex.anisotropy = 6
    mat.map = mat.emissiveMap = tex
  } else {
    mat.map = null
    mat.color.set(0x786043)
  }
  m.reachBridgeSigns = mat
  const quarry = m.foundation.clone()
  quarry.name = 'longRiverDressedStone'
  quarry.color.set(0x838d8a)
  const size = 192,
    texels = new Uint8Array(size * size * 4)
  let state = 870457
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      const row = y >> 5,
        xx = x + (row % 2) * 32,
        i = (x + y * size) * 4
      const grain = (state / 4294967296 - 0.5) * 17,
        bed = y % 32,
        joint = xx % 64
      const age = Math.sin((Math.floor(xx / 64) * 7 + row * 5) * 4.7)
      const v = bed < 2 || joint === 0 ? 122 : bed < 4 || joint === 1 ? 184 : 199 + grain + 11 * age
      texels.set([v - 2, v + 1, v, 255], i)
    }
  const stone = new T.DataTexture(texels, size, size)
  stone.wrapS = stone.wrapT = T.RepeatWrapping
  stone.repeat.set(0.178, 0.172)
  stone.colorSpace = T.SRGBColorSpace
  stone.generateMipmaps = true
  stone.minFilter = T.LinearMipmapLinearFilter
  stone.magFilter = T.LinearFilter
  stone.anisotropy = 6
  stone.needsUpdate = true
  quarry.map = stone
  m.reachBridgeStone = quarry
}
function plaque(b, m, x, y, z, w, h, id) {
  b.box(m.darkwood, x, y, z, w + 0.14, h + 0.12, 0.16, 0.88)
  const u = (id % 2) * 0.5,
    v = (2 - Math.floor(id / 2)) / 3
  for (const s of [-1, 1]) {
    const front = z + s * 0.083
    b.face(
      m.reachBridgeSigns,
      [
        [x - (s * w) / 2, y - h / 2, front],
        [x + (s * w) / 2, y - h / 2, front],
        [x + (s * w) / 2, y + h / 2, front],
        [x - (s * w) / 2, y + h / 2, front]
      ],
      0.96,
      [
        [u + 0.005, v + 0.005],
        [u + 0.495, v + 0.005],
        [u + 0.495, v + 0.328],
        [u + 0.005, v + 0.328]
      ]
    )
  }
}
function post(b, m, x, y, z, h, big = false) {
  const r = big ? 0.218 : 0.151
  b.box(m.coping, x, y + 0.125, z, r * 2.99, 0.25, r * 2.99, 0.92)
  b.tube(m.vermilion, [x, y + 0.22, z], [x, y + h - 0.17, z], r, r * 0.86, big ? 9 : 7, 0.92, false)
  b.tube(m.bronze, [x, y + 0.29, z], [x, y + 0.4, z], r * 1.08, r * 1.06, 7, 0.85, false)
  b.box(m.teal, x, y + h - 0.34, z, r * 3.57, 0.18, r * 3.2, 0.91)
  b.box(m.timber, x, y + h - 0.16, z, r * 5.31, 0.19, r * 3.84, 0.94)
}
function wings(b, m, cx, length, roadWidth, depth, y) {
  const ext = (depth - roadWidth) / 2
  for (const sign of [-1, 1]) {
    const z = (sign * (depth + roadWidth)) / 4
    b.box(m.wood, cx, y - 0.095, z, length, 0.19, ext + 0.003, 0.93)
    b.box(m.darkwood, cx, y - 0.29, sign * (depth / 2 - 0.07), length, 0.33, 0.24, 0.85)
    for (const x of [cx - length * 0.38, cx, cx + length * 0.38])
      b.beam(
        m.timber,
        [x, y - 1.18, sign * (roadWidth / 2 - 0.25)],
        [x, y - 0.26, sign * (depth / 2 - 0.15)],
        0.21,
        0.29,
        0.9
      )
    for (const edge of [-1, 1])
      b.at(cx + edge * (length / 2 - 0.07), 0, z, -Math.PI / 2, () =>
        rail(b, m, -ext / 2 + 0.06, ext / 2 - 0.06, y, y, 0)
      )
  }
}
// Strongly curved eaves meet a long tongued ridge. The gable faces stay open above the entrances.
function canopy(b, m, x, y, z, length, depth, rise, lift, shade = m.roof) {
  const w = length / 2,
    d = depth / 2,
    cols = Math.ceil(length / 1.69),
    rows = 5,
    skin = 0.126
  const p = (s, v, offset = 0) => [
    x + s * (w - 0.47 * (1 - Math.abs(v)) ** 1.5),
    y + rise * (1 - Math.abs(v)) ** 1.42 + lift * Math.abs(s) ** 3.3 * Math.abs(v) ** 2.3 + offset,
    z + v * d
  ]
  for (const sign of [-1, 1]) {
    for (let i = 0; i < cols; i++) {
      const a = (2 * i) / cols - 1,
        c = (2 * (i + 1)) / cols - 1
      for (let j = 0; j < rows; j++) {
        const t = (sign * j) / rows,
          u = (sign * (j + 1)) / rows
        const patch = [p(a, t), p(a, u), p(c, u), p(c, t)]
        b.face(
          shade,
          patch,
          0.96,
          patch.map((g) => [g[0] * 0.62, g[2] * 0.73])
        )
        b.face(m.darkwood, [p(a, t, -skin), p(c, t, -skin), p(c, u, -skin), p(a, u, -skin)], 0.87)
      }
      b.beam(m.patina, p(a, sign), p(c, sign), 0.16, 0.16, 0.92)
      b.beam(m.timber, p(a, sign, -skin), p(c, sign, -skin), 0.15, 0.15, 0.96)
    }
    const rolls = Math.round(length / 0.65)
    for (let j = 0; j <= rolls; j++) {
      const s = (2 * j) / rolls - 1
      for (let i = 0; i < rows; i++) {
        const u = (sign * i) / rows,
          v = (sign * (i + 1)) / rows,
          le = 0.059 / w
        b.face(
          m.roofEdge,
          [p(s - le, u, 0.02), p(s - le, v, 0.02), p(s + le, v, 0.066), p(s + le, u, 0.066)],
          0.79
        )
      }
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < rows; i++)
        b.beam(
          m.patina,
          p(side, (sign * i) / rows, 0.013),
          p(side, (sign * (i + 1)) / rows, 0.013),
          0.18,
          0.14,
          0.86
        )
      const tip = p(side, sign),
        q = [tip[0] + side * 0.39, tip[1] + 0.38, tip[2] + sign * 0.27]
      b.tube(m.patina, tip, q, 0.16, 0.1, 6, 0.93)
      b.tube(m.bronze, q, [q[0] + side * 0.12, q[1] + 0.38, q[2] + sign * 0.05], 0.11, 0.021, 7, 0.93)
    }
  }
  b.beam(m.patina, p(-1, 0, 0.047), p(1, 0, 0.047), 0.25, 0.22)
  for (let k = 0, N = Math.ceil(length / 2.75); k <= N; k++) {
    const s = 1.9 * (k / N - 0.5),
      xx = x + w * s
    b.beam(m.timber, [xx, y - 0.27, z - d + 0.34], [xx, y - 0.27, z + d - 0.34], 0.16, 0.19, 0.86)
    for (const side of [-1, 1]) {
      for (let j = 0; j < 3; j++)
        b.beam(
          m.wood,
          p(s, (side * j) / 3, -0.173),
          p(s, (side * (j + 1)) / 3, -0.173),
          0.12,
          0.128,
          0.88
        )
      b.beam(
        m.teal,
        [xx, y - 0.23, z + side * d * 0.67],
        [xx, y + rise * 0.43, z + side * d * 0.38],
        0.103,
        0.124,
        0.84
      )
    }
  }
  for (const s of [-1, 1]) {
    const g = p(s, 0, 0.08),
      q = [g[0] + s * 0.32, g[1] + 0.28, g[2]]
    b.tube(m.roofEdge, g, q, 0.19, 0.13, 8, 0.9)
    b.tube(m.bronze, q, [q[0] + s * 0.17, q[1] + 0.37, q[2]], 0.13, 0.029, 6)
  }
}
function fan(b, m, x, y, z, w, h) {
  const finger = (t, r) => [x + r * w * 0.5 * Math.cos(t), y + r * h * Math.sin(t), z]
  for (let i = 0; i < 15; i++) {
    const a = (Math.PI * i) / 15,
      c = (Math.PI * (i + 1)) / 15
    ribbon(b, m.teal, finger(a, 1), finger(c, 1), 0.084, 0.94)
    ribbon(b, m.bronze, finger(a, 0.74), finger(c, 0.74), 0.045, 0.91)
    if (i % 3 === 0) ribbon(b, m.timber, finger(a, 0.17), finger(a, 1), 0.068, 0.97)
  }
  b.box(m.timber, x, y, z, w + 0.11, 0.12, 0.14, 0.9)
}
function stall(b, m, x, z, side, books) {
  b.at(x, 0, z, side < 0 ? Math.PI : 0, () => {
    b.box(m.darkwood, 0, 1.15, 0, 1.92, 0.14, 0.55, 0.93)
    for (const d of [-1, 1]) b.box(m.timber, d * 0.68, 0.55, 0, 0.15, 1.1, 0.27, 0.9)
    if (books)
      for (let j = 0; j < 4; j++) {
        const xx = -0.69 + j * 0.41
        for (let k = 0; k < 2 + (j % 3); k++)
          b.box(
            k % 2 ? m.teal : m.paper,
            xx,
            1.24 + k * 0.073,
            0.018,
            0.38,
            0.068,
            0.43,
            0.77 + k * 0.035
          )
      }
    else {
      for (const xx of [-0.66, 0.54])
        b.tube(m.ceramic, [xx, 1.22, 0], [xx, 1.57, 0], 0.124, 0.172, 9, 0.94)
      b.tube(m.patina, [-0.04, 1.22, 0], [-0.04, 1.48, 0], 0.177, 0.23, 9, 0.86)
      b.tube(m.bronze, [-0.04, 1.48, 0], [-0.04, 1.55, 0], 0.24, 0.14, 9, 0.92)
    }
  })
}
function gallery(b, m, world, a, c, base, roadWidth, id) {
  const center = (a + c) / 2,
    L = c - a,
    depth = id ? 6.77 : 5.86,
    h = id ? 4.28 : 3.58
  wings(b, m, center, L, roadWidth, depth, base)
  b.at(center, base, 0, 0, () => {
    canopy(b, m, 0, h, 0, L + 0.91, depth + 0.55, id ? 1.96 : 1.53, id ? 0.66 : 0.51)
    const N = id ? 4 : 3
    for (const s of [-1, 1]) {
      const inset = depth / 2 - 0.48
      for (let i = 0; i <= N; i++) {
        const x = (L - 0.91) * (i / N - 0.5)
        post(b, m, x, 0, s * inset, h - 0.16)
        for (const d of [-1, 1])
          if (i + d >= 0 && i + d <= N)
            b.beam(
              m.timber,
              [x, h - 0.88, s * inset],
              [x + d * 0.68, h - 0.32, s * inset],
              0.14,
              0.16,
              0.91
            )
        if (i === N) continue
        const next = (L - 0.91) * ((i + 1) / N - 0.5),
          cx = (x + next) / 2
        if ((i + (s === 1 ? 1 : 0)) % 2 === 0) {
          fan(b, m, cx, h - 0.96, s * inset, next - x - 0.44, 0.64)
          surveyLamp(b, m, world, cx, h - 1.37, s * (inset - 0.15), i % 3 === 0 ? 'red' : 'amber', 0.9)
          stall(b, m, cx, s * (inset - 0.08), s, id === 1)
        } else {
          b.box(m.timber, cx, h - 0.42, s * inset, next - x - 0.19, 0.18, 0.19, 0.91)
          b.box(m.paper, cx, h - 0.7, s * inset, next - x - 0.48, 0.34, 0.048, 0.72)
          for (const k of [-1, 0, 1])
            b.box(m.darkwood, cx + k * (next - x) * 0.23, h - 0.7, s * inset, 0.055, 0.37, 0.065, 0.79)
        }
      }
      rail(b, m, -L / 2 + 0.04, L / 2 - 0.04, 0, 0, s * (depth / 2 - 0.076))
      b.box(m.timber, 0, h - 0.19, s * inset, L - 0.32, 0.31, 0.25, 0.94)
    }
    for (const s of [-1, 1])
      b.at(s * (L / 2 - 0.1), 0, 0, (s * Math.PI) / 2, () => {
        b.box(m.vermilion, 0, h - 0.26, 0, depth - 0.75, 0.28, 0.26, 0.92)
        fan(b, m, 0, h - 0.13, 0, depth - 1.05, 1.08)
        plaque(b, m, 0, h - 0.75, 0.12, 1.82, 0.48, id ? 1 : 0)
      })
  })
}
function eavesAround(b, m, y, w, d, innerW, innerD, rise) {
  const shape = (ww, dd) => [
    [-ww * 0.43, dd * 0.5],
    [ww * 0.43, dd * 0.5],
    [ww * 0.5, dd * 0.38],
    [ww * 0.5, -dd * 0.38],
    [ww * 0.43, -dd * 0.5],
    [-ww * 0.43, -dd * 0.5],
    [-ww * 0.5, -dd * 0.38],
    [-ww * 0.5, dd * 0.38]
  ]
  const rim = shape(w, d),
    inside = shape(innerW, innerD),
    N = 8
  const p = (i, t, off = 0) => {
    const corner = i % N
    const a = rim[corner],
      c = inside[corner]
    return [
      mix(a[0], c[0], t),
      y + rise * (0.19 * t + 0.81 * t * t) + 0.24 * (1 - t) ** 2 + off,
      mix(a[1], c[1], t)
    ]
  }
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < 4; k++) {
      const t = k / 4,
        u = (k + 1) / 4,
        q = [p(i, t), p(i + 1, t), p(i + 1, u), p(i, u)]
      b.face(
        m.roof,
        q,
        0.94,
        q.map((p) => [p[0] * 0.68, p[2] * 0.72])
      )
      b.face(
        m.darkwood,
        [p(i, t, -0.108), p(i, u, -0.108), p(i + 1, u, -0.108), p(i + 1, t, -0.108)],
        0.83
      )
    }
    b.beam(m.roofEdge, p(i, 0, 0.02), p(i + 1, 0, 0.02), 0.17, 0.16)
    b.beam(m.bronze, p(i, 0, -0.104), p(i + 1, 0, -0.104), 0.07, 0.054, 0.83)
  }
}
function bridgeRoom(b, m, world, cx, base, roadWidth, northHouse) {
  const L = northHouse ? 11.02 : 9.65,
    D = 7.21,
    upper = 3.94,
    h = 7.52,
    R = 3.82
  wings(b, m, cx, L, roadWidth, D, base)
  b.at(cx, base, 0, 0, () => {
    for (const s of [-1, 1]) {
      rail(b, m, -L / 2 + 0.04, L / 2 - 0.04, 0, 0, s * (D / 2 - 0.084))
      for (const x of [-L * 0.43, 0, L * 0.43]) post(b, m, x, 0, s * (D * 0.5 - 0.42), 3.52, true)
      b.box(m.timber, 0, 3.49, s * (D * 0.5 - 0.42), L - 0.52, 0.32, 0.34, 0.93)
      for (const x of [-L * 0.28, L * 0.28])
        surveyLamp(b, m, world, x, 2.9, s * (D * 0.5 - 0.42), s < 0 ? 'needle' : 'red', 0.93)
    }
    eavesAround(b, m, 3.39, L + 1.23, D + 1.0, R * 2 + 0.07, 5.77, 0.77)
    const stairLeft = -3.13,
      stairRight = 2.9,
      stairZ = -1.86,
      stairW = 1.21
    b.at(0, 0, stairZ, 0, () =>
      floorRun(b, m, stairLeft, stairRight, 0, upper, 22, stairW, true, m.wood)
    )
    const holeL = stairLeft - 0.06,
      holeR = stairRight + 0.07,
      minZ = stairZ - stairW / 2 - 0.16,
      maxZ = stairZ + stairW / 2 + 0.16
    const floor = (a, c, f, r) =>
      b.box(m.wood, (a + c) / 2, upper - 0.1, (f + r) / 2, c - a, 0.2, r - f, 0.89)
    floor(-R, holeL, -2.72, 2.72)
    floor(holeR, R, -2.72, 2.72)
    floor(holeL, holeR, -2.72, minZ)
    floor(holeL, holeR, maxZ, 2.72)
    for (const s of [-1, 1]) {
      const z = s * 2.55
      for (const x of [-R + 0.16, -1.22, 1.22, R - 0.16]) post(b, m, x, upper, z, h - upper - 0.05)
      b.box(m.vermilion, 0, h - 0.19, z, 2 * R, 0.23, 0.23, 0.92)
      for (const [j, x] of [-2.42, 0, 2.42].entries()) {
        if ((j + (s < 0 ? 1 : 0)) % 3 === 0) {
          b.box(m.teal, x, upper + 0.49, z, 2.13, 0.89, 0.13, 0.93)
          fan(b, m, x, h - 1.04, z, 2.04, 0.63)
        } else {
          b.box(m.timber, x, upper + 0.56, z, 2.05, 1.12, 0.15, 0.86)
          b.at(x, upper + 2.04, z, s < 0 ? Math.PI : 0, () =>
            windowBay(b, m, 0, 0, 0, 1.87, 1.53, j === 1 ? 'flower' : 'lattice')
          )
        }
      }
    }
    for (const s of [-1, 1])
      b.at(s * (R - 0.03), 0, 0, (s * Math.PI) / 2, () => {
        b.box(m.timber, 0, h - 0.22, 0, 5.47, 0.25, 0.25, 0.94)
        rail(b, m, -2.54, 2.54, upper, upper, 0)
        plaque(b, m, 0, h - 0.67, 0.09, 1.91, 0.52, northHouse ? 2 : 3)
      })
    b.at(0, upper, 0, 0, () => stall(b, m, -0.81, 2.05, 1, northHouse))
    surveyLamp(b, m, world, 0.33, h - 1.04, 0.17, 'amber', 1.18)
    canopy(
      b,
      m,
      0,
      h,
      0,
      2 * R + 2.12,
      7.29,
      northHouse ? 2.39 : 2.11,
      0.74,
      northHouse ? m.roofEdge : m.roof
    )
    for (const d of [-1, 1])
      b.at(d * (L / 2 - 0.34), 0, 0, (d * Math.PI) / 2, () => {
        b.box(m.wood, 0, 3.51, 0, D - 0.89, 0.22, 0.21, 0.89)
        plaque(b, m, 0, 3.04, 0.07, 1.69, 0.43, northHouse ? 1 : 0)
      })
  })
}
function pier(b, m, x, z, base, top, w, d) {
  const outline = (wide, deep, y) =>
    [
      [-wide * 0.5, deep * 0.29],
      [-wide * 0.36, deep * 0.43],
      [0, deep * 0.59],
      [wide * 0.36, deep * 0.43],
      [wide * 0.5, deep * 0.29],
      [wide * 0.5, -deep * 0.29],
      [wide * 0.35, -deep * 0.44],
      [0, -deep * 0.59],
      [-wide * 0.35, -deep * 0.44],
      [-wide * 0.5, -deep * 0.29]
    ].map(([px, pz]) => [x + px, y, z + pz])
  const bands = [
    [0, 1.2, 1.19],
    [0.1, 1.22, 1.21],
    [0.13, 1.09, 1.1],
    [0.64, 0.93, 0.93],
    [0.66, 0.99, 0.99],
    [0.69, 0.93, 0.94],
    [0.9, 0.83, 0.87],
    [0.94, 1.02, 1.03],
    [1, 1.06, 1.08]
  ]
  let prev
  for (const [j, [t, sw, sd]] of bands.entries()) {
    const ring = outline(w * sw, d * sd, mix(base, top, t))
    if (prev)
      for (let k = 0; k < ring.length; k++) {
        const next = (k + 1) % ring.length
        b.face(
          [2, 5, 7, 8].includes(j) ? m.coping : m.reachBridgeStone,
          [prev[k], prev[next], ring[next], ring[k]],
          0.8 + (0.18 * ((k * 5 + j) % 7)) / 6
        )
      }
    prev = ring
  }
  b.face(m.coping, prev, 0.89)
}
function stoneArch(b, m, profile, a, c, spring, crown, w, openEyes = true) {
  const cx = (a + c) / 2,
    rx = (c - a) / 2,
    ry = crown - spring,
    n = 39,
    half = w / 2
  const point = (angle, z, offset = 0) => [
    cx + (rx + offset) * Math.cos(angle),
    spring + (ry + offset) * Math.sin(angle),
    z
  ]
  const topAt = (x) => grade(profile, x) - 0.37
  const border = [[a, topAt(a)]]
  for (const end of profile.map((p) => p[1]).filter((x) => x > a && x < c))
    border.push([end, topAt(end)])
  border.push([c, topAt(c)])
  for (let j = 0; j <= n; j++) {
    const [x, y] = point((j * Math.PI) / n, 0)
    border.push([x, y])
  }
  const eyes = []
  if (openEyes)
    for (const s of [-1, 1]) {
      const x = cx + s * rx * 0.805,
        y = topAt(x) - 1.23,
        ww = rx * 0.084,
        hh = 0.63
      const outline = []
      for (let i = 0; i < 16; i++)
        outline.push([x + ww * Math.cos((i * tau) / 16), y + hh * Math.sin((i * tau) / 16)])
      eyes.push(outline)
    }
  for (const side of [-1, 1]) {
    const z = side * half
    polygonFace(b, m.reachBridgeStone, border, eyes, z, [0.87, 0.94, 0.93])
    for (let k = 0; k < n; k++) {
      const t = (Math.PI * (k + 0.028)) / n,
        u = (Math.PI * (k + 0.972)) / n,
        key = k === (n - 1) / 2
      const band = 0.46,
        outer = side * (half + 0.12 + (key ? 0.087 : 0)),
        wid = band + (key ? 0.18 : 0)
      b.face(
        m.coping,
        [point(t, outer), point(u, outer), point(u, outer, wid), point(t, outer, wid)],
        0.79 + (0.2 * ((k * 7) % 13)) / 12
      )
      b.face(m.foundation, [point(t, outer), point(u, outer), point(u, z), point(t, z)], 0.81)
      if (k % 3 === 1)
        ribbon(
          b,
          m.bronze,
          point(t, outer + side * 0.017, wid * 0.72),
          point(u, outer + side * 0.017, wid * 0.72),
          0.033,
          0.81
        )
    }
    for (const hole of eyes) {
      const x = hole.reduce((sum, p) => sum + p[0], 0) / hole.length,
        y = hole.reduce((sum, p) => sum + p[1], 0) / hole.length
      for (let i = 0; i < hole.length; i++) {
        const v = hole[i],
          q = hole[(i + 1) % hole.length],
          zz = side * (half + 0.065)
        const p = (o, t) => [x + (o[0] - x) * t, y + (o[1] - y) * t, zz]
        b.face(m.coping, [p(v, 1), p(q, 1), p(q, 1.24), p(v, 1.24)], 0.88)
        if (side === 1)
          b.face(
            m.foundation,
            [
              [v[0], v[1], half],
              [q[0], q[1], half],
              [q[0], q[1], -half],
              [v[0], v[1], -half]
            ],
            0.71
          )
      }
    }
  }
  for (let k = 0; k < n; k++) {
    const t = (Math.PI * k) / n,
      u = (Math.PI * (k + 1)) / n
    b.face(m.foundation, [point(t, half), point(u, half), point(u, -half), point(t, -half)], 0.78)
    for (let j = 0; j < 4; j++) {
      const z = -half + (j * w) / 4 + 0.015,
        zz = z + w / 4 - 0.03
      b.face(
        m.stone,
        [
          point(t + 0.001, z, -0.015),
          point(u - 0.001, z, -0.015),
          point(u - 0.001, zz, -0.015),
          point(t + 0.001, zz, -0.015)
        ],
        0.79 + (0.16 * ((k + 3 * j) % 7)) / 6
      )
    }
  }
}
function wovenArch(b, m, world, profile, a, c, spring, crown, w) {
  const n = 10
  const pt = (t, z, dy = 0) => [mix(a, c, t), spring + (crown - spring) * 4 * t * (1 - t) + dy, z]
  for (const z of [-w / 2, 0, w / 2]) {
    for (let i = 0; i < n; i++) {
      const t = i / n,
        u = (i + 1) / n,
        p = pt(t, z),
        q = pt(u, z)
      b.beam(m.timber, p, q, 0.38, 0.63, 0.89)
      b.beam(m.wood, pt(t, z, -0.52), pt(u, z, -0.52), 0.42, 0.27, 0.84)
      if (Math.abs(z) > 0.1) {
        const y = grade(profile, p[0]) - 0.36
        b.beam(m.darkwood, p, [p[0], y, z], 0.28, 0.31, 0.88)
        const high = grade(profile, q[0]) - 0.39
        if (y - p[1] > 0.93 || high - q[1] > 0.93)
          b.beam(m.wood, i < n / 2 ? p : q, i < n / 2 ? [q[0], high, z] : [p[0], y, z], 0.19, 0.27, 0.85)
        hardware(b, m, p[0], p[1], z + Math.sign(z) * 0.22, 0.22, 0.84)
        const side = Math.sign(z)
        ribbon(b, m.patina, pt(t, z + side * 0.208, -0.43), pt(u, z + side * 0.208, -0.43), 0.117, 0.96)
        if (i === 2 || i === 8) {
          b.beam(m.timber, p, [p[0], p[1] + 0.06, z + side * 0.76], 0.125, 0.137, 0.9)
          b.tube(
            m.bronze,
            [p[0], p[1] + 0.06, z + side * 0.66],
            [p[0], p[1] - 0.49, z + side * 0.66],
            0.037,
            0.037,
            5,
            0.85,
            false
          )
          surveyLamp(b, m, world, p[0], p[1] - 0.89, z + side * 0.66, i === 2 ? 'amber' : 'needle', 1.12)
        }
      }
      if (z === 0 && i % 2 === 0)
        b.beam(m.darkwood, pt(t, -w / 2 - 0.17, -0.2), pt(t, w / 2 + 0.17, -0.2), 0.37, 0.35)
    }
  }
}
function footApproach(b, m, world) {
  const way = reachBridgeRoutes.foot
  b.at(way.a[0], 0, way.a[1], way.yaw, () => {
    floorRun(b, m, -1.5, 0.014, 1.35, 1.35, 0, 2.74, false, m.coping)
    floorRun(b, m, 0, way.length, 1.35, turnLevel, 39, 2.67, true, m.coping)
    for (const x of [3.3, 6.57, 10.15])
      for (const d of [-1, 1]) {
        const y = mix(1.35, turnLevel, x / way.length)
        b.box(m.foundation, x, (1.3 + y - 0.31) / 2, d * 0.99, 0.41, y - 0.31 - 1.3, 0.43, 0.83)
      }
    pole(b, m, world, 1.1, 1.94, 1.31, 1, true)
  })
  b.box(m.coping, 59.3, turnLevel - 0.105, 39.06, 3.47, 0.21, 2.88)
  b.box(m.foundation, 59.3, turnLevel - 0.37, 39.06, 3.39, 0.37, 2.82, 0.8)
  for (const [x, z] of [
    [58.08, 38.07],
    [58.08, 40.03],
    [60.52, 38.07]
  ])
    pier(b, m, x, z, 1.27, turnLevel - 0.47, 0.52, 0.6)
  b.beam(m.timber, [60.52, turnLevel - 1.54, 38.13], [60.52, turnLevel - 0.43, 40.18], 0.25, 0.26, 0.9)
  b.at(59.3, 0, 37.68, 0, () => rail(b, m, -1.6, 1.58, turnLevel, turnLevel, 0, 'stone'))
  b.at(57.64, 0, 39.05, Math.PI / 2, () => rail(b, m, -1.29, 1.29, turnLevel, turnLevel, 0, 'stone'))
}
function eastBridge(b, m, world) {
  const route = reachBridgeRoutes.east
  b.at(route.a[0], 0, route.a[1], route.yaw, () => {
    const openings = [
      [16.82, 24.03],
      [25.91, 35.56]
    ]
    for (const [a, c, y, yy, n] of east)
      floorRun(b, m, a, c, y, yy, n, 3.68, openings, n ? m.coping : m.wood)
    // The outer side cantilevers across the older switchback and its stone lantern.
    for (const s of [3, 6.5, 9.9, 13.1]) {
      const [x, wz] = route.point(s, -1.43),
        base = terraceHeight(x, wz) ?? 2.0,
        h = grade(east, s) - 0.43
      if (h - base > 0.08) pier(b, m, s, -1.43, base - 0.1, h, 0.56, 0.65)
      b.beam(m.darkwood, [s, h, -1.65], [s, h, 1.8], 0.27, 0.34, 0.86)
      b.beam(m.timber, [s, h - 0.93, -1.33], [s, h - 0.12, 0.7], 0.22, 0.23, 0.88)
    }
    stoneArch(b, m, east, 15.4, 37.7, 1.0, 10.65, 3.37)
    stoneArch(b, m, east, 39.73, 49.8, -0.65, 6.91, 3.24, false)
    for (const [s, w, deck] of [
      [15.6, 1.63, grade(east, 15.6) - 0.43],
      [38.7, 2.22, grade(east, 38.7) - 0.43],
      [50.45, 1.47, 8.62]
    ])
      pier(b, m, s, 0, s < 20 ? 6.3 : -24, deck, w, 4.73)
    for (const d of [-1, 1])
      for (const [i, x] of [8.6, 13.17, 36.12, 42.14, 48.4].entries())
        pole(b, m, world, x, grade(east, x), d * 1.78, i + d)
    gallery(b, m, world, 16.82, 24.03, eastTop, 3.68, 0)
    bridgeRoom(b, m, world, 30.735, eastTop, 3.68, false)
  })
}
function northBridge(b, m, world) {
  const route = reachBridgeRoutes.north,
    w = 4.73
  b.at(route.a[0], 0, route.a[1], route.yaw, () => {
    const openings = [
      [17.15, 30.12],
      [65.95, 76.97]
    ]
    for (const [a, c, y, yy, n] of north)
      floorRun(b, m, a, c, y, yy, n, w, openings, n ? m.coping : m.wood)
    for (const [a, c, spring, crown] of [
      [1.1, 29.87, 27.25, 36.54],
      [32.12, 68.98, 26.05, 40.19],
      [71.28, 94.5, 29.33, 41.13]
    ])
      wovenArch(b, m, world, north, a, c, spring, crown, w - 0.49)
    for (const [x, ww, spring] of [
      [0.6, 2.15, 27.55],
      [31, 3.18, 27.27],
      [70.15, 3.0, 29.51],
      [94.76, 2.17, 29.63]
    ]) {
      pier(b, m, x, 0, -28, spring + 0.42, ww, 6.01)
      for (const d of [-1, 1]) {
        const z = d * (w / 2 - 0.26),
          y = grade(north, x) - 0.35
        b.box(m.darkwood, x, (spring + y) / 2, z, 0.47, y - spring, 0.46, 0.87)
        for (const side of [-1, 1])
          b.beam(m.timber, [x, spring + 1.65, z], [x + side * 2.35, y - 0.1, z], 0.261, 0.365, 0.87)
        if (x > 1 && x < 94) {
          const end = d * 3.51,
            ly = spring - 2
          b.box(m.patina, x, ly + 0.69, end, 1.02, 0.23, 0.72, 0.92)
          b.beam(
            m.timber,
            [x, ly - 0.09, end - d * 0.45],
            [x, ly + 0.63, end + d * 0.31],
            0.21,
            0.27,
            0.85
          )
          surveyLamp(b, m, world, x, ly - 0.06, end + d * 0.47, 'amber', 1.34)
        }
      }
    }
    for (const d of [-1, 1])
      for (const [i, x] of [3.7, 12.5, 31.0, 41.6, 54.8, 63.55, 79.5, 91.0].entries())
        pole(b, m, world, x, grade(north, x), d * (w / 2 - 0.08), i + 1)
    gallery(b, m, world, 17.15, 30.12, northTop, w, 1)
    bridgeRoom(b, m, world, 71.46, northLanding, w, true)
  })
}
function portLanding(b, m, x, z, y, w, d) {
  b.box(m.wood, x, y - 0.1, z, w, 0.2, d, 0.89)
  b.box(m.darkwood, x, y - 0.31, z, w - 0.06, 0.23, d - 0.1, 0.81)
}
function returnStair(b, m, world) {
  // Wharf-side steps double back twice under the hoist. People at river level
  // can unload alongside the baskets and climb to either market street.
  const flights = [
    [25.48, 3.04, 15.28, 8, 0.47, 43],
    [28.37, 15.29, 3.03, 0.47, -7.08, 43],
    [31.22, 3.03, 15.28, -7.08, -14.77, 44]
  ]
  b.at(25.48, 0, 1.39, -Math.PI / 2, () =>
    floorRun(b, m, 0, reachWharfOffset + 0.05, 8, 8, 0, 2.12, true)
  )
  b.at(0, 0, reachWharfOffset, 0, () => {
    portLanding(b, m, 25.48, 2.22, 8, 2.12, 1.68)
    for (const [x, z0, z1, y0, y1, steps] of flights) {
      const sign = Math.sign(z1 - z0),
        len = Math.abs(z1 - z0)
      b.at(x, 0, z0, (-sign * Math.PI) / 2, () => {
        floorRun(b, m, 0, len, y0, y1, steps, 2.07, true, m.wood)
        for (const t of [0.24, 0.71]) {
          const xx = len * t,
            yy = mix(y0, y1, t)
          for (const side of [-1, 1]) {
            const z = side * 0.83
            b.tube(m.darkwood, [xx, -19.65, z], [xx, yy - 0.31, z], 0.147, 0.111, 6, 0.87, false)
            b.beam(m.teal, [xx, yy - 1.62, z], [xx + 1.17, yy - 0.94, z], 0.094, 0.142, 0.84)
          }
        }
      })
    }
    for (const [x, z, y, w, d] of [
      [26.925, 16.18, 0.47, 5.05, 1.98],
      [29.79, 2.11, -7.08, 4.96, 2.08]
    ]) {
      portLanding(b, m, x, z, y, w, d)
      rail(b, m, x - w / 2 + 0.04, x + w / 2 - 0.04, y, y, z + (z > 10 ? 1 : -1) * (d / 2 - 0.06))
      pole(b, m, world, x, z > 10 ? y : y - 0.02, z + (z > 10 ? 1 : -1) * 0.91, 2, true)
    }
    const x = 30.2,
      z = 17.65,
      top = -14.77
    portLanding(b, m, x, z, top, 7.6, 4.98)
    for (let k = 0; k < 16; k++)
      b.box(m.timber, x - 3.65 + k * 0.48, top + 0.004, z, 0.024, 0.009, 4.9, 0.78)
    for (const xx of [x - 3.48, x, x + 3.42])
      for (const dz of [-2.18, 2.18]) {
        b.tube(m.darkwood, [xx, -20.43, z + dz], [xx, top + 0.41, z + dz], 0.167, 0.129, 8, 0.8)
        b.tube(m.rope, [xx, top + 0.22, z + dz], [xx, top + 0.37, z + dz], 0.148, 0.138, 8, 0.92, false)
      }
    pole(b, m, world, x - 3.28, top, z - 1.94, 1)
    for (let i = 0; i < 3; i++) {
      const xx = x - 2.32 + i * 0.67
      b.tube(
        m.reed,
        [xx, top + 0.01, z - 0.85],
        [xx, top + 0.72, z - 0.85],
        0.27,
        0.33,
        9,
        0.81 + i * 0.05
      )
      b.tube(
        m.rope,
        [xx, top + 0.51, z - 0.85],
        [xx, top + 0.66, z - 0.85],
        0.335,
        0.333,
        9,
        0.84,
        false
      )
    }
  })
}
function pulley(b, m, x, y, z, r) {
  const ring = (i, w, d) => [x + w * Math.cos((i * tau) / 20), y + w * Math.sin((i * tau) / 20), z + d]
  for (let i = 0; i < 20; i++) {
    b.face(
      m.bronze,
      [ring(i, r, 0), ring(i + 1, r, 0), ring(i + 1, r - 0.103, 0.012), ring(i, r - 0.103, 0.012)],
      0.9
    )
    b.face(
      m.patina,
      [ring(i, r, -0.145), ring(i + 1, r, -0.145), ring(i + 1, r, 0), ring(i, r, 0)],
      0.82
    )
  }
  b.tube(m.bronze, [x, y, z - 0.31], [x, y, z + 0.11], 0.16, 0.13, 8, 0.87)
  for (let i = 0; i < 4; i++)
    b.beam(m.wood, ring(i * 2.5, r - 0.07, -0.035), ring(i * 2.5 + 10, r - 0.07, -0.035), 0.1, 0.105)
}
function sluice(b, m, world) {
  const roadWidth = 3.07,
    base = 8
  const profile = [
    [0, 2.84, 9, 9, 0],
    [2.84, 6.58, 9, 8, 6],
    [6.58, port.length, 8, 8, 0]
  ]
  for (const [stub, y] of [
    [portNorth, 9],
    [portSouth, 8]
  ]) {
    b.at(stub.a[0], 0, stub.a[1], stub.yaw, () => {
      floorRun(
        b,
        m,
        0,
        stub.length,
        y,
        y,
        0,
        roadWidth,
        [
          [0, 0.83],
          [stub.length - 1.98, stub.length]
        ],
        m.coping
      )
      for (const s of [6.54, stub.length - 2.29])
        for (const d of [-1, 1]) {
          b.tube(m.darkwood, [s, -20.6, d * 1.08], [s, y - 0.26, d * 1.08], 0.22, 0.177, 8, 0.85, false)
          b.beam(m.timber, [s, y - 2.21, d * 1.08], [s + 1.34, y - 0.31, d * 1.08], 0.18, 0.21, 0.93)
        }
      pole(b, m, world, 4.1, y, 1.41, 3, true)
    })
    b.box(m.wood, stub.c[0], y - 0.113, stub.c[1], 3.58, 0.225, 3.6, 0.91)
  }
  b.at(port.a[0], 0, port.a[1], port.yaw, () => {
    for (const [a, c, l, h, n] of profile)
      floorRun(
        b,
        m,
        a,
        c,
        l,
        h,
        n,
        roadWidth,
        [
          [0, 1.94],
          [24.4, 26.56],
          [port.length - 1.97, port.length]
        ],
        n ? m.coping : m.wood
      )
    stoneArch(b, m, profile, 10.72, 23.19, -3.27, 5.78, 2.8, false)
    for (const [x, ww] of [
      [2.02, 1.48],
      [9.97, 1.83],
      [24.02, 1.96],
      [port.length - 0.57, 1.36]
    ])
      pier(b, m, x, 0, -22.77, grade(profile, x) - 0.38, ww, 3.95)
    // The raised gate leaves the navigation opening free from the river up
    // to the underside of its bottom rail. Two reeved drums share one canopy.
    const left = 11.66,
      right = 22.25,
      z = -1.91
    for (let x = left; x < right; x += 0.48) {
      const end = Math.min(right, x + 0.46)
      b.box(
        m.timber,
        (x + end) / 2,
        2.97,
        z,
        end - x,
        3.21,
        0.18,
        0.78 + 0.14 * ((Math.round(x * 9) % 5) / 4)
      )
    }
    for (const y of [1.38, 3.1, 4.55])
      b.box(m.darkwood, (left + right) / 2, y, z - 0.1, right - left + 0.18, 0.17, 0.2, 0.92)
    for (const xx of [left + 0.38, right - 0.38]) {
      b.box(m.patina, xx, 4.85, z - 0.12, 0.2, 7.19, 0.22, 0.91)
      b.box(m.bronze, xx, 1.42, z - 0.25, 0.5, 0.21, 0.12, 0.9)
    }
    for (const xx of [12.35, 21.54]) {
      b.at(xx, 0, z, 0, () => {
        post(b, m, 0, base, 0, 3.17)
        b.beam(m.timber, [0, base - 0.65, 0.17], [0, base - 0.12, -1.05], 0.21, 0.27)
        b.box(m.patina, 0, base + 2.32, -0.51, 0.5, 0.36, 1.0, 0.91)
        pulley(b, m, 0, base + 2.48, -1.03, 0.69)
        for (const dx of [-0.53, 0.53])
          b.tube(m.rope, [dx, 4.43, -0.12], [dx, base + 2.25, -1.0], 0.037, 0.041, 6, 0.87, false)
        surveyLamp(b, m, world, 0.38, base + 1.54, -0.24, 'amber', 0.87)
      })
    }
    canopy(b, m, (left + right) / 2, base + 3.21, z - 0.32, right - left + 2.88, 2.6, 1.08, 0.35, m.roof)
    b.box(m.darkwood, (left + right) / 2, base + 2.77, z - 0.33, right - left + 0.28, 0.3, 0.34, 0.88)
    plaque(b, m, (left + right) / 2, base + 2.36, z - 0.59, 2.15, 0.54, 4)
    for (const x of [4.16, 8.15, 27.22]) pole(b, m, world, x, grade(profile, x), -1.48, 3, true)
    returnStair(b, m, world)
  })
}
export function reachBridges(b, m, world) {
  signs(m)
  footApproach(b, m, world)
  eastBridge(b, m, world)
  northBridge(b, m, world)
  sluice(b, m, world)
}
