import * as T from 'three'
import { generator } from './mesh.js'

const tau = Math.PI * 2
const mix = (a, b, t) => a + (b - a) * t
const clamp = (n) => Math.max(0, Math.min(1, n))
function smooth(a, b, t) {
  const v = clamp((t - a) / (b - a))
  return v * v * (3 - 2 * v)
}

function paintedSilk() {
  const sheet = document.createElement('canvas')
  const cell = 192
  sheet.width = 4 * cell
  sheet.height = cell
  const ctx = sheet.getContext('2d'),
    rng = generator(12050)
  ctx.fillStyle = '#fff0d9'
  ctx.fillRect(0, 0, sheet.width, cell)
  for (let i = 0; i < 4700; i++) {
    const x = rng() * sheet.width,
      y = rng() * cell
    ctx.strokeStyle = rng() < 0.33 ? 'rgba(118,55,40,.08)' : 'rgba(255,255,241,.36)'
    ctx.lineWidth = 0.25 + rng() * 0.55
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (rng() - 0.5) * 1.2, y + 1 + rng() * 10)
    ctx.stroke()
  }
  function stroke(d, color, width) {
    const path = new Path2D(d)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke(path)
  }
  function fill(d, color) {
    ctx.fillStyle = color
    ctx.fill(new Path2D(d))
  }
  const ink = '#8a5a4c',
    gold = '#b68b64',
    pale = '#d5b898'
  for (let which = 0; which < 4; which++) {
    ctx.save()
    ctx.translate(which * cell, 0)
    ctx.strokeStyle = '#d4b69c'
    ctx.lineWidth = 1
    ctx.strokeRect(9, 7, cell - 18, cell - 14)
    ctx.strokeRect(13, 11, cell - 26, cell - 22)
    // A border of water curls runs around the mouth of every gore.
    for (let x = 14; x < 180; x += 23) {
      stroke('M' + x + ' 173q7 -10 14 -1q4 4 8 0', gold, 1.15)
      stroke('M' + x + ' 177q8 -7 15 -1', pale, 0.8)
    }
    if (which === 0) {
      ctx.beginPath()
      ctx.arc(96, 88, 36, 0, tau)
      ctx.strokeStyle = pale
      ctx.lineWidth = 1.2
      ctx.stroke()
      // Peace, 安, drawn in tapered brush strokes.
      fill('M94 58Q98 61 99 68L95 69Q94 64 91 61Z', ink)
      fill('M75 71L79 73Q98 70 114 69L121 73L113 80L113 74Q96 74 78 77L74 82L72 80Z', ink)
      fill('M94 77L100 78Q94 90 88 96Q100 99 114 108L115 112Q101 104 84 99L82 96Q89 87 94 77Z', ink)
      fill('M74 91Q97 88 116 85L121 88Q104 90 73 95L70 94Z', ink)
      fill('M105 87L110 89Q99 108 77 115Q96 105 105 87Z', ink)
    } else if (which === 1) {
      // Resting blossom branch with five-petal flowers and unattached buds.
      stroke('M26 139Q60 119 79 109T126 72Q138 58 159 52', ink, 2.3)
      stroke('M63 119Q66 95 83 80M95 97Q118 99 137 81M123 75Q116 60 122 50', gold, 1.5)
      for (const [x, y, r] of [
        [62, 118, 6],
        [72, 96, 5],
        [82, 81, 5.4],
        [99, 96, 5.2],
        [122, 74, 6.7],
        [139, 65, 4.3],
        [136, 82, 4.3],
        [122, 50, 4.3],
        [152, 55, 3.4],
      ]) {
        for (let k = 0; k < 5; k++) {
          const a = (k * tau) / 5
          ctx.beginPath()
          ctx.ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.57, r * 0.36, a, 0, tau)
          ctx.fillStyle = k & 1 ? '#c78b78' : '#cd9c83'
          ctx.fill()
        }
        ctx.fillStyle = ink
        ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6)
      }
    } else if (which === 2) {
      // A swallow in three ink washes. Its tail opens into the silk below.
      fill(
        'M31 106Q57 104 80 98Q101 70 132 46Q119 67 110 88Q128 79 157 72Q136 86 109 98Q96 110 80 109L59 126L66 112L39 120L59 107Z',
        gold
      )
      fill(
        'M79 100Q103 75 126 54Q111 80 99 98Q123 86 151 76Q130 89 106 99Q94 105 81 105L56 119L68 106L44 114Z',
        ink
      )
      for (let k = 0; k < 3; k++)
        stroke(
          'M44 ' + (135 + k * 4) + 'Q61 ' + (127 + k * 4) + ' 77 ' + (133 + k * 4) + 'T108 ' + (132 + k * 4),
          pale,
          0.8
        )
    } else {
      for (let k = 0; k < 3; k++) {
        const y = 100 + k * 8
        stroke(
          'M33 ' +
            y +
            'Q47 ' +
            (y - 7) +
            ' 54 ' +
            (y - 7) +
            'Q58 ' +
            (y - 23) +
            ' 72 ' +
            (y - 16) +
            'Q78 ' +
            (y - 34) +
            ' 92 ' +
            (y - 29) +
            'Q112 ' +
            (y - 26) +
            ' 106 ' +
            (y - 14) +
            'Q99 ' +
            (y - 8) +
            ' 91 ' +
            (y - 14) +
            'Q105 ' +
            (y - 7) +
            ' 115 ' +
            (y - 14) +
            'Q132 ' +
            (y - 24) +
            ' 145 ' +
            (y - 13) +
            'Q153 ' +
            (y - 8) +
            ' 163 ' +
            (y - 12),
          k === 0 ? ink : pale,
          k === 0 ? 1.8 : 1
        )
      }
    }
    // A small woodblock seal is visible from within arm's reach.
    ctx.fillStyle = '#b67a67'
    ctx.fillRect(142, 132, 8, 10)
    stroke('M144 134v6m2 -6v2h2v4', pale, 0.8)
    ctx.restore()
  }
  const texture = new T.CanvasTexture(sheet)
  texture.colorSpace = T.NoColorSpace
  texture.anisotropy = 2
  return texture
}

