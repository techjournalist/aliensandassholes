# Playtest harness (dev only, not part of the game)

`playtest.js` opens `index.html` in headless Chromium, serves a local copy of
three.js in place of the CDN tag (sandboxes often block CDNs), checks for
console errors, drives mouse and touch taps through `handleTap`, verifies the
portrait rotate overlay, and writes screenshots to `tools/shots/`.

```
npm install three@0.128.0 playwright      # once, in the repo root
node tools/playtest.js
```

`THREE_LOCAL=/path/to/three.min.js` overrides where the local three.js copy
is read from. The game itself has no dependencies and no build step, though
as of P3-M0 it is no longer a single file: `index.html` is a thin HTML/CSS
shell that loads its logic from `../js/*.js` via plain `<script src>` tags
(classic scripts, not ES modules, so `file://` double-click still works with
no server). Load order matters: each level's file (e.g.
`js/level1-shadow-hollow.js`) defines its data and scene-building code, then
`js/levels.js` collects them into the `LEVELS` registry, then
`js/game-state.js`/`js/renderer-fx.js`/`js/renderer.js` (the level-agnostic
engine; `renderer-fx.js` holds the shader factories) come after,
then `js/input.js`/`js/ui.js`/`js/audio.js`/`js/boot.js`.

`tools/level-fixtures.js` holds the tile coordinates, gold amounts, and wave
counts that are literal to one level's geometry, one entry per level id. As
of Level 2, `playtest.js` runs Level 1's mechanic-level checks (M1-M9,
upgrades/sell, flying rule, rooting, boss, pause/speed/mute, resize) inline
as before — those don't vary by level — then runs a `runBotOn(plan, spots,
totalWaves)` mixed-defense and single-tower-type pass against each
additional level, reading its `botBuildSpots`/`waveCount` from this fixture
table. A third level should extend that same per-level block rather than
duplicating Level 1's full mechanic suite again.

`validate-levels.js` (plain Node, no browser; `playtest.js` runs it first)
loads the palette, level files and `GameState` into a `vm` context. It
checks every level's roads against the rules the engine relies on: each
waypoint pair is a straight run, a road crosses the stream column only at
the chokepoint, never walks through the endpoint, ends at the gate, and
roads that meet stay merged. It then drives a synthetic three-route level
through the real engine and confirms single-route levels derive exactly
the pre-route path. Run it alone with `node tools/validate-levels.js`.

Multi-route levels (P3-M4a): a level may define
`routes: [{ id, waypoints }, ...]` instead of `pathWaypoints` (first route
= primary: its tail is the cobbled stretch, its start is `level.spawn`).
Wave groups take optional `route` (which road) and `at` (an absolute start
time; groups without it run one after another, as before).
