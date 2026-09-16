# Cephalo Structural Lab — controlled physics sanity-validation

Study date: 2026-09-10 (UTC). Source commit: `3f61ab00809b93a4514edffe60933e1b9aaa81dd`. Runtime: `v24.19.0`.

**Assessment: physically sensible parameter trends, with specific applicability concerns.** All 23 isolated runs converged. All three baseline models and complete baseline results match the preserved integration snapshots exactly. All 189 pre-existing tracked files remained byte-for-byte unchanged. No geometry, solver, boundary condition, material definition, prestress rule, baseline result or live interface was edited.

**Passed:** monotonic load, elastic-stiffness and section-size response in all three cases; global force equilibrium in all baseline models; bridge and tower moment equilibrium; bridge symmetry; all original solver convergence criteria. **Partial:** exact scaling is inapplicable to the bridge total prestressed response and pavilion elastic-stiffness sweep; pavilion double-load tangent response extends into flagged slack members; symmetry is not applicable to the asymmetric towers/pavilion. **Actual concerns:** pavilion full global moment balance is not satisfied, and four bridge members exceed the existing yield-screening limit at double load. These concerns are reported separately from successful solver convergence.

## 1. Protocol and preserved baseline

Each case used its current generator and existing solver directly in a fresh Node process. This prevents the bridge prestress cache from coupling runs. The three factor-1 baselines are reused within each sweep, giving 23 unique solves: 9 bridge, 7 tower, 7 pavilion. The study varies one existing control at a time. It does not rescale geometry coordinates, infer new loads, change solver tolerances, or add material/nonlinear behavior.

| Case | Model authority / generator | Solver | Baseline configuration |
| --- | --- | --- | --- |
| Bridge | `public/cases/bridge/model.json`; `cases/bridge/model.mjs::createModel` | `public/cases/bridge/solver.mjs` → `hybrid.mjs` + `frame-element.mjs` | Uniform pressure 5 kPa; E=200 GPa; primaryScale=secondaryScale=1; reference cable prestress 80 MPa; nodal load 0 |
| Loop Towers | `public/cases/loop-towers/model.json`; adjacent `model.js::makeModel` | `public/cases/loop-towers/solver.js` | Gravity case; load=stiffness=thickness=1; concrete E=32 GPa, steel E=200 GPa |
| Pavilion | `public/cases/pavilion/model.json`; adjacent `model.js::makeModel` | `public/cases/pavilion/solver.js` | Gravity pressure 300 Pa; stiffness=thickness=1; steel E=200 GPa, net E=80 GPa; initial net tension 18 kN; no nodal loads |

Full baseline settings, nodal coordinates, member sections/materials, supports, load definitions and all solver outputs are preserved in `runs/<case>-baseline.json`. For the pavilion, nodal pressure loads are assembled inside the existing solver from model faces; the postprocessor independently repeats that load integration. Tower load records are selected and multiplied using the original gravity-case rule. Bridge generated nodal loads are used directly. All baseline model objects exactly equal their authoritative `model.json` files and `validation/original-<case>.json` models; all full baseline result objects exactly equal the latter preserved results.

| Case | Max displacement (mm) | Deck max (mm) | Vertical reaction (kN) | Peak abs axial (kN) | Peak stress (MPa) | Yield indicator | Relative residual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bridge | 76.877938 | 36.745937 | 8400.000000 | 1903.051073 | 449.791970 | 0.535990 | 4.528e-13 |
| Loop Towers | 23.095865 | — | 79831.999989 | 10019.955399 | 18.925335 | — | 8.311e-09 |
| Pavilion | 139.468638 | — | 177.040756 | 45.087816 | not exported | — | 8.334e-08 |

