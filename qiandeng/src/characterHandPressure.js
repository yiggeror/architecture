import * as T from 'three'
import { posePeriod } from './humanPose.js'

// Each curled finger bears differently against the narrow drumstick. On the
// downstroke the pad flattens toward the stick and widens along its axis.
// Vertices already touching the grip retain their bearing radius.
export function drumPressure(mesh, side, profile, radius, wrist, digits) {
  const geometry = mesh.geometry,
    rest = geometry.attributes.position
  const pressed = geometry.clone()
  pressed.computeVertexNormals()
  const unpressedNormals = pressed.attributes.normal.array.slice()
  const posed = pressed.attributes.position
  const point = new T.Vector3(),
    zero = 0.026
  for (let digit = 0; digit < 5; digit++) {
    const joints = mesh.userData.digitJoints[digit]
    const tip = new T.Vector3(...joints[3]),
      dip = new T.Vector3(...joints[2])
    const padCentre = tip.clone().lerp(dip, 0.4)
    const shape = digits[digit]
    for (let i = shape.distalSkin[0]; i < shape.end; i++) {
      point.fromBufferAttribute(rest, i)
      const x = point.x,
        z = point.z - zero,
        r = Math.hypot(x, z)
      const gap = Math.max(0, r - radius - 0.00014)
      const influence = Math.exp(-((point.distanceTo(padCentre) / 0.01) ** 2) - (gap / 0.005) ** 2)
      const bearing = Math.min(gap, 0.00068 * influence)
      const spread = (point.y - padCentre.y) * 0.1 * influence
      posed.setXYZ(i, x * (1 - bearing / r), point.y + spread, zero + z * (1 - bearing / r))
    }
  }
  pressed.computeVertexNormals()
  const offsets = new Float32Array(rest.array.length),
    normals = new Float32Array(rest.array.length)
  for (let i = 0; i < offsets.length; i++) {
    offsets[i] = posed.array[i] - rest.array[i]
    normals[i] = pressed.attributes.normal.array[i] - unpressedNormals[i]
  }
  const displacement = new T.Float32BufferAttribute(offsets, 3),
    normal = new T.Float32BufferAttribute(normals, 3)
  displacement.name = normal.name = mesh.name + '承槌'
  geometry.morphTargetsRelative = true
  geometry.morphAttributes.position = [displacement]
  geometry.morphAttributes.normal = [normal]
  mesh.updateMorphTargets()
  pressed.dispose()
  const cycle = posePeriod(profile, { job: 'drum' })
  return {
    mesh,
    wrist,
    update(state) {
      const stroke =
        (((state.t ?? 0) * Math.PI * 2) / cycle + (state.phase ?? 0)) * 2 + (side === 'r' ? Math.PI : 0)
      mesh.morphTargetInfluences[0] = (0.5 + 0.5 * Math.cos(stroke + 0.12)) ** 4
    },
  }
}
