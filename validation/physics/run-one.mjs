// Read-only adapter: imports the shipped model and solver in a fresh Node process.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..');
const spec=JSON.parse(process.argv[2]);
const config={bridge:['cases/bridge/model.mjs','public/cases/bridge/solver.mjs','createModel'], 'loop-towers':['public/cases/loop-towers/model.js','public/cases/loop-towers/solver.js','makeModel'],pavilion:['public/cases/pavilion/model.js','public/cases/pavilion/solver.js','makeModel']}[spec.case];
const mod=await import(pathToFileURL(path.join(root,config[0]))), solver=await import(pathToFileURL(path.join(root,config[1])));
const defaults=mod.defaults??{pressure:300,loadCase:'Gravity',stiffness:1,thickness:1,nodalLoads:[]};
const parameters={...defaults,...spec.overrides};
const model=mod[config[2]](parameters),start=performance.now();
const record={...spec,parameters,runtime:process.version,model_source:config[0],solver_source:config[1],model,result:null};
try {record.result=solver.solve(model,parameters);record.completed=true;}catch(e){record.completed=false;record.error={message:e.message,stack:e.stack};}
record.elapsed_seconds=(performance.now()-start)/1000;
const geometry={nodes:model.nodes,members:model.members.map(m=>({id:m.id,nodes:m.nodes??[m.a,m.b],type:m.type,behavior:m.behavior,section_name:typeof m.section==='string'?m.section:undefined})),supports:model.supports,faces:model.faces};
record.geometry_topology_support_sha256=createHash('sha256').update(JSON.stringify(geometry)).digest('hex');
fs.writeFileSync(path.join(root,'validation/physics/runs',spec.id+'.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({id:spec.id,completed:record.completed,elapsed:record.elapsed_seconds,u:record.result?.maxDisplacement,residual:record.result?.relativeResidual,error:record.error?.message}));
