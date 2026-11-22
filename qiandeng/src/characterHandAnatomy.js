import * as T from 'three'
import { knuckles, fingerWidths } from './characterHandWrist.js'
import { posePeriod } from './humanPose.js'
import { handUV, makeHandInk } from './characterHandInk.js'
import {
  PaintedSurface,
  add,
  minus,
  dot,
  cross,
  scale,
  unit,
  lerp,
  mix,
  smooth,
  clamp,
  pigment,
  tint,
  table,
  tau,
} from './characterHandSurface.js'

const handMaterial = new T.MeshStandardMaterial({
  name: '掌骨与指甲',
  color: 0xffffff,
  vertexColors: true,
  roughness: 0.71,
})
handMaterial.userData.skin = true
const metacarpals = [0.083, 0.0885, 0.0852, 0.0772]
const digitLengths = [
  [0.037, 0.023, 0.018],
  [0.041, 0.026, 0.0195],
  [0.038, 0.024, 0.018],
  [0.03, 0.019, 0.015],
]
// Pipa front normal and string-crossing direction in the picking hand's coordinates.
const boardNormal = unit([-0.82, 0.48, -0.31])
const acrossStrings = unit([-0.5057, -0.8627, 0.00194])
const thumbStroke = (phase) => (1 - Math.cos(3 * phase)) * 0.5
const skinAt = (profile) => {
  const skin = pigment(profile.skin ?? 0xca9c7b)
  const rose = lerp(skin, pigment(0xc77f73), 0.32)
  return {
    skin,
    rose,
    volar: lerp(skin, pigment(0xe7bc9c), 0.39),
    crease: lerp(skin, pigment(0x875c4e), 0.4),
    cuticle: lerp(rose, pigment(0xb67f71), 0.24),
    nail: lerp(rose, pigment(0xeac3b2), 0.72),
    tip: lerp(skin, pigment(0xf4deca), 0.81),
  }
}

function configuration(profile, job, side) {
  switch (job) {
    case 'walk':
      return profile.design === 'scholar' && side === 'r' ? ['fan', 0.0095] : ['relaxed', 0]
    case 'row':
      return ['grip', 0.018]
    case 'drum':
      return ['grip', 0.011]
    case 'porter':
      return ['grip', 0.01]
    case 'flute':
      return ['flute', 0.0105]
    case 'lute':
      return side === 'l' ? ['strings', 0.0205] : ['pluck', 0]
    case 'sit':
      return ['grip', 0.009]
    case 'umbrella':
      return side === 'l' ? ['grip', 0.012] : ['relaxed', 0]
    case 'carrier':
      return side === 'r' ? ['grip', 0.018] : ['relaxed', 0]
    case 'watch':
      return ['grip', 0.01]
    case 'basket':
    case 'lantern':
      return side === 'r' ? ['grip', 0.0105] : ['relaxed', 0]
    default:
      return ['relaxed', 0]
  }
}

// During a power grip the metacarpals fan diagonally around the shaft. The
// load-bearing side of the hand stays radial to it and the pulps flatten at contact.
function contact(p, radius) {
  if (!radius) return p
  const x = p[0],
    z = p[2] - 0.026,
    d = Math.hypot(x, z),
    limit = radius + 0.00014
  if (d >= limit) return p
  const k = limit / (d || 0.0001)
  return [x * k, p[1], 0.026 + z * k]
}

