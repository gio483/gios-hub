/* Unit tests for engine.js — run in a browser console after loading the three
   workload scripts (TritonWorkload.runTests()), or with Node: node engine.test.js */
(function (root) {
  const W = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.TritonWorkload;
  const REG = { chest: 'upper', triceps: 'upper', frontDelt: 'upper', lats: 'upper', biceps: 'upper', quads: 'lower', glutes: 'lower', hamstrings: 'lower', adductors: 'lower', erectors: 'trunk', abs: 'trunk' };
  const squat = { id: 'back-squat', name: 'Back Squat', primary: ['quads', 'glutes'], secondary: ['adductors', 'erectors'], compound: true, axial: true, unilateral: false, explosive: false, impact: 'none', bwLoad: 0, loadComparable: true };
  const rfess = { id: 'bb-rfess', name: 'Barbell RFESS', primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings'], compound: true, axial: true, unilateral: true, explosive: false, impact: 'none', bwLoad: 0 };
  const pullup = { id: 'pull-up', name: 'Pull-Up', primary: ['lats'], secondary: ['biceps'], compound: true, unilateral: false, explosive: false, impact: 'none', bwLoad: 1 };
  const keiser = { id: 'keiser-row', name: 'Keiser Row', primary: ['lats'], secondary: ['biceps'], compound: true, explosive: true, impact: 'none', loadComparable: false };
  const depth = { id: 'sl-depth-drop', name: 'SL Depth Drop', primary: ['quads', 'glutes'], secondary: [], compound: false, unilateral: true, explosive: true, impact: 'high', bwLoad: 0 };

  function runTests() {
    const results = []; const t = (name, cond, got) => results.push({ name, pass: !!cond, got });
    t('RPE 8 → RIR 2', W.rpeToRir(8) === 2, W.rpeToRir(8));
    t('RPE 7.5 → RIR 2.5', W.rpeToRir(7.5) === 2.5, W.rpeToRir(7.5));
    t('RIR entered beats RPE', W.setRir({ rpe: 9, rir: 3 }) === 3);
    t('effort categories', [0, 2, 4, 6].map(W.effortCategory).join() === 'very-close,near,moderate,lower');
    t('Epley 225×5 = 262.5', W.e1rmEpley(225, 5).value === 262.5, W.e1rmEpley(225, 5));
    t('Epley flags >10 reps', W.e1rmEpley(100, 12).highRep === true);
    t('Epley 1 rep = load', W.e1rmEpley(300, 1).value === 300);
    t('Epley RIR-adjusted: 225×5 @ RIR 2 = 225×(1+7/30)', W.e1rmEpley(225, 5, 2).value === 277.5, W.e1rmEpley(225, 5, 2));
    t('Epley flags high effective reps', W.e1rmEpley(100, 9, 3).highRep === true);
    t('relative intensity', W.relativeIntensity(240, 300) === 80);

    const a = W.analyzeSession({ date: '2026-11-20', bodyweightLb: 200, sessionRpe: 7, durationMin: 60, exercises: [
      { exercise: squat, oneRm: { tested: 300 }, sets: [{ load: 240, reps: 5, rpe: 8 }, { load: 240, reps: 5, rpe: 8.5 }, { load: 200, reps: 8, rpe: 6 }] },
      { exercise: rfess, sets: [{ load: 95, reps: 8, rpe: 7 }] },
      { exercise: pullup, sets: [{ load: 'BW', reps: 8, rpe: 8 }, { load: 25, reps: 5 }] },
      { exercise: keiser, sets: [{ load: 60, reps: 6, rpe: 6 }] },
      { exercise: depth, sets: [{ load: 0, reps: 3 }] },
    ] }, REG);
    t('session load = 7 × 60', a.session.load === 420, a.session.load);
    t('sets counted', a.counts.sets === 8, a.counts.sets);
    t('hard sets (RIR ≤ 3)', a.counts.hardSets === 4, a.counts.hardSets);
    t('unknown-effort sets counted, not hard', a.counts.unknownEffortSets === 2, a.counts.unknownEffortSets);
    t('quads direct = squat 3 + rfess 1 + depth 1', a.muscles.quads.direct === 5, a.muscles.quads);
    t('quads hard direct = 2 + 1', a.muscles.quads.hardDirect === 3, a.muscles.quads);
    t('adductors indirect only', a.muscles.adductors.direct === 0 && a.muscles.adductors.indirect === 4, a.muscles.adductors);
    t('unilateral set counts once per muscle', a.muscles.hamstrings.indirect === 1, a.muscles.hamstrings);
    t('high-intensity sets ≥ 80% tested 1RM', a.counts.highIntensitySets === 2, a.counts.highIntensitySets);
    t('heavy compound sets (2 squat sets at 80%)', a.counts.heavyCompoundSets === 2, a.counts.heavyCompoundSets);
    t('explosive sets (keiser + depth)', a.counts.explosiveSets === 2, a.counts.explosiveSets);
    t('axial sets (squat 3 + rfess 1)', a.counts.axialSets === 4, a.counts.axialSets);
    t('impact contacts = 3 reps × 2 sides', a.counts.highImpactContacts === 6, a.counts.highImpactContacts);
    // volume: squat 240*5*2 + 200*8 = 4000; rfess 95*8*2 = 1520; pull-ups (200)*8 + (225)*5 = 2725; keiser excluded
    t('volume total excludes pneumatic', a.volume.total === 8245, a.volume.total);
    t('pneumatic volume kept separately', a.volume.nonComparable === 360, a.volume.nonComparable);
    t('lower volume', a.volume.lower === 5520, a.volume.lower);
    t('upper volume', a.volume.upper === 2725, a.volume.upper);
    t('lower region sets counted once', a.regions.lower.directSets === 5, a.regions.lower);
    t('bodyweight convention flagged', a.flags.includes('bodyweight-convention'));
    t('non-comparable flagged', a.flags.includes('non-comparable-load'));
    t('kg converted', W.externalLoad({ load: 100 }, squat, 0, 'kg').load === 220.46);
    t('deterministic', JSON.stringify(a) === JSON.stringify(W.analyzeSession({ date: '2026-11-20', bodyweightLb: 200, sessionRpe: 7, durationMin: 60, exercises: [
      { exercise: squat, oneRm: { tested: 300 }, sets: [{ load: 240, reps: 5, rpe: 8 }, { load: 240, reps: 5, rpe: 8.5 }, { load: 200, reps: 8, rpe: 6 }] },
      { exercise: rfess, sets: [{ load: 95, reps: 8, rpe: 7 }] },
      { exercise: pullup, sets: [{ load: 'BW', reps: 8, rpe: 8 }, { load: 25, reps: 5 }] },
      { exercise: keiser, sets: [{ load: 60, reps: 6, rpe: 6 }] },
      { exercise: depth, sets: [{ load: 0, reps: 3 }] } ] }, REG)));
    const w = W.aggregate([a, Object.assign({}, a, { date: '2026-11-22' })], '2026-11-17', '2026-11-23');
    t('weekly aggregate sums', w.counts.sets === 16 && w.sessions === 2 && w.sessionLoad === 840, w.counts);
    t('week starts Monday', W.weekStart('2026-11-22') === '2026-11-16', W.weekStart('2026-11-22'));
    const passed = results.filter(r => r.pass).length;
    return { passed, total: results.length, failed: results.filter(r => !r.pass) };
  }
  W.runTests = runTests;
  if (typeof module !== 'undefined' && require.main === module) { const r = runTests(); console.log(JSON.stringify(r, null, 2)); process.exit(r.failed.length ? 1 : 0); }
})(typeof self !== 'undefined' ? self : this);
