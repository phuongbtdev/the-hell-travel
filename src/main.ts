import * as THREE from 'three';
import { Client, Callbacks } from '@colyseus/sdk';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { FLOORS, buildVisitZone, type VisitZone, type ZoneAction } from './world/underworld';
import { Soundscape } from './world/soundscape';
import { characterAsset, type ActorKind } from './world/characters';
import { floorNarration,judgeVerdict,zoneDialogue,type Speaker } from './world/dialogue';
import { attachLoopVideo } from './world/loopVideo';
import { Subtitles } from './world/subtitles';
import { PunishmentExperience,ESCORT_MIN_DISTANCE,type ExperiencePhase } from './world/experience';
import { EXPERIENCE_PROFILES } from './world/experience-profiles';
import { applySpectralParts,captureSpectralRig } from './world/spectral-parts';
import { stoneCameraShake } from './world/stone-crush';
import {ChaosLedger,type ChaosAction,type ChaosEvent} from '../shared/chaos';
import './style.css';

type RemotePlayerState = { x: number; z: number; yaw: number; moving: boolean; ticket: number; zone:string;y:number;pitch:number;roll:number;sx:number;sy:number;sz:number;clip:string;experienceStage:string;stageTime:number;escortX:number;escortZ:number;escortYaw:number;escortMoving:boolean;escortClip:string };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const activeMixers = new Set<THREE.AnimationMixer>();
const riggedActors = new WeakMap<THREE.Group, { mixer: THREE.AnimationMixer; idle?: THREE.AnimationAction; walk?: THREE.AnimationAction; run?: THREE.AnimationAction; greet?: THREE.AnimationAction; current?: THREE.AnimationAction; actions:Map<string,THREE.AnimationAction> }>();
const gltfLoader = new GLTFLoader();
const modelPromises = new Map<string, Promise<GLTF>>();
function attachRiggedModel(actor: THREE.Group, fallback: THREE.Object3D, url: string, targetHeight = 1.8) {
  if (!modelPromises.has(url)) modelPromises.set(url, gltfLoader.loadAsync(url));
  modelPromises.get(url)!.then((gltf) => {
    if(actor.userData.disposed)return;
    const model = cloneSkeleton(gltf.scene);
    const bounds = new THREE.Box3().setFromObject(model);
    const height = Math.max(.01, bounds.max.y - bounds.min.y);
    model.scale.setScalar(targetHeight / height);
    model.traverse((node) => { if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; } });
    const normalized = new THREE.Group(); normalized.add(model);
    const normalizedBounds = new THREE.Box3().setFromObject(normalized);
    normalized.position.y -= normalizedBounds.min.y;
    actor.remove(fallback); actor.add(normalized);
    captureSpectralRig(normalized);
    const mixer = new THREE.AnimationMixer(normalized);
    const byName = (names: string[]) => gltf.animations.find((clip) => names.some((name) => clip.name.toLowerCase().includes(name)));
    const idleClip = byName(['idle', 'stand']) ?? gltf.animations[0];
    const walkClip = byName(['walk', 'float', 'move']) ?? idleClip;
    const runClip = byName(['run', 'sprint']) ?? walkClip;
    const greetClip = byName(['greet']);
    const controller = { mixer, idle: idleClip ? mixer.clipAction(idleClip) : undefined, walk: walkClip ? mixer.clipAction(walkClip) : undefined, run: runClip ? mixer.clipAction(runClip) : undefined, greet: greetClip ? mixer.clipAction(greetClip) : undefined, current: undefined as THREE.AnimationAction | undefined, actions:new Map(gltf.animations.map(clip=>[clip.name,mixer.clipAction(clip)])) };
    controller.current = controller.idle; controller.idle?.play(); riggedActors.set(actor, controller);
    activeMixers.add(mixer);
  }).catch((error) => { console.info(`Optional rigged model not loaded: ${url}`, error); });
}
function setActorMoving(actor: THREE.Group, moving: boolean, running = false) {
  const controller = riggedActors.get(actor); if (!controller) return;
  const next = moving ? running ? controller.run : controller.walk : controller.idle;
  if (next && next !== controller.current) { next.reset().fadeIn(.22).play(); controller.current?.fadeOut(.22); controller.current = next; }
  applySpectralParts(controller.mixer.getRoot() as THREE.Object3D,actor.userData.spectralParts);
}
function performActor(actor:THREE.Group,time:number){
  const c=riggedActors.get(actor);if(!c)return;
  const name=actor.userData.performanceClip;if(!name){setActorMoving(actor,Boolean(actor.userData.moving));return;}
  const next=c.actions.get(name);if(!next)return;
  if(c.current!==next){c.current?.fadeOut(.16);next.reset().fadeIn(.16).play();c.current=next;}
  next.time=((time+(actor.userData.phase??0))*(actor.userData.performanceSpeed??1))%next.getClip().duration;c.mixer.update(0);
  applySpectralParts(c.mixer.getRoot() as THREE.Object3D,actor.userData.spectralParts);
}
function greetActor(actor: THREE.Group) {
  const controller = riggedActors.get(actor); if (!controller?.greet) return;
  const action = controller.greet;
  controller.current?.fadeOut(.2); action.reset().setLoop(THREE.LoopOnce,1).fadeIn(.2).play(); action.clampWhenFinished=true; controller.current=action;
  const returnToIdle = (event: { action: THREE.AnimationAction }) => {
    if(event.action!==action)return;
    action.fadeOut(.25); controller.idle?.reset().fadeIn(.25).play();controller.current=controller.idle;controller.mixer.removeEventListener('finished',returnToIdle);
  };
  controller.mixer.addEventListener('finished',returnToIdle);
}
const canvas = $('world') as HTMLCanvasElement;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101a20);
scene.fog = new THREE.FogExp2(0x172128, 0.022);
const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, 0.1, 160);
camera.position.set(0, 5.6, 15);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

scene.add(new THREE.HemisphereLight(0x9bb6c1, 0x151313, 1.55));
const moon = new THREE.DirectionalLight(0x84b1c7, 2.2);
moon.position.set(-10, 15, 9);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
scene.add(moon);
const fireGlow = new THREE.PointLight(0xff8c42, 3.2, 23, 2);
fireGlow.position.set(0, 4.4, -6.5);
scene.add(fireGlow);

const mats = {
  stone: new THREE.MeshStandardMaterial({ color: 0x343b3c, roughness: 0.96 }),
  darkStone: new THREE.MeshStandardMaterial({ color: 0x1c2527, roughness: 0.9 }),
  lacquer: new THREE.MeshStandardMaterial({ color: 0x542b27, roughness: 0.52, metalness: 0.12 }),
  bronze: new THREE.MeshStandardMaterial({ color: 0x8c6740, roughness: 0.38, metalness: 0.68 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd9ae69, roughness: 0.3, metalness: 0.62 }),
  cloth: new THREE.MeshStandardMaterial({ color: 0x741f20, roughness: 0.84 }),
  ghost: new THREE.MeshStandardMaterial({ color: 0x8fe2e2, emissive: 0x195d61, emissiveIntensity: 0.5, transparent: true, opacity: 0.47, roughness: 0.3 }),
};

