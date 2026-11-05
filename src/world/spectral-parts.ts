import * as T from 'three';

export type SpectralParts={left:number;right:number;lower:number;head:number;time:number;headShatter?:number;headAnchor?:[number,number,number]};
const cached=new WeakMap<T.Object3D,Map<T.Bone,{position:T.Vector3;scale:T.Vector3}>>();
const ease=(n:number)=>{n=T.MathUtils.clamp(n,0,1);return n*n*(3-2*n);};
export function scissorsParts(time:number):SpectralParts{
  const t=((time%12)+12)%12,rejoin=1-ease((t-9)/2.6);
  return {left:ease((t-1.2)/.7)*rejoin,right:ease((t-3)/.7)*rejoin,lower:ease((t-4.8)/.7)*rejoin,head:ease((t-6.6)/.7)*rejoin,time:t};
}
export function captureSpectralRig(root:T.Object3D){
  if(cached.has(root))return;const bones=new Map<T.Bone,{position:T.Vector3;scale:T.Vector3}>();root.traverse(o=>{if(o instanceof T.Bone)bones.set(o,{position:o.position.clone(),scale:o.scale.clone()});});cached.set(root,bones);
}
/** Clean supernatural separation: closed character surfaces drift apart and rejoin. */
export function applySpectralParts(root:T.Object3D,parts?:SpectralParts){
  captureSpectralRig(root);const bones=cached.get(root)!;
  for(const [bone,rest] of bones){
    if(!['LeftArm','RightArm','LeftLeg','RightLeg','Tail','TailTip','Head'].includes(bone.name))continue;
    bone.position.copy(rest.position);bone.scale.copy(rest.scale);if(!parts)continue;
    const bob=Math.sin(parts.time*3.5)*.05;
    if(bone.name==='LeftArm'){bone.position.x+=parts.left*.75;bone.position.y+=parts.left*(.10+bob);}
    if(bone.name==='RightArm'){bone.position.x-=parts.right*.75;bone.position.y+=parts.right*(.10-bob);}
    if(bone.name==='LeftLeg'){bone.position.y-=parts.lower*.35;bone.position.x+=parts.lower*.24;}
    if(bone.name==='RightLeg'){bone.position.y-=parts.lower*.35;bone.position.x-=parts.lower*.24;}
    if(bone.name==='TailTip')bone.position.y-=parts.lower*.28;
    if(bone.name==='Head'){
      bone.position.y+=parts.head*(.52+bob);bone.position.x+=parts.head*Math.sin(parts.time)*.10;bone.scale.multiplyScalar(Math.max(.001,1-(parts.headShatter??0)));
      if(parts.headAnchor&&bone.parent){bone.parent.updateWorldMatrix(true,false);bone.position.copy(bone.parent.worldToLocal(new T.Vector3(...parts.headAnchor)));}
    }
  }
}
