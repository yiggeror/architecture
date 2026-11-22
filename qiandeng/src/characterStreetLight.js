import * as T from 'three'
import { characterCastShadow } from './characterCastShadow.js'

const lightsPerFigure = 3
const cellSize = 14

// Keep the garment, lacquer, eye and skin shaders used in the album. Supply
// their physical lighting model with the actual lights around this actor.
const declarations = `
varying vec3 actorPlace;
uniform vec4 actorLamps[3],actorColors[3];
uniform vec3 actorBounce,sunDir;
uniform float day,actorSkin,actorShadowSource,actorTexel;
uniform mat4 lightMatrix,outerLightMatrix,actorShadowMatrix;
uniform sampler2D occTex,outerDepth,actorDepth;
float actorAtlas(vec3 p,vec3 n){
  vec4 q=lightMatrix*vec4(p+.012*n,1.);
  vec3 c=.5+.5*q.xyz/q.w;
  if(any(lessThan(c,vec3(.004)))||any(greaterThan(c,vec3(.996)))){
    q=outerLightMatrix*vec4(p+.095*n,1.); c=.5+.5*q.xyz/q.w;
    if(any(lessThan(c,vec3(0.)))||any(greaterThan(c,vec3(1.))))return 1.;
    return step(c.z-.00085,texture2D(outerDepth,c.xy).r);
  }
  return step(c.z-.00052,texture2D(occTex,c.xy).r);
}
float actorSelf(vec3 p,vec3 n,vec3 l){
  vec4 q=actorShadowMatrix*vec4(p+n*.0013,1.);
  vec3 c=.5+.5*q.xyz/q.w;
  if(any(lessThan(c,vec3(.003)))||any(greaterThan(c,vec3(.997))))return 1.;
  vec3 x=dFdx(c),y=dFdy(c);
  float det=x.x*y.y-x.y*y.x;
  vec2 slope=abs(det)>.0000000001 ? vec2(y.y*x.z-x.y*y.z,x.x*y.z-y.x*x.z)/det :vec2(0.);
  slope=clamp(slope,vec2(-3.),vec2(3.));
  float z=c.z-.00028-.00023*(1.-abs(dot(n,l)));
  float sum=0.,weights=0.;
  vec2 tile=c.xy/actorTexel-.5, sub=fract(tile), base=floor(tile);
  for(int j=-1;j<=2;j++) for(int i=-1;i<=2;i++){
    vec2 off=vec2(float(i),float(j));
    vec2 a=max(vec2(0.),1.-abs(off-sub)*.5);
    float weight=a.x*a.y;
    vec2 uv=(base+off+.5)*actorTexel;
    sum+=weight*step(z+dot(slope,uv-c.xy),texture2D(actorDepth,uv).r);
    weights+=weight;
  }
  return sum/weights;
}`
const illuminate = `
  vec3 worldN=inverseTransformDirection(geometryNormal,viewMatrix);
  float up=max(0.,.5+.5*worldN.y);
  float daylight=actorAtlas(actorPlace,worldN);
  IncidentLight localKey;
  localKey.visible=true;
  localKey.direction=normalize(mat3(viewMatrix)*sunDir);
  float keyShadow=actorShadowSource<-.5&&actorShadowSource>-1.5?actorSelf(actorPlace,worldN,sunDir):1.;
  localKey.color=mix(vec3(.44,.63,1.02),vec3(3.45,2.97,2.55),day)*daylight*keyShadow;
  RE_Direct(localKey,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
  for(int j=0;j<3;j++){
    vec3 delta=actorLamps[j].xyz-actorPlace; float dd=dot(delta,delta);
    if(actorColors[j].a<=0.||dd>=actorLamps[j].w)continue;
    vec3 d=delta*inversesqrt(max(dd,.0001));
    float fade=max(0.,1.-dd/actorLamps[j].w);
    float transmission=abs(float(j)-actorShadowSource)<.1?actorSelf(actorPlace,worldN,d):1.;
    vec3 rad=actorColors[j].rgb*(fade*fade/(1.35+dd));
    localKey.direction=normalize(mat3(viewMatrix)*d);
    localKey.color=rad*mix(.12,1.,transmission);
    RE_Direct(localKey,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
    // Scattered light remains visible where an eyelid, nose or finger turns
    // across a paper lantern. Preserve cooler shadows on cloth and lacquer.
    float wrap=max(0.,(dot(worldN,d)+.34)/1.34)-max(0.,dot(worldN,d));
    reflectedLight.directDiffuse+=material.diffuseColor*rad*wrap*actorSkin*vec3(.34,.16,.10);
  }
  vec3 sky=mix(mix(vec3(.048,.053,.081),vec3(.27,.365,.51),up),
               mix(vec3(.28,.26,.25),vec3(.74,.86,1.0),up),day);
  irradiance+=PI*(sky+actorBounce*(.66+.34*up));
  vec3 eyeRay=inverseTransformDirection(reflect(-geometryViewDir,geometryNormal),viewMatrix);
  float horizon=exp(-abs(eyeRay.y+.06)*3.9);
  radiance+=mix(vec3(.052,.082,.133),vec3(.45,.56,.67),day)*(.35+.65*up)
           +actorBounce*(.3+.85*horizon);
`

