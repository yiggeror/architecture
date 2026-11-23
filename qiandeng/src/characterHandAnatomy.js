import * as T from 'three'
import { knuckles, fingerWidths } from './characterHandWrist.js'
import { drumPressure, drumHandMotion } from './characterHandPressure.js'
import {
  inFrettingSpace,
  seatFrettingHand,
  fromFretboardVector,
  frettingToWrist,
} from './characterHandFret.js'
import { portraitPerformance } from './characterActing.js'
import { posePeriod } from './humanPose.js'
import { handUV, makeHandInk, makeHandFinish } from './characterHandInk.js'
import {
  PaintedSurface,
  softenPalm,
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
  roughness: 0.73,
  roughnessMap: makeHandFinish(),
})
handMaterial.metalnessMap = handMaterial.roughnessMap
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
// Right-hand chart before the final left/right mirror. The index and thumb
// work across the silk, while the palm vaults away from the face of the lute.
const radialOnBoard = unit([0.269, 0.156, 0.951])
const pickNormal = unit([0.82, 0.48, -0.31])
const pickAcross = unit([0.5057, -0.8627, 0.00194])
function pickSpace(along, radial, height) {
  return add(add(scale(pickAcross, along), scale(radialOnBoard, radial)), scale(pickNormal, height))
}
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
    nail: lerp(rose, pigment(0xd8a49b), 0.67),
    tip: lerp(skin, pigment(0xf4deca), 0.71),
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
  const fret = profile.id === 9 && kind === 'strings'
  const heldAtWrist = (kind === 'fan' || kind === 'grip') && [4, 47, 64].includes(profile.id)
  const breadth = clamp(
    1 +
      (Number(profile.girth ?? 1) - 1) * 0.47 +
      (profile.frame === 'broad' ? 0.04 : profile.frame === 'lean' ? -0.026 : 0),
    0.92,
    1.09,
  )
  const length = clamp(1 + (Number(profile.height ?? 1) - 1) * 0.45, 0.95, 1.06)
  const fine =
    profile.design === 'lute'
      ? 0.83
      : profile.design === 'silk'
        ? 0.88
        : profile.design === 'scholar'
          ? 0.94
          : 1
  const bony =
    profile.design === 'drummer' || profile.design === 'scholar' || (profile.age ?? 30) > 53 ? 1.2 : 0.82
  const depth = (1 + (breadth - 1) * 0.72) * fine
  function place(v, u, w) {
    v *= length
    u *= breadth
    w *= depth
    if (kind === 'pluck') {
      // The radial carpals roll toward the long axis of the string. Rotate
      // gradually from the wrist so the sleeve and naked forearm stay seated.
      const roll = smooth((v + 0.017) / 0.074)
      const end = pickSpace(v * 0.7, u * 0.93 - v * 0.265, w + 0.0126 * smooth(v / 0.08))
      return lerp([w, -v, u], end, roll)
    }
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
    let v = t * 0.094 - smooth((t - 0.57) / 0.44) * notch
    // A flexed working wrist turns at the carpus itself. Avoid an extra
    // rigid cuff of hand skin extending up the forearm when holding a tool.
    if (heldAtWrist) v += 0.0195 * (1 - smooth((v + 0.022) / 0.063))
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
    const wristBone = 0.0022 * bony * Math.exp(-((su + 0.77) ** 2) / 0.08 - (t - 0.085) ** 2 / 0.012)
    const gutter = 0.0025 * Math.exp(-((su - 0.22) ** 2) / 0.15 - (t - 0.36) ** 2 / 0.07)
    const w =
      cu >= 0
        ? (dorsal + wristBone - gutter + over) * cu ** 0.84
        : -(pad + thenar + hypothenar - cup * 1.45 + over) * (-cu) ** 0.72
    if (fret) {
      // Index knuckle leads the diagonal distal ridge. The proximal
      // metacarpals fan from a straight forearm with little wrist extension.
      const fan = smooth((t + 0.02) / 0.77)
      const side = u * breadth
      return inFrettingSpace([
        w * depth + 0.009 * fan,
        -v * length - 0.51 * side * fan,
        side * (1 - 0.17 * fan) - 0.017 * fan,
      ])
    }
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
      const ridge = 0.00235 * bony * Math.exp(-(closest ** 2) / 0.000022) * Math.sin(h * Math.PI) ** 1.3
      if (back) {
        const knucklePeak = 0.00285 * bony * Math.exp(-(closest ** 2) / 0.000038 - (h - 0.83) ** 2 / 0.035)
        const relief = (ridge + knucklePeak * (1 - smooth((h - 0.82) / 0.18))) * (1 - Math.abs(q) ** 6)
        const dorsal = fret
          ? minus(inFrettingSpace([1, 0, 0]), inFrettingSpace([0, 0, 0]))
          : kind === 'pluck'
            ? pickNormal
            : [1, 0, 0]
        for (let i = 0; i < 3; i++) knot[i] += relief * dorsal[i]
      }
      return radius && !fret ? contact(knot, radius) : knot
    }
    const volarCut = rim.findIndex((r) => r.radial > 0.0145),
      dorsalCut = fret ? rim.findIndex((r) => r.radial > 0.027) : volarCut,
      wa = rings.indexOf(0.24),
      wb = rings.indexOf(fret ? 0.57 : 0.66)
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
          {
            reverse: !back,
            omit: (col, row) => col >= (back ? dorsalCut : volarCut) && row >= wa && row < wb,
          },
        ),
      )
    }
    const wrist = [...sides[0][0], ...sides[1][0].slice(1, -1).reverse()]
    if (!joined) mesh.cap(wrist, place(-0.021, 0, 0), paint.skin, true)
    // Replace an actual aperture in the radial side with a smooth saddle
    // tracking the thenar eminence. The distal edge is the thumb's own ring.
    const edge = [],
      edgeIndices = [],
      edgeTangents = [],
      last = rim.length - 1
    function rimPoint(side, row, col, rowOut, colOut) {
      const point = contours[side][row][col]
      edge.push(point)
      edgeIndices.push(sides[side][row][col])
      edgeTangents.push(unit(minus(point, contours[side][rowOut][colOut])))
    }
    for (let i = dorsalCut; i <= last; i++) rimPoint(0, wa, i, wa - 1, i)
    for (let i = last - 1; i >= volarCut; i--) rimPoint(1, wa, i, wa - 1, i)
    for (let j = wa + 1; j <= wb; j++) rimPoint(1, j, volarCut, j, volarCut - 1)
    for (let i = volarCut + 1; i <= last; i++) rimPoint(1, wb, i, wb + 1, i)
    for (let i = last - 1; i >= dorsalCut; i--) rimPoint(0, wb, i, wb + 1, i)
    for (let j = wb - 1; j > wa; j--) rimPoint(0, j, dorsalCut, j, dorsalCut - 1)
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
      const along = clamp((u * length - edgeU[i]) / (edgeU[i + 1] - edgeU[i]))
      const palmTangent = unit(lerp(edgeTangents[i], edgeTangents[(i + 1) % edge.length], along))
      const distal = lerp(
        thumb.at(thumb.attach + 0.025, (tau * j) / 12),
        thumb.at(thumb.attach + 0.025, (tau * (j + 1)) / 12),
        blend,
      )
      return [a, b, palmTangent, unit(minus(distal, b))]
    }
    function saddle(u, t) {
      const [a, b, start, end] = roots(u),
        length = Math.hypot(...minus(b, a))
      const smoothStep = t * t * (3 - 2 * t),
        p = lerp(a, b, smoothStep)
      const reach = Math.min(0.023, length * 0.83)
      const shaped = add(add(p, scale(start, reach * t * (1 - t) ** 2)), scale(end, -reach * t * t * (1 - t)))
      if (fret)
        return add(
          shaped,
          minus(inFrettingSpace([0.0043 * Math.sin(Math.PI * t), 0, 0]), inFrettingSpace([0, 0, 0])),
        )
      return radius ? contact(shaped, radius) : shaped
    }
    const waist = mesh.patch(
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
    const junctions = []
    for (const [k, u] of samples.entries()) {
      let i = 0
      while (i + 1 < edge.length && edgeU[i + 1] < u * length - 1e-9) i++
      const along = clamp((u * length - edgeU[i]) / (edgeU[i + 1] - edgeU[i]))
      junctions.push([waist[0][k], edgeIndices[i], edgeIndices[(i + 1) % edge.length], along])
      const end = first + u * 12,
        j = Math.floor(end)
      junctions.push([waist.at(-1)[k], thumb.rootRing[j % 12], thumb.rootRing[(j + 1) % 12], end - j])
    }
    return {
      junctions,
      outer: wrist,
      inner: [...sides[0][1], ...sides[1][1].slice(1, -1).reverse()],
      twins: new Map([
        [0, sides[1][0][0]],
        [rim.length - 1, sides[1][0].at(-1)],
      ]),
    }
  }
  return { place, breadth, length, fine, bony, draw }
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
      return fingertipContact(
        p,
        [0.0004, -0.0724, 0.0268],
        pickSpace(-0.3, 0.2, -0.932),
        pickSpace(0.1, 0.023, 0.012),
        lengths,
      )
    const k = digit - 1
    const curls = [
      [-0.19, -1.32, -2.14],
      [-0.09, -1.25, -2.2],
      [0.05, -1.21, -2.29],
    ][k]
    const flare = [0.06, -0.11, -0.26][k],
      obliquity = [0.6, 0.65, 0.69][k]
    const joints = [p]
    for (let i = 0; i < 3; i++) {
      const angle = curls[i],
        lift = Math.sin(angle)
      const arc = pickSpace(
        Math.cos(angle),
        flare * (1 - 0.14 * i) + lift * Math.sin(obliquity),
        lift * Math.cos(obliquity),
      )
      joints.push(add(joints.at(-1), scale(unit(arc), lengths[i])))
    }
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

