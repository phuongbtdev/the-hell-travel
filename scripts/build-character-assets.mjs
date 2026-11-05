import fs from 'node:fs/promises';
import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// Node-side mesh authoring from the approved front/side/back reference drawings.
// No billboard sprites: all surfaces, face details, rigs and clips are real glTF data.
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
  async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.(); }
};

function material(name, color, options = {}) {
  const m = new T.MeshStandardMaterial({ color, roughness: .6, ...options }); m.name = name; return m;
}
function rig(kind) {
  const group = new T.Group(); group.name = kind;
  const bones = [], indices = {};
  function bone(name, parent, x, y, z) { const b = new T.Bone(); b.name = name; b.position.set(x,y,z); (parent ?? group).add(b); indices[name] = bones.length; bones.push(b); return b; }
  const root = bone('Root', null, 0,0,0);
  const body = bone('Body', root, 0,.7,0);
  bone('Head', body, 0,.55,0);
  const left = bone('LeftArm', body, .27,.29,0); bone('LeftHand', left, .23,-.23,.02);
  const right = bone('RightArm', body, -.27,.29,0); bone('RightHand', right, -.23,-.23,.02);
  const tail = bone('Tail', body, 0,-.4,0); bone('TailTip', tail, 0,-.24,0);
  bone('LeftLeg', root, .14,.43,0); bone('RightLeg', root, -.14,.43,0);
  const parts = new Map();
  function add(g,m,skin='Body') {
    g = g.index ? g.toNonIndexed() : g;
    if (!g.getAttribute('uv')) g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    const ids=[], weights=[]; const p=g.attributes.position;
    for(let i=0;i<p.count;i++) {
      const values = typeof skin==='function' ? skin(p.getX(i),p.getY(i),p.getZ(i)) : [[skin,1]];
      for(let j=0;j<4;j++){ ids.push(values[j] ? indices[values[j][0]] : 0); weights.push(values[j]?.[1] ?? 0); }
    }
    g.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4)); g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    if(!parts.has(m)) parts.set(m,[]); parts.get(m).push(g);
  }
  function ellipsoid(pos,scale,m,skin='Body',segments=24) { const g=new T.SphereGeometry(1,segments,16); g.scale(...scale);g.translate(...pos);add(g,m,skin); }
  function tube(points,r,m,skin='Body',segments=24){ const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));add(new T.TubeGeometry(curve,segments,r,8,false),m,skin); }
  function tapered(points,radii,m,skin='Body',sides=24) {
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),frames=curve.computeFrenetFrames(40,false), vertices=[], uv=[], ix=[];
    for(let i=0;i<=40;i++) {const u=i/40,at=curve.getPointAt(u),ri=u*(radii.length-1),a=Math.floor(ri),r=T.MathUtils.lerp(radii[a],radii[Math.min(a+1,radii.length-1)],ri-a);
      for(let j=0;j<=sides;j++){const theta=j/sides*Math.PI*2;const v=at.clone().addScaledVector(frames.normals[i],Math.cos(theta)*r).addScaledVector(frames.binormals[i],Math.sin(theta)*r);vertices.push(v.x,v.y,v.z);uv.push(j/sides,u);if(i<40&&j<sides){const k=i*(sides+1)+j;ix.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();add(g,m,skin);
  }
  function ringSurface(profile,m,skin='Body',folds=0) {
    const v=[],uv=[],ix=[],radial=64;
    for(let i=0;i<profile.length;i++){const [y,rx,rz,cx=0]=profile[i];for(let j=0;j<=radial;j++){const a=j/radial*Math.PI*2;const fold=1+folds*Math.sin(a*8+i*.25);v.push(cx+Math.sin(a)*rx*fold,y,Math.cos(a)*rz*fold);uv.push(j/radial,i/(profile.length-1));if(i<profile.length-1&&j<radial){const k=i*(radial+1)+j;ix.push(k,k+1,k+radial+1,k+1,k+radial+2,k+radial+1);}}}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();add(g,m,skin);
  }
  function torus(pos,major,minor,m,skin='Body',rotation=[0,0,0]) { const g=new T.TorusGeometry(major,minor,8,48);g.rotateX(rotation[0]);g.rotateY(rotation[1]);g.rotateZ(rotation[2]);g.translate(...pos);add(g,m,skin); }
  function block(pos,size,m,skin='Body'){const g=new T.BoxGeometry(...size,1,1,1);g.translate(...pos);add(g,m,skin);}
  function finish(clips){group.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones);skeleton.calculateInverses();for(const [m,geos] of parts){const mesh=new T.SkinnedMesh(mergeVertices(mergeGeometries(geos)),m);mesh.name=`${kind}_${m.name}`;group.add(mesh);mesh.bind(skeleton);mesh.frustumCulled=false;}group.userData={source:'Approved concept character-roster.png and dedicated multi-view character reference',method:'Locally authored geometry and skeletal animation, not automated photogrammetry'};return {group,clips};}
  return {group,bones,indices,add,ellipsoid,tube,tapered,ringSurface,torus,block,finish};
}