function staticLights(fixtures) {
  const cells = new Map()
  for (const fixture of fixtures) {
    const [x, y, z] = fixture.p, r = fixture.range
    const item = { position: new T.Vector3(x, y, z), tint: new T.Color(fixture.color), range: r, power: fixture.power }
    for (let i = Math.floor((x - r) / cellSize); i <= Math.floor((x + r) / cellSize); i++)
      for (let j = Math.floor((z - r) / cellSize); j <= Math.floor((z + r) / cellSize); j++) {
        const key = i + ',' + j
        if (!cells.has(key)) cells.set(key, [])
        cells.get(key).push(item)
      }
  }
  return cells
}
export function characterStreetLight(renderer, world, city) {
  const fixed = staticLights(world.lights), actors = new Set()
  const handWicks = new WeakMap(), carried = []
  function updateCarriedLights() {
    carried.length = 0
    for (const wick of world.handLights ?? []) {
      let light = handWicks.get(wick)
      if (!light) {
        light = { position: new T.Vector3(), tint: wick.color, range: wick.distance, power: 0 }
        handWicks.set(wick, light)
        // The city shades the fixture once, together with the fixed lamps.
        // The standalone character and its GLB keep their native point light.
        wick.layers.set(3)
      }
      wick.getWorldPosition(light.position)
      light.power = wick.intensity * 4.3
      carried.push(light)
    }
  }
  const shadow = characterCastShadow(renderer)
  const anchor = new T.Vector3(), viewPoint = new T.Vector3(), hue = new T.Color()
  function shade(group) {
    const slots = Array.from({ length: lightsPerFigure }, () => new T.Vector4())
    const colors = slots.map(() => new T.Vector4())
    const bounce = new T.Vector3()
    const uniforms = {
      lightMatrix: city.lightMatrix, outerLightMatrix: city.outerLightMatrix, occTex: city.occTex,
      outerDepth: city.outerDepth, sunDir: city.sunDir, day: city.day,
      actorLamps: { value: slots }, actorColors: { value: colors }, actorBounce: { value: bounce },
      actorShadowMatrix: { value: shadow.matrix }, actorDepth: { value: shadow.texture },
      actorTexel: { value: shadow.texel }, actorShadowSource: { value: -2 },
    }
    const entry = {
      group, head: group.getObjectByName('head'), slots, colors, bounce, uniforms,
      winners: [], strength: [], parts: [], emissive: [], direction: new T.Vector3(), centre: new T.Vector3(),
      keySource: null, last: -Infinity,
    }
    const materials = new Map()
    function illuminated(original) {
      if (!original.isMeshStandardMaterial) return original
      if (materials.has(original)) return materials.get(original)
      const surface = original.clone()
      surface.onBeforeCompile = (shader, gl) => {
        original.onBeforeCompile(shader, gl)
        Object.assign(shader.uniforms, uniforms, { actorSkin: { value: original.userData.skin ? 1 : 0 } })
        shader.vertexShader = 'varying vec3 actorPlace;\n' + shader.vertexShader.replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nactorPlace=(modelMatrix*vec4(transformed,1.)).xyz;',
        )
        shader.fragmentShader = declarations + '\n' + shader.fragmentShader.replace(
          '#include <lights_fragment_maps>',
          illuminate + '\n#include <lights_fragment_maps>',
        )
      }
      surface.customProgramCacheKey = () => 'lantern-cast-v1:' + original.customProgramCacheKey()
      if (original.emissive.getHex() !== 0) entry.emissive.push([original, surface])
      materials.set(original, surface)
      return surface
    }
    group.traverse((mesh) => {
      if (!mesh.isMesh) return
      const surface = Array.isArray(mesh.material) ? mesh.material.map(illuminated) : illuminated(mesh.material)
      mesh.material = surface
      const depth = Array.isArray(surface) ? surface.map(shadow.casterMaterial) : shadow.casterMaterial(surface)
      entry.parts.push({ mesh, surface, depth })
    })
    actors.add(entry)
  }
  function collect(entry, day) {
    const { winners, strength, bounce } = entry
    winners.length = strength.length = 0
    bounce.set(0, 0, 0)
    function add(item) {
      const d2 = item.position.distanceToSquared(anchor), r2 = item.range ** 2
      if (d2 >= r2 || !item.power) return
      const value = item.power * (day ? 1 : (item.strength ?? 1)) * (1 - d2 / r2) ** 2 / (1.35 + d2)
      const tint = item.tint ?? hue.setHex(item.color)
      bounce.x += value * tint.r
      bounce.y += value * tint.g
      bounce.z += value * tint.b
      let i = 0
      while (i < strength.length && strength[i] >= value) i++
      if (i === lightsPerFigure) return
      winners.splice(i, 0, item)
      strength.splice(i, 0, value)
      if (winners.length > lightsPerFigure) {
        winners.pop()
        strength.pop()
      }
    }
    for (const light of fixed.get(Math.floor(anchor.x / cellSize) + ',' + Math.floor(anchor.z / cellSize)) ?? [])
      add(light)
    for (const light of world.deckLanterns ?? []) add(light)
    for (const light of carried) add(light)
    for (const light of world.moving) if (!light.distantOnly) add(light)
    const factor = day ? 0.018 : 1
    bounce.multiplyScalar(factor * .12 / (1 + .21 * Math.max(bounce.x, bounce.y, bounce.z)))
    for (let i = 0; i < lightsPerFigure; i++) {
      const lamp = winners[i], color = entry.colors[i]
      if (!lamp) { color.set(0, 0, 0, 0); continue }
      const p = lamp.position, tint = lamp.tint ?? hue.setHex(lamp.color)
      const gain = factor * lamp.power * (day ? 1 : (lamp.strength ?? 1)) * .96
      // A luminous silk shade has a warm core and a less saturated lit face.
      const white = .19 * Math.max(tint.r, tint.g, tint.b)
      color.set((tint.r * .81 + white) * gain, (tint.g * .81 + white) * gain,
        (tint.b * .81 + white) * gain, 1)
      entry.slots[i].set(p.x, p.y, p.z, lamp.range ** 2)
    }
    entry.keySource = !day && strength[0] > .19 ? winners[0] : null
    if (entry.keySource) entry.direction.subVectors(entry.keySource.position, anchor).normalize()
    else entry.direction.copy(city.sunDir.value)
  }
  return {
    shade,
    update(t, camera) {
      updateCarriedLights()
      let closest, best = Infinity
      const halfFov = Math.tan(T.MathUtils.degToRad(camera.fov) / 2)
      camera.updateMatrixWorld()
      for (const entry of actors) {
        if (!entry.group.parent) { actors.delete(entry); continue }
        entry.uniforms.actorShadowSource.value = -2
        if (!entry.group.visible) continue
        for (const [original, surface] of entry.emissive) surface.emissiveIntensity = original.emissiveIntensity
        entry.head.getWorldPosition(anchor)
        anchor.y -= .17
        const day = city.day.value > .5
        if (day !== entry.day || t < entry.last || t - entry.last > .055 ||
            entry.centre.distanceToSquared(anchor) > .035 ** 2) {
          collect(entry, day)
          entry.last = t
          entry.day = day
          entry.centre.copy(anchor)
        }
        const distance = camera.position.distanceToSquared(anchor)
        if (distance > 8.5 ** 2) continue
        viewPoint.copy(anchor).applyMatrix4(camera.matrixWorldInverse)
        const depth = -viewPoint.z
        if (depth <= 0) continue
        const extent = Math.max(.30, depth * halfFov)
        const offAxis = Math.max(Math.abs(viewPoint.x) / (extent * camera.aspect), Math.abs(viewPoint.y) / extent)
        if (offAxis > 1.28) continue
        const priority = distance * (1 + offAxis * offAxis * 2)
        if (priority < best) {
          best = priority
          closest = entry
        }
      }
      if (closest) {
        const slot = closest.keySource ? 0 : -1
        closest.uniforms.actorShadowSource.value = slot
        shadow.render(closest, closest.direction, closest.keySource ?? city.day.value, t)
      }
      return closest?.centre
    },
  }
}
