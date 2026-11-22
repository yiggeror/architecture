import * as T from 'three'
import { createHumanRig } from './humanRig.js'
import { poseHuman } from './humanPose.js'
import { between, clip, mix, step } from './characterGarmentMesh.js'
import { legDrape } from './characterGarmentCut.js'

const bell = (v, c, w) => Math.exp(-(((v - c) / w) ** 2))
const power = (v, e) => Math.sign(v) * Math.abs(v) ** e

// A skirt cut on a live model seated on the board. The front is supported by
// the two thighs, drops between the patellae, then hangs freely to the ankles.
// Behind her the cloth comes out from beneath the seated pelvis to the front
// edge of the board. Each surface is transformed back to its own bone blend.
const rows = [
  // Along warp, half width, front height/depth, back height/depth, side height/depth.
  [0, 0.149, 0.641, 0.1, 0.647, -0.126, 0.638, -0.025],
  [0.07, 0.158, 0.591, 0.125, 0.587, -0.141, 0.58, -0.013],
  [0.15, 0.174, 0.547, 0.178, 0.504, -0.162, 0.499, 0.013],
  [0.24, 0.192, 0.53, 0.252, 0.434, -0.159, 0.453, 0.046],
  [0.32, 0.208, 0.521, 0.316, 0.379, -0.125, 0.42, 0.088],
  [0.43, 0.227, 0.507, 0.383, 0.365, -0.064, 0.409, 0.139],
  [0.5, 0.235, 0.48, 0.407, 0.3645, 0.004, 0.391, 0.185],
  [0.56, 0.234, 0.443, 0.425, 0.3645, 0.069, 0.368, 0.21],
  [0.62, 0.224, 0.393, 0.431, 0.3635, 0.145, 0.336, 0.223],
  [0.71, 0.212, 0.314, 0.426, 0.301, 0.162, 0.283, 0.227],
  [0.83, 0.209, 0.214, 0.409, 0.213, 0.155, 0.201, 0.221],
  [0.93, 0.222, 0.126, 0.401, 0.127, 0.144, 0.122, 0.22],
  [1, 0.249, 0.069, 0.417, 0.07, 0.114, 0.067, 0.225],
]
function rowAt(t) {
  const j = rows.findIndex((r) => t <= r[0])
  const idx = j <= 0 ? (j === 0 ? 1 : rows.length - 1) : j
  const a = rows[idx - 1],
    b = rows[idx],
    dt = b[0] - a[0],
    f = clip((t - a[0]) / dt)
  const prev = rows[Math.max(0, idx - 2)],
    next = rows[Math.min(rows.length - 1, idx + 1)]
  return a.slice(1).map((value, k) => {
    const i = k + 1,
      f2 = f * f,
      f3 = f2 * f
    const m0 = ((b[i] - prev[i]) * dt) / (b[0] - prev[0])
    const m1 = ((next[i] - value) * dt) / (next[0] - a[0])
    return (2 * f3 - 3 * f2 + 1) * value + (f3 - 2 * f2 + f) * m0 + (-2 * f3 + 3 * f2) * b[i] + (f3 - f2) * m1
  })
}
export function seatedSilk(a) {
  const rig = createHumanRig(a.profile)
  const seat = 0.3625 * a.h
  poseHuman(rig, a.profile, { job: 'lute', t: 0, phase: 0, scale: 1 }, { seat })
  rig.root.updateMatrixWorld(true)
  const matrices = {}
  for (const [name, bone] of Object.entries(rig.bones)) {
    matrices[name] = new T.Matrix4().multiplyMatrices(
      bone.matrixWorld,
      rig.skeleton.boneInverses[rig.index[name]],
    )
  }
  const leg = ['l', 'r'].map((side) =>
    ['Thigh', 'Shin', 'Foot'].map((joint) =>
      rig.bones[side + joint].getWorldPosition(new T.Vector3()).divideScalar(a.h),
    ),
  )
  rig.skeleton.dispose()
  const m = new T.Matrix4(),
    target = new T.Vector3()
  return (theta, t, allowance = 0) => {
    const c = Math.cos(theta),
      s = Math.sin(theta),
      angle = Math.atan2(s, c)
    const [width, yf, zf, yb, zb, ys, zs] = rowAt(t)
    const side = Math.abs(s),
      front = Math.max(c, 0),
      back = Math.max(-c, 0)
    const y = mix(1.049, 0.134, t)
    const w = legDrape(a, y, theta)
    m.elements.fill(0)
    const order = Object.entries(w)
      .filter(([, value]) => value > 0)
      .sort((l, r) => r[1] - l[1])
      .slice(0, 4)
    const sum = order.reduce((total, [, value]) => total + value, 0)
    for (const [joint, value] of order) {
      const e = matrices[joint].elements
      for (let j = 0; j < 16; j++) m.elements[j] += (e[j] * value) / sum
    }

    const lap = step(0.1, 0.31, t) * (1 - step(0.53, 0.67, t))
    const hanging = step(0.45, 0.77, t)
    const knee = bell(Math.abs(angle), 0.67 + 0.1 * t, 0.43)
    const frontProfile = front ** (0.59 - 0.26 * step(0.51, 0.73, t)),
      backProfile = back ** 0.79
    // Bias folds radiate from the pressure of the instrument on the right
    // thigh and the two knees. Their soft backs slide into narrow return folds.
    const bearing =
      angle * (6.1 + 2.2 * hanging) +
      0.63 * Math.sin(angle * 2 - 1.4 * t) +
      2.2 * t +
      0.68 * Math.sin(4 * t + angle)
    const fold =
      (Math.sin(bearing) + 0.29 * Math.sin(2 * bearing - 0.53)) *
      (0.006 + 0.01 * hanging + 0.004 * side) *
      step(0.03, 0.34, t)
    const compression =
      0.006 *
      Math.sin(53 * t + 3 * angle + 0.61 * Math.sin(4 * angle)) *
      (bell(t, 0.24, 0.115) * front + bell(t, 0.43, 0.115) * side ** 4)
    const sag = 0.035 * bell(angle, 0.045, 0.47) + 0.01 * bell(angle, -1.16, 0.23)
    const raised = knee * (0.018 + 0.011 * s)
    const hem = step(0.84, 1, t) * (0.013 * Math.sin(4 * angle - 0.42) + 0.009 * Math.cos(7 * angle + 0.7))
    const yy =
      ys +
      (yf - ys) * frontProfile +
      (yb - ys) * backProfile +
      (raised - sag) * lap +
      0.011 * s * front * lap +
      0.027 * bell(angle, -0.56, 0.7) * bell(t, 0.345, 0.16) +
      (fold + compression) * (0.2 + 0.8 * lap) * (0.32 + 0.68 * front) +
      hem
    let zz =
      zs +
      (zf - zs) * frontProfile +
      (zb - zs) * backProfile +
      front * lap * (0.041 * knee - 0.028 * bell(angle, 0, 0.38)) +
      c * (fold + compression) * (0.3 + 0.7 * hanging) +
      front * 0.013 * hanging +
      0.018 * s * front * step(0.41, 0.73, t)
    const xx =
      power(s, 0.8) * (width + 0.025 * step(0.33, 0.61, t) * (1 - 0.65 * step(0.79, 1, t))) +
      s * fold +
      0.008 * Math.sin(2 * angle + 5 * t) * hanging
    // At the bridging front edge the cloth follows the convex surface of the
    // shin and patella. Smooth union allows the longitudinal folds to continue
    // beneath the knees without cutting into the breeches during a pose.
    if (c > 0 && t > 0.38) {
      for (const [, knee, foot] of leg) {
        const along = clip((knee.y - yy) / (knee.y - foot.y))
        const shinX = mix(knee.x, foot.x, along),
          shinZ = mix(knee.z, foot.z, along)
        const radiusX = 0.074 - 0.03 * along + 0.011 * bell(along, 0.34, 0.24)
        const radiusZ = 0.077 - 0.031 * along + 0.019 * bell(along, 0.37, 0.24)
        const dx = (xx - shinX) / radiusX
        if (Math.abs(dx) < 1.2) {
          const profile = Math.sqrt(Math.max(0, 1 - dx * dx))
          const against = shinZ + radiusZ * profile + 0.012 + 0.0025 * Math.sin(9 * angle + 4 * t)
          const difference = against - zz
          const rounded = 0.018 * Math.log1p(Math.exp(difference / 0.018))
          zz += rounded * step(0.38, 0.49, t) * (1 - step(0.96, 1.2, Math.abs(dx)))
        }
      }
    }
    const lift = 0.17 + 0.96 * front * bell(t, 0.31, 0.18)
    target
      .set(xx + s * allowance, yy + lift * allowance, zz + c * allowance * (0.47 + 0.53 * step(0.29, 0.54, t)))
      .multiplyScalar(a.h)
    const posed = target.applyMatrix4(m.invert()).toArray()
    const rest = a.torsoPoint(y, theta, 0.009 + allowance)
    return { p: between(rest, posed, step(0.025, 0.16, t)), w, theta, level: y, allowance: 0 }
  }
}
