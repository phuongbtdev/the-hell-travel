# Optional environment loops

`floors/floor-01.mp4` through `floor-18.mp4` are 512×288 H.264 loops with PNG posters. Unaffected stations use six-second loops. Floors with punishment effects use complete 12–16 second forward loops; floor 02 shows separation and reassembly in 12 seconds. Floor 04 is the 14-second Mask Peeling scene: three false faces peel off and land on a cart before a new face grows back. They are rendered locally from the actual 3D scene and rigged characters with `scripts/render-floor-videos.ts` and `scripts/software-renderer.mjs`; no external generation service is used.

Fire/smoke on floors 05, 06, 09 and 16, progressive ice on floor 08, and blood spray/splats on floors 01, 02, 03, 04, 07, 10, 11, 12, 15, 17 and 18 use the same instanced 3D effects as gameplay. The software renderer handles instance transforms and transparent layers.

Floor 11 is a 12-second forward loop: a hoisted boulder drops onto the ghost's head, spectral head pieces scatter, then reassemble. The film uses the same head-weighted GLB triangles, timeline and camera framing as the playable station.

Floor 14 is a 16-second forward loop of Neck Pulling: the actual rigged head rises towards a beam, the body slips loose, and the head springs back onto it as two demons try to catch it. The flexible 3D neck, rig offsets and camera use the same scene code as the playable station.

Each floor shows its video in a close-up panel and as a VideoTexture in the world. Both share one HTML video/decoder; it is paused and disposed when changing zones. The files are muted because music and action audio are mixed by the scene sound system; dialogue is shown as subtitles. Use `npm run assets:videos` to regenerate, or `npm run assets:videos -- --floor=4` for a single floor.

Floors 01, 02, 03, 04, 05, 07, 10, 12, 15 and 17 now include distinct physical gags: tongue recoil, red severed sockets, snagged guard, elastic peeled tissue, steam inflation/ear vents, blade slide, ox launch, pestle squash/pop, four-way dismemberment and soul noodles from the mill. Posters sample each action at its own review time. Regenerate this set with `npm run assets:videos -- --floors=1,2,3,4,5,7,10,12,15,17`.
