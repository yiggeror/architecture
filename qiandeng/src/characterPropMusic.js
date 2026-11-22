import { colors as c, pigment, piece, rod, box, face, stroke, ring, oval, tau } from './characterPropCraft.js'
import { buildSweep } from './fleetBoats.js'
import { sweepStation } from './characterPropCrew.js'
import { pipaFittings } from './characterPropPipaFittings.js'
import { pipaInlay } from './characterPropInlay.js'
import { bellyRings, bellySegments, bellyPoint, pipaBody, pipaNeck } from './characterPropPipaBody.js'
import * as T from 'three'

// Local +Y is the vibrating length for the flute and both mallets.
export function flute(m) {
  return piece('缠丝竹笛', (b) => {
    rod(b, m.matte, 0xc09561, [0, -0.117, 0], [0, 0.471, 0], 0.0108, 0.01, 16)
    rod(b, m.matte, c.ink, [0, -0.12, 0], [0, -0.116, 0], 0.0084, 0.0084, 12)
    rod(b, m.matte, c.ink, [0, 0.471, 0], [0, 0.472, 0], 0.0077, 0.0077, 12)
    for (const y of [-0.109, -0.089, 0.074, 0.285, 0.395, 0.457])
      for (let i = 0; i < 3; i++)
        rod(
          b,
          m.matte,
          i === 1 ? c.gold : c.ink,
          [0, y + 0.0037 * i, 0],
          [0, y + 0.0037 * i + 0.0028, 0],
          0.0115,
          0.0115,
          14,
        )
    for (const [i, y] of [0, 0.062, 0.116, 0.145, 0.174, 0.208, 0.235, 0.263, 0.355, 0.375].entries()) {
      const radius = i === 0 ? 0.0046 : i === 1 ? 0.0038 : 0.0031
      oval(b, m.matte, i === 1 ? c.pearl : 0x382a23, [0, y, 0.01015], [radius, radius * 1.14, 0.0014], 10, 4)
    }
    stroke(
      b,
      m.matte,
      c.red,
      [
        [0, 0.391, -0.009],
        [0.003, 0.407, -0.023],
        [0.006, 0.406, -0.06],
      ],
      0.0019,
      5,
    )
    oval(b, m.metal, c.gold, [0.006, 0.406, -0.064], [0.0043, 0.005, 0.0043], 7, 4)
    for (let i = 0; i < 6; i++) {
      const a = (tau * i) / 6
      rod(
        b,
        m.matte,
        c.red,
        [0.006, 0.406, -0.065],
        [0.006 + 0.009 * Math.cos(a), 0.406 + 0.005 * Math.sin(a), -0.091],
        0.0014,
        0.0008,
        5,
      )
    }
  })
}
export const malletLength = 0.371,
  malletTip = 0.021
