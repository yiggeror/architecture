import * as T from 'three'

export const tau = Math.PI * 2
export const clamp = (t, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, t))
export const mix = (a, b, t) => a + (b - a) * t
export function smooth(t) {
  t = clamp(t)
  return t * t * (3 - 2 * t)
}
export const add = (a, b) => a.map((v, i) => v + b[i])
export const minus = (a, b) => a.map((v, i) => v - b[i])
export const scale = (v, s) => v.map((n) => n * s)
export const lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t))
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const unit = (v) => scale(v, 1 / (Math.hypot(...v) || 1))
export const pigment = (hex) => new T.Color(hex).toArray()
export const tint = (c, n) => c.map((v) => v * n)
export function table(t, stops) {
  for (let i = 1; i < stops.length; i++) {
    const [b, v] = stops[i],
      [a, u] = stops[i - 1]
    if (t <= b) return mix(u, v, clamp((t - a) / (b - a)))
  }
  return stops.at(-1)[1]
}

// Each patch shares its ring vertices. Mirroring reverses the triangles at
// construction time so dorsal skin and the medial sole keep outward normals.
export class PaintedSurface {
  constructor(mirror = false, transform = (p) => p) {
    this.position = []
    this.colors = []
    this.uv = []
    this.triangles = []
    this.mirror = mirror
    this.transform = transform
  }
  vertex(p, c, u, v) {
    const index = this.position.length / 3
    this.position.push(...this.transform(p))
    this.colors.push(...c)
    this.uv.push(u, v)
    return index
  }
  tri(a, b, c, reverse = false) {
    if (this.mirror !== reverse) this.triangles.push(a, c, b)
    else this.triangles.push(a, b, c)
  }
  patch(width, heights, sample, options = {}) {
    const rows = [],
      closed = options.closed ?? false,
      cols = width + (closed ? 0 : 1)
    for (let j = 0; j < heights.length; j++) {
      const t = heights[j],
        row = []
      for (let i = 0; i < cols; i++) {
        if (options.omit) {
          const adjacent = [i - 1, i].some((col) =>
            [j - 1, j].some(
              (row) =>
                row >= 0 && row < heights.length - 1 && col >= 0 && col < width && !options.omit(col, row),
            ),
          )
          if (!adjacent) {
            row.push(-1)
            continue
          }
        }
        const u = i / width,
          d = sample(u, t)
        row.push(this.vertex(d.p, d.c, d.uv?.[0] ?? u, d.uv?.[1] ?? t))
      }
      rows.push(row)
    }
    for (let j = 0; j < rows.length - 1; j++)
      for (let i = 0; i < width; i++) {
        if (options.omit?.(i, j)) continue
        const k = (i + 1) % cols,
          a = rows[j][i],
          b = rows[j][k],
          c = rows[j + 1][k],
          d = rows[j + 1][i]
        this.tri(a, b, c, options.reverse)
        this.tri(a, c, d, options.reverse)
      }
    return rows
  }
  cap(row, p, c, reverse = false) {
    const middle = this.vertex(p, c, 0.5, 0.5)
    for (let i = 0; i < row.length; i++) {
      const a = row[i] * 3,
        b = row[(i + 1) % row.length] * 3
      if (
        Math.abs(this.position[a] - this.position[b]) +
          Math.abs(this.position[a + 1] - this.position[b + 1]) +
          Math.abs(this.position[a + 2] - this.position[b + 2]) >
        1e-8
      )
        this.tri(row[i], middle, row[(i + 1) % row.length], !reverse)
    }
  }
  geometry() {
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.Float32BufferAttribute(this.position, 3))
    g.setAttribute('color', new T.Float32BufferAttribute(this.colors, 3))
    g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2))
    g.setIndex(this.triangles)
    g.computeVertexNormals()
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

// Relax the joined skin over the thumb saddle and the knuckle roots. Work on
// the welded surface so the split UV edges do not become creases. Nonmatching
// edge samples at the two ends of the thumb loft remain on their parent edge.
export function softenPalm(surface, digits, junctions, gripRadius, wristFrame = null) {
  const scratch = new T.Vector3()
  const positions = surface.position,
    ids = [],
    locations = [],
    where = new Map()
  const weights = [],
    neighbours = []
  for (let i = 0; i < positions.length; i += 3) {
    const p = positions.slice(i, i + 3),
      k = p.map((x) => Math.round(x * 1e7)).join(',')
    let id = where.get(k)
    if (id === undefined) {
      id = locations.length
      where.set(k, id)
      locations.push(p)
      weights.push(0)
      neighbours.push(new Set())
    }
    const vertex = i / 3
    let weight = 0
    if (vertex >= digits.at(-1).end) {
      const y = wristFrame ? scratch.fromArray(p).applyMatrix4(wristFrame).y : p[1]
      weight = Math.max(0, Math.min(1, (-y - 0.024) / 0.022))
    } else {
      for (const d of digits) {
        const delta = vertex - d.rootRing[0]
        if (delta >= 0 && delta < 13 * 6) weight = Math.max(weight, 1 - Math.floor(delta / 13) / 6)
      }
    }
    weights[id] = Math.max(weights[id], weight)
    ids.push(id)
  }
  const ix = surface.triangles
  for (let i = 0; i < ix.length; i += 3)
    for (let j = 0; j < 3; j++) {
      const a = ids[ix[i + j]],
        b = ids[ix[i + ((j + 1) % 3)]]
      if (a !== b) {
        neighbours[a].add(b)
        neighbours[b].add(a)
      }
    }
  let current = locations
  for (let turn = 0; turn < (wristFrame ? 9 : 5); turn++) {
    const next = current.map((p, i) => {
      if (!weights[i] || !neighbours[i].size) return p
      const mean = [0, 0, 0]
      let sum = 0
      for (const j of neighbours[i]) {
        const q = current[j]
        const measure = 1 / Math.max(0.0025, Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]))
        sum += measure
        for (let k = 0; k < 3; k++) mean[k] += q[k] * measure
      }
      return p.map((value, k) => value + (mean[k] / sum - value) * weights[i] * 0.59)
    })
    for (const [at, a, b, u] of junctions) {
      if (ids[at] === ids[a] || ids[at] === ids[b]) continue
      next[ids[at]] = next[ids[a]].map((x, k) => x + (next[ids[b]][k] - x) * u)
    }
    if (gripRadius)
      for (let i = 0; i < next.length; i++) {
        if (!weights[i]) continue
        const p = next[i],
          z = p[2] - 0.026,
          r = Math.hypot(p[0], z)
        if (r > 0 && r < gripRadius + 0.00014) {
          const k = (gripRadius + 0.00014) / r
          p[0] *= k
          p[2] = 0.026 + z * k
        }
      }
    current = next
  }
  for (let i = 0; i < ids.length; i++) for (let k = 0; k < 3; k++) positions[3 * i + k] = current[ids[i]][k]
}
