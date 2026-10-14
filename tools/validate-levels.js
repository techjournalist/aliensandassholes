// Level authoring guard + multi-route engine tests (dev only, plain Node,
// no browser). Loads the real palette, level files and GameState into a vm
// context, then:
//   1. checks every level's roads against the rules the engine relies on;
//   2. drives a synthetic three-route level through the real GameState;
//   3. confirms single-route levels derive exactly what the pre-route
//      engine did (same cells, same length, same cobble tail).
// Run alone with `node tools/validate-levels.js`; tools/playtest.js also
// runs it first and counts its failures.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['palette-config.js', 'level1-shadow-hollow.js', 'level2-millbrook-watch.js', 'level3-cairnwatch.js', 'level4-splintered-vale.js', 'level5-elderroot-ward.js', 'level6-sunken-market.js', 'level7-amber-terraces.js', 'level8-frostpine-camp.js', 'dawn-kit.js', 'level9-flanked-keep.js', 'level10-keep-between.js', 'levels.js', 'game-state.js'];

function loadGame(consoleImpl = console) {
  const src = FILES.map((f) => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')).join('\n;\n')
    + '\n;this.__game = { LEVELS, GameState };';
  const ctx = { Math, console: consoleImpl };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'game-bundle.js' });
  return ctx.__game;
}

// Grid cells walked along a waypoint list, the way the engine does it.
function walk(wps) {
  const cells = [];
  for (let i = 0; i < wps.length - 1; i++) {
    const [ax, az] = wps[i], [bx, bz] = wps[i + 1];
    const dx = Math.sign(bx - ax), dz = Math.sign(bz - az);
    let x = ax, z = az;
    if (i === 0) cells.push([x, z]);
    while (x !== bx || z !== bz) { x += dx; z += dz; cells.push([x, z]); }
  }
  return cells;
}
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

// ---- 1. authoring rules for one level definition ----
function checkLevel(def) {
  const out = [];
  const add = (name, ok, detail = '') => out.push({ name: `${def.id}: ${name}`, ok, detail });
  const routes = def.routes || [{ id: 'main', waypoints: def.pathWaypoints }];
  const { cols, rows } = def.grid;
  const [cc, cr] = def.chokepoint.cell, streamCol = def.chokepoint.streamCol;
  const endpoint = def.endpoint.cells;
  for (const rt of routes) {
    const w = rt.waypoints;
    const diag = w.slice(1).findIndex((p, i) => p[0] !== w[i][0] && p[1] !== w[i][1]);
    add(`route ${rt.id}: every waypoint pair is a straight run`, diag < 0, diag >= 0 ? `pair ${diag}` : '');
    const cells = walk(w);
    add(`route ${rt.id}: stays on the grid`, cells.every(([c, r]) => c >= 0 && r >= 0 && c < cols && r < rows));
    const wet = cells.filter(([c]) => c === streamCol).filter(([c, r]) => !(c === cc && r === cr));
    add(`route ${rt.id}: crosses the stream only at the chokepoint`, wet.length === 0, JSON.stringify(wet));
    add(`route ${rt.id}: never walks through the endpoint`, !cells.some((p) => endpoint.some((e) => same(p, e))));
    const last = cells[cells.length - 1], gc = def.endpoint.gateCell;
    add(`route ${rt.id}: ends at the gate`, Math.max(Math.abs(last[0] - gc[0]), Math.abs(last[1] - gc[1])) <= 1, `${last} vs gate ${gc}`);
  }
  // roads that meet stay merged: from the first shared cell on, the rest match
  for (let i = 0; i < routes.length; i++) for (let j = i + 1; j < routes.length; j++) {
    const a = walk(routes[i].waypoints), b = walk(routes[j].waypoints);
    const ai = a.findIndex((p) => b.some((q) => same(p, q)));
    if (ai < 0) { add(`routes ${routes[i].id}/${routes[j].id}: share the gate approach`, false, 'never meet'); continue; }
    const bi = b.findIndex((q) => same(q, a[ai]));
    const ta = a.slice(ai), tb = b.slice(bi);
    add(`routes ${routes[i].id}/${routes[j].id}: stay merged once they meet`, ta.length === tb.length && ta.every((p, k) => same(p, tb[k])));
  }
  const onRoad = routes.some((rt) => walk(rt.waypoints).some((p) => same(p, [cc, cr])));
  add('the chokepoint is on a road', onRoad);
  return out;
}

