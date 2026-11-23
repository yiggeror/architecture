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

  function render(target, camera, stamp, refreshMs) {
    const moving = first || !last.equals(camera.matrixWorld) || !lastProjection.equals(camera.projectionMatrix) ||
      !lastViewport.equals(target.viewport) || !lastScissor.equals(target.scissor) || lastScissorTest !== target.scissorTest
    // While flying write stone, sky, water and figures into one multisampled
    // framebuffer. The single resolve keeps geometry coverage and depth intact.
    const scale = target.samples ? 2 : 1
    const v = target.viewport, r = target.scissorTest ? target.scissor : v
    const x = Math.max(0, r.x, v.x), y = Math.max(0, r.y, v.y)
    const w = scale * (Math.min(target.width, v.x + v.z, r.x + r.z) - x)
    const h = scale * (Math.min(target.height, v.y + v.w, r.y + r.w) - y)
    if (w <= 0 || h <= 0) return
    // Cropped mirrors cache only their visible rectangle. A very large display
    // also keeps the native four geometry samples without a second full city plate.
    const bytes = (buffer.texture.format === T.RGBFormat ? 8 : 12) * (1 + buffer.samples)
    const budget = target.depthTexture ? 64 * 1024 * 1024 : 12 * 1024 * 1024
    const canCache = w * h * bytes <= budget && Math.max(w, h) <= renderer.capabilities.maxTextureSize
    if (!canCache && buffer.width > 1) buffer.setSize(1, 1)
    const live = moving && !(software && first)
    if (moving) {
      first = false
      cached = false
      last.copy(camera.matrixWorld)
      lastProjection.copy(camera.projectionMatrix)
      lastViewport.copy(target.viewport)
      lastScissor.copy(target.scissor)
      lastScissorTest = target.scissorTest
    }
    if (live || !canCache) {
      renderer.setRenderTarget(target)
      renderer.render(city, camera)
      return false
    }
    if (!cached || buffer.width !== w || buffer.height !== h || Math.abs(stamp - lastTime) > refreshMs) {
      buffer.setSize(w, h)
      buffer.viewport.copy(target.viewport).multiplyScalar(scale)
      buffer.viewport.x -= x * scale
      buffer.viewport.y -= y * scale
      buffer.scissorTest = false
      origin.set(x, y)
      renderer.setRenderTarget(buffer)
      renderer.render(stone, camera)
      lastTime = stamp
      cached = true
    }
    plate ??= restorePlate(renderer, buffer, target.samples, origin)
    city.add(plate)
    stone.visible = false
    renderer.setRenderTarget(target)
    renderer.render(city, camera)
    stone.visible = true
    city.remove(plate)
    return true
  }
  return {
    render,
    invalidate() { cached = false },
  }
}
