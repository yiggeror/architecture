import * as T from 'three'
import { face } from './characterPropCraft.js'

// Thin shell inlay on Ye Suxian's instrument. Each point lies on the original
// faceted soundboard or concave back, so neither the image nor the pearl edge
// hovers when the instrument is seen in profile.
const pearlFinish = new T.MeshPhysicalMaterial({
  name: '螺钿薄片',
  vertexColors: true,
  side: T.DoubleSide,
  roughness: 0.34,
  metalness: 0.12,
  iridescence: 0.32,
  iridescenceIOR: 1.33,
  iridescenceThicknessRange: [110, 320],
  clearcoat: 0.2,
  clearcoatRoughness: 0.35,
})
export function pipaInlay(b, m, at, rows, segments) {
  const panels = [[], []]
  for (let j = 1; j < rows; j++)
    for (let i = 0; i < segments; i++) {
      const front = i < segments / 2,
        a = at(j - 1, i, front),
        c = at(j, i + 1, front),
        side = front ? 0 : 1
      panels[side].push([a, at(j - 1, i + 1, front), c], [a, c, at(j, i, front)])
    }
  function onPanel(x, y, back) {
    for (const [a, b, c] of panels[back ? 1 : 0]) {
      const abx = b[0] - a[0],
        aby = b[1] - a[1],
        acx = c[0] - a[0],
        acy = c[1] - a[1],
        area = abx * acy - aby * acx
      if (Math.abs(area) < 1e-10) continue
      const u = ((x - a[0]) * acy - (y - a[1]) * acx) / area,
        v = (abx * (y - a[1]) - aby * (x - a[0])) / area
      if (u >= -0.00001 && v >= -0.00001 && u + v <= 1.00001)
        return [x, y, a[2] + u * (b[2] - a[2]) + v * (c[2] - a[2]) + (back ? -0.00035 : 0.00035)]
    }
    return null
  }
  function petal(a, c, bow, width, tints, back = false, taper = false) {
    const dx = c[0] - a[0],
      dy = c[1] - a[1],
      length = Math.hypot(dx, dy),
      nx = -dy / length,
      ny = dx / length
    const cells = []
    for (let j = 0; j <= 12; j++) {
      const t = j / 12,
        curve = 4 * t * (1 - t) * bow,
        mid = [a[0] + t * dx + nx * curve, a[1] + t * dy + ny * curve],
        w = width * (taper ? 0.31 + 0.69 * (1 - t) : Math.sin(Math.PI * t ** 0.71) ** 0.8),
        x = mid[0],
        y = mid[1]
      cells.push([
        onPanel(x - nx * w, y - ny * w, back),
        onPanel(x, y, back),
        onPanel(x + nx * w, y + ny * w, back),
      ])
    }
    for (let i = 1; i < cells.length; i++)
      for (let k = 0; k < 2; k++) {
        let patch = [cells[i - 1][k], cells[i][k], cells[i][k + 1], cells[i - 1][k + 1]]
        if (patch.every(Boolean)) face(b, pearlFinish, tints[k], patch)
      }
  }
  const green = [0x627b6d, 0x92a28a],
    shell = [0xd1bfa6, 0xe9dfc3],
    cool = [0x8ba99f, 0xc9d5bb],
    pink = [0xc78e85, 0xdfb8aa],
    gold = [0xb3915b, 0xd3ba8c]
  // Individual shell slips turn in the light along the bird's wing.
  // Their placement shares the local centre and tilt of the engraved design.
  function kingfisher(x, y) {
    const a = -0.19
    return [
      0.078 + 0.001 * (x * Math.cos(a) - y * Math.sin(a)),
      0.157 + 0.001 * (x * Math.sin(a) + y * Math.cos(a)),
    ]
  }
  for (const [x, y, ex, ey, bow, w, tones] of [
    [-4, 19, 2, 15, 0.6, 0.88, cool],
    [0.7, 16.2, 11.2, 7.6, -0.7, 1.03, green],
    [2.6, 16.2, 13.6, 7.1, -0.6, 0.64, cool],
    [4.8, 15.3, 14.9, 6.2, -0.35, 0.47, green],
    [12.2, 4.1, 24.5, -6.1, 0.35, 0.88, cool],
    [-8.6, 17.1, -4.4, 17.7, -0.22, 0.63, shell],
  ])
    petal(kingfisher(x, y), kingfisher(ex, ey), bow * 0.001, w * 0.001, tones)
  // A fragment of shell in each flower catches the grazing boat lantern.
  for (const [x, y, r, a] of [
    [0.089, 0.204, 0.0048, 0.37],
    [0.097, 0.199, 0.0057, 1.7],
    [0.111, 0.193, 0.0044, 1.24],
    [0.142, 0.157, 0.0055, 1.6],
    [0.134, 0.136, 0.0045, 1],
    [0.064, 0.163, 0.004, 1.4],
  ]) {
    const axis = a + 1.2
    petal([x, y], [x - r * 0.88 * Math.sin(axis), y + r * 0.88 * Math.cos(axis)], 0.00032, r * 0.23, shell)
  }
  // A magpie turns its head among two long leaves on the lacquered back.
  const bird = [0.009, 0.239]
  petal([-0.087, 0.126], [0.074, 0.287], -0.026, 0.0015, gold, true, true)
  petal([-0.058, 0.151], [-0.108, 0.235], 0.019, 0.009, cool, true)
  petal([-0.041, 0.179], [0.067, 0.203], 0.035, 0.0072, cool, true)
  petal([0.038, 0.249], [0.018, 0.317], 0.008, 0.0051, green, true)
  petal([0.075, 0.297], [0.094, 0.314], -0.002, 0.0048, shell, true)
  petal([-0.064, 0.169], bird, -0.016, 0.0085, cool, true)
  petal([-0.051, 0.158], [0.021, 0.241], -0.018, 0.0041, shell, true)
  petal([-0.009, 0.223], [0.04, 0.27], -0.009, 0.0115, shell, true)
  petal([-0.021, 0.211], [0.03, 0.253], -0.007, 0.0073, cool, true)
  petal([0.029, 0.259], [0.043, 0.278], -0.002, 0.0088, pink, true)
  petal([0.041, 0.273], [0.06, 0.269], 0.001, 0.0025, gold, true)
  petal([-0.012, 0.215], [0.027, 0.249], -0.005, 0.00135, shell, true)
  petal([-0.026, 0.2], [0.017, 0.236], -0.006, 0.0012, green, true)
  petal([-0.038, 0.189], [0.011, 0.23], -0.006, 0.00087, gold, true)
  petal([0.037, 0.27], [0.042, 0.272], 0.0001, 0.0012, green, true)
}
