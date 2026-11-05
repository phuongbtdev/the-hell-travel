import * as T from 'three';
import { deflateSync } from 'node:zlib';
import fs from 'node:fs/promises';

// A small local CPU renderer for reproducible video assets. Uses the actual GLB
// skinning and scene geometry; no screen capture or external rendering service.
export class SoftwareRenderer {
  constructor(width=512,height=288){this.width=width;this.height=height;this.rgb=Buffer.alloc(width*height*3);this.depth=new Float32Array(width*height);}
  render(scene,camera,bg=0x26343c){
    const {width:W,height:H,rgb,depth}=this;depth.fill(Infinity);
    for(let p=0;p<W*H;p++){const y=Math.floor(p/W)/H;rgb[p*3]=((bg>>16)&255)*(1-y*.3);rgb[p*3+1]=((bg>>8)&255)*(1-y*.3);rgb[p*3+2]=(bg&255)*(1-y*.3);}
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const vp=new T.Matrix4().multiplyMatrices(camera.matrixWorldInverse,new T.Matrix4()),projection=camera.projectionMatrix.elements;
    const light=new T.Vector3(-.3,.8,1).normalize(),v=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),edge=new T.Vector3();
    scene.traverseVisible(mesh=>{
      if(!mesh.isMesh)return;const mat=mesh.material;if(Array.isArray(mat)||mat.opacity<.25)return;
      const g=mesh.geometry,pos=g.attributes.position,indices=g.index?.array;if(!pos)return;
      if(mesh.isSkinnedMesh)mesh.skeleton.update();
      const mv=new T.Matrix4().multiplyMatrices(vp,mesh.matrixWorld),world=new Float32Array(pos.count*3),screen=new Float32Array(pos.count*3),shades=new Float32Array(pos.count),normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
      for(let i=0;i<pos.count;i++){
        v.fromBufferAttribute(pos,i);if(mesh.isSkinnedMesh)mesh.applyBoneTransform(i,v);
        a.copy(v).applyMatrix4(mesh.matrixWorld);world.set([a.x,a.y,a.z],i*3);v.applyMatrix4(mv);
        const d=-v.z;screen[i*3]=(v.x*projection[0]/d*.5+.5)*W;screen[i*3+1]=(-v.y*projection[5]/d*.5+.5)*H;screen[i*3+2]=d;
        if(g.attributes.normal){normal.fromBufferAttribute(g.attributes.normal,i).applyMatrix3(normalMatrix).normalize();shades[i]=.70+.48*Math.max(0,normal.dot(light));}else shades[i]=.9;
      }
      const color=(mat.color??new T.Color(0xeeeeee)).clone().convertLinearToSRGB();const emissive=mat.emissive?.getHex()?Math.min(.45,(mat.emissiveIntensity??1)*.25):0;
      const count=indices?.length??pos.count;
      for(let i=0;i<count;i+=3){
        const ia=(indices?indices[i]:i)*3,ib=(indices?indices[i+1]:i+1)*3,ic=(indices?indices[i+2]:i+2)*3;
        const ax=screen[ia],ay=screen[ia+1],az=screen[ia+2],bx=screen[ib],by=screen[ib+1],bz=screen[ib+2],cx=screen[ic],cy=screen[ic+1],cz=screen[ic+2];
        if(az<=.1||bz<=.1||cz<=.1)continue;
        const minX=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxX=Math.min(W-1,Math.ceil(Math.max(ax,bx,cx))),minY=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxY=Math.min(H-1,Math.ceil(Math.max(ay,by,cy)));
        if(minX>maxX||minY>maxY)continue;
        const area=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(area)<.02)continue;
        a.fromArray(world,ia);b.fromArray(world,ib);c.fromArray(world,ic);normal.subVectors(b,a);edge.subVectors(c,a);normal.cross(edge).normalize();
        const r=color.r*255,gg=color.g*255,bb=color.b*255;
        for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
          const w0=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/area,w1=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/area,w2=1-w0-w1;
          if(w0<0||w1<0||w2<0)continue;const z=1/(w0/az+w1/bz+w2/cz),p=y*W+x;if(z>=depth[p])continue;depth[p]=z;
          const intensity=Math.min(1.3,shades[ia/3]*w0+shades[ib/3]*w1+shades[ic/3]*w2+emissive),fade=Math.min(.25,z/100),k=p*3;rgb[k]=Math.min(255,r*intensity)*(1-fade)+((bg>>16)&255)*fade;rgb[k+1]=Math.min(255,gg*intensity)*(1-fade)+((bg>>8)&255)*fade;rgb[k+2]=Math.min(255,bb*intensity)*(1-fade)+(bg&255)*fade;
        }
      }
    });
    return rgb;
  }
}

const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4);len.writeUInt32BE(data.length);let c=0xffffffff;for(const b of Buffer.concat([t,data]))c=crcTable[(c^b)&255]^(c>>>8);const crc=Buffer.alloc(4);crc.writeUInt32BE((c^0xffffffff)>>>0);return Buffer.concat([len,t,data,crc]);}
export async function savePNG(path,rgb,w,h){const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++)rgb.copy(raw,y*(w*3+1)+1,y*w*3,(y+1)*w*3);const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=2;await fs.writeFile(path,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}
