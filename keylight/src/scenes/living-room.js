/**
 * Scene 1 - Living room, large west window, mid afternoon.
 *
 * The tutorial room. White ceiling at 2.75m is comfortably inside bounce
 * range, the window is big and about six stops over the room, and there is a
 * chandelier to keep honest once the exposure is right.
 */

export const livingRoom = {
  id: 'living-room',
  name: 'Living room',
  subtitle: 'Large west window, mid afternoon',
  order: 1,
  brief:
    'A west-facing wall of glass at three in the afternoon. The view is about six stops over the room, ' +
    'so any exposure that holds the trees outside puts the sofa in the dark. The ceiling is white and low ' +
    'enough to bounce off. Start here.',
  difficulty: 1,
  room: { width: 6.4, depth: 8.2, ceiling: 2.75 },

  materials: {
    wall:     { albedo: '#dcd7cb', roughness: 0.94, spec: 0.02, tex: 2 },
    ceiling:  { albedo: '#f1eee7', roughness: 0.96, spec: 0.012, tex: 2 },
    floor:    { albedo: '#a9835a', roughness: 0.40, spec: 0.10, tex: 1, texDir: 1 },
    rug:      { albedo: '#c8bfad', roughness: 0.98, spec: 0.005, tex: 6 },
    sofa:     { albedo: '#6f7b77', roughness: 0.92, spec: 0.02, tex: 5 },
    pillow:   { albedo: '#c4ab84', roughness: 0.9,  spec: 0.02, tex: 5, texScale: 1.5 },
    walnut:   { albedo: '#5f4430', roughness: 0.34, spec: 0.14, tex: 8 },
    metal:    { albedo: '#b6b2aa', roughness: 0.20, spec: 0.55, tex: 10 },
    glass:    { albedo: '#0d1114', roughness: 0.05, spec: 0.85 },
    plant:    { albedo: '#43613a', roughness: 0.85, spec: 0.05, tex: 11, texScale: 2 },
    art:      { albedo: '#2a2e35', roughness: 0.6,  spec: 0.05 },
    shade:    { albedo: '#e3dccb', roughness: 0.95, spec: 0.02, tex: 5 },
    books:    { albedo: '#6d5c48', roughness: 0.9,  spec: 0.02, tex: 7 }
  },

  windows: [
    { wall: '+x', u: 4.6, v: 1.45, w: 3.4, h: 1.95, ev: 14.2, kelvin: 6100 },
    { wall: '+x', u: 1.5, v: 1.35, w: 1.1, h: 1.6,  ev: 14.0, kelvin: 6200 }
  ],

  fixtures: [
    { x: -0.2, y: 2.18, z: 0.7, lumens: 950, kelvin: 2750, radius: 0.075, label: 'Chandelier' },
    { x: -2.5, y: 0.62, z: -2.1, lumens: 420, kelvin: 2650, radius: 0.05, label: 'Table lamp' }
  ],

  props: [
    // Rug
    { type: 'box', x: 0.1, y: 0.006, z: 0.4, w: 3.6, h: 0.012, d: 2.7, mat: 'rug', occluder: false },

    // Sofa, back to the far wall, facing the window
    { type: 'box', x: -0.6, y: 0.22, z: 1.85, w: 2.4, h: 0.44, d: 0.95, mat: 'sofa', yaw: 0 },
    { type: 'box', x: -0.6, y: 0.60, z: 2.24, w: 2.4, h: 0.58, d: 0.18, mat: 'sofa' },
    { type: 'box', x: -1.72, y: 0.50, z: 1.85, w: 0.18, h: 0.30, d: 0.95, mat: 'sofa' },
    { type: 'box', x: 0.52, y: 0.50, z: 1.85, w: 0.18, h: 0.30, d: 0.95, mat: 'sofa' },
    { type: 'box', x: -1.30, y: 0.53, z: 2.06, w: 0.44, h: 0.44, d: 0.16, mat: 'pillow', yaw: 0.18 },
    { type: 'box', x: 0.08, y: 0.53, z: 2.06, w: 0.44, h: 0.44, d: 0.16, mat: 'pillow', yaw: -0.14 },

    // Coffee table, glass top on a walnut frame
    { type: 'box', x: -0.1, y: 0.40, z: 0.55, w: 1.25, h: 0.035, d: 0.68, mat: 'glass', occluder: false },
    { type: 'box', x: -0.1, y: 0.19, z: 0.55, w: 1.10, h: 0.06, d: 0.55, mat: 'walnut' },
    { type: 'cyl', x: -0.62, y: 0.19, z: 0.28, r: 0.028, h: 0.38, mat: 'metal', occluder: false },
    { type: 'cyl', x: 0.42, y: 0.19, z: 0.28, r: 0.028, h: 0.38, mat: 'metal', occluder: false },
    { type: 'cyl', x: -0.62, y: 0.19, z: 0.82, r: 0.028, h: 0.38, mat: 'metal', occluder: false },
    { type: 'cyl', x: 0.42, y: 0.19, z: 0.82, r: 0.028, h: 0.38, mat: 'metal', occluder: false },

    // Armchair angled to the window
    { type: 'box', x: 1.75, y: 0.23, z: -0.55, w: 0.85, h: 0.46, d: 0.85, mat: 'sofa', yaw: -0.62 },
    { type: 'box', x: 2.03, y: 0.60, z: -0.30, w: 0.85, h: 0.56, d: 0.16, mat: 'sofa', yaw: -0.62 },

    // Console and lamp against the near wall
    { type: 'box', x: -2.5, y: 0.36, z: -2.1, w: 1.5, h: 0.05, d: 0.42, mat: 'walnut' },
    { type: 'cyl', x: -3.15, y: 0.18, z: -2.1, r: 0.03, h: 0.36, mat: 'metal', occluder: false },
    { type: 'cyl', x: -1.85, y: 0.18, z: -2.1, r: 0.03, h: 0.36, mat: 'metal', occluder: false },
    { type: 'cyl', x: -2.5, y: 0.48, z: -2.1, r: 0.02, h: 0.20, mat: 'metal', occluder: false },
    { type: 'cyl', x: -2.5, y: 0.72, z: -2.1, rTop: 0.13, rBot: 0.17, h: 0.24, mat: 'shade', caps: false, occluder: false },

    // Bookshelf on the far wall
    { type: 'box', x: 2.1, y: 0.95, z: 3.85, w: 1.6, h: 1.9, d: 0.34, mat: 'walnut' },
    { type: 'box', x: 2.1, y: 0.62, z: 3.72, w: 1.44, h: 0.03, d: 0.28, mat: 'shade', occluder: false },
    { type: 'box', x: 2.1, y: 1.14, z: 3.72, w: 1.44, h: 0.03, d: 0.28, mat: 'shade', occluder: false },
    { type: 'box', x: 2.1, y: 1.62, z: 3.72, w: 1.44, h: 0.03, d: 0.28, mat: 'shade', occluder: false },
    { type: 'box', x: 2.02, y: 0.80, z: 3.74, w: 1.28, h: 0.30, d: 0.22, mat: 'books', occluder: false },
    { type: 'box', x: 2.18, y: 1.32, z: 3.74, w: 1.05, h: 0.30, d: 0.22, mat: 'books', occluder: false },
    { type: 'box', x: 2.0,  y: 1.78, z: 3.74, w: 0.85, h: 0.26, d: 0.22, mat: 'books', occluder: false },

    // Plant in the corner
    { type: 'cyl', x: -2.65, y: 0.22, z: 2.9, rTop: 0.20, rBot: 0.15, h: 0.44, mat: 'walnut' },
    { type: 'cyl', x: -2.65, y: 0.95, z: 2.9, rTop: 0.06, rBot: 0.02, h: 1.0, mat: 'plant', occluder: false },
    { type: 'box', x: -2.65, y: 1.32, z: 2.9, w: 0.9, h: 0.5, d: 0.8, mat: 'plant', occluder: false },

    // Chandelier: stem, arms hinted as a ring, hanging over the seating area
    { type: 'cyl', x: -0.2, y: 2.51, z: 0.7, r: 0.013, h: 0.42, mat: 'metal', occluder: false },
    { type: 'cyl', x: -0.2, y: 2.27, z: 0.7, rTop: 0.30, rBot: 0.30, h: 0.035, mat: 'metal', caps: false, occluder: false },
    { type: 'cyl', x: -0.2, y: 2.24, z: 0.7, rTop: 0.055, rBot: 0.085, h: 0.10, mat: 'metal', caps: false, occluder: false },

    // Art on the near wall
    { type: 'box', x: -0.4, y: 1.55, z: -4.05, w: 1.4, h: 0.95, d: 0.05, mat: 'art', occluder: false }
  ],

  reflectors: [
    { kind: 'glass', label: 'the coffee table top', centre: [-0.1, 0.42, 0.55], normal: [0, 1, 0], w: 1.25, h: 0.68 },
    { kind: 'window', label: 'the window glass', wall: '+x', u: 4.6, v: 1.45, w: 3.4, h: 1.95 }
  ],

  camera: { x: -2.15, z: -3.15, height: 1.35, yaw: 33, focal: 24, lens: 'wide_zoom' },

  coaching: {
    keyLesson: 'Shutter and ISO move the window. Aperture, power and distance move the room.',
    parScore: 78
  }
};
