import * as T from 'three';
import {PunishmentExperience,escortPath,ESCORT_MIN_DISTANCE,type ExperiencePhase} from '../src/world/experience.ts';
import {buildVisitZone} from '../src/world/underworld.ts';
import {ExperienceQueue} from '../server/src/ExperienceQueue.ts';
import {EXPERIENCE_PROFILES} from '../src/world/experience-profiles.ts';
import {scissorsParts,applySpectralParts,captureSpectralRig} from '../src/world/spectral-parts.ts';
import {maskPeelingBeat,MASK_CYCLE_DURATION} from '../src/world/mask-peeling.ts';
import {stoneCrushBeat,stoneCrushParts,stoneCameraShake,STONE_IMPACT_TIME} from '../src/world/stone-crush.ts';
import {neckPullBeat,NECK_CYCLE_DURATION} from '../src/world/neck-pull.ts';
import {Soundscape} from '../src/world/soundscape.ts';
import fs from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

(globalThis as any).document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const actor=(kind:string,x:number,z:number,s=1)=>{const a=new T.Group();a.position.set(x,0,z);a.scale.setScalar(s);a.userData.isActor=true;return a;};
function setup(floor:number,start=new T.Vector3(0,0,5.5)){
 const zone=buildVisitZone(`floor-${floor}`,actor);let victim:T.Object3D|undefined;zone.root.traverse(o=>{if(o.userData.role==='victim')victim=o;});
 if(!victim)throw Error('Missing victim');
 const player=new T.Group();player.position.copy(start);const exp=new PunishmentExperience();let completed=false,cancelled=false,reactions=0,cleanups=0,time=0,performingSeconds=0;
 const phases=new Set<ExperiencePhase>(),moments=new Set<string>(),profile=EXPERIENCE_PROFILES[floor-1];
 if(!exp.startRun({player,victim,root:zone.root,bounds:zone.bounds,obstacles:zone.obstacles,profile,stageTime:t=>{zone.setPerformanceTime(t);zone.update(time,0);},participant:a=>zone.setParticipant(a),createGuard:()=>actor('demon',0,0),status:(p,_remaining,moment)=>{phases.add(p);if(moment)moments.add(moment);},reaction:vowel=>{if(vowel!==profile.vowel)throw Error('Wrong floor reaction');reactions++;},cleanup:()=>cleanups++,finish:cancel=>{cancelled=cancel;completed=!cancel;}}))throw Error('Could not start experience');
 return {zone,victim,player,exp,phases,moments,profile,start,step(dt=1/30){time+=dt;if(exp.phase==='performing')performingSeconds+=dt;zone.update(time,dt);exp.update(dt,time);if(!Number.isFinite(player.position.length()+player.scale.length()))throw Error('Invalid player transform');if(exp.phase==='performing'&&player.position.distanceTo(victim!.getWorldPosition(new T.Vector3()))>.001)throw Error('Player is out of sync with station');const guard=exp.escortPose();if(guard&&(['approaching','detaining','escorting'].includes(exp.phase)||exp.phase==='returning'&&player.userData.performanceClip==='glide_walk')){const distance=Math.hypot(guard.position.x-player.position.x,guard.position.z-player.position.z);if(distance<ESCORT_MIN_DISTANCE-.00001)throw Error(`Escort overlaps player: floor ${floor}, ${exp.phase}, distance ${distance}`);}},get performingSeconds(){return performingSeconds;},get time(){return time;},get completed(){return completed;},get cancelled(){return cancelled;},get reactions(){return reactions;},get cleanups(){return cleanups;}};
}
for(let floor=1;floor<=18;floor++){
 const test=setup(floor);while(test.exp.active&&test.time<75)test.step();
 if(!test.completed||!test.victim.visible||test.reactions<4||test.cleanups!==1||test.phases.size!==6)throw Error(`Incomplete experience ${floor}`);
 if(test.moments.size!==3||Math.abs(test.performingSeconds-test.profile.duration)>.07)throw Error(`Floor ${floor} used incorrect choreography`);
 if(test.zone.obstacles.some(box=>box.containsPoint(test.player.position)))throw Error('Player returned inside scenery');test.zone.dispose();
}
for(let floor=1;floor<=18;floor++)for(const phase of ['approaching','detaining','escorting','positioning','performing','returning'] as const){
 const test=setup(floor);while(test.exp.phase!==phase&&test.time<60)test.step();if(test.exp.phase!==phase)throw Error(`Could not reach ${phase}`);
 test.exp.cancel();if(!test.cancelled||test.exp.active||!test.victim.visible||test.cleanups!==1||test.player.position.distanceTo(test.start)>.001||test.player.scale.distanceTo(new T.Vector3(1,1,1))>.001||test.player.userData.spectralParts)throw Error(`Cancellation did not restore floor ${floor} / ${phase}`);test.zone.update(999,0);if(test.zone.animationTime!==999)throw Error('Stage clock remained locked after cancellation');test.zone.dispose();
}
for(const start of [new T.Vector3(-9,0,-13),new T.Vector3(9,0,-13),new T.Vector3(0,0,-14)]){
 const test=setup(18,start);while(test.exp.active&&test.time<75)test.step();if(!test.completed)throw Error('Escort stalled behind the stage');test.zone.dispose();
}
for(const floor of [1,5,9,18])for(const start of [new T.Vector3(-6.8,0,-.8),new T.Vector3(0,0,-2.7),new T.Vector3(10.8,0,8.8),new T.Vector3(-9,0,-13)])for(const dt of [1/20,1/60,1/144]){
 const test=setup(floor,start);while(test.exp.active&&test.time<90)test.step(dt);if(!test.completed)throw Error(`Escort stalled at boundary or turn: floor ${floor}, ${start.toArray()}, ${dt}`);test.zone.dispose();
}
const obstacle=new T.Box3(new T.Vector3(-5,-1,-10.5),new T.Vector3(5,5,-2.8)),bounds={x:11,minZ:-15,maxZ:9};
const route=escortPath(new T.Vector3(0,0,6),new T.Vector3(0,0,-13),bounds,[obstacle]);
if(!route.length||!route.some(p=>Math.abs(p.x)>5))throw Error('Route went through stage');
for(let i=1;i<route.length;i++)for(let n=0;n<=10;n++)if(obstacle.containsPoint(route[i-1].clone().lerp(route[i],n/10)))throw Error('Route crosses scenery');
const q=new ExperienceQueue();if(!q.request('floor-18','a',0).accepted||q.request('floor-18','b',1).position!==1||q.request('floor-18','c',2).position!==2)throw Error('Queue order failed');
q.release('b',3);const grants=q.release('a',10);if(grants[0]?.id!=='c'||!q.owns('floor-18','c'))throw Error('Queue handoff failed');
if(!q.request('floor-1','d',10).accepted)throw Error('Different floors cannot run together');
if(!q.expired(90011).includes('c'))throw Error('Stale slot not released');q.release('c',90011);if(!q.request('floor-18','e',90012).accepted)throw Error('Released slot still blocked');
const pieces=scissorsParts(8);if(pieces.left!==1||pieces.right!==1||pieces.lower!==1||pieces.head!==1)throw Error('Scissors did not separate all spirit parts');
const rejoined=scissorsParts(11.9);if(rejoined.left>.001||rejoined.head>.001)throw Error('Spirit parts were not reassembled');
// Three faces must come off in order, land on the cart, and a new face grows back.
for(const [time,count] of [[0,0],[3.7,1],[6.5,2],[9.3,3]] as const){
 const beat=maskPeelingBeat(time);if(beat.removed!==count)throw Error(`Mask removal out of order at ${time}`);
}
if(maskPeelingBeat(11).regrow!==1||maskPeelingBeat(MASK_CYCLE_DURATION).removed!==0)throw Error('Masks did not regrow/reset');
const maskTest=setup(4);
while(maskTest.exp.phase!=='performing'&&maskTest.time<50)maskTest.step();
const peeling=maskTest.zone.root.getObjectByName('peeling-mask-0')!,cart=maskTest.zone.root.getObjectByName('discarded-mask-cart')!;
if(!peeling||!cart)throw Error('Mask station is missing its props');
maskTest.zone.setPerformanceTime(0);maskTest.zone.update(0,0);const fitted=peeling.position.clone();
// Simulate the participant moving: the mask follows the player, not the hidden demo.
maskTest.player.position.x+=.4;maskTest.zone.update(0,0);
if(Math.abs(peeling.position.x-fitted.x-.4)>.001)throw Error('Masks do not follow actual participant');
maskTest.zone.setPerformanceTime(3.7);maskTest.zone.update(0,0);
if(Math.hypot(peeling.position.x-cart.position.x,peeling.position.z-cart.position.z)>1)throw Error('Removed mask missed the cart');
maskTest.exp.cancel();maskTest.zone.setPerformanceTime(0);maskTest.zone.update(0,0);
if(Math.abs(peeling.position.x)>.01)throw Error('Mask stayed attached to cancelled participant');maskTest.zone.dispose();
const rig=new T.Group(),arm=new T.Bone(),head=new T.Bone();arm.name='LeftArm';head.name='Head';arm.position.set(.27,.29,0);head.position.y=.55;rig.add(arm,head);captureSpectralRig(rig);applySpectralParts(rig,pieces);if(arm.position.x<1||head.position.y<1)throw Error('Separated bones did not move');applySpectralParts(rig);if(Math.abs(arm.position.x-.27)>.0001||head.position.y!==.55)throw Error('Spectral deformation did not reset');
if(stoneCrushBeat(2.6).rockY<5||stoneCrushBeat(3.5).rockY>=stoneCrushBeat(3.3).rockY||stoneCrushParts(STONE_IMPACT_TIME-.01).headShatter!==0)throw Error('Stone does not lift/drop before impact');
if(stoneCrushParts(4).headShatter!==1||stoneCrushParts(10.3).headShatter!==0||stoneCameraShake(2).length()!==0||stoneCameraShake(4.2).length()!==0)throw Error('Stone fracture/shake timing failed');
// Exercise the actual GLB, including head removal, real fragment triangles and restoration.
const bytes=await fs.readFile('public/models/spirit.glb'),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const soul=new T.Group();soul.userData.assetId='spirit';soul.add(gltf.scene);gltf.scene.scale.setScalar(1.8/new T.Box3().setFromObject(gltf.scene).getSize(new T.Vector3()).y);
const actualHead=gltf.scene.getObjectByName('Head')!;captureSpectralRig(gltf.scene);let originalDisposed=false;
gltf.scene.traverse(o=>{if(o instanceof T.Mesh&&!Array.isArray(o.material))o.material.addEventListener('dispose',()=>{originalDisposed=true;});});
const stoneZone=buildVisitZone('floor-11',actor);let stoneVictim:T.Object3D|undefined;stoneZone.root.traverse(o=>{if(o.userData.role==='victim')stoneVictim=o;});
soul.position.copy(stoneVictim!.position);soul.quaternion.copy(stoneVictim!.quaternion);stoneZone.setParticipant(soul);stoneZone.setPerformanceTime(4.4);stoneZone.update(0,0);applySpectralParts(gltf.scene,soul.userData.spectralParts);
const chunks:T.Object3D[]=[];stoneZone.root.traverse(o=>{if(o.name.startsWith('shattered-head-piece-'))chunks.push(o);});
if(chunks.length<6||actualHead.scale.x>.01||!chunks.some(o=>o.children.some(c=>c instanceof T.Mesh&&c.geometry.getAttribute('position').count>100)))throw Error('Actual head did not fracture into model geometry');
stoneZone.setPerformanceTime(10.3);stoneZone.update(0,0);applySpectralParts(gltf.scene,soul.userData.spectralParts);
if(actualHead.scale.distanceTo(new T.Vector3(1,1,1))>.001||chunks.some(c=>c.visible))throw Error('Head did not reassemble cleanly');
stoneZone.setPerformanceTime(4.4);stoneZone.update(0,0);applySpectralParts(gltf.scene,soul.userData.spectralParts);stoneZone.setParticipant();applySpectralParts(gltf.scene,soul.userData.spectralParts);
if(actualHead.scale.x!==1||soul.userData.spectralParts)throw Error('Head stayed broken after cancellation');
stoneZone.dispose();if(originalDisposed)throw Error('Station disposed the player material');
if(neckPullBeat(5.5).lift<2.8||!neckPullBeat(6.8).detached||neckPullBeat(6.8).dropped!==1||neckPullBeat(11).detached)throw Error('Neck did not stretch, separate and recover');
if(neckPullBeat(8.5).lift>=neckPullBeat(8.2).lift||neckPullBeat(8.95).lift<=neckPullBeat(8.55).lift||neckPullBeat(NECK_CYCLE_DURATION).lift!==0)throw Error('Head lacks spring recoil or loop reset');
const neckZone=buildVisitZone('floor-14',actor);let neckVictim:T.Object3D|undefined;neckZone.root.traverse(o=>{if(o.userData.role==='victim')neckVictim=o;});
neckZone.setParticipant(soul);const headRest=actualHead.position.clone();
const setNeckTime=(t:number)=>{neckZone.setPerformanceTime(t);neckZone.update(0,0);soul.position.copy(neckVictim!.position);soul.quaternion.copy(neckVictim!.quaternion);soul.scale.copy(neckVictim!.scale);applySpectralParts(gltf.scene,soul.userData.spectralParts);actualHead.updateWorldMatrix(true,false);return actualHead.getWorldPosition(new T.Vector3());};
const raisedHead=setNeckTime(5.5),bodyY=soul.position.y,freeHead=setNeckTime(6.8);
if(raisedHead.y<4.4||Math.abs(freeHead.y-raisedHead.y)>.01||soul.position.y>=bodyY-.25||neckZone.root.getObjectByName('stretching-neck')!.visible)throw Error('Head did not stay suspended when body detached');
for(const t of [8.3,8.55,8.95,10.5]){const p=setNeckTime(t),anchor=new T.Vector3(...soul.userData.spectralParts.headAnchor);if(p.distanceTo(anchor)>.001||actualHead.scale.x!==1)throw Error('Actual rig head missed spring trajectory');}
setNeckTime(8.4);if(!neckZone.root.getObjectByName('neck-recoil-spring')!.visible)throw Error('Recoil spring not visible');
neckZone.setParticipant();applySpectralParts(gltf.scene,soul.userData.spectralParts);
if(actualHead.position.distanceTo(headRest)>.001||soul.userData.spectralParts)throw Error('Stretched head did not restore after cancellation');neckZone.dispose();if(originalDisposed)throw Error('Neck station disposed player material');
const sounds=new Soundscape(),cues:string[]=[];sounds.enabled=true;sounds.cue=kind=>{cues.push(kind??'bell');};sounds.reaction=()=>{};sounds.setZone('floor-14');
for(let frame=0;frame<1600;frame++)sounds.tick(frame/100,0,-6,frame/100);
if(cues.filter(c=>c==='ratchet').length!==4||cues.filter(c=>c==='boing').length!==2||cues.filter(c=>c==='snip').length!==1)throw Error('Neck sounds do not match the choreography');
const cueCount=cues.length;sounds.enabled=false;sounds.tick(24.2,0,-6,24.2);if(cues.length!==cueCount)throw Error('Muted neck sound still plays');
console.log('OK: 18 experiences and queues; escorts; mask peeling; stone GLB fragments; actual rig neck stretch, body separation, spring recoil, cancellation, audio timing and material ownership.');
