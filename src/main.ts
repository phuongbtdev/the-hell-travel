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
import {ChaosLedger,type ChaosAction,type ChaosEvent} from '../shared/chaos';
import {cleanSpiritName} from '../shared/spirit-name';
import {WalkMap,ClickNavigator} from './world/navigation';
import {StableCameraRig} from './world/camera-rig';
import {WorldUI,type WorldHotspot,type WorldButton,isWorldTap} from './world/world-ui';
import {PUNISHMENT_MEDIA_REVISION} from './world/review-times';
import './style.css';
import './mobile.css';
import {GameScreen} from './world/screen-layout';
import {buildBarZone} from './world/bar';
import {createDanceClips} from './world/dances';
import {DANCES,isDance,barSeconds,type DanceId} from '../shared/bar';
import './bar.css';

type RemotePlayerState = { x: number; z: number; yaw: number; moving: boolean; ticket: number;name:string; zone:string;y:number;pitch:number;roll:number;sx:number;sy:number;sz:number;clip:string;experienceStage:string;stageTime:number;escortX:number;escortZ:number;escortYaw:number;escortMoving:boolean;escortClip:string };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const activeMixers = new Set<THREE.AnimationMixer>();
const riggedActors = new WeakMap<THREE.Group, { mixer: THREE.AnimationMixer; idle?: THREE.AnimationAction; walk?: THREE.AnimationAction; run?: THREE.AnimationAction; greet?: THREE.AnimationAction; current?: THREE.AnimationAction; actions:Map<string,THREE.AnimationAction> }>();
const gltfLoader = new GLTFLoader();
const modelPromises = new Map<string, Promise<GLTF>>();
const danceClipCache=new Map<string,THREE.AnimationClip[]>();
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
    if(!danceClipCache.has(url))danceClipCache.set(url,createDanceClips(gltf.scene));
    const controller = { mixer, idle: idleClip ? mixer.clipAction(idleClip) : undefined, walk: walkClip ? mixer.clipAction(walkClip) : undefined, run: runClip ? mixer.clipAction(runClip) : undefined, greet: greetClip ? mixer.clipAction(greetClip) : undefined, current: undefined as THREE.AnimationAction | undefined, actions:new Map([...gltf.animations,...danceClipCache.get(url)!].map(clip=>[clip.name,mixer.clipAction(clip)])) };
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
const gameScreen=new GameScreen($('app'),[
 document.querySelector('.topbar') as HTMLElement,$('travel-nav'),$('zone-description'),$('floor-cinema'),$('guide-bubble'),$('chaos-panel'),$('experience-status'),$('dance-panel'),$('hud'),document.querySelector('.footer') as HTMLElement,$('registration-card'),
],({width,height})=>{
 camera.aspect=width/height;camera.updateProjectionMatrix();
 const ratio=Math.min(devicePixelRatio,1.7);
 if(renderer.getPixelRatio()!==ratio)renderer.setPixelRatio(ratio);
 const current=renderer.getSize(new THREE.Vector2());
 if(current.x!==width||current.y!==height)renderer.setSize(width,height,false);
});
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
const guide = new THREE.Group();guide.userData.assetId='guide'; guide.position.set(-4.3, 0, -1.6); guide.rotation.y = .32; scene.add(guide);
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
const clerk = new THREE.Group();clerk.userData.assetId='clerk'; clerk.position.set(-5.8, 0, .1); clerk.rotation.y = Math.PI; scene.add(clerk);
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
let registered = false, entered = false, audioEnabled = false, currentTicket = 0, room: any, localSessionId = '';
let registrationOpen=false,registrationPending=false,registrationTimer=0,travelling=false;
const savedName=()=>{try{return cleanSpiritName(localStorage.getItem('underworld.name'));}catch{return '';}};
let spiritName=savedName();
const registryBounds={x:10.5,minZ:-31,maxZ:9};
const registryObstacles=[new THREE.Box3(new THREE.Vector3(-7.95,-1,.35),new THREE.Vector3(-3.65,3,1.95)),...[-1,1].map(side=>new THREE.Box3(new THREE.Vector3(side*5.2-1.1,-1,-9.2),new THREE.Vector3(side*5.2+1.1,9,-6.8)))];
const navigator=new ClickNavigator(new WalkMap(registryBounds,registryObstacles));
const velocity=navigator.velocity,cameraRig=new StableCameraRig();cameraRig.reset(player.position);
const worldUI=new WorldUI($('world-ui'),activateHotspot);
const destinationMarker=new THREE.Mesh(new THREE.TorusGeometry(.25,.026,6,32),new THREE.MeshBasicMaterial({color:0xf4c16e,transparent:true,opacity:.85,depthWrite:false}));destinationMarker.rotation.x=-Math.PI/2;destinationMarker.visible=false;scene.add(destinationMarker);
const pointerRay=new THREE.Raycaster(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
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
let danceId:DanceId|undefined,barClockOffset=0,danceGroup:'party'|'street'='street',dancePickerOpen=true;
const barTime=()=>barSeconds(Date.now()+barClockOffset);
const experience=new PunishmentExperience();
let experienceRequested=false,requestedExperienceZone='';
let experienceReplyTimer=0;
let chaosMode=false,chaosPendingUntil=0,filmSuppressed=false;
const soloChaos=new ChaosLedger(),chaosEmotes=new Map<string,{kind:ChaosAction;until:number}>();
let chaosHeat={value:0,at:0};
const startAmbient = (zone: string) => {
  const floor=FLOORS[Number(zone.replace('floor-',''))-1];
  soundscape.setMood(zone==='bar'?'bar':floor?.mood??'hall');
};
function refreshAudioButtons(){for(const id of ['sound-toggle','sound-hud']){const button=$(id);button.textContent=audioEnabled?'♫':'♪';button.setAttribute('aria-pressed',String(audioEnabled));button.title=audioEnabled?'Tắt nhạc và hiệu ứng':'Bật nhạc và hiệu ứng';}refreshDancePanel();}
async function toggleAudio() {audioPreferenceChosen=true;audioEnabled = await soundscape.toggle();refreshAudioButtons();}
async function ensureAudio(){if(!soundscape.enabled){audioEnabled=await soundscape.enable();refreshAudioButtons();}}
$('sound-toggle').addEventListener('click', toggleAudio); $('sound-hud').addEventListener('click', toggleAudio);

function refreshDancePanel(){
 const active=DANCES.find(d=>d.id===danceId);
 $('dance-actions').querySelectorAll<HTMLButtonElement>('button').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.dance===danceId));button.hidden=button.dataset.group!==danceGroup;});
 $('dance-party').setAttribute('aria-pressed',String(danceGroup==='party'));$('dance-street').setAttribute('aria-pressed',String(danceGroup==='street'));
 document.body.classList.toggle('dance-picker-collapsed',Boolean(danceId&&!dancePickerOpen));
 $('change-dance').hidden=!danceId;$('change-dance').textContent=dancePickerOpen?'Thu gọn':'Đổi điệu';$('change-dance').setAttribute('aria-expanded',String(dancePickerOpen));
 ($('stop-dance') as HTMLButtonElement).disabled=!danceId;
 $('dance-status').textContent=active?`${active.label} · chạm mặt đất để đi tiếp${audioEnabled?'':' · nhấn ♫ để bật nhạc'}`:'Chọn điệu để quẩy · chạm mặt đất để đi tiếp';
 $('bar-music').setAttribute('aria-pressed',String(audioEnabled));$('bar-music').setAttribute('aria-label',audioEnabled?'Tắt nhạc bar':'Bật nhạc bar');
}
function stopDance(){
 danceId=undefined;dancePickerOpen=true;if(isDance(player.userData.performanceClip))delete player.userData.performanceClip;
 refreshDancePanel();
}
function chooseDance(id:DanceId){
 if(currentZone!=='bar'||!entered||travelling||mapOpen||registrationOpen||!registered)return;
 navigator.cancel();keys.clear();subtitles.clear();chaosEmotes.delete(room?localSessionId:'local');
 danceId=id;dancePickerOpen=false;danceGroup=DANCES.find(d=>d.id===id)!.group;player.userData.performanceClip=id;player.userData.phase=0;player.userData.performanceSpeed=1;refreshDancePanel();
 if(!audioPreferenceChosen)void ensureAudio();
}
for(const dance of DANCES){
 const button=document.createElement('button');button.type='button';button.dataset.dance=dance.id;button.dataset.group=dance.group;button.setAttribute('aria-pressed','false');
 const icon=document.createElement('span');icon.textContent=dance.icon;icon.setAttribute('aria-hidden','true');button.append(icon,document.createTextNode(dance.label));
 button.addEventListener('click',()=>chooseDance(dance.id));$('dance-actions').append(button);
}
$('stop-dance').addEventListener('click',stopDance);$('bar-music').addEventListener('click',toggleAudio);refreshDancePanel();
for(const group of ['party','street'] as const)$(`dance-${group}`).addEventListener('click',()=>{danceGroup=group;refreshDancePanel();});
$('change-dance').addEventListener('click',()=>{dancePickerOpen=!dancePickerOpen;refreshDancePanel();});

