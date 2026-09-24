// Presentation only: read existing generated sections; never calculate a response.
import {createModel} from '../cases/bridge/model.mjs';
import baselineSpec from '../closed_loop_bridge/baseline_designspec.json' with {type:'json'};
import {explorer} from './data.mjs';

const baseline = createModel(baselineSpec.baseline_parameters);
// A fixed arch segment closest to the crown. Resolve once from baseline topology
// and retain its member ID across all saved states (ties follow authored order).
const arches = baseline.members.filter(member => member.system === 'primary_arch');
const midpointX = member => (baseline.nodes[member.a].position[0] + baseline.nodes[member.b].position[0]) / 2;
const representative = arches.reduce((best, member) => Math.abs(midpointX(member)) < Math.abs(midpointX(best)) ? member : best);
const largest = createModel({...baselineSpec.baseline_parameters, primaryScale:Math.max(...explorer.states.map(state => state.scale))});
const span = largest.members.find(member => member.id === representative.id).section.outerDiameter * 1.2;
const elevation = arches.map(member => ({id:member.id, a:baseline.nodes[member.a].position, b:baseline.nodes[member.b].position}));
const points = elevation.flatMap(member => [member.a, member.b]);
const xMin = Math.min(...points.map(point => point[0])), xMax = Math.max(...points.map(point => point[0]));
const yMin = Math.min(...points.map(point => point[1])), yMax = Math.max(...points.map(point => point[1]));

export function presentSectionDetail(model) {
 const member = model.members.find(member => member.id === representative.id);
 return {
  memberId:member.id, nodeIds:[member.a, member.b], section:member.section,
  baselineSection:representative.section,
  // Common physical viewport: no state-specific magnification or thickness gain.
  viewBox:[-span / 2, -span / 2, span, span].join(' '),
  elevation, elevationViewBox:[xMin - 3, -yMax - 3, xMax - xMin + 6, yMax - yMin + 6].join(' '),
 };
}
