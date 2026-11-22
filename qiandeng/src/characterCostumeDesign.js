import { turn, clip, mix, step, between, tint, shade, linear, sample } from './characterGarmentMesh.js'
import { legDrape, lowerPoint, bodyRibbon, roundCollar } from './characterGarmentCut.js'
import { clothUV } from './characterGarmentPaint.js'
import { costumeUV } from './characterCostumePaint.js'
import { seatedSilk } from './characterGarmentSeat.js'
import { fitNeck, wrapCollar } from './characterGarmentCollar.js'

const colours = Object.fromEntries(
  Object.entries({
    moss: 0x3c736b,
    jade: 0x8fb4a8,
    mint: 0xb8d1bf,
    cream: 0xe9dbc5,
    gold: 0xcdb785,
    bronze: 0xad8d60,
    darkJade: 0x214e50,
    whiteJade: 0xc7d4b6,
    claret: 0x8e425c,
    plum: 0xa67888,
    rose: 0xbb7c80,
    blush: 0xf1c5b0,
    frost: 0xc7d3cc,
    ink: 0x344657,
    slate: 0x577382,
    deepBlue: 0x2b4354,
    lacquer: 0xa74339,
    cinnabar: 0xb95845,
    seal: 0x793e3d,
    military: 0x32444b,
    carbon: 0x293638,
  }).map(([name, c]) => [name, linear(c)])
)
const white = [1, 1, 1]
const designs = {
  47: {
    key: 'silk',
    garment: 'aoqun',
    name: '听梭 · 玉兰比甲与妆花马面',
    cut: { top: 0.972, stop: 0.118, sleeve: 0.0065, bolt: 1 },
    body: (c, th, y) => {
      const angle = Math.abs(Math.atan2(Math.sin(th), Math.cos(th)))
      const covered =
        step(0.04, 0.2, angle) *
        (1 - step(merchantNeckline(angle) - 0.005, merchantNeckline(angle) + 0.01, y)) *
        step(1.23, 1.31, y)
      return tint(tint(c.inner, colours.mint, 0.53), colours.moss, covered)
    },
    sleeve: (c) => tint(c.inner, colours.mint, 0.63),
  },
  9: {
    key: 'lute',
    garment: 'beizi',
    name: '照水 · 莲瓣齐腰裙与披帛',
    cut: { top: 1.014, stop: 0.138, sleeve: 0.0135, bolt: 1 },
    body: (c, th, y) =>
      tint(
        tint(c.inner, colours.rose, 0.38),
        colours.rose,
        0.78 * step(0.58, 1.3, Math.abs(Math.sin(th)) * 1.4) * step(1.18, 1.3, y)
      ),
    sleeve: () => tint(colours.plum, colours.blush, 0.56),
  },
  64: {
    key: 'scholar',
    garment: 'changshan',
    name: '疏篁 · 竹石氅衣与霜色直身',
    cut: { top: 0.928, stop: 0.134, sleeve: 0.016, bolt: 1 },
    body: (c, th, y) =>
      tint(
        tint(c.inner, colours.frost, 0.65),
        colours.slate,
        step(0.6, 1.0, Math.abs(Math.sin(th))) * step(1.17, 1.31, y)
      ),
    sleeve: (c, t = 1) => tint(tint(c.inner, colours.frost, 0.54), colours.ink, 1 - step(0.27, 0.53, t)),
  },
  4: {
    key: 'drummer',
    garment: 'yuanling',
    name: '望潮 · 双鱼紧袖与玄青蹀躞',
    cut: { top: 0.956, stop: 0.522, sleeve: 0.0015, bolt: 0 },
    body: (c) => tint(c.outer, colours.lacquer, 0.52),
    sleeve: (c) => tint(c.outer, colours.lacquer, 0.46),
  },
}
export function signatureConfig(profile) {
  const native = designs[profile.id]
  return native && profile.garment === native.garment && (!profile.design || profile.design === native.key)
    ? native
    : null
}
function surface(a, y, theta, offset = 0, cut = 'straight') {
  const p = y >= 0.932 ? a.torsoPoint(y, theta, offset) : lowerPoint(a, y, theta, 'slim', offset)
  // lowerPoint eases generic skirt allowances into the underlying waist.
  // An outer waistcoat, its embroidery and a sash each keep their own seam
  // allowance through that transition.
  if (y < 0.932) {
    const correction = (offset - Math.min(0.0055, offset * 0.48)) * step(0.813, 0.934, y)
    p[0] += Math.sin(theta) * correction * a.h
    p[2] += Math.cos(theta) * correction * a.h
  }
  const d = 1 - step(0.3, 0.94, y),
    wave = Math.cos(7 * theta + 0.4 * y + a.phase)
  const flare = { silk: 0.084, lute: 0.079, scholar: 0.031, jacket: 0.018, straight: 0 }[cut] ?? 0
  const phi = theta + 0.16 * Math.sin(2.4 * y + theta)
  const fan = Math.sin(8 * phi + a.phase + 0.83 * y)
  const folded = (0.012 * fan + 0.004 * Math.sin(16 * phi + 0.45)) * (1 - step(0.83, 1.15, y))
  const sway = (flare + 0.008 * wave) * d + folded
  p[0] += Math.sin(theta) * sway * a.h
  p[2] += Math.cos(theta) * sway * 0.69 * a.h
  return {
    p,
    w: y >= 0.927 ? a.torsoWeight(y, theta) : legDrape(a, y, theta),
    theta,
    level: y,
    allowance: offset,
  }
}
function off(a, s, offset) {
  return [s.p[0] + Math.sin(s.theta) * offset * a.h, s.p[1], s.p[2] + Math.cos(s.theta) * offset * a.h]
}
function panel(
  a,
  shape,
  cell,
  { nu = 18, nv = 20, flip = false, uv = (u, v) => [u, v], shadeAt = () => 1 } = {}
) {
  a.brocade.patch(
    nu,
    nv,
    (u, v) => {
      const d = shape(u, v),
        ink = uv(u, v)
      return [d.p, d.w, shade(white, shadeAt(u, v)), costumeUV(cell, ink[0], ink[1])]
    },
    flip
  )
}
// The selvedge is a folded strip cut from another cloth. It follows the
// surface at its own offset; its width and colour stay legible on the reverse.
function trim(a, shape, edge, width, dye, { height = 25, double = true, mirror = false } = {}) {
  a.satin.patch(
    3,
    Math.ceil(height * 0.73),
    (u, v) => {
      const local =
        edge === 'left'
          ? [width * u, v]
          : edge === 'right'
            ? [1 - width + width * u, v]
            : edge === 'bottom'
              ? [v, width * u]
              : [v, 1 - width + width * u]
      const d = shape(...local),
        lift = 0.0016 + 0.0011 * Math.sin(Math.PI * u)
      const color = double && (u < 0.14 || u > 0.87) ? tint(dye, colours.gold, 0.47) : dye
      return [off(a, d, lift), d.w, color, clothUV(4, v * 3.1, 0.18 + 0.64 * u)]
    },
    mirror
  )
}
function backedHem(a, shape, edge = 'bottom') {
  a.satin.patch(1, 26, (u, v) => {
    const loc = edge === 'bottom' ? [v, u * 0.013] : edge === 'left' ? [u * 0.017, v] : [1 - u * 0.017, v]
    const d = shape(...loc)
    return [off(a, d, -0.003 * u), d.w, shade(a.color.binding, 0.7), clothUV(1, v * 2, 0.12 + 0.55 * u)]
  })
}
function radialPanels(
  a,
  { top, hem, cut, cell, other, sections, pleats = 0, trimColor, slit = 0, trimWidth = 0.048 }
) {
  for (const [j, [lo, hi]] of sections.entries()) {
    const f = (u, v) => {
      const ang = mix(lo + slit * (1 - v) ** 2, hi - slit * (1 - v) ** 2, u)
      const bottom = typeof hem === 'function' ? hem(ang, u, j) : hem
      const y = mix(bottom, top, v)
      const fold =
        pleats *
        (Math.cos(ang * (cut === 'lute' ? 15 : 22) + 0.5 * v) + 0.33 * Math.cos(ang * 7 - v)) *
        (1 - step(0.74, 1, v))
      return surface(a, y, ang, 0.0075 + fold, cut)
    }
    panel(a, f, j % 2 && other !== undefined ? other : cell, {
      nu: Math.max(13, Math.ceil((hi - lo) * (pleats ? 11 : 7))),
      nv: 18,
      shadeAt: (u, v) => 0.96 + 0.04 * v + 0.017 * Math.cos(u * Math.PI * 2),
    })
    if (trimColor) trim(a, f, 'bottom', trimWidth, trimColor, { height: 18 })
    if (slit) {
      backedHem(a, f, 'left')
      backedHem(a, f, 'right')
    }
  }
}
function button(a, s, r, ground, shape = 'round') {
  const mesh = a.satin,
    theta = s.theta,
    tx = Math.cos(theta),
    tz = -Math.sin(theta)
  mesh.patch(12, 8, (u, v) => {
    const latitude = (v - 0.5) * Math.PI,
      long = u * turn,
      ring = Math.cos(latitude),
      t = r * ring * Math.cos(long),
      n = r * 0.64 * ring * Math.sin(long)
    const p = [
      s.p[0] + a.h * (tx * t + Math.sin(theta) * n),
      s.p[1] + a.h * r * (shape === 'oval' ? 1.33 : 1) * Math.sin(latitude),
      s.p[2] + a.h * (tz * t + Math.cos(theta) * n),
    ]
    return [p, s.w, shade(ground, 0.94 + 0.13 * Math.sin(latitude)), clothUV(1, u, 0.1 + 0.8 * v)]
  })
}
function band(a, y, height, cell, offset = 0.012, slant = 0, arc = [-Math.PI, Math.PI]) {
  const f = (u, v) => {
    const th = mix(...arc, u),
      fold = 0.0026 * Math.sin(v * Math.PI * 3 + 0.7 * Math.sin(th)) + 0.0018 * Math.cos(th * 3 + 5 * v)
    return surface(a, y + (v - 0.5) * height + slant * Math.sin(th - 0.68), th, offset + fold)
  }
  const sections = Math.ceil((arc[1] - arc[0]) / 0.85)
  for (let i = 0; i < sections; i++) {
    const part = (u, v) => f((i + u) / sections, v)
    panel(a, part, cell, {
      nu: Math.max(5, Math.ceil(50 / sections)),
      nv: 6,
      uv: (u, v) => [0.04 + 0.92 * u, 0.12 + (0.13 + 3.3 * height) * v],
    })
  }
  trim(a, f, 'bottom', 0.09, colours.gold, { height: 46, double: false })
  trim(a, f, 'top', 0.09, colours.gold, { height: 46, double: false })
}
function armhole(a, side, sign, phi) {
  const rim = a.armholes[side],
    angle = ((phi % turn) + turn) % turn
  let j = rim.findIndex((p) => p.angle >= angle)
  if (j < 0) j = 0
  const k = (j + rim.length - 1) % rim.length,
    l = rim[k],
    r = rim[j]
  const span = (r.angle - l.angle + turn) % turn || 1,
    t = ((angle - l.angle + turn) % turn) / span
  const p = between(l.p, r.p, t),
    w = balanced(l.w, r.w, t)
  const c = Math.cos(phi),
    s = Math.sin(phi)
  p[0] += sign * 0.004 * a.h * Math.max(0, c)
  p[1] += 0.0035 * a.h * c
  p[2] += 0.0045 * a.h * s
  return { p, w, theta: Math.atan2(p[0], p[2]) }
}
function attachment(a, side, sign, t, phi, start, ease) {
  const seam = armhole(a, side, sign, phi)
  const top = a.sleeveSection(a, side, sign, start, phi, ease, 0.005)
  return {
    p: between(seam.p, top, t),
    w: balanced(seam.w, a.armWeights(side, start), t),
    theta: seam.theta,
  }
}
function upperPanel(
  a,
  {
    sign = 1,
    back = false,
    open = 0.29,
    hem = 0.82,
    cell = 0,
    style = 'silk',
    long = false,
    wide = 0,
    trimColor = colours.gold,
    edgeWidth = 0.055,
  }
) {
  // Two front quarters and a shaped back share a shoulder seam. The armhole
  // narrows at the chest and widens across the shoulder straps.
  const f = (u, v) => {
    const bottom = typeof hem === 'function' ? hem(u) : hem
    const high = back
      ? 1.391 - 0.01 * Math.cos(Math.PI * u) ** 2
      : 1.358 + 0.035 * Math.sin(u * Math.PI * 0.87)
    const y = mix(bottom, high, v)
    const arm = step(1.116, 1.215, y) * (1 - step(1.319, 1.375, y))
    const lateral = Math.PI * 0.5 - 0.57 * arm
    const centreBack = back ? Math.PI : 0
    const aperture = typeof open === 'function' ? open(y) : open
    const frontEdge = aperture + 0.4 * step(1.25, 1.375, y)
    const th = back ? centreBack + mix(-lateral, lateral, u) : sign * mix(frontEdge, lateral, u)
    const fitted = step(1.06, 1.385, y)
    const extra =
      wide * (1 - 0.97 * fitted) +
      0.009 -
      0.006 * fitted +
      0.002 * Math.sin(4 * Math.PI * u + v * 0.7) * (1 - step(1.2, 1.36, y))
    return surface(a, y, th, extra, style)
  }
  panel(a, f, cell, {
    nu: back ? 28 : 15,
    nv: long ? 28 : 22,
    flip: back ? false : sign < 0,
    uv: (u, v) => [u, v],
    shadeAt: (u, v) => 0.986 + 0.023 * Math.sin(2.1 * u + 0.4 * v),
  })
  if (!back) trim(a, f, 'left', edgeWidth, trimColor, { height: 30, mirror: sign > 0 })
  trim(a, f, 'bottom', long ? 0.019 : 0.039, trimColor, { height: back ? 32 : 18 })
  if (!back) backedHem(a, f, 'left')
  return f
}
function shoulderSeams(a, fronts, back, style, cells, binding) {
  for (const [i, front] of fronts.entries()) {
    const sg = i === 0 ? -1 : 1
    // The forepart and back are sewn over the line of the clavicle. Treating
    // this as a horizontal cap leaves a gap when the player lifts her arm.
    const f = (u, v) => {
      const fore = front(u, 1),
        behind = back(sg < 0 ? mix(0.57, 1, u) : mix(0.43, 0, u), 1)
      const th = mix(fore.theta, behind.theta - (sg < 0 ? turn : 0), v)
      const y = mix(fore.level, behind.level, v) + 0.009 * Math.sin(v * Math.PI) * (1 - 0.85 * u)
      return surface(
        a,
        y,
        th,
        mix(fore.allowance, behind.allowance, v) + 0.0006 * Math.sin(v * Math.PI),
        style
      )
    }
    panel(a, f, cells[i], { nu: 15, nv: 10, flip: sg > 0, uv: (u, v) => [u, 0.81 + 0.15 * v] })
    trim(a, f, 'left', 0.037, binding, { height: 13 })
  }
}
function shoulderCaps(a, cell, { end = 0.48, ease = 0.012, dye = colours.gold, points = 0 } = {}) {
  for (const [side, sign] of [
    ['l', 1],
    ['r', -1],
  ]) {
    const f = (u, v) => {
      const phi = mix(-2.59, 2.59, u),
        arc = Math.sin(Math.PI * u)
      const start = 0.13 + 0.1 * (1 - arc)
      const t = mix(
        end + 0.06 * arc + 0.035 * Math.cos(points * turn * u) * (points ? 1 : 0),
        start,
        Math.min(v / 0.78, 1)
      )
      if (v > 0.78) return attachment(a, side, sign, 1 - (v - 0.78) / 0.22, phi, start, ease)
      const p = a.sleeveSection(a, side, sign, t, phi, ease, 0.0055)
      return { p, w: a.armWeights(side, t), theta: Math.atan2(p[0], p[2]) }
    }
    panel(a, f, cell, { nu: 21, nv: 10, flip: sign > 0 })
    trim(a, f, 'bottom', 0.105, dye, { height: 24, double: true })
  }
}
function pipedSleeve(a, side, sign, t1, t2, cell, ease, dye) {
  function f(u, v) {
    const phi = u * turn,
      t = mix(t1, t2, v),
      p = a.sleeveSection(a, side, sign, t, phi, Math.max(ease, a.spec.sleeve) + 0.002, 0.0048)
    return { p, w: a.armWeights(side, t), theta: Math.atan2(p[0], p[2]) }
  }
  panel(a, f, cell, { nu: 26, nv: 6, flip: sign < 0 })
  trim(a, f, 'bottom', 0.1, dye, { height: 26 })
  trim(a, f, 'top', 0.065, dye, { height: 26 })
}
function silkKnot(a, theta, level, length, ground, style) {
  for (const sign of [-1, 1]) {
    // The two ends leave the knot at different angles. The cut ends are
    // notched across the grain and the right-hand end lies over the left.
    const f = (u, v) => {
      const width = mix(0.043, 0.089, v),
        pointing = 0.016 * Math.abs(2 * u - 1) ** 1.35
      const y = level - v * (length * (sign > 0 ? 0.83 : 1) - pointing * v ** 5)
      const th = theta + sign * (0.036 + 0.25 * Math.sin(v * 1.48)) + ((u - 0.5) * width) / a.hip
      return surface(a, y, th, 0.039 + 0.0023 * Math.sin(u * turn + v * 1.8), style)
    }
    a.satin.patch(
      7,
      18,
      (u, v) => {
        const d = f(u, v),
          tone = u < 0.145 || u > 0.855 ? tint(ground, colours.gold, 0.64) : ground
        return [
          d.p,
          d.w,
          shade(tone, 0.96 + 0.075 * Math.sin(u * turn + v * 0.65)),
          clothUV(4, 1.3 * v, 0.1 + 0.7 * u),
        ]
      },
      sign < 0
    )
  }
  button(a, surface(a, level, theta, 0.042), 0.009, colours.gold, 'oval')
}
function fastening(a, y, reach, ground, center = 0) {
  for (const sg of [-1, 1])
    for (const arc of [-1, 1]) {
      a.satin.patch(4, 14, (u, v) => {
        const th = center + sg * (0.012 + v * reach),
          angle = u * turn,
          height = 0.0036 * Math.sin(Math.PI * v) * arc + 0.0014 * Math.cos(angle)
        const d = surface(a, y + height, th, 0.0185 + 0.0014 * Math.sin(angle))
        return [d.p, d.w, shade(ground, 0.86 + 0.14 * Math.cos(angle - 0.6)), clothUV(4, v, 0.22 + 0.53 * u)]
      })
    }
  button(a, surface(a, y, center, 0.02), 0.0056, colours.bronze, 'oval')
}