function box(parent: THREE.Object3D, size: [number, number, number], material: THREE.Material, pos: [number, number, number], cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...pos); mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent: THREE.Object3D, r1: number, r2: number, h: number, material: THREE.Material, pos: [number, number, number], segments = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, segments), material);
  mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function addLantern(x: number, z: number) {
  const group = new THREE.Group(); group.position.set(x, 0, z); scene.add(group);
  box(group, [.12, 2.2, .12], mats.darkStone, [0, 1.1, 0]);
  box(group, [.7, .12, .7], mats.lacquer, [0, 2.1, 0]);
  box(group, [.5, .65, .5], new THREE.MeshStandardMaterial({ color: 0xe8a24c, emissive: 0xff7a23, emissiveIntensity: 3, transparent: true, opacity: .76 }), [0, 1.7, 0]);
  box(group, [.68, .12, .68], mats.lacquer, [0, 1.3, 0]);
  const light = new THREE.PointLight(0xffa955, 2.2, 8, 2); light.position.set(0, 1.65, .1); group.add(light);
  return light;
}

// Stone forecourt and tiled path.
box(scene, [70, .55, 85], mats.darkStone, [0, -.42, -21], false);
const pathMaterial = new THREE.MeshStandardMaterial({ color: 0x515456, roughness: 1 });
for (let row = 0; row < 15; row++) {
  for (let col = -2; col <= 2; col++) {
    const tile = box(scene, [1.7 + Math.random() * .18, .12, 1.65 + Math.random() * .2], pathMaterial, [col * 1.78 + (Math.random() - .5) * .1, -.07, 9 - row * 1.72], false);
    tile.rotation.y = (Math.random() - .5) * .08;
  }
}
// Cliff walls and gate pillars.
for (const side of [-1, 1]) {
  box(scene, [9, 5, 56], mats.darkStone, [side * 25, 1.9, -16], false);
  for (let i = 0; i < 6; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.1 + Math.random() * 1.8, 0), mats.stone);
    rock.position.set(side * (11 + Math.random() * 9), -1.1 + Math.random() * 3, -8 - i * 5);
    rock.scale.y = .8 + Math.random(); rock.rotation.set(Math.random(), Math.random(), Math.random()); scene.add(rock);
  }
  box(scene, [1.8, 8.2, 2], mats.lacquer, [side * 5.2, 3.7, -8]);
  box(scene, [2.2, .55, 2.3], mats.gold, [side * 5.2, -.15, -8]);
  addLantern(side * 7.6, -3.5); addLantern(side * 4.3, 4.5); addLantern(side * 10.3, -15);
}
// Monumental gate with layered roof.
box(scene, [13, .8, 1.8], mats.lacquer, [0, 8.2, -8]);
box(scene, [15, .34, 2.3], mats.gold, [0, 8.65, -8]);
const roof = new THREE.Mesh(new THREE.ConeGeometry(9.2, 2.5, 4), mats.lacquer);
roof.position.set(0, 10.1, -8); roof.rotation.y = Math.PI / 4; roof.scale.set(1.3, .48, .62); roof.castShadow = true; scene.add(roof);
box(scene, [10.8, .28, 1.7], mats.gold, [0, 7.6, -8]);
for (const side of [-1, 1]) {
  const dragon = new THREE.Mesh(new THREE.TorusKnotGeometry(.55, .17, 72, 8, 2, 3), mats.gold);
  dragon.position.set(side * 4.1, 5.4, -6.8); dragon.rotation.y = side * .35; scene.add(dragon);
}
// Distant judgment hall, intentionally visible as a destination landmark.
const hall = new THREE.Group(); hall.position.set(0, 0, -34); scene.add(hall);
box(hall, [20, .7, 9], mats.darkStone, [0, .1, 0]);
box(hall, [12, 4, 5], mats.lacquer, [0, 2.1, -1]);
box(hall, [14, .5, 6], mats.gold, [0, 4.4, -1]);
const hallRoof = new THREE.Mesh(new THREE.ConeGeometry(8, 2, 4), mats.lacquer); hallRoof.position.set(0, 5.5, -1); hallRoof.rotation.y = Math.PI / 4; hallRoof.scale.set(1.35, .5, .8); hall.add(hallRoof);
for (let step = 0; step < 5; step++) box(hall, [5.5 + step * .7, .23, .6], mats.stone, [0, .48 + step * .24, 2.5 + step * .52]);
for (const side of [-1, 1]) { box(hall, [.4, 3.4, .45], mats.gold, [side * 4.8, 2.1, 1.1]); addLantern(side * 6.7, -30); }
// Registration desk on the forecourt.
const desk = new THREE.Group(); desk.position.set(-5.8, 0, 1.1); desk.rotation.y = .25; scene.add(desk);
box(desk, [3.5, 1.25, 1.1], mats.lacquer, [0, .68, 0]); box(desk, [3.7, .14, 1.25], mats.gold, [0, 1.36, 0]);
box(desk, [1.35, .85, .08], mats.stone, [0, 1.91, -.48]);
for (let i = -1; i <= 1; i++) box(desk, [.08, .63, .08], mats.gold, [i * .45, 1.95, -.4]);

// Low-cost atmospheric fog cards and floating spirit lights.
const fogCards: THREE.Mesh[] = [];
const fogMaterial = new THREE.MeshBasicMaterial({ color: 0x91b7bb, transparent: true, opacity: .035, side: THREE.DoubleSide, depthWrite: false });
for (let i = 0; i < 12; i++) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(13 + Math.random() * 9, 2.3 + Math.random() * 1.4), fogMaterial.clone());
  f.position.set((Math.random() - .5) * 23, -.45 + Math.random() * .5, 6 - Math.random() * 42); f.rotation.y = (Math.random() - .5) * .32; scene.add(f); fogCards.push(f);
}
for (let i = 0; i < 15; i++) {
  const orb = new THREE.Mesh(new THREE.SphereGeometry(.07 + Math.random() * .09, 8, 6), new THREE.MeshBasicMaterial({ color: i % 3 ? 0xffaa60 : 0x86e3e1 }));
  orb.position.set((Math.random() - .5) * 20, .5 + Math.random() * 3, 5 - Math.random() * 40); scene.add(orb);
}