function rotationTrack(name,axis,angles,times){return new T.QuaternionKeyframeTrack(`${name}.quaternion`,times,angles.flatMap(a=>new T.Quaternion().setFromAxisAngle(new T.Vector3(...axis),a).toArray()));}
function makeClips(kind){
  const duration=kind==='spirit'?3.2:3.4,t=[0,duration/4,duration/2,duration*3/4,duration];
  const idle=new T.AnimationClip('idle',duration,[rotationTrack('Body',[0,0,1],[0,.018,0,-.018,0],t),rotationTrack('Head',[0,1,0],[0,.035,0,-.035,0],t),rotationTrack('LeftArm',[0,0,1],[0,.05,0,-.025,0],t),rotationTrack('RightArm',[0,0,1],[0,-.05,0,.025,0],t),rotationTrack('Tail',[0,0,1],[0,.13,0,-.13,0],t),rotationTrack('TailTip',[0,0,1],[0,-.18,0,.18,0],t)]);
  const t2=[0,.4,.8,1.2,1.6];
  const walk=new T.AnimationClip(kind==='spirit'?'glide_walk':'walk',1.6,[rotationTrack('Body',[1,0,0],[-.07,-.06,-.07,-.08,-.07],t2),rotationTrack('LeftArm',[1,0,0],[0,.25,0,-.25,0],t2),rotationTrack('RightArm',[1,0,0],[0,-.25,0,.25,0],t2),rotationTrack('Tail',[0,0,1],[0,.2,0,-.2,0],t2),rotationTrack('TailTip',[0,0,1],[0,-.3,0,.3,0],t2),rotationTrack('LeftLeg',[1,0,0],[0,.28,0,-.28,0],t2),rotationTrack('RightLeg',[1,0,0],[0,-.28,0,.28,0],t2)]);
  const run=walk.clone();run.name='run';run.duration=.95;run.tracks.forEach(track=>{for(let i=0;i<track.times.length;i++)track.times[i]*=.95/1.6;});
  const wave=new T.AnimationClip('greet',2,[rotationTrack('LeftArm',[0,0,1],[0,.7,.9,.7,0],[0,.4,.9,1.4,2]),rotationTrack('LeftHand',[1,0,0],[0,.3,-.3,.3,0],[0,.4,.9,1.4,2]),rotationTrack('Head',[0,0,1],[0,.1,.08,.1,0],[0,.4,.9,1.4,2])]);
  const performance=[];
  const poses={
    pull:{LeftArm:[1,0,0,[-1.1,-.9,-1.1,-.9,-1.1]],RightArm:[1,0,0,[-1.1,-.9,-1.1,-.9,-1.1]],Body:[1,0,0,[.12,-.12,.12,-.12,.12]]},
    bound:{LeftArm:[0,0,1,[1.2,1.1,1.2,1.1,1.2]],RightArm:[0,0,1,[-1.2,-1.1,-1.2,-1.1,-1.2]],Head:[0,0,1,[-.08,.1,-.08,.1,-.08]]},
    shiver:{Body:[0,0,1,[-.03,.03,-.03,.03,-.03]],LeftArm:[1,0,0,[-.7,-.65,-.7,-.65,-.7]],RightArm:[1,0,0,[-.7,-.65,-.7,-.65,-.7]]},
    push:{Body:[1,0,0,[-.28,-.18,-.28,-.18,-.28]],LeftArm:[1,0,0,[-1.3,-1.1,-1.3,-1.1,-1.3]],RightArm:[1,0,0,[-1.3,-1.1,-1.3,-1.1,-1.3]]},
    pound:{LeftArm:[1,0,0,[-2,-.4,-2,-.4,-2]],RightArm:[1,0,0,[-2,-.4,-2,-.4,-2]],Body:[1,0,0,[.1,-.2,.1,-.2,.1]]},
    climb:{LeftArm:[1,0,0,[-2.3,-1.4,-2.3,-1.4,-2.3]],RightArm:[1,0,0,[-1.4,-2.3,-1.4,-2.3,-1.4]],LeftLeg:[1,0,0,[.35,-.2,.35,-.2,.35]],RightLeg:[1,0,0,[-.2,.35,-.2,.35,-.2]]},
    flail:{LeftArm:[0,0,1,[1,1.7,1,1.7,1]],RightArm:[0,0,1,[-1.7,-1,-1.7,-1,-1.7]],Head:[0,1,0,[-.25,.25,-.25,.25,-.25]]},
    hug:{LeftArm:[1,0,0,[-1.4,-1.3,-1.4,-1.3,-1.4]],RightArm:[1,0,0,[-1.4,-1.3,-1.4,-1.3,-1.4]],Head:[0,0,1,[.1,-.1,.1,-.1,.1]]},
    plead:{LeftArm:[1,0,0,[-1.2,-1,-1.2,-1,-1.2]],RightArm:[1,0,0,[-1.1,-1.4,-1.1,-1.4,-1.1]],Head:[1,0,0,[-.08,.15,-.08,.15,-.08]]},
    look:{Head:[0,1,0,[-.5,.5,-.5,.5,-.5]],Body:[0,1,0,[-.18,.18,-.18,.18,-.18]]},
    talk:{Head:[1,0,0,[-.06,.06,-.06,.06,-.06]],LeftArm:[0,0,1,[0,-.3,0,-.2,0]]},
    'saw-victim':{LeftArm:[0,0,1,[-.5,-.7,-.5,-.7,-.5]],RightArm:[0,0,1,[.7,.5,.7,.5,.7]],Head:[0,1,0,[-.15,.15,-.15,.15,-.15]],LeftLeg:[1,0,0,[.05,-.05,.05,-.05,.05]]},
    swim:{LeftArm:[0,0,1,[.5,1.3,.5,1.3,.5]],RightArm:[0,0,1,[-1.3,-.5,-1.3,-.5,-1.3]],Body:[0,0,1,[-.08,.08,-.08,.08,-.08]]},
    stamp:{RightArm:[1,0,0,[-1.2,-.3,-1.2,-.3,-1.2]],Head:[1,0,0,[.1,-.08,.1,-.08,.1]]},
  };
  for(const [name,pose] of Object.entries(poses))performance.push(new T.AnimationClip(name,4,Object.entries(pose).map(([bone,[x,y,z,angles]])=>rotationTrack(bone,[x,y,z],angles,[0,1,2,3,4]))));
  return [idle,walk,run,wave,...performance];
}

