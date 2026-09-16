'use client';
import {useEffect,useRef} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {CanvasRenderer} from '@/cases/bridge/CanvasRenderer.mjs';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
export function download(data:any,name:string,type='application/json') {const blob=data instanceof Blob?data:new Blob([data],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000);}
import {geometry} from '@/cases/bridge/geometry.mjs';
export default function BridgeView({model,result,view,onSelect,api,onError}:any){
 const host=useRef<HTMLDivElement>(null),ctx=useRef<any>(null),pick=useRef(onSelect);pick.current=onSelect;
 useEffect(()=>{
  let renderer:any;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch(e){renderer=new CanvasRenderer();}
  const el=host.current!;renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x0b1725);el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Interactive 3D bridge. Drag to rotate, scroll to zoom, click a node to inspect.');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,1500);camera.position.set(-132,30,68);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,9,0);controls.enableDamping=true;controls.minDistance=12;controls.maxDistance=450;controls.update();
  scene.add(new THREE.AmbientLight(0xc3deef,2.2));const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(20,80,30);scene.add(light);
  const grid=new THREE.GridHelper(200,40,0x243a4b,0x172a3b);grid.position.y=-11.2;scene.add(grid);
  const group=new THREE.Group();scene.add(group);const ray=new THREE.Raycaster();let down=[0,0],frame=0;
  const c={renderer,scene,camera,controls,group,pickables:[] as any[],model:null,result:null,view:null,dirty:true};ctx.current=c;
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(20))*Math.max(1,1.55/camera.aspect)));camera.updateProjectionMatrix();c.dirty=true;};const ro=new ResizeObserver(resize);ro.observe(el);resize();
  const pd=(e:PointerEvent)=>{down=[e.clientX,e.clientY];};const pu=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=el.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hit=ray.intersectObjects(c.pickables,false)[0];if(hit){if(hit.object.userData.node!==undefined)pick.current(hit.object.userData.node);else if(hit.object.userData.member!==undefined){const m=(c.model as any).members[hit.object.userData.member];const p=(c.model as any).nodes[m.a].position;pick.current(new THREE.Vector3(...p).distanceTo(hit.point)<new THREE.Vector3(...(c.model as any).nodes[m.b].position).distanceTo(hit.point)?m.a:m.b);}}};
  renderer.domElement.addEventListener('pointerdown',pd);renderer.domElement.addEventListener('pointerup',pu);
  const tick=()=>{frame=requestAnimationFrame(tick);const changed=controls.update();if(changed||c.dirty){renderer.render(scene,camera);c.dirty=false;}};tick();
  api.current={camera:(name:string)=>{const v:any={reference:[-132,30,68],iso:[105,64,128],side:[0,20,220],top:[0,235,.01],end:[200,20,0],access:[-94,2.4,0]};camera.position.set(...v[name]);controls.target.set(0,name==='access'?2.4:9,0);controls.update();c.dirty=true;},export:async(format:string)=>{
   try{const g=geometry(c.model,c.result,{...c.view,mode:'hierarchy',deformed:false,ghost:false,region:'all'},false);g.updateMatrixWorld(true);
    if(format==='stl')download(new STLExporter().parse(g,{binary:true}),'cephalo-bridge.stl','application/octet-stream');
    else {const bin=await new GLTFExporter().parseAsync(g,{binary:true});download(bin,'cephalo-bridge.glb','model/gltf-binary');}dispose(g);
   }catch(e:any){onError('Geometry export failed: '+e.message);}
  }};
  return()=>{cancelAnimationFrame(frame);ro.disconnect();controls.dispose();dispose(scene);renderer.dispose();renderer.domElement.remove();ctx.current=null;};
 },[]);
 useEffect(()=>{const c=ctx.current;if(!c)return;dispose(c.group);c.scene.remove(c.group);c.group=geometry(model,result,view,true);c.scene.add(c.group);c.pickables=c.group.children.filter((m:any)=>m.userData.node!==undefined||m.userData.member!==undefined);c.model=model;c.result=result;c.view=view;c.dirty=true;},[model,result,view]);
 return <div className="three-host" ref={host}/>;
}
function dispose(g:any){g.traverse((o:any)=>{o.geometry?.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach((m:any)=>m.dispose());}});}