class FrameGeometry {
  constructor() {
    this.coords = []
    this.parts = []
    this.uv = []
    this.indices = []
  }
  face(points, kind, uv) {
    const a = this.coords.length / 3
    for (let i = 0; i < points.length; i++) {
      this.coords.push(...points[i])
      this.parts.push(kind)
      this.uv.push(...(uv?.[i] || [0.5, 0.5]))
    }
    for (let i = 1; i < points.length - 1; i++) this.indices.push(a, a + i, a + i + 1)
  }
  rod(a, b, r, kind, sides = 4) {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b),
      dir = end.clone().sub(start).normalize()
    const side = new T.Vector3()
      .crossVectors(dir, Math.abs(dir.y) > 0.88 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0))
      .normalize()
      .multiplyScalar(r)
    const up = new T.Vector3().crossVectors(dir, side)
    const p = (base, t) =>
      base.clone().addScaledVector(side, Math.cos(t)).addScaledVector(up, Math.sin(t)).toArray()
    for (let i = 0; i < sides; i++) {
      const f = (tau * i) / sides,
        g = (tau * (i + 1)) / sides
      this.face([p(start, f), p(start, g), p(end, g), p(end, f)], kind)
    }
  }
  finish() {
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.Float32BufferAttribute(this.coords, 3))
    g.setAttribute('part', new T.Float32BufferAttribute(this.parts, 1))
    g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2))
    g.setIndex(this.indices)
    g.computeVertexNormals()
    return g
  }
}
function envelope(sides) {
  const model = new FrameGeometry()
  const profile =
    sides === 4
      ? [
          [0.012, 0.244],
          [0.066, 0.274],
          [0.21, 0.338],
          [0.46, 0.427],
          [0.7, 0.467],
          [0.89, 0.45],
          [1.015, 0.39],
        ]
      : [
          [0.012, 0.234],
          [0.066, 0.258],
          [0.21, 0.351],
          [0.46, 0.429],
          [0.7, 0.454],
          [0.89, 0.423],
          [1.015, 0.341],
        ]
  const fold = sides === 4 ? 0.17 : 0.12
  function pos(panel, u, height, r) {
    const a = ((panel - 0.5) * tau) / sides,
      b = a + tau / sides
    const ripple = Math.sin(Math.PI * u)
    const x = mix(Math.cos(a), Math.cos(b), u),
      z = mix(Math.sin(a), Math.sin(b), u)
    const puff = 1 + fold * ripple * (0.4 + 0.6 * Math.sin(height * Math.PI * 0.91))
    return [r * x * puff, height + 0.007 * ripple * Math.sin(height * 4), r * z * puff]
  }
  for (let p = 0; p < sides; p++) {
    for (let j = 0; j < profile.length - 1; j++) {
      const [y, r] = profile[j],
        [h, q] = profile[j + 1]
      for (let k = 0; k < 5; k++) {
        const a = k / 5,
          b = (k + 1) / 5
        model.face([pos(p, a, y, r), pos(p, a, h, q), pos(p, b, h, q), pos(p, b, y, r)], 0, [
          [((p % 4) + a) / 4, y],
          [((p % 4) + a) / 4, h],
          [((p % 4) + b) / 4, h],
          [((p % 4) + b) / 4, y],
        ])
      }
      model.rod(pos(p, 0, y, r + 0.0015), pos(p, 0, h, q + 0.0015), 0.0047, 1, 4)
    }
    const [hy, hr] = profile.at(-1)
    const crest = [0.018, 1.074, 0.012]
    for (let j = 0; j < 5; j++) {
      const p0 = pos(p, j / 5, hy, hr),
        p1 = pos(p, (j + 1) / 5, hy, hr)
      model.face([p0, crest, p1], 0, [
        [0.81, 0.84],
        [0.82, 0.92],
        [0.83, 0.84],
      ])
      const s0 = pos(p, j / 5, 0.02, 0.248),
        s1 = pos(p, (j + 1) / 5, 0.02, 0.248)
      model.rod(s0, s1, 0.01, 1)
      model.rod(p0, p1, 0.0045, 2, 3)
    }
    for (const [y, r] of [
      [0.073, 0.28],
      [0.86, sides === 4 ? 0.455 : 0.433],
    ]) {
      for (let k = 0; k < 5; k++) {
        const a = pos(p, k / 5, y, r + 0.002),
          b = pos(p, (k + 1) / 5, y, r + 0.002)
        model.rod(a, b, y < 0.2 ? 0.0038 : 0.0028, y < 0.2 ? 2 : 1, 3)
      }
    }
    model.rod(pos(p, 0, hy, hr), crest, 0.004, 2, 3)
    const mouth = pos(p, 0, 0.02, 0.248)
    model.rod(mouth, [mouth[0] * 0.82, -0.034, mouth[2] * 0.82], 0.005, 2)
    model.rod([mouth[0] * 0.82, -0.034, mouth[2] * 0.82], [0.019, -0.04, 0], 0.006, 1, 3)
  }
  const ring = [
    [0.06, -0.049],
    [0.074, -0.034],
    [0.057, -0.001],
  ]
  for (const [type, rows] of [
    [3, ring],
    [
      4,
      [
        [0.036, -0.004],
        [0.043, 0.033],
        [0.028, 0.084],
        [0.014, 0.132],
        [0.001, 0.157],
      ],
    ],
    [
      5,
      [
        [0.022, 0.003],
        [0.027, 0.025],
        [0.008, 0.077],
        [0.001, 0.096],
      ],
    ],
  ]) {
    for (let j = 0; j < rows.length - 1; j++)
      for (let i = 0; i < 8; i++) {
        const pt = (t, o) => [
          Math.cos(t) * rows[o][0] + Math.max(0, rows[o][1]) ** 2 * 0.72,
          rows[o][1],
          Math.sin(t) * rows[o][0],
        ]
        const t = (tau * i) / 8,
          u = t + tau / 8
        model.face([pt(t, j), pt(t, j + 1), pt(u, j + 1), pt(u, j)], type)
      }
  }
  return model.finish()
}

