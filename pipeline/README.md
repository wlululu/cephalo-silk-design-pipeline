# Cephalo-Silk adapter-based closed-loop controller

**DesignSpec → mechanics backend → structural response → objective adapter → generic controller → design-variable adapter → revised DesignSpec → re-analysis.**

DesignSpec remains a design/configuration layer referencing the original Bridge model. The mechanics backend remains separate. The input references the existing concept image and inferred idealized geometry; no fresh image reconstruction is performed. “Validated mechanics backend” refers only to existing numerical studies, not real-world safety.

## Fixed policy and supported domain

`closed_loop_bridge/iteration_policy.json` is the auditable controller configuration. It specifies:

- Metric: original solver `maxDeckDisplacement`, maximum Euclidean displacement over deck nodes, including prestress equilibration.
- Reference: original baseline at `primaryScale = 1.00`. Every percentage uses this baseline, never the preceding revision.
- Sole variable: `primaryScale`; update: current + **0.25**.
- Illustrative target: **≥20% reduction**. This is not a serviceability requirement, engineering design limit, safety criterion or claim of optimality.
- Maximum: **3 revision steps after baseline**; stop as soon as a stop condition applies.
- Existing supported range: **0.50–1.50**, inspected directly in `cases/bridge/BridgeCase.tsx` and checked on each run. The generator accepts arithmetic values beyond that UI range, but this is not evidence that they are supported. **1.75 is rejected**; the range is not expanded.
- No search, candidate selection, step-size tuning, LLM or agent decisions.

The frozen Version 1 revision at 1.25 is reused with its existing DesignSpec and response. A fresh solve must reproduce the entire serialized saved result and diagnostics before the controller proceeds. It is not generated using a replacement rule. The design-variable adapter returns the saved first-revision DesignSpec unchanged and constructs subsequent DesignSpecs only after a continue decision.

## Decision precedence and failure handling

For each completed or failed solver invocation, the first applicable condition wins:

1. Failed provenance/reference reproduction → reject (`reference_reproduction_failed`).
2. Solver error or nonconvergence → reject (`solver_nonconvergence`).
3. Invalid/nonfinite scalar or numerical rejection → reject (`numerical_acceptance_failed`).
4. Failed force or moment equilibrium → reject (`equilibrium_failed`).
5. No strict improvement over the previous accepted scalar, using its objective direction → reject (`no_improvement`).
6. Baseline-relative objective target reached → accept and stop (`target_reached`).
7. Maximum revisions reached → accept and stop (`max_revision_steps_reached`).
8. Adapter's next value unsupported → accept current state and stop (`unsupported_next_design_value`).
9. Otherwise accept current state and continue (`continue_fixed_increment`).

The Bridge reporting boundary maps the generic reference, target, and range reason names to the historical `version_1_reproduction_failed`, `illustrative_target_reached`, and `unsupported_next_primary_scale`. Existing public decisions and numerical records retain their meaning and exact values. A failed attempted state never replaces the previous accepted state.

The controller calls `propose` only after gates 1–7 pass. An unsupported proposal is never applied. It calls `apply` only for a continue decision and checks invariants and the requested value before the next solve. Neither an update nor a solve occurs after a stop. The adapters and callbacks are trusted implemented modules, not expressions loaded from JSON.

Every attempted state retains a response/verification record and a machine-readable decision, including unsuccessful states. Final accepted DesignSpec is separate from a failed attempted state. No new solve is invoked after any stop. A solver exception records its error and unavailable quantities as null; it does not fabricate partial output. Failed numerical/provenance stops cause a nonzero command exit after saving the trajectory. Range/count stops may validly finish with target false.

Convergence checks use unchanged exported initial/load residual tolerances at every original load stage. Global reference-coordinate force and moment checks use existing `validation/physics/protocol.json` thresholds (1e-6 relative). The original diagnostic implementation is unchanged. Reference moments include support moments and retain the model's small-displacement-frame/corotational-cable interpretation. Existing yield/Euler screening quantities are reported separately; they are not newly imposed safety acceptance gates.

## Implementation responsibilities

| File | Responsibility |
|---|---|
| `iteration-controller.mjs` | Generic scalar state machine, direction-aware improvement, acceptance precedence, revision limit, lazy update requests, and stop/continue orchestration |
| `objective-adapter.mjs` | Common scalar record and relative-improvement normalization for decrease/increase |
| `adapter-registry.mjs` | Static allowlists resolving explicitly implemented objective, design-variable, and acceptance adapters |
| `bridge-adapters.mjs` | Bridge objective extraction, fixed update/range, DesignSpec construction/invariants, verified policy checks, acceptance flags, and historical decision formatting |
| `bridge-trajectory.mjs` | Bridge execution provenance, V1 preservation/verification, unchanged numerical acceptance checks, and trajectory rows |
| `bridge-backend.mjs` | Unchanged original model/solver adapter and model invariant checks |
| `diagnostics.mjs` | Unchanged original response diagnostics |
| `../scripts/run_closed_loop_bridge.mjs` | Fresh-process solves, record/feedback writing, generic-controller wiring, and Bridge reporting |
| `../tests/iteration-controller.mjs` | Synthetic scalar software tests independent of Bridge mechanics |
| `../tests/closed-loop.mjs` | Adapter contracts, forbidden inputs, historical identity, and full-response regression against the pre-refactor commit |

