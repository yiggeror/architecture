import * as T from 'three'
import { riverMist } from './haze.js'
import { layeredView, sceneColor, sceneSamples } from './layers.js'

const vertex = 'varying vec2 st;void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}'
const finite = 'vec3 safeSample(vec3 c){return (any(isnan(c))||any(isinf(c)))?vec3(0.):clamp(c,0.,48.);}'
const bright = `
varying vec2 st;uniform sampler2D frame;uniform vec2 pixel;
${finite}
vec3 extract(vec2 uv){
 vec3 c=safeSample(texture2D(frame,uv).rgb);float v=max(c.r,max(c.g,c.b));
 return c*(max(0.,v-.95)/(v+.14));
}
// The outer bilinear taps each cover two source texels. Include the middle
// row and column so a thin lamp doesn't blink as it crosses a bloom cell.
void main(){
 vec3 sum=vec3(0.);
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 o=vec2(float(x),float(y));
  sum+=extract(st+1.5*o*pixel)*(1.+abs(o.x))*(1.+abs(o.y));
 }
 gl_FragColor=vec4(sum/25.,1.);}`
const blur = `
varying vec2 st;uniform sampler2D frame;uniform vec2 pixel;
vec3 pair(float radius){vec2 d=radius*pixel;return texture2D(frame,st+d).rgb+texture2D(frame,st-d).rgb;}
void main(){
 // Linear filtering combines neighbouring taps of the original Gaussian.
 vec3 sum=texture2D(frame,st).rgb*.1560093+pair(1.442997)*.2595019+
   pair(3.369503)*.1244792+pair(5.301599)*.0331314+pair(7.241397)*.0048829;
 gl_FragColor=vec4(sum,1.);
}`
const contact = `
varying vec2 st;uniform sampler2D depthMap;uniform vec2 clipZ,lens;
vec3 reconstruct(vec2 q){
 float depth=texture2D(depthMap,q).r,z=clipZ.x*clipZ.y/(clipZ.y-depth*(clipZ.y-clipZ.x));
 return vec3((q*2.-1.)*lens*z,-z);
}
void main(){
 vec3 p=reconstruct(st);if(-p.z>175.){gl_FragColor=vec4(1.);return;}
 vec3 nx=cross(dFdx(p),dFdy(p)),n=nx*inversesqrt(max(dot(nx,nx),.00000001));float result=0.;
 for(int i=0;i<12;i++){
  float k=float(i),angle=k*2.39996+.49,r=.14+1.25*(k+.34)/12.;
  vec2 q=clamp(st+vec2(cos(angle),sin(angle))*r/(2.*lens*max(.5,-p.z)),.001,.999);
  vec3 delta=reconstruct(q)-p;float d=length(delta),occluder=max(dot(n,delta)/(d+.0001)-.105,0.);
  result+=occluder*(1.-smoothstep(.14,2.15,d));
 }
 gl_FragColor=vec4(vec3(1.-clamp(result*.133,0.,.53)),1.);
}`
const finish = `
varying vec2 st;uniform sampler2D frame,glow,contactMap,airGlow,depthMap;
uniform float day,edgeMix;uniform vec2 pixel,clipZ,focusLens;
${finite}
float depthAt(vec2 at){
  float z=texture2D(depthMap,at).r;return clipZ.x*clipZ.y/(clipZ.y-z*(clipZ.y-clipZ.x));
}
// A close visitor looks past the actor onto much more distant windows.
// Gather in linear light and reject foreground samples so bright lantern
// discs cannot bleed through the sitter, thin hair or the strings.
vec3 defocus(vec3 sharp){
 if(focusLens.y<.0001)return sharp;
 float depth=depthAt(st);
 float coc=focusLens.y*max(0.,1.-(focusLens.x+.25)/max(depth,.1));
 if(coc<pixel.y*.7)return sharp;
 vec2 aperture=vec2(pixel.x/pixel.y,1.)*coc;
 vec3 sum=sharp;float weight=1.;
 for(int i=0;i<16;i++){
   float seq=float(i)+.5;
   vec2 tap=clamp(st+aperture*sqrt(seq/16.)*vec2(cos(seq*2.39996),sin(seq*2.39996)),.001,.999);
   float d=depthAt(tap);
   float allowed=smoothstep(focusLens.x+.16,focusLens.x+.65,d);
   vec3 v=safeSample(texture2D(frame,tap).rgb);
   float w=allowed*(1.+.13*min(5.,max(v.r,max(v.g,v.b))));
   sum+=v*w;weight+=w;
 }
 return sum/weight;
}
#ifdef FILTER_EDGES
// On implementations without multisampled HDR, follow the local luminance
// edge. The contrast gate leaves texture and lettering in flat regions sharp.
float luma(vec3 color){float v=dot(color,vec3(.2126,.7152,.0722));return sqrt(v/(1.+v));}
vec3 alongEdge(vec3 center){
 float nw=luma(safeSample(texture2D(frame,st+pixel*vec2(-1.,1.)).rgb));
 float ne=luma(safeSample(texture2D(frame,st+pixel*vec2( 1.,1.)).rgb));
 float sw=luma(safeSample(texture2D(frame,st+pixel*vec2(-1.,-1.)).rgb));
 float se=luma(safeSample(texture2D(frame,st+pixel*vec2(1.,-1.)).rgb));
 float c=luma(center),low=min(c,min(min(nw,ne),min(sw,se))),high=max(c,max(max(nw,ne),max(sw,se)));
 if(high-low<max(.032,high*.14))return center;
 vec2 dir=vec2(sw+se-nw-ne,nw+sw-ne-se);
 float norm=min(abs(dir.x),abs(dir.y))+max(.0156,(nw+ne+sw+se)*.03125);
 dir=clamp(dir/norm,-4.,4.)*pixel;
 vec3 inner=.5*(texture2D(frame,st-dir/6.).rgb+texture2D(frame,st+dir/6.).rgb);
 vec3 wide=inner*.5+.25*(texture2D(frame,st-dir*.5).rgb+texture2D(frame,st+dir*.5).rgb);
 float value=luma(safeSample(wide));return value<low||value>high?inner:wide;
}
#endif
void main(){
 vec3 c=safeSample(texture2D(frame,st).rgb);vec3 halo=texture2D(glow,st).rgb;
 #ifdef FILTER_EDGES
 c=mix(c,alongEdge(c),edgeMix);
 #endif
 c=defocus(safeSample(c))*texture2D(contactMap,st).r;
 c+=texture2D(airGlow,st).rgb+halo*mix(.255,.085,day);c*=mix(1.01,.93,day);
 c*=mix(vec3(1.026,1.,.972),vec3(1.03,1.012,.98),day);
 vec2 radius=(st-.5)*vec2(1.,.82);c*=1.-.19*dot(radius,radius);
 gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`
