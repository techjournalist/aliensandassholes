// Browser-free seeded bot runner (dev only, plain Node, no browser).
// Runs the harness's mixed bot (tools/playtest.js runBot/runBotOn) over the
// real level files and GameState inside a Node vm, with Math.random seeded,
// so a run is repeatable and about a second per 30 runs. Used for balance
// tuning (AGENTS.md P3-V12) and to prove Meadow plays exactly as before
// difficulty tiers (AGENTS.md P3-D1).
//
//   node tools/bot-runner.js [level|all] [--tier meadow|bramble] [--seeds N]
//        [--from S] [--engine path/to/game-state.js] [--json]
//
// --engine swaps in another game-state.js (for example one taken from an
// older commit with `git show <rev>:js/game-state.js`), so two engines can be
// compared on identical seeds.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const FIX = require('./level-fixtures');

const ROOT = path.join(__dirname, '..');
const FILES = ['palette-config.js', 'level-common.js', 'level1-hollybrook.js', 'level2-ravensford.js', 'level3-st-wendels.js', 'level4-castle-aldermere.js', 'levels.js', 'game-state.js'];

// Every level's mixed plan lives in tools/level-fixtures.js (botPlan).
const PLANS = {};

// A Math whose random() is a resettable Park-Miller generator (the harness's own seeding).
function seededMath() {
  const M = Object.create(Math);
  let seed = 1;
  M.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  M.reseed = (s) => { seed = (Math.abs(Math.floor(s)) % 2147483646) + 1; };
  return M;
}

function loadGame(enginePath) {
  const M = seededMath();
  const src = FILES.map((f) => fs.readFileSync(f === 'game-state.js' && enginePath ? enginePath : path.join(ROOT, 'js', f), 'utf8')).join('\n;\n')
    + '\n;this.__game = { LEVELS, GameState };';
  const ctx = { Math: M, console };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'game-bundle.js' });
  const game = { ...ctx.__game, M, bossLog: null, leakLog: null };
  game.GameState.on('enemyLeaked', (e) => {
    if (e.boss && game.bossLog) game.bossLog.push({ wave: game.GameState.state.wave, hp: e.hp, maxHp: e.maxHp });
    if (game.leakLog) game.leakLog.push(`w${game.GameState.state.wave}:${e.type}`);
  });
  return game;
}

// One seeded run of the mixed bot on a fresh load of the level.
// Returns lives, gold, kills, the leak per wave and, for a boss leak, its hp left.
function runOne(game, levelId, { seed = 1, tier = 'meadow', plan, spots, pick = 'alt' } = {}) {
  const { LEVELS, GameState: G, M } = game;
  const def = LEVELS.find((l) => l.id === levelId);
  const F = FIX[levelId];
  plan = plan || PLANS[levelId] || F.botPlan;
  spots = spots || F.botBuildSpots;
  if (G.setDifficulty) G.setDifficulty(tier);
  else if (tier !== 'meadow') throw new Error('this engine has no difficulty tiers');
  M.reseed(seed);
  G.loadLevel(def);
  const S = G.state;
  S.phase = 'playing';
  const bossLeaks = game.bossLog = [];
  const leakTypes = game.leakLog = [];
  const branchFor = (t) => {
    const keys = Object.keys(G.BRANCHES[t.type]);
    if (pick !== 'alt') return keys[pick];
    if (G.TOWER_TYPES[t.type].hitsFlying) return keys.find((k) => !G.BRANCHES[t.type][k].groundSplash);
    return keys[t.id % 2];
  };
  const flyersIn = (n) => { const w = G.waveInfo(n); return !!w && w.groups.some((g) => G.ENEMY_TYPES[g.type].flying); };
  const antiAir = () => S.towers.filter((t) => G.TOWER_TYPES[t.type].hitsFlying).length;
  let next = 0;
  const act = () => {
    while (next < spots.length) {
      let type = plan[next % plan.length];
      const upcoming = S.waveActive ? S.wave : S.wave + 1;
      if (plan.length > 1 && flyersIn(upcoming) && antiAir() < 2 + Math.floor(upcoming / 4)) type = antiAir() % 2 ? 'artillery' : 'druid';
      if (S.gold < G.TOWER_TYPES[type].cost) break;
      S.selected = { kind: 'tile', c: spots[next][0], r: spots[next][1] };
      if (!G.placeTower(type).ok) { next++; continue; }
      next++;
    }
    const order = S.towers.slice().sort((a, b) => (G.TOWER_TYPES[b.type].hitsFlying - G.TOWER_TYPES[a.type].hitsFlying));
    for (const t of order) { const c = G.upgradeCost(t); if (c !== null && S.gold >= c + 40) G.upgradeTower(t.id, branchFor(t)); }
  };
  const leaks = [];
  const total = def.waves.length;
  for (let w = 1; w <= total; w++) {
    act();
    const l0 = S.lives;
    G.startWave();
    let steps = 0;
    while (S.waveActive && steps++ < 60 * 150) { G.update(1 / 60); if (steps % 120 === 0) act(); }
    leaks.push(l0 - S.lives);
    if (S.phase !== 'playing') break;
  }
  game.bossLog = null; game.leakLog = null;
  return { level: levelId, tier, seed, phase: S.phase, won: S.phase === 'won', lives: S.lives, gold: S.gold, kills: S.kills, wave: S.wave, stars: S.phase === 'won' ? G.stars() : 0, leaks, bossLeaks, leakTypes };
}

