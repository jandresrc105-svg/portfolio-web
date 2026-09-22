varying vec3 vDirection;

void main() {
  vDirection = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
  gl_Position.z = gl_Position.w;
}
