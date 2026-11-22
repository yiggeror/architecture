import { bellyPoint, bellySegments } from './characterPropPipaBody.js'
import { pipaTimber } from './characterPropPipaTimber.js'
import { cross, sub, unit } from './mesh.js'
import { face, oval, pigment, rod, stroke, tau } from './characterPropCraft.js'

// The bridge is a pierced block of warm boxwood. Its scalloped wings and
// wall recess leave the silk visibly anchored beneath the ivory saddle.
function bridge(b, m) {
  const outline = [
    [-0.058, 0.073],
    [-0.054, 0.081],
    [-0.047, 0.083],
    [-0.044, 0.093],
    [-0.039, 0.097],
    [-0.03, 0.094],
    [0.03, 0.094],
    [0.039, 0.097],
    [0.044, 0.093],
    [0.047, 0.083],
    [0.054, 0.081],
    [0.058, 0.073],
    [0.045, 0.07],
    [0.035, 0.071],
    [0.03, 0.068],
    [-0.03, 0.068],
    [-0.035, 0.071],
    [-0.045, 0.07],
  ]
  const height = (x) => 0.0407 - 0.01 * Math.pow(Math.min(1, Math.abs(x) / 0.056), 3)
  const lower = outline.map(([x, y]) => [x, y, 0.026]),
    upper = outline.map(([x, y]) => [x * 0.978, y, height(x)])
  for (let i = 0; i < outline.length; i++) {
    const k = (i + 1) % outline.length
    face(b, m.matte, 0x744432, [lower[i], lower[k], upper[k], upper[i]])
    face(b, m.matte, 0x855139, [upper[i], upper[k], [0, 0.08, 0.0412]])
  }
  rod(b, m.matte, 0xe8ce9d, [-0.0305, 0.079, 0.0421], [0.0305, 0.079, 0.0421], 0.0021, 0.0021, 10)
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.0126
    rod(b, m.matte, 0x4b302b, [x, 0.071, 0.0406], [x, 0.071, 0.0414], 0.0028, 0.0025, 12)
    stroke(
      b,
      m.matte,
      0xd6bd88,
      [
        [x, 0.079, 0.0438],
        [x, 0.074, 0.0428],
        [x - 0.0012, 0.071, 0.0418],
      ],
      0.00083,
      7,
    )
    rod(b, m.matte, 0xc39a68, [x - 0.0027, 0.073, 0.0421], [x + 0.0014, 0.073, 0.0421], 0.00089, 0.00074, 7)
  }
  for (const sg of [-1, 1])
    stroke(
      b,
      m.metal,
      0xbd9566,
      [
        [sg * 0.034, 0.074, 0.0379],
        [sg * 0.039, 0.078, 0.0373],
        [sg * 0.041, 0.085, 0.0367],
      ],
      0.00064,
    )
}

function peg(b, m, sign, y, z) {
  const axle = (x) => [sign * x, y + 0.053 * x, z - 0.086 * x]
  rod(b, m.matte, 0x704434, axle(0.01), axle(0.042), 0.0052, 0.0042, 14)
  for (const [x, r, w, col] of [
    [0.023, 0.0067, 0.0021, 0xbe9361],
    [0.034, 0.0066, 0.0034, 0x955e46],
    [0.04, 0.0062, 0.002, 0xd1b17b],
  ])
    rod(b, m.matte, col, axle(x), axle(x + w), r, r, 14)
  // Six flutes run along each pear-shaped peg.
  const rows = [
    [0.041, 0.0046],
    [0.045, 0.0052],
    [0.05, 0.0072],
    [0.06, 0.0098],
    [0.068, 0.0105],
    [0.072, 0.0098],
    [0.075, 0.0068],
  ]
  const at = ([x, r], i) => {
    const a = (tau * i) / 24,
      rr = r * (0.93 + 0.07 * Math.cos(6 * a)),
      p = axle(x)
    return [p[0], p[1] + rr * Math.cos(a), p[2] + rr * Math.sin(a)]
  }
  for (let j = 1; j < rows.length; j++)
    for (let i = 0; i < 24; i++)
      face(b, m.matte, [0x764632, 0x844e34, 0x88573b, 0x79492e][i % 4], [
        at(rows[j - 1], i),
        at(rows[j], i),
        at(rows[j], i + 1),
        at(rows[j - 1], i + 1),
      ])
  rod(b, m.matte, 0xdebf8b, axle(0.074), axle(0.0758), 0.0068, 0.0058, 16)
  rod(b, m.matte, 0x936546, axle(0.0758), axle(0.0761), 0.0027, 0.0027, 12)
}

