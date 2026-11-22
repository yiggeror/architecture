import * as T from 'three'
import { pipaFingerRotation, pipaFingerOffset, pipaWristRotation } from './characterActing.js'

const fretRotation = new T.Quaternion().fromArray(pipaFingerRotation).normalize()
export const frettingToWrist = new T.Matrix4().compose(
  new T.Vector3(...pipaFingerOffset),
  fretRotation,
  new T.Vector3(1, 1, 1),
)
const toFinger = frettingToWrist.clone().invert()
const scratch = new T.Vector3()

const boardToFinger = new T.Quaternion().fromArray(pipaWristRotation).multiply(fretRotation).invert()
export function fromFretboardVector(vector) {
  return scratch.fromArray(vector).applyQuaternion(boardToFinger).toArray()
}
// The metacarpal surface is lofted in the re-seated wrist's coordinates.
// Distal anatomy is authored in the string-contact frame used by the solver.
export function inFrettingSpace(p) {
  return scratch.fromArray(p).applyMatrix4(toFinger).toArray()
}
export function seatFrettingHand(mesh) {
  const geometry = mesh.geometry
  geometry.applyMatrix4(frettingToWrist)
  for (const attributes of Object.values(geometry.morphAttributes))
    for (const vector of attributes)
      for (let i = 0; i < vector.count; i++) {
        scratch.fromBufferAttribute(vector, i).applyQuaternion(fretRotation)
        vector.setXYZ(i, scratch.x, scratch.y, scratch.z)
      }
  mesh.userData.digitJoints = mesh.userData.digitJoints.map((digit) =>
    digit.map((p) => scratch.fromArray(p).applyMatrix4(frettingToWrist).toArray()),
  )
  mesh.userData.reseatedFret = true
}
