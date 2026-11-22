import * as T from 'three'
import {
  PaintedSurface,
  clamp,
  lerp,
  mix,
  pigment,
  smooth,
  table,
  tau,
  tint,
} from './characterHandSurface.js'

const widthStops = [
  [-0.098, 0.001],
  [-0.094, 0.015],
  [-0.083, 0.0267],
  [-0.065, 0.0324],
  [-0.04, 0.0334],
  [-0.012, 0.0345],
  [0.015, 0.035],
  [0.048, 0.0396],
  [0.082, 0.0462],
  [0.114, 0.0489],
  [0.145, 0.0481],
  [0.164, 0.0447],
  [0.18, 0.0359],
  [0.193, 0.024],
  [0.203, 0.011],
  [0.207, 0.001],
]
let fabric
function shoeMaterial() {
  if (fabric) return fabric
  // Broken twill, repeated in physical space. A short uneven warp is visible
  // on the black cotton vamp when the camera reaches a few hand spans.
  const size = 64,
    data = new Uint8Array(size * size * 4)
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const id = (j * size + i) * 4,
        thread = (i + 2 * Math.floor(j / 2)) % 6 < 3
      const fleck = Math.sin(i * 57.47 + j * 13.83) * 3 + Math.cos(j * 1.57) * 2
      const v = Math.round((thread ? 246 : 233) + fleck)
      data[id] = v
      data[id + 1] = v
      data[id + 2] = v
      data[id + 3] = 255
    }
  const map = new T.DataTexture(data, size, size, T.RGBAFormat)
  map.colorSpace = T.SRGBColorSpace
  map.wrapS = map.wrapT = T.RepeatWrapping
  map.magFilter = T.LinearFilter
  map.minFilter = T.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true
  fabric = new T.MeshStandardMaterial({
    name: '棉履、纳底与袜口',
    vertexColors: true,
    map,
    roughness: 0.91,
  })
  return fabric
}

function styleOf(profile, job) {
  if (job === 'watch' || (profile.garment === 'yuanling' && job !== 'row')) return 'boot'
  if (['porter', 'row', 'carrier', 'drum', 'basket'].includes(job)) return 'work'
  if (['lute', 'flute'].includes(job) || ['beizi', 'aoqun', 'banbi'].includes(profile.garment))
    return 'slipper'
  return 'work'
}
function finish(profile, style) {
  const colors = profile.colors ?? {}
  const lower = pigment(colors.lower ?? 0x424b54),
    outer = pigment(colors.outer ?? 0x476c6e)
  const uppers =
    style === 'slipper'
      ? lerp(pigment(0x44445b), outer, 0.5)
      : style === 'boot'
        ? lerp(pigment(0x302d31), lower, 0.21)
        : lerp(pigment(0x27333a), lower, 0.29)
  return {
    upper: uppers,
    shade: tint(uppers, 0.55),
    binding: lerp(uppers, pigment(0x161e27), 0.53),
    welt: pigment(style === 'slipper' ? 0x9e927d : 0x968978),
    midsole: pigment(0x6f6254),
    outsole: pigment(0x362d2a),
    thread: pigment(0xb5a992),
    ivory: pigment(0xdfd9c5),
    sock: pigment(0xc6c7b9),
    petal: lerp(pigment(0xd28e7e), pigment(colors.motif ?? 0xb18b6a), 0.21),
    stem: lerp(pigment(0x91aaa1), outer, 0.28),
    gold: pigment(0xc8a06b),
  }
}
function lastEdge(z, side, style) {
  let w = table(z, widthStops) * (style === 'slipper' ? 0.94 : 1)
  if (side < 0)
    w *= 1 + 0.074 * Math.exp(-((z - 0.119) ** 2) / 0.0024) - 0.11 * Math.exp(-((z - 0.023) ** 2) / 0.00095)
  const shift = -0.0065 * smooth((z - 0.08) / 0.1)
  return shift + side * w
}
function footprint(a, style) {
  const z = mix(-0.098, 0.207, (1 + Math.cos(a)) * 0.5)
  return [lastEdge(z, Math.sign(Math.sin(a)), style), z]
}
function soleX(style, z, fraction) {
  const side = z >= 0.207 ? 0 : 1
  return 0.87 * mix(lastEdge(z, -side, style), lastEdge(z, side, style), (1 + fraction) * 0.5)
}
function footbase(z, side) {
  const arch = 0.0041 * Math.exp(-((z - 0.013) ** 2) / 0.00091) * (0.77 + 0.23 * (1 - side))
  const rocker =
    0.0067 * smooth((z - 0.192) / 0.016) +
    Math.max(0.0035 * smooth((-0.078 - z) / 0.022), Math.max(0, (-0.075 - z) * 0.242))
  return Math.max(0, arch - 0.00062) + rocker
}
function stack(z, style) {
  return (
    (style === 'boot' ? 0.018 : 0.015) +
    0.0073 * (1 - smooth((z + 0.033) / 0.05)) +
    0.0012 * smooth((z - 0.063) / 0.05)
  )
}

