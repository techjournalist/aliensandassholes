// Injected before the game loads: a virtual clock. The game's rAF callbacks,
// timers, performance.now and Date.now all run on time we advance by hand,
// so each captured frame is exactly 1/FPS of game time.
(() => {
  let vt = 0; const t0 = Date.now();
  const realRaf = window.requestAnimationFrame.bind(window);
  let rafQ = [], rafId = 1;
  let timers = [], timerId = 1;
  performance.now = () => vt;
  const RealDate = Date;
  Date.now = () => t0 + vt;
  window.requestAnimationFrame = (cb) => { const id = rafId++; rafQ.push({ id, cb }); return id; };
  window.cancelAnimationFrame = (id) => { rafQ = rafQ.filter((r) => r.id !== id); };
  window.setTimeout = (cb, ms = 0, ...a) => { const id = timerId++; timers.push({ id, at: vt + (ms || 0), cb, a }); return id; };
  window.clearTimeout = (id) => { timers = timers.filter((t) => t.id !== id); };
  window.setInterval = (cb, ms = 0, ...a) => { const id = timerId++; const tick = () => { cb(...a); const t = timers.find((x) => x.id === id); }; timers.push({ id, at: vt + ms, cb, a, every: Math.max(1, ms) }); return id; };
  window.clearInterval = window.clearTimeout;
  function runTimers() {
    for (let guard = 0; guard < 1000; guard++) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0]; if (!t || t.at > vt) break;
      if (t.every) t.at += t.every; else timers.shift();
      try { typeof t.cb === 'function' ? t.cb(...t.a) : null; } catch (e) { console.error(e); }
    }
  }
  window.__advance = (ms, steps = 1) => {
    for (let s = 0; s < steps; s++) {
      vt += ms / steps;
      runTimers();
      const q = rafQ; rafQ = [];
      for (const r of q) { try { r.cb(vt); } catch (e) { console.error(e); } }
    }
    if (window.__onAdvance) window.__onAdvance(vt);
    // CSS/Web animations follow virtual time too
    for (const a of document.getAnimations()) {
      try {
        if (!a.__vstart) { a.__vstart = vt - (a.currentTime || 0); a.pause(); }
        a.currentTime = vt - a.__vstart;
      } catch (e) {}
    }
    return vt;
  };
  window.__vt = () => vt;
})();
