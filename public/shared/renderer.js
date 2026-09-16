// Optional software projection of the existing Three scene. No model/solver access.
// Each case passes its own Three version; WebGL remains the preferred rendering path.
export function createRenderer(THREE,options={}){
 const canvas=document.createElement('canvas'),context=canvas.getContext('webgl2');
 if(context)return new THREE.WebGLRenderer({...options,canvas,context});
 return new SceneCanvasRenderer(THREE);
}
class SceneCanvasRenderer{
 constructor(THREE){this.THREE=THREE;this.domElement=document.createElement('canvas');this.context=this.domElement.getContext('2d');this.ratio=1;this.background='#0b1725';this.last=0;this.isSoftwareRenderer=true;}
 setPixelRatio(v){this.ratio=v}
 setClearColor(c,alpha=1){this.background=alpha===0?'#0b1725':'#'+new this.THREE.Color(c).getHexString()}
 setSize(w,h){this.width=w;this.height=h;this.domElement.width=w*this.ratio;this.domElement.height=h*this.ratio;this.domElement.style.width=w+'px';this.domElement.style.height=h+'px';this.last=0}
 setAnimationLoop(fn){const tick=t=>{this.frame=requestAnimationFrame(tick);fn(t)};this.frame=requestAnimationFrame(tick)}
 dispose(){cancelAnimationFrame(this.frame)}
 render(scene,camera){
  const now=performance.now();if(now-this.last<160)return;this.last=now;
  const T=this.THREE,ctx=this.context,w=this.width,h=this.height;if(!w||!h)return;
  ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.fillStyle=this.background;ctx.fillRect(0,0,w,h);
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);const queue=[],pv=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),v=new T.Vector3();
  const paint=(o,matrix,instanceColor)=>{
   const g=o.geometry,a=g.attributes.position;if(!a)return;
   const mat=Array.isArray(o.material)?o.material[0]:o.material;if(!mat||mat.visible===false)return;
   const base=instanceColor||mat.color||new T.Color(0xa7bfce),alpha=mat.opacity??1;if(alpha<.02)return;
   const transform=new T.Matrix4().multiplyMatrices(pv,matrix),points=new Array(a.count),vertexColors=g.attributes.color;
   const point=i=>{if(points[i])return points[i];v.fromBufferAttribute(a,i).applyMatrix4(transform);return points[i]={x:(v.x+1)*w/2,y:(1-v.y)*h/2,z:v.z}};
   const emit=(ps,type,color,width=1)=>{if(ps.some(p=>p.z<-1||p.z>1))return;if(ps.every(p=>p.x<-50)||ps.every(p=>p.x>w+50)||ps.every(p=>p.y<-50)||ps.every(p=>p.y>h+50))return;queue.push({ps,type,color,width,alpha,z:ps.reduce((s,p)=>s+p.z,0)/ps.length})};
   const colorAt=i=>mat.vertexColors&&vertexColors?'#'+new T.Color().fromBufferAttribute(vertexColors,i).getHexString():'#'+base.getHexString();
   if(o.isInstancedMesh&&g.type==='CylinderGeometry'){
    const y=(g.parameters.height||1)/2,rad=g.parameters.radiusTop||1,p1=new T.Vector3(0,-y,0).applyMatrix4(transform),p2=new T.Vector3(0,y,0).applyMatrix4(transform),mid=new T.Vector3().applyMatrix4(transform),edge=new T.Vector3(rad,0,0).applyMatrix4(transform);
    emit([{x:(p1.x+1)*w/2,y:(1-p1.y)*h/2,z:p1.z},{x:(p2.x+1)*w/2,y:(1-p2.y)*h/2,z:p2.z}],'line','#'+base.getHexString(),Math.max(.5,Math.hypot((edge.x-mid.x)*w,(edge.y-mid.y)*h)));return;
   }
   const idx=g.index,count=idx?idx.count:a.count,at=i=>idx?idx.getX(i):i;
   if(o.isLine||o.isLineSegments){const step=o.isLineSegments?2:1;for(let i=0;i<count-1;i+=step)emit([point(at(i)),point(at(i+1))],'line',colorAt(at(i)),.7)}
   else if(o.isMesh){for(let i=0;i<count-2;i+=3){const ps=[point(at(i)),point(at(i+1)),point(at(i+2))];const cross=(ps[1].x-ps[0].x)*(ps[2].y-ps[0].y)-(ps[1].y-ps[0].y)*(ps[2].x-ps[0].x);if(mat.side!==T.DoubleSide&&cross>=0)continue;const c=base.clone().multiplyScalar(.76+Math.min(.24,Math.abs(cross)/250));emit(ps,'face','#'+c.getHexString())}}
  };
  scene.traverseVisible(o=>{if(!o.geometry||!o.material)return;if(o.isInstancedMesh){const m=new T.Matrix4(),world=new T.Matrix4(),color=new T.Color();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);if(Math.abs(m.determinant())<1e-16)continue;world.multiplyMatrices(o.matrixWorld,m);if(o.instanceColor)o.getColorAt(i,color);else color.copy(o.material.color);paint(o,world,color)}}else paint(o,o.matrixWorld)});
  queue.sort((a,b)=>b.z-a.z);ctx.lineCap='round';
  for(const q of queue){ctx.globalAlpha=q.alpha;ctx.strokeStyle=ctx.fillStyle=q.color;ctx.lineWidth=q.width;ctx.beginPath();ctx.moveTo(q.ps[0].x,q.ps[0].y);for(let i=1;i<q.ps.length;i++)ctx.lineTo(q.ps[i].x,q.ps[i].y);if(q.type==='face'){ctx.closePath();ctx.fill()}else ctx.stroke()}
  ctx.globalAlpha=1;ctx.fillStyle='#7893a7';ctx.font='12px Arial';ctx.fillText('Software 3D view · WebGL unavailable',22,h-4);
 }
}
