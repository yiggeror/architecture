import * as T from 'three'
import { colors, face, oval, piece, rod, stroke, tau } from './characterPropCraft.js'
import { fanPainting } from './characterPropFanPaint.js'

const count = 13,
  spread = 1.61,
  pinY = -0.083,
  base = 0.139,
  tip = 0.346
const ebony = 0x342e2d,
  ridge = 0x53534a,
  jade = 0x90a695,
  satin = 0x537a74
const clamp = (t) => Math.max(0, Math.min(1, t))

// Each slip lies in its own layer at the pivot. A straight portion of the
// outer guard fits both the curled fingers and the extended index finger. Its
// head bends forward beyond the knuckles into the plane of the open leaf.
function rail(i, r) {
  const station = i / (count - 1),
    firstGap = 0.029,
    bowed =
      i === 0 ? 0 : Math.max(0, 1 - (i - 1) / 6) * Math.sin(Math.PI * clamp((r + 0.002) / 0.173)) ** 0.7,
    a = i === 0 ? 0 : firstGap + (spread - firstGap) * station + (0.0165 * bowed) / Math.max(0.02, r)
  const crown = 0.0095 * Math.sin(Math.PI * station) * Math.pow(Math.max(0, r) / tip, 1.3),
    layer = -0.0165 + 0.0275 * station
  let z = (layer - 0.0035) * clamp(1 - r / 0.145) + 0.0035 + crown + 0.01 * bowed
  if (i === 0) {
    const t = clamp((r - 0.135) / 0.117)
    z = -0.0165 + 0.02 * t * t * (3 - 2 * t)
  }
  return [Math.sin(a) * r, pinY + Math.cos(a) * r, z]
}

// Palm touches the waist of the outer guard. Its convex back at this station
// and the contact area use the same centreline on every animation frame.
export const fanGrip = new T.Vector3(...rail(0, -pinY))
export const fanGripRadius = 0.0095

function fanCell(i, t, r, side = 0) {
  const a = rail(i, r),
    b = rail(i + 1, r),
    pleat = 1 - Math.abs(t * 2 - 1)
  return [
    a[0] * (1 - t) + b[0] * t,
    a[1] * (1 - t) + b[1] * t,
    a[2] * (1 - t) + b[2] * t - pleat * (0.0034 + (0.0074 * (r - base)) / (tip - base)) + side,
  ]
}

