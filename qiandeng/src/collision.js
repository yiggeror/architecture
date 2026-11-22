import * as T from 'three'
import { ExtendedTriangle, MeshBVH } from 'three-mesh-bvh'

// Distances are metres. A standing capsule clears one tread. The free camera
// sweeps a sphere for its full requested displacement, including a dropped frame.
const shoulderRadius = 0.2,
  cameraRadius = 0.155,
  stepUp = 0.23,
  stepDown = 0.34
const stride = 0.085,
  skin = 0.00035
const soft = new Set(['leaf', 'blade', 'lily', 'petal', 'pollen', 'moss', 'grain', 'tea'])
const identity = new T.Matrix4()

function kind(material) {
  if (!material?.isMeshStandardMaterial || material.userData.noCollision || soft.has(material.name)) return 0
  return material.name === 'bark' || material.name === 'bamboo' ? 2 : 1
}

// Only split mixed material meshes or thin woody detail. Repeated instances
// share the resulting positions, index and triangle hierarchy.
function collisionGeometry(g, kinds) {
  if (kinds.every((k) => k === 1)) return g
  const pos = g.attributes.position,
    index = g.index
  const length = index ? index.count : pos.count,
    hard = []
  const groups = kinds.length === 1 ? [{ start: 0, count: length, materialIndex: 0 }] : g.groups
  const a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3(),
    cross = new T.Vector3()
  for (const group of groups) {
    const k = kinds[group.materialIndex]
    if (!k) continue
    const end = Math.min(group.start + group.count, length)
    for (let i = group.start; i + 2 < end; i += 3) {
      const ia = index ? index.getX(i) : i,
        ib = index ? index.getX(i + 1) : i + 1,
        ic = index ? index.getX(i + 2) : i + 2
      if (k === 2) {
        a.fromBufferAttribute(pos, ia)
        b.fromBufferAttribute(pos, ib).sub(a)
        c.fromBufferAttribute(pos, ic).sub(a)
        const longest = Math.max(b.lengthSq(), c.lengthSq(), b.distanceToSquared(c))
        if (cross.crossVectors(b, c).lengthSq() <= 0.014 ** 2 * longest) continue
      }
      hard.push(ia, ib, ic)
    }
  }
  return hard.length ? new T.BufferGeometry().setAttribute('position', pos).setIndex(hard) : null
}

function makeIndex(records) {
  if (!records.length) return null
  const bounds = new T.Box3(),
    centres = new T.Box3(),
    p = new T.Vector3()
  for (const record of records) {
    bounds.union(record.bounds)
    centres.expandByPoint(record.bounds.getCenter(p))
  }
  if (records.length <= 5) return { bounds, records }
  centres.getSize(p)
  const axis = p.x >= p.y && p.x >= p.z ? 'x' : p.y >= p.z ? 'y' : 'z'
  const centre = (r) => r.bounds.min[axis] + r.bounds.max[axis]
  records.sort((a, b) => centre(a) - centre(b))
  const n = records.length >> 1
  return { bounds, left: makeIndex(records.slice(0, n)), right: makeIndex(records.slice(n)) }
}
function visit(node, reaches, read) {
  if (!node || !reaches(node.bounds)) return
  if (node.records) {
    for (const record of node.records) if (reaches(record.bounds)) read(record)
  } else {
    visit(node.left, reaches, read)
    visit(node.right, reaches, read)
  }
}

// Ray/slab intersection against a box expanded by the sphere's extent on each
// axis. A rotated, non-uniform instance turns the world sphere into an ellipsoid.
function passes(bounds, origin, delta, pad, last) {
  let enter = 0,
    exit = last
  for (let i = 0; i < 3; i++) {
    const a = origin.getComponent(i),
      d = delta.getComponent(i),
      r = pad.getComponent(i)
    const lo = bounds.min.getComponent(i) - r,
      hi = bounds.max.getComponent(i) + r
    if (Math.abs(d) < 1e-12) {
      if (a < lo || a > hi) return false
      continue
    }
    const t = (lo - a) / d,
      u = (hi - a) / d
    enter = Math.max(enter, Math.min(t, u))
    exit = Math.min(exit, Math.max(t, u))
    if (enter > exit) return false
  }
  return true
}

