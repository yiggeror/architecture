import * as T from 'three'

export function generator(seed) {
  let state = seed >>> 0
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296
}
export const rng = generator(81426)
export const between = (a, b) => a + (b - a) * rng()
export const v = (x, y, z) => [x, y, z]
export const add = (a, b) => a.map((x, i) => x + b[i])
export const sub = (a, b) => a.map((x, i) => x - b[i])
export const scaled = (a, s) => a.map((x) => x * s)
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const unit = (a) => scaled(a, 1 / (Math.hypot(...a) || 1))
export const lerp3 = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t)

// Cull a roof or a tree on the opposite shore before sending its vertices to
// the GPU. Keep vertices local to a cell so collision, shadows and the low-cost
// moving view use the same, tight spatial bounds.
function spatialBatches(geometry, reduced) {
  const ix = geometry.index.array
  if (ix.length < 24000) return [{ geometry, reduced }]
  const positions = geometry.attributes.position.array,
    cells = new Map()
  function cellAt(a, b, c) {
    const x = (positions[a * 3] + positions[b * 3] + positions[c * 3]) / 3
    const z = (positions[a * 3 + 2] + positions[b * 3 + 2] + positions[c * 3 + 2]) / 3
    return Math.floor((x + 5) / 27) + Math.floor((z + 4) / 27) * 256
  }
  function distribute(indices, simple) {
    for (let j = 0; j < indices.length; j += 3) {
      const a = indices[j],
        b = indices[j + 1],
        c = indices[j + 2],
        key = cellAt(a, b, c)
      let cell = cells.get(key)
      if (!cell) {
        cell = { remap: new Map(), vertices: [], full: [], low: [] }
        cells.set(key, cell)
      }
      const target = simple ? cell.low : cell.full
      for (const vertex of [a, b, c]) {
        let local = cell.remap.get(vertex)
        if (local === undefined) {
          local = cell.vertices.length
          cell.vertices.push(vertex)
          cell.remap.set(vertex, local)
        }
        target.push(local)
      }
    }
  }
  distribute(ix, false)
  if (cells.size < 2) return [{ geometry, reduced }]
  if (reduced) distribute(reduced.index.array, true)
  const chunks = []
  for (const cell of cells.values()) {
    if (!cell.full.length) continue
    const geo = new T.BufferGeometry()
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      const stride = attribute.itemSize,
        source = attribute.array,
        copy = new Float32Array(cell.vertices.length * stride)
      for (let j = 0; j < cell.vertices.length; j++) {
        const old = cell.vertices[j] * stride
        for (let k = 0; k < stride; k++) copy[j * stride + k] = source[old + k]
      }
      geo.setAttribute(name, new T.BufferAttribute(copy, stride))
    }
    geo.setIndex(cell.full)
    geo.computeBoundingBox()
    geo.computeBoundingSphere()
    let low
    if (reduced) {
      low = new T.BufferGeometry()
      for (const [name, attribute] of Object.entries(geo.attributes)) low.setAttribute(name, attribute)
      low.setIndex(cell.low)
      low.boundingBox = geo.boundingBox
      low.boundingSphere = geo.boundingSphere
    }
    chunks.push({ geometry: geo, reduced: low })
  }
  return chunks
}

