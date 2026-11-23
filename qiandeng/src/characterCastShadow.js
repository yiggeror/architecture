import * as T from 'three'

// A tight light camera can resolve a fringe, a fingertip or the rim of a
// parasol. The city's roof atlas covers several hundred metres per image.
export function characterCastShadow(renderer) {
  const resolution = 768
  const target = new T.WebGLRenderTarget(resolution, resolution, {
    minFilter: T.NearestFilter,
    magFilter: T.NearestFilter,
    generateMipmaps: false,
  })
  target.depthTexture = new T.DepthTexture(resolution, resolution, T.UnsignedIntType)
  const lens = new T.OrthographicCamera(-1.30, 1.30, 1.34, -1.34, 0.25, 7)
  const casters = new T.Scene()
  casters.matrixWorldAutoUpdate = false
  const maps = new WeakMap()
  const center = new T.Vector3(), head = new T.Vector3(), previousColor = new T.Color()
  const matrix = new T.Matrix4()
  let previousActor, previousTime = -Infinity, previousSource
  function casterMaterial(surface) {
    if (!maps.has(surface)) {
      const cut = surface.alphaTest || (surface.transparent ? 0.46 : 0)
      const depth = new T.MeshDepthMaterial({
        side: T.DoubleSide, alphaTest: cut,
        map: cut ? surface.map : null, alphaMap: cut ? surface.alphaMap : null,
      })
      // Translucent corneas, glass and thin veils transmit the key light.
      depth.visible = surface.visible && (!surface.transparent || surface.opacity >= 0.68)
      maps.set(surface, depth)
      surface.addEventListener('dispose', () => depth.dispose())
    }
    return maps.get(surface)
  }
  function prepare(entry) {
    const previous = renderer.getRenderTarget()
    try {
      renderer.setRenderTarget(target)
      for (const part of entry.parts) part.mesh.material = part.depth
      return renderer.compileAsync(entry.group, lens, casters)
    } finally {
      for (const part of entry.parts) part.mesh.material = part.surface
      renderer.setRenderTarget(previous)
    }
  }
  function render(entry, direction, source, t) {
    if (previousActor === entry && previousSource === source && t >= previousTime && t - previousTime < 1 / 28)
      return
    previousActor = entry
    previousTime = t
    previousSource = source
    entry.group.updateWorldMatrix(true, true)
    entry.head.getWorldPosition(head)
    center.setFromMatrixPosition(entry.group.matrixWorld).lerp(head, 0.59)
    lens.position.copy(center).addScaledVector(direction, 3.75)
    lens.up.set(0, 1, 0)
    if (Math.abs(direction.y) > 0.97) lens.up.set(0, 0, 1)
    lens.lookAt(center)
    lens.updateMatrixWorld()
    matrix.multiplyMatrices(lens.projectionMatrix, lens.matrixWorldInverse)
    const previousTarget = renderer.getRenderTarget()
    const previousAlpha = renderer.getClearAlpha()
    renderer.getClearColor(previousColor)
    casters.children.push(entry.group)
    try {
      for (const part of entry.parts) part.mesh.material = part.depth
      renderer.setRenderTarget(target)
      renderer.setClearColor(0xffffff, 1)
      renderer.clear()
      renderer.render(casters, lens)
    } finally {
      for (const part of entry.parts) part.mesh.material = part.surface
      casters.children.pop()
      renderer.setRenderTarget(previousTarget)
      renderer.setClearColor(previousColor, previousAlpha)
    }
  }
  return { casterMaterial, prepare, render, matrix, texture: target.depthTexture, texel: 1 / resolution }
}
