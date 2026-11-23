// The ink and illumination plates share these silhouettes. A closed shutter
// can catch moonlight while the room behind its adjacent paper pane glows.
const palettes = [
  ['#9f653c', '#392c2a', '#d5a764'],
  ['#96704a', '#32322f', '#c6ad80'],
  ['#97513a', '#3d2b2c', '#cf8f65'],
  ['#9d8061', '#343737', '#d8bb85'],
]
function stroke(g, x, y, X, Y, w, c) {
  g.strokeStyle = c
  g.lineWidth = w
  g.beginPath()
  g.moveTo(x, y)
  g.lineTo(X, Y)
  g.stroke()
}
function fill(g, x, y, w, h, c) {
  g.fillStyle = c
  g.fillRect(x, y, w, h)
}
function lamp(g, x, y, r, bright, standing = false, crimson = false) {
  const ink = bright ? '#49321f' : '#5a4938'
  const silk = g.createRadialGradient(x - r * 0.13, y + r * 0.18, 0.3, x, y, r * 1.23)
  silk.addColorStop(0, bright ? '#fff3bc' : '#f3d29a')
  silk.addColorStop(0.55, crimson ? '#f49b59' : '#ffd18b')
  silk.addColorStop(1, crimson ? '#9c462f' : '#a57847')
  g.fillStyle = silk
  g.beginPath()
  g.moveTo(x - r * 0.48, y - r * 0.94)
  g.quadraticCurveTo(x - r * 1.02, y - r * 0.35, x - r * 0.77, y + r * 0.45)
  g.quadraticCurveTo(x - r * 0.72, y + r * 0.73, x - r * 0.43, y + r * 0.88)
  g.lineTo(x + r * 0.43, y + r * 0.88)
  g.quadraticCurveTo(x + r * 0.98, y + r * 0.62, x + r * 0.85, y - r * 0.25)
  g.quadraticCurveTo(x + r * 0.72, y - r * 0.76, x + r * 0.48, y - r * 0.94)
  g.closePath()
  g.fill()
  for (const dx of [-0.42, 0.42])
    stroke(g, x + r * dx, y - r * 0.77, x + r * dx * 1.15, y + r * 0.75, 0.65, 'rgba(113,75,40,.63)')
  stroke(g, x - r * 0.58, y - r * 0.91, x + r * 0.58, y - r * 0.91, 1.7, ink)
  stroke(g, x - r * 0.54, y + r * 0.86, x + r * 0.54, y + r * 0.86, 1.8, ink)
  if (standing) {
    stroke(g, x, y + r * 0.9, x, y + r * 1.55, 1.8, ink)
    stroke(g, x - r * 0.68, y + r * 1.58, x + r * 0.68, y + r * 1.58, 2, ink)
    stroke(g, x - r * 2.7, y + r * 1.81, x + r * 2.1, y + r * 1.81, 2.2, ink)
  } else {
    stroke(g, x, y - r * 3.5, x, y - r * 0.99, 1.45, ink)
    stroke(g, x, y + r * 0.91, x + r * 0.09, y + r * 1.58, 1.15, ink)
  }
}
function aperture(g, kind, longCurtain, isGlow) {
  const k = kind % 4,
    pal = palettes[k],
    wall = isGlow ? '#050403' : ['#b9a790', '#a7a58f', '#ad8e77', '#7c8279'][k]
  fill(g, 0, 0, 128, 128, wall)
  let x = 8,
    y = 12,
    w = 112,
    h = 85
  if (kind >= 72 && kind < 76) {
    x = 7
    y = 22
    w = 114
    h = 40
  }
  if (kind >= 76 && kind < 80) {
    x = 22
    y = 15
    w = 84
    h = 81
  }
  if (kind >= 84 && kind < 88) {
    x = 8
    y = 8
    w = 112
    h = 102
  }
  const ring = (color, outer = false) => {
    g.fillStyle = color
    g.beginPath()
    if (kind >= 76 && kind < 80) {
      if (k % 2 === 0)
        g.ellipse(x + w / 2, y + h / 2, w / 2 + (outer ? 3 : 0), h / 2 + (outer ? 3 : 0), 0, 0, 2 * Math.PI)
      else {
        const q = outer ? 3 : 0
        for (let j = 0; j < 8; j++) {
          const a = Math.PI * (j / 4 + 0.125)
          const X = x + w / 2 + (w / 2 + q) * Math.cos(a),
            Y = y + h / 2 + (h / 2 + q) * Math.sin(a)
          j ? g.lineTo(X, Y) : g.moveTo(X, Y)
        }
        g.closePath()
      }
    } else {
      g.rect(x - (outer ? 3 : 0), y - (outer ? 3 : 0), w + (outer ? 6 : 0), h + (outer ? 6 : 0))
    }
    g.fill()
  }
  ring(isGlow ? '#130d08' : '#4b3a31', true)
  ring('#302d28')
  g.save()
  g.clip()
  const quiet = kind < 68 || (kind >= 76 && kind < 80),
    closed = kind >= 84,
    warm = isGlow
      ? closed
        ? ['#7d502e', '#242421', '#744d30', '#2b2924'][k]
        : quiet
          ? ['#d6995d', '#645641', '#b4764c', '#dfad77'][k]
          : ['#ffdca2', '#ffc981', '#ffbf78', '#ffe6b1'][k]
      : quiet
        ? pal[0]
        : closed
          ? pal[1]
          : pal[2]
  const dark = isGlow ? '#090807' : pal[1],
    cx = x + w * [0.27, 0.73, 0.38, 0.64][k],
    cy = y + h * [0.34, 0.46, 0.55, 0.4][k],
    lit = g.createRadialGradient(cx, cy, 1, cx, cy, w * 0.72)
  lit.addColorStop(0, warm)
  lit.addColorStop(
    0.51,
    isGlow
      ? kind >= 68 && kind < 72
        ? '#9f6d41'
        : kind >= 72 && kind < 76
          ? '#906936'
          : kind >= 80 && kind < 84
            ? '#986434'
            : '#4c3321'
      : pal[0]
  )
  lit.addColorStop(1, dark)
  g.fillStyle = lit
  g.fillRect(x, y, w, h)
  const trim = isGlow ? '#090805' : '#3b302b'
  if (kind < 68 || kind >= 84) {
    // A folded leaf of the outer shutter leaves the lamp off-centre.
    const left = k % 2 === 0,
      sw = w * (kind >= 84 ? 0.62 : 0.29),
      sx = left ? x : x + w - sw
    fill(g, sx, y, sw, h, isGlow ? '#080a08' : '#554b3e')
    for (let j = 2; j < h; j += 8) stroke(g, sx, y + j, sx + sw, y + j, 2, isGlow ? '#10100b' : '#8c7655')
    const lx = left ? x + w * 0.7 : x + w * 0.27
    if (kind < 84 || k % 2 === 0) lamp(g, lx, y + h * 0.37, 5.9, isGlow, k % 2 === 1, k === 2)
    fill(g, x, y + h * 0.73, w, h * 0.09, trim)
    fill(g, x + w * 0.18, y + h * 0.75, 3, h * 0.21, trim)
    fill(g, x + w * 0.71, y + h * 0.75, 3, h * 0.21, trim)
    for (let j = 0; j < 3; j++) {
      const px = x + w * (0.17 + 0.22 * j)
      g.fillStyle = isGlow ? '#17130b' : '#514136'
      g.beginPath()
      g.ellipse(px, y + h * 0.7, 2 + k * 0.55, 4.6, 0, 0, 2 * Math.PI)
      g.fill()
    }
  } else if (kind < 72) {
    for (const v of [0.12, 0.52, 0.91]) {
      fill(g, x + w * v, y, 2.6, h, trim)
      stroke(g, x + w * v, y + 12, x + w * v + 10, y + 2, 2.4, trim)
    }
    for (const [j, v] of [0.27, 0.74].entries())
      lamp(g, x + w * v, y + h * (0.28 + (k % 2) * 0.09), j ? 5.4 : 7.7, isGlow, false, (j + k) % 3 === 1)
    fill(g, x, y + h * 0.76, w, 2.5, trim)
    for (const v of [0.12, 0.38, 0.64, 0.9]) fill(g, x + w * v, y + h * 0.76, 2.1, h * 0.21, trim)
  } else if (kind < 80) {
    if (kind < 76 || k % 2 === 0) lamp(g, cx, cy, h * 0.16, isGlow, k % 2 === 0, k === 2)
    for (let j = 0; j < 7; j++)
      stroke(g, x + (w * j) / 6, y, x + (w * j) / 6, y + h, j % 3 === 0 ? 3 : 1.8, trim)
    for (let j = 0; j < 3; j++) stroke(g, x, y + (h * (j + 1)) / 4, x + w, y + (h * (j + 1)) / 4, 1.6, trim)
  } else {
    lamp(g, cx, y + h * 0.61, 7.5, isGlow, true, k === 2)
    // Open curtains reveal the low cabinet beside the lamp.
    const shelves = cx > 64 ? x + w * 0.11 : x + w * 0.63
    for (const at of [0.65, 0.82]) {
      stroke(g, shelves, y + h * at, shelves + w * 0.22, y + h * at, 2.7, trim)
      for (let j = 0; j < 3; j++)
        fill(
          g,
          shelves + 2 + j * 5.2,
          y + h * at - 5 - (j % 2),
          3.9,
          5 + (j % 2),
          isGlow ? '#513523' : '#80644e'
        )
    }
    const hatch = isGlow ? '#352015' : '#73553c'
    for (let j = 0; j < 4; j++) stroke(g, x + (w * j) / 3, y, x + (w * j) / 3, y + h, 2.8, hatch)
    for (const v of [0.13, 0.83]) stroke(g, x, y + h * v, x + w, y + h * v, 3, hatch)
    const drop = longCurtain ? 0.48 : 0.28
    g.fillStyle = isGlow ? '#291c15' : '#856e51'
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + w, y)
    g.lineTo(x + w, y + h * drop)
    g.quadraticCurveTo(x + w * 0.72, y + h * 0.13, x + w * 0.5, y + h * (drop + 0.07))
    g.quadraticCurveTo(x + w * 0.3, y + h * 0.13, x, y + h * drop)
    g.closePath()
    g.fill()
  }
  g.restore()
  if (!isGlow) {
    fill(g, x - 4, y + h + 3, w + 8, 4, '#77644b')
    if (kind < 76 || kind >= 80) {
      for (let j = 0; j < 3; j++) {
        g.strokeStyle = '#90775c'
        g.lineWidth = 1.2
        g.strokeRect(8 + j * 39, 105, 32, 15)
      }
    }
  }
}
export function roomArt(g, slot, glow) {
  if (slot < 88) {
    aperture(g, slot, slot % 2, glow)
    return
  }
  const k = slot % 4
  if (slot < 92) {
    fill(g, 0, 0, 128, 128, glow ? '#060403' : ['#704235', '#544234', '#3c554a', '#705338'][k])
    for (let j = 0; j < 4; j++)
      for (const y of [29, 68]) {
        const x = 3 + 31 * j
        g.strokeStyle = glow ? '#332012' : '#ba9560'
        g.lineWidth = 2
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + 26, y)
        g.lineTo(x + 26, y + 24)
        g.lineTo(x + 8, y + 24)
        g.lineTo(x + 8, y + 9)
        g.lineTo(x + 19, y + 9)
        g.stroke()
      }
    return
  }
  fill(g, 0, 0, 128, 128, glow ? '#030301' : '#5d4c3f')
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 6; i++) {
      const x = 11 + i * 21 + (j % 2) * 2,
        y = 35 + j * 37
      g.fillStyle = glow ? '#0c0805' : k % 2 ? '#b0aaa0' : '#95836a'
      g.beginPath()
      g.ellipse(x, y - 7, 4 + (i % 3) * 1.5, 7 + (i % 2) * 2, 0, 0, 2 * Math.PI)
      g.fill()
      fill(g, x - 3, y - 16, 6, 3, glow ? '#0d0a06' : '#79684e')
    }
    fill(g, 0, 34 + j * 37, 128, 4, glow ? '#0e0a07' : '#947954')
  }
}
