import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {unzipSync} from 'fflate';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cephalo-originals-'));
const plain=x=>JSON.parse(JSON.stringify(x)),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const configs=[
 {id:'bridge',zip:'cephalo-bridge-v6.zip',folder:'cephalo-bridge',model:'lib/bridge/model.mjs',solver:'public/bridge/solver.mjs',currentModel:'cases/bridge/model.mjs',currentSolver:'public/cases/bridge/solver.mjs',make:'createModel',variant:{pressure:2.5},files:[['lib/bridge/model.mjs','cases/bridge/model.mjs'],['lib/bridge/geometry.mjs','cases/bridge/geometry.mjs'],...['solver.mjs','hybrid.mjs','frame-element.mjs','worker.mjs','model.json','baseline-results.json','cephalo-bridge.glb','cephalo-bridge.stl','ASSUMPTIONS.md','validation.json','hybrid-validation.json','control-validation.json','export-validation.json','v2-preservation.json'].map(f=>['public/bridge/'+f,'public/cases/bridge/'+f])]},
 {id:'loop-towers',zip:'building-v2.zip',folder:'',model:'dist/model.js',solver:'dist/solver.js',currentModel:'public/cases/loop-towers/model.js',currentSolver:'public/cases/loop-towers/solver.js',make:'makeModel',variant:{case:'wind',load:1.2},files:['model.js','solver.js','model.json','worker.js','README.md', 'vendor/three.module.js','vendor/OrbitControls.js'].map(f=>['dist/'+f,'public/cases/loop-towers/'+f])},
 {id:'pavilion',zip:'pavilion-source.zip',folder:'cephalo-petal-lab',model:'dist/model.js',solver:'dist/solver.js',currentModel:'public/cases/pavilion/model.js',currentSolver:'public/cases/pavilion/solver.js',make:'makeModel',variant:{loadCase:'Uplift',pressure:450},files:['model.js','solver.js','model.json','baseline-results.json','README.md','vendor/three.module.js','vendor/three.core.js','vendor/OrbitControls.js'].map(f=>['dist/'+f,'public/cases/pavilion/'+f])}
];
const report={scope:'Integration preservation, not new mechanics validation',generated_at:new Date().toISOString(),cases:[]};
try{
 for(const c of configs){
  const dest=path.join(tmp,c.id);fs.mkdirSync(dest);
  for(const [name,bytes] of Object.entries(unzipSync(fs.readFileSync(path.join(root,'public/downloads',c.zip))))){
   const target=path.resolve(dest,name);assert.ok(target.startsWith(dest+path.sep),'Unsafe archive path');
   if(name.endsWith('/')){fs.mkdirSync(target,{recursive:true});continue;}
   fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
  }
  const original=path.join(dest,c.folder),load=async p=>import(pathToFileURL(p));
  const om=await load(path.join(original,c.model)),osolver=await load(path.join(original,c.solver)),im=await load(path.join(root,c.currentModel)),isolver=await load(path.join(root,c.currentSolver));
  const preserved=c.files.map(([a,b])=>{const before=sha(path.join(original,a)),after=sha(path.join(root,b));assert.equal(after,before,b+' changed');return {file:b,sha256:after,identical:true}});
  const model=im[c.make]();assert.deepEqual(plain(model),plain(om[c.make]()),c.id+' model differs');
  const baseline=isolver.solve(model,im.defaults),expected=JSON.parse(fs.readFileSync(path.join(root,'validation','original-'+c.id+'.json'),'utf8'));
  assert.deepEqual(plain(model),expected.model,c.id+' recorded model differs');
  assert.deepEqual(plain(baseline),expected.result,c.id+' baseline result differs');
  // Pair original and integrated module histories for the representative control change.
  osolver.solve(om[c.make](),om.defaults);
  const params={...im.defaults,...c.variant};
  const a=osolver.solve(om[c.make](params),params),b=isolver.solve(im[c.make](params),params);
  assert.deepEqual(plain(b),plain(a),c.id+' changed-parameter result differs');
  const metric={nodes:model.nodes.length,members:model.members.length,max_displacement_mm:baseline.maxDisplacement*1000,max_deck_displacement_mm:baseline.maxDeckDisplacement?baseline.maxDeckDisplacement*1000:undefined,relative_residual:baseline.relativeResidual};
  report.cases.push({case:c.id,baseline:metric,baseline_full_result:'exact match',variant_parameters:params,variant_full_result:'exact match',preserved});
  console.log('PASS',c.id,JSON.stringify(metric),'baseline and representative control change: exact match');
 }
 fs.mkdirSync(path.join(root,'test-output'),{recursive:true});
 fs.writeFileSync(path.join(root,'test-output/integration-report.json'),JSON.stringify(report,null,2)+'\n');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