function palm(profile, kind, radius, paint, mesh, oarCollar) {
  const gripping = kind !== 'relaxed'
  const breadth = clamp(
    1 +
      (Number(profile.girth ?? 1) - 1) * 0.47 +
      (profile.frame === 'broad' ? 0.04 : profile.frame === 'lean' ? -0.026 : 0),
    0.92,
    1.09,
  )
  const length = clamp(1 + (Number(profile.height ?? 1) - 1) * 0.45, 0.95, 1.06)
  const depth = 1 + (breadth - 1) * 0.72
  function place(v, u, w) {
    v *= length
    u *= breadth
    w *= depth
    if (!gripping) return [w + 0.0025 * smooth(v / 0.06), -v, u + 0.0015 * smooth(v / 0.07)]
    const f = smooth((v + 0.003) / 0.084),
      cup = smooth((v + 0.012) / 0.05)
    const x = w + (0.0215 + radius * 0.34) * cup
    const y = -v * (1 - 0.17 * f) + u * 0.8 * f
    const z = u * (1 - 0.53 * f) + v * 0.585 * f
    if (!radius || Math.abs(z - 0.026) >= radius + 0.0002) return [x, y, z]
    // Here the whole palm is lateral to the handle, including the heel of
    // the thumb. A softened maximum yields a continuous concave contact area.
    const wall = Math.sqrt(Math.max(0, (radius + 0.0002) ** 2 - (z - 0.026) ** 2))
    const delta = x - wall,
      soft = 0.0014
    return [wall + (delta + Math.sqrt(delta * delta + soft * soft)) * 0.5, y, z]
  }
  function surface(a, t, over = 0) {
    const cu = Math.cos(a),
      su = Math.sin(a)
    const width = table(t, [
      [-0.24, 0.023],
      [0, 0.0246],
      [0.22, 0.0303],
      [0.48, 0.037],
      [0.72, 0.0396],
      [0.94, 0.0391],
      [1, 0.036],
    ])
    const u = su * width * (su < 0 ? 0.94 : 1.015)
    const notch = 0.0055 * (1 - Math.exp(-((su - 0.25) ** 2) / 0.34)) + 0.0068 * smooth((-su - 0.38) / 0.55)
    const v = t * 0.094 - smooth((t - 0.57) / 0.44) * notch
    const dorsal = table(t, [
      [-0.24, 0.0165],
      [0.04, 0.0176],
      [0.33, 0.0162],
      [0.67, 0.0142],
      [0.86, 0.0127],
      [1, 0.0098],
    ])
    const pad = table(t, [
      [-0.24, 0.016],
      [0.11, 0.0175],
      [0.37, 0.0173],
      [0.68, 0.0144],
      [0.93, 0.0133],
      [1, 0.009],
    ])
    const thenar = 0.0094 * Math.exp(-((su - 0.58) ** 2) / 0.12 - (t - 0.41) ** 2 / 0.058)
    const hypothenar = 0.0052 * Math.exp(-((su + 0.66) ** 2) / 0.18 - (t - 0.54) ** 2 / 0.117)
    const cup = 0.0043 * Math.exp(-(su ** 2) / 0.17 - (t - 0.53) ** 2 / 0.097)
    const w =
      cu >= 0 ? (dorsal + over) * cu ** 0.7 : -(pad + thenar + hypothenar - cup + over) * (-cu) ** 0.67
    const p = place(v, u, w)
    if (oarCollar && t < 0.15) {
      // The wrist arrives behind the working shaft. Its whole transverse
      // section passes the ferrule on one side, keeping the skin between
      // adjacent meridians out of the wood as well as the vertices.
      const nearWrist = 1 - smooth((t + 0.12) / 0.27)
      const wrist = [w * depth, -v * length, u * breadth - oarCollar]
      return contact(lerp(p, wrist, nearWrist), radius)
    }
    return p
  }
  function draw(fingers, thumb, joined) {
    // Both skins finish on the actual hemispheres of the four digit roots.
    // Each interdigital cleft has its own tapered web and a slight proximal
    // notch. The rest of the palm remains one broad, curved metacarpal surface.
    const rim = []
    for (let k = 3; k >= 0; k--) {
      const digit = fingers[k]
      for (let j = 0; j <= 6; j++) {
        const alpha = -Math.PI / 2 + (Math.PI * j) / 6
        const radial = knuckles[k] + fingerWidths[k] * Math.sin(alpha)
        const dorsal = digit.at(0, alpha),
          volar = digit.at(0, Math.PI - alpha)
        rim.push({ radial, dorsal, volar, direction: digit.frame(0).dir })
      }
      if (k > 0) {
        const edge = digit.at(0, Math.PI / 2),
          other = fingers[k - 1].at(0, -Math.PI / 2)
        const direction = unit(add(digit.frame(0).dir, fingers[k - 1].frame(0).dir))
        const point = add(lerp(edge, other, 0.5), scale(direction, -0.004))
        rim.push({ radial: (knuckles[k] + knuckles[k - 1]) / 2, dorsal: point, volar: point, direction })
      }
    }
    const lo = rim[0].radial,
      hi = rim.at(-1).radial
    const rings = [-0.23, -0.13, 0, 0.12, 0.24, 0.36, 0.47, 0.57, 0.66, 0.74, 0.82, 0.9, 0.955, 1]
    function sheet(ref, t, back) {
      const q = clamp(((ref.radial - lo) / (hi - lo)) * 2 - 1, -1, 1)
      const a = back ? Math.asin(q) : Math.PI - Math.asin(q)
      const join = 0.55
      if (t <= join) return surface(a, t)
      const start = surface(a, join),
        end = back ? ref.dorsal : ref.volar
      const h = (t - join) / (1 - join),
        sq = h * h,
        cu = sq * h
      const m = scale(minus(surface(a, join + 0.025), surface(a, join - 0.025)), (1 - join) / 0.05)
      const tangent = scale(ref.direction, Math.max(0.025, Math.hypot(...minus(end, start)) * 0.8))
      const knot = end.map(
        (v, i) =>
          (2 * cu - 3 * sq + 1) * start[i] +
          (cu - 2 * sq + h) * m[i] +
          (-2 * cu + 3 * sq) * v +
          (cu - sq) * tangent[i],
      )
      // Extensor ridges fan out, disappearing into the high point of each knuckle.
      const closest = Math.min(...knuckles.map((u) => Math.abs(u - ref.radial)))
      const ridge = 0.00135 * Math.exp(-(closest ** 2) / 0.000022) * Math.sin(h * Math.PI) ** 1.3
      if (back) knot[0] += ridge
      return radius ? contact(knot, radius) : knot
    }
    const cutColumn = rim.findIndex((r) => r.radial > 0.0145),
      wa = rings.indexOf(0.24),
      wb = rings.indexOf(0.66)
    const contours = []
    const sides = []
    for (const back of [true, false]) {
      const rows = rings.map((t) => rim.map((ref) => sheet(ref, t, back)))
      contours.push(rows)
      sides.push(
        mesh.patch(
          rim.length - 1,
          rings,
          (u, t) => {
            const col = Math.round(u * (rim.length - 1)),
              item = rim[col],
              p = rows[rings.indexOf(t)][col]
            const flush =
              0.25 * Math.exp(-((t - 0.91) ** 2) / 0.022) +
              0.13 * Math.abs(2 * u - 1) * Math.exp(-((t - 0.45) ** 2) / 0.12)
            const wash = back ? paint.skin : paint.volar,
              radial = (item.radial - lo) / (hi - lo)
            return {
              p,
              c: tint(lerp(wash, paint.rose, flush), 1 + 0.019 * Math.sin(u * Math.PI * 3 + 0.8 * t)),
              uv: handUV(back ? 'back' : 'palm', radial, (t + 0.23) / 1.23),
            }
          },
          { reverse: !back, omit: (col, row) => col >= cutColumn && row >= wa && row < wb },
        ),
      )
    }
    const wrist = [...sides[0][0], ...sides[1][0].slice(1, -1).reverse()]
    if (!joined) mesh.cap(wrist, place(-0.021, 0, 0), paint.skin, true)
    // Replace an actual aperture in the radial side with a smooth saddle
    // tracking the thenar eminence. The distal edge is the thumb's own ring.
    const edge = [],
      last = rim.length - 1
    for (let i = cutColumn; i <= last; i++) edge.push(contours[0][wa][i])
    for (let i = last - 1; i >= cutColumn; i--) edge.push(contours[1][wa][i])
    for (let j = wa + 1; j <= wb; j++) edge.push(contours[1][j][cutColumn])
    for (let i = cutColumn + 1; i <= last; i++) edge.push(contours[1][wb][i])
    for (let i = last - 1; i >= cutColumn; i--) edge.push(contours[0][wb][i])
    for (let j = wb - 1; j > wa; j--) edge.push(contours[0][j][cutColumn])
    const f = thumb.frame(thumb.attach),
      direction = f.dir
    // The palm opening and thumb tube have opposite boundary edges. Keep
    // their winding fixed when the thumb crosses the palm in opposition.
    const edgeU = [0]
    for (let i = 0; i < edge.length; i++) {
      const next = edge[(i + 1) % edge.length]
      edgeU.push(edgeU[i] + Math.hypot(...minus(next, edge[i])))
    }
    const length = edgeU.at(-1)
    let first = 0,
      shortest = Infinity
    for (let j = 0; j < 12; j++) {
      let span = 0
      for (let i = 0; i < edge.length; i++) {
        const end = thumb.at(thumb.attach, (j / 12 + edgeU[i] / length) * tau)
        const d = minus(end, edge[i])
        span += dot(d, d) * (edgeU[i + 1] - edgeU[i])
      }
      if (span < shortest) {
        shortest = span
        first = j
      }
    }
    const samples = [
      ...new Set([
        ...edgeU.slice(0, -1).map((t) => t / length),
        ...Array.from({ length: 12 }, (_, i) => i / 12),
      ]),
    ].sort((a, b) => a - b)
    function roots(u) {
      let i = 0
      while (i + 1 < edge.length && edgeU[i + 1] < u * length - 1e-9) i++
      const a = lerp(
        edge[i],
        edge[(i + 1) % edge.length],
        clamp((u * length - edgeU[i]) / (edgeU[i + 1] - edgeU[i])),
      )
      const k = first + u * 12,
        j = Math.floor(k),
        blend = k - j
      const b = lerp(
        thumb.at(thumb.attach, (tau * j) / 12),
        thumb.at(thumb.attach, (tau * (j + 1)) / 12),
        blend,
      )
      return [a, b]
    }
    function saddle(u, t) {
      const [a, b] = roots(u),
        p = lerp(a, b, t)
      const centre = lerp(place(0.041, 0.025, -0.002), f.p, t),
        v = minus(p, centre)
      const swell = unit(minus(v, scale(direction, dot(v, direction))))
      const h = Math.sin(t * Math.PI)
      const shaped = add(add(p, scale(swell, 0.0045 * h)), scale(direction, -0.004 * h * t))
      return radius ? contact(shaped, radius) : shaped
    }
    mesh.patch(
      samples.length,
      [0, 0.2, 0.43, 0.68, 0.86, 1],
      (u, t) => {
        const progress = samples[Math.round(u * samples.length) % samples.length],
          p = saddle(progress, t)
        return {
          p,
          c: lerp(paint.skin, paint.volar, 0.34 + 0.17 * Math.sin(tau * progress)),
          uv: handUV('back', 0.73 + 0.16 * Math.cos(tau * progress), 0.49 + 0.09 * t),
        }
      },
      { closed: true },
    )
    return {
      outer: wrist,
      inner: [...sides[0][1], ...sides[1][1].slice(1, -1).reverse()],
      twins: new Map([[0, sides[1][0][0]], [rim.length - 1, sides[1][0].at(-1)]]),
    }
  }
  return { place, breadth, length, draw }
}

