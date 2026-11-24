/* Triton Workload — Calculation Engine (component C)
   ------------------------------------------------------------------
   Deterministic, dependency-free, no DOM, no network, no AI.
   Same input → same output. Reusable on its own (window.TritonWorkload or
   module.exports). Input/output shapes are documented in schema.json.

   Everything here is a MONITORING measure. Nothing in this file measures
   fatigue, CNS stress, muscle activation or hypertrophy stimulus.
*/
(function (root) {
  'use strict';

  const ENGINE_VERSION = '1.0.0';     // code
  const RULES_VERSION = '2026-11-23';  // thresholds/conventions below; bump when any changes
  const SPEC_VERSION = '2.0';          // "Baseball Lifting Workload Calculator — Technical Specification v2.0"

  /* Conventions (monitoring thresholds, not biological constants). */
  const RULES = {
    hardSetMaxRir: 3,          // hard set = estimated RIR ≤ 3
    nearFailureMaxRir: 1,      // very close to failure = RIR ≤ 1
    highIntensityPct: 80,      // high-intensity set = load ≥ 80% of 1RM
    heavyNo1rmMaxReps: 5,      // heavy compound proxy when no 1RM: ≤ 5 reps at RIR ≤ 3
    e1rmMaxRepsReliable: 10,   // Epley estimates from > 10 reps are flagged
    kgToLb: 2.20462,
    unilateralSides: 2,        // reps are entered PER SIDE; volume counts both sides
    compositeMinBaseline: 6,   // prior lifting days needed before the experimental index is shown
    compositeBaselineDays: 28,
  };

  /* ---------- small helpers ---------- */
  const num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;
  const isBW = v => /^\s*bw\s*$/i.test(String(v == null ? '' : v));
  const r2 = v => v == null ? null : Math.round(v * 100) / 100;
  const sum = a => a.reduce((s, x) => s + (x || 0), 0);
  const mean = a => a.length ? sum(a) / a.length : null;
  const sd = a => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(sum(a.map(x => (x - m) ** 2)) / (a.length - 1)); };
  const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };
  const weekStart = iso => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); const dow = (t.getUTCDay() + 6) % 7; return addDays(iso, -dow); }; // Monday

  /* ---------- effort ---------- */
  // RPE (RIR-based scale): RPE 10 = 0 RIR … RPE 6 = 4 RIR; half points allowed.
  function rpeToRir(rpe) { const r = num(rpe); if (r == null) return null; return Math.max(0, r2(10 - Math.min(10, Math.max(0, r)))); }
  function setRir(set) { const rir = num(set.rir); return rir != null ? Math.max(0, rir) : rpeToRir(set.rpe); }
  function effortCategory(rir) {
    if (rir == null) return 'unknown';
    if (rir <= 1) return 'very-close';   // 0–1 RIR
    if (rir <= 3) return 'near';         // 2–3 RIR
    if (rir <= 5) return 'moderate';     // 4–5 RIR
    return 'lower';                      // 6+ RIR
  }
  const isHard = rir => rir != null && rir <= RULES.hardSetMaxRir;

  /* ---------- load ---------- */
  // External load of one rep on one side, in lb.
  function externalLoad(set, ex, bodyweightLb, unit) {
    const flags = [];
    let load = isBW(set.load) ? 0 : (num(set.load) || 0);
    if ((unit || set.unit) === 'kg') load *= RULES.kgToLb;
    if (ex && ex.bwLoad > 0) {
      if (bodyweightLb > 0) { load += ex.bwLoad * bodyweightLb; flags.push('bodyweight-convention'); }
      else flags.push('bodyweight-unknown');
    }
    return { load: r2(load), flags };
  }
  const sides = ex => (ex && ex.unilateral) ? RULES.unilateralSides : 1;

  // Epley: 1RM ≈ w × (1 + reps/30). With a known RIR the set is treated as a
  // (reps + RIR)-rep max, so sub-maximal sets are not read as rep-maxes.
  // A true 1-rep max (1 rep, RIR 0 or unknown) returns the load itself.
  function e1rmEpley(loadLb, reps, rir) {
    const w = num(loadLb), r = num(reps), x = num(rir);
    if (!w || !r || r < 1) return null;
    const eff = r + (x != null ? Math.max(0, x) : 0);
    return { value: r2(eff === 1 ? w : w * (1 + eff / 30)), highRep: eff > RULES.e1rmMaxRepsReliable, rirAdjusted: x != null && x > 0 };
  }
  function relativeIntensity(loadLb, oneRmLb) { return (loadLb > 0 && oneRmLb > 0) ? r2(loadLb / oneRmLb * 100) : null; }

  /* ---------- one session ---------- */
  // session: { date, bodyweightLb, sessionRpe, durationMin, exercises: [{ exercise: ExerciseRecord, unit, oneRm: { tested, estimated, estimatedFlags }, sets: [{ load, reps, rpe, rir, explosive }] }] }
  // muscleRegions: { muscleId: 'upper'|'lower'|'trunk' }
  function analyzeSession(session, muscleRegions) {
    const out = {
      engineVersion: ENGINE_VERSION, rulesVersion: RULES_VERSION, date: session.date,
      muscles: {}, regions: { upper: blankRegion(), lower: blankRegion(), trunk: blankRegion() },
      volume: { total: 0, upper: 0, lower: 0, trunk: 0, totalBody: 0, nonComparable: 0, byExercise: [] },
      counts: { exercises: 0, sets: 0, reps: 0, hardSets: 0, nearFailureSets: 0, unknownEffortSets: 0, highIntensitySets: 0,
        heavyCompoundSets: 0, explosiveSets: 0, axialSets: 0, highForceSets: 0, highImpactContacts: 0 },
      session: { rpe: num(session.sessionRpe), durationMin: num(session.durationMin), load: null },
      effort: { 'very-close': 0, near: 0, moderate: 0, lower: 0, unknown: 0 },
      flags: [],
    };
    const flag = f => { if (!out.flags.includes(f)) out.flags.push(f); };
    const bw = num(session.bodyweightLb);

    for (const item of session.exercises || []) {
      const ex = item.exercise; if (!ex) continue;
      const sets = (item.sets || []).filter(s => num(s.reps) > 0);
      if (!sets.length) continue;
      out.counts.exercises++;
      const region = exerciseRegion(ex, muscleRegions);
      const conf = ex.classification ? ex.classification.confidence : ex.confidence;
      if (conf != null && conf < 0.6) flag('low-confidence-classification');
      const tested = num(item.oneRm && item.oneRm.tested), est = num(item.oneRm && item.oneRm.estimated);
      const oneRm = tested || est;
      if (!tested && est) flag('estimated-1rm-used');
      if (item.oneRm && item.oneRm.estimatedHighRep && !tested) flag('high-rep-1rm-estimate');
      let exVol = 0;

      for (const s of sets) {
        const reps = num(s.reps);
        const { load, flags } = externalLoad(s, ex, bw, item.unit);
        flags.forEach(flag);
        const rir = setRir(s);
        const cat = effortCategory(rir);
        out.effort[cat]++;
        const hard = isHard(rir);
        const pct = relativeIntensity(load, oneRm);
        const explosive = !!(ex.explosive || s.explosive);
        const heavyCompound = !!ex.compound && (pct != null ? pct >= RULES.highIntensityPct : (reps <= RULES.heavyNo1rmMaxReps && hard && load > 0));

        out.counts.sets++;
        out.counts.reps += reps;
        if (hard) out.counts.hardSets++;
        if (rir != null && rir <= RULES.nearFailureMaxRir) out.counts.nearFailureSets++;
        if (rir == null) { out.counts.unknownEffortSets++; flag('sets-without-rpe'); }
        if (pct != null && pct >= RULES.highIntensityPct) out.counts.highIntensitySets++;
        if (heavyCompound) out.counts.heavyCompoundSets++;
        if (explosive) out.counts.explosiveSets++;
        if (ex.axial) out.counts.axialSets++;
        if (heavyCompound || (explosive && ex.impact === 'high')) out.counts.highForceSets++;
        if (ex.impact === 'high') out.counts.highImpactContacts += reps * sides(ex);

        // muscle accounting: one set = one set per muscle, both sides of a unilateral set count once
        const primary = uniq(ex.primary), secondary = uniq(ex.secondary).filter(m => !primary.includes(m));
        for (const m of primary) { const t = mus(out, m); t.direct++; if (hard) t.hardDirect++; }
        for (const m of secondary) { const t = mus(out, m); t.indirect++; if (hard) t.hardIndirect++; }
        for (const reg of ['upper', 'lower', 'trunk']) {
          const pHit = primary.filter(m => muscleRegions[m] === reg), sHit = secondary.filter(m => muscleRegions[m] === reg);
          const R = out.regions[reg];
          if (pHit.length) { R.directSets++; if (hard) R.hardDirectSets++; }
          else if (sHit.length) { R.indirectOnlySets++; if (hard) R.hardIndirectOnlySets++; }
          R.directExposures += pHit.length; R.indirectExposures += sHit.length;
        }

        const v = load * reps * sides(ex);
        exVol += v;
      }
      exVol = r2(exVol);
      const comparable = ex.loadComparable !== false;
      if (!comparable) { out.volume.nonComparable += exVol; flag('non-comparable-load'); }
      else {
        out.volume.total += exVol;
        if (region === 'total-body') out.volume.totalBody += exVol; else out.volume[region] += exVol;
      }
      out.volume.byExercise.push({ id: ex.id, name: ex.name, region, volume: exVol, comparable, sets: sets.length });
    }
    for (const k of ['total', 'upper', 'lower', 'trunk', 'totalBody', 'nonComparable']) out.volume[k] = r2(out.volume[k]);
    if (out.session.rpe != null && out.session.durationMin != null) out.session.load = r2(out.session.rpe * out.session.durationMin);
    return out;
  }
  function blankRegion() { return { directSets: 0, hardDirectSets: 0, indirectOnlySets: 0, hardIndirectOnlySets: 0, directExposures: 0, indirectExposures: 0 }; }
  function mus(out, m) { return out.muscles[m] || (out.muscles[m] = { direct: 0, hardDirect: 0, indirect: 0, hardIndirect: 0 }); }
  function uniq(a) { return [...new Set(a || [])]; }
  // exercise region from its PRIMARY muscles: one region, or 'total-body' when it spans upper and lower
  function exerciseRegion(ex, regions) {
    const rs = new Set(uniq(ex.primary).map(m => regions[m]).filter(Boolean));
    if (rs.has('upper') && rs.has('lower')) return 'total-body';
    if (rs.has('upper')) return 'upper';
    if (rs.has('lower')) return 'lower';
    return 'trunk';
  }

  /* ---------- periods ---------- */
  // Sums analyses (from analyzeSession) whose date is within [from, to] inclusive.
  function aggregate(analyses, from, to) {
    const inRange = analyses.filter(a => a.date >= from && a.date <= to);
    const agg = { from, to, days: daysBetween(from, to) + 1, sessions: inRange.length, muscles: {}, regions: { upper: blankRegion(), lower: blankRegion(), trunk: blankRegion() },
      volume: { total: 0, upper: 0, lower: 0, trunk: 0, totalBody: 0, nonComparable: 0 }, counts: {}, sessionLoad: 0, sessionLoadDays: 0, durationMin: 0 };
    for (const a of inRange) {
      for (const [m, t] of Object.entries(a.muscles)) { const g = agg.muscles[m] || (agg.muscles[m] = { direct: 0, hardDirect: 0, indirect: 0, hardIndirect: 0 }); for (const k in t) g[k] += t[k]; }
      for (const reg of ['upper', 'lower', 'trunk']) for (const k in a.regions[reg]) agg.regions[reg][k] += a.regions[reg][k];
      for (const k in agg.volume) agg.volume[k] = r2(agg.volume[k] + (a.volume[k] || 0));
      for (const [k, v] of Object.entries(a.counts)) agg.counts[k] = (agg.counts[k] || 0) + v;
      if (a.session.load != null) { agg.sessionLoad += a.session.load; agg.sessionLoadDays++; }
      if (a.session.durationMin != null) agg.durationMin += a.session.durationMin;
    }
    agg.sessionLoad = r2(agg.sessionLoad);
    agg.weeks = r2(agg.days / 7);
    return agg;
  }
  function daysBetween(a, b) { const t = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); return Math.round((t(b) - t(a)) / 864e5); }
  function weekly(analyses, endDate, nWeeks) {
    const out = []; let ws = weekStart(endDate);
    for (let i = 0; i < nWeeks; i++) { out.unshift(aggregate(analyses, ws, addDays(ws, 6))); ws = addDays(ws, -7); }
    return out;
  }
  function rolling(analyses, endDate, days) { return aggregate(analyses, addDays(endDate, -(days - 1)), endDate); }
  function pctChange(now, prev) { return (prev > 0 && now != null) ? r2((now - prev) / prev * 100) : null; }

  /* ---------- experimental composite ---------- */
  // Lifting Workload Index (EXPERIMENTAL): weighted mean of z-scores of four
  // components against the athlete's own previous lifting days (28-day window).
  const COMPOSITE_COMPONENTS = {
    muscular: a => a.counts.hardSets,
    external: a => a.volume.total,
    internal: a => a.session.load,
    intensity: a => a.counts.highIntensitySets + a.counts.explosiveSets,
  };
  const DEFAULT_WEIGHTS = { muscular: 1, external: 1, internal: 1, intensity: 1 };
  function compositeIndex(analyses, date, weights) {
    const w = Object.assign({}, DEFAULT_WEIGHTS, weights || {});
    const today = analyses.find(a => a.date === date); if (!today) return null;
    const base = analyses.filter(a => a.date < date && a.date >= addDays(date, -RULES.compositeBaselineDays));
    const parts = {}; let num_ = 0, den = 0;
    for (const [k, f] of Object.entries(COMPOSITE_COMPONENTS)) {
      const x = f(today); const hist = base.map(f).filter(v => v != null);
      if (x == null || hist.length < RULES.compositeMinBaseline) { parts[k] = null; continue; }
      const s = sd(hist); if (!s) { parts[k] = null; continue; }
      const z = (x - mean(hist)) / s; parts[k] = r2(z);
      if (w[k] > 0) { num_ += w[k] * z; den += w[k]; }
    }
    const used = Object.values(parts).filter(v => v != null).length;
    return { value: used >= 2 && den ? r2(num_ / den) : null, components: parts, weights: w, baselineSessions: base.length, experimental: true };
  }

  /* ---------- documentation of every calculation ---------- */
  const REF = {
    foster2001: 'Foster C, Florhaug JA, Franklin J, et al. A new approach to monitoring exercise training. J Strength Cond Res. 2001;15(1):109-115.',
    mcguigan2004: 'McGuigan MR, Foster C. A new approach to monitoring resistance training. Strength Cond J. 2004;26(6):42-47.',
    zourdos2016: 'Zourdos MC, Klemp A, Dolan C, et al. Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. J Strength Cond Res. 2016;30(1):267-275.',
    helms2016: 'Helms ER, Cronin J, Storey A, Zourdos MC. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. Strength Cond J. 2016;38(4):42-49.',
    halperin2022: 'Halperin I, Malleron T, Har-Nir I, et al. Accuracy in predicting repetitions to task failure in resistance exercise: a scoping review and exploratory meta-analysis. Sports Med. 2022;52(2):377-390.',
    haff2010: 'Haff GG. Quantifying workloads in resistance training: a brief review. Prof Strength Cond. 2010;(19):31-40.',
    scott2016: 'Scott BR, Duthie GM, Thornton HR, Dascombe BJ. Training monitoring for resistance exercise: theory and applications. Sports Med. 2016;46(5):687-698.',
    schoenfeld2017: 'Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. J Sports Sci. 2017;35(11):1073-1082.',
    epley1985: 'Epley B. Poundage chart. In: Boyd Epley Workout. Lincoln, NE: Body Enterprises; 1985.',
    lesuer1997: 'LeSuer DA, McCormick JH, Mayhew JL, Wasserstein RL, Arnold MD. The accuracy of prediction equations for estimating 1-RM performance in the bench press, squat, and deadlift. J Strength Cond Res. 1997;11(4):211-213.',
    ebben2011: 'Ebben WP, Wurm B, VanderZanden TL, et al. Kinetic analysis of several variations of push-ups. J Strength Cond Res. 2011;25(10):2891-2894.',
    impellizzeri2019: 'Impellizzeri FM, Marcora SM, Coutts AJ. Internal and external training load: 15 years on. Int J Sports Physiol Perform. 2019;14(2):270-273.',
    impellizzeri2020: 'Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. Int J Sports Physiol Perform. 2020;15(6):907-913.',
    nsca2016: 'Haff GG, Triplett NT, eds. Essentials of Strength Training and Conditioning. 4th ed. Human Kinetics; 2016.',
  };
  const METHODS = [
    { id: 'hard-sets', name: 'Direct / indirect sets and hard sets per muscle', class: 'evidence-informed',
      formula: 'direct(m) = Σ sets where m ∈ primary(exercise); indirect(m) = Σ sets where m ∈ secondary(exercise); hard = set with estimated RIR ≤ 3',
      variables: 'primary/secondary muscles from the exercise classification; RIR from the set (or 10 − RPE)', units: 'sets (count)',
      rationale: 'Counting hard sets per muscle is the most widely used practical index of resistance-training volume and tracks the dose-response literature better than tonnage. Direct and indirect sets are kept as separate counts; no fractional credit is invented for secondary muscles.',
      limitations: 'A set count is not a measure of mechanical tension, activation or growth stimulus. Primary/secondary assignment is a classification convention. RIR is self-estimated and less accurate far from failure. Sets without RPE/RIR count as sets but never as hard sets. Both sides of a unilateral set count as one set.',
      references: [REF.schoenfeld2017, REF.helms2016, REF.halperin2022], validation: 'Not validated for this athlete. Counting rules are deterministic and unit-tested.' },
    { id: 'region', name: 'Upper-, lower-body and trunk workload', class: 'evidence-informed',
      formula: 'region sets = number of sets with ≥ 1 primary muscle in that region (each set counted once per region); exposures = Σ muscle-sets in that region',
      variables: 'muscle → region map (upper / lower / trunk)', units: 'sets; muscle-set exposures',
      rationale: 'Summaries count each set once, so a set that hits three upper-body muscles is one upper-body set, avoiding double counting. Exposure totals are shown separately and labelled as such.',
      limitations: 'A set can count toward more than one region (e.g. a carry). Region totals are not additive into a body total; the body total is the plain set count.', references: [REF.scott2016], validation: 'Convention; not validated.' },
    { id: 'volume-load', name: 'Volume load', class: 'established',
      formula: 'VL = Σ (external load × reps × sides); sides = 2 for unilateral exercises (reps entered per side), else 1',
      variables: 'load in lb (kg × 2.20462), reps, unilateral flag; bodyweight exercises add bwLoad × bodyweight', units: 'lb (tonnage)',
      rationale: 'Load × repetitions is the standard external-load measure in resistance training. Unilateral convention: the weight entered is the load moved on one side, reps are per side, and volume includes both sides.',
      limitations: 'Not comparable across mechanically different exercises; not a measure of work in joules or of physiological cost. Pneumatic (Keiser) loads are kept out of totals as non-comparable. Jumps and med-ball work with little external load contribute little volume and are tracked through explosive and impact counts instead.',
      references: [REF.haff2010, REF.scott2016], validation: 'Arithmetic is exact; interpretation limits as stated.' },
    { id: 'bodyweight-load', name: 'Bodyweight external-load convention', class: 'evidence-informed',
      formula: 'external load = added load + bwLoad × bodyweight (pull-up, chin-up, dip: 1.0; push-up: 0.64; others 0)',
      variables: 'same-day bodyweight (or most recent before it)', units: 'lb',
      rationale: 'Push-up ground-reaction force is about 64% of body mass in a standard push-up (Ebben et al. 2011). Pull-ups, chin-ups and dips move close to whole body mass.',
      limitations: 'Fractions vary with body proportions, hand position and technique. Core and jump drills are given 0 rather than a guessed fraction.', references: [REF.ebben2011], validation: 'Literature value for push-up; full-mass approximation for others.' },
    { id: 'relative-intensity', name: 'Relative intensity (% 1RM)', class: 'established',
      formula: '%1RM = working load ÷ 1RM × 100; uses the tested 1RM when entered, otherwise the best Epley estimate (flagged)',
      variables: 'load, tested or estimated 1RM per exercise', units: '% of 1RM',
      rationale: 'Expressing load relative to maximum is the standard way to compare intensity across sessions of the same exercise.',
      limitations: 'Only meaningful for the same exercise. Estimated 1RMs are approximations; tested 1RMs go out of date.', references: [REF.nsca2016], validation: 'Exact when a recent tested 1RM exists.' },
    { id: 'e1rm', name: 'Estimated 1RM (Epley, RIR-adjusted)', class: 'evidence-informed',
      formula: 'e1RM = load × (1 + (reps + RIR) / 30); RIR taken as 0 when unknown; a single rep at RIR 0 returns the load. For %1RM, the estimate uses only sessions BEFORE the day being scored (best value).',
      variables: 'load, reps, RIR (from RPE)', units: 'lb',
      rationale: 'A widely used prediction equation for tracking strength without max testing. Adding reps in reserve treats a sub-maximal set as the rep-max it implies, so a 5-rep set at RPE 8 is read as a 7-rep max. Using only earlier sessions keeps %1RM from being calculated from the very sets it is scoring.',
      limitations: 'Accuracy falls as effective reps rise; estimates above 10 effective reps are flagged. RIR is self-estimated. Not a physiological measurement and not used for explosive, pneumatic or bodyweight-based exercises.', references: [REF.epley1985, REF.lesuer1997, REF.helms2016], validation: 'Population equation; not validated for this athlete.' },
    { id: 'rpe-rir', name: 'RPE and RIR', class: 'established',
      formula: 'RIR = 10 − RPE (RPE 10 = 0 RIR … RPE 6 = 4 RIR; half points allowed). Categories: 0–1 very close to failure, 2–3 near failure, 4–5 moderate, 6+ lower effort',
      variables: 'set RPE and/or set RIR (an entered RIR takes priority)', units: 'RPE (0–10), RIR (reps)',
      rationale: 'The RIR-based RPE scale is the established resistance-training effort scale.',
      limitations: 'Self-reported; accuracy improves near failure and with experience. Categories are monitoring conventions, not biological thresholds. No nonlinear RPE multipliers are applied.', references: [REF.zourdos2016, REF.helms2016, REF.halperin2022], validation: 'Validated scale; athlete-specific accuracy unknown.' },
    { id: 'session-load', name: 'Session load (session-RPE)', class: 'established',
      formula: 'session load = session RPE (CR-10) × duration (min)', variables: 'session RPE collected about 30 minutes after training; session duration', units: 'arbitrary units (AU)',
      rationale: 'The session-RPE method is a validated, practical measure of perceived internal training load, including for resistance training.',
      limitations: 'Measures perceived internal load for the whole session; it does not isolate CNS or muscular fatigue. Ratings taken immediately after the last set tend to be biased.', references: [REF.foster2001, REF.mcguigan2004, REF.impellizzeri2019], validation: 'Validated method; not validated for this athlete.' },
    { id: 'exposures', name: 'High-intensity, heavy-compound, explosive, axial, high-force and impact exposure', class: 'evidence-informed',
      formula: 'high-intensity = sets ≥ 80% 1RM; heavy compound = compound exercise at ≥ 80% 1RM, or (no 1RM) ≤ 5 reps at RIR ≤ 3; explosive = exercise or set flagged explosive; axial = exercise flagged axial; high-force = heavy compound OR explosive high-impact; impact contacts = reps × sides of high-impact drills',
      variables: 'classification flags, %1RM, reps, RIR', units: 'sets; ground contacts',
      rationale: 'Counting exposures keeps distinct kinds of stress visible separately instead of merging them into one number.',
      limitations: 'Thresholds are monitoring conventions. These counts do not quantify CNS fatigue or neural demand; no neural coefficients are used.', references: [REF.nsca2016, REF.scott2016], validation: 'Convention; not validated.' },
    { id: 'rolling', name: 'Weekly and rolling 7 / 28-day totals', class: 'established',
      formula: 'weekly = Monday–Sunday sums; rolling N-day = sum over the N days ending on the selected date; weekly average = 28-day sum ÷ 4; change = (this week − last week) ÷ last week × 100',
      variables: 'any session measure above', units: 'as the measure',
      rationale: 'Simple sums and averages are transparent and comparable over time.',
      limitations: 'Acute:chronic workload ratios are deliberately not calculated because of their documented statistical problems.', references: [REF.impellizzeri2020], validation: 'Arithmetic.' },
    { id: 'composite', name: 'Lifting Workload Index', class: 'experimental',
      formula: 'LWI = Σ wᵢ·zᵢ ÷ Σ wᵢ, where zᵢ = (today − mean of previous lifting days in 28 days) ÷ SD, for: hard sets, volume load, session load, high-intensity + explosive sets',
      variables: 'four components, configurable weights (default equal); needs ≥ 6 previous lifting days per component', units: 'standard score (0 = his typical session)',
      rationale: 'A normalised summary of how today compares with his own recent training. Built from normalised measures, not physiological multipliers.',
      limitations: 'EXPERIMENTAL. Not a measure of fatigue or CNS stress. Equal weights are an assumption; weights should only change after his own data show a relationship with next-day soreness, readiness, recovery or throwing.', references: [REF.impellizzeri2019], validation: 'Not validated. Check relationships on the Insights page before relying on it.' },
  ];

  const api = { ENGINE_VERSION, RULES_VERSION, SPEC_VERSION, RULES, METHODS, REF, DEFAULT_WEIGHTS,
    rpeToRir, setRir, effortCategory, isHard, externalLoad, e1rmEpley, relativeIntensity, analyzeSession, exerciseRegion,
    aggregate, weekly, rolling, pctChange, compositeIndex, weekStart, addDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TritonWorkload = api;
})(typeof self !== 'undefined' ? self : this);
