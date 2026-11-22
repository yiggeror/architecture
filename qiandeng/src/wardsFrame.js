import { art, artPolygon, picture } from './wardsPaint.js'
const S = [-1, 1]
const trim = [1.08, 0.91, 0.68]
const gabled = (h) => ['gable', 'work'].includes(h.form)
function panel(b, m, slot, x, y, z, w, h, glow = false, tint = 1) {
  picture(b, glow ? m.wardScreens : m.wardPaint, slot, x, y, z, w, h, tint)
}
function surface(b, mat, x, y, z, w, h, d, tint = 1, edge = false) {
  const l = x - w / 2,
    r = x + w / 2,
    k = z - d / 2,
    f = z + d / 2,
    bot = y - h / 2,
    top = y + h / 2
  b.face(
    mat,
    [
      [l, bot, f],
      [r, bot, f],
      [r, top, f],
      [l, top, f],
    ],
    tint
  )
  b.face(
    mat,
    [
      [r, bot, k],
      [l, bot, k],
      [l, top, k],
      [r, top, k],
    ],
    tint
  )
  if (edge)
    b.face(
      mat,
      [
        [l, top, f],
        [r, top, f],
        [r, top, k],
        [l, top, k],
      ],
      tint
    )
}
function fretLine(b, mat, x, y, X, Y, z, thick) {
  const len = Math.hypot(X - x, Y - y),
    dx = (((Y - y) / len) * thick) / 2,
    dy = (((x - X) / len) * thick) / 2
  b.face(mat, [
    [x - dx, y - dy, z],
    [X - dx, Y - dy, z],
    [X + dx, Y + dy, z],
    [x + dx, y + dy, z],
  ])
}
function bay(b, m, x, w, bottom, top, kind, seed, bright, detail, wallmat, walltint) {
  const H = top - bottom,
    bar = (y, h, dep = 0.16, mat = wallmat, tint = walltint) =>
      surface(b, mat, x, y, 0.009, w, h, dep, tint, true)
  if (kind === 'open') {
    bar(top - 0.3, 0.18, 0.22, m.darkwood)
    panel(b, m, art.fret, x, top - 0.3, 0.126, w - 0.09, 0.14)
    for (const s of S) {
      const q = x + s * (w / 2 - 0.075)
      if (detail) b.beam(m.wood, [q, top - 0.83, 0.037], [q - s * 0.45, top - 0.31, 0.037], 0.083, 0.135)
      else fretLine(b, m.wood, q, top - 0.83, q - s * 0.45, top - 0.31, 0.037, 0.091)
    }
    return
  }
  if (kind === 'door') {
    const edge = 0.19
    for (const s of S) b.box(m.timber, x + (s * (w - edge)) / 2, bottom + H * 0.46, 0, edge, H * 0.92, 0.19)
    bar(top - 0.37, 0.35, 0.17, m.wood)
    panel(b, m, art.fret, x, top - 0.38, 0.107, w - 0.09, 0.24)
    return
  }
  if (kind === 'plank' || kind === 'paint' || kind === 'white') {
    bar(
      bottom + H / 2,
      H,
      0.17,
      kind === 'plank' ? m.wood : m.plaster,
      kind === 'white' ? [1.0, 0.94, 0.82] : 1
    )
    if (kind === 'plank') panel(b, m, art.plank, x, bottom + H * 0.51, 0.102, w - 0.055, H - 0.12)
    if (kind === 'paint')
      panel(b, m, art.mountains + (seed % 3), x, bottom + H * 0.53, 0.102, w * 0.74, H * 0.59)
    bar(bottom + 0.22, 0.35, 0.217, m.foundation, 0.86)
    return
  }
  const sill = kind === 'loft' ? H * 0.18 : H * 0.29,
    head = top - H * (kind === 'loft' ? 0.179 : 0.18),
    ww = w * (kind === 'round' ? 0.77 : 0.86),
    cy = (head + bottom + sill) / 2,
    hh = head - bottom - sill
  bar(bottom + sill / 2, sill, 0.165, kind === 'loft' ? m.timber : wallmat)
  bar((head + top) / 2, top - head, 0.171, wallmat, walltint)
  for (const s of S) surface(b, wallmat, x + (s * (ww + w)) / 4, cy, 0, (w - ww) / 2, hh, 0.163, walltint)
  panel(b, m, kind === 'round' ? art.windowRound : seed % 8, x, cy, 0.008, ww, hh, true, bright)
  // The exposed mitered frames and screen sills protrude on both sides of the paper.
  for (const s of S) {
    surface(b, m.darkwood, x + (s * ww) / 2, cy, 0, 0.055, hh + 0.08, 0.106)
    surface(b, m.wood, x, cy + (s * hh) / 2, 0, ww + 0.09, 0.08, 0.142, 1, true)
  }
  if (kind === 'loft') panel(b, m, art.panel, x, bottom + sill * 0.54, 0.101, w - 0.14, sill * 0.7)
}
function elevation(b, m, w, H, side, floor, h, mode, base) {
  const n =
    side === 'front' || side === 'rear'
      ? Math.max(2, Math.min(4, Math.round(w / 2.72)))
      : Math.max(2, Math.min(3, Math.round(w / 2.83)))
  for (let j = 0; j < n; j++) {
    let kind
    const mid = Math.floor((n - 1) / 2),
      seed = (h.phase + j + floor * 3 + (side === 'front' ? 0 : 2)) % 8
    if (floor) {
      kind =
        side === 'front' && j === mid && mode === 'gallery'
          ? 'door'
          : side === 'front' && mode === 'openGallery'
            ? 'open'
            : side === 'rear' && (seed === 2 || seed === 3)
              ? 'plank'
              : seed === 4 && (h.form === 'tower' || h.form === 'guild')
                ? 'round'
                : 'loft'
    } else if (side === 'front') {
      kind =
        j === mid
          ? 'door'
          : mode === 'porch' || mode === 'stage' || h.form === 'work'
            ? 'open'
            : j === n - 1 && seed % 2
              ? 'open'
              : 'window'
    } else if (side === 'rear') {
      kind =
        j === 0 && h.phase % 3 !== 0 ? 'door' : seed === 1 ? 'plank' : seed % 3 === 0 ? 'white' : 'window'
    } else {
      kind =
        j === 0 && side === 'east' && (h.form === 'stage' || h.form === 'work' || h.form === 'terrace')
          ? 'open'
          : seed % 4 === 0
            ? 'plank'
            : seed % 3 === 0
              ? 'white'
              : 'window'
    }
    const bw = w / n,
      x = -w / 2 + (j + 0.5) * bw
    const timberBay =
      (h.form === 'work' && side !== 'west') ||
      (h.form === 'guild' && floor === 0 && side !== 'rear') ||
      (h.trade === 'wine' && j % 2 === 0) ||
      (h.form === 'court' && h.phase % 2 === 0 && side === 'rear')
    const pigment = timberBay ? m.wood : m.plaster,
      walltint = timberBay
        ? [0.84, 0.72, 0.68]
        : [
            [1.0, 0.97, 0.86],
            [0.8, 0.91, 0.91],
            [0.92, 0.84, 0.72],
            [0.96, 0.91, 0.87],
          ][h.phase % 4]
    bay(
      b,
      m,
      x,
      bw,
      base,
      base + H,
      kind,
      seed,
      0.72 + 0.09 * ((h.phase + j) % 4),
      h.row === 0 && side === 'front',
      pigment,
      walltint
    )
    if (j === 0) surface(b, m.timber, -w / 2, base + H * 0.5, 0, 0.127, H, 0.178)
    surface(b, m.timber, -w / 2 + (j + 1) * bw, base + H * 0.5, 0, 0.127, H, 0.178)
  }
  surface(b, m.darkwood, 0, base + H - 0.11, 0, w + 0.16, 0.2, 0.24, 1, true)
}
function body(b, m, w, d, base, H, h, level, frontMode) {
  for (const [side, x, z, a, len] of [
    ['front', 0, d / 2, 0, w],
    ['rear', 0, -d / 2, Math.PI, w],
    ['east', w / 2, 0, Math.PI / 2, d],
    ['west', -w / 2, 0, -Math.PI / 2, d],
  ])
    b.at(x, 0, z, a, () => elevation(b, m, len, H, side, level, h, frontMode, base))
}
export function floorPad(b, m, w, d, y = 0.19) {
  b.box(m.foundation, 0, (y - 0.12) / 2, 0, w, y + 0.12, d, [0.79, 0.83, 0.81])
  b.box(m.coping, 0, y - 0.037, 0, w + 0.05, 0.09, d + 0.05)
  const count = Math.ceil(d / 0.42)
  for (let j = 0; j < count; j++)
    b.face(
      m.wood,
      [
        [-w / 2, y + 0.012, -d / 2 + ((j + 0.03) * d) / count],
        [-w / 2, y + 0.012, -d / 2 + ((j + 0.97) * d) / count],
        [w / 2, y + 0.012, -d / 2 + ((j + 0.97) * d) / count],
        [w / 2, y + 0.012, -d / 2 + ((j + 0.03) * d) / count],
      ],
      0.79 + (0.17 * ((j * 3) % 7)) / 6,
      [
        [0, 0],
        [0.7, 0],
        [0.7, w],
        [0, w],
      ]
    )
}
export function balustrade(b, m, w, y, z, ornate = false) {
  const n = Math.max(2, Math.ceil(w / (ornate ? 1.24 : 1.65)))
  for (const h of [0.17, 0.77])
    b.box(h > 0.5 ? m.wood : m.timber, 0, y + h, z, w + 0.13, h > 0.5 ? 0.098 : 0.075, 0.105)
  for (let j = 0; j <= n; j++) {
    const x = w * (j / n - 0.5)
    b.box(m.timber, x, y + 0.43, z, 0.092, 0.88, 0.098)
    b.box(m.bronze, x, y + 0.89, z, 0.127, 0.051, 0.127, 0.84)
    if (j < n) {
      const dx = w / n,
        hh = ornate ? 0.22 : 0.188,
        mid = x + dx / 2
      for (const s of S) {
        fretLine(b, m.wood, mid - dx * 0.29, y + 0.46, mid, y + 0.46 + s * hh, z, 0.046)
        fretLine(b, m.wood, mid, y + 0.46 + s * hh, mid + dx * 0.29, y + 0.46, z, 0.046)
      }
    }
  }
}
function column(b, m, x, z, base, H, ornate) {
  b.box(m.coping, x, base + 0.14, z, 0.32, 0.27, 0.34)
  b.tube(m.timber, [x, base + 0.25, z], [x, base + H - 0.2, z], 0.124, 0.104, ornate ? 8 : 6, 1, false)
  surface(b, m.wood, x, base + H - 0.3, z, 0.39, 0.13, 0.26, 1, true)
  surface(b, m.teal, x, base + H - 0.15, z, 0.59, 0.14, 0.34, 1, true)
  if (ornate) surface(b, m.bronze, x, base + H - 0.068, z, 0.68, 0.055, 0.4, 1, true)
}
function gallery(b, m, h, w, front, base, H, floor, depth) {
  const z = front + depth
  b.box(m.darkwood, 0, base - 0.095, front + depth / 2, w + 0.15, 0.18, depth + 0.03)
  for (const side of S) {
    b.at((side * w) / 2, 0, front + depth / 2, Math.PI / 2, () => {
      if (floor) balustrade(b, m, depth, base, 0)
    })
  }
  const n = Math.max(2, Math.round(w / 2.6))
  for (let j = 0; j <= n; j++) {
    const x = (j / n - 0.5) * w
    column(b, m, x, z - 0.12, base, H, h.form === 'guild' || h.form === 'stage')
    if (floor) b.beam(m.wood, [x, base - 0.42, front - 0.07], [x, base - 0.11, z - 0.14], 0.09, 0.11)
  }
  b.box(m.darkwood, 0, base + H - 0.19, z - 0.12, w + 0.23, 0.23, 0.26)
  if (h.quay) panel(b, m, art.fret, 0, base + H - 0.2, z + 0.017, w + 0.04, 0.14)
  if (floor) balustrade(b, m, w, base, z - 0.11, h.quay)
}
function fascia(b, m, x, y, z, w) {
  b.box(m.darkwood, x, y, z, w + 0.09, 0.37, 0.095)
  picture(b, m.wardPaint, art.fret, x, y, z + 0.052, w, 0.26)
}
export function roofShape(b, m, x, y, z, w, d, rise, gable, shade, detail = true) {
  if (!gable) {
    hipRoof(b, m, x, y, z, w, d, rise, shade || m.roof, detail)
    return
  }
  const columns = 8,
    rows = 4,
    lift = Math.min(0.27, rise * 0.17)
  b.at(x, y, z, 0, () => {
    const p = (u, t, s, h = 0) => [
      (u * w) / 2,
      rise * (1 - t) ** 1.36 + lift * Math.abs(u) ** 4 * t * t + h,
      (s * t * d) / 2,
    ]
    for (const s of S) {
      for (let c = 0; c < columns; c++) {
        const l = (c * 2) / columns - 1,
          r = l + 2 / columns
        for (let j = 0; j < rows; j++) {
          const u = j / rows,
            v = (j + 1) / rows,
            quad = [p(l, u, s), p(r, u, s), p(r, v, s), p(l, v, s)],
            uv = [
              [l * w * 0.42, u * d * 0.43],
              [r * w * 0.42, u * d * 0.43],
              [r * w * 0.42, v * d * 0.43],
              [l * w * 0.42, v * d * 0.43],
            ]
          b.face(m.roof, s > 0 ? quad.reverse() : quad, 0.96, s > 0 ? uv.reverse() : uv)
          b.face(
            m.darkwood,
            [p(l, u, s, -0.09), p(r, u, s, -0.09), p(r, v, s, -0.09), p(l, v, s, -0.09)],
            0.83
          )
        }
        b.beam(m.roofEdge, p(l, 1, s), p(r, 1, s), 0.12, 0.135)
        if (detail && c % 2 === 0) b.beam(m.wood, p(l, 0.51, s, -0.15), p(l, 1, s, -0.115), 0.087, 0.112)
      }
      for (let j = 0; j < rows; j++)
        for (const edge of S)
          b.beam(m.roofEdge, p(edge, j / rows, s, 0.04), p(edge, (j + 1) / rows, s, 0.04), 0.082, 0.108)
    }
    b.tube(m.roofEdge, [-w / 2 - 0.035, rise + 0.09, 0], [w / 2 + 0.035, rise + 0.09, 0], 0.118, 0.118, 8)
  })
}
function fireWall(b, m, x, d, y, rise, front = false) {
  const n = 7,
    half = d / 2 + 0.03
  for (let j = 0; j < n; j++) {
    const a = -half + (2 * half * j) / n,
      c = a + (2 * half) / n,
      z = (a + c) / 2,
      top = y + rise * [0.22, 0.62, 0.96, 1.03, 0.96, 0.62, 0.22][j] + 0.3
    b.box(m.plaster, x, (top + y - 0.13) / 2, z, 0.2, top - y + 0.13, c - a)
    b.box(m.roofEdge, x, top + 0.015, z, 0.31, 0.105, c - a + 0.09)
    if (front && j % 2 === 0) b.box(m.patina, x, top - 0.05, z, 0.24, 0.045, c - a + 0.035)
  }
}
export function houseParts(h) {
  if (h.form !== 'split') return [{ house: h, x: 0, z: 0 }]
  const left = { ...h, w: h.w * 0.57, d: h.d - 0.23, form: 'gable' },
    right = { ...h, w: h.w * 0.37, d: h.d * 0.74, levels: 1, form: 'work', outbuilding: true }
  return [
    { house: left, x: -h.w / 2 + left.w / 2, z: -0.1 },
    { house: right, x: h.w / 2 - right.w / 2, z: -h.d * 0.113 },
  ]
}
export function shell(b, m, h) {
  const base = 0.18,
    dims = houseDimensions(h),
    { w, d, gH, uH, groundDepth, frontDepth, roofY, upperW, upperD } = dims
  floorPad(b, m, w + 0.47, d + 0.4, base)
  const porch = h.quay || h.form === 'terrace' || h.form === 'stage' || h.form === 'court',
    mode = h.form === 'stage' ? 'stage' : porch ? 'porch' : 'house'
  b.at(0, 0, -frontDepth / 2, 0, () => body(b, m, w, groundDepth, base, gH, h, 0, mode))
  if (porch) gallery(b, m, h, w, groundDepth / 2 - frontDepth / 2, base, gH, 0, frontDepth)
  const upperBase = base + gH
  if (h.levels > 1) {
    if (h.id === 13) b.at(0, 0, 0, Math.PI / 2, () => stairDeck(b, m, d, w, upperBase, true))
    else if ([3, 14, 15].includes(h.id)) stairDeck(b, m, w, d, upperBase)
    else b.box(m.darkwood, 0, upperBase - 0.085, 0, w + 0.41, 0.17, d + 0.36)
    const balcony = (d - upperD) / 2 + (h.quay ? 0.26 : 0)
    b.at(0, 0, h.quay ? -0.26 : 0, 0, () =>
      body(
        b,
        m,
        upperW,
        upperD,
        upperBase + 0.015,
        uH,
        h,
        1,
        h.form === 'stage' ? 'openGallery' : balcony > 0.56 ? 'gallery' : 'house'
      )
    )
    if (balcony > 0.54)
      gallery(b, m, h, upperW, upperD / 2 - (h.quay ? 0.26 : 0), upperBase + 0.03, uH, 1, balcony)
    if (h.quay || h.form === 'court' || h.form === 'terrace')
      fascia(b, m, 0, upperBase - 0.2, d / 2 + 0.22, w * 0.95)
    if (h.levels === 3) {
      const e = upperBase + uH,
        tw = upperW * 0.73,
        td = upperD * 0.72
      b.box(m.darkwood, 0, e - 0.07, -0.12, upperW + 0.56, 0.14, upperD + 0.49)
      skirt(b, m, upperW + 0.75, upperD + 0.81, tw + 0.09, td + 0.09, e + 0.12, e + 0.58, -0.12)
      if (h.form === 'tower') drum(b, m, tw, td, e + 0.43, dims.tH - 0.43, h)
      else b.at(0, 0, -0.12, 0, () => body(b, m, tw, td, e + 0.43, dims.tH - 0.43, h, 2, 'house'))
    }
  }
  const topW = h.levels === 3 ? upperW * 0.73 : h.levels === 2 ? upperW : w,
    topD = h.levels === 3 ? upperD * 0.72 : h.levels === 2 ? upperD : d,
    center = h.levels === 3 ? -0.12 : h.levels > 1 && h.quay ? -0.26 : 0
  const roofW = h.levels === 3 ? topW + 1.12 : h.w,
    roofD = h.levels === 3 ? topD + 1.32 : h.d
  const rise = gabled(h)
    ? 1.44 + h.phase * 0.065
    : h.form === 'guild' || h.form === 'tower'
      ? 1.9
      : 1.38 + (h.phase % 3) * 0.185
  const z = h.levels === 2 && h.quay ? 0 : center
  if (h.form === 'tower') spire(b, m, roofW, roofD, roofY, rise)
  else roofShape(b, m, 0, roofY, z, roofW, roofD, rise, gabled(h), m.roof, h.quay)
  if (gabled(h))
    for (const end of S) {
      if (end === 1 || h.phase % 2 === 0) fireWall(b, m, end * (topW / 2), topD, roofY, rise, h.quay)
      else
        b.face(m.plaster, [
          [(end * topW) / 2, roofY - 0.08, -topD / 2],
          [(end * topW) / 2, roofY + rise - 0.1, 0],
          [(end * topW) / 2, roofY - 0.08, topD / 2],
        ])
    }
  if (h.levels > 1 && h.form === 'terrace')
    skirt(b, m, h.w - 0.07, h.d - 0.07, upperW + 0.13, upperD + 0.17, upperBase - 0.1, upperBase + 0.48, 0)
  b.box(m.coping, -w * 0.1, 0.103, d / 2 + 0.32, Math.min(2.1, w * 0.54), 0.115, 0.47)
  if (!h.outbuilding)
    plaque(b, m, h, 0, base + gH - 0.83, d / 2 + 0.05, Math.min(w * 0.42, 3.25), h.quay ? 0.67 : 0.54)
  return dims
}
export function houseDimensions(h) {
  const w = h.w - 1.1,
    d = h.d - 1.12,
    porch = h.quay || ['terrace', 'stage', 'court'].includes(h.form)
  const gH = h.form === 'stage' ? 3.91 : h.quay ? 3.47 + (h.phase % 3) * 0.15 : 3.08 + (h.phase % 3) * 0.12,
    uH = h.form === 'guild' || h.form === 'stage' ? 3.25 : 2.75 + (h.phase % 3) * 0.12,
    tH = h.form === 'tower' ? 3.28 : 2.98
  const frontDepth = porch ? 1.04 + (h.row === 0 ? 0.27 : 0) : 0,
    upperW = w * (h.form === 'tower' ? 0.8 : h.form === 'guild' ? 0.9 : 0.965),
    upperD = d * (h.form === 'terrace' || h.form === 'stage' ? 0.65 : h.quay ? 0.77 : 0.91)
  return {
    w,
    d,
    upperW,
    upperD,
    groundDepth: d - frontDepth,
    frontDepth,
    gH,
    uH,
    tH,
    roofY: 0.18 + gH + (h.levels > 1 ? uH : 0) + (h.levels > 2 ? tH : 0),
  }
}
function skirt(b, m, w, d, wi, di, y, top, z) {
  for (const sx of S)
    for (const sd of [false, true]) {
      const p = (v, inner) => {
        const a = inner ? wi / 2 : w / 2,
          c = inner ? di / 2 : d / 2
        return sd ? [v * a, inner ? top : y, z + sx * c] : [sx * a, inner ? top : y, z + v * c]
      }
      for (let j = 0; j < 5; j++) {
        const a = j * 0.4 - 1,
          c = a + 0.4,
          pp = [p(a, false), p(c, false), p(c, true), p(a, true)]
        b.face(m.roof, pp, 0.95, [
          [a * 3, 0],
          [c * 3, 0],
          [c * 3, 0.65],
          [a * 3, 0.65],
        ])
        b.beam(m.roofEdge, pp[0], pp[1], 0.087, 0.104)
      }
    }
}
export function plaque(b, m, h, x, y, z, w, height) {
  b.box(m.darkwood, x, y, z, w + 0.11, height + 0.09, 0.097)
  picture(b, m.wardSigns, h.id, x, y, z + 0.057, w, height, 1, true)
}

