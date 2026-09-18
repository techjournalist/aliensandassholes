// Headless critic harness for Briar & Bastion. See tools/README.md.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const fs = require('fs');
const path = require('path');
const THREE_LOCAL = process.env.THREE_LOCAL || path.join(__dirname, '..', 'node_modules/three/build/three.min.js');
const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?debug=1';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) failures++;
}

async function makeContext(browser, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.route('**/three.min.js', (route) => route.fulfill({ path: THREE_LOCAL, contentType: 'application/javascript' }));
  return ctx;
}
function watch(page, log) {
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.push(`[console.${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => log.push(`[pageerror] ${e.message}`));
}
// Screen position of a grid cell's center, found through the page's own picking.
async function cellToScreen(page, c, r) {
  return page.evaluate(([c, r]) => {
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < innerHeight; y += 3) for (let x = 0; x < innerWidth; x += 3) {
      const cell = Renderer.screenToCell(x, y);
      if (cell && cell.c === c && cell.r === r) { sx += x; sy += y; n++; }
    }
    return n ? [sx / n, sy / n] : null;
  }, [c, r]);
}
const S = (page) => page.evaluate(() => ({
  gold: GameState.state.gold, lives: GameState.state.lives, wave: GameState.state.wave,
  selected: GameState.state.selected, towers: GameState.state.towers.length,
  enemies: GameState.state.enemies.length, waveActive: GameState.state.waveActive,
}));
const simulate = (page, seconds) => page.evaluate((sec) => { for (let i = 0; i < sec * 60; i++) GameState.update(1 / 60); }, seconds);

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const log = [];

  // ---------------- Desktop, mouse ----------------
  let ctx = await makeContext(browser, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  let page = await ctx.newPage();
  watch(page, log);
  await page.goto(PAGE);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/desktop.png` });
  console.log('DEBUG OVERLAY: ' + (await page.locator('#debug').innerText()).replace(/\n/g, ' | '));
  const baselineCalls = await page.evaluate(() => Renderer.stats().calls);

  // M1 regression: tile rules, drag, resize
  let [x, y] = await cellToScreen(page, 6, 6);
  await page.mouse.click(x, y); await page.waitForTimeout(120);
  check('road tile rejected', (await page.locator('#toast').innerText()).includes('road'));
  [x, y] = await cellToScreen(page, 8, 2);
  await page.mouse.click(x, y); await page.waitForTimeout(120);
  check('stream tile rejected', (await page.locator('#toast').innerText()).includes('stream'));
  [x, y] = await cellToScreen(page, 1, 8);
  await page.mouse.click(x, y); await page.waitForTimeout(120);
  check('far tile rejected', (await page.locator('#toast').innerText()).includes('Too far'));
  [x, y] = await cellToScreen(page, 6, 6);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 60, y + 30, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(80);
  check('drag is not a tap', (await S(page)).selected === null);

  // M2: place a Slinger with the mouse
  [x, y] = await cellToScreen(page, 6, 5);
  await page.mouse.click(x, y); await page.waitForTimeout(200);
  let st = await S(page);
  check('buildable tile selected', st.selected && st.selected.kind === 'tile' && st.selected.c === 6);
  check('build panel visible', await page.locator('#panel').isVisible());
  check('build button enabled at 150 gold', await page.locator('.build-btn').isEnabled());
  await page.locator('.build-btn').click(); await page.waitForTimeout(250);
  st = await S(page);
  check('tower placed by mouse', st.towers === 1 && st.gold === 80, `towers=${st.towers} gold=${st.gold}`);
  check('placed tower becomes selection', st.selected && st.selected.kind === 'tower');
  check('tower panel shows name', (await page.locator('#panel').innerText()).includes('Sprout Slinger'));
  await page.screenshot({ path: `${OUT}/placed.png` });
  const [gx, gy] = await cellToScreen(page, 6, 5);
  await page.screenshot({ path: `${OUT}/slinger-zoom.png`, clip: { x: gx - 90, y: gy - 130, width: 180, height: 180 } });

  // tapping the tower again re-selects it; tapping empty ground clears
  await page.mouse.click(x, y); await page.waitForTimeout(120);
  check('tap on tower selects tower', (await S(page)).selected.kind === 'tower');
  await page.mouse.click(5, 715); await page.waitForTimeout(150);
  st = await S(page);
  check('tap outside the valley clears selection', st.selected === null);
  // CSS transitions run slow under software rendering, so poll instead of a fixed wait
  const hidden = await page.waitForFunction(() => getComputedStyle(document.getElementById('panel')).visibility === 'hidden', null, { timeout: 5000 }).then(() => true).catch(() => false);
  check('panel hidden with no selection', hidden);

  // a second tower leaves 10 gold: third spot shows a disabled button
  [x, y] = await cellToScreen(page, 10, 5);
  await page.mouse.click(x, y); await page.waitForTimeout(150);
  await page.locator('.build-btn').click(); await page.waitForTimeout(150);
  st = await S(page);
  check('second tower placed', st.towers === 2 && st.gold === 10);
  [x, y] = await cellToScreen(page, 12, 4);
  await page.mouse.click(x, y); await page.waitForTimeout(150);
  check('build button disabled when broke', !(await page.locator('.build-btn').isEnabled()));
  check('placeTower refuses when broke', !(await page.evaluate(() => GameState.placeTower('slinger').ok)));
  check('tower on occupied tile refused', await page.evaluate(() => { GameState.selectTile(6, 5); return GameState.state.selected.kind === 'tower'; }));

  // wave: start, watch goblins walk, let them all leak
  await page.locator('#wave-btn').click(); await page.waitForTimeout(200);
  st = await S(page);
  check('wave 1 started from button', st.waveActive && st.wave === 1);
  check('wave button disabled during wave', !(await page.locator('#wave-btn').isEnabled()));
  await simulate(page, 9);
  await page.waitForTimeout(150);
  const mid = await page.evaluate(() => GameState.state.enemies.map((e) => ({ id: e.id, dist: +e.dist.toFixed(2), x: +e.x.toFixed(2), z: +e.z.toFixed(2) })));
  check('goblins spawned and spread along the road', mid.length >= 5 && mid[0].dist > 8, JSON.stringify(mid.slice(0, 3)));
  const onRoad = await page.evaluate(() => GameState.state.enemies.every((e) => {
    let best = Infinity;
    for (const [c, r] of GameState.pathCells) best = Math.min(best, Math.hypot(GameState.worldX(c) - e.x, GameState.worldZ(r) - e.z));
    return best < 0.55;
  }));
  check('every goblin stays on the road', onRoad);
  await page.screenshot({ path: `${OUT}/wave.png` });
  console.log('draw calls mid-wave with ' + mid.length + ' goblins: ' + await page.evaluate(() => Renderer.stats().calls));
  const lead = mid[0];
  const [lx, ly] = await page.evaluate(([ex, ez]) => {
    let bx = 0, by = 0, bd = Infinity;
    for (let y = 0; y < innerHeight; y += 2) for (let x = 0; x < innerWidth; x += 2) {
      const c = Renderer.screenToCell(x, y);
      if (!c) continue;
      const d = Math.hypot(GameState.worldX(c.c) - ex, GameState.worldZ(c.r) - ez);
      if (d < bd) { bd = d; bx = x; by = y; }
    }
    return [bx, by];
  }, [lead.x, lead.z]);
  await page.screenshot({ path: `${OUT}/goblin-zoom.png`, clip: { x: lx - 90, y: ly - 110, width: 180, height: 160 } });
  await simulate(page, 45);
  await page.waitForTimeout(4000);   // let exit animations and puffs finish (headless frames are slow)
  st = await S(page);
  check('all goblins walked the full path and leaked', st.enemies === 0 && st.lives === 14, `lives=${st.lives} enemies=${st.enemies}`);
  check('wave ended, button re-armed for wave 2', !st.waveActive && (await page.locator('#wave-btn').innerText()).includes('wave 2'));
  check('leak toast fired', (await page.locator('#toast').innerText()).length > 0);
  const callsAfter = await page.evaluate(() => Renderer.stats().calls);
  const views = await page.evaluate(() => Renderer.debugViews());
  check('leaked goblin views are removed', views.enemyViews === 0 && views.dying.length === 0, JSON.stringify(views));
  check('draw calls back near baseline with 2 towers', callsAfter < baselineCalls + 50, `baseline=${baselineCalls} after=${callsAfter}`);
  console.log('DEBUG OVERLAY (after wave): ' + (await page.locator('#debug').innerText()).replace(/\n/g, ' | '));

  await page.setViewportSize({ width: 900, height: 600 });
  await page.waitForTimeout(250);
  const cv = await page.evaluate(() => { const c = document.getElementById('game'); return [c.width, c.height]; });
  check('canvas follows resize', cv[0] === 900 && cv[1] === 600);
  await ctx.close();

  // ---------------- Mobile, touch ----------------
  ctx = await makeContext(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page = await ctx.newPage();
  watch(page, log);
  await page.goto(PAGE);
  await page.waitForTimeout(1500);
  check('portrait shows rotate overlay', await page.locator('#rotate').isVisible());
  await page.screenshot({ path: `${OUT}/mobile-portrait.png` });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  check('landscape hides rotate overlay', !(await page.locator('#rotate').isVisible()));
  [x, y] = await cellToScreen(page, 9, 5);
  await page.touchscreen.tap(x, y); await page.waitForTimeout(200);
  st = await S(page);
  check('touch tap selects tile', st.selected && st.selected.kind === 'tile' && st.selected.c === 9);
  const bb = await page.locator('.build-btn').boundingBox();
  check('build button is at least 44px tall', bb && bb.height >= 44, `h=${bb && bb.height}`);
  await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(250);
  st = await S(page);
  check('tower placed by touch', st.towers === 1 && st.gold === 80);
  const wb = await page.locator('#wave-btn').boundingBox();
  check('wave button is at least 44px tall', wb && wb.height >= 44);
  await page.touchscreen.tap(wb.x + wb.width / 2, wb.y + wb.height / 2); await page.waitForTimeout(150);
  check('wave started by touch', (await S(page)).waveActive);
  await simulate(page, 7);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/mobile-landscape.png` });
  console.log('MOBILE DEBUG: ' + (await page.locator('#debug').innerText()).replace(/\n/g, ' | '));
  await ctx.close();

  await browser.close();
  check('no console errors or warnings', log.length === 0);
  log.forEach((l) => console.log('  ' + l));
  console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('HARNESS FAILURE', e); process.exit(1); });
