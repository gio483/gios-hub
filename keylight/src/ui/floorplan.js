/**
 * Keylight - top-down floor plan.
 *
 * All placement happens here rather than by dragging objects in the 3D view.
 * Free 3D dragging is imprecise on a mouse and miserable on a touchscreen,
 * and a plan is how photographers think about a room anyway. Every draggable
 * thing has a hit radius of at least 22 CSS pixels, so a 44px target holds
 * on a phone without hover.
 */

import { lensById } from '../physics/gear.js';
import { SENSOR_FULL_FRAME, SENSOR_APSC } from '../physics/constants.js';
import { raycastWall } from '../physics/lightmodel.js';

const HIT_RADIUS = 24;
const ROT_HANDLE = 46;

export class FloorPlan {
  constructor(canvas, { onChange, onSelect } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onChange = onChange || (() => {});
    this.onSelect = onSelect || (() => {});
    this.state = null;
    this.scene = null;
    this.drag = null;
    this.locked = new Set();
    this.hint = null;
    this._bind();
  }

  setScene(scene) { this.scene = scene; }
  setState(state) { this.state = state; }
  /** Ids the current drill will not let you move, e.g. "distance only". */
  setLocked(ids) { this.locked = new Set(ids || []); }
  /** Drill hints live in the DOM so they can wrap instead of being clipped. */
  setHint(hint) {
    this.hint = hint;
    const n = document.getElementById('plan-hint');
    if (n) n.textContent = hint || '';
  }

  /* ---------------- coordinate mapping ---------------- */

