import * as T from 'three'
import { browInk, orbitalWash, vermilion } from './characterVisageInk.js'
import { bell, clamp, hairEdge, parting } from './characterFaceSurface.js'

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
  wash(ctx, 0, 0.153, 0.056, 0.036, 0xffe3b6, 0.14)
  wash(ctx, 0, 0.015, 0.024, 0.01, 0xf4c5a1, 0.19)
  wash(ctx, 0, 0.006, 0.053, 0.01, 0x927f75, 0.21)
  wash(ctx, 0, a.mouthY - 0.011, 0.022, 0.006, 0x8e675a, 0.2)
  for (const s of [-1, 1]) {
    wash(ctx, s * 0.054, a.ey - 0.02, 0.038, 0.023, p.portraitInk?.cheek ?? 0xc17170, 0.24, s * 0.47)
    wash(ctx, s * 0.063, a.ey - 0.006, 0.017, 0.023, p.portraitInk?.cheek ?? 0xb47870, 0.13, s * 0.25)
    wash(ctx, s * 0.043, a.ey - 0.014, 0.021, 0.011, 0xe1ad91, 0.2, s * 0.31)
    wash(ctx, s * 0.06, 0.061, 0.021, 0.032, 0x908680, 0.16, -s * 0.38)
    wash(ctx, s * 0.055, 0.137, 0.02, 0.019, 0x9c8380, 0.19)
    wash(ctx, s * a.ec, a.ey + 0.003, 0.022, 0.013, 0xa4776b, 0.21)
    wash(ctx, s * (a.ec + 0.005), a.ey - 0.01, 0.017, 0.0062, 0x9c776c, 0.1 + a.age * 0.22, s * 0.3)
    wash(ctx, s * (a.ec + 0.008), a.ey - 0.013, 0.014, 0.0053, 0xf0c8af, 0.12, s * 0.34)
    wash(ctx, s * (a.nw + 0.001), a.noseY + 0.017, 0.0068, 0.016, 0xa78076, 0.19, -s * 0.2)
    wash(ctx, s * (a.nw + 0.007), a.noseY - 0.012, 0.009, 0.014, 0xab8672, 0.13, -s * 0.45)
  }
  wash(ctx, 0.00065 * a.asym, a.noseY + 0.018, 0.0055, 0.016, 0xffddbb, 0.13)
  wash(ctx, 0, a.noseY + 0.005, 0.009, 0.0055, 0xd48377, 0.3)
  wash(ctx, -0.00055, a.noseY + 0.0056, 0.0052, 0.003, 0xffdfc3, 0.16)
  wash(ctx, 0, a.noseY - 0.0043, 0.014, 0.0031, 0x967066, 0.19)
  for (const s of [-1, 1]) {
    const x = s * (a.nw - 0.001),
      y = a.noseY - 0.00275
    wash(ctx, x, y, 0.0046, 0.0026, 0xa57869, 0.21, s * 0.24)
    wash(ctx, x, y + 0.0002, 0.0035, 0.0018, 0x8c665a, 0.16, s * 0.24)
    const outline = []
    for (let i = 0; i <= 17; i++) {
      const t = i / 17
      outline.push([s * (a.nw + 0.0046 + 0.00048 * Math.sin(t * Math.PI)), a.noseY - 0.0013 + t * 0.0064])
    }
    stroke(ctx, outline, 0.0003, 0x987064, 0.095)
    for (let j = 0; j < 2; j++) {
      const pts = []
      for (let i = 0; i <= 19; i++) {
        const t = i / 19
        pts.push([
          s * (a.nw + 0.005 + 0.011 * t + 0.003 * Math.sin(t * Math.PI)) + 0.0017 * j,
          a.noseY + 0.0014 - t * 0.023,
        ])
      }
      stroke(ctx, pts, 0.00036, 0x966f60, 0.08 + 0.17 * a.age)
    }
    wash(ctx, s * 0.0042, a.mouthY + 0.0099, 0.0026, 0.0044, 0xeac5b1, 0.069)
  }
  wash(ctx, 0, a.mouthY, 0.034, 0.012, 0xc48272, 0.12)
  wash(ctx, 0, a.mouthY + 0.009, 0.006, 0.0048, 0xb48b76, 0.15)
  vermilion(ctx, a, random)
  for (const s of [-1, 1]) {
    orbitalWash(ctx, a, s)
    browInk(ctx, a, s, random)
    const crease = []
    for (let i = 0; i <= 34; i++) {
      const u = -0.84 + (1.8 * i) / 34,
        o = a.orbit(s, u)
      crease.push([o.x, o.top + 0.0014 + 0.0029 * o.span])
    }
    stroke(ctx, crease, 0.00043, 0x8a675c, 0.26 + 0.15 * a.age)
    const medial = a.orbit(s, -1)
    stroke(
      ctx,
      [
        [medial.x - s * 0.001, medial.y + 0.0024],
        [medial.x - s * 0.00143, medial.y + 0.0006],
        [medial.x - s * 0.00064, medial.y - 0.00118],
      ],
      0.0004,
      0x90645b,
      0.36,
    )
    const under = []
    for (let i = 0; i <= 33; i++) {
      const u = -0.73 + (1.7 * i) / 33,
        o = a.orbit(s, u)
      under.push([o.x, o.bottom - 0.0024 - 0.00065 * o.span])
    }
    stroke(ctx, under, 0.0003, 0xa87968, 0.13)
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
  for (let i = 0; i < 1600; i++) {
    const x = (random() - 0.5) * 0.159,
      y = 0.012 + random() * 0.17,
      alpha = (0.012 + random() * 0.04) * (1 + 0.45 * a.age)
    const rr = 0.0001 + random() * 0.00036
    ctx.beginPath()
    ctx.ellipse(x, y, rr, rr * 0.62, random() * 3, 0, 2 * Math.PI)
    ctx.fillStyle = i % 5 ? '#9d7660' : '#f5d9be'
    ctx.globalAlpha = alpha
    ctx.fill()
  }
  ctx.globalAlpha = 1
  for (let i = 0; i < 9; i++) {
    const s = i % 2 ? 1 : -1
    wash(
      ctx,
      s * (0.03 + random() * 0.03),
      0.071 + random() * 0.025,
      0.00045 + random() * 0.00031,
      0.00055,
      0x8a6753,
      0.23 + a.age * 0.19,
    )
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
      0.13 + random() * 0.52,
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
          0.15 + random() * 0.35,
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
          0.13 + random() * 0.24,
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
let eyes, hair
export function eyeMap() {
  if (eyes) return eyes
  const c = canvas(512, 256)
  if (!c) return null
  const ctx = c.getContext('2d'),
    random = rng(442881)
  const x = 259,
    y = 127,
    r = 83
  const base = ctx.createLinearGradient(0, 50, 0, 201)
  base.addColorStop(0, '#b9a99e')
  base.addColorStop(0.48, '#e1d3c5')
  base.addColorStop(1, '#d3bfaf')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 512, 256)
  wash(ctx, 30, 127, 87, 99, 0xbe877a, 0.52)
  wash(ctx, 488, 125, 65, 88, 0xc69c87, 0.39)
  for (let j = 0; j < 25; j++) {
    const side = j % 2 ? 1 : -1,
      xx = side === 1 ? 490 : 16,
      yy = 72 + random() * 100,
      len = 27 + random() * 82
    stroke(
      ctx,
      [
        [xx, yy],
        [xx - side * len * 0.4, yy + random() * 9 - 4],
        [xx - side * len, yy + random() * 17 - 8],
      ],
      0.48,
      0xb47a70,
      0.2,
    )
  }
  const iris = ctx.createRadialGradient(x, y, 13, x, y, r)
  iris.addColorStop(0, '#382e28')
  iris.addColorStop(0.48, '#624735')
  iris.addColorStop(0.72, '#513e30')
  iris.addColorStop(0.92, '#3b302b')
  iris.addColorStop(1, '#2c2524')
  ctx.fillStyle = iris
  ctx.beginPath()
  ctx.arc(x, y, r, 0, 2 * Math.PI)
  ctx.fill()
  for (let j = 0; j < 470; j++) {
    const a = random() * Math.PI * 2,
      r1 = r * (0.41 + random() * 0.26),
      r2 = r * (0.72 + random() * 0.22),
      d = (random() - 0.5) * 0.07
    stroke(
      ctx,
      [
        [x + Math.cos(a) * r1, y + Math.sin(a) * r1],
        [x + Math.cos(a + d) * (r1 + r2) * 0.5, y + Math.sin(a + d) * (r1 + r2) * 0.5],
        [x + Math.cos(a) * r2, y + Math.sin(a) * r2],
      ],
      0.55 + random() * 0.85,
      j % 3 ? 0x876f54 : 0x3c3029,
      0.13 + random() * 0.26,
    )
  }
  // The eyelid shades the upper iris. The warm reflected crescent of the
  // lower stroma stays inside the limbus as the eye turns in its socket.
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, 2 * Math.PI)
  ctx.clip()
  const lidShadow = ctx.createLinearGradient(0, y - r, 0, y + r * 0.44)
  lidShadow.addColorStop(0, '#19171cf5')
  lidShadow.addColorStop(0.42, '#211b23c9')
  lidShadow.addColorStop(0.85, '#221b2726')
  lidShadow.addColorStop(1, '#211a2000')
  ctx.fillStyle = lidShadow
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
  wash(ctx, x + 8, y + 46, 58, 31, 0x9e7551, 0.51, -0.09)
  ctx.beginPath()
  ctx.arc(x, y, r * 0.969, 0, 2 * Math.PI)
  ctx.lineWidth = 4.1
  ctx.strokeStyle = '#30292d'
  ctx.globalAlpha = 0.83
  ctx.stroke()
  ctx.restore()
  const pupil = ctx.createRadialGradient(x, y, 3, x, y, r * 0.53)
  pupil.addColorStop(0, '#18171c')
  pupil.addColorStop(0.78, '#242027')
  pupil.addColorStop(1, '#2d242600')
  ctx.fillStyle = pupil
  ctx.beginPath()
  ctx.arc(x, y, r * 0.53, 0, 2 * Math.PI)
  ctx.fill()
  wash(ctx, x - 21, y - 12, 16.5, 9.3, 0xfff5e0, 1, -0.28)
  ctx.fillStyle = '#fff8ea'
  ctx.beginPath()
  ctx.ellipse(x - 21, y - 12, 8.2, 4.7, -0.28, 0, Math.PI * 2)
  ctx.fill()
  wash(ctx, x + 26, y + 21, 3.2, 2.1, 0xe8cfaa, 0.62)
  eyes = texture(c)
  return eyes
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

let eyeLight, finish
export function cornealLight() {
  if (eyeLight) return eyeLight
  const c = canvas(512, 256)
  if (!c) return null
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 512, 256)
  wash(ctx, 238, 115, 14, 8, 0xfff1df, 1, -0.28)
  wash(ctx, 285, 148, 3.1, 2.1, 0xd8c5aa, 0.56)
  eyeLight = texture(c)
  return eyeLight
}
export function skinFinish() {
  if (finish) return finish
  const c = canvas(512, 512),
    glaze = canvas(256, 256)
  if (!c) return {}
  const ctx = c.getContext('2d'),
    pixels = ctx.createImageData(512, 512),
    data = pixels.data
  const rngFace = rng(574331),
    height = Float32Array.from({ length: 512 * 512 }, () => rngFace() * 0.082)
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const i = y * 512 + x,
        j = 4 * i
      const nx = height[y * 512 + ((x + 1) % 512)] - height[y * 512 + ((x + 511) % 512)]
      const ny = height[((y + 1) % 512) * 512 + x] - height[((y + 511) % 512) * 512 + x]
      data[j] = Math.round(128 + nx * 126)
      data[j + 1] = Math.round(128 + ny * 126)
      data[j + 2] = 255
      data[j + 3] = 255
    }
  ctx.putImageData(pixels, 0, 0)
  const g = glaze.getContext('2d')
  g.fillStyle = '#edeeee'
  g.fillRect(0, 0, 256, 256)
  g.setTransform(256 / 0.196, 0, 0, -256 / 0.249, 128, 256 * (1 - 0.006 / 0.249))
  wash(g, 0, 0.079, 0.014, 0.025, 0xb7b7b7, 0.86)
  wash(g, 0, 0.047, 0.024, 0.007, 0xb4b4b4, 0.82)
  wash(g, 0, 0.146, 0.033, 0.023, 0xcecece, 0.66)
  const normalMap = texture(c),
    roughnessMap = texture(glaze)
  normalMap.colorSpace = T.NoColorSpace
  roughnessMap.colorSpace = T.NoColorSpace
  finish = { normalMap, normalScale: new T.Vector2(0.36, 0.36), roughness: 0.64, roughnessMap }
  return finish
}
