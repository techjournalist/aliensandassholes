// ===================================================================
// LEVEL 1 — Greenhope Homestead
// The first pods come down at dawn on the colony's oldest farm. One long
// lane snakes through the moonwheat, crosses the irrigation canal on a
// little footbridge and doubles back twice before it reaches the
// homestead's crop dome. The Drill Tank closes the day.
// ===================================================================
const LEVEL_1 = (() => {
  // route/at are optional: which road the group takes, and an absolute start
  // time for groups that come at once (see GameState.startWave)
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  // The twelve waves. Each group spawns after `delay` seconds, one enemy
  // every `gap` seconds. Flavor lines teach the new threat in-world.
  const waves = [
    { name: 'First Contact',     flavor: 'A handful of blob drones wobbling up the farm lane. They look friendly. They are not.', groups: [g('grunt', 5, 3.4)] },
    { name: 'The Blob Parade',   flavor: 'More blobs. They come in bunches.',                                         groups: [g('grunt', 8, 1.4)] },
    { name: 'Skitter Season',    flavor: 'Skitter crawlers: fast, flimsy and very rude. Laser Turrets love them.',   groups: [g('grunt', 5, 1.2), g('trickster', 7, 0.65, 2)] },
    { name: 'Big Shell',         flavor: 'An armored brute. Small hits just bounce off. Hit it hard.',               groups: [g('grunt', 8, 1.0), g('troll', 1, 1, 3)] },
    { name: 'Lights in the Sky', flavor: 'Saucer scouts! Only the Cryo Beam and the Missile Pod can reach them.',    groups: [g('bat', 5, 1.2), g('grunt', 8, 0.9, 2)] },
    { name: 'Crawler Rush',      flavor: 'A flood of crawlers, with brutes stomping behind.',                         groups: [g('trickster', 12, 0.5), g('troll', 2, 3, 3)] },
    { name: 'Mixed Company',     flavor: 'Blobs on the lane, saucers overhead. Cover both.',                          groups: [g('grunt', 14, 0.7), g('bat', 7, 0.85, 1)] },
    { name: 'Shell Column',      flavor: 'Five brutes. Sticky goo and heavy fists win this one.',                     groups: [g('troll', 5, 2.2), g('trickster', 10, 0.5, 4)] },
    { name: 'Saucer Swarm',      flavor: 'A whole flight of saucers. The farm sirens are wailing.',                   groups: [g('bat', 13, 0.55), g('grunt', 14, 0.6, 1)] },
    { name: 'The Push',          flavor: 'Everything at once. Hold the canal bridge.',                                groups: [g('troll', 7, 1.7), g('grunt', 18, 0.45, 1), g('bat', 9, 0.7, 3)] },
    { name: 'Last Light',        flavor: 'The pods empty everything they have onto the lane.',                         groups: [g('trickster', 22, 0.36), g('troll', 6, 1.8, 2), g('bat', 11, 0.6, 2)] },
    { name: 'The Drill Tank',    flavor: 'The aliens roll out a Drill Tank. Every tower can hit it. Stop it before the dome.', groups: [g('bat', 7, 0.85), g('grunt', 12, 0.65, 1), g('troll', 2, 2.5, 2), g('drilltank', 1, 1, 4)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, toon, srand, scene, animated, puff, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;

    // The canal footbridge: a white truss deck with handrails and running
    // lights, a pump station humming on the far bank.
    function buildBridge() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      batchPart(P(GEO.box, PALETTE.hullDark, M(0, 0.0, 0, { sx: 1.16, sy: 0.08, sz: 0.84 })), wm);
      for (let i = 0; i < 6; i++) batchPart(P(GEO.box, i % 2 ? PALETTE.cobble : PALETTE.cobbleDark, M(-0.45 + i * 0.18, 0.045, 0, { sx: 0.16, sy: 0.01, sz: 0.8 }), false), wm);
      for (const side of [-1, 1]) {
        batchPart(P(GEO.box, PALETTE.plaster, M(0, 0.2, side * 0.42, { sx: 1.16, sy: 0.03, sz: 0.03 })), wm);
        for (let i = 0; i < 4; i++) {
          const u = -0.54 + i * 0.36;
          batchPart(P(GEO.box, PALETTE.plaster, M(u, 0.1, side * 0.42, { sx: 0.035, sy: 0.2, sz: 0.035 }), false), wm);
          batchPart(P(GEO.bead, PALETTE.neon, M(u, 0.23, side * 0.42, { s: 0.022 }), false, { unlit: true }), wm);
        }
        // the truss: diagonal struts under the deck
        for (let i = 0; i < 3; i++) batchPart(P(GEO.box, PALETTE.steelDark, M(-0.36 + i * 0.36, -0.1, side * 0.4, { sx: 0.4, sy: 0.02, sz: 0.02, rz: i % 2 ? 0.4 : -0.4 }), false), wm);
      }
    }
    function buildPumpHouse() {
      const sx = worldX(level.chokepoint.streamCol), z = worldZ(1.5);
      const wm = M(sx + 1.0, 0, z);
      batchPart(P(GEO.box, PALETTE.plaster, M(0, 0.25, 0, { sx: 0.7, sy: 0.5, sz: 0.55 })), wm);
      batchPart(P(GEO.box, PALETTE.tunic, M(0, 0.52, 0, { sx: 0.74, sy: 0.06, sz: 0.6 })), wm);
      batchPart(P(GEO.box, PALETTE.windowWarm, M(-0.15, 0.3, 0.28, { sx: 0.14, sy: 0.12, sz: 0.01 }), false, { unlit: true }), wm);
      batchPart(P(GEO.cyl, PALETTE.steelDark, M(-0.55, 0.12, 0, { sx: 0.06, sy: 0.4, sz: 0.06, rz: Math.PI / 2 }), false), wm);
      batchDecal(sx + 1.0, z, 0.45);
      // the pump's flywheel, turning
      const wheel = liveProp([P(GEO.torus, PALETTE.steel, M(0, 0, 0, { s: 0.16 })), P(GEO.cyl, PALETTE.hazard, M(0, 0, 0, { sx: 0.05, sy: 0.08, sz: 0.05, rx: Math.PI / 2 })),
        ...[0, 1, 2].map((i) => P(GEO.box, PALETTE.steelDark, M(0, 0, 0, { sx: 0.3, sy: 0.025, sz: 0.025, rz: i * 1.05 }), false))], sx + 1.0, 0.62, z);
      animated.push({ update(t) { wheel.rotation.z = -t * 2; } });
    }

    // Greenhope Homestead: a big glass crop dome over rows of moonwheat, the
    // farmhouse hab in front of it with the airlock facing the lane, a
    // terraformer stack with turning fans, solar panels and the colony flag.
    function buildHomestead() {
      const [cx, cz] = LC.endpointCenter(kit);
      const wm = M(cx, 0, cz);
      const st = { state: 0 };
      const gx = worldX(level.endpoint.gateCell[0]) - cx, gz = 1.08;
      batchPart(P(GEO.circle, kit.lerpColor(PALETTE.cobble, PALETTE.meadow, 0.3).getHex(), M(0, 0.008, 0.1, { sx: 1.3, sz: 1.7 }), false), wm);
      // the crop dome at the back, crops inside
      LC.cropRows(kit, wm, { x: 0.15, z: -0.55, w: 1.1, d: 0.9, rows: 4 });
      LC.glassDome(kit, cx + 0.15, 0.02, cz - 0.55, 0.78, { h: 0.66, ribs: 5 });
      // the farmhouse hab: a long white module with a teal roof band
      batchPart(P(GEO.box, PALETTE.plaster, M(gx + 0.15, 0.32, 0.62, { sx: 1.2, sy: 0.64, sz: 0.85 })), wm);
      batchPart(P(GEO.box, PALETTE.hullDark, M(gx + 0.15, 0.05, 0.62, { sx: 1.26, sy: 0.1, sz: 0.9 })), wm);
      batchPart(P(GEO.cyl, PALETTE.thatch, M(gx + 0.15, 0.66, 0.62, { sx: 0.44, sy: 1.22, sz: 0.44, rz: Math.PI / 2 })), wm);
      batchPart(P(GEO.box, PALETTE.plaster, M(gx + 0.15, 0.62, 0.62, { sx: 1.22, sy: 0.1, sz: 0.88 }), false), wm);
      for (const u of [-0.3, 0, 0.3]) batchPart(P(GEO.ring, PALETTE.slate, M(gx + 0.15 + u, 0.66, 0.62, { s: 0.445, ry: Math.PI / 2 }), false), wm);
      batchPart(P(GEO.box, PALETTE.tunic, M(gx + 0.15, 0.48, 1.05, { sx: 1.2, sy: 0.05, sz: 0.01 }), false), wm);
      LC.airlock(kit, wm, [cx, cz], gx, gz, { w: 0.4, h: 0.5 });
      LC.windows(kit, wm, [cx, cz], [[gx + 0.48, 0.34, 1.05, 'z'], [0.76, 0.34, 0.62, 'x']], st);
      // the terraformer stack beside the dome
      LC.terraformerTower(kit, cx - 0.62, cz - 0.95, { h: 2.1, r: 0.22, stateRef: st });
      // solar panels and the flag
      for (const [dx, dz] of [[0.95, -0.9], [0.95, -0.35]]) for (const p of LC.solarParts(kit, srand(dx * 10 + dz)).parts) batchPart(p, M(cx + dx, 0, cz + dz));
      const pole = new THREE.Mesh(GEO.cyl, toon(PALETTE.steel));
      pole.position.set(cx + 0.7, 1.0, cz + 0.35); pole.scale.set(0.025, 2.0, 0.025);
      scene.add(pole);
      LC.banner(kit, cx + 0.7, 1.82, cz + 0.35, { w: 0.62, h: 0.38, field: PALETTE.tunic, stripe: PALETTE.plaster, emblem: PALETTE.flowerYellow, stateRef: st });
      LC.damage(kit, {
        stateRef: st,
        cracks: [[cx + gx - 0.2, 0.36, cz + 1.06, 0.2, 0.5, 'z'], [cx + gx + 0.5, 0.42, cz + 1.06, 0.16, 0.4, 'z'], [cx + 0.77, 0.3, cz + 0.4, 0.2, 0.4, 'x']],
        rubble: [[cx - 0.9, cz + 0.6], [cx - 0.95, cz + 1.0], [cx + 0.9, cz + 1.1], [cx + 0.25, cz + 1.35], [cx + 1.0, cz + 0.1]],
        fire: [cx + gx + 0.3, 0.75, cz + 0.8], smoke: [cx, 1.6, cz - 0.4], burst: [cx + gx, 0.6, cz + 1.3],
        onState: (s) => { if (s >= 2) puff(cx + 0.15, 0.7, cz - 0.55, { count: 18, color: PALETTE.glass, speed: 1.6, size: 0.08, up: 1.4, ttl: 0.9 }); },
      });
    }

    // the homestead's fields: strips of moonwheat and leafy greens laid flat
    // on open ground far from the lane
    function buildFields() {
      const spots = [[1, 8], [2, 9], [9, 6], [16, 0], [17, 1], [0, 0]];
      for (const [c, r] of spots) {
        if (!GameState.inGrid(c, r) || GameState.cellKind(c, r) !== 'ground' || GameState.isBuildable(c, r)) continue;
        LC.cropRows(kit, null, { x: worldX(c), z: worldZ(r), w: 0.9, d: 0.9, rows: 4 });
      }
    }

    LC.stream(kit, {});
    buildBridge();
    buildPumpHouse();
    buildHomestead();
    buildFields();
    LC.alienPods(kit);
    const endC = level.endpoint.cells.map(([c]) => c), endR = level.endpoint.cells.map(([, r]) => r);
    LC.countryside(kit, {
      seed: 2026,
      mix: [[18, 'tree'], [9, 'bush'], [12, 'tuft'], [10, 'flower'], [6, 'hay'], [5, 'fence'], [5, 'cottage'], [4, 'rock'], [3, 'barrel'], [3, 'cart'], [2, 'silo'], [3, 'greenhouse'], [3, 'solar'], [3, 'crater'], [3, 'mushroom'], [14, null]],
      edge: [[50, 'tree'], [8, 'bush'], [6, 'cottage'], [4, 'silo'], [6, 'crystal'], [4, 'rock'], [4, 'mushroom'], [18, null]],
      keepLow: (c, r) => c >= Math.min(...endC) - 2 && r >= Math.min(...endR) - 2,
    });
  }

  return {
    id: 'greenhope',
    index: 1,
    name: 'Greenhope Homestead',
    subtitle: 'The first pods have landed. Save the farm.',
    // overworld node: position in the world map's 800x320 viewBox, and how
    // much of the goo a win here clears
    map: { x: 700, y: 236, reclaim: 110, icon: 'homestead' },
    grid: { cols: 18, rows: 11 },
    spawn: [0, 4],
    pathWaypoints: [[0, 4], [3, 4], [3, 1], [7, 1], [7, 6], [5, 6], [5, 9], [12, 9], [12, 3], [14, 3], [14, 9], [15, 9]],
    chokepoint: { cell: [10, 9], streamCol: 10 },
    endpoint: {
      name: 'the homestead', properName: 'Greenhope Homestead',
      cells: [[15, 6], [16, 6], [15, 7], [16, 7], [15, 8], [16, 8]], gateCell: [15, 8],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [0.4, 4.2], radiusOut: { x: 4.2, z: 3.8 }, radiusIn: 1.18, falloffWidth: 0.42, motes: { embers: 18, fireflies: 22 } },
    spawnBlockedText: "That's the landing pod. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 150, startLives: 20, starThresholds: [16, 8],
    tipTile: [4, 5],
    endScreenText: {
      3: () => 'Twelve waves turned back and not a pane of glass cracked. Greenhope rings its dinner bell for you.',
      2: (s) => `Twelve waves turned back with ${s.lives} lives to spare. The dome needs a little tape.`,
      1: (s) => `Twelve waves turned back with ${s.lives} lives left. The homestead holds, just.`,
      lose: (s) => `The invaders broke through on wave ${s.wave}. Build where the lane doubles back, and remember only the Cryo Beam and the Missile Pod reach flyers.`,
    },
    buildScene,
  };
})();
