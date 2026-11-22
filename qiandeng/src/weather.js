import * as T from 'three'
import { generator } from './mesh.js'
import { lanternField } from './cityLightField.js'

const windX = 0.128,
  windZ = -0.058
const xMin = -105,
  zMin = -158,
  cell = 0.42
const columns = 500,
  rows = 660
const innerRain = { xMin, zMin, cell, columns, rows }
const valleyRain = { xMin: -220, zMin: -805, cell: 1.19, columns: 571, rows: 860 }
const baseAt = (x, z) => (Math.abs(x) <= 17 && z >= -66 && z <= 88 ? 0.007 : -58)
const soft =
  /leaf|leaves|tree|needl|petal|blossom|bough|pineCrown|cliffQuart|ribbon|silk|flag|rope|gold|lantern|paper|bark/i
const usableRoof = /roof|glazedTile|palaceTile|canopyTile/i

// Distances are projected along the rain vector. Drops therefore meet the real
// sloping roof at its height from this wind direction, even on the upper palace.
function wetSurfaces(scene, waterMeshes, field, broad) {
  const { xMin, zMin, cell, columns, rows } = field
  const size = columns * rows,
    top = new Float32Array(size),
    roof = new Float32Array(size).fill(-58)
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < columns; i++)
      top[j * columns + i] = baseAt(xMin + (i + 0.5) * cell, zMin + (j + 0.5) * cell)
  scene.updateMatrixWorld(true)
  const bounds = new T.Box3()
  const candidates = [...waterMeshes]
  function visit(node) {
    if (node.userData.noWeather || node.userData.noCollision) return
    if (node.isMesh) candidates.push(node)
    for (const c of node.children) visit(c)
  }
  visit(scene)
  for (const mesh of candidates) {
    const material = mesh.material
    if (
      !mesh.isMesh ||
      mesh.isInstancedMesh ||
      !(material?.isMeshStandardMaterial || material?.uniforms?.pigment || mesh.userData.waterSurface) ||
      soft.test(material.name) ||
      material.userData?.noCollision
    )
      continue
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    bounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld)
    const lx = bounds.min.x - windX * bounds.max.y,
      hx = bounds.max.x - windX * bounds.min.y
    const lz = bounds.min.z - windZ * bounds.min.y,
      hz = bounds.max.z - windZ * bounds.max.y
    if (hx < xMin || lx > xMin + cell * columns || hz < zMin || lz > zMin + cell * rows) continue
    if (
      broad &&
      lx > innerRain.xMin + 1 &&
      hx < innerRain.xMin + innerRain.cell * innerRain.columns - 1 &&
      lz > innerRain.zMin + 1 &&
      hz < innerRain.zMin + innerRain.cell * innerRain.rows - 1
    )
      continue
    const pos = mesh.geometry.attributes.position,
      index = mesh.geometry.index?.array
    if (!pos) continue
    const isRoof = usableRoof.test(material.name),
      matrix = mesh.matrixWorld.elements
    const x = new Float32Array(pos.count),
      y = new Float32Array(pos.count),
      z = new Float32Array(pos.count)
    for (let k = 0; k < pos.count; k++) {
      const a = pos.getX(k),
        b = pos.getY(k),
        c = pos.getZ(k)
      const h = matrix[1] * a + matrix[5] * b + matrix[9] * c + matrix[13]
      y[k] = h
      x[k] = (matrix[0] * a + matrix[4] * b + matrix[8] * c + matrix[12] - windX * h - xMin) / cell - 0.5
      z[k] = (matrix[2] * a + matrix[6] * b + matrix[10] * c + matrix[14] - windZ * h - zMin) / cell - 0.5
    }
    const count = index?.length ?? pos.count
    for (let n = 0; n < count; n += 3) {
      const a = index ? index[n] : n,
        b = index ? index[n + 1] : n + 1,
        c = index ? index[n + 2] : n + 2
      const i0 = Math.max(0, Math.ceil(Math.min(x[a], x[b], x[c]))),
        i1 = Math.min(columns - 1, Math.floor(Math.max(x[a], x[b], x[c])))
      const j0 = Math.max(0, Math.ceil(Math.min(z[a], z[b], z[c]))),
        j1 = Math.min(rows - 1, Math.floor(Math.max(z[a], z[b], z[c])))
      if (i1 < i0 || j1 < j0) continue
      const ax = x[b] - x[a],
        az = z[b] - z[a],
        bx = x[c] - x[a],
        bz = z[c] - z[a],
        det = ax * bz - bx * az
      if (Math.abs(det) < 0.00001) continue
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const xx = i - x[a],
            zz = j - z[a],
            u = (xx * bz - zz * bx) / det,
            v = (ax * zz - az * xx) / det
          if (u < -0.0001 || v < -0.0001 || u + v > 1.0001) continue
          const h = y[a] + u * (y[b] - y[a]) + v * (y[c] - y[a]),
            at = i + j * columns
          if (h > top[at]) top[at] = h
          if (isRoof && h > roof[at]) roof[at] = h
        }
    }
  }
  const tex = new T.DataTexture(top, columns, rows, T.RedFormat, T.FloatType)
  tex.minFilter = tex.magFilter = T.NearestFilter
  tex.needsUpdate = true
  return { top, roof, tex }
}
// A continuous light field includes every burner on a hanging column and all
// levels of a tower. Sampling in three dimensions keeps a sheltered ceiling
// lamp from colouring drops above a different roof at the same map position.
const heatWidth = 192,
  heatHeight = 88,
  heatDepth = 248
