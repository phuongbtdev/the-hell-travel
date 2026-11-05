import type { SoundMood } from './underworld';
import { MASK_CYCLE_DURATION, MASK_PEEL_STARTS } from './mask-peeling';
import { STONE_CYCLE_DURATION, STONE_IMPACT_TIME } from './stone-crush';
import { NECK_CYCLE_DURATION, NECK_BREAK_TIME, NECK_RELEASE_TIME } from './neck-pull';
import {GAG_SOUNDS} from './punishment-beats';
import {barSeconds} from '../../shared/bar';

export class Soundscape {
  private context?:AudioContext;
  private master?:GainNode;
  private music?:HTMLAudioElement;
  private mood:SoundMood='hall';
  private zone='registry';
  private lastCue=-100;
  private lastMaskTime?:number;
  private lastStoneTime?:number;
  private lastNeckTime?:number;
  private lastGagTime?:number;
  private barClockOffset=0;
  enabled=false;
  setMood(mood:SoundMood){this.mood=mood;if(this.enabled)this.startMusic();}
  async enable(){
    this.enabled=true;this.context??=new AudioContext();this.master??=this.context.createGain();this.master.gain.value=.52;
    this.master.disconnect();this.master.connect(this.context.destination);await this.context.resume();this.startMusic();return true;
  }
  async toggle(){
    if(!this.enabled){await this.enable();return true;}
    this.enabled=false;this.music?.pause();this.master?.gain.setValueAtTime(0,this.context!.currentTime);return false;
  }
  private startMusic(){
    const source=`/audio/music/${this.mood}.m4a`;
    if(this.music?.getAttribute('src')!==source){this.music?.pause();this.music=new Audio(source);this.music.loop=true;this.music.volume=this.mood==='bar'?.38:.25;this.music.addEventListener('loadedmetadata',()=>this.syncBarMusic(),{once:true});}
    this.syncBarMusic();
    void this.music.play().catch(()=>{});
  }
  setBarClockOffset(offset:number){this.barClockOffset=offset;this.syncBarMusic();}
  private syncBarMusic(){
    if(this.mood!=='bar'||!this.music||!Number.isFinite(this.music.duration))return;
    const phase=barSeconds(Date.now()+this.barClockOffset);
    if(Math.abs(this.music.currentTime-phase)>.16)this.music.currentTime=phase;
  }
  setZone(zone:string){this.zone=zone;this.lastCue=-100;this.lastMaskTime=undefined;this.lastStoneTime=undefined;this.lastNeckTime=undefined;this.lastGagTime=undefined;}
  reaction(vowel:'aa'|'oh'|'uu'='aa'){
    const ctx=this.context;if(!this.enabled||!ctx||!this.master)return;
    const now=ctx.currentTime,osc=ctx.createOscillator(),envelope=ctx.createGain(),vibrato=ctx.createOscillator(),vibratoGain=ctx.createGain();
    const duration=.50+Math.random()*.22;osc.type='sawtooth';osc.frequency.setValueAtTime(150+Math.random()*35,now);osc.frequency.exponentialRampToValueAtTime(vowel==='uu'?110:205,now+duration*.4);osc.frequency.exponentialRampToValueAtTime(125,now+duration);
    vibrato.frequency.value=5.5;vibratoGain.gain.value=7;vibrato.connect(vibratoGain);vibratoGain.connect(osc.frequency);
    const formants={aa:[730,1090,2440],oh:[570,840,2410],uu:[300,870,2240]}[vowel];
    const filters=formants.map((frequency,i)=>{const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=frequency;f.Q.value=7;const gain=ctx.createGain();gain.gain.value=[.55,.27,.12][i];osc.connect(f);f.connect(gain);gain.connect(envelope);return {f,gain};});
    envelope.gain.setValueAtTime(.0001,now);envelope.gain.exponentialRampToValueAtTime(.22,now+.06);envelope.gain.exponentialRampToValueAtTime(.0001,now+duration);envelope.connect(this.master);osc.start(now);vibrato.start(now);osc.stop(now+duration+.03);vibrato.stop(now+duration+.03);
    osc.onended=()=>{osc.disconnect();vibrato.disconnect();vibratoGain.disconnect();filters.forEach(({f,gain})=>{f.disconnect();gain.disconnect();});envelope.disconnect();};
  }
  tick(time:number,x:number,z:number,stationTime=time){
    if(this.zone==='bar')return;
    if(!this.enabled)return;const i=Number(this.zone.replace('floor-',''))-1;
    const gag=GAG_SOUNDS[i+1];
    if(gag){
      const previous=this.lastGagTime;this.lastGagTime=stationTime;if(previous===undefined||stationTime<previous||stationTime-previous>.3)return;
      const cycle=Math.floor(stationTime/gag.duration),volume=Math.max(.07,1-Math.hypot(x,z+6)/19),pan=Math.max(-.8,Math.min(.8,-x/10));
      for(const [at,kind] of gag.events)for(const c of [cycle-1,cycle]){const point=c*gag.duration+at;if(previous<point&&stationTime>=point)this.cue(kind,volume,pan);}return;
    }
    if(i===13){
      const previous=this.lastNeckTime;this.lastNeckTime=stationTime;
      if(previous===undefined||stationTime<previous||stationTime-previous>.3)return;
      const cycle=Math.floor(stationTime/NECK_CYCLE_DURATION),volume=Math.max(.07,1-Math.hypot(x,z+6)/19),pan=Math.max(-.8,Math.min(.8,-x/10));
      const events=[{at:1.2,kind:'ratchet'},{at:2.3,kind:'ratchet'},{at:3.4,kind:'ratchet'},{at:4.5,kind:'ratchet'},{at:5.5,kind:'creak'},{at:NECK_BREAK_TIME,kind:'snip'},{at:6.5,kind:'thud'},{at:NECK_RELEASE_TIME,kind:'boing'},{at:9.1,kind:'boing'},{at:11,kind:'bell'}];
      for(const e of events)for(const c of [cycle-1,cycle]){const at=c*NECK_CYCLE_DURATION+e.at;if(previous<at&&stationTime>=at){this.cue(e.kind,volume,pan);if(e.kind==='boing')this.reaction('oh');}}
      return;
    }
    if(i===10){
      const previous=this.lastStoneTime;this.lastStoneTime=stationTime;
      if(previous===undefined||stationTime<previous||stationTime-previous>.3)return;
      const cycle=Math.floor(stationTime/STONE_CYCLE_DURATION),volume=Math.max(.07,1-Math.hypot(x,z+5.55)/19),pan=Math.max(-.8,Math.min(.8,-x/10));
      const events=[{at:.35,kind:'chain'},{at:1.7,kind:'chain'},{at:3.15,kind:'fall'},{at:STONE_IMPACT_TIME,kind:'crush'},{at:STONE_IMPACT_TIME+.10,kind:'shatter'},{at:8.2,kind:'bell'}];
      for(const e of events)for(const c of [cycle-1,cycle]){const at=c*STONE_CYCLE_DURATION+e.at;if(previous<at&&stationTime>=at){this.cue(e.kind,volume,pan);if(e.kind==='crush')this.reaction('aa');}}
      return;
    }
    if(i===3){
      const previous=this.lastMaskTime;this.lastMaskTime=stationTime;
      // Follow the shared station clock, including restarting a player's turn.
      if(previous===undefined||stationTime<previous||stationTime-previous>.3)return;
      const cycle=Math.floor(stationTime/MASK_CYCLE_DURATION),volume=Math.max(.07,1-Math.hypot(x,z+6)/19),pan=Math.max(-.8,Math.min(.8,-x/10));
      const events=[...MASK_PEEL_STARTS.map(at=>({at,kind:'peel'})),...MASK_PEEL_STARTS.map(at=>({at:at+2.35,kind:'mask-clatter'})),{at:10.3,kind:'bell'}];
      for(const e of events)for(const c of [cycle-1,cycle]){const at=c*MASK_CYCLE_DURATION+e.at;if(previous<at&&stationTime>=at)this.cue(e.kind,volume,pan);}
      return;
    }
    const periods=[1.8,1.5,2.5,5,1.8,2.4,2,2.5,1.2,.55,2,2,2,2,2.2,1.4,1.5,.9];const period=periods[i]??(this.zone==='hall'?4:9);
    if(time-this.lastCue<period)return;this.lastCue=time;
    const distance=Math.hypot(x,z+(this.zone==='hall'?12:6)),volume=Math.max(.07,1-distance/19);
    const kinds=['chain','snip','chain','bell','steam','sizzle','chain','wind','boil','hoof','stone','thud','splash','stamp','rope','fire','stone','saw'];
    this.cue(kinds[i]??(this.zone==='hall'?'stamp':'bell'),volume,Math.max(-.8,Math.min(.8,-x/10)));
  }
  cue(kind='bell',volume=1,pan=0){
    const ctx=this.context;if(!this.enabled||!ctx||!this.master)return;const t=ctx.currentTime,gain=ctx.createGain(),panner=ctx.createStereoPanner();panner.pan.value=pan;gain.connect(panner);panner.connect(this.master);
    if(kind==='boing'){
      const osc=ctx.createOscillator();osc.type='triangle';osc.frequency.setValueAtTime(430,t);osc.frequency.exponentialRampToValueAtTime(90,t+.12);osc.frequency.exponentialRampToValueAtTime(340,t+.27);osc.frequency.exponentialRampToValueAtTime(130,t+.60);
      gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.26*volume,t+.02);gain.gain.exponentialRampToValueAtTime(.0001,t+.65);osc.connect(gain);osc.start(t);osc.stop(t+.70);osc.onended=()=>{osc.disconnect();gain.disconnect();panner.disconnect();};return;
    }
    if(kind==='crush'){
      // Sub bass hit plus a short debris burst, both obeying the scene's mute/volume.
      const osc=ctx.createOscillator();osc.type='sine';osc.frequency.setValueAtTime(125,t);osc.frequency.exponentialRampToValueAtTime(30,t+.42);
      gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.7*volume,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+.65);
      osc.connect(gain);osc.start(t);osc.stop(t+.7);osc.onended=()=>{osc.disconnect();gain.disconnect();panner.disconnect();};return;
    }
    const scratch=['saw','chain','snip','steam','sizzle','boil','splash','wind','rope','fire','peel','fall','shatter','ratchet','creak'].includes(kind),duration=kind==='creak'?.9:kind==='peel'?.85:kind==='fall'?.45:kind==='shatter'?.7:kind==='mask-clatter'?.22:kind==='saw'?.65:scratch?.5:.65;
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.30*volume,t+.02);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    const cleanup=()=>{gain.disconnect();panner.disconnect();};
    if(scratch){
      const source=ctx.createBufferSource(),buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++){const phase=i/ctx.sampleRate;data[i]=(Math.random()*2-1)*(kind==='saw'?.4+.6*Math.abs(Math.sin(phase*120)):kind==='ratchet'?Math.pow(Math.max(0,Math.sin(phase*95)),6):1);}
      source.buffer=buffer;const filter=ctx.createBiquadFilter();filter.type=kind==='boil'||kind==='splash'?'lowpass':'bandpass';filter.frequency.value=kind==='saw'?1300:kind==='snip'?2100:kind==='chain'?2800:kind==='splash'?550:kind==='peel'?1500:kind==='shatter'?2400:850;filter.Q.value=kind==='chain'?8:.9;
      if(kind==='peel')filter.frequency.exponentialRampToValueAtTime(320,t+duration);
      if(kind==='fall')filter.frequency.exponentialRampToValueAtTime(2600,t+duration);
      if(kind==='creak'){filter.Q.value=10;filter.frequency.setValueAtTime(310,t);filter.frequency.exponentialRampToValueAtTime(850,t+duration);}
      source.connect(filter);filter.connect(gain);source.start(t);source.onended=()=>{source.disconnect();filter.disconnect();cleanup();};
    }else{
      const osc=ctx.createOscillator();osc.type=kind==='bell'||kind==='portal'?'sine':'triangle';const frequency=kind==='bell'?740:kind==='portal'?220:kind==='hoof'?110:kind==='mask-clatter'?320:70;
      osc.frequency.setValueAtTime(frequency,t);osc.frequency.exponentialRampToValueAtTime(kind==='portal'?440:frequency*.45,t+duration);osc.connect(gain);osc.start(t);osc.stop(t+duration+.02);osc.onended=()=>{osc.disconnect();cleanup();};
    }
  }
}
