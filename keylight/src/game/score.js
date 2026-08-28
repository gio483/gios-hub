/**
 * Keylight - the art director's rubric.
 *
 * Two rules shape all of this:
 *
 *   1. Score the result, not the method. Almost everything here is measured
 *      off the actual pixels of the frame that was captured. Many different
 *      lighting solutions reach the same numbers, which is the point.
 *   2. The diagnosis is the product. Every criterion returns plain language
 *      and, where it can, a box in the frame to point at.
 */

import { CLIP_LINEAR, NOISE_FLOOR_LINEAR } from '../physics/sensor.js';
import { KIND } from '../render/shaders.js';
import { syncBandCoverage } from '../physics/flash.js';
import { MIDDLE_GREY } from '../physics/constants.js';
import { SENSOR_FULL_FRAME, SENSOR_APSC } from '../physics/constants.js';
import { lensById } from '../physics/gear.js';
import { hexToLinear } from '../physics/color.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * clamp01(t);
/** 1 when v is at or below lo, 0 at or above hi. */
const fallOff = (v, lo, hi) => clamp01((hi - v) / (hi - lo));
const stops = (y) => Math.log2(Math.max(1e-9, y) / MIDDLE_GREY);

export const CRITERIA = [
  { id: 'window',    label: 'Window retained',       weight: 20 },
  { id: 'fixtures',  label: 'Fixtures glowing',      weight: 15 },
  { id: 'colour',    label: 'Colour consistency',    weight: 15 },
  { id: 'shadows',   label: 'Shadow logic',          weight: 15 },
  { id: 'gear',      label: 'No gear or reflections', weight: 15 },
  { id: 'verticals', label: 'Verticals true',        weight: 10 },
  { id: 'even',      label: 'Even illumination',     weight: 10 }
];

/**
 * @param frame { width, height, linear: Float32Array RGBA, mask: Uint8Array,
 *                mirrorMask?: Uint8Array }
 */
export function scoreFrame({ state, compiled, resolved, frame }) {
  const regions = collectRegions(frame, compiled);
  const criteria = [];

  criteria.push(scoreWindow(regions, compiled));
  criteria.push(scoreFixtures(regions, frame, compiled));
  criteria.push(scoreColour(regions));
  criteria.push(scoreShadows(state, compiled, resolved, regions));
  criteria.push(scoreGear(regions, frame, state, compiled, resolved));
  criteria.push(scoreVerticals(state));
  criteria.push(scoreEven(regions, state, resolved, compiled));

  // Weight redistribution: a windowless hallway should not be marked down for
  // failing to retain a window it does not have.
  const active = criteria.filter((c) => !c.notApplicable);
  const activeWeight = active.reduce((s, c) => s + c.weight, 0) || 1;
  let total = 0;
  for (const c of criteria) {
    c.normalisedWeight = c.notApplicable ? 0 : (c.weight / activeWeight) * 100;
    c.points = c.notApplicable ? 0 : c.fraction * c.normalisedWeight;
    total += c.points;
  }

  const roomLevel = regions.percentile(regions.buckets.surface, 0.5);
  const penalties = collectPenalties(state, resolved, regions, roomLevel);
  for (const p of penalties) total -= p.points;

  return {
    total: Math.max(0, Math.min(100, Math.round(total))),
    criteria, penalties, regions: regions.summary,
    // Median exposure of ordinary surfaces. This is the number the coaching
    // layer means when it says "the room".
    surfaceMedianStops: roomLevel
  };
}

/* ------------------------------------------------------------------ */
/* Region extraction                                                   */
/* ------------------------------------------------------------------ */

/**
 * Per-material tint with luminance divided out, so dividing a pixel by it
 * leaves the colour of the light that fell on it. Materials whose own colour
 * is too saturated to invert reliably are marked unusable and skipped.
 */
