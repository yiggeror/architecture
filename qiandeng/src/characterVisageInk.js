// All positions are in the sculpt's local metres. Pigment follows the same
// arcs as the eyelid folds, vermilion rolls and mobile jaw.
const inks = {
  // brow breadth / arch / tail, hair pigment, socket, upper lip, lower lip, blood tone
  silk: [0.004, 0.0019, 0.0005, '#4b3839', '#976e6c', '#99515c', '#c06c77', '#a24f59'],
  lute: [0.0047, 0.001, 0.0008, '#59443f', '#a27669', '#a55d62', '#c57874', '#a0575c'],
  scholar: [0.0056, 0.0011, 0.0019, '#403a3d', '#817079', '#9d6c6c', '#bd807d', '#a46668'],
  drummer: [0.0067, 0.0003, -0.0003, '#4f3c35', '#9f6e5d', '#96594e', '#bc7970', '#98574e'],
  boatman: [0.0062, 0.0003, -0.0005, '#605148', '#977869', '#915e52', '#ac7968', '#945d53'],
  market: [0.0046, 0.0012, 0.0006, '#634746', '#a56669', '#ac5759', '#da8178', '#ac5155'],
}
const pigment = (a) => inks[a.family] ?? inks.silk
const soft = (x, w) => Math.exp(-((x / w) ** 2))
const limit = (x) => Math.max(0, Math.min(1, x))
function stain(ctx, x, y, rx, ry, angle, ink, strength) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(rx, ry)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  g.addColorStop(0, ink)
  g.addColorStop(0.46, ink + 'b0')
  g.addColorStop(1, ink + '00')
  ctx.globalAlpha = strength
  ctx.fillStyle = g
  ctx.fillRect(-1, -1, 2, 2)
  ctx.restore()
}
function brush(ctx, x0, y0, cx, cy, x1, y1, width, ink, alpha) {
  const dx = x1 - x0,
    dy = y1 - y0,
    length = Math.hypot(dx, dy) || 1
  const nx = (-dy * width) / length,
    ny = (dx * width) / length
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.quadraticCurveTo(cx + nx, cy + ny, x1, y1)
  ctx.quadraticCurveTo(cx - nx, cy - ny, x0, y0)
  ctx.fillStyle = ink
  ctx.globalAlpha = alpha
  ctx.fill()
}
export function browInk(ctx, a, side, random) {
  const [breadth, arch, tail, ink] = pigment(a)
  function strandBed(t) {
    const [x, y] = a.browLine(side, t)
    const middle = Math.sin(Math.PI * t)
    const h = breadth * (1 - 0.24 * a.age) * (0.44 + 0.65 * middle ** 0.66) * (1 - 0.91 * t ** 2.6)
    return [x, y + arch * soft(t - 0.61, 0.25) + tail * t - 0.002 + 0.00048 * middle, h]
  }
  ctx.save()
  // Many overlapping soft impressions give the distant shape an unbroken
  // rhythm while preserving the air between short individual root hairs.
  const maleBrow = a.family === 'scholar' || a.family === 'drummer'
  const density = maleBrow ? 0.27 : a.family === 'lute' ? 0.215 : 0.19
  for (let i = 0; i <= 34; i++) {
    const t = i / 34
    const [x, y, h] = strandBed(t)
    const strength = (0.08 + density * Math.sin(Math.PI * t) ** 0.65) * (1 - 0.22 * a.age)
    stain(ctx, x, y, 0.0038 * (1 - 0.48 * t), h * 0.83, side * (0.18 - 0.39 * t), ink, strength)
  }
  const count = a.family === 'drummer' ? 285 : a.family === 'scholar' ? 255 : 200
  for (let i = 0; i < count; i++) {
    const t = (i + random()) / count
    const [x, y, h] = strandBed(t)
    const topStream = random() < Math.max(0, t - 0.11) * 0.59
    const startY = y + (topStream ? 0.5 - random() * 0.33 : -0.48 + 0.57 * random()) * h
    const run = side * (0.00058 + 0.0036 * t + 0.00095 * random()) * (1 - 0.4 * t ** 3)
    const rise = topStream ? -h * (0.17 + 0.28 * random()) : h * (0.3 + random() * 0.83) * (1 - 1.14 * t)
    brush(
      ctx,
      x,
      startY,
      x + run * (0.18 + 0.21 * t),
      startY + rise * 0.85,
      x + run,
      startY + rise,
      0.00011 + 0.00027 * random(),
      ink,
      (0.3 + 0.51 * random()) * (1 - 0.3 * a.age)
    )
  }
  ctx.restore()
}
function lipPigment(ctx, a, upper, lower, red) {
  const m = ctx.getTransform(),
    center = a.lip(0)
  const xmin = Math.floor(m.e - (a.mw + 0.0025) * m.a),
    xmax = Math.ceil(m.e + (a.mw + 0.0025) * m.a)
  const ymin = Math.floor(m.f + m.d * (center.upper + 0.006)),
    ymax = Math.ceil(m.f + m.d * (center.lower - 0.005))
  const image = ctx.getImageData(xmin, ymin, xmax - xmin, ymax - ymin)
  const data = image.data
  const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
  const upperColor = rgb(upper),
    lowerColor = rgb(lower),
    wetColor = rgb(red),
    shadow = rgb('#764b4f')
  const mix = (v, w, f) => v + (w - v) * f
  const ease = (t) => {
    t = limit(t)
    return t * t * (3 - 2 * t)
  }
  for (let ix = 0; ix < image.width; ix++) {
    const x = (ix + xmin + 0.5 - m.e) / m.a,
      u = Math.abs(x / a.mw)
    if (u >= 1) continue
    const l = a.lip(x),
      edge = 0.0005 + 0.00085 * (1 - u) ** 0.6
    const depth = 1 - 0.45 * u ** 2
    for (let iy = 0; iy < image.height; iy++) {
      const y = (iy + ymin + 0.5 - m.f) / m.d
      const delta = y - l.seam
      const lipMargin = delta > 0 ? l.upper - y : y - l.lower
      if (lipMargin < -edge) continue
      const fill = ease((lipMargin + edge) / (edge * 2.6)) * ease((1 - u) / 0.12)
      const v = delta / (delta > 0 ? l.upper - l.seam : l.seam - l.lower)
      const damp = 0.36 * Math.exp((-v * v) / 0.1) * depth
      const line = 0.32 * soft(delta, 0.0004 + 0.00011 * (1 - u)) * depth
      const roll = delta < 0 ? 0.13 * soft(v + 0.54, 0.31) * soft(u, 0.72) : 0
      const fine = roll * (0.23 * Math.sin(x * 3333) + 0.17 * Math.sin(x * 4811 + v))
      const k = 4 * (iy * image.width + ix),
        pigment = delta >= 0 ? upperColor : lowerColor
      for (let ch = 0; ch < 3; ch++) {
        let value = mix(pigment[ch], wetColor[ch], damp)
        value = mix(value, shadow[ch], line)
        value = mix(value, [247, 203, 188][ch], roll + fine)
        data[k + ch] = mix(data[k + ch], value, fill * (0.9 - 0.16 * a.age) * (0.94 - 0.46 * u * u))
      }
    }
  }
  ctx.putImageData(image, xmin, ymin)
}
export function vermilion(ctx, a, random) {
  const [, , , , , upper, lower, red] = pigment(a)
  ctx.save()
  const scale = 1 - 0.31 * a.age
  lipPigment(ctx, a, upper, lower, red)
  for (const side of [-1, 1]) {
    const edge = a.lip(side * a.mw * 0.96)
    stain(ctx, side * a.mw * 0.96, edge.seam, 0.0017, 0.00082, side * 0.21, '#ab7b71', 0.19)
    const bow = a.lip(side * a.mw * 0.27)
    stain(ctx, side * a.mw * 0.27, bow.upper + 0.00035, 0.0033, 0.00085, -side * 0.31, '#eac1b2', 0.16)
  }
  for (let i = 0; i < 38; i++) {
    const x = (random() - 0.5) * a.mw * 1.48,
      l = a.lip(x)
    const k = l.seam - l.lower
    brush(
      ctx,
      x,
      l.lower + 0.17 * k,
      x + 0.00022,
      l.lower + 0.51 * k,
      x * 1.035,
      l.seam - 0.09 * k,
      0.00025 + random() * 0.00029,
      red,
      0.07 + random() * 0.08
    )
  }
  // A few shallow moist ridges catch the light on the central, fuller lobe.
  for (const [u, len, alpha] of [
    [-0.28, 0.17, 0.35],
    [-0.075, 0.087, 0.46],
    [0.045, 0.14, 0.24],
    [0.24, 0.082, 0.19],
  ]) {
    const x = a.mw * u,
      l = a.lip(x),
      y = l.seam - (l.seam - l.lower) * 0.55
    stain(ctx, x, y, a.mw * len, 0.00086, -0.12 * u, '#f4cabb', alpha * scale * 0.74)
  }
  ctx.restore()
}
export function orbitalWash(ctx, a, side) {
  const [, , , , ink] = pigment(a)
  const delicate = ['silk', 'lute', 'market'].includes(a.family)
  const color = delicate ? '#a06f74' : '#9e7b75'
  const edge = a.orbit(side, 1),
    medial = a.orbit(side, -1)
  // The crease falls into the orbit at each end. Its color tapers out where
  // the doubled lid meets the epicanthic fold. No continuous painted outline.
  for (let i = 0; i <= 29; i++) {
    const t = i / 29,
      u = t * 2 - 1,
      o = a.orbit(side, u)
    const bell = Math.sin(Math.PI * t)
    stain(
      ctx,
      o.x,
      o.top + 0.00315 * bell + 0.00055,
      0.0037,
      0.0026 + 0.0018 * bell,
      side * (0.36 - 0.63 * t),
      ink,
      (0.055 + 0.11 * bell) * (delicate ? 1.14 : 0.85)
    )
    if (t > 0.09) {
      stain(
        ctx,
        o.x,
        o.top + 0.0036 * bell + 0.00043,
        0.002,
        0.00058 + 0.00031 * bell,
        side * (0.39 - 0.8 * t),
        '#926469',
        (0.09 + 0.14 * bell) * (delicate ? 1.0 : 0.69)
      )
    }
    stain(
      ctx,
      o.x,
      o.bottom - 0.0021 * bell,
      0.0031,
      0.0025,
      side * (0.28 * t - 0.14),
      color,
      (0.055 + 0.082 * t) * (0.46 + 0.54 * bell)
    )
    // The middle of the lower lid catches a small reflected strip of light.
    if (t > 0.17 && t < 0.77) {
      const weight = limit(1 - Math.abs(t - 0.47) / 0.3)
      stain(ctx, o.x, o.bottom - 0.00063, 0.002, 0.00033, side * (0.19 * t - 0.09), '#ffe4d3', 0.22 * weight)
      stain(ctx, o.x, o.bottom - 0.0035 * bell, 0.0032, 0.00123, 0, '#f9d2bf', 0.11 * weight)
    }
  }

  // A tapered supratarsal crease catches shadow under the brow. It breaks
  // before the inner corner and disappears where the outer lashes turn away.
  const start = a.family === 'scholar' ? -0.57 : -0.68,
    end = a.family === 'drummer' ? 0.71 : 0.85
  for (const [width, alpha] of [
    [0.00081, 0.16],
    [0.00039, 0.35],
  ]) {
    ctx.save()
    ctx.beginPath()
    for (let i = 0; i <= 88; i++) {
      const t = i <= 44 ? i / 44 : (88 - i) / 44
      const u = start + (end - start) * t,
        o = a.orbit(side, u)
      const amplitude = Math.sin(Math.PI * t) ** 0.72
      const y = o.top + 0.00065 + (delicate ? 0.002 : 0.00155) * Math.sin((t * 0.74 + 0.13) * Math.PI)
      const yy = y + (i <= 44 ? 1 : -1) * width * amplitude
      if (i) ctx.lineTo(o.x, yy)
      else ctx.moveTo(o.x, yy)
    }
    ctx.closePath()
    ctx.fillStyle = delicate ? '#986c72' : '#94756e'
    ctx.globalAlpha = alpha * (1 + 0.13 * a.age)
    ctx.fill()
    ctx.restore()
  }
  stain(ctx, edge.x + side * 0.0018, edge.y, 0.0065, 0.0036, side * 0.46, ink, delicate ? 0.49 : 0.32)
  stain(ctx, medial.x, medial.y - 0.00043, 0.0024, 0.0015, side * 0.32, '#b86c6b', 0.52)
  stain(ctx, medial.x + side * 0.0006, medial.y - 0.00065, 0.0011, 0.00042, -side * 0.2, '#ffdfd2', 0.44)
  if (a.profile.id === 47 && side < 0) stain(ctx, -0.051, a.ey - 0.019, 0.00072, 0.00065, 0, '#6a4541', 0.85)
}
