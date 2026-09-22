varying vec3 vWorld;
varying vec3 vNormal;
varying float vSeed;

void main() {
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(instanceMatrix) * normal);
  vSeed = float(gl_InstanceID);
  gl_Position = projectionMatrix * viewMatrix * world;
}
