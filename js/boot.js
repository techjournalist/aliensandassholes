// ===================================================================
// Boot
// ===================================================================
(function boot() {
  if (!window.THREE) {
    document.getElementById('load-error').classList.add('show');
    return;
  }
  let activeId = null;
  try { activeId = sessionStorage.getItem('aa-active-level'); } catch (e) { /* storage may be blocked */ }
  // a level switch also writes the id into the hash (see UI's level switch)
  const hashId = location.hash.replace(/^#/, '').replace(/-go$/, '');
  if (LEVELS.some((l) => l.id === hashId)) activeId = hashId;
  const level = LEVELS.find((l) => l.id === activeId) || LEVELS[0];
  // the difficulty tier the player last picked on the world map (Meadow by default)
  try { GameState.setDifficulty(Progress.tier()); } catch (e) { /* stay on Meadow */ }
  GameState.loadLevel(level);

  const canvas = document.getElementById('game');
  Renderer.init(canvas);
  Input.init(canvas);
  UI.init();
  Audio.init();

  // Frame-rate safety net: if frames stay slow on a device, step the render
  // resolution down a little (never below 0.6x) instead of dropping any
  // effect, so desktop and phone keep the same look. Off for automated tests
  // (software rendering is always slow) and with ?gov=0.
  const governor = !navigator.webdriver && !/[?&]gov=0\b/.test(location.search);
  let govSlow = 0, govFast = 0;
  let last = performance.now();
  // A thrown error inside one frame must not stop the loop (a frozen
  // battlefield looks like a level that never loaded): report it once on
  // screen and keep going.
  let reported = false;
  function report(err) {
    if (reported) return; reported = true;
    console.error(err);
    const el = document.getElementById('run-error');
    if (el) { el.querySelector('code').textContent = String(err && (err.stack || err.message) || err).split('\n').slice(0, 3).join('\n'); el.classList.add('show'); }
  }
  window.addEventListener('error', (e) => report(e.error || e.message));
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); report('The graphics context was lost. Reload the page to continue.'); });
  function frame(now) {
    try { step(now); } catch (err) { report(err); }
    requestAnimationFrame(frame);
  }
  function step(now) {
    const raw = now - last;
    const dt = Math.min(0.05, raw / 1000);
    last = now;
    if (governor && raw < 250 && !GameState.state.paused && GameState.state.phase === 'playing') {
      if (raw > 38) { govSlow++; govFast = 0; } else if (raw < 24) { govFast++; govSlow = Math.max(0, govSlow - 1); } else govSlow = Math.max(0, govSlow - 1);
      if (govSlow > 90) { Renderer.setPixelScale(Renderer.pixelScale() - 0.1); govSlow = 0; }
      else if (govFast > 900) { Renderer.setPixelScale(Renderer.pixelScale() + 0.1); govFast = 0; }
    }
    const gdt = dt * GameState.state.speed;
    // fast-forward in small fixed steps (at most 1/60 s, the size the tests use),
    // so 4x plays the same battle as 1x, only sooner, and never one big jump
    // 8x can ask for 24 steps a frame; on a slow device stop after about 30 ms of
    // stepping and let the game run a little under 8x rather than freeze the page
    const t0 = performance.now();
    for (let left = gdt; left > 1e-6;) {
      const step = Math.min(left, 1 / 60); GameState.update(step); left -= step;
      if (performance.now() - t0 > 30) break;
    }
    Renderer.render(GameState.state.time, GameState.state.paused ? 0 : gdt);
    UI.frame(dt);
    Audio.update(dt);
  }
  requestAnimationFrame(frame);
})();