// ---- 2. a synthetic three-route level through the real engine ----
function syntheticLevel() {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });
  return {
    id: 'synthetic-vale', index: 99, name: 'Test Vale', subtitle: '', grid: { cols: 14, rows: 9 },
    spawn: [0, 1],
    routes: [
      { id: 'north', waypoints: [[0, 1], [6, 1], [6, 4], [12, 4]] },
      { id: 'south', waypoints: [[0, 6], [3, 6], [3, 4], [12, 4]] },
      { id: 'long', waypoints: [[0, 8], [9, 8], [9, 7], [4, 7], [4, 4], [12, 4]] },
    ],
    chokepoint: { cell: [10, 4], streamCol: 10 },
    endpoint: { name: 'the test hut', properName: 'The Test Hut', cells: [[13, 3], [13, 4], [13, 5]], gateCell: [13, 4] },
    cobbleTailCells: 2,
    theme: { center: [0, 0], radiusOut: { x: 3, z: 3 }, radiusIn: 1, falloffWidth: 0.5 },
    waves: [
      { name: 'Together', flavor: '', groups: [g('grunt', 2, 1, 0, 'north', 0), g('grunt', 2, 1, 0, 'south', 0), g('trickster', 1, 1, 0, 'long', 0.5)] },
      { name: 'In turn', flavor: '', groups: [g('grunt', 2, 1), g('grunt', 1, 1, 2, 'long')] },
    ],
    prepSeconds: 5, startGold: 999, startLives: 20, starThresholds: [16, 8], tipTile: [5, 2],
    endScreenText: {}, buildScene() {},
  };
}

function engineTests(G) {
  const out = [];
  const add = (name, ok, detail = '') => out.push({ name: `routes engine: ${name}`, ok, detail });
  const def = syntheticLevel();
  for (const r of checkLevel(def)) out.push({ ...r, name: 'synthetic ' + r.name });
  G.loadLevel(def);
  G.startGame();
  const S = G.state;
  add('three routes are built', G.routes.length === 3 && G.routes.map((r) => r.id).join() === 'north,south,long');
  add('every route start is a spawn', G.isSpawn(0, 1) && G.isSpawn(0, 6) && G.isSpawn(0, 8) && !G.isSpawn(5, 1));
  add('the shared tail is laid once in the union', G.pathCells.filter(([c, r]) => c === 11 && r === 4).length === 1);
  add('cells from every route count as road', G.isPath(6, 2) && G.isPath(3, 5) && G.isPath(6, 7));
  add('cobble tail comes from the primary route', G.isCobble(12, 4) && G.isCobble(11, 4) && !G.isCobble(10, 4));

  // an enemy sent down one road walks that road and leaks at the shared gate
  const cellsOf = (id) => G.routes.find((r) => r.id === id).cells;
  let leaked = 0; G.on('enemyLeaked', () => leaked++);
  const e = G.spawnEnemy('grunt', 'long');
  let worst = 0, steps = 0;
  const longCells = cellsOf('long'), longRoute = G.routes.find((r) => r.id === 'long');
  // measured up to the road's last waypoint; the final step through the
  // endpoint's door leaves the road by design
  const roadEnd = longRoute.lens[longRoute.points.length - 2];
  while (S.enemies.includes(e) && steps++ < 60 * 60) {
    G.update(1 / 60);
    if (!S.enemies.includes(e) || e.dist > roadEnd) continue;
    const d = Math.min(...longCells.map(([c, r]) => Math.hypot(G.worldX(c) - e.x, G.worldZ(r) - e.z)));
    worst = Math.max(worst, d);
  }
  // a grunt walks up to 0.22 off-center and cell centers are 0.5 apart, so
  // staying on its road means never more than ~0.55 from one of its cells
  add('an enemy on the long road walks the long road', worst < 0.6, `max distance from road ${worst.toFixed(2)}`);
  add('it leaks at the shared gate', leaked === 1 && !S.enemies.includes(e));

  // targeting prefers whoever is closest to the gate, across roads of different lengths
  S.selected = { kind: 'tile', c: 7, r: 5 };
  const placed = G.placeTower('slinger');
  const tower = S.towers[S.towers.length - 1];
  const near = G.spawnEnemy('grunt', 'north'), far = G.spawnEnemy('grunt', 'long');
  const longLen = G.routes[2].length, northLen = G.routes[0].length;
  // "far" has walked much further (the long road) but still has 7 to go;
  // "near" has walked less but has only 3 left. The old rule (most distance
  // walked) picks "far"; closest-to-the-gate must pick "near".
  near.dist = northLen - 3; far.dist = longLen - 7;
  for (const en of [near, far]) { en.x = tower.x + 0.5; en.z = tower.z; }
  S.enemies.length = 0; S.enemies.push(far, near);
  tower.cooldown = 0; tower.windup = 0; tower.targetId = null;
  G.update(1 / 600);
  add('the slinger was placed for the targeting test', placed.ok !== false && !!tower);
  add('the targeting case really separates the two rules', far.dist > near.dist, `walked far=${far.dist.toFixed(1)} near=${near.dist.toFixed(1)}`);
  add('towers target the enemy with the least road left, across routes', tower.targetId === near.id, `picked ${tower.targetId}, near=${near.id} (left ${(northLen - near.dist).toFixed(1)}) far=${far.id} (left ${(longLen - far.dist).toFixed(1)})`);
  S.enemies.length = 0; S.projectiles.length = 0; S.towers.length = 0;

  // wave groups: `route` picks the road, `at` runs groups at the same time
  S.wave = 0; S.waveActive = false; S.prep = 0;
  G.startWave();
  const sched = S.schedule.map((x) => [x.t.toFixed(2), x.type, x.route]);
  add('groups with `at` start together on their own roads', sched[0][0] === '0.60' && sched[1][0] === '0.60' && new Set(sched.slice(0, 2).map((x) => x[2])).size === 2, JSON.stringify(sched));
  add('the schedule is in time order', S.schedule.every((x, i) => i === 0 || S.schedule[i - 1].t <= x.t));
  let routesSeen = new Set();
  for (let i = 0; i < 60 * 3; i++) { G.update(1 / 60); for (const en of S.enemies) routesSeen.add(en.route); }
  add('spawned enemies carry the group\'s route', routesSeen.has(0) && routesSeen.has(1) && routesSeen.has(2), JSON.stringify([...routesSeen]));
  S.enemies.length = 0; S.schedule = []; S.waveQueue = []; S.waveActive = false;
  G.startWave();
  const seq = S.schedule.map((x) => +x.t.toFixed(2));
  add('groups without `at` still run one after another', JSON.stringify(seq) === JSON.stringify([0.6, 1.6, 4.6]), JSON.stringify(seq));
  return out;
}

