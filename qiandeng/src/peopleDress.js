import * as T from 'three'
const tau = Math.PI * 2
export function facePaint() {
  const w = 256,
    h = 160,
    data = new Uint8Array(w * h * 4),
    sq = (x) => x * x
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const u = i / w,
        v = j / h,
        theta = (u - 0.25) * tau,
        sx = Math.sin(theta),
        front = Math.cos(theta)
      const brow = 0.65 + 0.18 * Math.max(0, front) - 0.055 * Math.abs(sx)
      const fringe = brow - 0.033 * Math.sin(5 * theta) - 0.02 * Math.sin(11 * theta)
      let col
      if (v > fringe || (front < -0.35 && v > 0.32) || (Math.abs(sx) > 0.84 && v > 0.51 && v < brow)) {
        const shine = 5 * Math.cos(37 * theta + v * 6) ** 2 + 5 * Math.max(0, Math.sin(v * 17))
        col = [34 + shine, 29 + shine * 0.8, 30 + shine * 0.65]
      } else {
        const warmth = 8 * Math.sin(v * Math.PI) + 6 * front
        col = [208 + warmth, 157 + warmth * 0.77, 119 + warmth * 0.62]
        function blot(x, y, rx, ry, ink, mul = 1) {
          const q = sq((sx - x) / rx) + sq((v - y) / ry)
          if (q >= 1 || front < 0.26) return
          const a = (1 - q) ** 1.35 * mul
          col = col.map((n, k) => n + (ink[k] - n) * a)
        }
        for (const sg of [-1, 1]) {
          blot(sg * 0.46, 0.43, 0.34, 0.09, [197, 132, 111], 0.22)
          const arc = 0.578 + 0.015 * Math.cos((sx - sg * 0.45) * 6) - sg * (sx - sg * 0.46) * 0.035
          blot(sg * 0.43, arc, 0.25, 0.02, [65, 43, 35], 0.96)
          const lid = 0.529 + 0.011 * Math.cos((sx - sg * 0.43) * 6)
          blot(sg * 0.44, lid, 0.238, 0.023, [53, 36, 32], 1)
          blot(sg * 0.44, lid - 0.008, 0.153, 0.011, [221, 193, 163], 0.88)
          blot(sg * 0.42, lid - 0.004, 0.061, 0.02, [43, 36, 31])
          blot(sg * 0.19, 0.448, 0.049, 0.009, [153, 99, 74], 0.7)
        }
        blot(0, 0.357, 0.224, 0.024, [133, 66, 60], 0.96)
        blot(0, 0.343, 0.144, 0.012, [198, 116, 94], 0.76)
        blot(0, 0.467, 0.09, 0.088, [225, 173, 135], 0.39)
      }
      const off = (j * w + i) * 4
      for (let k = 0; k < 3; k++) data[off + k] = col[k]
      data[off + 3] = 255
    }
  const tex = new T.DataTexture(data, w, h)
  tex.colorSpace = T.SRGBColorSpace
  tex.magFilter = T.LinearFilter
  tex.minFilter = T.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}
export function robeShape(top) {
  const g = new T.BufferGeometry(),
    p = [],
    colors = [],
    index = [],
    uv = []
  const prof = top
    ? [
        [0.66, 0],
        [0.74, 0.08],
        [0.8, 0.23],
        [1, 0.77],
        [0.97, 0.88],
        [0.72, 0.97],
        [0.38, 1],
      ]
    : [
        [0.98, 0],
        [1, 0.038],
        [0.98, 0.09],
        [0.91, 0.4],
        [0.8, 0.7],
        [0.69, 1],
      ]
  const n = 32
  for (let j = 0; j < prof.length; j++)
    for (let i = 0; i <= n; i++) {
      const [r, y] = prof[j],
        a = (i * tau) / n
      const flute = Math.cos(a * (top ? 7 : 9) + (1 - y) * 0.8) + 0.32 * Math.sin(a * 14 + y * 1.1)
      const spread = top ? 0.033 : 0.064 * (1 - y) + 0.013
      const radius = r + flute * spread
      p.push(radius * Math.cos(a), y + (top ? 0 : 0.014 * (1 - y) * Math.cos(a * 5)), radius * Math.sin(a))
      const shade = (top ? 0.92 : 0.9) + flute * (top ? 0.048 : 0.12) * (1 - 0.45 * y)
      const hem = !top && j === 1
      colors.push(shade * (hem ? 1.25 : 1), shade * (hem ? 1.17 : 1), shade * (hem ? 0.96 : 1))
      uv.push(i / n, y)
      if (i < n && j < prof.length - 1) {
        const k = j * (n + 1) + i
        index.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2)
      }
    }
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3))
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

