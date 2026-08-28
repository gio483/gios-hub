/**
 * Keylight - furniture and decor kit.
 *
 * Compound builders that expand one high-level prop (a sofa, a bed, a plant)
 * into the dozens of primitives a real piece needs, so scene files stay
 * readable while the rooms read as places rather than diagrams. Each builder
 * pushes geometry into the shared MeshBuilder and returns the occluder boxes
 * worth ray-tracing shadows against - the large masses only; decor is left to
 * ambient occlusion to ground.
 *
 * A furniture piece has its own local frame (x forward is +z, right is +x)
 * rotated by `yaw` about its footprint centre, matching the camera and light
 * yaw convention used everywhere else.
 */

/** Local (x,z) in a piece's frame -> world (x,z). */
function place(cx, cz, yaw, lx, lz) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [cx + lx * c + lz * s, cz - lx * s + lz * c];
}

/** Registry of expanders keyed by prop `type`. */
export const FURNITURE = {
  sofa: sofa,
  armchair: (mb, p, id) => sofa(mb, { ...p, w: p.w ?? 0.92, seats: 1 }, id),
  bed,
  plant,
  lamp,
  art,
  rug,
  table,
  bookcase,
  pendant,
  vase,
  stack
};

export function isFurniture(type) { return !!FURNITURE[type]; }

export function expandFurniture(mb, p, idOf) {
  return FURNITURE[p.type](mb, p, idOf) || [];
}

/* ------------------------------------------------------------------ */

function sofa(mb, p, idOf) {
  const { x, z, yaw = 0, w = 2.4, d = 0.95 } = p;
  const body = idOf(p.body);
  const legMat = p.legs ? idOf(p.legs) : body;
  const cushionMat = p.cushion ? idOf(p.cushion) : body;
  const seatH = 0.42, armH = 0.62, backH = 0.80, legH = 0.14;
  const y0 = legH;
  const seats = p.seats ?? Math.max(2, Math.round(w / 0.85));

  const B = (lx, ly, lz, bw, bh, bd, mat) => {
    const [wx, wz] = place(x, z, yaw, lx, lz);
    mb.box(wx, ly, wz, bw, bh, bd, mat, yaw);
  };
  // base, back, arms
  B(0, y0 + (seatH - legH) / 2, 0, w, seatH - legH, d, body);
  B(0, y0 + backH / 2, -(d / 2 - 0.10), w, backH, 0.20, body);
  B(-(w / 2 - 0.10), y0 + (armH - legH) / 2, 0, 0.20, armH - legH, d, body);
  B((w / 2 - 0.10), y0 + (armH - legH) / 2, 0, 0.20, armH - legH, d, body);
  // seat + back cushions
  const inner = w - 0.4;
  const cw = inner / seats;
  for (let i = 0; i < seats; i++) {
    const lx = -inner / 2 + cw * (i + 0.5);
    B(lx, seatH + 0.05, 0.04, cw - 0.04, 0.14, d - 0.24, cushionMat);
    B(lx, seatH + 0.20, -(d / 2 - 0.20), cw - 0.05, 0.34, 0.16, cushionMat);
  }
  // legs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [wx, wz] = place(x, z, yaw, sx * (w / 2 - 0.12), sz * (d / 2 - 0.12));
    mb.cylinder(wx, legH / 2, wz, 0.028, 0.022, legH, legMat, 6);
  }
  return [{ centre: [x, (y0 + backH) / 2, z], half: [w / 2, backH / 2, d / 2], yaw }];
}

function bed(mb, p, idOf) {
  const { x, z, yaw = 0, w = 1.6, d = 2.1 } = p;
  const frame = idOf(p.frame);
  const mattress = idOf(p.mattress || p.bedding || p.frame);
  const bedding = idOf(p.bedding || p.mattress || p.frame);
  const pillowMat = idOf(p.pillow || p.bedding || p.frame);
  const B = (lx, ly, lz, bw, bh, bd, mat) => {
    const [wx, wz] = place(x, z, yaw, lx, lz);
    mb.box(wx, ly, wz, bw, bh, bd, mat, yaw);
  };
  B(0, 0.16, 0, w + 0.1, 0.32, d + 0.1, frame);              // frame
  B(0, 0.34, 0, w, 0.14, d, mattress);                        // mattress
  B(0, 0.42, 0.06, w + 0.04, 0.12, d - 0.28, bedding);        // duvet
  B(0, 0.30, d / 2 - 0.02, w + 0.06, 0.34, 0.10, bedding);    // duvet fold at foot
  B(0, 0.86, -(d / 2 + 0.02), w + 0.14, 1.0, 0.08, frame);    // headboard
  for (const sx of [-1, 1]) {                                  // pillows
    mb.sphere(...place3(x, z, yaw, sx * w * 0.24, 0.50, -(d / 2 - 0.28)), 0.28, 0.10, 0.20, pillowMat, 5, 8);
  }
  return [{ centre: [x, 0.4, z], half: [(w + 0.14) / 2, 0.5, (d + 0.1) / 2], yaw }];
}

