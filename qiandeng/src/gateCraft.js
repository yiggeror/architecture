import * as T from 'three'
import { generator } from './mesh.js'

const tau = 2 * Math.PI
const atlas = {
  drum: [4, 4, 508, 508],
  front: [4, 526, 506, 140],
  rear: [4, 679, 506, 140],
  tide: [525, 4, 238, 664],
  fire: [777, 4, 238, 664],
  tideChart: [524, 686, 491, 326],
}
function decalUV(region, u, v) {
  const [x, y, w, h] = region
  return [(x + w * u) / 1024, 1 - (y + (1 - v) * h) / 1024]
}

// The slim decorative strips run into their surrounding rails at both ends.
// Both faces are modelled; hidden end caps would be buried in the joinery.
export function raisedFret(b, mat, a, c, width, depth = 0.05, tint = 1) {
  const dx = c[0] - a[0],
    dy = c[1] - a[1],
    len = Math.hypot(dx, dy) || 1
  const ox = (-dy * width) / (2 * len),
    oy = (dx * width) / (2 * len)
  for (const sign of [-1, 1]) {
    const dz = (sign * depth) / 2
    b.face(
      mat,
      [
        [a[0] + ox, a[1] + oy, a[2] + dz],
        [c[0] + ox, c[1] + oy, c[2] + dz],
        [c[0] - ox, c[1] - oy, c[2] + dz],
        [a[0] - ox, a[1] - oy, a[2] + dz],
      ],
      tint
    )
  }
}

// Faceted court silk with a stitched ridge. One physical shade corresponds to
// each point used by the festival's local lighting field.
export function smallShade(b, m, x, y, z, r, h, red = false) {
  const n = 8,
    fabric = red ? m.redSilk : m.lantern
  const profile = [
    [0.63, -0.49],
    [1, -0.19],
    [0.97, 0.24],
    [0.61, 0.49],
  ]
  for (let j = 1; j < profile.length; j++)
    b.tube(
      fabric,
      [x, y + h * profile[j - 1][1], z],
      [x, y + h * profile[j][1], z],
      r * profile[j - 1][0],
      r * profile[j][0],
      n,
      1,
      false
    )
  for (const s of [-1, 1])
    b.tube(
      m.bronze,
      [x, y + s * h * 0.49 - 0.021, z],
      [x, y + s * h * 0.49 + 0.021, z],
      r * 0.7,
      r * 0.7,
      6,
      0.94,
      false
    )
  b.tube(m.vermilion, [x, y - h * 0.77, z], [x, y - h * 0.5, z], r * 0.079, r * 0.14, 5, 0.9, false)
}

