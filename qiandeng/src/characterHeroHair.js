import * as T from 'three'
import { bell, clamp, hairEdge, mix, smooth } from './characterFaceSurface.js'
import { PortraitMesh, ovoid, point, sweep, tint } from './characterFaceMesh.js'

const tau = Math.PI * 2
const naturalStyles = { silk: 'loop', lute: 'coil', scholar: 'half', drummer: 'half' }
const names = { silk: '朝云髻与包鬓', lute: '水纹低髻', scholar: '束发文冠', drummer: '额帛与翻髻' }
const dye = {
  silk: [0x322b32, 0x6a605e],
  lute: [0x392e2d, 0x6d5c56],
  scholar: [0x242a33, 0x606268],
  drummer: [0x352b2a, 0x775f56],
}
const blend = (a, b, t) => a.map((v, i) => mix(v, b[i], t))
const shade = (a, k) => a.map((v) => clamp(v * k))
const envelope = (t) => Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.65)
const pole = new T.Vector3(0, 1, 0)
let fibreMaterial, ornamentMaterial

// The same material carries solid combed masses and sparse self-masked
// hairline cards. A glTF MASK material keeps the town's depth pass intact.
function fibrePigment() {
  const w = 2048,
    h = 256,
    bytes = new Uint8Array(w * h * 4)
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const card = i >= w / 2,
        u = ((i % (w / 2)) + 0.5) / (w / 2),
        v = (j + 0.5) / h
      const wander = 0.33 * Math.sin(6.1 * v + 7.7 * u) + 0.18 * Math.sin(10.5 * v - 4.9 * u)
      const flow = u * (card ? 116 : 253) + wander
      const thread = 0.5 + 0.5 * Math.cos(tau * flow + 0.24 * Math.sin(flow * 0.43))
      const fine = Math.cos(tau * (flow * 1.47 + 0.17 * Math.sin(v * 8 + u * 3)))
      const shade = 187 + 39 * (thread - 0.5) + 13 * fine + 7 * Math.sin(u * 87 + v * 4) + 7 * thread ** 5
      const offset = (j * w + i) * 4
      bytes[offset] = shade + 1
      bytes[offset + 1] = shade
      bytes[offset + 2] = shade - 1
      let ink = 1
      if (card) {
        const tip = smooth(0.51, 1, v),
          side = Math.abs(2 * u - 1)
        const solid = 0.53 - 0.22 * tip + 0.024 * Math.sin(6 * v + u * 11)
        const density = 1 - smooth(solid, 1.035, side)
        const split = 0.17 * tip * (0.52 + 0.48 * Math.cos(28 * u + v * 3.2))
        ink = smooth(0.02, 0.19, density - (1 - thread) * 0.79 - split)
      }
      bytes[offset + 3] = Math.round(ink * 255)
    }
  const map = new T.DataTexture(bytes, w, h)
  map.name = '深墨发丝与散鬓遮罩'
  map.colorSpace = T.SRGBColorSpace
  map.minFilter = T.LinearMipmapLinearFilter
  map.magFilter = T.LinearFilter
  map.generateMipmaps = true
  map.anisotropy = 4
  map.needsUpdate = true
  return map
}
function strandFinish() {
  const w = 512,
    h = 256,
    bump = new Uint8Array(w * h * 4),
    rough = new Uint8Array(bump.length)
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w,
        v = j / (h - 1),
        phase =
          tau * (u + 0.0017 * Math.sin(v * 6.7 + tau * u * 3) + 0.0013 * Math.cos(4.3 * v - tau * u * 5))
      const groups = phase * 67 + 0.63 * Math.sin(18 * phase + v * 1.7),
        fine = phase * 143 + 0.35 * Math.cos(27 * phase - v * 3.1)
      const sx = 0.195 * Math.sin(groups) + 0.13 * Math.sin(fine) + 0.058 * Math.cos(phase * 197 + v * 3.1)
      const sy = 0.017 * Math.cos(fine + v * 5) + 0.012 * Math.sin(groups + 0.3),
        n = 1 / Math.hypot(sx, sy, 1)
      const idx = (j * w + i) * 4
      bump[idx] = Math.round((0.5 + 0.5 * sx * n) * 255)
      bump[idx + 1] = Math.round((0.5 + 0.5 * sy * n) * 255)
      bump[idx + 2] = Math.round((0.5 + 0.5 * n) * 255)
      bump[idx + 3] = 255
      const grain =
        0.84 + 0.046 * Math.cos(groups) + 0.031 * Math.cos(fine + 0.2) + 0.024 * Math.cos(9 * phase - v * 5)
      rough[idx] = rough[idx + 1] = rough[idx + 2] = Math.round(255 * grain)
      rough[idx + 3] = 255
    }
  const texture = (bytes, name) => {
    const map = new T.DataTexture(bytes, w, h)
    map.name = name
    map.wrapS = T.RepeatWrapping
    map.magFilter = T.LinearFilter
    map.minFilter = T.LinearMipmapLinearFilter
    map.generateMipmaps = true
    map.needsUpdate = true
    return map
  }
  return {
    normalMap: texture(bump, '发丝梳向 · 细槽法线'),
    normalScale: new T.Vector2(0.6, 0.5),
    roughnessMap: texture(rough, '发束顺逆光 · 粗糙度'),
  }
}

function jewelleryFrame(origin, normal) {
  const at = new T.Vector3(...origin),
    n = new T.Vector3(...normal).normalize()
  const across = new T.Vector3().crossVectors(pole, n).normalize()
  const upright = new T.Vector3().crossVectors(n, across).normalize()
  return (x, y, z = 0) =>
    at.clone().addScaledVector(across, x).addScaledVector(upright, y).addScaledVector(n, z).toArray()
}

// A closed, thin leaf or wing. Both the domed face and its folded underside
// catch the light; all ornaments use the same opaque glTF material and draw.
function petal(mesh, frame, origin, direction, width, colour, bend = 0.0013) {
  const [dx, dy] = direction,
    len = Math.hypot(dx, dy),
    sx = dy / len,
    sy = -dx / len
  mesh.grid(10, 10, (u, t) => {
    const w = width * envelope(t) * (0.66 + 0.46 * t),
      angle = u * tau
    const ds = w * Math.sin(angle),
      camber = Math.sin(t * Math.PI)
    const z = bend * camber + 0.0009 * camber * Math.cos(angle) + 0.0015 * t * t
    const pos = frame(origin[0] + dx * t + sx * ds, origin[1] + dy * t + sy * ds, origin[2] + z)
    return point(pos, [u, t], shade(colour, 0.79 + 0.24 * t + 0.14 * (0.5 + 0.5 * Math.cos(angle))))
  })
}
function bead(mesh, p, r, colour, drop = 1) {
  ovoid(
    mesh,
    p,
    [r, r * drop, r],
    (u, v) => shade(colour, 0.78 + 0.22 * v + 0.1 * Math.sin(Math.PI * v)),
    12,
    8,
  )
}
function wire(mesh, coords, r, color, n = 16) {
  sweep(mesh, coords, r, color, n, 6)
}

