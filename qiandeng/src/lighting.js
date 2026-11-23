import * as T from 'three'
import { finishGpu } from './gpuFence.js'
import { bakeLanternVolume } from './lanternVolume.js'
import { swiftVertex, swiftFragment } from './mobileLight.js'
import { figureSkinning } from './figureSkinning.js'
import { innerField, valleyField, districtAir } from './cityLightField.js'

import { surfaceInputs, surfaceLight } from './surfaceLight.js'

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
  const [W, H, D] = field.size
  const { energy, dirs } = bakeLanternVolume(lights, field)
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
    format: T.RedFormat,
    minFilter: T.NearestFilter,
    magFilter: T.NearestFilter,
    generateMipmaps: false,
  })
  target.depthTexture = new T.DepthTexture(size, size, T.UnsignedIntType)
  const depth = new T.MeshDepthMaterial({ side: T.DoubleSide, colorWrite: false })
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
uniform sampler2D paint,glowMap,reliefMap;
#ifdef FIGURE_ROUGHNESS
uniform sampler2D grainGloss;
#endif
${surfaceLight}
uniform vec3 pigment,emission;uniform vec2 uvOffset;
uniform float rough,metal,cutoff,mapRepeatX,mapRepeatY,relief,groundReflection,skinWrap,opacity;
uniform bool hasPaint,hasGlowMap;
void main(){
 ${surfaceInputs}
 gl_FragColor=vec4(lightSurface(n,base,emit,surfaceRoughness,metal,skinWrap,wetMask),tex.a*opacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`
export async function lightCity(renderer, statics, world, prepareDay) {
  const v = volume(world.lights, innerField),
    valley = volume(world.lights, valleyField),
    size = 1536
  const night = directionalDepth(renderer, statics, moonDirection, size)
  await finishGpu(renderer.getContext())
  const broadNight = directionalDepth(renderer, statics, moonDirection, size, true)
  await finishGpu(renderer.getContext())
  // Bake both directions against the same complete city, before view-dependent
  // batches are selected. Changing the time of day only switches textures.
  await prepareDay()
  const sun = directionalDepth(renderer, statics, sunDirection, size)
  await finishGpu(renderer.getContext())
  const broadSun = directionalDepth(renderer, statics, sunDirection, size, true)
  await finishGpu(renderer.getContext())
  const white = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  white.needsUpdate = true
  const movePlace = Array.from({ length: maxMoving }, () => new T.Vector4(0, -1000, 0, 1))
  const moveHue = Array.from({ length: maxMoving }, () => new T.Vector4())
  const movingLow = Array.from({ length: 3 }, () => new T.Vector3())
  const movingHigh = Array.from({ length: 3 }, () => new T.Vector3())
  const common = {
    movingLow: { value: movingLow },
    movingHigh: { value: movingHigh },
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
    mirrorClip: { value: new T.Matrix4() },
    reflectedEye: { value: new T.Vector4() },
    moveMirror: { value: 0 },
    mirrorDepth: { value: white },
    blankDepth: { value: white },
    mirrorMap: { value: white },
    waterValid: { value: 0 },
    movePlace: { value: movePlace },
    moveHue: { value: moveHue },
  }
  const cache = new WeakMap(),
    lite = new WeakMap()
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
  function shade(root, alwaysSwift = false, groundReflection = true) {
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
            ...(src.alphaTest > 0 ? { CUTOUT: 1 } : {}),
            ...(map ? { PAINTED: 1 } : {}),
            ...(src.emissiveMap ? { GLOW_MAP: 1 } : {}),
            ...(src.normalMap ? { RELIEF: 1 } : {}),
            ...(groundReflection && src.roughness < .84 ? { WET: 1 } : {}),
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
            hasPaint: { value: Boolean(map) },
            hasGlowMap: { value: Boolean(src.emissiveMap) },
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
        mat.userData = { ...src.userData, citySurface: true }
        cache.set(src, mat)
      }
      obj.material = alwaysSwift ? swift(mat) : mat
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
    for (let group = 0; group < 3; group++) {
      const low = movingLow[group].setScalar(1e8)
      const high = movingHigh[group].setScalar(-1e8)
      for (let i = group * 4; i < Math.min(group * 4 + 4, maxMoving); i++) {
        if (!(moveHue[i].x || moveHue[i].y || moveHue[i].z)) continue
        const p = movePlace[i], radius = 1 / Math.sqrt(p.w) + .005
        low.set(Math.min(low.x, p.x - radius), Math.min(low.y, p.y - radius), Math.min(low.z, p.z - radius))
        high.set(Math.max(high.x, p.x + radius), Math.max(high.y, p.y + radius), Math.max(high.z, p.z + radius))
      }
    }
  }
  function mode(day) {
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
  }
}
