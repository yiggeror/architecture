import * as T from 'three'
import { box, beam, panel, roof } from './reachWardFrame.js'
import { reachFace } from './reachWardArt.js'
import { streetLantern } from './reachWardLamps.js'
import { oilStand } from './wardOilLamps.js'
const sign = [-1, 1]

// The hood and the interior walls absorb much of the light directed into air.
// Paving, wood, figures and raindrops still sample the full local source.
function shelteredLight(world, b, x, y, z, color, power, range, air) {
  const lamp = world?.addLightAt?.(b, x, y, z, color, power, range)
  if (lamp && typeof lamp === 'object') lamp.air = air
}
function fabric(b, m, h, x, y, z, w, depth) {
  const mat = m.reachDetail,
    pat = h.style.fabric,
    front = z + depth
  const X = [x - w / 2, x - w * 0.25, x, x + w * 0.25, x + w / 2],
    curve = [0.05, -0.11, 0.02, -0.15, 0.025]
  for (let i = 0; i < 4; i++) {
    const a = X[i],
      c = X[i + 1],
      ay = y - 0.36 + curve[i],
      cy = y - 0.36 + curve[i + 1]
    reachFace(
      b,
      mat,
      pat,
      [
        [a, ay, front],
        [c, cy, front],
        [c, y, z],
        [a, y, z],
      ],
      0.95
    )
    reachFace(
      b,
      mat,
      pat,
      [
        [a, ay - 0.28, front],
        [c, cy - 0.28, front],
        [c, cy, front],
        [a, ay, front],
      ],
      0.79
    )
    reachFace(
      b,
      mat,
      39,
      [
        [a, ay - 0.29, front + 0.004],
        [c, cy - 0.29, front + 0.004],
        [c, cy - 0.252, front + 0.004],
        [a, ay - 0.252, front + 0.004],
      ],
      0.8
    )
  }
  for (const s of sign)
    beam(b, mat, 24, [x + s * w * 0.475, y - 1.14, z], [x + s * w * 0.475, y - 0.36, front], 0.075, 0.075)
}
function banner(b, m, h, s, ground, z) {
  const mat = m.reachDetail,
    slot = h.style.fabric,
    x = s * (h.width / 2 - 0.79),
    y = ground + 0.4
  beam(b, mat, 27, [x, y, z - 0.4], [x, y + 0.14, z + 0.82], 0.09, 0.09, 1.14)
  const top = y + 0.02,
    low = y - 1.77,
    pos = [
      [x, low + 0.07, z + 0.19],
      [x, low - 0.04, z + 0.78],
      [x, top, z + 0.78],
      [x, top, z + 0.19],
    ]
  reachFace(b, mat, slot, pos)
  for (const sz of [0.23, 0.71]) beam(b, mat, 27, [x, y + 0.1, z + sz], [x, top - 0.02, z + sz], 0.04, 0.04)
  b.at(x + 0.014, 0, z + 0.5, Math.PI / 2, () =>
    panel(b, mat, h.style.sign + (h.phase % 4), 0, low + 0.44, 0, 0.55, 0.98, [1, 0.92, 0.74])
  )
}
function hallLevel(h) {
  return h.floors > 1 ? 1 + Number(h.floors > 2 && h.phase % 2 === 1) : 0
}
function sizeAt(h, floor) {
  const inset = h.lifted && h.floors >= 3 && floor === h.floors - 1
  return {
    w: (h.width - 1.28) * (inset ? (h.kind === 'lantern' ? 0.6 : 0.73) : 1),
    d: (h.depth - 1.45) * (inset ? (h.kind === 'guild' ? 0.7 : 0.76) : 1),
    base: 0.2 + (floor ? h.ground + (floor - 1) * h.unit : 0),
    height: floor ? h.unit : h.ground,
  }
}
export function streetFront(b, m, h, world) {
  const mat = m.reachDetail,
    s = h.style,
    w = h.width - 1.28,
    D = h.depth,
    ground = h.ground + 0.2,
    z = D / 2,
    side = h.phase % 2 ? 1 : -1
  if (h.open) {
    box(b, m.reachFrame, 33, 0, 0.075, z - 0.72, w * 0.46, 0.15, 1.13, 0.88)
    const projecting = h.sig || h.use === 'gallery',
      plaqueHeight = projecting ? 0.76 : 0.63,
      wy = Math.min(projecting ? 3.5 : 3.15, w * 0.6),
      pz = projecting ? z + 0.075 : z - 0.58
    if (projecting)
      for (const edge of sign)
        beam(
          b,
          mat,
          24,
          [edge * wy * 0.37, ground - 0.16, z - 0.56],
          [edge * wy * 0.37, ground - 0.04, pz],
          0.07,
          0.075
        )
    panel(b, mat, s.sign + (h.phase % 4), 0, ground - 0.8, pz, wy, plaqueHeight, 1.06)
    for (const edge of sign)
      box(b, mat, 27, edge * (wy * 0.5 + 0.01), ground - 0.5, pz + 0.03, 0.079, plaqueHeight + 0.06, 0.09)
    if (h.trade === 'silk' || (h.trade === 'market' && h.phase % 3 !== 0) || h.phase % 7 === 2)
      fabric(b, m, h, side * w * 0.18, ground - 0.05, z - 1.38, w * 0.54, 1.45)
    if (h.phase % 3 === 0 || h.sig) banner(b, m, h, side, ground, z - 1.11)
    if (h.phase % 3 !== 1 || h.sig) {
      const num = h.use === 'banquet' ? 2 : 1
      for (let k = 0; k < num; k++) {
        const X = (k ? -1 : 1) * side * (w / 2 - 0.27),
          lz = z - 0.51,
          red = h.trade === 'silk' || (h.phase + k) % 5 === 1
        const lanternY = ground - (h.sig ? 0.98 : 0.85),
          lanternZ = lz + 0.26,
          r = h.sig ? 0.35 : red ? 0.29 : 0.255,
          height = h.sig ? 0.85 : 0.69
        // The cantilever is dowelled into the porch beam. Its lantern sits
        // outside the valance so a visitor can locate the source from the quay.
        beam(b, mat, 24, [X, ground - 0.19, lz - 0.55], [X, ground - 0.11, lanternZ + 0.04], 0.105, 0.098)
        beam(b, mat, 27, [X, ground - 0.55, lz - 0.41], [X, ground - 0.14, lz + 0.07], 0.061, 0.071)
        beam(b, mat, 27, [X, ground - 0.11, lanternZ], [X, lanternY + height * 0.54, lanternZ], 0.037, 0.037)
        streetLantern(b, m, X, lanternY, lanternZ, r, height, red, h.phase % 4 === 2, red ? 0.92 : 0.97)
        // The light on this porch flagstone falls from the lantern immediately
        // above its back edge, even between samples of the distant light field.
        const cx = X * 0.94,
          near = z + 0.15,
          back = z - 0.72
        reachFace(
          b,
          m.reachFrame,
          115,
          [
            [cx - 0.62, 0.033, near],
            [cx + 0.62, 0.033, near],
            [cx + 0.62, 0.033, back],
            [cx - 0.62, 0.033, back],
          ],
          0.83
        )
        shelteredLight(
          world,
          b,
          X,
          lanternY,
          lanternZ,
          red ? 0xff874d : s.glow,
          h.sig ? 39 : h.use === 'banquet' ? 26 : 30,
          h.sig ? 10.8 : 8.9,
          0.65
        )
      }
    }
  } else if (h.use === 'home' && h.phase % 3 === 0) {
    const X = -w * 0.25,
      Y = ground - 0.77,
      Z = z - 0.67
    beam(b, mat, 24, [X, ground - 0.36, Z - 0.62], [X, ground - 0.28, Z + 0.03], 0.072, 0.078)
    beam(b, mat, 27, [X, ground - 0.28, Z], [X, Y + 0.29, Z], 0.037, 0.037)
    streetLantern(b, m, X, Y, Z, 0.22, 0.54, false, true, 0.76)
    shelteredLight(world, b, X, Y, Z, 0xffc680, 16, 7, 0.53)
  }
  if (h.use === 'gallery' || h.use === 'banquet') {
    const floor = hallLevel(h),
      q = sizeAt(h, floor),
      Y = q.base + q.height,
      rz = q.d / 2 - 0.18,
      count = Math.max(2, Math.min(5, Math.round(q.w / 2.45)))
    panel(b, mat, 88 + (h.phase % 4), 0, Y - 0.42, rz, q.w + 0.22, 0.28, 0.97)
    for (let j = 0; j < count; j++) {
      if (h.use === 'gallery' && j % 3 === 1) continue
      const X = -q.w * 0.43 + (j * q.w * 0.86) / Math.max(1, count - 1),
        drop = 0.22 + (j % 2) * 0.16
      if (h.sig || j % 2 === 0)
        panel(b, mat, 39, X, Y - 0.31, rz + 0.027, Math.min(0.94, (q.w / count) * 0.43), 0.065, 0.9)
      beam(b, mat, 27, [X, Y - 0.26, rz + 0.02], [X, Y - 0.28 - drop, rz + 0.02], 0.032, 0.034)
      const lanternY = Y - 0.62 - drop,
        lanternZ = rz + 0.02,
        red = h.use === 'banquet' && j % 2 === 0,
        large = h.sig || (h.use === 'banquet' && j === 0)
      streetLantern(
        b,
        m,
        X,
        lanternY,
        lanternZ,
        large ? 0.34 : 0.24,
        large ? 0.77 : 0.62,
        red,
        !red && h.phase % 3 === 1,
        j % 2 ? 0.85 : 1.13
      )
      if (j === 0 || (h.sig && j === count - 1 && count > 2))
        shelteredLight(world, b, X, lanternY, lanternZ, red ? 0xff9757 : s.glow, large ? 31 : 22, 8.6, 0.51)
    }
  }
  if (h.sig && h.kind !== 'return' && h.phase % 3 !== 2) {
    const q = sizeAt(h, h.floors - 1),
      W = q.w + 1.28,
      depth = q.d + 1.45,
      riseBase = q.base + q.height - 0.06,
      lift = 0.36 + (h.phase % 4) * 0.13 + 0.26
    for (const side of sign) {
      const L = W / 2,
        near = 0.72
      beam(
        b,
        mat,
        39,
        [side * L * near, riseBase + lift * near ** 4 + 0.017, depth / 2 + 0.014],
        [side * L, riseBase + lift + 0.016, depth / 2 + 0.014],
        0.086,
        0.12,
        0.77
      )
    }
  }
}
function jar(b, m, x, y, z, r, H, slot = 38) {
  const mat = m.reachDetail,
    profile = [
      [0, 0.62],
      [0.18, 0.92],
      [0.64, 1],
      [0.89, 0.6],
      [1, 0.64],
    ],
    n = 7
  const p = (j, k) => [
    x + r * profile[k][1] * Math.cos((2 * Math.PI * j) / n),
    y + H * profile[k][0],
    z + r * profile[k][1] * Math.sin((2 * Math.PI * j) / n),
  ]
  for (let k = 0; k < 4; k++)
    for (let j = 0; j < n; j++)
      reachFace(b, mat, slot, [p(j, k), p(j + 1, k), p(j + 1, k + 1), p(j, k + 1)], 0.91)
  reachFace(
    b,
    mat,
    slot,
    Array.from({ length: n }, (_, j) => p(n - j, 4)),
    0.57,
    Array.from({ length: n }, (_, j) => [
      0.5 + 0.43 * Math.cos((-2 * Math.PI * j) / n),
      0.5 + 0.43 * Math.sin((-2 * Math.PI * j) / n),
    ])
  )
}
function shelf(b, m, x, y, z, w, h) {
  const mat = m.reachDetail
  for (const side of sign) box(b, mat, 24, x + side * w * 0.49, y + h / 2, z, 0.095, h, 0.44)
  for (let i = 0; i < 3; i++) box(b, mat, 27, x, y + 0.18 + i * h * 0.4, z, w, 0.105, 0.48)
}
export function inside(b, m, h, world) {
  if (!h.open) return
  const mat = m.reachDetail,
    s = h.style,
    w = h.width - 1.28,
    d = h.depth - 1.45,
    side = h.phase % 2 ? 1 : -1
  const x = side * w * 0.25,
    z = -d * 0.24,
    edge = -d * 0.45
  panel(
    b,
    mat,
    92 + (h.phase % 4),
    side * w * 0.24,
    0.47,
    edge,
    Math.max(1.2, w * 0.35),
    h.ground - 0.77,
    0.84
  )
  if (h.trade === 'silk') {
    const wv = Math.min(2.7, w * 0.38)
    for (const S of sign) {
      box(b, mat, 24, x + (S * wv) / 2, 1.23, z, 0.095, 2.25, 0.13)
      beam(b, mat, 24, [x + (S * wv) / 2, 0.33, z + 0.98], [x + (S * wv) / 2, 1.45, z], 0.097, 0.1)
    }
    beam(b, mat, 27, [x - wv * 0.55, 2.14, z], [x + wv * 0.55, 2.14, z], 0.13, 0.13)
    reachFace(b, mat, s.fabric, [
      [x - wv * 0.44, 0.58, z + 0.79],
      [x + wv * 0.44, 0.58, z + 0.79],
      [x + wv * 0.44, 1.71, z + 0.03],
      [x - wv * 0.44, 1.71, z + 0.03],
    ])
    for (const [i, delta] of [-0.45, 0.46].entries())
      jar(b, m, -x + delta, 0.21, z + 0.63, 0.28 + i * 0.03, 0.53, i ? 38 : 24)
  } else if (h.trade === 'harbor') {
    for (let j = 0; j < 4; j++)
      box(
        b,
        mat,
        j % 2 ? 34 : 24,
        x + (j % 2) * 0.65,
        0.5 + Math.floor(j / 2) * 0.53,
        z + (j % 2) * 0.13,
        0.85,
        0.57,
        0.61
      )
    for (const S of sign) {
      beam(b, mat, 27, [x - S * 0.7, 0.26, z - 0.3], [x + S * 0.95, 2.2, z - 0.4], 0.062, 0.075)
      beam(b, mat, 27, [x + S * 0.74, 1.92, z - 0.4], [x + S * 0.98, 2.28, z - 0.4], 0.14, 0.13)
    }
  } else if (h.trade === 'books') {
    const width = Math.min(2.4, w * 0.39)
    shelf(b, m, x, 0.29, z, width, 2.04)
    for (let row = 0; row < 2; row++)
      for (let j = 0; j < 4; j++)
        box(
          b,
          mat,
          j % 3 === 1 ? 27 : 30,
          x - width * 0.36 + j * width * 0.23,
          0.57 + row * 0.82,
          z + 0.045,
          0.1 + 0.12 * (j % 2),
          0.35 + 0.06 * (j % 3),
          0.22,
          0.78
        )
    panel(b, mat, 52 + (h.phase % 4), -x, 0.69, z + 0.08, 1.06, 1.8, 0.83)
  } else if (h.trade === 'guild') {
    box(b, mat, 25, 0, 0.96, z, w * 0.58, 0.2, 1.0)
    for (const S of sign) {
      box(b, mat, 24, S * w * 0.23, 0.55, z, 0.16, 0.76, 0.48)
      jar(b, m, S * w * 0.19, 1.06, z, 0.19, 0.37, 39)
      box(b, mat, 27, S * w * 0.19, 1.58, z, 0.07, 0.68, 0.07)
    }
    panel(b, mat, s.sign + (h.phase % 4), 0, 1.42, edge, w * 0.34, 1.32, 1.02)
  } else if (h.trade === 'metal') {
    box(b, mat, 18, x, 1.04, z, 1.29, 1.77, 0.96, 0.9)
    panel(b, mat, 24, x, 0.39, z + 0.486, 0.77, 0.73, 0.72)
    panel(b, m.reachLights, 37, x, 0.51, z + 0.492, 0.49, 0.32, 0.78)
    for (const [i, delta] of [-0.46, 0.1, 0.62].entries())
      jar(b, m, -x + delta, 0.22, z + 0.32, 0.22, 0.4 + i * 0.12, i % 2 ? 27 : 38)
  } else {
    shelf(b, m, x, 0.26, z, Math.min(2.62, w * 0.42), 1.74)
    for (const [j, delta] of [-0.64, -0.12, 0.5].entries())
      jar(b, m, x + delta, 1.19, z + 0.04, 0.18 + (j % 2) * 0.05, 0.33 + (j % 2) * 0.17, j % 2 ? 38 : 27)
    for (let i = 0; i < 3; i++)
      box(b, mat, 27, -x, 0.32 + i * 0.105, z + 0.23, 0.75 - i * 0.08, 0.09, 0.51 - i * 0.06)
  }
  if (h.sig || h.phase % 4 < 2) {
    const width = Math.min(2.1, w * 0.255),
      X = -side * (w / 2 - width / 2 - 0.17),
      Z = d / 2 - 1.66
    oilStand(b, m, X, 1.142, Z, h.sig ? 1.35 : 1.1, reachFace)
    shelteredLight(
      world,
      b,
      X,
      1.142 + (h.sig ? 0.55 : 0.45),
      Z + 0.032,
      h.trade === 'books' ? 0xffd386 : 0xffad5f,
      h.sig ? 29 : 21,
      7.7,
      0.18
    )
  }
  const rz = d / 2 + 0.15,
    roofY = h.ground + 0.04
  for (const side of sign)
    beam(
      b,
      mat,
      s.wood,
      [side * (w / 2 - 0.08), roofY - 0.58, rz],
      [side * (w / 2 - 0.59), roofY - 0.09, rz],
      0.1,
      0.12
    )
}
export function hangDetailAtDistance(scene, mesh, distance) {
  mesh.geometry.computeBoundingSphere()
  const center = mesh.geometry.boundingSphere.center,
    group = new T.LOD()
  group.position.copy(center)
  mesh.position.copy(center).multiplyScalar(-1)
  mesh.userData.noCollision = true
  group.name = '可步入的商铺内景'
  group.addLevel(mesh, 0)
  group.addLevel(new T.Group(), distance, 0.12)
  scene.add(group)
}