// The circumference follows the measured head under every section; the hair
// flows to a different gathering point for each character. The root stays on
// the same line as the short hairs painted into the portrait's skin atlas.
function combScalp(h) {
  const { a, design, hair, metal, dark, light } = h
  const division = { silk: -0.43, lute: 0.23, scholar: -0.58, drummer: 0.3 }[design]
  const summit = { silk: 0.0123, lute: 0.0062, scholar: 0.0067, drummer: 0.0069 }[design],
    skin = tint(a.profile.skin)
  h.scalp = (theta, t, extra = 0) => {
    const side = Math.sin(theta),
      front = Math.max(0, Math.cos(theta))
    const root = hairEdge(a, theta),
      y = mix(root, 0.233, t),
      rise = Math.sin(Math.PI * t)
    if (t < 0) return hairAt(h, theta, y, extra + 0.00015)
    let drift, fullness, lift
    if (design === 'silk') {
      drift = 0.66 * Math.sin(theta - division) * rise + 0.11 * rise * (1 + 0.42 * side)
      fullness = 0.0047 + 0.009 * bell(Math.abs(theta) - 0.94, 0.48) + 0.005 * bell(theta + 0.97, 0.49)
      lift = 0.0085 + 0.0038 * (1 - side)
    } else if (design === 'lute') {
      drift = 0.5 * Math.sin(theta - division) * rise + 0.13 * Math.sin(t * tau) * Math.sin(theta + 0.51)
      fullness =
        0.0038 + 0.0098 * bell(Math.abs(theta) - 1.24, 0.56) + 0.0032 * Math.sin(t * 9 + 2.2 * theta) ** 2
      lift = 0.0049 + 0.0022 * front
    } else if (design === 'scholar') {
      drift = 0.43 * Math.sin(theta - division) * rise + 0.15 * rise * front
      fullness = 0.0028 + 0.0024 * bell(theta + 0.5, 0.5)
      lift = 0.0067
    } else {
      drift =
        0.53 * Math.sin(theta - division) * rise - 0.145 * rise + 0.06 * Math.sin(3 * theta + t * 3) * rise
      fullness = 0.0037 + 0.0045 * bell(theta - 0.83, 0.67)
      lift = 0.0069 + 0.0028 * Math.sin(theta + 0.28)
    }
    const phi = theta + drift,
      si = Math.sin(phi),
      co = Math.cos(phi)
    let base
    if (t < 0.075) base = a.point(phi, y)
    else {
      const ring = a.dimensions(y)
      base = [
        si * ring[0],
        y,
        ring[2] + (co >= 0 ? (ring[1] - ring[2]) * co ** 0.9 : (ring[3] - ring[2]) * (-co) ** 0.91),
      ]
    }
    const rhythm =
      0.91 + 0.1 * Math.sin(theta * 11 + 0.58 * Math.sin(t * 6 + theta)) + 0.043 * Math.cos(theta * 23 + 0.71)
    const delta = rise ** 0.75 * fullness * rhythm + 0.00022 * (1 - t) + extra * Math.sqrt(Math.max(0, 1 - t))
    return [
      base[0] + si * delta,
      base[1] + mix(lift, summit, smooth(0.62, 0.96, t)) * t + 0.0019 * rise,
      base[2] + co * delta,
    ]
  }
  const first = hair.pos.length / 3
  hair.grid(78, 29, (u, t) => {
    const angle = (u - 0.5) * tau,
      P = h.scalp(angle, t)
    const wave =
      0.32 +
      0.063 * Math.sin(angle * 14 + 0.85 * Math.sin(5 * t + 0.83 * angle)) +
      0.036 * Math.cos(angle * 27 + t * 1.9)
    const sheen = 0.1 * bell(t - 0.55, 0.23) + 0.075 * Math.cos(3 * angle - 0.6)
    const colour = blend(dark, light, clamp(wave + sheen, 0.07, 0.67))
    return point(P, [u, t], blend(colour, skin, 0.11 * (1 - smooth(0, 0.022, t))))
  })
  const top = first + 29 * 79,
    cap = h.scalp(0, 1)
  cap[0] = 0
  cap[2] = a.dimensions(0.233)[2]
  const crown = hair.vertex(point(cap, [0.5, 1], blend(dark, light, 0.29)))
  for (let i = 0; i < 78; i++) hair.index.push(top + i, top + i + 1, crown)
  const strip = (t) => division + (0.12 + 0.045 * Math.sin(Math.PI * t)) * t
  metal.grid(4, 25, (u, v) => {
    const t = 0.007 + 0.78 * v,
      theta = strip(t),
      span = 0.0075 * (1 - 0.74 * v) * (1 + 0.15 * Math.sin(v * 19))
    const p = h.scalp(theta + (u - 0.5) * span * 2, t, 0.0004)
    const skin = shade(tint(a.profile.skin), 0.72)
    return point(p, [u, v], blend(dark, skin, Math.sin(Math.PI * u) ** 1.5 * (0.57 - 0.27 * v)))
  })
  for (const sign of [-1, 1])
    for (let j = 0; j < 12; j++) {
      const root = division + sign * (0.039 + j * 0.216 + 0.018 * Math.cos(j * 3.1))
      const first = 0.01 + 0.019 * (j % 3),
        last = 0.6 + 0.31 * (0.5 + 0.5 * Math.cos(j * 2.72))
      hair.grid(4, 19, (u, v) => {
        const t = mix(first, last, v),
          taper = envelope(v),
          halfWidth = 0.03 + 0.02 * (0.5 + 0.5 * Math.sin(j * 4.62))
        const th =
          root +
          (u - 0.5) * 2 * halfWidth * taper +
          0.029 * sign * (Math.sin(v * Math.PI) + Math.sin(v * tau + j) * 0.4)
        const ridge = Math.sin(Math.PI * u) * taper
        const p = h.scalp(th, t, 0.00022 + 0.00105 * ridge)
        const colour = blend(dark, light, 0.25 + 0.28 * ridge + 0.05 * Math.cos(j * 2.2))
        return point(p, [th / tau + 0.5 + 0.002 * u, t], colour)
      })
    }
}

