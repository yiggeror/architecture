import { reachFace } from './reachWardArt.js'

// Bronze rain cap, translucent keyed silk panels, lower collar and tassel.
// Each facet keeps one complete panel all the way between the two fittings.
export function streetLantern(b, m, x, y, z, r, h, red = false, square = false, tint = 1, distant = false) {
  const n = square ? 4 : 6,
    a0 = square ? Math.PI / 4 : Math.PI / 6
  const at = (j, R, H) => {
    const a = a0 + (2 * Math.PI * j) / n
    return [x + r * R * Math.cos(a), y + h * H, z + r * R * Math.sin(a)]
  }
  if (distant) {
    // At the distant tower switch the complete silk is one to three pixels.
    // Its coloured envelope and dark cap take twelve triangles in this LOD.
    for (let j = 0; j < 4; j++) {
      reachFace(
        b,
        m.reachLights,
        red ? 37 : 36,
        [at(j, 0.72, -0.43), at(j, 0.96, 0.31), at(j + 1, 0.96, 0.31), at(j + 1, 0.72, -0.43)],
        tint
      )
      reachFace(b, m.reachDetail, 117, [at(j, 1.09, 0.3), [x, y + 0.55 * h, z], at(j + 1, 1.09, 0.3)], 0.67)
    }
    return
  }
  const profile = red
    ? [
        [0.57, -0.46],
        [0.98, -0.28],
        [1, 0.17],
        [0.59, 0.42],
      ]
    : [
        [0.68, -0.46],
        [0.94, -0.3],
        [0.94, 0.29],
        [0.73, 0.43],
      ]
  for (let j = 0; j < n; j++) {
    for (let k = 1; k < profile.length; k++) {
      const [R, H] = profile[k - 1],
        [r1, h1] = profile[k]
      reachFace(
        b,
        m.reachLights,
        red ? 37 : 36,
        [at(j, R, H), at(j, r1, h1), at(j + 1, r1, h1), at(j + 1, R, H)],
        tint,
        [
          [0, 0.5 + H],
          [0, 0.5 + h1],
          [1, 0.5 + h1],
          [1, 0.5 + H],
        ]
      )
    }
    const ornate = r >= 0.28
    if (ornate) {
      // Pierced patinated copper corner stiles set off the bright silk. Their
      // proud feet and flare catch a thin line on the gilded drip edge.
      const lip = (k, dx, R, H) => {
        const a = a0 + (2 * Math.PI * k) / n + dx
        return [x + r * R * Math.cos(a), y + h * H, z + r * R * Math.sin(a)]
      }
      const [R, H] = profile[1],
        [r1, h1] = profile[2]
      reachFace(
        b,
        m.reachDetail,
        117,
        [
          lip(j, -0.058, R + 0.018, H),
          lip(j, -0.058, r1 + 0.018, h1),
          lip(j, 0.058, r1 + 0.018, h1),
          lip(j, 0.058, R + 0.018, H),
        ],
        0.62
      )
      reachFace(
        b,
        m.reachDetail,
        116,
        [at(j, 1.13, 0.38), at(j, 1.13, 0.426), at(j + 1, 1.13, 0.426), at(j + 1, 1.13, 0.38)],
        0.84
      )
    }
    const brim = ornate ? 1.13 : 1.03
    reachFace(
      b,
      m.reachDetail,
      117,
      [at(j, brim, 0.418), at(j, 0.37, 0.55), at(j + 1, 0.37, 0.55), at(j + 1, brim, 0.418)],
      0.75
    )
    reachFace(
      b,
      m.reachDetail,
      24,
      [at(j, 0.36, -0.53), at(j, 0.74, -0.44), at(j + 1, 0.74, -0.44), at(j + 1, 0.36, -0.53)],
      0.82
    )
  }
  for (const side of [-1, 1])
    reachFace(
      b,
      m.reachDetail,
      red ? 28 : 25,
      [
        [x - r * 0.08, y - h * 0.5, z + side * 0.014],
        [x + r * 0.07, y - h * 0.5, z + side * 0.014],
        [x + r * side * 0.14, y - h * 0.77, z + side * 0.054],
        [x + r * (side * 0.14 - 0.11), y - h * 0.81, z + side * 0.054],
      ],
      0.95
    )
}
