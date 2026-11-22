import { reachPoint, reachTerraces } from './reachMap.js'

// The last inhabited street supplies both the approach and the grade of these
// halls. Their canopies rise at very different scales as the river turns.
const towers = [
  ['锦浦', -0.21, 'hall', 3, 8.2],
  ['南栈', 0.22, 'watch', 3, 5.8],
  ['东市', -0.27, 'pagoda', 5, 6.5],
  ['东市', 0.29, 'hall', 3, 6.7],
  ['西津', -0.18, 'watch', 4, 6.0],
  ['书坊', 0.12, 'pagoda', 5, 6.4],
  ['织云', 0.15, 'hall', 4, 8.1],
  ['桂浦', -0.23, 'pagoda', 6, 7.2],
  ['桂浦', 0.26, 'watch', 3, 5.7],
  ['鹿鸣', -0.36, 'watch', 4, 5.5],
  ['鹿鸣', 0.36, 'watch', 3, 5.3],
  ['玉京', -0.15, 'pagoda', 6, 7.7],
  ['玉京', 0.29, 'hall', 3, 6.6],
  ['花津', -0.2, 'hall', 3, 8.2],
  ['花津', 0.23, 'pagoda', 7, 7.1],
  ['铜雀', -0.19, 'watch', 5, 6.6],
  ['岑楼', -0.32, 'watch', 4, 6.4],
  ['岑楼', 0.14, 'hall', 5, 8.1],
  ['画桥', 0.11, 'pagoda', 7, 8.1],
  ['星渡', -0.27, 'hall', 4, 6.9],
  ['星渡', 0.18, 'pagoda', 7, 8.6],
]

export const rooflineSites = towers.map(([name, fraction, shape, levels, r]) => {
  const row = reachTerraces.filter((t) => t.group === name).at(-1)
  const radius = r * (shape === 'hall' ? 1.22 : 1.03)
  const along = row.width * fraction,
    across = -row.depth / 2 - radius - 0.65
  const [x, z] = reachPoint(row, along, across)
  return { row, fraction, shape, levels, r, x, y: row.y, z, radius: radius + 0.8, along, across }
})