// Slice the finished locks at a given height. A forehead ribbon has to rest
// against bare skin at its centre and pass over brushed hair at the temples.
function cacheHairSlices(h, lo, hi) {
  h.sections ??= new Map()
  const rows = Array.from({ length: hi - lo + 1 }, () => []),
    p = h.hair.pos,
    idx = h.hair.index
  for (let i = 0; i < idx.length; i += 3) {
    const a = 3 * idx[i],
      b = 3 * idx[i + 1],
      c = 3 * idx[i + 2],
      ay = p[a + 1],
      by = p[b + 1],
      cy = p[c + 1]
    const first = Math.max(lo, Math.ceil(1800 * Math.min(ay, by, cy)))
    const last = Math.min(hi, Math.floor(1800 * Math.max(ay, by, cy)))
    for (let row = first; row <= last; row++) {
      const level = row / 1800
      if (ay > level === by > level && ay > level === cy > level) continue
      const odd = ay > level === by > level ? c : by > level === cy > level ? a : b
      const left = odd === a ? b : a,
        right = odd === c ? b : c
      const u = (level - p[odd + 1]) / (p[left + 1] - p[odd + 1]),
        v = (level - p[odd + 1]) / (p[right + 1] - p[odd + 1])
      rows[row - lo].push(
        mix(p[odd], p[left], u),
        mix(p[odd + 2], p[left + 2], u),
        mix(p[odd], p[right], v),
        mix(p[odd + 2], p[right + 2], v),
      )
    }
  }
  rows.forEach((lines, i) => h.sections.set(i + lo, lines))
}
function hairSlice(h, y) {
  const level = Math.round(y * 1800)
  if (!h.sections?.has(level)) cacheHairSlices(h, level, level)
  return h.sections.get(level)
}
function atLevel(h, angle, y, extra = 0) {
  const skin = h.a.point(angle, y),
    cz = h.a.dimensions(y)[2],
    lines = hairSlice(h, y)
  const radius = Math.hypot(skin[0], skin[2] - cz),
    dx = skin[0] / radius,
    dz = (skin[2] - cz) / radius
  let outer = radius
  for (let i = 0; i < lines.length; i += 4) {
    const ax = lines[i],
      az = lines[i + 1] - cz,
      bx = lines[i + 2],
      bz = lines[i + 3] - cz
    const da = dx * az - dz * ax,
      db = dx * bz - dz * bx
    if (da > 0 === db > 0) continue
    const f = da / (da - db)
    outer = Math.max(outer, dx * mix(ax, bx, f) + dz * mix(az, bz, f))
  }
  return [dx * (outer + extra), y, cz + dz * (outer + extra)]
}

// Draw a brushed panel in the measured scalp coordinates. Its edges lie
// flush, including the tapered edge which descends across the forehead.
function wing(h, sections, width, lift, phase = 0) {
  const curve = new T.CatmullRomCurve3(
    sections.map(([angle, level]) => new T.Vector3(angle, level, 0)),
    false,
    'catmullrom',
    0.42,
  )
  h.hair.grid(10, 36, (u, v) => {
    const center = curve.getPoint(v),
      root = hairEdge(h.a, center.x),
      ends = envelope(v)
    const t = center.y + ((u - 0.5) * width * 2 * ends) / (0.233 - root)
    const crown = Math.sin(Math.PI * u) ** 0.78 * ends,
      angle = center.x + 0.017 * (u - 0.5) * ends
    const filaments = 0.5 + 0.5 * Math.cos(u * 30 + 0.45 * Math.sin(v * 7 + phase))
    const p = h.scalp(angle, t, -0.00066 + (lift * crown + 0.0005 * filaments * crown))
    const colour = blend(
      h.dark,
      h.light,
      0.22 + 0.17 * crown + 0.057 * filaments + 0.035 * Math.sin(5 * v + phase),
    )
    return point(p, [u * 0.26 + 0.08 * Math.sin(v * 2) + 0.1 * phase, v], colour)
  })
}

// Shallow interrupted comb marks gather the temple hair toward its tie.
// Most of each ridge is buried in the scalp; individual narrow filaments
// emerge in the light as the comb changes direction above the ear.
function brushedSide(h, side) {
  const low = h.design === 'lute',
    high = h.design === 'scholar'
  for (let j = 0; j < 5; j++)
    h.hair.grid(4, 21, (u, t) => {
      const theta = side * (1.04 + j * 0.067 + t * (1.25 - 0.09 * j))
      const gather = low ? 0.085 : high ? 0.36 : 0.25
      const level =
        0.105 +
        0.036 * j +
        gather * t +
        0.082 * Math.sin(Math.PI * t) -
        0.019 * (low ? 2 : 1) * Math.sin(t * tau + j * 0.35)
      const ridge = Math.sin(Math.PI * u) * envelope(t)
      const p = h.scalp(
        theta,
        level + (u - 0.5) * (0.018 + 0.005 * (j % 2)) * envelope(t),
        -0.0004 + 0.00106 * ridge,
      )
      return point(p, [0.12 * j + 0.09 * u, t], blend(h.dark, h.light, 0.3 + 0.15 * ridge))
    })
}
// Swept locks have a rounded back, a flatter face and narrow ridges following
// their entire path. The reference vector keeps their wide axis on the head.
function lock(h, points, width, depth, options = {}) {
  const steps = options.steps ?? 25,
    sides = options.sides ?? 12,
    phase = options.phase ?? 0
  const curve = new T.CatmullRomCurve3(
    points.map((p) => new T.Vector3(...p)),
    false,
    'centripetal',
  )
  const center = new T.Vector3(),
    tangent = new T.Vector3(),
    normal = new T.Vector3(),
    across = new T.Vector3(),
    pos = new T.Vector3()
  const outward = options.normal && new T.Vector3(...options.normal)
  const reference = new T.Vector3(0, 0.148, -0.01)
  let oldRow = -1
  h.hair.grid(sides, steps, (u, v, i, j) => {
    if (oldRow !== j) {
      oldRow = j
      curve.getPointAt(v, center)
      curve.getTangentAt(v, tangent)
      if (outward) normal.copy(outward)
      else normal.copy(center).sub(reference)
      normal.addScaledVector(tangent, -normal.dot(tangent))
      if (normal.lengthSq() < 1e-6) {
        normal.set(0, 0, 1)
        normal.addScaledVector(tangent, -normal.dot(tangent))
      }
      normal.normalize()
      across.crossVectors(normal, tangent).normalize()
    }
    const s = tau * u,
      env = typeof options.taper === 'function' ? options.taper(v) : 0.19 + 0.81 * envelope(v)
    const strand = s * 5 + 0.58 * Math.sin(v * 5 + phase) + phase,
      tone = 0.22 + 0.23 * (0.5 + 0.5 * Math.cos(strand)) + 0.11 * Math.cos(s - 0.4)
    const groove = 1 + 0.044 * Math.sin(strand) + 0.025 * Math.sin(s * 9 + v * 4.3)
    pos
      .copy(center)
      .addScaledVector(across, width * env * Math.sin(s) * groove)
      .addScaledVector(normal, depth * env * Math.cos(s) * groove)
    return point(
      pos.toArray(),
      [u + 0.014 * Math.sin(v * 6 + phase), v],
      blend(h.dark, h.light, clamp(tone + (options.gloss ?? 0), 0.05, 0.77)),
    )
  })
}
function mound(h, c, r, tilt = 0) {
  h.hair.grid(29, 14, (u, v) => {
    const phi = (u - 0.5) * tau,
      lat = (v - 0.5) * Math.PI,
      co = Math.cos(lat)
    const ridge = 1 + 0.037 * Math.sin(phi * 9 + lat * 2) + 0.019 * Math.sin(phi * 17 + lat * 3)
    const x = r[0] * co * Math.sin(phi) * ridge,
      y = r[1] * Math.sin(lat)
    const p = [
      c[0] + x * Math.cos(tilt) - y * Math.sin(tilt),
      c[1] + x * Math.sin(tilt) + y * Math.cos(tilt),
      c[2] + r[2] * co * Math.cos(phi) * ridge,
    ]
    return point(
      p,
      [u + 0.19 * v, v],
      blend(h.dark, h.light, 0.2 + 0.22 * (0.5 + 0.5 * Math.cos(phi * 11 + 3 * lat))),
    )
  })
}
function hairAt(h, angle, y, raised = 0) {
  const p = h.a.point(angle, y)
  p[0] += raised * Math.sin(angle)
  p[2] += raised * Math.cos(angle)
  return p
}
function trace(h, angles, side) {
  return angles.map(([th, y, r]) => hairAt(h, side * th, y, r))
}