function relaxedLine(p, digit, length, variant) {
  const lengths = digitLengths[digit],
    root = p.slice(),
    joints = [root]
  const curls = [0.14, 0.19, 0.25, 0.34]
  const progression = [0.0, 0.36, 0.32]
  const spread = (1.4 - digit) * 0.078 + (variant - 0.5) * 0.032
  let angle = curls[digit] + (variant - 0.5) * 0.075
  for (let i = 0; i < 3; i++) {
    angle += progression[i] * (0.82 + 0.14 * digit)
    const direction = unit([-Math.sin(angle), -Math.cos(angle), spread / (i + 1)])
    joints.push(add(joints.at(-1), scale(direction, lengths[i] * length)))
  }
  return joints
}

function fingertipContact(p, end, direction, bend, lengths) {
  const distal = minus(end, scale(unit(direction), lengths[2]))
  const delta = minus(distal, p),
    distance = Math.hypot(...delta),
    along = unit(delta)
  const reach = clamp(
    (lengths[0] ** 2 - lengths[1] ** 2 + distance ** 2) / (2 * distance),
    -lengths[0],
    lengths[0],
  )
  const centre = add(p, scale(along, reach)),
    flank = minus(bend, centre)
  const normal = unit(minus(flank, scale(along, dot(flank, along))))
  const proximal = add(centre, scale(normal, Math.sqrt(Math.max(0, lengths[0] ** 2 - reach ** 2))))
  return [p, proximal, distal, end]
}

