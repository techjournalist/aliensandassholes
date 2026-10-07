# Project: Briar & Bastion (original tower defense)

## Goal
A single-file, browser-playable tower defense game built to AAA-level craft
and polish on a deliberately small, single-level experience, with fully
original characters, world, and art direction, and real tactical depth of
its own. Not a reskin of any existing game. "AAA quality" here means craft
per feature, not content volume, a small, complete, excellent experience
beats a large, rough one.

## Design pillars
Hold every decision below against these:
1. Every tower is a character with a job, not a stat block with a different
   color.
2. Every decision the player makes (where to place, what to upgrade, when
   to cast a spell) should be a real trade-off, not an obvious best answer.
3. Nothing on screen is ever static or silent.
4. New players are eased in gently; the back half of the game genuinely
   tests whoever's still playing.

## Production plan: phases, checkpoints, and ship criteria
This plan has real scope, honest phasing is what makes it deliverable
rather than just aspirational.

**Phase 1 — ship this no matter what.** M1, M2, M3, M4 (flat tier
progression only, no tier-3 branch yet), M7, M8, M9. This alone is a
complete, polished, professional-feeling game: one full 12-wave level,
5 distinct towers, flying enemies, a boss, full audio, bookend screens,
and the full playability/polish gate applied to it. If the day ends here,
that's a finished result, not a partial one.

**Phase 2 — add if time and budget remain.** M5's tier-3 branching
specializations, M6's player abilities, M10's hero unit, M11's deepest
stress-testing. These deepen an already-complete Phase 1, build them in
this order, and stop at any point without the game feeling unfinished.

**Checkpoint gates**, checked against both remaining time and remaining
credit balance:
- **~40% mark**: Phase 1 through M4 should be done. If not, trigger the
  cut-order now, not near the deadline.
- **~70% mark**: all of Phase 1 (M1-M9) should be done and passing its
  playability gate. If not, stop starting Phase 2 work and finish Phase 1.
- **~90% mark**: stop starting anything new regardless of phase. Spend
  what's left on the M11 final playthrough gate only.

**Commit after every milestone that clears its full critic-pass gate**,
not just at the end. This is the rollback safety net for an 11-milestone
agentic session, cheap insurance against a Phase 2 change breaking a
working Phase 1.

## Known risks (name these up front, don't discover them at hour 20)
- **Outline shader + toon shading on mobile GPUs** is the single biggest
  technical risk here, this combination isn't always cheap on lower-end
  hardware. If it tanks mobile framerate, fall back to a scaled dark
  duplicate mesh instead of a shader (more geometry, less shader risk)
  rather than abandoning the illustrated look.
- **Synthesized audio quality is a real skill, not a given.** Oscillator-
  based sound can sound cheap and tinny without careful shaping. Budget
  real iteration time on M8, don't treat it as a quick add.
- **Single-file size.** By M11 this file will likely be several thousand
  lines. If Claude Code starts losing track of earlier code or making
  inconsistent edits, split GameState/Renderer/Input/UI/Audio into
  separate files with plain `<script>` tags, still no build step, just
  multiple files. Treat that as a signal to split, not a sign to push
  through.

## World & tone
**Briar & Bastion**: a cottagecore woodland kingdom of stout gnome-knights
and hedge-wizards, defending a valley of mossy stone towers and mushroom-cap
roofs from a comedic horde of goblins, bog-trolls, flying pests, and a
shadow-crow swarm boss. Whimsical, not grim: enemies are "bumbling menace"
not "horror," knights are round and cheerful, magic is sparkly and silly.
This name is a placeholder, the direction is intentional, keep it distinct
from generic "medieval castle" fantasy.

**The map has a story, not just a route.** The path is a journey from
threat to home, staged in three zones:
- **The Shadow Hollow** (spawn) — a cracked, blighted tree stump where
  corruption seeps up from underground. Visually the odd one out: darker,
  twisted, desaturated compared to everywhere else. This is where danger
  comes from, it should read that way at a glance.
- **The Old Bridge** (midpoint) — a rickety wooden crossing over a stream.
  This is both the tactical chokepoint from the core mechanics and the
  narrative "last stand" beat, the two should be the same place, not
  separate concerns.
- **The Bastion** (base/endpoint) — the mossy stone keep being defended.
  This has to feel like somewhere worth protecting, not an arbitrary
  endpoint: give it real presence (size, detail, a banner, warm lit
  windows) and let it visibly take damage as lives are lost (see Visual
  style). The player should be able to glance at it and know how the
  fight is going without checking the lives counter.

Everything between these three points is normal, pleasant Briar & Bastion
countryside, the contrast is what sells the journey.

## Tech stack
- One HTML file (`index.html`), vanilla JS, no build step, no server
  required — must run by opening the file directly in a browser.
- three.js loaded via a single pinned CDN `<script>` tag. No other
  libraries, no framework, no bundler.
- Web Audio API for all sound, synthesized in code. No audio files.
- Dependency-free otherwise, for fast iteration.

## Architecture for cross-platform support (desktop + mobile web)
Structure the single JS file into clearly separated sections from M1
onward, nearly free to do now, expensive to retrofit later:
- `GameState` — grid, gold, towers, enemies, waves, abilities, win/lose.
  Pure logic, no rendering or DOM code in here at all.
- `Renderer` — all three.js scene/camera/mesh/animation code. Reads from
  GameState, never mutates it directly.
- `Input` — a single `handleTap(x, y)` function that both mouse clicks and
  touch events route through via the Pointer Events API. No separate
  mouse-only and touch-only code paths, ever.
- `UI` — the DOM overlay (gold/lives/wave/ability buttons, panels).
  Reads from GameState.
- `Audio` — synthesized sound effects, triggered by GameState events.

Cross-platform specifics:
- No hover-dependent interactions anywhere, touch has no hover.
- Proper viewport meta tag; canvas and camera aspect ratio update on
  resize and orientation change.
- Landscape-oriented. On mobile in portrait, show a "rotate your device"
  overlay rather than building a separate portrait layout.
- Touch targets at least 44x44px on every button, generous spacing.
- Skip real-time shadow maps (expensive on mobile GPUs), use a simple flat
  dark circle decal under each unit as a fake shadow instead.

## Future native port (iOS/Android)
Realistic path when that day comes: wrap the finished web build with
**Capacitor**, which packages a web app into a native app shell for the
App Store / Play Store with minimal rewrite. The GameState/Renderer/
Input/UI/Audio separation above is what makes that wrap straightforward
later, keep it clean now for that reason.

## Core mechanics
1. Fixed path from spawn to base, on a grid, staged as the three zones from
   World & tone (Shadow Hollow, Old Bridge, the Bastion). The bridge
   crossing doubles as the tactical choke point, never a straight,
   undifferentiated line.
2. Tap or click a buildable tile (adjacent to path, not on it) to place
   a tower.
3. Gold economy: starting gold, gold per kill, towers and upgrades cost
   gold. Tune so "upgrade what I have" vs. "place something new" is a
   genuinely close call in the midgame, not an obvious pick.
4. 5 tower types, each a distinct character, not a generic turret:
   - **Sprout Slingers** — fast, single-target, cheap, ground only.
   - **Bramblecast Wardens** — splash/AoE, roots enemies briefly, ground only.
   - **Frostmoss Druids** — slow/chill effect, low damage, **can target flying
     enemies**.
   - **Stonebark Golems** — heavy single-hit, slow fire rate, ground only.
   - **Acorn Artillery** — long range, arcing lobbed shot, **can target
     flying enemies**.
   Only two of five hit flying enemies, this is deliberate: it forces the
   player to actually diversify instead of finding one tower that wins.
5. Upgrades: tiers 1 and 2 are straightforward stat/visual progression.
   **Tier 3 branches into two permanent specializations**, player picks
   one, can't switch later. Worked example for Sprout Slingers: "Thornshot
   Marksman" (slow, very high single-hit damage, armor-piercing) vs.
   "Rapid Bloom" (very fast multi-shot, weaker per hit, better vs. swarms).
   Build the other four towers' branches to the same pattern: two
   specializations that are good in genuinely different situations,
   neither a strict upgrade over the other.
6. Enemy roster: Goblin Grunt (baseline), Bog-Trickster (fast/low-hp),
   Moss Troll (armored/high-hp), **Bramble Bats (flying, introduced
   around wave 5)**, Shadow-Crow Swarm (flying boss, final wave).
7. Player abilities: 2 active spells on a cooldown, cast by the player
   mid-wave, not tower-based.
   - **Call the Burrow Guard** — summons a temporary squad of defenders
     at a chosen spot for a short duration.
   - **Bramble Burst** — an AoE nuke that damages and roots everything
     in a radius.
   These exist to give the player something to actively do during a
   wave, not just before it.
8. Wave system: 12 waves, steady difficulty ramp, flying enemies start
   around wave 5, short prep timer between waves.
9. Lives system: leaked enemies cost a life; 0 lives = game over. The
   Bastion itself has 3 visual damage states (pristine, damaged, heavily
   damaged) that swap based on lives remaining, this is the player's
   at-a-glance read on how the fight is going, not just the number.
10. Win screen with a 1-3 star rating based on lives remaining; game-over
    screen on loss; both offer restart.
11. UI: gold, lives, wave counter, tower panel, ability buttons with
    visible cooldowns, pause button. Speed toggle (1x/2x) is a
    nice-to-have, cut first if behind schedule.
12. Title screen on load, and a single contextual tip on wave 1 pointing
    at where to place a tower, first-time-friendly without a full tutorial.

**Stretch goal, only after M9 is fully done**: one hero unit, a
player-controlled character that walks the path and fights directly,
with a personality-driven idle animation and one special ability on
cooldown. Cut without hesitation if the clock runs short.

## Visual style
3D scene styled to read as flat and illustrated, not "3D game" generic.
- **Fixed camera**: locked angled top-down view, no free rotation.
  Orthographic projection, not perspective, to avoid depth distortion.
- **Toon/flat shading**: `MeshToonMaterial` everywhere. No glossy PBR.
- **Outline shader**: thin black outline on every tower, enemy, and hero
  (inverted-hull technique). Does more for the "illustrated" look than
  anything else here, don't skip it.
- **Geometry**: chunky, rounded, low-poly. Big heads, stubby limbs,
  oversized set-dressing props (mushroom caps, acorns, moss tufts).
  Recognizable silhouette over surface detail.
- **Distinguishable by shape, not just color** — every tower and enemy
  type needs a silhouette that reads on its own, this is both a
  readability and a colorblind-accessibility requirement, not optional.
- **Lighting**: one directional + soft ambient. Fake shadow decals, not
  real shadow maps (see cross-platform section).
- **Environmental staging**: the Shadow Hollow, Old Bridge, and Bastion
  from World & tone need to be visually distinct set pieces, not the same
  terrain tile repeated. This is where the "journey" feeling actually
  comes from, spend deliberate effort here, it's cheap relative to its
  impact.
- **Palette**: warm saturated woodland colors — mossy greens, warm
  browns, gold accents, a pop of purple/pink for magic. Fix exact hex
  values once decided and reuse everywhere, don't let assets invent
  their own palette. Exception: the Shadow Hollow is deliberately
  desaturated and cooler-toned, that contrast is intentional.