function spirit(variant='player'){
  const r=rig('Spirit');
  const skin=material('cyan_soul',0xb0e7eb,{roughness:.3,metalness:.04,emissive:0x397c89,emissiveIntensity:.17});
  const crease=material('robe_folds',0x9bd8e1,{roughness:.4});
  const black=material('ink_eyes',0x13252c,{roughness:.15});
  const white=material('eye_glints',0xffffff,{roughness:.1,emissive:0xcccccc,emissiveIntensity:.25});
  const brow=material('soft_brows',0x427a8a);const pink=material('tongue',0xda8aa8);
  const tailWeight=(_x,y)=>{if(y<.18)return [['TailTip',1]];if(y<.45){const t=(y-.18)/.27;return [['TailTip',1-t],['Tail',t]];}if(y<.76){const t=(y-.45)/.31;return [['Tail',1-t],['Body',t]];}return [['Body',1]];};
  r.ringSurface([[.02,.009,.008,.11],[.07,.028,.023,.145],[.13,.055,.045,.14],[.2,.09,.065,.10],[.3,.13,.10,.035],[.4,.19,.14,-.01],[.52,.26,.19,-.01],[.68,.30,.23,0],[.86,.31,.24,0],[1.02,.27,.22,0],[1.17,.22,.18,0],[1.29,.14,.13,0],[1.34,.05,.06,0]],skin,tailWeight,.028);
  r.ellipsoid([0,1.54,0],[.405,.43,.35],skin,'Head',40);
  // Sculpted swept tuft and soft cheek folds, based on the cyan soul reference.
  r.tapered([[-.30,1.71,.10],[-.20,1.91,.06],[.02,1.98,0],[.19,2.04,-.02],[.23,2.14,-.03],[.14,2.16,-.03]],[.075,.10,.085,.062,.025,.001],skin,'Head');
  r.tapered([[-.32,1.72,.11],[-.39,1.53,.05],[-.45,1.45,.02]],[.09,.06,.001],skin,'Head');
  for(const s of [-1,1]){
    r.ellipsoid([s*.145,1.58,.323],[.069,.105,.027],black,'Head');
    r.ellipsoid([s*.145-.017,1.622,.347],[.019,.025,.009],white,'Head',12);
    r.tube([[s*.088,1.77,.28],[s*.15,1.79,.285],[s*.213,1.82,.25]],.013,brow,'Head');
    r.ellipsoid([s*.26,1.48,.29],[.055,.024,.015],crease,'Head');
    const arm=s===1?'LeftArm':'RightArm',hand=s===1?'LeftHand':'RightHand';
    r.tapered([[s*.19,1.19,0],[s*.32,1.10,.01],[s*.45,.99,.025],[s*.54,.94,.04]],[.10,.11,.08,.052],skin,arm);
    r.ellipsoid([s*.565,.92,.04],[.075,.07,.04],skin,hand);
    for(let f=0;f<4;f++){const x=s*(.54+f*.025),y=.88-(f===0?.005:f*.009);r.tapered([[x,y,.045],[x+s*.037,y-.06,.05],[x+s*.04,y-.09,.045]],[.016,.015,.007],skin,hand,12);}
    r.tapered([[s*.54,.96,.04],[s*.51,.94,.07],[s*.50,.91,.075]],[.022,.02,.005],skin,hand,12);
    r.tube([[s*.12,1.0,.23],[s*.18,.8,.23],[s*.14,.6,.19],[s*.06,.42,.12]],.009,crease,'Body');
  }
  r.ellipsoid([0,1.365,.329],[.092,.055,.025],black,'Head');
  r.ellipsoid([0,1.343,.35],[.053,.019,.008],pink,'Head');
  if(variant==='hat'){const g=new T.ConeGeometry(.46,.24,32);g.translate(0,1.98,0);r.add(g,crease,'Head');r.torus([0,1.86,0],.42,.015,crease,'Head',[Math.PI/2,0,0]);}
  if(variant==='female'){for(const s of [-1,1])r.tapered([[s*.33,1.73,-.04],[s*.37,1.38,-.08],[s*.25,1.08,-.12]],[.10,.085,.001],skin,'Head');}
  if(variant==='round'){r.ellipsoid([0,.82,0],[.39,.38,.27],skin,'Body');}
  return r.finish(makeClips('spirit'));
}

