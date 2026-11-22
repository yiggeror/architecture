import * as T from 'three'
import { handGrip, solePoints } from './humanRig.js'

const tau = 2 * Math.PI
const sides = ['l', 'r']
const up = new T.Vector3(0, 1, 0)
const gripOffset = new T.Vector3(...handGrip)
const stancePart = 0.615
// Longitudinal samples include the heel pad, arch, forefoot and toe rocker.
// Width is the half-width of the physical sole at that station.
const soleStations = [
  [-0.097, 0.009],
  [-0.075, 0.03],
  [-0.053, 0.032],
  [-0.027, 0.033],
  [0, 0.034],
  [0.027, 0.036],
  [0.053, 0.04],
  [0.079, 0.045],
  [0.104, 0.048],
  [0.123, 0.049],
  [0.147, 0.047],
  [0.17, 0.041],
  [0.192, 0.025],
  [0.205, 0.008],
]
// The raised braid beside a slab can also bear against the rounded welt,
// outside the flat bottom. The outer lanes follow its first three layers.
const soleLanes = [
  -1.15, -1.145, -1.14, -1.135, -1.1, -1.045, -0.995, -0.74, -0.49, -0.25, 0, 0.25, 0.49, 0.74, 0.995, 1.045,
  1.1, 1.135, 1.14, 1.145, 1.15,
]
const soleStep = 0.0025
const soleStart = -0.098
const soleEnd = 0.207
const soleSamples = Math.round((soleEnd - soleStart) / soleStep) + 1
const clamp = T.MathUtils.clamp
const smooth = (x) => ((x = clamp(x, 0, 1)), x * x * x * (10 + x * (-15 + 6 * x)))
const angleBetween = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a))
const framesByRig = new WeakMap()

export function posePeriod(profile = {}, state = {}) {
  if (state.walking ?? state.job === 'walk') {
    const length = (profile.height ?? 1) * (profile.legLength ?? 1)
    return 1.22 * Math.sqrt(length) * (1 + 0.027 * Math.sin((profile.seed ?? 0) % 113))
  }
  switch (state.job) {
    case 'row':
      return tau / 1.73
    case 'drum':
      return 1.84
    case 'lute':
      return 3.6
    case 'flute':
      return 4.8
    case 'porter':
      return 4.4
    case 'sit':
      return 5.2
    default:
      return 4.7 + 0.28 * Math.sin((profile.seed ?? 0) % 67)
  }
}

function extremity() {
  return {
    target: new T.Vector3(),
    rotation: new T.Quaternion(),
    toeRotation: new T.Quaternion(),
    contact: new T.Vector3(),
    actual: new T.Vector3(),
    heel: new T.Vector3(),
    ball: new T.Vector3(),
    tip: new T.Vector3(),
    residual: 0,
  }
}
function context(rig) {
  if (framesByRig.has(rig)) return framesByRig.get(rig)
  const frames = {},
    joints = {},
    orientations = {}
  for (const [name, bone] of Object.entries(rig.bones)) {
    const p = new T.Vector3(),
      q = new T.Quaternion()
    frames[name] = { bone, p, q, parent: frames[bone.parent?.name], rest: bone.position.clone() }
    joints[name] = p
    orientations[name] = q
  }
  const limbs = { l: {}, r: {} }
  for (const side of sides)
    for (const [part, first, second, end] of [
      ['leg', 'Thigh', 'Shin', 'Foot'],
      ['arm', 'UpperArm', 'Forearm', 'Hand'],
    ]) {
      const a = frames[side + first],
        b = frames[side + second],
        tip = frames[side + end]
      limbs[side][part] = {
        a,
        b,
        tip,
        first: b.rest.length(),
        second: tip.rest.length(),
        aDir: b.rest.clone().normalize(),
        bDir: tip.rest.clone().normalize(),
      }
    }
  const feet = { l: extremity(), r: extremity() },
    hands = { l: extremity(), r: extremity() }
  for (const foot of Object.values(feet)) foot.patches = []
  const c = {
    rig,
    frames,
    limbs,
    feet,
    hands,
    route: {},
    route1: {},
    route2: {},
    a: new T.Vector3(),
    b: new T.Vector3(),
    v: new T.Vector3(),
    w: new T.Vector3(),
    pole: new T.Vector3(),
    normal: new T.Vector3(),
    bend: new T.Vector3(),
    end: new T.Vector3(),
    inv: new T.Quaternion(),
    q: new T.Quaternion(),
    delta: new T.Quaternion(),
    euler: new T.Euler(0, 0, 0, 'YXZ'),
    basis: new T.Matrix4(),
    audit: { joints, orientations, feet, hands },
  }
  framesByRig.set(rig, c)
  return c
}

