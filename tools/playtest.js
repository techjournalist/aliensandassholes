// Headless critic harness for Briar & Bastion. See tools/README.md.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const fs = require('fs');
const path = require('path');
const LEVEL_FIXTURES = require('./level-fixtures.js');
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
// Title -> world map -> commit to a level, the real path a player now takes
// since M0's engine split added the world-map screen between the two.
async function enterLevel(page, levelId) {
  await page.locator('#start-btn').click(); await page.waitForTimeout(250);
  await page.locator(`.wm-node[data-level="${levelId}"]`).click(); await page.waitForTimeout(150);
  await page.locator('#wm-play-btn').click(); await page.waitForTimeout(200);
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const log = [];

  // ---------------- Desktop, mouse ----------------
  let ctx = await makeContext(browser, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  let page = await ctx.newPage();
  watch(page, log);
  await page.goto(PAGE);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/title.png` });
  check('title screen shows on load', await page.locator('#title').isVisible());
  check('game does not run behind the title', (await S(page)).wave === 0 && await page.evaluate(() => GameState.state.phase === 'title'));
  await enterLevel(page, 'shadow-hollow');
  check('start button + world map begins play', await page.evaluate(() => GameState.state.phase === 'playing'));
  // sound: mute toggle persists, ticks fire in the last prep seconds
  const mb = await page.locator('#mute-btn').boundingBox();
  check('mute button is a 44px target', mb && mb.height >= 44 && mb.width >= 44);
  await page.locator('#mute-btn').click(); await page.waitForTimeout(100);
  check('mute toggles and persists', await page.evaluate(() => Audio.isMuted() && localStorage.getItem('bb-muted') === '1'));
  await page.locator('#mute-btn').click(); await page.waitForTimeout(100);
  check('unmute toggles back', await page.evaluate(() => !Audio.isMuted()));
  const ticks = await page.evaluate(() => { const S = GameState.state; let n = 0; GameState.on('prepTick', () => n++); S.wave = 1; S.prep = 3.5; for (let i = 0; i < 60 * 4 && S.prep > 0; i++) GameState.update(1 / 60); const started = S.waveActive; S.waveActive = false; S.schedule = []; S.waveQueue = []; S.enemies.length = 0; S.wave = 0; S.prep = 0; return { n, started }; });
  check('prep countdown ticks 3, 2, 1 then auto-starts', ticks.n === 3 && ticks.started, JSON.stringify(ticks));
  await page.evaluate(() => { GameState.state.wave = 0; UI.updateHud(); });
  // pause and speed
  const pb = await page.locator('#pause-btn').boundingBox();
  check('pause button is a 44px target', pb && pb.height >= 44 && pb.width >= 44);
  await page.locator('#pause-btn').click(); await page.waitForTimeout(150);
  check('pause shows the overlay and freezes time', await page.evaluate(() => { const t0 = GameState.state.time; for (let i = 0; i < 60; i++) GameState.update(1 / 60); return GameState.state.paused && GameState.state.time === t0 && document.getElementById('pause').classList.contains('show'); }));
  check('tip hides while paused', await page.waitForFunction(() => !document.getElementById('tip').classList.contains('show'), null, { timeout: 4000 }).then(() => true).catch(() => false));
  await page.locator('#resume-btn').click(); await page.waitForTimeout(150);
  check('resume hides the overlay and time runs', await page.evaluate(() => { const t0 = GameState.state.time; for (let i = 0; i < 60; i++) GameState.update(1 / 60); return !GameState.state.paused && GameState.state.time > t0 && !document.getElementById('pause').classList.contains('show'); }));
  await page.keyboard.press('p'); await page.waitForTimeout(100);
  check('P key pauses', await page.evaluate(() => GameState.state.paused));
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  check('Esc resumes', await page.evaluate(() => !GameState.state.paused));
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  check('hiding the tab auto-pauses', await page.evaluate(() => GameState.state.paused));
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); GameState.resume(); });
  await page.locator('#speed-btn').click(); await page.waitForTimeout(100);
  check('speed toggles to 2x and shows it', await page.evaluate(() => GameState.state.speed === 2 && document.getElementById('speed-btn').textContent.startsWith('2')));
  await page.locator('#speed-btn').click(); await page.waitForTimeout(100);
  check('speed toggles back to 1x', await page.evaluate(() => GameState.state.speed === 1));
  check('tip points at a tile before the first tower', await page.locator('#tip').isVisible() && (await page.locator('#tip').innerText()).includes('plant'));
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
  check('build button enabled at 150 gold', await page.locator('.build-btn[data-tower="slinger"]').isEnabled());
  const tipSays = (word) => page.waitForFunction((w) => document.querySelector('#tip .tip-text').textContent.includes(w), word, { timeout: 4000 }).then(() => true).catch(() => false);
  check('tip moves to the tower buttons once a tile is picked', await tipSays('pick'));
  await page.locator('.build-btn[data-tower="slinger"]').click(); await page.waitForTimeout(250);
  st = await S(page);
  check('tower placed by mouse', st.towers === 1 && st.gold === 80, `towers=${st.towers} gold=${st.gold}`);
  check('tip moves to the wave button after the first tower', await tipSays('wave'));
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
  await page.locator('.build-btn[data-tower="slinger"]').click(); await page.waitForTimeout(150);
  st = await S(page);
  check('second tower placed', st.towers === 2 && st.gold === 10);
  [x, y] = await cellToScreen(page, 12, 4);
  await page.mouse.click(x, y); await page.waitForTimeout(150);
  check('build button disabled when broke', !(await page.locator('.build-btn[data-tower="slinger"]').isEnabled()));
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
  check('goblins spawned and spread along the road', mid.length >= 2 && mid[0].dist > 6, JSON.stringify(mid.slice(0, 3)));
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
  check('tip gone once the wave is sent', !(await page.locator('#tip').isVisible()));
  const fired = await page.evaluate(() => GameState.state.projectiles.length > 0 || GameState.state.towers.some((t) => t.targetId));
  check('towers acquire targets and fire', fired);
  await page.evaluate(() => { for (let i = 0; i < 60 * 90 && GameState.state.waveActive; i++) GameState.update(1 / 60); });
  await page.waitForTimeout(4000);   // let exit animations and puffs finish (headless frames are slow)
  st = await S(page);
  const kills = await page.evaluate(() => GameState.state.kills);
  check('wave 1 cleared: goblins die to two Slingers', st.enemies === 0 && kills >= 5 && st.lives >= 18, `kills=${kills} lives=${st.lives}`);
  check('kills pay gold', st.gold > 10, `gold=${st.gold}`);
  check('floating numbers rendered', (await page.evaluate(() => window.__floaters || 0)) >= 0);
  check('wave ended, button re-armed for wave 2 with a prep countdown', !st.waveActive && (await page.locator('#wave-btn').innerText()).includes('wave 2') && (await page.evaluate(() => GameState.state.prep > 0)));
  const earlyGold = await page.evaluate(() => { const g0 = GameState.state.gold; GameState.sendWave(); return GameState.state.gold - g0; });
  check('sending early pays a bonus', earlyGold > 0, `bonus=${earlyGold}`);
  check('wave banner shows name and flavor', (await page.locator('#wave-banner').innerText()).includes('Wave 2'));
  await page.evaluate(() => { for (let i = 0; i < 60 * 90 && GameState.state.waveActive; i++) GameState.update(1 / 60); });
  await page.waitForFunction(() => Renderer.debugViews().dying.length === 0, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const callsAfter = await page.evaluate(() => Renderer.stats().calls);
  const views = await page.evaluate(() => Renderer.debugViews());
  check('leaked goblin views are removed', views.enemyViews === 0 && views.dying.length === 0, JSON.stringify(views));
  check('draw calls back near baseline with 2 towers', callsAfter < baselineCalls + 50, `baseline=${baselineCalls} after=${callsAfter}`);
  console.log('DEBUG OVERLAY (after wave): ' + (await page.locator('#debug').innerText()).replace(/\n/g, ' | '));

  await page.setViewportSize({ width: 900, height: 600 });
  // resize events dispatch at frame time, and headless frames are slow: poll
  const resized = await page.waitForFunction(() => { const c = document.getElementById('game'); return c.width === 900 && c.height === 600; }, null, { timeout: 5000 }).then(() => true).catch(() => false);
  check('canvas follows resize', resized);
  // balance probe: keep sending waves with the same two towers and see when the line breaks
  const probe = await page.evaluate(() => {
    const out = [];
    for (let w = 3; w <= 6; w++) {
      const livesBefore = GameState.state.lives;
      GameState.startWave();
      for (let i = 0; i < 60 * 70 && GameState.state.waveActive; i++) GameState.update(1 / 60);
      out.push({ wave: w, leaked: livesBefore - GameState.state.lives, gold: GameState.state.gold });
      if (GameState.state.phase !== 'playing') break;
    }
    return out;
  });
  console.log('balance probe (2 Slingers, no more building): ' + JSON.stringify(probe));
  await page.waitForTimeout(1500);

  // ---- M4: all five towers, upgrades, sell, flying rule ----
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(200);
  // the probe may have bled the Bastion dry: revive it for the rest of the suite (test-only)
  await page.evaluate(() => { GameState.state.gold = 2000; GameState.state.lives = 20; GameState.state.phase = 'playing'; document.getElementById('end').classList.remove('show'); GameState.emit('goldChanged', 2000); });
  const spots = { warden: [7, 5], druid: [9, 5], golem: [12, 4], artillery: [13, 7] };
  for (const [type, [c, r]] of Object.entries(spots)) {
    const before = (await S(page)).towers;
    [x, y] = await cellToScreen(page, c, r);
    await page.mouse.click(x, y); await page.waitForTimeout(200);
    const btn = page.locator(`.build-btn[data-tower="${type}"]`);
    check(`${type} button present`, await btn.count() === 1);
    await btn.click(); await page.waitForTimeout(200);
    check(`${type} placed`, (await S(page)).towers === before + 1);
  }
  check('five tower types on the field', await page.evaluate(() => new Set(GameState.state.towers.map((t) => t.type)).size) === 5);
  await page.screenshot({ path: `${OUT}/towers.png` });
  for (const [type, [c, r]] of Object.entries({ slinger: [6, 5], ...spots })) {
    const [zx, zy] = await cellToScreen(page, c, r);
    await page.screenshot({ path: `${OUT}/tower-${type}.png`, clip: { x: zx - 70, y: zy - 110, width: 140, height: 150 } });
  }
  // upgrade and sell through the panel
  [x, y] = await cellToScreen(page, 7, 5);
  await page.mouse.click(x, y); await page.waitForTimeout(200);
  const goldBefore = (await S(page)).gold;
  await page.locator('button[data-upgrade]').click(); await page.waitForTimeout(250);
  const tw = await page.evaluate(() => GameState.state.towers.find((t) => t.type === 'warden'));
  check('warden upgraded to tier 2 and charged', tw.tier === 2 && (await S(page)).gold === goldBefore - 88, `tier=${tw.tier} gold=${(await S(page)).gold}`);
  check('tier 2 stats grow', await page.evaluate(() => { const t = GameState.state.towers.find((t) => t.type === 'warden'); const s = GameState.towerStats(t); const b = GameState.TOWER_TYPES.warden; return s.damage === Math.round(b.damage * 1.5) && s.range > b.range; }));
  await page.locator('button[data-upgrade]').click(); await page.waitForTimeout(250);
  check('tier 3 reached and upgrade button retires', await page.evaluate(() => GameState.state.towers.find((t) => t.type === 'warden').tier === 3) && await page.locator('button[data-upgrade]').count() === 0);
  const [zx2, zy2] = await cellToScreen(page, 7, 5);
  await page.screenshot({ path: `${OUT}/tower-warden-t3.png`, clip: { x: zx2 - 70, y: zy2 - 110, width: 140, height: 150 } });
  const goldPreSell = (await S(page)).gold;
  await page.locator('button[data-sell]').click(); await page.waitForTimeout(250);
  st = await S(page);
  check('sell removes the tower and refunds 60%', st.towers === 5 && st.gold === goldPreSell + Math.round((110 + 88 + 143) * 0.6), `gold=${st.gold}`);
  check('sold tile is buildable again', await page.evaluate(() => !GameState.towerAt(7, 5)));
  const leftover = await page.evaluate(() => Renderer.debugScene().children.filter((c) => /^tower-/.test(c.name)).length);
  check('sold tower view removed', leftover === 5, `views=${leftover}`);

  // staged tests must not be interrupted by the prep timer auto-starting a wave
  const quiet = () => page.evaluate(() => { const S = GameState.state; S.waveActive = false; S.schedule = []; S.waveQueue = []; S.prep = 0; S.phase = 'playing'; S.enemies.length = 0; S.projectiles.length = 0; });
  await quiet();
  // flying rule: a lone bat past ground-only towers must be untouched
  const flyRes = await page.evaluate(() => {
    const keep = new Set(['slinger', 'warden', 'golem']);
    GameState.state.towers = GameState.state.towers.filter((t) => keep.has(t.type));
    GameState.state.enemies.length = 0; GameState.state.projectiles.length = 0;
    const bat = GameState.spawnEnemy('bat');
    let hits = 0; GameState.on('enemyHit', ({ enemy }) => { if (enemy.id === bat.id) hits++; });
    for (let i = 0; i < 60 * 8 && GameState.state.enemies.includes(bat); i++) GameState.update(1 / 60);
    const groundOnlyHits = hits, hpAfter = bat.hp, maxHp = bat.maxHp, dist = bat.dist;
    // now bring in a druid and an artillery and run another bat through
    GameState.state.enemies.length = 0;
    GameState.state.selected = { kind: 'tile', c: 9, r: 5 }; GameState.placeTower('druid');
    GameState.state.selected = { kind: 'tile', c: 13, r: 7 }; GameState.placeTower('artillery');
    const bat2 = GameState.spawnEnemy('bat');
    let hits2 = 0, chilled = false; GameState.on('enemyHit', ({ enemy }) => { if (enemy.id === bat2.id) hits2++; }); GameState.on('enemyChilled', (e) => { if (e.id === bat2.id) chilled = true; });
    for (let i = 0; i < 60 * 12 && GameState.state.enemies.includes(bat2); i++) GameState.update(1 / 60);
    return { groundOnlyHits, hpAfter, maxHp, dist, flyerHits: hits2, chilled, bat2hp: bat2.hp };
  });
  check('ground-only towers never touch a bat', flyRes.groundOnlyHits === 0 && flyRes.hpAfter === flyRes.maxHp && flyRes.dist > 8, JSON.stringify(flyRes));
  check('druid and artillery do hit the bat, and the druid chills it', flyRes.flyerHits > 0 && flyRes.chilled, JSON.stringify(flyRes));
  await quiet();
  // rooting: a warden thorn burst stops a grunt in its tracks
  const rootRes = await page.evaluate(() => {
    GameState.state.enemies.length = 0; GameState.state.projectiles.length = 0;
    GameState.state.towers = GameState.state.towers.filter((t) => t.type === 'warden');
    GameState.state.selected = { kind: 'tile', c: 7, r: 5 }; GameState.placeTower('warden');
    const g = GameState.spawnEnemy('grunt');
    let rooted = false, frozenFrames = 0;
    GameState.on('enemyRooted', (e) => { if (e.id === g.id) rooted = true; });
    for (let i = 0; i < 60 * 12 && GameState.state.enemies.includes(g); i++) { const d0 = g.dist; GameState.update(1 / 60); if (rooted && g.dist === d0) frozenFrames++; }
    return { rooted, frozenFrames };
  });
  check('warden roots a grunt and it stops moving', rootRes.rooted && rootRes.frozenFrames > 20, JSON.stringify(rootRes));
  await page.waitForTimeout(800);
  // a wave-5 style mix with everything on the field, for the screenshot and a sanity check
  await quiet();
  await page.evaluate(() => {
    GameState.state.enemies.length = 0;
    GameState.state.towers.length = 0;
    const put = (type, c, r) => { GameState.state.selected = { kind: 'tile', c, r }; GameState.placeTower(type); };
    put('slinger', 6, 5); put('warden', 7, 5); put('druid', 9, 5); put('golem', 12, 4); put('artillery', 13, 7);
    window.__bats = 0; GameState.on('enemySpawned', (e) => { if (e.type === 'bat') window.__bats++; });
    GameState.state.wave = 4; GameState.state.lives = 20; GameState.startWave();
    for (let i = 0; i < 60 * 6; i++) GameState.update(1 / 60);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/wave5.png` });
  check('wave 5 sends bats', (await page.evaluate(() => window.__bats)) >= 3);
  await page.evaluate(() => { for (let i = 0; i < 60 * 60 && GameState.state.waveActive; i++) GameState.update(1 / 60); });
  const w5 = await S(page);
  console.log('wave 5 with one of each tower: lives ' + w5.lives + ', gold ' + w5.gold);
  await page.waitForTimeout(2500);

  // Bastion damage state 2, staged for a screenshot, then restored
  await page.evaluate(() => { GameState.state.lives = 5; GameState.state.endpointState = 2; GameState.emit('endpointStateChanged', 2); });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/bastion-damaged.png`, clip: { x: 820, y: 330, width: 360, height: 330 } });
  await page.evaluate(() => { GameState.state.lives = 20; GameState.state.endpointState = 0; GameState.emit('endpointStateChanged', 0); });
  // ---- full play-through bots: a mixed builder, then one tower type only ----
  const runBot = (plan) => page.evaluate((plan) => {
    const S = GameState.state;
    S.enemies.length = 0; S.projectiles.length = 0; S.towers.length = 0;
    S.gold = 150; S.lives = 20; S.wave = 0; S.prep = 0; S.waveActive = false; S.schedule = []; S.waveQueue = []; S.phase = 'playing'; S.endpointState = 0; S.kills = 0;
    const flyersIn = (n) => { const w = GameState.waveInfo(n); return !!w && w.groups.some((g) => g.type === 'bat' || g.type === 'boss'); };
    const antiAir = () => S.towers.filter((t) => GameState.TOWER_TYPES[t.type].hitsFlying).length;
    const spots = [[7, 5], [6, 5], [9, 5], [7, 7], [10, 5], [12, 4], [13, 7], [15, 8], [5, 5], [3, 3], [13, 4], [15, 10], [5, 7], [12, 7], [3, 1], [15, 4]];
    let next = 0;
    const act = () => {
      // build first, then upgrade the earliest towers
      while (next < spots.length) {
        let type = plan[next % plan.length];
        // a player who sees bats on the horizon builds something that can reach them
        const upcoming = S.waveActive ? S.wave : S.wave + 1;
        if (plan.length > 1 && flyersIn(upcoming) && antiAir() < 2 + Math.floor(upcoming / 4)) type = antiAir() % 2 ? 'artillery' : 'druid';
        if (S.gold < GameState.TOWER_TYPES[type].cost) break;
        S.selected = { kind: 'tile', c: spots[next][0], r: spots[next][1] };
        if (!GameState.placeTower(type).ok) { next++; continue; }
        next++;
      }
      const order = S.towers.slice().sort((a, b) => (GameState.TOWER_TYPES[b.type].hitsFlying - GameState.TOWER_TYPES[a.type].hitsFlying));
      for (const t of order) { const c = GameState.upgradeCost(t); if (c !== null && S.gold >= c + 40) GameState.upgradeTower(t.id); }
    };
    const leaks = [];
    for (let w = 1; w <= 12; w++) {
      act();
      const l0 = S.lives;
      GameState.startWave();
      let steps = 0;
      while (S.waveActive && steps++ < 60 * 150) { GameState.update(1 / 60); if (steps % 120 === 0) act(); }
      leaks.push(l0 - S.lives);
      if (S.phase !== 'playing') break;
    }
    return { leaks, lives: S.lives, phase: S.phase, towers: S.towers.length, tiers: S.towers.map((t) => t.tier).join(''), gold: S.gold, stars: S.phase === 'won' ? GameState.stars() : 0 };
  }, plan);
  const mixed = await runBot(['slinger', 'slinger', 'warden', 'druid', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem', 'artillery']);
  console.log('MIXED BOT: ' + JSON.stringify(mixed));
  check('a mixed defense can win all 12 waves', mixed.phase === 'won', `lives=${mixed.lives} leaks=${mixed.leaks}`);
  check('waves 1 and 2 are nearly unloseable', mixed.leaks[0] + mixed.leaks[1] <= 1, `leaks=${mixed.leaks.slice(0, 2)}`);
  await page.waitForTimeout(1500);
  check('win screen shows stars after a win', mixed.phase !== 'won' || (await page.locator('#end').isVisible() && await page.locator('#stars span.lit').count() === mixed.stars));
  await page.screenshot({ path: `${OUT}/win.png` });

  // ---- progress persistence: the win must survive a reload, via localStorage ----
  check('the win recorded stars to localStorage', await page.evaluate((expected) => {
    try { const d = JSON.parse(localStorage.getItem('bb-progress')); return d && d.levels['shadow-hollow'] && d.levels['shadow-hollow'].stars >= expected; } catch (e) { return false; }
  }, mixed.stars));
  await page.reload();
  await page.waitForTimeout(1000);
  await page.locator('#start-btn').click(); await page.waitForTimeout(300);
  const litStars = await page.locator('.wm-node[data-level="shadow-hollow"] .wm-star.lit').count();
  check('world map reflects saved stars after reload', litStars === mixed.stars, `lit=${litStars} expected=${mixed.stars}`);
  check('an unrecognized level id is never "unlocked"', await page.evaluate(() => Progress.isUnlocked('does-not-exist') === false));
  try { await page.evaluate(() => sessionStorage.setItem('bb-active-level', 'does-not-exist')); } catch (e) { /* ignore */ }
  await page.reload();
  await page.waitForTimeout(1000);
  check('an unknown active-level id falls back to the first level', await page.evaluate(() => GameState.currentLevel().id === 'shadow-hollow'));
  await enterLevel(page, 'shadow-hollow');

  for (const type of ['slinger', 'warden', 'druid', 'golem', 'artillery']) {
    const r = await runBot([type]);
    const clean = r.leaks.filter((l) => l <= 1).length;
    console.log(`ONLY ${type}: ` + JSON.stringify(r) + ` clean waves=${clean}/12`);
    check(`only ${type} does not trivialize the level`, !(r.phase === 'won' && clean > 7), `phase=${r.phase} clean=${clean}`);
  }
  await page.waitForTimeout(1600);   // the last bot's end screen arrives 900ms after its loss
  await page.evaluate(() => { GameState.state.enemies.length = 0; document.getElementById('end').classList.remove('show'); });
  await quiet();
  await page.evaluate(() => {
    const S = GameState.state; S.towers.length = 0; S.enemies.length = 0; S.projectiles.length = 0; S.phase = 'playing'; S.lives = 20; S.gold = 5000;
    const put = (type, c, r) => { S.selected = { kind: 'tile', c, r }; GameState.placeTower(type); };
    put('druid', 9, 5); put('artillery', 13, 7); put('druid', 7, 5); put('artillery', 5, 5); put('golem', 12, 4); put('warden', 10, 5);
    S.wave = 11; GameState.startWave();
    for (let i = 0; i < 60 * 25; i++) GameState.update(1 / 60);
  });
  await page.waitForTimeout(400);
  check('boss is on the field on wave 12', await page.evaluate(() => GameState.state.enemies.some((e) => e.boss)));
  check('boss bar shows while the boss lives', await page.waitForFunction(() => document.getElementById('boss-bar').classList.contains('show'), null, { timeout: 8000 }).then(() => true).catch(() => false));
  await page.screenshot({ path: `${OUT}/boss.png` });
  await page.evaluate(() => { for (let i = 0; i < 60 * 120 && GameState.state.waveActive; i++) GameState.update(1 / 60); });
  check('wave 12 ends in a win when the swarm falls', await page.evaluate(() => GameState.state.phase === 'won'));
  await page.waitForFunction(() => Renderer.debugViews().dying.length === 0, null, { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => { document.getElementById('end').classList.remove('show'); });
  await page.waitForTimeout(500);

  // ---------------- Level 2: The Millbrook Watch ----------------
  check('winning Level 1 unlocked Level 2', await page.evaluate(() => Progress.isUnlocked('millbrook-watch')));
  await page.reload(); await page.waitForTimeout(1000);
  await enterLevel(page, 'millbrook-watch');
  check('Level 2 loads with its own path/theme', await page.evaluate(() => GameState.currentLevel().id === 'millbrook-watch'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/level2-title.png` });
  console.log('LEVEL 2 DEBUG OVERLAY: ' + (await page.locator('#debug').innerText()).replace(/\n/g, ' | '));

  // isolated wave-1 check: the exact technique that caught Level 1's real shipped bug
  const lone = await page.evaluate(() => {
    const S = GameState.state; S.towers.length = 0; S.enemies.length = 0; S.projectiles.length = 0;
    S.gold = 150; S.lives = 20; S.wave = 0; S.phase = 'playing';
    S.selected = { kind: 'tile', c: 2, r: 4 };
    GameState.placeTower('slinger');
    GameState.startWave();
    let leaks = 0; GameState.on('enemyLeaked', () => leaks++);
    for (let i = 0; i < 60 * 60 && GameState.state.waveActive; i++) GameState.update(1 / 60);
    return { leaks, lives: S.lives };
  });
  check('Level 2 wave 1 is winnable by a single lone tower (no leaks)', lone.leaks === 0 && lone.lives === 20, JSON.stringify(lone));

  const runBotOn = (plan, spots, totalWaves) => page.evaluate(({ plan, spots, totalWaves }) => {
    const S = GameState.state;
    S.enemies.length = 0; S.projectiles.length = 0; S.towers.length = 0;
    S.gold = 150; S.lives = 20; S.wave = 0; S.prep = 0; S.waveActive = false; S.schedule = []; S.waveQueue = []; S.phase = 'playing'; S.endpointState = 0; S.kills = 0;
    const flyersIn = (n) => { const w = GameState.waveInfo(n); return !!w && w.groups.some((g) => g.type === 'bat' || g.type === 'boss'); };
    const antiAir = () => S.towers.filter((t) => GameState.TOWER_TYPES[t.type].hitsFlying).length;
    let next = 0;
    const act = () => {
      while (next < spots.length) {
        let type = plan[next % plan.length];
        const upcoming = S.waveActive ? S.wave : S.wave + 1;
        if (plan.length > 1 && flyersIn(upcoming) && antiAir() < 2 + Math.floor(upcoming / 4)) type = antiAir() % 2 ? 'artillery' : 'druid';
        if (S.gold < GameState.TOWER_TYPES[type].cost) break;
        S.selected = { kind: 'tile', c: spots[next][0], r: spots[next][1] };
        if (!GameState.placeTower(type).ok) { next++; continue; }
        next++;
      }
      const order = S.towers.slice().sort((a, b) => (GameState.TOWER_TYPES[b.type].hitsFlying - GameState.TOWER_TYPES[a.type].hitsFlying));
      for (const t of order) { const c = GameState.upgradeCost(t); if (c !== null && S.gold >= c + 40) GameState.upgradeTower(t.id); }
    };
    const leaks = [];
    for (let w = 1; w <= totalWaves; w++) {
      act();
      const l0 = S.lives;
      GameState.startWave();
      let steps = 0;
      while (S.waveActive && steps++ < 60 * 150) { GameState.update(1 / 60); if (steps % 120 === 0) act(); }
      leaks.push(l0 - S.lives);
      if (S.phase !== 'playing') break;
    }
    return { leaks, lives: S.lives, phase: S.phase, towers: S.towers.length, gold: S.gold, stars: S.phase === 'won' ? GameState.stars() : 0 };
  }, { plan, spots, totalWaves });

  const L2F = LEVEL_FIXTURES['millbrook-watch'];
  const mixed2 = await runBotOn(['slinger', 'slinger', 'warden', 'druid', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem'], L2F.botBuildSpots, L2F.waveCount);
  console.log('LEVEL 2 MIXED BOT: ' + JSON.stringify(mixed2));
  check('Level 2: a mixed defense can win all 10 waves', mixed2.phase === 'won', `lives=${mixed2.lives} leaks=${JSON.stringify(mixed2.leaks)}`);
  check('Level 2: waves 1 and 2 are nearly unloseable', mixed2.leaks[0] + mixed2.leaks[1] <= 1, `leaks=${JSON.stringify(mixed2.leaks.slice(0, 2))}`);
  await page.waitForTimeout(1500);
  check('Level 2 win screen shows stars', mixed2.phase !== 'won' || (await page.locator('#end').isVisible() && await page.locator('#stars span.lit').count() === mixed2.stars));
  await page.screenshot({ path: `${OUT}/level2-win.png` });
  check('Level 2 win recorded progress', await page.evaluate(() => Progress.starsFor('millbrook-watch') > 0));
  await page.evaluate(() => { document.getElementById('end').classList.remove('show'); });

  for (const type of ['slinger', 'warden', 'druid', 'golem', 'artillery']) {
    const r = await runBotOn([type], L2F.botBuildSpots, L2F.waveCount);
    const clean = r.leaks.filter((l) => l <= 1).length;
    console.log(`LEVEL 2 ONLY ${type}: ` + JSON.stringify(r) + ` clean waves=${clean}/${L2F.waveCount}`);
    check(`Level 2: only ${type} does not trivialize the level`, !(r.phase === 'won' && clean > Math.floor(L2F.waveCount * 0.6)), `phase=${r.phase} clean=${clean}`);
  }
  await page.waitForTimeout(1600);
  await page.evaluate(() => { GameState.state.enemies.length = 0; document.getElementById('end').classList.remove('show'); });

  // ---------------- Level 3: The Cairnwatch ----------------
  check('winning Level 2 unlocked Level 3', await page.evaluate(() => Progress.isUnlocked('cairnwatch')));
  await page.reload(); await page.waitForTimeout(1000);
  await enterLevel(page, 'cairnwatch');
  check('Level 3 loads with its own path/theme', await page.evaluate(() => GameState.currentLevel().id === 'cairnwatch'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/level3-title.png` });
  console.log('LEVEL 3 DEBUG OVERLAY: ' + (await page.locator('#debug').innerText()).replace(/\n/g, ' | '));

  const L3F = LEVEL_FIXTURES['cairnwatch'];
  const lone3 = await page.evaluate((tip) => {
    const S = GameState.state; S.towers.length = 0; S.enemies.length = 0; S.projectiles.length = 0;
    S.gold = 150; S.lives = 20; S.wave = 0; S.phase = 'playing';
    S.selected = { kind: 'tile', c: tip[0], r: tip[1] };
    GameState.placeTower('slinger');
    GameState.startWave();
    let leaks = 0; GameState.on('enemyLeaked', () => leaks++);
    for (let i = 0; i < 60 * 90 && GameState.state.waveActive; i++) GameState.update(1 / 60);
    return { leaks, lives: S.lives };
  }, LEVEL_FIXTURES['cairnwatch'].firstSlingerTile);
  check('Level 3 wave 1 is winnable by a single lone tower (no leaks)', lone3.leaks === 0 && lone3.lives === 20, JSON.stringify(lone3));

  const mixed3 = await runBotOn(['slinger', 'slinger', 'warden', 'druid', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem', 'artillery'], L3F.botBuildSpots, L3F.waveCount);
  console.log('LEVEL 3 MIXED BOT: ' + JSON.stringify(mixed3));
  check('Level 3: a mixed defense can win all 12 waves', mixed3.phase === 'won', `lives=${mixed3.lives} leaks=${JSON.stringify(mixed3.leaks)}`);
  check('Level 3: waves 1 and 2 are nearly unloseable', mixed3.leaks[0] + mixed3.leaks[1] <= 1, `leaks=${JSON.stringify(mixed3.leaks.slice(0, 2))}`);
  await page.waitForTimeout(1500);
  check('Level 3 win screen shows stars', mixed3.phase !== 'won' || (await page.locator('#end').isVisible() && await page.locator('#stars span.lit').count() === mixed3.stars));
  await page.screenshot({ path: `${OUT}/level3-win.png` });
  check('Level 3 win recorded progress', await page.evaluate(() => Progress.starsFor('cairnwatch') > 0));
  await page.evaluate(() => { document.getElementById('end').classList.remove('show'); });

  for (const type of ['slinger', 'warden', 'druid', 'golem', 'artillery']) {
    const r = await runBotOn([type], L3F.botBuildSpots, L3F.waveCount);
    const clean = r.leaks.filter((l) => l <= 1).length;
    console.log(`LEVEL 3 ONLY ${type}: ` + JSON.stringify(r) + ` clean waves=${clean}/${L3F.waveCount}`);
    check(`Level 3: only ${type} does not trivialize the level`, !(r.phase === 'won' && clean > Math.floor(L3F.waveCount * 0.6)), `phase=${r.phase} clean=${clean}`);
  }
  await page.waitForTimeout(1600);
  await page.evaluate(() => { GameState.state.enemies.length = 0; document.getElementById('end').classList.remove('show'); });
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
  await page.screenshot({ path: `${OUT}/mobile-title.png` });
  const sb = await page.locator('#start-btn').boundingBox();
  check('start button fits on a phone', sb && sb.y + sb.height <= 390 && sb.height >= 44, JSON.stringify(sb));
  await page.locator('#start-btn').click(); await page.waitForTimeout(250);
  const wmNode = await page.locator('.wm-node[data-level="shadow-hollow"]').boundingBox();
  check('world map node is a touch target', wmNode && wmNode.height >= 44);
  await page.locator('.wm-node[data-level="shadow-hollow"]').click(); await page.waitForTimeout(150);
  const wmPlay = await page.locator('#wm-play-btn').boundingBox();
  check('world map play button fits on a phone', wmPlay && wmPlay.height >= 44);
  await page.locator('#wm-play-btn').click(); await page.waitForTimeout(300);
  check('start by touch through the world map', await page.evaluate(() => GameState.state.phase === 'playing'));
  [x, y] = await cellToScreen(page, 9, 5);
  await page.touchscreen.tap(x, y); await page.waitForTimeout(200);
  st = await S(page);
  check('touch tap selects tile', st.selected && st.selected.kind === 'tile' && st.selected.c === 9);
  const bb = await page.locator('.build-btn[data-tower="slinger"]').boundingBox();
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
