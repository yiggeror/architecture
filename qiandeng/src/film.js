import * as T from 'three'
import { riverMist } from './haze.js'
import { layeredView } from './layers.js'

const vertex = 'varying vec2 st;void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}'
const finite = 'vec3 safeSample(vec3 c){return (any(isnan(c))||any(isinf(c)))?vec3(0.):clamp(c,0.,48.);}'
const bright = `
varying vec2 st;uniform sampler2D frame;uniform vec2 pixel;
${finite}
void main(){
 vec3 sum=vec3(0.);
 for(int j=0;j<4;j++){vec2 off=(vec2(float(j-2*(j/2)),float(j/2))-.5)*pixel*3.;
 vec3 c=safeSample(texture2D(frame,st+off).rgb);float v=max(c.r,max(c.g,c.b));
 sum+=c*(max(0.,v-.95)/(v+.14));}
 gl_FragColor=vec4(sum*.25,1.);}`
const blur = `
varying vec2 st;uniform sampler2D frame;uniform vec2 pixel;
void main(){
 vec3 sum=vec3(0.);float weights=0.;
 for(int i=-8;i<=8;i++){
  float at=float(i),w=exp(-at*at/13.1);sum+=texture2D(frame,st+pixel*at).rgb*w;weights+=w;
 }
 gl_FragColor=vec4(sum/weights,1.);
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
varying vec2 st;uniform sampler2D frame,glow,contactMap,airGlow;uniform float day;uniform vec2 pixel;
${finite}
void main(){
 vec3 c=safeSample(texture2D(frame,st).rgb);vec3 halo=texture2D(glow,st).rgb;
 vec3 left=texture2D(frame,st-vec2(pixel.x,0.)).rgb,right=texture2D(frame,st+vec2(pixel.x,0.)).rgb;
 vec3 top=texture2D(frame,st-vec2(0.,pixel.y)).rgb,down=texture2D(frame,st+vec2(0.,pixel.y)).rgb;
 vec3 lum=vec3(.24,.64,.12);float horizontal=abs(dot(right-left,lum)),vertical=abs(dot(down-top,lum));
 c=mix(c,horizontal>vertical?(top+down)*.5:(left+right)*.5,smoothstep(.045,.45,max(horizontal,vertical))*.42);
 c=safeSample(c)*texture2D(contactMap,st).r;
 c+=texture2D(airGlow,st).rgb+halo*mix(.255,.085,day);c*=mix(1.01,.93,day);
 c*=mix(vec3(1.026,1.,.972),vec3(1.03,1.012,.98),day);
 vec2 radius=(st-.5)*vec2(1.,.82);c*=1.-.19*dot(radius,radius);
 gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`
function target(depth = false) {
  return new T.WebGLRenderTarget(1, 1, {
    type: T.HalfFloatType,
    depthBuffer: depth,
    stencilBuffer: false,
    minFilter: T.LinearFilter,
    magFilter: T.LinearFilter,
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
  const plate = layeredView(renderer, world, statics)
  const full = target(true),
    small = target(),
    blurred = target(),
    cavity = target(),
    air = target()
  full.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType)
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
  })
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
    plate.render(full, camera, now, software ? 4800 : 680)
    const changed =
      lastEye.distanceToSquared(camera.position) > 0.0001 || lastAim.angleTo(camera.quaternion) > 0.001
    if (!software || changed || Math.abs(now - filterTime) > 195) {
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
