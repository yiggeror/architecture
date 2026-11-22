import * as T from 'three'

// Broad paper windows give polished hair, silk and metal fittings a shape
// to reflect. Direct sources in the studio still model the face and shadows.
export function studioWindows() {
  const width = 256,
    height = 128
  const pixels = new Uint16Array(width * height * 4)
  const direction = new T.Vector3(),
    window = new T.Vector3(-0.68, 0.42, 0.58).normalize()
  const back = new T.Vector3(0.62, 0.34, -0.91).normalize()
  for (let y = 0; y < height; y++) {
    const latitude = Math.PI * ((y + 0.5) / height - 0.5)
    for (let x = 0; x < width; x++) {
      const theta = 2 * Math.PI * ((x + 0.5) / width - 0.5)
      direction.set(
        Math.cos(theta) * Math.cos(latitude),
        Math.sin(latitude),
        Math.sin(theta) * Math.cos(latitude),
      )
      const sky = 0.085 + 0.3 * (direction.y + 1)
      const softbox = 3.4 * Math.exp(-10 * (1 - direction.dot(window)))
      const slit = 2.1 * Math.exp(-27 * (1 - direction.dot(back)))
      const i = 4 * (y * width + x)
      pixels[i] = T.DataUtils.toHalfFloat(sky * 1.02 + softbox + 0.78 * slit)
      pixels[i + 1] = T.DataUtils.toHalfFloat(sky * 0.96 + 0.88 * softbox + 0.91 * slit)
      pixels[i + 2] = T.DataUtils.toHalfFloat(sky * 0.89 + 0.73 * softbox + slit)
      pixels[i + 3] = T.DataUtils.toHalfFloat(1)
    }
  }
  const image = new T.DataTexture(pixels, width, height, T.RGBAFormat, T.HalfFloatType)
  image.mapping = T.EquirectangularReflectionMapping
  image.colorSpace = T.LinearSRGBColorSpace
  image.needsUpdate = true
  return image
}
