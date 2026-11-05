import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createDanceClips} from '../src/world/dances.ts';
import {buildBarZone} from '../src/world/bar.ts';
import {WalkMap,ClickNavigator} from '../src/world/navigation.ts';
import {Soundscape} from '../src/world/soundscape.ts';
import {StableCameraRig} from '../src/world/camera-rig.ts';
import {projectWorldPoint} from '../src/world/world-ui.ts';
import {CHARACTERS} from '../src/world/characters.ts';
import {BAR_BPM,BAR_TRACK_SECONDS,DANCES,isDance,barSeconds} from '../shared/bar.ts';
import {UnderworldRoom,PlayerState} from '../server/src/UnderworldRoom.ts';

assert.equal(BAR_BPM,120);assert.equal(barSeconds(32000),0);assert.equal(barSeconds(32500),.5);
assert.equal(isDance('flail'),false);assert.equal(isDance({id:'dance-spin'}),false);
assert.equal(DANCES.filter(d=>d.group==='street').length,5);
for(const [width,height] of [[320,568],[390,844],[844,390]]){
 const camera=new T.PerspectiveCamera(43,width/height,.1,160),rig=new StableCameraRig(),p=new T.Vector3(0,0,1);rig.reset(p);
 for(let i=0;i<240;i++)rig.update(camera,p,1/60,undefined,true);
 const head=projectWorldPoint(p.clone().add(new T.Vector3(0,1.5,0)),camera,width,height),feet=projectWorldPoint(p,camera,width,height);assert.ok(head&&feet);
 if(width<height)assert.ok(feet.y<height-170,'Dancer is hidden by mobile controls');else assert.ok(feet.x<width-380,'Dancer is hidden by the landscape panel');
 const orientation=camera.quaternion.clone();for(let i=0;i<120;i++){p.x+=.01;p.z-=.02;rig.update(camera,p,1/60,undefined,true);assert.ok(camera.quaternion.angleTo(orientation)<.0001,'Bar camera rotated while walking');}
}
for(const asset of CHARACTERS.filter(a=>!['hound','ox'].includes(a.id))){
 const bytes=await fs.readFile(`public/models/${asset.file}.glb`),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const clips=createDanceClips(gltf.scene),mixer=new T.AnimationMixer(gltf.scene);assert.equal(clips.length,DANCES.length);
 const signatures=new Set<string>();
 for(const clip of clips){
  assert.ok(clip.validate());assert.equal(clip.duration,4);
  for(const track of clip.tracks){assert.ok(Array.from(track.values).every(Number.isFinite));if(track instanceof T.QuaternionKeyframeTrack){const a=new T.Quaternion().fromArray(track.values,0),b=new T.Quaternion().fromArray(track.values,track.values.length-4);assert.ok(a.angleTo(b)<.001,`${clip.name} has a visible loop seam`);}}
  mixer.stopAllAction();const action=mixer.clipAction(clip).play(),previous=new Map<string,T.Quaternion>();
  for(let frame=0;frame<480;frame++){
   action.time=frame/120;mixer.update(0);gltf.scene.updateMatrixWorld(true);
   gltf.scene.traverse(o=>{if(!(o instanceof T.Bone))return;assert.ok(Number.isFinite(o.position.length()+o.quaternion.length()));const q=previous.get(o.name);if(q)assert.ok(q.angleTo(o.quaternion)<.25,`${asset.id}/${clip.name} jerks on ${o.name}`);previous.set(o.name,o.quaternion.clone());});
  }
  action.time=.375;mixer.update(0);signatures.add(['Body','LeftArm','RightArm','Root'].map(name=>gltf.scene.getObjectByName(name)!.quaternion.toArray().map(n=>n.toFixed(3)).join(',')).join('|'));
 }
 assert.equal(signatures.size,DANCES.length,'Dance styles have identical poses');
 mixer.stopAllAction();mixer.update(0);assert.ok(gltf.scene.getObjectByName('Root')!.position.length()<.0001,'Dance offsets survived stop');
 // Switching styles uses a real mixer fade, including the spinning root.
 const first=mixer.clipAction(clips[4]).play();mixer.update(.5);const arm=gltf.scene.getObjectByName('LeftArm')!;let q=arm.quaternion.clone();
 first.fadeOut(.22);mixer.clipAction(clips[2]).reset().fadeIn(.22).play();
 for(let f=0;f<40;f++){mixer.update(1/120);assert.ok(q.angleTo(arm.quaternion)<.35,'Crossfade snapped the arm');q.copy(arm.quaternion);}
 mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
}

