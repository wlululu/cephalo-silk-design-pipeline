import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {read,hash,validateSpec,checkModel,verifyPreservation} from '../pipeline/bridge-backend.mjs';
import {START,root,policy,version1Preservation,validateTrajectorySpec,numericalAcceptance,sectionProperties} from '../pipeline/bridge-trajectory.mjs';
import {decide} from '../pipeline/iteration-controller.mjs';
import {reductionPercent,validateBridgePolicy,bridgeDecision} from '../pipeline/bridge-adapters.mjs';
import {resolveAdapters} from '../pipeline/adapter-registry.mjs';
import {createModel} from '../cases/bridge/model.mjs';
import {diagnostics} from '../pipeline/diagnostics.mjs';
process.chdir(path.resolve(import.meta.dirname,'..'));
const p=policy(),a=read(`${root}/baseline_response.json`),b=read(`${root}/iteration_01_response.json`),v1=read(`${root}/comparison.json`),trajectory=read(`${root}/trajectory_comparison.json`);
// Preserve historical provenance against V1 bytes, not today's refactored pipeline code.
for(const record of [a,b]){
 for(const [file,sha] of Object.entries(record.provenance.source_sha256))assert.equal(hash(file),sha);
 for(const [file,sha] of Object.entries(record.provenance.pipeline_sha256)){
  const bytes=execFileSync('git',['show',`${START}:${file}`]);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);
 }
}
assert.deepEqual(a.result,read('public/cases/bridge/baseline-results.json'));
assert.deepEqual(a.result,read('validation/original-bridge.json').result);
assert.deepEqual(b.result,read('validation/physics/runs/bridge-section-primary-1.25.json').result);
for(const [file,sha] of Object.entries(v1.input_sha256))assert.equal(hash(`${root}/${file}.json`),sha);
version1Preservation();verifyPreservation();
const before=read(`${root}/baseline_designspec.json`);
for(const bad of [{pressure:6},{primaryScale:1.3},{primaryScale:1.5,secondaryScale:1.1},{cablePrestress:100},{E:210}])assert.throws(()=>validateTrajectorySpec({...before,design_id:'design_iteration_02',parent_design_id:'design_iteration_01',parameter_overrides:bad}));
assert.throws(()=>validateTrajectorySpec({...before,design_id:'design_iteration_03',parent_design_id:'design_iteration_02',parameter_overrides:{primaryScale:1.75}}));
assert.throws(()=>validateSpec({...before,source_model:{...before.source_model,commit:'0'.repeat(40)}}));
// Policy changes cannot silently alter the scientifically verified demonstration.
for(const mutate of [
 q=>q.design_variable.step=.1,q=>q.objective.target.value=15,q=>q.controller.max_revisions=4,
 q=>q.search_used=true,q=>q.optimization_used=true,q=>q.llm_or_agent_decisions=true,
 q=>q.design_variable.supported_range.max=1.75,q=>q.objective.direction='increase',
 q=>q.design_variable.operation='eval',q=>q.acceptance.adapter_id='unknown'
]){const q=structuredClone(p);mutate(q);assert.throws(()=>validateBridgePolicy(q));}
const adapters=resolveAdapters(p,{baselineSpec:before,firstRevisionSpec:read(`${root}/design_iteration_01.json`)});
for(const group of ['objective','design_variable','acceptance']){
 const q=structuredClone(p);q[group].adapter_id='constructor';assert.throws(()=>resolveAdapters(q,{}),/Unsupported adapter/);
 q[group].adapter_id='process.exit()';assert.throws(()=>resolveAdapters(q,{}),/Unsupported adapter/);
}
for(const value of [.5,1,1.25,1.5])assert.equal(adapters.designVariableAdapter.validate(value),true);
for(const value of [.49,1.51,1.75,NaN,Infinity])assert.equal(adapters.designVariableAdapter.validate(value),false);
assert.deepEqual(adapters.designVariableAdapter.propose(before),{value:1.25,supported:true});
assert.throws(()=>adapters.designVariableAdapter.assertInvariants(before,{...before,input:{prompt:'changed'}}));
assert.equal(reductionPercent(100,80),20);assert.equal(reductionPercent(100,75),25);
assert.equal(numericalAcceptance({...a.result,residualNorm_N:a.result.loadEquilibriumTolerance_N}),false);
const badStage=structuredClone(a.result);badStage.nonlinearHistory[0].residualNorm=badStage.initialEquilibriumTolerance_N;assert.equal(numericalAcceptance(badStage),false);
assert.equal(numericalAcceptance({...a.result,maxDeckDisplacement:NaN}),false);
// Validate the actual saved trajectory, independent of whether the illustrative target was reached.
assert.equal(trajectory.policy_sha256,hash(`${root}/iteration_policy.json`));assert.deepEqual(trajectory.policy,p);
assert.ok(trajectory.states.length>=2&&trajectory.states.length<=4);
let previous=null;
for(const [step,s] of trajectory.states.entries()){
 assert.equal(s.revision_step,step);assert.equal(s.primaryScale,1+step*.25);assert.ok(s.primaryScale<=1.5);
 const spec=read(s.designspec_path),record=read(s.response_path),parameters=validateTrajectorySpec(spec,p),model=createModel(parameters);
 assert.equal(hash(s.response_path),s.response_sha256);assert.deepEqual(record.designspec,spec);assert.deepEqual(record.parameters,parameters);checkModel(model,parameters);
 assert.deepEqual({...parameters,primaryScale:1},before.baseline_parameters);
 assert.deepEqual(record.diagnostics,diagnostics(model,record.result,read('validation/physics/protocol.json').thresholds));
 assert.equal(record.numerical_acceptance,numericalAcceptance(record.result));
 assert.equal(record.result.nodes.length,model.nodes.length);assert.equal(record.result.members.length,model.members.length);assert.equal(record.result.reactions.length,model.supports.length);
 assert.equal(s.deck_m,record.result.maxDeckDisplacement);assert.equal(s.max_deck_displacement_mm,s.deck_m*1000);
 assert.equal(s.max_all_node_displacement_mm,record.result.maxDisplacement*1000);
 assert.deepEqual(s.support_reactions,record.result.reactions);assert.deepEqual(s.total_reaction_N,record.result.totalReaction);
 for(const key of ['frame_forces','cable_forces','cables','screening'])assert.deepEqual(s[key],record.diagnostics[key]);
 assert.equal(s.absolute_deck_displacement_change_from_baseline_mm,s.max_deck_displacement_mm-a.result.maxDeckDisplacement*1000);
 assert.equal(s.percentage_deck_displacement_change_from_baseline,(-reductionPercent(a.result.maxDeckDisplacement,s.deck_m))||0);
 assert.deepEqual(s.section_properties,sectionProperties(s.primaryScale));
 const normalized={revision_step:step,objective:adapters.objectiveAdapter.evaluate(record,a),validity:adapters.acceptance(record)};
 const prior=previous?{objective:adapters.objectiveAdapter.evaluate(read(previous.response_path),a)}:null;
 assert.deepEqual(s.decision,bridgeDecision(decide(normalized,prior,p.controller,()=>adapters.designVariableAdapter.propose(spec))));assert.deepEqual(record.evaluation,s.decision);
 if(step<trajectory.states.length-1)assert.equal(s.decision.stop,false,'Executed a state after a stop');else assert.equal(s.decision.stop,true);
 if(step<=1){assert.equal(record.v1_verification.full_result_exact_match,true);assert.deepEqual(record.result,step===0?a.result:b.result);assert.equal(hash(s.canonical_saved_response),s.canonical_saved_response_sha256);}
 else{const feedback=read(spec.revision.feedback_reference);assert.equal(hash(spec.revision.feedback_reference),spec.revision.feedback_sha256);assert.equal(feedback.previous_response_sha256,previous.response_sha256);assert.equal(feedback.proposed_primaryScale,previous.primaryScale+.25);assert.ok(Date.parse(feedback.provenance.timestamp)<=Date.parse(record.provenance.timestamp));}
 for(const [file,sha] of Object.entries(record.provenance.source_sha256))assert.equal(hash(file),sha);
 for(const [file,sha] of Object.entries(record.provenance.pipeline_sha256))assert.equal(hash(file),sha);
 if(s.decision.accepted)previous=s;
}
assert.equal(trajectory.final_stopping_reason,trajectory.states.at(-1).decision.reason);
assert.equal(trajectory.illustrative_target_met,trajectory.states.at(-1).decision.target_reached);
assert.deepEqual(trajectory.final_accepted_designspec,read(previous.designspec_path));
assert.equal(trajectory.executed_revision_steps,trajectory.states.length-1);
assert.equal(trajectory.solver_invocations,trajectory.states.length);
assert.equal(trajectory.verification_solves,2);
for(const step of trajectory.unexecuted_revision_steps){assert.ok(!fs.existsSync(`${root}/trajectory/design_iteration_${String(step).padStart(2,'0')}.json`));assert.ok(!fs.existsSync(`${root}/trajectory/iteration_${String(step).padStart(2,'0')}_response.json`));}
const corrupted=createModel(before.baseline_parameters);corrupted.nodes[0].position[0]+=1;assert.throws(()=>checkModel(corrupted,before.baseline_parameters));
// Immutable pre-refactor Git objects are the expected data, never regenerated fixtures.
const refactorStart='22fb33f4078dc56c920ee9296c442617749374b5';
const committedBytes=file=>execFileSync('git',['show',`${refactorStart}:${file}`],{maxBuffer:32*1024*1024});
const committed=file=>JSON.parse(committedBytes(file));
const original=committed(`${root}/trajectory_comparison.json`);
for(const file of ['pipeline/designspec.schema.json',`${root}/baseline_designspec.json`,`${root}/design_iteration_01.json`,`${root}/baseline_response.json`,`${root}/iteration_01_response.json`])
 assert.deepEqual(fs.readFileSync(file),committedBytes(file),`Changed historical input: ${file}`);
