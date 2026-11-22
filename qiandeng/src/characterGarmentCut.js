import { turn, clip, mix, step, between, tint, shade, sample } from './characterGarmentMesh.js'
import { clothUV } from './characterGarmentPaint.js'

export function legDrape(a, y, th) {
  if (y > 0.916) return a.torsoWeight(y, th)
  const l = step(-0.32, 0.32, Math.sin(th))
  const side = 1 - step(-0.23, 0.64, Math.cos(th))
  const seatFold = a.seated ? 0.27 * side * step(0.35, 0.56, y) * (1 - step(0.83, 0.924, y)) : 0
  const travel = step(0.932, 0.72, y) * 0.982 * (1 - seatFold)
  const calf = step(0.605, 0.347, y) * 0.984
  return {
    pelvis: 1 - travel,
    lThigh: l * travel * (1 - calf),
    rThigh: (1 - l) * travel * (1 - calf),
    lShin: l * travel * calf,
    rShin: (1 - l) * travel * calf,
  }
}
const skirtSizes = [
  [0.14, 0.228, 0.166, 0.157],
  [0.25, 0.222, 0.154, 0.152],
  [0.4, 0.207, 0.143, 0.144],
  [0.59, 0.193, 0.13, 0.139],
  [0.72, 0.188, 0.125, 0.139],
  [0.81, 0.182, 0.117, 0.131],
  [0.88, 0.16, 0.11, 0.117],
  [0.96, 0.139, 0.105, 0.101],
  [1.015, 0.134, 0.102, 0.097],
]
export function lowerPoint(a, y, th, style, extra = 0, under = false) {
  const [w, f, b] = sample(skirtSizes, y)
  const s = Math.sin(th),
    c = Math.cos(th),
    l = 1 - step(0.68, 0.97, y)
  const gathered = style === 'horse' || style === 'petticoat'
  const generous = { petticoat: 0.946, horse: 1.09, robe: 1.035, short: 1.06 }[style] ?? 1.022
  const flatness = gathered ? 0.82 : 0.91,
    side = Math.abs(s)
  const pleatZone = step(0.43, 0.86, side)
  const longFold = 0.0066 * Math.sin(8 * th + a.phase + 0.69 * l) + 0.003 * Math.sin(5 * th - 0.68 * l)
  const pleatPhase = ((th / turn) * 32 + 0.11 * l) % 1
  const v = (pleatPhase + 1) % 1
  // Each pleat has a broad outward leaf and a short, deep return face.
  const knife = v < 0.76 ? mix(-1, 1, v / 0.76) : mix(1, -1, (v - 0.76) / 0.24)
  const pressed = a.seated ? mix(0.35, 0.78, 1 - step(0.28, 0.63, y)) : 1
  const kicked = style === 'horse' ? pleatZone * knife * (y > 0.87 ? 0.007 : 0.019) * pressed : 0
  const wave = under ? 0.001 : longFold * (0.34 + 0.66 * l) * (gathered ? 1 - 0.72 * pleatZone : 1)
  const tuck = (wave + kicked) * (0.54 + 0.46 * l) + extra
  const frontmost = c > 0,
    d = frontmost ? f : b
  const drop = (0.0035 * Math.sin(7 * th + a.phase) + 0.0024 * Math.sin(11 * th)) * (1 - step(0.28, 0.8, y))
  const spread = a.seated ? 1 - 0.085 * side ** 4 * Math.exp(-(((y - 0.62) / 0.19) ** 2)) : 1
  const p = [
    a.hip * w * generous * spread * Math.sign(s) * Math.abs(s) ** flatness + a.h * s * tuck,
    a.y(y + drop),
    a.h * (a.girth ** 0.55 * d * generous * Math.sign(c) * Math.abs(c) ** flatness + c * tuck),
  ]
  const fitted = step(0.813, 0.934, y)
  if (!fitted) return p
  const waist = a.torsoPoint(
    y,
    th,
    under ? -0.006 : style === 'petticoat' ? -0.012 : Math.min(0.0055, extra * 0.48)
  )
  return between(p, waist, fitted)
}
function skirtPiece(
  a,
  style,
  lo,
  hi,
  top,
  hem,
  col,
  bolt,
  { mesh = a.main, open = 0, lining = false, n = 20, sides = true, extra = 0.003, band = false } = {}
) {
  const stations = [0, 0.075, 0.19, 0.34, 0.5, 0.66, 0.8, 0.9, 0.964, 0.991, 1]
  if (!lining)
    for (const level of [0.882, 0.845, 0.806, 0.545, 0.489, 0.432]) {
      const v = (top - level) / (top - hem)
      if (v > 0.025 && v < 0.947 && stations.every((t) => Math.abs(t - v) > 0.043)) stations.push(v)
    }
  stations.sort((x, y) => x - y)
  const at = (u, v, reverse = false) => {
    const y = mix(top, hem, v)
    const split = step(0.31, 0.96, v) * open
    const ang = mix(lo + split, hi - split, u)
    const edgeRise = sides ? step(0.74, 1, v) * Math.pow(Math.abs(2 * u - 1), 6) * 0.013 : 0
    const p = lowerPoint(a, y + edgeRise, ang, style, extra - (reverse ? 0.005 : 0), lining)
    const wav = 0.024 * Math.sin(9 * ang + a.phase + 0.4 * v)
    const sidePleat = style === 'horse' ? step(0.41, 0.87, Math.abs(Math.sin(ang))) : 0
    const cyc = ((ang / turn) * 32 + 0.11 * v) % 1
    const value = 0.977 + wav - 0.128 * sidePleat * step(0.71, 0.98, (cyc + 1) % 1)
    let c = shade(col, value)
    if (v > 0.985) c = shade(col, 0.87)
    if (band && v > 0.952) c = tint(c, a.color.binding, 0.28)
    if (reverse) c = shade(tint(col, a.color.binding, 0.42), 0.7)
    return [
      p,
      legDrape(a, y, ang),
      c,
      clothUV(bolt, u * Math.max(0.6, (hi - lo) * 1.21), 0.975 - v * 0.948),
    ]
  }
  let prev, lastRow
  const edges = [[], []]
  for (const v of stations) {
    const row = []
    for (let j = 0; j <= n; j++) row.push(mesh.v(...at(j / n, v)))
    if (prev) mesh.strip(prev, row, true, false)
    edges[0].push(row[0])
    edges[1].push(row.at(-1))
    prev = row
    lastRow = row
  }
  // The return on an open robe is cut from lining. Through a moving vent the
  // viewer sees its coloured reverse and the trouser/skirt underneath.
  if (sides)
    for (const i of [0, 1]) {
      const inside = stations.map((v) => {
        const u = i === 0 ? 0.048 : 0.952
        const vert = at(u, v, true)
        return mesh.v(...vert)
      })
      mesh.strip(edges[i], inside, i === 0, false)
    }
  const hemReturn = []
  for (let j = 0; j <= n; j++) {
    const vert = at(j / n, 0.988, true)
    hemReturn.push(mesh.v(...vert))
  }
  mesh.strip(lastRow, hemReturn, false, false)
}
export function cutSkirts(a) {
  const { kind, spec, color } = a
  if (kind === 'duan') {
    // Curved back tail and front panels lap over the coarser trouser yoke.
    for (const [lo, hi] of [
      [-1.59, 1.6],
      [1.54, 4.75],
    ])
      skirtPiece(a, 'short', lo, hi, 0.932, spec.stop, color.outer, spec.bolt, {
        n: 22,
        open: 0.048,
        extra: 0.002,
      })
    return
  }
  if (kind === 'aoqun') {
    // Horse-face skirt: broad uncreased front and back panels bordered by deep
    // banks of overlapping knife pleats, with an inner wrap visible at the laps.
    skirtPiece(a, 'petticoat', 0, turn, 0.92, spec.stop + 0.045, tint(color.lower, color.inner, 0.17), 1, {
      mesh: a.line,
      n: 30,
      extra: -0.017,
      sides: false,
    })
    for (const [lo, hi] of [
      [-0.64, 2.58],
      [2.5, 5.72],
    ])
      skirtPiece(a, 'horse', lo, hi, 0.937, spec.stop, color.lower, 3, {
        mesh: a.satin,
        n: 69,
        extra: 0.005,
        band: true,
      })
    for (const center of [0, Math.PI]) {
      skirtPiece(
        a,
        'horse',
        center - 0.492,
        center + 0.492,
        0.94,
        spec.stop - 0.009,
        tint(color.lower, color.outer, 0.14),
        spec.bolt,
        { mesh: a.satin, n: 18, extra: 0.014 }
      )
    }
    return
  }
  if (kind === 'beizi') {
    skirtPiece(a, 'petticoat', 0, turn, 0.922, 0.272, tint(color.lower, color.inner, 0.12), 1, {
      mesh: a.line,
      n: 44,
      extra: -0.007,
      sides: false,
    })
    const offset = 0.276
    for (const [lo, hi] of [
      [offset, 1.6],
      [1.54, 4.74],
      [4.67, turn - offset],
    ])
      skirtPiece(a, 'robe', lo, hi, 0.957, spec.stop, color.outer, spec.bolt, {
        n: Math.ceil((hi - lo) * 10),
        open: 0.055,
        extra: 0.018,
      })
    return
  }
  if (kind === 'banbi') {
    const informal = a.working
    if (!informal)
      for (const [lo, hi] of [
        [-1.62, 1.66],
        [1.56, 4.75],
      ])
        skirtPiece(a, 'petticoat', lo, hi, 0.92, 0.345, color.lower, 1, {
          mesh: a.line,
          n: 25,
          open: 0.105,
          extra: -0.01,
        })
    for (const [lo, hi] of [
      [-1.57, -0.08],
      [0.05, 1.6],
      [1.55, 4.76],
    ])
      skirtPiece(a, 'short', lo, hi, 0.942, informal ? 0.677 : 0.603, color.outer, spec.bolt, {
        n: Math.ceil((hi - lo) * 8),
        open: 0.065,
        extra: 0.008,
      })
    return
  }
  const slim = kind === 'changshan',
    top = slim ? 0.953 : 0.95
  for (const [lo, hi] of [
    [-1.635, 1.64],
    [1.535, 4.755],
  ])
    skirtPiece(a, slim ? 'slim' : 'robe', lo, hi, top, spec.stop, color.outer, spec.bolt, {
      n: 31,
      open: slim ? 0.172 : 0.095,
      extra: 0.007,
    })
}

