import * as T from 'three'
import { add, sub, scaled, unit, cross, lerp3 } from './mesh.js'
import { palaceSites } from './reachMap.js'

const tau = 2 * Math.PI
const titles = ['玉阙华门', '望江楼', '九霄金殿', '承明廊', '听潮阁', '丹凤朝阳']
const up = (p, h) => [p[0], p[1] + h, p[2]]

// The stonework, rooms, canopy apertures and gallery treads all share the same local survey.
function paint(m) {
  if (m.ridgeWindow) return
  let map = null
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 768
    const g = canvas.getContext('2d')
    function line(points) {
      g.beginPath()
      points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
      g.stroke()
    }
    for (let id = 0; id < 12; id++) {
      const ox = (id % 4) * 256,
        oy = Math.floor(id / 4) * 256
      g.save()
      g.translate(ox, oy)
      g.beginPath()
      g.rect(0, 0, 256, 256)
      g.clip()
      if (id < 6) {
        const pairs = [
          ['#ffdf96', '#bd824d'],
          ['#e1be86', '#866d50'],
          ['#e5d5a1', '#aa8d66'],
          ['#e5bd8b', '#9e633f'],
          ['#b5b99b', '#617e72'],
          ['#f0cd9e', '#ab7356'],
        ]
        const [a, c] = pairs[id]
        const grd = g.createLinearGradient(0, 0, 256, 256)
        grd.addColorStop(0, c)
        grd.addColorStop(0.42, a)
        grd.addColorStop(1, c)
        g.fillStyle = grd
        g.fillRect(0, 0, 256, 256)
        for (let k = 0; k < 350; k++) {
          const x = (k * 149 + 0.5) % 256,
            y = (k * k * 17 + k * 73) % 256
          g.fillStyle = k % 2 ? '#ffe9a52a' : '#6e604117'
          g.fillRect(x, y, 1 + (k % 4), 3 + (k % 5))
        }
        g.strokeStyle = '#4b4138'
        g.lineJoin = 'round'
        g.lineWidth = 5
        const shape = (x, y, r) =>
          line([
            [x - r, y],
            [x, y - r],
            [x + r, y],
            [x, y + r],
            [x - r, y],
          ])
        if (id % 3 === 0) {
          for (let x = -32; x < 290; x += 64)
            for (let y = -32; y < 290; y += 64) {
              shape(x, y, 32)
              if ((x + y) % 128 === 0) shape(x, y, 13)
            }
        } else if (id % 3 === 1) {
          for (const y of [38, 78, 182, 219])
            line([
              [0, y],
              [256, y],
            ])
          for (const x of [32, 78, 178, 223])
            line([
              [x, 0],
              [x, 256],
            ])
          g.lineWidth = 6
          g.beginPath()
          g.arc(128, 129, 60, 0, tau)
          g.stroke()
          shape(128, 129, 42)
        } else {
          for (let x = -24; x < 280; x += 48)
            for (let y = -24; y < 280; y += 48) {
              line([
                [x, y],
                [x + 33, y],
                [x + 33, y + 15],
                [x + 16, y + 15],
                [x + 16, y + 36],
                [x + 47, y + 36],
              ])
            }
        }
        g.strokeStyle = '#4b3a30'
        g.lineWidth = 10
        g.strokeRect(6, 6, 244, 244)
        g.lineWidth = 2
        g.strokeStyle = '#bd9560'
        g.strokeRect(14, 14, 228, 228)
      } else {
        const title = titles[id - 6]
        g.fillStyle = id % 2 ? '#4f3030' : '#263d3d'
        g.fillRect(0, 0, 256, 256)
        g.strokeStyle = '#b8995d'
        g.lineWidth = 5
        g.strokeRect(7, 13, 242, 230)
        g.lineWidth = 2
        g.strokeRect(16, 21, 224, 214)
        for (const a of [0, 1])
          for (const b of [0, 1]) {
            g.save()
            g.translate(a ? 234 : 22, b ? 227 : 29)
            g.scale(a ? -1 : 1, b ? -1 : 1)
            line([
              [0, 20],
              [0, 0],
              [34, 0],
              [34, 9],
              [14, 9],
              [14, 18],
            ])
            g.restore()
          }
        g.fillStyle = '#f3d38c'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.scale(1, 1.56)
        g.font = 'bold 48px "Noto Serif CJK SC", SimSun, serif'
        g.fillText(title, 128, 81, 212)
        g.fillStyle = '#b14d3c'
        g.fillRect(217, 115, 10, 11)
      }
      g.restore()
    }
    map = new T.CanvasTexture(canvas)
    map.colorSpace = T.SRGBColorSpace
    map.anisotropy = 4
  }
  function colored(key, base, color, emit, intensity) {
    const v = base.clone()
    v.name = key
    v.color.set(color)
    v.emissive.set(emit)
    v.emissiveIntensity = intensity
    m[key] = v
    return v
  }
  colored('ridgeGlaze', m.roof, 0xd8ac59, 0x99713c, 0.15).metalness = 0.32
  colored('ridgeJade', m.roof, 0x396668, 0x243b41, 0.055)
  colored('ridgeGilt', m.gold, 0xf0bd68, 0xb27638, 0.38)
  colored('ridgeBrick', m.foundation, 0x777a76, 0x1c1a18, 0.06)
  for (const [key, intensity, color] of [
    ['ridgeWindow', 1.33, 0xffcf80],
    ['ridgeDim', 0.21, 0xffcd94],
    ['ridgePlaque', 0.12, 0xffd199],
  ]) {
    m[key] = new T.MeshStandardMaterial({
      name: key,
      map,
      color: 0xffffff,
      emissive: color,
      emissiveMap: map,
      emissiveIntensity: intensity,
      side: T.DoubleSide,
      roughness: 0.74,
      vertexColors: true,
    })
  }
}
function picture(b, material, id, x, y, z, w, h, tint = 1) {
  const col = id % 4,
    row = Math.floor(id / 4),
    l = (col + 0.008) / 4,
    r = (col + 0.992) / 4,
    t = 1 - (row + 0.008) / 3,
    bot = 1 - (row + 0.992) / 3
  b.face(
    material,
    [
      [x - w / 2, y - h / 2, z],
      [x + w / 2, y - h / 2, z],
      [x + w / 2, y + h / 2, z],
      [x - w / 2, y + h / 2, z],
    ],
    tint,
    [
      [l, bot],
      [r, bot],
      [r, t],
      [l, t],
    ]
  )
}
function plaque(b, m, id, x, y, z, w, h) {
  b.box(m.bronze, x, y, z, w + 0.18, h + 0.15, 0.22)
  picture(b, m.ridgePlaque, id + 6, x, y, z + 0.12, w, h)
}
function light(b, world, p, c, power, range) {
  world.lamp(...b.point(p), c, power, range)
}
function path(b, mat, points, r, sides = 5) {
  for (let i = 1; i < points.length; i++) b.tube(mat, points[i - 1], points[i], r, r, sides, 1, false)
}
function rail(b, m, a, c, { stone = false, posts = true, rungs = 1.7 } = {}) {
  const length = Math.hypot(c[0] - a[0], c[2] - a[2])
  if (length < 0.1) return
  const n = Math.max(1, Math.ceil(length / (stone ? 3.35 : rungs)))
  const bar = stone ? m.coping : m.teal,
    post = stone ? m.stone : m.vermilion
  b.beam(bar, up(a, 1.06), up(c, 1.06), stone ? 0.2 : 0.13, 0.12)
  b.beam(stone ? m.stone : m.darkwood, up(a, 0.33), up(c, 0.33), 0.115, 0.1)
  for (let i = 0; i <= n; i++) {
    const p = lerp3(a, c, i / n)
    if (posts || (i > 0 && i < n)) {
      b.box(post, p[0], p[1] + 0.58, p[2], 0.15, 1.16, 0.15)
      b.box(stone ? m.coping : m.bronze, p[0], p[1] + 1.17, p[2], 0.225, 0.1, 0.225)
    }
    if (!stone && i < n) {
      const a0 = lerp3(a, c, (i + 0.19) / n),
        mid = lerp3(a, c, (i + 0.5) / n),
        a1 = lerp3(a, c, (i + 0.81) / n)
      path(
        b,
        m.bronze,
        [up(a0, 0.68), up(mid, 0.92), up(a1, 0.68), up(mid, 0.44), up(a0, 0.68)],
        0.038,
        3
      )
    }
  }
}
function oct(w, d, chamfer) {
  const W = w / 2,
    D = d / 2,
    h = Math.min(chamfer, W * 0.8, D * 0.8)
  return [
    [-W + h, D],
    [W - h, D],
    [W, D - h],
    [W, -D + h],
    [W - h, -D],
    [-W + h, -D],
    [-W, -D + h],
    [-W, D - h],
  ]
}
function masonry(b, m, x, z, bottom, top, w, d, { bevel = 1.7, batter = 0.52, trim = true } = {}) {
  const h = top - bottom,
    band = Math.min(0.36, h * 0.12),
    chamfer = bevel
  const rows = [
    [0, bottom, m.ridgeBrick],
    [-0.14, bottom + band, m.stone],
    [-batter, top - 2 * band, m.ridgeBrick],
    [-batter - 0.02, top - band, m.coping],
    [-batter + 0.14, top, m.stone],
  ]
  b.at(x, 0, z, 0, () => {
    const rings = rows.map(([inset, y]) =>
      oct(w + 2 * inset, d + 2 * inset, chamfer).map(([xx, zz]) => [xx, y, zz])
    )
    b.face(m.tiles, rings.at(-1))
    b.face(m.foundation, rings[0].slice().reverse())
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < 8; i++) {
        const k = (i + 1) % 8,
          a = rings[j - 1][i],
          c = rings[j - 1][k],
          u = rings[j][i],
          v = rings[j][k]
        if (j !== 2) {
          b.face(rows[j][2], [a, c, v, u], 0.9 + 0.04 * (i % 3))
          continue
        }
        const wide = Math.hypot(c[0] - a[0], c[2] - a[2]),
          cols = Math.max(1, Math.round(wide / 3.4)),
          n = Math.max(1, Math.ceil((top - bottom) / 1.62))
        for (let y = 0; y < n; y++)
          for (let col = 0; col <= cols; col++) {
            const s = Math.max(0, (col - (y % 2) * 0.5) / cols),
              t = Math.min(1, (col + 1 - (y % 2) * 0.5) / cols)
            if (t <= s) continue
            const p = (q, f) => lerp3(lerp3(a, c, q), lerp3(u, v, q), f)
            b.face(
              m.ridgeBrick,
              [p(s, y / n), p(t, y / n), p(t, (y + 1) / n), p(s, (y + 1) / n)],
              0.78 + (0.2 * ((i * 13 + col * 5 + y * 7) % 17)) / 16
            )
          }
        if (trim && i % 2 === 0 && h > 4) {
          const n = Math.max(1, Math.floor(wide / 5.2)),
            dir = unit(cross(sub(c, a), [0, 1, 0]))
          for (let q = 0; q < n; q++) {
            const pt = add(lerp3(u, v, (q + 0.5) / n), scaled(dir, 0.045))
            b.at(pt[0], top - 0.83, pt[2], Math.atan2(dir[0], dir[2]), () => {
              b.box(m.patina, 0, 0, 0, 1.06, 0.29, 0.14)
              b.box(m.bronze, 0, 0, 0.08, 0.54, 0.094, 0.045)
            })
          }
        }
      }
  })
}
function stair(b, m, a, c, width, rails = true) {
  const rise = c[1] - a[1],
    dist = Math.hypot(c[0] - a[0], c[2] - a[2]),
    n = Math.max(1, Math.ceil(rise / 0.195)),
    dir = unit([c[0] - a[0], 0, c[2] - a[2]]),
    side = [-dir[2], 0, dir[0]]
  const point = (t, s, y) =>
    add([a[0] + dir[0] * dist * t, y, a[2] + dir[2] * dist * t], scaled(side, (s * width) / 2))
  for (let i = 0; i < n; i++) {
    const u = i / n,
      v = (i + 1) / n,
      y = a[1] + rise * v,
      prev = a[1] + rise * u
    b.face(
      m.tiles,
      [point(u, -1, y), point(u, 1, y), point(v, 1, y), point(v, -1, y)],
      0.9 + 0.065 * (i % 3)
    )
    b.face(m.coping, [point(u, -1, prev), point(u, 1, prev), point(u, 1, y), point(u, -1, y)])
    for (const s of [-1, 1])
      b.face(m.darkwood, [
        point(u, s, y),
        point(v, s, y),
        point(v, s, a[1] + rise * v - 0.43),
        point(u, s, a[1] + rise * u - 0.43),
      ])
  }
  b.face(m.timber, [
    point(0, -1, a[1] - 0.43),
    point(1, -1, c[1] - 0.43),
    point(1, 1, c[1] - 0.43),
    point(0, 1, a[1] - 0.43),
  ])
  if (rails)
    for (const s of [-1, 1])
      rail(b, m, point(0, s * 0.95, a[1]), point(1, s * 0.95, c[1]), { stone: rise < 4 })
}
function court(b, m, site, h) {
  const w = site.width - 2.3,
    d = site.depth - 7.4,
    z = -1.6,
    front = z + d / 2
  masonry(b, m, 0, z, -0.16, h, w, d, { bevel: 3.0, batter: 0.24 })
  stair(b, m, [0, 0, front + 5.04], [0, h, front], 7.6)
  const edge = oct(w - 0.82, d - 0.82, 3.0).map(([x, zz]) => [x, h, z + zz])
  for (let i = 0; i < 8; i++) {
    const a = edge[i],
      c = edge[(i + 1) % 8]
    if (i === 0) {
      rail(b, m, a, [-4.47, h, a[2]], { stone: true })
      rail(b, m, [4.47, h, a[2]], c, { stone: true })
    } else if (i % 2 === 0) rail(b, m, a, c, { stone: true })
  }
  for (const s of [-1, 1]) {
    const lip = front + 2.7
    const p = [s * 4.68, 0, lip]
    masonry(b, m, p[0], p[2], -0.11, 1.87, 1.45, 1.45, { bevel: 0.25, batter: 0.15 })
    b.tube(m.bronze, [p[0], 1.87, p[2]], [p[0], 2.42, p[2]], 0.35, 0.21, 7)
    hangingLamp(b, m, p[0], 2.91, p[2], 0.49, 0.91)
  }
}
function post(b, m, x, z, y, h, r = 0.31) {
  b.tube(m.coping, [x, y, z], [x, y + 0.34, z], r * 1.43, r * 1.26, 6, 1, false)
  b.tube(m.vermilion, [x, y + 0.32, z], [x, y + h - 0.53, z], r, r * 0.86, 7, 1, false)
  b.box(m.teal, x, y + h - 0.49, z, r * 2.68, 0.33, r * 2.68)
  b.box(m.bronze, x, y + h - 0.3, z, r * 2.9, 0.07, r * 2.78)
}
function hangingLamp(b, m, x, y, z, r, h, mat = m.lantern) {
  const R = [
    [0.55, -0.56],
    [1, -0.36],
    [1, 0.31],
    [0.65, 0.52],
  ]
  const point = (j, i) => [
    x + R[j][0] * r * Math.cos((tau * (i + 0.5)) / 6),
    y + R[j][1] * h,
    z + R[j][0] * r * Math.sin((tau * (i + 0.5)) / 6),
  ]
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 6; i++)
      b.face(
        j === 1 ? mat : m.bronze,
        [point(j, i), point(j, i + 1), point(j + 1, i + 1), point(j + 1, i)],
        0.9 + (i % 2) * 0.1
      )
  b.face(
    m.bronze,
    Array.from({ length: 6 }, (_, i) => point(3, i))
  )
  b.face(
    m.bronze,
    Array.from({ length: 6 }, (_, i) => point(0, 5 - i))
  )
  for (const i of [0, 2, 4]) b.tube(m.bronze, point(1, i), point(2, i), r * 0.07, r * 0.07, 4, 1, false)
  b.tube(m.vermilion, [x, y - h * 0.55, z], [x, y - h * 0.89, z], r * 0.066, r * 0.018, 4, 1, false)
}
function tassel(b, m, x, y, z, dx, length) {
  const p = (s, t) => [
    x + s * 0.48 + dx * t * t,
    y - length * t,
    z + 0.31 * Math.sin(4.3 * t + 0.6 * s) * t,
  ]
  for (let i = 0; i < 7; i++) {
    const a = i / 7,
      c = (i + 1) / 7
    b.face(m.redSilk, [p(-1, a), p(1, a), p(1, c), p(-1, c)], 0.81 + 0.16 * (i % 2))
  }
  b.tube(m.bronze, [x - 0.53, y + 0.03, z], [x + 0.54, y + 0.03, z], 0.053, 0.055, 5)
}

