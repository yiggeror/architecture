// All dimensions are in a 128 px silk panel. The albedo and transmission
// plates use the same battens, printed motifs and opaque fittings.
const palettes = [
  ['#ffc478', '#e87537', '#a33225', '#511d1e', '#c35a3b', '#8f332a'],
  ['#ffe9ac', '#ffc26d', '#c88a40', '#684728', '#e7c288', '#aa7b50'],
  ['#ffedb4', '#f4c57b', '#b78e56', '#5a5034', '#c3c398', '#898e6b'],
]
function line(g, x, y, X, Y, width, ink) {
  g.beginPath()
  g.moveTo(x, y)
  g.lineTo(X, Y)
  g.lineWidth = width
  g.strokeStyle = ink
  g.stroke()
}
function petal(g, x, y, w, h) {
  g.beginPath()
  g.moveTo(x, y)
  g.bezierCurveTo(x - w, y - h * 0.55, x - w * 0.76, y - h * 0.76, x, y - h)
  g.bezierCurveTo(x + w * 0.76, y - h * 0.76, x + w, y - h * 0.55, x, y)
  g.stroke()
}
export function drawLampSilk(g, variant, emission) {
  const [flame, honey, dye, dusk, linen, shadow] = palettes[variant]
  const glow = g.createRadialGradient(57, 78, 2, 58, 75, 93)
  glow.addColorStop(0, emission ? flame : linen)
  glow.addColorStop(0.24, emission ? honey : linen)
  glow.addColorStop(0.64, emission ? dye : shadow)
  glow.addColorStop(1, dusk)
  g.fillStyle = glow
  g.fillRect(0, 0, 128, 128)
  // Paper fibres, the seam folded around its bamboo rib and two brocade borders.
  for (let i = 2; i < 128; i += 3) {
    line(g, 0, i, 128, i + Math.sin(i) * 0.39, 0.65, 'rgba(59,34,19,.15)')
    line(g, i, 0, i + Math.cos(i) * 0.52, 128, 0.55, 'rgba(254,232,182,.14)')
  }
  for (const x of [1, 126]) line(g, x, 0, x, 128, 5, emission ? '#57321c' : '#8f6945')
  for (const y of [6, 12, 115, 121]) line(g, 0, y, 128, y, 2.1, emission ? '#744522' : '#965f39')
  for (const x of [12, 37, 64, 91, 116]) {
    g.strokeStyle = emission ? '#a06131' : '#ba7946'
    g.lineWidth = 1.5
    petal(g, x, 29, 6, 12)
    petal(g, x, 112, 6, 12)
  }
  if (variant === 0) {
    // A quatrefoil surrounds the small plum blossom on a vermilion gauze light.
    g.save()
    g.translate(64, 65)
    g.rotate(Math.PI / 4)
    g.lineWidth = 1.8
    g.strokeStyle = emission ? '#d78740' : '#dc9a58'
    g.strokeRect(-18, -18, 36, 36)
    for (let p = 0; p < 4; p++) {
      petal(g, 0, 0, 4.4, 14)
      g.rotate(Math.PI / 2)
    }
    g.restore()
  } else if (variant === 1) {
    for (const x of [20, 107]) {
      line(g, x, 18, x, 104, 1.2, 'rgba(112,67,32,.4)')
      line(g, x, 32, x + (x < 64 ? 8 : -8), 32, 1.1, 'rgba(112,67,32,.4)')
    }
  } else {
    g.strokeStyle = 'rgba(97,75,42,.53)'
    g.lineWidth = 1.3
    for (const k of [0, 1, 2]) {
      const x = 40 + 11 * k,
        y = 87 - 13 * k
      line(g, x - 10, y + 15, x + 11, y - 9, 1.3, g.strokeStyle)
      petal(g, x, y + 6, 3.8, 12)
      petal(g, x + 9, y, 2.7, 10)
    }
  }
}

// Transmitted lamplight falls off across mulberry paper. The soft silhouettes
// lie in front of the oil dish or hanging shade and behind the wooden lattice.
export function paperLight(g, k) {
  const x = [35, 91, 46, 77, 33, 87, 62, 78][k % 8],
    y = [76, 53, 85, 66, 53, 77, 55, 81][k % 8],
    hung = k % 3 === 1,
    ivory = k % 3 === 0
  const field = g.createRadialGradient(x, y, 1, x, y, 105)
  field.addColorStop(0, ivory ? '#ffebb6' : '#ffe0a2')
  field.addColorStop(0.13, ivory ? '#ffe1a4' : '#ffba68')
  field.addColorStop(0.4, ivory ? '#e3a76a' : '#c5753d')
  field.addColorStop(0.74, ivory ? '#946745' : '#865032')
  field.addColorStop(1, '#332a26')
  g.fillStyle = field
  g.fillRect(0, 0, 128, 128)
  if (hung) {
    line(g, x, 0, x, y - 11, 1.4, 'rgba(73,49,31,.72)')
    g.fillStyle = 'rgba(255,222,147,.66)'
    g.beginPath()
    g.ellipse(x, y, 6.5, 10, 0, 0, 2 * Math.PI)
    g.fill()
    for (const Y of [y - 10, y + 10]) line(g, x - 4, Y, x + 4, Y, 2, 'rgba(99,65,34,.8)')
    line(g, x, y + 11, x + 0.6, y + 18, 1.6, 'rgba(117,69,36,.66)')
  } else {
    g.fillStyle = 'rgba(255,242,192,.68)'
    g.beginPath()
    g.moveTo(x - 1.5, y + 4)
    g.quadraticCurveTo(x - 4.5, y + 1, x + 1.6, y - 9)
    g.quadraticCurveTo(x, y - 2, x + 2.6, y + 1)
    g.quadraticCurveTo(x + 3.8, y + 5, x - 1.5, y + 4)
    g.fill()
    const metal = 'rgba(59,40,27,.74)'
    line(g, x - 6, y + 6, x + 6, y + 6, 2, metal)
    line(g, x, y + 8, x, y + 15, 2.1, metal)
    line(g, x - 4.4, y + 15, x + 4.4, y + 15, 2.4, metal)
    const tableEnd = x < 64 ? x + 14 : 127
    line(g, x < 64 ? 1 : x - 17, y + 17, tableEnd, y + 17, 3.8, 'rgba(70,45,30,.64)')
  }
  const shelf = x < 64 ? 96 : 28
  if (k % 2) {
    const dark = 'rgba(54,44,38,.52)'
    line(g, shelf, 126, shelf - 1, 89, 2.4, dark)
    line(g, shelf - 1, 100, shelf + 12, 82, 1.5, dark)
    line(g, shelf, 100, shelf - 10, 89, 1.3, dark)
    g.fillStyle = dark
    for (const [dx, dy, angle] of [
      [-9, 92, 0.8],
      [-3, 86, -0.4],
      [10, 85, 0.7],
      [14, 79, 0.32],
    ]) {
      g.beginPath()
      g.ellipse(shelf + dx, dy, 1.7, 5.3, angle, 0, Math.PI * 2)
      g.fill()
    }
  } else {
    const rail = g.createLinearGradient(0, 94, 0, 128)
    rail.addColorStop(0, 'rgba(47,33,25,0)')
    rail.addColorStop(1, 'rgba(47,33,25,.42)')
    g.fillStyle = rail
    g.fillRect(0, 94, 128, 34)
  }
}