// ---- 3. single-route levels derive exactly what the old engine did ----
function legacyTests(G, LEVELS) {
  const out = [];
  for (const def of LEVELS) {
    if (def.routes) continue;
    G.loadLevel(def);
    const cells = walk(def.pathWaypoints);
    const pts = def.pathWaypoints.map(([c, r]) => ({ x: G.worldX(c), z: G.worldZ(r) })).concat([G.gate]);
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    const cobbleOld = cells.slice(cells.length - def.cobbleTailCells);
    const ok = JSON.stringify(G.pathCells) === JSON.stringify(cells)
      && G.routes.length === 1
      // a curvy level cuts its corners, so its road is shorter than the grid
      // polyline but not by much; a straight one matches exactly
      && (def.curvyRoads ? (G.routes[0].length < len && G.routes[0].length > len * 0.8) : Math.abs(G.routes[0].length - len) < 1e-9)
      && cells.every(([c, r]) => G.isCobble(c, r) === cobbleOld.some((p) => same(p, [c, r])))
      && G.isSpawn(def.spawn[0], def.spawn[1]);
    out.push({ name: `${def.id}: single-route level derives exactly the pre-route path`, ok });
  }
  return out;
}

// ---- 3b. a rounded road stays on its cells (curvyRoads levels) ----
function curveTests(G, LEVELS) {
  const out = [];
  for (const def of LEVELS) {
    if (!def.curvyRoads) continue;
    G.loadLevel(def);
    for (const rt of G.routes) {
      const worst = Math.max(...rt.points.map((p) => Math.min(...rt.cells.map(([c, r]) => Math.hypot(G.worldX(c) - p.x, G.worldZ(r) - p.z)))));
      out.push({ name: `${def.id}: route ${rt.id} stays within 0.75 cells of its grid cells when rounded`, ok: worst < 0.75, detail: `worst ${worst.toFixed(2)}` });
      const a = rt.points[0], b = rt.points[rt.points.length - 1];
      out.push({ name: `${def.id}: route ${rt.id} still starts on its spawn cell and ends at the gate`, ok: Math.hypot(a.x - G.worldX(rt.cells[0][0]), a.z - G.worldZ(rt.cells[0][1])) < 1e-9 && Math.hypot(b.x - G.gate.x, b.z - G.gate.z) < 1e-9 });
    }
  }
  return out;
}

