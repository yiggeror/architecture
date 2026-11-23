import * as T from 'three'
import { surfaceInputs, surfaceLight } from './surfaceLight.js'

// Geometry records the front surface before evaluating the directional shadows,
// lantern fields and moving lights. A distant grille can put dozens of fragments
// on the same pixel. Only the visible one needs that lighting calculation.
const surfaceRecord = `
varying vec3 wp,wn,surfaceColor;varying vec2 st;
uniform sampler2D paint,glowMap,reliefMap;
uniform vec3 pigment,emission;uniform vec2 uvOffset;
uniform float rough,metal,cutoff,mapRepeatX,mapRepeatY,relief,groundReflection;
uniform bool hasPaint,hasGlowMap;
layout(location=0) out vec4 albedo;
layout(location=1) out vec4 surface;
layout(location=2) out vec4 radiance;
vec2 octNormal(vec3 n){
 float length1=abs(n.x)+abs(n.y)+abs(n.z);if(length1<1.e-8)return vec2(0.,1.);
 n/=length1;
 return n.z>=0.?n.xy:(1.-abs(n.yx))*vec2(n.x>=0.?1.:-1.,n.y>=0.?1.:-1.);
}
void main(){
 ${surfaceInputs}
 albedo=vec4(base,wetMask);
 surface=vec4(octNormal(n),surfaceRoughness,metal);
 radiance=vec4(emit,1.);
}`
const shadePixel = `
precision highp sampler3D;
uniform sampler2D albedo,surface,emitted,distances;
uniform mat4 unproject,lightMatrix;uniform vec4 field;
vec3 wp;vec4 shadowCoord;
${surfaceLight}
void main(){
 ivec2 p=ivec2(gl_FragCoord.xy);
 #ifdef SAMPLE_OFFSET
 p=2*p+SAMPLE_OFFSET;
 #endif
 float z=texelFetch(distances,p,0).r;
 if(z>=1.){gl_FragColor=vec4(0.,0.,0.,1.);gl_FragDepth=1.;return;}
 vec2 screen=(vec2(p)+.5-field.xy)/field.zw;
 vec4 h=unproject*vec4(screen*2.-1.,z*2.-1.,1.);
 wp=h.xyz/h.w;shadowCoord=lightMatrix*vec4(wp,1.);
 vec4 a=texelFetch(albedo,p,0),s=texelFetch(surface,p,0),r=texelFetch(emitted,p,0);
 vec3 n=vec3(s.xy,1.-abs(s.x)-abs(s.y));float fold=max(0.,-n.z);
 n.xy+=vec2(n.x>=0.?-fold:fold,n.y>=0.?-fold:fold);
 gl_FragColor=vec4(lightSurface(normalize(n),a.rgb,r.rgb,s.z,s.w,0.,a.a),1.);
 gl_FragDepth=z;
}`
const position = new T.BufferGeometry()
position.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))