// The first four turns of the outsole flare under the stitched welt. Store
// the lower polygon of each turn as actually rendered for thin paving inlays.
const outsoleTurns = [
  [0.87, 0],
  [0.96, 0.055],
  [1, 0.14],
  [1.006, 0.22],
]
const soleStations = [
  -0.0978, -0.093, -0.078, -0.075, -0.064, -0.042, -0.015, 0.008, 0.031, 0.059, 0.089, 0.12, 0.153, 0.18,
  0.192, 0.202, 0.2068,
]
const weltProfiles = new Map()
function wallPoint(a, style, expand, v) {
  const [x, z] = footprint(a, style)
  const shift = -0.0065 * smooth((z - 0.08) / 0.1)
  return [
    shift + (x - shift) * expand,
    footbase(z, Math.sign(x)) + stack(z, style) * v,
    0.051 + (z - 0.051) * (0.976 + 0.024 * expand),
  ]
}
function weltFor(style) {
  if (!weltProfiles.has(style)) {
    const rings = outsoleTurns.map(([expand, v]) => {
      const points = Array.from({ length: 48 }, (_, j) => wallPoint((j * tau) / 48, style, expand, v))
      return [[...points.slice(24), points[0]], points.slice(0, 25).reverse()]
    })
    const bottomEdges = [-1, 1].map((edge) =>
      soleStations.map((z) => {
        const x = soleX(style, z, edge)
        return [x, footbase(z, Math.sign(x)), z]
      }),
    )
    weltProfiles.set(style, { rings, bottomEdges })
  }
  return weltProfiles.get(style)
}
function ringSection(points, z, out) {
  let lo = 0,
    hi = points.length - 1
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (points[m][2] < z) lo = m
    else hi = m
  }
  const a = points[lo],
    b = points[hi],
    t = clamp((z - a[2]) / (b[2] - a[2]))
  return out.set(mix(a[0], b[0], t), mix(a[1], b[1], t), z)
}