function tieuSai(){
  const r=rig('TieuSai');
  const skin=material('orange_red_skin',0xd9563b,{roughness:.53});const inner=material('warm_ear_inner',0xa63c2e);
  const navy=material('navy_lacquer_cloth',0x303345,{roughness:.83});const red=material('red_robe_trim',0x962d27,{roughness:.73});
  const gold=material('aged_gold_embroidery',0xc99845,{metalness:.45,roughness:.4});const hair=material('charcoal_hair',0x22232a);
  const black=material('eyes_mouth',0x191317,{roughness:.25});const white=material('ivory_teeth_eyes',0xf1e6ce,{roughness:.35});
  const brown=material('leather',0x493028,{roughness:.8});const pink=material('tongue',0xd77669);
  const parchment=material('parchment_scroll',0xd9c79e,{roughness:.96});
  r.ringSurface([[.35,.32,.21],[.40,.33,.22],[.52,.28,.20],[.68,.225,.16],[.84,.245,.17],[.98,.23,.16],[1.035,.135,.12]],navy,'Body',.035);
  // Red center panel and gold piping follow the flared robe rather than a flat billboard.
  for(const s of [-1,1]){
    r.tube([[s*.075,1.0,.13],[s*.02,.88,.18],[s*.09,.70,.17],[s*.15,.37,.22]],.019,gold,'Body');
    r.tube([[s*.10,.97,.14],[s*.055,.86,.18],[s*.13,.69,.17],[s*.19,.37,.21]],.025,red,'Body');
  }
  r.torus([0,.385,0],.315,.012,gold,'Body',[Math.PI/2,0,0]);
  r.ringSurface([[.66,.24,.182],[.70,.24,.182],[.74,.24,.182]],brown);
  r.ellipsoid([0,.70,.18],[.085,.072,.025],gold);
  r.torus([0,.7,.207],.049,.008,brown);
  for(const s of [-1,1]){
    const arm=s===1?'LeftArm':'RightArm',hand=s===1?'LeftHand':'RightHand',leg=s===1?'LeftLeg':'RightLeg';
    r.tapered([[s*.20,.97,0],[s*.32,.89,0],[s*.43,.79,0],[s*.46,.73,0]],[.11,.125,.13,.135],navy,arm);
    r.tapered([[s*.435,.77,0],[s*.466,.73,0]],[.137,.137],gold,arm);
    r.ellipsoid([s*.49,.66,.025],[.071,.094,.055],skin,hand);
    for(let f=0;f<4;f++)r.tapered([[s*(.45+f*.025),.63,.06],[s*(.46+f*.025),.555-(f===1?.02:0),.065]],[.016,.009],skin,hand,12);
    r.tapered([[s*.45,.69,.07],[s*.41,.65,.09],[s*.425,.61,.095]],[.025,.023,.009],skin,hand,12);
    r.ellipsoid([s*.15,.29,0],[.12,.19,.12],brown,leg);
    r.ellipsoid([s*.15,.11,.055],[.135,.09,.21],hair,leg);
    r.tube([[s*.27,.10,.16],[s*.24,.08,.24],[s*.12,.08,.26],[s*.03,.08,.20]],.011,gold,leg);
    r.tube([[s*.25,.42,.16],[s*.22,.47,.20],[s*.18,.46,.215],[s*.18,.43,.215]],.01,gold,'Body');
  }
  // Scroll and bell follow the hands via the rig, instead of floating independently.
  r.block([-.57,.72,.105],[.22,.27,.015],parchment,'RightHand');
  for(const y of [.575,.865]) {
    r.tube([[-.71,y,.105],[-.43,y,.105]],.025,brown,'RightHand');
    r.tube([[-.68,y,.105],[-.46,y,.105]],.027,parchment,'RightHand');
  }
  r.tube([[.50,.66,.02],[.58,.67,.02]],.018,gold,'LeftHand');
  r.torus([.58,.64,.02],.034,.009,gold,'LeftHand');
  r.ringSurface([[.47,.075,.075,.58],[.49,.077,.077,.58],[.54,.055,.055,.58],[.58,.025,.025,.58],[.59,.008,.008,.58]],gold,'LeftHand');
  r.ellipsoid([.58,.46,0],[.016,.023,.016],brown,'LeftHand',12);
  for(let j=-1;j<=1;j++)r.tube([[.58+j*.008,.44,0],[.58+j*.012,.35,.006]],.006,red,'LeftHand');
  r.ellipsoid([0,1.30,0],[.35,.34,.29],skin,'Head',40);
  r.ellipsoid([-.22,1.14,.20],[.09,.11,.07],skin,'Head');r.ellipsoid([.22,1.14,.20],[.09,.11,.07],skin,'Head');
  // Pointed ears use a closed 3D surface rather than a textured plane.
  for(const s of [-1,1]){
    r.tapered([[s*.27,1.32,0],[s*.39,1.33,0],[s*.53,1.38,-.005]],[.12,.095,.001],skin,'Head');
    r.tapered([[s*.30,1.32,.075],[s*.39,1.34,.065],[s*.49,1.37,.015]],[.058,.04,.001],inner,'Head');
    r.ellipsoid([s*.128,1.36,.252],[.112,.13,.045],white,'Head');
    r.ellipsoid([s*.12,1.36,.294],[.054,.073,.022],brown,'Head');
    r.ellipsoid([s*.115,1.36,.311],[.033,.053,.015],black,'Head');
    r.ellipsoid([s*.115-.013,1.39,.325],[.013,.018,.006],white,'Head',12);
    r.tube([[s*.065,1.50,.23],[s*.135,1.525,.23],[s*.20,1.49,.215]],.025,hair,'Head');
    r.tapered([[s*.27,1.53,0],[s*.37,1.63,0],[s*.37,1.76,.01],[s*.29,1.83,.02]],[.087,.08,.045,.001],red,'Head');
    r.tapered([[s*.28,1.56,-.06],[s*.33,1.40,-.05],[s*.34,1.19,-.05]],[.075,.055,.001],hair,'Head');
  }
  r.ellipsoid([0,1.267,.305],[.08,.052,.06],skin,'Head');
  for(const s of [-1,1])r.ellipsoid([s*.033,1.252,.35],[.015,.012,.008],inner,'Head',12);
  r.ellipsoid([0,1.145,.27],[.205,.102,.048],black,'Head');
  r.ellipsoid([0,1.096,.31],[.08,.027,.012],pink,'Head');
  for(let i=-2;i<=2;i++)r.ellipsoid([i*.055,1.207,.304],[.026,.028,.01],white,'Head',12);
  for(const s of [-1,1])r.tapered([[s*.15,1.205,.30],[s*.145,1.15,.32]],[.025,.001],white,'Head',12);
  r.tapered([[0,1.02,.20],[0,.97,.21]],[.035,.001],hair,'Head',12);
  r.ringSurface([[1.53,.34,.27],[1.58,.36,.28],[1.63,.34,.27]],hair,'Head');
  r.ringSurface([[1.60,.31,.25],[1.67,.34,.27],[1.89,.395,.29],[1.96,.40,.295]],navy,'Head');
  r.ellipsoid([0,1.96,0],[.40,.025,.295],navy,'Head');
  r.torus([0,1.81,.29],.075,.013,gold,'Head');
  for(let i=0;i<4;i++){const a=i*Math.PI/2;r.tube([[Math.sin(a)*.05,1.81+Math.cos(a)*.05,.305],[Math.sin(a+.6)*.027,1.81+Math.cos(a+.6)*.027,.31],[0,1.81,.314]],.006,gold,'Head');}
  return r.finish(makeClips('tieu-sai'));
}