// Keep transforms in actor metres even when its render group rides a tilted,
// scaled ship. Only the renderer needs to walk the attached portrait and cloth.
function forward(node) {
  const p = node.parent
  if (p) {
    node.p.copy(node.bone.position).applyQuaternion(p.q).add(p.p)
    node.q.multiplyQuaternions(p.q, node.bone.quaternion)
  } else {
    node.p.copy(node.bone.position)
    node.q.copy(node.bone.quaternion)
  }
}
function rotate(c, name, x, y, z) {
  const f = c.frames[name]
  f.bone.quaternion.setFromEuler(c.euler.set(x, y, z))
  forward(f)
}
function orient(c, node, actorQ) {
  node.bone.quaternion.copy(node.parent.q).invert().multiply(actorQ).normalize()
  forward(node)
}
function vector(v, out) {
  return v.isVector3 ? out.copy(v) : out.fromArray(v)
}
function readRoute(state, time, out) {
  if (state.routeAt) {
    out.y = 0
    const at = state.routeAt(time, out)
    if (at && at !== out) Object.assign(out, at)
  } else if (state.groundAt && !(state.walking ?? state.job === 'walk')) {
    const e = state.base?.elements
    out.x = e ? e[12] : (state.actor?.x ?? 0)
    out.y = e ? e[13] : (state.actor?.y ?? 0)
    out.z = e ? e[14] : (state.actor?.z ?? 0)
    out.yaw = e ? Math.atan2(e[8], e[10]) : (state.actor?.yaw ?? 0)
  } else {
    out.x = 0
    out.z = (state.speed ?? 0.78) * time
    out.yaw = 0
    out.y = 0
  }
  return out
}

function footprint(c, state, time, width, out) {
  const at = readRoute(state, time, c.route1),
    now = c.route
  const x = (at.x - now.x) / c.scale + width * Math.cos(at.yaw)
  const z = (at.z - now.z) / c.scale - width * Math.sin(at.yaw)
  out.set(x * c.cos - z * c.sin, ((at.y ?? 0) - (now.y ?? 0)) / c.scale, x * c.sin + z * c.cos)
  return at.yaw - now.yaw
}

