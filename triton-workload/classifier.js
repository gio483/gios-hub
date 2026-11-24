/* Triton Workload — Exercise Classification Engine (component A)
   ------------------------------------------------------------------
   Turns an exercise name (+ optional description) into a classification
   record with a confidence level, a plain-English explanation, and
   clarifying questions when the context is not enough.

   Three sources, in order:
     1. Library match  — exact name/alias in TritonExerciseDB          (confidence = library value)
     2. Rule engine    — deterministic keyword rules (offline, instant) (confidence 0.30–0.85)
     3. AI-assisted    — optional: Claude via the hub endpoint, used for
                         names the rules cannot read with confidence  (confidence reported by the model, capped 0.85)

   The classification is an INTERPRETATION used to count sets per muscle.
   It never produces activation percentages or physiological coefficients.
   The deterministic maths lives in engine.js and never calls this file.
*/
(function (root) {
  'use strict';
  const DB = (typeof module !== 'undefined' && module.exports) ? require('./exercise-db.js') : root.TritonExerciseDB;
  const CLASSIFIER_VERSION = '1.0.0';

  const norm = s => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const slug = s => norm(s).replace(/ /g, '-').slice(0, 48) || 'exercise';

  /* name → library record (exact name or alias, normalised) */
  const INDEX = new Map();
  for (const ex of DB.LIBRARY) for (const n of [ex.name, ex.id.replace(/-/g, ' '), ...(ex.aliases || [])]) {
    const k = norm(n); if (k && !INDEX.has(k)) INDEX.set(k, ex);
  }
  function libraryMatch(name) { return INDEX.get(norm(name)) || null; }

  /* ---- deterministic keyword rules ---- */
  const has = (t, words) => words.some(w => new RegExp('(^| )' + w + '( |$)').test(t));
  const EQUIP_RULES = [
    ['trap-bar', ['trap bar', 'hex bar', 'trapbar']], ['barbell', ['bb', 'barbell', 'bar', 'zercher', 'safety bar', 'ssb']], ['dumbbell', ['db', 'dumbbell', 'dumbbells', 'dbs']],
    ['kettlebell', ['kb', 'kettlebell']], ['pneumatic', ['keiser']], ['landmine', ['landmine']], ['med-ball', ['med ball', 'medball', 'mb', 'medicine ball', 'slam ball']],
    ['cable', ['cable', 'pulley']], ['band', ['band', 'banded', 'mini band']], ['machine', ['machine', 'smith', 'leg press', 'ghd', 'ghr']], ['sled', ['sled', 'prowler']],
    ['box', ['box', 'depth']], ['rope', ['jump rope', 'rope']],
  ];
  // pattern → [keywords, category, primary, secondary, stabilizers, flags]
  const PATTERN_RULES = [
    ['landing', ['depth drop', 'drop landing', 'snap down', 'stick landing'], 'plyometric', ['quads', 'glutes'], ['calves', 'hamstrings'], ['abs'], { explosive: true, impact: 'high', contraction: 'eccentric' }],
    ['jump', ['jump', 'jumps', 'hop', 'hops', 'bound', 'bounds', 'pogo', 'pogos', 'skip', 'skips', 'cmj', 'leap'], 'plyometric', ['quads', 'glutes', 'calves'], ['hamstrings'], ['abs'], { explosive: true, impact: 'high', contraction: 'stretch-shortening' }],
    ['throw', ['throw', 'toss', 'slam', 'pass', 'shotput', 'shot put', 'scoop'], 'ballistic', ['abs', 'glutes'], ['lats', 'frontDelt', 'triceps'], ['quads'], { explosive: true }],
    ['olympic', ['clean', 'snatch', 'jerk', 'high pull'], 'power', ['glutes', 'quads', 'hamstrings', 'upperBack'], ['erectors', 'calves', 'forearms'], ['abs'], { explosive: true, axial: true, compound: true }],
    // specific shoulder rules must win over the generic "rotation" rule below
    ['shoulder-rotation', ['external rotation', 'internal rotation', 'external rotations', 'internal rotations', 'er', 'ir', '90 90', 'sleeper stretch'], 'arm-care', ['rotatorCuff'], ['rearDelt'], ['upperBack'], {}],
    ['scapular', ['face pull', 'ytw', 'y raise', 't raise', 'w raise', 'scap', 'scapular', 'band pull apart', 'pull apart', 'serratus'], 'arm-care', ['upperBack', 'rearDelt', 'rotatorCuff'], [], [], {}],
    ['carry', ['sled push', 'sled drag', 'sled pull', 'prowler', 'prowler push'], 'carry', ['quads', 'glutes'], ['calves', 'hamstrings'], ['abs'], { compound: true }],
    ['rotation', ['rotational', 'rotation', 'chop', 'lift', 'woodchop', 'twist', 'punch'], 'power', ['abs'], ['glutes', 'frontDelt', 'lats'], ['adductors'], { compound: true }],
    ['anti-rotation', ['pallof', 'anti rotation', 'side plank', 'suitcase'], 'core', ['abs'], [], ['glutes'], { contraction: 'isometric' }],
    ['anti-extension', ['plank', 'dead bug', 'deadbug', 'rollout', 'stir the pot', 'hollow', 'body saw'], 'core', ['abs'], [], ['frontDelt', 'glutes'], { contraction: 'isometric' }],
    ['trunk-flexion', ['crunch', 'sit up', 'situp', 'leg raise', 'leg raises', 'knee raise', 'flutter', 'v up', 'toes to bar'], 'core', ['abs', 'hipFlexors'], [], [], {}],
    ['carry', ['carry', 'walk', 'farmer', 'farmers'], 'carry', ['forearms', 'upperBack'], ['abs', 'glutes'], ['calves'], { contraction: 'isometric', compound: true }],
    ['single-leg', ['split squat', 'rfess', 'bulgarian', 'lunge', 'lunges', 'step up', 'step ups', 'step down', 'step downs', 'cossack', 'pistol', 'skater squat'], 'strength', ['quads', 'glutes'], ['adductors', 'hamstrings'], ['abs', 'calves'], { unilateral: true, compound: true }],
    ['squat', ['squat', 'squats', 'leg press', 'wall sit'], 'strength', ['quads', 'glutes'], ['adductors', 'erectors'], ['abs'], { compound: true }],
    ['hinge', ['deadlift', 'dl', 'rdl', 'good morning', 'swing', 'swings', 'hip thrust', 'bridge', 'pull through', 'hinge', 'back extension', 'hyperextension'], 'strength', ['hamstrings', 'glutes'], ['erectors', 'forearms'], ['abs'], { compound: true }],
    ['vertical-pull', ['pull up', 'pull ups', 'pullup', 'pullups', 'chin up', 'chin ups', 'chinup', 'pulldown', 'pull down'], 'strength', ['lats'], ['biceps', 'upperBack', 'rearDelt', 'forearms'], ['abs'], { compound: true }],
    ['horizontal-pull', ['row', 'rows', 'inverted row'], 'strength', ['upperBack', 'lats'], ['biceps', 'rearDelt', 'forearms'], ['abs'], { compound: true }],
    ['vertical-push', ['overhead press', 'shoulder press', 'military press', 'ohp', 'push press', 'landmine press', 'z press'], 'strength', ['frontDelt', 'triceps'], ['sideDelt', 'upperBack', 'serratus'], ['abs', 'rotatorCuff'], { compound: true }],
    ['horizontal-push', ['bench', 'push up', 'push ups', 'pushup', 'pushups', 'press', 'dip', 'dips', 'fly', 'flye'], 'strength', ['chest', 'triceps'], ['frontDelt'], ['rotatorCuff', 'abs'], { compound: true }],
    ['isolation-upper', ['curl', 'curls', 'extension', 'pushdown', 'skull', 'lateral raise', 'front raise', 'rear delt', 'shrug', 'wrist', 'rice bucket', 'grip'], 'accessory', [], [], [], {}],
    ['isolation-lower', ['leg curl', 'hamstring curl', 'nordic', 'leg extension', 'calf raise', 'adductor', 'abductor', 'copenhagen', 'tib raise'], 'accessory', [], [], [], {}],
  ];
  const ISOLATION_MUSCLE = [
    [['curl', 'curls'], 'biceps', ['forearms']], [['extension', 'pushdown', 'skull'], 'triceps', []],
    [['lateral raise'], 'sideDelt', []], [['front raise'], 'frontDelt', []], [['rear delt', 'reverse fly'], 'rearDelt', ['upperBack']],
    [['shrug'], 'upperBack', ['forearms']], [['wrist', 'rice bucket', 'grip', 'pronation', 'supination'], 'forearms', []],
    [['leg curl', 'hamstring curl', 'nordic'], 'hamstrings', ['calves']], [['leg extension'], 'quads', []],
    [['calf raise'], 'calves', []], [['adductor', 'copenhagen'], 'adductors', ['abs']], [['abductor'], 'glutes', []], [['tib raise'], 'calves', []],
  ];

  function ruleClassify(name, description) {
    const t = norm(name + ' ' + (description || ''));
    const why = [], questions = [];
    let signals = 0;
    const rec = { pattern: null, category: 'strength', primary: [], secondary: [], stabilizers: [], equipment: null,
      unilateral: false, axial: false, explosive: false, compound: false, impact: 'none', contraction: 'dynamic',
      rom: 'full', stability: 'stable', bwLoad: 0, loadComparable: true };

    const pat = PATTERN_RULES.find(p => has(t, p[1]));
    if (pat) {
      const [pattern, , category, pri, sec, stab, flags] = pat;
      Object.assign(rec, { pattern, category, primary: pri.slice(), secondary: sec.slice(), stabilizers: stab.slice() }, flags);
      why.push(`Movement pattern "${pattern}" from the word(s): ${pat[1].filter(w => has(t, [w])).join(', ')}.`);
      signals += 2;
      if (pattern.startsWith('isolation')) {
        const iso = ISOLATION_MUSCLE.find(m => has(t, m[0]));
        if (iso) { rec.primary = [iso[1]]; rec.secondary = iso[2].slice(); why.push(`Isolation target ${iso[1]} from "${iso[0].find(w => has(t, [w]))}".`); signals++; }
        else questions.push('Which muscle does this exercise mainly target?');
      }
    } else {
      questions.push('What kind of movement is this (squat, hinge, lunge, push, pull, jump, throw, rotation, core, carry)?');
      why.push('No movement-pattern keyword recognised.');
    }

    const eq = EQUIP_RULES.find(e => has(t, e[1]));
    if (eq) { rec.equipment = eq[0]; why.push(`Equipment "${eq[0]}" from "${eq[1].find(w => has(t, [w]))}".`); signals++; }
    else if (/(^| )(jump|hop|bound|push up|pull up|chin up|plank|dip)/.test(t)) { rec.equipment = 'bodyweight'; why.push('No equipment word: assumed bodyweight.'); }
    else { rec.equipment = 'other'; questions.push('What equipment is used (barbell, dumbbell, kettlebell, cable, Keiser, med ball, bodyweight)?'); }

    if (has(t, ['single leg', 'sl', 'single arm', 'sa', 'one arm', '1 arm', 'one leg', 'unilateral', 'alternating', 'split'])) { rec.unilateral = true; why.push('Unilateral: name says single-arm/single-leg/split.'); signals++; }
    if (has(t, ['explosive', 'speed', 'power', 'ballistic', 'plyo', 'plyometric', 'clap', 'reactive', 'velocity'])) { rec.explosive = true; why.push('Explosive intent from the name.'); signals++; }
    if (rec.equipment === 'pneumatic') { rec.loadComparable = false; rec.contraction = 'concentric'; why.push('Pneumatic (Keiser) resistance: little eccentric load; volume not comparable with free weights.'); }
    if (['barbell', 'trap-bar'].includes(rec.equipment) && ['squat', 'hinge', 'single-leg', 'olympic', 'vertical-push', 'carry'].includes(rec.pattern)) { rec.axial = true; why.push('Axial loading: barbell/trap bar on a squat, hinge, lunge, overhead or carry pattern.'); }
    if (rec.pattern === 'hinge' && !['bodyweight', 'band'].includes(rec.equipment)) rec.axial = true;
    if (rec.unilateral) { rec.stability = 'unstable'; if (!rec.stabilizers.includes('abs')) rec.stabilizers.push('abs'); }
    if (rec.pattern === 'horizontal-push' && has(t, ['push up', 'push ups', 'pushup', 'pushups'])) { rec.bwLoad = 0.64; rec.equipment = 'bodyweight'; why.push('Push-up external-load convention 64% bodyweight (Ebben et al., 2011).'); }
    if (rec.pattern === 'vertical-pull' && rec.equipment === 'bodyweight') { rec.bwLoad = 1; why.push('Pull-up/chin-up convention: full bodyweight + added load.'); }
    if (has(t, ['dip', 'dips'])) { rec.bwLoad = 1; rec.equipment = 'bodyweight'; why.push('Dip convention: full bodyweight + added load.'); }
    if (rec.pattern === 'rotation' && !rec.explosive) questions.push('Was this performed with explosive intent?');
    if (['horizontal-pull', 'vertical-push', 'horizontal-push'].includes(rec.pattern) && !rec.unilateral && has(t, ['db', 'dumbbell', 'landmine', 'kb'])) questions.push('One arm at a time, or both arms together?');
    rec.compound = rec.compound || (rec.primary.length + rec.secondary.length >= 3);

    const confidence = Math.min(0.85, 0.25 + signals * 0.12) * (rec.pattern ? 1 : 0.6);
    return { record: rec, confidence: Math.round(confidence * 100) / 100, explanation: why, questions };
  }

  /* Best library neighbour by shared words (used to explain, never to silently relabel). */
  function nearest(name) {
    const words = new Set(norm(name).split(' ').filter(w => w.length > 1));
    let best = null, score = 0;
    for (const ex of DB.LIBRARY) for (const n of [ex.name, ...(ex.aliases || [])]) {
      const w = norm(n).split(' '); const hit = w.filter(x => words.has(x)).length;
      const s = hit / Math.max(words.size, w.length);
      if (s > score) { score = s; best = ex; }
    }
    return score >= 0.5 ? { ex: best, score } : null;
  }

  /* Build a full exercise record (schema.json → ExerciseRecord). */
  function newRecord(name, cls, source, extra) {
    const now = new Date().toISOString();
    const r = Object.assign({
      id: 'u-' + slug(name), name: String(name).trim(), aliases: [],
    }, cls.record, {
      classification: { confidence: cls.confidence, source, classifierVersion: CLASSIFIER_VERSION, explanation: cls.explanation, questions: cls.questions },
      auto: null, overridden: [], created: now, modified: now, history: [],
    }, extra || {});
    r.auto = JSON.parse(JSON.stringify({ ...cls.record, confidence: cls.confidence, source, explanation: cls.explanation, questions: cls.questions, at: now }));
    r.history.push({ at: now, by: source, action: 'created', snapshot: r.auto });
    return r;
  }

  /* Main entry: offline, deterministic. */
  function classify(name, description) {
    const lib = libraryMatch(name);
    if (lib) {
      const { id, name: n, aliases, confidence, questions, notes, ...rest } = lib;
      return { record: rest, confidence, explanation: [`Matched the curated library entry "${n}".`].concat(notes ? [notes] : []), questions: questions || [], libraryId: id, source: 'library' };
    }
    const r = ruleClassify(name, description);
    const nn = nearest(name);
    if (nn) r.explanation.push(`Closest library exercise: "${nn.ex.name}" (${Math.round(nn.score * 100)}% word overlap).`);
    r.source = 'rules';
    return r;
  }

  /* Optional AI step: POST to the hub, which asks Claude with a strict JSON schema. */
  async function classifyAI(name, description, endpoint) {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'classify', name, description: description || '', muscles: DB.MUSCLES.map(m => m.id), patterns: DB.PATTERNS, categories: DB.CATEGORIES, equipment: DB.EQUIPMENT }) });
    if (!res.ok) throw new Error('classify ' + res.status);
    const j = await res.json();
    if (!j.classification) throw new Error(j.error || 'no classification');
    const c = j.classification;
    const muscles = new Set(DB.MUSCLES.map(m => m.id));
    const clean = a => (a || []).filter(m => muscles.has(m));
    const rec = { pattern: c.pattern, category: c.category, primary: clean(c.primary), secondary: clean(c.secondary), stabilizers: clean(c.stabilizers),
      equipment: c.equipment, unilateral: !!c.unilateral, axial: !!c.axial, explosive: !!c.explosive, compound: !!c.compound, impact: c.impact,
      contraction: c.contraction, rom: c.rom, stability: c.stability, bwLoad: Math.max(0, Math.min(1, +c.bwLoad || 0)), loadComparable: c.loadComparable !== false };
    return { record: rec, confidence: Math.min(0.85, Math.max(0, +c.confidence || 0.5)), explanation: [String(c.explanation || '')], questions: (c.questions || []).slice(0, 3), source: 'ai:' + (j.model || 'claude') };
  }

  const api = { CLASSIFIER_VERSION, classify, classifyAI, ruleClassify, libraryMatch, newRecord, norm, slug };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TritonClassifier = api;
})(typeof self !== 'undefined' ? self : this);
