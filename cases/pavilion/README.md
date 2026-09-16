# Woven-Wing Pavilion module

The authoritative runtime source is `../../public/cases/pavilion/`. Its native application, Three.js distribution and solver remain independent.

- `model.js`: unchanged model generator and parametric surface.
- `model.json`: unchanged authoritative default structural snapshot.
- `app.js`: existing geometric reconstruction and experiment controls, plus documented presentation/inspection compatibility edits.
- `entry.js`: shared interface adapter entry.
- `solver.js`: unchanged beam/net tangent solver.
- `baseline-results.json`: unchanged supplied result file.

Edit only this case for pavilion geometry/mechanics refinement. See the root README for baseline-preservation testing.
