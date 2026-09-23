// Explicit implementations for the only verified structural closed-loop example.
import assert from 'node:assert/strict';
import {defaults} from '../cases/bridge/model.mjs';
import {validateSpec} from './bridge-backend.mjs';
import {scalarObjective} from './objective-adapter.mjs';
import {validatePolicy} from './iteration-controller.mjs';

export const supported = (value, policy) => Number.isFinite(value) &&
 value >= policy.design_variable.supported_range.min && value <= policy.design_variable.supported_range.max;
export const reductionPercent = (baseline, current) => 100 * (baseline - current) / baseline;

export function validateBridgePolicy(p) {
 assert.equal(p.schema_version, '3.0.0');
 validatePolicy(p.controller);
 assert.equal(p.controller.id, 'deterministic-fixed-rule');
 assert.equal(p.controller.max_revisions, 3);
 assert.equal(p.objective.adapter_id, 'bridge.maxDeckDisplacement');
 assert.equal(p.objective.id, 'maxDeckDisplacement');
 assert.equal(p.objective.direction, 'decrease');
 assert.deepEqual(p.objective.reference_baseline, {design_id:'bridge_baseline', primaryScale:1, response:'closed_loop_bridge/baseline_response.json'});
 assert.equal(p.objective.target.kind, 'relative_improvement_percent');
 assert.equal(p.objective.target.value, 20);
 assert.equal(p.design_variable.adapter_id, 'bridge.primaryScale');
 assert.equal(p.design_variable.id, 'primaryScale');
 assert.equal(p.design_variable.baseline, 1);
 assert.equal(p.design_variable.operation, 'add');
 assert.equal(p.design_variable.step, .25);
 assert.equal(p.design_variable.supported_range.min, .5);
 assert.equal(p.design_variable.supported_range.max, 1.5);
 assert.equal(p.design_variable.supported_range.ui_step, .05);
 assert.equal(p.acceptance.adapter_id, 'bridge.original-acceptance');
 assert.deepEqual(p.stopping.decision_precedence, ['reference_reproduction_failed','solver_nonconvergence','numerical_acceptance_failed','equilibrium_failed','no_improvement','target_reached','max_revision_steps_reached','unsupported_next_design_value','continue_fixed_increment']);
 for (const key of ['search_used', 'optimization_used', 'llm_or_agent_decisions']) assert.equal(p[key], false);
 return p;
}

export function validateTrajectorySpec(spec, p) {
 if (['bridge_baseline', 'design_iteration_01'].includes(spec.design_id)) return validateSpec(spec);
 const step = Number(spec.design_id.match(/^design_iteration_(\d{2})$/)?.[1]);
 assert.ok(Number.isInteger(step) && step >= 2 && step <= p.controller.max_revisions);
 const scale = defaults.primaryScale + step * p.design_variable.step;
 assert.ok(supported(scale, p), 'Unsupported primaryScale');
 assert.equal(spec.parent_design_id, `design_iteration_${String(step - 1).padStart(2, '0')}`);
 // Preserve V1's source, mechanics, baseline, objective and immutable-parameter contract.
 validateSpec({...spec, design_id:'design_iteration_01', parent_design_id:'bridge_baseline', parameter_overrides:{primaryScale:1.25}});
 assert.deepEqual(spec.parameter_overrides, {primaryScale:scale});
 return {...defaults, ...spec.parameter_overrides};
}

export function createBridgeObjective(config) {
 assert.equal(config.id, 'maxDeckDisplacement');
 assert.equal(config.direction, 'decrease');
 assert.equal(config.target.kind, 'relative_improvement_percent');
 assert.equal(config.target.value, 20);
 return {
  id:config.id,
  evaluate(record, baseline) {
   // Read the unchanged solver metric; do not redefine deck nodes or displacement.
   const value = record.result?.maxDeckDisplacement ?? null;
   const reference = baseline.result?.maxDeckDisplacement ?? null;
   return scalarObjective({id:config.id, label:'Maximum displacement magnitude over Bridge deck nodes',
    direction:config.direction, value, baseline_value:reference, target:config.target,
    valid:value > 0 && reference > 0});
  }
 };
}