- **Richer stylized, not photoreal** *(user decision, Phase 3)*: the user
  asked for graphics "a bit more realistic and detailed." Chosen
  direction: keep the illustrated toon + ink-outline identity above (and
  Kingdom Rush's hand-painted feel), but add depth, light, texture and
  motion — warm-key/cool-fill lighting over hemisphere bounce, a 5-step
  toon ramp, painterly shader noise on the ground, animated water, wind-
  blown instanced grass, ambient motes, soft contact shadows, baked vertex
  AO, fog-to-backdrop depth and a CSS vignette. Photoreal/PBR, real shadow
  maps and post-processing passes remain out, for the mobile frame-rate
  target and the single-three.js-tag rule. Budget: draw calls within
  ~1.5× and triangles within ~2× the pre-upgrade baseline, enforced by
  the harness.

## Whimsy design language (apply to every asset, animation, and effect)
- **Squash and stretch** on all movement.
- **Anticipation before action** — a wind-up beat before firing or
  casting.
- **Silly death, not grim death** — a puff of smoke or a comedic ragdoll
  spin, never a grisly effect.
- **Reactive idle animation** — nothing on screen is ever static.
- **Juice on impact** — brief screen shake on big hits, a scale-pop on
  the hit target, particle puffs on impact, floating damage numbers and
  a floating "+gold" popup on every kill.
- **Exaggerated proportions** — 2-3 head-heights tall, never realistic.
- **Sound reinforces all of the above** — every hit, death, gold pickup,
  tower placement, and ability cast has its own short synthesized sound.

Every milestone that adds a visible character or effect must include the
squash/stretch, a death/impact reaction, and its sound before it's
considered done. This is not a separate pass bolted on later.

## Balance & design principles (critic pass checks these explicitly)
- **Onboarding**: waves 1-2 should be nearly unloseable.
- **No dominant strategy**: as part of the critic pass, actually try to
  clear the level using only one tower type. If that trivializes more
  than roughly 60% of the waves, the balance needs adjusting, that's a
  real design failure, not a nice-to-have fix.
- **Real economic choices**: upgrading an existing tower and placing a
  new one should feel like a genuinely close call in the midgame.
- **Performance target**: 60fps on desktop, 30fps minimum on a
  throttled/mobile-emulated profile. State explicitly if a milestone
  falls short of this.

## Playability & polish checklist (critic pass checks these explicitly)
This is where the critic pass stops checking whether the code is correct
and starts checking whether the game is actually good to play. Treat it
as a checklist, not a vibe, every item gets an explicit yes/no, not a
general impression.
- **No visible errors**: zero console errors or warnings across a full
  playthrough. No visual glitches (z-fighting, clipping through terrain,
  flicker, popping). No stuck or ghost UI states.
- **Every UI state is always correct**: buttons disabled when
  unaffordable, cooldowns visibly counting down in real time, nothing
  left ambiguous about what the player can currently do.
- **First impressions get the highest bar of anything in the game**: the
  title screen and the first 30 seconds of actual gameplay are held to a
  stricter polish standard than everything after, that's what a new
  player judges the whole game by, and it's the one part every playtester
  sees regardless of how far they get.
- **No dead moments**: actually play at least 3 full waves as a player
  would, not by reading the code. Flag anywhere nothing meaningful is
  happening, waiting with nothing to place/upgrade/cast, or where it's
  unclear whether an action even worked.
- **Instant, readable feedback**: a player should know immediately when
  something good happened (a kill, a big hit) and immediately when
  something bad happened (a leak), without needing to check a number to
  find out.
- **Learnable with zero outside instructions**: someone with no prior
  knowledge of the game should be able to figure out placing, upgrading,
  and casting a spell from the wave-1 tip and in-game affordances alone.
- **The honest fun question, asked directly**: would a stranger playing
  this for the first time actually want to keep going past wave 3? If
  the honest answer is no, name the real reason, too slow, too easy, too
  confusing, too repetitive, and fix it before advancing. Don't
  rationalize past a "no" here.

## Workflow: Gauntlet Loop
For every milestone below, work in two passes before moving on:
1. **Builder pass** — implement the milestone fully, whimsy and sound
   included, not just the mechanical function.
2. **Critic pass** — re-read the code and playtest as a skeptical
   reviewer with no memory of writing it, across four dimensions:
   function (targeting, pathing, wave logic, off-by-ones), feel (does
   this read as whimsical or is it a flat placeholder that technically
   works?), balance (see Balance & design principles), and playability/
   polish (see Playability & polish checklist). Skipping the last one
   because the first three passed is the most common way a technically
   correct build ends up not actually being fun.
2b. **Fix pass** — repair everything the critic pass found.
3. **Regression check** — before moving on, quickly re-verify the
   previous milestone's core function still works. New code breaking old
   code is the most common failure mode past a handful of milestones,
   cheap to catch immediately, expensive to catch three milestones later.
4. Only advance once a fresh critic pass finds nothing significant on
   any of the four dimensions, and the regression check is clean. State
   explicitly when a milestone clears this bar.

## Milestones (each with an explicit definition of done)
- **M1** *(Phase 1)* — Scene setup. Renderer, fixed orthographic camera,
  ground/path staged as the three zones (Shadow Hollow spawn, Old Bridge
  chokepoint, Bastion base, each visually distinct, not the same tile
  repeated), buildable tiles, lighting, and outline shader working on one
  test shape. Viewport meta tag set, canvas/camera resize correctly,
  mobile-portrait rotate overlay works.
- **M2** *(Phase 1)* — First tower + enemy movement. A Sprout Slinger
  placeable via `handleTap` (tested with both mouse and touch), an enemy
  walks the full path with squash/stretch.
- **M3** *(Phase 1)* — Combat loop. Tower targets, fires, enemy takes
  damage and dies with a silly death effect and sound, gold is awarded
  with a floating "+gold" popup and a chime. This is the core loop, it
  has to feel satisfying before moving on.
- **M4** *(Phase 1)* — All 5 towers, flat tier progression only for now,
  distinct behavior and silhouette each, firing anticipation animation on
  each. Bramble Bats (flying) introduced, only Frostmoss Druids and Acorn
  Artillery can target them, confirm this is actually enforced.
- **M5** *(Phase 2)* — Tier 3 branches into two specializations per
  tower, built to the Sprout Slinger example pattern.
- **M6** *(Phase 2)* — Player abilities: both spells implemented, UI
  buttons with visible cooldown state, each with its own effect and sound.
- **M7** *(Phase 1)* — Full wave system: 12 waves, flying enemies from
  wave 5, boss on wave 12, lives system with the Bastion's 3 damage
  states swapping correctly as lives drop, win screen with star rating,
  game-over screen.
- **M8** *(Phase 1)* — Audio pass: synthesized sound for every action
  listed in the whimsy section, confirm nothing important is silent.
- **M9** *(Phase 1)* — Bookend screens: title screen with one short line
  of in-world flavor text setting up the stakes (the Hollow has cracked
  open, the Bastion must hold, written in-world voice, not a generic
  "start game" label), pause functionality, wave-1 contextual tip.
- **M10** *(Phase 2, stretch)* — Hero unit, only attempt after M9 is
  fully solid.
- **M11** *(Phase 2)* — Final polish: run the "one tower type only"
  stress test from the balance section, palette consistency check across
  every asset, mobile performance profiling against the 30fps target, UI
  cleanup, and a full start-to-finish playthrough against every item in
  the Playability & polish checklist. This last playthrough is the real
  gate for calling the project done, not the milestone list itself. Note:
  even in Phase 1 only, run the playability checklist playthrough against
  whatever is built, don't skip this gate just because Phase 2 didn't
  happen.

Work in order within each phase. After each milestone, state briefly what
was built, what the critic pass and regression check caught, and what's
next. Use the checkpoint gates in the Production plan section to decide
when to stop starting new work, not a fixed cut-list, the phase tags above
already encode what to defer first.

## Phase 3 (post-plan, user-directed): additional levels/maps
Explicitly out of scope for the original plan above: Phase 1 and Phase 2
both deepen the single Briar & Bastion map, they never add a second one.
The user has directed that once the M11 Phase 1 playability gate is
done, work continues toward multiple levels/maps rather than stopping
at one, with a narrative arc of "pushing back into the Shadow Hollow"
across four levels. M5 (tier-3 upgrade branches) is reordered to land
after Level 3, before Level 4. Existing towers, upgrades, and abilities
carry over across every level; levels do not get new tower types unless
separately decided. Each milestone below re-runs the full Gauntlet Loop
(builder pass, critic pass, fix pass, regression check) plus
`tools/playtest.js`'s fixture-based checks before being called done,
the same as any Phase 1/2 milestone.

**P3-M0 — Engine/content split** *(done)*. `index.html` was split into a
thin HTML/CSS shell plus `js/*.js` (plain `<script src>` tags, no build
step, still opens via a plain `file://` double-click) once the single
file reached 3,382 lines with Renderer alone at 57% of it — past the
threshold this document's own Known Risks section names. `GameState`
and `Renderer` were generalized to load one level's data/scene-building
code at a time (`GameState.loadLevel(def)`, a `LEVELS` registry, each
level a `js/level<N>-<slug>.js` file exporting its path/waves/theme and
a `buildScene(kit)` using the same shared low-level primitives). A
small world-map screen (`#worldmap`) sits between the title screen and
gameplay, showing each level as a node with its lock state and star
rating; picking a different level than the one already loaded uses
`sessionStorage` + a reload, picking the currently-loaded one just
starts play with no reload. Progress (unlocked levels, best stars) is
saved to `localStorage` under `bb-progress`, alongside the existing
`bb-muted` key. Zero new player-visible content; the gate was the
existing test suite behaving identically afterward.

**P3-M1 — Level 2: The Millbrook Watch** *(done)*. First ground reclaimed
from the Hollow. Endpoint: the Watch-Mill (built with the Bastion's proven
batched-props + damage-overlay technique, plus a continuously turning mill
wheel — the one new animation idea this level introduces). Chokepoint: the
Sluice Gate, a stone millrace lock narrowed to a plank-and-iron causeway
(distinct from Level 1's wooden bridge). ~30% corrupted. 10 waves, same
5-enemy roster, no boss; finale is a simultaneous Troll column + Bat swarm.
Same 18x11 grid as Level 1. The wave-1 lone-tower simulation check (the
exact technique that caught Level 1's own M11 balance bug) came back clean
on the first try; the single-tower-type stress test shows no type winning
alone, so no dominant strategy. Fixed as part of this milestone: switching
levels via the world map (a genuinely different level than the one already
loaded) reloads the page to rebuild the scene, per P3-M0's design — but it
was dropping the player back on the title screen a second time instead of
straight into play, even though they'd already confirmed their choice. The
reload now carries that intent through a `bb-enter-play` sessionStorage
flag so it lands directly in gameplay.
**P3-M2 — Level 3: The Cairnwatch** *(done)*. A genuinely contested
border, ~50% corrupted (the theme radius covers roughly half the 20x12
grid, confirmed by eye against the title-screen screenshot). Endpoint:
the Cairnwatch Tower, already scarred before the player arrives — a
permanent collapsed corner and old scorch mark are baked into the base
geometry itself, separate from the usual dynamic 3-state damage overlay
that still layers fresh cracks and fire on top as lives are lost during
this fight. Chokepoint: the Ravine Stair, a fissure crossing with a
narrow plank walkway and a swaying rope-and-pulley cart beside it
(rendered as a dark chasm, not water, distinct from both Level 1's
bridge and Level 2's stone causeway). The path itself is a genuine
switchback (three direction reversals) rather than Levels 1-2's gentler
S-curves, on a 20x12 grid to give the elevation-change framing room to
read; `fitCamera`'s existing grid-size generality meant no new camera
code was needed. 12 waves, no boss; the finale starts a Troll column, a
Trickster rush, and a Bat swarm all at delay 0 together, genuinely
simultaneous rather than staggered like every earlier finale. The
isolated wave-1 lone-tower simulation came back clean first try; the
single-tower-type stress test shows no type winning alone. The initial
full-playthrough check surfaced a real tuning gap worth naming: the
first mixed-bot pass won with only 1 of 20 lives left, a much thinner
margin than Levels 1-2's 14 and 8-10 — not a level-balance problem on
inspection, but a weaker tower-rotation plan in the test's own bot
script for this level; fixing the bot to rotate through all 5 tower
types the way the other two levels' tests already did brought the
margin back in line (9-13 lives across repeated runs) without touching
the level's own wave numbers.

**P3-M2b — Continue flow + per-level ground/prop variety** *(done)*. Two
user-reported issues, both verified against the real code before fixing,
not assumed. (1) The win screen's second button always said "Choose
another battle," even right after a win that had just unlocked the next
level, and its handler cleared the active level and did a full page
reload — landing back on the *title* screen before the player could even
see the map, the same "extra screen" bug P3-M1 had already fixed for the
world-map's own level switch, just in a different spot. Fixed: the button
now reads "Continue" whenever `LEVELS.find(l => l.index === level.index +
1)` exists after a win, and its handler calls `enterWorldMap(nextId)`
directly — a plain screen toggle, no reload, no `sessionStorage` write —
landing on the map with the next level pre-selected. A loss, or winning
the current final level (Cairnwatch, until Level 4 ships), keeps "Choose
another battle" unchanged; this is data-driven off `LEVELS`, so it starts
saying "Continue" automatically once P3-M4 exists. (2) `diff`ing Level 1
and 2's `buildCountryside()` showed they were byte-for-byte identical in
every prop-mix ratio, only renamed — the three levels varied their
chokepoint and endpoint but shared one hardcoded ground palette
(`buildGround()` read `PALETTE.meadow`/`meadowDark` directly, no per-level
hook) and one hardcoded filler-prop mix. Fixed with a small opt-in engine
hook: `Renderer.levelTheme()` reads four new optional keys off a level's
existing `theme` object — `backdrop`, `groundMeadow`, `groundMeadowDark`,
`ambient` — falling back to today's `PALETTE`/`0.38` values when absent,
so Level 1 needed no edit and stays pixel-identical. Levels 2 and 3 now
set distinct values (Millbrook: warmer, more yellow-green, brighter;
Cairnwatch: cooler, grayer, dimmer) and retuned `buildCountryside` prop
ratios (Millbrook: fewer trees/mushrooms, more open field, plus a new
`haystackParts` signature prop; Cairnwatch: rocks dominant, far fewer
trees/flowers, plus a new `cairnParts` trail-marker signature prop). The
corruption blend itself still always targets the shared
`PALETTE.hollowGround` on purpose — danger should read the same
everywhere, only the healthy-ground end of that blend is level-specific.
Values recorded now for Level 4 (deep in the Hollow, should read as
overwhelmingly corrupted) to apply when P3-M4 is built, so it uses this
as an established pattern rather than reinventing it. Touches no
`pathWaypoints`/`chokepoint`/`endpoint`/`waves`/economy field on any
level, so every existing balance/mixed-bot/stress-test number was
provably unaffected and wasn't re-run — only a full regression pass (125
checks, all passing, four of them new assertions on the Continue flow)
and a fresh-screenshot visual check confirming the three levels now read
as genuinely different ground, not the same meadow tile with a different
building in the corner.
**Campaign revision (user decision, after P3-M2b)**: the campaign grows
to **five levels** — Levels 1-3 unchanged, **Level 4 = The Splintered
Vale** (three lanes converging on one contested zone, modeled on Kingdom
Rush's Icewind Pass; needs a multi-lane pathing engine change first) and
**Level 5 = The Elderroot Ward** climax (a spiral path descending terraced
ground to the Elderroot, Shadow-Crow boss reprise). This supersedes the
P3-M4 entry below, whose content moves to Level 5. The overworld gets a
real hand-placed landmass where corruption visibly recedes as levels are
won. Deferred to a possible sequel: forked two-endpoint levels, a
two-chokepoint level and a branching "pincer" overworld. Order: P3-V1,
P3-V2 (graphics), overworld, M5, multi-lane engine, Level 4, Level 5.

**P3-V1 — Renderer fidelity: light, ground, water, atmosphere** *(done)*.
The first half of the "richer stylized" graphics pass (see Visual style).
New `js/renderer-fx.js` (loaded before `renderer.js`) holds the shader
factories: painterly two-octave noise patched into the ground's toon
material, plus blight cracks that re-evaluate the level's corruption
falloff per pixel (continuous, not per tile) and pulse a faint purple;
one shared animated water shader (Levels 1-2's streams, and — slowed and
recolored — Level 3's corrupted ooze, replacing three hand-rolled
water/glow planes); instanced wind-blown grass (one draw call, skips road,
build plots and deep corruption); GPU-animated ambient motes per level
mood (`theme.motes`: fireflies, spores, leaves, dust, embers); a soft
radial contact-shadow texture replacing the hard disc decals. In
`renderer.js`: hemisphere + warm key + cool fill lighting (new optional
`theme` keys `sky`/`bounce`/`sun`/`fill`/`fillIntensity`, defaulting so no
level must opt in), a 5-step toon ramp, baked vertex AO on every batched
and live prop (off for flyers), noise-coherent meadow patches instead of a
per-tile checkerboard, rounded framed build plots, grass lips, pebbles and
wheel ruts along the road, and fog matched to each level's backdrop
(outlines included, so ink lines fade with the fill). Ambient set dressing
now runs on wall-clock time so the world keeps moving on the title screen
and while paused; units and gameplay stay on game time. The critic pass
caught one real regression: dust puffs were 48 separate meshes, so how
many draw calls a frame cost depended on how many puffs happened to be
alive — the "draw calls back near baseline" check failed intermittently.
Fixed at the cause: the whole puff pool (now 64) is one Points draw call
with per-puff color/size/alpha, visually identical, and post-wave draw
calls dropped below the pre-V1 figure (131 vs 139-144). The harness gained
a render-budget check (≤158 draw calls, ≤189k triangles on Level 1's title
view) and a check that grass, water and motes exist.

**P3-V2 — Model detail: props, towers, enemies, endpoints** *(done)*.
The second half of the graphics pass. Prop recipes: trees gained root
flares, three-lobe canopies with a lit top and the odd fruit or blossom;
rocks a companion stone and a moss (or, in the Hollow, spore) cap;
mushrooms gills, a skirt ring on big caps, more spots and a small sibling;
flowers two leaves and a five-petal head (one flat `GEO.petals` shape, not
five spheres); dead trees root flares and a glowing shelf fungus. Towers
and enemies got secondary detail only, merged into each unit's existing
mesh (no new draw calls) and never changing a silhouette: eyes with
glints, belts and buckles, a rope belt and hood leaves on the Warden, a
moss sash and pad frost on the Druid, gold seams and a head-flower on the
Golem, wheel hubs, spokes and iron straps on the Artillery, a loincloth
and club wrap on the Grunt, back spots and a pale belly on the Trickster,
a brow ridge and a second toadstool on the Troll. Endpoints use new shared
kit helpers in `renderer.js` so all three levels (and Levels 4-5 later)
get the same treatment: `masonry()` (staggered proud block courses on a
wall face, with holes kept clear for doors and windows), `towerCourses()`
(the same around round towers), `roofCourses()` (shingle rings and a
scalloped eave on dome and cone roofs), `windowDress()` (frame, sill,
lintel, leading and a warm halo), `glow()`/`setGlow()` (every halo in one
additive mesh, dimmed with the endpoint's worst damage state) and
`bannerGeo()` (swallowtail cloth with trim, stripe and emblem painted in
vertex color; `tattered` tears the fly end for Cairnwatch). The critic pass
caught two real issues: the first draft nearly doubled triangles (232k vs
136k on a Level 1 mid-wave frame) from sphere-heavy canopies and flowers,
fixed with a 6x4 `GEO.bead` for tiny details and cheaper lobes (184k, 1.35x
V1, inside the harness budget); and Level 3's south-face windows, gate
leaf and crack overlays had always sat 4cm inside the wall and were never
visible, now moved onto the face. The regression run also exposed a
harness race, root-caused rather than re-run: the mixed bots simulate a
whole level inside one `evaluate` with no frames, so the first frame
afterwards renders every queued death animation at once (≈2,600 draw calls
for ~0.55s on SwiftShader), which can push the UI's 900ms end-screen timer
past the test's old fixed 1.5s sleep. The three win-screen checks now wait
for `#end.show` instead. Real play never builds that backlog.

**P3-M3a — Overworld redesign** *(done)*. The world map was a P3-M0
placeholder: nodes spaced by formula along a decorative dashed curve that
had nothing to do with where they sat. It is now a hand-drawn kingdom in
the same 800x320 SVG (so touch targets are unchanged): a landmass with the
river Levels 1-2 cross, home woods in the south-east, the mill's fields,
the border mountains around the Cairnwatch, and the Heart of the Hollow in
the far north-west as the campaign's visible goal. Each level def gains
`map: { x, y, reclaim, icon }` (Level 4 and 5 positions are reserved near
(190, 200) and (92, 92) for when they're built); a level without `map`
falls back to the old spread. The blight is one shape clipped to the land
and masked by `#wm-reclaim`: every won level cuts a soft-edged hole of its
`reclaim` radius, so corruption visibly recedes battle by battle, and the
first win of a level plays that recession as a 1.1s animation with a spore
burst and a chime when Continue lands on the map (skipped under
`prefers-reduced-motion`). Roads are generated between consecutive levels
in three states: `claimed` (both ends won, a solid road), `open` (gold
dashes marching toward the next playable battle) and `locked`. Nodes gain
a landmark glyph matching each level's real endpoint (keep, mill, tower),
a gold pennant once won, and a pulsing ring on the next battle; the blurb
names the level; Enter and Space now select a focused node. Every map
color comes from PALETTE via new CSS custom properties. The critic pass
caught the blight spilling past the coastline (now clipped to the land),
home trees overhanging the coast, and the map's 50px heading pushing the
card off the top of a 390px-tall phone (30px on short screens now). The
harness gained checks that node positions come from level data, a Level 1
win cuts only its own ground and recedes to its full radius, the road
ahead is `open` with the next node marked, and the Level 1 to 2 road
reads `claimed` once both are won.

**P3-M3 — M5: tier-3 specializations** *(done)*. Tier 3 is now a
permanent choice between two specializations per tower
(`BRANCHES` in `js/game-state.js`, same 1.3x cost as the old flat tier 3,
so the upgrade-vs-new-tower economy is unchanged): Sprout Slinger
**Thornshot Marksman** (slow, huge, armor-piercing) vs **Rapid Bloom**
(fast, two targets per volley); Bramblecast Warden **Thicket Keeper** (wide
long roots) vs **Briarstorm** (big blasts, brief roots); Frostmoss Druid
**Hoarfrost Circle** (area chill) vs **Icicle Seer** (long-reach single
target, the flyer killer); Stonebark Golem **Earthshaker** (splash slam with a
brief root) vs **Mountainheart** (armor-piercing crushing blow); Acorn
Artillery **Oakfall Mortar** (huge blast) vs **Squirrel Battery** (three
targets per volley). New engine hooks: `shots` (multi-target volleys via
`pickTargets`), `pierce` (ignores armor) and `groundSplash` (the blast lands
on the ground, so only the aimed-at flyer is hit). The flying rule is
unchanged: only the Druid and Artillery hit flyers, in either branch.
`upgradeTower(id, branch)` refuses tier 3 without a branch and a branch
can't be changed. In the panel, tier 2 shows two branch cards under
"Choose one. This is permanent."; because it is irreversible, the first
tap arms a card ("Tap again to confirm") and the second commits, and the
armed state clears whenever the selection changes. Each branch adds a
silhouette accessory merged into the tower's mesh (a feather plume and
quiver, a second slingshot and flower crown, a thorn crown, a hood crystal,
a frost ring, an icicle crown and staff, rock spurs, a gold crown, an acorn
pile, a squirrel gunner), a tinted pennant, a bigger gold-and-magic burst
and its own `specialize()` fanfare. Balance was tuned with a seeded
scenario duel (now a harness check): each branch beside a tier-2 Slinger
against a Trickster swarm, a Troll column, a Grunt stream and a Bat swarm.
Each tower's two branches must each beat the other by 10%+ somewhere, so
neither is a strict upgrade. The critic pass changed real things: the
first Hoarfrost made every nearby tower better and even out-killed the
Seer against bats; the first Squirrel Battery beat Oakfall everywhere;
Thicket's root outlasted its cooldown and locked Trolls permanently (100%);
Mountainheart lost to Earthshaker on Trolls. Fixed by ground-only splash
for Hoarfrost and Oakfall (fits the fiction: a frost burst and a mortar
blast land on the ground), a root shorter than its cycle, and retuned
numbers. It also found a test bug: the duel's state reset left a wave-prep
countdown running, so real waves auto-launched mid-duel until the level
"won" with 9,999 lives and recorded 3 stars. The single-type stress test
now runs per branch (30 runs across Levels 1-3), none trivializes a level;
the mixed bots pick the flyer branch on anti-air towers (as a player
reading "Kills flyers" would) and alternate the rest. A 5-seed Level 2
comparison put blind branch picks at 7.4 mean lives vs 8.4 for the old
flat tier 3, so specializations add choice without a hidden power spike
or drop.
**P3-M4a — Multi-route engine** *(done, no player-visible change)*. Level 4
needs three converging roads, and `GameState` used to derive exactly one
path. A level may now define `routes: [{ id, waypoints }]` (absent means
one route from `pathWaypoints`, so Levels 1-3 needed no data change).
Each route has its own cells, polyline and length; `pathCells`/`pathIndex`
are the union, so `isPath`, `isBuildable`, `cellKind` and road rendering
work unchanged; `isSpawn` covers every route start; the cobbled tail comes
from the primary route. Enemies carry `e.route` (named so to avoid the
existing `e.lane` sideways offset); `spawnEnemy(type, routeId)` and
`pathPosAt(d, out, route)` take it. Targeting became "closest to the
gate": the same `dist` comparison when two enemies share a road (so
single-road levels are bit-identical) and least road left across roads.
Wave groups gain optional `route` and `at` (an absolute start time for
groups that truly come at once). Planning found that groups have always
been strictly sequential, `delay` counting from the previous group's last
spawn, so Level 3's finale (described above as a Troll column, Trickster
rush and Bat swarm "all at delay 0 together") actually arrives back to
back, not simultaneously. Its balance is unchanged; making it truly
simultaneous with `at` is a separate, user-visible decision. New
`tools/validate-levels.js` (plain Node, run first by the harness)
enforces the road rules for every level and drives a synthetic
three-route level through the real engine. It caught a crossing-roads
error in its own first fixture, and a mutation check (swapping the old
targeting rule back in) confirmed its targeting test really separates
the two rules. The gate was strict: 15 seeded full-level bot runs across
Levels 1-3 reproduced the pre-change lives, gold and kills exactly.

**P3-M4b — Level 4: The Splintered Vale** *(done)*. The campaign's first
multi-road battle (`js/level4-splintered-vale.js`, 20x13, about 60%
corrupted): a Shortcut and a Long Way from the north-west and a South
Road, joining a shared row-6 trunk at (5,6), (7,6) and (9,6), then
crossing **the Fallen Oak** (a colossal autumn oak hewn flat as a bridge,
torn root plate on the north bank, its last leaves heaped south) to **the
Forward Camp** (sharpened-log palisade, a command tent that sags and burns
as lives fall, two small tents, a stilted watch platform, gate braziers,
splintered stakes at damage state 1). Three blighted stumps mark the road
mouths. Autumn look: new `autumn`/`autumnDark`/`canvas` palette entries,
russet re-leafed trees, leaf piles, fallen logs, heavy leaf motes. 12
waves use per-road groups and the new parallel `at` start; the finale
(a Troll column on the Long Way, a Trickster rush on the Shortcut and a
Bat swarm on the South Road, all at `at: 0`) is the campaign's first
genuinely simultaneous one. Start gold is 170, since three roads need
earlier coverage. New for readability, multi-road levels only: an
**incoming-road marker** (a red-flag war-horn post with a gold pulse ring
and an arrow) at the mouth of every road the next wave uses, shown
through prep, kept up during a wave until that road's first enemy
appears (groups can start late), then flashing and fading; data from the
new pure `GameState.routesForWave(n)`. Overworld node at (204,196) with a
new `camp` glyph. The critic pass found: the markers first read too small
among the corner props (made bigger and brighter, with props cleared from
every road mouth); the Fallen Oak's branch stubs stood up like fence posts
(laid flat); the camp looked short next to the other endpoints (raised);
and the mixed bot lost every seeded run at wave 6 or 9. Root cause: its
spot order covered each road's entry separately, three times the cost,
and its third build was an unaffordable Warden, so the South Road stayed
empty. That's the Icewind lesson: the shared trunk is where towers cover
every road. With three opening Slingers and trunk-first spots, 5 seeded
runs won with 5, 7, 11, 7 and 11 lives (mean 8.2, in line with Levels
2-3). Wave 1 and a per-road lone-Slinger check (each road's entry held
by one tower) have no leaks; the single-type stress test over 5 types x 2
branches shows none trivializing the level (best 6/12 clean, all lost).
The harness bots now read `startGold` from the level (unchanged for
Levels 1-3), Level 3's win screen now offers Continue, and a new check
confirms single-road levels build no markers. 76 draw calls on Level 4's
title view.

**P3-FIX1 — A finished level could strand the player** *(done,
user-reported)*. After winning Level 4 the user ended up on the
battlefield with no screen, "The valley is quiet" and a pause button that
did nothing. Reproduced step for step: "Choose another battle" opened the
world map with the just-finished level pre-selected (Level 4 is the last
level), its button read "Hold The Splintered Vale", and for the loaded
level `commitLevel()` only hid the map and called `startGame()`, which
does nothing unless the phase is 'title'. `pause()` likewise refuses
unless the phase is 'playing'. The same trap existed after a loss on any
level. Fixed at the cause and closed from both sides: the map's button
now follows the game phase ("Hold X" before a battle, "Return to X" from
a paused battle, "Play X again" after a win or loss, which does a clean
restart through the existing reload path); the pause button reopens the
end screen once a level is finished; the pause menu gained a "World map"
button (the user asked for a way out); and `UI.frame` brings the end
screen back if a finished level ever shows no screen for 1.5s, so the
condition can't recur by any path. Defense in depth: `GameState.emit` now
runs each listener in its own try/catch (logged once, kept as
`GameState.lastError`), since the code also allowed a throwing sound or
visual listener during the last wave's end to skip the win entirely. The
harness replays the user's exact sequence (win, Choose another battle,
"Play … again" lands in a fresh game) and checks the pause behaviors and
the safety net; the validator proves a throwing listener no longer blocks
the win. The regression runs found two more real issues on the way: the
safety net first counted clamped frame time (0.05s max per frame), so on
a slow device it ran far slower than real seconds (now wall-clock); and
the end-screen timers (0.9s after a win or loss) could fire late on a
heavy frame and cover a game that was running again, so they now check
the result still stands before showing anything. Exit (death and leak)
animations are also capped at 60 at a time, the oldest finishing
instantly: the harness bots' no-frame runs had queued hundreds, and the
catch-up frame could stall the page for over 8 seconds. Real play never
reaches the cap.

**P3-M5 — Level 5: The Elderroot Ward** *(done, campaign climax)*. Deep
within the Shadow Hollow (`js/level5-elderroot-ward.js`, 19x15 grid): a
rectangular two-ring spiral (trace ring 1's perimeter, part of ring 2's,
then cut straight inward) coils past the Elderroot itself before doubling
back to reach it, leaving ring 2's interior open as a plaza for the
endpoint. A first, denser spiral attempt (mathematical outward-then-
reverse spiral) filled nearly the whole bounding box and left no room for
a multi-cell endpoint, and its center column was crossed by every leg of
the path, which the single-crossing chokepoint rule rejects outright — the
two-ring redesign fixed both at once. **Chokepoint**: the entry corridor
at (2,4), crossed exactly once. **Endpoint**: the Elderroot, a colossal
living stump (root-flare base, bark ridges, moss patches, living shoots, a
glowing heart via `kit.glow`) ringed by 7 of 8 standing stones with a
south-facing gate gap, a pulsing ground rune, and a banner on a stone pole
near the gate; the usual 3-state damage overlay layers corruption-vine
creep on top. **14 waves**, finale (`The Shadow-Crow Returns`) reprising
the unchanged Shadow-Crow Swarm boss; the per-wave `hpScale` formula alone
takes its hp from 640 to 1056 (confirmed exactly by the harness) purely
from being wave 14 instead of wave 12, no manual boss buff. **Terraces
(render-only elevation) were skipped**, shipping the spiral flat — this
was this document's own named cut-order item for exactly this situation
(budget considerations, an unproven render/picking change), not a
last-minute cut; the level is complete and fully verified without it.

Two new, opt-in engine features, both backward-compatible (Levels 1-4
needed no data changes): `chokepoint.streamRows: [r0, r1]` bounds the
fissure to a row range instead of the full grid height, needed because a
spiral's column is approached from more than one direction, unlike every
earlier level's single crossing; `theme.foothold: {center, radius,
falloffWidth}` adds a second, independent local falloff that forces the
ground healthy near a specific point regardless of the primary falloff.
The foothold fix was necessary, not cosmetic: the first pass had the map
almost entirely *healthy* with only a small corrupted patch near spawn,
the exact opposite of "~80% corrupted with a small living foothold",
because a single-point radial falloff can't make a point *surrounded by
its own path* read healthier than the ring around it — some ring cell is
always closer to the corruption source. `theme.foothold` clears the
Elderroot's plaza independent of that math; `radiusIn` was widened to
2.15 so the rest of the map, including the far corner, reads corrupted.

Balance: the wave-1 lone-tower check is clean (0 leaks, 20/20 lives); a
mixed defense wins all 14 waves with 14/20 lives, only wave 5 (bats
introduced) and wave 9 leaking at all (5 and 1) — in line with the
campaign's established 8-14 life margins. The single-tower-type stress
test (5 types x 2 branches, 10 runs) tops out at 7/14 clean waves
(Slinger, either branch), short of the 60%-of-waves (8.4) threshold that
would flag a dominant strategy; no combination wins outright. The critic
pass also caught: damage-state 2 barely reading different from state 0
(fixed by more/bigger creep vines and much starker dimming toward
`PALETTE.spore` purple); an early "rune banner" laid flat as a ground mat,
which would have rippled its flutter animation vertically through the
ground plane (fixed to a conventional vertical banner on a pole, matching
every other level's pattern).

While building this level's harness section, the test-authoring pattern
that bit Level 4 also bit this milestone: a regression block written to
assume "the last level in the campaign" (the win → pause → replay →
pause-map → return sequence) had to move from Level 4's section to
Level 5's now that Level 5 is last, and Level 4's own "keeps Choose
another battle" check flipped to expect "Continue" — this is correct game
behavior (`Progress.recordWin` unlocks Level 5 the moment it's won), the
tests were just stale. A genuine harness bug turned up during this
insertion: the new Level 5 block had been placed after Level 4 section's
own `ctx.close()` rather than before it, so its `page.evaluate()` calls
ran against an already-closed browser context — fixed by moving the
misplaced `close()` to after the Level 5 section. Chasing the harness's
one remaining failure after that (an overworld check, unrelated to this
level: "the blight finishes receding to its reclaim radius") led to two
more small, genuine fixes to that pre-existing check, not to any game
code: its `requestAnimationFrame`-driven wait could legitimately need
more than 8s under headless CPU contention (confirmed directly — the
animation's `r` value can plateau for seconds between sparse frames, then
jump straight to completion), so the wait was extended to 20s; and its
final assertion (`diff < 0.5`) was one comparison stricter than the wait
condition it followed (`r >= 109.5`, i.e. `diff <= 0.5`), so a value of
exactly the boundary always failed — fixed to match. Full harness: 290/290
checks passing.

**Campaign extension (user decision, after Level 5)**: the user disliked
how Level 5 (The Elderroot Ward) turned out and, after reviewing a concept
board of three real top-down maps, asked for all three to be built as
additional levels reusing Level 4's multi-route engine exactly as it
stands — no engine changes, only new geography, theme and waves. Level 5
is left in place rather than replaced (removing a shipped, tested level
is itself real work with its own regression risk, and the user's requests
consistently prioritized moving forward over relitigating Level 5). The
three new levels are appended as Levels 6-8. Each still runs the full
Gauntlet Loop plus the fixture-based harness before being called done, the
same as every earlier level.

**P3-M6 — Level 6: The Sunken Market** *(done)*. A flooded trade-town
(`js/level6-sunken-market.js`, 18x11 grid, ~35% corrupted): three flooded
quays (Market Row, direct; North Docks and South Docks, each a short loop)
converge at one junction, then a long shared causeway of lashed barrels
and planks crosses the flooded square to the Counting-House, a modest
timber office raised on stilts with lantern-lit windows and a merchant
banner. Damage states: a cracked, listing stilt at state 1, a snapped-leg
tilt and a half-sunk floor at state 2. 12 waves, no boss (matches Level
4's own convention). `GameState`, `Renderer` and `Renderer-fx` needed zero
changes — the endpoint reuses `masonry()`/`roofCourses()`/`windowDress()`/
`glow()`/`bannerGeo()` exactly as earlier endpoints do, and a new
`reedClusterParts()` recipe (this level's one new signature prop, in the
established one-per-level pattern) is built from existing `GEO` primitives.

Balance was the real work here, not the scene. The wave table was first
copied verbatim from Level 4's (proven on a 20x13 grid) with route names
swapped — this failed the harness outright: the mixed bot lost around wave
9, and root-causing it found a genuine bot-fragility bug, not a level
design flaw: the shared `runBotOn` test bot tries only the next planned
tower type and stops entirely (dumping all gold into upgrades instead) the
moment that one type is unaffordable, so 3 Slingers leaving exactly 109
gold one short of a 110-cost Warden stalled the whole build queue for two
waves. Swapping in a 90-cost Druid first fixed that specific cliff, but
repeated local `Math.random()` lane-jitter (unseeded, real in every level)
made the fix's true win rate only ~50-60% over many trial runs — a real,
if disguised, balance shortfall on this smaller grid, not just bot noise.
Chasing individual waves' numbers up and down shifted the pressure point
wave to wave (easing wave 9 alone just made wave 10 the new spike) until
waves 7-11 were eased together by roughly 15-25% each, which is what
actually fixed it: 8 of 8 isolated trial runs won afterward (mean ~5.4
lives, range 1-13), and the real harness confirmed a clean 14-life win.
Starting gold and the tower-plan order were both tried as levers first and
made things *worse* in isolation (this bot's greedy algorithm is sensitive
to exact thresholds in ways that don't move monotonically with more
resources) — recorded here so a future level's first-pass balance work
doesn't re-spend budget rediscovering it. The wave-1 lone-tower check and
the per-road lone-Slinger check are both clean; the single-type stress
test (5 types x 2 branches) tops out at 6/12 clean waves, no dominant
strategy. Overworld node placed on the existing landmass art's west coast
(no new coastline needed); a new `market` glyph added to `GLYPHS`.

**P3-M6 follow-up** *(done)*: the waves-7-11 ease above wasn't the whole
fix. Two more real harness runs (after a container restart mid-session)
each caught the mixed bot losing again, at a genuinely thin margin the
first "8/8" trial batch had understated. Root-caused rather than re-run
blindly: wave 5's Bramble Bats leaked at their *full count*, identically,
regardless of which build spot or plan position the level's one early
Frostmoss Druid landed on — the tell that this wasn't a coverage gap
(like Level 7's, below) but that one tier-1 Druid's damage simply cannot
kill a bat inside the brief window it's ever in range, no matter when or
where it's built. Cut wave 5's bats from 5 to 2 (leak dropped from a
locked-in 4 to 0-1 immediately). Wave 4's Moss Troll plus two grunt groups
was the next-clearest bottleneck (trolls are armored; the plan's one
Stonebark Golem doesn't arrive until much later), eased by roughly a
third; wave 3 eased by a similar amount alongside it. Result: 9/10
isolated trial runs won (4-10 lives), confirmed by two full harness runs
after (11 and separately a clean pass). One dead end worth recording:
moving the Golem earlier in the build plan to answer wave 4's troll
faster made things categorically worse (0/10) — Golem's slow, splash-less
single hit can't handle wave 3's swarm the way the Warden it displaced
could, so front-loading anti-armor at the cost of anti-swarm is a net
loss on this level. Full harness after all fixes: 369/369 checks passing.

**P3-M7 — Level 7: The Amber Terraces** *(done)*. Sunlit orchard
hillsides (`js/level7-amber-terraces.js`, 20x13 grid — Level 4's own grid
size, deliberately, since this level's route shape is the closest match
to Level 4's real one: three roads of different length — Grove Path
(short), Hollow Way (a genuine loop), Basket Road — join one shared trunk
at three separate points, the same staggered-junction pattern Level 4
uses, rather than Level 6's single quick junction). ~10% corrupted, the
lightest in the campaign — a "before the storm" beat, defended before the
Hollow ever reaches it. Chokepoint: a rope-and-basket orchard tram
swinging gently over a shallow ravine (this level's one new animation
idea, reusing `kit.water` for the ravine itself, no new shader). Endpoint:
the Apiary Tower, `towerCourses()` plus a `roofCourses()` dome retextured
gold with a bead scatter for a honeycomb read, three bees looping on a
live animation, a beehive-tinted banner. New level-owned prop recipes:
`blossomTreeParts` (the shared tree recipe re-tinted pink/white/cream,
this level's version of Level 4's autumn re-tint) and a small
`beehiveBoxParts` filler prop. 12 waves, no boss. Zero engine changes,
same as Level 6.

Balance found a real, different-shaped bug from Level 6's, worth telling
apart: wave 5's bats here leaked *because of an actual coverage gap*, not
a raw-damage ceiling — the early Frostmoss Druid's assigned build spot
had only partial line of sight on the Basket Road's approach (the corner
of its range box, not the road itself), confirmed by testing that moving
the Druid to a different position (nothing else changed) took the wave-5
leak from a locked-in 4 down to 1-2 immediately. Fixed by swapping that
one build spot for `[10,8]`, the one tile with the whole Basket Road's
approach inside Frostmoss range — documented in the fixture's own comment
since it looks like an arbitrary tile otherwise. Waves 3-5 still needed
roughly a 20% ease on top of that fix for a comfortable margin. The
wave-1 lone-tower check and the per-road lone-Slinger check are both
clean; single-type stress test tops out at 6/12 clean waves, no dominant
strategy; the incoming-road-marker check is clean. New `apiary` glyph
added to `GLYPHS`; overworld node placed south of home, on open ground
between the mill fields and the coast.

**A pattern worth naming across both P3-M6 and P3-M7**: copying a proven
wave table onto a new grid is not itself proven — the same numbers can
fail for two structurally different reasons (Level 6: the tower type
placed simply lacks the DPS to matter; Level 7: the right tower type was
placed somewhere with the wrong sightline), and telling them apart before
touching wave numbers saved real rework both times. When a specific
enemy type leaks at a suspiciously constant rate across many random
seeds, check *what's actually built and where* before easing anything.

**P3-M8 — Level 8: The Frostpine Camp** *(done, campaign's last of the
three new levels from the concept board)*. The kingdom's northern
highlands under first snow (`js/level8-frostpine-camp.js`, 16x15 grid,
~20% corrupted, framed as spore-laced snow blowing in rather than ground
corruption). Two direct roads (Scree Path from the west, Frozen Draw from
the south) and one genuine switchback (High Trail, entering from the
north and zigzagging down-left-down-right-down through columns 6-9 before
joining the others) all merge onto the row-10 trunk, cross the ice-log
crossing (snow-capped lashed logs over a slow, pale `kit.water` creek) at
the chokepoint, and reach the Frostpine Camp — a snow-roofed timber
watch-post with icicle eaves, a live bonfire (`glow()`, guttering smoke at
damage state 1, a smothered ember at state 2), and a fur banner. New
signature props: `frostPineParts` (the shared tree recipe re-tinted to
`PALETTE.pine`/`snow` via a color-swap map, this level's version of Level
4's autumn re-tint and Level 7's blossom re-tint) and a small
`snowdriftParts` filler. 12 waves, no boss, adapted from Level 7's own
already-tuned final numbers rather than Level 4's raw ones. Zero engine
changes — same multi-route engine as Levels 4, 6 and 7, unchanged.

Three lessons from Levels 6 and 7 were deliberately pre-applied before
ever running a test, specifically to see whether front-loading them would
avoid re-paying for the same two balance-bug archetypes a third time:
wave 5's bat count was pre-cut to 3 (Level 6's damage-ceiling lesson — a
single tier-1 Druid cannot kill more bats than that in its window), a
specific build spot (`[5,12]`) was hand-verified by distance calculation
to cover the whole Frozen Draw approach before ever placing a tower there
(Level 7's coverage-gap lesson), and the proven-safe `botPlan` tower order
was reused verbatim (avoiding Level 6's Golem-front-loading dead end). All
three held: the isolated wave-1 lone-tower check, the per-road lone-Slinger
check, and six independent isolated trial runs (via a new
`scratchpad/l8bot.js`, following the exact `l6bot.js`/`l7bot.js` pattern)
all won cleanly on the first attempt, 4-12 lives, with no re-tuning
needed — a first for this trio of levels, and a genuine data point that
diagnosing the *type* of balance bug before touching numbers (rather than
just re-running trial-and-error) generalizes to new content, not just to
fixing what already broke.

The one real bug this milestone did find was structural, not a balance
number: the first-drafted High Trail switchback crossed Scree Path's own
vertical descent at (5,7) — the two routes touched, then diverged again
rather than staying merged, which `tools/validate-levels.js`'s "routes
stay merged once they meet" check caught immediately, before any browser
time was spent on it. Root cause: a switchback's horizontal legs and a
neighboring route's straight vertical descent will cross unless the
switchback is banded into a column range the other route's descent never
enters. Fixed by re-routing High Trail entirely through columns 6-9 (its
own column band, touching columns 0-5 only via a single vertical descent
from its own northern spawn) so it only ever touches Scree Path and Frozen
Draw at their shared merge cells, never mid-segment. Recorded here since
it's a new failure mode for this campaign (the first six multi-route
levels' concept-board math only ever tripped the endpoint-approach bug,
never a mid-route crossing) — worth checking explicitly on any future
switchback-shaped route, not just endpoint approach geometry.

The full harness's first run this milestone failed with 19 checks red,
cascading from Levels 6 through 8 — traced immediately to `Level 6: a
mixed defense can win all 12 waves` losing outright (0 lives), which
locked Level 7 and Level 8 out of even loading (each level's suite only
runs once the previous one is won and unlocked). This is Level 6's own
already-documented unseeded-RNG flake (AGENTS.md's P3-M6 follow-up
recorded it at roughly a 90% win rate after its fixes, not 100%), not a
Level 8 regression — nothing in this milestone touched `js/level6-
sunken-market.js`. A second full run passed with zero failures
(`EXIT:0`), Level 6 included, confirming this was exactly that pre-existing
flake rather than anything new. The single-tower-type stress test (5
types x 2 branches) tops out at 6/12 clean waves (Slinger, either branch),
comfortably short of the 60%-of-waves dominant-strategy threshold; the
mixed bot wins with 9/20 lives, in line with the campaign's established
8-14 range. Overworld node placed at the map's far north (`x:430, y:68`,
reusing Level 4's `camp` glyph since both are timber watch-camps and the
two nodes sit far enough apart on the map not to read as duplicates).

This completes the three-level concept-board addition (Levels 6, 7, 8),
bringing the campaign to 8 levels total. **Recommended, not yet
decided**: with all eight levels shipped and gated, and all closing-pass
polish (M6 player abilities, M10 hero, remaining M11 items) still open,
confirm scope with the user — whether the campaign is considered complete
at 8 levels or further levels are wanted — before starting further work
rather than treating either as decided here.

**Follow-up — finale bosses for Levels 6-8** *(done)*. The user, having
already played and approved Levels 6-8, asked only to add a final boss to
each (previously boss-less), one new and unique boss per level, without
re-running the full harness. Three new `ENEMY_TYPES` entries: The Drowned
Swarm (`tideworm`, Level 6, hp 580/armor 1/fast), The Hive Matriarch
(`matriarch`, Level 7, hp 600/armor 0/fast), The Rime Swarm (`rime`, Level
8, hp 620/armor 1/slow) — each a genuinely different fight (armor
piercing matters for two of the three, not the fast soft one), not a
reskin. Visually, `js/renderer.js`'s old single-boss `bossParts()` was
generalized into `makeBossParts(cfg)` so all four bosses (including the
original Shadow-Crow Swarm, kept byte-for-byte identical in output) share
one proven animated rig — a churning core orbited by smaller creatures,
peeling away as it weakens — while each boss's shape/palette differ
enough to read as distinct (a flat whirlpool ringed by eels; a plump
wasp queen with wings and a stinger; a spiked pale ice-cloud), without
writing three new animation systems. `js/ui.js`'s boss-health-bar name is
now read live from the enemy (`boss.name`) instead of the old hardcoded
"Shadow-Crow Swarm" markup in `index.html`. Each level's wave list grew
one wave (12 → 13): a light escort on two roads plus the boss delayed on
a third, mirroring Level 1's own boss-wave shape. `tools/playtest.js`'s
shared `runBotOn`/`runBot` bots had a real latent bug fixed while doing
this: their "is a flyer coming" check hardcoded `type === 'boss'`, which
would have silently failed to recognize any of these three new boss ids
as flying threats worth building anti-air for — fixed to check
`ENEMY_TYPES[type].flying` generically instead, so any future flying type
is covered automatically.

Per the user's explicit ask, this was verified without a full
`tools/playtest.js` run: `node tools/validate-levels.js` (structural,
catches syntax/route errors, unaffected by wave content) plus a new
targeted `scratchpad/bossbot.js` that drives each level through a real
browser exactly like the standing bot scripts, watching for console
errors and confirming the boss actually appears with the right
name/hp/flying/armor. First pass caught a real balance issue directly
caused by this change, not a pre-existing one: The Rime Swarm's original
stats (hp 700, armor 2) pushed an already-thin Level 8 run from a normal
finish into a wave-13 loss; eased to hp 620/armor 1 (closer to the
original boss's own hp 640/armor 1 baseline) and it won cleanly on
re-test (4 lives). The Hive Matriarch won on the first try (3 lives). One
run of Level 6 lost before ever reaching its new boss wave, at the
pre-existing wave 10ish trouble spot this level's own AGENTS.md entry
already documents as an unseeded-RNG flake (~85-90% win rate) —
unrelated to this change (nothing in waves 1-12 was touched) and not
chased further, per the user's direction not to relitigate levels
they've already confirmed are solid. `tools/level-fixtures.js`'s
`waveCount`/`hasBossOnWave` updated to 13 for all three levels so a
future full harness run picks up the new wave automatically. A full
`tools/playtest.js` run has not been done since this change; recommended
before the next release-quality checkpoint, not required now.

**P3-V3 — Graphics pass 2: presence, terrain, effects, UI** *(on branch
`graphics-pass-units-tiers`, not yet merged)*. The user asked for the game
to look closer to AAA and to make upgrades visually distinct, with frame rate
protected. Measured first: the world was strong but units were tiny beside the
scenery (about 20px tall at 1280x720). Changes, all render-side (`GameState`
untouched): towers display 1.25x and ground enemies and bats 1.4x (multiplier
in the update loop only, ranges and hit logic unchanged); bats got a scalloped
extruded wing geometry and a lighter `batWing` palette entry; each tower has a
distinct tier-2 accessory set (`TIER2_PARTS`) and each tier stands 6% taller,
with tier 3 keeping its branch parts on top; trees come in three species
(broadleaf, conifer, poplar) that use only the three meadow greens so the
per-level retints still work, and the two new species are cheaper than the
broadleaf; build plots stand on low stone plinths; flat moss, earth and clover
patches dot the meadow and mud and puddles wear the dirt roads (merged, one
draw call each); the forest rim outside the grid steps up into low hills
(`rimHeight`/`groundYAt`, the playable grid stays perfectly flat, and props,
grass and shadows follow the rim height); batched shadows are now stretched
and pushed away from the sun instead of round; shockwave rings are one
`InstancedMesh` (additive, fades by darkening) fired on impacts, kills and
upgrades, plus tiny sparks and a muzzle flash from the existing particle pool;
enemies twist against their stride and trolls and grunts kick up footfall dust;
the UI is repainted (wood gradient panels, rivets, trim, glossy buttons, a
glow on the ready wave button) with CSS only, so no layout or touch target
changed. Deliberately not done: real shadow maps and full-screen bloom (both
excluded above for mobile frame rate), and skeletal or per-limb enemy walk
cycles (each live part costs draw calls per enemy; tower attacks already had
wind-up and recoil).

Perf, measured with the debug overlay under software rendering: Level 1 title
view 113 calls and 167.7k triangles (budget 158 and 189k, was 110 and 172.6k);
a mid-wave scene with 13 goblins and 5 towers 262 calls and 193.9k triangles
versus 259 and 198.8k on the committed code before this pass. Real-phone frame
rate has not been measured. Harness note: untouched `main` in this
environment also loses Level 6's mixed-bot check (the documented unseeded-RNG
flake), which locks Levels 7 and 8 and fails about 19 checks by cascade.

**P3-V4 — Graphics roadmap items 1 to 4** *(on branch
`graphics-pass-units-tiers`)*. (1) Boss entrance: a camera director in
`renderer.js` (`updateCameraDirector`, wall-clock time so a slow frame cannot
stall it) pans and zooms the ortho frustum toward the boss for about 2.8s,
and a DOM ribbon banner plus dark purple screen edges play from `ui.js`
(`bossIntro`). A boss death gives a zoom punch. Picking and outline thickness
follow the zoom. (2) Living world: instanced birds and butterflies (two draw
calls each species, flapped by rewriting instance matrices), plus scrolling
cloud shadows on one quad; mostly-blighted levels get fewer or none. (3) Title
and map art: an SVG crest, soft sun rays, drifting clouds and CSS fireflies on
the title; a compass, sea ripples and drifting cloud shadows on the world map.
(4) Camera polish: a slow drift on the title screen, plus a desktop-only
tilt-shift blur strip at the top and bottom edges (`pointer: fine`, min width
900px, so phones never pay for a blur over the canvas). Also fixed: renderer
effects now draw from their own `fxRand` stream instead of `Math.random`,
which the balance duel seeds (visuals had been changing gameplay-adjacent
random draws). Level 1 title view is now 118 draw calls and 167.8k triangles
(budget 158 and 189k); a boss scene reads about 155 to 158 calls.

**P3-V4 addendum — gaps closed after the user's checklist review.** The
user's own numbered list (camera polish, boss moments, unit readability,
living world) was compared against what P3-V4 built and three things were
missing, so they were added: a screen shake on the boss's arrival (0.14 for
about 1.1s, alongside the push-in); unit readability (an enemy-only rim glow,
a shared toon material patched to add a pink-red edge light where a surface
turns from the camera, no extra draw calls; and health bars that appear on a
hit and shrink away about 2.2s later, two InstancedMeshes drawn on top,
bosses keep their own bar); and visible clouds in the game view (instanced
puffs riding above the far and near edges of the valley, never over the
towers). A bug found while building the bars: `InstancedMesh.setColorAt`
sizes its buffer from the current `count`, so `count = 0` must be set after it
or every color is silently black. Testing note: at 2x device pixel ratio
software rendering can take seconds per frame, so timing-based checks must use
1x. Level 1 title view 119 calls and 170.7k triangles; the mid-wave reference
scene 270 calls and 196.8k triangles (259 and 198.8k before any of this pass).

**P3-V5 — Per-limb enemy animation (roadmap item 7)** *(on branch
`graphics-pass-units-tiers`)*. Grunts, tricksters, trolls and bats now animate
arms, legs, ears (and the trickster's leaf) individually, and it cost fewer
draw calls, not more. The technique: every limb stays inside the enemy's one
merged mesh but each vertex carries an `aLimb` slot id; a shared GLSL chunk
(`RIG_GLSL`, injected with `onBeforeCompile` into three per-enemy materials:
toon plus rim glow, unlit, and the ink outline) rotates a slot about its pivot
by per-frame uniform angles (`makeRig`, `RIG_PIVOTS`). Materials are per enemy
so uniforms are per enemy, while constant `customProgramCacheKey`s share the
compiled programs, and the outline hull shares one `thickness` uniform object
with the global outline so it follows zoom and resize. Poses: arms counter-swing
against legs, the grunt carries its club up and chops, trolls knuckle-walk with
long slow swings, tricksters pump their arms, legs lift on the up-stroke, ears
flap, rooted enemies flail, bat wings beat through the rig. Bosses keep their
own rig. Before this, each limb was a separate mesh plus an outline mesh, so a
troll cost 15 draw calls and a grunt 11; now an enemy is 4 (merged toon,
unlit, outline, contact shadow). Mid-wave reference scene: 212 calls and
197.1k triangles (was 270 and 196.8k). Full harness: 382 pass, the 19 failures
match untouched `main`.

**P3-V6 — Painted title and world map art (roadmap item 6)** *(on branch
`graphics-pass-units-tiers`)*. New `js/title-art.js` (`TitleArt`, loaded before
`ui.js`) paints the title backdrop as layered SVG generated from the game's
own palette: a dawn sky with a sun, rays and drifting clouds, hazy purple
mountains, rolling hills with a tree line, the blighted Shadow Hollow (a
cracked glowing stump and dead trees) on the left, the lit Bastion (warm stone,
red mushroom-cap roofs, glowing windows, a fluttering banner) on the right, a
road winding between them and a flower-and-mushroom meadow in front, framed by
dark foreground leaves. Six layers translate by different amounts (`data-d`
depth) following the pointer with smoothing plus a slow automatic sway, and it
only runs while the title is showing (reduced motion turns it off). The logo is
a gold gradient logotype with a dark outline, a ribbon banner for the tagline
and vine flourishes; the wider title card keeps it on one line. The world map
gained a painted sea gradient, swells, a gold frame with corner ornaments and a
small pointer-driven tilt of the map card on desktop. Static SVG plus CSS
transforms only: no extra WebGL work, Level 1 title view unchanged at 119 calls
and 170.7k triangles. Full harness: 382 pass, the 19 failures match untouched
`main`.

**P3-V7 — Finale bosses for Levels 3 and 4** *(on branch
`graphics-pass-units-tiers`, user-requested: "no boss battle for Level 3 or
Level 4")*. Levels 3 and 4 had ended on a plain 12th wave. Each now has a
13th wave with a light escort and a new boss, following the Level 6 to 8
pattern exactly (a new `ENEMY_TYPES` entry, a `makeBossParts` recipe on the
shared boss rig, one extra wave, `tools/level-fixtures.js` updated to 13 waves
with the boss on 13). **The Ashen Swarm** (`ashen`, Level 3, hp 600, speed
0.88, armor 1, flying): a scorched rock core with curled horns, a red-hot
heart and embers orbiting; it rises after a bat and grunt escort on the single
road. **The Leaf-Storm** (`leafstorm`, Level 4, hp 520, speed 0.66, armor 0,
flying; first drafted at 640 and 0.8, see the tuning note below): a russet whirl of leaf-blades round a gold heart, sent down the Long
Way with bats on the South Road and grunts on the Shortcut. Boss hp scales
with the wave number like every boss (about 960 for the Ashen Swarm and 830 for
the Leaf-Storm at wave 13).
Everything boss-shaped (camera push, banner, health bar, arrival sting) is
generic on `e.boss`, so it worked without new code. Verified in the full
harness: Level 3's mixed defense wins with 7 lives (wave 13 leaked 5, the thin
spot to watch) and Level 4's with 9, neither single-tower-type run trivializes
either level, and the failures match untouched `main`. Test labels for
Levels 3, 4, 6, 7 and 8 now say 13 waves. Level 2 still has no boss (it was not
part of the request).

**P3-V8 — Layered music (roadmap item 5)** *(on branch
`graphics-pass-units-tiers`)*. A generative, fully synthesized score lives in
`js/audio.js` beside the sound effects (no audio files). Five layers, each its
own gain node on one bus: a soft pad, a plucked lute-like arpeggio, bass, drums
and a reedy lead. Four mixes crossfade with game state (`musicTarget`): calm
while on the title, the map and in build time (84 bpm, pad and arpeggio);
combat once a wave is live (112 bpm, bass, war drums and the lead join, the
chord order flips to a darker one); boss while a boss is alive (128 bpm, four
on the floor, sawtooth lead and bass); end, which fades everything out so the
win and lose stingers play alone. Notes are scheduled on the audio clock about
0.35s ahead by a 50ms timer (`musicTick`), never from the frame loop, so a slow
frame cannot make it stutter, and a tab that was hidden skips the gap instead
of bursting. Each level has its own key and mood (`MUSIC_KEYS`: Hollow in D
major, Millbrook in G, Cairnwatch in A minor, Splintered Vale in E minor,
Elderroot in D minor, Sunken Market in F, Amber Terraces in C, Frostpine in B
minor), and the arpeggio and lead are built once from a seed hashed from the
level id, so each level has a fixed tune that repeats every four bars. The
music bus sits at 0.32 so it stays well under the effects (checked against the
soundboard: music RMS about 0.010 to 0.020, versus 0.004 to 0.05 for effects).
Music starts on the first user gesture like everything else, follows the mute
button through the master gain, pauses with the game (the context is
suspended) and uses no `Math.random`, since the balance tests seed it. Since
there is no way to listen in this environment, verification is numeric:
`Audio.renderMusic(state, seconds, levelId)` renders a mix offline; it was
checked for NaN, clipping and level, and its envelope autocorrelation shows
the rhythm sits on the beat (strong repeat every bar, four-on-the-floor in the
boss mix). Four harness checks now cover it, and a live-game run confirmed the
state sequence calm, combat, boss, combat, end. A real ear should still judge
taste; the mix constants are all in `MIX` and `MUSIC_KEYS`.

**P3-V9 — Settings: separate effects and music controls** *(on branch
`graphics-pass-units-tiers`, user-requested after the music was found a bit
annoying)*. The single mute button became one of three controls on a new
Settings screen (`#settings`): **All sound** (the old quick mute, still on the
HUD too), **Sound effects** and **Music**, each with an on/off switch, and the
last two with a volume slider. Audio now has two volume buses (`sfxOut`,
`musicOut`) feeding the master gain: every sound effect and the ambience route
through the first, the score through the second; a switched-off kind skips its
work entirely (effects return before creating nodes, the music scheduler idles)
instead of just being silenced. Settings persist in `localStorage` under
`bb-audio` (`sfxOn`, `sfxVol`, `musicOn`, `musicVol`), alongside the existing
`bb-muted`; bad or blocked storage falls back to the defaults. Music now
defaults to 0.6 of its old volume, since continuous music reads louder than
short effects. Reachable from the title screen ("Sound settings" link), the
pause menu, and a gear button in the HUD; the gear pauses a live game first so
the screen never covers a fight, and Done returns to the pause menu. Esc closes
it, clicking the dark backdrop closes it, changing the effects slider plays a
sample so the level can be judged, every control is at least 44px (on short
phone screens each slider moves inline beside its label to stay 44px tall),
switches use `role="switch"` with `aria-checked`, and reduced motion removes
the knob animation. Seven harness checks cover it.