// Rigs sampled before their shoes are built still have a sign-correct rocker.
function basicSole(z, lane, width, side, out) {
  const bevel = Math.max(0, (-0.075 - z) * 0.242) + 0.0067 * smooth((z - 0.192) / 0.016)
  const arch = Math.max(
    0,
    0.0041 * (1 - 0.23 * Math.sign(lane) * side) * Math.exp(-((z - 0.013) ** 2) / 0.00091) - 0.00062,
  )
  const welt = Math.max(0, Math.abs(lane) - 1) * 0.019
  return out.set(lane * width, bevel + arch + welt, z)
}
// A foot's material does not change during its roll. Sample its actual skin
// once, then interpolate the rocker height beneath a fixed piece of pavement.
function rocker(c, foot, side) {
  if (foot.profiles && foot.profileSource === c.rig.soleSurface) return foot.profiles
  foot.profileSource = c.rig.soleSurface
  foot.profiles = soleLanes.map((lane) => {
    const row = new Float32Array(soleSamples)
    for (let i = 0; i < row.length; i++) {
      const z = soleStart + i * soleStep
      if (c.rig.soleSurface) c.rig.soleSurface(side, z, lane, c.v)
      else basicSole(z, lane, 0, side === 'l' ? 1 : -1, c.v)
      row[i] = c.v.y
    }
    return row
  })
  return foot.profiles
}
// Survey a new footprint once. Sampling the heel, width and forefoot catches
// the narrow raised bands on the paving. Two alternating records also handle
// repeated or out-of-order animation frames.
function groundPatch(c, state, foot, at, yaw) {
  if (!state.groundAt) return null
  const x = c.route.x + c.scale * (at.x * c.cos + at.z * c.sin)
  const y = (c.route.y ?? 0) + c.scale * at.y
  const z = c.route.z + c.scale * (at.z * c.cos - at.x * c.sin)
  const angle = c.route.yaw + yaw,
    size = c.h * c.scale
  for (const p of foot.patches)
    if (
      p.reader === state.groundAt &&
      p.sole === c.rig.soleSurface &&
      Math.abs(x - p.x) +
        Math.abs(y - p.y) +
        Math.abs(z - p.z) +
        Math.abs(angleBetween(p.angle, angle)) +
        Math.abs(size - p.size) <
        1e-7
    ) {
      if (foot.patches.length === 2 && p === foot.patches[0]) {
        foot.patches[0] = foot.patches[1]
        foot.patches[1] = p
      }
      return p
    }
  const p = foot.patches.length < 2 ? { samples: [] } : foot.patches.shift()
  foot.patches.push(p)
  p.samples.length = 0
  Object.assign(p, {
    reader: state.groundAt,
    sole: c.rig.soleSurface,
    x,
    y,
    z,
    angle,
    size,
    low: Infinity,
    high: -Infinity,
  })
  const cos = Math.cos(angle),
    sin = Math.sin(angle)
  const side = foot === c.feet.l ? 'l' : 'r'
  let laneIndex = 0
  function sample(s, width, lane) {
    if (c.rig.soleSurface) c.rig.soleSurface(side, s, lane, c.v)
    else basicSole(s, lane, width * c.shoeWidth * 0.87, side === 'l' ? 1 : -1, c.v)
    const across = c.v.x * size,
      along = s * size
    const surface = state.groundAt(x + along * sin + across * cos, z + along * cos - across * sin, y)
    const level = ((Number.isFinite(surface) ? surface : y) - y) / c.scale
    p.samples.push(s, c.v.y, level, laneIndex)
    p.low = Math.min(p.low, level)
    p.high = Math.max(p.high, level)
    return level
  }
  // A level flagstone needs just one survey per step, including when several
  // props request the pose in the same frame.
  for (const [s, w] of soleStations) for (let lane = -1; lane <= 1; lane++) sample(s, w, 0.96 * lane)
  if (p.high - p.low < 1e-7 && p.high < 0.008) {
    p.samples.length = 0
    return p
  }

  // Find both edges of any raised ring or band. The support can lie between
  // two original sole vertices. Sample each side of the actual shoe's arch
  // separately, then bisect only where the masonry changes height.
  function split(a, wa, ha, b, wb, hb, lane, depth) {
    if (!depth || Math.abs(ha - hb) < 0.00025) return
    const s = (a + b) * 0.5,
      w = (wa + wb) * 0.5,
      h = sample(s, w, lane)
    split(a, wa, ha, s, w, h, lane, depth - 1)
    split(s, w, h, b, wb, hb, lane, depth - 1)
  }
  p.samples.length = 0
  const margins = [[], []]
  for (const margin of margins)
    for (let i = 1; i < soleStations.length; i++) margin.push([Infinity, -Infinity])
  function survey(index, detail) {
    laneIndex = index
    const lane = soleLanes[index],
      abs = Math.abs(lane),
      margin = margins[lane < 0 ? 0 : 1]
    let last = -1,
      ha
    for (let i = 1; i < soleStations.length; i++) {
      const cell = margin[i - 1]
      // On a uniform strip, the lower inside edge already supports this
      // piece of welt. Resolve its individual layers only around a relief.
      if (detail && cell[1] - cell[0] < 0.00025) continue
      const [a, wa] = soleStations[i - 1]
      if (last !== i - 1) ha = sample(a, wa, lane)
      const [b, wb] = soleStations[i],
        m = (a + b) * 0.5,
        wm = (wa + wb) * 0.5
      const hm = sample(m, wm, lane),
        hb = sample(b, wb, lane)
      if (!detail && abs >= 0.995) {
        cell[0] = Math.min(cell[0], ha, hm, hb)
        cell[1] = Math.max(cell[1], ha, hm, hb)
      }
      split(a, wa, ha, m, wm, hm, lane, 4)
      split(m, wm, hm, b, wb, hb, lane, 4)
      ha = hb
      last = i
    }
  }
  for (let index = 0; index < soleLanes.length; index++) {
    const width = Math.abs(soleLanes[index])
    if (width <= 0.995 || width === 1.15) survey(index, false)
  }
  for (let index = 0; index < soleLanes.length; index++) {
    const width = Math.abs(soleLanes[index])
    if (width > 0.995 && width < 1.15) survey(index, true)
  }
  if (p.high - p.low < 1e-7) p.samples.length = 0
  return p
}
function groundRise(c, foot, center, yaw, pitch, toePitch, ankle, toe, first, last, blend) {
  if (!first) return 0
  const b = last ?? first
  if (first.high - first.low + b.high - b.low < 1e-7) return T.MathUtils.lerp(first.high, b.high, blend)
  const sin = Math.sin(pitch),
    cos = Math.cos(pitch),
    sinToe = Math.sin(toePitch),
    cosToe = Math.cos(toePitch)
  const ankleZ = (foot.target.x - center.x) * Math.sin(yaw) + (foot.target.z - center.z) * Math.cos(yaw)
  const ankleY = foot.target.y - center.y,
    dy = toe[1] - ankle[1],
    dz = toe[2] - ankle[2]
  const toeZ = ankleZ + dy * sin + dz * cos,
    toeY = ankleY + dy * cos - dz * sin
  const rear = ankleZ - ankle[1] * sin + (-0.098 * c.h - ankle[2]) * cos
  const front = toeZ - toe[1] * sinToe + (0.207 * c.h - toe[2]) * cosToe
  const rows =
    Math.abs(pitch) + Math.abs(toePitch) > 0.015 ? rocker(c, foot, foot === c.feet.l ? 'l' : 'r') : null
  function bearing(p) {
    if (p.high - p.low < 1e-7) return p.high
    let rise = -Infinity
    for (let i = 0; i < p.samples.length; i += 4) {
      const z = p.samples[i] * c.h
      if (z < rear - 0.003 * c.h || z > front + 0.003 * c.h) continue
      let base = p.samples[i + 1] * c.h
      if (rows) {
        // A rolled sole has moved longitudinally beneath this fixed piece of
        // paving. Use its local rocker height at that material coordinate.
        const onToe = z > toeZ
        const materialZ = onToe
          ? toe[2] + (z - toeZ - (base - toe[1]) * sinToe) / cosToe
          : ankle[2] + (z - ankleZ - (base - ankle[1]) * sin) / cos
        const restZ = materialZ / c.h
        if (restZ < soleStart || restZ > soleEnd) continue
        const slot = (restZ - soleStart) / soleStep,
          i0 = Math.min(soleSamples - 2, Math.floor(slot))
        const row = rows[p.samples[i + 3]]
        base = c.h * T.MathUtils.lerp(row[i0], row[i0 + 1], slot - i0)
      }
      const rigid = ankleY - ((z - ankleZ) * sin) / cos + (base - ankle[1]) / cos
      const flexed = toeY - ((z - toeZ) * sinToe) / cosToe + (base - toe[1]) / cosToe
      const mix = clamp((z - toeZ + 0.022 * c.h) / (0.054 * c.h), 0, 1)
      const sole = T.MathUtils.lerp(rigid, flexed, mix * mix * (3 - 2 * mix))
      rise = Math.max(rise, p.samples[i + 2] - sole)
    }
    return Number.isFinite(rise) ? rise : p.high
  }
  const rise = bearing(first)
  return first === b ? rise : T.MathUtils.lerp(rise, bearing(b), blend)
}