function makeSpirit(color = 0x78d7d5, withLantern = false) {
  const root = new THREE.Group();root.userData.assetId='spirit'; const visual = new THREE.Group(); root.add(visual);
  const bodyMat = color === 0x78d7d5 ? mats.ghost : new THREE.MeshStandardMaterial({ color, roughness: .8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.36, .74, 5, 10), bodyMat); body.position.y = .88; body.castShadow = true; visual.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.38, 16, 12), bodyMat); head.position.y = 1.75; head.castShadow = true; visual.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x142223 });
  for (const x of [-.13, .13]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), eyeMat); eye.position.set(x, 1.79, .33); visual.add(eye); }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.35, .63, 10), bodyMat); tail.position.set(0, .19, 0); tail.rotation.x = Math.PI; visual.add(tail);
  if (withLantern) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.13, .025, 6, 12), mats.gold); handle.position.set(.53, 1.23, .1); visual.add(handle);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(.23, .3, .23), new THREE.MeshStandardMaterial({ color: 0xffbd65, emissive: 0xff7d29, emissiveIntensity: 2 })); lamp.position.set(.53, .98, .1); visual.add(lamp);
  }
  attachRiggedModel(root, visual, '/models/spirit.glb');
  return root;
}
const player = makeSpirit(0x78d7d5, true); player.position.set(0, 0, 4.5); scene.add(player);
const guide = new THREE.Group(); guide.position.set(-4.3, 0, -1.6); guide.rotation.y = .32; scene.add(guide);
const guideBody = new THREE.Mesh(new THREE.CapsuleGeometry(.35, .67, 4, 10), new THREE.MeshStandardMaterial({ color: 0x9c3029, roughness: .78 })); guideBody.position.y = .83; guide.add(guideBody);
const guideHead = new THREE.Mesh(new THREE.SphereGeometry(.39, 14, 12), new THREE.MeshStandardMaterial({ color: 0xd7563f, roughness: .78 })); guideHead.position.y = 1.66; guide.add(guideHead);
for (const side of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(.13, .44, 8), mats.gold); horn.position.set(side * .28, 2.02, 0); horn.rotation.z = side * -.45; guide.add(horn); }
const guideScroll = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .9, 8), new THREE.MeshStandardMaterial({ color: 0xe4d2aa, roughness: .9 })); guideScroll.position.set(.48, 1.2, .1); guideScroll.rotation.z = Math.PI / 2; guide.add(guideScroll);
const guideBell = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 8), mats.gold); guideBell.position.set(-.5, 1.05, .1); guide.add(guideBell);
const guideFallback = new THREE.Group();
[...guide.children].forEach((child) => guideFallback.add(child));
guide.add(guideFallback);
attachRiggedModel(guide, guideFallback, '/models/tieu-sai.glb', 1.85);
// Record-keeper at the counter.
const clerk = new THREE.Group(); clerk.position.set(-5.8, 0, .1); clerk.rotation.y = Math.PI; scene.add(clerk);
const clerkBody = new THREE.Mesh(new THREE.CapsuleGeometry(.3, .52, 4, 8), new THREE.MeshStandardMaterial({ color: 0x24363a })); clerkBody.position.y = .73; clerk.add(clerkBody);
const clerkHead = new THREE.Mesh(new THREE.SphereGeometry(.33, 12, 10), new THREE.MeshStandardMaterial({ color: 0x557779 })); clerkHead.position.y = 1.47; clerk.add(clerkHead);
const clerkHat = new THREE.Mesh(new THREE.CylinderGeometry(.27, .33, .5, 8), mats.darkStone); clerkHat.position.y = 1.84; clerk.add(clerkHat);
const clerkFallback=new THREE.Group();[...clerk.children].forEach(c=>clerkFallback.add(c));clerk.add(clerkFallback);attachRiggedModel(clerk,clerkFallback,'/models/clerk.glb',1.7);clerk.userData.performanceClip='stamp';
// Ambient NPC ghosts waiting in an orderly, readable lane.
const queue = new THREE.Group(); scene.add(queue);
for (let i = 0; i < 5; i++) { const soul = createZoneActor((['spirit','spirit-round','spirit-hat','spirit-female','traveler-male'] as const)[i],-2.3,3.7-i*1.25,.75);queue.add(soul); }
for (let i = 0; i < 5; i++) { const soul = createZoneActor((['traveler-female','guard-blue','guard-green','hound','spirit-female'] as const)[i],-8.2,-4-i*2.1,.75);queue.add(soul); }

const registryEnvironment = new THREE.Group();
for(const node of [...scene.children])if(!(node instanceof THREE.Light)&&![player,guide,clerk,queue].includes(node as THREE.Group))registryEnvironment.add(node);
scene.add(registryEnvironment);

const clock = new THREE.Clock();
const keys = new Set<string>();
let registered = false, entered = false, audioEnabled = false, currentTicket = 0, room: any, localSessionId = '', cameraYaw = 0, cameraPitch = .13, dragging = false, lastPointerX = 0, lastPointerY = 0;
let velocity = new THREE.Vector3();
const remotes = new Map<string, { root: THREE.Group; target: THREE.Vector3; yaw: number; moving: boolean; zone:string;rotation:THREE.Quaternion;scale:THREE.Vector3;clip:string;mode:string;stageTime:number;renderTime:number;escortTarget:THREE.Vector3;escortYaw:number;escortMoving:boolean;escortClip:string;escort?:THREE.Group }>();
const soundscape = new Soundscape();
// Cancel speech queued by a previous version during a live reload.
window.speechSynthesis?.cancel();
const subtitles=new Subtitles({panel:$('guide-bubble'),speaker:$('subtitle-speaker'),text:$('guide-line'),progress:$('subtitle-progress'),previous:$('subtitle-previous') as HTMLButtonElement,next:$('subtitle-next') as HTMLButtonElement,close:$('subtitle-close') as HTMLButtonElement});
let activeVisit:VisitZone|undefined;
let currentFilm:ReturnType<typeof attachLoopVideo>|undefined;
let audioPreferenceChosen=false;
let mapOpen=false;
const readVisited=()=>{try{const saved=JSON.parse(localStorage.getItem('underworld.visited')??'[]');return Array.isArray(saved)?saved.filter(n=>Number.isInteger(n)&&n>=1&&n<=18):[];}catch{return [];}};
const visited = new Set<number>(readVisited());
let currentZone = 'registry';
const experience=new PunishmentExperience();
let experienceRequested=false,requestedExperienceZone='';
let experienceReplyTimer=0;
let chaosMode=false,chaosPendingUntil=0,filmSuppressed=false;
const soloChaos=new ChaosLedger(),chaosEmotes=new Map<string,{kind:ChaosAction;until:number}>();
let chaosHeat={value:0,at:0};
const cameraLookTarget=new THREE.Vector3(0,1.15,4.5);
const startAmbient = (zone: string) => {
  const floor=FLOORS[Number(zone.replace('floor-',''))-1];
  soundscape.setMood(floor?.mood??'hall');
};
function refreshAudioButtons(){for(const id of ['sound-toggle','sound-hud']){const button=$(id);button.textContent=audioEnabled?'♫':'♪';button.setAttribute('aria-pressed',String(audioEnabled));button.title=audioEnabled?'Tắt nhạc và hiệu ứng':'Bật nhạc và hiệu ứng';}}
async function toggleAudio() {audioPreferenceChosen=true;audioEnabled = await soundscape.toggle();refreshAudioButtons();}
async function ensureAudio(){if(!soundscape.enabled){audioEnabled=await soundscape.enable();refreshAudioButtons();}}
$('sound-toggle').addEventListener('click', toggleAudio); $('sound-hud').addEventListener('click', toggleAudio);

