export class ExperienceQueue {
  private stations=new Map<string,{holder:string;waiting:string[];since:number}>();
  request(zone:string,id:string,now=Date.now()){
    let station=this.stations.get(zone);if(!station){station={holder:id,waiting:[],since:now};this.stations.set(zone,station);return {accepted:true,position:0};}
    if(station.holder===id)return {accepted:true,position:0};
    if(!station.waiting.includes(id))station.waiting.push(id);return {accepted:false,position:station.waiting.indexOf(id)+1};
  }
  owns(zone:string,id:string){return this.stations.get(zone)?.holder===id;}
  waiting(){return [...this.stations].flatMap(([zone,s])=>s.waiting.map((id,i)=>({zone,id,position:i+1})));}
  expired(now=Date.now()){return [...this.stations.values()].filter(s=>now-s.since>90000).map(s=>s.holder);}
  release(id:string,now=Date.now()){
    const grants:{zone:string;id:string}[]=[];
    for(const [zone,s] of this.stations){s.waiting=s.waiting.filter(v=>v!==id);if(s.holder===id){const next=s.waiting.shift();if(next){s.holder=next;s.since=now;grants.push({zone,id:next});}else this.stations.delete(zone);}}
    return grants;
  }
}
