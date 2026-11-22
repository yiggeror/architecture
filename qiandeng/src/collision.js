import * as T from 'three'
import { MeshBVH } from 'three-mesh-bvh'

// All lengths are metres. The gap under a walker's capsule clears a single tread.
const shoulderRadius = 0.2
const cameraRadius = 0.155
const stepUp = 0.23
const stepDown = 0.34
const stride = 0.085
const skin = 0.00035
const soft = new Set(['leaf', 'blade', 'lily', 'petal', 'pollen', 'moss', 'grain', 'tea'])

// Keep trunks and substantial branches. Leaf stems and thin twigs bend past the viewer.
function woodySolids(geometry) {
  const positions = geometry.attributes.position,
    index = geometry.index.array
  const a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3(),
    cross = new T.Vector3()
  const hard = []
  for (let i = 0; i < index.length; i += 3) {
    a.fromBufferAttribute(positions, index[i])
    b.fromBufferAttribute(positions, index[i + 1]).sub(a)
    c.fromBufferAttribute(positions, index[i + 2]).sub(a)
    const longest = Math.max(b.lengthSq(), c.lengthSq(), b.distanceToSquared(c))
    if (cross.crossVectors(b, c).lengthSq() > 0.014 ** 2 * longest)
      hard.push(index[i], index[i + 1], index[i + 2])
  }
  return new T.BufferGeometry().setAttribute('position', positions).setIndex(hard)
}

export function courtyardCollision(scene, pond, movingBlock) {
  const solids = []
  scene.updateMatrixWorld(true)
  for (const mesh of [...scene.children, ...(pond && !scene.children.includes(pond) ? [pond] : [])]) {
    if (
      mesh !== pond &&
      (!mesh.isMesh ||
        !mesh.material.isMeshStandardMaterial ||
        mesh.material.userData.noCollision ||
        soft.has(mesh.material.name))
    )
      continue
    // The masonry batches are in world space. The pond has a local, rotated shape.
    let g = mesh.geometry
    if (mesh === pond) g = g.clone().applyMatrix4(mesh.matrixWorld)
    else if (['bark', 'bamboo'].includes(mesh.material.name)) g = woodySolids(g)
    const tree = new MeshBVH(g, { indirect: true })
    solids.push({ tree, bounds: g.boundingBox, water: mesh === pond })
  }

  const down = new T.Ray(new T.Vector3(), new T.Vector3(0, -1, 0))
  function floor(x, z, top, depth) {
    down.origin.set(x, top, z)
    let nearest = depth,
      level = null
    for (const { tree, bounds, water } of solids) {
      if (
        x < bounds.min.x ||
        x > bounds.max.x ||
        z < bounds.min.z ||
        z > bounds.max.z ||
        top < bounds.min.y ||
        top - nearest > bounds.max.y
      )
        continue
      let hit = tree.raycastFirst(down, T.DoubleSide, 0, nearest)
      // A stone bevel can be the first hit while its supporting slab is a centimetre below.
      if (hit && !water && Math.abs(hit.face.normal.y) < 0.68) {
        hit = null
        for (const other of tree.raycast(down, T.DoubleSide, 0, nearest))
          if (Math.abs(other.face.normal.y) >= 0.68 && (!hit || other.distance < hit.distance)) hit = other
      }
      if (!hit || hit.distance >= nearest) continue
      nearest = hit.distance
      level = water ? null : hit.point.y
    }
    return level
  }

  function footing(x, z, top, depth) {
    const centre = floor(x, z, top, depth)
    if (centre !== null) return centre
    // A shoe spans the open joints between bridge stones. Require ground on both
    // sides of a gap so an actual drop at the bank is still respected.
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
    axis = new T.Line3()
  const surface = new T.Vector3(),
    body = new T.Vector3(),
    normal = new T.Vector3()
  const verticalRay = new T.Ray(new T.Vector3(), new T.Vector3(0, -1, 0))
  let penetration = 0,
    standing = false,
    radius = shoulderRadius
  const query = {
    intersectsBounds: (bounds) => bounds.intersectsBox(box),
    intersectsTriangle(triangle) {
      let distance
      if (standing) {
        distance = triangle.closestPointToSegment(axis, surface, body)
        // The nearest pair on the edges/endpoints can miss a face crossing the spine.
        if (
          distance >= radius &&
          verticalRay.intersectTriangle(triangle.a, triangle.b, triangle.c, false, surface) &&
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
      else normal.set(0, 0, 0) // An intersecting spine is rejected, never pushed through.
      return false
    },
  }
  function contact(eye, height) {
    standing = height > 0
    radius = standing ? shoulderRadius : cameraRadius
    axis.end.copy(eye)
    axis.start.copy(eye)
    if (standing) axis.start.y -= Math.max(0, height - stepUp - radius)
    box.makeEmpty().expandByPoint(axis.start).expandByPoint(axis.end).expandByScalar(radius)
    verticalRay.origin.copy(eye)
    penetration = 0
    for (const { tree, bounds } of solids) {
      if (bounds.intersectsBox(box)) tree.shapecast(query)
    }
    return penetration
  }

  const next = new T.Vector3()
  function planarStep(eye, dx, dz, height) {
    next.copy(eye)
    next.x += dx
    next.z += dz
    // Project against the nearest face. Rechecking also handles concave corners.
    for (let i = 0; i < 5; i++) {
      if (height) {
        const foot = eye.y - height
        const y = footing(next.x, next.z, foot + stepUp, stepUp + stepDown)
        if (y === null) return false
        next.y = y + height
      }
      const overlap = contact(next, height)
      if (overlap <= skin) {
        if (movingBlock?.(eye, next, cameraRadius)) return false
        eye.copy(next)
        return true
      }
      // Preserve altitude in flight and slide sideways along obstructions.
      const h = normal.x * normal.x + normal.z * normal.z
      if (h < 0.12) break
      const push = (overlap + skin) / h
      next.x += normal.x * push
      next.z += normal.z * push
    }
    return false
  }

  function move(eye, dx, dy, dz, height) {
    const steps = Math.ceil(Math.hypot(dx, dy, dz) / stride)
    if (!steps) return
    const sx = dx / steps,
      sy = dy / steps,
      sz = dz / steps
    for (let i = 0; i < steps; i++) {
      if (sy) {
        next.copy(eye)
        next.y += sy
        if (contact(next, 0) <= skin && !movingBlock?.(eye, next, cameraRadius)) eye.y = next.y
        else {
          // A vertical command stops at the roof or the water without drifting downhill.
          let clear = 0,
            blocked = 1
          for (let j = 0; j < 6; j++) {
            const t = (clear + blocked) / 2
            next.y = eye.y + sy * t
            if (contact(next, 0) <= skin && !movingBlock?.(eye, next, cameraRadius)) clear = t
            else blocked = t
          }
          eye.y += clear * sy
          if (!sx && !sz) break
        }
      }
      if ((!sx && !sz) || planarStep(eye, sx, sz, height)) continue
      // Preserve the tangential component at the edge of a walkable surface.
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
    // Moving from a low camera to standing also needs clearance under a beam.
    const distance = landing.y - eye.y,
      n = Math.max(1, Math.ceil(Math.abs(distance) / stride))
    approach.copy(eye)
    for (let i = 1; i <= n; i++) {
      approach.y = eye.y + (distance * i) / n
      if (contact(approach, 0) > skin) return false
    }
    eye.copy(landing)
    return true
  }
  return { floor, move, land, clearance: (eye) => contact(eye, 0) }
}
