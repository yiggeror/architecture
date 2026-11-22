import * as T from 'three'
import { wristMeridians } from './characterHandWrist.js'
import {
  GarmentMesh,
  turn,
  clip,
  mix,
  step,
  between,
  tint,
  shade,
  linear,
  sample,
  weights,
  addWeights,
} from './characterGarmentMesh.js'
import { finishes, clothUV } from './characterGarmentPaint.js'
import { signatureConfig, sewSignature } from './characterCostumeDesign.js'
import { signatureMaterial } from './characterCostumePaint.js'
import { cutSkirts, collarsAndClosures, collarOpening } from './characterGarmentCut.js'

const bodySections = [
  // Width, front depth, back depth. Tailoring follows the ribcage, lumbar hollow,
  // gluteal shelf and scapula instead of uniformly inflating each cross section.
  [0.69, 0.168, 0.11, 0.118],
  [0.77, 0.174, 0.108, 0.123],
  [0.84, 0.165, 0.107, 0.118],
  [0.9, 0.151, 0.101, 0.104],
  [0.99, 0.133, 0.1, 0.089],
  [1.045, 0.132, 0.103, 0.088],
  [1.1, 0.141, 0.108, 0.095],
  [1.18, 0.158, 0.112, 0.101],
  [1.24, 0.171, 0.118, 0.107],
  [1.295, 0.179, 0.108, 0.106],
  [1.335, 0.185, 0.094, 0.096],
  [1.357, 0.176, 0.08, 0.087],
  [1.374, 0.142, 0.065, 0.073],
  [1.389, 0.101, 0.055, 0.064],
  [1.402, 0.054, 0.048, 0.052],
]
const kinds = {
  duan: { top: 0.916, stop: 0.69, sleeve: 0.008, bolt: 0 },
  beizi: { top: 0.941, stop: 0.36, sleeve: 0.024, bolt: 2 },
  yuanling: { top: 0.936, stop: 0.324, sleeve: 0.019, bolt: 3 },
  aoqun: { top: 0.932, stop: 0.183, sleeve: 0.02, bolt: 5 },
  changshan: { top: 0.941, stop: 0.238, sleeve: 0.003, bolt: 2 },
  banbi: { top: 0.924, stop: 0.47, sleeve: 0.005, bolt: 0 },
}
const paired = [
  ['l', 1],
  ['r', -1],
]
const signedPower = (x, p) => Math.sign(x) * Math.pow(Math.abs(x), p)