// Strike about the heel, roll over a stationary sole and lift the heel about
// the articulated forefoot. The toe joint is above the ground by its real
// metatarsal thickness; rotating about the bone itself would sink the sole.
function shoeAt(c, side, center, yaw, pitch, toePitch, lift, first, last, blend = 0) {
  const foot = c.feet[side],
    rest = c.rig.rest
  const ankle = rest[side + 'Foot'],
    toe = rest[side + 'Toe'],
    h = c.h
  foot.rotation.setFromEuler(c.euler.set(pitch, yaw, 0))
  foot.toeRotation.setFromEuler(c.euler.set(toePitch, yaw, 0))
  const heel = pitch < -0.000001
  const supportZ = heel ? solePoints.heel[2] * h : toe[2]
  foot.contact.copy(center)
  foot.contact.x += Math.sin(yaw) * supportZ
  foot.contact.z += Math.cos(yaw) * supportZ
  foot.target.copy(foot.contact)
  if (heel) {
    c.v.set(0, -ankle[1], supportZ - ankle[2]).applyQuaternion(foot.rotation)
    foot.target.sub(c.v)
  } else {
    c.v.set(0, -toe[1], 0).applyQuaternion(foot.toeRotation)
    foot.target.sub(c.v)
    c.v.set(toe[0] - ankle[0], toe[1] - ankle[1], toe[2] - ankle[2]).applyQuaternion(foot.rotation)
    foot.target.sub(c.v)
  }
  const rise = groundRise(c, foot, center, yaw, pitch, toePitch, ankle, toe, first, last, blend)
  foot.target.y += lift + rise
  foot.contact.y += rise
  foot.support = foot.stance ? (heel ? 'heel' : 'ball') : null
}
function gaitFoot(c, state, side, sign) {
  const foot = c.feet[side],
    rest = c.rig.rest[side + 'Foot']
  const count = c.cycles + (sign < 0 ? 0.5 : 0)
  const u = count - Math.floor(count)
  const heelTime = (Math.floor(count) - (state.phase ?? 0) / tau - (sign < 0 ? 0.5 : 0)) * c.period
  const mid = heelTime + c.period * stancePart * 0.5
  const width = rest[0] * 0.8,
    toeOut = sign * 0.073
  let yaw = footprint(c, state, mid, width, c.a) + toeOut
  const first = groundPatch(c, state, foot, c.a, yaw)
  let last,
    blend = 0
  let pitch,
    toePitch,
    lift = 0
  const strength = c.stride
  foot.phase = u
  foot.stance = u < stancePart
  if (foot.stance) {
    const strike = 1 - smooth(u / 0.114),
      push = smooth((u - 0.435) / (stancePart - 0.435))
    pitch = strength * (0.47 * push - 0.225 * strike)
    toePitch = Math.min(0, pitch)
  } else {
    const swing = (u - stancePart) / (1 - stancePart)
    const nextYaw = footprint(c, state, mid + c.period, width, c.b) + toeOut
    const advance = smooth(swing)
    last = groundPatch(c, state, foot, c.b, nextYaw)
    blend = advance
    yaw += angleBetween(yaw, nextYaw) * advance
    c.a.lerp(c.b, advance)
    const arc = Math.sin(Math.PI * swing) ** 2
    c.a.x += sign * 0.013 * c.h * arc * strength
    pitch = strength * (0.47 - 0.695 * smooth(swing / 0.91))
    toePitch = pitch * smooth(swing / 0.49)
    lift = c.h * strength * arc * (0.085 + 0.025 * (1 - swing))
  }
  shoeAt(c, side, c.a, yaw, pitch, toePitch, lift, first, last, blend)
}
function plantedFoot(c, state, grips, side, sign) {
  const rest = c.rig.rest[side + 'Foot'],
    foot = c.feet[side],
    h = c.h
  const at = grips?.feet?.[side]
  const seated = c.seated
  foot.phase = 0
  foot.stance = true
  if (at?.point) vector(at.point, c.a)
  else {
    const width = seated
      ? 1.25
      : c.design === 'drummer' && state.job === 'drum'
        ? 1.63
        : state.job === 'porter'
          ? 1.4
          : 1.05
    const z = seated
      ? (state.job === 'row' ? 0.3 : 0.27) + 0.035 * sign
      : (state.job === 'porter' || state.job === 'drum' ? 0.07 : 0.026) * sign
    c.a.set(rest[0] * width, 0, h * z)
  }
  const yaw = at?.yaw ?? sign * (seated ? 0.105 : 0.08)
  shoeAt(c, side, c.a, yaw, 0, 0, 0, groundPatch(c, state, foot, c.a, yaw))
}

