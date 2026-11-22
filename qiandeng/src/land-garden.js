import * as T from 'three'
import { cross, generator, sub, unit } from './mesh.js'
import { LandBatch, blend, limit, mix, noise, panel, rgb, smooth, tau, tint, top } from './land-kit.js'

const pine = [0x294b4c, 0x3a6057, 0x4d7160, 0x5d8069, 0x41605a].map(rgb)
const trunk = rgb(0x695a50),
  silver = rgb(0x8da084),
  young = rgb(0x788e5e)
const blossom = [0xbc7366, 0xb7908c, 0xcaafa1, 0x9f5360, 0x9f6b56].map(rgb)
const moss = rgb(0x748660),
  chalk = rgb(0xa4a596),
  slate = rgb(0x767f7d)
function needleSpray(b, m, base, yaw, len, span, rise, tilt, color) {
  const dx = Math.cos(yaw),
    dz = Math.sin(yaw),
    c = Math.cos(tilt),
    s = Math.sin(tilt)
  const at = (t, side) => {
    const w = span * side
    return [
      base[0] + dx * len * t - dz * w * c,
      base[1] + rise * t + w * s,
      base[2] + dz * len * t + dx * w * c,
    ]
  }
  b.face(m.pineBrush, [at(0, -1), at(1, -1), at(1, 1), at(0, 1)], color, [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ])
}
function cushion(b, m, rng, x, y, z, w, d, h, c, detail) {
  const n = detail ? 9 : 6,
    low = [],
    shoulder = [],
    ridge = []
  const yaw = rng() * tau,
    co = Math.cos(yaw),
    si = Math.sin(yaw)
  for (let j = 0; j < n; j++) {
    const a = (tau * (j + 0.2 * (rng() - 0.5))) / n
    const r = 0.75 + 0.31 * rng(),
      u = w * r * Math.cos(a),
      v = d * r * Math.sin(a)
    const dx = co * u + si * v,
      dz = -si * u + co * v
    low.push([x + 0.78 * dx, y + h * (-0.35 + 0.26 * rng()), z + 0.78 * dz])
    shoulder.push([x + dx, y + h * (0.04 + 0.51 * rng()), z + dz])
    ridge.push([x + 0.49 * dx, y + h * (0.74 + 0.33 * rng()), z + 0.49 * dz])
  }
  const apex = [x + w * 0.06, y + 1.03 * h, z + 0.05 * d],
    bottom = [x, y - 0.31 * h, z]
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n
    b.face(m.pineCrown, [low[j], low[k], shoulder[k], shoulder[j]], tint(c, 0.79 + 0.13 * rng()))
    if (detail) {
      b.face(m.pineCrown, [shoulder[j], shoulder[k], ridge[k], ridge[j]], tint(c, 1 + 0.1 * rng()))
      top(b, m.pineCrown, [ridge[j], ridge[k], apex], blend(c, silver, 0.16 + 0.17 * rng()))
    } else top(b, m.pineCrown, [shoulder[j], shoulder[k], apex], blend(c, silver, 0.13 + 0.15 * rng()))
    b.face(m.pineCrown, [low[k], low[j], bottom], tint(c, 0.71))
    if (detail && j % 2 === 0) {
      const p = shoulder[j],
        dx = p[0] - x,
        dz = p[2] - z
      b.face(
        m.pineCrown,
        [p, [p[0] + dx * 0.23, p[1] - 0.36 * h, p[2] + dz * 0.23], shoulder[k]],
        tint(c, 0.9)
      )
    }
    if (detail && j % 2 === 1) {
      const p = shoulder[j],
        dx = p[0] - x,
        dz = p[2] - z,
        len = Math.hypot(dx, dz)
      needleSpray(
        b,
        m,
        [x + 0.38 * dx, y + 0.26 * h, z + 0.38 * dz],
        Math.atan2(dz, dx),
        len * 0.91,
        w * 0.31,
        -0.06 * h,
        0.39 + (j % 3) * 0.37,
        [0.89, 1, 0.86]
      )
    }
  }
}
function pineTree(b, m, rng, x, y, z, h, angle, detail = true) {
  const radius = h * (detail ? 0.037 : 0.03),
    dir = [Math.cos(angle), Math.sin(angle)],
    nodes = []
  for (let i = 0; i < 6; i++) {
    const f = i / 5,
      k = h * (0.19 * f * f + 0.048 * Math.sin(f * 4.6))
    nodes.push([x + dir[0] * k, y + h * f, z + dir[1] * k])
    if (i)
      b.tube(
        m.mountainBark,
        nodes[i - 1],
        nodes[i],
        radius * (1 - (i - 1) * 0.156),
        radius * (1 - i * 0.156),
        detail ? 7 : 4,
        trunk,
        false
      )
  }
  for (let j = 0; j < (detail ? 9 : 5); j++) {
    const f = 0.31 + (0.62 * j) / (detail ? 9 : 5),
      q = f * 5,
      idx = Math.min(4, Math.floor(q)),
      t = q - idx
    const p = nodes[idx].map((v, i) => mix(v, nodes[idx + 1][i], t))
    const yaw = angle + (j % 2 ? 1 : -1) * (1.19 + 0.52 * rng()) + 0.52 * Math.sin(j * 2.8)
    const spread = h * ((1 - f) * (0.41 + 0.23 * rng()) + 0.045)
    const dx = Math.cos(yaw) * spread,
      dz = Math.sin(yaw) * spread
    const elbow = [p[0] + dx * 0.58, p[1] + h * (0.028 + 0.037 * rng()), p[2] + dz * 0.58]
    const end = [p[0] + dx, p[1] + h * (0.098 + 0.061 * rng()), p[2] + dz]
    if (detail) {
      b.tube(m.mountainBark, p, elbow, radius * (0.51 - 0.29 * f), radius * 0.14, 5, trunk, false)
      b.tube(m.mountainBark, elbow, end, radius * 0.15, radius * 0.055, 4, trunk, false)
    }
    const w = h * (0.1 + 0.098 * (1 - f)) * (0.8 + 0.22 * rng())
    const c = pine[Math.floor(rng() * pine.length)]
    cushion(b, m, rng, ...end, w, w * (0.55 + 0.28 * rng()), w * 0.43, c, detail)
    if (detail && j % 3 === 0)
      cushion(
        b,
        m,
        rng,
        end[0] - 0.15 * dx,
        end[1] + w * 0.22,
        end[2] - 0.15 * dz,
        w * 0.73,
        w * 0.53,
        w * 0.32,
        c,
        false
      )
  }
  cushion(b, m, rng, ...nodes[5], h * 0.13, h * 0.105, h * 0.075, pine[2], detail)
}

