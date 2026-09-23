uniform float uTime;
uniform float uRate;
uniform float uSize;
uniform float uJitter;

attribute vec2 aCorner;
attribute float aSeed;

varying vec2 vCorner;
varying float vLife;

float hash(float n) {
  return fract(sin(n) * 43758.5453);
}

void main() {
  float cycle = uTime * uRate + aSeed;
  float life = fract(cycle);
  float turn = floor(cycle);
  vec3 center = position;
  center.x += (hash(aSeed * 91.7 + turn) - 0.5) * uJitter;
  center.z += (hash(aSeed * 37.3 + turn * 1.7) - 0.5) * uJitter;
  vec3 corner = center + vec3(aCorner.x, 0.0, aCorner.y) * uSize * (0.15 + life);
  vCorner = aCorner;
  vLife = life;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(corner, 1.0);
}
