/**
 * Keylight - practice mode, Match the Hero, and the Daily Challenge.
 *
 * The daily is procedurally varied from the date rather than hand authored,
 * so it cannot be memorised: the window EV, the fixture output, the camera
 * start and the constraint all move.
 */

import { SCENES, sceneById } from '../scenes/index.js';
import { APERTURE_STOPS, SHUTTER_STOPS, ISO_STOPS, formatShutter } from '../physics/exposure.js';

/* ---------------- constraint runs ---------------- */

export const CONSTRAINTS = [
  {
    id: 'one-light', label: 'One light only',
    desc: 'A single head, wherever you like. Most professional interiors are lit with one, and it forces you to think about position before power.',
    maxLights: 1,
    apply: (s) => { s.lights = s.lights.slice(0, 1); s.selected = s.lights[0]?.id; }
  },
  {
    id: 'no-bounce', label: 'No bounce',
    desc: 'Direct and modified only. No ceilings, no walls. You have to make softness rather than borrow it.',
    noBounce: true,
    apply: (s) => { for (const l of s.lights) if (l.mode !== 'direct') l.mode = 'direct'; }
  },
  {
    id: 'bare', label: 'Bare heads, no modifiers',
    desc: 'Nothing on the front of the light. Distance, angle and bounce are all you have.',
    noModifiers: true,
    apply: (s) => { for (const l of s.lights) l.modifierId = 'none'; }
  },
  {
    id: 'fixed-35', label: 'Locked at 35mm',
    desc: 'No zooming out of the problem. Move your feet.',
    apply: (s) => { s.lensId = 'standard_zoom'; s.focal = 35; }
  },
  {
    id: 'three-frames', label: 'Three exposures',
    desc: 'Three shutter presses to get it right. Meter in your head before you commit.',
    maxShots: 3,
    apply: () => {}
  }
];

/* ---------------- match the hero ---------------- */

export const HERO_SETUPS = {
  'living-room': {
    label: 'Afternoon, held',
    desc: 'Window a stop and a half over, room on middle grey, one bounced head, no cast. Rebuild it.',
    setup: (s) => {
      s.aperture = APERTURE_STOPS[9];
      s.shutter = SHUTTER_STOPS[37];
      s.iso = ISO_STOPS[0];
      s.whiteBalance = 5200; s.whiteBalanceAuto = false;
      s.camX = -2.15; s.camZ = -3.15; s.camHeight = 1.32; s.camYaw = 33; s.focal = 24; s.tilt = 0;
      s.lights = [{
        id: 'L1', x: 0.6, z: -2.5, height: 2.05, yaw: 20, tilt: 0, mode: 'ceiling',
        headId: 'ad200_fresnel', modifierId: 'none', gelId: 'cto_quarter', power: 2, enabled: true
      }];
    }
  },
  'kitchen': {
    label: 'Pendants lit, no hotspots',
    desc: 'Three pendants glowing, quartz and backsplash clean, not a single specular blob. Rebuild it.',
    setup: (s) => {
      s.aperture = APERTURE_STOPS[12];
      s.shutter = SHUTTER_STOPS[33];
      s.iso = ISO_STOPS[0];
      s.whiteBalance = 4200; s.whiteBalanceAuto = false;
      s.camX = -1.5; s.camZ = 2.6; s.camHeight = 1.30; s.camYaw = 196; s.focal = 26; s.tilt = 0;
      s.lights = [{
        id: 'L1', x: -1.7, z: 1.4, height: 2.15, yaw: 190, tilt: 0, mode: 'ceiling',
        headId: 'ad200_fresnel', modifierId: 'none', gelId: 'cto_half', power: 1, enabled: true
      }];
    }
  },
  'blue-hour': {
    label: 'Dusk, balanced',
    desc: 'City still readable through the glass, fixtures warm, flash barely there. Rebuild it.',
    setup: (s) => {
      s.aperture = APERTURE_STOPS[6];
      s.shutter = SHUTTER_STOPS[27];
      s.iso = ISO_STOPS[6];
      s.whiteBalance = 3400; s.whiteBalanceAuto = false;
      s.camX = -2.4; s.camZ = -2.9; s.camHeight = 1.30; s.camYaw = 36; s.focal = 24; s.tilt = 0;
      s.lights = [{
        id: 'L1', x: -1.6, z: -1.4, height: 2.2, yaw: 30, tilt: 0, mode: 'ceiling',
        headId: 'v1', modifierId: 'none', gelId: 'cto_full', power: 8, enabled: true
      }];
    }
  }
};

