import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CHARACTERS } from './world/characters';

document.querySelector('main')!.innerHTML=`<section class="card" style="grid-column:1/-1"><h2 id="character-title">Bộ nhân vật 3D</h2><p class="status">Chọn nhân vật để xem model và animation.</p><div id="roster" class="controls" style="flex-wrap:wrap">${CHARACTERS.map(c=>`<button data-character="${c.id}">${c.name}</button>`).join('')}</div><div class="stage" style="height:480px"><canvas aria-label="Model nhân vật 3D"></canvas></div><div class="controls" style="flex-wrap:wrap"><label>Animation <select id="animation-select" aria-label="Chọn animation"></select></label><button id="toggle-rotate">Dừng xoay</button><a id="download-model" download style="color:#e4b76c;align-self:center">Tải GLB ↓</a></div><img id="character-reference" src="/assets/concept/character-roster.png" alt="Concept tham chiếu của bộ nhân vật"></section><p class="note">15 model thật có rig. Kéo để xoay, cuộn để phóng to; chọn animation để kiểm tra chuyển động.</p>`;
const canvas=document.querySelector('canvas')!,card=document.querySelector('.card')!;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x263641);
const camera=new THREE.PerspectiveCamera(35,1,.01,60);camera.position.set(.6,1.7,4.3);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,1.05,0);controls.enableDamping=true;controls.minDistance=1.7;controls.maxDistance=6;controls.autoRotate=true;controls.autoRotateSpeed=.55;
scene.add(new THREE.HemisphereLight(0xd2efff,0x756653,2.3));
for(const [pos,color,intensity] of [[[3,4,4],0xffe5bd,3],[[-3,2,1],0x9dc7e8,1.6],[[0,3,-3],0x70d9ff,3]] as const){const light=new THREE.DirectionalLight(color,intensity);light.position.set(pos[0],pos[1],pos[2]);scene.add(light);}
const ground=new THREE.Mesh(new THREE.CircleGeometry(1.3,64),new THREE.MeshStandardMaterial({color:0x1c2a32,roughness:.9}));ground.rotation.x=-Math.PI/2;ground.position.y=-.03;scene.add(ground);
let mixer:THREE.AnimationMixer|undefined,current:THREE.AnimationAction|undefined,visual:THREE.Object3D|undefined,generation=0;
const actions=new Map<string,THREE.AnimationAction>(),select=document.querySelector<HTMLSelectElement>('#animation-select')!;
const loader=new GLTFLoader();
const animationNames:Record<string,string>={idle:'Đứng chờ',glide_walk:'Lướt',walk:'Đi bộ',run:'Chạy',greet:'Chào',pull:'Kéo',bound:'Bị giữ',shiver:'Run vì lạnh',push:'Đẩy',pound:'Giã chày',climb:'Leo',flail:'Vung tay hoảng hốt',hug:'Ôm cột',plead:'Nài nỉ',look:'Ngoảnh mặt',talk:'Nói chuyện','saw-victim':'Nằm chịu cưa',swim:'Vẫy trong ao',stamp:'Đóng dấu'};
async function chooseCharacter(id:string){
 const asset=CHARACTERS.find(c=>c.id===id)!;const token=++generation;
 card.querySelector('.status')!.textContent='Đang tải model…';
 try{
  const gltf=await loader.loadAsync(`/models/${asset.file}.glb`);if(token!==generation)return;
  if(visual){scene.remove(visual);mixer?.stopAllAction();visual.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});}
  visual=gltf.scene;scene.add(visual);mixer=new THREE.AnimationMixer(visual);actions.clear();gltf.animations.forEach(clip=>actions.set(clip.name,mixer!.clipAction(clip)));current=actions.get('idle');current?.play();
  const skins:THREE.SkinnedMesh[]=[];visual.traverse(o=>{if(o instanceof THREE.SkinnedMesh)skins.push(o);});
  card.querySelector('.status')!.textContent=`${skins.length} mesh · ${skins[0]?.skeleton.bones.length??0} xương · ${gltf.animations.length} animation`;
  document.querySelector('#character-title')!.textContent=asset.name;
  select.innerHTML=gltf.animations.map(c=>`<option value="${c.name}">${animationNames[c.name]??'Chuyển động'}</option>`).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(b=>b.classList.toggle('active',b.dataset.character===id));
  const download=document.querySelector<HTMLAnchorElement>('#download-model')!;download.href=`/models/${asset.file}.glb`;
  const ref=document.querySelector<HTMLImageElement>('#character-reference')!;ref.src=id==='spirit'?'/assets/characters/spirit-player-reference.png':id==='guide'?'/assets/characters/tieu-sai-reference.png':'/assets/concept/character-roster.png';
 }catch{card.querySelector('.status')!.textContent='Không tải được model.';}
}
document.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(b=>b.addEventListener('click',()=>void chooseCharacter(b.dataset.character!)));
select.addEventListener('change',()=>{const next=actions.get(select.value);if(next&&next!==current){next.reset().fadeIn(.25).play();current?.fadeOut(.25);current=next;}});
document.querySelector('#toggle-rotate')!.addEventListener('click',e=>{controls.autoRotate=!controls.autoRotate;(e.target as HTMLButtonElement).textContent=controls.autoRotate?'Dừng xoay':'Tự xoay';});
const resize=()=>{const rect=canvas.parentElement!.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(canvas.parentElement!);resize();
const clock=new THREE.Clock();renderer.setAnimationLoop(()=>{mixer?.update(Math.min(clock.getDelta(),.04));controls.update();renderer.render(scene,camera);});
void chooseCharacter('spirit');
