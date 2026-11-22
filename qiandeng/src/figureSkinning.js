// The town's two lighting paths deform both position and shading normal before
// sampling the roofs' shadow atlas or the nearby lanterns' light field.
export const figureSkinning = `
#ifdef USE_MORPHTARGETS
 vec3 transformed = pos.xyz;
 vec3 objectNormal = norm;
 #include <morphtarget_vertex>
 #include <morphnormal_vertex>
 pos.xyz = transformed;
 norm = objectNormal;
#endif
#ifdef USE_SKINNING
 #include <skinbase_vertex>
 mat4 skin = bindMatrixInverse * (skinWeight.x * boneMatX + skinWeight.y * boneMatY +
                                  skinWeight.z * boneMatZ + skinWeight.w * boneMatW) * bindMatrix;
 pos = skin * pos;
 norm = mat3(skin) * norm;
#endif
`
