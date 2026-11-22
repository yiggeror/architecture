import { face } from './characterPropCraft.js'

// Thin shell inlay on Ye Suxian's instrument. Each point lies on the original
// faceted soundboard or concave back, so neither the image nor the pearl edge
// hovers when the instrument is seen in profile.
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
        if (patch.every(Boolean)) face(b, m.matte, tints[k], patch)
      }
  }
  const green = [0x627b6d, 0x92a28a],
    shell = [0xd1bfa6, 0xe9dfc3],
    cool = [0x8ba99f, 0xc9d5bb],
    pink = [0xc78e85, 0xdfb8aa],
    gold = [0xb3915b, 0xd3ba8c]
  // Grass orchids drift inwards from the rims, keeping the strings and the
  // plucking area free. The split tones follow each piece of cut shell.
  for (const side of [-1, 1]) {
    const a = (x, y) => [side * x, side === 1 ? y : y + 0.009],
      origin = a(0.067, 0.132)
    petal(origin, a(0.118, 0.232), -0.015 * side, 0.0013, green, false, true)
    petal(origin, a(0.122, 0.194), -0.016 * side, 0.0053, cool)
    petal(origin, a(0.079, 0.226), 0.017 * side, 0.0038, green)
    petal(a(0.086, 0.159), a(0.127, 0.202), 0.007 * side, 0.003, green)
    const f = a(0.115, 0.224)
    for (const [x, y, bow, w, tint] of [
      [0.13, 0.251, 0.003, 0.0062, shell],
      [0.104, 0.257, -0.003, 0.0054, pink],
      [0.089, 0.239, -0.003, 0.0051, shell],
      [0.135, 0.219, 0.001, 0.0045, cool],
      [0.111, 0.21, -0.002, 0.0041, pink],
    ])
      petal(f, a(x, y), side * bow, w, tint)
    petal(a(0.111, 0.222), a(0.117, 0.23), side * 0.001, 0.0033, gold)
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
}
