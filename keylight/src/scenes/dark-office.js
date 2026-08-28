/**
 * Scene 7 - Study, dark wood and warm sconces.
 *
 * Low albedo everywhere, so bounce costs far more than it does in a white
 * room, and what does come back is the colour of walnut. Add 2650K sconces
 * against 5500K flash and this becomes a colour temperature problem first
 * and an exposure problem second.
 */

export const darkOffice = {
  id: 'dark-office',
  name: 'Study',
  subtitle: 'Walnut panelling, warm sconces',
  order: 7,
  brief:
    'Walnut panelling at about eighteen percent reflectance. Bouncing in here costs closer to four stops than ' +
    'two, and everything that comes back is brown. The sconces are 2650K, the flash is 5500K, and the window ' +
    'is north facing at 6800K. Three temperatures, one white balance.',
  difficulty: 4,
  room: { width: 4.6, depth: 5.4, ceiling: 2.90 },

  materials: {
    wall:     { albedo: '#4a382a', roughness: 0.44, spec: 0.09, tex: 8, texDir: 1 },
    ceiling:  { albedo: '#ddd6c8', roughness: 0.94, spec: 0.015, tex: 2 },
    floor:    { albedo: '#4e3d2d', roughness: 0.30, spec: 0.16, tex: 1, texDir: 1 },
    rug:      { albedo: '#7c5a4a', roughness: 0.97, spec: 0.008, tex: 6 },
    walnut:   { albedo: '#3f2f22', roughness: 0.30, spec: 0.17, tex: 8 },
    leather:  { albedo: '#5b3d2c', roughness: 0.52, spec: 0.12, tex: 11 },
    books:    { albedo: '#6d5c48', roughness: 0.9,  spec: 0.02, tex: 7 },
    brass:    { albedo: '#9c7d3c', roughness: 0.19, spec: 0.56, tex: 10 },
    shade:    { albedo: '#dcc9a4', roughness: 0.9,  spec: 0.03, tex: 5 },
    paper:    { albedo: '#cdc6b4', roughness: 0.95, spec: 0.01 },
    plant:    { albedo: '#3a5433', roughness: 0.86, spec: 0.05, tex: 11, texScale: 2 }
  },

  windows: [
    { wall: '-x', u: 2.7, v: 1.55, w: 1.4, h: 1.60, ev: 12.6, kelvin: 6900, view: 'foliage' }
  ],

  fixtures: [
    { x: 2.06, y: 1.78, z: -1.3, lumens: 300, kelvin: 2620, radius: 0.05, label: 'Sconce' },
    { x: 2.06, y: 1.78, z: 1.3,  lumens: 300, kelvin: 2620, radius: 0.05, label: 'Sconce' },
    { x: -0.5, y: 1.02, z: 0.9,  lumens: 420, kelvin: 2700, radius: 0.05, label: 'Desk lamp' }
  ],

  props: [
    { type: 'box', x: 0, y: 0.008, z: 0.2, w: 3.2, h: 0.016, d: 3.0, mat: 'rug', occluder: false },
    // Desk
    { type: 'box', x: -0.2, y: 0.72, z: 0.6, w: 1.9, h: 0.06, d: 0.90, mat: 'walnut' },
    { type: 'box', x: -1.02, y: 0.36, z: 0.6, w: 0.08, h: 0.68, d: 0.80, mat: 'walnut' },
    { type: 'box', x: 0.62, y: 0.36, z: 0.6, w: 0.08, h: 0.68, d: 0.80, mat: 'walnut' },
    { type: 'box', x: -0.1, y: 0.76, z: 0.45, w: 0.42, h: 0.02, d: 0.30, mat: 'paper', occluder: false },
    { type: 'cyl', x: -0.5, y: 0.86, z: 0.9, r: 0.016, h: 0.24, mat: 'brass', occluder: false },
    { type: 'cyl', x: -0.5, y: 1.10, z: 0.9, rTop: 0.10, rBot: 0.14, h: 0.20, mat: 'shade', caps: false, occluder: false },
    // Chair
    { type: 'box', x: -0.2, y: 0.24, z: 1.6, w: 0.62, h: 0.46, d: 0.60, mat: 'leather' },
    { type: 'box', x: -0.2, y: 0.72, z: 1.86, w: 0.62, h: 0.62, d: 0.14, mat: 'leather' },
    // Bookcases on the +x wall
    { type: 'box', x: 2.06, y: 1.15, z: 0.0, w: 0.42, h: 2.30, d: 3.8, mat: 'walnut' },
    { type: 'box', x: 1.94, y: 0.75, z: 0.0, w: 0.34, h: 0.20, d: 3.5, mat: 'books', occluder: false },
    { type: 'box', x: 1.94, y: 1.25, z: 0.0, w: 0.34, h: 0.20, d: 3.5, mat: 'books', occluder: false },
    { type: 'box', x: 1.94, y: 1.75, z: 0.0, w: 0.34, h: 0.20, d: 3.5, mat: 'books', occluder: false },
    // Sconce bodies
    { type: 'cyl', x: 2.10, y: 1.78, z: -1.3, rTop: 0.09, rBot: 0.06, h: 0.20, mat: 'brass', caps: false, occluder: false },
    { type: 'cyl', x: 2.10, y: 1.78, z: 1.3, rTop: 0.09, rBot: 0.06, h: 0.20, mat: 'brass', caps: false, occluder: false },
    // Reading corner
    { type: 'box', x: -1.5, y: 0.24, z: -1.6, w: 0.80, h: 0.46, d: 0.80, mat: 'leather', yaw: 0.55 },
    { type: 'box', x: -1.72, y: 0.66, z: -1.85, w: 0.80, h: 0.56, d: 0.16, mat: 'leather', yaw: 0.55 },
    { type: 'cyl', x: 1.2, y: 0.26, z: -2.1, rTop: 0.20, rBot: 0.16, h: 0.52, mat: 'walnut' },
    { type: 'cyl', x: 1.2, y: 1.05, z: -2.1, rTop: 0.04, rBot: 0.02, h: 1.05, mat: 'plant', occluder: false },
    { type: 'box', x: 1.2, y: 1.42, z: -2.1, w: 0.75, h: 0.48, d: 0.65, mat: 'plant', occluder: false }
  ],

  reflectors: [],
  camera: { x: -0.5, z: -2.3, height: 1.28, yaw: 10, focal: 30, lens: 'standard_zoom' },
  coaching: { keyLesson: 'Dark rooms punish bounce, and hand back the colour of the wood.', parScore: 70 }
};
