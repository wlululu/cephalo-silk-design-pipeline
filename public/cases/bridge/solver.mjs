/** Linear 3D Euler–Bernoulli frame solver. Six DOFs/node [u,v,w,rx,ry,rz]. */
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
import {element} from './frame-element.mjs';
import {solveHybrid} from './hybrid.mjs';
export function solve(model){
 if(model.members.some(m=>m.behavior==='tension_only_cable'))return solveHybrid(model);
 const nd=model.nodes.length*6,constrained=new Set();
 model.supports.forEach(s=>s.fixed.forEach((f,i)=>{if(f)constrained.add(s.node*6+i);}));
 // Reverse Cuthill–McKee node ordering reduces the skyline without changing the equations.
 const adjacency=model.nodes.map(()=>new Set());
 model.members.forEach(m=>{adjacency[m.a].add(m.b);adjacency[m.b].add(m.a);});
 const visited=new Set(),order=[];
 while(order.length<model.nodes.length){
  let seed=-1;for(let i=0;i<adjacency.length;i++)if(!visited.has(i)&&(seed<0||adjacency[i].size<adjacency[seed].size))seed=i;
  const queue=[seed];visited.add(seed);
  for(let q=0;q<queue.length;q++){
   const n=queue[q];order.push(n);
   const next=[...adjacency[n]].filter(v=>!visited.has(v)).sort((a,b)=>adjacency[a].size-adjacency[b].size||a-b);
   for(const v of next)if(!visited.has(v)){visited.add(v);queue.push(v);}
  }
 }
 const free=order.reverse().flatMap(n=>Array.from({length:6},(_,i)=>n*6+i)).filter(d=>!constrained.has(d));
 const nf=free.length,map=new Int32Array(nd).fill(-1);free.forEach((d,i)=>map[d]=i);
 const F=new Float64Array(nd),elements=model.members.map(m=>element(model,m));
 const first=Int32Array.from({length:nf},(_,i)=>i),offset=new Int32Array(nf+1);
 elements.forEach(e=>{const d=e.dofs.map(v=>map[v]).filter(v=>v>=0);for(const i of d)for(const j of d)if(j<=i)first[i]=Math.min(first[i],j);});
 for(let i=0;i<nf;i++)offset[i+1]=offset[i]+i-first[i]+1;
 const K=new Float64Array(offset[nf]),index=(i,j)=>offset[i]+j-first[i];
 model.loads.forEach(l=>[...l.force,...(l.moment||[0,0,0])].forEach((v,i)=>F[l.node*6+i]+=v));
 elements.forEach(e=>e.dofs.forEach((r,i)=>{const a=map[r];if(a<0)return;e.dofs.forEach((c,j)=>{const b=map[c];if(b>=0&&b<=a)K[index(a,b)]+=e.kg[i*12+j];});}));
 // Symmetric equilibration and exact skyline Cholesky; no stabilization or dropped fill.
 const scale=Float64Array.from(free,(_,i)=>Math.sqrt(K[index(i,i)])),rhs=Float64Array.from(free,(d,i)=>F[d]/scale[i]);
 for(let i=0;i<nf;i++){
  if(!Number.isFinite(scale[i])||scale[i]<=0)throw Error('Unrestrained DOF '+free[i]);
  for(let j=first[i];j<=i;j++)K[index(i,j)]/=scale[i]*scale[j];
 }
 let minPivot=Infinity;
 for(let i=0;i<nf;i++)for(let j=first[i];j<=i;j++){
  let sum=K[index(i,j)];
  const begin=Math.max(first[i],first[j]),oi=offset[i]-first[i],oj=offset[j]-first[j];
  for(let k=begin;k<j;k++)sum-=K[oi+k]*K[oj+k];
  if(i===j){if(!(sum>1e-12))throw Error('Unstable or ill-conditioned stiffness matrix at DOF '+free[i]);minPivot=Math.min(minPivot,sum);K[index(i,i)]=Math.sqrt(sum);}
  else K[index(i,j)]=sum/K[index(j,j)];
 }
 for(let i=0;i<nf;i++){for(let j=first[i];j<i;j++)rhs[i]-=K[index(i,j)]*rhs[j];rhs[i]/=K[index(i,i)];}
 for(let i=nf-1;i>=0;i--){rhs[i]/=K[index(i,i)];for(let j=first[i];j<i;j++)rhs[j]-=K[index(i,j)]*rhs[i];}
 const u=new Float64Array(nd);free.forEach((d,i)=>u[d]=rhs[i]/scale[i]);
 const internal=new Float64Array(nd);
 const memberResults=elements.map((e,idx)=>{
  const ul=new Float64Array(12);for(let b=0;b<4;b++)for(let i=0;i<3;i++)for(let j=0;j<3;j++)ul[b*3+i]+=e.R[i][j]*u[e.dofs[b*3+j]];
  const fl=new Float64Array(12);for(let i=0;i<12;i++)for(let j=0;j<12;j++){fl[i]+=e.k[i*12+j]*ul[j];internal[e.dofs[i]]+=e.kg[i*12+j]*u[e.dofs[j]];}
  const m=model.members[idx],s=m.section,mat=model.materials[m.material],N=fl[6],bend=Math.max(Math.hypot(fl[4],fl[5]),Math.hypot(fl[10],fl[11])),stress=Math.abs(N)/s.A+bend*(s.outerDiameter/2)/s.Iy;
  const pcr=Math.PI**2*mat.E*Math.min(s.Iy,s.Iz)/e.L**2;
  return {member:m.id,axialForce:N,axialStress:N/s.A,maxCombinedNormalStress:stress,yieldIndicator:stress/mat.fy,eulerIndicator:Math.max(0,-N)/pcr,localEndForces:Array.from(fl)};
 });
 const residual=internal.map((v,i)=>v-F[i]);
 const nodeResults=model.nodes.map(n=>({node:n.id,displacement:Array.from(u.slice(n.id*6,n.id*6+3)),rotation:Array.from(u.slice(n.id*6+3,n.id*6+6)),magnitude:norm(u.slice(n.id*6,n.id*6+3))}));
 const reactions=model.supports.map(s=>({node:s.node,force:[0,1,2].map(i=>s.fixed[i]?residual[s.node*6+i]:0),moment:[3,4,5].map(i=>s.fixed[i]?residual[s.node*6+i]:0)}));
 const sumLoad=[0,0,0],sumReaction=[0,0,0];model.loads.forEach(l=>l.force.forEach((v,i)=>sumLoad[i]+=v));reactions.forEach(r=>r.force.forEach((v,i)=>sumReaction[i]+=v));
 return {nodes:nodeResults,members:memberResults,reactions,maxDisplacement:Math.max(...nodeResults.map(n=>n.magnitude)),totalLoad:sumLoad,totalReaction:sumReaction,relativeResidual:norm(free.map(d=>residual[d]))/Math.max(1,norm(F)),forceBalance:sumLoad.map((v,i)=>v+sumReaction[i]),strainEnergy:.5*dot(u,F),minScaledPivot:minPivot,solver:'linear 3D Euler–Bernoulli frame; RCM-ordered equilibrated skyline Cholesky'};
}
