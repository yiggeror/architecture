// World distances are metres. Every arrival releases immediately to free flight.
export const stations = [
  {
    label: '灯河',
    eye: [6.25, 4.95, 47],
    target: [-2.8, 13.55, -25],
    portraitEye: [-0.75, 5.2, 54],
    portraitTarget: [-1.35, 13.25, -24],
  },
  { label: '水关', eye: [-2.65, 3.85, 8.85], target: [1.5, 9.22, -21] },
  { label: '灯市', eye: [-19.55, 3.02, 29.8], target: [-25.2, 3.4, 18.9] },
  { label: '云阙', eye: [-26.2, 61.2, -58], target: [7.8, 57.1, -100] },
  { label: '全城', panoramaWidth: 290, eye: [111, 86, 149], target: [1, 14, -27] },
]
export function updateLens(camera, w, h) {
  camera.aspect = w / h
  camera.fov = w < h ? Math.min(87, Math.max(66, (2 * Math.atan(0.425 / camera.aspect) * 180) / Math.PI)) : 56
  camera.updateProjectionMatrix()
}
