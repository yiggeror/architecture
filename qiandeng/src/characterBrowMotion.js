import * as T from 'three'
import { bell, clamp, smooth } from './characterFaceSurface.js'

// The forehead and the upper orbital chart share this spatial deformation.
// The onset follows the open lid and stays above the lashes even during a blink.
export function addBrowMotion(mesh, a) {
  const g = mesh.geometry,
    pos = g.attributes.position,
    normal = g.attributes.normal
  const target = pos.clone(),
    surface = normal.clone()
  target.name = surface.name = '扬眉'
  const width = a.er * 2 + 0.016
  function lift(x, y, z) {
    const side = Math.sign(x),
      ax = Math.abs(x)
    const u = clamp((ax - a.ec + a.er + 0.004) / width)
    const browY = a.browLine(side, u)[1]
    const eye = a.orbit(side, clamp((ax - a.ec) / a.er, -1, 1))
    return (
      0.0038 *
      bell(y - browY, 0.012) *
      bell(ax - a.ec, 0.025) *
      smooth(eye.top + 0.0018, eye.top + 0.009, y) *
      smooth(0.024, 0.048, z) *
      (1 + side * 0.21 * a.asym)
    )
  }
  const step = 0.00012,
    n = new T.Vector3(),
    gradient = new T.Vector3()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i)
    if (y < a.ey + 0.001 || y > a.ey + 0.063 || z < 0.024) continue
    const h = lift(x, y, z)
    target.setXYZ(i, x, y + h, z + h * 0.12)
    gradient
      .set(
        lift(x + step, y, z) - lift(x - step, y, z),
        lift(x, y + step, z) - lift(x, y - step, z),
        lift(x, y, z + step) - lift(x, y, z - step)
      )
      .multiplyScalar(0.5 / step)
    n.fromBufferAttribute(normal, i)
    n.addScaledVector(gradient, -(n.y + 0.12 * n.z) / (1 + gradient.y + 0.12 * gradient.z)).normalize()
    surface.setXYZ(i, n.x, n.y, n.z)
  }
  g.morphAttributes.position.push(target)
  g.morphAttributes.normal.push(surface)
  mesh.updateMorphTargets()
}
