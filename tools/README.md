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
is read from. The game itself has no dependencies and no build step.
