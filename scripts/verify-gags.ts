import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {CHARACTERS,characterAsset,type ActorKind} from '../src/world/characters.ts';
import {buildVisitZone} from '../src/world/underworld.ts';
import {applySpectralParts,captureSpectralRig} from '../src/world/spectral-parts.ts';
import {dismemberParts,pestleBeat,tongueBeat} from '../src/world/punishment-beats.ts';
import {punishmentEffectState,PunishmentVFX} from '../src/world/punishment-vfx.ts';
import {Soundscape} from '../src/world/soundscape.ts';

(globalThis as any).document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const models=new Map<string,GLTF>();for(const a of CHARACTERS){const b=await fs.readFile(`public/models/${a.file}.glb`);models.set(a.id,await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));}
const requested=[1,2,3,4,5,7,10,12,15,17];
function fixture(floor:number){
 const rigs:{root:T.Group;mixer:T.AnimationMixer;actions:Map<string,T.AnimationAction>}[]=[];
 const factory=(kind:ActorKind,x:number,z:number,s=1)=>{const a=characterAsset(kind),src=models.get(kind)!,visual=clone(src.scene);visual.scale.setScalar(a.height/new T.Box3().setFromObject(visual).getSize(new T.Vector3()).y);captureSpectralRig(visual);const root=new T.Group();root.userData.assetId=kind;root.position.set(x,0,z);root.scale.setScalar(s);root.add(visual);rigs.push({root,mixer:new T.AnimationMixer(visual),actions:new Map()});const rig=rigs.at(-1)!;src.animations.forEach(c=>rig.actions.set(c.name,rig.mixer.clipAction(c)));return root;};
 const zone=buildVisitZone(`floor-${floor}`,factory),player=factory('spirit',0,0),scene=new T.Scene();scene.add(zone.root,player);zone.setParticipant(player);let victim:T.Object3D|undefined;zone.root.traverse(o=>{if(o.userData.role==='victim')victim=o;});
 const pose=(t:number)=>{
  zone.setPerformanceTime(t);zone.update(t,0);victim!.updateWorldMatrix(true,false);victim!.matrixWorld.decompose(player.position,player.quaternion,player.scale);player.userData.performanceClip=victim!.userData.performanceClip??'glide_walk';player.userData.performanceSpeed=victim!.userData.performanceSpeed??1;zone.update(t,0);
  for(const rig of rigs){const action=rig.actions.get(rig.root.userData.performanceClip??'idle')??rig.actions.get('idle')!;rig.mixer.stopAllAction();action.reset().play();action.time=t*(rig.root.userData.performanceSpeed??1)%action.getClip().duration;rig.mixer.update(0);applySpectralParts(rig.mixer.getRoot(),rig.root.userData.spectralParts);}
  zone.finishFrame();scene.updateMatrixWorld(true);return player;
 };
 return {zone,player,scene,pose};
}
for(const floor of requested){const f=fixture(floor);for(let i=0;i<240;i++){f.pose(i/12);f.zone.root.traverse(o=>{assert.ok(o.position.toArray().every(Number.isFinite));assert.ok(o.scale.toArray().every(Number.isFinite));if(o instanceof T.InstancedMesh)assert.ok(o.count<=o.instanceMatrix.count);});}f.zone.setParticipant();applySpectralParts(f.player.children[0],f.player.userData.spectralParts);const head=f.player.getObjectByName('Head')!,body=f.player.getObjectByName('Body')!;assert.ok(head.scale.distanceTo(new T.Vector3(1,1,1))<.001);assert.ok(body.scale.distanceTo(new T.Vector3(1,1,1))<.001);f.zone.dispose();}
const tongue=fixture(1);tongue.pose(5.5);const g=(tongue.zone.root.getObjectByName('stretching-tongue') as T.Mesh).geometry;g.computeBoundingBox();assert.ok(g.boundingBox!.max.x-g.boundingBox!.min.x>2,'Tongue was not stretched');const mouth=new T.Vector3(0,.115,.329).applyMatrix4(tongue.player.getObjectByName('Head')!.matrixWorld);assert.ok(Math.abs(g.boundingBox!.max.x-mouth.x)<.001,'Tongue does not track animated mouth');assert.ok(tongueBeat(8.9).recoil>.4);tongue.zone.dispose();
const scissors=fixture(2);scissors.pose(7.5);let sockets=0;scissors.player.traverse(o=>{if(o.name.startsWith('torn-socket-')&&o.visible)sockets++;});assert.ok(sockets>=5,'Severed limb sockets missing');scissors.zone.dispose();
const tree=fixture(3);tree.pose(7);const treeGuard=tree.zone.chaos!.targets.get('guard-0')!.actor!;assert.ok(treeGuard.position.y>1.5&&treeGuard.userData.performanceClip==='flail','Tree guard did not get snagged');tree.zone.dispose();
const mask=fixture(4);mask.pose(7.3);assert.ok(mask.zone.root.getObjectByName('peeling-tissue-2-0')!.visible,'Peeling tissue is missing');mask.zone.dispose();
const steam=fixture(5);steam.pose(6);assert.ok(steam.player.scale.x>1.35,'Steamed soul did not inflate');steam.pose(8);assert.ok(steam.player.scale.x<1.1&&steam.zone.root.getObjectByName('steam-fan')!.position.y>2.7,'Steam vent gag missing');steam.zone.dispose();
const ox=fixture(10);ox.pose(5.9);ox.pose(6.4);assert.ok(ox.player.position.y>2,'Ox did not launch player');ox.pose(7.5);assert.ok(ox.player.getObjectByName('Head')!.getWorldPosition(new T.Vector3()).y<.4,'Player did not land head-first');ox.zone.dispose();
const mortar=fixture(12);mortar.pose(1.47);assert.ok(mortar.player.scale.y<.5,'Pestle did not squash player');mortar.pose(1.7);assert.ok(mortar.player.userData.spectralParts.head>.1,'Head did not bounce back');assert.ok(Math.abs(pestleBeat(1.999).height-pestleBeat(0).height)<.01);mortar.zone.dispose();
const split=fixture(15);split.pose(5.5);assert.ok(split.player.userData.spectralParts.left>1.5);const rope=split.zone.root.getObjectByName('dismember-rope-1-1')!;const endpoint=new T.Vector3(0,.5,0).applyMatrix4(rope.matrixWorld),hand=split.player.getObjectByName('LeftHand')!.getWorldPosition(new T.Vector3());assert.ok(endpoint.distanceTo(hand)<.001,'Rope detached from torn hand');split.pose(11.8);assert.ok(split.player.userData.spectralParts.left<.01,'Dismembered player did not reassemble');split.zone.dispose();
const mill=fixture(17);mill.pose(5);assert.ok(mill.zone.root.getObjectByName('ground-soul-ribbon-0')!.scale.z>.8,'Mill ribbons missing');mill.pose(11.8);assert.equal(mill.zone.root.getObjectByName('ground-soul-ribbon-0')!.visible,false);mill.zone.dispose();
for(const [floor,time] of [[1,2.2],[2,3.2],[3,6.7],[4,7.2],[7,9.3],[10,6.1],[12,5.6],[15,4.1],[17,5.4]])assert.ok(Number.isFinite(punishmentEffectState(floor,time).bloodAge),`No floor-specific blood on ${floor}`);
assert.equal(dismemberParts(0).left,0);assert.ok(dismemberParts(5).left>1.5);assert.equal(dismemberParts(11.9).left,0);
const audio=new Soundscape(),cues:string[]=[];audio.enabled=true;audio.cue=kind=>{cues.push(kind??'bell');};audio.setZone('floor-12');for(let frame=0;frame<1200;frame++)audio.tick(frame/100,0,-6,frame/100);assert.equal(cues.filter(c=>c==='crush').length,6);assert.equal(cues.filter(c=>c==='boing').length,6);
console.log('OK: all 10 requested floor choreographies on real rigs; tongue contact, severed sockets, snag/steam/ox/pestle gags, attached pulling ropes, mill ribbons, blood timings and restoration.');
