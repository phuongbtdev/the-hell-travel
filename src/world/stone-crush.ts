import * as T from 'three';
import type { SpectralParts } from './spectral-parts';

export const STONE_CYCLE_DURATION=12;
export const STONE_IMPACT_TIME=3.6;
const smooth=(n:number)=>{n=T.MathUtils.clamp(n,0,1);return n*n*(3-2*n);};
export function stoneCrushBeat(time:number){
  const t=((time%STONE_CYCLE_DURATION)+STONE_CYCLE_DURATION)%STONE_CYCLE_DURATION;
  const fall=T.MathUtils.clamp((t-3.15)/.45,0,1),since=t-STONE_IMPACT_TIME;
  const lift=smooth(t/2.6),roll=smooth((t-4.05)/1.25),reset=smooth((t-10.7)/1.3);
  const scatter=smooth(since/.13)*(1-smooth((t-7.4)/2.8));
  const shake=since>=0&&since<.45?Math.exp(-since*10):0;
  const rockHeight=(2.8+lift*2.5)*(1-fall*fall)+1.98*fall*fall;
  return {time:t,since,lift,fall,roll,reset,scatter,shake,
    rockY:T.MathUtils.lerp(rockHeight+Math.max(0,Math.sin(Math.min(Math.max(since,0),.45)/.45*Math.PI))*.26,2.8,reset),
    headShatter:since<0||t>=10.2?0:Math.min(1,since/.055),
  };
}
export function stoneCrushParts(time:number):SpectralParts{
  const beat=stoneCrushBeat(time);
  return {left:0,right:0,lower:0,head:0,time,headShatter:beat.headShatter};
}
/** Small deterministic offsets; shared by the playable camera and exported film. */
export function stoneCameraShake(time:number){
  const b=stoneCrushBeat(time);
  return new T.Vector3(Math.sin(b.since*123)*.09,Math.cos(b.since*97)*.065,Math.sin(b.since*81)*.035).multiplyScalar(b.shake);
}
export function stoneCameraShot(time:number){
  const b=stoneCrushBeat(time),close=smooth((b.time-2.95)/.65)*(1-smooth((b.time-10.7)/1.3));
  return {position:new T.Vector3(-4.9,4.6,1).lerp(new T.Vector3(-3.4,2.8,-.5),close),target:new T.Vector3(0,2.7,-5.7).lerp(new T.Vector3(0,1.05,-5.8),close)};
}

type MeshFactory=(g:T.BufferGeometry,m:T.Material,p:[number,number,number],parent?:T.Object3D)=>T.Mesh;
type Chunk={group:T.Group;rest:T.Vector3;direction:T.Vector3;spin:T.Vector3};