function albedoTints(compiled) {
  return compiled.materials.map((m) => {
    const c = hexToLinear(m.albedo || '#808080');
    const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    if (lum < 0.012) return null;
    // A material whose procedural texture is itself multi-coloured (book
    // spines) cannot be inverted to the light's colour - a red spine next to
    // a blue one would read as a two-temperature room.
    if ((m.tex || 0) === 7) return null;
    // Sheeny materials are polluted by their specular term, which carries
    // the light's colour undyed: dividing it by the albedo tint would
    // over-correct those pixels and fake a split. The comparison is against
    // the albedo, because on a dark surface even a modest sheen carries a
    // third of the light - specular does not dim with the paint.
    if ((m.spec || 0) > 0.115 || (m.spec || 0) > 0.6 * lum) return null;
    const t = [c[0] / lum, c[1] / lum, c[2] / lum];
    const mx = Math.max(t[0], t[1], t[2]);
    const mn = Math.min(t[0], t[1], t[2]);
    if (mn < 1e-4 || mx / mn > 4.5) return null;
    return t;
  });
}

/**
 * Per-material factor that converts a pixel to what an 18% grey card would
 * have read under the same light. Without it a walnut-panelled room scores
 * as "unlit" at a perfect exposure, because the scorer would be metering the
 * wood's darkness instead of the light falling on it. This is the difference
 * between a reflected and an incident meter, and the rubric needs the
 * incident one.
 */
/**
 * Interiors are not exposed to put a grey card dead on middle grey - that
 * renders diffuse whites a hair off clipping and leaves the window nothing.
 * The working convention holds the card about half a stop under, so "the
 * room is correct" is centred there.
 */
const INTERIOR_METER_OFFSET = Math.pow(2, 0.5);

function greyCardFactors(compiled) {
  return compiled.materials.map((m) => {
    const c = hexToLinear(m.albedo || '#808080');
    const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return (0.18 * INTERIOR_METER_OFFSET) / Math.max(0.02, lum);
  });
}

