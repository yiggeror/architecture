import * as T from 'three'
import { nearbyResidents, reachResidents, residentLimit } from './reachPeople.js'
import {
  cloudCollar,
  collar,
  facePaint,
  feltHat,
  lanternBones,
  parasolSpokes,
  portrait,
  robeShape,
  sleeve,
  soleShade,
  wovenBrocade,
} from './peopleDress.js'

const tau = Math.PI * 2
const garments = [
  [0x355f63, 0x4d353d, 0xd2b992],
  [0x933c3c, 0x51323a, 0xe4b57c],
  [0xb47a4b, 0x565249, 0x594842],
  [0x718382, 0x384657, 0xead4ad],
  [0x9d646c, 0x6b4245, 0xe7bea4],
  [0x52677e, 0x394450, 0xcfb895],
  [0xc7ac81, 0x745543, 0x513c38],
  [0x526d54, 0x474447, 0xd7bf8b],
  [0x345168, 0x292e43, 0xc6a169],
  [0x746441, 0x39484a, 0xdec496],
  [0x4c717a, 0x724657, 0xe5cc98],
  [0x3e5161, 0x503943, 0xad865d],
]
function parasol() {
  const positions = [],
    colors = [],
    rings = [0, 0.13, 0.5, 0.83, 0.91, 0.96, 1]
  for (let j = 0; j < 20; j++)
    for (let k = 0; k < rings.length - 1; k++)
      for (let sub = 0; sub < 2; sub++) {
        const a = ((j + sub * 0.5) * tau) / 20,
          c = a + tau / 40
        function point(theta, r, edge) {
          const y = 0.45 * (1 - r ** 1.6) + 0.027 * Math.cos(20 * theta) * r * r
          return [Math.sin(theta) * r, y - (edge && sub === 1 ? 0.013 : 0), Math.cos(theta) * r]
        }
        const p0 = point(a, rings[k]),
          p1 = point(c, rings[k]),
          p2 = point(c, rings[k + 1], true),
          p3 = point(a, rings[k + 1], true)
        const val = k === 3 ? 0.66 : k === 4 ? 1.22 : (j % 4 === 0 ? 0.91 : 1) * (sub === 0 ? 1 : 0.93)
        for (const p of [p0, p3, p2, p0, p2, p1]) {
          positions.push(...p)
          colors.push(val, val * (k === 4 ? 0.84 : 1), val * (k === 4 ? 0.57 : 1))
        }
      }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

// At the opposite quay the head, hair and robe are solid silhouettes. Vertex
// colour supplies the hairline and the darker hem without an extra draw.
function distantHead() {
  const g = new T.SphereGeometry(1, 6, 4),
    v = g.attributes.position,
    colors = []
  for (let i = 0; i < v.count; i++) {
    const hair = v.getY(i) > 0.33 || (v.getZ(i) < -0.22 && v.getY(i) > -0.45)
    colors.push(...(hair ? [0.047, 0.034, 0.029] : [0.87, 0.6, 0.42]))
  }
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  return g
}
function distantCoat() {
  const g = new T.LatheGeometry(
    [
      [0.92, 0],
      [1, 0.055],
      [0.64, 0.49],
      [0.89, 0.78],
      [0.84, 0.88],
      [0.39, 1],
    ].map(([x, y]) => new T.Vector2(x, y)),
    6
  )
  const p = g.attributes.position,
    c = []
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i),
      value = y < 0.5 ? 0.41 : 1
    c.push(value, value * (y < 0.5 ? 0.96 : 1), value)
  }
  g.setAttribute('color', new T.Float32BufferAttribute(c, 3))
  return g
}
function distantParasol() {
  const vertices = [],
    colors = [],
    count = 10
  function tip(i, r, y) {
    const a = (i * tau) / count
    return [r * Math.sin(a), y, r * Math.cos(a)]
  }
  for (let i = 0; i < count; i++) {
    const a = tip(i, 0.48, 0.29),
      b = tip(i + 1, 0.48, 0.29),
      c = tip(i, 1, 0.014 * (i % 2)),
      d = tip(i + 1, 1, 0.014 * ((i + 1) % 2))
    const shade = i % 2 ? 0.84 : 1
    for (const p of [[0, 0.44, 0], a, b, a, c, d, a, d, b]) {
      vertices.push(...p)
      colors.push(shade, shade, shade)
    }
  }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}
