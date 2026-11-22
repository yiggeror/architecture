// Portrait pigments are drawn in the same metre coordinates as the sockets,
// brow ridges and vermilion. The whole atlas stays attached to the head UVs.
const styles = {
  silk: {
    breadth: 0.0047,
    arch: 0.0015,
    root: 0.001,
    tail: 0.001,
    brow: '#574349',
    lip: ['#9e5961', '#c37c7d', '#d99b97'],
    lid: '#995d66',
  },
  lute: {
    breadth: 0.0045,
    arch: 0.0006,
    root: 0.0002,
    tail: -0.0005,
    brow: '#58434a',
    lip: ['#975765', '#b97c88', '#d29c9d'],
    lid: '#926078',
  },
  scholar: {
    breadth: 0.0074,
    arch: 0.0018,
    root: 0.0002,
    tail: 0.0011,
    brow: '#41373a',
    lip: ['#975f60', '#b9837d', '#cc9690'],
    lid: '#83686c',
  },
  drummer: {
    breadth: 0.0082,
    arch: 0.0005,
    root: 0.0018,
    tail: 0.0004,
    brow: '#493b39',
    lip: ['#945b57', '#b37c6d', '#cd9584'],
    lid: '#8e6360',
  },
  boatman: {
    breadth: 0.0065,
    arch: 0.0003,
    root: 0.0002,
    tail: -0.0007,
    brow: '#51423b',
    lip: ['#885c52', '#ab7769', '#c8957c'],
    lid: '#90756a',
  },
  market: {
    breadth: 0.0051,
    arch: 0.001,
    root: 0.0009,
    tail: 0.0007,
    brow: '#564044',
    lip: ['#a74f58', '#c8746f', '#e39b90'],
    lid: '#a3696a',
  },
}
const TAU = 2 * Math.PI
const ageScale = (a) => 1 - Math.min(0.31, a.age * 0.36)

function stain(ctx, x, y, rx, ry, angle, pigment, strength) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(rx, ry)
  const color = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  color.addColorStop(0, pigment)
  color.addColorStop(0.54, pigment + 'a0')
  color.addColorStop(1, pigment + '00')
  ctx.globalAlpha = strength
  ctx.fillStyle = color
  ctx.fillRect(-1, -1, 2, 2)
  ctx.restore()
}

// The head of a brow is built of upright hairs. The middle turns into a
// slightly heavier plane. The line breaks back to individual hairs at its tail.
export function browInk(ctx, a, side, rng) {
  const style = styles[a.family] || styles.silk
  function shape(t) {
    const [x, baseline] = a.browLine(side, t)
    const bend = Math.exp(-(((t - 0.64) / 0.29) ** 2))
    const y = baseline + style.arch * bend - style.root * (1 - t) ** 2 + style.tail * t ** 3 - 0.00115
    const base = style.breadth * ageScale(a) * (1 + 0.1 * a.profile.face.brow)
    const width = base * (0.75 + 0.25 * Math.sin(Math.PI * t)) * (1 - 0.82 * t ** 2.15)
    return { x, y, low: y - 0.42 * width, high: y + 0.58 * width }
  }
  const first = shape(0),
    last = shape(1)
  ctx.save()
  const color = ctx.createLinearGradient(first.x, first.y, last.x, last.y)
  for (const [stop, alpha] of [
    [0, '05'],
    [0.12, '48'],
    [0.27, 'a2'],
    [0.58, 'ed'],
    [0.78, 'd2'],
    [1, '30'],
  ])
    color.addColorStop(stop, style.brow + alpha)
  ctx.fillStyle = color
  for (const [inset, opacity] of [
    [-0.28, 0.22],
    [0, 0.67],
    [0.12, 0.47],
  ]) {
    ctx.beginPath()
    for (let i = 0; i <= 48; i++) {
      const t = i / 48,
        p = shape(t),
        fade = Math.min(1, t * 12, (1 - t) * 12)
      const y = p.y + (p.high - p.y) * fade * (1 - inset)
      if (i) ctx.lineTo(p.x, y)
      else ctx.moveTo(p.x, y)
    }
    for (let i = 48; i >= 0; i--) {
      const t = i / 48,
        p = shape(t),
        fade = Math.min(1, t * 12, (1 - t) * 12)
      ctx.lineTo(p.x, p.y + (p.low - p.y) * fade * (1 - inset))
    }
    ctx.closePath()
    ctx.globalAlpha = opacity
    ctx.fill()
  }
  ctx.strokeStyle = style.brow
  ctx.lineCap = 'round'
  for (let i = 0; i < 210; i++) {
    const t = rng() ** 1.27,
      p = shape(t),
      h = p.high - p.low,
      start = p.low + rng() * h * 0.86
    const rise = h * (0.29 + rng() * 0.67) * (1 - 1.34 * t)
    const reach = (0.0007 + 0.0027 * t + rng() * 0.002) * side
    ctx.beginPath()
    ctx.moveTo(p.x, start)
    ctx.quadraticCurveTo(p.x + 0.29 * reach, start + 0.8 * rise, p.x + reach, start + rise)
    ctx.lineWidth = 0.000075 + 0.00023 * rng()
    ctx.globalAlpha = 0.24 + 0.4 * rng()
    ctx.stroke()
  }
  ctx.restore()
}

