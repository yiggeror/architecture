import { facialPlanes } from './characterFacialPlanes.js'
import { nasalBridge } from './characterNasalCartilage.js'
import { faceDesigns } from './characterFaceDesign.js'

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const mix = (a, b, t) => a + (b - a) * t
export function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const bell = (x, r) => Math.exp(-((x / r) ** 2))
function section(skull, y, k) {
  let i = 0
  while (i < skull.length - 2 && skull[i + 1][0] < y) i++
  const a = skull[i],
    b = skull[i + 1],
    p = skull[Math.max(0, i - 1)],
    q = skull[Math.min(skull.length - 1, i + 2)]
  const h = b[0] - a[0],
    t = clamp((y - a[0]) / h),
    t2 = t * t,
    t3 = t2 * t
  const va = (h * (b[k] - p[k])) / (b[0] - p[0]),
    vb = (h * (q[k] - a[k])) / (q[0] - a[0])
  return (2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * va + (-2 * t3 + 3 * t2) * b[k] + (t3 - t2) * vb
}
export function faceAnatomy(profile) {
  const f = profile.face,
    age = clamp((profile.age - 33) / 39)
  const family = profile.faceFamily ?? profile.design ?? 'silk'
  const model = faceDesigns[family] ?? faceDesigns.silk
  const O = model.orbit,
    N = model.nose,
    L = model.lips,
    M = model.malar
  const broad = profile.frame === 'broad' ? 1 : profile.frame === 'lean' ? -0.6 : 0
  const width = 1 + 0.046 * f.width
  const er = 0.001 * O[2] + 0.00063 * f.eyes
  // Original semi-realistic character design: the separation of the medial
  // commissures is close to one fissure. Each sitter retains a different
  // tilt, eye length, tarsal height and cheek-to-outer-canthus relationship.
  const inner = 0.001 * O[1] + 0.00042 * f.width + 0.00025 * f.nose + 0.00028 * f.eyes,
    ec = inner + er
  const ey = 0.001 * O[0] + 0.00125 * f.brow + 0.0014 * f.chin - 0.00055 * age
  const ala = 0.001 * N[1] + 0.00095 * f.nose + 0.00031 * age + 0.00037 * f.width,
    nw = ala * 0.66
  const noseY = 0.001 * N[0] - 0.00145 * f.nose - 0.00075 * age
  const mouthY = 0.001 * L[0] + 0.00155 * f.chin - 0.00105 * f.nose - 0.00077 * age
  const mw = 0.001 * L[1] + 0.0022 * f.lips + 0.001 * f.jaw
  const asym = Math.sin((profile.seed % 117) * 1.37)
  const slender = family === 'lute' || family === 'scholar',
    strong = family === 'scholar' || family === 'drummer' || family === 'boatman'
  const nasal = nasalBridge(family, f, ala, noseY, ey)
  const planes = facialPlanes(family)
  const expressive = Boolean(nasal)
  const arch = { silk: 4.25, lute: 5.9, scholar: 2.42, drummer: 4.22, boatman: 2.2, market: 4.0 }[family] ?? 3.9
  function orbit(sign, u) {
    const span =
      Math.max(0, 1 - u * u) **
      (family === 'silk' ? 0.81 : family === 'lute' ? 0.67 : family === 'scholar' ? 0.85 : 0.73)
    const tilt = 0.001 * O[5] + 0.00065 * f.eyes - 0.00058 * age
    const y = ey + sign * 0.00043 * asym + tilt * u - 0.00042 * u * u
    const medialFold =
      (family === 'silk' ? 0.00092 : family === 'market' ? 0.00088 : slender ? 0.00067 : 0.00045) *
      bell(u + 0.73, 0.22)
    const outer =
      (family === 'silk' ? 0.00054 : family === 'drummer' ? 0.00038 : family === 'lute' ? -0.00052 : 0) *
      smooth(0.18, 0.85, u)
    const arch =
      ((family === 'silk' ? 0.00054 : family === 'boatman' ? -0.00032 : 0.00014) + sign * 0.0002 * asym) *
      bell(u + 0.2, 0.47)

    // The upper sweep crests nasal to the iris and the lower sweep temporal
    // to it. The curved medial hood shields the lacrimal lake at the nose.
    const innerHood = expressive ? 0.00065 * bell(u + 0.73, 0.21) * span : 0
    const outerLift = expressive ? (0.00095 + 0.0004 * sign * asym) * smooth(0.15, 0.9, u) : 0
    return {
      x: sign * (ec + er * u),
      y,
      u,
      side: sign,
      top:
        y +
        (0.001 * O[3] + 0.0007 * f.eyes - 0.00056 * age) * (1 - 0.32 * u) * span +
        (arch - medialFold + outer) * span -
        innerHood +
        outerLift * span,
      bottom:
        y -
        (0.001 * O[4] + 0.00037 * f.eyes - 0.00022 * age) * (1 + 0.37 * u) * span +
        (outer * 0.45 + outerLift) * span,
      span,
    }
  }
  function browLine(sign, u) {
    const start = inner - (slender ? 0.0048 : 0.0041),
      length = 2 * er + (strong ? 0.017 : 0.015)
    const lift =
      arch * Math.sin(Math.PI * (u * (family === 'lute' ? 0.96 : 0.84) + 0.012)) +
      (family === 'silk' ? 1.55 : family === 'scholar' ? 2.4 : family === 'drummer' ? -0.7 : 0) * u +
      f.brow * (1.0 + u)
    const incline =
      family === 'scholar' ? 0.0016 * Math.sin(u * 2.3) : family === 'lute' ? -0.0012 * u : 0.0003 * u
    return [
      sign * (start + u * length),
      ey +
        (family === 'lute' ? 0.00195 - 0.00445 * u : 0) +
        0.001 * (O[7] + lift) +
        (expressive ? 0.00135 * (1 - u) ** 2 : 0) +
        incline -
        0.0018 * u * u +
        sign * asym * (0.00094 * u + 0.00046 * Math.sin(Math.PI * u)),
    ]
  }
  function lip(x) {
    const u = x / mw,
      a = Math.abs(u),
      shape =
        Math.max(0, 1 - u * u) ** (strong ? 0.98 : family === 'lute' ? 1.05 : 1.11) *
        (1 - 0.21 * smooth(0.49, 0.97, a))
    const expression =
      family === 'drummer' ? 0.00044 : family === 'silk' ? 0.00003 : family === 'lute' ? 0.00055 : 0.00012
    const curve = family === 'scholar' ? 0.27 : family === 'boatman' ? 0.48 : family === 'drummer' ? 0.51 : 0.53
    const smile =
      family === 'silk'
        ? 0.00062 * smooth(0.48, 1, a) * (u > 0 ? 0.47 : 1)
        : family === 'lute'
          ? 0.00048 * smooth(0.48, 1, a) * (u > 0 ? 1 : 0.42)
          : 0
    const seam =
      mouthY +
      smile +
      (0.001 * (L[5] - 0.64 * age) + expression) * u * u +
      curve * (-0.00068 * bell(u, 0.22) + 0.00051 * bell(a - 0.4, 0.23)) +
      (expressive ? 0.00104 : 0.00041) * asym * u
    const fullness = 1 + 0.17 * f.lips - 0.14 * age
    const gap =
      (family === 'drummer' ? 0.00048 : family === 'lute' ? 0.00042 : 0.00015) *
      shape ** 1.5 *
      (1 - 0.2 * u * asym)
    return {
      u,
      seam,
      gap,
      shape,
      upper:
        seam +
        gap +
        fullness * (0.001 * L[2] + 0.001 * L[4] * bell(a - 0.26, 0.17) - 0.00032 * bell(u, 0.16)) * shape,
      lower: seam - gap - fullness * (0.001 * L[3] - 0.00068 * a) * shape,
    }
  }
  const leftCorner = lip(-mw).seam
  const rightCorner = lip(mw).seam
  const rows = new Map()
  function dimensions(y) {
    if (rows.has(y)) return rows.get(y)
    const S = model.sections
    const round = expressive ? 0.27 * smooth(0.045, 0.067, y) * (1 - smooth(0.125, 0.151, y)) : 0
    function skull(k) {
      const center = section(S, y, k)
      return round
        ? (1 - 2 * round) * center + round * (section(S, y - 0.009, k) + section(S, y + 0.009, k))
        : center
    }
    const row = [
      Math.max(
        0.00065,
        skull(1) * width +
          smooth(0.001, 0.016, y) * (0.00355 * f.jaw + 0.001 * age) * bell(y - 0.042, 0.036) +
          0.00165 * f.cheek * bell(y - 0.094, 0.024)
      ),
      skull(2) + (0.00225 * f.chin - 0.0011 * age) * bell(y - 0.018, 0.025),
      skull(3),
      skull(4) - (0.00139 * f.chin + 0.00072 * age) * bell(y - 0.133, 0.055),
    ]
    rows.set(y, row)
    return row
  }
  function relief(x, y) {
    const a = Math.abs(x),
      side = x < 0 ? -1 : 1,
      d = (dx, rx, dy, ry) => bell(dx, rx) * bell(dy, ry)
    const paired = (offset, rx, dy, ry) => (bell(x - offset, rx) + bell(x + offset, rx)) * bell(dy, ry)
    const malarY = 0.001 * M[1] + M[4] * (a - 0.001 * M[0]) + side * 0.00053 * asym
    let z
    if (planes) {
      z = planes(x, y)
      // Sitter-specific infraorbital angle, malar fullness and oral arch.
      z += (0.00075 * f.cheek + 0.00055 * side * asym) * d(a - 0.043, 0.02, y - malarY, 0.024)
      z -= (0.0007 * age + 0.0004 * f.brow) * d(a - ec, 0.018, y - ey, 0.009)
      z += (0.0006 + 0.00075 * f.jaw) * d(a - 0.052, 0.015, y - 0.046, 0.02)
      const archDepth = family === 'scholar' ? 0.0045 : family === 'drummer' ? 0.0048 : 0.00245
      z += archDepth * d(x, 0.03, y - mouthY - 0.002, 0.022)
      // The frontal process of the maxilla climbs to the inner orbit. Its
      // oblique plane connects the lacrimal fossa with the side of the nose.
      const medialWall = 0.01 + 0.14 * (ey - y)
      z += 0.0023 * paired(medialWall, 0.0112, y - ey + 0.012, 0.026)
      // A wide infraorbital buttress carries the lower lid into the cheek.
      z += 0.00185 * paired(0.034, 0.022, y - ey + 0.018, 0.015)
      // The canine eminences support the upper lip without a deep vertical
      // cleft at the midline. The cheek glides into the modiolus laterally.
      z += 0.00144 * paired(0.013, 0.01, y - mouthY - 0.009, 0.014)
      z -= 0.00155 * d(x, 0.02, y - mouthY + 0.0115, 0.0059)
      z += 0.00285 * paired(0.028, 0.017, y - mouthY - 0.002, 0.015)
      z -= 0.0007 * d(a - mw + 0.0008, 0.0085, y - mouthY - 0.001, 0.0065)
      if (family === 'silk') z += 0.00185 * paired(0.042, 0.023, y - 0.082 - 0.19 * (a - 0.042), 0.022)
      if (family === 'lute') z -= 0.001 * paired(0.047, 0.018, y - 0.059, 0.022)
    } else {
      z =
        (0.001 * M[2] + 0.0015 * f.cheek) *
        d(a - 0.001 * M[0], strong ? 0.021 : 0.026, y - malarY, strong ? 0.021 : 0.024)
      z += (0.001 * M[3] - 0.0013 * age) * d(a - 0.03, 0.027, y - malarY + 0.016, 0.026)
      z += 0.0018 * age * d(a - 0.043, 0.012, y - 0.035, 0.014)
      z -= (0.0011 + 0.0016 * age) * d(a - 0.052, 0.021, y - (malarY - 0.03), 0.026)
      z += (0.001 * model.chin[1] + 0.0009 * f.jaw) * d(a - 0.047, 0.024, y - 0.047, 0.027)
      z +=
        (slender ? 0.0056 : 0.0065) * d(a, 0.033, y - mouthY, 0.024) +
        0.001 * model.chin[0] * d(a, strong ? 0.023 : 0.016, y - 0.018, 0.011)
      z -= 0.00082 * d(a, 0.0215, y - mouthY + 0.0117, 0.0063)
      z += 0.00175 * d(a - 0.014, 0.013, y - mouthY - 0.008, 0.013)
      z +=
        (strong ? 0.0021 : 0.00196) *
        d(a - (ec + 0.01), strong ? 0.018 : 0.022, y - (ey - 0.014 + 0.32 * (a - ec)), strong ? 0.01 : 0.014)
      z -= (strong ? 0.0024 : 0.0014) * d(a - 0.063, 0.012, y - ey - 0.019, 0.016)
      z += 0.00088 * d(a - 0.0165, 0.018, y - mouthY + 0.0005, 0.013)
      z += 0.00053 * d(a - (mw + 0.01), 0.015, y - mouthY + 0.0024, 0.0125)
      z -= (0.001 * O[6] + 0.0012 * f.brow + 0.0016 * age) * d(a - ec, 0.0198, y - ey, 0.0116)
      const bu = clamp((a - inner + 0.004) / (2 * er + 0.015)),
        by = browLine(side, bu)[1]
      z +=
        ((strong ? 0.00465 : 0.00275) + 0.00105 * f.brow) *
        d(a - (ec + 0.0006), 0.022, y - by + 0.0017, strong ? 0.0078 : 0.0097)
      z += (0.0014 + 0.0018 * age) * d(a - (ec + 0.002), 0.0164, y - ey + 0.009, 0.0062)
      z += (strong ? 0.0024 : 0.001) * d(a - (ec + er + 0.003), 0.0056, y - ey - 0.004, 0.014)
      z += (strong ? 0.00165 : 0.00085) * d(a - (inner - 0.0037), 0.0125, y - ey - 0.019, 0.013)
      z += 0.00105 * paired(0.01 + 0.49 * (y - ey), 0.0112, y - ey - 0.0038, 0.0155)
      z += 0.0004 * paired(inner - 0.00015 + 0.16 * (y - ey), 0.004, y - ey - 0.0009, 0.0071)
      z += 0.0018 * d(a, 0.012, y - ey - 0.015, 0.014)
      z -= (0.00255 - 0.00052 * broad) * d(a, 0.0127, y - ey + 0.0003, 0.0083)
    }
    if (nasal) z += nasal(x, y)
    else {
      const length = y - noseY
      const mid = (ey - noseY) * 0.58
      // Bone, lateral cartilage, paired domes and the alar lobules have
      // different footprints. The bridge narrows above the supratip, while
      // the soft infratip rolls continuously onto the nasal base.
      const tipWidth = 0.001 * N[5] + 0.00072
      const dorsum = 0.001 * N[4] + 0.0024 * smooth(0.008, 0.035, length)
      z += 0.001 * N[2] * (1 + 0.15 * f.nose) * d(x, dorsum, length - mid, (ey - noseY) * 0.67)
      z += 0.001 * (N[3] + 0.49 * N[6]) * (1 + 0.12 * f.nose) * d(x, tipWidth, length - 0.0066, 0.0112)
      z += (0.00098 + 0.00012 * N[6]) * paired(0.0042, 0.0061, length - 0.0054, 0.0072)
      z += 0.00225 * paired(nw * 0.78 + 0.11 * length, 0.0106, length - 0.012, 0.019)
      z += (0.00615 + 0.0001 * N[5] + 0.0007 * f.nose) * paired(nw + 0.00035, 0.0071, length - 0.0012, 0.0064)
      z += 0.001 * N[7] * d(a, 0.0045, length + 0.0037, 0.0052)
      const nostril = noseY - 0.0025 + 0.24 * (a - nw)
      z -= 0.00065 * d(a - nw + 0.001, 0.00365, y - nostril, 0.0025)
      z -= 0.00076 * d(a - nw - 0.0057, 0.0036, y - noseY - 0.0018, 0.0058)
    }
    z +=
      (expressive ? 0.00115 : slender ? 0.00029 : 0.0004) *
      paired(0.0041 + 0.07 * (noseY - y), 0.0032, y - (mouthY + 0.0105), 0.0058)
    z -= (strong ? 0.00013 : 0.00025) * d(a, 0.0042, y - (mouthY + 0.0107), 0.0064)
    // The mucosal cushions overlap inside the orbicularis oris. At the
    // commissures they taper in all three dimensions, into a broad modiolar
    // plane. A cut-off depression here reads as a second, white mouth corner.
    if (a < mw && Math.abs(y - mouthY) < 0.022) {
      const l = lip(x),
        hU = l.upper - l.seam,
        hL = l.seam - l.lower
      const weight = l.shape * (0.77 + 0.23 * l.shape)
      const tubercle = 0.00032 * bell(x, 0.0062)
      const elevation = 1 + 0.13 * f.lips
      const upper = ((expressive ? 0.00172 : 0.00108) + 0.0002 * L[2] + tubercle) * elevation
      const lower =
        ((expressive ? 0.00202 : 0.00122) + 0.00022 * L[3] + 0.00022 * bell(a - 0.006, 0.009)) * elevation
      if (expressive) {
        const yU = l.seam + l.gap,
          yL = l.seam - l.gap
        const fullness = family === 'scholar' ? 0.92 : 0.93
        const dU = Math.max(0.0003, l.upper - yU),
          dL = Math.max(0.0003, yL - l.lower)
        // At the seam the lip rounds sharply into the mouth, while the outer
        // vermilion boundary rolls more gradually into the white lip and chin.
        const upCentre = yU + 0.46 * dU,
          lowCentre = yL - 0.43 * dL
        z +=
          weight *
          fullness *
          ((upper + 0.00065 * bell(a - mw * 0.24, 0.007)) *
            bell(y - upCentre, (y > upCentre ? 0.65 : 0.41) * dU + 0.00045) +
            (lower + 0.00062 * bell(a - 0.006, 0.008)) *
              bell(y - lowCentre, (y < lowCentre ? 0.7 : 0.39) * dL + 0.00052) +
            0.00068 * bell(x, 0.0061) * bell(y - yU - 0.00115, 0.0021) -
            0.0008 * bell(y - l.seam, l.gap + 0.0011))
      } else
        z +=
          weight *
          (upper * bell(y - l.seam - 0.42 * hU, 0.78 * hU + 0.00145) +
            lower * bell(y - l.seam + 0.43 * hL, 0.73 * hL + 0.00162) -
            (expressive ? 0.0026 : 0.00059) * bell(y - l.seam, expressive ? 0.0013 : 0.00092))
    }
    const cornerY = side < 0 ? leftCorner : rightCorner
    z -= (strong ? 0.00036 : 0.00048) * d(a - mw, 0.0059, y - cornerY, 0.0038)
    const foldX = nw + 0.0068 + 0.36 * (noseY - y)
    const cheekFold = smooth(mouthY + 0.0012, mouthY + 0.0087, y)
    z -= 0.0011 * (0.4 + age) * cheekFold * d(a - foldX, 0.0032, y - (noseY - 0.012), 0.015)
    return z + Math.tanh(x / 0.011) * asym * 0.00058 * d(a - 0.045, 0.027, y - 0.075, 0.03)
  }
  function front(x, y, ring = dimensions(y)) {
    const cosine = Math.sqrt(Math.max(0, 1 - (x / Math.max(0.00005, ring[0])) ** 2))
    const power =
      mix(model.plane[1], model.plane[0], bell(y - 0.039, 0.045)) +
      ((strong ? 0.043 : 0.095) * bell(y - 0.151, 0.044) + (strong ? 0.022 : 0.065) * bell(y - 0.082, 0.036))
    return ring[2] + (ring[1] - ring[2]) * cosine ** power + relief(x, y) * smooth(0.06, 0.43, cosine)
  }
  function point(angle, y, ring = dimensions(y)) {
    const co = Math.cos(angle),
      x = ring[0] * Math.sin(angle)
    // The underside of the chin rises towards the hyoid. From the side this
    // exposes a real jaw angle and lifts the menton beneath the lower lip.
    const lift = expressive
      ? (family === 'lute' ? 0.0029 : family === 'silk' ? 0.0082 : family === 'scholar' ? 0.0042 : 0.0058) *
        (1 - smooth(0.001, 0.034, y)) *
        (1 - 0.18 * smooth(0.007, 0.024, y) * (1 - Math.max(co, 0)))
      : 0
    return [x, y + lift, co >= 0 ? front(x, y, ring) : ring[2] + (ring[3] - ring[2]) * (-co) ** model.plane[2]]
  }
  return {
    profile,
    model,
    family,
    age,
    broad,
    asym,
    ec,
    er,
    ey,
    ala,
    nw,
    noseY,
    mw,
    mouthY,
    width,
    orbit,
    browLine,
    lip,
    dimensions,
    front,
    point,
  }
}

const hairline = [
  [0, 0.174],
  [0.28, 0.178],
  [0.53, 0.174],
  [0.76, 0.162],
  [0.93, 0.145],
  [1.07, 0.121],
  [1.18, 0.094],
  [1.26, 0.094],
  [1.36, 0.115],
  [1.51, 0.124],
  [1.65, 0.125],
  [1.79, 0.116],
  [1.92, 0.104],
  [2.09, 0.084],
  [2.26, 0.07],
  [2.52, 0.063],
  [Math.PI, 0.061],
]
export function parting(a) {
  const style = a.profile.hair
  return (
    (style === 'wrapped'
      ? 0.1
      : style === 'loop'
        ? -0.28
        : style === 'braid'
          ? 0.14
          : style === 'half'
            ? 0.3
            : -0.04) +
    a.asym * 0.075
  )
}
export function hairEdge(a, theta) {
  const t = Math.abs(theta + 0.023 * a.asym * Math.sin(1.7 * theta)),
    phi = parting(a)
  let i = 0
  while (i < hairline.length - 2 && hairline[i + 1][0] < t) i++
  const A = hairline[i],
    B = hairline[i + 1],
    P = hairline[Math.max(0, i - 1)],
    Q = hairline[Math.min(hairline.length - 1, i + 2)]
  const w = B[0] - A[0],
    u = clamp((t - A[0]) / w),
    v = u * u,
    u3 = v * u
  const h =
    (2 * u3 - 3 * v + 1) * A[1] +
    ((u3 - 2 * v + u) * w * (B[1] - P[1])) / (B[0] - P[0]) +
    (-2 * u3 + 3 * v) * B[1] +
    ((u3 - v) * w * (Q[1] - A[1])) / (Q[0] - A[0])
  return (
    h +
    0.0044 * a.age * bell(t - 0.57, 0.65) -
    0.0022 * bell(theta - phi, 0.12) +
    0.0008 * Math.sin(theta * 15 + 0.8) +
    0.00038 * Math.sin(theta * 37)
  )
}
