import {properties} from './model.js';
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.sqrt(dot(a,a)),unit=a=>a.map(x=>x/norm(a));
export function solve(model,{pressure=300,loadCase='Gravity',stiffness=1,thickness=1,nodalLoads=[]}={}){
 const nd=model.nodes.length*6,F=new Float64Array(nd),diag=new Float64Array(nd),els=[];
 const active=new Set();const fixed=new Set(model.supports.flatMap(s=>[0,1,2,3,4,5].map(d=>s.node*6+d)));
 for(const face of model.faces){let p=face.map(n=>model.nodes[n].position);let area=Math.abs((p[1][0]-p[0][0])*(p[2][2]-p[0][2])-(p[2][0]-p[0][0])*(p[1][2]-p[0][2]))/2;
  if(loadCase==='Asymmetric'&&p.reduce((s,q)=>s+q[0],0)<=0)continue;
  let axis=loadCase==='Lateral'?0:1,sign=loadCase==='Uplift'||loadCase==='Lateral'?1:-1;for(let n of face)F[6*n+axis]+=sign*pressure*area/3;
 }
 for(const load of nodalLoads)for(let d=0;d<3;d++)F[load.node*6+d]+=load.force[d];
 for(const m of model.members){const [a,b]=m.nodes,p=model.nodes[a].position,q=model.nodes[b].position,d=q.map((x,i)=>x-p[i]),L=norm(d),ex=unit(d),pr=properties(model,m,thickness,stiffness),{E,G,A,I,J,T}=pr;
  let ids,k;
  if(m.type==='frame'){
   const ez=unit(cross(ex,Math.abs(ex[1])<.9?[0,1,0]:[0,0,1])),ey=cross(ez,ex),R=[ex,ey,ez];
   const local=Array.from({length:12},()=>new Float64Array(12));
   const setBlock=(ix,mat)=>ix.forEach((i,r)=>ix.forEach((j,c)=>local[i][j]+=mat[r][c]));
   setBlock([0,6],[[E*A/L,-E*A/L],[-E*A/L,E*A/L]]);setBlock([3,9],[[G*J/L,-G*J/L],[-G*J/L,G*J/L]]);
   const a12=12*E*I/L**3,b6=6*E*I/L**2,c4=4*E*I/L,c2=2*E*I/L;
   setBlock([1,5,7,11],[[a12,b6,-a12,b6],[b6,c4,-b6,c2],[-a12,-b6,a12,-b6],[b6,c2,-b6,c4]]);
   setBlock([2,4,8,10],[[a12,-b6,-a12,-b6],[-b6,c4,b6,c2],[-a12,b6,a12,b6],[-b6,c2,b6,c4]]);
   k=new Float64Array(144);for(let bi=0;bi<4;bi++)for(let bj=0;bj<4;bj++)for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let s=0;s<3;s++)for(let t=0;t<3;t++)k[(bi*3+i)*12+bj*3+j]+=R[s][i]*local[bi*3+s][bj*3+t]*R[t][j];
   ids=[0,1,2,3,4,5].map(x=>a*6+x).concat([0,1,2,3,4,5].map(x=>b*6+x));
  }else{
   ids=[a*6,a*6+1,a*6+2,b*6,b*6+1,b*6+2];k=new Float64Array(36);
   for(let i=0;i<3;i++)for(let j=0;j<3;j++){let h=E*A/L*ex[i]*ex[j]+T/L*((i===j?1:0)-ex[i]*ex[j]);k[i*6+j]=h;k[(i+3)*6+j+3]=h;k[i*6+j+3]=-h;k[(i+3)*6+j]=-h;}
  }
  ids.forEach((id,i)=>{active.add(id);diag[id]+=k[i*ids.length+i]});els.push({ids,k,L,ex,pr,m});
 }
 const free=[...active].filter(i=>!fixed.has(i));
 const multiply=x=>{let y=new Float64Array(nd);for(const {ids,k} of els){let n=ids.length;for(let i=0;i<n;i++){let s=0;for(let j=0;j<n;j++)s+=k[i*n+j]*x[ids[j]];y[ids[i]]+=s;}}return y;};
 const u=new Float64Array(nd),r=F.slice(),z=new Float64Array(nd),p=new Float64Array(nd);
 for(let i of free)p[i]=z[i]=r[i]/diag[i];let rz=free.reduce((s,i)=>s+r[i]*z[i],0),bn=Math.sqrt(free.reduce((s,i)=>s+F[i]**2,0)),rel=bn?1:0,iterations=0;
 for(;iterations<6000&&rel>1e-7;iterations++){let ap=multiply(p),den=free.reduce((s,i)=>s+p[i]*ap[i],0);if(!(den>0))break;let alpha=rz/den;
  for(let i of free){u[i]+=alpha*p[i];r[i]-=alpha*ap[i];z[i]=r[i]/diag[i];}
  rel=Math.sqrt(free.reduce((s,i)=>s+r[i]**2,0))/bn;let next=free.reduce((s,i)=>s+r[i]*z[i],0),beta=next/rz;for(let i of free)p[i]=z[i]+beta*p[i];rz=next;
 }
 const ku=multiply(u),reactions=model.supports.map(s=>({node:s.node,force:[0,1,2].map(i=>ku[s.node*6+i]-F[s.node*6+i]),moment:[3,4,5].map(i=>ku[s.node*6+i]-F[s.node*6+i])}));
 const displacements=model.nodes.map(n=>Array.from(u.slice(n.id*6,n.id*6+3))),magnitudes=displacements.map(norm);
 const axial=els.map(e=>{let [a,b]=e.m.nodes;return e.pr.E*e.pr.A/e.L*dot(displacements[b].map((x,i)=>x-displacements[a][i]),e.ex)+(e.m.type==='frame'?0:e.pr.T);});
 const slack=axial.filter((x,i)=>model.members[i].type!=='frame'&&x<0).length;
 const totalLoad=[0,1,2].map(a=>model.nodes.reduce((s,n)=>s+F[n.id*6+a],0));
 const balance=totalLoad.map((x,a)=>x+reactions.reduce((s,r)=>s+r.force[a],0));
 return {displacements,magnitudes,axial,reactions,totalLoad,balance,maxDisplacement:Math.max(...magnitudes),maxAxial:Math.max(...axial.map(Math.abs)),slack,iterations,relativeResidual:rel,converged:rel<=1e-6,parameters:{pressure,loadCase,stiffness,thickness}};
}
