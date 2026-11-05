import * as T from 'three';
import {steamBeat} from './punishment-beats';

const clamp=(n:number)=>T.MathUtils.clamp(n,0,1),ease=(n:number)=>{n=clamp(n);return n*n*(3-2*n);},mod=(n:number,d:number)=>((n%d)+d)%d;
export const EFFECT_FLOORS=[1,2,3,4,5,6,7,8,9,10,11,12,15,16,17,18];
export function punishmentEffectState(floor:number,time:number){
 const duration=[3,4,5,9,13,16].includes(floor)?14:[7,10,14].includes(floor)?16:12,t=mod(time,duration),envelope=ease((t-.5)/3)*(1-ease((t-duration+1.5)/1.4));
 const fire=[6,9,16].includes(floor)?.18+envelope*.82:0,ice=floor===8?.10+ease((t-.5)/4)*(1-ease((t-10.3)/1.6))*.9:0;
 let bloodAge=Infinity,cut=0,eventTime=Infinity,source='body';
 const burst=(times:number[],kind:string,group=1)=>{for(const [i,start] of times.entries())if(t>=start){bloodAge=t-start;eventTime=time-t+start;cut=Math.floor(i/group);source=kind;}};
 if(floor===1)burst([2,4,6,8.6],'mouth');
 if(floor===2)burst([1.2,1.56,3,3.36,4.8,5.15,6.6,6.96],'cut',2);
 if(floor===3)burst([1.6,4,6.4,8.8,11.2],'wrist');
 if(floor===4)burst([1.35,4.15,6.95],'face');
 if(floor===7)burst([3.08,3.6,9.08,9.6,15.08,15.6],'blade');
 if(floor===10)burst([5.85],'horns');
 if(floor===11)burst([3.6],'head');
 if(floor===12)burst([1.46,3.46,5.46,7.46,9.46,11.46],'pestle');
 if(floor===15)burst([3.85,4.35,5.3,6.3,7.3],'tear');
 if(floor===17)burst([2.5,3.4,4.3,5.2,6.1,7,7.9,8.8],'mill');
 if(floor===18){bloodAge=mod(t-.18,1);eventTime=time-bloodAge;}
 if(bloodAge<0||bloodAge>1.6)bloodAge=Infinity;
 const pressure=floor===5?steamBeat(time):undefined;
 return {fire,ice,steam:floor===5?.5+envelope*.5:0,bloodAge,cut,eventTime,source,pressure:pressure?.pressure??0,vent:pressure?.vent??0,rawFace:floor===4?ease((t-1.2)/1.2)*(1-ease((t-12.4)/1.5)):0};
}

