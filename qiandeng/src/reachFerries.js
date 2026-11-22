import * as T from 'three'
import { Mason } from './mesh.js'
import { lantern } from './kit.js'
import { boatDistance } from './fleetDistance.js'
import { buildVessel } from './fleetBoats.js'
import { protectPassengers } from './fleetContact.js'
import { sweptBox } from './procession.js'

const level = -16
const courses = [
  // Boats turn in broad reaches below the silk quays and beside the northern palace steps.
  [
    [-55, 148],
    [-33, 126],
    [-2, 117],
    [30, 121],
    [39, 130],
    [23, 142],
    [-13, 153],
    [-46, 160],
  ],
  [
    [-12, -229],
    [3, -235],
    [19, -258],
    [23, -285],
    [21, -303],
    [11, -298],
    [3, -276],
    [-12, -250],
  ],
]
const lines = courses.map((stations) => {
  const line = new T.CatmullRomCurve3(
    stations.map(([x, z]) => new T.Vector3(x, level, z)),
    true
  )
  line.arcLengthDivisions = 1200
  return line
})
export const reachBoats = [
  { name: '松江粮行', kind: 'cargo', length: 12.2, beam: 2.72, deck: 0.7, course: 0, offset: 0.03 },
  { name: '缬绸夜渡', kind: 'pavilion', length: 9.3, beam: 2.54, deck: 0.67, course: 0, offset: 0.52 },
  { name: '桂浦茶运', kind: 'cargo', length: 10.9, beam: 2.56, deck: 0.64, course: 1, offset: 0.1 },
  { name: '春和盐舶', kind: 'cargo', length: 12.6, beam: 2.73, deck: 0.69, course: 1, offset: 0.57 },
]
export function reachBoatPose(spec, time, position, tangent) {
  const line = lines[spec.course]
  const u = T.MathUtils.euclideanModulo(spec.offset + (time * 1.48) / line.getLength(), 1)
  line.getPointAt(u, position)
  line.getTangentAt(u, tangent)
}

