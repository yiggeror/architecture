import * as T from 'three'

export const knuckles = [0.029, 0.009, -0.0105, -0.0284]
export const fingerWidths = [0.0091, 0.0095, 0.009, 0.00765]

// Palm sheets run from the ulnar edge across the back, then return on the
// palm side. The last rings of the naked forearm use those same meridians.
const radial = []
for (let digit = 3; digit >= 0; digit--) {
  for (let i = 0; i <= 6; i++)
    radial.push(knuckles[digit] + fingerWidths[digit] * Math.sin(-Math.PI / 2 + (Math.PI * i) / 6))
  if (digit) radial.push((knuckles[digit] + knuckles[digit - 1]) / 2)
}
const lo = radial[0], span = radial.at(-1) - lo
const back = radial.map((x) => Math.asin(T.MathUtils.clamp((2 * (x - lo)) / span - 1, -1, 1)))
export const wristMeridians = [...back, ...back.slice(1, -1).reverse().map((angle) => Math.PI - angle)]

export function joinWrists(rig, hands) {
  const skin = rig.forearmSkin
  if (!skin) return
  const g = skin.mesh.geometry,
    positions = g.attributes.position,
    colors = g.attributes.color,
    skinWeights = g.attributes.skinWeight,
    skinIndices = g.attributes.skinIndex,
    originalNormals = g.attributes.normal.array.slice(),
    forearmVertices = new Set(),
    point = new T.Vector3(),
    carriage = new T.Vector3(),
    tangent = new T.Vector3(),
    sectionCentre = new T.Vector3(),
    target = new T.Vector3(),
    pigment = new T.Vector3(),
    average = new T.Vector3()
  for (const [side, hand] of hands) {
    const { outer, inner } = hand.wrist
    const palm = hand.mesh.geometry.attributes
    const origin = new T.Vector3(...rig.rest[side + 'Hand'])
    skin[side].at(-1).handEdge = outer
    for (const [i, twin] of hand.wrist.twins) {
      const first = outer[i]
      pigment.fromBufferAttribute(palm.color, first).lerp(target.fromBufferAttribute(palm.color, twin), 0.5)
      palm.color.setXYZ(first, pigment.x, pigment.y, pigment.z)
      palm.color.setXYZ(twin, pigment.x, pigment.y, pigment.z)
    }
    const tailor = hand.mesh.userData.fitCuff
    const forearmBone = rig.index[side + 'Forearm'], handBone = rig.index[side + 'Hand']
    for (const row of skin[side]) {
      // The cuff follows the forearm bone. Keep the hidden proximal ring
      // inside it, and distribute wrist flexion over the last four cm.
      const bend = tailor ? 1 - T.MathUtils.smoothstep(row.ahead, 0, 0.043) : row.blend
      const blend = tailor ? Math.min(bend, row.blend) : row.blend
      const underCuff = tailor ? 0.25 * T.MathUtils.smoothstep(row.ahead, 0.012, 0.040) : 0
      if (underCuff) {
        sectionCentre.set(0,0,0)
        for (const k of row.indices) sectionCentre.add(target.fromBufferAttribute(positions,k))
        sectionCentre.multiplyScalar(1/row.indices.length)
      }
      for (let i = 0; i < outer.length; i++) {
        const k = row.indices[i]
        forearmVertices.add(k)
        point.fromBufferAttribute(positions, k)
        carriage.fromBufferAttribute(palm.position, outer[i]).add(origin)
        tangent.fromBufferAttribute(palm.position, inner[i]).add(origin).sub(carriage)
        target.copy(carriage).addScaledVector(tangent, row.ahead / Math.min(-0.003, tangent.y))
        // The palm bears on the oar's grip. The bare forearm leaves its copper
        // collar behind the hand as it leads back towards the rowing elbow.
        if (skin.rowing) target.z -= 0.017 * -Math.expm1(-row.ahead / 0.012)
        point.lerp(target, blend)
        if (underCuff) point.lerp(sectionCentre, underCuff)
        if (tailor) {
          if (bend === 0 || bend === 1) {
            skinIndices.setXYZW(k, bend ? handBone : forearmBone, 0, 0, 0)
            skinWeights.setXYZW(k, 1, 0, 0, 0)
          } else {
            skinIndices.setXYZW(k, forearmBone, handBone, 0, 0)
            skinWeights.setXYZW(k, 1-bend, bend, 0, 0)
          }
        }
        positions.setXYZ(k, point.x, point.y, point.z)
        pigment.fromBufferAttribute(colors, k).lerp(target.fromBufferAttribute(palm.color, outer[i]), blend)
        colors.setXYZ(k, pigment.x, pigment.y, pigment.z)
      }
    }
  }
  g.computeVertexNormals()
  const normals = g.attributes.normal
  for (let i = 0; i < normals.count; i++) {
    if (!forearmVertices.has(i) || average.fromBufferAttribute(normals, i).lengthSq() < 1e-8) {
      const k = 3 * i
      normals.setXYZ(i, originalNormals[k], originalNormals[k + 1], originalNormals[k + 2])
    }
  }
  for (const [side, hand] of hands) {
    const palm = hand.mesh.geometry.attributes,
      row = skin[side].at(-1).indices,
      { outer, twins } = hand.wrist
    for (let i = 0; i < row.length; i++) {
      const a = outer[i], b = row[i]
      average.fromBufferAttribute(g.attributes.normal, b).add(target.fromBufferAttribute(palm.normal, a)).normalize()
      palm.normal.setXYZ(a, average.x, average.y, average.z)
      g.attributes.normal.setXYZ(b, average.x, average.y, average.z)
      if (twins.has(i)) palm.normal.setXYZ(twins.get(i), average.x, average.y, average.z)
    }
    palm.normal.needsUpdate = true
  }
  skinIndices.needsUpdate = skinWeights.needsUpdate = true
  positions.needsUpdate = colors.needsUpdate = g.attributes.normal.needsUpdate = true
  g.computeBoundingSphere()
}
