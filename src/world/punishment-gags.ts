import * as T from 'three';
import {scissorsParts} from './spectral-parts';
import {treeBeat,steamBeat,bladeBeat,oxBeat,pestleBeat,dismemberParts,millBeat,smoothBeat} from './punishment-beats';

type MeshFactory=(g:T.BufferGeometry,m:T.Material,p:[number,number,number],parent?:T.Object3D)=>T.Mesh;
export function buildPunishmentGags(floor:number,{root,victim,demon,actors,mesh,subject}:{root:T.Group;victim:T.Group;demon:T.Group;actors:T.Group[];mesh:MeshFactory;subject:()=>T.Object3D}){
 const mat=(color:number,extra:Partial<T.MeshStandardMaterialParameters>={})=>new T.MeshStandardMaterial({color,roughness:.7,...extra});
 const soul=mat(0xb3dfdf),red=mat(0xb9253b,{roughness:.35}),iron=mat(0x64767b,{metalness:.5}),gold=mat(0xc69a51,{metalness:.35}),paper=mat(0xf2d9aa);
 const usedMaterials=new Set<T.Material>();
 const add=(g:T.BufferGeometry,m:T.Material,p:[number,number,number],parent:T.Object3D=root)=>{usedMaterials.add(m);return mesh(g,m,p,parent);};
 const point=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
 let strap:T.Mesh|undefined,gauge:T.Group|undefined,needle:T.Mesh|undefined,shoeBlade:T.Mesh|undefined,ribbons:T.Group[]=[];
 const fan=root.getObjectByName('steam-fan'),pestle=root.getObjectByName('pestle'),ox=actors.find(a=>a.userData.assetId==='ox');
 if(floor===3)strap=add(new T.CylinderGeometry(.025,.025,1,8),red,[0,0,0]);
 if(floor===5){
  gauge=new T.Group();gauge.position.set(1.55,2.55,-4.75);root.add(gauge);
  add(new T.CircleGeometry(.36,24),paper,[0,0,0],gauge);add(new T.TorusGeometry(.37,.045,8,28),gold,[0,0,.015],gauge);
  for(let j=0;j<5;j++){const tick=add(new T.BoxGeometry(.035,.09,.02),j>2?red:iron,[Math.sin(-1+j*.5)*.28,Math.cos(-1+j*.5)*.28,.025],gauge);tick.rotation.z=1-j*.5;}
  needle=add(new T.BoxGeometry(.025,.28,.025),red,[0,.09,.045],gauge);
 }
 if(floor===7)shoeBlade=add(new T.ConeGeometry(.08,.50,3),iron,[-4,.3,-3]);
 if(floor===17)for(let j=0;j<9;j++){
  const strand=new T.Group();strand.name=`ground-soul-ribbon-${j}`;strand.position.set((j-4)*.13,1.17,-4.30);root.add(strand);ribbons.push(strand);
  const curve=new T.CatmullRomCurve3([point(0,0,0),point(Math.sin(j)*.05,.08,.25),point(Math.cos(j)*.09,-.2,.55),point(Math.sin(j)*.08,-.65,.85),point(Math.sin(j)*.13,-.68,1.2)]);
  add(new T.TubeGeometry(curve,18,.045,6,false),j%3? soul:red,[0,0,0],strand);
  add(new T.SphereGeometry(.055,8,6),red,[Math.sin(j)*.13,-.68,1.2],strand);
 }
 const setParts=(parts:ReturnType<typeof scissorsParts>)=>{victim.userData.spectralParts=parts;const player=subject();if(player!==victim)player.userData.spectralParts=parts;};
 const oxCircle=(t:number)=>point(Math.sin(t*.65+1.4)*3.5,Math.abs(Math.sin(t*6))*.06,-6+Math.cos(t*.65+1.4)*2.3);
 const guards=actors.filter(a=>['demon','guard-green','guard-blue'].includes(a.userData.assetId)),guardY=guards.map(a=>a.position.y);
 const update=(time:number)=>{
  if(floor===2){const parts=scissorsParts(time);parts.left*=1.30;parts.right*=1.30;parts.lower*=1.18;parts.headScale=[1+parts.head*.15,1+parts.head*.1,1+parts.head*.15];setParts(parts);}
  if(floor===3){
   const b=treeBeat(time);victim.rotation.z=Math.sin(time*2.4)*.16+b.tug*.055;demon.position.y=.6+b.snag*1.15;demon.rotation.z=-b.snag*.65+Math.sin(time*10)*b.snag*.12;demon.userData.performanceClip=b.snag>.25?'flail':'climb';
   const a=point(-1.8,3.65,-6),bpoint=demon.position.clone().add(point(0,1.2,0)),delta=bpoint.clone().sub(a);strap!.visible=b.snag>.05;strap!.position.copy(a).lerp(bpoint,.5);strap!.scale.y=delta.length();strap!.quaternion.setFromUnitVectors(point(0,1,0),delta.normalize());
  }
  if(floor===5){
   const b=steamBeat(time);victim.scale.set(1+b.pressure*.42,1-b.pressure*.10,1+b.pressure*.35);victim.rotation.z=Math.sin(time*15)*b.pressure*.045;
   demon.position.x=-3-b.vent*.6;demon.rotation.z=-b.vent*.40;demon.userData.performanceClip=b.vent>.2?'flail':'pull';
   if(fan){fan.position.y=1.4+b.vent*1.6;fan.rotation.z=b.vent*time*9;}needle!.rotation.z=1.1-b.pressure*2.4;
  }
  if(floor===7){
   const b=bladeBeat(time);victim.rotation.z+=Math.sin(time*19)*b.impact*.18;victim.position.y+=b.impact*.1;demon.position.y=b.sliding?Math.abs(Math.sin(time*16))*.20:0;demon.userData.performanceClip=b.sliding?'flail':'greet';
   shoeBlade!.visible=b.sliding;shoeBlade!.position.set(demon.position.x-.12,demon.position.y+.14,demon.position.z+.2);shoeBlade!.rotation.z=Math.PI*.65;
  }
  if(floor===10&&ox){
   const b=oxBeat(time),t=b.time,base=time-t;
   victim.rotation.x=0;victim.rotation.z=0;
   if(t<4.4||t>=12.7){delete victim.userData.performanceClip;delete demon.userData.performanceClip;delete ox.userData.performanceClip;}
   else{
    victim.userData.performanceClip='flail';ox.userData.performanceClip='run';demon.userData.performanceClip=t<7.1?'flail':'run';
    if(t<5.4){const u=smoothBeat((t-4.4)/1);victim.position.copy(oxCircle(base+4.4)).lerp(point(0,0,-5.3),u);ox.position.copy(point(Math.sin((base+4.4)*.65)*3,0,-6+Math.cos((base+4.4)*.65)*2)).lerp(point(-3,0,-5.5),u);ox.rotation.y=Math.PI/2;}
    else if(t<7.1){
     ox.position.copy(point(-3,0,-5.5)).lerp(point(.2,0,-5.3),b.charge);ox.rotation.y=Math.PI/2;
     victim.position.set(b.flight*.3,Math.sin(b.flight*Math.PI)*2.2+b.flight*1.3,-5.3-b.flight*2.7);victim.rotation.z=Math.PI*b.flight;victim.rotation.y=0;
    }else{
     victim.position.set(0,1.3+Math.sin(time*13)*.055,-8);victim.rotation.set(0,0,Math.PI);
     const blend=smoothBeat((t-7.1)/.65),angle=(t-7.1)*1.9;
     ox.position.copy(point(.2,0,-5.3)).lerp(point(Math.sin(angle-.5)*3,0,-5+Math.cos(angle-.5)*1.2),blend);ox.rotation.y=angle-.5+Math.PI/2;
     demon.position.copy(point(3,0,-4.4)).lerp(point(Math.sin(angle+.35)*3.7,0,-5+Math.cos(angle+.35)*1.5),blend);demon.rotation.y=angle+.35+Math.PI/2;
     if(b.returning>0){const end=oxCircle(base+12.7);victim.position.copy(point(0,1.3,-8)).lerp(end,b.returning);victim.position.y+=Math.sin(b.returning*Math.PI)*.7;victim.rotation.z=Math.PI*(1-b.returning);}
    }
    if(t<7.1)demon.position.set(3,.1+Math.sin(t*12)*.04,-4.4);
   }
  }
  if(floor===12){
   const b=pestleBeat(time);if(pestle)pestle.position.set(.35,b.height,-5.8);victim.scale.set(1+b.impact*.55,1-b.impact*.58,1+b.impact*.35);victim.position.y=.75+b.bounce*.35;
   setParts({left:0,right:0,lower:0,head:b.bounce*.8,time,headScale:[1+b.impact*.4,1-b.impact*.55,1+b.impact*.35]});
   demon.position.y=Math.max(0,Math.sin((b.time-1.35)*8))*.1;
  }
  if(floor===15){
   const parts=dismemberParts(time);setParts(parts);const t=((time%12)+12)%12;
   victim.parent!.rotation.y=Math.PI*2*(t/12+smoothBeat((t-3)/5));
   guards.forEach((a,i)=>{a.position.y=guardY[i]+(parts.left>.8?Math.abs(Math.sin(time*8+i))*.10:0);a.userData.performanceClip=t>3.5&&t<5?'flail':'pull';});
  }
  if(floor===17){
   const b=millBeat(time);victim.scale.set(1+b.pulse*.25,.90-b.pulse*.26,1+b.pulse*.22);setParts({left:0,right:0,lower:0,head:b.pulse*.7,time});
   ribbons.forEach((r,i)=>{r.visible=b.ribbons>.015;r.scale.set(1,Math.max(.02,b.ribbons),Math.max(.02,b.ribbons));r.rotation.z=Math.sin(time*5+i)*b.ribbons*.07;});
   demon.rotation.z=b.time>8.6&&b.time<10?Math.sin(time*12)*.16:0;demon.position.y=b.time>8.6&&b.time<10?Math.abs(Math.sin(time*10))*.15:0;
   if(b.time>8.6&&b.time<10)demon.userData.performanceClip='flail';else delete demon.userData.performanceClip;
  }
 };
 // Materials attached to owned meshes are disposed by the zone; discard unused choices now.
 for(const m of [soul,red,iron,gold,paper])if(!usedMaterials.has(m))m.dispose();
 return update;
}
