import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {read,hash,validateSpec,checkModel,verifyPreservation} from '../pipeline/bridge-backend.mjs';
import {START,root,policy,version1Preservation,validateTrajectorySpec,numericalAcceptance,sectionProperties} from '../pipeline/bridge-trajectory.mjs';
import {runController,decide,reductionPercent,validatePolicy} from '../pipeline/iteration-controller.mjs';
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
for(const [key,value] of [['step_size',.1],['target_reduction_percent',15],['max_revision_steps',4],['search_used',true],['optimization_used',true]])assert.throws(()=>validatePolicy({...p,[key]:value}));
assert.throws(()=>validatePolicy({...p,supported_range:{...p.supported_range,max:1.75}}));
assert.equal(reductionPercent(100,80),20);assert.equal(reductionPercent(100,75),25);
// Solver-free synthetic unit tests exercise failure/stop branches; no additional structural designs are executed.
const mock=(step,scale,deck)=>({revision_step:step,primaryScale:scale,deck_m:deck,diagnostics:{solver:{converged:true},equilibrium:{force_pass:true,moment_pass:true}},numerical_acceptance:true,provenance_verified:true});
function simulation(values,mutate=()=>{}){
 const calls=[];const result=runController(p,({revision_step,primaryScale})=>{
  calls.push(primaryScale);const state=mock(revision_step,primaryScale,values[revision_step]);mutate(state);return state;
 });return {calls,result};
}
let sim=simulation([100,80]);assert.deepEqual(sim.calls,[1,1.25]);assert.equal(sim.result.final_stopping_reason,'illustrative_target_reached');
sim=simulation([100,85,79]);assert.deepEqual(sim.calls,[1,1.25,1.5]);assert.equal(sim.result.executed_revision_steps,2);assert.equal(sim.result.illustrative_target_met,true);
sim=simulation([100,90,85]);assert.deepEqual(sim.calls,[1,1.25,1.5]);assert.equal(sim.result.final_stopping_reason,'unsupported_next_primary_scale');assert.equal(sim.result.states.at(-1).decision.unsupported_next_value,1.75);
for(const failure of ['solver_nonconvergence','numerical_acceptance_failed','force','moment','version_1_reproduction_failed']){
 sim=simulation([100,70,60],s=>{if(s.revision_step!==1)return;if(failure==='solver_nonconvergence')s.diagnostics.solver.converged=false;else if(failure==='numerical_acceptance_failed')s.numerical_acceptance=false;else if(failure==='version_1_reproduction_failed')s.provenance_verified=false;else s.diagnostics.equilibrium[failure+'_pass']=false;});
 assert.deepEqual(sim.calls,[1,1.25]);assert.equal(sim.result.illustrative_target_met,false);assert.equal(sim.result.final_accepted_state.revision_step,0);assert.equal(sim.result.final_stopping_reason,['force','moment'].includes(failure)?'equilibrium_failed':failure);
}
for(const deck of [85,86]){sim=simulation([100,85,deck]);assert.equal(sim.result.final_stopping_reason,'no_improvement');assert.equal(sim.result.final_accepted_state.primaryScale,1.25);}
// Range limits make step 3 unreachable here; directly test the independent revision-count guard.
assert.equal(decide(mock(3,1.75,90),100,mock(2,1.5,95),p).reason,'max_revision_steps_reached');
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
 assert.deepEqual(s.decision,decide(s,a.result.maxDeckDisplacement,previous,p));assert.deepEqual(record.evaluation,s.decision);
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
const report={pass:true,timestamp:new Date().toISOString(),checks:['Version 1 files byte-identical and historical hashes intact','fresh complete V1 solver results exact','fixed +0.25 rule and 20% baseline-relative target','one mutable parameter, forbidden inputs rejected','original range enforced; 1.75 rejected','all hard-stop branches with synthetic inputs only','no solver callback after success/failure stop','maximum revision guard','actual trajectory numerical arrays and diagnostics','response/feedback/source/code hashes','original scientific preservation']};
fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/closed-loop-test.json',JSON.stringify(report,null,2)+'\n');console.log('PASS: fixed-rule controller, real trajectory, all stop conditions and scientific preservation.');