function carvedCrown(b, m) {
  // A ruyi-shaped terminal carries a small six-lobed shell flower.
  const outline = [
    [0, -0.024],
    [-0.011, -0.019],
    [-0.017, -0.014],
    [-0.019, -0.008],
    [-0.025, -0.003],
    [-0.029, 0.003],
    [-0.028, 0.009],
    [-0.024, 0.013],
    [-0.016, 0.014],
    [-0.013, 0.012],
    [-0.012, 0.018],
    [-0.008, 0.023],
    [0, 0.0265],
    [0.008, 0.023],
    [0.012, 0.018],
    [0.013, 0.012],
    [0.016, 0.014],
    [0.024, 0.013],
    [0.028, 0.009],
    [0.029, 0.003],
    [0.025, -0.003],
    [0.019, -0.008],
    [0.017, -0.014],
    [0.011, -0.019],
  ]
  const place = (x, y, z) => [x, 0.763 + y + 0.16 * z, -0.06 + z - 0.16 * y]
  const rings = [
    [0.78, -0.006],
    [0.96, -0.004],
    [1, 0],
    [0.96, 0.0033],
    [0.855, 0.0054],
    [0.72, 0.0058],
  ]
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < outline.length; i++) {
      const k = (i + 1) % outline.length
      const point = (idx, r) => place(outline[idx][0] * r[0], outline[idx][1] * r[0], r[1])
      face(b, m.matte, [0x855337, 0x9d6947, 0x875434, 0xc89966, 0x743f30][j - 1], [
        point(i, rings[j - 1]),
        point(k, rings[j - 1]),
        point(k, rings[j]),
        point(i, rings[j]),
      ])
    }
  for (const j of [0, rings.length - 1]) {
    const r = rings[j]
    for (let i = 0; i < outline.length; i++) {
      const k = (i + 1) % outline.length
      face(b, m.matte, j ? 0x734837 : 0x825238, [
        place(0, 0, r[1]),
        place(outline[i][0] * r[0], outline[i][1] * r[0], r[1]),
        place(outline[k][0] * r[0], outline[k][1] * r[0], r[1]),
      ])
    }
  }
  for (let i = 0; i < 6; i++) {
    const a = (i * tau) / 6,
      form = [
        [0.002, 0],
        [0.005, -0.0034],
        [0.0105, -0.0035],
        [0.0132, -0.0007],
        [0.0124, 0.0017],
        [0.009, 0.0038],
        [0.005, 0.0028],
      ]
    const pearl = form.map(([r, w]) =>
      place(Math.sin(a) * r + Math.cos(a) * w, 0.002 + Math.cos(a) * r - Math.sin(a) * w, 0.0064),
    )
    const ridge = place(0.0083 * Math.sin(a), 0.002 + 0.0083 * Math.cos(a), 0.0073)
    for (let k = 0; k < pearl.length; k++)
      face(b, m.matte, k < 3 ? 0xc3c7ab : 0xe3d2af, [pearl[k], pearl[(k + 1) % pearl.length], ridge])
  }
  oval(b, m.metal, 0xc8a368, place(0, 0.002, 0.0072), [0.0028, 0.0028, 0.0014], 12, 5)
}