// From the swept part, down the outer forehead and into the cheek-side
// wisps. Angle, height and half-width describe the actual cut of each lock.
// Width and height here are millimetres, as on a wigmaker's blocking sheet.
const frontSections = {
  silk: [
    [0.06, 194, 0.5],
    [0.36, 182, 5.4],
    [0.61, 168, 9.7],
    [0.79, 151, 10.5],
    [0.95, 137, 9.2],
    [1.075, 123, 7.0],
    [1.14, 108, 5.0],
    [1.135, 94, 3.4],
    [1.115, 83, 1.5],
    [1.18, 72, 0.62],
    [1.29, 64, 0.08],
  ],
  lute: [
    [0.1, 193, 0.5],
    [0.41, 180, 5.5],
    [0.62, 166, 8.2],
    [0.81, 151, 10.1],
    [0.96, 138, 8.9],
    [1.095, 125, 6.8],
    [1.15, 111, 4.9],
    [1.115, 96, 3.4],
    [1.055, 83, 2.25],
    [1.055, 72, 1.24],
    [1.14, 63, 0.59],
    [1.22, 60, 0.08],
  ],
  scholar: [
    [0.23, 191, 0.5],
    [0.47, 179, 5.0],
    [0.73, 164, 7.2],
    [0.92, 151, 8.1],
    [1.05, 139, 7.2],
    [1.15, 125, 5.5],
    [1.21, 111, 4.5],
    [1.2, 99, 3.1],
    [1.15, 87, 2.15],
    [1.14, 77, 0.88],
    [1.18, 69, 0.08],
  ],
}
function frameCheeks(h) {
  const sections = frontSections[h.design]
  if (!sections) return
  // Cache the original scalp contour before adding wisps. Every strand lies
  // on the same measured forehead, independent of the strand built before it.
  h.sections = new Map()
  cacheHairSlices(h, 65, 355)
  const arcRadius = 0.076
  for (const s of [-1, 1]) {
    const lute = h.design === 'lute',
      scholar = h.design === 'scholar'
    const shortSide = h.design === 'silk' ? s > 0 : s < 0
    const guides = sections.map(([angle, y, width], i) => {
      const v = i / (sections.length - 1)
      const tuck = shortSide ? smooth(0.58, 1, v) : 0
      const offset =
        0.044 * s * Math.sin(v * Math.PI * 1.6) +
        tuck * (lute ? 0.15 : scholar ? 0.09 : 0.23) +
        (h.design === 'silk' ? 0.11 : 0.034) * bell(y - 125, 9)
      return new T.Vector3(
        (angle + offset) * arcRadius,
        0.001 * y + tuck * (lute ? 0.016 : scholar ? 0.011 : 0.021),
        0.001 * width * (1 + (shortSide ? -0.13 : 0.06) * Math.sin(Math.PI * v)),
      )
    })
    const flow = new T.CatmullRomCurve3(guides, false, 'centripetal')
    const surface = (t, u, extra = 0) => {
      const c = flow.getPoint(t),
        d = flow.getTangent(t)
      const span = Math.hypot(d.x, d.y),
        across = c.z * u
      const angle = (s * (c.x - (across * d.y) / span)) / arcRadius
      const y = c.y + (across * d.x) / span
      const crest = Math.max(0, 1 - u * u)
      const released = smooth(0.55, 0.89, t)
      const thickness = (scholar ? 0.0026 : 0.0036) * Math.sin(Math.PI * t) ** 0.68
      const ridge = crest * (0.85 + 0.12 * Math.cos(u * 17 + t * 4.2 + s))
      return atLevel(
        h,
        angle,
        y,
        extra + 0.00023 + thickness * ridge + released * (shortSide ? 0.00052 : 0.00165),
      )
    }
    h.hair.grid(15, 39, (u, t) => {
      const across = u * 2 - 1,
        gloss = 0.33 + 0.056 * Math.cos(across * 12 + t * 2.5 + s) + 0.075 * (1 - across * across)
      return point(surface(t, across), [2 + u, t], blend(h.dark, h.light, gloss))
    })
    // A few complete strands leave the edge at different heights. The outer
    // corner of the eye stays clear even when seen in three-quarter view.
    for (const [j, lane] of [-1.02, -0.82, -0.49, 0.12, 0.61, 0.92, 1.09].entries()) {
      const start = 0.035 + 0.047 * (j % 4)
      const end = 1 - (j % 3) * 0.066
      const coords = []
      for (let i = 0; i <= 12; i++) {
        const t = mix(start, end, i / 12),
          breathe = smooth(0.47, 0.91, t)
        const strayed = lane + (j % 2 === 0 ? -0.34 : 0.28) * breathe + 0.1 * Math.sin(10 * t + 2 * j)
        const pos = surface(t, strayed, 0.00022)
        const fall = smooth(0.68, 1, t)
        pos[1] -= fall * (j === 1 || j === 4 ? 0.007 : 0.0028)
        pos[0] += s * fall * (0.0008 + 0.0011 * Math.sin(j))
        pos[2] += fall * (lane * 0.0028 + 0.0013 * Math.cos(j))
        coords.push(pos)
      }
      sweep(
        h.hair,
        coords,
        (v) => 0.00006 + (0.00042 + 0.00013 * (j % 3)) * Math.sin(Math.PI * (0.17 + 0.83 * v)) ** 0.75,
        blend(h.dark, h.light, 0.22 + 0.047 * (j % 4)),
        16,
        5,
      )
    }
    // This single stray starts buried under the main lock at the temple. Its
    // finer end curves away in profile, a little longer on the unpinned side.
    const wisps = scholar
      ? [[0.49, -1.2, 0.008]]
      : lute
        ? [
            [0.45, -1.42, 0.014],
            [0.65, 0.8, 0.009],
          ]
        : [[0.43, -1.25, 0.012]]
    for (const [start, lane, fall] of wisps) {
      const coords = []
      for (let j = 0; j <= 10; j++) {
        const v = j / 10,
          t = mix(start, 0.99, v)
        const p = surface(t, lane + 0.22 * Math.sin(v * tau + s), 0.0003)
        p[0] += s * 0.0016 * Math.sin(Math.PI * v)
        p[1] -= fall * (shortSide ? 0.65 : 1) * smooth(0.42, 1, v)
        p[2] += 0.003 * Math.sin(v * Math.PI * 1.4) + lane * 0.0013 * v
        coords.push(p)
      }
      sweep(h.hair, coords, (t) => 0.000045 + 0.00065 * (1 - t) ** 0.71, blend(h.dark, h.light, 0.36), 17, 5)
    }
  }
}
function babyHairs(h) {
  for (const s of [-1, 1])
    for (let i = 0; i < 15; i++) {
      const th = s * (0.71 + i * 0.072),
        root = hairEdge(h.a, th)
      const len = 0.0025 + 0.0056 * (0.5 + 0.5 * Math.sin(i * 3.85 + s))
      const coords = [
        hairAt(h, th, root + 0.0031, 0.00035),
        hairAt(h, th + s * 0.016, root + 0.0006, 0.00068),
        hairAt(h, th + s * 0.027, root - len * 0.55, 0.00047),
        hairAt(h, th + s * 0.014, root - len, 0.00015),
      ]
      sweep(
        h.hair,
        coords,
        (t) => 0.00008 + 0.00044 * (1 - t) ** 0.7,
        blend(h.dark, h.light, 0.12 + 0.018 * (i % 4)),
        6,
        4,
      )
    }
  for (const s of [-1, 1])
    for (let j = 0; j < 13; j++) {
      const a = s * (0.055 + 0.056 * j + 0.014 * Math.sin(j * 3 + 0.7)),
        root = hairEdge(h.a, a)
      const length = 0.0014 + 0.0028 * (0.5 + 0.5 * Math.sin(j * 2.37 + s))
      const path = [
        hairAt(h, a, root + 0.0022, 0.0003),
        hairAt(h, a + s * 0.01, root + 0.0004, 0.0005),
        hairAt(h, a + s * 0.02, root - length, 0.00011),
      ]
      sweep(h.hair, path, (t) => 0.000045 + 0.00026 * (1 - t), blend(h.dark, h.light, 0.31), 4, 4)
    }
  // Fine nape hairs follow the skull as it turns under the occiput.
  for (const side of [-1, 1]) {
    for (let j = 0; j < 13; j++) {
      const theta = side * (1.88 + j * 0.099 + 0.015 * Math.sin(j * 2.1))
      const y = hairEdge(h.a, theta),
        length = 0.0026 + 0.0038 * (0.5 + 0.5 * Math.cos(j * 3.29 + side))
      const pts = [
        hairAt(h, theta, y + 0.0034, 0.00032),
        hairAt(h, theta + side * 0.019, y, 0.00061),
        hairAt(h, theta + side * 0.029, y - length * 0.59, 0.00047),
        hairAt(h, theta + side * 0.022, y - length, 0.00012),
      ]
      sweep(h.hair, pts, (t) => 0.000055 + 0.00052 * (1 - t) ** 0.85, blend(h.dark, h.light, 0.26), 5, 4)
    }
  }
}
function ring(h, c, rx, rz, height, colors, tilt = 0, flutes = 0) {
  h.metal.grid(40, 7, (u, v) => {
    const a = tau * u,
      si = Math.sin(a),
      co = Math.cos(a),
      edge = Math.sin(Math.PI * v)
    const rho = 1 + 0.04 * edge + (flutes ? 0.021 * Math.cos(a * flutes) * edge : 0),
      x = rx * rho * si
    const y = (v - 0.5) * height + tilt * si
    const pigment = v < 0.16 || v > 0.84 ? colors[1] : blend(colors[0], colors[1], 0.12 + 0.17 * edge)
    return point([c[0] + x, c[1] + y, c[2] + rz * co * rho], [u, v], shade(pigment, 0.85 + 0.16 * edge))
  })
}
function winding(h, points, r, colour) {
  wire(h.metal, points, r, colour, Math.max(13, points.length * 2))
}

