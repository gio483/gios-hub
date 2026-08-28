/**
 * Keylight - live RGB histogram.
 *
 * Drawn from the resolved display pixels, so what it shows is what the file
 * would show. The middle-grey mark and the clipping shoulder are called out
 * because those are the two places a decision actually gets made.
 */

import { histogramFrom } from '../physics/sensor.js';

export class Histogram {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.data = null;
  }

  update(frame) {
    const wrap = this.canvas.parentElement;
    if (wrap) wrap.classList.toggle('on', !!frame);
    if (!frame) { this.data = null; this.draw(); return; }
    this.data = histogramFrom(frame.pixels, 128);
    this.draw();
  }

  draw() {
    const c = this.ctx;
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(40, r.width), h = Math.max(24, r.height);
    if (this.canvas.width !== Math.round(w * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,.42)';
    c.fillRect(0, 0, w, h);

    if (!this.data) return;
    const { r: hr, g: hg, b: hb, bins } = this.data;
    let peak = 1;
    for (let i = 1; i < bins - 1; i++) peak = Math.max(peak, hr[i], hg[i], hb[i]);

    const plot = (arr, colour) => {
      c.globalCompositeOperation = 'screen';
      c.fillStyle = colour;
      c.beginPath();
      c.moveTo(0, h);
      for (let i = 0; i < bins; i++) {
        const x = (i / (bins - 1)) * w;
        const y = h - Math.min(1, arr[i] / peak) * (h - 2);
        c.lineTo(x, y);
      }
      c.lineTo(w, h);
      c.closePath();
      c.fill();
    };
    plot(hr, 'rgba(230,70,60,.62)');
    plot(hg, 'rgba(80,220,110,.62)');
    plot(hb, 'rgba(70,130,255,.62)');
    c.globalCompositeOperation = 'source-over';

    // Middle grey lands at 46% of the sRGB range. Clipping is the last bin.
    c.strokeStyle = 'rgba(255,255,255,.28)';
    c.setLineDash([2, 3]);
    c.beginPath(); c.moveTo(w * 0.4607, 0); c.lineTo(w * 0.4607, h); c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(255,255,255,.32)';
    c.font = '9px ui-monospace, monospace';
    c.fillText('18%', w * 0.4607 + 3, 10);

    const blown = hr[bins - 1] + hg[bins - 1] + hb[bins - 1];
    const crushed = hr[0] + hg[0] + hb[0];
    if (blown > peak * 0.02) { c.fillStyle = 'rgba(255,70,70,.85)'; c.fillRect(w - 3, 0, 3, h); }
    if (crushed > peak * 0.02) { c.fillStyle = 'rgba(70,130,255,.8)'; c.fillRect(0, 0, 3, h); }
  }
}
