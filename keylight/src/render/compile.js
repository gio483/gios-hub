/**
 * Keylight - turn a declared scene into geometry, materials and uniforms.
 *
 * Interior brightness is never declared. Only the exterior EV behind the
 * glass, the fixture lumens and the surface albedos are. Everything the room
 * actually looks like is transported from those by the same maths the
 * headless model uses.
 */

import { MeshBuilder } from './geometry.js';
import { hexToLinear, kelvinToRGB } from '../physics/color.js';
import { windowLuminance, fixtureIntensity, fixtureSurfaceLuminance } from '../physics/ambient.js';

/** Inward-facing wall frames. u runs along the wall, v runs up. */
export function wallFrame(which, room) {
  const hw = room.width / 2, hd = room.depth / 2;
  switch (which) {
    case '+x': return { origin: [hw, 0, -hd], right: [0, 0, 1], width: room.depth, normal: [-1, 0, 0] };
    case '-x': return { origin: [-hw, 0, hd], right: [0, 0, -1], width: room.depth, normal: [1, 0, 0] };
    case '+z': return { origin: [hw, 0, hd], right: [-1, 0, 0], width: room.width, normal: [0, 0, -1] };
    case '-z': return { origin: [-hw, 0, -hd], right: [1, 0, 0], width: room.width, normal: [0, 0, 1] };
    default: throw new Error(`unknown wall ${which}`);
  }
}

const at = (frame, u, v) => [
  frame.origin[0] + frame.right[0] * u,
  frame.origin[1] + v,
  frame.origin[2] + frame.right[2] * u
];

/** What is on the other side of the glass. Purely cosmetic; the EV is what matters. */
export const VIEW_TYPES = { none: 0, foliage: 1, sky: 2, city: 3, courtyard: 4 };