function graspLine(p, digit, kind, radius, length) {
  const size = fingerWidths[digit],
    r = radius + size * 0.89
  const y = p[1] - 0.005 - 0.0018 * digit
  const lengths = digitLengths[digit].map((v) => v * length)
  if (kind === 'fan' && (digit === 0 || digit === 3)) {
    // The index rests up the lacquered guard while the middle and ring
    // fingers clasp its root. The little finger opens below the paper fan.
    const end = digit === 0 ? [0.0015, -0.036, 0.026 + radius + 0.0006] : [0.009, -0.111, 0.041]
    const approach = digit === 0 ? [-0.24, 0.52, -0.82] : [0.28, -0.6, -0.75]
    return fingertipContact(p, end, approach, [-0.009, y - 0.002, 0.06], lengths)
  }
  if (kind === 'pluck') {
    // These fingers face the sloping pipa soundboard. The index extends into
    // the string; its neighbours fold back into the space above the palm.
    if (digit === 0)
      return fingertipContact(p, [0.0004, -0.0724, 0.0268], [-0.72, -0.66, 0.16], [0.053, -0.052, 0.058], lengths)
    const k = digit - 1
    const directions = [
      [0.43 + 0.03 * k, -0.89 + 0.025 * k, -0.16 - 0.045 * k],
      [0.10 - 0.035 * k, -0.24 + 0.07 * k, -0.96],
      [-0.40 - 0.045 * k, 0.50 + 0.07 * k, -0.77 + 0.025 * k],
    ]
    const joints = [p]
    for (let i = 0; i < 3; i++) joints.push(add(joints.at(-1), scale(unit(directions[i]), lengths[i])))
    return joints
  }
  if (kind === 'flute' && digit < 3) {
    // The real six finger holes are 27–29 mm apart. Distal pulp closes the
    // upper wall of the bamboo; both neighbouring phalanges keep their lengths.
    const holeY = [-0.044, -0.071, -0.099][digit]
    return fingertipContact(
      p,
      [0, holeY, 0.026 + radius + 0.0006],
      [-0.32, -0.14, -0.94],
      [-0.004 + digit * 0.002, holeY + 0.008, 0.067 - digit * 0.0016],
      lengths,
    )
  }
  if (kind === 'strings' && digit < 3) {
    const station = [-0.049, -0.078, -0.1][digit],
      stringX = [0.007, -0.0021, -0.0072][digit]
    return fingertipContact(
      p,
      [stringX, station, 0.026 + radius + 0.0007],
      [-0.36, -0.1, -0.93],
      [0.0012, station + 0.007, 0.077 - digit * 0.0013],
      lengths,
    )
  }
  const ring = Math.max(0.0175, r)
  const heights = [
    y - [0.003, 0.006, 0.004, 0.0008][digit],
    y - [0.005, 0.0068, 0.009, 0.0035][digit],
    y + [0.0029, -0.0016, -0.0053, 0.0003][digit],
  ]
  const radii = [
    ring + [0.004, 0.0054, 0.0033, 0.0021][digit],
    ring + 0.0014,
    ring * [0.96, 0.93, 0.945, 0.96][digit],
  ]
  const path = [p]
  for (let j = 0; j < 3; j++) {
    const q = path.at(-1),
      rr = Math.hypot(q[0], q[2] - 0.026),
      dy = heights[j] - q[1]
    const cosine = clamp((rr * rr + radii[j] ** 2 + dy * dy - lengths[j] ** 2) / (2 * rr * radii[j]), -1, 1)
    const angle = Math.atan2(q[2] - 0.026, q[0]) + Math.acos(cosine)
    path.push([radii[j] * Math.cos(angle), heights[j], 0.026 + radii[j] * Math.sin(angle)])
  }
  return path
}