Displacement means the largest nodal translation-vector norm. Bridge displacements include prestress equilibration relative to the authored geometry; its baseline maximum is at orb-web node 432, predominantly transverse. The deck metric is reported separately. Bridge peak stress is the largest frame combined-normal or cable axial stress across two different strength classes; it must **not** be divided by one common yield strength. Baseline frame peak combined stress is 190.277 MPa; the overall 449.792 MPa maximum is a cable stress. The maximum yield indicator is independently taken over the original per-member indicators. Tower stress is axial. Pavilion net axial force includes 18 kN initial tension, but frame forces, displacement and reactions are incremental; no pavilion strength/utilization metric is implemented.

Operational thresholds, recorded in `protocol.json` before execution: relative global force and moment error ≤1e−6; linear scaling error ≤1e−4 where the formulation supports it; monotonic displacement tolerance 1e−4 of baseline; reflection-coordinate tolerance 1e−6 m and displacement symmetry tolerance 1e−3 of baseline maximum. A cable-state change of ≥10% of all cable members is marked substantial. These are diagnostic study criteria, not structural design acceptance criteria. A physically justified departure from an inapplicable linear reference is Partial, not Fail.

## 2. Load, stiffness and existing section controls

Values in each triplet are in increasing parameter order. Load/E factors are **0.5 / 1 / 2**; section factors are **0.75 / 1 / 1.25**. Relative changes refer to maximum all-node displacement at the low/high setting against baseline. The CSV contains individual parameter values, expected behavior, displacement/reaction/force/stress relative changes and run-level notes.

| Case | Existing parameter | Low / baseline / high | Max displacement (mm) | Low / high relative change | Assessment | Observed vs expected |
| --- | --- | --- | --- | --- | --- | --- |
| Bridge | pressure (kPa) | 2.5 / 5 / 10 | 54.792 / 76.878 / 102.612 | -28.73% / +33.47% | Partial | Monotonic; prestressed corotational cable response is not purely linear. |
| Bridge | E (GPa) | 100 / 200 / 400 | 87.362 / 76.878 / 68.255 | +13.64% / -11.22% | Partial | Monotonic; prestressed corotational cable response is not purely linear. |
| Bridge | primaryScale | 0.75 / 1 / 1.25 | 84.582 / 76.878 / 71.961 | +10.02% / -6.40% | Pass | Monotonic; section stiffness increases. |
| Bridge | secondaryScale | 0.75 / 1 / 1.25 | 90.549 / 76.878 / 67.210 | +17.78% / -12.58% | Pass | Monotonic; section stiffness increases. |
| Loop Towers | load | 0.5 / 1 / 2 | 11.548 / 23.096 / 46.192 | -50.00% / +100.00% | Pass | u, reactions and all member forces scale exactly. |
| Loop Towers | stiffness | 0.5 / 1 / 2 | 46.192 / 23.096 / 11.548 | +100.00% / -50.00% | Pass | u follows 1/E exactly; forces unchanged. |
| Loop Towers | thickness | 0.75 / 1 / 1.25 | 41.059 / 23.096 / 14.781 | +77.78% / -36.00% | Pass | Area scales as size²; u follows 1/size²; forces unchanged. |
| Pavilion | pressure (Pa) | 150 / 300 / 600 | 69.734 / 139.469 / 278.937 | -50.00% / +100.00% | Partial | u and incremental forces scale exactly; double load flags 4 slack net members. |
| Pavilion | stiffness | 0.5 / 1 / 2 | 175.455 / 139.469 / 104.816 | +25.80% / -24.85% | Partial | u decreases; fixed initial-tension geometric stiffness prevents 1/E scaling. |
| Pavilion | thickness | 0.75 / 1 / 1.25 | 182.662 / 139.469 / 108.829 | +30.97% / -21.97% | Pass | Monotonic; section stiffness increases. |

