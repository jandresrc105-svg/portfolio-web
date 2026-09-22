uniform float uHeight;

varying float vAlong;
varying float vFacing;

void main() {
  vAlong = 1.0 + position.y / uHeight;
  vec3 viewNormal = normalize(normalMatrix * normal);
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vFacing = abs(dot(viewNormal, normalize(-viewPosition.xyz)));
  gl_Position = projectionMatrix * viewPosition;
}
