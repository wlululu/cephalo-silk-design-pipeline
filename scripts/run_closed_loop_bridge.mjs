import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {SOURCE,paths,read,hash,digest,provenance,execute,verifyPreservation,validateSpec} from '../pipeline/bridge-backend.mjs';
import {diagnostics,change} from '../pipeline/diagnostics.mjs';
process.chdir(path.resolve(import.meta.dirname,'..'));
const dir='closed_loop_bridge',plain=x=>JSON.parse(JSON.stringify(x));
const write=(name,data)=>{const p=`${dir}/${name}.json`;fs.writeFileSync(p+'.tmp',JSON.stringify(data,null,2)+'\n');fs.renameSync(p+'.tmp',p);};
const thresholds=read('validation/physics/protocol.json').thresholds;
const mode=process.argv[2]??'--all';
assert.ok(['--all','--baseline','--iteration','--worker'].includes(mode),'Unknown command');
function baselineGate(record){
 assert.deepEqual(record.parameters,read(`${dir}/baseline_designspec.json`).baseline_parameters);
 assert.deepEqual(record.result,read('public/cases/bridge/baseline-results.json'),'Baseline full serialized result differs; design iteration stopped');
 assert.deepEqual(record.result,read('validation/original-bridge.json').result);
 assert.equal(record.diagnostics.solver.converged,true);
}
if(mode==='--worker'){
 const specFile=process.argv[3];
 assert.ok(['baseline_designspec','design_iteration_01'].includes(specFile));
 const spec=read(`${dir}/${specFile}.json`),command=`node scripts/run_closed_loop_bridge.mjs --worker ${specFile}`;
 const started=provenance(command),run=execute(spec),diag=diagnostics(run.model,run.result,thresholds);
 const record={schema_version:'1.0.0',design_id:spec.design_id,provenance:started,designspec_sha256:hash(`${dir}/${specFile}.json`),parameters:run.parameters,parameter_overrides:spec.parameter_overrides,model_reference:{...paths,source_commit:SOURCE,executed_model_sha256:digest(run.model),primary_member_ids:run.affected},elapsed_seconds:run.elapsed_seconds,diagnostics:diag,result:run.result};
 if(specFile==='baseline_designspec'){baselineGate(plain(record));record.baseline_reproduction={full_serialized_result_exact_match:true,authoritative_model_exact_match:true,comparison_note:'Same JSON normalization as tests/integration.mjs; JSON represents -0 as 0.'};}
 assert.ok(diag.solver.converged,'Original solver convergence criteria not met');
 write(specFile==='baseline_designspec'?'baseline_response':'iteration_01_response',record);
 console.log(JSON.stringify({design:spec.design_id,deck_mm:diag.max_deck_displacement_mm,all_mm:diag.max_all_node_displacement_mm,converged:diag.solver.converged,elapsed_seconds:run.elapsed_seconds}));
}else{
 const preservation=verifyPreservation();
 const baselineSpec=read(`${dir}/baseline_designspec.json`);validateSpec(baselineSpec);
 if(mode!=='--iteration'){
  for(const name of ['baseline_response','design_feedback','design_iteration_01','iteration_01_response','comparison'])fs.rmSync(`${dir}/${name}.json`,{force:true});
  execFileSync(process.execPath,['scripts/run_closed_loop_bridge.mjs','--worker','baseline_designspec'],{stdio:'inherit'});
 }
 const baseline=read(`${dir}/baseline_response.json`);baselineGate(baseline);
 assert.equal(baseline.designspec_sha256,hash(`${dir}/baseline_designspec.json`),'Stale baseline DesignSpec');
 for(const p of Object.values(paths))assert.equal(baseline.provenance.source_sha256[p],hash(p),'Stale baseline source');
 if(mode!=='--baseline'){
  const prov=provenance(`node scripts/run_closed_loop_bridge.mjs ${mode}`),value=baselineSpec.provenance.supported_primary_scale.selected_revised_value;
  assert.equal(value,1.25,'Preselected single iteration must not be tuned');
  const feedback={schema_version:'1.0.0',design_id:'bridge_baseline',provenance:prov,baseline_response_sha256:hash(`${dir}/baseline_response.json`),objective:baselineSpec.objective,observed_baseline:baseline.diagnostics,critical_quantity:'maxDeckDisplacement: maximum Euclidean displacement magnitude over model.topology.deck nodes; includes initial prestress equilibration.',permitted_design_variable:'primaryScale',proposed_change:{baseline:baseline.parameters.primaryScale,revised:value,ratio:value/baseline.parameters.primaryScale},hypothesis_before_reanalysis:{rationale:'Increasing primary tube diameter and wall thickness increases area and bending/torsional section properties of arch chords, root spines and deck/floor framing. This may reduce deck displacement.',expected_effect:'Reduced deck displacement; requires re-analysis because cable state and force redistribution are nonlinear.',tradeoffs:['Greater primary structural section/material demand; no total mass estimate is claimed.','Frame and cable forces and cable active states may redistribute.'],uncertainty:['Not a guarantee of displacement reduction.','One idealized model and one load case.','Existing yield/Euler indicators omit connections, imperfections and many physical effects.'],reanalysis_required:true,objective_achievement_claimed:false},selection_evidence:baselineSpec.provenance.supported_primary_scale,observed_outcome_after_reanalysis:{status:'pending when feedback was created',record:'comparison.json'}};
  write('design_feedback',feedback);
  const iteration={...structuredClone(baselineSpec),design_id:'design_iteration_01',parent_design_id:'bridge_baseline',parameter_overrides:{primaryScale:value},revision:{baseline_primary_scale:baseline.parameters.primaryScale,revised_primary_scale:value,ratio:value/baseline.parameters.primaryScale,relative_change_percent:100*(value/baseline.parameters.primaryScale-1),rationale:feedback.hypothesis_before_reanalysis.rationale,unchanged_parameters:Object.fromEntries(Object.entries(baseline.parameters).filter(([k])=>k!=='primaryScale')),feedback_sha256:hash(`${dir}/design_feedback.json`)},provenance:{...baselineSpec.provenance,...prov}};
  validateSpec(iteration);write('design_iteration_01',iteration);
  fs.rmSync(`${dir}/iteration_01_response.json`,{force:true});fs.rmSync(`${dir}/comparison.json`,{force:true});
  execFileSync(process.execPath,['scripts/run_closed_loop_bridge.mjs','--worker','design_iteration_01'],{stdio:'inherit'});
  const revised=read(`${dir}/iteration_01_response.json`),a=baseline.diagnostics,b=revised.diagnostics;
  assert.deepEqual({...revised.parameters,primaryScale:baseline.parameters.primaryScale},baseline.parameters);
  const cableChanges=baseline.result.members.filter(m=>m.status&&m.status!==revised.result.members[m.member].status).map(m=>({member:m.member,baseline:m.status,iteration:revised.result.members[m.member].status}));
  const pop=(x,y)=>Object.fromEntries(['count','min_axial_N','max_axial_N','max_abs_axial_N','mean_axial_N','rms_axial_N','sum_axial_N'].map(k=>[k,change(x[k],y[k])]));
  const c={schema_version:'1.0.0',provenance:provenance(`node scripts/run_closed_loop_bridge.mjs ${mode}`),experiment:'physics-guided closed-loop design iteration',objective:baselineSpec.objective,objective_met:revised.result.maxDeckDisplacement<baseline.result.maxDeckDisplacement,design_change:{parameter:'primaryScale',...change(baseline.parameters.primaryScale,revised.parameters.primaryScale),ratio:value/baseline.parameters.primaryScale,only_design_parameter_changed:true},displacement:{deck_mm:change(a.max_deck_displacement_mm,b.max_deck_displacement_mm),all_node_mm:change(a.max_all_node_displacement_mm,b.max_all_node_displacement_mm)},reactions:{vertical_N:change(a.vertical_reaction_N,b.vertical_reaction_N),baseline_total_N:baseline.result.totalReaction,iteration_total_N:revised.result.totalReaction,support_differences:baseline.result.reactions.map((r,i)=>({node:r.node,force_delta_N:r.force.map((v,k)=>revised.result.reactions[i].force[k]-v),moment_delta_Nm:r.moment.map((v,k)=>revised.result.reactions[i].moment[k]-v)}))},frame_forces:pop(a.frame_forces,b.frame_forces),cable_forces:pop(a.cable_forces,b.cable_forces),cable_state:{baseline:a.cables,iteration:b.cables,changes:cableChanges,changed_count:cableChanges.length},equilibrium:{baseline:a.equilibrium,iteration:b.equilibrium},solver:{baseline:a.solver,iteration:b.solver,baseline_elapsed_seconds:baseline.elapsed_seconds,iteration_elapsed_seconds:revised.elapsed_seconds},screening:{baseline:a.screening,iteration:b.screening},section_tradeoff:{affected_primary_members:revised.model_reference.primary_member_ids.length,diameter_and_wall_ratio:value,section_area_ratio:value**2,second_moment_and_torsion_ratio:value**4,total_mass_or_volume_quantified:false,interpretation:'The supported section mapping increases primary section demand; these section ratios are not total-structure mass ratios. Self-weight is excluded by the preserved load model.'},input_sha256:Object.fromEntries(['baseline_designspec','baseline_response','design_feedback','design_iteration_01','iteration_01_response'].map(n=>[n,hash(`${dir}/${n}.json`)])),limitations:['One controlled iteration, one variable, no optimization algorithm or candidate search.','Image/prompt intake references existing inferred idealized Bridge geometry; no new image-to-geometry inference.','Numerical solver agreement does not establish real-world safety.','Broader automated design search and future geometry backends are future work.']};
  write('comparison',c);console.log(JSON.stringify({objective_met:c.objective_met,deck_mm:c.displacement.deck_mm,all_node_mm:c.displacement.all_node_mm}));
 }
 assert.deepEqual(verifyPreservation(),preservation);write('preservation_verification',{...preservation,provenance:provenance(`node scripts/run_closed_loop_bridge.mjs ${mode}`)});
}
