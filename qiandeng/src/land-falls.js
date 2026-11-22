import * as T from 'three'
import { mix } from './land-kit.js'

function grid(sample, n, m) {
  const positions = [],
    uv = [],
    ix = []
  for (let j = 0; j <= m; j++)
    for (let i = 0; i <= n; i++) {
      const u = i / n,
        v = j / m
      positions.push(...sample(u, v))
      uv.push(u, v)
      if (i && j) {
        const k = j * (n + 1) + i
        ix.push(k - n - 2, k - 1, k, k - n - 2, k, k - n - 1)
      }
    }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
  g.setIndex(ix)
  return g
}
const vertex = `varying vec2 st;varying vec3 world;
void main(){st=uv;world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`
const noise = `
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}`
function material(uniforms, fragment) {
  const m = new T.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: `uniform float time,day;varying vec2 st;varying vec3 world;${noise}
      void main(){${fragment}
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: T.DoubleSide,
    transparent: true,
    depthWrite: false,
  })
  m.userData.cast = false
  m.userData.noCollision = true
  return m
}
export function createFalls(scene, sideSources) {
  const uniforms = { time: { value: 0 }, day: { value: 0 } }
  const curtain = material(
    uniforms,
    `
    float u=st.x,v=st.y,t=mod(time,300.);
    float id=world.x*.071+world.z*.039;
    float lean=.020*sin(v*6.4+t*.32+id)+.015*sin(v*15.-t*.45);
    float ribs=noise(vec2((u+lean)*27.+id,v*2.74-t*1.45));
    float frost=noise(vec2((u+.5*lean)*49.,v*3.8-t*2.4+id));
    float bed=noise(vec2(u*6.2+id,v*2.3-t*.83));
    float rip=smoothstep(.26,.78,ribs*.64+frost*.36);
    float crest=.46*exp(-pow(13.*(v-.095),2.));
    float air=smoothstep(.46,.89,v+bed*.16);
    float line=clamp(.27*ribs+.52*rip+crest+air*.16,0.,1.);
    vec3 dark=mix(vec3(.045,.12,.16),vec3(.08,.25,.26),day);
    vec3 silver=mix(vec3(.31,.49,.57),vec3(.76,.88,.84),day);
    float edge=smoothstep(0.,.043,u)*(1.-smoothstep(.952,1.,u));
    float alpha=(.29+.32*rip+crest*.46)*(1.-smoothstep(.68+.14*bed,1.,v))*(1.-.22*air);
    gl_FragColor=vec4(mix(dark,silver,line),alpha*edge);
  `
  )
  const foam = material(
    uniforms,
    `
    float u=st.x,v=st.y,t=mod(time,270.);
    float cells=noise(vec2(u*68.+.44*sin(v*12.),v*3.5-t*1.84));
    float fiber=smoothstep(.50,.82,cells)*noise(vec2(u*12.+1.,v*2.-t*.42));
    float lip=smoothstep(.21,.98,v);
    float alpha=(.04+.63*fiber)*lip*smoothstep(.0,.037,u)*(1.-smoothstep(.96,1.,u));
    gl_FragColor=vec4(mix(vec3(.29,.47,.56),vec3(.72,.87,.84),day),alpha);
  `
  )
  function sheet(g, mat, name) {
    const mesh = new T.Mesh(g, mat)
    mesh.name = name
    mesh.renderOrder = 2
    mesh.userData.noCollision = true
    mesh.userData.terrainWaterfall = true
    scene.add(mesh)
  }
  // Adjacent curtains share the upstream lip. As the water drops the three
  // separate rock notches give the veils different widths and trajectories.
  for (const [a, c, drop, drift, j] of [
    [-17, -5.1, 47, 5.5, 0],
    [-6.05, 7.4, 58, 6.8, 1],
    [6.5, 17, 43, 4.7, 2],
  ]) {
    sheet(
      grid(
        (u, v) => {
          const x = mix(a, c, u),
            w = (c - a) * (0.02 + 0.11 * v) * Math.sin(u * 8.1 + j + v * 3.9)
          return [
            x + w * v + 0.72 * v * v * Math.sin(j + 1),
            -0.006 - drop * v * v,
            87.95 + drift * (1 - Math.exp(-4.4 * v)) + 0.49 * Math.sin(u * 7.2 + j) * v + 0.92 * v * v,
          ]
        },
        20,
        34
      ),
      curtain,
      '南峡三叠瀑'
    )
  }
  sheet(
    grid((u, v) => [mix(-16.88, 16.88, u), 0.023, 81.35 + v * 6.64], 45, 9),
    foam,
    '瀑沿水花'
  )
  for (const [path, drop, width] of sideSources) {
    const p = path.at(-1),
      prev = path.at(-2)
    const dx = p[0] - prev[0],
      dz = p[2] - prev[2],
      length = Math.hypot(dx, dz) || 1,
      nx = dx / length,
      nz = dz / length
    sheet(
      grid(
        (u, v) => {
          const reach = 2.82 * (1 - Math.exp(-4.2 * v)) + 0.94 * v * v,
            across = (u - 0.5) * width * (1 + 0.34 * v)
          return [
            p[0] + reach * nx - across * nz,
            p[1] - 0.006 - drop * v * v,
            p[2] + reach * nz + across * nx,
          ]
        },
        12,
        23
      ),
      curtain,
      '侧峰飞泉'
    )
    sheet(
      grid(
        (u, v) => {
          const t = v * (path.length - 1),
            i = Math.min(path.length - 2, Math.floor(t)),
            q = path[i],
            c = path[i + 1],
            f = t - i
          const dx = c[0] - q[0],
            dz = c[2] - q[2],
            len = Math.hypot(dx, dz) || 1,
            w = (u - 0.5) * width * (0.54 + 0.49 * v)
          return [
            mix(q[0], c[0], f) - (w * dz) / len,
            mix(q[1], c[1], f) + 0.02,
            mix(q[2], c[2], f) + (w * dx) / len,
          ]
        },
        9,
        path.length - 1
      ),
      foam,
      '岩上细流'
    )
  }
  return {
    update(t, day) {
      uniforms.time.value = t
      uniforms.day.value = day ? 1 : 0
    },
  }
}