function plant(mb, p, idOf) {
  const { x, z, scale = 1 } = p;
  const pot = idOf(p.pot);
  const foliage = idOf(p.foliage);
  const potH = (p.potH ?? 0.42) * scale;
  const potR = (p.potR ?? 0.20) * scale;
  mb.cylinder(x, potH / 2, z, potR, potR * 0.78, potH, pot, 12);
  mb.cylinder(x, potH - 0.02, z, potR * 0.9, potR * 0.9, 0.03, idOf(p.soil || p.foliage), 12); // soil top
  // trunk
  mb.cylinder(x, potH + 0.28 * scale, z, 0.025 * scale, 0.04 * scale, 0.56 * scale, idOf(p.stem || p.pot), 6);
  // bushy canopy: overlapping ellipsoids at varied heights
  const base = potH + 0.5 * scale;
  const clumps = p.clumps ?? 7;
  for (let i = 0; i < clumps; i++) {
    const a = (i / clumps) * Math.PI * 2 + i * 0.7;
    const r = (0.16 + 0.12 * ((i * 37) % 5) / 5) * scale;
    const rr = (0.22 + 0.16 * ((i * 53) % 4) / 4) * scale;
    const hx = Math.cos(a) * rr * 0.9;
    const hz = Math.sin(a) * rr * 0.9;
    const hy = base + ((i * 29) % 6) / 6 * 0.7 * scale;
    mb.sphere(x + hx, hy, z + hz, r * 1.3, r, r * 1.3, foliage, 5, 8);
  }
  return [];   // plants are soft; AO grounds them
}

function lamp(mb, p, idOf) {
  const { x, z, kind = 'table' } = p;
  const base = idOf(p.base || p.stem);
  const stem = idOf(p.stem || p.base);
  const shade = idOf(p.shade);
  const h = kind === 'floor' ? (p.h ?? 1.5) : (p.h ?? 0.5);
  mb.cylinder(x, 0.02, z, kind === 'floor' ? 0.14 : 0.10, kind === 'floor' ? 0.16 : 0.11, 0.04, base, 12);
  mb.cylinder(x, h / 2, z, 0.016, 0.02, h, stem, 8);
  mb.cylinder(x, h + 0.11, z, kind === 'floor' ? 0.19 : 0.15, kind === 'floor' ? 0.24 : 0.19, 0.24, shade, 14, false);
  return [];
}

function art(mb, p, idOf) {
  // Wall-hung. `n` is the outward wall normal; the piece is a thin frame with
  // an inset canvas, sitting just proud of the wall.
  const { x, y, z, w = 0.9, h = 0.65, yaw = 0 } = p;
  const frame = idOf(p.frame);
  const canvas = idOf(p.canvas || p.frame);
  const B = (lx, ly, bw, bh, bd, mat) => {
    const [wx, wz] = place(x, z, yaw, lx, 0);
    mb.box(wx, y + ly, wz, bw, bh, bd, mat, yaw);
  };
  const t = 0.05, fr = 0.05;
  B(0, h / 2 - fr / 2, w, fr, t, frame);          // top
  B(0, -h / 2 + fr / 2, w, fr, t, frame);         // bottom
  B(-w / 2 + fr / 2, 0, fr, h - 2 * fr, t, frame);// left
  B(w / 2 - fr / 2, 0, fr, h - 2 * fr, t, frame); // right
  B(0, 0, w - 2 * fr, h - 2 * fr, t * 0.6, canvas);
  return [];
}

function rug(mb, p, idOf) {
  const { x, z, w = 2.6, d = 1.8, yaw = 0 } = p;
  const rugMat = idOf(p.rug);
  const border = p.border ? idOf(p.border) : rugMat;
  const q = (lw, ld, y, mat) => {
    const c = [place(x, z, yaw, -lw / 2, -ld / 2), place(x, z, yaw, lw / 2, -ld / 2),
      place(x, z, yaw, lw / 2, ld / 2), place(x, z, yaw, -lw / 2, ld / 2)];
    mb.quad([c[0][0], y, c[0][1]], [c[1][0], y, c[1][1]], [c[2][0], y, c[2][1]], [c[3][0], y, c[3][1]], mat);
  };
  q(w, d, 0.006, border);
  q(w - 0.18, d - 0.18, 0.009, rugMat);
  return [];
}

