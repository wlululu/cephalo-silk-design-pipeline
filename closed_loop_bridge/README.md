# Twin-Arch Web Bridge: physics-guided closed-loop design iteration

**Local implementation, real solver execution, build and tests pass. Git publication is blocked.** No development commit has been created because the required untouched-baseline push must happen first. Destination remains empty as last checked. See `publication-status.json`.

## 1. Pipeline architecture

Input → DesignSpec → executable structural model → original physics solver → response → structured feedback → revised DesignSpec → re-analysis → comparison.

DesignSpec is a design/configuration layer. It references the original model; original `createModel` materializes only supported parameters and the unchanged original solver remains a separate backend. This run references an existing concept image and model; no new image-to-geometry inference occurs.

## 2. Baseline reproduction

The original generator reproduced authoritative `model.json`. A fresh solver execution matched the entire serialized `baseline-results.json` and `validation/original-bridge.json` result exactly, including nodal fields, reactions and member forces. JavaScript signed zero is normalized by JSON, as in the existing integration test. An initial raw-JavaScript deep comparison reported -0 versus JSON 0; no numerical discrepancy or source change was found.

## 3. Physics feedback

The observed baseline deck displacement was 36.745936861 mm. The transparent feedback rule hypothesized that increasing primary tube diameter and wall thickness would raise axial, bending and torsional stiffness and might reduce deck displacement. Feedback explicitly required re-analysis and did not claim success before the revised solve. The value 1.25 was preselected because it appears in the original UI range and archived physics protocol; no search or tuning occurred.

## 4. Design change

**Primary section scale: 1.00 → 1.25**, ratio 1.25, increase 25%. No other design parameter differs. Affected: 535 primary frame members (360 arch chords, 96 root spines, 52 deck/approach girders, 27 floor members). All secondary members and cables remain identical, including rest lengths and prestress definitions.

## 5–6. Revised response and quantitative comparison

| Quantity | Baseline | Iteration 01 | Change |
|---|---:|---:|---:|
| Max deck displacement, mm | 36.745936861 | 31.081610663 | −5.664326199 mm (−15.414837%) |
| Max all-node displacement, mm | 76.877938086 | 71.960733251 | −4.917204835 mm (−6.396120%) |
| Vertical reaction, N | 8400000.000000000 | 8399999.999999998 | −1.86265e−9 N |
| Max absolute frame axial force, kN | 1903.051073 | 1701.850201 | −10.572542% |
| Frame axial range, kN | −1903.051073 to +566.039133 | −1701.850201 to +520.127165 | Redistribution |
| Frame RMS axial force, kN | 306.300112 | 292.091946 | −4.638642% |
| Cable tension range, kN | 0 to 317.952089 | 0 to 290.071127 | Peak −8.768919% |
| Mean cable tension, kN | 61.280287 | 60.389536 | −1.453569% |
| RMS cable tension, kN | 97.172246 | 94.249192 | −3.008116% |
| Taut / slack cables | 542 / 12 | 546 / 8 | Four slack → taut |
| Absolute solver residual, N | 1.461621e−6 | 9.999263e−5 | Both < 0.002 N |
| Relative solver residual | 4.528375e−13 | 2.999155e−11 | Both converged |
| Summed nonlinear iterations | 104 | 101 | −3 |
| Global force residual, N | 1.533692e−9 | 1.876591e−9 | Both pass |
| Relative global force residual | 1.825824e−16 | 2.234036e−16 | Threshold 1e−6 |
| Global reference moment residual, N·m | 4.520732e−8 | 3.904380e−7 | Both pass |
| Relative global moment residual | 1.705810e−16 | 1.473242e−15 | Threshold 1e−6 |
| Max frame yield indicator | 0.535990 | 0.381044 | Lower |
| Max cable tensile indicator | 0.449792 | 0.412729 | Lower |
| Max frame Euler indicator | 5.628836 | 4.209098 | Lower, still >1 |
| Frame members with Euler indicator >1 | 78 | 62 | Screening concern remains |

Cable IDs 458, 606, 1421 and 1569 changed from slack to taut; none changed the other way. Both solves report no cable mechanisms and no inactive cable DOFs. Full support-by-support force and moment differences, complete nodal fields, local frame-end forces and member screening arrays are retained. Global moment sums use authored reference coordinates and support moments, matching the preserved study; formulation limitations remain.

## 7. Objective

