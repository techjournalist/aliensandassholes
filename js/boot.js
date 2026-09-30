// ===================================================================
// Boot
// ===================================================================
(function boot() {
  if (!window.THREE) {
    document.getElementById('load-error').classList.add('show');
    return;
  }
  let activeId = null;
  try { activeId = sessionStorage.getItem('bb-active-level'); } catch (e) { /* storage may be blocked */ }
  const level = LEVELS.find((l) => l.id === activeId) || LEVELS[0];
  GameState.loadLevel(level);

  const canvas = document.getElementById('game');
  Renderer.init(canvas);
  Input.init(canvas);
  UI.init();
  Audio.init();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const gdt = dt * GameState.state.speed;
    // fast-forward in small fixed steps (at most 1/60 s, the size the tests use),
    // so 4x plays the same battle as 1x, only sooner, and never one big jump
    for (let left = gdt; left > 1e-6;) { const step = Math.min(left, 1 / 60); GameState.update(step); left -= step; }
    Renderer.render(GameState.state.time, GameState.state.paused ? 0 : gdt);
    UI.frame(dt);
    Audio.update(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