// Both soles meet the surveyed ground. Their waist rises a few millimetres and
// the toe begins its gentle rocker after the tip contact at z=.192.
function sole(b, style, c) {
  const strata = [
    ...outsoleTurns.map(([expand, v], i) => [v, expand, i === 3 ? tint(c.outsole, 1.12) : c.outsole]),
    [0.29, 0.998, c.midsole],
    [0.37, 1.001, c.midsole],
    [0.43, 0.997, c.welt],
    [0.52, 0.995, c.welt],
    [0.6, 0.998, c.midsole],
    [0.69, 0.997, c.welt],
    [0.78, 0.993, tint(c.welt, 1.12)],
    [0.85, 0.993, c.welt],
    [0.93, 0.981, c.binding],
    [1, 0.966, c.binding],
  ]
  const rings = b.patch(
    48,
    strata.map((v) => v[0]),
    (u, t) => {
      const [v, expand, color] = strata.find((v) => v[0] === t)
      return {
        p: wallPoint(u * tau, style, expand, v),
        c: color,
        uv: [u * 14, t * 0.56],
      }
    },
    { closed: true },
  )
  // A flat, fully painted underside is subdivided in z. A fan-shaped cap
  // would bridge the arch and interfere with the heel-to-ball rollover.
  b.patch(8, soleStations, (u, z) => {
    const x = soleX(style, z, 2 * u - 1),
      y = footbase(z, Math.sign(x))
    return {
      p: [x, y, z],
      c: tint(c.outsole, 0.91 + 0.052 * Math.cos(u * Math.PI)),
      uv: [u * 2, (z + 0.098) * 25],
    }
  })
  const topCentre = [0, 0.018, 0.043]
  b.cap(rings.at(-1), topCentre, c.binding)
  // The sole has hidden stitching channels on the bottom and a visible
  // staggered line of flax stitches between the rows of compressed cloth.
  for (let j = 0; j < 37; j++) {
    const a = ((j + 0.45) * tau) / 37,
      length = 0.044
    b.patch(3, [0, 1], (u, v) => {
      const ang = a + length * (u - 0.5),
        [x, z] = footprint(ang, style),
        shift = -0.0065 * smooth((z - 0.08) / 0.1)
      const t = 0.59 + 0.051 * (u - 0.5) + (v - 0.5) * 0.054 * Math.max(0.22, Math.sin(Math.PI * u))
      return {
        p: [shift + (x - shift) * 1.0035, footbase(z, Math.sign(x)) + stack(z, style) * t, z],
        c: c.thread,
      }
    })
  }
}

