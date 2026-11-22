import * as T from 'three'
import { lanternField, mistGrid } from './cityLightField.js'

// Integrate the air only as far as the visible surface. Lantern-lit rain behind
// a roof cannot brighten its front silhouette.
export function riverMist(common, depth) {
  const uniforms = {
    airField: common.airField,
    radiance: common.radiance,
    directions: common.directions,
    outerRadiance: common.outerRadiance,
    outerDirections: common.outerDirections,
    occTex: common.occTex,
    lightMatrix: common.lightMatrix,
    day: common.day,
    time: common.clockTime,
    depth: { value: depth },
    inverseView: { value: new T.Matrix4() },
    clipZ: { value: new T.Vector2() },
    lens: { value: new T.Vector2() },
  }
  return new T.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: 'varying vec2 st;void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `
 precision highp sampler3D;
 varying vec2 st;uniform sampler2D depth,occTex;
 ${lanternField}
 ${mistGrid}
 uniform sampler3D airField;
 uniform mat4 inverseView,lightMatrix;uniform vec2 clipZ,lens;uniform float day,time;
 void main(){
  float d=texture2D(depth,st).r;float z=clipZ.x*clipZ.y/(clipZ.y-d*(clipZ.y-clipZ.x));
  vec3 ray=vec3((st*2.-1.)*lens,-1.);float distance=min(147.,length(ray)*z);
  vec3 dir=mat3(inverseView)*normalize(ray),from=inverseView[3].xyz;
  float dt=distance/24.;vec3 light=vec3(0.);
  for(int i=0;i<24;i++){
   float t=(float(i)+.38)*dt;vec3 p=from+dir*t;

   float layer=.72+.16*sin(.165*p.x+.11*p.z-.13*time)+.12*sin(.72*p.y+.068*p.z);
   if(day<.5){
     vec3 e=lampEnergy(p);
     light+=min(e,vec3(2.9,1.8,.8))*(.0043*exp(-t*.008)*layer*dt);
   }else{
     vec3 sc=(lightMatrix*vec4(p,1.)).xyz*.5+.5;
     float sun=step(sc.z-.0006,texture2D(occTex,sc.xy).r);
     float low=exp(-max(0.,p.y-2.)*.18);
     light+=sun*low*layer*dt*.00087*vec3(1.,.84,.65);
   }
  }
  if(day<.5){
   float lengthInAir=min(length(ray)*z,780.);
   float stepFar=lengthInAir/32.;
   float wetFilm=0.;
   for(int j=0;j<32;j++) {
     float t=(float(j)+.44)*stepFar;vec3 q=mistGrid(from+dir*t);
     if(edgeDepth(q)<=0.)continue;
     wetFilm+=texture(airField,q).r*exp(-t*.0017)*stepFar;
   }
   light+=vec3(.00168,.00078,.00036)*min(wetFilm,91.);
  }
  gl_FragColor=vec4(light,1.);
 }`,
  })
}
