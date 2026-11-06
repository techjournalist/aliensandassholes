// Frame-stepped gameplay capture for the trailer.
// node shoot.js <shotId|all> [--stills] [--from N]
// Each shot loads the game fresh, stages a moment with the game's own API,
// then advances a virtual clock 1/30 s per frame and saves a JPEG per frame.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const GAME = path.resolve(__dirname, '../..');
const FIX = require(GAME + '/tools/level-fixtures.js');
const SHOTS = require('./shots.js');
const FPS = 30, W = 1920, H = 1080;
const OUT = path.join(__dirname, '..', 'remotion', 'public', 'shots');

// In-page helpers, installed after the game boots.
const LIB = () => {
  const G = GameState, S = GameState.state;
  const T = window.T = {
    sim(sec) { for (let i = 0; i < sec * 60; i++) G.update(1 / 60); },
    put(type, c, r, tier = 1, branch) {
      const g0 = S.gold; S.gold = 99999;
      S.selected = { kind: 'tile', c, r }; const res = G.placeTower(type);
      if (!res.ok) { S.gold = g0; console.error('put failed', type, c, r, res.reason); return null; }
      const t = res.tower;
      if (tier >= 2) G.upgradeTower(t.id);
      if (tier >= 3) G.upgradeTower(t.id, branch || Object.keys(G.BRANCHES[type])[0]);
      S.gold = g0; G.clearSelection(); G.emit('goldChanged', S.gold);
      return t;
    },
    // place towers from the fixture's build spots and plan
    army(spots, plan, n, tier = 1, branches) {
      for (let i = 0; i < Math.min(n, spots.length); i++) {
        const type = plan[i % plan.length];
        const br = branches ? branches[type] : undefined;
        T.put(type, spots[i][0], spots[i][1], tier, br);
      }
    },
    gold(n) { S.gold = n; G.emit('goldChanged', n); },
    wave(n) { // start wave n
      S.waveActive = false; S.wave = n - 1; G.startWave();
    },
    screenXZ(x, z) { const p = Renderer.worldToScreen(x, 0, z); return [p.x, p.y]; },
    focusXZ(x, z, zoom = 1.6) {
      Renderer.resetLook(); T.settle();
      let [sx, sy] = T.screenXZ(x, z); Renderer.zoomAt(zoom, sx, sy); T.settle();
      [sx, sy] = T.screenXZ(x, z); Renderer.panBy(innerWidth / 2 - sx, innerHeight / 2 - sy); T.settle();
    },
    // ease the camera toward an enemy (or any {x,z}) each frame
    follow(e, k = 0.08, ox = 0, oy = 0) { if (!e || !S.enemies.includes(e)) return; const [sx, sy] = T.screenXZ(e.x, e.z); Renderer.panBy((innerWidth / 2 + ox - sx) * k, (innerHeight / 2 + oy - sy) * k); },
    screenOf(c, r) { const p = Renderer.worldToScreen(G.worldX(c), 0, G.worldZ(r)); return [p.x, p.y]; },
    // aim the camera at a cell with a zoom; `snap` jumps there at once
    focus(c, r, zoom = 1.6) {
      Renderer.resetLook();
      T.settle();
      let [sx, sy] = T.screenOf(c, r);
      Renderer.zoomAt(zoom, sx, sy);
      T.settle();
      [sx, sy] = T.screenOf(c, r);
      Renderer.panBy(innerWidth / 2 - sx, innerHeight / 2 - sy);
      T.settle();
    },
    // run the look easing to rest without moving game time
    settle() { const p = S.paused; S.paused = true; __advance(1200, 36); S.paused = p; },
    // slow push / drift per frame
    push(f) { Renderer.zoomAt(f); },
    pan(dx, dy) { Renderer.panBy(dx, dy); },
    // put the HUD into a running boss wave and replay the game's boss banner
    bossWave(n) { S.wave = n; S.waveActive = true; S.prep = 0; S.schedule = []; S.waveQueue = []; G.emit('waveStarted', n); UI.updateHud(); },
    bossIntro(name) { const b = document.getElementById('boss-intro'), v = document.getElementById('boss-vig'); document.getElementById('boss-intro-name').textContent = name; for (const el of [b, v]) { el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); } },
    hideUi(on = true) { document.getElementById('ui').style.visibility = on ? 'hidden' : ''; },
    enemy(type, route, dist) { const e = G.spawnEnemy(type, route); if (dist !== undefined) e.dist = dist; return e; },
  };
  // SMIL animations are very slow to rasterize in software; replace every one
  // with the same motion driven from the virtual clock
  const anims = [];
  document.querySelectorAll('animate, animateTransform').forEach((a) => {
    const el = a.parentNode; const dur = parseFloat(a.getAttribute('dur')) || 2; const begin = parseFloat(a.getAttribute('begin')) || 0;
    const vals = (a.getAttribute('values') || '').split(';').map((v) => v.trim().split(/[\s,]+/).map(Number));
    anims.push({ el, dur, begin, vals, attr: a.getAttribute('attributeName'), type: a.tagName === 'animateTransform' ? a.getAttribute('type') : null });
    a.remove();
  });
  window.__onAdvance = (vt) => {
    const t = vt / 1000;
    for (const s of anims) {
      if (s.vals.length < 2) continue;
      const k = ((((t - s.begin) / s.dur) % 1) + 1) % 1 * (s.vals.length - 1);
      const i = Math.min(s.vals.length - 2, Math.floor(k)), u = k - i;
      const v = s.vals[i].map((x, j) => x + ((s.vals[i + 1][j] ?? x) - x) * u);
      s.el.setAttribute(s.attr, s.type ? `${s.type}(${v.map((x) => x.toFixed(2)).join(' ')})` : v[0].toFixed(3));
    }
  };
};

