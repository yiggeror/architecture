import * as T from 'three'

// Manoeuvring a shaft uses precisely the same point on every rendered hand.
export const handGrip = Object.freeze([0, -0.072, 0.026])
// Actor-space Z distances at the shoe's centreline, for a height multiplier of one.
export const solePoints = Object.freeze({
  heel: Object.freeze([0, 0, -0.075]),
  ball: Object.freeze([0, 0, 0.123]),
  tip: Object.freeze([0, 0, 0.192]),
})

export function createHumanRig(profile = {}) {
  const h = profile.height ?? 1,
    shoulder = profile.shoulders ?? 1,
    hip = profile.hips ?? 1
  const arm = profile.armLength ?? 1,
    leg = profile.legLength ?? 1
  const pelvisY = 0.89 + 0.787 * (leg - 1)
  const torsoY = (y) => pelvisY + ((y - 0.89) * (1.46 - pelvisY)) / 0.57
  const bones = {},
    rest = {},
    index = {},
    list = []

  function joint(name, parent, x, y, z) {
    const bone = new T.Bone()
    bone.name = name
    const point = [x * h, y * h, z * h]
    bone.position.fromArray(point)
    if (parent) {
      const origin = rest[parent]
      bone.position.x -= origin[0]
      bone.position.y -= origin[1]
      bone.position.z -= origin[2]
      bones[parent].add(bone)
    }
    bones[name] = bone
    rest[name] = point
    index[name] = list.length
    list.push(bone)
  }

  joint('root', null, 0, 0, 0)
  joint('pelvis', 'root', 0, pelvisY, 0)
  joint('spine', 'pelvis', 0, torsoY(1.04), 0)
  joint('chest', 'spine', 0, torsoY(1.22), 0)
  joint('neck', 'chest', 0, torsoY(1.411), 0.003)
  joint('head', 'neck', 0, 1.46, 0.012)
  for (const [side, sign] of [
    ['l', 1],
    ['r', -1],
  ]) {
    const ax = 0.191 * shoulder,
      ay = torsoY(1.35)
    joint(side + 'Clavicle', 'chest', sign * 0.034 * shoulder, torsoY(1.338), 0.006)
    joint(side + 'UpperArm', side + 'Clavicle', sign * ax, ay, 0.002)
    joint(
      side + 'Forearm',
      side + 'UpperArm',
      sign * (ax + 0.059 * arm),
      ay - 0.275 * arm,
      0.002 + 0.013 * arm,
    )
    joint(side + 'Hand', side + 'Forearm', sign * (ax + 0.059 * arm), ay - 0.518 * arm, 0.002 + 0.04 * arm)
    const hx = 0.095 * hip
    joint(side + 'Thigh', 'pelvis', sign * hx, 0.09 + 0.787 * leg, 0)
    joint(side + 'Shin', side + 'Thigh', sign * (hx + 0.003), 0.09 + 0.39 * leg, 0.018)
    joint(side + 'Foot', side + 'Shin', sign * (hx + 0.003), 0.09, -0.022)
    joint(side + 'Toe', side + 'Foot', sign * (hx + 0.003), 0.045, 0.123)
  }
  bones.root.updateMatrixWorld(true)
  return { root: bones.root, bones, rest, index, skeleton: new T.Skeleton(list) }
}