**Bridge.** Uniform loading gives total vertical reactions of 4,200 / 8,400 / 16,800 kN. All-node displacement increases 54.792 → 76.878 → 102.612 mm; deck displacement increases 11.915 → 36.746 → 86.275 mm. Slack counts change 8 → 12 → 20 of 554, and prestress is re-equilibrated before each loading sequence. These are monotonic responses, not a proportional linear response measured from a stress-free origin. The E sweep holds the 80 MPa reference stress control fixed; the original generator consequently updates the shortening ratio with E. That is existing control behavior, not a changed prestress assumption. Deck displacement follows 1/E approximately (73.282 / 36.746 / 18.434 mm, deviations −0.286% and +0.330% from ideal inverse scaling), while the maximum web displacement does not. No run reports a cable mechanism or unstable frame skeleton.

The bridge primaryScale control changes arch chords, root spines and deck; secondaryScale changes braces and cable diameters. They were varied separately with the other scale fixed at 1. Circular-tube diameter and wall scale together (A ∝ size², I ∝ size⁴); equivalent cable area scales with diameter². Both controls reduce all-node and deck displacement when increased. The existing yield indicator reaches **1.067986** at double load in members **28, 408, 991 and 1371**. This is an actual elastic-strength screening concern; the unmodified solver continues to calculate an elastic response. It does not invalidate the observed monotonicity or numerical convergence.

**Loop Towers.** The selected gravity load is 79,832 kN at baseline and scales as one complete load vector. Load factors produce exact full-vector proportionality for displacement, reactions and axial forces in this runtime. Common E scaling produces exact inverse displacement scaling and unchanged member forces. The thickness control multiplies every area by thickness²; displacement follows 1/thickness² to about 1.4e−11 full-vector relative error, while axial stress falls from 33.645 to 18.925 to 12.112 MPa. The same 34 of 46 web/cable members are slack in every run. All solves stabilize after three active-set iterations; no activation transition or tension-compression inconsistency was observed.

**Pavilion.** The fixed tangent is K(E,size)=K_frame(E,size)+K_net,material(E,size)+K_net,initial-tension. Its 18 kN/member initial-tension term remains fixed when E or size changes, so the full tangent does not scale uniformly. Displacement still decreases monotonically as E or member size increases. Tube diameter and wall scale together and net area scales as size². Under load scaling, displacement, support reactions and incremental member axial forces scale exactly to floating-point precision; total net force is T₀+ΔN, so its proportionality is neither expected nor imposed. At half load the identity of the peak-total-force member can change. At double load, **4 of 552 net members** have negative reported total tension, with minimum **−1.651647 kN**. The solver only flags slack and retains the fixed tangent; it does not deactivate those members or redistribute load. Thus the double-load result is a converged tangent calculation with a physical applicability limitation.

Prestress in the pavilion is **not form-found**, and no reference-state prestress equilibrium is solved. The study preserves that assumption. Global moment consequences are quantified below rather than hidden by a good residual.

### Numerical response for every unique run