### Objective adapter contract

`evaluate(response, baselineResponse)` returns `{id, label, direction, value, baseline_value, improvement_percent, target, target_reached, valid}`. The controller retains the original baseline response throughout the loop. The objective adapter extracts the domain metric and owns target evaluation. `direction` is `decrease` or `increase`.

Normalization means a common scalar representation, not changing physical units or dividing the metric by baseline before comparison. The helper computes positive improvement as `100 * (baseline - current) / abs(baseline)` for decrease, or `100 * (current - baseline) / abs(baseline)` for increase. A zero/nonfinite reference cannot define this relative target and is invalid. The positive Bridge displacement uses exactly the original arithmetic order. Its adapter reads `result.maxDeckDisplacement` directly; deck-node selection and displacement calculations stay entirely in the unchanged solver. Increase is exercised only with synthetic software fixtures, not a new structural objective.

### Design-variable adapter contract

| Method | Responsibility |
|---|---|
| `read(design)` | Extract the controlled value from a domain-specific DesignSpec |
| `validate(value)` | Check finite/type/range support; return a boolean |
| `validateDesign(design)` | Validate the complete design before execution; throw on invalid input |
| `propose(design)` | Return a pure `{value, supported}` update request; no solve or design mutation |
| `apply(design, request, {revision_step, previous})` | Return a revised DesignSpec; never mutate the input |
| `assertInvariants(before, after)` | Verify forbidden variables and engineering content remain unchanged |

The Bridge adapter alone reads `parameter_overrides.primaryScale`, adds 0.25, enforces 0.50–1.50, and constructs the revised DesignSpec. It preserves baseline parameters and immutable engineering fields, allowing only the controlled override and design/parent/revision/provenance metadata to differ. The saved first-revision spec is returned byte-compatible with its historical content. For later revisions the runner supplies record hashes and provenance through an explicit JavaScript callback; the adapter constructs the spec. Original backend model checks additionally enforce geometry, connectivity, loads, materials, supports, secondary sections and cables.

### Mechanics backend and acceptance

`obtainState({revision_step, design, previous})` executes the selected mechanics backend and returns `{response, validity, ...callerData}`. The controller does not import a solver or access response-specific fields. Bridge execution still uses the unchanged generator/solver in a fresh process per state. The acceptance adapter converts original diagnostics into `reference_reproduced`, `solver_converged`, `numerical_accepted`, `force_equilibrium`, and `moment_equilibrium` flags. It introduces no new physics thresholds. The response remains available to the objective adapter; reporting data is opaque to the controller.

### Policy and extension boundary

Policy schema 3 separates `controller`, `objective`, `design_variable`, `acceptance`, and `stopping`. This is a policy-only change; it is unrelated to DesignSpec schema version 1. `controller.max_revisions` is generic. The Bridge policy validator separately locks the verified metric, direction, target, update, range, and revision limit. `stopping.decision_precedence` documents fixed code behavior, not a configurable reorder operation. Acceptance references the original solver tolerances and physics protocol.

The registry uses static `Map` entries and rejects unknown IDs. It does not evaluate JavaScript, import paths from JSON, or discover plugins. Adding a supported objective/variable requires explicit implementation and registration, compatible acceptance/backend wiring, and validation. The Bridge is the only registered structural example; the generic controller itself contains no Bridge metric, parameter storage, target percentage, increment, or range.

No new dependency is needed. Generic `designspec.schema.json` remains unchanged. The original model generator, geometry, solver/hybrid/frame elements, cable law, workers, UI, other cases, numerical tolerances and archived science are untouched.

## Reproduction

```bash
npm ci
npm run closed-loop:bridge
npm run test:closed-loop
npm run build
npm test
```

The loop itself needs only Node built-ins and existing modules. Each solve runs in a fresh Node process, avoiding prestress-cache carryover. The internal worker commands for the actual trajectory are `node scripts/run_closed_loop_bridge.mjs --worker 0`, `--worker 1`, and `--worker 2`. Use the full command to enforce the controller sequence; old overwrite-style V1 stage flags are retired.

V1 records in `closed_loop_bridge/` remain byte-identical to starting commit `f6c3b73059246a36e167e98f12ef1b393ed893ab`, including prior feedback, comparison and historical publication/preservation metadata. Regenerated trajectory files are:

