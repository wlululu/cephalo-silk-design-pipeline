# Version 2 inspection addendum

Version 1 has since been published at `f6c3b73059246a36e167e98f12ef1b393ed893ab`, directly descending from the immutable source commit. The original inspection below remains historical; its prior publication-blocked status is superseded by this verified starting commit.

The original primary-scale UI range is **0.5–1.5**, step 0.05 (`cases/bridge/BridgeCase.tsx`). Version 2 conservatively enforces that existing range even though `createModel` performs arithmetic without its own upper-bound check. **1.50 is supported; 1.75 is not**. The controller verifies the unchanged UI range against `iteration_policy.json` before execution and rejects out-of-range next values without solving. Original generator, solver, UI, workers, loads and scientific records are unchanged.

Version 2 changes only pipeline-layer implementation/tests/documentation and adds policy/trajectory files. Existing npm command names and dependency versions are unchanged. Two fresh Version 1 verification solves matched full saved responses exactly before the new Iteration 02 was executed. No commit, tag, push or remote change is made in this session.

---

## Preserved Version 1 inspection

# Source inspection and parameter decision

Source: https://github.com/wlululu/cephalo-silk-structural-lab at `b6eeff872ccd62ddab8563cd2de6dcaf3a749340` (`Initial standalone Cephalo Structural Lab`). Local clone HEAD matched exactly before any edits. 213 tracked source files. Local tag `structural-lab-baseline` points to this commit.

## Repository and execution map

| Responsibility | Path |
|---|---|
| Vite/React entry and shared platform | `main.tsx`, `shared/Platform.tsx`, `vite.config.ts` |
| Authoritative Bridge snapshot | `public/cases/bridge/model.json` |
| Bridge structural generator and parameter defaults | `cases/bridge/model.mjs` |
| Bridge display geometry | `cases/bridge/geometry.mjs` |
| Bridge UI and parameter controls | `cases/bridge/BridgeCase.tsx` |
| Bridge worker | `public/cases/bridge/worker.mjs` |
| Original solver entry | `public/cases/bridge/solver.mjs` |
| Actual hybrid frame/cable backend | `public/cases/bridge/hybrid.mjs` |
| Original frame element | `public/cases/bridge/frame-element.mjs` |
| Preserved baseline | `public/cases/bridge/baseline-results.json`, `validation/original-bridge.json` |
| Original Bridge archive | `public/downloads/cephalo-bridge-v6.zip` |
| Existing case validation | `public/cases/bridge/{validation,hybrid-validation,control-validation,export-validation,v2-preservation}.json` |
| Existing physics study | `validation/physics/` including protocol, scripts, full runs, results and thresholds |
| Existing headless runner | `validation/physics/run-one.mjs` (historical; never run here, because it writes archived study outputs) |
| Integration and preservation tests | `tests/{preservation,integration,static}.mjs` |
| Loop Towers | `public/cases/loop-towers/{model.json,model.js,solver.js,worker.js}` |
| Pavilion | `public/cases/pavilion/{model.json,model.js,solver.js,baseline-results.json}` |
| Preservation manifest | `reproducibility/preserved-files.json` (102 protected entries) |

No standalone independent OpenSees implementation, OpenSees result bundle, or completed CV07/CV08 cross-validation bundle is present in this commit. ZIP entry names were inspected as well. No external results were assumed, added, reclassified or rerun. All original tracked files except README/package-script additions are checked against this source commit, including all archives and archived thresholds. Historical root `ASSUMPTIONS.md` contains older bilateral-frame language; active hybrid model/solver code and current case records govern this experiment. Historical files are not rewritten to harmonize them.

## Baseline and unit mapping

`defaults` is `{loadCase:'uniform', pressure:5, pointLoad:500, E:200, primaryScale:1, secondaryScale:1, selectedNode:13, nodeLoad:0, cablePrestress:80}`.

Pressure is kPa; E is GPa; cable reference prestress is MPa; point/node loads are kN; section scales are dimensionless. Inactive point/selected-node settings are retained exactly. Structural outputs use m, N, Pa and rad. Vertical is y. The deck metric is maximum Euclidean displacement magnitude over `model.topology.deck` nodes, including the prestress equilibration displacement, not just vertical displacement.

## Exact primary scale behavior

The UI permits 0.5–1.5 in steps of 0.05. It forwards `p` to `createModel(p)` and sends that model to the existing worker, which calls `solve(model)`. `solve` dispatches tension-only members to `solveHybrid`.

`createModel` chooses `primaryScale` for `group === 'primary'` and applies it to both outside diameter and wall thickness. Arch chord sections are then assigned their original graded diameter `(0.85 + 0.20*(1-q*q))*primaryScale` and wall thickness `0.040*primaryScale`. Affected classes are arch chords (`rib`), root spines (`root`), deck/approach girders (`deck`) and floor members (`floor`). All secondary braces and cables remain identical.

For ratio s, affected section area scales as s²; Iy, Iz and J as s⁴. This is not an area-only scale. Cable rest length remains `L/(1+referencePrestress/E)` and is unchanged. No material, load, stiffness modulus, boundary condition, solver tolerance or prestress law is modified.

The preselected value is **1.25** (25% diameter/wall increase), already exercised as `bridge-section-primary-1.25` in `validation/physics/protocol.json`. This is one previously supported perturbation, not a candidate search. The new revised solve generates fresh output; archived results are not used as generated responses.

## Existing commands and preservation

`npm ci`; `npm run build` (Vite plus source ZIP packaging); `npm test` (preservation, integration and static suites). The integration test executes the three original models and representative control changes in temporary locations, and writes only `test-output/`. This required regression is distinct from the new experiment's exactly one revised DesignSpec. No independent OpenSees model is executed.

New experiment command: `npm run closed-loop:bridge`. No dependencies added and lockfile unchanged. Original build scripts and all UI code unchanged.

## Git publication status

Shell baseline push failed because no GitHub credentials are configured. The connected GitHub `create_branch` write returned HTTP 403 `Resource not accessible by integration`. The baseline push prerequisite has therefore **not** been satisfied remotely. No scientific development commit has been created and no push is claimed. The destination remains empty as last checked. Source has never been written to; its local push URL is `DISABLED`.