function woodSlip(b, m, i) {
  const guard = i === 0 || i === count - 1,
    first = i === 0,
    width = first ? 0.00955 : guard ? 0.0077 : 0.0026,
    depth = first ? 0.00945 : guard ? 0.0032 : 0.0011,
    rads = [
      -0.015,
      -0.012,
      -0.004,
      0.008,
      0.025,
      0.046,
      0.065,
      0.083,
      0.102,
      0.121,
      base,
      0.177,
      0.247,
      tip - 0.009,
      tip + 0.0015,
      tip + 0.004,
    ],
    widths = [0.27, 0.78, 1, 1.06, 0.82, 0.99, 1, 1, 1, 0.99, 0.61, 0.5, 0.43, 0.36, 0.32, 0.1],
    depths = [0.34, 0.64, 0.71, 0.76, 0.81, 0.99, 1, 1, 1, 0.99, 0.52, 0.35, 0.27, 0.21, 0.18, 0.08]
  // First and last sticks (大骨) enclose the pivot leaves; only the guards
  // have the rounded swallowtail cap and an inlaid silver thread.
  const a = i === 0 ? 0 : 0.029 + ((spread - 0.029) * i) / (count - 1),
    wx = Math.cos(a),
    wy = -Math.sin(a),
    n = guard ? 12 : 6,
    tone = guard ? ebony : i % 3 === 0 ? 0x625443 : i % 3 === 1 ? 0x554a40 : 0x74614b
  const sections = rads.map((r, k) => {
    // Thin slips are pasted into the rear paper folds and deliberately stop
    // short of the gilded edge, as in a paper fan bound over bamboo sticks.
    const end = guard ? r : Math.min(r, tip - 0.012 + (k - 12) * 0.002),
      p = rail(i, end),
      w = width * widths[k],
      d = depth * depths[k]
    if (!guard) p[2] -= 0.00195 * clamp((r - base + 0.005) / 0.019)
    return Array.from({ length: n }, (_, j) => {
      const q = (tau * j) / n,
        v = Math.cos(q) * w
      return [p[0] + wx * v, p[1] + wy * v, p[2] + Math.sin(q) * d]
    })
  })
  for (let j = 0; j < n; j++)
    for (let k = 1; k < rads.length; k++) {
      const p = sections[k - 1],
        q = sections[k],
        next = (j + 1) % n
      face(b, m.matte, guard && j === 1 ? ridge : tone, [p[j], p[next], q[next], q[j]])
    }
  face(b, m.matte, tone, sections[0].slice().reverse())
  face(b, m.matte, tone, sections.at(-1))
  if (!guard) return
  const inset = (r, off = 0) => {
    const p = rail(i, r),
      k = rads.findIndex((v) => v >= r),
      lo = Math.max(0, k - 1),
      t = k <= 0 ? 0 : (r - rads[lo]) / (rads[k] - rads[lo]),
      cap = depth * ((1 - t) * depths[lo] + t * depths[k])
    return [p[0] + wx * off, p[1] + wy * off, p[2] + cap + 0.00014]
  }
  stroke(
    b,
    m.metal,
    colors.darkGold,
    [0.127, 0.134, 0.147, 0.157, 0.192, 0.225, 0.248, 0.295, 0.334].map((r) => inset(r)),
    0.0004,
    5,
  )
  for (const r of [0.143, 0.155, 0.274, 0.287, 0.3]) {
    const off = 0.0022
    for (const sign of [-1, 1])
      face(b, m.metal, sign === 1 ? 0xd1b582 : 0xafd2bd, [
        inset(r - 0.0038),
        inset(r + 0.0002, sign * off),
        inset(r + 0.0065),
        inset(r + 0.001, sign * 0.0007),
      ])
  }
}

function leaf(b, paper) {
  const stations = [base, base + 0.004, 0.191, 0.264, tip - 0.004, tip],
    edge = 0.00073
  for (let i = 0; i < count - 1; i++)
    for (let h = 0; h < 2; h++) {
      const lo = h / 2,
        hi = (h + 1) / 2,
        u = (p) => (1.5 + (509 * (i + p)) / (count - 1)) / 512,
        v = (r, verso) => (1.5 + (253 * (r - base)) / (tip - base) + (verso ? 256 : 0)) / 512
      for (let k = 1; k < stations.length; k++) {
        const a = stations[k - 1],
          z = stations[k]
        for (const reverse of [false, true]) {
          const e = reverse ? -edge : edge,
            at = (t, r) => fanCell(i, t, r, e),
            // Keep the front seal and the reverse painting correctly readable
            // once each side faces its own viewer.
            uv = (t, r) => [reverse ? 1 - u(t) : u(t), v(r, reverse)]
          const points = [at(lo, a), at(lo, z), at(hi, z), at(hi, a)],
            uvs = [uv(lo, a), uv(lo, z), uv(hi, z), uv(hi, a)]
          if (!reverse) {
            points.reverse()
            uvs.reverse()
          }
          // Shallow occlusion remains inside a paper valley even when the
          // reverse faces diffuse sky light instead of the exhibition lamp.
          b.face(paper, points, h === 0 ? (reverse ? 0.81 : 0.97) : 1, uvs)
        }
      }
      for (const r of [base, tip]) {
        const points = [
            fanCell(i, lo, r, edge),
            fanCell(i, hi, r, edge),
            fanCell(i, hi, r, -edge),
            fanCell(i, lo, r, -edge),
          ],
          y = r === tip ? 0.485 : 0.021
        b.face(paper, points, 0.9, [
          [u(lo), y],
          [u(hi), y],
          [u(hi), y],
          [u(lo), y],
        ])
      }
    }
}

