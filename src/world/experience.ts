import * as T from 'three';
import { EXPERIENCE_PROFILES, type ExperienceProfile } from './experience-profiles';
import { stoneCameraShot } from './stone-crush';
import { neckCameraShot } from './neck-pull';

export type ExperiencePhase='idle'|'approaching'|'detaining'|'escorting'|'positioning'|'performing'|'returning';
type Bounds={x:number;minZ:number;maxZ:number};
const smooth=(u:number)=>{u=T.MathUtils.clamp(u,0,1);return u*u*(3-2*u);};
export const ESCORT_MIN_DISTANCE=1.3;
const FOLLOW_DISTANCE=1.7;

/** Small deterministic navigation grid, leaving space around scenery. */
export function escortPath(from:T.Vector3,to:T.Vector3,bounds:Bounds,obstacles:T.Box3[]):T.Vector3[]{
  const step=.5,width=Math.round(bounds.x*2/step)+1,height=Math.round((bounds.maxZ-bounds.minZ)/step)+1;
  const boxes=obstacles.map(b=>b.clone().expandByScalar(.45));
  const point=(id:number)=>new T.Vector3((id%width)*step-bounds.x,0,Math.floor(id/width)*step+bounds.minZ);
  const free=(id:number)=>id>=0&&id<width*height&&!boxes.some(b=>b.containsPoint(point(id)));
  const nearest=(v:T.Vector3)=>{let best=-1,d=Infinity;for(let id=0;id<width*height;id++)if(free(id)){const p=point(id),n=(p.x-v.x)**2+(p.z-v.z)**2;if(n<d){d=n;best=id;}}return best;};
  const start=nearest(from),goal=nearest(to);if(start<0||goal<0)return [];
  const queue=[start],previous=new Map<number,number>([[start,-1]]);let cursor=0;
  while(cursor<queue.length){const id=queue[cursor++];if(id===goal)break;const x=id%width,y=Math.floor(id/width);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,n=yy*width+xx;if(xx<0||xx>=width||yy<0||yy>=height||previous.has(n)||!free(n))continue;previous.set(n,id);queue.push(n);}}
  if(!previous.has(goal))return [];
  const path:T.Vector3[]=[];let n=goal;while(n!==-1){path.push(point(n));n=previous.get(n)!;}path.reverse();
  return path.filter((p,i)=>i===0||i===path.length-1||!path[i+1].clone().sub(p).normalize().equals(p.clone().sub(path[i-1]).normalize()));
}

