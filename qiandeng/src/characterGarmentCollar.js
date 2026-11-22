import { turn, mix, step, clip, between, shade, tint } from './characterGarmentMesh.js'
import { clothUV } from './characterGarmentPaint.js'

function blendWeights(a, b, t) {
  const w = {}
  for (const n in a) w[n] = a[n] * (1 - t)
  for (const n in b) w[n] = (w[n] || 0) + b[n] * t
  return w
}
const bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2))

// Fit to the sculpted wearer. This samples the actual neck mesh and its skin
// weights, including the transition from the sternum into the throat. A collar
// on the generic torso alone would end at the same shallow crew neck on everyone.
export function fitNeck(a, start) {
  const skin = a.skin,
    end = skin.positions.length / 3
  let slices = 1
  while (start + slices < end) {
    const i = (start + slices) * 3
    if (Math.abs(skin.positions[i]) < 1e-8 && skin.positions[i + 2] > 0) break
    slices++
  }
  const rings = []
  for (let k = start; k + slices <= end; k += slices) {
    const row = []
    for (let j = 0; j < slices; j++) {
      const i = k + j,
        p = skin.positions.slice(i * 3, i * 3 + 3),
        w = {}
      for (let n = 0; n < 4; n++)
        if (skin.weights[i * 4 + n])
          w[a.rig.skeleton.bones[skin.joints[i * 4 + n]].name] = skin.weights[i * 4 + n]
      row.push({ p, w })
    }
    rings.push(row)
  }
  function layer(y, th, full = false) {
    const angle = ((((th % turn) + turn) % turn) * slices) / turn
    const ia = Math.floor(angle) % slices,
      ib = (ia + 1) % slices,
      t = angle - Math.floor(angle),
      yy = a.y(y)
    function rowY(row) {
      return mix(row[ia].p[1], row[ib].p[1], t)
    }
    if (yy < rowY(rings[0]) || y < 1.348)
      return { p: a.torsoPoint(y, th), w: full ? a.torsoWeight(y, th) : undefined }
    let after = rings.findIndex((r) => rowY(r) >= yy)
    if (after < 0) after = rings.length - 1
    const b = rings[after],
      aa = rings[Math.max(0, after - 1)]
    const f = clip((yy - rowY(aa)) / (rowY(b) - rowY(aa) || 1))
    const ca = between(aa[ia].p, aa[ib].p, t),
      cb = between(b[ia].p, b[ib].p, t)
    const w = full
      ? blendWeights(blendWeights(aa[ia].w, aa[ib].w, t), blendWeights(b[ia].w, b[ib].w, t), f)
      : undefined
    return { p: between(ca, cb, f), w }
  }
  return (y, th, allowance = 0) => {
    const d = layer(y, th, true),
      h = a.h
    const l = layer(y, th - 0.012).p,
      r = layer(y, th + 0.012).p,
      b = layer(y - 0.0012, th).p,
      t = layer(y + 0.0012, th).p
    const tx = r[0] - l[0],
      ty = r[1] - l[1],
      tz = r[2] - l[2],
      ux = t[0] - b[0],
      uy = t[1] - b[1],
      uz = t[2] - b[2]
    const nx = ty * uz - tz * uy,
      ny = tz * ux - tx * uz,
      nz = tx * uy - ty * ux,
      norm = Math.hypot(nx, ny, nz) || 1
    d.p[0] += (allowance * h * nx) / norm
    d.p[1] += (allowance * h * ny) / norm
    d.p[2] += (allowance * h * nz) / norm
    return { ...d, theta: th, level: y, allowance }
  }
}

function pathPoint(path, t) {
  const at = clip(t) * (path.length - 1),
    i = Math.min(path.length - 2, Math.floor(at)),
    k = at - i
  const a = path[Math.max(0, i - 1)],
    b = path[i],
    c = path[i + 1],
    d = path[Math.min(path.length - 1, i + 2)]
  return b.map(
    (v, n) =>
      0.5 *
      (2 * v +
        (c[n] - a[n]) * k +
        (2 * a[n] - 5 * v + 4 * c[n] - d[n]) * k * k +
        (-a[n] + 3 * v - 3 * c[n] + d[n]) * k * k * k)
  )
}

