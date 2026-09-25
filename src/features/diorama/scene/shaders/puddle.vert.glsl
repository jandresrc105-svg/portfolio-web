uniform mat4 textureMatrix;

attribute vec2 aLocal;
attribute float aSeed;

varying vec4 vReflect;
varying vec2 vLocal;
varying float vSeed;
varying vec3 vWorld;

void main() {
  vLocal = aLocal;
  vSeed = aSeed;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vReflect = textureMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
}