function roofBand(
  b,
  m,
  {
    x = 0,
    z = 0,
    y,
    w,
    d,
    cw,
    cd,
    rise,
    lift = 1.45,
    skin = m.ridgeJade,
    gilded = false,
    feathers = false,
  }
) {
  // Top and underside terminate at the same open collar; the storey above passes through it.
  b.at(x, y, z, 0, () => {
    const edge = gilded ? m.ridgeGilt : m.roofEdge,
      th = 0.23
    for (const sx of [-1, 1])
      for (const end of [false, true]) {
        const p = (s, t, shift = 0) => {
          const W = (w + (cw - w) * t) / 2,
            D = (d + (cd - d) * t) / 2
          const h =
            rise * (0.12 * t + 0.88 * t ** 1.78) + lift * (1 - t) ** 2.7 * Math.abs(s) ** 4.2 + shift
          return end ? [sx * W, h, s * D] : [s * W, h, sx * D]
        }
        const length = end ? d : w,
          cols = Math.max(3, Math.ceil(length / 4.0)),
          rows = 4
        for (let i = 0; i < cols; i++) {
          const s = (i * 2) / cols - 1,
            k = ((i + 1) * 2) / cols - 1
          for (let j = 0; j < rows; j++) {
            const a = j / rows,
              c = (j + 1) / rows,
              uv = (q, t) => [length * q * 0.45, t * Math.max(w - cw, d - cd) * 0.34]
            b.face(skin, [p(s, a), p(k, a), p(k, c), p(s, c)], 0.92 + 0.045 * (end ? 1 : 0), [
              uv(s, a),
              uv(k, a),
              uv(k, c),
              uv(s, c),
            ])
            if (j === 0 || j === 1)
              b.face(m.darkwood, [p(s, a, -th), p(s, c, -th), p(k, c, -th), p(k, a, -th)], 0.82)
          }
          b.face(edge, [p(s, 0, 0.1), p(k, 0, 0.1), p(k, 0, -0.095), p(s, 0, -0.095)])
          b.face(m.vermilion, [p(s, 0, -0.095), p(k, 0, -0.095), p(k, 0, -0.255), p(s, 0, -0.255)])
          if (i % 2 === 0) b.beam(m.timber, p(s, 0, -0.255), p(s, 0.53, -0.27), 0.23, 0.18)
        }
        if (!end)
          for (const side of [-1, 1]) {
            const rib = Array.from({ length: 6 }, (_, i) => p(side, i / 5, 0.14))
            path(b, edge, rib, 0.175, 5)
            const corner = p(side, 0, 0.13),
              out = unit([side * w, 0, sx * d]),
              a = add(corner, add(scaled(out, 0.72), [0, 0.38, 0])),
              tip = add(corner, add(scaled(out, 1.41), [0, 1.17, 0]))
            b.tube(edge, corner, a, 0.245, 0.174, 6, 1, false)
            b.tube(m.ridgeGilt, a, tip, 0.18, 0.025, 6, 1, false)
            if (feathers) {
              const root = p(side, 0.19, 0.25),
                pt = add(root, add(scaled(out, 0.89), [0, 1.03, 0]))
              b.tube(m.ridgeGilt, root, pt, 0.18, 0.024, 5)
            }
          }
      }
  })
}
function blade(b, mat, points, thickness) {
  const a = points.map((p) => add(p, [0, 0, -thickness * 0.5])),
    c = points.map((p) => add(p, [0, 0, thickness * 0.5]))
  // The ornament can be concave: triangulate it before closing its narrow edge.
  const planar = points.map((p) => new T.Vector2(p[0], p[1]))
  for (const tri of T.ShapeUtils.triangulateShape(planar, [])) {
    b.face(
      mat,
      tri.map((i) => c[i])
    )
    b.face(
      mat,
      tri
        .slice()
        .reverse()
        .map((i) => a[i])
    )
  }
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length
    b.face(mat, [a[i], a[j], c[j], c[i]], 0.89)
  }
}
function dragonTail(b, m, x, y, z, sign, size) {
  const outline = [
    [-0.98, 0],
    [-0.68, 0.62],
    [-0.12, 0.71],
    [0.18, 1.14],
    [0.34, 2.14],
    [0.02, 2.98],
    [0.8, 2.41],
    [1.14, 1.73],
    [1.03, 0.96],
    [1.57, 1.26],
    [1.92, 1.82],
    [1.76, 0.8],
    [1.06, 0.2],
    [0.32, -0.07],
  ]
  b.at(x, y, z, 0, () =>
    b.scaleBy(size, () => {
      blade(
        b,
        m.ridgeGilt,
        outline.map(([u, v]) => [sign * u, v, 0]),
        0.29
      )
      path(
        b,
        m.bronze,
        [
          [0, 0.35, 0.16],
          [sign * 0.56, 0.8, 0.16],
          [sign * 0.7, 1.37, 0.16],
          [sign * 0.45, 2.0, 0.16],
        ],
        0.072,
        4
      )
      b.tube(m.patina, [sign * 0.52, 0.86, 0.11], [sign * 0.52, 0.86, 0.27], 0.13, 0.1, 7)
    })
  )
}
function gable(
  b,
  m,
  { x = 0, z = 0, y, w, d, rise, skin = m.ridgeJade, gilded = false, lift = 1.55, tail = 1, crest = true }
) {
  const cw = w * 0.65,
    cd = d * 0.56,
    eavesRise = rise * 0.345,
    baseY = y + eavesRise
  roofBand(b, m, { x, z, y, w, d, cw, cd, rise: eavesRise, lift, skin, gilded, feathers: gilded })
  b.at(x, baseY, z, 0, () => {
    const ww = cw / 2 + 0.49,
      dd = cd / 2 + 0.4,
      upper = rise - eavesRise,
      edge = gilded ? m.ridgeGilt : m.roofEdge
    for (const s of [-1, 1]) {
      const p = (u, t, h = 0) => [
        u * ww,
        upper * (0.18 * t + 0.82 * t ** 1.42) + 0.44 * Math.abs(u) ** 4 * (0.37 + 0.63 * (1 - t)) + h,
        s * dd * (1 - t),
      ]
      const n = Math.max(4, Math.ceil(cw / 3.6))
      for (let i = 0; i < n; i++)
        for (let j = 0; j < 4; j++) {
          const u = (i * 2) / n - 1,
            v = ((i + 1) * 2) / n - 1,
            a = j / 4,
            c = (j + 1) / 4,
            uv = (q, t) => [q * ww * 0.79, t * dd * 0.86]
          b.face(skin, [p(u, a), p(v, a), p(v, c), p(u, c)], 0.94, [
            uv(u, a),
            uv(v, a),
            uv(v, c),
            uv(u, c),
          ])
          if (j === 0) b.face(edge, [p(u, 0, 0.1), p(v, 0, 0.1), p(v, 0, -0.13), p(u, 0, -0.13)])
        }
      for (const ex of [-1, 1]) {
        const profile = Array.from({ length: 6 }, (_, i) => p(ex, i / 5, 0.13))
        path(b, edge, profile, 0.19, 5)
        for (let k = 0; k < 5; k++)
          b.face(
            m.plaster,
            [
              [ex * (ww - 0.18), 0.11, profile[k][2]],
              [ex * (ww - 0.18), 0.11, profile[k + 1][2]],
              [ex * (ww - 0.18), profile[k + 1][1] - 0.12, profile[k + 1][2]],
              [ex * (ww - 0.18), profile[k][1] - 0.12, profile[k][2]],
            ],
            0.84
          )
        b.beam(
          m.timber,
          [ex * (ww - 0.2), 0.41, s * (dd - 0.28)],
          [ex * (ww - 0.2), upper - 0.24, s * 0.28],
          0.25,
          0.26
        )
      }
    }
    b.tube(edge, [-ww, upper + 0.27, 0], [ww, upper + 0.27, 0], 0.25, 0.25, 7)
    if (crest) for (const s of [-1, 1]) dragonTail(b, m, s * ww, upper + 0.31, 0, s, tail)
  })
}
function bracket(b, m, x, y, size) {
  const profile = [
    [-1.17, 0.55],
    [-1.17, 0.28],
    [-0.74, 0.22],
    [-0.64, -0.02],
    [-0.34, -0.08],
    [-0.21, -0.32],
    [0.21, -0.32],
    [0.34, -0.08],
    [0.64, -0.02],
    [0.74, 0.22],
    [1.17, 0.28],
    [1.17, 0.55],
  ]
  b.at(x, y, 0.15, 0, () =>
    b.scaleBy(size, () => {
      blade(
        b,
        m.teal,
        profile.map(([u, v]) => [u, v, 0]),
        0.36
      )
      b.beam(m.bronze, [-1.25, 0.59, 0], [1.25, 0.59, 0], 0.37, 0.13)
      b.beam(m.timber, [0, -0.04, -0.28], [0, 0.47, 1.14], 0.31, 0.31)
      b.box(m.patina, 0, 0.43, 0.92, 0.65, 0.24, 0.46)
    })
  )
}
function windFace(b, m, span, h, style, seed, side) {
  let bays = Math.max(3, Math.round(span / 3.75))
  if (bays % 2 === 0) bays++
  const pitch = span / bays,
    mid = (bays - 1) / 2,
    isOpen = style === 'colonnade'
  for (let j = 0; j < bays; j++) {
    const xx = j * pitch - span / 2
    if (j % 2 === 0) {
      post(b, m, xx, 0, 0, h, 0.27 + (h > 10 ? 0.065 : 0))
      if (h > 6.3) bracket(b, m, xx, h - 1.06, h > 10 ? 1.1 : 0.83)
    } else b.box(m.vermilion, xx, h * 0.5, 0, 0.32, h, 0.35)
  }
  b.box(m.teal, 0, h - 0.4, 0, span + 0.4, 0.61, 0.6)
  b.box(m.bronze, 0, h - 0.78, 0.075, span + 0.25, 0.093, 0.48)
  for (let j = 0; j < bays; j++) {
    const x = -span / 2 + (j + 0.5) * pitch,
      val = (j * 7 + side * 13 + seed * 3) % 11,
      pw = pitch - 0.41
    if (j === mid || (isOpen && (j + side) % 3 !== 0)) {
      if (j !== mid && isOpen)
        rail(b, m, [x - pw * 0.5, 0, 0.02], [x + pw * 0.5, 0, 0.02], { posts: false, rungs: 2.8 })
      continue
    }
    const floor = 1.03,
      top = Math.min(h - 1.0, 4.89),
      panelTop = top - 0.18
    if (isOpen && val % 3 === 0) {
      rail(b, m, [x - pw * 0.5, 0, 0.03], [x + pw * 0.5, 0, 0.03], { posts: false })
      continue
    }
    b.box(m.darkwood, x, floor * 0.5, -0.12, pw, floor, 0.2)
    b.box(m.teal, x, 0.54, 0.005, pw * 0.84, 0.57, 0.052)
    const theme = (seed + j + side) % 6,
      bright = style === 'shuttered' ? val > 7 : style === 'gallery' ? val > 4 : val > 2
    for (const s of [-1, 1])
      picture(
        b,
        bright ? m.ridgeWindow : m.ridgeDim,
        theme,
        x + s * pw * 0.25,
        (floor + panelTop) * 0.5,
        -0.11,
        pw * 0.49,
        panelTop - floor,
        bright ? 0.99 : 0.7
      )
    b.box(m.timber, x, (floor + panelTop) / 2, -0.029, 0.1, panelTop - floor, 0.13)
    b.box(m.darkwood, x, floor, 0.005, pw, 0.14, 0.24)
    b.box(m.darkwood, x, panelTop, -0.03, pw, 0.18, 0.2)
    if (h > 6.0) {
      if (val % 3 === 0) {
        picture(b, m.ridgeDim, (theme + 2) % 6, x, h - 1.75, -0.15, pw * 0.97, 1.27, 0.7)
        b.box(m.timber, x, h - 2.4, -0.08, pw, 0.13, 0.25)
      } else if ((j + side) % 3 === 1) b.box(m.wine, x, h - 1.35, -0.15, pw, 0.96, 0.2, 0.69)
    }
  }
}
function room(
  b,
  m,
  world,
  { x, z, y, w, d, h, style = 'gallery', seed = 0, deck = 1.02, name, lights = true }
) {
  b.at(x, y, z, 0, () => {
    // Closed floor and roof beams surround a central unobstructed interior.
    b.box(m.timber, 0, -0.18, 0, w + deck * 2, 0.36, d + deck * 2)
    b.face(
      m.tiles,
      [
        [-w / 2 - deck, 0.006, d / 2 + deck],
        [w / 2 + deck, 0.006, d / 2 + deck],
        [w / 2 + deck, 0.006, -d / 2 - deck],
        [-w / 2 - deck, 0.006, -d / 2 - deck],
      ],
      1.01
    )
    for (const side of [0, 1, 2, 3]) {
      const sx = [0, 1, 0, -1][side],
        sz = [1, 0, -1, 0][side],
        span = side % 2 ? d : w
      const wall = style === 'colonnade' && side === 2 ? 'shuttered' : style
      b.at((sx * w) / 2, 0, (sz * d) / 2, side * Math.PI * 0.5, () =>
        windFace(b, m, span, h, wall, seed, side)
      )
    }
    for (const xx of [-w * 0.32, w * 0.32])
      b.beam(m.timber, [xx, h - 0.25, -d / 2], [xx, h - 0.25, d / 2], 0.32, 0.41)
    if (name !== undefined) plaque(b, m, name, 0, h - 0.9, d / 2 + 0.34, Math.min(4.4, w * 0.44), 1.08)
    for (const sign of [-1, 1]) {
      const lx = sign * (w / 2 - 0.81),
        ly = h - 2.09,
        lz = d / 2 + 0.1
      b.tube(m.bronze, [lx, h - 0.29, lz], [lx, ly + 0.58, lz], 0.03, 0.03, 4, 1, false)
      hangingLamp(
        b,
        m,
        lx,
        ly,
        lz,
        h > 8 ? 0.5 : 0.36,
        h > 8 ? 1.02 : 0.82,
        sign < 0 && seed % 2 ? m.paper : m.lantern
      )
      if (lights) light(b, world, [lx, ly, lz + 0.43], 0xffb662, h > 8 ? 42 : 26, h > 8 ? 15 : 11)
    }
  })
}