function judge(){
  const r=rig('DiemVuong');const robe=material('crimson_court_robe',0x702927),gold=material('court_gold',0xc29a51,{metalness:.5}),skin=material('judge_face',0xc88b61),hair=material('black_beard',0x222129),dark=material('dark_crown',0x33313b),eye=material('judge_eyes',0x110e11),white=material('eye_white',0xf3e4c7);
  r.ringSurface([[.05,.44,.28],[.12,.45,.29],[.4,.36,.25],[.7,.30,.23],[.98,.33,.21],[1.10,.20,.15]],robe,'Body',.025);
  for(const s of [-1,1]){
    r.tapered([[s*.28,1.03,0],[s*.47,.87,0],[s*.55,.70,.04]],[.17,.20,.22],robe,s===1?'LeftArm':'RightArm');
    r.ellipsoid([s*.55,.65,.08],[.10,.11,.07],skin,s===1?'LeftHand':'RightHand');
    r.tube([[s*.09,1.10,.18],[s*.14,.85,.23],[s*.23,.06,.28]],.015,gold);
    r.tube([[s*.18,.14,.29],[s*.27,.23,.26],[s*.22,.32,.25],[s*.13,.29,.27]],.014,gold);
  }
  r.ringSurface([[.67,.32,.245],[.75,.32,.245]],gold);
  r.ellipsoid([0,1.40,0],[.30,.32,.26],skin,'Head');
  for(const s of [-1,1]){
    r.ellipsoid([s*.11,1.44,.24],[.07,.045,.025],white,'Head');r.ellipsoid([s*.11,1.44,.262],[.025,.036,.012],eye,'Head');
    r.tube([[s*.045,1.53,.245],[s*.12,1.55,.245],[s*.21,1.59,.20]],.025,hair,'Head');
    r.tapered([[s*.04,1.28,.25],[s*.14,1.24,.27],[s*.25,1.25,.20]],[.045,.035,.003],hair,'Head');
    r.tapered([[s*.22,1.25,.13],[s*.27,1.03,.12],[s*.15,.76,.15]],[.075,.08,.001],hair,'Head');
  }
  r.ellipsoid([0,1.33,.26],[.06,.07,.055],skin,'Head');
  r.tapered([[0,1.20,.23],[0,.98,.27],[0,.71,.21]],[.14,.13,.005],hair,'Head');
  r.ringSurface([[1.62,.30,.25],[1.70,.31,.25],[1.91,.24,.20],[2.02,.25,.21]],dark,'Head');
  r.block([0,1.94,.21],[.4,.24,.04],gold,'Head');r.torus([0,1.95,.24],.065,.013,dark,'Head');
  r.block([0,1.78,0],[1.15,.04,.045],gold,'Head');
  for(const s of [-1,1])for(let j=0;j<3;j++){r.tube([[s*(.4+j*.065),1.78,0],[s*(.4+j*.065),1.60,0]],.008,gold,'Head');r.ellipsoid([s*(.4+j*.065),1.58,0],[.015,.025,.015],gold,'Head',12);}
  return r.finish(makeClips('judge'));
}

