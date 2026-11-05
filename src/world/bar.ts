import * as T from 'three';
import type {ActorFactory,VisitZone} from './underworld';
import {BAR_SLOGAN,barSeconds,DANCES} from '../../shared/bar';

export function buildBarZone(actor:ActorFactory,now:()=>number=barSeconds):VisitZone{
 const root=new T.Group();root.name='bar';
 const meshes:T.Mesh[]=[],materials=new Set<T.Material>(),sprites:T.Sprite[]=[],updates:((t:number)=>void)[]=[];
 const material=(color:number,extra:Partial<T.MeshStandardMaterialParameters>={})=>{const m=new T.MeshStandardMaterial({color,roughness:.65,...extra});materials.add(m);return m;};
 const stone=material(0x25313b),wood=material(0x50292f),gold=material(0xbd9153,{metalness:.65,roughness:.32}),dark=material(0x101c29),jade=material(0x49cfc2,{emissive:0x205f65,emissiveIntensity:.4}),pink=material(0xc86d9f,{emissive:0x803353,emissiveIntensity:.4});
 const mesh=(g:T.BufferGeometry,m:T.Material,p:[number,number,number],parent:T.Object3D=root)=>{const o=new T.Mesh(g,m);o.position.set(...p);o.castShadow=true;o.receiveShadow=true;parent.add(o);meshes.push(o);return o;};
 const box=(s:[number,number,number],p:[number,number,number],m=wood,parent:T.Object3D=root)=>mesh(new T.BoxGeometry(...s),m,p,parent);
 const cylinder=(r:number,h:number,p:[number,number,number],m=gold,parent:T.Object3D=root)=>mesh(new T.CylinderGeometry(r,r,h,24),m,p,parent);
 const sign=(text:string,p:[number,number,number],width:number,small=false)=>{
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=small?128:192;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#101a28';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#bd9153';ctx.lineWidth=4;ctx.strokeRect(5,5,canvas.width-10,canvas.height-10);
  ctx.font=`600 ${small?40:58}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=small?'#b8e8da':'#f5d4a5';ctx.fillText(text,512,canvas.height/2,980);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthWrite:false}));sprite.position.set(...p);sprite.scale.set(width,width*canvas.height/canvas.width,1);root.add(sprite);sprites.push(sprite);
 };
 const npc=(kind:Parameters<ActorFactory>[0],x:number,z:number,scale=1)=>{const a=actor(kind,x,z,scale);a.userData.isActor=true;a.userData.assetId=kind;root.add(a);return a;};
 box([28,.5,31],[0,-.3,-3],stone);box([28,7,.5],[0,3,-17],dark);
 for(const side of [-1,1]){
  box([.45,7,30],[side*13.5,3,-3],dark);
  for(let i=0;i<5;i++){
   const x=side*11,z=6-i*5;cylinder(.28,5,[x,2.5,z],wood);cylinder(.4,.2,[x,.1,z],gold);
   const lantern=cylinder(.32,.65,[x,3.9,z],i%2?pink:jade);cylinder(.37,.09,[x,4.26,z],gold);cylinder(.37,.09,[x,3.54,z],gold);
   box([.03,.35,.03],[x,3.33,z],gold);updates.push(t=>lantern.rotation.z=Math.sin(t*.7+i)*.035);
  }
 }
 // A walkable inlaid floor: no elevated step or obstacle between the visitor and the dancers.
 const tiles:T.Mesh[]=[];
 for(let x=-2;x<=2;x++)for(let z=0;z<5;z++){
  const m=material((x+z)%2?0x244351:0x40314d,{emissive:(x+z)%2?0x17444a:0x48283f,emissiveIntensity:.25});
  tiles.push(box([1.32,.04,1.32],[x*1.4,.015,-z*1.4],m));
 }
 const ring=mesh(new T.TorusGeometry(3.9,.055,8,72),gold,[0,.045,-2.7]);ring.rotation.x=Math.PI/2;
 // Mạnh Bà's lacquered counter, brass urns, spectral drinks and stools.
 box([1.4,1.25,6.6],[-6.9,.625,-3],wood);box([1.65,.14,6.9],[-6.9,1.32,-3],gold);
 for(const y of [1.0,2.5]){
  box([.8,.12,6.8],[-9.8,y,-3],wood);
  for(let i=0;i<7;i++){
   const profile=[[.07,0],[.15,.04],[.15,.33],[.06,.42],[.05,.60]].map(([r,h])=>new T.Vector2(r,h));
   mesh(new T.LatheGeometry(profile,12),i%2?pink:jade,[-9.8,y+.06,-6+i]);cylinder(.06,.05,[-9.8,y+.68,-6+i],gold);
  }
 }
 for(let i=0;i<5;i++){
  const z=-5.5+i*1.25;cylinder(.32,.12,[-5.0,.72,z],wood);cylinder(.08,.7,[-5.0,.35,z],gold);cylinder(.28,.08,[-5.0,.04,z],gold);
  const glass=mesh(new T.CylinderGeometry(.10,.075,.25,12),i%2?pink:jade,[-6.7,1.52,z]);glass.rotation.z=(i%2?1:-1)*.06;
 }
 for(const z of [-4.8,-2.8]){mesh(new T.SphereGeometry(.30,20,12),gold,[-7.15,1.67,z]);cylinder(.18,.12,[-7.15,1.97,z],wood);}
 const lady=npc('traveler-female',-8.8,-2.6,1.04);lady.rotation.y=Math.PI/2;lady.userData.role='bartender';lady.userData.performanceClip='talk';
 sign('BAR MẠNH BÀ',[-7.6,4.7,-4.7],5.6);sign('UỐNG ĐỂ QUÊN · QUẨY ĐỂ NHỚ',[-7.6,3.9,-4.7],5.0,true);
 // Raised DJ platform stays behind the public dance floor.
 box([8,.35,3.1],[0,.15,-10.9],wood);box([5.1,1.15,1.2],[0,.9,-10.5],wood);box([5.4,.12,1.4],[0,1.52,-10.5],gold);
 for(const x of [-1.35,1.35]){const disc=cylinder(.49,.04,[x,1.61,-10.5],dark);cylinder(.10,.06,[x,1.64,-10.5],jade);updates.push(t=>disc.rotation.y=t*2.4);}
 for(let i=0;i<7;i++){const fader=box([.07,.03,.20],[-.4+i*.13,1.61,-10.5],i%2?pink:jade);updates.push(t=>fader.position.z=-10.5+Math.sin(t*1.4+i)*.09);}
 const dj=npc('guard-green',0,-11.9,1.1);dj.userData.performanceClip='dance-hands';dj.userData.role='dj';
 for(const side of [-1,1]){
  const speakers=new T.Group();speakers.position.set(side*4.1,1.3,-11);root.add(speakers);box([1.2,2.6,1.0],[0,0,0],dark,speakers);
  for(const y of [-.55,.55]){const cone=mesh(new T.CylinderGeometry(.40,.33,.12,24),gold,[0,y,.56],speakers);cone.rotation.x=Math.PI/2;}
  updates.push(t=>speakers.scale.set(1+Math.pow(.5+.5*Math.cos(t*Math.PI*4),5)*.018,1,1));
 }
 sign('QUỶ QUẨY',[0,5.3,-12],8);sign(BAR_SLOGAN,[0,4.35,-11.8],8.2,true);
 // A bronze moon and soft moving lantern beams; no flashes or camera shake.
 const moon=mesh(new T.IcosahedronGeometry(.7,1),gold,[0,5.4,-4]);updates.push(t=>moon.rotation.y=t*.25);
 const beamMaterial=material(0x588e9e,{transparent:true,opacity:.045,depthWrite:false,side:T.DoubleSide});
 for(const side of [-1,1]){const beam=mesh(new T.ConeGeometry(1.2,5,24,1,true),beamMaterial,[side*2.7,2.6,-4.5]);updates.push(t=>beam.rotation.z=side*.20+Math.sin(t*.4)*.12);}
 const glow=new T.PointLight(0x53c8cc,8,18,2);glow.position.set(0,4,-3);root.add(glow);const warm=new T.PointLight(0xffb269,7,13,2);warm.position.set(-7,4,-3);root.add(warm);
 updates.push(t=>{const beat=.5+.5*Math.cos(t*Math.PI*4);glow.intensity=6+beat*2;tiles.forEach((o,i)=>(o.material as T.MeshStandardMaterial).emissiveIntensity=.25+.18*(.5+.5*Math.sin(t*Math.PI+i*.6)));});
 const dancers=[['spirit-round',-1.8,-2.8],['spirit-hat',1.9,-4.0],['guard-blue',-2.7,-.4],['spirit-female',2.8,-.7],['traveler-male',.5,-5.1]] as const;
 dancers.forEach(([kind,x,z],i)=>{const a=npc(kind,x,z,.88);a.userData.role='dancer';a.userData.performanceClip=DANCES[[0,2,6,7,8][i]].id;a.userData.phase=i%2;});
 for(const z of [-4.8,.6]){
  cylinder(.82,.12,[7.5,1.04,z],wood);cylinder(.12,.96,[7.5,.48,z],gold);
  for(const x of [6.3,8.7]){cylinder(.36,.12,[x,.52,z],wood);cylinder(.08,.48,[x,.24,z],gold);}
 }
 sign('VỀ CHÍNH ĐIỆN',[0,2.9,7.2],3.5,true);
 const portal=mesh(new T.TorusGeometry(1,.09,8,40),jade,[0,1.35,8]);portal.scale.y=1.2;
 const obstacles=[new T.Box3(new T.Vector3(-9.4,-1,-6.5),new T.Vector3(-5.8,4,.5)),new T.Box3(new T.Vector3(-5,-1,-13),new T.Vector3(5,4,-9.3)),...[-4.8,.6].map(z=>new T.Box3(new T.Vector3(6.2,-1,z-.9),new T.Vector3(8.9,2,z+.9)))];
 let time=0;
 return {root,actions:[{position:new T.Vector3(0,0,7.4),radius:2,label:'Về Chính Điện',destination:'hall'}],obstacles,bounds:{x:10.4,minZ:-14,maxZ:9},get animationTime(){return time;},setPerformanceTime(){},setParticipant(){},update(){time=now();updates.forEach(update=>update(time));},finishFrame(){},dispose(){meshes.forEach(o=>o.geometry.dispose());materials.forEach(m=>m.dispose());sprites.forEach(s=>{s.material.map?.dispose();s.material.dispose();});root.removeFromParent();}};
}
