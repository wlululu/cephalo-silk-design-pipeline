/** Software projection fallback when WebGL is unavailable. Same Three camera/scene. */
import * as THREE from 'three';
export class CanvasRenderer {
 constructor(){this.domElement=document.createElement('canvas');this.context=this.domElement.getContext('2d');this.ratio=1;this.background='#0b1725';}
 setPixelRatio(r){this.ratio=r;}
 setClearColor(c){this.background='#'+new THREE.Color(c).getHexString();}
 setSize(w,h){this.width=w;this.height=h;this.domElement.width=w*this.ratio;this.domElement.height=h*this.ratio;this.domElement.style.width=w+'px';this.domElement.style.height=h+'px';}
 dispose(){}
 render(scene,camera){
  const ctx=this.context,w=this.width,h=this.height;if(!w||!h)return;
  ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.fillStyle=this.background;ctx.fillRect(0,0,w,h);
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);const list=[];
  const point=(p,o)=>{const world=p.clone().applyMatrix4(o.matrixWorld);const depth=world.clone().applyMatrix4(camera.matrixWorldInverse).z;const v=world.project(camera);return {x:(v.x+1)*w/2,y:(1-v.y)*h/2,depth,z:v.z};};
  scene.traverse(o=>{
   if(!o.visible||!o.geometry||!o.material)return;
   const mat=Array.isArray(o.material)?o.material[0]:o.material,color=o.type==='GridHelper'?'#20384a':'#'+(mat.color?.getHexString()||'728da0'),alpha=mat.opacity??1;
   const emit=(pts,kind,width=1)=>{if(pts.some(p=>p.depth>=-.1))return;list.push({pts,kind,width,color,alpha,depth:pts.reduce((s,p)=>s+p.depth,0)/pts.length});};
   const geo=o.geometry,par=geo.parameters||{};
   if(geo.type==='CylinderGeometry'){
    const a=point(new THREE.Vector3(0,-par.height/2,0),o),b=point(new THREE.Vector3(0,par.height/2,0),o);const depth=-(a.depth+b.depth)/2;
    emit([a,b],'line',Math.max(.65,par.radiusTop*h/(Math.tan(camera.fov*Math.PI/360)*depth)));
   }else if(geo.type==='SphereGeometry'){
    const p=point(new THREE.Vector3(),o);emit([p],'circle',Math.max(2,par.radius*h/(2*Math.tan(camera.fov*Math.PI/360)*-p.depth)));
   }else if(o.isLine||o.isLineSegments){
    const a=geo.attributes.position,idx=geo.index;const count=idx?idx.count:a.count;const step=o.isLineSegments?2:1;
    for(let i=0;i<count-1;i+=step){const p=(j)=>point(new THREE.Vector3().fromBufferAttribute(a,idx?idx.getX(j):j),o);emit([p(i),p(i+1)],'line',.65);}
   }else if(o.isMesh){
    const a=geo.attributes.position,idx=geo.index,count=idx?idx.count:a.count;
    for(let i=0;i<count;i+=3){const p=(j)=>point(new THREE.Vector3().fromBufferAttribute(a,idx?idx.getX(j):j),o);emit([p(i),p(i+1),p(i+2)],'polygon');}
   }
  });
  list.sort((a,b)=>a.depth-b.depth);ctx.lineCap='round';
  for(const item of list){const p=item.pts;ctx.globalAlpha=item.alpha;ctx.strokeStyle=item.color;ctx.fillStyle=item.color;ctx.lineWidth=item.width;ctx.beginPath();if(item.kind==='circle'){ctx.arc(p[0].x,p[0].y,item.width,0,2*Math.PI);ctx.fill();}else{ctx.moveTo(p[0].x,p[0].y);p.slice(1).forEach(v=>ctx.lineTo(v.x,v.y));if(item.kind==='polygon'){ctx.closePath();ctx.fill();}else ctx.stroke();}}
  ctx.globalAlpha=1;ctx.font='11px Arial';ctx.fillStyle='#6f889c';ctx.fillText('Software 3D renderer · WebGL unavailable',22,h-4);
 }
}
