import * as T from 'three'
import { Mason, cross, generator, sub, unit } from './mesh.js'

export const tau = 2 * Math.PI
export const mix = (a, b, t) => a + (b - a) * t
export const limit = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
export function smooth(a, b, x) {
  const t = limit((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const rgb = (hex) => new T.Color(hex).toArray()
export const tint = (a, k) => a.map((c) => c * k)
export const blend = (a, b, t) => a.map((v, i) => mix(v, b[i], t))
export function hash(x, z, seed = 0) {
  const v = Math.sin(x * 127.1 + z * 311.7 + seed * 59.3) * 43758.545312
  return v - Math.floor(v)
}
export function noise(x, z, seed = 0, wrap = 4096) {
  const i = Math.floor(x),
    j = Math.floor(z),
    u = smooth(0, 1, x - i),
    v = smooth(0, 1, z - j)
  const h = (x, z) => hash(((x % wrap) + wrap) % wrap, ((z % wrap) + wrap) % wrap, seed)
  return mix(mix(h(i, j), h(i + 1, j), u), mix(h(i, j + 1), h(i + 1, j + 1), u), v)
}
// Landscape batches cover full geological formations, so distant ridges are
// independently culled. All positions stay in world space for the walker.
export class LandBatch extends Mason {
  finish() {
    for (const [m, g] of this.groups) {
      const geo = new T.BufferGeometry()
      for (const [name, data, k] of [
        ['position', g.p, 3],
        ['color', g.c, 3],
        ['normal', g.n, 3],
        ['uv', g.uv, 2],
      ])
        geo.setAttribute(name, new T.Float32BufferAttribute(data, k))
      geo.setIndex(g.ix)
      geo.computeBoundingSphere()
      const mesh = new T.Mesh(geo, m)
      mesh.castShadow = m.userData.cast !== false
      mesh.receiveShadow = m.userData.receive !== false
      this.scene.add(mesh)
    }
    this.groups.clear()
  }
}
export function panel(b, m, pts, colors, uv = null, normals = null) {
  const keep = []
  for (let i = 0; i < pts.length; i++)
    if (!keep.some((j) => Math.hypot(...sub(pts[j], pts[i])) < 0.000002)) keep.push(i)
  if (keep.length < 3) return
  const pts2 = keep.map((i) => pts[i]),
    g = b.group(m),
    off = g.c.length
  b.face(m, pts2, 1, uv && keep.map((i) => uv[i]), normals && keep.map((i) => normals[i]))
  for (let j = 0; j < keep.length; j++) for (let k = 0; k < 3; k++) g.c[off + 3 * j + k] = colors[keep[j]][k]
}
export function top(b, m, pts, col, uv = null, normals = null) {
  const n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))
  const colors = Array.isArray(col[0]) ? col : pts.map(() => col)
  if (n[1] < 0) panel(b, m, pts.toReversed(), colors.toReversed(), uv?.toReversed(), normals?.toReversed())
  else panel(b, m, pts, colors, uv, normals)
}
export function texel(bytes, size, srgb, repeat) {
  const tex = new T.DataTexture(bytes, size, size, T.RGBAFormat)
  tex.wrapS = tex.wrapT = T.RepeatWrapping
  tex.magFilter = T.LinearFilter
  tex.minFilter = T.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.repeat.setScalar(repeat)
  if (srgb) tex.colorSpace = T.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}
function repeatingSurface(kind) {
  const size = 256,
    c = new Uint8Array(size * size * 4),
    n = new Uint8Array(c.length),
    height = new Float32Array(size * size)
  const paving = kind === 'quay' || kind === 'brick' || kind === 'market'
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = z / size,
        k = x + z * size
      const coarse = noise(u * 4, v * 4, 2, 4),
        fine = noise(u * 32, v * 32, 4, 32),
        chip = hash(x, z, 5)
      let val = 0.74 + 0.11 * coarse + 0.09 * fine + 0.09 * chip,
        high = coarse * 0.16 + fine * 0.11 + chip * 0.045
      if (paving) {
        const freq = kind === 'quay' ? 6 : kind === 'brick' ? 12 : 8
        const sx = u * freq,
          sz = v * freq
        let tx,
          tz,
          dx,
          dz,
          w = 1,
          h = 1
        const jitter = (coarse - 0.5) * 0.028 + (fine - 0.5) * 0.011
        if (kind === 'brick') {
          const i = Math.floor(sx + jitter),
            j = Math.floor(sz + jitter)
          const mod = (((i - j) % 4) + 4) % 4
          tx = i - (mod === 1 ? 1 : 0)
          tz = j - (mod === 2 ? 1 : 0)
          w = mod < 2 ? 2 : 1
          h = mod < 2 ? 1 : 2
          dx = sx + jitter - tx
          dz = sz + jitter - tz
        } else {
          tz = Math.floor(sz + jitter)
          const shift = tz % 2 ? 0.83 : 0
          tx = Math.floor((sx + shift + jitter) / 2) * 2
          dx = sx + shift + jitter - tx
          dz = sz + jitter - tz
          w = 2
        }
        const joint = Math.min(dx, w - dx, dz, h - dz)
        const gap = smooth(0.013, 0.046, joint),
          bevel = 1 - smooth(0.03, 0.088, joint)
        const stone = hash(((tx % freq) + freq) % freq, ((tz % freq) + freq) % freq, 12)
        val =
          mix(0.39 + 0.13 * fine, 0.7 + 0.17 * stone + 0.075 * fine + 0.07 * chip, gap) + bevel * gap * 0.07
        high = 0.31 * gap + 0.13 * stone + 0.055 * fine + 0.032 * chip
      } else if (kind === 'cliff') {
        const bedding = noise(u * 8 + 0.4 * coarse, v * 24 + 1.7 * coarse, 6, 8)
        const seam = (1 - smooth(0.012, 0.065, Math.abs(bedding - 0.54))) * smooth(0.28, 0.75, fine)
        val = 0.69 + 0.17 * coarse + 0.1 * fine + 0.06 * chip + 0.072 * seam
        high = 0.2 * coarse + 0.12 * bedding + 0.045 * chip + 0.065 * seam
      }
      c[k * 4] = 255 * limit(val + 0.009 * coarse)
      c[k * 4 + 1] = 255 * limit(val)
      c[k * 4 + 2] = 255 * limit(val - 0.011 * coarse)
      c[k * 4 + 3] = 255
      height[k] = high
    }
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      const k = x + size * z
      const dx = height[((x + 1) % size) + size * z] - height[((x - 1 + size) % size) + size * z]
      const dz = height[x + size * ((z + 1) % size)] - height[x + size * ((z - 1 + size) % size)]
      const a = unit([-dx * 2.3, -dz * 2.3, 1])
      for (let i = 0; i < 3; i++) n[k * 4 + i] = (a[i] + 1) * 127.5
      n[k * 4 + 3] = 255
    }
  const repeat =
    kind === 'cliff'
      ? 0.067
      : kind === 'quay'
        ? 0.19
        : kind === 'brick'
          ? 0.285
          : kind === 'market'
            ? 0.25
            : 0.24
  return { map: texel(c, size, true, repeat), normalMap: texel(n, size, false, repeat) }
}
function pineBrush() {
  const size = 160,
    bytes = new Uint8Array(size * size * 4),
    rng = generator(40021)
  function stroke(x0, y0, x1, y1, w, c) {
    const dx = x1 - x0,
      dy = y1 - y0,
      ls = dx * dx + dy * dy || 1
    for (
      let y = Math.max(0, Math.floor(Math.min(y0, y1) - w));
      y <= Math.min(size - 1, Math.ceil(Math.max(y0, y1) + w));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(Math.min(x0, x1) - w));
        x <= Math.min(size - 1, Math.ceil(Math.max(x0, x1) + w));
        x++
      ) {
        const u = limit(((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / ls)
        const d = Math.hypot(x + 0.5 - x0 - u * dx, y + 0.5 - y0 - u * dy)
        const alpha = limit(w + 0.35 - d),
          k = (x + y * size) * 4
        if (!alpha) continue
        for (let i = 0; i < 3; i++) bytes[k + i] = mix(bytes[k + i], c[i], alpha)
        bytes[k + 3] = Math.min(255, bytes[k + 3] + 255 * alpha)
      }
  }
  const stem = (t) => [7 + 144 * t, 72 + 15 * Math.sin(t * 2.8) + 4 * Math.sin(t * 7.6)]
  for (let j = 0; j < 30; j++) {
    const p = stem(j / 30),
      q = stem((j + 1) / 30)
    stroke(...p, ...q, 1.37, [87, 97, 72])
  }
  const colors = [
    [83, 119, 92],
    [101, 138, 101],
    [115, 148, 108],
    [125, 151, 109],
    [70, 106, 88],
    [131, 157, 121],
  ]
  for (let j = 0; j < 55; j++) {
    const t = 0.04 + (0.92 * j) / 55,
      p = stem(t),
      sgn = j % 2 ? 1 : -1
    const reach = (18 + 41 * Math.sin(Math.PI * t) ** 0.72) * (0.66 + 0.43 * rng())
    const fx = Math.min(155, p[0] + (4 + 18 * rng()) * (1 - t * 0.42)),
      fy = p[1] + sgn * reach
    stroke(...p, fx, fy, 1.03, [85, 107, 80])
    for (let k = 0; k < 40; k++) {
      const f = k / 40,
        px = mix(p[0], fx, f),
        py = mix(p[1], fy, f)
      const len = 3.8 + 10.3 * (1 - f * 0.56) * (0.5 + 0.52 * rng()),
        a = sgn * (0.28 + 1.86 * rng()) - 0.13 + (0.56 * rng() - 0.28)
      stroke(
        px,
        py,
        px + len * Math.cos(a),
        py + len * Math.sin(a),
        0.7 + 0.41 * rng(),
        colors[Math.floor(rng() * colors.length)]
      )
    }
  }
  const tex = texel(bytes, size, true, 1)
  tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping
  return tex
}
export function landFinishes(m) {
  const mats = {}
  function make(name, paint, rough = 0.82, texture, shade = true) {
    const mat = new T.MeshStandardMaterial({
      name,
      color: paint,
      roughness: rough,
      side: T.DoubleSide,
      vertexColors: true,
      ...texture,
    })
    mat.userData.cast = shade
    m[name] = mats[name] = mat
    return mat
  }
  const cliff = repeatingSurface('cliff'),
    quay = repeatingSurface('quay'),
    brick = repeatingSurface('brick')
  const market = repeatingSurface('market'),
    grit = repeatingSurface('grit')
  for (const name of ['gorgeRock', 'rockStrake', 'mountainGranite', 'riverSilt']) {
    const mat = make(name, 0xffffff, 0.87, cliff, name !== 'mountainGranite')
    mat.normalScale.set(0.35, 0.35)
    mat.emissive.set(0x3b5365)
    mat.emissiveIntensity = 0.075
    if (name !== 'riverSilt') {
      mat.onBeforeCompile = (s) => {
        s.vertexShader =
          'varying vec3 outcropPos; varying float outcropUp;\n' +
          s.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\noutcropPos=position;outcropUp=abs(normal.y);'
          )
        s.fragmentShader =
          'varying vec3 outcropPos; varying float outcropUp;\n' +
          s.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
          vec3 q=outcropPos;float exposed=1.-smoothstep(.28,.80,outcropUp);
          float ox=q.x*.046+q.z*.067,fold=sin(ox)+.49*sin(q.z*.13-q.x*.029);
          float beds=fract(q.y*.181+fold*.49+.27*sin(q.x*.091+q.z*.07));
          float lip=1.-smoothstep(.015,.12,abs(beds-.53));
          float runs=texture2D(map,vec2(q.x*.114+q.z*.072+.006*q.y,q.y*.013)).r;
          float dark=1.-smoothstep(.38,.59,runs);
          float broken=smoothstep(.37,.65,runs);
          diffuseColor.rgb*=1.+exposed*(.09*(beds-.50)+.12*lip*broken-.17*dark);
          diffuseColor.rgb+=exposed*lip*broken*vec3(.005,.004,.003);
        `
          )
      }
    }
  }
  make('cliffQuartz', 0xffffff, 0.54, cliff, false).userData.noCollision = true
  make('cityPlinth', 0xffffff, 0.78, market)
  make('quayPaving', 0xffffff, 0.6, quay)
  make('laneBrickwork', 0xffffff, 0.72, brick)
  make('quayCoping', 0xffffff, 0.58, grit)
  make('upperGardens', 0xffffff, 0.9, grit)
  make('karstNeedle', 0xffffff, 0.91, grit, false)
  make('pineCrown', 0xffffff, 0.94, undefined, false).userData.noCollision = true
  const needles = make('pineBrush', 0xffffff, 0.91, { map: pineBrush() }, false)
  needles.alphaTest = 0.31
  needles.userData.noCollision = true
  make('mountainBark', 0xffffff, 0.88, grit)
  return mats
}
