// Reproject a reflected ray through a measured depth from the preceding mirror
// lens. The eye and the water contact point are in that lens's oblique clip
// space. Intersecting the ray with its previous depth gives the new lookup.
export const mirrorParallax = `
uniform highp sampler2D mirrorDepth;uniform mat4 mirrorClip;
uniform vec4 reflectedEye;uniform float moveMirror;
vec2 mirrorUV(vec2 uv,vec3 contact){
 if(moveMirror<.5)return uv;
 uv=clamp(uv,.002,.998);
 vec4 at=mirrorClip*vec4(contact,1.);
 at.xy=(uv*2.-1.)*at.w;
 vec4 ray=at-reflectedEye;
 vec2 q=uv;
 for(int i=0;i<2;i++){
   float z=2.*texture2D(mirrorDepth,q).r-1.;
   vec4 hit=reflectedEye*(ray.z-z*ray.w)+ray*(z*reflectedEye.w-reflectedEye.z);
   if(abs(hit.w)<1.e-8)break;
   q=clamp(.5+.5*hit.xy/hit.w,.002,.998);
 }
 return q;
}`