  layout() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(80, r.width), h = Math.max(80, r.height);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const room = this.scene.room;
    const pad = 30;
    const s = Math.min((w - pad * 2) / room.width, (h - pad * 2) / room.depth);
    return { w, h, dpr, s, cx: w / 2, cy: h / 2, room };
  }

  toScreen(x, z, L) { return [L.cx + x * L.s, L.cy - z * L.s]; }
  toWorld(px, py, L) { return [(px - L.cx) / L.s, (L.cy - py) / L.s]; }

  /* ---------------- drawing ---------------- */

  draw() {
    if (!this.scene || !this.state) return;
    const L = this.layout();
    const c = this.ctx;
    c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    c.clearRect(0, 0, L.w, L.h);

    const room = L.room;
    const hw = room.width / 2, hd = room.depth / 2;
    const [x0, y0] = this.toScreen(-hw, hd, L);
    const [x1, y1] = this.toScreen(hw, -hd, L);

    // Floor
    c.fillStyle = '#15171b';
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.strokeStyle = '#3b4048';
    c.lineWidth = 3;
    c.strokeRect(x0, y0, x1 - x0, y1 - y0);

    // Grid, one metre
    c.strokeStyle = 'rgba(255,255,255,.045)';
    c.lineWidth = 1;
    for (let gx = Math.ceil(-hw); gx < hw; gx++) {
      const [sx] = this.toScreen(gx, 0, L);
      c.beginPath(); c.moveTo(sx, y0); c.lineTo(sx, y1); c.stroke();
    }
    for (let gz = Math.ceil(-hd); gz < hd; gz++) {
      const [, sy] = this.toScreen(0, gz, L);
      c.beginPath(); c.moveTo(x0, sy); c.lineTo(x1, sy); c.stroke();
    }

    this.drawWindows(c, L);
    this.drawFixtures(c, L);
    this.drawLights(c, L);
    this.drawCamera(c, L);

  }

  drawWindows(c, L) {
    const room = L.room;
    for (const w of this.scene.windows || []) {
      const seg = wallSegment(w, room);
      const [ax, ay] = this.toScreen(seg.a[0], seg.a[1], L);
      const [bx, by] = this.toScreen(seg.b[0], seg.b[1], L);
      const g = c.createLinearGradient(ax, ay, bx, by);
      g.addColorStop(0, 'rgba(150,200,255,.25)');
      g.addColorStop(0.5, 'rgba(190,225,255,.95)');
      g.addColorStop(1, 'rgba(150,200,255,.25)');
      c.strokeStyle = g;
      c.lineWidth = 7;
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      c.lineCap = 'butt';
    }
  }

  drawFixtures(c, L) {
    for (const f of this.scene.fixtures || []) {
      const [sx, sy] = this.toScreen(f.x, f.z, L);
      c.fillStyle = 'rgba(255,196,120,.85)';
      c.beginPath(); c.arc(sx, sy, 4, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,196,120,.28)';
      c.lineWidth = 1;
      c.beginPath(); c.arc(sx, sy, 11, 0, 7); c.stroke();
    }
  }

  drawCamera(c, L) {
    const s = this.state;
    const [sx, sy] = this.toScreen(s.camX, s.camZ, L);
    const lens = lensById(s.lensId) || lensById('wide_zoom');
    const sensor = lens.sensor === 'apsc' ? SENSOR_APSC : SENSOR_FULL_FRAME;
    const halfFov = Math.atan((sensor.w / 2) / s.focal);
    const yaw = (s.camYaw * Math.PI) / 180;
    const reach = 3.2 * L.s;

    // Field of view wedge. This is the thing that tells you, before you shoot,
    // how much room you have just committed to lighting.
    c.save();
    c.translate(sx, sy);
    c.rotate(-yaw);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, reach);
    g.addColorStop(0, 'rgba(224,178,92,.24)');
    g.addColorStop(1, 'rgba(224,178,92,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, reach, -Math.PI / 2 - halfFov, -Math.PI / 2 + halfFov);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(224,178,92,.4)';
    c.lineWidth = 1;
    c.stroke();
    c.restore();

    const sel = s.selected === 'camera';
    c.fillStyle = sel ? '#f0c469' : '#e0b25c';
    c.strokeStyle = '#12140f';
    c.lineWidth = 2;
    c.beginPath(); c.arc(sx, sy, sel ? 11 : 9, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#12140f';
    c.font = '700 9px ui-monospace, monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('C', sx, sy + 0.5);

    if (sel) this.drawRotHandle(c, sx, sy, yaw, '#f0c469');
  }

  drawLights(c, L) {
    const s = this.state;
    for (const l of s.lights) {
      const [sx, sy] = this.toScreen(l.x, l.z, L);
      const sel = s.selected === l.id;
      const yaw = (l.yaw * Math.PI) / 180;
      const on = l.enabled;
      const col = on ? (sel ? '#7fd3ff' : '#5aa9d6') : '#5b6068';

      // Where the light is actually pointed, including a bounce path.
      c.save();
      c.strokeStyle = on ? 'rgba(122,200,240,.55)' : 'rgba(120,126,134,.35)';
      c.lineWidth = 2;
      c.setLineDash(l.mode === 'direct' ? [] : [5, 4]);
      if (l.mode === 'wall') {
        const hit = raycastWall(l.x, l.z, yaw, this.scene.room);
        const [hx, hy] = this.toScreen(hit.x, hit.z, L);
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
        c.fillStyle = 'rgba(122,200,240,.8)';
        c.beginPath(); c.arc(hx, hy, 4, 0, 7); c.fill();
      } else if (l.mode === 'ceiling') {
        c.beginPath(); c.arc(sx, sy, 17, 0, 7); c.stroke();
      } else {
        const len = 46;
        c.beginPath();
        c.moveTo(sx, sy);
        c.lineTo(sx + Math.sin(yaw) * len, sy - Math.cos(yaw) * len);
        c.stroke();
      }
      c.setLineDash([]);
      c.restore();

      c.fillStyle = col;
      c.strokeStyle = '#0b0d10';
      c.lineWidth = 2;
      c.beginPath(); c.arc(sx, sy, sel ? 11 : 9, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#08111a';
      c.font = '700 9px ui-monospace, monospace';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(l.id.replace('L', ''), sx, sy + 0.5);

      if (sel && l.mode === 'direct') this.drawRotHandle(c, sx, sy, yaw, '#7fd3ff');
      if (sel && l.mode === 'wall') this.drawRotHandle(c, sx, sy, yaw, '#7fd3ff');
    }
  }

  drawRotHandle(c, sx, sy, yaw, colour) {
    const hx = sx + Math.sin(yaw) * ROT_HANDLE;
    const hy = sy - Math.cos(yaw) * ROT_HANDLE;
    c.strokeStyle = colour;
    c.globalAlpha = 0.55;
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
    c.globalAlpha = 1;
    c.fillStyle = colour;
    c.beginPath(); c.arc(hx, hy, 7, 0, 7); c.fill();
    c.strokeStyle = '#0b0d10'; c.lineWidth = 2; c.stroke();
  }

  /* ---------------- interaction ---------------- */

  _bind() {
    const el = this.canvas;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', (e) => this.onUp(e));
  }

  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  hitTest(px, py, L) {
    const s = this.state;
    const near = (x, z, radius = HIT_RADIUS) => {
      const [sx, sy] = this.toScreen(x, z, L);
      return Math.hypot(px - sx, py - sy) <= radius;
    };
    // Rotation handles of the current selection take priority.
    if (s.selected === 'camera') {
      const [sx, sy] = this.toScreen(s.camX, s.camZ, L);
      const yaw = (s.camYaw * Math.PI) / 180;
      if (Math.hypot(px - (sx + Math.sin(yaw) * ROT_HANDLE), py - (sy - Math.cos(yaw) * ROT_HANDLE)) <= 20) {
        return { kind: 'rotate', target: 'camera' };
      }
    }
    const selLight = s.lights.find((l) => l.id === s.selected);
    if (selLight && selLight.mode !== 'ceiling') {
      const [sx, sy] = this.toScreen(selLight.x, selLight.z, L);
      const yaw = (selLight.yaw * Math.PI) / 180;
      if (Math.hypot(px - (sx + Math.sin(yaw) * ROT_HANDLE), py - (sy - Math.cos(yaw) * ROT_HANDLE)) <= 20) {
        return { kind: 'rotate', target: selLight.id };
      }
    }
    for (const l of s.lights) {
      if (near(l.x, l.z)) return { kind: 'move', target: l.id };
    }
    if (near(s.camX, s.camZ)) return { kind: 'move', target: 'camera' };
    return null;
  }

  onDown(e) {
    if (!this.state) return;
    const L = this.layout();
    const [px, py] = this.local(e);
    const hit = this.hitTest(px, py, L);
    if (!hit) return;
    if (this.locked.has(hit.target)) {
      this.flash = { t: Date.now(), target: hit.target };
      return;
    }
    this.canvas.setPointerCapture(e.pointerId);
    this.drag = { ...hit, L };
    if (hit.kind === 'move' && this.state.selected !== hit.target) {
      this.state.selected = hit.target;
      this.onSelect(hit.target);
    }
    this.draw();
    e.preventDefault();
  }

  onMove(e) {
    if (!this.drag) return;
    const L = this.drag.L;
    const [px, py] = this.local(e);
    const [wx, wz] = this.toWorld(px, py, L);
    const s = this.state;
    const room = this.scene.room;
    const clampX = (v) => Math.max(-room.width / 2 + 0.22, Math.min(room.width / 2 - 0.22, v));
    const clampZ = (v) => Math.max(-room.depth / 2 + 0.22, Math.min(room.depth / 2 - 0.22, v));

    if (this.drag.kind === 'move') {
      if (this.drag.target === 'camera') {
        s.camX = clampX(wx); s.camZ = clampZ(wz);
      } else {
        const l = s.lights.find((x) => x.id === this.drag.target);
        if (l) { l.x = clampX(wx); l.z = clampZ(wz); }
      }
    } else {
      const anchor = this.drag.target === 'camera'
        ? [s.camX, s.camZ]
        : (() => { const l = s.lights.find((x) => x.id === this.drag.target); return [l.x, l.z]; })();
      const deg = (Math.atan2(wx - anchor[0], wz - anchor[1]) * 180) / Math.PI;
      const snapped = e.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg * 2) / 2;
      if (this.drag.target === 'camera') s.camYaw = snapped;
      else {
        const l = s.lights.find((x) => x.id === this.drag.target);
        if (l) l.yaw = snapped;
      }
    }
    this.draw();
    this.onChange();
    e.preventDefault();
  }

  onUp(e) {
    if (!this.drag) return;
    this.drag = null;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
    this.onChange(true);
  }
}

/** The two floor-plan endpoints of a window on its wall. */
export function wallSegment(w, room) {
  const hw = room.width / 2, hd = room.depth / 2;
  const half = w.w / 2;
  switch (w.wall) {
    case '+x': return { a: [hw, -hd + w.u - half], b: [hw, -hd + w.u + half] };
    case '-x': return { a: [-hw, hd - w.u + half], b: [-hw, hd - w.u - half] };
    case '+z': return { a: [hw - w.u + half, hd], b: [hw - w.u - half, hd] };
    default:   return { a: [-hw + w.u - half, -hd], b: [-hw + w.u + half, -hd] };
  }
}
