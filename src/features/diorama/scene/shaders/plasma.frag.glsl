uniform float uTime;
uniform float uPower;
uniform float uFocus;
uniform vec3 uTarget;
uniform float uRadius;
uniform vec3 uColor;
uniform vec3 uCore;

varying vec3 vWorld;
varying vec3 vCenter;

#define FILAMENTS 10
#define SEGMENTS 6
#define PI 3.14159265

vec3 safeNormalize(vec3 v) {
  return v / max(length(v), 1e-4);
}

float hash(float n) {
  return fract(sin(n * 12.9898 + 4.1414) * 43758.5453);
}

vec3 tipDirection(float k) {
  float spin = hash(k + 3.0) > 0.5 ? 1.0 : -1.0;
  float phi = hash(k + 1.0) * 2.0 * PI + uTime * (0.15 + 0.35 * hash(k + 7.0)) * spin;
  float cosTheta = mix(-0.45, 0.95, hash(k + 13.0)) + 0.12 * sin(uTime * 0.7 + k * 2.3);
  cosTheta = clamp(cosTheta, -0.95, 0.98);
  float sinTheta = sqrt(max(1.0 - cosTheta * cosTheta, 0.0));
  vec3 free = vec3(sinTheta * cos(phi), cosTheta, sinTheta * sin(phi));
  float pull = uFocus * mix(0.8, 0.97, hash(k + 21.0));
  return safeNormalize(mix(free, uTarget, pull));
}

vec3 filamentPoint(float k, vec3 tip, float t) {
  float bend = sin(PI * t) * (0.16 - 0.07 * uFocus);
  vec3 wobble = vec3(
    sin(t * 6.1 + uTime * 2.3 + k * 1.7),
    sin(t * 5.3 - uTime * 1.9 + k * 2.9),
    sin(t * 7.2 + uTime * 2.7 + k * 0.6)
  );
  float reach = mix(0.17, 1.0, t);
  return vCenter + (tip * reach + wobble * bend) * uRadius;
}

float rayDistance(vec3 ro, vec3 rd, vec3 a, vec3 b) {
  vec3 ba = b - a;
  vec3 oa = ro - a;
  float baba = dot(ba, ba);
  float rdba = dot(rd, ba);
  float oard = dot(oa, rd);
  float oaba = dot(oa, ba);
  float t = clamp((oaba - oard * rdba) / max(baba - rdba * rdba, 1e-6), 0.0, 1.0);
  float s = max(t * rdba - oard, 0.0);
  return length(oa + rd * s - ba * t);
}

float pointDistance(vec3 ro, vec3 rd, vec3 p) {
  return length(cross(rd, p - ro));
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = safeNormalize(vWorld - ro);
  float width = max(uRadius * 0.035, 1e-5);
  float core = 0.0;
  float halo = 0.0;
  float tips = 0.0;
  for (int i = 0; i < FILAMENTS; i++) {
    float k = float(i);
    vec3 tip = tipDirection(k);
    vec3 previous = filamentPoint(k, tip, 0.0);
    float nearest = 1e3;
    for (int j = 1; j <= SEGMENTS; j++) {
      vec3 next = filamentPoint(k, tip, float(j) / float(SEGMENTS));
      nearest = min(nearest, rayDistance(ro, rd, previous, next));
      previous = next;
    }
    float flicker = 0.7 + 0.3 * sin(uTime * (9.0 + k) + k * 4.0);
    float d = nearest / width;
    core += flicker * exp(-d * d);
    halo += flicker * exp(-d * d * 0.06);
    float e = pointDistance(ro, rd, previous) / (width * 2.5);
    tips += exp(-e * e);
  }
  float center = pointDistance(ro, rd, vCenter) / max(uRadius * 0.3, 1e-5);
  float glow = exp(-center * center);
  float chord = sqrt(max(1.0 - pow(clamp(center * 0.3, 0.0, 1.0), 2.0), 0.0));
  float boost = 1.0 + 0.6 * uFocus;
  vec3 color = uColor * (halo * 0.22 + core * 0.8 + glow * 0.6 + chord * 0.08) * boost;
  color += uCore * (core * core * 0.35 + glow * 0.9 + tips * 0.5) * boost;
  gl_FragColor = vec4(color * uPower, 1.0);
}