function pendant(m) {
  return piece('湖青佛头与双股丝穗', (b) => {
    const gold = colors.gold
    const loop = []
    for (let j = 0; j <= 20; j++) {
      const a = (tau * j) / 20
      loop.push([0.0033 * Math.sin(a), -0.017 + 0.017 * Math.cos(a), 0.0051 * Math.sin(a)])
    }
    stroke(b, m.matte, satin, loop, 0.00145, 6)
    for (let i = 0; i < 3; i++) {
      const y = -0.03 - i * 0.0041
      rod(b, m.matte, i === 1 ? 0xd9c199 : 0x485f58, [0, y, 0], [0, y - 0.004, 0], 0.0026, 0.0024, 7)
    }
    oval(b, m.metal, 0xc3995c, [0, -0.042, 0], [0.0048, 0.0036, 0.0048], 10, 5)
    oval(b, m.matte, jade, [0, -0.052, 0], [0.0081, 0.011, 0.0081], 12, 7)
    rod(b, m.matte, 0x769883, [0, -0.06, 0], [0, -0.065, 0], 0.005, 0.0032, 10)
    oval(b, m.metal, gold, [0, -0.068, 0], [0.006, 0.004, 0.006], 10, 5)
    for (let i = 0; i < 12; i++) {
      const a = (i * tau) / 12,
        c = Math.cos(a),
        s = Math.sin(a),
        y = -0.131 + 0.006 * Math.sin(3 * a + 0.6)
      stroke(
        b,
        m.matte,
        i % 3 === 0 ? 0x7d9583 : i % 3 === 1 ? 0x637f76 : 0x3f665e,
        [
          [0.0037 * c, -0.069, 0.0037 * s],
          [0.0057 * c, -0.088, 0.0057 * s],
          [0.0087 * c + 0.0015, -0.11, 0.0072 * s],
          [0.0112 * c + 0.0034, y, 0.0086 * s],
        ],
        0.00115,
        5,
      )
    }
    for (const y of [-0.071, -0.075]) rod(b, m.metal, gold, [0, y, 0], [0, y - 0.0018, 0], 0.0054, 0.0054, 10)
  })
}

export function scholarFan(m) {
  const paper = new T.MeshStandardMaterial({
    name: '竹影远汀双面折扇笺',
    color: 0xffffff,
    map: fanPainting(),
    roughness: 0.87,
    side: T.DoubleSide,
    vertexColors: true,
  })
  const fan = new T.Group()
  fan.name = '听竹斋双面折扇'
  fan.add(
    piece('十一枚竹心细骨', (b) => {
      for (let i = 1; i < count - 1; i++) woodSlip(b, m, i)
    }),
  )
  fan.add(piece('竹影双面折纸', (b) => leaf(b, paper)))
  fan.add(
    piece('乌木双护骨与菊头铆钉', (b) => {
      woodSlip(b, m, 0)
      woodSlip(b, m, count - 1)
      const p = rail(0, 0),
        q = rail(count - 1, 0),
        g = colors.gold
      rod(b, m.metal, 0xa88453, [0, pinY, q[2] + 0.006], [0, pinY, p[2] - 0.007], 0.0045, 0.0045, 14)
      // The chrysanthemum-head rivet is visible on both guard leaves.
      for (const [s, z] of [
        [-1, p[2] - 0.0063],
        [1, q[2] + 0.0042],
      ]) {
        rod(b, m.metal, g, [0, pinY, z], [0, pinY, z + s * 0.003], 0.0086, 0.0074, 18)
        for (let j = 0; j < 8; j++) {
          const a = (tau * j) / 8
          oval(
            b,
            m.metal,
            j % 2 ? g : 0xbea576,
            [0.0047 * Math.cos(a), pinY + 0.0047 * Math.sin(a), z + s * 0.0031],
            [0.0025, 0.0025, 0.0012],
            6,
            3,
          )
        }
        oval(b, m.matte, 0x8da995, [0, pinY, z + s * 0.0043], [0.0033, 0.0033, 0.0017], 10, 4)
      }
    }),
  )
  const tassel = pendant(m),
    heel = rail(0, -0.012)
  tassel.position.set(heel[0] - 0.002, heel[1], heel[2])
  fan.add(tassel)
  return { fan, tassel }
}
