import * as T from 'three'

// Arc-length sampling gives all hulls the same procession pace, including at
// the two turning basins. The two straight sections are surveyed to the arches.
const survey = [
  [0, -17],
  [0, -32],
  [-0.4, -46],
  [0.75, -54],
  [3.5, -59.0],
  [6.9, -60.2],
  [10.25, -57.5],
  [11.37, -50],
  [11.45, -42],
  [12.94, -32],
  [13.12, -23],
  [13.12, -18],
  [13.12, -9],
  [13.12, 1],
  [11.78, 12],
  [11.25, 21],
  [11.2, 43],
  [11.8, 63],
  [11.8, 72],
  [9.5, 78.8],
  [6.0, 80.5],
  [2.5, 78.8],
  // The inbound lane swings to the west side of the basin before the parade
  // turns towards the central arch. The returning east lane remains clear.
  [-1.2, 73.2],
  [-2.7, 63],
  [-2.98, 56.5],
  [-3.34, 51],
  [-5.8, 38],
  [-8.9, 27.7],
  [-8.0, 20.0],
  [-4.9, 13.1],
  [-1.45, 5.5],
  [-0.15, -1.2],
  [0, -8.3],
]
const path = new T.CatmullRomCurve3(
  survey.map(([x, z]) => new T.Vector3(x, 0, z)),
  true
)
path.arcLengthDivisions = 2600
const length = path.getLength(),
  count = 1600,
  speed = 1.04
const sample = path.getSpacedPoints(count)
// The first hull is turning across the near shoulder of the central arch.
const openingPoint = new T.Vector3(-7.39, 0, 18.25)
let opening = 0
for (let i = 1; i < count; i++)
  if (sample[i].distanceToSquared(openingPoint) < sample[opening].distanceToSquared(openingPoint))
    opening = i
export const route = { length, speed, duration: length / speed }
export const traffic = [
  { name: '锦鳞灯舫', kind: 'carp', length: 14.8, beam: 3.3, deck: 0.82, offset: 0 },
  { name: '琵琶花舟', kind: 'music', length: 7.95, beam: 2.04, deck: 0.62, offset: 22.8 },
  { name: '苇篷渡', kind: 'covered', length: 7.6, beam: 1.98, deck: 0.53, offset: 57.1 },
  { name: '茶行驳船', kind: 'cargo', length: 8.1, beam: 2.04, deck: 0.54, offset: 98.5 },
  { name: '绣窗客舫', kind: 'pavilion', length: 10.7, beam: 2.67, deck: 0.71, offset: 156 },
  { name: '春水摆渡', kind: 'open', length: 6.7, beam: 1.68, deck: 0.48, offset: 192.5 },
  { name: '桐油篷船', kind: 'covered', length: 7.25, beam: 1.86, deck: 0.52, offset: -37.45 },
]

export function locate(boat, seconds, out, trail = 0) {
  const index = T.MathUtils.euclideanModulo(
    opening + ((boat.offset + seconds * speed - trail) * count) / length,
    count
  )
  const i = Math.floor(index),
    u = index - i,
    a = sample[i],
    b = sample[i + 1]
  const before = sample[(i + count - 1) % count],
    after = sample[(i + 2) % count]
  const dx = (b.x - before.x) * (1 - u) + (after.x - a.x) * u
  const dz = (b.z - before.z) * (1 - u) + (after.z - a.z) * u
  const norm = Math.hypot(dx, dz)
  out.x = a.x + (b.x - a.x) * u
  out.z = a.z + (b.z - a.z) * u
  out.dx = dx / norm
  out.dz = dz / norm
  return out
}
