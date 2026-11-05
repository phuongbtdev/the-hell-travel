import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {buildBarZone} from '../src/world/bar.ts';
import {createDanceClips} from '../src/world/dances.ts';
import {CHARACTERS,characterAsset,type ActorKind} from '../src/world/characters.ts';
import {DANCES} from '../shared/bar.ts';
// @ts-ignore: local CPU renderer
import {SoftwareRenderer,savePNG} from './software-renderer.mjs';

(globalThis as any).document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const models=new Map<string,GLTF>();
for(const a of CHARACTERS){const b=await fs.readFile(`public/models/${a.file}.glb`);models.set(a.id,await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));}
const actors:{root:T.Group;mixer:T.AnimationMixer;actions:Map<string,T.AnimationAction>}[]=[];
const actor=(kind:ActorKind,x:number,z:number,scale=1)=>{
 const source=models.get(kind)!,visual=clone(source.scene),box=new T.Box3().setFromObject(visual);visual.scale.setScalar(characterAsset(kind).height/(box.max.y-box.min.y));
 const root=new T.Group();root.position.set(x,0,z);root.scale.setScalar(scale);root.userData.assetId=kind;root.userData.isActor=true;root.add(visual);
 const mixer=new T.AnimationMixer(visual);actors.push({root,mixer,actions:new Map([...source.animations,...createDanceClips(visual)].map(c=>[c.name,mixer.clipAction(c)]))});return root;
};
const renderActors=(time:number)=>{for(const a of actors){const action=a.actions.get(a.root.userData.performanceClip??'idle')!;a.mixer.stopAllAction();action.play();action.time=(time+(a.root.userData.phase??0))%action.getClip().duration;a.mixer.update(0);}};
const scene=new T.Scene(),zone=buildBarZone(actor,()=>1.125);scene.add(zone.root);zone.update(0,0);
const player=actor('spirit',0,1.8);player.userData.performanceClip='dance-hands';scene.add(player);renderActors(1.125);
const camera=new T.PerspectiveCamera(49,960/600,.1,100);camera.position.set(15,15,19);camera.lookAt(-.7,1.5,-4.8);
await fs.mkdir('public/assets/bar',{recursive:true});
const renderer=new SoftwareRenderer(960,600);await savePNG('public/assets/bar/overview.png',renderer.render(scene,camera,0x172332),960,600);
zone.dispose();
for(const a of actors)a.root.removeFromParent();
const width=320,height=300,rows=Math.ceil(DANCES.length/3),sheet=Buffer.alloc(width*3*height*rows*3),close=new SoftwareRenderer(width,height);
scene.add(player);player.position.set(0,0,0);player.scale.setScalar(1);
const closeCamera=new T.PerspectiveCamera(38,width/height,.1,100);closeCamera.position.set(.4,1.4,4.4);closeCamera.lookAt(0,.95,0);
for(let i=0;i<DANCES.length;i++){
 player.userData.performanceClip=DANCES[i].id;renderActors(i===4?.5:.375);
 player.updateMatrixWorld(true);player.traverse(o=>{if(o instanceof T.SkinnedMesh){o.skeleton.update();o.computeBoundingBox();}});
 const center=new T.Box3().setFromObject(player).getCenter(new T.Vector3());closeCamera.position.copy(center).add(new T.Vector3(.4,.45,4.4));closeCamera.lookAt(center);
 const rgb=close.render(scene,closeCamera,0x182735);
 await savePNG(`public/assets/bar/${DANCES[i].id}.png`,rgb,width,height);
 for(let y=0;y<height;y++)rgb.copy(sheet,((Math.floor(i/3)*height+y)*width*3*3)+(i%3)*width*3,y*width*3,(y+1)*width*3);
}
await savePNG('public/assets/bar/dances.png',sheet,width*3,height*rows);
console.log(`Bar scene and ${DANCES.length} rigged dance previews: public/assets/bar/`);
