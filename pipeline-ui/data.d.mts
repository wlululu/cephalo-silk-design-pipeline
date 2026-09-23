import policy from '../closed_loop_bridge/iteration_policy.json';
export type Decision = {accepted:boolean; stop:boolean; reason:string; target_reached:boolean; reduction_percent:number; next_primaryScale?:number};
export type ExplorerState = {
 id:string; label:string; revision:number; scale:number; displacementMm:number; reductionPercent:number;
 decision:Decision; responsePath:string;
 section:{primary_section_area_ratio:number; primary_section_area_change_percent:number; primary_Iy_Iz_J_ratio:number; primary_Iy_Iz_J_change_percent:number};
 screening:{frames:{max_euler_indicator:number; max_yield_indicator:number}};
 checks:{label:string; pass:boolean | undefined; success:string; detail?:string}[];
};
export type Explorer = {policy:typeof policy; targetPercent:number; targetDisplacementMm:number; finalReason:string; revisionCount:number; unexecutedRevisions:number[]; states:ExplorerState[]};
export function presentTrajectory(policy:typeof import('../closed_loop_bridge/iteration_policy.json').default, trajectory:unknown):Explorer;
export const explorer:Explorer;
