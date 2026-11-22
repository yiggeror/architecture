// Coronal width and forward projection of the nasal bone, tip lobule and
// infratip at a series of sagittal stations. The right and left wings lie
// on a different axis from the dorsum, and turn back into the cheek.
const station = [-12, -7, -4, -1, 3, 7, 12, 19, 27, 35, 44, 55]
// prettier-ignore
const designs = {
  silk:    [[0,1.1,5.3,11.4,16.9,18.1,16.5,13.6,10.6,6.7,2.0,0],
            [4.1,4.2,4.8,6.4,8.2,8.8,8.0,7.1,7.4,8.8,9.8,12], 6.8],
  lute:    [[0,.6,4.2,10.7,16.5,17.8,14.9,11.2,8.3,4.8,1.5,0],
            [4.6,4.0,4.6,6.7,8.4,9.5,8.4,7.7,8.0,9.1,10,12], 6.7],
  scholar: [[0,1.3,5.6,11.9,16.7,18.3,18.0,16.4,13.1,8.7,4.1,0],
            [4.1,4.0,4.9,6.4,7.8,8.6,8.3,7.7,7.9,9.0,10,12], 6.9],
  drummer: [[0,1.0,4.9,10.6,14.7,16.7,15.9,13.6,10.6,6.3,2.1,0],
            [4.6,4.4,5.3,7.4,9.3,10.1,10.2,8.7,8.8,9.8,11,12], 8.4],
}
function interpolate(value, y, i) {
  const j = i + 1,
    p = Math.max(0, i - 1),
    q = Math.min(station.length - 1, j + 1)
  const h = station[j] - station[i],
    t = (y - station[i]) / h
  const a = value[i],
    b = value[j]
  const start = (h * (value[j] - value[p])) / (station[j] - station[p])
  const end = (h * (value[q] - value[i])) / (station[q] - station[i])
  return a + t * (start + t * (3 * (b - a) - 2 * start - end + t * (2 * (a - b) + start + end)))
}
export function nasalBridge(family, face, ala, noseY, eyeY) {
  const design = designs[family]
  if (!design) return null
  const [heights, widths, wing] = design,
    rows = new Map()
  // Distances below the tip remain millimetric while the bony span fits
  // the length between the alar line and the inner orbital rim.
  const span = 39 / (1000 * (eyeY - noseY))
  return (x, y) => {
    const dy = 1000 * (y - noseY)
    if (dy < -12 || dy * span > 55 || Math.abs(x) > 0.04) return 0
    let row = rows.get(y)
    if (!row) {
      const yy = dy < 8 ? dy : 8 + (dy - 8) * span
      if (yy >= 55) return 0
      let i = 0
      while (i < station.length - 2 && station[i + 1] < yy) i++
      const ridge = interpolate(heights, yy, i) * (1 + 0.065 * face.nose)
      const w = interpolate(widths, yy, i)
      const side = 2.65 * Math.exp(-(((yy - 17) / 17) ** 2))
      const wingMass = wing * Math.exp(-(((dy - 0.6) / 5.6) ** 2))
      row = [ridge, w, side, wingMass]
      rows.set(y, row)
    }
    const [ridge, w, side, wingMass] = row,
      xx = Math.abs(x) * 1000
    const xxSigned = x * 1000
    function lobes(separation, radius) {
      return (
        Math.exp(-(((xxSigned - separation) / radius) ** 2)) +
        Math.exp(-(((xxSigned + separation) / radius) ** 2))
      )
    }
    const wings = 0.83 * wingMass * lobes(ala * 780, 4.5)
    const domes = 1.18 * lobes(2.8, 5.2) * Math.exp(-(((dy - 3.7) / 5.4) ** 2))
    const walls = 0.78 * side * lobes(w * 1.05, 9.2)
    const core = Math.exp(-((xx / (w * 0.95)) ** 2) * 0.83)
    const spanSide = Math.max(0, Math.min(1, (dy + 5) / 13))
    const sidewall = Math.exp(-((xx / (w * 1.72)) ** 2) * 0.93)
    const bridge = 0.39 * spanSide
    return 0.001 * (ridge * ((1 - bridge) * core + bridge * sidewall) + domes + wings + walls)
  }
}
