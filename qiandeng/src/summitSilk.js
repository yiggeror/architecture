import * as T from 'three'
import { generator } from './mesh.js'

const cols = 4,
  rows = 2,
  size = 224
const titles = ['璇玑殿', '步虚院', '含章阁', '仰仪台']
function atlas() {
  if (typeof document === 'undefined') {
    const tex = new T.DataTexture(new Uint8Array([233, 208, 166, 255]), 1, 1)
    tex.needsUpdate = true
    return tex
  }
  const canvas = document.createElement('canvas')
  canvas.width = size * cols
  canvas.height = size * rows
  const c = canvas.getContext('2d'),
    rand = generator(377571)
  const path = (p, closed = false) => {
    c.beginPath()
    p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
    if (closed) c.closePath()
    c.stroke()
  }
  const dot = (x, y, r) => {
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.fill()
  }
  for (let i = 0; i < 8; i++) {
    c.save()
    c.translate((i % cols) * size, Math.floor(i / cols) * size)
    const sign = i >= 4,
      g = c.createLinearGradient(0, 0, size, size)
    g.addColorStop(0, sign ? '#223f44' : '#f0d8a5')
    g.addColorStop(0.46, sign ? '#29494b' : '#ffedbd')
    g.addColorStop(1, sign ? '#193539' : '#e4bf86')
    c.fillStyle = g
    c.fillRect(0, 0, size, size)
    for (let n = 0; n < 1250; n++) {
      c.fillStyle = sign ? 'rgba(184,184,134,.17)' : 'rgba(120,72,45,.10)'
      c.fillRect(rand() * size, rand() * size, rand() * 1.7 + 0.4, 0.7)
    }
    c.strokeStyle = sign ? '#ad8951' : '#9b6c43'
    c.lineWidth = 2
    c.strokeRect(6, 6, 212, 212)
    c.lineWidth = 1
    c.strokeRect(12, 12, 200, 200)
    for (let s = 0; s < 4; s++) {
      c.save()
      c.translate(112, 112)
      c.rotate((s * Math.PI) / 2)
      c.translate(-112, -112)
      c.lineWidth = 2.6
      c.strokeStyle = sign ? '#d9b666' : '#986e42'
      path([
        [14, 42],
        [25, 42],
        [25, 24],
        [42, 24],
        [42, 14],
      ])
      path([
        [16, 16],
        [33, 16],
        [33, 31],
        [18, 31],
        [18, 22],
        [25, 22],
      ])
      c.restore()
    }
    if (sign) {
      c.fillStyle = '#f3d493'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.font = 'bold 53px "Noto Serif CJK SC","Noto Sans CJK SC",serif'
      c.fillText(titles[i - 4], 112, 106, 173)
      c.strokeStyle = '#b99c65'
      c.lineWidth = 1.2
      path([
        [57, 148],
        [98, 148],
        [112, 154],
        [126, 148],
        [167, 148],
      ])
      c.fillStyle = '#ba5a43'
      c.fillRect(162, 154, 11, 12)
    } else if (i === 0 || i === 1) {
      const shift = i === 0 ? 0 : 11
      c.strokeStyle = '#895c39'
      c.lineWidth = 2.2
      for (let k = 0; k < 4; k++) {
        c.save()
        c.translate(112, 112)
        c.rotate((k * Math.PI) / 2)
        path([
          [0, -78],
          [-14, -65],
          [-14, -42],
          [-33, -23],
          [-55, -23],
          [-64, -13],
          [-80, -13],
        ])
        path([
          [0, -59],
          [12, -46],
          [12, -31],
          [28, -15],
          [42, -15],
        ])
        c.restore()
      }
      c.lineWidth = 1.3
      c.beginPath()
      c.arc(112, 112, 29 + shift, 0, Math.PI * 2)
      c.stroke()
      c.fillStyle = '#ad8150'
      for (let j = 0; j < 15; j++) {
        const a = (j * Math.PI * 2) / 15
        dot(112 + Math.cos(a) * 23, 112 + Math.sin(a) * 23, i ? 1.4 : 2)
      }
      c.lineWidth = 1.5
      path([
        [87, 119],
        [98, 103],
        [111, 108],
        [122, 90],
        [135, 99],
      ])
      for (const [x, y] of [
        [87, 119],
        [98, 103],
        [111, 108],
        [122, 90],
        [135, 99],
      ])
        dot(x, y, 2.2)
    } else if (i === 2) {
      const clouds = (x, y, s) => {
        c.beginPath()
        c.moveTo(x, y)
        c.bezierCurveTo(x + s * 9, y - s * 12, x + s * 17, y + s * 7, x + s * 22, y)
        c.bezierCurveTo(x + s * 29, y - s * 16, x + s * 46, y - s * 11, x + s * 41, y - s * 4)
        c.bezierCurveTo(x + s * 36, y + s * 5, x + s * 31, y - s * 1, x + s * 36, y - s * 3)
        c.stroke()
      }
      c.strokeStyle = '#986c40'
      c.lineWidth = 1.5
      for (let q = 0; q < 5; q++) clouds(30 + (q % 2) * 59, 48 + q * 30, 1.16)
      c.strokeStyle = '#837251'
      c.lineWidth = 2
      path([
        [26, 173],
        [46, 155],
        [60, 159],
        [82, 123],
        [106, 152],
        [132, 118],
        [158, 153],
        [184, 137],
        [200, 155],
      ])
    } else {
      c.strokeStyle = '#936a3e'
      c.lineWidth = 1
      for (let q = 0; q < 5; q++) {
        c.beginPath()
        c.arc(112, 112, 18 + q * 12, 0, Math.PI * 2)
        c.stroke()
      }
      for (let q = 0; q < 24; q++) {
        const a = (q * Math.PI) / 12
        path([
          [112 + Math.cos(a) * 53, 112 + Math.sin(a) * 53],
          [112 + Math.cos(a) * 70, 112 + Math.sin(a) * 70],
        ])
      }
      c.fillStyle = '#93734c'
      for (let q = 0; q < 23; q++) {
        const a = rand() * 6.28,
          r = rand() * 52
        dot(112 + Math.cos(a) * r, 112 + Math.sin(a) * r, 1 + rand())
      }
    }
    c.restore()
  }
  const tex = new T.CanvasTexture(canvas)
  tex.colorSpace = T.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
export function palaceMaterials(m) {
  const tex = atlas()
  m.summitScreen = new T.MeshStandardMaterial({
    name: 'summitScreen',
    color: 0xffefd2,
    map: tex,
    emissive: 0xffb976,
    emissiveMap: tex,
    emissiveIntensity: 0.68,
    roughness: 0.73,
    vertexColors: true,
    side: T.DoubleSide,
  })
  m.summitScreen.userData.emitter = true
  m.summitSign = new T.MeshStandardMaterial({
    name: 'summitSign',
    color: 0xffffff,
    map: tex,
    roughness: 0.49,
    emissive: 0xffdb9b,
    emissiveMap: tex,
    emissiveIntensity: 0.16,
    side: T.DoubleSide,
    vertexColors: true,
  })
  m.summitGold = m.bronze.clone()
  m.summitGold.name = 'summitGold'
  m.summitGold.color.set(0xe7ba70)
  m.summitGold.emissive.set(0xb97a30)
  m.summitGold.emissiveIntensity = 0.37
  m.summitGold.metalness = 0.38
  m.summitMark = m.pearl.clone()
  m.summitMark.name = 'summitMark'
  m.summitMark.emissive.set(0xf5c382)
  m.summitMark.emissiveIntensity = 0.72
}
export function silk(b, mat, x, y, z, w, h, tile, tint = 1) {
  const u = (tile % cols) / cols,
    v = 1 - (Math.floor(tile / cols) + 1) / rows,
    dx = 0.008
  b.face(
    mat,
    [
      [x - w / 2, y - h / 2, z],
      [x + w / 2, y - h / 2, z],
      [x + w / 2, y + h / 2, z],
      [x - w / 2, y + h / 2, z],
    ],
    tint,
    [
      [u + dx, v + dx],
      [u + 0.25 - dx, v + dx],
      [u + 0.25 - dx, v + 0.5 - dx],
      [u + dx, v + 0.5 - dx],
    ]
  )
}
export function plaque(b, m, x, y, z, w, h, title) {
  b.box(m.bronze, x, y, z, w + 0.16, h + 0.15, 0.17)
  b.box(m.darkwood, x, y, z + 0.079, w + 0.074, h + 0.069, 0.07)
  silk(b, m.summitSign, x, y, z + 0.12, w, h, 4 + title)
}
