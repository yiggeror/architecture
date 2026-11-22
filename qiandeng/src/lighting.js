import * as T from 'three'
import { swiftVertex, swiftFragment } from './mobileLight.js'
import { figureSkinning } from './figureSkinning.js'
import { innerField, valleyField, lanternField, nightAir, sunAtlas, districtAir } from './cityLightField.js'

export const moonDirection = new T.Vector3(-0.87, 0.74, -0.1).normalize()
export const sunDirection = new T.Vector3(-0.65, 0.57, 0.49).normalize()
export function lightRegistry() {
  const lights = [],
    moving = []
  function lamp(x, y, z, color = 0xffae62, power = 17, range = 8) {
    const f = { p: [x, y, z], color, power, range }
    lights.push(f)
    return f
  }
  function movingLamp(x, y, z, color = 0xffac55, power = 23, range = 9) {
    const f = { position: new T.Vector3(x, y, z), color, power, range, strength: 1 }
    moving.push(f)
    return f
  }
  return {
    lights,
    moving,
    lamp,
    movingLamp,
    addLightAt(b, x, y, z, ...args) {
      return lamp(...b.point([x, y, z]), ...args)
    },
  }
}

function volume(lights, field) {
  const [W, H, D] = field.size,
    origin = new T.Vector3(...field.origin),
    step = field.step
  const count = W * H * D,
    rad = new Float32Array(count * 4),
    vec = new Float32Array(count * 4)
  const color = new T.Color()
  for (const f of lights) {
    const [x, y, z] = f.p,
      r = f.range
    if (![x, y, z, r, f.power].every(Number.isFinite) || r <= 0) continue
    color.set(f.color)
    const i0 = Math.max(0, Math.floor((x - r - origin.x) / step)),
      i1 = Math.min(W - 1, Math.ceil((x + r - origin.x) / step))
    const j0 = Math.max(0, Math.floor((y - r - origin.y) / step)),
      j1 = Math.min(H - 1, Math.ceil((y + r - origin.y) / step))
    const k0 = Math.max(0, Math.floor((z - r - origin.z) / step)),
      k1 = Math.min(D - 1, Math.ceil((z + r - origin.z) / step))
    for (let k = k0; k <= k1; k++)
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const dx = x - origin.x - i * step,
            dy = y - origin.y - j * step,
            dz = z - origin.z - k * step
          const d2 = dx * dx + dy * dy + dz * dz,
            fade = Math.max(0, 1 - d2 / (r * r))
          if (!fade) continue
          const v = (f.power * fade * fade) / (2.2 + d2),
            a = ((k * H + j) * W + i) * 4
          rad[a] += v * color.r
          rad[a + 1] += v * color.g
          rad[a + 2] += v * color.b
          const vlen = v / Math.sqrt(0.19 + d2)
          vec[a] += vlen * dx
          vec[a + 1] += vlen * dy
          vec[a + 2] += vlen * dz
          vec[a + 3] += v
        }
  }
  const energy = new Uint8Array(count * 4),
    dirs = new Uint8Array(count * 4)
  for (let a = 0; a < energy.length; a += 4) {
    for (let q = 0; q < 3; q++) {
      energy[a + q] = Math.round(Math.min(1, Math.sqrt(rad[a + q] / 12)) * 255)
      dirs[a + q] = Math.round(127.5 * (1 + vec[a + q] / Math.max(0.0001, vec[a + 3])))
    }
    energy[a + 3] = dirs[a + 3] = 255
  }
  const texture = (arr) => {
    const t = new T.Data3DTexture(arr, W, H, D)
    t.format = T.RGBAFormat
    t.magFilter = t.minFilter = T.LinearFilter
    t.unpackAlignment = 1
    t.needsUpdate = true
    return t
  }
  return { radiance: texture(energy), direction: texture(dirs) }
}