function showToast(message: string) { const toast = $('toast'); toast.textContent = message; toast.classList.add('show'); window.setTimeout(() => toast.classList.remove('show'), 2600); }
function showGuide(message:string,speaker:Speaker='guide'){subtitles.show([{speaker,text:message}]);}
function readScene(){
  if(experience.active)return;
  if(currentZone==='hall'){subtitles.show(judgeVerdict(currentTicket,visited.size));return;}
  const i=Number(currentZone.replace('floor-',''))-1;if(FLOORS[i])subtitles.show(floorNarration(i,FLOORS[i].name));
}
$('read-story').addEventListener('click',readScene);
$('expand-film').addEventListener('click',()=>{$('floor-cinema').classList.toggle('expanded');});
function distanceXZ(a: THREE.Object3D, b: THREE.Object3D) { return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z); }
function createZoneActor(kind:ActorKind,x:number,z:number,scale=1) {
  const a=new THREE.Group();a.position.set(x,0,z);a.scale.setScalar(scale);a.userData.isActor=true;a.userData.assetId=kind;
  const asset=characterAsset(kind),fallback=new THREE.Group();a.add(fallback);attachRiggedModel(a,fallback,`/models/${asset.file}.glb`,asset.height);
  return a;
}
function cleanupActor(actor:THREE.Object3D){actor.traverse(o=>{o.userData.disposed=true;const controller=riggedActors.get(o as THREE.Group);if(controller){activeMixers.delete(controller.mixer);controller.mixer.stopAllAction();riggedActors.delete(o as THREE.Group);}});}
function sendRoom(type:string,payload:unknown={}){if(room)try{room.send(type,payload);}catch{}}
function refreshExperienceButton(){const button=$('experience-punishment') as HTMLButtonElement;button.disabled=experience.active||experienceRequested;button.textContent=experience.active?'Đang trải nghiệm…':experienceRequested?'Đang chờ quỷ sai…':'Trải nghiệm hình phạt';}
function setChaosMode(enabled:boolean){
  chaosMode=enabled&&Boolean(activeVisit?.chaos)&&!experience.active&&!experienceRequested;
  document.body.classList.toggle('chaos-mode',chaosMode);$('chaos-panel').hidden=!chaosMode;$('toggle-chaos').setAttribute('aria-pressed',String(chaosMode));$('toggle-chaos').textContent=chaosMode?'Dừng đại náo':'Đại náo tầng này';
  if(chaosMode){subtitles.clear();closeMap();showToast('F đánh quỷ sai · G phá đồ · R kéo quần. Coi chừng bị đuổi!');}else activeVisit?.chaos?.highlight();
}
function receiveChaos(event:ChaosEvent,serverNow:number,silent=false){
  const chaos=activeVisit?.chaos;if(!chaos||!chaos.receive(event,serverNow,silent))return;
  const local=event.actor===(room?localSessionId:'local');
  if(!silent&&!event.reaction){
    chaosEmotes.set(event.actor,{kind:event.action,until:Date.now()+650});
    soundscape.cue(event.action==='pants'?'boing':event.action==='hit'?'thud':event.hp===0?'shatter':'stone');
    if(local){chaosPendingUntil=Date.now()+750;chaosHeat={value:event.heat,at:Date.now()};showToast(event.action==='pants'?'Lộ quần đùi trái tim! Quỷ sai: “Trả quần đây!”':event.action==='hit'?'Bốp! Quỷ sai choáng, màn thi hành tạm dừng.':event.hp===0?'Choang! Đạo cụ vỡ. Quỷ sai sẽ dựng lại sau 18 giây.':'Đồ đã nứt · đập thêm một lần nữa!');}
  }
}
function doChaos(action:ChaosAction){
  if(!entered||!chaosMode||experience.active||experienceRequested||mapOpen||Date.now()<chaosPendingUntil)return;
  const chaos=activeVisit?.chaos,target=chaos?.nearest(action,player.position);if(!target){showToast(action==='smash'?'Lại gần đạo cụ hoặc thùng dụng cụ.':'Lại gần quỷ sai đang thi hành án.');return;}
  const point=chaos!.point(target);player.rotation.y=Math.atan2(point.x-player.position.x,point.z-player.position.z);subtitles.clear();
  const request={action,target:target.definition.id};chaosPendingUntil=Date.now()+1200;
  if(room){sendRoom('move',{x:player.position.x,z:player.position.z,yaw:player.rotation.y,moving:false});sendRoom('chaos:action',request);}
  else{const result=soloChaos.request({id:'local',zone:currentZone,x:player.position.x,z:player.position.z,registered},request);if(result.event){for(const e of [result.event,...result.reactions])receiveChaos(e,Date.now());}else{chaosPendingUntil=0;showToast(result.reason);}}
}
$('toggle-chaos').addEventListener('click',()=>setChaosMode(!chaosMode));$('close-chaos').addEventListener('click',()=>setChaosMode(false));
for(const action of ['hit','smash','pants'] as const)$(`chaos-${action}`).addEventListener('click',()=>doChaos(action));
function refreshChaosUI(){
  const chaos=activeVisit?.chaos,now=Date.now();
  if(chaosMode&&chaos){
    const guard=chaos.nearest('hit',player.position),prop=chaos.nearest('smash',player.position);
    $('chaos-target').textContent=[guard?.definition.name,prop?.definition.name].filter(Boolean).join(' · ')||'Tới gần quỷ sai hoặc đạo cụ để chọc phá.';
    for(const action of ['hit','smash','pants'] as const)($(`chaos-${action}`) as HTMLButtonElement).disabled=now<chaosPendingUntil||!chaos.nearest(action,player.position);
    const heat=Math.max(0,chaosHeat.value-Math.floor((now-chaosHeat.at)/5000));($('chaos-heat') as HTMLProgressElement).value=heat;$('chaos-heat-label').textContent=heat>=4?'Quỷ sai đang nổi đóa!':heat>=2?'Coi chừng bị đuổi!':heat?'Đã bị để ý':'Chưa bị để ý';
    $('chaos-note').textContent=chaos.busy()?`Màn diễn đang gián đoạn · dẹp loạn trong ${Math.ceil(chaos.remaining())} giây`:'Đi vào sân khấu, lại gần mục tiêu rồi ra tay.';chaos.highlight(player.position);
  }
  if(!experience.active&&!experienceRequested){const busy=Boolean(chaos?.busy()),button=$('experience-punishment') as HTMLButtonElement;button.disabled=busy;button.textContent=busy?'Đợi quỷ sai dẹp loạn…':'Trải nghiệm hình phạt';}
  const suppress=Boolean(chaosMode||chaos?.busy());
  if(currentFilm&&filmSuppressed!==suppress){filmSuppressed=suppress;currentFilm.plane.visible=!suppress;$('floor-cinema').classList.toggle('hidden',suppress);if(suppress)currentFilm.pause();else void currentFilm.play().catch(()=>{});}
}
const phaseLabels:Record<ExperiencePhase,string>={idle:'',approaching:'Quỷ sai đang đến đón',detaining:'Quỷ sai đã tới · chuẩn bị áp giải',escorting:'Đang áp giải tới khu thi hành',positioning:'Đang đưa vào vị trí',performing:'Đang thi hành · màn diễn của bạn',returning:'Đã xong · quỷ sai đưa bạn trở lại'};
function experienceStatus(phase:ExperiencePhase,remaining:number,moment?:string){$('experience-status').classList.remove('hidden');$('experience-phase').textContent=moment??phaseLabels[phase];$('experience-time').textContent=phase==='performing'?`Còn ${remaining} giây · có thể dừng bất cứ lúc nào`:'Bạn có thể dừng bằng nút hoặc phím Esc.';}
function stopExperience(){
  window.clearTimeout(experienceReplyTimer);
  if(experience.active){experience.cancel();return;}
  if(experienceRequested)sendRoom('experience:stop');experienceRequested=false;requestedExperienceZone='';$('experience-status').classList.add('hidden');refreshExperienceButton();
}
function beginLocalExperience(){
  experienceRequested=false;refreshExperienceButton();
  let victim:THREE.Object3D|undefined;activeVisit?.root.traverse(o=>{if(o.userData.role==='victim')victim=o;});
  if(!activeVisit||!victim||currentZone!==requestedExperienceZone){sendRoom('experience:stop');stopExperience();return;}
  const visit=activeVisit;
  const started=experience.startRun({player,victim,root:visit.root,bounds:visit.bounds,obstacles:visit.obstacles,profile:EXPERIENCE_PROFILES[Number(currentZone.replace('floor-',''))-1],stageTime:(t)=>{visit.setPerformanceTime(t);visit.update(clock.elapsedTime,0);},participant:a=>visit.setParticipant(a),
    createGuard:()=>createZoneActor('demon',-6.8,-.8,1.1),cleanup:cleanupActor,status:experienceStatus,
    reaction:vowel=>soundscape.reaction(vowel),
    finish:(cancelled)=>{sendRoom('experience:stop');experienceRequested=false;requestedExperienceZone='';velocity.set(0,0,0);keys.clear();document.body.classList.remove('experiencing');$('experience-status').classList.add('hidden');refreshExperienceButton();setActorMoving(player,false);showGuide(cancelled?'Đã dừng. Ngài cứ tự do tham quan nhé.':'Thi hành xong! Đóng dấu tự nguyện. Ngài có thể tiếp tục tham quan.','demon');},
  });
  if(!started){sendRoom('experience:stop');showToast('Quỷ sai chưa tìm được lối tới. Hãy đứng gần lối đi rồi thử lại.');return;}
  keys.clear();velocity.set(0,0,0);subtitles.clear();document.body.classList.add('experiencing');refreshExperienceButton();
}
$('experience-punishment').addEventListener('click',()=>{
  if(experience.active||experienceRequested||!/^floor-/.test(currentZone))return;
  if(activeVisit?.chaos?.busy()){showToast('Chờ quỷ sai dẹp loạn và dựng lại đạo cụ đã nhé.');return;}setChaosMode(false);
  if(!riggedActors.has(player)){showToast('Đang tải nhân vật 3D, chờ một chút rồi thử lại nhé.');return;}
  closeMap();subtitles.clear();requestedExperienceZone=currentZone;
  if(room){experienceRequested=true;refreshExperienceButton();experienceStatus('approaching',0);experienceReplyTimer=window.setTimeout(()=>{if(experienceRequested){stopExperience();showToast('Máy chủ chưa phản hồi. Hãy tải lại trang rồi thử lại.');}},5000);sendRoom('experience:start');}else beginLocalExperience();
});
$('stop-experience').addEventListener('click',stopExperience);
function closeMap(){mapOpen=false;$('map-panel').classList.add('hidden');keys.clear();}
function refreshMap(){
  $('visit-progress').textContent=`Đã đến ${visited.size} / 18 tầng`;
  $('floor-list').querySelectorAll<HTMLButtonElement>('button').forEach(b=>{const n=Number(b.dataset.floor);b.classList.toggle('visited',visited.has(n));b.classList.toggle('active',currentZone===`floor-${n}`);});
}
function travelTo(id:string){
  if(id!=='registry'&&id!=='hall'&&!/^floor-([1-9]|1[0-8])$/.test(id))return;
  if(!registered&&id!=='registry'){showGuide('Xin ghé quầy ghi danh nhận thẻ hồn trước nhé. Quầy ở bên trái đường đá.');closeMap();return;}
  stopExperience();setChaosMode(false);chaosPendingUntil=0;
  closeMap();subtitles.clear();$('registration-card').classList.add('hidden');$('scene-fade').classList.add('active');keys.clear();velocity.set(0,0,0);
  window.setTimeout(()=>{
    currentFilm?.dispose();currentFilm=undefined;filmSuppressed=false;$('floor-cinema').classList.add('hidden');$('floor-cinema').classList.remove('expanded');
    if(activeVisit){activeVisit.root.traverse(o=>{o.userData.disposed=true;const c=riggedActors.get(o as THREE.Group);if(c){activeMixers.delete(c.mixer);c.mixer.stopAllAction();riggedActors.delete(o as THREE.Group);}});activeVisit.dispose();activeVisit=undefined;}
    currentZone=id;registryEnvironment.visible=id==='registry';queue.visible=id==='registry';clerk.visible=id==='registry';
    if(id!=='registry'){activeVisit=buildVisitZone(id,createZoneActor);scene.add(activeVisit.root);}
    activeVisit?.chaos?.configure(sid=>sid===(room?localSessionId:'local')?player:remotes.get(sid)?.zone===currentZone?remotes.get(sid)?.root:undefined,(sid,kind)=>{if(kind==='caught'&&sid===(room?localSessionId:'local')){showToast('Bắt quả tang! Quỷ sai gõ đầu: “Quậy nữa ta mách Diêm Vương!”');soundscape.cue('thud');}});
    if(!room)for(const e of soloChaos.snapshot(id))receiveChaos(e,Date.now(),true);
    const f=FLOORS[Number(id.replace('floor-',''))-1];
    if(f){visited.add(Number(id.replace('floor-','')));localStorage.setItem('underworld.visited',JSON.stringify([...visited]));}
    if(f){const n=String(Number(id.replace('floor-',''))).padStart(2,'0');currentFilm=attachLoopVideo(scene,`/video/floors/floor-${n}.mp4`,new THREE.Vector3(7,3.2,-7),new THREE.Vector2(4,2.25),{video:$('scene-film') as HTMLVideoElement,poster:`/video/floors/floor-${n}.png`});$('floor-cinema').classList.remove('hidden');void currentFilm.play().catch(()=>showToast('Bấm phát trong ô video để xem màn diễn.'));}
    const color=f?.color??0x172128;scene.background=new THREE.Color(color);scene.fog=new THREE.FogExp2(color,id==='hall'?.013:.022);
    player.position.set(0,0,id==='registry'?4.5:5.5);player.rotation.y=Math.PI;cameraYaw=0;cameraPitch=.13;camera.position.set(0,3.8,12);
    guide.position.set(id==='registry'?-4.3:3.5,0,id==='registry'?-1.6:5.3);guide.rotation.y=id==='registry'?.32:-.7;
    $('zone-name').textContent=f?`TẦNG ${id.replace('floor-','')} · ${f.name.toLocaleUpperCase('vi')}`:id==='hall'?'CHÍNH ĐIỆN':'CỬA TIẾP DẪN';
    $('zone-subtitle').textContent=f?'THẬP BÁT ĐỊA NGỤC · KHÁCH THAM QUAN':id==='hall'?'ĐIỆN XÉT XỬ · 18 CỔNG THAM QUAN':'ÂM PHỦ · KHU GHI DANH';
    $('zone-description').classList.toggle('hidden',id==='registry');$('zone-number').textContent=f?`TẦNG ${id.replace('floor-','')} / 18`:'CHÍNH ĐIỆN';$('zone-title').textContent=f?.name??'Điện xét xử';$('zone-story').textContent=f?.story??'Bẩm Diêm Vương hoặc chọn một trong 18 cổng hai bên điện.';
    $('read-story').textContent=id==='hall'?'Xem Diêm Vương phán':'Đọc chuyện tội và phạt';
    $('experience-punishment').hidden=!f;$('toggle-chaos').hidden=!f;refreshExperienceButton();
    startAmbient(id);soundscape.setZone(id);subtitles.show(zoneDialogue(id));soundscape.cue('portal');refreshMap();room?.send('zone',{zone:id});sendRoom('chaos:sync');$('scene-fade').classList.remove('active');
    if(visited.size===18)showToast('Đã tham quan đủ 18 tầng. Mời trở về Chính Điện!');
  },160);
}
function nearestWorldAction():ZoneAction|undefined {
  if(currentZone==='registry')return player.position.z < -25?{position:new THREE.Vector3(0,0,-29),radius:6,label:'Bước vào Chính Điện',destination:'hall'}:undefined;
  return activeVisit?.actions.filter(a=>Math.hypot(a.position.x-player.position.x,a.position.z-player.position.z)<a.radius).sort((a,b)=>a.position.distanceToSquared(player.position)-b.position.distanceToSquared(player.position))[0];
}
$('floor-list').innerHTML=FLOORS.map((f,i)=>`<button data-floor="${i+1}"><small>TẦNG ${String(i+1).padStart(2,'0')}</small>${f.name}</button>`).join('');
$('floor-list').querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.addEventListener('click',()=>travelTo(`floor-${b.dataset.floor}`)));
$('go-registry').addEventListener('click',()=>travelTo('registry'));$('go-hall').addEventListener('click',()=>travelTo('hall'));
$('open-map').addEventListener('click',()=>{stopExperience();mapOpen=true;keys.clear();refreshMap();$('map-panel').classList.remove('hidden');});$('close-map').addEventListener('click',closeMap);
function interact() {
  if(!entered||mapOpen||experience.active)return;
  const action=nearestWorldAction();
  if(action){if(action.destination)travelTo(action.destination);else if(action.line){readScene();soundscape.cue('bell');}return;}
  if (currentZone==='registry' && distanceXZ(player, clerk) < 3.4 && !registered) {
    registered = true; currentTicket = Math.max(1, Number(room?.state?.players?.get(localSessionId)?.ticket ?? 1));
    $('ticket-number').textContent = String(currentTicket).padStart(3, '0'); $('hud-ticket-number').textContent = String(currentTicket).padStart(3, '0');
    $('registration-card').classList.remove('hidden'); $('spirit-name').textContent = `Linh hồn #${String(currentTicket).padStart(3, '0')}`;
    subtitles.clear(); showToast('Đã ghi danh. Bạn có thể tự do tham quan.');
    if (room) room.send('register', {});
    if (audioEnabled) playEffect('stamp');
  } else if (distanceXZ(player, guide) < 3.5) {
    greetActor(guide);
    const floor=FLOORS[Number(currentZone.replace('floor-',''))-1];
    showGuide(floor?.joke??(registered ? 'Đi thẳng theo đường đá tới Chính Điện, hoặc dùng nút Chính điện phía trên nhé!' : 'Xin mời ghi danh trước… quầy nằm bên trái đường đá.'));
    if (audioEnabled) playEffect('bell');
  } else if (currentZone==='registry' && distanceXZ(player, clerk) < 3.5) {
    showGuide('Xếp hàng giúp tôi một chút. Sổ này… hơi dài.');
  } else {
    showToast('Chưa có gì để tương tác ở đây.');
  }
}
function playEffect(name: string) { soundscape.cue(name); }

