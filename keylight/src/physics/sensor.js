/**
 * Keylight - sensor response.
 *
 * The tone curve is deliberately identity below the knee. Under about 1.5
 * stops over middle grey the render is literally scene-referred linear, so
 * when the app says "that was one stop" the pixels moved by exactly one
 * stop and a user probing the model gets the truth back. Only the highlight
 * shoulder is shaped, and it asymptotes rather than hitting a digital wall.
 */

import {
  MIDDLE_GREY,
  HIGHLIGHT_HEADROOM_STOPS,
  SENSOR_DYNAMIC_RANGE_STOPS,
  NOISE_FLOOR_ISO,
  DIFFRACTION_ONSET_FSTOP
} from './constants.js';

/** Scene-linear value at which the sensor saturates. */
export const CLIP_LINEAR = MIDDLE_GREY * Math.pow(2, HIGHLIGHT_HEADROOM_STOPS);

/** Scene-linear value at which signal disappears into the noise floor. */
export const NOISE_FLOOR_LINEAR =
  MIDDLE_GREY * Math.pow(2, HIGHLIGHT_HEADROOM_STOPS - SENSOR_DYNAMIC_RANGE_STOPS);

/** Where the highlight shoulder starts, in scene-linear. */
export const KNEE_LINEAR = MIDDLE_GREY * Math.pow(2, 1.5);

/**
 * Highlight rolloff. Linear up to the knee, then an exponential shoulder
 * that approaches but never reaches 1.0.
 */
export function toneMap(x) {
  if (x <= KNEE_LINEAR) return Math.max(0, x);
  const span = 1.0 - KNEE_LINEAR;
  return KNEE_LINEAR + span * (1 - Math.exp(-(x - KNEE_LINEAR) / span));
}

/** True if the scene-referred value is past sensor saturation. */
export function isClipped(sceneLinear) {
  return sceneLinear >= CLIP_LINEAR;
}

/** True if the scene-referred value has fallen into the noise floor. */
export function isCrushed(sceneLinear) {
  return sceneLinear <= NOISE_FLOOR_LINEAR;
}

/** Stops above (+) or below (-) middle grey. */
export function stopsFromMiddleGrey(sceneLinear) {
  return Math.log2(Math.max(1e-9, sceneLinear) / MIDDLE_GREY);
}

/** Linear -> sRGB display encoding. */
export function encodeSRGB(v) {
  const c = Math.max(0, Math.min(1, v));
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export function decodeSRGB(v) {
  const c = Math.max(0, Math.min(1, v));
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Relative noise amplitude. Photon shot noise scales as sqrt(signal), and
 * raising ISO amplifies a smaller collected charge, so relative noise grows
 * as sqrt(ISO). Below the stated floor it is not worth rendering.
 */
export function noiseAmplitude(iso, sceneLinear) {
  if (iso <= NOISE_FLOOR_ISO / 2) return 0;
  const isoFactor = Math.sqrt(iso / NOISE_FLOOR_ISO);
  const signal = Math.max(NOISE_FLOOR_LINEAR, sceneLinear);
  return 0.022 * isoFactor / Math.sqrt(signal / MIDDLE_GREY);
}

/**
 * Diffraction blur radius, in sensor pixels.
 *
 * Airy disc diameter is 2.44 * lambda * N. Once that exceeds the pixel
 * pitch, resolution starts going away, and it does so regardless of how good
 * the lens is.
 */
export function diffractionBlurPixels(fNumber, pixelPitchMicrons = 5.94) {
  const airyMicrons = 2.44 * 0.55 * fNumber; // lambda 550nm expressed in microns
  const excess = airyMicrons - pixelPitchMicrons;
  if (excess <= 0) return 0;
  return excess / pixelPitchMicrons;
}

export function isDiffractionVisible(fNumber) {
  return fNumber > DIFFRACTION_ONSET_FSTOP;
}

/** Build a 256-bin RGB + luma histogram from an RGBA byte buffer. */
export function histogramFrom(pixels, bins = 256) {
  const r = new Uint32Array(bins);
  const g = new Uint32Array(bins);
  const b = new Uint32Array(bins);
  const l = new Uint32Array(bins);
  const scale = (bins - 1) / 255;
  for (let i = 0; i < pixels.length; i += 4) {
    const pr = pixels[i], pg = pixels[i + 1], pb = pixels[i + 2];
    r[(pr * scale) | 0]++;
    g[(pg * scale) | 0]++;
    b[(pb * scale) | 0]++;
    l[((0.2126 * pr + 0.7152 * pg + 0.0722 * pb) * scale) | 0]++;
  }
  return { r, g, b, l, bins };
}

/**
 * Diffraction blur expressed in render-buffer pixels rather than sensor
 * pixels. The render is a fraction of the sensor's linear resolution, so a
 * blur that is real but sub-pixel at f/11 only becomes visible past f/16 -
 * which is exactly what happens when you look at the actual files.
 */
export function diffractionBlurRenderPixels(fNumber, renderWidthPx, sensorWidthPx = 6000, pixelPitchMicrons = 5.94) {
  return diffractionBlurPixels(fNumber, pixelPitchMicrons) * (renderWidthPx / sensorWidthPx);
}