function vaultedStorey(b, m, world, x, z, bottom, top, w, d, spans = 3) {
  const height = top - bottom
  b.at(x, bottom, z, 0, () => {
    for (let side = 0; side < 4; side++) {
      const sx = [0, 1, 0, -1][side],
        sz = [1, 0, -1, 0][side],
        length = side % 2 ? d : w
      const n = side % 2 ? Math.max(1, spans - 2) : spans,
        pitch = length / n
      b.at((sx * w) / 2, 0, (sz * d) / 2, (side * Math.PI) / 2, () => {
        for (let j = 0; j < n; j++) {
          const cx = -length / 2 + (j + 0.5) * pitch,
            r = Math.min(pitch * 0.37, height * 0.41),
            outer = r + 0.38,
            spring = height - 1.52 - outer
          for (const s of [-1, 1]) {
            const leg = pitch / 2 - r,
              xx = cx + s * (r + leg / 2)
            b.box(m.ridgeBrick, xx, spring / 2, -0.32, leg, spring, 0.85, 0.89 + (j % 2) * 0.06)
            b.box(m.stone, xx, spring - 0.24, -0.28, leg + 0.15, 0.39, 0.99)
          }
          const segments = 12
          const p = (a, rad, zz) => [cx + rad * Math.cos(a), spring + rad * Math.sin(a), zz]
          for (let i = 0; i < segments; i++) {
            const a = (i * Math.PI) / segments,
              c = ((i + 1) * Math.PI) / segments,
              o = p(a, outer, 0.19),
              v = p(c, outer, 0.19)
            const ls = p(a, r, 0.18),
              rs = p(c, r, 0.18),
              il = p(a, r, -0.75),
              ir = p(c, r, -0.75)
            b.face(m.stone, [ls, rs, v, o], 0.81 + (0.18 * (i % 3)) / 2)
            b.face(m.ridgeBrick, [ls, il, ir, rs], 0.7 + 0.06 * (i % 2))
            b.face(
              m.ridgeBrick,
              [p(a, r, -0.75), p(c, r, -0.75), p(c, outer, -0.75), p(a, outer, -0.75)],
              0.9
            )
            for (const off of [0.09, -0.75])
              b.face(
                m.ridgeBrick,
                [p(a, outer, off), p(c, outer, off), [v[0], height, off], [o[0], height, off]],
                0.89 + 0.035 * (j % 3)
              )
          }
          for (const s of [-1, 1]) {
            const edge = cx + s * outer,
              last = cx + (s * pitch) / 2
            for (const off of [0.09, -0.75])
              b.face(
                m.ridgeBrick,
                [
                  [edge, spring, off],
                  [last, spring, off],
                  [last, height, off],
                  [edge, height, off],
                ],
                0.83
              )
          }
        }
        b.box(m.coping, 0, height - 0.22, -0.27, length + 0.26, 0.4, 1.08)
      })
    }
    b.box(m.tiles, 0, height - 0.18, 0, w + 0.72, 0.36, d + 0.72)
    for (const s of [-1, 1]) {
      const xx = s * (w / 2 - 1.12),
        zz = d / 2 - 0.8,
        h = height * 0.59
      b.beam(m.bronze, [xx, h + 1.05, zz], [xx, h + 1.05, zz + 0.47], 0.12, 0.12)
      hangingLamp(b, m, xx, h + 0.39, zz + 0.47, 0.34, 0.71, m.paper)
      light(b, world, [xx, h + 0.4, zz + 0.61], 0xffac65, 25, 11)
    }
  })
}
function collar(b, m, x, z, low, high, w, d) {
  b.box(m.teal, x, (low + high) * 0.5, z, w, high - low, d, 0.82)
  for (const s of [-1, 1]) b.box(m.bronze, x, high - 0.18, z + s * d * 0.5, w, 0.13, 0.15)
}
function bridge(b, m, world, a, c, z, y, w, covered = false) {
  const distance = c - a,
    mid = (a + c) / 2
  b.box(m.timber, mid, y - 0.23, z, distance, 0.46, w)
  b.face(m.tiles, [
    [a, y + 0.006, z + w / 2],
    [c, y + 0.006, z + w / 2],
    [c, y + 0.006, z - w / 2],
    [a, y + 0.006, z - w / 2],
  ])
  for (const s of [-1, 1]) {
    const zz = z + s * (w / 2 - 0.08)
    rail(b, m, [a, y, zz], [c, y, zz], { rungs: 2.15 })
    const seg = 8,
      shoulder = Math.min(2.2, distance * 0.14),
      rise = Math.min(3.45, distance * 0.16)
    const p = (i) => [
      a + shoulder + ((distance - 2 * shoulder) * i) / seg,
      y - 0.63 - rise * (1 - Math.sin((Math.PI * i) / seg)),
      zz,
    ]
    for (let j = 1; j <= seg; j++) {
      b.beam(m.teal, p(j - 1), p(j), 0.31, 0.42)
      if (j % 2 === 0) b.beam(m.bronze, p(j), [p(j)[0], y - 0.29, zz], 0.12, 0.12)
    }
    for (const sign of [-1, 1]) {
      const at = sign < 0 ? a + shoulder : c - shoulder,
        root = sign < 0 ? a : c
      b.beam(m.wood, [root, y - 0.56, zz], [at, y - 0.65 - rise, zz], 0.32, 0.44)
    }
  }
  if (covered) {
    for (let j = 0; j <= 4; j++)
      for (const side of [-1, 1])
        post(b, m, a + (distance * j) / 4, z + side * (w / 2 - 0.1), y, 4.42, 0.21)
    gable(b, m, {
      x: mid,
      z,
      y: y + 4.42,
      w: distance + 1.8,
      d: w + 2.1,
      rise: 2.49,
      lift: 0.66,
      tail: 0.37,
      crest: false,
    })
  }
  for (const xx of [a + distance * 0.27, c - distance * 0.24]) {
    const zz = z + w / 2 - 0.12,
      bottom = y + (covered ? 2.8 : 2.35)
    if (!covered) {
      b.tube(m.teal, [xx, y, zz], [xx, y + 2.99, zz], 0.084, 0.067, 6)
      b.beam(m.bronze, [xx, y + 2.9, zz], [xx + 0.44, y + 3.03, zz], 0.074, 0.088)
    }
    hangingLamp(b, m, xx + (covered ? 0 : 0.43), bottom, zz, 0.32, 0.7)
    light(b, world, [xx, bottom, zz + 0.34], 0xffc37b, 21, 9)
  }
}
function signalBell(b, m, x, y, z, h) {
  b.at(x, y, z, 0, () => {
    const height = h * 0.62,
      width = height * 0.39
    for (const s of [-1, 1]) post(b, m, s * width * 1.14, 0, 0, h, 0.23)
    b.beam(m.darkwood, [-width * 1.29, h - 0.29, 0], [width * 1.29, h - 0.29, 0], 0.42, 0.49)
    b.tube(m.bronze, [0, h - 0.35, 0], [0, h - 1.23, 0], 0.086, 0.09, 6)
    const profile = [
      [0, 0.14],
      [0.09, 0.37],
      [0.21, 0.44],
      [0.65, 0.46],
      [0.85, 0.56],
      [1, 0.64],
    ]
    for (let i = 1; i < profile.length; i++) {
      const [a, r] = profile[i - 1],
        [c, s] = profile[i]
      b.tube(
        i === 4 ? m.ridgeGilt : m.patina,
        [0, h - 1.22 - a * height, 0],
        [0, h - 1.22 - c * height, 0],
        r * height,
        s * height,
        12,
        0.92,
        false
      )
    }
    b.tube(m.darkwood, [0, h - 1.23 - height * 0.79, 0], [0, h - 1.23 - height * 1.13, 0], 0.12, 0.15, 7)
    for (const side of [-1, 1])
      for (let j = 0; j < 4; j++) {
        const yy = h - 1.53 - height * (0.19 + j * 0.095)
        b.tube(
          m.bronze,
          [side * 0.19 * height, yy, height * 0.396],
          [side * 0.19 * height, yy, height * 0.445],
          0.12,
          0.09,
          6
        )
      }
  })
}
function lotusFinial(b, m, x, y, z, s) {
  b.at(x, y, z, 0, () =>
    b.scaleBy(s, () => {
      for (const [a, c, ra, rb, mat] of [
        [0, 0.56, 0.91, 0.78, m.bronze],
        [0.55, 1.05, 0.68, 0.84, m.ridgeGilt],
        [1.02, 1.53, 0.81, 0.4, m.patina],
        [1.52, 2.49, 0.35, 0.16, m.ridgeGilt],
        [2.47, 3.4, 0.17, 0.018, m.ridgeGilt],
      ])
        b.tube(mat, [0, a, 0], [0, c, 0], ra, rb, 8)
      for (let i = 0; i < 7; i++)
        b.at(0, 0.27, 0, (tau * i) / 7, () => {
          b.face(m.ridgeGilt, [
            [0, 0, 0.49],
            [-0.34, 0.59, 0.74],
            [0, 1.22, 1.08],
            [0.34, 0.59, 0.74],
          ])
        })
    })
  )
}
function jadeSeal(b, m, world, x, y, z) {
  b.at(x, y, z, 0, () => {
    for (const s of [-1, 1])
      path(
        b,
        m.bronze,
        [
          [s * 3.84, 0, 0],
          [s * 2.7, -0.98, 0],
          [s * 1.35, -1.65, 0],
          [s * 0.56, -1.83, 0],
        ],
        0.088,
        5
      )
    const cy = -3.06
    b.tube(m.ridgeGilt, [0, cy, -0.2], [0, cy, 0.2], 1.53, 1.53, 8)
    b.tube(m.patina, [0, cy, 0.204], [0, cy, 0.246], 1.31, 1.31, 8)
    b.tube(m.patina, [0, cy, -0.2], [0, cy, -0.25], 1.31, 1.31, 8)
    for (const s of [-1, 1])
      b.at(0, cy, s * 0.26, s > 0 ? 0 : Math.PI, () => {
        path(
          b,
          m.ridgeGilt,
          [
            [-1.01, 0.15, 0],
            [-0.66, 0.15, 0],
            [-0.59, 0.56, 0],
            [-0.06, 0.72, 0],
            [0.36, 0.48, 0],
            [0.4, 0.18, 0],
            [0.85, 0.13, 0],
            [0.98, -0.15, 0],
            [0.74, -0.38, 0],
            [-0.62, -0.38, 0],
          ],
          0.08,
          5
        )
        b.beam(m.bronze, [-0.49, -0.66, 0.01], [0.5, -0.66, 0.01], 0.065, 0.065)
      })
    for (const s of [-1, 1]) tassel(b, m, s * 0.52, cy - 1.35, 0, s * 0.33, 2.55)
    light(b, world, [0, cy + 0.47, 0.94], 0xffbe73, 13, 6)
  })
}
function westGate(b, m, world, site) {
  const h = 2.7
  court(b, m, site, h)
  const left = -14.6,
    right = 14.43,
    z = -4.38,
    walkZ = -4.38
  for (const [x, y, w, d] of [
    [left, 15.08, 12.6, 12.2],
    [right, 10.86, 12.5, 11.3],
  ])
    vaultedStorey(b, m, world, x, z, h, y, w, d, 1)
  room(b, m, world, {
    x: left,
    z,
    y: 15.08,
    w: 12.2,
    d: 11.9,
    h: 12.63,
    style: 'gallery',
    seed: 1,
    name: 0,
  })
  roofBand(b, m, {
    x: left,
    z,
    y: 27.72,
    w: 18.56,
    d: 17.22,
    cw: 10.2,
    cd: 9.3,
    rise: 3.23,
    lift: 2.01,
    gilded: true,
  })
  collar(b, m, left, z, 30.82, 31.55, 10.19, 9.3)
  room(b, m, world, { x: left, z, y: 31.55, w: 10.46, d: 10.05, h: 10.46, style: 'colonnade', seed: 1 })
  roofBand(b, m, {
    x: left,
    z,
    y: 42.02,
    w: 16.63,
    d: 16.0,
    cw: 8.5,
    cd: 8.3,
    rise: 3.37,
    lift: 1.93,
    skin: m.ridgeGlaze,
    gilded: true,
  })
  collar(b, m, left, z, 45.32, 46.18, 8.49, 8.29)
  room(b, m, world, { x: left, z, y: 46.18, w: 8.83, d: 8.74, h: 10.61, style: 'colonnade', seed: 4 })
  signalBell(b, m, left, 46.19, z - 1.15, 7.24)
  gable(b, m, {
    x: left,
    z,
    y: 56.81,
    w: 16.77,
    d: 15.04,
    rise: 9.37,
    lift: 2.04,
    skin: m.ridgeGlaze,
    gilded: true,
    tail: 1.16,
  })
  lotusFinial(b, m, left, 66.38, z, 1.57)
  room(b, m, world, { x: right, z, y: 10.86, w: 11.9, d: 10.5, h: 12.31, style: 'shuttered', seed: 4 })
  roofBand(b, m, {
    x: right,
    z,
    y: 23.18,
    w: 17.32,
    d: 16.0,
    cw: 9.55,
    cd: 8.8,
    rise: 3.1,
    lift: 1.72,
    gilded: true,
  })
  room(b, m, world, { x: right, z, y: 26.54, w: 9.51, d: 8.8, h: 4.99, seed: 2, style: 'gallery' })
  room(b, m, world, {
    x: right,
    z,
    y: 31.55,
    w: 10.66,
    d: 10.28,
    h: 9.11,
    style: 'colonnade',
    seed: 3,
    name: 3,
  })
  gable(b, m, {
    x: right,
    z,
    y: 40.7,
    w: 17.59,
    d: 15.7,
    rise: 9.41,
    lift: 1.83,
    skin: m.ridgeGlaze,
    gilded: true,
    tail: 1.16,
  })
  lotusFinial(b, m, right, 50.32, z, 1.06)
  bridge(b, m, world, left + 6.08, right - 6.28, walkZ, 31.55, 3.21, false)
  jadeSeal(b, m, world, 0, 31.26, walkZ + 1.45)
  for (const [x, zz] of [
    [-15.9, 7.71],
    [16.18, 7.62],
  ]) {
    room(b, m, world, {
      x,
      z: zz,
      y: h,
      w: 13.1,
      d: 4.2,
      h: 4.48,
      style: 'colonnade',
      seed: x < 0 ? 1 : 4,
      deck: 0.58,
    })
    gable(b, m, {
      x,
      z: zz,
      y: h + 4.5,
      w: 16.18,
      d: 6.81,
      rise: 3.59,
      lift: 0.81,
      tail: 0.35,
      crest: false,
    })
  }
  for (const [x, base, hang] of [
    [left - 4.1, 39.6, 6.2],
    [right + 4.3, 38.7, 4.4],
  ])
    tassel(b, m, x, base, z + 5.2, x < 0 ? -0.61 : 0.54, hang)
}

