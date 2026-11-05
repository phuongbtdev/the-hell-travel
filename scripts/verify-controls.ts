import assert from 'node:assert/strict';
import * as T from 'three';
import {WalkMap,ClickNavigator} from '../src/world/navigation.ts';
import {StableCameraRig} from '../src/world/camera-rig.ts';
import {projectWorldPoint,isWorldTap,WorldUI} from '../src/world/world-ui.ts';
import {badgeRect,compactScreen,overlaps,GameScreen} from '../src/world/screen-layout.ts';
import {buildVisitZone} from '../src/world/underworld.ts';
import {cleanSpiritName} from '../shared/spirit-name.ts';
import {UnderworldRoom,PlayerState} from '../server/src/UnderworldRoom.ts';

(globalThis as any).document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const actor=(kind:string,x:number,z:number,s=1)=>{const a=new T.Group();a.position.set(x,0,z);a.scale.setScalar(s);a.userData.assetId=kind;a.userData.isActor=true;return a;};
function walk(map:WalkMap,from:T.Vector3,to:T.Vector3,dt:number,radius?:number){
 const nav=new ClickNavigator(map),position=from.clone();let arrivals=0;
 assert.ok(nav.go(position,to,()=>arrivals++,radius),'No route found');let frames=0;
 while(nav.active&&frames++<Math.ceil(40/dt)){nav.step(position,dt);assert.ok(map.free(position.x,position.z),'Path entered an obstacle');assert.ok(nav.velocity.length()<=3.001,'Movement exceeded speed cap');}
 assert.ok(!nav.active,`Navigation stalled at ${position.toArray()} towards ${to.toArray()}`);assert.equal(arrivals,1);
 if(radius)assert.ok(position.distanceTo(to)<=radius+.01);else assert.ok(position.distanceTo(to)<.08);
 return position;
}
for(const id of ['hall',...Array.from({length:18},(_,i)=>`floor-${i+1}`)]){
 const zone=buildVisitZone(id,actor),map=new WalkMap(zone.bounds,zone.obstacles);
 for(const dt of [1/20,1/60,1/144])walk(map,new T.Vector3(0,0,5.5),new T.Vector3(id==='hall'?8:0,0,-13),dt);
 const blocked=new T.Vector3(0,0,id==='hall'?-13:-6),path=map.route(new T.Vector3(0,0,5.5),blocked);assert.ok(path.length);assert.ok(map.free(path.at(-1)!.x,path.at(-1)!.z));
 const nav=new ClickNavigator(map),p=new T.Vector3(0,0,5.5);nav.go(p,new T.Vector3(8,0,5));for(let n=0;n<25;n++)nav.step(p,1/60);nav.go(p,new T.Vector3(-8,0,5));for(let n=0;n<600&&nav.active;n++)nav.step(p,1/60);assert.ok(p.distanceTo(new T.Vector3(-8,0,5))<.1,'Re-targeting failed');
 zone.dispose();
}
const desk=new T.Box3(new T.Vector3(-7.95,-1,.35),new T.Vector3(-3.65,3,1.95)),registry=new WalkMap({x:10.5,minZ:-31,maxZ:9},[desk]);
walk(registry,new T.Vector3(0,0,4.5),new T.Vector3(-5.8,0,2.65),1/60,1.65);
walk(registry,new T.Vector3(-5.8,0,4),new T.Vector3(-5.8,0,-2),1/60);
const trapped=new ClickNavigator(new WalkMap({x:11,minZ:-15,maxZ:9},[new T.Box3(new T.Vector3(-5,-1,-10.5),new T.Vector3(5,5,-2.8))])),escape=new T.Vector3(0,0,-6);
assert.ok(trapped.go(escape,new T.Vector3(0,0,4)));for(let n=0;n<1200&&trapped.active;n++)trapped.step(escape,1/60);assert.ok(escape.distanceTo(new T.Vector3(0,0,4))<.1,'Could not leave stage after disabling chaos');
const nav=new ClickNavigator(registry),p=new T.Vector3(0,0,4);let called=false;nav.go(p,new T.Vector3(5,0,4),()=>{called=true;});nav.cancel();for(let i=0;i<100;i++)nav.step(p,.016);assert.equal(called,false);assert.deepEqual(p.toArray(),[0,0,4]);
assert.equal(isWorldTap({x:10,y:10},{x:13,y:13}),true);assert.equal(isWorldTap({x:10,y:10},{x:40,y:12},true),false);
for(const aspect of [16/9,390/844]){
 const camera=new T.PerspectiveCamera(43,aspect,.1,160),rig=new StableCameraRig(),position=new T.Vector3(0,0,4.5);rig.reset(position);
 for(let n=0;n<240;n++)rig.update(camera,position,1/60);
 const orientation=camera.quaternion.clone();for(let n=0;n<300;n++){position.x=Math.sin(n*.02)*5;position.z-=.03;rig.update(camera,position,1/60);assert.ok(camera.quaternion.angleTo(orientation)<.0001,'Camera orbited while walking');}
 const projected=projectWorldPoint(position.clone().add(new T.Vector3(0,2,0)),camera,390,844);assert.ok(projected&&projected.x>0&&projected.x<390&&projected.y>0&&projected.y<844,'Overhead button is off screen');
 assert.equal(projectWorldPoint(camera.position.clone().add(new T.Vector3(0,0,5)),camera,390,844),undefined);
}
for(const aspect of [16/9,390/844]){const camera=new T.PerspectiveCamera(43,aspect,.1,160),rig=new StableCameraRig(),p=new T.Vector3(0,0,-10.4);rig.reset(p);for(let i=0;i<240;i++)rig.update(camera,p,1/60);const judge=projectWorldPoint(new T.Vector3(0,5.5,-14.2),camera,aspect<1?390:1440,844);assert.ok(judge&&judge.y>=148,'Judge overhead button is unreachable in this camera');}
assert.equal(cleanSpiritName('  Vong   hết deadline  '),'Vong hết deadline');assert.equal(cleanSpiritName('   '),'');assert.equal(cleanSpiritName({name:'fake'}),'');assert.equal(Array.from(cleanSpiritName('a'.repeat(50))).length,24);assert.equal(cleanSpiritName('Vo\u0300ng'),'Vòng');
const room=new UnderworldRoom(),messages:{type:string;payload:any}[]=[],client={sessionId:'named',enqueueRaw(){},send:(type:string,payload:any)=>messages.push({type,payload})};room.clients.push(client as any);room.state.players.set('named',new PlayerState({ticket:7}));
room.messages.register(client as any,{name:'   '});assert.equal(room.state.players.get('named')!.registered,false);
room.messages.register(client as any,{name:'  Vong Deadline  '});assert.equal(room.state.players.get('named')!.name,'Vong Deadline');assert.equal(messages.at(-1)!.payload.ticket,7);assert.equal(room.state.players.get('named')!.registered,true);
room.messages.register(client as any,{name:'Tên khác'});assert.equal(room.state.players.get('named')!.name,'Vong Deadline');
class Element {
 hidden=false;disabled=false;type='';className='';textContent='';style:Record<string,string>={};children:Element[]=[];parent?:Element;attributes=new Map<string,string>();listeners=new Map<string,(event:any)=>void>();classList={toggle(){}};
 append(e:Element){e.parent=this;this.children.push(e);}remove(){if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this);}addEventListener(type:string,run:(event:any)=>void){this.listeners.set(type,run);}setAttribute(name:string,value:string){this.attributes.set(name,value);}click(){this.listeners.get('click')?.({stopPropagation(){}});}set innerHTML(_value:string){throw Error('Unsafe HTML was used for a spirit name');}
}
(globalThis as any).document={createElement:()=>new Element()};
const layer=new Element(),camera=new T.PerspectiveCamera(43,390/844,.1,160);camera.position.set(0,8.6,12.4);camera.lookAt(0,2,-4);camera.updateMatrixWorld(true);let activated=0,disabled=false,name='Thư lại';
const ui=new WorldUI(layer as any,(_entry,action)=>{action.run();activated++;});ui.add({id:'clerk',title:()=>name,anchor:()=>new T.Vector3(0,2,0),actions:[{label:'Ghi danh',run(){},disabled:()=>disabled}]});
ui.update(camera,new T.Vector3(),390,844,true);const badge=layer.children[0],button=badge.children[1];assert.equal(badge.hidden,false);button.click();assert.equal(activated,1);
disabled=true;name='<b>Vong</b>';ui.update(camera,new T.Vector3(),390,844,true);button.click();assert.equal(activated,1);assert.equal(badge.children[0].textContent,name);ui.update(camera,new T.Vector3(),390,844,false);assert.equal(badge.hidden,true);ui.clear();assert.equal(layer.children.length,0);
// Regression: mobile controls stay attached to their actor and never cover the action dock.
for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:1440,height:900}]){
 const blockers=[{x:0,y:0,width:size.width,height:112},{x:12,y:size.height-166,width:Math.min(size.width-24,400),height:150}];
 for(let y=0;y<size.height;y+=7)for(let x=0;x<size.width;x+=47){const rect=badgeRect({x,y},size,176,81,blockers);if(!rect)continue;assert.ok(rect.x>=8&&rect.x+rect.width<=size.width-8);assert.ok(!blockers.some(b=>overlaps(rect,b)));assert.equal(rect.y+rect.height,y-8,'Badge moved away from its actor to avoid a panel');}
}
assert.ok(compactScreen({width:844,height:390}));assert.ok(!compactScreen({width:1440,height:900}));
ui.add({id:'first',title:'Quỷ sai 1',anchor:()=>new T.Vector3(0,2,0),priority:15,actions:[{label:'Trải nghiệm',run(){}}]});
let second=new T.Vector3(.1,2,.1);ui.add({id:'second',title:'Quỷ sai 2',anchor:()=>second,priority:15,actions:[{label:'Trải nghiệm',run(){}}]});
const visibleBadges=()=>layer.children.filter(e=>!e.hidden&&e.className==='world-hotspot');
ui.update(camera,new T.Vector3(),390,844,true);assert.equal(visibleBadges().length,1);const chosen=visibleBadges()[0];
for(let i=0;i<120;i++){second.set(Math.sin(i)*.1,2,Math.cos(i)*.1);ui.update(camera,new T.Vector3(),390,844,true);assert.equal(visibleBadges().length,1);assert.equal(visibleBadges()[0],chosen,'Mobile badge switched between nearby guards');}
ui.update(camera,new T.Vector3(),390,844,true,[{x:0,y:112,width:390,height:700}]);assert.equal(visibleBadges().length,0,'Badge covered an open panel');
ui.clear();
// The CSS app box can differ from innerWidth after mobile resize or browser chrome changes.
let measured={width:390,height:844},resizeObserver:()=>void=()=>{},queued:(()=>void)[]=[];
(globalThis as any).ResizeObserver=class{constructor(cb:()=>void){resizeObserver=cb;}observe(){}};
(globalThis as any).MutationObserver=class{observe(){}};
(globalThis as any).window={innerWidth:780,innerHeight:1688,addEventListener(){},visualViewport:{addEventListener(){}}};
(globalThis as any).requestAnimationFrame=(cb:()=>void)=>{queued.push(cb);return queued.length;};
(globalThis as any).getComputedStyle=()=>({display:'block',visibility:'visible'});
(globalThis as any).document.body={};
const root={get clientWidth(){return measured.width;},get clientHeight(){return measured.height;},getBoundingClientRect:()=>({left:20,top:30})};
const panel={hidden:false,classList:{contains:()=>false},getBoundingClientRect:()=>({left:32,top:700,width:366,height:130})};
const reported:{width:number;height:number}[]=[];
const screen=new GameScreen(root as any,[panel as any],size=>reported.push(size));assert.deepEqual(screen.size,measured);assert.deepEqual(screen.blocked,[{x:12,y:670,width:366,height:130}]);
measured={width:844,height:390};resizeObserver();while(queued.length)queued.shift()!();assert.deepEqual(screen.size,measured);assert.equal(reported.at(-1)!.width,844);
console.log('OK: paths on 19 zones at 20/60/144 Hz, obstacles/arrival/cancellation, stage escape, taps, stable portrait/landscape cameras, judge visibility, clickable/disabled safe-text badges and named registration.');
console.log('OK: mobile dock exclusion, one stable NPC badge, portrait/landscape bounds and shared CSS/WebGL viewport after resize.');
