import { add } from './mesh.js'
import { roof } from './kit.js'
import { footprint, pillar, lightBox, floorDeck, ring } from './summitCraft.js'
import { silk, plaque } from './summitSilk.js'

function brackets(b, m, p, w) {
  // Interlocking cloud arms have a stepped lower edge and a gold upper lip.
  for (const axis of [0, 2]) {
    const points = [
      [-w, 0.56],
      [-w * 0.49, 0.25],
      [0, -0.08],
      [w * 0.49, 0.25],
      [w, 0.56],
    ]
    for (let k = 1; k < points.length; k++) {
      const [x0, y0] = points[k - 1],
        [x1, y1] = points[k]
      const at = (x, y, d) => (axis === 0 ? add(p, [x, y, d]) : add(p, [d, y, x]))
      const z = 0.102
      for (const side of [-z, z])
        b.face(m.teal, [at(x0, y0, side), at(x1, y1, side), at(x1, 0.67, side), at(x0, 0.67, side)])
      b.face(m.timber, [at(x0, y0, -z), at(x1, y1, -z), at(x1, y1, z), at(x0, y0, z)])
    }
    const at = (a, y) => (axis === 0 ? add(p, [a, y, 0]) : add(p, [0, y, a]))
    b.tube(m.bronze, at(-w, 0.64), at(w, 0.64), 0.087, 0.087, 4, 1, false)
  }
}
function facade(b, m, w, h, bays, door, design = 0) {
  const pitch = w / bays
  b.box(m.teal, 0, h - 0.32, 0, w, 0.57, 0.27)
  b.box(m.bronze, 0, h - 0.63, 0.04, w, 0.078, 0.29)
  for (let i = 0; i < bays; i++) {
    const x = -w / 2 + (i + 0.5) * pitch,
      open = door.includes(i),
      panelW = pitch - 0.3
    if (open) {
      b.box(m.wood, x, h - 0.91, 0, panelW, 0.41, 0.24)
      for (const s of [-1, 1]) {
        const xx = x + s * (pitch * 0.5 - 0.19)
        b.box(m.wood, xx, (h - 0.72) * 0.5, 0.005, 0.19, h - 0.72, 0.29)
        b.box(m.patina, xx, 0.5, 0.16, 0.18, 0.15, 0.06)
      }
    } else {
      const sill = h > 5 ? 1.18 : 0.77,
        top = h - 0.92,
        panelH = top - sill
      b.box(m.timber, x, sill * 0.5, 0, panelW, sill, 0.23)
      b.box(m.teal, x, 0.42, 0.13, panelW * 0.76, 0.38, 0.055)
      const n = Math.max(1, Math.round(panelW / 1.38)),
        window = panelW / n
      for (let j = 0; j < n; j++) {
        const px = x - panelW / 2 + (j + 0.5) * window
        if (panelH > 3.7) {
          const division = sill + panelH * 0.56
          silk(
            b,
            m.summitScreen,
            px,
            (sill + division) / 2 - 0.055,
            0.04,
            window - 0.058,
            division - sill - 0.11,
            design
          )
          silk(
            b,
            m.summitScreen,
            px,
            (division + top) / 2 + 0.055,
            0.04,
            window - 0.058,
            top - division - 0.11,
            (design + 1) % 4,
            0.87
          )
          b.box(m.teal, px, division, 0.049, window, 0.22, 0.15)
        } else silk(b, m.summitScreen, px, sill + panelH / 2, 0.04, window - 0.058, panelH, design)
        b.box(m.darkwood, px - window * 0.5, sill + panelH * 0.5, 0.055, 0.073, panelH + 0.16, 0.17)
      }
      b.box(m.darkwood, x, sill, 0.04, panelW, 0.12, 0.23)
      b.box(m.darkwood, x, top, 0.04, panelW, 0.12, 0.23)
    }
    b.box(m.timber, -w / 2 + i * pitch, 0.5 * h, 0.02, 0.22, h, 0.28)
  }
  b.box(m.timber, w / 2, h / 2, 0.02, 0.22, h, 0.28)
}
export function roundRoom(
  b,
  m,
  { x, z, rx, rz, bottom, top, clip = 0.35, openFaces = [], doors = [0], design = 0, broad = false }
) {
  b.at(x, bottom, z, 0, () => {
    const loop = footprint(rx, rz, clip),
      height = top - bottom
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i],
        c = loop[(i + 1) % loop.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        w = Math.hypot(dx, dz)
      const mid = [(a[0] + c[0]) * 0.5, 0, (a[1] + c[1]) * 0.5]
      const yaw = Math.atan2(-dz, dx)
      pillar(b, m, a[0], a[1], 0, height, broad ? 0.41 : 0.29)
      b.beam(m.timber, [a[0], height - 0.12, a[1]], [c[0], height - 0.12, c[1]], 0.36, 0.35)
      if (w > 2.2 && !openFaces.includes(i))
        b.at(mid[0], 0, mid[2], yaw, () => {
          const n = broad ? Math.max(1, Math.round(w / 3.35)) : Math.max(1, Math.round(w / 2.9))
          facade(
            b,
            m,
            w - 0.22,
            height - 0.29,
            n,
            doors.includes(i) ? [Math.floor(n / 2)] : [],
            (design + (i % 2)) % 4
          )
        })
      if (broad || i % 2 === 0) brackets(b, m, [a[0], height - 0.79, a[1]], broad ? 0.84 : 0.56)
    }
  })
}
function cloisterRoof(b, m, w, d, y) {
  const half = w / 2,
    depth = d / 2,
    rise = 1.78,
    cols = 6,
    rows = 4
  for (const sign of [-1, 1]) {
    const p = (x, u, h = 0) => [
      x,
      y + rise * (0.25 * u + 0.75 * u * u) + 0.37 * (Math.abs(x) / half) ** 4 * (1 - u) ** 2 + h,
      sign * depth * (1 - u),
    ]
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const a = -half + (w * i) / cols,
          c = -half + (w * (i + 1)) / cols,
          u = j / rows,
          v = (j + 1) / rows
        b.face(m.roof, [p(a, u), p(c, u), p(c, v), p(a, v)], 1, [
          [a * 0.72, u * 2],
          [c * 0.72, u * 2],
          [c * 0.72, v * 2],
          [a * 0.72, v * 2],
        ])
        b.face(m.darkwood, [p(a, u, -0.12), p(a, v, -0.12), p(c, v, -0.12), p(c, u, -0.12)])
        if (j === 0) b.beam(m.patina, p(a, 0), p(c, 0), 0.16, 0.14)
      }
    for (const sx of [-1, 1])
      for (let j = 0; j < rows; j++)
        b.tube(
          m.roofEdge,
          p(sx * half, j / rows, 0.062),
          p(sx * half, (j + 1) / rows, 0.062),
          0.13,
          0.13,
          6,
          1,
          false
        )
  }
  for (const sx of [-1, 1])
    b.face(
      m.plaster,
      [
        [sx * (half - 0.08), y, -depth],
        [sx * (half - 0.08), y, depth],
        [sx * (half - 0.08), y + rise, 0],
      ],
      0.9
    )
  b.tube(m.patina, [-half - 0.14, y + rise + 0.08, 0], [half + 0.14, y + rise + 0.08, 0], 0.18, 0.18, 8)
}
export function galleryHall(b, m, x, y, z, w, d, h, style, name, open = false) {
  b.at(x, y, z, 0, () => {
    floorDeck(b, m, w / 2 + 0.95, d / 2 + 0.95, 0.14, 0.24, 0, 0.22)
    const W = w / 2,
      D = d / 2
    if (!open)
      for (const [px, pz, angle, len, bays, entry] of [
        [0, D - 1.03, 0, w - 2.2, 5, [2]],
        [0, -D + 0.99, Math.PI, w - 2.2, 5, [2]],
        [W - 1.1, 0, Math.PI / 2, d - 2.0, 3, [1]],
        [-W + 1.1, 0, -Math.PI / 2, d - 2.0, 3, [1]],
      ])
        b.at(px, 0.14, pz, angle, () => facade(b, m, len, h - 0.2, bays, entry, style))
    const cols = w > 19 ? 6 : w > 12 ? 4 : 3
    for (const s of [-1, 1]) {
      for (let j = 0; j < cols; j++) {
        const xx = -W + 0.22 + (j * (w - 0.44)) / (cols - 1)
        pillar(b, m, xx, s * (D - 0.21), 0.14, h, 0.31)
        if (!open || j === 0 || j === cols - 1) brackets(b, m, [xx, h - 0.61, s * (D - 0.21)], 0.67)
      }
      b.beam(
        m.vermilion,
        [-W - 0.25, h - 0.13, s * (D - 0.21)],
        [W + 0.25, h - 0.13, s * (D - 0.21)],
        0.29,
        0.43
      )
      b.beam(
        m.bronze,
        [-W - 0.24, h - 0.35, s * (D - 0.21)],
        [W + 0.24, h - 0.35, s * (D - 0.21)],
        0.18,
        0.072
      )
    }
    if (open && name === undefined) cloisterRoof(b, m, w + 2.38, d + 1.91, h + 0.18)
    else
      roof(b, m, 0, h + 0.19, 0, w + 3.3, d + 3.35, Math.max(2.35, w * 0.126), {
        hip: 0.23,
        lift: 0.76,
        detail: !open,
      })
    if (name !== undefined) plaque(b, m, 0, h - 0.56, D + 0.04, Math.min(w * 0.28, 4.9), 0.83, name)
    for (const s of [-1, 1]) {
      const xx = s * (W - 1.64)
      b.tube(m.bronze, [xx, h - 0.24, D - 0.2], [xx, h - 1.02, D - 0.2], 0.024, 0.024, 5)
      lightBox(b, m, xx, h - 1.47, D - 0.2, 0.35, 0.89)
    }
  })
}