export function vermilion(ctx, a, rng) {
  const style = styles[a.family] || styles.silk
  const [dark, mid, light] = style.lip
  const left = -a.mw,
    right = a.mw
  ctx.save()
  // A soft edge and a translucent lower lip give the vermilion separate
  // volume on the upper and lower rolls. Avoid an outline around the mouth.
  for (let layer = 0; layer < 6; layer++) {
    const edge = 0.0015 * (1 - layer / 3)
    const center = a.lip(0)
    const pigment = ctx.createLinearGradient(0, center.lower, 0, center.upper)
    for (const [stop, color] of [
      [0, mid],
      [0.27, light],
      [0.43, mid],
      [0.56, dark],
      [0.81, mid],
      [1, mid],
    ])
      pigment.addColorStop(stop, color)
    ctx.fillStyle = pigment
    ctx.beginPath()
    for (let i = 0; i <= 80; i++) {
      const x = left + ((right - left) * i) / 80,
        l = a.lip(x)
      const y = l.upper + edge * Math.sqrt(l.shape)
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    }
    for (let i = 80; i >= 0; i--) {
      const x = left + ((right - left) * i) / 80,
        l = a.lip(x)
      ctx.lineTo(x, l.lower - edge * Math.sqrt(l.shape))
    }
    ctx.closePath()
    ctx.globalAlpha = 0.36 * ageScale(a)
    ctx.fill()
  }
  // The line of contact is deepest in the inner two thirds. White-roll and
  // lip glints narrow at the edges instead of stretching across both corners.
  for (let i = 1; i < 78; i++) {
    const u = i / 39 - 1,
      x = u * a.mw,
      next = x + a.mw / 39
    const l = a.lip(x),
      n = a.lip(next),
      weight = Math.sqrt(l.shape)
    ctx.beginPath()
    ctx.moveTo(x, l.seam)
    ctx.lineTo(next, n.seam)
    ctx.lineWidth = 0.00025 + 0.00065 * weight
    ctx.strokeStyle = dark
    ctx.globalAlpha = 0.48 + 0.36 * weight
    ctx.stroke()
  }
  for (let i = 0; i < 50; i++) {
    const x = (2 * rng() - 1) * a.mw * 0.9,
      l = a.lip(x)
    const y = l.seam - (l.seam - l.lower) * (0.38 + 0.37 * rng())
    stain(
      ctx,
      x,
      y,
      0.00016 + rng() * 0.00024,
      0.00035 + rng() * 0.00038,
      0.24,
      l.shape > 0.4 ? '#f1c2b8' : light,
      0.22,
    )
  }
  stain(ctx, -0.006, a.mouthY - 0.003, 0.0063, 0.00105, 0.08, '#edbcb6', 0.26)
  stain(ctx, 0.003, a.mouthY - 0.0037, 0.0039, 0.0007, -0.05, '#edbcb6', 0.19)
  for (const s of [-1, 1]) {
    const edge = a.lip(s * a.mw)
    stain(ctx, s * a.mw, edge.seam, 0.00125, 0.00066, s * 0.13, dark, 0.24)
    const peak = a.lip(s * a.mw * 0.28)
    stain(ctx, s * a.mw * 0.28, peak.upper + 0.0005, 0.0022, 0.00072, s * -0.29, '#f5d2bd', 0.36)
  }
  ctx.restore()
}

export function orbitalWash(ctx, a, side) {
  const style = styles[a.family] || styles.silk
  const strong = ['scholar', 'drummer', 'boatman'].includes(a.family)
  const corner = a.orbit(side, 0.76),
    lower = a.orbit(side, 0.26)
  const strength = (strong ? 0.51 : 0.82) * ageScale(a)
  stain(ctx, corner.x, corner.y + 0.0009, 0.011, 0.0064, side * 0.4, style.lid, 0.46 * strength)
  stain(ctx, side * (a.ec + 0.0025), a.ey + 0.0073, 0.0175, 0.0067, side * 0.15, style.lid, 0.38 * strength)
  stain(ctx, lower.x, lower.bottom - 0.0013, 0.012, 0.0022, side * 0.03, style.lid, 0.29 * strength)
  stain(
    ctx,
    side * 0.0495,
    a.ey - 0.018,
    0.034,
    0.02,
    side * 0.27,
    strong ? '#ad7871' : '#c98491',
    strong ? 0.07 : 0.16,
  )
  if (a.profile.id === 47 && side < 0) {
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(-0.051, a.ey - 0.019, 0.00051, 0.00041, -0.23, 0, TAU)
    ctx.fillStyle = '#775451'
    ctx.globalAlpha = 0.74
    ctx.fill()
    ctx.restore()
  }
}
