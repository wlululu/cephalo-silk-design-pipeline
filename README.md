# Cephalo-Silk Design Pipeline

**Live interactive site:** [Open the Cephalo-Silk Design Pipeline](https://wlululu.github.io/cephalo-silk-design-pipeline/#/pipeline)

Cephalo-Silk Design Pipeline extends the [Cephalo-Silk Structural Lab](https://github.com/wlululu/cephalo-silk-structural-lab) from executable structural reconstructions toward a reusable physics-guided design workflow. It connects design representation to executable mechanics so that a design can be evaluated and iteratively revised against explicit requirements, with transparent, auditable design feedback.

## Workflow

Image / Prompt / Design Intent → DesignSpec → Executable Structural Model → Physics Analysis → Design Feedback → Revised DesignSpec → Re-analysis → Stop / Continue

`DesignSpec` records design intent, the referenced model and mechanics backend, the objective, permitted parameter changes, constraints, and provenance. The architecture is intended to support user-defined objectives, design variables, update rules, constraints, and mechanics backends for requirement-driven design refinement.

**The current complete executable closed-loop demonstration is the Twin-Arch Web Bridge.** It uses the existing inferred structural model and original solver; the reproduction command does not generate geometry from a new image or prompt. Loop Towers and Woven-Wing Pavilion remain executable Structural Lab cases but are not connected to the closed-loop controller.

The closed-loop controller uses explicit objective and design-variable adapters. The verified Bridge adapters implement maximum deck displacement, `primaryScale`, a fixed `+0.25` update, and an illustrative target of at least 20% displacement reduction from baseline. New objectives or controlled parameters require implementing, registering, and validating the corresponding adapters; configuration alone cannot enable them.

## Interactive Pipeline Explorer

The [live interactive site](https://wlululu.github.io/cephalo-silk-design-pipeline/#/pipeline) provides two connected environments:

- **Design Pipeline** — explores the generalized physics-guided workflow and the verified Bridge closed-loop trajectory, including saved structural states, controller decisions, physics checks, and section tradeoffs.
- **Structural Lab** — provides the executable Bridge, Loop Towers, and Woven-Wing Pavilion structural environments, accessible from `#/structural-lab`.

Replay in the Design Pipeline displays the saved verified trajectory; it does not rerun the controller.

For local use, run `npm run dev` and open the URL printed by Vite.

## Design Iteration

### Objective

The objective expresses the user's engineering or design performance goal. The current example is **reduce maximum deck displacement**: the solver's maximum displacement magnitude over deck nodes, including prestress equilibration. Possible future objectives include stress, force, stiffness, material demand, cable response, or combinations of performance quantities; these are not implemented controller objectives.

### Design parameter

The controlled parameter is the quantity permitted to change. Here, `primaryScale` scales primary-member tube diameter and wall thickness together. Geometry coordinates, connectivity, supports, loads, materials, secondary sections, and cable definitions remain fixed during the loop.

### Update rule

```text
primaryScale_next = primaryScale_current + 0.25
```

This is a deterministic fixed rule, not a search or optimizer. The baseline and first revision use saved DesignSpecs and are freshly checked against their saved responses before the controller advances.

### Stopping rule

- Stop when maximum deck displacement decreases by **at least 20% relative to the original baseline**.
- Allow at most **3 revision steps** after baseline.
- Stop early for solver failure/non-convergence, numerical or equilibrium failure, failed reproduction of saved reference responses, loss of improvement over the previous accepted state, or an unsupported next parameter value.

The supported `primaryScale` range is **0.50–1.50**. Starting at 1.00 with fixed +0.25 steps permits two revisions; a third value of 1.75 is rejected even if the target has not been reached. The 20% target is illustrative, not a structural-code or safety requirement.

## Bridge Example

| Design state | primaryScale | Max deck displacement | Reduction from baseline |
|---|---:|---:|---:|
| Baseline | 1.00 | 36.746 mm | — |
| Iteration 01 | 1.25 | 31.082 mm | 15.41% |
| Iteration 02 | 1.50 | 27.919 mm | 24.02% |

Iteration 01 did not meet the illustrative 20% target. The controller applied the same +0.25 rule, and Iteration 02 reached 24.02% reduction. The controller then stopped; no further iteration was executed. This is a target-reaching trajectory, not an optimum.

The improvement increases section/material demand: at the final state, affected primary-section area is **125% greater** and `Iy`/`Iz`/`J` are **406.25% greater** than baseline. Whole-structure mass and added self-weight are not modeled in this design-refinement objective. Existing Euler screening indicators remain above 1; target attainment is not equivalent to engineering safety certification.

## Reproduce the Bridge Workflow

Use Git, Node.js **22.13 or later** (Node **24** recommended), and npm. Retain the clone's Git history: provenance checks read the original source and pipeline commits. Initial dependency installation requires access to the npm registry; the workflow requires no API key or external model service.

```bash
git clone https://github.com/wlululu/cephalo-silk-design-pipeline.git
cd cephalo-silk-design-pipeline
npm ci
npm run closed-loop:bridge
```

`npm run closed-loop:bridge` checks scientific-file preservation, solves and verifies the saved baseline and first revision, then applies the fixed rule until a stopping condition is met. It regenerates the trajectory records and summary while retaining the archived baseline and first-revision records. Execution timestamps and runtime provenance are refreshed on reruns.

Run the checks and production build:

```bash
npm run test:closed-loop
npm run build
npm test
```

The closed-loop tests check controller decisions, saved responses, invariants, and provenance. The build produces the browser application in `dist/`; `npm test` checks scientific preservation, original-versus-current numerical results, and static serving. Exact numerical comparisons can expose platform-dependent floating-point differences; see the [reproducibility notes](pipeline/README.md#cross-platform-reproducibility).

To explore the three Structural Lab cases interactively, run `npm run dev` and open the local URL printed by Vite. The closed-loop demonstration runs through the command above.

## Outputs

| Location | Contents |
|---|---|
| [closed_loop_bridge/iteration_policy.json](closed_loop_bridge/iteration_policy.json) | Fixed policy, supported range, stopping criteria, and source references |
| [closed_loop_bridge/trajectory_comparison.json](closed_loop_bridge/trajectory_comparison.json) | State comparisons, design decisions, and final stopping reason |
| [closed_loop_bridge/trajectory_summary.md](closed_loop_bridge/trajectory_summary.md) | Readable trajectory and section tradeoffs |
| [closed_loop_bridge/trajectory/](closed_loop_bridge/trajectory/) | Exact design states and parameters, structural responses, convergence/equilibrium information, forces and cable states, feedback, and provenance |

## Adapting the Pipeline

The conceptual interface is:

**objective + controlled design variable + update/feedback rule + stopping criteria + mechanics backend**

The following are future examples, not currently verified executable configurations:

| Example objective | Possible controlled variable |
|---|---|
| Limit cable force | Cable prestress |
| Reduce material demand subject to a displacement constraint | Section dimensions |

The present repository's verified adapters implement the Bridge `maximum deck displacement / primaryScale` case. New objective/parameter combinations require implementation and validation of the corresponding metric and parameter adapter.

An extension needs a response metric/extractor, a design-parameter adapter, an update rule, validity/acceptance logic, and tests for the intended mechanics backend. The general fields in `DesignSpec` describe the design; they do not make new objectives or controlled variables executable. The current validators also enforce the update size, target, revision limit, and supported range, so editing the policy JSON alone does not enable a different iteration strategy.

## Structural Cases

### Twin-Arch Web Bridge

Executable reconstruction, structural analysis, validation, and the closed-loop design demonstration.

### Loop Towers

Executable reconstruction, structural analysis, and parameter perturbation / validation. Not connected to the closed-loop controller.

### Woven-Wing Pavilion

Executable reconstruction, structural analysis, and parameter perturbation / validation. Not connected to the closed-loop controller.

The reusable closed-loop pipeline is currently demonstrated end-to-end on the Bridge case.

## Repository Structure

```text
cephalo-silk-design-pipeline/
  pipeline/           DesignSpec, Bridge adapters, controller, and diagnostics
  closed_loop_bridge/ Policy, saved reference states, and trajectory outputs
  cases/              Bridge application and native-case source pointers
  public/cases/       Case assets, models, solvers, and native applications
  validation/         Preserved numerical validation records
  tests/              Controller, preservation, integration, and serving checks
  docs/               Development history and scientific provenance
```

## Scope and Limitations

The generic controller is deterministic, rule-based, single-objective, and single-design-variable. The Bridge remains its only fully implemented and scientifically verified closed-loop example. It does not perform numerical optimization, topology optimization, autonomous engineering design, structural-code compliance, or safety certification. Results retain the idealized models' original mechanics assumptions and limitations.

Future work may expand objectives, design variables, cases, feedback strategies, optimization, or agent reasoning. These are extension directions, not present capabilities.

## Detailed Documentation and Provenance

The original [Structural Lab source](https://github.com/wlululu/cephalo-silk-structural-lab) is preserved at commit `b6eeff872ccd62ddab8563cd2de6dcaf3a749340`.

- [Development history and scientific provenance](docs/development-and-provenance.md)
- [Pipeline architecture and implementation](pipeline/README.md)
- [Bridge trajectory summary](closed_loop_bridge/trajectory_summary.md)
- [Machine-readable trajectory comparison](closed_loop_bridge/trajectory_comparison.json)
- [Iteration policy](closed_loop_bridge/iteration_policy.json)
- [Source inspection](pipeline/source-inspection.md)
- [Validation records](validation/)