export class PunishmentExperience {
  phase:ExperiencePhase='idle';
  private elapsed=0;
  private path:T.Vector3[]=[];
  private waypoint=0;
  private start=new T.Vector3();
  private startScale=new T.Vector3(1,1,1);
  private startRotation=new T.Quaternion();
  private transitionFrom=new T.Vector3();
  private transitionRotation=new T.Quaternion();
  private guard?:T.Group;
  private victim?:T.Object3D;
  private originalVisibility=true;
  private returnLeg=0;
  private lastReaction=-10;
  private profile=EXPERIENCE_PROFILES[17];
  private trail:T.Vector3[]=[];
  private heading=new T.Vector3(0,0,1);
  private blockedByPlayer=false;
  private options?:{player:T.Group;victim:T.Object3D;root:T.Group;bounds:Bounds;obstacles:T.Box3[];profile?:ExperienceProfile;stageTime?:(time?:number)=>void;participant?:(actor?:T.Group)=>void;createGuard:()=>T.Group;status:(phase:ExperiencePhase,remaining:number,moment?:string)=>void;reaction:(vowel:'aa'|'oh'|'uu')=>void;cleanup:(actor:T.Group)=>void;finish:(cancelled:boolean)=>void};
  get active(){return this.phase!=='idle';}
  startRun(options:NonNullable<PunishmentExperience['options']>){
    if(this.active)return false;
    this.options=options;this.profile=options.profile??EXPERIENCE_PROFILES[17];this.victim=options.victim;this.start.copy(options.player.position);this.startScale.copy(options.player.scale);this.startRotation.copy(options.player.quaternion);this.originalVisibility=options.victim.visible;
    this.guard=options.createGuard();
    const spawns=[new T.Vector3(-6.8,0,-.8),new T.Vector3(6.8,0,-.8),new T.Vector3(-8,0,6),new T.Vector3(8,0,6)];
    this.guard.position.copy(spawns.find(p=>p.distanceTo(this.start)>2.2)??spawns[0]);options.root.add(this.guard);
    const playerSpace=new T.Box3(new T.Vector3(this.start.x-.85,-1,this.start.z-.85),new T.Vector3(this.start.x+.85,4,this.start.z+.85));
    const docks=Array.from({length:16},(_,i)=>this.start.clone().add(new T.Vector3(Math.sin(i*Math.PI/8)*1.75,0,Math.cos(i*Math.PI/8)*1.75))).filter(p=>this.walkable(p)).sort((a,b)=>a.distanceToSquared(this.guard!.position)-b.distanceToSquared(this.guard!.position));
    this.path=[];for(const dock of docks){const candidate=escortPath(this.guard.position,dock,options.bounds,[...options.obstacles,playerSpace]);if(candidate.length){this.path=candidate;break;}}
    if(!this.path.length){options.cleanup(this.guard);this.guard.removeFromParent();this.options=undefined;return false;}
    this.waypoint=0;this.lastReaction=-10;this.returnLeg=0;this.change('approaching');return true;
  }
  private change(phase:ExperiencePhase){this.phase=phase;this.elapsed=0;this.options?.status(phase,phase==='performing'?this.profile.duration:0,phase==='performing'?this.profile.moments[0]:undefined);}
  private walk(dt:number){
    const guard=this.guard!;let budget=2.8*dt,moved=false;this.blockedByPlayer=false;
    while(budget>0&&this.waypoint<this.path.length){const next=this.path[this.waypoint],delta=next.clone().sub(guard.position);delta.y=0;const distance=delta.length();if(distance<.02){this.waypoint++;continue;}this.heading.copy(delta).normalize();const travel=Math.min(distance,budget),candidate=guard.position.clone().addScaledVector(this.heading,travel),player=this.options!.player;
      const yaw=Math.atan2(this.heading.x,this.heading.z);guard.rotation.y+=Math.atan2(Math.sin(yaw-guard.rotation.y),Math.cos(yaw-guard.rotation.y))*(1-Math.exp(-12*dt));
      if(Math.hypot(candidate.x-player.position.x,candidate.z-player.position.z)<ESCORT_MIN_DISTANCE){this.blockedByPlayer=true;break;}
      guard.position.copy(candidate);moved=true;budget-=travel;if(travel>=distance)this.waypoint++;
    }
    guard.userData.moving=moved;delete guard.userData.performanceClip;return this.waypoint>=this.path.length;
  }
  private walkable(p:T.Vector3,margin=.4){const o=this.options!,edge=margin>0?.35:0;return Math.abs(p.x)<=o.bounds.x-edge&&p.z>=o.bounds.minZ+edge&&p.z<=o.bounds.maxZ-edge&&!o.obstacles.some(box=>box.clone().expandByScalar(margin).containsPoint(new T.Vector3(p.x,0,p.z)));}
  private startFollowing(){this.trail=[this.options!.player.position.clone().setY(0),this.guard!.position.clone().setY(0)];}
  private follow(dt:number){
    const player=this.options!.player,guard=this.guard!,end=this.trail.at(-1)!;
    if(end.distanceToSquared(guard.position)>.0025)this.trail.push(guard.position.clone().setY(0));
    let remaining=FOLLOW_DISTANCE,desired=this.trail[0].clone();
    for(let i=this.trail.length-1;i>0;i--){const a=this.trail[i],b=this.trail[i-1],length=a.distanceTo(b);if(length>=remaining){desired.copy(a).lerp(b,remaining/length);if(i>2)this.trail.splice(0,i-2);break;}remaining-=length;}
    const side=new T.Vector3(this.heading.z,0,-this.heading.x),away=player.position.clone().sub(guard.position).setY(0),inFront=away.dot(this.heading)>.1&&away.length()<2.4;
    if(this.blockedByPlayer||inFront){
      const candidates=[-1,1].map(s=>guard.position.clone().addScaledVector(side,s*1.8).addScaledVector(this.heading,-.25)).filter(p=>this.walkable(p));
      candidates.sort((a,b)=>a.distanceToSquared(player.position)-b.distanceToSquared(player.position));if(candidates.length)desired.copy(candidates[0]);
    }else{const offset=desired.clone().addScaledVector(side,.42);if(this.walkable(offset))desired.copy(offset);}
    if(Math.hypot(desired.x-guard.position.x,desired.z-guard.position.z)<ESCORT_MIN_DISTANCE+.12){const radial=desired.clone().sub(guard.position).setY(0);if(radial.lengthSq()<.01)radial.copy(side);desired.copy(guard.position).addScaledVector(radial.normalize(),FOLLOW_DISTANCE);}
    const delta=desired.clone().sub(player.position).setY(0),distance=delta.length();
    if(distance>.01){const travel=Math.min(distance*(1-Math.exp(-8*dt)),3.5*dt),candidate=player.position.clone().addScaledVector(delta.normalize(),travel);candidate.y=0;
      if(Math.hypot(candidate.x-guard.position.x,candidate.z-guard.position.z)<ESCORT_MIN_DISTANCE){const current=player.position.clone().sub(guard.position).setY(0),target=desired.clone().sub(guard.position),angle=Math.atan2(current.x,current.z),goal=Math.atan2(target.x,target.z),turn=Math.atan2(Math.sin(goal-angle),Math.cos(goal-angle)),next=angle+Math.sign(turn)*Math.min(Math.abs(turn),travel/Math.max(ESCORT_MIN_DISTANCE,current.length()));candidate.copy(guard.position).add(new T.Vector3(Math.sin(next),0,Math.cos(next)).multiplyScalar(Math.max(ESCORT_MIN_DISTANCE,current.length())));}
      if(this.walkable(candidate,0))player.position.copy(candidate);
      const yaw=Math.atan2(delta.x,delta.z);player.rotation.set(0,player.rotation.y+Math.atan2(Math.sin(yaw-player.rotation.y),Math.cos(yaw-player.rotation.y))*(1-Math.exp(-9*dt)),0);
    }
    player.userData.performanceClip=distance>.05?'glide_walk':'idle';
  }
  private victimPose(){
    this.victim!.updateWorldMatrix(true,false);const position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3();this.victim!.matrixWorld.decompose(position,rotation,scale);return {position,rotation,scale};
  }
  update(dt:number,time:number){
    const o=this.options;if(!this.active||!o||!this.guard||!this.victim)return;
    this.elapsed+=dt;const player=o.player;
    if(this.phase==='approaching'){
      player.userData.performanceClip='idle';
      if(this.walk(dt)){this.guard.userData.moving=false;this.guard.userData.performanceClip='pull';this.change('detaining');}
    }else if(this.phase==='detaining'){
      player.userData.performanceClip='bound';
      const angle=Math.atan2(player.position.x-this.guard.position.x,player.position.z-this.guard.position.z);this.guard.rotation.y=angle;
      if(this.elapsed>=1.1){this.path=escortPath(this.guard.position,new T.Vector3(...this.profile.handoff),o.bounds,o.obstacles);this.waypoint=0;this.startFollowing();this.change('escorting');}
    }else if(this.phase==='escorting'||(this.phase==='returning'&&this.returnLeg===1)){
      const reached=this.walk(dt);this.follow(dt);
      if(reached){
        if(this.phase==='returning'){this.end(false);return;}
        o.stageTime?.(0);this.transitionFrom.copy(player.position);this.transitionRotation.copy(player.quaternion);this.victim.visible=false;this.guard.userData.moving=false;this.guard.userData.performanceClip='greet';this.change('positioning');
      }
    }else if(this.phase==='positioning'){
      o.stageTime?.(0);const pose=this.victimPose(),u=smooth(this.elapsed/1.8);player.position.lerpVectors(this.transitionFrom,pose.position,u);player.position.y+=Math.sin(u*Math.PI)*this.profile.positioningArc;player.quaternion.slerpQuaternions(this.transitionRotation,pose.rotation,u);player.scale.copy(this.startScale).lerp(pose.scale,u);player.userData.performanceClip='bound';
      if(u>=1){o.participant?.(player);if(this.profile.escortWait){this.path=escortPath(this.guard.position,new T.Vector3(...this.profile.escortWait),o.bounds,o.obstacles);this.waypoint=0;}this.change('performing');}
    }else if(this.phase==='performing'){
      o.stageTime?.(Math.min(this.elapsed,this.profile.duration));const pose=this.victimPose();player.position.copy(pose.position);player.quaternion.copy(pose.rotation);player.scale.copy(pose.scale);player.userData.performanceClip=this.victim.userData.performanceClip??(this.victim.userData.moving?'glide_walk':'flail');player.userData.phase=this.victim.userData.phase??0;player.userData.performanceSpeed=this.victim.userData.performanceSpeed??1;o.stageTime?.(Math.min(this.elapsed,this.profile.duration));
      const guardParked=!this.profile.escortWait||this.walk(dt);
      if(guardParked){this.guard.userData.moving=false;this.guard.userData.performanceClip='talk';this.guard.rotation.y=Math.atan2(-this.guard.position.x,-6-this.guard.position.z);}
      if(this.elapsed-this.lastReaction>this.profile.reactionEvery){this.lastReaction=this.elapsed;o.reaction(this.profile.vowel);}
      o.status('performing',Math.max(0,Math.ceil(this.profile.duration-this.elapsed)),this.profile.moments[Math.min(2,Math.floor(this.elapsed/this.profile.duration*3))]);
      if(this.elapsed>=this.profile.duration){o.participant?.();this.transitionFrom.copy(player.position);this.transitionRotation.copy(player.quaternion);this.path=escortPath(this.guard.position,new T.Vector3(-1.8,0,-1.3),o.bounds,o.obstacles);this.waypoint=0;this.returnLeg=0;this.change('returning');}
    }else if(this.phase==='returning'){
      const guardReady=this.walk(dt),u=smooth(this.elapsed/1.8);player.position.lerpVectors(this.transitionFrom,new T.Vector3(0,0,-.4),u);player.position.y+=Math.sin(u*Math.PI)*Math.max(.5,this.profile.positioningArc);player.quaternion.slerpQuaternions(this.transitionRotation,new T.Quaternion(),u);player.scale.copy(this.victimPose().scale).lerp(this.startScale,u);player.userData.performanceClip=u<1?'flail':'idle';
      if(u>=1&&guardReady){o.stageTime?.();this.victim.visible=this.originalVisibility;this.returnLeg=1;this.path=escortPath(this.guard.position,this.start,o.bounds,o.obstacles);this.waypoint=0;this.startFollowing();}
    }
    player.userData.performanceTime=time;
    player.userData.stageTime=this.phase==='performing'?Math.min(this.elapsed,this.profile.duration):this.phase==='positioning'?0:this.phase==='returning'&&this.returnLeg===0?this.profile.duration:-1;
  }
  cameraHint(){
    if(this.guard&&this.options&&(this.phase==='detaining'||this.phase==='escorting'||this.phase==='returning'&&this.returnLeg===1)){
      const target=this.options.player.position.clone().add(this.guard.position).multiplyScalar(.5).add(new T.Vector3(0,1,0)),side=new T.Vector3(this.heading.z,0,-this.heading.x);
      return {position:target.clone().addScaledVector(side,4.6).addScaledVector(this.heading,-2.8).add(new T.Vector3(0,2.1,0)),target};
    }
    if(this.phase!=='performing'&&this.phase!=='positioning')return undefined;
    if(this.phase==='performing'&&this.profile===EXPERIENCE_PROFILES[10])return stoneCameraShot(this.elapsed);
    if(this.phase==='performing'&&this.profile===EXPERIENCE_PROFILES[13])return neckCameraShot(this.elapsed);
    const pose=this.victimPose();return {position:new T.Vector3(...this.profile.camera),target:this.phase==='positioning'?this.options!.player.position.clone().add(new T.Vector3(0,.8,0)):this.profile.fixedFocus?new T.Vector3(...this.profile.fixedFocus):pose.position.clone().add(new T.Vector3(...this.profile.focusOffset))};
  }
  escortPose(){return this.guard?{position:this.guard.position,yaw:this.guard.rotation.y,moving:Boolean(this.guard.userData.moving),clip:String(this.guard.userData.performanceClip??'')}:undefined;}
  cancel(){if(this.active)this.end(true);}
  private end(cancelled:boolean){
    const o=this.options;if(!o)return;
    if(cancelled)o.player.position.copy(this.start);o.player.position.y=0;o.player.scale.copy(this.startScale);o.player.quaternion.copy(this.startRotation);
    delete o.player.userData.performanceClip;delete o.player.userData.performanceSpeed;delete o.player.userData.phase;delete o.player.userData.stageTime;
    if(this.victim)this.victim.visible=this.originalVisibility;
    o.participant?.();o.stageTime?.();
    if(this.guard){o.cleanup(this.guard);this.guard.removeFromParent();}
    this.phase='idle';this.options=undefined;this.guard=undefined;this.victim=undefined;o.finish(cancelled);
  }
}
