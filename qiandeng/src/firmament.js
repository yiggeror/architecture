import * as T from 'three'
import { generator } from './mesh.js'

const moon = new T.Vector3(-0.87, 0.74, -0.1).normalize()
const sun = new T.Vector3(-0.65, 0.57, 0.49).normalize()

// This painter runs unchanged in a worker and in the synchronous first preview.
// Its three arguments also make the single-file, offline worker self-contained.
function makeSkyPainter(moon, sun, generator) {
  const tau = 2 * Math.PI
  const limit = (x) => Math.max(0, Math.min(1, x))
  const mix = (a, b, t) => a + (b - a) * t
  function smooth(a, b, x) {
    const k = limit((x - a) / (b - a))
    return k * k * (3 - 2 * k)
  }

  // One periodic volume describes the scalloped heads, joined bodies, and dissolving
  // edges of the cloud banks. All sizes here are cloud-scale, independent of the island.
  const side = 128
  const mask = side - 1
  const slice = side * side
  const levels = 43
  const span = 20
  const step = span / side
  const vStep = 0.085
  const depth = (levels - 1) * vStep

  const shuffle = new Uint8Array(512)
  {
    const rng = generator(87211)
    const order = Uint8Array.from({ length: 256 }, (_, i) => i)
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const a = order[j]
      order[j] = order[i]
      order[i] = a
    }
    for (let i = 0; i < 512; i++) shuffle[i] = order[i & 255]
  }

  function noise(x, y, z, wrap = 255) {
    const a = Math.floor(x),
      b = Math.floor(y),
      c = Math.floor(z)
    let u = x - a,
      v = y - b,
      w = z - c
    u *= u * (3 - 2 * u)
    v *= v * (3 - 2 * v)
    w *= w * (3 - 2 * w)
    const a0 = shuffle[a & wrap],
      a1 = shuffle[(a + 1) & wrap]
    const c0 = c & wrap,
      c1 = (c + 1) & wrap
    const b0 = b & 255,
      b1 = (b + 1) & 255
    const p = shuffle[a0 + b0],
      q = shuffle[a1 + b0]
    const r = shuffle[a0 + b1],
      s = shuffle[a1 + b1]
    return (
      mix(
        mix(mix(shuffle[p + c0], shuffle[q + c0], u), mix(shuffle[r + c0], shuffle[s + c0], u), v),
        mix(mix(shuffle[p + c1], shuffle[q + c1], u), mix(shuffle[r + c1], shuffle[s + c1], u), v),
        w
      ) / 255
    )
  }

  function cloudVolume() {
    const size = levels * slice
    const distance = new Float32Array(size).fill(-0.9)
    const rng = generator(21893)
    const range = (lo, hi) => mix(lo, hi, rng())
    function lobe(cx, cy, cz, rx, ry, rz) {
      const edge = 0.57
      const x0 = Math.floor((cx - rx - edge) / step),
        x1 = Math.ceil((cx + rx + edge) / step)
      const z0 = Math.floor((cz - rz - edge) / step),
        z1 = Math.ceil((cz + rz + edge) / step)
      const y0 = Math.max(0, Math.floor((cy - ry - edge) / vStep))
      const y1 = Math.min(levels - 1, Math.ceil((cy + ry + edge) / vStep))
      const radius = Math.min(rx, ry, rz)
      for (let j = y0; j <= y1; j++) {
        const yy = ((j * vStep - cy) / ry) ** 2,
          row = j * slice
        for (let k = z0; k <= z1; k++) {
          const yz = yy + ((k * step - cz) / rz) ** 2,
            line = row + (k & mask) * side
          for (let i = x0; i <= x1; i++) {
            const d = radius * (1 - Math.sqrt(yz + ((i * step - cx) / rx) ** 2))
            const at = line + (i & mask),
              prev = distance[at]
            const blend = Math.max(0, 0.23 - Math.abs(prev - d))
            distance[at] = Math.max(d, prev) + (blend * blend) / 0.92
          }
        }
      }
    }
    // Families of unequal turrets share a broad base, with small buds growing off
    // their shoulders. The gaps between families remain visible from the zenith.
    for (let b = 0; b < 5; b++) {
      for (let a = 0; a < 5; a++) {
        const x = (a + range(0.12, 0.94)) * 4,
          z = (b + range(0.08, 0.96)) * 4
        const theta = range(-0.7, 0.7),
          w = range(0.77, 1.36)
        const tall = range(0.65, 1.7),
          y = range(0.83, 1.18)
        lobe(x, y, z, 2.18 * w, 0.76 * w, 1.36 * w)
        const heads = Math.floor(range(3, 7))
        for (let c = 0; c < heads; c++) {
          const t = (c + 0.32) / heads,
            dd = (t - 0.5) * 3.1 * w
          const xx = x + Math.cos(theta) * dd,
            zz = z + Math.sin(theta) * dd + range(-0.35, 0.35)
          const r = range(0.64, 1.03) * w,
            height = tall * (0.54 + Math.sin(t * Math.PI) * 0.46)
          const yy = Math.min(2.55, y + height * range(0.38, 0.82))
          lobe(xx, yy, zz, r * 1.18, r * range(0.81, 1.16), r)
          for (let c1 = 0; c1 < 5; c1++) {
            const angle = rng() * tau,
              radius = r * range(0.3, 0.55)
            lobe(
              xx + Math.cos(angle) * r * range(0.64, 0.96),
              yy + r * range(-0.21, 0.63),
              zz + Math.sin(angle) * r * range(0.63, 0.95),
              radius * 1.3,
              radius,
              radius * 1.06
            )
          }
        }
      }
    }
    const density = new Uint8Array(size)
    for (let j = 1; j < levels - 1; j++) {
      const h = j * vStep
      for (let k = 0; k < side; k++) {
        for (let i = 0; i < side; i++) {
          const at = j * slice + k * side + i,
            d = distance[at]
          if (d < -0.48) continue
          const large = noise(i / 16, h * 1.54 + 13.6, k / 16, 7)
          const medium = noise(i / 8 + 5, h * 3.1 + 33.8, k / 8 + 2, 15)
          const fine = noise(i / 4 + 3, h * 5.8 + 8.6, k / 4 + 17, 31)
          const turbulence = (large - 0.5) * 0.7 + (medium - 0.5) * 0.37 + (fine - 0.5) * 0.15
          density[at] = Math.round(255 * smooth(-0.1, 0.29, d + 1.29 * turbulence))
        }
      }
    }
    // March light through the same volume as the eye ray. Each slice inherits the
    // optical depth of the slice above it along the incoming light direction.
    function illumination(dir) {
      const field = new Float32Array(size)
      const light = new Uint8Array(size)
      const dx = ((dir.x / dir.y) * vStep) / step,
        dz = ((dir.z / dir.y) * vStep) / step
      const ix = Math.floor(dx),
        iz = Math.floor(dz),
        fx = dx - ix,
        fz = dz - iz
      const length = vStep / dir.y
      for (let j = levels - 1; j >= 0; j--) {
        for (let k = 0; k < side; k++) {
          const k0 = ((k + iz) & mask) * side,
            k1 = ((k + iz + 1) & mask) * side
          for (let i = 0; i < side; i++) {
            const at = j * slice + k * side + i
            let above = 0
            if (j < levels - 1) {
              const i0 = (i + ix) & mask,
                i1 = (i + ix + 1) & mask,
                row = (j + 1) * slice
              above = mix(
                mix(field[row + k0 + i0], field[row + k0 + i1], fx),
                mix(field[row + k1 + i0], field[row + k1 + i1], fx),
                fz
              )
            }
            const own = (density[at] / 255) * length
            field[at] = above + own
            light[at] = Math.round(255 * Math.exp(-1.42 * (above + own * 0.5)))
          }
        }
      }
      return light
    }
    return {
      density,
      moon: illumination(moon),
      sun: illumination(sun),
      ambient: illumination({ x: 0, y: 1, z: 0 }),
    }
  }

  let volume
  const lightOut = { density: 0, direct: 0, ambient: 0 }
  function sampleVolume(x, y, z, direct) {
    // Distort the whole light field as well as the density. Finer billows then
    // carry their own shade instead of appearing as speckles on a smooth body.
    const crease = noise(1.6 * x, 2.8 * y + 8, 1.6 * z)
    const bud = noise(4.7 * x + crease, 5.7 * y + 11, 4.7 * z - crease)
    const edge = noise(10.3 * x, 10.5 * y + 5, 10.3 * z)
    x += (crease - 0.5) * 0.51 + (bud - 0.5) * 0.21
    y += (crease - 0.5) * 0.72 + (bud - 0.5) * 0.35 + (edge - 0.5) * 0.12
    z += (crease - 0.5) * 0.4 - (bud - 0.5) * 0.14
    const sx = x / step,
      sy = Math.min(levels - 1.001, Math.max(0, y / vStep)),
      sz = z / step
    const ix = Math.floor(sx),
      iy = Math.floor(sy),
      iz = Math.floor(sz)
    const fx = sx - ix,
      fy = sy - iy,
      fz = sz - iz
    const row = iy * slice,
      z0 = (iz & mask) * side,
      z1 = ((iz + 1) & mask) * side
    const x0 = ix & mask,
      x1 = (ix + 1) & mask
    const i = row + z0 + x0,
      j = row + z0 + x1,
      k = row + z1 + x0,
      l = row + z1 + x1
    function read(table) {
      return (
        mix(
          mix(mix(table[i], table[j], fx), mix(table[k], table[l], fx), fz),
          mix(mix(table[i + slice], table[j + slice], fx), mix(table[k + slice], table[l + slice], fx), fz),
          fy
        ) / 255
      )
    }
    lightOut.density = Math.max(0, read(volume.density) * (0.85 + 0.45 * bud) - (0.11 + 0.14 * edge))
    if (lightOut.density > 0.002) {
      lightOut.direct = limit(read(direct) * (0.85 + 0.22 * bud + 0.14 * edge))
      lightOut.ambient = read(volume.ambient)
    }
  }

  const nightColors = {
    top: [4, 8, 17],
    high: [9, 16, 29],
    horizon: [18, 29, 43],
    twilight: [1, 1, 2],
    opening: [56, 74, 94],
    fibre: [19, 30, 46],
    shadow: [4, 8, 16],
    bounce: [7, 12, 18],
    pearl: [31, 46, 63],
    below: [6, 11, 22],
    underLight: [39, 56, 74],
  }
  const dayColors = {
    top: [61, 128, 177],
    high: [133, 177, 199],
    horizon: [231, 214, 189],
    twilight: [9, -3, -12],
    opening: [253, 226, 175],
    fibre: [232, 226, 211],
    shadow: [106, 135, 153],
    bounce: [53, 49, 52],
    pearl: [255, 235, 201],
    below: [117, 142, 165],
    underLight: [251, 239, 216],
  }

  function skyPainting(day, width, height) {
    volume ??= cloudVolume()
    const canvas = new Uint8Array(width * height * 4)
    const p = day ? dayColors : nightColors,
      light = day ? sun : moon
    const direct = day ? volume.sun : volume.moon
    const ax = Array.from({ length: width }, (_, i) => Math.cos(tau * ((i + 0.5) / width - 0.5)))
    const az = Array.from({ length: width }, (_, i) => Math.sin(tau * ((i + 0.5) / width - 0.5)))
    const background = [0, 0, 0],
      hazeColor = [0, 0, 0],
      color = [0, 0, 0]
    const sea = [0, 0, 0],
      canopy = [0, 0, 0],
      towers = [0, 0, 0],
      lower = [0, 0, 0]
    const horizontal = Math.hypot(light.x, light.z)
    const sidex = -light.z / horizontal,
      sidez = light.x / horizontal
    const upx = (-light.x * light.y) / horizontal,
      upz = (-light.z * light.y) / horizontal
    for (let row = 0; row < height; row++) {
      const latitude = Math.PI * ((row + 0.5) / height - 0.5)
      const y = Math.sin(latitude),
        cosLat = Math.cos(latitude)
      const horizontalHaze = Math.exp(-Math.abs(y - (day ? 0.025 : 0.009)) * (day ? 4.6 : 13.6))
      for (let col = 0; col < width; col++) {
        const x = cosLat * ax[col],
          z = cosLat * az[col]
        const alignment = x * light.x + y * light.y + z * light.z
        const nearLight = Math.max(0, alignment)
        // Sides of the break are unequal. Its long, slanted axis is across the wind.
        const cross = x * sidex + z * sidez
        const lift = x * upx + y * horizontal + z * upz
        const shear = lift + cross * (day ? 0.31 : 0.22) + cross * cross * 0.26
        const gap = Math.max(0, alignment) ** 3 * Math.exp(-(3.1 * cross * cross + 19 * shear * shear))
        const daylightHalo = day ? Math.min(0.96, nearLight ** 18 * 0.68 + nearLight ** 95 * 0.28) : 0
        const dusk = Math.max(0, 0.49 * x + 0.86 * z) * (1 - 0.6 * Math.abs(y))
        const high = 1 - Math.max(0, y) ** 0.66
        for (let s = 0; s < 3; s++) {
          hazeColor[s] = mix(
            p.horizon[s],
            p.opening[s],
            day ? nearLight ** 3 * 0.73 : nearLight ** 29 * 0.056
          )
          hazeColor[s] += p.twilight[s] * dusk
          background[s] = mix(mix(p.top[s], p.high[s], high), hazeColor[s], horizontalHaze * 0.91)
          background[s] = mix(background[s], p.opening[s], daylightHalo)
        }
        // A separate high veil shears over the cumulus. Fine parallel filaments
        // follow a curved jet and disappear into stretches of clear sky.
        const u = 0.93 * x + 0.37 * z,
          v = 0.93 * z - 0.37 * x
        const twist = noise(u * 2 + 11.3, y * 2.6 + 21, v * 2.8 + 12.5)
        const curl = y + 0.29 * v + 0.19 * Math.sin(u * 2.9 + v * 0.9) + 0.2 * twist
        const whorl = noise(u * 2.1 + 8.8, curl * 10.4 + 26.1, v * 3.3 + 0.4)
        const strokes = noise(u * 4.4 + 29.3, curl * 36 + 3 * whorl, v * 4.8 + 16.7)
        const needle = noise(u * 9 + 19.6, curl * 98 + 9 * whorl + 4 * twist, v * 9 + 7)
        const stria = 0.5 + 0.5 * Math.cos(curl * 92 + 13 * whorl + 8 * twist + 5 * strokes)
        const fibre =
          smooth(0.3, 0.82, whorl + 0.21 * (strokes - 0.5)) *
          (0.09 + 0.48 * smooth(0.29, 0.71, twist)) *
          (0.4 + 0.3 * needle + 0.3 * stria) *
          smooth(-0.04, 0.26, y)
        for (let s = 0; s < 3; s++) background[s] = mix(background[s], p.fibre[s], fibre * (day ? 1 : 0.67))

        let transmission = 0
        if (y > -0.13) {
          // Written into a separate alpha channel so the sharp lunar limb can be
          // resolved at screen resolution underneath passing translucent cloud.
          const curve = 0.032 * (1 - y * y)
          const byHeight = (h) => (2 * h) / (y + Math.sqrt(y * y + 2 * curve * h))
          // A shallow, wind-stretched stratus deck crosses the night sky. In daylight
          // the same atmosphere opens into a much deeper sunlit cumulus field.
          const base = day ? 3.35 : 3.07
          const thickness = day ? 1 : 0.38
          const t0 = byHeight(base),
            t1 = byHeight(base + depth * thickness)
          const n = Math.min(38, Math.ceil((t1 - t0) * 6.3))
          const dt = (t1 - t0) / n
          let opacity = 0
          canopy.fill(0)
          const thinning = day ? 0.08 + gap * 0.63 : 0.19 + gap * 0.63
          for (let i = 0; i < n; i++) {
            const t = t0 + (i + 0.5) * dt
            const h = (t * (y + 0.5 * curve * t) - base) / thickness
            if (day) sampleVolume(x * t * 1.11 + 6.5, h, z * t * 1.11 + 3.8, direct)
            else
              sampleVolume(
                (0.82 * x + 0.38 * z) * t * 0.72 + 12.3,
                h,
                (0.82 * z - 0.38 * x) * t * 1.56 + 8.7,
                direct
              )
            const den = Math.max(0, lightOut.density - thinning) * (1 - thinning)
            if (den < 0.004) continue
            const alpha = (1 - opacity) * (1 - Math.exp(-(day ? 3.8 : 1.85) * den * dt))
            const lambert = lightOut.direct,
              ambient = lightOut.ambient
            const lining = Math.pow(nearLight, 7) * (1 - den) * lambert * 0.46
            const silver = Math.min(1, lambert * (0.45 + 0.4 * nearLight + 0.15 * ambient) + lining)
            const aerial = Math.min(0.66, 1 - Math.exp(-0.019 * t))
            for (let s = 0; s < 3; s++) {
              const ink = p.shadow[s] + p.bounce[s] * (0.14 + 0.47 * ambient)
              const lit = mix(ink, p.pearl[s], silver)
              canopy[s] += alpha * mix(lit, hazeColor[s], aerial)
            }
            opacity += alpha
            if (opacity > 0.992) break
          }
          const edge = smooth(-0.12, 0.05, y)
          for (let s = 0; s < 3; s++)
            color[s] = mix(background[s], canopy[s] + background[s] * (1 - opacity), edge)
          transmission = 1 - opacity * edge
        } else {
          for (let s = 0; s < 3; s++) color[s] = hazeColor[s]
        }

        // The lower banks are observed from above. Their visible slopes receive
        // light through the same 3D density as the overhead clouds.
        if (y < 0.065) {
          const dy = Math.max(0.024, -y)
          const bottom = 3.8
          const t0 = Math.min(65, bottom / dy),
            t1 = Math.min(75, (bottom + depth) / dy)
          const n = Math.min(47, Math.max(16, Math.ceil((t1 - t0) * 7)))
          const dt = (t1 - t0) / n
          let opacity = 0
          sea.fill(0)
          for (let i = 0; i < n; i++) {
            const t = t0 + (i + 0.5) * dt
            const h = depth + bottom - t * dy
            sampleVolume(x * t + (day ? 10.7 : 13.1), h, z * t + (day ? 9.7 : 3.9), direct)
            const den = lightOut.density
            if (den < 0.003) continue
            const alpha = (1 - opacity) * (1 - Math.exp(-3.8 * den * dt))
            const lambert = lightOut.direct,
              ambient = lightOut.ambient
            const lightness = 0.77 * lambert + 0.23 * ambient
            const aerial = Math.min(0.97, 1 - Math.exp(-0.031 * t))
            for (let s = 0; s < 3; s++) {
              const lit = mix(p.shadow[s], p.underLight[s], lightness)
              sea[s] += alpha * mix(lit, hazeColor[s], aerial)
            }
            opacity += alpha
            if (opacity > 0.993) break
          }
          const blend = 1 - smooth(-0.13, 0.052, y)
          const farHaze = Math.max(0.15, Math.exp(-dy * 4.3))
          let lowOpacity = 0
          lower.fill(0)
          if (opacity < 0.91 && y < -0.095) {
            const top = 8.6,
              t0 = top / dy,
              t1 = (top + depth) / dy
            const n = Math.min(28, Math.max(14, Math.ceil((t1 - t0) * 3.7)))
            const dt = (t1 - t0) / n
            for (let i = 0; i < n; i++) {
              const t = t0 + (i + 0.5) * dt,
                h = depth + top - t * dy
              sampleVolume(x * t * 0.91 + 3.7, h, z * t * 0.91 + 15.2, direct)
              const den = lightOut.density
              if (den < 0.007) continue
              const a = (1 - lowOpacity) * (1 - Math.exp(-3.8 * dt * den))
              const light = 0.63 * lightOut.direct + 0.24 * lightOut.ambient
              for (let s = 0; s < 3; s++) {
                lower[s] += a * mix(mix(p.below[s], p.underLight[s], light), hazeColor[s], 0.29)
              }
              lowOpacity += a
              if (lowOpacity > 0.975) break
            }
          }
          const dist = 15 / dy
          const distantField = noise(x * dist * 0.95 + 6.3, 13.6, z * dist * 0.95 + 2.8)
          for (let s = 0; s < 3; s++) {
            const far = mix(mix(p.below[s], p.underLight[s], distantField * 0.38), hazeColor[s], farHaze)
            const trough = lower[s] + (1 - lowOpacity) * far
            color[s] = mix(color[s], sea[s] + (1 - opacity) * trough, blend)
          }
        }
        // Distant storm towers climb above the sea on only part of the skyline.
        // The ray passes through their protruding shoulders and into the air beyond.
        if (y > -0.14 && y < 0.19) {
          const bank =
            0.54 + 0.3 * Math.sin(2.8 * x + 1.9 * z) + 0.17 * Math.sin(6.1 * x - 4.8 * z) - 0.25 * gap
          const near = 11.6 + 2.5 * Math.cos(3.2 * z + 2.4 * x)
          const far = near + 8.8 + bank * 3.2
          const stride = 0.48
          let opacity = 0
          towers.fill(0)
          for (let t = near; t < far; t += stride) {
            const h = y * t + (2.94 - 1.07 * bank)
            if (h <= 0 || h >= depth) continue
            sampleVolume(x * t * 0.75 + (day ? 12 : 4.8), h, z * t * 0.75 + (day ? 9.3 : 4.6), direct)
            const den = Math.max(0, lightOut.density - (0.41 - 0.23 * bank))
            if (den < 0.008) continue
            const envelope = smooth(near, near + 2.4, t) * (1 - smooth(far - 2.0, far, t))
            const alpha = (1 - opacity) * (1 - Math.exp(-den * stride * 2.6)) * envelope
            const silver = lightOut.direct * 0.74 + lightOut.ambient * 0.26
            const aerial = 0.55 + (0.21 * (t - near)) / (far - near)
            for (let s = 0; s < 3; s++) {
              const lit = mix(p.shadow[s], p.pearl[s] + 8 * nearLight, silver)
              towers[s] += alpha * mix(lit, hazeColor[s], aerial)
            }
            opacity += alpha
          }
          const veil = smooth(-0.14, -0.04, y) * (1 - smooth(0.15, 0.19, y)) * smooth(0.19, 0.74, bank)
          for (let s = 0; s < 3; s++)
            color[s] = mix(color[s], towers[s] + (1 - opacity) * color[s], veil * (day ? 1 : 0.25))
        }
        const at = (row * width + col) * 4
        const grain = noise(x * 201, y * 201, z * 201) - 0.5
        for (let s = 0; s < 3; s++)
          canvas[at + s] = Math.max(0, Math.min(255, Math.round(color[s] + grain * 1.1)))
        canvas[at + 3] = Math.round(255 * transmission)
      }
    }
    return canvas
  }
  return skyPainting
}