// At a few pixels across, the silhouette, real open mouth and printed gores
// carry the design. The full rods, flame and braided lip return on approach.
function distantEnvelope(sides) {
  const g = new FrameGeometry(),
    shape = [
      [0.012, 0.244],
      [0.16, 0.325],
      [0.61, 0.456],
      [0.9, 0.446],
      [1.02, 0.373],
    ]
  const pt = (i, j, u, extra = 0) => {
    const a = ((i - 0.5) * tau) / sides,
      b = a + tau / sides
    const r = shape[j][1] * (1 + 0.12 * Math.sin(Math.PI * u)) + extra
    return [r * mix(Math.cos(a), Math.cos(b), u), shape[j][0], r * mix(Math.sin(a), Math.sin(b), u)]
  }
  for (let i = 0; i < sides; i++) {
    for (let j = 0; j < shape.length - 1; j++)
      for (let k = 0; k < 2; k++) {
        const a = k / 2,
          b = (k + 1) / 2
        g.face([pt(i, j, a), pt(i, j + 1, a), pt(i, j + 1, b), pt(i, j, b)], 0, [
          [((i % 4) + a) / 4, shape[j][0]],
          [((i % 4) + a) / 4, shape[j + 1][0]],
          [((i % 4) + b) / 4, shape[j + 1][0]],
          [((i % 4) + b) / 4, shape[j][0]],
        ])
      }
    g.face([pt(i, 4, 0), [0, 1.075, 0], pt(i, 4, 1)], 0, [
      [0.83, 0.91],
      [0.85, 0.94],
      [0.83, 0.92],
    ])
    const a = pt(i, 0, 0),
      b = pt(i, 0, 1),
      c = [b[0] * 0.94, -0.015, b[2] * 0.94],
      d = [a[0] * 0.94, -0.015, a[2] * 0.94]
    g.face([a, b, c, d], 1)
    g.face([d, c, [0.012, -0.039, 0]], 3)
    g.face(
      [
        [a[0] * 0.09, -0.015, a[2] * 0.09],
        [0.004, 0.129, 0],
        [b[0] * 0.09, -0.015, b[2] * 0.09],
      ],
      4
    )
  }
  return g.finish()
}

