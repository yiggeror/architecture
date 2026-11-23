import * as T from 'three'

// The color and depth renderbuffers must accept the same sample count. Enabling
// the float color extension first also makes its sample counts visible to WebGL.
const formats = new WeakMap()
function sceneFormat(renderer) {
  if (!formats.has(renderer)) {
    const gl = renderer.getContext()
    const floatColor = renderer.extensions.has('EXT_color_buffer_float')
    const counts = format => gl.getInternalformatParameter(gl.RENDERBUFFER, format, gl.SAMPLES)
    const depth = counts(gl.DEPTH_COMPONENT24)
    const samples = format => {
      const color = counts(format)
      return [4, 2].find(n => color?.includes(n) && depth?.includes(n)) ?? 0
    }
    const rgba = samples(gl.RGBA16F), packed = floatColor ? samples(gl.R11F_G11F_B10F) : 0
    const color = { type: T.HalfFloatType }
    // The compositor reads radiance only. Blended materials still supply their
    // own source alpha. Three positive floating-point channels retain HDR in 32 bits.
    if (floatColor && packed >= rgba) Object.assign(color, { format: T.RGBFormat, internalFormat: 'R11F_G11F_B10F' })
    formats.set(renderer, { color, samples: Math.max(rgba, packed) })
  }
  return formats.get(renderer)
}
export function sceneSamples(renderer) { return sceneFormat(renderer).samples }
export function sceneColor(renderer) { return sceneFormat(renderer).color }

const triangle = new T.BufferGeometry()
triangle.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))

