# Cephalo-Silk design pipeline

This is a lightweight design/configuration layer above the preserved mechanics backend. The phrase **validated mechanics backend** refers only to the existing numerical sanity and cross-solver studies, not real-world engineering safety.

Input → DesignSpec → executable structural model → physics solver → response → design feedback → revised DesignSpec → re-analysis → comparison.

The input is a research prompt plus a reference to the existing concept image and authoritative model. This prototype does not infer new geometry from an image. `designspec.schema.json` describes the generic record; `bridge-backend.mjs` enforces this experiment's narrower contract. Only `primaryScale: 1 → 1.25` is allowed. Other cases/backends would require explicit adapters, contracts and separate studies.

## Separation of responsibilities

- **DesignSpec:** model reference, objective, constraints, exact baseline parameters, explicit overrides and provenance. It does not contain a duplicate model or solver equations.
- **Geometry/structural representation:** original `createModel(parameters)` materializes an in-memory model. Reference nodes, topology and supports remain unchanged. Original `model.json` remains untouched.
- **Mechanics:** original solver imports original hybrid and frame-element implementations. No new mechanics equations or convergence settings are introduced.
- **Diagnostics:** read-only postprocessing of complete solver output, preserving raw results. Reference-coordinate global force/moment diagnostics follow `validation/physics/analyze-study.py` and its archived study thresholds. A torque diagnostic reports the existing mixed frame/cable formulation's noncentral reference forces; it does not change reactions or redefine equilibrium.
- **Feedback:** a deterministic, transparent rule observes the baseline and proposes the preselected section increase. Hypothesis and observed outcome are separate records. No LLM call, agent orchestration, search or optimization is used.

A future geometry backend could sit between DesignSpec and structural abstraction, producing a model consumed by an appropriate mechanics adapter. Blender/bpy, mesh export and geometric reconstruction are intentionally unimplemented.

## Execution

From repository root, with Node >=22.13:

```bash
npm run closed-loop:bridge
```

This solver command uses only Node built-ins and existing source modules; npm dependency installation is needed for the app build/tests, not this experiment. Each solve runs in a fresh child process so the existing prestress cache cannot cross experiment stages. Baseline must exactly match both preserved full JSON results before iteration. JSON normalization represents JavaScript signed zero as zero, matching the existing integration test. A mismatch aborts; no solver/model retuning occurs.

Stage commands:

```bash
node scripts/run_closed_loop_bridge.mjs --baseline
node scripts/run_closed_loop_bridge.mjs --iteration
```

The second command checks the saved baseline and its source hashes, creates feedback and the one revised DesignSpec, executes the revision, and compares. Internal solver invocations are `--worker baseline_designspec` and `--worker design_iteration_01`. Use the public commands for provenance/preservation gates.

The full command overwrites only **new** experiment records in `closed_loop_bridge/`; source science/archives are never overwritten. Old downstream success records are removed before a new solve. Baseline failure cannot leave a stale successful comparison. The two DesignSpecs use the generic schema plus stricter adapter checks; `tests/closed-loop.mjs` exercises forbidden changes and provenance consistency.

Runtime metadata and timestamps vary on regeneration; numerical results and the fixed design choice must agree. Each response records exact input parameters, solver/model/pipeline hashes, executed model digest, execution HEAD and worktree status. An uncommitted execution is explicitly identified by worktree status and content hashes rather than claiming the current HEAD contains new code. Committing generated outputs necessarily happens after execution; it does not retroactively change the execution HEAD.

## Source inspection

See [source-inspection.md](source-inspection.md) for paths, parameter semantics, baseline configuration, validation availability and existing commands. See [the experiment](../closed_loop_bridge/README.md) for results and limitations.