/**
 * Similarity between two rendered frames, 0 to 1.
 *
 * Downsamples both to a coarse grid and compares in a perceptual-ish way, so
 * matching means landing the same tonal and colour structure rather than
 * reproducing an identical pixel arrangement.
 */
export function compareFrames(a, b, gridW = 40) {
  if (!a || !b) return 0;
  const gridH = Math.max(4, Math.round(gridW / 1.5));
  const grid = (f) => {
    const out = new Float64Array(gridW * gridH * 3);
    const count = new Float64Array(gridW * gridH);
    for (let y = 0; y < f.height; y++) {
      const gy = Math.min(gridH - 1, ((y / f.height) * gridH) | 0);
      for (let x = 0; x < f.width; x++) {
        const gx = Math.min(gridW - 1, ((x / f.width) * gridW) | 0);
        const i = (y * f.width + x) * 4;
        const g = (gy * gridW + gx);
        out[g * 3] += f.pixels[i];
        out[g * 3 + 1] += f.pixels[i + 1];
        out[g * 3 + 2] += f.pixels[i + 2];
        count[g]++;
      }
    }
    for (let g = 0; g < gridW * gridH; g++) {
      const c = count[g] || 1;
      out[g * 3] /= c; out[g * 3 + 1] /= c; out[g * 3 + 2] /= c;
    }
    return out;
  };
  const ga = grid(a), gb = grid(b);
  let sum = 0;
  for (let i = 0; i < ga.length; i++) {
    const d = (ga[i] - gb[i]) / 255;
    sum += d * d;
  }
  const rms = Math.sqrt(sum / ga.length);
  return Math.max(0, 1 - rms * 2.6);
}

/* ---------------- daily challenge ---------------- */

/** Deterministic per-day generator. Same day, same brief, on any device. */
function seededRandom(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clone = (o) => JSON.parse(JSON.stringify(o));

export function buildDaily(date) {
  const key = date.toISOString().slice(0, 10);
  const rnd = seededRandom(key);
  const base = SCENES[Math.floor(rnd() * SCENES.length)];
  const scene = clone(base);
  scene.id = `daily-${key}`;
  scene.name = base.name;
  scene.subtitle = `Daily · ${key}`;

  // Time of day: shifts the exterior by up to three stops and cools or warms it.
  const evShift = (rnd() * 3.4) - 1.9;
  const kShift = Math.round((rnd() * 2600) - 900);
  for (const w of scene.windows || []) {
    w.ev = Math.max(4.5, w.ev + evShift);
    w.kelvin = Math.max(3800, Math.min(14000, w.kelvin + kShift));
  }
  // Fixtures on a dimmer.
  const dim = 0.45 + rnd() * 1.25;
  for (const f of scene.fixtures || []) f.lumens = Math.round(f.lumens * dim);

  const constraint = rnd() < 0.62 ? CONSTRAINTS[Math.floor(rnd() * CONSTRAINTS.length)] : null;

  const hour = evShift > 1.0 ? 'hard midday sun outside'
    : evShift > -0.3 ? 'flat afternoon light'
    : evShift > -1.2 ? 'late afternoon, the sun already off the glass'
    : 'nearly dusk, the exterior almost gone';
  const lamps = dim > 1.25 ? 'Every lamp in the place is on full.'
    : dim < 0.7 ? 'The fixtures are on a dimmer and barely contributing.'
    : 'The fixtures are at their normal level.';

  return {
    key,
    dateLabel: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    scene,
    constraint,
    brief: `${base.name}, ${hour}. ${lamps}${constraint ? ' ' + constraint.label + ': ' + constraint.desc : ''}`,
    setup: (s) => {
      s.aperture = APERTURE_STOPS[9];
      s.shutter = SHUTTER_STOPS[33];
      s.iso = ISO_STOPS[0];
      s.whiteBalanceAuto = false;
      s.whiteBalance = 5200;
      const c = scene.camera;
      s.camX = c.x; s.camZ = c.z; s.camHeight = c.height; s.camYaw = c.yaw;
      s.focal = c.focal; s.lensId = c.lens;
      if (constraint?.apply) constraint.apply(s);
    }
  };
}
