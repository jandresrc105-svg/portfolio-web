uniform vec3 uColor;
uniform float uOpacity;

varying float vTail;

void main() {
  gl_FragColor = vec4(uColor, uOpacity * (1.0 - vTail * 0.85));
}
