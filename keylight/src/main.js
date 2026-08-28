/**
 * Keylight - application shell.
 */

import { Engine } from './render/engine.js';
import { compileScene } from './render/compile.js';
import { SCENES, sceneById } from './scenes/index.js';
import { FloorPlan } from './ui/floorplan.js';
import { Histogram } from './ui/histogram.js';
import { ladderControl, sliderControl, segmented, dropdown, toggle, panel, el } from './ui/controls.js';
import {
  APERTURE_STOPS, SHUTTER_STOPS, ISO_STOPS,
  formatAperture, formatShutter, formatISO, effectiveCameraEV
} from './physics/exposure.js';
import { HEADS, MODIFIERS, LENSES, MAX_LIGHTS, lensById } from './physics/gear.js';
import { GELS } from './physics/color.js';
import { POWER_SETTINGS, syncBandCoverage, hssLossStops } from './physics/flash.js';
import { SENSOR_APSC, SENSOR_FULL_FRAME } from './physics/constants.js';
import { defaultState, addLight, removeLight, selectedLight, loadProgress, saveProgress } from './state.js';
import { scoreFrame } from './game/score.js';
import { MODULES, moduleById, isUnlocked } from './game/modules.js';
import { buildDaily, HERO_SETUPS, CONSTRAINTS, compareFrames } from './game/challenges.js';
import { meterFlash } from './physics/lightmodel.js';

const ASPECT = 3 / 2;

class App {
  constructor() {
    this.progress = loadProgress();
    this.mode = 'practice';
    this.activeModule = null;
    this.history = [];
    this.lastResult = null;
    this.compiledCache = new Map();
    this.dirty = true;
    this.busy = false;
    this.constraint = null;
    this.hero = null;
  }

  boot() {
    this.canvas = document.getElementById('render');
    this.engine = new Engine(this.canvas);
    this.hist = new Histogram(document.getElementById('hist'));
    this.plan = new FloorPlan(document.getElementById('plan'), {
      onChange: () => { this.dirty = true; this.refreshReadouts(); this.refreshPanels(); },
      onSelect: () => { this.refreshPanels(); this.renderPanels(); }
    });

    this.setScene(this.progress.lastScene || 'living-room');
    this.buildChrome();
    const firstVisit = this.progress.completedModules.length === 0 && !this.progress.seenIntro;
    // Mid-course players land on Learn, graduates land on Shoot.
    const graduated = this.progress.completedModules.length >= MODULES.length;
    this.setMode(graduated ? 'practice' : 'learn');
    if (firstVisit) {
      // No menu on the very first open: module one explains itself, and its
      // intro card is a better front door than a list of eleven boxes.
      this.progress.seenIntro = true;
      saveProgress(this.progress);
      this.startModule(MODULES[0].id);
    }

    window.addEventListener('resize', () => { this.layout(); this.dirty = true; });
    window.addEventListener('orientationchange', () => setTimeout(() => { this.layout(); this.dirty = true; }, 200));
    this.layout();
    this.loop();
  }

  /* ---------------- scene ---------------- */

  compiledFor(scene) {
    if (!this.compiledCache.has(scene.id)) this.compiledCache.set(scene.id, compileScene(scene));
    return this.compiledCache.get(scene.id);
  }

  setScene(idOrScene, keepState = false) {
    this.scene = typeof idOrScene === 'string' ? sceneById(idOrScene) : idOrScene;
    this.compiled = this.compiledFor(this.scene);
    this.engine.loadScene(this.compiled);
    if (!keepState || !this.state) this.state = defaultState(this.scene);
    this.state.sceneId = this.scene.id;
    this.plan.setScene(this.scene);
    this.plan.setState(this.state);
        this.history = [];
    this.lastResult = null;
    this.hist.update(null);
    this.dirty = true;
    if (typeof idOrScene === 'string') this.progress.lastScene = this.scene.id;
    document.getElementById('scene-name').innerHTML =
      `<b>${this.scene.name}</b> · ${this.scene.subtitle}`;
  }

  /* ---------------- layout ---------------- */

  layout() {
    const wrap = document.getElementById('frame-wrap');
    const box = document.getElementById('frame-box');
    const r = wrap.getBoundingClientRect();
    const availW = r.width - 20, availH = r.height - 20;
    let w = availW, h = w / ASPECT;
    if (h > availH) { h = availH; w = h * ASPECT; }
    w = Math.max(160, Math.floor(w)); h = Math.max(106, Math.floor(h));
    box.style.width = `${w}px`;
    box.style.height = `${h}px`;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.cssSize = { w, h };
    this.plan.draw();
  }

  /**
   * Preview resolution. The shader costs a fraction of a millisecond per
   * frame on a desktop GPU, so the viewfinder can afford to supersample
   * there - which is also its anti-aliasing. Phones render at roughly
   * native and drop to a smaller buffer only if a capture proved slow.
   */
  previewScale() {
    const mobile = Math.min(screen.width, screen.height) < 820;
    const slow = (this.engine.msPerPass || 0) > 6;
    if (mobile) return slow ? 0.55 : Math.min(1.1, window.devicePixelRatio || 1);
    return slow ? 0.8 : Math.min(1.6, window.devicePixelRatio || 1.4);
  }

