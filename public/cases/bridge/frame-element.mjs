/** Linear 3D Euler–Bernoulli frame solver. Six DOFs/node [u,v,w,rx,ry,rz]. */
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
export function element(model,m){
 const a=model.nodes[m.a].position,b=model.nodes[m.b].position,d=b.map((v,i)=>v-a[i]),L=norm(d);
 if(!(L>1e-8))throw Error('Zero-length member '+m.id);
 const ex=d.map(v=>v/L),ref=Math.abs(ex[1])<.9?[0,1,0]:[0,0,1],ez0=cross(ex,ref),ez=ez0.map(v=>v/norm(ez0)),ey=cross(ez,ex),R=[ex,ey,ez];
 const s=m.section,mat=model.materials[m.material],E=mat.E,G=E/(2*(1+mat.nu));
 if(!(E>0&&s.A>0&&s.Iy>0&&s.Iz>0&&s.J>0))throw Error('Nonpositive material or section');
 const k=new Float64Array(144),put=(ids,vals,f)=>ids.forEach((r,i)=>ids.forEach((c,j)=>k[r*12+c]+=vals[i][j]*f));
 put([0,6],[[1,-1],[-1,1]],E*s.A/L);put([3,9],[[1,-1],[-1,1]],G*s.J/L);
 put([1,5,7,11],[[12,6*L,-12,6*L],[6*L,4*L*L,-6*L,2*L*L],[-12,-6*L,12,-6*L],[6*L,2*L*L,-6*L,4*L*L]],E*s.Iz/L**3);
 put([2,4,8,10],[[12,-6*L,-12,-6*L],[-6*L,4*L*L,6*L,2*L*L],[-12,6*L,12,6*L],[-6*L,2*L*L,6*L,4*L*L]],E*s.Iy/L**3);
 const kg=new Float64Array(144);
 for(let bi=0;bi<4;bi++)for(let bj=0;bj<4;bj++)for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let p=0;p<3;p++)for(let q=0;q<3;q++)kg[(bi*3+i)*12+bj*3+j]+=R[p][i]*k[(bi*3+p)*12+bj*3+q]*R[q][j];
 return {k,kg,R,L,dofs:[...Array.from({length:6},(_,i)=>6*m.a+i),...Array.from({length:6},(_,i)=>6*m.b+i)]};
}
