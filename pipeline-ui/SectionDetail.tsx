import {presentSectionDetail} from './section-detail.mjs';
import type {ExplorerState} from './data.mjs';

export default function SectionDetail({model, state}:{model:any; state:ExplorerState}) {
 const detail = presentSectionDetail(model);
 const {outerDiameter:diameter, wallThickness:wall} = detail.section;
 const reference = detail.baselineSection;
 const mm = (value:number) => (value * 1000).toLocaleString('en-US', {maximumFractionDigits:2});
 return <section className="section-detail" aria-labelledby="section-detail-title" data-member={detail.memberId} data-scale={state.scale}>
  <div className="section-detail-heading"><h3 id="section-detail-title">Section detail</h3><span>{state.label} · {state.scale.toFixed(2)}×</span></div>
  <div className="section-detail-content">
   <figure className="section-profile">
    <svg viewBox={detail.viewBox} role="img" aria-label={`Primary arch member ${detail.memberId}, circular hollow section. Outer diameter ${mm(diameter)} millimetres; wall thickness ${mm(wall)} millimetres. Dashed outline is the baseline at the same scale.`}>
     <circle className="section-current" r={(diameter - wall) / 2} strokeWidth={wall} fill="none"/>
     <circle className="section-baseline" r={reference.outerDiameter / 2} fill="none" vectorEffect="non-scaling-stroke"/>
     <circle className="section-baseline" r={reference.outerDiameter / 2 - reference.wallThickness} fill="none" vectorEffect="non-scaling-stroke"/>
    </svg>
    <figcaption>End section · fixed display scale<br/><span>┄ Baseline reference</span></figcaption>
   </figure>
   <div className="section-dimensions">
    <dl><div><dt>Outer diameter</dt><dd>{mm(diameter)} mm</dd></div><div><dt>Wall thickness</dt><dd>{mm(wall)} mm</dd></div></dl>
    <figure className="section-locator">
     <svg viewBox={detail.elevationViewBox} role="img" aria-label={`Arch elevation locating member ${detail.memberId}, between nodes ${detail.nodeIds.join(' and ')}.`}>
      {detail.elevation.map(member => <line key={member.id} x1={member.a[0]} y1={-member.a[1]} x2={member.b[0]} y2={-member.b[1]} stroke="#587487" strokeWidth="1" vectorEffect="non-scaling-stroke"/>)}
      {detail.elevation.filter(member => member.id === detail.memberId).map(member => <line key={member.id} x1={member.a[0]} y1={-member.a[1]} x2={member.b[0]} y2={-member.b[1]} stroke="#86e3de" strokeWidth="4" vectorEffect="non-scaling-stroke"/>)}
     </svg>
     <figcaption>Primary arch · member {detail.memberId}<br/>Nodes {detail.nodeIds.join(' → ')} · location marker</figcaption>
    </figure>
   </div>
  </div>
  <p className="pipeline-note">Same member in every state. Actual generated tube dimensions, undeformed; no new analysis. Dashed baseline and solid selected section share one scale.</p>
 </section>;
}
