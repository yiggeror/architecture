import { lanternField, nightAir, sunAtlas } from './cityLightField.js'
import { figureSkinning } from './figureSkinning.js'
// During software-rendered flight the same irradiance volume and sun atlas
// shade vertices. Paper patterns, engraved signs and wet reflections stay live.
export const swiftVertex = `
precision highp sampler3D;
#include <skinning_pars_vertex>
#include <morphtarget_pars_vertex>
${lanternField}
${nightAir}
${sunAtlas}
uniform sampler2D occTex;
uniform vec4 movePlace[10],moveHue[10];uniform vec3 sunDir,fogHue;uniform mat4 waterMatrix,lightMatrix;uniform float day,rough,metal,skinWrap,groundReflection;
varying vec3 tint,irradiance,highlight;varying vec2 uvMain;varying vec4 projected;varying float damp,mist;
#ifdef FIGURE_RELIEF
varying vec3 figurePoint,figureNormal,incidentDir;
#endif
void main(){
 vec4 pos=vec4(position,1.);vec3 norm=normal;tint=color;
 ${figureSkinning}
 #ifdef USE_INSTANCING
  pos=instanceMatrix*pos;mat3 im=mat3(instanceMatrix);
  norm=im*(norm/max(vec3(.0000001),vec3(dot(im[0],im[0]),dot(im[1],im[1]),dot(im[2],im[2]))));
 #endif
 #ifdef USE_INSTANCING_COLOR
  tint*=instanceColor;
 #endif
 vec3 p=(modelMatrix*pos).xyz,eye=normalize(cameraPosition-p);
 vec3 n=mat3(modelMatrix)*norm;n=dot(n,n)>1.e-12?normalize(n):vec3(0.,1.,0.);if(dot(n,eye)<0.)n=-n;
 vec3 L,det;lanternFieldAt(p,L,det);float len=length(det);vec3 lightDir=det/max(.001,len);
 #ifdef FIGURE_RELIEF
  figurePoint=p;figureNormal=n;incidentDir=mix(lightDir,sunDir,day);
 #endif
 float weight=mix(.75,.27+.97*max(0.,dot(n,lightDir)),min(1.,len));
 L*=weight;L/=1.+.145*max(L.r,max(L.g,L.b));
 vec3 lampGlint=vec3(0.);
 for(int j=0;j<6;j++){int i=j<4?j:j+4;if(j>=4&&moveHue[i].w==0.)continue;
  vec3 delta=movePlace[i].xyz-p;float d=dot(delta,delta),fall=max(0.,1.-d*movePlace[i].w);
  vec3 direction=delta*inversesqrt(d+.01),radiance=moveHue[i].rgb*(fall*fall/(2.+d));
  L+=radiance*(.25+.95*max(0.,dot(n,direction)));
  if(j>=4)lampGlint+=radiance*pow(max(dot(n,normalize(direction+eye)),0.),mix(68.,10.,rough));}
 vec3 sc=(lightMatrix*vec4(p,1.)).xyz*.5+.5;
 float sh=edgeDepth(sc)<.003?farShadow(p,n,sunDir):step(sc.z-.00052-.00112*(1.-abs(dot(n,sunDir))),texture2D(occTex,sc.xy).r);
 float up=n.y*.5+.5;vec3 amb=skyFill(up,day),sun=keyColor(day);
 irradiance=amb+sun*max(0.,(dot(n,sunDir)+skinWrap)/(1.+skinWrap))*sh+L*mix(1.43,.018,day);
 float spec=pow(max(dot(n,normalize(sunDir+eye)),0.),mix(80.,8.,rough));
 highlight=sun*spec*sh*(.13+.39*metal)*(1.-rough)+lampGlint*(1.-rough)*mix(1.1,.03,day);
 damp=groundReflection*smoothstep(.84,.995,n.y)*(1.-smoothstep(1.8,3.2,p.y))*(1.-smoothstep(.63,.84,rough))*smoothstep(-.1,.30,p.y)*(.12+pow(1.-clamp(dot(eye,n),0.,1.),2.)*.76);
 projected=waterMatrix*vec4(p.x,-p.z+11.,0.,1.);uvMain=uv;
 mist=riverDistanceMist(length(p-cameraPosition),cameraPosition.y,day);
 gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}`
export const swiftFragment = `
uniform sampler2D paint,glowMap,mirrorMap;uniform vec3 pigment,emission,fogHue;uniform float day,cutoff,mapRepeatX,mapRepeatY,waterValid,opacity;
uniform vec2 uvOffset;varying vec3 tint,irradiance,highlight;varying vec2 uvMain;varying vec4 projected;varying float damp,mist;
#ifdef FIGURE_RELIEF
varying vec3 figurePoint,figureNormal,incidentDir;
uniform sampler2D reliefMap;uniform float relief,rough;
#ifdef FIGURE_ROUGHNESS
uniform sampler2D grainGloss;
#endif
#endif
void main(){vec2 uv=uvMain*vec2(mapRepeatX,mapRepeatY)+uvOffset;vec4 tx=texture2D(paint,uv);if(tx.a<cutoff)discard;
 vec3 light=irradiance,glint=highlight;
 #ifdef FIGURE_RELIEF
  vec3 n=normalize(figureNormal),dx=dFdx(figurePoint),dy=dFdy(figurePoint);
  vec2 ux=dFdx(uv),uy=dFdy(uv),bump=(texture2D(reliefMap,uv).xy*2.-1.)*relief;
  vec3 ax=cross(dy,n)*ux.x+cross(n,dx)*uy.x,ay=cross(dy,n)*ux.y+cross(n,dx)*uy.y;
  vec3 weave=normalize(n+(ax*bump.x+ay*bump.y)*inversesqrt(max(1.e-12,max(dot(ax,ax),dot(ay,ay)))));
  vec3 key=incidentDir/max(.001,length(incidentDir));
  light*=1.+.67*(dot(weave,key)-dot(n,key));
  float r=rough;
  #ifdef FIGURE_ROUGHNESS
   r*=texture2D(grainGloss,uv).g;
  #endif
  vec3 halfway=normalize(key+normalize(cameraPosition-figurePoint));
  float spec=pow(max(dot(weave,halfway),0.),mix(84.,8.,r))*(1.-r);
  glint+=light*.115*spec;
 #endif
 vec3 c=tx.rgb*tint*pigment*light+glint+texture2D(glowMap,uv).rgb*emission*tint*mix(1.30,.026,day);
 if(damp>.001&&waterValid>.5){vec2 q=projected.xy/projected.w;c=mix(c,texture2D(mirrorMap,clamp(q,.002,.998)).rgb,damp*mix(.42,.12,day));}
 gl_FragColor=vec4(mix(c,fogHue,mist),tx.a*opacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`
