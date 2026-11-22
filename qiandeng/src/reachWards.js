import * as T from 'three'
import { Mason } from './mesh.js'
import { reachTerraces } from './reachMap.js'
import { reachStreetPlan } from './reachWardPlan.js'
import { reachMaterials } from './reachWardArt.js'
import { frameHouse } from './reachWardFrame.js'
import { streetFront, inside, hangDetailAtDistance } from './reachWardLife.js'
import { bridgeGallery } from './reachWardBridges.js'
export const reachStreets = reachTerraces.map(reachStreetPlan)
export function reachWards(b, m, world) {
  reachMaterials(m)
  for (const row of reachStreets) {
    const t = row.terrace,
      block = new Mason(b.scene),
      workshop = new T.Scene(),
      furnish = new Mason(workshop)
    block.at(t.x, t.y, t.z, t.yaw, () => {
      for (const h of row.address)
        block.at(h.x, 0, h.z, 0, () => {
          frameHouse(block, m, h)
          streetFront(block, m, h, world)
        })
      bridgeGallery(block, m, row, world)
    })
    block.finish()
    furnish.at(t.x, t.y, t.z, t.yaw, () => {
      for (const h of row.address) furnish.at(h.x, 0, h.z, 0, () => inside(furnish, m, h))
    })
    furnish.finish()
    for (const mesh of [...workshop.children]) hangDetailAtDistance(b.scene, mesh, 105 + t.width * 0.4)
  }
}
