// Pure controller: no solver, I/O, LLM, candidate search or geometry generation.
import assert from 'node:assert/strict';
export const reductionPercent=(baseline,current)=>100*(baseline-current)/baseline;
export const supported=(scale,policy)=>Number.isFinite(scale)&&scale>=policy.supported_range.min&&scale<=policy.supported_range.max;
export function validatePolicy(p){
 assert.equal(p.schema_version,'2.0.0');assert.equal(p.objective_metric,'maxDeckDisplacement');
 assert.equal(p.reference_baseline.design_id,'bridge_baseline');assert.equal(p.reference_baseline.primaryScale,1);
 assert.equal(p.reference_baseline.response,'closed_loop_bridge/baseline_response.json');
 assert.equal(p.controlled_variable,'primaryScale');assert.equal(p.step_size,.25);
 assert.equal(p.target_reduction_percent,20);assert.equal(p.max_revision_steps,3);
 assert.equal(p.supported_range.min,.5);assert.equal(p.supported_range.max,1.5);assert.equal(p.supported_range.ui_step,.05);
 assert.equal(p.search_used,false);assert.equal(p.optimization_used,false);assert.equal(p.llm_or_agent_decisions,false);
 assert.deepEqual(p.hard_stop_conditions,['solver_nonconvergence','numerical_acceptance_failed','equilibrium_failed','no_improvement','unsupported_next_primary_scale','max_revision_steps_reached']);
 return p;
}
export function acceptanceFailure(state){
 if(state.provenance_verified===false)return 'version_1_reproduction_failed';
 if(state.execution_error||state.diagnostics?.solver?.converged!==true)return 'solver_nonconvergence';
 if(state.numerical_acceptance!==true||!Number.isFinite(state.deck_m)||state.deck_m<=0)return 'numerical_acceptance_failed';
 if(state.diagnostics.equilibrium?.force_pass!==true||state.diagnostics.equilibrium?.moment_pass!==true)return 'equilibrium_failed';
 return null;
}
export function decide(state,baseline,previous,policy){
 const failure=acceptanceFailure(state);
 const reduction=baseline>0&&Number.isFinite(state.deck_m)?reductionPercent(baseline,state.deck_m):null;
 if(failure)return {accepted:false,stop:true,reason:failure,target_reached:false,reduction_percent:reduction};
 if(previous&&!(state.deck_m<previous.deck_m))return {accepted:false,stop:true,reason:'no_improvement',target_reached:false,reduction_percent:reduction};
 if(reduction>=policy.target_reduction_percent)return {accepted:true,stop:true,reason:'illustrative_target_reached',target_reached:true,reduction_percent:reduction};
 if(state.revision_step>=policy.max_revision_steps)return {accepted:true,stop:true,reason:'max_revision_steps_reached',target_reached:false,reduction_percent:reduction};
 const next=state.primaryScale+policy.step_size;
 if(!supported(next,policy))return {accepted:true,stop:true,reason:'unsupported_next_primary_scale',unsupported_next_value:next,target_reached:false,reduction_percent:reduction};
 return {accepted:true,stop:false,reason:'continue_fixed_increment',next_primaryScale:next,target_reached:false,reduction_percent:reduction};
}
export function runController(policy,obtainState,onEvaluated=()=>{}){
 validatePolicy(policy);
 const states=[];let previous=null,baseline=null,scale=policy.reference_baseline.primaryScale;
 for(let step=0;step<=policy.max_revision_steps;step++){
  assert.ok(supported(scale,policy),'Unsupported scale blocked before execution');
  const state=obtainState({revision_step:step,primaryScale:scale,previous});
  assert.equal(state.revision_step,step);assert.equal(state.primaryScale,scale);
  if(step===0)baseline=state.deck_m;
  state.decision=decide(state,baseline,previous,policy);states.push(state);
  if(state.decision.accepted)previous=state;
  onEvaluated(state,states);
  if(state.decision.stop)return {states,final_stopping_reason:state.decision.reason,executed_revision_steps:step,illustrative_target_met:state.decision.target_reached,final_accepted_state:previous};
  scale=state.decision.next_primaryScale;
 }
 throw Error('Controller failed to stop within fixed revision limit');
}
