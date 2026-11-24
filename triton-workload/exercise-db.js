/* Triton Workload — Exercise Database (component B)
   ------------------------------------------------------------------
   Curated library of exercise classifications. Plain data, no logic, so it
   can be reused by any project (window.TritonExerciseDB or module.exports).

   Every library record is a classification CONVENTION (a coaching/biomechanics
   judgement about which muscles are primary, secondary or stabilisers), not a
   measured activation value. No fractional muscle coefficients are stored.

   Record fields (see schema.json → ExerciseRecord):
     id, name, aliases, pattern, category, primary, secondary, stabilizers,
     equipment, unilateral, axial, explosive, contraction, rom, stability,
     compound, impact, bwLoad, loadComparable, confidence, notes, questions
*/
(function (root) {
  'use strict';

  const DB_VERSION = '1.0.0';

  /* Muscle groups. region drives upper/lower/trunk summaries.
     `extra: true` = additional group beyond the spec's required list. */
  const MUSCLES = [
    { id: 'chest',       label: 'Chest',           region: 'upper' },
    { id: 'upperBack',   label: 'Upper back',      region: 'upper' },
    { id: 'lats',        label: 'Lats',            region: 'upper' },
    { id: 'frontDelt',   label: 'Front deltoids',  region: 'upper' },
    { id: 'sideDelt',    label: 'Side deltoids',   region: 'upper' },
    { id: 'rearDelt',    label: 'Rear deltoids',   region: 'upper' },
    { id: 'biceps',      label: 'Biceps',          region: 'upper' },
    { id: 'triceps',     label: 'Triceps',         region: 'upper' },
    { id: 'forearms',    label: 'Forearms / grip', region: 'upper' },
    { id: 'rotatorCuff', label: 'Rotator cuff',    region: 'upper' },
    { id: 'quads',       label: 'Quads',           region: 'lower' },
    { id: 'hamstrings',  label: 'Hamstrings',      region: 'lower' },
    { id: 'glutes',      label: 'Glutes',          region: 'lower' },
    { id: 'adductors',   label: 'Adductors',       region: 'lower' },
    { id: 'calves',      label: 'Calves',          region: 'lower' },
    { id: 'erectors',    label: 'Spinal erectors', region: 'trunk' },
    { id: 'abs',         label: 'Abdominals (incl. obliques)', region: 'trunk' },
    { id: 'hipFlexors',  label: 'Hip flexors',     region: 'lower', extra: true },
    { id: 'serratus',    label: 'Serratus anterior', region: 'upper', extra: true },
  ];

  const PATTERNS = ['squat', 'hinge', 'single-leg', 'horizontal-push', 'vertical-push', 'horizontal-pull', 'vertical-pull',
    'rotation', 'anti-rotation', 'anti-extension', 'trunk-flexion', 'carry', 'jump', 'landing', 'throw', 'olympic',
    'shoulder-rotation', 'scapular', 'isolation-upper', 'isolation-lower', 'total-body'];
  const CATEGORIES = ['strength', 'power', 'plyometric', 'ballistic', 'accessory', 'core', 'arm-care', 'carry'];
  const EQUIPMENT = ['barbell', 'trap-bar', 'dumbbell', 'kettlebell', 'cable', 'band', 'machine', 'pneumatic', 'landmine',
    'med-ball', 'bodyweight', 'box', 'rope', 'sled', 'other'];

  /* Compact row → record. Order:
     id, name, aliases, pattern, category, primary, secondary, stabilizers, equipment,
     flags string, contraction, extra {}
     flags: U unilateral, A axial, X explosive, C compound, I impact(high), i impact(low) */
  const R = (id, name, aliases, pattern, category, primary, secondary, stabilizers, equipment, flags, contraction, extra) => Object.assign({
    id, name, aliases, pattern, category, primary, secondary, stabilizers, equipment,
    unilateral: flags.includes('U'), axial: flags.includes('A'), explosive: flags.includes('X'),
    compound: flags.includes('C'), impact: flags.includes('I') ? 'high' : flags.includes('i') ? 'low' : 'none',
    contraction: contraction || 'dynamic', rom: 'full', stability: 'stable',
    bwLoad: 0, loadComparable: true, confidence: 0.9, notes: '', questions: [],
  }, extra || {});

  const LIBRARY = [
    /* ---- lower-body strength ---- */
    R('back-squat', 'Back Squat', ['squat', 'bb squat', 'barbell squat', 'barbell back squat'], 'squat', 'strength', ['quads', 'glutes'], ['adductors', 'erectors'], ['abs', 'hamstrings'], 'barbell', 'AC'),
    R('front-squat', 'Front Squat', ['bb front squat'], 'squat', 'strength', ['quads', 'glutes'], ['erectors', 'upperBack', 'adductors'], ['abs'], 'barbell', 'AC'),
    R('goblet-squat', 'Goblet Squat', ['db goblet squat', 'kb goblet squat'], 'squat', 'strength', ['quads', 'glutes'], ['adductors'], ['abs', 'upperBack'], 'dumbbell', 'C'),
    R('trap-bar-deadlift', 'Trap Bar Deadlift', ['trap bar dl', 'hex bar deadlift', 'tbdl', 'trapbar deadlift'], 'hinge', 'strength', ['quads', 'glutes'], ['hamstrings', 'erectors', 'upperBack', 'forearms'], ['abs'], 'trap-bar', 'AC'),
    R('deadlift', 'Deadlift', ['conventional deadlift', 'bb deadlift', 'barbell deadlift'], 'hinge', 'strength', ['glutes', 'hamstrings', 'erectors'], ['quads', 'upperBack', 'lats', 'forearms', 'adductors'], ['abs'], 'barbell', 'AC'),
    R('rdl', 'Romanian Deadlift', ['rdl', 'bb rdl', 'barbell rdl', 'db rdl', 'romanian dl'], 'hinge', 'strength', ['hamstrings', 'glutes'], ['erectors', 'forearms', 'upperBack'], ['abs'], 'barbell', 'AC'),
    R('sl-rdl', 'Single-Leg RDL', ['single leg rdl', 'sl rdl', 'single leg bb rdl', 'single-leg bb rdl', 'single leg db rdl', 'sl db rdl', 'sl bb rdl', 'single leg romanian deadlift', 'b-stance rdl'], 'hinge', 'strength', ['hamstrings', 'glutes'], ['erectors', 'adductors'], ['abs', 'calves', 'forearms'], 'barbell', 'UAC', null, { stability: 'unstable', notes: 'Barbell or dumbbell; axial = loaded hip hinge.' }),
    R('rfess', 'Rear-Foot-Elevated Split Squat', ['rfess', 'bulgarian split squat', 'db rfess', 'dumbbell rfess', 'bss', 'db bulgarian split squat'], 'single-leg', 'strength', ['quads', 'glutes'], ['adductors', 'hamstrings'], ['abs', 'calves'], 'dumbbell', 'UC', null, { stability: 'unstable' }),
    R('bb-rfess', 'Barbell RFESS', ['barbell rfess', 'bb rfess', 'barbell bulgarian split squat', 'bb bulgarian split squat'], 'single-leg', 'strength', ['quads', 'glutes'], ['adductors', 'hamstrings', 'erectors'], ['abs', 'calves'], 'barbell', 'UAC', null, { stability: 'unstable' }),
    R('split-squat', 'Split Squat', ['db split squat', 'bb split squat', 'barbell split squat'], 'single-leg', 'strength', ['quads', 'glutes'], ['adductors', 'hamstrings'], ['abs'], 'dumbbell', 'UC'),
    R('reverse-lunge', 'Reverse Lunge', ['db reverse lunge', 'bb reverse lunge', 'lunge', 'walking lunge', 'db walking lunge'], 'single-leg', 'strength', ['quads', 'glutes'], ['adductors', 'hamstrings'], ['abs', 'calves'], 'dumbbell', 'UC'),
    R('lateral-lunge', 'Lateral Lunge', ['db lateral lunge', 'goblet lateral lunge', 'side lunge', 'cossack squat'], 'single-leg', 'strength', ['adductors', 'glutes', 'quads'], ['hamstrings'], ['abs'], 'dumbbell', 'UC'),
    R('bb-lateral-lunge', 'Barbell Lateral Lunge', ['bb lateral lunge', 'barbell lateral lunge'], 'single-leg', 'strength', ['adductors', 'glutes', 'quads'], ['hamstrings', 'erectors'], ['abs'], 'barbell', 'UAC'),
    R('step-up', 'Step-Up', ['db step up', 'step up', 'bb step up'], 'single-leg', 'strength', ['quads', 'glutes'], ['hamstrings', 'calves'], ['abs'], 'dumbbell', 'UC'),
    R('hip-thrust', 'Hip Thrust', ['bb hip thrust', 'barbell hip thrust', 'glute bridge', 'hip bridge'], 'hinge', 'strength', ['glutes'], ['hamstrings', 'adductors'], ['abs'], 'barbell', 'C'),
    R('nordic-curl', 'Nordic Hamstring Curl', ['nordic', 'nordics', 'nordic curl', 'nordic hamstring'], 'isolation-lower', 'accessory', ['hamstrings'], ['calves'], ['glutes', 'abs'], 'bodyweight', '', 'eccentric', { notes: 'Bodyweight; external load not quantified (convention: 0 + added load).' }),
    R('ghr', 'Glute-Ham Raise', ['glute ham raise', 'ghr', 'ghd raise'], 'isolation-lower', 'accessory', ['hamstrings'], ['glutes', 'calves'], ['erectors'], 'machine', ''),
    R('leg-curl', 'Leg Curl', ['hamstring curl', 'lying leg curl', 'seated leg curl'], 'isolation-lower', 'accessory', ['hamstrings'], ['calves'], [], 'machine', ''),
    R('calf-raise', 'Calf Raise', ['standing calf raise', 'single leg calf raise', 'seated calf raise'], 'isolation-lower', 'accessory', ['calves'], [], [], 'machine', ''),
    R('copenhagen', 'Copenhagen Plank', ['copenhagen', 'copenhagen adduction', 'copenhagen side plank'], 'anti-rotation', 'core', ['adductors'], ['abs'], ['glutes'], 'bodyweight', 'U', 'isometric'),

    /* ---- jumps, landings, plyometrics ---- */
    R('box-jump', 'Box Jump', ['box jumps'], 'jump', 'plyometric', ['quads', 'glutes', 'calves'], ['hamstrings'], ['abs'], 'box', 'Xi', 'stretch-shortening'),
    R('broad-jump', 'Broad Jump', ['standing broad jump', 'long jump'], 'jump', 'plyometric', ['glutes', 'quads', 'hamstrings'], ['calves'], ['abs'], 'bodyweight', 'XI', 'stretch-shortening'),
    R('cmj', 'Countermovement Jump', ['cmj', 'vertical jump', 'squat jump', 'vert jump'], 'jump', 'plyometric', ['quads', 'glutes', 'calves'], ['hamstrings'], ['abs'], 'bodyweight', 'Xi', 'stretch-shortening'),
    R('sl-cmj', 'Single-Leg CMJ', ['single leg cmj', 'sl cmj', 'single leg vertical jump', 'single leg countermovement jump'], 'jump', 'plyometric', ['quads', 'glutes', 'calves'], ['hamstrings', 'adductors'], ['abs'], 'bodyweight', 'UXI', 'stretch-shortening', { stability: 'unstable' }),
    R('depth-drop', 'Depth Drop', ['drop landing', 'depth drop', 'drop land', 'snap down'], 'landing', 'plyometric', ['quads', 'glutes'], ['calves', 'hamstrings'], ['abs', 'adductors'], 'box', 'XI', 'eccentric', { notes: 'Landing/absorption drill: high impact, eccentric. Counted as explosive (high-intent) exposure.' }),
    R('sl-depth-drop', 'Single-Leg Depth Drop', ['single leg depth drop', 'sl depth drop', 'single leg drop landing'], 'landing', 'plyometric', ['quads', 'glutes'], ['calves', 'hamstrings', 'adductors'], ['abs'], 'box', 'UXI', 'eccentric', { stability: 'unstable' }),
    R('depth-jump', 'Depth Jump', ['depth drop to cmj', 'depth drop to jump', 'depth drop to vertical', 'drop jump', 'depth jump'], 'jump', 'plyometric', ['quads', 'glutes', 'calves'], ['hamstrings'], ['abs'], 'box', 'XI', 'stretch-shortening'),
    R('sl-depth-jump', 'Single-Leg Depth Drop to CMJ', ['single leg depth drop to cmj', 'sl depth drop to cmj', 'single leg depth jump', 'sl depth jump'], 'jump', 'plyometric', ['quads', 'glutes', 'calves'], ['hamstrings', 'adductors'], ['abs'], 'box', 'UXI', 'stretch-shortening', { stability: 'unstable' }),
    R('depth-broad', 'Depth Drop to Broad Jump', ['depth drop to broad jump', 'depth drop broad jump', 'drop to broad jump'], 'jump', 'plyometric', ['glutes', 'quads', 'hamstrings'], ['calves'], ['abs'], 'box', 'XI', 'stretch-shortening'),
    R('sl-depth-broad', 'Single-Leg Depth Drop to Broad Jump', ['single leg depth drop to broad jump', 'sl depth drop to broad jump', 'single leg depth broad jump'], 'jump', 'plyometric', ['glutes', 'quads', 'hamstrings'], ['calves', 'adductors'], ['abs'], 'box', 'UXI', 'stretch-shortening', { stability: 'unstable' }),
    R('jump-rope', 'Jump Rope', ['skipping rope', 'jump rope'], 'jump', 'plyometric', ['calves'], ['quads'], [], 'rope', 'i', 'stretch-shortening', { notes: 'Low-intensity reactive; not counted as explosive by default.' }),
    R('sl-jump-rope', 'Single-Leg Jump Rope', ['single leg jump rope', 'sl jump rope'], 'jump', 'plyometric', ['calves'], ['quads', 'glutes'], ['adductors'], 'rope', 'Ui', 'stretch-shortening', { notes: 'Low-intensity reactive; not counted as explosive by default.' }),
    R('hurdle-hop', 'Hurdle Hops', ['hurdle hop', 'pogo hops', 'pogos', 'ankle hops'], 'jump', 'plyometric', ['calves', 'quads'], ['glutes'], [], 'bodyweight', 'Xi', 'stretch-shortening'),
    R('skater-bound', 'Lateral Bound', ['skater bound', 'skater jump', 'lateral bounds', 'heiden'], 'jump', 'plyometric', ['glutes', 'quads', 'adductors'], ['calves', 'hamstrings'], ['abs'], 'bodyweight', 'UXI', 'stretch-shortening'),
    R('trap-bar-jump', 'Trap Bar Jump', ['trap bar jumps', 'hex bar jump'], 'jump', 'power', ['quads', 'glutes'], ['calves', 'hamstrings', 'upperBack'], ['abs'], 'trap-bar', 'AXIC', 'stretch-shortening'),
    R('kb-swing', 'Kettlebell Swing', ['kb swing', 'kettlebell swings', 'russian swing'], 'hinge', 'ballistic', ['glutes', 'hamstrings'], ['erectors', 'forearms'], ['abs', 'upperBack'], 'kettlebell', 'XC'),
    R('power-clean', 'Power Clean', ['hang clean', 'hang power clean', 'clean', 'pc'], 'olympic', 'power', ['glutes', 'quads', 'hamstrings', 'upperBack'], ['erectors', 'calves', 'forearms'], ['abs'], 'barbell', 'AXC'),

    /* ---- med ball (ballistic) ---- */
    R('mb-rotational-throw', 'Rotational Med Ball Throw', ['med ball rotational throw', 'rotational med ball throw', 'mb rotational throw', 'scoop toss', 'mb scoop toss', 'shotput', 'med ball shot put', 'rotational scoop toss'], 'rotation', 'ballistic', ['abs', 'glutes'], ['adductors', 'frontDelt', 'lats', 'chest'], ['quads'], 'med-ball', 'XC'),
    R('mb-overhead-throw', 'Overhead Med Ball Throw', ['overhead medball throw', 'overhead med ball throw', 'mb overhead throw', 'soccer throw', 'overhead mb throw'], 'throw', 'ballistic', ['lats', 'abs'], ['triceps', 'chest', 'frontDelt'], ['glutes', 'serratus'], 'med-ball', 'XC'),
    R('mb-backward-toss', 'Backward Overhead Med Ball Toss', ['backwards overhead medball toss', 'backward overhead toss', 'backwards overhead toss', 'reverse overhead throw', 'backward overhead med ball throw', 'mb backward toss'], 'throw', 'ballistic', ['glutes', 'hamstrings'], ['quads', 'erectors', 'calves', 'frontDelt'], ['abs', 'upperBack'], 'med-ball', 'XC'),
    R('mb-slam', 'Med Ball Slam', ['ball slam', 'mb slam', 'slam ball', 'slams'], 'throw', 'ballistic', ['lats', 'abs'], ['triceps', 'glutes'], ['frontDelt'], 'med-ball', 'XC'),
    R('mb-chest-pass', 'Med Ball Chest Pass', ['chest pass', 'mb chest pass', 'med ball chest throw'], 'horizontal-push', 'ballistic', ['chest', 'triceps'], ['frontDelt'], ['abs'], 'med-ball', 'X'),

    /* ---- upper-body push ---- */
    R('bench-press', 'Bench Press', ['bench', 'bb bench', 'barbell bench press', 'flat bench'], 'horizontal-push', 'strength', ['chest', 'triceps'], ['frontDelt'], ['rotatorCuff'], 'barbell', 'C'),
    R('db-bench', 'Dumbbell Bench Press', ['db bench', 'db bench press', 'dumbbell bench'], 'horizontal-push', 'strength', ['chest', 'triceps'], ['frontDelt'], ['rotatorCuff'], 'dumbbell', 'C'),
    R('sa-db-bench', 'Single-Arm DB Bench Press', ['single arm db bench', 'single arm db bench press', 'single-arm db bench', '1 arm db bench', 'one arm db bench', 'sa db bench'], 'horizontal-push', 'strength', ['chest', 'triceps'], ['frontDelt'], ['abs', 'rotatorCuff'], 'dumbbell', 'UC'),
    R('incline-db-press', 'Incline DB Press', ['incline db bench', 'incline dumbbell press', 'incline press'], 'horizontal-push', 'strength', ['chest', 'frontDelt'], ['triceps'], ['rotatorCuff'], 'dumbbell', 'C'),
    R('landmine-press', 'Landmine Press', ['half kneeling landmine press', 'single arm landmine press', 'landmine shoulder press', 'tall kneeling landmine press'], 'vertical-push', 'strength', ['frontDelt', 'chest'], ['triceps', 'serratus'], ['abs', 'rotatorCuff'], 'landmine', 'UC', null, { confidence: 0.8, questions: ['Is this done one arm at a time (unilateral)?'] }),
    R('landmine-rot-press', 'Landmine Rotational Press', ['landmine rotational press', 'landmine punch', 'rotational landmine press', 'landmine rotational punch'], 'rotation', 'power', ['abs', 'glutes', 'frontDelt'], ['chest', 'triceps', 'quads'], ['adductors'], 'landmine', 'UXC', null, { confidence: 0.75, questions: ['Is this performed with explosive intent?'] }),
    R('overhead-press', 'Overhead Press', ['ohp', 'military press', 'standing press', 'db shoulder press', 'shoulder press'], 'vertical-push', 'strength', ['frontDelt', 'triceps'], ['sideDelt', 'upperBack'], ['abs', 'rotatorCuff'], 'barbell', 'AC'),
    R('push-up', 'Push-Up', ['push up', 'pushups', 'push-ups'], 'horizontal-push', 'strength', ['chest', 'triceps'], ['frontDelt'], ['abs', 'serratus'], 'bodyweight', 'C', null, { bwLoad: 0.64, notes: 'External-load convention: 64% of bodyweight (Ebben et al., 2011).' }),
    R('plyo-push-up', 'Plyo Push-Up', ['plyo push up', 'plyometric push up', 'clap push up', 'explosive push up'], 'horizontal-push', 'plyometric', ['chest', 'triceps'], ['frontDelt'], ['abs', 'serratus'], 'bodyweight', 'XC', 'stretch-shortening', { bwLoad: 0.64, notes: 'Uses the push-up 64%-of-bodyweight convention; under-estimates landing forces.' }),
    R('dip', 'Dip', ['dips', 'parallel bar dip', 'weighted dip'], 'vertical-push', 'strength', ['chest', 'triceps'], ['frontDelt'], ['abs'], 'bodyweight', 'C', null, { bwLoad: 1.0, notes: 'External-load convention: full bodyweight + added load.' }),

    /* ---- upper-body pull ---- */
    R('pull-up', 'Pull-Up', ['pull up', 'pull ups', 'pullup', 'pullups', 'pull-ups', 'weighted pull up'], 'vertical-pull', 'strength', ['lats'], ['biceps', 'upperBack', 'rearDelt', 'forearms'], ['abs'], 'bodyweight', 'C', null, { bwLoad: 1.0, notes: 'External-load convention: full bodyweight + added load.' }),
    R('chin-up', 'Chin-Up', ['chin up', 'chin ups', 'chinup'], 'vertical-pull', 'strength', ['lats', 'biceps'], ['upperBack', 'forearms'], ['abs'], 'bodyweight', 'C', null, { bwLoad: 1.0, notes: 'External-load convention: full bodyweight + added load.' }),
    R('lat-pulldown', 'Lat Pulldown', ['pulldown', 'lat pull down'], 'vertical-pull', 'strength', ['lats'], ['biceps', 'upperBack', 'rearDelt'], [], 'cable', 'C'),
    R('cs-db-row', 'Chest-Supported DB Row', ['chest supported db row', 'chest supported row', 'incline db row', 'seal row', 'chest-supported row', 'cs row'], 'horizontal-pull', 'strength', ['upperBack', 'lats'], ['rearDelt', 'biceps', 'forearms'], [], 'dumbbell', 'C'),
    R('sa-db-row', 'Single-Arm DB Row', ['db row', 'single arm db row', 'one arm db row', 'single arm row', '1 arm db row', 'sa db row', 'dumbbell row'], 'horizontal-pull', 'strength', ['lats', 'upperBack'], ['biceps', 'rearDelt', 'forearms'], ['abs', 'erectors'], 'dumbbell', 'UC'),
    R('ghr-sa-row', 'GHR Single-Arm Row', ['ghr single arm row', 'ghr row', 'ghd single arm row'], 'horizontal-pull', 'strength', ['lats', 'upperBack'], ['biceps', 'rearDelt', 'forearms'], ['abs'], 'dumbbell', 'UC', null, { confidence: 0.6, notes: 'Interpreted as a single-arm row braced on the glute-ham raise pad.', questions: ['Is this a single-arm dumbbell row braced on the GHR pad (chest/hips supported)?'] }),
    R('cable-row', 'Seated Cable Row', ['cable row', 'seated row', 'low row'], 'horizontal-pull', 'strength', ['upperBack', 'lats'], ['biceps', 'rearDelt'], ['erectors'], 'cable', 'C'),
    R('keiser-row', 'Keiser Explosive Row', ['keiser explosive row', 'keiser row', 'pneumatic row', 'explosive row'], 'horizontal-pull', 'power', ['upperBack', 'lats'], ['biceps', 'rearDelt'], ['abs'], 'pneumatic', 'XC', 'concentric', { loadComparable: false, confidence: 0.8, notes: 'Pneumatic resistance: minimal eccentric load; displayed resistance is not comparable to free-weight volume.' }),
    R('keiser-chop', 'Keiser Chop', ['keiser chop', 'cable chop', 'woodchop', 'wood chop', 'high to low chop'], 'rotation', 'power', ['abs'], ['lats', 'frontDelt', 'glutes'], ['adductors'], 'pneumatic', 'UXC', 'concentric', { loadComparable: false, confidence: 0.65, notes: 'Treated as explosive rotational work on a pneumatic machine.', questions: ['Was this done with explosive intent?', 'Pneumatic (Keiser) or cable stack?'] }),
    R('keiser-lift', 'Keiser Lift', ['keiser lift', 'cable lift', 'low to high lift'], 'rotation', 'power', ['abs'], ['glutes', 'frontDelt', 'upperBack'], ['adductors'], 'pneumatic', 'UXC', 'concentric', { loadComparable: false, confidence: 0.65 }),

    /* ---- shoulder health / arm care / accessories ---- */
    R('face-pull', 'Face Pull', ['face pulls', 'cable face pull', 'band face pull'], 'scapular', 'arm-care', ['rearDelt', 'upperBack', 'rotatorCuff'], ['biceps'], [], 'cable', ''),
    R('cable-er', 'Cable External Rotation', ['cable er', 'band er', 'external rotation', 'er', 'side lying er', 'side-lying external rotation', '90/90 er'], 'shoulder-rotation', 'arm-care', ['rotatorCuff'], ['rearDelt'], ['upperBack'], 'cable', ''),
    R('cable-ir', 'Cable Internal Rotation', ['cable ir', 'band ir', 'internal rotation', 'ir'], 'shoulder-rotation', 'arm-care', ['rotatorCuff'], ['chest'], [], 'cable', ''),
    R('ytw', 'Prone Y-T-W', ['ytw', 'y t w', 'prone y', 'prone t', 'i y t', 'iyt'], 'scapular', 'arm-care', ['upperBack', 'rearDelt', 'rotatorCuff'], [], [], 'dumbbell', ''),
    R('lateral-raise', 'Lateral Raise', ['db lateral raise', 'side raise', 'lateral raises'], 'isolation-upper', 'accessory', ['sideDelt'], ['upperBack'], [], 'dumbbell', ''),
    R('db-curl', 'Dumbbell Curl', ['curl', 'bicep curl', 'db curl', 'hammer curl', 'biceps curl'], 'isolation-upper', 'accessory', ['biceps'], ['forearms'], [], 'dumbbell', ''),
    R('tricep-ext', 'Triceps Extension', ['triceps pushdown', 'tricep pushdown', 'skull crusher', 'overhead triceps extension', 'rope pushdown'], 'isolation-upper', 'accessory', ['triceps'], [], [], 'cable', ''),
    R('wrist-work', 'Forearm / Wrist Work', ['wrist roller', 'rice bucket', 'wrist curl', 'reverse wrist curl', 'pronation supination'], 'isolation-upper', 'arm-care', ['forearms'], [], [], 'other', ''),
    R('farmer-carry', 'Farmer Carry', ['farmers carry', 'farmer walk', "farmer's carry", 'suitcase carry'], 'carry', 'carry', ['forearms', 'upperBack'], ['abs', 'glutes'], ['calves', 'erectors'], 'dumbbell', 'AC', 'isometric'),
    R('kb-tgu', 'Turkish Get-Up', ['kb turkish get ups', 'turkish get up', 'turkish get-up', 'tgu', 'kb tgu'], 'total-body', 'core', ['abs', 'glutes', 'frontDelt'], ['rotatorCuff', 'triceps', 'quads', 'upperBack'], ['serratus', 'adductors'], 'kettlebell', 'UC', 'dynamic', { stability: 'unstable', notes: 'Slow, stability-dominant; shoulder held overhead throughout.' }),

    /* ---- trunk ---- */
    R('plank', 'Plank', ['front plank', 'rkc plank'], 'anti-extension', 'core', ['abs'], [], ['glutes', 'frontDelt'], 'bodyweight', '', 'isometric'),
    R('side-plank', 'Side Plank', ['side plank'], 'anti-rotation', 'core', ['abs'], ['glutes'], ['adductors'], 'bodyweight', 'U', 'isometric'),
    R('stir-the-pot', 'Stir the Pot', ['stir the pot', 'stir-the-pot', 'stability ball stir the pot'], 'anti-extension', 'core', ['abs'], [], ['frontDelt', 'lats', 'glutes'], 'other', '', 'isometric', { stability: 'unstable' }),
    R('hanging-leg-raise', 'Hanging Leg Raise', ['hanging leg raises', 'hanging knee raise', 'hanging knee raises', 'toes to bar'], 'trunk-flexion', 'core', ['abs', 'hipFlexors'], [], ['forearms', 'lats'], 'bodyweight', '', 'dynamic', { notes: 'Bodyweight; external load not quantified.' }),
    R('flutter-kicks', 'Flutter Kicks', ['flutter kick', 'flutterkicks'], 'trunk-flexion', 'core', ['abs', 'hipFlexors'], [], [], 'bodyweight', '', 'dynamic'),
    R('pallof', 'Pallof Press', ['pallof', 'pallof press', 'anti rotation press'], 'anti-rotation', 'core', ['abs'], [], ['glutes'], 'cable', '', 'isometric'),
    R('dead-bug', 'Dead Bug', ['dead bugs', 'deadbug'], 'anti-extension', 'core', ['abs'], ['hipFlexors'], [], 'bodyweight', '', 'dynamic'),
    R('ab-rollout', 'Ab Rollout', ['ab wheel', 'rollout', 'barbell rollout'], 'anti-extension', 'core', ['abs'], ['lats'], ['frontDelt'], 'other', '', 'dynamic'),
  ];

  const api = { DB_VERSION, MUSCLES, PATTERNS, CATEGORIES, EQUIPMENT, LIBRARY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TritonExerciseDB = api;
})(typeof self !== 'undefined' ? self : this);
