// Read-only adapter: the mechanics modules below are preserved source files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createModel, defaults} from '../cases/bridge/model.mjs';
import {solve} from '../public/cases/bridge/solver.mjs';
export const SOURCE='b6eeff872ccd62ddab8563cd2de6dcaf3a749340';
export const paths={model:'public/cases/bridge/model.json',generator:'cases/bridge/model.mjs',solver:'public/cases/bridge/solver.mjs',hybrid:'public/cases/bridge/hybrid.mjs',element:'public/cases/bridge/frame-element.mjs'};
export const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
export const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
export function provenance(command){
 return {repository:'https://github.com/wlululu/cephalo-silk-design-pipeline',git_head_at_execution:git('rev-parse','HEAD'),working_tree_status:git('status','--porcelain'),original_repository:'https://github.com/wlululu/cephalo-silk-structural-lab',source_commit:SOURCE,baseline_reference:'structural-lab-baseline',timestamp:new Date().toISOString(),execution_command:command,node:process.version,platform:process.platform,architecture:process.arch,generator_version:'1.0.0',source_sha256:Object.fromEntries(Object.values(paths).map(p=>[p,hash(p)])),pipeline_sha256:Object.fromEntries(['pipeline/bridge-backend.mjs','pipeline/diagnostics.mjs','pipeline/designspec.schema.json','scripts/run_closed_loop_bridge.mjs'].map(p=>[p,hash(p)]))};
}
export function validateSpec(spec){
 assert.equal(spec.schema_version,'1.0.0');assert.equal(spec.source_case,'bridge');
 assert.equal(spec.source_model.path,paths.model);assert.equal(spec.source_model.commit,SOURCE);
 assert.equal(spec.mechanics_backend.solver,paths.solver);assert.equal(spec.mechanics_backend.generator,paths.generator);
 assert.equal(spec.objective.metric,'maxDeckDisplacement');assert.equal(spec.objective.relation,'iteration < baseline');
 assert.deepEqual(spec.baseline_parameters,defaults);
 assert.deepEqual(spec.constraints.mutable_parameters,['primaryScale']);
 const iteration=spec.design_id==='design_iteration_01';
 assert.ok(iteration||spec.design_id==='bridge_baseline');
 assert.equal(spec.parent_design_id,iteration?'bridge_baseline':null);
 assert.deepEqual(spec.parameter_overrides,iteration?{primaryScale:1.25}:{});
 return {...defaults,...spec.parameter_overrides};
}
export function checkModel(model,parameters){
 const original=read(paths.model);
 const reference=createModel(defaults);
 assert.deepEqual(reference,original,'Generator does not reproduce authoritative model');
 const affected=[];
 for(const [i,m] of model.members.entries()){
  const before=original.members[i];
  if(m.group==='primary'){
   const ratio=parameters.primaryScale/defaults.primaryScale;
   for(const [key,power] of Object.entries({outerDiameter:1,wallThickness:1,A:2,Iy:4,Iz:4,J:4}))assert.ok(Math.abs(m.section[key]/before.section[key]-ratio**power)<1e-10,`Section mapping ${i} ${key}`);
   assert.deepEqual({...m,section:before.section},before,'Primary nonsection data changed');affected.push(m.id);
  }else assert.deepEqual(m,before,'Secondary member/cable changed');
 }
 assert.deepEqual({...model,settings:original.settings,members:original.members},original,'Geometry, loads, materials or supports changed');
 return affected;
}
export function execute(spec){
 const parameters=validateSpec(spec),model=createModel(parameters);
 const affected=checkModel(model,parameters),start=performance.now(),result=solve(model);
 return {parameters,model,result,affected,elapsed_seconds:(performance.now()-start)/1000};
}
export function verifyPreservation(){
 const allowed=new Set(['README.md','package.json']);
 const files=git('ls-tree','-r','--name-only',SOURCE).split('\n'),entries={};
 for(const p of files){
  if(allowed.has(p))continue;
  const expected=git('rev-parse',`${SOURCE}:${p}`),actual=git('hash-object',p);
  assert.equal(actual,expected,`Protected source changed: ${p}`);entries[p]={git_blob:actual,sha256:hash(p)};
 }
 return {source_commit:SOURCE,checked_files:Object.keys(entries).length,unchanged:true,allowed_existing_file_changes:[...allowed],files:entries,opensees_cross_validation:'No standalone OpenSees implementation or cross-validation bundle exists in this source commit; none added, modified or executed.'};
}
