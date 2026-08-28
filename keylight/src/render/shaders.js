/**
 * Keylight - the render shader.
 *
 * This is the same maths as src/physics, executed per fragment. Nothing is
 * re-derived or approximated differently here: the shader accumulates
 * luminance-times-time in cd*s/m2 exactly as the headless model does, then
 * applies the one normalisation identity at the end.
 *
 *     R = Lt * ISO / (12.5 * N^2)
 *
 * Shutter multiplies the ambient terms and appears nowhere near the flash
 * terms. That is the whole lesson, and it lives in the code as an absence.
 *
 * Shadows are ray-traced against the scene's occluder boxes rather than
 * shadow-mapped. With one jittered sample per pass and progressive
 * accumulation, penumbra width comes out of the real source diameter, so a
 * bounced head genuinely softens instead of being told to look soft.
 */

export const MAX_WINDOWS = 3;
export const MAX_FIXTURES = 10;
export const MAX_FLASH = 4;
export const MAX_OCCLUDERS = 36;

export const commonVertexShader = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUv;
flat out int vMatId;

in float aMatId;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  vMatId = int(aMatId + 0.5);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const roomFragmentShader = /* glsl */ `
precision highp int;

in vec3 vWorld;
in vec3 vNormal;
in vec2 vUv;
flat in int vMatId;
out vec4 fragColor;

#define MAX_WINDOWS ${MAX_WINDOWS}
#define MAX_FIXTURES ${MAX_FIXTURES}
#define MAX_FLASH ${MAX_FLASH}
#define MAX_OCCLUDERS ${MAX_OCCLUDERS}
#define MAX_MATERIALS 24
#define PI 3.14159265359

/* ---- camera ---- */
uniform float uAperture;      // exact f-number
uniform float uISO;
uniform float uShutter;       // seconds
uniform vec3  uWB;            // white balance gains
uniform float uFlashOn;       // 0 in live preview, 1 in a capture
uniform float uFrame;         // accumulation pass index, for jitter
uniform float uSoftSamples;   // 1 while previewing, higher when capturing

/* ---- materials ---- */
uniform vec3  uAlbedo[MAX_MATERIALS];
uniform float uRoughness[MAX_MATERIALS];
uniform float uSpecular[MAX_MATERIALS];
uniform vec3  uEmissive[MAX_MATERIALS];   // cd/m2, already coloured
uniform float uMirror[MAX_MATERIALS];
uniform float uView[MAX_MATERIALS];       // what is behind the glass
uniform float uTexKind[MAX_MATERIALS];    // procedural material family
uniform float uTexScale[MAX_MATERIALS];
uniform float uTexDir[MAX_MATERIALS];     // 1 rotates the pattern 90 degrees

/* ---- windows: rectangular Lambertian emitters ---- */
uniform int   uWindowCount;
uniform vec3  uWinCenter[MAX_WINDOWS];
uniform vec3  uWinRight[MAX_WINDOWS];     // half-width vector
uniform vec3  uWinUp[MAX_WINDOWS];        // half-height vector
uniform vec3  uWinRadiance[MAX_WINDOWS];  // cd/m2, coloured

/* ---- fixtures: point sources ---- */
uniform int   uFixtureCount;
uniform vec3  uFixPos[MAX_FIXTURES];
uniform vec3  uFixIntensity[MAX_FIXTURES]; // candela, coloured

/* ---- interreflected fill ---- */
uniform vec3  uFillIrradiance;   // lux, from windows and fixtures
uniform vec3  uFlashFill;        // lux-seconds, from the flash bouncing around
uniform vec3  uFillDir;          // dominant direction the daylight arrives from
uniform vec3  uRoomSize;         // (half width, full height, half depth)

/* ---- flash ---- */
uniform int   uFlashCount;
uniform vec3  uFlashPos[MAX_FLASH];
uniform vec3  uFlashDir[MAX_FLASH];
uniform vec3  uFlashCoeff[MAX_FLASH];      // lux-second-metres-squared, coloured
uniform float uFlashRadius[MAX_FLASH];     // source radius in metres
uniform float uFlashConeCos[MAX_FLASH];
uniform float uFlashHemi[MAX_FLASH];

/* ---- occluders: yaw-rotated boxes ---- */
uniform int   uOccluderCount;
uniform vec3  uOccCenter[MAX_OCCLUDERS];
uniform vec3  uOccHalf[MAX_OCCLUDERS];
uniform vec2  uOccRot[MAX_OCCLUDERS];      // (cos yaw, sin yaw)

/* ---- output controls ---- */
uniform float uSyncBandTop;    // 0..1 of frame height covered by the curtain
uniform float uNoiseAmount;
uniform float uClipLinear;
uniform float uNoiseFloorLinear;
uniform float uKneeLinear;
uniform float uZebras;
uniform vec2  uResolution;
uniform sampler2D uMirrorTex;
uniform float uMirrorEnabled;
uniform mat4  uMirrorMatrix;   // view-projection of the reflected camera

/* ------------------------------------------------------------------ */

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

/* Ray against a yaw-rotated box. Returns 1.0 if blocked before tMax. */
float boxBlocks(vec3 ro, vec3 rd, float tMax, vec3 c, vec3 h, vec2 rot) {
  vec3 p = ro - c;
  // rotate into box space (inverse yaw)
  vec3 lo = vec3(p.x * rot.x - p.z * rot.y, p.y, p.x * rot.y + p.z * rot.x);
  vec3 ld = vec3(rd.x * rot.x - rd.z * rot.y, rd.y, rd.x * rot.y + rd.z * rot.x);
  vec3 sgn = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), ld));
  vec3 inv = sgn / max(abs(ld), vec3(1e-6));
  vec3 t0 = (-h - lo) * inv;
  vec3 t1 = ( h - lo) * inv;
  vec3 tn = min(t0, t1);
  vec3 tf = max(t0, t1);
  float tNear = max(max(tn.x, tn.y), tn.z);
  float tFar  = min(min(tf.x, tf.y), tf.z);
  return (tFar >= max(tNear, 0.0018) && tNear < tMax) ? 1.0 : 0.0;
}

float visibility(vec3 from, vec3 to) {
  vec3 d = to - from;
  float dist = length(d);
  if (dist < 1e-4) return 1.0;
  vec3 rd = d / dist;
  float blocked = 0.0;
  for (int i = 0; i < MAX_OCCLUDERS; i++) {
    if (i >= uOccluderCount) break;
    blocked += boxBlocks(from, rd, dist - 0.004, uOccCenter[i], uOccHalf[i], uOccRot[i]);
    if (blocked > 0.5) return 0.0;
  }
  return 1.0;
}

/* Exact projected solid angle of a quad (Lambert's closed form). */
float projectedSolidAngle(vec3 p, vec3 n, vec3 c0, vec3 c1, vec3 c2, vec3 c3) {
  vec3 v0 = normalize(c0 - p);
  vec3 v1 = normalize(c1 - p);
  vec3 v2 = normalize(c2 - p);
  vec3 v3 = normalize(c3 - p);
  float s = 0.0;
  s += acos(clamp(dot(v0, v1), -1.0, 1.0)) * dot(normalize(cross(v0, v1)), n);
  s += acos(clamp(dot(v1, v2), -1.0, 1.0)) * dot(normalize(cross(v1, v2)), n);
  s += acos(clamp(dot(v2, v3), -1.0, 1.0)) * dot(normalize(cross(v2, v3)), n);
  s += acos(clamp(dot(v3, v0), -1.0, 1.0)) * dot(normalize(cross(v3, v0)), n);
  return max(0.0, s * 0.5);
}

/* GGX specular, so polished counters and glass throw real hotspots. */
float ggx(vec3 n, vec3 v, vec3 l, float rough) {
  float a = max(0.012, rough * rough);
  vec3 h = normalize(v + l);
  float ndh = max(dot(n, h), 0.0);
  float ndv = max(dot(n, v), 1e-4);
  float ndl = max(dot(n, l), 1e-4);
  float a2 = a * a;
  float d = ndh * ndh * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * d * d);
  float k = a * 0.5;
  float G = (ndl / (ndl * (1.0 - k) + k)) * (ndv / (ndv * (1.0 - k) + k));
  return D * G / (4.0 * ndv * ndl);
}


/* ================================================================== */
/* Procedural materials                                                */
/*                                                                     */
/* Everything is generated in the shader from world position, so a     */
/* 6000px capture and a phone preview read the same surface. Patterns  */
/* modulate albedo around a mean of one, which keeps the photometry    */
/* the physics computed untouched.                                     */
/* ================================================================== */

float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + 11.17; a *= 0.5; }
  return s;
}

/* Planar coordinates chosen by the dominant normal axis. */
vec2 triUV(vec3 w, vec3 n) {
  vec3 an = abs(n);
  if (an.y >= an.x && an.y >= an.z) return w.xz;
  if (an.x >= an.z) return w.zy;
  return w.xy;
}

/* rgb = albedo multiplier around 1.0, a = height field for the bump. */
vec4 materialTex(vec2 uv, float kind) {
  if (kind < 0.5) return vec4(1.0, 1.0, 1.0, 0.0);

  if (kind < 1.5) {
    // 1: plank flooring. 130mm boards, staggered ends, grain streaks.
    float row = floor(uv.y / 0.13);
    float u2 = uv.x + hash21(vec2(row, 4.7)) * 1.2;
    float board = floor(u2 / 1.35);
    float tint = 0.82 + 0.36 * hash21(vec2(row, board));
    float grain = fbm(vec2(uv.x * 26.0, uv.y * 160.0) + row * 7.0);
    float edgeV = smoothstep(0.0, 0.012, abs(fract(uv.y / 0.13) - 0.5) * -0.13 + 0.065);
    float edgeU = smoothstep(0.0, 0.02, abs(fract(u2 / 1.35) - 0.5) * -1.35 + 0.675);
    float groove = edgeV * edgeU;
    vec3 c = vec3(1.06, 0.99, 0.92) * tint * (0.86 + 0.28 * grain);
    c *= mix(0.55, 1.0, groove);
    return vec4(c, grain * 0.35 + (1.0 - groove) * 0.9);
  }
  if (kind < 2.5) {
    // 2: plaster. Barely-there mottle plus a fine tooth.
    float m = fbm(uv * 2.1);
    float t = vnoise(uv * 34.0);
    return vec4(vec3(0.965 + 0.07 * m), t * 0.16);
  }
  if (kind < 3.5) {
    // 3: marble. Warped sine veining over a bright ground.
    float warp = fbm(uv * 1.4);
    float vein = sin((uv.x * 1.6 + uv.y * 2.3) * 3.0 + warp * 9.0) * 0.5 + 0.5;
    vein = pow(vein, 10.0);
    float fleck = fbm(uv * 9.0);
    vec3 c = mix(vec3(1.05), vec3(0.62, 0.60, 0.60), vein * 0.85);
    c *= 0.97 + 0.06 * fleck;
    return vec4(c, vein * 0.12);
  }
  if (kind < 4.5) {
    // 4: tile with grout. 75mm grid, slight per-tile variance.
    vec2 g = uv / 0.075;
    vec2 id = floor(g);
    vec2 f = abs(fract(g) - 0.5);
    float grout = smoothstep(0.46, 0.492, max(f.x, f.y));
    float tint = 0.94 + 0.12 * hash21(id);
    vec3 c = mix(vec3(tint), vec3(0.62), grout);
    return vec4(c, (1.0 - grout) * 0.5);
  }
  if (kind < 5.5) {
    // 5: woven fabric. Fine crosshatch and broad shading.
    float weave = sin(uv.x * 240.0) * sin(uv.y * 240.0) * 0.5 + 0.5;
    float broad = fbm(uv * 5.0);
    return vec4(vec3(0.93 + 0.10 * broad + 0.05 * weave), weave * 0.22 + broad * 0.25);
  }
  if (kind < 6.5) {
    // 6: rug. Looped pile - coarse clumps over fine stitch.
    float pile = vnoise(uv * 70.0) * 0.5 + vnoise(uv * 16.0) * 0.5;
    return vec4(vec3(0.86 + 0.26 * pile), pile * 0.65);
  }
  if (kind < 7.5) {
    // 7: book spines. Random widths, random cloth colours, a few gaps.
    float u = uv.x;
    float seg = floor(u / 0.031);
    float jitter = hash21(vec2(seg, 9.1));
    seg = floor((u + jitter * 0.012) / 0.031);
    vec3 c = 0.55 + 0.85 * vec3(hash21(vec2(seg, 1.0)), hash21(vec2(seg, 2.0)), hash21(vec2(seg, 3.0)));
    c /= max(0.4, 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b);
    if (hash21(vec2(seg, 5.0)) > 0.93) c *= 0.16;          // a missing book
    float edge = smoothstep(0.0, 0.15, abs(fract(u / 0.031) - 0.5));
    return vec4(c * mix(0.72, 1.0, edge), edge * 0.6);
  }
  if (kind < 8.5) {
    // 8: cabinet-grade wood. Long grain, no plank lines.
    float grain = fbm(vec2(uv.x * 3.0, uv.y * 42.0));
    float band = fbm(vec2(uv.x * 1.2, uv.y * 6.0) + 3.3);
    return vec4(vec3(1.05, 0.99, 0.94) * (0.82 + 0.26 * grain + 0.12 * band), grain * 0.3);
  }
  if (kind < 9.5) {
    // 9: stone. Blotches and a soft strata drift.
    float b = fbm(uv * 2.6);
    float st = fbm(vec2(uv.x * 1.1, uv.y * 5.5) + 8.8);
    return vec4(vec3(0.88 + 0.22 * b + 0.06 * st), b * 0.7);
  }
  if (kind < 10.5) {
    // 10: brushed metal. Tight anisotropic streaking.
    float streak = vnoise(vec2(uv.x * 3.0, uv.y * 340.0));
    return vec4(vec3(0.93 + 0.14 * streak), 0.0);
  }
  // 11: leather. Cellular grain with sheen variation.
  float cell = fbm(uv * 26.0);
  float wear = fbm(uv * 3.4 + 5.5);
  return vec4(vec3(0.90 + 0.14 * cell + 0.08 * wear), cell * 0.4);
}

/* Height field to perturbed normal, via screen-space derivatives. */
vec3 bumpNormal(vec3 N, float h, float amp) {
  vec3 dpx = dFdx(vWorld);
  vec3 dpy = dFdy(vWorld);
  vec3 r1 = cross(dpy, N);
  vec3 r2 = cross(N, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  float l = length(vec2(dFdx(h), dFdy(h)));
  return normalize(abs(det) * N - amp * grad);
}

float bumpAmpFor(float kind) {
  if (kind < 0.5) return 0.0;
  if (kind < 1.5) return 0.010;   // planks
  if (kind < 2.5) return 0.004;   // plaster
  if (kind < 3.5) return 0.003;   // marble
  if (kind < 4.5) return 0.012;   // tile
  if (kind < 5.5) return 0.004;   // fabric
  if (kind < 6.5) return 0.012;   // rug
  if (kind < 7.5) return 0.010;   // books
  if (kind < 8.5) return 0.005;   // wood
  if (kind < 9.5) return 0.012;   // stone
  if (kind < 10.5) return 0.0;    // metal
  return 0.006;                   // leather
}

/* ================================================================== */
/* Ambient occlusion                                                   */
/*                                                                     */
/* Applied only to the interreflected fill. Direct light from windows, */
/* fixtures and flash is already shadow-rayed, so darkening it again   */
/* would be dishonest; but the fill is the closed form of an integral  */
/* over the whole room, and in corners and under furniture most of     */
/* that room is hidden. This term is that hiding.                      */
/* ================================================================== */

float planeFac(float d, vec3 ni, vec3 n) {
  if (dot(n, ni) > 0.9) return 1.0;         // the surface lies on this plane
  return 0.68 + 0.32 * smoothstep(0.0, 1.0, d);
}

float roomOpenness(vec3 p, vec3 n) {
  float o = 1.0;
  o *= planeFac(uRoomSize.x - p.x, vec3(-1.0, 0.0, 0.0), n);
  o *= planeFac(p.x + uRoomSize.x, vec3(1.0, 0.0, 0.0), n);
  o *= planeFac(uRoomSize.y - p.y, vec3(0.0, -1.0, 0.0), n);
  o *= planeFac(p.y, vec3(0.0, 1.0, 0.0), n);
  o *= planeFac(uRoomSize.z - p.z, vec3(0.0, 0.0, -1.0), n);
  o *= planeFac(p.z + uRoomSize.z, vec3(0.0, 0.0, 1.0), n);
  return o;
}

/* Occluder boxes as spheres: contact shadow under and beside furniture. */
float objectOcclusion(vec3 p, vec3 n) {
  float occ = 0.0;
  for (int i = 0; i < MAX_OCCLUDERS; i++) {
    if (i >= uOccluderCount) break;
    vec3 h = uOccHalf[i];
    float r = pow(max(1e-5, h.x * h.y * h.z), 0.3333) * 1.45;
    if (r < 0.08) continue;
    vec3 d = uOccCenter[i] - p;
    float dist2 = dot(d, d);
    float r2 = r * r;
    if (dist2 < r2 * 1.05) continue;        // we are this object
    occ += (r2 / dist2) * clamp(dot(n, d * inversesqrt(dist2)), 0.0, 1.0);
  }
  return clamp(1.0 - 0.62 * occ, 0.28, 1.0);
}

/**
 * What you actually see through the window.
 *
 * Purely cosmetic modulation around a mean of 1.0, so the authored window EV
 * still describes the pane's average luminance. It exists so "retain the
 * window" means retaining visible detail rather than judging a flat rectangle.
 */
vec3 windowView(vec2 uv, float kind) {
  float horizon = 0.40;

  // Sky: warm at the horizon, deepening overhead, with a soft cloud layer
  // and a hazy sun. Values sit around 1.0 so the authored EV still means
  // what it says about the pane's average brightness.
  vec3 zenith = vec3(0.60, 0.85, 1.38);
  vec3 low    = vec3(1.52, 1.46, 1.30);
  float t = smoothstep(horizon, 1.0, uv.y);
  vec3 sky = mix(low, zenith, pow(t, 0.65));
  float cl = fbm(uv * vec2(4.5, 2.2) + 3.7);
  cl = smoothstep(0.52, 0.80, cl);
  sky = mix(sky, vec3(1.72, 1.70, 1.66), cl * 0.55 * smoothstep(horizon, horizon + 0.1, uv.y));
  vec2 sunP = uv - vec2(0.74, 0.88);
  sky += vec3(1.1, 0.9, 0.55) * exp(-dot(sunP * vec2(2.6, 3.4), sunP * vec2(2.6, 3.4)) * 6.0) * 0.8;

  if (kind < 0.5) return vec3(1.0);
  vec3 col = sky;

  if (kind < 1.5) {
    // Foliage: hedge line, overlapping canopies with lit and shadowed
    // masses, a lawn running to the glass.
    float hedgeTop = horizon + 0.02 + 0.05 * fbm(vec2(uv.x * 6.0, 1.3));
    float hedge = smoothstep(hedgeTop + 0.012, hedgeTop - 0.012, uv.y);
    float can = fbm(uv * vec2(3.6, 2.6) + 7.7);
    float canMask = smoothstep(0.44, 0.60, can - max(0.0, uv.y - horizon) * 0.9);
    float lit = fbm(uv * vec2(9.0, 7.0) + 2.2);
    vec3 leaf = mix(vec3(0.12, 0.22, 0.09), vec3(0.52, 0.66, 0.26),
                    smoothstep(0.30, 0.78, lit + (uv.y - horizon) * 0.5));
    col = mix(col, leaf * 1.05, canMask);
    vec3 hedgeC = vec3(0.15, 0.25, 0.11) * (0.75 + 0.5 * fbm(uv * 14.0));
    col = mix(col, hedgeC, hedge * (1.0 - canMask * 0.55));
    float lawn = smoothstep(horizon - 0.02, horizon - 0.30, uv.y);
    vec3 grass = vec3(0.36, 0.45, 0.20) * (0.82 + 0.34 * fbm(uv * vec2(26.0, 7.0)));
    grass *= 0.85 + 0.3 * smoothstep(horizon - 0.4, horizon, uv.y);   // sheen towards the horizon
    col = mix(col, grass, lawn);
  } else if (kind < 2.5) {
    // Open sky over low hills.
    float hillTop = horizon + 0.015 + 0.03 * fbm(vec2(uv.x * 3.0, 8.0));
    float hill = smoothstep(hillTop + 0.01, hillTop - 0.01, uv.y);
    col = mix(col, vec3(0.42, 0.48, 0.40) * (0.8 + 0.3 * fbm(uv * 9.0)), hill);
  } else if (kind < 3.5) {
    // City at dusk. Two ranks of towers, sparse warm windows, a band of
    // sodium glow at street level. Window colour is pushed hard towards
    // amber because the pane's own blue-hour tint will pull everything the
    // other way before it reaches the sensor.
    float colId = floor(uv.x * 6.0);
    float farId = floor(uv.x * 11.0 + 3.0);
    float bhFar = horizon + 0.02 + 0.16 * hash21(vec2(farId, 8.2));
    float bhNear = horizon - 0.02 + 0.34 * hash21(vec2(colId, 3.7));
    float massFar = step(uv.y, bhFar);
    float massNear = step(uv.y, bhNear);
    col = mix(col, vec3(0.10, 0.11, 0.17), massFar);            // distant rank, hazy
    vec3 tower = vec3(0.030, 0.036, 0.058) * (0.7 + 0.5 * hash21(vec2(colId, 9.0)));
    vec2 wgrid = floor(uv * vec2(30.0, 22.0));
    vec2 wc = fract(uv * vec2(30.0, 22.0));
    float pane2 = step(0.25, wc.x) * step(wc.x, 0.75) * step(0.3, wc.y) * step(wc.y, 0.8);
    float litW = step(0.68, hash21(wgrid + colId)) * pane2;
    vec3 winC = vec3(5.5, 3.1, 1.1) * (0.6 + 0.8 * hash21(wgrid + 4.2));
    vec3 city = tower + winC * litW * step(uv.y, bhNear - 0.015);
    float glow = smoothstep(horizon + 0.10, horizon - 0.04, uv.y);
    city += vec3(0.85, 0.42, 0.16) * glow * 0.45;
    col = mix(col, city, massNear);
    col = mix(col, col + vec3(0.30, 0.13, 0.05),
              smoothstep(horizon + 0.18, horizon, uv.y) * (1.0 - massNear) * 0.8);
  } else {
    // Enclosed courtyard: a rendered wall opposite, planting at its foot.
    col = mix(col, vec3(0.55, 0.53, 0.49) * (0.9 + 0.2 * fbm(uv * 8.0)), smoothstep(0.92, 0.3, uv.y));
    float pl = smoothstep(horizon - 0.05, horizon - 0.3, uv.y);
    col = mix(col, vec3(0.2, 0.3, 0.14) * (0.8 + 0.4 * fbm(uv * 18.0)), pl);
  }

  // Atmospheric depth right at the horizon line.
  col = mix(col, low * 0.9, smoothstep(0.14, 0.0, abs(uv.y - horizon)) * 0.25);

  // Glazing bars. The gentle gradient across each lite is what makes the
  // pane read as glass rather than as a backdrop.
  vec2 lite = fract(uv * vec2(3.0, 2.0));
  float mull = min(
    smoothstep(0.006, 0.03, min(lite.x, 1.0 - lite.x) * 0.333),
    smoothstep(0.008, 0.04, min(lite.y, 1.0 - lite.y) * 0.5));
  col *= mix(0.18, 1.0, mull);
  col *= 0.94 + 0.12 * lite.y * lite.x;   // faint reflection gradient per lite

  return col;
}

/* Orthonormal basis around n. */
void basis(vec3 n, out vec3 t, out vec3 b) {
  vec3 up = abs(n.y) < 0.94 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  t = normalize(cross(up, n));
  b = cross(n, t);
}

void main() {
  int m = clamp(vMatId, 0, MAX_MATERIALS - 1);
  vec3 albedo = uAlbedo[m];
  float rough = uRoughness[m];
  float spec  = uSpecular[m];
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.0 && uMirror[m] < 0.5) N = -N;

  // Procedural surface. Computed unconditionally so the derivative-based
  // bump stays defined across material seams within a warp.
  float texKind = uTexKind[m];
  vec2 tuv = triUV(vWorld, N) * uTexScale[m];
  if (uTexDir[m] > 0.5) tuv = tuv.yx;
  vec4 texel = materialTex(tuv, texKind);
  albedo = clamp(albedo * texel.rgb, 0.0, 0.97);
  float bAmp = bumpAmpFor(texKind);
  if (bAmp > 0.0) N = bumpNormal(N, texel.a, bAmp);

  vec3 seed = vec3(gl_FragCoord.xy, uFrame * 7.13 + 0.5);
  float r1 = hash13(seed);
  float r2 = hash13(seed.yxz + 19.7);

  /* ================= ambient (scales with shutter) ================= */
  vec3 Lt = vec3(0.0);

  // Windows, as real area emitters.
  for (int i = 0; i < MAX_WINDOWS; i++) {
    if (i >= uWindowCount) break;
    vec3 c = uWinCenter[i], R = uWinRight[i], U = uWinUp[i];
    vec3 c0 = c - R - U, c1 = c + R - U, c2 = c + R + U, c3 = c - R + U;
    float omega = projectedSolidAngle(vWorld, N, c0, c1, c2, c3);
    if (omega <= 0.0) continue;
    // One jittered shadow ray per pass; accumulation resolves the penumbra.
    vec3 sp = c + R * (r1 * 2.0 - 1.0) + U * (r2 * 2.0 - 1.0);
    float vis = visibility(vWorld, sp);
    vec3 E = uWinRadiance[i] * omega * vis;
    Lt += (albedo / PI) * E * uShutter;
    if (spec > 0.001) {
      vec3 L = normalize(sp - vWorld);
      Lt += spec * ggx(N, V, L, rough) * uWinRadiance[i] * omega * vis * uShutter;
    }
  }

  // Fixtures, as point sources.
  for (int i = 0; i < MAX_FIXTURES; i++) {
    if (i >= uFixtureCount) break;
    vec3 d = uFixPos[i] - vWorld;
    float dist2 = max(0.02, dot(d, d));
    vec3 L = d * inversesqrt(dist2);
    float ndl = max(dot(N, L), 0.0);
    if (ndl <= 0.0) continue;
    float vis = visibility(vWorld, uFixPos[i]);
    vec3 E = uFixIntensity[i] * ndl * vis / dist2;
    Lt += (albedo / PI) * E * uShutter;
    if (spec > 0.001) Lt += spec * ggx(N, V, L, rough) * uFixIntensity[i] * vis * uShutter / dist2;
  }

  // Interreflected fill. Not an artistic ambient term: it is the closed form
  // of the bounce series, so white rooms flood and dark rooms do not. The
  // occlusion factors carve out of it what corners and furniture actually
  // hide, and the directional weight leans it towards where the daylight
  // enters, which is what gives the room its sense of depth.
  float aoFill = roomOpenness(vWorld, N) * objectOcclusion(vWorld, N);
  float fillDirW = clamp(0.78 + 0.5 * dot(N, uFillDir), 0.3, 1.35);
  Lt += (albedo / PI) * uFillIrradiance * uShutter * aoFill * fillDirW;

  /* ================= flash (no shutter anywhere) ================= */
  if (uFlashOn > 0.5) {
    for (int i = 0; i < MAX_FLASH; i++) {
      if (i >= uFlashCount) break;
      vec3 fp = uFlashPos[i];
      // Jitter across the source disc: penumbra falls out of source size.
      if (uFlashRadius[i] > 0.002) {
        vec3 t, b; basis(uFlashDir[i], t, b);
        float ang = r1 * 6.2831853;
        float rad = sqrt(r2) * uFlashRadius[i];
        fp += (t * cos(ang) + b * sin(ang)) * rad;
      }
      vec3 d = fp - vWorld;
      float dist2 = max(0.01, dot(d, d));
      vec3 L = d * inversesqrt(dist2);
      float ndl = max(dot(N, L), 0.0);
      if (ndl <= 0.0) continue;

      // Cone / hemisphere falloff of the head itself.
      float axis = dot(-L, uFlashDir[i]);
      float gate;
      if (uFlashHemi[i] > 0.5) {
        gate = smoothstep(-0.05, 0.25, axis);
      } else {
        float cc = uFlashConeCos[i];
        gate = smoothstep(cc, mix(cc, 1.0, 0.45), axis);
      }
      if (gate <= 0.0) continue;

      float vis = visibility(vWorld, fp);
      vec3 Els = uFlashCoeff[i] * ndl * gate * vis / dist2;   // lux-seconds
      Lt += (albedo / PI) * Els;
      if (spec > 0.001) Lt += spec * ggx(N, V, L, rough) * uFlashCoeff[i] * gate * vis / dist2;
    }
    // Flash bouncing off everything. Same closed-form series as the ambient
    // fill, which is why a small white room lights up on far less power.
    Lt += (albedo / PI) * uFlashFill * aoFill;
  }

  // Self-luminous surfaces: the view through the glass, the glowing bulb.
  vec3 emissive = uEmissive[m];
  if (uView[m] > 0.5) emissive *= windowView(vUv, uView[m]);
  Lt += emissive * uShutter;

  /* ================= camera ================= */
  vec3 R_rel = (Lt * uISO) / (12.5 * uAperture * uAperture);
  vec3 sceneLinear = 0.18 * R_rel;

  // The curtain. Above sync speed the frame is physically never all open.
  float yNorm = gl_FragCoord.y / max(1.0, uResolution.y);
  if (uSyncBandTop > 0.0 && yNorm < uSyncBandTop) {
    float edge = smoothstep(uSyncBandTop, uSyncBandTop - 0.012, yNorm);
    sceneLinear = mix(sceneLinear, sceneLinear * 0.02, edge);
  }

  vec3 wb = sceneLinear * uWB;

  if (uNoiseAmount > 0.0) {
    float n = hash13(vec3(gl_FragCoord.xy, uFrame + 3.7)) - 0.5;
    float amp = uNoiseAmount / sqrt(max(0.02, length(wb) / 0.31));
    wb *= 1.0 + n * amp;
    wb += vec3(hash13(seed.zxy) - 0.5) * amp * 0.012;
  }

  // Mirrors composite the reflected view rendered a moment earlier.
  //
  // The lookup projects this fragment's world position through the REFLECTED
  // camera, not through this one. The two cameras do not share screen
  // coordinates - the reflected basis is handedness-flipped - so sampling by
  // gl_FragCoord slides the reflection sideways and lands on empty frustum.
  if (uMirror[m] * uMirrorEnabled > 0.5) {
    vec4 mp = uMirrorMatrix * vec4(vWorld, 1.0);
    vec2 muv = (mp.xy / max(1e-5, mp.w)) * 0.5 + 0.5;
    vec3 refl = texture(uMirrorTex, clamp(muv, vec2(0.0), vec2(1.0))).rgb;
    float fres = 0.04 + 0.96 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
    wb = mix(wb, refl, clamp(uMirror[m] * (0.86 + 0.14 * fres), 0.0, 1.0));
  }

  // Half-float accumulation buffer: anything past five stops over clip is
  // already pure white, so clamping there costs nothing and avoids overflow.
  fragColor = vec4(clamp(wb, vec3(0.0), vec3(64.0)), 1.0);
}
`;

