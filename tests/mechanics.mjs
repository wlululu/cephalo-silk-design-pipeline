import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createModel,section} from '../lib/bridge/model.mjs';
import {solve} from '../public/bridge/solver.mjs';
const results=[];const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function test(name,fn){fn();results.push({name,status:'passed'});console.log('PASS',name);}
const E=200e9,s=section(.2,.01),L=3,P=1000,G=E/2.6;
const beam=(axis,force,moment=[0,0,0])=>({nodes:[{id:0,position:[0,0,0]},{id:1,position:axis.map(x=>x*L)}],members:[{id:0,a:0,b:1,material:'steel',section:s}],materials:{steel:{E,nu:.3,fy:355e6}},supports:[{node:0,fixed:Array(6).fill(true)}],loads:[{node:1,force,moment}]});
test('Cantilever axial extension PL/EA',()=>near(solve(beam([1,0,0],[P,0,0])).nodes[1].displacement[0],P*L/(E*s.A),1e-12));
test('Cantilever bending in both planes PL³/3EI and tip rotation',()=>{for(const k of [1,2]){const f=[0,0,0];f[k]=-P;const r=solve(beam([1,0,0],f));near(r.nodes[1].displacement[k],-P*L**3/(3*E*s.Iy),1e-12);near(Math.abs(r.nodes[1].rotation[k===1?2:1]),P*L**2/(2*E*s.Iy),1e-12);near(r.reactions[0].force[k],P);}});
test('Cantilever torsion TL/GJ',()=>near(solve(beam([1,0,0],[0,0,0],[P,0,0])).nodes[1].rotation[0],P*L/(G*s.J),1e-12));
test('Rotated member frame invariance',()=>{const a=[1/Math.sqrt(3),1/Math.sqrt(3),1/Math.sqrt(3)];const f=a.map(v=>P*v);const r=solve(beam(a,f));a.forEach((v,i)=>near(r.nodes[1].displacement[i],v*P*L/(E*s.A),1e-12));const b=solve(beam([0,1,0],[P,0,0]));near(b.nodes[1].displacement[0],P*L**3/(3*E*s.Iy),1e-12);});
const m=createModel(),r=solve(m);
test('Connected graph with no duplicate or zero-length members',()=>{const seen=new Set([0]);while(true){const n=seen.size;m.members.forEach(e=>{assert.notEqual(e.a,e.b);if(seen.has(e.a)||seen.has(e.b)){seen.add(e.a);seen.add(e.b);}});if(n===seen.size)break;}assert.equal(seen.size,m.nodes.length);assert.equal(new Set(m.members.map(e=>[e.a,e.b].sort((a,b)=>a-b).join(':'))).size,m.members.length);});
test('Applied pressure equals q × span × width',()=>near(r.totalLoad[1],-5e3*120*14));
test('Force and moment equilibrium / free DOF residual',()=>{r.forceBalance.forEach(v=>near(v,0,1e-5));assert.ok(r.relativeResidual<1e-9);const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];const moments=[0,0,0];[...m.loads,...r.reactions].forEach(l=>cross(m.nodes[l.node].position,l.force).forEach((v,i)=>moments[i]+=v+(l.moment?.[i]||0)));moments.forEach(v=>near(v,0,.01));});
test('All constrained displacements and rotations vanish',()=>m.supports.forEach(s=>s.fixed.forEach((f,i)=>{if(f)near([...r.nodes[s.node].displacement,...r.nodes[s.node].rotation][i],0,1e-15);})));
test('Longitudinal and transverse symmetry for uniform loading',()=>{
 const key=p=>p.map(v=>Math.round(v*1e7)).join(',');const map=new Map(m.nodes.map(n=>[key(n.position),n.id]));
 const pairs=new Set(m.members.map(e=>[e.a,e.b].sort((a,b)=>a-b).join(':')));
 for(const axis of [0,2]){
  const reflected=m.nodes.map(n=>map.get(key(n.position.map((v,k)=>k===axis?-v:v))));
  m.nodes.forEach(n=>{assert.notEqual(reflected[n.id],undefined);for(let k=0;k<3;k++)near(r.nodes[n.id].displacement[k],r.nodes[reflected[n.id]].displacement[k]*(k===axis?-1:1),1e-10);});
  m.members.forEach(e=>assert.ok(pairs.has([reflected[e.a],reflected[e.b]].sort((a,b)=>a-b).join(':'))));
 }
});
test('Greater pressure increases deck displacement; nonlinear equilibrium is maintained',()=>{const r2=solve(createModel({pressure:10}));assert.ok(r2.maxDeckDisplacement>r.maxDeckDisplacement);assert.ok(r2.relativeResidual<1e-8);});
test('Greater E reduces deck displacement for the hybrid model',()=>assert.ok(solve(createModel({E:300})).maxDeckDisplacement<r.maxDeckDisplacement));
test('Larger sections reduce uniform-load displacement',()=>assert.ok(solve(createModel({primaryScale:1.25,secondaryScale:1.25})).maxDeckDisplacement<r.maxDeckDisplacement));
test('Half-span / midspan / selected-node load magnitudes',()=>{near(solve(createModel({loadCase:'half'})).totalLoad[1],r.totalLoad[1]/2);near(solve(createModel({loadCase:'point',pointLoad:500})).totalLoad[1],-500000);near(solve(createModel({loadCase:'none',selectedNode:30,nodeLoad:100})).totalLoad[1],-100000);});
test('Prestress-only configuration equilibrates with nonnegative cable forces',()=>{const z=solve(createModel({loadCase:'none'}));assert.ok(z.strainEnergy>0);assert.ok(z.relativeResidual<1e-4);z.forceBalance.forEach(v=>near(v,0,1e-5));assert.ok(z.members.filter(m=>m.behavior==='tension_only_cable').every(m=>m.axialForce>=0));});
test('Missing restraints detected without artificial stabilization',()=>assert.throws(()=>solve({...m,supports:[]})));
// Conservative segment-vs-expanded-box check includes member outer radii.
function intersectsBox(a,b,lo,hi){let enter=0,leave=1;for(let k=0;k<3;k++){const d=b[k]-a[k];if(Math.abs(d)<1e-12){if(a[k]<lo[k]||a[k]>hi[k])return false;}else{const ts=[(lo[k]-a[k])/d,(hi[k]-a[k])/d].sort((x,y)=>x-y);enter=Math.max(enter,ts[0]);leave=Math.min(leave,ts[1]);if(enter>leave)return false;}}return true;}
test('Full 156 m travel corridor clears all frame envelopes at maximum section scales',()=>{
 const large=createModel({primaryScale:1.5,secondaryScale:2});
 large.members.forEach(e=>{const rad=e.section.outerDiameter/2;assert.ok(!intersectsBox(large.nodes[e.a].position,large.nodes[e.b].position,[-78-rad,-rad,-6-rad],[78+rad,5+rad,6+rad]),'Intruding member '+e.id);});
 assert.ok(m.geometry.guardrailOffset-.07>m.geometry.usableWidth/2);
});
test('Continuous level deck, approaches and outboard connected root fans',()=>{
 assert.equal(m.topology.roots.length,4);
 for(const edge of m.topology.deck){assert.equal(m.nodes[edge[0]].position[0],-78);assert.equal(m.nodes[edge.at(-1)].position[0],78);edge.forEach((id,i)=>{near(m.nodes[id].position[1],-.65);if(i)near(m.nodes[id].position[0]-m.nodes[edge[i-1]].position[0],6);});}
 m.topology.roots.forEach(root=>{assert.equal(root.grid[0].length,5);root.grid[0].forEach(id=>{assert.ok(Math.abs(m.nodes[id].position[2])>10);assert.ok(m.supports.some(s=>s.node===id));});root.grid[4].forEach(id=>assert.equal(m.nodes[id].region,'arch'));});
 assert.equal(m.supports.filter(s=>s.kind==='root foundation').length,20);
 assert.equal(m.supports.filter(s=>s.kind==='remote approach bearing').length,4);
 assert.ok(!m.supports.some(s=>Math.abs(m.nodes[s.node].position[0])===60&&m.nodes[s.node].region==='deck'));
});
const report={date:new Date().toISOString(),tests:results,baseline:{nodes:m.nodes.length,members:m.members.length,maxDisplacement_mm:r.maxDisplacement*1000,maxDeckDisplacement_mm:r.maxDeckDisplacement*1000,cables:r.cables,totalVerticalLoad_kN:r.totalLoad[1]/1000,totalVerticalReaction_kN:r.totalReaction[1]/1000,relativeResidual:r.relativeResidual,maxNormalStressYieldRatio:Math.max(...r.members.map(m=>m.yieldIndicator)),maxEulerScreeningRatio:Math.max(...r.members.map(m=>m.eulerIndicator))},limits:'Analytical and consistency checks validate this implementation, not image reconstruction accuracy or a real bridge.'};
writeFileSync('public/bridge/validation.json',JSON.stringify(report,null,2));writeFileSync('public/bridge/model.json',JSON.stringify(m,null,2));writeFileSync('public/bridge/baseline-results.json',JSON.stringify(r,null,2));
console.log(JSON.stringify(report.baseline,null,2));
