import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {read,hash,verifyPreservation} from '../pipeline/bridge-backend.mjs';
import {root,out,policyPath,policy,provenance,version1Preservation,solveState,verifyFresh,stateRow,validateTrajectorySpec} from '../pipeline/bridge-trajectory.mjs';
import {runController} from '../pipeline/iteration-controller.mjs';
process.chdir(path.resolve(import.meta.dirname,'..'));
const write=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');fs.renameSync(file+'.tmp',file);};
const pad=step=>String(step).padStart(2,'0');
const specPath=step=>step===0?`${root}/baseline_designspec.json`:step===1?`${root}/design_iteration_01.json`:`${out}/design_iteration_${pad(step)}.json`;
const responsePath=step=>step===0?`${out}/baseline_verification.json`:step===1?`${out}/iteration_01_verification.json`:`${out}/iteration_${pad(step)}_response.json`;
const savedPath=step=>step===0?`${root}/baseline_response.json`:`${root}/iteration_01_response.json`;
const mode=process.argv[2]??'--all';
assert.ok(['--all','--worker'].includes(mode),'Use npm run closed-loop:bridge for the full policy; V1 stage commands are retired to protect its records.');
if(mode==='--worker'){
 const step=Number(process.argv[3]);assert.ok(Number.isInteger(step)&&step>=0&&step<=policy().max_revision_steps);
 const spec=read(specPath(step));validateTrajectorySpec(spec);
 const record=solveState(spec,`node scripts/run_closed_loop_bridge.mjs --worker ${step}`);
 // JSON normalization matches original tests (signed zero serializes as zero).
 const normalized=JSON.parse(JSON.stringify(record));
 if(step<=1)normalized.v1_verification=verifyFresh(normalized,savedPath(step));
 write(responsePath(step),normalized);
 console.log(JSON.stringify({step,primaryScale:record.parameters.primaryScale,deck_mm:record.diagnostics?.max_deck_displacement_mm,converged:record.diagnostics?.solver.converged,error:record.execution_error}));
}else{
 const p=policy(),before=verifyPreservation(),v1Before=version1Preservation(),started=provenance('npm run closed-loop:bridge');
 // Clear only V2-owned output names; never touch archived V1 inputs.
 fs.mkdirSync(out,{recursive:true});
 for(const file of fs.readdirSync(out))if(/^(baseline_verification|iteration_\d{2}_(verification|response)|design_iteration_\d{2}|feedback_for_iteration_\d{2}|preservation_verification)\.json$/.test(file))fs.unlinkSync(`${out}/${file}`);
 for(const file of ['trajectory_comparison.json','trajectory_summary.md'])fs.rmSync(`${root}/${file}`,{force:true});
 const trajectory=runController(p,({revision_step:step,primaryScale,previous})=>{
  if(step>=2){
   const feedback={schema_version:'2.0.0',provenance:provenance('npm run closed-loop:bridge'),parent_design_id:previous.design_id,previous_response_sha256:previous.response_sha256,policy_sha256:hash(policyPath),baseline_reference:p.reference_baseline,observed_deck_mm:previous.max_deck_displacement_mm,observed_reduction_percent_from_baseline:previous.decision.reduction_percent,target_reduction_percent:p.target_reduction_percent,target_interpretation:p.target_interpretation,decision:previous.decision,parameter_update_rule:'primaryScale_next = primaryScale_current + 0.25',proposed_primaryScale:primaryScale,rationale:'Previous accepted response missed the illustrative target; apply the fixed increment, within the original supported range.',hypothesis_before_reanalysis:'Larger primary sections may reduce deck displacement; response and acceptance require the unchanged solver.',tradeoffs:['Greater primary-section/material demand; total structural mass and added self-weight are not modeled.','Frame/cable forces and cable states can redistribute; screening concerns may persist.'],reanalysis_required:true};
   const feedbackPath=`${out}/feedback_for_iteration_${pad(step)}.json`;write(feedbackPath,feedback);
   const spec={...structuredClone(read(`${root}/baseline_designspec.json`)),design_id:`design_iteration_${pad(step)}`,parent_design_id:previous.design_id,parameter_overrides:{primaryScale},revision:{revision_step:step,previous_primaryScale:previous.primaryScale,step_size:p.step_size,original_baseline_primaryScale:p.reference_baseline.primaryScale,illustrative_target_reduction_percent:p.target_reduction_percent,policy_reference:policyPath,policy_sha256:hash(policyPath),feedback_reference:feedbackPath,feedback_sha256:hash(feedbackPath),unchanged_parameters:Object.fromEntries(Object.entries(read(`${root}/baseline_designspec.json`).baseline_parameters).filter(([k])=>k!=='primaryScale'))},provenance:provenance('npm run closed-loop:bridge')};
   validateTrajectorySpec(spec,p);write(specPath(step),spec);
  }
  // New process for each solve prevents reuse of the original prestress cache.
  try{execFileSync(process.execPath,['scripts/run_closed_loop_bridge.mjs','--worker',String(step)],{stdio:'inherit'});}
  catch(error){
   const spec=read(specPath(step));write(responsePath(step),{schema_version:'2.0.0',design_id:spec.design_id,designspec:spec,parameters:validateTrajectorySpec(spec,p),provenance:provenance(`node scripts/run_closed_loop_bridge.mjs --worker ${step}`),result:null,diagnostics:null,numerical_acceptance:false,execution_error:{message:'Solver worker process failed',exit_status:error.status??null},partial_results_available:false});
  }
  const record=read(responsePath(step));
  assert.equal(record.parameters.primaryScale,primaryScale,'Policy/DesignSpec mismatch');
  const state=stateRow(record,step,primaryScale,responsePath(step),specPath(step));
  if(step<=1){state.canonical_saved_response=savedPath(step);state.canonical_saved_response_sha256=hash(savedPath(step));state.result_origin='Preserved Version 1 state; fresh unchanged-solver full JSON verification';}
  else state.result_origin='New fixed-rule revision, original solver';
  return state;
 },(state,states)=>{
  const base=states[0];
  state.absolute_deck_displacement_change_from_baseline_mm=Number.isFinite(state.max_deck_displacement_mm)&&Number.isFinite(base.max_deck_displacement_mm)?state.max_deck_displacement_mm-base.max_deck_displacement_mm:null;
  state.percentage_deck_displacement_change_from_baseline=state.decision.reduction_percent===null?null:-state.decision.reduction_percent;
  state.target_reached=state.decision.target_reached;
  const previous=states.at(-2);
  state.cable_state_changes_from_previous=previous?.cables&&state.cables?[
   ...previous.cables.slack_ids.filter(id=>state.cables.taut_ids.includes(id)).map(member=>({member,from:'slack',to:'taut'})),
   ...previous.cables.taut_ids.filter(id=>state.cables.slack_ids.includes(id)).map(member=>({member,from:'taut',to:'slack'}))
  ]:[];
  const record=read(state.response_path);record.evaluation=state.decision;record.section_properties=state.section_properties;
  write(state.response_path,record);state.response_sha256=hash(state.response_path);
  console.log(JSON.stringify({evaluated:state.design_id,reason:state.decision.reason,reduction_percent:state.decision.reduction_percent}));
 });
 const accepted=trajectory.states.filter(s=>s.decision.accepted),marginals=accepted.slice(1).map((s,i)=>({to_design:s.design_id,deck_reduction_from_previous_mm:accepted[i].max_deck_displacement_mm-s.max_deck_displacement_mm}));
 const result={schema_version:'2.0.0',experiment:'physics-guided closed-loop design iteration',controller:p.controller,provenance:started,completed_at:new Date().toISOString(),policy_path:policyPath,policy_sha256:hash(policyPath),policy:p,states:trajectory.states,final_stopping_reason:trajectory.final_stopping_reason,executed_revision_steps:trajectory.executed_revision_steps,illustrative_target_met:trajectory.illustrative_target_met,final_accepted_designspec:trajectory.final_accepted_state?read(trajectory.final_accepted_state.designspec_path):null,final_accepted_design_id:trajectory.final_accepted_state?.design_id??null,solver_invocations:trajectory.states.length,verification_solves:trajectory.states.filter(s=>s.revision_step<=1).length,new_revision_solves:trajectory.states.filter(s=>s.revision_step>=2).length,marginal_deck_reductions:marginals,diminishing_returns_observed:marginals.length<2?null:marginals.slice(1).every((x,i)=>x.deck_reduction_from_previous_mm<marginals[i].deck_reduction_from_previous_mm),unexecuted_revision_steps:Array.from({length:p.max_revision_steps},(_,i)=>i+1).filter(i=>!trajectory.states.some(s=>s.revision_step===i)),limitations:['20% is an illustrative pipeline target, not a code-based design or safety criterion.','No search, optimization algorithm, LLM or agent generates decisions.','Greater primary-section demand; whole-structure mass and added self-weight are not modeled.','Existing Euler/yield indicators remain screening quantities.','Inferred idealized Bridge geometry and unchanged original mechanics assumptions.']};
 const after=verifyPreservation(),v1After=version1Preservation();assert.deepEqual(after,before);assert.deepEqual(v1After,v1Before);
 write(`${out}/preservation_verification.json`,{provenance:provenance('npm run closed-loop:bridge'),original_scientific_assets:after,version_1_records:v1After});
 write(`${root}/trajectory_comparison.json`,result);
 const fmt=(n,d=6)=>Number.isFinite(n)?n.toFixed(d):'unavailable';
 const lines=['# Bridge multi-step design refinement','',`Deterministic rule-based closed-loop controller: primaryScale +0.25; illustrative target ≥20% deck-displacement reduction from the original baseline; at most three revisions. Supported range 0.50–1.50. No search or LLM decisions.`,'','| State | Scale | Deck mm | Reduction from baseline | All-node mm | Decision |','|---|---:|---:|---:|---:|---|',...result.states.map(s=>`| ${s.design_id} | ${fmt(s.primaryScale,2)} | ${fmt(s.max_deck_displacement_mm)} | ${fmt(s.decision.reduction_percent,4)}% | ${fmt(s.max_all_node_displacement_mm)} | ${s.decision.reason} |`),'',`Final stop: **${result.final_stopping_reason}**. Illustrative target met: **${result.illustrative_target_met}**. Executed revision steps: **${result.executed_revision_steps}**. Final accepted design: **${result.final_accepted_design_id??'none'}**.`,`Unexecuted revision steps: ${result.unexecuted_revision_steps.join(', ')||'none'}. Iteration 03 at 1.75 is outside the existing supported range and is never authorized by this policy.`,'','| State | Reaction MN | Peak frame axial magnitude kN | Peak cable kN | Taut/slack | Frame Euler max | Primary area increase | Iy/Iz/J increase |','|---|---:|---:|---:|---|---:|---:|---:|',...result.states.map(s=>`| ${s.design_id} | ${fmt(s.total_reaction_N?.[1]/1e6)} | ${fmt(s.frame_forces?.max_abs_axial_N/1000,3)} | ${fmt(s.cable_forces?.max_axial_N/1000,3)} | ${s.cables?`${s.cables.taut}/${s.cables.slack}`:'unavailable'} | ${fmt(s.screening?.frames.max_euler_indicator)} | ${fmt(s.section_properties.primary_section_area_change_percent,2)}% | ${fmt(s.section_properties.primary_Iy_Iz_J_change_percent,2)}% |`),'','The section changes imply greater primary-section/material demand. Whole-structure mass and added self-weight are not modeled. Euler indicators above 1 remain screening concerns; target attainment does not establish engineering safety.','',`Observed marginal deck-displacement reductions: ${marginals.map(x=>`${x.to_design}: ${fmt(x.deck_reduction_from_previous_mm)} mm`).join('; ')}. Diminishing absolute returns over equal +0.25 increments: ${result.diminishing_returns_observed===null?'not assessable':result.diminishing_returns_observed}.`,'','Both Version 1 states are freshly verified against their full saved JSON responses before advancing. Original records are untouched. New responses include all raw nodal/member/reaction arrays, diagnostics, exact DesignSpecs and execution provenance.','','Reproduce: `npm run closed-loop:bridge`. This summary is generated from actual trajectory records.',''];
 fs.writeFileSync(`${root}/trajectory_summary.md`,lines.join('\n'));
 console.log(JSON.stringify({stop:result.final_stopping_reason,target_met:result.illustrative_target_met,revision_steps:result.executed_revision_steps}));
 if(!['illustrative_target_reached','unsupported_next_primary_scale','max_revision_steps_reached'].includes(result.final_stopping_reason))process.exitCode=1;
}
