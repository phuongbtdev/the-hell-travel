import { Room, Client } from 'colyseus';
import { schema, t, type SchemaType } from '@colyseus/schema';
import { ExperienceQueue } from './ExperienceQueue.js';
import {ChaosLedger,type ChaosAction} from '../../shared/chaos.js';
import {cleanSpiritName} from '../../shared/spirit-name.js';
import {isDance} from '../../shared/bar.js';

export const PlayerState = schema({
  x: t.number().default(0),
  z: t.number().default(4),
  yaw: t.number().default(0),
  y: t.number().default(0),
  pitch: t.number().default(0),
  roll: t.number().default(0),
  sx: t.number().default(1),
  sy: t.number().default(1),
  sz: t.number().default(1),
  clip: t.string().default(''),
  experienceStage: t.string().default(''),
  stageTime: t.number().default(-1),
  escortX:t.number().default(0),
  escortZ:t.number().default(0),
  escortYaw:t.number().default(0),
  escortMoving:t.boolean().default(false),
  escortClip:t.string().default(''),
  moving: t.boolean().default(false),
  ticket: t.number().default(1),
  registered: t.boolean().default(false),
  name:t.string().default('Vong vô danh'),
  zone: t.string().default('registry'),
});
export type PlayerState = SchemaType<typeof PlayerState>;

export const UnderworldState = schema({
  players: t.map(PlayerState),
  queueLength: t.number().default(0),
});
export type UnderworldState = SchemaType<typeof UnderworldState>;

type MovePayload = { x?: number; z?: number; yaw?: number; moving?: boolean;y?:number;pitch?:number;roll?:number;sx?:number;sy?:number;sz?:number;clip?:string;stage?:string;stageTime?:number;escortX?:number;escortZ?:number;escortYaw?:number;escortMoving?:boolean;escortClip?:string };
const clips=new Set(['idle','glide_walk','walk','run','bound','flail','hug','climb','swim','shiver','saw-victim','plead','look','pull','pound','talk','push','stamp','greet']);

export class UnderworldRoom extends Room<{ state: UnderworldState }> {
  maxClients = 32;
  state = new UnderworldState();
  private experiences=new ExperienceQueue();
  private chaos=new ChaosLedger();
  onCreate(){this.setSimulationInterval(()=>{this.chaos.prune();for(const id of this.experiences.expired()){this.clients.find(c=>c.sessionId===id)?.send('experience:cancelled',{});this.releaseExperience(id);}},1000);}
  private resetPose(id:string){const p=this.state.players.get(id);if(p){p.y=0;p.pitch=0;p.roll=0;p.sx=1;p.sy=1;p.sz=1;p.clip='';p.experienceStage='';p.stageTime=-1;p.escortX=0;p.escortZ=0;p.escortYaw=0;p.escortMoving=false;p.escortClip='';}}
  private releaseExperience(id:string){
    this.resetPose(id);
    for(const grant of this.experiences.release(id)){
      const client=this.clients.find(c=>c.sessionId===grant.id),p=this.state.players.get(grant.id);
      if(client&&p?.zone===grant.zone){p.experienceStage='approaching';client.send('experience:response',{accepted:true,zone:grant.zone});}
      else this.releaseExperience(grant.id);
    }
    for(const waiting of this.experiences.waiting())this.clients.find(c=>c.sessionId===waiting.id)?.send('experience:response',{accepted:false,queued:true,position:waiting.position,zone:waiting.zone});
  }