/** Partition the actual GLB's Head-weighted triangles, preserving its hair, eyes and materials. */
function headFragments(target:T.Object3D,parent:T.Object3D,mesh:MeshFactory){
  target.updateWorldMatrix(true,true);
  const inverse=target.matrixWorld.clone().invert(),buckets=new Map<number,Map<T.Material,number[]>>();
  const spirit=String(target.userData.assetId??'').startsWith('spirit'),center=new T.Vector3(0,spirit?1.28:1.44,0);
  const addTriangle=(vertices:T.Vector3[],material:T.Material)=>{
    const c=vertices[0].clone().add(vertices[1]).add(vertices[2]).multiplyScalar(1/3).sub(center);
    const sector=Math.min(5,Math.floor((Math.atan2(c.z,c.x)+Math.PI)/(Math.PI*2)*6));
    const key=sector+(c.y>0?6:0);let bucket=buckets.get(key);if(!bucket){bucket=new Map();buckets.set(key,bucket);}
    let values=bucket.get(material);if(!values){values=[];bucket.set(material,values);}vertices.forEach(v=>values!.push(v.x,v.y,v.z));
  };
  target.traverse(o=>{
    if(!(o instanceof T.SkinnedMesh)||Array.isArray(o.material))return;
    const head=o.skeleton.bones.findIndex(b=>b.name==='Head');if(head<0)return;
    const g=o.geometry,p=g.getAttribute('position'),weights=g.getAttribute('skinWeight'),ids=g.getAttribute('skinIndex');if(!weights||!ids)return;
    const matrix=new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld),indices=g.index;
    const headWeight=(vertex:number)=>{let n=0;for(let k=0;k<4;k++)if(ids.getComponent(vertex,k)===head)n+=weights.getComponent(vertex,k);return n;};
    for(let i=0;i<(indices?.count??p.count);i+=3){
      const tri=[0,1,2].map(j=>indices?indices.getX(i+j):i+j);
      if(tri.every(v=>headWeight(v)>.9))addTriangle(tri.map(v=>new T.Vector3().fromBufferAttribute(p,v).applyMatrix4(matrix)),o.material);
    }
  });
  if(!buckets.size){
    // Temporary shell while the async character loads; replaced as soon as its rig arrives.
    const g=new T.IcosahedronGeometry(.34,1),p=g.getAttribute('position'),m=new T.MeshStandardMaterial({color:0xade7eb});
    for(let i=0;i<p.count;i+=3)addTriangle([0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,i+j).add(center)),m);
    g.dispose();m.dispose();
  }
  const chunks:Chunk[]=[],materials=new Map<T.Material,T.Material>();
  for(const [key,bucket] of buckets){
    const group=new T.Group();group.name=`shattered-head-piece-${key}`;parent.add(group);
    const all=[...bucket.values()].flat(),bounds=new T.Box3().setFromArray(all),rest=bounds.getCenter(new T.Vector3());
    for(const [source,vertices] of bucket){
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.translate(-rest.x,-rest.y,-rest.z);g.computeVertexNormals();
      let m=materials.get(source);if(!m){m=source.clone();m.side=T.DoubleSide;materials.set(source,m);}
      mesh(g,m,[0,0,0],group);
    }
    const angle=key/6*Math.PI*2;
    chunks.push({group,rest,direction:new T.Vector3(Math.cos(angle)*(1.1+(key%3)*.16),.3+(key%4)*.15,Math.sin(angle)*.95+.35),spin:new T.Vector3(key*.4+.3,key*.7-.5,key*.3+.4)});
  }
  return {chunks,materials:[...materials.values()]};
}

