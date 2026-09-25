uniform vec3 uColor;
uniform float uIntensity;

varying float vAlong;
varying float vFacing;

void main() {
  float fall = pow(clamp(vAlong, 0.0, 1.0), 1.8);
  float soft = pow(clamp(vFacing, 0.0, 1.0), 2.0);
  gl_FragColor = vec4(uColor * fall * soft * uIntensity, 1.0);
}