export function readingRoom(b, m, x, y, z) {
  b.at(x, y, z, 0, () => {
    for (const sx of [-1, 1]) {
      const x1 = sx * 6.1
      b.box(m.timber, x1, 1.2, -2.1, 3.55, 2.4, 0.42)
      for (let j = 0; j < 4; j++) {
        b.box(m.wood, x1, 0.22 + j * 0.62, -1.8, 3.68, 0.11, 0.57)
        for (let k = 0; k < 7; k++) {
          const xx = x1 - 1.47 + k * 0.45,
            hh = 0.31 + 0.12 * ((k + j) % 3)
          b.box(
            (k + j) % 3 === 0 ? m.teal : m.vermilion,
            xx,
            0.29 + j * 0.62 + hh * 0.5,
            -1.78,
            0.27,
            hh,
            0.39,
            0.77 + 0.1 * (k % 3)
          )
          b.box(m.pearl, xx, 0.31 + j * 0.62 + hh * 0.39, -1.57, 0.061, hh * 0.51, 0.021)
        }
      }
      b.box(m.wood, sx * 5.8, 0.88, 1.54, 2.56, 0.17, 1.05)
      for (const a of [-1, 1])
        for (const c of [-1, 1])
          b.box(m.darkwood, sx * 5.8 + a * 1.03, 0.42, 1.54 + c * 0.37, 0.14, 0.84, 0.14)
      silk(b, m.summitScreen, sx * 5.8, 2.5, -2.53, 2.38, 2.85, 2, 0.82)
    }
    b.box(m.timber, 0, 1.12, -1.8, 3.12, 0.18, 1.81)
    for (const a of [-1, 1])
      for (const c of [-1, 1]) b.box(m.wood, a * 1.24, 0.55, -1.8 + c * 0.64, 0.18, 1.1, 0.18)
    ring(b, m.bronze, [0, 1.234, -1.8], 0.65, 0.042, 'xz', 24, 1.06)
    b.beam(m.patina, [-0.54, 1.28, -1.68], [0.5, 1.28, -1.94], 0.13, 0.07)
  })
}
export function bells(b, m, x, y, z) {
  b.at(x, y, z, 0, () => {
    for (const s of [-1, 1]) pillar(b, m, s * 2.42, 0, 0, 3.8, 0.23)
    b.beam(m.wood, [-2.64, 3.64, 0], [2.64, 3.64, 0], 0.31, 0.38)
    for (let i = -2; i <= 2; i++) {
      const xx = i * 0.89,
        h = 0.78 + (i + 2) * 0.091,
        off = 3.04 - Math.abs(i) * 0.11
      b.tube(m.bronze, [xx, 3.58, 0], [xx, off, 0], 0.037, 0.038, 6)
      const profile = [
        [0, 0.19],
        [-0.12, 0.23],
        [-0.23, 0.29],
        [-0.61, 0.33],
        [-0.78, 0.39],
        [-0.84, 0.45],
      ]
      for (let j = 1; j < profile.length; j++) {
        const [a, r] = profile[j - 1],
          [c, q] = profile[j]
        b.tube(
          j === 4 ? m.bronze : m.patina,
          [xx, off + a * h, 0],
          [xx, off + c * h, 0],
          r * h,
          q * h,
          10,
          0.9,
          false
        )
      }
      b.tube(m.darkwood, [xx, off - 0.4 * h, 0], [xx, off - 0.87 * h, 0], 0.035, 0.047, 5)
      b.tube(m.bronze, [xx, off - 0.88 * h, 0], [xx, off - 0.96 * h, 0], 0.091, 0.065, 7)
    }
  })
}
