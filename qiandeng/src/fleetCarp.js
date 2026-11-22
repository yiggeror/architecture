import * as T from 'three'

const tau = 2 * Math.PI
const clamp = T.MathUtils.clamp
const mix = T.MathUtils.lerp

// One painted silk skin runs from the tail to the lips. Broken vermilion
// islands, overlapping gilded scales and a fine weave follow the volume.
export function carpSilk() {
  const w = 640,
    h = 256,
    bytes = new Uint8Array(w * h * 4),
    lit = new Uint8Array(w * h * 4)
  const patches = [
    [0.16, 0.04, 0.084, 0.135],
    [0.33, 0.944, 0.125, 0.132],
    [0.5, 0.082, 0.105, 0.181],
    [0.72, 0.034, 0.1, 0.131],
    [0.85, 0.113, 0.06, 0.12],
    [0.245, 0.455, 0.17, 0.127],
    [0.419, 0.378, 0.088, 0.164],
    [0.635, 0.51, 0.14, 0.12],
    [0.861, 0.457, 0.071, 0.14],
  ]
  const smokeSpots = [
    [0.205, 0.59, 0.059, 0.09],
    [0.62, 0.81, 0.057, 0.14],
    [0.465, 0.16, 0.055, 0.064],
    [0.34, 0.035, 0.047, 0.072],
    [0.68, 0.492, 0.036, 0.06],
  ]
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const u = i / w,
        v = j / h,
        sy = Math.sin(v * tau)
      const wobble = 0.012 * Math.sin(v * tau * 5 + u * 11) + 0.012 * Math.cos(u * 51 + v * tau * 2)
      let pigment =
        clamp((sy - 0.47) * 2.1, 0, 1) *
        clamp(0.48 + 0.72 * Math.sin(14 * u - 0.7) + 0.36 * Math.cos(29 * u), 0, 1)
      for (const [cx, cy, rx, ry] of patches) {
        const py = Math.min(Math.abs(v - cy), 1 - Math.abs(v - cy))
        const d = ((u - cx + wobble) / rx) ** 2 + ((py + 0.025 * Math.sin(u * 41)) / ry) ** 2
        pigment = Math.max(pigment, clamp((1 - d) * 5, 0, 1))
      }
      let charcoal = 0
      for (const [cx, cy, rx, ry] of smokeSpots)
        charcoal = Math.max(
          charcoal,
          clamp((1 - ((u - cx + wobble * 0.45) / rx) ** 2 - ((v - cy) / ry) ** 2) * 5, 0, 1)
        )
      const row = Math.floor(v * 26),
        yy = ((v * 26) % 1) - 0.5,
        xx = (u * 25 + (row % 2) * 0.5) % 1
      const arc = 0.14 + 0.69 * Math.sqrt(Math.max(0, 1 - 4 * yy * yy))
      const line =
        Math.exp(-((xx - arc) ** 2) / 0.003) * clamp((0.87 - u) * 25, 0, 1) * clamp((u - 0.04) * 17, 0, 1)
      const grain = 1.6 * Math.sin(i * 2.19) + 1.9 * Math.cos(j * 2.48) + 1.3 * Math.sin(i * 1.33 + j * 2.1)
      const k = (j * w + i) * 4
      const light = 0.965 + 0.032 * Math.cos(u * 12.4 + v * 10) - 0.12 * Math.max(0, -sy)
      const base = [mix(253, 199, pigment), mix(214, 44, pigment), mix(156, 35, pigment)].map((q, c) =>
        mix(q, [82, 68, 67][c], charcoal * 0.84)
      )
      const glow =
        0.44 +
        0.31 * Math.exp(-((u - 0.37) ** 2) / 0.033) +
        0.21 * Math.exp(-((u - 0.67) ** 2) / 0.012) +
        0.075 * (1 - sy)
      for (let c = 0; c < 3; c++) {
        bytes[k + c] = clamp(mix(base[c] * light, [133, 68, 35][c], line * 0.69) + grain, 0, 255)
        lit[k + c] = bytes[k + c] * glow
      }
      bytes[k + 3] = lit[k + 3] = 255
    }
  const texture = new T.DataTexture(bytes, w, h)
  texture.colorSpace = T.SRGBColorSpace
  texture.wrapT = T.RepeatWrapping
  texture.generateMipmaps = true
  texture.magFilter = T.LinearFilter
  texture.minFilter = T.LinearMipmapLinearFilter
  texture.needsUpdate = true
  const lining = texture.clone()
  lining.source = new T.Source({ data: lit, width: w, height: h })
  lining.needsUpdate = true
  const mat = new T.MeshStandardMaterial({
    name: '锦鲤织绢',
    color: 0xffffff,
    map: texture,
    emissive: 0xffd6a9,
    emissiveMap: lining,
    emissiveIntensity: 0.96,
    roughness: 0.78,
    vertexColors: true,
    side: T.DoubleSide,
  })
  mat.userData.emitter = true
  return mat
}

