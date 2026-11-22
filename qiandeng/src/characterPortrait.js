import * as T from 'three'
import { faceAnatomy, clamp, mix, smooth, bell } from './characterFaceSurface.js'
import { faceU, faceV, paintFace, eyeMap, cornealLight, skinFinish } from './characterFacePaint.js'
import { PortraitMesh, point, white } from './characterFaceMesh.js'
import { dressHair } from './characterHair.js'

const eyelidRows = [0, 0.036, 0.081, 0.15, 0.24, 0.35, 0.47, 0.61, 0.76, 0.9, 1]
const atlasUV = (x, y) => [faceU(x), faceV(y)]
let cornea, tearFilm
function ear(a, skin, s) {
  const z0 = -0.014 - 0.002 * a.broad,
    y0 = 0.1 + 0.002 * a.profile.face.nose
  // Traced in the sagittal plane. The superior helix turns into the concha,
  // while the lobule tilts back towards the jaw and has no rolled edge.
  const contour = new T.CatmullRomCurve3(
    [
      [0.01, 0.014],
      [0.006, 0.022],
      [-0.002, 0.025],
      [-0.009, 0.022],
      [-0.0135, 0.014],
      [-0.0145, 0.004],
      [-0.012, -0.005],
      [-0.008, -0.015],
      [-0.003, -0.022],
      [0.003, -0.023],
      [0.007, -0.019],
      [0.008, -0.01],
      [0.01, -0.004],
      [0.009, 0.003],
      [0.011, 0.008],
    ].map(([z, y]) => new T.Vector3(z, y, 0)),
    true,
    'centripetal'
  )
  skin.grid(
    49,
    18,
    (u, r) => {
      const edge = contour.getPointAt(u),
        z = edge.x * r + 0.0008 * (1 - r),
        y = edge.y * r - 0.0021 * (1 - r)
      const row = a.dimensions(y + y0),
        dz = z + z0 - row[2]
      const co = clamp(Math.abs(dz) / (dz > 0 ? row[1] - row[2] : row[2] - row[3])) ** (1 / 0.9)
      const root = row[0] * Math.sqrt(1 - co * co)
      const lobe = bell(y + 0.019, 0.0065),
        back = clamp((-z + 0.009) / 0.024)
      const roll = (0.00235 + 0.00155 * back) * (1 - 0.67 * lobe) * bell(r - 0.836, 0.135)
      const anti =
        0.00265 *
          bell(z - (-0.004 + 0.0025 * Math.sin((y + 0.009) * 85)), 0.0026) *
          bell(y - 0.0002, 0.0135) +
        0.00155 * bell(z - (0.0012 + 0.25 * (y - 0.008)), 0.0024) * bell(y - 0.01, 0.0061)
      const tragus = 0.0029 * bell(z - 0.0079, 0.0029) * bell(y + 0.003, 0.0046)
      const concha = bell(z - 0.0024, 0.005) * bell(y + 0.0015, 0.0082)
      const x =
        s *
        (root +
          0.0008 +
          0.0018 * r * back +
          0.0021 * lobe +
          roll +
          anti +
          tragus -
          0.00069 * concha -
          0.0018 * r ** 13)
      const c = [1 - 0.16 * concha, 0.91 - 0.29 * concha + 0.04 * lobe, 0.84 - 0.22 * concha + 0.06 * lobe]
      return point([x, y + y0, z + z0], atlasUV(s * 0.086, y + y0), c)
    },
    s < 0
  )
}
// The basal part of the nose folds downward and back into the maxilla. It is
// part of the same stitched face grid: a lighting change cannot reveal a decal
// edge between the dorsum, the two alar lobules and the underside of the tip.
function turnNose(a, p) {
  const x = p[0],
    baseY = p[1],
    side = Math.abs(x) / a.ala
  if (side >= 1 || Math.abs(baseY - a.noseY) > 0.012) return white
  // The two nares are oblique, teardrop-shaped recesses beneath the
  // lateral crura. The medial rim meets the columella lower than the ala.
  const dy = baseY - a.noseY,
    fade = 1 - smooth(0.78, 1, side)
  const sill = -0.00415 + 0.0022 * (side - 0.52)
  const v = (dy - sill) / 0.00212
  const center = 0.566 + 0.065 * v - 0.016 * v * v
  const radius = 0.178 * (1 + 0.13 * clamp(v, -1, 1))
  const rr = Math.hypot((side - center) / radius, v)
  const recess = bell(rr, 0.9),
    roll = bell(rr - 1.09, 0.34),
    septum = bell(x, 0.0037)
  const infratip = bell(x, 0.0095) * bell(dy - 0.00065, 0.0065)
  p[1] +=
    fade *
    (-0.0016 * infratip - 0.00085 * septum * bell(dy + 0.0027, 0.0043) + 0.0011 * recess - 0.00046 * roll)
  p[2] += fade * (0.0008 * infratip - 0.00165 * recess + 0.00034 * roll)
  // Pigment lives inside the cavity. Its edge follows the soft cartilage
  // rim, which the light can also find from the side or below.
  const shade = clamp((0.88 * bell(rr, 1.09) + 0.14 * bell(rr, 1.47)) * fade)
  return [1 - 0.74 * shade, 1 - 0.86 * shade - 0.014 * roll, 1 - 0.84 * shade - 0.018 * roll]
}
// The fixed skin stops at a closed rectangular chart around each orbit.
// All four sides of the moving eyelid share its vertices in rest space.
function orbitChart(a) {
  const radius = a.dimensions(a.ey)[0]
  const inner = Math.asin((a.ec - a.er - 0.0058) / radius),
    outer = Math.asin((a.ec + a.er + 0.007) / radius)
  const count = 36,
    angles = Array.from({ length: count + 1 }, (_, i) => mix(inner, outer, i / count))
  return { inner, outer, angles, count, low: a.ey - 0.0187, high: a.ey + 0.0208, sideY: [] }
}
function skinNormal(a, t, y) {
  const e = 0.00013,
    dt = 0.001
  const u = new T.Vector3(...a.point(t + dt, y)).sub(new T.Vector3(...a.point(t - dt, y)))
  const v = new T.Vector3(...a.point(t, Math.min(0.233, y + e))).sub(
    new T.Vector3(...a.point(t, Math.max(0, y - e)))
  )
  return u.cross(v).normalize().toArray()
}
function skinSurface(a, skin, chart) {
  const ys = []
  for (const [lo, hi, n] of [
    [0, 0.004, 5],
    [0.004, 0.012, 6],
    [0.012, 0.028, 7],
    [0.028, 0.038, 4],
    [0.038, 0.056, 23],
    [0.056, 0.064, 7],
    [0.064, 0.082, 23],
    [0.082, 0.102, 8],
    [0.102, 0.136, 16],
    [0.136, 0.18, 10],
    [0.18, 0.225, 9],
    [0.225, 0.233, 4],
  ]) {
    for (let i = 0; i < n; i++) ys.push(mix(lo, hi, i / n))
  }
  ys.push(0.233, chart.low, chart.high)
  ys.sort((a, b) => a - b)
  chart.sideY = ys.filter((y) => y >= chart.low && y <= chart.high)
  const theta = []
  for (const [lo, hi, n] of [
    [-Math.PI, -1.4, 24],
    [-1.4, -0.63, 18],
    [-0.63, -0.28, 10],
    [-0.28, 0.28, 34],
    [0.28, 0.63, 10],
    [0.63, 1.4, 18],
    [1.4, Math.PI, 24],
  ]) {
    for (let i = 0; i < n; i++) {
      const t = mix(lo, hi, i / n)
      if (Math.abs(t) < chart.inner || Math.abs(t) > chart.outer) theta.push(t)
    }
  }
  theta.push(Math.PI, ...chart.angles, ...chart.angles.map((v) => -v))
  theta.sort((a, b) => a - b)
  const rings = ys.map((y) => a.dimensions(y))
  // Preserve the thin lip and alar sections on the front. The jaw sides and
  // occiput use progressively longer edges. Adjacent columns stitch at their
  // actual heights, so the adaptive mesh has neither gaps nor T-junctions.
  let previous = null,
    previousAngle = 0
  for (const t of theta) {
    const angle = Math.abs(t),
      column = [],
      medial = angle === chart.inner,
      lateral = angle === chart.outer
    const inside = angle > chart.inner && angle < chart.outer,
      socket = inside || medial || lateral
    for (let j = 0; j < ys.length; j++) {
      const y = ys[j],
        distance =
          angle < 0.43
            ? 0
            : angle < 0.88
              ? y > 0.097 && y < 0.145
                ? 0.0026
                : 0.004
              : y > 0.207 || y < 0.025
                ? 0.0039
                : angle < 1.52
                  ? 0.0068
                  : 0.0088
      if (inside && y > chart.low && y < chart.high) continue
      const edge =
        socket &&
        (y === chart.low || y === chart.high || ((medial || lateral) && y > chart.low && y < chart.high))
      const spacing = y < 0.014 ? Math.min(distance, 0.0015) : distance
      if (!edge && j !== ys.length - 1 && column.length && y - column.at(-1).y < spacing) continue
      const p = a.point(t, y, rings[j]),
        ink = Math.cos(t) > 0.48 ? turnNose(a, p) : white
      const rear = Math.max(0, -Math.cos(t))
      const x = mix(p[0], Math.sign(t) * (0.082 + 0.009 * Math.min(1, rear * 2)), smooth(0, 0.62, rear))
      const v = point(p, atlasUV(x, y), ink)
      if (
        edge ||
        angle === Math.PI ||
        (y < 0.034 && angle < 2.2) ||
        (y > 0.034 && y < 0.063 && Math.cos(t) > 0.72 && Math.abs(x) < 0.039) ||
        (y > 0.048 && y < 0.2 && angle < 1.69 && (Math.abs(x) > a.ala + 0.002 || y > 0.095))
      )
        v.normal = skinNormal(a, t, y)
      column.push({ y, id: skin.vertex(v) })
    }
    if (previous) {
      let i = 0,
        j = 0
      while (i + 1 < previous.length || j + 1 < column.length) {
        const A = previous[i],
          B = column[j],
          nextA = previous[i + 1],
          nextB = column[j + 1]
        const takeA = nextA && (!nextB || nextA.y <= nextB.y),
          next = takeA ? nextA : nextB
        const mid = Math.abs((t + previousAngle) * 0.5)
        const hole =
          mid > chart.inner && mid < chart.outer && Math.min(A.y, B.y) >= chart.low && next.y <= chart.high
        if (!hole) skin.index.push(A.id, B.id, next.id)
        if (takeA) i++
        else j++
      }
    }
    previous = column
    previousAngle = t
  }
  ear(a, skin, -1)
  ear(a, skin, 1)
}
function fitGlobes(a) {
  const sides = {}
  for (const s of [-1, 1]) {
    const i = a.orbit(s, -1),
      o = a.orbit(s, 1)
    sides[s] = [a.front(i.x, i.y) + 0.00024, a.front(o.x, o.y) + 0.00022]
  }
  return sides
}
function globeDepth(a, o, y) {
  // Fit the oblate ocular globe to both canthi. Its front is a curved
  // corneal dome, independent of the socket's sculpted skin and brows.
  const ends = a.globes[o.side],
    horizontal = a.er / (a.er + 0.00255)
  const v = (y - o.y) / 0.01455
  const limb = Math.sqrt(1 - horizontal * horizontal)
  const sphere = Math.sqrt(Math.max(0.012, 1 - (o.u * horizontal) ** 2 - v * v))
  return mix(ends[0], ends[1], (o.u + 1) * 0.5) + 0.0113 * (sphere - limb)
}
function eyesAndLids(a, eyes, lids, s, chart) {
  const globe = (o, y) => globeDepth(a, o, y)
  const eyeMid = a.orbit(s, 0),
    irisRadius = irisSize(a, s)
  const lensY =
    eyeMid.bottom +
    irisRadius -
    (a.family === 'silk' || a.family === 'lute' || a.family === 'market' ? 0.00055 : 0.00077)
  eyes.grid(
    32,
    7,
    (uu, v) => {
      const u = -1 + 2 * uu,
        o = a.orbit(s, u),
        y = mix(o.bottom, o.top, v),
        z = globe(o, y)
      // A continuous patch from the clean sclera region of the atlas. The
      // coloured iris occupies its own curved disc and moves independently.
      const uv = [0.072 + 0.242 * ((u + 1) * 0.5) ** 0.69, 0.5 + (y - o.y) / 0.01785]
      const tear = bell(u + 0.95, 0.083),
        shade = 0.975 - 0.53 * smooth(0.61, 1, v)
      return point([o.x, y, z], uv, [shade, shade * (0.984 - 0.23 * tear), shade * (0.967 - 0.21 * tear)])
    },
    s < 0
  )
  for (const upper of [false, true]) {
    const height = upper ? chart.high : chart.low,
      dir = upper ? 1 : -1
    function surface(u, k, shut) {
      const o = a.orbit(s, u),
        edge = upper ? o.top : o.bottom
      const theta = s * mix(chart.inner, chart.outer, (u + 1) * 0.5)
      const outer = a.point(theta, height),
        blink = o.y - 0.001 * o.span + (upper ? -0.00022 : 0.00012) * o.span
      const x = mix(o.x, outer[0], k),
        y = mix(shut ? blink : edge, height, k)
      const outside = Math.max(0, dir * (y - edge)),
        body = a.front(x, y)
      const corner = body + (1 - smooth(0, 0.65, k)) * 0.00073
      if (o.span < 1e-7) return [x, y, corner]
      const cover = smooth(0, 0.002, dir * (edge - y))
      const fitted = globe(o, y) + (upper ? 0.0007 : 0.00051) + 0.0004 * cover
      const fold = upper
        ? 0.00041 * bell(outside - 0.002, 0.002) - 0.00058 * bell(outside - 0.005, 0.0019)
        : 0.00029 * bell(outside - 0.00165, 0.00175) - 0.00015 * bell(outside - 0.0053, 0.0028)
      const z =
        mix(fitted, body, smooth(0, upper ? 0.009 : 0.0106, outside)) +
        o.span * fold * smooth(0, 0.001, outside) * (1 - smooth(0.008, 0.012, outside))
      let skinZ = mix(corner, z, smooth(0.035, 0.63, o.span))
      // The tarsus must clear the entire translating corneal dome, including
      // the part several millimetres above the open rim. Without this fit the
      // upper limbus can pierce the crease as a disconnected dark speck.
      const lens = Math.hypot((x - s * a.ec) / (irisRadius + 0.0039), (y - lensY) / (irisRadius + 0.0027))
      if (lens < 1.43) {
        const here = a.orbit(s, clamp((s * x - a.ec) / a.er, -1, 1))
        const delta = globe(here, y) + 0.00108 - skinZ
        const join = 0.00035
        const lift = delta <= -join ? 0 : delta >= join ? delta : (delta + join) ** 2 / (4 * join)
        skinZ += lift * (1 - smooth(1.1, 1.43, lens))
      }
      return [x, y, skinZ]
    }
    lids.grid(
      chart.count,
      eyelidRows.length - 1,
      (uu, v, i, j) => {
        const u = 2 * uu - 1,
          o = a.orbit(s, u),
          k = eyelidRows[j],
          theta = s * chart.angles[i]
        const p = surface(u, k, false),
          closed = surface(u, k, true)
        const ink = (1 - smooth(0, 0.14, k)) * (0.07 + 0.93 * o.span) * (0.73 + 0.27 * smooth(-0.6, 0.7, u))
        const color = upper
          ? [1 - 0.74 * ink, 1 - 0.82 * ink, 1 - 0.81 * ink]
          : [1 - 0.09 * ink, 1 - 0.18 * ink, 1 - 0.2 * ink]
        const vtx = point(p, atlasUV(p[0], p[1]), color, closed)
        if (j === eyelidRows.length - 1) vtx.normal = skinNormal(a, theta, height)
        else if ((i <= 1 || i >= chart.count - 1) && k > 0.09)
          vtx.normal = skinNormal(a, Math.asin(p[0] / a.dimensions(p[1])[0]), p[1])
        return vtx
      },
      s < 0 === upper
    )
    const graceful = ['silk', 'lute', 'market'].includes(a.family)
    // The upper margin turns inward and actually overlaps the limbus.
    // Its lateral third is a dark, tapered wedge ending at the commissure.
    // There is no extension beyond the corner to lift away from the skin.
    lids.grid(
      61,
      5,
      (v, w) => {
        const u = upper ? mix(-0.97, 0.999, v) : mix(-0.35, 0.982, v)
        const o = a.orbit(s, u),
          edge = upper ? o.top : o.bottom
        const rootRamp = smooth(upper ? -0.97 : -0.35, upper ? -0.53 : 0.27, u)
        const tail = (1 - smooth(0.7, 1, u)) ** 0.66
        const width =
          (upper ? (graceful ? 0.00153 : 0.00131) : 0.00031) *
          rootRamp *
          tail *
          (0.66 + 0.57 * smooth(-0.1, 0.66, u))
        const over = (upper ? (graceful ? 0.00047 : 0.00038) : 0.000065) * rootRamp * tail
        const reach = mix(-over, width, w),
          k = Math.max(0, reach) / Math.abs(height - edge)
        const p = surface(u, k, false),
          q = surface(u, k, true)
        if (reach <= 0) {
          p[1] += dir * reach
          q[1] += dir * reach
          p[2] = Math.max(p[2], globe(o, p[1]) + 0.0008 * o.span)
          q[2] = Math.max(q[2], globe(o, q[1]) + 0.00088 * o.span)
        }
        p[2] += 0.000088
        q[2] += 0.000088
        const root = upper ? 0.023 : 0.205,
          soft = (upper ? 0.1 : 0.235) * w ** 3 + 0.2 * (1 - smooth(0, 0.22, v))
        return point(
          p,
          atlasUV(p[0], p[1]),
          [root + soft, root * 0.78 + soft * 0.81, root * 0.74 + soft * 0.82],
          q
        )
      },
      s < 0 === upper
    )
    const stems = upper ? 31 : 13
    for (let i = 0; i < stems; i++) {
      const u =
        (upper ? -0.67 : -0.19) + ((upper ? 1.59 : 1.11) * (i + 0.22 * Math.sin(i * 3.44))) / (stems - 1)
      const open = surface(u, 0, false),
        shut = surface(u, 0, true)
      const length =
        (upper ? 0.00135 + 0.00145 * (u + 0.72) : 0.00078 + 0.00072 * (u + 0.36)) *
        (0.88 + 0.14 * Math.sin(i * 2.91)) *
        (1 - 0.65 * smooth(0.68, 0.96, u))
      const dx = s * length * (0.28 + 0.31 * (u + 1)),
        w = (upper ? 0.00023 : 0.00013) * (1 + 0.2 * Math.sin(i * 0.87))
      lids.grid(
        1,
        3,
        (edge, t) => {
          const x = open[0] + dx * t + w * (edge - 0.5) * (1 - 0.97 * t)
          const yy = dir * (0.00007 + length * (0.31 * t + 0.44 * t * t))
          const zz = 0.00014 + length * (0.67 * t - 0.31 * t * t)
          return point(
            [x, open[1] + yy, open[2] + zz],
            atlasUV(open[0], open[1]),
            upper ? [0.052, 0.034, 0.034] : [0.22, 0.14, 0.13],
            [x, shut[1] + yy * (upper ? 0.37 : 0.76), shut[2] + zz]
          )
        },
        s < 0
      )
    }
  }
  // Complete the wedges between the commissures and the medial/lateral
  // orbital rim. They share the same outer row as the cheek and nose.
  for (const lateral of [false, true]) {
    const u = lateral ? 1 : -1,
      o = a.orbit(s, u),
      theta = s * (lateral ? chart.outer : chart.inner)
    lids.grid(
      chart.sideY.length - 1,
      eyelidRows.length - 1,
      (uu, v, i, j) => {
        const k = eyelidRows[j],
          h = chart.sideY[i],
          outer = a.point(theta, h)
        const x = mix(o.x, outer[0], k),
          y = mix(o.y, h, k)
        const z = a.front(x, y) + (1 - smooth(0, 0.65, k)) * 0.00073
        const p = [x, y, z],
          vtx = point(p, atlasUV(x, y), white, p)
        if (j === eyelidRows.length - 1) vtx.normal = skinNormal(a, theta, h)
        else if ((i === 0 || i === chart.sideY.length - 1) && k > 0.12)
          vtx.normal = skinNormal(a, Math.asin(x / a.dimensions(y)[0]), y)
        return vtx
      },
      s > 0 === lateral
    )
  }
}
// The pigmented disc travels over the fitted globe. Its top and bottom pass
// beneath the independent lids, so shifting gaze does not stretch the iris or
// alter the outline of the eye. The four directions are ordinary glTF morphs.
function irisSize(a, side) {
  const lively = ['silk', 'lute', 'market'].includes(a.family)
  return (lively ? 0.0072 : 0.00687) + 0.00015 * a.profile.face.eyes + 0.00004 * a.asym * side
}
function irises(a, material, coat = false) {
  function surface(dx, dy) {
    const patch = new PortraitMesh()
    for (const s of [-1, 1]) {
      const lightEye = a.family === 'silk' || a.family === 'lute' || a.family === 'market'
      const irisR = irisSize(a, s)
      const radius = irisR * (coat ? 1.1 : 1)
      const centreY = a.orbit(s, 0).bottom + irisR - (lightEye ? 0.00055 : 0.00077)
      patch.grid(
        coat ? 32 : 46,
        coat ? 5 : 9,
        (u, r) => {
          const angle = u * 2 * Math.PI,
            xx = r * Math.cos(angle),
            yy = r * Math.sin(angle)
          const x = s * a.ec + 0.00048 * a.asym - s * 0.00022 + radius * xx + dx
          const y = centreY + radius * yy + dy
          const o = a.orbit(s, clamp((s * x - a.ec) / a.er, -1, 1)),
            z = globeDepth(a, o, y) + (coat ? 0.00031 : 0.00013) + (coat ? 0.00036 : 0.000075) * (1 - r * r)
          const sh = 0.98 - 0.7 * smooth(o.top - 0.0042, o.top + 0.00016, y)
          return point(
            [x, y, z],
            [(259 + 83.8 * xx) / 512, 1 - (127 - 83.8 * yy) / 256],
            [sh, sh * 0.98, sh * 0.963]
          )
        },
        true
      )
    }
    return patch.geometry()
  }
  const g = surface(0, 0)
  const targets = [
    [0.0027, 0, '望左'],
    [-0.0027, 0, '望右'],
    [0, 0.0018, '抬眼'],
    [0, -0.0018, '垂眼'],
  ]
  g.morphAttributes.position = []
  g.morphAttributes.normal = []
  for (const [x, y, label] of targets) {
    const geom = surface(x, y),
      P = geom.attributes.position
    P.name = label
    g.morphAttributes.position.push(P)
    g.morphAttributes.normal.push(geom.attributes.normal)
  }
  const m = new T.Mesh(g, material)
  m.name = coat ? '泪膜与透明角膜' : '虹膜、瞳孔与角膜高光'
  return m
}
const attention = {
  umbrella: [0.18, -0.12],
  lantern: [-0.35, -0.2],
  basket: [-0.1, -0.32],
  watch: [0.18, 0.12],
  walk: [0.11, 0.02],
  carrier: [0.24, -0.19],
  porter: [-0.12, -0.38],
  row: [-0.31, -0.23],
  drum: [0.06, -0.32],
  flute: [0.37, -0.14],
  lute: [-0.28, -0.61],
  sit: [0.25, -0.05],
}
function look(profile, state, t, phase, eye) {
  const job = state?.job ?? profile.job,
    aim = attention[job] ?? attention.walk
  // A fixation holds through the gesture. Short saccades connect successive
  // points of attention; paired eyes share them and retain slight convergence.
  const q = t / (1.72 + (profile.seed % 39) * 0.021) + phase * 0.18 + (profile.seed % 13) * 0.3,
    k = Math.floor(q)
  const step = smooth(0.03, 0.105, q - k)
  const wander = (i, axis) => Math.sin((i + 1) * 4.639 + (profile.seed % 797) * 0.16 + axis * 2.51)
  const fixX = mix(wander(k - 1, 0), wander(k, 0), step),
    fixY = mix(wander(k - 1, 1), wander(k, 1), step)
  const x = clamp(aim[0] + (job === 'watch' ? 0.62 : 0.28) * fixX + 0.026 * Math.sin(1.16 * t + phase), -1, 1)
  const y = clamp(
    aim[1] +
      0.21 * fixY +
      0.017 * Math.sin(1.37 * t + 0.6 * phase + 0.42) -
      (job === 'porter' ? 0.43 * (state?.loading ?? 0) : 0),
    -1,
    1
  )
  const w = eye.morphTargetInfluences
  w[0] = Math.max(0, x)
  w[1] = Math.max(0, -x)
  w[2] = Math.max(0, y)
  w[3] = Math.max(0, -y)
}
// Soft-tissue landmarks in head-local metres. The nasal and zygomatic
// extrema are sampled from the same continuous surface used for the mesh.
export function portraitLandmarks(profile) {
  const a = faceAnatomy(profile)
  function sagittal(lo, hi, side) {
    let best = null
    for (let i = 0; i <= 72; i++) {
      const y = mix(lo, hi, i / 72),
        p = [0, y, a.front(0, y)]
      turnNose(a, p)
      if (!best || side * p[2] > side * best.z) best = new T.Vector3(...p)
    }
    return best
  }
  let cheekY = 0.095,
    peak = 0
  for (let i = 0; i <= 54; i++) {
    const y = mix(0.087, 0.102, i / 54),
      w = a.dimensions(y)[0]
    if (w > peak) {
      peak = w
      cheekY = y
    }
  }
  const subY = a.noseY - 0.0091
  const under = [0, subY, a.front(0, subY)]
  turnNose(a, under)
  const marks = {
    nasion: sagittal(a.ey - 0.0035, a.ey + 0.008, -1),
    gnathion: new T.Vector3(0, 0.0033, a.front(0, 0.0033)),
    pronasale: sagittal(a.noseY - 0.002, a.noseY + 0.012, 1),
    subnasale: new T.Vector3(...under),
    stomion: new T.Vector3(0, a.lip(0).seam, a.front(0, a.lip(0).seam)),
  }
  for (const [sign, key] of [
    [-1, 'R'],
    [1, 'L'],
  ]) {
    const o = a.orbit(sign, -1)
    marks['endocanthion' + key] = new T.Vector3(o.x, o.y, a.front(o.x, o.y) + 0.00024)
    const lateral = a.orbit(sign, 1)
    marks['exocanthion' + key] = new T.Vector3(lateral.x, lateral.y, a.front(lateral.x, lateral.y) + 0.00022)
    marks['alare' + key] = new T.Vector3(sign * a.ala, a.noseY, a.front(sign * a.ala, a.noseY))
    marks['zygion' + key] = new T.Vector3(...a.point((sign * Math.PI) / 2, cheekY))
    marks['gonion' + key] = new T.Vector3(...a.point(sign * 1.88, 0.0415 - 0.003 * a.broad))
  }
  return marks
}
export function portraitMouth(profile) {
  const a = faceAnatomy(profile),
    l = a.lip(0),
    y = l.seam
  // The flute rests against the vermilion, just in front of the closed seam.
  return new T.Vector3(0, y, Math.max(a.front(0, y + 0.0011), a.front(0, y - 0.0015)))
}
export function buildPortrait(profile) {
  const a = faceAnatomy(profile),
    skin = new PortraitMesh(),
    eyes = new PortraitMesh(),
    lids = new PortraitMesh()
  a.globes = fitGlobes(a)
  const chart = orbitChart(a)
  skinSurface(a, skin, chart)
  eyesAndLids(a, eyes, lids, -1, chart)
  eyesAndLids(a, eyes, lids, 1, chart)
  const map = paintFace(a)
  const flesh = new T.MeshStandardMaterial({
    name: '绢本肤色',
    map,
    color: map ? 0xffffff : profile.skin,
    vertexColors: true,
    roughness: 0.83,
    ...skinFinish(),
    side: T.DoubleSide,
  })
  flesh.normalScale.multiplyScalar(0.68 + 0.22 * a.age)
  flesh.userData.skin = true
  if (!cornea)
    cornea = new T.MeshStandardMaterial({
      name: '眼白与褐色虹膜',
      map: eyeMap(),
      color: 0xffffff,
      roughness: 0.19,
      emissive: 0xfff1dc,
      emissiveMap: cornealLight(),
      emissiveIntensity: 0.22,
      vertexColors: true,
      side: T.DoubleSide,
    })
  if (!tearFilm)
    tearFilm = new T.MeshPhysicalMaterial({
      name: '透明角膜与泪膜',
      color: 0xfff4df,
      metalness: 0,
      roughness: 0.16,
      clearcoat: 0.82,
      clearcoatRoughness: 0.095,
      ior: 1.376,
      specularIntensity: 1,
      transparent: true,
      opacity: 0.036,
      depthWrite: false,
    })
  const group = new T.Group()
  group.name = '面容·' + profile.name
  const eyelids = lids.mesh(flesh, '上下眼睑'),
    gaze = irises(a, cornea),
    coat = irises(a, tearFilm, true)
  coat.morphTargetInfluences = gaze.morphTargetInfluences
  group.add(skin.mesh(flesh, '面骨、五官与耳廓'), eyes.mesh(cornea, '巩膜与内眦泪阜'), eyelids, gaze, coat)
  dressHair(group, a)
  const period = 3.65 + (profile.seed % 207) * 0.0094,
    offset = ((profile.seed >>> 9) % 997) * 0.002
  group.userData.animate = (t, phase = 0, state) => {
    look(profile, state, t, phase, gaze)
    const q = T.MathUtils.euclideanModulo(t + offset + phase * 0.09, period)
    const blink = q < 0.092 ? smooth(0, 0.092, q) : q < 0.212 ? 1 - smooth(0.092, 0.212, q) : 0
    // A small tonic lid adjustment follows fixation between larger blinks.
    // A short baked walk therefore also carries a live, exportable lid track.
    const focus =
      0.009 + 0.012 * (0.5 + 0.5 * Math.sin(t * 1.43 + phase)) + 0.014 * gaze.morphTargetInfluences[3]
    eyelids.morphTargetInfluences[0] = blink + (1 - blink) * focus
  }
  group.userData.animate(0, (profile.seed % 19) * 0.052, { job: profile.job })
  group.userData.mouth = portraitMouth(profile)
  return group
}
