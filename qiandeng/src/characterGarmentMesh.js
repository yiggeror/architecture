import * as T from 'three'

export const turn = 2 * Math.PI
export const clip = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const mix = (a, b, t) => a + (b - a) * t
export const step = (a, b, x) => {
  const t = clip((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const between = (a, b, t) => a.map((v, i) => mix(v, b[i], t))
export const tint = (c, d, t) => between(c, d, t)
export const shade = (c, s) => c.map((v) => v * s)
export const linear = (hex) => new T.Color(hex).toArray()
export function sample(table, x) {
  if (x <= table[0][0]) return table[0].slice(1)
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1],
      b = table[i]
    if (x <= b[0]) return between(a.slice(1), b.slice(1), (x - a[0]) / (b[0] - a[0]))
  }
  return table.at(-1).slice(1)
}
export function weights(a, b, t) {
  return { [a]: 1 - clip(t), [b]: clip(t) }
}
export function addWeights(base, joint, t) {
  const result = {}
  for (const name in base) result[name] = base[name] * (1 - t)
  result[joint] = (result[joint] || 0) + t
  return result
}

// Actor-space positions bind at identity, retaining a single draw for every
// piece cut from the same surface finish, including piping and knotted fasteners.
export class GarmentMesh {
  constructor(rig, material, name) {
    Object.assign(this, {
      rig,
      material,
      name,
      positions: [],
      colors: [],
      uvs: [],
      joints: [],
      weights: [],
      indices: [],
      uvCopies: new Map(),
    })
  }
  v(p, w, c, uv = [0, 0]) {
    const id = this.positions.length / 3
    this.positions.push(...p)
    // glTF COLOR_0 stores reflectance or opacity, both in the unit interval.
    this.colors.push(...c.map((v) => clip(v)))
    this.uvs.push(...uv)
    const influences = Object.entries(w)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
    const sum = influences.reduce((s, a) => s + a[1], 0) || 1
    for (let k = 0; k < 4; k++) {
      this.joints.push(influences[k] ? this.rig.index[influences[k][0]] : 0)
      this.weights.push(influences[k] ? influences[k][1] / sum : 0)
    }
    return id
  }
  repeatAt(i, near) {
    const delta = Math.round(near - this.uvs[2 * i])
    if (delta === 0) return i
    const key = i + ',' + delta
    if (this.uvCopies.has(key)) return this.uvCopies.get(key)[1]
    const v = this.positions.length / 3
    this.positions.push(...this.positions.slice(i * 3, i * 3 + 3))
    this.colors.push(...this.colors.slice(i * 3, i * 3 + 3))
    this.uvs.push(this.uvs[i * 2] + delta, this.uvs[i * 2 + 1])
    this.joints.push(...this.joints.slice(i * 4, i * 4 + 4))
    this.weights.push(...this.weights.slice(i * 4, i * 4 + 4))
    this.uvCopies.set(key, [i, v])
    return v
  }
  quad(a, b, c, d, flip = false) {
    const ua = this.uvs[2 * a],
      ub = this.uvs[2 * b],
      uc = this.uvs[2 * c],
      ud = this.uvs[2 * d]
    const high = Math.max(ua, ub, uc, ud)
    if (high - Math.min(ua, ub, uc, ud) > 1.24) {
      a = this.repeatAt(a, high)
      b = this.repeatAt(b, high)
      c = this.repeatAt(c, high)
      d = this.repeatAt(d, high)
    }
    if (flip) this.indices.push(a, d, b, b, d, c)
    else this.indices.push(a, b, d, b, c, d)
  }
  strip(a, b, flip = false, closed = true) {
    for (let j = 0; j < a.length - (closed ? 0 : 1); j++) {
      const k = (j + 1) % a.length
      this.quad(a[j], a[k], b[k], b[j], flip)
    }
  }
  patch(nu, nv, fn, flip = false) {
    let last
    for (let i = 0; i <= nv; i++) {
      const row = []
      for (let j = 0; j <= nu; j++) row.push(this.v(...fn(j / nu, i / nv)))
      if (last) this.strip(last, row, flip, false)
      last = row
    }
  }
  finish() {
    if (!this.indices.length) return null
    const geo = new T.BufferGeometry()
    geo.setAttribute('position', new T.Float32BufferAttribute(this.positions, 3))
    geo.setAttribute('color', new T.Float32BufferAttribute(this.colors, 3))
    geo.setAttribute('uv', new T.Float32BufferAttribute(this.uvs, 2))
    geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(this.joints, 4))
    geo.setAttribute('skinWeight', new T.Float32BufferAttribute(this.weights, 4))
    geo.setIndex(this.indices)
    geo.computeVertexNormals()
    const normals = geo.getAttribute('normal'),
      mean = new T.Vector3(),
      other = new T.Vector3()
    for (const [i, j] of this.uvCopies.values()) {
      mean.fromBufferAttribute(normals, i).add(other.fromBufferAttribute(normals, j)).normalize()
      normals.setXYZ(i, mean.x, mean.y, mean.z)
      normals.setXYZ(j, mean.x, mean.y, mean.z)
    }
    // A collapsed dart tip or an unused vertex within the sleeve aperture must
    // still carry an orthonormal tangent frame in an exported glTF accessor.
    for (let i = 0; i < normals.count; i++) {
      mean.fromBufferAttribute(normals, i)
      if (!(mean.lengthSq() > 1e-10)) normals.setXYZ(i, 0, 1, 0)
    }
    if (this.material.normalMap) {
      geo.computeTangents()
      const tangents = geo.getAttribute('tangent')
      for (let i = 0; i < tangents.count; i++) {
        mean.fromBufferAttribute(normals, i).normalize()
        other.fromBufferAttribute(tangents, i)
        other.addScaledVector(mean, -other.dot(mean))
        if (!Number.isFinite(other.lengthSq()) || other.lengthSq() < 1e-10) {
          if (Math.abs(mean.x) < 0.8) other.set(1, 0, 0)
          else other.set(0, 1, 0)
          other.addScaledVector(mean, -other.dot(mean))
        }
        other.normalize()
        tangents.setXYZW(i, other.x, other.y, other.z, tangents.getW(i) < 0 ? -1 : 1)
      }
    }
    geo.computeBoundingSphere()
    const mesh = new T.SkinnedMesh(geo, this.material)
    mesh.name = this.name
    mesh.bind(this.rig.skeleton, new T.Matrix4())
    mesh.frustumCulled = false
    return mesh
  }
}
