uniform vec3 uColor;
uniform float uOpacity;

varying float vAlpha;

void main() {
  float radius = length(gl_PointCoord - 0.5) * 2.0;
  float soft = 1.0 - smoothstep(0.0, 1.0, radius);
  gl_FragColor = vec4(uColor, soft * soft * vAlpha * uOpacity);
}
