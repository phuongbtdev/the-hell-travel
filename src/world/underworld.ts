import * as T from 'three';
import type { ActorKind } from './characters';
import { scissorsParts } from './spectral-parts';
import { buildMaskPeelingStation } from './mask-peeling';
import { buildStoneCrushStation } from './stone-crush';
import { buildNeckPullStation } from './neck-pull';
import { ChaosScene } from './chaos';

export type SoundMood = 'hall'|'wind'|'fire'|'metal'|'ice'|'water'|'stone'|'beast';
export const FLOORS: { name:string; story:string; joke:string; mood:SoundMood; color:number }[] = [
  {name:'Rút Lưỡi',story:'Kẹp đồng và những lời chưa kịp nói.',joke:'Khoan! Cho tôi nói thêm một câu…',mood:'metal',color:0x21383d},
  {name:'Kéo Cắt',story:'Quỷ sai cắt tách từng phần hồn rồi gom lại ghép đủ bộ.',joke:'Nhớ ráp đủ giúp tôi. Đừng gửi thiếu mảnh!',mood:'metal',color:0x292b35},
  {name:'Cây Sắt',story:'Những cành gai vươn lên trong sương lạnh.',joke:'Gỡ người chưa xong, áo quan sai đã mắc trước.',mood:'wind',color:0x19383a},
  {name:'Lột Mặt Nạ',story:'Bóc từng lớp mặt giả. Xe đã đầy mà mặt vẫn chưa hết.',joke:'Bóc tới lớp thứ ba rồi. Sao trên mặt lại mọc thêm nữa?!',mood:'wind',color:0x302336},
  {name:'Lồng Hấp',story:'Hơi nước cuộn qua lồng sắt và lò gạch.',joke:'Quạt mạnh lên! …Khói lại vào mắt tôi rồi.',mood:'fire',color:0x392c2a},
  {name:'Cột Đồng',story:'Một trụ đồng đỏ rực giữa điện tối.',joke:'Ôm đúng tư thế! Để tôi làm mẫu… Á!',mood:'fire',color:0x382724},
  {name:'Núi Đao',story:'Lối lên núi đao gập ghềnh dưới gió.',joke:'Sắp tới rồi! …Vẫn đang ở chân núi.',mood:'metal',color:0x26373b},
  {name:'Núi Băng',story:'Đường băng xanh chìm trong gió tuyết.',joke:'Áo ấm quá dày. Quan sai không bước nổi.',mood:'ice',color:0x375f72},
  {name:'Vạc Dầu',story:'Vạc đồng sôi sùng sục dưới ánh lửa.',joke:'Bụp! Cả đội giật mình. Lần thứ mười tám.',mood:'fire',color:0x37261f},
  {name:'Hố Trâu',story:'Móng trâu quỷ vang khắp đấu trường.',joke:'Đuổi người kia! Người kia! Tôi là quan sai!',mood:'beast',color:0x302e29},
  {name:'Đá Đè',story:'Đá nâng cao, thả xuống. Đầu hồn vỡ tung rồi tự gom lại.',joke:'Đầu cứng thế này… đá có được bảo hành không?',mood:'stone',color:0x30383b},
  {name:'Chày Cối',story:'Nhịp chày vang giữa gian nhà đá.',joke:'Một, hai, ba! Người chịu phạt đang bắt nhịp.',mood:'stone',color:0x303332},
  {name:'Ao Máu',story:'Mặt ao đỏ sẫm che những bóng lặng im.',joke:'Khều nãy giờ… chỉ để vớt chiếc dép.',mood:'water',color:0x34262f},
  {name:'Kéo Cổ',story:'Cổ dài tới xà, thân giãy tuột ra. Đầu bật lại như lò xo.',joke:'Đỡ cái đầu! Đỡ cái đầu! Đừng đỡ mỗi cái cổ!',mood:'metal',color:0x332e30},
  {name:'Phân Thây',story:'Màn xử phạt diễn như một sân khấu rối.',joke:'Kéo nhầm hướng. Linh hồn quay như chong chóng.',mood:'wind',color:0x2b3035},
  {name:'Núi Lửa',story:'Đá nứt, tro bay, dung nham soi đỏ vách núi.',joke:'Đường đang bảo trì. Xin đi vòng… qua núi lửa.',mood:'fire',color:0x43291f},
  {name:'Cối Xay Đá',story:'Cối đá quay chầm chậm trong nhà xay.',joke:'Quay hăng quá. Giờ quan sai phải chạy theo.',mood:'stone',color:0x293435},
  {name:'Cưa Xẻ',story:'Hai đầu cưa và một cuộc tranh luận chưa dứt.',joke:'Hai ông thống nhất nhịp trước được không?',mood:'metal',color:0x292d32},
];