// Fillet each hinge in physical distance. At a stopped note the fold of
// an interphalangeal joint must accommodate the full width of its pulp.
function roundedPhalanges(points, t) {
  const segment = Math.min(2, Math.floor(t)),
    blend = t - segment
  const axis = (i) => minus(points[i + 1], points[i])
  const leg = axis(segment),
    length = Math.hypot(...leg)
  for (const hinge of [1, 2]) {
    if (Math.abs(t - hinge) > 1) continue
    const left = axis(hinge - 1),
      right = axis(hinge)
    const trim = Math.min(Math.hypot(...left), Math.hypot(...right)) * 0.47
    const distance = (t - hinge) * length
    if (Math.abs(distance) >= trim) continue
    const u = (distance / trim + 1) * 0.5
    const a = add(points[hinge], scale(unit(left), -trim)),
      b = add(points[hinge], scale(unit(right), trim))
    return add(add(scale(a, (1 - u) ** 2), scale(points[hinge], 2 * u * (1 - u))), scale(b, u * u))
  }
  return lerp(points[segment], points[segment + 1], blend)
}

function finger(mesh, points, lateral, width, paint, radius, digit, animated, fine, bony, fret = false) {
  const start = mesh.position.length / 3,
    thumb = digit === 4,
    attach = thumb ? (fret ? 0.38 : 0.79) : 0
  const centreline = fret ? roundedPhalanges : spline
  const form = [
    [0, thumb ? 1.27 : 1.04],
    [0.19, thumb ? 1.14 : 0.99],
    [0.53, 0.865],
    [0.8, 0.825],
    [0.965, 0.945],
    [1.09, 0.91],
    [1.25, 0.785],
    [1.52, 0.725],
    [1.82, 0.677],
    [1.98, 0.745],
    [2.15, 0.686],
    [2.38, 0.647],
    [2.61, 0.655],
    [2.75, 0.624],
    [2.84, 0.561],
    [2.921, 0.433],
    [2.963, 0.277],
    [2.987, 0.143],
    [3, 0.065],
  ]
  const curves = new Map()
  function frame(t) {
    if (curves.has(t)) return curves.get(t)
    const p = centreline(points, t),
      dir = unit(
        minus(centreline(points, Math.min(3, t + 0.018)), centreline(points, Math.max(0, t - 0.018))),
      )
    const axis = typeof lateral === 'function' ? lateral(t, dir) : lateral
    const u = unit(minus(axis, scale(dir, dot(axis, dir))))
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
    // A slightly keener radial edge on the proximal shaft, paired
    // condyles at the hinge and a broad, asymmetric distal pad.
    const pip = Math.exp(-((t - 0.975) ** 2) / 0.027)
    const dip = Math.exp(-((t - 1.975) ** 2) / 0.022)
    const joint = (0.14 * pip + 0.08 * dip) * bony
    const tip = Math.exp(-((t - 2.59) ** 2) / 0.15)
    const lean = (digit === 0 || digit === 4 ? -1 : 1) * (0.055 + 0.038 * tip)
    const outward = Math.sign(s) * Math.abs(s) ** (0.88 - 0.18 * tip) * (1 + lean * s)
    const condyle = joint * (0.3 + 0.7 * Math.abs(s)) * Math.max(c, 0)
    const pulp = c < 0 ? 0.91 + (thumb ? 0.22 : 0.16) * tip : 0.72 + condyle
    const ovalHeight = Math.sign(c) * Math.abs(c) ** (c > 0 ? 0.79 - 0.27 * tip : 0.84)
    const section = f.w * (1 - (1 - fine) * smooth(t / 0.55))
    let p = add(
      f.p,
      add(scale(f.u, section * outward), scale(f.dorsal, (section * pulp + lift) * ovalHeight)),
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
    const root = 2.29 - 0.095 * shoulder + 0.013 * s,
      tip = 2.81 + 0.075 * shoulder + 0.021 * s
    const t = mix(root, tip, v),
      a = s * (thumb ? 0.87 : 0.91) * (0.78 + 0.22 * Math.sin(Math.PI * v))
    const c =
      v > 0.945
        ? paint.tip
        : v < 0.09
          ? paint.cuticle
          : lerp(paint.nail, paint.tip, 0.18 * Math.max(0, 1 - v * 4) * shoulder)
    return {
      p: at(t, a, 0.00022 + 0.00033 * shoulder * Math.sin(v * Math.PI)),
      c,
      uv: handUV('nail', u, v),
    }
  })
  if (!fret)
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
    const fadeRings = thumb ? stations.indexOf(1.52) : stations.indexOf(0.53)
    animated.push({
      start,
      end,
      fadeRings,
      ringSize: rings[0].length,
      pivot: base.p,
      axis: base.u,
      dir: towards,
      digit,
    })
  }
  const distalSkin = [rings[stations.findIndex((t) => t >= 2.15)][0], rings.at(-1).at(-1) + 2]
  return { at, frame, attach, distalSkin, rootRing: rings[0], end: mesh.position.length / 3 }
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
  const { place, breadth, length, fine, bony, draw } = palm(profile, kind, radius, paint, surface, oarCollar)
  const welcoming = profile.id === 47 && side === 'r' && kind === 'relaxed'
  const moving = welcoming || kind === 'flute' || kind === 'pluck' || kind === 'strings' ? [] : null
  const reSeat = profile.id === 9 && kind === 'strings'
  const fretKnuckles = [
    [0.009, -0.076, 0.022],
    [0.011, -0.081, 0.006],
    [0.009, -0.079, -0.012],
    [0.005, -0.069, -0.027],
  ]
  const fretDorsal = reSeat ? minus(inFrettingSpace([1, 0, 0]), inFrettingSpace([0, 0, 0])) : null
  const targets = [],
    fingers = []
  const seed = ((profile.seed ?? profile.id ?? 1) * 0.173) % 1
  for (let i = 0; i < 4; i++) {
    const root = place(metacarpals[i], knuckles[i], 0.0005)
    let path =
      kind === 'relaxed' ? relaxedLine(root, i, length, seed) : graspLine(root, i, kind, radius, length)
    let transverse = kind === 'relaxed' ? [0, 0, 1] : kind === 'pluck' ? radialOnBoard : [0, 1, 0.14]
    if (reSeat) {
      // Keep the sounded note and distal approach, but spread the MCP roots
      // across this palm instead of bunching them along the neck's centre.
      const mcp = inFrettingSpace(fretKnuckles[i])
      const shift = fromFretboardVector(
        [
          [0, 0, 0],
          [0.009, 0, 0.0023],
          [0.0177, 0, 0.004],
          [0.031, -0.0186, 0.02],
        ][i],
      )
      const end = add(path[3], shift),
        approach = minus(path[3], path[2])
      path = fingertipContact(
        mcp,
        end,
        approach,
        add(path[1], scale(shift, 0.47)),
        digitLengths[i].map((v) => v * length),
      )
      const distalAxis = transverse
      transverse = (t, dir) => {
        const back = unit(cross(dir, fretDorsal))
        const side = unit(minus(distalAxis, scale(dir, dot(distalAxis, dir))))
        const angle = Math.atan2(dot(dir, cross(back, side)), dot(back, side)) * smooth((t - 0.25) / 1.53)
        return add(scale(back, Math.cos(angle)), scale(cross(dir, back), Math.sin(angle)))
      }
    }
    fingers.push(
      finger(
        surface,
        path,
        transverse,
        fingerWidths[i] * breadth,
        paint,
        radius,
        i,
        moving,
        fine,
        bony,
        reSeat,
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
    thumb = [base, pickSpace(0.043, 0.039, 0.009), pickSpace(0.05, 0.041, -0.016), [-0.005, -0.0565, 0.036]]
  } else if (kind === 'fan') {
    // Oppose the index on the narrow, flat back of the outer guard.
    thumb = [base, knuckle, [0.0059, -0.047, 0.0088], [-0.0045, -0.0646, 0.01735]]
  } else {
    const r = radius + 0.009
    thumb = [base, knuckle, [r * 0.32, -0.047, 0.026 - r * 0.99], [-r * 0.46, -0.064, 0.026 - r * 0.88]]
  }
  if (reSeat) {
    thumb[0] = inFrettingSpace([-0.006, -0.035, 0.028])
    thumb[1] = inFrettingSpace([-0.026, -0.056, 0.019])
    // The soft thumb pad supports the V of the neck with the nail outward.
    for (const j of [2, 3]) thumb[j] = add(thumb[j], [0.000079, -0.00012, 0.00042])
  }
  const narrowGrip = (profile.id === 47 && kind === 'grip') || (profile.id === 4 && job === 'drum')
  if (narrowGrip || kind === 'fan') {
    // Wrap the opposing thumb once around the near wall. The long axis of
    // its first phalanx stays on the hand side of the shaft.
    thumb[1] = [radius + 0.0133, -0.0298, 0.0351]
    if (narrowGrip) {
      thumb[2] = [radius * 0.95 + 0.0021, -0.0471, 0.026 - radius - 0.006]
      thumb[3] = [-0.0075, -0.0639, 0.026 - radius - 0.0067]
    }
  }
  // The thumbnail faces dorsoradially. Its plane is rotated relative to the
  // other nails because the thumb has rotated out of the plane of the palm.
  const thumbAxis = reSeat
    ? unit(cross(unit(minus(thumb[3], thumb[2])), [-0.176, 0.27, -0.946]))
    : narrowGrip
      ? unit(cross(unit(minus(thumb[3], thumb[2])), unit([thumb[3][0], 0, thumb[3][2] - 0.026])))
      : kind === 'relaxed'
        ? [-0.66, 0, 0.76]
        : [-0.62, 0.62, 0.48]
  const thumbShape = finger(
    surface,
    thumb,
    thumbAxis,
    0.0101 * breadth,
    paint,
    radius,
    4,
    kind === 'pluck' ? moving : null,
    fine,
    bony,
    reSeat,
  )
  targets.push(thumb.map((p) => [sg * p[0], p[1], p[2]]))
  const wrist = draw(fingers, thumbShape, joined)
  if (reSeat || profile.id === 9 || profile.id === 47 || profile.id === 64 || profile.id === 4)
    softenPalm(
      surface,
      [...fingers, thumbShape],
      wrist.junctions,
      reSeat ? 0 : radius,
      reSeat ? frettingToWrist : null,
    )
  if (kind === 'pluck') {
    // A stopped pad yields slightly along the normal of the string. Store
    // its elastic displacement so the flesh regains its convexity on release.
    for (const f of moving.filter((f) => f.digit === 0 || f.digit === 4)) {
      const [start, end] = (f.digit === 4 ? thumbShape : fingers[0]).distalSkin
      let low = Infinity,
        pad
      for (let i = start; i < end; i++) {
        const p = surface.position.slice(i * 3, i * 3 + 3),
          height = dot(p, boardNormal)
        if (height < low) {
          low = height
          pad = p
        }
      }
      f.recovery = new Map()
      for (let i = f.start; i < f.end; i++) {
        const p = surface.position.slice(i * 3, i * 3 + 3)
        const h = dot(p, boardNormal) - low,
          delta = minus(p, pad)
        if (h > 0.0021 || Math.hypot(...delta) > 0.012) continue
        const weight = (1 - clamp(h / 0.0021)) ** 2
        const sideways = minus(delta, scale(boardNormal, h))
        const squash = add(scale(boardNormal, 0.00084 * weight), scale(sideways, 0.066 * weight))
        f.recovery.set(i, scale(squash, -1))
        for (let k = 0; k < 3; k++) surface.position[3 * i + k] += squash[k]
      }
    }
  }
  handMaterial.map ??= makeHandInk()
  const mesh = new T.Mesh(surface.geometry(), handMaterial)
  smoothSeams(mesh.geometry)
  mesh.name = (side === 'l' ? '左' : '右') + '手'
  mesh.userData.fitCuff = profile.id === 4 || profile.id === 64 || profile.id === 47
  mesh.userData.gesture = kind
  mesh.userData.digitJoints = targets
  mesh.userData.distalSkin = [...fingers, thumbShape].map((finger) => finger.distalSkin)
  mesh.userData.gripRadius = radius
  if (profile.id === 4 && job === 'drum') drumPressure(mesh, radius, [...fingers, thumbShape])
  if (!moving?.length) return { mesh, wrist }
  const geometry = mesh.geometry,
    initial = geometry.attributes.position.array,
    restNormals = geometry.attributes.normal.array
  geometry.morphTargetsRelative = true
  geometry.morphAttributes.position = []
  geometry.morphAttributes.normal = []
  const digits = ['食指', '中指', '无名指', '小指', '拇指']
  const active = moving.filter((f) =>
    kind === 'pluck'
      ? f.digit < 3 || f.digit === 4
      : welcoming
        ? true
        : kind === 'flute'
          ? f.digit < 3
          : f.digit > 0,
  )
  for (const f of active) {
    const offsets = new Float32Array(initial.length),
      normals = new Float32Array(initial.length)
    f.pivot[0] *= sg
    f.axis[0] *= sg
    f.dir[0] *= sg
    const tip = targets[f.digit][3]
    if (kind === 'pluck') {
      const lift = add(boardNormal, scale(acrossStrings, f.digit === 4 ? -0.3 : 0.12))
      f.axis = unit(cross(minus(tip, f.pivot), lift))
    }
    const [ax, ay, az] = f.axis,
      [px, py, pz] = f.pivot,
      [dx, dy, dz] = f.dir
    const bone = targets[f.digit]
    const extend = Math.sign(dot(f.axis, cross(minus(bone[3], bone[2]), minus(bone[1], bone[0])))) || 1
    const direction = welcoming
      ? extend
      : kind === 'pluck'
        ? 1
        : Math.sign(ax * (tip[1] - py) - ay * (tip[0] - px)) || 1
    const degrees = welcoming
      ? [10, 14, 17, 22][f.digit]
      : kind === 'pluck'
        ? f.digit === 0 || f.digit === 4
          ? 23
          : 4
        : kind === 'flute'
          ? 9
          : 5
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
      const recover = f.recovery?.get(i)
      if (recover) {
        const lift = add(
          add(scale(recover, cs), scale(cross(f.axis, recover), sn)),
          scale(f.axis, dot(f.axis, recover) * q),
        )
        for (let j = 0; j < 3; j++) offsets[k + j] += lift[j]
      }
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
    pos.name = nor.name = mesh.name + digits[f.digit] + (welcoming ? '展指' : '奏指')
    geometry.morphAttributes.position.push(pos)
    geometry.morphAttributes.normal.push(nor)
  }
  mesh.updateMorphTargets()
  if (kind === 'pluck') {
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
      return support
    })
    mesh.userData.pickingPads = { index: pads[0], thumb: pads[1] }
  }
  mesh.userData.movingDigits = active.map((finger) => finger.digit)
  if (reSeat) seatFrettingHand(mesh)
  return { mesh, wrist }
}

