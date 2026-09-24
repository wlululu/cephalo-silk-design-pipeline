import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {explorer, presentTrajectory} from '../pipeline-ui/data.mjs';
const read = path => JSON.parse(fs.readFileSync(new URL('../' + path, import.meta.url)));
const policy = read('closed_loop_bridge/iteration_policy.json');
const trajectory = read('closed_loop_bridge/trajectory_comparison.json');

test('loads the canonical policy and exposes only the executed trajectory', () => {
 assert.deepEqual(explorer.policy, policy);
 assert.equal(explorer.states.length, 3);
 assert.deepEqual(explorer.states.map(s => s.scale), [1, 1.25, 1.5]);
 assert.deepEqual(explorer.states.map(s => s.id), trajectory.states.map(s => s.design_id));
 assert.deepEqual(explorer.states.map(s => s.label), ['Baseline', 'Iteration 01', 'Iteration 02']);
 assert.ok(!explorer.states.some(s => s.revision === 3));
 assert.deepEqual(explorer.unexecutedRevisions, [3]);
});
test('metrics, decisions, section tradeoffs and acceptance are exact saved values', () => {
 for (const [index, state] of explorer.states.entries()) {
  const source = trajectory.states[index];
  assert.equal(state.displacementMm, source.max_deck_displacement_mm);
  assert.equal(state.reductionPercent, source.decision.reduction_percent);
  assert.deepEqual(state.decision, source.decision);
  assert.deepEqual(state.section, source.section_properties);
  assert.deepEqual(state.checks.map(c => c.pass), [source.provenance_verified,
   source.diagnostics.solver.converged, source.numerical_acceptance,
   source.diagnostics.equilibrium.force_pass, source.diagnostics.equilibrium.moment_pass]);
  const response = read(state.responsePath);
  assert.equal(response.design_id, state.id);
  assert.equal(response.parameters.primaryScale, state.scale);
  assert.equal(response.result.maxDeckDisplacement * 1000, state.displacementMm);
  assert.deepEqual(response.evaluation, state.decision);
 }
});
test('target derives from policy and baseline, never an embedded UI constant', () => {
 assert.equal(explorer.targetPercent, policy.objective.target.value);
 assert.equal(explorer.targetDisplacementMm, trajectory.states[0].max_deck_displacement_mm * (1 - policy.objective.target.value / 100));
 // Presentation-only synthetic values prove the mapping reads its inputs.
 const changed = structuredClone(policy); changed.objective.target.value = 35;
 assert.equal(presentTrajectory(changed, trajectory).targetPercent, 35);
 assert.equal(presentTrajectory(changed, trajectory).targetDisplacementMm, trajectory.states[0].max_deck_displacement_mm * .65);
});
test('preserves stopping reason and revision count without inventing another request', () => {
 assert.equal(explorer.finalReason, 'illustrative_target_reached');
 assert.equal(explorer.revisionCount, 2);
 assert.equal(explorer.states.at(-1).decision.stop, true);
 assert.equal(explorer.states.at(-1).decision.next_primaryScale, undefined);
});
test('presentation does not mutate canonical inputs or turn missing flags into passes', () => {
 const p = structuredClone(policy), t = structuredClone(trajectory), before = JSON.stringify({p,t});
 presentTrajectory(p,t); assert.equal(JSON.stringify({p,t}), before);
 t.states[0].numerical_acceptance = false;
 delete t.states[0].diagnostics.equilibrium.force_pass;
 const state = presentTrajectory(p,t).states[0];
 assert.equal(state.checks[2].pass, false);
 assert.equal(state.checks[3].pass, undefined);
});

test('section detail reads the same generated arch member at a common physical scale', async () => {
 const {createModel} = await import('../cases/bridge/model.mjs');
 const {presentSectionDetail} = await import('../pipeline-ui/section-detail.mjs');
 const details = explorer.states.map(state => {
  const model = createModel(read(state.responsePath).parameters);
  const before = JSON.stringify(model);
  const detail = presentSectionDetail(model);
  const member = model.members.find(member => member.id === detail.memberId);
  assert.equal(member.system, 'primary_arch');
  assert.strictEqual(detail.section, member.section);
  assert.deepEqual(detail.nodeIds, [member.a, member.b]);
  const location = detail.elevation.find(item => item.id === member.id);
  assert.deepEqual(location.a, model.nodes[member.a].position);
  assert.deepEqual(location.b, model.nodes[member.b].position);
  assert.equal(JSON.stringify(model), before);
  return detail;
 });
 assert.equal(new Set(details.map(detail => detail.memberId)).size, 1);
 assert.equal(new Set(details.map(detail => detail.viewBox)).size, 1);
 for (const detail of details) assert.deepEqual(detail.baselineSection, details[0].section);
 assert.ok(Number(details[0].viewBox.split(' ')[2]) > Math.max(...details.map(detail => detail.section.outerDiameter)));
 assert.ok(details[0].section.outerDiameter < details[1].section.outerDiameter);
 assert.ok(details[1].section.outerDiameter < details[2].section.outerDiameter);
 assert.ok(details[0].section.wallThickness < details[1].section.wallThickness);
 assert.ok(details[1].section.wallThickness < details[2].section.wallThickness);
});