export type ZoneAction = {position:T.Vector3; radius:number; label:string; destination?:string; line?:string};
export type VisitZone = {root:T.Group; chaos?:ChaosScene;actions:ZoneAction[]; bounds:{x:number;minZ:number;maxZ:number}; obstacles:T.Box3[];readonly animationTime:number;setPerformanceTime:(time?:number)=>void;setParticipant:(actor?:T.Object3D)=>void;update:(time:number,dt:number)=>void; dispose:()=>void};
export type ActorFactory=(kind:ActorKind,x:number,z:number,scale?:number)=>T.Group;
const mat=(c:number,extra:Partial<T.MeshStandardMaterialParameters>={})=>new T.MeshStandardMaterial({color:c,roughness:.8,...extra});
const stone=mat(0x3b4547),dark=mat(0x202b30),wood=mat(0x592f2b),gold=mat(0xc59a58,{metalness:.6,roughness:.4}),iron=mat(0x4e6268,{metalness:.7,roughness:.45}),red=mat(0x912f27),paper=mat(0xd3c09c),ice=mat(0x92cfdf,{metalness:.12,roughness:.22}),lava=mat(0xe86821,{emissive:0xff5410,emissiveIntensity:1.8}),water=mat(0x6c2837,{metalness:.45,roughness:.15});
const sharedMaterials=new Set<T.Material>([stone,dark,wood,gold,iron,red,paper,ice,lava,water]);