type SkinRecord={mesh:T.Mesh;original:T.Material;clone:T.MeshStandardMaterial;color:T.Color;overlay?:T.SkinnedMesh};
/** Bounded pools and per-instance materials keep the public GLB assets shared and intact. */
export class PunishmentVFX {
 private group=new T.Group();private geometry:T.BufferGeometry[]=[];private materials:T.Material[]=[];private pools:T.InstancedMesh[]=[];
 private flames:T.InstancedMesh;private cores:T.InstancedMesh;private smoke:T.InstancedMesh;private crystals:T.InstancedMesh;private shell:T.InstancedMesh;private blood:T.InstancedMesh;private stains:T.InstancedMesh;
 private light=new T.PointLight(0xff8b30,0,5,2);private dummy=new T.Object3D();private target?:T.Object3D;private head?:T.Object3D;private skins:SkinRecord[]=[];
 private originalSpeed:unknown;
 private caps:{mesh:T.Mesh;part:'left'|'right'|'lower'|'head'}[]=[];private capGeometry:T.SphereGeometry;private capMaterial:T.MeshStandardMaterial;
 private emission?:{event:number;actor:T.Object3D;point:T.Vector3};
 constructor(readonly floor:number,root:T.Group){
  this.group.name=`punishment-vfx-${floor}`;root.add(this.group);
  const standard=(p:T.MeshStandardMaterialParameters)=>{const m=new T.MeshStandardMaterial(p);this.materials.push(m);return m;};
  const pool=(g:T.BufferGeometry,m:T.Material,n:number,name:string)=>{this.geometry.push(g);const o=new T.InstancedMesh(g,m,n);o.name=name;o.count=0;o.frustumCulled=false;o.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(o);this.pools.push(o);return o;};
  this.flames=pool(new T.ConeGeometry(.13,.60,7),standard({color:0xff641a,emissive:0xff4910,emissiveIntensity:1.8,transparent:true,opacity:.8,depthWrite:false}),24,'body-flames');
  this.cores=pool(new T.ConeGeometry(.075,.34,6),standard({color:0xffe898,emissive:0xffc34b,emissiveIntensity:1.5}),20,'flame-cores');
  this.smoke=pool(new T.IcosahedronGeometry(.19,1),standard({color:floor===5?0xc8e0de:0x677078,transparent:true,opacity:.28,depthWrite:false,roughness:1}),18,'heat-smoke');
  this.crystals=pool(new T.OctahedronGeometry(.12,0),standard({color:0xc9f7ff,emissive:0x5aacc5,emissiveIntensity:.35,metalness:.2,roughness:.15,transparent:true,opacity:.8}),18,'body-ice-crystals');
  this.shell=pool(new T.IcosahedronGeometry(1,1),standard({color:0x8bcfe9,emissive:0x3a7c9e,emissiveIntensity:.2,transparent:true,opacity:.30,depthWrite:false,metalness:.15,roughness:.1}),2,'frozen-body-shell');
  this.blood=pool(new T.SphereGeometry(.065,7,5),standard({color:0xd51f3e,emissive:0x7d0c27,emissiveIntensity:.4,roughness:.28}),36,'blood-spray');
  const disk=new T.CircleGeometry(.18,10);disk.rotateX(-Math.PI/2);
  this.stains=pool(disk,standard({color:0x9f1834,transparent:true,opacity:.82,depthWrite:false,side:T.DoubleSide,roughness:.3}),16,'blood-splats');
  this.capGeometry=new T.SphereGeometry(1,10,7);this.geometry.push(this.capGeometry);this.capMaterial=standard({color:0xc12743,emissive:0x5c0a1c,emissiveIntensity:.18,roughness:.24});
  this.group.add(this.light);
 }
 private restore(){
  for(const c of this.caps)c.mesh.removeFromParent();this.caps=[];this.emission=undefined;
  for(const s of this.skins){s.mesh.material=s.original;s.clone.dispose();if(s.overlay){s.overlay.removeFromParent();(s.overlay.material as T.Material).dispose();}}
  this.skins=[];
  if(this.target){if(this.originalSpeed===undefined)delete this.target.userData.performanceSpeed;else this.target.userData.performanceSpeed=this.originalSpeed;}
 }
 private prepare(target:T.Object3D){
  const head=target.getObjectByName('Head');if(target===this.target&&head===this.head&&this.skins.length)return;
  this.restore();this.target=target;this.head=head;this.originalSpeed=target.userData.performanceSpeed;
  const sources:T.Mesh[]=[];target.traverse(o=>{if(o instanceof T.Mesh&&!o.userData.vfxOverlay&&!Array.isArray(o.material)&&o.material instanceof T.MeshStandardMaterial)sources.push(o);});
  for(const mesh of sources){
   const original=mesh.material as T.MeshStandardMaterial,clone=original.clone();mesh.material=clone;const skin:SkinRecord={mesh,original,clone,color:original.color.clone()};
   if(this.floor===8&&mesh instanceof T.SkinnedMesh){
    const overlay=new T.SkinnedMesh(mesh.geometry,new T.MeshStandardMaterial({color:0xcaf6ff,emissive:0x428ca8,emissiveIntensity:.2,metalness:.10,roughness:.15,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
    overlay.userData.vfxOverlay=true;overlay.name='frosted-skin-overlay';overlay.bind(mesh.skeleton,mesh.bindMatrix);overlay.frustumCulled=false;overlay.renderOrder=2;mesh.parent?.add(overlay);skin.overlay=overlay;
   }
   this.skins.push(skin);
  }
  if([2,15].includes(this.floor)){
   const spirit=String(target.userData.assetId??'').startsWith('spirit');
   const socket=(name:string,part:'left'|'right'|'lower'|'head',p:[number,number,number],scale:[number,number,number])=>{const bone=target.getObjectByName(name);if(!bone)return;const o=new T.Mesh(this.capGeometry,this.capMaterial);o.name=`torn-socket-${part}`;o.userData.vfxOverlay=true;o.position.set(...p);o.scale.set(...scale);o.visible=false;bone.add(o);this.caps.push({mesh:o,part});};
   socket('LeftArm','left',[-.08,.20,0],[.06,.11,.10]);socket('RightArm','right',[.08,.20,0],[.06,.11,.10]);
   socket('Body','left',[.19,.49,0],[.055,.10,.10]);socket('Body','right',[-.19,.49,0],[.055,.10,.10]);
   socket('Head','head',[0,spirit?-.14:-.20,0],[.13,.04,.12]);
   if(spirit)socket('TailTip','lower',[0,.02,0],[.09,.04,.075]);else{socket('LeftLeg','lower',[-.02,.10,0],[.10,.04,.10]);socket('RightLeg','lower',[.02,.10,0],[.10,.04,.10]);}
  }
 }
 private instance(pool:T.InstancedMesh,index:number,p:T.Vector3,sx:number,sy:number,sz:number,spin=0){
  this.dummy.position.copy(p);this.dummy.rotation.set(pool===this.stains?0:spin*.4,spin,pool===this.stains?0:spin*.15);this.dummy.scale.set(Math.max(.001,sx),Math.max(.001,sy),Math.max(.001,sz));this.dummy.updateMatrix();pool.setMatrixAt(index,this.dummy.matrix);
 }
 update(time:number,subject:T.Object3D,victim:T.Object3D,enabled=true){
  this.prepare(subject);const state=punishmentEffectState(this.floor,time);subject.updateWorldMatrix(true,false);
  const point=(x:number,y:number,z:number)=>new T.Vector3(x,y,z).applyMatrix4(subject.matrixWorld);
  for(const s of this.skins){
   const skin=/skin|soul|robe/i.test((s.original as T.MeshStandardMaterial).name);
   s.clone.color.copy(s.color);if(enabled&&skin&&state.fire)s.clone.color.lerp(new T.Color(0x3b454b),state.fire*.65);
   if(enabled&&skin&&(state.pressure||state.rawFace))s.clone.color.lerp(new T.Color(0xc34755),Math.max(state.pressure*.80,state.rawFace*.72));
   if(s.overlay){s.overlay.visible=enabled&&state.ice>.01;(s.overlay.material as T.MeshStandardMaterial).opacity=enabled?state.ice*.46:0;}
  }
  for(const c of this.caps)c.mesh.visible=enabled&&Number(subject.userData.spectralParts?.[c.part]??0)>.10;
  for(const p of this.pools)p.count=0;this.light.intensity=0;
  if(!enabled){this.pools.forEach(p=>{p.instanceMatrix.needsUpdate=true;});return;}
  const heat=state.fire||state.steam;
  if(state.fire){
   for(let j=0;j<24;j++){
    const age=mod(time*.95+j*.137,1),angle=j*2.4+Math.sin(time*2+j)*.2,radius=.26+Math.sin(j*4)*.10;
    const p=point(Math.cos(angle)*radius,.20+age*1.8,Math.sin(angle)*radius+.02),size=Math.sin(age*Math.PI)*state.fire;
    this.instance(this.flames,j,p,.6+size*.8,.45+size*1.3,.6+size*.6,Math.sin(time*4+j)*.35);
    if(j<20)this.instance(this.cores,j,p,.6+size,.6+size*.8,.6+size,Math.sin(time*4+j)*.25);
   }
   this.flames.count=24;this.cores.count=20;this.light.position.copy(point(0,.85,.2));this.light.intensity=state.fire*(3.2+Math.sin(time*9)*.35);
  }
  if(heat){
   for(let j=0;j<18;j++){const age=mod(time*.45+j*.17,1),angle=j*2.4,p=state.vent>.1?point((j%2?1:-1)*(.27+age*.9),1.45+Math.sin(age*Math.PI)*.35,.12+Math.sin(angle)*.15):point(Math.cos(angle)*(.28+age*.35),1.1+age*1.1,Math.sin(angle)*(.28+age*.35));this.instance(this.smoke,j,p,.25+age*.8,.25+age,.25+age*.8,j+time*.2);}
   this.smoke.count=18;
  }
  if(state.ice){
   for(let j=0;j<18;j++){const angle=j*2.4,y=.15+(j%6)*.26,radius=.32+(j%3)*.05,scale=state.ice*(.65+Math.sin(j)*.2);this.instance(this.crystals,j,point(Math.cos(angle)*radius,y,Math.sin(angle)*radius),scale,scale*(2+j%3),scale,angle);}
   this.crystals.count=18;
   this.instance(this.shell,0,point(0,.82,0),.47,.82*state.ice,.34);
   const headIce=ease((state.ice-.45)/.5);this.instance(this.shell,1,point(0,1.38,0),.45*headIce,.49*headIce,.39*headIce);this.shell.count=2;
   victim.userData.performanceSpeed=4*(1-state.ice*.88);victim.rotation.z*=1-state.ice*.85;subject.userData.performanceSpeed=victim.userData.performanceSpeed;
  }
  if(Number.isFinite(state.bloodAge)){
   if(!this.emission||Math.abs(this.emission.event-state.eventTime)>.001||this.emission.actor!==subject){
    const bonePoint=(name:string,offset:T.Vector3,fallback:T.Vector3)=>{const bone=subject.getObjectByName(name);if(!bone)return fallback;bone.updateWorldMatrix(true,false);return offset.applyMatrix4(bone.matrixWorld);};
    const spirit=String(subject.userData.assetId??'').startsWith('spirit');let origin=point(0,this.floor===18?.8:1.3,.27);
    if(state.source==='mouth'||state.source==='face')origin=bonePoint('Head',new T.Vector3(state.source==='face'?(state.cut%2?-.18:.18):0,spirit?.115:-.07,spirit?.329:.253),point(0,1.2,.3));
    if(state.source==='wrist')origin=bonePoint(state.cut%2?'LeftHand':'RightHand',new T.Vector3(0,0,.03),point(state.cut%2?.45:-.45,1.25,0));
    if(state.source==='cut'||state.source==='tear'){const n=state.cut%4,name=n===0?'LeftArm':n===1?'RightArm':n===2?(spirit?'TailTip':'LeftLeg'):'Head';origin=bonePoint(name,new T.Vector3(0,n===3?-.14:.08,.04),point(n<2?(n===0?-.4:.4):0,n===2?.4:1.2,.15));}
    if(state.source==='blade')origin=point(state.cut%2?.22:-.22,state.cut%2?.82:.35,.25);
    if(state.source==='horns')origin=point(-.2,.70,.1);
    if(state.source==='pestle'){origin=bonePoint('Head',new T.Vector3(0,.05,.10),point(0,1.1,0));origin.y=Math.max(1.68,origin.y);}
    if(state.source==='mill')origin=subject.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.15,.55));
    this.emission={event:state.eventTime,actor:subject,point:origin};
   }
   const origin=this.emission.point;let drops=0,splats=0;
   for(let j=0;j<36;j++){
    const age=state.bloodAge-j*.008;if(age<0||age>1.5)continue;const angle=j*2.4,speed=.85+(j%5)*.25;
    const px=origin.x+Math.cos(angle)*speed*age,pz=origin.z+Math.sin(angle)*speed*age,py=origin.y+(1.0+(j%4)*.3)*age-3.2*age*age;
    const board=this.floor===18&&Math.abs(px)<.65&&Math.abs(pz+6.2)<1.45?.96:.44;
    if(py>board){const size=1-age*.7;this.instance(this.blood,drops++,new T.Vector3(px,py,pz),size,size*1.7,size,angle+age*5);}
    else if(splats<16)this.instance(this.stains,splats++,new T.Vector3(px,board+.018,pz),.35+age*.6,1,.3+age*.45,angle);
   }
   this.blood.count=drops;this.stains.count=splats;
  }
  this.pools.forEach(p=>{p.instanceMatrix.needsUpdate=true;});
 }
 dispose(){this.restore();this.geometry.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.group.removeFromParent();}
}
