/**
 * Keylight - flash output model.
 *
 * A guide number is defined as: correct exposure of an 18% grey card at
 * ISO 100 happens at N = GN / d. Running that through the normalisation
 * identity in exposure.js pins the illuminance-seconds a head delivers:
 *
 *     E_ls = C * GN^2 / d^2,   C = pi * (K/S) / 0.18   (constants.js)
 *
 * The coefficient is forced by the definition, not tuned. Every modifier,
 * gel and bounce below is a multiplier on E_ls, expressed in stops, and every
 * one of those stop costs is derived from geometry or from a published
 * transmission figure rather than picked to make a scene look right.
 */

import {
  FLASH_LUXSEC_COEFF,
  SYNC_SPEED,
  HSS_BASE_LOSS_STOPS
} from './constants.js';

/** Power fraction from a "1/n" setting. 1/1 -> 1, 1/128 -> 0.0078125 */
export function powerFraction(denominator) {
  return 1 / denominator;
}

export const POWER_SETTINGS = [1, 2, 4, 8, 16, 32, 64, 128];

/**
 * Illuminance-seconds delivered on-axis at distance d.
 * `stopsLost` folds in modifier, gel, bounce and HSS penalties.
 */
export function illuminanceSeconds(guideNumber, distance, powerDenominator, stopsLost = 0) {
  if (distance <= 0.0001) distance = 0.0001;
  const base = (FLASH_LUXSEC_COEFF * guideNumber * guideNumber) / (distance * distance);
  return base * powerFraction(powerDenominator) * Math.pow(2, -stopsLost);
}

/**
 * Distance-independent throw coefficient, in lux-second-metres-squared.
 * The renderer divides this by d^2 per fragment, so the inverse square law
 * lives in the shader as literal division rather than as an approximation.
 */
export function throwCoefficient(guideNumber, powerDenominator, stopsLost = 0) {
  return (
    FLASH_LUXSEC_COEFF *
    guideNumber * guideNumber *
    powerFraction(powerDenominator) *
    Math.pow(2, -stopsLost)
  );
}

/**
 * Aperture that correctly exposes a grey card at `distance`.
 * The classic N = GN/d, extended for ISO and losses.
 */
export function apertureForCorrectFlash(guideNumber, distance, powerDenominator, iso = 100, stopsLost = 0) {
  const gnEffective =
    guideNumber * Math.sqrt(powerFraction(powerDenominator)) *
    Math.sqrt(iso / 100) * Math.pow(2, -stopsLost / 2);
  return gnEffective / distance;
}

/**
 * How far a flash-lit grey card lands from middle grey, in stops.
 * Note the absence of shutter. This is the asymmetry the whole app exists
 * to teach, and it is structural here rather than a special case.
 */
export function flashStopsFromGrey({ guideNumber, distance, powerDenominator, aperture, iso, stopsLost = 0 }) {
  const correct = apertureForCorrectFlash(guideNumber, distance, powerDenominator, iso, stopsLost);
  return 2 * Math.log2(correct / aperture);
}

/* ------------------------------------------------------------------ */
/* Sync speed                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fraction of frame height covered by the shutter curtain shadow.
 *
 * A focal-plane shutter above sync speed never fully opens: the second
 * curtain starts before the first has finished travelling, so a slit of
 * shrinking width sweeps the sensor. Slit width is proportional to shutter
 * time, so the covered fraction is 1 - t/t_sync.
 *
 * Returns 0 at or below sync speed, approaching 1 at 1/4000.
 */
export function syncBandCoverage(shutterSeconds, hssEnabled = false, syncSpeed = SYNC_SPEED) {
  if (hssEnabled) return 0;
  if (shutterSeconds >= syncSpeed) return 0;
  return Math.max(0, Math.min(0.97, 1 - shutterSeconds / syncSpeed));
}

/**
 * Stops of flash power lost to high speed sync.
 *
 * HSS fires a pulse train for the entire curtain travel so the moving slit
 * always sees light. Only the slice under the slit lands on the sensor, so
 * the loss grows as the slit narrows: one extra stop per halving.
 */
export function hssLossStops(shutterSeconds, syncSpeed = SYNC_SPEED) {
  if (shutterSeconds >= syncSpeed) return 0;
  return HSS_BASE_LOSS_STOPS + Math.log2(syncSpeed / shutterSeconds);
}

/* ------------------------------------------------------------------ */
/* Bounce                                                              */
/* ------------------------------------------------------------------ */

/**
 * Bounce off a diffuse surface, derived rather than tabulated.
 *
 * Flux I/d1^2 lands on a patch of area A = pi*(d1*tan(theta))^2. The patch
 * re-radiates as a Lambertian source of luminance L = E*rho/pi, and the
 * subject at d2 receives L*A*cos/d2^2. Expanding:
 *
 *     E_subject = I * rho * tan^2(theta) * cos / d2^2
 *
 * d1 cancels: moving the head away from the ceiling spreads the patch by
 * exactly as much as it dims it. What survives is the beam angle (a tight
 * beam wastes less), the surface albedo, and the distance from the patch.
 *
 * A 60 degree fresnel on an 0.8 albedo ceiling gives tan^2(30)*0.8 = 0.267,
 * which is 1.9 stops, and the longer patch-to-subject path adds the rest.
 * That lands inside the 2 to 3 stop range photographers actually measure.
 */
export function bounceTransfer({ beamHalfAngleDeg, surfaceAlbedo, patchToSubject, directDistance }) {
  const t = Math.tan((beamHalfAngleDeg * Math.PI) / 180);
  // Energy conservation caps the tan-squared term at 1: a diffuse patch can
  // approach but never beat a mirror, so bounced light can never exceed
  // albedo times the direct beam. Without the cap a wide bare bulb aimed at
  // the ceiling computes a six-stop GAIN, which is nonsense the moment you
  // say it out loud.
  const spread = Math.min(1, t * t) * surfaceAlbedo;
  const geometry = (directDistance * directDistance) / Math.max(0.04, patchToSubject * patchToSubject);
  return spread * geometry;
}

export function bounceLossStops(args) {
  return -Math.log2(Math.max(1e-6, bounceTransfer(args)));
}

/**
 * Apparent source diameter of a bounce patch, in metres.
 * Shadow softness is driven by source size relative to subject distance, so
 * this is what turns a hard point into a broad soft source.
 */
export function bouncePatchDiameter(distanceToSurface, beamHalfAngleDeg) {
  // Softness keeps growing past the energy cap - a wide bulb really does
  // light most of a ceiling - but the grazing tail contributes little, so
  // the apparent source stops growing at about a 68 degree half-angle.
  const t = Math.min(2.5, Math.tan((beamHalfAngleDeg * Math.PI) / 180));
  return 2 * distanceToSurface * t;
}

/**
 * Penumbra ratio: apparent angular size of the source from the subject.
 * 0 is a hard point source, above ~0.5 is wraparound soft.
 */
export function softness(sourceDiameter, subjectDistance) {
  return Math.min(1, sourceDiameter / Math.max(0.05, subjectDistance));
}
