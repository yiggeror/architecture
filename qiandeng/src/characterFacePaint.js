import * as T from 'three'
import { browInk, orbitalWash, vermilion } from './characterVisageInk.js'
import { hairEdge, parting } from './characterFaceSurface.js'

export const faceU = (x) => 0.5 + x / 0.196
export const faceV = (y) => (y + 0.006) / 0.249
function canvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}
function texture(c) {
  const map = new T.CanvasTexture(c)
  map.colorSpace = T.SRGBColorSpace
  map.anisotropy = 4
  return map
}
function css(c) {
  return '#' + (c >>> 0).toString(16).padStart(6, '0')
}
function rng(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}
function blend(a, b, t) {
  return (
    (Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t) << 16) |
    (Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t) << 8) |
    Math.round((a & 255) * (1 - t) + (b & 255) * t)
  )
}
function wash(ctx, x, y, w, h, c, a, rot = 0) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.scale(w, h)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  g.addColorStop(0, css(c))
  g.addColorStop(0.52, css(c) + 'a0')
  g.addColorStop(1, css(c) + '00')
  ctx.globalAlpha = a
  ctx.fillStyle = g
  ctx.fillRect(-1, -1, 2, 2)
  ctx.restore()
}
function stroke(ctx, points, width, col, alpha) {
  ctx.beginPath()
  ctx.moveTo(...points[0])
  for (let k = 1; k < points.length; k++) ctx.lineTo(...points[k])
  ctx.lineWidth = width
  ctx.strokeStyle = css(col)
  ctx.globalAlpha = alpha
  ctx.stroke()
  ctx.globalAlpha = 1
}
export function paintFace(a) {
  const c = canvas(1024, 1024)
  if (!c) return null
  const ctx = c.getContext('2d', { willReadFrequently: true }),
    p = a.profile,
    skin = p.skin,
    random = rng(p.seed ^ 0x531ac021)
  ctx.fillStyle = css(skin)
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.setTransform(c.width / 0.196, 0, 0, -c.height / 0.249, c.width * 0.5, c.height * (1 - 0.006 / 0.249))
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  // Each sitter has her or his own temperature changes between the planes of
  // forehead, temple, cheek and muzzle. They are translucent skin pigments,
  // leaving the neutral complexion intact at the jaw-to-neck connection.
  const colorways = {
    silk: [0xf4d0c0, 0xc4777c, 0xb58692, 0xe89d91],
    lute: [0xf3cead, 0xcc8373, 0xaa7b80, 0xf0ad95],
    scholar: [0xebcbbd, 0xba7d79, 0x988494, 0xe6a695],
    drummer: [0xe4ae8c, 0xb86852, 0x9c756c, 0xd68b6e],
    market: [0xf1c8ae, 0xc77768, 0xac8080, 0xef9d87],
    boatman: [0xe0b18e, 0xaa7561, 0x987e73, 0xd0997d],
  }
  const [ivory, flush, cool, apricot] = colorways[a.family] ?? colorways.silk
  const vivid = a.family === 'silk' || a.family === 'lute' || a.family === 'market'
  wash(ctx, 0, 0.15, 0.06, 0.043, ivory, 0.33)
  wash(ctx, -0.004, 0.146, 0.035, 0.025, ivory, 0.2)
  wash(ctx, 0, 0.02, 0.024, 0.015, ivory, 0.25)
  wash(ctx, 0, 0.0055, 0.042, 0.008, cool, 0.16)
  wash(ctx, 0, a.mouthY - 0.0095, 0.017, 0.004, 0xa77572, 0.29)
  for (const s of [-1, 1]) {
    const cheek = s * (a.ec + 0.02)
    wash(ctx, s * 0.071, 0.127, 0.023, 0.049, cool, 0.24, s * 0.15)
    wash(ctx, s * 0.056, 0.063, 0.027, 0.033, cool, 0.2, -s * 0.58)
    wash(ctx, s * 0.041, 0.057, 0.014, 0.023, ivory, 0.16, -s * 0.55)
    // High, lateral carmine for the merchant. The player's apricot rises
    // softly under her eye; the drummer flushes further down the cheek.
    const height = a.ey - (a.family === 'drummer' ? 0.024 : a.family === 'lute' ? 0.016 : 0.02)
    wash(ctx, cheek, height, 0.051, 0.033, flush, vivid ? 0.2 : 0.16, s * 0.36)
    wash(ctx, cheek + s * 0.002, height - 0.0005, 0.041, 0.02, apricot, 0.19, s * 0.29)
    wash(ctx, s * (a.ec - 0.002), a.ey - 0.011, 0.023, 0.013, blend(ivory, 0xc4bcc1, 0.56), 0.23, s * 0.23)
    wash(ctx, s * (a.ec + 0.022), a.ey - 0.007, 0.016, 0.011, flush, vivid ? 0.16 : 0.09, s * 0.54)
    wash(ctx, s * (a.ec - 0.013), a.ey + 0.006, 0.012, 0.01, cool, 0.24, -s * 0.24)
    wash(ctx, s * (a.nw - 0.001), a.noseY + 0.017, 0.0075, 0.019, cool, 0.23, -s * 0.2)
    wash(ctx, s * (a.nw + 0.003), a.noseY + 0.0025, 0.0074, 0.0057, flush, 0.29, s * 0.45)
    wash(ctx, s * (a.nw + 0.008), a.noseY - 0.008, 0.0058, 0.009, 0xbd9386, 0.16, -s * 0.48)
    wash(ctx, s * (a.nw + 0.011), a.noseY - 0.0068, 0.006, 0.012, ivory, 0.29, -s * 0.47)
  }
  wash(ctx, -0.0004, a.noseY + 0.02, 0.0046, 0.016, ivory, 0.18)
  wash(ctx, 0, a.noseY + 0.0049, 0.01, 0.0057, apricot, 0.48)
  wash(ctx, -0.0008, a.noseY + 0.0062, 0.0047, 0.0023, 0xffdcc2, 0.38)
  wash(ctx, 0, a.noseY - 0.0036, 0.014, 0.0031, 0x986b66, 0.24)
  for (const s of [-1, 1]) {
    wash(ctx, s * (a.nw - 0.001), a.noseY - 0.0024, 0.0038, 0.0015, 0x92665f, 0.26, s * 0.25)
    wash(ctx, s * 0.0035, a.mouthY + 0.009, 0.0019, 0.0054, ivory, 0.18, s * 0.12)
    if (a.age > 0.22) {
      const fold = []
      for (let j = 0; j <= 24; j++) {
        const t = j / 24
        fold.push([s * (a.nw + 0.006 + 0.011 * t + 0.0017 * Math.sin(Math.PI * t)), a.noseY - 0.0004 - 0.023 * t])
      }
      stroke(ctx, fold, 0.00048, 0x9f7462, a.age * 0.25)
    }
  }
  if (p.id === 9) {
    // A sparse group of warm freckles sits across the musician's high
    // cheek and nose. Their scale and spacing stay independent of skin grain.
    for (const [x, y, radius] of [
      [-0.049, -0.016, 0.00074],
      [-0.043, -0.014, 0.00051],
      [-0.038, -0.018, 0.00067],
      [-0.028, -0.0145, 0.00048],
      [-0.011, -0.0095, 0.00052],
      [0.006, -0.011, 0.00063],
      [0.031, -0.016, 0.00055],
      [0.038, -0.013, 0.00076],
      [0.044, -0.016, 0.00051],
    ]) {
      wash(ctx, x, a.ey + y, radius, radius * 0.77, 0x986b57, 0.44, x * 11)
    }
  }
  wash(ctx, 0, a.mouthY, 0.033, 0.0125, flush, 0.23)
  wash(ctx, 0, a.mouthY + 0.0098, 0.0047, 0.0053, cool, 0.22)
  vermilion(ctx, a, random)
  for (const s of [-1, 1]) {
    orbitalWash(ctx, a, s)
    browInk(ctx, a, s, random)
    if (a.age > 0.13) {
      for (let j = 0; j < 3; j++) {
        const pts = []
        for (let i = 0; i <= 15; i++) {
          const t = i / 15
          pts.push([
            s * (a.ec + a.er + 0.001 + t * (0.006 + j * 0.0007)),
            a.ey + 0.0014 - t * (0.001 + j * 0.002) + 0.0012 * Math.sin(t * Math.PI),
          ])
        }
        stroke(ctx, pts, 0.00026, 0x957569, a.age * 0.42)
      }
    }
  }
  if (a.age > 0.3) {
    for (let j = 0; j < 3; j++) {
      const pts = []
      for (let i = 0; i <= 44; i++) {
        const x = (i / 22 - 1) * (0.025 - j * 0.0027)
        pts.push([x, 0.155 + j * 0.0056 + 0.00135 * Math.cos(x * 85 + j * 0.48)])
      }
      stroke(ctx, pts, 0.00031, 0x957567, 0.09 + 0.19 * a.age)
    }
  }
  for (let i = 0; i < 240; i++) {
    const th = (i / 239 - 0.5) * 3.08,
      y = hairEdge(a, th),
      q = a.point(th, y)
    wash(ctx, q[0], y + 0.00024, 0.00095, 0.0015, p.hairColor, 0.24)
  }
  for (let i = 0; i < 1250; i++) {
    const th = (random() - 0.5) * 3.06,
      y = hairEdge(a, th),
      q = a.point(th, y)
    const curl = th < parting(a) ? -1 : 1,
      spread = 0.00035 + 0.00265 * random() ** 1.8
    const end = a.point(th + 0.009 * curl, y - spread)
    stroke(
      ctx,
      [
        [q[0], y + 0.00035],
        [q[0] * 0.63 + end[0] * 0.37, y - spread * 0.43],
        [end[0], end[1]],
      ],
      0.0001 + random() * 0.00029,
      p.hairColor,
      0.13 + random() * 0.52
    )
  }
  if (p.facialHair) {
    const hair = blend(p.hairColor, skin, 0.15)
    for (const s of [-1, 1]) {
      // Stubble sits on a continuous bed of follicles. At reading distance
      // it breaks from warm cheek to cool beard before individual hairs resolve.
      for (let j = 0; j < 21; j++) {
        const u = j / 20,
          x = s * (0.001 + 0.05 * u),
          y = 0.009 + 0.03 * u * u
        wash(ctx, x, y, 0.0068, 0.0078, 0x756b64, 0.078, -s * 0.72 * u)
      }
      for (let j = 0; j < 18; j++) {
        const u = j / 17,
          x = s * (0.003 + 0.02 * u),
          lip = a.lip(x)
        wash(ctx, x, lip.upper + 0.0034 - 0.0015 * u, 0.0031, 0.0027, hair, 0.104, s * (0.14 - u * 0.75))
      }
      wash(ctx, s * 0.014, a.mouthY + 0.006, 0.013, 0.003, 0x866e5e, 0.18)
      for (let i = 0; i < 205; i++) {
        const u = random(),
          x = s * (0.003 + u * (a.mw - 0.001)),
          v = a.lip(x)
        const yy = v.upper + 0.0019 + 0.0044 * random() * (1 - 0.57 * u) + 0.00078 * Math.sin(Math.PI * u)
        stroke(
          ctx,
          [
            [x, yy],
            [x + s * 0.0005, yy - 0.0007],
            [x + s * (0.0008 + 0.0017 * u), yy - 0.00155 - 0.0011 * random()],
          ],
          0.0002 + random() * 0.00033,
          hair,
          0.15 + random() * 0.35
        )
      }
      for (let i = 0; i < 290; i++) {
        const u = random(),
          x = s * (0.002 + u * 0.056),
          edge = 0.002 + 0.035 * u ** 1.7,
          y = edge + random() * (0.013 - 0.005 * u)
        if (Math.abs(x) < 0.03 && y > 0.018 + 0.007 * u) continue
        stroke(
          ctx,
          [
            [x, y],
            [x - s * 0.00035, y - 0.0016 - random() * 0.0015],
          ],
          0.00017 + random() * 0.00028,
          hair,
          0.13 + random() * 0.24
        )
      }
    }
  }
  // A fine mineral wash breaks the flat skin color at close focal lengths.
  // Mid-scale pigment is shared across each little patch; individual pores
  // carry very little contrast beneath the actual directional lighting.
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const img = ctx.getImageData(0, 0, c.width, c.height),
    d = img.data,
    grid = 32
  const cloud = Float32Array.from({ length: grid * grid }, () => random() - 0.5)
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const gx = x / 30,
        gy = y / 32,
        ix = Math.floor(gx),
        iy = Math.floor(gy),
        fu = gx - ix,
        fv = gy - iy
      const sample = (i, j) => cloud[(i % grid) + grid * (j % grid)]
      const m =
        (1 - fv) * (sample(ix, iy) * (1 - fu) + sample(ix + 1, iy) * fu) +
        fv * (sample(ix, iy + 1) * (1 - fu) + sample(ix + 1, iy + 1) * fu)
      const i = (y * c.width + x) * 4,
        grain = (random() - 0.5) * (2.4 + a.age * 1.7)
      d[i] += grain + 2.4 * m
      d[i + 1] += grain * 0.83 + 4.1 * m
      d[i + 2] += grain * 0.75 + 4.4 * m
    }
  ctx.putImageData(img, 0, 0)
  return texture(c)
}
const ocularPalette = {
  // Limbus, iris body, transmitted color in the inferior stroma, collarette.
  silk: ['#242127', '#534138', '#886d56', '#a48369'],
  lute: ['#282427', '#564637', '#927653', '#a98b64'],
  scholar: ['#242429', '#474244', '#7a7268', '#907a65'],
  drummer: ['#2b2525', '#574439', '#8b6850', '#a98360'],
  boatman: ['#322c27', '#55483a', '#8d7958', '#a99776'],
  market: ['#342831', '#644747', '#a66f5b', '#bb8b70'],
}
const eyeAtlases = new Map(),
  eyeMaterials = new Map()
