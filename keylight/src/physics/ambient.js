/**
 * Keylight - ambient light transport.
 *
 * Interior brightness is never authored. Only the exterior luminance behind
 * the glass is authored, and the room's level falls out of the geometry:
 * a wall 5m from a 2x1.5m window receives a solid angle of roughly 0.12 sr,
 * so it sits about five stops under the view. That is why the window-to-room
 * gap in this sim behaves like a real room instead of like a number someone
 * typed in.
 */

import { LUM_PER_EV100 } from './constants.js';

/** Exterior luminance in cd/m2 for an authored window EV. */
export function windowLuminance(windowEV) {
  return LUM_PER_EV100 * Math.pow(2, windowEV);
}

/**
 * Exact projected solid angle of a rectangle seen from a point with a given
 * surface normal (Lambert's closed form). Irradiance from a uniform
 * Lambertian rectangle of luminance L is simply L * this.
 *
 * corners: four [x,y,z] in winding order. p: sample point. n: unit normal.
 */
export function projectedSolidAngle(corners, p, n) {
  const v = corners.map((c) => {
    const d = [c[0] - p[0], c[1] - p[1], c[2] - p[2]];
    const len = Math.hypot(d[0], d[1], d[2]) || 1e-6;
    return [d[0] / len, d[1] / len, d[2] / len];
  });
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const a = v[i];
    const b = v[(i + 1) % 4];
    let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    dot = Math.max(-1, Math.min(1, dot));
    const theta = Math.acos(dot);
    const cx = a[1] * b[2] - a[2] * b[1];
    const cy = a[2] * b[0] - a[0] * b[2];
    const cz = a[0] * b[1] - a[1] * b[0];
    const clen = Math.hypot(cx, cy, cz) || 1e-6;
    sum += theta * ((cx / clen) * n[0] + (cy / clen) * n[1] + (cz / clen) * n[2]);
  }
  return Math.max(0, sum * 0.5);
}

/** Direct illuminance (lux) on a surface from one window. */
export function windowIrradiance(corners, point, normal, windowEV) {
  return windowLuminance(windowEV) * projectedSolidAngle(corners, point, normal);
}

/**
 * Total luminous flux a window admits, in lumens.
 * A Lambertian emitter of radiance L and area A radiates pi * L * A.
 */
export function windowFlux(areaM2, windowEV) {
  return Math.PI * windowLuminance(windowEV) * areaM2;
}

/**
 * Interreflected fill, in lux, using the room-cavity form of the lumen
 * method. Every bounce keeps a fraction rho of the flux, and the geometric
 * series closes to rho / (1 - rho).
 *
 * This is why a white room floods with bounce and a dark wood office does
 * not, without either behaviour being written down anywhere.
 */
export function interreflectedIlluminance(fluxLumens, roomSurfaceAreaM2, avgReflectance) {
  const rho = Math.max(0.02, Math.min(0.92, avgReflectance));
  return (fluxLumens * rho) / (roomSurfaceAreaM2 * (1 - rho));
}

/**
 * Luminous intensity of a point-ish fixture, in candela.
 * A bare bulb radiating uniformly gives I = lumens / 4pi; a shaded fixture
 * throwing into a smaller solid angle concentrates that.
 */
export function fixtureIntensity(lumens, solidAngleSr = 4 * Math.PI) {
  return lumens / Math.max(0.1, solidAngleSr);
}

/**
 * Luminance of the glowing part of a fixture itself, in cd/m2.
 * These numbers are enormous - a 60W-equivalent bulb runs into the tens of
 * thousands - which is precisely why fixtures clip to featureless blobs the
 * moment the room is exposed correctly.
 */
export function fixtureSurfaceLuminance(lumens, emitterAreaM2) {
  return lumens / (Math.PI * Math.max(1e-4, emitterAreaM2));
}

/** Total flux, in lumen-seconds, a flash head throws into the room. */
export function flashFlux(throwCoefficient, beamHalfAngleDeg) {
  const cosT = Math.cos((beamHalfAngleDeg * Math.PI) / 180);
  return throwCoefficient * 2 * Math.PI * (1 - cosT);
}