export function courtyardCollision(scene, pond, movingBlock) {
  const waters = new Set((Array.isArray(pond) ? pond : [pond]).filter(Boolean))
  const records = [],
    seen = new Set(),
    cache = new WeakMap()
  const matrix = new T.Matrix4(),
    inverse = new T.Matrix4(),
    normalMatrix = new T.Matrix3()
  function matrixFor(mesh, instance) {
    if (instance < 0) return matrix.copy(mesh.matrixWorld)
    mesh.getMatrixAt(instance, matrix)
    return matrix.premultiply(mesh.matrixWorld)
  }
  function collect(node) {
    if (seen.has(node) || (node.userData.noCollision && !waters.has(node))) return
    seen.add(node)
    if (node.isMesh && node.geometry?.attributes.position) {
      const water = waters.has(node),
        g = node.geometry
      const kinds = water ? [1] : Array.isArray(node.material) ? node.material.map(kind) : [kind(node.material)]
      if (kinds.some(Boolean) && g.attributes.position.count) {
        let variants = cache.get(g)
        if (!variants) {
          variants = new Map()
          cache.set(g, variants)
        }
        const key = kinds.every((k) => k === 1) ? 'solid' : kinds.join(',')
        if (!variants.has(key)) variants.set(key, { g, kinds, tree: undefined })
        const source = variants.get(key)
        if (!g.boundingBox) g.computeBoundingBox()
        const count = node.isInstancedMesh ? node.count : 1
        for (let j = 0; j < count; j++) {
          const instance = node.isInstancedMesh ? j : -1
          matrixFor(node, instance)
          const transformed = !matrix.equals(identity)
          if (transformed && Math.abs(matrix.determinant()) < 1e-12) continue
          const bounds = transformed ? g.boundingBox.clone().applyMatrix4(matrix) : g.boundingBox
          if (!bounds.isEmpty()) records.push({ mesh: node, instance, transformed, bounds, source, water })
        }
      }
    }
    for (const child of node.children) collect(child)
  }
  scene.updateWorldMatrix(true, true)
  collect(scene)
  for (const water of waters)
    if (!seen.has(water)) {
      water.updateWorldMatrix(true, false)
      collect(water)
    }
  const index = makeIndex(records)
  // Distant districts need only their box until a real camera query reaches them.
  function hierarchy(source) {
    if (source.tree === undefined) {
      const g = collisionGeometry(source.g, source.kinds)
      source.tree = g ? new MeshBVH(g, { indirect: true, maxLeafSize: 16 }) : null
    }
    return source.tree
  }
  function treeFor(record) {
    if (record.transformed) inverse.copy(matrixFor(record.mesh, record.instance)).invert()
    return hierarchy(record.source)
  }

  const preparedAt = new T.Vector3(Infinity, Infinity, Infinity),
    ahead = new T.Vector3()
  const neighbourhood = new T.Box3()
  let queue = [],
    queued = false
  const defer = globalThis.requestIdleCallback
    ? (fn) => globalThis.requestIdleCallback(fn, { timeout: 420 })
    : globalThis.requestAnimationFrame
      ? (fn) => setTimeout(fn, 45)
      : null
  function prepareOne() {
    let next
    while ((next = queue.pop())) {
      if (next[0].tree !== undefined) continue
      hierarchy(next[0])
      break
    }
    queued = queue.length > 0
    if (queued) defer(prepareOne)
  }
  function prefetch(eye, direction) {
    if (!defer) return
    const lookAhead = Math.min(32, 4 + Math.max(0, eye.y) * 0.14)
    ahead.copy(direction).normalize().multiplyScalar(lookAhead).add(eye)
    if (preparedAt.distanceToSquared(ahead) < 36) return
    preparedAt.copy(ahead)
    neighbourhood.makeEmpty().expandByPoint(eye).expandByPoint(ahead).expandByScalar(12)
    const nearby = new Map()
    visit(
      index,
      (b) => b.intersectsBox(neighbourhood),
      (r) => {
        if (r.source.tree !== undefined) return
        const distance = Math.min(r.bounds.distanceToPoint(eye), r.bounds.distanceToPoint(ahead))
        if (!nearby.has(r.source) || distance < nearby.get(r.source)) nearby.set(r.source, distance)
      },
    )
    // Prepare one nearby source per idle turn while someone is looking around.
    // Travelling past a district discards its outstanding work immediately.
    queue = [...nearby].sort((a, b) => b[1] - a[1])
    if (!queued && queue.length) {
      queued = true
      defer(prepareOne)
    }
  }
  const down = new T.Ray(new T.Vector3(), new T.Vector3(0, -1, 0)),
    localRay = new T.Ray()
  const point = new T.Vector3(),
    worldNormal = new T.Vector3()
  function floor(x, z, top, depth) {
    down.origin.set(x, top, z)
    let nearest = depth,
      level = null
    function reaches(b) {
      return (
        x >= b.min.x &&
        x <= b.max.x &&
        z >= b.min.z &&
        z <= b.max.z &&
        top >= b.min.y &&
        top - nearest <= b.max.y
      )
    }
    visit(index, reaches, (record) => {
      const tree = treeFor(record)
      if (!tree) return
      const transformed = record.transformed
      let ray = down,
        limit = nearest
      if (transformed) {
        const e = inverse.elements
        limit *= Math.hypot(e[4], e[5], e[6])
        ray = localRay.copy(down).applyMatrix4(inverse)
        normalMatrix.getNormalMatrix(matrix)
      }
      function walkable(hit) {
        return (
          record.water ||
          Math.abs(
            transformed
              ? worldNormal.copy(hit.face.normal).applyNormalMatrix(normalMatrix).y
              : hit.face.normal.y,
          ) >= 0.68
        )
      }
      let hit = tree.raycastFirst(ray, T.DoubleSide, 0, limit)
      if (hit && !walkable(hit)) {
        hit = null
        for (const other of tree.raycast(ray, T.DoubleSide, 0, limit))
          if (walkable(other) && (!hit || other.distance < hit.distance)) hit = other
      }
      if (!hit) return
      const y = transformed ? point.copy(hit.point).applyMatrix4(matrix).y : hit.point.y
      if (top - y >= nearest) return
      nearest = top - y
      level = record.water ? null : y
    })
    return level
  }
  function footing(x, z, top, depth) {
    const centre = floor(x, z, top, depth)
    if (centre !== null) return centre
    for (const [dx, dz] of [
      [0.1, 0],
      [0, 0.1],
    ]) {
      const a = floor(x - dx, z - dz, top, depth)
      if (a === null) continue
      const b = floor(x + dx, z + dz, top, depth)
      if (b !== null && Math.abs(a - b) <= stepUp) return Math.max(a, b)
    }
    return null
  }

  const box = new T.Box3(),
    localBox = new T.Box3(),
    axis = new T.Line3()
  const surface = new T.Vector3(),
    body = new T.Vector3(),
    normal = new T.Vector3()
  const transformedTriangle = new ExtendedTriangle()
  let transformed = false,
    standing = false,
    radius = cameraRadius,
    penetration = 0
  function worldTriangle(triangle) {
    if (!transformed) return triangle
    transformedTriangle.copy(triangle)
    transformedTriangle.a.applyMatrix4(matrix)
    transformedTriangle.b.applyMatrix4(matrix)
    transformedTriangle.c.applyMatrix4(matrix)
    transformedTriangle.needsUpdate = true
    return transformedTriangle
  }
  const contactQuery = {
    intersectsBounds: (b) => localBox.intersectsBox(b),
    intersectsTriangle(local) {
      const triangle = worldTriangle(local)
      let distance
      if (standing) {
        distance = triangle.closestPointToSegment(axis, surface, body)
        if (
          distance >= radius &&
          down.intersectTriangle(triangle.a, triangle.b, triangle.c, false, surface) &&
          surface.y >= axis.start.y
        )
          distance = 0
      } else {
        triangle.closestPointToPoint(axis.end, surface)
        distance = surface.distanceTo(axis.end)
        body.copy(axis.end)
      }
      if (radius - distance <= penetration) return false
      penetration = radius - distance
      if (distance > 1e-7) normal.subVectors(body, surface).multiplyScalar(1 / distance)
      else normal.set(0, 0, 0)
      return false
    },
  }
  const boxReaches = (b) => b.intersectsBox(box)
  function readContact(record) {
    const tree = treeFor(record)
    if (!tree) return
    transformed = record.transformed
    localBox.copy(box)
    if (transformed) localBox.applyMatrix4(inverse)
    tree.shapecast(contactQuery)
  }
  function contact(eye, height) {
    standing = height > 0
    radius = standing ? shoulderRadius : cameraRadius
    axis.end.copy(eye)
    axis.start.copy(eye)
    if (standing) axis.start.y -= Math.max(0, height - stepUp - radius)
    box.makeEmpty().expandByPoint(axis.start).expandByPoint(axis.end).expandByScalar(radius)
    down.origin.copy(eye)
    penetration = 0
    visit(index, boxReaches, readContact)
    return penetration
  }

  const origin = new T.Vector3(),
    delta = new T.Vector3(),
    localOrigin = new T.Vector3(),
    localDelta = new T.Vector3()
  const pad = new T.Vector3().setScalar(cameraRadius),
    localPad = new T.Vector3()
  const edge = new T.Vector3(),
    startOffset = new T.Vector3(),
    along = new T.Vector3(),
    radial = new T.Vector3()
  const radialSpeed = new T.Vector3(),
    faceNormal = new T.Vector3(),
    candidate = new T.Vector3(),
    hitNormal = new T.Vector3()
  let impact = 1,
    hit = false
  function note(t, n) {
    if (t < -1e-9 || t > impact || delta.dot(n) >= -1e-9) return
    impact = Math.max(0, t)
    hit = true
    hitNormal.copy(n)
  }
  // Solve |p + t v|² = radius² for the entering root. The stable root avoids
  // cancellation for a shared vertex a few millimetres ahead of the camera.
  function entering(p, v) {
    const a = v.lengthSq(),
      b = p.dot(v),
      c = p.lengthSq() - cameraRadius ** 2
    if (a < 1e-18 || b >= 0 || c < 0) return Infinity
    const discriminant = b * b - a * c
    return discriminant < 0 ? Infinity : c / (-b + Math.sqrt(discriminant))
  }
  function testEdge(a, b) {
    edge.subVectors(b, a)
    startOffset.subVectors(origin, a)
    let t = entering(startOffset, delta)
    if (t <= impact) note(t, candidate.copy(startOffset).addScaledVector(delta, t).normalize())
    const lengthSq = edge.lengthSq()
    if (lengthSq < 1e-16) return
    const s = startOffset.dot(edge) / lengthSq,
      rate = delta.dot(edge) / lengthSq
    radial.copy(startOffset).addScaledVector(edge, -s)
    radialSpeed.copy(delta).addScaledVector(edge, -rate)
    t = entering(radial, radialSpeed)
    if (t <= impact && s + t * rate >= 0 && s + t * rate <= 1)
      note(t, candidate.copy(radial).addScaledVector(radialSpeed, t).normalize())
  }
  const sweepQuery = {
    intersectsBounds: (b) => passes(b, localOrigin, localDelta, localPad, impact),
    intersectsTriangle(local) {
      const tri = worldTriangle(local)
      tri.closestPointToPoint(origin, surface)
      candidate.subVectors(origin, surface)
      const separation = candidate.length()
      if (separation <= cameraRadius + 1e-8 && separation > 1e-9)
        note(0, candidate.multiplyScalar(1 / separation))
      tri.getNormal(faceNormal)
      startOffset.subVectors(origin, tri.a)
      const signed = faceNormal.dot(startOffset),
        velocity = faceNormal.dot(delta),
        side = signed < 0 ? -1 : 1
      if (velocity * side < -1e-10) {
        const t = (side * cameraRadius - signed) / velocity
        if (t >= 0 && t <= impact) {
          along
            .copy(origin)
            .addScaledVector(delta, t)
            .addScaledVector(faceNormal, -side * cameraRadius)
          if (tri.containsPoint(along)) note(t, faceNormal.multiplyScalar(side))
        }
      }
      testEdge(tri.a, tri.b)
      testEdge(tri.b, tri.c)
      testEdge(tri.c, tri.a)
      return false
    },
  }
  const sweepReaches = (b) => passes(b, origin, delta, pad, impact)
  function readSweep(record) {
    const tree = treeFor(record)
    if (!tree) return
    transformed = record.transformed
    localOrigin.copy(origin)
    localDelta.copy(delta)
    localPad.copy(pad)
    if (transformed) {
      const e = inverse.elements
      localOrigin.applyMatrix4(inverse)
      localDelta.add(origin).applyMatrix4(inverse).sub(localOrigin)
      localPad
        .set(Math.hypot(e[0], e[4], e[8]), Math.hypot(e[1], e[5], e[9]), Math.hypot(e[2], e[6], e[10]))
        .multiplyScalar(cameraRadius)
    }
    tree.shapecast(sweepQuery)
  }
  const next = new T.Vector3(),
    remaining = new T.Vector3(),
    intent = new T.Vector3()
  const planes = Array.from({ length: 6 }, () => new T.Vector3())
  const slip = new T.Vector3(), bestSlip = new T.Vector3()
  function fly(eye, dx, dy, dz, allowProxySlide = true) {
    const horizontal = dy === 0,
      vertical = !dx && !dz
    let budget = 1
    remaining.copy(intent.set(dx, dy, dz))
    for (let pass = 0; pass < 6 && remaining.lengthSq() > 1e-14; pass++) {
      origin.copy(eye)
      delta.copy(remaining)
      impact = 1
      hit = false
      visit(index, sweepReaches, readSweep)
      next.copy(eye).addScaledVector(delta, impact)
      if (movingBlock?.(eye, next, cameraRadius)) {
        // Moving boats and instruments use their own swept local proxies. Find
        // the first safe point even for a long coalesced input or wheel event.
        let clear = 0,
          blocked = impact
        for (let j = 0; j < 21 && (blocked - clear) * delta.length() > skin; j++) {
          const t = (clear + blocked) * 0.5
          next.copy(eye).addScaledVector(delta, t)
          if (movingBlock(eye, next, cameraRadius)) blocked = t
          else clear = t
        }
        eye.addScaledVector(delta, clear)
        if (allowProxySlide && !vertical) {
          // A moving ship exposes a swept yes/no proxy. Keep the longest free
          // component along its rail and run that path through the masonry too.
          bestSlip.set(0, 0, 0)
          for (let axis = 0; axis < 3; axis++) {
            if (!delta.getComponent(axis)) continue
            slip.copy(delta).multiplyScalar(1 - clear).setComponent(axis, 0)
            if (slip.lengthSq() <= bestSlip.lengthSq()) continue
            next.copy(eye).addScaledVector(slip, Math.min(1, 0.12 / slip.length()))
            if (!movingBlock(eye, next, cameraRadius)) bestSlip.copy(slip)
          }
          if (bestSlip.lengthSq()) fly(eye, bestSlip.x, bestSlip.y, bestSlip.z, false)
        }
        return
      }
      if (!hit) {
        eye.copy(next)
        return
      }
      const safe = Math.max(0, impact - skin / delta.length())
      eye.addScaledVector(delta, safe)
      if (vertical) return
      if (horizontal) hitNormal.y = 0
      if (hitNormal.lengthSq() < 1e-12) return
      planes[pass].copy(hitNormal).normalize()
      budget *= 1 - safe
      // Project the user's command, not a sideways velocity generated by a
      // previous bevel. A head-on pier stops the camera without dragging it
      // several metres along the facade when a frame covers a long distance.
      remaining.copy(intent).multiplyScalar(budget)
      for (let j = pass; j >= 0; j--)
        remaining.addScaledVector(planes[j], -Math.min(0, remaining.dot(planes[j])))
    }
  }

  function planarStep(eye, dx, dz, height) {
    next.copy(eye)
    next.x += dx
    next.z += dz
    for (let i = 0; i < 5; i++) {
      const foot = eye.y - height,
        y = footing(next.x, next.z, foot + stepUp, stepUp + stepDown)
      if (y === null) return false
      next.y = y + height
      const overlap = contact(next, height)
      if (overlap <= skin) {
        if (movingBlock?.(eye, next, cameraRadius)) return false
        eye.copy(next)
        return true
      }
      const h = normal.x * normal.x + normal.z * normal.z
      if (h < 0.12) break
      const push = (overlap + skin) / h
      next.x += normal.x * push
      next.z += normal.z * push
    }
    return false
  }
  function move(eye, dx, dy, dz, height = 0) {
    if (!height) {
      fly(eye, dx, dy, dz)
      return
    }
    const steps = Math.ceil(Math.hypot(dx, dy, dz) / stride)
    if (!steps) return
    const sx = dx / steps,
      sy = dy / steps,
      sz = dz / steps
    for (let i = 0; i < steps; i++) {
      if (sy) fly(eye, 0, sy, 0)
      if ((!sx && !sz) || planarStep(eye, sx, sz, height)) continue
      if (sx && sz) {
        planarStep(eye, sx, 0, height)
        planarStep(eye, 0, sz, height)
      }
    }
  }
  const landing = new T.Vector3(),
    approach = new T.Vector3()
  function land(eye, height) {
    const level = footing(eye.x, eye.z, eye.y, Infinity)
    if (level === null) return false
    landing.set(eye.x, level + height, eye.z)
    if (contact(landing, height) > skin) return false
    approach.copy(eye)
    fly(approach, 0, landing.y - eye.y, 0)
    if (approach.distanceToSquared(landing) > skin * skin) return false
    eye.copy(landing)
    return true
  }
  return { floor, move, land, prefetch, clearance: (eye) => contact(eye, 0) }
}
