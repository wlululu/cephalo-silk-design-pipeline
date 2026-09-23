// Bridge execution, diagnostics and trajectory records. Original scientific implementation is imported unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SOURCE,paths,read,hash,git,execute} from './bridge-backend.mjs';
import {defaults} from '../cases/bridge/model.mjs';
import {diagnostics} from './diagnostics.mjs';
import {validateBridgePolicy,validateTrajectorySpec as validateAdapterSpec} from './bridge-adapters.mjs';
export const START='f6c3b73059246a36e167e98f12ef1b393ed893ab';
export const root='closed_loop_bridge',out=`${root}/trajectory`;
export const policyPath=`${root}/iteration_policy.json`;
export const frozenV1=['baseline_designspec','baseline_response','design_feedback','design_iteration_01','iteration_01_response','comparison','preservation_verification','publication-status'].map(n=>`${root}/${n}.json`);
export function policy(){
 const p=validateBridgePolicy(read(policyPath));
 const ui=fs.readFileSync('cases/bridge/BridgeCase.tsx','utf8');
 const range=ui.match(/label="Primary section scale"[^\n]*?min=\{([.\d]+)\} max=\{([.\d]+)\} step=\{([.\d]+)\}/);
 assert.ok(range,'Original UI range not found');
 assert.deepEqual(range.slice(1).map(Number),[p.design_variable.supported_range.min,p.design_variable.supported_range.max,p.design_variable.supported_range.ui_step]);
 assert.equal(p.provenance.source_commit,SOURCE);assert.equal(p.provenance.pipeline_starting_commit,START);
 return p;
}
export function version1Preservation(){
 const entries={};
 for(const file of frozenV1){const expected=git('rev-parse',`${START}:${file}`),actual=git('hash-object',file);assert.equal(actual,expected,`Frozen Version 1 record changed: ${file}`);entries[file]={git_blob:actual,sha256:hash(file)};}
 return {pipeline_starting_commit:START,unchanged:true,files:entries};
}
export function provenance(command){
 const code=['pipeline/bridge-backend.mjs','pipeline/bridge-trajectory.mjs','pipeline/iteration-controller.mjs','pipeline/objective-adapter.mjs','pipeline/adapter-registry.mjs','pipeline/bridge-adapters.mjs','pipeline/diagnostics.mjs','pipeline/designspec.schema.json','scripts/run_closed_loop_bridge.mjs',policyPath];
 return {source_repository:'https://github.com/wlululu/cephalo-silk-structural-lab',source_commit:SOURCE,pipeline_repository:'https://github.com/wlululu/cephalo-silk-design-pipeline',pipeline_starting_commit:START,execution_head:git('rev-parse','HEAD'),working_tree_status:git('status','--porcelain'),timestamp:new Date().toISOString(),execution_command:command,node:process.version,platform:process.platform,architecture:process.arch,generator_version:'3.0.0',architecture_starting_commit:'22fb33f4078dc56c920ee9296c442617749374b5',source_sha256:Object.fromEntries(Object.values(paths).map(f=>[f,hash(f)])),pipeline_sha256:Object.fromEntries(code.map(f=>[f,hash(f)]))};
}
export function validateTrajectorySpec(spec,p=policy()){return validateAdapterSpec(spec,p);}
function finiteTree(value){
 if(typeof value==='number')return Number.isFinite(value);
 if(value&&typeof value==='object')return Object.values(value).every(finiteTree);
 return true;
}
export function numericalAcceptance(result){
 if(!result||!finiteTree(result))return false;
 const h=result.nonlinearHistory;
 return result.residualNorm_N<result.loadEquilibriumTolerance_N&&
 result.loadEquilibriumTolerance_N>0&&result.initialEquilibriumTolerance_N>0&&
 JSON.stringify(h?.map(x=>x.loadFactor))===JSON.stringify([0,.25,.5,.75,1])&&
 h.every(x=>Number.isFinite(x.residualNorm)&&x.residualNorm<(x.loadFactor===0?result.initialEquilibriumTolerance_N:result.loadEquilibriumTolerance_N));
}
export function solveState(spec,command){
 const started=provenance(command),parameters=validateTrajectorySpec(spec),begin=performance.now();
 let result=null,diag=null,accept=false,error=null,affected=[];
 try{
  const run=execute(spec,validateTrajectorySpec);result=run.result;affected=run.affected;
  accept=numericalAcceptance(result);diag=diagnostics(run.model,result,read('validation/physics/protocol.json').thresholds);
 }catch(e){error={name:e.name,message:e.message};}
 return {schema_version:'2.0.0',design_id:spec.design_id,designspec:spec,parameters,model_reference:paths,provenance:started,elapsed_seconds:(performance.now()-begin)/1000,numerical_acceptance:accept,execution_error:error,diagnostics:diag,result,primary_member_ids:affected};
}
export function verifyFresh(record,savedPath){
 const saved=read(savedPath);let error=null;
 try{assert.deepEqual(record.parameters,saved.parameters);assert.deepEqual(record.result,saved.result);assert.deepEqual(record.diagnostics,saved.diagnostics);}catch(e){error='Fresh full JSON response/diagnostics differ from preserved Version 1';}
 return {saved_record:savedPath,saved_sha256:hash(savedPath),full_result_exact_match:error===null,error};
}
export function sectionProperties(scale){return {primary_scale_ratio:scale/defaults.primaryScale,primary_section_area_ratio:(scale/defaults.primaryScale)**2,primary_section_area_change_percent:100*((scale/defaults.primaryScale)**2-1),primary_Iy_Iz_J_ratio:(scale/defaults.primaryScale)**4,primary_Iy_Iz_J_change_percent:100*((scale/defaults.primaryScale)**4-1),whole_structure_mass_calculated:false,added_self_weight_modeled:false,note:'Greater primary-section/material demand; these are affected-section property ratios, not whole-structure mass changes. Original loads exclude self-weight.'};}
export function stateRow(record,step,scale,recordPath,specPath){
 const d=record.diagnostics;
 return {design_id:record.design_id,revision_step:step,primaryScale:scale,designspec_path:specPath,response_path:recordPath,response_sha256:hash(recordPath),provenance:record.provenance,deck_m:record.result?.maxDeckDisplacement??null,max_deck_displacement_mm:d?.max_deck_displacement_mm??null,max_all_node_displacement_mm:d?.max_all_node_displacement_mm??null,support_reactions:record.result?.reactions??null,total_reaction_N:record.result?.totalReaction??null,frame_forces:d?.frame_forces??null,cable_forces:d?.cable_forces??null,cables:d?.cables??null,screening:d?.screening??null,diagnostics:d,numerical_acceptance:record.numerical_acceptance,execution_error:record.execution_error,provenance_verified:record.v1_verification?.full_result_exact_match??true,section_properties:sectionProperties(scale)};
}
