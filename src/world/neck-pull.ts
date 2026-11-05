import * as T from 'three';
import type { SpectralParts } from './spectral-parts';

export const NECK_CYCLE_DURATION=16;
export const NECK_BREAK_TIME=6.2;
export const NECK_RELEASE_TIME=8.2;
const smooth=(u:number)=>{u=T.MathUtils.clamp(u,0,1);return u*u*(3-2*u);};
export function neckPullBeat(time:number){
  const t=((time%NECK_CYCLE_DURATION)+NECK_CYCLE_DURATION)%NECK_CYCLE_DURATION;
  const release=t>=NECK_RELEASE_TIME,age=t-NECK_RELEASE_TIME;
  const lift=release?Math.max(-.16,2.85*Math.exp(-2.8*age)*Math.cos(age*8.5)):2.85*smooth((t-1.2)/3.4);
  const dropped=smooth((t-NECK_BREAK_TIME)/.32)*(1-smooth((t-7.75)/1.25));
  const detached=t>=NECK_BREAK_TIME&&t<8.55;
  return {time:t,lift,dropped,detached,release,
    recoil:smooth((t-NECK_BREAK_TIME)/.23),
    struggle:smooth((t-2)/1.2)*(1-smooth((t-10.1)/1.2)),
    spring:release&&age<2.8?Math.exp(-age*1.3):0,
  };
}
export function neckCameraShot(time:number){
  const b=neckPullBeat(time),wide=smooth((b.time-1)/2.5)*(1-smooth((b.time-8.2)/1.2));
  return {position:new T.Vector3(3.7,2.7,-.6).lerp(new T.Vector3(4.8,3.8,1.4),wide),target:new T.Vector3(0,1.65,-6).lerp(new T.Vector3(0,2.75,-6),wide)};
}
type MeshFactory=(g:T.BufferGeometry,m:T.Material,p:[number,number,number],parent?:T.Object3D)=>T.Mesh;