  captureScale() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mobile = Math.min(screen.width, screen.height) < 820;
    const cap = mobile ? 1100 : 1700;
    const want = this.cssSize.w * dpr;
    return Math.min(cap, want) / this.cssSize.w;
  }

  /* ---------------- render loop ---------------- */

  loop() {
    const step = () => {
      if (this.dirty && !this.busy && this.mode !== 'learnList') {
        this.dirty = false;
        try {
          this.engine.setSize(
            Math.round(this.cssSize.w * this.previewScale()),
            Math.round(this.cssSize.h * this.previewScale())
          );
          this.engine.renderPreview(this.state, ASPECT);
          this.stale();
        } catch (e) {
          console.error(e);
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  stale() {
    const b = document.getElementById('stale-badge');
    b.textContent = 'LIVE · AMBIENT ONLY';
    b.classList.add('live');
    const warn = document.getElementById('warn-badge');
    const band = syncBandCoverage(this.state.shutter, this.state.hss);
    if (band > 0.01 && this.state.lights.some((l) => l.enabled)) {
      warn.style.display = 'block';
      warn.textContent = `ABOVE SYNC · ${Math.round(band * 100)}% CURTAINED`;
    } else {
      warn.style.display = 'none';
    }
  }

  /* ---------------- shooting ---------------- */

  async shoot() {
    if (this.busy) return;
    if (this.constraint?.maxShots && this.history.length >= this.constraint.maxShots) {
      alert(`${this.constraint.label}: you have used all ${this.constraint.maxShots} exposures. Restart the run to try again.`);
      return;
    }
    this.busy = true;
    const prog = document.getElementById('progress');
    const fill = document.getElementById('prog-fill');
    const text = document.getElementById('prog-text');
    prog.classList.add('on');
    text.textContent = 'EXPOSING';
    fill.style.width = '0%';
    document.getElementById('shutter').disabled = true;

    try {
      const scale = this.captureScale();
      this.engine.setSize(
        Math.round(this.cssSize.w * scale),
        Math.round(this.cssSize.h * scale)
      );
      const passes = this.passCount();
      await this.engine.capture(this.state, ASPECT, passes, (p) => {
        fill.style.width = `${Math.round(p * 100)}%`;
      });

      text.textContent = 'READING THE FRAME';
      const linear = this.engine.readbackLinear(passes);
      const display = this.engine.readback();
      this.hist.update(display);

      const mask = this.engine.renderMask(this.state, ASPECT, false);
      const mirrorMask = this.compiled.scene.mirrorPlane
        ? this.engine.renderMask(this.state, ASPECT, true) : null;
      // renderMask leaves the framebuffer holding the mask, so put the
      // photograph back on screen before anyone looks at it.
      this.engine.presentLast(passes);

      const resolved = this.engine.lastResolved || [];
      const result = linear ? scoreFrame({
        state: this.state, compiled: this.compiled, resolved,
        frame: { width: linear.width, height: linear.height, linear: linear.pixels, mask: mask.pixels, mirrorMask: mirrorMask?.pixels }
      }) : null;

      if (result && this.hero?.frame) {
        const sim = compareFrames(display, this.hero.frame);
        result.similarity = sim;
        result.rubricOnly = result.total;
        result.total = Math.round(result.total * 0.6 + sim * 100 * 0.4);
      }
      this.lastResult = result;
      this.recordHistory(result, resolved);
      document.getElementById('stale-badge').textContent =
        `CAPTURED · ${passes} PASSES`;
      document.getElementById('stale-badge').classList.remove('live');
      this.refreshReadouts();
      // The photograph stays on screen until something is actually changed.
      // Without this a queued preview redraw can wipe the frame you just took.
      this.dirty = false;

      if (this.activeModule) this.evaluateModule();
      else this.showResult(result);
    } catch (e) {
      console.error(e);
      alert('The capture failed. ' + e.message);
    } finally {
      prog.classList.remove('on');
      document.getElementById('shutter').disabled = false;
      this.busy = false;
    }
  }

  /**
   * Accumulation passes, chosen from what the hardware actually delivered
   * last time rather than from a guess about the device.
   */
  /**
   * Accumulation passes, from what the hardware actually delivered last time
   * rather than from a guess about the device. Sixteen is enough to resolve a
   * soft shadow; more only helps on a big source.
   */
  passCount() {
    const budget = 850;
    const per = this.engine.msPerPass || 12;
    return Math.max(8, Math.min(48, Math.round(budget / per)));
  }

  recordHistory(result, resolved) {
    const s = this.state;
    const lens = lensById(s.lensId);
    const eq = s.focal * (lens?.sensor === 'apsc' ? SENSOR_APSC.crop : 1);
    const gear = result?.criteria.find((c) => c.id === 'gear');
    this.history.push({
      total: result?.total ?? 0,
      roomStops: result?.surfaceMedianStops ?? 0,
      band: resolved.length ? syncBandCoverage(s.shutter, s.hss) : 0,
      hss: s.hss, shutter: s.shutter, aperture: s.aperture, iso: s.iso,
      mode: s.lights[0]?.mode, eqFocal: eq, tilt: s.tilt,
      shiftX: s.shiftX, shiftY: s.shiftY,
      gearOk: (gear?.fraction ?? 0) >= 0.99,
      gearFraction: gear?.fraction ?? 1,
      inMirror: gear?.stats?.inMirror ?? 0,
      inFrame: gear?.stats?.inFrame ?? 0,
      at: Date.now()
    });
    if (this.history.length > 60) this.history.shift();
  }

  /* ---------------- result panel ---------------- */

  showResult(result) {
    if (!result) return;
    const panelEl = document.getElementById('result');
    document.getElementById('score-big').textContent = result.total;
    document.getElementById('score-verdict').textContent = result.similarity != null
      ? `${Math.round(result.similarity * 100)}% match to the target, ${result.rubricOnly} on the rubric. ${verdictFor(result.rubricOnly)}`
      : verdictFor(result.total);

    const body = document.getElementById('result-body');
    body.innerHTML = '';
    for (const c of result.criteria) {
      const row = el('div', 'crit');
      const head = el('div', 'crit-head');
      head.append(el('span', `crit-dot ${c.notApplicable ? 'na' : c.verdict}`));
      head.append(el('span', 'crit-name', c.label));
      head.append(el('span', 'crit-pts',
        c.notApplicable ? 'n/a' : `${Math.round(c.points)} / ${Math.round(c.normalisedWeight)}`));
      row.append(head, el('div', 'crit-detail', c.detail));
      body.append(row);
    }
    for (const p of result.penalties) {
      const row = el('div', 'crit');
      const head = el('div', 'crit-head');
      head.append(el('span', 'crit-dot fail'));
      head.append(el('span', 'crit-name', p.label));
      head.append(el('span', 'crit-pts pen', `−${Math.round(p.points)}`));
      row.append(head, el('div', 'crit-detail', p.detail));
      body.append(row);
    }

    const actions = el('div', 'result-actions');
    const again = el('button', 'btn primary', 'Adjust and reshoot');
    again.onclick = () => panelEl.classList.remove('on');
    actions.append(again);
    const insp = el('button', 'btn', 'Look at the frame');
    insp.onclick = () => panelEl.classList.remove('on');
    actions.append(insp);
    if (this.mode === 'daily') {
      const done = el('button', 'btn', 'Log today’s score');
      done.onclick = () => { this.logDaily(result.total); panelEl.classList.remove('on'); };
      actions.append(done);
    }
    body.append(actions);

    const best = this.progress.bestScores[this.scene.id] || 0;
    if (result.total > best) {
      this.progress.bestScores[this.scene.id] = result.total;
      saveProgress(this.progress);
    }
    panelEl.classList.add('on');
  }

  /* ---------------- chrome ---------------- */

  buildChrome() {
    document.getElementById('shutter').onclick = () => this.shoot();
    for (const b of document.querySelectorAll('.rail-btn')) {
      b.onclick = () => this.setMode(b.dataset.mode);
    }
    for (const t of document.querySelectorAll('.tab')) {
      t.onclick = () => { this.tab = t.dataset.tab; this.renderPanels(); };
    }
    document.querySelector('#coach .coach-close').onclick = () =>
      document.getElementById('coach').classList.remove('on');
    document.getElementById('btn-inspect').onclick = () => this.toggleInspect();
    this.tab = 'camera';
  }

  setMode(mode) {
    this.mode = mode;
    for (const b of document.querySelectorAll('.rail-btn')) {
      b.classList.toggle('on', b.dataset.mode === mode);
    }
    const learn = document.getElementById('learn-panel');
    const viewer = document.getElementById('viewer');
    const side = document.getElementById('side');
    const showList = (mode === 'learn' && !this.activeModule) || mode === 'gear' || mode === 'practice-menu';
    learn.classList.toggle('hidden', !showList);
    viewer.classList.toggle('hidden', showList);
    side.classList.toggle('hidden', showList);

    if (mode === 'learn' && !this.activeModule) this.renderModuleList();
    else if (mode === 'gear') this.renderGear();
    else if (mode === 'practice') { this.activeModule = null; this.renderPracticeMenu(); }
    else if (mode === 'daily') { this.activeModule = null; this.startDaily(); }
    this.updatePill();
    this.renderPanels();
    this.layout();
  }

  updatePill() {
    const p = document.getElementById('pill-mode');
    if (this.activeModule) {
      const done = this.activeModule.goals.filter((g) => this.goalState?.[g.id]).length;
      p.innerHTML = `Module ${this.activeModule.n} · <b>${done}/${this.activeModule.goals.length}</b>`;
    } else if (this.mode === 'daily') {
      p.innerHTML = `Streak <b>${this.progress.streak}</b>`;
    } else if (this.constraint) {
      p.innerHTML = `<b>${this.constraint.label}</b>`;
    } else {
      const best = this.progress.bestScores[this.scene.id];
      p.innerHTML = best ? `Best here <b>${best}</b>` : 'Free shoot';
    }
  }

  /* ---------------- control panels ---------------- */

  refreshPanels() { this.panelRoot?.refresh?.(); this.plan.draw(); }
  refreshReadouts() {
    const s = this.state;
    const set = (id, v, alert) => {
      const n = document.getElementById(id);
      n.querySelector('.v').textContent = v;
      n.classList.toggle('alert', !!alert);
    };
    set('ro-aperture', formatAperture(s.aperture), s.aperture > 16.5);
    const band = syncBandCoverage(s.shutter, s.hss);
    set('ro-shutter', formatShutter(s.shutter) + (s.hss ? ' HSS' : ''), band > 0.01);
    set('ro-iso', formatISO(s.iso), s.iso > 5000);
    set('ro-wb', s.whiteBalanceAuto ? 'AUTO' : `${Math.round(s.whiteBalance / 10) * 10}K`);
    const lens = lensById(s.lensId);
    const eq = Math.round(s.focal * (lens?.sensor === 'apsc' ? SENSOR_APSC.crop : 1));
    set('ro-focal', `${Math.round(s.focal)}mm`, eq < 20);
    const on = s.lights.filter((l) => l.enabled);
    set('ro-flash', on.length ? `${on.length}× 1/${on[0].power}` : 'OFF');
    this.updatePill();
  }

  renderPanels() {
    const host = document.getElementById('panels');
    if (!host) return;
    host.innerHTML = '';
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t.dataset.tab === this.tab);
    const lock = this.activeModule?.lock || {};
    const locked = (name) => (lock.controls || []).includes(name);
    this.plan.setLocked(lock.plan);
    this.plan.setHint(this.activeModule?.hint || null);

    const root = el('div');
    root.refreshers = [];
    const add = (c) => { if (c) { root.append(c); root.refreshers.push(c); } };

    if (this.tab === 'camera') this.buildCameraTab(add, locked);
    else if (this.tab === 'lights') this.buildLightsTab(add, locked);
    else this.buildLensTab(add, locked);

    root.refresh = () => root.refreshers.forEach((c) => c.refresh?.());
    this.panelRoot = root;
    host.append(root);
    this.refreshReadouts();
    this.plan.draw();
  }

  markDirty() { this.dirty = true; this.refreshReadouts(); this.panelRoot?.refresh(); this.plan.draw(); this.updateCoach(); }

  buildCameraTab(add, locked) {
    const s = this.state;
    add(panel('Exposure', [
      ladderControl({
        label: 'Aperture', values: APERTURE_STOPS, format: formatAperture,
        get: () => s.aperture, set: (v) => { if (!locked('aperture')) { s.aperture = v; this.markDirty(); } },
        sub: (v) => v > 16.5 ? 'diffraction' : (v <= 4 ? 'thin depth of field' : 'architecture range')
      }),
      ladderControl({
        label: 'Shutter', values: SHUTTER_STOPS, format: formatShutter,
        get: () => s.shutter, set: (v) => { if (!locked('shutter')) { s.shutter = v; this.markDirty(); } },
        sub: (v) => {
          const b = syncBandCoverage(v, s.hss);
          if (b > 0.01) return `${Math.round(b * 100)}% curtained`;
          if (s.hss && v < 1 / 256) return `HSS −${hssLossStops(v).toFixed(1)} stops`;
          return 'ambient only';
        }
      }),
      ladderControl({
        label: 'ISO', values: ISO_STOPS, format: formatISO,
        get: () => s.iso, set: (v) => { if (!locked('iso')) { s.iso = v; this.markDirty(); } },
        sub: (v) => v > 3200 ? 'grain visible' : 'clean'
      })
    ]));

    add(panel('White balance', [
      sliderControl({
        label: 'Temperature', min: 2500, max: 10000, step: 50,
        format: (v) => s.whiteBalanceAuto ? 'auto' : `${Math.round(v / 10) * 10}K`,
        get: () => s.whiteBalance,
        set: (v) => { if (!locked('wb')) { s.whiteBalance = v; s.whiteBalanceAuto = false; this.markDirty(); } },
        sub: () => this.engine.autoWB && s.whiteBalanceAuto ? `est ${Math.round(this.engine.autoWB)}K` : ''
      }),
      (() => {
        const row = el('div', 'toggle-row');
        const a = toggle({ label: 'Auto WB', get: () => s.whiteBalanceAuto, set: (v) => { s.whiteBalanceAuto = v; this.markDirty(); } });
        const z = toggle({ label: 'Zebras', get: () => s.zebras, set: (v) => { s.zebras = v; this.markDirty(); } });
        row.append(a, z);
        row.refresh = () => { a.refresh(); z.refresh(); };
        return row;
      })()
    ]));

    add(panel('Position', [
      sliderControl({
        label: 'Camera height', min: 0.76, max: 1.78, step: 0.01,
        format: (v) => `${Math.round(v * 39.37)}in`,
        get: () => s.camHeight, set: (v) => { if (!locked('height')) { s.camHeight = v; this.markDirty(); } },
        sub: (v) => v > 1.55 ? 'high, reads like a snapshot' : (v < 1.0 ? 'low and grand' : 'chest height')
      }),
      sliderControl({
        label: 'Tilt', min: -8, max: 8, step: 0.25,
        format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}°`,
        get: () => s.tilt, set: (v) => { if (!locked('tilt')) { s.tilt = v; this.markDirty(); } },
        sub: (v) => Math.abs(v) < 0.3 ? 'verticals parallel' : 'keystoning'
      }),
      (() => {
        const b = el('button', 'ctl-toggle on');
        b.textContent = 'Level the camera';
        b.onclick = () => { s.tilt = 0; this.markDirty(); };
        b.refresh = () => {};
        return b;
      })(),
      noteFor(this.scene)
    ]));
  }

  buildLightsTab(add, locked) {
    const s = this.state;
    const tabs = el('div', 'light-tabs');
    for (const l of s.lights) {
      const b = el('button', `light-tab ${s.selected === l.id ? 'on' : ''} ${l.enabled ? '' : 'off'}`, l.id);
      b.onclick = () => { s.selected = l.id; this.renderPanels(); };
      tabs.append(b);
    }
    if (s.lights.length < MAX_LIGHTS && !this.constraint?.maxLights) {
      const b = el('button', 'light-tab add', '+');
      b.setAttribute('aria-label', 'Add a light');
      b.onclick = () => { addLight(s); this.renderPanels(); this.markDirty(); };
      tabs.append(b);
    }
    tabs.refresh = () => {};
    add(tabs);

    const l = selectedLight(s);
    if (!l) {
      add(noteEl('No lights placed. Add one with the plus button, then drag it on the plan.'));
      return;
    }
    const ownedHeads = () => Object.values(HEADS)
      .filter((h) => h.owned || this.progress.ownedHeads.includes(h.id))
      .map((h) => ({ value: h.id, label: h.label }));
    const ownedMods = () => Object.values(MODIFIERS)
      .filter((m) => m.owned || this.progress.ownedModifiers.includes(m.id))
      .filter((m) => !this.constraint?.noModifiers || m.id === 'none')
      .map((m) => ({ value: m.id, label: m.label }));

    add(panel('Head', [
      toggle({ label: l.enabled ? 'Firing' : 'Switched off', get: () => l.enabled, set: (v) => { l.enabled = v; this.markDirty(); } }),
      dropdown({
        label: 'Unit', options: ownedHeads, get: () => l.headId,
        set: (v) => { if (!locked('head')) { l.headId = v; this.markDirty(); } },
        sub: (v) => `GN ${HEADS[v].guideNumber}m · ${HEADS[v].watts}Ws`
      }),
      ladderControl({
        label: 'Power', accent: 'cyan', values: POWER_SETTINGS.map((p) => 1 / p),
        format: (v) => `1/${Math.round(1 / v)}`,
        get: () => 1 / l.power,
        set: (v) => { if (!locked('power')) { l.power = Math.round(1 / v); this.markDirty(); } },
        sub: () => {
          const r = (this.engine.lastResolved || []).find((x) => x.id === l.id) ||
            this.engine.resolveLights(s).find((x) => x.id === l.id);
          if (!r) return '';
          const d = Math.hypot(l.x - s.camX, l.z - s.camZ) + 1.2;
          return `${meterFlash(r, d, s.aperture, s.iso).toFixed(1)} stops at ${d.toFixed(1)}m`;
        }
      })
    ]));

    add(panel('Direction', [
      segmented({
        label: 'Mode', accent: 'cyan',
        options: [
          { value: 'direct', label: 'Direct' },
          { value: 'ceiling', label: 'Ceiling', disabled: () => !!this.constraint?.noBounce },
          { value: 'wall', label: 'Wall', disabled: () => !!this.constraint?.noBounce }
        ],
        get: () => l.mode, set: (v) => { if (!locked('mode')) { l.mode = v; this.markDirty(); } },
        sub: (v) => v === 'direct' ? 'hard, full output' :
          (v === 'ceiling' ? `bounce off the ${this.scene.room.ceiling.toFixed(2)}m ceiling` : 'bounce off a wall')
      }),
      sliderControl({
        label: 'Height', accent: 'cyan', min: 0.4, max: Math.min(2.6, this.scene.room.ceiling - 0.15), step: 0.05,
        format: (v) => `${v.toFixed(2)}m`,
        get: () => l.height,
        set: (v) => { if (!locked('height')) { l.height = v; this.markDirty(); } },
        sub: () => l.mode === 'ceiling'
          ? `${(this.scene.room.ceiling - l.height).toFixed(2)}m to the ceiling · softer the further away`
          : ''
      }),
      sliderControl({
        label: 'Aim', accent: 'cyan', min: -180, max: 180, step: 1,
        format: (v) => `${Math.round(v)}°`,
        get: () => l.yaw, set: (v) => { l.yaw = v; this.markDirty(); },
        sub: () => l.mode === 'ceiling' ? 'not used when bouncing up' : 'or drag the handle on the plan'
      }),
      sliderControl({
        label: 'Tilt', accent: 'cyan', min: -60, max: 75, step: 1,
        format: (v) => Math.abs(v) < 1 ? 'level' : `${v > 0 ? '+' : ''}${Math.round(v)}°`,
        get: () => l.tilt || 0,
        set: (v) => { if (!locked('tilt')) { l.tilt = v; this.markDirty(); } },
        sub: (v) => {
          if (l.mode !== 'direct') return 'not used when bouncing';
          const t = (Math.abs(v) * Math.PI) / 180;
          if (v < -1) {
            const d = l.height / Math.tan(t);
            return d > 15 ? 'nearly level, aimed slightly down' : `beam centre lands ${d.toFixed(1)}m out`;
          }
          if (v > 1) {
            const d = (this.scene.room.ceiling - l.height) / Math.tan(t);
            return d > 15 ? 'nearly level, aimed slightly up' : `meets the ceiling ${d.toFixed(1)}m out - feathering up`;
          }
          return 'level, straight across the room';
        }
      })
    ]));

    add(panel('Modifier and gel', [
      dropdown({
        label: 'Modifier', options: ownedMods, get: () => l.modifierId,
        set: (v) => { if (!locked('modifier')) { l.modifierId = v; this.markDirty(); } },
        sub: (v) => MODIFIERS[v].lossStops ? `−${MODIFIERS[v].lossStops.toFixed(1)} stops` : 'no loss'
      }),
      segmented({
        label: 'Gel', accent: 'cyan',
        options: Object.values(GELS).map((g) => ({ value: g.id, label: g.label })),
        get: () => l.gelId, set: (v) => { if (!locked('gel')) { l.gelId = v; this.markDirty(); } },
        sub: (v) => GELS[v].miredShift ? `to ${Math.round(1e6 / (1e6 / 5500 + GELS[v].miredShift))}K · −${GELS[v].lossStops} stops` : 'flash is 5500K'
      }),
      this.lossBreakdown(l),
      s.lights.length > 1 ? (() => {
        const b = el('button', 'ctl-toggle');
        b.textContent = `Remove ${l.id}`;
        b.onclick = () => { removeLight(s, l.id); this.renderPanels(); this.markDirty(); };
        b.refresh = () => {};
        return b;
      })() : null
    ]));
  }

  lossBreakdown(light) {
    const box = el('div', 'note cyan');
    box.refresh = () => {
      const r = this.engine.resolveLights(this.state).find((x) => x.id === light.id);
      if (!r) { box.textContent = 'Switched off.'; return; }
      box.innerHTML = '';
      const rows = [
        ['Modifier', r.losses.modifier], ['Gel', r.losses.gel],
        ['Bounce', r.losses.bounce], ['High speed sync', r.losses.hss]
      ].filter(([, v]) => v > 0.001);
      if (!rows.length) box.append(el('div', 'cost', 'Bare head at full efficiency.'));
      for (const [k, v] of rows) {
        const row = el('div', 'cost');
        row.append(el('span', null, k), el('b', null, `−${v.toFixed(1)} stops`));
        box.append(row);
      }
      const t = el('div', 'cost total');
      t.append(el('span', null, 'Total loss'), el('b', null, `−${r.losses.total.toFixed(1)} stops`));
      box.append(t);
      const s2 = el('div', 'cost');
      s2.append(el('span', null, 'Source size'), el('b', null, `${(r.sourceDiameter * 100).toFixed(0)}cm`));
      box.append(s2);
    };
    box.refresh();
    return box;
  }

  buildLensTab(add, locked) {
    const s = this.state;
    const lens = lensById(s.lensId);
    const available = () => Object.values(LENSES)
      .filter((l) => l.owned || this.progress.unlockedLenses.includes(l.id))
      .map((l) => ({ value: l.id, label: l.label }));

    add(panel('Lens', [
      dropdown({
        label: 'Body and lens', options: available, get: () => s.lensId,
        set: (v) => {
          if (locked('lens')) return;
          s.lensId = v;
          const L = lensById(v);
          s.focal = Math.max(L.min, Math.min(L.max, s.focal));
          if (!L.tiltShift) { s.shiftX = 0; s.shiftY = 0; }
          this.renderPanels(); this.markDirty();
        },
        sub: (v) => LENSES[v].sensor === 'apsc' ? '1.5× crop body' : 'full frame'
      }),
      lens.min === lens.max ? null : sliderControl({
        label: 'Focal length', min: lens.min, max: lens.max, step: 1,
        format: (v) => `${Math.round(v)}mm`,
        get: () => s.focal, set: (v) => { if (!locked('focal')) { s.focal = v; this.markDirty(); } },
        sub: (v) => {
          const eq = Math.round(v * (lens.sensor === 'apsc' ? SENSOR_APSC.crop : 1));
          if (eq < 20) return `${eq}mm eq · reads like a listing`;
          if (eq <= 35) return `${eq}mm eq · the architecture range`;
          return `${eq}mm eq · a detail, not a room`;
        }
      }),
      focalNote(s, lens)
    ]));

    if (lens.tiltShift) {
      add(panel('Shift', [
        sliderControl({
          label: 'Rise and fall', min: -12, max: 12, step: 0.5,
          format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}mm`,
          get: () => s.shiftY, set: (v) => { s.shiftY = v; this.markDirty(); },
          sub: (v) => v > 0 ? 'more ceiling, verticals kept' : (v < 0 ? 'more floor, verticals kept' : 'centred')
        }),
        sliderControl({
          label: 'Lateral shift', min: -12, max: 12, step: 0.5,
          format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}mm`,
          get: () => s.shiftX, set: (v) => { s.shiftX = v; this.markDirty(); },
          sub: () => 'stand off axis, keep the frame centred'
        }),
        shiftNote(s),
        (() => {
          const b = el('button', 'ctl-toggle');
          b.textContent = 'Shift panorama (3 frames)';
          b.onclick = () => this.shiftPanorama();
          b.refresh = () => {};
          return b;
        })()
      ]));
    }
  }

  /* ---------------- shift panorama ---------------- */

  async shiftPanorama() {
    if (this.busy) return;
    const s = this.state;
    const save = s.shiftX;
    const shots = [];
    const prog = document.getElementById('progress');
    const text = document.getElementById('prog-text');
    prog.classList.add('on');
    this.busy = true;
    try {
      const scale = this.captureScale();
      this.engine.setSize(Math.round(this.cssSize.w * scale), Math.round(this.cssSize.h * scale));
      const passes = Math.max(8, Math.round(this.passCount() / 2));
      const shifts = [-9, 0, 9];
      for (const [i, sx] of shifts.entries()) {
        text.textContent = `FRAME ${i + 1} OF 3 · SHIFT ${sx > 0 ? '+' : ''}${sx}mm`;
        s.shiftX = sx;
        await this.engine.capture(s, ASPECT, passes, (p) => {
          document.getElementById('prog-fill').style.width = `${Math.round(((i + p) / 3) * 100)}%`;
        });
        shots.push(this.engine.grabImage());
      }
      text.textContent = 'STITCHING';
      this.showPanorama(shots, shifts);
    } finally {
      s.shiftX = save;
      prog.classList.remove('on');
      this.busy = false;
      this.markDirty();
    }
  }

  showPanorama(shots, shifts) {
    const w = shots[0].width, h = shots[0].height;
    const lens = lensById(this.state.lensId);
    const sensorW = lens?.sensor === 'apsc' ? SENSOR_APSC.w : SENSOR_FULL_FRAME.w;

    // The offset is not a guess. Shifting the lens by s millimetres slides the
    // image across the sensor by exactly s millimetres, so consecutive frames
    // are displaced by s / sensorWidth of the frame. That geometric certainty
    // is the whole reason a shift panorama stitches without distortion.
    const pxPerMm = w / sensorW;
    const offsets = shifts.map((s) => Math.round((s - shifts[0]) * pxPerMm));
    const total = Math.max(...offsets) + w;

    const out = document.createElement('canvas');
    out.width = total;
    out.height = h;
    const c = out.getContext('2d');
    shots.forEach((img, i) => c.drawImage(img, offsets[i], 0));

    const panelEl = document.getElementById('result');
    document.getElementById('score-big').textContent = '⟷';
    document.getElementById('score-verdict').textContent =
      `Three frames at ${shifts[0]}, ${shifts[1]} and +${shifts[2]}mm of lateral shift. ` +
      `${Math.round((total / w) * 100)}% of the original field of view, and not one converging vertical, ` +
      `because the sensor never moved relative to the wall.`;
    const body = document.getElementById('result-body');
    body.innerHTML = '';
    out.style.width = '100%';
    out.style.borderRadius = '6px';
    out.style.border = '1px solid rgba(255,255,255,.14)';
    body.append(out);
    const note = el('p', null,
      `A ${Math.abs(shifts[0])}mm shift on a ${sensorW}mm sensor moves the frame by exactly ` +
      `${Math.round((Math.abs(shifts[0]) / sensorW) * 100)}% of its width, so the frames overlap by the rest. ` +
      'Getting the same coverage with a wider lens would have cost you the straight lines.');
    note.style.cssText = 'font-size:12.5px;line-height:1.6;color:var(--muted);margin-top:12px';
    body.append(note);
    const actions = el('div', 'result-actions');
    const back = el('button', 'btn primary', 'Back');
    back.onclick = () => panelEl.classList.remove('on');
    actions.append(back);
    body.append(actions);
    panelEl.classList.add('on');
  }

  /* ---------------- inspect ---------------- */

  /**
   * Orbit the room with the flash lighting held exactly as it was captured.
   * Useful for the thing a photograph cannot show you: where the light
   * actually landed, and what the far side of the sofa is doing.
   */
  toggleInspect() {
    this.inspect = this.inspect ? null : {
      yaw: this.state.camYaw, pitch: -12, dist: 5.2,
      tx: 0, ty: 1.35, tz: 0
    };
    document.getElementById('btn-inspect').classList.toggle('on', !!this.inspect);
    const badge = document.getElementById('stale-badge');
    if (this.inspect) {
      this.bindInspectDrag();
      badge.textContent = 'INSPECT · DRAG TO ORBIT';
      badge.classList.remove('live');
      this.renderInspect();
    } else {
      badge.textContent = 'LIVE · AMBIENT ONLY';
      this.dirty = true;
    }
  }

  bindInspectDrag() {
    if (this.inspectBound) return;
    this.inspectBound = true;
    const box = document.getElementById('frame-box');
    box.style.touchAction = 'none';
    let drag = null;
    box.addEventListener('pointerdown', (e) => {
      if (!this.inspect) return;
      drag = { x: e.clientX, y: e.clientY, yaw: this.inspect.yaw, pitch: this.inspect.pitch };
      box.setPointerCapture(e.pointerId);
    });
    box.addEventListener('pointermove', (e) => {
      if (!drag || !this.inspect) return;
      this.inspect.yaw = drag.yaw - (e.clientX - drag.x) * 0.35;
      this.inspect.pitch = Math.max(-80, Math.min(70, drag.pitch + (e.clientY - drag.y) * 0.3));
      this.renderInspect();
      e.preventDefault();
    });
    const end = (e) => {
      drag = null;
      try { box.releasePointerCapture(e.pointerId); } catch { /* gone */ }
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    box.addEventListener('wheel', (e) => {
      if (!this.inspect) return;
      this.inspect.dist = Math.max(1.2, Math.min(14, this.inspect.dist * (1 + e.deltaY * 0.0016)));
      this.renderInspect();
      e.preventDefault();
    }, { passive: false });
  }

  async renderInspect() {
    if (!this.inspect || this.busy) return;
    this.busy = true;
    try {
      const i = this.inspect;
      const yaw = (i.yaw * Math.PI) / 180;
      const pitch = (i.pitch * Math.PI) / 180;
      const horiz = Math.cos(pitch) * i.dist;
      const view = {
        ...this.state,
        camX: i.tx - Math.sin(yaw) * horiz,
        camZ: i.tz - Math.cos(yaw) * horiz,
        camHeight: Math.max(0.15, i.ty - Math.sin(pitch) * i.dist),
        camYaw: i.yaw,
        tilt: -i.pitch,
        shiftX: 0, shiftY: 0,
        lensId: 'wide_zoom', focal: 20,
        zebras: false
      };
      const scale = Math.min(0.7, this.previewScale() * 1.3);
      this.engine.setSize(
        Math.round(this.cssSize.w * scale), Math.round(this.cssSize.h * scale)
      );
      await this.engine.capture(view, ASPECT, 6, () => {});
    } finally {
      this.busy = false;
    }
  }

  /* ---------------- scene thumbnails ---------------- */

  /**
   * A small ambient render of each room, generated once and cached. The
   * exposure is chosen per scene so the thumbnail reads as an invitation
   * rather than as a correctly metered (and therefore often dark) frame.
   */
  sceneThumb(sceneId, onReady) {
    this.thumbCache = this.thumbCache || new Map();
    if (this.thumbCache.has(sceneId)) return this.thumbCache.get(sceneId);
    try {
      if (!this.thumbEngine) {
        this.thumbEngine = new Engine(document.createElement('canvas'));
      }
      const scene = sceneById(sceneId);
      const compiled = this.compiledFor(scene);
      this.thumbEngine.loadScene(compiled);
      this.thumbEngine.setSize(252, 168);
      const st = defaultState(scene);
      st.lights = [];
      const brightest = Math.max(0, ...(scene.windows || []).map((w) => w.ev));
      if (brightest >= 13.5) { st.shutter = 1 / 45; st.iso = 200; }
      else if (brightest >= 10) { st.shutter = 1 / 10; st.iso = 400; }
      else { st.shutter = 1 / 3; st.iso = 800; }
      this.thumbEngine.renderPreview(st, 1.5);
      const url = this.thumbEngine.canvas.toDataURL('image/jpeg', 0.78);
      this.thumbCache.set(sceneId, url);
      onReady?.(url);
      return url;
    } catch { return null; }
  }

  /* ---------------- modules ---------------- */

  renderModuleList() {
    const host = document.getElementById('learn-panel');
    host.innerHTML = '';
    const h = el('div');
    h.style.cssText = 'max-width:640px;margin:0 auto;padding:8px 4px 30px';
    h.append(el('h2', null, 'Learning Center'));
    const lede = el('p');
    lede.style.cssText = 'color:var(--muted);font-size:13px;line-height:1.6;margin:0 0 18px';
    lede.textContent = 'Eleven modules in order. Each one locks off everything except the thing it is teaching, then checks the frame you actually made.';
    h.append(lede);

    let nextFound = false;
    for (const m of MODULES) {
      const unlocked = isUnlocked(m, this.progress);
      const done = this.progress.completedModules.includes(m.id);
      const isNext = unlocked && !done && !nextFound;
      if (isNext) nextFound = true;
      const card = el('button',
        `module-card ${unlocked ? '' : 'locked'} ${done ? 'done' : ''} ${isNext ? 'next' : ''}`);
      card.append(el('div', 'module-num', done ? '✓' : (unlocked ? String(m.n).padStart(2, '0') : '·')));
      const thumb = el('div', 'module-thumb');
      const url = this.sceneThumb(m.sceneId, (u) => { thumb.style.backgroundImage = `url(${u})`; });
      if (url) thumb.style.backgroundImage = `url(${url})`;
      card.append(thumb);
      const t = el('div', 'module-text');
      t.append(el('div', 'module-title', m.title));
      t.append(el('div', 'module-desc', m.blurb));
      card.append(t);
      if (isNext) card.append(el('span', 'start-pill', done ? 'REPLAY' : (m.n === 1 ? 'START' : 'NEXT')));
      card.disabled = !unlocked;
      card.onclick = () => this.startModule(m.id);
      h.append(card);
    }
    host.append(h);
  }

  startModule(id) {
    const m = moduleById(id);
    this.activeModule = m;
    this.goalState = {};
    this.history = [];
    this.constraint = null;
    this.setScene(m.sceneId);
    m.setup(this.state);
    this.state.selected = this.state.lights[0]?.id || 'camera';
        if (m.unlocks) {
      for (const u of m.unlocks) {
        if (!this.progress.unlockedLenses.includes(u)) this.progress.unlockedLenses.push(u);
      }
      saveProgress(this.progress);
    }
    this.setMode('learn');
    document.getElementById('learn-panel').classList.add('hidden');
    document.getElementById('viewer').classList.remove('hidden');
    document.getElementById('side').classList.remove('hidden');
    this.tab = 'camera';
    this.renderPanels();
    this.layout();
    this.showIntro(m);
    this.markDirty();
  }

  showIntro(m) {
    const panelEl = document.getElementById('result');
    document.getElementById('score-big').textContent = String(m.n).padStart(2, '0');
    document.getElementById('score-verdict').textContent = m.title;
    const body = document.getElementById('result-body');
    body.innerHTML = '';
    for (const p of m.intro) {
      const n = el('p', null, p);
      n.style.cssText = 'font-size:13.5px;line-height:1.7;color:var(--muted);margin:0 0 13px';
      body.append(n);
    }
    const gl = el('div');
    gl.style.cssText = 'margin-top:16px;border-top:1px solid var(--line);padding-top:14px';
    gl.append(el('div', 'panel-title', 'What you have to do'));
    for (const g of m.goals) {
      const row = el('div', 'crit-detail');
      row.style.paddingLeft = '0';
      row.textContent = `· ${g.text}`;
      gl.append(row);
    }
    body.append(gl);
    const actions = el('div', 'result-actions');
    const go = el('button', 'btn primary', 'Start');
    go.onclick = () => { panelEl.classList.remove('on'); this.updateCoach(); };
    const back = el('button', 'btn', 'Back to the list');
    back.onclick = () => { panelEl.classList.remove('on'); this.exitModule(); };
    actions.append(go, back);
    body.append(actions);
    panelEl.classList.add('on');
  }

  exitModule() {
    this.activeModule = null;
    this.goalState = {};
    document.getElementById('coach').classList.remove('on');
    this.setMode('learn');
  }

  evaluateModule() {
    const m = this.activeModule;
    const ctx = { state: this.state, result: this.lastResult, history: this.history };
    let newly = null;
    for (const g of m.goals) {
      if (this.goalState[g.id]) continue;
      let pass = false;
      try { pass = !!g.test(ctx); } catch { pass = false; }
      if (pass) { this.goalState[g.id] = true; newly = g; }
    }
    const done = m.goals.every((g) => this.goalState[g.id]);
    this.updatePill();
    if (done) this.completeModule(m);
    else {
      this.updateCoach(newly);
      this.showResult(this.lastResult);
    }
  }

  completeModule(m) {
    if (!this.progress.completedModules.includes(m.id)) {
      this.progress.completedModules.push(m.id);
      this.progress.currency += m.reward;
      saveProgress(this.progress);
    }
    const panelEl = document.getElementById('result');
    document.getElementById('score-big').textContent = '✓';
    document.getElementById('score-verdict').textContent = `Module ${m.n} complete · ${m.title}`;
    const body = document.getElementById('result-body');
    body.innerHTML = '';
    const p = el('p', null, `Every goal met. ${m.reward} credits added, which you can spend on the Gear tab.`);
    p.style.cssText = 'font-size:13.5px;line-height:1.7;color:var(--muted)';
    body.append(p);
    if (this.lastResult) {
      for (const c of this.lastResult.criteria.filter((x) => x.verdict !== 'ok' && !x.notApplicable)) {
        const row = el('div', 'crit');
        const head = el('div', 'crit-head');
        head.append(el('span', `crit-dot ${c.verdict}`), el('span', 'crit-name', c.label));
        row.append(head, el('div', 'crit-detail', c.detail));
        body.append(row);
      }
    }
    const actions = el('div', 'result-actions');
    const next = MODULES.find((x) => x.n === m.n + 1);
    if (next) {
      const b = el('button', 'btn primary', `Next: ${next.title}`);
      b.onclick = () => { panelEl.classList.remove('on'); this.startModule(next.id); };
      actions.append(b);
    }
    const back = el('button', 'btn', 'Back to the list');
    back.onclick = () => { panelEl.classList.remove('on'); this.exitModule(); };
    actions.append(back);
    body.append(actions);
    panelEl.classList.add('on');
  }

  updateCoach(newlyMet) {
    const box = document.getElementById('coach');
    const m = this.activeModule;
    if (!m || m.noCoach) { box.classList.remove('on'); return; }
    let text = null;
    try {
      text = m.coach?.({ state: this.state, lastResult: this.lastResult, history: this.history });
    } catch { text = null; }
    const next = m.goals.find((g) => !this.goalState[g.id]);
    document.getElementById('coach-title').textContent =
      newlyMet ? 'Goal met' : (next ? `Goal ${m.goals.indexOf(next) + 1} of ${m.goals.length}` : 'Coach');
    document.getElementById('coach-body').textContent =
      newlyMet ? `${newlyMet.text}. ${text || ''}` : `${next ? next.text + '. ' : ''}${text || ''}`;
    box.classList.add('on');
  }

  /* ---------------- practice, daily, gear ---------------- */

  renderPracticeMenu() {
    const host = document.getElementById('learn-panel');
    host.classList.remove('hidden');
    document.getElementById('viewer').classList.add('hidden');
    document.getElementById('side').classList.add('hidden');
    host.innerHTML = '';
    const h = el('div');
    h.style.cssText = 'max-width:640px;margin:0 auto;padding:8px 4px 30px';
    h.append(el('h2', null, 'Shoot'));
    const lede = el('p');
    lede.style.cssText = 'color:var(--muted);font-size:13px;line-height:1.6;margin:0 0 18px';
    lede.textContent = 'No hints, no suggested ranges. Pick a room, light it, and see the diagnosis only after you have committed.';
    h.append(lede);

    h.append(el('div', 'panel-title', 'Rooms'));
    for (const s of SCENES) {
      const best = this.progress.bestScores[s.id];
      const card = el('button', 'module-card');
      card.append(el('div', 'module-num', best ? String(best) : '–'));
      const thumb = el('div', 'module-thumb');
      const url = this.sceneThumb(s.id, (u) => { thumb.style.backgroundImage = `url(${u})`; });
      if (url) thumb.style.backgroundImage = `url(${url})`;
      card.append(thumb);
      const t = el('div', 'module-text');
      t.append(el('div', 'module-title', `${s.name} · ${s.subtitle}`));
      t.append(el('div', 'module-desc', s.brief));
      card.append(t);
      card.onclick = () => this.startPractice(s.id, null);
      h.append(card);
    }

    h.append(el('div', 'panel-title', 'Constraint runs'));
    for (const c of CONSTRAINTS) {
      const card = el('button', 'module-card');
      card.append(el('div', 'module-num', '◇'));
      const t = el('div');
      t.append(el('div', 'module-title', c.label));
      t.append(el('div', 'module-desc', c.desc));
      card.append(t);
      card.onclick = () => this.startPractice(this.scene.id, c);
      h.append(card);
    }

    h.append(el('div', 'panel-title', 'Match the hero'));
    for (const [sceneId, hero] of Object.entries(HERO_SETUPS)) {
      const sc = sceneById(sceneId);
      const card = el('button', 'module-card');
      card.append(el('div', 'module-num', '◎'));
      const t = el('div');
      t.append(el('div', 'module-title', `${sc.name} · ${hero.label}`));
      t.append(el('div', 'module-desc', hero.desc));
      card.append(t);
      card.onclick = () => this.startHero(sceneId);
      h.append(card);
    }
    host.append(h);
  }

  startPractice(sceneId, constraint) {
    this.activeModule = null;
    this.constraint = constraint;
    this.hero = null;
    this.setScene(sceneId);
    if (constraint?.apply) constraint.apply(this.state);
    document.getElementById('learn-panel').classList.add('hidden');
    document.getElementById('viewer').classList.remove('hidden');
    document.getElementById('side').classList.remove('hidden');
    document.getElementById('coach').classList.remove('on');
    this.tab = 'camera';
    this.renderPanels();
    this.layout();
    this.markDirty();
  }

  async startHero(sceneId) {
    const hero = HERO_SETUPS[sceneId];
    this.startPractice(sceneId, null);
    this.busy = true;
    const prog = document.getElementById('progress');
    prog.classList.add('on');
    document.getElementById('prog-text').textContent = 'RENDERING THE TARGET';
    try {
      const target = defaultState(this.scene);
      hero.setup(target);
      const scale = this.captureScale();
      this.engine.setSize(Math.round(this.cssSize.w * scale), Math.round(this.cssSize.h * scale));
      await this.engine.capture(target, ASPECT, this.passCount(), () => {});
      this.hero = {
        image: this.engine.grabImage(), frame: this.engine.readback(),
        label: hero.label, desc: hero.desc
      };
      const wrap = document.getElementById('frame-wrap');
      let strip = document.getElementById('hero-strip');
      if (!strip) {
        strip = el('div');
        strip.id = 'hero-strip';
        strip.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);width:34%;border:1px solid var(--amber-dim);border-radius:4px;overflow:hidden;pointer-events:none;z-index:5';
        wrap.append(strip);
      }
      strip.innerHTML = '';
      this.hero.image.style.width = '100%';
      this.hero.image.style.display = 'block';
      strip.append(this.hero.image);
      const cap = el('div', null, 'TARGET');
      cap.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(8,9,11,.8);color:var(--amber);font:600 9px ui-monospace,monospace;letter-spacing:.14em;text-align:center;padding:3px';
      strip.append(cap);
      this.state = defaultState(this.scene);
      this.plan.setState(this.state);
    } finally {
      prog.classList.remove('on');
      this.busy = false;
      this.markDirty();
    }
  }

  startDaily() {
    const daily = buildDaily(new Date());
    this.dailySpec = daily;
    this.activeModule = null;
    this.hero = null;
    this.constraint = daily.constraint;
    this.setScene(daily.scene);
    daily.setup(this.state);
    document.getElementById('learn-panel').classList.add('hidden');
    document.getElementById('viewer').classList.remove('hidden');
    document.getElementById('side').classList.remove('hidden');
    this.tab = 'camera';
    this.renderPanels();
    this.layout();
    const box = document.getElementById('coach');
    document.getElementById('coach-title').textContent = `Daily · ${daily.dateLabel}`;
    document.getElementById('coach-body').textContent = daily.brief;
    box.classList.add('on');
    this.markDirty();
  }

  logDaily(total) {
    const today = new Date().toISOString().slice(0, 10);
    if (this.progress.lastDailyDate === today) return;
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    this.progress.streak = this.progress.lastDailyDate === y ? this.progress.streak + 1 : 1;
    this.progress.lastDailyDate = today;
    this.progress.dailyHistory.push({ date: today, score: total });
    if (this.progress.dailyHistory.length > 120) this.progress.dailyHistory.shift();
    this.progress.currency += Math.round(total / 2);
    saveProgress(this.progress);
    this.updatePill();
  }

  renderGear() {
    const host = document.getElementById('learn-panel');
    host.innerHTML = '';
    const h = el('div');
    h.style.cssText = 'max-width:640px;margin:0 auto;padding:8px 4px 30px';
    h.append(el('h2', null, 'Gear'));
    const bal = el('p');
    bal.style.cssText = 'color:var(--amber);font-family:var(--mono);font-size:13px;margin:0 0 16px';
    bal.textContent = `${this.progress.currency} credits`;
    h.append(bal);

    const buy = (item, kind) => {
      const owned = kind === 'head'
        ? this.progress.ownedHeads.includes(item.id)
        : this.progress.ownedModifiers.includes(item.id);
      const card = el('button', `module-card ${owned ? 'done' : ''}`);
      card.append(el('div', 'module-num', owned ? '✓' : `${item.price}`));
      const t = el('div');
      t.append(el('div', 'module-title', item.label));
      t.append(el('div', 'module-desc', item.note ||
        `Guide number ${item.guideNumber}m at ISO 100, ${item.watts}Ws.`));
      card.append(t);
      card.disabled = owned || this.progress.currency < item.price;
      card.onclick = () => {
        this.progress.currency -= item.price;
        (kind === 'head' ? this.progress.ownedHeads : this.progress.ownedModifiers).push(item.id);
        saveProgress(this.progress);
        this.renderGear();
      };
      return card;
    };

    h.append(el('div', 'panel-title', 'Owned'));
    for (const id of ['ad200_fresnel', 'ad200_bare', 'v1']) {
      const item = HEADS[id];
      const card = el('button', 'module-card done');
      card.disabled = true;
      card.append(el('div', 'module-num', '✓'));
      const t = el('div');
      t.append(el('div', 'module-title', item.label));
      t.append(el('div', 'module-desc', `Guide number ${item.guideNumber}m at ISO 100, ${item.watts}Ws.`));
      card.append(t);
      h.append(card);
    }
    h.append(el('div', 'panel-title', 'Heads'));
    for (const item of Object.values(HEADS).filter((x) => !x.owned)) h.append(buy(item, 'head'));
    h.append(el('div', 'panel-title', 'Modifiers'));
    for (const item of Object.values(MODIFIERS).filter((x) => !x.owned)) h.append(buy(item, 'mod'));
    host.append(h);
  }
}

/* ---------------- small helpers ---------------- */

function noteEl(text, cls = '') {
  const n = el('div', `note ${cls}`, text);
  n.refresh = () => {};
  return n;
}

function noteFor(scene) {
  return noteEl(scene.brief);
}

function focalNote(state, lens) {
  const n = el('div', 'note');
  n.refresh = () => {
    const eq = Math.round(state.focal * (lens.sensor === 'apsc' ? SENSOR_APSC.crop : 1));
    n.textContent = eq < 20
      ? 'Everything is in frame at this focal length, which means everything has to be lit and there is nowhere to put a stand.'
      : (eq <= 35
        ? 'This is the range high end interiors live in. Calm, close to how the room feels standing in it.'
        : 'Tight enough to be a detail rather than a room. You only have to light the slice you can see.');
  };
  n.refresh();
  return n;
}

function shiftNote(state) {
  const n = el('div', 'note amber');
  n.refresh = () => {
    const mag = Math.hypot(state.shiftX, state.shiftY);
    n.textContent = mag > 10
      ? `${mag.toFixed(1)}mm of shift is outside the image circle. The corners are going dark and soft, and that is a real limit of the lens rather than a rule of the game.`
      : (mag > 0.4
        ? `${mag.toFixed(1)}mm of shift. Verticals stay parallel because the sensor never tilted, and it is costing you about ${(0.02 * mag).toFixed(2)} of a stop in the corners.`
        : 'Shift moves the lens across a sensor that stays parallel to the wall. Tilting the camera does not.');
  };
  n.refresh();
  return n;
}

function verdictFor(total) {
  if (total >= 88) return 'Publishable. An art director would run this.';
  if (total >= 76) return 'Strong. A couple of things a retoucher would grumble about.';
  if (total >= 62) return 'Usable, but the problems are visible at full size.';
  if (total >= 45) return 'The idea is there. The execution is giving it away.';
  return 'This is the frame that teaches you something. Read the diagnosis.';
}

const app = new App();
window.keylight = app;
app.boot();