function collectRegions(frame, compiled) {
  const { width: w, height: h, linear, mask, mirrorMask } = frame;
  const tints = albedoTints(compiled);
  const greyK = greyCardFactors(compiled);
  const n = w * h;

  // Single pass, no allocation inside the loop. A capture is close to two
  // million pixels, and the first version of this built JS arrays and sorted
  // them - ten seconds of scoring for a quarter-second render. Histograms
  // over stops answer every percentile question the rubric asks in O(1).
  const KINDS = 8;
  const BINS = 256;
  const S_LO = -14, S_HI = 6;
  const hist = new Uint32Array(KINDS * BINS);
  const count = new Uint32Array(KINDS);
  const sumY = new Float64Array(KINDS);
  const clippedCt = new Uint32Array(KINDS);
  const crushedCt = new Uint32Array(KINDS);
  const crushLevel = NOISE_FLOOR_LINEAR * 4;

  const CBINS = 512;
  const C_LO = -4, C_HI = 4;
  const splitHist = new Uint32Array(CBINS);
  let chromaN = 0, greenSum = 0;

  let gearInMirror = 0, mirrorPixels = 0;
  let bulbSx = 0, bulbSy = 0, bulbN = 0;
  const invLn2 = 1 / Math.LN2;

  for (let i = 0; i < n; i++) {
    const kind = mask[i * 4 + 1];
    const r = linear[i * 4], g = linear[i * 4 + 1], b = linear[i * 4 + 2];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    count[kind]++;
    sumY[kind] += y;
    if (y >= CLIP_LINEAR) clippedCt[kind]++;
    if (y <= crushLevel) crushedCt[kind]++;
    // Windows and bulbs are judged on the raw pixel (sensor truth); lit
    // surfaces are judged as the grey card they would have been.
    const yMeter = (kind === KIND.WINDOW || kind === KIND.BULB) ? y : y * greyK[mask[i * 4]];
    const st = Math.log(Math.max(1e-9, yMeter) / MIDDLE_GREY) * invLn2;
    let bin = ((st - S_LO) / (S_HI - S_LO) * BINS) | 0;
    if (bin < 0) bin = 0; else if (bin >= BINS) bin = BINS - 1;
    hist[kind * BINS + bin]++;

    if (kind === KIND.BULB) { bulbSx += i % w; bulbSy += (i / w) | 0; bulbN++; }
    if (kind === KIND.MIRROR) {
      mirrorPixels++;
      if (mirrorMask && mirrorMask[i * 4 + 1] === KIND.GEAR) gearInMirror++;
    }

    // Colour of the LIGHT, not of the paint: divide the pixel by the known
    // surface tint so a walnut floor and a white ceiling stop registering
    // as two light temperatures.
    if (kind !== KIND.WINDOW && kind !== KIND.BULB && kind !== KIND.GEAR &&
        y > MIDDLE_GREY / 16 && y < CLIP_LINEAR * 0.85) {
      const tint = tints[mask[i * 4]];
      if (tint) {
        const ir = Math.max(1e-6, r / tint[0]);
        const ig = Math.max(1e-6, g / tint[1]);
        const ib = Math.max(1e-6, b / tint[2]);
        const lr = Math.log(ir / ig) * invLn2;
        const lb = Math.log(ib / ig) * invLn2;
        let cb = ((lr - lb - C_LO) / (C_HI - C_LO) * CBINS) | 0;
        if (cb < 0) cb = 0; else if (cb >= CBINS) cb = CBINS - 1;
        splitHist[cb]++;
        greenSum += -(lr + lb) / 2;
        chromaN++;
      }
    }
  }

  const nameOf = ['surface', 'window', 'bulb', 'mirror', 'glossy', 'gear', 'ceiling', 'floor'];
  const buckets = {};
  const summary = {};
  for (let k = 0; k < KINDS; k++) {
    buckets[nameOf[k]] = {
      kind: k, count: count[k], sumY: sumY[k], clipped: clippedCt[k], crushed: crushedCt[k]
    };
    summary[nameOf[k]] = { count: count[k], fraction: count[k] / n };
  }

  const percentile = (bucket, p) => {
    const c = count[bucket.kind];
    if (!c) return 0;
    const target = p * c;
    let acc = 0;
    const base = bucket.kind * BINS;
    for (let b = 0; b < BINS; b++) {
      acc += hist[base + b];
      if (acc >= target) return S_LO + ((b + 0.5) / BINS) * (S_HI - S_LO);
    }
    return S_HI;
  };
  const splitPercentile = (p) => {
    if (!chromaN) return 0;
    const target = p * chromaN;
    let acc = 0;
    for (let b = 0; b < CBINS; b++) {
      acc += splitHist[b];
      if (acc >= target) return C_LO + ((b + 0.5) / CBINS) * (C_HI - C_LO);
    }
    return C_HI;
  };

  return {
    w, h, n, buckets, summary, percentile,
    chroma: { count: chromaN, splitPercentile, greenMean: chromaN ? greenSum / chromaN : 0 },
    gearInMirror, mirrorPixels,
    bulbCentroids: bulbN ? [[bulbSx / bulbN, bulbSy / bulbN]] : [],
    gearFraction: count[KIND.GEAR] / n,
    linear, mask
  };
}

const clippedFraction = (b) => (b.count ? b.clipped / b.count : 0);
const crushedFraction = (b) => (b.count ? b.crushed / b.count : 0);
const meanStops = (b) => (b.count ? stops(b.sumY / b.count) : 0);

/* ------------------------------------------------------------------ */
/* Criteria                                                            */
/* ------------------------------------------------------------------ */