// A depth texture per celestial body is shared by every roof, moving boat and pedestrian.
function directionalDepth(renderer, statics, direction, size, outer = false) {
  const center = outer ? new T.Vector3(48, 64, -246) : new T.Vector3(0, 9, -17)
  const span = outer ? 528 : 129
  const camera = new T.OrthographicCamera(-span, span, span, -span, 3, outer ? 1250 : 445)
  camera.position.copy(center).addScaledVector(direction, outer ? 625 : 210)
  camera.lookAt(center)
  camera.updateMatrixWorld()
  const target = new T.WebGLRenderTarget(size, size, {
    minFilter: T.NearestFilter,
    magFilter: T.NearestFilter,
    generateMipmaps: false,
  })
  target.depthTexture = new T.DepthTexture(size, size, T.UnsignedIntType)
  const depth = new T.MeshDepthMaterial({ side: T.DoubleSide })
  const previous = renderer.getRenderTarget(),
    old = statics.overrideMaterial,
    clear = renderer.getClearColor(new T.Color())
  const ignored = []
  statics.traverse((o) => {
    if (o.isMesh && o.visible && (!o.castShadow || (o.material.transparent && o.material.opacity < 0.5))) {
      ignored.push(o)
      o.visible = false
    }
  })
  statics.overrideMaterial = depth
  renderer.setRenderTarget(target)
  renderer.setClearColor(0xffffff)
  renderer.clear()
  renderer.render(statics, camera)
  statics.overrideMaterial = old
  for (const o of ignored) o.visible = true
  renderer.setClearColor(clear)
  renderer.setRenderTarget(previous)
  depth.dispose()
  const matrix = new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  return { target, matrix }
}
const maxMoving = 10
const vs = `
#include <skinning_pars_vertex>
#include <morphtarget_pars_vertex>
varying vec3 wp,wn,surfaceColor;
varying vec2 st;
varying vec4 shadowCoord;
uniform mat4 lightMatrix;
void main(){
  vec4 pos=vec4(position,1.);vec3 norm=normal;
  ${figureSkinning}
  #ifdef USE_INSTANCING
    pos=instanceMatrix*pos;mat3 im=mat3(instanceMatrix);
    norm=im*(norm/vec3(dot(im[0],im[0]),dot(im[1],im[1]),dot(im[2],im[2])));
  #endif
  vec4 world=modelMatrix*pos;
  wp=world.xyz;vec3 n=mat3(modelMatrix)*norm;wn=dot(n,n)>1.e-12?normalize(n):vec3(0.,1.,0.);st=uv;surfaceColor=color;
  #ifdef USE_INSTANCING_COLOR
    surfaceColor*=instanceColor;
  #endif
  shadowCoord=lightMatrix*world;
  gl_Position=projectionMatrix*viewMatrix*world;
}`
const fs = `
precision highp sampler3D;
varying vec3 wp,wn,surfaceColor;
varying vec2 st; varying vec4 shadowCoord;
uniform sampler2D paint,glowMap,reliefMap,occTex,mirrorMap;
#ifdef FIGURE_ROUGHNESS
uniform sampler2D grainGloss;
#endif
${lanternField}
${nightAir}
${sunAtlas}
uniform vec3 pigment,emission,sunDir,fogHue;
uniform vec4 movePlace[${maxMoving}],moveHue[${maxMoving}];
uniform mat4 waterMatrix;
uniform float rough,metal,day,clockTime,cutoff,mapRepeatX,mapRepeatY,shadowTexel,waterValid;
uniform vec2 uvOffset; uniform float relief, groundReflection, skinWrap, opacity;
vec3 practical(vec3 n, vec3 eye, float surfaceRoughness, out vec3 gloss){
 vec3 light,dir;lanternFieldAt(wp,light,dir);
 float agreement=min(1.,length(dir));dir/=max(.001,agreement);
 float direct=mix(.75,.27+.97*max(0.,dot(n,dir)),agreement);
 vec3 lighting=direct*light;
 gloss=light*pow(max(dot(n,normalize(dir+eye)),0.),mix(62.,9.,surfaceRoughness))*.54*agreement;
 for(int i=0;i<${maxMoving};i++){
   vec3 delta=movePlace[i].xyz-wp;float d2=dot(delta,delta);
   if(d2*movePlace[i].w>1.)continue;
   float fall=max(1.-d2*movePlace[i].w,0.);vec3 l=moveHue[i].rgb*(fall*fall/(2.+d2));
   vec3 d=delta*inversesqrt(d2+.0001);
   lighting+=l*(.25+.98*max(dot(n,d),0.));gloss+=l*pow(max(dot(n,normalize(d+eye)),0.),mix(65.,10.,surfaceRoughness))*.8;
 }
 return lighting;
}
float sunlight(vec3 n){
 vec3 sc=shadowCoord.xyz*.5+.5;
 if(edgeDepth(sc)<.003)return farShadow(wp,n,sunDir);
 float bias=.00045+.00115*(1.-abs(dot(n,sunDir))),d=sc.z-bias;
 vec2 u=vec2(shadowTexel*.88,0.);return .25*(
 step(d,texture2D(occTex,sc.xy+u.xy+u.yx).r)+step(d,texture2D(occTex,sc.xy+u.xy-u.yx).r)+
 step(d,texture2D(occTex,sc.xy-u.xy+u.yx).r)+step(d,texture2D(occTex,sc.xy-u.xy-u.yx).r));
}
void main(){
 vec3 n=normalize(wn);if(!gl_FrontFacing)n=-n;
 vec2 uv=st*vec2(mapRepeatX,mapRepeatY)+uvOffset;vec4 tex=texture2D(paint,uv);
 if(tex.a<cutoff)discard;
 if(relief>0.){
   vec3 dx=dFdx(wp),dy=dFdy(wp);vec2 ux=dFdx(uv),uy=dFdy(uv);
   vec3 ax=cross(dy,n)*ux.x+cross(n,dx)*uy.x,ay=cross(dy,n)*ux.y+cross(n,dx)*uy.y;
   vec2 bump=(texture2D(reliefMap,uv).xy*2.-1.)*relief;
   n=normalize(n+(ax*bump.x+ay*bump.y)*inversesqrt(max(max(dot(ax,ax),dot(ay,ay)),1.e-12)));
 }
 vec3 base=pigment*surfaceColor*tex.rgb,eye=normalize(cameraPosition-wp),gloss;
 float surfaceRoughness=rough;
 #ifdef FIGURE_ROUGHNESS
  surfaceRoughness*=texture2D(grainGloss,uv).g;
 #endif
 float up=n.y*.5+.5,sha=sunlight(n),dotL=max(0.,(dot(n,sunDir)+skinWrap)/(1.+skinWrap));
 vec3 lam=practical(n,eye,surfaceRoughness,gloss);
 lam/=1.+.145*max(lam.r,max(lam.g,lam.b));
 vec3 ambience=skyFill(up,day),key=keyColor(day);
 vec3 color=base*(ambience+dotL*sha*key+lam*mix(1.43,.018,day));
 float sheen=pow(max(dot(n,normalize(eye+sunDir)),0.),mix(91.,5.,surfaceRoughness));
 color+=key*sha*sheen*(.12+.39*metal)*(1.-surfaceRoughness);
 color+=gloss*(1.27-surfaceRoughness)*mix(1.48,.045,day);
 vec3 emit=emission*texture2D(glowMap,uv).rgb*surfaceColor;
 color+=emit*mix(1.30,.026,day);
 // Wet sett joints break up the painted reflection and keep the dry grain in sheltered wood.
 float levelness=smoothstep(.81,.995,n.y);float low=1.-smoothstep(1.8,3.2,wp.y);
 float slick=groundReflection*levelness*low*(1.-smoothstep(.63,.84,rough))*smoothstep(-.1,.30,wp.y);
 if(waterValid>.5 && slick>.001){
    vec4 proj=waterMatrix*vec4(wp.x,-wp.z+11.,0.,1.);
    vec2 q=proj.xy/proj.w;
    float noiseVal=sin(wp.x*3.57+sin(wp.z*2.71))*.12+tex.r;
    float facing=.14+pow(1.-clamp(dot(eye,n),0.,1.),2.)*.82;
    vec2 jitter=vec2(sin(wp.z*29.7+wp.x*6.),cos(wp.x*18.7-wp.z*6.7))*.0013;
    vec3 refl=texture2D(mirrorMap,clamp(q+jitter,.001,.999)).rgb;
    color=mix(color,refl,slick*facing*smoothstep(.22,.77,noiseVal)*mix(.51,.16,day));
 }
 float mist=riverDistanceMist(length(wp-cameraPosition),cameraPosition.y,day);
 color=mix(color,fogHue,mist);
 if(any(isnan(color))||any(isinf(color)))color=base*(ambience+dotL*sha*key)+emit*mix(1.,.026,day);
 gl_FragColor=vec4(min(color,vec3(48.)),tex.a*opacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`
