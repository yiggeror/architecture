import * as T from 'three'
import { Mason } from './mesh.js'
import { reachTerraces } from './reachMap.js'
import { reachFace, reachMaterials } from './reachWardArt.js'
import { streetLantern } from './reachWardLamps.js'
import { rooflineSites } from './reachRooflineSites.js'

const tau = Math.PI * 2
const meters = (p, q, t) => p.map((n, i) => n + (q[i] - n) * t)
function plan(shape, r, angle, y) {
  return [
    Math.sin(angle) * r * (shape === 'hall' ? 1.28 : 1),
    y,
    Math.cos(angle) * r * (shape === 'hall' ? 0.83 : 1),
  ]
}
function roofRing(b, m, shape, sides, r, y, rise, shade, lit, far) {
  const across = far ? 2 : 4,
    rows = far ? 2 : 3
  const hip = shape === 'pagoda' ? 0.37 : 0.51
  function point(k, s, v, drop = 0) {
    const angle = ((k + 0.5) * tau) / sides,
      next = angle + tau / sides
    const scale = 1 + (hip - 1) * v
    const curve =
      rise * (0.22 * v + 0.78 * v * v) + (0.34 + 0.036 * r) * Math.abs(2 * s - 1) ** 3.2 * (1 - v) ** 2
    return meters(
      plan(shape, r * scale, angle, y + curve - drop),
      plan(shape, r * scale, next, y + curve - drop),
      s
    )
  }
  for (let k = 0; k < sides; k++) {
    for (let j = 0; j < across; j++)
      for (let h = 0; h < rows; h++) {
        const a = j / across,
          c = (j + 1) / across,
          v = h / rows,
          w = (h + 1) / rows
        b.face(shade, [point(k, a, v), point(k, c, v), point(k, c, w), point(k, a, w)])
        if (!h) {
          const la = point(k, a, 0),
            lc = point(k, c, 0)
          b.face(m.darkwood, [la, lc, point(k, c, 0.96, 0.18), point(k, a, 0.96, 0.18)], 0.83)
          b.face(m.roofEdge, [la, point(k, a, 0, 0.17), point(k, c, 0, 0.17), lc], 1.12)
          if (lit && !far && (j === 0 || j === 3))
            b.beam(m.bronze, point(k, a, 0, 0.11), point(k, c, 0, 0.11), 0.073, 0.058, 1.09)
        }
        if (!j && !far) b.beam(m.roofEdge, point(k, a, v), point(k, a, w), 0.18, 0.135, 1.11)
      }
    const tip = point(k, 0, 0)
    const fin = [tip[0] * 1.055, tip[1] + 0.42, tip[2] * 1.055]
    b.beam(m.bronze, tip, fin, 0.13, 0.1)
  }
}
function drum(b, m, world, shape, sides, r, y, h, level, id, far, beacon) {
  for (let k = 0; k < sides; k++) {
    const a = ((k + 0.5) * tau) / sides
    const edge = (f, rad, alt) => meters(plan(shape, rad, a, alt), plan(shape, rad, a + tau / sides, alt), f)
    const outer = r * 0.82,
      inner = r * 0.645,
      door = !level && (k === sides - 1 || k === Math.floor(sides / 2) - 1)
    if (!door) {
      b.face(
        m.timber,
        [edge(0, inner, y), edge(1, inner, y), edge(1, inner, y + h), edge(0, inner, y + h)],
        0.81
      )
      const count = shape === 'hall' ? 4 : 3,
        start = edge(0, inner, 0),
        end = edge(1, inner, 0),
        stileHalf = 0.027 / Math.hypot(end[0] - start[0], end[2] - start[2])
      for (let j = 0; j < count; j++) {
        const l = (j + 0.1) / count,
          v = (j + 0.9) / count,
          lo = y + h * (shape === 'pagoda' ? 0.31 : 0.23),
          hi = y + h * 0.83
        if ((j + 2 * k + id + level) % 9 === 0) continue
        const corners = [
          edge(l, inner + 0.06, lo),
          edge(v, inner + 0.06, lo),
          edge(v, inner + 0.06, hi),
          edge(l, inner + 0.06, hi),
        ]
        // Shuttered ends, lamplit silk and the glimpse of a lit gallery retain
        // their silhouettes when this entire tower is only a few pixels high.
        const room = (id * 3 + level * 5 + k + (j === 0 ? 2 : 0)) % 8,
          slot =
            room < 2
              ? 8 + ((id + j) % 4)
              : room === 2
                ? 64 + ((j + k) % 4)
                : room === 3
                  ? 80 + ((id + k) % 4)
                  : (j + level + k) % 8
        reachFace(b, m.reachPaper, slot, corners, 0.75 + 0.32 * ((id + j + k) % 3), [
          [0.065, 0.32],
          [0.935, 0.32],
          [0.935, 0.93],
          [0.065, 0.93],
        ])

        if (far) continue
        // Two exposed bevels are the cross section of each planted moulding.
        // Its back and end grain sit inside the sash and need no drawn faces.
        const f = (l + v) / 2,
          band = lo + (hi - lo) * 0.71
        for (const side of [-1, 1]) {
          const lip = f + side * stileHalf,
            shoulder = band + side * 0.025
          b.face(
            m.darkwood,
            [
              edge(lip, inner + 0.066, lo),
              edge(f, inner + 0.132, lo),
              edge(f, inner + 0.132, hi),
              edge(lip, inner + 0.066, hi),
            ],
            side === 1 ? 0.93 : 1.05
          )
          b.face(
            m.darkwood,
            [
              edge(l, inner + 0.067, shoulder),
              edge(v, inner + 0.067, shoulder),
              edge(v, inner + 0.118, band),
              edge(l, inner + 0.118, band),
            ],
            side === 1 ? 1 : 0.87
          )
        }
      }
    }
    const post = edge(0.02, outer, y)
    if (far)
      b.face(
        m.vermilion,
        [edge(0, outer, y), edge(0.055, outer, y), edge(0.055, outer, y + h), edge(0, outer, y + h)],
        0.91
      )
    else b.beam(m.vermilion, post, edge(0.02, outer, y + h), 0.24, 0.23, 0.91)
    if (!far) b.beam(m.wood, edge(0, outer, y + h - 0.22), edge(1, outer, y + h - 0.22), 0.3, 0.28)
    if (!door && !far) {
      for (const rail of [0.36, 0.89])
        b.beam(m.timber, edge(0, outer, y + rail), edge(1, outer, y + rail), 0.1, 0.093)
      for (const f of [0.25, 0.53, 0.78])
        b.beam(m.wood, edge(f, outer, y + 0.13), edge(f, outer, y + 0.9), 0.09, 0.09)
    }
    if (beacon && (k === sides - 1 || k === Math.floor(sides * 0.67))) {
      const front = k === sides - 1,
        pair = front && shape === 'hall'
      for (const f of pair ? [0.27, 0.74] : [0.43]) {
        const ceiling = y + h - 0.22,
          height = Math.min(0.96, 0.46 + r * 0.071),
          at = edge(f, outer, ceiling - height * 0.77),
          red = shape === 'hall' && !level && f < 0.52
        if (!far)
          b.beam(m.bronze, [at[0], ceiling, at[2]], [at[0], at[1] + 0.54 * height, at[2]], 0.048, 0.049)
        streetLantern(
          b,
          m,
          ...at,
          height * 0.44,
          height,
          red,
          far || shape === 'watch',
          front ? 1.32 : 1,
          far
        )
        if (!far)
          world.addLightAt(
            b,
            ...at,
            red ? 0xff9e53 : 0xffc778,
            front ? (pair ? 34 : 48) : 25,
            front ? 11.8 : 8.8
          )
      }
    }
    const l = edge(0, outer * 1.055, y),
      v = edge(1, outer * 1.055, y)
    b.face(m.tiles, [[0, y, 0], l, v])
    b.face(m.darkwood, [l, v, edge(1, outer * 1.055, y - 0.22), edge(0, outer * 1.055, y - 0.22)])
  }
}
function landmark(b, m, world, t, f, shape, count, r, id, far = false) {
  const n = shape === 'pagoda' ? 8 : shape === 'hall' ? 4 : 6,
    x = t.width * f,
    rear = -t.depth / 2
  const radius = r * (shape === 'hall' ? 1.22 : 1.03)
  const z = rear - radius - 0.65
  b.at(t.x, t.y, t.z, t.yaw, () =>
    b.at(x, 0, z, 0, () => {
      const skirt = 7.4
      for (let i = 0; i < 8; i++) {
        const a = ((i + 0.5) * tau) / 8,
          c = a + tau / 8
        const p = (an, ra, h) => [Math.cos(an) * ra, h, Math.sin(an) * ra]
        const l = p(a, radius + 0.8, -0.03),
          v = p(c, radius + 0.8, -0.03)
        b.face(m.stone, [[0, -0.03, 0], l, v], 0.97)
        b.face(m.foundation, [l, v, p(c, radius + 0.52, -skirt), p(a, radius + 0.52, -skirt)], 0.83)
        b.face(m.coping, [l, v, p(c, radius + 0.85, -0.42), p(a, radius + 0.85, -0.42)])
      }
      b.box(m.coping, 0, -0.16, radius - 0.03, r * 0.62, 0.33, 3.1)
      let y = 0.12,
        body = r
      for (let i = 0; i < count; i++) {
        const h = (shape === 'hall' ? 4.75 : shape === 'pagoda' ? 4.05 : 5.25) * (i === 0 ? 1.3 : 1)
        const rise = 1.26 + 0.14 * body
        const beacon = i === 0 || i === count - 1 || (shape === 'pagoda' && i === 2)
        drum(b, m, world, shape, n, body, y, h, i, id, far, beacon)
        roofRing(
          b,
          m,
          shape,
          n,
          body * 1.105,
          y + h,
          rise,
          i % 2 === 0 ? m.roof : m.tealRoof,
          i % 2 === 0,
          far
        )
        y += h + rise - 0.1
        body *= shape === 'pagoda' ? 0.871 : 0.82
      }
      for (let k = 0; k < n; k++) {
        const a = ((k + 0.5) * tau) / n,
          c = a + tau / n
        b.face(m.roof, [
          plan(shape, body * 0.64, a, y - 0.1),
          plan(shape, body * 0.64, c, y - 0.1),
          [0, y + 0.36, 0],
        ])
      }
      const fins = [
        [-0.15, 1.0],
        [0.28, 0.69],
        [0.65, 0.44],
        [1.14, 0.23],
        [1.41, 0.43],
        [1.69, 0.21],
        [2.27, 0.1],
        [2.85, 0.025],
      ]
      for (let k = 1; k < fins.length; k++)
        b.tube(m.bronze, [0, y + fins[k - 1][0], 0], [0, y + fins[k][0], 0], fins[k - 1][1], fins[k][1], 8)
    })
  )
}
function belvedere(b, m, world, t, at, length, id) {
  b.at(t.x, t.y, t.z, t.yaw, () =>
    b.at(at, -5.12, t.depth / 2 + 3.65, 0, () => {
      const bays = Math.round(length / 3.8),
        step = length / bays
      b.box(m.timber, 0, -0.18, 0, length + 0.6, 0.36, 5.25)
      b.box(m.wood, 0, 3.61, 0.09, length + 0.4, 0.29, 4.97)
      b.face(m.roof, [
        [-length / 2 - 0.6, 3.65, 2.86],
        [length / 2 + 0.6, 3.65, 2.86],
        [length / 2, 4.62, -0.48],
        [-length / 2, 4.62, -0.48],
      ])
      b.face(m.roof, [
        [length / 2, 4.62, -0.48],
        [-length / 2, 4.62, -0.48],
        [-length / 2 - 0.35, 3.83, -2.89],
        [length / 2 + 0.35, 3.83, -2.89],
      ])
      b.beam(m.roofEdge, [-length / 2 - 0.6, 3.68, 2.87], [length / 2 + 0.6, 3.68, 2.87], 0.15, 0.12)
      for (let j = 0; j <= bays; j++) {
        const x = -length / 2 + step * j
        b.box(m.wood, x, 1.74, 2.32, 0.2, 3.5, 0.24)
        if (j % 2 === 0 || j === bays) {
          b.box(m.foundation, x, -3.1, 1.8, 0.53, 6.2, 0.56)
          b.beam(m.darkwood, [x, -3.1, 0.45], [x, -0.23, 2.25], 0.22, 0.19)
        }
        if (j === bays) continue
        const c = x + step / 2
        b.box(m.timber, c, 1.72, -1.2, step, 3.46, 0.23)
        if ((j + id) % 4 !== 2) {
          const w = step * 0.79,
            height = 1.73
          reachFace(
            b,
            m.reachPaper,
            (j + id) % 5 === 0 ? 8 + (j % 4) : (j + id) % 8,
            [
              [c - w / 2, 0.89, -1.061],
              [c + w / 2, 0.89, -1.061],
              [c + w / 2, 0.89 + height, -1.061],
              [c - w / 2, 0.89 + height, -1.061],
            ],
            0.92,
            [
              [0.06, 0.32],
              [0.94, 0.32],
              [0.94, 0.93],
              [0.06, 0.93],
            ]
          )
          for (const off of [-0.23, 0, 0.23]) b.box(m.wood, c + off * w, 1.76, -1.03, 0.048, height, 0.082)
          b.box(m.darkwood, c, 2.23, -1.02, w, 0.068, 0.08)
        }
        for (const y of [0.45, 0.92]) b.beam(m.darkwood, [x, y, 2.32], [x + step, y, 2.32], 0.1)
        if ((j + id) % 3 === 0) {
          b.beam(m.bronze, [c, 3.52, 1.82], [c, 3.15, 1.82], 0.034, 0.037)
          streetLantern(b, m, c, 2.84, 1.82, 0.235, 0.62, (j + id) % 2 === 0, true)
          world.addLightAt(b, c, 2.84, 1.82, 0xffaf68, 25, 8.1)
        }
      }
    })
  )
}
export function reachRoofline(builder, m, world) {
  reachMaterials(m)
  m.tealRoof = m.roof.clone()
  m.tealRoof.color.set(0x356267)
  m.tealRoof.name = '翠青重瓦'
  const grouped = new Map()
  for (const row of reachTerraces) {
    if (!grouped.has(row.group)) grouped.set(row.group, [])
    grouped.get(row.group).push(row)
  }
  for (const [id, site] of rooflineSites.entries()) {
    const lod = new T.LOD()
    lod.position.set(site.x, site.y + site.levels * 3, site.z)
    lod.name = site.row.group + '街后楼'
    for (const far of [false, true]) {
      const models = new T.Group(),
        b = new Mason(models)
      landmark(b, m, world, site.row, site.fraction, site.shape, site.levels, site.r, id, far)
      b.finish()
      models.position.copy(lod.position).multiplyScalar(-1)
      models.userData.noCollision = far
      models.userData.noWeather = far
      lod.addLevel(models, far ? 116 : 0, 0.12)
    }
    builder.scene.add(lod)
  }
  for (const [i, rows] of [...grouped.values()].entries()) {
    const t = rows[0]
    if (t.y < 13 || t.group === '桂浦') continue
    const b = new Mason(builder.scene)
    belvedere(b, m, world, t, -t.width * 0.24, t.width * 0.35, i)
    if (t.width > 89 && i % 4 !== 1) belvedere(b, m, world, t, t.width * 0.32, t.width * 0.24, i + 2)
    b.finish()
  }
}
