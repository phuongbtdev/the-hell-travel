import * as T from 'three';

export const MASK_CYCLE_DURATION=14;
export const MASK_PEEL_STARTS=[1.2,4,6.8] as const;
const smooth=(n:number)=>{n=T.MathUtils.clamp(n,0,1);return n*n*(3-2*n);};
export function maskPeelingBeat(time:number){
  const t=((time%MASK_CYCLE_DURATION)+MASK_CYCLE_DURATION)%MASK_CYCLE_DURATION;
  const masks=MASK_PEEL_STARTS.map(start=>({peel:smooth((t-start)/1.05),carry:smooth((t-start-1.05)/.6),drop:smooth((t-start-1.65)/.75)}));
  return {time:t,masks,removed:masks.filter(m=>m.drop===1).length,regrow:smooth((t-10.2)/.65),reset:smooth((t-13)/1)};
}

type MeshFactory=(geometry:T.BufferGeometry,material:T.Material,position:[number,number,number],parent?:T.Object3D)=>T.Mesh;
type StationOptions={
  root:T.Group;ghost:T.Group;demon:T.Group;assistant:T.Group;mesh:MeshFactory;
  subject:()=>T.Object3D;
};

/** Thick curved masks, with real eye holes and raised expressions, rather than face billboards. */
function maskShell(){
  const shape=new T.Shape();shape.absellipse(0,0,.385,.47,0,Math.PI*2,false,0);
  for(const side of [-1,1]){const eye=new T.Path();eye.absellipse(side*.145,.11,.072,.082,0,Math.PI*2,true,0);shape.holes.push(eye);}
  const g=new T.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:true,bevelThickness:.009,bevelSize:.009,bevelSegments:2,curveSegments:20});
  const p=g.getAttribute('position');
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,p.getZ(i)+.14*(1-(x/.43)**2-(y/.62)**2));}
  g.computeVertexNormals();return g;
}