const heatFloor = -3,
  heatCeiling = 87
function lampMap(lights) {
  const sx = (columns * cell) / heatWidth,
    sy = (heatCeiling - heatFloor) / heatHeight
  const sz = (rows * cell) / heatDepth,
    data = new Uint8Array(heatWidth * heatHeight * heatDepth)
  for (const light of lights) {
    if (!light.p || !(light.range > 0)) continue
    const [x, y, z] = light.p,
      radius = 0.39 * Math.max(2, light.range),
      reach = 2.35 * radius
    const lx = (x - xMin) / sx - 0.5,
      ly = (y - heatFloor) / sy - 0.5,
      lz = (z - zMin) / sz - 0.5
    const x0 = Math.max(0, Math.ceil(lx - reach / sx)),
      x1 = Math.min(heatWidth - 1, Math.floor(lx + reach / sx))
    const y0 = Math.max(0, Math.ceil(ly - reach / sy)),
      y1 = Math.min(heatHeight - 1, Math.floor(ly + reach / sy))
    const z0 = Math.max(0, Math.ceil(lz - reach / sz)),
      z1 = Math.min(heatDepth - 1, Math.floor(lz + reach / sz))
    const wick = Math.min(0.43, 0.055 * light.range) ** 2
    for (let k = z0; k <= z1; k++) {
      const zz = ((k - lz) * sz) ** 2
      for (let j = y0; j <= y1; j++) {
        const yz = zz + ((j - ly) * sy) ** 2,
          row = heatWidth * (j + heatHeight * k)
        for (let i = x0; i <= x1; i++) {
          const distance2 = yz + ((i - lx) * sx) ** 2
          if (distance2 > reach * reach) continue
          const gain = Math.round(255 * Math.exp(-Math.max(0, distance2 - wick) / (radius * radius)))
          if (gain > data[row + i]) data[row + i] = gain
        }
      }
    }
  }
  const tex = new T.Data3DTexture(data, heatWidth, heatHeight, heatDepth)
  tex.format = T.RedFormat
  tex.type = T.UnsignedByteType
  tex.minFilter = tex.magFilter = T.LinearFilter
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  return tex
}
const rainVertex = `
attribute vec4 seed, path;
uniform float time, daylight;
uniform sampler2D heights,outerHeights;
${lanternField}
uniform highp sampler3D warmField;
uniform vec4 grid,outerGrid;
float roofLevel(vec2 p){
 vec2 q=(p-grid.xy)*grid.zw;
 if(min(q.x,q.y)>=0. && max(q.x,q.y)<1.)return texture2D(heights,q).r;
 q=(p-outerGrid.xy)*outerGrid.zw;
 if(min(q.x,q.y)>=0. && max(q.x,q.y)<1.)return texture2D(outerHeights,q).r;
 return -90.;
}
uniform vec4 waterLights[4];
varying vec2 shape;
varying float warm,strength,kind;
void main(){
  const vec3 wind=vec3(.128,1.,-.058);
  vec3 point;
  float trail;
  kind=path.w;
  if(kind<.5) {
    // Wrap world-space shafts around the eye only after they are out of view.
    // A stationary eye sees unbroken trajectories and passing stronger showers.
    vec2 reference=cameraPosition.xz-wind.xz*cameraPosition.y;
    vec2 lane=seed.xz+57.*floor((reference-seed.xz)/57.+.5);
    float base=seed.y-time*path.x;
    float y=base+32.*floor((cameraPosition.y+2.-base)/32.+.5);
    float bed=roofLevel(lane)+.012;
    if(y+path.z<bed||daylight>.5){gl_Position=vec4(3.,3.,3.,1.);return;}
    point=vec3(lane.x+wind.x*y,max(y,bed),lane.y+wind.z*y);
    trail=min(path.z,max(.001,y+path.z-bed));
    float cell=.57+.23*sin(point.x*.075+point.z*.052-time*.30)+.16*sin(point.z*.13+time*.18);
    strength=seed.w*(.54+.75*cell)*(1.-smoothstep(20.,28.,length(lane-reference)));
    strength*=(1.-smoothstep(778.,845.,abs(point.z+8.)))*(1.-smoothstep(407.,478.,abs(point.x)));
    strength*=1.-smoothstep(315.,359.,point.y);
  } else {
    float span=seed.w-seed.y,phase=fract(path.y+time*path.x);
    if(daylight>.5&&fract(path.y*191.7)>.11){gl_Position=vec4(3.,3.,3.,1.);return;}
    float y=seed.w-span*phase*phase;
    point=vec3(seed.x+wind.x*y,y,seed.z+wind.z*y);
    trail=min(seed.w-y+.002,2.*span*path.x*phase*path.z);
    strength=(.83+.30*fract(path.y*71.))*mix(1.,.36,daylight);
  }
  vec3 eye=cameraPosition-point;float dist=length(eye);
  vec3 right=cross(eye,wind);right*=inversesqrt(max(.0000001,dot(right,right)));
  float radius=mix(.0035,.0064,kind),drawRadius=max(radius,dist*.00109);
  vec2 heatUV=(point.xz-grid.xy)*grid.zw;
  warm=texture(warmField,vec3(heatUV.x,(point.y-(${heatFloor.toFixed(1)}))/${(heatCeiling - heatFloor).toFixed(1)},heatUV.y)).r;
  if(min(heatUV.x,heatUV.y)<0. || max(heatUV.x,heatUV.y)>1. || point.y>88.){
    float g=lampEnergy(point).r;warm=smoothstep(.08,1.45,g);
  }
  for(int k=0;k<4;k++){
    vec3 delta=point-waterLights[k].xyz;
    float f=max(0.,1.-dot(delta,delta)*waterLights[k].w);
    warm=max(warm,f*f);
  }
  strength*=sqrt(min(1.,radius/drawRadius))*smoothstep(.35,.96,dist)*(1.-smoothstep(26.,54.,dist));
  shape=position.xy;
  vec3 world=point+wind*trail*position.y+right*drawRadius*position.x;
  gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
}`
const rainFragment = `
varying vec2 shape;varying float warm,strength,kind;
void main(){
  float head=shape.y-.19;
  float width=mix(1.,.32+.68*exp(-12.*head*head),kind);
  float edge=1.-smoothstep(.29*width,width,abs(shape.x));
  float taper=smoothstep(0.,.09,shape.y)*(1.-.68*shape.y);
  vec3 silk=mix(vec3(.19,.29,.50),vec3(1.,.55,.20),warm);
  gl_FragColor=vec4(silk,(.26+.73*warm)*strength*edge*taper);
  #include <colorspace_fragment>
}`
function rainMesh(group, material, seeds, paths, bounds) {
  const g = new T.InstancedBufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3))
  g.setIndex([0, 1, 2, 2, 1, 3])
  g.instanceCount = seeds.length / 4
  g.setAttribute('seed', new T.InstancedBufferAttribute(Float32Array.from(seeds), 4))
  g.setAttribute('path', new T.InstancedBufferAttribute(Float32Array.from(paths), 4))
  const obj = new T.Mesh(g, material)
  if (bounds) g.boundingSphere = bounds.getBoundingSphere(new T.Sphere())
  else obj.frustumCulled = false
  obj.layers.set(1)
  obj.renderOrder = 14
  group.add(obj)
  return obj
}
// The additive rain pass has just one near-field shower. Compact the actual
// visible shafts before submission so the other five directions cost no GPU
// vertex work, both inside sheltered rooms and in long, low river views.
function shelteredByVessel(wx, wy, wz, ships) {
  if (!ships || wy > 6 || wy < -17) return false
  for (const ship of ships) {
    const p = ship.group.position,
      r = ship.spec.length * 0.55 + 0.2
    if (wy > p.y + (ship.top || 5.8) || wy < p.y - 0.85 || Math.abs(wx - p.x) > r || Math.abs(wz - p.z) > r)
      continue
    const m = ship.inverse.elements
    const x = m[0] * wx + m[4] * wy + m[8] * wz + m[12],
      z = m[2] * wx + m[6] * wy + m[10] * wz + m[14]
    if (Math.abs(x) > ship.spec.beam * 0.65 || Math.abs(z) > r) continue
    const y = m[1] * wx + m[5] * wy + m[9] * wz + m[13]
    // The same hull strakes, pavilion roofs and transverse awning ribs that
    // stop the visitor also cast their changing rain shadow over the decks.
    for (const box of ship.boxes)
      if (x > box[0] && x < box[3] && z > box[2] && z < box[5] && y < box[4] + 0.012) return true
  }
  return false
}

