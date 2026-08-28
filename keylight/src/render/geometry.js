/**
 * Keylight - scene geometry.
 *
 * Everything a scene contains is merged into a single BufferGeometry with a
 * per-vertex material id. One draw call for the whole room keeps phones
 * comfortable, and it means the occluder list and the visible geometry are
 * built from the same declarations rather than drifting apart.
 */

const PUSH = (arr, ...v) => arr.push(...v);

export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.mat = [];
  }

  get vertexCount() { return this.pos.length / 3; }

  tri(a, b, c, n, uvs, matId) {
    for (const [p, t] of [[a, uvs[0]], [b, uvs[1]], [c, uvs[2]]]) {
      PUSH(this.pos, p[0], p[1], p[2]);
      PUSH(this.nrm, n[0], n[1], n[2]);
      PUSH(this.uv, t[0], t[1]);
      this.mat.push(matId);
    }
  }

  /** Quad in winding order a,b,c,d. */
  quad(a, b, c, d, matId, uvScale = 1) {
    const u = sub(b, a), v = sub(d, a);
    const n = normalize(cross(u, v));
    const w = len(u) * uvScale, h = len(v) * uvScale;
    this.tri(a, b, c, n, [[0, 0], [w, 0], [w, h]], matId);
    this.tri(a, c, d, n, [[0, 0], [w, h], [0, h]], matId);
  }

  /** Axis-aligned box, optionally yawed about its own centre. */
  box(cx, cy, cz, w, h, d, matId, yaw = 0, faces = 0b111111) {
    const hx = w / 2, hy = h / 2, hz = d / 2;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const P = (x, y, z) => [cx + x * cs + z * sn, cy + y, cz - x * sn + z * cs];
    const c = [
      P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz),
      P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)
    ];
    if (faces & 1)  this.quad(c[5], c[4], c[7], c[6], matId); // +z
    if (faces & 2)  this.quad(c[0], c[1], c[2], c[3], matId); // -z
    if (faces & 4)  this.quad(c[1], c[5], c[6], c[2], matId); // +x
    if (faces & 8)  this.quad(c[4], c[0], c[3], c[7], matId); // -x
    if (faces & 16) this.quad(c[3], c[2], c[6], c[7], matId); // +y
    if (faces & 32) this.quad(c[4], c[5], c[1], c[0], matId); // -y
  }

  /** Vertical cylinder, for pendants, stems and legs. */
  cylinder(cx, cy, cz, rTop, rBot, h, matId, segments = 14, caps = true) {
    const hy = h / 2;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const p0b = [cx + Math.cos(a0) * rBot, cy - hy, cz + Math.sin(a0) * rBot];
      const p1b = [cx + Math.cos(a1) * rBot, cy - hy, cz + Math.sin(a1) * rBot];
      const p1t = [cx + Math.cos(a1) * rTop, cy + hy, cz + Math.sin(a1) * rTop];
      const p0t = [cx + Math.cos(a0) * rTop, cy + hy, cz + Math.sin(a0) * rTop];
      this.quad(p0b, p1b, p1t, p0t, matId);
      if (caps) {
        const top = [cx, cy + hy, cz], bot = [cx, cy - hy, cz];
        this.tri(top, p0t, p1t, [0, 1, 0], [[0, 0], [1, 0], [1, 1]], matId);
        this.tri(bot, p1b, p0b, [0, -1, 0], [[0, 0], [1, 0], [1, 1]], matId);
      }
    }
  }

  /** Quad with uv running 0..1, for panes that need a mapped view. */
  quadUV01(a, b, c, d, matId) {
    const u = sub(b, a), v = sub(d, a);
    const n = normalize(cross(u, v));
    this.tri(a, b, c, n, [[0, 0], [1, 0], [1, 1]], matId);
    this.tri(a, c, d, n, [[0, 0], [1, 1], [0, 1]], matId);
  }

  /**
   * A wall with any number of rectangular holes cut in it.
   *
   * Splits the wall on the union of every hole edge and emits the cells that
   * fall outside all of them. Band-by-band cutting looks simpler but silently
   * emits overlapping quads as soon as two windows share a wall at different
   * heights, which shows up as z-fighting stripes.
   */
  wallWithHoles(origin, right, up, width, height, holes, matId) {
    const at = (u, v) => [
      origin[0] + right[0] * u + up[0] * v,
      origin[1] + right[1] * u + up[1] * v,
      origin[2] + right[2] * u + up[2] * v
    ];
    if (!holes.length) {
      this.quad(at(0, 0), at(width, 0), at(width, height), at(0, height), matId);
      return;
    }
    const uniq = (vals, lo, hi) => {
      const s = [...new Set(vals.map((v) => Math.round(Math.min(hi, Math.max(lo, v)) * 1e4) / 1e4))];
      return s.sort((a, b) => a - b);
    };
    const us = uniq([0, width, ...holes.flatMap((h) => [h.u - h.w / 2, h.u + h.w / 2])], 0, width);
    const vs = uniq([0, height, ...holes.flatMap((h) => [h.v - h.h / 2, h.v + h.h / 2])], 0, height);
    for (let i = 0; i < us.length - 1; i++) {
      for (let j = 0; j < vs.length - 1; j++) {
        const u0 = us[i], u1 = us[i + 1], v0 = vs[j], v1 = vs[j + 1];
        if (u1 - u0 < 1e-4 || v1 - v0 < 1e-4) continue;
        const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
        const inside = holes.some(
          (h) => Math.abs(cu - h.u) < h.w / 2 && Math.abs(cv - h.v) < h.h / 2
        );
        if (inside) continue;
        this.quad(at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1), matId);
      }
    }
  }

  toAttributes() {
    return {
      position: new Float32Array(this.pos),
      normal: new Float32Array(this.nrm),
      uv: new Float32Array(this.uv),
      aMatId: new Float32Array(this.mat)
    };
  }
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const normalize = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
