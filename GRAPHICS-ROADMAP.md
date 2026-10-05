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

## Roadmap: the user's original numbered list, with status
This is the list as given to the user in chat. An earlier version of this
file reordered it, which caused confusion; this numbering is authoritative.

1. **Camera and screen polish.** DONE. Title drift, boss-death zoom punch.
   The "depth of field" is only a desktop-only tilt-shift edge blur (no true
   depth of field beyond the existing fog).
2. **Wave and boss moments.** DONE. Boss entrance camera push, ribbon name
   banner, dark screen edges and an arrival shake.
3. **Unit readability.** DONE. Enemy-only rim glow and health bars that show
   for about 2 seconds after a hit (bosses keep their own bar).
4. **Living world.** DONE. Birds, butterflies, cloud shadows on the ground and
   drifting clouds above the valley edges.
5. **Sound tied to visuals.** DONE. Layered generative music (pad, arpeggio,
   bass, drums, lead) that crossfades between calm, combat and boss, with a
   key per level. See P3-V8 in AGENTS.md. Verified numerically only; a human
   ear should judge the taste and the mix constants in `js/audio.js`.
6. **Painted title and world map art.** DONE. Illustrated dawn backdrop with
   six parallax layers (`js/title-art.js`), gold logotype with ribbon and vine
   flourishes, painted map sea and frame with a desktop tilt. See P3-V6.
7. **Per-limb enemy animation.** DONE. Vertex-shader rig inside each enemy's
   merged mesh (see P3-V5 in AGENTS.md): arms, legs, ears and wings animate
   individually and a busy wave draws 21% fewer calls (270 to 212). Bosses
   keep their own rig.
8. **Ability effects.** OPEN. The M6 spells, Call the Burrow Guard and Bramble
   Burst, were never built. They would be the biggest visual set pieces.
9. **Real shadow maps and true bloom.** DONE as baked look (P3-V11), not as real
   shadow maps or a bloom pass: the user wants the same look on phone and
   desktop. Violet trailing cast shadows, softer glow halos, haze gradient, sRGB
   and ACES, toon lighting patch, resolution governor. Real shadow maps and
   post-processing remain excluded.
10. **Full PBR materials and post-processing stacks.** AVOID. They would break
    the illustrated toon and ink-outline identity.

Companion item (added by Claude, not on the user's original list): a **phone
quality tier** that drops detail automatically when frame rate falls below 30,
for example removing outline hulls on distant units and thinning the grass.
The desktop-only shadow and bloom options in item 9 would sit behind the same
setting.

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