export function mallet(m, s) {
  return piece('缠绳鼓槌', (b) => {
    rod(b, m.matte, c.wood, [0, -0.094, 0], [0, 0.355, 0], 0.0095, 0.0102, 12)
    rod(b, m.matte, c.ink, [0, -0.102, 0], [0, -0.088, 0], 0.012, 0.01, 12)
    rod(b, m.matte, s > 0 ? c.red : c.teal, [0, -0.044, 0], [0, 0.041, 0], 0.0113, 0.011, 12)
    for (const y of [-0.043, 0.035, 0.326, 0.337])
      rod(b, m.metal, c.gold, [0, y, 0], [0, y + 0.004, 0], 0.0118, 0.0118, 10)
    oval(b, m.matte, 0xab7348, [0, malletLength, 0], [0.017, 0.021, 0.017], 12, 7)
  })
}
export function studyDrum(m) {
  return piece('架上的仪节鼓', (b) => {
    const r = 0.365,
      top = 0.55,
      z = 0.706
    for (const x of [-0.23, 0.23])
      for (const d of [-1, 1])
        b.beam(m.matte, [x, 0, z + d * 0.208], [x * 0.77, 0.197, z + d * 0.13], 0.041, 0.044, pigment(c.ink))
    for (const d of [-1, 1]) box(b, m.matte, c.wood, [0, 0.123, z + d * 0.128], [0.42, 0.038, 0.03])
    const rings = [
      [0.127, 0.255],
      [0.148, 0.284],
      [0.237, 0.339],
      [0.369, 0.36],
      [0.463, 0.349],
      [0.51, 0.337],
      [0.54, 0.33],
    ]
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < 28; i++) {
        const p = (t, k) => [
          Math.cos((tau * t) / 28) * rings[k][1],
          rings[k][0],
          z + Math.sin((tau * t) / 28) * rings[k][1],
        ]
        face(b, m.matte, [0x934b3e, 0xa85642, 0x9e5143][i % 3], [
          p(i, j - 1),
          p(i + 1, j - 1),
          p(i + 1, j),
          p(i, j),
        ])
      }
    const rr = 0.332
    rod(b, m.matte, c.ivory, [0, top - 0.012, z], [0, top, z], rr, rr, 36)
    ring(b, m.matte, c.ink, 0, 0.529, z, rr + 0.006, rr + 0.006, 0.008, 32)
    for (let k = 0; k < 24; k++) {
      const a = (k * tau) / 24,
        aa = ((k + 0.5) * tau) / 24,
        x = Math.cos(a),
        zz = Math.sin(a)
      oval(b, m.metal, c.gold, [rr * x, 0.505, z + rr * zz], [0.006, 0.006, 0.006], 7, 4)
      if (k % 2 === 0) {
        stroke(
          b,
          m.matte,
          c.rope,
          [
            [0.339 * x, 0.482, z + 0.339 * zz],
            [0.357 * Math.cos(aa), 0.329, z + 0.357 * Math.sin(aa)],
            [0.283 * x, 0.164, z + 0.283 * zz],
          ],
          0.0037,
        )
      }
    }
    ring(b, m.matte, c.red, 0, top + 0.00045, z, 0.257, 0.257, 0.0016, 36)
  })
}
export function studySeat(m) {
  return piece('榫合坐板', (b) => {
    box(b, m.matte, c.wood, [0, 0.326, -0.02], [0.68, 0.073, 0.296])
    for (const x of [-0.247, 0.247])
      for (const z of [-0.117, 0.08])
        b.beam(m.matte, [x * 1.1, 0.004, z * 1.17], [x, 0.302, z], 0.042, 0.044, pigment(c.ink))
    box(b, m.matte, c.wood, [0, 0.13, -0.073], [0.53, 0.031, 0.033])
    for (const x of [-0.243, 0.243])
      for (const z of [-0.098, 0.064])
        rod(b, m.metal, c.darkGold, [x, 0.36253, z], [x, 0.3635, z], 0.004, 0.004, 6)
  })
}
export function stageSweep(m) {
  const station = sweepStation({ beam: 1.98, deck: 0 }, -1, 0),
    local = new T.Group(),
    pivot = new T.Group()
  local.rotation.y = -station.yaw
  const p = new T.Vector3(-station.x, 0, -station.cz).applyAxisAngle(new T.Vector3(0, 1, 0), -station.yaw)
  local.position.copy(p)
  pivot.position.fromArray(station.pin)
  local.add(pivot)
  const wood = m.matte.clone()
  wood.color.set(c.wood)
  const brass = m.metal.clone()
  brass.color.set(c.gold)
  const binding = m.matte.clone()
  binding.color.set(c.rope)
  const oar = piece('水磨木桨', (b) => buildSweep(b, { wood, ring: brass, binding }, station, 0.62))
  pivot.add(oar)
  local.add(
    piece('剖开的桨位与舱板', (b) => {
      const x = station.pin[0],
        edge = (z) => x + 0.068 * (z - 0.32) ** 2,
        far = (z) => 0.265 - 0.046 * (z - 0.38) ** 2
      for (let j = 0; j < 7; j++)
        for (let k = 0; k < 6; k++) {
          const lo = -0.49 + (1.72 * j) / 7,
            hi = -0.49 + (1.72 * (j + 1)) / 7
          const p = (z, u, y) => [edge(z) + (far(z) - edge(z)) * u, y, z]
          face(b, m.matte, [0x986d50, 0xa57e59, 0xa17a59, 0x967052][(j + 3 * k) % 4], [
            p(lo, k / 6 + 0.001, 0),
            p(hi, k / 6 + 0.001, 0),
            p(hi, (k + 1) / 6 - 0.001, 0),
            p(lo, (k + 1) / 6 - 0.001, 0),
          ])
          if (k === 0) {
            const outer = (z, row) => [edge(z) + [0, 0.014, 0.141][row], [0.098, -0.088, -0.258][row], z]
            for (let a = 0; a < 2; a++)
              face(b, m.matte, a ? 0x674e3d : 0x805b40, [
                outer(lo, a),
                outer(hi, a),
                outer(hi, a + 1),
                outer(lo, a + 1),
              ])
            b.beam(m.matte, outer(lo, 0), outer(hi, 0), 0.052, 0.052, pigment(c.wood))
            b.beam(m.matte, outer(lo, 1), outer(hi, 1), 0.015, 0.023, pigment(c.gold))
          }
          if (j === 0 || j === 6) {
            const z = j === 0 ? lo : hi
            face(b, m.matte, c.wood, [
              p(z, k / 6, 0),
              p(z, (k + 1) / 6, 0),
              p(z, (k + 1) / 6, -0.085),
              p(z, k / 6, -0.085),
            ])
          }
          if (k === 5)
            face(b, m.matte, c.wood, [p(lo, 1, 0), p(hi, 1, 0), p(hi, 1, -0.084), p(lo, 1, -0.084)])
        }
      rod(b, m.metal, c.darkGold, [x, 0.073, 0], [x, 0.4, 0], 0.037, 0.027, 9)
      for (const zz of [-0.12, 0.12])
        b.beam(m.matte, [x, 0.096, zz], [x, 0.23, 0], 0.026, 0.031, pigment(c.wood))
    }),
  )
  return { group: local, pivot, station }
}
export function pipaStringPoint(string, y, out) {
  const x = (string - 1.5) * 0.007
  if (y <= 0.447) {
    const t = (y - 0.079) / (0.447 - 0.079)
    return out.set(x * (1.8 - 0.8 * t), y, 0.044 - 0.002 * t)
  }
  const t = (y - 0.447) / (0.675 - 0.447)
  return out.set(x * (1 - 0.14 * t), y, 0.042 - 0.009 * t)
}

