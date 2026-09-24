import {useEffect, useMemo, useRef, useState} from 'react';
import {CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import BridgeView from '../cases/bridge/BridgeView';
import {createModel} from '../cases/bridge/model.mjs';
import {explorer} from './data.mjs';
import SectionDetail from './SectionDetail';
import {loadResponse} from './responses';
import './pipeline.css';

const number = (value:number, digits=2) => value.toLocaleString('en-US', {minimumFractionDigits:digits, maximumFractionDigits:digits});
const percent = (value:number) => value.toLocaleString('en-US', {maximumFractionDigits:6});
const architecture = [
 ['DesignSpec', 'Generic contract', 'generic'],
 ['Mechanics Backend', 'Case-specific', 'adapted'],
 ['Structural Response', 'Saved mechanics output', 'response'],
 ['Objective Adapter', 'Case-specific', 'adapted'],
 ['Generic Controller', 'Continue / stop', 'generic'],
 ['Design-Variable Adapter', 'Case-specific', 'adapted'],
 ['Revised DesignSpec', 'Generic contract', 'generic'],
];

export default function PipelinePage() {
 const [selected, setSelected] = useState(0);
 const [playing, setPlaying] = useState(false);
 const [replayFinished, setReplayFinished] = useState(false);
 const [loaded, setLoaded] = useState<{id:string; record:any} | null>(null);
 const [error, setError] = useState('');
 const [deformed, setDeformed] = useState(false);
 const [node, setNode] = useState<number | null>(null);
 const api = useRef<any>(null);
 const state = explorer.states[selected];
 const record = loaded && loaded.id === state.id ? loaded.record : null;
 const model = useMemo(() => record ? createModel(record.parameters) : null, [record]);
 const view = useMemo(() => ({mode:'hierarchy', deformed, ghost:deformed, scale:100, deck:true,
  nodes:false, loads:false, clearance:false, region:'all', selected:node ?? -1}), [deformed, node]);
 useEffect(() => {
  const abort = new AbortController();
  setError(''); setNode(null);
  loadResponse(state, abort.signal).then(record => setLoaded({id:state.id, record})).catch(error => {
   if (!abort.signal.aborted) {setError(error.message); setPlaying(false);}
  });
  return () => abort.abort();
 }, [state]);
 useEffect(() => {
  if (!playing || !record) return;
  const timer = window.setTimeout(() => {
   if (selected === explorer.states.length - 1) {setPlaying(false); setReplayFinished(true);}
   else setSelected(index => index + 1);
  }, 2200);
  return () => window.clearTimeout(timer);
 }, [playing, selected, record]);
 const select = (index:number) => {setPlaying(false); setReplayFinished(false); setSelected(index);};
 const replay = () => {setSelected(0); setReplayFinished(false); setPlaying(true);};
 const {policy, targetPercent} = explorer;
 return <main className="pipeline-page" id="pipeline-main">
  <div className="pipeline-heading"><div><p className="pipeline-kicker">METHOD / VERIFIED TRAJECTORY EXPLORER</p><h1>Physics-guided design refinement</h1><p>A generalized closed-loop method, demonstrated through one verified structural instantiation.</p></div><span className="pipeline-readonly">READ-ONLY REPLAY</span></div>
  <section className="pipeline-panel architecture-panel" aria-labelledby="architecture-title">
   <div className="pipeline-section-heading"><h2 id="architecture-title">01 / General pipeline architecture</h2><div className="architecture-key"><span>Generic contract / controller</span><span>Case-specific implementation / adapter</span></div></div>
   <ol className="pipeline-architecture">{architecture.map(([label, detail, kind]) => <li className={kind} key={label}><strong>{label}</strong><small>{detail}</small></li>)}</ol>
   <p className="pipeline-return">↳ Continue: revised DesignSpec returns to the mechanics backend for re-analysis. Stop: retain the accepted state.</p>
  </section>
  <section className="pipeline-panel instantiation" aria-labelledby="instantiation-title">
   <div className="pipeline-section-heading"><h2 id="instantiation-title">02 / Verified instantiation · Twin-Arch Web Bridge</h2><a href="#/bridge">Open in Structural Lab →</a></div>
   <dl className="pipeline-config">
    <div><dt>Objective</dt><dd>Maximum deck displacement ↓</dd><dd><code>{policy.objective.adapter_id}</code></dd></div>
    <div><dt>Design variable</dt><dd>Primary-member cross-section scale</dd><dd><code>{policy.design_variable.adapter_id}</code> · ID: <code>{policy.design_variable.id}</code></dd></div>
    <div><dt>Fixed update</dt><dd className="config-number">+{number(policy.design_variable.step)}</dd></div>
    <div><dt>Illustrative target</dt><dd className="config-number">≥{targetPercent}% <small>reduction</small></dd></div>
   </dl>
   <p className="pipeline-method">deterministic · rule-based · single objective · single design variable · {policy.optimization_used ? 'optimization' : 'no optimization'}</p>
   <p className="pipeline-note">New objective metrics and design variables require explicit adapter implementation and validation.</p>
  </section>
  <div className="pipeline-explorer-grid">
   <section className="pipeline-panel pipeline-visual" aria-labelledby="visual-title" data-state={state.id}>
    <div className="pipeline-section-heading"><h2 id="visual-title">03 / Saved structural state</h2><span>{state.label} · {number(state.scale)}×</span></div>
    <div className="pipeline-view-controls"><button onClick={() => api.current?.camera('reference')}>Fit model</button><button aria-pressed={deformed} onClick={() => setDeformed(value => !value)}>{deformed ? 'Deformed ×100' : 'Undeformed'} · toggle</button></div>
    <div className="pipeline-viewport" aria-busy={!record && !error}>
     {model && record && <BridgeView model={model} result={record.result} view={view} onSelect={setNode} api={api} onError={setError}/>}
     {!record && !error && <p className="pipeline-loading" role="status">Loading saved response…</p>}
     {error && <p role="alert" className="pipeline-loading">{error}</p>}
    </div>
    <div className="pipeline-visual-note"><span>Drag to orbit · Scroll to zoom · Click a node</span><span>Primary sections {number(state.scale)}× · {deformed ? 'Displacement ×100 (display only)' : 'Authored geometry'}</span></div>
    {node !== null && record && <p className="pipeline-node">Node {node} · saved displacement [x, y, z]: {record.result.nodes[node].displacement.map((v:number) => number(v * 1000, 3)).join(', ')} mm</p>}
    {model && <SectionDetail model={model} state={state}/>}
    <p className="pipeline-note">Saved verified response; no analysis is run here. Explore free structural experiments in <a href="#/bridge">Bridge Structural Lab →</a></p>
   </section>
   <section className="pipeline-panel pipeline-feedback" aria-labelledby="feedback-title">
    <h2 id="feedback-title">04 / Current state & controller feedback</h2>
    <div aria-live="polite" aria-atomic="true">
     <div className="pipeline-state-title"><h3>{state.label}</h3><span className="pipeline-status">{state.decision.stop ? 'STOP' : 'CONTINUE'}</span></div>
     <p className="pipeline-label">MAXIMUM DECK DISPLACEMENT</p><p className="pipeline-metric">{number(state.displacementMm)} <small>mm</small></p>
     <dl className="pipeline-state-data"><div><dt>Primary-member cross-section scale</dt><dd>{number(state.scale)}×</dd></div><div><dt>Reduction / illustrative target</dt><dd>{number(state.reductionPercent)} / {targetPercent}%</dd></div></dl>
     <progress aria-label="Baseline-relative displacement reduction toward illustrative target" max={targetPercent} value={Math.min(targetPercent, Math.max(0, state.reductionPercent))}/>
     <p className="pipeline-target">{state.decision.target_reached ? 'TARGET REACHED' : 'Target not met'}</p>
     <p className="pipeline-decision"><span>Decision: <strong>{state.decision.stop ? 'STOP' : 'CONTINUE'}</strong></span><code>{state.decision.reason}</code></p>
     {state.decision.next_primaryScale !== undefined && <p className="pipeline-next">Next request: cross-section scale +{number(policy.design_variable.step)} → {number(state.decision.next_primaryScale)}×</p>}
    </div>
    <div className="pipeline-checks"><h3>Physics acceptance</h3><ul>{state.checks.map(check => <li key={check.label}><span>{check.label}</span><strong>{check.pass === true ? check.success : check.pass === false ? 'FAIL' : 'NOT RECORDED'}</strong></li>)}</ul><p className="pipeline-note">{state.checks[0].detail}</p></div>
   </section>
  </div>
  <section className="pipeline-panel trajectory-panel" aria-labelledby="trajectory-title">
   <div className="pipeline-section-heading"><h2 id="trajectory-title">05 / Executed trajectory</h2><div className="pipeline-replay"><button onClick={replay}>Replay verified trajectory</button><button disabled={!playing} onClick={() => setPlaying(false)}>Pause</button><button onClick={() => select(0)}>Reset</button></div></div>
   <ol className="pipeline-states">{explorer.states.map((item, index) => <li key={item.id}><button aria-current={index === selected ? 'step' : undefined} onClick={() => select(index)}><span>{item.label}</span><strong>{number(item.scale)}× <i>→</i> {number(item.displacementMm)} mm</strong><small>{number(item.reductionPercent)}% reduction · {item.decision.stop ? 'STOP' : 'CONTINUE'}</small></button></li>)}</ol>
   <p className="pipeline-note" role="status">{playing ? `Playing saved data · ${state.label}` : replayFinished ? 'Replay complete · STOP' : 'Select a state to inspect the recorded response.'} Executed revision steps: {explorer.revisionCount}. {explorer.unexecutedRevisions.map(step => `Iteration ${String(step).padStart(2, '0')} was not executed.`).join(' ')}</p>
  </section>
  <div className="pipeline-bottom-grid">
   <section className="pipeline-panel pipeline-chart-panel" aria-labelledby="chart-title">
    <h2 id="chart-title">06 / Displacement trajectory</h2>
    <p className="pipeline-note">Maximum deck displacement (mm) ↓</p>
    <div className="pipeline-chart" role="img" aria-label={`Three executed states. Target displacement ${number(explorer.targetDisplacementMm, 3)} mm. Exact values in the table below.`}>
     <ResponsiveContainer width="100%" height={260}><LineChart data={explorer.states} margin={{top:18,right:30,bottom:24,left:0}}>
      <CartesianGrid stroke="#263a4c" strokeDasharray="3 5"/><XAxis type="number" dataKey="scale" domain={['dataMin','dataMax']} ticks={explorer.states.map(s => s.scale)} tickFormatter={v => number(v)} stroke="#9eb4c5" tick={{fontSize:12}} label={{value:'Primary-member cross-section scale',position:'bottom',offset:4,fill:'#9eb4c5',fontSize:12}}/>
      <YAxis domain={['auto','auto']} stroke="#9eb4c5" tick={{fontSize:12}} tickFormatter={v => number(v, 0)} width={45}/>
      <Tooltip formatter={(v) => [`${number(Number(v), 3)} mm`, 'Maximum deck displacement']} labelFormatter={v => `Cross-section scale ${number(Number(v))}×`} contentStyle={{background:'#102334',border:'1px solid #415969',color:'#e4eff6'}}/>
      <ReferenceLine y={explorer.targetDisplacementMm} stroke="#c4a783" strokeDasharray="5 5" label={{value:`${targetPercent}% target`,position:'insideTopRight',fill:'#dac8ad',fontSize:12}}/>
      <Line type="linear" dataKey="displacementMm" stroke="#75dcdf" strokeWidth={2} dot={{r:4,fill:'#75dcdf'}} isAnimationActive={false}/>
      <ReferenceDot x={state.scale} y={state.displacementMm} r={7} fill="#e7faf8" stroke="#75dcdf"/>
     </LineChart></ResponsiveContainer>
    </div>
    <details className="pipeline-chart-text"><summary>Data table & target calculation</summary><table><caption>Executed states; lines connect samples and do not represent a search.</caption><thead><tr><th>State</th><th>Scale</th><th>Deck (mm)</th><th>Reduction</th></tr></thead><tbody>{explorer.states.map(s => <tr key={s.id}><th scope="row">{s.label}</th><td>{number(s.scale)}</td><td>{number(s.displacementMm, 9)}</td><td>{number(s.reductionPercent, 6)}%</td></tr>)}</tbody></table><p>Target = baseline displacement × (1 − {targetPercent}/100) = {number(explorer.targetDisplacementMm, 9)} mm.</p></details>
   </section>
   <section className="pipeline-panel pipeline-tradeoff" aria-labelledby="tradeoff-title">
    <h2 id="tradeoff-title">07 / Design tradeoff · {state.label}</h2>
    <p><code>{policy.design_variable.id}</code> uniformly scales the outer diameter and wall thickness of the primary tubular members.</p>
    <dl><div><dt>Primary-section area</dt><dd>{state.revision === 0 ? `${number(state.section.primary_section_area_ratio)}× reference` : `+${percent(state.section.primary_section_area_change_percent)}%`}</dd></div><div><dt>Iy / Iz / J</dt><dd>{state.revision === 0 ? `${number(state.section.primary_Iy_Iz_J_ratio)}× reference` : `+${percent(state.section.primary_Iy_Iz_J_change_percent)}%`}</dd></div></dl>
    <p>Increased stiffness comes with increased section/material demand. Whole-structure mass and added self-weight are not included in this design-refinement objective.</p>
    <div className="pipeline-screening"><h3>Screening only · separate from acceptance</h3><p>Maximum frame Euler ratio: <strong>{number(state.screening.frames.max_euler_indicator, 3)}</strong> · yield ratio: <strong>{number(state.screening.frames.max_yield_indicator, 3)}</strong></p><p>Elastic screening indicators are not safety checks.</p></div>
    <p>{state.decision.target_reached ? 'This state reaches the illustrative target but is not an optimum.' : 'The selected state has not yet reached the illustrative target.'} Target attainment is not engineering safety certification.</p>
   </section>
  </div>
  <footer className="pipeline-footer"><span>Canonical records: <code>closed_loop_bridge/iteration_policy.json</code> + <code>trajectory_comparison.json</code> + saved trajectory responses.</span><span>Executable controller: <code>npm run closed-loop:bridge</code></span></footer>
 </main>;
}
