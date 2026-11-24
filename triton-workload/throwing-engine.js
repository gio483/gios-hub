/* Triton Throwing Workload — Calculation Engine
   ------------------------------------------------------------------
   Implements "Personalized Throwing Workload Calculator — Technical Specification v2.0".
   Deterministic, dependency-free, no DOM, no network: same input → same output.
   Use in a browser (window.TritonThrowing) or Node (require('./throwing-engine.js')).

   Personalized Throwing Workload (PTW) is expressed in Pulse-equivalent units (PEU):
     • Pulse day      → PTW = the official Driveline Pulse One Day Workload (never blended)
     • Rest day       → PTW = 0
     • Missing data   → PTW = null (never treated as zero)
     • Otherwise      → PTW = the individual model's prediction of Pulse workload

   This is a monitoring metric. It does not measure tissue stress, predict injury,
   prescribe throwing or clear an athlete to throw.
*/
(function (root) {
  'use strict';

  const ENGINE_VERSION = '1.0.0';
  const SPEC_VERSION = '2.0';

  /* ---------- vocabularies ---------- */
  const ACTIVITIES = [
    { id: 'recovery-catch', label: 'Recovery catch', group: 'catch' },
    { id: 'catch', label: 'Normal catch', group: 'catch' },
    { id: 'high-intent-catch', label: 'High-intent catch', group: 'catch' },
    { id: 'long-toss', label: 'Long toss', group: 'long-toss' },
    { id: 'flatground', label: 'Flatground', group: 'mound' },
    { id: 'bullpen', label: 'Bullpen', group: 'mound' },
    { id: 'live-bp', label: 'Live batting practice', group: 'mound' },
    { id: 'game', label: 'Game', group: 'mound' },
    { id: 'plyo', label: 'Plyocare / weighted balls', group: 'plyo' },
    { id: 'custom', label: 'Other / custom', group: 'other' },
  ];
  const GROUPS = { catch: 'Catch', 'long-toss': 'Long toss', mound: 'Mound (flatground, pen, live, game)', plyo: 'Weighted-ball work', other: 'Custom' };
  const EFFORTS = [
    { id: 'recovery', label: 'Recovery / very low intent', tier: 'low' },
    { id: 'low', label: 'Low intent', tier: 'low' },
    { id: 'moderate', label: 'Moderate intent', tier: 'mod' },
    { id: 'high', label: 'High intent', tier: 'high' },
    { id: 'max', label: 'Maximum intent', tier: 'high' },
  ];
  // Ball classes by weight (grams). A regulation baseball is 5–5.25 oz (142–149 g).
  const BALL_PRESETS = [
    { g: 142, label: 'Baseball (5 oz)' }, { g: 85, label: '3 oz' }, { g: 113, label: '4 oz' }, { g: 170, label: '6 oz' },
    { g: 198, label: '7 oz' }, { g: 255, label: '9 oz' }, { g: 100, label: 'Plyo 100 g' }, { g: 150, label: 'Plyo 150 g' },
    { g: 225, label: 'Plyo 225 g' }, { g: 450, label: 'Plyo 450 g' }, { g: 1000, label: 'Plyo 1 kg' }, { g: 2000, label: 'Plyo 2 kg' },
  ];
  function ballClass(g) {
    const w = +g || 142;
    if (w < 141) return 'underweight';
    if (w <= 149) return 'baseball';
    if (w <= 454) return 'overweight';
    return 'heavy-implement';
  }
  const LONG_DISTANCE_FT = 120;   // "long" throws for the distance feature (operational bin, not a physiological threshold)

  /* Provisional cold-start weights: relative PEU per throw by effort.
     PLACEHOLDERS that only encode the ordering of effort levels. Not Pulse values,
     not scientific multipliers; the user can inspect and replace them. */
  const PROVISIONAL_WEIGHTS = { recovery: 0.05, low: 0.1, moderate: 0.2, high: 0.35, max: 0.5 };

  /* Model-maturity conventions (operational, not accuracy guarantees). Confidence
     comes from measured out-of-sample error, not from these counts. */
  const STAGES = {
    earlyMin: 1,           // ≥1 paired Pulse+activity day: fit a single scale factor
    developingMin: 4,      // ≥4: cross-validated candidate models
    establishedMin: 15,    // ≥15 paired days AND ≥8 chronological held-out predictions
    establishedHeldOut: 8,
    complexityGain: 0.05,  // a more complex model must cut out-of-sample MAE by ≥5% …
    complexityAbs: 0.01,   // … AND by ≥1% of his average Pulse workload (ignores trivial gains when errors are tiny)
  };
  const ALPHAS = [0.001, 0.01, 0.1, 1];   // ridge strengths tried (× mean Gram diagonal)

  /* ---------- helpers ---------- */
  const num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;
  const r2 = v => v == null || !isFinite(v) ? null : Math.round(v * 100) / 100;
  const sum = a => a.reduce((s, x) => s + (x || 0), 0);
  const mean = a => a.length ? sum(a) / a.length : null;
  const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const daysInMonth = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
  const effortTier = e => (EFFORTS.find(x => x.id === e) || EFFORTS[2]).tier;
  const actGroup = (a, custom) => { const t = ACTIVITIES.find(x => x.id === a.type); if (t && t.id !== 'custom') return t.group; const c = custom && custom[a.customId]; return (c && c.group) || 'other'; };
  const throwsOf = a => Math.max(0, Math.round(num(a.throws) || 0));

  /* ---------- features ---------- */
  // Every feature is a SUM over activities, so a day's prediction splits exactly into per-activity contributions.
  const FEATURE_SETS = {
    S0: { label: 'Provisional effort-weighted throws', features: ['effortWeighted'] },
    M1: { label: 'Total throws', features: ['total'] },
    M2: { label: 'Throws by effort (low / moderate / high)', features: ['tLow', 'tMod', 'tHigh'] },
    M3: { label: 'Effort + high-effort mound vs off-mound', features: ['tLow', 'tMod', 'tHighOff', 'tHighMound'] },
    M4: { label: 'M3 + ball weight + long distance', features: ['tLow', 'tMod', 'tHighOff', 'tHighMound', 'tOver', 'tUnder', 'tLong'] },
    M5: { label: 'M4 + velocity-scaled mound throws', features: ['tLow', 'tMod', 'tHighOff', 'tHighMound', 'tOver', 'tUnder', 'tLong', 'tVeloMound'] },
  };
  const FEATURE_LABELS = { effortWeighted: 'Effort-weighted throws (provisional weights)', total: 'All throws', tLow: 'Recovery/low-intent throws', tMod: 'Moderate-intent throws',
    tHigh: 'High/max-intent throws', tHighOff: 'High/max-intent throws off the mound', tHighMound: 'High/max-intent mound throws', tOver: 'Overweight-ball throws',
    tUnder: 'Underweight-ball throws', tLong: `Throws beyond ${LONG_DISTANCE_FT} ft`, tVeloMound: 'High-intent mound throws × (velo ÷ his reference)²' };
  function activityFeatures(a, ctx) {
    const n = throwsOf(a), tier = effortTier(a.effort), grp = actGroup(a, ctx.custom), ball = ballClass(a.ballG);
    const w = (ctx.provisional || PROVISIONAL_WEIGHTS)[a.effort] ?? PROVISIONAL_WEIGHTS.moderate;
    const v = num(a.avgV), ref = ctx.refV;
    const veloRatio = (v && ref && ball === 'baseball') ? (v / ref) ** 2 : 1;
    const hi = tier === 'high' ? n : 0;
    return {
      effortWeighted: n * w, total: n,
      tLow: tier === 'low' ? n : 0, tMod: tier === 'mod' ? n : 0, tHigh: hi,
      tHighOff: grp === 'mound' ? 0 : hi, tHighMound: grp === 'mound' ? hi : 0,
      tOver: (ball === 'overweight' || ball === 'heavy-implement') ? n : 0, tUnder: ball === 'underweight' ? n : 0,
      tLong: (num(a.distFt) || 0) > LONG_DISTANCE_FT ? n : 0,
      tVeloMound: grp === 'mound' ? hi * veloRatio : 0,
    };
  }
  function buildFeatures(acts, setId, ctx) {
    const names = FEATURE_SETS[setId].features;
    const x = names.map(() => 0);
    for (const a of acts || []) { const f = activityFeatures(a, ctx || {}); names.forEach((k, i) => { x[i] += f[k]; }); }
    return x;
  }

  /* ---------- non-negative ridge regression (no intercept) ---------- */
  // minimise ‖y − Xb‖² + λ‖b‖² subject to b ≥ 0, by coordinate descent on the Gram matrix.
  // No intercept: zero throws must predict zero workload.
  function gram(X, y) {
    const p = X[0] ? X[0].length : 0, G = Array.from({ length: p }, () => Array(p).fill(0)), c = Array(p).fill(0);
    X.forEach((row, i) => { for (let j = 0; j < p; j++) { c[j] += row[j] * y[i]; for (let k = 0; k < p; k++) G[j][k] += row[j] * row[k]; } });
    return { G, c };
  }
  function nnRidgeFromGram(G, c, lambda) {
    const p = c.length, b = Array(p).fill(0);
    for (let it = 0; it < 500; it++) {
      let delta = 0;
      for (let j = 0; j < p; j++) {
        const den = G[j][j] + lambda; if (den <= 0) { b[j] = 0; continue; }
        let s = c[j]; for (let k = 0; k < p; k++) if (k !== j) s -= G[j][k] * b[k];
        const nb = Math.max(0, s / den); delta = Math.max(delta, Math.abs(nb - b[j])); b[j] = nb;
      }
      if (delta < 1e-10) break;
    }
    return b;
  }
  const lambdaFor = (G, alpha) => { const d = G.map((r, i) => r[i]).filter(v => v > 0); return alpha * (d.length ? mean(d) : 0); };
  function nnRidge(X, y, alpha) { const { G, c } = gram(X, y); return nnRidgeFromGram(G, c, lambdaFor(G, alpha)); }
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

  /* ---------- validation ---------- */
  function metrics(pairs) {   // pairs: [{ pred, actual, date, ... }]
    if (!pairs.length) return null;
    const err = pairs.map(p => p.pred - p.actual);
    const pct = pairs.filter(p => p.actual > 0).map(p => Math.abs(p.pred - p.actual) / p.actual * 100);
    return { n: pairs.length, mae: r2(mean(err.map(Math.abs))), rmse: r2(Math.sqrt(mean(err.map(e => e * e)))), bias: r2(mean(err)), mape: pct.length ? r2(mean(pct)) : null, mapeN: pct.length };
  }
  // leave-one-out using Gram down-dating
  function looPairs(X, y, dates, alpha) {
    const { G, c } = gram(X, y), out = [];
    for (let i = 0; i < X.length; i++) {
      const Gi = G.map((row, j) => row.map((v, k) => v - X[i][j] * X[i][k])), ci = c.map((v, j) => v - X[i][j] * y[i]);
      const b = nnRidgeFromGram(Gi, ci, lambdaFor(Gi, alpha));
      out.push({ date: dates[i], pred: Math.max(0, dot(b, X[i])), actual: y[i] });
    }
    return out;
  }
  // chronological expanding window: train on everything before day k, predict day k
  function chronoPairs(X, y, dates, alpha, minTrain) {
    const out = [];
    for (let k = minTrain; k < X.length; k++) {
      const b = nnRidge(X.slice(0, k), y.slice(0, k), alpha);
      out.push({ date: dates[k], pred: Math.max(0, dot(b, X[k])), actual: y[k] });
    }
    return out;
  }

  /* ---------- fitting ---------- */
  // days: [{ date, pulseWorkload, activities: [...] }]; only days with BOTH are calibration days.
  function calibrationDays(days) { return days.filter(d => num(d.pulseWorkload) != null && (d.activities || []).some(a => throwsOf(a) > 0)).sort((a, b) => a.date < b.date ? -1 : 1); }
  function referenceVelocity(cal) {
    const v = []; for (const d of cal) for (const a of d.activities) if (effortTier(a.effort) === 'high' && actGroup(a) === 'mound' && num(a.avgV) && ballClass(a.ballG) === 'baseball') v.push(+a.avgV);
    return v.length ? r2(mean(v)) : null;
  }
  function radarCoverage(cal) { return cal.length ? cal.filter(d => d.activities.some(a => num(a.avgV))).length / cal.length : 0; }

  function fitModel(days, opts) {
    opts = opts || {};
    const ctxBase = { custom: opts.custom || {}, provisional: Object.assign({}, PROVISIONAL_WEIGHTS, opts.provisional || {}) };
    const cal = calibrationDays(days);
    const n = cal.length;
    const refV = referenceVelocity(cal);
    const ctx = Object.assign({}, ctxBase, { refV });
    const support = supportCounts(cal, ctx);
    const base = { engineVersion: ENGINE_VERSION, nCalibration: n, refV, support, provisional: ctxBase.provisional, fittedThrough: n ? cal[n - 1].date : null };

    if (n < STAGES.earlyMin) {
      return finish(Object.assign(base, { stage: 'cold-start', featureSet: 'S0', coefs: [1], alpha: 0, scaleOnly: true, cv: null, candidates: [],
        note: 'No paired Pulse days yet. Values use the provisional effort weights and are NOT on the Pulse scale.' }));
    }
    if (n < STAGES.developingMin) {
      const X = cal.map(d => buildFeatures(d.activities, 'S0', ctx)), y = cal.map(d => +d.pulseWorkload);
      const k = nnRidge(X, y, 0)[0] || 0;
      const fit = metrics(cal.map((d, i) => ({ date: d.date, pred: k * X[i][0], actual: y[i] })));
      return finish(Object.assign(base, { stage: 'early', featureSet: 'S0', coefs: [r2Coef(k)], alpha: 0, scaleOnly: true, cv: null, trainFit: fit, candidates: [],
        note: 'Provisional effort weights rescaled to his Pulse days. In-sample fit only; not yet validated on unseen days.' }));
    }
    const X0 = {}, y = cal.map(d => +d.pulseWorkload), dates = cal.map(d => d.date);
    const cover = radarCoverage(cal);
    const candidates = [];
    for (const setId of ['M1', 'M2', 'M3', 'M4', 'M5']) {
      const p = FEATURE_SETS[setId].features.length;
      const reason = n < p + 3 ? `needs ≥ ${p + 3} paired days` : (setId === 'M5' && (cover < 0.5 || !refV)) ? 'radar on < 50% of calibration days' : null;
      if (reason) { candidates.push({ featureSet: setId, eligible: false, reason }); continue; }
      X0[setId] = cal.map(d => buildFeatures(d.activities, setId, ctx));
      let best = null;
      for (const alpha of ALPHAS) {
        const chrono = chronoPairs(X0[setId], y, dates, alpha, Math.max(p + 2, 3));
        const loo = looPairs(X0[setId], y, dates, alpha);
        const cm = metrics(chrono), lm = metrics(loo);
        const score = cm && cm.n >= 3 ? cm.mae : lm.mae;
        if (!best || score < best.score - 1e-9) best = { alpha, score, chrono: cm, loo: lm, chronoPairs: chrono, looPairs: loo };
      }
      candidates.push({ featureSet: setId, eligible: true, alpha: best.alpha, score: best.score, chrono: best.chrono, loo: best.loo, _pairs: best });
    }
    // simplest first; a richer model must beat the current choice out of sample by ≥ complexityGain
    let chosen = null;
    const minAbs = STAGES.complexityAbs * mean(y);
    for (const c of candidates) { if (!c.eligible) continue; if (!chosen || (c.score < chosen.score * (1 - STAGES.complexityGain) && chosen.score - c.score >= minAbs)) chosen = c; }
    if (!chosen) return fitModel(days.slice(0, 0), opts);
    const coefs = nnRidge(X0[chosen.featureSet], y, chosen.alpha).map(r2Coef);
    // features never seen in calibration get no learned coefficient; predictions fall back to the
    // provisional effort weights rescaled to his Pulse days (flagged), instead of silently returning 0
    const chosenFeatures = FEATURE_SETS[chosen.featureSet].features;
    const unsupported = chosenFeatures.filter((f, j) => X0[chosen.featureSet].every(row => row[j] === 0));
    const fallbackScale = r2Coef(nnRidge(cal.map(d => buildFeatures(d.activities, 'S0', ctx)), y, 0)[0] || 0);
    const heldOut = chosen.chrono ? chosen.chrono.n : 0;
    const stage = (n >= STAGES.establishedMin && heldOut >= STAGES.establishedHeldOut) ? 'established' : 'developing';
    const fitPairs = cal.map((d, i) => ({ date: d.date, pred: dot(coefs, X0[chosen.featureSet][i]), actual: y[i], acts: d.activities }));
    const errorBy = errorBreakdown(chosen._pairs.chronoPairs.length >= 3 ? chosen._pairs.chronoPairs : chosen._pairs.looPairs, cal, ctx);
    candidates.forEach(c => { c.chosen = c === chosen; delete c._pairs; });
    return finish(Object.assign(base, { stage, featureSet: chosen.featureSet, coefs, alpha: chosen.alpha, scaleOnly: false, unsupported, fallbackScale,
      cv: { chrono: chosen.chrono, loo: chosen.loo, primary: chosen.chrono && chosen.chrono.n >= 3 ? 'chronological' : 'leave-one-out' },
      trainFit: metrics(fitPairs), heldOutPairs: (chosen.chrono && chosen.chrono.n >= 3 ? chronoPairsCache(chosen, X0, y, dates) : null),
      errorBy, candidates, radarCoverage: r2(cover) }));
  }
  function chronoPairsCache(c, X0, y, dates) { const p = FEATURE_SETS[c.featureSet].features.length; return chronoPairs(X0[c.featureSet], y, dates, c.alpha, Math.max(p + 2, 3)).map(q => ({ date: q.date, pred: r2(q.pred), actual: q.actual })); }
  const r2Coef = v => Math.round(v * 10000) / 10000;
  function finish(m) {
    // version = engine + stage + feature set + data through + coefficient fingerprint
    const fp = (m.coefs || []).map(v => v.toFixed(4)).join('|') + '|' + (m.alpha || 0) + '|' + JSON.stringify(m.provisional);
    let h = 0; for (let i = 0; i < fp.length; i++) h = (h * 31 + fp.charCodeAt(i)) >>> 0;
    m.version = `tw${ENGINE_VERSION}-${m.featureSet}-${m.nCalibration}d-${h.toString(36)}`;
    m.features = FEATURE_SETS[m.featureSet].features;
    return m;
  }
  function supportCounts(cal, ctx) {
    const s = { activities: {}, efforts: {}, balls: {}, groups: {} };
    for (const d of cal) {
      const seenA = new Set(), seenE = new Set(), seenB = new Set(), seenG = new Set();
      for (const a of d.activities) { if (!throwsOf(a)) continue; seenA.add(a.type === 'custom' ? 'custom:' + (a.customId || '') : a.type); seenE.add(a.effort); seenB.add(ballClass(a.ballG)); seenG.add(actGroup(a, ctx.custom)); }
      seenA.forEach(k => s.activities[k] = (s.activities[k] || 0) + 1); seenE.forEach(k => s.efforts[k] = (s.efforts[k] || 0) + 1);
      seenB.forEach(k => s.balls[k] = (s.balls[k] || 0) + 1); seenG.forEach(k => s.groups[k] = (s.groups[k] || 0) + 1);
    }
    return s;
  }
  function errorBreakdown(pairs, cal, ctx) {
    const byDate = Object.fromEntries(cal.map(d => [d.date, d]));
    const out = { activity: {}, effort: {}, context: {} };
    for (const p of pairs) {
      const d = byDate[p.date]; if (!d) continue;
      const e = Math.abs(p.pred - p.actual);
      const dom = d.activities.reduce((a, b) => throwsOf(b) > throwsOf(a) ? b : a);
      const keys = { activity: dom.type, effort: dom.effort, context: actGroup(dom, ctx.custom) };
      for (const [g, k] of Object.entries(keys)) { const t = out[g][k] || (out[g][k] = { n: 0, sumAbs: 0, sumErr: 0 }); t.n++; t.sumAbs += e; t.sumErr += p.pred - p.actual; }
    }
    for (const g of Object.values(out)) for (const t of Object.values(g)) { t.mae = r2(t.sumAbs / t.n); t.bias = r2(t.sumErr / t.n); delete t.sumAbs; delete t.sumErr; }
    return out;
  }

  /* ---------- prediction & confidence ---------- */
  function predict(model, acts, opts) {
    const ctx = { custom: (opts && opts.custom) || {}, provisional: model.provisional, refV: model.refV };
    const flags = [];
    const unsup = new Set(model.unsupported || []);
    const perActivity = (acts || []).map(a => {
      const x = buildFeatures([a], model.featureSet, ctx);
      const live = model.features.map((f, j) => x[j] !== 0 ? f : null).filter(Boolean);
      if (live.length && unsup.size && live.every(f => unsup.has(f)) && model.fallbackScale > 0) {
        flags.push('fallback-provisional-weights');
        return r2(model.fallbackScale * buildFeatures([a], 'S0', ctx)[0]);
      }
      return r2(Math.max(0, dot(model.coefs, x)));
    });
    const value = r2(sum(perActivity));
    const s = model.support || { activities: {}, efforts: {}, balls: {}, groups: {} };
    if (model.stage !== 'cold-start') for (const a of acts || []) {
      if (!throwsOf(a)) continue;
      const key = a.type === 'custom' ? 'custom:' + (a.customId || '') : a.type;
      if (!s.activities[key]) flags.push(`unfamiliar-activity:${a.type === 'custom' ? (a.customLabel || 'custom') : a.type}`);
      if (!s.balls[ballClass(a.ballG)]) flags.push(`unfamiliar-ball:${ballClass(a.ballG)}`);
      if (!s.efforts[a.effort]) flags.push(`unfamiliar-effort:${a.effort}`);
      if (actGroup(a, ctx.custom) === 'other') flags.push('custom-activity-unmapped');
    }
    if (model.featureSet === 'M5' && !(acts || []).some(a => num(a.avgV))) flags.push('no-radar-velocity-term-at-reference');
    const uniqFlags = [...new Set(flags)];
    return { value, perActivity, flags: uniqFlags, confidence: confidence(model, uniqFlags), modelVersion: model.version };
  }
  function confidence(model, flags) {
    if (model.stage === 'cold-start') return { level: 'provisional', interval: null, basis: 'No paired Pulse data: not on the Pulse scale.' };
    if (model.stage === 'early') return { level: 'low', interval: null, basis: `Scale fitted to ${model.nCalibration} Pulse day(s); no out-of-sample test yet.` };
    const m = model.cv[model.cv.primary === 'chronological' ? 'chrono' : 'loo'];
    const levels = ['low', 'moderate', 'high'];
    let i = m.mape == null ? 0 : m.mape <= 15 ? 2 : m.mape <= 30 ? 1 : 0;
    i = Math.max(0, i - flags.length);
    return { level: levels[i], interval: m.rmse, basis: `${model.cv.primary} error on ${m.n} unseen day(s): MAE ${m.mae}, RMSE ${m.rmse}${m.mape != null ? `, MAPE ${m.mape}%` : ''}${flags.length ? `; lowered for ${flags.length} unfamiliar input(s)` : ''}.` };
  }

  /* ---------- the daily rule (spec §4 / §16) ---------- */
  // day: { date, pulseWorkload, restDay (bool), activities, override: { value, reason } }
  function resolveDay(day, model, opts) {
    const acts = (day.activities || []).filter(a => throwsOf(a) > 0);
    const pulse = num(day.pulseWorkload);
    const est = acts.length ? predict(model, acts, opts) : null;
    let out;
    if (pulse != null) {
      out = { finalPtw: pulse, mode: 'pulse_measured', confidence: { level: 'measured', interval: null, basis: 'Official Pulse One Day Workload.' } };
      if (est) Object.assign(out, { estimatedPtw: est.value, predictionError: r2(est.value - pulse), absoluteError: r2(Math.abs(est.value - pulse)),
        percentError: pulse > 0 ? r2(Math.abs(est.value - pulse) / pulse * 100) : null, estimateFlags: est.flags });
    } else if (acts.length) {
      out = { finalPtw: est.value, mode: 'estimated', confidence: est.confidence, estimatedPtw: est.value, estimateFlags: est.flags };
    } else if (day.restDay) {
      out = { finalPtw: 0, mode: 'rest_day', confidence: { level: 'not_applicable' } };
    } else {
      out = { finalPtw: null, mode: 'missing_data', confidence: { level: 'not_applicable' } };
    }
    if (est) out.perActivity = est.perActivity;
    out.modelVersion = model.version; out.engineVersion = ENGINE_VERSION; out.date = day.date;
    if (day.override && num(day.override.value) != null) {
      out.override = { value: +day.override.value, reason: day.override.reason || '', original: { finalPtw: out.finalPtw, mode: out.mode } };
      out.finalPtw = +day.override.value; out.mode = 'manual_override';
      out.confidence = { level: 'override', interval: null, basis: `Set by hand: ${day.override.reason || 'no reason given'}` };
    }
    return out;
  }

  /* ---------- periods ---------- */
  // resolved: { 'YYYY-MM-DD': resolveDay output (plus .throws, .highEffort) }
  function window_(resolved, endDate, nDays) {
    let sumW = 0, known = 0, missing = 0, measured = 0, estimated = 0, manual = 0, throwDays = 0, rest = 0, throws = 0, high = 0, maxDay = null;
    for (let i = 0; i < nDays; i++) {
      const d = addDays(endDate, -i), r = resolved[d];
      if (!r || r.finalPtw == null) { missing++; continue; }
      known++; sumW += r.finalPtw;
      if (r.mode === 'rest_day') rest++; else throwDays++;
      if (r.mode === 'pulse_measured') measured += r.finalPtw; else if (r.mode === 'estimated') estimated += r.finalPtw; else if (r.mode === 'manual_override') manual += r.finalPtw;
      throws += r.throws || 0; high += r.highEffort || 0;
      if (r.mode !== 'rest_day' && (!maxDay || r.finalPtw > maxDay.value)) maxDay = { date: d, value: r.finalPtw };
    }
    return { from: addDays(endDate, -(nDays - 1)), to: endDate, days: nDays, total: r2(sumW), avgDaily: r2(sumW / nDays), avgPerThrowingDay: throwDays ? r2(sumW / throwDays) : null,
      knownDays: known, missingDays: missing, throwingDays: throwDays, restDays: rest, throws, highEffort: high, highestDay: maxDay,
      pctMeasured: sumW > 0 ? r2(measured / sumW * 100) : null, pctEstimated: sumW > 0 ? r2(estimated / sumW * 100) : null, pctManual: sumW > 0 ? r2(manual / sumW * 100) : null, complete: missing === 0 };
  }
  const rolling = (resolved, end, n) => window_(resolved, end, n);
  function calendarMonth(resolved, ym) {
    const n = daysInMonth(ym);
    const w = window_(resolved, `${ym}-${String(n).padStart(2, '0')}`, n);
    return Object.assign(w, { month: ym, calendarDays: n, avgPerCalendarDay: r2(w.total / n) });
  }
  function pctChange(cur, prev) { return (prev == null || cur == null || prev === 0) ? null : r2((cur - prev) / prev * 100); }
  // optional contextual ratio, not a safety zone
  function acwr(resolved, end) {
    const a = window_(resolved, end, 9), c = window_(resolved, end, 28);
    return { value: c.avgDaily > 0 ? r2(a.avgDaily / c.avgDaily) : null, acute: a, chronic: c };
  }

  /* ---------- arm response review flags (never part of workload) ---------- */
  // days: sorted [{ date, elbow, shoulder, armHealth, readiness, sxDuring, sxAfter, nextMorning }]
  function symptomFlags(days, date) {
    const byDate = Object.fromEntries(days.map(d => [d.date, d]));
    const today = byDate[date]; if (!today) return [];
    const prior = k => days.filter(d => d.date < date && d.date >= addDays(date, -14) && num(d[k]) != null).map(d => +d[k]);
    const flags = [];
    for (const [k, label] of [['elbow', 'Elbow discomfort'], ['shoulder', 'Shoulder discomfort']]) {
      const v = num(today[k]); if (v == null) continue;
      const base = prior(k), avg = base.length ? mean(base) : null;
      if (v >= 3) flags.push({ key: k + '-level', level: v >= 5 ? 'high' : 'review', text: `${label} ${v}/10.` });
      if (avg != null && v - avg >= 2) flags.push({ key: k + '-rise', level: 'review', text: `${label} is ${r2(v - avg)} above his 14-day average (${r2(avg)}).` });
      const y = byDate[addDays(date, -1)], yy = byDate[addDays(date, -2)];
      if (v > 0 && y && num(y[k]) > 0 && yy && num(yy[k]) > 0 && v >= +y[k] && +y[k] >= +yy[k]) flags.push({ key: k + '-persist', level: 'review', text: `${label} present 3 days running and not easing.` });
    }
    if (today.sxDuring && String(today.sxDuring).trim()) flags.push({ key: 'during', level: 'high', text: `Symptoms during throwing: "${String(today.sxDuring).trim()}".` });
    if (today.sxAfter && String(today.sxAfter).trim()) flags.push({ key: 'after', level: 'review', text: `Symptoms after throwing: "${String(today.sxAfter).trim()}".` });
    if (today.nextMorning === 'worse') flags.push({ key: 'morning', level: 'review', text: 'Next-morning response: worse than the day before.' });
    const ah = num(today.armHealth), ahBase = prior('armHealth');
    if (ah != null && ahBase.length >= 3 && mean(ahBase) - ah >= 2) flags.push({ key: 'armhealth-drop', level: 'review', text: `Arm health ${ah}/10, ${r2(mean(ahBase) - ah)} below his 14-day average.` });
    return flags;
  }

  /* ---------- documentation ---------- */
  const REF = {
    pulse: 'Driveline Baseball. Pulse workload methodology and acute/chronic workload documentation (manufacturer documentation; methodology not independently validated).',
    makhni2018: 'Makhni EC, Lizzio VA, Meta F, et al. Assessment of elbow torque and other parameters during the pitching motion: comparison of fastball, curveball, and change-up. Arthroscopy. 2018;34(3):816-822.',
    camp2017: 'Camp CL, Tubbs TG, Fleisig GS, et al. The relationship of throwing arm mechanics and elbow varus torque: within-subject variation for professional baseball pitchers across 82,000 throws. Am J Sports Med. 2017;45(13):3030-3035.',
    impellizzeri2020: 'Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. Int J Sports Physiol Perform. 2020;15(6):907-913.',
    lolli2019: 'Lolli L, Batterham AM, Hawkins R, et al. Mathematical coupling causes spurious correlation within the conventional acute-to-chronic workload ratio calculations. Br J Sports Med. 2019;53(15):921-922.',
    hoerl1970: 'Hoerl AE, Kennard RW. Ridge regression: biased estimation for nonorthogonal problems. Technometrics. 1970;12(1):55-67.',
    lawson1974: 'Lawson CL, Hanson RJ. Solving Least Squares Problems. Prentice-Hall; 1974 (non-negative least squares).',
    hyndman2006: 'Hyndman RJ, Koehler AB. Another look at measures of forecast accuracy. Int J Forecast. 2006;22(4):679-688.',
    fleisig2011: 'Fleisig GS, Bolt B, Fortenbaugh D, Wilk KE, Andrews JR. Biomechanical comparison of baseball pitching and long-toss: implications for training and rehabilitation. J Orthop Sports Phys Ther. 2011;41(5):296-303.',
    reinold2018: 'Reinold MM, Macrina LC, Fleisig GS, Aune K, Andrews JR. Effect of a 6-week weighted baseball throwing program on pitch velocity, pitching arm biomechanics, passive range of motion, and injury rates. Sports Health. 2018;10(4):327-333.',
  };
  const METHODS = [
    { id: 'ptw', name: 'Daily Personalized Throwing Workload (PTW)', class: 'established',
      formula: 'Pulse day: PTW = official Pulse One Day Workload. Confirmed rest day: PTW = 0. Throwing logged without Pulse: PTW = model estimate. Nothing logged: PTW missing (never 0). A manual override replaces PTW and keeps the original and the reason.',
      variables: 'Pulse One Day Workload; activity log; rest-day flag', units: 'Pulse-equivalent units (PEU)',
      rationale: 'Pulse is the reference measurement; the estimator only fills days without it. Measured and estimated values are kept separate so one never silently becomes the other.',
      limitations: 'Pulse torque and workload are sensor-based estimates of elbow loading, not direct measures of ligament strain or tissue stress.', references: [REF.pulse, REF.camp2017, REF.makhni2018], validation: 'Pulse days are measured values; see the model page for estimated days.' },
    { id: 'model', name: 'Estimated workload model', class: 'evidence-informed',
      formula: 'PTŴ = Σ βⱼ·Xⱼ with βⱼ ≥ 0, fitted by non-negative ridge regression: minimise ‖y − Xβ‖² + λ‖β‖², λ = α × mean(diag XᵀX). No intercept (zero throws → zero workload). y = his Pulse One Day Workload.',
      variables: 'Xⱼ = daily sums of throws by effort tier, mound vs off-mound high-effort throws, overweight/underweight-ball throws, throws beyond 120 ft, and (optional) high-intent mound throws × (velocity ÷ his reference velocity)²', units: 'PEU',
      rationale: 'The model predicts his own Pulse number, so estimates live on the same scale. Ridge penalties stabilise correlated features; non-negativity stops more throwing from lowering workload. Distance and ball weight enter as categories, so no linear dose is assumed.',
      limitations: 'Only as good as the paired Pulse days it learns from. Daily Pulse aggregates cannot attribute load to individual activities exactly; per-activity splits are model attributions. The velocity-squared term is a hypothesis the model keeps only if it improves out-of-sample error. An activity whose inputs never appeared on a calibration day has no learned coefficient; it is estimated with the provisional effort weights rescaled to his Pulse days and flagged as a fallback, rather than counted as zero.', references: [REF.hoerl1970, REF.lawson1974, REF.fleisig2011, REF.reinold2018], validation: 'Measured on his own held-out days (model page).' },
    { id: 'selection', name: 'Model selection and maturity', class: 'evidence-informed',
      formula: `Candidates M1 (total throws) → M5 (adds velocity). A richer model is chosen only if its out-of-sample MAE is ≥ ${STAGES.complexityGain * 100}% lower AND lower by ≥ ${STAGES.complexityAbs * 100}% of his average Pulse workload. Stages: cold start (0 paired days, provisional weights), early (≥${STAGES.earlyMin}: one scale factor), developing (≥${STAGES.developingMin}: cross-validated), established (≥${STAGES.establishedMin} paired days and ≥${STAGES.establishedHeldOut} chronological held-out predictions).`,
      variables: 'paired Pulse + activity days', units: '—',
      rationale: 'Prefers the simplest model that predicts unseen days, as the spec requires. Chronological validation (train on the past, predict the next day) tests the real use case.',
      limitations: 'Stage thresholds are operational conventions, not guarantees of accuracy. Confidence comes from measured error, not from the count of days.', references: [REF.hyndman2006], validation: 'Self-reported on the model page.' },
    { id: 'provisional', name: 'Provisional cold-start weights', class: 'experimental',
      formula: 'PEU per throw: recovery 0.05, low 0.10, moderate 0.20, high 0.35, max 0.50 (editable)',
      variables: 'effort category', units: 'provisional units (not Pulse units)',
      rationale: 'Gives an ordered placeholder before any Pulse calibration exists. Once Pulse days exist they are rescaled, then replaced by fitted coefficients.',
      limitations: 'Placeholders, not scientific multipliers. Cold-start values are not on the Pulse scale and must not be compared with Pulse numbers.', references: [], validation: 'None (provisional by design).' },
    { id: 'accuracy', name: 'Prediction error', class: 'established',
      formula: 'Error = estimate − Pulse; |Error|; % error = |Error| ÷ Pulse × 100 (omitted when Pulse = 0). Summaries: MAE, RMSE, MAPE, bias (mean error), by activity, effort and context.',
      variables: 'held-out predictions vs Pulse', units: 'PEU; %',
      rationale: 'Standard forecast-accuracy measures. Bias shows systematic over/under-estimation.', limitations: 'MAPE is unstable when Pulse workloads are small.', references: [REF.hyndman2006], validation: 'Computed from his data.' },
    { id: 'confidence', name: 'Confidence of an estimate', class: 'evidence-informed',
      formula: 'Provisional (cold start) · low (early) · otherwise from held-out MAPE: ≤15% high, ≤30% moderate, else low; lowered one level per unfamiliar input (activity, ball class or effort with no calibration days, unmapped custom activity, missing radar when the model uses velocity). Interval = ± held-out RMSE.',
      variables: 'model error, input novelty', units: 'level; ± PEU',
      rationale: 'Shows how far to trust a number separately from its size.', limitations: 'Cut-points are display conventions.', references: [REF.hyndman2006], validation: 'Convention.' },
    { id: 'periods', name: '7-day, 28-day and calendar-month totals', class: 'established',
      formula: 'PTW₇ = Σ last 7 calendar days; average = PTW₇ ÷ 7. PTW₂₈ = Σ last 28 days; average ÷ 28. Month: Σ month; average per calendar day ÷ days in that month (28–31). Rest days add 0; missing days add nothing and are counted and shown.',
      variables: 'daily PTW', units: 'PEU',
      rationale: 'Plain sums over fixed windows; calendar months stay separate from rolling windows.', limitations: 'Windows with missing days under-count; the dashboard shows how many days are missing.', references: [REF.pulse], validation: 'Arithmetic.' },
    { id: 'change', name: 'Period-to-period change', class: 'established',
      formula: '% change = (current − prior) ÷ prior × 100; unavailable when prior is 0. Months compare average per calendar day.',
      variables: 'period totals', units: '%', rationale: 'Shows direction of workload change.', limitations: 'Monitoring information, not an instruction to throw more or less.', references: [], validation: 'Arithmetic.' },
    { id: 'acwr', name: '9:28 workload ratio (optional)', class: 'experimental',
      formula: 'ratio = (PTW₉ ÷ 9) ÷ (PTW₂₈ ÷ 28)', variables: 'daily PTW', units: 'ratio',
      rationale: 'A contextual comparison of recent with longer-term workload, aligned with the windows Pulse reports.',
      limitations: 'No range is a proven safe zone. Acute:chronic ratios have serious methodological problems (including mathematical coupling) and must not be used to predict injury or clear throwing.', references: [REF.impellizzeri2020, REF.lolli2019], validation: 'Not validated for injury risk.' },
    { id: 'velocity', name: 'Velocity tracking', class: 'established',
      formula: 'Per context (activity type), baseball-weight throws only: average of session averages, maximum, and 90th percentile when ≥ 10 individual readings exist; trends over 7, 28 and 90 days.',
      variables: 'radar average, max, readings, radar-measured throws', units: 'mph',
      rationale: 'Velocity is a performance output and intensity indicator. Contexts are never mixed (a bullpen average is not compared with a flatground average).', limitations: 'Not a measure of elbow stress. Weighted-ball velocities are excluded from fastball trends.', references: [REF.camp2017], validation: 'Measurement only.' },
    { id: 'response', name: 'Arm-response review flags', class: 'evidence-informed',
      formula: 'Flag when elbow or shoulder discomfort ≥ 3/10; ≥ 2 above his 14-day average; present 3 days running without easing; any symptoms during or after throwing; next-morning response "worse"; arm health ≥ 2 below his 14-day average.',
      variables: 'daily arm-response inputs', units: '—',
      rationale: 'Keeps a worsening response visible even when workload is low. Never added to the workload score.', limitations: 'Review prompts, not diagnoses. Decisions belong to his treating clinician and performance staff.', references: [], validation: 'Convention.' },
  ];

  const api = { ENGINE_VERSION, SPEC_VERSION, ACTIVITIES, GROUPS, EFFORTS, BALL_PRESETS, PROVISIONAL_WEIGHTS, STAGES, FEATURE_SETS, FEATURE_LABELS, LONG_DISTANCE_FT, METHODS, REF,
    ballClass, effortTier, buildFeatures, activityFeatures, nnRidge, metrics, fitModel, predict, resolveDay, rolling, calendarMonth, pctChange, acwr, symptomFlags, addDays, daysInMonth, calibrationDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TritonThrowing = api;
})(typeof self !== 'undefined' ? self : this);
