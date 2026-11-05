import * as T from 'three';
import {BAR_BPM,DANCES,type DanceId} from '../../shared/bar';

type Pose={position:[number,number,number];rotations:Record<string,[number,number,number]>};
/** Dance on the character's skeleton, keeping the world root free for navigation. */
export function dancePose(id:DanceId,time:number):Pose{
 const beat=time*BAR_BPM/60,p=beat*Math.PI*2,s=Math.sin(p),c=Math.cos(p),half=Math.sin(p/2),bounce=(1-c)*.5;
 const r:Pose['rotations']={Root:[0,0,0],Body:[.06*s,.10*half,.06*half],Head:[-.08*c,.1*half,0],LeftArm:[0,0,.3],RightArm:[0,0,-.3],LeftHand:[0,0,0],RightHand:[0,0,0],LeftLeg:[0,0,0],RightLeg:[0,0,0],Tail:[0,0,.14*half],TailTip:[0,0,-.22*half]};
 const position:[number,number,number]=[0,.04+.07*bounce,0];
 switch(id){
  case 'dance-bounce':r.Body=[.12*s,.12*half,.15*half];r.LeftArm=[-.4-.3*s,0,.5+.25*c];r.RightArm=[-.4+.3*s,0,-.5-.25*c];position[1]=.02+.16*bounce;break;
  case 'dance-sway':r.Body=[0,.32*half,.24*half];r.Head=[0,-.22*half,-.08*half];r.LeftArm=[-.25,0,.35+.2*half];r.RightArm=[-.25,0,-.35+.2*half];position[0]=.10*half;break;
  case 'dance-hands':r.LeftArm=[-.18+.16*s,.15*half,2.1+.25*c];r.RightArm=[-.18-.16*s,-.15*half,-2.1-.25*c];r.LeftHand=[.3*s,0,.35*c];r.RightHand=[-.3*s,0,-.35*c];r.Body=[.07*s,.17*half,.12*half];position[1]=.05+.13*bounce;break;
  case 'dance-shuffle':position[0]=.20*half;r.Body=[.12,.15*half,.12*s];r.LeftLeg=[.55*s,0,-.12*c];r.RightLeg=[-.55*s,0,.12*c];r.LeftArm=[-.65*s,0,.35];r.RightArm=[.65*s,0,-.35];r.Tail=[.3*s,0,.25*half];r.TailTip=[-.25*s,.2*half,-.45*half];break;
  case 'dance-spin':r.Root=[0,beat*Math.PI/2,0];r.Body=[.05*s,0,.1*half];r.LeftArm=[-.2,0,1.15+.12*s];r.RightArm=[-.2,0,-1.15-.12*s];r.Tail=[0,.2*half,.25*half];position[1]=.07+.10*bounce;break;
  case 'dance-summon':r.Body=[.15*c,.2*half,.10*half];r.LeftArm=[-1.1+.6*c,.25*s,.75+.25*s];r.RightArm=[-1.1+.6*c,-.25*s,-.75-.25*s];r.LeftHand=[.5*s,0,.6*s];r.RightHand=[.5*s,0,-.6*s];r.Head=[-.12*c,.22*half,0];break;
  case 'dance-hiphop':position[0]=.12*half;position[1]=.04+.16*bounce;r.Body=[.18-.2*c,.30*half,.15*s];r.Head=[-.16+.12*c,-.18*half,-.06*s];r.LeftArm=[-.8+.55*s,.1,1.0+.35*c];r.RightArm=[-.7-.55*s,-.1,-1.0+.35*c];r.LeftHand=[.3*c,.15*s,0];r.RightHand=[-.3*c,-.15*s,0];r.LeftLeg=[.45*s,0,-.14*c];r.RightLeg=[-.45*s,0,.14*c];r.Tail=[.14*s,.2*half,.25*half];break;
  case 'dance-popping':{
   const hit=Math.pow(Math.max(0,s),6);position[1]=.04+.035*hit;
   r.Body=[.08+.23*hit,.16*half,.04*s];r.Head=[-.18*hit,-.12*half,0];r.LeftArm=[-.65+.35*half,0,.85+.45*hit];r.RightArm=[-.65-.35*half,0,-.85-.45*hit];r.LeftHand=[-.7*hit,0,.35*half];r.RightHand=[-.7*hit,0,-.35*half];r.Tail=[0,0,.07*half];r.TailTip=[0,0,0];break;
  }
  case 'dance-robot':{
   const t=((time%4)+4)%4,index=Math.floor(t),fraction=t-index,u=T.MathUtils.smoothstep(fraction,.65,1);
   const poses=[[-.4,-.8,.3,1.5,-.6], [.4,-.3,1.1,.6,-1.5], [.4,-1.4,.6,.9,-.4], [-.4,-.6,1.4,.5,-1.1]];
   const a=poses[index],b=poses[(index+1)%4],v=a.map((n,i)=>T.MathUtils.lerp(n,b[i],u));
   r.Body=[.07,v[0]*.35,0];r.Head=[0,v[0],0];r.LeftArm=[v[1],0,v[3]];r.RightArm=[-v[2],0,v[4]];r.LeftHand=[Math.PI/2,0,0];r.RightHand=[Math.PI/2,0,0];r.Tail=[0,0,0];r.TailTip=[0,0,0];position[1]=.07;break;
  }
  case 'dance-moonwalk':position[0]=.16*Math.sin(p/4);position[2]=-.36*(1-Math.cos(p/4));position[1]=.04+.035*bounce;r.Body=[.10,0,.07*half];r.Head=[-.06,0,-.05*half];r.LeftArm=[.50*s,0,.12];r.RightArm=[-.50*s,0,-.12];r.LeftLeg=[-.55*s,0,0];r.RightLeg=[.55*s,0,0];r.Tail=[-.3*s,0,-.18*half];r.TailTip=[.35*s,0,.32*half];break;
  case 'dance-break':{
   const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),beat*Math.PI/2).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2)),e=new T.Euler().setFromQuaternion(q);
   r.Root=[e.x,e.y,e.z];position[1]=.55+.035*bounce;r.Body=[.08*s,0,.10*half];r.Head=[-.05*s,0,0];r.LeftArm=[-.25,0,1.7+.2*s];r.RightArm=[-.25,0,-1.7-.2*s];r.LeftLeg=[.5*s,0,-.3];r.RightLeg=[-.5*s,0,.3];r.Tail=[.3*half,0,.25*s];r.TailTip=[-.25*half,0,-.4*s];break;
  }
 }
 return {position,rotations:r};
}
export function createDanceClips(root:T.Object3D){
 const duration=8*60/BAR_BPM,samples=65,times=Array.from({length:samples},(_,i)=>i/(samples-1)*duration);
 return DANCES.map(d=>{
  const poses=times.map(t=>dancePose(d.id,t)),tracks:T.KeyframeTrack[]=[];
  for(const name of Object.keys(poses[0].rotations)){
   if(!root.getObjectByName(name))continue;
   tracks.push(new T.QuaternionKeyframeTrack(`${name}.quaternion`,times,poses.flatMap(p=>new T.Quaternion().setFromEuler(new T.Euler(...p.rotations[name])).toArray())));
  }
  const bone=root.getObjectByName('Root');
  if(bone)tracks.push(new T.VectorKeyframeTrack('Root.position',times,poses.flatMap(p=>[bone.position.x+p.position[0],bone.position.y+p.position[1],bone.position.z+p.position[2]])));
  return new T.AnimationClip(d.id,duration,tracks);
 });
}