function upper(b, style, c) {
  const levels = [0, 0.085, 0.16, 0.26, 0.39, 0.54, 0.69, 0.83, 0.95, 1]
  const zr = [
    [0, 0],
    [0.16, 0.025],
    [0.26, 0.085],
    [0.39, 0.22],
    [0.54, 0.46],
    [0.69, 0.66],
    [0.83, 0.84],
    [1, 1],
  ]
  const xr = [
    [0, 0],
    [0.16, 0.02],
    [0.26, 0.08],
    [0.39, 0.19],
    [0.54, 0.38],
    [0.69, 0.59],
    [0.83, 0.79],
    [1, 1],
  ]
  function surface(a, t, lift = 0) {
    const cs = Math.cos(a),
      sn = Math.sin(a),
      [x, z] = footprint(a, style)
    const cx = 0.0006,
      cz = -0.027
    const near = cs > 0 ? (style === 'slipper' ? 0.071 : 0.075) : style === 'boot' ? 0.044 : 0.047
    const topZ = cz + near * cs,
      topX = cx + (0.029 + (0.005 * (1 - cs)) / 2) * sn
    const v = table(t, zr),
      u = table(t, xr)
    const bottom = footbase(z, Math.sign(x)) + stack(z, style) - 0.0015
    const toe = clamp((cs + 0.1) / 1.1),
      throat = style === 'slipper' ? 0.077 : style === 'boot' ? 0.102 : 0.087
    const h = mix(style === 'slipper' ? 0.082 : 0.096, throat, toe) - 0.015 * Math.abs(sn) ** 1.55
    const curve = mix(t ** 0.84, Math.min(1, t ** 0.62), toe)
    return [
      mix(x * 0.973, topX, u) + sn * lift,
      mix(bottom, h, curve) + lift * (0.16 + 0.82 * t),
      mix(z, topZ, v) + cs * lift,
    ]
  }
  b.patch(
    48,
    levels,
    (u, t) => {
      const a = u * tau,
        side = Math.sin(a),
        shade = 0.89 + 0.092 * t + 0.048 * Math.cos(a - 1.4) + 0.028 * side ** 2
      return { p: surface(a, t), c: tint(c.upper, shade), uv: [u * 13, t * 4.5] }
    },
    { closed: true },
  )
  if (style === 'boot') {
    // A built-up leather throat couples the tall quarters to the shaft.
    // There is no open court-shoe throat buried inside the boot.
    b.patch(
      48,
      [0, 0.24, 0.57, 0.86, 1],
      (u, t) => {
        const a = u * tau,
          p = surface(a, 1),
          pleat = 1 + 0.025 * Math.sin(5 * a + 0.8 * 0.116 * 30) + 0.019 * Math.sin(8 * a - 0.116 * 42)
        const end = [Math.sin(a) * 0.0359 * pleat, 0.116, -0.024 + Math.cos(a) * 0.0408 * pleat]
        return { p: lerp(p, end, t), c: tint(c.upper, 0.86 + 0.1 * t), uv: [u * 11, t] }
      },
      { closed: true },
    )
  } else {
    // The mouth is edged and turned inward around a real opening. Lining
    // continues down around the sock and is visible from an overhead camera.
    b.patch(
      48,
      [0, 0.25, 0.53, 0.73, 1],
      (u, t) => {
        const a = u * tau,
          p = surface(a, 1)
        const sn = Math.sin(a),
          cs = Math.cos(a),
          h = table(t, [
            [0, -0.002],
            [0.25, 0.0006],
            [0.53, 0.0018],
            [0.73, 0.0011],
            [1, -0.006],
          ])
        return {
          p: [p[0] + sn * (0.0018 - 0.0046 * t), p[1] + h, p[2] + cs * (0.0018 - 0.0046 * t)],
          c: tint(c.binding, 1 + 0.19 * Math.sin(Math.PI * t)),
          uv: [u * 10, t * 0.22],
        }
      },
      { closed: true },
    )
    b.patch(
      40,
      [0, 0.2, 0.56, 1],
      (u, t) => {
        const a = u * tau,
          p = surface(a, 1),
          d = 0.0044 + 0.003 * t
        return {
          p: [p[0] - Math.sin(a) * d, p[1] - 0.005 - 0.03 * t, p[2] - Math.cos(a) * d],
          c: tint(c.shade, 0.78 + 0.22 * t),
          uv: [u * 11, t],
        }
      },
      { closed: true },
    )
  }
  function ink(curve, width, color, n = 14) {
    b.patch(n, [0, 1], (u, v) => {
      const [a, t] = curve(u),
        e = 0.001
      const q = curve(Math.min(1, u + e)),
        r = curve(Math.max(0, u - e))
      // The two derivatives are expressed in physical units on the vamp.
      const az = (q[0] - r[0]) * 0.058,
        tz = (q[1] - r[1]) * 0.1,
        norm = Math.hypot(az, tz) || 1
      const pressure = width * (v - 0.5) * Math.max(0.18, Math.sin(Math.PI * u) ** 0.3)
      const aa = a - (pressure * tz) / norm / 0.058,
        tt = clamp(t + (pressure * az) / norm / 0.1, 0.02, 0.99)
      return { p: surface(aa, tt, 0.00026), c: color, uv: [u, 0] }
    })
  }
  for (const sign of [-1, 1]) {
    ink(
      (u) => [sign * (0.65 + 0.89 * u + 0.13 * Math.sin(Math.PI * u)), 0.39 + 0.39 * u],
      0.00155,
      tint(c.binding, 1.16),
    )
    ink(
      (u) => [sign * (0.68 + 0.88 * u + 0.12 * Math.sin(Math.PI * u)), 0.4 + 0.39 * u],
      0.00066,
      tint(c.welt, 0.87),
    )
  }
  if (style === 'slipper') {
    // Paired sprays of folded lotus leaves and a small plum flower are sewn
    // into the vamp. Each thread lies on the curved last.
    for (const s of [-1, 1]) {
      ink((u) => [s * (0.11 + 0.65 * u), 0.45 + 0.3 * u + 0.038 * Math.sin(Math.PI * u)], 0.0016, c.stem)
      for (const j of [0, 1, 2]) {
        const a = 0.19 + j * 0.16,
          t = 0.51 + j * 0.065
        ink((u) => [s * (a + 0.11 * u), t + 0.065 * Math.sin(Math.PI * u)], 0.0019, c.stem, 8)
        ink((u) => [s * (a + 0.115 * u), t + 0.018 * Math.sin(Math.PI * u)], 0.0012, tint(c.stem, 1.12), 8)
      }
    }
    const center = 0.5
    for (let j = 0; j < 5; j++) {
      const theta = (j * tau) / 5
      ink(
        (u) => {
          const a = u * tau,
            dx = (0.05 + 0.065 * Math.cos(a)) * 0.68,
            dy = 0.038 * Math.sin(a)
          return [
            (dx * Math.cos(theta) - dy * Math.sin(theta)) * 1.3,
            center + dx * Math.sin(theta) + dy * Math.cos(theta),
          ]
        },
        0.00175,
        c.petal,
        12,
      )
    }
    ink((u) => [0.024 * Math.cos(tau * u), center + 0.018 * Math.sin(tau * u)], 0.0017, c.gold, 8)
  } else {
    // The load-bearing forepart has a transverse butt seam. A gored pair
    // of cloth strips follows the instep instead of crossing the toe cap.
    for (const s of [-1, 1]) {
      ink((u) => [s * (1.61 - 0.7 * u), 0.65 + 0.277 * u], 0.0029, c.binding)
      ink((u) => [s * (1.58 - 0.69 * u), 0.66 + 0.27 * u], 0.00087, c.welt)
    }
  }
}

