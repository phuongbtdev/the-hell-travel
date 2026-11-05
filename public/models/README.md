# Character model slots

The visual concepts in `../assets/concept` guide the art direction. They are not 3D meshes.

The full 15-character catalog is in `src/world/characters.ts`: four spirits, guide, judge, penitent, two travelers, clerk, three executioners, hound and ox. The GLBs have 11-bone rigs and 18 animation clips, including pull, shiver, push, pound, climb, flail, hug, plead, talk, swim, stamp and saw-victim poses. Models are used in the registry, hall and floor performances. Run `npm run assets:characters` to regenerate, or open `/character-review.html` to inspect all characters and download their GLB files.

These are manually authored interpretations of the reference shapes and colors, not automatic image reconstruction. The source images remain the visual target for further refinement. The entire asset pipeline runs locally with Node.js and Three.js; no external modeling app is required.