// Tapered crossed bands curve with the chest. A second narrow binding traces
// the edge of the overlap; the end disappears under the waist sash.
export function collar() {
  const p = [],
    c = [],
    uv = [],
    ix = []
  for (const [side, wide] of [
    [-1, 1],
    [1, 0.66],
  ]) {
    const path =
      side < 0
        ? [
            [-0.084, 0.99, 0.049],
            [-0.132, 0.9, 0.1],
            [-0.046, 0.75, 0.148],
            [0.055, 0.57, 0.168],
            [0.117, 0.4, 0.141],
            [0.145, 0.24, 0.105],
          ]
        : [
            [0.08, 0.99, 0.045],
            [0.121, 0.91, 0.099],
            [0.074, 0.82, 0.131],
            [0.014, 0.75, 0.146],
            [-0.042, 0.68, 0.151],
          ]
    const start = p.length / 3
    const shape = [
      [0, 0.66],
      [0.08, 0.74],
      [0.23, 0.8],
      [0.77, 1],
      [0.88, 0.97],
      [0.97, 0.72],
      [1, 0.38],
    ]
    path.forEach(([x, y], j) => {
      const hi = Math.max(
          1,
          shape.findIndex((q) => q[0] >= y)
        ),
        lo = hi - 1,
        f = (y - shape[lo][0]) / (shape[hi][0] - shape[lo][0])
      const r = shape[lo][1] + f * (shape[hi][1] - shape[lo][1])
      for (const [d, lum] of [
        [-0.019, 0.68],
        [-0.01, 1.18],
        [0.03 * wide, 1],
        [0.034 * wide, 0.62],
      ]) {
        const xx = x + d,
          front = 0.178 * r * Math.sqrt(Math.max(0.025, 1 - (xx / (0.251 * r)) ** 2))
        p.push(xx, y, front + (side < 0 ? 0.017 : 0.01))
        c.push(lum, lum * 0.98, lum * 0.9)
        uv.push(d, y)
      }
      if (j < path.length - 1)
        for (let k = 0; k < 3; k++) {
          const a = start + j * 4 + k
          ix.push(a, a + 1, a + 4, a + 1, a + 5, a + 4)
        }
    })
  }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3))
  g.setAttribute('color', new T.Float32BufferAttribute(c, 3))
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
  g.setIndex(ix)
  g.computeVertexNormals()
  return g
}

