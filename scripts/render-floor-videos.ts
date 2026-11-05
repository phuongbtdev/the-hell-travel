import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { buildVisitZone, FLOORS } from '../src/world/underworld.ts';
import { characterAsset, type ActorKind } from '../src/world/characters.ts';
import { EXPERIENCE_PROFILES } from '../src/world/experience-profiles.ts';
import { applySpectralParts,captureSpectralRig } from '../src/world/spectral-parts.ts';
import {stoneCameraShake,stoneCameraShot} from '../src/world/stone-crush.ts';
import {neckCameraShot} from '../src/world/neck-pull.ts';
import {EFFECT_FLOORS} from '../src/world/punishment-vfx.ts';
import {FLOOR_REVIEW_TIMES} from '../src/world/review-times.ts';
// @ts-ignore: local build-time renderer authored in JavaScript
import { SoftwareRenderer, savePNG } from './software-renderer.mjs';

(globalThis as any).document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const models=new Map<string,GLTF>();
for(const file of ['spirit','spirit-round','spirit-hat','spirit-female','traveler-male','traveler-female','penitent','executioner-red','executioner-blue','executioner-green','diem-vuong','clerk','demon-ox']){
  const b=await fs.readFile(`public/models/${file}.glb`);models.set(file,await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));
}
const width=512,height=288,renderer=new SoftwareRenderer(width,height);
await fs.mkdir('public/video/floors',{recursive:true});
const selection=process.argv.find(a=>a.startsWith('--floor=')||a.startsWith('--floors='))?.split('=')[1];
const only=selection?new Set(selection.split(',').map(Number)):undefined;
for(let index=0;index<18;index++){
  if(only&&!only.has(index+1))continue;
  const actors:{root:T.Group;mixer:T.AnimationMixer;actions:Map<string,T.AnimationAction>;current?:T.AnimationAction}[]=[];
  const factory=(kind:ActorKind,x:number,z:number,scale=1)=>{
    const asset=characterAsset(kind),source=models.get(asset.file)!;if(!source)throw Error(`No ${asset.file}`);
    const visual=clone(source.scene),bounds=new T.Box3().setFromObject(visual);visual.scale.setScalar(asset.height/(bounds.max.y-bounds.min.y));
    captureSpectralRig(visual);
    const root=new T.Group();root.add(visual);root.position.set(x,0,z);root.scale.setScalar(scale);root.userData.isActor=true;
    const mixer=new T.AnimationMixer(visual);actors.push({root,mixer,actions:new Map(source.animations.map(c=>[c.name,mixer.clipAction(c)]))});return root;
  };
  const zone=buildVisitZone(`floor-${index+1}`,factory),scene=new T.Scene();scene.add(zone.root);
  const camera=new T.PerspectiveCamera(index===17?48:46,width/height,.1,100);camera.position.set(index===17?3.3:4.7,index===17?3.0:4.2,index===17?-1.7:.5);camera.lookAt(0,index===17?1.05:1.85,-6);
  const number=String(index+1).padStart(2,'0'),output=`public/video/floors/floor-${number}.mp4`;
  const forward=EFFECT_FLOORS.includes(index+1)||[3,10,13].includes(index);
  const filter=forward?'[0:v]format=yuv420p[v]':'[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,format=yuv420p[v]';
  const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',`${width}x${height}`,'-r','12','-i','pipe:0','-filter_complex',filter,'-map','[v]','-c:v','libx264','-preset','veryfast','-crf','23','-movflags','+faststart',output],{stdio:['pipe','ignore','pipe']});
  let error='';ff.stderr.on('data',d=>error+=d);const done=once(ff,'close');
  for(let frame=0;frame<(forward?EXPERIENCE_PROFILES[index].duration*12:36);frame++){
    const t=frame/12;zone.update(t,1/12);
    if(index!==17){const profile=EXPERIENCE_PROFILES[index];camera.position.set(...profile.camera);let victim:T.Object3D|undefined;zone.root.traverse(o=>{if(o.userData.role==='victim')victim=o;});camera.lookAt(profile.fixedFocus?new T.Vector3(...profile.fixedFocus):victim!.getWorldPosition(new T.Vector3()).add(new T.Vector3(...profile.focusOffset)));}
    for(const actor of actors){const name=actor.root.userData.performanceClip??(actor.root.userData.moving?'walk':'idle');const action=actor.actions.get(name)??actor.actions.get('glide_walk')??actor.actions.get('idle')!;if(actor.current!==action){actor.current?.stop();action.reset().play();actor.current=action;}action.time=((t+(actor.root.userData.phase??0))*(actor.root.userData.performanceSpeed??1))%action.getClip().duration;actor.mixer.update(0);applySpectralParts(actor.mixer.getRoot(),actor.root.userData.spectralParts);}
    zone.finishFrame();
    if(index===10){const shot=stoneCameraShot(t);camera.position.copy(shot.position).add(stoneCameraShake(t));camera.lookAt(shot.target);}
    if(index===13){const shot=neckCameraShot(t);camera.position.copy(shot.position);camera.lookAt(shot.target);}
    const rgb=renderer.render(scene,camera,FLOORS[index].color);
    if(frame===(forward?Math.round(FLOOR_REVIEW_TIMES[index]*12):0))await savePNG(`public/video/floors/floor-${number}.png`,rgb,width,height);
    if(!ff.stdin.write(rgb))await once(ff.stdin,'drain');
  }
  ff.stdin.end();const [code]=await done;if(code!==0)throw Error(error);zone.dispose();console.log(`${number} ${FLOORS[index].name}: ${output}`);
}