export function cord(b, m, points, r, sides = 6) {
  for (let i = 1; i < points.length; i++) b.tube(m, points[i - 1], points[i], r, r, sides, 1, false)
}

export function oval(b, m, c, size, tint = 1, n = 12, rows = 7) {
  function p(i, j) {
    const a = (i * tau) / n,
      v = (j / rows - 0.5) * Math.PI
    return [
      c[0] + size[0] * Math.cos(v) * Math.cos(a),
      c[1] + size[1] * Math.sin(v),
      c[2] + size[2] * Math.cos(v) * Math.sin(a),
    ]
  }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < n; i++) {
      const a = p(i, j),
        d = p(i + 1, j),
        e = p(i + 1, j + 1),
        f = p(i, j + 1)
      const pts = j === 0 ? [f, e, a] : j === rows - 1 ? [d, a, f] : [a, f, e, d]
      b.face(
        m,
        pts,
        tint,
        null,
        pts.map((pt) => {
          const v = pt.map((x, k) => (x - c[k]) / (size[k] * size[k])),
            l = Math.hypot(...v)
          return v.map((x) => x / l)
        })
      )
    }
}

const rings = [
  [-3.34, 0.14, 0.23, 2.56],
  [-3, 0.25, 0.38, 2.52],
  [-2.35, 0.51, 0.66, 2.56],
  [-1.55, 0.76, 0.89, 2.66],
  [-0.6, 0.94, 1.06, 2.78],
  [0.36, 1.01, 1.11, 2.9],
  [1.22, 0.98, 1.02, 3.01],
  [1.92, 0.88, 0.85, 3.13],
  [2.57, 0.71, 0.64, 3.24],
  [3, 0.51, 0.43, 3.32],
  [3.34, 0.27, 0.245, 3.36],
  [3.53, 0.105, 0.095, 3.37],
]
function shell(z, a, grow = 0) {
  const hi = Math.max(
      1,
      rings.findIndex((r) => r[0] >= z)
    ),
    left = rings[hi - 1],
    right = rings[hi]
  const t = clamp((z - left[0]) / (right[0] - left[0]), 0, 1),
    rx = mix(left[1], right[1], t),
    ry = mix(left[2], right[2], t)
  return [
    0.16 * Math.sin(z * 0.87) + (rx + grow) * Math.cos(a),
    mix(left[3], right[3], t) + (ry + grow) * Math.sin(a),
    z,
  ]
}
function shellNormal(z, a) {
  const p = shell(z, a),
    q = shell(Math.min(3.53, z + 0.004), a),
    r = shell(z, a + 0.004)
  if (z > 3.525) return [Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.83]
  const u = q.map((x, i) => x - p[i]),
    v = r.map((x, i) => x - p[i])
  const n = [v[1] * u[2] - v[2] * u[1], v[2] * u[0] - v[0] * u[2], v[0] * u[1] - v[1] * u[0]],
    l = Math.hypot(...n)
  return n.map((x) => x / l)
}
function flowing(b, m, points, r, end = r) {
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)))
  const n = Math.max(8, (points.length - 1) * 3),
    ps = curve.getPoints(n)
  for (let i = 1; i < ps.length; i++)
    b.tube(m, ps[i - 1].toArray(), ps[i].toArray(), mix(r, end, (i - 1) / n), mix(r, end, i / n), 6, 1, false)
}
function fan(b, m, root, outline, offset = 0) {
  const spine = new T.CatmullRomCurve3(outline.map((p) => new T.Vector3(...p)))
  const count = (outline.length - 1) * 3,
    radials = [0, 0.42, 0.76, 0.91, 1]
  function silk(s, r) {
    const edge = spine.getPoint(clamp(s, 0, 1))
    return [
      mix(root[0], edge.x, r) + offset * Math.sin(r * Math.PI) * (1 + 0.3 * Math.sin(s * 18)),
      mix(root[1], edge.y, r) + 0.044 * Math.sin(r * Math.PI + s * 2) * r,
      mix(root[2], edge.z, r),
    ]
  }
  for (let i = 0; i < count; i++) {
    const a = i / count,
      d = (i + 1) / count
    for (let j = 0; j < radials.length - 1; j++) {
      const r = radials[j],
        v = radials[j + 1],
        q = silk(a, r),
        t = silk(d, r),
        u = silk(d, v),
        w = silk(a, v)
      const pale = j >= 2 && (Math.floor(i / 3) + j) % 6 === 2
      const tone = 0.72 + 0.2 * Math.sin(i * 0.53 + j * 0.31) ** 2
      b.face(
        pale ? m.paper : m.redSilk,
        j === 0 ? [q, u, w] : [q, t, u, w],
        pale ? [0.92, 0.56, 0.3] : [tone, 0.63 + 0.19 * v, 0.52 + 0.18 * v]
      )
    }
  }
  for (let j = 0; j < outline.length; j++) {
    const s = j / (outline.length - 1)
    const pts = radials.map((r) => silk(s, r))
    flowing(b, m.gold, pts, j === 0 || j === outline.length - 1 ? 0.024 : 0.015, 0.008)
  }
  flowing(b, m.bronze, outline, 0.018, 0.012)
}