function human(kind='penitent'){
  const r=rig(kind);const female=kind==='traveler-female',clerk=kind==='clerk',traveler=kind.startsWith('traveler');
  const skin=material('skin',clerk?0x7eaaa8:kind==='penitent'?0xb3c8bd:0xd5a17e),outfit=material('robe',clerk?0x333748:female?0x586f8c:traveler?0xb89564:0x899891),hair=material('hair',0x2c3037),gold=material('trim',0xc69a55,{metalness:.4}),red=material('sash',0x963b32),brown=material('leather',0x62412d),white=material('eyes',0xf3e8cf),black=material('pupils',0x1d252d);
  r.ringSurface([[.36,.24,.17],[.43,.255,.18],[.64,.21,.16],[.85,.24,.17],[1.04,.23,.15],[1.09,.12,.11]],outfit,'Body',.03);
  for(const s of [-1,1]){
    const arm=s>0?'LeftArm':'RightArm',hand=s>0?'LeftHand':'RightHand',leg=s>0?'LeftLeg':'RightLeg';
    r.tapered([[s*.19,1.01,0],[s*.34,.88,0],[s*.48,.78,.015]],[.10,.095,.065],outfit,arm);
    r.ellipsoid([s*.51,.72,.02],[.066,.09,.048],skin,hand);
    for(let f=0;f<4;f++)r.tapered([[s*(.47+f*.024),.69,.04],[s*(.48+f*.024),.605,.045]],[.014,.008],skin,hand,10);
    r.ellipsoid([s*.12,.29,0],[.095,.2,.105],outfit,leg);r.ellipsoid([s*.12,.10,.06],[.11,.085,.16],brown,leg);
    r.ellipsoid([s*.115,1.38,.238],[.075,.095,.03],white,'Head');r.ellipsoid([s*.112,1.38,.269],[.035,.058,.012],black,'Head');
    r.ellipsoid([s*.115-.012,1.403,.281],[.011,.014,.006],white,'Head',12);
    r.tube([[s*.055,1.51,.21],[s*.12,1.53,.23],[s*.19,1.55,.18]],.014,hair,'Head');
    r.ellipsoid([s*.29,1.33,0],[.055,.09,.04],skin,'Head');
  }
  r.ellipsoid([0,1.35,0],[.30,.32,.25],skin,'Head',32);
  // Facial features sit on the front shell; the larger eyes keep the concept's proportions.
  for(const s of [-1,1]){r.ellipsoid([s*.115,1.38,.238],[.075,.095,.03],white,'Head');r.ellipsoid([s*.112,1.38,.269],[.035,.058,.012],black,'Head');}
  r.ellipsoid([0,1.29,.253],[.045,.04,.035],skin,'Head');r.ellipsoid([0,1.18,.235],[kind==='penitent'?.06:.08,.035,.015],black,'Head');
  r.ellipsoid([0,1.58,-.04],[.29,.12,.23],hair,'Head');
  r.tapered([[-.22,1.59,.08],[0,1.66,.15],[.22,1.55,.11]],[.08,.10,.002],hair,'Head');
  if(female){r.ellipsoid([0,1.71,-.08],[.14,.13,.14],hair,'Head');for(const s of [-1,1])r.tapered([[s*.24,1.50,-.10],[s*.26,1.14,-.13],[s*.14,.98,-.15]],[.08,.075,.001],hair,'Head');}
  r.ringSurface([[.66,.23,.18],[.73,.23,.18]],traveler?red:brown);
  for(const s of [-1,1])r.tube([[s*.09,1.06,.13],[0,.9,.18],[s*.10,.40,.18]],.012,gold);
  if(traveler){
    r.block([0,.83,-.24],[.35,.44,.22],brown);r.block([0,1.02,-.24],[.37,.08,.23],gold);
    for(const s of [-1,1])r.tube([[s*.13,1.02,-.25],[s*.18,.99,.13],[s*.19,.73,.14]],.018,brown);
    r.ringSurface([[1.49,.302,.24],[1.54,.303,.24]],red,'Head');
    r.block([.55,.56,.07],[.16,.22,.16],material('lantern_paper',0xf3be64,{emissive:0xff9c35,emissiveIntensity:.7}),'LeftHand');
    r.torus([.55,.72,.07],.06,.009,gold,'LeftHand');
  }
  if(clerk){
    r.ringSurface([[1.59,.29,.24],[1.69,.30,.24],[1.97,.23,.21]],outfit,'Head');r.block([0,1.96,0],[.48,.06,.45],hair,'Head');
    for(const s of [-1,1])r.torus([s*.115,1.38,.286],.095,.012,gold,'Head');r.tube([[-.03,1.38,.29],[.03,1.38,.29]],.008,gold,'Head');
    r.block([0,.86,.3],[.37,.10,.29],brown);r.block([0,.915,.3],[.33,.016,.26],white);
  }
  return r.finish(makeClips(kind));
}

