import * as T from 'three'

// Save the stonework and its exact depth once at a stationary viewpoint. Every
// moving silhouette, including the mirror image, still meets that same depth.
export function layeredView(renderer, city, stone) {
  const buffer = new T.WebGLRenderTarget(1, 1, {
    type: T.HalfFloatType,
    minFilter: T.NearestFilter,
    magFilter: T.NearestFilter,
  })
  buffer.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType)
  const last = new T.Matrix4(),
    lastProjection = new T.Matrix4()
  const screen = new T.Scene(),
    lens = new T.Camera()
  const copy = new T.ShaderMaterial({
    depthTest: true,
    depthFunc: T.AlwaysDepth,
    depthWrite: true,
    toneMapped: false,
    uniforms: { ink: { value: buffer.texture }, depthField: { value: buffer.depthTexture } },
    vertexShader: 'varying vec2 st;void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:
      'varying vec2 st;uniform sampler2D ink,depthField;void main(){gl_FragDepth=texture2D(depthField,st).r;gl_FragColor=texture2D(ink,st);}',
  })
  const tri = new T.BufferGeometry()
  tri.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
  tri.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2))
  const plate = new T.Mesh(tri, copy)
  plate.frustumCulled = false
  screen.add(plate)
  let fresh = true,
    lastTime = -10000
  function render(target, camera, stamp, refreshMs) {
    if (buffer.width !== target.width || buffer.height !== target.height) {
      buffer.setSize(target.width, target.height)
      fresh = true
    }
    const changed =
      fresh || !last.equals(camera.matrixWorld) || !lastProjection.equals(camera.projectionMatrix)
    if (changed || stamp - lastTime > refreshMs) {
      fresh = false
      last.copy(camera.matrixWorld)
      lastProjection.copy(camera.projectionMatrix)
      lastTime = stamp
      renderer.setRenderTarget(buffer)
      renderer.render(stone, camera)
    }
    renderer.setRenderTarget(target)
    renderer.render(screen, lens)
    const background = city.background,
      auto = renderer.autoClear
    city.background = null
    stone.visible = false
    renderer.autoClear = false
    renderer.render(city, camera)
    renderer.autoClear = auto
    stone.visible = true
    city.background = background
  }
  return {
    render,
    invalidate() {
      fresh = true
    },
  }
}