async function connectRoom() {
  const endpoint = import.meta.env.VITE_ROOM_URL ?? `${location.protocol === 'https:' ? 'https' : 'http'}://${location.hostname}:2567`;
  try {
    const client = new Client(endpoint);
    room = await client.joinOrCreate('underworld_hall'); localSessionId = room.sessionId;
    room.onMessage('registry:registered',()=>{});
    room.onMessage('presence:count',()=>updateOnlineCount());
    room.onMessage('chaos:event',(m:{event:ChaosEvent;serverNow:number})=>receiveChaos(m.event,m.serverNow));
    room.onMessage('chaos:snapshot',(m:{zone:string;events:ChaosEvent[];serverNow:number})=>{if(m.zone===currentZone)for(const e of m.events)receiveChaos(e,m.serverNow,true);});
    room.onMessage('chaos:rejected',(m:{reason:string})=>{chaosPendingUntil=0;showToast(m.reason);});
    room.onMessage('experience:response',(response:{accepted:boolean;queued?:boolean;position?:number;zone?:string;reason?:string})=>{
      window.clearTimeout(experienceReplyTimer);
      if(response.zone&&response.zone!==requestedExperienceZone){sendRoom('experience:stop');return;}
      if(response.accepted){if(!experience.active)beginLocalExperience();}
      else if(response.queued){experienceRequested=true;refreshExperienceButton();$('experience-status').classList.remove('hidden');$('experience-phase').textContent=`Đang chờ lượt · vị trí ${response.position}`;$('experience-time').textContent='Bạn vẫn có thể đi lại. Quỷ sai sẽ tới khi đến lượt.';}
      else {stopExperience();showToast(response.reason??'Chưa thể bắt đầu trải nghiệm.');}
    });
    room.onMessage('experience:cancelled',()=>{stopExperience();showToast('Lượt trải nghiệm đã kết thúc. Bạn có thể đăng ký lại.');});
    const callbacks: any = Callbacks.get(room);
    callbacks.onAdd('players', (state: RemotePlayerState, sessionId: string) => {
      if (sessionId === localSessionId) { currentTicket = state.ticket; callbacks.listen(state, 'ticket', (ticket: number) => { currentTicket = ticket; if (registered) { $('ticket-number').textContent = String(ticket).padStart(3, '0'); $('hud-ticket-number').textContent = String(ticket).padStart(3, '0'); } }); return; }
      const avatar = makeSpirit(0x80d8d8, true); avatar.scale.setScalar(.92); scene.add(avatar);
      remotes.set(sessionId, { root: avatar, target: new THREE.Vector3(state.x, state.y??0, state.z), yaw: state.yaw, moving: state.moving,zone:state.zone??'registry',rotation:new THREE.Quaternion(),scale:new THREE.Vector3(1,1,1),clip:state.clip??'',mode:state.experienceStage??'',stageTime:state.stageTime??-1,renderTime:state.stageTime??-1,escortTarget:new THREE.Vector3(state.escortX??0,0,state.escortZ??0),escortYaw:state.escortYaw??0,escortMoving:state.escortMoving??false,escortClip:state.escortClip??'' });
      const updatePose=()=>{const r=remotes.get(sessionId);if(!r)return;r.target.y=state.y??0;r.rotation.setFromEuler(new THREE.Euler(state.pitch??0,state.yaw??0,state.roll??0));r.scale.set(state.sx??1,state.sy??1,state.sz??1);r.clip=state.clip??'';r.mode=state.experienceStage??'';r.stageTime=state.stageTime??-1;r.escortTarget.set(state.escortX??0,0,state.escortZ??0);r.escortYaw=state.escortYaw??0;r.escortMoving=state.escortMoving??false;r.escortClip=state.escortClip??'';};updatePose();
      for(const field of ['y','pitch','roll','sx','sy','sz','clip','experienceStage','stageTime','escortX','escortZ','escortYaw','escortMoving','escortClip'])callbacks.listen(state,field,updatePose);
      callbacks.listen(state, 'zone', (zone:string)=>{const remote=remotes.get(sessionId);if(remote)remote.zone=zone;});
      callbacks.listen(state, 'x', (x: number) => { const remote = remotes.get(sessionId); if (remote) remote.target.x = x; });
      callbacks.listen(state, 'z', (z: number) => { const remote = remotes.get(sessionId); if (remote) remote.target.z = z; });
      callbacks.listen(state, 'yaw', (yaw: number) => { const remote = remotes.get(sessionId); if (remote) remote.yaw = yaw;updatePose(); });
      callbacks.listen(state, 'moving', (value: boolean) => { const remote = remotes.get(sessionId); if (remote) remote.moving = value; });
      updateOnlineCount();
    });
    callbacks.onRemove('players', (_state: unknown, sessionId: string) => { const remote = remotes.get(sessionId); if (remote){cleanupActor(remote.root);scene.remove(remote.root);if(remote.escort){cleanupActor(remote.escort);remote.escort.removeFromParent();}} remotes.delete(sessionId); updateOnlineCount(); });
    room.onLeave(() => {room=undefined;activeVisit?.chaos?.clear();if(experienceRequested)stopExperience();$('online-count').textContent = 'Đã mất kết nối'; });
    $('online-count').textContent = `${room.state.players.size} hồn đang chờ`;
  } catch (error) {
    console.warn('Colyseus room not available yet:', error);
    $('online-count').textContent = 'Đang ở một mình';
  }
}
function updateOnlineCount() { if (room?.state?.players) $('online-count').textContent = `${room.state.players.size} hồn đang chờ`; }
void connectRoom();

