import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {ChaosLedger,chaosTargets,type ChaosEvent} from '../shared/chaos.ts';
import {buildVisitZone} from '../src/world/underworld.ts';
import {GuardCostume} from '../src/world/guard-costume.ts';
import {UnderworldRoom,PlayerState} from '../server/src/UnderworldRoom.ts';

(globalThis as any).document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const factory=(kind:string,x:number,z:number,s=1)=>{const a=new T.Group();a.position.set(x,0,z);a.scale.setScalar(s);a.userData.assetId=kind;return a;};
const player=(zone:string,x=0,z=-5.8,id='tester')=>({id,zone,x,z,registered:true});
for(let floor=1;floor<=18;floor++){
 let now=100000;const zone=`floor-${floor}`,ledger=new ChaosLedger(),scene=buildVisitZone(zone,factory),chaos=scene.chaos!;
 const runner=new T.Group();runner.position.set(0,0,-1);
 chaos.configure(()=>runner,()=>{},()=>now);
 assert.deepEqual([...chaos.targets.keys()].sort(),chaosTargets(zone).map(t=>t.id).sort(),`Missing usable targets on floor ${floor}`);
 const guard=chaos.targets.get('guard-0')!,position=guard.actor!.position;
 const hit=ledger.request(player(zone,position.x,position.z),{action:'hit',target:'guard-0'},false,now);assert.ok(hit.event);
 assert.ok(chaos.receive(hit.event,now));assert.equal(chaos.receive(hit.event,now),false,'Duplicate event played twice');
 scene.update(10,1/60);const frozen=scene.animationTime;now+=100;scene.update(10.1,.1);assert.ok(Math.abs(scene.animationTime-frozen)<.001,'Stage did not pause');assert.equal(guard.actor!.userData.performanceClip,'flail');
 now+=1000;const pants=ledger.request(player(zone,position.x,position.z),{action:'pants',target:'guard-0'},false,now);assert.ok(pants.event);chaos.receive(pants.event,now);scene.update(11.1,.1);
 assert.equal(ledger.request(player(zone,position.x,position.z),{action:'hit',target:'guard-0'},false,now+50).event,undefined,'Cooldown was bypassed');
 now+=1000;const prop=chaos.targets.get('apparatus')!;assert.ok(prop.objects.length,`No actual props on floor ${floor}`);
 const first=ledger.request(player(zone),{action:'smash',target:'apparatus'},false,now);assert.equal(first.event?.hp,1);chaos.receive(first.event!,now);scene.update(12.1,.1);
 now+=800;const second=ledger.request(player(zone),{action:'smash',target:'apparatus'},false,now);assert.equal(second.event?.hp,0);chaos.receive(second.event!,now);scene.update(12.9,.1);assert.ok(prop.objects.every(o=>!o.visible),'Actual apparatus did not break');
 // A late viewer with a different device clock gets the same broken scene.
 const viewer=buildVisitZone(zone,factory);viewer.chaos!.configure(()=>undefined,()=>{},()=>now+5000);
 for(const event of ledger.snapshot(zone,now))viewer.chaos!.receive(event,now,true);
 viewer.update(12.9,1/60);assert.ok(viewer.chaos!.targets.get('apparatus')!.objects.every(o=>!o.visible),'Late viewer missed broken props');viewer.dispose();
 assert.ok(chaos.busy());now+=18001;scene.update(31,.1);
 const reference=buildVisitZone(zone,factory);reference.update(scene.animationTime,.1);
 assert.deepEqual(prop.objects.map(o=>o.visible),reference.chaos!.targets.get('apparatus')!.objects.map(o=>o.visible),`Apparatus did not recover to its authored phase on floor ${floor}`);reference.dispose();assert.equal(chaos.busy(),false);
 const crate=ledger.request(player(zone,-5.8,-2),{action:'smash',target:'crate-left'},false,now);assert.ok(crate.event,'Side crate not reachable');
 const elsewhere=buildVisitZone(`floor-${floor===18?1:floor+1}`,factory);assert.equal(elsewhere.chaos!.receive(second.event!,now),false,'Effect leaked between floors');elsewhere.dispose();
 scene.dispose();
}
const ledger=new ChaosLedger(),valid=player('floor-1',-2.2,-5);
assert.equal(chaosTargets('hall').length,0);
for(const p of [{...valid,registered:false},{...valid,zone:'hall'},{...valid,x:100},{...valid,x:NaN},{...valid,experiencing:true}])assert.ok(ledger.request(p,{action:'hit',target:'guard-0'},false,1000).reason);
assert.ok(ledger.request(valid,{action:'hit',target:'guard-0'},true,1000).reason,'Active participant was not protected');
assert.ok(ledger.request(valid,{action:'pants',target:'apparatus'},false,1000).reason);
assert.ok(ledger.request(valid,{action:'smash',target:'guard-0'},false,1000).reason);
const a=ledger.request(player('floor-1',0,-5.8,'a'),{action:'smash',target:'apparatus'},false,2000).event!;
const b=ledger.request(player('floor-1',0,-5.8,'b'),{action:'smash',target:'apparatus'},false,2000).event!;
assert.equal(a.hp,1);assert.equal(b.hp,0);assert.equal(ledger.snapshot('floor-1',2000).filter(e=>e.target==='apparatus').length,1,'Concurrent hits did not converge');assert.ok(ledger.snapshot('floor-1',2000).some(e=>e.reaction&&e.chaseUntil>2000),'Smashing did not alert guard');ledger.prune(22000);assert.equal(ledger.snapshot('floor-1',22000).length,0);