function spline(points, t) {
  const i = Math.min(points.length - 2, Math.floor(clamp(t, 0, points.length - 1)))
  const f = clamp(t - i),
    a = points[i],
    b = points[i + 1],
    prev = points[Math.max(0, i - 1)],
    next = points[Math.min(points.length - 1, i + 2)]
  const s = f * f,
    h = s * f
  return a.map(
    (v, k) =>
      (2 * h - 3 * s + 1) * v +
      (h - 2 * s + f) * (b[k] - prev[k]) * (i === 0 ? 0.87 : 0.42) +
      (-2 * h + 3 * s) * b[k] +
      (h - s) * (next[k] - v) * (i === points.length - 2 ? 0.87 : 0.42),
  )
}

function finger(mesh, points, lateral, width, paint, radius, digit, animated) {
  const start = mesh.position.length / 3,
    thumb = digit === 4,
    attach = thumb ? 0.79 : 0
  const form = [
    [0, thumb ? 1.4 : 1.03],
    [0.19, thumb ? 1.25 : 1.04],
    [0.53, 0.93],
    [0.83, 0.91],
    [0.98, 0.99],
    [1.17, 0.91],
    [1.52, 0.81],
    [1.84, 0.78],
    [1.99, 0.84],
    [2.15, 0.78],
    [2.46, 0.75],
    [2.61, 0.76],
    [2.73, 0.72],
    [2.83, 0.65],
    [2.905, 0.53],
    [2.956, 0.37],
    [2.985, 0.22],
    [3, 0.065],
  ]
  const curves = new Map()
  function frame(t) {
    if (curves.has(t)) return curves.get(t)
    const p = spline(points, t),
      dir = unit(minus(spline(points, Math.min(3, t + 0.018)), spline(points, Math.max(0, t - 0.018))))
    const u = unit(minus(lateral, scale(dir, dot(lateral, dir))))
    const dorsal = unit(cross(u, dir))
    const w = width * table(t, form)
    const result = { p, u, dorsal, w, dir }
    curves.set(t, result)
    return result
  }
  function at(t, a, lift = 0) {
    const f = frame(t),
      s = Math.sin(a),
      c = Math.cos(a)
    const pulp = c < 0 ? 1.04 + 0.1 * Math.exp(-((t - 2.63) ** 2) / 0.12) : 0.83
    let p = add(
      f.p,
      add(scale(f.u, f.w * s), scale(f.dorsal, (f.w * pulp + lift) * Math.sign(c) * Math.abs(c) ** 0.81)),
    )
    if (radius) p = contact(p, radius)
    return p
  }
  const stations = [attach, ...form.map((s) => s[0]).filter((t) => t > attach)]
  const rings = mesh.patch(12, stations, (u, t) => {
    const c = Math.cos(u * tau),
      flush = 0.15 + 0.22 * Math.exp(-((t - 1) ** 2) / 0.042) + 0.17 * Math.exp(-((t - 2) ** 2) / 0.051)
    const base = c < 0 ? paint.volar : paint.skin
    return { p: at(t, u * tau), c: lerp(base, paint.rose, flush), uv: handUV('finger', u, t / 3) }
  })
  mesh.cap(rings.at(-1), points[3], paint.rose)
  // The nail is an arched plate laid on the last phalanx. Its pale distal
  // rim and crescent cuticle are drawn on the same curved surface as the bed.
  mesh.patch(10, [0, 0.08, 0.2, 0.49, 0.78, 0.91, 1], (u, v) => {
    const s = u * 2 - 1
    const shoulder = Math.sqrt(Math.max(0, 1 - s * s))
    const root = 2.34 - 0.095 * shoulder,
      tip = 2.75 + 0.104 * shoulder
    const t = mix(root, tip, v),
      a = s * (thumb ? 0.9 : 0.87) * (0.78 + 0.22 * Math.sin(Math.PI * v))
    const c =
      v > 0.89
        ? paint.tip
        : v < 0.09
          ? paint.cuticle
          : lerp(paint.nail, paint.tip, 0.18 * Math.max(0, 1 - v * 4) * shoulder)
    return {
      p: at(t, a, 0.00034 + 0.00044 * shoulder * Math.sin(v * Math.PI)),
      c,
      uv: handUV('nail', u, v),
    }
  })
  for (const [joint, bend] of [
    [0.987, 0.12],
    [1.11, 0.067],
    [1.995, 0.083],
  ]) {
    mesh.patch(8, [0, 1], (u, v) => {
      const s = u * 2 - 1,
        t = joint + 0.034 * s * s + (v - 0.5) * bend * 0.27 * Math.max(0.1, Math.sin(u * Math.PI))
      return {
        p: at(t, s * (joint > 1.9 ? 0.59 : 0.7), 0.00018),
        c: lerp(paint.skin, paint.crease, joint === 1.11 ? 0.42 : 0.7),
      }
    })
  }
  // Bind the playing fingertips to a local PIP hinge. Only the affected
  // vertices of a flute or lute receive a small timed rotation at runtime.
  if (animated) {
    const base = frame(0.76),
      end = mesh.position.length / 3,
      towards = unit(minus(points[3], points[0]))
    // The thumb shares its first ring with the stationary thenar web. Ease
    // its plucking rotation in along the proximal phalanx past that junction.
    const fadeRings = thumb ? stations.indexOf(1.52) : 0
    animated.push({ start, end, fadeRings, ringSize: rings[0].length, pivot: base.p, axis: base.u, dir: towards, digit })
  }
  const distalSkin = [rings[stations.findIndex((t) => t >= 2.15)][0], rings.at(-1).at(-1) + 2]
  return { at, frame, attach, distalSkin }
}

