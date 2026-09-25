uniform vec3 uHaze;
uniform vec3 uGlow;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform float uWindowGlow;
uniform float uFlash;

varying vec3 vWorld;
varying vec3 vNormal;
varying float vSeed;

float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec3 normal = normalize(vNormal);
  float along = abs(normal.x) > 0.5 ? vWorld.z : vWorld.x;
  vec2 grid = vec2(along * 1.1, vWorld.y * 1.45);
  vec2 cell = floor(grid);
  vec2 local = fract(grid);

  float window = step(0.22, local.x) * step(local.x, 0.78) * step(0.28, local.y) * step(local.y, 0.82);
  float lit = step(0.7, hash(cell + vSeed * 7.13));
  float roof = step(0.5, normal.y);
  vec3 tint = mix(uCool, uWarm, step(0.38, hash(cell * 1.7 + vSeed)));
  float dim = 0.45 + 0.55 * hash(cell * 3.1 + vSeed * 0.37);

  vec3 wall = vec3(0.011, 0.011, 0.02) + uFlash * vec3(0.05, 0.055, 0.08);
  vec3 color = wall + tint * window * lit * dim * (1.0 - roof) * uWindowGlow;

  float distance = length(vWorld.xz);
  float haze = smoothstep(40.0, 120.0, distance);
  float depth = 1.0 - smoothstep(-55.0, -12.0, vWorld.y);
  color = mix(color, uHaze + uGlow * 0.35, clamp(haze * 0.8 + depth * 0.65, 0.0, 0.92));
  gl_FragColor = vec4(color, 1.0);
}