let networkTimer = 0;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), .04); const elapsed = clock.elapsedTime;
  // Smooth local movement using a shared frame delta.
  const dir = new THREE.Vector3();
  if (keys.has('KeyW') || keys.has('ArrowUp') || keys.has('touch-forward')) dir.z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown') || keys.has('touch-back')) dir.z += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft') || keys.has('touch-left')) dir.x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight') || keys.has('touch-right')) dir.x += 1;
  if(!entered||mapOpen||experience.active)dir.set(0,0,0);
  const moving = dir.lengthSq() > 0;
  if (moving) {
    dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4.25 : 2.65;
    velocity.lerp(dir.multiplyScalar(speed), 1 - Math.exp(-8.5 * dt));
  } else velocity.lerp(new THREE.Vector3(), 1 - Math.exp(-7 * dt));
  const oldX=player.position.x,oldZ=player.position.z;
  const bounds=activeVisit?.bounds??{x:15,minZ:-40,maxZ:9};
  const wasInsideStage=Boolean(activeVisit?.obstacles.some(o=>o.containsPoint(player.position)));
  if(!experience.active){
    player.position.x=THREE.MathUtils.clamp(oldX+velocity.x*dt,-bounds.x,bounds.x);
    if(!chaosMode&&!wasInsideStage&&activeVisit?.obstacles.some(o=>o.containsPoint(player.position)))player.position.x=oldX;
    player.position.z=THREE.MathUtils.clamp(oldZ+velocity.z*dt,bounds.minZ,bounds.maxZ);
    if(!chaosMode&&!wasInsideStage&&activeVisit?.obstacles.some(o=>o.containsPoint(player.position)))player.position.z=oldZ;
  }
  if (velocity.lengthSq() > .035) {
    const angle = Math.atan2(velocity.x, velocity.z);
    player.rotation.y += Math.atan2(Math.sin(angle-player.rotation.y), Math.cos(angle-player.rotation.y)) * (1-Math.exp(-10*dt));
  }
  if(!experience.active)player.position.y = Math.sin(elapsed * (moving ? 8 : 1.5)) * (moving ? .045 : .055);
  if (!riggedActors.has(player) && player.children[0]) player.children[0].rotation.z = Math.sin(elapsed * (moving ? 8 : 1.5)) * .025;
  const localEmote=chaosEmotes.get(room?localSessionId:'local');
  if(!experience.active&&(!localEmote||localEmote.until<Date.now())){delete player.userData.performanceClip;setActorMoving(player, moving, keys.has('ShiftLeft') || keys.has('ShiftRight'));}
  activeMixers.forEach((mixer) => mixer.update(dt));
  guide.rotation.z = Math.sin(elapsed * .8) * .025; guideHead.rotation.y = Math.sin(elapsed * .55) * .08; guideBell.rotation.z = Math.sin(elapsed * 3) * .18;
  clerk.rotation.z = Math.sin(elapsed * .7) * .018;
  queue.children.forEach((soul, i) => { soul.position.y = Math.sin(elapsed * 1.2 + i) * .045; });
  fogCards.forEach((f, i) => { f.position.x += dt * (i % 2 ? .15 : -.11); if (f.position.x > 17) f.position.x = -17; if (f.position.x < -17) f.position.x = 17; });
  fireGlow.intensity = 2.7 + Math.sin(elapsed * 7) * .22 + Math.sin(elapsed * 11) * .12;
  for (const [sessionId,remote] of remotes) {
    remote.root.visible=remote.zone===currentZone;
    remote.renderTime=remote.stageTime<0?-1:remote.renderTime<0||Math.abs(remote.renderTime-remote.stageTime)>2?remote.stageTime:THREE.MathUtils.damp(remote.renderTime,remote.stageTime,16,dt);
    remote.root.position.lerp(remote.target, 1 - Math.exp(-12 * dt));
    remote.root.quaternion.slerp(remote.rotation,1-Math.exp(-12*dt));remote.root.scale.lerp(remote.scale,1-Math.exp(-12*dt));
    if(!remote.mode)remote.root.position.y = Math.sin(elapsed * (remote.moving ? 8 : 1.5)) * .045;
    const emote=chaosEmotes.get(sessionId);
    if(remote.mode&&remote.clip){remote.root.userData.performanceClip=remote.clip;performActor(remote.root,remote.mode==='performing'&&remote.renderTime>=0?remote.renderTime:elapsed);}else if(emote&&emote.until>Date.now()){remote.root.userData.performanceClip=emote.kind==='pants'?'pull':'pound';performActor(remote.root,(.65-(emote.until-Date.now())/1000)*1.8);}else{delete remote.root.userData.performanceClip;setActorMoving(remote.root,remote.moving);}
    if(remote.mode){
      if(!remote.escort){remote.escort=createZoneActor('demon',remote.escortTarget.x,remote.escortTarget.z,1.1);scene.add(remote.escort);}
      remote.escort.visible=remote.root.visible;
      remote.escort.position.lerp(remote.escortTarget,1-Math.exp(-12*dt));remote.escort.rotation.y+=Math.atan2(Math.sin(remote.escortYaw-remote.escort.rotation.y),Math.cos(remote.escortYaw-remote.escort.rotation.y))*(1-Math.exp(-12*dt));
      const separation=remote.escort.position.clone().sub(remote.root.position).setY(0);if(remote.root.position.y<.5&&separation.length()<ESCORT_MIN_DISTANCE){if(separation.lengthSq()<.001)separation.set(1,0,0);remote.escort.position.copy(remote.root.position).setY(0).addScaledVector(separation.normalize(),ESCORT_MIN_DISTANCE);}
      if(remote.escortClip){remote.escort.userData.performanceClip=remote.escortClip;performActor(remote.escort,elapsed);}else{delete remote.escort.userData.performanceClip;setActorMoving(remote.escort,remote.escortMoving);}
    }else if(remote.escort){cleanupActor(remote.escort);remote.escort.removeFromParent();remote.escort=undefined;}
  }
  if(activeVisit&&!experience.active){const remotePerformer=[...remotes.values()].find(r=>r.zone===currentZone&&r.renderTime>=0&&['positioning','performing','returning'].includes(r.mode));activeVisit.setPerformanceTime(remotePerformer?.renderTime);activeVisit.setParticipant(remotePerformer?.mode==='performing'?remotePerformer.root:undefined);activeVisit.root.traverse(o=>{if(o.userData.role==='victim')o.visible=!remotePerformer;});}
  activeVisit?.update(elapsed,dt);
  experience.update(dt,elapsed);
  if(experience.active)performActor(player,experience.phase==='performing'?(activeVisit?.animationTime??elapsed):elapsed);
  else if(localEmote&&localEmote.until>Date.now()){player.userData.performanceClip=localEmote.kind==='pants'?'pull':'pound';performActor(player,(.65-(localEmote.until-Date.now())/1000)*1.8);}
  if(entered)soundscape.tick(elapsed,player.position.x,player.position.z,activeVisit?.animationTime??elapsed);
  activeVisit?.root.traverse(o=>{if(o.userData.isActor)performActor(o as THREE.Group,o.userData.chaosReaction?elapsed:activeVisit?.animationTime??elapsed);});
  if(currentZone==='registry')performActor(clerk,elapsed);
  refreshChaosUI();
  const cameraOffset = new THREE.Vector3(0, 2.4 + cameraPitch * 3, 6.7).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
  const cameraTarget = cameraOffset.add(player.position);
  const shot=experience.cameraHint();camera.position.lerp(shot?.position??cameraTarget, 1 - Math.exp(-3.5 * dt));
  cameraLookTarget.lerp(shot?.target??new THREE.Vector3(player.position.x,1.15,player.position.z),1-Math.exp(-6*dt));camera.lookAt(cameraLookTarget);
  // Apply a bounded view rotation after camera smoothing so the impact remains crisp.
  if(currentZone==='floor-11'&&activeVisit){const hit=stoneCameraShake(activeVisit.animationTime).multiplyScalar(Math.max(0,1-Math.hypot(player.position.x,player.position.z+5.55)/14));camera.rotateX(hit.y*.25);camera.rotateY(hit.x*.25);camera.rotateZ(hit.z*.15);}
  const nearClerk = currentZone==='registry'&&distanceXZ(player, clerk) < 3.4, nearGuide = distanceXZ(player, guide) < 3.5,worldAction=nearestWorldAction();
  if (entered && !mapOpen && !experience.active && (nearClerk || nearGuide||worldAction)) { $('interaction-label').textContent = worldAction?.label??(nearClerk && !registered ? 'Ghi danh' : 'Nói chuyện'); $('interaction').classList.remove('hidden'); } else $('interaction').classList.add('hidden');
  networkTimer += dt;
  if (room && entered && networkTimer > .05) {const escort=experience.escortPose();sendRoom('move', { x: player.position.x, z: player.position.z, yaw: player.rotation.y, moving:experience.active?['escorting','returning'].includes(experience.phase):moving,y:player.position.y,pitch:player.rotation.x,roll:player.rotation.z,sx:player.scale.x,sy:player.scale.y,sz:player.scale.z,clip:player.userData.performanceClip??'',stage:experience.active?experience.phase:'',stageTime:player.userData.stageTime??-1,escortX:escort?.position.x??0,escortZ:escort?.position.z??0,escortYaw:escort?.yaw??0,escortMoving:escort?.moving??false,escortClip:escort?.clip??'' }); networkTimer = 0; }
  renderer.render(scene, camera);
}
tick();