export function buildCarp(b, m, silk) {
  const n = 33,
    around = 28
  for (let k = 0; k < n; k++)
    for (let j = 0; j < around; j++) {
      const u = k / n,
        v = (k + 1) / n,
        a = (j * tau) / around,
        d = ((j + 1) * tau) / around
      const z = mix(-3.34, 3.53, u),
        w = mix(-3.34, 3.53, v)
      const qs = [
        [z, a],
        [z, d],
        [w, d],
        [w, a],
      ]
      b.face(
        silk,
        qs.map((q) => shell(...q)),
        1,
        [
          [u, j / around],
          [u, (j + 1) / around],
          [v, (j + 1) / around],
          [v, j / around],
        ],
        qs.map((q) => shellNormal(...q))
      )
    }
  for (const z of [-2.88, -1.75, -0.45, 0.84, 1.83, 2.72]) {
    const hoop = Array.from({ length: 29 }, (_, j) => shell(z, (j * tau) / 28, 0.012))
    cord(b, m.bronze, hoop, 0.014, 5)
  }
  for (const sign of [-1, 1]) {
    // Gill cover, nostril and layered glass eye sit on the actual flank.
    const az = (t) => (sign > 0 ? t : Math.PI - t)
    const lid = Array.from({ length: 12 }, (_, j) => {
      const t = j / 11
      return shell(1.79 + 0.55 * (t - 0.5) ** 2 * 4, az(0.84 - 1.85 * t), 0.035)
    })
    flowing(b, m.vermilion, lid, 0.027, 0.014)
    const trace = lid.slice(2, 9).map(([x, y, z]) => [x + sign * 0.012, y - 0.057, z + 0.126])
    flowing(b, m.gold, trace, 0.019, 0.009)
    const eye = shell(2.43, az(0.33), 0.045)
    oval(b, m.vermilion, eye, [0.086, 0.213, 0.246], 0.74, 16)
    oval(b, m.gold, [eye[0] + sign * 0.08, eye[1] + 0.008, eye[2] + 0.016], [0.062, 0.174, 0.194], 1, 16)
    oval(b, m.ink, [eye[0] + sign * 0.125, eye[1] + 0.011, eye[2] + 0.047], [0.048, 0.105, 0.107], 1, 14)
    oval(b, m.pearl, [eye[0] + sign * 0.172, eye[1] + 0.068, eye[2] + 0.092], [0.021, 0.036, 0.038])
    const nostril = shell(3.02, az(0.59), 0.015)
    oval(b, m.ink, nostril, [0.045, 0.049, 0.071])
    const x = sign
    const dots = [
      [0.26, 3.34, 3.41],
      [0.56, 3.22, 3.65],
      [0.81, 3.11, 3.91],
      [1.12, 3.12, 4.17],
      [1.19, 3.26, 4.33],
      [1.12, 3.34, 4.38],
      [1.03, 3.35, 4.34],
    ]
    flowing(
      b,
      m.gold,
      dots.map(([a, y, z]) => [a * x, y, z]),
      0.032,
      0.006
    )
    const fins = [
      [0.86, 2.58, 1.46],
      [1.28, 2.48, 1.25],
      [1.69, 2.25, 0.89],
      [1.85, 2.01, 0.43],
      [1.73, 1.82, 0.16],
      [1.5, 1.76, 0.06],
      [1.24, 2.06, 0.37],
      [0.94, 2.42, 0.69],
    ]
    fan(
      b,
      m,
      [0.82 * x, 2.65, 1.59],
      fins.map(([a, y, z]) => [a * x, y, z]),
      0.055 * x
    )
  }
  oval(b, m.vermilion, [0.01, 3.352, 3.48], [0.224, 0.125, 0.105], 0.87)
  oval(b, m.ink, [0.01, 3.365, 3.562], [0.158, 0.052, 0.032])
  const lips = Array.from({ length: 19 }, (_, i) => [
    0.01 + 0.183 * Math.cos((i * tau) / 18),
    3.357 + 0.073 * Math.sin((i * tau) / 18),
    3.574 + 0.011 * Math.cos((i * tau) / 9),
  ])
  cord(b, m.vermilion, lips, 0.024)
  fan(
    b,
    m,
    [-0.06, 2.59, -3.06],
    [
      [-0.03, 2.87, -3.32],
      [-0.28, 3.56, -3.72],
      [-0.49, 4.29, -4.27],
      [-0.58, 4.67, -4.82],
      [-0.56, 4.3, -4.78],
      [-0.36, 3.69, -4.67],
      [-0.14, 3.11, -4.44],
      [0.04, 2.85, -4.05],
      [0.2, 2.45, -4.51],
      [0.38, 2.04, -4.88],
      [0.46, 1.64, -4.94],
      [0.4, 1.73, -4.57],
      [0.26, 1.86, -4.1],
      [0.1, 2.12, -3.52],
      [0.04, 2.42, -3.26],
    ],
    0.09
  )
  fan(
    b,
    m,
    [0.05, 3.7, 0.15],
    [
      [0.06, 3.99, 1.17],
      [0.12, 4.54, 1.09],
      [0.02, 4.39, 0.59],
      [-0.07, 4.66, 0.04],
      [-0.16, 4.55, -0.28],
      [-0.26, 4.56, -0.7],
      [-0.26, 4.13, -1.1],
      [-0.34, 4.12, -1.52],
      [-0.36, 3.91, -1.85],
      [-0.31, 3.57, -2.12],
      [-0.24, 3.36, -2.33],
    ],
    0.055
  )
}
