// ===================================================================
// Input  (Pointer Events: mouse and touch share one path, handleTap)
//   A short press with little movement is a tap (place or select).
//   Dragging pans the view when it is zoomed in, two fingers pinch to zoom
//   and the wheel (or a trackpad pinch) zooms toward the pointer.
// ===================================================================
const Input = (() => {
  let down = null, lastTap = -1e9;
  const TAP_SLOP = 12;   // px of movement still counted as a tap
  const pts = new Map(); // every pointer currently pressed: id -> { x, y }
  let pinchDist = 0, dragging = false;

  const playing = () => GameState.state.phase === 'playing';

  function handleTap(x, y) {
    const cell = Renderer.screenToCell(x, y);
    if (!cell) return null;
    return GameState.selectTile(cell.c, cell.r);
  }

  function pair() {
    const [a, b] = [...pts.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  function init(canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      Audio.unlock();
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { down = { x: e.clientX, y: e.clientY, id: e.pointerId }; dragging = false; }
      else { down = null; pinchDist = pts.size === 2 ? pair().d : 0; }   // a second finger makes it a pinch, never a tap
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ } }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      const before = pts.size === 2 ? pair() : null;
      p.x = e.clientX; p.y = e.clientY;
      if (!playing()) return;
      if (pts.size === 2 && before && pinchDist > 0) {
        const now = pair();
        Renderer.zoomAt(now.d / pinchDist, now.cx, now.cy);
        Renderer.panBy(now.cx - before.cx, now.cy - before.cy);
        pinchDist = now.d;
      } else if (pts.size === 1 && down && down.id === e.pointerId) {
        if (!dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_SLOP) dragging = true;
        if (dragging) Renderer.panBy(dx, dy);
      }
    });
    const release = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinchDist = 0;
    };
    canvas.addEventListener('pointerup', (e) => {
      release(e);
      if (!down || down.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved <= TAP_SLOP) { lastTap = performance.now(); handleTap(e.clientX, e.clientY); }
    });
    canvas.addEventListener('pointercancel', (e) => { release(e); down = null; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!playing()) return;
      // a trackpad pinch arrives as a wheel with ctrlKey and small steps
      const k = e.deltaMode === 1 ? 0.05 : e.ctrlKey ? 0.01 : 0.0015;
      Renderer.zoomAt(Math.exp(-e.deltaY * k), e.clientX, e.clientY);
    }, { passive: false });
    // arrow keys look around while zoomed in (held keys repeat)
    window.addEventListener('keydown', (e) => {
      if (!playing()) return;
      const step = { ArrowLeft: [48, 0], ArrowRight: [-48, 0], ArrowUp: [0, 48], ArrowDown: [0, -48] }[e.key];
      if (step && Renderer.zoomLevel() > 1.001) { e.preventDefault(); Renderer.panBy(step[0], step[1]); }
    });
  }

  return { init, handleTap, lastTapAt: () => lastTap };
})();
