/**
 * Scene 2 - Kitchen with island pendants.
 *
 * Stainless, glossy backsplash and polished stone. Every one of those is a
 * mirror at a shallow enough angle, so a bare head anywhere near the lens
 * axis puts a hard white blob into the frame. This room is about source size.
 */

export const kitchen = {
  id: 'kitchen',
  name: 'Kitchen',
  subtitle: 'Island pendants, north window',
  order: 2,
  brief:
    'Polished quartz, a glass tile backsplash and a stainless range. Three surfaces that will hand your flash ' +
    'straight back to the camera if you let them. The window is north facing so the gap is smaller than the ' +
    'living room, but the specular problem is much worse.',
  difficulty: 2,
  room: { width: 5.6, depth: 7.0, ceiling: 2.68 },

  materials: {
    wall:      { albedo: '#e2ded4', roughness: 0.93, spec: 0.02, tex: 2 },
    ceiling:   { albedo: '#f4f1eb', roughness: 0.96, spec: 0.012, tex: 2 },
    floor:     { albedo: '#8e8b83', roughness: 0.32, spec: 0.14, tex: 4, texScale: 0.125 },
    cabinet:   { albedo: '#d6d3cb', roughness: 0.42, spec: 0.10, tex: 2, texScale: 2 },
    lower:     { albedo: '#2f3a3c', roughness: 0.38, spec: 0.12, tex: 2, texScale: 2 },
    quartz:    { albedo: '#dfdcd4', roughness: 0.11, spec: 0.52, tex: 9, texScale: 4 },
    backsplash:{ albedo: '#b9c6c4', roughness: 0.07, spec: 0.68, tex: 4 },
    steel:     { albedo: '#a9a9a6', roughness: 0.14, spec: 0.72, tex: 10 },
    walnut:    { albedo: '#5a4231', roughness: 0.33, spec: 0.15, tex: 8 },
    brass:     { albedo: '#9a7c3f', roughness: 0.18, spec: 0.55, tex: 10 },
    stool:     { albedo: '#7d6a52', roughness: 0.8,  spec: 0.04, tex: 5 },
    shade:     { albedo: '#e7e2d5', roughness: 0.9,  spec: 0.03, tex: 5 },
    plant:     { albedo: '#4a6b3c', roughness: 0.85, spec: 0.05, tex: 11, texScale: 2 }
  },

  windows: [
    { wall: '-z', u: 2.8, v: 1.5, w: 2.2, h: 1.5, ev: 12.9, kelvin: 7200, view: 'foliage' }
  ],

  fixtures: [
    { x: 0, y: 1.72, z: 0.9,  lumens: 520, kelvin: 2850, radius: 0.055, label: 'Pendant' },
    { x: 0, y: 1.72, z: 0.0,  lumens: 520, kelvin: 2850, radius: 0.055, label: 'Pendant' },
    { x: 0, y: 1.72, z: -0.9, lumens: 520, kelvin: 2850, radius: 0.055, label: 'Pendant' },
    { x: -1.9, y: 2.5, z: 2.2, lumens: 300, kelvin: 2900, radius: 0.04, label: 'Can light' }
  ],

  props: [
    // Run of cabinetry along +x
    { type: 'box', x: 2.35, y: 0.45, z: 0.4, w: 0.62, h: 0.90, d: 5.0, mat: 'lower' },
    { type: 'box', x: 2.32, y: 0.925, z: 0.4, w: 0.70, h: 0.045, d: 5.1, mat: 'quartz' },
    { type: 'box', x: 2.62, y: 1.32, z: 0.4, w: 0.10, h: 0.75, d: 5.0, mat: 'backsplash', occluder: false },
    { type: 'box', x: 2.45, y: 2.05, z: 1.6, w: 0.38, h: 0.80, d: 2.4, mat: 'cabinet' },
    { type: 'box', x: 2.45, y: 2.05, z: -1.4, w: 0.38, h: 0.80, d: 1.6, mat: 'cabinet' },
    // Range and hood
    { type: 'box', x: 2.36, y: 0.45, z: -0.2, w: 0.64, h: 0.92, d: 0.78, mat: 'steel' },
    { type: 'box', x: 2.42, y: 1.85, z: -0.2, w: 0.46, h: 0.52, d: 0.86, mat: 'steel' },
    // Fridge
    { type: 'box', x: 2.35, y: 0.92, z: 2.85, w: 0.66, h: 1.84, d: 0.92, mat: 'steel' },

    // Island
    { type: 'box', x: -0.1, y: 0.44, z: 0.2, w: 1.10, h: 0.88, d: 2.5, mat: 'walnut' },
    { type: 'box', x: -0.1, y: 0.905, z: 0.2, w: 1.28, h: 0.05, d: 2.7, mat: 'quartz' },
    // Pendant stems
    { type: 'cyl', x: 0, y: 2.22, z: 0.9,  r: 0.012, h: 0.9, mat: 'brass', occluder: false },
    { type: 'cyl', x: 0, y: 2.22, z: 0.0,  r: 0.012, h: 0.9, mat: 'brass', occluder: false },
    { type: 'cyl', x: 0, y: 2.22, z: -0.9, r: 0.012, h: 0.9, mat: 'brass', occluder: false },
    { type: 'cyl', x: 0, y: 1.80, z: 0.9,  rTop: 0.09, rBot: 0.16, h: 0.22, mat: 'brass', caps: false, occluder: false },
    { type: 'cyl', x: 0, y: 1.80, z: 0.0,  rTop: 0.09, rBot: 0.16, h: 0.22, mat: 'brass', caps: false, occluder: false },
    { type: 'cyl', x: 0, y: 1.80, z: -0.9, rTop: 0.09, rBot: 0.16, h: 0.22, mat: 'brass', caps: false, occluder: false },
    // Stools
    { type: 'cyl', x: -1.0, y: 0.34, z: 0.85, r: 0.17, h: 0.68, mat: 'stool' },
    { type: 'cyl', x: -1.0, y: 0.34, z: 0.05, r: 0.17, h: 0.68, mat: 'stool' },
    { type: 'cyl', x: -1.0, y: 0.34, z: -0.75, r: 0.17, h: 0.68, mat: 'stool' },

    // Far run under the window
    { type: 'box', x: -1.6, y: 0.45, z: -3.05, w: 3.0, h: 0.90, d: 0.60, mat: 'lower' },
    { type: 'box', x: -1.6, y: 0.925, z: -3.05, w: 3.1, h: 0.045, d: 0.66, mat: 'quartz' },
    { type: 'box', x: -2.5, y: 0.98, z: -2.9, w: 0.24, h: 0.06, d: 0.24, mat: 'steel', occluder: false },
    { type: 'cyl', x: -2.5, y: 1.16, z: -2.9, r: 0.018, h: 0.30, mat: 'brass', occluder: false },
    { type: 'plant', x: -2.9, z: -2.9, scale: 0.5, pot: 'steel', foliage: 'plant', stem: 'plant', clumps: 6 },
    { type: 'vase', x: -0.1, y: 0.93, z: 0.9, r: 0.13, h: 0.16, mat: 'quartz' },
    { type: 'stack', x: -0.1, y: 0.93, z: -0.6, mats: ['walnut', 'brass', 'lower'], n: 3 }
  ],

  reflectors: [
    { kind: 'gloss', label: 'the backsplash', centre: [2.57, 1.32, 0.4], normal: [-1, 0, 0], w: 5.0, h: 0.75, gloss: 0.7 },
    { kind: 'gloss', label: 'the island top', centre: [-0.1, 0.93, 0.2], normal: [0, 1, 0], w: 1.28, h: 2.7, gloss: 0.55 },
    { kind: 'gloss', label: 'the range hood', centre: [2.19, 1.85, -0.2], normal: [-1, 0, 0], w: 0.86, h: 0.52, gloss: 0.75 }
  ],

  camera: { x: -0.85, z: -2.7, height: 1.3, yaw: 8, focal: 25, lens: 'wide_zoom' },
  coaching: { keyLesson: 'A hard source near the lens axis will always come back at you off gloss.', parScore: 74 }
};