function hangingJade(a, theta, waistY, length, style, bright) {
  const colour = bright ? colours.whiteJade : colours.jade
  function at(v, side = 0) {
    return surface(
      a,
      waistY - v * length,
      theta + 0.07 * Math.sin(v * 1.6) + side,
      0.039 + 0.009 * v,
      style
    )
  }
  // A silk cord doubles around the carved bi, then splits into a knotted tassel.
  for (const side of [-1, 1])
    a.satin.patch(3, 18, (u, v) => {
      const d = at(v, side * 0.034 * Math.sin(v * Math.PI) + (u - 0.5) * 0.013)
      return [d.p, d.w, tint(colours.gold, colours.moss, 0.25), clothUV(4, v * 2, 0.19 + u * 0.64)]
    })
  const d = at(1),
    r = bright ? 0.022 : 0.024,
    th = d.theta,
    tx = Math.cos(th),
    tz = -Math.sin(th)
  a.satin.patch(22, 6, (u, v) => {
    const ph = u * turn,
      c = Math.cos(ph),
      s = Math.sin(ph),
      q = v * turn
    const rad = r * (0.74 + 0.26 * Math.cos(q)),
      dx = c * rad,
      dy = s * rad * (bright ? 1.2 : 1),
      out = 0.0039 * Math.sin(q)
    return [
      [
        d.p[0] + a.h * (tx * dx + Math.sin(th) * out),
        d.p[1] + a.h * dy,
        d.p[2] + a.h * (tz * dx + Math.cos(th) * out),
      ],
      d.w,
      shade(colour, 0.93 + 0.11 * Math.cos(q - 1.1)),
      clothUV(1, u, 0.21 + 0.53 * v),
    ]
  })
  for (let k = -2; k <= 2; k++) {
    a.satin.patch(3, 11, (u, v) => {
      const s = surface(
        a,
        waistY - length - r * 0.96 - v * (bright ? 0.076 : 0.056),
        th + k * 0.016 * v + (u - 0.5) * 0.008,
        0.051 + 0.003 * Math.sin(v * Math.PI),
        style
      )
      return [s.p, s.w, k % 2 ? colours.gold : colours.jade, clothUV(1, v, 0.11 + 0.74 * u)]
    })
  }
  button(a, at(0.01), 0.0095, colours.bronze)
}

