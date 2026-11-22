import * as T from 'three'
import { launchSites } from './skyLanterns.js'

function canopy() {
  const p = [],
    c = [],
    indices = []
  const paper = 0xf1d5a0,
    ink = 0x344860,
    red = 0xa14f3e,
    gold = 0xc79950,
    jade = 0x4a8884
  const color = new T.Color()
  function face(points, pigment) {
    const start = p.length / 3
    color.setHex(pigment)
    for (const pt of points) {
      p.push(...pt)
      c.push(color.r, color.g, color.b)
    }
    for (let i = 1; i + 1 < points.length; i++) indices.push(start, start + i, start + i + 1)
  }
  // Raised wing spars form a shallow dihedral. Each wing has individually
  // shaped primaries, a narrow red shoulder stripe and a silk eye.
  for (const sign of [-1, 1]) {
    const point = (x, y, z = 0.035) => [sign * x, y, z + 0.115 * x - 0.059 * y * y]
    const poly = (coords, col, z) =>
      face(
        coords.map(([x, y]) => point(x, y, z)),
        col
      )
    poly(
      [
        [0.024, 0.3],
        [0.185, 0.4],
        [0.48, 0.52],
        [0.86, 0.74],
        [1.18, 0.92],
        [1.03, 0.52],
        [0.78, 0.28],
        [0.55, 0.14],
        [0.28, 0.03],
        [0.045, -0.005],
      ],
      ink
    )
    poly(
      [
        [0.09, 0.255],
        [0.32, 0.366],
        [0.69, 0.53],
        [1.06, 0.802],
        [0.966, 0.587],
        [0.55, 0.315],
        [0.24, 0.155],
      ],
      paper,
      0.043
    )
    poly(
      [
        [0.205, 0.245],
        [0.63, 0.464],
        [0.966, 0.677],
        [0.83, 0.5],
        [0.56, 0.326],
        [0.28, 0.177],
      ],
      jade,
      0.051
    )
    poly(
      [
        [0.09, 0.302],
        [0.39, 0.406],
        [0.79, 0.625],
        [0.97, 0.745],
        [0.6, 0.48],
        [0.26, 0.314],
      ],
      red,
      0.054
    )
    poly(
      [
        [0.02, 0.025],
        [0.28, 0.03],
        [0.48, 0.13],
        [0.68, 0.21],
        [0.6, 0.06],
        [0.41, -0.107],
        [0.23, -0.122],
        [0.053, -0.095],
      ],
      ink
    )
    for (let k = 0; k < 4; k++) {
      const x = 0.23 + 0.115 * k,
        y = 0.033 + 0.06 * k
      poly(
        [
          [x, y],
          [x + 0.154, y + 0.065],
          [x + 0.081, y - 0.018],
          [x - 0.016, y - 0.09],
        ],
        k % 2 ? paper : gold,
        0.048
      )
    }
    poly(
      [
        [0.025, -0.039],
        [0.2, -0.11],
        [0.29, -0.31],
        [0.37, -0.62],
        [0.39, -0.85],
        [0.23, -0.65],
        [0.08, -0.4],
      ],
      ink
    )
    poly(
      [
        [0.088, -0.203],
        [0.204, -0.28],
        [0.332, -0.667],
        [0.259, -0.55],
      ],
      red,
      0.051
    )
    const spot = []
    for (let j = 0; j < 12; j++) {
      const a = (2 * Math.PI * j) / 12
      spot.push([0.34 + 0.046 * Math.cos(a), 0.308 + 0.033 * Math.sin(a)])
    }
    poly(spot, gold, 0.058)
  }
  face(
    [
      [0, 0.51, 0.1],
      [0.086, 0.38, 0.073],
      [0.129, 0.12, 0.057],
      [0.057, -0.3, 0.039],
      [0, -0.42, 0.045],
      [-0.057, -0.3, 0.039],
      [-0.129, 0.12, 0.057],
      [-0.086, 0.38, 0.073],
    ],
    paper
  )
  face(
    [
      [0, 0.575, 0.112],
      [0.09, 0.438, 0.088],
      [0.065, 0.343, 0.077],
      [-0.06, 0.341, 0.077],
      [-0.091, 0.44, 0.088],
    ],
    ink
  )
  face(
    [
      [-0.058, 0.316, 0.095],
      [0.06, 0.316, 0.095],
      [0.07, 0.21, 0.09],
      [0, 0.152, 0.103],
      [-0.078, 0.22, 0.09],
    ],
    red
  )
  face(
    [
      [-0.055, 0.026, 0.081],
      [0.055, 0.026, 0.081],
      [0, -0.29, 0.088],
    ],
    gold
  )
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3))
  g.setAttribute('color', new T.Float32BufferAttribute(c, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

export function festivalKites(scene) {
  const group = new T.Group()
  group.name = '晴日纸鸢'
  group.visible = false
  group.userData.animated = true
  scene.add(group)
  const form = canopy()
  const mat = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide })
  const silk = new T.LineBasicMaterial({ color: 0xbca78d, transparent: true, opacity: 0.48 })
  // Every tether runs from a physical reel on the inner edge of a launch float
  // and out over the open basins on its own side of the ceremonial bridge.
  const anchors = launchSites.map(([x, , z]) => [x - Math.sign(x) * 0.38, 1.72, z - 1.16])
  const dirs = [
    [15.2, 25, +7],
    [-15.0, 31, 17],
    [18, 26, -11],
    [-14, 37, 8],
  ]
  const objects = anchors.map((a, i) => {
    const kite = new T.Mesh(form, mat)
    const g = new T.BufferGeometry(),
      line = new Float32Array(3 * 17)
    g.setAttribute('position', new T.BufferAttribute(line, 3).setUsage(T.DynamicDrawUsage))
    const thread = new T.Line(g, silk)
    thread.frustumCulled = false
    group.add(kite, thread)
    return { kite, g, line, a, dir: dirs[i] }
  })
  function update(t, day) {
    if (!day) return
    objects.forEach(({ kite, g, line, a, dir }, i) => {
      const w = t * (0.17 + 0.009 * i) + i * 1.6
      const x = a[0] + dir[0] + 2.2 * Math.sin(w) + 0.42 * Math.sin(2.8 * w),
        y = a[1] + dir[1] + 0.85 * Math.sin(1.7 * w) + 0.37 * Math.sin(0.83 * t + i),
        z = a[2] + dir[2] + 1.55 * Math.cos(w * 0.82)
      kite.position.set(x, y, z)
      kite.rotation.set(
        -0.41 + 0.19 * Math.sin(w * 1.7),
        -0.23 + 0.4 * Math.sin(w * 0.63),
        0.21 * Math.sin(w) + 0.1 * Math.sin(2.1 * w)
      )
      kite.scale.setScalar(0.97 + i * 0.1)
      for (let j = 0; j <= 16; j++) {
        const u = j / 16,
          reach = u * u * (1.48 - 0.48 * u),
          sag = 4 * u * (1 - u)
        line[j * 3] = a[0] + (x - a[0]) * reach
        line[j * 3 + 1] = a[1] + (y - a[1]) * u - 0.47 * sag
        line[j * 3 + 2] = a[2] + (z - a[2]) * reach + 0.22 * sag
      }
      g.attributes.position.needsUpdate = true
    })
  }
  return {
    mode(day) {
      group.visible = day
    },
    update,
  }
}
