import * as T from 'three';
import {badgeRect,compactScreen,type ScreenRect} from './screen-layout';

export type WorldButton={label:string|(()=>string);run:()=>void;visible?:()=>boolean;disabled?:()=>boolean};
export type WorldHotspot={id:string;title:string|(()=>string);anchor:()=>T.Vector3;approach?:()=>T.Vector3;range?:number;showDistance?:number;object?:T.Object3D;visible?:()=>boolean;priority?:number;actions:WorldButton[]};
const text=(value:string|(()=>string))=>typeof value==='function'?value():value;
export function projectWorldPoint(point:T.Vector3,camera:T.Camera,width:number,height:number){
 const view=point.clone().applyMatrix4(camera.matrixWorldInverse);if(view.z>=-.1)return;
 const p=point.clone().project(camera);if(p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1)return;
 return {x:(p.x*.5+.5)*width,y:(-.5*p.y+.5)*height};
}
export const isWorldTap=(start:{x:number;y:number},end:{x:number;y:number},touch=false)=>Math.hypot(end.x-start.x,end.y-start.y)<(touch?16:8);

/** Screen-space buttons anchored to the real 3D actors, with native touch/keyboard semantics. */
export class WorldUI {
 private entries=new Map<string,{definition:WorldHotspot;element:HTMLDivElement;title:HTMLElement;buttons:HTMLButtonElement[]}>();
 private preferred?:string;
 private pressed?:string;
 constructor(private layer:HTMLElement,private activate:(entry:WorldHotspot,button:WorldButton)=>void){}
 replace(definitions:WorldHotspot[]){this.clear();definitions.forEach(d=>this.add(d));}
 add(definition:WorldHotspot){
  this.remove(definition.id);const element=document.createElement('div');element.className=definition.actions.length?'world-hotspot':'world-nameplate';element.hidden=true;
  const title=document.createElement('strong');title.textContent=text(definition.title);element.append(title);
  const buttons=definition.actions.map(action=>{const b=document.createElement('button');b.type='button';b.textContent=text(action.label);b.addEventListener('click',event=>{event.stopPropagation();if(!b.disabled)this.activate(definition,action);});element.append(b);return b;});
  element.addEventListener('pointerdown',()=>{this.pressed=definition.id;});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(event,()=>{this.pressed=undefined;});
  this.layer.append(element);this.entries.set(definition.id,{definition,element,title,buttons});
 }
 remove(id:string){this.entries.get(id)?.element.remove();this.entries.delete(id);}
 clear(){this.entries.forEach(e=>e.element.remove());this.entries.clear();this.preferred=undefined;this.pressed=undefined;}
 update(camera:T.Camera,player:T.Vector3,width:number,height:number,enabled:boolean,blocked:ScreenRect[]=[]){
  const candidates:{entry:ReturnType<WorldUI['get']>;point:{x:number;y:number};distance:number}[]=[];
  const rendered=new Set<HTMLDivElement>();
  for(const entry of this.entries.values()){
   const d=entry.definition;if(!enabled||d.visible&&!d.visible())continue;
   const p=d.anchor(),distance=Math.hypot(player.x-p.x,player.z-p.z);if(distance>(d.showDistance??6.8))continue;
   const point=projectWorldPoint(p,camera,width,height);if(!point||point.y<86||point.y>height-64)continue;
   candidates.push({entry,point,distance});
  }
  candidates.sort((a,b)=>(b.entry.definition.priority??0)-(a.entry.definition.priority??0)||a.distance-b.distance);
  const compact=compactScreen({width,height});
  if(compact){
   const interactive=candidates.filter(c=>c.entry.definition.actions.length),best=interactive[0];
   const previous=interactive.find(c=>c.entry.definition.id===(this.pressed??this.preferred));
   if(previous&&best&&((previous.entry.definition.priority??0)===(best.entry.definition.priority??0)&&previous.distance<=best.distance+1.2||this.pressed)){
    candidates.splice(candidates.indexOf(previous),1);candidates.unshift(previous);
   }
  }
  const occupied:ScreenRect[]=[];let shown=0,interactiveShown=0;
  for(const {entry,point} of candidates){
   const d=entry.definition;if(shown>7)break;
   if(compact&&d.actions.length&&interactiveShown)continue;
   let buttons=0;entry.buttons.forEach((b,i)=>{const action=d.actions[i];b.hidden=Boolean(action.visible&&!action.visible());b.disabled=Boolean(action.disabled?.());if(!b.hidden)buttons++;const label=text(action.label);if(b.textContent!==label)b.textContent=label;b.setAttribute('aria-label',`${label} · ${text(d.title)}`);});
   if(d.actions.length&&!buttons)continue;
   const boxWidth=d.actions.length?176:130,boxHeight=buttons?32+Math.ceil(buttons/2)*49:26;
   const rect=badgeRect(point,{width,height},boxWidth,boxHeight,[...blocked,...occupied]);if(!rect)continue;
   entry.element.classList.toggle('single-action',buttons===1);
   // Holding a touch target keeps its position until the click finishes.
   if(this.pressed===d.id&&!entry.element.hidden){rendered.add(entry.element);interactiveShown++;continue;}
   occupied.push(rect);const title=text(d.title);if(entry.title.textContent!==title)entry.title.textContent=title;
   entry.element.style.transform=`translate3d(${Math.round(rect.x+rect.width/2)}px,${Math.round(rect.y+rect.height)}px,0) translate(-50%,-100%)`;rendered.add(entry.element);shown++;
   if(d.actions.length){interactiveShown++;this.preferred=d.id;}
  }
  for(const e of this.entries.values()){const hidden=!rendered.has(e.element);if(e.element.hidden!==hidden)e.element.hidden=hidden;}
 }
 private get(id:string){return this.entries.get(id)!;}
 pick(raycaster:T.Raycaster){
  let found:{definition:WorldHotspot;button:WorldButton;distance:number}|undefined;
  for(const {definition:d} of this.entries.values()){
   if(!d.object||!d.object.visible||!d.actions.length||d.visible&&!d.visible())continue;
   const button=d.actions.find(a=>(!a.visible||a.visible())&&(!a.disabled||!a.disabled()));if(!button)continue;
   const hit=raycaster.intersectObject(d.object,true)[0];if(hit&&(!found||hit.distance<found.distance))found={definition:d,button,distance:hit.distance};
  }
  return found;
 }
}
