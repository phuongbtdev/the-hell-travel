import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CHARACTERS} from '../src/world/characters.ts';
import {buildVisitZone,FLOORS} from '../src/world/underworld.ts';
import {floorNarration,judgeVerdict} from '../src/world/dialogue.ts';
import {Subtitles,paginateDialogue} from '../src/world/subtitles.ts';

(globalThis as any).document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
for(const c of CHARACTERS){
 const b=await fs.readFile(`public/models/${c.file}.glb`),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const skins:T.SkinnedMesh[]=[];g.scene.traverse(o=>{if(o instanceof T.SkinnedMesh)skins.push(o);});
 if(!skins.length||g.animations.length!==18)throw Error(`Missing skin/clips: ${c.id}`);
 const mixer=new T.AnimationMixer(g.scene);
 for(const clip of g.animations){
  if(!clip.validate())throw Error(`Invalid animation: ${c.id}/${clip.name}`);
  mixer.stopAllAction();mixer.clipAction(clip).reset().play();mixer.update(.5);g.scene.updateMatrixWorld(true);
  for(const skin of skins){skin.skeleton.update();const v=new T.Vector3().fromBufferAttribute(skin.geometry.attributes.position,0);skin.applyBoneTransform(0,v);if(!Number.isFinite(v.length()))throw Error('Invalid deformation');}
 }
}
const actor=(kind:string,x:number,z:number,scale=1)=>{const a=new T.Group();a.position.set(x,0,z);a.scale.setScalar(scale);a.userData.assetId=kind;a.userData.isActor=true;return a;};
for(let i=0;i<18;i++){
 const zone=buildVisitZone(`floor-${i+1}`,actor);let victim=false;
 zone.root.traverse(o=>{if(o.userData.role==='victim'&&(o.userData.performanceClip||o.userData.moving))victim=true;});
 if(!victim)throw Error(`No animated victim: floor ${i+1}`);
 for(let f=0;f<180;f++)zone.update(f/30,1/30);
 zone.root.traverse(o=>{if(!Number.isFinite(o.position.length()+o.scale.length()))throw Error('Invalid performance transform');});zone.dispose();
 if(floorNarration(i,FLOORS[i].name).length<3)throw Error('Missing narration');
 const file=`public/video/floors/floor-${String(i+1).padStart(2,'0')}.mp4`;
 const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',file],{encoding:'utf8'});
 if(probe.status||Number(probe.stdout)<5.9)throw Error(`Bad clip ${file}`);
 const decode=spawnSync('ffmpeg',['-v','error','-i',file,'-f','framemd5','-'],{encoding:'utf8'});
 const hashes=new Set(decode.stdout.split('\n').filter(l=>l.startsWith('0,')).map(l=>l.split(',').pop()));
 if(decode.status||hashes.size<8)throw Error(`Clip does not animate: ${file}`);
}
for(const mood of ['hall','wind','fire','metal','ice','water','stone','beast']){
 const r=spawnSync('ffmpeg',['-v','info','-i',`public/audio/music/${mood}.m4a`,'-af','volumedetect','-f','null','-'],{encoding:'utf8'});
 const level=Number(r.stderr.match(/mean_volume: (-?[\d.]+)/)?.[1]);if(r.status||!Number.isFinite(level)||level < -40)throw Error(`Silent/invalid music: ${mood}`);
}
for(let i=0;i<18;i++){
 const lines=floorNarration(i,FLOORS[i].name),pages=paginateDialogue(lines);
 if(pages.some(p=>p.text.length>160))throw Error('Subtitle page too long');
 const normalized=(text:string)=>text.replace(/\s+/gu,' ').trim();
 if(normalized(pages.map(p=>p.text).join(' '))!==normalized(lines.map(p=>p.text).join(' ')))throw Error('Subtitle pagination lost story text');
}
const fake=()=>({textContent:'',scrollTop:0,offsetHeight:150,disabled:false,inert:false,classList:{toggle(){}},setAttribute(){},addEventListener(){}});
const elements:any={panel:fake(),speaker:fake(),text:fake(),progress:fake(),previous:fake(),next:fake(),close:fake()};
(globalThis as any).document.body={style:{setProperty(){}}};
const subtitles=new Subtitles(elements),lines=floorNarration(17,FLOORS[17].name),pages=paginateDialogue(lines);
subtitles.show(lines);
if(!subtitles.visible||elements.text.textContent!==pages[0].text||!elements.previous.disabled)throw Error('Initial subtitle state failed');
subtitles.next();subtitles.previous();if(elements.text.textContent!==pages[0].text)throw Error('Cannot revisit subtitle');
for(let i=0;i<pages.length;i++)subtitles.next();if(subtitles.visible||!elements.panel.inert)throw Error('Subtitles did not close');
const audioSource=await fs.readFile('src/world/soundscape.ts','utf8');if(/speechSynthesis|SpeechSynthesisUtterance/.test(audioSource))throw Error('Voice synthesis remains enabled');
if(judgeVerdict(1,18)[0].text===judgeVerdict(1,0)[0].text)throw Error('Completion verdict does not change');
console.log('OK: character/media assets; complete paginated Vietnamese subtitles; previous/next/close; no speech synthesis; changing verdict.');