function tailoring(profile, rig) {
  const kind = profile.garment ?? 'duan',
    spec = { ...kinds[kind] },
    r = rig.rest
  const signature = signatureConfig(profile)
  if (signature) Object.assign(spec, signature.cut)
  const swatch = { reed: 2, plum: 5, cloud: 3, plain: 0 }[profile.pattern]
  if (swatch !== undefined) spec.bolt = swatch
  const h = r.head[1] / 1.46,
    shoulder = r.lUpperArm[0] / 0.191,
    hip = r.lThigh[0] / 0.095,
    girth = profile.girth ?? 1
  const color = Object.fromEntries(Object.entries(profile.colors).map(([k, v]) => [k, linear(v)]))
  color.skin = linear(profile.skin)
  const art = finishes(),
    line = new GarmentMesh(rig, art.cloth, '裁衣 · 麻布与里衬'),
    satin = new GarmentMesh(rig, art.silk, '裁衣 · 织纹与衣缘'),
    skin = new GarmentMesh(rig, art.skin, '身形 · 颈与手腕'),
    brocade = signature ? new GarmentMesh(rig, signatureMaterial(profile.pattern), signature.name) : null
  const y = (v) =>
    v >= 0.89
      ? mix(r.pelvis[1], r.head[1], (v - 0.89) / 0.57)
      : mix(r.lFoot[1], r.pelvis[1], (v - 0.09) / 0.8)
  function torsoWeight(v, theta = 0) {
    let w =
      v < 1.055
        ? weights('pelvis', 'spine', step(0.878, 1.075, v))
        : weights('spine', 'chest', step(1.045, 1.24, v))
    const lateral = Math.sin(theta),
      clav = step(0.11, 0.95, Math.abs(lateral)) * step(1.235, 1.35, v) * 0.65
    if (clav > 0.001) w = addWeights(w, lateral >= 0 ? 'lClavicle' : 'rClavicle', clav)
    const armpit =
      step(0.81, 0.997, Math.abs(lateral)) * step(1.15, 1.24, v) * (1 - step(1.325, 1.376, v)) * 0.335
    if (armpit) w = addWeights(w, lateral > 0 ? 'lUpperArm' : 'rUpperArm', armpit)
    return w
  }
  function torsoPoint(v, theta, offset = 0) {
    const si = Math.sin(theta),
      co = Math.cos(theta),
      side = Math.abs(si)
    const [w, f, b] = sample(bodySections, v)
    const width = mix(hip, shoulder, step(0.89, 1.26, v))
    const yLocal = y(v),
      x = signedPower(si, 0.925) * w * width
    const fDepth = co >= 0 ? f : b
    const upper = step(1.1, 1.22, v) * (1 - step(1.26, 1.36, v))
    const front = co >= 0
    const axisForm = front
      ? 0.006 * Math.sin(side * Math.PI) * upper
      : 0.008 * Math.sin(side * Math.PI) * upper
    const lumbar = front ? 0 : -0.006 * (1 - side) * step(0.93, 1.07, v) * (1 - step(1.07, 1.19, v))
    const angle = Math.atan2(si, co),
      phase = ((profile.seed ?? 1) % 83) * 0.027
    const underarm = step(0.26, 0.84, side) * (1 - step(0.98, 1, side))
    const line1 = 1.075 + 0.062 * Math.sin(angle - 0.3) + 0.023 * Math.sin(2 * angle + phase)
    const line2 = 1.109 + 0.049 * Math.sin(angle - 0.51)
    const valley = (d, w) => Math.exp(-(d * d) / (w * w))
    const crossing =
      (0.0048 * valley(v - line1, 0.015) -
        0.0031 * valley(v - line1 - 0.021, 0.015) +
        0.0035 * valley(v - line2, 0.018)) *
      underarm
    const blade = co < 0 ? 0.0031 * valley(v - (1.226 + 0.036 * side), 0.017) * Math.sin(side * Math.PI) : 0
    const folds =
      0.0027 *
        Math.sin(5 * theta + 0.7) *
        Math.cos(3 * theta + 0.3) *
        (0.25 + 0.75 * (1 - step(0.91, 1.21, v))) +
      crossing +
      blade
    let waist = 1,
      chest = 0,
      drop = 0
    if (signature) {
      const female = ['silk', 'lute'].includes(signature.key)
      waist -= (female ? 0.087 : 0.034) * valley(v - 1.05, 0.107)
      const pectoral = valley(v - (female ? 1.224 : 1.253), female ? 0.056 : 0.072)
      chest = Math.max(co, 0) * (female ? 0.018 : 0.012) * pectoral * valley(side - 0.52, 0.36)
      chest -= Math.max(co, 0) * 0.0031 * valley(side, 0.17) * valley(v - 1.264, 0.058)
      const tether = 1.085 + 0.09 * si + 0.018 * Math.sin(3 * theta)
      chest +=
        (0.0072 * valley(v - tether, 0.016) - 0.0046 * valley(v - tether - 0.023, 0.014)) *
        step(0.16, 0.76, side) *
        (1 - step(0.94, 1, side))
      drop = -0.0045 * side * side * valley(v - 1.342, 0.027)
    }
    return [
      x * waist + (offset + folds) * si * h,
      yLocal + drop * h,
      signedPower(co, 0.88) * (fDepth * girth + axisForm + lumbar + folds + chest) * h + co * offset * h,
    ]
  }
  const working = ['row', 'carrier', 'porter', 'drum'].includes(profile.job)
  const main = ['aoqun', 'beizi', 'yuanling'].includes(kind) ? satin : line
  return {
    profile,
    rig,
    r,
    h,
    shoulder,
    hip,
    girth,
    kind,
    spec,
    color,
    line,
    satin,
    skin,
    main,
    y,
    torsoWeight,
    torsoPoint,
    working,
    signature,
    brocade,
    armWeights,
    sleeveSection,
    seated: ['lute', 'sit', 'row'].includes(profile.job),
    phase: ((profile.seed ?? 1) % 91) * 0.029,
  }
}

