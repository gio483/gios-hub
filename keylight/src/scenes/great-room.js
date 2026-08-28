/**
 * Scene 4 - Great room, double height ceiling, clerestory windows.
 *
 * Nearly six metres to the ceiling. Bouncing costs the same two to three
 * stops it always does, but the return trip is so long that a bare head is
 * hopeless. This is the room that argues for modifiers.
 */

export const greatRoom = {
  id: 'great-room',
  name: 'Great room',
  subtitle: 'Double height, clerestory glazing',
  order: 4,
  brief:
    'Five point eight metres to the ceiling. Point a head at it and by the time the light comes back down it ' +
    'is gone. The clerestory windows are almost three stops brighter than the ones at eye level, so the top ' +
    'of the frame will blow long before the bottom is lit.',
  difficulty: 3,
  room: { width: 8.0, depth: 10.0, ceiling: 5.80 },

  materials: {
    wall:     { albedo: '#d9d5cb', roughness: 0.93, spec: 0.02, tex: 2 },
    ceiling:  { albedo: '#e9e5dc', roughness: 0.95, spec: 0.012, tex: 2 },
    floor:    { albedo: '#9c8163', roughness: 0.36, spec: 0.12, tex: 1, texDir: 1 },
    rug:      { albedo: '#b8ae9c', roughness: 0.97, spec: 0.006, tex: 6 },
    sofa:     { albedo: '#7c7469', roughness: 0.92, spec: 0.02, tex: 5 },
    stone:    { albedo: '#8d8981', roughness: 0.62, spec: 0.05, tex: 9 },
    oak:      { albedo: '#7a5f43', roughness: 0.35, spec: 0.13, tex: 8 },
    steel:    { albedo: '#8f8f8d', roughness: 0.20, spec: 0.5, tex: 10 },
    plant:    { albedo: '#405c37', roughness: 0.86, spec: 0.05, tex: 11, texScale: 2 },
    art:      { albedo: '#332f2c', roughness: 0.6,  spec: 0.05 },
    shade:    { albedo: '#e4dfd2', roughness: 0.93, spec: 0.02, tex: 5 }
  },

  windows: [
    { wall: '+x', u: 5.0, v: 1.70, w: 3.6, h: 2.30, ev: 13.6, kelvin: 6300, view: 'foliage' },
    { wall: '+x', u: 5.0, v: 4.70, w: 5.4, h: 1.30, ev: 15.1, kelvin: 8200, view: 'sky' },
    { wall: '-z', u: 5.2, v: 4.60, w: 3.0, h: 1.40, ev: 14.9, kelvin: 8000, view: 'sky' }
  ],

  fixtures: [
    { x: -0.4, y: 4.30, z: 0.5, lumens: 1400, kelvin: 2800, radius: 0.10, label: 'Chandelier' },
    { x: -3.0, y: 1.55, z: -3.4, lumens: 380, kelvin: 2700, radius: 0.05, label: 'Sconce' },
    { x: -3.0, y: 1.55, z: 1.2,  lumens: 380, kelvin: 2700, radius: 0.05, label: 'Sconce' }
  ],

  props: [
    { type: 'box', x: 0.2, y: 0.008, z: 0.4, w: 5.0, h: 0.016, d: 4.0, mat: 'rug', occluder: false },
    // Stone fireplace wall
    { type: 'box', x: -3.72, y: 2.6, z: 0.0, w: 0.5, h: 5.2, d: 3.4, mat: 'stone' },
    { type: 'box', x: -3.40, y: 0.55, z: 0.0, w: 0.22, h: 1.10, d: 1.5, mat: 'art', occluder: false },
    { type: 'box', x: -3.36, y: 1.32, z: 0.0, w: 0.34, h: 0.10, d: 2.0, mat: 'oak', occluder: false },

    // Facing sofas
    { type: 'box', x: 0.4, y: 0.22, z: 2.05, w: 3.0, h: 0.44, d: 1.0, mat: 'sofa' },
    { type: 'box', x: 0.4, y: 0.62, z: 2.46, w: 3.0, h: 0.60, d: 0.20, mat: 'sofa' },
    { type: 'box', x: 0.4, y: 0.22, z: -1.25, w: 3.0, h: 0.44, d: 1.0, mat: 'sofa' },
    { type: 'box', x: 0.4, y: 0.62, z: -1.66, w: 3.0, h: 0.60, d: 0.20, mat: 'sofa' },
    { type: 'box', x: 0.4, y: 0.36, z: 0.45, w: 1.5, h: 0.08, d: 0.9, mat: 'oak' },
    { type: 'cyl', x: -0.2, y: 0.16, z: 0.45, r: 0.03, h: 0.32, mat: 'steel', occluder: false },
    { type: 'cyl', x: 1.0, y: 0.16, z: 0.45, r: 0.03, h: 0.32, mat: 'steel', occluder: false },

    // Chandelier body hanging into the volume
    { type: 'cyl', x: -0.4, y: 5.1, z: 0.5, r: 0.02, h: 1.3, mat: 'steel', occluder: false },
    { type: 'cyl', x: -0.4, y: 4.30, z: 0.5, rTop: 0.42, rBot: 0.42, h: 0.06, mat: 'steel', caps: false, occluder: false },

    // Console and greenery
    { type: 'box', x: 3.1, y: 0.40, z: -3.6, w: 1.6, h: 0.06, d: 0.44, mat: 'oak' },
    { type: 'cyl', x: -2.7, y: 0.30, z: 3.6, rTop: 0.26, rBot: 0.20, h: 0.60, mat: 'stone' },
    { type: 'cyl', x: -2.7, y: 1.45, z: 3.6, rTop: 0.06, rBot: 0.03, h: 1.7, mat: 'plant', occluder: false },
    { type: 'box', x: -2.7, y: 2.20, z: 3.6, w: 1.3, h: 0.7, d: 1.1, mat: 'plant', occluder: false },
    { type: 'box', x: 1.0, y: 3.3, z: -4.92, w: 2.2, h: 1.5, d: 0.06, mat: 'art', occluder: false }
  ],

  reflectors: [],
  camera: { x: -2.2, z: -3.6, height: 1.42, yaw: 34, focal: 24, lens: 'wide_zoom' },
  coaching: { keyLesson: 'When the ceiling is out of reach, you have to bring your own soft source.', parScore: 72 }
};
