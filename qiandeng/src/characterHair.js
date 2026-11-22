import * as T from 'three'
import { clamp, mix, smooth, bell, parting, hairEdge } from './characterFaceSurface.js'
import { PortraitMesh, point, sweep, tint, ovoid } from './characterFaceMesh.js'
import { hairMap } from './characterFacePaint.js'
import { dressHeroHair } from './characterHeroHair.js'

let silk, details
const tau = 2 * Math.PI
function mult(c, k) {
  return c.map((n) => n * k)
}
function blend(c, d, t) {
  return c.map((n, i) => mix(n, d[i], t))
}
export function dressHair(group, a) {
  if (dressHeroHair(group, a)) return
  const p = a.profile,
    style = p.hair,
    seed = p.seed,
    head = new PortraitMesh(),
    ornament = new PortraitMesh()
  const dark = blend(tint(p.hairColor, 1.35), tint(0x564134), 0.26),
    glint = blend(dark, tint(p.age >= 60 ? 0x9a9690 : 0x806952), p.age >= 60 ? 0.59 : 0.45),
    gray = a.age * (a.profile.age >= 60 ? 0.8 : 0.37)
  const skin = tint(p.skin),
    ribbon = tint(p.colors.binding),
    silvery = tint(0xb8b5a5),
    brass = tint(0xb39259)
  const part = parting(a)
  const line = (th) => hairEdge(a, th)
  function cap(th, t, extra = 0) {
    const front = line(th),
      y = mix(front, 0.233, t)
    const phi =
      th +
      0.82 * Math.sin(th - part) * Math.sin(Math.PI * t) * (0.73 + 0.27 * Math.cos(th)) +
      0.049 * t * Math.sin(2 * th)
    const b = a.dimensions(y),
      co = Math.cos(phi),
      si = Math.sin(phi)
    const lobe = 1 + 0.26 * Math.sin(th * 15.0 + Math.sin(th * 3)) + 0.12 * Math.cos(th * 30 + 0.6)
    const furrow = th - (part + 0.052 * t + 0.019 * Math.sin(t * Math.PI * 2))
    const liftPart = 0.002 * (bell(furrow - 0.094, 0.095) + bell(furrow + 0.11, 0.09)) * (1 - t)
    const fullness =
      (0.0002 * smooth(0, 0.03, t) +
        (0.004 + 0.0016 * (style === 'loop' || style === 'coil')) * Math.sin(Math.PI * t) ** 0.68) *
      lobe
    const edge = smooth(0, 0.072, t),
      w = (fullness + extra + liftPart * edge) * (0.63 + 0.37 * edge) * Math.sqrt(Math.max(0, 1 - t))
    const x = si * (b[0] + w)
    const z = b[2] + (co >= 0 ? (b[1] - b[2]) * co ** 0.9 : (b[3] - b[2]) * (-co) ** 0.91) + co * w
    return [x, y + (0.006 + 0.003 * edge) * t + 0.0016 * Math.sin(Math.PI * t) * lobe, z]
  }
  head.grid(79, 32, (uu, t) => {
    const th = (uu - 0.5) * tau,
      P = cap(th, t)
    const flow =
      0.77 +
      0.26 * (0.5 + 0.5 * Math.sin(th * 21 + Math.sin(5 * th))) +
      0.16 * Math.sin(th * 9 - 0.6) +
      0.1 * Math.sin(t * 7 - th)
    const lock =
      0.17 + 0.21 * Math.sin(th * 11 + 0.42 * Math.cos(t * 6 + th * 3)) ** 2 + 0.09 * Math.sin(th * 7 - t * 4)
    const dyed = blend(mult(dark, flow), glint, clamp(lock))
    const ash = gray * (0.2 + 0.8 * bell(Math.abs(th) - 1.25, 0.31)) * (0.57 + 0.43 * Math.cos(th * 80))
    return point(P, [uu, t], blend(blend(dyed, tint(0xa39689), ash), skin, 0.18 * (1 - smooth(0, 0.019, t))))
  })
  // Expose the part as a tapering strip of scalp, with darker roots at its edges.
  if (style !== 'wrapped') {
    ornament.grid(5, 32, (u, v) => {
      const t = 0.008 + 0.79 * v,
        w = (0.00077 + 0.00052 * Math.sin(Math.PI * v)) * (1 - 0.78 * v) * (0.82 + 0.18 * Math.cos(27 * v))
      const rad = Math.max(0.025, a.dimensions(mix(line(part), 0.233, t))[0])
      const division = part + 0.052 * t + 0.019 * Math.sin(t * Math.PI * 2)
      const P = cap(division + ((u - 0.5) * 2 * w) / rad, t, 0.00025)
      const center = Math.sin(Math.PI * u) ** 1.15
      return point(
        P,
        [u, v],
        blend(mult(dark, 1.1), skin, (0.2 + 0.071 * (1 - v) + 0.063 * Math.sin(v * 24)) * center),
      )
    })
  }
  // Broad, overlapping sections were drawn from the part to the ears; each
  // carries finer parallel grooves. They change width and turn over the skull.
  // Their ends meet the cap at both the forehead and the crown.
  for (const side of [-1, 1])
    for (let j = 0; j < 9; j++) {
      const q = j / 8,
        origin = part + side * (0.026 + q * 2.47 + 0.025 * Math.sin(j * 2.07 + side))
      const width = 0.032 + 0.065 * (0.5 + 0.5 * Math.sin(j * 1.71 + 0.24))
      const first = 0.002 + 0.085 * (0.5 + 0.5 * Math.sin(j * 2.3 + side)),
        end = 0.53 + 0.38 * (0.5 + 0.5 * Math.sin(j * 5.18))
      head.grid(3, 17, (u, v) => {
        const t = mix(first, end, v),
          taper = Math.max(0, Math.sin(Math.PI * v)) ** 0.47
        const th =
          origin +
          (u - 0.5) * width * taper +
          side * 0.064 * Math.sin(Math.PI * v) +
          0.018 * Math.sin(v * 7 + j) * taper
        const ridge = Math.sin(Math.PI * u) * taper,
          raised = 0.0001 + 0.00066 * ridge
        const P = cap(th, t, raised)
        const dye = blend(dark, glint, 0.25 + 0.23 * ridge + 0.08 * Math.sin(3 * j))
        return point(P, [th / tau + 0.5 + 0.006 * u, t], mult(dye, 0.88 + 0.14 * u))
      })
    }
  // Soft locks wrap the temple surface. Each root begins inside the cap, then
  // tapers flush against its own patch of skin; their roots are also inked in the atlas.
  for (const side of [-1, 1]) {
    for (let j = 0; j < 12; j++) {
      const th = side * (1.02 + j * 0.022),
        boundary = line(th),
        dir = (j - 5) * 0.00015
      const coords = []
      for (let k = 0; k <= 6; k++) {
        const u = k / 6,
          ang = th + side * 0.052 * u + 0.014 * Math.sin(Math.PI * u)
        const y = boundary + 0.008 - u * (0.011 + (j % 4) * 0.0018) - 0.0015 * Math.sin(u * Math.PI)
        const pos = a.point(ang, y),
          out = 0.00025 + 0.00046 * Math.sin(Math.PI * u)
        pos[0] += Math.sin(ang) * out
        pos[2] += Math.cos(ang) * out
        pos[1] += dir * u
        coords.push(pos)
      }
      sweep(head, coords, (t) => 0.00009 + 0.00064 * (1 - t) ** 0.88, mult(dark, 0.86 + j * 0.027), 8, 4)
    }
    for (let j = 0; j < 8; j++) {
      const th = side * (1.86 + 0.087 * j),
        y = line(th),
        coords = []
      for (let k = 0; k < 5; k++) {
        const t = k / 4,
          angle = th + side * 0.085 * t,
          at = a.point(angle, y + 0.004 - (0.008 + 0.002 * (j % 3)) * t)
        at[0] += 0.00059 * Math.sin(angle)
        at[2] += 0.00059 * Math.cos(angle)
        coords.push(at)
      }
      sweep(head, coords, (t) => 0.0001 + 0.00108 * (1 - t) ** 0.75, mult(dark, 0.93 + j * 0.025), 7, 4)
    }
  }
  function cord(coords, radii, colour = dark, length = 23, sides = 10) {
    sweep(
      head,
      coords,
      radii,
      (v, u) => mult(colour, 0.87 + 0.25 * Math.cos(u * tau * 3 + 0.45 * Math.sin(v * tau))),
      length,
      sides,
    )
  }
  function hairBall(c, r, styleSeed = 0) {
    head.grid(36, 19, (u, v) => {
      const th = (u - 0.5) * tau,
        lat = (v - 0.5) * Math.PI,
        C = Math.cos(lat)
      const grain = 1 + 0.045 * Math.sin(th * 8 + v * 7 + styleSeed) + 0.024 * Math.sin(th * 16 + v * 12)
      const P = [
        c[0] + r[0] * C * Math.sin(th) * grain,
        c[1] + r[1] * Math.sin(lat),
        c[2] + r[2] * C * Math.cos(th) * grain,
      ]
      return point(P, [u + v * 0.22, v], mult(dark, 0.88 + 0.31 * (0.5 + 0.5 * Math.sin(th * 9 + v * 8))))
    })
  }
  function twist(c, rx, ry, rz, turns, rad) {
    const pts = []
    for (let k = 0; k <= 46; k++) {
      const t = k / 46,
        th = -0.7 + turns * t * tau,
        r = 0.93 - 0.39 * t + 0.055 * Math.sin(th * 2.0 + 0.8)
      pts.push([
        c[0] + rx * r * Math.cos(th) + 0.0016 * Math.sin(2 * th),
        c[1] + ry * r * (0.9 * Math.sin(th) + 0.09 * Math.sin(2 * th - 0.5)),
        c[2] - rz * (0.22 + 0.65 * t) + 0.0034 * Math.cos(1.8 * th),
      ])
    }
    cord(pts, (t) => rad * (0.54 + 0.46 * Math.sin(Math.PI * (0.12 + 0.75 * t))), glint, 73, 9)
  }
  function band(c, rx, rz, h, colour, tilt = 0) {
    ornament.grid(32, 4, (u, t) => {
      const th = u * tau,
        si = Math.sin(th),
        co = Math.cos(th),
        w = 1 + 0.028 * Math.sin(Math.PI * t)
      return point(
        [c[0] + w * rx * si, c[1] + (t - 0.5) * h + tilt * si, c[2] + w * rz * co],
        [u, t],
        mult(colour, 0.81 + 0.19 * Math.sin(Math.PI * t)),
      )
    })
  }
  function pin(cx, cy, cz, extent, design) {
    const pts = [
      [-extent + cx, cy - 0.007, cz + 0.003],
      [cx, cy, cz],
      [cx + extent, cy + 0.009, cz + 0.002],
    ]
    sweep(
      ornament,
      pts,
      (t) => 0.0015 * (0.22 + 0.78 * smooth(0, 0.15, t)),
      design ? brass : tint(0x80664e),
      15,
      8,
    )
    const x = cx + extent,
      y = cy + 0.01,
      z = cz + 0.002
    if (design) {
      ovoid(ornament, [x, y, z], [0.0037, 0.0037, 0.0037], brass, 12, 8)
      for (let i = 0; i < 5; i++) {
        const th = (i * tau) / 5
        ovoid(
          ornament,
          [x + 0.0035 * Math.sin(th), y + 0.0035 * Math.cos(th), z - 0.0009],
          [0.0024, 0.0033, 0.0017],
          i % 2 ? silvery : tint(0x96aa94),
          10,
          7,
          -th,
        )
      }
      ovoid(ornament, [x, y, z - 0.0028], [0.00155, 0.00155, 0.00135], tint(0xe0bf83), 9, 6)
    } else ovoid(ornament, [x, y, z], [0.0027, 0.002, 0.0022], tint(0x95704d), 10, 6)
  }
  if (style === 'knot') {
    hairBall([0, 0.222, -0.05], [0.028, 0.026, 0.03], 2)
    twist([0, 0.223, -0.066], 0.027, 0.02, 0.011, 1.46, 0.0048)
    band([0, 0.213, -0.046], 0.025, 0.027, 0.0072, ribbon, -0.0015)
    pin(0, 0.228, -0.056, 0.047, false)
  } else if (style === 'coil') {
    hairBall([0, 0.136, -0.106], [0.034, 0.036, 0.022], 4)
    twist([0, 0.136, -0.119], 0.03, 0.032, 0.012, 1.56, 0.0051)
    cord(
      [
        [-0.002, 0.116, -0.124],
        [-0.014, 0.129, -0.126],
        [-0.002, 0.144, -0.132],
        [0.01, 0.148, -0.13],
        [0.019, 0.139, -0.124],
      ],
      (t) => 0.0042 * (0.42 + 0.58 * Math.sin(Math.PI * t)),
      glint,
      27,
      8,
    )
    pin(0.004, 0.147, -0.111, 0.053, true)
  } else if (style === 'loop') {
    hairBall([0, 0.154, -0.104], [0.033, 0.031, 0.025], 6)
    for (const s of [-1, 1]) {
      const pts = [
        [0, 0.129, -0.105],
        [s * 0.021, 0.137, -0.114],
        [s * 0.033, 0.154, -0.117],
        [s * 0.03, 0.182, -0.106],
        [s * 0.02, 0.195, -0.095],
        [s * 0.009, 0.189, -0.098],
        [s * 0.011, 0.172, -0.113],
        [s * 0.016, 0.15, -0.121],
        [0, 0.135, -0.115],
      ]
      cord(pts, (t) => 0.0061 + 0.0026 * Math.sin(Math.PI * t), s === 1 ? dark : glint, 39, 12)
    }
    twist([0, 0.132, -0.11], 0.019, 0.014, 0.012, 1.1, 0.0047)
    pin(0.009, 0.156, -0.112, 0.051, true)
  } else if (style === 'braid') {
    const pts = [[], [], []]
    for (let i = 0; i <= 54; i++) {
      const u = i / 54,
        rad = 0.0093 * (1 - 0.72 * u)
      for (let k = 0; k < 3; k++) {
        const th = u * tau * 3.9 + (k * tau) / 3
        pts[k].push([
          0.02 * u * u + rad * Math.sin(th),
          0.104 - 0.139 * u,
          -0.099 - 0.013 * Math.sin(Math.PI * u) + rad * 0.75 * Math.cos(th),
        ])
      }
    }
    for (let k = 0; k < 3; k++) cord(pts[k], (t) => 0.006 * (1 - 0.59 * t), k === 1 ? glint : dark, 62, 8)
    band([0, 0.108, -0.098], 0.013, 0.012, 0.007, ribbon)
    band([0.019, -0.032, -0.101], 0.0063, 0.006, 0.0067, ribbon, 0.001)
    cord(
      [
        [0.019, -0.034, -0.101],
        [0.02, -0.041, -0.1],
        [0.015, -0.05, -0.102],
      ],
      (t) => 0.0048 * (1 - 0.92 * t),
      dark,
      13,
      8,
    )
  } else if (style === 'half') {
    for (let k = -2; k <= 2; k++) {
      const x = k * 0.01
      cord(
        [
          [x, 0.147, -0.096],
          [x * 1.36, 0.111, -0.101],
          [x * 1.58, 0.073, -0.099],
          [x * 1.26 + 0.005, 0.035, -0.091],
          [x * 0.92 + 0.011, -0.001 + Math.abs(k) * 0.007, -0.084],
        ],
        (t) => [0.0102 * (1 - 0.78 * t * t), 0.0064 * (1 - 0.82 * t * t)],
        k % 2 ? dark : glint,
        30,
        10,
      )
    }
    hairBall([0.001, 0.167, -0.1], [0.024, 0.019, 0.024])
    twist([0, 0.164, -0.113], 0.021, 0.015, 0.009, 1.1, 0.0048)
    band([0, 0.159, -0.099], 0.021, 0.018, 0.0052, ribbon)
    pin(0, 0.17, -0.103, 0.035, false)
  } else if (style === 'wrapped') {
    const cloth = blend(tint(p.colors.binding, 1.15), tint(0x6d7a80), 0.22),
      hem = blend(cloth, tint(p.colors.motif), 0.28)
    ornament.grid(86, 11, (u, v) => {
      const th = (u - 0.5) * tau,
        az = Math.abs(th),
        height = 0.029 + 0.005 * Math.cos(th)
      const y = 0.166 + 0.0025 * Math.sin(th) - 0.047 * smooth(0.45, 2.84, az) + (v - 0.45) * height
      // The kerchief follows the full skull, even at the bare frontal hairline.
      const P = a.point(th, y),
        out = 0.004 + 0.0009 * Math.sin(v * Math.PI) + 0.00085 * Math.sin(v * 15 + th * 1.8)
      P[0] += Math.sin(th) * out
      P[2] += Math.cos(th) * out
      const stripe = v < 0.11 || v > 0.89
      return point(P, [u, v], stripe ? hem : mult(cloth, 0.89 + 0.15 * Math.sin(v * 15 + th * 1.8)))
    })
    for (const s of [-1, 1]) {
      const coords = [
        [0, 0.121, -0.108],
        [0.008 * s, 0.115, -0.118],
        [0.01 * s, 0.104, -0.122],
        [0.016 * s, 0.084, -0.115],
        [0.022 * s, 0.07, -0.111],
      ]
      sweep(ornament, coords, (t) => [0.0064 * (0.95 - 0.45 * t), 0.0017 * (1 - 0.2 * t)], cloth, 18, 6)
    }
    ovoid(ornament, [0, 0.121, -0.108], [0.012, 0.009, 0.011], hem, 15, 9, 0.35)
    hairBall([0.002, 0.138, -0.108], [0.019, 0.021, 0.021])
  }
  if (!silk)
    silk = new T.MeshStandardMaterial({
      name: '梳篦发丝',
      vertexColors: true,
      map: hairMap(),
      roughness: 0.69,
      side: T.DoubleSide,
    })
  if (!details)
    details = new T.MeshStandardMaterial({
      name: '钗钿与布帻',
      vertexColors: true,
      roughness: 0.58,
      metalness: 0.15,
      side: T.DoubleSide,
    })
  group.add(head.mesh(silk, '发际、梳纹与发髻'))
  if (ornament.index.length) group.add(ornament.mesh(details, '分缝与簪带'))
}