function torsoAndSleeves(a) {
  const { spec, kind, color, main, h, torsoPoint, torsoWeight, phase } = a
  const ys = [
    spec.top,
    spec.top + 0.011,
    ...[...bodySections.map((s) => s[0]), 1.009, 1.025, 1.065, 1.082, 1.123, 1.144, 1.165]
      .filter((v) => v > spec.top + 0.025 && v < 1.18)
      .sort((x, y) => x - y),
    1.18,
    1.24,
    1.295,
    1.319,
    1.335,
    1.348,
    1.357,
    1.366,
    1.374,
    1.382,
    1.389,
    1.397,
    1.402,
  ]
  const n = 40,
    lo = ys.indexOf(1.18),
    hi = ys.indexOf(1.357),
    sector = 3,
    grid = []
  for (let i = 0; i < ys.length; i++) {
    const level = ys[i],
      row = []
    for (let j = 0; j < n; j++) {
      const theta = (j / n) * turn,
        s = Math.sin(theta),
        side = Math.abs(s)
      const axis = Math.acos(Math.min(1, side))
      const seam = step(0, 0.472, axis) * (1 - step(0.472, 0.79, axis))
      const rounding =
        seam *
        (0.035 * Math.exp(-(((level - 1.18) / 0.048) ** 2)) -
          0.018 * Math.exp(-(((level - 1.357) / 0.029) ** 2)))
      const y =
        (level <= 1.357 ? level : mix(1.357, collarOpening(kind, theta), (level - 1.357) / 0.045)) +
        rounding
      let base = color.outer
      if (kind === 'beizi' || kind === 'banbi') {
        const centre = Math.atan2(Math.sin(theta), Math.cos(theta))
        const opening = kind === 'beizi' ? 0.375 : mix(0.04, 0.37, step(1.03, 1.32, y))
        if (Math.abs(centre) < opening) base = color.inner
        else if (Math.abs(centre) < opening + 0.13) base = tint(color.outer, color.binding, 0.49)
      }
      if ((kind === 'duan' || kind === 'aoqun') && y > 1.216) {
        const a0 = Math.atan2(s, Math.cos(theta))
        const half = sample(
          [
            [1.216, 0.028],
            [1.276, 0.292],
            [1.332, 0.596],
            [1.373, 1.235],
            [1.402, 2.2],
          ],
          y
        )[0]
        if (Math.abs(a0) < half) base = tint(color.inner, color.outer, kind === 'duan' ? 0.57 : 0.24)
      }
      if (kind === 'aoqun' && y < 0.938) base = tint(color.outer, color.sash, 0.25)
      if (a.signature) base = a.signature.body(color, theta, y)
      const edge = i === 0 ? 0.83 : 1
      const rr = torsoPoint(y, theta)
      const w = torsoWeight(y, theta)
      const value =
        (1 - 0.045 * side + 0.017 * Math.cos(theta * 4 + phase) * (1 - step(0.86, 1.2, y))) * edge
      row.push(
        main.v(
          rr,
          w,
          shade(base, value),
          clothUV(spec.bolt, (j / n) * 6, ((y - spec.top) / (1.405 - spec.top)) * 0.92 + 0.02)
        )
      )
    }
    if (i > 0)
      for (let j = 0; j < n; j++) {
        const inHole =
          i - 1 >= lo &&
          i - 1 < hi &&
          ((j >= n / 4 - sector && j < n / 4 + sector) ||
            (j >= (3 * n) / 4 - sector && j < (3 * n) / 4 + sector))
        if (!inHole) main.quad(grid[i - 1][j], grid[i - 1][(j + 1) % n], row[(j + 1) % n], row[j])
      }
    grid.push(row)
  }
  const rim = []
  for (let k = 0; k >= -sector; k--) rim.push([k, hi])
  for (let i = hi - 1; i >= lo; i--) rim.push([-sector, i])
  for (let k = 1 - sector; k <= sector; k++) rim.push([k, lo])
  for (let i = lo + 1; i <= hi; i++) rim.push([sector, i])
  for (let k = sector - 1; k > 0; k--) rim.push([k, hi])
  const mid = (ys[lo] + ys[hi]) / 2,
    half = (ys[hi] - ys[lo]) / 2
  for (const [side, sign] of paired) {
    const center = n * (sign > 0 ? 0.25 : 0.75)
    const ids = rim.map(([j, i]) => grid[i][center + sign * j])
    const angles = rim.map(([j, i]) => (turn + Math.atan2(-j / sector, (ys[i] - mid) / half)) % turn)
    if (a.signature) {
      a.armholes ??= {}
      a.armholes[side] = angles
        .map((angle, i) => {
          const id = ids[i],
            p = main.positions.slice(id * 3, id * 3 + 3),
            w = {}
          for (let j = 0; j < 4; j++) {
            const weight = main.weights[id * 4 + j]
            if (weight) w[a.rig.skeleton.bones[main.joints[id * 4 + j]].name] = weight
          }
          return { angle, p, w }
        })
        .sort((l, r) => l.angle - r.angle)
    }
    makeSleeve(a, side, sign, angles, ids)
  }
}
const sleeveRadius = [
  [0.06, 0.022, 0.044],
  [0.12, 0.037, 0.051],
  [0.18, 0.043, 0.056],
  [0.245, 0.048, 0.061],
  [0.39, 0.053, 0.061],
  [0.58, 0.053, 0.058],
  [0.74, 0.048, 0.053],
  [0.89, 0.044, 0.046],
  [1, 0.041, 0.044],
  [1.105, 0.045, 0.049],
  [1.25, 0.048, 0.052],
  [1.43, 0.045, 0.047],
  [1.65, 0.035, 0.04],
  [1.84, 0.029, 0.034],
  [2, 0.026, 0.029],
]
function armWeights(side, t, skin = false) {
  if (t < 0.29) return weights(side + 'Clavicle', side + 'UpperArm', mix(0.58, 1, step(0.04, 0.29, t)))
  if (t < 1.27) return weights(side + 'UpperArm', side + 'Forearm', step(0.78, 1.23, t))
  return weights(
    side + 'Forearm',
    side + 'Hand',
    skin ? step(1.76, 2.022, t) * 0.996 : step(1.84, 2.09, t) * 0.48
  )
}
function sleeveSection(a, side, sign, t, phi, ease, radial = 0, exposed = false) {
  const { h, r, kind, phase } = a
  const upper = r[side + 'UpperArm'],
    elbow = r[side + 'Forearm'],
    wrist = r[side + 'Hand']
  const c = Math.cos(phi),
    s = Math.sin(phi)
  const armT = t + Math.max(0, 1 - t / 0.82) * 0.635 * (0.5 - 0.5 * c)
  const top = armT <= 1 ? upper : elbow,
    bottom = armT <= 1 ? elbow : wrist
  const center = between(top, bottom, armT <= 1 ? armT : armT - 1)
  const local = sample(sleeveRadius, t)
  const fitted = a.signature && !exposed
  const commission = a.signature?.key
  const bell = (d, width) => Math.exp(-(d * d) / (width * width))
  const shoulderVolume = 0.0015 * (1 - step(0.12, 0.43, t)) * (0.5 + 0.5 * c)
  const amplitude = exposed ? 0 : 0.0023 + 0.085 * ease
  const drape =
    amplitude * (0.64 * Math.sin(phi * 5 + phase + 0.36 * t) + 0.38 * Math.cos(phi * 3 - 1.7 * t))
  let extra = ease * mix(0.46, 1, step(0.22, 1.68, t))
  if (kind === 'beizi' || kind === 'aoqun' || kind === 'yuanling')
    extra += ease * 0.52 * step(1.29, 1.95, t)
  const bunch = exposed
    ? 0
    : 0.0027 *
      Math.cos(30 * t + 2.2 * Math.sin(phi)) *
      (step(0.64, 0.88, t) * (1 - step(1.23, 1.66, t)) + 0.8 * step(1.63, 1.91, t))
  const dim = Math.pow(a.girth, 0.23)
  let lateral = (local[0] * dim + extra + shoulderVolume + drape + bunch + radial) * h
  let deep = (local[1] * dim + extra + drape + bunch + radial) * h
  let dragX = 0,
    dragY = 0,
    dragZ = 0
  if (fitted) {
    const female = commission === 'silk' || commission === 'lute'
    const limb = step(0.07, 0.56, t)
    // The inner elbow catches three short, converging folds. Across the
    // triceps the same cloth stretches smooth. The forearm twists away from
    // these tucks towards the gathering stitch at the wrist.
    const trough = 0.93 + 0.105 * Math.cos(phi + 0.42 * sign) - 0.043 * Math.sin(2 * phi)
    const insideBend = 0.27 + 0.73 * step(-0.85, 0.66, s)
    const radius =
      ((0.012 * bell(t - trough, 0.049) -
        0.007 * bell(t - trough + 0.068, 0.037) +
        0.008 * bell(t - trough - 0.135, 0.046) -
        0.005 * bell(t - trough - 0.189, 0.043)) *
        insideBend +
        0.005 * bell(t - 1.49 - 0.11 * Math.cos(phi), 0.058) +
        0.0038 * Math.sin(4 * phi + 1.32 * t) * step(0.35, 0.79, t)) *
      h
    const reduce = female ? 0.72 : commission === 'drummer' ? 0.82 : 0.86
    lateral =
      (local[0] * dim * (1 - (1 - reduce) * limb) + extra * 0.55 + shoulderVolume + drape + radial) * h +
      radius
    deep = (local[1] * dim * (1 - (1 - reduce) * limb) + extra * 0.53 + drape + radial) * h + radius * 0.85
    const gathered = Math.sin(
      Math.PI * step(0.32, commission === 'lute' ? (side === 'l' ? 1.62 : 1.8) : 1.96, t)
    )
    const bias = 0.49 + 0.51 * Math.cos(phi - (sign > 0 ? -0.9 : -1.6) + t * 0.79)
    // Gravity in the bind frame of the posed forearm; the player pulls the
    // left sleeve back from her fretting hand. The loose silk accumulates at
    // the crook and hangs mostly under the opposite, horizontal forearm.
    if (commission === 'lute') {
      dragZ = -h * (0.009 + (side === 'r' ? 0.023 : 0.029) * bias) * gathered
      dragY = h * (side === 'l' ? 0.026 : -0.012) * gathered * (0.35 + 0.65 * bias)
      dragX = -sign * 0.007 * h * gathered
    } else {
      dragZ =
        -h *
        0.017 *
        bias *
        gathered *
        ((commission === 'silk' && side === 'l') || (commission === 'scholar' && side === 'r') ? 1 : 0.23)
      dragY = -h * (commission === 'silk' ? 0.023 : 0.013) * gathered * (0.25 + 0.75 * bias)
    }
  }
  const join = exposed ? step(1.87, 2.045, t) : 0
  const wristSide = mix(lateral, 0.0149 * h, join)
  deep = mix(deep, 0.0203 * h, join)
  const slopeX = -(bottom[0] - top[0]) / (bottom[1] - top[1])
  const slopeZ = -(bottom[2] - top[2]) / (bottom[1] - top[1])
  const under = exposed ? 0 : Math.max(-c, 0) * ease * 0.57
  const inside = step(0.13, 0.94, -c) * (1 - step(0.38, 0.76, t))
  const insideEdge = sign * a.shoulder * (0.168 + 0.016 * Math.min(1, t / 0.76))
  return [
    mix(center[0] + sign * c * wristSide + dragX, insideEdge, inside),
    center[1] + sign * c * wristSide * slopeX + s * deep * slopeZ - under * h + dragY,
    center[2] + s * deep + dragZ,
  ]
}
function makeSleeve(a, side, sign, angles, rim) {
  const { main, spec, working, kind, color } = a,
    flip = sign < 0
  const short = kind === 'banbi',
    rolled = kind === 'duan' && working
  const job = a.profile.job
  // The fretting hand turns back over the pegbox. Its sleeve is caught with a
  // narrow wrist band so all five fingertips remain free at this acute angle.
  const handEnd =
    job === 'lute'
      ? side === 'l'
        ? 1.63
        : 1.8
      : job === 'row'
        ? 1.54
        : job === 'flute'
          ? 1.8
          : job === 'drum'
            ? 1.82
            : job === 'umbrella' && side === 'l'
              ? 1.86
              : 1.955
  const playing = handEnd < 1.9
  function sew(mesh, prev, ts, dye, ease, bolt, lastRing = true, exposed = false) {
    for (const t of ts) {
      const arr = angles.map((phi) => {
        const yarn = !exposed && a.signature && t < 0.66 ? a.signature.sleeve(color, t, phi) : dye
        const c = exposed
          ? shade(yarn, 1 - 0.07 * Math.max(0, -Math.cos(phi)))
          : shade(yarn, 0.978 + 0.022 * Math.cos(phi * 3 - 1.8 * t))
        const uv = exposed
          ? [phi / turn + 0.5, t / 2]
          : clothUV(bolt, (phi / turn) * 3 + 0.83, clip((t / 2) * 0.96, 0.015, 0.97))
        return mesh.v(
          sleeveSection(a, side, sign, t, phi, ease, 0, exposed),
          armWeights(side, t, exposed),
          c,
          uv
        )
      })
      if (prev) mesh.strip(prev, arr, flip)
      prev = arr
    }
    if (lastRing) {
      const t = ts.at(-1)
      const lining = angles.map((phi) =>
        mesh.v(
          sleeveSection(a, side, sign, t - 0.009, phi, ease, -0.005),
          armWeights(side, t),
          shade(dye, 0.61),
          clothUV(1, phi / turn, 0.11)
        )
      )
      mesh.strip(prev, lining, flip)
      if (!exposed) {
        let last = lining
        for (const back of [0.052, 0.118, 0.182]) {
          const yy = t - back,
            narrow = mix(ease - 0.005, -0.001, step(0, 0.182, back))
          const returnFold = angles.map((phi) =>
            mesh.v(
              sleeveSection(a, side, sign, yy, phi, narrow, -0.001),
              armWeights(side, yy),
              shade(tint(dye, color.inner, 0.17), 0.65 + (0.065 * back) / 0.182),
              clothUV(1, (phi / turn) * 1.9, 0.15 + back * 2.7)
            )
          )
          mesh.strip(last, returnFold, !flip)
          last = returnFold
        }
      }
    }
    return prev
  }
  const first = [0.062, 0.12, 0.18, 0.235, 0.31, 0.39, 0.52, 0.65]
  const bodyEnd = short ? 0.76 : rolled ? 1.48 : handEnd
  let stations = first.concat(
    [0.72, 0.79, 0.9, 1, 1.1, 1.25, 1.42, 1.54, 1.67, 1.82].filter((t) => t < bodyEnd - 0.105)
  )
  if (a.signature) {
    const extraRows = [
      0.47, 0.61, 0.82, 0.856, 0.935, 0.966, 1.034, 1.065, 1.143, 1.183, 1.31, 1.37, 1.48, 1.585, 1.735,
    ]
    stations = [...stations, ...extraRows.filter((t) => t < bodyEnd - 0.09)].sort((l, r) => l - r)
  }
  const cuffWidth = short ? 0.079 : rolled ? 0.19 : 0.103
  stations = stations.filter((t) => t < bodyEnd - cuffWidth)
  stations.push(bodyEnd - cuffWidth, bodyEnd - cuffWidth + 0.012)
  const ease = spec.sleeve + (short ? 0.017 : 0)
  const sleeveDye = a.signature ? a.signature.sleeve(color) : color.outer
  const prev = sew(main, rim, stations, sleeveDye, ease, spec.bolt, false)
  const cuffDye = short
    ? tint(color.binding, color.outer, 0.33)
    : rolled
      ? tint(color.outer, color.inner, 0.35)
      : tint(color.binding, color.outer, 0.36)
  sew(
    main,
    prev,
    [bodyEnd - cuffWidth + 0.025, bodyEnd - 0.016, bodyEnd],
    cuffDye,
    playing && !short ? ease * 0.43 : ease + 0.002,
    4
  )
  if (short) {
    const inner = [0.67, 0.75, 0.88, 1, 1.1, 1.27, 1.44, 1.62, 1.77, 1.88].filter(
      (t) => t < handEnd - 0.065
    )
    sew(
      a.line,
      null,
      [...inner, handEnd - 0.061, handEnd - 0.018, handEnd],
      tint(color.inner, color.outer, 0.09),
      0.005,
      1
    )
  }
  const start = (rolled ? bodyEnd : handEnd) - 0.145
  const hand = a.r[side + 'Hand'], elbow = a.r[side + 'Forearm']
  const length = Math.hypot(...hand.map((x, k) => x - elbow[k]))
  const rows = (a.forearms ??= {})[side] = []
  let previous
  const forearmStations = job === 'row' ? [1.58, 1.69, 1.76, 1.81, 1.86, 1.9] : [1.56, 1.69, 1.76, 1.82, 1.865, 1.902]
  for (const t of [start, ...forearmStations.filter((v) => v > start + 0.004), 1.935]) {
    const blend = step(job === 'row' ? 1.76 : 1.51, 1.935, t)
    const row = wristMeridians.map((phi) => {
      const h = a.h
      let p = sleeveSection(a, side, sign, t, phi, -0.003, 0, true)
      let rigid = 0.963 * step(1.48, 1.85, t) + 0.037 * step(1.913, 1.935, t)
      if (job === 'row') {
        // The oarsman's wrist veers behind the shaft while the upper part of
        // the bare forearm follows his elbow during the recovery stroke.
        const along = ((2.018 - t) * length) / h,
          flare = step(2.005, 1.69, t),
          wrist = [
            hand[0] + sign * h * (0.002 + (0.0139 + 0.011 * flare) * Math.cos(phi)),
            hand[1] + h * along,
            hand[2] + h * (-0.0135 - 0.5 * Math.max(0, along) + (0.0115 + 0.014 * flare) * Math.sin(phi)),
          ]
        p = between(p, wrist, step(1.52, 1.74, t))
        rigid = 0.963 * step(1.54, 1.755, t) + 0.037 * step(1.913, 1.935, t)
      }
      // A separate clothing study also ends in a physical wrist-sized ring.
      // The assembled hand fits these last stations to its own exact skin.
      const boundary = [hand[0] + sign * h * .017 * Math.cos(phi), hand[1] + .021 * h,
        hand[2] + h * (-.003 + .022 * Math.sin(phi))]
      p = between(p, boundary, step(1.89, 1.935, t))
      const pigment = shade(color.skin, 1 - 0.07 * Math.max(0, -Math.cos(phi)))
      return a.skin.v(p, weights(side + 'Forearm', side + 'Hand', rigid), pigment, [phi / turn + 0.5, t * 0.5])
    })
    if (previous) a.skin.strip(previous, row, flip)
    rows.push({ indices: row, blend, ahead: (1.935 - t) * length })
    previous = row
  }

}
const legRadius = [
  [0.12, 0.091, 0.099],
  [0.25, 0.091, 0.099],
  [0.39, 0.086, 0.091],
  [0.57, 0.072, 0.08],
  [0.75, 0.062, 0.069],
  [0.91, 0.054, 0.063],
  [1, 0.053, 0.057],
  [1.12, 0.052, 0.061],
  [1.28, 0.061, 0.071],
  [1.43, 0.059, 0.067],
  [1.61, 0.05, 0.055],
  [1.81, 0.035, 0.043],
  [2, 0.029, 0.034],
]
function trouserLegs(a) {
  const pants = ['duan', 'banbi', 'beizi'].includes(a.kind)
  const underLongRobe = ['aoqun', 'yuanling', 'changshan', 'beizi'].includes(a.kind)
  const { r, color, h, line } = a,
    n = 22
  for (const [side, sign] of paired) {
    const thigh = r[side + 'Thigh'],
      knee = r[side + 'Shin'],
      foot = r[side + 'Foot']
    const positions = [
      0.14, 0.245, 0.39, 0.55, 0.74, 0.87, 1, 1.12, 1.29, 1.43, 1.61, 1.74, 1.81, 1.87, 1.92, 1.965, 2.012,
    ]
    let prev
    const hiprow = []
    for (let i = 0; i < n; i++) {
      const ph = (i / n) * turn,
        c = Math.cos(ph),
        s = Math.sin(ph),
        outer = Math.max(c, 0),
        inner = Math.max(-c, 0)
      const y = 0.923 - 0.168 * inner ** 1.32
      const p = [sign * 0.121 * a.hip * outer, a.y(y), s * (s < 0 ? 0.091 : 0.084) * h]
      const joint = weights('pelvis', side + 'Thigh', 0.04 + 0.14 * inner)
      hiprow.push(line.v(p, joint, shade(color.lower, 0.96), clothUV(0, (i / n) * 2, 0.96)))
    }
    prev = hiprow
    for (const t of positions) {
      const cent = t <= 1 ? between(thigh, knee, t) : between(knee, foot, t - 1),
        rr = sample(legRadius, t)
      const tallBoot = a.profile.job === 'watch' || (a.kind === 'yuanling' && a.profile.job !== 'row')
      const w =
        t < 0.38
          ? weights('pelvis', side + 'Thigh', step(-0.04, 0.4, t))
          : t < 1.27
            ? weights(side + 'Thigh', side + 'Shin', step(0.75, 1.24, t))
            : weights(side + 'Shin', side + 'Foot', step(tallBoot ? 1.66 : 1.77, 1.995, t) * 0.83)
      const row = []
      for (let i = 0; i < n; i++) {
        const ph = (i / n) * turn,
          c = Math.cos(ph),
          s = Math.sin(ph)
        const gather =
          (0.0058 * Math.cos(ph * 7 + 0.9 * t) + 0.003 * Math.sin(3 * ph - t)) * (1 - step(1.8, 1.95, t))
        const ease = (pants ? 0.01 : 0.002) * (1 - step(1.54, 1.9, t))
        const wrap = t > 1.72 && a.working ? 0.0025 * Math.sin(55 * t + ph * 0.35) : 0
        const ceasing =
          0.004 *
          Math.cos(25 * t + ph * 1.4) *
          (step(0.65, 0.86, t) * (1 - step(1.14, 1.4, t)) + 0.72 * step(1.58, 1.78, t))
        const splay = t < 0.5 && c < 0 ? 1 - 0.14 * -c : 1
        const rad = (rr[0] * Math.pow(a.girth, 0.45) + ease + gather + wrap + ceasing) * splay
        const frontKnee = 0.009 * s * Math.max(0, s) * Math.exp(-Math.pow((t - 0.97) / 0.14, 2))
        const calfRear = (s < 0 ? 0.007 : 0) * Math.exp(-Math.pow((t - 1.33) / 0.2, 2))
        const p = [
          cent[0] + sign * c * rad * h,
          cent[1] + 0.003 * h * Math.cos(ph * 2) * step(0.58, 0.95, t),
          cent[2] +
            s * (rr[1] * Math.pow(a.girth, 0.38) + ease + gather + ceasing + calfRear + frontKnee) * h,
        ]
        if (underLongRobe && t < 1.46) {
          const ease = mix(a.seated ? 0.71 : 0.85, 1, step(0.88, 1.46, t))
          p[0] = mix(cent[0], p[0], ease)
          p[2] = mix(cent[2], p[2], ease)
        }
        // Risen work jackets still cover the fork. Fit the seat under their
        // measured circumference, then return to the loose cut below the hem.
        if (t < 0.58) {
          const yy = p[1] / h,
            fade = 1 - step(0.4, 0.58, t)
          const wx = mix(0.158, 0.118, step(0.72, 0.93, yy)) * a.hip
          const dz = mix(0.109, 0.085, step(0.72, 0.93, yy)) * h * Math.pow(a.girth, 0.5)
          const len = Math.hypot(p[0] / wx, p[2] / dz)
          if (len > 1) {
            const adj = mix(1, 1 / len, fade)
            p[0] *= adj
            p[2] *= adj
          }
        }
        const cuffY = tallBoot ? 0.209 : 0.166,
          yNorm = cent[1] / h
        const tucked = 1 - step(cuffY + 0.004, cuffY + 0.049, yNorm)
        if (tucked > 0) {
          const dz = foot[2] - 0.002 * h,
            rw = tallBoot ? 0.0265 : 0.024
          p[0] = mix(p[0], foot[0] + c * sign * rw * h, tucked)
          p[2] = mix(p[2], dz + s * (rw + 0.001) * h, tucked)
        }
        const dye = t > 1.745 && a.working ? tint(color.binding, color.inner, 0.18) : color.lower
        row.push(
          line.v(
            p,
            w,
            shade(dye, 0.96 + 0.04 * Math.cos(ph * 4 + 0.5 * t)),
            clothUV(0, (i / n) * 2, clip(1 - t * 0.47, 0.015, 0.97))
          )
        )
      }
      line.strip(prev, row, sign < 0)
      prev = row
    }
  }
}
function throat(a) {
  const { skin, r, h, color, profile } = a
  const cut = a.kind,
    rows = 48
  // Circumference, posterior depth and laryngeal projection are fitted to
  // the sitter. The nape climbs towards the occiput behind the mandibular angle.
  const fit = {
    silk:[.976,1.07,.0012], lute:[.935,1.045,.0010], market:[.991,1.08,.0011],
    scholar:[1.115,1.21,.0038], drummer:[1.22,1.27,.0033], boatman:[1.19,1.28,.0044],
  }[profile.faceFamily] ?? [1.025,1.12,.0019]
  const width = fit[0] * (1 + .19 * ((profile.shoulders ?? 1) - 1))
  const nape = fit[1], ridge = fit[2]
  const bell = (p, centre, radius) => Math.exp(-(((p - centre) / radius) ** 2))
  function section(y, theta, w, d, z) {
    const c = Math.cos(theta),
      s = Math.sin(theta),
      rear = Math.max(0, -c)
    const angle = Math.acos(c)
    const height = step(1.369, 1.525, y)
    const mastoid = 0.0062 * bell(angle, 0.39 + height * 1.69, 0.22) * Math.sin(Math.PI * height)
    const root = 0.0078 * bell(y, 1.413, 0.019) * (0.24 + 0.76 * rear)
    const occiput = 0.005 * bell(y, 1.494, 0.024) * rear
    const nuchal = 0.0041 * bell(y, 1.438, 0.038) * rear * bell(Math.abs(s), 0.34, 0.24)
    const airway = ridge * bell(y, 1.438, 0.013) * Math.max(c, 0) ** 8
    const underEar = rear * (1 + 0.3 * Math.abs(s)) * step(1.423, 1.495, y)
    // Taper the back midline into the underside of the occiput. The heads
    // are sculpted up from the mandible, so a circular high neck would pierce
    // both the posterior skull and the separate tapered hairs at this level.
    const tuck = (0.017 + 0.032 * (nape - 1)) * bell(y, 1.502, 0.036) * rear ** 1.5 * (0.74 + 0.26 * rear)
    return [
      s * (w * width + mastoid + root + occiput) * h,
      y > 1.46 ? r.head[1] + (y - 1.46) * h : a.y(y),
      h *
        (z + c * (d * (1 + (nape - 1) * rear) + mastoid + root + airway + nuchal + 0.009 * underEar - tuck)),
    ]
  }
  let prev
  // The shoulder opening and the underside of the jaw are opposite edges of
  // one surface. An uninterrupted normal field follows the sternomastoids
  // through the notch of the clavicle; the top ends inside the actual mandible.
  for (const v of [0, 0.14, 0.3, 0.48, 0.68, 0.85, 1]) {
    const row = []
    for (let i = 0; i < rows; i++) {
      const th = (i / rows) * turn,
        lo = collarOpening(cut, th) - 0.0008,
        yy = mix(lo, 1.424, v),
        c = Math.cos(th),
        si = Math.sin(th)
      const end = section(yy, th, .044, .042, -.0015)
      const start = a.torsoPoint(lo, th, 0.001)
      const toward = 1 - (1 - v) ** (1.22 + 0.48 * Math.max(c, 0))
      const clavicle = .0023 * bell(v, .31, .13) * Math.max(c, 0) * Math.abs(si)
      const p = [mix(start[0], end[0], toward), a.y(yy) + h * clavicle, mix(start[2], end[2], toward)]
      const w = addWeights(a.torsoWeight(lo, th), 'neck', 0.94 * step(0, 1, v))
      row.push(
        skin.v(p, w, shade(color.skin, 0.986 - 0.012 * (1 - v) * Math.max(c, 0)), [i / rows, v * 0.39])
      )
    }
    if (prev) skin.strip(prev, row)
    prev = row
  }
  const upper = [
    [1.437, 0.043, 0.041, -0.001],
    [1.45, 0.0425, 0.0405, -0.002],
    [1.461, 0.043, 0.04, -0.0035],
    [1.476, 0.0455, 0.0415, -0.006],
    [1.49, 0.047, 0.043, -0.012],
    [1.507, 0.045, 0.041, -0.017],
    [1.525, 0.036, 0.032, -0.017],
    [1.541, 0.027, 0.024, -0.015],
  ]
  for (const [y, w, d, z] of upper) {
    const row = []
    for (let i = 0; i < rows; i++) {
      const th = (i / rows) * turn, c = Math.cos(th)
      const p = section(y, th, w, d, z)
      const wgt = weights('neck', 'head', step(1.43, 1.5, y))
      row.push(
        skin.v(p, wgt, shade(color.skin, 0.986 - 0.03 * Math.max(c, 0) * step(1.44, 1.474, y)), [
          i / rows,
          0.44 + (y - 1.437) * 4,
        ])
      )
    }
    skin.strip(prev, row)
    prev = row
  }
}
export function buildClothing(profile, rig) {
  const a = tailoring(profile, rig)
  trouserLegs(a)
  torsoAndSleeves(a)
  const neckStart=a.skin.positions.length/3
  throat(a)
  if (a.signature) sewSignature(a,neckStart)
  else {
    cutSkirts(a)
    collarsAndClosures(a)
  }
  const group = new T.Group()
  group.name = '身形与衣装 · ' + a.kind
  for (const b of [a.line, a.satin, a.brocade, a.skin]) {
    if (!b) continue
    const mesh = b.finish()
    if (mesh) {
      group.add(mesh)
      if (b === a.skin) rig.forearmSkin = { mesh, rowing: profile.job === 'row', ...a.forearms }
    }
  }
  group.userData.garment = a.kind
  if (a.signature) group.userData.costume = a.signature.key
  return group
}
