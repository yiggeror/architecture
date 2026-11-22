import * as T from 'three'
import { Mason } from './mesh.js'

// Keep the silhouette, mast, hull markings and lit windows once an entire
// boat fits in a few dozen screen pixels. The original work is used on approach.
function outline(group, spec, m, sail) {
  const b = new Mason(group),
    paint = m.boatOutline,
    silk = m.boatLight
  const hull = m.darkwood.color.toArray(),
    planks = m.wood.color.toArray(),
    reed = m.reed.color.toArray(),
    tile = m.roof.color.toArray(),
    red = m.vermilion.color.toArray(),
    gilt = m.bronze.color.toArray()
  const half = spec.length / 2,
    beam = spec.beam / 2,
    deck = spec.deck
  const rail = (u, s, dip = 0) => [
    s * beam * (0.05 + 0.95 * (1 - Math.abs(u) ** 2.4) ** 0.72),
    deck + 0.35 * Math.abs(u) ** 3 - dip,
    u * half,
  ]
  for (let i = 0; i < 12; i++) {
    const a = i / 6 - 1,
      c = (i + 1) / 6 - 1
    for (const s of [-1, 1]) {
      b.face(paint, [rail(a, s), rail(c, s), rail(c, s, 0.6), rail(a, s, 0.6)], hull)
      b.face(paint, [rail(a, s, 0.36), rail(c, s, 0.36), [0, -0.35, c * half], [0, -0.35, a * half]], hull)
      b.face(paint, [rail(a, s, 0.06), rail(c, s, 0.06), rail(c, s, 0.12), rail(a, s, 0.12)], gilt)
    }
    b.face(paint, [rail(a, -1), rail(c, -1), rail(c, 1), rail(a, 1)], planks)
  }
  function cabin(w, len, h, covered) {
    const y = deck + h
    for (const x of [-w, w]) for (const z of [-len, len]) b.box(paint, x, deck + h / 2, z, 0.12, h, 0.12, red)
    b.box(paint, 0, y + 0.02, 0, 2 * w + 0.42, 0.13, 2 * len + 0.54, tile)
    const tip = covered ? 0.4 : 0.7
    for (const sign of [-1, 1])
      b.face(
        paint,
        [
          [sign * (w + 0.28), y, len + 0.3],
          [sign * (w + 0.28), y, -len - 0.3],
          [0, y + tip, -len + 0.03],
          [0, y + tip, len - 0.03],
        ],
        covered ? reed : tile
      )
    if (!covered) {
      for (const z of [-len, len]) {
        for (const side of [-1, 1]) {
          b.box(silk, side * w * 0.42, deck + h * 0.55, z, w * 0.68, h * 0.46, 0.053, [0.59, 0.35, 0.15])
          b.box(
            paint,
            side * w * 0.42,
            deck + h * 0.55,
            z + Math.sign(z) * 0.04,
            0.055,
            h * 0.46,
            0.075,
            planks
          )
        }
        b.box(paint, 0, deck + h * 0.37, z + Math.sign(z) * 0.045, w * 1.84, 0.07, 0.072, planks)
      }
      for (const x of [-w, w])
        for (let n = 0; n < 3; n++)
          b.box(silk, x, deck + h * 0.6, (n - 1) * len * 0.65, 0.055, h * 0.45, len * 0.4, [0.71, 0.38, 0.15])
    }
  }
  if (spec.kind === 'pavilion' || spec.kind === 'music') cabin(beam * 0.74, half * 0.39, 1.76, false)
  else if (spec.kind === 'covered') cabin(beam * 0.76, half * 0.43, 0.89, true)
  else if (spec.kind === 'cargo') {
    for (const z of [-1, 0, 1]) b.box(paint, 0, deck + 0.35, z, beam * 1.32, 0.72, 0.91, reed)
    if (sail) {
      b.tube(paint, [0, deck, 1.6], [0, deck + 6.4, 1.5], 0.1, 0.065, 5, planks)
      b.face(
        paint,
        [
          [-0.45, deck + 0.85, 1.62],
          [2.92, deck + 1.5, 0.91],
          [2.1, deck + 6.38, 0.88],
          [0, deck + 5.9, 1.54],
        ],
        sail === 2 ? red : reed
      )
    }
  } else if (spec.kind === 'carp') {
    // The parade fish has a wide shoulder, narrow tail and forked caudal fin.
    const z = [-3.35, -2.35, -0.48, 1.12, 2.69, 3.32],
      r = [0.21, 0.62, 1.16, 1.18, 0.73, 0.24]
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 8; i++) {
        const pt = (n, k) => [
          r[n] * Math.cos((k * Math.PI) / 4),
          deck + 2.05 + r[n] * Math.sin((k * Math.PI) / 4),
          z[n],
        ]
        b.face(
          silk,
          [pt(j, i), pt(j, i + 1), pt(j + 1, i + 1), pt(j + 1, i)],
          i === 3 || i === 4 ? [1, 0.46, 0.078] : [1, 0.11, 0.024]
        )
      }
    b.face(
      silk,
      [
        [0, deck + 2.07, -3],
        [0.15, deck + 3.22, -4.32],
        [0, deck + 2.12, -4.02],
        [-0.05, deck + 1.21, -4.1],
      ],
      [1, 0.2, 0.045]
    )
  }
  for (const z of [-half * 0.56, half * 0.55])
    b.tube(silk, [0, deck + 0.73, z], [0, deck + 1.13, z], 0.17, 0.19, 6, [1, 0.61, 0.26])
  b.finish()
}
export function boatDistance(ships, m, outer = false) {
  if (!m.boatOutline) {
    m.boatOutline = new T.MeshStandardMaterial({
      name: '远舟青木',
      vertexColors: true,
      color: 0xffffff,
      roughness: 0.73,
      side: T.DoubleSide,
    })
    m.boatLight = new T.MeshStandardMaterial({
      name: '远舟楮灯',
      vertexColors: true,
      color: 0xffefce,
      roughness: 0.68,
      emissive: 0xffac6a,
      emissiveIntensity: 1.14,
      side: T.DoubleSide,
    })
  }
  const records = ships.map((s, i) => {
    const fine = s.group.children.slice(),
      low = new T.Group()
    low.name = s.spec.name + '远影'
    outline(low, s.spec, m, outer ? i + 1 : 0)
    low.visible = false
    s.group.add(low)
    return { s, fine, low }
  })
  return (cam) => {
    if (!cam) return
    const small = cam.aspect < 0.8
    for (const { s, fine, low } of records) {
      const cutoff = s.spec.kind === 'carp' ? (small ? 88 : 118) : outer ? (small ? 38 : 54) : small ? 74 : 89
      const far = cam.position.distanceToSquared(s.group.position) > cutoff ** 2
      if (far === low.visible) continue
      low.visible = far
      for (const item of fine) item.visible = !far
    }
  }
}
