import * as T from 'three'
import { generator } from './mesh.js'
import { drawLampSilk, paperLight } from './wardLampPaint.js'
import { wardAddresses } from './wardsLayout.js'

export const art = {
  fret: 8,
  panel: 9,
  stone: 10,
  plank: 11,
  redBrocade: 12,
  blueBrocade: 13,
  creamBrocade: 14,
  leafBrocade: 15,
  wave: 16,
  mountains: 17,
  peony: 18,
  crane: 19,
  slats: 20,
  papers: 21,
  shelves: 22,
  fish: 23,
  lanternRed: 24,
  lanternHoney: 25,
  lanternJade: 26,
  windowRound: 27,
  windowBamboo: 28,
  windowSmall: 29,
  windowBook: 30,
  oil: 31,
}
const cols = 8,
  patterns = 4
const signRows = Math.ceil(wardAddresses.length / cols)
const hues = ['#2b4140', '#763f38', '#293b49', '#493949', '#285651', '#493b32']
const sepia = '#c9a364'
function plate(g, w, h, col, title, tall = false) {
  g.fillStyle = col
  g.fillRect(0, 0, w, h)
  g.strokeStyle = '#75644c'
  g.lineWidth = 5
  g.strokeRect(4, 4, w - 8, h - 8)
  g.strokeStyle = '#ddbf7b'
  g.lineWidth = 1.5
  g.strokeRect(11, 11, w - 22, h - 22)
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      g.save()
      g.translate(sx === 1 ? 13 : w - 13, sy === 1 ? 13 : h - 13)
      g.scale(sx, sy)
      g.beginPath()
      g.moveTo(0, 16)
      g.lineTo(0, 0)
      g.lineTo(30, 0)
      g.lineTo(30, 6)
      g.lineTo(8, 6)
      g.lineTo(8, 14)
      g.lineTo(17, 14)
      g.stroke()
      g.restore()
    }
  g.fillStyle = '#ecd28a'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `bold ${tall ? 53 : 46}px "Noto Serif CJK SC", "Songti SC", SimSun, serif`
  const c = [...title]
  c.forEach((t, i) =>
    g.fillText(
      t,
      tall ? w * 0.49 : w * (0.5 + (i - (c.length - 1) / 2) * 0.18),
      tall ? h * (0.5 + (i - (c.length - 1) / 2) * 0.26) : h * 0.52
    )
  )
  g.fillStyle = '#a84e39'
  g.fillRect(w * 0.89, h * 0.69, w * 0.032, h * 0.125)
  g.strokeStyle = '#eabd89'
  g.lineWidth = 0.8
  g.strokeRect(w * 0.897, h * 0.704, w * 0.019, h * 0.095)
}
function lotus(g, x, y, r, fill, outline, n = 7) {
  g.save()
  g.translate(x, y)
  g.fillStyle = fill
  g.strokeStyle = outline
  g.lineWidth = 1.4
  for (let j = 0; j < n; j++) {
    g.rotate((2 * Math.PI) / n)
    g.beginPath()
    g.moveTo(0, -0.11 * r)
    g.bezierCurveTo(-0.3 * r, -0.4 * r, -0.23 * r, -0.76 * r, 0, -r)
    g.bezierCurveTo(0.24 * r, -0.77 * r, 0.31 * r, -0.44 * r, 0, -0.11 * r)
    g.fill()
    g.stroke()
  }
  g.fillStyle = outline
  g.beginPath()
  g.arc(0, 0, 0.13 * r, 0, Math.PI * 2)
  g.fill()
  g.restore()
}
function paper(g, id, lit = false) {
  const pairs = [
    ['#7b4d35', '#f3cd84'],
    ['#775037', '#ffe5a7'],
    ['#554c49', '#d2c5a1'],
    ['#7b4b39', '#edba85'],
    ['#71613e', '#edd8a1'],
    ['#7c5046', '#e2a87d'],
    ['#615641', '#e6c389'],
    ['#7d5140', '#f3d295'],
  ]
  const k = id % 8,
    [shadow, warm] = pairs[k]
  if (lit) {
    g.save()
    g.scale(2, 2)
    paperLight(g, k)
    g.restore()
  } else {
    const gr = g.createRadialGradient(133, 150, 10, 120, 133, 185)
    gr.addColorStop(0, warm)
    gr.addColorStop(0.6, warm)
    gr.addColorStop(1, shadow)
    g.fillStyle = gr
    g.fillRect(0, 0, 256, 256)
  }
  g.strokeStyle = lit ? '#291b14' : '#4e3931'
  g.lineWidth = 8
  g.strokeRect(4, 4, 248, 248)
  g.strokeStyle = lit ? '#271b16' : '#53382c'
  g.lineWidth = 4.8
  const line = (x, y, X, Y) => {
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(X, Y)
    g.stroke()
  }
  for (let i = 0; i <= 4; i++) line(i * 64, 0, i * 64, 256)
  for (let i = 0; i <= 3; i++) {
    const x = i * 64
    if (k === 0 || k === 3) {
      for (const y of [42, 214]) line(x, y, x + 64, y)
      line(x, 126, x + 32, 48)
      line(x + 32, 48, x + 64, 126)
      line(x, 126, x + 32, 207)
      line(x + 32, 207, x + 64, 126)
    } else if (k === 1 || k === 6) {
      for (const y of [42, 88, 166, 211]) line(x, y, x + 64, y)
      for (const y of [0, 166]) line(x + 33, y, x + 33, y + 88)
    } else {
      line(x, 54, x + 64, 54)
      line(x, 198, x + 64, 198)
      line(x + 15, 54, x + 15, 80)
      line(x + 15, 80, x + 50, 80)
      line(x + 50, 80, x + 50, 54)
      line(x + 32, 80, x + 32, 175)
      line(x + 15, 175, x + 50, 175)
      line(x + 15, 175, x + 15, 198)
      line(x + 50, 175, x + 50, 198)
    }
  }
}
function brocade(g, index) {
  const colors = [
    ['#963f37', '#c28256', '#f2be77'],
    ['#294b62', '#587477', '#dcd5ac'],
    ['#d9c898', '#ad8e66', '#5c7270'],
    ['#49746b', '#81a08a', '#e5cf8f'],
  ]
  const [bg, stem, flower] = colors[index % 4]
  g.fillStyle = bg
  g.fillRect(0, 0, 256, 256)
  for (let j = -1; j < 5; j++)
    for (let i = -1; i < 5; i++) {
      const x = 32 + 61 * i + (j % 2) * 28,
        y = 25 + 56 * j
      lotus(g, x, y, 14 + ((i + j + 7) % 4), stem, flower, index % 2 ? 6 : 5)
      g.strokeStyle = stem
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(x + 8, y + 13)
      g.bezierCurveTo(x + 36, y + 8, x + 17, y + 39, x + 34, y + 43)
      g.stroke()
    }
  for (const x of [6, 11, 245, 250]) {
    g.fillStyle = flower
    g.fillRect(x, 0, 2, 256)
  }
}
function paintedTile(g, id, rng) {
  if (id < 8) {
    paper(g, id)
    return
  }
  if (id >= 12 && id <= 15) {
    brocade(g, id - 12)
    return
  }
  if (id === 8) {
    g.fillStyle = '#355452'
    g.fillRect(0, 0, 256, 256)
    for (let i = -1; i < 6; i++) {
      const x = i * 54 + 12
      g.strokeStyle = '#d3aa64'
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(x - 18, 220)
      g.lineTo(x - 18, 112)
      g.lineTo(x + 8, 112)
      g.lineTo(x + 8, 74)
      g.lineTo(x - 5, 74)
      g.lineTo(x - 5, 93)
      g.lineTo(x - 20, 93)
      g.lineTo(x - 20, 48)
      g.lineTo(x + 24, 48)
      g.lineTo(x + 24, 191)
      g.lineTo(x + 8, 191)
      g.lineTo(x + 8, 148)
      g.stroke()
    }
    g.fillStyle = sepia
    for (const y of [17, 31, 225, 240]) g.fillRect(0, y, 256, 4)
    return
  }
  if (id === 9 || id === 11 || id === 20) {
    g.fillStyle = id === 9 ? '#733e35' : '#614838'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 6; i++) {
      const x = i * 43
      g.fillStyle = i % 2 ? '#7d4938' : '#684334'
      g.fillRect(x, 0, 41, 256)
      g.fillStyle = '#402f2b'
      g.fillRect(x, 0, 3, 256)
    }
    if (id !== 11) {
      g.strokeStyle = '#452f2a'
      g.lineWidth = id === 9 ? 10 : 3
      g.strokeRect(11, 12, 234, 230)
      g.strokeStyle = id === 9 ? '#ad7758' : '#9f805e'
      g.lineWidth = 3
      g.strokeRect(22, 25, 212, 206)
      if (id === 9) lotus(g, 129, 132, 57, '#885542', '#a57f59', 8)
      if (id === 20)
        for (let y = 20; y < 256; y += 13) {
          g.fillStyle = '#4c4434'
          g.fillRect(0, y, 256, 3)
        }
    }
    return
  }
  if (id === 10) {
    g.fillStyle = '#63706c'
    g.fillRect(0, 0, 256, 256)
    for (let j = 0; j < 5; j++)
      for (let i = -1; i < 4; i++) {
        const x = i * 96 + (j % 2) * 48
        g.fillStyle = ['#7e8580', '#8a8e84', '#6f7976', '#85837c'][(i + j + 4) % 4]
        g.fillRect(x, 2 + j * 54, 93, 50)
      }
    return
  }
  if (id === 16 || id === 17 || id === 18 || id === 19) {
    g.fillStyle = '#cfbc8b'
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = '#dfd0a7'
    g.fillRect(9, 8, 238, 240)
    for (let j = 0; j < 5; j++) {
      const y = 102 + j * 24
      g.fillStyle = ['#b5b6a0', '#a6ad99', '#8d9d8e', '#748c80', '#56776d'][j]
      g.beginPath()
      g.moveTo(9, y + 52)
      for (let x = 9; x < 248; x += 4)
        g.lineTo(x, y + 17 * Math.sin(x * 0.044 + j) + 12 * Math.cos(x * 0.082 + j * 2) + 2 * rng())
      g.lineTo(247, y + 48)
      g.fill()
    }
    if (id === 18) {
      for (let k = 0; k < 8; k++)
        lotus(g, 22 + k * 12, 191 + 12 * Math.sin(k * 1.7), 9 + (k % 3), '#974e48', '#9d7155', 6)
    }
    if (id === 19)
      for (let k = 0; k < 3; k++) {
        const x = 45 + 48 * k,
          y = 91 - k * 9
        g.strokeStyle = '#5d6459'
        g.lineWidth = 1.8
        g.beginPath()
        g.moveTo(x - 12, y - 5)
        g.quadraticCurveTo(x - 1, y - 4, x + 1, y + 2)
        g.quadraticCurveTo(x + 9, y - 4, x + 17, y - 3)
        g.stroke()
      }
    g.fillStyle = '#9a4c39'
    g.fillRect(214, 35, 12, 14)
    return
  }
  if (id === 21 || id === 22 || id === 23) {
    g.fillStyle = '#43372f'
    g.fillRect(0, 0, 256, 256)
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 8; i++) {
        const x = 6 + 32 * i,
          y = 9 + j * 60,
          cc = ['#937755', '#ada27f', '#586c61', '#976456', '#6e7976'][(i + j) % 5]
        g.fillStyle = cc
        if (id === 23) {
          g.beginPath()
          g.ellipse(x + 14, y + 37, 12, 4.5, -0.23, 0, Math.PI * 2)
          g.fill()
        } else {
          g.fillRect(x, y + (i % 3) * 5.5, 21, 41 - (i % 3) * 5.5)
          g.fillStyle = '#bfa981'
          g.fillRect(x + 3, y + 14, 4, 14)
        }
      }
      g.fillStyle = '#7b573c'
      g.fillRect(0, j * 60 + 52, 256, 6)
    }
    return
  }
  if (id < 27) {
    g.save()
    g.scale(2, 2)
    drawLampSilk(g, id - 24, false)
    g.restore()
    return
  }
  if (id === 27) {
    paper(g, 2)
    g.fillStyle = '#704b37'
    g.fillRect(0, 0, 256, 256)
    const gr = g.createRadialGradient(120, 136, 3, 120, 127, 110)
    gr.addColorStop(0, '#efc684')
    gr.addColorStop(1, '#b28456')
    g.fillStyle = gr
    g.beginPath()
    g.arc(128, 128, 101, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#4f3934'
    g.lineWidth = 5
    for (const x of [82, 111, 146, 174]) {
      g.beginPath()
      g.moveTo(x, 75)
      g.lineTo(x, 181)
      g.stroke()
    }
    for (const y of [80, 127, 172]) {
      g.beginPath()
      g.moveTo(49, y)
      g.lineTo(207, y)
      g.stroke()
    }
    g.strokeStyle = '#c7a36c'
    g.lineWidth = 8
    g.beginPath()
    g.arc(128, 128, 105, 0, Math.PI * 2)
    g.stroke()
    return
  }
  paper(g, id % 8)
}
function texture(canvas) {
  const map = new T.CanvasTexture(canvas)
  map.colorSpace = T.SRGBColorSpace
  map.anisotropy = 4
  return map
}
function material(map, emission) {
  return new T.MeshStandardMaterial({
    color: 0xffffff,
    map,
    emissiveMap: map,
    emissive: 0xffd59a,
    emissiveIntensity: emission,
    roughness: 0.78,
    side: T.DoubleSide,
    vertexColors: true,
  })
}
export function wardPaint(m) {
  if (m.wardSigns) return
  let signs = null,
    fabric = null,
    transmission = null
  if (typeof document !== 'undefined') {
    const s = document.createElement('canvas')
    s.width = 2048
    s.height = signRows * 2 * 96
    const g = s.getContext('2d'),
      rng = generator(7259)
    for (const h of wardAddresses) {
      g.save()
      g.translate((h.id % 8) * 256, Math.floor(h.id / 8) * 96)
      plate(g, 256, 96, hues[h.id % hues.length], h.name)
      g.restore()
      g.save()
      g.translate((h.id % 8) * 256, (signRows + Math.floor(h.id / 8)) * 96)
      g.scale(256 / 96, 96 / 196)
      plate(g, 96, 196, hues[(h.id + 1) % hues.length], h.name.slice(-2), true)
      g.restore()
    }
    signs = texture(s)
    const c = document.createElement('canvas')
    c.width = 2048
    c.height = 1024
    const dc = c.getContext('2d')
    for (let k = 0; k < 32; k++) {
      dc.save()
      dc.translate((k % 8) * 256, Math.floor(k / 8) * 256)
      dc.beginPath()
      dc.rect(0, 0, 256, 256)
      dc.clip()
      paintedTile(dc, k, rng)
      for (let j = 0; j < 2300; j++) {
        dc.fillStyle = j % 2 ? 'rgba(254,241,188,.065)' : 'rgba(55,41,27,.07)'
        dc.fillRect(256 * rng(), 256 * rng(), 1.6, 0.5 + 2.3 * rng())
      }
      dc.restore()
    }
    fabric = texture(c)
    const e = document.createElement('canvas')
    e.width = 1024
    e.height = 512
    const ec = e.getContext('2d')
    ec.fillStyle = 'black'
    ec.fillRect(0, 0, e.width, e.height)
    for (const k of [0, 1, 2, 3, 4, 5, 6, 7, 24, 25, 26, 27, 28, 29, 30, 31]) {
      ec.save()
      ec.translate((k % 8) * 128, Math.floor(k / 8) * 128)
      ec.beginPath()
      ec.rect(0, 0, 128, 128)
      ec.clip()
      if (k >= 24 && k <= 26) drawLampSilk(ec, k - 24, true)
      else {
        if (k === 27) {
          ec.beginPath()
          ec.arc(64, 64, 50, 0, Math.PI * 2)
          ec.clip()
        }
        ec.scale(0.5, 0.5)
        paper(ec, k === 27 ? 2 : k % 8, true)
      }
      ec.restore()
    }
    transmission = texture(e)
  }
  m.wardSigns = material(signs, 0.09)
  m.wardPaint = material(fabric, 0.035)
  m.wardScreens = material(fabric, 1.66)
  m.wardScreens.emissive.set(0xffddb0)
  m.wardScreens.emissiveMap = transmission
  m.wardLampSilk = material(fabric, 2.85)
  m.wardLampSilk.emissive.set(0xffdeb0)
  m.wardLampSilk.emissiveMap = transmission
  m.wardSigns.name = '商号金字'
  m.wardPaint.name = '彩绘织锦'
  m.wardScreens.name = '街窗绢纸'
  m.wardLampSilk.name = '灯会绢彩'
  m.wardScreens.userData.cast = false
  m.wardLampSilk.userData.cast = false
}
export function artPolygon(b, m, slot, pts, uv, tint = 1, sign = false) {
  const r = sign ? signRows * 2 : patterns,
    l = slot % 8,
    k = r - 1 - Math.floor(slot / 8),
    pad = 0.006
  b.face(
    m,
    pts,
    tint,
    uv.map(([x, y]) => [(l + pad + (1 - 2 * pad) * x) / 8, (k + pad + (1 - 2 * pad) * y) / r])
  )
}
export function picture(b, m, slot, x, y, z, w, h, tint = 1, sign = false) {
  artPolygon(
    b,
    m,
    slot,
    [
      [x - w / 2, y - h / 2, z],
      [x + w / 2, y - h / 2, z],
      [x + w / 2, y + h / 2, z],
      [x - w / 2, y + h / 2, z],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    tint,
    sign
  )
}

export const bannerSlot = (id) => id + signRows * 8
