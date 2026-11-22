import * as T from 'three'
import { MeshBVH } from 'three-mesh-bvh'

const surfaces = [
  '桐木面板',
  '梨腹背板',
  '琴身侧沿与封口',
  '琵琶半圆木颈',
  '乌木指板',
  '指板上的竹相与象牙品',
]
const identity = new T.Matrix4()
const crosses = { intersectsTriangles: (a, b) => a.intersectsTriangle(b) }

function sampleSurface(mesh, rig, side) {
  const lap = side === 'lap'
  const hand = mesh.parent === rig.bones[side + 'Hand']
  if (!hand && !mesh.isSkinnedMesh) return null
  const source = mesh.geometry,
    { position, skinIndex, skinWeight } = source.attributes,
    own = new Set(
      (lap ? ['l', 'r'] : [side]).flatMap((s) =>
        ['UpperArm', 'Forearm', 'Hand'].map((n) => rig.index[s + n]),
      ),
    ),
    keep = new Uint8Array(position.count)
  for (let i = 0; i < position.count; i++) {
    if (hand) {
      keep[i] = 1
      continue
    }
    let weight = 0
    for (let j = 0; j < 4; j++)
      if (own.has(skinIndex.getComponent(i, j))) weight += skinWeight.getComponent(i, j)
    keep[i] = Number(lap ? weight <= 0.07 : weight > 0.07)
  }
  const indices = [],
    originals = [],
    indexed = new Map()
  for (let j = 0; j < source.index.count; j += 3) {
    const a = source.index.getX(j),
      b = source.index.getX(j + 1),
      c = source.index.getX(j + 2)
    if (!keep[a] && !keep[b] && !keep[c]) continue
    for (const id of [a, b, c]) {
      if (!indexed.has(id)) {
        indexed.set(id, originals.length)
        originals.push(id)
      }
      indices.push(indexed.get(id))
    }
  }
  if (!indices.length) return null
  const positions = new T.BufferAttribute(new Float32Array(originals.length * 3), 3),
    geometry = new T.BufferGeometry().setAttribute('position', positions).setIndex(indices)
  return { mesh, side, originals, positions, geometry, tree: null }
}

// Both ray depths come from rendered wood triangles. A detached nail, a
// complete hand, or a sleeve segment inside the belly is still detected even
// if none of its faces intersects either outer plate.
export function pipaVolumes(figure, includeLap = false) {
  const instrument = figure.group.getObjectByName('螺钿四弦琵琶'),
    boards = surfaces.map((name) => {
      const mesh = instrument.getObjectByName(name).children[0]
      mesh.geometry.computeBoundingBox()
      return { name, tree: new MeshBVH(mesh.geometry, { indirect: true }), bounds: mesh.geometry.boundingBox }
    }),
    neckParts = boards.slice(3),
    bodyParts = boards.slice(0, 3),
    bodyBox = new T.Box3(),
    arms = [],
    p = new T.Vector3(),
    relative = new T.Matrix4(),
    inv = new T.Matrix4(),
    ray = new T.Ray(new T.Vector3(), new T.Vector3(0, 0, -1)),
    backRay = new T.Ray(new T.Vector3(), new T.Vector3(0, 0, 1))
  for (const { bounds } of boards) bodyBox.union(bounds)
  figure.group.traverse((mesh) => {
    if (!mesh.isMesh) return
    for (const side of includeLap ? ['l', 'r', 'lap'] : ['l', 'r']) {
      const arm = sampleSurface(mesh, figure.rig, side)
      if (arm) arms.push(arm)
    }
  })
  function inside(v) {
    if (!bodyBox.containsPoint(v)) return false
    ray.origin.set(v.x, v.y, 1)
    const front = boards[0].tree.raycastFirst(ray, T.DoubleSide)
    if (front && v.z < 1 - front.distance - 0.00001) {
      const back = boards[1].tree.raycastFirst(ray, T.DoubleSide)
      if (back && v.z > 1 - back.distance + 0.00001) return true
    }
    backRay.origin.set(v.x, v.y, -1)
    for (const board of neckParts) {
      if (!board.bounds.containsPoint(v)) continue
      const upper = board.tree.raycastFirst(ray, T.DoubleSide)
      if (!upper || v.z >= 1 - upper.distance - 0.00001) continue
      const lower = board.tree.raycastFirst(backRay, T.DoubleSide)
      if (lower && v.z > -1 + lower.distance + 0.00001) return true
    }
    return false
  }
  function sample() {
    figure.group.updateMatrixWorld(true)
    figure.rig.skeleton.update()
    inv.copy(instrument.matrixWorld).invert()
    const findings = []
    for (const arm of arms) {
      const { mesh, geometry, positions, originals } = arm
      relative.multiplyMatrices(inv, mesh.matrixWorld)
      let buried = 0
      for (let i = 0; i < originals.length; i++) {
        mesh.getVertexPosition(originals[i], p).applyMatrix4(relative)
        positions.setXYZ(i, p.x, p.y, p.z)
        if (inside(p)) buried++
      }
      geometry.computeBoundingBox()
      if (arm.tree) arm.tree.refit()
      else arm.tree = new MeshBVH(geometry, { indirect: true })
      for (const wood of boards) {
        if (!geometry.boundingBox.intersectsBox(wood.bounds)) continue
        const out = wood.tree.bvhcast(arm.tree, identity, crosses),
          back = arm.tree.bvhcast(wood.tree, identity, crosses)
        if (out || back) findings.push(`${arm.side} ${mesh.name} × ${wood.name} (${+out}/${+back})`)
      }
      if (buried) findings.push(`${arm.side} ${mesh.name}: ${buried} vertices inside instrument`)
    }
    return findings
  }
  function touchesLapWhenLowered(distance) {
    const down = new T.Vector3(0, -1, 0)
      .applyQuaternion(instrument.quaternion.clone().invert())
      .multiplyScalar(distance)
    const delta = new T.Matrix4().makeTranslation(down.x, down.y, down.z)
    return arms.some(
      (arm) => arm.side === 'lap' && bodyParts.some((wood) => arm.tree.bvhcast(wood.tree, delta, crosses)),
    )
  }

  function clearSightline(eye, target) {
    const from = eye.clone().applyMatrix4(inv),
      to = target.clone().applyMatrix4(inv),
      ray = new T.Ray(from, to.clone().sub(from).normalize())
    const distance = from.distanceTo(to)
    return boards.every((wood) => {
      const hit = wood.tree.raycastFirst(ray, T.DoubleSide)
      return !hit || hit.distance > distance - 0.0001
    })
  }
  return {
    sample,
    inside,
    instrument,
    touchesLapWhenLowered,
    clearSightline,
    dispose() {
      for (const arm of arms) arm.geometry.dispose()
    },
  }
}