| Run ID | u max (mm) | Deck (mm) | Reaction norm (kN) | Peak abs axial (kN) | Peak stress (MPa) | Yield indicator |
| --- | --- | --- | --- | --- | --- | --- |
| bridge-baseline | 76.877938 | 36.745937 | 8400.000 | 1903.0511 | 449.7920 | 0.535990 |
| bridge-load-0.5 | 54.792249 | 11.915256 | 4200.000 | 975.1695 | 203.9158 | 0.269969 |
| bridge-load-2 | 102.611779 | 86.274876 | 16800.000 | 3758.6703 | 944.5109 | 1.067986 |
| bridge-stiffness-0.5 | 87.362412 | 73.281814 | 8400.000 | 1902.7114 | 456.8905 | 0.535863 |
| bridge-stiffness-2 | 68.255018 | 18.433525 | 8400.000 | 1902.9086 | 438.5323 | 0.536114 |
| bridge-section-primary-0.75 | 84.581717 | 45.934383 | 8400.000 | 2042.5084 | 500.1471 | 0.682309 |
| bridge-section-primary-1.25 | 71.960733 | 31.081611 | 8400.000 | 1701.8502 | 412.7293 | 0.412729 |
| bridge-section-secondary-0.75 | 90.549254 | 66.761297 | 8400.000 | 1956.4714 | 785.9774 | 0.785977 |
| bridge-section-secondary-1.25 | 67.210479 | 22.301518 | 8400.000 | 1846.3097 | 288.5752 | 0.388696 |
| loop-towers-baseline | 23.095865 | — | 79832.000 | 10019.9554 | 18.9253 | — |
| loop-towers-load-0.5 | 11.547933 | — | 39916.000 | 5009.9777 | 9.4627 | — |
| loop-towers-load-2 | 46.191731 | — | 159664.000 | 20039.9108 | 37.8507 | — |
| loop-towers-stiffness-0.5 | 46.191731 | — | 79832.000 | 10019.9554 | 18.9253 | — |
| loop-towers-stiffness-2 | 11.547933 | — | 79832.000 | 10019.9554 | 18.9253 | — |
| loop-towers-section-0.75 | 41.059316 | — | 79832.000 | 10019.9554 | 33.6450 | — |
| loop-towers-section-1.25 | 14.781354 | — | 79832.000 | 10019.9554 | 12.1122 | — |
| pavilion-baseline | 139.468638 | — | 177.041 | 45.0878 | — | — |
| pavilion-load-0.5 | 69.734319 | — | 88.520 | 22.9642 | — | — |
| pavilion-load-2 | 278.937275 | — | 354.082 | 90.1756 | — | — |
| pavilion-stiffness-0.5 | 175.454548 | — | 177.041 | 45.0119 | — | — |
| pavilion-stiffness-2 | 104.815992 | — | 177.041 | 45.1424 | — | — |
| pavilion-section-0.75 | 182.661857 | — | 177.041 | 44.9597 | — | — |
| pavilion-section-1.25 | 108.828505 | — | 177.041 | 45.0978 | — | — |

The result JSON additionally identifies peak locations, cable tension ranges, the pavilion incremental-axial peak, every changed/slack member ID and all full-vector scaling diagnostics. The bridge incremental member forces about its equilibrated prestress state are not separately exported, so that diagnostic is explicitly unavailable; total forces are retained without inventing a prestress subtraction.

## 3. Global equilibrium

Independently assemble external nodal force vectors Fᵢ, then calculate e_F=ΣFᵢ+ΣRⱼ. Absolute error is ‖e_F‖ and relative error is ‖e_F‖/max(1 N,Σ‖Fᵢ‖). For these downward-only baselines, the denominator equals the magnitude of the total applied vertical load. The applied vectors exactly agree with the solver totals to 1e−6 N. Reactions below include all returned support forces; pavilion prestress forces are not inserted into incremental reactions.

| Baseline | Applied Fy (kN) | Reaction Ry (kN) | Absolute force error (N) | Relative error | Status |
| --- | --- | --- | --- | --- | --- |
| Bridge | -8400.000000 | 8400.000000 | 1.246383e-09 | 1.483790e-16 | Pass |
| Loop Towers | -79832.000000 | 79831.999989 | 2.132824e-02 | 2.671640e-10 | Pass |
| Pavilion | -177.040755 | 177.040756 | 6.693191e-04 | 3.780593e-09 | Pass |

Moments are evaluated about (0,0,0) in the authored reference coordinates: e_M=Σ(rᵢ×Fᵢ+Mᵢ)+Σ(rⱼ×Rⱼ+M_Rⱼ). Support reaction moments are included for the bridge and pavilion; the tower model has translational supports and axial members. The relative denominator is max(1 N·m,Σ‖rᵢ×Fᵢ‖+Σ‖Mᵢ‖), which remains meaningful when the net applied moment cancels by symmetry. Raw vectors and additional deformed-coordinate diagnostic sums are saved. Reference-coordinate balance is the appropriate primary check for the small-displacement tower model; a deformed-coordinate sum alone would add second-order terms absent from that formulation.

