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
    originalNormals = g.attributes.normal.array.slice(),
    forearmVertices = new Set(),
    point = new T.Vector3(),
    carriage = new T.Vector3(),
    tangent = new T.Vector3(),
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
    for (const row of skin[side]) {
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
        point.lerp(target, row.blend)
        positions.setXYZ(k, point.x, point.y, point.z)
        pigment.fromBufferAttribute(colors, k).lerp(target.fromBufferAttribute(palm.color, outer[i]), row.blend)
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
  positions.needsUpdate = colors.needsUpdate = g.attributes.normal.needsUpdate = true
  g.computeBoundingSphere()
}
