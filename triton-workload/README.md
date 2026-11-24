# Triton Workload — lifting workload calculator

Implements *Baseball Lifting Workload Calculator — Evidence-Based Technical Specification v2.0*.
Five independent components (spec §15):

| | Component | File | Depends on |
|---|---|---|---|
| A | Exercise classification engine | `classifier.js` | `exercise-db.js` (+ optional AI endpoint) |
| B | Exercise database | `exercise-db.js` | nothing |
| C | Workload calculation engine | `engine.js` | nothing |
| D | Training input interface | `../app.js` → Lifting Log › Log | A, B, C |
| E | Dashboard visualisation | `../app.js` → Lifting Log › Workload | C |

`engine.js` is deterministic and dependency-free: same input, same output, no DOM, no network, no AI.
Load it in a browser (`window.TritonWorkload`) or Node (`require('./engine.js')`).

```js
const W = require('./engine.js');
const regions = { quads: 'lower', glutes: 'lower', lats: 'upper' /* … */ };
const day = W.analyzeSession({ date: '2026-11-20', bodyweightLb: 204, sessionRpe: 7, durationMin: 60,
  exercises: [{ exercise: someExerciseRecord, oneRm: { tested: 405 }, sets: [{ load: 315, reps: 5, rpe: 8 }] }] }, regions);
W.weekly([day], '2026-11-23', 8);   // Monday–Sunday totals
W.METHODS;                          // formula, units, evidence class, limitations and sources for every number
```

- **Data transfer:** `schema.json` (JSON Schema, format `triton-workload/1`). CSV exports of sets and exercise records come from the app.
- **Tests:** `engine.test.js` → `TritonWorkload.runTests()` in a browser, or `node engine.test.js`.
- **Versions:** `ENGINE_VERSION`, `RULES_VERSION` (thresholds/conventions), `SPEC_VERSION`. Each saved session stores its calculation with these versions (`liftCalc`), so past numbers survive rule changes.
- **AI-assisted classification:** `classifier.classifyAI()` posts to the hub (`/api/lifeos?ns=triton`, action `classify`), which asks Claude with a strict JSON schema. The rules engine works offline without it.

Nothing here measures fatigue, CNS stress, muscle activation or hypertrophy. See `METHODS` for what each number is and is not.

## Throwing workload (`throwing-engine.js`)

Implements *Personalized Throwing Workload Calculator — Technical Specification v2.0*. Standalone and deterministic (`window.TritonThrowing` / `require`).

```js
const T = require('./throwing-engine.js');
const model = T.fitModel(days);            // days: [{ date, pulseWorkload, restDay, activities: [{ type, throws, effort, ballG, distFt, avgV, maxV, radarN }] }]
const day = T.resolveDay(days[0], model);  // Pulse → measured; rest → 0; nothing logged → missing (null); else model estimate + confidence
T.rolling(resolvedByDate, '2026-11-23', 7); T.calendarMonth(resolvedByDate, '2026-11'); T.acwr(resolvedByDate, '2026-11-23');
T.symptomFlags(days, '2026-11-23');        // arm-response review prompts, never part of workload
```

Model: non-negative ridge regression (no intercept) predicting his own Pulse One Day Workload; candidates M1→M5 compared on chronological and leave-one-out error; a richer model wins only if it is meaningfully better on unseen days. Stages: cold start (provisional weights, not on the Pulse scale) → early (scale fit) → developing → established. Tests: `throwing-engine.test.js` (`TritonThrowing.runTests()`). Monitoring only: not injury prediction, prescription or clearance.