function visibleRain(mesh, uniforms, ground, outerGround, ambient, world) {
  const g = mesh.geometry,
    tracks = g.attributes.seed,
    paths = g.attributes.path
  const source = tracks.array.slice(),
    motion = paths.array.slice(),
    count = source.length / 4
  tracks.setUsage(T.DynamicDrawUsage)
  paths.setUsage(T.DynamicDrawUsage)
  return (camera) => {
    const t = uniforms.time.value,
      eye = camera.position
    if (
      ambient &&
      (uniforms.daylight.value > 0.5 || eye.y > 378 || Math.abs(eye.x) > 512 || Math.abs(eye.z + 8) > 880)
    ) {
      g.instanceCount = 0
      return
    }
    if (!ambient && g.boundingSphere.center.distanceTo(eye) - g.boundingSphere.radius > 54) {
      g.instanceCount = 0
      return
    }
    const m = camera.matrixWorld.elements,
      p = camera.projectionMatrix.elements
    const rx = eye.x - windX * eye.y,
      rz = eye.z - windZ * eye.y
    let number = 0
    for (let i = 0; i < count; i++) {
      const at = i * 4
      let x = source[at],
        y = source[at + 1],
        z = source[at + 2]
      if (ambient) {
        x += 57 * Math.floor((rx - x) / 57 + 0.5)
        z += 57 * Math.floor((rz - z) / 57 + 0.5)
        if ((x - rx) ** 2 + (z - rz) ** 2 > 28 ** 2) continue
        const base = y - t * motion[at]
        y = base + 32 * Math.floor((eye.y + 2 - base) / 32 + 0.5)
        const a = Math.floor((x - xMin) / cell),
          b = Math.floor((z - zMin) / cell)
        if (a >= 0 && a < columns && b >= 0 && b < rows) {
          if (y + motion[at + 2] < ground[a + b * columns] + 0.012) continue
        } else {
          const c = Math.floor((x - valleyRain.xMin) / valleyRain.cell),
            d = Math.floor((z - valleyRain.zMin) / valleyRain.cell)
          if (
            c >= 0 &&
            c < valleyRain.columns &&
            d >= 0 &&
            d < valleyRain.rows &&
            y + motion[at + 2] < outerGround[c + d * valleyRain.columns] + 0.012
          )
            continue
        }
      } else {
        if (uniforms.daylight.value > 0.5 && (motion[at + 1] * 191.7) % 1 > 0.11) continue
        const phase = (motion[at + 1] + t * motion[at]) % 1
        y = source[at + 3] - (source[at + 3] - y) * phase * phase
      }
      const dx = x + windX * y - eye.x,
        dy = y - eye.y,
        dz = z + windZ * y - eye.z
      if (dx * dx + dy * dy + dz * dz > 54 ** 2) continue
      const depth = -(dx * m[8] + dy * m[9] + dz * m[10])
      if (depth < -0.34) continue
      const vx = dx * m[0] + dy * m[1] + dz * m[2],
        vy = dx * m[4] + dy * m[5] + dz * m[6]
      if (Math.abs(vx) * p[0] > depth + 0.46 || Math.abs(vy) * p[5] > depth + 0.46) continue
      if (shelteredByVessel(x + windX * y, y, z + windZ * y, world.rainShips)) continue
      const dst = number++ * 4
      for (let k = 0; k < 4; k++) {
        tracks.array[dst + k] = source[at + k]
        paths.array[dst + k] = motion[at + k]
      }
    }
    g.instanceCount = number
    if (number > 0) {
      for (const attribute of [tracks, paths]) {
        attribute.clearUpdateRanges()
        attribute.addUpdateRange(0, number * 4)
        attribute.needsUpdate = true
      }
    }
  }
}

