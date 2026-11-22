// Tissue depth over the maxilla, temporal fossa and mandible in mm.
// The lateral stations cross the philtral column, canine fossa, orbit,
// cheekbone and masseter. A bicubic sheet joins them across the whole face,
// with a horizontal tangent on the sagittal plane.
const cross = [0, 10, 19, 31, 43, 55, 67, 85]
const height = [0, 15, 29, 44, 59, 73, 86, 97, 108, 120, 134, 152, 179]
// prettier-ignore
const silk = [
  [0,0,0,0,0,0,0,0], [3,2.7,.8,.2,0,0,0,0],
  [1.9,2.0,.65,1.4,1.8,.8,0,0], [6.9,6.6,4.1,2.6,2.6,1,.4,0],
  [4.1,5.0,4.2,3.8,3.5,2.6,1.2,0], [1.2,3.0,3.8,5.8,7.6,6.3,2.0,0],
  [.9,2,3.2,6.7,9.6,8.6,3.2,0], [.4,1.6,2.6,5.3,9.2,8.2,2.6,0],
  [2.1,2.3,2.3,3.2,7,6.2,.6,0], [1.45,1.95,2.8,4.3,6.4,4.6,-.4,0],
  [1.2,1.7,2.2,2.7,2.6,1.0,-.7,0], [.4,.6,.8,.8,.5,.2,0,0],
  [0,0,0,0,0,0,0,0],
]
// prettier-ignore
const lute = [
  [0,0,0,0,0,0,0,0], [2.6,2,.9,.2,0,0,0,0],
  [1,1.5,1.2,2.1,2.3,1.5,.3,0], [6.7,6.7,4.4,3.9,3.4,2.7,.7,0],
  [3.7,4.6,4.2,5.7,6.0,4.8,2.2,0], [1.7,2.9,4.3,7.4,9.6,7.2,2.3,0],
  [1,2.2,3.6,7.7,10.6,8.4,2.8,0], [.4,2.0,3.1,5.7,9,7.5,2.1,0],
  [2.7,2.5,2.65,3.55,6.9,5.7,1.1,0], [1.85,2.05,2.55,4.0,5.9,4.2,.4,0],
  [1.2,1.6,2.1,2.4,2,.9,.1,0], [.5,.7,.9,.8,.5,0,0,0],
  [0,0,0,0,0,0,0,0],
]
// prettier-ignore
const scholar = [
  [0,0,0,0,0,0,0,0], [3.5,3.1,1.6,.1,0,0,0,0],
  [1.6,1.8,.8,.8,1.2,.6,0,0], [5.7,5.5,3.5,1.6,2.4,1.2,0,0],
  [3.0,3.8,3.1,2.2,2.7,2.9,.7,0], [1.6,2.8,3.0,4.5,6.8,6.6,2.2,0],
  [1.9,2.9,3.3,5.4,9.3,9.7,3.1,0], [.9,2.1,2.6,4.2,8.3,8.5,2.4,0],
  [2.5,2.0,1.1,2.2,6.0,6.6,.8,0], [2.1,2.8,4.3,5.8,7.1,5.6,-.1,0],
  [1.4,2.1,2.8,3.2,2.4,1.4,-.8,0], [.5,.7,.8,1,.7,.3,0,0],
  [0,0,0,0,0,0,0,0],
]
// prettier-ignore
const drummer = [
  [0,0,0,0,0,0,0,0], [3.6,3.3,1.9,.8,.4,0,0,0],
  [1.4,1.9,1.4,2.1,3,1.8,0,0], [6.3,6.1,4.3,3.0,3.9,3.2,.9,0],
  [4.2,4.9,4.5,4.9,5.4,4.2,1.3,0], [2,3.2,4.1,6.7,8.6,7.6,2.3,0],
  [1.6,2.6,3.5,7,9.6,9.1,3.4,0], [.6,1.8,2.4,5.1,8.2,8.4,3.1,0],
  [2.4,2.5,2.1,3.8,6.2,5.8,1.2,0], [2.1,2.7,3.5,5.0,6.6,5.1,.5,0],
  [1,1.5,2.4,2.9,2.2,1.3,-.1,0], [.4,.7,.8,.9,.7,.3,0,0],
  [0,0,0,0,0,0,0,0],
]
function interval(grid, x) {
  let i = 0
  while (i < grid.length - 2 && grid[i + 1] < x) i++
  return i
}
function interpolate(grid, row, x, i) {
  const j = i + 1,
    p = Math.max(i - 1, 0),
    q = Math.min(j + 1, grid.length - 1)
  const h = grid[j] - grid[i],
    u = (x - grid[i]) / h
  const a = row[i],
    b = row[j]
  const m = i === 0 ? 0 : (h * (b - row[p])) / (grid[j] - grid[p])
  const n = j === grid.length - 1 ? 0 : (h * (row[q] - a)) / (grid[q] - grid[i])
  return a + u * (m + u * (3 * (b - a) - 2 * m - n + u * (2 * (a - b) + m + n)))
}
export function facialPlanes(family) {
  const levels = { silk, lute, scholar, drummer }[family]
  if (!levels) return null
  const columns = cross.map((_, i) => levels.map((row) => row[i])),
    rows = new Map()
  return (x, y) => {
    const h = y * 1000,
      w = Math.abs(x) * 1000
    if (h <= height[0] || h >= height.at(-1) || w >= cross.at(-1)) return 0
    let row = rows.get(y)
    if (!row) {
      // The arch rises under the temporal canthus. Oblique interpolation
      // lets the lower cheek turn across the mouth instead of describing a
      // level belt at the height of each transverse skull section.
      const cheek = Math.exp(-(((h - 85) / 31) ** 2))
      const width = 8 * cheek
      row = columns.map((col, i) => {
        const yy = h - cheek * Math.max(-5, Math.min(10, (cross[i] - 31) * 0.29))
        const sample = (v) => interpolate(height, col, v, interval(height, v))
        return 0.52 * sample(yy) + 0.24 * (sample(yy - width) + sample(yy + width))
      })
      rows.set(y, row)
    }
    return 0.001 * interpolate(cross, row, w, interval(cross, w))
  }
}
