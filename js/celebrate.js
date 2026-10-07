// ===================================================================
// Celebrate: the win-screen show. Confetti cannons, a drizzle of paper
// and gold fireworks on one 2D canvas behind the end card. Visual only:
// it never touches GameState, uses its own random stream (the balance
// tests seed Math.random) and stops by itself the moment #end hides.
//   start({ mode: 'win' | 'finale', stars, onBurst })   stop()
// ===================================================================
const Celebrate = (() => {
  let parts = [], raf = 0, running = false;
  let mode = 'win', stars = 0, onBurst = null;
  let w = 0, h = 0, dpr = 1, t = 0, last = 0, nextBurst = 0, nextRain = 0, scheduled = [];
  let colors = ['#f2c14e', '#6fae4a', '#c861e0', '#f6ecd4', '#ff8fb3', '#7fd4ff'];
  let seed = (Date.now() % 100000) | 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const between = (a, b) => a + (b - a) * rnd();
  const MAX = 340;

  function readColors() {
    try {
      const cs = getComputedStyle(document.documentElement);
      const get = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
      colors = [get('--gold', '#f2c14e'), get('--moss', '#6fae4a'), get('--magic', '#c861e0'), get('--cream', '#f6ecd4'), '#ff8fb3', '#7fd4ff'];
    } catch (e) { /* keep the defaults */ }
  }
  function canvas() { return document.getElementById('celebrate'); }
  function resize() {
    const c = canvas(); if (!c) return false;
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    w = c.clientWidth; h = c.clientHeight;
    c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
    return w > 0 && h > 0;
  }
  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  // ---- particle makers ----
  function paper(x, y, vx, vy, color) {
    if (parts.length >= MAX) return;
    parts.push({ k: 'p', x, y, vx, vy, w: between(6, 11), h: between(9, 16), rot: rnd() * 6.28, vr: between(-7, 7), flip: rnd() * 6.28, color: color || colors[(rnd() * colors.length) | 0], life: between(3.2, 5.2), age: 0 });
  }
  function cannon(x, y, angle, n) {   // angle in radians from straight up, positive leans right
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + angle + between(-0.42, 0.42), sp = between(380, 900) * Math.min(1.15, Math.max(0.7, h / 700));
      paper(x, y, Math.cos(a) * sp, Math.sin(a) * sp);
    }
  }
  function rain(n) { for (let i = 0; i < n; i++) paper(between(0, w), -12, between(-40, 40), between(60, 180)); }
  function firework(x, y, color, n = 58) {
    const hue = color || colors[(rnd() * colors.length) | 0], scale = Math.min(1.25, Math.max(0.6, Math.min(w, h) / 560));
    for (let i = 0; i < n; i++) {
      if (parts.length >= MAX + 120) break;
      const a = (i / n) * 6.28 + rnd() * 0.2, sp = between(150, 370) * scale;
      parts.push({ k: 's', x, y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color: hue, life: between(1.0, 1.7), age: 0 });
    }
    parts.push({ k: 'f', x, y, color: hue, life: 0.22, age: 0 });   // a quick flash
    if (onBurst) { try { onBurst(); } catch (e) { /* sound is optional */ } }
  }
  const at = (time, fn) => scheduled.push({ time, fn });
  // Where a burst goes: in the open sky on either side of the card on wide
  // screens, anywhere in the upper part on narrow ones (the card covers most).
  function sky() {
    const y = between(h * 0.1, h * 0.52);
    if (w < 900) return [between(w * 0.1, w * 0.9), y];
    const side = rnd() < 0.5 ? 0 : 1, margin = Math.max(120, (w - 700) / 2);
    return [side ? w - between(margin * 0.25, margin * 0.8) : between(margin * 0.25, margin * 0.8), y];
  }

  // ---- the show ----
  function begin() {
    parts = []; scheduled = []; t = 0; nextBurst = 1.1; nextRain = 0.4;
    cannon(w * 0.04, h * 0.98, 0.5, 70); cannon(w * 0.96, h * 0.98, -0.5, 70);
    at(0.25, () => rain(36));
    if (mode === 'win') {
      // a 3-star win earns fireworks too, one per star
      for (let i = 0; i < stars; i++) at(0.9 + i * 0.7, () => { const [x, y] = sky(); firework(x, y, colors[0]); });
      if (stars === 3) { at(2.4, () => cannon(w * 0.3, h * 0.98, 0.15, 40)); at(2.4, () => cannon(w * 0.7, h * 0.98, -0.15, 40)); }
    } else {
      at(0.6, () => { const [x, y] = sky(); firework(x, y, colors[0], 66); });
      at(1.6, () => { cannon(w * 0.25, h * 0.98, 0.25, 50); cannon(w * 0.75, h * 0.98, -0.25, 50); });
    }
  }

  function step(dt, ctx) {
    t += dt;
    for (let i = scheduled.length - 1; i >= 0; i--) if (t >= scheduled[i].time) { const s = scheduled.splice(i, 1)[0]; s.fn(); }
    if (mode === 'finale') {
      if (t >= nextBurst) { const [x, y] = sky(); firework(x, y, colors[(rnd() * 4) | 0]); nextBurst = t + between(0.45, 0.95); }
      if (t >= nextRain) { rain(4); nextRain = t + 0.3; }
    }
    ctx.clearRect(0, 0, w, h);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life) { parts.splice(i, 1); continue; }
      if (p.k === 'p') {
        p.vy += 520 * dt; p.vx *= 1 - 1.5 * dt; p.vy *= 1 - 0.9 * dt;
        if (p.vy > 230) p.vy = 230 + (p.vy - 230) * 0.9;     // paper floats down, it doesn't fall
        p.x += (p.vx + Math.sin(p.age * 5 + p.flip) * 26) * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt; p.flip += 9 * dt;
        if (p.y > h + 20) { parts.splice(i, 1); continue; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.flip));
        ctx.globalAlpha = Math.min(1, (p.life - p.age) * 1.5);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      } else if (p.k === 's') {
        p.px = p.x; p.py = p.y;
        p.vy += 210 * dt; p.vx *= 1 - 1.7 * dt; p.vy *= 1 - 1.7 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const a = Math.max(0, 1 - p.age / p.life);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.px - p.vx * 0.02, p.py - p.vy * 0.02); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      } else {   // flash
        const a = 1 - p.age / p.life, r = 24 + 70 * (p.age / p.life);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.55; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.28); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    const end = document.getElementById('end');
    if (!end || !end.classList.contains('show')) { stop(); return; }
    const c = canvas(); if (!c) { stop(); return; }
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    step(dt, ctx);
    // a normal win ends when the last paper has landed; the finale keeps going
    if (mode === 'win' && !parts.length && !scheduled.length && t > 1) { stop(); return; }
    raf = requestAnimationFrame(frame);
  }

  function start(opts = {}) {
    stop();
    if (reduced()) return;
    mode = opts.mode === 'finale' ? 'finale' : 'win'; stars = opts.stars | 0; onBurst = opts.onBurst || null;
    readColors();
    if (!resize()) return;
    begin();
    running = true; last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false; parts = []; scheduled = [];
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    const c = canvas();
    if (c) { const ctx = c.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); }
  }
  window.addEventListener('resize', () => { if (running) resize(); });

  return { start, stop, get running() { return running; } };
})();
