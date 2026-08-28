/**
 * Scene 9 - Dining room, chandelier over a polished table.
 *
 * The set piece of interior work: a fixture hung low over a reflective
 * surface. The chandelier has to glow and read as the source of the room's
 * warmth without clipping to a blob, and the polished table will throw
 * whatever you put above it straight back at the lens. Wainscoting, a big
 * north window, a sideboard with a mirror.
 */

export const diningRoom = {
  id: 'dining-room',
  name: 'Dining room',
  subtitle: 'Chandelier over a polished table',
  order: 9,
  brief:
    'A chandelier hangs low over a glossy walnut table set for dinner. Make it glow and carry the mood of the ' +
    'room, but keep detail in the shades and do not let the table become a mirror pointed at you. The north ' +
    'window is soft. A sideboard mirror on the far wall is one more surface watching where you stand.',
  difficulty: 3,
  room: { width: 5.4, depth: 7.0, ceiling: 2.85 },
  trimColor: '#eae6db',

  materials: {
    wall:     { albedo: '#d6d0c2', roughness: 0.92, spec: 0.03, tex: 2 },
    wainscot: { albedo: '#e7e3d8', roughness: 0.6,  spec: 0.06, tex: 2 },
    ceiling:  { albedo: '#f1eee6', roughness: 0.95, spec: 0.012, tex: 2 },
    floor:    { albedo: '#8f6f4c', roughness: 0.34, spec: 0.13, tex: 1, texDir: 1 },
    rug:      { albedo: '#b7ac96', roughness: 0.97, spec: 0.006, tex: 6 },
    tabletop: { albedo: '#4a3626', roughness: 0.14, spec: 0.4, tex: 8 },
    walnut:   { albedo: '#5a4231', roughness: 0.33, spec: 0.14, tex: 8 },
    chair:    { albedo: '#7d8a7f', roughness: 0.9,  spec: 0.02, tex: 5 },
    brass:    { albedo: '#a07e38', roughness: 0.18, spec: 0.55, tex: 10 },
    china:    { albedo: '#efece6', roughness: 0.2,  spec: 0.3 },
    glassware:{ albedo: '#0d1114', roughness: 0.04, spec: 0.7 },
    mirror:   { albedo: '#0a0c0e', roughness: 0.02, spec: 0.05, mirror: 0.85 },
    linen:    { albedo: '#e3ddce', roughness: 0.95, spec: 0.02, tex: 5 },
    shade:    { albedo: '#f0e6cf', roughness: 0.9,  spec: 0.03, tex: 5 },
    plant:    { albedo: '#4c6b3d', roughness: 0.85, spec: 0.05, tex: 11, texScale: 2 },
    art:      { albedo: '#2b2822', roughness: 0.6,  spec: 0.05 }
  },

  wallMaterials: { '+x': 'wall', '-x': 'wall', '+z': 'wall', '-z': 'wall' },

  windows: [
    { wall: '-x', u: 3.8, v: 1.55, w: 2.4, h: 1.7, ev: 12.7, kelvin: 7000, view: 'foliage', drapes: 'linen', drapeWidth: 0.42 }
  ],

  fixtures: [
    { x: 0, y: 1.72, z: 0.2, lumens: 1300, kelvin: 2750, radius: 0.09, label: 'Chandelier' },
    { x: -2.3, y: 1.5, z: -2.6, lumens: 300, kelvin: 2700, radius: 0.045, label: 'Sconce' },
    { x: -2.3, y: 1.5, z: 3.0, lumens: 300, kelvin: 2700, radius: 0.045, label: 'Sconce' }
  ],

  props: [
    { type: 'rug', x: 0, z: 0.2, w: 3.6, d: 4.6, yaw: 0, rug: 'rug', border: 'walnut' },

    // Wainscot band on the perimeter walls
    { type: 'box', x: 0, y: 0.55, z: -3.46, w: 5.3, h: 1.0, d: 0.03, mat: 'wainscot', occluder: false },
    { type: 'box', x: 0, y: 0.55, z: 3.46, w: 5.3, h: 1.0, d: 0.03, mat: 'wainscot', occluder: false },
    { type: 'box', x: 2.66, y: 0.55, z: 0, w: 0.03, h: 1.0, d: 6.9, mat: 'wainscot', occluder: false },

    // Dining table, set
    { type: 'box', x: 0, y: 0.74, z: 0.2, w: 1.3, h: 0.05, d: 2.7, mat: 'tabletop' },
    { type: 'box', x: 0, y: 0.37, z: 0.2, w: 1.1, h: 0.7, d: 2.4, mat: 'walnut' },
    { type: 'box', x: 0, y: 0.77, z: 0.2, w: 0.5, h: 0.02, d: 2.4, mat: 'linen', occluder: false },  // runner
    // place settings: plates + glasses down both sides
    { type: 'cyl', x: -0.42, y: 0.78, z: -0.7, r: 0.14, h: 0.02, mat: 'china', occluder: false },
    { type: 'cyl', x: -0.42, y: 0.78, z: 0.2, r: 0.14, h: 0.02, mat: 'china', occluder: false },
    { type: 'cyl', x: -0.42, y: 0.78, z: 1.1, r: 0.14, h: 0.02, mat: 'china', occluder: false },
    { type: 'cyl', x: 0.42, y: 0.78, z: -0.7, r: 0.14, h: 0.02, mat: 'china', occluder: false },
    { type: 'cyl', x: 0.42, y: 0.78, z: 0.2, r: 0.14, h: 0.02, mat: 'china', occluder: false },
    { type: 'cyl', x: 0.42, y: 0.78, z: 1.1, r: 0.14, h: 0.02, mat: 'china', occluder: false },
    { type: 'cyl', x: -0.18, y: 0.86, z: -0.7, r: 0.035, h: 0.14, mat: 'glassware', occluder: false },
    { type: 'cyl', x: -0.18, y: 0.86, z: 0.2, r: 0.035, h: 0.14, mat: 'glassware', occluder: false },
    { type: 'cyl', x: -0.18, y: 0.86, z: 1.1, r: 0.035, h: 0.14, mat: 'glassware', occluder: false },
    { type: 'cyl', x: 0.18, y: 0.86, z: -0.7, r: 0.035, h: 0.14, mat: 'glassware', occluder: false },
    { type: 'cyl', x: 0.18, y: 0.86, z: 0.2, r: 0.035, h: 0.14, mat: 'glassware', occluder: false },
    { type: 'cyl', x: 0.18, y: 0.86, z: 1.1, r: 0.035, h: 0.14, mat: 'glassware', occluder: false },
    // low centrepiece so it does not fight the chandelier
    { type: 'vase', x: 0, y: 0.78, z: 0.2, r: 0.10, h: 0.16, mat: 'brass', stems: 'plant' },

    // Chairs down both long sides
    { type: 'box', x: -0.85, y: 0.24, z: -0.7, w: 0.5, h: 0.46, d: 0.5, mat: 'chair' },
    { type: 'box', x: -0.85, y: 0.72, z: -0.92, w: 0.5, h: 0.52, d: 0.1, mat: 'chair' },
    { type: 'box', x: -0.85, y: 0.24, z: 0.2, w: 0.5, h: 0.46, d: 0.5, mat: 'chair' },
    { type: 'box', x: -0.85, y: 0.72, z: -0.02, w: 0.5, h: 0.52, d: 0.1, mat: 'chair' },
    { type: 'box', x: -0.85, y: 0.24, z: 1.1, w: 0.5, h: 0.46, d: 0.5, mat: 'chair' },
    { type: 'box', x: -0.85, y: 0.72, z: 0.88, w: 0.5, h: 0.52, d: 0.1, mat: 'chair' },
    { type: 'box', x: 0.85, y: 0.24, z: -0.7, w: 0.5, h: 0.46, d: 0.5, mat: 'chair' },
    { type: 'box', x: 0.85, y: 0.72, z: -0.48, w: 0.5, h: 0.52, d: 0.1, mat: 'chair' },
    { type: 'box', x: 0.85, y: 0.24, z: 0.2, w: 0.5, h: 0.46, d: 0.5, mat: 'chair' },
    { type: 'box', x: 0.85, y: 0.72, z: 0.42, w: 0.5, h: 0.52, d: 0.1, mat: 'chair' },
    { type: 'box', x: 0.85, y: 0.24, z: 1.1, w: 0.5, h: 0.46, d: 0.5, mat: 'chair' },
    { type: 'box', x: 0.85, y: 0.72, z: 1.32, w: 0.5, h: 0.52, d: 0.1, mat: 'chair' },

    // Chandelier: canopy, ring, candle arms
    { type: 'cyl', x: 0, y: 2.5, z: 0.2, r: 0.014, h: 0.5, mat: 'brass', occluder: false },
    { type: 'cyl', x: 0, y: 1.9, z: 0.2, rTop: 0.34, rBot: 0.34, h: 0.03, mat: 'brass', caps: false, occluder: false },

    // Sideboard with a mirror on the far -x wall
    { type: 'box', x: -2.35, y: 0.42, z: 0.2, w: 0.44, h: 0.84, d: 1.8, mat: 'walnut' },
    { type: 'box', x: -2.5, y: 1.55, z: 0.2, w: 0.03, h: 1.0, d: 1.4, mat: 'mirror', occluder: false },
    { type: 'vase', x: -2.3, y: 0.86, z: -0.4, r: 0.1, h: 0.34, mat: 'china', stems: 'plant' },
    { type: 'stack', x: -2.3, y: 0.86, z: 0.7, mats: ['art', 'walnut'], n: 2 },

    // Plant and art
    { type: 'plant', x: 2.2, z: -2.9, scale: 1.3, pot: 'walnut', foliage: 'plant', stem: 'plant', clumps: 8 },
    { type: 'art', x: 0, y: 1.9, z: 3.44, w: 1.6, h: 1.0, yaw: 3.14159, frame: 'walnut', canvas: 'art' }
  ],

  mirrorPlane: { point: [-2.485, 1.55, 0.2], normal: [1, 0, 0] },
  reflectors: [
    { kind: 'mirror', label: 'the sideboard mirror', centre: [-2.5, 1.55, 0.2], normal: [1, 0, 0], w: 1.4, h: 1.0, gloss: 0.9 },
    { kind: 'gloss', label: 'the table top', centre: [0, 0.77, 0.2], normal: [0, 1, 0], w: 1.3, h: 2.7, gloss: 0.55 }
  ],

  camera: { x: 0, z: 2.9, height: 1.34, yaw: 180, focal: 26, lens: 'wide_zoom' },
  coaching: { keyLesson: 'Make the fixture the hero without clipping it, and keep the table off the lens axis.', parScore: 72 }
};
