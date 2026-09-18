const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const fs = require('fs');
const path = require('path');
const THREE_LOCAL = process.env.THREE_LOCAL || path.join(__dirname, '..', 'node_modules/three/build/three.min.js');
const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?debug=1';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

async function makeContext(browser, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.route('**/three.min.js', (route) => route.fulfill({ path: THREE_LOCAL, contentType: 'application/javascript' }));
  return ctx;
}
function watch(page, log) {
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.push(`[console.${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => log.push(`[pageerror] ${e.message}`));
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const log = [];

  // ---- Desktop, mouse ----
  let ctx = await makeContext(browser, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  let page = await ctx.newPage();
  watch(page, log);
  await page.goto(PAGE);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/desktop.png` });
  const dbg = await page.locator('#debug').innerText();
  console.log('DEBUG OVERLAY:\n' + dbg);

  // helper: world cell -> screen via the page's own camera math (project through Renderer)
  const cellToScreen = async (c, r) => page.evaluate(([c, r]) => {
    // brute force: sample screen points and pick the one that maps to the cell
    for (let y = 0; y < innerHeight; y += 4) for (let x = 0; x < innerWidth; x += 4) {
      const cell = Renderer.screenToCell(x, y);
      if (cell && cell.c === c && cell.r === r) {
        // refine to the center of the cell region by scanning
        let sx = 0, sy = 0, n = 0;
        for (let yy = y; yy < innerHeight; yy += 2) for (let xx = 0; xx < innerWidth; xx += 2) {
          const cc = Renderer.screenToCell(xx, yy);
          if (cc && cc.c === c && cc.r === r) { sx += xx; sy += yy; n++; }
        }
        return [sx / n, sy / n];
      }
    }
    return null;
  }, [c, r]);

  const buildable = await page.evaluate(() => { for (let r = 0; r < 11; r++) for (let c = 0; c < 18; c++) if (GameState.isBuildable(c, r)) return [c, r]; });
  const nBuildable = await page.evaluate(() => { let n = 0; for (let r = 0; r < 11; r++) for (let c = 0; c < 18; c++) if (GameState.isBuildable(c, r)) n++; return n; });
  console.log('buildable tiles:', nBuildable, 'first:', buildable, 'path cells:', await page.evaluate(() => GameState.pathCells.length));

  const [bx, by] = await cellToScreen(6, 5);
  await page.mouse.click(bx, by);
  await page.waitForTimeout(150);
  console.log('mouse click buildable (6,5) -> selected:', JSON.stringify(await page.evaluate(() => GameState.state.selected)), 'toast:', await page.locator('#toast').innerText());
  const [px, py] = await cellToScreen(6, 6);
  await page.mouse.click(px, py);
  await page.waitForTimeout(150);
  console.log('mouse click path (6,6) -> selected:', JSON.stringify(await page.evaluate(() => GameState.state.selected)), 'toast:', await page.locator('#toast').innerText());
  const [sx, sy] = await cellToScreen(8, 2);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(150);
  console.log('mouse click stream (8,2) -> toast:', await page.locator('#toast').innerText());
  const [fx, fy] = await cellToScreen(1, 8);
  await page.mouse.click(fx, fy);
  await page.waitForTimeout(150);
  console.log('mouse click far (1,8) -> toast:', await page.locator('#toast').innerText());
  await page.mouse.click(bx, by);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/desktop-selected.png` });
  // zoom on the gnome for the outline check
  const [gx, gy] = await cellToScreen(6, 5);
  await page.screenshot({ path: `${OUT}/gnome-zoom.png`, clip: { x: gx - 80, y: gy - 120, width: 160, height: 170 } });
  const [hx, hy] = await cellToScreen(1, 2);
  await page.screenshot({ path: `${OUT}/hollow-zoom.png`, clip: { x: Math.max(0, hx - 160), y: Math.max(0, hy - 140), width: 340, height: 260 } });
  const [brx, bry] = await cellToScreen(8, 6);
  await page.screenshot({ path: `${OUT}/bridge-zoom.png`, clip: { x: brx - 130, y: bry - 110, width: 260, height: 200 } });
  const [kx, ky] = await cellToScreen(16, 9);
  await page.screenshot({ path: `${OUT}/bastion-zoom.png`, clip: { x: kx - 100, y: ky - 230, width: 300, height: 300 } });

  // drag should not count as a tap
  await page.evaluate(() => { GameState.state.selected = null; });
  await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + 60, py + 30, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(100);
  console.log('drag (no tap) -> selected:', JSON.stringify(await page.evaluate(() => GameState.state.selected)));

  // resize check
  await page.setViewportSize({ width: 900, height: 600 });
  await page.waitForTimeout(300);
  console.log('after resize canvas:', await page.evaluate(() => { const c = document.getElementById('game'); return [c.width, c.height, c.clientWidth, c.clientHeight]; }));
  await page.screenshot({ path: `${OUT}/desktop-900.png` });
  await ctx.close();

  // ---- Mobile, touch ----
  ctx = await makeContext(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page = await ctx.newPage();
  watch(page, log);
  await page.goto(PAGE);
  await page.waitForTimeout(1500);
  console.log('portrait rotate overlay visible:', await page.locator('#rotate').isVisible());
  await page.screenshot({ path: `${OUT}/mobile-portrait.png` });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  console.log('landscape rotate overlay visible:', await page.locator('#rotate').isVisible());
  const [tx, ty] = await page.evaluate(() => {
    for (let y = 0; y < innerHeight; y += 2) for (let x = 0; x < innerWidth; x += 2) { const c = Renderer.screenToCell(x, y); if (c && c.c === 9 && c.r === 5) return [x + 6, y + 6]; }
  });
  await page.touchscreen.tap(tx, ty);
  await page.waitForTimeout(150);
  console.log('touch tap (9,5) -> selected:', JSON.stringify(await page.evaluate(() => GameState.state.selected)), 'toast:', await page.locator('#toast').innerText());
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/mobile-landscape.png` });
  console.log('MOBILE DEBUG:\n' + await page.locator('#debug').innerText());
  await ctx.close();

  await browser.close();
  console.log('\nCONSOLE/PAGE ERRORS (' + log.length + '):'); log.forEach((l) => console.log('  ' + l));
})().catch((e) => { console.error('HARNESS FAILURE', e); process.exit(1); });