/**
 * Resolve pass: tone curve, sRGB encode, zebras. Kept separate so the
 * accumulation buffer stays scene-referred linear and the clipping overlay
 * can test the true scene value rather than the displayed one.
 */
export const resolveFragmentShader = /* glsl */ `
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uScene;
uniform float uSamples;
uniform float uKnee;
uniform float uClip;
uniform float uFloor;
uniform float uZebras;
uniform float uTime;
uniform vec2  uResolution;
uniform float uVignette;

float toneMap(float x) {
  if (x <= uKnee) return max(0.0, x);
  float span = 1.0 - uKnee;
  return uKnee + span * (1.0 - exp(-(x - uKnee) / span));
}

float encodeSRGB(float c) {
  c = clamp(c, 0.0, 1.0);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

void main() {
  vec3 lin = texture(uScene, vUv).rgb / max(1.0, uSamples);

  if (uVignette > 0.0) {
    vec2 d = vUv - 0.5;
    float v = 1.0 - uVignette * dot(d, d) * 1.6;
    lin *= max(0.0, v);
  }

  vec3 mapped = vec3(toneMap(lin.r), toneMap(lin.g), toneMap(lin.b));
  vec3 srgb = vec3(encodeSRGB(mapped.r), encodeSRGB(mapped.g), encodeSRGB(mapped.b));

  if (uZebras > 0.5) {
    float mx = max(lin.r, max(lin.g, lin.b));
    float mn = min(lin.r, min(lin.g, lin.b));
    float stripe = fract((gl_FragCoord.x + gl_FragCoord.y) / 12.0);
    if (mx >= uClip && stripe < 0.5) srgb = vec3(1.0, 0.16, 0.16);
    else if (mn <= uFloor && stripe > 0.5) srgb = vec3(0.16, 0.42, 1.0);
  }

  fragColor = vec4(srgb, 1.0);
}
`;

