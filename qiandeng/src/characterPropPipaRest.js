import * as T from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { poseHuman } from './humanPose.js'

function lean(instrument, phase) {
  instrument.rotation.set(-0.188 + 0.009 * Math.cos(phase), -0.035, -0.396 + 0.016 * Math.sin(phase))
  instrument.rotateY(-0.26)
}

function garmentOnThighs(rig, profile, state, grips) {
  const actor = rig.root.parent
  if (!actor) return null
  const clothes = actor.children.find((part) => part.userData.garment)
  if (!clothes) return null

  // On a cambered deck the feet are at different heights, which changes
  // the knee and the fold carrying the instrument. Sample that seated pose.
  poseHuman(rig, profile, { ...state, t: 0, phase: 0 }, { seat: grips.seat, feet: grips.feet })
  actor.updateWorldMatrix(true, false)
  actor.updateMatrixWorld(true)
  const h = profile.height ?? 1,
    anchor = new T.Matrix4().copy(actor.matrixWorld).invert(),
    rel = new T.Matrix4(),
    p = new T.Vector3(),
    out = [],
    sample = new T.Box3(
      new T.Vector3(-0.32 * h, grips.seat + 0.075 * h, 0.15 * h),
      new T.Vector3(0.2 * h, grips.seat + 0.37 * h, 0.44 * h),
    ),
    corners = [new T.Vector3(), new T.Vector3(), new T.Vector3()],
    bounds = new T.Box3()
  const lower = new Set(['pelvis', 'rThigh', 'rShin', 'lThigh', 'lShin'].map((n) => rig.index[n]))
  clothes.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return
    const { position, skinWeight, skinIndex } = mesh.geometry.attributes,
      index = mesh.geometry.index,
      active = new Uint8Array(position.count),
      posed = new Float32Array(position.count * 3)
    rel.multiplyMatrices(anchor, mesh.matrixWorld)
    for (let i = 0; i < position.count; i++) {
      for (let j = 0; j < 4; j++)
        if (skinWeight.getComponent(i, j) > 0.05 && lower.has(skinIndex.getComponent(i, j))) {
          active[i] = 1
          break
        }
      if (active[i])
        mesh
          .getVertexPosition(i, p)
          .applyMatrix4(rel)
          .toArray(posed, i * 3)
    }
    for (let i = 0; i < index.count; i += 3) {
      let allLower = true
      for (let j = 0; j < 3; j++) {
        const id = index.getX(i + j)
        if (!active[id]) {
          allLower = false
          break
        }
        corners[j].fromArray(posed, id * 3)
      }
      if (!allLower || !bounds.setFromPoints(corners).intersectsBox(sample)) continue
      for (const v of corners) out.push(v.x, v.y, v.z)
    }
  })
  if (!out.length) return null
  const geometry = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(out, 3))
  return new MeshBVH(geometry)
}

export function fittedPipa(rig, profile, instrument, fit = {}) {
  const h = profile.height ?? 1,
    surfaces = ['桐木面板', '梨腹背板', '琴身侧沿与封口']
  let wood
  const collision = { intersectsTriangles: (a, b) => a.intersectsTriangle(b) }
  return (state, grips, phase) => {
    const seat = grips.seat,
      footL = grips.feet?.l.point.y,
      footR = grips.feet?.r.point.y
    instrument.position.set(-0.092 * h, seat + 0.176 * h, 0.306 * h)
    if (fit.seat !== seat || fit.left !== footL || fit.right !== footR) {
      fit.seat = seat
      fit.left = footL
      fit.right = footR
      const cloth = garmentOnThighs(rig, profile, state, grips)
      if (cloth) {
        wood ??= surfaces.map(
          (name) => new MeshBVH(instrument.getObjectByName(name).children[0].geometry, { indirect: true }),
        )
        const heights = []
        for (let i = 0; i < 4; i++) {
          lean(instrument, (i * Math.PI) / 2)
          let lo = 0,
            hi = 0.16 * h
          for (let j = 0; j < 13; j++) {
            const mid = (lo + hi) / 2
            instrument.position.y = seat + 0.176 * h + mid
            instrument.updateMatrix()
            if (wood.some((board) => cloth.bvhcast(board, instrument.matrix, collision))) lo = mid
            else hi = mid
          }
          heights.push(hi)
        }
        // The pelvis and planted legs remain seated as the instrument rocks.
        // Keep its lower rim tangent to the same folds throughout the stroke.
        fit.mean = heights.reduce((sum, x) => sum + x, 0) / 4 + 0.00032
        fit.cosine = (heights[0] - heights[2]) / 2
        fit.sine = (heights[1] - heights[3]) / 2
        cloth.geometry.dispose()
      } else {
        fit.mean = 0.061 * h
        fit.sine = fit.cosine = 0
      }
    }
    instrument.position.y = seat + 0.176 * h + fit.mean + fit.cosine * Math.cos(phase) + fit.sine * Math.sin(phase)
    lean(instrument, phase)
  }
}