function smoothSeams(g) {
  const vertices = g.attributes.position.array,
    n = g.attributes.normal.array,
    groups = new Map()
  for (let i = 0; i < vertices.length; i += 3) {
    const key =
      Math.round(vertices[i] * 1e7) +
      ',' +
      Math.round(vertices[i + 1] * 1e7) +
      ',' +
      Math.round(vertices[i + 2] * 1e7)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(i)
  }
  for (const indices of groups.values()) {
    if (indices.length === 1) continue
    let x = 0,
      y = 0,
      z = 0
    for (const i of indices) {
      x += n[i]
      y += n[i + 1]
      z += n[i + 2]
    }
    const length = Math.hypot(x, y, z)
    if (length < 0.00001) continue
    for (const i of indices) {
      n[i] = x / length
      n[i + 1] = y / length
      n[i + 2] = z / length
    }
  }
}

export function sculptHand(profile, side, job, joined = false) {
  const mirror = side === 'r',
    sg = mirror ? -1 : 1
  const surface = new PaintedSurface(mirror, (p) => [p[0] * sg, p[1], p[2]])
  const [kind, radius] = configuration(profile, job, side),
    paint = skinAt(profile)
  const oarCollar = job === 'row' ? (side === 'l' ? 0.0235 : 0.0225) : 0
  const { place, breadth, length, draw } = palm(profile, kind, radius, paint, surface, oarCollar)
  const moving = kind === 'flute' || kind === 'pluck' || kind === 'strings' ? [] : null
  const targets = [],
    fingers = []
  const seed = ((profile.seed ?? profile.id ?? 1) * 0.173) % 1
  for (let i = 0; i < 4; i++) {
    const root = place(metacarpals[i], knuckles[i], 0.0005)
    const path =
      kind === 'relaxed' ? relaxedLine(root, i, length, seed) : graspLine(root, i, kind, radius, length)
    fingers.push(
      finger(
        surface,
        path,
        kind === 'relaxed' ? [0, 0, 1] : [0, 1, kind === 'pluck' ? 0.32 : 0.14],
        fingerWidths[i] * breadth,
        paint,
        radius,
        i,
        moving,
      ),
    )
    targets.push(path.map((p) => [sg * p[0], p[1], p[2]]))
  }
  const relaxed = kind === 'relaxed'
  const base = relaxed ? place(0.026, 0.015, -0.0045) : place(0.017, 0.026, -0.0015)
  // A cupped thumb emerges beyond the radial edge before opposing the
  // fingers. A metacarpal buried inside the palm folds the web back through it.
  const grip = radius || 0.0095
  const knuckle = [0.0095 + grip * 0.92, -0.031, 0.052 + (grip - 0.0095) * 0.64]
  let thumb
  if (relaxed) {
    thumb = [base, place(0.049, 0.04, -0.005), place(0.069, 0.048, -0.014), place(0.087, 0.05, -0.025)]
  } else if (kind === 'pluck') {
    thumb = [base, knuckle, [0.01469, -0.05310, 0.03517], [-0.005, -0.0565, 0.036]]
  } else if (kind === 'fan') {
    // Oppose the index on the narrow, flat back of the outer guard.
    thumb = [base, knuckle, [0.0059, -0.047, 0.0088], [-0.0045, -0.0646, 0.01735]]
  } else {
    const r = radius + 0.009
    thumb = [
      base,
      knuckle,
      [r * 0.32, -0.047, 0.026 - r * 0.99],
      [-r * 0.46, -0.064, 0.026 - r * 0.88],
    ]
  }
  // The thumbnail faces dorsoradially. Its plane is rotated relative to the
  // other nails because the thumb has rotated out of the plane of the palm.
  const thumbAxis = kind === 'relaxed' ? [-0.66, 0, 0.76] : [-0.62, 0.62, 0.48]
  const thumbShape = finger(
    surface,
    thumb,
    thumbAxis,
    0.0101 * breadth,
    paint,
    radius,
    4,
    kind === 'pluck' ? moving : null,
  )
  targets.push(thumb.map((p) => [sg * p[0], p[1], p[2]]))
  const wrist = draw(fingers, thumbShape, joined)
  handMaterial.map ??= makeHandInk()
  const mesh = new T.Mesh(surface.geometry(), handMaterial)
  smoothSeams(mesh.geometry)
  mesh.name = (side === 'l' ? '左' : '右') + '手'
  mesh.userData.gesture = kind
  mesh.userData.digitJoints = targets
  mesh.userData.distalSkin = [...fingers, thumbShape].map((finger) => finger.distalSkin)
  mesh.userData.gripRadius = radius
  if (!moving?.length) return { mesh, wrist }
  const geometry = mesh.geometry,
    initial = geometry.attributes.position.array,
    restNormals = geometry.attributes.normal.array
  geometry.morphTargetsRelative = true
  geometry.morphAttributes.position = []
  geometry.morphAttributes.normal = []
  const digits = ['食指', '中指', '无名指', '小指', '拇指']
  const active = moving.filter((f) =>
    kind === 'pluck' ? f.digit < 3 || f.digit === 4 : kind === 'flute' ? f.digit < 3 : f.digit > 0,
  )
  for (const f of active) {
    const offsets = new Float32Array(initial.length),
      normals = new Float32Array(initial.length)
    f.pivot[0] *= sg
    f.axis[0] *= sg
    f.dir[0] *= sg
    const tip = targets[f.digit][3]
    if (kind === 'pluck') {
      const lift = add(boardNormal, scale(acrossStrings, f.digit === 4 ? -0.68 : 0.68))
      f.axis = unit(cross(minus(tip, f.pivot), lift))
    }
    const [ax, ay, az] = f.axis,
      [px, py, pz] = f.pivot,
      [dx, dy, dz] = f.dir
    const direction =
      kind === 'pluck' ? 1 : Math.sign(ax * (tip[1] - py) - ay * (tip[0] - px)) || 1
    const degrees = kind === 'pluck' ? (f.digit === 0 || f.digit === 4 ? 23 : 4) : kind === 'flute' ? 9 : 5
    const flex = (degrees * (f.digit === 3 ? 0.61 : 1) * Math.PI * direction) / 180
    for (let i = f.start; i < f.end; i++) {
      const k = i * 3,
        x = initial[k] - px,
        y = initial[k + 1] - py,
        z = initial[k + 2] - pz
      const d = x * dx + y * dy + z * dz,
        release = f.fadeRings ? smooth(Math.floor((i - f.start) / f.ringSize) / f.fadeRings) : 1,
        a = flex * smooth((d + 0.002) / 0.019) * release
      const sn = Math.sin(a),
        cs = Math.cos(a),
        q = 1 - cs,
        projection = ax * x + ay * y + az * z
      offsets[k] = x * (cs - 1) + (ay * z - az * y) * sn + ax * projection * q
      offsets[k + 1] = y * (cs - 1) + (az * x - ax * z) * sn + ay * projection * q
      offsets[k + 2] = z * (cs - 1) + (ax * y - ay * x) * sn + az * projection * q
      const u = restNormals[k],
        v = restNormals[k + 1],
        w = restNormals[k + 2],
        n = ax * u + ay * v + az * w
      normals[k] = u * (cs - 1) + (ay * w - az * v) * sn + ax * n * q
      normals[k + 1] = v * (cs - 1) + (az * u - ax * w) * sn + ay * n * q
      normals[k + 2] = w * (cs - 1) + (ax * v - ay * u) * sn + az * n * q
    }
    const pos = new T.Float32BufferAttribute(offsets, 3),
      nor = new T.Float32BufferAttribute(normals, 3)
    pos.name = nor.name = mesh.name + digits[f.digit] + '奏指'
    geometry.morphAttributes.position.push(pos)
    geometry.morphAttributes.normal.push(nor)
  }
  mesh.updateMorphTargets()
  if (kind === 'pluck') {
    const period = posePeriod(profile, { job: 'lute' })
    const vertex = geometry.attributes.position,
      normal = new T.Vector3(...boardNormal),
      sample = new T.Vector3()
    // The fibre of the real string meets the outer pulp of each distal
    // phalanx. Its two support vertices are fixed in the pressed shapes.
    const pads = [0, 4].map((digit) => {
      const [start, end] = mesh.userData.distalSkin[digit]
      let lowest = Infinity,
        support = start
      for (let i = start; i < end; i++) {
        const height = sample.fromBufferAttribute(vertex, i).dot(normal)
        if (height < lowest) {
          support = i
          lowest = height
        }
      }
      return { index: support, point: new T.Vector3().fromBufferAttribute(vertex, support) }
    })
    mesh.userData.pickingPads = { index: pads[0].index, thumb: pads[1].index }
    return {
      mesh,
      wrist,
      pickingContact(phase, out) {
        return out.copy(pads[0].point).lerp(pads[1].point, thumbStroke(phase))
      },
      update(state) {
        const phase = ((state.t ?? 0) * tau) / period + (state.phase ?? 0)
        const turn = thumbStroke(phase)
        for (const [i, f] of active.entries()) {
          mesh.morphTargetInfluences[i] = f.digit === 4 ? 1 - turn : f.digit === 0 ? turn : 0.25 + 0.35 * turn
        }
      },
    }
  }
  const fretPeriod = kind === 'strings' ? posePeriod(profile, { job: 'lute' }) : null
  function update(state) {
    const time = state.t ?? 0
    const beat = fretPeriod
      ? 2 * ((tau * time) / fretPeriod + (state.phase ?? 0))
      : time * 3.7 + (state.phase ?? 0)
    for (let i = 0; i < active.length; i++)
      mesh.morphTargetInfluences[i] = (0.5 - 0.5 * Math.cos(beat + active[i].digit * 1.84)) ** 2
  }
  return { mesh, wrist, update }
}