function table(mb, p, idOf) {
  const { x, z, yaw = 0, w = 1.2, d = 0.7, h = 0.42 } = p;
  const top = idOf(p.top);
  const legMat = idOf(p.legs || p.top);
  const [tx, tz] = [x, z];
  mb.box(tx, h - 0.02, tz, w, 0.04, d, top, yaw);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [wx, wz] = place(x, z, yaw, sx * (w / 2 - 0.08), sz * (d / 2 - 0.08));
    mb.cylinder(wx, (h - 0.04) / 2, wz, 0.026, 0.03, h - 0.04, legMat, 6);
  }
  return [{ centre: [x, h / 2, z], half: [w / 2, h / 2, d / 2], yaw }];
}

function bookcase(mb, p, idOf) {
  const { x, z, yaw = 0, w = 1.6, h = 1.9, d = 0.34 } = p;
  const frame = idOf(p.frame);
  const books = idOf(p.books || p.frame);
  const B = (lx, ly, lz, bw, bh, bd, mat) => {
    const [wx, wz] = place(x, z, yaw, lx, lz);
    mb.box(wx, ly, wz, bw, bh, bd, mat, yaw);
  };
  B(0, h / 2, -(d / 2 - 0.02), w, h, 0.04, frame);   // back
  B(0, 0.02, 0, w, 0.04, d, frame);                   // bottom
  B(0, h - 0.02, 0, w, 0.04, d, frame);               // top
  const shelves = p.shelves ?? 4;
  for (let i = 1; i < shelves; i++) {
    const sy = (h / shelves) * i;
    B(0, sy, 0, w - 0.06, 0.03, d - 0.04, frame);
    // book blocks + a gap or two per shelf
    let lx = -w / 2 + 0.08;
    while (lx < w / 2 - 0.14) {
      const bw = 0.10 + ((Math.floor((lx + i) * 13) % 5) / 5) * 0.22;
      const bh = 0.20 + ((Math.floor((lx * 7 + i) * 11) % 4) / 4) * 0.06;
      if ((Math.floor((lx * 5 + i) * 17) % 7) !== 0) {
        B(lx + bw / 2, sy + 0.03 + bh / 2, 0.02, bw, bh, d - 0.10, books);
      }
      lx += bw + 0.006;
    }
  }
  return [{ centre: [x, h / 2, z], half: [w / 2, h / 2, d / 2], yaw }];
}

function pendant(mb, p, idOf) {
  const { x, y, z, drop = 0.5 } = p;
  const metal = idOf(p.metal);
  const shade = idOf(p.shade || p.metal);
  mb.cylinder(x, y + drop / 2, z, 0.012, 0.012, drop, metal, 6);
  mb.cylinder(x, y - 0.02, z, (p.r ?? 0.16), (p.r ?? 0.16) * 0.5, 0.22, shade, 16, false);
  return [];
}

function vase(mb, p, idOf) {
  const { x, y = 0, z, r = 0.09, h = 0.28 } = p;
  const mat = idOf(p.mat);
  mb.cylinder(x, y + h * 0.35, z, r * 0.55, r * 0.4, h * 0.7, mat, 12);
  mb.sphere(x, y + h * 0.28, z, r, r * 0.8, r, mat, 5, 10);
  if (p.stems) {
    const st = idOf(p.stems);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      mb.sphere(x + Math.cos(a) * 0.10, y + h + 0.14, z + Math.sin(a) * 0.10, 0.07, 0.09, 0.07, st, 4, 7);
    }
  }
  return [];
}

function stack(mb, p, idOf) {
  // a small stack of books / trays on a surface
  const { x, y = 0, z, yaw = 0 } = p;
  const mats = (p.mats || [p.mat]).map(idOf);
  let cy = y;
  const n = p.n ?? 3;
  for (let i = 0; i < n; i++) {
    const bw = 0.26 - i * 0.03, bd = 0.20 - i * 0.02, bh = 0.035;
    mb.box(x, cy + bh / 2, z, bw, bh, bd, mats[i % mats.length], yaw + i * 0.12);
    cy += bh;
  }
  return [];
}

/* small helper: local (x,z) + explicit y -> world triple */
function place3(cx, cz, yaw, lx, ly, lz) {
  const [wx, wz] = place(cx, cz, yaw, lx, lz);
  return [wx, ly, wz];
}