**P3-V7 tuning note (found while adding 4x speed)**: a full-harness run then
showed Level 4's mixed defense losing, and isolated runs of the test bot
(ten or more per version, in scratchpad `l4bot.js`: untouched `main` 10/10, the
commit before the boss 18/18, the boss as first drafted about 7/10 to 11/20)
showed why: a leaking boss costs exactly 5 lives and the defense reaches wave
13 with only about 6, so a leak often ends the run, and in the losing runs the
boss reached the gate with about 5% hp left. The escort was cut to 3 bats and 4
grunts and the Leaf-Storm eased to hp 520 and speed 0.66 (a slower, softer
boss than the Shadow-Crow, fitting a level where three roads drain gold):
14/14 wins, the boss never leaked. Level 3's Ashen Swarm needed nothing (10/10,
the boss died on the road in 9 of 10). Lesson for the next boss: measure win
rate over 10 or more isolated runs, because a single harness run cannot tell a
70% level from a 100% one, and look at the boss's remaining hp when it leaks.

**P3-V10 — 4x game speed** *(on branch `graphics-pass-units-tiers`,
user-requested)*. The speed button (and the F key) now cycles 1x, 2x, 4x.
`GameState.setSpeed` accepts only 1, 2 or 4. The game loop (`js/boot.js`)
advances the simulation in fixed steps of at most 1/60 second instead of one
frame-sized step, so 4x plays the same battle as 1x (the step size the tests
and balance work use) and never takes one big jump; at most 12 steps a frame.
Measured in the running game: game time per frame time is exactly 1, 2 and 4.
The button shows gold at 2x and a glowing pink at 4x, with an updating
aria-label. Music tempo and effects stay at normal speed. Harness checks cover
the cycle and the valid-speed rule.

