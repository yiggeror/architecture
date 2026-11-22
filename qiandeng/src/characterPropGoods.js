import {
  colors as c,
  pigment,
  piece,
  rod,
  box,
  face,
  stroke,
  ring,
  oval,
  hamper,
  tau,
} from './characterPropCraft.js'

export function parasol(m) {
  return piece('梅枝双燕油纸伞', (b) => {
    const ribs = 20, radius = .505, sector = tau / ribs
    // Each sheet is tensioned between two bamboo tips. The binding follows
    // the scallop and carries the thickness at the silhouette in side light.
    function canopy(angle, r) {
      const flute = .5 - .5 * Math.cos(ribs * angle)
      const dist = radius * r * (1 - .018 * flute * r ** 5)
      const sag = flute * (.0105 * r ** 1.45 + .006 * r ** 6)
      return [Math.cos(angle) * dist, .900 - .171 * r ** 1.68 - sag, Math.sin(angle) * dist]
    }
    function surfaceNormal(a, r) {
      const k = Math.max(.012, r), dr = .001, da = .001
      const u = canopy(a, k - dr), v = canopy(a, k + dr)
      const w = canopy(a - da, k), q = canopy(a + da, k)
      const rx = v[0] - u[0], ry = v[1] - u[1], rz = v[2] - u[2]
      const tx = q[0] - w[0], ty = q[1] - w[1], tz = q[2] - w[2]
      const n = [ty * rz - tz * ry, tz * rx - tx * rz, tx * ry - ty * rx]
      const length = Math.hypot(...n)
      return n.map(x => x / length)
    }
    const levels = [0, .095, .22, .39, .58, .76, .91, .984, 1]
    for (let i = 0; i < ribs * 5; i++) {
      const a = sector * i / 5, e = sector * (i + 1) / 5
      for (let j = 1; j < levels.length; j++) {
        const lo = levels[j - 1], hi = levels[j]
        const uv = lo === 0 ? [[a, 0], [e, hi], [a, hi]] : [[a, lo], [e, lo], [e, hi], [a, hi]]
        const positions = uv.map(([theta, radius]) => canopy(theta, radius))
        const normals = uv.map(([theta, radius]) => surfaceNormal(theta, radius))
        const tex = positions.map(([x, , z]) => [.5 + .497 * x / radius, .5 + .497 * z / radius])
        b.face(m.parasol, positions, 1, tex, normals)
        b.face(m.lining, positions.slice().reverse().map(([x,y,z]) => [x, y - .0024, z]), 1,
          tex.slice().reverse(), normals.slice().reverse().map(n => n.map(v => -v)))
      }
      const p = canopy(a, 1), q = canopy(e, 1)
      const hem = [p, q].map(([x,y,z]) => [x, y - .0031, z])
      face(b, m.matte, 0x956957, [p, q, hem[1], hem[0]])
    }
    rod(b, m.matte, c.wood, [0, -0.147, 0], [0, 0.906, 0], 0.0118, 0.0083, 14)
    rod(b, m.matte, c.red, [0, -0.155, 0], [0, -0.108, 0], 0.013, 0.013, 12)
    rod(b, m.metal, c.gold, [0, -0.116, 0], [0, -0.107, 0], 0.014, 0.014, 12)
    for (const [h, r] of [
      [0.606, 0.027],
      [0.872, 0.029],
      [0.9, 0.035],
    ])
      rod(b, m.matte, c.honey, [0, h - 0.008, 0], [0, h + 0.008, 0], r, r * 0.89, 12)
    for (let i = 0; i < ribs; i++) {
      const a = (tau * i) / ribs,
        pts = [0.02, 0.23, 0.47, 0.72, 1.004].map((r) => {
          const p = canopy(a, r)
          p[1] -= 0.005
          return p
        })
      stroke(b, m.matte, c.honey, pts, 0.0037, 5)
      const hinge = canopy(a, 0.49)
      hinge[1] -= 0.012
      rod(b, m.matte, c.reed, [0.013 * Math.cos(a), 0.609, 0.013 * Math.sin(a)], hinge, 0.0038, 0.0029, 6)
      const next = a + sector
      // Three continuous passes of silk lace link the hub and the stretchers.
      const lace = (theta, r, drop) => {
        const p = canopy(theta, r)
        return [p[0], p[1] - drop, p[2]]
      }
      for (const [r, height, color] of [[.31,.099,0x896448], [.37,.083,0xb07b57], [.43,.052,0x71857a]]) {
        stroke(b, m.matte, color, [lace(a,r,height), lace(a+sector*.5,r-.022,height+.003), lace(next,r,height)], .00125, 5)
      }
      const tip = canopy(a, 1.012)
      rod(b, m.matte, c.wood, pts.at(-1), [tip[0], tip[1] - 0.014, tip[2]], 0.0048, 0.0033, 6)
    }
    oval(b, m.metal, c.gold, [0, 0.914, 0], [0.018, 0.026, 0.018], 10, 6)
    const loop = []
    for (let k = 0; k <= 15; k++) {
      const a = (tau * k) / 15
      loop.push([0.006 + 0.014 * Math.sin(a), -0.184 + 0.039 * Math.cos(a), 0.005 * Math.sin(a * 2)])
    }
    stroke(b, m.matte, c.red, loop, 0.0026)
    for (let i = 0; i < 11; i++) {
      const t = i / 11, a = tau * t
      const knot = k => [.0129 * Math.cos(k), -.145 + .0038 * (i + (k - a) / tau), .0129 * Math.sin(k)]
      stroke(b, m.matte, i % 3 ? 0x8f3931 : 0xc47d55, [knot(a), knot(a + .9 * Math.PI), knot(a + tau)], .0017, 5)
    }
    oval(b, m.metal, c.darkGold, [.005, -.221, 0], [.0048, .0051, .0048])
    oval(b, m.matte, 0x658c7e, [.005, -.230, 0], [.0065, .008, .0065])
    for (let i = 0; i < 9; i++) {
      const a = tau * i / 9
      stroke(b, m.matte, i % 3 ? c.red : 0xc67760,
        [[.005, -.237, 0], [.006 + .0035*Math.cos(a), -.25, .0035*Math.sin(a)],
         [.008 + .006*Math.cos(a), -.275 + .003*Math.sin(3*a), .006*Math.sin(a)]], .0014, 5)
    }
  })
}
export function lanternPiece(m, watch) {
  return piece(watch ? '八棱更灯' : '海棠绢灯', (b) => {
    // The crown of the bail is straight enough for four closed fingers.
    rod(b, m.matte, c.wood, [-0.043, 0, 0], [0.043, 0, 0], 0.0105, 0.0105, 12)
    for (const s of [-1, 1]) {
      stroke(
        b,
        m.metal,
        c.darkGold,
        [
          [s * 0.032, 0, 0],
          [s * 0.059, -0.01, 0],
          [s * 0.078, -0.047, 0],
          [s * 0.086, -0.097, 0],
          [s * 0.069, -0.14, 0],
        ],
        0.0056,
        7,
      )
      oval(b, m.metal, c.gold, [s * 0.07, -0.141, 0], [0.01, 0.009, 0.01], 8, 4)
    }
    const profile = watch
      ? [
          [-0.143, 0.068],
          [-0.165, 0.091],
          [-0.21, 0.108],
          [-0.33, 0.102],
          [-0.376, 0.08],
          [-0.388, 0.064],
        ]
      : [
          [-0.145, 0.055],
          [-0.172, 0.088],
          [-0.216, 0.12],
          [-0.27, 0.132],
          [-0.318, 0.123],
          [-0.356, 0.1],
          [-0.385, 0.057],
        ]
    const n = watch ? 8 : 12,
      pt = (rad, y, i, k = 1) => [rad * k * Math.cos((tau * i) / n), y, rad * k * Math.sin((tau * i) / n)]
    for (let j = 1; j < profile.length; j++)
      for (let i = 0; i < n; i++) {
        const [ya, ra] = profile[j - 1],
          [yb, rb] = profile[j]
        for (let f = 0; f < 2; f++) {
          const k = i + f / 2,
            kk = k + 0.5,
            bulge = f === 0 ? 1 : 0.992
          const col = watch ? (i % 3 ? 0xe99b61 : 0xeac381) : [0xeeb580, 0xe7a96e, 0xf0c58f, 0xeb996c][i % 4]
          b.face(
            m.glow,
            [
              pt(ra, ya, k, bulge),
              pt(ra, ya, kk, 2 - bulge),
              pt(rb, yb, kk, 2 - bulge),
              pt(rb, yb, k, bulge),
            ],
            pigment(col),
          )
        }
        if (j === 1)
          stroke(
            b,
            m.matte,
            watch ? c.ink : c.red,
            profile.map(([y, r]) => pt(r + 0.001, y, i)),
            watch ? 0.0047 : 0.0032,
            6,
          )
      }
    for (const j of [0, profile.length - 1]) {
      const [y, r] = profile[j]
      rod(b, m.matte, c.ink, [0, y - 0.007, 0], [0, y + 0.007, 0], r + 0.009, r + 0.009, n)
      ring(b, m.metal, c.gold, 0, y + 0.002, 0, r + 0.011, r + 0.011, 0.0036, n)
    }
    for (let i = 0; i < n; i += 2) {
      const a = (tau * (i + 0.5)) / n,
        x = Math.cos(a),
        z = Math.sin(a),
        r = watch ? 0.106 : 0.13,
        mid = -0.265
      const design = (h, w) => [x * r - z * w, mid + h, z * r + x * w]
      stroke(
        b,
        m.matte,
        c.red,
        [design(-0.025, 0), design(0, -0.015), design(0.025, 0), design(0, 0.015), design(-0.025, 0)],
        0.0023,
      )
    }
    rod(b, m.metal, c.gold, [0, -0.388, 0], [0, -0.41, 0], 0.017, 0.01, 9)
    rod(b, m.matte, c.red, [0, -0.406, 0], [0, -0.441, 0], 0.0037, 0.0042, 7)
    for (let i = 0; i < 12; i++) {
      const a = (tau * i) / 12
      rod(
        b,
        m.matte,
        i % 3 ? c.red : 0xc77556,
        [0.006 * Math.cos(a), -0.44, 0.006 * Math.sin(a)],
        [0.017 * Math.cos(a), -0.528 + 0.009 * Math.sin(3 * a), 0.018 * Math.sin(a)],
        0.0023,
        0.0015,
        5,
      )
    }
  })
}
export function clapper(m) {
  return piece('梆鼓木犍', (b) => {
    rod(b, m.matte, c.wood, [0, -0.06, 0], [0, 0.23, 0], 0.009, 0.012, 12)
    rod(b, m.matte, c.ink, [0, -0.069, 0], [0, -0.052, 0], 0.012, 0.011, 10)
    oval(b, m.matte, 0x79523a, [0, 0.231, 0], [0.022, 0.049, 0.023], 12, 8)
    for (const h of [0.17, 0.185]) rod(b, m.metal, c.gold, [0, h, 0], [0, h + 0.005, 0], 0.012, 0.012, 10)
  })
}
export function marketBasket(m) {
  return piece('朱绳缠梁的果篮', (b) => {
    hamper(b, m, c.reed, 0, -0.337, 0, 0.151, 0.123, 0.168)
    rod(b, m.matte, c.honey, [-0.046, 0, 0], [0.046, 0, 0], 0.0104, 0.0104, 12)
    for (const s of [-1, 1]) {
      const p = [
        [s * 0.041, 0, 0],
        [s * 0.079, -0.018, 0],
        [s * 0.113, -0.052, 0],
        [s * 0.139, -0.11, 0],
        [s * 0.149, -0.18, 0],
      ]
      stroke(b, m.matte, c.reed, p, 0.0075, 8)
      stroke(
        b,
        m.matte,
        c.red,
        [
          [s * 0.149, -0.18, -0.019],
          [s * 0.152, -0.166, -0.012],
          [s * 0.149, -0.183, 0],
          [s * 0.152, -0.168, 0.012],
          [s * 0.148, -0.182, 0.021],
        ],
        0.0034,
        5,
      )
    }
  })
}
export function carryingCrate(m) {
  return piece('双耳榫接篾筐', (b) => {
    const hw = 0.187,
      hd = 0.119,
      h = 0.215,
      top = -0.046,
      base = top - h
    box(b, m.matte, c.wood, [0, base + 0.009, 0], [2 * hw, 0.019, 2 * hd])
    box(b, m.matte, c.reed, [0, top - 0.103, 0], [2 * hw - 0.012, h - 0.021, 2 * hd - 0.009])
    for (let j = 0; j < 11; j++)
      for (const s of [-1, 1]) {
        const y = base + 0.017 + j * 0.017
        box(b, m.matte, j % 2 ? c.rope : c.reed, [0, y, s * hd], [2 * hw, 0.0084, 0.0055])
        box(b, m.matte, j % 2 ? c.reed : c.rope, [s * hw, y, 0], [0.0055, 0.0082, 2 * hd])
      }
    for (const s of [-1, 1])
      for (const end of [-1, 1]) {
        box(b, m.matte, c.honey, [s * hw, base + h / 2, end * hd], [0.015, h + 0.015, 0.016])
        for (const t of [-0.54, -0.19, 0.22, 0.57])
          box(b, m.matte, c.reed, [t * hw, base + h / 2, end * (hd + 0.003)], [0.007, h, 0.004])
      }
    for (const end of [-1, 1]) {
      box(b, m.matte, c.wood, [0, top, end * hd], [2 * hw + 0.012, 0.013, 0.016])
      box(b, m.matte, c.wood, [end * hw, top, 0], [0.014, 0.013, 2 * hd])
      const x = end * 0.207
      stroke(
        b,
        m.matte,
        c.honey,
        [
          [end * hw, top - 0.02, -0.077],
          [x, -0.02, -0.067],
          [x, 0, -0.039],
          [x, 0, 0.039],
          [x, -0.02, 0.067],
          [end * hw, top - 0.02, 0.077],
        ],
        0.01,
        8,
      )
    }
    for (const x of [-0.097, 0.084]) {
      box(b, m.matte, x < 0 ? 0xb88e62 : 0xb2a677, [x, top - 0.018, 0], [0.14, 0.066, 0.176])
      box(b, m.matte, c.ink, [x, top + 0.016, 0], [0.015, 0.004, 0.177])
      box(b, m.matte, c.rope, [x, top + 0.016, -0.025], [0.142, 0.004, 0.008])
    }
  })
}
export function yoke(m) {
  return piece('挑货软扁担', (b) => {
    const path = []
    for (let i = 0; i <= 18; i++) {
      const z = -0.62 + (1.24 * i) / 18
      path.push([0, -0.005 - 0.099 * (Math.abs(z) / 0.62) ** 1.67, z])
    }
    for (let i = 1; i < path.length; i++)
      b.beam(m.matte, path[i - 1], path[i], 0.034, 0.022, pigment(c.honey))
    for (const z of [-0.588, -0.545, 0.545, 0.588]) {
      const h = -0.005 - 0.099 * (Math.abs(z) / 0.62) ** 1.67
      box(b, m.matte, c.ink, [0, h, z], [0.038, 0.022, 0.012])
    }
    box(b, m.matte, 0x70694b, [0, -0.021, 0], [0.057, 0.035, 0.2])
  })
}
export function loadBasket(m, s) {
  return piece('挑担箩筐', (b) => {
    for (const d of [-1, 1])
      for (const e of [-1, 1])
        stroke(
          b,
          m.matte,
          c.rope,
          [
            [0, 0, 0],
            [d * 0.042, -0.11, e * 0.045],
            [d * 0.114, -0.364, e * 0.088],
          ],
          0.0036,
        )
    hamper(b, m, s > 0 ? c.reed : 0xc4a16a, 0, -0.552, 0, 0.141, 0.119, 0.188)
  })
}
export function travelTag(m) {
  return piece('行旅竹符', (b) => {
    stroke(
      b,
      m.matte,
      c.red,
      [
        [0, 0, 0],
        [0.01, -0.024, 0.004],
        [-0.004, -0.045, 0],
      ],
      0.0026,
    )
    box(b, m.matte, c.honey, [-0.003, -0.074, 0.001], [0.029, 0.061, 0.008])
    for (let j = 0; j < 3; j++) {
      const y = -0.058 - j * 0.015
      box(b, m.matte, c.ink, [-0.005, y, 0.006], [0.012, 0.002, 0.001])
      box(b, m.matte, c.ink, [-0.004, y - 0.002, 0.006], [0.002, 0.01, 0.001])
    }
    oval(b, m.matte, c.teal, [0.009, -0.1, 0.002], [0.008, 0.011, 0.007], 8, 5)
  })
}
