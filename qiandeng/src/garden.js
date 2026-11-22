import * as T from 'three'
import { roof, lantern, windowBay } from './kit.js'
import { generator } from './mesh.js'

const X = -41.6,
  Z = 82.9,
  Y = 1.35,
  tau = Math.PI * 2
const oval = Array.from({ length: 54 }, (_, i) => {
  const a = (tau * i) / 54,
    r = 1 + 0.085 * Math.sin(3 * a - 0.61) + 0.062 * Math.sin(2 * a + 1)
  return [-2.85 + 4.83 * r * Math.cos(a), 0.02 + 1.55 * r * Math.sin(a)]
})
const rectangle = [
  [-12.6, -3.47],
  [12.5, -3.47],
  [12.5, 3.28],
  [-12.6, 3.28],
]
function top(b, m, edge, holes, y, tint = 1) {
  const pts = (a) => a.map(([x, z]) => new T.Vector2(x, z))
  const vertices = [...edge, ...holes.flat()]
  for (const indices of T.ShapeUtils.triangulateShape(pts(edge), holes.map(pts))) {
    b.face(m, indices.map((i) => [vertices[i][0], y, vertices[i][1]]).reverse(), tint)
  }
}
function tiledWall(b, m, x, z, w, h, angle = 0) {
  b.at(x, 0, z, angle, () => {
    b.box(m.plaster, 0, 0.48 + h / 2, 0, w, h, 0.265, 0.92)
    b.box(m.foundation, 0, 0.61, 0, w, 0.26, 0.31, 0.89)
    b.box(m.coping, 0, 0.8, 0, w, 0.09, 0.34)
    for (const side of [-1, 1]) {
      b.face(
        m.roof,
        [
          [-w / 2, h + 0.57, 0],
          [w / 2, h + 0.57, 0],
          [w / 2, h + 0.46, side * 0.24],
          [-w / 2, h + 0.46, side * 0.24],
        ],
        0.98
      )
      b.box(m.roofEdge, 0, h + 0.435, side * 0.23, w, 0.07, 0.067)
    }
    b.tube(m.roofEdge, [-w / 2, h + 0.58, 0], [w / 2, h + 0.58, 0], 0.055, 0.055, 7)
  })
}
function moonWall(b, m) {
  const z = -3.28,
    x = -5.1,
    half = 1.73,
    bottom = 0.48,
    height = 3.1,
    cy = 1.91,
    r = 1.37
  const inner = [],
    border = []
  for (let i = 0; i < 64; i++) {
    const a = (i * tau) / 64,
      dx = Math.cos(a),
      dy = Math.sin(a)
    const run = Math.min(
      half / Math.max(0.00001, Math.abs(dx)),
      (dy > 0 ? bottom + height - cy : cy - bottom) / Math.max(0.00001, Math.abs(dy))
    )
    inner.push([x + r * dx, cy + r * dy])
    border.push([x + dx * run, cy + dy * run])
  }
  const p = (a, f) => [a[0], a[1], z + f]
  for (let i = 0; i < 64; i++) {
    const j = (i + 1) % 64
    for (const s of [-1, 1]) {
      b.face(
        m.plaster,
        [p(inner[i], s * 0.148), p(inner[j], s * 0.148), p(border[j], s * 0.148), p(border[i], s * 0.148)],
        0.96
      )
      const a = inner[i],
        c = inner[j],
        ri = 1.05
      b.face(m.coping, [
        p(a, s * 0.16),
        p(c, s * 0.16),
        p([x + (c[0] - x) * ri, cy + (c[1] - cy) * ri], s * 0.16),
        p([x + (a[0] - x) * ri, cy + (a[1] - cy) * ri], s * 0.16),
      ])
    }
    b.face(m.coping, [p(inner[i], -0.16), p(inner[j], -0.16), p(inner[j], 0.16), p(inner[i], 0.16)], 0.9)
  }
  for (const s of [-1, 1]) {
    const side = x + s * half
    b.face(m.plaster, [
      [side, bottom, z - 0.148],
      [side, bottom + height, z - 0.148],
      [side, bottom + height, z + 0.148],
      [side, bottom, z + 0.148],
    ])
  }
  b.box(m.roofEdge, x, bottom + height + 0.07, z, half * 2 + 0.1, 0.14, 0.43)
  for (const [l, h] of [
    [-12.56, x - half],
    [x + half, 4.79],
  ])
    tiledWall(b, m, (l + h) / 2, z, h - l, 2.14)
  for (const s of [-1, 1]) b.tube(m.bronze, [x + s * 1.67, 3.56, z], [x + s * 1.67, 3.86, z], 0.085, 0.023, 7)
}
function rock(b, m, x, z, height, seed) {
  const rng = generator(seed),
    lean = rng() > 0.5 ? 1 : -1
  function field(x, y, z) {
    const form =
      ((x - 0.085 * lean * Math.sin(4 * y)) / 0.49) ** 2 +
      ((y - 0.5) / 0.57) ** 2 +
      (z / (0.35 + 0.052 * Math.sin(5 * y))) ** 2 -
      1
    const cut = (xx, yy, rx, ry) =>
      1 - ((x - xx - 0.115 * z) / rx) ** 2 - ((y - yy) / ry) ** 2 - ((z - 0.06) / 0.9) ** 2
    return Math.max(
      form + 0.13 * Math.sin(11 * x + 4 * y) * Math.sin(14 * y - 6 * z),
      cut(0.05, 0.6, 0.18, 0.13),
      cut(-0.14, 0.3, 0.1, 0.088),
      cut(0.2, 0.81, 0.095, 0.072)
    )
  }
  const N = 19,
    lo = [-0.64, -0.02, -0.48],
    span = [1.28, 1.11, 0.96],
    rows = []
  const cube = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ]
  const tets = [
    [0, 5, 1, 6],
    [0, 1, 2, 6],
    [0, 2, 3, 6],
    [0, 3, 7, 6],
    [0, 7, 4, 6],
    [0, 4, 5, 6],
  ]
  for (let j = 0; j <= N; j++)
    for (let k = 0; k <= N; k++)
      for (let i = 0; i <= N; i++) {
        const p = [lo[0] + (span[0] * i) / N, lo[1] + (span[1] * j) / N, lo[2] + (span[2] * k) / N]
        rows.push({ p, v: field(...p) })
      }
  const get = (i, j, k) => rows[(j * (N + 1) + k) * (N + 1) + i]
  const intersect = (a, c) => a.p.map((v, i) => v + ((c.p[i] - v) * a.v) / (a.v - c.v))
  for (let j = 0; j < N; j++)
    for (let k = 0; k < N; k++)
      for (let i = 0; i < N; i++) {
        const box = cube.map(([a, c, d]) => get(i + a, j + c, k + d))
        if (box.every((p) => p.v > 0) || box.every((p) => p.v < 0)) continue
        for (const tet of tets) {
          const inside = tet.map((t) => box[t]).filter((p) => p.v <= 0),
            outside = tet.map((t) => box[t]).filter((p) => p.v > 0)
          if (!inside.length || !outside.length) continue
          let ps
          if (inside.length === 2) {
            const [a, c] = inside,
              [e, f] = outside
            ps = [intersect(a, e), intersect(a, f), intersect(c, f), intersect(c, e)]
          } else {
            const single = inside.length === 1 ? inside : outside,
              many = inside.length === 1 ? outside : inside
            ps = many.map((d) => intersect(single[0], d))
          }
          const ns = ps.map(([a, c, d]) =>
            new T.Vector3(
              field(a + 0.003, c, d) - field(a - 0.003, c, d),
              field(a, c + 0.003, d) - field(a, c - 0.003, d),
              field(a, c, d + 0.003) - field(a, c, d - 0.003)
            ).normalize()
          )
          const v = ps.map((p) => new T.Vector3(...p)),
            face = new T.Vector3().subVectors(v[1], v[0]).cross(new T.Vector3().subVectors(v[2], v[0]))
          if (face.dot(ns[0]) < 0) {
            ps.reverse()
            ns.reverse()
          }
          const pts = ps.map(([a, c, d]) => [x + a * height, 0.4 + c * height, z + d * height])
          const tint = 0.79 + 0.16 * Math.sin(ps[0][1] * 19 + ps[0][0] * 7)
          b.face(
            m.gardenLimestone,
            pts,
            [tint * 0.83, tint, tint * 0.99],
            null,
            ns.map((n) => n.toArray())
          )
        }
      }
}
function pavilion(b, m, world) {
  b.at(7.43, 0.48, 0.1, 0, () => {
    b.box(m.stone, 0, 0.155, 0, 5.38, 0.31, 3.72)
    b.box(m.wood, 0, 0.34, 0, 5.24, 0.12, 3.67)
    for (const x of [-2.4, 0, 2.4])
      for (const z of [-1.49, 1.49]) {
        b.tube(m.coping, [x, 0.39, z], [x, 0.58, z], 0.168, 0.143, 8)
        b.tube(m.timber, [x, 0.58, z], [x, 3.17, z], 0.12, 0.105, 10)
        for (const s of [-1, 1]) b.beam(m.patina, [x, 2.71, z], [x + s * 0.34, 3.02, z], 0.074, 0.087)
      }
    for (const z of [-1.49, 1.49]) b.box(m.wood, 0, 3.13, z, 5.15, 0.21, 0.19)
    roof(b, m, 0, 3.29, 0, 6.12, 4.42, 1.27)
    for (const x of [-1.22, 1.22]) windowBay(b, m, x, 1.81, 1.49, 2.26, 1.74, 'plain')
    b.box(m.darkwood, -0.6, 0.89, 0.49, 2.54, 0.12, 0.59)
    for (const x of [-1.59, 0.39]) b.box(m.wood, x, 0.65, 0.49, 0.19, 0.46, 0.39)
    b.box(m.teal, -0.57, 1.015, 0.49, 1.59, 0.13, 0.33)
    for (let i = 0; i < 7; i++)
      b.beam(m.gold, [-1.29, 1.096, 0.37 + i * 0.042], [0.17, 1.096, 0.37 + i * 0.042], 0.009, 0.009)
    for (const x of [-1.96, 1.96]) {
      b.tube(m.bronze, [x, 3.03, -1.37], [x, 2.79, -1.37], 0.024, 0.02, 6)
      lantern(b, m, x, 2.46, -1.37, 0.235, 0.63)
      world.lamp(...b.point([x, 2.42, -1.37]), 0xffa862, 15, 8)
    }
  })
}
function plum(b, m, world) {
  const rng = generator(75752),
    tips = []
  function limb(a, c, r, q) {
    const mid = [
      (a[0] + c[0]) * 0.5 + 0.16 * (rng() - 0.5),
      (a[1] + c[1]) * 0.5 - 0.09,
      (a[2] + c[2]) * 0.5 + 0.15 * (rng() - 0.5),
    ]
    b.tube(m.bark, a, mid, r, r * 0.68, 9, 0.85)
    b.tube(m.bark, mid, c, r * 0.69, q, 8, 1.04)
  }
  const foot = [-8.42, 0.47, 1.25],
    knee = [-8.82, 1.37, 1.48],
    fork = [-8.47, 2.11, 1.28]
  limb(foot, knee, 0.225, 0.175)
  limb(knee, fork, 0.18, 0.13)
  for (let i = 0; i < 6; i++) {
    const a = (i * tau) / 6 + 0.51
    const branch = [
      fork[0] + Math.cos(a) * (1.0 + rng() * 0.72),
      2.55 + rng() * 0.76,
      Math.min(2.66, Math.max(-0.52, fork[2] + Math.sin(a) * 1.02)),
    ]
    limb(fork, branch, 0.102, 0.051)
    for (let j = 0; j < 4; j++) {
      const angle = a + 1.53 * (rng() - 0.5),
        end = [
          branch[0] + Math.cos(angle) * (0.51 + 0.45 * rng()),
          branch[1] + 0.32 + rng() * 0.81,
          Math.min(2.8, Math.max(-0.75, branch[2] + Math.sin(angle) * 0.53)),
        ]
      limb(branch, end, 0.043, 0.01)
      const split = [(branch[0] + end[0]) * 0.5, (branch[1] + end[1]) * 0.5, (branch[2] + end[2]) * 0.5]
      const spur = [
        split[0] + 0.41 * Math.sin(angle + 0.65),
        split[1] + 0.3,
        split[2] + 0.3 * Math.cos(angle),
      ]
      limb(split, spur, 0.018, 0.005)
      tips.push([split, end], [split, spur])
    }
  }
  for (const [a, c] of tips)
    for (let i = 0; i < 5; i++) {
      const u = 0.15 + 0.84 * rng(),
        x = a[0] + (c[0] - a[0]) * u,
        y = a[1] + (c[1] - a[1]) * u,
        z = a[2] + (c[2] - a[2]) * u
      for (let j = 0; j < 3; j++) {
        const hue = j ? m.plumRose : m.plumBlush,
          phi = rng() * tau,
          xx = x + 0.045 * Math.cos(phi),
          yy = y + rng() * 0.045,
          zz = z + 0.045 * Math.sin(phi)
        for (let k = 0; k < 5; k++) {
          const angle = (k * tau) / 5 + phi,
            a = [xx, yy, zz],
            edge = (v) => [
              xx + 0.069 * Math.cos(v),
              yy + 0.039 + 0.011 * Math.cos(phi + v),
              zz + 0.069 * Math.sin(v),
            ]
          b.face(hue, [a, edge(angle - 0.5), edge(angle), edge(angle + 0.5)], 0.81 + 0.27 * rng())
        }
      }
    }
  for (const [x, y, z] of [
    [-7.65, 2.96, 1.69],
    [-9.81, 3.1, 1.72],
  ]) {
    b.tube(m.rope, [x, y, z], [x, y - 0.31, z], 0.014, 0.013, 6)
    lantern(b, m, x, y - 0.53, z, 0.16, 0.39)
    world.lamp(...b.point([x, y - 0.53, z]), 0xffb977, 13, 6.9)
  }
}
export function garden(b, m, world) {
  m.plumRose = m.leaf.clone()
  m.plumRose.name = '胭脂花瓣'
  m.plumRose.color.set(0xb64d58)
  m.plumRose.userData.noCollision = true
  m.plumBlush = m.plumRose.clone()
  m.plumBlush.name = '浅绯花瓣'
  m.plumBlush.color.set(0xedb9ac)
  m.gardenWater = m.ceramic.clone()
  m.gardenWater.name = '小院水位'
  m.gardenWater.userData.collisionOnly = true
  m.gardenLimestone = m.foundation.clone()
  m.gardenLimestone.name = '园中湖石'
  m.gardenLimestone.color.set(0x8ba7a5)
  m.gardenLimestone.roughness = 0.55
  b.at(X, Y, Z, 0, () => {
    top(b, m.quayPaving || m.stone, rectangle, [oval], 0.48, [0.42, 0.39, 0.345])
    top(b, m.gardenWater, oval, [], 0.262)
    for (const [i, pt] of rectangle.entries()) {
      const end = rectangle[(i + 1) % 4]
      b.face(
        m.foundation,
        [
          [pt[0], 0, pt[1]],
          [end[0], 0, end[1]],
          [end[0], 0.48, end[1]],
          [pt[0], 0.48, pt[1]],
        ],
        0.88
      )
    }
    for (const [i, p] of oval.entries()) {
      const q = oval[(i + 1) % oval.length],
        v = (a) => [-2.85 + (a[0] + 2.85) * 1.043, 0.02 + (a[1] - 0.02) * 1.075]
      const c = v(p),
        d = v(q)
      b.face(
        m.coping,
        [
          [p[0], 0.482, p[1]],
          [q[0], 0.482, q[1]],
          [d[0], 0.497, d[1]],
          [c[0], 0.497, c[1]],
        ],
        0.96
      )
      b.face(
        m.foundation,
        [
          [p[0], 0.07, p[1]],
          [q[0], 0.07, q[1]],
          [q[0], 0.48, q[1]],
          [p[0], 0.48, p[1]],
        ],
        0.74
      )
    }
    moonWall(b, m)
    tiledWall(b, m, -12.4, -0.1, 6.36, 1.35, Math.PI / 2)
    tiledWall(b, m, -3.7, 3.08, 16.8, 1.06)
    for (const [x, z, h, s] of [
      [-10.1, 0.42, 2.26, 18],
      [1.2, 1.73, 1.46, 39],
    ])
      rock(b, m, x, z, h, s)
    pavilion(b, m, world)
    plum(b, m, world)
    for (let i = 0; i < 3; i++)
      b.box(
        m.coping,
        -5.1,
        0.47 - (i + 1) * 0.145,
        -3.53 - (i + 0.5) * 0.27,
        2.09,
        0.15,
        0.29,
        0.92 + i * 0.03
      )
    for (const p of [
      [-7.2, 0.17],
      [-6.2, 0.52],
      [-5.4, 0.95],
    ])
      b.tube(m.stone, [p[0], 0.09, p[1]], [p[0], 0.51, p[1]], 0.34, 0.38, 7)
  })
}
export function gardenBasin() {
  const g = new T.BufferGeometry(),
    pos = oval.map(([x, z]) => [x, -z, 0]).flat(),
    vertices = oval.map((p) => new T.Vector2(...p))
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
  const indices = T.ShapeUtils.triangulateShape(vertices, []).flat()
  for (let i = 0; i < indices.length; i += 3) {
    const t = indices[i]
    indices[i] = indices[i + 2]
    indices[i + 2] = t
  }
  g.setIndex(indices)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return { geometry: g, point: [X, Y + 0.262, Z], small: true }
}