**P3-M9 — Levels 9 and 10: the dawn levels** *(on branch
`graphics-pass-units-tiers`, user-requested)*. The user loved the title
splash and asked for new levels that look like it, with curving roads and
enemies arriving from several divergent points, "so it's harder". Three
layouts were drawn and validated first; the user picked two. Both reuse the
multi-route engine unchanged for pathing (`routes`, per-road groups, `at`) and
share `js/dawn-kit.js`: Level 1's own Bastion (same masonry, mushroom-cap
towers, banner, 3 damage states, optional banner colors), a cracked Hollow
stump with a pulsing glow and spores at the head of every road (facing out
from whichever map edge it stands on), a short brook with a plank bridge
(`chokepoint.streamRows`), and a splash-style meadow (more flowers and
mushrooms, props kept off the road). Theme is the splash dawn: warm pink-gold
key light, purple fill and backdrop, golden-green ground, fireflies.
**Level 9, The Flanked Keep** (22x14): six spawns. Five roads start on the
west, north and south edges and join at (12,8); one more starts in the far
south-east, circles behind the keep and reaches the gate without ever
crossing the brook, so no single choke point wins. **Level 10, The Keep
Between** (22x14): the Bastion stands mid-valley; three roads converge from
the west and cross the brook, two come in from the east behind the keep.
New bosses: The Gloam-Moths (`gloam`, a rose-winged moth cloud) and The
Heartbloom (`heartbloom`, a spiked pulsing bloom), both on the shared boss
rig. 13 waves each.