function merchantNeckline(th) {
  const angle = Math.abs(Math.atan2(Math.sin(th), Math.cos(th)))
  return sample(
    [
      [0, 1.289],
      [0.23, 1.313],
      [0.49, 1.354],
      [0.78, 1.382],
      [1.08, 1.395],
      [1.57, 1.405],
      [2.19, 1.408],
      [Math.PI, 1.409],
    ],
    angle
  )[0]
}
function merchantJacket(a) {
  // Two foreparts wrap all the way to the nape. Their neckline is the actual
  // upper edge of the garment. The side seams open only around the armscyes.
  for (const sg of [-1, 1])
    for (const rear of [false, true]) {
      const f = (u, v) => {
        const front = 0.08,
          nominal = rear ? mix(Math.PI / 2, Math.PI, u) : mix(front, Math.PI / 2, u)
        const hem = rear
          ? 0.715 + 0.144 * (1 - u) ** 1.5
          : 0.711 + 0.147 * step(0.3, 0.98, u) + 0.014 * Math.cos(3 * Math.PI * u)
        const y = mix(hem, merchantNeckline(nominal), v)
        const armOpening = 0.49 * step(1.156, 1.206, y) * (1 - step(1.328, 1.361, y))
        const crossed = 1 - step(0.995, 1.295, y)
        const overlap = sg > 0 ? front - 0.79 * crossed + 0.16 * step(0.93, 0.72, y) : front + 0.27 * crossed
        const th =
          sg * (rear ? mix(Math.PI / 2 + armOpening, Math.PI, u) : mix(overlap, Math.PI / 2 - armOpening, u))
        const room =
          0.009 +
          0.014 * (1 - step(0.98, 1.21, y)) +
          (sg > 0 && !rear ? 0.005 * (1 - u) * crossed : 0) +
          0.0018 * Math.sin(3 * th + v) * (1 - step(1.12, 1.27, y))
        const d = y > 1.335 ? a.neckSurface(y, th, room) : surface(a, y, th, room, 'silk')
        const seam = rear ? 1 - u : u
        if (y > 1.178 && y < 1.359 && seam > 0.74) {
          const ph = Math.acos(clip((y - 1.2685) / 0.089, -1, 1)) * (rear ? -1 : 1)
          const rim = armhole(a, sg > 0 ? 'l' : 'r', sg, ph)
          const meet = step(0.74, 1, seam)
          d.p = between(d.p, rim.p, meet)
          d.w = balanced(d.w, rim.w, meet)
        }
        return d
      }
      panel(a, f, 0, {
        nu: rear ? 16 : 19,
        nv: 23,
        flip: sg < 0,
        uv: (u, v) => [sg < 0 ? u : 1 - u, 0.025 + 0.94 * v],
        shadeAt: (u, v) => (sg < 0 ? 0.96 + 0.037 * v : 1.035 + 0.015 * v),
      })
      trim(a, f, 'top', 0.015, colours.darkJade, { height: 35, double: true, mirror: sg > 0 })
      trim(a, f, 'bottom', 0.031, rear ? colours.moss : colours.gold, { height: 22 })
      if (!rear) {
        trim(a, f, 'left', sg > 0 ? 0.11 : 0.043, sg > 0 ? colours.moss : colours.jade, { height: 27 })
        backedHem(a, f, 'left')
      }
    }

}
function silkMerchant(a) {
  const c = colours
  // The smooth overlapping apron is a single width of brocade. The neighbouring
  // side lengths take the excess width in matched banks of actual knife pleats.
  for (const centre of [0, Math.PI]) {
    const f = (u, v) => {
      const th = centre + mix(-0.625, 0.625, u),
        y = mix(0.116 + 0.013 * Math.cos((u - 0.5) * Math.PI), 1.002, v)
      return surface(a, y, th, 0.021 + 0.0031 * Math.cos(u * 2 * Math.PI), 'silk')
    }
    panel(a, f, 2, { nu: 23, nv: 23 })
    trim(a, f, 'bottom', 0.038, c.gold, { height: 27 })
    trim(a, f, 'left', 0.016, c.moss, { height: 29 })
    trim(a, f, 'right', 0.016, c.moss, { height: 29 })
    backedHem(a, f)
  }
  for (const s of [-1, 1]) {
    const f = (u, v) => {
      const th = s * mix(0.572, Math.PI - 0.572, u),
        y = mix(0.139 + 0.009 * Math.cos(u * turn), 1.002, v)
      const frac = (u * 11) % 1,
        knife = frac < 0.72 ? mix(-1, 1, frac / 0.72) : mix(1, -1, (frac - 0.72) / 0.28)
      return surface(a, y, th, 0.008 + knife * 0.025 * (0.34 + 0.66 * (1 - v)), 'silk')
    }
    panel(a, f, 3, {
      nu: 54,
      nv: 17,
      flip: s < 0,
      shadeAt: (u, v) => 0.8 + 0.18 * Math.cos((u * 11 - 0.35) * turn) * (0.55 + 0.45 * (1 - v)),
    })
    trim(a, f, 'bottom', 0.022, c.jade, { height: 54 })
  }
  wrapCollar(a, a.neckSurface, c, 'silk', merchantNeckline)
  merchantJacket(a)
  band(a, 1.005, 0.047, 3, 0.0315, -0.014)
  fastening(a, 1.176, 0.157, c.moss, -0.204)
  fastening(a, 1.09, 0.151, c.moss, -0.54)
  for (const [side, s] of [
    ['l', 1],
    ['r', -1],
  ])
    pipedSleeve(a, side, s, 1.69, side === 'l' ? 1.83 : 1.91, 1, 0.008, c.gold)
  for (const [side, sg] of [
    ['l', 1],
    ['r', -1],
  ]) {
    const overSleeve = (u, v) => {
      const phi = u * turn,
        rear = 0.5 - 0.5 * Math.sin(phi)
      const end = 1.02 + 0.35 * rear + 0.07 * Math.cos(phi + 0.3)
      if (v < 0.14) return attachment(a, side, sg, v / 0.14, phi, 0.15, 0.008)
      const t = mix(0.15, end, (v - 0.14) / 0.86)
      const opening = 0.008 + 0.021 * v * v
      const p = a.sleeveSection(a, side, sg, t, phi, opening, 0.005)
      const hanging = v ** 1.7 * (0.14 + 0.86 * rear)
      p[1] -= a.h * (side === 'r' ? 0.058 : 0.029) * hanging
      p[2] -= a.h * (side === 'l' ? 0.068 : 0.024) * hanging
      return { p, w: a.armWeights(side, t), theta: Math.atan2(p[0], p[2]) }
    }
    panel(a, overSleeve, 1, {
      nu: 20,
      nv: 14,
      flip: sg < 0,
      uv: (u, v) => [0.25 + 0.53 * u, 0.36 + 0.55 * (1 - v)],
    })
    trim(a, overSleeve, 'top', 0.067, c.moss, { height: 25, double: true })
  }
  hangingJade(a, -0.74, 0.99, 0.204, 'silk', true)
  silkKnot(a, -0.73, 1.002, 0.149, c.moss, 'silk')
}
function cat(p0, p1, p2, p3, t) {
  const t2 = t * t,
    t3 = t2 * t
  return p1.map(
    (q, i) =>
      0.5 *
      (2 * q +
        (-p0[i] + p2[i]) * t +
        (2 * p0[i] - 5 * q + 4 * p2[i] - p3[i]) * t2 +
        (-p0[i] + 3 * q - 3 * p2[i] + p3[i]) * t3)
  )
}
function balanced(a, b, t) {
  const w = {}
  for (const n of new Set([...Object.keys(a), ...Object.keys(b)])) w[n] = mix(a[n] ?? 0, b[n] ?? 0, t)
  return w
}
function lutePibo(a) {
  const h = a.h,
    xs = a.shoulder / h,
    hh = a.hip / h
  // One ribbon goes from the right hip, diagonally up the posterior arm, over
  // both scapulae, and down the other side. Its warp rolls through the turn.
  const stops = [
    [-0.162, 0.596, 0.158, -0.036, 0.003, -0.014, 'rhip'],
    [-0.119, 0.704, 0.164, -0.033, 0.013, -0.008, 'rhip'],
    [-0.105, 0.898, 0.135, -0.044, 0.008, -0.009, 'rhip'],
    [-0.12, 1.078, 0.117, -0.04, 0.007, -0.02, 'ribs'],
    [-0.158, 1.219, 0.106, -0.034, 0.014, -0.027, 'rclav'],
    [-0.16, 1.325, 0.075, -0.026, 0.025, -0.022, 'rclav'],
    [-0.155, 1.367, 0.006, -0.027, 0.017, 0.006, 'rclav'],
    [-0.147, 1.343, -0.1, 0.018, 0.025, -0.012, 'back'],
    [-0.083, 1.301, -0.142, 0.013, 0.04, -0.006, 'back'],
    [0.012, 1.274, -0.153, 0.005, 0.043, 0.001, 'back'],
    [0.102, 1.301, -0.139, -0.01, 0.038, -0.004, 'back'],
    [0.153, 1.326, -0.095, -0.018, 0.023, -0.015, 'back'],
    [0.186, 1.303, -0.078, 0.004, 0.019, -0.017, 'lclav'],
    [0.197, 1.195, -0.065, 0.01, 0.029, -0.02, 'lclav'],
    [0.211, 1.039, -0.082, 0.03, 0.044, -0.01, 'ribs'],
    [0.181, 0.888, -0.128, 0.036, 0.029, -0.017, 'lhip'],
    [0.198, 0.761, -0.153, 0.04, 0.011, -0.006, 'lhip'],
    [0.222, 0.642, -0.131, 0.035, 0.004, 0.015, 'lhip'],
  ]
  const prepared = stops.map(([x, y, z, wx, wy, wz, bone]) => {
    const th = Math.atan2(x, z)
    let w = bone.includes('hip') ? legDrape(a, y, th) : a.torsoWeight(Math.min(1.35, y), th)
    if (bone === 'rclav' || bone === 'lclav') {
      const side = bone[0]
      w = balanced(
        { chest: 0.36, [side + 'Clavicle']: 0.64 },
        { [side + 'UpperArm']: 0.76, [side + 'Clavicle']: 0.24 },
        step(1.34, 1.18, y) * 0.12
      )
    }
    return {
      p: [x * h * mix(hh, xs, step(0.88, 1.22, y)), a.y(y), z * h],
      width: [wx * h, wy * h, wz * h],
      w,
    }
  })
  if (a.seatSurface) {
    const last = prepared.length - 1
    for (const [index, theta, t, span] of [
      [last - 2, 1.99, 0.16, 0.23],
      [last - 1, 1.63, 0.32, 0.23],
      [last, 1.44, 0.51, 0.21],
      [0, -1.25, 0.55, 0.19],
      [1, -1.16, 0.34, 0.22],
      [2, -1.06, 0.18, 0.21],
    ]) {
      const mid = a.seatSurface(theta, t, 0.025),
        edge = a.seatSurface(theta + span, t, 0.026)
      prepared[index] = { p: mid.p, w: mid.w, width: edge.p.map((x, i) => x - mid.p[i]) }
    }
  }
  const f = (u, v) => {
    const f0 = v * (stops.length - 1),
      i = Math.min(stops.length - 2, Math.floor(f0)),
      k = f0 - i
    const s0 = prepared[Math.max(0, i - 1)],
      s1 = prepared[i],
      s2 = prepared[i + 1],
      s3 = prepared[Math.min(prepared.length - 1, i + 2)]
    const p = cat(s0.p, s1.p, s2.p, s3.p, k),
      wd = cat(s0.width, s1.width, s2.width, s3.width, k),
      across = 2 * u - 1
    const curl =
      0.007 * Math.cos(u * Math.PI * 3 + 3.4 * v) +
      0.003 * Math.sin(8 * v + u * 4) * (1 - Math.abs(across) * 0.6)
    const out = [p[0] + wd[0] * across, p[1] + wd[1] * across, p[2] + wd[2] * across - curl * h]
    return { p: out, w: balanced(s1.w, s2.w, k), theta: Math.atan2(p[0], p[2]) }
  }
  for (let j = 0; j < 6; j++) {
    const repeat = (u, v) => f(u, (v + j) / 6)
    panel(a, repeat, 6, {
      nu: 7,
      nv: 11,
      uv: (u, v) => [0.04 + 0.92 * u, 0.13 + 0.71 * v],
      shadeAt: (u, v) => 0.97 + 0.035 * Math.cos(u * turn + v * 0.2),
    })
  }
  for (const edge of ['left', 'right']) trim(a, f, edge, 0.041, colours.rose, { height: 73 })
  for (const edge of ['top', 'bottom']) trim(a, f, edge, 0.013, colours.blush, { height: 15 })
}
function lutePlayer(a) {
  const c = colours,
    sections = Array.from({ length: 8 }, (_, k) => [
      -Math.PI / 8 + (k * Math.PI) / 4,
      -Math.PI / 8 + ((k + 1) * Math.PI) / 4,
    ])
  if (a.seated) {
    const draped = (a.seatSurface = seatedSilk(a))
    for (const [i, [lo, hi]] of [
      [-1.13, 1.11],
      [1.11, 3.12],
      [3.12, turn - 1.13],
    ].entries()) {
      const f = (u, v) => draped(mix(lo, hi, u), 1 - v)
      panel(a, f, i === 0 ? 5 : 4, {
        nu: i === 0 ? 30 : 22,
        nv: 31,
        uv: (u, v) => [i === 2 ? 1 - u : u, v],
        shadeAt: (u, v) => 0.9 + 0.063 * v + 0.045 * Math.sin(u * 4 + i),
      })
      trim(a, f, 'bottom', 0.018, c.blush, { height: 29 })
      backedHem(a, f)
    }
    // A single bias-cut overpanel is caught under the belt on her right,
    // spreads across the sinistral knee, and curls back at the selvage. Its
    // open diagonal reveals the deeper mulberry silk beneath the pale gore.
    const wrap = (u, v) => {
      const theta = mix(-1.66, 1.74, u)
      const drop = 0.29 + 0.64 * step(0.17, 0.92, u) + 0.034 * Math.sin(6 * u + 0.3)
      const t = mix(drop, 0.028, v)
      const selvedge = 0.013 + 0.005 * (1 - v) ** 3 + 0.0025 * Math.sin(4 * u + 2 * v)
      return draped(theta, t, selvedge)
    }
    panel(a, wrap, 4, {
      nu: 29,
      nv: 17,
      uv: (u, v) => [0.39 + 0.6 * u, 0.32 + 0.63 * v],
      shadeAt: (u, v) => 1.1 + 0.05 * Math.sin(3 * u - 2 * v),
    })
    a.satin.patch(3, 41, (u, v) => {
      const drop = 0.29 + 0.64 * step(0.17, 0.92, v) + 0.034 * Math.sin(6 * v + 0.3)
      const th = mix(-1.66, 1.74, v),
        t = mix(drop, 0.028, 0.022 * u)
      const d = draped(th, t, 0.021 + 0.0025 * Math.sin(4 * v))
      return [d.p, d.w, tint(c.blush, c.cream, 0.38), clothUV(1, v * 3.5, 0.2 + 0.59 * u)]
    })
  } else
    radialPanels(a, {
      top: 1.049,
      hem: (th, u) => 0.138 + 0.029 * (1 - Math.sin(u * Math.PI)) + 0.008 * Math.cos(3 * th),
      cut: 'lute',
      cell: 5,
      other: 4,
      sections,
      pleats: 0.0049,
      trimColor: c.blush,
      trimWidth: 0.016,
    })
  // A scalloped short jacket leaves the high belt and the long gored skirt in
  // one line from the raised hand to the floor.
  const fronts = [-1, 1].map((s) =>
    upperPanel(a, {
      sign: s,
      open: (y) => 0.35 + 0.28 * step(1.08, 1.34, y),
      hem: (u) => 0.996 + 0.061 * Math.sin(u * Math.PI) + 0.019 * Math.cos(2 * u * Math.PI),
      cell: 4,
      style: 'lute',
      wide: 0.004,
      trimColor: c.claret,
      edgeWidth: 0.052,
    })
  )
  const back = upperPanel(a, {
    back: true,
    hem: (u) => 1.002 + 0.062 * Math.abs(2 * u - 1),
    cell: 4,
    style: 'lute',
    wide: 0.003,
    trimColor: c.blush,
  })
  shoulderSeams(a, fronts, back, 'lute', [4, 4], c.blush)
  wrapCollar(a, a.neckSurface, c, 'lute')
  const bodice = (u, v) => {
    const th = mix(-0.77, 0.77, u),
      top = 1.252 + 0.047 * Math.abs(2 * u - 1) ** 1.35 + 0.005 * Math.cos(4 * Math.PI * u)
    return surface(a, mix(1.044, top, v), th, 0.0061, 'lute')
  }
  panel(a, bodice, 6, { nu: 17, nv: 12, uv: (u, v) => [u, 0.3 + 0.35 * v] })
  const yoke = (u, v) => bodice(u, 0.898 + 0.102 * v)
  panel(a, yoke, 7, { nu: 20, nv: 4, uv: (u, v) => [u, 0.24 + 0.46 * v] })
  trim(a, bodice, 'top', 0.016, c.cream, { height: 24, double: false })
  band(a, 1.041, 0.047, 7, 0.026, 0.009)
  shoulderCaps(a, 4, { end: 0.38, ease: 0.0085, dye: c.cream, points: 2 })
  for (const [side, s] of [
    ['l', 1],
    ['r', -1],
  ])
    pipedSleeve(a, side, s, side === 'l' ? 1.43 : 1.58, side === 'l' ? 1.6 : 1.77, 7, 0.008, c.blush)
  silkKnot(a, 0.53, 1.033, 0.136, c.claret, 'lute')
  lutePibo(a)
}
function scholarSleeves(a) {
  for (const [side, sg] of [
    ['l', 1],
    ['r', -1],
  ]) {
    const f = (u, v) => {
      const phi = u * turn,
        c = Math.cos(phi),
        end = 1.35 + 0.21 * (1 - c) * 0.5,
        start = 0.13 + 0.11 * (1 - c)
      if (v < 0.14) return attachment(a, side, sg, v / 0.14, phi, start, 0.017)
      const t = mix(start, end, (v - 0.14) / 0.86),
        ease = 0.016 + 0.018 * step(0.26, 1.19, t)
      const p = a.sleeveSection(a, side, sg, t, phi, ease, 0.003)
      const width = step(0.3, 1.25, t)
      const hanging = Math.max(0, -Math.sin(phi + 0.31 * sg)) ** 1.5
      p[1] -= a.h * width * ((side === 'l' ? 0.105 : 0.039) * hanging + 0.014)
      p[2] -= a.h * width * (side === 'r' ? 0.108 : 0.024) * hanging
      p[0] += sg * a.h * 0.015 * width * Math.cos(3 * phi - 0.9 * t)
      return { p, w: a.armWeights(side, t), theta: Math.atan2(p[0], p[2]) }
    }
    panel(a, f, 8, { nu: 28, nv: 17, flip: sg < 0, shadeAt: (u, v) => 0.96 + 0.04 * Math.cos(u * turn) })
    trim(a, f, 'top', 0.075, colours.slate, { height: 32 })
  }
}
function scholar(a) {
  const c = colours
  radialPanels(a, {
    top: 0.955,
    hem: 0.184,
    cut: 'straight',
    cell: 10,
    sections: [
      [-1.59, 1.59],
      [1.53, 4.75],
    ],
    slit: 0.08,
    trimColor: c.frost,
    trimWidth: 0.019,
  })
  const cutFront = (u) => 0.125 + 0.112 * (1 - u) ** 1.6 + 0.025 * Math.sin(u * Math.PI)
  const fronts = [-1, 1].map((s) =>
    upperPanel(a, {
      sign: s,
      open: (y) => 0.64 - 0.38 * step(0.63, 1.25, y),
      hem: cutFront,
      cell: s < 0 ? 9 : 8,
      style: 'scholar',
      long: true,
      wide: 0.012,
      trimColor: c.ink,
      edgeWidth: 0.066,
    })
  )
  const back = upperPanel(a, {
    back: true,
    hem: (u) => 0.104 + 0.066 * Math.abs(2 * u - 1) ** 2,
    cell: 9,
    style: 'scholar',
    long: true,
    wide: 0.016,
    trimColor: c.ink,
  })
  shoulderSeams(a, fronts, back, 'scholar', [9, 8], c.ink)
  roundCollar(a, true)
  const closing = [
    [0.29, 1.392],
    [0.23, 1.357],
    [0.12, 1.319],
    [-0.075, 1.28],
    [-0.26, 1.23],
    [-0.43, 1.174],
    [-0.52, 1.119],
  ]
  bodyRibbon(a, closing, 0.025, 0.006, tint(c.slate, c.frost, 0.7))
  bodyRibbon(a, closing, 0.006, 0.008, c.frost, { edge: false })
  // Two shoulder frogs hold the hechang open; the jade disc sits on the far
  // side of the inner waist sash and remains visible against the dark forepart.
  scholarSleeves(a)
  band(a, 0.98, 0.051, 11, 0.01, -0.006, [-0.86, 0.86])
  for (const y of [1.2, 1.1]) button(a, surface(a, y, 0.28, 0.026), 0.0067, c.whiteJade, 'oval')
  hangingJade(a, 0.6, 0.972, 0.241, 'scholar', true)
}
function bracers(a) {
  for (const [side, sg] of [
    ['l', 1],
    ['r', -1],
  ]) {
    const f = (u, v) => {
      const phi = u * turn,
        t = mix(1.21 + 0.06 * (1 - Math.cos(phi)) * 0.5, 1.83, v)
      const p = a.sleeveSection(a, side, sg, t, phi, 0.004, 0.0045 + 0.0014 * Math.sin(v * Math.PI))
      return { p, w: a.armWeights(side, t), theta: Math.atan2(p[0], p[2]) }
    }
    panel(a, f, 13, { nu: 28, nv: 14, flip: sg < 0 })
    trim(a, f, 'bottom', 0.082, colours.bronze, { height: 28 })
    trim(a, f, 'top', 0.094, colours.seal, { height: 28 })
    // Narrow cords bridge the standing seam of the split bracer.
    for (let k = 0; k < 3; k++)
      for (const direction of [-1, 1])
        a.satin.patch(3, 7, (u, v) => {
          const d = f(0.09 + v * 0.158, 0.2 + k * 0.232 + direction * (v - 0.5) * 0.124 + (u - 0.5) * 0.021)
          return [off(a, d, 0.0022), d.w, colours.gold, clothUV(4, v, 0.15 + 0.7 * u)]
        })
  }
}
function ridingOverlap(a) {
  const c = colours,
    stations = [
      [0.971, -1.1],
      [1.045, -0.9],
      [1.112, -0.61],
      [1.194, -0.23],
      [1.254, 0.075],
      [1.311, 0.51],
      [1.355, 0.94],
      [1.391, 1.74],
    ]
  const f = (u, v) => {
    const y = mix(0.971, 1.389, v),
      edge = sample(stations, y)[0]
    // The broad right forepart buttons on the left flank. It dips under the
    // belt, leaving an unbroken diagonal across the ribs while the arms beat.
    const th = mix(edge, 1.56 - 0.52 * step(1.15, 1.23, y) * (1 - step(1.31, 1.38, y)), u)
    return surface(a, y, th, 0.022 + 0.0025 * (1 - u), 'jacket')
  }
  panel(a, f, 12, { nu: 16, nv: 20, shadeAt: (u, v) => 0.94 + 0.055 * v + 0.025 * Math.sin(u * Math.PI) })
  trim(a, f, 'left', 0.155, c.military, { height: 35, mirror: true })
  const turnback = [
    [0.05, 1.254],
    [-0.2, 1.287],
    [-0.48, 1.326],
    [-0.83, 1.357],
    [-1.24, 1.38],
    [-1.85, 1.389],
    [-2.45, 1.391],
    [-3.12, 1.392],
  ]
  bodyRibbon(a, turnback, 0.029, 0.019, c.military)
  bodyRibbon(a, turnback, 0.005, 0.021, c.bronze, { edge: false })
  for (const [y, th] of [
    [1.118, -0.51],
    [1.067, -0.69],
  ])
    button(a, surface(a, y, th, 0.027), 0.0057, c.bronze)
}
function drummer(a) {
  const c = colours
  // Four deep splits and a much shorter front free both knees. The longer
  // scarlet rear tails are visible even while the drum obscures the front.
  const cuts = [
    [-0.76, 0.76],
    [0.82, 2.22],
    [2.25, 4.04],
    [4.08, 5.48],
  ]
  radialPanels(a, {
    top: 0.997,
    hem: (th, u, j) => (j === 0 ? 0.6 : j === 2 ? 0.508 : 0.657) + 0.083 * Math.abs(2 * u - 1) ** 1.6,
    cut: 'jacket',
    cell: 12,
    other: 13,
    sections: cuts,
    slit: 0.077,
    trimColor: c.bronze,
    trimWidth: 0.024,
  })
  // A short crossover, surmounted by a double-faced indigo V and side yoke.
  for (const s of [-1, 1])
    upperPanel(a, {
      sign: s,
      open: (y) => 0.64 + 0.18 * step(1.12, 1.35, y),
      hem: (u) => 0.915 + 0.041 * u,
      cell: 12,
      style: 'jacket',
      wide: 0.005,
      trimColor: c.seal,
      edgeWidth: 0.044,
    })
  upperPanel(a, {
    back: true,
    hem: (u) => 0.905 + 0.045 * Math.abs(u * 2 - 1),
    cell: 14,
    style: 'jacket',
    wide: 0.005,
    trimColor: c.seal,
  })
  ridingOverlap(a)
  // The collar band splits over the jugular notch. The two turned-under ends
  // continue into the diagonal overlap instead of leaving an open crew neck.
  const stand = (u, v) => {
    const th = mix(0.09, turn - 0.1, u)
    const front = Math.max(0, Math.cos(th)) ** 3
    const low = 1.391 - 0.026 * front
    const y = mix(low, 1.423 - 0.035 * front, v)
    return a.neckSurface(y, th, 0.004 + 0.0017 * Math.sin(v * Math.PI))
  }
  panel(a, stand, 13, { nu: 36, nv: 5, uv: (u, v) => [u, 0.18 + 0.24 * v] })
  trim(a, stand, 'top', 0.13, c.bronze, { height: 35, double: false })
  shoulderCaps(a, 13, { end: 0.39, ease: 0.005, dye: c.bronze, points: 2 })
  band(a, 0.982, 0.1, 13, 0.031, 0.017)
  const waistEmblem = (u, v) => {
    const th = (u - 0.5) * 0.68,
      y = 0.984 + (v - 0.5) * 0.079
    return surface(a, y, th, 0.037 + 0.003 * Math.sin(Math.PI * v), 'jacket')
  }
  panel(a, waistEmblem, 14, { nu: 14, nv: 9 })
  for (const th of [-0.47, 0.47, -0.9, 0.9]) button(a, surface(a, 0.98, th, 0.039), 0.0077, c.bronze)
  silkKnot(a, -1.16, 0.98, 0.218, c.seal, 'jacket')
  for (const [th, len] of [
    [1.43, 0.156],
    [1.69, 0.103],
    [-1.47, 0.18],
  ]) {
    const strap = (u, v) =>
      surface(
        a,
        0.97 - len * v + 0.007 * v ** 7 * Math.abs(2 * u - 1),
        th + (u - 0.5) * 0.105 + 0.052 * Math.sin(2.9 * v),
        0.042 + 0.006 * Math.sin(v * Math.PI),
        'jacket'
      )
    panel(a, strap, 15, { nu: 4, nv: 10, uv: (u, v) => [0.3 + 0.4 * u, 0.2 + 0.62 * v] })
    button(a, strap(0.5, 0.05), 0.0047, c.bronze)
  }
  bracers(a)
}
export function sewSignature(a, neckStart) {
  if (['silk', 'lute', 'drummer'].includes(a.signature.key)) a.neckSurface = fitNeck(a, neckStart)
  const build = { silk: silkMerchant, lute: lutePlayer, scholar, drummer }
  build[a.signature.key](a)
}
