/* Unit tests for throwing-engine.js — TritonThrowing.runTests() in a browser, or `node throwing-engine.test.js`. */
(function (root) {
  const T = (typeof module !== 'undefined' && module.exports) ? require('./throwing-engine.js') : root.TritonThrowing;

  // deterministic pseudo-random numbers
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  // Synthetic athlete whose true Pulse workload = 0.1·low + 0.3·moderate + 0.8·high-intent throws (no noise)
  function synthDays(n, noise) {
    const r = rng(7), days = [];
    for (let i = 0; i < n; i++) {
      const date = T.addDays('2026-09-01', i);
      const low = Math.round(10 + r() * 30), mod = Math.round(r() * 25), high = Math.round(r() * 20);
      const acts = [{ type: 'catch', throws: low, effort: 'low', ballG: 142, distFt: 90 }];
      if (mod) acts.push({ type: 'long-toss', throws: mod, effort: 'moderate', ballG: 142, distFt: 150 });
      if (high) acts.push({ type: 'bullpen', throws: high, effort: 'high', ballG: 142, distFt: 60 });
      const truth = 0.1 * low + 0.3 * mod + 0.8 * high;
      days.push({ date, pulseWorkload: Math.round((truth + (noise ? (r() - 0.5) * noise : 0)) * 100) / 100, activities: acts });
    }
    return days;
  }

  function runTests() {
    const res = []; const t = (name, ok, got) => res.push({ name, pass: !!ok, got });
    const near = (a, b, tol) => Math.abs(a - b) <= tol;

    // NN ridge: exact recovery and non-negativity
    const b = T.nnRidge([[1, 0], [0, 1], [1, 1], [2, 1]], [2, 3, 5, 7], 0);
    t('NN ridge recovers exact coefficients', near(b[0], 2, 1e-6) && near(b[1], 3, 1e-6), b);
    const neg = T.nnRidge([[1, 1], [2, 1], [3, 1]], [3, 2, 1], 0);
    t('NN ridge clips negative coefficients to 0', neg.every(v => v >= 0), neg);

    // cold start
    const cold = T.fitModel([]);
    t('cold start stage', cold.stage === 'cold-start');
    const p0 = T.predict(cold, [{ type: 'bullpen', throws: 20, effort: 'high', ballG: 142 }]);
    t('cold start uses provisional weights (20 × 0.35)', p0.value === 7 && p0.confidence.level === 'provisional', p0);

    // early calibration: one scale factor
    const early = T.fitModel(synthDays(2));
    t('early stage with 2 paired days', early.stage === 'early' && early.scaleOnly, early.stage);

    // developing/established: recovers the true structure out of sample
    const days = synthDays(30);
    const m = T.fitModel(days);
    t('established stage with 30 paired days', m.stage === 'established', m.stage);
    t('chooses an effort-based model (M2/M3)', ['M2', 'M3'].includes(m.featureSet), m.featureSet);
    t('chronological MAPE < 5% on noiseless data', m.cv.chrono && m.cv.chrono.mape < 5, m.cv.chrono);
    const pred = T.predict(m, [{ type: 'catch', throws: 20, effort: 'low', ballG: 142 }, { type: 'bullpen', throws: 10, effort: 'high', ballG: 142 }]);
    t('prediction ≈ truth (0.1·20 + 0.8·10 = 10)', near(pred.value, 10, 0.5), pred.value);
    t('per-activity contributions sum to total', near(pred.perActivity.reduce((s, v) => s + v, 0), pred.value, 0.02), pred.perActivity);
    t('model version recorded', /^tw1\.0\.0-M\d-30d-/.test(m.version), m.version);
    const novel = T.predict(m, [{ type: 'plyo', throws: 20, effort: 'high', ballG: 450 }]);
    t('unfamiliar activity/ball lowers confidence and is flagged', novel.flags.length >= 2 && novel.confidence.level === 'low', novel);
    const noisy = T.fitModel(synthDays(40, 4));
    t('noisy data (±2 PEU): still effort-based, held-out MAPE < 20%', ['M2', 'M3'].includes(noisy.featureSet) && noisy.cv.chrono.mape < 20, { fs: noisy.featureSet, cv: noisy.cv.chrono });
    t('noisy data: high-intent coefficient ≈ 0.8', near(noisy.coefs[noisy.features.indexOf(noisy.featureSet === 'M2' ? 'tHigh' : 'tHighMound')], 0.8, 0.1), noisy.coefs);
    const noMod = T.fitModel(synthDays(30).map(d => Object.assign({}, d, { activities: d.activities.filter(a => a.effort !== 'moderate'), pulseWorkload: d.activities.filter(a => a.effort !== 'moderate').reduce((s, a) => s + (a.effort === 'low' ? 0.1 : 0.8) * a.throws, 0) })));
    const unseen = T.predict(noMod, [{ type: 'catch', throws: 40, effort: 'moderate', ballG: 142 }]);
    t('input never seen in calibration: not 0, uses flagged fallback', unseen.value > 0 && unseen.flags.includes('fallback-provisional-weights') && unseen.flags.includes('unfamiliar-effort:moderate'), unseen);
    const simpler = T.fitModel(synthDays(30, 0)).candidates.filter(c => c.eligible).length;
    t('several candidate models evaluated', simpler >= 3, simpler);

    // daily rule
    const pulseDay = T.resolveDay({ date: '2026-11-01', pulseWorkload: 12, activities: [{ type: 'bullpen', throws: 10, effort: 'high', ballG: 142 }] }, m);
    t('Pulse day: final = Pulse (not blended)', pulseDay.finalPtw === 12 && pulseDay.mode === 'pulse_measured', pulseDay);
    t('Pulse day: background estimate + error kept', pulseDay.estimatedPtw != null && pulseDay.predictionError === Math.round((pulseDay.estimatedPtw - 12) * 100) / 100);
    const zeroPulse = T.resolveDay({ date: '2026-11-01', pulseWorkload: 0, activities: [{ type: 'catch', throws: 5, effort: 'low' }] }, m);
    t('% error omitted when Pulse = 0', zeroPulse.percentError === null);
    t('rest day = 0', T.resolveDay({ date: '2026-11-02', restDay: true }, m).finalPtw === 0);
    const miss = T.resolveDay({ date: '2026-11-03' }, m);
    t('missing day stays missing (null, not 0)', miss.finalPtw === null && miss.mode === 'missing_data');
    const ov = T.resolveDay({ date: '2026-11-04', activities: [{ type: 'catch', throws: 30, effort: 'low' }], override: { value: 9, reason: 'Pulse battery died' } }, m);
    t('override replaces PTW and keeps the original + reason', ov.finalPtw === 9 && ov.mode === 'manual_override' && ov.override.original.mode === 'estimated' && ov.override.reason);

    // windows
    const resolved = {};
    for (let i = 0; i < 28; i++) { const d = T.addDays('2026-11-01', i); resolved[d] = i % 7 === 6 ? { finalPtw: 0, mode: 'rest_day' } : i === 10 ? { finalPtw: null, mode: 'missing_data' } : { finalPtw: 10, mode: i % 2 ? 'pulse_measured' : 'estimated', throws: 40, highEffort: 5 }; }
    const w7 = T.rolling(resolved, '2026-11-07', 7);
    t('7-day total and average ÷ 7', w7.total === 60 && w7.avgDaily === 8.57 && w7.restDays === 1, w7);
    const w28 = T.rolling(resolved, '2026-11-28', 28);
    t('28-day: missing day counted, not zero', w28.missingDays === 1 && w28.total === 230 && !w28.complete, w28);
    const nov = T.calendarMonth(resolved, '2026-11');
    t('November uses 30 calendar days', nov.calendarDays === 30 && nov.avgPerCalendarDay === Math.round(230 / 30 * 100) / 100, nov);
    t('February 2027 has 28 days', T.daysInMonth('2027-02') === 28);
    t('% change unavailable when prior = 0', T.pctChange(10, 0) === null && T.pctChange(15, 10) === 50);
    const r = T.acwr(resolved, '2026-11-28');
    t('9:28 ratio computed from daily averages', r.value != null && r.acute.days === 9 && r.chronic.days === 28, r.value);

    // symptom flags
    const sx = [{ date: '2026-11-01', elbow: 1 }, { date: '2026-11-02', elbow: 1 }, { date: '2026-11-03', elbow: 2 }, { date: '2026-11-04', elbow: 4, sxDuring: 'sharp at release' }];
    const f = T.symptomFlags(sx, '2026-11-04');
    t('elbow ≥3, rise vs baseline, persistence and pain-during all flagged', ['elbow-level', 'elbow-rise', 'elbow-persist', 'during'].every(k => f.some(x => x.key === k)), f.map(x => x.key));
    t('no flags on a clean day', T.symptomFlags([{ date: '2026-11-05', elbow: 0, shoulder: 0 }], '2026-11-05').length === 0);

    // determinism
    t('fit is deterministic', JSON.stringify(T.fitModel(days)) === JSON.stringify(T.fitModel(days)));
    const passed = res.filter(x => x.pass).length;
    return { passed, total: res.length, failed: res.filter(x => !x.pass) };
  }
  T.runTests = runTests;
  if (typeof module !== 'undefined' && require.main === module) { const r = runTests(); console.log(JSON.stringify(r, null, 2)); process.exit(r.failed.length ? 1 : 0); }
})(typeof self !== 'undefined' ? self : this);