export function bridgeAcceptance(record) {
 return {reference_reproduced:record.v1_verification?.full_result_exact_match ?? true,
  solver_converged:!record.execution_error && record.diagnostics?.solver?.converged === true,
  numerical_accepted:record.numerical_acceptance === true,
  force_equilibrium:record.diagnostics?.equilibrium?.force_pass === true,
  moment_equilibrium:record.diagnostics?.equilibrium?.moment_pass === true};
}

const immutableContent = spec => {
 const {design_id, parent_design_id, parameter_overrides, revision, provenance, ...rest} = spec;
 return rest;
};

export function createBridgeDesignVariable(p, {baselineSpec, firstRevisionSpec, revisionMetadata}) {
 validateBridgePolicy(p);
 const read = spec => (spec.parameter_overrides.primaryScale ?? spec.baseline_parameters.primaryScale);
 const validate = value => supported(value, p);
 const assertInvariants = (before, after) => {
  assert.deepEqual(immutableContent(after), immutableContent(before), 'Forbidden DesignSpec content changed');
  for (const spec of [before, after]) {
   assert.ok(Object.keys(spec.parameter_overrides).every(key => key === 'primaryScale'));
   validateTrajectorySpec(spec, p);
  }
 };
 return {id:'primaryScale', read, validate, assertInvariants,
  validateDesign:spec => { validateTrajectorySpec(spec, p); assertInvariants(baselineSpec, spec); },
  propose(spec) {
   const value = read(spec) + p.design_variable.step;
   return {value, supported:validate(value)};
  },
  apply(spec, request, {revision_step:step, previous}) {
   assert.ok(validate(request.value), 'Unsupported primaryScale blocked before DesignSpec construction');
   assert.equal(request.value, read(spec) + p.design_variable.step);
   if (step === 1) {
    assert.equal(read(firstRevisionSpec), request.value);
    assertInvariants(spec, firstRevisionSpec);
    return structuredClone(firstRevisionSpec);
   }
   const metadata = revisionMetadata({revision_step:step, previous, value:request.value});
   const revised = {...structuredClone(baselineSpec), design_id:`design_iteration_${String(step).padStart(2, '0')}`,
    parent_design_id:spec.design_id, parameter_overrides:{primaryScale:request.value},
    revision:{revision_step:step, previous_primaryScale:read(spec), step_size:p.design_variable.step,
     original_baseline_primaryScale:p.design_variable.baseline, illustrative_target_reduction_percent:p.objective.target.value,
     policy_reference:'closed_loop_bridge/iteration_policy.json', policy_sha256:metadata.policy_sha256,
     feedback_reference:metadata.feedback_reference, feedback_sha256:metadata.feedback_sha256,
     unchanged_parameters:Object.fromEntries(Object.entries(baselineSpec.baseline_parameters).filter(([key]) => key !== 'primaryScale'))},
    provenance:metadata.provenance};
   assertInvariants(spec, revised);
   return revised;
  }
 };
}

// Preserve the established public Bridge trajectory/decision JSON vocabulary.
export function bridgeDecision(decision) {
 const reason = ({reference_reproduction_failed:'version_1_reproduction_failed',
  target_reached:'illustrative_target_reached', unsupported_next_design_value:'unsupported_next_primary_scale'})[decision.reason] ?? decision.reason;
 return {accepted:decision.accepted, stop:decision.stop, reason,
  ...(decision.unsupported_next_value === undefined ? {} : {unsupported_next_value:decision.unsupported_next_value}),
  ...(decision.next_design_request ? {next_primaryScale:decision.next_design_request.value} : {}),
  target_reached:decision.target_reached, reduction_percent:decision.improvement_percent};
}