// ---- 3c. curveKeepsPace: a rounded road takes as long to walk as the straight one ----
function paceTests(G, LEVELS) {
  const out = [];
  const walkTime = (def, routeId) => {
    G.loadLevel(def); G.startGame();
    const e = G.spawnEnemy('grunt', routeId);
    e.lane = 0;
    let t = 0;
    while (G.state.enemies.includes(e) && t < 300) { G.update(1 / 60); t += 1 / 60; }
    return t;
  };
  for (const def of LEVELS) {
    if (!def.curvyRoads || !def.curveKeepsPace) continue;
    const ids = (def.routes || [{ id: 'main' }]).map((r) => r.id);
    const worst = Math.max(...ids.map((id) => {
      const curved = walkTime(def, id), straight = walkTime({ ...def, curvyRoads: false }, id);
      return Math.abs(curved - straight) / straight;
    }));
    out.push({ name: `${def.id}: curved roads keep the straight road's walking time (every route within 1%)`, ok: worst < 0.01, detail: `worst ${(worst * 100).toFixed(2)}%` });
  }
  return out;
}

// ---- 3d. progress: a win is never lost (P3-FIX3) ----
function progressTests() {
  const out = [];
  const add = (name, ok, detail = '') => out.push({ name: `progress: ${name}`, ok, detail });
  const store = (opts = {}) => {
    const m = new Map();
    return {
      m,
      getItem: (k) => (opts.nullRead ? null : (m.has(k) ? m.get(k) : null)),
      setItem: (k, v) => { if (opts.failWrite) throw new Error('quota'); m.set(k, String(v)); },
      removeItem: (k) => m.delete(k),
    };
  };
  const make = (local, session) => {
    const src = FILES.concat(['progress.js']).map((f) => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')).join('\n;\n') + '\n;this.__p = Progress;';
    const ctx = { Math, console, localStorage: local, sessionStorage: session };
    vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'progress-bundle.js' });
    return ctx.__p;
  };
  const NEXT = 'amber-terraces', WON = 'sunken-market';

  let local = store(), session = store(), P = make(local, session);
  P.recordWin(WON, 2, 8);
  add('a win unlocks the next level and saves it', P.isUnlocked(NEXT) && P.starsFor(WON) === 2 && JSON.parse(local.m.get('bb-progress')).levels[NEXT].unlocked === true);

  local = store({ failWrite: true }); session = store(); P = make(local, session);
  P.recordWin(WON, 2, 8);
  add('a win survives localStorage refusing the write (same page)', P.isUnlocked(NEXT) && P.starsFor(WON) === 2);
  const reloaded = make(store({ failWrite: true }), session);
  add('and survives a reload through the session backup', reloaded.isUnlocked(NEXT) && reloaded.starsFor(WON) === 2);

  local = store({ nullRead: true }); session = store(); P = make(local, session);
  P.recordWin(WON, 3, 12);
  add('a win survives localStorage reading back empty or stale', P.isUnlocked(NEXT) && P.starsFor(WON) === 3);

  local = store(); session = store();
  local.m.set('bb-progress', JSON.stringify({ v: 1, levels: { [WON]: { unlocked: true, stars: 2, bestLives: 5 }, [NEXT]: { unlocked: false, stars: 0, bestLives: null } } }));
  P = make(local, session);
  add('a level with stars always opens the next one (a half-saved win heals)', P.isUnlocked(NEXT));

  local = store(); session = store(); P = make(local, session);
  P.recordWin(WON, 3, 12); P.recordWin(WON, 1, 4);
  add('a worse replay never lowers stars or best lives', P.starsFor(WON) === 3 && P.load().levels[WON].bestLives === 12);

  local = store(); session = store(); local.m.set('bb-progress', '{not json');
  let threw = false, ok = false;
  try { P = make(local, session); P.recordWin(WON, 1, 3); ok = P.isUnlocked(NEXT); } catch (e) { threw = true; }
  add('a corrupt save does not throw and a new win still counts', !threw && ok);

  local = store(); session = store(); P = make(local, session);
  P.recordWin(WON, 2, 8); P.recordWin(WON, 2, 8);
  add('recording the same win twice changes nothing', P.starsFor(WON) === 2 && P.load().levels[WON].bestLives === 8);

  // ---- save code ----
  const FIRST = 'shadow-hollow';
  local = store(); session = store(); P = make(local, session);
  P.recordWin(FIRST, 3, 17); P.recordWin('millbrook-watch', 2, 9); P.recordWin(WON, 1, 3);
  const code = P.exportCode();
  add('save code has the BB1 prefix and dash groups', /^BB1(-[0-9A-Z]{1,4})+$/.test(code), code);
  const fresh = make(store(), store());
  const r1 = fresh.importCode(code);
  const a = P.load().levels, b = fresh.load().levels;
  add('a code round-trips stars, best lives and unlocks to a fresh device', r1.ok && r1.changed >= 3 && Object.keys(a).every((id) => a[id].unlocked === b[id].unlocked && a[id].stars === b[id].stars && (a[id].stars === 0 || a[id].bestLives === b[id].bestLives)), JSON.stringify(r1));
  add('the same code regenerates identically after loading', fresh.exportCode() === code);
  add('lowercase and stray spaces are accepted', make(store(), store()).importCode('  ' + code.toLowerCase().replace(/-/g, ' - ') + ' \n').ok);
  const typo = code.slice(0, 6) + (code[6] === '2' ? '3' : '2') + code.slice(7);
  add('a single mistyped character is caught', make(store(), store()).importCode(typo).reason === 'check', typo);
  add('a missing character is caught', make(store(), store()).importCode(code.slice(0, -1)).ok === false);
  const bad = make(store(), store());
  add('empty input says empty', bad.importCode('   ').reason === 'empty');
  add('other text says format', bad.importCode('hello there').reason === 'format' && bad.importCode(null).reason === 'empty' && bad.importCode('BB2-AAAA').reason === 'format');
  add('garbage after the prefix says check, never throws', bad.importCode('BB1-!!!!').reason === 'check' && bad.importCode('BB1-').reason === 'check');
  add('a rejected code changes nothing', JSON.stringify(bad.load()) === JSON.stringify(make(store(), store()).load()));
  // loading never takes anything away
  local = store(); session = store(); const rich = make(local, session);
  rich.recordWin(FIRST, 3, 20); rich.recordWin('millbrook-watch', 3, 18);
  const lowCode = make(store(), store()); lowCode.recordWin(FIRST, 1, 2);
  const r2 = rich.importCode(lowCode.exportCode());
  add('loading an older code never lowers stars or best lives', r2.ok && r2.changed === 0 && rich.starsFor(FIRST) === 3 && rich.load().levels[FIRST].bestLives === 20 && rich.starsFor('millbrook-watch') === 3);
  // a code from a build with fewer or more levels
  const body = code.slice(4).replace(/-/g, '');
  add('a code with every level locked loads without effect', (() => { const z = make(store(), store()); const c = z.exportCode(); return z.importCode(c).ok; })());
  add('a code that is first-level-only still works', (() => { const z = make(store(), store()); z.recordWin(FIRST, 2, 5); const f = make(store(), store()); const res = f.importCode(z.exportCode()); return res.ok && f.starsFor(FIRST) === 2 && f.isUnlocked('millbrook-watch'); })());
  add('save code holds two characters per level plus two check characters', body.length === 2 * Object.keys(make(store(), store()).load().levels).length + 2, `${body.length} chars`);

  // ---- difficulty tiers (P3-D1): stars per tier, old saves still load ----
  local = store(); session = store();
  local.m.set('bb-progress', JSON.stringify({ v: 1, levels: { [FIRST]: { unlocked: true, stars: 2, bestLives: 11 } } }));
  P = make(local, session);
  const old = P.load().levels[FIRST];
  add('an old v1 save without tier fields still loads its Meadow stars', old.stars === 2 && old.bestLives === 11 && P.isUnlocked('millbrook-watch'));
  add('and gets an empty Bramble record filled in', old.bramble && old.bramble.stars === 0 && old.bramble.bestLives === null && P.starsFor(FIRST, 'bramble') === 0);
  P.recordWin(FIRST, 3, 13, 'bramble');
  const saved = JSON.parse(local.m.get('bb-progress'));
  add('a Bramble win is stored apart from Meadow, still as v: 1', saved.v === 1 && saved.levels[FIRST].bramble.stars === 3 && saved.levels[FIRST].bramble.bestLives === 13 && saved.levels[FIRST].stars === 2 && saved.levels[FIRST].bestLives === 11);
  add('starsFor reads one tier at a time (Meadow by default)', P.starsFor(FIRST) === 2 && P.starsFor(FIRST, 'meadow') === 2 && P.starsFor(FIRST, 'bramble') === 3);
  P.recordWin(FIRST, 1, 2, 'bramble');
  add('a worse Bramble replay never lowers Bramble stars or best lives', P.starsFor(FIRST, 'bramble') === 3 && P.load().levels[FIRST].bramble.bestLives === 13);
  local = store(); session = store(); P = make(local, session);
  P.recordWin(WON, 1, 4, 'bramble');
  add('a level won only on Bramble counts as won and opens the next one', P.isWon(WON) && P.starsFor(WON) === 0 && P.isUnlocked(NEXT));
  // a Bramble-only win that was half saved (no unlock written) still heals
  local = store(); session = store();
  local.m.set('bb-progress', JSON.stringify({ v: 1, levels: { [WON]: { unlocked: true, stars: 0, bestLives: null, bramble: { stars: 2, bestLives: 9 } } } }));
  add('a half-saved Bramble win still opens the next level', make(local, session).isUnlocked(NEXT));
  // merging copies takes the best of each tier separately
  local = store(); session = store();
  local.m.set('bb-progress', JSON.stringify({ v: 1, levels: { [WON]: { unlocked: true, stars: 3, bestLives: 18, bramble: { stars: 1, bestLives: 2 } } } }));
  session.m.set('bb-progress-session', JSON.stringify({ v: 1, levels: { [WON]: { unlocked: true, stars: 1, bestLives: 5, bramble: { stars: 2, bestLives: 7 } } } }));
  const mg = make(local, session).load().levels[WON];
  add('merging copies keeps the best of each tier', mg.stars === 3 && mg.bestLives === 18 && mg.bramble.stars === 2 && mg.bramble.bestLives === 7, JSON.stringify(mg));
  // a BB1 code (Meadow only) never touches Bramble progress
  local = store(); session = store(); P = make(local, session);
  P.recordWin(FIRST, 2, 12, 'bramble');
  const meadowCode = make(store(), store()); meadowCode.recordWin(FIRST, 3, 18);
  P.importCode(meadowCode.exportCode());
  add('loading a BB1 code adds Meadow stars and keeps Bramble stars', P.starsFor(FIRST) === 3 && P.starsFor(FIRST, 'bramble') === 2);
  // the remembered tier
  local = store(); session = store(); P = make(local, session);
  add('the tier defaults to Meadow', P.tier() === 'meadow');
  P.setTier('bramble');
  add('a picked tier is remembered across a reload', local.m.get('bb-difficulty') === 'bramble' && make(local, store()).tier() === 'bramble');
  local.m.set('bb-difficulty', 'nightmare');
  add('an unknown saved tier reads as Meadow', make(local, store()).tier() === 'meadow');
  add('blocked storage reads as Meadow and never throws', (() => { const z = make(store({ failWrite: true, nullRead: true }), store()); z.setTier('bramble'); return z.tier() === 'meadow'; })());
  return out;
}

