// ===================================================================
// LEVEL 9 — The Blackmoor Lines
// The King's host has dug in on the edge of Blackmoor itself. The Baron
// throws everything at the siege camp from six gates at once: five roads
// from the west, north and south join before the ditch bridge, and a
// sixth slips round behind the camp from the south-east and never
// crosses the ditch at all.
// ===================================================================
const LEVEL_9 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: 'First Sortie',          flavor: 'Brigands march up the west road. The other gates are still shut.',          groups: [g('grunt', 5, 3.2, 0, 'west')] },
    { name: 'A Second Gate',         flavor: 'The north-west gate opens. Watch the horn posts.',                          groups: [g('grunt', 4, 2.3, 0, 'west', 0), g('grunt', 3, 2.6, 0, 'northwest', 4)] },
    { name: 'Quick Hands',           flavor: 'Cutpurses dash up the south-west road.',                                    groups: [g('grunt', 4, 1.6, 0, 'west', 0), g('trickster', 5, 0.9, 0, 'southwest', 3)] },
    { name: 'The North Gate',        flavor: 'A Black Knight comes down from the north.',                                 groups: [g('grunt', 4, 1.5, 0, 'west', 0), g('troll', 1, 1, 0, 'north', 6), g('grunt', 3, 1.6, 0, 'farsouth', 3)] },
    { name: 'Gargoyles over the Moor', flavor: 'Gargoyles from the far south. The Magus and the Longbowmen only.',          groups: [g('bat', 2, 1.5, 0, 'farsouth', 0), g('grunt', 6, 1.1, 0, 'northwest', 3)] },
    { name: 'Five Gates',            flavor: 'Every western gate at once. The junction before the ditch is the key.',     groups: [g('grunt', 3, 1.2, 0, 'northwest', 0), g('grunt', 3, 1.2, 0, 'north', 1), g('grunt', 3, 1.2, 0, 'west', 0), g('grunt', 3, 1.2, 0, 'southwest', 1), g('grunt', 3, 1.2, 0, 'farsouth', 0)] },
    { name: 'Round the Back',        flavor: 'A sixth gate in the south-east. They reach the camp without crossing the ditch.', groups: [g('grunt', 3, 1.8, 0, 'flank', 0), g('trickster', 5, 0.8, 0, 'west', 2), g('troll', 1, 1, 0, 'north', 4)] },
    { name: 'Night Raid',            flavor: 'Gargoyles from the south, a rush from the north-west, brigands round the back.', groups: [g('bat', 3, 1.0, 0, 'farsouth', 0), g('trickster', 7, 0.6, 0, 'northwest', 1), g('grunt', 3, 1.4, 0, 'flank', 3)] },
    { name: 'Every Gate in Turn',    flavor: 'The Baron leans on each road in turn.',                                     groups: [g('troll', 2, 2.4, 0, 'west', 0), g('grunt', 6, 0.9, 0, 'north', 1), g('trickster', 5, 0.65, 0, 'southwest', 2), g('bat', 2, 1.2, 0, 'farsouth', 6)] },
    { name: 'Pincer and Flank',      flavor: 'Knights on two roads, brigands round the back, gargoyles from the south.',  groups: [g('troll', 2, 2.3, 0, 'northwest', 0), g('troll', 2, 2.3, 0, 'southwest', 1), g('bat', 3, 1.0, 0, 'farsouth', 3), g('grunt', 4, 1.1, 0, 'flank', 4)] },
    { name: 'Six Gates at Once',     flavor: 'All six gates open together. The camp shakes.',                             groups: [g('grunt', 7, 0.9, 0, 'west', 0), g('trickster', 7, 0.6, 0, 'northwest', 0), g('troll', 2, 2.0, 0, 'north', 0), g('grunt', 5, 1.0, 0, 'southwest', 0), g('bat', 4, 1.0, 0, 'farsouth', 6), g('grunt', 4, 1.2, 0, 'flank', 0)] },
    { name: 'The Long Night',        flavor: 'A column of knights, a rush of cutpurses, gargoyles and a flank, all at once.', groups: [g('troll', 3, 2.1, 0, 'west', 0), g('trickster', 12, 0.45, 0, 'northwest', 0), g('bat', 6, 0.7, 0, 'farsouth', 0), g('grunt', 5, 1.1, 0, 'flank', 0)] },
    { name: 'The Warlock',           flavor: 'The Baron’s warlock rides a storm of bats. It flies: only the Magus and the Longbowmen reach it.', groups: [g('bat', 4, 1.0, 0, 'farsouth', 0), g('grunt', 5, 0.9, 0, 'north', 1), g('warlock', 1, 1, 0, 'northwest', 8), g('grunt', 4, 0.9, 0, 'flank', 2)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, toon, srand, scene, animated, puff,
      roofCourses, glow, worldX, worldZ, level, rows, shakeCamera } = kit;
    const LC = LevelCommon;
    const tentGeo = new THREE.ConeGeometry(1, 1, 10).toNonIndexed();

    // a round royal pavilion: a drum of cloth in two colors, a conical roof,
    // a scalloped valance and a gilt finial with a pennant
    function pavilionParts(r, col, { door = 0, h = 0.5 } = {}) {
      const parts = [P(GEO.cyl, PALETTE.heraldWhite, M(0, h / 2, 0, { sx: r, sy: h, sz: r }))];
      for (let i = 0; i < 10; i += 2) { const a = i / 10 * Math.PI * 2 + 0.3; parts.push(P(GEO.box, col, M(Math.cos(a) * r * 1.01, h / 2, Math.sin(a) * r * 1.01, { sx: r * 0.62, sy: h, sz: 0.012, ry: -a + Math.PI / 2 }), false)); }
      parts.push(P(tentGeo, col, M(0, h + r * 0.55, 0, { sx: r * 1.12, sy: r * 1.1, sz: r * 1.12 })));
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; parts.push(P(GEO.bead, i % 2 ? PALETTE.gold : col, M(Math.cos(a) * r * 1.1, h + 0.02, Math.sin(a) * r * 1.1, { sx: 0.05, sy: 0.04, sz: 0.05 }), false)); }
      parts.push(P(GEO.sphereLo, PALETTE.gold, M(0, h + r * 1.12, 0, { s: 0.045 }), false));
      if (door !== null) parts.push(P(GEO.box, 0x2b211b, M(Math.sin(door) * r * 1.01, h * 0.38, Math.cos(door) * r * 1.01, { sx: r * 0.5, sy: h * 0.76, sz: 0.012, ry: door }), false));
      return parts;
    }
    // a gabion: a wicker basket of earth, the siege lines' sandbag
    function gabionParts(rng) {
      const parts = [];
      for (let i = 0; i < 3; i++) parts.push(P(GEO.cyl, PALETTE.straw, M((i - 1) * 0.2, 0.13, (rng() - 0.5) * 0.08, { sx: 0.09, sy: 0.26, sz: 0.09 })), P(GEO.cyl, PALETTE.earth, M((i - 1) * 0.2, 0.265, 0, { sx: 0.08, sy: 0.02, sz: 0.08 }), false));
      return { parts, radius: 0.22 };
    }
    kit.extraRecipes = (rng) => ({ gabion: () => gabionParts(rng) });

    // The ditch bridge: a plank bridge over the flooded ditch, a timber
    // gate tower each side flying the King's pennants, and a sharpened
    // palisade along the camp bank everywhere but the crossing.
    function buildDitch() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      batchPart(P(GEO.box, PALETTE.wood, M(0, 0.0, 0, { sx: 1.1, sy: 0.07, sz: 0.8 })), wm);
      for (let i = 0; i < 6; i++) batchPart(P(GEO.box, PALETTE.woodLight, M(-0.45 + i * 0.18, 0.04, 0, { sx: 0.15, sy: 0.015, sz: 0.78 }), false), wm);
      for (const s of [-1, 1]) {
        const tx = 0.66, tz = s * 0.55;
        for (const [ox, oz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) batchPart(P(GEO.box, PALETTE.wood, M(tx + ox, 0.5, tz + oz, { sx: 0.05, sy: 1.0, sz: 0.05 })), wm);
        batchPart(P(GEO.box, PALETTE.woodLight, M(tx, 1.0, tz, { sx: 0.44, sy: 0.06, sz: 0.44 })), wm);
        for (const [ox, oz, w, d] of [[0, -0.2, 0.44, 0.04], [0, 0.2, 0.44, 0.04], [-0.2, 0, 0.04, 0.44], [0.2, 0, 0.04, 0.44]]) batchPart(P(GEO.box, PALETTE.wood, M(tx + ox, 1.12, tz + oz, { sx: w, sy: 0.18, sz: d }), false), wm);
        batchPart(P(GEO.box, PALETTE.wood, M(tx, 0.5, tz, { sx: 0.32, sy: 0.04, sz: 0.32, rx: 0.8 }), false), wm);
        batchPart(P(GEO.cyl, PALETTE.wood, M(tx, 1.45, tz, { sx: 0.015, sy: 0.6, sz: 0.015 }), false), wm);
        LC.banner(kit, x + tx, 1.6, z + tz, { w: 0.34, h: 0.2, field: PALETTE.tunic, stripe: PALETTE.gold, emblem: PALETTE.heraldWhite, phase: s });
      }
      // palisade on the camp bank
      for (let r = -1; r < rows + 1; r++) {
        if (Math.abs(r - br) <= 1) continue;
        for (let k = 0; k < 3; k++) {
          const pz = worldZ(r) - 0.33 + k * 0.33, px = worldX(bc) + 0.58;
          batchPart(P(GEO.cyl, PALETTE.wood, M(px, 0.2, pz, { sx: 0.045, sy: 0.4, sz: 0.045, rz: -0.25 })));
          batchPart(P(GEO.cone, PALETTE.woodLight, M(px + 0.055, 0.44, pz, { sx: 0.045, sy: 0.1, sz: 0.045, rz: -0.25 }), false));
        }
      }
    }

    // The King's siege camp: the great royal pavilion with the royal
    // standard, smaller tents, a weapons rack, braziers and a map table.
    function buildCamp() {
      const [cx, cz] = LC.endpointCenter(kit);
      const wm = M(cx, 0, cz);
      const st = { state: 0 };
      const gx = worldX(level.endpoint.gateCell[0]) - cx;
      batchPart(P(GEO.box, kit.lerpColor(PALETTE.path, PALETTE.meadow, 0.4).getHex(), M(0, 0.01, 0.2, { sx: 2.4, sy: 0.02, sz: 3.1 }), false), wm);
      for (const p of pavilionParts(0.62, PALETTE.tunic, { door: 0, h: 0.7 })) batchPart(p, M(cx + gx, 0, cz + 0.32));
      for (const p of pavilionParts(0.34, PALETTE.capRed, { door: 0.5 })) batchPart(p, M(cx + gx + 0.95, 0, cz - 0.75));
      for (const p of pavilionParts(0.3, PALETTE.gold, { door: -0.5 })) batchPart(p, M(cx + gx - 0.55, 0, cz - 1.15));
      batchDecal(cx + gx, cz + 0.32, 0.7); batchDecal(cx + gx + 0.95, cz - 0.75, 0.4);
      // the royal standard
      const sx = gx + 0.85, sz = 0.85;
      batchPart(P(GEO.cyl, PALETTE.wood, M(sx, 1.4, sz, { sx: 0.035, sy: 2.8, sz: 0.035 })), wm);
      batchPart(P(GEO.cone, PALETTE.gold, M(sx, 2.86, sz, { sx: 0.05, sy: 0.14, sz: 0.05 })), wm);
      LC.banner(kit, cx + sx, 2.45, cz + sz, { w: 0.9, h: 0.52, field: PALETTE.tunic, stripe: PALETTE.gold, emblem: PALETTE.capRed, stateRef: st });
      // a weapons rack, a map table and two braziers by the door
      batchPart(P(GEO.box, PALETTE.wood, M(gx - 0.85, 0.25, 0.75, { sx: 0.04, sy: 0.04, sz: 0.4 }), false), wm);
      for (let i = 0; i < 4; i++) batchPart(P(GEO.cyl, PALETTE.woodLight, M(gx - 0.83, 0.34, 0.6 + i * 0.1, { sx: 0.01, sy: 0.66, sz: 0.01, rz: 0.15 }), false), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(gx - 0.7, 0.2, -0.15, { sx: 0.36, sy: 0.04, sz: 0.26 })), wm);
      batchPart(P(GEO.box, PALETTE.canvas, M(gx - 0.7, 0.225, -0.15, { sx: 0.3, sy: 0.01, sz: 0.2 }), false), wm);
      for (const bx of [gx - 0.45, gx + 0.45]) {
        const bz = 1.0;
        batchPart(P(GEO.cyl, PALETTE.steelDark, M(bx, 0.18, bz, { sx: 0.03, sy: 0.36, sz: 0.03 }), false), wm);
        batchPart(P(GEO.cylTaper, PALETTE.steelDark, M(bx, 0.4, bz, { sx: 0.1, sy: 0.1, sz: 0.1, rx: Math.PI }), false), wm);
        const f = new THREE.Mesh(GEO.cone, new THREE.MeshBasicMaterial({ color: PALETTE.ember }));
        f.position.set(cx + bx, 0.52, cz + bz); f.scale.set(0.07, 0.15, 0.07);
        scene.add(f);
        glow(cx + bx, 0.55, cz + bz, { w: 0.6, h: 0.6 });
        animated.push({ update(t) { const k = 0.8 + 0.2 * Math.sin(t * 13 + bx * 7); f.scale.set(0.07 * (2 - k), 0.15 * k, 0.07 * (2 - k)); } });
      }
      LC.damage(kit, {
        stateRef: st,
        cracks: [],
        rubble: [[cx + gx - 1.0, cz + 1.2], [cx + gx + 1.0, cz + 0.2], [cx + gx - 0.9, cz - 0.6]],
        fire: [cx + gx + 0.95, 0.75, cz - 0.75], smoke: [cx + gx, 1.3, cz + 0.3], burst: [cx + gx, 0.6, cz + 1.0],
      });
    }

    // The trebuchet beside the camp: every few seconds its counterweight
    // drops, the long arm whips over and a stone flies off toward Blackmoor.
    function buildTrebuchet(c, r) {
      const x = worldX(c), z = worldZ(r);
      const wm = M(x, 0, z);
      batchPart(P(GEO.box, PALETTE.wood, M(0, 0.06, 0, { sx: 1.0, sy: 0.08, sz: 0.5 })), wm);
      for (const s of [-1, 1]) {
        batchPart(P(GEO.box, PALETTE.wood, M(0, 0.6, s * 0.2, { sx: 0.06, sy: 1.1, sz: 0.06, rz: 0.25 })), wm);
        batchPart(P(GEO.box, PALETTE.wood, M(0, 0.6, s * 0.2, { sx: 0.06, sy: 1.1, sz: 0.06, rz: -0.25 })), wm);
      }
      batchPart(P(GEO.cyl, PALETTE.steelDark, M(0, 1.12, 0, { sx: 0.04, sy: 0.5, sz: 0.04, rx: Math.PI / 2 }), false), wm);
      batchDecal(x, z, 0.6);
      // the arm pivots on the axle: long end to +x, the weight box on the short end
      const arm = liveProp([
        P(GEO.box, PALETTE.woodLight, M(0.35, 0, 0, { sx: 1.4, sy: 0.06, sz: 0.06 })),
        P(GEO.box, PALETTE.wood, M(-0.38, -0.18, 0, { sx: 0.26, sy: 0.3, sz: 0.3 })),
        P(GEO.box, PALETTE.steelDark, M(-0.38, -0.18, 0.155, { sx: 0.26, sy: 0.04, sz: 0.01 }), false),
        P(GEO.sphereLo, PALETTE.stoneDark, M(1.05, -0.08, 0, { s: 0.07 }), true, { name: 'stone', live: true }),
      ], x, 1.12, z);
      const stone = arm.getObjectByName('stone');
      let clock = 0;
      animated.push({ update(t, dt) {
        clock = (clock + dt) % 7;
        // rest cocked (long arm down), then a fast throw, then a slow winch back
        let ang;
        if (clock < 4.5) ang = 0.55;
        else if (clock < 4.85) { const k = (clock - 4.5) / 0.35; ang = 0.55 - k * k * 2.3; }
        else ang = -1.75 + Math.min(1, (clock - 4.85) / 2.15) * 2.3;
        arm.rotation.z = ang;
        stone.visible = clock < 4.8 || clock > 5.6;
        if (clock > 4.8 && clock - dt <= 4.8) puff(x - 1.0, 2.2, z, { count: 3, color: PALETTE.stone, speed: 0.6, size: 0.08, up: 0.6, ttl: 0.6 });
      } });
    }

    LC.stream(kit, { seed: 91, speed: 0.35, shallow: PALETTE.streamBed, deep: PALETTE.hollowEarth, foam: PALETTE.hollowRock });
    buildDitch();
    buildCamp();
    buildTrebuchet(20, 2);
    LC.knaveCamps(kit);
    const endR = level.endpoint.cells.map(([, r]) => r), endC = level.endpoint.cells.map(([c]) => c);
    LC.countryside(kit, {
      seed: 9191,
      mix: [[8, 'tree'], [6, 'bush'], [10, 'tuft'], [8, 'rock'], [8, 'gabion'], [4, 'fence'], [5, 'barrel'], [3, 'cart'], [36, null]],
      edge: [[30, 'tree'], [14, 'rock'], [8, 'gabion'], [48, null]],
      keepLow: (c, r) => c >= Math.min(...endC) - 1 && c <= Math.max(...endC) + 1 && r <= Math.max(...endR) + 1,
    });
  }

  // five western roads join on row 7 and cross the ditch at (14,7) to the
  // camp gate; the flank comes up behind and ends on the same last cell
  const tail = [[12, 7], [17, 7]];
  return {
    id: 'blackmoor-lines',
    index: 9,
    name: 'The Blackmoor Lines',
    subtitle: 'The siege camp at the edge of Blackmoor. Six gates open at once.',
    map: { x: 92, y: 192, reclaim: 95, icon: 'siegecamp' },
    grid: { cols: 22, rows: 14 },
    spawn: [0, 7],
    routes: [
      { id: 'west',      waypoints: [[0, 7], [3, 7], [3, 9], [6, 9], [6, 7], [9, 7], ...tail] },
      { id: 'northwest', waypoints: [[0, 2], [4, 2], [4, 4], [8, 4], [8, 5], [10, 5], [10, 7], ...tail] },
      { id: 'north',     waypoints: [[11, 0], [11, 2], [12, 2], [12, 7], [17, 7]] },
      { id: 'southwest', waypoints: [[0, 13], [4, 13], [4, 11], [8, 11], [8, 9], [10, 9], [10, 7], ...tail] },
      { id: 'farsouth',  waypoints: [[11, 13], [11, 11], [13, 11], [13, 9], [12, 9], [12, 7], [17, 7]] },
      { id: 'flank',     waypoints: [[21, 13], [21, 11], [19, 11], [19, 9], [17, 9], [17, 7]] },
    ],
    chokepoint: { cell: [14, 7], streamCol: 14 },
    endpoint: {
      name: 'the King’s siege camp', properName: 'The King’s Camp',
      cells: [[17, 4], [18, 4], [17, 5], [18, 5], [17, 6], [18, 6]], gateCell: [17, 6],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [0, 7], radiusOut: { x: 13, z: 11 }, radiusIn: 1.0, falloffWidth: 0.5, motes: { embers: 40, dust: 12 },
      foothold: { center: [17.5, 5], radius: 3.5, falloffWidth: 2 },
      backdrop: 0x2e2a2a, groundMeadow: 0x7c9a4c, groundMeadowDark: 0x66833e, ambient: 0.34 },
    spawnBlockedText: "That's the Baron's gate. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 240, startLives: 20, starThresholds: [16, 8],
    tipTile: [2, 6],
    endScreenText: {
      3: () => 'Thirteen waves from six gates, the warlock blown away, and not a tent was touched. Blackmoor is next.',
      2: (s) => `The warlock is gone and the lines hold, with ${s.lives} lives to spare. On to the Black Keep.`,
      1: (s) => `The camp is battered, but the King's standard still flies, with ${s.lives} lives left.`,
      lose: (s) => `The siege camp fell on wave ${s.wave}. Five roads join before the ditch, so build there; the sixth comes round the back. Save gold for the warlock.`,
    },
    buildScene,
  };
})();
