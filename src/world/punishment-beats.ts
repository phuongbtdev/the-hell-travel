import type {SpectralParts} from './spectral-parts';
export const loopTime=(time:number,duration:number)=>((time%duration)+duration)%duration;
export const smoothBeat=(u:number)=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
export function tongueBeat(time:number){
 const t=loopTime(time,12),pull=smoothBeat((t-1)/3.2)*(1-smoothBeat((t-8.6)/.32));
 return {time:t,pull,length:.25+pull*2.1,recoil:t>=8.6&&t<9.5?Math.sin((t-8.6)/.9*Math.PI):0};
}
export function treeBeat(time:number){const t=loopTime(time,14);return {time:t,snag:smoothBeat((t-5.5)/.8)*(1-smoothBeat((t-11)/2)),tug:Math.pow(Math.max(0,Math.sin(t*2.4)),5)};}
export function steamBeat(time:number){const t=loopTime(time,14),pressure=smoothBeat((t-1)/4.3)*(1-smoothBeat((t-7.2)/.5)),vent=smoothBeat((t-7.2)/.12)*(1-smoothBeat((t-9.2)/1));return {time:t,pressure,vent};}
export function bladeBeat(time:number){const t=loopTime(time,6);return {time:t,sliding:t>3&&t<4.5,impact:Math.max(0,1-Math.abs(t-3.45)/.65)};}
export function oxBeat(time:number){const t=loopTime(time,16);return {time:t,windup:t>=4.4&&t<5.4,charge:smoothBeat((t-5.4)/.45),flight:smoothBeat((t-5.85)/1.25),buried:t>=7.1&&t<10.7,returning:smoothBeat((t-10.7)/2.0)};}
export function pestleBeat(time:number){
 const t=loopTime(time,2),lift=smoothBeat(t/1.15),drop=smoothBeat((t-1.15)/.31),age=t-1.46;
 return {time:t,height:3.4+lift*.95-drop*1.55+smoothBeat((t-1.63)/.37)*.60,impact:age>=0?Math.exp(-age*9):0,bounce:age>=0?Math.max(0,Math.sin(age*10))*Math.exp(-age*3):0};
}
export function dismemberParts(time:number):SpectralParts{
 const t=loopTime(time,12),rip=smoothBeat((t-3.5)/.75)*(1-smoothBeat((t-9)/2.5)),tension=smoothBeat((t-1)/2.5)*(1-smoothBeat((t-3.5)/.7));
 return {left:rip*1.8,right:rip*1.8,lower:rip*1.7,head:rip*.7,time:t,bodyScale:[1-tension*.12,1+tension*.30,1-tension*.10]};
}
export function millBeat(time:number){const t=loopTime(time,12),grind=smoothBeat((t-1.4)/1.3)*(1-smoothBeat((t-9.3)/1.7));return {time:t,grind,ribbons:smoothBeat((t-2.3)/2.8)*(1-smoothBeat((t-9)/2.6)),pulse:Math.max(0,Math.sin(t*4.5))*grind};}
export const GAG_SOUNDS:Partial<Record<number,{duration:number;events:[number,string][]}>>={
 1:{duration:12,events:[[2,'chain'],[4,'chain'],[6,'chain'],[8.6,'boing']]},
 2:{duration:12,events:[[1.2,'snip'],[3,'snip'],[4.8,'snip'],[6.6,'snip'],[9.2,'boing']]},
 3:{duration:14,events:[[1.6,'chain'],[4,'chain'],[5.8,'rope'],[8.8,'chain'],[11,'boing']]},
 5:{duration:14,events:[[1.4,'steam'],[3.2,'steam'],[5.1,'steam'],[7.2,'steam'],[7.4,'boing'],[10,'steam']]},
 7:{duration:16,events:[[3.08,'snip'],[3.6,'thud'],[9.08,'snip'],[9.6,'thud'],[15.08,'snip'],[15.6,'thud']]},
 10:{duration:16,events:[[4.7,'hoof'],[5.4,'fall'],[5.85,'crush'],[7.1,'thud'],[10.7,'boing']]},
 12:{duration:12,events:[[1.46,'crush'],[1.68,'boing'],[3.46,'crush'],[3.68,'boing'],[5.46,'crush'],[5.68,'boing'],[7.46,'crush'],[7.68,'boing'],[9.46,'crush'],[9.68,'boing'],[11.46,'crush'],[11.68,'boing']]},
 15:{duration:12,events:[[3.85,'snip'],[4.35,'rope'],[5.3,'snip'],[6.3,'rope'],[9.2,'boing']]},
 17:{duration:12,events:[[2.5,'stone'],[4.3,'stone'],[6.1,'stone'],[8.8,'boing'],[10,'stone']]},
};