const lanternVertex = `
 attribute float part; attribute vec4 lantern;
 varying vec2 silkUV; varying float piece, heat, height, family, distanceToEye;
 varying vec3 normalWorld; varying float litWick;
 uniform float time;
 void main(){
   vec3 p=position;
   float flicker=.86+.084*sin(time*7.1+lantern.y)+.052*sin(time*11.9+lantern.y*2.8);
   if(part>3.5) {p.y*=flicker; p.x+=max(0.,p.y)*.16*sin(time*4.3+lantern.y);}
   vec4 world=modelMatrix*instanceMatrix*vec4(p,1.);
   vec4 mv=viewMatrix*world;
   distanceToEye=-mv.z; silkUV=uv;piece=part; height=position.y;
   normalWorld=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);
   heat=lantern.z*flicker; family=lantern.x;litWick=lantern.w;
   gl_Position=projectionMatrix*mv;
 }`
const lanternFragment = `
 uniform sampler2D paper;uniform float daylight;
 varying vec2 silkUV;varying float piece,heat,height,family,distanceToEye;varying vec3 normalWorld; varying float litWick;
 void main(){
   vec3 gold=vec3(1.48,.48,.082), persimmon=vec3(1.40,.112,.036), ivory=vec3(1.45,1.08,.63);
   vec3 dye=family<.43?gold:(family<.80?persimmon:ivory);
   float sidelight=.67+.33*dot(normalize(normalWorld),normalize(vec3(-.54,.67,.51)));
   vec3 c;
   if(piece<.5){
     vec3 art=texture2D(paper,silkUV).rgb;
     float glow=exp(-3.70*max(0.,height-.021));
     float fibre=.975+.025*sin(silkUV.x*1910.);
     float panel=fract(silkUV.x*4.);
     float rolled=.79+.21*sin(panel*3.14159);
     vec3 core=dye*(.70+.39*(1.-height))+vec3(1.55,.85,.16)*glow;
     c=core*art*art*fibre*heat*rolled*(.64+.36*sidelight);
     vec3 silk=family<.43?vec3(.80,.31,.103):(family<.80?vec3(.63,.13,.092):vec3(.86,.67,.43));
     c=mix(c,silk*art*sidelight,daylight);
   }else if(piece<1.5)c=mix(vec3(.25,.105,.034),vec3(.21,.129,.071),daylight)*sidelight;
   else if(piece<2.5)c=mix(vec3(.64,.34,.091),vec3(.48,.30,.106),daylight)*sidelight;
   else if(piece<3.5)c=vec3(.15,.080,.039)*sidelight;
   else { if(daylight>.5&&litWick<.5)discard;
     c=mix(piece<4.5?vec3(3.1,1.24,.18):vec3(4.,2.35,.85),vec3(1.15,.46,.10),daylight)*heat; }
   float aerial=1.-exp(-.0010*max(0.,distanceToEye));
   c=mix(c,mix(vec3(.17,.18,.29),vec3(.61,.65,.69),daylight),min(.38,aerial));
   gl_FragColor=vec4(c,1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
 }`
