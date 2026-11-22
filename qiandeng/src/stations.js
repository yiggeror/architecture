import * as T from 'three'
import { reachTerraces, reachPoint } from './reachMap.js'
import { rooflineSites } from './reachRooflineSites.js'

// World distances are metres. Every arrival releases immediately to free flight.
export const stations = [
  {
    label: '灯河',
    eye: [9, 11.8, 61],
    target: [-4, 23.8, -59],
    portraitEye: [-19, 19.2, 67],
    portraitTarget: [20, 28.8, -132],
  },
  { label: '水关', eye: [-2.65, 3.85, 8.85], target: [1.5, 9.22, -21] },
  { label: '灯市', eye: [117.1, 10.82, 37], target: [119.9, 11.75, 20.8] },
  { label: '云阙', eye: [-67, 91, -149], target: [-103, 94, -201] },
  { label: '全城', panorama: true, eye: [-174, 209, 300], target: [79, 73, -164] },
]
export function updateLens(camera, w, h) {
  camera.aspect = w / h
  camera.fov = w < h ? Math.min(77, Math.max(64, (2 * Math.atan(0.348 / camera.aspect) * 180) / Math.PI)) : 56
  camera.updateProjectionMatrix()
}

const rim = reachTerraces.flatMap((t) =>
  [-0.5, 0.5].flatMap((f) => {
    const [x, z] = reachPoint(t, t.width * f, t.depth / 2)
    return [new T.Vector3(x, t.y - 17, z), new T.Vector3(x, t.y + 14, z)]
  })
)
for (const site of rooflineSites) rim.push(new T.Vector3(site.x, site.y + site.levels * 7.8 + 8, site.z))
rim.push(new T.Vector3(0, -20, 108), new T.Vector3(155, 203, -351))

export function framePanorama(camera, station) {
  const target = new T.Vector3(...station.target)
  const forward = target.clone().sub(camera.position).normalize()
  const right = forward.clone().cross(camera.up).normalize()
  const up = right.clone().cross(forward)
  const tanY = Math.tan(T.MathUtils.degToRad(camera.fov) / 2),
    v = new T.Vector3()
  let distance = 0
  for (const p of rim) {
    v.copy(p).sub(target)
    const z = v.dot(forward)
    distance = Math.max(
      distance,
      Math.abs(v.dot(right)) / (tanY * camera.aspect * 0.94) - z,
      Math.abs(v.dot(up)) / (tanY * 0.836) - z
    )
  }
  camera.position.copy(target).addScaledVector(forward, -distance)
}