function hipRoof(b, m, x, y, z, w, d, rise, shade, detail) {
  const ridge = Math.max(0.24, w / 2 - Math.min(d * 0.35, w * 0.31)),
    W = w / 2,
    D = d / 2,
    lift = Math.min(0.52, 0.26 * rise)
  b.at(x, y, z, 0, () => {
    for (const side of S)
      for (const end of [false, true]) {
        const pt = (v, t, off = 0) => {
          const Y = rise * (0.16 * t + 0.84 * t ** 1.65) + lift * (1 - t) ** 2.3 * Math.abs(v) ** 3.2 + off
          return end
            ? [side * (W + (ridge - W) * t), Y, v * D * (1 - t)]
            : [v * (W + (ridge - W) * t), Y, side * D * (1 - t)]
        }
        const nx = detail ? 7 : 5,
          ny = 3
        for (let k = 0; k < nx; k++) {
          const a = (2 * k) / nx - 1,
            c = a + 2 / nx
          for (let j = 0; j < ny; j++) {
            const u = j / ny,
              v = (j + 1) / ny,
              quad = [pt(a, u), pt(c, u), pt(c, v), pt(a, v)],
              uv = quad.map((p, i) => [
                (end ? p[2] : p[0]) * 0.8,
                (i < 2 ? u : v) * (end ? W - ridge : D) * 0.85,
              ])
            if (end && j === ny - 1) {
              quad.pop()
              uv.pop()
            }
            b.face(shade, quad, 0.91 + 0.05 * (k % 3), uv)
          }
          const a0 = pt(a, 0, -0.08),
            a1 = pt(c, 0, -0.08),
            top = pt(c, 0, 0.035),
            left = pt(a, 0, 0.035)
          b.face(m.roofEdge, [a0, a1, top, left])
          b.face(m.wood, [pt(a, 0, -0.15), pt(c, 0, -0.15), a1, a0])
          if (detail && !end && k % 2 === 0)
            b.beam(m.timber, pt(a, 0, -0.145), pt(a, 0.42, -0.145), 0.087, 0.114)
        }
        const unders = [pt(-1, 0, -0.098), pt(1, 0, -0.098), pt(1, 1, -0.098), pt(-1, 1, -0.098)]
        if (end) unders.pop()
        b.face(m.darkwood, unders, 0.84)
        if (!end)
          for (const edge of S) {
            for (let j = 0; j < 5; j++) {
              const a = pt(edge, j / 5, 0.075),
                c = pt(edge, (j + 1) / 5, 0.075),
                dx = 0.07
              for (const sign of S)
                b.face(
                  m.roofEdge,
                  [[a[0] + sign * dx, a[1] - 0.039, a[2]], [c[0] + sign * dx, c[1] - 0.039, c[2]], c, a],
                  sign > 0 ? 1 : 0.91
                )
            }
            const p = pt(edge, 0, 0.05),
              tip = [p[0] + edge * 0.18, p[1] + 0.17, p[2] + side * 0.15]
            b.beam(m.roofEdge, p, tip, 0.117, 0.102)
            b.beam(m.bronze, tip, [tip[0] + edge * 0.06, tip[1] + 0.14, tip[2] + side * 0.07], 0.065, 0.061)
          }
      }
    b.box(m.roofEdge, 0, rise + 0.08, 0, ridge * 2 + 0.2, 0.18, 0.21)
    for (const s of S) {
      b.beam(m.roofEdge, [s * ridge, rise + 0.13, 0], [s * (ridge + 0.16), rise + 0.31, 0], 0.129, 0.12)
    }
  })
}

