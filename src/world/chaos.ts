import * as T from 'three';
import {chaosTargets,chaosCompatible,chaosExpiry,type ChaosAction,type ChaosEvent,type ChaosTarget} from '../../shared/chaos';
import {GuardCostume} from './guard-costume';

type Registered={definition:ChaosTarget;objects:T.Object3D[];actor?:T.Group;costume?:GuardCostume};
type Base={position:T.Vector3;quaternion:T.Quaternion;scale:T.Vector3;visible:boolean;clip:unknown;moving:unknown};
type Effect={event:ChaosEvent;position?:T.Vector3;caught?:boolean};
const smooth=(u:number)=>{u=T.MathUtils.clamp(u,0,1);return u*u*(3-2*u);};
export class ChaosScene {
 readonly definitions:ChaosTarget[];readonly targets=new Map<string,Registered>();
 private effects=new Map<string,Effect>();private baseline=new Map<T.Object3D,Base>();private pauseOffset=0;
 private ring:T.Mesh;private fx:T.InstancedMesh;private stars:T.InstancedMesh;private dummy=new T.Object3D();
 private bursts:{at:number;position:T.Vector3;seed:number}[]=[];
 private resolver:(id:string)=>T.Object3D|undefined=()=>undefined;
 private feedback:(line:string,kind:string)=>void=()=>{};
 private now:()=>number;
 constructor(readonly zone:string,private root:T.Group,now=()=>Date.now()){
  this.now=now;this.definitions=chaosTargets(zone);
  this.ring=new T.Mesh(new T.TorusGeometry(.68,.025,6,32),new T.MeshBasicMaterial({color:0xf2bd72,depthWrite:false}));this.ring.rotation.x=-Math.PI/2;this.ring.visible=false;root.add(this.ring);
  this.fx=new T.InstancedMesh(new T.BoxGeometry(.12,.12,.12),new T.MeshStandardMaterial({color:0xc3a17e,roughness:.8}),48);this.fx.count=0;this.fx.frustumCulled=false;root.add(this.fx);
  this.stars=new T.InstancedMesh(new T.OctahedronGeometry(.07),new T.MeshBasicMaterial({color:0xffde72}),30);this.stars.count=0;this.stars.frustumCulled=false;root.add(this.stars);
 }
 configure(resolver:(id:string)=>T.Object3D|undefined,feedback:(line:string,kind:string)=>void,now?:()=>number){this.resolver=resolver;this.feedback=feedback;if(now)this.now=now;}
 registerGuard(id:string,actor:T.Group){const definition=this.definitions.find(t=>t.id===id);if(!definition)return;this.targets.set(id,{definition,actor,objects:[actor],costume:new GuardCostume(actor)});actor.userData.chaosId=id;}
 registerProp(id:string,objects:T.Object3D[]){const definition=this.definitions.find(t=>t.id===id);if(definition)this.targets.set(id,{definition,objects});}
 point(target:Registered){return target.actor?target.actor.getWorldPosition(new T.Vector3()):new T.Vector3(target.definition.x,.45,target.definition.z);}
 nearest(action:ChaosAction,from:T.Vector3,range=2.85){
  let best:Registered|undefined,distance=range;
  for(const t of this.targets.values()){
   const e=this.effects.get(t.definition.id)?.event;
   if(!chaosCompatible(action,t.definition)||e&&e.brokenUntil>this.now()||action==='pants'&&e&&e.pantsUntil>this.now())continue;
   const p=this.point(t),d=Math.hypot(p.x-from.x,p.z-from.z);if(d<distance){best=t;distance=d;}
  }
  return best;
 }
 highlight(from?:T.Vector3){
  if(!from){this.ring.visible=false;return;}
  const candidate=this.nearest('hit',from)??this.nearest('smash',from);this.ring.visible=Boolean(candidate);
  if(candidate){const p=this.point(candidate);this.ring.position.set(p.x,.46,p.z);this.ring.scale.setScalar(1+Math.sin(this.now()/180)*.045);}
 }
 receive(event:ChaosEvent,serverNow=this.now(),silent=false){
  if(event.zone!==this.zone||!this.targets.has(event.target))return false;
  const previous=this.effects.get(event.target);if(previous&&previous.event.revision>=event.revision)return false;
  const shift=this.now()-serverNow,e={...event,at:event.at+shift,stunUntil:event.stunUntil?event.stunUntil+shift:0,pantsUntil:event.pantsUntil?event.pantsUntil+shift:0,chaseUntil:event.chaseUntil?event.chaseUntil+shift:0,brokenUntil:event.brokenUntil?event.brokenUntil+shift:0};
  if(chaosExpiry(e)<=this.now())return false;
  this.effects.set(e.target,{event:e});
  if(!silent){this.bursts.push({at:this.now(),position:this.point(this.targets.get(e.target)!),seed:e.revision});this.bursts=this.bursts.slice(-4);}
  return true;
 }
 busy(){const now=this.now();return [...this.effects.values()].some(({event:e})=>Math.max(e.stunUntil,e.chaseUntil,e.brokenUntil)>now);}
 remaining(){return Math.max(0,...[...this.effects.values()].map(({event:e})=>Math.max(e.stunUntil,e.chaseUntil,e.brokenUntil)-this.now()))/1000;}
 timeline(time:number,dt:number){if([...this.effects.values()].some(({event:e})=>Math.max(e.stunUntil,e.brokenUntil)>this.now()))this.pauseOffset+=Math.max(0,dt);return time-this.pauseOffset;}
 beforeUpdate(){
  for(const [o,b] of this.baseline){o.position.copy(b.position);o.quaternion.copy(b.quaternion);o.scale.copy(b.scale);o.visible=b.visible;delete o.userData.chaosReaction;if(b.clip===undefined)delete o.userData.performanceClip;else o.userData.performanceClip=b.clip;if(b.moving===undefined)delete o.userData.moving;else o.userData.moving=b.moving;}
  this.baseline.clear();
 }
 private save(o:T.Object3D){if(!this.baseline.has(o))this.baseline.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone(),visible:o.visible,clip:o.userData.performanceClip,moving:o.userData.moving});}
 afterUpdate(_time:number,dt:number){
  const now=this.now();let starCount=0;
  for(const [id,t] of this.targets){
   const effect=this.effects.get(id),e=effect?.event,age=e?(now-e.at)/1000:Infinity;
   if(!e||chaosExpiry(e)<=now){t.costume?.update(0);if(e)this.effects.delete(id);continue;}
   if(t.definition.kind==='prop'){
    for(const object of t.objects){this.save(object);if(e.brokenUntil>now)object.visible=false;else if(age<.4)object.rotation.z+=Math.sin(age*35)*.06*(1-age/.4);}
    continue;
   }
   const actor=t.actor!;this.save(actor);actor.userData.chaosReaction=true;const home=actor.position.clone();effect!.position??=home.clone();
   const target=this.resolver(e.actor),direction=home.clone().sub(new T.Vector3(e.from[0],0,e.from[1])).setY(0);if(direction.lengthSq()<.01)direction.set(1,0,0);direction.normalize();
   if(age<.4){actor.position.addScaledVector(direction,Math.sin(age/.4*Math.PI)*.7);actor.rotation.z+=Math.sin(age/.4*Math.PI)*.45;actor.userData.performanceClip='flail';effect!.position.copy(actor.position);}
   else if(now<e.stunUntil){actor.userData.performanceClip=e.action==='pants'||e.reaction?'flail':'shiver';actor.rotation.z+=Math.sin(age*18)*.045;}
   else if(age<7.4&&target){
    const dest=target.position.clone().setY(home.y),delta=dest.clone().sub(effect!.position),distance=delta.length();
    if(distance>1.5)effect!.position.addScaledVector(delta.normalize(),Math.min(Math.max(0,distance-1.5),(2.2+e.heat*.15)*dt));
    const roam=effect!.position.clone().sub(home).setY(0);if(roam.length()>4.5)effect!.position.copy(home).addScaledVector(roam.normalize(),4.5);
    actor.position.copy(effect!.position);actor.rotation.y=Math.atan2(dest.x-actor.position.x,dest.z-actor.position.z);actor.userData.performanceClip=distance>1.6?'walk':'pound';
    if(distance<1.65&&!effect!.caught){effect!.caught=true;this.feedback(e.actor,'caught');}
   }else{effect!.position.lerp(home,1-Math.exp(-5*dt));actor.position.copy(effect!.position);actor.userData.performanceClip='walk';}
   const pants=e.pantsUntil>now?smooth((now-(e.pantsUntil-6000))/350)*(1-smooth((now-(e.pantsUntil-700))/700)):0;t.costume?.update(pants);
   if(age<2.8)for(let j=0;j<3&&starCount<30;j++){
    const a=now/350+j*Math.PI*2/3;this.dummy.position.set(actor.position.x+Math.cos(a)*.42,actor.position.y+2.0+Math.sin(a*2)*.08,actor.position.z+Math.sin(a)*.42);this.dummy.scale.setScalar(.8);this.dummy.rotation.set(a,0,a);this.dummy.updateMatrix();this.stars.setMatrixAt(starCount++,this.dummy.matrix);
   }
  }
  this.stars.count=starCount;this.stars.instanceMatrix.needsUpdate=true;
  let count=0;this.bursts=this.bursts.filter(b=>now-b.at<1400);
  for(const b of this.bursts){const age=(now-b.at)/1000;for(let j=0;j<12&&count<48;j++){
   const angle=(j+b.seed*.37)*2.4;this.dummy.position.copy(b.position).add(new T.Vector3(Math.cos(angle)*age*1.8,.6+2.1*age-2.2*age*age,Math.sin(angle)*age*1.8));this.dummy.position.y=Math.max(.45,this.dummy.position.y);this.dummy.rotation.set(age*j,angle,age*3);this.dummy.scale.setScalar(Math.max(0,1-age/1.4));this.dummy.updateMatrix();this.fx.setMatrixAt(count++,this.dummy.matrix);
  }}
  this.fx.count=count;this.fx.instanceMatrix.needsUpdate=true;
 }
 clear(){this.beforeUpdate();this.effects.clear();this.bursts=[];this.targets.forEach(t=>t.costume?.update(0));}
 dispose(){this.clear();this.targets.forEach(t=>t.costume?.dispose());for(const o of [this.ring,this.fx,this.stars]){o.geometry.dispose();(o.material as T.Material).dispose();o.removeFromParent();}}
}
