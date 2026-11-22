import * as T from 'three'

export const white = [1, 1, 1]
export function tint(hex, light = 1) {
  const c = new T.Color(hex)
  return [c.r * light, c.g * light, c.b * light]
}
export function point(p, uv = [0.5, 0.5], color = white, closed = null) {
  return { p, uv, color, closed }
}
// Pole vertices and converging tapered strands can have a zero-area incident
// triangle. Every exported normal still needs a defined unit direction.
function unitNormals(geometry) {
  const normals = geometry.getAttribute('normal'),
    positions = geometry.getAttribute('position')
  const n = new T.Vector3(),
    p = new T.Vector3()
  for (let i = 0; i < normals.count; i++) {
    n.fromBufferAttribute(normals, i)
    if (n.lengthSq() < 1e-12) {
      if (i > 0) n.fromBufferAttribute(normals, i - 1)
      if (n.lengthSq() < 1e-12) {
        p.fromBufferAttribute(positions, i)
        n.set(p.x, p.y - 0.115, p.z + 0.01)
        if (n.lengthSq() < 1e-12) n.set(0, 1, 0)
      }
      n.normalize()
      normals.setXYZ(i, n.x, n.y, n.z)
    }
  }
}
function skinTangents(g) {
  g.computeTangents()
  const tangents = g.attributes.tangent,
    normal = g.attributes.normal,
    closed = g.morphAttributes.normal?.[0]
  const n = new T.Vector3(),
    t = new T.Vector3(),
    other = new T.Vector3(),
    common = new T.Vector3()
  for (let i = 0; i < tangents.count; i++) {
    n.fromBufferAttribute(normal, i).normalize()
    t.fromBufferAttribute(tangents, i)
    t.addScaledVector(n, -t.dot(n))
    if (!(t.lengthSq() > 1e-10)) {
      t.set(Math.abs(n.x) < 0.8 ? 1 : 0, Math.abs(n.x) < 0.8 ? 0 : 1, 0)
      t.addScaledVector(n, -t.dot(n))
    }
    t.normalize()
    if (closed) {
      other.fromBufferAttribute(closed, i).normalize()
      common.crossVectors(n, other)
      // glTF interpolates the two normals linearly. Their common tangent is
      // perpendicular throughout a blink, and its sign follows the painted UV.
      if (common.lengthSq() > 1e-11 && Math.abs(t.dot(other)) > 0.0001) {
        common.normalize()
        if (common.dot(t) < 0) common.negate()
        t.copy(common)
      }
    }
    tangents.setXYZW(i, t.x, t.y, t.z, tangents.getW(i) < 0 ? -1 : 1)
  }
}
export class PortraitMesh {
  constructor() {
    this.pos = []
    this.uv = []
    this.col = []
    this.index = []
    this.closed = []
    this.boundaryNormals = []
  }
  vertex(v) {
    const id = this.pos.length / 3
    this.pos.push(...v.p)
    this.uv.push(...v.uv)
    this.col.push(...v.color)
    if (v.closed) this.closed.push(...v.closed)
    if (v.normal) this.boundaryNormals.push([id, v.normal])
    return id
  }
  grid(nx, ny, sample, flip = false) {
    const start = this.pos.length / 3
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++) {
        this.vertex(sample(i / nx, j / ny, i, j))
      }
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = start + j * (nx + 1) + i,
          b = a + 1,
          c = a + nx + 1,
          d = c + 1
        if (flip) this.index.push(a, c, b, b, c, d)
        else this.index.push(a, b, c, c, b, d)
      }
  }
  geometry() {
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3))
    g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2))
    g.setIndex(this.index)
    g.computeVertexNormals()
    unitNormals(g)
    if (this.closed.length === this.pos.length) {
      const closed = new T.BufferGeometry()
      closed.setAttribute('position', new T.Float32BufferAttribute(this.closed, 3))
      closed.setIndex(g.index)
      closed.computeVertexNormals()
      unitNormals(closed)
      closed.attributes.position.name = '闭眼'
      closed.attributes.normal.name = '闭眼'
      g.morphAttributes.position = [closed.attributes.position]
      g.morphAttributes.normal = [closed.attributes.normal]
    }
    for (const [id, n] of this.boundaryNormals) {
      g.attributes.normal.setXYZ(id, ...n)
      g.morphAttributes.normal?.[0]?.setXYZ(id, ...n)
    }
    g.computeBoundingBox()
    g.computeBoundingSphere()
    return g
  }
  mesh(material, name) {
    const g = this.geometry()
    if (material.normalMap || material.userData.skin) skinTangents(g)
    const m = new T.Mesh(g, material)
    m.name = name
    return m
  }
}
export function sweep(mesh, coords, radius, color, n = 14, sides = 7, options = {}) {
  const curve = new T.CatmullRomCurve3(
    coords.map((p) => new T.Vector3(...p)),
    Boolean(options.loop),
    'centripetal'
  )
  const frames = curve.computeFrenetFrames(n, Boolean(options.loop))
  const centers = Array.from({ length: n + 1 }, (_, i) => curve.getPointAt(i / n))
  mesh.grid(sides, n, (u, v, i, j) => {
    const r = typeof radius === 'function' ? radius(v) : radius
    const [rx, ry] = Array.isArray(r) ? r : [r, r],
      a = u * 2 * Math.PI
    const pos = centers[j]
      .clone()
      .addScaledVector(frames.normals[j], rx * Math.cos(a))
      .addScaledVector(frames.binormals[j], ry * Math.sin(a))
    const c = typeof color === 'function' ? color(v, u) : color
    return point(pos.toArray(), options.uv ? options.uv(u, v, pos) : [u, v], c)
  })
}
export function ovoid(mesh, center, axes, color, nu = 16, nv = 10, rotate = 0) {
  mesh.grid(nu, nv, (u, v) => {
    const a = (u - 0.5) * 2 * Math.PI,
      b = (v - 0.5) * Math.PI,
      c = Math.cos(b)
    const x = axes[0] * Math.sin(a) * c,
      y = axes[1] * Math.sin(b),
      z = axes[2] * Math.cos(a) * c
    const p = [
      center[0] + Math.cos(rotate) * x - Math.sin(rotate) * y,
      center[1] + Math.sin(rotate) * x + Math.cos(rotate) * y,
      center[2] + z,
    ]
    return point(p, [u, v], typeof color === 'function' ? color(u, v) : color)
  })
}
