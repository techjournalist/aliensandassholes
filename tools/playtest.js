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
// After the title the camera snaps from its drifting title zoom to 1 on the next
// rendered frame; under software rendering that frame can be seconds away, so a
// position measured before it and tapped after it lands off center. Wait for it.
const cameraSettled = (page) => page.waitForFunction(() => Math.abs(Renderer.debugLook().cam - 1) < 1e-3, null, { timeout: 15000 }).catch(() => {});
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
  // ---- level authoring rules + the multi-route engine, no browser needed ----
  for (const r of require('./validate-levels.js').validate()) check(r.name, r.ok, r.detail);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const log = [];

  // ---------------- Desktop, mouse ----------------
  let ctx = await makeContext(browser, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  let page = await ctx.newPage();
  watch(page, log);
  await page.goto(PAGE);
  await page.waitForTimeout(2000);
  const BRANCH_KEYS = await page.evaluate(() => GameState.BRANCHES);
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
  check('speed steps up to 4x and shows it', await page.evaluate(() => GameState.state.speed === 4 && document.getElementById('speed-btn').textContent.startsWith('4') && document.getElementById('speed-btn').classList.contains('faster')));
  await page.locator('#speed-btn').click(); await page.waitForTimeout(100);
  check('speed steps up to 8x and shows it', await page.evaluate(() => GameState.state.speed === 8 && document.getElementById('speed-btn').textContent.startsWith('8') && document.getElementById('speed-btn').classList.contains('fastest') && !document.getElementById('speed-btn').classList.contains('faster')));
  await page.locator('#speed-btn').click(); await page.waitForTimeout(100);
  check('speed cycles back to 1x after 8x', await page.evaluate(() => GameState.state.speed === 1 && !document.getElementById('speed-btn').classList.contains('faster') && !document.getElementById('speed-btn').classList.contains('fastest')));
  check('only 1x, 2x, 4x and 8x are valid speeds', await page.evaluate(() => [GameState.setSpeed(8), GameState.setSpeed(4), GameState.setSpeed(3), GameState.setSpeed(2), GameState.setSpeed(16), GameState.setSpeed(0), GameState.setSpeed(1)].join() === '8,4,1,2,1,1,1'));
  check('tip points at a tile before the first tower', await page.locator('#tip').isVisible() && (await page.locator('#tip').innerText()).includes('plant'));
  await page.screenshot({ path: `${OUT}/desktop.png` });
  console.log('DEBUG OVERLAY: ' + (await page.locator('#debug').innerText()).replace(/\n/g, ' | '));
  const baselineCalls = await page.evaluate(() => Renderer.stats().calls);
  // P3-V1 budget: the richer renderer must stay within 1.5x the draw calls
  // and 2x the triangles of the pre-V1 Level 1 title view (105 / 94k)
  const baseTris = await page.evaluate(() => Renderer.stats().triangles);
  check('render budget: draw calls within 1.5x pre-V1 baseline', baselineCalls <= 158, `calls=${baselineCalls}`);
  check('render budget: triangles within 2x pre-V1 baseline', baseTris <= 189000, `tris=${baseTris}`);
  // diorama look: linear lighting, ACES tone mapping, sRGB output, toon lighting patch, cast shadows
  const look = await page.evaluate(() => {
    const sc = Renderer.debugScene();
    const cvs = document.getElementById('game');
    const gl = cvs.getContext('webgl2') || cvs.getContext('webgl');
    return {
      pipeline: !!(THREE.ColorPipeline && THREE.ColorPipeline.on),
      shim: new THREE.Color(0x808080).r < 0.3 && new THREE.Color(0x336699).getHex() === 0x336699,
      toonPatched: THREE.ShaderLib.toon.fragmentShader.includes('tlShade'),
      hasShadows: !!sc.children.find((o) => o.material && o.material.map && o.material.transparent && o.material.opacity >= 0.7 && o.material.color && o.material.color.getHex() === 0x2a2048),
      scaleApi: typeof Renderer.setPixelScale === 'function' && Renderer.pixelScale() === 1,
    };
  });
  check('color pipeline: sRGB shim on and hex values round-trip', look.pipeline && look.shim, JSON.stringify(look));
  check('toon lighting patch is applied to the shared toon shader', look.toonPatched);
  check('props and the keep throw cast shadows (violet trailing decals)', look.hasShadows);
  check('frame-rate governor API exists and is idle under automation', look.scaleApi);
  check('grass, water and ambient motes are in the scene', await page.evaluate(() => {
    const names = new Set(); Renderer.debugScene().traverse((o) => names.add(o.name));
    return names.has('grass') && names.has('water') && [...names].some((n) => n.startsWith('motes-'));
  }));

  // music: rendered offline so it does not depend on the browser's autoplay policy
  const mus = await page.evaluate(async () => {
    const r = {};
    for (const [st, secs] of [['calm', 8], ['combat', 8], ['boss', 8], ['end', 2]]) {
      const { buffer } = await Audio.renderMusic(st, secs, 'shadow-hollow');
      const d = buffer.getChannelData(0); let peak = 0, sum = 0, bad = 0;
      for (let i = 0; i < d.length; i++) { const v = d[i]; if (v !== v) bad++; peak = Math.max(peak, Math.abs(v)); sum += v * v; }
      r[st] = { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), bad };
    }
    return r;
  });
  check('music: every mix renders without NaN or clipping', Object.values(mus).every((m) => m.bad === 0 && m.peak < 0.6), JSON.stringify(mus));
  check('music: calm, combat and boss are audible and get steadily fuller', mus.calm.rms > 0.004 && mus.combat.rms > mus.calm.rms && mus.boss.rms > mus.combat.rms, `rms ${mus.calm.rms} < ${mus.combat.rms} < ${mus.boss.rms}`);
  check('music: the end state is silent (the win and lose stingers play alone)', mus.end.peak === 0);
  check('music: stays quieter than the loudest sound effect (peak under 0.3)', mus.boss.peak < 0.3, `boss peak ${mus.boss.peak}`);

  // settings: separate switches for effects and music, saved, reachable in a fight
  await page.locator('#settings-btn').click(); await page.waitForTimeout(250);
  check('settings gear opens Settings and pauses the game', await page.evaluate(() => document.getElementById('settings').classList.contains('show') && GameState.state.paused));
  await page.locator('#set-music').click();
  const a1 = await page.evaluate(() => ({ s: Audio.getSettings(), saved: JSON.parse(localStorage.getItem('bb-audio') || '{}'), sw: document.getElementById('set-music').getAttribute('aria-checked') }));
  check('music switch turns music off without touching effects, and saves it', a1.s.musicOn === false && a1.s.sfxOn === true && a1.saved.musicOn === false && a1.sw === 'false', JSON.stringify(a1.s));
  await page.locator('#set-music').click();
  await page.locator('#set-sfx').click();
  const a2 = await page.evaluate(() => ({ s: Audio.getSettings(), slider: document.getElementById('set-sfx-vol').disabled }));
  check('effects switch turns effects off without touching music, and greys its slider', a2.s.sfxOn === false && a2.s.musicOn === true && a2.slider === true, JSON.stringify(a2));
  await page.locator('#set-sfx').click();
  await page.locator('#set-music-vol').fill('40');
  check('music slider sets the music volume', (await page.evaluate(() => Audio.getSettings().musicVol)) === 0.4);
  await page.evaluate(() => Audio.setMusicVolume(0.6));
  const tall = await page.evaluate(() => ['set-master', 'set-sfx', 'set-music', 'set-sfx-vol', 'set-music-vol', 'settings-done'].every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.height >= 44; }));
  check('every settings control is at least 44px tall', tall);
  // P3-V17: Settings can hide the camera buttons; keys and gestures keep working
  const camIds = ['rot-left-btn', 'rot-right-btn', 'zoom-out-btn', 'zoom-in-btn', 'tilt-up-btn', 'tilt-down-btn'];
  const camShown = () => page.evaluate((ids) => ids.map((id) => getComputedStyle(document.getElementById(id)).display !== 'none'), camIds);
  check('Settings has a Camera buttons switch, on by default, with the buttons showing', (await page.locator('#set-camui').getAttribute('aria-checked')) === 'true' && (await page.locator('#set-camui').boundingBox()).height >= 44 && (await camShown()).every(Boolean));
  await page.locator('#set-camui').click(); await page.waitForTimeout(150);
  check('switching it off hides every camera button and saves the choice', (await camShown()).every((v) => !v) && (await page.locator('#set-camui').getAttribute('aria-checked')) === 'false' && await page.evaluate(() => localStorage.getItem('bb-camui')) === '0');
  await page.keyboard.press('e');
  await page.waitForFunction(() => !Renderer.viewTurning(), null, { timeout: 30000 }).catch(() => {});
  check('the camera keys still work with the buttons hidden', await page.evaluate(() => Renderer.viewIndex()) === 1);
  await page.keyboard.press('q');
  await page.waitForFunction(() => !Renderer.viewTurning(), null, { timeout: 30000 }).catch(() => {});
  await page.locator('#set-camui').click(); await page.waitForTimeout(150);
  check('switching it back on shows the buttons again and saves it', (await camShown()).every(Boolean) && await page.evaluate(() => localStorage.getItem('bb-camui')) === '1' && await page.evaluate(() => Renderer.viewIndex()) === 0);
  // save code: campaign progress as text; typing in it must never reach the game's hotkeys
  await page.locator('#savecode-btn').click(); await page.waitForTimeout(200);
  const sc0 = await page.evaluate(() => { const o = document.getElementById('savecode-out'); return { open: document.getElementById('savecode').classList.contains('show'), code: o.value, fits: o.scrollWidth <= o.clientWidth && o.scrollHeight <= o.clientHeight + 1, h: ['savecode-copy', 'savecode-load', 'savecode-done', 'savecode-in', 'savecode-out'].map((id) => document.getElementById(id).getBoundingClientRect().height) }; });
  check('Settings opens a Save code panel with a BB2 code and 44px controls', sc0.open && /^BB2-/.test(sc0.code) && sc0.h.every((v) => v >= 44), JSON.stringify(sc0));
  check('the whole save code shows in its box, with no scrolling', sc0.fits, JSON.stringify(sc0));
  const viewBefore = await page.evaluate(() => Renderer.viewIndex());
  await page.locator('#savecode-in').click(); await page.keyboard.type('eq0 -+[]f', { delay: 5 });
  check('typing in the code box leaves the camera, speed and wave alone', await page.evaluate(() => document.getElementById('savecode-in').value === 'eq0 -+[]f' && Renderer.viewIndex() === 0 && GameState.state.speed === 1 && !GameState.state.waveActive) && viewBefore === 0);
  await page.fill('#savecode-in', 'nonsense'); await page.locator('#savecode-load').click();
  check('a non-code is refused with a plain message', (await page.locator('#savecode-msg').innerText()).includes("doesn't look like"));
  const scCode = await page.evaluate(() => document.getElementById('savecode-out').value);
  const scTypo = scCode.slice(0, 6) + (scCode[6] === '2' ? '3' : '2') + scCode.slice(7);
  await page.fill('#savecode-in', scTypo); await page.locator('#savecode-load').click();
  check('a mistyped code is caught and changes nothing', (await page.locator('#savecode-msg').innerText()).includes("doesn't match") && await page.evaluate((c) => Progress.exportCode() === c, scCode));
  await page.fill('#savecode-in', 'BB3-ABCD-EF'); await page.locator('#savecode-load').click();
  check('a code from a newer version says so and changes nothing', (await page.locator('#savecode-msg').innerText()).includes('newer version') && await page.evaluate((c) => Progress.exportCode() === c, scCode));
  // an old BB1 code (Level 1 open, the rest locked: adds nothing to this run) still loads
  const bb1Hash = (str) => { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 1296; return h.toString(36).toUpperCase().padStart(2, '0'); };
  const bb1Body = '10' + '00'.repeat(await page.evaluate(() => LEVELS.length - 1));
  await page.fill('#savecode-in', 'BB1-' + (bb1Body + bb1Hash('BB1' + bb1Body)).match(/.{1,4}/g).join('-')); await page.locator('#savecode-load').click();
  check('an old BB1 code still loads', (await page.locator('#savecode-msg').innerText()).includes('nothing new') && await page.evaluate((c) => Progress.exportCode() === c, scCode));
  // loading a code that adds nothing must leave this run's progress untouched (the real load paths are covered in validate-levels.js)
  await page.fill('#savecode-in', scCode.toLowerCase()); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  check('pasting a lowercase code with Enter loads it and says it has nothing new', (await page.locator('#savecode-msg').innerText()).includes('nothing new') && await page.evaluate((c) => Progress.exportCode() === c, scCode));
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  check('Escape closes the Save code panel first and leaves Settings open', await page.evaluate(() => !document.getElementById('savecode').classList.contains('show') && document.getElementById('settings').classList.contains('show')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  check('Escape closes Settings (and the game stays paused behind it)', await page.evaluate(() => !document.getElementById('settings').classList.contains('show') && GameState.state.paused));
  await page.locator('#resume-btn').click(); await page.waitForTimeout(200);
  check('Resume after Settings returns to the fight', await page.evaluate(() => !GameState.state.paused));

  // M1 regression: tile rules, drag, resize
  await cameraSettled(page);
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

  // ---- P3-V14: the player can turn the view in four fixed steps ----
  const turned = () => page.waitForFunction(() => !Renderer.viewTurning(), null, { timeout: 30000 }).then(() => true, () => false);
  const cam0 = await page.evaluate(() => Renderer.debugCamera());
  check('rotate buttons are 44px targets', await page.evaluate(() => ['rot-left-btn', 'rot-right-btn'].every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })));
  const gate0 = await page.evaluate(() => Renderer.worldToScreen(GameState.gate.x, 0, GameState.gate.z));
  await page.locator('#rot-right-btn').click(); await turned();
  const v1 = await page.evaluate(() => ({ idx: Renderer.viewIndex(), cam: Renderer.debugCamera(), saved: localStorage.getItem('bb-view'), gate: Renderer.worldToScreen(GameState.gate.x, 0, GameState.gate.z) }));
  check('the clockwise button turns to the next view and remembers it', v1.idx === 1 && Math.abs(v1.cam.deg - 90) < 1e-6 && v1.saved === '1', JSON.stringify({ idx: v1.idx, deg: v1.cam.deg, saved: v1.saved }));
  const vp = page.viewportSize();
  check('the Bastion moves clockwise on screen (bottom right to bottom left)', gate0.x > vp.width / 2 && v1.gate.x < gate0.x && v1.gate.y > vp.height / 2 - 40, JSON.stringify({ from: gate0, to: v1.gate }));
  check('picking still finds the right tile in a turned view', await page.evaluate(() => [[7, 5], [3, 3], [12, 7]].every(([c, r]) => { const p = Renderer.worldToScreen(GameState.worldX(c), 0, GameState.worldZ(r)); const hit = Renderer.screenToCell(p.x, p.y); return hit && hit.c === c && hit.r === r; })));
  check('camera-facing glows turn with the view', await page.evaluate(() => {
    const m = Renderer.debugScene().getObjectByName('glowCam'); if (!m) return false;
    const a = m.geometry.attributes.position.array, v = (i) => [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
    const p0 = v(0), p1 = v(1), p2 = v(2), u = p1.map((x, i) => x - p0[i]), w = p2.map((x, i) => x - p0[i]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], nl = Math.hypot(...n);
    const cam = Renderer.debugCamera(), cl = Math.hypot(cam.x, cam.y, cam.z);
    return Math.abs((n[0] * cam.x + n[1] * cam.y + n[2] * cam.z) / (nl * cl)) > 0.999;
  }));
  await page.keyboard.press('q'); await turned();
  check('Q turns the view back anticlockwise', await page.evaluate(() => Renderer.viewIndex() === 0));
  for (let i = 0; i < 4; i++) { await page.keyboard.press('e'); await turned(); }
  const cam4 = await page.evaluate(() => Renderer.debugCamera());
  check('four turns of E come all the way round to the starting view', cam4.idx === 0 && Math.hypot(cam4.x - cam0.x, cam4.y - cam0.y, cam4.z - cam0.z) < 1e-6 && cam4.deg === 0, JSON.stringify(cam4));
  check('a tap on a tile in a turned view still selects that tile', await (async () => {
    await page.locator('#rot-left-btn').click(); await turned();
    const pt = await page.evaluate(() => Renderer.worldToScreen(GameState.worldX(12), 0, GameState.worldZ(4)));
    await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(150);
    const sel = await page.evaluate(() => GameState.state.selected);
    await page.locator('#rot-right-btn').click(); await turned();
    return !!sel && sel.kind === 'tile' && sel.c === 12 && sel.r === 4;
  })());
  await page.evaluate(() => GameState.clearSelection && GameState.clearSelection());
  check('the view ends back at the default so later checks are unaffected', await page.evaluate(() => Renderer.viewIndex() === 0 && localStorage.getItem('bb-view') === '0'));

  // ---- P3-V15: zoom and pan ----
  const lookNow = () => page.evaluate(() => Renderer.debugLook());
  const settled = () => page.waitForFunction(() => { const l = Renderer.debugLook(); return Math.abs(l.zoom - l.tz) < 0.003 && Math.abs(l.px - l.tx) < 0.003 && Math.abs(l.py - l.ty) < 0.003; }, null, { timeout: 30000 }).then(() => true, () => false);
  check('zoom buttons are 44px targets', await page.evaluate(() => ['zoom-in-btn', 'zoom-out-btn'].every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })));
  await page.locator('#zoom-in-btn').click(); await settled();
  check('the plus button zooms in', Math.abs((await lookNow()).tz - 1.25) < 1e-6);
  for (let i = 0; i < 10; i++) await page.locator('#zoom-in-btn').click();
  for (let i = 0; i < 25; i++) await page.locator('#zoom-out-btn').click();
  check('zoom is limited to 0.75x at the far end', Math.abs((await lookNow()).tz - 0.75) < 1e-6);
  for (let i = 0; i < 25; i++) await page.locator('#zoom-in-btn').click();
  check('zoom is limited to 2.5x at the near end', Math.abs((await lookNow()).tz - 2.5) < 1e-6);
  await page.keyboard.press('0'); await settled();
  check('the 0 key puts zoom and pan back to the start', await (async () => { const l = await lookNow(); return Math.abs(l.zoom - 1) < 0.003 && Math.abs(l.px) < 0.003 && Math.abs(l.py) < 0.003; })());
  const zp = await page.evaluate(() => Renderer.worldToScreen(GameState.worldX(13), 0, GameState.worldZ(7)));
  const zc0 = await page.evaluate(([x, y]) => Renderer.screenToCell(x, y), [zp.x, zp.y]);
  await page.mouse.move(zp.x, zp.y); await page.mouse.wheel(0, -600); await settled();
  const zc1 = await page.evaluate(([x, y]) => Renderer.screenToCell(x, y), [zp.x, zp.y]);
  check('the wheel zooms toward the pointer (the tile under it stays put)', (await lookNow()).tz > 2 && zc0.c === zc1.c && zc0.r === zc1.r, JSON.stringify({ zc0, zc1 }));
  const selBefore = await page.evaluate(() => JSON.stringify(GameState.state.selected));
  const lk0 = await lookNow();
  await page.mouse.move(600, 300); await page.mouse.down(); await page.mouse.move(520, 270, { steps: 5 }); await page.mouse.up(); await settled();
  const lk1 = await lookNow();
  check('dragging pans a zoomed view and does not select a tile', (Math.abs(lk1.px - lk0.px) > 0.05 || Math.abs(lk1.py - lk0.py) > 0.05) && selBefore === await page.evaluate(() => JSON.stringify(GameState.state.selected)), JSON.stringify({ lk0: [lk0.px, lk0.py], lk1: [lk1.px, lk1.py] }));
  for (let i = 0; i < 4; i++) { await page.mouse.move(900, 500); await page.mouse.down(); await page.mouse.move(100, 60, { steps: 8 }); await page.mouse.up(); }
  await settled();
  const lk2 = await lookNow();
  check('the pan stops at the edge of the original framing', Math.abs(lk2.px) <= lk2.hw * (1 - 1 / lk2.tz) + 0.01 && Math.abs(lk2.py) <= lk2.hh * (1 - 1 / lk2.tz) + 0.01 && Math.abs(lk2.tx) > 0.5, JSON.stringify(lk2));
  const ztap = await page.evaluate(() => { const cur = GameState.state.selected; const vw = innerWidth, vh = innerHeight; for (let r = 0; r < GameState.currentLevel().grid.rows; r++) for (let c = 0; c < GameState.currentLevel().grid.cols; c++) { if (!GameState.isBuildable(c, r) || (cur && cur.c === c && cur.r === r)) continue; const p = Renderer.worldToScreen(GameState.worldX(c), 0, GameState.worldZ(r)); if (p.x > vw * 0.25 && p.x < vw * 0.75 && p.y > vh * 0.3 && p.y < vh * 0.7) return { c, r, x: p.x, y: p.y }; } return null; });
  await page.mouse.click(ztap.x, ztap.y); await page.waitForTimeout(200);
  const zsel = await page.evaluate(() => GameState.state.selected);
  check('a tap on a zoomed view still selects the tile under it', !!zsel && zsel.kind === 'tile' && zsel.c === ztap.c && zsel.r === ztap.r, JSON.stringify({ want: [ztap.c, ztap.r], got: zsel }));
  const zTurnFrom = (await lookNow()).tz;
  await page.locator('#rot-right-btn').click(); await turned(); await settled();
  const lt = await lookNow();
  check('turning the view keeps the zoom and recentres the pan', Math.abs(lt.tz - zTurnFrom) < 1e-6 && Math.abs(lt.px) < 0.01 && Math.abs(lt.py) < 0.01, JSON.stringify({ tz: lt.tz, px: lt.px, py: lt.py }));
  await page.locator('#rot-left-btn').click(); await turned();
  await page.keyboard.press('0'); await settled();
  const selPinch = await page.evaluate(() => JSON.stringify(GameState.state.selected));
  await page.evaluate(() => {
    const c = document.getElementById('game'), ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
    ev('pointerdown', 11, 500, 300); ev('pointerdown', 12, 600, 300);
    for (let i = 1; i <= 10; i++) { ev('pointermove', 11, 500 - i * 15, 300); ev('pointermove', 12, 600 + i * 15, 300); }
    ev('pointerup', 11, 350, 300); ev('pointerup', 12, 750, 300);
  });
  await settled();
  check('two fingers moving apart zoom in, and never count as a tap', (await lookNow()).tz > 1.5 && selPinch === await page.evaluate(() => JSON.stringify(GameState.state.selected)));
  await page.keyboard.press('0'); await settled();
  check('zoom ends back at the default so later checks are unaffected', await (async () => { const l = await lookNow(); return Math.abs(l.zoom - 1) < 0.003 && Math.abs(l.cam - 1) < 0.003; })());
  await page.evaluate(() => GameState.clearSelection && GameState.clearSelection());

  // ---- P3-V16: the player can tilt the camera ----
  const tiltDone = () => page.waitForFunction(() => !Renderer.tiltTurning() && !Renderer.viewTurning(), null, { timeout: 30000 }).then(() => true, () => false);
  const camNow = () => page.evaluate(() => Renderer.debugCamera());
  const pickOk = () => page.evaluate(() => [[7, 5], [3, 3], [12, 7]].every(([c, r]) => { const p = Renderer.worldToScreen(GameState.worldX(c), 0, GameState.worldZ(r)); const h = Renderer.screenToCell(p.x, p.y); return h && h.c === c && h.r === r; }));
  check('tilt buttons are 44px targets', await page.evaluate(() => ['tilt-up-btn', 'tilt-down-btn'].every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })));
  const t0 = await camNow();
  await page.locator('#tilt-down-btn').click(); await tiltDone();
  check('the lower button lowers the camera by one step', t0.tilt === 50 && Math.abs((await camNow()).tilt - 44) < 1e-6, JSON.stringify({ from: t0.tilt, to: (await camNow()).tilt }));
  for (let i = 0; i < 12; i++) await page.locator('#tilt-down-btn').click();
  await tiltDone();
  check('the camera cannot go lower than 30 degrees', Math.abs((await camNow()).tilt - 30) < 1e-6 && await pickOk());
  for (let i = 0; i < 25; i++) await page.locator('#tilt-up-btn').click();
  await tiltDone();
  check('the camera cannot go higher than 80 degrees, and picking is right there too', Math.abs((await camNow()).tilt - 80) < 1e-6 && await pickOk());
  check('the tilt is remembered', await page.evaluate(() => localStorage.getItem('bb-tilt')) === '80');
  await page.keyboard.press('0'); await tiltDone();
  const tr = await camNow();
  check('the 0 key puts the tilt (and its fog distance) back to the start', Math.abs(tr.tilt - t0.tilt) < 0.01 && Math.abs(tr.fogNear - t0.fogNear) < 0.01, JSON.stringify({ tr, t0 }));
  await page.keyboard.press('['); await tiltDone(); const tk1 = (await camNow()).tilt;
  await page.keyboard.press(']'); await page.keyboard.press(']'); await tiltDone();
  check('the [ and ] keys tilt the camera down and up', Math.abs(tk1 - 44) < 1e-6 && Math.abs((await camNow()).tilt - 56) < 1e-6);
  await page.keyboard.press('0'); await tiltDone();
  const tsel = await page.evaluate(() => JSON.stringify(GameState.state.selected));
  await page.mouse.move(640, 400); await page.mouse.down({ button: 'right' }); await page.mouse.move(640, 480, { steps: 6 }); await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(250);
  check('a right-button drag tilts the camera and selects nothing', Math.abs((await camNow()).tilt - 70) < 0.5 && tsel === await page.evaluate(() => JSON.stringify(GameState.state.selected)), JSON.stringify((await camNow()).tilt));
  await page.keyboard.press('0'); await tiltDone();
  const swipe = (id1, id2, dyEach, n) => page.evaluate(([i1, i2, dy, steps]) => {
    const c = document.getElementById('game'), ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
    ev('pointerdown', i1, 500, 500); ev('pointerdown', i2, 600, 500);
    for (let i = 1; i <= steps; i++) { ev('pointermove', i1, 500, 500 + i * dy); ev('pointermove', i2, 600, 500 + i * dy); }
    ev('pointerup', i1, 500, 500 + steps * dy); ev('pointerup', i2, 600, 500 + steps * dy);
  }, [id1, id2, dyEach, n]);
  await swipe(41, 42, 1, 6); await page.waitForTimeout(200);
  check('a small two-finger drift does not tilt', Math.abs((await camNow()).tilt - 50) < 1e-6);
  await swipe(43, 44, -4, 8); await page.waitForTimeout(200);
  check('a two-finger swipe up lowers the camera', (await camNow()).tilt < 46, String((await camNow()).tilt));
  await page.keyboard.press('0'); await tiltDone();
  await page.locator('#tilt-down-btn').click(); await tiltDone();
  await page.locator('#rot-right-btn').click(); await turned(); await tiltDone();
  check('turning the view keeps the tilt, and picking is right in the turned, tilted view', Math.abs((await camNow()).tilt - 44) < 1e-6 && await pickOk());
  await page.locator('#rot-left-btn').click(); await turned();
  await page.keyboard.press('0'); await tiltDone(); await page.keyboard.press('0'); await settled();
  check('tilt ends back at the default so later checks are unaffected', Math.abs((await camNow()).tilt - 50) < 1e-6 && await page.evaluate(() => localStorage.getItem('bb-tilt')) === '50');
  await page.evaluate(() => GameState.clearSelection && GameState.clearSelection());

  // wave: start, watch goblins walk, let them all leak
  await page.locator('#wave-btn').click(); await page.waitForTimeout(200);
  st = await S(page);
  check('wave 1 started from button', st.waveActive && st.wave === 1);
  check('wave button disabled during wave', !(await page.locator('#wave-btn').isEnabled()));
  await simulate(page, 9);
  await page.waitForTimeout(150);
  const mid = await page.evaluate(() => GameState.state.enemies.map((e) => ({ id: e.id, dist: +e.dist.toFixed(2), x: +e.x.toFixed(2), z: +e.z.toFixed(2) })));
  check('goblins spawned and spread along the road', mid.length >= 2 && mid[0].dist > 5,   // 6 on a straight road; curved roads walk about 14% less path distance in the same time
     JSON.stringify(mid.slice(0, 3)));
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
  // Regression for the "sometimes doesn't respond" bug: updateHud() used to
  // do btn.innerHTML = label every time the countdown's displayed second
  // changed, destroying and recreating the button's child nodes — a tap in
  // flight on one of those nodes could be dropped by the browser. It must
  // now only ever write textContent onto two persistent spans.
  const stableNodes = await page.evaluate(() => {
    const main = document.getElementById('wave-btn-main'), sub = document.getElementById('wave-btn-sub');
    main.__marked = true; sub.__marked = true;
    for (let i = 0; i < 5 && GameState.state.prep > 1; i++) { GameState.state.prep -= 1; UI.updateHud(); }
    const mainNow = document.getElementById('wave-btn-main'), subNow = document.getElementById('wave-btn-sub');
    return { mainSame: mainNow === main && mainNow.__marked === true, subSame: subNow === sub && subNow.__marked === true, text: mainNow.textContent };
  });
  check('the wave button\'s countdown never rebuilds its own child nodes', stableNodes.mainSame && stableNodes.subSame, JSON.stringify(stableNodes));
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
  // ---- P3-M3: tier 3 is a permanent fork between two specializations ----
  check('at tier 2 the plain upgrade gives way to two specialization cards', await page.locator('button[data-upgrade]').count() === 0 && await page.locator('button[data-branch]').count() === 2);
  check('the engine refuses tier 3 without a specialization', await page.evaluate(() => { const t = GameState.state.towers.find((t) => t.type === 'warden'); return !GameState.upgradeTower(t.id).ok && t.tier === 2; }));
  const goldPreBranch = (await S(page)).gold;
  await page.locator('button[data-branch="thicket"]').click(); await page.waitForTimeout(200);
  check('one tap only arms a specialization, it does not buy it', await page.evaluate(() => GameState.state.towers.find((t) => t.type === 'warden').tier === 2) && (await S(page)).gold === goldPreBranch && await page.locator('button[data-branch="thicket"].armed').count() === 1);
  await page.screenshot({ path: `${OUT}/branch-armed.png` });
  await page.locator('button[data-branch="thicket"]').click(); await page.waitForTimeout(250);
  const t3 = await page.evaluate(() => { const t = GameState.state.towers.find((t) => t.type === 'warden'); return { tier: t.tier, branch: t.branch }; });
  check('the second tap commits: tier 3 Thicket Keeper', t3.tier === 3 && t3.branch === 'thicket', JSON.stringify(t3));
  check('tier 3 reached and upgrade button retires', await page.locator('button[data-upgrade]').count() === 0 && await page.locator('button[data-branch]').count() === 0);
  check('a specialization is permanent', await page.evaluate(() => { const t = GameState.state.towers.find((t) => t.type === 'warden'); return !GameState.upgradeTower(t.id, 'briarstorm').ok && t.branch === 'thicket'; }));
  check('the panel names the specialization', (await page.locator('#panel .panel-title').innerText()).includes('Thicket Keeper'));
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
  // ---- P3-M3: every specialization is a trade-off, never a strict upgrade ----
  // Each branch, alone beside a tier-2 Slinger, faces scripted groups: a
  // Trickster swarm, a Troll column, a Grunt stream and (for the two
  // anti-air towers) a Bat swarm. Score = share of enemy HP removed.
  // Math.random is seeded so both branches see identical walking lanes.
  const duel = await page.evaluate(() => {
    const G = GameState, S = G.state, realRandom = Math.random;
    const SCEN = { swarm: ['trickster', 22, 0.25], armored: ['troll', 6, 1.2], mixed: ['grunt', 14, 0.4], air: ['bat', 16, 0.35] };
    const run = (type, branch, scen) => {
      let seed = 12345; Math.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      S.enemies.length = 0; S.projectiles.length = 0; S.towers.length = 0;
      // prep must be 0: a leftover countdown would auto-launch real waves mid-duel
      S.gold = 99999; S.lives = 9999; S.hpScale = 1.8; S.paused = false; S.phase = 'playing'; S.waveActive = false; S.schedule = []; S.waveQueue = []; S.prep = 0;
      const place = (t, c, r, br) => { S.selected = { kind: 'tile', c, r }; G.placeTower(t); const tw = S.towers[S.towers.length - 1]; G.upgradeTower(tw.id); if (br) G.upgradeTower(tw.id, br); return tw; };
      place('slinger', 6, 5); place(type, 7, 5, branch);
      const [et, n, gap] = SCEN[scen], spawned = [];
      let time = 0, queued = 0;
      for (let i = 0; i < 60 * 90; i++) {
        while (queued < n && queued * gap <= time) { spawned.push(G.spawnEnemy(et)); queued++; }
        G.update(1 / 60); time += 1 / 60;
        if (queued >= n && !S.enemies.length) break;
      }
      let rem = 0, tot = 0;
      for (const e of spawned) { tot += e.maxHp; rem += e.maxHp - Math.max(0, e.hp); }
      return Math.round(100 * rem / tot);
    };
    const out = {};
    for (const type of G.TOWER_ORDER) {
      const scens = G.TOWER_TYPES[type].hitsFlying ? ['swarm', 'armored', 'mixed', 'air'] : ['swarm', 'armored', 'mixed'];
      const [a, b] = Object.keys(G.BRANCHES[type]);
      out[type] = { a, b, rows: scens.map((sc) => ({ sc, a: run(type, a, sc), b: run(type, b, sc) })) };
    }
    Math.random = realRandom;
    S.enemies.length = 0; S.projectiles.length = 0; S.towers.length = 0; S.hpScale = 1; S.lives = 20; S.wave = 0; S.gold = 150;
    return out;
  });
  for (const [type, d] of Object.entries(duel)) {
    console.log(`BRANCH DUEL ${type}: ${d.a} vs ${d.b} | ` + d.rows.map((r) => `${r.sc} ${r.a}/${r.b}`).join(' | '));
    const aWins = d.rows.some((r) => r.a >= r.b * 1.1), bWins = d.rows.some((r) => r.b >= r.a * 1.1);
    check(`${type}: neither specialization is a strict upgrade (each wins a situation by 10%+)`, aWins && bWins, JSON.stringify(d.rows));
  }
  check('Mountainheart ignores Troll armor', await page.evaluate(() => {
    const G = GameState, S = G.state;
    S.gold = 99999; S.selected = { kind: 'tile', c: 7, r: 5 }; G.placeTower('golem');
    const tw = S.towers[S.towers.length - 1]; G.upgradeTower(tw.id); G.upgradeTower(tw.id, 'mountainheart');
    let hit = null; G.on('enemyHit', (h) => { if (!hit) hit = h; });
    const troll = G.spawnEnemy('troll');
    G.state.projectiles.push({ id: 999999, towerId: tw.id, targetId: troll.id, damage: G.towerStats(tw).damage, kind: 'boulder', splash: 0, effect: null, hitsFlying: false, pierce: true, targetFlying: false, targetBoss: false, x: troll.x, z: troll.z, sx: troll.x, sz: troll.z, speed: 99, t: 0, total: 0.2 });
    G.update(1 / 60);
    const ok = hit && hit.amount === G.towerStats(tw).damage && !hit.armored;
    S.enemies.length = 0; S.projectiles.length = 0; S.towers.length = 0; S.selected = null;
    return ok;
  }));

  // ---- full play-through bots: a mixed builder, then one tower type only ----
  const runBot = (plan, pick = 'alt') => page.evaluate(({ plan, pick }) => {
    const S = GameState.state;
    const branchFor = (t) => {
      const keys = Object.keys(GameState.BRANCHES[t.type]);
      if (pick !== 'alt') return keys[pick];
      // a player who reads "Kills flyers" keeps anti-air towers anti-air; the rest vary
      if (GameState.TOWER_TYPES[t.type].hitsFlying) return keys.find((k) => !GameState.BRANCHES[t.type][k].groundSplash);
      return keys[t.id % 2];
    };
    S.enemies.length = 0; S.projectiles.length = 0; S.towers.length = 0;
    S.gold = GameState.currentLevel().startGold; S.lives = 20; S.wave = 0; S.prep = 0; S.waveActive = false; S.schedule = []; S.waveQueue = []; S.phase = 'playing'; S.endpointState = 0; S.kills = 0;
    const flyersIn = (n) => { const w = GameState.waveInfo(n); return !!w && w.groups.some((g) => GameState.ENEMY_TYPES[g.type].flying); };
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
      for (const t of order) { const c = GameState.upgradeCost(t); if (c !== null && S.gold >= c + 40) GameState.upgradeTower(t.id, branchFor(t)); }
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
  }, { plan, pick });
  const mixed = await runBot(['slinger', 'slinger', 'warden', 'druid', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem', 'artillery']);
  console.log('MIXED BOT: ' + JSON.stringify(mixed));
  check('a mixed defense can win all 12 waves', mixed.phase === 'won', `lives=${mixed.lives} leaks=${mixed.leaks}`);
  check('waves 1 and 2 are nearly unloseable', mixed.leaks[0] + mixed.leaks[1] <= 1, `leaks=${mixed.leaks.slice(0, 2)}`);
  // the bot simulates a whole level with no frames in between, so the first
  // frame after it renders every queued death at once and can delay the
  // UI's 900ms end-screen timer; wait for the screen instead of a fixed sleep
  if (mixed.phase === 'won') await page.locator('#end.show').waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  check('win screen shows stars after a win', mixed.phase !== 'won' || (await page.locator('#end').isVisible() && await page.locator('#stars span.lit').count() === mixed.stars));
  await page.screenshot({ path: `${OUT}/win.png` });
  // P3-V13: every win gets a ribbon, counted stats and a confetti show; only the last level gets the finale
  if (mixed.phase === 'won') {
    const ribbon = { 3: 'Flawless!', 2: 'Well held!', 1: 'Victory!' }[mixed.stars];
    check('win screen shows the victory ribbon for its star rating', (await page.locator('#end-ribbon').isVisible()) && (await page.locator('#end-ribbon-text').textContent()) === ribbon, ribbon);   // textContent: innerText honors the CSS uppercase
    check('win screen counts up its stats to the real numbers', await page.waitForFunction((n) => document.getElementById('stat-waves').textContent === String(n) && +document.getElementById('stat-kills').textContent > 0 && document.getElementById('stat-lives').textContent === String(GameState.state.lives), 12, { timeout: 15000 }).then(() => true, () => false));
    check('win screen is not the finale on a level that has a next one', !(await page.locator('#finale').isVisible()) && (await page.locator('#end-title').innerText()) === 'The Bastion holds!');
    check('the celebration canvas covers the screen and never blocks a tap', await page.evaluate(() => { const c = document.getElementById('celebrate'), r = c.getBoundingClientRect(); return r.width >= innerWidth - 1 && r.height >= innerHeight - 1 && getComputedStyle(c).pointerEvents === 'none'; }));
  }
  check('win screen offers Continue now that the next level is unlocked', (await page.locator('#end-map-btn').innerText()) === 'Continue');
  await page.locator('#end-map-btn').click(); await page.waitForTimeout(250);
  check('Continue jumps straight to the world map, no title-screen detour', await page.locator('#worldmap').isVisible() && !(await page.locator('#title').isVisible()));
  check('Continue pre-selects the next level', await page.evaluate(() => document.querySelector('.wm-node.selected')?.dataset.level) === 'millbrook-watch');
  // ---- P3-M3a overworld: positions from level data, blight recedes, roads show progress ----
  check('world-map nodes sit where each level\'s map data puts them', await page.evaluate(() => LEVELS.every((lv) => {
    const n = document.querySelector(`.wm-node[data-level="${lv.id}"]`);
    return n && lv.map && n.getAttribute('transform') === `translate(${lv.map.x}, ${lv.map.y})`;
  })));
  const wm1 = await page.evaluate(() => ({
    cut: !!document.querySelector('#wm-cuts .wm-cut[data-level="shadow-hollow"]'),
    otherCuts: document.querySelectorAll('#wm-cuts .wm-cut:not([data-level="shadow-hollow"])').length,
    seg: document.querySelector('.wm-seg[data-from="shadow-hollow"][data-to="millbrook-watch"]')?.getAttribute('class'),
    next: document.querySelector('.wm-node.next')?.dataset.level,
  }));
  check('winning Level 1 cuts its ground out of the blight, and only its ground', wm1.cut && wm1.otherCuts === 0, JSON.stringify(wm1));
  check('the road to the next battle is open and that node is marked next', /\bopen\b/.test(wm1.seg || '') && wm1.next === 'millbrook-watch', JSON.stringify(wm1));
  // the recession is time-based (a requestAnimationFrame loop, ~1.1s of real
  // time), not frame-based; wait for it to finish rather than sleeping a fixed
  // time. Under headless CPU contention rAF ticks can go sparse for seconds at
  // a stretch (observed directly: r plateaus, then jumps straight to full on
  // the next tick), so this margin is generous on purpose, not a fixed cost.
  await page.waitForFunction(() => { const c = document.querySelector('#wm-cuts .wm-cut[data-level="shadow-hollow"]'); return c && +c.getAttribute('r') >= 109.5; }, null, { timeout: 20000 }).catch(() => {});
  const cutR = await page.evaluate(() => ({ r: +document.querySelector('#wm-cuts .wm-cut[data-level="shadow-hollow"]').getAttribute('r'), full: LEVELS.find((l) => l.id === 'shadow-hollow').map.reclaim }));
  check('the blight finishes receding to the level\'s reclaim radius', Math.abs(cutR.r - cutR.full) <= 0.5, JSON.stringify(cutR));
  await page.evaluate(() => { document.getElementById('worldmap').classList.remove('show'); });

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

  for (const type of ['slinger', 'warden', 'druid', 'golem', 'artillery']) for (const pick of [0, 1]) {
    const br = Object.keys(BRANCH_KEYS[type])[pick];
    const r = await runBot([type], pick);
    const clean = r.leaks.filter((l) => l <= 1).length;
    console.log(`ONLY ${type}/${br}: ` + JSON.stringify(r) + ` clean waves=${clean}/12`);
    check(`only ${type} (${br}) does not trivialize the level`, !(r.phase === 'won' && clean > 7), `phase=${r.phase} clean=${clean}`);
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

  const runBotOn = (plan, spots, totalWaves, pick = 'alt') => page.evaluate(({ plan, spots, totalWaves, pick }) => {
    const S = GameState.state;
    const branchFor = (t) => {
      const keys = Object.keys(GameState.BRANCHES[t.type]);
      if (pick !== 'alt') return keys[pick];
      // a player who reads "Kills flyers" keeps anti-air towers anti-air; the rest vary
      if (GameState.TOWER_TYPES[t.type].hitsFlying) return keys.find((k) => !GameState.BRANCHES[t.type][k].groundSplash);
      return keys[t.id % 2];
    };
    S.enemies.length = 0; S.projectiles.length = 0; S.towers.length = 0;
    S.gold = GameState.currentLevel().startGold; S.lives = 20; S.wave = 0; S.prep = 0; S.waveActive = false; S.schedule = []; S.waveQueue = []; S.phase = 'playing'; S.endpointState = 0; S.kills = 0;
    const flyersIn = (n) => { const w = GameState.waveInfo(n); return !!w && w.groups.some((g) => GameState.ENEMY_TYPES[g.type].flying); };
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
      for (const t of order) { const c = GameState.upgradeCost(t); if (c !== null && S.gold >= c + 40) GameState.upgradeTower(t.id, branchFor(t)); }
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
  }, { plan, spots, totalWaves, pick });

  const L2F = LEVEL_FIXTURES['millbrook-watch'];
  const mixed2 = await runBotOn(['slinger', 'slinger', 'warden', 'druid', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem'], L2F.botBuildSpots, L2F.waveCount);
  console.log('LEVEL 2 MIXED BOT: ' + JSON.stringify(mixed2));
  check('Level 2: a mixed defense can win all 10 waves', mixed2.phase === 'won', `lives=${mixed2.lives} leaks=${JSON.stringify(mixed2.leaks)}`);
  check('Level 2: waves 1 and 2 are nearly unloseable', mixed2.leaks[0] + mixed2.leaks[1] <= 1, `leaks=${JSON.stringify(mixed2.leaks.slice(0, 2))}`);
  // the bot simulates a whole level with no frames in between, so the first
  // frame after it renders every queued death at once and can delay the
  // UI's 900ms end-screen timer; wait for the screen instead of a fixed sleep
  if (mixed2.phase === 'won') await page.locator('#end.show').waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  check('Level 2 win screen shows stars', mixed2.phase !== 'won' || (await page.locator('#end').isVisible() && await page.locator('#stars span.lit').count() === mixed2.stars));
  await page.screenshot({ path: `${OUT}/level2-win.png` });
  check('Level 2 win recorded progress', await page.evaluate(() => Progress.starsFor('millbrook-watch') > 0));
  if (mixed2.phase === 'won') {
    await page.locator('#end-map-btn').click(); await page.waitForTimeout(250);
    const seg12 = await page.evaluate(() => document.querySelector('.wm-seg[data-from="shadow-hollow"][data-to="millbrook-watch"]')?.getAttribute('class'));
    check('with both ends won, the Level 1 to Level 2 road is claimed', /\bclaimed\b/.test(seg12 || ''), seg12);
    await page.evaluate(() => { document.getElementById('worldmap').classList.remove('show'); });
  }
  await page.evaluate(() => { document.getElementById('end').classList.remove('show'); });

  for (const type of ['slinger', 'warden', 'druid', 'golem', 'artillery']) for (const pick of [0, 1]) {
    const br = Object.keys(BRANCH_KEYS[type])[pick];
    const r = await runBotOn([type], L2F.botBuildSpots, L2F.waveCount, pick);
    const clean = r.leaks.filter((l) => l <= 1).length;
    console.log(`LEVEL 2 ONLY ${type}/${br}: ` + JSON.stringify(r) + ` clean waves=${clean}/${L2F.waveCount}`);
    check(`Level 2: only ${type} (${br}) does not trivialize the level`, !(r.phase === 'won' && clean > Math.floor(L2F.waveCount * 0.6)), `phase=${r.phase} clean=${clean}`);
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
  check('single-road levels build no incoming-road markers', await page.evaluate(() => { let n = 0; Renderer.debugScene().traverse((o) => { if (o.name && o.name.startsWith('route-marker-')) n++; }); return n === 0; }));

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
  check('Level 3: a mixed defense can win all 13 waves', mixed3.phase === 'won', `lives=${mixed3.lives} leaks=${JSON.stringify(mixed3.leaks)}`);
  check('Level 3: waves 1 and 2 are nearly unloseable', mixed3.leaks[0] + mixed3.leaks[1] <= 1, `leaks=${JSON.stringify(mixed3.leaks.slice(0, 2))}`);
  // the bot simulates a whole level with no frames in between, so the first
  // frame after it renders every queued death at once and can delay the
  // UI's 900ms end-screen timer; wait for the screen instead of a fixed sleep
  if (mixed3.phase === 'won') await page.locator('#end.show').waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  check('Level 3 win screen shows stars', mixed3.phase !== 'won' || (await page.locator('#end').isVisible() && await page.locator('#stars span.lit').count() === mixed3.stars));
  await page.screenshot({ path: `${OUT}/level3-win.png` });
  check('Level 3 win recorded progress', await page.evaluate(() => Progress.starsFor('cairnwatch') > 0));
  check('Level 3 win screen now offers Continue to Level 4', (await page.locator('#end-map-btn').innerText()) === 'Continue');
  await page.evaluate(() => { document.getElementById('end').classList.remove('show'); });

  for (const type of ['slinger', 'warden', 'druid', 'golem', 'artillery']) for (const pick of [0, 1]) {
    const br = Object.keys(BRANCH_KEYS[type])[pick];
    const r = await runBotOn([type], L3F.botBuildSpots, L3F.waveCount, pick);
    const clean = r.leaks.filter((l) => l <= 1).length;
    console.log(`LEVEL 3 ONLY ${type}/${br}: ` + JSON.stringify(r) + ` clean waves=${clean}/${L3F.waveCount}`);
    check(`Level 3: only ${type} (${br}) does not trivialize the level`, !(r.phase === 'won' && clean > Math.floor(L3F.waveCount * 0.6)), `phase=${r.phase} clean=${clean}`);
  }
  await page.waitForTimeout(1600);
  await page.evaluate(() => { GameState.state.enemies.length = 0; document.getElementById('end').classList.remove('show'); });

  // ---------------- Level 4: The Splintered Vale (three roads) ----------------
  check('winning Level 3 unlocked Level 4', await page.evaluate(() => Progress.isUnlocked('splintered-vale')));
  await page.reload(); await page.waitForTimeout(1000);
  await enterLevel(page, 'splintered-vale');
  check('Level 4 loads with three roads', await page.evaluate(() => GameState.currentLevel().id === 'splintered-vale' && GameState.routes.length === 3));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/level4-title.png` });
  console.log('LEVEL 4 DEBUG OVERLAY: ' + (await page.locator('#debug').innerText()).replace(/\n/g, ' | '));
  const markers = await page.evaluate(() => {
    const sc = Renderer.debugScene(), vis = (id) => { const g = sc.getObjectByName(`route-marker-${id}`); return g ? g.visible : null; };
    return { shortcut: vis('shortcut'), long: vis('long'), south: vis('south'), next: GameState.routesForWave(1) };
  });
  check('an incoming-road marker stands at the road wave 1 uses, and only there', markers.shortcut === true && markers.long === false && markers.south === false, JSON.stringify(markers));

  const L4F = LEVEL_FIXTURES['splintered-vale'];
  const lone4 = await page.evaluate(({ tip, lanes }) => {
    const G = GameState, S = G.state, out = {};
    const reset = () => { S.towers.length = 0; S.enemies.length = 0; S.projectiles.length = 0; S.gold = 170; S.lives = 20; S.wave = 0; S.prep = 0; S.waveActive = false; S.schedule = []; S.waveQueue = []; S.phase = 'playing'; };
    reset(); S.selected = { kind: 'tile', c: tip[0], r: tip[1] }; G.placeTower('slinger');
    G.startWave();
    for (let i = 0; i < 60 * 90 && S.waveActive; i++) G.update(1 / 60);
    out.wave1 = 20 - S.lives;
    // every road on its own: a wave-1-sized group against one Slinger near its entry
    for (const [route, [c, r]] of Object.entries(lanes)) {
      reset(); S.selected = { kind: 'tile', c, r }; G.placeTower('slinger');
      let t = 0, n = 0;
      for (let i = 0; i < 60 * 90; i++) { if (n < 5 && t >= n * 3.2) { G.spawnEnemy('grunt', route); n++; } G.update(1 / 60); t += 1 / 60; if (n >= 5 && !S.enemies.length) break; }
      out[route] = 20 - S.lives;
    }
    reset();
    return out;
  }, { tip: L4F.firstSlingerTile, lanes: L4F.laneSlingerTiles });
  check('Level 4 wave 1 is winnable by a single lone tower (no leaks)', lone4.wave1 === 0, JSON.stringify(lone4));
  check('Level 4: every road can be held early by one Slinger at its entry', lone4.shortcut === 0 && lone4.long === 0 && lone4.south === 0, JSON.stringify(lone4));

  const mixed4 = await runBotOn(L4F.botPlan, L4F.botBuildSpots, L4F.waveCount);
  console.log('LEVEL 4 MIXED BOT: ' + JSON.stringify(mixed4));
  check('Level 4: a mixed defense can win all 13 waves', mixed4.phase === 'won', `lives=${mixed4.lives} leaks=${JSON.stringify(mixed4.leaks)}`);
  check('Level 4: waves 1 and 2 are nearly unloseable', mixed4.leaks[0] + mixed4.leaks[1] <= 1, `leaks=${JSON.stringify(mixed4.leaks.slice(0, 2))}`);
  if (mixed4.phase === 'won') await page.locator('#end.show').waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  check('Level 4 win screen shows stars', mixed4.phase !== 'won' || (await page.locator('#end').isVisible() && await page.locator('#stars span.lit').count() === mixed4.stars));
  await page.screenshot({ path: `${OUT}/level4-win.png` });
  check('Level 4 win recorded progress', await page.evaluate(() => Progress.starsFor('splintered-vale') > 0));
  check('Level 4 win screen now offers Continue to Level 5', (await page.locator('#end-map-btn').innerText()) === 'Continue');

  await page.evaluate(() => { document.getElementById('end').classList.remove('show'); });

  for (const type of ['slinger', 'warden', 'druid', 'golem', 'artillery']) for (const pick of [0, 1]) {
    const br = Object.keys(BRANCH_KEYS[type])[pick];
    const r = await runBotOn([type], L4F.botBuildSpots, L4F.waveCount, pick);
    const clean = r.leaks.filter((l) => l <= 1).length;
    console.log(`LEVEL 4 ONLY ${type}/${br}: ` + JSON.stringify(r) + ` clean waves=${clean}/${L4F.waveCount}`);
    check(`Level 4: only ${type} (${br}) does not trivialize the level`, !(r.phase === 'won' && clean > Math.floor(L4F.waveCount * 0.6)), `phase=${r.phase} clean=${clean}`);
  }
  await page.waitForTimeout(1600);
  await page.evaluate(() => { GameState.state.enemies.length = 0; document.getElementById('end').classList.remove('show'); });

  // ---------------- Level 5: The Elderroot Ward (climax, spiral + boss reprise) ----------------
  check('winning Level 4 unlocked Level 5', await page.evaluate(() => Progress.isUnlocked('elderroot-ward')));
  await page.reload(); await page.waitForTimeout(1000);
  await enterLevel(page, 'elderroot-ward');
  check('Level 5 loads with its own spiral path', await page.evaluate(() => GameState.currentLevel().id === 'elderroot-ward' && GameState.routes.length === 1));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/level5-title.png` });
  console.log('LEVEL 5 DEBUG OVERLAY: ' + (await page.locator('#debug').innerText()).replace(/\n/g, ' | '));

  const L5F = LEVEL_FIXTURES['elderroot-ward'];
  const lone5 = await page.evaluate((tip) => {
    const S = GameState.state; S.towers.length = 0; S.enemies.length = 0; S.projectiles.length = 0;
    S.gold = GameState.currentLevel().startGold; S.lives = 20; S.wave = 0; S.phase = 'playing';
    S.selected = { kind: 'tile', c: tip[0], r: tip[1] };
    GameState.placeTower('slinger');
    GameState.startWave();
    let leaks = 0; GameState.on('enemyLeaked', () => leaks++);
    for (let i = 0; i < 60 * 90 && GameState.state.waveActive; i++) GameState.update(1 / 60);
    const r = { leaks, lives: GameState.state.lives };
    GameState.state.towers.length = 0; GameState.state.enemies.length = 0;
    return r;
  }, L5F.firstSlingerTile);
  check('Level 5 wave 1 is winnable by a single lone tower (no leaks)', lone5.leaks === 0 && lone5.lives === 20, JSON.stringify(lone5));

  const mixed5 = await runBotOn(L5F.botPlan, L5F.botBuildSpots, L5F.waveCount);
  console.log('LEVEL 5 MIXED BOT: ' + JSON.stringify(mixed5));
  check('Level 5: a mixed defense can win all 14 waves', mixed5.phase === 'won', `lives=${mixed5.lives} leaks=${JSON.stringify(mixed5.leaks)}`);
  check('Level 5: waves 1 and 2 are nearly unloseable', mixed5.leaks[0] + mixed5.leaks[1] <= 1, `leaks=${JSON.stringify(mixed5.leaks.slice(0, 2))}`);
  if (mixed5.phase === 'won') await page.locator('#end.show').waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  check('Level 5 win screen shows stars', mixed5.phase !== 'won' || (await page.locator('#end').isVisible() && await page.locator('#stars span.lit').count() === mixed5.stars));
  await page.screenshot({ path: `${OUT}/level5-win.png` });
  check('Level 5 win recorded progress', await page.evaluate(() => Progress.starsFor('elderroot-ward') > 0));
  check('Level 5 win screen now offers Continue to Level 6', (await page.locator('#end-map-btn').innerText()) === 'Continue');
  await page.evaluate(() => { document.getElementById('end').classList.remove('show'); });

  // the boss reprise: same enemy type as Level 1's, stiffened by wave 14's hpScale
  const boss5 = await page.evaluate(() => {
    const S = GameState.state, G = GameState;
    S.towers.length = 0; S.enemies.length = 0; S.projectiles.length = 0; S.phase = 'playing';
    S.hpScale = 1 + (13) * 0.05;
    const b = G.spawnEnemy('boss');
    const r = { hp: b.hp, maxHp: b.maxHp, expected: Math.round(G.ENEMY_TYPES.boss.hp * S.hpScale), flying: b.flying, bounty: b.bounty };
    S.enemies.length = 0; S.hpScale = 1;
    return r;
  });
  check('Level 5\'s boss reprise is the same Shadow-Crow Swarm, stiffened by wave 14', boss5.hp === boss5.expected && boss5.flying === true, JSON.stringify(boss5));

  for (const type of ['slinger', 'warden', 'druid', 'golem', 'artillery']) for (const pick of [0, 1]) {
    const br = Object.keys(BRANCH_KEYS[type])[pick];
    const r = await runBotOn([type], L5F.botBuildSpots, L5F.waveCount, pick);
    const clean = r.leaks.filter((l) => l <= 1).length;
    console.log(`LEVEL 5 ONLY ${type}/${br}: ` + JSON.stringify(r) + ` clean waves=${clean}/${L5F.waveCount}`);
    check(`Level 5: only ${type} (${br}) does not trivialize the level`, !(r.phase === 'won' && clean > Math.floor(L5F.waveCount * 0.6)), `phase=${r.phase} clean=${clean}`);
  }
  await page.waitForTimeout(1600);
  await page.evaluate(() => { GameState.state.enemies.length = 0; document.getElementById('end').classList.remove('show'); });

  // ---------------- Level 6: The Sunken Market (three flooded quays) ----------------
  check('winning Level 5 unlocked Level 6', await page.evaluate(() => Progress.isUnlocked('sunken-market')));
  await page.reload(); await page.waitForTimeout(1000);
  await enterLevel(page, 'sunken-market');
  check('Level 6 loads with three routes', await page.evaluate(() => GameState.currentLevel().id === 'sunken-market' && GameState.routes.length === 3));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/level6-title.png` });
  console.log('LEVEL 6 DEBUG OVERLAY: ' + (await page.locator('#debug').innerText()).replace(/\n/g, ' | '));
  const markers6 = await page.evaluate(() => {
    const sc = Renderer.debugScene(), vis = (id) => { const g = sc.getObjectByName(`route-marker-${id}`); return g ? g.visible : null; };
    return { 'market-row': vis('market-row'), 'north-docks': vis('north-docks'), 'south-docks': vis('south-docks'), next: GameState.routesForWave(1) };
  });
  check('an incoming-road marker stands at the road wave 1 uses, and only there', markers6['market-row'] === true && markers6['north-docks'] === false && markers6['south-docks'] === false, JSON.stringify(markers6));

  const L6F = LEVEL_FIXTURES['sunken-market'];
  const lone6 = await page.evaluate(({ tip, lanes }) => {
    const G = GameState, S = G.state, out = {};
    const reset = () => { S.towers.length = 0; S.enemies.length = 0; S.projectiles.length = 0; S.gold = 170; S.lives = 20; S.wave = 0; S.prep = 0; S.waveActive = false; S.schedule = []; S.waveQueue = []; S.phase = 'playing'; };
    reset(); S.selected = { kind: 'tile', c: tip[0], r: tip[1] }; G.placeTower('slinger');
    G.startWave();
    for (let i = 0; i < 60 * 90 && S.waveActive; i++) G.update(1 / 60);
    out.wave1 = 20 - S.lives;
    for (const [route, [c, r]] of Object.entries(lanes)) {
      reset(); S.selected = { kind: 'tile', c, r }; G.placeTower('slinger');
      let t = 0, n = 0;
      for (let i = 0; i < 60 * 90; i++) { if (n < 5 && t >= n * 3.2) { G.spawnEnemy('grunt', route); n++; } G.update(1 / 60); t += 1 / 60; if (n >= 5 && !S.enemies.length) break; }
      out[route] = 20 - S.lives;
    }
    reset();
    return out;
  }, { tip: L6F.firstSlingerTile, lanes: L6F.laneSlingerTiles });
  check('Level 6 wave 1 is winnable by a single lone tower (no leaks)', lone6.wave1 === 0, JSON.stringify(lone6));
  check('Level 6: every road can be held early by one Slinger at its entry', lone6['market-row'] === 0 && lone6['north-docks'] === 0 && lone6['south-docks'] === 0, JSON.stringify(lone6));

  const mixed6 = await runBotOn(L6F.botPlan, L6F.botBuildSpots, L6F.waveCount);
  console.log('LEVEL 6 MIXED BOT: ' + JSON.stringify(mixed6));
  check('Level 6: a mixed defense can win all 13 waves', mixed6.phase === 'won', `lives=${mixed6.lives} leaks=${JSON.stringify(mixed6.leaks)}`);
  check('Level 6: waves 1 and 2 are nearly unloseable', mixed6.leaks[0] + mixed6.leaks[1] <= 1, `leaks=${JSON.stringify(mixed6.leaks.slice(0, 2))}`);
  if (mixed6.phase === 'won') await page.locator('#end.show').waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  check('Level 6 win screen shows stars', mixed6.phase !== 'won' || (await page.locator('#end').isVisible() && await page.locator('#stars span.lit').count() === mixed6.stars));
  await page.screenshot({ path: `${OUT}/level6-win.png` });
  check('Level 6 win recorded progress', await page.evaluate(() => Progress.starsFor('sunken-market') > 0));
  check('Level 6 win screen now offers Continue to Level 7', (await page.locator('#end-map-btn').innerText()) === 'Continue');
  await page.evaluate(() => { document.getElementById('end').classList.remove('show'); });

  for (const type of ['slinger', 'warden', 'druid', 'golem', 'artillery']) for (const pick of [0, 1]) {
    const br = Object.keys(BRANCH_KEYS[type])[pick];
    const r = await runBotOn([type], L6F.botBuildSpots, L6F.waveCount, pick);
    const clean = r.leaks.filter((l) => l <= 1).length;
    console.log(`LEVEL 6 ONLY ${type}/${br}: ` + JSON.stringify(r) + ` clean waves=${clean}/${L6F.waveCount}`);
    check(`Level 6: only ${type} (${br}) does not trivialize the level`, !(r.phase === 'won' && clean > Math.floor(L6F.waveCount * 0.6)), `phase=${r.phase} clean=${clean}`);
  }
  await page.waitForTimeout(1600);
  await page.evaluate(() => { GameState.state.enemies.length = 0; document.getElementById('end').classList.remove('show'); });

  // ---------------- Level 7: The Amber Terraces (staggered joins on one trunk) ----------------
  check('winning Level 6 unlocked Level 7', await page.evaluate(() => Progress.isUnlocked('amber-terraces')));
  await page.reload(); await page.waitForTimeout(1000);
  await enterLevel(page, 'amber-terraces');
  check('Level 7 loads with three routes', await page.evaluate(() => GameState.currentLevel().id === 'amber-terraces' && GameState.routes.length === 3));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/level7-title.png` });
  console.log('LEVEL 7 DEBUG OVERLAY: ' + (await page.locator('#debug').innerText()).replace(/\n/g, ' | '));
  const markers7 = await page.evaluate(() => {
    const sc = Renderer.debugScene(), vis = (id) => { const g = sc.getObjectByName(`route-marker-${id}`); return g ? g.visible : null; };
    return { 'grove-path': vis('grove-path'), 'hollow-way': vis('hollow-way'), 'basket-road': vis('basket-road'), next: GameState.routesForWave(1) };
  });
  check('an incoming-road marker stands at the road wave 1 uses, and only there', markers7['grove-path'] === true && markers7['hollow-way'] === false && markers7['basket-road'] === false, JSON.stringify(markers7));

  const L7F = LEVEL_FIXTURES['amber-terraces'];
  const lone7 = await page.evaluate(({ tip, lanes }) => {
    const G = GameState, S = G.state, out = {};
    const reset = () => { S.towers.length = 0; S.enemies.length = 0; S.projectiles.length = 0; S.gold = 170; S.lives = 20; S.wave = 0; S.prep = 0; S.waveActive = false; S.schedule = []; S.waveQueue = []; S.phase = 'playing'; };
    reset(); S.selected = { kind: 'tile', c: tip[0], r: tip[1] }; G.placeTower('slinger');
    G.startWave();
    for (let i = 0; i < 60 * 90 && S.waveActive; i++) G.update(1 / 60);
    out.wave1 = 20 - S.lives;
    for (const [route, [c, r]] of Object.entries(lanes)) {
      reset(); S.selected = { kind: 'tile', c, r }; G.placeTower('slinger');
      let t = 0, n = 0;
      for (let i = 0; i < 60 * 90; i++) { if (n < 5 && t >= n * 3.2) { G.spawnEnemy('grunt', route); n++; } G.update(1 / 60); t += 1 / 60; if (n >= 5 && !S.enemies.length) break; }
      out[route] = 20 - S.lives;
    }
    reset();
    return out;
  }, { tip: L7F.firstSlingerTile, lanes: L7F.laneSlingerTiles });
  check('Level 7 wave 1 is winnable by a single lone tower (no leaks)', lone7.wave1 === 0, JSON.stringify(lone7));
  check('Level 7: every road can be held early by one Slinger at its entry', lone7['grove-path'] === 0 && lone7['hollow-way'] === 0 && lone7['basket-road'] === 0, JSON.stringify(lone7));

  const mixed7 = await runBotOn(L7F.botPlan, L7F.botBuildSpots, L7F.waveCount);
  console.log('LEVEL 7 MIXED BOT: ' + JSON.stringify(mixed7));
  check('Level 7: a mixed defense can win all 13 waves', mixed7.phase === 'won', `lives=${mixed7.lives} leaks=${JSON.stringify(mixed7.leaks)}`);
  check('Level 7: waves 1 and 2 are nearly unloseable', mixed7.leaks[0] + mixed7.leaks[1] <= 1, `leaks=${JSON.stringify(mixed7.leaks.slice(0, 2))}`);
  if (mixed7.phase === 'won') await page.locator('#end.show').waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  check('Level 7 win screen shows stars', mixed7.phase !== 'won' || (await page.locator('#end').isVisible() && await page.locator('#stars span.lit').count() === mixed7.stars));
  await page.screenshot({ path: `${OUT}/level7-win.png` });
  check('Level 7 win recorded progress', await page.evaluate(() => Progress.starsFor('amber-terraces') > 0));
  check('Level 7 win screen now offers Continue to Level 8', (await page.locator('#end-map-btn').innerText()) === 'Continue');
  await page.evaluate(() => { document.getElementById('end').classList.remove('show'); });

  for (const type of ['slinger', 'warden', 'druid', 'golem', 'artillery']) for (const pick of [0, 1]) {
    const br = Object.keys(BRANCH_KEYS[type])[pick];
    const r = await runBotOn([type], L7F.botBuildSpots, L7F.waveCount, pick);
    const clean = r.leaks.filter((l) => l <= 1).length;
    console.log(`LEVEL 7 ONLY ${type}/${br}: ` + JSON.stringify(r) + ` clean waves=${clean}/${L7F.waveCount}`);
    check(`Level 7: only ${type} (${br}) does not trivialize the level`, !(r.phase === 'won' && clean > Math.floor(L7F.waveCount * 0.6)), `phase=${r.phase} clean=${clean}`);
  }
  await page.waitForTimeout(1600);
  await page.evaluate(() => { GameState.state.enemies.length = 0; document.getElementById('end').classList.remove('show'); });

  // ---------------- Level 8: The Frostpine Camp (a switchback among two direct trails) ----------------
  check('winning Level 7 unlocked Level 8', await page.evaluate(() => Progress.isUnlocked('frostpine-camp')));
  await page.reload(); await page.waitForTimeout(1000);
  await enterLevel(page, 'frostpine-camp');
  check('Level 8 loads with three routes', await page.evaluate(() => GameState.currentLevel().id === 'frostpine-camp' && GameState.routes.length === 3));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/level8-title.png` });
  console.log('LEVEL 8 DEBUG OVERLAY: ' + (await page.locator('#debug').innerText()).replace(/\n/g, ' | '));
  const markers8 = await page.evaluate(() => {
    const sc = Renderer.debugScene(), vis = (id) => { const g = sc.getObjectByName(`route-marker-${id}`); return g ? g.visible : null; };
    return { 'scree-path': vis('scree-path'), 'high-trail': vis('high-trail'), 'frozen-draw': vis('frozen-draw'), next: GameState.routesForWave(1) };
  });
  check('an incoming-road marker stands at the road wave 1 uses, and only there', markers8['scree-path'] === true && markers8['high-trail'] === false && markers8['frozen-draw'] === false, JSON.stringify(markers8));

  const L8F = LEVEL_FIXTURES['frostpine-camp'];
  const lone8 = await page.evaluate(({ tip, lanes }) => {
    const G = GameState, S = G.state, out = {};
    const reset = () => { S.towers.length = 0; S.enemies.length = 0; S.projectiles.length = 0; S.gold = 170; S.lives = 20; S.wave = 0; S.prep = 0; S.waveActive = false; S.schedule = []; S.waveQueue = []; S.phase = 'playing'; };
    reset(); S.selected = { kind: 'tile', c: tip[0], r: tip[1] }; G.placeTower('slinger');
    G.startWave();
    for (let i = 0; i < 60 * 90 && S.waveActive; i++) G.update(1 / 60);
    out.wave1 = 20 - S.lives;
    for (const [route, [c, r]] of Object.entries(lanes)) {
      reset(); S.selected = { kind: 'tile', c, r }; G.placeTower('slinger');
      let t = 0, n = 0;
      for (let i = 0; i < 60 * 90; i++) { if (n < 5 && t >= n * 3.2) { G.spawnEnemy('grunt', route); n++; } G.update(1 / 60); t += 1 / 60; if (n >= 5 && !S.enemies.length) break; }
      out[route] = 20 - S.lives;
    }
    reset();
    return out;
  }, { tip: L8F.firstSlingerTile, lanes: L8F.laneSlingerTiles });
  check('Level 8 wave 1 is winnable by a single lone tower (no leaks)', lone8.wave1 === 0, JSON.stringify(lone8));
  check('Level 8: every road can be held early by one Slinger at its entry', lone8['scree-path'] === 0 && lone8['high-trail'] === 0 && lone8['frozen-draw'] === 0, JSON.stringify(lone8));

  const mixed8 = await runBotOn(L8F.botPlan, L8F.botBuildSpots, L8F.waveCount);
  console.log('LEVEL 8 MIXED BOT: ' + JSON.stringify(mixed8));
  check('Level 8: a mixed defense can win all 13 waves', mixed8.phase === 'won', `lives=${mixed8.lives} leaks=${JSON.stringify(mixed8.leaks)}`);
  check('Level 8: waves 1 and 2 are nearly unloseable', mixed8.leaks[0] + mixed8.leaks[1] <= 1, `leaks=${JSON.stringify(mixed8.leaks.slice(0, 2))}`);
  if (mixed8.phase === 'won') await page.locator('#end.show').waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  check('Level 8 win screen shows stars', mixed8.phase !== 'won' || (await page.locator('#end').isVisible() && await page.locator('#stars span.lit').count() === mixed8.stars));
  await page.screenshot({ path: `${OUT}/level8-win.png` });
  check('Level 8 win recorded progress', await page.evaluate(() => Progress.starsFor('frostpine-camp') > 0));
  check('Level 8 win screen now offers Continue to Level 9', mixed8.phase !== 'won' || (await page.locator('#end-map-btn').innerText()) === 'Continue');
  await page.evaluate(() => { document.getElementById('end').classList.remove('show'); });

  await page.evaluate(() => { document.getElementById('end').classList.remove('show'); });

  for (const type of ['slinger', 'warden', 'druid', 'golem', 'artillery']) for (const pick of [0, 1]) {
    const br = Object.keys(BRANCH_KEYS[type])[pick];
    const r = await runBotOn([type], L8F.botBuildSpots, L8F.waveCount, pick);
    const clean = r.leaks.filter((l) => l <= 1).length;
    console.log(`LEVEL 8 ONLY ${type}/${br}: ` + JSON.stringify(r) + ` clean waves=${clean}/${L8F.waveCount}`);
    check(`Level 8: only ${type} (${br}) does not trivialize the level`, !(r.phase === 'won' && clean > Math.floor(L8F.waveCount * 0.6)), `phase=${r.phase} clean=${clean}`);
  }
  // ---------------- Levels 9 and 10: the dawn levels (many divergent roads) ----------------
  // One shared routine: a wave-1 lone tower, a lone Slinger holding each
  // road's entry, a mixed bot over all waves, and a single-type stress test.
  const dawnLevel = async (n, id, name, routeIds, roadCount) => {
    const F = LEVEL_FIXTURES[id];
    check(`winning Level ${n - 1} unlocked Level ${n}`, await page.evaluate((i) => Progress.isUnlocked(i), id));
    await page.reload(); await page.waitForTimeout(1000);
    await enterLevel(page, id);
    check(`Level ${n} loads with ${roadCount} routes`, await page.evaluate(([i, k]) => GameState.currentLevel().id === i && GameState.routes.length === k, [id, roadCount]));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/level${n}-title.png` });
    console.log(`LEVEL ${n} DEBUG OVERLAY: ` + (await page.locator('#debug').innerText()).replace(/\n/g, ' | '));
    const markers = await page.evaluate((ids) => {
      const sc = Renderer.debugScene(), vis = (r) => { const g = sc.getObjectByName(`route-marker-${r}`); return g ? g.visible : null; };
      const out = {}; ids.forEach((r) => { out[r] = vis(r); }); return out;
    }, routeIds);
    const usedNow = await page.evaluate(() => GameState.routesForWave(1));
    check(`Level ${n}: an incoming-road marker stands at the road wave 1 uses, and only there`, routeIds.every((r, i) => markers[r] === usedNow.includes(i)), JSON.stringify(markers));
    check(`Level ${n}: the road is a smooth curve (ribbon drawn, enemies walk a rounded polyline)`, await page.evaluate(() => {
      const lv = GameState.currentLevel(), sc = Renderer.debugScene();
      const rt = GameState.routes[0], turns = lv.routes[0].waypoints.length;
      return !!lv.curvyRoads && !!sc.getObjectByName('roadDirt') && rt.points.length > turns * 4 && Number.isFinite(rt.length);
    }));
    check(`Level ${n}: a rounded route never strays more than 0.75 cells from its grid cells`, await page.evaluate(() => GameState.routes.every((rt) => rt.points.every((p) => rt.cells.some(([c, r]) => Math.hypot(GameState.worldX(c) - p.x, GameState.worldZ(r) - p.z) < 0.75)))));
    const lone = await page.evaluate(({ tip, lanes, gold }) => {
      const G = GameState, S = G.state, out = {};
      const reset = () => { S.towers.length = 0; S.enemies.length = 0; S.projectiles.length = 0; S.gold = gold; S.lives = 20; S.wave = 0; S.prep = 0; S.waveActive = false; S.schedule = []; S.waveQueue = []; S.phase = 'playing'; };
      reset(); S.selected = { kind: 'tile', c: tip[0], r: tip[1] }; G.placeTower('slinger');
      G.startWave();
      for (let i = 0; i < 60 * 90 && S.waveActive; i++) G.update(1 / 60);
      out.wave1 = 20 - S.lives;
      for (const [route, [c, r]] of Object.entries(lanes)) {
        reset(); S.selected = { kind: 'tile', c, r }; G.placeTower('slinger');
        let t = 0, k = 0;
        for (let i = 0; i < 60 * 90; i++) { if (k < 5 && t >= k * 3.2) { G.spawnEnemy('grunt', route); k++; } G.update(1 / 60); t += 1 / 60; if (k >= 5 && !S.enemies.length) break; }
        out[route] = 20 - S.lives;
      }
      reset();
      return out;
    }, { tip: F.firstSlingerTile, lanes: F.laneSlingerTiles, gold: await page.evaluate(() => GameState.currentLevel().startGold) });
    check(`Level ${n} wave 1 is winnable by a single lone tower (no leaks)`, lone.wave1 === 0, JSON.stringify(lone));
    check(`Level ${n}: every road can be held early by one Slinger at its entry`, routeIds.every((r) => lone[r] === 0), JSON.stringify(lone));

    const mixed = await runBotOn(F.botPlan, F.botBuildSpots, F.waveCount);
    console.log(`LEVEL ${n} MIXED BOT: ` + JSON.stringify(mixed));
    check(`Level ${n}: a mixed defense can win all 13 waves`, mixed.phase === 'won', `lives=${mixed.lives} leaks=${JSON.stringify(mixed.leaks)}`);
    check(`Level ${n}: waves 1 and 2 are nearly unloseable`, mixed.leaks[0] + mixed.leaks[1] <= 1, `leaks=${JSON.stringify(mixed.leaks.slice(0, 2))}`);
    if (mixed.phase === 'won') await page.locator('#end.show').waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(300);
    check(`Level ${n} win screen shows stars`, mixed.phase !== 'won' || (await page.locator('#end').isVisible() && await page.locator('#stars span.lit').count() === mixed.stars));
    await page.screenshot({ path: `${OUT}/level${n}-win.png` });
    check(`Level ${n} win recorded progress`, await page.evaluate((i) => Progress.starsFor(i) > 0, id));
    return { mixed, F };
  };
  const dawnStress = async (n, F) => {
    for (const type of ['slinger', 'warden', 'druid', 'golem', 'artillery']) for (const pick of [0, 1]) {
      const br = Object.keys(BRANCH_KEYS[type])[pick];
      const r = await runBotOn([type], F.botBuildSpots, F.waveCount, pick);
      const clean = r.leaks.filter((l) => l <= 1).length;
      console.log(`LEVEL ${n} ONLY ${type}/${br}: ` + JSON.stringify(r) + ` clean waves=${clean}/${F.waveCount}`);
      check(`Level ${n}: only ${type} (${br}) does not trivialize the level`, !(r.phase === 'won' && clean > Math.floor(F.waveCount * 0.6)), `phase=${r.phase} clean=${clean}`);
    }
  };

  const d9 = await dawnLevel(9, 'flanked-keep', 'The Flanked Keep', ['west', 'north-west', 'north', 'south-west', 'far-south', 'east-flank'], 6);
  check('Level 9 win screen offers Continue to Level 10', d9.mixed.phase !== 'won' || (await page.locator('#end-map-btn').innerText()) === 'Continue');
  check('Level 9 has six separate spawn points', await page.evaluate(() => new Set(GameState.routes.map((r) => r.cells[0].join(','))).size === 6));
  check('Level 9: the east flank never crosses the brook', await page.evaluate(() => { const cp = GameState.currentLevel().chokepoint; return !GameState.routes.find((r) => r.id === 'east-flank').cells.some(([c]) => c === cp.streamCol); }));
  await page.evaluate(() => { document.getElementById('end').classList.remove('show'); });
  await dawnStress(9, d9.F);
  await page.evaluate(() => { GameState.state.enemies.length = 0; document.getElementById('end').classList.remove('show'); });

  const d10 = await dawnLevel(10, 'keep-between', 'The Keep Between', ['west-mid', 'west-high', 'west-low', 'east-high', 'east-low'], 5);
  check('Level 10 has five separate spawn points', await page.evaluate(() => new Set(GameState.routes.map((r) => r.cells[0].join(','))).size === 5));
  check('Level 10: east roads reach the gate without crossing the brook', await page.evaluate(() => { const cp = GameState.currentLevel().chokepoint; return GameState.routes.filter((r) => r.id.startsWith('east')).every((r) => !r.cells.some(([c]) => c === cp.streamCol)); }));
  if (d10.mixed.phase === 'won') {
    check('Level 10 win is the finale: "The Hollow is healed!" with a campaign recap', (await page.locator('#end-title').innerText()) === 'The Hollow is healed!' && (await page.locator('#end-ribbon-text').textContent()) === 'Dawn breaks!' && await page.locator('#finale').isVisible());
    check('the finale recap shows all ten levels and a star total', await page.locator('#finale-badges .fb').count() === 10 && /of 30 stars/.test(await page.locator('#finale-total').innerText()));
    check('the finale keeps its fireworks going until the screen closes', await page.waitForFunction(() => Celebrate.running, null, { timeout: 15000 }).then(() => true, () => false));
    check('the finale card fits the screen (buttons reachable)', await page.evaluate(() => { const r = document.querySelector('#end .card').getBoundingClientRect(); return r.height <= innerHeight; }));
  }
  check('Level 10 win screen keeps "Choose another battle" (no Level 11 yet)', d10.mixed.phase !== 'won' || (await page.locator('#end-map-btn').innerText()) === 'Choose another battle');
  await page.evaluate(() => { document.getElementById('end').classList.remove('show'); });
  const mixed10 = d10.mixed;
  // ---- P3-FIX1: a finished level can never strand the player ----
  // the user's exact sequence: win, Choose another battle, the map pre-selects
  // this same level; its button used to "Hold" it, which did nothing.
  // Level 10 is the currently-last level, so this is where that scenario lives.
  if (mixed10.phase === 'won') {
    // hide the screen and press Pause in one step: the safety net can bring the screen back within
    // 1.5s, and a pointer click would then land on it instead of the button
    await page.evaluate(() => { document.getElementById('end').classList.remove('show'); document.getElementById('pause-btn').click(); });
    await page.waitForTimeout(200);
    check('after a win the pause button brings back the end screen', await page.locator('#end').isVisible());
    await page.evaluate(() => { document.getElementById('end').classList.remove('show'); });
    // the net waits 1.5s of wall-clock time; heavy software-rendered frames after a no-frame bot run can delay it
    const netBack = await page.locator('#end').waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false);
    check('safety net: a finished level with no screen showing gets its end screen back', netBack);
    await page.locator('#end-map-btn').click(); await page.waitForTimeout(300);
    const replayLabel = await page.locator('#wm-play-btn').innerText();
    check('the map offers to play the finished level again', replayLabel === 'Play The Keep Between again', replayLabel);
    await page.locator('#wm-play-btn').click();
    await page.waitForTimeout(2500);
    const fresh = await page.evaluate(() => ({ id: GameState.currentLevel().id, phase: GameState.state.phase, wave: GameState.state.wave, lives: GameState.state.lives }));
    check('playing it again lands in a fresh game of that level', fresh.id === 'keep-between' && fresh.phase === 'playing' && fresh.wave === 0 && fresh.lives === 20, JSON.stringify(fresh));
    await page.locator('#pause-btn').click(); await page.waitForTimeout(200);
    await page.locator('#pause-map-btn').click(); await page.waitForTimeout(300);
    check('the pause menu has a way out to the world map', await page.locator('#worldmap').isVisible());
    const backLabel = await page.locator('#wm-play-btn').innerText();
    check('from a paused battle the map offers to return to it', backLabel === 'Return to The Keep Between', backLabel);
    await page.locator('#wm-play-btn').click(); await page.waitForTimeout(250);
    check('returning brings back the pause menu, game still paused', await page.locator('#pause').isVisible() && await page.evaluate(() => GameState.state.paused && GameState.state.phase === 'playing'));
    await page.locator('#resume-btn').click(); await page.waitForTimeout(150);
  }
  await page.evaluate(() => { document.getElementById('end').classList.remove('show'); });
  await dawnStress(10, d10.F);
  await page.waitForTimeout(1600);
  await page.evaluate(() => { GameState.state.enemies.length = 0; document.getElementById('end').classList.remove('show'); });
  await ctx.close();

  // ---------------- Difficulty tiers (P3-D1), on a phone-sized landscape screen ----------------
  ctx = await makeContext(browser, { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  page = await ctx.newPage();
  watch(page, log);
  // a save from before tiers existed (no bramble fields), plus Level 1 won on Bramble
  await page.addInitScript(() => { if (!sessionStorage.getItem('tier-seeded')) { sessionStorage.setItem('tier-seeded', '1'); localStorage.setItem('bb-progress', JSON.stringify({ v: 1, levels: { 'shadow-hollow': { unlocked: true, stars: 3, bestLives: 18, bramble: { stars: 2, bestLives: 9 } }, 'millbrook-watch': { unlocked: true, stars: 2, bestLives: 10 } } })); } });
  await page.goto(PAGE);
  await page.waitForTimeout(1500);
  check('tiers: a fresh visit starts on Meadow with the level\'s own gold and lives', await page.evaluate(() => GameState.state.difficulty === 'meadow' && GameState.state.lives === 20 && GameState.state.gold === GameState.currentLevel().startGold));
  await page.locator('#start-btn').click(); await page.waitForTimeout(300);
  const tierBoxes = await page.evaluate(() => ['meadow', 'bramble'].map((t) => { const r = document.querySelector(`.tier-btn[data-tier="${t}"]`).getBoundingClientRect(); return { w: r.width, h: r.height, bottom: r.bottom }; }).concat([(() => { const r = document.getElementById('wm-play-btn').getBoundingClientRect(); return { w: r.width, h: r.height, bottom: r.bottom }; })()]));
  check('tiers: the picker sits beside Play, every button 44px and on screen at 844x390', tierBoxes.every((b) => b.w >= 44 && b.h >= 44 && b.bottom <= 390) && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(tierBoxes));
  check('tiers: Meadow is checked by default', (await page.locator('.tier-btn[data-tier="meadow"]').getAttribute('aria-checked')) === 'true');
  check('tiers: a level beaten on Bramble shows the thorn ring, others do not', await page.evaluate(() => !!document.querySelector('.wm-node[data-level="shadow-hollow"] .wm-thorn') && !document.querySelector('.wm-node[data-level="millbrook-watch"] .wm-thorn')));
  check('tiers: an old save without tier fields keeps its Meadow stars', await page.evaluate(() => Progress.starsFor('millbrook-watch') === 2 && Progress.starsFor('millbrook-watch', 'bramble') === 0));
  await page.locator('.tier-btn[data-tier="bramble"]').tap(); await page.waitForTimeout(200);
  const br = await page.evaluate(() => ({ checked: document.querySelector('.tier-btn[data-tier="bramble"]').getAttribute('aria-checked'), saved: localStorage.getItem('bb-difficulty'), s: GameState.state.difficulty, lives: GameState.state.lives, gold: GameState.state.gold, want: Math.round(GameState.currentLevel().startGold * GameState.DIFFICULTY.bramble.gold), wantLives: GameState.DIFFICULTY.bramble.lives, lit: document.querySelectorAll('.wm-node[data-level="shadow-hollow"] .wm-star.lit').length }));
  check('tiers: tapping Bramble picks it, saves it and applies it to the waiting level', br.checked === 'true' && br.saved === 'bramble' && br.s === 'bramble' && br.lives === br.wantLives && br.gold === br.want, JSON.stringify(br));
  check('tiers: node stars follow the picked tier', br.lit === 2, JSON.stringify(br));
  await page.reload(); await page.waitForTimeout(1500);
  check('tiers: the picked tier is remembered after a reload', await page.evaluate(() => GameState.state.difficulty === 'bramble' && GameState.state.lives === GameState.DIFFICULTY.bramble.lives));
  await page.locator('#start-btn').click(); await page.waitForTimeout(300);
  await page.locator('.wm-node[data-level="shadow-hollow"]').tap(); await page.waitForTimeout(150);
  await page.locator('#wm-play-btn').tap(); await page.waitForTimeout(300);
  check('tiers: the HUD lives pill marks a Bramble battle', await page.evaluate(() => GameState.state.phase === 'playing' && document.getElementById('hud-lives').parentElement.classList.contains('bramble')));
  await page.evaluate(() => GameState.pause()); await page.waitForTimeout(150);
  await page.locator('#pause-map-btn').tap(); await page.waitForTimeout(250);
  check('tiers: the picker is locked while returning to a battle in progress', await page.evaluate(() => document.getElementById('worldmap').classList.contains('show') && [...document.querySelectorAll('.tier-btn')].every((b) => b.disabled) && document.querySelector('.tier-btn[aria-checked="true"]').dataset.tier === 'bramble'));
  await page.locator('#wm-play-btn').tap(); await page.waitForTimeout(200);
  await page.evaluate(() => { document.getElementById('pause').classList.remove('show'); GameState.resume(); });
  // a Bramble win goes to the Bramble record only
  await page.evaluate(() => { GameState.state.lives = 14; GameState.state.phase = 'won'; GameState.emit('gameWon'); });
  check('tiers: a Bramble win is stored as Bramble stars and leaves Meadow stars alone', await page.evaluate(() => Progress.starsFor('shadow-hollow', 'bramble') === 3 && Progress.starsFor('shadow-hollow') === 3 && Progress.load().levels['shadow-hollow'].bestLives === 18 && Progress.load().levels['shadow-hollow'].bramble.bestLives === 14));
  // Level 1: Meadow 3 stars (state 4) and Bramble 3 stars give 4 * 4 + 3 = J, then 18 and 14 lives in base 36
  check('tiers: the BB2 save code carries the Bramble stars', await page.evaluate(() => Progress.exportCode().startsWith('BB2-JIE')), await page.evaluate(() => Progress.exportCode()));
  await page.locator('#end.show').waitFor({ timeout: 10000 }).catch(() => {});
  check('tiers: the Bramble win screen says so', await page.evaluate(() => document.getElementById('end').classList.contains('show') && document.getElementById('end-ribbon-text').textContent === 'Bramble won!'));
  await page.screenshot({ path: `${OUT}/tiers-bramble-win.png` });
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
  await cameraSettled(page);
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