// The bias-cut facing has a folded edge and a visible underlap. Both turn up
// around the actual neck with it, then flatten across the breast with the ribcage.
function facing(a, support, path, width, lift, colour, stitch, bolts, top, opening) {
  a.satin.patch(9, 42, (u, v) => {
    const [th, y] = pathPoint(path, v),
      lo = pathPoint(path, v - 0.001),
      hi = pathPoint(path, v + 0.001)
    const around = support(y, th + 0.012).p,
      near = support(y, th - 0.012).p
    const radius = Math.max(
      0.04,
      Math.hypot(around[0] - near[0], around[1] - near[1], around[2] - near[2]) / (0.024 * a.h)
    )
    const dx = (hi[0] - lo[0]) * radius,
      dy = hi[1] - lo[1],
      len = Math.hypot(dx, dy) || 1
    const across = (u - 0.5) * width(v),
      angle = th + (across * dy) / (len * radius)
    const level = Math.min(top(angle) - 0.0012, y - (across * dx) / len)
    const bend = 0.0016 * Math.sin(u * Math.PI) + 0.0006 * Math.sin(Math.PI * u * 3)
    const clearance = opening ? step(opening(angle) - 0.01, opening(angle) + 0.003, level) : 1
    const d = support(level, angle, mix(-0.016, lift(v) + bend, clearance))
    const yarn =
      u < 0.13
        ? stitch
        : u > 0.87
          ? tint(colour, stitch, 0.33)
          : shade(colour, 0.96 + 0.04 * Math.sin(u * Math.PI))
    return [d.p, d.w, yarn, clothUV(bolts, v * 4.6, 0.13 + 0.7 * u)]
  })
}
export function wrapCollar(a, support, c, style, opening) {
  const formal = style === 'silk',
    ground = formal ? tint(c.mint, c.cream, 0.6) : tint(c.blush, c.cream, 0.58)
  // A short standing collar on the merchant, a softer low shawl-cut collar
  // on the player. The two fronts close to the wearer's right.
  const top = (th) => {
    const angle = Math.atan2(Math.sin(th), Math.cos(th))
    return formal
      ? 1.446 - 0.022 * bell(angle, -0.14, 0.49) + 0.002 * Math.cos(th + 1.1)
      : 1.423 - 0.044 * bell(angle, -0.2, 0.77) + 0.003 * Math.sin(th)
  }
  const base = (th) =>
    opening ? opening(th) - 0.007 : 1.245 + 0.113 * (1 - Math.max(0, Math.cos(th)) ** 2)
  a.satin.patch(56, 14, (u, v) => {
    const th = (u - 0.5) * turn,
      level = mix(base(th), top(th), v),
      d = support(level, th, 0.0038 + 0.0007 * Math.cos(th * 2 + 0.2) * Math.sin(v * Math.PI))
    const colour = tint(ground, formal ? c.jade : c.blush, (formal ? 0.095 : 0.12) * (1 - v))
    return [d.p, d.w, shade(colour, 1 - 0.032 * (1 - v)), clothUV(1, u * 5, 0.06 + 0.86 * v)]
  })
  // The upper fold turns back toward the wearer, so the edge has a real
  // visible thickness even at the grazing angle of a side portrait.
  a.satin.patch(54, 4, (u, v) => {
    const th = (u - 0.5) * turn,
      yy = top(th) - 0.002 * v
    const d = support(yy, th, mix(0.0038, 0.0012, v))
    return [d.p, d.w, tint(ground, c.cream, 0.32), clothUV(4, u * 5, 0.15 + 0.6 * v)]
  })
  const offsetTop = formal ? 0.0061 : 0.0051,
    over = formal ? 0.0084 : 0.0076
  const under = formal
    ? [
        [-2.75, 1.429],
        [-2.16, 1.43],
        [-1.56, 1.431],
        [-0.93, 1.419],
        [-0.56, 1.399],
        [-0.25, 1.376],
        [-0.045, 1.355],
        [0.032, 1.350],
      ]
    : [
        [-2.75, 1.407],
        [-2.1, 1.405],
        [-1.54, 1.407],
        [-0.92, 1.395],
        [-0.52, 1.378],
        [-0.25, 1.358],
        [-0.088, 1.354],
        [0.030, 1.347],
      ]
  const outer = formal
    ? [
        [Math.PI, 1.431],
        [2.52, 1.429],
        [1.82, 1.43],
        [1.21, 1.426],
        [0.74, 1.408],
        [0.39, 1.389],
        [0.12, 1.365],
        [-0.16, 1.336],
        [-0.42, 1.303],
        [-0.75, 1.271],
        [-1.02, 1.248],
      ]
    : [
        [Math.PI, 1.407],
        [2.45, 1.408],
        [1.79, 1.41],
        [1.18, 1.403],
        [0.7, 1.391],
        [0.33, 1.373],
        [0.03, 1.35],
        [-0.3, 1.323],
        [-0.6, 1.297],
        [-0.9, 1.271],
      ]
  facing(
    a,
    support,
    under,
    (v) => (formal ? 0.024 : 0.023) * (1 - 0.6 * step(0.77, 1, v)),
    () => offsetTop,
    tint(ground, formal ? c.jade : c.rose, formal ? 0.27 : 0.49),
    formal ? c.jade : c.rose,
    1,
    top,
    opening
  )
  facing(
    a,
    support,
    outer,
    (v) => (formal ? 0.028 : 0.026) * (1 - 0.3 * step(0.85, 1, v)),
    (v) => over + 0.001 * step(0.44, 0.85, v),
    formal ? c.cream : tint(c.cream, c.blush, 0.22),
    formal ? tint(c.jade, c.cream, 0.32) : tint(c.plum, c.blush, 0.31),
    1,
    top,
    opening
  )
  if (formal) {
    // A silk toggle bridges the underlap of the bias collar on the right.
    const close = (u, v, arc) =>
      support(
        1.39 + 0.0027 * arc * Math.sin(v * Math.PI) + u * 0.00165,
        -0.76 + 0.37 * v,
        0.006 + 0.0011 * Math.cos(u * Math.PI)
      )
    for (const arc of [-1, 1])
      a.satin.patch(3, 14, (u, v) => {
        const d = close(u, v, arc)
        return [d.p, d.w, tint(c.gold, c.cream, 0.37), clothUV(4, v, 0.18 + 0.69 * u)]
      })
    a.satin.patch(11, 6, (u, v) => {
      const s = Math.sin(Math.PI * v),
        th = -0.398 + 0.04 * Math.cos(u * turn) * s,
        level = 1.391 + 0.0035 * Math.cos(Math.PI * v)
      const d = support(level, th, 0.0081 + 0.0023 * Math.sin(u * turn) * s)
      return [d.p, d.w, c.gold, clothUV(1, u, 0.18 + 0.64 * v)]
    })
  }
}
