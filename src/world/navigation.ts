import * as T from 'three';

export type WalkBounds={x:number;minZ:number;maxZ:number};
type Rect={minX:number;maxX:number;minZ:number;maxZ:number};
const distance=(a:T.Vector3,b:T.Vector3)=>Math.hypot(a.x-b.x,a.z-b.z);
export class WalkMap {
 readonly rectangles:Rect[];
 constructor(readonly bounds:WalkBounds,obstacles:T.Box3[],readonly margin=.32){
  this.rectangles=obstacles.map(b=>({minX:b.min.x-margin,maxX:b.max.x+margin,minZ:b.min.z-margin,maxZ:b.max.z+margin}));
 }
 free(x:number,z:number){const b=this.bounds,m=this.margin;return x>=-b.x+m&&x<=b.x-m&&z>=b.minZ+m&&z<=b.maxZ-m&&!this.rectangles.some(r=>x>=r.minX&&x<=r.maxX&&z>=r.minZ&&z<=r.maxZ);}
 clamp(p:T.Vector3){const b=this.bounds,m=this.margin;return new T.Vector3(T.MathUtils.clamp(p.x,-b.x+m,b.x-m),0,T.MathUtils.clamp(p.z,b.minZ+m,b.maxZ-m));}
 clear(a:T.Vector3,b:T.Vector3){
  if(!this.free(b.x,b.z))return false;
  for(const r of this.rectangles){
   let lo=0,hi=1;
   for(const [p,d,min,max] of [[a.x,b.x-a.x,r.minX,r.maxX],[a.z,b.z-a.z,r.minZ,r.maxZ]]){
    if(Math.abs(d)<1e-8){if(p<min||p>max){lo=2;break;}continue;}
    const u=(min-p)/d,v=(max-p)/d;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));
   }
   if(lo<=hi&&hi>=0&&lo<=1)return false;
  }
  return true;
 }
 route(from:T.Vector3,destination:T.Vector3):T.Vector3[]{
  const goal=this.clamp(destination),start=this.clamp(from);
  if(this.free(start.x,start.z)&&this.clear(start,goal))return [goal];
  const step=.5,b=this.bounds,minX=-b.x+this.margin,minZ=b.minZ+this.margin,width=Math.floor((b.x*2-this.margin*2)/step)+1,height=Math.floor((b.maxZ-b.minZ-this.margin*2)/step)+1,count=width*height;
  const point=(id:number)=>new T.Vector3(minX+(id%width)*step,0,minZ+Math.floor(id/width)*step);
  const open=new Uint8Array(count);for(let n=0;n<count;n++){const p=point(n);open[n]=Number(this.free(p.x,p.z));}
  const nearest=(p:T.Vector3)=>{let chosen=-1,best=Infinity;for(let n=0;n<count;n++)if(open[n]){const q=point(n),score=(q.x-p.x)**2+(q.z-p.z)**2;if(score<best&&(!this.free(p.x,p.z)||this.clear(p,q))){best=score;chosen=n;}}return chosen;};
  const first=nearest(start),last=nearest(goal);if(first<0||last<0)return [];
  const scores=new Float64Array(count);scores.fill(Infinity);scores[first]=0;
  const previous=new Int32Array(count);previous.fill(-1);const closed=new Uint8Array(count),heap:{id:number;f:number}[]=[];
  const push=(entry:{id:number;f:number})=>{heap.push(entry);let n=heap.length-1;while(n>0){const p=(n-1)>>1;if(heap[p].f<=entry.f)break;heap[n]=heap[p];n=p;}heap[n]=entry;};
  const pop=()=>{const first=heap[0],end=heap.pop()!;if(heap.length){let n=0;while(n*2+1<heap.length){let c=n*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=end.f)break;heap[n]=heap[c];n=c;}heap[n]=end;}return first.id;};
  const gx=last%width,gz=Math.floor(last/width),heuristic=(n:number)=>Math.hypot(n%width-gx,Math.floor(n/width)-gz);
  push({id:first,f:heuristic(first)});
  while(heap.length){
   const id=pop();if(closed[id])continue;closed[id]=1;if(id===last)break;const x=id%width,z=Math.floor(id/width);
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
    const xx=x+dx,zz=z+dz,n=zz*width+xx;if(xx<0||xx>=width||zz<0||zz>=height||!open[n]||closed[n])continue;
    if(dx&&dz&&(!open[z*width+xx]||!open[zz*width+x]))continue;
    const cost=scores[id]+(dx&&dz?Math.SQRT2:1);if(cost>=scores[n])continue;previous[n]=id;scores[n]=cost;push({id:n,f:cost+heuristic(n)});
   }
  }
  if(!closed[last])return [];
  const raw:T.Vector3[]=[];for(let n=last;n>=0;n=previous[n])raw.push(point(n));raw.reverse();
  if(this.free(goal.x,goal.z)&&this.clear(raw[raw.length-1],goal))raw.push(goal);
  const route:T.Vector3[]=[];let anchor=start,index=0;
  if(!this.free(start.x,start.z)){route.push(raw[0]);anchor=raw[0];index=1;}
  while(index<raw.length){let furthest=index;while(furthest+1<raw.length&&this.clear(anchor,raw[furthest+1]))furthest++;route.push(raw[furthest]);anchor=raw[furthest];index=furthest+1;}
  return route;
 }
 approach(from:T.Vector3,point:T.Vector3,radius:number){
  if(distance(from,point)<=radius&&this.free(from.x,from.z))return [from.clone().setY(0)];
  const angle=Math.atan2(from.x-point.x,from.z-point.z),candidates:T.Vector3[]=[];
  for(const r of [Math.min(1.7,radius*.75),radius*.45,0])for(let i=0;i<(r?16:1);i++){
   const a=angle+i*Math.PI/8,p=new T.Vector3(point.x+Math.sin(a)*r,0,point.z+Math.cos(a)*r);if(this.free(p.x,p.z))candidates.push(p);
  }
  candidates.sort((a,b)=>distance(from,a)-distance(from,b));
  for(const p of candidates){const path=this.route(from,p);if(path.length&&distance(path[path.length-1],point)<=radius)return path;}
  return [];
 }
}