const haloVertex = `
 attribute vec4 lantern;varying vec2 st;varying float shine,farFade;uniform float time;
 void main(){
  vec4 p=modelViewMatrix*instanceMatrix*vec4(0.,.43,0.,1.);
  float scale=length(instanceMatrix[1].xyz);
  p.xy+=position.xy*scale*1.28;
  st=position.xy;shine=lantern.z*(.86+.08*sin(time*7.1+lantern.y));
  farFade=1.-smoothstep(75.,300.,-p.z);
  gl_Position=projectionMatrix*p;
 }`
const haloFragment = `
 varying vec2 st; varying float shine,farFade;
 void main(){
  float r=dot(st,st);float a=(exp(-4.3*r)-.014)*shine*farFade;
  if(a<=.008) discard;
  gl_FragColor=vec4(.95,.366,.087,a*.13);
  #include <colorspace_fragment>
 }`

// The lower half of each current starts along a launch landing. They diverge
// past the gate and reconverge much higher in the wind above the palace.
const currents = [
  {
    n: 25,
    track: [
      [-16.25, 1.55, 26],
      [-13, 11.3, 17],
      [-27, 25, 3],
      [-45, 45, -31],
      [-45, 78, -93],
    ],
    spread: 2.1,
  },
  {
    n: 30,
    track: [
      [16.25, 1.55, 21.8],
      [13.15, 15.65, 22.3],
      [10.7, 22, 9.4],
      [16, 34, -21],
      [32, 47, -54],
      [48, 64, -82],
      [43, 77, -113],
      [5, 94, -148],
    ],
    spread: 3.3,
  },
  {
    n: 29,
    track: [
      [-16.25, 1.55, -26],
      [-12, 17, -34],
      [-24, 31, -46],
      [-21, 50, -81],
      [11, 83, -151],
    ],
    spread: 3.6,
  },
  {
    n: 25,
    track: [
      [16.25, 1.55, -49],
      [13, 14, -56],
      [26, 37, -56],
      [44, 63, -89],
      [53, 86, -152],
    ],
    spread: 3.1,
  },
  {
    n: 15,
    track: [
      [-17.55, 2.4, 59],
      [-8, 15, 52],
      [-2, 28, 47],
      [-21, 48, 31],
      [-37, 77, -9],
    ],
    spread: 2.3,
  },
  {
    n: 17,
    track: [
      [17.55, 2.4, 63],
      [13, 14, 56],
      [25, 29, 42],
      [49, 46, 14],
      [63, 72, -29],
    ],
    spread: 2.3,
  },
  {
    n: 19,
    track: [
      [-17.65, 2.4, -58],
      [-21.6, 21, -61],
      [-31.4, 39.4, -71.8],
      [-55, 50, -84],
      [-65, 64, -108],
      [-72, 86, -147],
    ],
    spread: 3.4,
  },
]
export const launchSites = currents.slice(0, 4).map((s) => s.track[0])

