// Vite serves the committed JSON bytes as assets. There is no browser solve.
import baselineUrl from '../closed_loop_bridge/trajectory/baseline_verification.json?url';
import iteration1Url from '../closed_loop_bridge/trajectory/iteration_01_verification.json?url';
import iteration2Url from '../closed_loop_bridge/trajectory/iteration_02_response.json?url';
const urls: Record<string, string> = {
 'closed_loop_bridge/trajectory/baseline_verification.json': baselineUrl,
 'closed_loop_bridge/trajectory/iteration_01_verification.json': iteration1Url,
 'closed_loop_bridge/trajectory/iteration_02_response.json': iteration2Url,
};
export async function loadResponse(state: {responsePath:string; id:string; scale:number}, signal:AbortSignal) {
 const url = urls[state.responsePath];
 if (!url) throw new Error('No saved response asset for this state.');
 const response = await fetch(url, {signal});
 if (!response.ok) throw new Error(`Saved response could not be loaded (${response.status}).`);
 const record = await response.json();
 if (record.design_id !== state.id || record.parameters.primaryScale !== state.scale || !record.result)
  throw new Error('Saved response does not match the selected trajectory state.');
 return record;
}
