import { add, cross, scaled, sub, unit } from './mesh.js'
import { reachFace } from './reachWardArt.js'
const sign = [-1, 1]
export function box(b, mat, slot, x, y, z, w, h, d, tint = 1) {
  const l = x - w / 2,
    r = x + w / 2,
    k = z - d / 2,
    f = z + d / 2,
    lo = y - h / 2,
    hi = y + h / 2
  const a = [l, lo, f],
    q = [r, lo, f],
    c = [r, hi, f],
    e = [l, hi, f],
    u = [l, lo, k],
    v = [r, lo, k],
    i = [r, hi, k],
    j = [l, hi, k]
  for (const side of [
    [a, q, c, e],
    [v, u, j, i],
    [q, v, i, c],
    [u, a, e, j],
    [e, c, i, j],
    [u, v, q, a],
  ])
    reachFace(b, mat, slot, side, tint)
}
export function beam(b, mat, slot, a, v, w, d = w, tint = 1) {
  const dir = unit(sub(v, a)),
    side = scaled(unit(cross(Math.abs(dir[1]) > 0.94 ? [0, 0, 1] : [0, 1, 0], dir)), w / 2),
    up = scaled(unit(cross(dir, side)), d / 2)
  const offsets = [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ].map(([p, q]) => add(scaled(side, p), scaled(up, q))),
    s = offsets.map((o) => add(a, o)),
    t = offsets.map((o) => add(v, o))
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    reachFace(b, mat, slot, [s[i], s[j], t[j], t[i]], tint)
  }
  reachFace(b, mat, slot, s, tint)
  reachFace(b, mat, slot, t, tint)
}
export function panel(b, mat, slot, x, lower, z, w, h, tint = 1) {
  reachFace(
    b,
    mat,
    slot,
    [
      [x - w / 2, lower, z],
      [x + w / 2, lower, z],
      [x + w / 2, lower + h, z],
      [x - w / 2, lower + h, z],
    ],
    tint
  )
}
export function roof(b, m, w, d, y, rise, hip, lift, style, quiet = false) {
  const mat = m.reachFrame,
    R = w / 2,
    D = d / 2,
    us = [-1, -0.65, 0, 0.65, 1],
    tiers = [0, 0.43, 1]
  const pos = (u, t, s) => [
    u * R * (1 - t * hip),
    y + rise * (0.28 * t + 0.72 * t * t) + lift * Math.abs(u) ** 4 * (1 - t) ** 1.4,
    s * D * (1 - t),
  ]
  for (const s of sign) {
    for (let k = 0; k < 2; k++)
      for (let j = 0; j < 4; j++) {
        const a = us[j],
          c = us[j + 1],
          t = tiers[k],
          T = tiers[k + 1]
        reachFace(
          b,
          mat,
          style.roof,
          [pos(a, t, s), pos(c, t, s), pos(c, T, s), pos(a, T, s)],
          s > 0 ? 1 : 0.92,
          [
            [0.5 + a * 0.5, t],
            [0.5 + c * 0.5, t],
            [0.5 + c * 0.5, T],
            [0.5 + a * 0.5, T],
          ]
        )
      }
    for (let j = 0; j < 4; j++) {
      const a = pos(us[j], 0, s),
        c = pos(us[j + 1], 0, s),
        p = a.slice(),
        q = c.slice()
      p[1] -= 0.15
      q[1] -= 0.15
      reachFace(b, mat, style.wood, [p, q, c, a], 0.84)
    }
  }
  for (const s of sign) {
    for (let k = 0; k < 2; k++) {
      const t = tiers[k],
        T = tiers[k + 1],
        a = pos(s, t, 1),
        c = pos(s, t, -1),
        p = pos(s, T, 1),
        q = pos(s, T, -1)
      const middle = (lo, hi) => [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2 - lift * (1 - t), 0]
      const v = middle(a, c),
        V = [p[0], p[1] - lift * (1 - T), 0]
      const slot = hip < 0.13 ? style.wall : style.roof
      if (k === 1) {
        reachFace(b, mat, slot, [a, v, p], 0.94)
        reachFace(b, mat, slot, [v, c, p], 0.94)
      } else {
        reachFace(b, mat, slot, [a, v, V, p], 0.94)
        reachFace(b, mat, slot, [v, c, q, V], 0.94)
      }
    }
  }
  const ridge = R * (1 - hip)
  box(b, mat, style.roof, 0, y + rise + 0.06, 0, ridge * 2, 0.17, 0.23, 1.13)
  if (!quiet)
    for (const s of sign)
      beam(
        b,
        mat,
        style.roof,
        [s * (ridge - 0.35), y + rise + 0.11, 0],
        [s * (ridge + 0.23), y + rise + 0.4, 0],
        0.16,
        0.15,
        1.05
      )
}
function shoulder(b, m, w, d, wi, di, y, style) {
  const outer = [
      [-w / 2, y, d / 2],
      [w / 2, y, d / 2],
      [w / 2, y, -d / 2],
      [-w / 2, y, -d / 2],
    ],
    inner = [
      [-wi / 2, y + 0.53, di / 2],
      [wi / 2, y + 0.53, di / 2],
      [wi / 2, y + 0.53, -di / 2],
      [-wi / 2, y + 0.53, -di / 2],
    ]
  for (let j = 0; j < 4; j++) {
    const k = (j + 1) % 4
    reachFace(b, m.reachFrame, style.roof, [outer[j], outer[k], inner[k], inner[j]])
    const a = outer[j],
      c = outer[k]
    reachFace(b, m.reachFrame, style.wood, [[a[0], y - 0.18, a[2]], [c[0], y - 0.18, c[2]], c, a], 0.88)
  }
}
function room(h, floor, side, bay, n, seed) {
  const k = seed % 4,
    front = side === 'front',
    night = h.use,
    center = Math.floor(n / 2),
    principal = Math.min(h.floors - 1, 1 + (h.phase % 2))
  if (!front) {
    if (
      side === 'side' &&
      floor === principal &&
      (night === 'banquet' || night === 'gallery') &&
      (h.phase % 3 !== 0 || h.sig)
    )
      return bay === 0 || bay === n - 1 || seed % 3 === 0 ? 68 + k : 72 + k
    if (side === 'side' && floor === principal && night === 'work' && seed % 7 < 2) return 72 + k
    if (!floor && seed % 4 !== 0) return seed % 4 === 1 ? 34 : h.style.wall
    if (seed % 9 < 4) return h.style.wall
    if (h.sig && night === 'banquet' && floor === principal && seed % 5 === 0) return 68 + k
    return [8 + k, 64 + k, 72 + k, 76 + k, 84 + k, 34][seed % 6]
  }
  if (night === 'shutter') {
    if (floor === principal && bay === h.phase % n) return 64 + k
    return [34, h.style.wall, 84 + k, 8 + k, h.style.wall][seed % 5]
  }
  if (night === 'home') {
    if (floor === principal && bay === h.phase % n) return h.phase % 2 ? k + 1 : 80 + k
    if (floor === principal && h.phase % 3 === 1 && Math.abs(bay - (h.phase % n)) === 1) return 72 + k
    if (!floor && seed % 3 === 0) return 76 + k
    return [64 + k, h.style.wall, 84 + k, 72 + k, 8 + k, 34][seed % 6]
  }
  if (night === 'work') {
    if (floor === 0 && bay !== center) return seed % 3 === 0 ? 80 + k : 84 + k
    if (floor === Math.min(1, h.floors - 1)) return h.phase % 3 === 1 && bay === center ? 68 + k : 72 + k
    return [34, 64 + k, h.style.wall, 84 + k, 8 + k][seed % 5]
  }
  if (floor === principal)
    return night === 'banquet' ? (bay % 3 === 1 ? 80 + k : 68 + k) : bay % 2 === 0 ? 68 + k : 64 + k
  if (floor === 0 && bay !== center) return seed % 2 === 1 ? 68 + k : 64 + k
  if (night === 'banquet' && Math.abs(floor - principal) === 1 && floor > 0 && seed % 4 !== 0) return 72 + k
  if (floor === h.floors - 1 && h.kind === 'lantern') return 72 + k
  return [76 + k, 64 + k, h.style.wall, 84 + k, 8 + k, h.style.wall][seed % 6]
}
function recessed(b, m, h, slot, x, y, w, H, seed, glazed) {
  const sill = H * (slot >= 72 && slot < 76 ? 0.46 : 0.19 + 0.055 * (seed % 3)),
    head = H * (0.13 + 0.04 * (seed % 3)),
    jamb = Math.min(0.29, w * 0.105),
    win = w - jamb * 2,
    winH = H - sill - head,
    depth = glazed ? 0.44 : 0.23
  const outer = m.reachFrame,
    wall = h.style.wall
  panel(b, outer, wall, x, y, 0, w, sill, 0.88)
  panel(b, outer, wall, x, y + H - head, 0, w, head, 0.83)
  for (const s of sign) {
    panel(b, outer, wall, x + (s * (w - jamb)) / 2, y + sill, 0, jamb, winH, 0.94)
    const X = x + (s * win) / 2
    reachFace(
      b,
      outer,
      24,
      [
        [X, y + sill, 0],
        [X, y + sill, -depth],
        [X, y + sill + winH, -depth],
        [X, y + sill + winH, 0],
      ],
      0.67
    )
  }
  reachFace(
    b,
    outer,
    27,
    [
      [x - win / 2, y + sill, 0],
      [x + win / 2, y + sill, 0],
      [x + win / 2, y + sill, -depth],
      [x - win / 2, y + sill, -depth],
    ],
    0.81
  )
  panel(b, outer, slot, x, y + sill, -depth, win, winH, 0.85 + (seed % 5) * 0.043)
  if (glazed) {
    const f = 0.6 * win,
      xx = x + ((seed % 2 ? 1 : -1) * (win - f)) / 2,
      z = -0.065
    const points = [
      [xx - f / 2, y + sill, z],
      [xx + f / 2, y + sill, z],
      [xx + f / 2, y + sill + winH, z],
      [xx - f / 2, y + sill + winH, z],
    ]
    b.face(m.reachGlazing, points, 1, [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ])
  }
}
function elevation(b, m, h, w, height, y, side, floor, open) {
  const n = Math.max(2, Math.min(5, Math.round(w / (side === 'front' ? 3.0 : 3.6)))),
    bay = w / n
  for (let j = 0; j < n; j++) {
    const x = -w / 2 + (j + 0.5) * bay,
      seed = (h.phase + j * 19 + floor * 29 + (side === 'back' ? 41 : side === 'side' ? 73 : 0)) % 101,
      front = side === 'front'
    if (open && front && (j === Math.floor(n / 2) || h.phase % 3 !== 1)) continue
    if (!floor && front && j === Math.floor(n / 2) && h.use !== 'shutter') {
      panel(b, m.reachFrame, h.style.wood, x, y + height - 0.49, 0, bay, 0.49, 0.82)
      continue
    }
    const slot = room(h, floor, side, j, n, seed)
    if (front && (slot < 8 || (slot >= 68 && slot < 72) || (h.sig && slot >= 76 && slot < 84)))
      recessed(b, m, h, slot, x, y, bay + 0.003, height, seed, !!floor && (h.phase + j + floor) % 3 === 0)
    else
      panel(
        b,
        m.reachFrame,
        slot,
        x,
        y,
        0,
        bay + 0.003,
        height,
        (front ? 1 : 0.78) * (0.75 + (seed % 8) * 0.046)
      )
  }
}
function wallJoinery(b, m, h, span, level, height, floor) {
  // Timber storey bands cover the joints between the plaster infill panels.
  if (floor) panel(b, m.reachDetail, h.style.wood, 0, level - 0.05, 0.014, span, 0.13, 0.74)
  const wood = h.style.wood,
    t = 0.105 + (h.sig ? 0.035 : 0)
  for (const end of sign)
    panel(b, m.reachDetail, wood, (end * (span - t)) / 2, level, 0.015, t, height, 0.84)
}
function gallery(b, m, h, w, y, bodyD, outerD, open) {
  const mat = m.reachFrame,
    z = outerD / 2 - 0.09,
    front = bodyD / 2 - 0.1,
    depth = z - front,
    wood = h.style.wood
  box(b, mat, wood, 0, y - 0.14, front + depth / 2, w + 0.32, 0.29, depth + 0.09)
  if (!open) {
    for (const H of [0.27, 0.88]) panel(b, mat, wood, 0, y + H, z, w + 0.24, 0.12, 1.1)
    const n = Math.max(3, Math.round(w / 1.72))
    for (let i = 0; i <= n; i++) panel(b, mat, wood, -w / 2 + (w * i) / n, y, z, 0.1, 0.99, 0.9)
  }
}
function partyWall(b, m, h, w, d, base) {
  const mat = m.reachFrame,
    style = h.style
  for (const s of sign) {
    const x = s * (w / 2 - 0.25),
      z = d / 2 - 0.48
    for (let j = 0; j < 3; j++) {
      const a = -z + j * z * 0.41,
        c = z - j * z * 0.41,
        bot = base + j * 0.32,
        H = (2 - j) * 0.12 + 0.55
      const pts = [
        [x, bot, a],
        [x, bot, c],
        [x, bot + H, c],
        [x, bot + H, a],
      ]
      reachFace(b, mat, style.wall, pts, 0.95)
      box(b, mat, style.roof, x, bot + H + 0.04, (a + c) / 2, 0.32, 0.12, c - a + 0.18, 0.98)
    }
  }
}
function sideDoor(b, m, h, span, H, y, u) {
  const a = -span / 2,
    z = span / 2,
    W = Math.min(1.5, h.bridge.depth - 0.18),
    l = u - W / 2,
    r = u + W / 2
  if (l > a) panel(b, m.reachFrame, 64 + (h.phase % 4), (l + a) / 2, y, 0, l - a, H, 0.85)
  if (z > r) panel(b, m.reachFrame, h.style.wall, (r + z) / 2, y, 0, z - r, H, 0.9)
  panel(b, m.reachFrame, h.style.wood, u, y + 2.41, 0, W, H - 2.41, 0.86)
  const climb = h.bridge.level - y
  if (climb > 0.16) {
    for (let j = 0; j < 2; j++)
      box(
        b,
        m.reachFrame,
        32,
        u,
        y + (climb * (j + 1)) / 4,
        -0.48 + j * 0.28,
        W,
        (climb * (j + 1)) / 2,
        0.31,
        0.92
      )
  }
}
function stairShape(h) {
  const d = h.depth - 1.45,
    w = h.width - 1.28,
    side = h.phase % 2 ? -1 : 1
  return {
    x: side * w * 0.34,
    top: -d / 2 + 1.04,
    run: Math.min(5.75, d - 2.05),
    width: 1.08,
    rise: h.ground,
  }
}
function stairFlight(b, m, h) {
  const s = stairShape(h),
    n = Math.ceil(s.rise / 0.217),
    t = s.run / n,
    r = s.rise / n,
    mat = m.reachFrame,
    l = s.x - s.width / 2,
    q = s.x + s.width / 2
  for (let i = 0; i < n; i++) {
    const Y = 0.2 + s.rise - i * r,
      z = s.top + i * t
    reachFace(
      b,
      mat,
      32,
      [
        [l, Y, z + t],
        [q, Y, z + t],
        [q, Y, z],
        [l, Y, z],
      ],
      0.98
    )
    reachFace(
      b,
      mat,
      24,
      [
        [l, Y - r, z + t],
        [q, Y - r, z + t],
        [q, Y, z + t],
        [l, Y, z + t],
      ],
      0.87
    )
  }
  for (const x of [l, q])
    beam(b, mat, 24, [x, 0.2 + s.rise - 0.13, s.top], [x, 0.2 - 0.09, s.top + s.run], 0.1, 0.2)
}
function upperBoard(b, m, h, w, front, back, y) {
  const s = stairShape(h),
    l = s.x - s.width * 0.59,
    r = s.x + s.width * 0.59,
    z0 = s.top - 0.05,
    z1 = s.top + s.run * 0.67
  const plank = (a, c, k, f) => {
    if (c > a + 0.02 && f > k + 0.02)
      box(b, m.reachFrame, 32, (a + c) / 2, y - 0.075, (k + f) / 2, c - a, 0.13, f - k)
  }
  plank(-w / 2, l, back, front)
  plank(r, w / 2, back, front)
  plank(l, r, back, z0)
  plank(l, r, z1, front)
}
export function frameHouse(b, m, h) {
  const s = h.style,
    mat = m.reachFrame,
    D = h.depth,
    W = h.width
  let w = W - 1.28,
    d = D - 1.45,
    y = 0.2
  box(b, mat, 33, 0, 0.14, -0.18, w + 0.35, 0.28, d + 0.37, 0.94)
  for (let floor = 0; floor < h.floors; floor++) {
    if (floor === h.floors - 1 && h.lifted && h.floors >= 3) {
      const wi = w * (h.kind === 'lantern' ? 0.6 : 0.73),
        di = d * (h.kind === 'guild' ? 0.7 : 0.76)
      shoulder(b, m, W, D, wi, di, y - 0.42, s)
      w = wi
      d = di
    }
    const H = floor ? h.unit : h.ground,
      open = floor === 0 && h.open
    const front =
      d / 2 -
      (open || (!floor && h.court) ? 1.0 : floor && ['gallery', 'guild'].includes(h.kind) ? 0.52 : 0.19)
    const back = -d / 2,
      mid = (front + back) / 2,
      deep = front - back
    if (floor === 1 && h.stair) upperBoard(b, m, h, w, front, back, y)
    else box(b, mat, 32, 0, y - 0.075, mid, w, 0.13, deep)
    if (floor === 0 && h.stair) stairFlight(b, m, h)
    b.at(0, 0, front, 0, () => elevation(b, m, h, w, H, y, 'front', floor, open))
    b.at(0, 0, back, Math.PI, () => {
      elevation(b, m, h, w, H, y, 'back', floor, false)
      wallJoinery(b, m, h, w, y, H, floor)
    })
    for (const side of sign)
      b.at((side * w) / 2, 0, mid, (side * Math.PI) / 2, () => {
        if (floor === 1 && h.bridge?.side === side)
          sideDoor(b, m, h, deep, H, y, -side * (h.bridge.z - mid))
        else elevation(b, m, h, deep, H, y, 'side', floor, false)
        wallJoinery(b, m, h, deep, y, H, floor)
      })
    if (open) {
      const n = Math.max(2, Math.round(w / 3.6))
      for (let j = 0; j <= n; j++)
        box(b, mat, s.wood, -w / 2 + (j * w) / n, y + H / 2, d / 2 + 0.19, 0.19, H, 0.22, 1.07)
      panel(b, mat, 24, 0, y + H - 0.37, d / 2 + 0.19, w + 0.4, 0.39, 0.86)
      for (const side of sign) {
        const width = Math.min(2.1, w * 0.255)
        box(b, mat, 35, side * (w / 2 - width / 2 - 0.17), y + 0.47, front - 0.66, width, 0.94, 0.75)
      }
    }
    if (
      floor &&
      (h.kind === 'gallery' ||
        h.kind === 'guild' ||
        h.use === 'gallery' ||
        h.use === 'banquet' ||
        (h.phase + floor) % 4 === 1)
    )
      gallery(b, m, h, w, y, d, D - (w < W - 2 ? 2.5 : 0), false)
    else if (floor && (floor === 1 || h.phase % 3 === 1))
      panel(b, mat, s.wood, 0, y - 0.13, front + 0.036, w + 0.16, 0.25, 0.85)
    y += H
  }
  const rw = w + 1.28,
    rd = d + 1.45,
    rise = Math.max(1.45, Math.min(3.35, Math.min(rw, rd) * (0.23 + (h.phase % 3) * 0.026))),
    lift = 0.36 + (h.phase % 4) * 0.13 + (h.sig ? 0.26 : 0)
  const hip = ['gable', 'firewall', 'return'].includes(h.kind) ? 0.055 : h.kind === 'lantern' ? 0.65 : 0.39
  if (h.kind === 'return')
    b.at(0, 0, 0, Math.PI / 2, () => roof(b, m, rd, rw, y - 0.06, rise, hip, lift, s))
  else roof(b, m, rw, rd, y - 0.06, rise, hip, lift, s)
  if (h.kind === 'firewall') partyWall(b, m, h, rw, rd, y - 0.19)
  return y + rise
}
