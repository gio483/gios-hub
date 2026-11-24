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
