// Software-only synthetic scalars. No structural backend/model/registry imports.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runController, decide, validatePolicy} from '../pipeline/iteration-controller.mjs';
import {scalarObjective} from '../pipeline/objective-adapter.mjs';

const valid = () => ({reference_reproduced:true, solver_converged:true,
 numerical_accepted:true, force_equilibrium:true, moment_equilibrium:true});
const objective = (value, direction = 'decrease', target = 20, baseline = 100) =>
 scalarObjective({id:'synthetic', label:'Synthetic scalar', direction, value,
  baseline_value:baseline, target:{kind:'relative_improvement_percent', value:target}});
const state = (value, direction = 'decrease', step = 1) =>
 ({revision_step:step, objective:objective(value, direction), validity:valid()});
const never = () => { throw Error('Must not request an update after stop'); };

function simulate(values, {direction = 'decrease', target = 20, max = 3, maxRevisions = 5,
 mutate = () => {}, initialDesign = {slot:0, fixed:'unchanged'}, applyOverride} = {}) {
 const calls = {solve:[], evaluate:[], propose:[], apply:[], invariants:[], events:[]};
 const variable = {
  read:design => design.slot,
  validate:value => Number.isInteger(value) && value >= 0 && value <= max,
  validateDesign:design => assert.equal(design.fixed, 'unchanged'),
  propose(design) {calls.propose.push(design.slot); return {value:design.slot + 1, supported:design.slot + 1 <= max};},
  apply(design, request, context) {
   calls.apply.push(request.value); calls.events.push(`apply:${request.value}`);
   return applyOverride ? applyOverride(design, request) : {...design, slot:request.value};
  },
  assertInvariants(before, after) {calls.invariants.push(after.slot); assert.equal(after.fixed, before.fixed);}
 };
 const result = runController({policy:{max_revisions:maxRevisions}, initialDesign,
  objectiveAdapter:{evaluate(response, baseline) {
   calls.evaluate.push(response);
   return objective(response, direction, target, baseline);
  }}, designVariableAdapter:variable,
  obtainState({revision_step, design}) {
   calls.solve.push(design.slot); calls.events.push(`solve:${design.slot}`);
   const obtained = {response:values[revision_step], validity:valid()}; mutate(obtained, revision_step); return obtained;
  },
  onEvaluated(s) {calls.events.push(`${s.decision.stop ? 'stop' : 'continue'}:${s.revision_step}`);}
 });
 return {result, calls};
}

for (const [direction, values] of [['decrease',[100,90,80]], ['increase',[100,110,120]]]) {
 test(`${direction}: improves, misses target, then reaches target`, () => {
  const {result, calls} = simulate(values, {direction});
  assert.deepEqual(result.states.map(s => s.objective.improvement_percent), [0,10,20]);
  assert.equal(result.states[1].decision.stop, false);
  assert.equal(result.states[1].decision.target_reached, false);
  assert.equal(result.final_stopping_reason, 'target_reached');
  assert.equal(result.target_met, true);
  assert.equal(result.executed_revision_steps, 2);
  assert.deepEqual(calls.solve, [0,1,2]); assert.deepEqual(calls.evaluate, values);
  assert.deepEqual(calls.propose, [0,1]); assert.deepEqual(calls.apply, [1,2]);
  assert.deepEqual(calls.invariants, [1,2]);
  assert.equal(calls.events.at(-1), 'stop:2');
 });
 for (const current of direction === 'decrease' ? [100,101] : [100,99]) {
  test(`${direction}: ${current === 100 ? 'no improvement' : 'worse'} rejects and retains previous`, () => {
   const {result, calls} = simulate([100,current,50], {direction});
   assert.equal(result.final_stopping_reason, 'no_improvement');
   assert.equal(result.final_accepted_state.revision_step, 0);
   assert.deepEqual(calls.solve, [0,1]); assert.deepEqual(calls.apply, [1]);
   assert.deepEqual(calls.propose, [0]); assert.equal(calls.events.at(-1), 'stop:1');
  });
 }
}

for (const value of [NaN, Infinity, -Infinity, null, undefined]) {
 test(`invalid scalar ${String(value)} stops without further update or solve`, () => {
  const {result, calls} = simulate([100,value,70]);
  assert.equal(result.final_stopping_reason, 'numerical_acceptance_failed');
  assert.deepEqual(calls.solve, [0,1]); assert.deepEqual(calls.apply, [1]);
  assert.deepEqual(calls.propose, [0]); assert.equal(result.final_accepted_state.revision_step, 0);
 });
}
for (const baseline of [0,NaN,Infinity,null]) {
 test(`invalid baseline ${String(baseline)} never updates`, () => {
  const {result, calls} = simulate([baseline,80]);
  assert.equal(result.final_stopping_reason, 'numerical_acceptance_failed');
  assert.equal(result.final_accepted_state, null);
  assert.deepEqual(calls.solve, [0]); assert.deepEqual(calls.apply, []); assert.deepEqual(calls.propose, []);
 });
}

