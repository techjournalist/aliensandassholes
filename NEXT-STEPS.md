# Next steps (handoff for a new chat)

Written 2026-10-07 at the end of a long session. Branch: `graphics-pass-units-tiers`
(all work is committed and pushed; nothing is merged to `main`). Playable build:
artifact `https://claude.ai/artifact/TGe33pgijELWBrzFao13TR` (version 14).
Read `AGENTS.md` first, then the file named in each item below.

## State of the game
- 10 levels, each with a finale boss except Level 2. Levels 9 and 10 (the dawn
  levels) use `curvyRoads` and `js/dawn-kit.js`.
- Diorama look: sRGB + ACES color pipeline, toon lighting patch, violet baked cast
  shadows, softer glow, haze gradient, resolution governor (AGENTS.md P3-V11).
- World map has a bridge where roads cross (hills, mountain shadows and a river
  bridge were tried and reverted at the user's request; do not redo them).
- Tests: `node tools/validate-levels.js` always passes. The full
  `tools/playtest.js` loses Level 6's bot check at random, which locks Levels 7 to
  10 by cascade (known). Run the dawn levels directly with the scratchpad scripts
  or all levels unlocked. Needs `THREE_LOCAL=<path to three.min.js r128>`.

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
4. **Difficulty tiers: Meadow and Bramble.** `ENDLESS-MODE.md` section 1. Moderate:
   about 1 to 2 hours of code, about half a day of bot tuning across 10 levels.
5. **Endless mode, then the daily run.** `ENDLESS-MODE.md` sections 2 and 3.
6. **New enemies:** Spore-Medic, Sapper, Digger (one each for Levels 8, 9 and 10).
   Pod-Bearer and Magpie were dropped by the user. `ENDLESS-MODE.md` section 7.
7. **Curving roads on Levels 1 to 8.** The `curvyRoads` flag is ready; each level
   needs its waves retuned afterward because the curve shortens the path and shifts
   tower coverage. The user clearly likes curved roads.
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
- Balance method: run 10 or more isolated bot runs per level (scratchpad `l4bot.js`
  pattern) and look at the leak type before changing numbers: a constant leak of one
  enemy type is either a damage ceiling or a coverage gap. A boss leak costs 5 lives.
- Test at 1x device pixel ratio; at 2x software rendering takes seconds per frame.
- Republishing the artifact: rebuild `briar-bastion.html` from `index.html` by
  stripping the doctype, html, head, body and meta tags, then pass the changed
  `js/*.js` files in `files` with `overwrite_unread`.
- Writing preferences from the user: no Oxford commas, no em dashes, short
  sentences, no hype.
