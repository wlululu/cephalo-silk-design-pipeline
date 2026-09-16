import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createModel} from '../lib/bridge/model.mjs';
const base=JSON.parse(readFileSync(new URL('./fixtures/v2-model.json',import.meta.url))),m=createModel();
const coord=p=>p.map(x=>Math.round(x*1e8)).join(',');
const position=(model,id)=>coord(model.nodes[id].position);
const paths=(model,value)=>Array.isArray(value)?value.map(x=>paths(model,x)):position(model,value);
const records=[],test=(name,fn)=>{fn();records.push({name,status:'passed'});console.log('PASS',name);};
test('All V2 global dimensions retained',()=>{for(const k of Object.keys(base.geometry))assert.equal(m.geometry[k],base.geometry[k]);});
test('All 126 V2 arch station coordinates retained',()=>assert.deepEqual(paths(m,m.topology.rib),paths(base,base.topology.rib)));
test('Deck and approach nodes retained',()=>assert.deepEqual(paths(m,m.topology.deck),paths(base,base.topology.deck)));
test('Four V2 root fan grids retained',()=>assert.deepEqual(m.topology.roots.map(r=>paths(m,r.grid)),base.topology.roots.map(r=>paths(base,r.grid))));
const memberSignature=(model,e)=>JSON.stringify({ends:[position(model,e.a),position(model,e.b)].sort(),group:e.group,type:e.type,region:e.region,material:e.material,section:e.section});
test('V2 longitudinal/transverse deck frames and roots retain connectivity and sections',()=>{
 const keep=e=>e.type!=='rib'&&e.region!=='orb web'&&e.region!=='rib weave'&&e.region!=='crown'&&e.region!=='under deck';
 assert.deepEqual(m.members.filter(keep).map(e=>memberSignature(m,e)).sort(),base.members.filter(keep).map(e=>memberSignature(base,e)).sort());
});
test('Under-deck tie connectivity retained while changing to cable behavior',()=>{
 const pairs=model=>model.members.filter(e=>e.region==='under deck').map(e=>[position(model,e.a),position(model,e.b)].sort().join(':')).sort();assert.deepEqual(pairs(m),pairs(base));assert.ok(m.members.filter(e=>e.region==='under deck').every(e=>e.behavior==='tension_only_cable'));
});
test('Support conditions and loading retained',()=>{
 for(const prop of ['supports','loads']){const normalized=model=>model[prop].map(({node,...other})=>JSON.stringify({position:position(model,node),...other})).sort();assert.deepEqual(normalized(m),normalized(base));}
});
test('Local web hubs and original panel anchors retained; no global motif added',()=>{
 assert.equal(m.topology.webs.length,base.topology.webs.length);
 m.topology.webs.forEach((w,i)=>{assert.equal(position(m,w.hub),position(base,base.topology.webs[i].hub));assert.equal(w.rings.length,2);assert.equal(w.boundary.length,12);const actual=new Set(w.boundary.map(id=>position(m,id)));base.topology.webs[i].boundary.forEach(id=>assert.ok(actual.has(position(base,id))));});
});
test('Added arch points lie on V2 analytic curves; thick graded chords use those paths',()=>{
 const offsets=[[-1.15,0],[1.15,.85],[-.45,1.9]];
 for(const n of m.nodes.filter(n=>n.region==='arch refinement')){const q=n.position[0]/60,[dy,dz]=offsets[n.lane];assert.ok(Math.abs(n.position[1]-(28-36*q*q+dy))<1e-10);assert.ok(Math.abs(Math.abs(n.position[2])-(8.4+4*q**4+dz))<1e-10);}
 m.members.filter(e=>e.type==='rib').forEach(e=>{assert.ok(e.section.outerDiameter>=.85&&e.section.outerDiameter<=1.05);assert.equal(e.behavior,'bilateral_frame');});
 assert.equal(m.members.filter(e=>e.type==='rib').length,3*base.members.filter(e=>e.type==='rib').length);
});
writeFileSync('public/bridge/v2-preservation.json',JSON.stringify({base:'User-saved cephalo-bridge-project_v2.zip, 442 nodes / 1711 members',tests:records,scope:'Preservation of V2 is checked numerically. Single-image reconstruction fidelity is not quantified.'},null,2));