function pondPines(b, m) {
  const soil = b.scene.children.find((mesh) => mesh.userData.terrainHull && mesh.material === m.upperGardens)
  const ray = new T.Raycaster(new T.Vector3(), new T.Vector3(0, -1, 0))
  function ground(x, z) {
    ray.ray.origin.set(x, 40, z)
    return ray.intersectObject(soil, false)[0].point.y
  }
  const pinewood = blend(trunk, chalk, 0.18),
    twigwood = rgb(0x897958)
  function shoot(root, angle, run, lift) {
    return [root[0] + Math.cos(angle) * run, root[1] + lift, root[2] + Math.sin(angle) * run]
  }
  // The outer bundle splays in three planes. Each spray grows from the
  // fork, leaving an open window between this bough and the one above it.
  function needles(root, angle, length, rng) {
    for (let j = -1; j <= 1; j++) {
      const az = angle + j * (0.49 + 0.14 * rng())
      const size = length * (j === 0 ? 1.09 : 0.74 + 0.19 * rng())
      needleSpray(
        b,
        m,
        root,
        az,
        size,
        size * (0.31 + 0.06 * rng()),
        size * (j === 0 ? 0.27 : 0.05 + 0.13 * rng()),
        j * (0.66 + 0.33 * rng()) + 0.21,
        [0.95 + 0.16 * rng(), 1.06 + 0.14 * rng(), 0.92 + 0.13 * rng()]
      )
    }
  }
  // The main trees keep their old places at the court and the outlook.
  // Low, spreading young pines replace the solid cushions on the bank.
  const stems = [
    [-46.9, 92.0, 6.62, -0.98],
    [-41.57, 91.57, 4.34, -0.42],
    [-47.11, 95.02, 4.7, 1.64],
    [-50.65, 91.17, 4.63, -2.33],
    [-45.06, 89.26, 1.18, -0.93],
    [-41.8, 91.49, 1.45, 2.75],
    [-41.95, 96.9, 1.83, 0.5],
    [-47.42, 97.83, 1.65, 1.6],
    [-51.98, 95.49, 1.63, 2.7],
  ]
  stems.forEach(([x, z, height, lean], id) => {
    const rng = generator(40621 + id * 313),
      floor = ground(x, z),
      small = height < 2,
      spread = small ? 1.57 : 1,
      width = height * (small ? 0.044 : 0.042),
      timber = tint(pinewood, 0.88 + 0.21 * rng())
    const local = (u, y, v) => [
      x + height * spread * (u * Math.cos(lean) - v * Math.sin(lean)),
      floor + height * y,
      z + height * spread * (u * Math.sin(lean) + v * Math.cos(lean)),
    ]
    const spine = [
      local(0, -0.063, 0),
      local(0.026, 0.16, 0.016),
      local(0.137, 0.34, 0.028),
      local(0.119, 0.57, 0.106),
      local(0.236, 0.73, 0.089),
      local(0.219, 0.91, 0.138),
      local(0.28, 1.0, 0.149),
    ]
    const girth = [1.28, 0.99, 0.83, 0.62, 0.43, 0.25, 0.075]
    for (let j = 0; j < spine.length - 1; j++)
      b.tube(
        m.mountainBark,
        spine[j],
        spine[j + 1],
        width * girth[j],
        width * girth[j + 1],
        small ? 5 : 7,
        timber,
        false
      )
    for (let j = 0; j < (small ? 2 : 4); j++) {
      const a = lean + 1.56 * j + 0.23 * rng(),
        foot = shoot([x, floor, z], a, height * (0.11 + 0.055 * rng()), 0)
      foot[1] = ground(foot[0], foot[2]) - 0.06
      b.tube(m.mountainBark, local(0.012, 0.049, 0.008), foot, width * 0.69, width * 0.075, 5, timber, false)
    }
    const branches = small ? 5 : 8
    for (let j = 0; j < branches; j++) {
      const f = j / branches,
        q = 1.5 + 3.98 * f,
        k = Math.floor(q),
        root = spine[k].map((v, i) => mix(v, spine[k + 1][i], q - k)),
        az = lean + 0.59 + j * 2.4 + (rng() - 0.5) * 0.54,
        run = spread * height * (0.4 - 0.19 * f) * (0.86 + 0.26 * rng()),
        inner = shoot(root, az, run * 0.38, height * (0.005 + 0.021 * rng())),
        outer = shoot(inner, az + 0.17, run * 0.41, height * 0.049),
        tip = shoot(outer, az - 0.16, run * 0.27, height * 0.073)
      b.tube(m.mountainBark, root, inner, width * (0.43 - f * 0.2), width * 0.24, 5, timber, false)
      b.tube(m.mountainBark, inner, outer, width * 0.25, width * 0.13, 4, pinewood, false)
      b.tube(m.mountainBark, outer, tip, width * 0.14, width * 0.043, 4, twigwood, false)
      const pair = small ? 2 : 4
      for (let n = 0; n < pair; n++) {
        const joint = n < 2 ? outer : inner,
          yaw = az + (n % 2 ? -1 : 1) * (0.61 + 0.43 * rng()),
          length = run * (0.34 + 0.16 * rng()),
          bud = shoot(joint, yaw, length * 0.61, length * (0.12 + 0.19 * rng()))
        b.tube(m.mountainBark, joint, bud, width * 0.13, width * 0.036, 4, twigwood, false)
        needles(bud, yaw, length, rng)
      }
      needles(tip, az, run * 0.44, rng)
    }
    for (let j = 0; j < 3; j++)
      needles(spine.at(-1), lean + (j * tau) / 3, height * (small ? 0.2 : 0.14), rng)
  })
}