function runMany(game, levelId, opts = {}) {
  const { seeds = 10, from = 1 } = opts;
  const runs = [];
  for (let s = from; s < from + seeds; s++) runs.push(runOne(game, levelId, { ...opts, seed: s }));
  const wins = runs.filter((r) => r.won);
  const lostAt = {};
  for (const r of runs) if (!r.won) lostAt[r.wave] = (lostAt[r.wave] || 0) + 1;
  const bossLeaks = runs.flatMap((r) => r.bossLeaks);
  return {
    level: levelId, tier: opts.tier || 'meadow', runs: runs.length, wins: wins.length,
    meanLives: wins.length ? +(wins.reduce((a, r) => a + r.lives, 0) / wins.length).toFixed(1) : 0,
    lostAt, bossLeakRuns: runs.filter((r) => r.bossLeaks.length).length,
    bossHpAtLeak: bossLeaks.map((b) => `${b.hp}/${b.maxHp}@w${b.wave}`),
    leakTypes: runs.flatMap((r) => r.leakTypes).reduce((m, k) => { m[k] = (m[k] || 0) + 1; return m; }, {}),
    detail: runs,
  };
}

module.exports = { loadGame, runOne, runMany, PLANS };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
  const which = args[0] && !args[0].startsWith('--') ? args[0] : 'all';
  const tier = opt('--tier', 'meadow');
  const seeds = +opt('--seeds', 10), from = +opt('--from', 1);
  const engine = opt('--engine', null);
  const game = loadGame(engine && path.resolve(engine));
  // --set hp=1.1,speed=1,gold=0.9,lives=15,bounty=1 overrides the chosen tier's multipliers for a tuning sweep
  const set = opt('--set', null);
  if (set) for (const kv of set.split(',')) { const [k, v] = kv.split('='); game.GameState.DIFFICULTY[tier][k] = +v; }
  const ids = which === 'all' ? game.LEVELS.slice().sort((a, b) => a.index - b.index).map((l) => l.id) : [which];
  const out = [];
  for (const id of ids) {
    const r = runMany(game, id, { tier, seeds, from });
    out.push(r);
    if (!args.includes('--json')) {
      const lost = Object.entries(r.lostAt).map(([w, n]) => `w${w}x${n}`).join(' ');
      if (args.includes('--leaks')) console.log('   leaks', JSON.stringify(r.leakTypes));
      console.log(`${id.padEnd(16)} ${tier.padEnd(8)} won ${String(r.wins).padStart(2)}/${r.runs}  lives ${String(r.meanLives).padStart(4)}  lost ${lost || '-'}  boss leaks ${r.bossLeakRuns || 0}${r.bossHpAtLeak.length ? '  hp ' + r.bossHpAtLeak.slice(0, 6).join(' ') : ''}`);
    }
  }
  if (args.includes('--json')) console.log(JSON.stringify(out.map((r) => ({ ...r, detail: r.detail.map(({ seed, phase, lives, gold, kills, wave }) => ({ seed, phase, lives, gold, kills, wave })) }))));
}