// ---- 3e. difficulty tiers (P3-D1) ----
// Meadow golden runs: the harness mixed bot, seeded, on the engine from before
// tiers existed (commit 4939813). [lives, gold, kills] for seeds 1 and 2. A
// deliberate change to a level's waves or economy will move these; regenerate
// them then with `node tools/bot-runner.js all --seeds 2 --json`.
const MEADOW_GOLDEN = {"shadow-hollow":[[13,298,172],[8,156,171]],"millbrook-watch":[[9,135,124],[11,99,126]],"cairnwatch":[[7,129,192],[16,300,197]],"splintered-vale":[[4,292,188],[7,346,191]],"elderroot-ward":[[15,316,237],[15,339,237]],"sunken-market":[[10,335,155],[6,289,151]],"amber-terraces":[[2,136,171],[3,175,172]],"frostpine-camp":[[7,140,174],[5,40,172]],"flanked-keep":[[16,317,172],[18,333,174]],"keep-between":[[11,313,147],[3,341,139]]};
function difficultyTests(G, LEVELS) {
  const out = [];
  const add = (name, ok, detail = '') => out.push({ name: `difficulty: ${name}`, ok, detail });
  const D = G.DIFFICULTY, M = D.meadow, B = D.bramble;
  add('Meadow is every multiplier at 1 and the level\'s own lives', M.hp === 1 && M.speed === 1 && M.gold === 1 && M.bounty === 1 && !M.lives);
  add('Bramble is harder on every axis', B.hp > 1 && B.speed >= 1 && B.gold < 1 && B.bounty <= 1 && B.lives < 20, JSON.stringify(B));

  // Meadow: the same numbers as each level file
  G.setDifficulty('meadow');
  const bad = [];
  for (const def of LEVELS) {
    G.loadLevel(def);
    if (G.state.gold !== def.startGold || G.state.lives !== def.startLives || G.state.difficulty !== 'meadow') bad.push(def.id);
  }
  add('Meadow starts every level with the level file\'s gold and lives', !bad.length, bad.join(' '));
  const def = LEVELS[0];
  G.loadLevel(def); G.state.phase = 'playing'; G.state.hpScale = 1.3;
  const T = G.ENEMY_TYPES;
  const mOk = Object.keys(T).every((id) => { const e = G.spawnEnemy(id); return e.hp === Math.round(T[id].hp * 1.3) && e.speed === T[id].speed && e.bounty === T[id].bounty; });
  add('Meadow enemies spawn with their table hp, speed and bounty', mOk);
  G.state.lives = 16; add('Meadow keeps 16 and 8 lives as the star lines', G.stars() === 3 && ((G.state.lives = 15), G.stars() === 2) && ((G.state.lives = 8), G.stars() === 2) && ((G.state.lives = 7), G.stars() === 1));

  // Bramble: every multiplier applies
  G.setDifficulty('bramble');
  const badB = [];
  for (const d of LEVELS) {
    G.loadLevel(d);
    if (G.state.gold !== Math.round(d.startGold * B.gold) || G.state.lives !== B.lives || G.state.startLives !== B.lives || G.state.difficulty !== 'bramble') badB.push(d.id);
  }
  add(`Bramble starts every level with ${Math.round(B.gold * 100)}% gold and ${B.lives} lives`, !badB.length, badB.join(' '));
  G.loadLevel(def); G.state.phase = 'playing'; G.state.hpScale = 1.3;
  const bOk = Object.keys(T).every((id) => { const e = G.spawnEnemy(id); return e.hp === Math.round(T[id].hp * 1.3 * B.hp) && Math.abs(e.speed - T[id].speed * B.speed) < 1e-9 && e.bounty === Math.round(T[id].bounty * B.bounty); });
  add('Bramble enemies spawn with scaled hp, speed and bounty', bOk);
  const grunt = G.spawnEnemy('grunt'), gold0 = G.state.gold;
  G.state.enemies.length = 0; G.state.enemies.push(grunt); grunt.hp = 1; grunt.armor = 0;
  // a kill pays the scaled bounty
  const tw = { x: grunt.x, z: grunt.z };
  G.state.projectiles.push({ id: 999, towerId: 0, targetId: grunt.id, damage: 5, splash: 0, effect: null, hitsFlying: false, pierce: false, x: tw.x, z: tw.z, sx: tw.x, sz: tw.z, speed: 9, t: 0, total: 1 });
  G.update(1 / 60);
  add('a Bramble kill pays the scaled bounty', G.state.gold - gold0 === Math.round(T.grunt.bounty * B.bounty), `${G.state.gold - gold0}`);
  const k = B.lives / 20, three = Math.round(16 * k), two = Math.round(8 * k);
  G.state.lives = three; const s3 = G.stars(); G.state.lives = three - 1; const s2 = G.stars(); G.state.lives = two - 1; const s1 = G.stars();
  add(`Bramble star lines scale with its lives (${three} and ${two} of ${B.lives})`, s3 === 3 && s2 === 2 && s1 === 1);
  // the endpoint's damage states follow the tier's lives too
  G.loadLevel(def); G.state.phase = 'playing';
  const states = [];
  G.on('endpointStateChanged', (st) => states.push([st, G.state.lives]));
  for (let i = 0; i < B.lives - 1; i++) { const e = G.spawnEnemy('grunt'); e.dist = 1e9; G.update(1 / 60); }
  add('the Bastion\'s damage states swap at 65% and 30% of Bramble\'s lives', states.length === 2 && states[0][1] === Math.floor(B.lives * 0.65) && states[1][1] === Math.floor(B.lives * 0.3), JSON.stringify(states));

  // changing tier before a level starts resets its gold and lives; after, it does nothing
  G.setDifficulty('meadow'); G.loadLevel(def);
  G.setDifficulty('bramble');
  add('picking Bramble on a level not yet started applies at once', G.state.lives === B.lives && G.state.gold === Math.round(def.startGold * B.gold) && G.state.difficulty === 'bramble');
  G.startGame(); G.state.gold = 77; G.setDifficulty('meadow');
  add('picking a tier mid-battle leaves that battle alone', G.state.gold === 77 && G.state.lives === B.lives && G.state.difficulty === 'bramble');
  add('an unknown tier falls back to Meadow', G.setDifficulty('nightmare') === 'meadow' && G.difficulty === 'meadow');
  G.setDifficulty('meadow');
  return out;
}