function framework(draw) {
  const pos = [],
    uv = [],
    ix = []
  function link(a, b, r, sides = 5) {
    const A = new T.Vector3(...a),
      B = new T.Vector3(...b),
      axis = B.clone().sub(A).normalize()
    const across = new T.Vector3()
      .crossVectors(axis, Math.abs(axis.y) > 0.93 ? new T.Vector3(0, 0, 1) : new T.Vector3(0, 1, 0))
      .normalize()
    const other = new T.Vector3().crossVectors(axis, across),
      k = pos.length / 3
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < sides; i++) {
        const a = (i * tau) / sides,
          p = (j ? B : A)
            .clone()
            .addScaledVector(across, r * Math.cos(a))
            .addScaledVector(other, r * Math.sin(a))
        pos.push(p.x, p.y, p.z)
        uv.push(i / sides, j)
      }
    for (let i = 0; i < sides; i++) {
      const n = (i + 1) % sides
      ix.push(k + i, k + n, k + sides + n, k + i, k + sides + n, k + sides + i)
    }
  }
  draw(link)
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
  g.setIndex(ix)
  g.computeVertexNormals()
  return g
}
export function parasolSpokes() {
  return framework((line) => {
    for (let i = 0; i < 20; i++) {
      const a = (i * tau) / 20
      const p = (r) => [Math.sin(a) * r, 0.45 * (1 - r ** 1.6) + 0.025 * r * r - 0.013, Math.cos(a) * r]
      line(p(0.035), p(0.53), 0.009)
      line(p(0.53), p(1), 0.007)
      if (i % 2 === 0) line([0, 0.02, 0], p(0.48), 0.01)
    }
  })
}
export function lanternBones() {
  return framework((line) => {
    function p(a, v) {
      const r = Math.sqrt(Math.max(0, 1 - v * v)) * 1.025
      return [r * Math.cos(a), v, r * Math.sin(a)]
    }
    for (let i = 0; i < 8; i++) {
      const a = (i * tau) / 8,
        vs = [-0.91, -0.58, 0.0, 0.58, 0.91]
      for (let j = 1; j < vs.length; j++) line(p(a, vs[j - 1]), p(a, vs[j]), 0.037)
      for (const y of [-0.78, 0.76]) line(p(a, y), p(((i + 1) * tau) / 8, y), 0.042)
    }
  })
}
export function feltHat() {
  const pos = [],
    color = [],
    uv = [],
    ix = [],
    bands = [
      [0.035, 0.59],
      [0.14, 0.46],
      [0.25, 0.32],
      [0.49, 0.09],
      [0.64, -0.07],
      [0.82, -0.22],
      [0.97, -0.34],
      [1, -0.42],
      [0.95, -0.48],
    ]
  const n = 24
  for (let j = 0; j < bands.length; j++)
    for (let i = 0; i <= n; i++) {
      const a = (i * tau) / n,
        [r, y] = bands[j],
        rib = i % 2 ? 0.98 : 1.02
      pos.push(Math.cos(a) * r * rib, y + 0.022 * Math.cos(9 * a) * r, Math.sin(a) * r * rib)
      const v = 0.88 + (0.13 * ((i + j) % 3)) / 2 + (j === 6 ? 0.13 : 0)
      color.push(v, v * (j === 7 ? 0.81 : 0.95), v * (j === 7 ? 0.6 : 0.81))
      uv.push(i / n, j / (bands.length - 1))
      if (i < n && j < bands.length - 1) {
        const k = j * (n + 1) + i
        ix.push(k, k + n + 2, k + 1, k, k + n + 1, k + n + 2)
      }
    }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new T.Float32BufferAttribute(color, 3))
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
  g.setIndex(ix)
  g.computeVertexNormals()
  return g
}

export function portrait() {
  const g = new T.SphereGeometry(1, 20, 15),
    p = g.attributes.position,
    t = g.attributes.uv
  for (let i = 0; i < p.count; i++) {
    const u = t.getX(i),
      v = t.getY(i),
      x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      front = Math.max(0, z)
    const jaw = 0.78 + 0.22 * Math.min(1, Math.max(0, (y + 0.82) / 0.72))
    let depth = (0.9 + 0.1 * Math.max(0, 1 - Math.abs(y + 0.12))) * z
    if (front > 0) {
      const form = (xx, yy, rx, ry) => Math.exp(-(((x - xx) / rx) ** 2 + ((y - yy) / ry) ** 2))
      depth +=
        (0.16 * form(0, 0.011, 0.126, 0.33) +
          0.21 * form(0, -0.13, 0.128, 0.12) +
          0.054 * form(0.43, -0.14, 0.24, 0.22) +
          0.054 * form(-0.43, -0.14, 0.24, 0.22) -
          0.055 * form(0.41, 0.11, 0.24, 0.15) -
          0.055 * form(-0.41, 0.11, 0.24, 0.15) +
          0.05 * form(0, -0.41, 0.18, 0.12)) *
        front
    }
    p.setXYZ(i, x * jaw, y, depth - 0.04 * Math.max(0, -y))
  }
  g.computeVertexNormals()
  return g
}
export function sleeve() {
  const g = new T.LatheGeometry(
    [
      [0.48, -0.51],
      [0.78, -0.46],
      [0.94, -0.32],
      [0.96, -0.14],
      [1.0, 0.08],
      [1.13, 0.31],
      [1.18, 0.45],
      [1.17, 0.48],
      [0.84, 0.49],
    ].map((a) => new T.Vector2(...a)),
    12
  )
  const p = g.attributes.position,
    c = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i)),
      y = p.getY(i)
    const folds = 1 + 0.054 * Math.cos(6 * a + 0.85 * y),
      d = 0.9 + 0.09 * Math.cos(6 * a + 0.85 * y) + (y > 0.42 ? 0.12 : 0)
    p.setX(i, p.getX(i) * folds)
    p.setZ(i, p.getZ(i) * folds)
    c[i * 3] = d
    c[i * 3 + 1] = d * (y > 0.42 ? 0.94 : 1)
    c[i * 3 + 2] = d * (y > 0.42 ? 0.82 : 1)
  }
  g.setAttribute('color', new T.BufferAttribute(c, 3))
  g.computeVertexNormals()
  return g
}
export function wovenBrocade() {
  const w = 256,
    h = 192,
    data = new Uint8Array(w * h * 4),
    wrap = (x) => x - Math.floor(x)
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const u = i / w,
        v = j / h,
        row = Math.floor(v * 4),
        a = wrap(u * 10 + (row % 2) * 0.5) - 0.5,
        b = wrap(v * 4) - 0.5
      const x = Math.abs(a),
        d = Math.hypot(a, 0.9 * b),
        angle = Math.atan2(b, a)
      const petal = Math.abs(d - (0.17 + 0.06 * Math.cos(5 * angle)))
      const flower = Math.exp((-petal * petal) / 0.00083) + 0.43 * Math.exp(-((d - 0.052) ** 2) / 0.0005)
      const sprig =
        Math.exp(-((b - 0.3 * Math.cos(a * 4 + 0.7)) ** 2) / 0.0013) * Math.max(0, 1 - (x / 0.5) ** 2)
      const thread = 3 * Math.sin(i * 2.8) + 3 * Math.sin(j * 2.77) + 1.5 * Math.cos(i * 0.27 + j * 0.41)
      const tone = 202 + thread + 34 * flower + 16 * sprig
      const k = (j * w + i) * 4
      data[k] = tone + 4
      data[k + 1] = tone + 2
      data[k + 2] = tone - 2 - 4 * flower
      data[k + 3] = 255
    }
  const tex = new T.DataTexture(data, w, h)
  tex.colorSpace = T.SRGBColorSpace
  tex.wrapS = tex.wrapT = T.RepeatWrapping
  tex.minFilter = T.LinearMipmapLinearFilter
  tex.magFilter = T.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}