function executioner(style='red'){
  const r=rig(`Executioner_${style}`),slim=style==='blue',wide=style==='green'?.36:.40;
  const skin=material('demon_skin',slim?0x8397b1:style==='green'?0x788d5a:0xad4033),armor=material('dark_armor',0x34323a,{metalness:.3}),gold=material('brass',0xb58b49,{metalness:.55}),hair=material('hair',0x222b32),ivory=material('teeth',0xe9d9ad),black=material('eyes',0x101b23),red=material('waistcloth',0x8f2e26);
  r.ellipsoid([0,.86,0],[slim?.23:wide,.40,.24],skin);r.ellipsoid([0,.67,.04],[slim?.20:.32,.25,.23],skin);
  r.ringSurface([[.31,.31,.20],[.49,.32,.21],[.58,.27,.19]],red);r.ringSurface([[.56,.29,.22],[.65,.29,.22]],armor);
  r.ellipsoid([0,.61,.215],[.08,.075,.025],gold);
  for(const s of [-1,1]){
    const arm=s>0?'LeftArm':'RightArm',hand=s>0?'LeftHand':'RightHand',leg=s>0?'LeftLeg':'RightLeg';
    r.tapered([[s*.24,1.05,0],[s*.40,.96,.02],[s*.51,.81,.04]],[slim?.075:.16,slim?.08:.135,slim?.055:.095],skin,arm);
    r.ellipsoid([s*.52,.74,.045],[.09,.11,.075],skin,hand);r.tapered([[s*.16,.42,0],[s*.18,.13,.04]],[.12,.10],skin,leg);r.ellipsoid([s*.18,.09,.08],[.13,.085,.18],armor,leg);
    r.ellipsoid([s*.32,1.04,-.02],[slim?.10:.20,.10,.20],armor,arm);
    for(let j=0;j<3;j++)r.ellipsoid([s*(.25+j*.06),1.09,.13],[.025,.025,.015],gold,arm,12);
  }
  r.ellipsoid([0,1.37,0],[slim?.23:.33,slim?.37:.28,.26],skin,'Head',32);
  r.ellipsoid([0,1.20,.19],[slim?.16:.28,.12,.13],skin,'Head');
  for(const s of [-1,1]){
    r.ellipsoid([s*.115,1.40,.24],[.065,.045,.022],ivory,'Head');r.ellipsoid([s*.11,1.40,.26],[.023,.034,.011],black,'Head');
    r.tube([[s*.04,1.50,.24],[s*.13,1.47,.25],[s*.23,1.52,.18]],.028,hair,'Head');
    r.tapered([[s*.25,1.52,-.01],[s*.40,1.65,-.03],[s*.32,1.82,-.04]],[.09,.065,.001],gold,'Head');
    r.tapered([[s*.27,1.34,-.02],[s*.44,1.42,-.03]],[.08,.001],skin,'Head');
    r.tapered([[s*.15,1.17,.29],[s*.14,1.25,.30]],[.027,.001],ivory,'Head');
  }
  r.ellipsoid([0,1.18,.278],[.18,.032,.02],black,'Head');r.ellipsoid([0,1.32,.27],[.075,.045,.05],skin,'Head');
  if(slim){r.tapered([[0,1.04,.16],[0,.84,.15]],[.055,.001],hair,'Head');r.tube([[.3,.95,-.1],[.4,1.75,-.25]],.04,armor);}
  return r.finish(makeClips(style));
}

