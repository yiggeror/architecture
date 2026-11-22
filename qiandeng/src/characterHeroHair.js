import * as T from 'three'
import { bell, clamp, hairEdge, mix, smooth } from './characterFaceSurface.js'
import { PortraitMesh, ovoid, point, sweep, tint } from './characterFaceMesh.js'

const tau = Math.PI * 2
const naturalStyles = { silk: 'loop', lute: 'coil', scholar: 'half', drummer: 'half' }
const names = { silk: '玉兰盘云髻', lute: '海棠流水髻', scholar: '青绦束发', drummer: '额帛与翻髻' }
const dye = {
  silk: [0x191a23, 0x70615f],
  lute: [0x241c23, 0x7b625d],
  scholar: [0x161b24, 0x696978],
  drummer: [0x261e22, 0x6c5956],
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
      const edge = i >= w * 0.825,
        card = i >= w / 2 && !edge,
        u = edge ? (i / w - 0.825) / 0.175 : card ? (i / w - 0.5) / 0.325 : (i + 0.5) / (w * 0.5),
        v = (j + 0.5) / h
      const wander = 0.33 * Math.sin(6.1 * v + 7.7 * u) + 0.18 * Math.sin(10.5 * v - 4.9 * u)
      const flow = u * (card ? 43 : 327) + wander
      const thread = 0.5 + 0.5 * Math.cos(tau * flow + 0.24 * Math.sin(flow * 0.43))
      const fine = Math.cos(tau * (flow * 1.47 + 0.17 * Math.sin(v * 8 + u * 3)))
      const shade = 193 + 31 * (thread - 0.5) + 9 * fine + 11 * Math.sin(u * 87 + v * 4) + 8 * thread ** 5
      const offset = (j * w + i) * 4
      bytes[offset] = shade + 1
      bytes[offset + 1] = shade
      bytes[offset + 2] = shade - 1
      let ink = 1
      if (card) {
        const tip = smooth(0.51, 1, v),
          side = Math.abs(2 * u - 1)
        const solid = 0.55 - 0.32 * tip + 0.024 * Math.sin(6 * v + u * 11)
        const density = 1 - smooth(solid, 1.035, side)
        const split = 0.17 * tip * (0.52 + 0.48 * Math.cos(28 * u + v * 3.2))
        ink = smooth(0.02, 0.19, density - (1 - thread) * 0.79 - split)
      }
      if (edge) {
        const bank = u * 71 + 0.34 * Math.sin(v * 7 + u * 3.4)
        const strand = 0.5 + 0.5 * Math.cos(tau * bank)
        const tip =
          0.21 +
          0.37 * (0.5 + 0.5 * Math.sin(Math.floor(bank) * 16.378 + 1)) +
          0.073 * Math.sin(u * 15.6) +
          0.16 * (1 - strand)
        ink = smooth(tip - 0.125, tip + 0.09, 1 - v)
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
        phase = tau * (u + 0.0017 * Math.sin(v * 6.7 + tau * u * 3) + 0.0013 * Math.cos(4.3 * v - tau * u * 5))
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
function hairline(a, angle) {
  const th = Math.atan2(Math.sin(angle), Math.cos(angle))
  const nape = smooth(1.72, 2.54, Math.abs(th))
  return hairEdge(a, th) - nape * (0.009 + 0.0033 * Math.cos(7 * th) + 0.0018 * Math.sin(13 * th + 0.4))
}
function combScalp(h) {
  const { a, hair, dark, light } = h
  // The measured undercap only supports the minute openings at the part.
  // It sits inside the combed surface except directly above the ears.
  hair.grid(78, 29, (u, t) => {
    const th = (u - 0.5) * tau,
      lower = hairline(a, th),
      y = mix(lower, 0.233, t)
    const p = a.point(th, y)
    p[1] += 0.0064 * t
    p[0] += 0.00035 * Math.sin(th)
    p[2] += 0.00035 * Math.cos(th)
    return point(p, [u, t], blend(dark, light, 0.16 + 0.06 * Math.sin(th * 19)))
  })
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

function hairAt(h, angle, y, raised = 0) {
  const p = h.a.point(angle, y)
  p[0] += raised * Math.sin(angle)
  p[2] += raised * Math.cos(angle)
  return p
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

function bindDrummer(h) {
  const metal = h.metal,
    red = tint(0x913c3e),
    wine = tint(0x5e2a35),
    brass = tint(0xba955c),
    amber = tint(0xd6ad77)
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
  sweptPanels(h)
  gatherNape(h)
  featherRoots(h)
  if (design === 'drummer') bindDrummer(h)
  foldTemples(h)
  fringe(h)
  looseNape(h)
  dressers[design](h)
  for (let i = 0; i < h.hair.uv.length; i += 2) {
    const u = h.hair.uv[i]
    h.hair.uv[i] =
      u >= 4 ? 0.828 + 0.168 * (u - 4) : u >= 2 ? 0.505 + 0.31 * (u - 2) : 0.018 + 0.35 * (u + 0.15)
  }
  fibreMaterial ??= new T.MeshPhysicalMaterial({
    name: '梳拢的真丝光发束',
    vertexColors: true,
    map: fibrePigment(),
    alphaTest: 0.32,
    alphaToCoverage: true,
    roughness: 0.74,
    anisotropy: 0.38,
    anisotropyRotation: Math.PI / 2,
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
  group.add(h.hair.mesh(fibreMaterial, names[design]), h.metal.mesh(ornamentMaterial, names[design] + '·钗带'))
  return true
}

// Each half of the comb runs from the part in an arc over the temple, before
// rising into the gathered hair at the back. Interruptions of the highlight
// follow neighbouring locks, independent of the light position.
function sweptPanels(h) {
  const division = { silk: -0.43, lute: 0.23, scholar: -0.51, drummer: 0.24 }[h.design]
  const profile = h.a
  const sphereY = 0.14,
    radiusY = 0.093
  const latitude = (th) => Math.asin(clamp((hairline(profile, th) - sphereY) / radiusY, -0.99, 0.99))
  const front = latitude(division),
    rear = Math.PI - latitude(division + Math.PI)
  const inclination = h.design === 'lute' ? 0.4 : h.design === 'scholar' ? 0.55 : 0.47
  for (const side of [-1, 1]) {
    const panel = (u, v, fly = 0) => {
      const alpha = mix(front, rear, u),
        rim = division + side * Math.PI * u
      const azimuth = division + 0.14 * Math.sin(u * Math.PI)
      const meridian = new T.Vector3(
        Math.sin(azimuth) * Math.cos(alpha),
        Math.sin(alpha),
        Math.cos(azimuth) * Math.cos(alpha),
      )
      const equator = new T.Vector3(
        Math.sin(rim) * Math.cos(latitude(rim)),
        Math.sin(latitude(rim)),
        Math.cos(rim) * Math.cos(latitude(rim)),
      )
      const arc = Math.acos(clamp(meridian.dot(equator), -1, 1))
      const ray = meridian.clone().lerp(equator, v)
      if (arc > 0.002)
        ray
          .copy(meridian)
          .multiplyScalar(Math.sin((1 - v) * arc) / Math.sin(arc))
          .addScaledVector(equator, Math.sin(v * arc) / Math.sin(arc))
      const th = Math.atan2(ray.x, ray.z) + side * inclination * envelope(v) * Math.sin(u * Math.PI) ** 0.72
      const span = hairline(profile, th),
        y = clamp(sphereY + radiusY * ray.y, span, 0.233)
      const t = clamp((y - span) / (0.233 - span)),
        fade = Math.min(1, 17 * v, 28 * (1 - v), 37 * u, 34 * (1 - u))
      const rhythm = tau * (u * 17.0 + 0.12 * Math.sin(35 * u + 5.1 * v) + 0.13 * Math.cos(72 * u - 3.5 * v))
      const lobe = 0.5 + 0.5 * Math.cos(rhythm),
        gloss = 0.5 + 0.5 * Math.sin(rhythm - 0.86)
      const p = profile.point(th, y)
      const thickness =
        (0.0035 + 0.003 * Math.sin(v * Math.PI) * Math.sin(u * Math.PI) + 0.00085 * lobe * fade) *
          Math.sin(Math.PI * t) ** 0.63 +
        fly
      p[0] += Math.sin(th) * thickness
      p[2] += Math.cos(th) * thickness
      p[1] += 0.0068 * t + 0.0021 * envelope(t)
      const col = blend(
        h.dark,
        h.light,
        0.17 +
          0.047 * lobe +
          0.054 * gloss +
          0.042 * Math.sin(57 * u + v * 3) +
          0.08 * bell(v - 0.39 + 0.1 * Math.sin(u * 7), 0.21),
      )
      return point(p, [u + 0.004 * Math.sin(v * 6 + u * 24), v], col)
    }
    h.hair.grid(113, 41, (u, v) => panel(u, v), side < 0)
    if (side > 0) {
      // A narrow exposed part separates the two banks of roots. At the
      // summit it disappears under hair pulled back towards the knot.
      h.metal.grid(5, 35, (u, t) => {
        const v = 0.014 + 0.46 * t
        const p = panel(v, 0).p
        const center = new T.Vector3(...p)
        const outward = center
          .clone()
          .sub(new T.Vector3(0, 0.14, -0.016))
          .normalize()
        const tangent = new T.Vector3(...panel(v + 0.001, 0).p).sub(center).normalize()
        const transverse = new T.Vector3().crossVectors(outward, tangent).normalize()
        const width = (0.00039 + 0.00018 * Math.sin(t * 13.1) ** 2) * envelope(t)
        center.addScaledVector(transverse, (2 * u - 1) * width).addScaledVector(outward, 0.00042)
        const colour = blend(h.dark, tint(h.a.profile.skin), 0.36 * Math.sin(Math.PI * u) ** 1.3 * envelope(t))
        return point(center.toArray(), [u, t], colour)
      })
    }
    for (let j = 0; j < 23; j++) {
      const ui = 0.036 + (0.88 * (j + 0.31 * Math.sin(j * 2.8 + side))) / 23
      const start = 0.015 + 0.15 * (0.5 + 0.5 * Math.cos(j * 2.9))
      const stop = 0.64 + 0.3 * (0.5 + 0.5 * Math.sin(j * 1.93))
      const pts = []
      for (let q = 0; q <= 9; q++) {
        const t = q / 9,
          v = mix(start, stop, t)
        const u = ui + 0.004 * Math.sin(t * 6.9 + 3 * j)
        const height = (0.00013 + 0.0009 * Math.cos(j * 3.1) ** 2) * envelope(t)
        pts.push(panel(u, v, height).p)
      }
      sweep(
        h.hair,
        pts,
        (t) => 0.00006 + 0.00028 * envelope(t),
        blend(h.dark, h.light, 0.27 + 0.1 * Math.sin(j * 4) ** 2),
        12,
        4,
      )
    }
  }
}

// Loose hair below the parietal ridge rises towards the binding. Individual
// sections narrow as they meet there. Their roots remain spread across the nape.
function gatherNape(h) {
  const low = h.design === 'lute',
    back = h.design === 'drummer' ? 0.2 : 0
  for (const side of [-1, 1]) {
    h.hair.grid(
      54,
      26,
      (u, v) => {
        const phi = 1.69 + 1.51 * u
        const root = hairline(h.a, side * phi)
        const target = low ? 0.136 : 0.221
        const th =
          side * (phi + (0.87 + 0.15 * back) * (1 - u) * v + 0.1 * Math.sin(v * 4.2 + u * 2.5) * envelope(v))
        const y = mix(root, target, v * 0.92 + 0.08 * v * v)
        const p = h.a.point(th, y),
          f = clamp((y - root) / (0.233 - root))
        const boundary = Math.min(1, 13 * u, 22 * (1 - u), 20 * (1 - v), 15 * v)
        const rhythm = tau * (u * 7.2 + 0.15 * Math.sin(u * 13 - v * 4))
        const ridge = 0.5 + 0.5 * Math.cos(rhythm)
        const base = (0.0043 + 0.0044 * envelope(v) + 0.001 * ridge) * boundary * envelope(f)
        p[0] += Math.sin(th) * base
        p[2] += Math.cos(th) * base
        p[1] += 0.0067 * f + 0.0021 * envelope(f)
        return point(
          p,
          [0.09 + 0.68 * u + 0.005 * Math.sin(v * 5 + u * 12), v],
          blend(
            h.dark,
            h.light,
            0.15 + 0.072 * ridge + 0.06 * Math.cos(rhythm - 0.8) + 0.05 * Math.sin(u * 27 + v * 2),
          ),
        )
      },
      side < 0,
    )
  }
}

// A card from overlapping, largely continuous fibres. Sampling alpha as MASK
// preserves depth from either side and keeps every lock usable in the city pass.
function featherRoots(h) {
  const sections = 27
  for (let j = 0; j < sections; j++) {
    h.hair.grid(15, 11, (u, v) => {
      const longitude = ((j + u) / sections - 0.5) * tau
      const rear = smooth(1.69, 2.68, Math.abs(longitude))
      const dir = Math.tanh(longitude * 3)
      const th = longitude + dir * v * (0.036 + 0.14 * rear)
      const edge = hairline(h.a, th)
      const depth =
        0.005 +
        0.003 * (0.5 + 0.5 * Math.sin(11 * th)) +
        rear * (0.008 + 0.011 * (0.5 + 0.5 * Math.cos(5.3 * th)))
      const y = edge + 0.006 * (1 - v) - depth * v
      const p = hairAt(h, th, y, 0.0009 + 0.0007 * envelope(v))
      p[2] -= rear * (0.0021 + v * v * 0.012)
      return point(p, [4 + u, v], blend(h.dark, h.light, 0.2 + 0.06 * Math.cos(th * 31)))
    })
  } // Longer individual hairs break the shadow where the occiput turns
  // into the neck. Their tips hang just clear of the upward-curving skull.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 14; i++) {
      const angle = side * (1.82 + i * 0.099 + 0.019 * Math.sin(2.4 * i))
      const root = hairline(h.a, angle)
      const length = 0.008 + 0.012 * (0.5 + 0.5 * Math.sin(2.75 * i + side))
      const points = []
      for (let k = 0; k < 5; k++) {
        const t = k / 4,
          th = angle + side * 0.095 * t
        const p = hairAt(h, th, root + 0.004 - length * t, 0.0008)
        p[2] -= 0.013 * t * t * smooth(1.78, 2.6, Math.abs(th))
        points.push(p)
      }
      sweep(
        h.hair,
        points,
        (t) => 0.00004 + 0.00035 * (1 - t) ** 0.76,
        blend(h.dark, h.light, 0.16 + 0.08 * Math.sin(i) ** 2),
        6,
        4,
      )
    }
  }
}

const mm = 0.001
function hairLock(h, guides, options = {}) {
  const curve = new T.CatmullRomCurve3(
    guides.map(([x, y, z]) => new T.Vector3(x, y, z).multiplyScalar(mm)),
    false,
    'catmullrom',
    0.43,
  )
  const normal = new T.Vector3(...(options.normal ?? [0, 0.12, 1])).normalize()
  const steps = options.steps ?? Math.max(20, guides.length * 5)
  const phase = options.phase ?? 0
  const card = options.card ?? false
  const depth = options.depth ?? 0.33
  const spiral = options.twist ?? 0.26
  const rows = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      c = curve.getPoint(t),
      tangent = curve.getTangent(t)
    const p = t * (guides.length - 1),
      k = Math.min(guides.length - 2, Math.floor(p))
    const w = mm * mix(guides[k][3], guides[k + 1][3], smooth(0, 1, p - k))
    const n = normal.clone().addScaledVector(tangent, -normal.dot(tangent))
    if (n.lengthSq() < 1e-8) {
      n.set(1, 0, 0).addScaledVector(tangent, -tangent.x)
    }
    n.normalize().applyAxisAngle(tangent, spiral * Math.sin(t * Math.PI + phase))
    const across = new T.Vector3().crossVectors(n, tangent).normalize()
    rows.push({ c, n, across, w })
  }
  const sheen = options.sheen ?? h.light
  h.hair.grid(card ? 8 : 22, steps, (u, t, i, j) => {
    const { c, n, across, w } = rows[j]
    const angle = tau * u,
      lateral = card ? 2 * u - 1 : Math.sin(angle)
    const surface = card ? 1 - lateral * lateral : Math.cos(angle)
    const groove =
      0.5 + 0.5 * Math.cos((lateral * (card ? 3.5 : 4.8) + 0.095 * Math.sin(t * 6 + phase) + 0.45) * tau)
    const edge = card ? 0.42 + 0.58 * (1 - lateral * lateral) : 1
    const pos = c
      .clone()
      .addScaledVector(across, lateral * w)
      .addScaledVector(n, w * depth * (surface * (0.81 + 0.19 * groove) + 0.055 * groove * edge))
    const glint =
      0.1 +
      0.11 * (1 - lateral * lateral) +
      0.073 * groove +
      0.047 * Math.sin(lateral * 10 + t * 5 + phase) +
      0.105 * bell(t - 0.43 - 0.09 * Math.cos(phase), 0.16)
    const shift = 0.011 * Math.sin(t * 7 + phase)
    return point(
      pos.toArray(),
      [card ? 2 + u : 0.13 + 0.64 * u + shift, t],
      blend(h.dark, sheen, clamp(glint, 0.055, 0.6)),
    )
  })
}

// The free part of a front lock retains its own width instead of shrinking to
// the jaw. Each lock leaves the head at its own height and turns in profile.
function fringe(h) {
  const style = h.design,
    lute = style === 'lute',
    silk = style === 'silk',
    scholar = style === 'scholar'
  h.sections = new Map()
  const division = { silk: -0.35, lute: 0.18, scholar: -0.48, drummer: 0.33 }[style]
  for (const side of [-1, 1]) {
    const long = lute || silk || (scholar && side > 0)
    const angle = (n) => division * (1 - n) + side * n
    const fromScalp = (th, y, w, raise) => [...atLevel(h, th, y * mm, raise * mm).map((n) => n / mm), w]
    const rows = [
      fromScalp(side * 0.54, 207, 0.6, -1.0),
      fromScalp(side * 0.58, 189, 4.0, -0.4),
      fromScalp(side * 0.68, 175, lute ? 8.5 : 7.8, 0.85),
      fromScalp(side * 0.85, 160, lute ? 10.3 : 9.5, 1.35),
      fromScalp(angle(0.96), 142, lute ? 9 : 8.2, 1.9),
      fromScalp(side * (scholar ? 1.17 : 1.11), 123, lute ? 7.6 : 6.5, 2.0),
    ]
    if (style === 'drummer') {
      const lead = side < 0
      rows.splice(
        2,
        4,
        fromScalp(angle(0.38), 187, 7, 1.8),
        fromScalp(angle(0.69), 177, 8, 2.3),
        fromScalp(angle(0.9), 170, 6.0, 1.7),
        fromScalp(side * 1.03, 163, lead ? 2.9 : 1.3, 1.2),
        fromScalp(side * 1.1, lead ? 142 : 158, 0.13, 1.1),
      )
    } else {
      const [x, y, z] = rows.at(-1)
      rows.push(
        [x + side * 3.7, y - 19, z + 1.1, long ? 7.5 : 4.3],
        [x + side * (lute ? 8 : 4.4), y - 38, z - (lute ? 2 : 3), long ? 5.6 : 1.7],
        [x + side * (lute ? 9 : 3), y - (long ? 57 : 46), z + (long ? 2 : -4), long ? 4.2 : 0.12],
      )
      if (long) {
        const length = lute ? (side < 0 ? 112 : 92) : silk ? (side < 0 ? 107 : 88) : 92
        rows.push(
          [x + side * (lute ? 5.7 : 2.0), y - 70, z + 4.0, 3.3],
          [x + side * (lute ? 0.7 : -2), y - (70 + 0.46 * (length - 70)), z + 7.0, 1.92],
          [x + side * (lute ? -3 : -4), y - length, z + 9.0, 0.1],
        )
      }
    }
    const normal = [side * 0.75, 0.05, 0.86]
    // Bury the upper root of the loose lock in the brushed section.
    for (let j = 0; j < 3; j++) {
      rows[j][0] -= side * (3 - j) * 1.6
      rows[j][2] -= (3 - j) * 1.8
    }
    hairLock(h, rows, { normal, depth: 0.19, phase: side * 0.6, card: !long })
    for (let k = 0; k < (style === 'drummer' ? 2 : 4); k++) {
      const lane = k % 2 ? -0.63 : 1
      const sub = rows.slice(2).map(([x, y, z, w], j, all) => {
        const t = j / (all.length - 1),
          sway = Math.sin(t * 5 + k * 1.8) * t
        return [
          x + side * lane * (0.74 * w + 1 + 4.5 * t) + side * sway * 2.9,
          y + (k % 2 ? -1 : 1) * (6.3 + k * 2.1) * t * t,
          z - lane * (w * 0.63 + 1) + sway * 4.2,
          (k < 2 ? 1.22 : 0.63) * (1 - 0.94 * t),
        ]
      })
      hairLock(h, sub, { normal, depth: 0.23, phase: k + 0.6, card: true, steps: 19 })
    }
  }
}

// A bundle wrapped around the chignon. The helical grooves are measured on
// the continuous surface, so the underside and the ends join the same volume.
function dressedKnot(h, c, r, tilt, seed = 0) {
  h.hair.grid(91, 43, (u, v) => {
    const phi = (u - 0.5) * tau,
      lat = (v - 0.5) * Math.PI,
      co = Math.cos(lat)
    const turn = 0.87 * lat + 0.23 * Math.sin(lat * 2 + seed)
    const wrap = phi + turn,
      grain = wrap * 6.2 + 0.48 * Math.sin(3 * wrap + lat + seed)
    const ridge = 0.5 + 0.5 * Math.cos(grain),
      micro = 0.5 + 0.5 * Math.cos(2.3 * grain + 0.3)
    const rho = (0.95 + 0.075 * ridge + 0.018 * micro) * co
    const x = r[0] * rho * Math.sin(phi),
      y = r[1] * Math.sin(lat) + 0.07 * r[1] * co * Math.cos(phi + seed)
    const z = r[2] * rho * Math.cos(phi)
    const roll = h.design === 'silk' ? 6.7 * Math.sin(lat * 1.5 + 0.67) : 0
    const p = [
      c[0] + x * Math.cos(tilt) - y * Math.sin(tilt) + roll,
      c[1] + x * Math.sin(tilt) + y * Math.cos(tilt),
      c[2] + z - roll * 0.3,
    ].map((n) => n * mm)
    return point(
      p,
      [u + 0.13 * lat + 0.012 * Math.sin(grain), v],
      blend(h.dark, h.light, 0.09 + 0.23 * ridge + 0.065 * micro + 0.055 * Math.cos(phi * 3 + lat)),
    )
  })
}

function tieRibbon(h, rows, colours, turn = 1) {
  const flow = new T.CatmullRomCurve3(rows.map(([x, y, z]) => new T.Vector3(x, y, z).multiplyScalar(mm)))
  h.metal.grid(10, 32, (u, t) => {
    const pos = flow.getPoint(t),
      tangent = flow.getTangent(t)
    const na = new T.Vector3(0, 0, -1)
    na.addScaledVector(tangent, -tangent.dot(na))
      .normalize()
      .applyAxisAngle(tangent, turn * Math.sin(t * 5.1 - 0.5))
    const across = new T.Vector3().crossVectors(na, tangent)
    const p = t * (rows.length - 1),
      k = Math.min(rows.length - 2, Math.floor(p))
    const w = mix(rows[k][3], rows[k + 1][3], p - k) * mm
    pos.addScaledVector(across, (u * 2 - 1) * w).addScaledVector(na, w * 0.23 * Math.sin(u * Math.PI))
    pos.y += Math.abs(u - 0.5) * 0.005 * smooth(0.89, 1, t)
    return point(
      pos.toArray(),
      [u, t],
      u <= 0.1 || u >= 0.9 ? colours[1] : shade(colours[0], 0.8 + 0.22 * Math.sin(u * Math.PI)),
    )
  })
}

// A carved flower is assembled in local millimetres. The cupped, veined
// petals have a closed section and overlap around the stamens in two rows.
function flower(h, frame, c, r, colours, lily = false) {
  const layers = lily ? [5, 3] : [5, 4]
  layers.forEach((count, layer) => {
    for (let k = 0; k < count; k++) {
      const a = (tau * k) / count + layer * 0.63 + 0.17
      const direction = [Math.sin(a), Math.cos(a)]
      const len = r * (layer ? 0.62 : 1) * (lily ? 0.94 + 0.16 * Math.cos(a - 0.4) : 1)
      const pigment = blend(colours[0], colours[1], 0.15 + 0.52 * layer + 0.17 * Math.sin(a + 0.2))
      h.metal.grid(12, 11, (u, t) => {
        const phi = tau * u,
          breadth = len * (lily ? 0.245 : 0.39) * Math.sin(t * Math.PI) ** 0.65 * (0.6 + 0.75 * t)
        const lateral = breadth * Math.sin(phi)
        const zone = 0.71 + 0.24 * Math.sin(a + 0.5)
        const axial = len * t * zone
        const flare =
          len * (0.39 * t * t + 0.12 * Math.sin(t * Math.PI) + 0.085 * Math.cos(phi) * Math.sin(t * Math.PI))
        const x = c[0] + direction[0] * axial + direction[1] * lateral
        const y = c[1] + direction[1] * axial - direction[0] * lateral
        const colour = blend(pigment, colours[1], 0.23 * t * t + 0.12 * Math.cos(phi) ** 2 * t)
        return point(
          frame(x * mm, y * mm, (c[2] + layer * 0.7 + flare) * mm),
          [u, t],
          shade(colour, 0.69 + 0.3 * t + 0.14 * Math.max(0, Math.cos(phi))),
        )
      })
    }
  })
  const gold = tint(0xcfac69)
  for (let k = 0; k < 6; k++) {
    const a = (k * tau) / 6,
      rr = r * 0.135
    bead(
      h.metal,
      frame((c[0] + Math.sin(a) * rr) * mm, (c[1] + Math.cos(a) * rr) * mm, (c[2] + r * 0.32) * mm),
      mm * r * 0.065,
      gold,
      1.25,
    )
  }
  bead(h.metal, frame(c[0] * mm, c[1] * mm, (c[2] + r * 0.34) * mm), mm * r * 0.14, colours[1], 1.16)
}
function silkCoiffure(h) {
  const gold = tint(0xae8557),
    lip = tint(0xd5b78b),
    jade = tint(0x91b7a4),
    ivory = tint(0xf5ebce)
  dressedKnot(h, [-10, 233, -64], [45, 42, 39], -0.37, 1.7)
  // The hair is folded through the back of the roll like wide satin.
  // Most of each turn is buried, leaving a crease and a soft lifted crest.
  hairLock(
    h,
    [
      [28, 202, -72, 3],
      [29, 223, -80, 10],
      [22, 248, -78, 15],
      [9, 263, -70, 16],
      [-11, 270, -63, 14],
      [-30, 264, -60, 11],
      [-40, 250, -66, 8],
      [-38, 232, -78, 2],
    ],
    { normal: [0.17, 0.2, 1], depth: 0.24, phase: 0.4 },
  )
  hairLock(
    h,
    [
      [-33, 206, -75, 3],
      [-44, 222, -82, 10],
      [-39, 241, -91, 14],
      [-24, 253, -95, 14],
      [-3, 253, -97, 11],
      [14, 243, -94, 8],
      [21, 225, -83, 2],
    ],
    { normal: [-0.15, 0.18, -1], depth: 0.25, phase: 2 },
  )
  hairLock(
    h,
    [
      [23, 198, -78, 2],
      [18, 209, -91, 8],
      [1, 221, -101, 11],
      [-17, 232, -105, 12],
      [-32, 243, -96, 9],
      [-38, 251, -81, 3],
    ],
    { normal: [0, 0.15, -1], phase: 3.2, depth: 0.23 },
  )
  const mount = atLevel(h, -1.05, 0.191, 0.0043)
  const frame = jewelleryFrame(mount, [-0.55, 0.23, 0.81])
  winding(
    h,
    [frame(-0.018, -0.004), mount, [-0.035, 0.215, -0.053], [0.016, 0.236, -0.071], [0.052, 0.248, -0.074]],
    (t) => 0.00055 + 0.00143 * Math.sin(Math.PI * (0.06 + 0.9 * t)),
    gold,
  )
  bead(h.metal, [0.052, 0.248, -0.074], 0.00225, jade, 1.16)
  const stem = [
    [-0.017, -0.012],
    [-0.01, -0.006],
    [-0.004, -0.002],
    [0.004, 0.006],
    [0.013, 0.011],
  ]
  winding(
    h,
    stem.map(([x, y]) => frame(x, y, 0.001)),
    0.00077,
    gold,
  )
  flower(h, frame, [1, 4, 1], 16.0, [jade, ivory], true)
  flower(h, frame, [-11, -3, 0.8], 7.8, [tint(0xa0b9aa), ivory], true)
  for (const [x, y, dx, dy] of [
    [-0.014, -0.008, -0.009, -0.003],
    [-0.007, -0.004, -0.006, 0.009],
    [0.006, 0.007, 0.011, 0.006],
  ]) {
    petal(h.metal, frame, [x, y, 0.0004], [dx, dy], 0.0024, jade, 0.001)
    winding(
      h,
      [
        frame(x, y, 0.0014),
        frame(x + dx * 0.55, y + dy * 0.49, 0.002),
        frame(x + dx * 0.93, y + dy * 0.95, 0.0018),
      ],
      0.00028,
      lip,
    )
  }
  for (const [j, drop] of [0.039, 0.052, 0.027].entries()) {
    const x = -0.01 + 0.004 * j
    const strand = (t) =>
      frame(x + 0.0021 * Math.sin(t * 3.4 + j * 0.6), -0.004 - drop * t, 0.0014 + 0.0015 * t)
    winding(h, [0, 0.3, 0.6, 1].map(strand), 0.00032, gold)
    for (const t of [0.2, 0.37, 0.64, 0.84]) bead(h.metal, strand(t), 0.00072, lip)
    bead(h.metal, strand(0.94), 0.0013, jade)
    bead(h.metal, strand(1), 0.0021, ivory, 1.46)
  }
}

function luteCoiffure(h) {
  const gold = tint(0xb99663),
    shell = tint(0xe9b5a8),
    pink = tint(0xa96872),
    leaf = tint(0x5b8480)
  dressedKnot(h, [-8, 113, -101], [41, 32, 35], -0.35, 0.3)
  hairLock(
    h,
    [
      [32, 152, -77, 3],
      [31, 133, -95, 8],
      [20, 118, -122, 12],
      [-1, 109, -135, 14],
      [-23, 101, -132, 12],
      [-37, 108, -120, 7],
      [-39, 119, -106, 1],
    ],
    { normal: [0.04, 0.2, -1], depth: 0.2, phase: 2.1 },
  )
  hairLock(
    h,
    [
      [-39, 139, -85, 4],
      [-48, 128, -103, 8],
      [-45, 111, -119, 11],
      [-32, 96, -125, 13],
      [-7, 91, -123, 10],
      [15, 97, -118, 5],
      [23, 105, -107, 0.7],
    ],
    { normal: [-0.16, 0.1, -1], depth: 0.22 },
  )
  // The end doubles under its own knot. Three loose sections escape down
  // the nape in progressively tighter curves, a counterweight to the flowers.
  for (let k = 0; k < 3; k++) {
    const d = k - 1
    hairLock(
      h,
      [
        [-24 + 5 * d, 103, -117, 4],
        [-36 + 5 * d, 83, -126 + d * 2, 6.7],
        [-39 + 6 * d, 62, -122 + d * 2, 7.5],
        [-42 + 7 * d, 34, -104 + d * 3, 7.0],
        [-49 + 6 * d, 5, -96 + d * 3, 5.5],
        [-56 + 6 * d, -21 + d * 11, -88 + d * 4, 3.1],
        [-62 + 5 * d, -46 + d * 14, -84 + d * 5, 0.13],
      ],
      { normal: [-0.45, 0, -1], depth: 0.28, phase: k + 0.9 },
    )
  }
  const base = atLevel(h, -1.74, 0.159, 0.0036)
  const frame = jewelleryFrame(base, [-0.87, 0.19, 0.5])
  winding(
    h,
    [frame(-0.043, -0.015), frame(-0.01, -0.004), frame(0.009, 0.005), frame(0.019, 0.013)],
    0.00104,
    gold,
  )
  for (const [x, y, dx, dy] of [
    [-0.012, -0.002, -0.01, 0.005],
    [0.005, 0.005, 0.009, -0.005],
    [0.012, 0.009, 0.012, 0.009],
    [-0.015, -0.005, -0.007, -0.007],
  ]) {
    petal(h.metal, frame, [x, y, 0.0002], [dx, dy], 0.003, leaf, 0.0013)
  }
  flower(h, frame, [0, 3, 1.2], 13.2, [pink, shell])
  flower(h, frame, [-13, -4, 0], 7.9, [shell, tint(0xf4dbc8)])
  flower(h, frame, [12, 11, 0.1], 5.2, [pink, shell])
  for (const [idx, dy] of [0.035, 0.027].entries()) {
    const x = -0.012 + 0.004 * idx
    const points = [
      frame(x, -0.003, 0.001),
      frame(x - 0.0015, -dy * 0.6, 0.0035),
      frame(x + 0.0012, -dy, 0.0048),
    ]
    winding(h, points, 0.00035, gold)
    bead(h.metal, points[1], 0.00136, shell)
    bead(h.metal, points[2], 0.00215, leaf, 1.54)
  }
}

function scholarCoiffure(h) {
  const ink = tint(0x445968),
    edge = tint(0xa29d83),
    pale = tint(0x97ad9f),
    gold = tint(0xc1a77a)
  dressedKnot(h, [2, 235, -44], [25, 29, 28], -0.06, 0.6)
  hairLock(
    h,
    [
      [-19, 223, -40, 2],
      [-21, 244, -47, 7],
      [-8, 257, -56, 9],
      [9, 257, -56, 9],
      [21, 246, -49, 6],
      [18, 230, -40, 2],
    ],
    { normal: [0, 0.33, -1], depth: 0.39 },
  )
  // The fall is broadest just below the binding. The centre and side
  // sections taper on different beats so the tail has a broken silhouette.
  hairLock(
    h,
    [
      [2, 236, -59, 5],
      [6, 222, -80, 14],
      [12, 193, -101, 19],
      [17, 154, -113, 21],
      [13, 106, -124, 21],
      [7, 59, -129, 19],
      [7, 15, -137, 16],
      [12, -20, -140, 10],
      [23, -55, -136, 4],
      [30, -73, -130, 0.13],
    ],
    { normal: [0.07, 0.06, -1], depth: 0.57, phase: 0.6 },
  )
  for (let k = 0; k < 5; k++) {
    const d = k - 2
    hairLock(
      h,
      [
        [3 + d * 3, 239, -57, 4],
        [5 + d * 4, 227, -77, 7.7],
        [10 + d * 5, 200, -96 - d * d, 8.4],
        [15 + d * 6, 163, -111 + d * d, 8.7],
        [14 + d * 7.2, 117, -120 + d * d * 1.1, 8.3],
        [8 + d * 8.1, 70, -127 + d * d * 1.4, 7.7],
        [5 + d * 7.5, 22, -136 + d * d, 6.9],
        [9 + d * 6.9, -18 + d * 3, -140 + d * d, 5.1],
        [20 + d * 6.6, -54 + d * 6, -138 + d * d, 2.9],
        [29 + d * 6.0, -78 + d * 8, -129 + d * d, 0.12],
      ],
      { normal: [0.06, 0.02, -1], depth: 0.23, phase: k * 1.61, twist: 0.53 },
    )
  }
  ring(h, [0.002, 0.235, -0.043], 0.027, 0.029, 0.014, [ink, edge], -0.0026, 12)
  ring(h, [0.002, 0.239, -0.043], 0.0275, 0.0295, 0.0029, [ink, pale], -0.003)
  winding(
    h,
    [
      [-0.045, 0.233, -0.04],
      [-0.024, 0.234, -0.041],
      [0.018, 0.237, -0.043],
      [0.044, 0.24, -0.045],
    ],
    (t) => 0.00065 + 0.001 * Math.sin(Math.PI * t),
    gold,
  )
  bead(h.metal, [0.044, 0.24, -0.045], 0.00265, pale, 1.08)
  for (const s of [-1, 1]) {
    const rows = [
      [s * 16, 237, -62, 2.7],
      [s * 24, 229, -74, 3.1],
      [s * 24 + 3, 202, -96, 3.3],
      [s * 27 + 12, 161, -112, 3.6],
      [s * 30 + 13, 119, -119, 3.5],
      [s * 31 + 13, 82, -129, 3.5],
      [s * 32 + 7, 58 + s * 8, -134, 3.3],
    ]
    tieRibbon(h, rows, [ink, edge], 0.86 * s)
  }
  const frame = jewelleryFrame([0.002, 0.236, -0.0132], [0, 0.19, 1])
  petal(h.metal, frame, [0, -0.004, 0], [0, 0.011], 0.0035, pale, 0.0009)
  for (const s of [-1, 1])
    winding(
      h,
      [
        frame(0, 0.007, 0.0007),
        frame(s * 0.006, 0.004),
        frame(s * 0.009, 0),
        frame(s * 0.004, -0.003),
        frame(0, -0.0045),
      ],
      0.00045,
      gold,
    )
  // A jade slip is held in the silk by a fine pierced cloud at either side.
  for (const side of [-1, 1]) {
    const spiral = [
      [side * 0.001, 0.008],
      [side * 0.005, 0.012],
      [side * 0.01, 0.0125],
      [side * 0.015, 0.009],
      [side * 0.014, 0.005],
      [side * 0.0105, 0.004],
      [side * 0.009, 0.007],
    ]
    winding(
      h,
      spiral.map(([x, y]) => frame(x, y, 0.0013)),
      0.0006,
      gold,
    )
  }
  petal(h.metal, frame, [0, 0.002, 0.0015], [0, 0.014], 0.0033, pale, 0.0011)
}
function drummerCoiffure(h) {
  const wine = tint(0x752e33),
    gold = tint(0xc79962)
  dressedKnot(h, [3, 226, -47], [27, 24, 29], -0.14, 1.8)
  hairLock(
    h,
    [
      [2, 233, -56, 3],
      [10, 238, -77, 12],
      [18, 222, -97, 15],
      [24, 196, -113, 15],
      [23, 166, -124, 13],
      [28, 138, -134, 9],
      [39, 120, -138, 4],
      [49, 110, -133, 0.15],
    ],
    { normal: [0.24, 0.07, -1], depth: 0.61, phase: 1.5 },
  )
  for (let k = 0; k < 5; k++) {
    const d = k - 2
    hairLock(
      h,
      [
        [2 + 3 * d, 232, -55, 3],
        [9 + d * 4, 241, -72, 7.3],
        [18 + d * 5, 226, -95, 7.3],
        [24 + d * 5, 198, -110 + d * 2, 8.3],
        [21 + d * 5.5, 169 + d * 2, -122 + d * 1.6, 7.3],
        [25 + d * 6, 139 + d * 3, -131 + d * 1.8, 5.2],
        [39 + d * 5.7, 119 + d * 5, -136 + d * 3, 2.8],
        [48 + d * 5, 113 + d * 7, -132 + d * 5, 0.18],
      ],
      {
        normal: [0.25, 0.1, -1],
        phase: k * 1.3,
        depth: 0.43,
        twist: 0.65,
        sheen: k === 0 || k === 3 ? tint(0x9a7865) : h.light,
      },
    )
  }
  for (let j = 0; j < 5; j++) {
    const d = j - 2
    hairLock(
      h,
      [
        [-4 + d * 2, 231, -61, 0.5],
        [14 + d * 4, 242, -82, 1.05],
        [29 + d * 4, 217, -105, 1.1],
        [33 + d * 4, 187, -125, 0.8],
        [24 + d * 7, 163, -132, 0.7],
        [20 + d * 7, 145 + d * 8, -137, 0.06],
      ],
      { normal: [0.5, 0.13, -1], card: true, phase: j },
    )
  }
  // One narrow, gold-edged cord emerges from the binding and follows the
  // outside of the ponytail. Its two faces read even against the backlit boat.
  const cord = [
    [5, 234, -61, 1.3],
    [7, 241, -74, 1.6],
    [12, 229, -92, 1.8],
    [20, 211, -107, 1.85],
    [24, 186, -121, 1.85],
    [21, 162, -132, 1.65],
    [25, 144, -141, 1.5],
    [32, 131, -143, 1.3],
    [41, 119, -143, 0.95],
    [48, 113, -137, 0.35],
  ]
  h.sections = new Map()
  for (const guide of cord) {
    const [x, y] = guide,
      sections = hairSlice(h, y * mm)
    let far = guide[2] * mm
    for (let k = 0; k < sections.length; k += 4) {
      const [x0, z0, x1, z1] = [sections[k], sections[k + 1], sections[k + 2], sections[k + 3]]
      if (x0 < x * mm === x1 < x * mm || x1 === x0) continue
      const z = mix(z0, z1, (x * mm - x0) / (x1 - x0))
      far = Math.min(far, z)
    }
    guide[2] = far / mm - 0.95
  }
  tieRibbon(h, cord, [tint(0xb46351), tint(0xe7bb7d)], 0.28)
  ring(h, [0.001, 0.232, -0.047], 0.0273, 0.026, 0.011, [wine, gold], 0.003, 8)
  ring(h, [0.003, 0.237, -0.048], 0.026, 0.026, 0.0035, [wine, gold], 0.002, 8)
}

// Forehead sections use millimetres along the skin and across the head.
// Constructing each edge on the forehead avoids the lash-like hard end of
// a thick tube seen in a frontal close-up.
function foldTemples(h) {
  const style = h.design
  const part = { silk: -0.38, lute: 0.16, scholar: -0.43, drummer: 0.28 }[style]
  if (style === 'drummer') return
  h.sections = new Map()
  cacheHairSlices(h, 128, 403)
  for (const side of [-1, 1]) {
    const heavy = part * side < 0
    const y = style === 'scholar' ? 8 : style === 'lute' ? -2 : 0
    const skirt = style === 'scholar' ? 8 : style === 'lute' ? -7 : 0
    // Two thick sections turn together. Their part is narrow, while the
    // lower border of the larger section arcs down onto the temple.
    const guides = [
      [part + side * 0.07, 207, 1.3],
      [part + side * 0.14, 192 + y, 5.1],
      [mix(part, side * 0.68, 0.58), heavy ? 175 + y : 181 + y, heavy ? 9.8 : 7.3],
      [side * (heavy ? 0.6 : 0.69), heavy ? 159 + y : 167 + y, heavy ? 11.8 : 8.6],
      [side * 0.88, 147 + skirt, 9.2],
      [side * 1.02, 133 + skirt, 7.4],
      [side * 1.15, 114 + skirt, 3.2],
      [side * 1.18, 104 + skirt, 0.2],
    ]
    const rake = guides.map(([a, y, w]) => new T.Vector3(a * 78, y, w))
    const curve = new T.CatmullRomCurve3(rake, false, 'catmullrom', 0.38)
    for (let k = 0; k < 2; k++) {
      h.hair.grid(13, 32, (u, v) => {
        const t = k === 1 ? 0.11 + 0.89 * v : v
        const c = curve.getPoint(t),
          d = curve.getTangent(t)
        const den = Math.hypot(d.x, d.y),
          arc = Math.sin(t * Math.PI)
        const lane = k === 1 ? (u - 0.5) * 1.04 + 0.6 : u * 2 - 1
        const w = c.z * lane,
          theta = (c.x - (side * w * d.y) / den) / 78
        const yy = (c.y + (side * w * d.x) / den + (k === 1 ? 1.8 * arc : 0)) * mm
        const crest = Math.sin(u * Math.PI) ** 0.8
        const bulge = (k === 1 ? 1.35 : 2.2) * crest * envelope(v)
        const bury = 2.7 * (1 - smooth(0.06, 0.38, v)) + 0.55 * (1 - crest)
        const out = (k === 0 ? -0.15 + bulge + 0.32 * arc - bury : 0.48 + 0.67 * bulge - bury) * mm
        const q = atLevel(h, theta, yy, out)
        const stripe = 0.5 + 0.5 * Math.sin((u * 4.5 + 0.1 * Math.cos(v * 6 + side)) * tau)
        return point(
          q,
          [0.05 + 0.26 * u + 0.005 * Math.sin(t * 5 + side), t],
          blend(h.dark, h.light, 0.12 + 0.11 * crest + 0.065 * stripe + 0.085 * bell(v - 0.33, 0.17)),
        )
      })
    }
  }
}
function looseNape(h) {
  const style = h.design
  for (const side of [-1, 1]) {
    const long = style === 'silk' || (style === 'lute' && side > 0)
    const end = long ? (style === 'silk' ? -40 + side * 8 : -27) : 36
    const lift = side < 0 ? 4 : -3
    const start = hairAt(h, side * 2.02, 0.121, 0.001).map((x) => x / mm)
    const root = hairAt(h, side * 2.13, 0.078, 0.0015).map((x) => x / mm)
    const guides = [
      [...start, 1.4],
      [side * 67, 102, -62, 5.7],
      [...root, 7.2],
      [side * 55, 55, -67, 6.2],
      [side * 49, 40 + lift, -65, 4.5],
    ]
    if (long)
      guides.push(
        [side * 47, 18, -67, 3.6],
        [side * 50, -4, -66, 2.3],
        [side * 58, end + 7, -61, 0.93],
        [side * 62, end, -60, 0.07],
      )
    else {
      const tucked = hairAt(h, side * 2.09, 0.061, 0.002).map((n) => n / mm)
      const tip = hairAt(h, side * 2.14, 0.054, 0.0017).map((n) => n / mm)
      guides.splice(3, 2, [...tucked, 2.9], [...tip, 0.08])
    }
    hairLock(h, guides, { normal: [side * 0.72, -0.1, -0.74], depth: 0.29, phase: 0.74 + side })
    for (let k = 0; k < 3; k++) {
      const split = guides.slice(2).map(([x, y, z, w], j, a) => {
        const t = j / (a.length - 1),
          sw = Math.sin(t * 4.2 + k) * t
        return [
          x + side * (w * (k - 0.9) * 0.67 + sw * 4),
          y - (5.5 + 2 * k) * t,
          z + w * (k - 0.9) * 0.43 + sw * 3,
          0.92 * (1 - 0.94 * t),
        ]
      })
      hairLock(h, split, { normal: [side * 0.66, 0.0, -0.75], depth: 0.24, card: true, steps: 14 })
    }
  }
}