export function soleShade() {
  const g = new T.PlaneGeometry(1, 1)
  g.rotateX(-Math.PI / 2)
  const w = 48,
    rgba = new Uint8Array(w * w * 4)
  for (let v = 0; v < w; v++)
    for (let u = 0; u < w; u++) {
      const x = ((u + 0.5) / w) * 2 - 1,
        y = ((v + 0.5) / w) * 2 - 1,
        k = (v * w + u) * 4
      const density = Math.exp(-3.7 * (x * x + y * y)) * Math.max(0, 1 - x * x - y * y)
      rgba[k] = rgba[k + 1] = rgba[k + 2] = 255
      rgba[k + 3] = Math.round(255 * density)
    }
  const t = new T.DataTexture(rgba, w, w)
  t.magFilter = T.LinearFilter
  t.needsUpdate = true
  const mat = new T.MeshBasicMaterial({
    name: '鞋底接触影',
    map: t,
    color: 0x302832,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  return [g, mat]
}

export function cloudCollar() {
  const pos = [],
    rgb = [],
    uv = [],
    ix = [],
    n = 54,
    rows = [0, 0.31, 0.61, 0.83, 0.9, 0.96, 1]
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i <= n; i++) {
      const a = (i * tau) / n,
        v = rows[j],
        front = Math.cos(a),
        lobes = 0.5 + 0.5 * Math.cos(4 * a)
      const reach = 0.184 + 0.038 * lobes + 0.018 * Math.cos(8 * a)
      const x = Math.sin(a) * (0.065 + v * reach),
        z = front * (0.058 + v * (0.102 + 0.052 * lobes)) + 0.008
      const drape = 0.035 + 0.078 * lobes + 0.1 * Math.abs(front) ** 2
      pos.push(x, 0.045 - v * drape - 0.04 * v * v * lobes, z)
      const band = j === 4 || j === 6,
        bright = band ? 1.28 : 0.78 + 0.2 * Math.cos(a * 12) ** 2
      rgb.push(bright, bright * (band ? 0.83 : 0.97), bright * (band ? 0.53 : 0.9))
      uv.push(i / n, v)
      if (i < n && j < rows.length - 1) {
        const k = j * (n + 1) + i
        ix.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2)
      }
    }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new T.Float32BufferAttribute(rgb, 3))
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
  g.setIndex(ix)
  g.computeVertexNormals()
  return g
}
