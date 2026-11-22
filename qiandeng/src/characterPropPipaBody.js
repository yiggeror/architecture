import { face, piece, tau } from './characterPropCraft.js'

export const bellyRings = [
  [0, 0.023],
  [0.022, 0.096],
  [0.061, 0.147],
  [0.124, 0.17],
  [0.184, 0.174],
  [0.256, 0.154],
  [0.325, 0.116],
  [0.381, 0.073],
  [0.426, 0.039],
  [0.475, 0.022],
]
export const bellySegments = 28
export function bellyPoint(row, segment, front) {
  const a = (tau * segment) / bellySegments,
    [y, r] = bellyRings[row],
    depth = front ? 0.012 : 0.023 + 0.059 * Math.sqrt(r / 0.174)
  return [r * Math.cos(a), y, (front ? 0.017 : 0.0105) + Math.sin(a) * depth]
}

// Selectable front, back, binding and end plates are also the actual closed
// volume used to check the path of both arms and the depth of the pluck.
export function pipaBody(m) {
  const surfaces = [true, false].map((front) =>
    piece(front ? '桐木面板' : '梨腹背板', (b) => {
      const start = front ? 0 : bellySegments / 2,
        finish = start + bellySegments / 2,
        shades = front ? [0xd6af79, 0xd9b47e, 0xd7b07a, 0xddb782] : [0x754736, 0x814c34, 0x825439, 0x754d37]
      for (let j = 1; j < bellyRings.length; j++)
        for (let i = start; i < finish; i++)
          face(b, m.matte, shades[i % 4], [
            bellyPoint(j - 1, i, front),
            bellyPoint(j, i, front),
            bellyPoint(j, i + 1, front),
            bellyPoint(j - 1, i + 1, front),
          ])
    }),
  )
  const sides = piece('琴身侧沿与封口', (b) => {
    for (const s of [0, bellySegments / 2])
      for (let j = 1; j < bellyRings.length; j++) {
        const p = [
          bellyPoint(j - 1, s, false),
          bellyPoint(j, s, false),
          bellyPoint(j, s, true),
          bellyPoint(j - 1, s, true),
        ]
        face(b, m.matte, 0x654d3a, s === 0 ? p : p.reverse())
      }
    for (const j of [0, bellyRings.length - 1]) {
      const rim = []
      for (let i = 0; i <= bellySegments / 2; i++) rim.push(bellyPoint(j, i, true))
      for (let i = bellySegments / 2; i <= bellySegments; i++) rim.push(bellyPoint(j, i, false))
      face(b, m.matte, 0x6d523c, j === 0 ? rim : rim.reverse())
    }
  })
  return [...surfaces, sides]
}

// The back of the neck sits in the web of the fretting hand. Flat ivory
// crowns stop the four strings above the ebony fingerboard.
export function pipaNeck(m) {
  const levels = [
    [0.45, 0.024, 0.023, 0.011],
    [0.5, 0.0195, 0.0196, 0.0185],
    [0.65, 0.018, 0.0196, 0.0185],
    [0.676, 0.0195, 0.02, 0.0165],
    [0.693, 0.021, 0.02, 0.003],
  ]
  function neckRing([y, width, deep, centre]) {
    const ring = []
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (Math.PI * i) / 16
      const back = Math.sin(a),
        across = Math.cos(a)
      // Hand-planed soft V, with the fuller shoulder under the left thumb.
      const shoulder =
        y >= 0.5 && y <= 0.65
          ? (0.00142 + 0.041 * (y - 0.5)) * Math.exp(-(((across - 0.45) / 0.43) ** 2)) * back * back
          : 0
      ring.push([width * across, y, centre + deep * back - shoulder])
    }
    ring.push(
      [width * 0.9, y, centre + 0.005],
      [width * 0.75, y, centre + 0.0085],
      [-width * 0.75, y, centre + 0.0085],
      [-width * 0.9, y, centre + 0.005],
    )
    return ring
  }
  const neck = piece('琵琶半圆木颈', (b) => {
    const rings = levels.map(neckRing)
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < rings[j].length; i++) {
        const k = (i + 1) % rings[j].length
        face(b, m.matte, i >= 16 ? 0x4b3736 : 0x83553c, [
          rings[j - 1][i],
          rings[j][i],
          rings[j][k],
          rings[j - 1][k],
        ])
      }
    face(b, m.matte, 0x684932, rings[0])
    face(b, m.matte, 0x684932, [...rings.at(-1)].reverse())
  })
  const fingerboard = piece('乌木指板', (b) => {
    const strips = levels.slice(0, 4).map(([y, w, , z]) => [
      [w * 0.76, y, z + 0.00838],
      [w * 0.72, y, z + 0.0102],
      [-w * 0.72, y, z + 0.0102],
      [-w * 0.76, y, z + 0.00838],
    ])
    for (let j = 1; j < strips.length; j++)
      for (let i = 0; i < 4; i++) {
        const k = (i + 1) % 4
        face(b, m.matte, 0x3e302f, [strips[j - 1][i], strips[j][i], strips[j][k], strips[j - 1][k]])
      }
    face(b, m.matte, 0x3e302f, strips[0])
    face(b, m.matte, 0x3e302f, [...strips.at(-1)].reverse())
  })
  const frets = piece('指板上的竹相与象牙品', (b) => {
    for (let j = 0; j < 18; j++) {
      const y = 0.24 + 0.03 * j - 0.00042 * j * j
      if (y < 0.462) continue
      const base = y < 0.5 ? 0.0236 + ((0.0287 - 0.0236) * (y - 0.462)) / 0.038 : 0.0287
      const peak = 0.0352 - Math.max(y - 0.59, 0) * 0.021
      const cross = [
        [0.017, base - 0.0004],
        [0.016, base + 0.0013],
        [0.0109, peak],
        [-0.0109, peak],
        [-0.016, base + 0.0013],
        [-0.017, base - 0.0004],
      ]
      const low = cross.map(([x, z]) => [x, y - 0.00245, z]),
        high = cross.map(([x, z]) => [x, y + 0.00245, z])
      for (let i = 0; i < 6; i++) {
        const k = (i + 1) % 6
        face(b, m.matte, 0xecd9b3, [low[i], high[i], high[k], low[k]])
      }
      face(b, m.matte, 0xecd9b3, low)
      face(b, m.matte, 0xecd9b3, high.reverse())
    }
  })
  return [neck, fingerboard, frets]
}
