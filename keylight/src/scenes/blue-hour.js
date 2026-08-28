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
    { wall: '+x', u: 4.0, v: 1.45, w: 6.4, h: 2.40, ev: 7.4, kelvin: 8600, view: 'city' }
  ],

  fixtures: [
    { x: -0.6, y: 2.28, z: 0.6,  lumens: 900, kelvin: 2700, radius: 0.08, label: 'Pendant' },
    { x: -2.6, y: 0.66, z: -2.4, lumens: 460, kelvin: 2650, radius: 0.055, label: 'Table lamp' },
    { x: -2.6, y: 0.66, z: 2.4,  lumens: 460, kelvin: 2650, radius: 0.055, label: 'Table lamp' },
    { x: 1.4, y: 2.80, z: -2.8,  lumens: 320, kelvin: 3000, radius: 0.04, label: 'Can light' }
  ],

  props: [
    { type: 'box', x: -0.2, y: 0.008, z: 0.3, w: 4.2, h: 0.016, d: 3.4, mat: 'rug', occluder: false },
    { type: 'box', x: -1.0, y: 0.21, z: 1.7, w: 2.7, h: 0.42, d: 0.95, mat: 'sofa' },
    { type: 'box', x: -1.0, y: 0.60, z: 2.09, w: 2.7, h: 0.58, d: 0.18, mat: 'sofa' },
    { type: 'box', x: 1.0, y: 0.21, z: -1.2, w: 0.95, h: 0.42, d: 0.95, mat: 'sofa', yaw: -0.5 },
    { type: 'box', x: 1.25, y: 0.60, z: -0.95, w: 0.95, h: 0.56, d: 0.16, mat: 'sofa', yaw: -0.5 },
    { type: 'box', x: -0.4, y: 0.38, z: 0.35, w: 1.3, h: 0.03, d: 0.72, mat: 'glassTop', occluder: false },
    { type: 'box', x: -0.4, y: 0.19, z: 0.35, w: 1.1, h: 0.05, d: 0.55, mat: 'oak' },
    // Console tables with the lamps
    { type: 'box', x: -2.6, y: 0.40, z: -2.4, w: 0.9, h: 0.05, d: 0.5, mat: 'oak' },
    { type: 'box', x: -2.6, y: 0.40, z: 2.4, w: 0.9, h: 0.05, d: 0.5, mat: 'oak' },
    { type: 'cyl', x: -2.6, y: 0.52, z: -2.4, r: 0.02, h: 0.20, mat: 'steel', occluder: false },
    { type: 'cyl', x: -2.6, y: 0.52, z: 2.4, r: 0.02, h: 0.20, mat: 'steel', occluder: false },
    { type: 'cyl', x: -2.6, y: 0.78, z: -2.4, rTop: 0.14, rBot: 0.19, h: 0.26, mat: 'shade', caps: false, occluder: false },
    { type: 'cyl', x: -2.6, y: 0.78, z: 2.4, rTop: 0.14, rBot: 0.19, h: 0.26, mat: 'shade', caps: false, occluder: false },
    // Pendant over the table
    { type: 'cyl', x: -0.6, y: 2.62, z: 0.6, r: 0.014, h: 0.56, mat: 'steel', occluder: false },
    { type: 'cyl', x: -0.6, y: 2.34, z: 0.6, rTop: 0.10, rBot: 0.22, h: 0.24, mat: 'steel', caps: false, occluder: false },
    // Shelving on the -x wall
    { type: 'box', x: -3.28, y: 1.1, z: 0.0, w: 0.36, h: 2.2, d: 2.6, mat: 'oak' },
    { type: 'box', x: -3.22, y: 1.65, z: 0.0, w: 0.32, h: 0.03, d: 2.4, mat: 'shade', occluder: false },
    { type: 'cyl', x: 2.2, y: 0.28, z: 3.2, rTop: 0.22, rBot: 0.17, h: 0.56, mat: 'oak' },
    { type: 'cyl', x: 2.2, y: 1.15, z: 3.2, rTop: 0.05, rBot: 0.02, h: 1.2, mat: 'plant', occluder: false },
    { type: 'box', x: 2.2, y: 1.62, z: 3.2, w: 0.9, h: 0.55, d: 0.85, mat: 'plant', occluder: false },
    { type: 'box', x: -0.6, y: 1.75, z: -3.95, w: 1.6, h: 1.05, d: 0.05, mat: 'art', occluder: false }
  ],

  reflectors: [
    { kind: 'window', label: 'the glass wall', wall: '+x', u: 4.0, v: 1.45, w: 6.4, h: 2.40 },
    { kind: 'gloss', label: 'the coffee table', centre: [-0.4, 0.40, 0.35], normal: [0, 1, 0], w: 1.3, h: 0.72, gloss: 0.6 }
  ],

  camera: { x: -2.4, z: -2.9, height: 1.30, yaw: 36, focal: 24, lens: 'wide_zoom' },
  coaching: { keyLesson: 'At blue hour the window stops being the enemy. Do not overpower it.', parScore: 76 }
};