function slopingGallery(b, m, world, left, right, z, low, high, ground) {
  const w = 3.3,
    n = 8,
    pitch = (right - left) / n,
    top = (x) => low + ((high - low) * (x - left)) / (right - left)
  stair(b, m, [left, low, z], [right, high, z], w, false)
  for (const side of [-1, 1]) {
    const zz = z + side * (w / 2 - 0.11)
    rail(b, m, [left, low, zz], [right, high, zz], { rungs: 2.1 })
    for (let j = 0; j <= n; j++) {
      const xx = left + j * pitch,
        yy = top(xx)
      if (j > 0) {
        const foot = [xx, ground, zz],
          head = [xx, yy - 0.28, zz]
        if (head[1] > foot[1] + 0.8) {
          b.box(m.coping, xx, ground + 0.2, zz, 0.77, 0.4, 0.77)
          b.beam(m.timber, up(foot, 0.34), head, 0.43, 0.46)
        }
        if (j >= 2)
          b.beam(
            m.darkwood,
            [xx - pitch, top(xx - pitch) - 0.38, zz],
            [xx, Math.max(ground + 0.5, yy - 3.31), zz],
            0.23,
            0.25
          )
      }
      post(b, m, xx, zz, yy, 3.56, 0.18)
    }
    const D = 2.48
    const p = (x, v, off = 0) => [
      x,
      top(x) +
        3.57 +
        1.43 * (0.22 * v + 0.78 * v ** 1.7) +
        0.48 * Math.abs((2 * (x - left)) / (right - left) - 1) ** 6 * (1 - v) ** 2 +
        off,
      z + side * D * (1 - v),
    ]
    for (let j = 0; j < n; j++) {
      const a = left + j * pitch,
        c = left + (j + 1) * pitch
      for (let k = 0; k < 3; k++) {
        const t = k / 3,
          v = (k + 1) / 3
        b.face(m.ridgeJade, [p(a, t), p(c, t), p(c, v), p(a, v)], 0.92, [
          [a, t * 2],
          [c, t * 2],
          [c, v * 2],
          [a, v * 2],
        ])
        if (k === 0) b.face(m.wood, [p(a, t, -0.12), p(a, v, -0.12), p(c, v, -0.12), p(c, t, -0.12)])
      }
      b.beam(m.patina, p(a, 0), p(c, 0), 0.16, 0.16)
      if (side === 1 && j % 2 === 1) {
        const x = (a + c) / 2,
          yy = top(x) + 2.7
        hangingLamp(b, m, x, yy, z + 1.52, 0.27, 0.68, m.paper)
        light(b, world, [x, yy, z + 1.83], 0xffba6e, 18, 8)
      }
    }
  }
  b.beam(m.roofEdge, [left, low + 5.03, z], [right, high + 5.03, z], 0.28, 0.27)
}
function desk(b, m, x, y, z) {
  b.at(x, y, z, 0, () => {
    b.box(m.wood, 0, 0.95, 0, 3.67, 0.22, 1.78)
    for (const a of [-1, 1])
      for (const s of [-1, 1]) b.box(m.darkwood, a * 1.55, 0.44, s * 0.65, 0.15, 0.88, 0.17)
    b.box(m.pearl, 0, 1.073, 0, 2.62, 0.026, 1.12)
    for (const s of [-1, 1])
      b.tube(m.pearl, [s * 1.29, 1.15, -0.57], [s * 1.29, 1.15, 0.57], 0.095, 0.095, 8)
    for (let i = 0; i < 3; i++)
      path(
        b,
        m.patina,
        [
          [-1.08, 1.09, -0.3 + i * 0.1],
          [-0.55, 1.09, 0.05 + i * 0.09],
          [-0.18, 1.09, -0.13 + i * 0.09],
          [0.22, 1.09, 0.1 + i * 0.1],
          [0.57, 1.09, -0.06 + i * 0.11],
          [1.07, 1.09, 0.22 + i * 0.08],
        ],
        0.016,
        3
      )
    b.tube(m.ink, [0.96, 1.11, -0.24], [1.15, 1.11, 0.12], 0.025, 0.025, 4)
  })
}
function tideDrum(b, m, x, y, z) {
  b.at(x, y, z, -0.31, () => {
    for (const s of [-1, 1]) {
      b.beam(m.timber, [s * 1.55, 0, -0.95], [s * 1.24, 2.32, 0.25], 0.25, 0.29)
      b.beam(m.timber, [s * 1.55, 0, 1.01], [s * 1.23, 2.28, -0.07], 0.25, 0.29)
      b.box(m.bronze, s * 1.37, 0.18, 0, 0.47, 0.35, 2.29)
    }
    b.tube(m.wine, [0, 2.53, -0.86], [0, 2.53, 0.09], 1.62, 1.91, 18)
    b.tube(m.vermilion, [0, 2.53, 0.08], [0, 2.53, 0.91], 1.91, 1.62, 18)
    b.tube(m.pearl, [0, 2.53, 0.915], [0, 2.53, 0.992], 1.61, 1.59, 18)
    for (let i = 0; i < 16; i++) {
      const a = (i * tau) / 16,
        xx = 1.54 * Math.cos(a),
        yy = 2.53 + 1.54 * Math.sin(a)
      b.tube(m.bronze, [xx, yy, 0.982], [xx, yy, 1.02], 0.064, 0.057, 5)
    }
    for (const s of [-1, 1])
      b.tube(m.darkwood, [s * 2.04, 0.72, 1.46], [s * 1.44, 2.25, 1.6], 0.06, 0.089, 6)
  })
}
function riverFlags(b, m, x, y, z) {
  for (const [dx, h, len, rev] of [
    [-1.4, 6.96, 3.75, 1],
    [1.55, 4.7, 2.85, -1],
  ]) {
    b.at(x + dx, y, z, 0, () => {
      b.tube(m.bronze, [0, 0, 0], [0, h, 0], 0.15, 0.07, 7)
      b.tube(m.ridgeGilt, [0, h - 0.1, 0], [0, h + 0.76, 0], 0.17, 0.018, 7)
      const p = (t, bottom) => [
        rev * len * t,
        h - 0.4 - (bottom ? 0.1 + 1.14 * (1 - t) : 0) - t * 0.43 + 0.27 * Math.sin(t * 5),
        Math.sin(t * 6) * 0.36 + t * 0.44,
      ]
      for (let j = 0; j < 7; j++) {
        const a = j / 7,
          c = (j + 1) / 7
        b.face(
          rev < 0 ? m.paper : m.redSilk,
          [p(a, false), p(c, false), p(c, true), p(a, true)],
          0.86 + 0.1 * (j % 2)
        )
      }
    })
  }
}
function cantilever(b, m, world, y, z) {
  const outline = [
    [1.1, 1.84],
    [-5.42, 1.84],
    [-10.14, 1.59],
    [-13.75, 0],
    [-10.14, -1.59],
    [-5.42, -1.84],
    [1.1, -1.84],
  ]
  const points = outline.map(([x, zz]) => [x, y, z + zz])
  b.face(m.tiles, points)
  b.face(m.darkwood, points.map((p) => up(p, -0.42)).reverse())
  for (let j = 0; j < points.length - 1; j++) {
    const a = points[j],
      c = points[j + 1]
    b.face(m.timber, [a, c, up(c, -0.42), up(a, -0.42)])
    rail(b, m, a, c, { rungs: 2.45 })
  }
  for (const s of [-1, 1]) {
    const corner = [1.04, y + 6.14, z + s * 4.8],
      rim = [-10.57, y + 0.17, z + s * 1.1]
    b.tube(m.bronze, corner, [-4.66, y + 2.84, z + s * 2.83], 0.101, 0.1, 6, 1, false)
    b.tube(m.bronze, [-4.66, y + 2.84, z + s * 2.83], rim, 0.101, 0.1, 6, 1, false)
    for (const x of [-9.13, -5.86]) post(b, m, x, z + s * 1.23, y, 3.81, 0.15)
    b.beam(m.teal, [-12.7, y - 0.39, z], [-2.14, y - 0.77, z + s * 0.96], 0.31, 0.37)
  }
  gable(b, m, {
    x: -7.6,
    y: y + 3.84,
    z,
    w: 7.7,
    d: 5.15,
    rise: 2.91,
    lift: 0.87,
    tail: 0.44,
    crest: false,
  })
  hangingLamp(b, m, -7.6, y + 2.65, z + 1.29, 0.28, 0.65)
  light(b, world, [-7.6, y + 2.68, z + 1.49], 0xffb87e, 17, 8)
}
function eastWatch(b, m, world, site) {
  const h = 3.1,
    x = 8.25,
    z = -4.75
  court(b, m, site, h)
  vaultedStorey(b, m, world, x, z, h, 20.6, 17.76, 13.1, 3)
  room(b, m, world, { x, z, y: 20.6, w: 17.25, d: 12.76, h: 13.5, style: 'gallery', seed: 2, name: 1 })
  desk(b, m, x - 4.79, 20.61, z - 1.7)
  roofBand(b, m, {
    x,
    z,
    y: 34.18,
    w: 27.3,
    d: 21.42,
    cw: 14.22,
    cd: 10.53,
    rise: 5.63,
    lift: 2.73,
    gilded: true,
  })
  collar(b, m, x, z, 39.77, 40.64, 14.2, 10.51)
  room(b, m, world, { x, z, y: 40.64, w: 14.48, d: 11.27, h: 12.9, style: 'colonnade', seed: 1, name: 4 })
  cantilever(b, m, world, 40.64, z)
  tideDrum(b, m, x + 1.37, 40.65, z - 1.4)
  gable(b, m, {
    x,
    z,
    y: 53.57,
    w: 25.63,
    d: 20.77,
    rise: 14.27,
    lift: 2.62,
    skin: m.ridgeJade,
    gilded: false,
    tail: 1.33,
  })
  riverFlags(b, m, x + 1.02, 68.02, z)
  const bx = -16.43,
    bz = -7.94
  vaultedStorey(b, m, world, bx, bz, h, 10.9, 10.9, 9.31, 1)
  room(b, m, world, {
    x: bx,
    z: bz,
    y: 10.9,
    w: 10.32,
    d: 9.01,
    h: 9.8,
    style: 'colonnade',
    seed: 5,
    name: 4,
  })
  gable(b, m, {
    x: bx,
    z: bz,
    y: 20.73,
    w: 16.91,
    d: 14.0,
    rise: 7.28,
    lift: 1.95,
    skin: m.ridgeJade,
    tail: 0.96,
  })
  lotusFinial(b, m, bx, 28.2, bz, 0.82)
  const left = -22.54,
    right = 6.75,
    walkZ = 7.06
  slopingGallery(b, m, world, left, right, walkZ, h, 20.6, h)
  b.box(m.timber, x, 20.39, 4.87, 3.0, 0.42, 7.38)
  b.face(m.tiles, [
    [x - 1.5, 20.606, 8.56],
    [x + 1.5, 20.606, 8.56],
    [x + 1.5, 20.606, 1.18],
    [x - 1.5, 20.606, 1.18],
  ])
  rail(b, m, [x + 1.39, 20.6, 8.5], [x + 1.39, 20.6, 2.74])
  rail(b, m, [x - 1.39, 20.6, 5.16], [x - 1.39, 20.6, 2.74])
  rail(b, m, [x - 1.39, 20.6, 8.5], [x + 1.39, 20.6, 8.5])
  const sx = 20.63,
    sz = 10.5
  room(b, m, world, {
    x: sx,
    z: sz,
    y: h,
    w: 7.12,
    d: 4.54,
    h: 4.65,
    style: 'colonnade',
    seed: 2,
    deck: 0.61,
  })
  gable(b, m, { x: sx, z: sz, y: 7.76, w: 9.43, d: 6.78, rise: 3.54, lift: 0.86, tail: 0.4 })
  for (const s of [-1, 1]) tassel(b, m, x + s * 7.03, 50.59, z + 5.73, s * 0.75, 5.05)
}
function crossBridge(b, m, world, a, c, w = 3.18) {
  const dx = c[0] - a[0],
    dz = c[2] - a[2]
  b.at(a[0], a[1], a[2], Math.atan2(-dz, dx), () =>
    bridge(b, m, world, 0, Math.hypot(dx, dz), 0, 0, w, false)
  )
}
function ovoid(b, material, p, r) {
  const n = 12,
    rows = 7
  const point = (a, f) => [
    p[0] + r[0] * Math.cos(f) * Math.cos(a),
    p[1] + r[1] * Math.sin(f),
    p[2] + r[2] * Math.cos(f) * Math.sin(a),
  ]
  for (let i = 0; i < n; i++)
    for (let j = 0; j < rows; j++) {
      const a = (i * tau) / n,
        c = ((i + 1) * tau) / n,
        f = Math.PI * (j / rows - 0.5),
        g = Math.PI * ((j + 1) / rows - 0.5)
      const q = [point(a, f), point(c, f), point(c, g), point(a, g)]
      b.face(
        material,
        j === 0 ? [q[0], q[2], q[3]] : j === rows - 1 ? q.slice(0, 3) : q,
        0.86 + (0.1 * (i % 3)) / 2
      )
    }
}
function phoenix(b, m, x, y, z) {
  b.at(x, y, z, 0.38, () => {
    ovoid(b, m.bronze, [0, 2.79, -0.05], [1.07, 1.16, 2.19])
    ovoid(b, m.ridgeGilt, [0, 2.96, 1.07], [0.78, 0.94, 1.12])
    for (const s of [-1, 1]) {
      b.tube(m.bronze, [s * 0.52, 0.1, -0.38], [s * 0.38, 2.08, 0.02], 0.19, 0.12, 6)
      b.tube(m.bronze, [s * 0.52, 0.1, -0.39], [s * 0.71, 0.1, 0.66], 0.13, 0.047, 5)
      for (let k = 0; k < 8; k++) {
        const f = k / 7,
          base = [s * 0.72, 2.42 + 0.79 * f, 1.41 - 2.0 * f],
          mid = [s * (2.88 + 1.66 * f), 4.11 + 2.34 * f, 1.38 - 3.06 * f],
          tip = [s * (5.2 + 3.13 * f), 4.87 + 4.93 * f, 2.18 - 5.16 * f]
        const under = add(mid, [s * 0.29, -0.76, 0.61]),
          rib = add(mid, [s * 0.12, -0.18, 0.35])
        b.face(k % 3 ? m.ridgeGilt : m.bronze, [base, mid, tip, rib], 0.86 + f * 0.13)
        b.face(m.bronze, [base, rib, tip, under], 0.83 + f * 0.1)
        path(b, k % 2 ? m.patina : m.bronze, [base, rib, lerp3(rib, tip, 0.79)], 0.045, 4)
      }
      for (let j = 0; j < 5; j++) {
        const mid = [s * (1.22 + 0.35 * j), 2.08 + 0.43 * j, -3.66 - 0.2 * j],
          pt = [s * (2.18 + 0.94 * j), 2.73 + 0.75 * j, -5.29 - 0.69 * j]
        const edge = add(mid, [s * 0.4, -0.34, -0.08]),
          spine = add(mid, [s * 0.15, -0.06, 0.1])
        b.face(j % 2 ? m.ridgeGilt : m.patina, [[s * 0.33, 2.33, -1.24], mid, pt, spine], 0.93)
        b.face(m.bronze, [[s * 0.33, 2.33, -1.24], spine, pt, edge], 0.83)
      }
    }
    const neck = [
      [0, 3.11, 1.14],
      [-0.12, 3.88, 1.75],
      [-0.59, 4.71, 1.66],
      [-1.04, 5.35, 1.75],
      [-1.34, 5.72, 2.11],
    ]
    for (let i = 1; i < neck.length; i++)
      b.tube(m.ridgeGilt, neck[i - 1], neck[i], 0.59 - i * 0.06, 0.54 - i * 0.06, 8, 1, false)
    ovoid(b, m.bronze, [-1.39, 5.83, 2.19], [0.47, 0.41, 0.62])
    b.tube(m.ridgeGilt, [-1.6, 5.83, 2.57], [-2.41, 5.61, 3.52], 0.23, 0.016, 7)
    for (const s of [-1, 1]) ovoid(b, m.ink, [-1.4 + s * 0.39, 5.9, 2.37], [0.091, 0.1, 0.074])
    for (const s of [-1, 0, 1])
      b.tube(
        m.ridgeGilt,
        [-1.31 + s * 0.15, 6.1, 2.15],
        [-0.91 + s * 0.66, 7.02 - 0.19 * Math.abs(s), 1.23],
        0.12,
        0.02,
        5
      )
  })
}
function audienceFan(b, m, x, y, z) {
  b.at(x, y, z, 0, () => {
    b.box(m.timber, 0, 0.36, 0, 4.32, 0.72, 1.32)
    for (let j = -4; j <= 4; j++) {
      const a = j * 0.143,
        r = 5.18 - Math.abs(j) * 0.12,
        p = (s, h, d) => [
          Math.sin(a) * h + Math.cos(a) * s,
          Math.cos(a) * h - Math.sin(a) * s,
          d - 0.16 * Math.abs(j),
        ]
      const top = p(0, r + 0.45, 0.04),
        left = p(-0.53, r - 0.62, 0.07),
        right = p(0.53, r - 0.62, 0.07),
        base = p(0, 0.66, 0.03),
        rib = p(0, r - 0.94, 0.27)
      b.face(j % 2 ? m.patina : m.bronze, [base, left, top, rib])
      b.face(m.ridgeGilt, [base, rib, top, right], 0.92)
      path(b, m.bronze, [base, rib, p(0, r + 0.03, 0.15)], 0.051, 4)
    }
  })
}
function throne(b, m, x, y, z) {
  b.at(x, y, z, 0, () => {
    masonry(b, m, 0, 0, 0, 0.56, 5.52, 3.12, { bevel: 0.49, batter: 0.16, trim: false })
    b.box(m.darkwood, 0, 1.27, -0.28, 2.06, 0.25, 1.43)
    for (const s of [-1, 1])
      for (const a of [-1, 1]) b.box(m.ridgeGilt, s * 0.83, 0.9, a * 0.51 - 0.28, 0.15, 0.66, 0.17)
    b.box(m.vermilion, 0, 2.07, -0.97, 1.99, 1.56, 0.23)
    for (const s of [-1, 1]) {
      path(
        b,
        m.ridgeGilt,
        [
          [s * 0.88, 1.86, 0.32],
          [s * 1.07, 1.99, 0.0],
          [s * 0.99, 2.25, -0.33],
          [s * 0.89, 2.3, -0.86],
        ],
        0.1,
        5
      )
      post(b, m, s * 2.05, -1.12, 0.56, 4.48, 0.16)
      tassel(b, m, s * 1.64, 4.65, -1.17, s * 0.16, 1.8)
    }
    b.beam(m.ridgeGilt, [-2.18, 4.87, -1.14], [2.18, 4.87, -1.14], 0.15, 0.15)
    picture(b, m.ridgeWindow, 4, 0, 3.39, -1.21, 1.91, 2.43, 0.84)
  })
}

