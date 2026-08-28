/**
 * Keylight - photometric constants.
 *
 * Everything in the simulator is computed in real photometric units
 * (cd/m2, lux, lux-seconds) and only normalised to a picture at the very
 * end. That is the whole reason the sim can be probed at the edges without
 * lying: there is no per-scene fudge factor anywhere in the chain.
 *
 * The normalisation identity the entire engine rests on:
 *
 *     R = Lt * ISO / (K * N^2)
 *
 * where Lt is "luminance times time" at a surface in cd*s/m2, N is the
 * f-number, and R is scene luminance relative to middle grey (R = 1 means
 * the surface lands exactly on middle grey). Derivation in exposure.js.
 */

/** Reflected-light meter calibration constant. ISO 2720 permits 10.6-13.4. */
export const K_METER = 12.5;

/** Middle grey reflectance. */
export const MIDDLE_GREY = 0.18;

/** Reference sensitivity for all EV math. */
export const ISO_REF = 100;

/**
 * Luminance in cd/m2 that meters as EV `ev` at ISO 100.
 *   L = K * 2^EV / S
 */
export const LUM_PER_EV100 = K_METER / ISO_REF; // 0.125 cd/m2 at EV 0

/**
 * Flash guide-number coefficient.
 *
 * A guide number is defined so that N = GN / d gives correct exposure of an
 * 18% grey card at ISO 100. Working backwards through the normalisation
 * identity (see exposure.js) the illuminance-seconds a unit delivers is
 *
 *     E_ls = FLASH_LUXSEC_COEFF * GN^2 / d^2
 *
 * and the coefficient is forced, not chosen:
 *     C = pi * (K/S) / 0.18
 */
export const FLASH_LUXSEC_COEFF = (Math.PI * LUM_PER_EV100) / MIDDLE_GREY; // ~2.1817

/** Focal-plane shutter sync speed, in seconds. 1/250 on the sim body. */
export const SYNC_SPEED = Math.pow(2, -8); // the 1/250 mark is exactly 1/256

/**
 * High speed sync cost. HSS turns one pulse into a burst that has to burn for
 * the entire shutter travel, so only the slice under the moving slit exposes.
 * Loss at sync speed is the pulse-train inefficiency; beyond that it doubles
 * every time the slit halves.
 */
export const HSS_BASE_LOSS_STOPS = 1.7;

/** Sensor model: stops of highlight headroom above middle grey before clip. */
export const HIGHLIGHT_HEADROOM_STOPS = 3.5;

/** Total usable dynamic range in stops (modern full-frame raw). */
export const SENSOR_DYNAMIC_RANGE_STOPS = 14;

/** ISO above which grain becomes visible in the render. */
export const NOISE_FLOOR_ISO = 3200;

/** Aperture past which diffraction visibly softens the frame. */
export const DIFFRACTION_ONSET_FSTOP = 16;

/** Sensor dimensions in mm, for field-of-view and crop-factor math. */
export const SENSOR_FULL_FRAME = { w: 36, h: 24, crop: 1.0 };
export const SENSOR_APSC = { w: 23.5, h: 15.7, crop: 1.53 };
