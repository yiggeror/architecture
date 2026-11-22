import * as T from 'three'

const stationPlans = new WeakMap()
export const seatBoardTop = 0.3625
const halves = [-1, 1]

// All coordinates here are ship-local. The same sweep defines the wooden handle,
// the lock on the gunwale, the two palm centres and the neighbouring thwart.
export function sweepStation(boat, side, z) {
  const length = Math.hypot(0.5, 0.42, 0.67)
  const inward = [(-side * 0.5) / length, 0.42 / length, 0.67 / length]
  const pin = [side * boat.beam * 0.455, boat.deck + 0.36, z]
  const yaw = side * Math.atan2(0.67, 0.5)
  const x = pin[0] + inward[0] * 0.7 - Math.sin(yaw) * 0.22
  const cz = z + inward[2] * 0.7 - Math.cos(yaw) * 0.22
  return { side, z, inward, pin, x, cz, yaw, grips: [0.575, 0.798], handleEnd: 0.887 }
}
export function crewFixtures(boat) {
  if (stationPlans.has(boat)) return stationPlans.get(boat)
  const { kind, length, beam, deck } = boat
  const rows = kind === 'carp' ? [-4.5, -3.15] : [kind === 'cargo' ? -length * 0.36 : -length * 0.32]
  const sweeps = rows.flatMap((z) => (kind === 'carp' ? halves : [-1]).map((s) => sweepStation(boat, s, z)))
  const seats = []
  const benches = rows.map((z) => {
    const o = sweeps.find((o) => o.z === z)
    return { x: 0, z: o.cz, w: beam * (kind === 'carp' ? 0.78 : 0.65), d: 0.31 }
  })
  const add = (x, z, w, d) => benches.push({ x, z, w, d })
  if (kind === 'music') {
    seats.push({ x: 0.03, z: 0.1, yaw: 0.2 })
    add(0.03, 0.1, 0.68, 0.35)
  }
  if (kind === 'covered') {
    seats.push({ x: 0, z: 0.12, yaw: Math.PI })
    add(0, 0.12, beam * 0.65, 0.35)
  }
  if (kind === 'pavilion') {
    for (const s of halves) {
      seats.push({ x: s * 0.59, z: s > 0 ? -0.69 : 0.74, yaw: -s * 1.48 })
      add(s * 0.59, 0.08, 0.36, 2.38)
    }
  }
  if (kind === 'open') {
    for (const z of [-0.62, 0.72, 1.85]) add(0, z, beam * 0.78, 0.34)
    seats.push({ x: 0.1, z: 0.72, yaw: Math.PI }, { x: -0.17, z: 1.85, yaw: Math.PI })
  }
  const drum =
    kind === 'music'
      ? { x: 0, y: deck + 0.51, z: length * 0.3, r: 0.29 }
      : kind === 'carp'
        ? { x: 0, y: deck + 0.56, z: 5.13, r: 0.49 }
        : null
  const plan = { sweeps, benches, seats, drum, seatY: deck + seatBoardTop }
  stationPlans.set(boat, plan)
  return plan
}
export function deckAt(boat, z) {
  // The hull is planked in 26 stations. Interpolate on its planar faces so a
  // sole at the steep end of a deck rests on the rendered top of the plank.
  const station = Math.max(0, Math.min(26, (z / boat.length + 0.5) * 26))
  const a = Math.min(25, Math.floor(station)),
    f = station - a
  const first = (a / 13 - 1) ** 4,
    next = ((a + 1) / 13 - 1) ** 4
  return boat.deck + 0.12 * (first + (next - first) * f)
}
export function placeCrew(record, shipIndex) {
  const spec = record.ship?.spec
  if (!spec || !Number.isFinite(spec.length)) return record
  const plan = crewFixtures(spec)
  const nearest = (arr, key) => arr.reduce((a, x) => (!a || key(x) < key(a) ? x : a), null)
  if (record.job === 'row') {
    const sign = spec.kind === 'carp' ? Math.sign(record.x) : -1
    const station = nearest(
      plan.sweeps.filter((q) => q.side === sign),
      (q) => Math.abs(q.cz - record.z),
    )
    record.sweep = station
    record.oar = record.ship.oars?.find((q) => q.s === sign && q.z === station.z)
    record.x = station.x
    record.z = station.cz
    record.yaw = station.yaw
  } else if (record.job === 'drum' && plan.drum) {
    record.x = 0
    record.z = plan.drum.z + plan.drum.r + 0.29
    record.yaw = Math.PI
  } else if ((record.job === 'sit' || record.job === 'lute') && plan.seats.length) {
    const p = nearest(plan.seats, (q) => Math.hypot(q.x - record.x, q.z - record.z))
    record.x = p.x
    record.z = p.z
    record.yaw = p.yaw
  }
  record.shipIndex = shipIndex
  record.y = deckAt(spec, record.z) + 0.002
  return record
}
export function strokePose(pivot, sweep, index, t) {
  const p = t * 1.73 + index * 0.77 + sweep.z * 0.09 + sweep.side * 0.13
  pivot.rotation.set(0.065 + 0.18 * Math.cos(p), sweep.side * (0.095 + 0.29 * Math.sin(p)), 0)
}
export function sweepPoint(station, distance, out = new T.Vector3()) {
  return out.fromArray(station.inward).multiplyScalar(distance)
}
