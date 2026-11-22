import * as T from 'three'
import { nearbyResidents, reachResidents, residentLimit } from './reachPeople.js'
import { collar, facePaint, soleShade, wovenBrocade } from './peopleDress.js'
import { harbourCast, castRoute, figurePlacement } from './characterCast.js'
import { characterProfile } from './characterProfiles.js'
import { figurePool } from './figurePool.js'

const tau = Math.PI * 2
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
    6,
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
export function riverPeople(scene, m, ships, shadeCharacter, groundAt) {
  const cast = harbourCast(ships),
    mainCount = cast.length
  const residents = reachResidents(),
    nearby = []
  const peopleById = new Map()
  for (const p of [...cast, ...residents]) {
    p.profile = characterProfile(p.appearance, p.job)
    p.routeAt = (time, out) => castRoute(p, time, out)
    peopleById.set(p.appearance, p)
  }
  const pool = figurePool(scene, shadeCharacter)
  const handLights = []
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
        new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3),
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
  const shadow = soleShade()
  batch('shadow', shadow[0], 1, shadow[1])
  batch('lapel', collar(), 1)
  batch('square', new T.BoxGeometry(1, 1, 1), 4)
  // The silhouette and painted face survive at distance. Sub-pixel weave
  // relief, individual spokes and a high-segment sleeve do not need geometry.
  const simpleProfile = (arr) =>
    new T.LatheGeometry(
      arr.map((x) => new T.Vector2(...x)),
      10,
    )
  batch('faceFar', new T.SphereGeometry(1, 9, 6), 1, face)
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
    damask,
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
    damask,
  )
  batch('hatFar', new T.ConeGeometry(1, 1, 10), 1)
  batch('coatLow', distantCoat(), 1)
  batch('headLow', distantHead(), 1)
  batch('limbLow', new T.OctahedronGeometry(1, 0).scale(1, 0.5, 1), 14)
  batch('shadeFar', distantParasol(), 1)
  batch('lightFar', new T.SphereGeometry(1, 6, 3), 1, shine)
  const color = new T.Color(),
    at = new T.Object3D(),
    up = new T.Vector3(0, 1, 0)
  const A = new T.Vector3(),
    B = new T.Vector3(),
    matrix = new T.Matrix4(),
    base = new T.Matrix4(),
    lowScale = new T.Matrix4(),
    route = {}
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
    mode
  function write(id, c) {
    const mesh = batches[id + 'Far'] || batches[id],
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
  function distantPose(profile, job, walk, phase, seated, pixels, loading) {
    const { outer: cloth, lower: skirt, binding: trim } = profile.colors,
      { skin, id: index, hair, garment } = profile
    const work = garment === 'duan' || garment === 'banbi'
    const tiny = pixels < 16,
      bob = 0.014 * Math.abs(walk),
      down = seated ? 0.28 : 0
    const hip = 0.864 - down + bob - 0.065 * loading,
      shoulder = 1.34 - down + bob - 0.14 * loading,
      head = shoulder + 0.225
    const hem = seated ? 0.37 : work ? 0.4 : 0.14,
      rock = Math.sin(phase)
    if (tiny) {
      part('coatLow', 0, hem, 0.005, seated ? 0.297 : 0.29, shoulder + 0.047 - hem, 0.211, cloth)
      part('headLow', 0, head, 0.016, 0.09, 0.118, 0.095, 0xfff2e6)
    } else {
      part('skirt', 0, hem, 0.015, seated ? 0.267 : 0.3, hip + 0.09 - hem, 0.21, skirt)
      // The standing collar meets the chin even when the porter lowers a load.
      part('upper', 0, hip - 0.04, 0.008, 0.251, shoulder - hip + 0.103, 0.18, cloth)
      part('face', 0, head, 0.018, 0.087 + 0.008 * profile.face.jaw, 0.117, 0.101, 0xffedde)
      part('square', 0, hip + 0.082, 0.01, 0.395, 0.052, 0.285, trim)
      if (pixels > 24) part('lapel', 0, hip - 0.04, 0.019, 1, 0.56, 1, trim)
      if (hair === 'wrapped')
        part('hat', 0, head + 0.099, -0.015, 0.113, 0.091, 0.117, profile.colors.binding)
      else if (hair === 'braid')
        part('limbLow', 0, head - 0.065, -0.097, 0.045, 0.265, 0.047, profile.hairColor)
      else {
        const high = hair === 'loop' || hair === 'knot'
        part(
          'limbLow',
          0,
          head + (high ? 0.118 : 0.052),
          high ? -0.038 : -0.11,
          hair === 'loop' ? 0.082 : 0.06,
          high ? 0.136 : 0.112,
          0.07,
          profile.hairColor,
        )
      }
    }
    for (const sg of [-1, 1]) {
      if (!tiny && seated) limb([sg * 0.11, hip, 0], [sg * 0.11, 0.29, 0.28], 0.082, 0.078, skirt, 'limbLow')
      if (!tiny || pixels > 9) {
        if (seated) {
          const knee = [sg * 0.11, tiny ? hem + 0.015 : 0.31, tiny ? 0.12 : 0.26]
          limb(knee, [sg * 0.11, 0.037, 0.347], 0.076, 0.096, 0x382e2b, 'limbLow')
        } else {
          if (work && !tiny)
            limb([sg * 0.1, hem + 0.02, 0], [sg * 0.1, 0.1, sg * 0.19 * walk], 0.064, 0.066, skirt, 'limbLow')
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
        0.07,
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
        0xae875b,
      )
    } else if (!tiny && job === 'flute') {
      limb([-0.3, shoulder + 0.064, 0.18], [0.39, shoulder + 0.067, 0.2], 0.017, 0.017, 0xcdab6e, 'limbLow')
    } else if (!tiny && job === 'lute') {
      part('limbLow', 0.03, shoulder - 0.23, 0.19, 0.142, 0.4, 0.07, 0xc59565)
    }
  }
  function people(t, day, camera) {
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
    pool.begin()
    handLights.length = 0
    for (const mesh of Object.values(batches)) mesh.count = 0
    // The original harbour still resolves in the city overview. Beyond it, skip
    // bodies smaller than three and a half pixels even in the water reflection.
    const focal = projection ? 0.5 * screenHeight * projection[5] : Infinity
    const harbourReach = Math.max(235, (1.73 * focal) / 3.5)
    cast.length = mainCount
    cast.push(...nearbyResidents(residents, t, camera?.position, nearby))
    for (let k = 0; k < cast.length; k++) {
      const p = cast[k],
        s = p.size,
        job = day && p.streetId ? p.dayJob : p.job,
        seat = ['sit', 'row', 'lute'].includes(job)
      const at = p.streetId ? p.current : castRoute(p, t, route)
      const walking = Boolean(p.side || p.streetId)
      figurePlacement(p, at, base)
      const d2 = camera ? A.setFromMatrixPosition(base).distanceToSquared(camera.position) : 0
      if (!p.streetId && d2 > harbourReach ** 2) continue
      if (
        projection &&
        !visibleAboveWater(base.elements[12], base.elements[13] + 0.94 * s, base.elements[14], 1.69 * s)
      )
        continue
      const distance = Math.sqrt(d2)
      const depth = projection
        ? Math.abs(
            (base.elements[12] - viewpoint.x) * forward.x +
              (base.elements[13] + 0.77 * s - viewpoint.y) * forward.y +
              (base.elements[14] - viewpoint.z) * forward.z,
          )
        : distance
      const pixels = ((seat ? 1.36 : 1.67) * s * focal) / Math.max(1, distance * 0.78, depth)
      const loading =
        job === 'porter' ? (0.5 + 0.5 * Math.sin(t * 0.9 + p.phase)) * (p.streetId ? p.current.pause : 1) : 0
      // A whole figure at this projected size has distinct hands and a readable face.
      // Always give a viewer within arm's reach the complete rig, on any screen.
      if (camera && (distance < 5.0 || (pixels >= 67 && distance < 18))) {
        part('shadow', 0, 0.003, 0.02, 0.43, 1, 0.34, 0xffffff)
        const figure = pool.draw(
          p.profile,
          job,
          {
            t,
            phase: p.phase,
            job,
            walking,
            day,
            loading,
            scale: s,
            speed: p.pace ?? 0.78,
            routeAt: walking ? p.routeAt : undefined,
            actor: p,
            ship: p.ship,
            base,
            groundAt: p.ship ? undefined : groundAt,
          },
          base,
        )
        if (figure.lamp) {
          figure.lamp.userData.viewDistance = d2
          handLights.push(figure.lamp)
        }
      } else {
        const q = p.profile
        base.multiply(lowScale.makeScale(q.height * q.shoulders, q.height, q.height * q.girth))
        distantPose(q, job, at.stride, t * 1.75 + p.phase, seat, pixels, loading)
      }
    }
    pool.finish()
    handLights.sort((a, b) => a.userData.viewDistance - b.userData.viewDistance)
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
  people.handLights = handLights
  people.subject = (id, t) => {
    const p = peopleById.get(id)
    if (!p) return null
    const matrix = figurePlacement(p, p.routeAt(t, {}), new T.Matrix4())
    const seated = ['row', 'sit', 'lute'].includes(p.job)
    const focus = new T.Vector3(0, seated ? 1.0 : 1.34 * p.profile.height, 0.02).applyMatrix4(matrix)
    const forward = new T.Vector3(0, 0, 1).transformDirection(matrix)
    return { id, name: p.profile.name, design: p.profile.design, job: p.job, matrix, focus, forward }
  }
  return people
}
