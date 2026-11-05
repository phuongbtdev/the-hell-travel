import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {buildVisitZone,FLOORS} from '../src/world/underworld.ts';
import {CHARACTERS,characterAsset,type ActorKind} from '../src/world/characters.ts';
import {ChaosLedger} from '../shared/chaos.ts';
import {applySpectralParts,captureSpectralRig} from '../src/world/spectral-parts.ts';
// @ts-ignore: local build-time renderer
import {SoftwareRenderer,savePNG} from './software-renderer.mjs';

(globalThis as any).document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const models=new Map<string,GLTF>();
for(const a of CHARACTERS){const b=await fs.readFile(`public/models/${a.file}.glb`);models.set(a.id,await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));}
const width=480,height=320,renderer=new SoftwareRenderer(width,height),overview=Buffer.alloc(width*3*height*3);
await fs.mkdir('public/assets/chaos',{recursive:true});
for(let i=0;i<3;i++){
 const actors:{root:T.Group;mixer:T.AnimationMixer;actions:Map<string,T.AnimationAction>}[]=[];
 const actor=(kind:ActorKind,x:number,z:number,scale=1)=>{
  const asset=characterAsset(kind),source=models.get(kind)!,visual=clone(source.scene),bounds=new T.Box3().setFromObject(visual);visual.scale.setScalar(asset.height/(bounds.max.y-bounds.min.y));captureSpectralRig(visual);
  const root=new T.Group();root.userData.assetId=kind;root.position.set(x,0,z);root.scale.setScalar(scale);root.add(visual);
  const mixer=new T.AnimationMixer(visual);actors.push({root,mixer,actions:new Map(source.animations.map(c=>[c.name,mixer.clipAction(c)]))});return root;
 };
 let now=100000;const zone=buildVisitZone(`floor-${i+1}`,actor),scene=new T.Scene();scene.add(zone.root);zone.chaos!.configure(()=>undefined,()=>{},()=>now);
 const guard=zone.chaos!.targets.get('guard-0')!.actor!,ledger=new ChaosLedger(),reply=ledger.request({id:'tester',zone:`floor-${i+1}`,x:guard.position.x,z:guard.position.z,registered:true},{target:'guard-0',action:'pants'},false,now);
 zone.chaos!.receive(reply.event!,now);now+=900;zone.update(.9,.03);
 for(const a of actors){const name=a.root.userData.performanceClip??'idle',action=a.actions.get(name)??a.actions.get('idle')!;action.play();action.time=.7;a.mixer.update(0);applySpectralParts(a.mixer.getRoot(),a.root.userData.spectralParts);}
 // This renderer previews the real costume meshes; particle instances are tested separately.
 zone.root.traverse(o=>{if(o instanceof T.InstancedMesh)o.visible=false;});
  // Isolate the costume for inspection; other actors can stand directly in its front view.
  for(const a of actors)if(a.root!==guard)a.root.visible=false;
  for(const o of zone.chaos!.targets.get('apparatus')!.objects)o.visible=false;
 const camera=new T.PerspectiveCamera(40,width/height,.1,100);camera.position.copy(guard.position).add(new T.Vector3(.9,1.5,3.8).applyAxisAngle(new T.Vector3(0,1,0),guard.rotation.y));camera.lookAt(guard.position.clone().add(new T.Vector3(0,1,0)));
 const rgb=renderer.render(scene,camera,FLOORS[i].color);await savePNG(`public/assets/chaos/guard-${i+1}.png`,rgb,width,height);
 for(let y=0;y<height;y++)rgb.copy(overview,y*width*3*3+i*width*3,y*width*3,(y+1)*width*3);
 zone.dispose();
}
await savePNG('public/assets/chaos/guard-pranks.png',overview,width*3,height);
console.log('Three rigged guard costumes rendered: public/assets/chaos/guard-pranks.png');