// Bind the motion to the finished morph buffers, including hands made in a worker.
export function handMotion(mesh, profile, side, job) {
  if (profile.id === 4 && job === 'drum') return { update: drumHandMotion(mesh, side, profile) }
  const { movingDigits, pickingPads, gesture } = mesh.userData
  if (!movingDigits) return {}
  if (pickingPads) {
    const period = posePeriod(profile, { job: 'lute' })
    const vertex = mesh.geometry.attributes.position
    const index = new T.Vector3().fromBufferAttribute(vertex, pickingPads.index),
      thumb = new T.Vector3().fromBufferAttribute(vertex, pickingPads.thumb)
    return {
      pickingContact(phase, out) {
        return out.copy(index).lerp(thumb, thumbStroke(phase))
      },
      update(state) {
        const phase = ((state.t ?? 0) * tau) / period + (state.phase ?? 0)
        const turn = thumbStroke(phase)
        for (const [i, digit] of movingDigits.entries()) {
          mesh.morphTargetInfluences[i] = digit === 4 ? 1 - turn : digit === 0 ? turn : 0.25 + 0.35 * turn
        }
      },
    }
  }
  if (gesture === 'relaxed')
    return {
      update(state) {
        const gesture = portraitPerformance(profile, state)?.gesture ?? 0
        for (let i = 0; i < movingDigits.length; i++) {
          mesh.morphTargetInfluences[i] = smooth(clamp(gesture * 1.14 - 0.045 * i))
        }
      },
    }
  const fretPeriod = gesture === 'strings' ? posePeriod(profile, { job: 'lute' }) : null
  function update(state) {
    const time = state.t ?? 0
    const beat = fretPeriod
      ? 2 * ((tau * time) / fretPeriod + (state.phase ?? 0))
      : time * 3.7 + (state.phase ?? 0)
    for (let i = 0; i < movingDigits.length; i++)
      mesh.morphTargetInfluences[i] = (0.5 - 0.5 * Math.cos(beat + movingDigits[i] * 1.84)) ** 2
  }
  return { update }
}