function actors(ships) {
  const list = []
  function boat(i, x, z, yaw, job, dress, size = 1) {
    list.push({
      ship: ships[i],
      x,
      z,
      y: ships[i].spec.deck + 0.015,
      yaw,
      job,
      dress,
      size,
      phase: list.length * 0.83,
    })
  }
  for (const z of [-4.48, -3.16])
    for (const s of [-1, 1]) boat(0, s * 1.08, z + 0.25, s * 0.52, 'row', s === 1 ? 0 : 2, 0.97)
  boat(0, 0.06, 6.02, Math.PI, 'drum', 1, 1.04)
  boat(0, 0.58, 3.9, -0.35, 'flute', 3, 1)
  boat(0, -0.44, -5.47, 0.86, 'lantern', 6, 1.01)
  boat(1, -0.18, -2.58, -0.52, 'row', 0)
  boat(1, 0.05, 3.01, Math.PI, 'drum', 1, 0.98)
  boat(1, 0.12, 0.1, 0.52, 'lute', 4, 0.97)
  boat(2, -0.11, -2.47, -0.38, 'row', 2)
  boat(2, 0.26, 0.03, 0.78, 'sit', 5, 0.97)
  boat(3, -0.12, -2.78, -0.46, 'row', 6)
  boat(4, -0.18, -3.56, -0.52, 'row', 2)
  boat(4, 0.45, -0.55, 2.76, 'sit', 4, 1)
  boat(4, -0.44, 0.7, -0.76, 'sit', 5, 1.04)
  boat(4, -0.16, 3.66, 1.07, 'lantern', 7, 0.97)
  boat(5, -0.17, -1.82, -0.5, 'row', 7)
  boat(5, 0.1, 0.69, Math.PI, 'sit', 6, 0.96)
  boat(5, -0.17, 1.8, Math.PI, 'sit', 4, 0.98)
  boat(6, 0, -2.42, -0.48, 'row', 2, 0.97)
  boat(6, -0.16, 0.19, -1.02, 'sit', 6, 0.95)
  // Each pair walks an elongated loop on its own stretch of raised paving.
  const streets = [
    [-1, 30.2, 12.5, 0.26, 'umbrella', 'lantern'],
    [-1, 60.1, 12.2, 2.86, 'basket', 'walk'],
    [1, 22.8, 12.4, 3.92, 'lantern', 'walk'],
    [1, 59.7, 12.7, 4.82, 'umbrella', 'basket'],
    [-1, -38.7, 11.4, 1.52, 'lantern', 'walk'],
    [1, -41.2, 11.0, 4.2, 'umbrella', 'lantern'],
    [-1, 15.3, 7.7, 4.82, 'walk', 'basket'],
  ]
  streets.forEach(([side, center, radius, phase, one, two], i) => {
    for (const [j, job] of [one, two].entries())
      list.push({
        side,
        center,
        radius,
        phase,
        number: j,
        job,
        dress: (i * 3 + j * 3 + 1) % 8,
        size: j === 0 ? 0.96 + 0.025 * (i % 4) : 0.93 + 0.025 * (i % 3),
        base: i === 6 ? 20.4 : 19.1,
        pace: 0.57 + 0.032 * (i % 3),
      })
  })
  for (const [side, z, job, dress, yaw] of [
    [-1, 38.9, 'porter', 2, 1.1],
    [1, 38.2, 'porter', 0, -1.3],
    [1, 6.9, 'lantern', 6, -1.3],
    [-1, 57.5, 'flute', 5, 1.3],
  ]) {
    list.push({ x: side * 18.45, z, y: 1.374, job, dress, yaw, size: 1, phase: z * 0.13 })
  }
  return list
}
export function riverPeople(scene, m, ships) {
  const cast = actors(ships),
    mainCount = cast.length
  const residents = reachResidents(),
    nearby = []
  const max = mainCount + residentLimit
  const matte = new T.MeshStandardMaterial({
    name: '穿街绸布',
    color: 0xffffff,
    roughness: 0.82,
    vertexColors: true,
    side: T.DoubleSide,
  })
  const shine = new T.MeshStandardMaterial({
    name: '手提灯绢',
    color: 0xffddb0,
    emissive: 0xffa14f,
    emissiveIntensity: 0.95,
    roughness: 0.85,
    vertexColors: true,
  })
  const face = new T.MeshStandardMaterial({
    name: '眉眼发际',
    map: facePaint(),
    color: 0xffffff,
    roughness: 0.84,
    vertexColors: true,
  })
  const damask = matte.clone()
  damask.name = '织金细纹'
  damask.map = wovenBrocade()
  const batches = {}
  function batch(id, g, size, mat = matte) {
    if (!g.getAttribute('color'))
      g.setAttribute(
        'color',
        new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)
      )
    const mesh = new T.InstancedMesh(g, mat, size * max)
    mesh.name = '人群·' + id
    mesh.count = 0
    mesh.userData.swatches = []
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage)
    mesh.frustumCulled = false
    mesh.receiveShadow = true
    scene.add(mesh)
    batches[id] = mesh
  }
  batch('oval', new T.SphereGeometry(1, 8, 5), 18)
  batch('face', portrait(), 1, face)
  batch('sleeve', sleeve(), 4, damask)
  const shadow = soleShade()
  batch('shadow', shadow[0], 1, shadow[1])
  batch('lapel', collar(), 1)
  batch('yoke', cloudCollar(), 1, damask)
  batch('rod', new T.CylinderGeometry(1, 0.88, 1, 8), 16)
  batch('square', new T.BoxGeometry(1, 1, 1), 4)
  batch('upper', robeShape(true), 1, damask)
  batch('skirt', robeShape(false), 1, damask)
  batch('hat', feltHat(), 1)
  batch('spokes', parasolSpokes(), 1)
  batch('ribs', lanternBones(), 1)
  batch('shade', parasol(), 1)
  batch('light', new T.SphereGeometry(1, 8, 7), 1, shine)
  // The silhouette and painted face survive at distance. Sub-pixel weave
  // relief, individual spokes and a high-segment sleeve do not need geometry.
  const simpleProfile = (arr) =>
    new T.LatheGeometry(
      arr.map((x) => new T.Vector2(...x)),
      10
    )
  batch('faceFar', new T.SphereGeometry(1, 9, 6), 1, face)
  batch('ovalFar', new T.SphereGeometry(1, 6, 4), 18)
  batch(
    'upperFar',
    simpleProfile([
      [0.68, 0],
      [0.83, 0.29],
      [1, 0.79],
      [0.9, 0.91],
      [0.4, 1],
    ]),
    1,
    damask
  )
  batch(
    'skirtFar',
    simpleProfile([
      [1, 0],
      [0.97, 0.14],
      [0.84, 0.56],
      [0.69, 1],
    ]),
    1,
    damask
  )
  batch(
    'sleeveFar',
    simpleProfile([
      [0.61, -0.5],
      [0.98, -0.35],
      [1.04, 0.16],
      [1.16, 0.46],
      [0.83, 0.49],
    ]),
    4,
    damask
  )
  batch('hatFar', new T.ConeGeometry(1, 1, 10), 1)
  batch('coatLow', distantCoat(), 1)
  batch('headLow', distantHead(), 1)
  batch('limbLow', new T.OctahedronGeometry(1, 0).scale(1, 0.5, 1), 14)
  batch('shadeFar', distantParasol(), 1)
  batch('lightFar', new T.SphereGeometry(1, 6, 3), 1, shine)
  batch('rodFar', new T.CylinderGeometry(1, 0.9, 1, 6), 16)
  const color = new T.Color(),
    person = new T.Object3D(),
    at = new T.Object3D(),
    up = new T.Vector3(0, 1, 0)
  const A = new T.Vector3(),
    B = new T.Vector3(),
    matrix = new T.Matrix4(),
    base = new T.Matrix4(),
    headBase = new T.Matrix4(),
    headShift = new T.Matrix4()
  const viewpoint = new T.Vector3(Infinity, Infinity, Infinity),
    oldAim = new T.Quaternion()
  const forward = new T.Vector3(),
    unitScale = new T.Vector3(1, 1, 1),
    sight = new T.Frustum(),
    viewProjection = new T.Matrix4()
  let oldWidth = 0,
    oldHeight = 0,
    oldViewport = 0
  let last = -Infinity,
    mode,
    detail = 0
  function write(id, c) {
    if (detail === 2 && (id === 'spokes' || id === 'ribs' || id === 'shadow')) return
    const mesh = (detail && batches[id + 'Far']) || batches[id],
      n = mesh.count++
    at.updateMatrix()
    matrix.multiplyMatrices(base, at.matrix)
    mesh.setMatrixAt(n, matrix)
    if (id !== 'shadow' && mesh.userData.swatches[n] !== c) {
      mesh.setColorAt(n, color.set(c))
      mesh.userData.swatches[n] = c
      mesh.userData.recolored = true
    }
  }
  function part(id, x, y, z, w, h, d, c, rx = 0, ry = 0, rz = 0) {
    at.position.set(x, y, z)
    at.rotation.set(rx, ry, rz)
    at.scale.set(w, h, d)
    write(id, c)
  }
  function limb(a, b, w, d, c, id = 'rod') {
    A.fromArray(a)
    B.fromArray(b).sub(A)
    at.position.copy(A).addScaledVector(B, 0.5)
    at.scale.set(w, B.length(), d)
    at.quaternion.setFromUnitVectors(up, B.normalize())
    write(id, c)
  }
  // Reflecting a person in a horizontal surface below their feet only lowers
  // their centre. Clip this vertical ray against all six expanded view planes:
  // it covers the person as well as every river level, including offscreen ones.
  function visibleAboveWater(x, y, z, radius) {
    let low = 0,
      high = Infinity
    for (const plane of sight.planes) {
      const n = plane.normal,
        gap = n.x * x + n.y * y + n.z * z + plane.constant + radius
      if (n.y > 0) high = Math.min(high, gap / n.y)
      else if (n.y < 0) low = Math.max(low, gap / n.y)
      else if (gap < 0) return false
      if (high < low) return false
    }
    return true
  }
  function distantPose(job, walk, phase, seated, cloth, skirt, skin, trim, index, pixels, loading) {
    const tiny = pixels < 16,
      bob = 0.014 * Math.abs(walk),
      down = seated ? 0.28 : 0
    const hip = 0.76 - down + bob - 0.065 * loading,
      shoulder = 1.28 - down + bob - 0.14 * loading,
      head = shoulder + 0.185
    const hem = seated ? 0.37 : 0.13,
      rock = Math.sin(phase)
    if (tiny) {
      part('coatLow', 0, hem, 0.005, seated ? 0.297 : 0.29, shoulder + 0.047 - hem, 0.211, cloth)
      part('headLow', 0, head, 0.016, 0.112, 0.147, 0.106, 0xfff2e6)
    } else {
      part('skirt', 0, hem, 0.015, seated ? 0.267 : 0.3, hip + 0.09 - hem, 0.21, skirt)
      // The standing collar meets the chin even when the porter lowers a load.
      part('upper', 0, hip - 0.04, 0.008, 0.251, shoulder - hip + 0.103, 0.18, cloth)
      part('face', 0, head, 0.018, 0.105, 0.133, 0.103, 0xf5dfc5)
      part('square', 0, hip + 0.082, 0.01, 0.395, 0.052, 0.285, trim)
      if (pixels > 24) part('lapel', 0, hip - 0.04, 0.019, 1, 0.56, 1, trim)
      if (job === 'watch' || job === 'row' || job === 'carrier' || job === 'porter') {
        part('hat', 0, head + 0.105, -0.014, 0.2, 0.14, 0.196, job === 'watch' ? 0x35485b : 0x977650)
      } else part('limbLow', 0, head + 0.128, -0.035, 0.075, 0.142, 0.078, 0x352c29)
    }
    for (const sg of [-1, 1]) {
      if (!tiny && seated)
        limb([sg * 0.11, hip, 0], [sg * 0.11, 0.29, 0.28], 0.082, 0.078, skirt, 'limbLow')
      if (!tiny || pixels > 9) {
        if (seated) {
          const knee = [sg * 0.11, tiny ? hem + 0.015 : 0.31, tiny ? 0.12 : 0.26]
          limb(knee, [sg * 0.11, 0.037, 0.347], 0.076, 0.096, 0x382e2b, 'limbLow')
        } else {
          part('limbLow', sg * 0.108, 0.072, 0.045 + sg * 0.21 * walk, 0.085, 0.12, 0.145, 0x382e2b)
        }
      }
      const sh = [sg * 0.156, shoulder - 0.026, 0.015]
      let hand = [sg * 0.221, shoulder - 0.387, 0.035 - sg * 0.19 * walk]
      if (job === 'row') hand = [sg * 0.151, shoulder - 0.29 + 0.042 * rock, 0.34 + 0.17 * rock]
      else if (job === 'drum') hand = [sg * 0.19, shoulder - 0.18 + sg * 0.14 * rock, 0.34]
      else if (job === 'flute') hand = [sg * 0.13, shoulder + 0.065, 0.2]
      else if (job === 'lute' || job === 'sit') hand = [sg * 0.12, shoulder - 0.29, 0.23]
      else if ((job === 'umbrella' && sg === 1) || ((job === 'lantern' || job === 'watch') && sg === -1))
        hand = [sg * 0.27, shoulder - 0.066, 0.16]
      else if (job === 'carrier' && sg === -1) hand = [-0.17, shoulder + 0.042, 0.19]
      else if (job === 'porter') hand = [sg * 0.21, shoulder - 0.28 - 0.07 * loading, 0.28 + 0.18 * loading]
      if (tiny) limb(sh, hand, 0.112, 0.096, cloth, 'limbLow')
      else {
        const el = [sg * 0.257, Math.min(sh[1] - 0.115, (sh[1] + hand[1]) * 0.5 - 0.036), hand[2] * 0.43]
        limb(sh, el, 0.104, 0.084, cloth, 'limbLow')
        limb(el, hand, 0.093, 0.081, cloth, 'limbLow')
        part('limbLow', hand[0], hand[1] - 0.01, hand[2] + 0.018, 0.041, 0.1, 0.045, skin)
      }
    }
    if (job === 'umbrella') {
      part(
        'shade',
        0.265,
        1.92 + bob,
        0.14,
        0.64,
        0.65,
        0.64,
        [0xb35641, 0x9b6d51, 0x7a8392][index % 3],
        0.045,
        phase * 0.026,
        0.07
      )
      if (!tiny) limb([0.26, shoulder - 0.1, 0.14], [0.26, 2.12 + bob, 0.14], 0.017, 0.017, trim, 'limbLow')
    } else if (job === 'lantern' || job === 'watch') {
      part('light', -0.29, shoulder - 0.4, 0.17 + 0.025 * rock, 0.117, 0.151, 0.115, 0xffc382)
      if (!tiny)
        limb([-0.27, shoulder - 0.062, 0.16], [-0.29, shoulder - 0.26, 0.17], 0.012, 0.012, trim, 'limbLow')
    } else if (job === 'carrier') {
      limb([-0.16, shoulder + 0.068, -0.55], [-0.16, shoulder + 0.075, 0.58], 0.029, 0.03, trim, 'limbLow')
      for (const z of [-0.51, 0.54])
        part('square', -0.16, hip - 0.1, z + 0.025 * rock, 0.31, 0.3, 0.29, 0xab8358)
    } else if (job === 'basket' || job === 'porter') {
      part(
        'limbLow',
        job === 'porter' ? 0 : -0.28,
        job === 'porter' ? shoulder - 0.33 - 0.07 * loading : hip - 0.022,
        job === 'porter' ? 0.27 + 0.18 * loading : 0.08,
        0.226,
        0.34,
        0.161,
        0xae875b
      )
    } else if (!tiny && job === 'flute') {
      limb([-0.3, shoulder + 0.064, 0.18], [0.39, shoulder + 0.067, 0.2], 0.017, 0.017, 0xcdab6e, 'limbLow')
    } else if (!tiny && job === 'lute') {
      part('limbLow', 0.03, shoulder - 0.23, 0.19, 0.142, 0.4, 0.07, 0xc59565)
    }
  }
  return function people(t, day, camera) {
    const projection = camera?.projectionMatrix?.elements,
      screenHeight = camera?.userData?.viewportHeight ?? globalThis.innerHeight ?? 600
    const lensChanged =
      projection &&
      (1 - Math.abs(oldAim.dot(camera.quaternion)) > 0.00006 ||
        oldWidth !== projection[0] ||
        oldHeight !== projection[5] ||
        oldViewport !== screenHeight)
    const reframe = camera && (viewpoint.distanceToSquared(camera.position) > 0.24 ** 2 || lensChanged)
    if (t >= last && t - last < 0.045 && mode === day && !reframe) return
    if (camera) viewpoint.copy(camera.position)
    if (projection) {
      oldAim.copy(camera.quaternion)
      oldWidth = projection[0]
      oldHeight = projection[5]
      oldViewport = screenHeight
      forward.set(0, 0, -1).applyQuaternion(camera.quaternion)
      viewProjection
        .compose(viewpoint, camera.quaternion, unitScale)
        .invert()
        .premultiply(camera.projectionMatrix)
      sight.setFromProjectionMatrix(viewProjection)
    }
    last = t
    mode = day
    shine.emissiveIntensity = day ? 0.1 : 1.1
    for (const mesh of Object.values(batches)) mesh.count = 0
    // The original harbour still resolves in the city overview. Beyond it, skip
    // bodies smaller than three and a half pixels even in the water reflection.
    const focal = projection ? 0.5 * screenHeight * projection[5] : Infinity
    const harbourReach = Math.max(235, (1.73 * focal) / 3.5)
    cast.length = mainCount
    cast.push(...nearbyResidents(residents, t, camera?.position, nearby))
    for (let k = 0; k < cast.length; k++) {
      const p = cast[k],
        i = p.appearance ?? k,
        s = p.size,
        job = day && p.streetId ? p.dayJob : p.job,
        seat = ['sit', 'row', 'lute'].includes(job)
      let x = p.x,
        y = p.y,
        z = p.z,
        yaw = p.yaw,
        walk = 0
      const phase = t * 1.75 + p.phase
      const walking = Boolean(p.side || p.streetId)
      if (p.streetId) {
        const pose = p.current
        x = pose.x
        y = pose.y
        z = pose.z
        yaw = pose.yaw
        walk = pose.stride
      } else if (p.side) {
        const a = (t * p.pace) / p.radius + p.phase,
          side = p.side,
          j = p.number
        x = side * (p.base + 0.85 * j + 0.31 * Math.cos(a))
        y = 1.373
        z = p.center + p.radius * Math.sin(a) + 0.38 * j
        yaw = Math.atan2(-side * 0.31 * Math.sin(a), p.radius * Math.cos(a))
        walk = Math.sin(t * (3.5 + 0.1 * p.dress) + p.phase + j) * Math.abs(Math.cos(a))
      }
      person.position.set(x, y, z)
      person.rotation.set(0, yaw, 0)
      person.scale.setScalar(s)
      person.updateMatrix()
      if (p.ship) base.multiplyMatrices(p.ship.group.matrixWorld, person.matrix)
      else base.copy(person.matrix)
      const d2 = camera ? A.setFromMatrixPosition(base).distanceToSquared(camera.position) : 0
      if (!p.streetId && d2 > harbourReach ** 2) continue
      if (
        projection &&
        !visibleAboveWater(base.elements[12], base.elements[13] + 0.94 * s, base.elements[14], 1.69 * s)
      )
        continue
      detail = d2 > 36 ** 2 ? 2 : d2 > 15 ** 2 ? 1 : 0
      const [cloth, skirt, trim] = garments[p.dress],
        skin = [0xbf8867, 0xd6a27c, 0xcb9976][i % 3]
      const distance = Math.sqrt(d2)
      const depth = projection
        ? Math.abs(
            (base.elements[12] - viewpoint.x) * forward.x +
              (base.elements[13] + 0.77 * s - viewpoint.y) * forward.y +
              (base.elements[14] - viewpoint.z) * forward.z
          )
        : distance
      const pixels = ((seat ? 1.36 : 1.67) * s * focal) / Math.max(1, distance * 0.78, depth)
      const loading =
        job === 'porter' ? (0.5 + 0.5 * Math.sin(t * 0.9 + p.phase)) * (p.streetId ? p.current.pause : 1) : 0
      if (d2 > 11.5 ** 2 && pixels < 34) {
        detail = 2
        distantPose(job, walk, phase, seat, cloth, skirt, skin, trim, i, pixels, loading)
        continue
      }
      part('shadow', 0, 0.001, 0.025, 0.7, 1, 0.68, 0xffffff)
      const down = seat ? 0.28 : 0,
        bob = walking ? 0.018 * Math.abs(walk) : 0,
        hip = 0.77 - down + bob - 0.065 * loading,
        shoulder = 1.27 - down + bob - 0.14 * loading
      for (const sg of [-1, 1]) {
        const stride = sg * walk * 0.245,
          fx = sg * 0.115,
          fz = seat ? 0.29 : stride,
          fy = 0.07 + (walking ? Math.max(0, -sg * walk) * 0.052 : 0)
        const knee = [fx, seat ? 0.39 : 0.4 + bob, (seat ? 0.34 : 0.04) + stride * 0.36]
        limb([fx, hip, 0.01], knee, 0.078, 0.08, skirt)
        limb(knee, [fx, fy + 0.035, fz], 0.067, 0.061, skirt)
        part('oval', fx, fy, fz + 0.054, 0.083, 0.061, 0.15, 0x352d2a)
      }
      const long = walking && (job === 'umbrella' || job === 'lantern' || job === 'walk' || job === 'watch'),
        hem = seat ? 0.37 : long ? 0.135 : 0.3
      part(
        'skirt',
        0,
        hem + bob,
        0.015,
        seat ? 0.265 : long ? 0.306 : 0.28,
        seat ? 0.29 : hip + 0.09 - hem,
        0.213,
        skirt
      )
      part('upper', 0, hip - 0.04, 0.008, 0.251, 0.56, 0.178, cloth, 0.19 * loading)
      part('oval', 0, hip + 0.095, 0.01, 0.209, 0.045, 0.169, trim)
      part('lapel', 0, hip - 0.04, 0.019, 1, 0.56, 1, trim, 0.19 * loading)
      part('square', 0.133, hip - 0.042, 0.148, 0.041, 0.203, 0.014, trim, 0.16, 0, -0.15)
      if (long) {
        limb([-0.14, hip + 0.091, 0.116], [-0.162, hip - 0.087, 0.139], 0.009, 0.009, 0xa78659)
        part('oval', -0.162, hip - 0.092, 0.139, 0.03, 0.045, 0.015, 0x819888)
      }
      if (job === 'umbrella') part('yoke', 0, shoulder + 0.016, 0, 1, 1, 1, 0xba815d)
      if (loading) {
        headBase.copy(base)
        base.multiply(headShift.makeTranslation(0, 0, 0.1 * loading))
      }
      part('oval', 0, shoulder + 0.056, 0.015, 0.057, 0.07, 0.056, skin)
      const hy = 1.465 - down + bob - 0.14 * loading
      part('face', 0, hy, 0.018, 0.105, 0.133, 0.103, [0xf2dcca, 0xffeed7, 0xf7dfc7][i % 3])
      if (job === 'watch') {
        part('hat', 0, hy + 0.127, -0.016, 0.148, 0.105, 0.15, 0x344859)
        part('oval', 0, hy + 0.089, 0, 0.157, 0.018, 0.155, 0x352d33)
        part('square', 0, hy + 0.118, 0.131, 0.045, 0.044, 0.013, 0xb99058)
      } else if ((i % 3 === 0 || job === 'umbrella') && !seat) {
        part('oval', 0.013, hy + 0.136, -0.05, 0.065, 0.066, 0.059, 0x322929)
        limb([-0.078, hy + 0.121, -0.048], [0.095, hy + 0.154, -0.051], 0.01, 0.01, 0xc8ac76)
        part('oval', 0.102, hy + 0.157, -0.051, 0.021, 0.019, 0.019, 0xb79072)
        if (job === 'umbrella') {
          for (let k = 0; k < 4; k++) {
            const a = k * Math.PI * 0.5
            part(
              'oval',
              0.086 + 0.016 * Math.cos(a),
              hy + 0.15 + 0.016 * Math.sin(a),
              -0.022,
              0.012,
              0.016,
              0.009,
              0xce8a76
            )
          }
          limb([0.1, hy + 0.14, -0.022], [0.105, hy + 0.056, -0.019], 0.0038, 0.0038, 0xb79a65)
          part('oval', 0.105, hy + 0.051, -0.019, 0.008, 0.017, 0.008, 0xcbc8a3)
        }
      } else if (job === 'row' || job === 'porter') {
        part('hat', 0, hy + 0.12, -0.007, 0.235, 0.16, 0.219, job === 'row' ? 0xba9b6d : 0x82684c)
        part('oval', 0, hy + 0.047, -0.007, 0.231, 0.018, 0.217, 0x95724b)
        for (const sg of [-1, 1])
          limb([sg * 0.108, hy + 0.061, 0.006], [sg * 0.043, hy - 0.085, 0.036], 0.006, 0.006, 0x655241)
      } else {
        part('oval', -0.003, hy + 0.067, -0.073, 0.09, 0.077, 0.056, 0x32292a)
      }
      if (loading) base.copy(headBase)
      const armT = walk * 0.23,
        rock = Math.sin(phase)
      for (const sg of [-1, 1]) {
        const sh = [sg * 0.157, shoulder - 0.035, 0.005 + 0.09 * loading]
        let el = [sg * 0.251, shoulder - 0.2, -sg * armT * 0.48],
          hand = [sg * 0.226, shoulder - 0.39, -sg * armT]
        if (job === 'flute') {
          el = [sg * 0.31, shoulder - 0.1, 0.13]
          hand = [sg * 0.13, shoulder + 0.075, 0.19]
        } else if (job === 'drum') {
          el = [sg * 0.28, shoulder - 0.18 + 0.045 * sg * rock, 0.1]
          hand = [sg * 0.2, shoulder - 0.16 + 0.14 * sg * rock, 0.31]
          limb(hand, [sg * 0.15, hand[1] - 0.12, 0.54], 0.017, 0.017, 0xb6905e)
        } else if (job === 'row') {
          el = [sg * 0.28, shoulder - 0.21, 0.09 + 0.14 * rock]
          hand = [sg * 0.17, shoulder - 0.3 + 0.05 * rock, 0.33 + 0.17 * rock]
        } else if (job === 'lute' || job === 'sit') {
          el = [sg * 0.26, shoulder - 0.22, 0.08]
          hand = [sg * 0.12, shoulder - 0.35, 0.23]
        } else if (job === 'carrier' && sg === -1) {
          el = [-0.32, shoulder - 0.095, 0.13]
          hand = [-0.18, shoulder + 0.048, 0.2]
        } else if (job === 'watch' && sg === 1) {
          el = [0.29, shoulder - 0.18, 0.05]
          hand = [0.23, shoulder - 0.22 + 0.047 * rock, 0.23]
        } else if (
          (job === 'umbrella' && sg === 1) ||
          ((job === 'lantern' || job === 'watch') && sg === -1)
        ) {
          el = [sg * 0.295, shoulder - 0.19, 0.08]
          hand = [sg * 0.27, shoulder - 0.07, 0.167]
        } else if (job === 'porter') {
          el = [sg * 0.31, shoulder - 0.18 - 0.06 * loading, 0.09 + 0.14 * loading]
          hand = [sg * 0.23, shoulder - 0.25 - 0.12 * loading, 0.23 + 0.26 * loading]
        }
        limb(sh, el, 0.092, 0.079, cloth, 'sleeve')
        limb(el, hand, 0.08, 0.075, cloth, 'sleeve')
        part('oval', hand[0], hand[1] - 0.018, hand[2] + 0.024, 0.039, 0.053, 0.043, skin)
        part('oval', hand[0] - sg * 0.03, hand[1] - 0.004, hand[2] + 0.031, 0.015, 0.029, 0.019, skin)
      }
      if (job === 'umbrella') {
        const xx = 0.265,
          cz = 0.14
        limb([xx, shoulder - 0.13, cz], [xx, 2.24 + bob, cz], 0.015, 0.015, 0x926c47)
        part(
          'shade',
          xx,
          1.91 + bob,
          cz,
          0.64,
          0.65,
          0.64,
          [0xb35641, 0x9b6d51, 0x7a8392][i % 3],
          0.045,
          phase * 0.026,
          0.07
        )
        part('spokes', xx, 1.91 + bob, cz, 0.64, 0.65, 0.64, 0x936945, 0.045, phase * 0.026, 0.07)
        part('oval', xx, 2.218 + bob, cz, 0.028, 0.054, 0.028, 0x8c6041)
      } else if (job === 'lantern' || job === 'watch') {
        if (job === 'watch') {
          const h = shoulder - 0.21 + 0.047 * rock
          part('square', 0.22, h - 0.025, 0.28, 0.041, 0.064, 0.25, 0x885b38, 0.18)
          part('square', 0.267, h - 0.018, 0.27, 0.029, 0.048, 0.223, 0xc09862, 0.26 + 0.11 * rock)
          limb([0.219, h - 0.029, 0.157], [0.258, h - 0.025, 0.164], 0.009, 0.009, 0x906b51)
        }
        const xx = -0.291,
          cz = 0.17 + 0.025 * Math.sin(phase),
          h = shoulder - 0.25
        limb([-0.27, shoulder - 0.06, 0.17], [xx, h, cz], 0.009, 0.009, 0xccac80)
        part('light', xx, h - 0.151, cz, 0.113, 0.149, 0.111, 0xffc382)
        part('ribs', xx, h - 0.151, cz, 0.113, 0.149, 0.111, 0x895737)
        for (const d of [0.0, -0.282]) part('oval', xx, h + d, cz, 0.086, 0.021, 0.084, 0x614432)
        limb([xx, h - 0.29, cz], [xx + 0.02, h - 0.405, cz], 0.018, 0.015, 0xb33c31)
      } else if (job === 'flute') {
        limb([-0.3, shoulder + 0.078, 0.2], [0.38, shoulder + 0.075, 0.21], 0.016, 0.016, 0xe3be83)
      } else if (job === 'lute') {
        part('oval', 0.028, shoulder - 0.25, 0.2, 0.139, 0.202, 0.066, 0xcf995a)
        limb([0.08, shoulder - 0.12, 0.21], [0.19, shoulder + 0.21, 0.2], 0.026, 0.024, 0xb18051)
      } else if (job === 'carrier') {
        const h = shoulder + 0.077,
          swing = 0.03 * Math.sin(phase)
        limb([-0.154, h + 0.012, -0.58], [-0.154, h, 0.59], 0.023, 0.029, 0xb09667)
        for (const sign of [-1, 1]) {
          const z = sign * 0.56 + swing,
            low = hip - 0.16 + 0.025 * sign * rock
          for (const x of [-0.29, -0.03])
            limb([-0.154, h, sign * 0.54], [x, low + 0.14, z], 0.012, 0.012, 0x846c4d)
          part('square', -0.16, low, z, 0.32, 0.28, 0.29, sign < 0 ? 0xab8561 : 0x8d6e4e)
          part('square', -0.16, low + 0.13, z, 0.34, 0.045, 0.3, 0x745a40)
          part('square', -0.16, low - 0.105, z, 0.33, 0.025, 0.3, 0x745a40)
        }
      } else if (job === 'basket' || job === 'porter') {
        if (p.streetId && job === 'basket') {
          limb([-0.4, hip - 0.005, 0.07], [-0.28, hip + 0.17, 0.09], 0.012, 0.012, 0x826644)
          limb([-0.28, hip + 0.17, 0.09], [-0.16, hip - 0.005, 0.07], 0.012, 0.012, 0x826644)
        }
        part(
          'oval',
          job === 'porter' ? 0 : -0.28,
          job === 'porter' ? shoulder - 0.32 - 0.12 * loading : hip - 0.09,
          job === 'porter' ? 0.25 + 0.26 * loading : 0.071,
          job === 'porter' ? 0.29 : 0.16,
          0.17,
          0.153,
          0xb28a59
        )
      }
    }
    for (const mesh of Object.values(batches)) {
      mesh.visible = mesh.count > 0
      if (!mesh.visible) continue
      mesh.instanceMatrix.clearUpdateRanges()
      mesh.instanceMatrix.addUpdateRange(0, mesh.count * 16)
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.userData.recolored) {
        mesh.instanceColor.clearUpdateRanges()
        mesh.instanceColor.addUpdateRange(0, mesh.count * 3)
        mesh.instanceColor.needsUpdate = true
        mesh.userData.recolored = false
      }
    }
  }
}