function head(b, m) {
  // Recurved pegbox, its back widening into a carved ruyi cloud.
  const sections = [
    [0.67, 0.01, 0.0188, 0.013],
    [0.694, 0.003, 0.0191, 0.014],
    [0.716, -0.01, 0.018, 0.0135],
    [0.736, -0.027, 0.0163, 0.011],
    [0.749, -0.044, 0.018, 0.01],
    [0.757, -0.062, 0.0235, 0.0105],
    [0.756, -0.077, 0.0268, 0.012],
    [0.747, -0.087, 0.0232, 0.011],
    [0.736, -0.089, 0.015, 0.008],
  ]
  const stock = pipaTimber(false)
  function section(v) {
    const i = Math.min(Math.floor(v), sections.length - 2),
      t = v - i,
      t2 = t * t,
      t3 = t2 * t
    const a = sections[i],
      b = sections[i + 1],
      previous = sections[Math.max(0, i - 1)],
      next = sections[Math.min(i + 2, sections.length - 1)]
    return a.map(
      (x, k) =>
        (2 * t3 - 3 * t2 + 1) * x +
        (t3 - 2 * t2 + t) * 0.5 * (b[k] - previous[k]) +
        (-2 * t3 + 3 * t2) * b[k] +
        (t3 - t2) * 0.5 * (next[k] - x),
    )
  }
  const last = sections.length - 1
  function ring(v, i) {
    const [y, z, w, h] = section(v),
      next = section(Math.min(last, v + 0.01)),
      previous = section(Math.max(0, v - 0.01))
    const dy = next[0] - previous[0],
      dz = next[1] - previous[1],
      len = Math.hypot(dy, dz)
    const a = (tau * i) / 40,
      cs = Math.cos(a),
      sn = Math.sin(a),
      p = Math.sign(sn) * Math.abs(sn) ** 0.69
    const size = 1 + 0.047 * Math.max(0, Math.min(1, v - 4)) * Math.cos(6 * a)
    const slot =
      sn > 0 ? Math.exp(-((cs / 0.46) ** 8)) * Math.max(0, Math.min(1, (v - 0.11) * 2.6, (4.5 - v) * 1.8)) : 0
    const height = h * p - 0.0128 * slot
    return [w * Math.sign(cs) * Math.abs(cs) ** 0.73 * size, y - (height * dz) / len, z + (height * dy) / len]
  }
  const normal = (v, i) =>
    unit(
      cross(
        sub(ring(Math.min(last, v + 0.01), i), ring(Math.max(0, v - 0.01), i)),
        sub(ring(v, i + 0.015), ring(v, i - 0.015)),
      ),
    )
  for (let j = 1; j <= last * 4; j++)
    for (let i = 0; i < 40; i++) {
      const corners = [
        [(j - 1) / 4, i],
        [j / 4, i],
        [j / 4, i + 1],
        [(j - 1) / 4, i + 1],
      ]
      const inSlot = i >= 8 && i < 12 && j > 2 && j < 18
      b.face(
        stock,
        corners.map(([v, k]) => ring(v, k)),
        pigment(inSlot ? 0xb5a99b : 0xf9e7d1),
        corners.map(([v, k]) => [0.15 + k / 65, 0.32 + v / 70]),
        corners.map(([v, k]) => normal(v, k)),
      )
    }
  face(
    b,
    m.matte,
    0x76503b,
    Array.from({ length: 40 }, (_, i) => ring(last, i)),
  )
  for (const sg of [-1, 1]) {
    const shoulder = [
      [0.012, 0.734, -0.012],
      [0.017, 0.751, -0.029],
      [0.0175, 0.76, -0.047],
      [0.012, 0.765, -0.059],
      [0.006, 0.766, -0.058],
    ]
    stroke(
      b,
      m.metal,
      0xb38d62,
      shoulder.map(([x, y, z]) => [sg * x, y, z]),
      0.00085,
      6,
    )
  }
  carvedCrown(b, m)
  rod(b, m.matte, 0xdbc399, [-0.016, 0.675, 0.0309], [0.016, 0.675, 0.0309], 0.0023, 0.0023, 12)
  for (let k = 0; k < 4; k++) peg(b, m, k % 2 ? 1 : -1, 0.679 + 0.0191 * k, -0.002 - 0.0115 * k)
}

export function pipaFittings(b, m, rings) {
  // The seam is built into the sidewall. A pair of hairline purflings is
  // set into the soundboard inside a narrow pearwood edge.
  for (const sg of [-1, 1]) {
    for (const [inset, depth, width, col] of [
      [0, 0.0168, 0.00175, 0xaf8057],
      [0.0021, 0.0186, 0.00063, 0xe4c78d],
      [0.0041, 0.01985, 0.00053, 0x966a48],
    ]) {
      const line = rings.map(([y, w], row) => {
        const x = Math.max(0.0001, w - inset)
        const z =
          inset === 0 ? depth : bellyPoint(row, (Math.acos(x / w) * bellySegments) / tau, true)[2] + 0.00036
        return [sg * x, y, z]
      })
      stroke(b, m.matte, col, line, width, 6)
    }
  }
  for (let j = 0; j < 18; j++) {
    const y = 0.24 + 0.03 * j - 0.00042 * j * j
    if (y >= 0.462) continue
    const w = Math.max(0.027, 0.079 - (y - 0.22) * 0.112) / 2
    const ends = [
      [-w, 0.0282],
      [-w + 0.002, 0.0329],
      [-w * 0.77, 0.0346],
      [w * 0.77, 0.0346],
      [w - 0.002, 0.0329],
      [w, 0.0282],
    ]
    const a = ends.map(([x, z]) => [x, y - 0.0026, z]),
      c = ends.map(([x, z]) => [x, y + 0.0019, z])
    face(b, m.matte, 0xa87c4f, a)
    face(b, m.matte, 0xae865d, [...c].reverse())
    for (let i = 1; i < a.length; i++)
      face(b, m.matte, i === 3 ? 0xe2c590 : 0xbb9162, [a[i - 1], c[i - 1], c[i], a[i]])
  }
  bridge(b, m)
  head(b, m)
}
