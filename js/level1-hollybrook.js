// ===================================================================
// LEVEL 1 — Hollybrook Manor
// The Black Baron's knaves cross the border at dawn and the first thing in
// their way is a sleepy village. One long road snakes through the fields,
// over the Mill Bridge and up to the manor house. The Baron's Siege Ram
// closes the day.
// ===================================================================
const LEVEL_1 = (() => {
  // route/at are optional: which road the group takes, and an absolute start
  // time for groups that come at once (see GameState.startWave)
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  // The twelve waves. Each group spawns after `delay` seconds, one enemy
  // every `gap` seconds. Flavor lines teach the new threat in-world.
  const waves = [
    { name: 'Footpads',          flavor: 'A handful of brigands, strolling up the road like they own it.',        groups: [g('grunt', 5, 3.4)] },
    { name: 'The Rabble',        flavor: 'More brigands. They travel in bunches.',                                 groups: [g('grunt', 8, 1.4)] },
    { name: 'Light Fingers',     flavor: 'Cutpurses: fast, flimsy and very rude. Squires love them.',              groups: [g('grunt', 5, 1.2), g('trickster', 7, 0.65, 2)] },
    { name: 'The Black Knight',  flavor: 'A renegade knight in black plate. Small hits just clink. Hit it hard.',   groups: [g('grunt', 8, 1.0), g('troll', 1, 1, 3)] },
    { name: 'Stone Wings',       flavor: 'Gargoyles take wing. Only the Court Magus and Longbowmen can reach them.', groups: [g('bat', 5, 1.2), g('grunt', 8, 0.9, 2)] },
    { name: 'Pickpocket Rush',   flavor: 'A flood of Cutpurses, with Black Knights clanking behind.',              groups: [g('trickster', 12, 0.5), g('troll', 2, 3, 3)] },
    { name: 'Mixed Company',     flavor: 'Brigands on the road, gargoyles overhead. Cover both.',                  groups: [g('grunt', 14, 0.7), g('bat', 7, 0.85, 1)] },
    { name: 'Iron Column',       flavor: 'Four Black Knights. Sticky pitch and heavy hammers win this one.',       groups: [g('troll', 5, 2.2), g('trickster', 10, 0.5, 4)] },
    { name: 'Dark Sky',          flavor: 'A flock of gargoyles. The village bells are ringing.',                   groups: [g('bat', 13, 0.55), g('grunt', 14, 0.6, 1)] },
    { name: 'The Push',          flavor: 'Everything at once. Hold the Mill Bridge.',                              groups: [g('troll', 7, 1.7), g('grunt', 18, 0.45, 1), g('bat', 9, 0.7, 3)] },
    { name: 'Last Light',        flavor: 'The Baron empties his camp onto the road.',                              groups: [g('trickster', 22, 0.36), g('troll', 6, 1.8, 2), g('bat', 11, 0.6, 2)] },
    { name: 'The Siege Ram',     flavor: 'The Baron rolls out his Siege Ram. Everything you have can hit it. Stop it before the gate.', groups: [g('bat', 7, 0.85), g('grunt', 12, 0.65, 1), g('troll', 2, 2.5, 2), g('ram', 1, 1, 4)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, decal, toon, srand, scene, animated, puff,
      masonry, towerCourses, roofCourses, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;

    // The Mill Bridge: a humpbacked stone bridge over the brook, with the
    // village watermill turning on the far bank.
    function buildBridge() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      const rng = srand(33);
      // the hump: stepped stone courses rising to the middle
      for (let i = 0; i < 7; i++) {
        const u = -0.6 + i * 0.2, y = 0.06 * Math.cos(u * 2.4) - 0.02;
        batchPart(P(GEO.box, i % 2 ? PALETTE.cobble : PALETTE.stone, M(u, y, 0, { sx: 0.21, sy: 0.12, sz: 0.86 })), wm);
      }
      // the arch underneath, dark where the water runs through
      batchPart(P(GEO.cyl, 0x2b3a40, M(0, -0.16, 0, { sx: 0.32, sy: 0.9, sz: 0.2, rx: Math.PI / 2 }), false), wm);
      // parapets with coping stones
      for (const side of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const u = -0.55 + i * 0.22, y = 0.06 * Math.cos(u * 2.4);
          batchPart(P(GEO.box, i % 2 ? PALETTE.stoneDark : PALETTE.stone, M(u, y + 0.15, side * 0.44, { sx: 0.21, sy: 0.2 + rng() * 0.03, sz: 0.1 })), wm);
        }
        batchPart(P(GEO.box, PALETTE.stoneDark, M(side * 0.7, 0.1, -0.44, { sx: 0.12, sy: 0.3, sz: 0.12 })), wm);
        batchPart(P(GEO.box, PALETTE.stoneDark, M(side * 0.7, 0.1, 0.44, { sx: 0.12, sy: 0.3, sz: 0.12 })), wm);
      }
      batchPart(P(GEO.sphereLo, PALETTE.moss, M(-0.3, 0.27, 0.45, { sx: 0.16, sy: 0.04, sz: 0.06 }), false), wm);
    }
    function buildMill() {
      const sx = worldX(level.chokepoint.streamCol), z = worldZ(8.6);
      const mx = sx + 1.15;
      const wm = M(mx, 0, z);
      batchPart(P(GEO.box, PALETTE.stone, M(0, 0.32, 0, { sx: 0.95, sy: 0.64, sz: 0.8 })), wm);
      masonry(wm, { face: 'z', at: 0.4, u0: -0.47, u1: 0.47, y0: 0.05, y1: 0.62, seed: 5, holes: [[0.1, 0.25, 0.22, 0.4]] });
      batchPart(P(GEO.box, PALETTE.plaster, M(0, 0.84, 0, { sx: 0.95, sy: 0.4, sz: 0.8 })), wm);
      batchPart(P(GEO.box, PALETTE.timber, M(0, 0.84, 0.405, { sx: 0.95, sy: 0.03, sz: 0.01 }), false), wm);
      for (const u of [-0.45, 0, 0.45]) batchPart(P(GEO.box, PALETTE.timber, M(u, 0.84, 0.405, { sx: 0.035, sy: 0.4, sz: 0.01 }), false), wm);
      LC.gableRoof(kit, wm, { y: 1.04, len: 1.05, span: 0.48, rise: 0.4, color: PALETTE.thatch });
      batchPart(P(GEO.box, PALETTE.wood, M(0.1, 0.22, 0.41, { sx: 0.2, sy: 0.4, sz: 0.02 }), false), wm);
      batchPart(P(GEO.box, PALETTE.windowWarm, M(-0.25, 0.86, 0.41, { sx: 0.12, sy: 0.12, sz: 0.01 }), false, { unlit: true }), wm);
      batchPart(P(GEO.cyl, PALETTE.wood, M(-0.62, 0.42, 0, { sx: 0.04, sy: 0.3, sz: 0.04, rz: Math.PI / 2 }), false), wm);
      batchDecal(mx, z, 0.65);
      // the water wheel, turning in the brook
      const paddles = [P(GEO.torus, PALETTE.wood, M(0, 0, 0, { sx: 0.38, sy: 0.38, sz: 0.5 })), P(GEO.cyl, PALETTE.steelDark, M(0, 0, 0, { sx: 0.06, sy: 0.14, sz: 0.06, rx: Math.PI / 2 }))];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        paddles.push(P(GEO.box, PALETTE.woodLight, M(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0, { sx: 0.16, sy: 0.04, sz: 0.14, rz: a })));
        paddles.push(P(GEO.box, PALETTE.wood, M(Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0, { sx: 0.36, sy: 0.02, sz: 0.02, rz: a }), false));
      }
      const wheel = liveProp(paddles, mx - 0.72, 0.3, z);
      wheel.rotation.y = Math.PI / 2;
      let foam = 0;
      animated.push({
        update(t, dt) {
          wheel.rotation.set(0, Math.PI / 2, -t * 0.9, 'YXZ');
          foam -= dt;
          if (foam <= 0) { foam = 0.25; puff(mx - 0.72, -0.05, z + (Math.random() - 0.5) * 0.3, { count: 1, color: PALETTE.waterFoam, speed: 0.3, size: 0.07, up: 0.5, ttl: 0.5 }); }
        },
      });
    }

    // Hollybrook Manor: a stone ground floor under a jettied timber-framed
    // upper storey, a steep tiled roof, a round stone tower with a slate
    // spire flying the King's banner, a smoking chimney and lit windows.
    function buildManor() {
      const [cx, cz] = LC.endpointCenter(kit);
      const wm = M(cx, 0, cz);
      const gx = worldX(level.endpoint.gateCell[0]) - cx, gz = 1.12;
      const st = { state: 0 };
      batchPart(P(GEO.circle, lerpPath(), M(0, 0.008, 0.2, { sx: 1.2, sz: 1.6 }), false), wm);
      // ground floor in stone, with a plinth
      batchPart(P(GEO.box, PALETTE.stone, M(0, 0.42, 0, { sx: 1.7, sy: 0.84, sz: 2.2 })), wm);
      batchPart(P(GEO.box, PALETTE.stoneDark, M(0, 0.07, 0, { sx: 1.78, sy: 0.14, sz: 2.28 })), wm);
      masonry(wm, { face: 'z', at: 1.1, u0: -0.85, u1: 0.85, y0: 0.14, y1: 0.84, seed: 11, holes: [[gx, 0.4, 0.62, 0.8], [0.35, 0.5, 0.3, 0.38]] });
      masonry(wm, { face: 'x', at: 0.85, u0: -1.1, u1: 1.1, y0: 0.14, y1: 0.84, seed: 12, holes: [[0.3, 0.5, 0.3, 0.38]] });
      // the jettied upper storey: plaster between dark beams
      const UY = 1.18, UH = 0.66;
      batchPart(P(GEO.box, PALETTE.plaster, M(0, UY, 0, { sx: 1.84, sy: UH, sz: 2.34 })), wm);
      batchPart(P(GEO.box, PALETTE.timber, M(0, UY - UH / 2 + 0.02, 0, { sx: 1.88, sy: 0.05, sz: 2.38 })), wm);
      batchPart(P(GEO.box, PALETTE.timber, M(0, UY + UH / 2 - 0.02, 0, { sx: 1.86, sy: 0.04, sz: 2.36 })), wm);
      for (let i = 0; i < 6; i++) {
        const u = -0.88 + i * 0.352;
        batchPart(P(GEO.box, PALETTE.timber, M(u, UY, 1.172, { sx: 0.045, sy: UH, sz: 0.012 }), false), wm);
        if (i < 5) batchPart(P(GEO.box, PALETTE.timber, M(u + 0.176, UY, 1.172, { sx: 0.035, sy: UH * 1.08, sz: 0.01, rz: i % 2 ? 0.5 : -0.5 }), false), wm);
      }
      for (let i = 0; i < 7; i++) {
        const u = -1.12 + i * 0.373;
        batchPart(P(GEO.box, PALETTE.timber, M(0.922, UY, u, { sx: 0.012, sy: UH, sz: 0.045 }), false), wm);
        if (i < 6) batchPart(P(GEO.box, PALETTE.timber, M(0.922, UY, u + 0.186, { sx: 0.01, sy: UH * 1.08, sz: 0.035, rx: i % 2 ? 0.5 : -0.5 }), false), wm);
      }
      // the tiled roof, ridge running north-south, and a tall chimney
      LC.gableRoof(kit, wm, { y: UY + UH / 2, len: 2.46, span: 1.0, rise: 0.78, color: PALETTE.roofTile, ry: Math.PI / 2 });
      batchPart(P(GEO.box, PALETTE.stoneDark, M(0.5, 2.05, -0.5, { sx: 0.2, sy: 0.7, sz: 0.2 })), wm);
      batchPart(P(GEO.box, PALETTE.stone, M(0.5, 2.42, -0.5, { sx: 0.25, sy: 0.06, sz: 0.25 })), wm);
      LC.chimneySmoke(kit, [[cx + 0.5, 2.5, cz - 0.5]]);
      // the round corner tower and its slate spire
      const tx = -0.72, tz = -0.95, TH = 2.75;
      batchPart(P(GEO.cyl, PALETTE.stone, M(tx, TH / 2, tz, { sx: 0.42, sy: TH, sz: 0.42 })), wm);
      batchPart(P(GEO.cyl, PALETTE.stoneDark, M(tx, TH, tz, { sx: 0.5, sy: 0.1, sz: 0.5 })), wm);
      batchPart(P(GEO.cone, PALETTE.slate, M(tx, TH + 0.55, tz, { sx: 0.55, sy: 1.1, sz: 0.55 })), wm);
      roofCourses(wm, { x: tx, y: TH + 0.03, z: tz, r: 0.55, h: 1.1, color: PALETTE.slate, kind: 'cone', rings: 4 });
      towerCourses(wm, { x: tx, z: tz, r: 0.42, y0: 1.55, y1: TH - 0.05, seed: 9, holes: [[0.4, 2.2, 0.36]] });
      batchPart(P(GEO.sphereLo, PALETTE.gold, M(tx, TH + 1.15, tz, { s: 0.05 })), wm);
      const pole = new THREE.Mesh(GEO.cyl, toon(PALETTE.wood));
      pole.position.set(cx + tx, TH + 1.45, cz + tz); pole.scale.set(0.03, 0.7, 0.03);
      scene.add(pole);
      LC.banner(kit, cx + tx, TH + 1.6, cz + tz, { w: 0.7, h: 0.42, field: PALETTE.tunic, stripe: PALETTE.gold, emblem: PALETTE.heraldWhite, stateRef: st });
      // the arched oak door, iron studs, steps down to the road
      batchPart(P(GEO.box, 0x2b211b, M(gx, 0.36, gz, { sx: 0.5, sy: 0.72, sz: 0.06 }), false), wm);
      batchPart(P(GEO.cyl, 0x2b211b, M(gx, 0.72, gz, { sx: 0.25, sy: 0.06, sz: 0.25, rx: Math.PI / 2 }), false), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(gx, 0.34, gz + 0.02, { sx: 0.42, sy: 0.64, sz: 0.04 }), false), wm);
      for (const y of [0.2, 0.48]) batchPart(P(GEO.box, PALETTE.steelDark, M(gx, y, gz + 0.045, { sx: 0.42, sy: 0.04, sz: 0.02 }), false), wm);
      batchPart(P(GEO.box, PALETTE.stoneDark, M(gx, 0.05, gz + 0.2, { sx: 0.8, sy: 0.1, sz: 0.26 })), wm);
      // lanterns either side of the door
      for (const lx of [gx - 0.42, gx + 0.42]) {
        batchPart(P(GEO.box, PALETTE.steelDark, M(lx, 0.64, gz + 0.06, { sx: 0.1, sy: 0.14, sz: 0.1 })), wm);
        batchPart(P(GEO.box, PALETTE.windowWarm, M(lx, 0.64, gz + 0.115, { sx: 0.06, sy: 0.08, sz: 0.01 }), false, { unlit: true }), wm);
        glow(cx + lx, 0.64, cz + gz + 0.15, { w: 0.5, h: 0.5 });
      }
      LC.windows(kit, wm, [cx, cz], [
        [0.35, 0.5, 1.11, 'z'], [-0.35, UY, 1.18, 'z'], [0.4, UY, 1.18, 'z'],
        [0.86, 0.5, 0.3, 'x'], [0.93, UY, -0.5, 'x'], [0.93, UY, 0.55, 'x'], [tx + 0.36, 2.2, tz + 0.2, 'x'],
      ], st);
      // a little herb garden and a bench by the door
      batchPart(P(GEO.box, PALETTE.wood, M(0.45, 0.1, 1.38, { sx: 0.4, sy: 0.04, sz: 0.12 }), false), wm);
      for (const u of [0.3, 0.6]) batchPart(P(GEO.box, PALETTE.wood, M(u, 0.05, 1.38, { sx: 0.03, sy: 0.1, sz: 0.1 }), false), wm);
      LC.damage(kit, {
        stateRef: st,
        cracks: [[cx + 0.3, 0.45, cz + 1.12, 0.22, 0.6, 'z'], [cx - 0.5, UY, cz + 1.19, 0.18, 0.5, 'z'], [cx + 0.94, UY, cz + 0.2, 0.2, 0.5, 'x'], [cx + 0.87, 0.5, cz - 0.6, 0.16, 0.5, 'x']],
        rubble: [[cx - 1.0, cz + 0.4], [cx - 1.05, cz + 0.9], [cx + 1.0, cz + 1.1], [cx + 0.2, cz + 1.35], [cx + 1.05, cz - 0.3]],
        fire: [cx - 0.2, UY + 0.2, cz + 1.12], smoke: [cx, 2.2, cz + 0.2], burst: [cx + gx, 0.6, cz + 1.3],
      });
    }
    const lerpPath = () => kit.lerpColor(PALETTE.path, PALETTE.meadow, 0.35).getHex();

    // A patchwork of ploughed fields between the hedges: furrowed strips laid
    // flat on open cells far from the road.
    function buildFields() {
      const rng = srand(77);
      const spots = [[1, 9], [2, 10], [7, 0], [8, 0], [13, 9], [13, 10]];
      for (const [c, r] of spots) {
        if (!GameState.inGrid(c, r) || GameState.cellKind(c, r) !== 'ground' || GameState.isBuildable(c, r)) continue;
        const x = worldX(c), z = worldZ(r);
        batchPart(P(GEO.box, kit.lerpColor(PALETTE.earth, PALETTE.straw, 0.35).getHex(), M(x, 0.004, z, { sx: 0.92, sy: 0.008, sz: 0.92 }), false));
        for (let i = 0; i < 5; i++) batchPart(P(GEO.box, i % 2 ? PALETTE.straw : PALETTE.meadowLight, M(x, 0.02, z - 0.36 + i * 0.18, { sx: 0.86, sy: 0.04, sz: 0.07 }), false));
      }
    }

    LC.stream(kit, {});
    buildBridge();
    buildMill();
    buildManor();
    buildFields();
    LC.knaveCamps(kit);
    const endC = level.endpoint.cells.map(([c]) => c), endR = level.endpoint.cells.map(([, r]) => r);
    LC.countryside(kit, {
      seed: 2026,
      mix: [[20, 'tree'], [10, 'bush'], [12, 'tuft'], [10, 'flower'], [6, 'hay'], [6, 'fence'], [7, 'cottage'], [5, 'rock'], [3, 'barrel'], [2, 'cart'], [1, 'well'], [18, null]],
      edge: [[60, 'tree'], [8, 'bush'], [8, 'cottage'], [4, 'hay'], [20, null]],
      keepLow: (c, r) => c >= Math.min(...endC) - 2 && r >= Math.min(...endR) - 2,
    });
  }

  return {
    id: 'hollybrook',
    index: 1,
    name: 'Hollybrook Manor',
    subtitle: 'The knaves are over the border. Hold the manor.',
    // overworld node: position in the world map's 800x320 viewBox, and how
    // much of the Baron's occupation a win here pushes back
    map: { x: 196, y: 226, reclaim: 105, icon: 'manor' },
    grid: { cols: 18, rows: 11 },
    spawn: [0, 2],
    pathWaypoints: [[0, 2], [3, 2], [3, 7], [6, 7], [6, 3], [9, 3], [9, 6], [12, 6], [12, 2], [15, 2], [15, 9], [16, 9]],
    chokepoint: { cell: [10, 6], streamCol: 10 },
    endpoint: {
      name: 'Hollybrook Manor', properName: 'Hollybrook Manor',
      cells: [[16, 6], [17, 6], [16, 7], [17, 7], [16, 8], [17, 8]], gateCell: [16, 8],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [0.4, 2.2], radiusOut: { x: 4.4, z: 3.6 }, radiusIn: 1.18, falloffWidth: 0.42, motes: { embers: 18 } },
    spawnBlockedText: "That's the Baron's camp. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 150, startLives: 20, starThresholds: [16, 8],
    tipTile: [4, 6],
    endScreenText: {
      3: () => 'Twelve waves turned back and not a roof tile lost. Hollybrook rings its bells for you.',
      2: (s) => `Twelve waves turned back with ${s.lives} lives to spare. The thatchers have some work to do.`,
      1: (s) => `Twelve waves turned back with ${s.lives} lives left. The manor holds, just.`,
      lose: (s) => `The knaves broke through on wave ${s.wave}. Build where the road doubles back, and remember only the Court Magus and Longbowmen reach flyers.`,
    },
    buildScene,
  };
})();