export function gateFinish(m) {
  const surface = new T.MeshStandardMaterial({
    name: 'gatePaint',
    color: 0xfff1d4,
    roughness: 0.64,
    emissive: 0xffb375,
    emissiveIntensity: 0.21,
    side: T.DoubleSide,
    vertexColors: true,
  })
  m.gatePaint = surface
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (!c) return
  c.width = c.height = 1024
  const g = c.getContext('2d'),
    random = generator(6319)
  g.fillStyle = '#584a39'
  g.fillRect(0, 0, c.width, c.height)
  const [x, y, w, h] = atlas.drum,
    dx = x + w / 2,
    dy = y + h / 2
  const skin = g.createRadialGradient(dx - 50, dy - 62, 4, dx, dy, w * 0.51)
  skin.addColorStop(0, '#dcc994')
  skin.addColorStop(0.65, '#ceac75')
  skin.addColorStop(1, '#aa805b')
  g.fillStyle = skin
  g.fillRect(x, y, w, h)
  for (let j = 0; j < 9000; j++) {
    g.fillStyle = j % 2 ? '#7c5d3e20' : '#f5db9f2c'
    g.fillRect(x + random() * w, y + random() * h, 0.8 + random() * 2, 0.8 + random() * 2.8)
  }
  function circle(r, col, width) {
    g.beginPath()
    g.arc(dx, dy, r, 0, tau)
    g.lineWidth = width
    g.strokeStyle = col
    g.stroke()
  }
  for (const [r, col, p] of [
    [238, '#763d30', 5],
    [232, '#c09553', 2],
    [214, '#616c54', 2],
    [204, '#a17a47', 3],
  ])
    circle(r, col, p)
  for (let j = 0; j < 80; j++) {
    const a = (j * tau) / 80
    g.beginPath()
    g.moveTo(dx + 220 * Math.cos(a), dy + 220 * Math.sin(a))
    g.lineTo(dx + 228 * Math.cos(a + 0.016), dy + 228 * Math.sin(a + 0.016))
    g.strokeStyle = '#947249'
    g.lineWidth = 2
    g.stroke()
  }
  for (let j = 0; j < 12; j++) {
    g.save()
    g.translate(dx, dy)
    g.rotate((tau * j) / 12 + 0.08)
    g.strokeStyle = j % 2 ? '#8c997a' : '#a78b60'
    for (let k = 0; k < 3; k++) {
      const y = -172 - 4 * k
      g.beginPath()
      g.moveTo(-31, y + 8)
      g.bezierCurveTo(-18, y + 5, -13, y - 10, 0, y - 9)
      g.bezierCurveTo(10, y - 8, 12, y + 1, 6, y + 3)
      g.quadraticCurveTo(17, y + 5, 32, y - 8)
      g.lineWidth = k === 0 ? 1.75 : 0.9
      g.stroke()
    }
    g.restore()
  }
  // Two river carp circle a burnished pearl. Local brushwork and translucent
  // scales read both on the far city silhouette and on the drum balcony.
  for (let j = 0; j < 2; j++) {
    g.save()
    g.translate(dx, dy)
    g.rotate(j * Math.PI - 0.21)
    g.beginPath()
    g.moveTo(-28, -123)
    g.bezierCurveTo(-1, -132, 16, -155, 41, -139)
    g.bezierCurveTo(54, -134, 64, -121, 78, -103)
    g.quadraticCurveTo(54, -110, 46, -84)
    g.fillStyle = j ? '#6a8473' : '#b77854'
    g.fill()
    g.strokeStyle = j ? '#47655c' : '#8d533a'
    g.lineWidth = 1.7
    g.stroke()
    for (let k = 0; k < 8; k++) {
      g.beginPath()
      g.moveTo(-19 + k * 9, -120 + 0.9 * k)
      g.quadraticCurveTo(3 + k * 8, -142 + k * 0.9, 12 + k * 8, -141 + 2.6 * k)
      g.strokeStyle = '#c5ac75'
      g.lineWidth = 1.1
      g.stroke()
    }
    g.beginPath()
    g.moveTo(-91, -118)
    g.bezierCurveTo(-34, -164, 56, -122, 77, -69)
    g.bezierCurveTo(94, -33, 87, -6, 90, 18)
    g.bezierCurveTo(119, 23, 132, 8, 153, 12)
    g.bezierCurveTo(138, 32, 137, 51, 107, 55)
    g.bezierCurveTo(115, 75, 117, 87, 107, 100)
    g.bezierCurveTo(94, 80, 69, 79, 66, 50)
    g.bezierCurveTo(58, 32, 72, 11, 56, -12)
    g.bezierCurveTo(30, -48, -1, -38, -35, -48)
    g.bezierCurveTo(-72, -60, -106, -85, -96, -101)
    g.closePath()
    const wash = g.createLinearGradient(0, -135, 30, -16)
    wash.addColorStop(0, j ? '#3b5a54' : '#894937')
    wash.addColorStop(0.41, j ? '#607968' : '#b26c4a')
    wash.addColorStop(0.72, j ? '#809478' : '#c58a59')
    wash.addColorStop(1, j ? '#829177' : '#a9684b')
    g.fillStyle = wash
    g.fill()
    g.lineWidth = 3
    g.strokeStyle = j ? '#344e49' : '#7c4935'
    g.stroke()
    g.save()
    g.clip()
    for (let row = 0; row < 11; row++)
      for (let k = 0; k < 12; k++) {
        const xx = -39 + k * 12 + (row % 2) * 5.6 + row * 1.4,
          yy = -133 + row * 10 + k * 4.6
        if (xx < -41 + 0.29 * (yy + 133)) continue
        g.beginPath()
        g.moveTo(xx - 5, yy - 0.9)
        g.bezierCurveTo(xx - 4, yy + 6, xx + 3, yy + 9, xx + 7, yy + 4)
        g.strokeStyle = (row + k) % 4 ? '#dfc68b91' : '#f1dba68f'
        g.lineWidth = 1.15
        g.stroke()
      }
    for (let k = 0; k < 140; k++) {
      g.fillStyle = k % 2 ? '#e6c68c37' : '#4f59462a'
      g.fillRect(-83 + random() * 194, -131 + random() * 211, 1.2 + 3.1 * random(), 1.1)
    }
    g.restore()
    g.beginPath()
    g.moveTo(-15, -112)
    g.quadraticCurveTo(-30, -74, -65, -71)
    g.strokeStyle = '#d8b777'
    g.stroke()
    g.beginPath()
    g.moveTo(-32, -66)
    g.bezierCurveTo(-28, -42, -18, -30, 2, -26)
    g.bezierCurveTo(5, -36, 10, -42, 15, -44)
    g.quadraticCurveTo(-10, -47, -18, -71)
    g.fillStyle = j ? '#728771' : '#b48359'
    g.fill()
    g.lineWidth = 1.7
    g.strokeStyle = j ? '#465f55' : '#865039'
    g.stroke()
    for (let k = 0; k < 5; k++) {
      g.beginPath()
      g.moveTo(-24, -61)
      g.quadraticCurveTo(-20 + k * 2, -42 + k * 0.5, -4 + k * 4, -30 - k * 3)
      g.strokeStyle = '#c7ad73'
      g.lineWidth = 0.98
      g.stroke()
    }
    for (const [tx, ty] of [
      [147, 15],
      [137, 28],
      [124, 42],
      [106, 53],
      [110, 75],
      [106, 92],
    ]) {
      g.beginPath()
      g.moveTo(79, 24)
      g.quadraticCurveTo(89, 48, tx, ty)
      g.strokeStyle = '#d0ae75'
      g.lineWidth = 1.26
      g.stroke()
    }
    g.fillStyle = '#efe1b2'
    g.beginPath()
    g.arc(-75, -105, 7, 0, tau)
    g.fill()
    g.fillStyle = '#443f32'
    g.beginPath()
    g.arc(-77, -105, 3.7, 0, tau)
    g.fill()
    g.strokeStyle = '#88734b'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(-93, -95)
    g.quadraticCurveTo(-131, -93, -129, -66)
    g.stroke()
    g.beginPath()
    g.moveTo(-92, -98)
    g.quadraticCurveTo(-123, -106, -136, -86)
    g.stroke()
    g.beginPath()
    g.moveTo(-96, -101)
    g.quadraticCurveTo(-87, -94, -78, -95)
    g.stroke()
    g.restore()
  }
  circle(27, '#86553e', 4)
  circle(19, '#c29a64', 2)
  for (const [key, text] of [
    ['front', '水关横阙'],
    ['rear', '千灯古津'],
  ]) {
    const [x, y, w, h] = atlas[key]
    const back = g.createLinearGradient(0, y, 0, y + h)
    back.addColorStop(0, '#183b3c')
    back.addColorStop(0.5, '#274a48')
    back.addColorStop(1, '#142e32')
    g.fillStyle = back
    g.fillRect(x, y, w, h)
    g.strokeStyle = '#c79b53'
    g.lineWidth = 4
    g.strokeRect(x + 6, y + 6, w - 12, h - 12)
    g.strokeStyle = '#6c8979'
    g.lineWidth = 1.5
    g.strokeRect(x + 14, y + 13, w - 28, h - 26)
    g.font = 'bold 80px "Noto Serif CJK SC","Songti SC",serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (const [i, ch] of Array.from(text).entries()) {
      const xx = x + (w * (i + 0.5)) / 4
      g.fillStyle = '#1f2824'
      g.fillText(ch, xx + 2, y + h / 2 + 5)
      g.fillStyle = '#e8ce8a'
      g.fillText(ch, xx, y + h / 2 + 2)
    }
  }
  for (const [key, text] of [
    ['tide', '潮生万象'],
    ['fire', '灯照千江'],
  ]) {
    const [x, y, w, h] = atlas[key],
      blue = key === 'tide'
    g.save()
    g.beginPath()
    g.rect(x, y, w, h)
    g.clip()
    const silk = g.createLinearGradient(x, y, x + w, y)
    silk.addColorStop(0, blue ? '#354e50' : '#874538')
    silk.addColorStop(0.35, blue ? '#5b7770' : '#c17250')
    silk.addColorStop(0.7, blue ? '#3f605d' : '#964f40')
    silk.addColorStop(1, blue ? '#57746b' : '#b76950')
    g.fillStyle = silk
    g.fillRect(x, y, w, h)
    for (let j = 2; j < w; j += 4) {
      g.fillStyle = j % 3 ? '#e4c9991d' : '#392e2620'
      g.fillRect(x + j, y, 1, h)
    }
    g.strokeStyle = '#d0aa67'
    g.lineWidth = 3
    g.strokeRect(x + 12, y + 10, w - 24, h - 20)
    g.lineWidth = 1.2
    g.strokeRect(x + 19, y + 18, w - 38, h - 36)
    for (let k = 0; k < 4; k++) {
      const cy = y + 66 + (k * (h - 126)) / 3
      g.beginPath()
      g.moveTo(x + 25, cy)
      g.lineTo(x + w / 2, cy - 42)
      g.lineTo(x + w - 25, cy)
      g.lineTo(x + w / 2, cy + 42)
      g.closePath()
      g.strokeStyle = '#d1ad6c74'
      g.stroke()
    }
    g.font = 'bold 68px "Noto Serif CJK SC","Songti SC",serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (const [i, ch] of Array.from(text).entries()) {
      const yy = y + h * (0.22 + i * 0.178)
      g.fillStyle = '#503e32'
      g.fillText(ch, x + w / 2 + 1.5, yy + 2)
      g.fillStyle = '#efcf8d'
      g.fillText(ch, x + w / 2, yy)
    }
    g.restore()
  }
  const [ax, ay, aw, ah] = atlas.tideChart
  g.fillStyle = '#d8c69c'
  g.fillRect(ax, ay, aw, ah)
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = i % 2 ? '#967d5521' : '#fff3bf34'
    g.fillRect(ax + random() * aw, ay + random() * ah, 1.3, 0.8)
  }
  g.lineWidth = 3
  g.strokeStyle = '#ab7151'
  g.strokeRect(ax + 14, ay + 13, aw - 28, ah - 26)
  for (let j = 0; j < 6; j++) {
    const cy = ay + 44 + j * 39
    g.strokeStyle = j % 2 ? '#737e66' : '#9b8469'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(ax + 36, cy)
    for (let k = 1; k <= 30; k++)
      g.lineTo(ax + 36 + k * 12, cy + 12 * Math.sin(k * 0.29 + j * 0.41) + 5 * Math.sin(k * 0.6 - j))
    g.stroke()
  }
  g.font = '22px "Noto Serif CJK SC","Songti SC",serif'
  g.fillStyle = '#5c5747'
  for (const [i, ch] of Array.from('江潮时刻').entries()) g.fillText(ch, ax + aw - 44, ay + 60 + i * 40)
  const map = new T.CanvasTexture(c)
  map.colorSpace = T.SRGBColorSpace
  map.anisotropy = 4
  surface.map = surface.emissiveMap = map
}

