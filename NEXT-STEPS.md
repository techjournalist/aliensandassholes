# Next steps (Aliens & Assholes)

This repo is the Aliens & Assholes fork (see the top of `AGENTS.md`). Its
ten levels are `js/level1-greenhope.js` to `js/level10-terraformer-prime.js`.
The notes further down are the Knights & Knaves and Briar & Bastion
handoffs the fork was built from; level names in them refer to those games.

Hosting: `wrangler.jsonc` names the worker `aliens-and-assholes` (no build
command, deploy `npx wrangler deploy`). A Cloudflare project with that name
still has to be connected to this repo.

Open items for the fork:
- Veteran tier (seeded bot, 10 runs per level): wins 99 of 100. Terraformer
  Prime is the hardest (9 of 10, mean 3 lives, the Mothership leaks in half
  the runs); Bloomfruit and the Spaceport keep 4 to 6 lives. Evening it out
  is a choice: `node tools/bot-runner.js all --tier bramble --seeds 20`.
- The Hive Front plays easiest of the ten for the bot (about 18 lives);
  harden it if it feels too easy.
- Check the look and the frame rate on a real phone.

# Next steps (Knights & Knaves)

This branch is the Knights & Knaves fork (see the top of `AGENTS.md`). Its
ten levels are `js/level1-hollybrook.js` to `js/level10-black-keep.js`
(Levels 5 to 10 follow the King's host into Blackmoor). The notes below are
the Briar & Bastion handoff the fork was built from; level names in them
refer to the original game.

Hosting: a separate Cloudflare Worker, `knights-and-knaves`, builds this
branch (production branch `claude/focused-keller-tr07bl`, no build command,
deploy `npx wrangler deploy` reading `wrangler.jsonc`). Every push redeploys.
It never touches `main` or the Briar & Bastion worker.

Open items for the fork:
- Knight tier spread: seeded bot wins out of 10 per level are Hollybrook 10,
  Ravensford 4, St Wendel's 0 (the Gargoyle Lord leaks at about a third of
  its hp), Castle 10, Highcrag 10, Wickham 2, Saltmarsh 10, Amberlea 10,
  Blackmoor Lines 3, Black Keep 3. Squire tier wins 20 of 20 everywhere.
  Same shape as the original's Bramble spread; evening it out is a choice.
- Pitchpot Friar branches: Tar Abbot and Firepot Friar separate clearly on
  the new duel tiles, but watch them if the duel tiles move again.

# Next steps (handoff for a new chat)

Written 2026-10-07 at the end of a long session, updated after the curving roads
work. Branches: `graphics-pass-units-tiers` (the graphics and levels 9 and 10 work)
and `claude/fervent-wright-jeojom` (that plus curving roads on Levels 1 to 8). All work
is committed and pushed; nothing is merged to `main`. Playable build:
artifact `https://claude.ai/artifact/MsACgADTeeWUG153ocLaiy` (version 10, with difficulty tiers; the older TGe33p... link is a stale copy).
Read `AGENTS.md` first, then the file named in each item below.

## State of the game
- Difficulty tiers: Meadow (as tuned) and Bramble (hp x1.05, bounty x0.95, 16
  lives), picked beside the Play button and saved as `bb-difficulty`. Stars are
  stored per tier, a Bramble win puts a thorn ring on the map node. Bramble wins
  64% of seeded bot runs but the spread per level is wide (Amber Terraces 5 of
  30, Millbrook 30 of 30). AGENTS.md P3-D1.
- 10 levels, each with a finale boss except Level 2. All 10 use `curvyRoads`.
  Levels 9 and 10 (the dawn levels) also use `js/dawn-kit.js`. Levels 1 to 8 set
  `curveKeepsPace`, so walkers slow to match the shorter curved road (AGENTS.md
  P3-V12).
- Camera buttons: Settings has a switch to hide the six camera buttons (saved as
  `bb-camui`); keys and gestures always work. AGENTS.md P3-V17.
- Speed: the speed button and F cycle 1x, 2x, 4x and 8x (AGENTS.md P3-V10 and P3-V19).
- Save code: Settings has a "Save code" panel that copies the campaign as text
  (`BB2-...`, both tiers; older `BB1-...` codes still load) and loads one pasted
  from another device. Loading only adds. AGENTS.md P3-V18 and P3-D2. "Resume a level" (mid-level save) was explained to the user and not built.
- Tilt: the player can tilt the camera 30 to 80 degrees (buttons from 1180px, [ and ],
  right-drag, two-finger swipe; saved as `bb-tilt`; 0 resets zoom, pan and tilt).
  AGENTS.md P3-V16.
- Zoom: the player can zoom 0.75x to 2.5x and drag to pan (wheel, pinch, + and -, 0 to
  reset, arrow keys; buttons from 1000px width). AGENTS.md P3-V15. Not saved between visits.