function leaningPine(b, m, rng, x, y, z, scale, a) {
  const co = Math.cos(a),
    si = Math.sin(a)
  const p = (u, h, v) => [x + scale * (co * u + si * v), y + scale * h, z + scale * (-si * u + co * v)]
  const spine = [
    [0, -0.35, 0],
    [0.22, 1.02, 0.04],
    [1.62, 1.94, -0.1],
    [3.07, 2.36, -0.27],
    [4.09, 3.22, -0.16],
    [3.97, 4.03, 0.02],
    [4.56, 4.78, 0.08],
  ]
  for (let j = 1; j < spine.length; j++)
    b.tube(
      m.mountainBark,
      p(...spine[j - 1]),
      p(...spine[j]),
      scale * (0.3 - 0.037 * (j - 1)),
      scale * (0.3 - 0.037 * j),
      7,
      trunk,
      false
    )
  const limbs = [
    [2, 1.25, 2.6, 1.75, 0.95, 3.1, 3.0, 1.52],
    [2, 2.45, 2.32, -1.38, 3.23, 2.84, -2.12, 1.45],
    [3, 4.32, 2.78, 0.92, 5.31, 3.11, 1.56, 1.72],
    [4, 5.2, 3.39, -0.91, 6.49, 3.79, -1.4, 1.67],
    [4, 3.78, 3.63, 1.13, 3.21, 4.11, 1.94, 1.42],
    [5, 3.29, 4.46, -0.92, 2.8, 4.77, -1.2, 1.37],
    [5, 4.85, 4.33, 0.55, 5.43, 4.78, 0.74, 1.22],
  ]
  for (const [j, ux, uy, uz, vx, vy, vz, w] of limbs) {
    const q = p(ux, uy, uz),
      v = p(vx, vy, vz)
    b.tube(m.mountainBark, p(...spine[j]), q, 0.12 * scale, 0.075 * scale, 5, trunk, false)
    b.tube(m.mountainBark, q, v, 0.078 * scale, 0.036 * scale, 5, trunk, false)
    cushion(
      b,
      m,
      rng,
      ...v,
      w * scale,
      w * 0.72 * scale,
      w * 0.43 * scale,
      pine[Math.floor(rng() * pine.length)],
      true
    )
    const q2 = p(vx - 0.67, vy + 0.17, vz + 0.32)
    cushion(b, m, rng, ...q2, w * 0.72 * scale, w * 0.51 * scale, w * 0.31 * scale, pine[2], false)
  }
  cushion(b, m, rng, ...p(...spine.at(-1)), 1.3 * scale, 0.96 * scale, 0.63 * scale, pine[3], true)
}
function bamboo(b, m, rng, x, z, grade, h) {
  for (let c = 0; c < 9; c++) {
    const a = tau * rng(),
      off = 0.27 + 1.15 * rng(),
      px = x + off * Math.cos(a),
      pz = z + off * Math.sin(a)
    const y = grade(px, pz),
      hei = h * (0.64 + 0.47 * rng()),
      lean = hei * (0.13 + 0.14 * rng())
    const point = (t) => [px + lean * Math.cos(a) * t * t, y + hei * t, pz + lean * Math.sin(a) * t * t]
    for (let i = 0; i < 6; i++) {
      const f = i / 6,
        t = (i + 1) / 6,
        p = point(f),
        q = point(t),
        w = (1 - f * 0.72) * (0.049 + 0.013 * rng())
      b.tube(m.mountainBark, p, q, w, w * 0.89, 5, tint(young, 0.83 + 0.2 * rng()), false)
      if (i < 5) b.tube(m.mountainBark, q, [q[0], q[1] + 0.051, q[2]], w * 1.13, w * 1.12, 5, silver, false)
      if (i < 2) continue
      const side = a + (i % 2 ? 1 : -1) * (0.84 + 0.65 * rng()),
        len = hei * (0.12 + 0.09 * rng())
      const end = [q[0] + len * Math.cos(side), q[1] + len * 0.24, q[2] + len * Math.sin(side)]
      b.tube(m.mountainBark, q, end, 0.024, 0.008, 4, young, false)
      for (let j = 0; j < 7; j++) {
        const k = j / 7,
          v = q.map((n, i) => mix(n, end[i], k)),
          s = side + (j % 2 ? 1 : -1) * (0.42 + 0.6 * rng())
        const leaf = hei * (0.087 + 0.038 * rng()),
          dx = Math.cos(s),
          dz = Math.sin(s),
          w = leaf * 0.095
        b.face(
          m.pineCrown,
          [
            v,
            [v[0] + leaf * 0.38 * dx + w * dz, v[1] + leaf * 0.09, v[2] + leaf * 0.39 * dz - w * dx],
            [v[0] + leaf * dx, v[1] - leaf * 0.39, v[2] + leaf * dz],
            [v[0] + leaf * 0.42 * dx - w * dz, v[1] + leaf * 0.058, v[2] + leaf * 0.42 * dz + w * dx],
          ],
          blend(pine[2], young, 0.17 + 0.55 * rng())
        )
      }
    }
  }
}
function flowerBed(b, m, rng, x, z, grade, s) {
  for (let n = 0; n < 26; n++) {
    const a = tau * rng(),
      r = s * Math.sqrt(rng()),
      px = x + r * Math.cos(a),
      pz = z + r * 0.66 * Math.sin(a),
      y = grade(px, pz)
    const h = 0.29 + 0.55 * rng(),
      col = blossom[Math.floor(rng() * blossom.length)]
    for (let j = 0; j < 4; j++) {
      const yaw = a + j * 1.571,
        dx = h * 0.37 * Math.cos(yaw),
        dz = h * 0.37 * Math.sin(yaw)
      b.face(
        m.karstNeedle,
        [
          [px, y + 0.02, pz],
          [px + dx + dz * 0.25, y + 0.46 * h, pz + dz - dx * 0.25],
          [px + 1.5 * dx, y + h * 0.62, pz + 1.5 * dz],
          [px + dx - dz * 0.25, y + 0.4 * h, pz + dz + dx * 0.25],
        ],
        pine[2]
      )
      const p = [px + dx * 0.6, y + h, pz + dz * 0.6],
        rr = 0.087 + 0.078 * rng()
      b.face(
        m.pineCrown,
        [
          [p[0] - rr, p[1], p[2]],
          [p[0], p[1] + rr * 0.59, p[2] - rr * 0.68],
          [p[0] + rr, p[1], p[2]],
          [p[0], p[1] - 0.31 * rr, p[2] + rr * 0.77],
        ],
        col
      )
    }
  }
}
function stoneLantern(b, m, x, y, z, world, light) {
  const col = rgb(0x8c9790),
    p = [x, y, z]
  for (const [h, w, dy] of [
    [0.18, 0.85, 0.09],
    [0.13, 0.64, 0.245],
    [0.6, 0.31, 0.61],
    [0.15, 0.63, 0.98],
    [0.09, 0.78, 1.1],
  ])
    b.box(m.quayCoping, x, y + dy, z, w, h, w, col)
  b.box(m.lantern || m.quayCoping, x, y + 1.39, z, 0.4, 0.48, 0.4, 1)
  for (const dx of [-0.265, 0.265])
    for (const dz of [-0.265, 0.265]) b.box(m.quayCoping, x + dx, y + 1.41, z + dz, 0.071, 0.52, 0.071, col)
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * 0.5 * i + Math.PI * 0.25,
      c = a + Math.PI * 0.5
    const side = (t, r, h) => [x + Math.cos(t) * r, y + h, z + Math.sin(t) * r]
    b.face(
      m.quayCoping,
      [side(a, 0.77, 1.67), side(c, 0.77, 1.67), side(c, 0.25, 1.96), side(a, 0.25, 1.96)],
      slate
    )
  }
  b.tube(m.quayCoping, [x, y + 1.94, z], [x, y + 2.16, z], 0.16, 0.06, 6, col)
  if (light) world?.lamp?.(x, y + 1.42, z, 0xffb26a, 3.0, 5.8)
}
function hillsideWay(b, m, coords, grade, world, index) {
  const curve = new T.CatmullRomCurve3(coords.map(([x, z]) => new T.Vector3(x, 0, z)))
  const length = curve.getLength(),
    steps = Math.ceil(length / 0.45)
  function p(t, off) {
    const v = curve.getPointAt(t),
      a = curve.getTangentAt(t)
    return [v.x - a.z * off, v.z + a.x * off]
  }
  const w = 1.04,
    shade = [0x949b94, 0x9ca395, 0x858d88, 0xa39f91].map(rgb)
  let lastY = 0
  for (let k = 0; k < steps; k++) {
    const a = k / steps,
      c = (k + 1) / steps,
      points = [p(a, -w), p(a, w), p(c, w), p(c, -w)]
    const high = Math.max(...points.map(([x, z]) => grade(x, z))) + 0.1
    const slab = points.map(([x, z]) => [x, high, z])
    top(b, m.quayCoping, slab, shade[k % 4])
    for (let j = 0; j < 4; j++) {
      const l = (j + 1) % 4,
        px = slab[j],
        q = slab[l]
      b.face(
        m.quayCoping,
        [
          [px[0], Math.min(high - 0.22, lastY || high) - 0.12, px[2]],
          [q[0], Math.min(high - 0.22, lastY || high) - 0.12, q[2]],
          q,
          px,
        ],
        tint(shade[k % 4], 0.82)
      )
    }
    if (k % 13 === 7) {
      const q = p(c, 1.22),
        base = grade(...q)
      b.box(m.quayCoping, q[0], base + 0.28, q[1], 0.22, 0.68, 0.22, slate)
    }
    lastY = high
  }
  const end = p(1, 0),
    ex = end[0],
    ez = end[1],
    level = lastY + 0.14
  b.box(m.quayCoping, ex, level - 0.16, ez, 5.15, 0.34, 3.57, slate)
  for (const dx of [-2.21, 0, 2.21])
    for (const dz of [-1.49, 1.49]) {
      const low = grade(ex + dx, ez + dz) - 0.23
      if (level > low)
        b.box(m.quayCoping, ex + dx, (level + low) * 0.5, ez + dz, 0.33, level - low, 0.36, slate)
    }
  for (const edge of [-1, 1]) {
    const dir = Math.sign(ex)
    const q = [ex + dir * 2.33, level, ez + edge * 1.55],
      c = [ex - dir * 0.77, level, ez + edge * 1.55]
    for (const t of [0, 0.5, 1]) {
      const v = [mix(q[0], c[0], t), level, mix(q[2], c[2], t)]
      b.box(m.quayCoping, v[0], level + 0.45, v[2], 0.23, 0.91, 0.23, chalk)
    }
    for (const h of [0.39, 0.79])
      b.beam(m.quayCoping, [q[0], level + h, q[2]], [c[0], level + h, c[2]], 0.12, 0.13, chalk)
  }
  stoneLantern(b, m, ex + Math.sign(ex) * 1.78, level, ez, world, index === 1)
}
export function plantedShoulders(b, m, grade, world, sampleCliff, arc) {
  let rng = generator(75325)
  const groves = [
    [-64, -106, 7.9, 0.4],
    [-67, -88, 8.8, 0.8],
    [-68.4, -48, 10.3, 0.83],
    [-65.8, -20, 7.8, 2.0],
    [-68.9, 17, 9.9, 1.1],
    [-63, 45, 7.8, -0.4],
    [-66.9, 74, 9.6, 0.35],
    [-46.9, 92, 7.0, -0.98],
    [64.2, -103, 8.8, 2.95],
    [68, -75, 10.2, 2.56],
    [67.3, -34, 9.2, -2.51],
    [64.9, -5, 6.7, -2.93],
    [68, 30, 8.3, 3.36],
    [65.5, 65, 9.6, -2.7],
    [44.0, 94, 8.7, -2.5],
    [-39, -129, 7.8, 0.7],
    [46, -128.4, 8.9, -0.5],
  ]
  for (let i = 0; i < groves.length; i++) {
    const [x, z, h, a] = groves[i]
    if (x < 0 && z > 86) {
      pondPines(b, m)
      flowerBed(b, m, generator(2816835581), x + 0.7, z + 1.0, grade, 2.97)
      // Keep the independent east-bank planting and the cliffside vines fixed.
      rng = generator(1653459880)
      continue
    }
    pineTree(b, m, rng, x, grade(x, z), z, h, a, true)
    for (let j = 0; j < (i % 3 ? 3 : 5); j++) {
      const s = a + 0.9 + j * 1.72,
        d = 2.8 + rng() * 3.0,
        px = x + Math.cos(s) * d,
        pz = z + Math.sin(s) * d
      if (Math.abs(px) < 60.5 && pz < 86.6 && pz > -122.3) continue
      pineTree(b, m, rng, px, grade(px, pz), pz, h * (0.38 + 0.34 * rng()), s, false)
    }
    if (i % 3 === 1) flowerBed(b, m, rng, x + 0.7, z + 1.0, grade, 2.97)
    if (i % 3 === 0) bamboo(b, m, rng, x + Math.sign(x) * 1.4, z + 3.4, grade, 4.6 + 1.4 * rng())
    for (let j = 0; j < 5; j++) {
      const az = a + j * 0.88,
        off = 2.9 + rng() * 4.1,
        xx = x + Math.cos(az) * off,
        zz = z + Math.sin(az) * off
      if (Math.abs(xx) < 60.5 && zz < 86.6 && zz > -122.4) continue
      const v = 1.08 + 1.23 * rng(),
        col = i % 5 === 0 && j < 3 ? rgb(0x8f7d60) : pine[(i + j) % 4]
      cushion(b, m, rng, xx, grade(xx, zz) + v * 0.28, zz, v * 1.37, v * 1.02, v * 0.75, col, false)
    }
  }
  leaningPine(b, m, rng, -67.7, grade(-67.7, 56.4), 56.4, 1.44, 2.47)
  leaningPine(b, m, rng, 67.4, grade(67.4, -38.9), -38.9, 1.68, 0.48)
  const ways = [
    [
      [-60.1, -39],
      [-62.4, -41],
      [-65.9, -40],
      [-65.2, -46],
      [-68.8, -48],
      [-72.2, -47.1],
    ],
    [
      [60.1, 39.5],
      [63.4, 40.1],
      [65.8, 36.6],
      [66.9, 40.2],
      [70.4, 41.1],
      [72.2, 37.6],
    ],
    [
      [-49.8, 86.3],
      [-50.7, 90.8],
      [-46.9, 90.4],
      [-48.3, 94.0],
      [-45.0, 96.1],
    ],
    [
      [37.3, -122.1],
      [41.7, -125.1],
      [39.3, -127.5],
      [43.3, -129.8],
    ],
  ]
  ways.forEach((way, i) => hillsideWay(b, m, way, grade, world, i))
  for (let u = 4.9; u < arc; u += 8.5 + 8.0 * rng()) {
    const p = sampleCliff(u, 0)
    if (p[2] > 82 && Math.abs(p[0]) < 19) continue
    for (let j = 0; j < 3; j++) {
      const base = u + j * 0.43,
        span = 0.76 + 1.8 * rng()
      let prev
      for (let k = 0; k <= 10; k++) {
        const t = k / 10,
          q = sampleCliff(base + 0.25 * Math.sin(t * 5.6 + j), 0.01 + t * span, 0.17)
        if (prev) {
          const w = 0.035 * (1 - t * 0.69),
            dx = 0.77 * w,
            dz = 0.64 * w
          b.face(
            m.karstNeedle,
            [
              [prev[0] - dx, prev[1], prev[2] - dz],
              [prev[0] + dx, prev[1], prev[2] + dz],
              [q[0] + dx, q[1], q[2] + dz],
              [q[0] - dx, q[1], q[2] - dz],
            ],
            moss
          )
        }
        if (k % 2 === 1) {
          const end = sampleCliff(base + (k % 4 === 1 ? 1 : -1) * (0.14 + 0.4 * rng()), 0.06 + t * span, 0.25)
          b.face(
            m.karstNeedle,
            [q, [q[0] + 0.12, q[1] - 0.09, q[2] + 0.04], end, [q[0] - 0.1, q[1] - 0.12, q[2] - 0.08]],
            tint(pine[Math.floor(rng() * 5)], 1.18)
          )
        }
        prev = q
      }
    }
  }
}

