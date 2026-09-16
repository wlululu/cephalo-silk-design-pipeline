import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {cableState} from '../public/bridge/hybrid.mjs';
import {solve} from '../public/bridge/solver.mjs';
import {createModel} from '../lib/bridge/model.mjs';
const records=[],test=(name,fn)=>{fn();records.push({name,status:'passed'});console.log('PASS',name);};
const E=200e9,A=.001,L0=.999,P=1000;
const sample={nodes:[{id:0,position:[-1,0,0]},{id:1,position:[1,0,0]},{id:2,position:[0,0,0]}],members:[0,1].map(a=>({id:a,a,b:2,material:'steel',behavior:'tension_only_cable',restLength:L0,section:{A,outerDiameter:Math.sqrt(4*A/Math.PI),Iy:0,Iz:0,J:0}})),supports:[0,1].map(node=>({node,fixed:Array(6).fill(true)})),loads:[{node:2,force:[0,-P,0]}],materials:{steel:{E,fy:1e9,nu:.3}}};
test('Two-cable transverse load matches exact nonlinear force equilibrium',()=>{
 let lo=0,hi=.1;for(let i=0;i<80;i++){const y=(lo+hi)/2,l=Math.hypot(1,y),f=2*E*A*(l-L0)/L0*y/l;if(f>P)hi=y;else lo=y;}
 const r=solve(sample);assert.ok(Math.abs(r.nodes[2].displacement[1]+(lo+hi)/2)<1e-10);assert.ok(r.relativeResidual<1e-8);
 assert.equal(r.activeDofs,3);assert.ok(r.members.every(m=>m.localEndForces.filter((_,i)=>i!==0&&i!==6).every(v=>v===0)));
});
test('Cable compression is released with exactly zero force, energy and tangent',()=>{
 const u=new Float64Array(18);u[12]=-.01;const e=cableState(sample,sample.members[0],u);assert.equal(e.force,0);assert.equal(e.energy,0);assert.ok(e.k.every(v=>v===0));
});
test('Corotational cable tangent matches finite differences of internal force',()=>{
 const u=new Float64Array(18);u[13]=-.04;u[14]=.01;const e=cableState(sample,sample.members[0],u),h=1e-6;
 for(let j=0;j<6;j++){const plus=u.slice(),minus=u.slice();plus[e.dofs[j]]+=h;minus[e.dofs[j]]-=h;const fp=cableState(sample,sample.members[0],plus,false).f,fm=cableState(sample,sample.members[0],minus,false).f;for(let i=0;i<6;i++)assert.ok(Math.abs((fp[i]-fm[i])/(2*h)-e.k[i*6+j])<.05+1e-9*Math.abs(e.k[i*6+j]));}
});
const model=createModel();
test('Five structural systems and actual tension-only web are explicitly classified',()=>{
 assert.deepEqual(new Set(model.members.map(m=>m.system)),new Set(['primary_arch','arch_internal','deck_system','cable_web','end_support']));
 for(const m of model.members){if(m.system==='cable_web'||m.region==='under deck'){assert.equal(m.behavior,'tension_only_cable');assert.equal(m.section.Iy,0);assert.ok(m.section.outerDiameter<=.035);}else assert.equal(m.behavior,'bilateral_frame');}
});
test('Arch diaphragms occupy the retained three-chord envelope at every 2 m station',()=>{
 const pairs=new Map(model.members.map(m=>[[m.a,m.b].sort((a,b)=>a-b).join(':'),m]));
 for(const side of model.topology.archStations){assert.equal(side.length,61);for(const station of side){assert.equal(station.length,3);for(let j=0;j<3;j++){const m=pairs.get([station[j],station[(j+1)%3]].sort((a,b)=>a-b).join(':'));assert.ok(m);assert.equal(m.system,'arch_internal');assert.equal(m.behavior,'bilateral_frame');}}}
});
writeFileSync('public/bridge/hybrid-validation.json',JSON.stringify({tests:records,scope:'Cable constitutive law, nonlinear benchmark, classifications and arch topology. Not an engineering design certification.'},null,2));
