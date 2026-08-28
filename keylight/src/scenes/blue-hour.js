/**
 * Scene 5 - Blue hour, glass wall.
 *
 * For about twenty minutes the exterior falls to roughly the level of the
 * interior and the whole problem dissolves. This room exists to make the
 * point that timing beats technique, and that the window will not wait.
 */

export const blueHour = {
  id: 'blue-hour',
  name: 'Glass wall at dusk',
  subtitle: 'Blue hour, city beyond',
  order: 5,
  brief:
    'The exterior is down to about EV 7 and the fixtures are carrying the room. For once the view and the ' +
    'interior are within a couple of stops of each other, so flash is here to shape the room rather than to ' +
    'rescue it. Go too hard and you will destroy the one thing that makes this frame work.',
  difficulty: 3,
  room: { width: 7.0, depth: 8.0, ceiling: 2.90 },

  materials: {
    wall:     { albedo: '#cfcabf', roughness: 0.92, spec: 0.025, tex: 2 },
    ceiling:  { albedo: '#e6e2da', roughness: 0.95, spec: 0.012, tex: 2 },
    floor:    { albedo: '#6f5f4e', roughness: 0.30, spec: 0.16, tex: 1, texDir: 1 },
    rug:      { albedo: '#9d9484', roughness: 0.97, spec: 0.006, tex: 6 },
    sofa:     { albedo: '#4e5652', roughness: 0.92, spec: 0.02, tex: 5 },
    oak:      { albedo: '#6b523a', roughness: 0.34, spec: 0.14, tex: 8 },
    steel:    { albedo: '#9b9b98', roughness: 0.16, spec: 0.58, tex: 10 },
    glassTop: { albedo: '#0d1114', roughness: 0.05, spec: 0.8 },
    plant:    { albedo: '#3c5735', roughness: 0.86, spec: 0.05, tex: 11, texScale: 2 },
    shade:    { albedo: '#e8e2d3', roughness: 0.92, spec: 0.03, tex: 5 },
    art:      { albedo: '#2f2b28', roughness: 0.6, spec: 0.05 }
  },

  windows: [
    { wall: '+x', u: 4.0, v: 1.45, w: 6.4, h: 2.40, ev: 7.4, kelvin: 8600, view: 'city', drapes: 'shade', drapeWidth: 0.5 }
  ],

  fixtures: [
    { x: -0.6, y: 2.28, z: 0.6,  lumens: 900, kelvin: 2700, radius: 0.08, label: 'Pendant' },
    { x: -2.6, y: 0.66, z: -2.4, lumens: 460, kelvin: 2650, radius: 0.055, label: 'Table lamp' },
    { x: -2.6, y: 0.66, z: 2.4,  lumens: 460, kelvin: 2650, radius: 0.055, label: 'Table lamp' },
    { x: 1.4, y: 2.80, z: -2.8,  lumens: 320, kelvin: 3000, radius: 0.04, label: 'Can light' }
  ],

  props: [
    { type: 'rug', x: -0.2, z: 0.3, w: 4.4, d: 3.5, yaw: 0, rug: 'rug', border: 'oak' },

    { type: 'sofa', x: -1.0, z: 1.7, yaw: 3.14159, w: 2.7, d: 0.95, body: 'sofa', legs: 'oak' },
    { type: 'armchair', x: 1.0, z: -1.2, yaw: -0.5, body: 'sofa', legs: 'oak' },
    { type: 'table', x: -0.4, z: 0.35, yaw: 0, w: 1.3, d: 0.72, h: 0.38, top: 'glassTop', legs: 'oak' },
    { type: 'stack', x: -0.6, y: 0.38, z: 0.35, mats: ['art', 'oak'], n: 2 },
    { type: 'vase', x: -0.1, y: 0.38, z: 0.35, r: 0.08, h: 0.26, mat: 'steel', stems: 'plant' },

    // Console tables with warm lamps
    { type: 'table', x: -2.6, z: -2.4, yaw: 0, w: 0.9, d: 0.5, h: 0.40, top: 'oak', legs: 'oak' },
    { type: 'table', x: -2.6, z: 2.4, yaw: 0, w: 0.9, d: 0.5, h: 0.40, top: 'oak', legs: 'oak' },
    { type: 'lamp', x: -2.6, z: -2.4, kind: 'table', h: 0.42, base: 'steel', stem: 'steel', shade: 'shade' },
    { type: 'lamp', x: -2.6, z: 2.4, kind: 'table', h: 0.42, base: 'steel', stem: 'steel', shade: 'shade' },

    // Pendant over the table
    { type: 'pendant', x: -0.6, y: 2.86, z: 0.6, drop: 0.52, r: 0.20, metal: 'steel', shade: 'steel' },

    // Bookcase on the -x wall, plant and art
    { type: 'bookcase', x: -3.28, z: 0.0, yaw: 1.5708, w: 2.4, h: 2.2, d: 0.36, frame: 'oak', books: 'shade', shelves: 4 },
    { type: 'plant', x: 2.2, z: 3.2, scale: 1.3, pot: 'oak', foliage: 'plant', stem: 'plant', clumps: 8 },
    { type: 'art', x: -0.6, y: 1.75, z: -3.97, w: 1.6, h: 1.05, yaw: 0, frame: 'oak', canvas: 'art' }
  ],

  reflectors: [
    { kind: 'window', label: 'the glass wall', wall: '+x', u: 4.0, v: 1.45, w: 6.4, h: 2.40 },
    { kind: 'gloss', label: 'the coffee table', centre: [-0.4, 0.40, 0.35], normal: [0, 1, 0], w: 1.3, h: 0.72, gloss: 0.6 }
  ],

  camera: { x: -2.4, z: -2.9, height: 1.30, yaw: 36, focal: 24, lens: 'wide_zoom' },
  coaching: { keyLesson: 'At blue hour the window stops being the enemy. Do not overpower it.', parScore: 76 }
};