function stocking(b, style, c) {
  const isBoot = style === 'boot'
  const stations = isBoot
    ? [
        [0.116, 0.0359, 0.0408],
        [0.126, 0.034, 0.039],
        [0.153, 0.034, 0.036],
        [0.187, 0.038, 0.041],
        [0.204, 0.0385, 0.042],
        [0.209, 0.039, 0.042],
      ]
    : [
        [0.046, 0.027, 0.042],
        [0.068, 0.0335, 0.048],
        [0.092, 0.0355, 0.042],
        [0.116, 0.0325, 0.037],
        [0.136, 0.031, 0.034],
        [0.153, 0.0335, 0.034],
        [0.166, 0.034, 0.035],
      ]
  b.patch(
    32,
    stations.map((a) => a[0]),
    (u, y) => {
      const a = u * tau,
        [, w, d] = stations.find((q) => q[0] === y)
      const pleat = 1 + 0.025 * Math.sin(5 * a + 0.8 * y * 30) + 0.019 * Math.sin(8 * a - y * 42)
      const z = -0.024 + Math.cos(a) * d * pleat
      const value = 0.91 + 0.065 * Math.cos(7 * a + y * 60) + 0.035 * Math.cos(a)
      return {
        p: [Math.sin(a) * w * pleat, y, z],
        c: tint(isBoot ? c.upper : c.sock, value),
        uv: [u * 8, y * 27],
      }
    },
    { closed: true },
  )
  const y = stations.at(-1)[0],
    w = stations.at(-1)[1],
    d = stations.at(-1)[2]
  for (const h of isBoot ? [y - 0.012, y - 0.004, 0.129] : [y - 0.015, y - 0.009, y - 0.003]) {
    b.patch(
      32,
      [0, 0.3, 0.73, 1],
      (u, t) => {
        const a = u * tau,
          pleat = 1 + 0.025 * Math.sin(5 * a + 0.8 * h * 30) + 0.019 * Math.sin(8 * a - h * 42)
        const color = isBoot ? (h < 0.15 ? c.binding : c.welt) : lerp(c.sock, c.ivory, 0.6)
        const swell = 0.0004 + 0.00075 * Math.sin(Math.PI * t)
        const width = h < 0.15 && isBoot ? 0.0345 : w
        const depth = h < 0.15 && isBoot ? 0.038 : d
        return {
          p: [
            Math.sin(a) * (width * pleat + swell),
            h + 0.0032 * t,
            -0.024 + Math.cos(a) * (depth * pleat + swell),
          ],
          c: color,
          uv: [u * 9, t * 0.4],
        }
      },
      { closed: true },
    )
  }
}
export function shoes(profile, rig, job) {
  const style = styleOf(profile, job),
    paint = finish(profile, style)
  const breadth = clamp(1 + ((profile.girth ?? 1) - 1) * 0.23, 0.94, 1.07)
  // Gait probes use the same last, inner arch and toe bias as the visible
  // underside. The caller applies actor height and placement after sampling.
  const { rings, bottomEdges } = weltFor(style),
    next = new T.Vector3()
  rig.soleSurface = (side, z, fraction, out) => {
    const extent = Math.abs(fraction)
    const sign = side === 'l' ? 1 : -1
    if (extent <= 1) {
      const x = soleX(style, z, fraction)
      return out.set(sign * x * breadth, footbase(z, Math.sign(x)), z)
    }
    // 1..1.15 extends a lane from the bearing surface to the widest load-
    // bearing sidewall. Intersect each faceted ring in the requested Z plane.
    const edge = fraction < 0 ? 0 : 1,
      expand = mix(0.87, 1.006, clamp((extent - 1) / 0.15))
    let band = 1
    while (band < outsoleTurns.length - 1 && expand > outsoleTurns[band][0]) band++
    ringSection(rings[band - 1][edge], z, out)
    const lip = smooth((extent - 1) / 0.024)
    if (lip < 1) {
      // The cloth bottom is sewn on its own polygon under the faceted welt.
      // Join the sampling lane to its measured edge before following the wall.
      const x = soleX(style, z, edge ? 1 : -1)
      out.x = mix(x, out.x, lip)
      out.y = mix(footbase(z, Math.sign(x)), out.y, lip)
    }
    ringSection(rings[band][edge], z, next)
    out.lerp(next, (expand - outsoleTurns[band - 1][0]) / (outsoleTurns[band][0] - outsoleTurns[band - 1][0]))
    // At the rounded toe the bottom cloth polygon can project slightly past
    // a faceted wall. Its first physical contact is then the lower of the two.
    if (z >= soleStations[0] && z <= soleStations.at(-1)) {
      ringSection(bottomEdges[edge], z, next)
      if ((out.x - next.x) * Math.sign(fraction) <= 0) out.y = mix(out.y, Math.min(out.y, next.y), lip)
    }
    out.x *= sign * breadth
    return out
  }
  const combined = new PaintedSurface(),
    indices = [],
    weights = []
  for (const [side, sg] of [
    ['l', 1],
    ['r', -1],
  ]) {
    const foot = rig.rest[side + 'Foot'],
      toe = rig.rest[side + 'Toe']
    const h = foot[1] / 0.09,
      hz = (toe[2] - foot[2]) / 0.145
    const width = h * breadth
    const b = new PaintedSurface(sg < 0, (p) => [
      foot[0] + sg * p[0] * width,
      h * p[1],
      foot[2] + (p[2] + 0.022) * hz,
    ])
    sole(b, style, paint)
    upper(b, style, paint)
    stocking(b, style, paint)
    const start = combined.position.length / 3
    for (let i = 0; i < b.position.length; i += 3) {
      const z = (b.position[i + 2] - foot[2]) / hz - 0.022
      const w = smooth((z - 0.101) / 0.054),
        y = b.position[i + 1] / h
      const shin = (style === 'boot' ? 0.72 : 0.69) * smooth((y - 0.096) / (style === 'boot' ? 0.102 : 0.064))
      const footWeight = Math.max(0, 1 - w - shin)
      indices.push(
        footWeight > 0 ? rig.index[side + 'Foot'] : 0,
        w > 0 ? rig.index[side + 'Toe'] : 0,
        shin > 0 ? rig.index[side + 'Shin'] : 0,
        0,
      )
      weights.push(footWeight, w, shin, 0)
    }
    combined.position.push(...b.position)
    combined.colors.push(...b.colors)
    combined.uv.push(...b.uv)
    for (const index of b.triangles) combined.triangles.push(index + start)
  }
  const geometry = combined.geometry()
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4))
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4))
  const mesh = new T.SkinnedMesh(geometry, shoeMaterial())
  mesh.name = style === 'boot' ? '皂靴' : style === 'slipper' ? '绣花弓履' : '千层底布鞋'
  mesh.userData.shoeStyle = style
  mesh.bind(rig.skeleton, new T.Matrix4())
  mesh.frustumCulled = false
  return mesh
}
