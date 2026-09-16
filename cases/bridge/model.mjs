/** V2 geometry, lattice-filled primary arches and a tension-only secondary web. */
export const defaults={loadCase:'uniform',pressure:5,pointLoad:500,E:200,primaryScale:1,secondaryScale:1,selectedNode:13,nodeLoad:0,cablePrestress:80};
export const assumptions=[
 'Single-image interpretation: 120 m main span, 28 m rib crown, 14 m deck, and two 18 m level approach decks. Hidden structure is mirrored across the span center and transverse centerline.',
 'The three V2 chord paths and original stations are preserved. Each twin arch is a built-up triangular frame: three hollow chords enclose 2.3 m of vertical centerline depth and 1.9 m of transverse centerline width. Chord outside diameter grades smoothly from 0.85 m at the ends to 1.05 m at the crown. These are assumed sections, not image measurements.',
 'Rigid triangular diaphragms and face diagonals at 2 m arch stations stabilize each arch within its existing depth. The original internal diamond weave remains. The arch is analyzed as connected individual chords and braces, with no additional fictitious solid-band stiffness.',
 'Four flared root fans extend from the rib ends to broad, discrete foundations 10 m below the deck. Each fan has multiple intersecting strand families with shared mesh nodes, and connects to deck edge girders.',
 'The six original V2 side-web panel locations and hubs are retained. Each panel has twelve local spokes rather than six, two existing-scale capture bands with slight radial grading, and fine inter-ring strands. Additional radial branches use tertiary sections; central panels have less fine cross-weave than the shoulders. No global orb, large crescent or new motif is introduced.',
 'A continuous 156 m deck surface joins the main span and two level approaches. The protected corridor is 12 m wide with 5 m reserved headroom; these are design assumptions, not regulatory compliance claims.',
 'Structural floor members sit below the deck surface. Woven guardrails 1.35 m high run along both deck edges; guardrail meshes are visual nonstructural elements and have no verified vehicle-impact capacity.',
 'Primary arches, arch-internal bracing, deck grillage and flared roots use elastic six-DOF frame elements. Side-web members, fine crown ties and under-deck cross ties use geometrically nonlinear, pin-ended, tension-only axial elements: no bending, torsion or compression capacity. Rotations at cable-only joints are omitted, not restrained by hidden supports.',
 'Cable equivalent solid diameters are 35 mm radial, 22 mm capture strands and 14 mm fine weave. Assumed initial shortening corresponds to 80 MPa reference prestress by default. The solver first equilibrates this prestress against the frame, then applies the chosen loading; final tension may differ. Cable self-weight, sag between mesh nodes, material nonlinearity and frame large-rotation effects are omitted.',
 'Only the root fan foundation nodes and remote approach bearing nodes are restrained. There are no hidden fixed supports at the central bridge deck ends. Foundation compliance and soil are omitted.',
 'Assumed steel: E=200 GPa, nu=0.30, fy=355 MPa for frames and 1000 MPa tensile screening strength for equivalent cables. Primary scale controls arch chords/root spines/deck; secondary scale controls braces and cables. No connection or cable anchorage design is provided.',
 'Deck pressure acts on the 120 m main span only, at tributary edge nodes; approach live load, self-weight, collision and dynamic effects are excluded. The walking surface distributes load but has no shell stiffness.'
];
export function section(d,t){return {shape:'circular_hollow',outerDiameter:d,wallThickness:t,A:Math.PI/4*(d*d-(d-2*t)**2),Iy:Math.PI/64*(d**4-(d-2*t)**4),Iz:Math.PI/64*(d**4-(d-2*t)**4),J:Math.PI/32*(d**4-(d-2*t)**4)};}
export function createModel(settings={}){
 const p={...defaults,...settings},nodes=[],members=[],supports=[],seen=new Set();
 const addNode=(position,region,station,side,extra={})=>{const id=nodes.length;nodes.push({id,position,region,station,side,...extra});return id;};
 const dims={rib:[.72,.032],root:[.60,.028],deck:[.76,.03],floor:[.64,.028],web:[.15,.010],fine:[.075,.006],radial:[.16,.011],orb:[.105,.008],lateral:[.18,.012],archbrace:[.14,.010]};
 const add=(a,b,group,type,region=type)=>{if(a===b)return;const k=[Math.min(a,b),Math.max(a,b)].join(':');if(seen.has(k))return;seen.add(k);const [d,t]=dims[type],scale=group==='primary'?p.primaryScale:p.secondaryScale;members.push({id:members.length,a,b,group,type,region,hierarchy:type==='fine'?'tertiary':group,behavior:'bilateral_frame',material:'steel',section:section(d*scale,t*scale)});};
 const deck=[[],[]],rib=[[],[]],roots=[],webs=[];const xs=Array.from({length:27},(_,i)=>-78+6*i);
 for(let s=0;s<2;s++){const sign=s?1:-1;xs.forEach((x,i)=>deck[s].push(addNode([x,-.65,sign*7.4],Math.abs(x)<=60?'deck':'approach',i,s)));
  for(let i=0;i<=20;i++){const t=i/20,q=2*t-1,y=28-36*q*q,z=8.4+4*Math.abs(q)**4;
   rib[s].push([[0,-1.15,0],[0,1.15,.85],[0,-.45,1.9]].map(([dx,dy,dz],j)=>addNode([-60+6*i+dx,y+dy,sign*(z+dz)],'arch',i,s,{lane:j})));
  }
  for(let i=0;i<26;i++)add(deck[s][i],deck[s][i+1],'primary','deck',Math.abs((xs[i]+xs[i+1])/2)>60?'approach':'deck');
  for(let i=0;i<=20;i++){
   const r=rib[s][i];for(let j=0;j<3;j++)add(r[j],r[(j+1)%3],'secondary','web','rib weave');
   if(i<20){const next=rib[s][i+1];for(let j=0;j<3;j++){add(r[j],next[j],'primary','rib');add(r[j],next[(j+1)%3],'secondary','web','rib weave');}
    // One explicit diamond intersection on the broad visible face per bay.
    const mid=addNode([(-60+6*i)+3,(nodes[r[0]].position[1]+nodes[next[1]].position[1])/2,sign*((Math.abs(nodes[r[0]].position[2])+Math.abs(nodes[next[1]].position[2]))/2)],'rib weave',i+.5,s);
    for(const a of [r[0],r[1],next[0],next[1]])add(a,mid,'secondary','fine','rib weave');
    add(r[2],next[0],'secondary','fine','rib weave');
   }
  }
  // Three side orb-web panels per side: six radial spokes and two shared-node rings.
  // Boundary follows the arch above and the deck edge below; each panel is genuinely connected.
  for(let panel=0;panel<5;panel++){
   const i=4*panel,j=i+4;
   // Skip low end panels; flared root fans carry those regions.
   if(panel===0||panel===4)continue;
   const originalBoundary=[rib[s][i][0],rib[s][i+2][0],rib[s][j][0],deck[s][j+3],deck[s][i+5],deck[s][i+3]];
   const center=originalBoundary.reduce((a,id)=>a.map((v,k)=>v+nodes[id].position[k]/originalBoundary.length),[0,0,0]);
   // Refine only the existing V2 panel. Four extra anchors are existing arch/deck nodes.
   const edgeMid=(a,b)=>addNode(nodes[a].position.map((v,c)=>(v+nodes[b].position[c])/2),'web boundary',panel,s);
   const rightMid=edgeMid(originalBoundary[2],originalBoundary[3]),leftMid=edgeMid(originalBoundary[5],originalBoundary[0]);
   const boundary=[originalBoundary[0],rib[s][i+1][0],originalBoundary[1],rib[s][i+3][0],originalBoundary[2],rightMid,originalBoundary[3],deck[s][i+6],originalBoundary[4],deck[s][i+4],originalBoundary[5],leftMid];
   for(const [a,mid,b] of [[originalBoundary[2],rightMid,originalBoundary[3]],[originalBoundary[5],leftMid,originalBoundary[0]]]){add(a,mid,'secondary','radial','orb web');add(mid,b,'secondary','radial','orb web');}
   const hub=addNode(center,'web hub',panel,s),rings=[];
   for(const fraction of [.36,.70])rings.push(boundary.map((id,k)=>{
    const target=nodes[id].position;
    // Small deterministic radial grading, reflected across both symmetry planes.
    const f=fraction+.025*Math.sin(Math.PI*fraction)*(Math.abs(target[0])/36-.5);
    return addNode(center.map((v,c)=>v+f*(target[c]-v)),'orb web',panel,s,{ring:fraction,spoke:k});
   }));
   for(let k=0;k<boundary.length;k++){
    const type=k%2===0?'radial':'fine';
    add(hub,rings[0][k],'secondary',type,'orb web');add(rings[0][k],rings[1][k],'secondary',type,'orb web');add(rings[1][k],boundary[k],'secondary',type,'orb web');
    for(const ring of rings)add(ring[k],ring[(k+1)%boundary.length],'secondary','orb','orb web');
    // Keep the finer weave local and less dense in the central panel.
    if(panel!==2||k%2===0)add(rings[0][k],rings[1][(k+1)%boundary.length],'secondary','fine','orb web');
   }
   webs.push({hub,rings,boundary});
  }
  // End root fans. Five curved elevation bands, five longitudinal spokes per end.
  // Wide foot lies OUTSIDE the deck, leaving an open passage through the support region.
  for(const end of [-1,1]){
   const strips=[];
   for(let row=0;row<5;row++){
    const a=row/4;
    strips.push(Array.from({length:5},(_,k)=>{
     const u=k/4;
     const x=end*(48+24*u),footZ=10.8+6.2*Math.sin(Math.PI*u);
     const targetI=end<0?Math.round(4-4*u):Math.round(16+4*u);
     const target=nodes[rib[s][targetI][2]].position;
     return addNode([x*(1-a)+target[0]*a,-10*(1-a)+target[1]*a,sign*footZ*(1-a)+target[2]*a+sign*2*Math.sin(Math.PI*a)*Math.sin(Math.PI*u)],'root fan',k,s,{end,row});
    }));
   }
   for(let row=0;row<5;row++)for(let k=0;k<5;k++){
    const a=strips[row][k];if(k<4)add(a,strips[row][k+1],'secondary','web','root fan');
    if(row<4){add(a,strips[row+1][k],'primary','root','root fan');if(k<4){add(a,strips[row+1][k+1],'secondary','web','root fan');add(strips[row][k+1],strips[row+1][k],'secondary','fine','root fan');}}
    if(row===0)supports.push({node:a,fixed:[true,true,true,true,true,true],kind:'root foundation'});
    if(row===4){const ri=end<0?4-k:16+k;const target=rib[s][ri][2];
     // Top-band coordinates equal rib nodes: merge references below instead of adding zero members.
     for(let lane=0;lane<2;lane++)add(a,rib[s][ri][lane],'secondary','web','root fan');
    }
   }
   // Fine shared-node diamond cells grade the fan into a dense woven surface.
   for(let row=0;row<4;row++)for(let k=0;k<4;k++){
    const corners=[strips[row][k],strips[row][k+1],strips[row+1][k],strips[row+1][k+1]];
    const center=corners.reduce((a,id)=>a.map((v,c)=>v+nodes[id].position[c]/4),[0,0,0]);
    const hub=addNode(center,'root fan',k+.5,s,{end,row:row+.5});
    corners.forEach(id=>add(id,hub,'secondary','fine','root fan'));
   }
   // Sweeping counter-diagonals cross multiple cells, adding a second strand scale.
   for(let row=0;row<4;row++)for(let k=0;k<3;k++){
    add(strips[row][k],strips[row+1][k+2],'secondary','fine','root fan');
    add(strips[row][k+2],strips[row+1][k],'secondary','fine','root fan');
   }
   // Connect the deck edge to both sides of each woven root, never across the road.
   for(let k=0;k<4;k++){
    const di=end<0?3+k:23-k;
    add(deck[s][di],strips[2][k],'primary','root','root fan');add(deck[s][di],strips[2][k+1],'secondary','web','root fan');
    add(deck[s][di],rib[s][end<0?k:20-k][0],'secondary','radial','root fan');
   }
   roots.push({side:s,end,grid:strips});
  }
 }
 // Merge exactly coincident top-band/rib nodes so the root really transitions into the rib.
 const canonical=new Map(),remap=[],unique=[];
 for(const n of nodes){const key=n.position.map(v=>v.toFixed(7)).join(',');if(canonical.has(key))remap[n.id]=canonical.get(key);else{remap[n.id]=unique.length;canonical.set(key,unique.length);unique.push({...n,id:unique.length});}}
 const rewrite=a=>a.map(v=>Array.isArray(v)?rewrite(v):remap[v]);
 for(let s=0;s<2;s++){deck[s]=rewrite(deck[s]);rib[s]=rewrite(rib[s]);}
 roots.forEach(r=>r.grid=rewrite(r.grid));webs.forEach(w=>{w.hub=remap[w.hub];w.rings=rewrite(w.rings);w.boundary=rewrite(w.boundary);});
 supports.forEach(s=>s.node=remap[s.node]);const old=members.splice(0);nodes.splice(0,nodes.length,...unique);seen.clear();
 old.forEach(m=>add(remap[m.a],remap[m.b],m.group,m.type,m.region));
 for(let i=0;i<xs.length;i++){
  add(deck[0][i],deck[1][i],'primary','floor',Math.abs(xs[i])>60?'approach':'deck');
  if(i<xs.length-1){add(deck[0][i],deck[1][i+1],'secondary','lateral','under deck');add(deck[1][i],deck[0][i+1],'secondary','lateral','under deck');}
 }
 // Elevated transverse crown ties only where all strands clear 5 m headroom.
 for(let i=4;i<=16;i+=4){add(rib[0][i][1],rib[1][i][1],'secondary','lateral','crown');if(i<16){add(rib[0][i][1],rib[1][i+4][1],'secondary','fine','crown');add(rib[1][i][1],rib[0][i+4][1],'secondary','fine','crown');}}
 for(let s=0;s<2;s++)for(const i of [0,26])supports.push({node:deck[s][i],fixed:[true,true,true,false,false,false],kind:'remote approach bearing'});
 // Complete reflected strand families so hidden connectivity is symmetric in both planes.
 const key=p=>p.map(v=>Math.round(v*1e7)).join(',');
 const byPosition=new Map(nodes.map(n=>[key(n.position),n.id]));
 for(const axis of [0,2])for(const m of [...members]){
  const reflect=id=>byPosition.get(key(nodes[id].position.map((v,k)=>k===axis?-v:v)));
  const a=reflect(m.a),b=reflect(m.b);
  if(a===undefined||b===undefined)throw new Error('Missing symmetric geometry');
  add(a,b,m.group,m.type,m.region);
 }
 // Split only V2 primary arch members along their ORIGINAL analytic centerlines.
 // Existing arch station coordinates, sections and all root/deck geometry are retained.
 const beforeSmoothing=members.splice(0);seen.clear();
 for(const m of beforeSmoothing){
  if(m.type!=='rib'){add(m.a,m.b,m.group,m.type,m.region);continue;}
  const a=nodes[m.a],b=nodes[m.b],lane=a.lane,sign=a.side?1:-1;
  const offsets=[[-1.15,0],[1.15,.85],[-.45,1.9]][lane],chain=[m.a];
  for(const f of [1/3,2/3]){
   const x=a.position[0]+f*(b.position[0]-a.position[0]),q=x/60;
   chain.push(addNode([x,28-36*q*q+offsets[0],sign*(8.4+4*Math.abs(q)**4+offsets[1])],'arch refinement',a.station+f*(b.station-a.station),a.side,{lane}));
  }
  chain.push(m.b);for(let j=0;j<3;j++)add(chain[j],chain[j+1],m.group,m.type,m.region);
 }
 // Complete the built-up arch inside the original three-chord envelope.
 const archStations=[0,1].map(side=>Array.from({length:61},(_,i)=>[0,1,2].map(lane=>{
  const x=-60+2*i;return nodes.find(n=>n.side===side&&n.lane===lane&&Math.abs(n.position[0]-x)<1e-7).id;
 })));
 for(const stations of archStations)for(let i=0;i<stations.length;i++){
  const a=stations[i];for(let lane=0;lane<3;lane++){
   const next=(lane+1)%3;add(a[lane],a[next],'secondary','archbrace','rib weave');
   if(i<60){const b=stations[i+1];
    // Both reflected families maintain symmetry and confine bracing to each arch face.
    add(a[lane],b[next],'secondary','archbrace','rib weave');
    add(a[next],b[lane],'secondary','archbrace','rib weave');
   }
  }
 }
 for(const m of members){
  m.system=m.type==='rib'?'primary_arch':m.region==='rib weave'?'arch_internal':m.region==='root fan'?'end_support':m.region==='orb web'||m.region==='crown'&&m.type==='fine'?'cable_web':m.region==='crown'?'arch_internal':'deck_system';
  if(m.type==='rib'){
   const x=(nodes[m.a].position[0]+nodes[m.b].position[0])/2,q=x/60,d=(.85+.20*(1-q*q))*p.primaryScale;
   m.section=section(d,.040*p.primaryScale);
  }
  if(m.system==='cable_web'||m.region==='under deck'){
   const d=(m.type==='radial'?.035:m.type==='orb'||m.type==='lateral'?.022:.014)*p.secondaryScale;
   m.section={shape:'equivalent_solid_cable',outerDiameter:d,A:Math.PI*d*d/4,Iy:0,Iz:0,J:0};
   m.material='cable';m.behavior='tension_only_cable';
   m.referencePrestress=p.cablePrestress*1e6;
   m.restLength=Math.hypot(...nodes[m.b].position.map((v,i)=>v-nodes[m.a].position[i]))/(1+m.referencePrestress/(p.E*1e9));
  }
 }
 const loads=[];
 if(p.loadCase==='uniform'||p.loadCase==='half')for(let s=0;s<2;s++)for(let i=3;i<=23;i++){
  let trib=i===3||i===23?3:6;
  if(p.loadCase==='half')trib=i<13?trib:i===13?3:0;
  if(trib)loads.push({node:deck[s][i],force:[0,-p.pressure*1000*7*trib,0],moment:[0,0,0],source:'main-span deck pressure'});
 }
 if(p.loadCase==='point')for(let s=0;s<2;s++)loads.push({node:deck[s][13],force:[0,-p.pointLoad*1000/2,0],moment:[0,0,0],source:'midspan load'});
 if(p.nodeLoad)loads.push({node:p.selectedNode,force:[0,-p.nodeLoad*1000,0],moment:[0,0,0],source:'selected node load'});
 return {schemaVersion:'3.0',name:'Cephalo bridge — hybrid lattice arches and tensile web',units:{length:'m',force:'N',stress:'Pa',rotation:'rad'},axes:{x:'span',y:'vertical',z:'transverse'},geometry:{span:120,width:14,rise:28,bays:20,archSegments:60,approachLength:18,totalLength:156,deckSurfaceY:0,deckStructuralY:-.65,usableWidth:12,reservedHeadroom:5,guardrailHeight:1.35,guardrailOffset:6.7,levelApproach:true},topology:{deck,rib,archStations,roots,webs},settings:p,assumptions,materials:{steel:{E:p.E*1e9,nu:.3,fy:355e6,density:7850},cable:{E:p.E*1e9,nu:.3,fy:1000e6,density:7850}},nodes,members,supports,loads};
}