| Baseline | Moment error x / y / z (kN·m) | Absolute error (N·m) | Reference scale (N·m) | Relative error | Status |
| --- | --- | --- | --- | --- | --- |
| Bridge | 4.23024e-11 / -6.8394e-12 / 2.45636e-11 | 4.93928e-08 | 2.6502e+08 | 1.863739e-16 | Pass |
| Loop Towers | 5.69234e-05 / 8.89574e-05 / -0.000379752 | 0.394164 | 2.49479e+09 | 1.579948e-10 | Pass |
| Pavilion | 2.99357 / -0.0710505 / -5.47107 | 6236.92 | 1.64132e+06 | 3.799949e-03 | Fail |

**Pavilion moment concern.** The baseline residual moment is [2.993570, −0.071050, −5.471071] kN·m, norm **6.236917 kN·m**, or **0.379995%** of the stated applied-moment scale. This fails the 1e−6 global-moment diagnostic despite passing global force balance. Repeating the sum using deformed coordinates does not remove the defect. It must not be described as complete physical equilibrium.

The source formulation explains the defect: each prestressed net tangent supplies transverse incremental forces T₀/L·(I−nnᵀ)·(u_b−u_a). These forces produce a reference-coordinate pair torque T₀·n×(u_b−u_a). Summing that expression directly from all 552 net members gives [2.993558, −0.071056, −5.471091] kN·m. It accounts for the observed imbalance to **0.0239 N·m** (rounding to four significant figures), consistent with small residual-level differences. This is a demonstrated limitation of the prescribed, unequilibrated initial-tension tangent reference—not evidence of PCG nonconvergence. No missing form-finding or prestress reaction field was invented, and no correction was applied.

## 4. Symmetry

| Case | Reflection plane | Matching nodes | Max nearest reflected distance (m) | Max displacement error (m) | Relative error | Assessment |
| --- | --- | --- | --- | --- | --- | --- |
| Bridge | x=0 | 762/762 | 3.55271e-15 | 1.295452e-14 | 1.685077e-13 | Pass |
| Bridge | z=0 | 762/762 | 0 | 1.018690e-14 | 1.325074e-13 | Pass |
| Loop Towers | x=0 | 0/460 | 13.9587 | N/A | N/A | N/A (Partial coverage) |
| Loop Towers | z=0 | 0/460 | 19.5202 | N/A | N/A | N/A (Partial coverage) |
| Pavilion | x=0 | 49/197 | 6.85753 | N/A | N/A | N/A (Partial coverage) |
| Pavilion | z=0 | 49/197 | 2.5 | N/A | N/A | N/A (Partial coverage) |

For the bridge, all 762 nodes, all member connections and numeric section/rest-length properties, support restraints and baseline nodal force vectors satisfy both reflections. Pair displacement errors compare u_j with S·u_i (the reflected translation vector), normalized by the baseline maximum displacement. The worst x pair is nodes 374/430; the worst z pair is 171/432. All unique pairs, their displacement vectors and individual errors are saved in the JSON. Maximum deck-pair error is 2.14e−15 m. This is full-model symmetry verification, not selection of a few favorable locations.

The towers intentionally have different heights (140 and 152 m), offsets and tilted/shifted loops. The pavilion has unequal boundary-arch amplitudes: its authored surface varies from 10.5 to 13 m in one direction and 10 to 17 m in the other, with asymmetric resulting heights. The nearest reflected node mismatches are structural-scale distances, not mesh-rounding errors. A few pavilion boundary/plane nodes match, but the model does not form a symmetric mechanical system; no displacement symmetry criterion is imposed. No geometry was mirrored or changed for this test.

## 5. Numerical convergence and member state

