import * as THREE from 'three';
const colors={rib:0x75dcdf,root:0x9edbce,deck:0xd7e6f4,floor:0xa4bacb,web:0x87a8b5,fine:0x618897,radial:0xb9cdd4,orb:0xa4ccd0,crown:0x91b6c1,lateral:0x587f91};
const systems={primary_arch:0x75dcdf,arch_internal:0xc5f0df,deck_system:0xa4bacb,cable_web:0xc4a783,end_support:0x94b8ce};
export function geometry(model,result,view,overlays){
 const g=new THREE.Group(),up=new THREE.Vector3(0,1,0),scale=view.deformed&&result?view.scale:0;
 const pos=(id,s=scale)=>new THREE.Vector3(...model.nodes[id].position).add(new THREE.Vector3(...(result?.nodes[id].displacement||[0,0,0])).multiplyScalar(s));
 const maxForce=Math.max(1,...(result?.members.map(r=>Math.abs(r.axialForce))||[1]));
 const color=m=>{
  if(!result||view.mode==='hierarchy')return new THREE.Color(systems[m.system]||colors[m.type]);
  const r=result.members[m.id];
  if(view.mode==='axial')return new THREE.Color(0xc6d6de).lerp(new THREE.Color(r.axialForce>0?0xf5a568:0x559dff),Math.abs(r.axialForce)/maxForce);
  const v=Math.min(1,r.yieldIndicator);return v>.6?new THREE.Color(0xf5d56d).lerp(new THREE.Color(0xf56769),(v-.6)/.4):new THREE.Color(0x5ad4b9).lerp(new THREE.Color(0xf5d56d),v/.6);
 };
 const cylinder=(a,b,r,c,opacity=1)=>{const v=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),8),new THREE.MeshStandardMaterial({color:c,roughness:.6,metalness:.2,transparent:opacity<1,opacity}));mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(up,v.normalize());return mesh;};
 const lines=(points,c,opacity=1,name='')=>{const mesh=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:c,transparent:opacity<1,opacity}));mesh.name=name;g.add(mesh);};
 const ghost=[];
 model.members.forEach(m=>{
  const active=view.region==='all'||m.system===view.region||m.group===view.region||m.hierarchy===view.region||m.type===view.region||m.region===view.region;
  const mesh=cylinder(pos(m.a),pos(m.b),m.section.outerDiameter/2,color(m),active?1:.10);mesh.userData={member:m.id,system:m.system,behavior:m.behavior,section:m.section};mesh.name='member_'+m.id+'_'+m.type;g.add(mesh);
  if(overlays&&view.ghost&&scale)ghost.push(pos(m.a,0),pos(m.b,0));
 });
 if(ghost.length)lines(ghost,0x90a4b5,.24,'undeformed_reference');
 // Interpolate edge-node translations onto the deck's full 156 m surface.
 // The deck is a load-distributing visual surface, not a shell element.
 const deck=model.topology.deck,geo=model.geometry;
 const surface=(i,z,y=0)=>{
  const a=pos(deck[0][i]),b=pos(deck[1][i]);
  return a.lerp(b,(z+7.4)/14.8).add(new THREE.Vector3(0,y-geo.deckStructuralY,0));
 };
 const between=(i,t,z,y)=>surface(i,z,y).lerp(surface(i+1,z,y),t);
 if(view.deck){
  const verts=[];
  for(let i=0;i<deck[0].length-1;i++){
   const a=surface(i,-7),b=surface(i,7),c=surface(i+1,-7),d=surface(i+1,7);
   [a,b,c,b,d,c].forEach(v=>verts.push(v.x,v.y,v.z));
  }
  const shape=new THREE.BufferGeometry();shape.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));shape.computeVertexNormals();
  const mesh=new THREE.Mesh(shape,new THREE.MeshStandardMaterial({color:0x526b7b,roughness:.95,side:THREE.DoubleSide}));mesh.name='visual_continuous_deck_no_shell_stiffness';g.add(mesh);
  const infill=[],edges=[];
  for(const z of [-geo.guardrailOffset,geo.guardrailOffset]){
   for(let i=0;i<deck[0].length-1;i++){
    for(const h of [.12,geo.guardrailHeight]){const rail=cylinder(surface(i,z,h),surface(i+1,z,h),.055,0xb0c7cc);rail.name='visual_guardrail';g.add(rail);}
    for(let j=0;j<12;j++){
     const t=j/12,t1=(j+1)/12;
     for(const h of [.12,.72]){infill.push(between(i,t,z,h),between(i,t1,z,h+.60),between(i,t1,z,h),between(i,t,z,h+.60));}
    }
    edges.push(surface(i,z*.91,.025),surface(i+1,z*.91,.025));
   }
   for(let i=0;i<deck[0].length;i++){const post=cylinder(surface(i,z,0),surface(i,z,geo.guardrailHeight),.07,0xb0c7cc);post.name='visual_guardrail_post';g.add(post);}
  }
  lines(infill,0x91b1b9,.72,'visual_woven_guardrail_infill');lines(edges,0xd5cda9,.8,'visual_travel_edge_markings');
 }
 if(overlays){
  model.nodes.forEach(n=>{if(!view.nodes&&n.id!==view.selected)return;const selected=n.id===view.selected,mesh=new THREE.Mesh(new THREE.SphereGeometry(selected?.65:.24,10,8),new THREE.MeshBasicMaterial({color:selected?0xffd677:0xc1e4e7}));mesh.position.copy(pos(n.id));mesh.userData.node=n.id;g.add(mesh);});
  model.supports.forEach(s=>{const box=new THREE.Mesh(new THREE.BoxGeometry(1.9,.8,1.9),new THREE.MeshStandardMaterial({color:0x536576}));box.position.copy(pos(s.node,0)).add(new THREE.Vector3(0,-.7,0));box.name='assumed_foundation';g.add(box);});
  // Landing plates mark assumed level ground beyond the two approach bearings.
  for(const end of [-1,1]){const landing=new THREE.Mesh(new THREE.BoxGeometry(12,.4,14),new THREE.MeshStandardMaterial({color:0x354c5b}));landing.position.set(end*84,-.2,0);landing.name='assumed_level_landing';g.add(landing);}
  if(view.clearance){
   const box=new THREE.BoxGeometry(geo.totalLength,geo.reservedHeadroom,geo.usableWidth);
   const outline=new THREE.LineSegments(new THREE.EdgesGeometry(box),new THREE.LineBasicMaterial({color:0xace9a7}));outline.position.y=geo.reservedHeadroom/2;g.add(outline);box.dispose();
  }
  if(view.loads)model.loads.forEach(l=>{const f=new THREE.Vector3(...l.force);if(!f.length())return;const dir=f.normalize(),head=pos(l.node);g.add(new THREE.ArrowHelper(dir,head.clone().sub(dir.clone().multiplyScalar(5)),5,0xffc875,1.2,.5));});
 }
 return g;
}