function showToast(message: string) { const toast = $('toast'); toast.textContent = message; toast.classList.add('show'); window.setTimeout(() => toast.classList.remove('show'), 2600); }
function showGuide(message:string,speaker:Speaker='guide'){subtitles.show([{speaker,text:message}]);}
function closeRegistration(){registrationOpen=false;$('registration-dialog').hidden=true;($('spirit-name-input') as HTMLInputElement).blur();}
function openRegistration(){
  if(registered){$('registration-card').classList.remove('hidden');return;}
  navigator.cancel();keys.clear();closeMap();subtitles.clear();registrationOpen=true;$('registration-dialog').hidden=false;
  const input=$('spirit-name-input') as HTMLInputElement;input.value=spiritName;$('registration-error').textContent='';input.focus({preventScroll:true});
}
function acceptRegistration(name:string,ticket:number,showCard=true){
  window.clearTimeout(registrationTimer);registrationPending=false;($('registration-submit') as HTMLButtonElement).disabled=false;
  spiritName=cleanSpiritName(name);registered=true;currentTicket=Math.max(1,ticket);player.userData.spiritName=spiritName;
  try{localStorage.setItem('underworld.name',spiritName);}catch{}
  closeRegistration();$('spirit-name').textContent=spiritName;
  for(const id of ['ticket-number','hud-ticket-number'])$(id).textContent=String(currentTicket).padStart(3,'0');
  if(showCard){$('registration-card').classList.remove('hidden');showToast(`Đã ghi danh ${spiritName}. Mời vong tự do tham quan!`);soundscape.cue('stamp');}
}
$('registration-form').addEventListener('submit',event=>{
  event.preventDefault();if(registrationPending)return;
  const name=cleanSpiritName(($('spirit-name-input') as HTMLInputElement).value);
  if(!name){$('registration-error').textContent='Tên vong hồn không được để trống nhé.';return;}
  spiritName=name;navigator.cancel();
  if(!room){acceptRegistration(name,Math.max(1,currentTicket));return;}
  registrationPending=true;($('registration-submit') as HTMLButtonElement).disabled=true;$('registration-error').textContent='Thư lại đang đóng dấu…';
  sendRoom('register',{name});registrationTimer=window.setTimeout(()=>{registrationPending=false;($('registration-submit') as HTMLButtonElement).disabled=false;$('registration-error').textContent='Chưa nhận được thẻ. Bấm ghi danh để thử lại nhé.';},5000);
});
$('registration-cancel').addEventListener('click',closeRegistration);
function talkToGuide(){greetActor(guide);if(currentZone==='bar'){subtitles.show(zoneDialogue('bar'));return;}const floor=FLOORS[Number(currentZone.replace('floor-',''))-1];showGuide(floor?.joke??(registered?'Bấm mặt đất để đi. Mời ngài ghé Chính Điện hoặc chọn tầng trên bản đồ.':'Bấm nút Ghi danh trên đầu Thư lại ở bàn bên trái, rồi điền tên vong hồn nhé!'));soundscape.cue('bell');}
function configureWalking(){navigator.setMap(new WalkMap(activeVisit?.bounds??registryBounds,chaosMode?[]:activeVisit?.obstacles??registryObstacles));}
function activateHotspot(entry:WorldHotspot,action:WorldButton){
  if(!entered||travelling||mapOpen||registrationOpen||experience.active||entry.object?.userData.disposed||action.disabled?.())return;
  const point=entry.approach?.()??entry.anchor().setY(0),radius=entry.range??2.5;
  if(Math.hypot(player.position.x-point.x,player.position.z-point.z)<=radius){navigator.cancel();keys.clear();action.run();return;}
  subtitles.clear();if(!navigator.go(player.position,point,()=>activateHotspot(entry,action),radius))showToast('Chưa tìm được lối tới chỗ này. Thử bấm một điểm gần hơn nhé.');
}
function rebuildWorldUI(){
  const anchor=(actor:THREE.Object3D)=>()=>{const asset=characterAsset((actor.userData.assetId??'guide') as ActorKind),height=(asset?.height??1.85)*actor.scale.y;return actor.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,height+.25,0));};
  const entries:WorldHotspot[]=[{id:'guide',title:'Tiểu Sai',anchor:anchor(guide),approach:()=>guide.position.clone(),object:guide,range:2.8,priority:10,actions:[{label:'Trò chuyện',run:talkToGuide}]}];
  if(currentZone==='bar')activeVisit?.root.traverse(object=>{
    if(object.userData.role==='bartender')entries.push({id:'mengpo',title:'Mạnh Bà',anchor:anchor(object),object,approach:()=>new THREE.Vector3(-4.4,0,-2.2),range:2,showDistance:11,priority:20,actions:[{label:'Chào Mạnh Bà',run:()=>showGuide('Chào vong! Quầy bên này để quên sầu, sàn bên kia để quên đường về. Tội gì cũng phải quẩy chứ!','mengpo')}]});
    if(object.userData.role==='dj')entries.push({id:'bar-dj',title:'DJ Quỷ Sai',anchor:anchor(object),object,approach:()=>new THREE.Vector3(0,0,-5.7),range:2.0,showDistance:13,priority:15,actions:[{label:'Cùng quẩy tay',run:()=>chooseDance('dance-hands')}]});
  });
  if(currentZone==='registry'){
    entries.push({id:'clerk',title:'Thư lại tiếp dẫn',anchor:anchor(clerk),approach:()=>new THREE.Vector3(-5.8,0,2.65),object:clerk,range:1.65,priority:30,showDistance:9,actions:[{label:()=>registered?'Xem thẻ hồn':'Ghi danh · nhập tên',run:openRegistration}]});
    entries.push({id:'enter-hall',title:'Lối vào Chính Điện',anchor:()=>new THREE.Vector3(0,3,-29),approach:()=>new THREE.Vector3(0,0,-27),range:3,showDistance:10,priority:8,actions:[{label:'Vào Chính Điện',run:()=>travelTo('hall')}]});
  }
  activeVisit?.actions.forEach((a,index)=>{
    let object:THREE.Object3D|undefined;
    if(currentZone==='hall'&&!a.destination)activeVisit!.root.traverse(o=>{if(o.userData.assetId==='judge')object=o;});
    entries.push({id:`action-${index}`,title:object?'Diêm Vương':a.destination?'Cổng tham quan':'Chuyện tầng này',anchor:object?anchor(object):()=>a.position.clone().add(new THREE.Vector3(0,a.destination?2.7:1.25,0)),approach:()=>a.position.clone(),object,range:Math.max(.8,a.radius*.8),showDistance:object?9:a.destination?5.5:4.3,priority:object?25:a.destination?5:1,actions:[{label:object?'Nghe Diêm Vương phán':a.label,run:()=>{if(a.destination)travelTo(a.destination);else readScene();}}]});
  });
  activeVisit?.chaos?.targets.forEach(target=>{
    if(!target.actor)return;const actor=target.actor,id=target.definition.id;
    entries.push({id:`npc-${id}`,title:target.definition.name,anchor:anchor(actor),object:actor,approach:()=>chaosMode?actor.position.clone():new THREE.Vector3(THREE.MathUtils.clamp(actor.position.x,-3.7,3.7),0,-1.5),range:chaosMode?2.2:2.1,showDistance:7,priority:15,actions:[
      {label:'Chuyện tầng này',run:readScene,visible:()=>!chaosMode},
      {label:'Trải nghiệm',run:()=>($('experience-punishment') as HTMLButtonElement).click(),visible:()=>!chaosMode,disabled:()=>Boolean(activeVisit?.chaos?.busy())||experienceRequested},
      {label:'Đánh quỷ sai',run:()=>doChaos('hit',id),visible:()=>chaosMode},
      {label:'Kéo quần',run:()=>doChaos('pants',id),visible:()=>chaosMode},
    ]});
  });
  activeVisit?.chaos?.targets.forEach(target=>{if(target.actor)return;entries.push({id:`prop-${target.definition.id}`,title:target.definition.name,anchor:()=>activeVisit!.chaos!.point(target).add(new THREE.Vector3(0,1.0,0)),approach:()=>activeVisit!.chaos!.point(target),range:2.2,showDistance:5,priority:5,visible:()=>chaosMode&&target.objects.some(o=>o.visible),actions:[{label:'Phá đồ',run:()=>doChaos('smash',target.definition.id)}]});});
  entries.push({id:'self-name',title:()=>spiritName,anchor:()=>player.position.clone().add(new THREE.Vector3(0,2.05,0)),showDistance:Infinity,priority:-2,visible:()=>registered,actions:[]});
  for(const [id,remote] of remotes)entries.push({id:`name-${id}`,title:()=>String(remote.root.userData.spiritName??'Vong vô danh'),anchor:()=>remote.root.position.clone().add(new THREE.Vector3(0,2.05,0)),showDistance:14,priority:-3,visible:()=>remote.zone===currentZone,actions:[]});
  worldUI.replace(entries);
}
function readScene(){
  if(experience.active)return;
  navigator.cancel();
  if(currentZone==='bar'){subtitles.show(zoneDialogue('bar'));return;}
  if(currentZone==='hall'){subtitles.show(judgeVerdict(currentTicket,visited.size));return;}
  const i=Number(currentZone.replace('floor-',''))-1;if(FLOORS[i])subtitles.show(floorNarration(i,FLOORS[i].name));
}
$('read-story').addEventListener('click',readScene);
function expandFilm(expanded:boolean){
 $('floor-cinema').classList.toggle('expanded',expanded);document.body.classList.toggle('film-expanded',expanded);
 const button=$('expand-film');button.setAttribute('aria-expanded',String(expanded));
 button.querySelector('span')!.textContent=expanded?'Đóng cận cảnh':'Xem cận cảnh';button.querySelector('b')!.textContent=expanded?'×':'↗';
 button.setAttribute('aria-label',expanded?'Đóng video cận cảnh':'Mở video cận cảnh');
}
$('expand-film').addEventListener('click',()=>expandFilm(!$('floor-cinema').classList.contains('expanded')));
function distanceXZ(a: THREE.Object3D, b: THREE.Object3D) { return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z); }
function createZoneActor(kind:ActorKind,x:number,z:number,scale=1) {
  const a=new THREE.Group();a.position.set(x,0,z);a.scale.setScalar(scale);a.userData.isActor=true;a.userData.assetId=kind;
  const asset=characterAsset(kind),fallback=new THREE.Group();a.add(fallback);attachRiggedModel(a,fallback,`/models/${asset.file}.glb`,asset.height);
  return a;
}
function cleanupActor(actor:THREE.Object3D){actor.traverse(o=>{o.userData.disposed=true;const controller=riggedActors.get(o as THREE.Group);if(controller){activeMixers.delete(controller.mixer);controller.mixer.stopAllAction();riggedActors.delete(o as THREE.Group);}});}
function sendRoom(type:string,payload:unknown={}){if(room)try{room.send(type,payload);}catch{}}
function refreshExperienceButton(){document.body.classList.toggle('experience-waiting',experienceRequested);const button=$('experience-punishment') as HTMLButtonElement;button.disabled=experience.active||experienceRequested;button.textContent=experience.active?'Đang trải nghiệm…':experienceRequested?'Đang chờ quỷ sai…':'Trải nghiệm hình phạt';}
function setChaosMode(enabled:boolean){
  navigator.cancel();
  chaosMode=enabled&&Boolean(activeVisit?.chaos)&&!experience.active&&!experienceRequested;
  configureWalking();
  document.body.classList.toggle('chaos-mode',chaosMode);$('chaos-panel').hidden=!chaosMode;$('toggle-chaos').setAttribute('aria-pressed',String(chaosMode));$('toggle-chaos').textContent=chaosMode?'Dừng đại náo':'Đại náo tầng này';
  if(chaosMode){subtitles.clear();closeMap();showToast('Bấm nút trên lính hoặc đạo cụ để chọc phá. Coi chừng bị đuổi!');}else activeVisit?.chaos?.highlight();
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
function doChaos(action:ChaosAction,targetId?:string){
  if(!entered||!chaosMode||experience.active||experienceRequested||mapOpen||Date.now()<chaosPendingUntil)return;
  const chaos=activeVisit?.chaos,target=targetId?chaos?.targets.get(targetId):chaos?.nearest(action,player.position);if(!target||chaos!.point(target).clone().sub(player.position).setY(0).length()>2.85){showToast(action==='smash'?'Lại gần đạo cụ hoặc thùng dụng cụ.':'Lại gần quỷ sai đang thi hành án.');return;}navigator.cancel();
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
  navigator.cancel();
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
  if(id!=='registry'&&id!=='hall'&&id!=='bar'&&!/^floor-([1-9]|1[0-8])$/.test(id))return;
  if(!registered&&id!=='registry'){showGuide('Xin ghé quầy ghi danh nhận thẻ hồn trước nhé. Quầy ở bên trái đường đá.');closeMap();return;}
  travelling=true;stopDance();closeRegistration();navigator.cancel();stopExperience();setChaosMode(false);chaosPendingUntil=0;
  closeMap();subtitles.clear();$('registration-card').classList.add('hidden');$('scene-fade').classList.add('active');keys.clear();velocity.set(0,0,0);
  window.setTimeout(()=>{
    currentFilm?.dispose();currentFilm=undefined;filmSuppressed=false;$('floor-cinema').classList.add('hidden');expandFilm(false);
    if(activeVisit){activeVisit.root.traverse(o=>{o.userData.disposed=true;const c=riggedActors.get(o as THREE.Group);if(c){activeMixers.delete(c.mixer);c.mixer.stopAllAction();riggedActors.delete(o as THREE.Group);}});activeVisit.dispose();activeVisit=undefined;}
    currentZone=id;registryEnvironment.visible=id==='registry';queue.visible=id==='registry';clerk.visible=id==='registry';
    document.body.dataset.zone=id;
    if(id!=='registry'){activeVisit=id==='bar'?buildBarZone(createZoneActor,barTime):buildVisitZone(id,createZoneActor);scene.add(activeVisit.root);}
    activeVisit?.chaos?.configure(sid=>sid===(room?localSessionId:'local')?player:remotes.get(sid)?.zone===currentZone?remotes.get(sid)?.root:undefined,(sid,kind)=>{if(kind==='caught'&&sid===(room?localSessionId:'local')){showToast('Bắt quả tang! Quỷ sai gõ đầu: “Quậy nữa ta mách Diêm Vương!”');soundscape.cue('thud');}});
    if(!room)for(const e of soloChaos.snapshot(id))receiveChaos(e,Date.now(),true);
    const f=FLOORS[Number(id.replace('floor-',''))-1];
    if(f){visited.add(Number(id.replace('floor-','')));try{localStorage.setItem('underworld.visited',JSON.stringify([...visited]));}catch{}}
    if(f){const n=String(Number(id.replace('floor-',''))).padStart(2,'0');currentFilm=attachLoopVideo(scene,`/video/floors/floor-${n}.mp4?v=${PUNISHMENT_MEDIA_REVISION}`,new THREE.Vector3(7,3.2,-7),new THREE.Vector2(4,2.25),{video:$('scene-film') as HTMLVideoElement,poster:`/video/floors/floor-${n}.png?v=${PUNISHMENT_MEDIA_REVISION}`});$('floor-cinema').classList.remove('hidden');void currentFilm.play().catch(()=>showToast('Bấm phát trong ô video để xem màn diễn.'));}
    const color=id==='bar'?0x172332:f?.color??0x172128;scene.background=new THREE.Color(color);scene.fog=new THREE.FogExp2(color,id==='hall'||id==='bar'?.013:.022);
    player.position.set(0,0,id==='registry'?4.5:5.5);player.rotation.y=Math.PI;configureWalking();cameraRig.reset(player.position);
    guide.position.set(id==='registry'?-4.3:3.5,0,id==='registry'?-1.6:5.3);guide.rotation.y=id==='registry'?.32:-.7;
    $('zone-name').textContent=f?`TẦNG ${id.replace('floor-','')} · ${f.name.toLocaleUpperCase('vi')}`:id==='bar'?'BAR MẠNH BÀ · QUỶ QUẨY':id==='hall'?'CHÍNH ĐIỆN':'CỬA TIẾP DẪN';
    $('zone-subtitle').textContent=id==='bar'?'TỘI GÌ CŨNG PHẢI QUẨY CHỨ':f?'THẬP BÁT ĐỊA NGỤC · KHÁCH THAM QUAN':id==='hall'?'ĐIỆN XÉT XỬ · 18 CỔNG THAM QUAN':'ÂM PHỦ · KHU GHI DANH';
    $('zone-description').classList.toggle('hidden',id==='registry');$('zone-number').textContent=f?`TẦNG ${id.replace('floor-','')} / 18`:'CHÍNH ĐIỆN';$('zone-title').textContent=f?.name??'Điện xét xử';$('zone-story').textContent=f?.story??'Bẩm Diêm Vương hoặc chọn một trong 18 cổng hai bên điện.';
    $('read-story').textContent=id==='hall'?'Xem Diêm Vương phán':'Đọc chuyện tội và phạt';
    $('experience-punishment').hidden=!f;$('toggle-chaos').hidden=!f;refreshExperienceButton();
    $('dance-panel').hidden=id!=='bar';refreshDancePanel();
    startAmbient(id);soundscape.setZone(id);if(id!=='bar')subtitles.show(zoneDialogue(id));else showToast('Tội gì cũng phải quẩy chứ · chọn điệu để lên sàn!');soundscape.cue('portal');refreshMap();room?.send('zone',{zone:id});sendRoom('chaos:sync');if(id==='bar')sendRoom('bar:sync',{sentAt:Date.now()});$('scene-fade').classList.remove('active');travelling=false;rebuildWorldUI();
    if(f&&visited.size===18)showToast('Đã tham quan đủ 18 tầng. Mời trở về Chính Điện!');
  },160);
}
function nearestWorldAction():ZoneAction|undefined {
  if(currentZone==='registry')return player.position.z < -25?{position:new THREE.Vector3(0,0,-29),radius:6,label:'Bước vào Chính Điện',destination:'hall'}:undefined;
  return activeVisit?.actions.filter(a=>Math.hypot(a.position.x-player.position.x,a.position.z-player.position.z)<a.radius).sort((a,b)=>a.position.distanceToSquared(player.position)-b.position.distanceToSquared(player.position))[0];
}
$('floor-list').innerHTML=FLOORS.map((f,i)=>`<button data-floor="${i+1}"><small>TẦNG ${String(i+1).padStart(2,'0')}</small>${f.name}</button>`).join('');
$('floor-list').querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.addEventListener('click',()=>travelTo(`floor-${b.dataset.floor}`)));
$('go-registry').addEventListener('click',()=>travelTo('registry'));$('go-hall').addEventListener('click',()=>travelTo('hall'));
$('go-bar').addEventListener('click',()=>travelTo('bar'));$('map-bar').addEventListener('click',()=>travelTo('bar'));
$('open-map').addEventListener('click',()=>{navigator.cancel();stopExperience();mapOpen=true;keys.clear();refreshMap();$('map-panel').classList.remove('hidden');});$('close-map').addEventListener('click',closeMap);
function interact() {
  if(!entered||mapOpen||experience.active)return;
  const action=nearestWorldAction();
  if(action){if(action.destination)travelTo(action.destination);else if(action.line){readScene();soundscape.cue('bell');}return;}
  if (currentZone==='registry' && distanceXZ(player, clerk) < 3.4 && !registered) {
    openRegistration();
  } else if (distanceXZ(player, guide) < 3.5) {
    talkToGuide();
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
    room.onMessage('registry:response',(response:{registered:boolean;name?:string;ticket?:number;reason?:string})=>{
      window.clearTimeout(registrationTimer);registrationPending=false;($('registration-submit') as HTMLButtonElement).disabled=false;
      if(!response.registered){$('registration-error').textContent=response.reason??'Chưa thể ghi danh, thử lại nhé.';return;}
      const showCard=!registered||registrationOpen;acceptRegistration(response.name??spiritName,response.ticket??currentTicket,showCard);
      if(currentZone!=='registry'){sendRoom('zone',{zone:currentZone});sendRoom('chaos:sync');if(currentZone==='bar')sendRoom('bar:sync',{sentAt:Date.now()});}
    });
    room.onMessage('presence:count',()=>updateOnlineCount());
    room.onMessage('bar:clock',(message:{serverNow:number;sentAt?:number})=>{
      if(!Number.isFinite(message.serverNow))return;const now=Date.now(),rtt=typeof message.sentAt==='number'?Math.max(0,Math.min(5000,now-message.sentAt)):0;
      barClockOffset=message.serverNow+rtt/2-now;soundscape.setBarClockOffset(barClockOffset);
    });
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
      avatar.userData.spiritName=state.name||`Vong #${state.ticket}`;callbacks.listen(state,'name',(name:string)=>{avatar.userData.spiritName=name;});
      remotes.set(sessionId, { root: avatar, target: new THREE.Vector3(state.x, state.y??0, state.z), yaw: state.yaw, moving: state.moving,zone:state.zone??'registry',rotation:new THREE.Quaternion(),scale:new THREE.Vector3(1,1,1),clip:state.clip??'',mode:state.experienceStage??'',stageTime:state.stageTime??-1,renderTime:state.stageTime??-1,escortTarget:new THREE.Vector3(state.escortX??0,0,state.escortZ??0),escortYaw:state.escortYaw??0,escortMoving:state.escortMoving??false,escortClip:state.escortClip??'' });
      const updatePose=()=>{const r=remotes.get(sessionId);if(!r)return;r.target.y=state.y??0;r.rotation.setFromEuler(new THREE.Euler(state.pitch??0,state.yaw??0,state.roll??0));r.scale.set(state.sx??1,state.sy??1,state.sz??1);r.clip=state.clip??'';r.mode=state.experienceStage??'';r.stageTime=state.stageTime??-1;r.escortTarget.set(state.escortX??0,0,state.escortZ??0);r.escortYaw=state.escortYaw??0;r.escortMoving=state.escortMoving??false;r.escortClip=state.escortClip??'';};updatePose();
      for(const field of ['y','pitch','roll','sx','sy','sz','clip','experienceStage','stageTime','escortX','escortZ','escortYaw','escortMoving','escortClip'])callbacks.listen(state,field,updatePose);
      callbacks.listen(state, 'zone', (zone:string)=>{const remote=remotes.get(sessionId);if(remote)remote.zone=zone;});
      callbacks.listen(state, 'x', (x: number) => { const remote = remotes.get(sessionId); if (remote) remote.target.x = x; });
      callbacks.listen(state, 'z', (z: number) => { const remote = remotes.get(sessionId); if (remote) remote.target.z = z; });
      callbacks.listen(state, 'yaw', (yaw: number) => { const remote = remotes.get(sessionId); if (remote) remote.yaw = yaw;updatePose(); });
      callbacks.listen(state, 'moving', (value: boolean) => { const remote = remotes.get(sessionId); if (remote) remote.moving = value; });
      rebuildWorldUI();
      updateOnlineCount();
    });
    callbacks.onRemove('players', (_state: unknown, sessionId: string) => { const remote = remotes.get(sessionId); if (remote){cleanupActor(remote.root);scene.remove(remote.root);if(remote.escort){cleanupActor(remote.escort);remote.escort.removeFromParent();}} remotes.delete(sessionId);worldUI.remove(`name-${sessionId}`);updateOnlineCount(); });
    room.onLeave(() => {room=undefined;activeVisit?.chaos?.clear();if(experienceRequested)stopExperience();if(registrationPending){registrationPending=false;window.clearTimeout(registrationTimer);acceptRegistration(spiritName,Math.max(1,currentTicket));}$('online-count').textContent = 'Đang ở một mình'; });
    if(registered)sendRoom('register',{name:spiritName});
    $('online-count').textContent = `${room.state.players.size} hồn đang chờ`;
  } catch (error) {
    console.warn('Colyseus room not available yet:', error);
    $('online-count').textContent = 'Đang ở một mình';
  }
}
function updateOnlineCount() { if (room?.state?.players) $('online-count').textContent = `${room.state.players.size} hồn đang chờ`; }
void connectRoom();
rebuildWorldUI();

