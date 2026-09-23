uniform vec3 uColor;
uniform float uOpacity;

varying vec2 vCorner;
varying float vLife;

void main() {
  float radius = length(vCorner);
  float outer = 1.0 - smoothstep(0.0, 0.14, abs(radius - 0.85));
  float inner = 1.0 - smoothstep(0.0, 0.12, abs(radius - 0.45));
  float fade = (1.0 - vLife) * (1.0 - vLife);
  float ring = outer + inner * 0.5 * (1.0 - vLife);
  gl_FragColor = vec4(uColor * ring * fade * uOpacity, 1.0);
}