function silkCoiffure(h) {
  const { metal } = h
  const gold = tint(0xb8965c),
    edge = tint(0xd9b878),
    jade = tint(0x94b9a6),
    pearl = tint(0xf2dfc0)
  // Two brushed sidelocks are tucked behind the ear. The left is lifted
  // high; the fuller right panel crosses low over the outer forehead.
  for (const s of [-1, 1]) {
    brushedSide(h, s)
    lock(
      h,
      trace(
        h,
        [
          [0.92, 0.151, 0.001],
          [1.03, 0.136, 0.002],
          [1.13, 0.118, 0.0023],
          [1.18, 0.102, 0.0019],
          [1.15, 0.092, 0.0008],
        ],
        s,
      ),
      0.0025,
      0.0018,
      { taper: (v) => 0.055 + 0.945 * (1 - v) ** 0.77, steps: 18 },
    )
  }
  mound(h, [-0.007, 0.228, -0.054], [0.043, 0.031, 0.039], -0.18)
  // A single crescent combed in a folded S, with a narrow opening between
  // the lifted arch and the knot. The overlapping tiers share buried roots.
  lock(
    h,
    [
      [0.034, 0.201, -0.053],
      [0.042, 0.23, -0.06],
      [0.034, 0.254, -0.065],
      [0.01, 0.272, -0.061],
      [-0.023, 0.28, -0.052],
      [-0.046, 0.272, -0.045],
      [-0.049, 0.252, -0.04],
      [-0.037, 0.242, -0.041],
      [-0.02, 0.245, -0.055],
      [-0.002, 0.229, -0.073],
    ],
    0.0144,
    0.0135,
    { steps: 54, sides: 16, normal: [0.08, 0.11, 1], phase: 0.8, taper: (v) => 0.25 + 0.75 * envelope(v) },
  )
  lock(
    h,
    [
      [0.03, 0.216, -0.059],
      [0.015, 0.235, -0.049],
      [-0.001, 0.246, -0.046],
      [-0.022, 0.256, -0.05],
      [-0.034, 0.264, -0.051],
      [-0.029, 0.27, -0.05],
      [-0.007, 0.272, -0.06],
      [0.013, 0.261, -0.074],
    ],
    0.0074,
    0.0059,
    { normal: [0, 0.14, 1], steps: 36, phase: 2.2 },
  )
  lock(
    h,
    [
      [-0.032, 0.207, -0.076],
      [-0.049, 0.23, -0.078],
      [-0.043, 0.247, -0.08],
      [-0.021, 0.258, -0.084],
      [0.006, 0.247, -0.089],
      [0.026, 0.233, -0.082],
      [0.02, 0.218, -0.065],
    ],
    0.0125,
    0.011,
    { steps: 37, normal: [0, 0.17, -1], phase: 2.2 },
  )
  lock(
    h,
    [
      [0.014, 0.196, -0.087],
      [-0.01, 0.2, -0.104],
      [-0.035, 0.217, -0.096],
      [-0.036, 0.232, -0.085],
      [-0.017, 0.239, -0.092],
      [0.006, 0.232, -0.098],
      [0.015, 0.215, -0.079],
    ],
    0.0095,
    0.0087,
    { normal: [0, -0.1, -1], phase: 0.35 },
  )
  // The pale jade shaft goes through both the knot and the gold butterfly.
  const mount = atLevel(h, -1.3, 0.192, 0.0018)
  const stem = [mount, [-0.054, 0.207, -0.028], [0.005, 0.228, -0.06], [0.056, 0.238, -0.064]]
  winding(h, stem, (t) => 0.00105 + 0.00123 * Math.sin(Math.PI * (0.18 + 0.72 * t)), jade)
  bead(metal, [0.054, 0.2377, -0.064], 0.0031, jade, 1.16)
  const frame = jewelleryFrame(mount, [-0.62, 0.13, 0.78])
  for (const s of [-1, 1]) {
    petal(metal, frame, [0, 0.001, 0], [s * 0.017, 0.0115], 0.0054, gold, 0.0018)
    petal(metal, frame, [0, -0.001, 0.0003], [s * 0.011, -0.0095], 0.0048, edge, 0.0014)
    petal(metal, frame, [s * 0.0017, 0.002, 0.0021], [s * 0.009, 0.0058], 0.002, jade, 0.0009)
    winding(
      h,
      [
        frame(s * 0.002, 0.001, 0.0027),
        frame(s * 0.008, 0.0042, 0.0031),
        frame(s * 0.013, 0.0081, 0.0026),
        frame(s * 0.0159, 0.0105, 0.0018),
      ],
      0.00039,
      edge,
    )
    winding(
      h,
      [
        frame(s * 0.001, -0.0007, 0.0023),
        frame(s * 0.0046, -0.0029, 0.003),
        frame(s * 0.0078, -0.0062, 0.0027),
      ],
      0.00034,
      gold,
    )
    winding(
      h,
      [frame(s * 0.001, 0.004, 0.001), frame(s * 0.004, 0.008, 0.0015), frame(s * 0.0048, 0.011, 0.0018)],
      0.00048,
      edge,
    )
  }
  winding(h, [frame(0, -0.005, 0.001), frame(0, 0.001, 0.003), frame(0, 0.007, 0.002)], 0.00135, edge)
  for (const [x, drop] of [
    [-0.009, 0.022],
    [0.002, 0.031],
  ]) {
    const pts = [
      frame(x, 0.0, 0.0005),
      frame(x - 0.001, -drop * 0.38, 0.0025),
      frame(x + 0.001, -drop * 0.68, 0.0035),
      frame(x + 0.0006, -drop, 0.004),
    ]
    winding(h, pts, 0.00047, edge)
    bead(metal, pts[2], 0.00164, jade)
    bead(metal, pts[3], 0.00255, pearl, 1.36)
  }
  bead(metal, mount, 0.0024, gold)
}