function textureOf(pixels, width) {
  const texture = new T.DataTexture(pixels, width, width / 2)
  texture.wrapS = T.RepeatWrapping
  texture.minFilter = T.LinearFilter
  texture.magFilter = T.LinearFilter
  texture.needsUpdate = true
  return texture
}

// Tileable curl and wisp fields. Sampling them on two curved atmospheric decks
// gives passing cloud shadows a different motion from the broad cloud masses.
function movingVeil() {
  const size = 256,
    rng = generator(78342)
  const table = Float32Array.from({ length: 64 * 64 }, () => rng())
  const n = (x, y, period) => {
    const a = Math.floor(x),
      b = Math.floor(y),
      m = period - 1
    let u = x - a,
      v = y - b
    u = u * u * (3 - 2 * u)
    v = v * v * (3 - 2 * v)
    const p = table[(a & m) + 64 * (b & m)],
      q = table[((a + 1) & m) + 64 * (b & m)]
    const r = table[(a & m) + 64 * ((b + 1) & m)],
      s = table[((a + 1) & m) + 64 * ((b + 1) & m)]
    return (p + (q - p) * u) * (1 - v) + (r + (s - r) * u) * v
  }
  const bytes = new Uint8Array(size * size * 4)
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const x = i / size,
        y = j / size
      const warp = n(4 * x + 3, 4 * y + 11, 4) - 0.5
      const broad = n(4 * x + warp, 4 * y + warp * 0.9 + 6, 4)
      const mid = n(8 * x + 9, 8 * y - 1.8 * warp, 8)
      const fine = n(32 * x + warp * 4, 32 * y - mid * 3, 32)
      const at = 4 * (i + j * size)
      bytes[at] = 255 * (0.55 * broad + 0.32 * mid + 0.13 * fine)
      bytes[at + 1] =
        255 *
        (0.48 * n(4 * x + 1, 4 * y - 1.3 * warp, 4) +
          0.37 * n(16 * x + 2, 16 * y + 2 * mid, 16) +
          0.15 * fine)
      bytes[at + 2] = 255 * (0.3 + 0.5 * warp + 0.2 * mid)
      bytes[at + 3] = 255
    }
  const texture = new T.DataTexture(bytes, size, size)
  texture.wrapS = texture.wrapT = T.RepeatWrapping
  texture.magFilter = texture.minFilter = T.LinearFilter
  texture.needsUpdate = true
  return texture
}