export function buildNeckPullStation({root,ghost,operator,catcher,mesh,subject}:{root:T.Group;ghost:T.Group;operator:T.Group;catcher:T.Group;mesh:MeshFactory;subject:()=>T.Object3D}){
  const station=new T.Group();station.name='neck-pull-station';root.add(station);
  const material=(color:number,extra:Partial<T.MeshStandardMaterialParameters>={})=>new T.MeshStandardMaterial({color,roughness:.65,...extra});
  const wood=material(0x69372f),brass=material(0xc49a53,{metalness:.5}),iron=material(0x687a80,{metalness:.5}),rope=material(0xb5a683),skin=material(0xa9e3e6,{emissive:0x326b74,emissiveIntensity:.15}),soul=material(0xb2f7ec,{emissive:0x6ccbc4,emissiveIntensity:.6});
  const box=(s:[number,number,number],p:[number,number,number],m:T.Material,parent:T.Object3D=station)=>mesh(new T.BoxGeometry(...s),m,p,parent);
  const bar=(from:T.Vector3,to:T.Vector3,r:number,m:T.Material)=>{
    const o=mesh(new T.CylinderGeometry(r,r,1,8),m,[0,0,0],station);
    const update=(a:T.Vector3,b:T.Vector3)=>{const d=b.clone().sub(a);o.position.copy(a).lerp(b,.5);o.scale.y=Math.max(.001,d.length());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());};update(from,to);return {mesh:o,update};
  };
  box([2.0,.28,1.8],[0,.18,-6],wood);
  for(const x of [-2,2]){box([.28,5.7,.3],[x,2.85,-6.3],wood);box([.52,.18,.62],[x,.1,-6.3],brass);}
  box([4.7,.3,.40],[0,5.7,-6.3],wood);
  const pulley=mesh(new T.TorusGeometry(.32,.07,8,28),brass,[0,5.45,-6],station);
  const crank=new T.Group();crank.name='neck-winch';crank.position.set(-1.8,1.45,-5.55);station.add(crank);
  mesh(new T.TorusGeometry(.44,.06,8,24),brass,[0,0,0],crank);
  for(let j=0;j<4;j++){const spoke=box([.88,.045,.04],[0,0,0],iron,crank);spoke.rotation.z=j*Math.PI/4;}
  box([.10,.10,.32],[.35,0,.15],wood,crank);
  bar(new T.Vector3(-1.8,1.45,-5.55),new T.Vector3(0,5.45,-6),.025,rope);
  const hanging=bar(new T.Vector3(0,5.4,-6),new T.Vector3(0,1.8,-6),.025,rope);
  const collar=mesh(new T.TorusGeometry(.27,.045,8,28),brass,[0,1.8,-6],station);collar.name='neck-collar';collar.rotation.x=Math.PI/2;
  const branches=[-1,1].map(()=>bar(new T.Vector3(),new T.Vector3(0,1,0),.018,rope));
  const neckGeometry=new T.CylinderGeometry(.12,.12,1,12,18),neckPositions=neckGeometry.getAttribute('position') as T.BufferAttribute,neckRest=new Float32Array(neckPositions.array);
  neckPositions.setUsage(T.DynamicDrawUsage);
  const neck=mesh(neckGeometry,skin,[0,0,0],station);neck.name='stretching-neck';
  const springPoints=Array.from({length:145},(_,i)=>{const u=i/144;return new T.Vector3(Math.cos(u*Math.PI*18)*.16,u,Math.sin(u*Math.PI*18)*.16);});
  const spring=mesh(new T.TubeGeometry(new T.CatmullRomCurve3(springPoints),144,.018,5,false),brass,[0,0,0],station);spring.name='neck-recoil-spring';
  const net=new T.Group();net.name='head-catching-net';station.add(net);
  const rim=mesh(new T.TorusGeometry(.58,.045,8,32),wood,[0,0,0],net);rim.rotation.x=Math.PI/2;
  for(let j=0;j<7;j++){
    const angle=j/7*Math.PI*2,r=.55;
    const curve=new T.CatmullRomCurve3([new T.Vector3(Math.cos(angle)*r,0,Math.sin(angle)*r),new T.Vector3(0,-.48,0),new T.Vector3(-Math.cos(angle)*r,0,-Math.sin(angle)*r)]);
    mesh(new T.TubeGeometry(curve,16,.012,5,false),rope,[0,0,0],net);
  }
  box([.06,1.5,.06],[.65,-.6,0],wood,net);
  const stars=Array.from({length:7},(_,i)=>{const m=mesh(new T.OctahedronGeometry(.045+(i%2)*.02),soul,[0,0,0],station);m.name=`neck-snap-spark-${i}`;return m;});
  const light=new T.PointLight(0x9bdee5,4,8,2);light.position.set(0,3,-5);station.add(light);
  ghost.position.set(0,.65,-6);ghost.userData.performanceClip='bound';
  operator.position.set(-2.7,0,-5.2);operator.rotation.y=.85;operator.userData.performanceClip='pull';
  catcher.position.set(2.9,0,-5.4);catcher.rotation.y=-Math.PI/2;catcher.userData.performanceClip='greet';
  let cachedTarget:T.Object3D|undefined,cachedHead:T.Object3D|undefined,headRestY=1.05,headScale=.84;
  const findHeadRest=(target:T.Object3D,head?:T.Object3D)=>{
    if(!head)return;
    // The inverse bind matrix gives the authored head joint, unaffected by last frame's stretch.
    target.updateWorldMatrix(true,true);const inverse=target.matrixWorld.clone().invert();
    target.traverse(o=>{if(!(o instanceof T.SkinnedMesh))return;const index=o.skeleton.bones.indexOf(head as T.Bone);if(index<0)return;
      const rest=new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld).multiply(o.skeleton.boneInverses[index].clone().invert());
      headRestY=new T.Vector3().setFromMatrixPosition(rest).y;headScale=new T.Vector3().setFromMatrixScale(rest).y;
    });
  };
  return (time:number)=>{
    const b=neckPullBeat(time),target=subject(),head=target.getObjectByName('Head');
    if(target!==cachedTarget||head!==cachedHead){cachedTarget=target;cachedHead=head;headRestY=String(target.userData.assetId??'').startsWith('spirit')?1.05:1.34;findHeadRest(target,head);skin.color.setHex(String(target.userData.assetId??'').startsWith('spirit')?0xa9e3e6:0xb3c8bd);}
    const flail=b.struggle,detached=b.detached?1:0;
    ghost.position.set(Math.sin(time*8)*.10*flail*(1-b.dropped)+Math.sin(time*4)*.28*b.dropped,.65-.30*b.dropped,-6+Math.sin(time*11)*.05*flail);
    ghost.rotation.set(0,Math.sin(time*6)*.10*flail,Math.sin(time*12)*(.05+.17*b.dropped)*flail);
    ghost.userData.performanceClip=flail>.2?'flail':'bound';
    const anchor=new T.Vector3(Math.sin(time*5)*.045*flail,.65+headRestY+b.lift,-6);
    const parts:SpectralParts={left:0,right:0,lower:0,head:0,time,headAnchor:anchor.toArray() as [number,number,number]};
    ghost.userData.spectralParts=parts;if(target!==ghost)target.userData.spectralParts=parts;
    const end=anchor.clone().add(new T.Vector3(0,-.10*headScale,0)),start=new T.Vector3(0,1.02,0).applyQuaternion(ghost.quaternion).add(ghost.position);
    collar.position.copy(end);collar.rotation.z=Math.sin(time*5)*.04*flail;
    const ropeEnd=b.release?new T.Vector3(Math.sin(time*9)*.15,4.5+Math.sin(time*7)*.15,-6):end.clone().add(new T.Vector3(0,.40,0));
    hanging.update(new T.Vector3(0,5.4,-6),ropeEnd);
    branches.forEach((line,i)=>{line.mesh.visible=!b.release;line.update(ropeEnd,end.clone().add(new T.Vector3(i===0?-.27:.27,0,0)));});
    const retract=detached?b.recoil:0,a=start.clone().lerp(end,retract);
    neck.visible=(!b.detached||b.recoil<.99)&&end.y-start.y>.08;
    if(neck.visible){
      const thin=1-Math.max(0,b.lift)/2.85*.40;
      for(let i=0;i<neckPositions.count;i++){
        const u=neckRest[i*3+1]+.5,bend=Math.sin(u*Math.PI)*flail*.10*(1-retract);
        neckPositions.setXYZ(i,a.x+(end.x-a.x)*u+Math.sin(time*10+u*4)*bend+neckRest[i*3]*thin,a.y+(end.y-a.y)*u,a.z+(end.z-a.z)*u+Math.cos(time*8+u*3)*bend*.5+neckRest[i*3+2]*thin);
      }
      neckPositions.needsUpdate=true;neckGeometry.computeVertexNormals();
    }
    spring.visible=b.spring>.06;spring.position.copy(start);spring.scale.set(1,Math.max(.12,end.y-start.y),1);spring.rotation.y=time*6;
    const working=b.time>1.2&&b.time<NECK_BREAK_TIME;
    crank.rotation.z=-T.MathUtils.clamp(b.time-1.2,0,NECK_BREAK_TIME-1.2)*Math.PI*2;pulley.rotation.z=crank.rotation.z*.65;
    operator.userData.performanceClip=b.detached?'flail':working?'pull':'talk';operator.position.y=b.detached?Math.abs(Math.sin(time*9))*.08:0;
    catcher.userData.performanceClip=b.time>6.2&&b.time<10.5?'flail':'greet';
    net.position.set(1.25+Math.sin(time*5)*.6*(b.detached?1:0),1.4+Math.sin(time*9)*.18*flail,-5.3);net.rotation.z=Math.sin(time*7)*.16*flail;
    stars.forEach((o,i)=>{const age=b.time-NECK_BREAK_TIME,u=Math.max(0,age);o.visible=age>0&&age<1.1;o.position.set(Math.cos(i)*u*.9,.65+1.05+Math.sin(u*Math.PI)*.4,-6+Math.sin(i)*u*.8);o.scale.setScalar(1-smooth(age/1.1));});
    light.intensity=3.5+Math.sin(time*7)*.4+b.spring*2;
  };
}
