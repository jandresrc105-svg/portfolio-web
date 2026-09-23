uniform vec3 color;
uniform float uTime;
uniform vec3 uBase;
uniform vec3 uSky;
uniform float uOpacity;
#ifdef USE_REFLECTION
uniform sampler2D tDiffuse;
#endif

varying vec4 vReflect;
varying vec2 vLocal;
varying float vSeed;
varying vec3 vWorld;

const float RIPPLE_SCALE = 2.6;
const float RIPPLE_RATE = 0.75;
const float RIPPLE_REACH = 0.9;
const float RIPPLE_FREQ = 26.0;
const float DISTORTION = 0.008;
const float PI = 3.14159265;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x);
  float b = mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x);
  return mix(a, b, u.y);
}

vec2 ripples(vec2 p) {
  vec2 flow = vec2(0.0);
  vec2 cell = floor(p);
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      vec2 id = cell + vec2(float(i), float(j));
      vec2 center = id + vec2(hash(id), hash(id + 17.3));
      float phase = fract(uTime * RIPPLE_RATE + hash(id + 3.7));
      vec2 offset = p - center;
      float dist = length(offset);
      float x = (dist - phase * RIPPLE_REACH) * RIPPLE_FREQ;
      float wave = sin(x) * (1.0 - smoothstep(0.0, PI, abs(x)));
      float fade = (1.0 - phase) * (1.0 - phase);
      flow += offset / max(dist, 0.001) * wave * fade;
    }
  }
  return flow;
}

void main() {
  float edge = length(vLocal) + (noise(vLocal * 2.4 + vSeed * 7.0) - 0.5) * 0.5;
  float mask = 1.0 - smoothstep(0.5, 0.92, edge);
  if (mask < 0.01) {
    discard;
  }
  vec2 wind = vec2(noise(vWorld.xz * 3.0 + uTime * 0.4), noise(vWorld.zx * 3.0 - uTime * 0.3)) - 0.5;
  vec2 flow = ripples(vWorld.xz * RIPPLE_SCALE) + wind * 0.2;
  vec3 view = normalize(cameraPosition - vWorld);
  float fresnel = 0.45 + 0.55 * pow(clamp(1.0 - view.y, 0.0, 1.0), 3.0);
  vec3 reflection = uSky;
#ifdef USE_REFLECTION
  vec2 uv = vReflect.xy / max(vReflect.w, 0.0001) + flow * DISTORTION;
  reflection += texture2D(tDiffuse, uv).rgb * color;
#endif
  float sparkle = clamp(length(flow), 0.0, 1.0);
  vec3 surface = mix(uBase, reflection, fresnel) + uSky * sparkle * 0.8;
  float rim = smoothstep(0.35, 0.85, edge) * 0.35;
  gl_FragColor = vec4(surface * (1.0 - rim), mask * uOpacity);
  #include <colorspace_fragment>
}