export function lightCity(renderer, statics, world) {
  const v = volume(world.lights, innerField),
    valley = volume(world.lights, valleyField),
    size = 1536
  const night = directionalDepth(renderer, statics, moonDirection, size)
  const broadNight = directionalDepth(renderer, statics, moonDirection, 1536, true)
  let sun, broadSun
  function prepareDay() {
    if (!sun) sun = directionalDepth(renderer, statics, sunDirection, size)
    if (!broadSun) broadSun = directionalDepth(renderer, statics, sunDirection, 1536, true)
  }
  const white = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  white.needsUpdate = true
  const movePlace = Array.from({ length: maxMoving }, () => new T.Vector4(0, -1000, 0, 1))
  const moveHue = Array.from({ length: maxMoving }, () => new T.Vector4())
  const common = {
    radiance: { value: v.radiance },
    directions: { value: v.direction },
    outerRadiance: { value: valley.radiance },
    outerDirections: { value: valley.direction },
    airField: { value: districtAir(world.lights) },
    outerDepth: { value: broadNight.target.depthTexture },
    outerLightMatrix: { value: broadNight.matrix },
    occTex: { value: night.target.depthTexture },
    lightMatrix: { value: night.matrix },
    sunDir: { value: moonDirection },
    fogHue: { value: new T.Color(0x44576c) },
    day: { value: 0 },
    clockTime: { value: 0 },
    shadowTexel: { value: 1 / size },
    waterMatrix: { value: new T.Matrix4() },
    mirrorMap: { value: white },
    waterValid: { value: 0 },
    movePlace: { value: movePlace },
    moveHue: { value: moveHue },
  }
  const cache = new WeakMap(),
    lite = new WeakMap(),
    switchable = []
  function swift(mat) {
    if (!lite.has(mat)) {
      const low = new T.ShaderMaterial({
        name: mat.name,
        defines: mat.defines,
        uniforms: mat.uniforms,
        vertexShader: swiftVertex,
        fragmentShader: swiftFragment,
        vertexColors: true,
        side: mat.side,
        transparent: mat.transparent,
        depthWrite: mat.depthWrite,
        polygonOffset: mat.polygonOffset,
        polygonOffsetUnits: mat.polygonOffsetUnits,
        polygonOffsetFactor: mat.polygonOffsetFactor,
      })
      low.userData = mat.userData
      lite.set(mat, low)
    }
    return lite.get(mat)
  }
  function shade(root, performanceMode = false, alwaysSwift = false, groundReflection = true) {
    root.traverse((obj) => {
      if (!obj.isMesh || !obj.material?.isMeshStandardMaterial) return
      const src = obj.material
      let mat = cache.get(src)
      if (!mat) {
        const map = src.map,
          glow = src.emissive.clone().multiplyScalar(src.emissiveIntensity)
        mat = new T.ShaderMaterial({
          name: src.name,
          defines: {
            ...(!groundReflection && src.normalMap ? { FIGURE_RELIEF: 1 } : {}),
            ...(!groundReflection && src.roughnessMap ? { FIGURE_ROUGHNESS: 1 } : {}),
          },
          vertexShader: vs,
          fragmentShader: fs,
          vertexColors: true,
          side: src.side,
          transparent: src.transparent,
          depthWrite: src.depthWrite,
          polygonOffset: src.polygonOffset,
          polygonOffsetFactor: src.polygonOffsetFactor,
          polygonOffsetUnits: src.polygonOffsetUnits,
          uniforms: {
            ...common,
            paint: { value: map || white },
            glowMap: { value: src.emissiveMap || white },
            pigment: { value: src.color },
            emission: { value: glow },
            reliefMap: { value: src.normalMap || white },
            grainGloss: { value: src.roughnessMap || white },
            relief: { value: src.normalMap ? src.normalScale?.x || 0.4 : 0 },
            rough: { value: src.roughness },
            metal: { value: src.metalness },
            groundReflection: { value: groundReflection ? 1 : 0 },
            skinWrap: { value: src.userData.skin ? 0.18 : 0 },
            opacity: { value: src.opacity },
            cutoff: { value: src.alphaTest },
            mapRepeatX: { value: map?.repeat.x || 1 },
            mapRepeatY: { value: map?.repeat.y || 1 },
            uvOffset: { value: map?.offset || new T.Vector2() },
          },
        })
        mat.userData = src.userData
        cache.set(src, mat)
      }
      obj.material = alwaysSwift ? swift(mat) : mat
      if (performanceMode) switchable.push([obj, mat, swift(mat)])
    })
  }
  const lightColor = new T.Color(),
    wick = new T.Vector3()
  function update(t) {
    common.clockTime.value = t
    world.moving.slice(0, maxMoving).forEach((l, i) => {
      movePlace[i].set(l.position.x, l.position.y, l.position.z, 1 / (l.range * l.range))
      lightColor.set(l.color).multiplyScalar(l.power * l.strength)
      moveHue[i].set(lightColor.r, lightColor.g, lightColor.b, 0)
    })
    // Two close silk lanterns can illuminate both their bearers and the
    // neighbouring stonework. They follow the animated handle on each frame.
    for (let i = world.moving.length; i < maxMoving; i++) {
      const lamp = world.handLights?.[i - world.moving.length]
      if (lamp) {
        lamp.getWorldPosition(wick)
        movePlace[i].set(wick.x, wick.y, wick.z, 1 / (lamp.distance * lamp.distance))
        lightColor.copy(lamp.color).multiplyScalar(lamp.intensity * 2.65)
        moveHue[i].set(lightColor.r, lightColor.g, lightColor.b, 1)
      } else {
        movePlace[i].set(0, -1000, 0, 1)
        moveHue[i].set(0, 0, 0, 0)
      }
    }
  }
  function mode(day) {
    if (day) prepareDay()
    const target = day ? sun : night,
      outer = day ? broadSun : broadNight
    common.outerDepth.value = outer.target.depthTexture
    common.outerLightMatrix.value = outer.matrix
    common.day.value = day ? 1 : 0
    common.lightMatrix.value = target.matrix
    common.occTex.value = target.target.depthTexture
    common.sunDir.value = day ? sunDirection : moonDirection
    common.fogHue.value.set(day ? 0x98aeb1 : 0x142032)
  }
  return {
    shade,
    mode,
    update,
    common,
    fast(enabled) {
      for (const [o, full, quick] of switchable) o.material = enabled ? quick : full
    },
  }
}
