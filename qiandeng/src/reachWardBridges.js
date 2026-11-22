import { beam, box, panel, roof } from './reachWardFrame.js'
import { wardPlaque } from './reachWardArt.js'
export function bridgeGallery(b, m, plan, world) {
  const g = plan.bridge
  if (!g) {
    if (plan.terrace.row === 0) {
      const house = plan.address.find((h) => h.part === 1),
        x = house.x - house.width / 2 + 0.83,
        z = house.front - 0.85,
        y = house.ground + 0.26
      // The public address hangs from the corner post beside the main cut-through.
      b.at(x, 0, z, Math.PI / 2, () => {
        beam(b, m.reachDetail, 24, [-0.72, y, 0], [0.63, y, 0], 0.08, 0.1)
        for (const side of [-1, 1])
          beam(b, m.reachDetail, 27, [side * 0.49, y, 0], [side * 0.49, y - 0.22, 0], 0.041, 0.042)
        box(b, m.reachDetail, 24, 0, y - 0.46, 0, 1.24, 0.62, 0.076)
        for (const side of [-1, 1])
          b.at(0, 0, side * 0.048, side < 0 ? Math.PI : 0, () =>
            panel(b, m.reachDetail, wardPlaque(plan.terrace.group), 0, y - 0.73, 0, 1.16, 0.53, 1.03)
          )
      })
    }
    return
  }
  const w = g.rightX - g.leftX,
    x = (g.leftX + g.rightX) / 2,
    d = g.depth,
    wood = plan.style.wood,
    deck = g.level
  b.at(x, 0, g.z, 0, () => {
    const mat = m.reachFrame
    box(b, mat, 32, 0, deck - 0.105, 0, w, 0.21, d)
    for (const s of [-1, 1]) {
      const z = s * d * 0.46
      box(b, mat, wood, 0, deck - 0.22, z, w, 0.26, 0.18)
      const n = Math.max(3, Math.round(w / 1.4))
      for (let j = 0; j <= n; j++)
        box(b, mat, wood, -w * 0.48 + (j * w * 0.96) / n, deck + 0.46, z, 0.09, 0.92, 0.12)
      for (const y of [0.21, 0.87]) box(b, mat, wood, 0, deck + y, z, w, 0.095, 0.14)
      if (g.covered) {
        for (const q of [-1, 1]) box(b, mat, wood, q * (w / 2 - 0.36), deck + 1.15, z, 0.155, 2.3, 0.16)
        panel(b, m.reachDetail, 88 + (plan.seed % 4), 0, deck + 1.86, z, w - 0.48, 0.34, 0.9)
      }
    }
    if (g.covered) {
      const width = Math.min(2.72, w * 0.56)
      box(b, m.reachDetail, 24, 0, deck + 1.91, d * 0.48, width + 0.14, 0.56, 0.12)
      panel(
        b,
        m.reachDetail,
        wardPlaque(plan.terrace.group),
        0,
        deck + 1.68,
        d * 0.48 + 0.065,
        width,
        0.48,
        1.04
      )
    }
    if (g.covered) roof(b, m, w - 0.18, d + 0.55, deck + 2.31, 0.77, 0.2, 0.21, plan.style, true)
    for (const s of [-1, 1]) {
      beam(
        b,
        mat,
        wood,
        [s * (w / 2 - 0.23), deck - 0.13, 0.42 * d],
        [s * (w / 2 - 1.1), deck - 0.78, 0.42 * d],
        0.16,
        0.13
      )
      if (g.covered) {
        box(
          b,
          m.reachLights,
          plan.trade === 'silk' ? 37 : 36,
          s * (w / 2 - 0.78),
          deck + 1.69,
          d * 0.5,
          0.24,
          0.41,
          0.24,
          0.95
        )
      }
    }
    if (g.covered) world?.addLightAt?.(b, 0, deck + 1.67, d * 0.51, plan.style.glow, 14, 7)
  })
}
