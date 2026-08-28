/**
 * Scene 8 - Primary bedroom, morning light.
 *
 * A big soft duvet is the largest surface in the frame and the thing the eye
 * checks first, so this room is about a gentle, even key that keeps texture
 * in white bedding without going flat. East window with sheer-framed drapes,
 * two warm bedside lamps that must read as lit without blooming.
 */

export const bedroom = {
  id: 'bedroom',
  name: 'Primary bedroom',
  subtitle: 'East window, soft morning',
  order: 8,
  brief:
    'The bed fills the frame and the duvet is nearly white, so it clips the instant you overexpose. The window ' +
    'is gentle morning light, only a few stops over the room, and two bedside lamps are on. Keep the bedding ' +
    'soft and textured, let the lamps glow, and do not let a hard key rake the linen.',
  difficulty: 2,
  room: { width: 5.2, depth: 5.8, ceiling: 2.72 },
  trimColor: '#efece4',

  materials: {
    wall:     { albedo: '#dad4c8', roughness: 0.93, spec: 0.02, tex: 2 },
    ceiling:  { albedo: '#f2efe8', roughness: 0.95, spec: 0.012, tex: 2 },
    floor:    { albedo: '#a5825b', roughness: 0.38, spec: 0.11, tex: 1, texDir: 1 },
    rug:      { albedo: '#c7bda9', roughness: 0.97, spec: 0.006, tex: 6 },
    frame:    { albedo: '#5c4632', roughness: 0.34, spec: 0.14, tex: 8 },
    bedding:  { albedo: '#eae6dc', roughness: 0.92, spec: 0.015, tex: 5, texScale: 1.4 },
    pillow:   { albedo: '#f0ece2', roughness: 0.9,  spec: 0.02, tex: 5, texScale: 1.6 },
    throw:    { albedo: '#9aa68c', roughness: 0.94, spec: 0.02, tex: 5 },
    walnut:   { albedo: '#5a4231', roughness: 0.33, spec: 0.14, tex: 8 },
    brass:    { albedo: '#9a7c3f', roughness: 0.20, spec: 0.5, tex: 10 },
    linen:    { albedo: '#ded8c8', roughness: 0.95, spec: 0.02, tex: 5 },
    shade:    { albedo: '#efe7d6', roughness: 0.9,  spec: 0.03, tex: 5 },
    plant:    { albedo: '#4c6b3d', roughness: 0.85, spec: 0.05, tex: 11, texScale: 2 },
    art:      { albedo: '#2c2a30', roughness: 0.6,  spec: 0.05 },
    upholstery:{ albedo: '#8a8378', roughness: 0.92, spec: 0.02, tex: 5 }
  },

  windows: [
    { wall: '+x', u: 3.4, v: 1.5, w: 2.0, h: 1.7, ev: 12.8, kelvin: 6400, view: 'foliage', drapes: 'linen', drapeWidth: 0.4 },
    { wall: '+x', u: 1.0, v: 1.4, w: 1.0, h: 1.5, ev: 12.6, kelvin: 6500, view: 'foliage' }
  ],

  fixtures: [
    { x: -1.5, y: 0.72, z: -2.0, lumens: 340, kelvin: 2650, radius: 0.05, label: 'Bedside lamp' },
    { x: 1.5, y: 0.72, z: -2.0, lumens: 340, kelvin: 2650, radius: 0.05, label: 'Bedside lamp' },
    { x: 0, y: 2.5, z: 0.6, lumens: 620, kelvin: 2800, radius: 0.06, label: 'Ceiling fixture' }
  ],

  props: [
    { type: 'rug', x: 0, z: 0.4, w: 4.0, d: 3.4, yaw: 0, rug: 'rug', border: 'throw' },

    // Bed against the -z wall, headboard toward it
    { type: 'bed', x: 0, z: -1.4, yaw: 0, w: 1.9, d: 2.2, frame: 'frame', mattress: 'bedding', bedding: 'bedding', pillow: 'pillow' },
    { type: 'box', x: 0, y: 0.5, z: -0.35, w: 2.0, h: 0.05, d: 0.9, mat: 'throw', occluder: false },  // folded throw at the foot

    // Nightstands with lamps
    { type: 'table', x: -1.5, z: -2.0, yaw: 0, w: 0.55, d: 0.42, h: 0.52, top: 'walnut', legs: 'walnut' },
    { type: 'table', x: 1.5, z: -2.0, yaw: 0, w: 0.55, d: 0.42, h: 0.52, top: 'walnut', legs: 'walnut' },
    { type: 'lamp', x: -1.5, z: -2.0, kind: 'table', h: 0.36, base: 'brass', stem: 'brass', shade: 'shade' },
    { type: 'lamp', x: 1.5, z: -2.0, kind: 'table', h: 0.36, base: 'brass', stem: 'brass', shade: 'shade' },
    { type: 'stack', x: -1.5, y: 0.54, z: -1.95, mats: ['art', 'frame'], n: 2 },

    // Bench at the foot, dresser, reading chair
    { type: 'box', x: 0, y: 0.24, z: 0.35, w: 1.7, h: 0.46, d: 0.44, mat: 'upholstery' },
    { type: 'box', x: -2.35, y: 0.44, z: 1.6, w: 0.5, h: 0.88, d: 1.4, mat: 'walnut' },
    { type: 'vase', x: -2.35, y: 0.88, z: 1.3, r: 0.09, h: 0.3, mat: 'brass', stems: 'plant' },
    { type: 'armchair', x: 2.05, z: 0.4, yaw: -0.9, body: 'upholstery', legs: 'walnut' },
    { type: 'plant', x: 2.25, z: -2.1, scale: 1.15, pot: 'walnut', foliage: 'plant', stem: 'plant', clumps: 8 },

    // Art over the bed, ceiling fixture body
    { type: 'art', x: 0, y: 1.9, z: -2.84, w: 1.4, h: 0.9, yaw: 0, frame: 'walnut', canvas: 'art' },
    { type: 'cyl', x: 0, y: 2.44, z: 0.6, rTop: 0.16, rBot: 0.13, h: 0.14, mat: 'brass', caps: false, occluder: false }
  ],

  reflectors: [],
  camera: { x: 1.7, z: 2.4, height: 1.30, yaw: 206, focal: 24, lens: 'wide_zoom' },
  coaching: { keyLesson: 'A near-white duvet clips first. Expose for the bedding, lift the room to it.', parScore: 76 }
};