  messages = {
    'bar:sync':(client:Client,payload:{sentAt?:number}={})=>{
      const player=this.state.players.get(client.sessionId);
      if(player?.registered&&player.zone==='bar')client.send('bar:clock',{serverNow:Date.now(),sentAt:Number.isFinite(payload.sentAt)?payload.sentAt:undefined});
    },
    'chaos:sync':(client:Client)=>{const p=this.state.players.get(client.sessionId);if(p)client.send('chaos:snapshot',{zone:p.zone,events:this.chaos.snapshot(p.zone),serverNow:Date.now()});},
    'chaos:action':(client:Client,payload:{action?:ChaosAction;target?:string})=>{
      const p=this.state.players.get(client.sessionId);if(!p)return;
      const occupied=[...this.state.players.entries()].some(([id,v])=>v.zone===p.zone&&this.experiences.owns(p.zone,id));
      const result=this.chaos.request({id:client.sessionId,zone:p.zone,x:p.x,z:p.z,registered:p.registered,experiencing:Boolean(p.experienceStage)},payload??{},occupied);
      if(!result.event){client.send('chaos:rejected',{reason:result.reason});return;}
      for(const event of [result.event,...result.reactions]){const message={event,serverNow:Date.now()};for(const viewer of this.clients)if(this.state.players.get(viewer.sessionId)?.zone===p.zone)viewer.send('chaos:event',message);}
    },
    'experience:start':(client:Client)=>{
      const p=this.state.players.get(client.sessionId);if(!p?.registered||!/^floor-([1-9]|1[0-8])$/.test(p.zone)){client.send('experience:response',{accepted:false,reason:'Hãy ghi danh và tới một tầng để trải nghiệm.'});return;}
      if(this.chaos.busy(p.zone)){client.send('experience:response',{accepted:false,reason:'Quỷ sai đang dẹp loạn hoặc dựng lại đạo cụ. Chờ một chút rồi thử nhé.'});return;}
      const result=this.experiences.request(p.zone,client.sessionId);if(result.accepted)p.experienceStage='approaching';client.send('experience:response',{...result,queued:!result.accepted,zone:p.zone});
    },
    'experience:stop':(client:Client)=>this.releaseExperience(client.sessionId),
    zone:(client:Client,payload:{zone?:string})=>{
      const player=this.state.players.get(client.sessionId),zone=payload.zone;
      if(!player||typeof zone!=='string'||(zone!=='registry'&&!player.registered))return;
      if(zone==='registry'||zone==='hall'||zone==='bar'||/^floor-([1-9]|1[0-8])$/.test(zone)){this.releaseExperience(client.sessionId);player.zone=zone;player.x=0;player.z=5.5;player.moving=false;}
    },
    move: (client: Client, payload: MovePayload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (Number.isFinite(payload.x)) player.x = Math.max(-15, Math.min(15, payload.x!));
      if (Number.isFinite(payload.z)) player.z = Math.max(-40, Math.min(9, payload.z!));
      if (Number.isFinite(payload.yaw)) player.yaw = payload.yaw!;
      player.moving = Boolean(payload.moving);
      if(this.experiences.owns(player.zone,client.sessionId)){
        for(const key of ['y','pitch','roll','sx','sy','sz'] as const){const value=payload[key];if(typeof value==='number'&&Number.isFinite(value))player[key]=Math.max(key.startsWith('s')?.2:-7,Math.min(key.startsWith('s')?2:7,value));}
        player.clip=typeof payload.clip==='string'&&clips.has(payload.clip)?payload.clip:'idle';
        if(typeof payload.stageTime==='number'&&Number.isFinite(payload.stageTime))player.stageTime=Math.max(-1,Math.min(20,payload.stageTime));
        if(typeof payload.escortX==='number'&&Number.isFinite(payload.escortX))player.escortX=Math.max(-15,Math.min(15,payload.escortX));
        if(typeof payload.escortZ==='number'&&Number.isFinite(payload.escortZ))player.escortZ=Math.max(-40,Math.min(9,payload.escortZ));
        if(typeof payload.escortYaw==='number'&&Number.isFinite(payload.escortYaw))player.escortYaw=Math.atan2(Math.sin(payload.escortYaw),Math.cos(payload.escortYaw));
        player.escortMoving=Boolean(payload.escortMoving);player.escortClip=typeof payload.escortClip==='string'&&clips.has(payload.escortClip)?payload.escortClip:'';
        if(['approaching','detaining','escorting','positioning','performing','returning'].includes(payload.stage??''))player.experienceStage=payload.stage!;
      }else{
        this.resetPose(client.sessionId);
        if(player.registered&&player.zone==='bar'&&!player.moving&&isDance(payload.clip))player.clip=payload.clip;
      }
    },
    register: (client: Client,payload:{name?:unknown}={}) => {
      const player = this.state.players.get(client.sessionId);
      if (!player)return;
      if(player.registered){client.send('registry:response',{registered:true,name:player.name,ticket:player.ticket});return;}
      const name=cleanSpiritName(payload?.name);if(!name){client.send('registry:response',{registered:false,reason:'Nhập tên vong hồn trước khi nhận thẻ nhé.'});return;}
      player.name=name;
      player.registered = true;
      client.send('registry:response',{registered:true,name:player.name,ticket:player.ticket});
      this.broadcast('registry:registered', { ticket: player.ticket,name:player.name });
    },
  };

  onJoin(client: Client) {
    const ticket = ++this.state.queueLength;
    this.state.players.set(client.sessionId, new PlayerState({ x: -0.7, z: 5.2, ticket,name:`Vong #${String(ticket).padStart(3,'0')}` }));
    this.broadcast('presence:count', { count: this.clients.length });
  }

  onLeave(client:Client) {
    this.chaos.forget(client.sessionId);
    this.releaseExperience(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.broadcast('presence:count', { count: this.clients.length });
  }
}