let networkTimer = 0;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), .05); const elapsed = clock.elapsedTime;
  const dir = new THREE.Vector3();
  if (keys.has('KeyW') || keys.has('ArrowUp')) dir.z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dir.z += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dir.x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dir.x += 1;
  const blocked=!entered||mapOpen||registrationOpen||experience.active||travelling;
  if(blocked)navigator.cancel();
  const moving=!blocked&&navigator.step(player.position,dt,dir,keys.has('ShiftLeft')||keys.has('ShiftRight')?4.25:3.05);
  if(danceId&&(moving||currentZone!=='bar'))stopDance();
  if(danceId){player.rotation.y+=Math.atan2(Math.sin(-player.rotation.y),Math.cos(-player.rotation.y))*(1-Math.exp(-8*dt));}
  const destination=navigator.destination;destinationMarker.visible=Boolean(destination)&&!blocked;
  if(destination){destinationMarker.position.set(destination.x,activeVisit?.obstacles.some(b=>b.containsPoint(destination))?.5:.06,destination.z);destinationMarker.scale.setScalar(1+Math.sin(elapsed*5)*.08);}
  if (velocity.lengthSq() > .035) {
    const angle = Math.atan2(velocity.x, velocity.z);
    player.rotation.y += Math.atan2(Math.sin(angle-player.rotation.y), Math.cos(angle-player.rotation.y)) * (1-Math.exp(-10*dt));
  }
  if(!experience.active)player.position.y = danceId?0:Math.sin(elapsed * (moving ? 8 : 1.5)) * (moving ? .045 : .055);
  if (!riggedActors.has(player) && player.children[0]) player.children[0].rotation.z = Math.sin(elapsed * (moving ? 8 : 1.5)) * .025;
  const localEmote=chaosEmotes.get(room?localSessionId:'local');
  if(!experience.active&&!danceId&&(!localEmote||localEmote.until<Date.now())){delete player.userData.performanceClip;setActorMoving(player, moving, keys.has('ShiftLeft') || keys.has('ShiftRight'));}
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
    if(!remote.mode)remote.root.position.y = remote.zone==='bar'&&isDance(remote.clip)&&!remote.moving?0:Math.sin(elapsed * (remote.moving ? 8 : 1.5)) * .045;
    const emote=chaosEmotes.get(sessionId);
    if(remote.zone==='bar'&&isDance(remote.clip)&&!remote.moving){remote.root.userData.performanceClip=remote.clip;performActor(remote.root,barTime());}
    else if(remote.mode&&remote.clip){remote.root.userData.performanceClip=remote.clip;performActor(remote.root,remote.mode==='performing'&&remote.renderTime>=0?remote.renderTime:elapsed);}else if(emote&&emote.until>Date.now()){remote.root.userData.performanceClip=emote.kind==='pants'?'pull':'pound';performActor(remote.root,(.65-(emote.until-Date.now())/1000)*1.8);}else{delete remote.root.userData.performanceClip;setActorMoving(remote.root,remote.moving);}
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
  else if(danceId){player.userData.performanceClip=danceId;performActor(player,barTime());}
  else if(localEmote&&localEmote.until>Date.now()){player.userData.performanceClip=localEmote.kind==='pants'?'pull':'pound';performActor(player,(.65-(localEmote.until-Date.now())/1000)*1.8);}
  if(entered)soundscape.tick(elapsed,player.position.x,player.position.z,activeVisit?.animationTime??elapsed);
  activeVisit?.root.traverse(o=>{if(o.userData.isActor)performActor(o as THREE.Group,o.userData.chaosReaction?elapsed:activeVisit?.animationTime??elapsed);});
  activeVisit?.finishFrame();
  if(currentZone==='registry')performActor(clerk,elapsed);
  refreshChaosUI();
  const shot=['positioning','performing'].includes(experience.phase)?experience.cameraHint():undefined;
  cameraRig.update(camera,player.position,dt,shot,currentZone==='bar'&&gameScreen.compact);
  worldUI.update(camera,player.position,gameScreen.size.width,gameScreen.size.height,entered&&!mapOpen&&!registrationOpen&&!experience.active&&!travelling&&!document.body.classList.contains('film-expanded')&&(!gameScreen.compact||!subtitles.visible),gameScreen.blocked);
  networkTimer += dt;
  if (room && entered && networkTimer > .05) {const escort=experience.escortPose();sendRoom('move', { x: player.position.x, z: player.position.z, yaw: player.rotation.y, moving:experience.active?['escorting','returning'].includes(experience.phase):moving,y:player.position.y,pitch:player.rotation.x,roll:player.rotation.z,sx:player.scale.x,sy:player.scale.y,sz:player.scale.z,clip:player.userData.performanceClip??'',stage:experience.active?experience.phase:'',stageTime:player.userData.stageTime??-1,escortX:escort?.position.x??0,escortZ:escort?.position.z??0,escortYaw:escort?.yaw??0,escortMoving:escort?.moving??false,escortClip:escort?.clip??'' }); networkTimer = 0; }
  renderer.render(scene, camera);
}
tick();