function target(options = {}) {
  return new T.WebGLRenderTarget(1, 1, {
    type: T.HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: T.LinearFilter,
    magFilter: T.LinearFilter,
    ...options,
  })
}
function material(fragment, uniforms) {
  return new T.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms,
    depthTest: false,
    depthWrite: false,
  })
}
export function film(renderer, world, statics, camera, software, common) {
  const plate = layeredView(renderer, world, statics, software)
  // Software rasterizers pay for covered samples in CPU time. The stationary
  // stone plate still captures four samples; travelling views reconstruct edges
  // at the full display grid. Hardware retains multisampling on every frame.
  const samples = software ? 0 : sceneSamples(renderer)
  const lightFormat = sceneColor(renderer)
  const full = target({ ...lightFormat, samples, depthBuffer: true, depthTexture: new T.DepthTexture(1, 1, T.UnsignedIntType) })
  const small = target(lightFormat), blurred = target(lightFormat), air = target(lightFormat)
  const cavity = target({ format: T.RedFormat, type: T.UnsignedByteType })
  const post = new T.Scene(),
    cam = new T.Camera()
  const p = new T.BufferGeometry()
  p.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
  p.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2))
  const tri = new T.Mesh(p)
  tri.frustumCulled = false
  post.add(tri)
  const hi = material(bright, { frame: { value: full.texture }, pixel: { value: new T.Vector2() } })
  const gauss = material(blur, { frame: { value: null }, pixel: { value: new T.Vector2() } })
  const mist = riverMist(common, full.depthTexture)
  const occ = material(contact, {
    depthMap: { value: full.depthTexture },
    clipZ: { value: new T.Vector2() },
    lens: { value: new T.Vector2() },
  })
  const resolve = material(finish, {
    frame: { value: full.texture },
    glow: { value: small.texture },
    contactMap: { value: cavity.texture },
    airGlow: { value: air.texture },
    pixel: hi.uniforms.pixel,
    day: { value: 0 },
    edgeMix: { value: 1 },
    depthMap: { value: full.depthTexture },
    clipZ: occ.uniforms.clipZ,
    focusLens: { value: new T.Vector2(1, 0) },
  })
  const eyeSpace = new T.Vector3()
  if (!samples) resolve.defines.FILTER_EDGES = 1
  function focus(point) {
    const lens = resolve.uniforms.focusLens.value
    if (!point) { lens.set(1, 0); return }
    eyeSpace.copy(point).applyMatrix4(camera.matrixWorldInverse)
    const depth = -eyeSpace.z
    if (depth <= .22 || depth >= 4.4) { lens.set(1, 0); return }
    const extent = depth * Math.tan(T.MathUtils.degToRad(camera.fov / 2))
    const centred = Math.max(Math.abs(eyeSpace.x) / (extent * camera.aspect), Math.abs(eyeSpace.y) / extent)
    const openness = (1 - T.MathUtils.smoothstep(centred, .60, 1.08)) * (1 - T.MathUtils.smoothstep(depth, 2.3, 4.4))
    lens.set(depth, Math.min(.014, .013 / depth) * openness)
  }
  let x = 1,
    y = 1,
    filterTime = -1e6
  const lastEye = new T.Vector3(1e8, 0, 0),
    lastAim = new T.Quaternion()
  function size(w, h) {
    filterTime = -1e6
    full.setSize(w, h)
    x = Math.max(2, Math.ceil(w / 5))
    y = Math.max(2, Math.ceil(h / 5))
    small.setSize(x, y)
    blurred.setSize(x, y)
    air.setSize(Math.ceil(w / 4), Math.ceil(h / 4))
    cavity.setSize(Math.ceil(w * 0.5), Math.ceil(h * 0.5))
    hi.uniforms.pixel.value.set(1 / w, 1 / h)
  }
  function pass(mat, t) {
    tri.material = mat
    renderer.setRenderTarget(t)
    renderer.render(post, cam)
  }
  function draw(now) {
    const changed =
      lastEye.distanceToSquared(camera.position) > 0.0001 || lastAim.angleTo(camera.quaternion) > 0.001
    const filters = !software || changed || Math.abs(now - filterTime) > 195
    // The stationary wide view reuses its contact/air maps. Only resolve the
    // 24-bit scene depth when a post pass actually samples this frame's depth.
    full.resolveDepthBuffer = filters || resolve.uniforms.focusLens.value.y > .0001
    const cached = plate.render(full, camera, now, software ? 4800 : 680)
    resolve.uniforms.edgeMix.value = software && cached && sceneSamples(renderer) ? .43 : 1
    if (filters) {
      filterTime = now
      lastEye.copy(camera.position)
      lastAim.copy(camera.quaternion)
      const f = Math.tan((camera.fov * Math.PI) / 360)
      occ.uniforms.clipZ.value.set(camera.near, camera.far)
      occ.uniforms.lens.value.set(f * camera.aspect, f)
      pass(occ, cavity)
      mist.uniforms.inverseView.value.copy(camera.matrixWorld)
      mist.uniforms.lens.value.copy(occ.uniforms.lens.value)
      mist.uniforms.clipZ.value.copy(occ.uniforms.clipZ.value)
      pass(mist, air)
    }
    pass(hi, small)
    gauss.uniforms.frame.value = small.texture
    gauss.uniforms.pixel.value.set(1 / x, 0)
    pass(gauss, blurred)
    gauss.uniforms.frame.value = blurred.texture
    gauss.uniforms.pixel.value.set(0, 1 / y)
    pass(gauss, small)
    pass(resolve, null)
  }
  return {
    size,
    draw,
    focus,
    invalidate() {
      plate.invalidate()
      filterTime = -1e6
    },
    mode(day) {
      resolve.uniforms.day.value = Number(day)
      plate.invalidate()
      filterTime = -1e6
    },
  }
}