export function buildStoneCrushStation({root,ghost,left,right,mesh,subject}:{root:T.Group;ghost:T.Group;left:T.Group;right:T.Group;mesh:MeshFactory;subject:()=>T.Object3D}){
  const station=new T.Group();station.name='falling-stone-station';root.add(station);
  const material=(color:number,extra:Partial<T.MeshStandardMaterialParameters>={})=>new T.MeshStandardMaterial({color,roughness:.85,...extra});
  const stone=material(0x566269),wood=material(0x5d302c),iron=material(0x7e8b8e,{metalness:.6,roughness:.4}),glow=material(0x9af4ef,{emissive:0x64ccc9,emissiveIntensity:1});
  const box=(s:[number,number,number],p:[number,number,number],m:T.Material)=>mesh(new T.BoxGeometry(...s),m,p,station);
  box([1.7,.30,3.65],[0,.40,-6.3],wood);
  for(const x of [-2.3,2.3]){box([.30,6.2,.32],[x,3.1,-5.55],wood);box([.65,.24,.70],[x,.28,-5.55],iron);}
  box([5.4,.32,.38],[0,6.2,-5.55],wood);
  const geometry=new T.DodecahedronGeometry(1.15,1);geometry.scale(1,.85,.85);
  const rock=mesh(geometry,stone,[0,2.8,-5.55],station);rock.name='dropping-stone';
  const chains=[-.65,.65].map(x=>{
    const group=new T.Group();station.add(group);const links:T.Mesh[]=[];
    for(let j=0;j<12;j++){const l=mesh(new T.TorusGeometry(.075,.024,5,10),iron,[x,0,-5.55],group);l.rotation.y=j%2*Math.PI/2;links.push(l);}return {x,links};
  });
  ghost.position.set(0,.76,-7.0);ghost.rotation.set(Math.PI/2,Math.PI,0);ghost.userData.performanceClip='saw-victim';
  for(const [a,s] of [[left,-1],[right,1]] as const){a.position.set(s*3.25,.1,-5.6);a.rotation.y=-s*Math.PI/2;a.userData.performanceClip='pull';}
  const ring=mesh(new T.TorusGeometry(.8,.028,6,40),glow,[0,.59,-5.55],station);ring.rotation.x=Math.PI/2;
  const dust=Array.from({length:16},(_,i)=>{const o=mesh(new T.IcosahedronGeometry(.08+(i%3)*.035,0),i%3?stone:glow,[0,0,0],station);o.name=`impact-debris-${i}`;return o;});
  const cracks=Array.from({length:7},(_,i)=>{const o=box([.025,.015,.75],[0,.565,-5.55],iron);o.rotation.y=i*Math.PI*2/7;return o;});
  const soulLight=new T.PointLight(0xa2eaff,0,6,2);soulLight.position.set(0,1.1,-5.4);station.add(soulLight);
  let cachedTarget:T.Object3D|undefined,cachedHead:T.Object3D|undefined,fragments:ReturnType<typeof headFragments>|undefined;
  const clearFragments=()=>{
    if(!fragments)return;
    for(const c of fragments.chunks){c.group.removeFromParent();c.group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});}
    fragments.materials.forEach(m=>m.dispose());fragments=undefined;
  };
  const fragmentMesh:MeshFactory=(g,m,p,parent=station)=>{const o=new T.Mesh(g,m);o.position.set(...p);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const update=(time:number)=>{
    const b=stoneCrushBeat(time),target=subject(),head=target.getObjectByName('Head');
    if(cachedTarget!==target||cachedHead!==head){clearFragments();cachedTarget=target;cachedHead=head;}
    rock.position.set(b.roll*(1-b.reset)*2.7,b.rockY,-5.55-b.roll*(1-b.reset)*1.8);rock.rotation.z=-b.roll*(1-b.reset)*1.3;
    chains.forEach(({x,links})=>links.forEach((l,i)=>{const u=i/11;l.position.set(x+rock.position.x*u,6.1+(rock.position.y+.8-6.1)*u,-5.55);l.visible=b.roll<.07||b.reset>.9;}));
    const squash=b.since<0?0:Math.exp(-Math.max(0,b.since)*1.5);
    ghost.scale.set(1+squash*.25,1,1-squash*.38);
    const parts=stoneCrushParts(time);ghost.userData.spectralParts=parts;if(target!==ghost)target.userData.spectralParts=parts;
    for(const [a,s] of [[left,-1],[right,1]] as const){
      a.position.x=s*(3.25+Math.min(1,Math.max(0,b.since)/.12)*.4*(1-b.reset));a.position.y=.1+b.shake*.15;
      a.userData.performanceClip=b.since<0?'pull':b.time<5.5?'flail':'talk';
    }
    // Prepare the pieces before the hit, avoiding geometry work on the impact frame.
    if(!fragments)fragments=headFragments(target,station,fragmentMesh);
    if(fragments){
      target.updateWorldMatrix(true,false);const rotation=new T.Quaternion(),scale=new T.Vector3(),position=new T.Vector3();target.matrixWorld.decompose(position,rotation,scale);
      const age=Math.max(0,b.since),flight=Math.min(age,1.45),gather=1-smooth((b.time-7.4)/2.8);
      fragments.chunks.forEach((c,i)=>{
        c.group.visible=b.headShatter>0;if(!c.group.visible)return;
        c.group.position.copy(c.rest).multiply(scale).applyQuaternion(rotation).add(position);
        const ballistic=new T.Vector3(c.direction.x*flight,Math.max(-.12,(1.3+c.direction.y)*flight-1.4*flight*flight),c.direction.z*flight);
        c.group.position.addScaledVector(ballistic,gather);c.group.position.y=Math.max(.61,c.group.position.y);
        c.group.quaternion.copy(rotation).multiply(new T.Quaternion().setFromEuler(new T.Euler(c.spin.x*flight*gather,c.spin.y*flight*gather,c.spin.z*flight*gather)));
        c.group.scale.copy(scale).multiplyScalar(b.headShatter);
        if(age>1.45&&gather>.9)c.group.position.y+=Math.sin(time*5+i)*.025;
      });
    }
    const pulse=Math.min(1,Math.max(0,b.since)/.4),fade=1-smooth((b.since-1.1)/.9);
    ring.visible=b.since>=0&&b.since<2;ring.scale.setScalar(.4+pulse*2.3);soulLight.intensity=b.shake*9;
    dust.forEach((o,i)=>{
      const angle=i/16*Math.PI*2,u=Math.max(0,b.since);o.visible=u>0&&u<2;
      o.position.set(Math.cos(angle)*u*(1+i%3*.3),.65+Math.max(0,(1+i%4*.2)*u-u*u),-5.55+Math.sin(angle)*u);
      o.scale.setScalar(fade);o.rotation.set(u*i,u,u*.6);
    });
    cracks.forEach(o=>{o.visible=b.since>=0&&b.time<10.5;});
  };
  return {update,dispose:clearFragments};
}