function scoreWindow(regions, compiled) {
  const px = regions.buckets.window;
  const base = { id: 'window', label: 'Window retained', weight: 20 };
  if (!compiled.windows.length) {
    return { ...base, notApplicable: true, fraction: 1, verdict: 'ok',
      detail: 'No window in this room, so nothing to hold.' };
  }
  if (px.count / regions.n < 0.002) {
    return { ...base, notApplicable: true, fraction: 1, verdict: 'ok',
      detail: 'No window in frame. Nothing to hold, and nothing earned either.' };
  }
  const blown = clippedFraction(px);
  const mean = meanStops(px);

  const blowScore = fallOff(blown, 0.06, 0.52);
  const darkScore = mean >= -0.4 ? 1 : fallOff(-mean, 0.4, 2.6);
  const hotScore = mean <= 2.2 ? 1 : fallOff(mean, 2.2, 3.8);
  const fraction = blowScore * darkScore * hotScore;

  let verdict = 'ok';
  let detail = `The view holds. It sits ${fmtStops(mean)} over middle grey with ${pct(blown)} of it clipped, so the trees outside still have shape.`;
  if (blown > 0.42) {
    verdict = 'fail';
    detail = `${pct(blown)} of the window is pure white. Nothing is left out there to recover. Either shorten the shutter or close down, then put the light back in the room with flash rather than with time.`;
  } else if (blown > 0.10) {
    verdict = 'warn';
    detail = `${pct(blown)} of the window is clipped. The brightest part of the view is gone. Half a stop less ambient and it comes back.`;
  } else if (mean < -1.6) {
    verdict = 'fail';
    detail = `The view is ${fmtStops(mean)} under middle grey. That reads as a fake window, like a light box behind a hole. Let more ambient in.`;
  } else if (mean < -0.4) {
    verdict = 'warn';
    detail = `The window is a little heavy at ${fmtStops(mean)}. It wants to sit around half a stop to two stops over.`;
  }
  return { ...base, fraction, verdict, detail,
    stats: { blown, mean }, where: 'window' };
}

function scoreFixtures(regions, frame, compiled) {
  const base = { id: 'fixtures', label: 'Fixtures glowing', weight: 15 };
  const px = regions.buckets.bulb;
  if (!compiled.fixtures.length || px.count / regions.n < 0.0004) {
    return { ...base, notApplicable: true, fraction: 1, verdict: 'ok',
      detail: 'No fixtures in frame to worry about.' };
  }
  const mean = meanStops(px);
  const halo = haloStats(regions, frame);

  const lit = clamp01((mean - 0.2) / 1.8);
  const blob = fallOff(halo.clipped, 0.3, 0.8);
  const fraction = lit * lerp(0.45, 1, blob);

  let verdict = 'ok';
  let detail = `The fixtures read as lit and the surface around them still has shape.`;
  if (mean < 0.4) {
    verdict = 'fail';
    detail = 'The fixtures are dead. A lamp that is switched on should be clearly brighter than the wall behind it, otherwise the room looks unoccupied.';
  } else if (halo.clipped > 0.6) {
    verdict = 'fail';
    detail = `The fixtures have bloomed into featureless blobs: ${pct(halo.clipped)} of the shade and the ceiling around them is clipped. That usually means ambient was dragged up with shutter instead of the room being lit with flash.`;
  } else if (halo.clipped > 0.32) {
    verdict = 'warn';
    detail = `The area around the fixtures is starting to blow out (${pct(halo.clipped)} clipped). Pull the ambient back a third of a stop and let flash carry the room.`;
  }
  return { ...base, fraction, verdict, detail, stats: { mean, halo: halo.clipped }, where: 'bulb' };
}

/** Clipping in the shade and ceiling immediately around each fixture. */
function haloStats(regions, frame) {
  const { w, h } = regions;
  const radius = Math.max(6, Math.round(Math.min(w, h) * 0.045));
  let total = 0, clipped = 0;
  for (const [cx, cy] of regions.bulbCentroids) {
    for (let y = Math.max(0, cy - radius); y < Math.min(h, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x < Math.min(w, cx + radius); x++) {
        const i = (y * w + x) | 0;
        if (frame.mask[i * 4 + 1] === KIND.BULB) continue;
        const lr = frame.linear[i * 4], lg = frame.linear[i * 4 + 1], lb = frame.linear[i * 4 + 2];
        const yy = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
        total++;
        if (yy >= CLIP_LINEAR) clipped++;
      }
    }
  }
  return { clipped: total ? clipped / total : 0, total };
}

