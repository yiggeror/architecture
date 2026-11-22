import { wardAddresses } from './wardsLayout.js'
import { wardPaint } from './wardsPaint.js'
import { houseParts, shell } from './wardsFrame.js'
import { furnishings } from './wardsTrade.js'
import { districtStreets } from './wardsStreet.js'
import { fronts } from './wardsFronts.js'
export { wardAddresses, wardRoofs } from './wardsLayout.js'
export function buildAddress(b, m, world, h) {
  b.at(h.x, 1.35, h.z, h.angle, () => {
    for (const part of houseParts(h))
      b.at(part.x, 0, part.z, 0, () => {
        shell(b, m, part.house)
        furnishings(b, m, part.house, world)
        if (!part.house.outbuilding) fronts(b, m, part.house)
      })
  })
}
export function wards(b, m, world) {
  wardPaint(m)
  for (const h of wardAddresses) buildAddress(b, m, world, h)
  districtStreets(b, m, world)
}