function stairDeck(b, m, w, d, y, stage = false) {
  const end = w * 0.22,
    start = -w * 0.43,
    zc = -d * (stage ? 0.405 : 0.27),
    cutLeft = start + 0.64,
    cutRight = end + 0.12,
    half = 0.49
  const slab = (x0, x1, z0, z1) => {
    if (x1 > x0 && z1 > z0) b.box(m.wood, (x0 + x1) / 2, y - 0.08, (z0 + z1) / 2, x1 - x0, 0.16, z1 - z0)
  }
  slab(-(w + 0.41) / 2, (w + 0.41) / 2, zc + half, (d + 0.36) / 2)
  slab(-(w + 0.41) / 2, (w + 0.41) / 2, -(d + 0.36) / 2, zc - half)
  slab(-(w + 0.41) / 2, cutLeft, zc - half, zc + half)
  slab(cutRight, (w + 0.41) / 2, zc - half, zc + half)
  const n = Math.ceil((y - 0.18) / 0.2),
    step = (end - start) / n
  for (let j = 0; j < n; j++) {
    const top = 0.18 + ((j + 1) * (y - 0.18)) / n,
      x = start + (j + 0.5) * step
    b.box(m.wood, x, top - 0.043, zc, step + 0.014, 0.086, half * 1.92)
    b.box(m.darkwood, x - step * 0.38, top - 0.106, zc, 0.055, 0.165, half * 1.9)
  }
  b.box(m.wood, end + 0.087, y - 0.045, zc, 0.22, 0.09, 0.98)
  b.beam(m.wood, [start, 0.88, zc - half], [end, y + 0.7, zc - half], 0.065, 0.074)
  for (let j = 0; j <= 5; j++) {
    const t = j / 5
    b.box(m.wood, start + (end - start) * t, 0.56 + t * (y - 0.18), zc - half, 0.062, 0.7, 0.06)
  }
}
function drum(b, m, w, d, y, height, h) {
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) * Math.PI) / 4,
      c = a + Math.PI / 4,
      p = (t) => [Math.cos(t) * w * 0.5, -0.12 + Math.sin(t) * d * 0.5],
      P = p(a),
      Q = p(c),
      cx = (P[0] + Q[0]) / 2,
      cz = (P[1] + Q[1]) / 2,
      ang = Math.atan2(-(Q[1] - P[1]), Q[0] - P[0]),
      len = Math.hypot(Q[0] - P[0], Q[1] - P[1])
    b.at(cx, 0, cz, ang, () => {
      picture(b, m.wardScreens, k % 8, 0, y + height * 0.49, 0.015, len - 0.08, height * 0.7)
      b.box(m.wood, 0, y + 0.21, 0, len + 0.03, 0.42, 0.13)
      b.box(m.teal, 0, y + height - 0.19, 0, len + 0.04, 0.39, 0.13)
    })
    b.box(m.timber, P[0], y + height / 2, P[1], 0.131, height, 0.131)
  }
}
function spire(b, m, w, d, y, rise) {
  const n = 8,
    half = d * 0.52,
    flat = w * 0.52,
    y0 = y,
    h = rise * 1.55,
    pt = (a, t) => [
      Math.cos(a) * flat * (1 - t),
      y0 + h * t ** 1.45 + 0.32 * (1 - t) ** 3,
      -0.12 + Math.sin(a) * half * (1 - t),
    ]
  for (let j = 0; j < n; j++) {
    const a = ((j + 0.5) * Math.PI) / 4,
      c = a + Math.PI / 4
    for (let k = 0; k < 4; k++) {
      const u = k / 4,
        v = (k + 1) / 4,
        quad = [pt(a, u), pt(c, u), pt(c, v), pt(a, v)]
      if (k === 3) quad.pop()
      b.face(
        m.roof,
        quad,
        0.95,
        k === 3
          ? [
              [0, 3 * u],
              [1, 3 * u],
              [0.5, 3 * v],
            ]
          : [
              [0, 3 * u],
              [1, 3 * u],
              [0.82, 3 * v],
              [0.18, 3 * v],
            ]
      )
      b.beam(m.roofEdge, pt(a, u), pt(a, v), 0.105, 0.09)
    }
    b.beam(m.darkwood, pt(a, 0), pt(c, 0), 0.115, 0.14)
    b.face(m.darkwood, [pt(a, 0), pt(c, 0), [0, y + h * 0.87, -0.12]], 0.75)
  }
  b.tube(m.bronze, [0, y + h, -0.12], [0, y + h + 0.73, -0.12], 0.14, 0.03, 8)
  b.tube(m.bronze, [0, y + h + 0.15, -0.12], [0, y + h + 0.37, -0.12], 0.2, 0.069, 8)
}