function luteCoiffure(h) {
  const metal = h.metal,
    enamel = tint(0x598685),
    gold = tint(0xbea075),
    shell = tint(0xe5bab2),
    ivory = tint(0xf0d7bf)
  for (const s of [-1, 1]) {
    // A long undulation from the curved centre-part to the nape. The temple
    // curls end against the cheek, forward of the helix and behind the eye.
    brushedSide(h, s)
    lock(
      h,
      trace(
        h,
        [
          [0.91, 0.15, 0.001],
          [1.06, 0.136, 0.0025],
          [1.14, 0.115, 0.0029],
          [1.095, 0.099, 0.0026],
          [1.14, 0.085, 0.0027],
          [1.245, 0.081, 0.0017],
        ],
        s,
      ),
      0.0028,
      0.0021,
      { steps: 24, taper: (v) => 0.055 + 0.945 * (1 - v) ** 0.66, phase: 1.2 },
    )
    wing(
      h,
      [
        [s * 1.46, 0.3],
        [s * 1.69, 0.24],
        [s * 1.98, 0.145],
        [s * 2.2, 0.19],
        [s * 2.48, 0.21],
        [s * 2.72, 0.28],
      ],
      0.0052,
      0.0032,
      2.8,
    )
  }
  mound(h, [-0.01, 0.109, -0.11], [0.046, 0.034, 0.04], 0.19)
  lock(
    h,
    [
      [-0.051, 0.129, -0.078],
      [-0.051, 0.107, -0.111],
      [-0.033, 0.085, -0.133],
      [-0.002, 0.079, -0.138],
      [0.027, 0.089, -0.129],
      [0.038, 0.108, -0.115],
      [0.028, 0.121, -0.102],
      [0.009, 0.126, -0.106],
    ],
    0.0138,
    0.0117,
    { normal: [0, -0.17, -1], steps: 43, phase: 0.55 },
  )
  lock(
    h,
    [
      [0.036, 0.139, -0.083],
      [0.026, 0.138, -0.115],
      [0.006, 0.129, -0.136],
      [-0.019, 0.113, -0.144],
      [-0.033, 0.099, -0.139],
      [-0.014, 0.093, -0.13],
      [0.01, 0.104, -0.128],
      [0.026, 0.122, -0.111],
    ],
    0.0115,
    0.0098,
    { normal: [0, 0, -1], steps: 40, phase: 1.5 },
  )
  const frame = jewelleryFrame(atLevel(h, -1.42, 0.158, 0.0024), [-0.64, 0.1, 0.76])
  const stems = [
    [-0.023, -0.018],
    [-0.008, -0.006],
    [0.005, 0.004],
    [0.016, 0.013],
  ]
  winding(
    h,
    stems.map(([x, y]) => frame(x, y, 0)),
    0.00103,
    gold,
  )
  for (const s of [-1, 1]) {
    petal(metal, frame, [s * 0.006, 0.001, 0], [s * 0.015, 0.007], 0.0038, enamel, 0.0012)
    petal(
      metal,
      frame,
      [s * 0.002, -0.004, 0.0004],
      [s * 0.01, -0.008],
      0.0036,
      blend(enamel, gold, 0.12),
      0.0008,
    )
  }
  for (const [x, y, rad, pigment] of [
    [-0.01, -0.003, 0.0084, shell],
    [0.005, 0.004, 0.0103, ivory],
    [0.015, 0.012, 0.0057, shell],
  ]) {
    for (let i = 0; i < 5; i++) {
      const th = (i * tau) / 5 + 0.24
      petal(
        metal,
        frame,
        [x, y, 0.0026],
        [rad * Math.sin(th), rad * Math.cos(th)],
        rad * 0.41,
        pigment,
        0.0013,
      )
    }
    bead(metal, frame(x, y, 0.0049), rad * 0.23, gold)
  }
  const pend = [frame(-0.015, -0.005, 0), frame(-0.018, -0.015, 0.002), frame(-0.018, -0.022, 0.0025)]
  winding(h, pend, 0.00055, gold)
  bead(metal, pend[2], 0.0026, enamel, 1.42)
  const anchor = atLevel(h, -1.62, 0.149, 0.0003)
  winding(h, [anchor, frame(-0.009, -0.008, 0), frame(0.016, 0.012, 0)], 0.00104, gold)
}

