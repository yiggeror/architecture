import { Color } from 'three'

// A slice can be encoded as soon as every lamp reaching it has contributed.
// Keep eight slices of floating-point scratch and the two final byte textures.
// Lamps keep their registration order even at a slice boundary.
export function bakeLanternVolume(lights, { size: [width, height, depth], origin, step }) {
  const stride = width * height * 4
  const layers = Math.min(8, depth)
  const radiance = new Float32Array(layers * stride)
  const direction = new Float32Array(layers * stride)
  const energy = new Uint8Array(depth * stride)
  const dirs = new Uint8Array(depth * stride)
  const slabs = Array.from({ length: Math.ceil(depth / layers) }, () => [])
  for (const light of lights) {
    const [x, y, z] = light.p
    const r = light.range
    if (r <= 0 || ![x, y, z, r, light.power].every(Number.isFinite)) continue
    const lamp = {
      x: x - origin[0], y: y - origin[1], z: z - origin[2],
      r2: r * r, power: light.power, color: new Color(light.color),
    }
    lamp.left = Math.max(0, Math.floor((lamp.x - r) / step))
    lamp.right = Math.min(width - 1, Math.ceil((lamp.x + r) / step))
    lamp.bottom = Math.max(0, Math.floor((lamp.y - r) / step))
    lamp.top = Math.min(height - 1, Math.ceil((lamp.y + r) / step))
    lamp.front = Math.max(0, Math.floor((lamp.z - r) / step))
    lamp.back = Math.min(depth - 1, Math.ceil((lamp.z + r) / step))
    if (lamp.left > lamp.right || lamp.bottom > lamp.top || lamp.front > lamp.back) continue
    for (let slab = Math.floor(lamp.front / layers); slab <= Math.floor(lamp.back / layers); slab++)
      slabs[slab].push(lamp)
  }
  for (let slab = 0; slab < slabs.length; slab++) {
    const start = slab * layers
    const end = Math.min(start + layers, depth)
    radiance.fill(0)
    direction.fill(0)
    for (const lamp of slabs[slab]) {
      for (let k = Math.max(start, lamp.front); k <= Math.min(end - 1, lamp.back); k++) {
        const dz = lamp.z - k * step
        for (let j = lamp.bottom; j <= lamp.top; j++) {
          const dy = lamp.y - j * step
          const row = ((k - start) * height + j) * width
          if (dy * dy + dz * dz >= lamp.r2) continue
          for (let i = lamp.left; i <= lamp.right; i++) {
            const dx = lamp.x - i * step
            const d2 = dx * dx + dy * dy + dz * dz
            if (d2 >= lamp.r2) continue
            const fade = 1 - d2 / lamp.r2
            const strength = lamp.power * fade * fade / (2.2 + d2)
            const a = (row + i) * 4
            radiance[a] += strength * lamp.color.r
            radiance[a + 1] += strength * lamp.color.g
            radiance[a + 2] += strength * lamp.color.b
            const directional = strength / Math.sqrt(.19 + d2)
            direction[a] += directional * dx
            direction[a + 1] += directional * dy
            direction[a + 2] += directional * dz
            direction[a + 3] += strength
          }
        }
      }
    }
    for (let a = 0; a < (end - start) * stride; a += 4) {
      const dest = start * stride + a
      energy[dest + 3] = dirs[dest + 3] = 255
      const total = direction[a + 3]
      if (!total) {
        dirs[dest] = dirs[dest + 1] = dirs[dest + 2] = 128
        continue
      }
      for (let c = 0; c < 3; c++) {
        energy[dest + c] = Math.round(255 * Math.min(1, Math.sqrt(radiance[a + c] / 12)))
        dirs[dest + c] = Math.round(127.5 * (1 + direction[a + c] / Math.max(.0001, total)))
      }
    }
  }
  return { energy, dirs }
}
