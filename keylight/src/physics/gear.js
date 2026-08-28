/**
 * Keylight - the actual gear list.
 *
 * Guide numbers are the manufacturer figures at ISO 100 in metres. Modifier
 * losses are transmission plus spill, in stops, from published efficiency
 * data. Source diameters drive shadow softness; beam half-angles drive both
 * coverage and how much a bounce wastes.
 */

export const HEADS = {
  ad200_fresnel: {
    id: 'ad200_fresnel', label: 'AD200 Pro (fresnel)', short: 'AD200 F',
    guideNumber: 60, watts: 200, owned: true, price: 0,
    sourceDiameter: 0.07, beamHalfAngle: 30, recycleFull: 1.8
  },
  ad200_bare: {
    id: 'ad200_bare', label: 'AD200 Pro (bare bulb)', short: 'AD200 B',
    guideNumber: 52, watts: 200, owned: true, price: 0,
    sourceDiameter: 0.05, beamHalfAngle: 85, recycleFull: 1.8
  },
  v1: {
    id: 'v1', label: 'V1 round-head speedlight', short: 'V1',
    guideNumber: 28, watts: 76, owned: true, price: 0,
    sourceDiameter: 0.05, beamHalfAngle: 38, recycleFull: 1.5
  },
  ad200_second: {
    id: 'ad200_second', label: 'AD200 Pro (second body)', short: 'AD200 #2',
    guideNumber: 60, watts: 200, owned: false, price: 350,
    sourceDiameter: 0.07, beamHalfAngle: 30, recycleFull: 1.8
  },
  ad200_third: {
    id: 'ad200_third', label: 'AD200 Pro (third body)', short: 'AD200 #3',
    guideNumber: 60, watts: 200, owned: false, price: 350,
    sourceDiameter: 0.07, beamHalfAngle: 30, recycleFull: 1.8
  },
  ad400: {
    id: 'ad400', label: 'AD400 Pro', short: 'AD400',
    guideNumber: 72, watts: 400, owned: false, price: 650,
    sourceDiameter: 0.10, beamHalfAngle: 27, recycleFull: 1.0
  }
};

export const MODIFIERS = {
  none: {
    id: 'none', label: 'Bare head', lossStops: 0,
    sourceDiameter: null, beamHalfAngle: null, owned: true, price: 0,
    note: 'Hard shadows, full output, easy to overshoot.'
  },
  grid: {
    id: 'grid', label: '20 degree grid', lossStops: 1.0,
    sourceDiameter: 0.07, beamHalfAngle: 10, owned: false, price: 45,
    note: 'Narrow pool of light. Kills spill onto walls you do not want lit.'
  },
  magsphere: {
    id: 'magsphere', label: 'Sphere diffuser', lossStops: 1.5,
    sourceDiameter: 0.15, beamHalfAngle: 85, owned: false, price: 60,
    note: 'Near-omni. Made for bouncing off everything at once.'
  },
  umbrella_through: {
    id: 'umbrella_through', label: '36in shoot-through umbrella', lossStops: 1.3,
    sourceDiameter: 0.9, beamHalfAngle: 55, owned: false, price: 40,
    note: 'Cheap and soft, but it sprays light everywhere behind you too.'
  },
  umbrella_bounce: {
    id: 'umbrella_bounce', label: '36in bounce umbrella', lossStops: 1.6,
    sourceDiameter: 0.9, beamHalfAngle: 50, owned: false, price: 45,
    note: 'Softer and more controlled than shoot-through.'
  },
  softbox_2x1: {
    id: 'softbox_2x1', label: '2x1 softbox', lossStops: 1.5,
    sourceDiameter: 0.75, beamHalfAngle: 45, owned: false, price: 130,
    note: 'Rectangular source. Reads well in glass and polished counters.'
  },
  octa_36: {
    id: 'octa_36', label: '36in octabox', lossStops: 1.7,
    sourceDiameter: 0.9, beamHalfAngle: 45, owned: false, price: 160,
    note: 'Big and round. The answer when the ceiling is out of reach.'
  }
};

export const LENSES = {
  wide_zoom: {
    id: 'wide_zoom', label: '17-28mm f/2.8', min: 17, max: 28,
    maxAperture: 2.8, sensor: 'ff', owned: true, price: 0
  },
  standard_zoom: {
    id: 'standard_zoom', label: '28-75mm f/2.8', min: 28, max: 75,
    maxAperture: 2.8, sensor: 'ff', owned: true, price: 0
  },
  tele_zoom: {
    id: 'tele_zoom', label: '35-150mm f/2-2.8', min: 35, max: 150,
    maxAperture: 2.0, sensor: 'ff', owned: true, price: 0
  },
  apsc_wide: {
    id: 'apsc_wide', label: '11-20mm f/2.8 (APS-C)', min: 11, max: 20,
    maxAperture: 2.8, sensor: 'apsc', owned: true, price: 0
  },
  tilt_shift: {
    id: 'tilt_shift', label: '24mm tilt-shift f/3.5', min: 24, max: 24,
    maxAperture: 3.5, sensor: 'ff', owned: false, price: 0,
    unlockModule: 10, tiltShift: true,
    maxShiftMm: 12, imageCircleMm: 20
  }
};

export const MAX_LIGHTS = 4;

export function headById(id) { return HEADS[id]; }
export function modifierById(id) { return MODIFIERS[id] || MODIFIERS.none; }
export function lensById(id) { return LENSES[id]; }