export function pipa(m, design) {
  const instrument = piece('螺钿四弦琵琶', (b) => {
    pipaFittings(b, m, bellyRings)
    if (design === 'lute') pipaInlay(b, m, bellyPoint, bellyRings.length, bellySegments)
  })
  const strings = piece('四根丝弦', (b) => {
    const p = new T.Vector3()
    for (let k = 0; k < 4; k++) {
      const sg = k % 2 ? 1 : -1,
        y = 0.679 + 0.0191 * k
      const axleZ = -0.002 - 0.0115 * k,
        colour = [0xc4a47d, 0xd4b994, 0xe1c7a3, 0xe8d4b1][k]
      const chain = [
        pipaStringPoint(k, 0.079, p).toArray(),
        pipaStringPoint(k, 0.447, p).toArray(),
        pipaStringPoint(k, 0.675, p).toArray(),
        [sg * 0.013, y + 0.006, axleZ + 0.0045],
      ]
      // Each silk strand continues over the nut and winds twice around
      // its own wooden axle inside the box.
      for (let i = 0; i <= 20; i++) {
        const a = (Math.PI * 4 * i) / 20
        chain.push([sg * (0.015 + i * 0.00013), y + 0.005 * Math.cos(a), axleZ + 0.005 * Math.sin(a)])
      }
      stroke(b, m.metal, colour, chain, [0.0012, 0.00114, 0.00106, 0.001][k], 6)
    }
  })
  instrument.add(strings, ...pipaBody(m), ...pipaNeck(m))
  return instrument
}
export function booklet(m) {
  return piece('行舟阅用的折装花谱', (b) => {
    const half = 0.113,
      h = 0.14
    for (const sign of [-1, 1]) {
      const pt = (u, v, t = 0) => [sign * (0.009 + u * (half - 0.009)), v * h + 0.005, -0.014 * u + t]
      const rect = (mat, col, lo, hi, a, e, depth) =>
        face(b, mat, col, [pt(lo, a, depth), pt(hi, a, depth), pt(hi, e, depth), pt(lo, e, depth)])
      rect(m.matte, c.teal, 0, 1, -0.6, 0.61, 0.003)
      rect(m.matte, c.paper, 0, 0.95, -0.56, 0.58, -0.004)
      for (const u of [0.055, 0.92]) rect(m.matte, c.gold, u, u + 0.009, -0.545, 0.55, 0.0034)
      for (const v of [-0.545, 0.55]) rect(m.matte, c.gold, 0.055, 0.93, v, v + 0.007, 0.0034)
      const brush = (points, color, r) =>
        stroke(
          b,
          m.matte,
          color,
          points.map(([u, v]) => pt(u, v, 0.0041)),
          r,
        )
      // Gilt bamboo on the cloth-bound outside; columns of ink face the reader.
      brush(
        [
          [0.12, -0.5],
          [0.31, -0.29],
          [0.48, 0.04],
          [0.68, 0.28],
          [0.78, 0.43],
        ],
        c.gold,
        0.0011,
      )
      for (const [u, v, du, dv] of [
        [0.26, -0.31, 0.32, 0.03],
        [0.3, -0.26, -0.13, 0.19],
        [0.39, -0.12, 0.34, 0.1],
        [0.45, -0.02, -0.16, 0.21],
        [0.54, 0.1, 0.22, 0.035],
        [0.64, 0.23, -0.13, 0.15],
      ]) {
        face(
          b,
          m.matte,
          0xb8b887,
          [
            [u, v],
            [u + du * 0.47 - dv * 0.1, v + dv * 0.51 + du * 0.077],
            [u + du, v + dv],
            [u + du * 0.52 + dv * 0.08, v + dv * 0.46 - du * 0.044],
          ].map((q) => pt(q[0], q[1], 0.0044)),
        )
      }
      if (sign === 1) {
        rect(m.matte, c.paper, 0.12, 0.36, 0.105, 0.502, 0.0053)
        for (const [u, v, du, dv] of [
          [0.15, 0.423, 0.18, 0],
          [0.2, 0.46, 0, -0.072],
          [0.29, 0.46, 0, -0.072],
          [0.21, 0.389, -0.056, -0.105],
          [0.222, 0.364, 0, -0.072],
          [0.282, 0.387, -0.006, -0.1],
          [0.275, 0.291, 0.044, 0.005],
          [0.15, 0.207, 0.069, 0],
          [0.174, 0.239, 0.036, -0.022],
          [0.163, 0.173, 0.048, 0],
          [0.167, 0.16, 0, -0.029],
          [0.168, 0.132, 0.04, 0],
          [0.215, 0.213, 0.11, 0],
          [0.239, 0.232, 0.006, -0.045],
          [0.294, 0.231, 0, -0.043],
          [0.217, 0.184, 0.116, 0],
          [0.237, 0.171, 0, -0.05],
          [0.239, 0.17, 0.071, 0],
          [0.308, 0.169, 0, -0.047],
          [0.241, 0.143, 0.064, 0],
          [0.242, 0.122, 0.065, 0],
        ]) {
          stroke(b, m.matte, c.ink, [pt(u, v, 0.0061), pt(u + du, v + dv, 0.0061)], 0.00066)
        }
      }
      for (let j = 0; j < 8; j++)
        for (let k = 0; k < 8; k++) {
          if ((j * 31 + k * 7) % 17 < 3) continue
          const a = 0.09 + j * 0.1,
            y = -0.46 + k * 0.115
          rect(m.matte, k === 7 ? c.red : c.ink, a, a + 0.018, y, y + 0.055, -0.0046)
          rect(m.matte, c.ink, a - 0.01, a + 0.035, y + 0.018, y + 0.03, -0.0047)
        }
      rod(b, m.matte, c.honey, pt(0.99, -0.6), pt(0.99, 0.61), 0.0065, 0.0065, 8)
    }
    rod(b, m.matte, c.wood, [0, -0.081, 0], [0, 0.092, 0], 0.007, 0.007, 8)
  })
}
