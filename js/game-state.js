// ===================================================================
// GameState  (pure logic: no THREE, no DOM, no audio in here)
// ===================================================================
const GameState = (() => {
  let level = null, cols = 0, rows = 0;
  // Routes: every road an enemy can walk, from its own spawn to the shared
  // gate. Most levels have one; pathCells/pathIndex are the union of all.
  let routes = [], cobbleCells = new Set(), spawnCells = new Set();
  let pathCells = [], pathIndex = new Map(), gate = { x: 0, z: 0 };

  // Every tower is a character with a job. The ids are the engine's role
  // names, kept from the original game so its tests and tooling carry over:
  //   slinger   = Laser Turret  (fast, cheap, single target, ground only)
  //   warden    = Goo Cannon    (sticky splash that roots, ground only)
  //   druid     = Cryo Beam     (chilling frost, reaches flyers)
  //   golem     = Mech Walker   (one huge slow hit, ground only)
  //   artillery = Missile Pod   (long arcing salvos, splash, reaches flyers)
  const TOWER_TYPES = {
    slinger:   { id: 'slinger',   name: 'Laser Turret',  cost: 70,  range: 2.6, damage: 8,  cooldown: 0.62, windup: 0.16, projectileSpeed: 7.5, projectile: 'acorn',   splash: 0,   hitsFlying: false, icon: '&#128299;', blurb: 'Quick laser bolts. Cheap. Ground only.' },
    warden:    { id: 'warden',    name: 'Goo Cannon',    cost: 110, range: 2.3, damage: 16, cooldown: 1.5,  windup: 0.3,  projectileSpeed: 5.5, projectile: 'thorn',   splash: 0.9, hitsFlying: false, icon: '&#129440;', blurb: 'Lobs sticky goo that glues a crowd in place. Ground only.', effect: { root: 0.9 } },
    druid:     { id: 'druid',     name: 'Cryo Beam',     cost: 90,  range: 2.9, damage: 5,  cooldown: 0.8,  windup: 0.2,  projectileSpeed: 9,   projectile: 'wisp',    splash: 0,   hitsFlying: true,  icon: '&#10052;',  blurb: 'Freezing bolts that slow. Reaches flyers.', effect: { chill: 2.2, chillMul: 0.55 } },
    golem:     { id: 'golem',     name: 'Mech Walker',   cost: 130, range: 2.2, damage: 46, cooldown: 2.4,  windup: 0.45, projectileSpeed: 8,   projectile: 'boulder', splash: 0,   hitsFlying: false, icon: '&#129302;', blurb: 'Fires one huge rocket fist, slow to wind up. Ground only.' },
    artillery: { id: 'artillery', name: 'Missile Pod',   cost: 120, range: 4.2, minRange: 1.4, damage: 15, cooldown: 2.4, windup: 0.35, projectileSpeed: 5, projectile: 'bigacorn', splash: 0.7, hitsFlying: true, icon: '&#128640;', blurb: 'Arcing missiles, far but not near. Splashes. Reaches flyers.' },
  };
  const TOWER_ORDER = ['slinger', 'warden', 'druid', 'golem', 'artillery'];
  // Tier 3 is a permanent choice between two specializations. Each is about
  // as strong overall as a flat tier 3 would be, but concentrated: clearly
  // better than its sibling in one situation, clearly worse in another.
  // damage/cooldown multiply the base type, range adds; splash and effect
  // replace the base values when given. shots: targets per volley.
  // pierce: ignores armor. groundSplash: the blast lands on the ground, so
  // flyers other than the one aimed at are untouched. (Branch ids are the
  // original engine's too; only names and blurbs are this game's.)
  const BRANCHES = {
    slinger: {
      marksman: { name: 'Railgun',      icon: '&#127919;', blurb: 'One slow, heavy slug that pierces armor.', damage: 5, cooldown: 1.7, range: 1.1, pierce: true },
      bloom:    { name: 'Twin Blaster', icon: '&#9889;',   blurb: 'Fast bolts at two targets. Weak vs armor.', damage: 1.25, cooldown: 0.6, range: 0.3, shots: 2 },
    },
    warden: {
      thicket: { name: 'Glue Bomber',    icon: '&#129514;', blurb: 'Wide goo puddles that glue a crowd for long.', damage: 1.3, cooldown: 1.0, range: 0.3, splash: 1.2, effect: { root: 1.4 } },
      briarstorm: { name: 'Acid Mortar', icon: '&#9763;',   blurb: 'Fizzing acid blasts. Sticks only briefly.', damage: 3.4, cooldown: 0.8, range: 0.3, splash: 1.15, effect: { root: 0.4 } },
    },
    druid: {
      hoarfrost: { name: 'Blizzard Array', icon: '&#127784;', blurb: 'Frost bursts that slow a whole crowd.', damage: 1.2, cooldown: 0.95, range: 0.2, splash: 1.0, groundSplash: true, effect: { chill: 2.2, chillMul: 0.45 } },
      seer: { name: 'Ice Lance', icon: '&#129482;', blurb: 'Sharp ice spears, long reach. Kills flyers.', damage: 5, cooldown: 0.7, range: 0.8, effect: { chill: 1.0, chillMul: 0.75 } },
    },
    golem: {
      earthshaker: { name: 'Quake Stomper', icon: '&#128165;', blurb: 'The fist quakes the ground and staggers a crowd.', damage: 1.5, cooldown: 1, range: 0.3, splash: 1.0, effect: { root: 0.4 } },
      mountainheart: { name: 'Hull Breaker', icon: '&#128297;', blurb: 'A crushing punch that ignores armor.', damage: 4.2, cooldown: 1.0, range: 0.3, pierce: true },
    },
    artillery: {
      oakfall: { name: 'Big Boomer', icon: '&#9732;', blurb: 'One fat warhead with a huge blast. Slow.', damage: 3.2, cooldown: 1.2, range: 1.0, splash: 1.4, groundSplash: true },
      squirrel: { name: 'Swarm Rockets', icon: '&#127878;', blurb: 'Three salvos at three targets. Small blasts.', damage: 1.3, cooldown: 0.75, range: 0.5, splash: 0.35, shots: 3 },
    },
  };
  // Tier progression. Tier 2 is a flat step up. Tier 3's stats here are only a
  // fallback: reaching tier 3 requires a specialization (BRANCHES above),
  // whose own numbers replace these. costMul still prices every step.
  const TIERS = [
    { damage: 1,    cooldown: 1,    range: 0,    costMul: 0 },
    { damage: 1.5,  cooldown: 0.92, range: 0.25, costMul: 0.8 },
    { damage: 2.25, cooldown: 0.84, range: 0.5,  costMul: 1.3 },
  ];
  const SELL_REFUND = 0.6;
  // The invaders. Role ids as above: grunt = Blob Drone, trickster = Skitter
  // Crawler, troll = Armored Brute, bat = Saucer Scout. Every level closes
  // on a boss. Ground bosses walk or roll the road like everyone else, so
  // every tower can hit them; flying bosses need the Cryo Beam and the
  // Missile Pod.
  const ENEMY_TYPES = {
    grunt:      { id: 'grunt',      name: 'Blob Drone',      hp: 30,  speed: 1.25, bounty: 8,   flying: false, armor: 0 },
    trickster:  { id: 'trickster',  name: 'Skitter Crawler', hp: 16,  speed: 2.3,  bounty: 6,   flying: false, armor: 0, wobble: true },
    troll:      { id: 'troll',      name: 'Armored Brute',   hp: 170, speed: 0.72, bounty: 25,  flying: false, armor: 4 },
    bat:        { id: 'bat',        name: 'Saucer Scout',    hp: 22,  speed: 1.75, bounty: 10,  flying: true,  armor: 0 },
    drilltank:  { id: 'drilltank',  name: 'The Drill Tank',  hp: 1300, speed: 0.5,  bounty: 150, flying: false, armor: 5, boss: true },
    gloopking:  { id: 'gloopking',  name: 'The Gloop King',  hp: 900, speed: 0.52, bounty: 140, flying: false, armor: 2, boss: true },
    hivequeen:  { id: 'hivequeen',  name: 'The Hive Queen',  hp: 1100, speed: 0.5,  bounty: 150, flying: false, armor: 3, boss: true },
    manta:      { id: 'manta',      name: 'The Sky Manta',   hp: 700, speed: 0.72, bounty: 200, flying: true,  armor: 2, boss: true },
    sandworm:   { id: 'sandworm',   name: 'The Sand Worm',   hp: 1500, speed: 0.48, bounty: 160, flying: false, armor: 3, boss: true },
    sporecloud: { id: 'sporecloud', name: 'The Spore Cloud', hp: 400, speed: 0.75, bounty: 150, flying: true,  armor: 0, boss: true },
    tripod:     { id: 'tripod',     name: 'The Tripod',      hp: 1300, speed: 0.52, bounty: 160, flying: false, armor: 4, boss: true },
    harvester:  { id: 'harvester',  name: 'The Harvester',   hp: 1900, speed: 0.42, bounty: 160, flying: false, armor: 4, boss: true },
    brain:      { id: 'brain',      name: 'The Big Brain',   hp: 370, speed: 0.72, bounty: 160, flying: true,  armor: 1, boss: true },
    mothership: { id: 'mothership', name: 'The Mothership',  hp: 900, speed: 0.6,  bounty: 220, flying: true,  armor: 2, boss: true },
  };

  // Difficulty tiers. Meadow is the game as tuned: every multiplier is 1 and
  // the level's own lives apply, so it plays exactly as before tiers existed.
  // Bramble is the harder tier. hp, speed and bounty apply to each enemy as
  // it spawns, gold and lives when a level loads. Waves and maps never change.
  // Tuned with seeded bot runs (tools/bot-runner.js, 30 per level): the first
  // draft (hp 1.25, speed 1.1, gold 0.85, 15 lives, bounty 0.9) lost all 200
  // runs by wave 9. These numbers win 192 of 300 (AGENTS.md P3-D1).
  const DIFFICULTY = {
    meadow:  { id: 'meadow',  name: 'Cadet',  hp: 1,    speed: 1, gold: 1, lives: null, bounty: 1 },
    bramble: { id: 'bramble', name: 'Veteran', hp: 1.05, speed: 1, gold: 1, lives: 16,   bounty: 0.95 },
  };
  let difficulty = DIFFICULTY.meadow;

  // Endless mode (ENDLESS-MODE.md section 2). A level plays its own handmade
  // waves first, then waves made by genWave(): a pure function of the level,
  // the wave number and a seed, never Math.random, so a map's endless run is
  // the same every time. Only endless runs read any of this; the campaign
  // plays exactly as before.
  const ENDLESS = {
    cap: 45,          // enemies alive at once; later spawns wait for room
    hpSlope: 0.04,    // extra hpScale per wave past the level's own waves
    growth: 0.09,     // budget growth per wave past the level's own waves
    bossEvery: 5,     // a generated wave divisible by this brings a boss
    breather: 12,     // extra prep seconds after every 5th wave
    cost: { grunt: 1, trickster: 0.8, troll: 5, bat: 1.6 },
    gap: { grunt: 0.85, trickster: 0.55, troll: 2.1, bat: 0.95 },
    weight: { grunt: 4, trickster: 3, troll: 2, bat: 2 },
    bosses: ['drilltank', 'sporecloud', 'manta'],
    names: ['The pods keep landing', 'More goo on the road', 'A thicker swarm', 'The long moon night', 'Lights in the sky', 'No end in sight', 'The hive empties', 'Another push', 'Fresh from orbit', 'The roads fill up'],
  };
  let endless = false, refBudget = 1;
  const genCache = new Map();
  // a small seeded generator (mulberry32) and a string hash (FNV-1a) for its seeds
  function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rngFrom(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const listeners = {};
  function on(event, fn) { (listeners[event] = listeners[event] || []).push(fn); }
  // Each listener runs on its own: a failing sound, visual or UI listener
  // is logged once and never stops the game logic or the listeners after it.
  let lastError = null;
  const reported = new Set();
  function emit(event, payload) {
    const ls = listeners[event];
    if (!ls) return;
    for (const fn of ls.slice()) {
      try { fn(payload); } catch (err) {
        lastError = { event, message: String((err && err.message) || err) };
        if (!reported.has(event)) { reported.add(event); console.error(`GameState: a '${event}' listener failed`, err); }
      }
    }
  }

  const worldX = (c) => c - cols / 2 + 0.5;
  const worldZ = (r) => r - rows / 2 + 0.5;

  function key(c, r) { return `${c},${r}`; }
  function inGrid(c, r) { return c >= 0 && r >= 0 && c < cols && r < rows; }
  function isPath(c, r) { return pathIndex.has(key(c, r)); }
  // A level's fissure normally spans the whole grid height (one crossing,
  // the chokepoint, so nothing else needs bounding). A path that visits its
  // own column's rows more than once (a spiral) needs the water bounded to
  // a short stretch instead, via optional chokepoint.streamRows: [r0, r1].
  function isStream(c, r) {
    if (c !== level.chokepoint.streamCol) return false;
    if (c === level.chokepoint.cell[0] && r === level.chokepoint.cell[1]) return false;
    const rows = level.chokepoint.streamRows;
    return !rows || (r >= rows[0] && r <= rows[1]);
  }
  function isBridge(c, r) { return c === level.chokepoint.cell[0] && r === level.chokepoint.cell[1]; }
  function isBastion(c, r) { return level.endpoint.cells.some(([bc, br]) => bc === c && br === r); }
  function isSpawn(c, r) { return spawnCells.has(key(c, r)); }

  // 0 = pleasant countryside, 1 = deep in this level's dangerous zone.
  // Defined for any cell, including the decorative border, so the danger
  // bleeds off the edge of the map instead of stopping at a hard line.
  function zoneFalloff(c, r) {
    const { center, radiusOut, radiusIn, falloffWidth, foothold } = level.theme;
    const dx = (c - center[0]) / radiusOut.x, dz = (r - center[1]) / radiusOut.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    let h = Math.max(0, Math.min(1, (radiusIn - d) / falloffWidth));
    // A single radial source can't cleanly clear a pocket of health around a
    // point that sits *inside* its own danger zone (an endpoint the road
    // spirals around, say) — some other cell is always closer to the source.
    // An optional second, local falloff forces the ground healthy near that
    // point instead, without touching corruption anywhere else on the map.
    if (foothold) {
      const fdx = c - foothold.center[0], fdz = r - foothold.center[1];
      const fd = Math.sqrt(fdx * fdx + fdz * fdz);
      const clear = Math.max(0, Math.min(1, (fd - foothold.radius) / foothold.falloffWidth));
      h = Math.min(h, clear);
    }
    return h;
  }

  // Buildable = inside the grid, on plain ground, and touching the road.
  function isBuildable(c, r) {
    if (!inGrid(c, r) || isPath(c, r) || isStream(c, r) || isBastion(c, r) || isSpawn(c, r)) return false;
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      if ((dc || dr) && isPath(c + dc, r + dr)) return true;
    }
    return false;
  }

  function cellKind(c, r) {
    if (isBastion(c, r)) return 'bastion';
    if (isBridge(c, r)) return 'bridge';
    if (isStream(c, r)) return 'stream';
    if (isPath(c, r)) return 'path';
    return 'ground';
  }

  function pathIndexOf(c, r) { const i = pathIndex.get(key(c, r)); return i === undefined ? -1 : i; }
  function isCobble(c, r) { return cobbleCells.has(key(c, r)); }

  const state = {};
  let nextId = 1;

  // Load a level's data: derive its path geometry once and reset the whole
  // run. Levels/UI/Renderer all read `state`/`currentLevel()` afterward.
  function loadLevel(def) {
    level = def; cols = def.grid.cols; rows = def.grid.rows; nextId = 1;

    // Each route: its grid cells, and the world-space polyline enemies walk
    // (waypoint centers plus a final step into the endpoint's gate so leaks
    // visibly go through the door). A level without `routes` has one, built
    // from `pathWaypoints`.
    gate = { x: worldX(def.endpoint.gateCell[0]), z: worldZ(def.endpoint.gateCell[1] + 1) - 0.72 };
    const defs = def.routes || [{ id: 'main', waypoints: def.pathWaypoints }];
    routes = defs.map((rd, index) => {
      const wps = rd.waypoints, cells = [];
      for (let i = 0; i < wps.length - 1; i++) {
        const [ax, az] = wps[i], [bx, bz] = wps[i + 1];
        const dx = Math.sign(bx - ax), dz = Math.sign(bz - az);
        let x = ax, z = az;
        if (i === 0) cells.push([x, z]);
        while (x !== bx || z !== bz) { x += dx; z += dz; cells.push([x, z]); }
      }
      let points = wps.map(([c, r]) => ({ x: worldX(c), z: worldZ(r) }));
      points.push(gate);
      // Optional `curvyRoads`: round every corner (Chaikin corner cutting) so
      // the road and the enemies on it sweep in curves instead of turning
      // on grid corners. The cells (what is road, what is buildable) are
      // unchanged; the curve only ever cuts inside the corner, staying
      // within about half a cell of them. Start and gate stay exact.
      let straightLen = 0;
      for (let i = 1; i < points.length; i++) straightLen += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
      if (def.curvyRoads) {
        for (let pass = 0; pass < 3; pass++) {
          const q = [points[0]];
          for (let i = 0; i < points.length - 1; i++) {
            const a = points[i], b = points[i + 1];
            q.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
          }
          q.push(points[points.length - 1]);
          points = q;
        }
      }
      const lens = [0];
      for (let i = 1; i < points.length; i++) lens.push(lens[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
      const length = lens[lens.length - 1];
      // Optional `curveKeepsPace`: rounding the corners shortens a road, so
      // enemies walk it proportionally slower and take as long from spawn to
      // gate as they did on the straight road. A level tuned before it got
      // curves keeps its wave table and its time in tower range.
      const pace = def.curvyRoads && def.curveKeepsPace ? length / straightLen : 1;
      return { id: rd.id, index, cells, points, lens, length, pace };
    });
    // the union of every route's cells, primary route first and in order
    pathCells = []; pathIndex = new Map();
    for (const rt of routes) for (const [c, r] of rt.cells) {
      if (!pathIndex.has(key(c, r))) { pathIndex.set(key(c, r), pathCells.length); pathCells.push([c, r]); }
    }
    const primary = routes[0].cells;
    cobbleCells = new Set(primary.slice(Math.max(0, primary.length - def.cobbleTailCells)).map(([c, r]) => key(c, r)));
    spawnCells = new Set(routes.map((rt) => key(rt.cells[0][0], rt.cells[0][1])));
    // A road can carry flyers only if some build plot has it in reach of a
    // tower that hits flyers (tier 1 range). Endless never sends flyers elsewhere.
    const aaTypes = Object.values(TOWER_TYPES).filter((t) => t.hitsFlying), plots = [], p = { x: 0, z: 0 };
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (isBuildable(c, r)) plots.push({ x: worldX(c), z: worldZ(r) });
    for (const rt of routes) {
      rt.antiAir = false;
      for (let d = 0; d <= rt.length && !rt.antiAir; d += 0.25) {
        pathPosAt(d, p, rt);
        rt.antiAir = plots.some((q) => aaTypes.some((t) => { const dd = Math.hypot(q.x - p.x, q.z - p.z); return dd <= t.range && dd >= (t.minRange || 0); }));
      }
    }
    // endless waves start from the strongest of the level's last four waves (bosses aside)
    const costOf = (w) => w.groups.reduce((sum, g) => sum + (ENEMY_TYPES[g.type].boss ? 0 : g.count * (ENDLESS.cost[g.type] || 1)), 0);
    refBudget = Math.max(1, ...def.waves.slice(-4).map(costOf));
    genCache.clear();

    const startLives = difficulty.lives || def.startLives;
    Object.assign(state, {
      gold: Math.round(def.startGold * difficulty.gold), lives: startLives, startLives, difficulty: difficulty.id, wave: 0, time: 0,
      selected: null, towers: [], enemies: [], waveActive: false, waveQueue: [],
      hpScale: 1, schedule: [], waveTime: 0, prep: 0, endpointState: 0,
      projectiles: [], phase: 'title', paused: false, speed: 1, kills: 0,
      endless, endlessSeed: hashStr(def.id), earned: 0,
    });
    emit('levelLoaded', def);
  }
  function currentLevel() { return level; }
  // Pick the tier for the next level load. On a level that has not started
  // yet it also resets the starting gold and lives to the new tier's.
  function setDifficulty(id) {
    difficulty = DIFFICULTY[id] || DIFFICULTY.meadow;
    if (level && state.phase === 'title' && state.wave === 0) {
      state.difficulty = difficulty.id;
      state.startLives = difficulty.lives || level.startLives;
      state.lives = state.startLives;
      state.gold = Math.round(level.startGold * difficulty.gold);
      emit('livesChanged', state.lives);
      emit('goldChanged', state.gold);
    }
    emit('difficultyChanged', difficulty.id);
    return difficulty.id;
  }
  // Endless on or off for the next level load; like the tier, it applies at once
  // to a level that has not started yet.
  function setEndless(on) {
    endless = !!on;
    if (level && state.phase === 'title' && state.wave === 0) { state.endless = endless; genCache.clear(); }
    emit('modeChanged', endless);
    return endless;
  }
  function totalWaves() { return state.endless ? Infinity : level.waves.length; }
  // wave n's definition: the level's own, then (endless only) a generated one
  function waveDef(n) {
    if (n >= 1 && n <= level.waves.length) return level.waves[n - 1];
    if (!state.endless || n < 1) return null;
    if (!genCache.has(n)) genCache.set(n, genWave(n));
    return genCache.get(n);
  }
  function genWave(n) {
    const N = level.waves.length, k = n - N, E = ENDLESS;
    const rand = rngFrom(hashStr(`${state.endlessSeed}|${n}`));
    const weighted = (items, w) => { let t = 0; for (const it of items) t += w(it); let x = rand() * t; for (const it of items) { x -= w(it); if (x < 0) return it; } return items[items.length - 1]; };
    const boss = n % E.bossEvery === 0;
    // roads: favor the ones the last wave did not use, so every road stays live
    const prev = new Set(routesForWave(n - 1));
    const nRoads = routes.length === 1 ? 1 : 1 + Math.floor(rand() * Math.min(3, routes.length));
    const pool = routes.map((rt) => rt.index), chosen = [];
    while (chosen.length < nRoads) { const i = weighted(pool, (r) => (prev.has(r) ? 1 : 3)); chosen.push(i); pool.splice(pool.indexOf(i), 1); }
    const aaChosen = chosen.filter((i) => routes[i].antiAir);
    const budget = refBudget * (1 + E.growth * k) * (boss ? 0.55 : 1);
    const nGroups = 2 + Math.floor(rand() * 3);
    const cursor = {}, groups = [];
    for (let g = 0; g < nGroups; g++) {
      let road = chosen[g % chosen.length];
      let type = weighted(['grunt', 'trickster', 'troll', 'bat'], (t) => (t === 'bat' && !aaChosen.length ? 0 : t === 'troll' ? E.weight.troll + k * 0.08 : E.weight[t]));
      if (type === 'bat' && !routes[road].antiAir) road = aaChosen[g % aaChosen.length];
      const count = Math.max(1, Math.min(40, Math.round(budget / nGroups / E.cost[type])));
      const gap = Math.round(E.gap[type] * (0.85 + rand() * 0.3) * 100) / 100;
      const at = cursor[road] || 0;
      cursor[road] = at + count * gap + 1.5 + rand() * 2;
      groups.push({ type, count, gap, at: Math.round(at * 100) / 100, route: routes[road].id });
    }
    let name = E.names[Math.floor(rand() * E.names.length)];
    if (boss) {
      // bosses fly: only down a road with anti-air reach, a different boss each time
      const aaAll = routes.filter((rt) => rt.antiAir).map((rt) => rt.index);
      const road = aaChosen.length ? aaChosen[0] : aaAll[0];
      if (road !== undefined) {
        const type = E.bosses[(Math.floor(n / E.bossEvery) + level.index) % E.bosses.length];
        groups.push({ type, count: 1, gap: 1, at: Math.round((6 + rand() * 4) * 100) / 100, route: routes[road].id });
        name = `${ENEMY_TYPES[type].name} rises`;
      }
    }
    return { name, groups, generated: true };
  }

  function routeOf(id) {
    if (id === undefined || id === null) return routes[0];
    if (typeof id === 'number') return routes[id] || routes[0];
    return routes.find((rt) => rt.id === id) || routes[0];
  }
  function pathPosAt(d, out, route) {
    out = out || { x: 0, z: 0 };
    const { points, lens, length } = route || routes[0];
    if (d <= 0) { out.x = points[0].x; out.z = points[0].z; return out; }
    if (d >= length) { out.x = gate.x; out.z = gate.z; return out; }
    let i = 1;
    while (lens[i] < d) i++;
    const a = points[i - 1], b = points[i];
    const t = (d - lens[i - 1]) / (lens[i] - lens[i - 1]);
    out.x = a.x + (b.x - a.x) * t;
    out.z = a.z + (b.z - a.z) * t;
    return out;
  }

  function pause() {
    if (state.phase !== 'playing' || state.paused) return false;
    state.paused = true;
    emit('paused');
    return true;
  }
  function resume() {
    if (!state.paused) return false;
    state.paused = false;
    emit('resumed');
    return true;
  }
  function setSpeed(x) {
    state.speed = x === 2 || x === 4 || x === 8 ? x : 1;   // 1x, 2x, 4x or 8x
    emit('speedChanged', state.speed);
    return state.speed;
  }

  function startGame() {
    if (state.phase !== 'title') return;
    state.phase = 'playing';
    emit('gameStarted');
  }

  function towerAt(c, r) { return state.towers.find((t) => t.c === c && t.r === r) || null; }

  function clearSelection() {
    if (!state.selected) return;
    state.selected = null;
    emit('selectionCleared');
  }

  // Tap on a tile: select a tower, select an empty buildable tile, or
  // explain in-world why nothing can go there.
  function selectTile(c, r) {
    if (!inGrid(c, r)) { clearSelection(); return { ok: false, c, r, reason: null }; }
    const tower = towerAt(c, r);
    if (tower) {
      state.selected = { kind: 'tower', id: tower.id, c, r };
      emit('towerSelected', tower);
      return { ok: true, c, r, tower };
    }
    let reason = null;
    if (isPath(c, r)) reason = "Can't build on the road, the invaders crawl there.";
    else if (isStream(c, r)) reason = "Can't build in the water.";
    else if (isBastion(c, r)) reason = `That's ${level.endpoint.name}. Build around it.`;
    else if (isSpawn(c, r)) reason = level.spawnBlockedText;
    else if (!isBuildable(c, r)) reason = 'Too far from the road. A tower needs a road to watch.';
    if (reason) {
      clearSelection();
      const res = { ok: false, c, r, reason };
      emit('tileRejected', res);
      return res;
    }
    state.selected = { kind: 'tile', c, r };
    const res = { ok: true, c, r };
    emit('tileSelected', res);
    return res;
  }

  function canAfford(typeId) { return state.gold >= TOWER_TYPES[typeId].cost; }
  function towerStats(tower) {
    const type = TOWER_TYPES[tower.type], tier = TIERS[tower.tier - 1];
    const br = tower.tier >= 3 && tower.branch ? BRANCHES[tower.type][tower.branch] : null;
    if (br) {
      return {
        damage: Math.round(type.damage * br.damage), cooldown: type.cooldown * br.cooldown,
        range: type.range + br.range, splash: br.splash ?? type.splash, effect: br.effect || type.effect || null,
        shots: br.shots || 1, pierce: !!br.pierce, groundSplash: !!br.groundSplash,
      };
    }
    return {
      damage: Math.round(type.damage * tier.damage), cooldown: type.cooldown * tier.cooldown,
      range: type.range + tier.range, splash: type.splash, effect: type.effect || null,
      shots: 1, pierce: false,
    };
  }
  function upgradeCost(tower) {
    if (tower.tier >= TIERS.length) return null;
    return Math.round(TOWER_TYPES[tower.type].cost * TIERS[tower.tier].costMul);
  }
  function sellValue(tower) {
    const type = TOWER_TYPES[tower.type];
    let spent = type.cost;
    for (let t = 1; t < tower.tier; t++) spent += Math.round(type.cost * TIERS[t].costMul);
    return Math.round(spent * SELL_REFUND);
  }
  function towerById(id) { return state.towers.find((t) => t.id === id) || null; }

  function upgradeTower(id, branch) {
    const tower = towerById(id);
    if (!tower) return { ok: false, reason: 'No tower there.' };
    const cost = upgradeCost(tower);
    if (cost === null) return { ok: false, reason: 'Already at full strength.' };
    // the last tier is a permanent specialization and needs a choice
    const needsBranch = tower.tier + 1 >= TIERS.length;
    if (needsBranch && !(branch && BRANCHES[tower.type][branch])) return { ok: false, reason: 'Pick a specialization.' };
    if (state.gold < cost) {
      const res = { ok: false, reason: `Not enough gold. The upgrade costs ${cost}.` };
      emit('placeRejected', res);
      return res;
    }
    state.gold -= cost;
    tower.tier += 1;
    if (needsBranch) tower.branch = branch;
    tower.range = towerStats(tower).range;
    emit('towerUpgraded', tower);
    emit('goldChanged', state.gold);
    return { ok: true, tower };
  }

  function sellTower(id) {
    const tower = towerById(id);
    if (!tower) return { ok: false };
    const value = sellValue(tower);
    state.gold += value;
    state.towers.splice(state.towers.indexOf(tower), 1);
    for (const p of state.projectiles) if (p.towerId === id) p.orphan = true;
    if (state.selected && state.selected.kind === 'tower' && state.selected.id === id) state.selected = null;
    emit('towerSold', { tower, value });
    emit('selectionCleared');
    emit('goldChanged', state.gold);
    return { ok: true, value };
  }

  // Place a tower of the given type on the currently selected tile.
  function placeTower(typeId) {
    const sel = state.selected, type = TOWER_TYPES[typeId];
    if (!sel || sel.kind !== 'tile' || !type) return { ok: false, reason: 'Pick a spot by the road first.' };
    if (towerAt(sel.c, sel.r)) return { ok: false, reason: 'Something already stands there.' };
    if (state.gold < type.cost) {
      const res = { ok: false, reason: `Not enough gold. A ${type.name} costs ${type.cost}.` };
      emit('placeRejected', res);
      return res;
    }
    state.gold -= type.cost;
    const tower = {
      id: nextId++, type: typeId, c: sel.c, r: sel.r, tier: 1,
      x: worldX(sel.c), z: worldZ(sel.r), range: type.range, facing: 0,
      cooldown: 0, windup: 0, targetId: null,
    };
    state.towers.push(tower);
    state.selected = { kind: 'tower', id: tower.id, c: sel.c, r: sel.r };
    emit('towerPlaced', tower);
    emit('goldChanged', state.gold);
    return { ok: true, tower };
  }

  // -------- enemies --------
  function spawnEnemy(typeId, routeId) {
    const t = ENEMY_TYPES[typeId], route = routeOf(routeId);
    const d = DIFFICULTY[state.difficulty] || DIFFICULTY.meadow;
    const hp = Math.round(t.hp * state.hpScale * d.hp);
    const e = {
      id: nextId++, type: typeId, name: t.name, hp, maxHp: hp, speed: t.speed * d.speed,
      flying: t.flying, bounty: Math.round(t.bounty * d.bounty),
      dist: 0, lane: t.boss ? 0 : (Math.random() - 0.5) * 0.44,   // lateral offset so a crowd doesn't walk single file
      route: route.index, x: route.points[0].x, z: route.points[0].z, dirX: 1, dirZ: 0, age: 0,
      chillUntil: 0, chillMul: 1, rootUntil: 0, speedMul: 1,
      armor: t.armor || 0, wobble: !!t.wobble, boss: !!t.boss,
    };
    state.enemies.push(e);
    emit('enemySpawned', e);
    return e;
  }

  const _a = { x: 0, z: 0 }, _b = { x: 0, z: 0 };
  function moveEnemy(e, dt) {
    e.age += dt;
    e.rooted = state.time < e.rootUntil;
    e.chilled = state.time < e.chillUntil;
    e.speedMul = e.rooted ? 0 : (e.chilled ? e.chillMul : 1);
    e.dist += e.speed * e.speedMul * dt * routes[e.route].pace;
    const route = routes[e.route];
    pathPosAt(e.dist - 0.3, _a, route);
    pathPosAt(e.dist + 0.3, _b, route);
    let dx = _b.x - _a.x, dz = _b.z - _a.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    e.dirX = dx; e.dirZ = dz;
    pathPosAt(e.dist, _a, route);
    // lane offset fades out over the last stretch so everyone funnels into the gate
    const funnel = Math.min(1, Math.max(0, (route.length - e.dist) / 1.2));
    const lane = e.lane + (e.wobble ? Math.sin(e.dist * 3.1 + e.id) * 0.22 : 0);
    e.x = _a.x + -dz * lane * funnel;
    e.z = _a.z + dx * lane * funnel;
  }

  // Scale the endpoint's 3 damage-state thresholds to this run's starting
  // lives, so a level or tier with a different startLives still swaps states at
  // roughly 65%/30% remaining, matching Level 1's original 13/6-of-20 feel.
  function endpointStateFor(lives) {
    const L = state.startLives || level.startLives;
    return lives > L * 0.65 ? 0 : lives > L * 0.3 ? 1 : 2;
  }
  function stars() {
    // a tier with fewer lives scales the thresholds the same way (Bramble: 12 and 6 of 15)
    const k = (state.startLives || level.startLives) / level.startLives;
    const three = Math.round(level.starThresholds[0] * k), two = Math.round(level.starThresholds[1] * k);
    return state.lives >= three ? 3 : state.lives >= two ? 2 : 1;
  }
  function leak(e) {
    state.lives = Math.max(0, state.lives - (e.boss ? 5 : 1));
    emit('enemyLeaked', e);
    emit('livesChanged', state.lives);
    const es = endpointStateFor(state.lives);
    if (es !== state.endpointState) { state.endpointState = es; emit('endpointStateChanged', es); }
    if (state.lives <= 0 && state.phase === 'playing') {
      state.phase = 'lost';
      emit('gameLost');
    }
  }

  // -------- combat --------
  function enemyById(id) { return state.enemies.find((e) => e.id === id) || null; }

  // Towers shoot whichever reachable enemy is closest to the gate. On one
  // road that's simply the furthest along; across roads of different
  // lengths it's the least distance left to walk.
  function ahead(a, b) {
    if (a.route === b.route) return a.dist > b.dist;
    return routes[a.route].length - a.dist < routes[b.route].length - b.dist;
  }
  function pickTarget(tower, type) {
    let best = null;
    for (const e of state.enemies) {
      if (e.flying && !type.hitsFlying) continue;
      const d = Math.hypot(e.x - tower.x, e.z - tower.z);
      if (d > tower.range || d < (type.minRange || 0)) continue;
      if (!best || ahead(e, best)) best = e;
    }
    return best;
  }

  // Multi-shot towers: the primary target plus the next furthest along.
  function pickTargets(tower, type, primary, n) {
    const out = [primary];
    const rest = state.enemies.filter((e) => e !== primary && (!e.flying || type.hitsFlying)
      && Math.hypot(e.x - tower.x, e.z - tower.z) <= tower.range
      && Math.hypot(e.x - tower.x, e.z - tower.z) >= (type.minRange || 0));
    rest.sort((a, b) => (ahead(a, b) ? -1 : ahead(b, a) ? 1 : 0));
    for (let i = 0; i < rest.length && out.length < n; i++) out.push(rest[i]);
    return out;
  }

  function updateTower(tower, dt) {
    const type = TOWER_TYPES[tower.type];
    const stats = towerStats(tower);
    tower.cooldown = Math.max(0, tower.cooldown - dt);
    let target = tower.targetId ? enemyById(tower.targetId) : null;
    if (target) {
      const d = Math.hypot(target.x - tower.x, target.z - tower.z);
      if (d > tower.range + 0.2 || d < (type.minRange || 0)) target = null;
    }
    if (!target) { target = pickTarget(tower, type); tower.targetId = target ? target.id : null; }
    if (target) tower.facing = Math.atan2(target.x - tower.x, target.z - tower.z);
    if (tower.windup > 0) {
      // anticipation: the wind-up beat before the shot
      tower.windup -= dt;
      if (tower.windup <= 0) {
        if (target) fire(tower, type, stats, target);
        tower.cooldown = stats.cooldown;
      }
      return;
    }
    if (target && tower.cooldown <= 0) {
      tower.windup = type.windup;
      emit('towerWindup', tower);
    }
  }

  function fire(tower, type, stats, target) {
    const targets = stats.shots > 1 ? pickTargets(tower, type, target, stats.shots) : [target];
    let first = null;
    for (const t of targets) { const p = launch(tower, type, stats, t); first = first || p; }
    emit('towerFired', { tower, projectile: first });
  }
  function launch(tower, type, stats, target) {
    const p = {
      id: nextId++, towerId: tower.id, targetId: target.id, damage: stats.damage,
      kind: type.projectile, splash: stats.splash, effect: stats.effect, hitsFlying: type.hitsFlying && !stats.groundSplash, pierce: stats.pierce,
      targetFlying: target.flying, targetBoss: !!target.boss,
      x: tower.x, z: tower.z, sx: tower.x, sz: tower.z, speed: type.projectileSpeed, t: 0, total: 1,
    };
    p.total = Math.max(0.2, Math.hypot(target.x - tower.x, target.z - tower.z));
    state.projectiles.push(p);
    return p;
  }

  function updateProjectiles(dt) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      const target = enemyById(p.targetId);
      if (!target) { state.projectiles.splice(i, 1); emit('projectileFizzled', p); continue; }
      const dx = target.x - p.x, dz = target.z - p.z;
      const dist = Math.hypot(dx, dz);
      const step = p.speed * dt;
      p.total = Math.max(p.total, dist + step);
      if (dist <= step + 0.12) {
        state.projectiles.splice(i, 1);
        impact(p, target);
        continue;
      }
      p.x += (dx / dist) * step;
      p.z += (dz / dist) * step;
      p.t = Math.min(1, 1 - dist / Math.max(0.001, Math.hypot(target.x - p.sx, target.z - p.sz)));
    }
  }

  function impact(p, target) {
    const x = target.x, z = target.z;
    emit('projectileHit', { projectile: p, x, z, flying: target.flying });
    if (p.splash > 0) {
      // splash hits everything the tower could target within the radius
      for (const e of state.enemies.slice()) {
        if (e.flying && !p.hitsFlying && e !== target) continue;
        const d = Math.hypot(e.x - x, e.z - z);
        if (d > p.splash) continue;
        const falloff = e === target ? 1 : 0.65;
        applyEffect(e, p.effect);
        damage(e, Math.max(1, Math.round(p.damage * falloff)), p);
      }
    } else {
      applyEffect(target, p.effect);
      damage(target, p.damage, p);
    }
  }

  function applyEffect(e, effect) {
    if (!effect) return;
    if (effect.chill) { e.chillUntil = state.time + effect.chill; e.chillMul = effect.chillMul; emit('enemyChilled', e); }
    if (effect.root && !e.flying) { e.rootUntil = state.time + effect.root; emit('enemyRooted', e); }
  }

  function damage(e, amount, source) {
    const dealt = Math.max(1, amount - (source && source.pierce ? 0 : e.armor));
    e.hp -= dealt;
    emit('enemyHit', { enemy: e, amount: dealt, armored: dealt < amount, x: e.x, z: e.z, kind: source && source.kind });
    if (e.hp <= 0) {
      const i = state.enemies.indexOf(e);
      if (i >= 0) state.enemies.splice(i, 1);
      state.gold += e.bounty;
      state.earned += e.bounty;
      state.kills += 1;
      emit('enemyKilled', e);
      emit('goldChanged', state.gold);
    }
  }

  // -------- waves --------
  function startWave() {
    if (state.waveActive || state.phase !== 'playing') return false;
    const def = waveDef(state.wave + 1);
    if (!def) return false;
    state.wave += 1;
    // Groups run one after another (`delay` counts from the previous group's
    // last spawn). A group with `at` instead starts at that time on its own,
    // so groups on different routes can come at once. `route` picks the road.
    const sched = [];
    let t = 0.6;
    for (const grp of def.groups) {
      let gt;
      if (grp.at !== undefined) gt = 0.6 + grp.at;
      else { t += grp.delay; gt = t; }
      for (let i = 0; i < grp.count; i++) { sched.push({ t: gt, type: grp.type, route: grp.route }); gt += grp.gap; }
      if (grp.at === undefined) t = gt;
    }
    sched.sort((a, b) => a.t - b.t);
    state.schedule = sched;
    state.waveQueue = sched.map((e) => e.type);
    state.waveTime = 0;
    state.prep = 0;
    // a gentle stiffening on top of the roster, steeper past the level's own waves (endless only)
    state.hpScale = 1 + (state.wave - 1) * 0.05 + Math.max(0, state.wave - level.waves.length) * ENDLESS.hpSlope;
    state.waveActive = true;
    emit('waveStarted', state.wave);
    return true;
  }
  // The player's Send button: during prep it starts early for a gold bonus.
  function sendWave() {
    if (state.waveActive || state.phase !== 'playing') return false;
    const bonus = state.prep > 0 ? Math.round(state.prep * 1.5) : 0;
    if (!startWave()) return false;
    if (bonus > 0) { state.gold += bonus; state.earned += bonus; emit('earlyBonus', bonus); emit('goldChanged', state.gold); }
    return true;
  }
  function waveInfo(n) { return waveDef(n); }
  // Which roads wave n comes down (route indexes), for the incoming-road markers.
  function routesForWave(n) {
    const w = waveDef(n);
    if (!w) return [];
    return [...new Set(w.groups.map((grp) => routeOf(grp.route).index))].sort();
  }
  function enemiesLeft() { return state.waveQueue.length + state.enemies.length; }

  function update(dt) {
    if (state.phase !== 'playing' || state.paused) return;
    state.time += dt;
    for (const t of state.towers) updateTower(t, dt);
    updateProjectiles(dt);
    if (state.waveActive) {
      state.waveTime += dt;
      // endless: a cap on enemies alive at once, so a long run never floods a phone
      while (state.schedule.length && state.schedule[0].t <= state.waveTime && !(state.endless && state.enemies.length >= ENDLESS.cap)) {
        const next = state.schedule.shift();
        spawnEnemy(next.type, next.route);
        state.waveQueue.shift();
      }
    } else if (state.prep > 0) {
      const before = Math.ceil(state.prep);
      state.prep -= dt;
      const after = Math.ceil(state.prep);
      if (after !== before && after >= 1 && after <= 3) emit('prepTick', after);
      if (state.prep <= 0) { state.prep = 0; startWave(); }
    }
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      moveEnemy(e, dt);
      if (e.dist >= routes[e.route].length) {
        state.enemies.splice(i, 1);
        leak(e);
      }
    }
    if (state.waveActive && !state.schedule.length && !state.enemies.length) {
      state.waveActive = false;
      const bonus = 15 + state.wave * 5;
      state.gold += bonus;
      state.earned += bonus;
      emit('waveEnded', { wave: state.wave, bonus });
      emit('goldChanged', state.gold);
      if (!state.endless && state.wave >= level.waves.length) {
        if (state.phase === 'playing') { state.phase = 'won'; emit('gameWon'); }
      } else {
        // endless has no last wave; every 5th wave buys a longer breather
        state.prep = level.prepSeconds + (state.endless && state.wave % ENDLESS.bossEvery === 0 ? ENDLESS.breather : 0);
      }
    }
  }

  return {
    get cols() { return cols; }, get rows() { return rows; },
    get pathCells() { return pathCells; }, get gate() { return gate; }, get routes() { return routes; }, get lastError() { return lastError; },
    TOWER_TYPES, TOWER_ORDER, TIERS, BRANCHES, ENEMY_TYPES, towerStats, upgradeCost, sellValue, towerById, upgradeTower, sellTower,
    pathPosAt,
    state, on, emit, update, worldX, worldZ, startGame, pause, resume, setSpeed,
    loadLevel, currentLevel, totalWaves, DIFFICULTY, setDifficulty, get difficulty() { return difficulty.id; },
    ENDLESS, setEndless, get endless() { return endless; },
    selectTile, clearSelection, placeTower, canAfford, towerAt, startWave, sendWave, spawnEnemy, waveInfo, routesForWave, enemiesLeft, stars,
    inGrid, isPath, isStream, isBridge, isBastion, isSpawn, isBuildable, isCobble,
    cellKind, zoneFalloff, pathIndexOf,
  };
})();