export function buildMaskPeelingStation({root,ghost,demon,assistant,mesh,subject}:StationOptions){
  const station=new T.Group();station.name='mask-peeling-station';root.add(station);
  const material=(color:number,extra:Partial<T.MeshStandardMaterialParameters>={})=>new T.MeshStandardMaterial({color,roughness:.6,...extra});
  const wood=material(0x542d37),brass=material(0xb48b48,{metalness:.5}),ink=material(0x261c31),ivory=material(0xf0dfb4),red=material(0xc44548),purple=material(0x736080),fresh=material(0xc72248,{roughness:.25});
  const maskMaterials=[ivory,brass,red];
  const glow=material(0xb6fae4,{emissive:0x59dbbb,emissiveIntensity:.65});
  const box=(size:[number,number,number],p:[number,number,number],m:T.Material,parent:T.Object3D=station)=>mesh(new T.BoxGeometry(...size),m,p,parent);
  const tube=(points:T.Vector3[],radius:number,m:T.Material,parent:T.Object3D)=>mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),20,radius,6,false),m,[0,0,0],parent);
  const mask=(variant:number,parent:T.Object3D,peeled=false)=>{
    const group=new T.Group();parent.add(group);mesh(maskShell(),maskMaterials[variant%3],[0,0,0],group);
    if(peeled){const rim=mesh(new T.TorusGeometry(.32,.025,7,28),fresh,[0,0,-.015],group);rim.scale.y=1.28;}
    const dot=(p:[number,number,number],scale:[number,number,number],m:T.Material)=>{const o=mesh(new T.SphereGeometry(1,12,8),m,p,group);o.scale.set(...scale);return o;};
    dot([0,-.025,.16],[.055,.10,.07],maskMaterials[variant%3]);
    for(const side of [-1,1]){
      const y=variant%3===2?.26:.28,tilt=variant%3===2?side*.045:-side*.03;
      tube([new T.Vector3(side*.07,y-tilt,.10),new T.Vector3(side*.15,y,.12),new T.Vector3(side*.24,y+tilt,.075)],.018,ink,group);
      dot([side*.245,-.08,.09],[.05,.025,.013],variant%3===0?red:purple);
    }
    const grin=variant%3!==2;
    tube([new T.Vector3(-.21,-.13,.13),new T.Vector3(0,grin?-.28:-.10,.17),new T.Vector3(.21,-.13,.13)],.027,ink,group);
    if(variant%3===1)for(let i=-2;i<=2;i++)box([.035,.06,.025],[i*.06,-.23+Math.abs(i)*.025,.18],ivory,group);
    if(variant%3===2)for(const side of [-1,1])dot([side*.20,-.03,.14],[.025,.08,.02],glow);
    return group;
  };
  // The chair leaves the face exposed; the executioner stays at its side.
  box([1.5,.2,1.2],[0,.5,-6],wood);box([1.4,2.1,.17],[0,1.35,-6.48],wood);
  for(const x of [-.64,.64]){box([.14,.5,.15],[x,.25,-5.65],wood);box([.13,.9,.14],[x,.9,-5.85],brass);box([.24,.12,.8],[x,1.15,-5.96],wood);}
  box([1.1,.13,.14],[0,1.35,-6.13],brass);
  ghost.position.set(0,.5,-6);ghost.userData.performanceClip='bound';
  demon.position.set(-1.55,.12,-5.65);demon.rotation.y=Math.PI/3;demon.userData.performanceClip='pull';
  assistant.position.set(3.65,.1,-7);assistant.rotation.y=-Math.PI/2;assistant.userData.performanceClip='push';

  const cart=new T.Group();cart.name='discarded-mask-cart';station.add(cart);cart.position.set(2.35,0,-6.65);
  box([1.75,.14,1.5],[0,.6,0],wood,cart);
  for(const z of [-.76,.76])box([1.9,.58,.13],[0,.96,z],wood,cart);
  for(const x of [-.91,.91])box([.13,.58,1.6],[x,.96,0],wood,cart);
  for(const x of [-.68,.68])for(const z of [-.5,.5]){const wheel=mesh(new T.TorusGeometry(.27,.075,8,20),ink,[x,.3,z],cart);wheel.rotation.y=Math.PI/2;}
  box([.9,.1,.12],[1.2,1.1,0],brass,cart);
  const pile:T.Group[]=[];
  for(let j=0;j<13;j++){
    const m=mask(j%3,cart);m.name=`discarded-mask-${j}`;m.scale.setScalar(.7);
    m.position.set(((j*7)%5-2)*.24,.87+Math.floor(j/4)*.17,((j*3)%5-2)*.20);
    m.rotation.set(-1.05+(j%3)*.35,(j%4)*.7,(j%2?1:-1)*.3);pile.push(m);
  }
  // Old faces keep grinning on the wall, lit from below like a collection of trophies.
  for(let i=0;i<6;i++){
    const hook=box([.10,.16,.18],[-4.5+i*1.8,3.7,-9.25],brass);
    const m=mask(i%3,station);m.position.copy(hook.position).add(new T.Vector3(0,-.4,.2));m.rotation.z=(i%2?1:-1)*.10;m.scale.setScalar(.85);
  }
  const layers=maskMaterials.map((_,i)=>{const m=mask(i,station,true);m.name=`peeling-mask-${i}`;return m;});
  const tissue=layers.map((_,i)=>Array.from({length:3},(_,j)=>{const strand=mesh(new T.CylinderGeometry(.017,.025,1,7),fresh,[0,0,0],station);strand.name=`peeling-tissue-${i}-${j}`;return strand;}));
  const newFace=mask(0,station);newFace.name='regrowing-mask';
  // A gloved hand grips the edge of the mask all the way to release.
  const hand=new T.Group();hand.name='mask-gripping-hand';station.add(hand);
  const palm=mesh(new T.SphereGeometry(.10,12,8),red,[0,0,0],hand);palm.scale.set(1,.85,.7);
  for(let i=0;i<3;i++){const finger=mesh(new T.CapsuleGeometry(.024,.12,3,8),red,[.06,-.055+i*.045,.035],hand);finger.rotation.z=-.7;}
  const sleeve=mesh(new T.CylinderGeometry(.065,.105,1,10),red,[0,0,0],station);
  const light=new T.PointLight(0xc3a3ff,6,9,2);light.position.set(0,2.4,-4.8);station.add(light);
  const wisps=Array.from({length:8},()=>mesh(new T.SphereGeometry(.025,8,6),glow,[0,0,0],station));
  let cachedSubject:T.Object3D|undefined,head:T.Object3D|undefined;
  const fitted=new T.Vector3(),facing=new T.Quaternion(),headScale=new T.Vector3();
  return (time:number)=>{
    const beat=maskPeelingBeat(time),target=subject();
    if(target!==cachedSubject||!head){cachedSubject=target;head=target.getObjectByName('Head');}
    target.updateWorldMatrix(true,true);
    if(head){
      head.matrixWorld.decompose(fitted,facing,headScale);
      const spirit=String(target.userData.assetId??'').startsWith('spirit');
      fitted.add(new T.Vector3(0,spirit?.29:.10,spirit?.32:.25).multiply(headScale).applyQuaternion(facing));
    }else{target.getWorldPosition(fitted);fitted.add(new T.Vector3(0,1.35,.27));target.getWorldQuaternion(facing);}
    // Normalize by the authored face width so both the human demo and the player's soul fit.
    const faceScale=String(target.userData.assetId??'').startsWith('spirit')?.90:.96;
    let held=-1;
    for(let i=0;i<layers.length;i++){
      const m=layers[i],state=beat.masks[i],spread=1.07-i*.035;
      const initial=fitted.clone().add(new T.Vector3(0,0,(2-i)*.055).applyQuaternion(facing));
      const pulled=initial.clone().add(new T.Vector3(-.72,.2,.8));
      const aboveCart=new T.Vector3(2.25,2.6,-6.3),land=new T.Vector3(2.15+(i-1)*.26,1.6+i*.13,-6.4);
      m.position.copy(initial).lerp(pulled,state.peel).lerp(aboveCart,state.carry).lerp(land,state.drop);
      m.position.y+=Math.sin(state.carry*Math.PI)*.45+Math.sin(state.drop*Math.PI)*.2;
      m.quaternion.copy(facing);m.rotateY(-state.peel*.6+state.carry*.9);m.rotateX(-state.drop*1.0);m.rotateZ(state.peel*-.22+state.drop*(i%2?.3:-.3));
      m.scale.setScalar(faceScale*spread*(1-beat.reset));m.visible=m.scale.x>.005;
      tissue[i].forEach((strand,j)=>{
        strand.visible=state.peel>.025&&state.carry<.3;
        const local=new T.Vector3((j-1)*.22,j%2?.23:-.10,.025),from=local.clone().multiplyScalar(faceScale).applyQuaternion(facing).add(initial),to=local.clone().multiplyScalar(m.scale.x).applyQuaternion(m.quaternion).add(m.position),delta=to.clone().sub(from);
        strand.position.copy(from).lerp(to,.5);strand.scale.set(1,Math.max(.001,delta.length()),1);strand.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
      });
      if(state.peel>0&&state.drop<.05)held=i;
    }
    newFace.position.copy(fitted);newFace.quaternion.copy(facing);newFace.scale.setScalar(faceScale*(beat.regrow*(1-beat.reset)+beat.reset));newFace.visible=beat.regrow>.001;
    // Walk around the front of the chair to carry the face to the cart, then back.
    // The mask is never dragged by an arm stretching across the whole station.
    const active=beat.masks.findIndex(m=>m.peel>0&&m.drop<1);
    let last=-1;beat.masks.forEach((m,i)=>{if(m.peel>0)last=i;});
    let carry=active>=0?beat.masks[active].carry:0;
    if(active<0&&last>=0)carry=1-smooth((beat.time-MASK_PEEL_STARTS[last]-2.4)/.35);
    demon.position.set(-1.55+carry*3.35,.12,-5.65+Math.sin(carry*Math.PI)*1.2);
    demon.rotation.y=held>=0?Math.atan2(layers[held].position.x-demon.position.x,layers[held].position.z-demon.position.z):Math.PI/3;
    hand.visible=held>=0;
    if(held>=0){
      const mask=layers[held];hand.position.copy(new T.Vector3(-.30,.16,.04).multiplyScalar(mask.scale.x).applyQuaternion(mask.quaternion).add(mask.position));hand.quaternion.copy(mask.quaternion);
      const shoulder=demon.position.clone().add(new T.Vector3(-.2,1.15,.08)),delta=hand.position.clone().sub(shoulder);
      sleeve.position.copy(shoulder).lerp(hand.position,.5);sleeve.scale.y=delta.length();sleeve.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
    }
    sleeve.visible=hand.visible;
    const tug=beat.masks.some(m=>m.peel>0&&m.peel<1),surprised=beat.time>10.3;
    ghost.rotation.z=tug?Math.sin(time*18)*.035:0;ghost.userData.performanceClip=surprised?'flail':'bound';
    demon.userData.performanceClip=surprised?'flail':'pull';demon.rotation.z=surprised?Math.sin(time*7)*.06:0;
    assistant.userData.performanceClip=surprised?'flail':'push';
    cart.rotation.z=surprised?Math.sin(time*10)*.025:0;
    pile.forEach((m,j)=>{m.rotation.z=(j%2?1:-1)*.3+(surprised?Math.sin(time*6+j)*.08:0);});
    light.intensity=5.5+Math.sin(time*8)*.7;
    wisps.forEach((m,j)=>{const u=(time*.6+j/8)%1;m.position.copy(fitted).add(new T.Vector3(Math.sin(j*2+time)*(.4+u*.2),u*.8,Math.cos(j*2+time)*.4));m.scale.setScalar(Math.sin(u*Math.PI));});
  };
}