export function compileScene(scene) {
  const room = scene.room;
  const matIds = {};
  const matList = [];
  for (const [name, def] of Object.entries(scene.materials)) {
    matIds[name] = matList.length;
    matList.push({ name, ...def });
  }
  const idOf = (name) => {
    if (matIds[name] === undefined) throw new Error(`scene ${scene.id}: no material "${name}"`);
    return matIds[name];
  };

  // Trim carpentry gets its own material - painted, satin, slightly proud
  // of the wall - added automatically so every scene reads as built rather
  // than extruded.
  const trimId = matList.length;
  matIds.__trim = trimId;
  matList.push({
    name: '__trim', albedo: scene.trimColor || '#e9e6de', roughness: 0.5, spec: 0.08
  });

  const mb = new MeshBuilder();
  const occluders = [];
  const hw = room.width / 2, hd = room.depth / 2, H = room.ceiling;

  // Shell.
  mb.quad([-hw, 0, hd], [hw, 0, hd], [hw, 0, -hd], [-hw, 0, -hd], idOf(scene.floorMaterial || 'floor'));
  mb.quad([-hw, H, -hd], [hw, H, -hd], [hw, H, hd], [-hw, H, hd], idOf(scene.ceilingMaterial || 'ceiling'));

  const holesByWall = {};
  for (const w of scene.windows || []) (holesByWall[w.wall] ||= []).push(w);
  for (const d of scene.openings || []) (holesByWall[d.wall] ||= []).push(d);

  for (const which of ['+x', '-x', '+z', '-z']) {
    const f = wallFrame(which, room);
    const holes = (holesByWall[which] || []).map((h) => ({ u: h.u, v: h.v, w: h.w, h: h.h }));
    const matName = (scene.wallMaterials && scene.wallMaterials[which]) || 'wall';
    mb.wallWithHoles(f.origin, f.right, [0, 1, 0], f.width, H, holes, idOf(matName));
  }

  // Windows: a self-luminous pane just inside the wall plane, which is also
  // the area emitter the shader integrates over.
  const windows = [];
  for (const w of scene.windows || []) {
    const f = wallFrame(w.wall, room);
    const inset = 0.06;
    const n = f.normal;
    const centre = at(f, w.u, w.v).map((c, i) => c + n[i] * inset);
    const right = [f.right[0] * (w.w / 2), 0, f.right[2] * (w.w / 2)];
    const up = [0, w.h / 2, 0];
    const lum = windowLuminance(w.ev);
    const rgb = kelvinToRGB(w.kelvin);
    windows.push({
      centre, right, up,
      radiance: [lum * rgb[0], lum * rgb[1], lum * rgb[2]],
      area: w.w * w.h, ev: w.ev, kelvin: w.kelvin, wall: w.wall, spec: w
    });
    // Visible pane, rendered as pure emission.
    const paneMat = matList.length;
    matList.push({
      name: `__pane_${windows.length}`, albedo: '#000000', roughness: 1, spec: 0,
      emissive: [lum * rgb[0], lum * rgb[1], lum * rgb[2]],
      view: VIEW_TYPES[w.view || 'foliage'] ?? 1
    });
    const c0 = [centre[0] - right[0], centre[1] - up[1], centre[2] - right[2]];
    const c1 = [centre[0] + right[0], centre[1] - up[1], centre[2] + right[2]];
    const c2 = [centre[0] + right[0], centre[1] + up[1], centre[2] + right[2]];
    const c3 = [centre[0] - right[0], centre[1] + up[1], centre[2] - right[2]];
    mb.quadUV01(c0, c1, c2, c3, paneMat);
    // Reveal, so the opening reads as a wall thickness rather than a sticker.
    if (w.reveal !== false) {
      const rm = idOf('wall');
      const o0 = [c0[0] - n[0] * inset, c0[1], c0[2] - n[2] * inset];
      const o1 = [c1[0] - n[0] * inset, c1[1], c1[2] - n[2] * inset];
      const o2 = [c2[0] - n[0] * inset, c2[1], c2[2] - n[2] * inset];
      const o3 = [c3[0] - n[0] * inset, c3[1], c3[2] - n[2] * inset];
      mb.quad(o0, c0, c3, o3, rm);
      mb.quad(c1, o1, o2, c2, rm);
      mb.quad(o0, o1, c1, c0, rm);
      mb.quad(c3, c2, o2, o3, rm);
    }
  }

  // Carpentry. Baseboards and crown around the perimeter, casings and a
  // sill around every window. None of it is authored per scene; it is what
  // any built room has, so the compiler puts it there.
  {
    const bb = { h: 0.11, t: 0.024, inset: 0.011 };
    for (const [sx, sz, w, d] of [
      [hw - bb.inset, 0, bb.t, room.depth - 0.06], [-hw + bb.inset, 0, bb.t, room.depth - 0.06],
      [0, hd - bb.inset, room.width - 0.06, bb.t], [0, -hd + bb.inset, room.width - 0.06, bb.t]
    ]) {
      mb.box(sx, bb.h / 2, sz, w, bb.h, d, trimId, 0, 0b111101);
      if (H <= 3.3) mb.box(sx, H - 0.033, sz, w, 0.066, d, trimId, 0, 0b101111);
    }
    for (const w of scene.windows || []) {
      const f = wallFrame(w.wall, room);
      const pc = [
        f.origin[0] + f.right[0] * w.u, w.v, f.origin[2] + f.right[2] * w.u
      ];
      const n = f.normal;
      const alongX = Math.abs(f.right[0]) > 0.5;   // u runs along world x
      const put = (du, dv, lenU, lenV, thick, inw) => {
        const cx = pc[0] + f.right[0] * du + n[0] * inw;
        const cz = pc[2] + f.right[2] * du + n[2] * inw;
        const dimU = alongX ? [lenU, thick] : [thick, lenU];
        mb.box(cx, pc[1] + dv, cz, dimU[0], lenV, dimU[1], trimId);
      };
      put(0, w.h / 2 + 0.034, w.w + 0.15, 0.068, 0.05, 0.014);            // head casing
      if (w.v - w.h / 2 > 0.15) put(0, -w.h / 2 - 0.028, w.w + 0.2, 0.056, 0.1, 0.03); // sill
      put(-(w.w / 2 + 0.034), 0, 0.068, w.h + 0.15, 0.05, 0.014);          // jambs
      put(w.w / 2 + 0.034, 0, 0.068, w.h + 0.15, 0.05, 0.014);
    }
  }

  // Fixtures: a point source for the throw, plus a visible glowing element.
  const fixtures = [];
  for (const fx of scene.fixtures || []) {
    const rgb = kelvinToRGB(fx.kelvin);
    const I = fixtureIntensity(fx.lumens, fx.solidAngle || 4 * Math.PI);
    fixtures.push({
      pos: [fx.x, fx.y, fx.z],
      intensity: [I * rgb[0], I * rgb[1], I * rgb[2]],
      lumens: fx.lumens, kelvin: fx.kelvin, spec: fx
    });
    const r = fx.radius || 0.05;
    const emitLum = fixtureSurfaceLuminance(fx.lumens, 4 * Math.PI * r * r);
    const bulbMat = matList.length;
    matList.push({
      name: `__bulb_${fixtures.length}`, albedo: '#000000', roughness: 1, spec: 0,
      emissive: [emitLum * rgb[0], emitLum * rgb[1], emitLum * rgb[2]]
    });
    mb.cylinder(fx.x, fx.y, fx.z, r, r, r * 1.9, bulbMat, 10);
  }

  // Props.
  for (const p of scene.props || []) {
    const m = idOf(p.mat);
    if (p.type === 'cyl') {
      mb.cylinder(p.x, p.y, p.z, p.rTop ?? p.r, p.rBot ?? p.r, p.h, m, p.segments || 14, p.caps !== false);
    } else if (p.type === 'quad') {
      mb.quad(p.a, p.b, p.c, p.d, m);
    } else {
      mb.box(p.x, p.y, p.z, p.w, p.h, p.d, m, p.yaw || 0, p.faces ?? 0b111111);
    }
    if (p.occluder !== false && p.type !== 'quad') {
      const w = p.type === 'cyl' ? (p.rBot ?? p.r) * 1.7 : p.w;
      const d = p.type === 'cyl' ? (p.rBot ?? p.r) * 1.7 : p.d;
      const h = p.h;
      if (w * d * h > 0.02) {
        occluders.push({ centre: [p.x, p.y, p.z], half: [w / 2, h / 2, d / 2], yaw: p.yaw || 0 });
      }
    }
  }

  // The photographer's own hardware gets a material so it can be rendered and,
  // more to the point, detected in the frame and in mirrors.
  const gearMatId = matList.length;
  matList.push({ name: '__gear', albedo: '#1a1c20', roughness: 0.55, spec: 0.14, gear: true });

  // Room statistics that drive the interreflection series.
  const floorA = room.width * room.depth;
  const wallA = 2 * (room.width + room.depth) * H;
  const surfaceArea = 2 * floorA + wallA;
  const lin = (name) => hexToLinear(scene.materials[name].albedo);
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const avgReflectance =
    (lum(lin(scene.ceilingMaterial || 'ceiling')) * floorA +
     lum(lin(scene.floorMaterial || 'floor')) * floorA +
     lum(lin('wall')) * wallA) / surfaceArea;

  // Colour of the interreflected fill: the flux-weighted average of every
  // shell surface, not the wall alone. A walnut-panelled room with a white
  // ceiling bounces light that is warm but nowhere near full wood
  // saturation - most of the returned flux came off the brightest surface.
  // The small neutral admixture stands in for furniture, trim and books.
  const fillRGB = [0, 0, 0];
  for (const [name, area] of [
    [scene.ceilingMaterial || 'ceiling', floorA],
    [scene.floorMaterial || 'floor', floorA],
    ['wall', wallA]
  ]) {
    const c = lin(name);
    for (let i = 0; i < 3; i++) fillRGB[i] += c[i] * area;
  }
  const fillLum = lum(fillRGB) || 1;
  for (let i = 0; i < 3; i++) fillRGB[i] = 0.85 * (fillRGB[i] / fillLum) + 0.15;

  const kinds = matList.map((m) => {
    if (m.gear) return 5;
    if (m.name.startsWith('__pane')) return 1;
    if (m.name.startsWith('__bulb')) return 2;
    if ((m.mirror || 0) > 0.5) return 3;
    if (m.name === (scene.ceilingMaterial || 'ceiling')) return 6;
    if (m.name === (scene.floorMaterial || 'floor')) return 7;
    if ((m.spec || 0) >= 0.25) return 4;
    return 0;
  });

  const attrs = mb.toAttributes();
  return {
    scene, attrs, materials: matList, occluders, windows, fixtures,
    surfaceArea, avgReflectance, gearMatId, kinds,
    fillTint: normaliseTint(fillRGB),
    triangleCount: attrs.position.length / 9
  };
}

function normaliseTint(rgb) {
  const l = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return l < 1e-5 ? [1, 1, 1] : [rgb[0] / l, rgb[1] / l, rgb[2] / l];
}