assert.equal(trajectory.states.length,3);
for(const [index,state] of trajectory.states.entries()){
 const old=original.states[index],fresh=read(state.response_path),saved=committed(old.response_path);
 validateTrajectorySpec(saved.designspec,p); // Historical DesignSpecs remain executable under the same schema.
 // Full nodes, displacements, reactions, member forces/stresses, cable states and nonlinear history.
 for(const key of ['result','diagnostics','parameters','primary_member_ids','section_properties','numerical_acceptance','execution_error','evaluation'])
  assert.deepEqual(fresh[key],saved[key],`Response changed: ${state.design_id}/${key}`);
 // Every state field except runtime provenance and response hashes must be exactly identical.
 const scientific=({provenance,response_sha256,...rest})=>rest;
 assert.deepEqual(scientific(state),scientific(old),`Trajectory changed: ${state.design_id}`);
 // Generated spec metadata records current policy/code/feedback; engineering content is frozen.
 const designContent=({provenance,revision,...rest})=>rest;
 assert.deepEqual(designContent(fresh.designspec),designContent(saved.designspec));
 if(index===2){
  const revisionContent=({policy_sha256,feedback_sha256,...rest})=>rest;
  assert.deepEqual(revisionContent(fresh.designspec.revision),revisionContent(saved.designspec.revision));
 }
}
for(const key of ['final_stopping_reason','executed_revision_steps','illustrative_target_met','final_accepted_design_id','solver_invocations','verification_solves','new_revision_solves','marginal_deck_reductions','diminishing_returns_observed','unexecuted_revision_steps'])assert.deepEqual(trajectory[key],original[key],key);
assert.deepEqual(trajectory.states.map(s=>s.max_deck_displacement_mm.toFixed(9)),['36.745936861','31.081610663','27.919093139']);
assert.equal(trajectory.states.at(-1).decision.reduction_percent.toFixed(6),'24.021278');
assert.equal(trajectory.final_stopping_reason,'illustrative_target_reached');
assert.equal(trajectory.executed_revision_steps,2);assert.deepEqual(trajectory.unexecuted_revision_steps,[3]);
assert.equal(trajectory.states[1].cable_state_changes_from_previous.length,4);
assert.equal(trajectory.states[2].cable_state_changes_from_previous.length,0);
const report={pass:true,timestamp:new Date().toISOString(),starting_commit:refactorStart,checks:['Version 1 files byte-identical and historical hashes intact','DesignSpec schema unchanged','unknown adapters and altered Bridge policy rejected','fixed +0.25 rule, 20% target, 0.50–1.50 range','one mutable parameter, forbidden inputs rejected','full baseline and both revision responses EXACT against starting commit','all trajectory science and public decisions EXACT','cable transitions, section tradeoffs, convergence/equilibrium EXACT','no Iteration 03 solve or artifact','response/feedback/source/code hashes','original scientific preservation']};
fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/closed-loop-test.json',JSON.stringify(report,null,2)+'\n');console.log('PASS: adapters, exact pre-refactor Bridge trajectory and scientific preservation.');
