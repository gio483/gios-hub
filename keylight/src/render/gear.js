/**
 * Keylight - the photographer's own hardware, as real geometry.
 *
 * Light stands and the tripod are built into the scene rather than tracked as
 * abstract positions. That means a stand creeping into the corner of a 16mm
 * frame, or appearing in a bathroom mirror, is caught by looking at the actual
 * pixels rather than by a rule that guesses when it might have happened.
 */

import { MeshBuilder } from './geometry.js';

export const GEAR_MAT = 'gear';

export function buildGearGeometry(state, gearMatId) {
  const mb = new MeshBuilder();

  for (const l of state.lights) {
    if (!l.enabled) continue;
    const h = l.height;
    // Column
    mb.cylinder(l.x, h / 2, l.z, 0.017, 0.026, h, gearMatId, 8);
    // Three legs splayed from a third of the way up
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const r = 0.34;
      mb.box(l.x + Math.cos(a) * r * 0.5, h * 0.13, l.z + Math.sin(a) * r * 0.5,
        0.028, h * 0.26, r, gearMatId, -a);
    }
    // Head and modifier stub
    mb.box(l.x, h + 0.05, l.z, 0.10, 0.16, 0.10, gearMatId, (l.yaw * Math.PI) / 180);
  }

  // Tripod under the camera. It has legs, and at 16mm they get into the frame.
  const th = state.camHeight;
  mb.cylinder(state.camX, th * 0.78, state.camZ, 0.019, 0.028, th * 0.44, gearMatId, 8);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + ((state.camYaw * Math.PI) / 180) + Math.PI;
    const r = 0.4;
    mb.box(state.camX + Math.cos(a) * r * 0.5, th * 0.28, state.camZ + Math.sin(a) * r * 0.5,
      0.03, th * 0.56, r, gearMatId, -a);
  }

  return mb;
}

/**
 * The photographer. Standing behind the camera, and therefore squarely in the
 * mirror in scene three unless the lens can be shifted off axis.
 */
export function buildPhotographerGeometry(state, gearMatId) {
  const mb = new MeshBuilder();
  const yaw = (state.camYaw * Math.PI) / 180;
  const bx = state.camX - Math.sin(yaw) * 0.42;
  const bz = state.camZ - Math.cos(yaw) * 0.42;
  mb.box(bx, 0.95, bz, 0.46, 0.72, 0.26, gearMatId, yaw);   // torso
  mb.cylinder(bx, 1.46, bz, 0.10, 0.11, 0.24, gearMatId, 10); // head
  mb.box(bx, 0.35, bz, 0.36, 0.74, 0.24, gearMatId, yaw);   // legs
  return mb;
}
