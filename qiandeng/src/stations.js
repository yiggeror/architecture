import * as T from 'three'
import { reachTerraces, reachPoint } from './reachMap.js'
import { rooflineSites } from './reachRooflineSites.js'

// World distances are metres. Every arrival releases immediately to free flight.
export const stations = [
  {
    label: '灯河',
    eye: [-2.7, 3.95, 60.7],
    target: [-0.4, 10.94, -4.65],
    portraitEye: [-3.16, 3.85, 60.28],
    portraitTarget: [-0.45, 10.89, -4.65],
    portraitLens: { halfWidth: 0.30, minFov: 62.2, maxFov: 76 },
  },
  { label: '水关', eye: [-2.65, 3.85, 8.85], target: [1.5, 9.22, -21] },
  { label: '灯市', eye: [117.1, 10.82, 37], target: [119.9, 11.75, 20.8] },
  { label: '云阙', eye: [-67, 91, -149], target: [-103, 94, -201] },
  { label: '全城', panorama: true, eye: [-174, 209, 300], target: [79, 73, -164] },
]
const defaultPortraitLens = { halfWidth: 0.348, minFov: 64, maxFov: 77 }
export function updateLens(camera, w, h) {
  camera.aspect = w / h
  const { halfWidth, minFov, maxFov } = camera.userData.portraitLens ?? defaultPortraitLens
  camera.fov = w < h
    ? T.MathUtils.clamp(T.MathUtils.radToDeg(2 * Math.atan(halfWidth / camera.aspect)), minFov, maxFov)
    : 56
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
