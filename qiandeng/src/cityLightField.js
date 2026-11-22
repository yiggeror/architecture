import * as T from 'three'

// Keep individual lantern pools fine at the old quays. A second, larger field
// follows the river beyond them and reaches the upper halls on the ridges.
export const innerField = { origin: [-66, -4, -125], step: 1.55, size: [87, 66, 140] }
export const valleyField = { origin: [-220, -29, -812], step: 4.7, size: [148, 78, 220] }

function gridCode(name, field) {
  const vector = (a) => 'vec3(' + a.map((v) => v.toFixed(2)).join(',') + ')'
  return (
    'vec3 ' +
    name +
    '(vec3 p){return ((p-' +
    vector(field.origin) +
    ')/' +
    field.step.toFixed(2) +
    '+.5)/' +
    vector(field.size) +
    ';}'
  )
}

export const lanternField = `
uniform highp sampler3D radiance,directions,outerRadiance,outerDirections;
${gridCode('cityGrid', innerField)}
${gridCode('valleyGrid', valleyField)}
float edgeDepth(vec3 q){vec3 d=min(q,1.-q);return min(min(d.x,d.y),d.z);}
void lanternFieldAt(vec3 p,out vec3 energy,out vec3 direction){
 vec3 q=cityGrid(p);float k=smoothstep(.005,.028,edgeDepth(q));
 if(k>=1.){vec3 r=texture(radiance,q).rgb;energy=r*r*12.;direction=texture(directions,q).rgb*2.-1.;return;}
 vec3 g=valleyGrid(p);vec3 r=texture(outerRadiance,g).rgb;
 energy=r*r*12.*smoothstep(.001,.012,edgeDepth(g));direction=texture(outerDirections,g).rgb*2.-1.;
 if(k>0.){r=texture(radiance,q).rgb;energy=mix(energy,r*r*12.,k);direction=mix(direction,texture(directions,q).rgb*2.-1.,k);}
}
vec3 lampEnergy(vec3 p){
 vec3 q=cityGrid(p);if(edgeDepth(q)>.008){vec3 a=texture(radiance,q).rgb;return a*a*12.;}
 vec3 g=valleyGrid(p);vec3 a=texture(outerRadiance,g).rgb;return a*a*12.*smoothstep(.001,.012,edgeDepth(g));
}`

export const nightAir = `
float riverDistanceMist(float distanceToEye,float altitude,float day){
 float density=mix(.00230,.00188,day)*mix(1.,.515,smoothstep(32.,217.,altitude));
 float t=distanceToEye*density;return (1.-exp(-t*t))*mix(.95,.92,day);
}
vec3 skyFill(float up,float day){
 return mix(mix(vec3(.030,.032,.057),vec3(.088,.133,.239),up),mix(vec3(.265,.284,.322),vec3(.655,.803,.956),up),day);
}
vec3 keyColor(float day){return mix(vec3(.212,.292,.49),vec3(1.83,1.53,1.12),day);}
`

export const sunAtlas = `
uniform sampler2D outerDepth;
uniform mat4 outerLightMatrix;
float farShadow(vec3 p,vec3 n,vec3 lightDir){
 float slope=1.-abs(dot(n,lightDir));
 vec3 sc=(outerLightMatrix*vec4(p+n*(.11+.30*slope),1.)).xyz*.5+.5;
 if(edgeDepth(sc)<0.)return 1.;
 float z=sc.z-.00038-.00071*slope;
 vec2 q=vec2(.00042,0.);
 return .25*(step(z,texture2D(outerDepth,sc.xy+q.xy+q.yx).r)+step(z,texture2D(outerDepth,sc.xy+q.xy-q.yx).r)+
             step(z,texture2D(outerDepth,sc.xy-q.xy+q.yx).r)+step(z,texture2D(outerDepth,sc.xy-q.xy-q.yx).r));
}
`

// Broad indirect light in mist above the merchant streets. The smaller
// irradiance grids still resolve the individual pools on timber and stone.
const mistField = { origin: [-227, -31, -820], step: 9.4, size: [74, 40, 112] }
export const mistGrid = gridCode('mistGrid', mistField)
export function districtAir(lights) {
  const {
    origin: [x0, y0, z0],
    step,
    size: [w, h, d],
  } = mistField
  const accum = new Float32Array(w * h * d)
  for (const l of lights) {
    const [x, y, z] = l.p
    if (x > -65 && x < 66 && z > -124 && z < 90) continue
    const r = Math.min(32, 12 + l.range * 0.85),
      reach = r * 1.75
    const imin = Math.max(0, Math.ceil((x - reach - x0) / step)),
      imax = Math.min(w - 1, Math.floor((x + reach - x0) / step))
    const kmin = Math.max(0, Math.ceil((z - reach - z0) / step)),
      kmax = Math.min(d - 1, Math.floor((z + reach - z0) / step))
    const jmin = Math.max(0, Math.ceil((y - reach * 0.62 - y0) / step)),
      jmax = Math.min(h - 1, Math.floor((y + reach * 0.82 - y0) / step))
    for (let k = kmin; k <= kmax; k++)
      for (let j = jmin; j <= jmax; j++)
        for (let i = imin; i <= imax; i++) {
          const dx = x0 + i * step - x,
            dz = z0 + k * step - z,
            dy = (y0 + j * step - y - 1.6) * 1.45
          const r2 = (dx * dx + dy * dy + dz * dz) / (r * r)
          if (r2 < 2.9)
            accum[(k * h + j) * w + i] += (Math.exp(-r2 * 1.4) - 0.016) * Math.min(1.55, l.power / 39)
        }
  }
  const density = Uint8Array.from(accum, (v) => Math.round(255 * (1 - Math.exp(-v * 0.43))))
  const tex = new T.Data3DTexture(density, w, h, d)
  tex.format = T.RedFormat
  tex.minFilter = tex.magFilter = T.LinearFilter
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  return tex
}
