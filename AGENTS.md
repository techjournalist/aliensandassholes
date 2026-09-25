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

- **P3-M4 — Level 4: The Elderroot Ward** (climax). Deep within the
  Shadow Hollow itself, ~80% corrupted — only a small living foothold
  around the endpoint. Endpoint: the Elderroot, a colossal still-living
  tree stump ringed by a ward-circle. Chokepoint: the Rootfall Chasm, a
  single ancient root spanning a fissure. 14 waves ending in a
  Shadow-Crow Swarm reprise (the existing boss, unchanged stats — the
  per-wave `hpScale` stiffening alone makes it harder than Level 1's
  wave-12 fight). Grid 20x13 or 22x13. Highest tuning risk of the
  three: longest path, busiest scene (check draw calls against the
  established budget), and a boss whose difficulty now depends on
  whichever tier-3 branches exist.

**Recommended, not yet decided**: M6 (player abilities), M10 (hero,
stretch), and the remaining M11 items (full palette consistency check,
UI cleanup, mobile performance profiling) sit in a closing pass after
P3-M4, since they should work across all four levels' geometry before
being called done. Confirm this re-sequencing with the user once P3-M4
is reached rather than treating it as locked today.

**If budget runs out early**, cut order: P3-M4 (Level 4, largest scope)
first, then P3-M3 (M5) is independently cuttable since flat-tier towers
already clear every wave table by construction. Cut P3-M1/P3-M2 last —
losing a level is a bigger change to what was promised than losing an
upgrade layer.
