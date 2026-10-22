// ===================================================================
// Boot
// ===================================================================
(function boot() {
  if (!window.THREE) {
    document.getElementById('load-error').classList.add('show');
    return;
  }
  let activeId = null;
  try { activeId = sessionStorage.getItem('kk-active-level'); } catch (e) { /* storage may be blocked */ }
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
    GameState.update(gdt);
    Renderer.render(GameState.state.time, GameState.state.paused ? 0 : gdt);
    UI.frame(dt);
    Audio.update(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
