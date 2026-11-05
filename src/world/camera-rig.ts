import * as T from 'three';

/** A fixed view direction while walking; character turns never orbit the camera. */
export class StableCameraRig {
 private anchor=new T.Vector3();private look=new T.Vector3();private blending=true;
 reset(player:T.Vector3){this.anchor.set(player.x,0,player.z);this.look.copy(this.anchor).add(new T.Vector3(0,2,-4));this.blending=true;}
 update(camera:T.PerspectiveCamera,player:T.Vector3,dt:number,shot?:{position:T.Vector3;target:T.Vector3},danceView=false){
  const alpha=1-Math.exp(-4.8*dt);this.anchor.lerp(new T.Vector3(player.x,0,player.z),alpha);
  const portrait=camera.aspect<.85,position=this.anchor.clone().add(new T.Vector3(0,portrait?8.6:7.4,portrait?12.4:9.8)),target=this.anchor.clone().add(danceView?new T.Vector3(portrait?0:2,portrait?.4:1.1,portrait?1:-2):new T.Vector3(0,2,-4));
  if(shot){this.blending=true;camera.position.lerp(shot.position,alpha);this.look.lerp(shot.target,alpha);}
  else if(this.blending){camera.position.lerp(position,alpha);this.look.lerp(target,alpha);if(camera.position.distanceTo(position)<.015&&this.look.distanceTo(target)<.015)this.blending=false;}
  else{camera.position.copy(position);this.look.copy(target);}
  camera.lookAt(this.look);camera.updateMatrixWorld(true);
 }
}