function torso(c, profile, state, grips) {
  c.h = profile.height ?? 1
  c.design = profile.design
  c.scale = state.scale ?? 1
  c.shoeWidth = clamp(1 + ((profile.girth ?? 1) - 1) * 0.23, 0.94, 1.07)
  c.walking = state.walking ?? state.job === 'walk'
  c.seated = !c.walking && ['row', 'sit', 'lute'].includes(state.job)
  c.period = posePeriod(profile, state)
  const t = state.t ?? 0,
    phase = state.phase ?? 0
  c.cycles = t / c.period + phase / tau
  c.angle = tau * c.cycles
  const sin = Math.sin(c.angle),
    cos = Math.cos(c.angle),
    h = c.h
  c.loading = state.job === 'porter' ? clamp(grips?.torsoLoad ?? state.loading ?? 0.5 - 0.5 * cos, 0, 1) : 0
  const load = c.loading * (c.walking ? 0.42 : 1)
  const now = readRoute(state, t, c.route)
  c.cos = Math.cos(now.yaw)
  c.sin = Math.sin(now.yaw)
  c.stride = 0
  if (c.walking) {
    const a = readRoute(state, t - 0.075, c.route1),
      b = readRoute(state, t + 0.075, c.route2)
    const speed = Math.hypot(b.x - a.x, b.z - a.z) / (0.15 * c.scale * h)
    // A turning walker transfers weight between soles even at a slow turnaround.
    const pivot = Math.abs(angleBetween(a.yaw, b.yaw)) / 0.15
    c.stride = clamp(speed / 0.76 + Math.min(0.42, 0.13 * pivot), 0, 1)
  }
  const stride = c.stride
  const stroke = grips?.stroke ?? sin
  let x = 0,
    y = c.rig.rest.pelvis[1],
    z = 0,
    tilt = 0,
    twist = 0,
    roll = 0
  let spineTilt = 0,
    chestTilt = 0,
    chestYaw = 0,
    headPitch = 0,
    headYaw = 0,
    upperGaze = 0,
    headRoll = 0,
    shoulderBack = 0,
    shoulderLift = 0
  if (c.walking) {
    x = h * 0.027 * Math.sin(c.angle - 0.2) * stride
    y -= h * (0.01 + stride * (0.011 + 0.016 * Math.cos(2 * c.angle - 0.44)))
    z = h * 0.008 * stride
    tilt = (0.035 + 0.012 * sin) * stride
    twist = -0.096 * cos * stride
    roll = 0.052 * Math.sin(c.angle - 0.3) * stride
    chestYaw = -1.82 * twist
    spineTilt = 0.044 * stride
    headPitch = -0.054 * stride
  } else if (c.seated) {
    const seat = typeof grips?.seat === 'number' ? grips.seat : 0.3625
    y = seat + 0.112 * h
    z = h * (state.job === 'row' ? -0.024 + 0.042 * stroke : -0.035)
    tilt = state.job === 'row' ? 0.145 + 0.145 * stroke : 0.058
    spineTilt = state.job === 'lute' ? 0.11 : 0.043
    chestYaw = state.job === 'lute' ? -0.115 : 0.025 * sin
    headPitch = state.job === 'lute' ? 0.12 : -0.055
  } else {
    y -= h * (0.015 + 0.002 * cos)
    x = h * (0.007 + 0.004 * sin)
    roll = -0.018 + 0.006 * sin
    if (state.job === 'drum') {
      const strike = 0.5 + 0.5 * Math.cos(4 * c.angle)
      y -= h * (0.033 + 0.018 * strike)
      z += 0.008 * h
      tilt = 0.132 + 0.041 * strike
      spineTilt = 0.053
      chestYaw = 0.069 * Math.sin(2 * c.angle)
      headPitch = -0.073
    }
    if (state.job === 'flute') {
      chestYaw = -0.061
      headYaw = 0.105
      headPitch = 0.027
    }
    if (state.job === 'watch') headYaw = 0.16 * sin
  }
  if (state.job === 'carrier') {
    roll += 0.043
    chestTilt += 0.048
  }
  // The merchant watches the open side of her parasol. Her bearing stays
  // level while the raised left shoulder takes the weight of its bamboo shaft.
  if (c.design === 'silk' && state.job === 'umbrella') {
    chestYaw *= 0.87
    headYaw -= 0.215 + 0.042 * cos
    upperGaze = 0.35 * headYaw
    headPitch -= 0.022
    headRoll += 0.026
    x += 0.005 * h
  }
  // The musician turns the left ear towards the neck of the pipa, following
  // the fretting hand without pulling the seated pelvis off its bench.
  if (c.design === 'lute' && state.job === 'lute') {
    chestYaw += 0.063 + 0.019 * sin
    headYaw += 0.198 + 0.037 * Math.sin(c.angle - 0.37)
    upperGaze = 0.35 * headYaw
    headPitch += 0.054 + 0.018 * cos
    headRoll -= 0.066 + 0.014 * sin
    chestTilt -= 0.027
    z += 0.006 * h
  }
  // The scholar carries an open fan near the right breast. His sternum
  // rises above relaxed shoulders; he glances down across the paper.
  if (c.design === 'scholar' && state.job === 'walk') {
    spineTilt -= 0.029
    chestTilt -= 0.012
    shoulderBack += 0.035
    shoulderLift -= 0.044
    headYaw -= 0.111 + 0.028 * cos
    upperGaze = 0.35 * headYaw
    headPitch += 0.031 + 0.019 * cos
    headRoll += 0.015
  }
  // The drummer drives each alternating stroke from the feet and hips.
  // An open chest and a stable, wider stance leave both forearms free.
  if (c.design === 'drummer' && state.job === 'drum') {
    const beat = Math.sin(2 * c.angle - 0.38)
    x += 0.027 * h * beat
    y -= 0.011 * h
    roll += 0.028 * beat
    chestYaw += 0.045 * beat
    chestTilt -= 0.056
    shoulderBack += 0.075
    headPitch += 0.019
  }
  if (load) {
    y -= 0.197 * h * load
    z -= 0.084 * h * load
    tilt += 0.285 * load
    spineTilt += 0.245 * load
    chestTilt += 0.095 * load
    headPitch -= 0.21 * load
  }
  forward(c.frames.root)
  const pelvis = c.frames.pelvis
  pelvis.bone.position.set(x, y, z)
  rotate(c, 'pelvis', tilt, twist, roll)
  let lower = 0
  for (const side of sides) {
    const sign = side === 'l' ? 1 : -1
    if (c.walking) gaitFoot(c, state, side, sign)
    else plantedFoot(c, state, grips, side, sign)
    const leg = c.limbs[side].leg
    forward(leg.a)
    const foot = c.feet[side].target
    const dx = foot.x - leg.a.p.x,
      dz = foot.z - leg.a.p.z
    const reach = leg.first + leg.second - 0.0025 * h
    const dy = Math.sqrt(Math.max(0, reach * reach - dx * dx - dz * dz))
    lower = Math.max(lower, leg.a.p.y - foot.y - dy)
  }
  if (lower > 0 && !c.seated) {
    pelvis.bone.position.y -= Math.min(0.14 * h, lower)
    forward(pelvis)
  }
  const breath = sin * (c.walking ? 0.009 : 0.018)
  rotate(c, 'spine', spineTilt - breath * 0.38, chestYaw * 0.34, -roll * 0.32)
  rotate(c, 'chest', chestTilt + breath, chestYaw * 0.66, -roll * 0.48)
  rotate(
    c,
    'neck',
    headPitch - breath * 0.45,
    headYaw - upperGaze - (twist + chestYaw) * 0.38,
    0.59 * headRoll - roll * 0.18,
  )
  rotate(
    c,
    'head',
    -breath * 0.28 + 0.004 * cos,
    upperGaze - (twist + chestYaw) * 0.35 + 0.008 * sin,
    0.41 * headRoll + 0.004 * sin,
  )
  for (const side of sides) {
    const sign = side === 'l' ? 1 : -1
    const lifted = c.design === 'silk' && state.job === 'umbrella' && sign > 0 ? 0.034 : 0
    rotate(
      c,
      side + 'Clavicle',
      0,
      sign * (shoulderBack - 0.025 - breath * 0.28),
      sign * (shoulderLift + lifted + breath * 0.42),
    )
    // Shoulder-mounted equipment follows the girdle. A previous frame's
    // humerus twist must not move a shoulder pad when the timeline is scrubbed.
    rotate(c, side + 'UpperArm', 0, 0, 0)
  }
}

