import * as T from 'three'
import { finishGpu } from './gpuFence.js'

// Loading a finished costume crosses the WebGL boundary a second time. Compile
// the real street materials and transfer their textures and vertex buffers while
// the visitor is still approaching. The same meshes go on screen afterwards.
export function characterUpload(renderer, city, camera) {
  const target = new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType })
  const probe = new T.Scene()
  probe.matrixWorldAutoUpdate = false
  const uploaded = new WeakMap()
  const gl = renderer.getContext()
  return async function prepare(group) {
    const previous = renderer.getRenderTarget()
    let compiled
    try {
      renderer.setRenderTarget(target)
      compiled = renderer.compileAsync(group, camera, city)
    } finally {
      renderer.setRenderTarget(previous)
    }
    await compiled
    const meshes = [],
      textures = new Set()
    group.traverse((mesh) => {
      if (!mesh.isMesh) return
      meshes.push(mesh)
      for (const material of [].concat(mesh.material))
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
    })
    for (const texture of textures) {
      if (uploaded.get(texture) === texture.version) continue
      renderer.initTexture(texture)
      uploaded.set(texture, texture.version)
      await finishGpu(gl)
    }
    group.updateWorldMatrix(true, true)
    probe.fog = city.fog
    for (let i = 0; i < meshes.length; i += 8) {
      const batch = meshes.slice(i, i + 8)
      const culled = batch.map((mesh) => mesh.frustumCulled)
      const active = renderer.getRenderTarget()
      try {
        // Borrow flat draw entries for one synchronous upload. Their bones,
        // parentage and animation bindings stay in the original figure.
        probe.children.push(...batch)
        for (const mesh of batch) mesh.frustumCulled = false
        renderer.setRenderTarget(target)
        renderer.render(probe, camera)
      } finally {
        renderer.setRenderTarget(active)
        probe.children.length = 0
        batch.forEach((mesh, j) => {
          mesh.frustumCulled = culled[j]
        })
      }
      await finishGpu(gl)
    }
  }
}