export function skyLanterns(scene) {
  const rng = generator(793642),
    time = { value: 0 },
    daylight = { value: 0 }
  const mat = new T.ShaderMaterial({
    uniforms: { paper: { value: paintedSilk() }, daylight, time },
    vertexShader: lanternVertex,
    fragmentShader: lanternFragment,
    side: T.DoubleSide,
  })
  const glow = new T.ShaderMaterial({
    uniforms: { time },
    vertexShader: haloVertex,
    fragmentShader: haloFragment,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    side: T.DoubleSide,
    forceSinglePass: true,
  })
  const families = [[], []]
  for (let j = 0; j < currents.length; j++) {
    const stream = currents[j]
    const curve = new T.CatmullRomCurve3(
      stream.track.map((p) => new T.Vector3(...p)),
      false,
      'centripetal'
    )
    let index = 0,
      group = 0
    while (index < stream.n) {
      const size = Math.min(stream.n - index, 1 + Math.floor(rng() * 3))
      const leader = (index + 0.55 + rng() * 0.35) / stream.n
      for (let k = 0; k < size; k++, index++) {
        const family = (index + j) % 3 === 0 ? 1 : 0
        const s = 0.78 + 0.62 * rng() + ((index + 2 * j) % 11 === 0 ? 0.26 : 0)
        families[family].push({
          curve,
          phase: (leader + k * 0.011) % 1,
          period: 99 + j * 7 + (group % 3) * 3.9,
          scatter: stream.spread,
          dx: (rng() - 0.5) * 2,
          dy: (rng() - 0.5) * 2,
          dz: (rng() - 0.5) * 2,
          seed: rng() * tau,
          scale: s,
          slim: 0.88 + rng() * 0.3,
          shade: rng(),
          heat: 0.8 + rng() * 0.35,
          day: index % 10 === j % 3,
        })
      }
      group++
    }
  }
  for (let i = 0; i < launchSites.length; i++) {
    const [x, , z] = launchSites[i]
    families[i % 2].push({
      fixed: [x, 0.83, z + 1.05],
      seed: rng() * tau,
      scale: 0.7 + 0.065 * (i % 3),
      slim: 0.9,
      shade: i === 2 ? 0.66 : 0.82,
      heat: 0.67,
      day: true,
    })
  }
  let partitionedBy = null,
    previousFocal = 0
  const lastEye = new T.Vector3()
  const clusters = families.map((records, i) => {
    const sides = i === 0 ? 4 : 6
    const name = i ? '六瓣缂丝天灯' : '四角走马天灯'
    for (const a of records) {
      a.matrix = new T.Matrix4()
      a.pigment = new Float32Array([a.shade, a.seed * 3, a.heat, a.fixed ? 0 : 1])
    }
    const buckets = [envelope(sides), distantEnvelope(sides)].map((geometry, k) => {
      const pigment = new T.InstancedBufferAttribute(new Float32Array(records.length * 4), 4).setUsage(
        T.DynamicDrawUsage
      )
      geometry.setAttribute('lantern', pigment)
      const body = new T.InstancedMesh(geometry, mat, records.length)
      body.name = name + (k ? '远景' : '')
      body.frustumCulled = false
      body.userData.animated = true
      body.instanceMatrix.setUsage(T.DynamicDrawUsage)
      scene.add(body)
      return { body, pigment }
    })
    const haloGeometry = new T.PlaneGeometry(2, 2)
    const attrs = new Float32Array(records.length * 4)
    records.forEach((record, k) => attrs.set(record.pigment, k * 4))
    haloGeometry.setAttribute('lantern', new T.InstancedBufferAttribute(attrs, 4))
    const halo = new T.InstancedMesh(haloGeometry, glow, records.length)
    halo.name = '天灯焰晕'
    halo.frustumCulled = false
    halo.renderOrder = 3
    halo.userData.animated = true
    halo.instanceMatrix.setUsage(T.DynamicDrawUsage)
    scene.add(halo)
    return { buckets, halo, records }
  })
  function partition(camera, viewportHeight) {
    const focal = 0.5 * viewportHeight * camera.projectionMatrix.elements[5]
    if (partitionedBy === camera && previousFocal === focal && lastEye.equals(camera.position)) return
    partitionedBy = camera
    previousFocal = focal
    lastEye.copy(camera.position)
    for (const { buckets, records } of clusters) {
      for (const { body } of buckets) body.count = 0
      for (const a of records) {
        if (!a.visible) continue
        const e = a.matrix.elements
        const distance = (e[12] - lastEye.x) ** 2 + (e[13] - lastEye.y) ** 2 + (e[14] - lastEye.z) ** 2
        // A physical lamp that fills eighteen screen pixels gets its silk folds and ribs.
        const lampHeight = 1.075 * Math.hypot(e[4], e[5], e[6])
        const detailReach = Math.min(75, (focal * lampHeight) / 18)
        const { body, pigment } = buckets[distance < detailReach ** 2 ? 0 : 1]
        const id = body.count++
        body.setMatrixAt(id, a.matrix)
        pigment.array.set(a.pigment, id * 4)
      }
      for (const { body, pigment } of buckets) {
        body.instanceMatrix.needsUpdate = true
        pigment.needsUpdate = true
      }
    }
  }
  // Set GPU buffers before Three traverses and uploads them. Mirrors reuse the
  // physical viewer's level of detail while rendering the same real paper bodies.
  let visitor
  const beforeScene = scene.onBeforeRender
  scene.onBeforeRender = function (renderer, root, camera, ...rest) {
    beforeScene.call(this, renderer, root, camera, ...rest)
    if (camera.layers.isEnabled(1) || !visitor) visitor = camera
    partition(visitor, renderer.domElement.height)
  }
  const pose = new T.Object3D(),
    p = new T.Vector3()
  function update(t, day) {
    time.value = t
    partitionedBy = null
    for (const { halo, records } of clusters) {
      for (let i = 0; i < records.length; i++) {
        const a = records[i]
        a.visible = !day || a.day
        if (!a.visible) continue
        if (a.fixed) {
          pose.position.fromArray(a.fixed)
          pose.rotation.set(0, a.seed, 0)
          pose.scale.set(a.scale, a.scale * a.slim, a.scale)
        } else {
          const u = (a.phase + t / a.period) % 1
          a.curve.getPointAt(u, p)
          const opening = smooth(0, 0.13, u),
            turbulence = 0.27 + a.scatter * (0.57 + 1.35 * u)
          const x = p.x + opening * (a.dx * turbulence + 0.56 * Math.sin(t * 0.34 + a.seed + u * 8))
          const z = p.z + opening * (a.dz * turbulence + 0.47 * Math.cos(t * 0.27 + a.seed - u * 7))
          pose.position.set(
            x,
            p.y + 0.15 * Math.sin(t * 0.82 + a.seed) + opening * a.dy * (0.8 + 2.85 * u),
            z
          )
          pose.rotation.set(
            0.05 * Math.sin(t * 0.49 + a.seed),
            a.seed + 0.42 * Math.sin(t * 0.072 + a.seed) + u * 0.84,
            0.067 * Math.sin(t * 0.39 + a.seed)
          )
          const size = a.scale * Math.max(0.001, smooth(0, 0.012, u) * (1 - smooth(0.93, 1, u)))
          pose.scale.set(size, size * a.slim, size)
        }
        pose.updateMatrix()
        a.matrix.copy(pose.matrix)
        if (!day) halo.setMatrixAt(i, a.matrix)
      }
      if (!day) halo.instanceMatrix.needsUpdate = true
      halo.visible = !day
    }
  }
  function mode(day) {
    daylight.value = Number(day)
    for (const { halo } of clusters) halo.visible = !day
  }
  return { mode, update }
}