function restorePlate(renderer, buffer, samples, origin) {
  const gl = renderer.getContext()
  const nativePosition = samples > 0 && renderer.extensions.has('OES_sample_variables')
  const group = new T.Group()
  group.renderOrder = -1000
  // A stationary city stores four separate color/depth pairs. Even a sliver
  // of sky between a rail and a passing boat keeps its own depth test. Drivers
  // without per-sample shader inputs can restore each pair with sample masks.
  const copies = nativePosition ? 1 : samples || 1
  for (let i = 0; i < copies; i++) {
    const offset = samples === 2 ? [i, i] : [i % 2, Math.floor(i / 2)]
    const pixel = !samples ? '(ivec2(gl_FragCoord.xy) - origin)' : nativePosition
      ? '2 * (ivec2(gl_FragCoord.xy) - origin) + ivec2(gl_SamplePosition * 2.)'
      : `2 * (ivec2(gl_FragCoord.xy) - origin) + ivec2(${offset.join(',')})`
    const mat = new T.RawShaderMaterial({
      glslVersion: T.GLSL3,
      depthFunc: T.AlwaysDepth,
      toneMapped: false,
      uniforms: { ink: { value: buffer.texture }, depthField: { value: buffer.depthTexture }, origin: { value: origin } },
      vertexShader: 'in vec3 position;void main(){gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `${nativePosition ? '#extension GL_OES_sample_variables : require' : ''}
        precision highp float;precision highp int;
        uniform highp sampler2D ink,depthField;uniform ivec2 origin;out vec4 color;
        void main(){ivec2 p=${pixel};gl_FragDepth=texelFetch(depthField,p,0).r;color=texelFetch(ink,p,0);}`,
    })
    const mesh = new T.Mesh(triangle, mat)
    mesh.frustumCulled = false
    mesh.renderOrder = i
    if (copies > 1) {
      mesh.onBeforeRender = () => {
        gl.enable(gl.SAMPLE_COVERAGE)
        gl.sampleCoverage((copies - i) / copies, false)
      }
      mesh.onAfterRender = () => gl.disable(gl.SAMPLE_COVERAGE)
    }
    group.add(mesh)
  }
  return group
}

export function layeredView(renderer, city, stone, software = false) {
  const buffer = new T.WebGLRenderTarget(1, 1, {
    ...sceneColor(renderer),
    samples: software ? sceneSamples(renderer) : 0,
    minFilter: T.NearestFilter,
    magFilter: T.NearestFilter,
    depthTexture: new T.DepthTexture(1, 1, T.UnsignedIntType),
  })
  const last = new T.Matrix4(), lastProjection = new T.Matrix4()
  const lastViewport = new T.Vector4(), lastScissor = new T.Vector4()
  const origin = new T.Vector2()
  let plate, cached = false, first = true, lastTime = -Infinity, lastScissorTest = false
  const draft = software
    ? new T.WebGLRenderTarget(1, 1, {
        ...sceneColor(renderer),
        minFilter: T.NearestFilter,
        magFilter: T.NearestFilter,
        depthTexture: new T.DepthTexture(1, 1, T.UnsignedIntType),
      })
    : null
  let draftSheet,
    draftReady = false
  let previewReady = false,
    nextTile = 0,
    stillSince = -Infinity
  const tileView = new T.Frustum(),
    crop = new T.Matrix4(),
    viewProjection = new T.Matrix4()

  function preview(target, camera, same) {
    const paint = stone.userData.visibleLight
    if (paint) paint(city, target, camera, same && previewReady)
    else {
      renderer.setRenderTarget(target)
      renderer.render(city, camera)
    }
    previewReady = true
  }

  function tile(camera, width, height, tileSize) {
    const columns = Math.ceil(width / tileSize),
      rows = Math.ceil(height / tileSize)
    const x = (nextTile % columns) * tileSize,
      y = Math.floor(nextTile / columns) * tileSize
    const w = Math.min(tileSize, width - x),
      h = Math.min(tileSize, height - y)
    buffer.scissor.set(x, y, w, h)
    buffer.scissorTest = w !== width || h !== height
    const v = buffer.viewport
    crop.set(
      v.z / w,
      0,
      0,
      (2 * v.x + v.z - 2 * x - w) / w,
      0,
      v.w / h,
      0,
      (2 * v.y + v.w - 2 * y - h) / h,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
    )
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).premultiply(crop)
    const prior = camera.userData.reflectionFrustum
    camera.userData.reflectionFrustum = tileView.setFromProjectionMatrix(viewProjection)
    try {
      renderer.setRenderTarget(buffer)
      renderer.render(stone, camera)
    } finally {
      camera.userData.reflectionFrustum = prior
    }
    return ++nextTile === columns * rows
  }

  function render(target, camera, stamp, refreshMs) {
    if (stone.userData.preparingFlight) {
      preview(target, camera, false)
      return false
    }
    const initial = first
    const moving =
      initial ||
      !last.equals(camera.matrixWorld) ||
      !lastProjection.equals(camera.projectionMatrix) ||
      !lastViewport.equals(target.viewport) ||
      !lastScissor.equals(target.scissor) ||
      lastScissorTest !== target.scissorTest
    const scale = target.samples ? 2 : 1
    const v = target.viewport,
      r = target.scissorTest ? target.scissor : v
    const x = Math.max(0, r.x, v.x),
      y = Math.max(0, r.y, v.y)
    const w = scale * (Math.min(target.width, v.x + v.z, r.x + r.z) - x)
    const h = scale * (Math.min(target.height, v.y + v.w, r.y + r.w) - y)
    if (w <= 0 || h <= 0) return
    const bytes = (buffer.texture.format === T.RGBFormat ? 8 : 12) * (1 + buffer.samples)
    const budget = !target.texture.userData.planar ? 64 * 1024 * 1024 : 12 * 1024 * 1024
    const canCache = w * h * bytes <= budget && Math.max(w, h) <= renderer.capabilities.maxTextureSize
    if (!canCache && buffer.width > 1) buffer.setSize(1, 1)
    if (moving) {
      first = false
      cached = false
      previewReady = false
      draftReady = false
      nextTile = 0
      stillSince = performance.now()
      last.copy(camera.matrixWorld)
      lastProjection.copy(camera.projectionMatrix)
      lastViewport.copy(v)
      lastScissor.copy(target.scissor)
      lastScissorTest = target.scissorTest
    }
    // While a visitor is steering, use the current geometry. During a brief
    // pause its surface buffers can instantly relight that same view. Preparing
    // four-sample stonework in one submission would block the next touch.
    if (!canCache || (moving && !(software && initial))) {
      preview(target, camera, !moving)
      return false
    }
    const sizeChanged = buffer.width !== w || buffer.height !== h
    if (sizeChanged) {
      cached = false
      nextTile = 0
      buffer.setSize(w, h)
    }
    buffer.viewport.copy(v).multiplyScalar(scale)
    buffer.viewport.x -= x * scale
    buffer.viewport.y -= y * scale
    origin.set(x, y)
    const expired = Math.abs(stamp - lastTime) > refreshMs
    const quota = stone.userData.refinement
    const turn = !quota || (!quota.used && quota.main === !target.texture.userData.planar)
    if (initial && software) {
      buffer.scissorTest = false
      renderer.setRenderTarget(buffer)
      renderer.render(stone, camera)
      cached = true
      lastTime = stamp
    } else if ((!cached || expired || nextTile) && turn && performance.now() - stillSince > 280) {
      if (quota) quota.used = true
      if (tile(camera, w, h, software ? 112 : 288)) {
        cached = true
        lastTime = stamp
        nextTile = 0
      }
    }
    let active
    if (cached) {
      plate ??= restorePlate(renderer, buffer, target.samples, origin)
      active = plate
    } else if (draft && target.samples === 0 && previewReady && stone.userData.visibleLight) {
      // Resolve the last moving view once. While the four-sample plate fills,
      // boats and weather continue in front of the full-resolution preview.
      if (!draftReady) {
        draft.setSize(target.width, target.height)
        draft.viewport.copy(target.viewport)
        draft.scissor.copy(target.scissor)
        draft.scissorTest = target.scissorTest
        stone.userData.visibleLight(stone, draft, camera, true, target)
        draftReady = true
      }
      draftSheet ??= restorePlate(renderer, draft, 0, new T.Vector2())
      active = draftSheet
    } else {
      preview(target, camera, !moving)
      return false
    }
    city.add(active)
    stone.visible = false
    try {
      renderer.setRenderTarget(target)
      renderer.render(city, camera)
    } finally {
      stone.visible = true
      city.remove(active)
    }
    return cached
  }
  return {
    render,
    invalidate() {
      cached = false
      previewReady = false
      draftReady = false
      nextTile = 0
      lastTime = -Infinity
    },
  }
}
