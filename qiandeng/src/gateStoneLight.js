import * as T from 'three'
import { bridgeBeacons, keystoneLamp, vaultLamps } from './gateLamps.js'

// The lower half covers the whole dressed elevation. The two upper strips
// unwrap the barrel vaults, so the cage shadows turn the corner into the tunnel.
const width = 512,
  height = 256
const wallWidth = 45,
  wallBottom = -1,
  wallHeight = 11.5
const barrelDepth = 8.7

function bandUV(strip, u, v) {
  const row = strip === 0 ? 0 : 128 + (strip - 1) * 64
  const rows = strip === 0 ? 128 : 64
  return [(0.5 + u * (width - 1)) / width, (row + 0.5 + v * (rows - 1)) / height]
}

export const portalUV = ([x, y]) => bandUV(0, x / wallWidth + 0.5, (y - wallBottom) / wallHeight)
export const vaultUV = (arch, angle, z) =>
  bandUV(arch.x === 0 ? 1 : 2, arch.x < 0 ? 1 - angle / Math.PI : angle / Math.PI, z / barrelDepth + 0.5)

const smooth = (a, b, t) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

// The broad field supplies bounce and distant spill. Here each wick projects
// through its own six open facets onto the actual surface normal. The copper
// shade cuts the light above and the oil tray cuts it below.
function spill(lights, x, y, z, nx, ny, nz) {
  let sum = 0
  for (const lamp of lights) {
    const dx = x - lamp.x,
      dy = y - lamp.y,
      dz = z - lamp.z
    const d2 = dx * dx + dy * dy + dz * dz,
      facing = -(dx * nx + dy * ny + dz * nz)
    if (d2 > 16 || facing <= 0) continue
    const exitY = (dy * lamp.radius) / Math.max(0.035, Math.hypot(dx, dz)) / lamp.height
    const opening = smooth(-0.47, -0.14, exitY) * (1 - smooth(0.16, 0.46, exitY))
    if (opening < 0.001) continue
    // A finite flame gives the bamboo-width bars a small penumbra.
    const angle = Math.atan2(dz, dx)
    const bar = smooth(0.05, 0.39, Math.abs(Math.sin(3 * angle)))
    sum +=
      (lamp.power * 0.147 * facing * (1 - d2 / 16) ** 2 * opening * (0.06 + 0.94 * bar)) /
      ((0.39 + d2) * Math.sqrt(d2 + 0.012))
  }
  return Math.min(1.4, sum)
}

function texture(bytes) {
  const tex = new T.DataTexture(bytes, width, height)
  tex.magFilter = T.LinearFilter
  tex.minFilter = T.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.colorSpace = T.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

export function dressMasonry(m, arches) {
  const mat = m.stone.clone()
  mat.name = 'gate dressed limestone'
  m.gateCutStone = mat
  const source = m.stone.map?.image
  if (!source) return
  const mineral = source.data ?? source.getContext('2d').getImageData(0, 0, source.width, source.height).data
  const albedo = new Uint8Array(width * height * 4),
    transmission = new Uint8Array(albedo.length)
  const front = [keystoneLamp]
  const interior = []
  for (const hand of [-1, 1]) {
    for (const lamp of bridgeBeacons)
      front.push({ ...lamp, x: hand * lamp.x, y: lamp.base + 0.16 + lamp.height * 0.48 })
    for (const lamp of vaultLamps)
      for (const face of [-1, 1]) interior.push({ ...lamp, x: hand * lamp.x, z: face * lamp.z, height: 0.67 })
  }
  const main = arches.find((a) => a.x === 0),
    side = arches.find((a) => a.x > 0)
  for (let j = 0; j < height; j++) {
    const wall = j < 128
    const arch = j < 192 ? main : side
    const v = wall ? j / 127 : ((j - 128) % 64) / 63
    for (let i = 0; i < width; i++) {
      const u = i / (width - 1),
        angle = u * Math.PI
      const c = Math.cos(angle),
        s = Math.sin(angle)
      const x = wall ? (u - 0.5) * wallWidth : arch.x + arch.rx * c
      const y = wall ? wallBottom + v * wallHeight : arch.spring + arch.h * s
      const z = wall ? 4.43 : (v - 0.5) * barrelDepth
      const dx = wall ? 0 : -c / arch.rx,
        dy = wall ? 0 : -s / arch.h
      const inv = wall ? 1 : 1 / Math.hypot(dx, dy)
      const radiance = spill(wall ? front : interior, x, y, z, dx * inv, dy * inv, wall ? 1 : 0)
      const px = Math.floor(u * (wall ? 12.4 : 6.5) * source.width) % source.width
      const py = Math.floor(v * (wall ? 3.2 : 2.55) * source.height) % source.height
      const k = (j * width + i) * 4,
        sample = (py * source.width + px) * 4
      // A dark tide line rises irregularly between the springers.
      const tide = wall ? 0.78 + 0.22 * smooth(0.14, 0.94, y + 0.14 * Math.sin(x * 2.29)) : 1
      const grain = mineral[sample] / 255
      const value = Math.min(1, radiance * 0.78 * grain)
      const srgb = value < 0.003131 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055
      for (let channel = 0; channel < 3; channel++) {
        albedo[k + channel] = Math.round(mineral[sample + channel] * tide)
        transmission[k + channel] = Math.round(srgb * 255)
      }
      albedo[k + 3] = transmission[k + 3] = 255
    }
  }
  mat.map = texture(albedo)
  mat.emissive.set(0xffa75d)
  mat.emissiveIntensity = 1.46
  mat.emissiveMap = texture(transmission)
}
