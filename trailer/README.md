# Gameplay trailer

A ~86 second gameplay trailer for Aliens & Assholes, built from real game
footage. Nothing here is loaded by the game.

1. `capture/shoot.js` opens the game (check out `claude/brave-edison-piloye`, the branch with the alien levels, first) in headless
   Chromium, stages each shot with the game's own API (`capture/shots.js`) and
   saves one JPEG per frame into `remotion/public/shots/`. A virtual clock
   (`capture/vclock.js`) steps the game exactly 1/30 s per frame, so slow
   software rendering never shows as stutter.
   Run from the repo root after `npm i --no-save three@0.128.0`:
   `node trailer/capture/shoot.js all` (or a comma list of shot ids).
2. `vo/lines.json` is the narration script. `vo/gen.py` voices it with the
   open Kokoro TTS model (`am_michael`), `vo/music.py` synthesizes the score.
   Copy the WAVs to `remotion/public/audio/`.
3. `remotion/` is the edit: `src/timeline.ts` holds shot order, narration
   timing and captions. Render with
   `cd trailer/remotion && npm i && npx remotion render Trailer out/trailer.mp4`.
