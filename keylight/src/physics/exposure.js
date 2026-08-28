/**
 * Keylight - ambient exposure math.
 *
 * DERIVATION of the normalisation identity used by every other module.
 *
 * Exposure at the sensor plane for a steady source:
 *     H = q * L * t / N^2                       [lux-seconds]
 *
 * A surface renders as middle grey when it meters at the camera's EV, i.e.
 * when L = (K/S) * 2^EV100 with 2^EV100 = N^2 / t. Substituting:
 *     H_grey(ISO 100) = q * (K/100) * (N^2/t) * t / N^2 = q * K / 100
 * The q and the geometry drop out. At sensitivity S the sensor needs
 * 100/S as much light:
 *     H_grey(S) = q * (K/100) * (100/S)
 *
 * Therefore, writing Lt for "luminance times time" in cd*s/m2 (which is what
 * both ambient and flash reduce to):
 *
 *     R = H / H_grey(S) = [q*Lt/N^2] / [q*(K/100)*(100/S)]
 *       = Lt * S / (K * N^2)
 *
 * R = 1 is middle grey. Linear scene-referred value is 0.18 * R.
 *
 * Everything downstream - flash, windows, fixtures, bounce - only has to
 * produce an honest Lt. The camera then converts it the same way every time,
 * which is exactly why shutter moves ambient and not flash: shutter appears
 * in ambient's Lt and nowhere in flash's.
 */

import { K_METER, LUM_PER_EV100, ISO_REF, MIDDLE_GREY } from './constants.js';

/** Camera-setting EV at ISO 100. EV = log2(N^2 / t) */
export function evFromSettings(fNumber, shutterSeconds) {
  return Math.log2((fNumber * fNumber) / shutterSeconds);
}

/**
 * The EV the camera is actually metering for, once ISO is taken into account.
 * Raising ISO by a stop lets you shoot a scene one EV darker.
 */
export function effectiveCameraEV(fNumber, shutterSeconds, iso) {
  return evFromSettings(fNumber, shutterSeconds) - Math.log2(iso / ISO_REF);
}

/** Luminance in cd/m2 that meters as `ev` at ISO 100. */
export function luminanceFromEV(ev) {
  return LUM_PER_EV100 * Math.pow(2, ev);
}

/** Inverse of luminanceFromEV. */
export function evFromLuminance(luminance) {
  return Math.log2(luminance / LUM_PER_EV100);
}

/**
 * The core normalisation. Lt in cd*s/m2 -> luminance relative to middle grey.
 * R = 1.0 means the surface lands on middle grey.
 */
export function relativeToGrey(lt, fNumber, iso) {
  return (lt * iso) / (K_METER * fNumber * fNumber);
}

/** Scene-referred linear value (0.18 = middle grey), from Lt. */
export function linearFromLt(lt, fNumber, iso) {
  return MIDDLE_GREY * relativeToGrey(lt, fNumber, iso);
}

/**
 * How far a surface of luminance L lands from middle grey, in stops.
 * Positive = brighter than middle grey.
 */
export function stopsFromGrey(luminance, fNumber, shutterSeconds, iso) {
  const lt = luminance * shutterSeconds;
  return Math.log2(relativeToGrey(lt, fNumber, iso));
}

/**
 * Ambient exposure change, in stops, between two camera states.
 * Used by the coaching layer to say "that was two stops of ambient".
 */
export function ambientStopsBetween(a, b) {
  return (
    Math.log2((b.shutter / a.shutter) * ((a.aperture * a.aperture) / (b.aperture * b.aperture)) * (b.iso / a.iso))
  );
}

/**
 * Flash exposure change, in stops, between two camera states.
 * Shutter is deliberately absent. This asymmetry is the whole lesson.
 */
export function flashStopsBetween(a, b) {
  return Math.log2(((a.aperture * a.aperture) / (b.aperture * b.aperture)) * (b.iso / a.iso));
}

/**
 * Setting ladders.
 *
 * Cameras print nominal marks but set exact third-stop values: the mark that
 * reads f/5.6 is really f/5.657, and 1/125 is really 1/128. The sim stores
 * the exact values and prints the conventional labels, so "one stop" is
 * always exactly one stop no matter which controls you moved.
 */

const APERTURE_LABELS = [
  '2.8', '3.2', '3.5', '4', '4.5', '5', '5.6', '6.3', '7.1', '8',
  '9', '10', '11', '13', '14', '16', '18', '20', '22'
];

const SHUTTER_LABELS = [
  '30', '25', '20', '15', '13', '10', '8', '6', '5', '4', '3.2', '2.5', '2', '1.6', '1.3', '1',
  '1/1.3', '1/1.6', '1/2', '1/2.5', '1/3', '1/4', '1/5', '1/6', '1/8', '1/10',
  '1/13', '1/15', '1/20', '1/25', '1/30', '1/40', '1/50', '1/60', '1/80',
  '1/100', '1/125', '1/160', '1/200', '1/250', '1/320', '1/400', '1/500',
  '1/640', '1/800', '1/1000', '1/1250', '1/1600', '1/2000', '1/2500',
  '1/3200', '1/4000'
];

const ISO_LABELS = [
  '100', '125', '160', '200', '250', '320', '400', '500', '640', '800',
  '1000', '1250', '1600', '2000', '2500', '3200', '4000', '5000', '6400',
  '8000', '10000', '12800'
];

/** Exact f-numbers, f/2.8 (2^1.5) up to f/22 (2^4.5), in third stops. */
export const APERTURE_STOPS = APERTURE_LABELS.map((_, i) => Math.pow(2, 1.5 + i / 6));

/** Exact shutter times in seconds, 32s (2^5) down to 1/4096 (2^-12). */
export const SHUTTER_STOPS = SHUTTER_LABELS.map((_, i) => Math.pow(2, 5 - i / 3));

/** Exact sensitivities, ISO 100 to ISO 12800 in third stops. */
export const ISO_STOPS = ISO_LABELS.map((_, i) => 100 * Math.pow(2, i / 3));

const nearestIndex = (arr, v) => {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const d = Math.abs(Math.log2(arr[i] / v));
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
};

export function formatAperture(n) {
  return `f/${APERTURE_LABELS[nearestIndex(APERTURE_STOPS, n)]}`;
}

export function formatShutter(t) {
  return SHUTTER_LABELS[nearestIndex(SHUTTER_STOPS, t)];
}

export function formatISO(iso) {
  return ISO_LABELS[nearestIndex(ISO_STOPS, iso)];
}

export function apertureIndex(n) { return nearestIndex(APERTURE_STOPS, n); }
export function shutterIndex(t) { return nearestIndex(SHUTTER_STOPS, t); }
export function isoIndex(v) { return nearestIndex(ISO_STOPS, v); }

/** Nominal sync-speed mark, for interface copy. */
export const SYNC_SPEED_LABEL = '1/250';
