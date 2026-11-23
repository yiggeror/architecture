import * as T from 'three'
import { layeredView, sceneSamples, sceneColor } from './layers.js'
import { mirrorParallax } from './mirrorParallax.js'
import { reflectionWindow } from './reflectionWindow.js'

const vertex = `
uniform mat4 textureMatrix;
#ifdef ESTUARY
attribute float shore; varying float edge;
#endif
varying vec4 reflection;varying vec3 wp;
void main(){
#ifdef ESTUARY
edge=shore;
#endif
wp=(modelMatrix*vec4(position,1.)).xyz;reflection=textureMatrix*vec4(position,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
const fragment = `
${mirrorParallax}
#ifdef ESTUARY
varying float edge;
#endif
uniform sampler2D tDiffuse;uniform float time,day,calm;
uniform vec4 movePlace[10],moveHue[10];
varying vec4 reflection;varying vec3 wp;
float hash(vec2 p){return fract(sin(dot(p,vec2(89.53,152.47)))*23721.39);}
vec2 drops(vec2 point){
 vec2 cell=floor(point),p=fract(point)-.5;
 float seed=hash(cell);vec2 delta=p-.53*(vec2(seed,hash(cell+41.))-.5);
 float life=fract(time*(.77+.32*seed)+hash(cell+17.));float d=length(delta);
 float ring=exp(-abs(d-life*.43)*38.)*cos((d-life*.43)*89.)*(1.-life);
 return delta/(d+.012)*ring;
}
void main(){
 vec2 p=wp.xz;vec3 toEye=cameraPosition-wp;float distance=length(toEye);vec3 v=toEye/distance;
 float t=time*.76;
 float a=sin(2.43*p.y+1.16*t+1.76*sin(.63*p.x+.24*p.y)+.66*sin(.43*p.y-.73*p.x))+.48*sin(4.91*p.y-1.31*t+.31*p.x);
 float b=cos(1.74*p.x+.62*p.y+t+.83*sin(.56*p.y))+.43*cos(3.26*p.x-1.24*p.y-.71*t);
 float c=sin(11.15*p.y+.79*p.x+1.86*t)*sin(2.17*p.x-.51*t);
 vec2 imp=drops(p*2.1)*max(0.,1.-distance/49.)*(1.-day*.92);
 vec3 n=normalize(vec3((.046*b+.026*imp.x)*mix(1.,.54,calm),1.,(.060*a+.027*c+.036*imp.y)*mix(1.,.54,calm)));
 vec2 q=reflection.xy/reflection.w;
 float viewAngle=max(.03,v.y);
 vec2 distortion=vec2(n.x+.12*n.z,.52*n.z)*mix(.052,.016,smoothstep(2.,100.,distance));
 vec2 k=mirrorUV(clamp(q+distortion,.002,.998),wp);
 vec3 mirror=texture2D(tDiffuse,k).rgb*.54+
    texture2D(tDiffuse,clamp(k+vec2(.0015,.001),.001,.999)).rgb*.23+
    texture2D(tDiffuse,clamp(k-vec2(.0015,.001),.001,.999)).rgb*.23;
 float fres=.32+.65*pow(1.-max(dot(n,v),0.),2.4);
 vec3 water=mix(vec3(.007,.024,.041),vec3(.063,.27,.235),day)*mix(1.,.77,calm);
 water*=.92+.11*a+.07*b;
 vec3 col=mix(water,mirror,clamp(fres+.081,0.,.97));
 vec3 moon=normalize(mix(vec3(-.87,.74,-.10),vec3(-.65,.57,.49),day));
 float shimmer=pow(max(0.,dot(n,normalize(moon+v))),mix(142.,107.,day));
 col+=mix(vec3(.25,.39,.66),vec3(2.75,2.29,1.55),day)*shimmer*(.32+.36*pow(sin(p.x*1.77+cos(p.y*.91))*.5+.5,2.));
 for(int i=0;i<10;i++){
   vec3 off=movePlace[i].xyz-wp;float d2=dot(off,off);
   float fall=max(0.,1.-d2*movePlace[i].w*.36);
   if(fall==0.)continue;
   float glint=pow(max(0.,dot(n,normalize(v+normalize(off)))),28.);
   col+=moveHue[i].rgb*fall*fall*(.045+2.8*glint)/(2.+d2)*(1.-.96*day);
 }
 col+=vec3(.055,.080,.09)*length(imp)*max(fres,.5);
 float opacity=1.;
 #ifdef ESTUARY
 opacity=smoothstep(.02,.98,edge);
 if(opacity<.009)discard;
 col=mix(col,day>.5?vec3(.38,.53,.53):vec3(.005,.012,.024),smoothstep(75.,740.,distance)*.68);
 #endif
 gl_FragColor=vec4(col,opacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`
// The garden and downstream ribbons have explicit receiving patches. Wet
// masonry also samples the main mirror. Find its world footprint from the
// original geometry before the render-only district meshes are assembled.
function wetPaving(statics, water) {
  const tiles = new Map(), cell = 22
  const box = new T.Box3(), p = new T.Vector3()
  const xs = new Float64Array(3), ys = new Float64Array(3), zs = new Float64Array(3)
  const lower = -.13, upper = 3.23
  // Floating fittings and performers move along the canal with the boats.
  const bounds = new T.Box3().setFromObject(water).expandByScalar(5)
  const patches = [bounds]
  statics.traverse(o => {
    const g = o.geometry, m = o.material
    if (!o.isMesh || o.isInstancedMesh || !m?.isMeshStandardMaterial || m.userData.collisionOnly ||
        m.roughness >= .84 || !g.attributes.position || !g.index) return
    if (!g.boundingBox) g.computeBoundingBox()
    box.copy(g.boundingBox).applyMatrix4(o.matrixWorld)
    if (box.min.y > upper || box.max.y < lower) return
    const ix = g.index.array, positions = g.attributes.position
    for (let i = 0; i < ix.length; i += 3) {
      for (let j = 0; j < 3; j++) {
        p.fromBufferAttribute(positions, ix[i + j]).applyMatrix4(o.matrixWorld)
        xs[j] = p.x; ys[j] = p.y; zs[j] = p.z
      }
      if (Math.min(ys[0], ys[1], ys[2]) > upper || Math.max(ys[0], ys[1], ys[2]) < lower) continue
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
      for (let j = 0; j < 3; j++) {
        const k = (j + 1) % 3, y = ys[j], dy = ys[k] - y
        let a = 0, b = 1
        if (dy) {
          const f = (lower - y) / dy, t = (upper - y) / dy
          a = Math.max(0, Math.min(f, t)); b = Math.min(1, Math.max(f, t))
          if (a > b) continue
        } else if (y < lower || y > upper) continue
        const dx = xs[k] - xs[j], dz = zs[k] - zs[j]
        const ax = xs[j] + dx * a, az = zs[j] + dz * a
        const bx = xs[j] + dx * b, bz = zs[j] + dz * b
        x0 = Math.min(x0, ax, bx); x1 = Math.max(x1, ax, bx)
        z0 = Math.min(z0, az, bz); z1 = Math.max(z1, az, bz)
      }
      for (let col = Math.floor(x0 / cell); col <= Math.floor(x1 / cell); col++) {
        for (let row = Math.floor(z0 / cell); row <= Math.floor(z1 / cell); row++) {
          const key = col * 65536 + row
          if (!tiles.has(key)) tiles.set(key, new T.Box3())
          const tile = tiles.get(key)
          tile.expandByPoint(p.set(Math.max(col * cell, x0), lower, Math.max(row * cell, z0)))
          tile.expandByPoint(p.set(Math.min((col + 1) * cell, x1), upper, Math.min((row + 1) * cell, z1)))
        }
      }
    }
  })
  return patches.concat([...tiles.values()])
}

export function river(scene, statics, renderer, common, software, config = {}) {
  const small = Boolean(config.small),
    wide = Boolean(config.wide),
    primary = !small && !wide,
    point = config.point || [0, 0, 11],
    level = point[1]
  const width = wide ? (software ? 340 : 660) : small ? (software ? 252 : 420) : software ? 400 : 784,
    height = wide ? (software ? 214 : 438) : small ? (software ? 183 : 300) : software ? 265 : 510
  const target = new T.WebGLRenderTarget(width, height, {
    ...sceneColor(renderer),
    minFilter: T.LinearFilter,
    magFilter: T.LinearFilter,
    generateMipmaps: false,
    samples: software ? 0 : sceneSamples(renderer),
    depthTexture: primary ? new T.DepthTexture(width,height,T.UnsignedIntType) : null,
    resolveDepthBuffer: primary,
  })
  target.texture.userData.planar = true
  const window = reflectionWindow(target, level, primary)
  const matrix = new T.Matrix4(),
    camera = new T.PerspectiveCamera(),
    plate = layeredView(renderer, scene, statics, software)
  const material = new T.ShaderMaterial({
    name: '潮汐',
    defines: wide ? { ESTUARY: 1 } : {},
    transparent: wide,
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      tDiffuse: { value: target.texture },
      textureMatrix: { value: matrix },
      calm: { value: Number(small) },
      mirrorDepth: primary ? common.mirrorDepth : common.blankDepth,
      mirrorClip: common.mirrorClip,reflectedEye: common.reflectedEye,
      moveMirror: primary ? common.moveMirror : {value:0},
      time: common.clockTime,
      day: common.day,
      movePlace: common.movePlace,
      moveHue: common.moveHue,
    },
  })
  const water = new T.Mesh(config.geometry || new T.PlaneGeometry(34, 154), material)
  water.name = wide ? '群城下游' : small ? '雨庭水池' : '天河水面'
  water.rotation.x = -Math.PI / 2
  water.position.set(...point)
  water.updateMatrixWorld()
  water.userData.waterSurface = true
  scene.add(water)
  if (primary) common.waterMatrix.value = matrix
  const frustum = new T.Frustum(),
    projection = new T.Matrix4()
  const boxes = config.patches || [new T.Box3().setFromObject(water)]
  const receivers = primary ? wetPaving(statics, water) : boxes
  const lastEye = new T.Vector3(1e8, 0, 0),
    lastQ = new T.Quaternion(),
    lastProjection = new T.Matrix4(),
    look = new T.Vector3(),
    up = new T.Vector3()
  const floor = new T.Plane(new T.Vector3(0, 1, 0), -level),
    plane = new T.Plane(),
    clip = new T.Vector4(),
    opposite = new T.Vector4()
  const dummy = common.mirrorMap.value
  let stamp = -1e9,
    force = true, wasStill = false, correcting = false
  function reflect(cam, now) {
    if (
      cam.position.y <= level + 0.015 ||
      (small && cam.position.distanceToSquared(water.position) > 46 * 46)
    )
      return
    frustum.setFromProjectionMatrix(projection.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse))
    if (!boxes.some((box) => frustum.intersectsBox(box))) return
    // A high inner quay hides the lower estuary on both sides of the old canal.
    if (wide) {
      water.visible = !(
        Math.abs(cam.position.x) < 57 &&
        cam.position.z > -78 &&
        cam.position.z < 78 &&
        cam.position.y < 24
      )
      if (!water.visible) return
    }
    // Anchor the map until eye translation or rotation can move a reflected
    // point by half a target texel, including at the diagonal of the lens.
    // At an elevated viewpoint this avoids repainting the whole distant city
    // for centimetres of drift. The moving pass retains its own refresh clock.
    const lens = cam.projectionMatrix.elements
    const focal = Math.max(width * Math.abs(lens[0]), height * Math.abs(lens[5])) * .5
    const edge = 1 + 1 / (lens[0] * lens[0]) + 1 / (lens[5] * lens[5])
    const distance = Math.max(.015, Math.abs(cam.position.y - level))
    const imageTravel = (2 * lastEye.distanceTo(cam.position) / distance + lastQ.angleTo(cam.quaternion)) * focal * edge
    const changedLens = !lastProjection.equals(cam.projectionMatrix)
    const moved = force || changedLens || imageTravel > 0.5
    // At the onset of a small movement the previous projector still covers
    // the water. Relight that static view, draw the current boat poses into it,
    // and use its actual depth to correct parallax for this one frame.
    const shortStep =
      primary &&
      (software || scene.userData.slowFrame) &&
      wasStill &&
      !correcting &&
      moved &&
      !force &&
      !changedLens &&
      Math.abs(now - stamp) < 390 &&
      lastEye.distanceTo(cam.position) < Math.min(0.24, 0.065 * distance) &&
      lastQ.angleTo(cam.quaternion) < 0.011
    if (primary) common.moveMirror.value = Number(shortStep)
    if (!moved && !correcting && Math.abs(now - stamp) < (wide ? 700 : software ? 135 : 55)) return
    if ((moved && !shortStep) || correcting) {
      camera.position.copy(cam.position)
      camera.position.y = 2 * level - cam.position.y
      cam.getWorldDirection(look)
      look.y *= -1
      up.set(0, 1, 0).applyQuaternion(cam.quaternion)
      up.y *= -1
      camera.up.copy(up)
      camera.lookAt(look.add(camera.position))
      camera.far = cam.far
      camera.updateMatrixWorld()
      camera.projectionMatrix.copy(cam.projectionMatrix)
      if (!window.measure(camera, receivers, frustum, cam.userData.hiddenReceiver)) {
        force = true
        return
      }
      lastEye.copy(cam.position)
      lastQ.copy(cam.quaternion)
      lastProjection.copy(cam.projectionMatrix)
      matrix
        .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
        .multiply(camera.projectionMatrix)
        .multiply(camera.matrixWorldInverse)
        .multiply(water.matrixWorld)
      plane.copy(floor).applyMatrix4(camera.matrixWorldInverse)
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant)
      const e = camera.projectionMatrix.elements
      opposite.set((Math.sign(clip.x) + e[8]) / e[0], (Math.sign(clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14])
      clip.multiplyScalar(2 / clip.dot(opposite))
      e[2] = clip.x
      e[6] = clip.y
      e[10] = clip.z + 1 - 0.00025
      e[14] = clip.w
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
      window.clip(camera)
      if (primary) common.mirrorClip.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    }
    if (shortStep)
      common.reflectedEye.value
        .set(cam.position.x, 2 * level - cam.position.y, cam.position.z, 1)
        .applyMatrix4(common.mirrorClip.value)
    correcting = shortStep
    wasStill = !moved || force
    stamp = now
    const previous = renderer.getRenderTarget()
    const original = common.mirrorMap.value,
      wasValid = common.waterValid.value, originalDepth = common.mirrorDepth.value, correction = common.moveMirror.value
    const wet = scene.children.filter((o) => o.userData.waterSurface && o.visible)
    for (const o of wet) o.visible = false
    common.waterValid.value = 0
    common.mirrorMap.value = dummy
    common.mirrorDepth.value = dummy
    common.moveMirror.value = 0
    plate.render(target, camera, now, software ? 6200 : 750)
    for (const o of wet) o.visible = true
    common.mirrorDepth.value = primary ? target.depthTexture : originalDepth
    common.moveMirror.value = correction
    common.mirrorMap.value = primary ? target.texture : original
    common.waterValid.value = primary ? 1 : wasValid
    renderer.setRenderTarget(previous)
    force = false
  }
  return {
    mesh: water,
    reflect,
    invalidate() {
      force = true
      wasStill = correcting = false
      if(primary)common.moveMirror.value=0
      plate.invalidate()
    },
  }
}