export const fullscreenVertexShader = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Region mask. Encodes material id and a coarse kind per pixel so the scorer
 * can ask real questions of the actual frame - is that window clipped, is a
 * light stand visible, is there gear in the mirror - instead of inferring
 * them from the settings that produced it.
 */
export const maskFragmentShader = /* glsl */ `
flat in int vMatId;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUv;
out vec4 fragColor;
uniform float uKind[24];
void main() {
  int m = clamp(vMatId, 0, 23);
  fragColor = vec4(float(m) / 255.0, uKind[m] / 255.0, 0.0, 1.0);
}
`;

/** Kinds the mask distinguishes. */
export const KIND = {
  SURFACE: 0, WINDOW: 1, BULB: 2, MIRROR: 3, GLOSSY: 4, GEAR: 5, CEILING: 6, FLOOR: 7
};

/**
 * Analysis pass. Encodes scene-referred linear values as a log curve into an
 * ordinary 8-bit target so the scorer can read them back anywhere.
 *
 * Reading a half-float render target directly is not portable: the readback
 * type is implementation defined and fails outright on some mobile GPUs. A
 * log encoding across ANALYSIS_RANGE stops gives about a fifteenth of a stop
 * per code value, which is far finer than any judgement made from it.
 */
export const ANALYSIS_LOW = -12;   // stops below middle grey at code 0
export const ANALYSIS_HIGH = 6;    // stops above middle grey at code 255

export const analysisFragmentShader = /* glsl */ `
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uScene;
uniform float uSamples;
uniform float uVignette;
void main() {
  vec3 lin = texture(uScene, vUv).rgb / max(1.0, uSamples);
  if (uVignette > 0.0) {
    vec2 d = vUv - 0.5;
    lin *= max(0.0, 1.0 - uVignette * dot(d, d) * 1.6);
  }
  vec3 st = log2(max(lin, vec3(1e-7)) / 0.18);
  vec3 code = clamp((st - (${ANALYSIS_LOW}.0)) / (${ANALYSIS_HIGH}.0 - (${ANALYSIS_LOW}.0)), 0.0, 1.0);
  fragColor = vec4(code, 1.0);
}
`;
