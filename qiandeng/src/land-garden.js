import * as T from 'three'
import { cross, generator, sub, unit } from './mesh.js'
import { LandBatch, blend, mix, noise, panel, rgb, tau, tint, top } from './land-kit.js'

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
  const soil = b.scene.children.find(
    (mesh) => mesh.userData.terrainHull && mesh.material === m.upperGardens
  )
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
      b.tube(
        m.mountainBark,
        local(0.012, 0.049, 0.008),
        foot,
        width * 0.69,
        width * 0.075,
        5,
        timber,
        false
      )
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
          const end = sampleCliff(
            base + (k % 4 === 1 ? 1 : -1) * (0.14 + 0.4 * rng()),
            0.06 + t * span,
            0.25
          )
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

// Long, low outcrops sit beyond the outer wards. The southwestern reach
// remains open to the cloud sea when viewed from the city or either bank.
const ranges = [
  [-345, -185, 83, 25, 15, -0.83],
  [-286, -574, 100, 28, 17, -0.24],
  [-41, -735, 85, 24, 13, 0.36],
  [282, -709, 106, 32, 20, -0.28],
  [395, -143, 94, 25, 16, 1.02],
]
const distantHeather = [0x657d79, 0x76877f, 0x586f6e, 0x64767c].map(rgb)

export function distantRanges(scene, m) {
  ranges.forEach(([x, z, run, depth, relief, yaw], id) => {
    const b = new LandBatch(scene),
      co = Math.cos(yaw),
      si = Math.sin(yaw)
    const point = (u, y, v) => [x + co * u + si * v, y, z - si * u + co * v]
    const n = 21,
      rows = 7
    const grid = Array.from({ length: n + 1 }, (_, i) => {
      const u = (i / n) * 2 - 1,
        arc = 0.075 + 0.925 * (1 - u * u) ** 0.69
      const bend = depth * (0.29 * Math.sin(4.3 * u + id) + 0.18 * Math.sin(7.4 * u - id * 1.3))
      const top = (0.43 + 0.44 * noise(4.2 * u + id, 0.6, 31) + 0.22 * Math.cos(3.8 * u - id)) * arc
      return Array.from({ length: rows }, (_, j) => {
        const v = (j / (rows - 1)) * 2 - 1,
          fleck = noise(7 * u + id, 3 * v, 36)
        const shift = 0.13 * Math.sin(u * 8.4 + id),
          ridge = Math.exp(-2.7 * Math.abs(v - shift) ** 1.65)
        const py = -5.7 + relief * top * ridge + arc * (fleck - 0.5) * 2.4
        return {
          p: point(u * run, py, bend + v * arc * depth * (0.83 + 0.27 * fleck)),
          c: blend(distantHeather[(j + id) % 4], distantHeather[0], 0.37 + 0.38 * fleck),
        }
      })
    })
    for (let i = 0; i <= n; i++)
      for (let j = 0; j < rows; j++) {
        const a = sub(grid[Math.min(i + 1, n)][j].p, grid[Math.max(i - 1, 0)][j].p)
        const c = sub(grid[i][Math.min(j + 1, rows - 1)].p, grid[i][Math.max(j - 1, 0)].p)
        grid[i][j].n = unit(cross(c, a))
      }
    for (let i = 0; i < n; i++)
      for (let j = 0; j < rows - 1; j++) {
        const v = [grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]]
        panel(
          b,
          m.mountainGranite,
          v.map((q) => q.p),
          v.map((q) => q.c),
          null,
          v.map((q) => q.n)
        )
      }
    const rim = [
      ...grid.map((col) => col[0]),
      ...grid[n].slice(1),
      ...grid
        .slice(0, -1)
        .reverse()
        .map((col) => col.at(-1)),
      ...grid[0].slice(1, -1).reverse(),
    ]
    let previous = rim.map((q) => q.p)
    for (const [f, y] of [
      [0.93, -16],
      [0.67, -27],
      [0.19, -33],
    ]) {
      const next = rim.map(({ p }, i) => [
        mix(x, p[0], f),
        y - 2.4 * Math.sin(i * 0.51 + id),
        mix(z, p[2], f),
      ])
      for (let i = 0; i < rim.length; i++) {
        const j = (i + 1) % rim.length
        b.face(
          m.mountainGranite,
          [previous[i], previous[j], next[j], next[i]],
          blend(rim[i].c, distantHeather[3], 0.61)
        )
      }
      previous = next
    }
    for (let i = 0; i < rim.length; i++)
      b.face(
        m.mountainGranite,
        [previous[i], previous[(i + 1) % rim.length], [x, -36, z]],
        distantHeather[3]
      )
    b.finish()
  })
}
