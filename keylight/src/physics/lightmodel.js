/**
 * Keylight - resolve a placed light into renderer-ready parameters.
 *
 * Bounce is handled exactly, not approximated. The derivation in flash.js
 * shows that flux landing on a diffuse patch and re-radiating is identical
 * to a new source sitting at the patch with intensity I * rho * tan^2(theta).
 * So a bounced head literally becomes a second, larger, dimmer, colour-shifted
 * light placed on the ceiling. Distance to the ceiling drops out of the
 * brightness (the patch grows exactly as fast as it dims) but stays in the
 * softness, which is why raising a bounced head softens without darkening.
 */

import { throwCoefficient, hssLossStops, bouncePatchDiameter } from './flash.js';
import { gelledKelvin, gelLossStops, kelvinToRGB, mulRGB, hexToLinear } from './color.js';
import { headById, modifierById } from './gear.js';
import { flashFlux } from './ambient.js';

const DEG = Math.PI / 180;
const FLASH_KELVIN = 5500;

/**
 * @param light  { x, z, height, yaw, tilt, mode, headId, modifierId, gelId, power, enabled }
 * @param room   { width, depth, ceiling, surfaces: { ceiling:{albedo,color}, wall:{...} } }
 * @param camera { shutter, hss }
 */
export function resolveLight(light, room, camera) {
  const head = headById(light.headId);
  const mod = modifierById(light.modifierId);
  if (!head) return null;

  const gel = light.gelId || 'none';
  const kelvin = gelledKelvin(FLASH_KELVIN, gel);

  const hss = camera.hss ? hssLossStops(camera.shutter) : 0;
  let lossStops = mod.lossStops + gelLossStops(gel) + hss;

  const beamHalfAngle = mod.beamHalfAngle ?? head.beamHalfAngle;
  let sourceDiameter = mod.sourceDiameter ?? head.sourceDiameter;

  // Where the light physically stands, in room coordinates (y up).
  const stand = [light.x, light.height, light.z];

  let origin = stand;
  let direction;
  let colorRGB = kelvinToRGB(kelvin);
  let bounceStops = 0;
  let coneHalfAngle = beamHalfAngle;
  let hemisphere = false;
  let bounceSurface = null;

  const yaw = (light.yaw || 0) * DEG;
  const tilt = (light.tilt || 0) * DEG;

  if (light.mode === 'ceiling') {
    const rise = Math.max(0.15, room.ceiling - light.height);
    const surf = room.surfaces.ceiling;
    origin = [light.x, room.ceiling - 0.02, light.z];
    direction = [0, -1, 0];
    // Virtual source intensity: I * rho * tan^2(theta). Exact, see header.
    const t2 = Math.min(1, Math.pow(Math.tan(beamHalfAngle * DEG), 2));  // energy cap, see flash.js
    bounceStops = -Math.log2(Math.max(1e-6, t2 * surf.albedo));
    colorRGB = mulRGB(colorRGB, normaliseTint(hexToLinear(surf.color)));
    sourceDiameter = bouncePatchDiameter(rise, beamHalfAngle);
    coneHalfAngle = 88;
    hemisphere = true;
    bounceSurface = { kind: 'ceiling', color: surf.color, albedo: surf.albedo, distance: rise };
  } else if (light.mode === 'wall') {
    const hit = raycastWall(light.x, light.z, yaw, room);
    const surf = room.surfaces.wall;
    origin = [hit.x, light.height, hit.z];
    direction = hit.normal;
    const t2 = Math.min(1, Math.pow(Math.tan(beamHalfAngle * DEG), 2));  // energy cap, see flash.js
    bounceStops = -Math.log2(Math.max(1e-6, t2 * surf.albedo));
    colorRGB = mulRGB(colorRGB, normaliseTint(hexToLinear(surf.color)));
    sourceDiameter = bouncePatchDiameter(Math.max(0.15, hit.distance), beamHalfAngle);
    coneHalfAngle = 88;
    hemisphere = true;
    bounceSurface = { kind: 'wall', color: surf.color, albedo: surf.albedo, distance: hit.distance };
  } else {
    direction = [Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt)];
  }

  lossStops += bounceStops;

  const coeff = throwCoefficient(head.guideNumber, light.power, lossStops);

  return {
    id: light.id,
    origin,
    direction: normalise(direction),
    stand,
    throwCoeff: coeff,
    colorRGB,
    kelvin,
    sourceDiameter,
    coneHalfAngle,
    hemisphere,
    beamHalfAngle,
    fluxLumenSeconds: flashFlux(coeff, hemisphere ? 88 : coneHalfAngle),
    losses: {
      modifier: mod.lossStops,
      gel: gelLossStops(gel),
      hss,
      bounce: bounceStops,
      total: lossStops
    },
    bounceSurface,
    head,
    modifier: mod
  };
}

/** Where a beam leaving (x,z) at heading `yaw` meets a wall. */
export function raycastWall(x, z, yaw, room) {
  const dx = Math.sin(yaw);
  const dz = Math.cos(yaw);
  const hw = room.width / 2;
  const hd = room.depth / 2;
  let best = Infinity;
  let normal = [0, 0, 1];
  if (dx > 1e-5) { const t = (hw - x) / dx; if (t > 0 && t < best) { best = t; normal = [-1, 0, 0]; } }
  if (dx < -1e-5) { const t = (-hw - x) / dx; if (t > 0 && t < best) { best = t; normal = [1, 0, 0]; } }
  if (dz > 1e-5) { const t = (hd - z) / dz; if (t > 0 && t < best) { best = t; normal = [0, 0, -1]; } }
  if (dz < -1e-5) { const t = (-hd - z) / dz; if (t > 0 && t < best) { best = t; normal = [0, 0, 1]; } }
  if (!isFinite(best)) best = 0.5;
  return { x: x + dx * best, z: z + dz * best, distance: best, normal };
}

/** Strip luminance out of a tint so it only shifts colour, not level. */
function normaliseTint(rgb) {
  const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  if (lum < 1e-5) return [1, 1, 1];
  return [rgb[0] / lum, rgb[1] / lum, rgb[2] / lum];
}

function normalise(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/**
 * Predicted exposure, in stops from middle grey, of an 18% grey card facing
 * a resolved light at a given distance. This is the number the in-app flash
 * meter reports, and it is the same maths the shader runs per fragment.
 */
export function meterFlash(resolved, distance, aperture, iso) {
  const lt = (0.18 * resolved.throwCoeff) / (Math.PI * Math.max(0.01, distance * distance));
  const R = (lt * iso) / (12.5 * aperture * aperture);
  return Math.log2(Math.max(1e-9, R));
}