window.addEventListener('keydown', (event) => { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault(); keys.add(event.code); if (event.code === 'KeyE' && !event.repeat) interact(); if(!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&chaosMode){const action=({KeyF:'hit',KeyG:'smash',KeyR:'pants'} as const)[event.code as 'KeyF'|'KeyG'|'KeyR'];if(action){event.preventDefault();doChaos(action);}} });
window.addEventListener('keyup', (event) => keys.delete(event.code));
canvas.addEventListener('pointerdown', (event) => { dragging = true; lastPointerX = event.clientX; lastPointerY = event.clientY; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointermove', (event) => { if (!dragging||experience.active) return; cameraYaw += (event.clientX - lastPointerX) * .004; cameraPitch = THREE.MathUtils.clamp(cameraPitch + (event.clientY - lastPointerY) * .002, -.5, .8); lastPointerX = event.clientX; lastPointerY = event.clientY; });
canvas.addEventListener('pointerup', () => { dragging = false; });
$('enter-button').addEventListener('click', async () => { entered = true; document.body.classList.add('playing');$('intro').classList.add('dismiss'); $('travel-nav').classList.remove('hidden');$('hud').classList.remove('hidden'); $('mobile-controls').classList.remove('hidden');subtitles.show(zoneDialogue('registry'));if(!audioPreferenceChosen)await ensureAudio();startAmbient('registry');soundscape.setZone('registry'); });
$('close-card').addEventListener('click', () => { $('registration-card').classList.add('hidden'); $('hud').classList.remove('hidden'); $('mobile-controls').classList.remove('hidden'); });
$('mobile-interact').addEventListener('click', interact);
document.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((button) => {
  const key = `touch-${button.dataset.dir}`;
  button.addEventListener('pointerdown', (e) => { e.preventDefault(); keys.add(key); });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, () => keys.delete(key));
});
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.setSize(innerWidth, innerHeight); });
window.addEventListener('blur',()=>keys.clear());
window.addEventListener('keydown',e=>{if(e.code==='Escape'){setChaosMode(false);stopExperience();closeMap();subtitles.clear();}if(e.code==='Space'&&!e.repeat&&subtitles.visible){e.preventDefault();subtitles.next();}});