Every run meets the original criterion. Bridge convergence is inferred from successful completion of every Newton load step and the final physical residual below the original absolute load tolerance; its solver does not export a Boolean converged flag. Its reported relative residual is normalized by max(1,‖F‖,‖internal force‖). Newton iterations below sum the initial prestress stage and four applied-load stages; the full per-stage history is retained. Initial equilibrium tolerance remains 0.02 N and loaded tolerance max(0.002 N,1e−9‖F‖).

Tower PCG targets 1e−8 relative residual per active-set solve (the original converged flag accepts <1e−7 once the active set stabilizes). Pavilion PCG targets 1e−7 and its exported converged flag accepts ≤1e−6; all study runs meet even the tighter PCG target. Tower iteration counts sum all active-set solves. Pavilion has one fixed-tangent solve and no active-set loop. Its residual mixes the original force/rotational equations; no new residual normalization is substituted. Pavilion rotations are not exported, so a separate full K·u residual cannot be reconstructed from its returned translations alone.

| Run ID | Converged | Relative residual | Iterations | Active-set iterations | Slack / cable count | Changed vs baseline |
| --- | --- | --- | --- | --- | --- | --- |
| bridge-baseline | Yes | 4.528e-13 | 104 | — | 12/554 | 0 |
| bridge-load-0.5 | Yes | 5.744e-11 | 103 | — | 8/554 | 4 |
| bridge-load-2 | Yes | 7.900e-11 | 101 | — | 20/554 | 8 |
| bridge-stiffness-0.5 | Yes | 6.006e-12 | 50 | — | 8/554 | 4 |
| bridge-stiffness-2 | Yes | 7.953e-13 | 115 | — | 16/554 | 4 |
| bridge-section-primary-0.75 | Yes | 2.070e-10 | 93 | — | 16/554 | 4 |
| bridge-section-primary-1.25 | Yes | 2.999e-11 | 101 | — | 8/554 | 4 |
| bridge-section-secondary-0.75 | Yes | 3.636e-11 | 134 | — | 16/554 | 4 |
| bridge-section-secondary-1.25 | Yes | 1.286e-10 | 71 | — | 8/554 | 4 |
| loop-towers-baseline | Yes | 8.311e-09 | 4183 | 3 | 34/46 | 0 |
| loop-towers-load-0.5 | Yes | 8.311e-09 | 4183 | 3 | 34/46 | 0 |
| loop-towers-load-2 | Yes | 8.311e-09 | 4183 | 3 | 34/46 | 0 |
| loop-towers-stiffness-0.5 | Yes | 8.311e-09 | 4183 | 3 | 34/46 | 0 |
| loop-towers-stiffness-2 | Yes | 8.311e-09 | 4183 | 3 | 34/46 | 0 |
| loop-towers-section-0.75 | Yes | 7.857e-09 | 4184 | 3 | 34/46 | 0 |
| loop-towers-section-1.25 | Yes | 7.899e-09 | 4184 | 3 | 34/46 | 0 |
| pavilion-baseline | Yes | 8.334e-08 | 945 | — | 0/552 | 0 |
| pavilion-load-0.5 | Yes | 8.334e-08 | 945 | — | 0/552 | 0 |
| pavilion-load-2 | Yes | 8.334e-08 | 945 | — | 4/552 | 4 |
| pavilion-stiffness-0.5 | Yes | 9.514e-08 | 904 | — | 0/552 | 0 |
| pavilion-stiffness-2 | Yes | 7.389e-08 | 978 | — | 0/552 | 0 |
| pavilion-section-0.75 | Yes | 9.795e-08 | 1107 | — | 0/552 | 0 |
| pavilion-section-1.25 | Yes | 8.317e-08 | 828 | — | 0/552 | 0 |

All active/slack membership lists are stored. Bridge slack counts range from 8 to 20; at most 8/554 (1.44%) members change state relative to baseline, below the predeclared substantial-change threshold. Every bridge run reports `cableMechanisms=false` and a positive independently checked frame pivot. Towers retain exactly the same 34 slack members. Pavilion double load flags 4/552 (0.72%) members, which is numerically a small count but physically important because the solver does not redistribute their force. Thus the substantial-count threshold does not suppress the pavilion applicability concern.