**Curvy roads (engine feature, opt-in).** The first build kept the grid
corners and the user rightly rejected it: the design page had smooth wavy
roads and the game had straight runs. A level may now set `curvyRoads: true`.
`GameState` then rounds each route's polyline with three Chaikin
corner-cutting passes (start and gate stay exact), so enemies, flyers and
targeting all use the curve; the cells (what is road, what is buildable) are
unchanged and the curve stays within about half a cell of them (a harness
check enforces 0.75). `Renderer.buildCurvyRoad` draws the road as merged
ribbons (grass lip, dirt, cobble near the gate, twin ruts) plus mud and
pebbles along the curve, skips the bridge cell, and colors depend only on
position so shared tails overlap invisibly. Path cells render as meadow,
grass and props keep off the curve (`roadDist`, also in the level kit).
Levels 1 to 8 are untouched.

Balance lessons: the curve shortens and shifts the path, which cost towers
coverage, so the isolated-bot numbers moved and the waves were retuned after
the change, not before. Flyers leaked at a constant rate on roads with no
anti-air in range (the same coverage-gap archetype as Level 7), so bats were
moved onto the roads the bot's anti-air covers and the flank carries ground
units. Bosses again had to be softened (hp 340 and 200) because a leak costs
5 lives. Final isolated runs: Level 9 8/8 won (5 to 13 lives), Level 10 8/8
(2 to 10). The P3-FIX1 "last level" end-screen checks moved to Level 10. The full harness again lost Level 6's unseeded-RNG mixed-bot check, which locks Levels 7 to 10 and cascades, so the dawn levels' own checks (markers, curve, lone towers, console) were run directly with all levels unlocked and pass; levels 1 to 5 had no failures.

