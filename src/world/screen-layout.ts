export type ScreenRect={x:number;y:number;width:number;height:number};
export type ScreenSize={width:number;height:number};
export const compactScreen=({width,height}:ScreenSize)=>width<=700||(width<=950&&height<=500);
export function overlaps(a:ScreenRect,b:ScreenRect,gap=6){
 return a.x<b.x+b.width+gap&&a.x+a.width>b.x-gap&&a.y<b.y+b.height+gap&&a.y+a.height>b.y-gap;
}
/** A badge stays above its actor; covered badges wait instead of jumping around the HUD. */
export function badgeRect(point:{x:number;y:number},size:ScreenSize,width:number,height:number,blocked:ScreenRect[]=[]){
 if(size.width<width+16)return;
 const x=Math.max(8,Math.min(size.width-width-8,point.x-width/2)),y=point.y-height-8;
 const rect={x,y,width,height};
 if(y<8||point.y>size.height-8||blocked.some(b=>overlaps(rect,b)))return;
 return rect;
}

/** Share the app's CSS size across WebGL, ray casting and projected HTML controls. */
export class GameScreen {
 size:ScreenSize={width:1,height:1};
 blocked:ScreenRect[]=[];
 private pending=0;
 constructor(private root:HTMLElement,private panels:HTMLElement[],private resize:(size:ScreenSize)=>void){
  this.measure();
  const observer=new ResizeObserver(()=>this.schedule());
  observer.observe(root);panels.forEach(p=>observer.observe(p));
  const mutations=new MutationObserver(records=>{
   if(records.some(r=>r.oldValue!==(r.target as HTMLElement).getAttribute(r.attributeName!)))this.schedule();
  });
  panels.forEach(p=>mutations.observe(p,{attributes:true,attributeOldValue:true,attributeFilter:['class','hidden']}));
  mutations.observe(document.body,{attributes:true,attributeOldValue:true,attributeFilter:['class']});
  window.addEventListener('resize',()=>this.schedule());
  window.visualViewport?.addEventListener('resize',()=>this.schedule());
  document.fonts?.ready.then(()=>this.schedule());
 }
 get compact(){return compactScreen(this.size);}
 private schedule(){if(!this.pending)this.pending=requestAnimationFrame(()=>{this.pending=0;this.measure();});}
 private measure(){
  const width=Math.max(1,this.root.clientWidth),height=Math.max(1,this.root.clientHeight);
  this.size={width,height};this.resize(this.size);
  const root=this.root.getBoundingClientRect();
  this.blocked=this.panels.flatMap(p=>{
   if(p.hidden||p.classList.contains('hidden')||p.classList.contains('dismiss'))return [];
   const style=getComputedStyle(p);if(style.display==='none'||style.visibility==='hidden')return [];
   const r=p.getBoundingClientRect();if(!r.width||!r.height)return [];
   return [{x:r.left-root.left,y:r.top-root.top,width:r.width,height:r.height}];
  });
 }
}