// Draw a tailored ribbon by specifying a path of garment-space angles and
// heights. Every strip follows the changing convex body, including its back.
export function bodyRibbon(a, path, w, offset, ground, { bolt = 4, mesh = a.satin, edge = true } = {}) {
  const lines = path.length
  function at(t) {
    const f = clip(t) * (lines - 1),
      k = Math.min(lines - 2, Math.floor(f))
    return between(path[k], path[k + 1], f - k)
  }
  mesh.patch(edge ? 8 : 4, Math.max(12, lines * 4), (u, t) => {
    const mid = at(t),
      next = at(Math.min(1, t + 0.003)),
      prev = at(Math.max(0, t - 0.003))
    const da = (next[0] - prev[0]) * 0.147,
      dy = next[1] - prev[1],
      ds = Math.hypot(da, dy) || 1
    const cross = (u - 0.5) * w
    const th = mid[0] + (cross * dy) / (ds * 0.147),
      yy = mid[1] - (cross * da) / ds
    const rr = (typeof offset === 'function' ? offset(t) : offset) + 0.0012 * (1 - (2 * u - 1) ** 2)
    let color = ground
    if (edge && (u < 0.1 || u > 0.9))
      color = tint(ground, a.color.inner, 0.25 + 0.1 * Math.cos(t * turn * 41))
    return [a.torsoPoint(yy, th, rr), a.torsoWeight(yy, th), color, clothUV(bolt, t * 2.5, 0.25 + 0.49 * u)]
  })
}
export function waist(a, y, depth, col) {
  const mesh = a.satin
  mesh.patch(48, 5, (u, v) => {
    const th = u * turn,
      tilt = 0.009 * Math.sin(th - 0.8) + 0.002 * Math.cos(2 * th)
    const yy = y + (v - 0.5) * depth + tilt
    const p = a.torsoPoint(yy, th, 0.009 + 0.0027 * Math.sin(v * Math.PI))
    const c = v < 0.14 || v > 0.86 ? shade(col, 0.78) : shade(col, 1 + 0.052 * Math.cos(4 * th + 0.7 * v))
    return [p, a.torsoWeight(yy, th), c, clothUV(4, u * 4, 0.09 + 0.82 * v)]
  })
}
export function roundCollar(a, high) {
  const { color, h } = a,
    mesh = a.satin
  mesh.patch(40, 6, (u, v) => {
    const front = Math.max(Math.cos(turn * u), 0)
    const gap = high ? 0.11 : 0
    const theta = gap + (turn - 2 * gap) * u
    const si = Math.sin(theta),
      co = Math.cos(theta)
    const innerY = high ? 1.429 - front * 0.005 : collarOpening(a.kind, theta) + 0.0015
    const outerY = high ? 1.387 - front * 0.01 : innerY - 0.008 - 0.009 * front * front
    const yy = mix(outerY, innerY, v)
    const p = high
      ? [si * mix(0.066, 0.054, v) * h, a.y(yy), mix(0.004, 0.005, v) * h + co * mix(0.061, 0.051, v) * h]
      : a.torsoPoint(yy, theta, 0.0033 + 0.002 * Math.sin(Math.PI * v))
    const col =
      v > 0.8
        ? tint(color.binding, color.inner, 0.38)
        : v < 0.13
          ? tint(color.binding, color.outer, 0.48)
          : color.binding
    return [p, a.torsoWeight(Math.min(1.389, yy), theta), col, clothUV(4, u * 2.8, 0.16 + 0.66 * v)]
  })
}
function knotAt(a, y, th, spread, ground) {
  const mesh = a.satin
  for (const side of [-1, 1]) {
    mesh.patch(5, 13, (u, t) => {
      const angle = (t - 0.5) * turn * 0.93,
        theta = th + side * (0.032 + spread * (0.54 + 0.46 * Math.cos(angle)))
      const yy = y + 0.0048 * Math.sin(angle)
      const alpha = u * turn,
        xoff = 0.0021 * Math.cos(alpha),
        rr = 0.007 + 0.0024 * Math.sin(alpha)
      return [
        a.torsoPoint(yy + xoff, theta, rr),
        a.torsoWeight(yy, theta),
        ground,
        clothUV(4, t, 0.25 + 0.49 * u),
      ]
    })
  }
  mesh.patch(9, 6, (u, v) => {
    const ph = (v - 0.5) * Math.PI,
      ca = Math.cos(ph),
      th2 = th + 0.034 * ca * Math.cos(u * turn),
      yy = y + 0.0041 * Math.sin(ph)
    return [
      a.torsoPoint(yy, th2, 0.008 + 0.004 * ca * Math.sin(u * turn)),
      a.torsoWeight(yy, th2),
      shade(ground, 1.05),
      clothUV(4, u, 0.1 + 0.8 * v),
    ]
  })
}
function crossCollar(a) {
  const { color } = a
  const under = [
    [-Math.PI, 1.39],
    [-2.2, 1.39],
    [-1.2, 1.373],
    [-0.6, 1.334],
    [-0.28, 1.277],
    [0.065, 1.217],
    [0.29, 1.185],
    [0.57, 1.154],
  ]
  const across = [
    [Math.PI, 1.39],
    [2.28, 1.391],
    [1.27, 1.374],
    [0.69, 1.339],
    [0.406, 1.29],
    [0.12, 1.231],
    [-0.115, 1.181],
    [-0.381, 1.137],
    [-0.675, 1.099],
    [-1.08, 1.07],
    [-1.53, 1.06],
  ]
  const continuous = [...under.reverse(), ...across.slice(1).map(([th, y]) => [th - turn, y])]
  const ease = (t) => -0.0048 + 0.0092 * step(0.088, 0.115, t) + 0.0047 * step(0.17, 0.44, t)
  bodyRibbon(a, continuous, 0.042, ease, tint(color.binding, color.outer, 0.24))
  bodyRibbon(a, continuous, 0.011, (t) => ease(t) + 0.0025, tint(color.outer, color.motif, 0.36), {
    edge: false,
  })
}
export function collarsAndClosures(a) {
  const { kind, color } = a
  undercollar(a)
  lapEdges(a)
  waistTies(a)
  skirtBorder(a)
  if (kind === 'duan' || kind === 'aoqun') lapPanel(a)
  if (kind === 'changshan' || kind === 'yuanling') {
    roundCollar(a, kind === 'changshan')
    const path =
      kind === 'changshan'
        ? [
            [-0.125, 1.389],
            [-0.15, 1.36],
            [-0.29, 1.33],
            [-0.56, 1.313],
            [-0.85, 1.302],
            [-1.04, 1.26],
            [-1.13, 1.189],
            [-1.15, 1.1],
            [-1.15, 0.974],
            [-1.15, 0.9],
          ]
        : [
            [-0.37, 1.363],
            [-0.58, 1.329],
            [-0.85, 1.291],
            [-1.0, 1.24],
          ]
    bodyRibbon(
      a,
      path,
      kind === 'changshan' ? 0.01 : 0.013,
      0.004,
      tint(color.outer, color.binding, 0.62),
      { edge: false }
    )
    const toggles =
      kind === 'changshan'
        ? [
            [1.367, -0.14],
            [1.31, -0.64],
            [1.265, -1.03],
            [1.173, -1.14],
            [1.078, -1.15],
          ]
        : [
            [1.328, -0.57],
            [1.274, -0.88],
          ]
    for (const [y, t] of toggles) knotAt(a, y, t, 0.116, tint(color.binding, color.motif, 0.3))
    if (kind === 'yuanling') waist(a, 1.012, 0.044, tint(color.sash, color.binding, 0.3))
    return
  }
  if (kind === 'beizi' || kind === 'banbi') {
    for (const sign of [-1, 1]) {
      const path = [
        [sign * Math.PI, 1.39],
        [sign * 2.19, 1.387],
        [sign * 1.19, 1.368],
        [sign * 0.71, 1.331],
        [sign * 0.49, 1.278],
        [sign * 0.385, 1.19],
        [sign * 0.367, 1.06],
        [sign * 0.315, 0.944],
        [sign * 0.3, kind === 'banbi' ? 0.93 : 0.948],
      ]
      bodyRibbon(a, path, kind === 'beizi' ? 0.032 : 0.026, 0.007, tint(color.binding, color.outer, 0.39))
    }
    const under = [
      [0.67, 1.358],
      [0.5, 1.318],
      [0.31, 1.28],
      [0.07, 1.224],
      [-0.28, 1.18],
    ]
    bodyRibbon(a, under, 0.016, 0.003, tint(color.inner, color.binding, 0.28))
    if (kind === 'banbi') {
      waist(a, 0.933, 0.05, color.sash)
      for (const [y, t] of [
        [1.1, 0],
        [1.049, 0],
      ])
        knotAt(a, y, t, 0.13, color.binding)
    }
    return
  }
  crossCollar(a)
  waist(a, kind === 'aoqun' ? 0.966 : 0.99, kind === 'aoqun' ? 0.071 : 0.049, color.sash)
  if (kind === 'duan') knotAt(a, 1.072, -1.23, 0.13, tint(color.binding, color.outer, 0.31))
}