**P3-V11 — Diorama look: color, toon lighting, cast shadows, glow, haze**
*(on branch `graphics-pass-units-tiers`, user-requested: "a high-quality
miniature diorama aesthetic", same on mobile and desktop)*. The user asked for
sRGB output, ACES tone mapping, soft PCF shadow maps, lit materials and
bloom or tilt-shift, and then ruled out quality tiers: phones and desktops get
the same look. Real shadow maps and a post-processing pass stay excluded (they
cost a lot on phones), so the same look is built from baked and in-shader
techniques instead. three.js is still r128, which has no `SRGBColorSpace`;
`renderer.outputEncoding = THREE.sRGBEncoding` does the job.
1. **Color pipeline.** `js/color-pipeline.js` (loads right after three.js)
wraps `THREE.Color` so every authored sRGB hex becomes linear on the way in and
converts back on `getHex`/`getHSL`, with blends (`lerp`) done in sRGB so
gradients keep the look the palette was tuned for. No palette or level file
changed. `Renderer.init` sets sRGB output and ACES tone mapping (exposure 1.3;
1.0 was too dark), raises light intensities and the toon ramp to linear
equivalents (`lin()`), tone-maps the clear color the same way (`displayColor`)
so the backdrop meets the fog, and every custom shader (water, particles,
outline, puffs, cloud shadows) includes the tone mapping and encoding chunks.
`?lin=0` restores the old look for comparison.
2. **Toon lighting.** `js/toon-lighting.js` patches the shared
`THREE.ShaderLib.toon` fragment shader once, so every toon material (including
ones with their own `onBeforeCompile`) gets cool violet tint in the shaded ramp
steps, a warm lift on sunlit steps and a faint top-light sheen on upward curved
edges. Thresholds were calibrated from a debug color-coded view of the real
light values (the first guess tinted the whole ground violet). `?toon=0` turns
it off.
3. **Cast shadows.** The baked decal system now draws a trailing teardrop
(`castShadowTexture`) in cool violet along the sun's direction, longer and
darker than the old round blobs; towers get a trailing shadow too and the
Bastion (Level 1 and the dawn levels) a long one. Still merged decals, so no new
draw calls. This is a baked look, not a per-pixel shadow map: shadows do not
deform for animated units, and props do not shade each other's bodies.
4. **Glow and haze.** Window and lantern halos are larger and softer (a cheap
stand-in for bloom). The old desktop-only CSS blur strips became a plain
top and bottom colored haze gradient on every device (no blur filter).
5. **Frame-rate governor** (`boot.js`, `Renderer.setPixelScale`): if frames stay
slow it steps resolution down to at most 0.6x and back up when fast, and never
switches an effect off. Off under automation (`navigator.webdriver`) and with
`?gov=0`.
Also retuned: the curvy road ribbons' dirt brightness for the new pipeline.
Level 1 title view: 119 calls and 170.7k triangles (budget 158 and 189k). Phone
frame rate is still unmeasured: the real test is the user's phone.

**P3-FIX2 — "Send next wave" sometimes needed a second tap** *(user-reported
after finishing Level 3)*. Not reproducible in automated mouse and touch taps
(48 of 48 sent), so the fix hardens the likely causes instead of guessing at
one: the button's label and size changed every second during prep, a click is
only delivered when press and release land on the same element, and a 3px
press-down transform could move the pill out from under a press near its top
edge. Now: the button never moves or resizes (fixed minimum size, the second
line always reserves its height), the `:active` shift is gone, an invisible
13px margin enlarges the tap target (hit-tested), the wave sends on pointer
release as well as on click (`sendWave` is idempotent), and the wave goes
before the sound unlock inside a try/catch so an audio error can never eat a
tap. An open, unconfirmed guess: the button is disabled while enemies are
still alive ("N coming"), so a tap during a wave does nothing by design; if
players expect to call the next wave early, that is a design change (call
early for a gold bonus), not a bug.

**P3-V12 - Curving roads on Levels 1 to 8** *(on branch
`claude/fervent-wright-jeojom`, user-requested: NEXT-STEPS item 7)*. Every
level now sets `curvyRoads: true`, so the road is a smooth ribbon and enemies
walk the curve. Screenshots of all eight levels were checked: bridges and
crossings line up with the ribbon and no prop sits on the road.

**Pace compensation (new engine flag `curveKeepsPace`).** Rounding corners
shortens a road by 11% to 17%, so enemies spent less time in tower range and
every level got harder (seeded bot runs: Level 2 from 7.2 lives to 4.9, Level 3
lost 7 of 30, Levels 6 and 8 lost every run). Instead of retuning eight wave
tables by hand, each route now has `pace = curved length / straight length`
and enemies move at `speed * pace`. Time from spawn to gate is the same as on
the straight road, so the tuned wave tables and boss margins stay valid.
Levels 1 to 8 set the flag. Levels 9 and 10 do not (they were tuned on their
curves). `tools/validate-levels.js` proves it: a grunt takes the same time on
the curved and straight version of every route (within 1%).

**Long legs.** Chaikin rounding cuts a bigger corner when the legs are long.
Elderroot Ward (legs up to 11 cells) and Frostpine's Scree Path cut 1.12 and
0.94 cells off their cells, past the 0.75 rule, so the road ribbon would have
crossed build plots. Collinear waypoints on the long legs fix it with no change
to the shape or the cells. Keep runs under about 5 cells on any new curvy level.
New validator checks cover curve deviation, exact spawn and gate ends, and
walking time for every curvy level (284 checks).

**Balance (seeded bot runs, 30 to 60 per level, browser and vm runner agreed on
the same seeds).** With pace compensation Levels 1, 2, 5, 7 and 8 match their
straight-road results. Level 3 is a little easier than before (14 lives
against 10), left as is. Level 4 lost about 5 of 30 runs at waves 10 and 11,
so those two waves lost one or two units each (59 of 60 won, 5.6 lives, was
5.8). Level 6 was already failing on straight roads on this branch (3 of 30
won), which is why the full harness kept losing it and locking Levels 7 to 10.
Waves 4, 9, 10, 11 and 12 were eased and the Drowned Swarm boss softened to
hp 360 and speed 0.62: it leaked at about 53% hp in every run, even on straight
roads, because Level 6 has the shortest roads and the boss spends too little
time in range. Now 60 of 60 won, 9.4 lives, boss leaks 1 run in 30 (9 hp short).
The single-tower-type stress test (5 types x 2 branches) tops out at 7 of 10
clean waves on Level 2 and never wins a level alone, so no dominant strategy.
Lesson that repeated: a boss that leaks at the same hp in every run is a
damage ceiling, not bad luck. Measure its hp at the leak before touching waves.

**Fixed along the way.** The first full harness pass with Level 6 beatable
reached Levels 7 to 10 for the first time in a while and found three older
issues: the world map reclaim animation could set a negative circle radius
(the frame timestamp can precede `performance.now()` by a few ms, now clamped,
a real console error); the safety-net check waited a fixed 2.3s but the net
needs 1.5s of wall-clock plus slow software frames (measured 0.8 to 2.8s, now
waits up to 15s); and the Level 1 spread check expected 6 path units after 9s,
which a 0.86 pace makes 5.2 (now > 5).

**Browser-free bot runner.** A seeded runner (the harness bot logic over
the real `GameState` in a Node `vm`, about a second per 30 runs) replaces slow
browser runs for tuning. Scratchpad only, not committed. It matched the
browser on frostpine-camp and sunken-market over 30 identical seeds.

**P3-V13 - Victory screens and the Level 10 finale** *(on branch
`claude/fervent-wright-jeojom`, user-requested: "more exciting victory screens
after each level, and especially after level 10")*. The win screen was a plain
card with a title, three stars and a line of text. Every win now gets: a
ribbon that follows the star rating (Flawless!, Well held!, Victory!); stars
that land one at a time with a rising bell each; stat chips that count up
(lives left, foes beaten, waves held); confetti cannons from both corners and
a drizzle of paper; a warm glow behind the card; and a richer fanfare with a
sparkle tail. A 3-star win adds three gold fireworks and two more cannon
bursts, each with a boom.

**The finale (the last level of the campaign, found from `LEVELS`, so it moves
if a Level 11 is ever added).** The title becomes "The Hollow is healed!" with
a "Dawn breaks!" ribbon, a shimmering gold logotype, a dawn-glow backdrop and a
pulsing card. It shows a recap of all ten levels with their stars and a total
(a perfect 30 gets its own line), and a long synthesized fanfare. Fireworks
keep launching into the open sky on either side of the card until the screen
closes, and every burst has its own whistle, boom and crackle, so sound and
picture stay in step. A separate `sfx.finale()` replaces `sfx.win()` there.

**How it is built.** New `js/celebrate.js` (`Celebrate`, loaded before
`ui.js`) is one 2D canvas above the card with `pointer-events: none`, so taps
still reach the buttons. It is visual only: it never touches `GameState`, has
its own random stream (the balance tests seed `Math.random`), stops itself the
moment `#end` loses `show`, is capped at about 340 particles, and does nothing
under `prefers-reduced-motion` (the CSS entrance animations are also off).
`showEnd` in `ui.js` restarts the entrance animation each time the screen
opens, but star bells and firework sounds play only for a fresh win (a flag set
by `gameWon`), not when the pause button reopens the screen. The `lit` class on
the stars is still set immediately (the stagger is pure CSS delay), so the
existing star-count checks hold. The card has `max-height` with scrolling as a
safety net and a compact layout under 460px of height (the finale drops its
flavor line and the badge stars there; measured 296px of 390 on a phone).

**Caught while building it.** The first pass left the stars dark: a more
specific selector (`#end.win #stars span`) overrode the lit color. The finale
card was taller than the screen (733px on 720, 419px on 390), now 553 and 296.
The first fireworks burst over the title and read as nothing; they now burst in
the margins beside the card (anywhere in the upper part on narrow screens) and
are bigger. This sandbox renders at 2 to 3 frames a second under software
rendering and the loop caps each step at 50ms, so the show runs in slow motion
here: judge timing on a real device. Eight new harness checks cover the
ribbon, the counted stats, the non-finale title, a click-through canvas, the
finale title and recap, ten badges, running fireworks and the card fitting.

**P3-V14 - Player-rotatable view (four fixed views)** *(on branch
`claude/fervent-wright-jeojom`, user-requested: "can the angle of the gameplay
screen be rotated by the player", then "four fixed views")*. The camera was
already built from two numbers (`CONFIG.cameraElevation` and `cameraYaw`), and
picking, framing (`fitCamera`), health bars and `worldToScreen` all derive from
the camera, so turning it was cheap. The view is now one of four 90 degree
steps around the valley (`view.idx` 0 to 3, on top of the original 12 degree
yaw). `Renderer.rotateView(+1 | -1)` eases to the next step over 0.55s of
wall-clock time (so a slow frame cannot stall it, and it works while paused),
re-placing the camera and re-fitting the frustum every frame while it turns.
`+1` turns the valley clockwise as seen from above (checked: the Bastion moves
from bottom right to bottom left). The step is saved in `localStorage` under
`bb-view` (wrapped in try/catch) and restored on load. Default is the original
view, so every level plays exactly as before until the player turns it.

**Controls.** A clockwise button in the HUD row (aria-label, 44px), plus an
anticlockwise one at 900px width and up; Q turns anticlockwise and E clockwise
on a keyboard (only while a level is being played). On phones only the
clockwise button shows: both of them pushed the HUD row 16px into the wave
button at 844px wide. Taps still pick the right tile in every view (a harness
check places a tower through a mouse click in a turned view). Not done:
free-drag rotation (it would fight with tap-to-place on touch), a view per
level, and an on-screen hint for the keys beyond the title card's key line.

**Two things were baked to the old camera and had to change.** The soft
lantern, brazier and fire halos (`glow(..., axis: 'cam')`) were built facing the
camera at build time, so they would have skewed sideways in other views. They
are now one dynamic mesh (`glowCam`) rebuilt from the camera's right and up
vectors whenever the camera turns; window halos on walls (`axis: 'z' | 'x'`)
are unchanged. The clouds were placed along the world's far and near edges,
which become the left and right sides after a quarter turn (one drifted over the
tower panel in the first test). They are now laid out in camera space, along the
screen's horizontal and beyond the valley's far and near edges measured along
the camera's forward direction, so they ride the same edges in every view.

**Checked.** All ten levels at all four views (contact sheets, no console
errors, tall trees and the Bastion hide some road from some sides, as expected
of a 3D view). The sideways views (90 and 270 degrees) make a landscape map
smaller, because the map is wider than it is tall; that is the cost of fixed
quarter turns. Four turns return the camera to the starting position exactly.
Nine new harness checks cover the button sizes, saving, direction, picking in a
turned view, camera-facing glows, Q and E, a full circle and a tap in a turned
view. Known and unchanged: at 667px wide the HUD row already overlapped the wave
button before this change.

**P3-V15 - Player zoom and pan** *(on branch `claude/fervent-wright-jeojom`,
user-requested: "a zoom in / out for the camera view")*. The player can zoom the
camera from 0.75x (a little more of the surroundings) to 2.5x (close enough to
read the tower details), and drag to look around once zoomed in. It is layered on
the camera director that already existed for the boss entrance and the title
drift: `look.zoom` multiplies the director's zoom into `camera.zoom`, and
`look.px/py` pan along the camera's own axes, so picking, health bars, the tip
arrow and `worldToScreen` follow with no changes. Targets ease (wall-clock time,
works while paused); a drag follows the finger at once. The pan is clamped so
the view never leaves the original framing (`fit.hw/hh`, refreshed on every
resize and turn), and zooming out past 1 allows no pan. Outline width is
recomputed from the real camera zoom, including inside `fitCamera` (it used to
reset to the unzoomed width on a resize while the director was zoomed).

**Controls.** Mouse wheel and trackpad pinch (a wheel event with `ctrlKey`)
zoom toward the pointer, so the tile under it stays put; two fingers pinch and
pan together; dragging pans; the plus and minus keys step the zoom (1.25x), 0
resets zoom and pan, arrow keys pan while zoomed. Minus and plus buttons sit in
the HUD row from 1000px width up; phones use the pinch, since the row has no
room (see P3-V14). `js/input.js` now tracks every pressed pointer: a press that
moves less than 12px is still a tap, a drag past that is a pan and never
selects a tile, and a second finger turns the gesture into a pinch for good
(lifting one finger does not produce a stray tap). Zoom and pan only work while
a level is being played, and are not saved between visits. Turning the view
(P3-V14) keeps the zoom and eases the pan back to the center, since the pan
belongs to the old angle.

**Checked.** In a real page: the buttons clamp at 0.75x and 2.5x; the wheel
keeps the cell under the cursor; a drag pans without selecting and stops at the
clamp; a tap while zoomed picks the intended tile; turning keeps the zoom; a
synthetic two-finger pinch zooms and selects nothing; screenshots at both ends.
Twelve new harness checks cover these. Not done: saving the zoom, a zoom
indicator, and a double-tap to reset (0 and zooming out do the job).

**Found by the full run, not by zoom.** The full harness's random Level 10
mixed-bot run lost once (20 lives, the boss wave leaked 5). The bots run in pure
game logic, so zoom could not touch them. The seeded runner put Level 10 at 56
of 60 wins (93%, 7.1 lives) with the Heartbloom leaking in 11 of 30 runs at the
same 16% hp every time: a damage ceiling again (a leak costs 5 lives, the defense
reaches wave 13 with about 7). The Heartbloom's base hp went from 200 to 150 (240
at wave 13): 0 leaks in 40 runs, 80 of 80 won, 8.2 lives. A phone-size touch-tap
check also failed once in that same run: leaving the title snaps the camera from
its title zoom to 1 on the next rendered frame, and under software rendering that
frame can be seconds away, so a tile measured before it and tapped after it was
about 15px off. The first desktop and phone taps now wait for the camera to
settle (a harness fix; a person cannot tap inside the first frame).

**Graphics roadmap**: see `GRAPHICS-ROADMAP.md` for the approved list of
further graphics work, its priority order, the performance budget and the
current test status. Read it before starting any graphics task. Its numbered list is the one the
user was given in chat and is authoritative.

**Endless mode, difficulty tiers and daily run**: designed, not built. See `ENDLESS-MODE.md` for the plan, build order, save-format notes and itch.io and Steam hosting notes. Read it before starting any of that work.

**What is left to do**: see `NEXT-STEPS.md` for the current open items in priority order and the working notes from the last long session. Read it at the start of a new chat.