// Meadow must replay today's battles exactly: seeded mixed-bot runs on every
// level match the pre-tier engine's lives, gold and kills.
function meadowGoldenTests() {
  const out = [];
  const runner = require('./bot-runner');
  const game = runner.loadGame();
  for (const [id, runs] of Object.entries(MEADOW_GOLDEN)) {
    const got = runs.map((_, i) => { const r = runner.runOne(game, id, { seed: i + 1, tier: 'meadow' }); return [r.lives, r.gold, r.kills]; });
    out.push({ name: `difficulty: Meadow replays ${id} exactly (2 seeded runs: lives, gold, kills)`, ok: JSON.stringify(got) === JSON.stringify(runs), detail: `${JSON.stringify(got)} vs ${JSON.stringify(runs)}` });
  }
  return out;
}

// ---- 4. a failing listener can never stop the game from ending ----
// (P3-FIX1: GameState.emit used to call listeners with no protection, so one
// exception during the last wave's end would have skipped the win entirely.)
function isolationTests() {
  const errors = [];
  const { GameState: G } = loadGame({ ...console, error: (...a) => errors.push(a.map(String).join(' ')), log: () => {} });
  const def = syntheticLevel();
  G.loadLevel(def);
  G.startGame();
  let won = 0, after = 0;
  G.on('waveEnded', () => { throw new Error('boom from a test listener'); });
  G.on('waveEnded', () => { after++; });
  G.on('gameWon', () => { won++; });
  const S = G.state;
  S.wave = def.waves.length; S.waveActive = true; S.schedule = []; S.waveQueue = []; S.enemies.length = 0;
  G.update(1 / 60);
  return [
    { name: 'listener isolation: a throwing waveEnded listener does not stop the win', ok: S.phase === 'won' && won === 1, detail: `phase=${S.phase} won=${won}` },
    { name: 'listener isolation: listeners after the failing one still run', ok: after === 1 },
    { name: 'listener isolation: the failure is reported once, with its event', ok: errors.length === 1 && G.lastError && G.lastError.event === 'waveEnded', detail: JSON.stringify(G.lastError) },
  ];
}

function validate() {
  const { LEVELS, GameState } = loadGame();
  const results = [];
  for (const def of LEVELS) results.push(...checkLevel(def));
  results.push(...legacyTests(GameState, LEVELS));
  results.push(...curveTests(GameState, LEVELS));
  results.push(...paceTests(GameState, LEVELS));
  results.push(...progressTests());
  results.push(...difficultyTests(GameState, LEVELS));
  results.push(...meadowGoldenTests());
  results.push(...engineTests(GameState));
  results.push(...isolationTests());
  return results;
}

module.exports = { validate, checkLevel };

if (require.main === module) {
  const results = validate();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
  }
  console.log(failed ? `${failed} FAILED` : `ALL ${results.length} PASSED`);
  process.exit(failed ? 1 : 0);
}