// The linen undercollar closes high on the sternum. The skin insert is shaped
// from the clavicles up into the neck, underneath both folded, dyed edges.
export function collarOpening(kind, th) {
  if (kind === 'changshan') return 1.399
  const front = Math.max(0, Math.cos(th))
  return kind === 'yuanling' ? 1.398 - 0.018 * front ** 3 : 1.399 - 0.025 * front ** 5
}
export function undercollar(a) {
  if (a.kind === 'changshan' || a.kind === 'yuanling') return
  const bottom = (th) => collarOpening(a.kind, th)
  if (a.kind === 'duan' || a.kind === 'aoqun') {
    bodyRibbon(
      a,
      [
        [0.95, 1.386],
        [0.67, 1.367],
        [0.42, 1.344],
        [0.21, 1.315],
        [-0.005, 1.282],
        [-0.143, 1.25],
        [-0.22, 1.238],
      ],
      0.01,
      (t) => mix(0.0035, -0.0022, step(0.67, 0.87, t)),
      tint(a.color.inner, a.color.binding, 0.2),
      { bolt: 1, edge: false }
    )
  }
  a.satin.patch(
    44,
    4,
    (u, v) => {
      const th = (u - 0.5) * turn,
        yy = bottom(th) - v * 0.011
      const rib = 0.0034 + 0.0018 * Math.sin(v * Math.PI)
      return [
        a.torsoPoint(yy, th, rib),
        a.torsoWeight(yy, th),
        tint(a.color.inner, a.color.binding, v > 0.85 ? 0.25 : 0.08),
        clothUV(1, u * 5, 0.14 + 0.53 * v),
      ]
    },
    true
  )
}
function lapPanel(a) {
  const path = [
    [1.058, -1.5],
    [1.078, -0.995],
    [1.111, -0.59],
    [1.147, -0.32],
    [1.181, -0.115],
    [1.231, 0.12],
    [1.29, 0.406],
    [1.339, 0.69],
    [1.374, 1.27],
  ]
  a.main.patch(12, 22, (u, v) => {
    const yy = mix(1.061, 1.373, v)
    const margin = sample(path, yy)[0]
    const armCut = step(1.146, 1.185, yy) * (1 - step(1.327, 1.374, yy))
    const th = mix(margin, mix(1.82, 1.072, armCut), u)
    const lift = 0.002 * (1 - step(0.66, 1, u)) * (0.61 + 0.39 * Math.sin(v * Math.PI))
    const val = 1 + 0.034 * (1 - u)
    return [
      a.torsoPoint(yy, th, lift),
      a.torsoWeight(yy, th),
      shade(a.color.outer, val),
      clothUV(a.spec.bolt, (th / turn) * 6, ((yy - a.spec.top) / (1.405 - a.spec.top)) * 0.92 + 0.02),
    ]
  })
}
function lapEdges(a) {
  const { kind, spec, color } = a
  if (kind !== 'beizi' && kind !== 'banbi') return
  const long = kind === 'beizi',
    top = long ? 0.957 : 0.942,
    hem = long ? spec.stop : a.working ? 0.677 : 0.603
  const th0 = long ? 0.276 : 0.06,
    w = long ? 0.03 : 0.016
  const opening = long ? 0.055 : 0.065
  for (const sign of [-1, 1])
    a.satin.patch(
      4,
      21,
      (u, v) => {
        const yy = mix(top, hem, v),
          th = sign * (th0 + step(0.31, 0.96, v) * opening + (u * w) / 0.17)
        const p = lowerPoint(a, yy, th, long ? 'robe' : 'short', long ? 0.023 : 0.011)
        const c =
          u < 0.12 || u > 0.87
            ? tint(color.binding, color.inner, 0.4)
            : tint(color.binding, color.outer, 0.37)
        return [p, legDrape(a, yy, th), c, clothUV(4, v * 3, 0.17 + u * 0.69)]
      },
      sign > 0
    )
}
function waistTies(a) {
  const { kind, color } = a
  if (!['aoqun', 'duan', 'banbi'].includes(kind)) return
  const dress = kind === 'aoqun',
    worker = kind === 'duan',
    th0 = worker ? 1.03 : dress ? -0.645 : 0.78
  const top = dress ? 0.971 : worker ? 0.991 : 0.936
  for (const [i, length] of dress
    ? [
        [0, 0.345],
        [1, 0.275],
      ]
    : worker
      ? [
          [0, 0.154],
          [1, 0.099],
        ]
      : [
          [0, 0.197],
          [1, 0.127],
        ]) {
    const angle = (v) =>
      th0 + (i === 0 ? 1 : -1) * (0.025 + 0.2 * Math.sin(v * 2.35 + 0.17)) + 0.045 * Math.sin(v * 4.7)
    a.satin.patch(
      5,
      18,
      (u, v) => {
        const th = angle(v) + (u - 0.5) * (dress ? 0.128 : 0.089) * (1 - 0.26 * v)
        const yy = top - length * v + (v > 0.9 ? 0.01 * Math.sin((u + 0.3) * Math.PI) * step(0.9, 1, v) : 0)
        const z = 0.016 + 0.003 * Math.cos(u * Math.PI * 2) + 0.007 * Math.sin(v * Math.PI)
        const p =
          yy > 0.932 ? a.torsoPoint(yy, th, z) : lowerPoint(a, yy, th, dress ? 'horse' : 'short', z + 0.006)
        const w = yy > 0.932 ? a.torsoWeight(yy, th) : legDrape(a, yy, th)
        const c =
          v > 0.925 || u < 0.15 || u > 0.85
            ? tint(color.sash, color.motif, dress ? 0.51 : 0.25)
            : shade(color.sash, 0.98 + 0.1 * Math.cos(u * Math.PI))
        return [p, w, c, clothUV(4, v * 3, 0.1 + 0.8 * u)]
      },
      true
    )
  }
  // A reef knot sits against the cloth. Each tapered loop has a real return
  // underneath the wider centre wrapping, with no detached elements.
  for (const sign of [-1, 1])
    a.satin.patch(8, 19, (u, v) => {
      const theta = th0 + sign * (0.045 + 0.125 * Math.sin(v * Math.PI)) + 0.035 * Math.sin(v * turn)
      const yy = top + 0.01 * Math.sin(v * turn) + 0.0055 * Math.cos(u * turn)
      const rr = 0.017 + 0.005 * Math.sin(u * turn) + 0.011 * Math.sin(Math.PI * v)
      return [
        a.torsoPoint(yy, theta, rr),
        a.torsoWeight(yy, theta),
        shade(color.sash, 1.07),
        clothUV(4, v, 0.17 + 0.65 * u),
      ]
    })
}
function skirtBorder(a) {
  if (a.kind !== 'aoqun') return
  const { color, spec } = a
  // The paired horse faces carry a single broad brocade guard. Under it is a
  // second slim line in the darker warp, separated by a hand's breadth of cloth.
  for (const centre of [0, Math.PI])
    for (const [above, height, bold] of [
      [0.029, 0.054, true],
      [0.094, 0.006, false],
    ]) {
      a.satin.patch(18, bold ? 5 : 2, (u, v) => {
        const th = centre + mix(-0.483, 0.483, u),
          yy = spec.stop + above + v * height + 0.005 * Math.cos((u - 0.5) * Math.PI)
        const c = bold
          ? tint(color.lower, color.motif, v < 0.14 || v > 0.86 ? 0.4 : 0.21)
          : tint(color.lower, color.motif, 0.42)
        return [
          lowerPoint(a, yy, th, 'horse', 0.0168),
          legDrape(a, yy, th),
          c,
          clothUV(bold ? 4 : 0, u * 2.65, 0.2 + 0.61 * v),
        ]
      })
    }
}
