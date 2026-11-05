import * as THREE from 'three';

/** Optional decorative video surface. Keep it secondary to rigged 3D actors. */
export function attachLoopVideo(
  scene: THREE.Scene,
  url: string,
  position: THREE.Vector3,
  size = new THREE.Vector2(3, 2),
  options: {video?:HTMLVideoElement;poster?:string} = {},
) {
  const video = options.video??document.createElement('video');
  video.src = url;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'none';
  if(options.poster)video.poster=options.poster;
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.82, depthWrite: false, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), material);
  plane.position.copy(position);
  scene.add(plane);
  return {
    plane,
    async play() { video.preload = 'auto'; await video.play(); },
    pause() { video.pause(); },
    dispose() { video.pause(); video.removeAttribute('src'); video.load(); texture.dispose(); material.dispose(); plane.geometry.dispose(); plane.removeFromParent(); },
  };
}