async function shoot(browser, shot, stills) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.route('**/three.min.js', (r) => r.fulfill({ path: GAME + '/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await ctx.addInitScript({ path: path.join(__dirname, 'vclock.js') });
  await ctx.addInitScript(() => {
    const ids = ['greenhope', 'crater-rim', 'glowshroom-grove', 'comms-ridge', 'dune-sea', 'spaceport', 'glacier-shelf', 'bloomfruit', 'hive-front', 'terraformer-prime'];
    const levels = {}; ids.forEach((id, i) => { levels[id] = { unlocked: true, stars: i < 9 ? 3 - (i % 2) : 0, bestLives: 18, bramble: { stars: i < 3 ? 2 : 0, bestLives: null } }; });
    localStorage.setItem('aa-progress', JSON.stringify({ v: 1, levels, endless: {} }));
    for (const k of ['upgrade', 'flyers', 'build', 'send', 'speed']) localStorage.setItem('aa-coach-' + k, '1');
    localStorage.setItem('aa-guide-seen', '1'); localStorage.setItem('aa-gesture-hint', '1');
    localStorage.setItem('aa-muted', '1'); localStorage.setItem('aa-camui', '0');
    localStorage.setItem('aa-view', '0');
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  const hash = shot.title ? '' : `#${shot.level}-go`;
  await page.goto('file://' + GAME + '/index.html?gov=0' + hash);
  await page.waitForFunction(() => typeof GameState !== 'undefined' && typeof Renderer !== 'undefined');
  await page.evaluate(() => __advance(300, 10));
  await page.evaluate(LIB);
  await page.addStyleTag({ content: '#tip,#toast,#debug{display:none!important}' + (shot.css || '') });
  const fix = FIX[shot.level] || {};
  if (shot.setup) await page.evaluate(`(async (T, FIX) => { ${shot.setup} })(window.T, ${JSON.stringify(fix)})`);
  await page.evaluate((n) => __advance(n * 1000 / 30, n), shot.preroll ?? 6);
  const cdp = await ctx.newCDPSession(page);
  const dir = path.join(OUT, shot.id);
  fs.mkdirSync(dir, { recursive: true });
  const frames = Math.round(shot.sec * FPS);
  const picks = stills ? [0, Math.floor(frames / 2), frames - 1] : null;
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    await page.evaluate(`(() => { const T = window.T, i = ${i}, n = ${frames}; ${shot.frame || ''}; return __advance(1000 / 30, ${shot.substeps || 1}); })()`);
    if (picks && !picks.includes(i)) continue;
    const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });
    const name = stills ? path.join(__dirname, 'stills', `${shot.id}-${i}.jpg`) : path.join(dir, `f${String(i).padStart(4, '0')}.jpg`);
    fs.mkdirSync(path.dirname(name), { recursive: true });
    fs.writeFileSync(name, Buffer.from(r.data, 'base64'));
  }
  console.log(`${shot.id}: ${stills ? 'stills' : frames + ' frames'} in ${((Date.now() - t0) / 1000).toFixed(0)}s${errs.length ? '  ERRORS: ' + errs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}

(async () => {
  const which = process.argv[2] || 'all';
  const stills = process.argv.includes('--stills');
  const list = which === 'all' ? SHOTS : SHOTS.filter((s) => which.split(',').includes(s.id));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const s of list) {
    try { await shoot(browser, s, stills); } catch (e) { console.log(`${s.id}: FAILED ${e.message.split('\n')[0]}`); }
  }
  await browser.close();
})();
