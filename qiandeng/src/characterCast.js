import * as T from 'three'
import { placeCrew } from './characterEquipment.js'
import { residentPose } from './reachPeople.js'

export function harbourCast(ships) {
  const list = []
  function boat(i, x, z, yaw, job, dress, size = 1) {
    const record = {
      ship: ships[i],
      x,
      z,
      y: ships[i].spec.deck + 0.015,
      yaw,
      job,
      dress,
      size,
      phase: list.length * 0.83,
    }
    placeCrew(record, i)
    list.push(record)
  }
  for (const z of [-4.48, -3.16])
    for (const s of [-1, 1]) boat(0, s * 1.08, z + 0.25, s * 0.52, 'row', s === 1 ? 0 : 2, 0.97)
  boat(0, 0.06, 6.02, Math.PI, 'drum', 1, 1.04)
  boat(0, 0.58, 3.9, -0.35, 'flute', 3, 1)
  boat(0, -0.44, -5.47, 0.86, 'lantern', 6, 1.01)
  boat(1, -0.18, -2.58, -0.52, 'row', 0)
  boat(1, 0.05, 3.01, Math.PI, 'drum', 1, 0.98)
  boat(1, 0.12, 0.1, 0.52, 'lute', 4, 0.97)
  boat(2, -0.11, -2.47, -0.38, 'row', 2)
  boat(2, 0.26, 0.03, 0.78, 'sit', 5, 0.97)
  boat(3, -0.12, -2.78, -0.46, 'row', 6)
  boat(4, -0.18, -3.56, -0.52, 'row', 2)
  boat(4, 0.45, -0.55, 2.76, 'sit', 4, 1)
  boat(4, -0.44, 0.7, -0.76, 'sit', 5, 1.04)
  boat(4, -0.16, 3.66, 1.07, 'lantern', 7, 0.97)
  boat(5, -0.17, -1.82, -0.5, 'row', 7)
  boat(5, 0.1, 0.69, Math.PI, 'sit', 6, 0.96)
  boat(5, -0.17, 1.8, Math.PI, 'sit', 4, 0.98)
  boat(6, 0, -2.42, -0.48, 'row', 2, 0.97)
  boat(6, -0.16, 0.19, -1.02, 'sit', 6, 0.95)
  // Each pair walks an elongated loop on its own stretch of raised paving.
  const streets = [
    [-1, 30.2, 12.5, 0.26, 'umbrella', 'lantern'],
    [-1, 60.1, 12.2, 2.86, 'basket', 'walk'],
    [1, 22.8, 12.4, 3.92, 'lantern', 'walk'],
    [1, 59.7, 12.7, 4.82, 'umbrella', 'basket'],
    [-1, -38.7, 11.4, 1.52, 'lantern', 'walk'],
    [1, -41.2, 11.0, 4.2, 'umbrella', 'lantern'],
    [-1, 15.3, 7.7, 4.82, 'walk', 'basket'],
  ]
  streets.forEach(([side, center, radius, phase, one, two], i) => {
    for (const [j, job] of [one, two].entries())
      list.push({
        side,
        center,
        radius,
        phase,
        number: j,
        job,
        dress: (i * 3 + j * 3 + 1) % 8,
        size: j === 0 ? 0.96 + 0.025 * (i % 4) : 0.93 + 0.025 * (i % 3),
        base: i === 6 ? 20.4 : 19.1,
        pace: 0.57 + 0.032 * (i % 3),
      })
  })
  for (const [side, z, job, dress, yaw] of [
    [-1, 38.9, 'porter', 2, 1.1],
    [1, 38.2, 'porter', 0, -1.3],
    [1, 6.9, 'lantern', 6, -1.3],
    [-1, 57.5, 'flute', 5, 1.3],
  ]) {
    list.push({ x: side * 18.45, z, y: 1.374, job, dress, yaw, size: 1, phase: z * 0.13 })
  }
  return list.map((p, id) => Object.assign(p, { appearance: id }))
}
// Both locomotion and camera entries sample precisely the route that places the actor.
export function castRoute(p, t, out) {
  if (p.streetId) return residentPose(p, t, out)
  if (p.side) {
    const a = (t * p.pace) / p.radius + p.phase,
      c = Math.cos(a),
      s = Math.sin(a)
    out.x = p.side * (p.base + 0.85 * p.number + 0.31 * c)
    out.z = p.center + p.radius * s + 0.38 * p.number
    out.y = 1.373
    out.yaw = Math.atan2(-p.side * 0.31 * s, p.radius * c)
    out.stride = Math.sin(t * (3.5 + 0.1 * p.dress) + p.phase + p.number) * Math.abs(c)
  } else {
    out.x = p.x
    out.y = p.y
    out.z = p.z
    out.yaw = p.yaw
    out.stride = 0
  }
  out.pause = 0
  return out
}
const person = new T.Object3D()
export function figurePlacement(p, at, matrix) {
  person.position.set(at.x, at.y, at.z)
  person.rotation.set(0, at.yaw, 0)
  person.scale.setScalar(p.size)
  person.updateMatrix()
  if (p.ship) matrix.multiplyMatrices(p.ship.group.matrixWorld, person.matrix)
  else matrix.copy(person.matrix)
  return matrix
}