- `iteration_policy.json`: fixed configuration and source references.
- `trajectory/baseline_verification.json`, `trajectory/iteration_01_verification.json`: fresh complete raw responses, exact original DesignSpecs, V1 match evidence, diagnostics and decisions.
- `trajectory/feedback_for_iteration_02.json`, `trajectory/design_iteration_02.json`, `trajectory/iteration_02_response.json`: the single newly introduced state.
- `trajectory/preservation_verification.json`: all original scientific files and all frozen V1 records.
- `trajectory_comparison.json`: every state, baseline-relative changes, section properties, cable transitions, stopping reason and final accepted DesignSpec.
- `trajectory_summary.md`: automatically generated meeting-ready summary.

The command regenerates only these V2-owned outputs; old V1 outputs never get deleted or rewritten. Timestamps/runtime/worktree metadata change on reruns. Response records include exact DesignSpecs, parameters, source/model/solver paths, original source commit, starting pipeline commit, executing HEAD, source/code/policy hashes and runtime. Historical V1 pipeline hashes are checked against V1 Git objects, not against newly refactored code. Git metadata is inspected read-only by the runtime.

## Observed trajectory and tradeoffs

Actual scales: 1.00 → 1.25 → 1.50. Deck displacement: 36.745936861 → 31.081610663 → 27.919093139 mm. Final reduction: **24.021278%**. Stop: `illustrative_target_reached`. No Iteration 03 execution.

PrimaryScale multiplies tube diameter and wall thickness. Area scales as s²; Iy/Iz/J as s⁴. At 1.25 these increase 56.25% and 144.140625%; at 1.50 they increase 125% and 406.25%, all relative to baseline and only for affected primary sections. Greater primary-section/material demand is explicit; no numeric whole-structure mass increase or added self-weight is modeled.

Observed marginal deck reductions are 5.664326199 then 3.162517523 mm for equal +0.25 increments: diminishing absolute returns in this two-step trajectory, not a general law. Forces redistribute; four cables activate in Iteration 01 and none change state in Iteration 02. Maximum Euler screening indicators remain above 1 (5.628836 → 4.209098 → 3.724136). Target attainment does not establish real-world safety or satisfactory structural design.

## Cross-platform reproducibility

User-reported prior check: macOS 26.6.2, arm64, Node v24.21.0, npm 11.19.0 produced approximately 1e-13-scale Loop Towers differences under exact-object regression. The user reports Ubuntu + Node 24 GitHub Actions passed exactly. These are prior observations, not rerun claims from this session. This session uses Linux x64, Node v24.19.0, npm 11.9.0. Existing Loop Towers records and the exact-comparison integration-test scheme remain unchanged. The V1 Bridge gate and the pre-refactor full-response regression use exact JSON comparisons; a mismatch stops the loop rather than relaxing tolerances.

## Limitations and Git handling

This is deterministic multi-step design refinement of one idealized executable structural model. No optimization algorithm, topology change, Blender, new UI, machine learning or multi-agent logic is implemented. No manuscript changes or figures are made. Source repository remains immutable. This architectural refactor starts at `22fb33f4078dc56c920ee9296c442617749374b5`. Changes are left in the working tree for manual review; no commit/tag/push/remote mutation is performed.

## Architectural regression evidence

`npm run test:closed-loop` first runs synthetic tests for both directions, improvement/worsening/equality, targets, invalid/nonfinite inputs, acceptance precedence, revision/range limits, adapter calls, forbidden updates, and no solve after stop. These are software tests only. It then compares regenerated Bridge records to immutable Git objects at `22fb33f4078dc56c920ee9296c442617749374b5`: complete raw responses (all nodes, reactions, member quantities and nonlinear history), diagnostics, parameters, cable transitions, section-property tradeoffs, and public stopping decisions must match exactly. Expected scientific data are never regenerated to make tests pass.

Only execution metadata, policy structure/code hashes and dependent response/feedback hashes change. The original baseline and Iteration 01 DesignSpecs/responses, DesignSpec schema, source assets and validation records remain byte-identical. Iteration 02 retains identical engineering content; its execution provenance and dependent metadata hashes are refreshed by the same public reproduction command. The generated trajectory summary remains unchanged.

## Preservation scope

`verifyPreservation()` compares exact Git blob hashes against the validated
Structural Lab source commit. Its explicit presentation-only exceptions are
`main.tsx` (route composition) and `shared/Platform.tsx` (platform header and
navigation). These files contain no structural model or mechanics calculations.
The existing `README.md` and `package.json` documentation/package-script
exceptions remain. No directory patterns or scientific files are exempted;
case interfaces/renderers, model generators, geometry, solvers, hybrid/frame
and cable formulations, workers, and original validation assets remain checked.

`tests/pipeline-preservation.mjs` verifies the actual authorized UI shell and
uses isolated file copies to prove that model and solver modifications still
fail the same guard. Reruns refresh provenance and dependent record hashes;
full scientific responses and trajectory decisions must still match exactly.
