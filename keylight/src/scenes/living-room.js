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
    { wall: '+x', u: 4.6, v: 1.45, w: 3.4, h: 1.95, ev: 14.2, kelvin: 6100, view: 'foliage', drapes: 'shade' },
    { wall: '+x', u: 1.5, v: 1.35, w: 1.1, h: 1.6,  ev: 14.0, kelvin: 6200, view: 'foliage' }
  ],

  fixtures: [
    { x: -0.2, y: 2.18, z: 0.7, lumens: 950, kelvin: 2750, radius: 0.075, label: 'Chandelier' },
    { x: -2.5, y: 0.62, z: -2.1, lumens: 420, kelvin: 2650, radius: 0.05, label: 'Table lamp' }
  ],

  props: [
    { type: 'rug', x: 0.1, z: 0.4, w: 3.7, d: 2.8, yaw: 0, rug: 'rug', border: 'walnut' },

    // Sofa facing the window, coffee table, angled armchair
    { type: 'sofa', x: -0.6, z: 1.9, yaw: 0, w: 2.4, d: 0.95, body: 'sofa', cushion: 'pillow', legs: 'walnut' },
    { type: 'table', x: -0.1, z: 0.55, yaw: 0, w: 1.2, d: 0.68, h: 0.40, top: 'glass', legs: 'metal' },
    { type: 'armchair', x: 1.75, z: -0.55, yaw: -0.62, body: 'sofa', legs: 'walnut' },
    { type: 'stack', x: -0.35, y: 0.42, z: 0.55, mats: ['books', 'walnut', 'art'], n: 3 },
    { type: 'vase', x: 0.25, y: 0.42, z: 0.5, r: 0.08, h: 0.26, mat: 'metal', stems: 'plant' },

    // Console with a lamp under the art
    { type: 'table', x: -2.5, z: -2.1, yaw: 0, w: 1.5, d: 0.42, h: 0.40, top: 'walnut', legs: 'metal' },
    { type: 'lamp', x: -2.5, z: -2.1, kind: 'table', h: 0.42, base: 'metal', stem: 'metal', shade: 'shade' },
    { type: 'art', x: -2.5, y: 1.7, z: -4.06, w: 1.5, h: 1.0, yaw: 0, frame: 'walnut', canvas: 'art' },

    // Bookcase on the far wall, dressed
    { type: 'bookcase', x: 2.1, z: 3.82, yaw: 3.14159, w: 1.7, h: 1.95, d: 0.34, frame: 'walnut', books: 'books', shelves: 4 },

    // Plant in the corner
    { type: 'plant', x: -2.65, z: 2.9, scale: 1.15, pot: 'walnut', foliage: 'plant', stem: 'plant' },

    // Chandelier body over the seating
    { type: 'cyl', x: -0.2, y: 2.51, z: 0.7, r: 0.013, h: 0.42, mat: 'metal', occluder: false },
    { type: 'cyl', x: -0.2, y: 2.27, z: 0.7, rTop: 0.30, rBot: 0.30, h: 0.035, mat: 'metal', caps: false, occluder: false },
    { type: 'cyl', x: -0.2, y: 2.24, z: 0.7, rTop: 0.055, rBot: 0.085, h: 0.10, mat: 'metal', caps: false, occluder: false }
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
