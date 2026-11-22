import * as T from 'three'
import { locate } from './fleetRoute.js'

const tau = Math.PI * 2
const hash = (a) => {
  const v = Math.sin(a * 127.15 + 34.63) * 41258.31
  return v - Math.floor(v)
}

// Every patch samples the hull's earlier position. Each stroke leaves a widening
// partial eddy; the displaced water breaks into separate crescents and air bubbles.
export function wakes(scene, boats) {
  const patches = [],
    positions = [],
    colors = [],
    indices = []
  function vertex(rgb, alpha = 0) {
    positions.push(0, 0, 0)
    colors.push(...rgb, alpha)
    return positions.length / 3 - 1
  }
  for (let i = 0; i < boats.length; i++)
    for (const side of [-1, 1]) {
      for (let k = 0; k < 20; k++) {
        const seed = i * 103 + k * 2 + (side + 1) / 2 + 1
        const foam = k > 12,
          eddy = k > 15,
          n = eddy ? 10 : foam ? 4 : 7
        const p = {
          boat: i,
          side,
          seed,
          kind: eddy ? 2 : foam ? 1 : 0,
          k,
          n,
          first: positions.length / 3,
          a: hash(seed),
          b: hash(seed + 21),
          c: hash(seed + 31),
        }
        patches.push(p)
        const tint = 0.76 + 0.24 * hash(seed + 7)
        for (let j = 0; j <= n; j++)
          for (let c = 0; c < 3; c++) {
            const id = vertex([tint * 0.8, tint * 0.95, tint])
            if (j < n && c < 2) indices.push(id, id + 3, id + 1, id + 1, id + 3, id + 4)
          }
      }
    }
  const geo = new T.BufferGeometry(),
    pa = new T.Float32BufferAttribute(positions, 3),
    ca = new T.Float32BufferAttribute(colors, 4)
  pa.setUsage(T.DynamicDrawUsage)
  ca.setUsage(T.DynamicDrawUsage)
  geo.setAttribute('position', pa)
  geo.setAttribute('color', ca)
  geo.setIndex(indices)
  const mat = new T.MeshBasicMaterial({
    name: '船过水纹',
    color: 0xa7b9b8,
    side: T.DoubleSide,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  const mesh = new T.Mesh(geo, mat)
  mesh.name = '橹后水花'
  mesh.frustumCulled = false
  mesh.renderOrder = 5
  scene.add(mesh)
  const p = {},
    source = {}
  let last = -Infinity
  return function (t, day) {
    if (t >= last && t - last < 0.063) return
    last = t
    mat.color.set(day ? 0xb6ccc4 : 0x84999c)
    for (const f of patches) {
      const boat = boats[f.boat],
        L = boat.length,
        side = f.side,
        seed = f.seed
      const phase = (t * (0.16 + 0.035 * f.c) + f.a) % 1
      const age = (t / 3.63 + f.a + f.k * 0.24) % 1
      const tail = 0.12 + 0.93 * phase
      const start = L * (-0.22 + tail * 0.91) + 0.75 * f.a
      const stretch = (0.13 + 0.64 * f.b) * (1 + phase * 0.82)
      const edge = boat.beam * (0.46 + 0.061 * f.b) + Math.max(0, tail - 0.13) * (1.02 + 0.69 * f.c)
      if (f.kind === 2) locate(boat, t, source, boat.length * 0.29 + age * 3.63 * 1.04)
      else if (f.kind === 1) locate(boat, t, source, L * (0.46 + 0.42 * phase))
      for (let j = 0; j <= f.n; j++) {
        const u = j / f.n,
          profile = Math.sin(Math.PI * u) ** 0.65
        let x,
          z,
          nx,
          nz,
          width,
          alpha,
          y = 0.022
        if (f.kind === 0) {
          locate(boat, t, p, start + u * stretch)
          const lateral =
            edge + 0.25 * u * stretch + 0.075 * Math.sin(u * 4 + f.b * 6) + 0.028 * Math.sin(t * 2.6 + seed)
          x = p.x + side * p.dz * lateral
          z = p.z - side * p.dx * lateral
          nx = p.dz
          nz = -p.dx
          width = (0.016 + 0.028 * (1 - phase) + 0.014 * f.c) * (0.08 + 0.92 * profile)
          alpha = (0.1 + 0.3 * f.b) * (1 - phase) ** 0.71 * Math.min(1, phase * 10) * profile
        } else if (f.kind === 1) {
          const a = tau * (f.a + u * (0.2 + 0.18 * f.c)),
            rad = (0.035 + 0.17 * phase) * (1 + 0.3 * Math.sin(3 * a))
          const dx = Math.cos(a),
            dz = Math.sin(a)
          x = source.x + side * source.dz * (f.b * boat.beam * 0.6) + dx * rad
          z = source.z - side * source.dx * (f.b * boat.beam * 0.6) + dz * rad
          nx = dx
          nz = dz
          width = 0.018 + 0.021 * profile
          alpha = 0.45 * Math.sin(phase * Math.PI) ** 1.5 * profile
          y += 0.015 * (1 - phase) * profile
        } else {
          const a = (f.b * 6 + u * (1.45 + 2.1 * f.c)) * (side < 0 ? -1 : 1),
            rad = 0.055 + age * (0.26 + 0.33 * f.a)
          nx = Math.cos(a)
          nz = Math.sin(a)
          const off = boat.beam * 0.53 + 0.53
          x = source.x + side * source.dz * off + nx * rad
          z = source.z - side * source.dx * off + nz * rad
          width = (0.02 + 0.015 * f.c) * (0.25 + 0.75 * profile)
          alpha = 0.57 * Math.min(1, age * 12) * (1 - age) ** 1.7 * profile
          y += 0.065 * Math.sin(Math.min(1, age * 4) * Math.PI) * (1 - age) * profile
        }
        const idx = f.first + j * 3
        for (let c = 0; c < 3; c++) {
          pa.setXYZ(idx + c, x + (c - 1) * nx * width, y, z + (c - 1) * nz * width)
          ca.setW(idx + c, c === 1 ? alpha : 0)
        }
      }
    }
    pa.needsUpdate = true
    ca.needsUpdate = true
  }
}