// Each costume is private to one cloned GLB, with real shorts covering the body.
for(const file of ['executioner-red','executioner-green','executioner-blue']){
 const bytes=await fs.readFile(`public/models/${file}.glb`),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const one=clone(gltf.scene),two=clone(gltf.scene);one.userData.assetId=file.endsWith('blue')?'guard-blue':'demon';
 let first:T.SkinnedMesh|undefined,other:T.SkinnedMesh|undefined;
 one.traverse(o=>{if(o instanceof T.SkinnedMesh&&!Array.isArray(o.material)&&o.material.name==='waistcloth')first=o;});two.traverse(o=>{if(o instanceof T.SkinnedMesh&&!Array.isArray(o.material)&&o.material.name==='waistcloth')other=o;});
 assert.ok(first&&other);const original=first.geometry,ys=Array.from(original.getAttribute('position').array);assert.equal(other.geometry,original);
 const costume=new GuardCostume(one);costume.update(1);assert.notEqual(first.geometry,original);assert.equal(other.geometry,original);assert.deepEqual(Array.from(original.getAttribute('position').array),ys);
 assert.ok(one.getObjectByName('heart-boxers')?.visible,'Boxers missing');assert.ok(first.geometry.getAttribute('position').getY(0)<original.getAttribute('position').getY(0)-.3,'Cloth did not lower');
 costume.update(0);assert.equal(one.getObjectByName('heart-boxers')?.visible,false);costume.dispose();assert.equal(first.geometry,original);
}
// Real room message handlers, without opening a network socket.
const makeRoom=()=>{
 const room=new UnderworldRoom(),inboxes=new Map<string,{type:string;payload:any}[]>();
 for(const [id,zone] of [['a','floor-1'],['b','floor-1'],['c','floor-2']]){const inbox:{type:string;payload:any}[]=[];inboxes.set(id,inbox);const client={sessionId:id,send:(type:string,payload:any)=>inbox.push({type,payload})};room.clients.push(client as any);room.state.players.set(id,new PlayerState({zone,x:-2.2,z:-5,registered:true}));}
 return {room,inboxes,client:(id:string)=>room.clients.find(c=>c.sessionId===id)!};
};
const live=makeRoom();live.room.messages['chaos:action'](live.client('a'),{action:'hit',target:'guard-0'});
assert.equal(live.inboxes.get('a')!.filter(m=>m.type==='chaos:event').length,1);assert.equal(live.inboxes.get('b')!.filter(m=>m.type==='chaos:event').length,1);assert.equal(live.inboxes.get('c')!.length,0,'Room broadcast leaked into another floor');
live.room.messages['chaos:sync'](live.client('b'));assert.equal(live.inboxes.get('b')!.at(-1)?.payload.events.length,1);
live.room.messages['experience:start'](live.client('b'));assert.equal(live.inboxes.get('b')!.at(-1)?.payload.accepted,false,'Experience began during chaos');
const occupied=makeRoom();occupied.room.messages['experience:start'](occupied.client('b'));assert.ok(occupied.inboxes.get('b')!.at(-1)?.payload.accepted);
occupied.room.messages['chaos:action'](occupied.client('a'),{action:'hit',target:'guard-0'});assert.equal(occupied.inboxes.get('a')!.at(-1)?.type,'chaos:rejected');assert.equal(occupied.inboxes.get('b')!.filter(m=>m.type==='chaos:event').length,0,'Real participant was interrupted');
console.log('OK: all 18 floors, real targets, pause/recovery, snapshots/clock offsets, concurrent damage, isolated GLB costumes; actual room broadcasts, late sync and occupied-station rules.');