function scholarCoiffure(h) {
  const silver = tint(0xaeaca0),
    ink = tint(0x43565c),
    jade = tint(0x77988c),
    ivory = tint(0xdfd7aa)
  for (const s of [-1, 1]) {
    brushedSide(h, s)
    lock(
      h,
      trace(
        h,
        [
          [0.98, 0.143, 0.002],
          [1.13, 0.124, 0.0022],
          [1.21, 0.1, 0.0014],
          [1.22, 0.093, 0.0008],
        ],
        s,
      ),
      0.0021,
      0.0014,
      { steps: 12, taper: (v) => 0.12 + 0.88 * (1 - v) ** 0.7 },
    )
  }
  mound(h, [0.002, 0.239, -0.037], [0.028, 0.035, 0.031], -0.06)
  lock(
    h,
    [
      [-0.021, 0.22, -0.041],
      [-0.024, 0.241, -0.046],
      [-0.01, 0.261, -0.055],
      [0.009, 0.265, -0.049],
      [0.022, 0.25, -0.036],
      [0.019, 0.229, -0.027],
    ],
    0.0089,
    0.0074,
    { normal: [0, 0.2, 1], phase: 2.8 },
  )
  const cx = 0.002,
    cz = -0.039
  ring(h, [cx, 0.239, cz], 0.0315, 0.0335, 0.0145, [ink, silver], 0.0008, 12)
  h.metal.grid(34, 8, (u, v) => {
    const th = (u - 0.5) * Math.PI * 1.56,
      co = Math.cos(th),
      si = Math.sin(th)
    const foot = 0.239 + 0.0008 * si,
      peak = 0.249 + 0.0143 * Math.max(0, co) ** 2
    const radius = mix(1, 0.78, v) + 0.036 * Math.sin(Math.PI * v)
    const p = [cx + 0.0305 * radius * si, mix(foot, peak, v), cz + 0.034 * radius * co]
    const edge = v < 0.14 || v > 0.84
    return point(p, [u, v], edge ? silver : blend(ink, jade, 0.16 + 0.16 * Math.cos(th * 4) ** 2))
  })
  // An open silver-and-smoked-jade guan. Two separate bowed sides are joined
  // by a ridge at the apex; the bound topknot remains visible through its bays.
  for (const s of [-1, 1]) {
    const points = [
      [cx + s * 0.027, 0.231, cz + 0.003],
      [cx + s * 0.03, 0.242, cz + 0.005],
      [cx + s * 0.023, 0.262, cz + 0.002],
      [cx + s * 0.011, 0.276, cz - 0.001],
      [cx, 0.28, cz - 0.002],
    ]
    winding(h, points, 0.0019, silver)
    winding(
      h,
      points.map(([x, y, z], i) => [x, y - 0.001, z - 0.013 + 0.002 * i]),
      0.00135,
      ink,
    )
  }
  const front = jewelleryFrame([cx, 0.241, cz + 0.033], [0, 0.24, 1])
  const top = [
    front(-0.023, -0.001),
    front(-0.013, 0.012, 0.001),
    front(0, 0.029, 0.002),
    front(0.013, 0.012, 0.001),
    front(0.023, -0.001),
  ]
  winding(h, top, 0.00165, silver)
  for (const s of [-1, 1]) {
    petal(h.metal, front, [s * 0.0015, 0.001, 0.001], [s * 0.015, 0.013], 0.0039, ink, 0.0008)
    winding(
      h,
      [
        front(s * 0.017, 0.005, 0.001),
        front(s * 0.011, 0.009, 0.002),
        front(s * 0.011, 0.018, 0.003),
        front(s * 0.005, 0.023, 0.003),
      ],
      0.0007,
      silver,
    )
  }
  petal(h.metal, front, [0, 0.003, 0.0012], [0, 0.016], 0.0036, jade, 0.001)
  bead(h.metal, front(0, 0.02, 0.0028), 0.00225, ivory)
  winding(
    h,
    [
      [-0.058, 0.242, cz - 0.004],
      [-0.025, 0.243, cz],
      [0.019, 0.244, cz + 0.001],
      [0.056, 0.245, cz + 0.002],
    ],
    (t) => 0.00065 + 0.00135 * Math.sin(Math.PI * (0.13 + 0.73 * t)),
    silver,
  )
  bead(h.metal, [-0.057, 0.242, cz - 0.004], 0.0031, jade, 1.1)
}

