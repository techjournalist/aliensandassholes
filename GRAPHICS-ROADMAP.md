# Graphics roadmap: Briar & Bastion

Read AGENTS.md first for the full project log. This file holds the graphics
plan so a new chat can pick it up. The user approved every item below and
wants them built, in the order suggested.

## Where things stand
Branch: `graphics-pass-units-tiers` (not merged to `main`, see Test status).
Already done (logged as P3-V3 in AGENTS.md):
- Larger units (towers 1.25x, ground enemies and bats 1.4x, display only)
- Scalloped bat wings, distinct tier-2 look per tower, taller each tier
- Three tree species, plinths under build plots, ground patches, worn roads
- Rim hills outside the grid, directional stretched shadows
- Shockwave rings (one InstancedMesh), sparks, muzzle flash, footfall dust
- Painted wood-and-gold UI (CSS only)

## Hard constraints (do not break)
- Frame rate first. Harness budget on Level 1 title view: at most 158 draw
  calls and 189k triangles. Current: 113 calls and about 168k triangles.
- Mid-wave reference scene (13 goblins, 5 towers on Level 1): 262 calls and
  about 194k triangles. Do not exceed roughly 10% above that.
- No real shadow maps and no full-screen post-processing on phones. Any such
  effect must sit behind a desktop-only quality setting.
- GameState stays free of rendering code. Render-side changes only.
- Real-phone frame rate has never been measured (headless software rendering
  only). Test on a device before claiming the 30 fps target.

## Roadmap status
Items 1 to 4 below are BUILT on this branch (see P3-V4 in AGENTS.md). Items 5
to 10 are still open, in the same order.

## Roadmap, in priority order

### Do first (low cost, high impact) [1 to 3 DONE]
1. [DONE] **Wave and boss moments.** Cinematic boss entrance: short camera push,
   name banner, screen shake. Finales are what players remember.
2. [DONE] **Living world.** Birds, butterflies, drifting clouds and moving cloud
   shadows across the ground. Nothing on screen should be static.
3. [DONE] **Painted title and world map art.** Hand-illustrated backdrop, animated
   parallax layers, logo treatment. First impressions get the highest bar.

### Then
4. [DONE] **Camera and screen polish.** Slow camera drift on the title screen, zoom
   punch on boss deaths, gentle depth-of-field look through fog.
5. **Unit readability.** Soft team-colored rim glow on enemies, health bars
   that appear only after a hit.
6. **Sound tied to visuals.** Layered music that shifts between prep and
   combat (audio is synthesized, see js/audio.js).
7. **Ability effects.** M6 spells (Call the Burrow Guard and Bramble Burst)
   were never built. They would be the biggest visual set pieces.
8. **Per-limb enemy animation.** Only if limbs are merged into a small set
   of shared skinned meshes. Each live part currently costs draw calls per
   enemy, which is why walk cycles are body-level only today.

### Quality setting (build alongside the above)
9. **Phone quality tier.** Automatic drop when frame rate falls below 30:
   for example remove outline hulls on distant units and thin the grass.
   Desktop-only optional shadow maps and bloom can sit behind the same setting.

### Avoid
10. Full PBR materials and post-processing stacks. They break the
    illustrated toon and ink-outline identity.

## Test status (as of this file)
- `node tools/playtest.js` needs three.js locally. Set
  `THREE_LOCAL=/path/to/three.min.js` (r128 build, from the npm package
  three@0.128.0) because the CDN is blocked in the cloud environment.
- Untouched `main` fails Level 6's mixed-bot check in this environment (the
  documented unseeded-RNG flake), which locks Levels 7 and 8 and fails about
  19 checks by cascade. Treat that pattern as known, not as a regression.
- The Warden branch-balance duel (Thicket vs Briarstorm) is sensitive to the
  random stream. Render effects used to consume `Math.random`, which the duel
  seeds, so its result depended on how many puffs the renderer spawned. The
  renderer now has its own stream (`fxRand`). With gameplay randomness
  isolated, Thicket ties Briarstorm in the armored scenario and the check
  fails (each branch must win somewhere by 10%). On untouched `main` it
  passes only because of that accidental coupling. It needs a real balance
  look (try several seeds) or a fixture tweak, not a graphics fix.
- AGENTS.md says never commit before the playtest passes. This branch was
  committed anyway on the user's stop-hook request, so it stays off `main`
  until a clean run is confirmed.

## Playable build
A private artifact of the game can be re-published from index.html plus
js/*.js (strip the html, head and body tags and the viewport meta for the
artifact skeleton). three.js loads from cdnjs, which the artifact allows.
