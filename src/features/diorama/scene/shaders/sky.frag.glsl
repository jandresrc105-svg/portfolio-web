uniform float uTime;
uniform float uFlash;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uFlashColor;

varying vec3 vDirection;

float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  vec2 blend = local * local * (3.0 - 2.0 * local);
  float bottom = mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x);
  float top = mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), blend.x);
  return mix(bottom, top, blend.y);
}

float fbm(vec2 point) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 4; octave++) {
    value += amplitude * noise(point);
    point *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec3 direction = normalize(vDirection);
  float height = direction.y;

  vec3 sky = mix(uHorizon, uZenith, smoothstep(-0.02, 0.55, height));
  float cityGlow = exp(-abs(height + 0.06) * 6.5);
  sky += uGlow * cityGlow;
  sky = mix(sky, uHorizon * 0.6 + uGlow * 0.45, 1.0 - smoothstep(-0.5, 0.0, height));

  vec2 cloudPlane = direction.xz / max(height + 0.32, 0.08) * 1.35;
  float density = fbm(cloudPlane + vec2(uTime * 0.014, uTime * 0.007));
  float clouds = smoothstep(0.42, 0.82, density) * smoothstep(-0.04, 0.22, height);
  vec3 cloudColor = mix(uHorizon * 1.7, uGlow * 1.25, cityGlow * 0.9 + 0.1);
  sky = mix(sky, cloudColor, clouds * 0.8);

  sky += uFlashColor * uFlash * (0.25 + clouds * 1.4);
  gl_FragColor = vec4(sky, 1.0);
}
