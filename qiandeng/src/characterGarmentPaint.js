import * as T from 'three'

let cloth, silk, skin
// Six lengthwise swatches. The U coordinate repeats at the selvedge, while V
// selects and repeats within a bolt. Value variations survive vertex dyeing.
const swatches = 6
export function clothUV(bolt, u, v) {
  const local = v - Math.floor(v)
  return [u, (bolt + 0.012 + local * 0.976) / swatches]
}
export function finishes() {
  if (cloth) return { cloth, silk, skin }
  const width = 192,
    size = 160,
    height = size * swatches,
    data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const k = Math.floor(y / size),
        j = y % size
      const satin = k === 2 || k === 3 || k === 5
      const weave =
        (satin ? 1.12 : 2.2) * Math.sin(x * Math.PI * 0.5 + (j % 2) * 0.7) +
        (satin ? 0.7 : 1.85) * Math.sin(j * Math.PI * 0.66 + 0.3 * Math.sin(x * 0.4))
      const irregular =
        1.35 * Math.cos(0.09 * x + 0.3 * Math.sin(j * 0.05)) + 0.9 * Math.sin(j * 0.7 + x * 0.25)
      let val = (satin ? 242 : 246) + weave + irregular
      if (k === 1) val += 0.7 * Math.sin(j * 0.14)
      const i = (y * width + x) * 4
      data[i] = val
      data[i + 1] = val
      data[i + 2] = val
      data[i + 3] = 255
    }
  // Mineral-tone double outlines, tapered lanceolate leaves and small clustered
  // petals are drawn once into the bolt. A tiny cross-section of linen gets no motif.
  function brush(k, x, y, r, brightness, opacity = 1) {
    x *= width / 128
    y *= size / 128
    r *= Math.sqrt(width * size) / 128
    const left = Math.floor(x - r),
      right = Math.ceil(x + r),
      top = Math.floor(y - r),
      bottom = Math.ceil(y + r)
    for (let j = top; j <= bottom; j++)
      for (let i = left; i <= right; i++) {
        const d = Math.hypot(i + 0.5 - x, j + 0.5 - y)
        if (d > r + 0.3) continue
        const a = opacity * Math.min(1, Math.max(0, r + 0.35 - d))
        const px = ((i % width) + width) % width,
          py = ((j % size) + size) % size
        const n = ((k * size + py) * width + px) * 4
        data[n] = data[n] * (1 - a) + (brightness + 1.8) * a
        data[n + 1] = data[n + 1] * (1 - a) + brightness * a
        data[n + 2] = data[n + 2] * (1 - a) + (brightness - 2.5) * a
      }
  }
  function stroke(k, fn, ink = 209, r = 1, alpha = 1) {
    const points = 70
    for (let n = 0; n <= points; n++) {
      const t = n / points,
        p = fn(t)
      brush(k, p[0], p[1], r * (0.39 + 0.61 * Math.sin(Math.PI * Math.pow(t, 0.82))), ink, alpha)
    }
  }
  function leaf(k, x, y, dx, dy, r) {
    const length = Math.max(1, Math.hypot(dx, dy))
    for (const side of [-1, 1])
      stroke(
        k,
        (t) => [
          x + dx * t + (dy / length) * side * r * Math.sin(Math.PI * t),
          y + dy * t - (dx / length) * side * r * Math.sin(Math.PI * t),
        ],
        213,
        0.86
      )
    stroke(k, (t) => [x + dx * t, y + dy * t], 225, 0.62)
  }
  // Bamboo blades above a slender jointed culm.
  for (const [x, y] of [
    [16, 96],
    [83, 49],
  ]) {
    const stem = (t) => [x + 21 * t + 7 * t * t, y - 65 * t]
    stroke(2, stem, 210, 1.15)
    for (const [t, dx, dy, w] of [
      [0.26, -15, -11, 2],
      [0.34, 13, -15, 2.2],
      [0.62, -15, -22, 1.9],
      [0.7, 12, -17, 1.8],
      [0.87, 7, -16, 1.4],
    ]) {
      const p = stem(t)
      leaf(2, ...p, dx, dy, w)
    }
  }
  // Broken water lines and small two-lobed ruyi heads.
  for (const [x, y] of [
    [4, 25],
    [72, 88],
  ]) {
    for (let n = 0; n < 3; n++)
      stroke(
        3,
        (t) => [x + 56 * t, y + n * 3.4 + 3 * Math.sin(2 * Math.PI * t) - 7 * Math.sin(t * Math.PI)],
        n === 0 ? 202 : 221,
        0.86
      )
    stroke(
      3,
      (t) => [x + 20 + 17 * t, y - 6 - 6 * Math.sin(Math.PI * t) - 3 * Math.sin(3 * Math.PI * t)],
      209,
      1.1
    )
  }
  // Selvedge in repeating linked lozenges, a stitched centreline and flanking reeds.
  for (let i = 0; i < 4; i++) {
    const x = i * 32
    for (const side of [-1, 1])
      stroke(4, (t) => [x + 32 * t, 64 + side * 15 * Math.sin(Math.PI * t)], 218, 1.2)
    for (const y of [37, 42, 86, 91])
      stroke(4, (t) => [x + 32 * t, y + 1.1 * Math.sin(2 * t * Math.PI)], 230, 0.82)
  }
  // Folded plum bough: rough bark with a forked tip and five uneven petals.
  for (const [x, y] of [
    [29, 39],
    [88, 96],
  ]) {
    stroke(5, (t) => [x + 40 * t, y + 25 * t + 2.1 * Math.sin(Math.PI * 3 * t)], 215, 1.3)
    stroke(5, (t) => [x + 23 + 12 * t, y + 13 - 18 * t + 3 * Math.sin(t * Math.PI)], 215, 0.84)
    for (const [fx, fy] of [
      [x, y],
      [x + 12, y + 4],
      [x + 11, y - 8],
    ]) {
      for (let p = 0; p < 5; p++) {
        const a = p * Math.PI * 0.4 + 0.35
        leaf(5, fx, fy, Math.cos(a) * 5.4, Math.sin(a) * 5.4, 2.16)
      }
      brush(5, fx, fy, 1.1, 198)
    }
  }
  // A tall atlas repeats each bolt in its warp direction. Texture interpolation
  // across a joint then keeps the same repeat and never stretches a leaf from
  // shoulder to cuff.
  const repeats = 4,
    woven = new Uint8Array(data.length * repeats)
  for (let swatch = 0; swatch < swatches; swatch++)
    for (let j = 0; j < repeats; j++) {
      const first = swatch * size * width * 4,
        length = size * width * 4
      woven.set(data.subarray(first, first + length), (swatch * repeats + j) * length)
    }
  const tex = new T.DataTexture(woven, width, height * repeats, T.RGBAFormat)
  tex.name = '裁缝铺 · 麻缣六匹'
  tex.colorSpace = T.SRGBColorSpace
  tex.wrapS = T.RepeatWrapping
  tex.wrapT = T.ClampToEdgeWrapping
  tex.magFilter = T.LinearFilter
  tex.minFilter = T.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  const normals = new Uint8Array(woven.length)
  for (let y = 0; y < height * repeats; y++)
    for (let x = 0; x < width; x++) {
      const bolt = Math.floor(y / (size * repeats)),
        satin = bolt === 2 || bolt === 3 || bolt === 5
      const warp = Math.sin(x * Math.PI * 0.5 + 0.19 * Math.sin(y * 0.37))
      const weft = Math.sin(y * Math.PI * 0.667 + 0.21 * Math.cos(x * 0.53))
      const over = Math.cos((x + (satin ? 2 : 1) * Math.floor(y * 0.5)) * Math.PI * 0.5)
      const dx = (satin ? 26 : 53) * warp * (0.75 + 0.25 * over),
        dy = (satin ? 50 : 43) * weft * (0.77 - 0.23 * over)
      const n = (y * width + x) * 4
      normals[n] = 128 + dx
      normals[n + 1] = 128 + dy
      normals[n + 2] = 128 + Math.sqrt(127 * 127 - dx * dx - dy * dy)
      normals[n + 3] = 255
    }
  const yarn = new T.DataTexture(normals, width, height * repeats, T.RGBAFormat)
  yarn.name = '纬纱、经纱与浮长线'
  yarn.wrapS = T.RepeatWrapping
  yarn.wrapT = T.ClampToEdgeWrapping
  yarn.magFilter = T.LinearFilter
  yarn.minFilter = T.LinearMipmapLinearFilter
  yarn.generateMipmaps = true
  yarn.needsUpdate = true
  const base = { vertexColors: true, side: T.DoubleSide, metalness: 0 }
  cloth = new T.MeshStandardMaterial({
    ...base,
    map: tex,
    normalMap: yarn,
    normalScale: new T.Vector2(0.28, 0.28),
    roughness: 0.89,
  })
  cloth.name = '洗麻与靛布'
  silk = new T.MeshStandardMaterial({
    ...base,
    map: tex,
    normalMap: yarn,
    normalScale: new T.Vector2(0.21, 0.21),
    roughness: 0.54,
  })
  silk.name = '暗花绫与镶缘'
  skin = new T.MeshStandardMaterial({ ...base, roughness: 0.71 })
  skin.name = '人物颈腕'
  skin.userData.skin = true
  return { cloth, silk, skin }
}
