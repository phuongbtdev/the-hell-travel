import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {PunishmentVFX,punishmentEffectState} from '../src/world/punishment-vfx.ts';
// @ts-ignore: local build-time renderer
import {SoftwareRenderer} from './software-renderer.mjs';

const bytes=await fs.readFile('public/models/spirit.glb'),source=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
function spirit(){const actor=new T.Group(),visual=clone(source.scene);visual.scale.setScalar(1.8/new T.Box3().setFromObject(visual).getSize(new T.Vector3()).y);actor.add(visual);actor.userData.assetId='spirit';return actor;}
const originals=new Map<T.Mesh,T.Material>();
const actor=spirit(),other=spirit(),scene=new T.Group();scene.add(actor);actor.position.set(2,.4,-3);actor.traverse(o=>{if(o instanceof T.Mesh)originals.set(o,o.material as T.Material);});
const fire=new PunishmentVFX(6,scene);fire.update(5,actor,actor);
const flames=scene.getObjectByName('body-flames') as T.InstancedMesh;assert.equal(flames.count,24);const before=new T.Matrix4(),after=new T.Matrix4();flames.getMatrixAt(0,before);actor.position.x+=4;fire.update(5,actor,actor);flames.getMatrixAt(0,after);assert.ok(Math.abs(after.elements[12]-before.elements[12]-4)<.001,'Fire does not follow the player');
for(const [mesh,original] of originals)assert.notEqual(mesh.material,original,'Fire changed a shared material');
fire.update(5,other,other);for(const [mesh,original] of originals)assert.equal(mesh.material,original,'NPC stayed burnt after the participant changed');fire.dispose();
const ice=new PunishmentVFX(8,scene);actor.userData.performanceSpeed=4;ice.update(7,actor,actor);assert.equal((scene.getObjectByName('body-ice-crystals') as T.InstancedMesh).count,18);assert.equal((scene.getObjectByName('frozen-body-shell') as T.InstancedMesh).count,2);assert.ok(actor.userData.performanceSpeed<1);
let overlays=0;actor.traverse(o=>{if(o.userData.vfxOverlay)overlays++;});assert.ok(overlays>0,'Frosted skin is missing');
for(let i=0;i<120;i++)ice.update(7+i/120,actor,actor);let afterOverlays=0;actor.traverse(o=>{if(o.userData.vfxOverlay)afterOverlays++;});assert.equal(afterOverlays,overlays,'Frost overlays leaked');
ice.dispose();assert.equal(actor.userData.performanceSpeed,4);actor.traverse(o=>assert.ok(!o.userData.vfxOverlay));
for(const floor of [2,5,6,8,9,11,16,18]){
 const root=new T.Group(),body=spirit(),fx=new PunishmentVFX(floor,root);root.add(body);
 if(floor===18||floor===11){body.position.set(0,1,-6.9);body.rotation.set(Math.PI/2,Math.PI,0);}
 const t=floor===2?1.5:floor===11?4.0:floor===18?.6:5;
 fx.update(t,body,body);if([2,11,18].includes(floor))assert.ok((root.getObjectByName('blood-spray') as T.InstancedMesh).count>0,'Missing blood burst');
 for(let frame=0;frame<180;frame++){fx.update(frame/12,body,body);root.traverse(o=>{if(o instanceof T.InstancedMesh){assert.ok(o.count<=o.instanceMatrix.count);for(let i=0;i<o.count;i++){const m=new T.Matrix4();o.getMatrixAt(i,m);assert.ok(m.elements.every(Number.isFinite),'Invalid particle transform');}}});}
 fx.update(t,body,body,false);root.traverse(o=>{if(o instanceof T.InstancedMesh)assert.equal(o.count,0,'Effects remain while execution is interrupted');});fx.dispose();
}
assert.ok(punishmentEffectState(8,7).ice>punishmentEffectState(8,1).ice);assert.equal(punishmentEffectState(2,10).bloodAge,Infinity);assert.ok(Number.isFinite(punishmentEffectState(18,.5).bloodAge));
// The exported-film renderer must honor instance transforms and zero-count pools.
const renderScene=new T.Scene(),instances=new T.InstancedMesh(new T.BoxGeometry(.8,.8,.8),new T.MeshStandardMaterial({color:0xff2020}),2);instances.setMatrixAt(0,new T.Matrix4().makeTranslation(-1,0,0));instances.setMatrixAt(1,new T.Matrix4().makeTranslation(1,0,0));renderScene.add(instances);
const camera=new T.PerspectiveCamera(60,2,.1,100);camera.position.set(0,0,5);camera.lookAt(0,0,0);const renderer=new SoftwareRenderer(200,100),pixels=renderer.render(renderScene,camera,0x112233);
assert.ok(pixels[(50*200+82)*3]>100&&pixels[(50*200+117)*3]>100,'Particle instances not rendered in film');assert.ok(pixels[(50*200+100)*3]<50);
instances.count=0;const empty=renderer.render(renderScene,camera,0x112233);assert.ok(empty[(50*200+82)*3]<50,'Inactive instance pool was drawn');
console.log('OK: fire follows actors, reversible material tint, progressive frost/ice shell, bounded blood/steam pools, interruption cleanup and instanced video rendering.');
