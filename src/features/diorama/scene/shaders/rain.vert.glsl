uniform float uTime;
uniform float uSpeed;
uniform float uHeight;
uniform float uBottom;
uniform float uLength;
uniform float uSlant;

attribute float aSeed;
attribute float aTail;

varying float vTail;

void main() {
  vec3 drop = position;
  float fall = mod(aSeed - uTime * uSpeed, uHeight);
  drop.y = uBottom + fall + aTail * uLength;
  drop.x += aTail * uSlant;
  vTail = aTail;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(drop, 1.0);
}
