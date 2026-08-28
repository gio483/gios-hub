/**
 * Scene 6 - Entry hall, no windows.
 *
 * No ambient anchor at all. Nothing to balance against, nothing to hide
 * behind, and a narrow space where every light is close to a wall. Falloff
 * is the whole problem.
 */

export const hallway = {
  id: 'hallway',
  name: 'Entry hall',
  subtitle: 'No windows, pure flash',
  order: 6,
  brief:
    'Two and a half metres wide, six and a half long, and not a window in it. Two sconces and whatever you ' +
    'bring. With nothing to balance against, every decision is yours, and inverse square in a corridor this ' +
    'narrow is unforgiving.',
  difficulty: 3,
  room: { width: 2.5, depth: 6.6, ceiling: 2.62 },

  materials: {
    wall:     { albedo: '#cbc5b8', roughness: 0.94, spec: 0.02, tex: 2 },
    ceiling:  { albedo: '#eeeae2', roughness: 0.95, spec: 0.012, tex: 2 },
    floor:    { albedo: '#6d5c48', roughness: 0.28, spec: 0.18, tex: 1, texDir: 1 },
    runner:   { albedo: '#8b7f6c', roughness: 0.97, spec: 0.006, tex: 6 },
    oak:      { albedo: '#5d4630', roughness: 0.34, spec: 0.14, tex: 8 },
    brass:    { albedo: '#96793d', roughness: 0.20, spec: 0.52, tex: 10 },
    art:      { albedo: '#2d2a27', roughness: 0.6, spec: 0.05 },
    mirror:   { albedo: '#0a0c0e', roughness: 0.02, spec: 0.05, mirror: 0.85 },
    door:     { albedo: '#3f4a48', roughness: 0.42, spec: 0.10, tex: 2, texScale: 2 },
    plant:    { albedo: '#3d5836', roughness: 0.86, spec: 0.05, tex: 11, texScale: 2 },
    shade:    { albedo: '#e7e1d2', roughness: 0.92, spec: 0.03, tex: 5 }
  },

  windows: [],

  fixtures: [
    { x: -1.18, y: 1.80, z: -1.6, lumens: 300, kelvin: 2700, radius: 0.045, label: 'Sconce' },
    { x: -1.18, y: 1.80, z: 1.6,  lumens: 300, kelvin: 2700, radius: 0.045, label: 'Sconce' }
  ],

  props: [
    { type: 'box', x: 0, y: 0.008, z: 0, w: 1.3, h: 0.016, d: 5.4, mat: 'runner', occluder: false },
    { type: 'box', x: 1.14, y: 0.42, z: -0.6, w: 0.34, h: 0.05, d: 1.5, mat: 'oak' },
    { type: 'box', x: 1.14, y: 0.21, z: -1.25, w: 0.30, h: 0.42, d: 0.06, mat: 'oak', occluder: false },
    { type: 'box', x: 1.14, y: 0.21, z: 0.05, w: 0.30, h: 0.42, d: 0.06, mat: 'oak', occluder: false },
    { type: 'box', x: 1.20, y: 1.45, z: -0.6, w: 0.03, h: 1.20, d: 0.80, mat: 'mirror', occluder: false },
    { type: 'cyl', x: 1.14, y: 0.60, z: -1.05, r: 0.02, h: 0.30, mat: 'brass', occluder: false },
    { type: 'cyl', x: 1.14, y: 0.86, z: -1.05, rTop: 0.11, rBot: 0.15, h: 0.22, mat: 'shade', caps: false, occluder: false },
    // Sconce bodies
    { type: 'cyl', x: -1.20, y: 1.80, z: -1.6, rTop: 0.09, rBot: 0.06, h: 0.20, mat: 'brass', caps: false, occluder: false },
    { type: 'cyl', x: -1.20, y: 1.80, z: 1.6, rTop: 0.09, rBot: 0.06, h: 0.20, mat: 'brass', caps: false, occluder: false },
    // Art run
    { type: 'box', x: -1.22, y: 1.50, z: 0.2, w: 0.04, h: 0.70, d: 0.52, mat: 'art', occluder: false },
    { type: 'box', x: -1.22, y: 1.50, z: 2.9, w: 0.04, h: 0.70, d: 0.52, mat: 'art', occluder: false },
    // Door at the far end
    { type: 'box', x: 0, y: 1.05, z: 3.26, w: 1.0, h: 2.10, d: 0.06, mat: 'door', occluder: false },
    { type: 'cyl', x: 0.36, y: 1.02, z: 3.20, r: 0.03, h: 0.05, mat: 'brass', occluder: false },
    { type: 'cyl', x: -0.85, y: 0.24, z: 2.5, rTop: 0.19, rBot: 0.15, h: 0.48, mat: 'oak' },
    { type: 'cyl', x: -0.85, y: 0.95, z: 2.5, rTop: 0.04, rBot: 0.02, h: 0.95, mat: 'plant', occluder: false },
    { type: 'box', x: -0.85, y: 1.30, z: 2.5, w: 0.7, h: 0.45, d: 0.6, mat: 'plant', occluder: false }
  ],

  mirrorPlane: { point: [1.185, 1.45, -0.6], normal: [-1, 0, 0] },
  reflectors: [
    { kind: 'mirror', label: 'the hall mirror', centre: [1.18, 1.45, -0.6], normal: [-1, 0, 0], w: 0.8, h: 1.2, gloss: 0.92 }
  ],

  camera: { x: 0.0, z: -2.75, height: 1.36, yaw: 0, focal: 28, lens: 'standard_zoom' },
  coaching: { keyLesson: 'With no ambient, falloff is the only thing shaping the frame.', parScore: 72 }
};