export function buildVisitZone(id:string,actor:ActorFactory):VisitZone {
  const root=new T.Group();root.name=id;
  let scriptedTime:number|undefined,animationTime=0,participant:T.Object3D|undefined,victimActor:T.Group|undefined;
  let chaos:ChaosScene|undefined;
  const actions:ZoneAction[]=[],updates:((t:number,dt:number)=>void)[]=[],disposals:(()=>void)[]=[],owned:T.Mesh[]=[],sprites:T.Sprite[]=[],obstacles:T.Box3[]=[];
  const index=Number(id.replace('floor-',''))-1,isHall=id==='hall';
  const mesh=(g:T.BufferGeometry,m:T.Material,pos:[number,number,number],parent:T.Object3D=root)=>{const o=new T.Mesh(g,m);o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;parent.add(o);owned.push(o);return o;};
  const box=(s:[number,number,number],p:[number,number,number],m:T.Material=stone,parent:T.Object3D=root)=>mesh(new T.BoxGeometry(...s),m,p,parent);
  const cyl=(r:number,h:number,p:[number,number,number],m:T.Material=stone,parent:T.Object3D=root)=>mesh(new T.CylinderGeometry(r,r,h,32),m,p,parent);
  const orb=(r:number,p:[number,number,number],m:T.Material=stone,parent:T.Object3D=root)=>mesh(new T.SphereGeometry(r,24,16),m,p,parent);
  const bar=(a:T.Vector3,b:T.Vector3,r:number,m:T.Material=iron,parent:T.Object3D=root)=>{const delta=b.clone().sub(a);const o=mesh(new T.CylinderGeometry(r,r,delta.length(),12),m,a.clone().add(b).multiplyScalar(.5).toArray() as [number,number,number],parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;};
  const link=(from:()=>T.Vector3,to:()=>T.Vector3,r:number,m:T.Material=iron)=>{const o=mesh(new T.CylinderGeometry(r,r,1,10),m,[0,0,0]);updates.push(()=>{const a=from(),b=to(),delta=b.clone().sub(a);o.position.copy(a).add(b).multiplyScalar(.5);o.scale.y=Math.max(.001,delta.length());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());});return o;};
  const subjectPoint=(offset:T.Vector3)=>{const target=participant??victimActor;target?.updateWorldMatrix(true,false);return target?offset.clone().applyMatrix4(target.matrixWorld):offset.clone();};
  const label=(text:string,p:[number,number,number],width=4)=>{const c=document.createElement('canvas');c.width=768;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='rgba(16,24,29,.9)';ctx.fillRect(0,0,768,128);ctx.strokeStyle='#b79052';ctx.strokeRect(4,4,760,120);ctx.font='500 38px system-ui';ctx.fillStyle='#edcea0';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,66,716);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const o=new T.Sprite(new T.SpriteMaterial({map:tex,depthWrite:false}));o.position.set(...p);o.scale.set(width,width/6,1);root.add(o);sprites.push(o);return o;};
  const lantern=(x:number,z:number)=>{box([.17,2.8,.17],[x,1.4,z],wood);box([.65,.14,.65],[x,2.5,z],gold);box([.45,.65,.45],[x,2.12,z],lava);box([.62,.13,.62],[x,1.76,z],wood);const l=new T.PointLight(0xffad58,4,9,2);l.position.set(x,2.15,z);root.add(l);};
  const portal=(x:number,z:number,title:string,destination:string)=>{
    const arch=mesh(new T.TorusGeometry(1.1,.12,8,40),gold,[x,1.65,z]);arch.scale.y=1.25;
    box([.35,2,.45],[x-1.1,1,z],wood);box([.35,2,.45],[x+1.1,1,z],wood);
    const l=new T.PointLight(0x6cdddd,3,5,2);l.position.set(x,1.5,z);root.add(l);label(title,[x,3.6,z],3.4);
    const veil=mesh(new T.CircleGeometry(.97,32),new T.MeshBasicMaterial({color:0x84e5df,transparent:true,opacity:.16,side:T.DoubleSide,depthWrite:false}),[x,1.65,z]);veil.scale.y=1.25;
    updates.push(t=>{veil.material instanceof T.MeshBasicMaterial&&(veil.material.opacity=.12+Math.sin(t*2)*.05);});
    actions.push({position:new T.Vector3(x,0,z),radius:2.15,label:title,destination});
  };
  const performers:T.Group[]=[];
  const person=(kind:ActorKind,x:number,z:number,scale=1)=>{const role=kind==='demon'&&!isHall?(['demon','guard-green','guard-blue'] as const)[index%3]:kind;const a=actor(role,x,z,scale);a.userData.isActor=true;a.userData.assetId=role;root.add(a);performers.push(a);return a;};
  const loop=(o:T.Object3D,f:(t:number,o:T.Object3D)=>void)=>updates.push(t=>f(t,o));
  const pose=(o:T.Group,clip:string,speed=1,phase=0)=>{o.userData.performanceClip=clip;o.userData.performanceSpeed=speed;o.userData.phase=phase;return o;};
  const point=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
  box([30,.5,36],[0,-.3,-3],dark);
  // Tile bands, carved pillars and repeated lanterns keep the approved architecture coherent.
  for(let r=0;r<12;r++)for(let c=-2;c<=2;c++)box([1.6,.04,1.5],[c*1.7,-.02,6-r*1.6],r%2?stone:dark);
  for(const side of [-1,1]){
    box([.65,7,30],[side*14,3,-3],dark);
    for(let j=0;j<4;j++){cyl(.35,5,[side*11.8,2.5,6-j*6],wood);cyl(.52,.25,[side*11.8,.1,6-j*6],gold);}
    lantern(side*9,3);lantern(side*9,-10);
  }
  box([28,7,.6],[0,3,-19],dark);

  if(isHall){
    label('CHÍNH ĐIỆN · THẬP BÁT ĐỊA NGỤC',[0,6.5,-15],9);
    box([11,.4,7],[0,.15,-13],stone);box([8,.4,5.5],[0,.55,-13.5],stone);
    for(let i=0;i<4;i++)box([5,.18,.6],[0,.09+i*.18,-8-i*.6],stone);
    box([7,1.4,1.8],[0,1.5,-12],wood);box([7.3,.18,2],[0,2.25,-12],gold);
    box([3.2,4,.5],[0,2.5,-15.3],red);cyl(1.2,.3,[0,.95,-14.1],gold);
    const judge=pose(person('judge',0,-14.2,2.25),'talk');judge.position.y=.75;
    const tablet=box([1.3,.08,.7],[0,2.4,-11.8],paper);
    loop(tablet,(t,o)=>o.rotation.y=Math.sin(t*.4)*.025);
    const gavel=box([.45,.28,.35],[1.5,2.65,-11.8],gold);loop(gavel,(t,o)=>o.position.y=2.45+Math.pow(Math.max(0,Math.sin(t*1.3)),5)*.5);
    person('guard-blue',-4,-12,1.05);person('guard-green',4,-12,1.05);person('clerk',-3,-10,.85).userData.performanceClip='stamp';
    actions.push({position:point(0,0,-10),radius:3,label:'Bẩm Diêm Vương',line:'Đã có thẻ hồn thì cứ tự nhiên tham quan. Khi nào gọi số, nhớ quay lại!'});
    obstacles.push(new T.Box3(point(-4,-1,-17),point(4,6,-11)));
    // Eighteen physical archways. The map is an optional shortcut.
    for(let i=0;i<18;i++){const side=i<9?-1:1;const z=6-(i%9)*2.6;const x=side*9.2;const arch=mesh(new T.TorusGeometry(.64,.09,6,24),gold,[x,1.1,z]);arch.scale.y=1.3;label(String(i+1).padStart(2,'0')+' · '+FLOORS[i].name,[x,2.6,z],2.7);actions.push({position:point(x,0,z),radius:1.5,label:`Vào tầng ${i+1} · ${FLOORS[i].name}`,destination:`floor-${i+1}`});}
    for(let i=0;i<5;i++){const p=pose(person((['spirit','spirit-round','traveler-male','spirit-hat','traveler-female'] as const)[i],-2+i*.9,-4.5-(i%2),.8),'plead',1,i*.4);loop(p,(t,o)=>o.position.y=Math.sin(t+i)*.05);}
    portal(0,8,'Về khu ghi danh','registry');
  } else {
    if(!FLOORS[index])throw new Error(`Unknown floor ${id}`);
    label(`${String(index+1).padStart(2,'0')} · ${FLOORS[index].name.toLocaleUpperCase('vi')}`,[0,5.6,-15],8);
    portal(-8,7,'Về Chính Điện','hall');
    portal(8,7,index===17?'Trở về Chính Điện':`Tầng ${index+2} · ${FLOORS[index+1].name}`,index===17?'hall':`floor-${index+2}`);
    actions.push({position:point(0,0,-1),radius:4.3,label:'Đọc chuyện tầng này',line:FLOORS[index].joke});
    const stage=new T.Group();stage.position.z=-6;root.add(stage);
    box([11,.45,9],[0,.15,-6],stone);
    const ghost=person('penitent',0,-5,1);victimActor=ghost;ghost.userData.role='victim';ghost.userData.performanceClip='plead';
    const demon=person('demon',-3,-4,1.1);demon.userData.role='executioner';demon.userData.performanceClip='talk';
    const existingRoots=new Set(root.children);
    switch(index){
      case 0:{
        box([1.5,.7,1.0],[0,.35,-5],wood);ghost.position.set(0,.42,-5);ghost.rotation.y=-Math.PI/2;pose(ghost,'flail');demon.position.set(-2.2,.35,-5);demon.rotation.y=Math.PI/2;pose(demon,'pull');box([1,.35,1],[-2.2,.175,-5],stone);
        let grip=point(-1.1,1.6,-5);
        const tongs=new T.Group();root.add(tongs);
        for(const s of [-1,1]){const jaw=box([.95,.06,.06],[0,0,s*.07],iron,tongs);jaw.rotation.y=s*.10;}
        updates.push(t=>{const mouth=subjectPoint(point(0,participant?1.14:1.27,.28));grip=mouth.clone().add(point(-.65-.22*Math.sin(t*Math.PI),0,0));tongs.position.copy(grip).add(point(-.42,0,0));});
        link(()=>subjectPoint(point(0,participant?1.14:1.27,.28)),()=>grip,.035,red);
        const sign=label('CHƯA ĐƯỢC PHÁT BIỂU',[3,2.5,-6],3);loop(sign,(t,o)=>o.position.y=2.5+Math.sin(t)*.05);person('demon',3,-6,.9);break;
      }
      case 1:{
        ghost.position.set(0,.35,-5.7);pose(ghost,'flail');box([1.8,.35,1.3],[0,.175,-5.7],wood);
        demon.position.set(-1.5,0,-5.45);demon.rotation.y=Math.PI/2;pose(demon,'pull');pose(person('demon',1.5,-5.45,1.1),'pull',1,1).rotation.y=-Math.PI/2;
        const glow=mat(0x8de9f0,{emissive:0x67cfdc,emissiveIntensity:.9,transparent:true,opacity:.65,depthWrite:false});
        for(const side of [-1,1]){
          const tool=new T.Group();root.add(tool);
          for(const jaw of [-1,1]){
            const half=new T.Group();tool.add(half);box([.52,.055,.04],[.25,0,0],iron,half);mesh(new T.TorusGeometry(.12,.025,8,24),gold,[-.24,jaw*.055,0],half);box([.19,.04,.04],[-.07,jaw*.025,0],wood,half);
            loop(half,(t,o)=>{const cycle=t%12,working=side<0?cycle<2.3||cycle>4.5&&cycle<5.9:cycle>2.5&&cycle<4.2||cycle>6.3&&cycle<7.8;o.rotation.z=jaw*(working?.08+.32*(.5+.5*Math.cos(t*Math.PI*3)):.12);});
          }
          loop(tool,(t,o)=>{const cycle=t%12,neck=cycle>=6.3&&cycle<7.9,lower=cycle>=4.5&&cycle<6.2;const y=neck?(participant?1.25:1.4):lower?.40:participant?.92:1.15;const cut=subjectPoint(point(neck?0:side*.25,y,.15));o.position.copy(cut).add(point(side*.46,0,.05));o.rotation.y=side<0?0:Math.PI;});
        }
        updates.push(t=>{const parts=scissorsParts(t);ghost.userData.spectralParts=parts;if(participant)participant.userData.spectralParts=parts;});
        for(let j=0;j<14;j++){const mote=orb(.035,[0,1,-5.7],glow);loop(mote,(t,o)=>{const a=j/14*Math.PI*2,u=(t*1.4+j*.17)%1;o.position.copy(subjectPoint(point(Math.cos(a)*(.35+u*.65),.7+Math.sin(a)*.5,.25+u*.10)));o.scale.setScalar(Math.sin(u*Math.PI));});}
        break;
      }
      case 2:{
        const trunk=cyl(.40,5,[0,2.5,-6],iron);trunk.rotation.z=-.08;
        for(let j=0;j<9;j++){const a=j*2.4,start=point(0,2+j*.25,-6),end=point(Math.cos(a)*2.4,3+j*.3,-6+Math.sin(a)*1.5);bar(start,end,.10);for(let k=1;k<4;k++){const v=start.clone().lerp(end,k/4);mesh(new T.ConeGeometry(.13,.6,6),iron,v.toArray() as [number,number,number]);}}
        ghost.position.set(.6,1.6,-6);pose(ghost,'bound');pose(demon,'climb');demon.position.set(-1.8,.6,-5.6);loop(ghost,(t,o)=>o.rotation.z=Math.sin(t)*.10);loop(demon,(t,o)=>{o.position.y=.6+Math.sin(t*1.2)*.13;o.rotation.z=Math.sin(t)*.1;});
        for(const s of [-1,1])link(()=>point(.6+s*.6,4,-6),()=>subjectPoint(point(s*.45,1.45,0)),.025,iron);
        break;
      }
      case 3:{
        const assistant=person('guard-blue',3.65,-7,1.05);
        updates.push(buildMaskPeelingStation({root,ghost,demon,assistant,mesh,subject:()=>participant??ghost}));
        label('BÓC MÃI CHƯA HẾT',[0,4.3,-8.8],4.6);
        label('XE ĐẦY · XIN GỌI THÊM XE',[4.3,2.8,-8.6],4);
        break;
      }
      case 4:{
        box([3,1.2,3],[0,.6,-6],wood);const cage=new T.Group();cage.position.set(0,1.2,-6);root.add(cage);for(let j=0;j<12;j++){if(j===0||j===1||j===11)continue;const a=j/12*Math.PI*2;cyl(.055,3,[Math.sin(a)*1.35,1.5,Math.cos(a)*1.35],iron,cage);}cyl(1.47,.16,[0,3,0],iron,cage);ghost.position.set(0,1.2,-6);
        const gate=new T.Group();gate.position.set(-.7,0,1.17);cage.add(gate);for(const x of [0,.35,.7,1.05,1.4])cyl(.05,3,[x,1.5,0],iron,gate);box([1.5,.1,.1],[.7,2.8,0],iron,gate);loop(gate,(t,o)=>{const u=((t%14)+14)%14,opening=u<1?1-u:u>13?u-13:0;o.rotation.y=-opening*1.65;});
        for(let j=0;j<3;j++)box([2,.24,.5],[0,.16+j*.24,-3.2-j*.5],stone);
        for(let j=0;j<12;j++){const puff=orb(.4,[(j%3-1)*.6,2,-6],mat(0xabb5af,{transparent:true,opacity:.15,depthWrite:false}));loop(puff,(t,o)=>{o.position.y=1.4+((t*.5+j*.23)%3.5);o.position.x=Math.sin(t+j)*.8;o.scale.setScalar(.5+((t*.2+j*.1)%1));});}
        pose(ghost,'flail');pose(demon,'pull');demon.rotation.y=-.8;
        const fan=new T.Group();fan.position.set(-2.2,1.4,-4.9);root.add(fan);const fanBlade=mesh(new T.CircleGeometry(.55,16,0,Math.PI),paper,[0,0,0],fan);fanBlade.material.side=T.DoubleSide;box([.07,.6,.06],[0,-.25,0],wood,fan);loop(fan,(t,o)=>o.rotation.x=Math.sin(t*Math.PI)*.8);break;
      }
      case 5:{
        cyl(.75,4.5,[0,2.25,-6],lava);for(let j=0;j<4;j++)mesh(new T.TorusGeometry(.79,.08,8,36),gold,[0,.5+j*1.1,-6]).rotation.x=Math.PI/2;
        ghost.position.set(0,.2,-4.9);ghost.rotation.y=Math.PI;pose(ghost,'hug');pose(demon,'pull');loop(ghost,(t,o)=>o.position.z=-4.9-Math.max(0,Math.sin(t*Math.PI))*.12);loop(demon,(t,o)=>o.position.x=-2.5-Math.max(0,Math.sin(t*1.5))*.7);
        for(const x of [-.46,.46])mesh(new T.TorusGeometry(.10,.025,8,24),iron,[x,1.25,-5.35]).rotation.y=Math.PI/2;
        for(let i=0;i<6;i++){const spark=orb(.035,[0,1,-5.2],lava);loop(spark,(t,o)=>{const u=(t*.5+i/6)%1;o.position.set(Math.sin(i)*.65,.4+u*3.5,-5.25+Math.cos(i)*.15);o.scale.setScalar(Math.sin(u*Math.PI));});}
        break;
      }
      case 6:{
        for(let j=0;j<26;j++){const x=((j*7)%11-5)*.65,z=-4-Math.floor(j/5)*1.2;const h=.8+Math.floor(j/5)*.45;const blade=box([.13,1.6,.45],[x,h,z],iron);blade.rotation.z=.15*Math.sin(j);}
        for(let j=0;j<5;j++)box([7,.7,1.2],[0,j*.55,-4-j*1.2],dark);
        pose(ghost,'climb');loop(ghost,(t,o)=>{const cycle=((t%6)+6)%6,up=cycle<3,u=up?(1-Math.cos(cycle/3*Math.PI))*.5:cycle<4.5?Math.pow(1-(cycle-3)/1.5,2):0;o.position.set(.2,u*2,-4-u*5);o.rotation.z=up?Math.sin(t*2)*.06:Math.sin(t*7)*.15;o.userData.performanceClip=up?'climb':'flail';});demon.position.set(-4,0,-3);pose(demon,'greet');break;
      }
      case 7:{
        for(let j=0;j<13;j++){const cone=mesh(new T.ConeGeometry(.7+(j%3)*.35,2+(j%4)*.6,6),ice,[((j*7)%13-6)*.7,1,-5-Math.floor(j/5)*2]);cone.rotation.z=Math.sin(j)*.18;}
        demon.scale.setScalar(1.3);pose(demon,'shiver',4);pose(ghost,'shiver',4);ghost.position.set(0,0,-4);loop(ghost,(t,o)=>o.rotation.z=Math.sin(t*15)*.035);loop(demon,(t,o)=>o.rotation.z=Math.sin(t*12)*.02);
        for(let j=0;j<30;j++){const snow=orb(.04,[Math.sin(j)*8,3,-5+Math.cos(j)*6],ice);loop(snow,(t,o)=>{o.position.y=5-((t+j*.2)%5);o.position.x=Math.sin(j+t*.1)*8;});}
        const breath=orb(.14,[0,1.3,-3.7],mat(0xe4f7fa,{transparent:true,opacity:.32,depthWrite:false}));loop(breath,(t,o)=>{const u=(t%2)/2;o.position.copy(subjectPoint(point(0,1.15,.3))).add(point(0,u*.16,u*.35));o.scale.setScalar(.3+u);});
        break;
      }
      case 8:{
        mesh(new T.SphereGeometry(1.75,36,20,0,Math.PI*2,Math.PI/2,Math.PI/2),gold,[0,2,-6]);mesh(new T.TorusGeometry(1.75,.17,12,48),iron,[0,2,-6]).rotation.x=Math.PI/2;cyl(1.6,.07,[0,1.9,-6],lava);
        for(let j=0;j<9;j++){const bubble=orb(.1,[Math.cos(j)*1.1,2,-6+Math.sin(j)*1.1],lava);loop(bubble,(t,o)=>{const u=(t*.8+j*.3)%1;o.position.y=1.95+Math.sin(u*Math.PI)*.6;o.scale.setScalar(.3+Math.sin(u*Math.PI));});}
        ghost.position.set(0,.5,-6);pose(ghost,'bound');loop(ghost,(t,o)=>o.position.y=.3+(.5+.5*Math.cos(t*Math.PI))*.75);pose(person('demon',3,-5,1.1),'flail');pose(demon,'pound');loop(demon,(t,o)=>o.position.y=Math.pow(Math.max(0,Math.sin(t*2)),8)*.3);
        box([5,.2,.25],[0,4.6,-6],wood);for(const x of [-2.4,2.4])box([.22,4.6,.25],[x,2.3,-6],wood);
        for(const s of [-1,1])link(()=>point(s*.55,4.5,-6),()=>subjectPoint(point(s*.4,1.45,0)),.027,iron);
        const paddle=bar(point(2.7,1.5,-5),point(1.2,1.8,-6),.065,wood),paddleAngle=paddle.rotation.z;loop(paddle,(t,o)=>o.rotation.z=paddleAngle+Math.sin(t*Math.PI)*.07);
        break;
      }
      case 9:{
        // Ox silhouette built in full 3D: body, four legs, curved horns and snout.
        const ox=person('ox',0,-6,1.3);ox.userData.moving=true;
        loop(ox,(t,o)=>{o.position.set(Math.sin(t*.65)*3,0,-6+Math.cos(t*.65)*2);o.rotation.y=t*.65+Math.PI/2;});
        demon.userData.moving=true;delete demon.userData.performanceClip;ghost.userData.moving=true;delete ghost.userData.performanceClip;
        loop(demon,(t,o)=>{o.position.set(Math.sin(t*.65+.7)*3,0,-6+Math.cos(t*.65+.7)*2);o.rotation.y=t*.65+.7+Math.PI/2;});loop(ghost,(t,o)=>{o.position.set(Math.sin(t*.65+1.4)*3.5,Math.abs(Math.sin(t*6))*.06,-6+Math.cos(t*.65+1.4)*2.3);o.rotation.y=t*.65+1.4+Math.PI/2;});
        for(let j=-3;j<=3;j++){box([.14,1.1,.14],[j*1.3,.55,-9],wood);if(j<3)box([1.3,.12,.12],[j*1.3+.65,.9,-9],wood);}
        for(let j=0;j<6;j++){const dust=orb(.16,[0,.15,-6],mat(0x928477,{transparent:true,opacity:.28,depthWrite:false}));loop(dust,(t,o)=>{const lag=j*.10,a=(t-lag)*.65,u=(t+j*.16)%1;o.position.set(Math.sin(a)*3,.12+u*.35,-6+Math.cos(a)*2);o.scale.setScalar(.3+u);});}
        break;
      }
      case 10:{
        const right=person('demon',3.25,-5.6,1);
        const station=buildStoneCrushStation({root,ghost,left:demon,right,mesh,subject:()=>participant??ghost});updates.push(station.update);disposals.push(station.dispose);
        label('ĐỪNG CÓ NGÓC ĐẦU',[0,6.8,-6.2],4.8);
        break;
      }
      case 11:{
        const mortar=mesh(new T.SphereGeometry(1.45,32,16,0,Math.PI*2,Math.PI/2,Math.PI/2),stone,[0,1.6,-6]);mortar.scale.y=.8;mesh(new T.TorusGeometry(1.45,.16,10,40),iron,[0,1.6,-6]).rotation.x=Math.PI/2;
        const pestle=cyl(.22,3.5,[0,3.2,-6],wood);loop(pestle,(t,o)=>{o.position.y=3.0+(.5+.5*Math.sin(t*Math.PI))*.8;o.rotation.z=.10;});ghost.position.set(.55,.75,-5.7);pose(ghost,'flail');pose(demon,'pound');demon.position.set(-1.8,0,-5.2);demon.rotation.y=Math.PI/2;loop(ghost,(t,o)=>{o.scale.y=.78+(.5+.5*Math.sin(t*Math.PI))*.22;});
        box([.18,3,.18],[-2.5,1.5,-6],wood);link(()=>point(-2.5,2.8,-6),()=>pestle.position.clone().add(point(0,1,0)),.07,wood);
        break;
      }
      case 12:{
        const pond=mesh(new T.CircleGeometry(4.3,64),water,[0,.43,-6]);pond.rotation.x=-Math.PI/2;
        for(let j=0;j<5;j++){const ripple=mesh(new T.TorusGeometry(.4,.012,6,40),red,[0,.45,-6]);ripple.rotation.x=Math.PI/2;loop(ripple,(t,o)=>o.scale.setScalar(1+((t*.2+j*.5)%1)*7));}
        const sandal=box([.22,.08,.48],[1,.5,-5],wood);loop(sandal,(t,o)=>{o.position.y=.5+Math.sin(t)*.06;o.rotation.y=Math.sin(t*.5)*.3;});const rod=bar(point(-3.5,1.3,-4),point(1,.65,-5),.035,wood);loop(rod,(t,o)=>o.rotation.z=Math.sin(t*.8)*.04);demon.position.set(-4,0,-4);pose(demon,'pull');ghost.position.set(1.5,-.1,-7);pose(ghost,'swim');loop(ghost,(t,o)=>o.position.y=-.2+Math.sin(t*1.5)*.15);
        const float=mesh(new T.TorusGeometry(.43,.09,10,36),paper,[1.5,.48,-7]);float.rotation.x=Math.PI/2;loop(float,(t,o)=>{o.position.copy(subjectPoint(point(0,.65,0)));o.position.y=Math.max(.48,o.position.y);o.rotation.z=Math.sin(t*1.5)*.06;});link(()=>point(-3.5,1.3,-4),()=>float.position.clone(),.017,paper);
        break;
      }
      case 13:{
        const catcher=person('demon',2.9,-5.4,1.0);
        updates.push(buildNeckPullStation({root,ghost,operator:demon,catcher,mesh,subject:()=>participant??ghost}));
        label('KÉO VỪA THÔI · ĐẦU CÒN PHẢI DÙNG',[0,6.3,-6.4],6.0);
        break;
      }
      case 14:{
        const spinner=new T.Group();spinner.position.set(0,1.2,-6);root.add(spinner);ghost.position.set(0,0,0);spinner.add(ghost);pose(ghost,'bound');box([2,.15,.8],[0,.5,-6],wood);
        for(const s of [-1,1])for(const front of [-1,1]){const anchor=point(s*3,1.3,-6+front*1.4);const guard=pose(person('demon',anchor.x,anchor.z,.9),'pull',1,s+front);guard.rotation.y=-s*Math.PI/2;link(()=>anchor,()=>subjectPoint(point(s*.5,front>0?1.3:.25,front*.08)),.028,paper);}
        loop(spinner,(t,o)=>o.rotation.y=t*1.3);break;
      }
      case 15:{
        mesh(new T.ConeGeometry(3.3,4.3,9,1,true),dark,[0,2.1,-7]);cyl(1,.15,[0,4.1,-7],lava);
        for(let j=0;j<7;j++){const stream=box([.18,.08,4.5],[(j-3)*.8,.5,-5],lava);stream.rotation.y=(j-3)*.2;}
        label('ĐƯỜNG ĐANG BẢO TRÌ',[3,2,-3],3.6);demon.position.set(3,0,-3);ghost.position.set(-2,0,-4.5);pose(ghost,'flail');
        const path=new T.CatmullRomCurve3([point(-2.8,.35,-4.5),point(-1.4,.35,-5),point(-2,.35,-6)],true);for(const p of path.points)cyl(.60,.45,[p.x,.22,p.z],stone);
        loop(ghost,(t,o)=>{const u=(t%6)/6;o.position.copy(path.getPointAt(u));o.position.y+=Math.abs(Math.sin(t*Math.PI*1.5))*.42;o.rotation.y=Math.sin(t*1.4)*.35;});pose(demon,'talk');
        for(let i=0;i<5;i++){const ember=orb(.09,[0,4.2,-7],lava);loop(ember,(t,o)=>{const u=(t*.5+i*.2)%1;o.position.set(Math.sin(i*2)*u,4.1+Math.sin(u*Math.PI)*1.5,-7+Math.cos(i*2)*u);o.scale.setScalar(.4+Math.sin(u*Math.PI));});}
        break;
      }
      case 16:{
        cyl(1.7,.7,[0,.65,-6],stone);const top=cyl(1.7,.65,[0,1.4,-6],stone);loop(top,(t,o)=>o.rotation.y=t*.45);
        const handle=new T.Group();handle.position.set(0,1.65,-6);root.add(handle);box([3,.14,.14],[1.3,0,0],wood,handle);loop(handle,(t,o)=>o.rotation.y=t*.6);
        demon.userData.moving=true;delete demon.userData.performanceClip;loop(demon,(t,o)=>{o.position.set(Math.cos(t*.6)*3,0,-6-Math.sin(t*.6)*3);o.rotation.y=t*.6;});ghost.position.set(.25,.95,-4.85);pose(ghost,'flail');loop(ghost,(t,o)=>o.scale.y=.85+Math.sin(t*2)*.12);
        const hopper=mesh(new T.CylinderGeometry(.95,.48,.7,32,1,true),iron,[0,2.05,-6.6]);mesh(new T.TorusGeometry(.95,.06,8,36),gold,[0,2.4,-6.6]).rotation.x=Math.PI/2;loop(hopper,(t,o)=>o.rotation.y=t*.45);
        break;
      }
      case 17:{
        demon.visible=false;box([1.4,.18,3.1],[0,.85,-6.2],wood);
        for(const s of [-1,1]){box([.16,.8,.16],[s*.55,.4,-5.2],wood);box([.16,.8,.16],[s*.55,.4,-7.2],wood);const guard=pose(person('demon',s*2.6,-6.1,1.2),'pull',1,s>0?1:0);guard.rotation.y=-s*Math.PI/2;loop(guard,(t,o)=>o.position.x=s*2.6+Math.sin(t*Math.PI)*.23);}
        const saw=new T.Group();saw.position.set(0,1.3,-6.1);root.add(saw);box([4.5,.17,.07],[0,0,0],iron,saw);for(let j=0;j<25;j++){const tooth=mesh(new T.ConeGeometry(.055,.13,3),iron,[-2.15+j*.18,-.12,0],saw);tooth.rotation.z=Math.PI;}
        for(const s of [-1,1])box([.09,.4,.12],[s*2.2,0,0],wood,saw);
        loop(saw,(t,o)=>o.position.x=Math.sin(t*Math.PI)*.35);ghost.position.set(0,1.02,-6.9);ghost.rotation.set(Math.PI/2,Math.PI,0);pose(ghost,'saw-victim');
        for(const z of [-6.65,-5.45]){const strap=mesh(new T.TorusGeometry(.3,.025,6,24),paper,[0,1.12,z]);strap.scale.set(1.6,1,1);}
        break;
      }
    }
    const apparatus=root.children.filter(o=>!existingRoots.has(o)&&!o.userData.isActor);
    updates.forEach(f=>f(0,0));
    chaos=new ChaosScene(id,root);
    performers.filter(a=>a.visible&&['demon','guard-blue','guard-green'].includes(a.userData.assetId)).forEach((a,i)=>chaos!.registerGuard(`guard-${i}`,a));
    chaos.registerProp('apparatus',apparatus);
    for(const [key,x] of [['crate-left',-5.8],['crate-right',5.8]] as const){
      const crate=new T.Group();crate.position.set(x,.45,-2);crate.name=key;root.add(crate);
      box([.95,.8,.8],[0,0,0],wood,crate);box([1.05,.10,.9],[0,.45,0],gold,crate);
      for(const s of [-1,1])box([.09,.82,.84],[s*.32,0,0],iron,crate);
      chaos.registerProp(key,[crate]);
    }
    obstacles.push(new T.Box3(point(-5,-1,-10.5),point(5,5,-2.8)));
  }
  return {root,chaos,actions,obstacles,bounds:{x:isHall?12.9:11,minZ:isHall?-17:-15,maxZ:9},get animationTime(){return animationTime;},setPerformanceTime:t=>{scriptedTime=t;},setParticipant:a=>{if(participant&&participant!==a)delete participant.userData.spectralParts;participant=a;},update:(t,dt)=>{chaos?.beforeUpdate();animationTime=scriptedTime??chaos?.timeline(t,dt)??t;updates.forEach(f=>f(animationTime,dt));chaos?.afterUpdate(animationTime,dt);},dispose:()=>{chaos?.dispose();disposals.forEach(f=>f());if(participant)delete participant.userData.spectralParts;const dynamic=new Set<T.Material>();owned.forEach(o=>{o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(!sharedMaterials.has(m))dynamic.add(m);});});dynamic.forEach(m=>m.dispose());sprites.forEach(s=>{s.material.map?.dispose();s.material.dispose();});root.removeFromParent();}};
}

function brownMat(){return mat(0x492d28);}
