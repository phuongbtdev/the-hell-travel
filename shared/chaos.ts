export type ChaosAction='hit'|'smash'|'pants';
export type ChaosTarget={id:string;kind:'guard'|'prop';name:string;x:number;z:number;roam:number};
const guards:[number,number][][]=[
 [[-2.2,-5],[3,-6]],[[-1.5,-5.45],[1.5,-5.45]],[[-1.8,-5.6]],[[-1.55,-5.65],[3.65,-7]],[[-3,-4]],[[-2.5,-4]],[[-4,-3]],[[-3,-4]],[[-3,-4],[3,-5]],[[0,-6]],[[-3.25,-5.6],[3.25,-5.6]],[[-1.8,-5.2]],[[-4,-4]],[[-2.7,-5.2],[2.9,-5.4]],[[-3,-4],[-3,-7.4],[-3,-4.6],[3,-7.4],[3,-4.6]],[[3,-3]],[[0,-6]],[[-2.6,-6.1],[2.6,-6.1]],
];
const apparatusNames=['Bệ và kẹp rút lưỡi','Kéo và bàn thi hành','Giàn cây sắt','Xe mặt nạ và ghế giữ hồn','Lồng hấp và quạt','Giàn cột đồng','Giàn núi đao','Khối băng hành hình','Vạc dầu và giàn nâng','Hàng rào sân trâu','Giàn thả đá','Chày và cối','Cần câu và phao','Tời kéo cổ','Giàn dây kéo','Biển và giàn núi lửa','Cối xay đá','Cưa và bàn thi hành'];
export function chaosTargets(zone:string):ChaosTarget[]{
 const n=Number(zone.replace('floor-',''))-1;if(!/^floor-([1-9]|1[0-8])$/.test(zone))return [];
 return [...guards[n].map(([x,z],i)=>({id:`guard-${i}`,kind:'guard' as const,name:`Quỷ sai ${i+1}`,x,z,roam:n===9||n===16?7.5:n===3?8:4.5})),
  {id:'apparatus',kind:'prop',name:apparatusNames[n],x:0,z:-5.8,roam:0},
  {id:'crate-left',kind:'prop',name:'Thùng dụng cụ bên trái',x:-5.8,z:-2.0,roam:0},
  {id:'crate-right',kind:'prop',name:'Thùng dụng cụ bên phải',x:5.8,z:-2.0,roam:0}];
}
export type ChaosEvent={zone:string;target:string;action:ChaosAction;actor:string;at:number;revision:number;hp:number;stunUntil:number;pantsUntil:number;chaseUntil:number;brokenUntil:number;heat:number;from:[number,number];reaction?:boolean};
export const chaosExpiry=(e:ChaosEvent)=>Math.max(e.stunUntil,e.pantsUntil,e.chaseUntil,e.brokenUntil,e.at+10000);
export function chaosCompatible(action:ChaosAction,target:ChaosTarget){return target.kind==='prop'?action==='smash':action==='hit'||action==='pants';}
export class ChaosLedger {
 private effects=new Map<string,ChaosEvent>();private last=new Map<string,number>();private heat=new Map<string,{value:number;at:number}>();private revision=0;
 snapshot(zone:string,now=Date.now()){return [...this.effects.values()].filter(e=>e.zone===zone&&chaosExpiry(e)>now);}
 busy(zone:string,now=Date.now()){return this.snapshot(zone,now).some(e=>e.brokenUntil>now||e.stunUntil>now||e.chaseUntil>now);}
 prune(now=Date.now()){for(const [key,e] of this.effects)if(chaosExpiry(e)<=now)this.effects.delete(key);}
 forget(actor:string){this.last.delete(actor);this.heat.delete(actor);}
 request(player:{id:string;zone:string;x:number;z:number;registered:boolean;experiencing?:boolean},payload:{action?:unknown;target?:unknown},occupied=false,now=Date.now()):{event:ChaosEvent;reactions:ChaosEvent[];reason?:never}|{reason:string;event?:never;reactions?:never}{
  if(!player.registered)return {reason:'Ghi danh nhận thẻ hồn trước nhé.'};
  const target=chaosTargets(player.zone).find(t=>t.id===payload.target),action=payload.action as ChaosAction;
  if(!target||!['hit','smash','pants'].includes(action)||!chaosCompatible(action,target))return {reason:'Không thể chọc phá mục tiêu này.'};
  if(player.experiencing||occupied)return {reason:'Đang có người trải nghiệm. Chờ quỷ sai thi hành xong nhé.'};
  if(!Number.isFinite(player.x)||!Number.isFinite(player.z)||Math.hypot(player.x-target.x,player.z-target.z)>3.15+target.roam)return {reason:'Lại gần mục tiêu thêm một chút.'};
  if(now-(this.last.get(player.id)??-Infinity)<750)return {reason:'Chờ lấy đà một nhịp đã!'};
  const key=`${player.zone}/${target.id}`,old=this.effects.get(key);
  if(old&&old.brokenUntil>now)return {reason:'Đồ đã vỡ rồi. Quỷ sai đang chờ đồ thay.'};
  if(action==='pants'&&old&&old.pantsUntil>now)return {reason:'Quần ngoài đang tụt rồi, để lính canh kéo lên đã!'};
  const previousHeat=this.heat.get(player.id),heat=Math.min(5,Math.max(0,(previousHeat?.value??0)-Math.floor((now-(previousHeat?.at??now))/5000))+(action==='pants'?2:1));
  const hp=target.kind==='prop'?Math.max(0,(old&&chaosExpiry(old)>now?old.hp:2)-1):2;
  const event:ChaosEvent={zone:player.zone,target:target.id,action,actor:player.id,at:now,revision:++this.revision,hp,
   stunUntil:target.kind==='guard'?now+2800:0,pantsUntil:action==='pants'?now+6000:old?.pantsUntil??0,
   chaseUntil:target.kind==='guard'?now+10000:0,brokenUntil:hp===0?now+18000:0,heat,from:[player.x,player.z]};
  this.effects.set(key,event);this.last.set(player.id,now);this.heat.set(player.id,{value:heat,at:now});
  const reactions:ChaosEvent[]=[];
  if(target.kind==='prop'){
   const guard=chaosTargets(player.zone).filter(t=>t.kind==='guard').sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z))[0];
   if(guard){const guardKey=`${player.zone}/${guard.id}`,previous=this.effects.get(guardKey),reaction:ChaosEvent={...event,target:guard.id,reaction:true,revision:++this.revision,hp:2,brokenUntil:0,stunUntil:now+1200,chaseUntil:now+10000,pantsUntil:previous?.pantsUntil??0};this.effects.set(guardKey,reaction);reactions.push(reaction);}
  }
  return {event,reactions};
 }
}
