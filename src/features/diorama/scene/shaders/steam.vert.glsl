uniform float uTime;
uniform float uSpeed;
uniform float uHeight;
uniform float uSpread;
uniform float uSize;
uniform float uViewport;

attribute float aSeed;

varying float vAlpha;

const float TAU = 6.2831853;

void main() {
  float life = fract(uTime * uSpeed + aSeed);
  float angle = aSeed * TAU * 7.0;
  float curl = sin(uTime * 1.3 + aSeed * 12.0) * uSpread * life;
  float drift = cos(uTime * 0.9 + aSeed * 9.0) * uSpread * life * 0.6;
  vec3 offset = vec3(cos(angle) * uSpread * 0.35 + curl, life * uHeight, sin(angle) * uSpread * 0.35 + drift);
  vec4 view = modelViewMatrix * vec4(position + offset, 1.0);
  float grow = 0.35 + life * 1.1;
  gl_PointSize = uSize * grow * uViewport * projectionMatrix[1][1] * 0.5 / max(-view.z, 0.1);
  vAlpha = sin(life * 3.14159265);
  gl_Position = projectionMatrix * view;
}