- View rotation: the player can turn the view in four fixed 90 degree steps (HUD
  button, Q and E; saved as `bb-view`). AGENTS.md P3-V14. The sideways views make a
  wide map smaller. At 667px wide the HUD row overlaps the wave button (older issue).
- Victory screens: every win has a ribbon, counted stats and confetti, and the last
  level has a finale with fireworks and a campaign recap (AGENTS.md P3-V13,
  `js/celebrate.js`). Timing was judged only at 2 to 3 fps in the sandbox, so check
  how it feels on a real device.
- Diorama look: sRGB + ACES color pipeline, toon lighting patch, violet baked cast
  shadows, softer glow, haze gradient, resolution governor (AGENTS.md P3-V11).
- World map has a bridge where roads cross (hills, mountain shadows and a river
  bridge were tried and reverted at the user's request; do not redo them).
- Tests: `node tools/validate-levels.js` passes (342 checks). The full
  `tools/playtest.js` passed 739 of 739 after the difficulty tiers (P3-D1). The full
  `tools/playtest.js` passed 617 of 617 on the curving roads work, with all 10
  levels won by the mixed bot, so the old Level 6 cascade that locked Levels 7 to
  10 is gone (Level 6 was rebalanced; the root cause, unseeded `Math.random`, is
  still open as item 3). A full run takes about 25 minutes. Install with
  `npm install three@0.128.0 playwright` or set `THREE_LOCAL=<path to three.min.js
  r128>`.

## Open items, in the order I would do them
1. **Confirm the "Send next wave" fix.** User-reported: the button sometimes needed
   a second tap (AGENTS.md P3-FIX2). It was hardened but never reproduced. Ask what
   the button said when it failed ("Send wave N" or "N coming") and on what device.
   If it said "N coming", the user may want a "call the next wave early" feature
   with a gold bonus (a design change).
2. **Real-phone check.** Frame rate has never been measured on a phone. Try the
   diorama look on a real device. Switches if needed: `?lin=0`, `?toon=0`, `?gov=0`.
3. **Seeded gameplay randomness.** Replace unseeded `Math.random` in gameplay (enemy
   lane jitter, a few effects) with a seeded generator. It fixes the flaky Level 6
   test cascade and is needed for the daily run. See `ENDLESS-MODE.md` section 3.
4. ~~Difficulty tiers: Meadow and Bramble.~~ **Done** (AGENTS.md P3-D1). Open, for
   the user to decide whether to even out Bramble per level (per-level trims in
   the difficulty table, or a bot that builds anti-air like a person before
   judging). The BB2 save code is built (AGENTS.md P3-D2).
5. **Endless mode, then the daily run.** `ENDLESS-MODE.md` sections 2 and 3.
6. **New enemies:** Spore-Medic, Sapper, Digger (one each for Levels 8, 9 and 10).
   Pod-Bearer and Magpie were dropped by the user. `ENDLESS-MODE.md` section 7.
7. ~~Curving roads on Levels 1 to 8.~~ **Done** (AGENTS.md P3-V12). Level 3 plays a
   little easier than before (14 lives against 10 in seeded bot runs). Tune it
   if it feels too easy.
8. **Player spells** (Call the Burrow Guard, Bramble Burst): designed in
   `AGENTS.md` (M6) but the user paused them. Only start if asked.
9. **Smaller items:** a boss for Level 2; hero unit (M10); a colorblind check on
   tower and enemy shapes; first-appearance tips for new enemies; an ear check of
   the music (verified numerically only).
10. **Hosting:** itch.io or Steam is under consideration. three.js is loaded from a
    CDN, so an offline or packaged build must ship a local `three.min.js`. Steam
    would need a desktop wrapper (Electron or Tauri). Details in `ENDLESS-MODE.md`
    section 4. Check platform docs before relying on them.

## Working notes that saved time
- Seeded bot runner: `node tools/bot-runner.js all --tier bramble --seeds 30`
  (about 1.5 minutes for all 10 levels; `--leaks` lists leaks by wave and type,
  `--set hp=1.1,lives=15` overrides a tier for a sweep, `--engine <file>` swaps in
  another `game-state.js` to compare engines on identical seeds).
- Balance method: run 10 or more isolated bot runs per level (scratchpad `l4bot.js`
  pattern) and look at the leak type before changing numbers: a constant leak of one
  enemy type is either a damage ceiling or a coverage gap. A boss leak costs 5 lives.
- Test at 1x device pixel ratio; at 2x software rendering takes seconds per frame.
- Republishing the artifact: rebuild `briar-bastion.html` from `index.html` by
  stripping the doctype, html, head, body and meta tags, then pass the changed
  `js/*.js` files in `files` with `overwrite_unread`.
- Writing preferences from the user: no Oxford commas, no em dashes, short
  sentences, no hype.