function tapWorld(event:PointerEvent){
  if(!entered||travelling||mapOpen||registrationOpen||experience.active)return;
  const rect=canvas.getBoundingClientRect(),point=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  pointerRay.setFromCamera(point,camera);const picked=worldUI.pick(pointerRay);
  if(picked){activateHotspot(picked.definition,picked.button);return;}
  const destination=pointerRay.ray.intersectPlane(groundPlane,new THREE.Vector3());if(!destination)return;
  if(danceId)stopDance();
  subtitles.clear();$('registration-card').classList.add('hidden');keys.clear();
  if(!navigator.go(player.position,destination))showToast('Chỗ này chưa có lối đi. Bấm một điểm khác nhé.');
}
let pointerDown:{id:number;x:number;y:number;touch:boolean;moved:boolean}|undefined;
canvas.addEventListener('pointerdown',event=>{if(!event.isPrimary||event.button!==0)return;pointerDown={id:event.pointerId,x:event.clientX,y:event.clientY,touch:event.pointerType!=='mouse',moved:false};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{if(pointerDown?.id===event.pointerId&&!isWorldTap(pointerDown,{x:event.clientX,y:event.clientY},pointerDown.touch))pointerDown.moved=true;});
canvas.addEventListener('pointerup',event=>{const start=pointerDown;pointerDown=undefined;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(start?.id===event.pointerId&&!start.moved&&isWorldTap(start,{x:event.clientX,y:event.clientY},start.touch))tapWorld(event);});
canvas.addEventListener('pointercancel',()=>{pointerDown=undefined;});
window.addEventListener('keydown',event=>{
  if(event.code==='Escape'){stopDance();expandFilm(false);closeRegistration();navigator.cancel();setChaosMode(false);stopExperience();closeMap();subtitles.clear();return;}
  const element=event.target as HTMLElement|null;
  if(registrationOpen||element?.closest('input,textarea,select,[contenteditable=true]'))return;
  if(currentZone==='bar'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&/^Digit[1-6]$/.test(event.code)){chooseDance(DANCES[Number(event.code.slice(-1))-1].id);return;}
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();keys.add(event.code);
  if(event.code==='KeyE'&&!event.repeat)interact();
  if(event.code==='Space'&&!event.repeat&&subtitles.visible&&!element?.closest('button,a')){event.preventDefault();subtitles.next();}
  if(!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&chaosMode){const action=({KeyF:'hit',KeyG:'smash',KeyR:'pants'} as const)[event.code as 'KeyF'|'KeyG'|'KeyR'];if(action){event.preventDefault();doChaos(action);}}
});
window.addEventListener('keyup',event=>keys.delete(event.code));
$('enter-button').addEventListener('click',async()=>{entered=true;cameraRig.reset(player.position);document.body.classList.add('playing');$('intro').classList.add('dismiss');$('travel-nav').classList.remove('hidden');$('hud').classList.remove('hidden');subtitles.show(zoneDialogue('registry'));if(!audioPreferenceChosen)await ensureAudio();startAmbient('registry');soundscape.setZone('registry');});
$('close-card').addEventListener('click',()=>{$('registration-card').classList.add('hidden');$('hud').classList.remove('hidden');});
const fitRegistration=()=>{$('registration-dialog').style.setProperty('--dialog-height',`${window.visualViewport?.height??innerHeight}px`);};window.visualViewport?.addEventListener('resize',fitRegistration);fitRegistration();
window.addEventListener('blur',()=>{keys.clear();navigator.cancel();pointerDown=undefined;});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentZone==='bar'){soundscape.setBarClockOffset(barClockOffset);sendRoom('bar:sync',{sentAt:Date.now()});}});