function phoenixCourt(b, m, world, site) {
  const h = 3.6,
    x = 3.82,
    z = -5.32
  court(b, m, site, h)
  vaultedStorey(b, m, world, x, z, h, 22.3, 24.12, 17.51, 3)
  room(b, m, world, { x, z, y: 22.3, w: 23.44, d: 17.11, h: 14.45, style: 'gallery', seed: 3, name: 2 })
  throne(b, m, x + 0.2, 22.31, z - 3.25)
  roofBand(b, m, {
    x,
    z,
    y: 36.79,
    w: 34.25,
    d: 26.74,
    cw: 19.86,
    cd: 14.6,
    rise: 5.77,
    lift: 2.84,
    skin: m.ridgeGlaze,
    gilded: true,
  })
  collar(b, m, x, z, 42.49, 43.28, 19.79, 14.61)
  room(b, m, world, {
    x,
    z,
    y: 43.28,
    w: 20.29,
    d: 15.28,
    h: 10.11,
    style: 'colonnade',
    seed: 4,
    name: 5,
  })
  room(b, m, world, { x, z, y: 53.42, w: 18.95, d: 14.75, h: 7.06, style: 'gallery', seed: 2 })
  roofBand(b, m, {
    x,
    z,
    y: 60.52,
    w: 30.39,
    d: 25.32,
    cw: 13.49,
    cd: 11.83,
    rise: 6.48,
    lift: 2.79,
    skin: m.ridgeJade,
    gilded: true,
    feathers: true,
  })
  collar(b, m, x, z, 66.97, 67.62, 13.49, 11.82)
  room(b, m, world, {
    x,
    z,
    y: 67.62,
    w: 13.64,
    d: 12.06,
    h: 13.46,
    style: 'colonnade',
    seed: 1,
    name: 5,
  })
  audienceFan(b, m, x, 67.63, z - 2.35)
  gable(b, m, {
    x,
    z,
    y: 81.12,
    w: 25.43,
    d: 21.08,
    rise: 13.61,
    lift: 2.65,
    skin: m.ridgeGlaze,
    gilded: true,
    tail: 1.38,
  })
  phoenix(b, m, x + 0.11, 94.98, z)
  for (const s of [-1, 1]) {
    hangingLamp(b, m, x + s * 6.22, 95.47, z + 0.23, 0.44, 0.9, m.paper)
    light(b, world, [x + s * 6.22, 95.58, z + 0.55], 0xffce80, 28, 17)
  }
  const west = -27.1,
    wz = 1.32
  vaultedStorey(b, m, world, west, wz, h, 12.5, 11.45, 9.39, 1)
  room(b, m, world, { x: west, z: wz, y: 12.5, w: 10.97, d: 9.06, h: 6.48, style: 'shuttered', seed: 1 })
  roofBand(b, m, {
    x: west,
    z: wz,
    y: 19.0,
    w: 18.3,
    d: 14.22,
    cw: 9.58,
    cd: 8.32,
    rise: 2.91,
    lift: 1.26,
    gilded: true,
  })
  collar(b, m, west, wz, 21.85, 22.3, 9.56, 8.31)
  room(b, m, world, { x: west, z: wz, y: 22.3, w: 10.22, d: 8.72, h: 10.14, style: 'colonnade', seed: 4 })
  gable(b, m, { x: west, z: wz, y: 32.48, w: 19.24, d: 14.88, rise: 8.37, lift: 1.77, tail: 0.95 })
  lotusFinial(b, m, west, 41.04, wz, 1.19)
  crossBridge(b, m, world, [west + 6.11, 22.3, wz], [x - 12.76, 22.3, z], 3.23)
  const east = 29.77,
    ez = -3.8
  vaultedStorey(b, m, world, east, ez, h, 16.76, 12.29, 11.39, 1)
  room(b, m, world, { x: east, z: ez, y: 16.76, w: 12.01, d: 10.98, h: 11.79, style: 'gallery', seed: 3 })
  roofBand(b, m, {
    x: east,
    z: ez,
    y: 28.58,
    w: 18.8,
    d: 16.82,
    cw: 9.9,
    cd: 8.92,
    rise: 4.12,
    lift: 1.91,
    gilded: true,
  })
  collar(b, m, east, ez, 32.68, 33.21, 9.88, 8.89)
  room(b, m, world, {
    x: east,
    z: ez,
    y: 33.21,
    w: 10.47,
    d: 9.02,
    h: 10.04,
    style: 'shuttered',
    seed: 3,
  })
  room(b, m, world, {
    x: east,
    z: ez,
    y: 43.28,
    w: 11.14,
    d: 10.09,
    h: 9.62,
    style: 'colonnade',
    seed: 1,
  })
  gable(b, m, {
    x: east,
    z: ez,
    y: 52.94,
    w: 19.84,
    d: 17.56,
    rise: 8.66,
    lift: 1.94,
    skin: m.ridgeGlaze,
    gilded: true,
    tail: 1.17,
  })
  lotusFinial(b, m, east, 61.84, ez, 0.98)
  crossBridge(b, m, world, [x + 11.154, 43.28, z], [east - 6.58, 43.28, ez], 3.2)
  for (const [xx, zz, w] of [
    [-23.8, 13.02, 20.36],
    [23.1, 12.76, 20.72],
  ]) {
    room(b, m, world, { x: xx, z: zz, y: h, w, d: 4.12, h: 4.92, style: 'colonnade', seed: 2, deck: 0.5 })
    gable(b, m, {
      x: xx,
      z: zz,
      y: h + 4.93,
      w: w + 3.64,
      d: 7.4,
      rise: 4.41,
      lift: 0.97,
      tail: 0.55,
      crest: false,
    })
  }
  for (const s of [-1, 1]) tassel(b, m, x + s * 9.68, 50.68, z + 7.7, s * 0.66, 6.1)
}

export function ridgePalaces(b, m, world) {
  paint(m)
  const [west, east, north] = palaceSites
  for (const [site, build] of [
    [west, westGate],
    [east, eastWatch],
    [north, phoenixCourt],
  ]) {
    b.at(site.x, site.y, site.z, 0, () => build(b, m, world, site))
  }
}
