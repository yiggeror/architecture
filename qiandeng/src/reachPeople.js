import { reachPoint, reachTerraces } from './reachMap.js'
import { reachStreetPlan, streetSeed } from './reachWardPlan.js'
import { generator } from './mesh.js'

const duties = {
  silk: ['umbrella', 'lantern', 'basket'],
  harbor: ['carrier', 'porter', 'watch'],
  market: ['basket', 'umbrella', 'watch'],
  books: ['lantern', 'walk', 'umbrella'],
  guild: ['watch', 'lantern', 'carrier'],
  metal: ['carrier', 'lantern', 'porter'],
}
const workClothes = { watch: [8, 11], carrier: [9, 2, 7], porter: [9, 7, 5] }
export const residentLimit = 12
const visibility = 66

// Two people work the waterfront and a third walks an uphill lane. The tallest
// neighbourhoods have a lantern or watchman on their upper promenade as well.
// Their paths follow the same doorways and stair landings as the masonry.
export function reachResidents() {
  const cast = []
  const frontages = reachTerraces.filter((row) => row.row === 0)
  let upperPlaces = Math.max(0, 50 - frontages.length * 3)
  for (const [district, river] of frontages.entries()) {
    const levels = reachTerraces.filter((row) => row.group === river.group)
    const walks = [river, river, levels[1 + (district % 2)]]
    if (levels.length >= 5 && upperPlaces > 0) {
      walks.push(levels.at(-1))
      upperPlaces--
    }
    for (const [i, row] of walks.entries()) {
      const street = reachStreetPlan(row)
      const rng = generator(streetSeed(row.id + '/行旅' + i))
      const side = i < 2 ? i : (district + i) % 2
      const job =
        i === 3
          ? district % 3 === 0
            ? 'umbrella'
            : district % 3 === 1
              ? 'lantern'
              : 'watch'
          : duties[street.trade][i]
      const addresses = street.address.filter((h) => h.part === side)
      const shop = addresses.find((h) => h.sig) ?? addresses[Math.floor(addresses.length * 0.48)]
      const streetEnd = row.width / 2 - 6
      const gateSpace = Math.max(row.id === '锦浦-0' ? 4.15 : 2.4, street.laneWidth / 2 + 1.32)
      const start = side === 0 ? -streetEnd : street.lane + gateSpace
      const end = side === 0 ? street.lane - gateSpace : streetEnd
      const radius = Math.min((end - start) * 0.39, (job === 'porter' ? 4.9 : 6.7) + 3.3 * rng())
      const center = Math.max(start + radius, Math.min(end - radius, shop.x))
      const across = row.depth / 2 - 1.39
      const [x, z] = reachPoint(row, center, across)
      const colors = workClothes[job] ?? [0, 1, 2, 3, 4, 5, 6, 7, 10]
      cast.push({
        streetId: row.id,
        row,
        job,
        dayJob: job === 'watch' ? 'walk' : job,
        shopId: shop.id,
        center,
        radius,
        across,
        x,
        y: row.y + 0.004,
        z,
        yaw: row.yaw,
        cos: Math.cos(row.yaw),
        sin: Math.sin(row.yaw),
        phase: rng() * Math.PI * 2,
        pace: 0.58 + rng() * 0.24 + (job === 'watch' ? 0.16 : 0),
        dress: colors[Math.floor(rng() * colors.length)],
        size: 0.89 + rng() * 0.16,
        appearance: 47 + district * 4 + i,
        current: {},
      })
    }
  }
  return cast
}

export function residentPose(p, t, pose) {
  const angle = (t * p.pace) / p.radius + p.phase,
    s = Math.sin(angle),
    c = Math.cos(angle)
  const along = p.radius * s,
    across = 0.16 * c
  pose.x = p.x + along * p.cos + across * p.sin
  pose.z = p.z - along * p.sin + across * p.cos
  pose.y = p.y
  pose.yaw = p.yaw + Math.atan2(p.radius * c, -0.61 * s)
  const speed = Math.sqrt(c * c + ((0.16 / p.radius) * s) ** 2)
  pose.pause = 0.15 + 0.85 * (1 - Math.min(1, 2.1 * speed))
  pose.stride = Math.sin(t * (3.38 + 0.44 * p.pace) + p.phase) * speed
  return pose
}

export function nearbyResidents(cast, t, eye, out) {
  out.length = 0
  if (!eye) return out
  for (const p of cast) {
    const range = visibility + p.radius + 1
    if ((eye.x - p.x) ** 2 + (eye.y - p.y) ** 2 + (eye.z - p.z) ** 2 > range ** 2) continue
    const at = residentPose(p, t, p.current)
    p.distance2 = (eye.x - at.x) ** 2 + (eye.y - at.y - 0.9) ** 2 + (eye.z - at.z) ** 2
    if (p.distance2 <= visibility ** 2) out.push(p)
  }
  if (out.length > residentLimit) {
    out.sort((a, b) => a.distance2 - b.distance2)
    out.length = residentLimit
  }
  return out
}
