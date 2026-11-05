import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {buildVisitZone,FLOORS} from '../src/world/underworld.ts';
import {CHARACTERS,characterAsset,type ActorKind} from '../src/world/characters.ts';
import {PunishmentExperience} from '../src/world/experience.ts';
import {EXPERIENCE_PROFILES} from '../src/world/experience-profiles.ts';
import {applySpectralParts,captureSpectralRig} from '../src/world/spectral-parts.ts';
// @ts-ignore: local CPU renderer
import {SoftwareRenderer,savePNG} from './software-renderer.mjs';

(globalThis as any).document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const models=new Map<string,GLTF>();
for(const a of CHARACTERS){const b=await fs.readFile(`public/models/${a.file}.glb`);models.set(a.id,await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));}
const width=480,height=270,renderer=new SoftwareRenderer(width,height),overview=Buffer.alloc(width*3*height*6*3);
await fs.mkdir('public/assets/experience',{recursive:true});
for(let index=0;index<18;index++){
 const actors:{root:T.Group;mixer:T.AnimationMixer;actions:Map<string,T.AnimationAction>}[]=[];
 const actor=(kind:ActorKind,x:number,z:number,s=1)=>{
  const asset=characterAsset(kind),source=models.get(kind)!,visual=clone(source.scene),bounds=new T.Box3().setFromObject(visual);visual.scale.setScalar(asset.height/(bounds.max.y-bounds.min.y));
  captureSpectralRig(visual);const root=new T.Group();root.add(visual);root.position.set(x,0,z);root.scale.setScalar(s);root.userData.isActor=true;root.userData.assetId=kind;
  const mixer=new T.AnimationMixer(visual);actors.push({root,mixer,actions:new Map(source.animations.map(c=>[c.name,mixer.clipAction(c)]))});return root;
 };
 const zone=buildVisitZone(`floor-${index+1}`,actor),scene=new T.Scene();scene.add(zone.root);let victim:T.Object3D|undefined;zone.root.traverse(o=>{if(o.userData.role==='victim')victim=o;});
 const player=actor('spirit',0,5.5,1);scene.add(player);const exp=new PunishmentExperience();let time=0;
 exp.startRun({player,victim:victim!,root:zone.root,bounds:zone.bounds,obstacles:zone.obstacles,profile:EXPERIENCE_PROFILES[index],stageTime:t=>{zone.setPerformanceTime(t);zone.update(time,0);},participant:a=>zone.setParticipant(a),createGuard:()=>actor('demon',-6.8,-.8,1.1),status(){},reaction(){},cleanup(){},finish(){}});
 while(exp.phase!=='performing'&&time<50){time+=1/30;zone.update(time,1/30);exp.update(1/30,time);}
 while(zone.animationTime<EXPERIENCE_PROFILES[index].duration*(index===1?.70:index===3?.58:index===10?.37:index===13?.35:.45)){time+=1/30;zone.update(time,1/30);exp.update(1/30,time);}
 for(const a of actors){const clip=a.root.userData.performanceClip??(a.root.userData.moving?'walk':'idle'),action=a.actions.get(clip)??a.actions.get('idle')!;action.play();action.time=((zone.animationTime+(a.root.userData.phase??0))*(a.root.userData.performanceSpeed??1))%action.getClip().duration;a.mixer.update(0);applySpectralParts(a.mixer.getRoot(),a.root.userData.spectralParts);}
 const camera=new T.PerspectiveCamera(43,width/height,.1,100),shot=exp.cameraHint()!;camera.position.copy(shot.position);camera.lookAt(shot.target);
 const rgb=renderer.render(scene,camera,FLOORS[index].color),name=`floor-${String(index+1).padStart(2,'0')}`;
 await savePNG(`public/assets/experience/${name}.png`,rgb,width,height);
 const column=index%3,row=Math.floor(index/3),stride=width*3*3;for(let y=0;y<height;y++)rgb.copy(overview,((row*height+y)*stride)+column*width*3,y*width*3,(y+1)*width*3);
 exp.cancel();zone.dispose();console.log(`${name}: actual player posed and framed`);
}
await savePNG('public/assets/experience/overview.png',overview,width*3,height*6);