function drummerCoiffure(h) {
  const { a, metal } = h,
    red = blend(tint(a.profile.colors.outer), tint(0x992e30), 0.47),
    wine = tint(0x672f33),
    brass = tint(0xb99358),
    amber = tint(0xd0ad75)
  for (const s of [-1, 1]) {
    wing(
      h,
      [
        [s * 0.16, 0.2],
        [s * 0.46, 0.14],
        [s * 0.81, 0.15],
        [s * 1.12, 0.26],
        [s * 1.46, 0.37],
        [s * 1.84, 0.56],
      ],
      0.0059,
      0.0038,
      1.8 * s,
    )
    lock(
      h,
      trace(
        h,
        [
          [1.06, 0.14, 0.002],
          [1.13, 0.118, 0.0025],
          [1.15, 0.101, 0.0018],
          [1.2, 0.093, 0.0005],
        ],
        s,
      ),
      0.0026,
      0.0018,
      { steps: 13, taper: (v) => 0.08 + 0.92 * (1 - v) ** 0.75 },
    )
  }
  // Temple cloth sits on the scalp and remains in contact around the back.
  cacheHairSlices(h, 222, 311)
  const headband = (theta, v, out = 0) => {
    const s = Math.sin(theta),
      c = Math.cos(theta)
    const y =
      0.154 +
      0.0061 * s -
      (0.011 * (1 - c)) / 2 +
      0.001 * Math.sin(2 * theta + 0.6) +
      (v - 0.5) * (0.0133 + 0.0024 * c)
    return atLevel(h, theta, y, 0.0012 + 0.00072 * Math.sin(Math.PI * v) + out)
  }
  metal.grid(76, 8, (u, v) => {
    const theta = (u - 0.5) * tau,
      k = 0.12 * (0.5 + 0.5 * Math.sin(theta * 22 + v * 5))
    const col = v < 0.13 || v > 0.87 ? blend(wine, brass, 0.61) : blend(red, wine, 0.14 + k)
    return point(headband(theta, v), [u, v], col)
  })
  for (let j = -5; j <= 5; j++) {
    const th = j * 0.145 + 0.05
    winding(
      h,
      [headband(th - 0.025, 0.43, 0.0005), headband(th, 0.65, 0.0005), headband(th + 0.025, 0.43, 0.0005)],
      0.00038,
      amber,
    )
  }
  mound(h, [0.012, 0.233, -0.047], [0.032, 0.027, 0.033], 0.28)
  lock(
    h,
    [
      [-0.014, 0.223, -0.037],
      [-0.014, 0.245, -0.042],
      [0.009, 0.257, -0.053],
      [0.031, 0.251, -0.06],
      [0.04, 0.234, -0.069],
      [0.025, 0.22, -0.072],
      [0.009, 0.223, -0.064],
    ],
    0.0105,
    0.0093,
    { normal: [0, 0.1, -1], steps: 35, phase: 0.8 },
  )
  ring(h, [-0.001, 0.231, -0.041], 0.03, 0.03, 0.0115, [wine, brass], 0.0048, 10)
  ring(h, [0.009, 0.243, -0.046], 0.027, 0.028, 0.009, [blend(brass, wine, 0.37), brass], 0.0032, 8)
  for (const s of [-1, 1]) {
    winding(
      h,
      [
        [0.009 + s * 0.021, 0.243, -0.033],
        [0.009 + s * 0.019, 0.25, -0.029],
        [0.009 + s * 0.012, 0.255, -0.03],
        [0.009 + s * 0.005, 0.255, -0.037],
      ],
      0.00115,
      brass,
    )
  }
  for (let i = 0; i < 3; i++) {
    const d = i - 1
    lock(
      h,
      [
        [0.023, 0.234 + d * 0.003, -0.057],
        [0.036, 0.225 + d * 0.002, -0.083],
        [0.04, 0.205, -0.096 + d * 0.003],
        [0.04 + d * 0.004, 0.183, -0.105],
        [0.054 + d * 0.004, 0.162, -0.106],
        [0.061 + d * 0.004, 0.15 + d * 0.005, -0.098],
      ],
      0.0048,
      0.0041,
      { steps: 26, phase: i * 1.7, taper: (v) => 0.045 + 0.955 * (1 - v) ** 0.57 },
    )
  }
  const tie = headband(2.54, 0.57, 0.001)
  bead(metal, tie, 0.0068, wine, 0.69)
  // Both twisted sash ends are surfaced on both sides and taper into a fork.
  for (const s of [-1, 1]) {
    const start = new T.Vector3(...tie),
      curve = new T.CatmullRomCurve3([
        start,
        start.clone().add(new T.Vector3(0.01 + s * 0.004, -0.006, -0.012)),
        start.clone().add(new T.Vector3(0.02 + s * 0.006, -0.02, -0.021)),
        start.clone().add(new T.Vector3(0.019 + s * 0.012, -0.038, -0.024 + s * 0.007)),
        start.clone().add(new T.Vector3(0.03 + s * 0.012, -0.059 + s * 0.01, -0.017 + s * 0.009)),
      ])
    metal.grid(6, 22, (u, v) => {
      const c = curve.getPointAt(v),
        roll = 0.23 + v * 2.1 + s * 0.3 * Math.sin(v * 5),
        w = (u - 0.5) * 0.01 * (1 - 0.32 * v)
      c.x += w * Math.cos(roll)
      c.z += w * Math.sin(roll)
      c.y += Math.abs(u - 0.5) * 0.005 * smooth(0.81, 1, v)
      const edge = u < 0.18 || u > 0.82
      return point(
        c.toArray(),
        [u, v],
        edge ? blend(wine, brass, 0.54) : shade(red, 0.76 + 0.25 * Math.sin(v * 5 + s)),
      )
    })
  }
}

const dressers = {
  silk: silkCoiffure,
  lute: luteCoiffure,
  scholar: scholarCoiffure,
  drummer: drummerCoiffure,
}
export function dressHeroHair(group, a) {
  const { profile: p } = a,
    design = p.design
  if (!Object.prototype.hasOwnProperty.call(naturalStyles, design) || p.hair !== naturalStyles[design])
    return false
  const h = {
    a,
    design,
    hair: new PortraitMesh(),
    metal: new PortraitMesh(),
    dark: blend(tint(p.hairColor, 1.23), tint(dye[design][0]), 0.52),
    light: tint(dye[design][1]),
  }
  combScalp(h)
  babyHairs(h)
  dressers[design](h)
  frameCheeks(h)
  for (let i = 0; i < h.hair.uv.length; i += 2) {
    const u = h.hair.uv[i]
    h.hair.uv[i] = u >= 2 ? 0.512 + 0.476 * (u - 2) : 0.018 + 0.35 * (u + 0.15)
  }
  fibreMaterial ??= new T.MeshStandardMaterial({
    name: '梳拢的真丝光发束',
    vertexColors: true,
    map: fibrePigment(),
    alphaTest: 0.4,
    roughness: 0.89,
    ...strandFinish(),
    side: T.DoubleSide,
  })
  ornamentMaterial ??= new T.MeshStandardMaterial({
    name: '玉石金钿与织带',
    vertexColors: true,
    roughness: 0.49,
    metalness: 0.22,
    side: T.DoubleSide,
  })
  group.add(
    h.hair.mesh(fibreMaterial, names[design]),
    h.metal.mesh(ornamentMaterial, names[design] + '·钗带'),
  )
  return true
}
