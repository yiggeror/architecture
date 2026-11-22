// A row faces out over the river along its local positive z axis. Street and
// embankment builders use the same chart so door sills sit on the stone grade.
const wards = [
  // name, river-facing centre, heading, quay length, street depth, uphill levels
  ['锦浦', 126, 22, -1.36, 109, 19, [9, 23, 40]],
  ['南栈', 151, 151, -1.15, 116, 18, [8, 20, 32]],
  ['东市', 126, -91, -1.48, 97, 19, [20, 37, 56]],
  ['西津', -108, -26, 1.49, 116, 17, [13, 30, 49]],
  ['书坊', -114, -128, 1.03, 64, 17, [22, 38, 55, 72]],
  ['织云', 165, -184, -0.7, 99, 18, [37, 55, 75, 93, 112]],
  ['桂浦', -94, -249, 0.27, 104, 18, [37, 56, 75, 96, 118]],
  ['鹿鸣', 111, -267, 0.08, 126, 18, [40, 55, 72]],
  ['玉京', 261, -294, -0.91, 113, 19, [56, 74, 96, 121, 148]],
  ['花津', -47, -358, 0.21, 129, 19, [48, 66, 87, 111]],
  ['铜雀', 93, -407, 0.18, 79, 18, [56, 74, 91, 117, 146, 176]],
  ['岑楼', 238, -431, -0.27, 149, 19, [69, 88, 111, 139, 165, 192]],
  ['画桥', -22, -450, 0.35, 110, 19, [61, 78, 98, 122, 146, 175, 205]],
  ['星渡', 93, -555, -0.17, 167, 20, [70, 90, 109, 136, 165, 192, 220, 246, 272]],
]

export const reachTerraces = wards.flatMap(([group, x, z, yaw, span, depth, levels], index) =>
  levels.map((y, row) => {
    const along = row ? Math.sin(index * 1.72 + row * 2.1) * 3 : 0
    const back = row * (depth + 0.18)
    return {
      id: `${group}-${row}`,
      group,
      row,
      y,
      yaw,
      depth,
      x: x + along * Math.cos(yaw) - back * Math.sin(yaw),
      z: z - along * Math.sin(yaw) - back * Math.cos(yaw),
      width: row < 3 ? span + [0, 2, -6][row] : span * Math.max(0.67, 1 - 0.095 * (row - 2)),
    }
  })
)

export const palaceSites = [
  { x: -105, y: 54, z: -199, width: 55, depth: 37 },
  { x: 78, y: 66, z: -212, width: 55, depth: 44 },
  { x: 155, y: 98, z: -351, width: 83, depth: 46 },
]

export function reachPoint(row, along, across) {
  const c = Math.cos(row.yaw),
    s = Math.sin(row.yaw)
  return [row.x + along * c + across * s, row.z - along * s + across * c]
}