let hair
const irisX = 259,
  irisY = 127,
  irisR = 83.8
function cornealWindow(ctx, dark) {
  // A quiet, elongated reflection just below the upper lid has a softer
  // neighboring glint from the opposite part of the same window.
  ctx.save()
  ctx.translate(irisX - 23, irisY - 19)
  ctx.rotate(-0.31)
  wash(ctx, 0, 0, 14, 8, dark ? 0xffeed6 : 0xffefdf, dark ? 0.65 : 0.82)
  ctx.beginPath()
  ctx.moveTo(-8, -3)
  ctx.bezierCurveTo(-2, -6, 5, -5, 9, -2)
  ctx.bezierCurveTo(8, 0, 3, 3, -3, 4)
  ctx.bezierCurveTo(-6, 5, -9, 1, -8, -3)
  ctx.fillStyle = dark ? '#ffedcf' : '#fff6ec'
  ctx.fill()
  ctx.restore()
  wash(ctx, irisX + 25, irisY + 20, 4.7, 2.8, dark ? 0xf1ceba : 0xffdfc2, 0.64)
}
export function eyeMap(a) {
  const family = a?.family ?? 'silk'
  if (eyeAtlases.has(family)) return eyeAtlases.get(family)
  const c = canvas(512, 256)
  if (!c) return null
  const ctx = c.getContext('2d'),
    palette = ocularPalette[family] ?? ocularPalette.silk
  const random = rng(448919 + family.charCodeAt(0) * 37 + family.length)
  const [edge, body, transmit, collar] = palette
  const x = irisX,
    y = irisY,
    r = irisR
  const ivory = ctx.createLinearGradient(0, 19, 0, 242)
  for (const [t, color] of [
    [0, '#938e97'],
    [0.37, '#b7b6b9'],
    [0.64, '#d6d0ce'],
    [1, '#c3b0ae'],
  ])
    ivory.addColorStop(t, color)
  ctx.fillStyle = ivory
  ctx.fillRect(0, 0, 512, 256)
  wash(ctx, 26, 136, 89, 92, 0xbd8d8d, 0.56)
  wash(ctx, 57, 149, 74, 28, 0xc98986, 0.27, -0.23)
  // The visible sclera occupies x=37..161 in the atlas. Shade the tucked
  // lateral surface as it turns behind the rim; leave reflected ivory below
  // the iris. Both corners settle gradually into the damp eyelid margin.
  wash(ctx, 156, 111, 56, 85, 0xa3989c, 0.51, 0.24)
  wash(ctx, 53, 117, 51, 73, 0xb8a09d, 0.35, -0.27)
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r + 1.8, 0, 2 * Math.PI)
  ctx.clip()
  ctx.fillStyle = edge
  ctx.fillRect(x - r - 2, y - r - 2, 2 * r + 4, 2 * r + 4)
  const lens = ctx.createRadialGradient(x, y, 0, x, y, r)
  for (const [t, col] of [
    [0, edge],
    [0.4, edge],
    [0.51, body],
    [0.69, transmit],
    [0.84, body],
    [1, edge],
  ])
    lens.addColorStop(t, col)
  ctx.fillStyle = lens
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
  const washLower = ctx.createRadialGradient(x + 8, y + r * 0.47, 0, x + 8, y + r * 0.47, r * 0.91)
  washLower.addColorStop(0, transmit)
  washLower.addColorStop(1, transmit + '00')
  ctx.fillStyle = washLower
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
  // Open, branching stromal folds. Their tips break before the limbal ring
  // and their collarette is scalloped instead of a concentric gold outline.
  for (let i = 0; i < 116; i++) {
    const angle = ((i + random() * 0.63) * Math.PI * 2) / 116
    const curved = (random() - 0.5) * 0.13
    const middle = r * (0.56 + 0.09 * Math.sin(7 * angle) + 0.041 * Math.sin(13 * angle))
    const inner = middle - r * (0.04 + 0.14 * random()),
      outer = r * (0.73 + 0.21 * random())
    const polar = (d, offset = 0) => [x + Math.cos(angle + offset) * d, y + Math.sin(angle + offset) * d]
    ctx.beginPath()
    ctx.moveTo(...polar(inner, curved * 0.75))
    ctx.quadraticCurveTo(...polar(middle, curved - 0.033), ...polar(outer))
    ctx.quadraticCurveTo(...polar(middle, curved + 0.025), ...polar(inner, curved * 0.75))
    ctx.fillStyle = i % 4 === 0 ? edge : collar
    ctx.globalAlpha = (0.12 + random() * 0.31) * (0.74 + 0.26 * Math.sin(angle))
    ctx.fill()
  }
  ctx.globalAlpha = 1
  const horizon = ctx.createLinearGradient(0, y - r, 0, y + r * 0.62)
  horizon.addColorStop(0, '#201d29ef')
  horizon.addColorStop(0.42, '#221f29bb')
  horizon.addColorStop(0.74, '#271e2942')
  horizon.addColorStop(1, '#30252c00')
  ctx.fillStyle = horizon
  ctx.fillRect(x - r - 2, y - r - 2, 2 * r + 4, 2 * r + 4)
  const pupilRadius = r * (family === 'scholar' ? 0.43 : family === 'lute' ? 0.465 : 0.445)
  const pupil = ctx.createRadialGradient(x, y, pupilRadius * 0.45, x, y, pupilRadius * 1.21)
  pupil.addColorStop(0, '#1b1921')
  pupil.addColorStop(0.73, '#252128')
  pupil.addColorStop(1, '#30272a00')
  ctx.fillStyle = pupil
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
  const limbus = ctx.createRadialGradient(x, y, r * 0.77, x, y, r)
  limbus.addColorStop(0, edge + '00')
  limbus.addColorStop(0.65, edge + '39')
  limbus.addColorStop(1, edge + 'ef')
  ctx.fillStyle = limbus
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
  cornealWindow(ctx, false)
  ctx.restore()
  const atlas = texture(c)
  eyeAtlases.set(family, atlas)
  return atlas
}
export function eyeMaterial(a) {
  const family = a.family
  if (eyeMaterials.has(family)) return eyeMaterials.get(family)
  const m = new T.MeshPhysicalMaterial({
    ior: 1.375,
    specularIntensity: 0.37,
    envMapIntensity: 0.47,
    name: '眼白与褐色虹膜',
    map: eyeMap(a),
    color: 0xffffff,
    roughness: 0.31,
    emissive: 0xfff2e7,
    emissiveMap: cornealLight(),
    emissiveIntensity: 0.24,
    vertexColors: true,
    side: T.DoubleSide,
  })
  eyeMaterials.set(family, m)
  return m
}
export function hairMap() {
  if (hair) return hair
  const c = canvas(1024, 512)
  if (!c) return null
  const ctx = c.getContext('2d'),
    random = rng(88031)
  ctx.fillStyle = '#c9c7c5'
  ctx.fillRect(0, 0, c.width, c.height)
  for (let i = 0; i < 1800; i++) {
    const x = random() * 1024,
      amp = 0.7 + random() * 3.5,
      cycle = 0.3 + random() * 0.48,
      phase = random() * 6.28
    const pts = []
    for (let k = 0; k <= 15; k++) {
      const t = k / 15
      pts.push([x + amp * Math.sin(phase + t * cycle * 6.28), 512 * t])
    }
    stroke(ctx, pts, 0.35 + random() * 1.12, i % 3 ? 0x777475 : 0xf7f1e3, 0.14 + random() * 0.43)
  }
  hair = texture(c)
  hair.wrapS = T.RepeatWrapping
  return hair
}

