/**
 * Scene 3 - Primary bathroom.
 *
 * A small room whose largest surface is a mirror pointed straight back at
 * where a photographer naturally stands. Glass shower, honed marble, chrome.
 * This is the reflection nightmare, and the room the tilt shift pays for.
 */

export const bathroom = {
  id: 'bathroom',
  name: 'Primary bathroom',
  subtitle: 'Full-width mirror, glass shower',
  order: 3,
  brief:
    'Three and a half metres wide with a mirror running the whole vanity wall. Stand square to the vanity and ' +
    'you are in the shot. So is your stand. The window is small and high, so there is almost no ambient to ' +
    'hide behind either.',
  difficulty: 4,
  room: { width: 3.4, depth: 4.6, ceiling: 2.60 },

  materials: {
    wall:     { albedo: '#dfdcd6', roughness: 0.90, spec: 0.03, tex: 2 },
    ceiling:  { albedo: '#f2efe9', roughness: 0.95, spec: 0.012, tex: 2 },
    floor:    { albedo: '#b4b0a7', roughness: 0.22, spec: 0.22, tex: 4, texScale: 0.25 },
    marble:   { albedo: '#cfccc4', roughness: 0.14, spec: 0.42, tex: 3 },
    mirror:   { albedo: '#0a0c0e', roughness: 0.02, spec: 0.05, mirror: 0.9 },
    glass:    { albedo: '#0b1013', roughness: 0.03, spec: 0.55 },
    chrome:   { albedo: '#b8b8b6', roughness: 0.08, spec: 0.82, tex: 10 },
    vanity:   { albedo: '#48403a', roughness: 0.40, spec: 0.10, tex: 8 },
    porcelain:{ albedo: '#eeece7', roughness: 0.24, spec: 0.24 },
    towel:    { albedo: '#c9c3b4', roughness: 0.95, spec: 0.01, tex: 5, texScale: 1.6 },
    shade:    { albedo: '#e8e3d8', roughness: 0.92, spec: 0.03 },
    plant:    { albedo: '#4f6d40', roughness: 0.85, spec: 0.05, tex: 11, texScale: 2 }
  },

  windows: [
    { wall: '+z', u: 0.8, v: 1.85, w: 0.8, h: 0.85, ev: 13.4, kelvin: 6800, view: 'sky' }
  ],

  fixtures: [
    { x: -0.75, y: 1.86, z: -2.16, lumens: 340, kelvin: 2900, radius: 0.05, label: 'Sconce' },
    { x: 0.75, y: 1.86, z: -2.16, lumens: 340, kelvin: 2900, radius: 0.05, label: 'Sconce' }
  ],

  props: [
    // Vanity against the -z wall, with the mirror above it
    { type: 'box', x: 0, y: 0.42, z: -2.02, w: 2.4, h: 0.84, d: 0.56, mat: 'vanity' },
    { type: 'box', x: 0, y: 0.865, z: -2.02, w: 2.5, h: 0.05, d: 0.62, mat: 'marble' },
    { type: 'box', x: 0, y: 1.62, z: -2.27, w: 2.3, h: 1.15, d: 0.03, mat: 'mirror', occluder: false },
    { type: 'box', x: -0.62, y: 0.90, z: -2.02, w: 0.44, h: 0.04, d: 0.34, mat: 'porcelain', occluder: false },
    { type: 'box', x: 0.62, y: 0.90, z: -2.02, w: 0.44, h: 0.04, d: 0.34, mat: 'porcelain', occluder: false },
    { type: 'cyl', x: -0.62, y: 1.02, z: -2.18, r: 0.019, h: 0.24, mat: 'chrome', occluder: false },
    { type: 'cyl', x: 0.62, y: 1.02, z: -2.18, r: 0.019, h: 0.24, mat: 'chrome', occluder: false },

    // Sconce backplates either side of the mirror
    { type: 'cyl', x: -0.75, y: 1.86, z: -2.24, rTop: 0.05, rBot: 0.07, h: 0.055, mat: 'chrome', caps: false, occluder: false },
    { type: 'cyl', x: 0.75, y: 1.86, z: -2.24, rTop: 0.05, rBot: 0.07, h: 0.055, mat: 'chrome', caps: false, occluder: false },

    // Glass shower in the far corner
    { type: 'box', x: 1.06, y: 1.05, z: 1.15, w: 0.03, h: 2.10, d: 1.7, mat: 'glass', occluder: false },
    { type: 'box', x: 1.72, y: 1.05, z: 0.32, w: 1.35, h: 2.10, d: 0.03, mat: 'glass', occluder: false },
    { type: 'box', x: 1.72, y: 0.02, z: 1.15, w: 1.35, h: 0.05, d: 1.7, mat: 'marble', occluder: false },
    { type: 'cyl', x: 1.7, y: 1.95, z: 1.9, r: 0.055, h: 0.06, mat: 'chrome', occluder: false },
    { type: 'box', x: 2.1, y: 1.4, z: 1.15, w: 0.02, h: 1.2, d: 1.7, mat: 'marble', occluder: false },

    // Tub and a stool
    { type: 'box', x: -1.0, y: 0.29, z: 1.35, w: 0.86, h: 0.58, d: 1.72, mat: 'porcelain' },
    { type: 'cyl', x: -0.42, y: 0.22, z: -0.2, r: 0.17, h: 0.44, mat: 'vanity' },
    { type: 'box', x: -0.42, y: 0.47, z: -0.2, w: 0.30, h: 0.06, d: 0.24, mat: 'towel', occluder: false },
    { type: 'box', x: -1.66, y: 1.25, z: -0.5, w: 0.04, h: 0.5, d: 0.38, mat: 'towel', occluder: false },
    { type: 'plant', x: 1.5, z: -1.7, scale: 0.55, pot: 'porcelain', foliage: 'plant', stem: 'plant', clumps: 6 },
    { type: 'stack', x: -0.55, y: 0.89, z: -2.0, mats: ['towel', 'marble'], n: 2 },
    { type: 'vase', x: 0.7, y: 0.89, z: -2.02, r: 0.05, h: 0.22, mat: 'chrome' }
  ],

  /** The plane the reflection pass mirrors through. */
  mirrorPlane: { point: [0, 1.62, -2.255], normal: [0, 0, 1] },

  reflectors: [
    { kind: 'mirror', label: 'the vanity mirror', centre: [0, 1.62, -2.25], normal: [0, 0, 1], w: 2.3, h: 1.15, gloss: 0.95 },
    { kind: 'gloss', label: 'the shower glass', centre: [1.06, 1.05, 1.15], normal: [-1, 0, 0], w: 1.7, h: 2.1, gloss: 0.8 }
  ],

  camera: { x: -0.95, z: 1.55, height: 1.30, yaw: 194, focal: 24, lens: 'wide_zoom' },
  coaching: { keyLesson: 'If you can see the head in the surface, the camera can too.', parScore: 70 }
};
