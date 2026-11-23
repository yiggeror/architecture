import * as T from 'three'

// Linear skinning places a vertex inside the convex hull of its posed bone
// contributions. A box around all contributions encloses the garment even
// when the knees bend under a bench or a sleeve follows an outstretched arm.
function skinEnvelope(mesh) {
  const { position, skinIndex, skinWeight } = mesh.geometry.attributes
  const { bones, boneInverses } = mesh.skeleton
  const boxes = new Map(), point = new T.Vector3(), bound = new T.Box3()
  const bind = boneInverses.map((m) => new T.Matrix4().multiplyMatrices(m, mesh.bindMatrix))
  for (let i = 0; i < position.count; i++) {
    let sum = 0
    for (let j = 0; j < 4; j++) {
      const weight = skinWeight.getComponent(i, j)
      if (weight < 0) return null
      if (!weight) continue
      sum += weight
      const k = skinIndex.getComponent(i, j)
      if (!boxes.has(k)) boxes.set(k, new T.Box3())
      boxes.get(k).expandByPoint(point.fromBufferAttribute(position, i).applyMatrix4(bind[k]))
    }
    if (Math.abs(sum - 1) > .00001) return null
  }
  const placed = new T.Matrix4(), contribution = new T.Matrix4(), tmp = new T.Box3()
  let last = -1
  return (frame) => {
    if (frame !== last) {
      placed.multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse)
      bound.makeEmpty()
      for (const [k, local] of boxes) {
        contribution.multiplyMatrices(placed, bones[k].matrixWorld)
        bound.union(tmp.copy(local).applyMatrix4(contribution))
      }
      bound.expandByScalar(.006)
      last = frame
    }
    return bound
  }
}

export function figureSight(grid, sections) {
  const figures = new Set(), changed = []
  const clip = new T.Matrix4(), inverse = new T.Matrix4(), localView = new T.Matrix4()
  const localSight = new T.Frustum(), normal = new T.Matrix3()
  function track(group, ship) {
    const parts = []
    group.traverse((mesh) => {
      const g = mesh.geometry
      if (!mesh.isMesh || !g.index || g.groups.length || Object.keys(g.morphAttributes).length ||
          g.drawRange.start || g.drawRange.count < g.index.count || g.index.count < 288) return
      const skin = mesh.isSkinnedMesh && skinEnvelope(mesh)
      if (mesh.isSkinnedMesh && !skin) return
      if (!g.boundingBox) g.computeBoundingBox()
      parts.push({ mesh, g, version: g.attributes.position.version, skin,
        runs: !skin && g.index.count > 1800 ? sections(g, false, 144) : null })
    })
    figures.add({ group, ship, parts })
  }
  function prepare(camera, sight, frame) {
    clip.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    let priorShip
    grid.clear(clip)
    for (const entry of figures) {
      const { group, ship, parts } = entry
      if (!group.parent) { figures.delete(entry); continue }
      if (!group.visible) continue
      if (ship !== priorShip) {
        grid.clear(ship ? localView.multiplyMatrices(clip, ship.group.matrixWorld) : clip)
        if (ship?.deckSight && ship.group.visible) grid.paint(ship.deckSight.vertices, ship.deckSight.faces)
        priorShip = ship
      }
      for (const { mesh, g, version, skin, runs } of parts) {
        if (!mesh.visible || g !== mesh.geometry || g.attributes.position.version !== version) continue
        let visible = g
        if (skin) {
          const bound = skin(frame)
          grid.transform(clip)
          if (!sight.intersectsBox(bound) || grid.hides(bound)) visible = null
        } else {
          inverse.copy(mesh.matrixWorld).invert()
          normal.getNormalMatrix(inverse)
          for (let i = 0; i < 6; i++) localSight.planes[i].copy(sight.planes[i]).applyMatrix4(inverse, normal)
          grid.transform(localView.multiplyMatrices(clip, mesh.matrixWorld))
          if (!localSight.intersectsBox(g.boundingBox) || grid.hides(g.boundingBox)) visible = null
          else if (runs) visible = runs.visible(localSight, grid)
        }
        if (visible !== g) {
          changed.push(mesh, g)
          if (visible) mesh.geometry = visible
          else mesh.visible = false
        }
      }
    }
  }
  function restore() {
    for (let i = 0; i < changed.length; i += 2) {
      changed[i].visible = true
      changed[i].geometry = changed[i + 1]
    }
    changed.length = 0
  }
  return { track, prepare, restore }
}
