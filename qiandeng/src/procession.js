import * as T from 'three'
import { buildVessel, dockWork } from './fleetBoats.js'
import { carpSilk } from './fleetCarp.js'
import { cutPaper, pennants, waterOfferings } from './fleetOrnaments.js'
import { locate, traffic } from './fleetRoute.js'
import { wakes } from './fleetWater.js'
import { protectPassengers } from './fleetContact.js'
import { boatDistance } from './fleetDistance.js'
import { riverPeople } from './peopleRiver.js'

// Swept sphere against a local hull strake or cabin member. A boat can approach
// a hovering eye; in that case the viewer can immediately move back out.
export function sweptBox(a, b, box, r) {
  let first = 0,
    last = 1,
    inA = true,
    oldDepth = Infinity,
    newDepth = Infinity
  for (let i = 0; i < 3; i++) {
    const av = a.getComponent(i),
      bv = b.getComponent(i),
      v = bv - av,
      lo = box[i] - r,
      hi = box[i + 3] + r
    if (av < lo || av > hi) inA = false
    oldDepth = Math.min(oldDepth, av - lo, hi - av)
    newDepth = Math.min(newDepth, bv - lo, hi - bv)
    if (Math.abs(v) < 1e-8) {
      if (av < lo || av > hi) return false
      continue
    }
    const d = (lo - av) / v,
      f = (hi - av) / v
    first = Math.max(first, Math.min(d, f))
    last = Math.min(last, Math.max(d, f))
    if (first > last) return false
  }
  return !inA || newDepth > oldDepth + 0.00001
}
export function procession(scene, m, world) {
  const silk = carpSilk(),
    panels = cutPaper(m),
    docks = dockWork(scene, m)
  const ships = traffic.map((spec) => ({
    ...buildVessel(scene, m, spec, silk, panels),
    spec,
    pose: {},
    inverse: new T.Matrix4(),
    previousInverse: new T.Matrix4(),
    lamps: [],
  }))
  world.rainShips = ships
  for (const [i, offset, color, power, range] of [
    [0, [0, 2.75, 0.7], 0xff8c3a, 11.2, 11],
    [0, [0, 1.68, -4.05], 0xff9e49, 4.3, 7],
    [1, [0, 1.69, 0.08], 0xffa15d, 3.2, 6],
    [4, [0, 1.89, 0.48], 0xffa55b, 5.6, 8],
  ]) {
    const light = world.movingLamp(0, 0, 0, color, power, range)
    ships[i].lamps.push({ light, offset: new T.Vector3(...offset) })
  }
  const surface = wakes(scene, traffic),
    people = riverPeople(
      scene,
      m,
      ships,
      (group) => world.shadeCharacter?.(group),
      (x, z, y) => world.characterFloor?.(x, z, y) ?? y,
    ),
    flags = pennants(ships, m)
  const detail = boatDistance(ships, m)
  world.handLights = people.handLights
  const a = new T.Vector3(),
    b = new T.Vector3()
  const displace = protectPassengers(ships),
    lotus = waterOfferings(scene, m)
  let frame = 0,
    previousTime = null,
    continuous = false
  function update(t, day, camera) {
    continuous = previousTime !== null && t > previousTime && t - previousTime < 1.5
    previousTime = t
    frame++
    silk.emissiveIntensity = day ? 0.08 : 0.58
    for (let i = 0; i < ships.length; i++) {
      const s = ships[i],
        p = locate(s.spec, t, s.pose),
        g = s.group
      if (continuous) s.previousInverse.copy(s.inverse)
      const rock = 0.65 + s.spec.beam * 0.14
      g.position.set(p.x, 0.025 * Math.sin(t * 1.42 + i) + 0.012 * Math.sin(t * 2.07 + 0.35 * i), p.z)
      g.rotation.set(
        (0.0075 * Math.sin(t * 1.36 + i * 0.8)) / rock,
        Math.atan2(p.dx, p.dz),
        (0.012 * Math.sin(t * 1.67 + i * 0.95)) / rock,
        'YXZ',
      )
      const stroke = t * 1.73 + i * 0.77
      for (const o of s.oars) {
        const phase = stroke + o.z * 0.09 + o.s * 0.13
        o.pivot.rotation.y = o.s * (0.095 + 0.29 * Math.sin(phase))
        o.pivot.rotation.x = 0.065 + 0.18 * Math.cos(phase)
      }
      g.updateMatrixWorld()
      s.inverse.copy(g.matrixWorld).invert()
      for (const item of s.lamps) {
        item.light.position.copy(item.offset).applyMatrix4(g.matrixWorld)
        item.light.strength = day ? 0.028 : 1 + 0.035 * Math.sin(t * 3.61 + i)
      }
    }
    detail(camera)
    people(t, day, camera)
    flags(t)
    lotus(t)
    surface(t, day)
  }
  function block(from, to, radius = 0.16) {
    for (const dock of docks) if (sweptBox(from, to, dock, radius)) return true
    for (const ship of ships) {
      const g = ship.group,
        r = ship.spec.length * 0.55 + radius
      if (
        Math.max(from.x, to.x) < g.position.x - r ||
        Math.min(from.x, to.x) > g.position.x + r ||
        Math.max(from.z, to.z) < g.position.z - r ||
        Math.min(from.z, to.z) > g.position.z + r ||
        Math.max(from.y, to.y) < -0.75 - radius ||
        Math.min(from.y, to.y) > 5.1 + radius
      )
        continue
      a.copy(from).applyMatrix4(ship.inverse)
      b.copy(to).applyMatrix4(ship.inverse)
      for (const box of ship.boxes) if (sweptBox(a, b, box, radius)) return true
    }
    return false
  }
  update(0, false)
  return {
    update,
    block,
    subject: people.subject,
    protect: (eye, clearance) => displace(eye, clearance, frame, continuous),
  }
}