`objective_met = true`, calculated strictly from `iteration.maxDeckDisplacement < baseline.maxDeckDisplacement`. Convergence and screening are recorded separately and do not redefine this objective.

## 8. Tradeoffs

Affected primary tube diameter/wall ratio is 1.25; section area ratio is 1.5625 (+56.25%); Iy/Iz/J ratio is 2.44140625 (+144.14%). Greater section/material demand is explicit, but no total structural mass or volume is claimed. The original load model excludes self-weight, so the effect of increased self-weight is not evaluated.

Peak frame and cable forces decline, but forces redistribute and the signed mean frame axial force becomes more compressive (−62.655796 → −64.490061 kN). This population statistic is not a global load resultant. Four cables activate. Euler indicators remain above 1 despite improvement; this experiment does not establish a satisfactory engineering design. Solver residuals rise but stay below unchanged tolerances. Reaction total is unchanged to floating-point precision; individual reactions redistribute.

## 9. Preservation

211 of 213 original tracked files are byte-identical to the exact source commit. Only README and package-script entries changed. The original 102-file scientific preservation test also passes. This covers Bridge model/generator/display geometry/solver/hybrid/frame-element/worker, validated baselines, all physics-validation records and thresholds, original archives, Loop Towers and Pavilion. No standalone OpenSees or independent cross-validation files exist in this source checkout or archive name inventory; none was imported, rerun or claimed verified.

## 10. Reproducibility and execution evidence

```bash
npm ci
npm run closed-loop:bridge
npm run test:closed-loop
npm run build
npm test
```

Actual solver subprocess commands:

```bash
node scripts/run_closed_loop_bridge.mjs --worker baseline_designspec
node scripts/run_closed_loop_bridge.mjs --worker design_iteration_01
```

Public stage commands are `node scripts/run_closed_loop_bridge.mjs --baseline` and `node scripts/run_closed_loop_bridge.mjs --iteration`. Use full/stage commands for preservation gates. Each solve runs in a fresh process. Node v24.19.0 and npm 11.9.0 were used. No runtime dependencies added. Full new results match the preserved baseline and archived same-parameter section case, respectively; tests do not copy those records into generated responses.

`npm ci`, closed-loop execution, focused closed-loop tests, production build and all existing preservation/integration/static tests passed. Integration reproduced full baseline/representative control-change results for all three cases; static tests covered root and repository-prefix hosting with 61 original public assets. Both DesignSpecs separately passed JSON Schema validation using a temporary external validator (not added to this repository). Existing build advisory: JavaScript chunk >500 kB. No browser UI redesign or new browser interaction testing was performed.

## 11. Scope and limitations

One controlled closed-loop iteration, one changed variable, one load case; not an optimization algorithm. Bridge geometry remains an inferred idealized representation. Solver agreement does not establish real-world safety, constructability or connection adequacy. Existing frame/cable assumptions, initial shortening law, tension-only convention and omitted physical effects remain unchanged. Broader automated design search and future geometry backends are future work. Blender, manuscript changes and a pipeline UI are not implemented.

## Record summaries

- `baseline_designspec.json`: baseline ID, source commit/model, exact nine default parameters, no overrides, displacement objective and single-variable constraint.
- `design_feedback.json`: measured baseline, pre-analysis hypothesis, proposed 1→1.25 section change, rationale/tradeoffs/uncertainty, mandatory re-analysis; observed outcome points to comparison.
- `design_iteration_01.json`: parent `bridge_baseline`, sole override `primaryScale:1.25`, feedback hash, unchanged parameters and provenance.
- `comparison.json`: objective true; displacements, reactions, force populations, cable identity changes, screening, convergence, equilibrium and hashes tying all input records together.

## Repository identities and remotes

Source: https://github.com/wlululu/cephalo-silk-structural-lab

Destination: https://github.com/wlululu/cephalo-silk-design-pipeline

Source commit / current local HEAD: `b6eeff872ccd62ddab8563cd2de6dcaf3a749340`.

Final pipeline commit: **not created; blocked before required baseline publication**.

```
origin (fetch/push): https://github.com/wlululu/cephalo-silk-design-pipeline.git
structural-lab-source (fetch): https://github.com/wlululu/cephalo-silk-structural-lab.git
structural-lab-source (push): DISABLED
```

No source-repository push, branch, history or deployment was modified. The destination baseline push, remote baseline reference, final commit/push and GitHub file verification remain unresolved because of authentication/connector authorization failures. This is a verified local deliverable, not a completed published task.