// Assemble static surfaces by finish, then split large assemblies for spatial culling.
export class Mason {
  constructor(scene) {
    this.scene = scene
    this.groups = new Map()
    this.frame = [0, 0, 0, 1, 0]
    this.unitScale = 1
  }
  at(x, y, z, angle, fn) {
    const old = this.frame,
      p = this.point([x, y, z]),
      c = Math.cos(angle),
      s = Math.sin(angle)
    this.frame = [...p, old[3] * c - old[4] * s, old[4] * c + old[3] * s]
    fn()
    this.frame = old
  }
  scaleBy(factor, fn) {
    const old = this.unitScale
    this.unitScale *= factor
    fn()
    this.unitScale = old
  }
  point(p) {
    const [x, y, z, c, s] = this.frame,
      k = this.unitScale
    return [x + k * (c * p[0] + s * p[2]), y + k * p[1], z + k * (-s * p[0] + c * p[2])]
  }
  group(m) {
    if (!this.groups.has(m)) this.groups.set(m, { p: [], n: [], uv: [], c: [], ix: [] })
    return this.groups.get(m)
  }
  face(m, points, tint = 1, uvs = null, normals = null) {
    const g = this.group(m),
      pts = points.map((p) => this.point(p)),
      start = g.p.length / 3
    const n = unit(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])))
    const rgb = Array.isArray(tint) ? tint : [tint, tint, tint]
    const ax = Math.abs(n[0]),
      ay = Math.abs(n[1]),
      az = Math.abs(n[2])
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      g.p.push(...p)
      if (normals) {
        const [lx, ly, lz] = normals[i]
        const c = this.frame[3],
          s = this.frame[4]
        g.n.push(c * lx + s * lz, ly, -s * lx + c * lz)
      } else g.n.push(...n)
      const uv = uvs ? uvs[i] : ay > ax && ay > az ? [p[0], p[2]] : ax > az ? [p[2], p[1]] : [p[0], p[1]]
      g.uv.push(uv[0], uv[1])
      g.c.push(...rgb)
    }
    for (let k = 1; k < pts.length - 1; k++) g.ix.push(start, start + k, start + k + 1)
  }
  box(m, x, y, z, w, h, d, tint = 1) {
    const l = x - w / 2,
      r = x + w / 2,
      b = y - h / 2,
      t = y + h / 2,
      f = z + d / 2,
      k = z - d / 2
    const a = [l, b, f],
      bb = [r, b, f],
      c = [r, t, f],
      dd = [l, t, f],
      e = [l, b, k],
      ff = [r, b, k],
      g = [r, t, k],
      hh = [l, t, k]
    this.face(m, [a, bb, c, dd], tint)
    this.face(m, [ff, e, hh, g], tint)
    this.face(m, [bb, ff, g, c], tint)
    this.face(m, [e, a, dd, hh], tint)
    this.face(m, [dd, c, g, hh], tint)
    this.face(m, [e, ff, bb, a], tint)
  }
  // A rectangular member with local grain following the long axis.
  beam(m, a, b, w, d = w, tint = 1) {
    const dir = unit(sub(b, a)),
      side = unit(cross(Math.abs(dir[1]) > 0.94 ? [0, 0, 1] : [0, 1, 0], dir)),
      up = unit(cross(dir, side))
    const off = [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ].map(([j, k]) => add(scaled(side, (j * w) / 2), scaled(up, (k * d) / 2)))
    const lo = off.map((o) => add(a, o)),
      hi = off.map((o) => add(b, o))
    const length = Math.hypot(...sub(b, a))
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4
      this.face(m, [lo[j], lo[k], hi[k], hi[j]], tint, [
        [0, 0],
        [w, 0],
        [w, length],
        [0, length],
      ])
    }
    this.face(m, lo.slice().reverse(), tint)
    this.face(m, hi, tint)
  }
  tube(m, a, b, ra, rb = ra, count = 9, tint = 1, caps = true) {
    const dir = unit(sub(b, a)),
      side = unit(cross(Math.abs(dir[1]) > 0.91 ? [0, 0, 1] : [0, 1, 0], dir)),
      up = unit(cross(dir, side))
    const lo = [],
      hi = [],
      ns = [],
      len = Math.hypot(...sub(b, a))
    for (let j = 0; j < count; j++) {
      const t = (j * 2 * Math.PI) / count,
        r = add(scaled(side, Math.cos(t)), scaled(up, Math.sin(t)))
      ns.push(unit(add(r, scaled(dir, (ra - rb) / Math.max(len, 0.00001)))))
      lo.push(add(a, scaled(r, ra)))
      hi.push(add(b, scaled(r, rb)))
    }
    for (let j = 0; j < count; j++) {
      const k = (j + 1) % count
      const u = (j / count) * 2 * Math.PI * ra,
        un = ((j + 1) / count) * 2 * Math.PI * ra
      this.face(
        m,
        [lo[j], lo[k], hi[k], hi[j]],
        tint,
        [
          [u, 0],
          [un, 0],
          [un, len],
          [u, len],
        ],
        [ns[j], ns[k], ns[k], ns[j]]
      )
    }
    if (caps) {
      this.face(m, lo.slice().reverse(), tint)
      this.face(m, hi, tint)
    }
  }
  markLeaf(material) {
    const batch = this.group(material)
    ;(batch.leaves ??= []).push(batch.ix.length)
  }
  finish() {
    for (const [m, g] of this.groups) {
      const geo = new T.BufferGeometry()
      for (const [name, arr, stride] of [
        ['position', g.p, 3],
        ['normal', g.n, 3],
        ['color', g.c, 3],
        ['uv', g.uv, 2],
      ])
        geo.setAttribute(name, new T.Float32BufferAttribute(arr, stride))
      geo.setIndex(g.ix)
      geo.computeBoundingSphere()
      let motionGeometry
      if (g.leaves || ['bark', 'bamboo', 'roofEdge'].includes(m.name)) {
        const leafStarts = new Set(g.leaves),
          triangles = [],
          ix = g.ix,
          pos = g.p
        let leafNumber = 0
        for (let j = 0; j < ix.length; ) {
          if (leafStarts.has(j)) {
            if (leafNumber++ % 4 !== 3)
              triangles.push(ix[j], ix[j + 1], ix[j + 5], ix[j], ix[j + 5], ix[j + 8])
            j += 12
            continue
          }
          const a = ix[j] * 3,
            c = ix[j + 1] * 3,
            d = ix[j + 2] * 3
          const x1 = pos[c] - pos[a],
            y1 = pos[c + 1] - pos[a + 1],
            z1 = pos[c + 2] - pos[a + 2]
          const x2 = pos[d] - pos[a],
            y2 = pos[d + 1] - pos[a + 1],
            z2 = pos[d + 2] - pos[a + 2]
          const area = (y1 * z2 - z1 * y2) ** 2 + (z1 * x2 - x1 * z2) ** 2 + (x1 * y2 - y1 * x2) ** 2
          if (g.leaves || area > (m.name === 'roofEdge' ? 0.000003 : 0.00000065))
            triangles.push(ix[j], ix[j + 1], ix[j + 2])
          j += 3
        }
        const reduced = new T.BufferGeometry()
        for (const [name, attribute] of Object.entries(geo.attributes)) reduced.setAttribute(name, attribute)
        reduced.setIndex(triangles)
        reduced.boundingSphere = geo.boundingSphere
        motionGeometry = reduced
      }
      for (const batch of spatialBatches(geo, motionGeometry)) {
        const mesh = new T.Mesh(batch.geometry, m)
        if (batch.reduced) mesh.userData.motionGeometry = batch.reduced
        mesh.castShadow = m.userData.cast !== false
        mesh.receiveShadow = true
        if (m.userData.collisionOnly) mesh.visible = false
        this.scene.add(mesh)
      }
      this.groups.delete(m)
    }
    this.groups.clear()
  }
}
