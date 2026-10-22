// ===================================================================
// LEVEL 8 — Amberlea Vineyards
// Harvest time on the vineyard hills, and the knaves have come for the
// wine. The Vine Road crosses the irrigation channel and sweeps round
// two sides of the windmill hill before it reaches the door, so towers
// on the hill see it twice. The Orchard Path joins it before the
// channel; the Cellar Lane winds up from the south for the last leg.
// ===================================================================
const LEVEL_8 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: 'Grape Thieves',        flavor: 'Brigands on the Vine Road. It circles the whole hill before the mill.',       groups: [g('grunt', 5, 3.0, 0, 'vine')] },
    { name: 'The Orchard Path',     flavor: 'More through the orchard. It joins the Vine Road before the channel.',        groups: [g('grunt', 5, 2.0, 0, 'vine', 0), g('grunt', 4, 2.2, 0, 'orchard', 3)] },
    { name: 'Down the Cellar Lane', flavor: 'Cutpurses take the short Cellar Lane. It skips most of the hill.',            groups: [g('grunt', 5, 1.6, 0, 'orchard', 0), g('trickster', 5, 1.0, 0, 'cellar', 4)] },
    { name: 'Knight in the Vines',  flavor: 'A Black Knight on the Vine Road. Towers on the hill hit it all the way round.', groups: [g('grunt', 7, 1.3, 0, 'vine', 0), g('troll', 1, 1, 0, 'orchard', 2), g('grunt', 6, 1.5, 0, 'cellar', 8)] },
    { name: 'Wings over the Rows',  flavor: 'Gargoyles up the Cellar Lane. The Magus and the Longbowmen reach them.',     groups: [g('bat', 3, 1.3, 0, 'cellar', 0), g('grunt', 10, 1.0, 0, 'vine', 3)] },
    { name: 'Three Rows',           flavor: 'Every road at once. The mill hill sees them all.',                             groups: [g('grunt', 10, 0.88, 0, 'vine', 0), g('grunt', 9, 0.88, 0, 'orchard', 0), g('grunt', 6, 0.96, 0, 'cellar', 2)] },
    { name: 'Iron Harvest',         flavor: 'Knights through the orchard, Cutpurses down the lane.',                       groups: [g('troll', 4, 2.24, 0, 'orchard', 0), g('trickster', 12, 0.56, 0, 'cellar', 3)] },
    { name: 'The Crush',            flavor: 'Gargoyles over the vines, Cutpurses in the lane, brigands in the orchard.',    groups: [g('bat', 6, 1.0, 0, 'vine', 0), g('trickster', 12, 0.52, 0, 'cellar', 4), g('grunt', 10, 0.8, 0, 'orchard', 6)] },
    { name: 'The Press',            flavor: 'The knaves lean on every road in turn.',                                      groups: [g('troll', 4, 2.08, 0, 'orchard', 0), g('grunt', 16, 0.64, 0, 'vine', 1), g('trickster', 10, 0.52, 0, 'cellar', 6), g('bat', 6, 1.0, 0, 'vine', 10)] },
    { name: 'Pincer',               flavor: 'Knights on both long roads, gargoyles over the lane.',                        groups: [g('troll', 4, 1.92, 0, 'orchard', 0), g('troll', 2, 1.92, 0, 'vine', 2), g('bat', 8, 0.8, 0, 'cellar', 4), g('grunt', 12, 0.64, 0, 'cellar', 9)] },
    { name: 'Vintage',              flavor: 'The whole host comes for the wine. Hold the mill.',                           groups: [g('grunt', 20, 0.52, 0, 'vine', 0), g('trickster', 16, 0.4, 0, 'cellar', 2), g('troll', 6, 1.76, 0, 'orchard', 3), g('bat', 7, 0.85, 0, 'vine', 8)] },
    { name: 'Last Pressing',        flavor: 'Knights, Cutpurses and gargoyles, all at the same moment.',                   groups: [g('troll', 6, 1.76, 0, 'orchard', 0), g('trickster', 21, 0.36, 0, 'cellar', 0), g('bat', 8, 0.65, 0, 'vine', 0)] },
    { name: 'The Siege Tower',      flavor: 'The Baron rolls out a siege tower. It walks the road, so every tower can hit it, but it is thick with iron.', groups: [g('bat', 5, 1.0, 0, 'cellar', 0), g('grunt', 16, 0.6, 0, 'orchard', 1), g('siegetower', 1, 1, 0, 'vine', 7)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, toon, srand, scene, animated, puff,
      towerCourses, roofCourses, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;

    // A short row of vines on stakes and a wire, heavy with purple grapes.
    function vinesParts(rng) {
      const ry = rng() < 0.5 ? 0 : Math.PI / 2, c = Math.cos(ry), sn = Math.sin(ry);
      const at = (x, y, z, o = {}) => M(x * c + z * sn, y, -x * sn + z * c, { ...o, ry: (o.ry || 0) + ry });
      const parts = [];
      for (const u of [-0.32, 0, 0.32]) parts.push(P(GEO.cyl, PALETTE.wood, at(u, 0.2, 0, { sx: 0.018, sy: 0.4, sz: 0.018 }), false));
      parts.push(P(GEO.cyl, PALETTE.steelDark, at(0, 0.34, 0, { sx: 0.006, sy: 0.66, sz: 0.006, rz: Math.PI / 2 }), false));
      for (let i = 0; i < 4; i++) {
        const u = -0.27 + i * 0.18;
        parts.push(P(GEO.sphereLo, i % 2 ? PALETTE.meadowDark : PALETTE.meadow, at(u, 0.3, 0, { sx: 0.11, sy: 0.1, sz: 0.09 })));
        if (rng() < 0.75) parts.push(P(GEO.sphereLo, PALETTE.magic, at(u + 0.03, 0.2, 0.07, { sx: 0.04, sy: 0.06, sz: 0.04 }), false));
      }
      return { parts, radius: 0.18 };
    }
    // an apple tree: the meadow tree with red fruit
    function appleParts(rng) {
      const made = kit.treeParts(rng);
      for (let i = 0; i < 6; i++) { const a = rng() * 6.28; made.parts.push(P(GEO.bead, PALETTE.capRed, M(Math.cos(a) * 0.32, 0.75 + rng() * 0.35, Math.sin(a) * 0.32, { s: 0.05 }), false)); }
      return made;
    }
    // a wine barrel on a cradle, or a stack of three
    function caskParts(rng) {
      const parts = [P(GEO.cyl, PALETTE.wood, M(0, 0.14, 0, { sx: 0.12, sy: 0.28, sz: 0.12, rz: Math.PI / 2 })),
        P(GEO.ring, PALETTE.steelDark, M(0.08, 0.14, 0, { s: 0.122, ry: Math.PI / 2 }), false), P(GEO.ring, PALETTE.steelDark, M(-0.08, 0.14, 0, { s: 0.122, ry: Math.PI / 2 }), false),
        P(GEO.box, PALETTE.woodLight, M(0, 0.02, 0, { sx: 0.3, sy: 0.04, sz: 0.2 }), false)];
      if (rng() < 0.5) parts.push(P(GEO.cyl, PALETTE.wood, M(0.04, 0.38, 0, { sx: 0.11, sy: 0.26, sz: 0.11, rz: Math.PI / 2 })));
      return { parts, radius: 0.18 };
    }
    kit.extraRecipes = (rng) => ({ vines: () => vinesParts(rng), apple: () => appleParts(rng), cask: () => caskParts(rng) });

    // The channel bridge: a little humped bridge of honey stone beside the
    // wooden sluice gate that lets water down to the vines.
    function buildSluice() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      batchPart(P(GEO.box, kit.lerpColor(PALETTE.stone, PALETTE.straw, 0.3).getHex(), M(0, 0.0, 0, { sx: 1.1, sy: 0.08, sz: 0.8 })), wm);
      batchPart(P(GEO.torus, PALETTE.stoneDark, M(0, -0.16, 0, { sx: 0.4, sy: 0.28, sz: 1.2 }), false), wm);
      for (const s of [-1, 1]) {
        batchPart(P(GEO.box, PALETTE.stone, M(0, 0.1, s * 0.41, { sx: 1.12, sy: 0.16, sz: 0.08 })), wm);
        for (const e of [-1, 1]) batchPart(P(GEO.sphereLo, PALETTE.stoneDark, M(e * 0.55, 0.2, s * 0.41, { s: 0.06 })), wm);
      }
      // the sluice gate just upstream
      for (const e of [-1, 1]) batchPart(P(GEO.box, PALETTE.wood, M(e * 0.5, 0.2, -0.75, { sx: 0.08, sy: 0.6, sz: 0.08 })), wm);
      batchPart(P(GEO.box, PALETTE.woodLight, M(0, 0.05, -0.75, { sx: 0.95, sy: 0.3, sz: 0.05 })), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(0, 0.5, -0.75, { sx: 1.05, sy: 0.06, sz: 0.08 })), wm);
      batchPart(P(GEO.cyl, PALETTE.steelDark, M(0, 0.58, -0.75, { sx: 0.06, sy: 0.04, sz: 0.06 }), false), wm);
      let t0 = 0;
      animated.push({ update(t, dt) {
        t0 -= dt;
        if (t0 <= 0) { t0 = 0.2; puff(x + (Math.random() - 0.5) * 0.7, 0.02, z - 0.65, { count: 1, color: PALETTE.waterFoam, speed: 0.2, size: 0.07, up: 0.3, ttl: 0.4 }); }
      } });
    }

    // The Amberlea windmill: a round honey-stone tower with a thatched cap,
    // four lattice sails turning in the breeze, a granary lean-to and sacks
    // of flour by the door. The sails slow as the mill is hurt, and stop.
    function buildWindmill() {
      const [cx, cz] = LC.endpointCenter(kit);
      const wm = M(cx, 0, cz);
      const st = { state: 0 };
      const gx = worldX(level.endpoint.gateCell[0]) - cx;
      batchPart(P(GEO.box, kit.lerpColor(PALETTE.path, PALETTE.straw, 0.3).getHex(), M(0, 0.01, 0, { sx: 2.9, sy: 0.02, sz: 2.9 }), false), wm);
      const MX = 0, MZ = -0.15, R0 = 0.78, R1 = 0.52, H = 2.3;
      const towerGeo = new THREE.CylinderGeometry(R1, R0, H, 14).toNonIndexed();
      batchPart(P(towerGeo, kit.lerpColor(PALETTE.stone, PALETTE.straw, 0.25).getHex(), M(MX, H / 2, MZ, { s: 1 })), wm);
      batchPart(P(GEO.cyl, PALETTE.stoneDark, M(MX, 0.1, MZ, { sx: R0 + 0.06, sy: 0.2, sz: R0 + 0.06 })), wm);
      towerCourses(wm, { x: MX, z: MZ, r: (R0 + R1) / 2, y0: 0.25, y1: H - 0.1, seed: 81, holes: [[0, 0.4, 0.8], [0, 1.4, 0.4]] });
      batchPart(P(GEO.cyl, PALETTE.timber, M(MX, H + 0.02, MZ, { sx: R1 + 0.1, sy: 0.1, sz: R1 + 0.1 })), wm);
      batchPart(P(GEO.cone, PALETTE.thatch, M(MX, H + 0.45, MZ, { sx: R1 + 0.16, sy: 0.85, sz: R1 + 0.16 })), wm);
      roofCourses(wm, { x: MX, y: H + 0.04, z: MZ, r: R1 + 0.16, h: 0.85, color: PALETTE.thatch, kind: 'cone', rings: 3 });
      batchPart(P(GEO.sphereLo, PALETTE.gold, M(MX, H + 0.92, MZ, { s: 0.05 })), wm);
      // the sails on a hub at the front of the cap
      const HY = H - 0.05, HZ = MZ + R1 + 0.22;
      batchPart(P(GEO.cyl, PALETTE.timber, M(MX, HY, HZ - 0.12, { sx: 0.06, sy: 0.3, sz: 0.06, rx: Math.PI / 2 })), wm);
      const sail = [P(GEO.cyl, PALETTE.timber, M(0, 0, 0, { sx: 0.09, sy: 0.08, sz: 0.09, rx: Math.PI / 2 }))];
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
        sail.push(P(GEO.box, PALETTE.wood, M(ca * 0.62, sa * 0.62, 0, { sx: 1.2, sy: 0.04, sz: 0.04, rz: a }), true, { name: `arm${i}`, live: true }));
        sail.push(P(GEO.box, PALETTE.canvas, M(ca * 0.72 - sa * 0.11, sa * 0.72 + ca * 0.11, -0.01, { sx: 0.86, sy: 0.2, sz: 0.012, rz: a }), true, { name: `cloth${i}`, live: true }));
        for (let k = 0; k < 4; k++) sail.push(P(GEO.box, PALETTE.woodLight, M(ca * (0.36 + k * 0.2) - sa * 0.11, sa * (0.36 + k * 0.2) + ca * 0.11, 0.0, { sx: 0.015, sy: 0.22, sz: 0.012, rz: a }), false, { name: `slat${i}_${k}`, live: true }));
      }
      const sails = liveProp(sail, cx + MX, HY, cz + HZ);
      // the door, granary lean-to, flour sacks and a cart
      batchPart(P(GEO.box, 0x2b211b, M(gx, 0.3, MZ + R0 - 0.03, { sx: 0.34, sy: 0.6, sz: 0.06 }), false), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(gx, 0.3, MZ + R0, { sx: 0.3, sy: 0.56, sz: 0.03 }), false), wm);
      batchPart(P(GEO.box, PALETTE.timber, M(gx, 0.62, MZ + R0 + 0.02, { sx: 0.42, sy: 0.05, sz: 0.04 }), false), wm);
      const SX = -0.95, SZ = 0.35;
      batchPart(P(GEO.box, PALETTE.plaster, M(SX, 0.3, SZ, { sx: 0.6, sy: 0.6, sz: 0.9 })), wm);
      batchPart(P(GEO.box, PALETTE.thatch, M(SX - 0.04, 0.68, SZ, { sx: 0.74, sy: 0.05, sz: 1.0, rz: 0.35 })), wm);
      for (let i = 0; i < 3; i++) batchPart(P(GEO.sphereLo, PALETTE.canvas, M(0.75 + (i % 2) * 0.16, 0.12 + (i === 2 ? 0.16 : 0), 0.85, { sx: 0.1, sy: 0.12, sz: 0.09 })), wm);
      LC.windows(kit, wm, [cx, cz], [[MX, 1.4, MZ + (R0 + R1) / 2 - 0.02, 'z'], [SX, 0.35, SZ + 0.45, 'z']], st);
      // the miller's pennant on the cap
      batchPart(P(GEO.cyl, PALETTE.wood, M(MX - 0.25, H + 0.95, MZ - 0.25, { sx: 0.015, sy: 0.6, sz: 0.015 }), false), wm);
      LC.banner(kit, cx + MX - 0.25, H + 1.15, cz + MZ - 0.25, { w: 0.42, h: 0.24, field: PALETTE.gold, stripe: PALETTE.capRed, emblem: PALETTE.heraldWhite, stateRef: st });
      let spin = 0;
      animated.push({ update(t, dt) {
        const speed = st.state === 2 ? 0 : st.state === 1 ? 0.45 : 0.9;
        spin += dt * speed;
        sails.rotation.z = -spin;
        // at the worst state one sail has blown off
        sails.getObjectByName('cloth2').visible = sails.getObjectByName('arm2').visible = st.state < 2;
      } });
      LC.damage(kit, {
        stateRef: st,
        cracks: [[cx + MX + 0.25, 0.9, cz + MZ + R0 - 0.08, 0.18, 0.5, 'z'], [cx + MX - 0.3, 1.6, cz + MZ + R1 + 0.06, 0.16, 0.4, 'z']],
        rubble: [[cx - 1.4, cz + 1.2], [cx + 1.4, cz + 1.0], [cx + 1.3, cz - 1.1], [cx - 1.3, cz - 0.9]],
        fire: [cx + SX, 0.75, cz + SZ], smoke: [cx + MX, H + 0.6, cz + MZ], burst: [cx + gx, 0.6, cz + 1.2],
      });
    }

    LC.stream(kit, { seed: 81, speed: 0.8 });
    buildSluice();
    buildWindmill();
    LC.knaveCamps(kit);
    const endR = level.endpoint.cells.map(([, r]) => r), endC = level.endpoint.cells.map(([c]) => c);
    LC.countryside(kit, {
      seed: 8181,
      mix: [[6, 'tree'], [8, 'apple'], [22, 'vines'], [6, 'bush'], [6, 'tuft'], [5, 'flower'], [5, 'hay'], [4, 'cask'], [3, 'fence'], [2, 'cottage'], [2, 'cart'], [14, null]],
      edge: [[22, 'tree'], [16, 'apple'], [20, 'vines'], [8, 'cottage'], [6, 'hay'], [28, null]],
      keepLow: (c, r) => c >= Math.min(...endC) - 1 && c <= Math.max(...endC) + 1 && r >= Math.min(...endR) - 1,
    });
  }

  // the Vine Road's sweep round the windmill hill, shared by all three
  // roads from where each joins it: east along row 3 above the mill, down
  // column 17 beside it, then west along row 9 to the mill door
  const loop = [[17, 3], [17, 6], [17, 9], [14, 9]];
  return {
    id: 'amberlea-vineyards',
    index: 8,
    name: 'Amberlea Vineyards',
    subtitle: 'Harvest on the vineyard hills. The road circles the windmill.',
    map: { x: 226, y: 102, reclaim: 95, icon: 'windmill' },
    grid: { cols: 20, rows: 14 },
    spawn: [0, 6],
    routes: [
      { id: 'vine', waypoints: [[0, 6], [3, 6], [3, 3], [6, 3], [10, 3], [13, 3], ...loop] },
      { id: 'orchard', waypoints: [[0, 11], [4, 11], [4, 8], [6, 8], [6, 3], [10, 3], [13, 3], ...loop] },
      { id: 'cellar', waypoints: [[11, 13], [11, 11], [14, 11], [14, 13], [17, 13], [17, 9], [14, 9]] },
    ],
    chokepoint: { cell: [8, 3], streamCol: 8 },
    endpoint: {
      name: 'the Amberlea windmill', properName: 'The Amberlea Windmill',
      cells: [[13, 6], [14, 6], [15, 6], [13, 7], [14, 7], [15, 7], [13, 8], [14, 8], [15, 8]], gateCell: [14, 8],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [-0.5, 8.5], radiusOut: { x: 6, z: 8 }, radiusIn: 1.2, falloffWidth: 0.5, motes: { embers: 16, leaves: 30 },
      groundMeadow: 0x9aae4e, groundMeadowDark: 0x829640, ambient: 0.4 },
    spawnBlockedText: "That's the Baron's camp. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 165, startLives: 20, starThresholds: [16, 8],
    tipTile: [2, 5],
    endScreenText: {
      3: () => 'Thirteen waves, a siege tower toppled into the vines, and the harvest is safe. The mill keeps turning.',
      2: (s) => `The siege tower is kindling and the sails still turn, with ${s.lives} lives to spare. Amberlea holds.`,
      1: (s) => `The windmill is scorched and one sail is gone, but it holds, with ${s.lives} lives left.`,
      lose: (s) => `The windmill fell on wave ${s.wave}. Build on the hill inside the loop, where towers see the road twice, and watch the short Cellar Lane.`,
    },
    buildScene,
  };
})();