function scoreColour(regions) {
  const base = { id: 'colour', label: 'Colour consistency', weight: 15 };
  const c = regions.chroma;
  if (c.count < 200) {
    return { ...base, notApplicable: true, fraction: 1, verdict: 'ok',
      detail: 'Not enough well-exposed midtone to judge colour.' };
  }
  // Blue/orange axis: warm light pushes log(r/g) up and log(b/g) down.
  const split = c.splitPercentile(0.95) - c.splitPercentile(0.05);

  // Green: light bounced off a coloured wall pushes green up relative to
  // both neighbours, which no white balance setting can undo.
  const green = c.greenMean;

  const splitScore = fallOff(split, 0.55, 2.40);
  const greenScore = fallOff(Math.abs(green), 0.12, 0.46);
  const fraction = splitScore * greenScore;

  let verdict = 'ok';
  let detail = 'Colour holds together across the frame. One temperature reads through the whole room.';
  if (split > 1.6) {
    verdict = 'fail';
    detail = `Hard blue and orange split across the frame (${split.toFixed(2)} on the warm-cool axis). Ungelled flash against warm fixtures. Gel the flash to match the fixtures, or kill the fixtures and own the daylight, but do not leave both.`;
  } else if (split > 0.9) {
    verdict = 'warn';
    detail = `Two temperatures are still visible (${split.toFixed(2)} spread). A quarter or half CTO would close most of the gap.`;
  } else if (Math.abs(green) > 0.28) {
    verdict = 'fail';
    detail = green > 0
      ? 'A green cast is running through the frame. That is bounce light picking up the colour of the surface it hit. Bounce off something neutral or go direct.'
      : 'A magenta cast is running through the frame, most likely from the surface the light is bouncing off.';
  } else if (Math.abs(green) > 0.16) {
    verdict = 'warn';
    detail = 'A slight colour cast from the bounce surface. Worth checking what the light is hitting on its way in.';
  }
  return { ...base, fraction, verdict, detail, stats: { split, green } };
}

function scoreShadows(state, compiled, resolved, regions) {
  const base = { id: 'shadows', label: 'Shadow logic', weight: 15 };
  const contributors = resolved.map((r) => {
    const d = Math.hypot(r.origin[0] - state.camX, r.origin[2] - state.camZ) + 1.6;
    return {
      r,
      strength: r.throwCoeff / (d * d),
      hardness: 1 - clamp01(r.sourceDiameter / (0.22 * d)),
      azimuth: Math.atan2(r.origin[0] - state.camX, r.origin[2] - state.camZ)
    };
  });
  if (!contributors.length) {
    return { ...base, fraction: 1, verdict: 'ok',
      detail: 'Ambient only, so shadows can only agree with themselves.' };
  }
  contributors.sort((a, b) => b.strength - a.strength);
  const top = contributors[0];
  // A second shadow is visible well before the light making it is anywhere
  // near matching the key. Two and a half stops down still reads as a second
  // shadow on a floor, so the threshold has to be generous, not fair.
  const hardRivals = contributors.filter(
    (c) => c !== top && c.hardness > 0.5 && c.strength > top.strength * 0.17
  );

  // Which way is the daylight coming from, seen from the camera?
  let winAz = null, winWeight = 0;
  for (const wnd of compiled.windows) {
    const wgt = wnd.area * Math.pow(2, wnd.ev - 12);
    if (wgt > winWeight) {
      winWeight = wgt;
      winAz = Math.atan2(wnd.centre[0] - state.camX, wnd.centre[2] - state.camZ);
    }
  }
  let conflict = 0;
  if (winAz !== null && top.hardness > 0.4) {
    let d = Math.abs(top.azimuth - winAz);
    if (d > Math.PI) d = 2 * Math.PI - d;
    conflict = clamp01((d - 1.75) / 1.2); // beyond ~100 degrees apart
  }

  const doubleScore = hardRivals.length === 0 ? 1 : (hardRivals.length === 1 ? 0.4 : 0.15);
  const dirScore = 1 - conflict * 0.75;
  const fraction = doubleScore * dirScore;

  let verdict = 'ok';
  let detail = 'One dominant direction, and it agrees with the daylight. Shadows read as if the room lit itself.';
  if (hardRivals.length) {
    verdict = 'fail';
    detail = `${hardRivals.length + 1} hard sources of similar strength are casting competing shadows. Soften the secondary heads, drop them two stops so they only fill, or bounce them.`;
  } else if (conflict > 0.55) {
    verdict = 'fail';
    detail = 'The flash is throwing shadows the opposite way from the window. The eye reads that instantly as lit, even when it cannot say why. Move the key round to the window side.';
  } else if (conflict > 0.25) {
    verdict = 'warn';
    detail = 'The key is fighting the window direction a little. Swinging it towards the daylight side would settle the frame.';
  }
  return { ...base, fraction, verdict, detail,
    stats: { rivals: hardRivals.length, conflict } };
}