const failures = [
 ['reference_reproduced','reference_reproduction_failed'],
 ['solver_converged','solver_nonconvergence'],
 ['numerical_accepted','numerical_acceptance_failed'],
 ['force_equilibrium','equilibrium_failed'],
 ['moment_equilibrium','equilibrium_failed']
];
for (const [flag, reason] of failures) {
 test(`${flag}: failure wins over target and forbids further callbacks`, () => {
  const {result, calls} = simulate([100,70,60], {mutate:(s,step) => {if(step === 1) s.validity[flag] = false;}});
  assert.equal(result.final_stopping_reason, reason);
  assert.equal(result.target_met, false); assert.equal(result.final_accepted_state.revision_step, 0);
  assert.deepEqual(calls.solve, [0,1]); assert.deepEqual(calls.apply, [1]); assert.deepEqual(calls.propose, [0]);
 });
}

test('acceptance precedence is reference, solver, numerical, equilibrium', () => {
 const s = state(70);
 for (const [flag] of failures) s.validity[flag] = false;
 for (const [flag, reason] of failures) {
  assert.equal(decide(s, state(100), {max_revisions:1}, never).reason, reason);
  s.validity[flag] = true;
 }
});
test('no improvement wins even when current value meets target', () => {
 assert.equal(decide(state(80), state(75), {max_revisions:1}, never).reason, 'no_improvement');
});
test('target precedes revision count and unsupported next value', () => {
 assert.equal(decide(state(80), state(90), {max_revisions:1}, never).reason, 'target_reached');
});
test('revision count precedes range and requests no update', () => {
 const {result, calls} = simulate([100,95,90], {maxRevisions:1, max:1});
 assert.equal(result.final_stopping_reason, 'max_revision_steps_reached');
 assert.deepEqual(calls.solve, [0,1]); assert.deepEqual(calls.propose, [0]); assert.deepEqual(calls.apply, [1]);
});
test('zero revisions evaluates baseline only', () => {
 const {result, calls} = simulate([100,90], {maxRevisions:0});
 assert.equal(result.executed_revision_steps, 0); assert.deepEqual(calls.solve, [0]); assert.deepEqual(calls.apply, []);
});
test('unsupported next parameter is proposed but never applied or solved', () => {
 const {result, calls} = simulate([100,95,90], {max:1});
 assert.equal(result.final_stopping_reason, 'unsupported_next_design_value');
 assert.equal(result.states.at(-1).decision.unsupported_next_value, 2);
 assert.deepEqual(calls.solve, [0,1]); assert.deepEqual(calls.propose, [0,1]); assert.deepEqual(calls.apply, [1]);
});
test('unreached target permits supported next request', () => {
 const decision = decide(state(90), state(100), {max_revisions:3}, () => ({value:2, supported:true}));
 assert.equal(decision.stop, false); assert.equal(decision.target_reached, false);
 assert.deepEqual(decision.next_design_request, {value:2, supported:true});
});
test('adapter invariant and applied-value mismatches fail before next solve', () => {
  assert.throws(
   () => simulate([100,90], {applyOverride:(d,r) => ({...d,slot:r.value,fixed:'changed'})}),
   error => error?.code === 'ERR_ASSERTION' &&
            error?.actual === 'changed' &&
            error?.expected === 'unchanged'
  );
  assert.throws(() => simulate([100,90], {applyOverride:d => d}), /requested value/);
  assert.throws(() => simulate([100], {initialDesign:{slot:9,fixed:'unchanged'}}), /Unsupported design value/);
 });
test('invalid generic policy is rejected', () => {
 for(const max_revisions of [-1,NaN,Infinity,1.1,'3']) assert.throws(() => validatePolicy({max_revisions}));
});
test('invalid direction and executable-looking target strings are rejected', () => {
 assert.throws(() => objective(80,'sideways'), /direction/);
 assert.throws(() => objective(80,'decrease','process.exit()'));
});
test('signed scalar reference uses magnitude; nonfinite improvement is invalid', () => {
 assert.equal(objective(-80,'increase',20,-100).improvement_percent,20);
 assert.equal(objective(-120,'decrease',20,-100).improvement_percent,20);
 assert.equal(objective(1e308,'increase',20,1e-308).valid,false);
});
