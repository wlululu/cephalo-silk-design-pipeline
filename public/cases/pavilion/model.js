// SI units; Y vertical. Explicit, editable structural topology.
export const N=12;
export function surface(u,v){
 const x=24*(u-.5),z=21*(v-.5);
 const su=Math.sin(Math.PI*u),sv=Math.sin(Math.PI*v);
 return [x*(1+.12*sv),.35+((1-v)*10.5+v*13)*su+((1-u)*10+u*17)*sv-12*su*sv,z*(1+.15*su)];
}
export function makeModel(){
 const nodes=[],members=[],faces=[],supports=[];
 const add=p=>{let id=nodes.length;nodes.push({id,position:p});return id};
 const id=(i,j)=>i*(N+1)+j;
 const member=(a,b,section,type='frame')=>members.push({id:members.length,nodes:[a,b],section,material:section==='net'?'cable':'steel',type});
 for(let i=0;i<=N;i++)for(let j=0;j<=N;j++)add(surface(i/N,j/N));
 for(let i=0;i<=N;i++)for(let j=0;j<=N;j++){
  if(i<N)member(id(i,j),id(i+1,j),(j===0||j===N)?'arch':'net',(j===0||j===N)?'frame':'prestressed_bar');
  if(j<N)member(id(i,j),id(i,j+1),(i===0||i===N)?'arch':'net',(i===0||i===N)?'frame':'prestressed_bar');
  if(i<N&&j<N){member(id(i,j),id(i+1,j+1),'net','prestressed_bar');member(id(i+1,j),id(i,j+1),'net','prestressed_bar');faces.push([id(i,j),id(i+1,j),id(i+1,j+1)],[id(i,j),id(i+1,j+1),id(i,j+1)]);}
 }
 const branches=[];
 for(const [i,j] of [[0,0],[N,0],[N,N],[0,N]]){
  const root=id(i,j),p=nodes[root].position,si=i===0?1:-1,sj=j===0?1:-1;
  const foot=add([p[0],0,p[2]]);member(foot,root,'trunk');supports.push({node:foot,restrained:['ux','uy','uz','rx','ry','rz']});
  const fork=add([p[0]+si*.7,2.5,p[2]+sj*.7]);member(root,fork,'trunk');
  for(const [di,dj] of [[3,0],[0,3],[2,2],[4,1],[1,4]]){
   const tip=id(i+si*di,j+sj*dj),q=nodes[tip].position;
   const mid=add([p[0]*.42+q[0]*.58,q[1]*.50+.7,p[2]*.42+q[2]*.58]);
   member(fork,mid,'branch');member(mid,tip,'branch');branches.push([root,fork,mid,tip]);
  }
 }
 return {name:'Cephalo Petal Pavilion',schema_version:'1.0',units:{length:'m',force:'N',stress:'Pa'},axes:'Y up',nodes,members,faces,supports,branches,grid:N,
 materials:{steel:{E:200e9,nu:.3,density:7850},cable:{E:80e9,nu:.3,density:7850}},
 sections:{arch:{shape:'CHS',diameter:.30,wall:.014},trunk:{shape:'CHS',diameter:.34,wall:.018},branch:{shape:'CHS',diameter:.18,wall:.009},net:{shape:'equivalent_bundle',area:1.8e-4,prestress:18000}},
 loads:[{name:'Gravity',type:'projected_surface_pressure',direction:[0,-1,0],pressure_Pa:300},{name:'Uplift',type:'projected_surface_pressure',direction:[0,1,0],pressure_Pa:300},{name:'Lateral',type:'projected_surface_pressure',direction:[1,0,0],pressure_Pa:300},{name:'Asymmetric',type:'projected_surface_pressure',direction:[0,-1,0],pressure_Pa:300,region:'x>0'}],
 assumptions:['Dimensions inferred from one perspective image; no surveyed scale.','Linear 3D Euler–Bernoulli frames, rigid joints and fixed bases.','Net is a coarse equivalent prestressed bar field, not individual render threads.','Prescribed initial tension supplies tangent stiffness; reference-state equilibrium and form-finding are not solved.','Incremental small-displacement analysis; initial prestress forces are excluded from incremental frame forces and reactions.','Pressure uses horizontal projected area for every scenario; lateral case is a comparative load, not a wind-code model.','Gravity means applied downward pressure; member self-weight is not automatically included.','Cable slack is flagged; redistribution, wrinkling, buckling, connections and strength checks are not solved.','One-image reconstruction is nonunique; hidden geometry and four support locations are inferred.']};
}
export function properties(model,m,thickness=1,stiffness=1){const s=model.sections[m.section],mat=model.materials[m.material];let A,I,J;if(s.shape==='CHS'){const d=s.diameter*thickness,t=s.wall*thickness,inner=d-2*t;A=Math.PI/4*(d*d-inner*inner);I=Math.PI/64*(d**4-inner**4);J=2*I;}else{A=s.area*thickness**2;I=0;J=0;}return {A,I,J,E:mat.E*stiffness,G:mat.E*stiffness/(2*(1+mat.nu)),T:s.prestress||0};}