function creature(kind='hound'){
  const r=rig(kind),ox=kind==='ox',hide=material('hide',ox?0x5c4a40:0xa34b34),dark=material('mane',0x2d2529),gold=material('rings',0xc79b53,{metalness:.6}),ivory=material('horns_fangs',0xdbc99f),eye=material('eyes',0xeee1ba),black=material('pupils',0x142029);
  r.ellipsoid([0,.75,0],[ox?.43:.36,.40,ox?.7:.54],hide);r.ellipsoid([0,.97,.54],[ox?.37:.30,.35,.34],hide,'Head');r.ellipsoid([0,.78,.83],[.27,.19,.20],ox?hide:dark,'Head');
  for(const s of [-1,1]){
    for(const z of [-.42,.40]){const bone=z>0?s>0?'LeftArm':'RightArm':s>0?'LeftLeg':'RightLeg';r.tapered([[s*.29,.64,z],[s*.31,.12,z+.04]],[.10,.085],hide,bone);r.ellipsoid([s*.31,.09,z+.1],[.13,.09,.16],dark,bone);}
    r.ellipsoid([s*.18,1.08,.79],[.07,.065,.028],eye,'Head');r.ellipsoid([s*.18,1.08,.817],[.027,.045,.008],black,'Head');
    r.tapered([[s*.27,1.11,.45],[s*.46,1.35,.37],[s*(ox?.56:.38),1.51,.33]],[.09,.06,.001],ivory,'Head');
    if(!ox)r.tapered([[s*.17,.76,.93],[s*.14,.65,.97]],[.045,.001],ivory,'Head');
  }
  if(!ox){for(let j=0;j<11;j++){const a=j/11*Math.PI*2;r.ellipsoid([Math.sin(a)*.31,.99+Math.cos(a)*.32,.46],[.13,.16,.16],dark,'Head');r.ellipsoid([Math.sin(a)*.35,.72+Math.cos(a)*.29,.39],[.035,.035,.035],gold);}}
  r.torus([0,.78,1.0],ox?.08:.05,.015,gold,'Head');r.tapered([[0,.79,-.52],[.15,.89,-.82],[.17,.62,-.98]],[.045,.033,.01],hide,'Tail');
  return r.finish(makeClips(kind));
}

const builds=[['spirit',spirit],['spirit-female',()=>spirit('female')],['spirit-round',()=>spirit('round')],['spirit-hat',()=>spirit('hat')],['tieu-sai',tieuSai],['diem-vuong',judge],['penitent',human],['traveler-male',()=>human('traveler-male')],['traveler-female',()=>human('traveler-female')],['clerk',()=>human('clerk')],['executioner-red',()=>executioner('red')],['executioner-green',()=>executioner('green')],['executioner-blue',()=>executioner('blue')],['hell-hound',()=>creature('hound')],['demon-ox',()=>creature('ox')]];
await fs.mkdir('public/models',{recursive:true});
for(const [name,build] of builds){
  const {group,clips}=build();const buffer=await new GLTFExporter().parseAsync(group,{binary:true,animations:clips,onlyVisible:true});
  await fs.writeFile(`public/models/${name}.glb`,Buffer.from(buffer));
  console.log(`${name}.glb: ${buffer.byteLength.toLocaleString()} bytes, ${clips.length} clips`);
}