export function weather(scene, world, statics, waters, common) {
  const surfaces = wetSurfaces(statics, waters, innerRain, false),
    valley = wetSurfaces(statics, waters, valleyRain, true),
    rng = generator(617339)
  const moving = Array.from({ length: 4 }, () => new T.Vector4(1e5, 0, 1e5, 1))
  const uniforms = {
    ...common,
    waterLights: { value: moving },
    time: { value: 0 },
    daylight: { value: 0 },
    heights: { value: surfaces.tex },
    outerHeights: { value: valley.tex },
    outerGrid: {
      value: new T.Vector4(
        valleyRain.xMin,
        valleyRain.zMin,
        1 / (valleyRain.cell * valleyRain.columns),
        1 / (valleyRain.cell * valleyRain.rows)
      ),
    },
    warmField: { value: lampMap(world.lights || []) },
    grid: { value: new T.Vector4(xMin, zMin, 1 / (columns * cell), 1 / (rows * cell)) },
  }
  const material = new T.ShaderMaterial({
    uniforms,
    vertexShader: rainVertex,
    fragmentShader: rainFragment,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    side: T.DoubleSide,
    forceSinglePass: true,
  })
  const group = new T.Group()
  group.name = '千灯雨幕'
  group.userData.animated = true
  scene.add(group)
  const seeds = [],
    paths = []
  for (let i = 0; i < 13900; i++) {
    seeds.push((rng() - 0.5) * 57, rng() * 32, (rng() - 0.5) * 57, 0.58 + 0.54 * rng())
    paths.push(6.5 + 3.2 * rng(), rng(), 0.098 + 0.13 * rng(), 0)
  }
  const whole = rainMesh(group, material, seeds, paths)
  whole.name = '河城风雨'
  const cullers = [visibleRain(whole, uniforms, surfaces.top, valley.top, true, world)]
  const chunks = new Map(),
    { top, roof } = surfaces
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  // Exposed roof cells feed outlets. An upper tier can drain onto a lower roof;
  // their relative heights come directly from the architectural meshes.
  for (let j = 1; j < rows - 1; j++)
    for (let i = 1; i < columns - 1; i++) {
      const at = j * columns + i,
        y = roof[at]
      if (y < 1.75 || y < top[at] - 0.29) continue
      for (const [dx, dz] of directions) {
        const other = at + dx + dz * columns,
          target = top[other]
        if (roof[other] > y - 0.79 || target > y - 0.71 || rng() > 0.68) continue
        const x = xMin + (i + 0.5 + dx * 0.59 + (dz === 0 ? 0 : (rng() - 0.5) * 0.7)) * cell
        const z = zMin + (j + 0.5 + dz * 0.59 + (dx === 0 ? 0 : (rng() - 0.5) * 0.7)) * cell
        const key = Math.floor(x / 26) + Math.floor(z / 26) * 128
        let chunk = chunks.get(key)
        if (!chunk) {
          chunk = { seeds: [], paths: [], box: new T.Box3() }
          chunks.set(key, chunk)
        }
        const count = rng() < 0.22 ? 2 : 1,
          h = Math.max(-37, target + 0.015),
          span = y - h
        for (let k = 0; k < count; k++) {
          chunk.seeds.push(x, h, z, y - 0.035)
          chunk.paths.push(1 / Math.sqrt((2 * span) / (8.95 + 1.1 * rng())), rng(), 0.016 + 0.009 * rng(), 1)
        }
        chunk.box.expandByPoint(new T.Vector3(x + windX * y, y, z + windZ * y))
        chunk.box.expandByPoint(new T.Vector3(x + windX * h, h, z + windZ * h))
      }
    }
  for (const v of chunks.values()) {
    v.box.expandByScalar(0.3)
    const drip = rainMesh(group, material, v.seeds, v.paths, v.box)
    drip.name = '瓦当滴水'
    cullers.push(visibleRain(drip, uniforms, surfaces.top, valley.top, false, world))
  }
  const beforeScene = scene.onBeforeRender
  scene.onBeforeRender = function (renderer, root, camera, ...rest) {
    beforeScene.call(this, renderer, root, camera, ...rest)
    if (camera.layers.isEnabled(1)) for (const cull of cullers) cull(camera)
  }
  return {
    mode(day) {
      uniforms.daylight.value = Number(day)
      whole.visible = !day
    },
    update(t) {
      uniforms.time.value = t
      for (let i = 0; i < Math.min(4, world.moving?.length || 0); i++) {
        const l = world.moving[i],
          p = l.position
        moving[i].set(p.x, p.y, p.z, 1 / Math.max(1, l.range * 0.63) ** 2)
      }
    },
  }
}
