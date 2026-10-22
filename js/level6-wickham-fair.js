// ===================================================================
// LEVEL 6 — Wickham Fair
// A market town on fair day, and the knaves mean to loot it. Two roads
// come in from the west over the town brook (the West Gate road hooks
// round the tannery, Mill Lane runs straight in from the south-west), and
// a third sneaks in from the east without crossing water at all. All
// three meet in the market square before the Guildhall.
// ===================================================================
const LEVEL_6 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: 'Fair Day',            flavor: 'Brigands come in by the West Gate road. Only one road so far.',                 groups: [g('grunt', 5, 3.2, 0, 'west')] },
    { name: 'Down Mill Lane',      flavor: 'More on Mill Lane. Both western roads cross the brook on the same bridge.',     groups: [g('grunt', 5, 2.0, 0, 'west', 0), g('grunt', 5, 2.0, 0, 'mill', 4)] },
    { name: 'Pickpockets',         flavor: 'Cutpurses slip in by the east road. It never crosses the brook.',               groups: [g('trickster', 6, 0.8, 0, 'east', 0), g('grunt', 5, 1.4, 0, 'west', 3)] },
    { name: 'A Knight at the Fair', flavor: 'A Black Knight on Mill Lane. The square is where every road meets.',            groups: [g('troll', 1, 1, 0, 'mill', 0), g('grunt', 6, 1.2, 0, 'west', 2), g('trickster', 5, 0.8, 0, 'east', 6)] },
    { name: 'Gargoyles on the Roofs', flavor: 'Gargoyles over Mill Lane. The Magus and the Longbowmen reach them.',          groups: [g('bat', 2, 1.5, 0, 'mill', 0), g('grunt', 8, 1.0, 0, 'west', 3)] },
    { name: 'Three Gates',         flavor: 'Every road at once. The market square covers all three.',                      groups: [g('grunt', 5, 1.0, 0, 'west', 0), g('grunt', 5, 1.0, 0, 'mill', 0), g('trickster', 6, 0.6, 0, 'east', 2)] },
    { name: 'Iron Column',         flavor: 'Black Knights on the West Gate road, Cutpurses from the east.',                 groups: [g('troll', 2, 2.6, 0, 'west', 0), g('trickster', 7, 0.65, 0, 'east', 3)] },
    { name: 'Market Rush',         flavor: 'Gargoyles from the east, brigands down Mill Lane.',                             groups: [g('bat', 3, 1.1, 0, 'east', 0), g('grunt', 8, 0.9, 0, 'mill', 3), g('trickster', 5, 0.7, 0, 'west', 6)] },
    { name: 'The Press',           flavor: 'The knaves lean on every road in turn.',                                        groups: [g('troll', 2, 2.6, 0, 'mill', 0), g('grunt', 8, 0.8, 0, 'west', 1), g('trickster', 6, 0.6, 0, 'east', 6), g('bat', 2, 1.3, 0, 'west', 10)] },
    { name: 'Pincer',              flavor: 'Knights down both western roads, gargoyles from the east.',                     groups: [g('troll', 2, 2.4, 0, 'west', 0), g('troll', 1, 2.4, 0, 'mill', 2), g('bat', 4, 1.0, 0, 'east', 4), g('grunt', 7, 0.8, 0, 'east', 9)] },
    { name: 'Ring the Bells',      flavor: 'Every bell in town is ringing. Hold the square.',                              groups: [g('grunt', 12, 0.6, 0, 'west', 0), g('trickster', 12, 0.45, 0, 'east', 0), g('troll', 3, 2.0, 0, 'mill', 0), g('bat', 4, 1.0, 0, 'mill', 6)] },
    { name: 'Riot',                flavor: 'Knights, Cutpurses and gargoyles, all at the same moment.',                     groups: [g('troll', 4, 2.0, 0, 'mill', 0), g('trickster', 14, 0.4, 0, 'east', 0), g('bat', 4, 0.9, 0, 'west', 0)] },
    { name: 'The Raven Host',      flavor: 'A storm of ravens with a warlock’s eye at its heart. It flies: only the Magus and the Longbowmen reach it.', groups: [g('bat', 3, 1.0, 0, 'mill', 0), g('grunt', 8, 0.7, 0, 'west', 1), g('ravens', 1, 1, 0, 'east', 7)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, toon, srand, scene, animated, puff,
      masonry, roofCourses, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;

    // A market stall: a plank counter on four posts under a striped awning,
    // with wares on the counter (cheeses, cloth bolts, apples).
    function stallParts(rng, ry = rng() < 0.5 ? 0 : Math.PI / 2) {
      const col = [PALETTE.capRed, PALETTE.tunic, PALETTE.gold, PALETTE.trickster][Math.floor(rng() * 4)];
      const c = Math.cos(ry), sn = Math.sin(ry);
      const at = (x, y, z, o = {}) => M(x * c + z * sn, y, -x * sn + z * c, { ...o, ry: (o.ry || 0) + ry });
      const parts = [P(GEO.box, PALETTE.wood, at(0, 0.18, 0, { sx: 0.5, sy: 0.05, sz: 0.28 }))];
      for (const [x, z] of [[-0.23, -0.12], [0.23, -0.12], [-0.23, 0.12], [0.23, 0.12]]) parts.push(P(GEO.box, PALETTE.wood, at(x, 0.25, z, { sx: 0.03, sy: 0.5, sz: 0.03 }), false));
      for (let i = 0; i < 4; i++) parts.push(P(GEO.box, i % 2 ? PALETTE.heraldWhite : col, at(-0.21 + i * 0.14, 0.52, 0.02, { sx: 0.14, sy: 0.02, sz: 0.36, rx: 0.25 })));
      const ware = [PALETTE.flowerYellow, PALETTE.capRed, PALETTE.canvas, PALETTE.acorn][Math.floor(rng() * 4)];
      for (let i = 0; i < 3; i++) parts.push(P(GEO.sphereLo, ware, at(-0.14 + i * 0.14, 0.24, 0.02, { sx: 0.06, sy: 0.04, sz: 0.06 }), false));
      return { parts, radius: 0.3 };
    }
    kit.extraRecipes = (rng) => ({ stall: () => stallParts(rng) });

    // The town bridge: a humped stone arch with low parapets and a lamp at
    // each corner, the brook running dark under it.
    function buildBridge() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      batchPart(P(GEO.box, PALETTE.cobble, M(0, 0.0, 0, { sx: 1.1, sy: 0.08, sz: 0.82 })), wm);
      for (let i = 0; i < 5; i++) batchPart(P(GEO.box, PALETTE.cobbleDark, M(-0.4 + i * 0.2, 0.045, 0, { sx: 0.02, sy: 0.01, sz: 0.78 }), false), wm);
      batchPart(P(GEO.torus, PALETTE.stoneDark, M(0, -0.16, 0, { sx: 0.42, sy: 0.3, sz: 1.3 }), false), wm);
      for (const s of [-1, 1]) {
        batchPart(P(GEO.box, PALETTE.stone, M(0, 0.13, s * 0.42, { sx: 1.16, sy: 0.22, sz: 0.1 })), wm);
        batchPart(P(GEO.box, PALETTE.stoneDark, M(0, 0.25, s * 0.42, { sx: 1.2, sy: 0.04, sz: 0.13 })), wm);
        for (const e of [-1, 1]) {
          const lx = e * 0.56, lz = s * 0.42;
          batchPart(P(GEO.box, PALETTE.stone, M(lx, 0.2, lz, { sx: 0.14, sy: 0.4, sz: 0.14 })), wm);
          batchPart(P(GEO.cyl, PALETTE.steelDark, M(lx, 0.5, lz, { sx: 0.012, sy: 0.24, sz: 0.012 }), false), wm);
          batchPart(P(GEO.box, PALETTE.windowWarm, M(lx, 0.66, lz, { sx: 0.06, sy: 0.08, sz: 0.06 }), false, { unlit: true }), wm);
          batchPart(P(GEO.cone, PALETTE.steelDark, M(lx, 0.74, lz, { sx: 0.06, sy: 0.06, sz: 0.06 }), false), wm);
          glow(x + lx, 0.66, z + lz, { w: 0.4, h: 0.4 });
        }
      }
    }

    // The Guildhall: a stone ground floor, a jettied timber-framed upper
    // floor, a tall tiled roof with a bell turret, and a clock whose hands
    // really turn. The bell swings harder as the town takes damage.
    function buildGuildhall() {
      const [cx, cz] = LC.endpointCenter(kit);
      const wm = M(cx, 0, cz);
      const st = { state: 0 };
      const gx = worldX(level.endpoint.gateCell[0]) - cx;
      const W = 2.5, D = 1.7, H1 = 0.9, H2 = 0.85, F = D / 2;   // F: the south face
      batchPart(P(GEO.box, kit.lerpColor(PALETTE.cobble, PALETTE.path, 0.4).getHex(), M(0, 0.01, 0.3, { sx: 2.9, sy: 0.02, sz: 2.4 }), false), wm);
      batchPart(P(GEO.box, PALETTE.stone, M(0, H1 / 2, 0, { sx: W, sy: H1, sz: D })), wm);
      masonry(wm, { face: 'z', at: F, u0: -W / 2, u1: W / 2, y0: 0.05, y1: H1, seed: 61, holes: [[gx, 0.36, 0.5, 0.72], [-0.75, 0.48, 0.28, 0.36], [0.75, 0.48, 0.28, 0.36]] });
      // the jettied upper floor, plaster between dark timbers
      const U0 = H1 + 0.04;
      batchPart(P(GEO.box, PALETTE.timber, M(0, H1 + 0.02, 0.06, { sx: W + 0.16, sy: 0.06, sz: D + 0.16 })), wm);
      batchPart(P(GEO.box, PALETTE.plaster, M(0, U0 + H2 / 2, 0.06, { sx: W + 0.14, sy: H2, sz: D + 0.12 })), wm);
      const UF = F + 0.12;
      for (let i = 0; i <= 6; i++) batchPart(P(GEO.box, PALETTE.timber, M(-W / 2 - 0.05 + i * (W + 0.1) / 6, U0 + H2 / 2, UF + 0.005, { sx: 0.05, sy: H2, sz: 0.012 }), false), wm);
      batchPart(P(GEO.box, PALETTE.timber, M(0, U0 + H2 - 0.03, UF + 0.005, { sx: W + 0.14, sy: 0.05, sz: 0.012 }), false), wm);
      for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) {
        const bx = sx * (0.42 + i * 0.84);
        batchPart(P(GEO.box, PALETTE.timber, M(bx, U0 + H2 / 2, UF + 0.006, { sx: 0.035, sy: H2 * 1.05, sz: 0.01, rz: sx * (i ? 0.62 : -0.62) }), false), wm);
      }
      LC.gableRoof(kit, wm, { y: U0 + H2, z: 0.06, len: W + 0.3, span: (D + 0.12) / 2 + 0.12, rise: 0.95, color: PALETTE.roofTile, gable: PALETTE.plaster });
      // the bell turret on the ridge, its bell swinging
      const TY = U0 + H2 + 0.95;
      for (const [x, z] of [[-0.16, -0.12], [0.16, -0.12], [-0.16, 0.24], [0.16, 0.24]]) batchPart(P(GEO.box, PALETTE.timber, M(x, TY + 0.22, z, { sx: 0.04, sy: 0.44, sz: 0.04 }), false), wm);
      const pyr = new THREE.ConeGeometry(1, 1, 4).toNonIndexed();
      batchPart(P(pyr, PALETTE.slate, M(0, TY + 0.6, 0.06, { sx: 0.36, sy: 0.4, sz: 0.36, ry: Math.PI / 4 })), wm);
      batchPart(P(GEO.cyl, PALETTE.steelDark, M(0, TY + 0.95, 0.06, { sx: 0.01, sy: 0.3, sz: 0.01 }), false), wm);
      batchPart(P(GEO.cone, PALETTE.gold, M(0.05, TY + 1.06, 0.06, { sx: 0.06, sy: 0.04, sz: 0.01, rz: Math.PI / 2 }), false), wm);
      const bell = liveProp([P(GEO.cylTaper, PALETTE.gold, M(0, -0.1, 0, { sx: 0.1, sy: 0.16, sz: 0.1 })), P(GEO.sphereLo, PALETTE.steelDark, M(0, -0.2, 0, { s: 0.03 }))], cx, TY + 0.4, cz + 0.06);
      // the clock on the upper floor's face, hands turning
      const clockY = U0 + H2 * 0.55, clockZ = cz + UF + 0.02;
      batchPart(P(GEO.cyl, PALETTE.gold, M(0, clockY, UF + 0.01, { sx: 0.2, sy: 0.02, sz: 0.2, rx: Math.PI / 2 }), false), wm);
      batchPart(P(GEO.cyl, PALETTE.cream, M(0, clockY, UF + 0.02, { sx: 0.17, sy: 0.02, sz: 0.17, rx: Math.PI / 2 }), false), wm);
      const hands = liveProp([
        P(GEO.box, PALETTE.outline, M(0, 0.06, 0, { sx: 0.02, sy: 0.12, sz: 0.01 }), false, { name: 'hour', live: true }),
        P(GEO.box, PALETTE.outline, M(0, 0.08, 0, { sx: 0.012, sy: 0.16, sz: 0.01 }), false, { name: 'minute', live: true }),
      ], cx, clockY, clockZ + 0.01);
      const hour = hands.getObjectByName('hour'), minute = hands.getObjectByName('minute');
      animated.push({
        update(t) {
          minute.rotation.z = -t * 0.5; hour.rotation.z = -t * 0.5 / 12;
          const k = st.state === 2 ? 0.9 : st.state === 1 ? 0.45 : 0.15;
          bell.rotation.z = Math.sin(t * 3.2) * k;
        },
      });
      // the door, steps and a hanging sign
      batchPart(P(GEO.box, 0x2b211b, M(gx, 0.34, F + 0.005, { sx: 0.44, sy: 0.68, sz: 0.03 }), false), wm);
      batchPart(P(GEO.cyl, 0x2b211b, M(gx, 0.68, F + 0.005, { sx: 0.22, sy: 0.03, sz: 0.22, rx: Math.PI / 2 }), false), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(gx, 0.32, F + 0.025, { sx: 0.36, sy: 0.62, sz: 0.02 }), false), wm);
      batchPart(P(GEO.box, PALETTE.stoneDark, M(gx, 0.03, F + 0.16, { sx: 0.7, sy: 0.06, sz: 0.3 }), false), wm);
      LC.windows(kit, wm, [cx, cz], [[-0.75, 0.48, F, 'z'], [0.75, 0.48, F, 'z'], [-0.75, U0 + H2 * 0.5, UF, 'z'], [0.75, U0 + H2 * 0.5, UF, 'z'], [W / 2 + 0.07, U0 + H2 * 0.5, 0.06, 'x']], st);
      // the town banner on a pole above the door
      batchPart(P(GEO.cyl, PALETTE.wood, M(gx + 0.42, U0 + 0.3, UF + 0.25, { sx: 0.02, sy: 0.6, sz: 0.02, rx: 0.9 }), false), wm);
      LC.banner(kit, cx + gx + 0.42, U0 + 0.5, cz + UF + 0.45, { w: 0.5, h: 0.3, field: PALETTE.capRed, stripe: PALETTE.gold, emblem: PALETTE.heraldWhite, stateRef: st });
      LC.damage(kit, {
        stateRef: st,
        cracks: [[cx - 0.4, 0.5, cz + F + 0.01, 0.18, 0.45, 'z'], [cx + 1.0, U0 + 0.4, cz + UF + 0.01, 0.2, 0.5, 'z'], [cx + W / 2 + 0.08, 0.5, cz - 0.3, 0.2, 0.4, 'x']],
        rubble: [[cx - 1.45, cz + 1.2], [cx + 1.45, cz + 1.1], [cx + 1.5, cz - 0.6], [cx - 1.5, cz - 0.5]],
        fire: [cx - 0.5, U0 + H2 + 0.4, cz + 0.2], smoke: [cx, U0 + H2 + 0.8, cz], burst: [cx + gx, 0.6, cz + F + 0.4],
      });
    }

    // The maypole on the green: a tall striped pole with a flower crown,
    // ribbons streaming out as the whole thing turns.
    function buildMaypole(c, r) {
      const x = worldX(c), z = worldZ(r);
      batchPart(P(GEO.cyl, PALETTE.heraldWhite, M(x, 0.9, z, { sx: 0.04, sy: 1.8, sz: 0.04 })));
      for (let i = 0; i < 6; i++) batchPart(P(GEO.cyl, PALETTE.capRed, M(x, 0.2 + i * 0.28, z, { sx: 0.045, sy: 0.07, sz: 0.045 }), false));
      batchDecal(x, z, 0.3);
      const parts = [P(GEO.torus, PALETTE.meadow, M(0, 0, 0, { sx: 0.16, sy: 0.16, sz: 0.3, rx: Math.PI / 2 }))];
      for (let i = 0; i < 6; i++) parts.push(P(GEO.bead, [PALETTE.flowerPink, PALETTE.flowerYellow, PALETTE.heraldWhite][i % 3], M(Math.cos(i) * 0.16, 0.04, Math.sin(i) * 0.16, { s: 0.045 }), false));
      const cols = [PALETTE.capRed, PALETTE.tunic, PALETTE.gold, PALETTE.flowerPink, PALETTE.meadowLight, PALETTE.heraldWhite];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        parts.push(P(GEO.box, cols[i], M(Math.cos(a) * 0.42, -0.5, Math.sin(a) * 0.42, { sx: 0.03, sy: 1.1, sz: 0.008, ry: -a, rz: 0, rx: 0 }), false));
      }
      const crown = liveProp(parts, x, 1.7, z);
      animated.push({ update(t) { crown.rotation.y = t * 0.6; crown.children.forEach((m) => { m.rotation.x = 0; }); } });
    }

    LC.stream(kit, { seed: 61, speed: 1.0 });
    buildBridge();
    buildGuildhall();
    buildMaypole(15, 5);
    // market stalls round the square and on the green
    const rng = srand(6262);
    for (const [c, r] of [[8, 10], [10, 10], [12, 11], [9, 12], [14, 6], [17, 6], [16, 4], [18, 4]]) {
      if (GameState.cellKind(c, r) !== 'ground' || GameState.isBuildable(c, r)) continue;
      const made = stallParts(rng);
      const x = worldX(c) + (rng() - 0.5) * 0.3, z = worldZ(r) + (rng() - 0.5) * 0.3;
      for (const p of made.parts) batchPart(p, M(x, 0, z));
      batchDecal(x, z, made.radius);
    }
    LC.knaveCamps(kit);
    const endC = level.endpoint.cells.map(([c]) => c);
    LC.countryside(kit, {
      seed: 6161,
      mix: [[8, 'tree'], [7, 'bush'], [8, 'tuft'], [6, 'flower'], [16, 'cottage'], [5, 'fence'], [6, 'barrel'], [4, 'cart'], [3, 'well'], [6, 'stall'], [14, null]],
      edge: [[30, 'tree'], [30, 'cottage'], [8, 'bush'], [6, 'barrel'], [26, null]],
      keepLow: (c, r) => c >= Math.min(...endC) - 1 && c <= Math.max(...endC) + 1 && r <= 4,
    });
  }

  // the West Gate road and Mill Lane meet at (5,7), cross the brook on the
  // town bridge at (7,7) and run into the square; the east road joins at
  // (10,7); everything turns north up to the Guildhall door
  const tail = [[5, 7], [8, 7], [10, 7], [10, 4]];
  return {
    id: 'wickham-fair',
    index: 6,
    name: 'Wickham Fair',
    subtitle: 'Fair day in a market town. Three roads lead to the square.',
    map: { x: 430, y: 150, reclaim: 95, icon: 'guildhall' },
    grid: { cols: 20, rows: 13 },
    spawn: [0, 2],
    routes: [
      { id: 'west', waypoints: [[0, 2], [4, 2], [4, 4], [1, 4], [1, 7], ...tail] },
      { id: 'mill', waypoints: [[0, 10], [5, 10], ...tail] },
      { id: 'east', waypoints: [[19, 11], [16, 11], [16, 9], [13, 9], [13, 7], [10, 7], [10, 4]] },
    ],
    chokepoint: { cell: [7, 7], streamCol: 7 },
    endpoint: {
      name: 'the Guildhall', properName: 'The Guildhall',
      cells: [[9, 1], [10, 1], [11, 1], [9, 2], [10, 2], [11, 2], [9, 3], [10, 3], [11, 3]], gateCell: [10, 3],
    },
    cobbleTailCells: 4,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [-0.5, 6], radiusOut: { x: 5.5, z: 8.5 }, radiusIn: 1.2, falloffWidth: 0.5, motes: { embers: 22, fireflies: 16 },
      groundMeadow: 0x84b052, groundMeadowDark: 0x6a9a43 },
    spawnBlockedText: "That's the Baron's camp. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 180, startLives: 20, starThresholds: [16, 8],
    tipTile: [2, 3],
    endScreenText: {
      3: () => 'Thirteen waves, the Raven Host scattered, and not a single stall was looted. The fair goes on.',
      2: (s) => `The ravens are gone and the square still stands, with ${s.lives} lives to spare. Wickham keeps its fair.`,
      1: (s) => `The Guildhall door is scorched, but it holds, with ${s.lives} lives left.`,
      lose: (s) => `The Guildhall fell on wave ${s.wave}. Build around the square where all three roads meet, watch the east road that skips the bridge, and save gold for the Raven Host.`,
    },
    buildScene,
  };
})();
