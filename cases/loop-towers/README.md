# Loop Towers module

The authoritative runtime source is `../../public/cases/loop-towers/`. It remains a native ES-module application with its own Three.js distribution, DOM and worker.

- `model.js`: unchanged model generator and parametric geometry definitions.
- `model.json`: unchanged authoritative default structural snapshot.
- `app.js`: native visualization, controls and inspection, with documented UI compatibility edits.
- `entry.js`: shared interface adapter entry.
- `solver.js`, `worker.js`: unchanged mechanics and worker.

Do not copy these into a second parallel implementation. Edit only this case to change its mechanics or geometry. See the root README for baseline-preservation testing.
