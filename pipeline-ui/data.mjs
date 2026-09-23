// Read-only presentation mapping. No mechanics, controller, or scientific adapter imports.
import policy from '../closed_loop_bridge/iteration_policy.json' with {type:'json'};
import trajectory from '../closed_loop_bridge/trajectory_comparison.json' with {type:'json'};

export function presentTrajectory(policy, trajectory) {
 const targetPercent = policy.objective.target.value;
 return {
  policy,
  targetPercent,
  targetDisplacementMm: trajectory.states[0].max_deck_displacement_mm * (1 - targetPercent / 100),
  finalReason: trajectory.final_stopping_reason,
  revisionCount: trajectory.executed_revision_steps,
  unexecutedRevisions: trajectory.unexecuted_revision_steps,
  states: trajectory.states.map(state => ({
   id: state.design_id,
   label: state.revision_step === 0 ? 'Baseline' : `Iteration ${String(state.revision_step).padStart(2, '0')}`,
   revision: state.revision_step,
   scale: state.primaryScale,
   displacementMm: state.max_deck_displacement_mm,
   reductionPercent: state.decision.reduction_percent,
   decision: state.decision,
   responsePath: state.response_path,
   section: state.section_properties,
   screening: state.screening,
   checks: [
    {label:'Reference reproduction', pass:state.provenance_verified, success:'VERIFIED',
     detail:state.canonical_saved_response ? 'Full saved reference response reproduced.' : 'Reference gate inherited from the reproduced baseline and first revision; this state is a new solve.'},
    {label:'Solver convergence', pass:state.diagnostics?.solver.converged, success:'CONVERGED'},
    {label:'Numerical acceptance', pass:state.numerical_acceptance, success:'PASS'},
    {label:'Force equilibrium', pass:state.diagnostics?.equilibrium.force_pass, success:'PASS'},
    {label:'Moment equilibrium', pass:state.diagnostics?.equilibrium.moment_pass, success:'PASS'},
   ],
  })),
 };
}
export const explorer = presentTrajectory(policy, trajectory);