An independent tower member-force assembly produces a baseline free-DOF residual of 8.31124e−9 relative, versus 8.31138e−9 reported by PCG; the small difference is recurrence/assembly rounding. The same independent check passes for every tower run. The report does not interpret good solver residuals as proof of material adequacy or of a valid prestress reference state.

## 6. Answers to the requested scientific questions

| Question | Finding |
| --- | --- |
| 1. Sensible load response? | Yes: all maximum displacements and reaction resultants grow monotonically. Towers are linear under this sweep; bridge total response is prestress/state dependent; pavilion is linear tangent response with slack limitations at double load. |
| 2. Increasing E reduces deformation? | Yes in every case. Towers follow 1/E exactly; bridge deck approximately follows it, but total web maximum does not; fixed pavilion initial-tension stiffness prevents full inverse scaling. |
| 3. Increasing member size increases stiffness? | Yes for both independent bridge controls and each tower/pavilion size control. All maximum and bridge deck displacements decrease. |
| 4. Global equilibrium? | Forces pass in all cases. Moments pass for bridge/towers and fail the full reference-coordinate check for the pavilion (6.24 kN·m, 0.380%): a documented formulation concern. |
| 5. Symmetric cases symmetric? | Bridge passes both longitudinal and transverse reflection checks. Towers and pavilion are intentionally asymmetric; tests are N/A. |
| 6. Residuals/convergence acceptable? | Yes for all 23 runs under the unchanged original numerical criteria. No solver exception or active-set cycling was observed. |
| 7. Unexpected state/nonlinear effects? | Bridge state changes are small and explainable. Towers show none. Pavilion double-load negative net tensions expose an applicability limit of its fixed tangent. Bridge double load also exceeds the existing elastic yield-screening limit. |

Overall, this study supports the direction of the existing interactive parameter responses. It does **not** clear the pavilion prestress/moment formulation or the bridge double-load strength screen. Those are recorded findings for future work; no model was changed after observing them.

## 7. Files and reproduction

- `physics-sanity-summary.csv`: requested tidy validation table, including per-run parameter tests, equilibrium, symmetry, convergence and the separate yield-screening concern. Relative changes are fractions (0.25 means +25%); dimensional units are given in the observed-response text and parameter documentation above.
- `physics-sanity-results.json`: complete structured diagnostics, thresholds, preservation checks, paired-node symmetry records and file references for every numerical run. It is an index plus diagnostics; unabridged solver arrays and input models are in the referenced run files.
- `runs/*.json`: every full input model, actual parameter set, unmodified solver result, geometry/topology/support digest, runtime and duration; 23 runs total.
- `protocol.json`, `source-hashes-before.json`, `source-preservation.json`: declared protocol and SHA-256 evidence that all pre-existing tracked files stayed unchanged.
- `run-one.mjs`, `run-study.py`, `analyze-study.py`, `write-report.py`, `verify-study.py`: reproducible validation adapters and postprocessing; no replacement solver.

From the integrated repository root, Python 3 and Node ≥22.13 are sufficient; no browser or npm dependency installation is required. The exact recorded runtime was Node 24.19.0. To reproduce into a separate checkout, or deliberately refresh only these validation outputs:

```sh
python3 validation/physics/run-study.py --overwrite-study
python3 validation/physics/analyze-study.py
python3 validation/physics/write-report.py
python3 validation/physics/verify-study.py
```

The runner refuses to overwrite an existing study unless `--overwrite-study` is supplied; it never overwrites any original baseline. Run records are isolated processes with no shared prestress cache. Geometry, topology and supports are hash-compared to the baseline in every run. No validation script edits the case source files or deploys the application.

