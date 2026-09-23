import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {read,hash,validateSpec,checkModel,verifyPreservation} from '../pipeline/bridge-backend.mjs';
import {createModel} from '../cases/bridge/model.mjs';
import {diagnostics} from '../pipeline/diagnostics.mjs';
process.chdir(path.resolve(import.meta.dirname,'..'));
const dir='closed_loop_bridge',baseline=read(`${dir}/baseline_designspec.json`),iteration=read(`${dir}/design_iteration_01.json`),a=read(`${dir}/baseline_response.json`),b=read(`${dir}/iteration_01_response.json`),c=read(`${dir}/comparison.json`),feedback=read(`${dir}/design_feedback.json`);
assert.deepEqual(a.result,read('public/cases/bridge/baseline-results.json'));
assert.deepEqual(a.result,read('validation/original-bridge.json').result);
assert.deepEqual(b.result,read('validation/physics/runs/bridge-section-primary-1.25.json').result,'Fresh iteration differs from archived same-parameter response');
for(const [spec,r] of [[baseline,a],[iteration,b]]){
 const p=validateSpec(spec),model=createModel(p);assert.deepEqual(r.parameters,p);checkModel(model,p);
 assert.deepEqual(r.diagnostics,diagnostics(model,r.result,read('validation/physics/protocol.json').thresholds));
 assert.equal(r.result.nodes.length,model.nodes.length);assert.equal(r.result.members.length,model.members.length);assert.equal(r.result.reactions.length,model.supports.length);
 assert.ok(r.diagnostics.solver.converged);
 for(const [file,sha] of Object.entries(r.provenance.source_sha256))assert.equal(hash(file),sha);
 for(const [file,sha] of Object.entries(r.provenance.pipeline_sha256))assert.equal(hash(file),sha,'Executed code has since changed');
}
for(const bad of [{pressure:6},{primaryScale:1.3},{primaryScale:1.25,secondaryScale:1.1},{cablePrestress:100},{E:210}])assert.throws(()=>validateSpec({...iteration,parameter_overrides:bad}));
assert.throws(()=>validateSpec({...iteration,source_model:{...iteration.source_model,commit:'0'.repeat(40)}}));
assert.throws(()=>validateSpec({...iteration,baseline_parameters:{...iteration.baseline_parameters,E:210}}));
const corrupted=createModel(validateSpec(iteration));corrupted.nodes[0].position[0]+=1;
assert.throws(()=>checkModel(corrupted,validateSpec(iteration)));
assert.equal(c.objective_met,b.result.maxDeckDisplacement<a.result.maxDeckDisplacement);
for(const [name,key] of [['deck_mm','maxDeckDisplacement'],['all_node_mm','maxDisplacement']]){
 const d=c.displacement[name];assert.equal(d.baseline,a.result[key]*1000);assert.equal(d.iteration,b.result[key]*1000);assert.equal(d.absolute_change,d.iteration-d.baseline);assert.equal(d.percentage_change,100*(d.iteration-d.baseline)/d.baseline);
}
for(const [name,sha] of Object.entries(c.input_sha256))assert.equal(hash(`${dir}/${name}.json`),sha);
assert.equal(feedback.hypothesis_before_reanalysis.objective_achievement_claimed,false);
assert.equal(feedback.hypothesis_before_reanalysis.reanalysis_required,true);
assert.ok(Date.parse(feedback.provenance.timestamp)<=Date.parse(b.provenance.timestamp));
assert.equal(iteration.revision.feedback_sha256,hash(`${dir}/design_feedback.json`));
const changes=a.result.members.filter(m=>m.status&&m.status!==b.result.members[m.member].status).map(m=>m.member);
assert.deepEqual(c.cable_state.changes.map(x=>x.member),changes);
assert.equal(verifyPreservation().unchanged,true);
fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/closed-loop-test.json',JSON.stringify({pass:true,checks:['both full archived result matches','strict single-variable and source contract','geometry/cable invariants','complete response arrays','recomputed diagnostics','record hashes and sequence','comparison arithmetic','all original source files except documented edits'],timestamp:new Date().toISOString()},null,2)+'\n');
console.log('PASS: closed-loop numerical records, provenance, invariants and forbidden-change guards.');
