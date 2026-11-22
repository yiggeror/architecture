import * as T from 'three'
import { generator } from './mesh.js'

export const cascades = [
  {
    y: 23.95,
    end: 16.06,
    z: -72.51,
    out: -70.95,
    streams: [
      [-4.35, 3.55, -0.22],
      [2.78, 5.89, 0.22],
      [10.89, 4.2, 0.29],
    ],
  },
  {
    y: 16.02,
    end: 8.76,
    z: -70.25,
    out: -68.75,
    streams: [
      [-4.32, 5.22, -0.31],
      [3.16, 6.34, 0.24],
      [10.94, 5.57, 0.2],
    ],
  },
  {
    y: 8.72,
    end: 0.079,
    z: -67.93,
    out: -65.77,
    streams: [
      [-5.37, 4.56, -0.39],
      [0.91, 5.29, -0.15],
      [6.48, 4.24, 0.16],
      [12.01, 4.65, 0.24],
    ],
  },
]

function sheetPoint(stage, stream, u, v) {
  const [cx, w, lean] = stream
  const fall = v * v,
    flare = 0.86 - 0.095 * Math.sin(v * Math.PI) + 0.18 * fall
  const rag =
    0.11 * Math.sin(12.6 * u + cx + v * 7.6) * Math.sin(v * Math.PI) + 0.12 * Math.cos(6.2 * v + cx) * fall
  const x = cx + (u - 0.5) * w * flare + lean * fall + rag
  const y = stage.y - (stage.y - stage.end) * (0.11 * v + 0.89 * v * v)
  const ripple = 0.06 * Math.sin(u * 16.3 + cx + v * 4.2) + 0.032 * Math.sin(u * 39.6 - v * 2.2)
  // The projecting last lip throws the water past the old imperial quay coping.
  const advance = stage.end < 1 ? 1 - (1 - v) ** 1.71 : v
  const z =
    stage.z + (stage.out - stage.z) * advance + ripple * (0.48 + 0.52 * v) + 0.077 * Math.sin(Math.PI * u)
  return [x, y, z]
}
const noise = `
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
`
function sheetMesh() {
  const pos = [],
    uv = [],
    ids = [],
    ix = []
  cascades.forEach((stage, j) =>
    stage.streams.forEach((stream, k) => {
      const cols = 18,
        rows = 12,
        base = pos.length / 3
      for (let v = 0; v <= rows; v++)
        for (let u = 0; u <= cols; u++) {
          pos.push(...sheetPoint(stage, stream, u / cols, v / rows))
          uv.push(u / cols, v / rows)
          ids.push(j * 4 + k + 0.53)
          if (v && u) {
            const i = base + v * (cols + 1) + u
            ix.push(i - cols - 2, i - 1, i, i - cols - 2, i, i - cols - 1)
          }
        }
    })
  )
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
  g.setAttribute('channel', new T.Float32BufferAttribute(ids, 1))
  g.setIndex(ix)
  g.computeBoundingSphere()
  return g
}
function foamMesh() {
  const pos = [],
    uv = [],
    id = [],
    types = [],
    ix = []
  function append(cx, cz, y, w, d, seed, type) {
    const cols = 9,
      rows = 3,
      start = pos.length / 3
    for (let v = 0; v <= rows; v++)
      for (let u = 0; u <= cols; u++) {
        const a = u / cols,
          c = v / rows
        pos.push(cx + (a - 0.5) * w, y + 0.008 * Math.sin(a * 12 + c * 5), cz + (c - 0.5) * d)
        uv.push(a, c)
        id.push(seed)
        types.push(type)
        if (u && v) {
          const i = start + v * (cols + 1) + u
          ix.push(i - cols - 2, i - 1, i, i - cols - 2, i, i - cols - 1)
        }
      }
  }
  for (const [j, stage] of cascades.entries()) {
    for (const [k, s] of stage.streams.entries()) {
      const low = [s[0] + s[2], stage.out, stage.end + 0.032]
      append(low[0], low[1] - 0.077, low[2], s[1] * 1.3, j === 2 ? 0.5 : 1.12, j * 8 + k, 0)
    }
    if (j < 2)
      append(
        3.2,
        (stage.out + cascades[j + 1].z) / 2,
        stage.end + 0.012,
        20.2,
        Math.abs(stage.out - cascades[j + 1].z) + 0.24,
        j * 0.96,
        1
      )
  }
  for (const [i, s] of cascades[0].streams.entries())
    append(s[0], -73.16, 23.954, s[1] * 0.865, 1.39, 49 + i, 2)
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
  g.setAttribute('channel', new T.Float32BufferAttribute(id, 1))
  g.setAttribute('pool', new T.Float32BufferAttribute(types, 1))
  g.setIndex(ix)
  g.computeBoundingSphere()
  return g
}
function sprayMesh() {
  const rand = generator(96733)
  const pos = [],
    seed = [],
    kind = [],
    size = []
  for (const [j, stage] of cascades.entries())
    for (const stream of stage.streams) {
      const count = [35, 55, 101][j],
        clouds = [6, 13, 35][j]
      for (let k = 0; k < count; k++) {
        const mist = k < clouds,
          x = stream[0] + stream[2] + (rand() - 0.5) * stream[1] * 1.09
        pos.push(x, stage.end + 0.04, stage.out - 0.13 - rand() * (j === 2 ? 0.1 : 0.21))
        seed.push(rand(), rand(), rand())
        kind.push(mist ? 1 : 0)
        size.push(mist ? 0.47 + rand() * (0.68 + 0.29 * j) : 0.024 + rand() * (0.043 + 0.014 * j))
      }
    }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
  g.setAttribute('seed', new T.Float32BufferAttribute(seed, 3))
  g.setAttribute('mist', new T.Float32BufferAttribute(kind, 1))
  g.setAttribute('diameter', new T.Float32BufferAttribute(size, 1))
  g.computeBoundingSphere()
  return g
}
export function flowingWater(scene) {
  const uniforms = { time: { value: 0 }, day: { value: 0 }, pixels: { value: 690 } }
  const water = new T.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    vertexShader: `uniform float time;attribute float channel;varying vec2 st;varying vec3 wp;varying float id;
    void main(){st=uv;id=channel;vec3 p=position;
      float g=sin(uv.y*10.-time*3.7+channel)*sin(uv.y*3.14159);
      p.z+=g*(.025+.024*sin(uv.x*14.+channel));
      p.x+=sin(time*1.13+channel*2.+uv.y*8.1)*(.028+.095*uv.y)*smoothstep(.02,.9,uv.y);
      wp=(modelMatrix*vec4(p,1.)).xyz;
      gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`,
    fragmentShader: `uniform float time,day;varying vec2 st;varying vec3 wp;varying float id;
      ${noise}
      void main(){
        float u=st.x,v=st.y,t=mod(time,680.);
        vec2 k=vec2(wp.x*.62+id*.72,v*2.95-t*1.30);
        float body=n2(k), fold=n2(k*vec2(3.20,1.45)+vec2(.77*body,5.13));
        float strand=n2(vec2(wp.x*9.9+body*.89+fold*.71+id, v*5.15-t*2.17));
        float gauze=n2(vec2(wp.x*28.+.85*fold,v*9.2-t*3.38+id));
        float lead=1.-step(.1,abs(mod(floor(id),4.)-1.));
        float amount=.67+.18*cos(1.79*id+.31)+.07*sin(3.77*id)+.28*lead;
        float tier=floor(id/4.);
        float edge=min(u,1.-u), feather=.022+.079*pow(v,1.35)+.041*(1.-body);
        float opacity=smoothstep(0.,feather,edge+.048*(fold-.51)*(.28+.72*v));
        // Standing folds divide the broad sheets into thin ropes and transparent gaps.
        float turn=.41*n2(vec2(v*2.31-t*.48,id*1.37))+.17*sin(v*7.1+id+t*.41);
        float warp=n2(vec2(wp.x*1.47+turn+.12*body,id*.88+.17*v));
        float vein=smoothstep(.28+.09*v,.73,.69*warp+.23*fold+.08*strand);
        float braid=.50*strand+.33*fold+.17*gauze;
        float film=smoothstep(.20,.73,braid);
        float tear=smoothstep(.32+.14*v*(1.-.46*amount),.62,.54*warp+.30*strand+.16*body);
        float silk=amount*(.055+.22*film+.45*vein*pow(braid,1.26))+.066*lead*film;
        float lip=.11*exp(-v*v*150.)*(.24+.66*warp);
        float churn=smoothstep(.79,1.0,v)*(.055+.080*gauze+.037*tier)*(.47+.53*tear)+lip;
        vec3 deep=mix(vec3(.005,.025,.039),vec3(.041,.14,.15),day);
        vec3 bright=mix(vec3(.34,.67,.75),vec3(.82,1.02,1.),day);
        vec3 col=mix(deep,bright,clamp(silk+churn,0.,1.));
        float lamplight=.93*exp(-.37*abs(wp.x+8.8))+.79*exp(-.40*abs(wp.x-15.9))+
          .43*exp(-.78*abs(wp.x-6.9))*exp(-.24*abs(wp.y-14.6));
        col+=mix(vec3(.15,.063,.014),vec3(.046,.035,.013),day)*lamplight*(.26+.74*strand);
        col+=vec3(.12,.17,.18)*pow(gauze,5.)*vein*(.4+v);
        float dist=length(cameraPosition-wp), fog=1.-exp(-dist*dist*.000018);
        col=mix(col,mix(vec3(.105,.14,.22),vec3(.45,.54,.50),day),.62*fog);
        float alpha=.14+.32*amount+.32*film+.15*vein+.068*lead;
        gl_FragColor=vec4(col,opacity*alpha*mix(.25+.13*lead,1.,tear));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const foam = new T.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    vertexShader: `attribute float channel,pool;varying vec2 st;varying float id,basin;varying vec3 wp;
      void main(){id=channel;basin=pool;st=uv;wp=(modelMatrix*vec4(position,1.)).xyz;
        gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`,
    fragmentShader: `uniform float time,day;varying vec2 st;varying float id,basin;varying vec3 wp;${noise}
      void main(){vec2 e=(st-.5)*2.;float t=mod(time,680.);float a=n2(vec2(wp.x*3.7,wp.z*9.-t*2.2+id));
        float b=n2(vec2(wp.x*1.73+t*.3,wp.z*6.0-t*.97+id)),r=.65*a+.35*b;
        float band=basin>.5?.79:1.-smoothstep(.45,1.18,dot(e,e*vec2(.85,1.0))+r*.20);
        float rings=.5+.5*cos(length(vec2(e.x*1.5,e.y))*(35.+4.*b)-t*4.0);
        vec3 c=mix(vec3(.018,.093,.126),mix(vec3(.52,.77,.87),vec3(.77,.94,.91),day),
          clamp(.32*r+.52*smoothstep(.43,.79,r)+.13*rings,0.,1.));
        if(basin>1.5)c=mix(vec3(.031,.11,.132),c,.28+.18*rings);
        gl_FragColor=vec4(c,band*(basin>.5?.80:.83)*(.70+.30*r));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const spray = new T.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `uniform float time,pixels;attribute vec3 seed;attribute float mist,diameter;
      varying float alpha,soft,bank,extent;void main(){float life=fract(time*mix(1.31,.36,mist)*(.72+.58*seed.y)+seed.x);
        vec3 p=position;float h=mix(.21+.48*seed.z,.71+1.15*seed.z,mist);
        p.y+=4.*life*(1.-life)*h;p.x+=(seed.y-.5)*life*mix(.52,1.08,mist);
        p.z+=mix(.055,.15,mist)*life;vec4 mv=modelViewMatrix*vec4(p,1.);soft=mist;
        bank=(modelMatrix*vec4(p,1.)).z;extent=diameter*(.67+.53*life);
        alpha=sin(3.14159*life)*(.37+.58*seed.z);
        gl_PointSize=clamp(extent*pixels*projectionMatrix[1][1]/max(.2,-mv.z),1.,72.);
        gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform float day;varying float soft,alpha,bank,extent;void main(){vec2 p=gl_PointCoord-.5;
      float r=length(p)*2.;if(r>1.)discard;
      float z=bank+extent*(viewMatrix[2][0]*p.x-viewMatrix[2][1]*p.y);
      float a=mix((1.-smoothstep(.45,1.,r))*.76,pow(1.-r*r,2.)*.14,soft)*alpha*(1.-smoothstep(-65.68,-65.55,z));
      vec3 c=mix(vec3(.69,.95,1.01),vec3(.92,1.04,1.),day);
      gl_FragColor=vec4(c,a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  })
  const group = new T.Group()
  group.name = '北阙三叠天瀑'
  const sheets = new T.Mesh(sheetMesh(), water),
    pools = new T.Mesh(foamMesh(), foam),
    mist = new T.Points(sprayMesh(), spray)
  sheets.name = '跌水丝幕'
  pools.name = '分水池涟漪'
  mist.name = '瀑脚飞沫'
  for (const [i, o] of [pools, sheets, mist].entries()) {
    o.renderOrder = 1 + i
    o.userData.noCollision = true
    group.add(o)
  }
  scene.add(group)
  return {
    update(t, day) {
      uniforms.time.value = t
      uniforms.day.value = Number(day)
      uniforms.pixels.value = (typeof innerHeight === 'number' ? innerHeight : 690) * 0.51
    },
  }
}