function scoreGear(regions, frame, state, compiled, resolved) {
  const base = { id: 'gear', label: 'No gear or reflections', weight: 15 };
  const inFrame = regions.gearFraction;
  const inMirror = regions.mirrorPixels ? regions.gearInMirror / regions.mirrorPixels : 0;
  const glassHits = specularHits(state, compiled, resolved);

  const frameScore = inFrame < 0.00025 ? 1 : fallOff(inFrame, 0.00025, 0.02);
  const mirrorScore = inMirror < 0.004 ? 1 : fallOff(inMirror, 0.004, 0.10);
  const glassScore = glassHits.length === 0 ? 1 : (glassHits.length === 1 ? 0.35 : 0.1);
  const fraction = frameScore * mirrorScore * glassScore;

  let verdict = 'ok';
  let detail = 'Nothing of yours is in the picture. No stand, no tripod leg, no flash burning back out of the glass.';
  if (inMirror > 0.004) {
    verdict = 'fail';
    detail = `You are in the mirror. ${pct(inMirror)} of the mirror surface is you or your gear. Either move out of the reflected cone, or shift the lens laterally so the camera can stand off axis while the frame stays centred.`;
  } else if (inFrame > 0.00025) {
    verdict = 'fail';
    detail = `A stand or a tripod leg is in the frame (${pct(inFrame)} of the picture). Wide lenses see much more than you think. Move it behind the camera line or tighten the focal length.`;
  } else if (glassHits.length) {
    verdict = 'fail';
    detail = `A flash is reflecting straight back at the camera out of ${glassHits[0]}. Move the head off the mirror angle: the reflection follows the same rule as a mirror, so if you can see the head in the surface, the camera can too.`;
  }
  return { ...base, fraction, verdict, detail,
    stats: { inFrame, inMirror, glassHits } };
}

/**
 * Analytic specular check on flat reflective surfaces. A light appears in a
 * mirror-like surface when its reflection across that plane lines up with the
 * camera's view of the surface. This is exactly the rule of reflection, so it
 * finds the same positions a photographer finds by moving their head.
 */
function specularHits(state, compiled, resolved) {
  const hits = [];
  const cam = [state.camX, state.camHeight, state.camZ];
  const planes = [];
  for (const w of compiled.windows) {
    const n = normalise(cross(w.right, w.up));
    planes.push({ label: 'the window glass', point: w.centre, normal: n, half: [w.right, w.up], gloss: 0.9 });
  }
  for (const rf of compiled.scene.reflectors || []) {
    if (rf.kind === 'window') continue;
    if (!rf.centre || !rf.normal) continue;
    planes.push({
      label: rf.label || `the ${rf.kind}`, point: rf.centre, normal: normalise(rf.normal),
      half: null, w: rf.w, h: rf.h, gloss: rf.gloss ?? 0.7
    });
  }
  for (const p of planes) {
    for (const r of resolved) {
      const d = dot(sub(r.origin, p.point), p.normal);
      const mirrored = sub(r.origin, scale(p.normal, 2 * d));
      // Does the segment camera -> mirrored light actually cross the surface?
      const dc = dot(sub(cam, p.point), p.normal);
      const dm = dot(sub(mirrored, p.point), p.normal);
      if (dc * dm >= 0) continue;
      const t = dc / (dc - dm);
      const hit = add(cam, scale(sub(mirrored, cam), t));
      const local = sub(hit, p.point);
      let inside;
      if (p.half) {
        const [rv, uv] = p.half;
        inside = Math.abs(dot(local, normalise(rv))) <= len(rv) &&
                 Math.abs(dot(local, normalise(uv))) <= len(uv);
      } else {
        inside = len(local) <= Math.max(p.w || 0.6, p.h || 0.6) / 2;
      }
      if (inside && p.gloss > 0.5) hits.push(p.label);
    }
  }
  return [...new Set(hits)];
}