// Actor-local location of a head, neck, chest or shoulder landmark before a
// tool has fixed the hands. localPoint uses actual bone-local metres.
export function poseLandmark(rig, profile, state, name, localPoint, out = new T.Vector3()) {
  const c = context(rig)
  torso(c, profile, state)
  const f = c.frames[name]
  return vector(localPoint, out).applyQuaternion(f.q).add(f.p)
}

function aim(c, node, direction, target) {
  c.inv.copy(node.parent.q).invert()
  c.v.subVectors(target, node.p).normalize().applyQuaternion(c.inv)
  node.bone.quaternion.setFromUnitVectors(direction, c.v)
  forward(node)
}
function solve(c, chain, target, pole) {
  const { a, b, tip, first, second } = chain
  forward(a)
  c.w.subVectors(target, a.p)
  const requested = c.w.length()
  if (requested > 1e-8) c.w.divideScalar(requested)
  else c.w.set(0, -1, 0)
  const d = clamp(requested, Math.abs(first - second) + 1e-6, first + second - 1e-6)
  const along = (first * first - second * second + d * d) / (2 * d)
  const height = Math.sqrt(Math.max(0, first * first - along * along))
  c.normal.copy(pole).addScaledVector(c.w, -pole.dot(c.w))
  if (c.normal.lengthSq() < 1e-8) {
    c.normal.set(0, Math.abs(c.w.y) < 0.85 ? 1 : 0, Math.abs(c.w.y) < 0.85 ? 0 : 1)
    c.normal.addScaledVector(c.w, -c.normal.dot(c.w))
  }
  c.normal.normalize()
  c.bend.copy(a.p).addScaledVector(c.w, along).addScaledVector(c.normal, height)
  c.end.copy(a.p).addScaledVector(c.w, d)
  aim(c, a, chain.aDir, c.bend)
  forward(b)
  aim(c, b, chain.bDir, c.end)
  forward(tip)
}
function solveFoot(c, side, sign) {
  const chain = c.limbs[side].leg,
    foot = c.feet[side]
  c.pole.set(sign * (c.seated ? 0.18 : 0.115), 0, 1)
  solve(c, chain, foot.target, c.pole)
  orient(c, chain.tip, foot.rotation)
  const toe = c.frames[side + 'Toe']
  orient(c, toe, foot.toeRotation)
  const ankleRest = c.rig.rest[side + 'Foot'],
    toeRest = c.rig.rest[side + 'Toe']
  foot.heel
    .set(0, -ankleRest[1], solePoints.heel[2] * c.h - ankleRest[2])
    .applyQuaternion(chain.tip.q)
    .add(chain.tip.p)
  foot.ball.set(0, -toeRest[1], 0).applyQuaternion(toe.q).add(toe.p)
  foot.tip
    .set(0, -toeRest[1], solePoints.tip[2] * c.h - toeRest[2])
    .applyQuaternion(toe.q)
    .add(toe.p)
  foot.actual.copy(foot.support === 'heel' ? foot.heel : foot.ball)
  foot.residual = foot.stance ? foot.actual.distanceTo(foot.contact) : 0
}