export function visibleLight(renderer, stone, common) {
  if (!renderer.extensions.has('EXT_color_buffer_float')) return null
  const targets = new WeakMap()
  function makeFields() {
    return new T.WebGLRenderTarget(1, 1, {
      count: 3,
      type: T.HalfFloatType,
      minFilter: T.NearestFilter,
      magFilter: T.NearestFilter,
      depthTexture: new T.DepthTexture(1, 1, T.UnsignedIntType),
    })
  }
  const view = {
    albedo: { value: null },
    surface: { value: null },
    emitted: { value: null },
    distances: { value: null },
    unproject: { value: new T.Matrix4() },
    field: { value: new T.Vector4() },
  }
  const gl = renderer.getContext(),
    samplePositions = renderer.extensions.has('OES_sample_variables')
  const sheets = new Map()
  function lightingSheet(samples) {
    if (sheets.has(samples)) return sheets.get(samples)
    const group = new T.Group()
    group.renderOrder = -1000
    const copies = samples && !samplePositions ? samples : 1
    for (let i = 0; i < copies; i++) {
      const offset = samples === 2 ? [i, i] : [i % 2, Math.floor(i / 2)]
      const shader = new T.RawShaderMaterial({
        glslVersion: T.GLSL3,
        uniforms: { ...common, ...view },
        toneMapped: false,
        vertexShader: 'in vec3 position;void main(){gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:
          (samples && samplePositions ? '#extension GL_OES_sample_variables : require\n' : '') +
          'precision highp float;precision highp int;uniform vec3 cameraPosition;out vec4 festivalColor;\n#define gl_FragColor festivalColor\n#define texture2D texture\n' +
          shadePixel,
        defines: samples
          ? { SAMPLE_OFFSET: samplePositions ? 'ivec2(gl_SamplePosition*2.)' : 'ivec2(' + offset.join(',') + ')' }
          : {},
        depthFunc: T.AlwaysDepth,
      })
      const sheet = new T.Mesh(position, shader)
      sheet.frustumCulled = false
      sheet.renderOrder = i
      if (copies > 1) {
        sheet.onBeforeRender = () => {
          gl.enable(gl.SAMPLE_COVERAGE)
          gl.sampleCoverage((copies - i) / copies, false)
        }
        sheet.onAfterRender = () => gl.disable(gl.SAMPLE_COVERAGE)
      }
      group.add(sheet)
    }
    sheets.set(samples, group)
    return group
  }
  const hidden = new T.MeshBasicMaterial({ visible: false })
  const covered = [],
    other = [],
    materials = new Map()
  stone.traverse((object) => {
    const source = object.material
    if (!source) return
    if (
      !source.userData?.citySurface ||
      source.transparent ||
      !source.depthWrite ||
      source.uniforms.skinWrap.value ||
      source.defines?.FIGURE_ROUGHNESS ||
      object.isSkinnedMesh
    ) {
      other.push({ object, source })
      return
    }
    let record = materials.get(source)
    if (!record) {
      record = new T.ShaderMaterial({
        glslVersion: T.GLSL3,
        defines: source.defines,
        uniforms: source.uniforms,
        vertexShader: source.vertexShader,
        fragmentShader: surfaceRecord,
        vertexColors: true,
        side: source.side,
        polygonOffset: source.polygonOffset,
        polygonOffsetUnits: source.polygonOffsetUnits,
        polygonOffsetFactor: source.polygonOffsetFactor,
        toneMapped: false,
      })
      materials.set(source, record)
    }
    covered.push({ object, source, record })
  })
  return function render(scene, target, camera, reuseGeometry = false, sourceTarget = target) {
    // A four-sample display has four independent depth and color values even
    // where a passing boat crosses an eave. Very large displays keep their
    // native forward render when the temporary surface data exceeds the budget.
    const scale = target.samples ? 2 : 1
    if (
      target.width * target.height * scale * scale * 28 > 52 * 1024 * 1024 ||
      Math.max(target.width, target.height) * scale > renderer.capabilities.maxTextureSize
    ) {
      const previous = targets.get(sourceTarget)
      if (previous) {
        previous.dispose()
        targets.delete(sourceTarget)
      }
      renderer.setRenderTarget(target)
      renderer.render(scene, camera)
      return
    }
    let fields = targets.get(sourceTarget)
    if (!fields) {
      fields = makeFields()
      targets.set(sourceTarget, fields)
      reuseGeometry = false
    }
    fields.setSize(target.width * scale, target.height * scale)
    fields.viewport.copy(target.viewport).multiplyScalar(scale)
    fields.scissor.copy(target.scissor).multiplyScalar(scale)
    fields.scissorTest = target.scissorTest
    view.albedo.value = fields.textures[0]
    view.surface.value = fields.textures[1]
    view.emitted.value = fields.textures[2]
    view.distances.value = fields.depthTexture
    const sheet = lightingSheet(target.samples)
    try {
      if (!reuseGeometry) {
        for (const item of covered) item.object.material = item.record
        for (const item of other) item.object.material = hidden
        renderer.setRenderTarget(fields)
        renderer.render(stone, camera)
      }
      view.unproject.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse)
      view.field.value.copy(fields.viewport)
      scene.add(sheet)
      for (const item of other) item.object.material = item.source
      for (const item of covered) item.object.material = hidden
      renderer.setRenderTarget(target)
      renderer.render(scene, camera)
    } finally {
      sheet.removeFromParent()
      for (const item of covered) item.object.material = item.source
      for (const item of other) item.object.material = item.source
    }
  }
}