export class ClickNavigator {
 readonly velocity=new T.Vector3();private path:T.Vector3[]=[];private arrival?:()=>void;
 constructor(public map:WalkMap){}
 get active(){return this.path.length>0;}
 get destination(){return this.path[this.path.length-1];}
 setMap(map:WalkMap){this.cancel();this.map=map;}
 cancel(){this.path=[];this.arrival=undefined;this.velocity.set(0,0,0);}
 go(from:T.Vector3,to:T.Vector3,arrival?:()=>void,radius?:number){
  const path=radius===undefined?this.map.route(from,to):this.map.approach(from,to,radius);if(!path.length){this.cancel();return false;}
  this.path=path;this.arrival=arrival;return true;
 }
 step(position:T.Vector3,dt:number,manual=new T.Vector3(),speed=3.0){
  const before=position.clone(),input=manual.clone().setY(0);
  if(input.lengthSq()>.01){this.path=[];this.arrival=undefined;input.normalize().multiplyScalar(speed);}
  else if(this.path.length){
   while(this.path.length>1&&(distance(position,this.path[0])<.17||distance(position,this.path[0])<.9&&this.map.clear(position,this.path[1])))this.path.shift();
   const next=this.path[0],d=distance(position,next),final=this.path.length===1;
   if(final&&d<.065){position.x=next.x;position.z=next.z;const callback=this.arrival;this.cancel();callback?.();return false;}
   input.copy(next).sub(position).setY(0).normalize().multiplyScalar(final?Math.min(speed,d*4):speed);
  }
  this.velocity.lerp(input,1-Math.exp(-11*dt));
  const next=position.clone().addScaledVector(this.velocity,dt),inside=!this.map.free(position.x,position.z);
  if(inside||this.map.free(next.x,next.z)){position.x=this.map.clamp(next).x;position.z=this.map.clamp(next).z;}
  else{
   if(this.map.free(next.x,position.z))position.x=next.x;
   if(this.map.free(position.x,next.z))position.z=next.z;
   this.velocity.multiplyScalar(.35);
  }
  return distance(before,position)>.0005;
 }
}
