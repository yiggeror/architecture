import * as T from 'three'
import { paintPipa } from './characterPropPipaPainting.js'
import { generator } from './mesh.js'

// Bookmatched quarter-sawn paulownia and waxed red sandalwood. A slow
// displacement of the growth rings makes the flame run through the ribs.
const finishes = new Map()
export function pipaTimber(front) {
  if (finishes.has(front)) return finishes.get(front)
  const material = new T.MeshStandardMaterial({
    name: front ? '桐面·对拼清漆' : '紫檀·揩蜡',
    color: front ? 0xe6c995 : 0x783f2d,
    vertexColors: true,
    side: T.DoubleSide,
    roughness: front ? 0.53 : 0.35,
  })
  const c =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(512, 768)
      : typeof document !== 'undefined'
        ? document.createElement('canvas')
        : null
  if (c) {
    c.width = 512
    c.height = 768
    const ctx = c.getContext('2d'),
      pixels = ctx.createImageData(c.width, c.height)
    const random = generator(front ? 90277 : 487255)
    const rings = Array.from({ length: 1200 }, () => random())
    const layer = (p) => {
      const i = Math.floor(p) + 800,
        t = p - Math.floor(p)
      return rings[i] + (rings[i + 1] - rings[i]) * t * t * (3 - 2 * t)
    }
    const base = front ? [226, 196, 145] : [122, 64, 45]
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const u = x / c.width,
          v = y / c.height
        const cut = front ? Math.abs(2 * u - 1) * 0.5 : u
        const bend = 0.0035 * Math.sin(v * 6 + cut * 15) + 0.0021 * Math.sin(v * 12 - cut * 9)
        const timber =
          cut +
          bend +
          (front ? 0 : 0.023 * Math.sin(8.4 * v + cut * 16) + 0.018 * Math.sin(13 * v - cut * 17))
        const grain = timber * (front ? 105 : 64)
        const split = 0.8 * Math.pow(Math.max(0, Math.cos(grain * 6.28 + layer(grain * 0.7) * 3.3)), 10)
        const stripe = layer(grain * 0.46) - 0.5
        const glint = front ? 0 : 0.054 * Math.sin(v * 36 + 2.8 * Math.sin(cut * 26 + v * 2))
        const depth =
          1 +
          stripe * (front ? 0.087 : 0.42) -
          split * (front ? 0.06 : 0.14) +
          glint +
          0.017 * (random() - 0.5) +
          0.026 * (layer(grain * 3.1) - 0.5)
        const i = (y * c.width + x) * 4
        for (let k = 0; k < 3; k++) pixels.data[i + k] = base[k] * depth
        pixels.data[i + 3] = 255
      }
    ctx.putImageData(pixels, 0, 0)
    if (front) paintPipa(ctx, c.width, c.height)
    material.color.set(0xffffff)
    material.map = new T.CanvasTexture(c)
    material.map.colorSpace = T.SRGBColorSpace
    material.map.name = material.name
    material.map.anisotropy = 4
  }
  finishes.set(front, material)
  return material
}