function scoreVerticals(state) {
  const base = { id: 'verticals', label: 'Verticals true', weight: 10 };
  const t = Math.abs(state.tilt || 0);
  const fraction = fallOff(t, 0.35, 5.0);
  let verdict = 'ok';
  let detail = state.shiftY
    ? `Camera level and the lens shifted ${state.shiftY > 0 ? 'up' : 'down'} ${Math.abs(state.shiftY).toFixed(0)}mm. Verticals are dead parallel and you kept the framing.`
    : 'Camera is level. Verticals are parallel, which is the single fastest way a frame reads as professional.';
  if (t > 2.5) {
    verdict = 'fail';
    detail = `The camera is tilted ${t.toFixed(1)} degrees, so every vertical in the room is converging. Level the camera. If that loses the ceiling, shift the lens up rather than tipping it.`;
  } else if (t > 0.8) {
    verdict = 'warn';
    detail = `A ${t.toFixed(1)} degree tilt is enough to see. Verticals are just off parallel.`;
  }
  return { ...base, fraction, verdict, detail, stats: { tilt: t } };
}

function scoreEven(regions, state, resolved, compiled) {
  const base = { id: 'even', label: 'Even illumination', weight: 10 };
  const surf = regions.buckets.surface;
  if (surf.count < 400) {
    return { ...base, notApplicable: true, fraction: 1, verdict: 'ok', detail: 'Not enough plain surface to judge.' };
  }
  const p05 = regions.percentile(surf, 0.05);
  const p95 = regions.percentile(surf, 0.95);
  const p50 = regions.percentile(surf, 0.50);
  const spread = p95 - p05;
  const hot = clippedFraction(regions.buckets.glossy);
  const dead = crushedFraction(surf);

  // Flat frontal light: the key sitting on the lens axis, and nothing in the
  // frame falling off. Correctly exposed and completely without depth.
  let frontal = 0;
  if (resolved.length) {
    const camAz = (state.camYaw * Math.PI) / 180;
    for (const r of resolved) {
      const az = Math.atan2(r.origin[0] - state.camX, r.origin[2] - state.camZ);
      let d = Math.abs(az - camAz);
      if (d > Math.PI) d = 2 * Math.PI - d;
      const near = clamp01((0.30 - d) / 0.30);
      const dist = Math.hypot(r.origin[0] - state.camX, r.origin[2] - state.camZ);
      if (dist < 1.2) frontal = Math.max(frontal, near);
    }
  }
  const flatness = spread < 0.9 ? clamp01((0.9 - spread) / 0.7) : 0;

  // Whether the room is lit at all. A frame that holds the window perfectly
  // while the furniture sits four stops under is not evenly illuminated, it
  // is unlit, and without this the rubric would happily award it full marks.
  const levelScore = fallOff(Math.abs(p50), 0.9, 3.0);

  const spreadScore = fallOff(spread, 2.8, 6.0);
  const hotScore = fallOff(hot, 0.02, 0.16);
  const deadScore = fallOff(dead, 0.10, 0.40);
  const depthScore = 1 - 0.55 * frontal * flatness;
  const fraction = levelScore * spreadScore * hotScore * deadScore * depthScore;

  let verdict = 'ok';
  let detail = `Light falls across the room evenly enough to read as daylight, with ${spread.toFixed(1)} stops between the brightest and darkest plain surface.`;
  if (p50 < -1.6) {
    verdict = 'fail';
    detail = `The room itself is ${p50.toFixed(1)} stops under. The window may be perfect but there is nothing lit in front of it. This is what flash is for: raise the room without touching the view.`;
  } else if (p50 > 1.6) {
    verdict = 'fail';
    detail = `The room is ${p50.toFixed(1)} stops over and going chalky. Pull the flash back, or close down and let the window breathe.`;
  } else if (Math.abs(p50) > 0.9) {
    verdict = 'warn';
    detail = `The room is sitting ${p50.toFixed(1)} stops off middle grey. Close, but a print would show it.`;
  } else if (hot > 0.08) {
    verdict = 'fail';
    detail = `Specular hotspots are burning out on the glossy surfaces (${pct(hot)} clipped). A bare head reflecting in polished stone or stainless will always do this. Go bigger and softer, or change the angle so the reflection lands away from the camera.`;
  } else if (spread > 5) {
    verdict = 'fail';
    detail = `${spread.toFixed(1)} stops across plain surfaces. That is a hotspot near the light and a hole at the far end. Move the head back, feather it past the near wall, or add a second head at low power for the far side.`;
  } else if (dead > 0.28) {
    verdict = 'warn';
    detail = `${pct(dead)} of the room has fallen into the noise floor. There is a dark corner the flash never reached.`;
  } else if (frontal > 0.5 && flatness > 0.5) {
    verdict = 'warn';
    detail = 'The key is sitting right on the lens axis and nothing is falling off. Technically exposed, completely flat. Move the head off to one side and let one wall go darker than the other.';
  } else if (spread > 3.6) {
    verdict = 'warn';
    detail = `${spread.toFixed(1)} stops of falloff across the room. Close to the edge of what reads as natural.`;
  }
  return { ...base, fraction, verdict, detail, stats: { spread, hot, dead, frontal, level: p50 } };
}