// The sail is laced to six bamboo battens. Its belly and stitched panels have a
// real depth when seen edge on, as do the halyards and the painted running mast.
function rig(b, m, ship, id) {
  const d = ship.spec.deck,
    height = id === 3 ? 6.7 : 5.9,
    breadth = id === 0 ? 3.52 : 3.04
  b.tube(m.wood, [0, d, 1.6], [0, d + height + 0.45, 1.44], 0.105, 0.061, 8)
  ship.boxes.push([-0.12, d, 1.3, 0.12, d + height + 0.44, 1.71])
  for (const side of [-1, 1])
    b.beam(m.rope, [0, d + height + 0.11, 1.44], [side * 1.11, d + 0.18, -2.88], 0.026, 0.026)
  function sail(s, h) {
    const edge = (1 - 0.4 * h) * breadth
    return [
      s * edge - 0.48 + 0.48 * h,
      d + 0.83 + h * (height - 0.93) + s * (0.62 + 0.41 * h),
      1.61 - 0.8 * s + 0.39 * Math.sin(Math.PI * h) * Math.sin(Math.PI * s),
    ]
  }
  const cloth = id === 0 ? m.reed : id === 2 ? m.wine : m.reed
  for (let j = 0; j < 6; j++) {
    const lo = j / 6,
      hi = (j + 1) / 6
    for (let i = 0; i < 5; i++) {
      const a = i / 5,
        c = (i + 1) / 5
      const panel = [sail(a, lo), sail(c, lo), sail(c, hi), sail(a, hi)]
      b.face(cloth, panel, 0.85 + (0.1 * ((j + i) % 3)) / 2)
      const min = [0, 1, 2].map((axis) => Math.min(...panel.map((v) => v[axis])) - 0.018)
      const max = [0, 1, 2].map((axis) => Math.max(...panel.map((v) => v[axis])) + 0.018)
      ship.boxes.push([...min, ...max])
      if (j === 5) b.beam(m.wood, sail(a, hi), sail(c, hi), 0.047, 0.057)
      b.beam(m.reed, sail(a, lo), sail(c, lo), 0.044, 0.056)
    }
  }
}
function ripples(parent, spec) {
  const vertices = [],
    colors = [],
    ix = []
  for (const side of [-1, 1])
    for (let line = 0; line < 3; line++) {
      const start = vertices.length / 3
      for (let j = 0; j <= 20; j++) {
        const t = j / 20
        for (const edge of [0, 1]) {
          const w = spec.beam * 0.44 + t * (1.1 + line * 1.42) + Math.sin(t * 8.1 + line * 0.61) * 0.09
          vertices.push(
            side * (w + edge * (0.08 + 0.18 * t)),
            -0.015,
            -spec.length * 0.34 - t * (8 + line * 1.5)
          )
          colors.push(0.53, 0.67, 0.7, (0.26 - line * 0.045) * Math.sin(t * Math.PI) ** 0.57)
        }
        if (j) {
          const a = start + j * 2
          ix.push(a - 2, a - 1, a, a, a - 1, a + 1)
        }
      }
    }
  const geo = new T.BufferGeometry()
  geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
  geo.setAttribute('color', new T.Float32BufferAttribute(colors, 4))
  geo.setIndex(ix)
  const mat = new T.MeshBasicMaterial({
    vertexColors: true,
    side: T.DoubleSide,
    transparent: true,
    depthWrite: false,
  })
  const wake = new T.Mesh(geo, mat)
  wake.renderOrder = 4
  parent.add(wake)
  return wake
}
export function reachFerries(scene, m, world) {
  const ships = reachBoats.map((spec, i) => {
    const vessel = buildVessel(scene, m, spec)
    const ship = {
      ...vessel,
      spec,
      inverse: new T.Matrix4(),
      previousInverse: new T.Matrix4(),
      top: spec.kind === 'cargo' ? 8.5 : 4.6,
      lantern: world.movingLamp(0, level, 0, 0xffae60, 14, 9),
    }
    const b = new Mason(ship.group)
    if (spec.kind === 'cargo') rig(b, m, ship, i)
    const z = -spec.length * 0.31
    b.tube(m.wood, [-0.66, spec.deck, z], [-0.66, spec.deck + 2.24, z], 0.047, 0.042, 6)
    b.beam(m.bronze, [-0.66, spec.deck + 2.2, z], [0.11, spec.deck + 2.2, z], 0.051)
    lantern(b, m, 0.05, spec.deck + 1.83, z, 0.215, 0.54, i === 2 ? 'red' : 'amber')
    b.finish()
    ship.wake = ripples(ship.group, spec)
    ship.wick = new T.Vector3(0.05, spec.deck + 1.83, z)
    return ship
  })
  const detail = boatDistance(ships, m, true)
  world.rainShips = [...(world.rainShips || []), ...ships]
  const protect = protectPassengers(ships),
    a = new T.Vector3(),
    c = new T.Vector3(),
    tangent = new T.Vector3()
  let last = NaN,
    frame = 0,
    continuous = false
  function update(t, day, camera) {
    continuous = t > last && t - last < 1.5
    last = t
    frame++
    for (const [i, s] of ships.entries()) {
      const g = s.group
      if (continuous) s.previousInverse.copy(s.inverse)
      reachBoatPose(s.spec, t, g.position, tangent)
      g.position.y += 0.027 * Math.sin(t * 1.5 + i)
      g.rotation.set(
        0.006 * Math.sin(t + i),
        Math.atan2(tangent.x, tangent.z),
        0.012 * Math.sin(t * 1.04 + i),
        'YXZ'
      )
      g.visible = !camera || g.position.distanceToSquared(camera.position) < 430 ** 2
      const wake = s.wake
      wake.scale.set(1 + 0.03 * Math.sin(t * 1.1 + i), 1, 0.96 + 0.075 * Math.sin(t * 0.7 + i))
      wake.position.y = 0.049 + 0.012 * Math.sin(t * 1.51 + i)
      for (const o of s.oars) {
        o.pivot.rotation.y = o.s * (0.11 + 0.23 * Math.sin(t * 1.7 + o.z * 0.08 + i))
        o.pivot.rotation.x = 0.07 + 0.17 * Math.cos(t * 1.7 + o.z * 0.08 + i)
      }
      g.updateMatrixWorld()
      s.inverse.copy(g.matrixWorld).invert()
      s.lantern.position.copy(s.wick).applyMatrix4(g.matrixWorld)
      s.lantern.strength = day ? 0.015 : 1
    }
    detail(camera)
  }
  function block(from, to, r) {
    if (Math.min(from.y, to.y) > -7 || Math.max(from.y, to.y) < -17) return false
    for (const s of ships) {
      const p = s.group.position,
        far = s.spec.length * 0.61 + r
      if (
        Math.min(from.x, to.x) > p.x + far ||
        Math.max(from.x, to.x) < p.x - far ||
        Math.min(from.z, to.z) > p.z + far ||
        Math.max(from.z, to.z) < p.z - far
      )
        continue
      a.copy(from).applyMatrix4(s.inverse)
      c.copy(to).applyMatrix4(s.inverse)
      if (s.boxes.some((box) => sweptBox(a, c, box, r))) return true
    }
    return false
  }
  update(0, false)
  return { update, block, protect: (eye, clearance) => protect(eye, clearance, frame, continuous) }
}