export function sign(b, m, x, y, z, width, height, back = false) {
  const region = back ? atlas.rear : atlas.front,
    w = width / 2,
    h = height / 2
  b.box(m.darkwood, x, y, z, width + 0.14, height + 0.12, 0.12)
  b.box(m.bronze, x, y, z + 0.07, width + 0.032, height + 0.035, 0.035)
  b.face(
    m.gatePaint,
    [
      [x - w, y - h, z + 0.094],
      [x + w, y - h, z + 0.094],
      [x + w, y + h, z + 0.094],
      [x - w, y + h, z + 0.094],
    ],
    1,
    [decalUV(region, 0, 0), decalUV(region, 1, 0), decalUV(region, 1, 1), decalUV(region, 0, 1)]
  )
}
export function streamer(b, m, x, top, z, w, h, type) {
  const region = atlas[type],
    cols = 4,
    rows = 12
  const pt = (u, v) => [
    x + (u - 0.5) * w + 0.12 * v * Math.sin(v * 4.7 + 0.6),
    top - v * h + v ** 9 * 0.21 * Math.abs(2 * u - 1),
    z + 0.16 * Math.sin(u * 6.2 + v * 4.77) * (0.18 + 0.82 * v) - 0.06 * Math.cos(v * 7 - 1),
  ]
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const u = i / cols,
        uu = (i + 1) / cols,
        v = j / rows,
        vv = (j + 1) / rows
      b.face(m.gatePaint, [pt(u, vv), pt(uu, vv), pt(uu, v), pt(u, v)], 1, [
        decalUV(region, u, 1 - vv),
        decalUV(region, uu, 1 - vv),
        decalUV(region, uu, 1 - v),
        decalUV(region, u, 1 - v),
      ])
    }
  b.tube(
    m.bronze,
    [x - w * 0.62, top + 0.025, z - 0.02],
    [x + w * 0.62, top + 0.025, z - 0.02],
    0.039,
    0.039,
    8
  )
  for (let i = 0; i <= 10; i++) {
    const p = pt(i / 10, 1)
    b.tube(m.bronze, p, [p[0] + 0.04, p[1] - 0.17 - (i % 2) * 0.054, p[2] + 0.016], 0.016, 0.006, 5)
  }
}

