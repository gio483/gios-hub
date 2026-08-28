/**
 * Keylight - application state.
 * One plain object, serialised to localStorage. No framework, no store.
 */

import { APERTURE_STOPS, SHUTTER_STOPS, ISO_STOPS } from './physics/exposure.js';
import { MAX_LIGHTS } from './physics/gear.js';

export const STORAGE_KEY = 'keylight.v1';

export function defaultLight(id, x = 0, z = -1.5) {
  return {
    id, x, z, height: 1.9, yaw: 0, tilt: 0, mode: 'direct',
    headId: 'ad200_fresnel', modifierId: 'none', gelId: 'none',
    power: 4, enabled: true
  };
}

export function defaultState(scene) {
  const c = scene?.camera || {};
  return {
    sceneId: scene?.id || 'living-room',
    aperture: APERTURE_STOPS[9],           // f/8
    shutter: SHUTTER_STOPS[36],            // 1/125
    iso: ISO_STOPS[0],                     // 100
    whiteBalance: 5500,
    whiteBalanceAuto: false,
    hss: false,
    zebras: false,
    histogram: true,
    camX: c.x ?? 0, camZ: c.z ?? -3, camHeight: c.height ?? 1.35,
    camYaw: c.yaw ?? 0, tilt: 0,
    lensId: c.lens || 'wide_zoom',
    focal: c.focal || 24,
    shiftX: 0, shiftY: 0,
    lights: [defaultLight('L1', 1.4, -2.2)],
    selected: 'L1',
    modeling: false,
    vignette: 0.12
  };
}

export function addLight(state) {
  if (state.lights.length >= MAX_LIGHTS) return state;
  const n = state.lights.length + 1;
  const l = defaultLight(`L${n}`, -1.2 + n * 0.8, -1.8);
  state.lights.push(l);
  state.selected = l.id;
  return state;
}

export function removeLight(state, id) {
  state.lights = state.lights.filter((l) => l.id !== id);
  if (state.selected === id) state.selected = state.lights[0]?.id || null;
  return state;
}

export function selectedLight(state) {
  return state.lights.find((l) => l.id === state.selected) || null;
}

/* ---------------- persistence ---------------- */

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshProgress();
    const p = JSON.parse(raw);
    return { ...freshProgress(), ...p };
  } catch {
    return freshProgress();
  }
}

export function freshProgress() {
  return {
    completedModules: [],
    unlockedLenses: ['wide_zoom', 'standard_zoom', 'tele_zoom', 'apsc_wide'],
    ownedHeads: ['ad200_fresnel', 'ad200_bare', 'v1'],
    ownedModifiers: ['none'],
    currency: 0,
    bestScores: {},
    streak: 0,
    lastDailyDate: null,
    dailyHistory: [],
    inProgress: null,
    seenIntro: false,
    modelingPref: 'auto'
  };
}

export function saveProgress(p) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* private mode */ }
}
