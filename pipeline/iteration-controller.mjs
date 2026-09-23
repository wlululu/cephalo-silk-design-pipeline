// Domain-independent, synchronous state machine. No file I/O or mechanics imports.
import assert from 'node:assert/strict';

export function validatePolicy(policy) {
 assert.ok(Number.isInteger(policy.max_revisions) && policy.max_revisions >= 0);
 return policy;
}

export function acceptanceFailure(state) {
 const v = state.validity, o = state.objective;
 if (v?.reference_reproduced === false) return 'reference_reproduction_failed';
 if (v?.solver_converged !== true) return 'solver_nonconvergence';
 if (v?.numerical_accepted !== true || o?.valid !== true ||
     !Number.isFinite(o.value) || !Number.isFinite(o.baseline_value) ||
     !Number.isFinite(o.improvement_percent) ||
     !['decrease', 'increase'].includes(o.direction) || typeof o.target_reached !== 'boolean')
  return 'numerical_acceptance_failed';
 if (v.force_equilibrium !== true || v.moment_equilibrium !== true) return 'equilibrium_failed';
 return null;
}

// nextRequest is lazy: never propose an update after an earlier stopping condition.
export function decide(state, previous, policy, nextRequest) {
 const failure = acceptanceFailure(state), o = state.objective;
 const base = {accepted:false, stop:true, target_reached:false,
  improvement_percent:Number.isFinite(o?.improvement_percent) ? o.improvement_percent : null};
 if (failure) return {...base, reason:failure};
 if (previous && !(o.direction === 'decrease' ? o.value < previous.objective.value : o.value > previous.objective.value))
  return {...base, reason:'no_improvement'};
 const accepted = {...base, accepted:true};
 if (o.target_reached) return {...accepted, reason:'target_reached', target_reached:true};
 if (state.revision_step >= policy.max_revisions) return {...accepted, reason:'max_revision_steps_reached'};
 const request = nextRequest();
 if (request.supported !== true) return {...accepted, reason:'unsupported_next_design_value', unsupported_next_value:request.value};
 return {...accepted, stop:false, reason:'continue_fixed_increment', next_design_request:request};
}

/**
 * objectiveAdapter.evaluate(response, baselineResponse) -> normalized scalar record.
 * designVariableAdapter: read(design), validate(value), validateDesign(design),
 * propose(design) -> {value, supported}, apply(design, request, context) -> design,
 * assertInvariants(before, after). Only apply constructs a revised design.
 * obtainState returns {response, validity, ...optional caller data}; it owns solves.
 */
export function runController({policy, initialDesign, objectiveAdapter, designVariableAdapter,
 obtainState, onEvaluated = () => {}}) {
 validatePolicy(policy);
 const variable = designVariableAdapter, states = [];
 let design = initialDesign, previous = null, baselineResponse;
 for (let step = 0; step <= policy.max_revisions; step++) {
  variable.validateDesign(design);
  assert.ok(variable.validate(variable.read(design)), 'Unsupported design value blocked before execution');
  const obtained = obtainState({revision_step:step, design, previous});
  if (step === 0) baselineResponse = obtained.response;
  const state = {...obtained, revision_step:step, design,
   objective:objectiveAdapter.evaluate(obtained.response, baselineResponse)};
  state.decision = decide(state, previous, policy, () => variable.propose(design));
  states.push(state);
  if (state.decision.accepted) previous = state;
  onEvaluated(state, states);
  if (state.decision.stop) return {states, final_stopping_reason:state.decision.reason,
   executed_revision_steps:step, target_met:state.decision.target_reached, final_accepted_state:previous};
  const request = state.decision.next_design_request;
  assert.ok(variable.validate(request.value), 'Unsupported update blocked before application');
  const revised = variable.apply(design, request, {revision_step:step + 1, previous});
  variable.assertInvariants(design, revised);
  assert.equal(variable.read(revised), request.value, 'Adapter did not apply the requested value');
  design = revised;
 }
 throw Error('Controller failed to stop within revision limit');
}
