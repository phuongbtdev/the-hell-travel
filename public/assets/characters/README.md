# Approved concept to real 3D characters

These images are modeling references derived from `../concept/character-roster.png`. They are PNG images, not meshes or GLB models.

- `spirit-player-reference.png`: front, side and back references for the cyan player soul.
- `tieu-sai-reference.png`: front, side and back references for the red-orange guide demon, with separate scroll and bell props.

## Required production steps

1. Author the character geometry using the reference views, preserving the face, silhouette, proportions, costume and color palette. The current pipeline uses `scripts/build-character-assets.mjs`. Inspect all views; image turnarounds can contain inconsistencies that need correction during modeling.
2. Clean the mesh, UVs and materials for a realtime web scene. Model Tiểu Sai's scroll and bell as separate attachments. Give the spirit a distinct outer glow layer; avoid applying heavy transparency to every surface.
3. Rig the character and skin the mesh. The legless spirit needs body, arms, head and tail controls rather than a standard walking auto-rig alone.
4. Author looping idle, glide, fast-glide, stop/turn, greeting and interaction clips. Tiểu Sai additionally needs walk, talk, scroll and bell gestures. Use stable roots and smooth loop boundaries.
5. Export mesh, materials, rig and animation together as GLB. Asset selection and loaders are driven by `src/world/characters.ts` for all 15 models.
6. Review the rendered model against the references, then validate animation transitions and performance in the live scene.

## Current status

Reference images and 15 locally authored skinned GLBs are available and integrated into the game. Each has 18 animation clips, with performance poses used in every floor. These models interpret the reference using authored geometry; they are not automatic image reconstruction. The original capsule characters remain only as loading/error fallbacks. No external modeling app is required.
