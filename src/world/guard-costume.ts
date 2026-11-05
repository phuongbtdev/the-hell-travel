import * as T from 'three';

/** Instance-owned cloth vertices; the shared GLB remains untouched. */
export class GuardCostume {
 private cloth?:T.SkinnedMesh;private original?:T.BufferGeometry;private lowered?:T.BufferGeometry;private rest?:Float32Array;private shorts?:T.Group;
 private materials:T.Material[]=[];private geometries:T.BufferGeometry[]=[];
 private lastDrop=-1;
 constructor(private actor:T.Object3D){}
 private prepare(){
  if(this.cloth)return true;
  this.actor.traverse(o=>{if(o instanceof T.SkinnedMesh&&!Array.isArray(o.material)&&o.material.name==='waistcloth')this.cloth=o;});
  const cloth=this.cloth as T.SkinnedMesh|undefined;if(!cloth)return false;
  this.original=cloth.geometry;const lowered=cloth.geometry.clone();this.lowered=lowered;this.rest=new Float32Array(lowered.getAttribute('position').array);cloth.geometry=lowered;
  const body=cloth.skeleton.bones.find(b=>b.name==='Body');if(!body)return false;
  const shorts=new T.Group();shorts.name='heart-boxers';shorts.position.y=-.205;body.add(shorts);this.shorts=shorts;
  const white=new T.MeshStandardMaterial({color:0xffe8dc,roughness:.8}),red=new T.MeshStandardMaterial({color:0xe25774,roughness:.65});this.materials.push(white,red);
  const slim=this.actor.userData.assetId==='guard-blue',width=slim?.44:.63;
  const add=(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number)=>{this.geometries.push(g);const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;shorts.add(o);return o;};
  add(new T.CylinderGeometry(width*.50,width*.51,.20,28),white,0,0,0).scale.z=.86;
  for(const side of [-1,1]){add(new T.CylinderGeometry(width*.24,width*.24,.16,18),white,side*width*.24,-.13,0).scale.z=1.45;}
  const shape=new T.Shape();shape.moveTo(0,-.045);shape.bezierCurveTo(-.11,.02,-.055,.095,0,.035);shape.bezierCurveTo(.055,.095,.11,.02,0,-.045);
  for(let j=0;j<5;j++){const x=(j%3-1)*width*.27,z=width*.51*.86*Math.sqrt(1-(x/(width*.51))**2)+.006;const heart=add(new T.ExtrudeGeometry(shape,{depth:.004,bevelEnabled:false,curveSegments:5}),red,x,j<3?.03:-.07,z);heart.scale.setScalar(.42);}
  shorts.visible=false;return true;
 }
 update(drop:number){
  if(!this.cloth&&drop<=0)return;if(!this.prepare())return;
  if(drop===this.lastDrop)return;this.lastDrop=drop;
  const p=this.lowered!.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,this.rest![i*3+1]-.36*drop);p.needsUpdate=true;
  this.shorts!.visible=drop>.04;
 }
 dispose(){if(this.cloth&&this.original)this.cloth.geometry=this.original;this.lowered?.dispose();this.shorts?.removeFromParent();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());}
}