let eyeLight, dermisNormals
export function cornealLight() {
  if (eyeLight) return eyeLight
  const c = canvas(512, 256)
  if (!c) return null
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 512, 256)
  cornealWindow(ctx, true)
  eyeLight = texture(c)
  return eyeLight
}
function tissueNormalMap() {
  if (dermisNormals) return dermisNormals
  const c = canvas(256, 256)
  if (!c) return null
  const ctx = c.getContext('2d'),
    pixels = ctx.createImageData(256, 256)
  const random = rng(645173),
    heights = Float32Array.from({ length: 256 * 256 }, () => random())
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const i = (256 * y + x) * 4
      pixels.data[i] = 128 + 3.1 * (heights[256 * y + ((x + 1) % 256)] - heights[256 * y + ((x + 255) % 256)])
      pixels.data[i + 1] = 128 + 3.1 * (heights[256 * ((y + 1) % 256) + x] - heights[256 * ((y + 255) % 256) + x])
      pixels.data[i + 2] = 255
      pixels.data[i + 3] = 255
    }
  ctx.putImageData(pixels, 0, 0)
  dermisNormals = texture(c)
  dermisNormals.colorSpace = T.NoColorSpace
  return dermisNormals
}
export function skinFinish(a) {
  const glaze = canvas(256, 256)
  if (!glaze) return {}
  const g = glaze.getContext('2d')
  g.fillStyle = '#eeeded'
  g.fillRect(0, 0, 256, 256)
  g.setTransform(256 / 0.196, 0, 0, -256 / 0.249, 128, 256 * (1 - 0.006 / 0.249))
  const ny = a?.noseY ?? 0.072,
    my = a?.mouthY ?? 0.048,
    ey = a?.ey ?? 0.108
  wash(g, 0, ny + 0.02, 0.0072, 0.022, 0xbdbdbd, 0.81)
  wash(g, 0, ny + 0.006, 0.009, 0.005, 0xaaaaaa, 0.88)
  wash(g, 0, 0.145, 0.036, 0.027, 0xd4d4d4, 0.66)
  for (const s of [-1, 1]) {
    wash(g, s * 0.047, ey - 0.015, 0.018, 0.0087, 0xd2d2d2, 0.73, s * 0.29)
    if (a) {
      for (let i = 0; i < 16; i++) {
        const t = i / 15,
          o = a.orbit(s, 2 * t - 1),
          h = Math.sin(Math.PI * t)
        wash(g, o.x, o.bottom - 0.0003, 0.003, 0.00085, 0x666666, 0.67 * h)
      }
    }
  }
  if (a) {
    // The glossy band bends with the lower roll; the upper lip remains satin.
    for (let i = 0; i <= 24; i++) {
      const t = i / 12 - 1,
        x = t * a.mw,
        l = a.lip(x)
      const lower = (l.seam + l.lower) * 0.5
      wash(g, x, lower, 0.0031, 0.0007 + (l.seam - l.lower) * 0.36, 0x9e9e9e, 0.69 * (1 - t * t))
    }
  } else wash(g, 0, my - 0.0029, 0.017, 0.0034, 0x9b9b9b, 0.83)
  const roughnessMap = texture(glaze)
  roughnessMap.colorSpace = T.NoColorSpace
  return { normalMap: tissueNormalMap(), normalScale: new T.Vector2(0.23, 0.23), roughness: 0.68, roughnessMap }
}