export function tideDrum(b, m, base) {
  const center = base + 1.84,
    sides = 28
  for (const side of [-1, 1]) {
    b.beam(m.darkwood, [side * 1.28, base + 0.05, -0.65], [side * 1.04, center, -0.12], 0.16, 0.17)
    b.beam(m.wood, [side * 1.26, base + 0.05, 0.56], [side * 1.04, center, 0.1], 0.14, 0.15)
    b.box(m.darkwood, side * 1.28, base + 0.052, -0.03, 0.24, 0.104, 1.43)
  }
  b.beam(m.wood, [-1.29, base + 0.47, -0.03], [1.29, base + 0.47, -0.03], 0.15, 0.15)
  for (const [ra, za, rb, zb] of [
    [1.06, -0.57, 1.19, -0.34],
    [1.19, -0.34, 1.23, 0],
    [1.23, 0, 1.19, 0.34],
    [1.19, 0.34, 1.06, 0.57],
  ])
    b.tube(m.vermilion, [0, center, za], [0, center, zb], ra, rb, sides, 0.77, false)
  for (const sign of [-1, 1]) {
    const z = sign * 0.58,
      zz = sign * 0.626
    b.tube(m.bronze, [0, center, z], [0, center, zz], 1.087, 1.079, sides, 0.86, false)
    const points = [],
      uv = []
    for (let i = 0; i < sides; i++) {
      const q = (tau * i) / sides,
        c = Math.cos(q),
        s = Math.sin(q)
      points.push([1.065 * c, center + 1.065 * s, zz + sign * 0.007])
      uv.push(decalUV(atlas.drum, 0.5 + 0.5 * c, 0.5 + 0.5 * s))
    }
    b.face(m.gatePaint, points, [0.88, 0.91, 0.87], uv)
    for (let i = 0; i < 18; i++) {
      const a = (tau * i) / 18,
        c = Math.cos(a),
        s = Math.sin(a)
      b.tube(
        m.bronze,
        [1.053 * c, center + 1.053 * s, zz],
        [1.053 * c, center + 1.053 * s, zz + sign * 0.034],
        0.022,
        0.015,
        5,
        0.99,
        false
      )
    }
  }
  for (const sign of [-1, 1]) {
    const a = [sign * 1.48, base + 0.03, 0.26],
      c = [sign * 1.21, base + 1.67, 0.36]
    b.tube(m.wood, a, c, 0.022, 0.033, 7)
    b.tube(m.redSilk, c, [c[0] - sign * 0.04, c[1] + 0.11, c[2]], 0.073, 0.09, 8)
  }
}

export function tideDesk(b, m, x, y, z) {
  b.box(m.darkwood, x, y + 0.82, z, 1.73, 0.1, 0.74)
  for (const s of [-1, 1])
    for (const t of [-1, 1])
      b.beam(
        m.wood,
        [x + s * 0.72, y + 0.022, z + t * 0.25],
        [x + s * 0.69, y + 0.79, z + t * 0.24],
        0.072,
        0.078
      )
  b.face(
    m.gatePaint,
    [
      [x - 0.62, y + 0.882, z + 0.248],
      [x + 0.36, y + 0.888, z + 0.248],
      [x + 0.36, y + 0.914, z - 0.25],
      [x - 0.62, y + 0.903, z - 0.25],
    ],
    1,
    [
      decalUV(atlas.tideChart, 0, 0),
      decalUV(atlas.tideChart, 1, 0),
      decalUV(atlas.tideChart, 1, 1),
      decalUV(atlas.tideChart, 0, 1),
    ]
  )
  b.box(m.ink, x + 0.59, y + 0.91, z, 0.21, 0.065, 0.157)
  b.beam(m.wood, [x + 0.43, y + 0.894, z + 0.22], [x + 0.7, y + 0.894, z + 0.17], 0.014, 0.019)
}