(globalThis as any).document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const actor=(kind:string,x:number,z:number,s=1)=>{const a=new T.Group();a.userData.assetId=kind;a.position.set(x,0,z);a.scale.setScalar(s);return a;};
let now=0;const bar=buildBarZone(actor,()=>now),map=new WalkMap(bar.bounds,bar.obstacles),roles:string[]=[];
bar.root.traverse(o=>{if(o.userData.role)roles.push(o.userData.role);});assert.ok(roles.includes('bartender')&&roles.includes('dj'));assert.equal(roles.filter(r=>r==='dancer').length,5);
for(const target of [new T.Vector3(0,0,-2.7),new T.Vector3(-4.4,0,-2.2),new T.Vector3(5,0,.6),new T.Vector3(0,0,7.4)]){
 const nav=new ClickNavigator(map),p=new T.Vector3(0,0,5.5);assert.ok(nav.go(p,target));
 for(let f=0;f<1600&&nav.active;f++){nav.step(p,1/60);assert.ok(map.free(p.x,p.z),'Bar route entered the counter or DJ platform');}assert.ok(!nav.active&&p.distanceTo(target)<.1,'Bar route did not arrive');
}
for(let frame=0;frame<1000;frame++){now=frame/30;bar.update(now,1/30);bar.root.traverse(o=>assert.ok(Number.isFinite(o.position.length()+o.scale.length())));}
const owned:T.Mesh[]=[];bar.root.traverse(o=>{if(o instanceof T.Mesh)owned.push(o);});let disposed=0;owned.forEach(o=>o.geometry.addEventListener('dispose',()=>disposed++));bar.dispose();assert.equal(disposed,owned.length);

const room=new UnderworldRoom(),received=new Map<string,{type:string;payload:any}[]>();
const client=(id:string)=>{const list:{type:string;payload:any}[]=[];received.set(id,list);const c={sessionId:id,enqueueRaw(){},send:(type:string,payload:any)=>list.push({type,payload})};room.clients.push(c as any);room.state.players.set(id,new PlayerState({ticket:room.clients.length}));return c as any;};
const a=client('one'),b=client('two');
room.messages.zone(a,{zone:'bar'});assert.equal(room.state.players.get('one')!.zone,'registry','Unregistered visitor entered the bar');
for(const c of [a,b]){room.messages.register(c,{name:`Vong ${c.sessionId}`});room.messages.zone(c,{zone:'bar'});}
room.messages.move(a,{clip:'dance-hands',moving:false});room.messages.move(b,{clip:'dance-spin',moving:false});assert.equal(room.state.players.get('one')!.clip,'dance-hands');assert.equal(room.state.players.get('two')!.clip,'dance-spin');
room.messages['bar:sync'](a,{sentAt:123});assert.equal(received.get('one')!.at(-1)!.type,'bar:clock');assert.equal(received.get('one')!.at(-1)!.payload.sentAt,123);
room.messages['experience:start'](a);assert.equal(received.get('one')!.at(-1)!.payload.accepted,false,'Bar accepted punishment experience');
room.messages.move(a,{clip:'dance-hands',moving:true});assert.equal(room.state.players.get('one')!.clip,'','Walking retained dance');
room.messages.move(a,{clip:'anything',moving:false});assert.equal(room.state.players.get('one')!.clip,'');
room.messages.zone(b,{zone:'hall'});assert.equal(room.state.players.get('two')!.clip,'','Leaving bar retained dance');room.messages.move(b,{clip:'dance-spin'});assert.equal(room.state.players.get('two')!.clip,'','Dancing leaked into a punishment zone');

class FakeAudio {
 currentTime=0;duration=32;loop=false;volume=0;paused=false;constructor(public src:string){}
 getAttribute(){return this.src;}addEventListener(){}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}
}
(globalThis as any).Audio=FakeAudio;
const sound=new Soundscape();sound.enabled=true;sound.setMood('bar');sound.setZone('bar');const music=(sound as any).music as FakeAudio;
assert.equal(music.src,'/audio/music/bar.m4a');assert.equal(music.loop,true);assert.ok(Math.abs(music.currentTime-barSeconds())<.1);
sound.setBarClockOffset(2500);assert.ok(Math.abs(music.currentTime-barSeconds(Date.now()+2500))<.1);let cues=0;sound.cue=()=>cues++;sound.tick(10,0,0);assert.equal(cues,0,'Punishment noises played over bar music');
await sound.toggle();assert.equal(music.paused,true);assert.equal(sound.enabled,false);

const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=channels','-of','json','public/audio/music/bar.m4a'],{encoding:'utf8'});assert.equal(probe.status,0);const info=JSON.parse(probe.stdout);assert.ok(Math.abs(Number(info.format.duration)-BAR_TRACK_SECONDS)<.1);assert.equal(info.streams[0].channels,2);
const decode=spawnSync('ffmpeg',['-v','error','-i','public/audio/music/bar.m4a','-t','2','-f','f32le','-acodec','pcm_f32le','-']);assert.equal(decode.status,0);let energy=0,difference=0;for(let i=0;i<decode.stdout.length;i+=8){const l=decode.stdout.readFloatLE(i),r=decode.stdout.readFloatLE(i+4);energy+=l*l+r*r;difference+=Math.abs(l-r);}assert.ok(Math.sqrt(energy/(decode.stdout.length/4))>.06,'Bar music is silent');assert.ok(difference/(decode.stdout.length/8)>.005,'Bar mix lost stereo');
console.log(`OK: ${DANCES.length} seamless dances on 13 real rigs, per-frame continuity/crossfades/restoration, walkable bar and disposal, two-player dance state/clock/stop/zone rules, synced/muted music and stereo 32s asset.`);
