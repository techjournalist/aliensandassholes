// ===================================================================
// Input  (Pointer Events: mouse and touch share one path, handleTap)
// ===================================================================
const Input = (() => {
  let down = null, lastTap = -1e9;
  const TAP_SLOP = 12;   // px of movement still counted as a tap

  function handleTap(x, y) {
    const cell = Renderer.screenToCell(x, y);
    if (!cell) return null;
    return GameState.selectTile(cell.c, cell.r);
  }

  function init(canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      Audio.unlock();
      down = { x: e.clientX, y: e.clientY, id: e.pointerId };
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ } }
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!down || down.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved <= TAP_SLOP) { lastTap = performance.now(); handleTap(e.clientX, e.clientY); }
    });
    canvas.addEventListener('pointercancel', () => { down = null; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  return { init, handleTap, lastTapAt: () => lastTap };
})();