/* ------------------------------------------------------------------ */
/* Penalties                                                           */
/* ------------------------------------------------------------------ */

function collectPenalties(state, resolved, regions, roomLevel) {
  const out = [];

  // An art director does not average a frame whose subject is not lit, they
  // reject it. Every individual criterion can still be honest about its own
  // question while the frame as a whole is disqualified.
  const off = Math.abs(roomLevel);
  if (off > 1.4) {
    out.push({
      id: 'unlit', label: roomLevel < 0 ? 'Room not lit' : 'Room blown out',
      points: Math.min(48, (off - 1.2) * 20),
      detail: roomLevel < 0
        ? `The room sits ${roomLevel.toFixed(1)} stops under middle grey. Holding the window while the furniture disappears is not a photograph of a room, it is a photograph of a window. Flash is what closes that gap without touching the view.`
        : `The room sits ${roomLevel.toFixed(1)} stops over and the surfaces are going chalky. Take the flash down, or close the aperture and let the window come back.`
    });
  }

  const lens = lensById(state.lensId);
  const crop = lens && lens.sensor === 'apsc' ? SENSOR_APSC.crop : SENSOR_FULL_FRAME.crop;
  const eq = state.focal * crop;

  if (eq < 20) {
    const points = Math.min(9, (20 - eq) * 1.5);
    out.push({
      id: 'wide', label: 'Too wide', points,
      detail: `${Math.round(eq)}mm equivalent. Below about 20mm a room stops looking designed and starts looking listed. High-end interiors live around 24 to 35mm. Step back into the corner and go longer.`
    });
  } else if (eq > 70) {
    out.push({
      id: 'tight', label: 'Very tight', points: 2,
      detail: `${Math.round(eq)}mm equivalent reads as a detail shot rather than a room. Fine if that was the intent.`
    });
  }

  if (state.aperture > 16.5) {
    out.push({
      id: 'diffraction', label: 'Diffraction', points: 3,
      detail: `At f/${Math.round(state.aperture)} the Airy disc is wider than the pixel and the whole frame is softening. f/8 to f/11 is the architecture range.`
    });
  }
  if (state.iso > 5000) {
    out.push({
      id: 'noise', label: 'Noise', points: state.iso > 10000 ? 5 : 3,
      detail: `ISO ${Math.round(state.iso)} is putting grain into the shadows. Flash is what buys you low ISO indoors, so use it rather than sensitivity.`
    });
  }
  const band = resolved.length ? syncBandCoverage(state.shutter, state.hss) : 0;
  if (band > 0.01) {
    out.push({
      id: 'sync', label: 'Shutter curtain in frame', points: 40,
      detail: `A black band covers ${pct(band)} of the frame. Above sync speed the shutter never fully opens, so the flash only lit the slice that happened to be uncovered. Drop to 1/250 or slower, or turn on high speed sync and pay for it in power.`
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */

function fmtStops(s) {
  const v = Math.abs(s) < 0.05 ? 0 : s;
  return `${v > 0 ? '+' : ''}${v.toFixed(1)} stops`;
}
const pct = (v) => `${Math.round(v * 100)}%`;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const normalise = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
