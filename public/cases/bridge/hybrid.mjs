/** Elastic small-displacement frames + corotational tension-only cables.
 * Newton energy minimization with line search. Temporary Hessian regularization
 * is allowed during iteration only; final equilibrium/stability are checked
 * against the unmodified physical tangent. No artificial support springs.
 */
import {element} from './frame-element.mjs';
const norm=v=>Math.hypot(...v);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export function cableState(model,m,u,tangent=true){
 const a=model.nodes[m.a].position,b=model.nodes[m.b].position;
 const d=b.map((v,k)=>v+u[6*m.b+k]-a[k]-u[6*m.a+k]),length=norm(d);
 if(length<1e-8)throw Error('Collapsed cable '+m.id);
 const direction=d.map(v=>v/length),EA=model.materials[m.material].E*m.section.A;
 const extension=Math.max(0,length-m.restLength),force=EA*extension/m.restLength;
 const dofs=[0,1,2].map(k=>6*m.a+k).concat([0,1,2].map(k=>6*m.b+k));
 const f=direction.map(v=>-force*v).concat(direction.map(v=>force*v));
 const k=new Float64Array(36);
 if(tangent&&extension>0)for(let i=0;i<3;i++)for(let j=0;j<3;j++){
  const v=(EA/m.restLength-force/length)*direction[i]*direction[j]+(i===j?force/length:0);
  k[i*6+j]=v;k[(i+3)*6+j+3]=v;k[i*6+j+3]=-v;k[(i+3)*6+j]=-v;
 }
 return {dofs,k,f,force,length,direction,energy:.5*EA/m.restLength*extension**2};
}
function layout(model,frameNodes){
 const blocked=new Set();
 model.supports.forEach(s=>s.fixed.forEach((v,k)=>{if(v)blocked.add(6*s.node+k);}));
 const adjacency=model.nodes.map(()=>new Set());
 model.members.forEach(m=>{adjacency[m.a].add(m.b);adjacency[m.b].add(m.a);});
 const visited=new Set(),order=[];
 while(order.length<model.nodes.length){
  let seed=-1;for(let i=0;i<adjacency.length;i++)if(!visited.has(i)&&(seed<0||adjacency[i].size<adjacency[seed].size))seed=i;
  const queue=[seed];visited.add(seed);
  for(let q=0;q<queue.length;q++){
   const n=queue[q];order.push(n);
   for(const v of [...adjacency[n]].sort((a,b)=>adjacency[a].size-adjacency[b].size||a-b))if(!visited.has(v)){visited.add(v);queue.push(v);}
  }
 }
 const free=order.reverse().flatMap(n=>Array.from({length:frameNodes.has(n)?6:3},(_,k)=>6*n+k)).filter(d=>!blocked.has(d));
 const map=new Int32Array(model.nodes.length*6).fill(-1);free.forEach((d,i)=>map[d]=i);
 const first=Int32Array.from(free,(_,i)=>i),offset=new Int32Array(free.length+1);
 model.members.forEach(m=>{
  const count=m.behavior==='tension_only_cable'?3:6;
  const ids=[m.a,m.b].flatMap(n=>Array.from({length:count},(_,k)=>map[6*n+k])).filter(i=>i>=0);
  for(const i of ids)for(const j of ids)if(j<=i)first[i]=Math.min(first[i],j);
 });
 for(let i=0;i<free.length;i++)offset[i+1]=offset[i]+i-first[i]+1;
 return {free,map,first,offset,index:(i,j)=>offset[i]+j-first[i]};
}
function factorSolve(values,rhs,layout,shift=0,dormant=new Set()){
 const {free,first,offset,index}=layout,n=free.length,K=values.slice();
 const peak=Math.max(...free.map((_,i)=>K[index(i,i)]));
 if(!(peak>0))throw Error('Unrestrained structure');
 if(shift)for(let i=0;i<n;i++)K[index(i,i)]+=shift*Math.max(K[index(i,i)],peak*1e-6);
 const inactive=[];
 for(let i=0;i<n;i++)if(K[index(i,i)]===0&&Math.abs(rhs[i])<1e-5&&dormant.has(free[i])){K[index(i,i)]=1;inactive.push(free[i]);}
 const scale=Float64Array.from(free,(_,i)=>Math.sqrt(K[index(i,i)])),b=Float64Array.from(rhs,(v,i)=>v/scale[i]);
 for(let i=0;i<n;i++){
  if(!(scale[i]>0))throw Error('Unrestrained DOF '+free[i]);
  for(let j=first[i];j<=i;j++)K[index(i,j)]/=scale[i]*scale[j];
 }
 let minPivot=Infinity;
 for(let i=0;i<n;i++)for(let j=first[i];j<=i;j++){
  let sum=K[index(i,j)];const begin=Math.max(first[i],first[j]),oi=offset[i]-first[i],oj=offset[j]-first[j];
  for(let k=begin;k<j;k++)sum-=K[oi+k]*K[oj+k];
  if(i===j){if(!(sum>1e-13))throw Error('Slack web or unrestrained structure at DOF '+free[i]);minPivot=Math.min(minPivot,sum);K[index(i,i)]=Math.sqrt(sum);}
  else K[index(i,j)]=sum/K[index(j,j)];
 }
 for(let i=0;i<n;i++){for(let j=first[i];j<i;j++)b[i]-=K[index(i,j)]*b[j];b[i]/=K[index(i,i)];}
 for(let i=n-1;i>=0;i--){b[i]/=K[index(i,i)];for(let j=first[i];j<i;j++)b[j]-=K[index(i,j)]*b[i];}
 return {step:b.map((v,i)=>v/scale[i]),minPivot,inactive};
}
const prestressCache=new Map();
export function solveHybrid(model){
 const frames=[],cables=[],frameNodes=new Set(),nd=model.nodes.length*6;
 for(const m of model.members){
  if(m.behavior==='tension_only_cable')cables.push(m);
  else{frames.push({m,e:element(model,m)});frameNodes.add(m.a);frameNodes.add(m.b);}
 }
 const system=layout(model,frameNodes),{free,map,index,offset}=system;
 const F=new Float64Array(nd),u=new Float64Array(nd),baseK=new Float64Array(offset.at(-1));
 model.loads.forEach(l=>[...l.force,...(l.moment||[0,0,0])].forEach((v,k)=>{
  if(k>=3&&!frameNodes.has(l.node)&&v)throw Error('A cable-only joint cannot carry a nodal moment');
  F[6*l.node+k]+=v;
 }));
 const assemble=(K,dofs,k)=>{const n=dofs.length;for(let i=0;i<n;i++){const a=map[dofs[i]];if(a<0)continue;for(let j=0;j<n;j++){const b=map[dofs[j]];if(b>=0&&b<=a)K[index(a,b)]+=k[i*n+j];}}};
 frames.forEach(({e})=>assemble(baseK,e.dofs,e.kg));
 function evaluate(x,loadFactor,tangent){
  const internal=new Float64Array(nd),K=tangent?baseK.slice():null;let energy=0;
  for(const {e} of frames)for(let i=0;i<12;i++){
   let f=0;for(let j=0;j<12;j++)f+=e.kg[i*12+j]*x[e.dofs[j]];
   internal[e.dofs[i]]+=f;energy+=.5*f*x[e.dofs[i]];
  }
  for(const m of cables){const e=cableState(model,m,x,tangent);energy+=e.energy;e.dofs.forEach((d,i)=>internal[d]+=e.f[i]);if(tangent)assemble(K,e.dofs,e.k);}
  const residual=Float64Array.from(free,d=>internal[d]-loadFactor*F[d]);
  return {internal,K,residual,energy,potential:energy-loadFactor*dot(x,F)};
 }
 const tolerance=Math.max(.002,norm(F)*1e-9),history=[];let final,minPivot=0,inactive=[],cableMechanisms=false;
 const dormant=new Set(free.filter(d=>!frameNodes.has(Math.floor(d/6))));
 // The supported frame skeleton must be stable on its own. Zero rows at
 // cable-only joints are omitted algebraically for this check, not supported.
 const framePivot=frames.length?factorSolve(baseK,new Float64Array(free.length),system,0,dormant).minPivot:null;
 const cacheKey=JSON.stringify({nodes:model.nodes,members:model.members,materials:model.materials,supports:model.supports});
 const cached=prestressCache.get(cacheKey);
 if(cached){u.set(cached.u);history.push({...cached.history,cached:true});}
 // First find the self-equilibrated prestressed configuration, then load it.
 for(const loadFactor of norm(F)?(cached?[.25,.5,.75,1]:[0,.25,.5,.75,1]):[0]){
  let converged=false;
  for(let iteration=0;iteration<=240;iteration++){
   const state=evaluate(u,loadFactor,true),residualNorm=norm(state.residual);
   if(residualNorm<(loadFactor===0?.02:tolerance)){
    try{const checked=factorSolve(state.K,new Float64Array(free.length),system,0,dormant);minPivot=checked.minPivot;inactive=checked.inactive;cableMechanisms=inactive.length>0;}
    catch(error){if(!framePivot)throw error;minPivot=null;cableMechanisms=true;}
    // A positive-definite frame skeleton plus positive-semidefinite cable tangents
    // can only lose rank through free/slack cable motion, not frame instability.
    history.push({loadFactor,iterations:iteration,residualNorm});final=state;converged=true;
    if(loadFactor===0){if(prestressCache.size>=4)prestressCache.delete(prestressCache.keys().next().value);prestressCache.set(cacheKey,{u:u.slice(),history:history.at(-1)});}
    break;
   }
   let direction;
   for(const shift of [0,1e-9,1e-7,1e-5,.001,.1]){
    try{direction=factorSolve(state.K,state.residual.map(v=>-v),system,shift).step;break;}catch(e){if(shift===.1)throw e;}
   }
   const slope=dot(state.residual,direction),largest=Math.max(...direction.map(Math.abs));
   if(!(slope<0))throw Error('Cable equilibrium could not find a descent step');
   let alpha=Math.min(1,.75/Math.max(.75,largest)),accepted=false;
   for(let attempt=0;attempt<28;attempt++){
    const candidate=u.slice();free.forEach((d,i)=>candidate[d]+=alpha*direction[i]);
    const next=evaluate(candidate,loadFactor,false);
    if(next.potential<=state.potential+1e-4*alpha*slope+1e-8||norm(next.residual)<residualNorm*.5){u.set(candidate);accepted=true;break;}
    alpha*=.5;
   }
   if(!accepted)throw Error('Cable equilibrium line search stalled');
  }
  if(!converged)throw Error('Cable equilibrium did not converge at load factor '+loadFactor+' (residual '+norm(evaluate(u,loadFactor,false).residual).toExponential(2)+' N); try a smaller load or larger sections');
 }
 const memberResults=new Array(model.members.length);
 for(const {m,e} of frames){
  const ul=new Float64Array(12),fl=new Float64Array(12);
  for(let b=0;b<4;b++)for(let i=0;i<3;i++)for(let j=0;j<3;j++)ul[b*3+i]+=e.R[i][j]*u[e.dofs[b*3+j]];
  for(let i=0;i<12;i++)for(let j=0;j<12;j++)fl[i]+=e.k[i*12+j]*ul[j];
  const s=m.section,mat=model.materials[m.material],N=fl[6],bend=Math.max(Math.hypot(fl[4],fl[5]),Math.hypot(fl[10],fl[11]));
  const stress=Math.abs(N)/s.A+bend*(s.outerDiameter/2)/s.Iy,pcr=Math.PI**2*mat.E*Math.min(s.Iy,s.Iz)/e.L**2;
  memberResults[m.id]={member:m.id,behavior:'bilateral_frame',axialForce:N,axialStress:N/s.A,maxCombinedNormalStress:stress,yieldIndicator:stress/mat.fy,eulerIndicator:Math.max(0,-N)/pcr,localEndForces:Array.from(fl)};
 }
 for(const m of cables){
  const e=cableState(model,m,u,false),stress=e.force/m.section.A;
  memberResults[m.id]={member:m.id,behavior:m.behavior,status:e.force>1e-4?'taut':'slack',axialForce:e.force,axialStress:stress,maxCombinedNormalStress:stress,yieldIndicator:stress/model.materials[m.material].fy,eulerIndicator:0,localEndForces:[-e.force,0,0,0,0,0,e.force,0,0,0,0,0]};
 }
 const residual=final.internal.map((v,i)=>v-F[i]);
 const nodes=model.nodes.map(n=>({node:n.id,displacement:Array.from(u.slice(6*n.id,6*n.id+3)),rotation:Array.from(u.slice(6*n.id+3,6*n.id+6)),magnitude:norm(u.slice(6*n.id,6*n.id+3))}));
 const reactions=model.supports.map(s=>({node:s.node,force:[0,1,2].map(k=>s.fixed[k]?residual[6*s.node+k]:0),moment:[3,4,5].map(k=>s.fixed[k]?residual[6*s.node+k]:0)}));
 const totalLoad=[0,0,0],totalReaction=[0,0,0];model.loads.forEach(l=>l.force.forEach((v,k)=>totalLoad[k]+=v));reactions.forEach(r=>r.force.forEach((v,k)=>totalReaction[k]+=v));
 const deckNodes=new Set(model.topology?.deck.flat()||[]);
 return {nodes,members:memberResults,reactions,maxDisplacement:Math.max(...nodes.map(n=>n.magnitude)),maxDeckDisplacement:Math.max(0,...nodes.filter(n=>deckNodes.has(n.node)).map(n=>n.magnitude)),totalLoad,totalReaction,forceBalance:totalLoad.map((v,k)=>v+totalReaction[k]),residualNorm_N:norm(final.residual),initialEquilibriumTolerance_N:.02,loadEquilibriumTolerance_N:tolerance,relativeResidual:norm(final.residual)/Math.max(1,norm(F),norm(final.internal)),residualReferenceForce_N:Math.max(1,norm(F),norm(final.internal)),strainEnergy:final.energy,minScaledPivot:minPivot,activeDofs:free.length-inactive.length,cableMechanisms,frameMinScaledPivot:framePivot,inactiveCableDofs:inactive,nonlinearHistory:history,cables:{total:cables.length,taut:memberResults.filter(m=>m.status==='taut').length,slack:memberResults.filter(m=>m.status==='slack').length},solver:'Linear elastic frames + corotational tension-only cables; equilibrated initial shortening; Newton line search / skyline Cholesky',displacementReference:'Authored geometry; includes prestress equilibration as well as applied load'};
}