function gripRotation(c, grip, out) {
  vector(grip.axis ?? up, c.w)
  if (c.w.lengthSq() < 1e-12) c.w.copy(up)
  c.w.normalize()
  out.setFromUnitVectors(up, c.w)
  if (grip.forward) {
    vector(grip.forward, c.a)
    c.a.addScaledVector(c.w, -c.a.dot(c.w))
    if (c.a.lengthSq() > 1e-8) {
      c.a.normalize()
      c.b.crossVectors(c.w, c.a)
      out.setFromRotationMatrix(c.basis.makeBasis(c.b, c.w, c.a))
    }
  }
}
// The rigid clavicle is part of the reach. Protract/elevate it only as far as
// a contact needs. An object outside even this workspace leaves a measured gap.
function reachShoulder(c, side, target) {
  const arm = c.limbs[side].arm,
    clav = arm.a.parent
  const reach = arm.first + arm.second - 0.008 * c.h
  if (arm.a.p.distanceToSquared(target) <= reach * reach) return
  c.a.subVectors(arm.a.p, clav.p)
  c.b.subVectors(target, clav.p)
  const l = c.a.length(),
    d = c.b.length()
  if (d < 1e-8) return
  c.a.divideScalar(l)
  c.b.divideScalar(d)
  const angle = Math.acos(clamp(c.a.dot(c.b), -1, 1))
  if (angle < 1e-5) return
  const permitted = Math.acos(clamp((d * d + l * l - reach * reach) / (2 * d * l), -1, 1))
  const turn = clamp(angle - permitted, 0, 0.49)
  c.delta.setFromUnitVectors(c.a, c.b)
  c.q
    .identity()
    .slerp(c.delta, turn / angle)
    .multiply(clav.q)
  orient(c, clav, c.q)
  forward(arm.a)
}
function freeWrist(c, state, side, sign, out) {
  const sh = c.limbs[side].arm.a.p,
    hip = c.frames.pelvis.p,
    h = c.h
  const wave = Math.sin(c.angle),
    swing = -sign * Math.cos(c.angle - 0.11) * c.stride
  const freeSwing =
    (c.design === 'scholar' && state.job === 'walk') || (c.design === 'silk' && state.job === 'umbrella')
      ? 0.149
      : 0.203
  out.set(
    sh.x + sign * 0.039 * h,
    sh.y + h * (-0.473 + 0.043 * Math.max(0, swing)),
    sh.z + h * (0.054 + freeSwing * swing),
  )
  const width = (x, y, z) => out.set(sign * x * h, y, hip.z + z * h)
  switch (state.job) {
    case 'sit':
      width(0.135, hip.y + 0.075 * h, 0.23)
      break
    case 'lute':
      width(0.13, hip.y + h * (sign > 0 ? 0.43 : 0.17), 0.22)
      break
    case 'row':
      width(0.15, hip.y + h * (0.25 + 0.079 * wave), 0.25 + 0.095 * wave)
      break
    case 'flute':
      width(0.147, sh.y + h * (0.092 + 0.012 * sign), 0.177)
      break
    case 'drum':
      width(0.18, sh.y + h * (-0.16 + 0.12 * sign * wave), 0.34 + 0.033 * sign * wave)
      break
    case 'porter':
      width(0.19, sh.y - h * (0.235 + 0.055 * c.loading), 0.25 + 0.055 * c.loading)
      break
    case 'umbrella':
      if (sign > 0) width(0.235, sh.y - 0.08 * h, 0.155)
      break
    case 'carrier':
      if (sign < 0) width(0.19, sh.y + 0.013 * h, 0.2)
      break
    case 'lantern':
    case 'basket':
    case 'watch':
      if (sign < 0) width(0.25, sh.y - h * (state.job === 'basket' ? 0.36 : 0.205), 0.14)
      break
  }
}
function solveArm(c, state, side, sign, grip) {
  const chain = c.limbs[side].arm,
    hand = c.hands[side]
  hand.gripping = !!grip?.point
  if (hand.gripping) {
    gripRotation(c, grip, hand.rotation)
    vector(grip.point, hand.contact)
    c.v.copy(gripOffset).applyQuaternion(hand.rotation)
    hand.target.copy(hand.contact).sub(c.v)
    reachShoulder(c, side, hand.target)
  } else freeWrist(c, state, side, sign, hand.target)
  const music = ['flute', 'lute', 'drum'].includes(state.job)
  c.pole.set(
    sign * (music || hand.gripping ? 0.77 : 0.34),
    music || c.seated ? -0.76 : -0.24,
    c.seated || music ? -0.43 : -1,
  )
  // The hand that fingers a pipa's neck sits near its own shoulder. When the
  // elbow pole is almost opposite that wrist direction it splays horizontally;
  // aim it down and forward alongside the pear-shaped soundboard.
  if (state.job === 'lute' && sign > 0) c.pole.set(0.6, -1.2, 0.5)
  if (state.job === 'flute') c.pole.set(sign * 0.78, -1.05, 0.5)
  // A wide instrument can require a particular approach to the string or
  // handle. Its actor-space pole guides the elbow about the shoulder-wrist line.
  if (hand.gripping && grip.elbowPole) {
    vector(grip.elbowPole, c.a)
    if (c.a.lengthSq() > 1e-10) c.pole.copy(c.a)
  }
  solve(c, chain, hand.target, c.pole)
  if (hand.gripping) orient(c, chain.tip, hand.rotation)
  else rotate(c, side + 'Hand', -0.055, sign * 0.024, sign * 0.04)
  hand.actual.copy(gripOffset).applyQuaternion(chain.tip.q).add(chain.tip.p)
  hand.residual = hand.gripping ? hand.actual.distanceTo(hand.contact) : 0
}

// The returned joint, orientation and contact vectors belong to this rig and
// remain valid until the next pose. Scrubbing t never depends on a prior pose.
export function poseHuman(rig, profile, state, grips) {
  const c = context(rig)
  torso(c, profile, state, grips)
  for (const side of sides) {
    const sign = side === 'l' ? 1 : -1
    solveFoot(c, side, sign)
    solveArm(c, state, side, sign, grips?.[side])
  }
  c.audit.period = c.period
  c.audit.phase = c.angle
  return c.audit
}
