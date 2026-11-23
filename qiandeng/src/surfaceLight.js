import { mirrorParallax } from './mirrorParallax.js'
import { lanternField, nightAir, sunAtlas } from './cityLightField.js'

export const surfaceInputs = ` vec3 n=normalize(wn);if(!gl_FrontFacing)n=-n;
 vec2 uv=st*vec2(mapRepeatX,mapRepeatY)+uvOffset;vec4 tex=vec4(1.);
 #ifdef PAINTED
 tex=texture2D(paint,uv);
 #endif
 #ifdef CUTOUT
 if(tex.a<cutoff)discard;
 #endif
 #ifdef RELIEF
 {
   vec3 dx=dFdx(wp),dy=dFdy(wp);vec2 ux=dFdx(uv),uy=dFdy(uv);
   vec3 ax=cross(dy,n)*ux.x+cross(n,dx)*uy.x,ay=cross(dy,n)*ux.y+cross(n,dx)*uy.y;
   vec2 bump=(texture2D(reliefMap,uv).xy*2.-1.)*relief;
   n=normalize(n+(ax*bump.x+ay*bump.y)*inversesqrt(max(max(dot(ax,ax),dot(ay,ay)),1.e-12)));
 }
 #endif
 vec3 base=pigment*surfaceColor*tex.rgb;
 float surfaceRoughness=rough;
 #ifdef FIGURE_ROUGHNESS
  surfaceRoughness*=texture2D(grainGloss,uv).g;
 #endif
 vec3 emit=emission*surfaceColor;
 #ifdef GLOW_MAP
 emit*=texture2D(glowMap,uv).rgb;
 #endif
 float wetMask=0.;
 #ifdef WET
  #ifdef PAINTED
  if(wp.y>-.1 && wp.y<3.2)wetMask=smoothstep(.22,.77,sin(wp.x*3.57+sin(wp.z*2.71))*.12+tex.r);
  #else
  wetMask=1.;
  #endif
 #endif
`

export const surfaceLight = `
${mirrorParallax}
${lanternField}
${nightAir}
${sunAtlas}
uniform sampler2D occTex,mirrorMap;uniform vec3 sunDir,fogHue;
uniform vec4 movePlace[10],moveHue[10];uniform vec3 movingLow[3],movingHigh[3];
uniform mat4 waterMatrix;uniform float day,shadowTexel,waterValid;
vec3 practical(vec3 n, vec3 eye, float surfaceRoughness, out vec3 gloss){
 vec3 light,dir;lanternFieldAt(wp,light,dir);
 float agreement=min(1.,length(dir));dir/=max(.001,agreement);
 float direct=mix(.75,.27+.97*max(0.,dot(n,dir)),agreement);
 vec3 lighting=direct*light;
 gloss=light*pow(max(dot(n,normalize(dir+eye)),0.),mix(62.,9.,surfaceRoughness))*.54*agreement;
 // The upstream procession, outer ferries and handheld lamps occupy three
 // separate volumes. Roofs outside one never need to sample any lamp in it.
 for(int group=0;group<3;group++){
   if(any(lessThan(wp,movingLow[group]))||any(greaterThan(wp,movingHigh[group])))continue;
   for(int lane=0;lane<4;lane++){
     int i=group*4+lane;if(i>=10)break;
     vec3 delta=movePlace[i].xyz-wp;float d2=dot(delta,delta);
     if(d2*movePlace[i].w>1.)continue;
     float fall=max(1.-d2*movePlace[i].w,0.);vec3 l=moveHue[i].rgb*(fall*fall/(2.+d2));
     vec3 d=delta*inversesqrt(d2+.0001);
     lighting+=l*(.25+.98*max(dot(n,d),0.));gloss+=l*pow(max(dot(n,normalize(d+eye)),0.),mix(65.,10.,surfaceRoughness))*.8;
   }
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
vec3 lightSurface(vec3 n,vec3 base,vec3 emit,float surfaceRoughness,float metal,float skinWrap,float wetMask){
 vec3 eye=normalize(cameraPosition-wp),gloss;
 float up=n.y*.5+.5,sha=sunlight(n),dotL=max(0.,(dot(n,sunDir)+skinWrap)/(1.+skinWrap));
 vec3 lam=practical(n,eye,surfaceRoughness,gloss);
 lam/=1.+.145*max(lam.r,max(lam.g,lam.b));
 vec3 ambience=skyFill(up,day),key=keyColor(day);
 vec3 color=base*(ambience+dotL*sha*key+lam*mix(1.43,.018,day));
 float sheen=pow(max(dot(n,normalize(eye+sunDir)),0.),mix(91.,5.,surfaceRoughness));
 color+=key*sha*sheen*(.12+.39*metal)*(1.-surfaceRoughness);
 color+=gloss*(1.27-surfaceRoughness)*mix(1.48,.045,day);
 color+=emit*mix(1.30,.026,day);
 // Wet sett joints break up the painted reflection and keep the dry grain in sheltered wood.
 float levelness=smoothstep(.81,.995,n.y);float low=1.-smoothstep(1.8,3.2,wp.y);
 float slick=wetMask*levelness*low*(1.-smoothstep(.63,.84,surfaceRoughness))*smoothstep(-.1,.30,wp.y);
 if(waterValid>.5 && slick>.001){
    vec4 proj=waterMatrix*vec4(wp.x,-wp.z+11.,0.,1.);
    vec2 q=proj.xy/proj.w;
    float facing=.14+pow(1.-clamp(dot(eye,n),0.,1.),2.)*.82;
    vec2 jitter=vec2(sin(wp.z*29.7+wp.x*6.),cos(wp.x*18.7-wp.z*6.7))*.0013;
    vec3 refl=texture2D(mirrorMap,mirrorUV(clamp(q+jitter,.001,.999),vec3(wp.x,0.,wp.z))).rgb;
    color=mix(color,refl,slick*facing*mix(.51,.16,day));
 }
 float mist=riverDistanceMist(length(wp-cameraPosition),cameraPosition.y,day);
 color=mix(color,fogHue,mist);
 if(any(isnan(color))||any(isinf(color)))color=base*(ambience+dotL*sha*key)+emit*mix(1.,.026,day);
 return min(color,vec3(48.));
}`
