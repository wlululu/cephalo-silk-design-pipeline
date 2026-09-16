import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {geometry} from '../lib/bridge/geometry.mjs';
import {createModel} from '../lib/bridge/model.mjs';
// GLTFExporter uses browser FileReader; this Node-only shim supplies Blob reads.
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(data=>{this.result='data:'+blob.type+';base64,'+Buffer.from(data).toString('base64');this.onloadend?.();});}};
const model=createModel(),g=geometry(model,null,{mode:'hierarchy',deformed:false,ghost:false,deck:true,region:'all'},false);g.updateMatrixWorld(true);
const glb=Buffer.from(await new GLTFExporter().parseAsync(g,{binary:true}));assert.equal(glb.toString('ascii',0,4),'glTF');assert.equal(glb.readUInt32LE(4),2);assert.equal(glb.readUInt32LE(8),glb.length);
const meta=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)));assert.equal(meta.nodes.filter(n=>n.name?.startsWith('member_')).length,model.members.length);assert.ok(meta.nodes.some(n=>n.name==='visual_continuous_deck_no_shell_stiffness'));assert.ok(meta.nodes.some(n=>n.name==='visual_woven_guardrail_infill'));assert.ok(meta.meshes.length>model.members.length);assert.ok(meta.accessors.every(a=>!a.min||a.min.every(Number.isFinite)));
const stl=new STLExporter().parse(g,{binary:true}),stlBuffer=Buffer.from(stl.buffer);const triangles=stlBuffer.readUInt32LE(80);assert.equal(stlBuffer.length,84+50*triangles);assert.ok(triangles>model.members.length*10);
writeFileSync('public/bridge/cephalo-bridge.glb',glb);writeFileSync('public/bridge/cephalo-bridge.stl',stlBuffer);
const report={status:'passed',geometry:'same geometry factory and exporters as browser',glbVersion:2,glbBytes:glb.length,memberNodes:model.members.length,meshes:meta.meshes.length,stlTriangles:triangles,stlBytes:stlBuffer.length};writeFileSync('public/bridge/export-validation.json',JSON.stringify(report,null,2));console.log(report);