// Each range is a complete folded landform with several off-axis summits.
// The central notch behind the palace and the southern open water stay clear.
const ranges = [
  [-128, 29, 40, 43, 38, -0.42],
  [-142, -38, 49, 59, 65, -0.24],
  [-124, -112, 42, 48, 46, -0.68],
  [155, 46, 49, 44, 36, 0.52],
  [129, -45, 40, 48, 57, 0.22],
  [148, -117, 47, 55, 64, 0.71],
  [-82, -186, 40, 47, 48, -0.63],
  [83, -202, 43, 51, 62, 0.57],
  [-14, -231, 44, 28, 27, 0.17],
  [-102, 144, 37, 39, 43, 0.49],
  [113, 154, 42, 34, 41, -0.78],
  [-207, 59, 66, 59, 66, 0.28],
  [-232, -76, 68, 81, 88, -0.42],
  [-160, -219, 66, 54, 73, -0.56],
  [210, 0, 68, 74, 81, -0.37],
  [209, -176, 74, 59, 86, 0.42],
  [167, 202, 59, 58, 66, 0.53],
  [-179, 207, 61, 62, 64, -0.26],
  [35, 246, 51, 41, 41, -0.35],
  [-67, 281, 63, 41, 42, -0.55],
  [5, -340, 95, 64, 49, 0.32],
  [323, 115, 84, 74, 86, 0.77],
  [-336, 103, 95, 88, 83, 0.29],
  [281, -294, 92, 69, 90, -0.53],
  [-277, -287, 89, 75, 94, 0.92],
]
const uprightRock = [0x586b73, 0x657979, 0x777e76, 0x8f9182, 0x6f7170].map(rgb)
function towerCrag(b, m, rng, cx, y, cz, w, d, h, yaw, lean, fang, ground) {
  const co = Math.cos(yaw),
    si = Math.sin(yaw)
  const contour = [
    [-0.48, -0.34],
    [-0.15, -0.53],
    [0.37, -0.42],
    [0.51, -0.08],
    [0.43, 0.36],
    [0.06, 0.48],
    [-0.4, 0.39],
    [-0.54, 0.02],
  ]
  const crack = contour.map(() => 0.82 + 0.29 * rng()),
    crown = contour.map(() => rng() - 0.5)
  const bands = [
    [0, 1.09],
    [0.19, 1],
    [0.33, 0.88],
    [0.51, 0.8],
    [0.62, 0.85],
    [0.68, 0.7],
    [0.86, 0.67],
    [1, fang ? 0.22 : 0.54],
  ]
  const rings = bands.map(([v, r], i) =>
    contour.map(([u, t], j) => {
      const k = crack[j] * (r + 0.086 * Math.sin(j * 2.3 + v * 5.2))
      const uu = w * (u * k + v * lean + 0.068 * Math.sin(v * 6.3 + j) * Math.sin(Math.PI * v)),
        vv = d * (t * k + 0.1 * v * v)
      const dip = (0.032 + 0.13 * v) * u + 0.05 * Math.sin(j * 1.51 + v * 3.12) * Math.sin(v * Math.PI)
      const x = cx + uu * co + vv * si,
        z = cz - uu * si + vv * co
      let elevation = y + h * (v + dip + crown[j] * (i === 7 ? 0.21 : 0.055))
      if (i < 3) {
        const seat = ground(x, z) - 1.7
        elevation += Math.min(0, seat - y) * [1, 0.63, 0.22][i]
      }
      return [x, elevation, z]
    })
  )
  const mat = m.mountainGranite,
    col = blend(uprightRock[Math.floor(rng() * 5)], rgb(0x657c73), 0.23)
  for (let j = 0; j < contour.length; j++) {
    const k = (j + 1) % contour.length,
      face = tint(col, 0.85 + 0.23 * rng())
    for (let i = 0; i < bands.length - 1; i++) {
      const p = [rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]]
      const light = i === 3 || i === 5
      const c = light ? blend(face, uprightRock[3], 0.19) : face
      panel(
        b,
        mat,
        p,
        [tint(c, 0.93), tint(c, 0.82), tint(c, 1.04), tint(c, 1.13)],
        [
          [0, p[0][1]],
          [w * 0.3, p[1][1]],
          [w * 0.3, p[2][1]],
          [0, p[3][1]],
        ]
      )
    }
  }
  const rim = rings.at(-1),
    ctr = rim.reduce((v, p) => v.map((s, i) => s + p[i] / rim.length), [0, fang ? h * 0.075 : h * 0.025, 0])
  for (let j = 0; j < rim.length; j++)
    top(b, mat, [rim[j], rim[(j + 1) % rim.length], ctr], blend(col, moss, 0.36))
  return ctr
}
function naturalArch(b, m, rng, center, w, h, a, ground) {
  const co = Math.cos(a),
    si = Math.sin(a),
    [cx, y, cz] = center
  const p = (u, t, z) => [cx + co * u + si * z, y + t, cz - si * u + co * z]
  for (const sign of [-1, 1]) {
    const foot = p(sign * w * 0.49, -h * 0.37, 0)
    towerCrag(b, m, rng, ...foot, w * 0.52, w * 0.42, h * 1.19, a, sign * 0.17, false, ground)
  }
  const nodes = []
  for (let j = 0; j <= 10; j++) {
    const t = j / 10,
      u = (t - 0.5) * w * 1.22,
      arch = Math.pow(Math.sin(Math.PI * t), 0.75)
    const lower = h * (0.34 + 0.57 * arch) + 0.8 * Math.sin(t * 10.5 + 0.3)
    const upper = lower + h * (0.23 + 0.085 * Math.sin(t * 6.1 + 0.84))
    const d = w * (0.117 + 0.03 * Math.cos(t * 7 + 1))
    nodes.push([p(u, lower + 0.15, -d), p(u, lower, d), p(u, upper, d * 0.81), p(u, upper + 0.33, -d * 0.94)])
  }
  const palette = [uprightRock[0], uprightRock[2], blend(moss, uprightRock[3], 0.3), uprightRock[4]]
  for (let i = 0; i < nodes.length - 1; i++)
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4,
        p = [nodes[i][j], nodes[i][k], nodes[i + 1][k], nodes[i + 1][j]]
      b.face(m.mountainGranite, p, tint(palette[j], 0.94 + 0.13 * rng()))
    }
  return nodes[7][2]
}
function distantPine(b, m, rng, x, y, z, h, a) {
  const dx = Math.cos(a),
    dz = Math.sin(a)
  const stem = [
    [x, y - 0.55, z],
    [x + 0.035 * h * dx, y + 0.38 * h, z + 0.035 * h * dz],
    [x + 0.21 * h * dx - 0.04 * h * dz, y + 0.71 * h, z + 0.21 * h * dz + 0.04 * h * dx],
    [x + 0.28 * h * dx, y + h, z + 0.28 * h * dz],
  ]
  for (let j = 0; j < 3; j++)
    b.tube(
      m.mountainBark,
      stem[j],
      stem[j + 1],
      h * (0.061 - 0.013 * j),
      h * (0.044 - 0.012 * j),
      4,
      trunk,
      false
    )
  for (let i = 0; i < 5; i++) {
    const t = 0.28 + 0.135 * i,
      k = Math.min(2, Math.floor(t * 3)),
      f = t * 3 - k
    const root = stem[k].map((v, j) => mix(v, stem[k + 1][j], f)),
      yaw = a + (i % 2 ? 1 : -1) * (1.1 + 0.56 * rng()) + 0.56 * Math.sin(i * 2.4)
    const spread = h * (0.31 - 0.032 * i),
      u = Math.cos(yaw),
      v = Math.sin(yaw)
    const foot = [root[0] + u * spread * 0.67, root[1] + h * 0.11, root[2] + v * spread * 0.67]
    b.tube(m.mountainBark, root, foot, h * (0.026 - 0.002 * i), h * 0.009, 3, trunk, false)
    for (let j = 0; j < 5; j++) {
      const az = yaw - 1.72 + 0.84 * j + 0.18 * (rng() - 0.5),
        len = spread * (1.06 + 0.25 * rng())
      needleSpray(
        b,
        m,
        foot,
        az,
        len,
        spread * (0.36 + 0.12 * rng()),
        h * (0.033 + 0.046 * rng()),
        j % 2 ? 0.95 : 0.27,
        [0.83 + 0.16 * rng(), 0.87 + 0.13 * rng(), 0.78 + 0.19 * rng()]
      )
    }
  }
  for (let i = 0; i < 6; i++)
    needleSpray(
      b,
      m,
      stem[3],
      a + (tau * i) / 6,
      h * 0.23,
      h * 0.1,
      h * 0.075,
      i % 2 ? 0.73 : 0.23,
      [0.94, 1, 0.86]
    )
}
function massif(b, m, tuple, index) {
  const [cx, cz, rx, rz, h, a] = tuple,
    rng = generator(43000 + index * 89)
  const co = Math.cos(a),
    si = Math.sin(a),
    near = index < 11,
    n = near ? 25 : 15
  const forestZones = Array.from({ length: near ? 5 : 3 }, () => [
    (rng() - 0.5) * 0.97,
    (rng() - 0.5) * 1.04,
    0.21 + 0.16 * rng(),
  ])
  const peaks = [
    [-0.12 + (rng() - 0.5) * 0.22, -0.07, 0.3 + 0.12 * rng(), 0.36 + 0.1 * rng(), 1],
    [-0.43, -0.29 + 0.23 * rng(), 0.21 + 0.08 * rng(), 0.29 + 0.07 * rng(), 0.49 + 0.38 * rng()],
    [0.39, 0.09 + 0.2 * rng(), 0.21 + 0.11 * rng(), 0.25 + 0.11 * rng(), 0.51 + 0.33 * rng()],
    [0.03 - 0.23 * rng(), 0.48, 0.25 + 0.12 * rng(), 0.26 + 0.12 * rng(), 0.39 + 0.26 * rng()],
  ]
  const map = (u, v) => [cx + co * rx * u + si * rz * v, cz - si * rx * u + co * rz * v]
  const blocky = [1, 4, 5, 7, 11, 14, 17, 20, 23].includes(index)
  const long = [0, 3, 8, 9, 13, 16, 18, 19, 24].includes(index)
  const skew = 0.26 * Math.sin(index * 2.29),
    notchDir = 0.45 + index * 0.74
  function height(u, v) {
    let tallest = 0,
      sum = 0
    const fold = noise(1.6 * u + index, 2.1 * v, 71) - 0.5
    for (let i = 0; i < peaks.length; i++) {
      const [px, pz, w, d, hei] = peaks[i]
      const sx = u - px + (0.18 + 0.06 * i) * fold + skew * (v - pz)
      const sz = v - pz + 0.19 * fold + 0.041 * Math.sin((u + index) * 12)
      const x = sx / (w * (long ? 1.43 : blocky ? 0.83 : 1.03)),
        z = sz / (d * (long ? 0.77 : blocky ? 0.82 : 1.01))
      const dist = Math.pow(
        Math.pow(Math.abs(x), blocky ? 3.55 : 2.32) + Math.pow(Math.abs(z), blocky ? 3.55 : 2.32),
        1 / (blocky ? 3.55 : 2.32)
      )
      const cap = blocky ? 1 - smooth(0.41, 1.53, dist) : Math.exp(-Math.pow(dist, long ? 1.51 : 1.73) * 1.1)
      const value = hei * cap
      tallest = Math.max(tallest, value)
      sum += value
    }
    const radial = Math.hypot(u, v),
      f = limit(1 - radial)
    const divide = Math.abs(
      u * Math.cos(notchDir) +
        v * Math.sin(notchDir) +
        0.105 * Math.sin(v * 8.2 + index) +
        0.08 * Math.sin(u * 9.1 + 0.3)
    )
    const cut = 0.135 * Math.exp(-divide / 0.082) * smooth(0.18, 0.77, tallest)
    const rille =
      0.116 * (noise(u * 7.3 + 0.93 * fold + index, v * 4.9, 61) - 0.5) +
      0.143 * (noise(u * 3.1, v * 4.4 + index, 51) - 0.5)
    let raw = 0.09 + 0.78 * tallest + 0.15 * sum + 0.22 * f - cut + rille
    if (!near) {
      const line = v - (0.27 * Math.sin(u * 3.37 + index) + u * skew + 0.16 * Math.sin(u * 6 + index * 0.49))
      const escarpment = 1 - smooth(0.08 + 0.11 * noise(u * 3.4, index, 28), 0.66, Math.abs(line))
      const crest =
        0.47 +
        0.22 * Math.cos(u * 5.3 + index * 0.88) +
        0.2 * Math.abs(Math.sin(u * 7.9 + index * 0.5)) +
        0.18 * noise(u * 6.2, index, 17)
      const spur = 0.08 + 0.82 * escarpment * crest * (1 - smooth(0.59, 1.02, Math.abs(u))) + 0.14 * f + rille
      raw = mix(raw, spur, index % 4 === 0 ? 0.63 : 0.81)
    }
    const q = raw * (blocky ? 6.22 : 4.69) + 0.68 * noise(u * 4, v * 4, 53)
    const frac = q - Math.floor(q)
    const shelves = (smooth(0.29, 0.72, frac) - frac) * (blocky ? 0.18 : 0.085) * smooth(0.08, 0.36, raw)
    return -16 + h * (raw + shelves)
  }
  const rr = (t) => 1 + 0.056 * Math.sin(5 * t + index) + 0.043 * Math.cos(9 * t - index * 0.57)
  function surface(i, j) {
    const sx = (i / n) * 2 - 1,
      sz = (j / n) * 2 - 1
    let u = sx * Math.sqrt(1 - sz * sz * 0.5),
      v = sz * Math.sqrt(1 - sx * sx * 0.5)
    const scale = rr(Math.atan2(v, u))
    u *= scale
    v *= scale
    const [x, z] = map(u, v),
      y = height(u, v)
    const du = (height(u + 0.013, v) - height(u - 0.013, v)) / (0.026 * rx),
      dv = (height(u, v + 0.013) - height(u, v - 0.013)) / (0.026 * rz)
    const norm = unit([-du * co - dv * si, 1, du * si - dv * co])
    const canopy = rgb(near ? 0x476e5b : 0x748b83),
      cliff = rgb(near ? 0x7c8983 : 0x939e9a)
    const shadow = rgb(near ? 0x4c606a : 0x758794),
      quartz = rgb(near ? 0xa4a58b : 0xa8afa3)
    const groove = noise(u * 13.9 + index + 0.21 * foldAt(u, v), v * 8.32, 29)
    const bedding =
      (y * 0.109 + 0.68 * Math.sin(0.062 * x + 0.03 * z) + 0.29 * noise(u * 5.7, v * 4.7, 15)) % 1
    const mineral = 1 - smooth(0.032, 0.195, Math.abs(Math.abs(bedding) - 0.48))
    let c = blend(shadow, cliff, smooth(0.17, 0.83, groove))
    c = blend(c, quartz, 0.46 * mineral * (1 - smooth(0.4, 0.76, norm[1])))
    c = blend(c, canopy, smooth(0.28, 0.77, norm[1] + 0.4 * (noise(u * 4.4, v * 3.7, 10) - 0.5)) * 0.92)
    const timber = forestZones.reduce(
      (cover, [px, pz, r]) => Math.max(cover, 1 - smooth(r * 0.6, r * 1.38, Math.hypot(u - px, v - pz))),
      0
    )
    c = blend(c, near ? pine[1] : canopy, timber * (0.32 + 0.44 * smooth(0.3, 0.7, norm[1])))
    return { p: [x, y, z], norm, c: tint(c, 0.88 + 0.21 * noise(u * 9 + 0.15, v * 8.6, 26)), u, v }
  }
  const foldAt = (u, v) => noise(u * 3.2, v * 3.8 + index, 41) - 0.5
  const grid = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => surface(i, j)))
  // Interpolate the very triangles used to draw the slope. A rock spur may
  // span a twenty-metre change in height between its two feet.
  function rootSeat(x, z) {
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const cells = [grid[i][j].p, grid[i][j + 1].p, grid[i + 1][j + 1].p, grid[i + 1][j].p]
        const p = cells[0]
        for (const [q, r] of [
          [cells[1], cells[2]],
          [cells[2], cells[3]],
        ]) {
          if (
            x < Math.min(p[0], q[0], r[0]) ||
            x > Math.max(p[0], q[0], r[0]) ||
            z < Math.min(p[2], q[2], r[2]) ||
            z > Math.max(p[2], q[2], r[2])
          )
            continue
          const d = (q[2] - r[2]) * (p[0] - r[0]) + (r[0] - q[0]) * (p[2] - r[2])
          const s = ((q[2] - r[2]) * (x - r[0]) + (r[0] - q[0]) * (z - r[2])) / d
          const t = ((r[2] - p[2]) * (x - r[0]) + (p[0] - r[0]) * (z - r[2])) / d
          if (s >= -0.000001 && t >= -0.000001 && s + t <= 1.000001)
            return s * p[1] + t * q[1] + (1 - s - t) * r[1]
        }
      }
    return -16
  }
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++) {
      const dx = sub(grid[Math.min(i + 1, n)][j].p, grid[Math.max(i - 1, 0)][j].p)
      const dz = sub(grid[i][Math.min(j + 1, n)].p, grid[i][Math.max(j - 1, 0)].p)
      grid[i][j].norm = unit(blend(grid[i][j].norm, unit(cross(dz, dx)), 0.57))
    }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const vs = [grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]]
      const facet = unit(cross(sub(vs[1].p, vs[0].p), sub(vs[3].p, vs[0].p)))
      const normals = vs.map((e) => unit(blend(e.norm, facet, blocky ? 0.25 : 0.13)))
      panel(
        b,
        m.mountainGranite,
        vs.map((e) => e.p),
        vs.map((e) => e.c),
        null,
        normals
      )
    }
  const ring = []
  for (let i = 0; i < n; i++) ring.push(grid[i][0])
  for (let j = 0; j < n; j++) ring.push(grid[n][j])
  for (let i = n; i > 0; i--) ring.push(grid[i][n])
  for (let j = n; j > 0; j--) ring.push(grid[0][j])
  const profiles = [
    [0, 1],
    [0.17, 0.994],
    [0.34, 0.945],
    [0.57, 0.8],
    [0.77, 0.59],
    [0.91, 0.35],
    [1, 0.11],
  ]
  const rings = (near ? profiles : profiles.filter((_, i) => i !== 1 && i !== 4)).map(([f, r]) =>
    ring.map(({ p: [x, y, z], u, v }) => {
      const th = Math.atan2(v, u),
        root =
          (0.24 * Math.sin(3 * th + index) + 0.16 * Math.sin(7 * th - 0.19 * index)) * Math.sin(Math.PI * f)
      return [
        cx + (x - cx) * (r + root * 0.12) + rx * 0.09 * f * f,
        mix(y, -36 - 0.6 * h, f) - h * (root * 0.52 + 0.15 * f * (1 - f)),
        cz + (z - cz) * (r + root * 0.14) - rz * 0.08 * f * f,
      ]
    })
  )
  const deep = rgb(near ? 0x526a74 : 0x7a8d98)
  for (let r = 0; r < rings.length - 1; r++)
    for (let j = 0; j < ring.length; j++) {
      const k = (j + 1) % ring.length,
        ps = [rings[r][j], rings[r][k], rings[r + 1][k], rings[r + 1][j]]
      const c = blend(deep, ring[j].c, 0.34 + 0.16 * Math.sin(r * 1.72 + index + j * 0.17))
      b.face(m.mountainGranite, ps, c)
    }
  const bottom = [cx + rx * 0.09, -38 - 0.61 * h, cz - rz * 0.08]
  for (let j = 0; j < ring.length; j++)
    b.face(m.mountainGranite, [rings.at(-1)[j], rings.at(-1)[(j + 1) % ring.length], bottom], deep)
  if (near)
    for (const [u, v, r] of forestZones) {
      const candidates = []
      for (const row of grid)
        for (const q of row)
          if (q.norm[1] > 0.46 && q.p[1] > -0.8 && Math.hypot(q.u - u, q.v - v) < r) candidates.push(q)
      const count = Math.min(candidates.length, 4 + Math.floor(rng() * 4))
      for (let i = 0; i < count; i++) {
        const k = Math.floor(rng() * candidates.length),
          station = candidates.splice(k, 1)[0]
        const [x, y, z] = station.p
        distantPine(b, m, rng, x, y, z, 3.2 + rng() * 3.9, index + 0.49 * i)
      }
    }
  if (near && [1, 2, 4, 5, 6, 7, 10].includes(index)) {
    const nearCity = Math.sign(-cx) * (0.36 + 0.13 * rng())
    const configs = {
      1: [2, 0.54, 0.4, 0.5],
      2: [2, 0.29, 0.22, 0.39],
      4: [3, 0.44, 0.29, 0.59],
      5: [3, 0.34, 0.31, 0.51],
      6: [2, 0.46, 0.29, 0.46],
      7: [2, 0.54, 0.28, 0.39],
      10: [2, 0.52, 0.32, 0.31],
    }
    const [count, span, depth, maxRise] = configs[index]
    for (let j = 0; j < count; j++) {
      const u = nearCity + j * 0.09,
        v = -0.31 + j * 0.17
      const [x, z] = map(u, v),
        g = height(u, v),
        rise = h * maxRise * (j === 1 ? 1.18 : 0.73 + 0.27 * rng())
      const crown = towerCrag(
        b,
        m,
        rng,
        x,
        g - h * 0.2,
        z,
        rx * (span + 0.11 * rng()),
        rz * (depth + 0.1 * rng()),
        rise,
        a + (index % 2 ? 0.27 : -0.36) * j,
        (rng() - 0.5) * 0.49,
        j === 2 && index === 5,
        rootSeat
      )
      if (j === 1 && (index === 4 || index === 6))
        leaningPine(b, m, rng, ...crown, index === 4 ? 1.85 : 1.47, a + Math.PI)
      else if (j !== 2 && rng() < 0.62) distantPine(b, m, rng, ...crown, 3.6 + 2 * rng(), a)
    }
  }
  if (index === 3 || index === 7) {
    const v = index === 3 ? 0.37 : -0.11,
      u = index === 3 ? -0.64 : -0.73,
      p = map(u, v)
    const crown = naturalArch(
      b,
      m,
      rng,
      [p[0], height(u, v) - 2.1, p[1]],
      index === 3 ? 20 : 16.5,
      index === 3 ? 12 : 11,
      0.26 + index * 0.19,
      rootSeat
    )
    if (index === 3) leaningPine(b, m, rng, ...crown, 1.2, -0.48)
  }
}
export function distantRanges(scene, m) {
  for (let i = 0; i < ranges.length; i += 3) {
    const batch = new LandBatch(scene)
    for (let j = i; j < Math.min(i + 3, ranges.length); j++) massif(batch, m, ranges[j], j)
    batch.finish()
  }
}