export function firmament(scene, initialDay) {
  const shader = new T.ShaderMaterial({
    uniforms: {
      atlas: { value: null },
      daylight: { value: 0 },
      skyTime: { value: 0 },
      passing: { value: movingVeil() },
      luminary: { value: moon.clone() },
    },
    side: T.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 ray;
      void main() {
        ray = position;
        // Translation cancels for every camera, including the mirror camera.
        vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
        gl_Position = clip.xyww;
      }`,
    fragmentShader: `
      varying vec3 ray;
      uniform sampler2D atlas;
      uniform float daylight, skyTime;
      uniform sampler2D passing;
      uniform vec3 luminary;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise2(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
      }
      void main() {
        vec3 d = normalize(ray);
        vec3 shift = cameraPosition / (1. + length(cameraPosition)/380.);
        vec3 paintedRay = normalize(d + shift * (max(0.,-d.y)/475.) * smoothstep(.03,.34,-d.y));
        // The undercast, the middle banks, and the thin upper veils travel at
        // different speeds. The lunar surface stays fixed behind all three.
        float turn=.079*sin(skyTime*.020+d.y*2.8)+.023*sin(skyTime*.043+d.z*3.);
        float ct=cos(turn),st=sin(turn);
        paintedRay.xz=mat2(ct,st,-st,ct)*paintedRay.xz;
        paintedRay.y += .014*sin(2.62*paintedRay.x-1.5*paintedRay.z+skyTime*.039)*
          smoothstep(-.11,.42,paintedRay.y);
        paintedRay=normalize(paintedRay);
        vec2 uv = vec2(atan(paintedRay.z,paintedRay.x)*0.159154943+0.5,
                       asin(clamp(paintedRay.y,-1.,1.))*0.318309886+0.5);
        vec4 ink = texture2D(atlas,uv);
        vec2 air=d.xz/(.40+sqrt(.18+d.y*d.y)+max(0.,d.y));
        vec2 advection = skyTime*vec2(.00115,-.00058);
        vec4 weather = texture2D(passing,air*.59+advection+vec2(.07,.14));
        vec2 wisps = texture2D(passing,vec2(air.x*.53+air.y*.12,air.y*1.38)+
                           vec2(.31,.62)-advection*.62+weather.gb*.046).rg;
        float veil = smoothstep(.31,.73,weather.r+.26*(wisps.x-.5));
        float filaments = smoothstep(.38,.78,wisps.y+(.5-weather.g)*.18);
        float bank = smoothstep(-.04,.27,d.y)*(veil*.61+filaments*.32);
        float againstLight = pow(max(0.,dot(d,luminary)),12.);
        vec3 mist=mix(mix(vec3(.048,.078,.119),vec3(.112,.148,.192),againstLight),
                      mix(vec3(.79,.82,.84),vec3(.99,.91,.77),againstLight),daylight);
        ink.rgb=mix(ink.rgb,mist,bank*mix(.125,.27,daylight));
        ink.a *= 1.-bank*.67;
        // A thin broken scud passes in front of the bright gap. Its upper edge
        // gathers silver light as its dense middle obscures the lunar markings.
        vec3 right=normalize(cross(vec3(0.,1.,0.),luminary));
        vec3 up=cross(luminary,right);
        vec2 tangent=vec2(dot(d,right),dot(d,up));
        float passage=(fract(skyTime*.009+.375)-.5)*.84;
        float fold=tangent.y+.24*tangent.x+.039*sin(7.*tangent.x+.65)+
                   .105*(weather.g-.5)+.069*(wisps.y-.5)-passage;
        float thickness=.020+.064*weather.r;
        float fringe=exp(-pow((fold-thickness*.74)/(.015+.018*wisps.x),2.));
        float scud=exp(-pow(fold/thickness,2.))*(.40+.55*smoothstep(.23,.72,wisps.x));
        scud*=pow(max(0.,dot(d,luminary)),4.)*(1.-smoothstep(.27,.40,abs(passage)));
        vec3 vapor=mix(vec3(.073,.103,.146),vec3(.73,.75,.78),daylight)+fringe*mix(.018,.11,daylight);
        ink.rgb=mix(ink.rgb,vapor,scud*mix(.49,.32,daylight));
        ink.a*=1.-scud*mix(.95,.63,daylight);
        // Lunar diffraction follows the moon itself, behind the moving rain.
        float lunarAngle=length(d-luminary);
        ink.rgb+=(1.-daylight)*ink.a*vec3(.031,.040,.048)*exp(-lunarAngle*lunarAngle/.00064);
        // Convert painted display values to scene radiance for the filmic compositor.
        vec3 v = pow(ink.rgb,vec3(2.2));
        vec3 a = vec3(1.)-.983729*v;
        vec3 b = .0245786-.432951*v;
        vec3 c = -.000090537-.238081*v;
        vec3 color = .60*(-b+sqrt(b*b-4.*a*c))/(2.*a);
        float radius = mix(.0102,.023,daylight);
        vec2 disc = vec2(dot(d,right),dot(d,up))/radius;
        float r = length(disc);
        float aa = max(fwidth(r),.002);
        if (dot(d,luminary)>.99 && r<1.+aa) {
          float maria = .57*noise2(disc*3.4+9.2)+.28*noise2(disc*8.4-3.6)+.15*noise2(disc*23.+12.);
          float radialZ=sqrt(max(0.,1.-r*r));
          float phase=smoothstep(-.04,.10,-.73*disc.x+.23*disc.y+.36*radialZ);
          vec3 pearl=mix(vec3(.38,.45,.49),vec3(.89,.93,.86),smoothstep(.31,.76,maria));
          pearl=mix(color*.86,pearl*(.81+.19*radialZ),phase);
          vec3 body=mix(pearl,vec3(4.8,3.8,2.55),daylight);
          color = mix(color,body,(1.-smoothstep(1.-aa,1.+aa,r))*ink.a*.97);
        }
        gl_FragColor = vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const sky = new T.Mesh(new T.BoxGeometry(2, 2, 2), shader)
  sky.name = '云天'
  sky.userData.animated = true
  sky.frustumCulled = false
  sky.renderOrder = 90
  scene.add(sky)
  const maps = []
  const finalWidth = 1408
  let previewsReady
  const ready = new Promise((resolve) => { previewsReady = resolve })
  let paint,
    active = 0,
    painterWorker
  function accept(day, pixels, width) {
    const id = Number(day)
    if (maps[id] && maps[id].image.width >= width) return
    const old = maps[id]
    maps[id] = textureOf(pixels, width)
    if (active === id) {
      shader.uniforms.atlas.value = maps[id]
      scene.dispatchEvent({ type: 'sky-painted' })
    }
    old?.dispose()
    if (maps[0] && maps[1]) previewsReady()
  }
  // While the garden is coming into view, trace two finer panoramas away from
  // the input/render thread. Switching modes reuses the finished textures.
  if (typeof Worker !== 'undefined') {
    const source =
      'const paint=(' +
      makeSkyPainter.toString() +
      ')(' +
      JSON.stringify(moon) +
      ',' +
      JSON.stringify(sun) +
      ',(' +
      generator.toString() +
      '));' +
      'onmessage=({data:{day,width}})=>{const pixels=paint(day,width,width/2);' +
      'postMessage({day,width,pixels},[pixels.buffer])}'
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
    try {
      painterWorker = new Worker(url)
      painterWorker.onmessage = ({ data: { day, width, pixels } }) => {
        accept(day, pixels, width)
        if (maps[0]?.image.width === finalWidth && maps[1]?.image.width === finalWidth) {
          painterWorker.terminate()
          painterWorker = null
          paint = null
        }
      }
      painterWorker.onerror = () => {
        painterWorker.terminate()
        painterWorker = null
        previewsReady()
        // A restricted document can decline blob workers after construction.
        // Finish the currently visible sky there as well.
        const day = Boolean(active)
        setTimeout(() => {
          if (maps[Number(day)]?.image.width === finalWidth) return
          paint ??= makeSkyPainter(moon, sun, generator)
          accept(day, paint(day, finalWidth, finalWidth / 2), finalWidth)
        }, 0)
      }
      for (const width of [512, finalWidth])
        for (const day of [initialDay, !initialDay]) painterWorker.postMessage({ day, width })
    } catch {
      painterWorker = null
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  if (!painterWorker) previewsReady()
  function mode(day) {
    active = Number(day)
    if (!maps[active] || (!painterWorker && maps[active].image.width < finalWidth)) {
      paint ??= makeSkyPainter(moon, sun, generator)
      const width = painterWorker ? 512 : finalWidth
      const old = maps[active]
      maps[active] = textureOf(paint(day, width, width / 2), width)
      old?.dispose()
    }
    shader.uniforms.atlas.value = maps[active]
    shader.uniforms.daylight.value = active
    shader.uniforms.luminary.value.copy(day ? sun : moon)
  }
  const north = new T.Vector3(0, 1, 0)
  function update(t, day) {
    shader.uniforms.skyTime.value = t
    if (day) {
      const direction = shader.uniforms.luminary.value.copy(sun)
      direction.applyAxisAngle(north, 0.071 * Math.sin(t * 0.011))
      direction.y += 0.027 * Math.sin(t * 0.006)
      direction.normalize()
    }
  }
  return { mode, update, ready }
}
