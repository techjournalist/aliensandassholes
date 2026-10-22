// ===================================================================
// LEVEL 10 — The Black Keep
// The last battle. The King has planted his standard in the middle of
// Blackmoor, between the Baron's tower to the west and his war camps to
// the east. Three roads cross the burning fissure from the west, two come
// in from the east, the Baron's household guard comes on, and on the last
// wave the Black Baron rides out himself.
// ===================================================================
const LEVEL_10 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: 'The Gates Open',        flavor: 'Brigands march out of the Black Keep. One road so far.',                    groups: [g('grunt', 5, 3.2, 0, 'westmid')] },
    { name: 'The High Road',         flavor: 'The north-west road opens. Watch the horn posts.',                           groups: [g('grunt', 4, 2.3, 0, 'westmid', 0), g('grunt', 3, 2.6, 0, 'westhigh', 4)] },
    { name: 'Quick Hands',           flavor: 'Cutpurses dash up the low road.',                                            groups: [g('grunt', 4, 1.6, 0, 'westmid', 0), g('trickster', 3, 1.2, 0, 'westlow', 3)] },
    { name: 'From Behind',           flavor: 'The Baron’s camps in the east send their own. They come in behind you.',    groups: [g('grunt', 4, 2.0, 0, 'easthigh', 0), g('grunt', 4, 1.6, 0, 'westmid', 3)] },
    { name: 'Gargoyles in the Smoke', flavor: 'Gargoyles from the east. The Magus and the Longbowmen only.',               groups: [g('bat', 2, 1.5, 0, 'eastlow', 0), g('grunt', 6, 1.1, 0, 'westhigh', 3)] },
    { name: 'Both Fronts',           flavor: 'Every road at once, from both sides of the standard.',                       groups: [g('grunt', 3, 1.3, 0, 'westhigh', 0), g('grunt', 2, 1.3, 0, 'westmid', 0), g('grunt', 3, 1.3, 0, 'westlow', 0), g('grunt', 3, 1.3, 0, 'easthigh', 2), g('grunt', 2, 1.3, 0, 'eastlow', 2)] },
    { name: 'The Knight Crosses',    flavor: 'A Black Knight on the high road, a rush from the south-east.',               groups: [g('troll', 1, 1, 0, 'westhigh', 0), g('trickster', 4, 0.9, 0, 'eastlow', 2), g('grunt', 5, 1.2, 0, 'westmid', 4)] },
    { name: 'Ash and Wings',         flavor: 'Gargoyles in the north-east, Cutpurses from the low road.',                   groups: [g('bat', 4, 1.1, 0, 'easthigh', 0), g('trickster', 7, 0.6, 0, 'westlow', 1), g('grunt', 5, 1.0, 0, 'eastlow', 3)] },
    { name: 'The Standard Between',  flavor: 'The Baron leans on both fronts in turn.',                                    groups: [g('troll', 2, 2.4, 0, 'eastlow', 0), g('grunt', 6, 0.9, 0, 'westmid', 1), g('trickster', 5, 0.65, 0, 'westhigh', 2), g('bat', 3, 1.2, 0, 'easthigh', 6)] },
    { name: 'Pincer',                flavor: 'Knights down the low road and from the north-east, gargoyles over the high road.', groups: [g('troll', 2, 2.4, 0, 'westlow', 0), g('troll', 1, 2.3, 0, 'easthigh', 1), g('bat', 3, 1.2, 0, 'westhigh', 3), g('grunt', 5, 0.9, 0, 'eastlow', 4)] },
    { name: 'Five Gates at Once',    flavor: 'Every gate at once. The ground shakes.',                                     groups: [g('grunt', 8, 0.8, 0, 'westmid', 0), g('trickster', 8, 0.55, 0, 'eastlow', 0), g('troll', 2, 2.0, 0, 'westhigh', 0), g('grunt', 6, 0.9, 0, 'westlow', 0), g('bat', 3, 1.2, 0, 'easthigh', 6)] },
    { name: 'The Long Night',        flavor: 'A column of knights, a rush of cutpurses and gargoyles, all at once.',       groups: [g('troll', 3, 2.1, 0, 'easthigh', 0), g('trickster', 8, 0.55, 0, 'westlow', 0), g('bat', 4, 1.0, 0, 'westhigh', 0), g('grunt', 6, 0.8, 0, 'eastlow', 0)] },
    { name: 'The Black Guard',       flavor: 'The Baron’s own household knights march out, with gargoyles overhead.',       groups: [g('troll', 4, 2.2, 0, 'westhigh', 0), g('bat', 4, 1.0, 0, 'easthigh', 2), g('trickster', 8, 0.5, 0, 'westlow', 4), g('grunt', 8, 0.7, 0, 'eastlow', 6)] },
    { name: 'The Black Baron',       flavor: 'The Baron rides out himself. He is armored head to hoof, but he rides, so every tower can hit him.', groups: [g('grunt', 6, 0.8, 0, 'easthigh', 0), g('trickster', 6, 0.6, 0, 'westlow', 1), g('baron', 1, 1, 0, 'westmid', 5)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, toon, srand, scene, animated, puff,
      masonry, towerCourses, roofCourses, glow, worldX, worldZ, level, rows } = kit;
    const LC = LevelCommon;
    const tentGeo = new THREE.ConeGeometry(1, 1, 10).toNonIndexed();

    // a royal pavilion (see Level 9): striped drum, conical roof, finial
    function pavilionParts(r, col, door, h = 0.5) {
      const parts = [P(GEO.cyl, PALETTE.heraldWhite, M(0, h / 2, 0, { sx: r, sy: h, sz: r }))];
      for (let i = 0; i < 10; i += 2) { const a = i / 10 * Math.PI * 2 + 0.3; parts.push(P(GEO.box, col, M(Math.cos(a) * r * 1.01, h / 2, Math.sin(a) * r * 1.01, { sx: r * 0.62, sy: h, sz: 0.012, ry: -a + Math.PI / 2 }), false)); }
      parts.push(P(tentGeo, col, M(0, h + r * 0.55, 0, { sx: r * 1.12, sy: r * 1.1, sz: r * 1.12 })));
      parts.push(P(GEO.sphereLo, PALETTE.gold, M(0, h + r * 1.12, 0, { s: 0.045 }), false));
      parts.push(P(GEO.box, 0x2b211b, M(Math.sin(door) * r * 1.01, h * 0.38, Math.cos(door) * r * 1.01, { sx: r * 0.5, sy: h * 0.76, sz: 0.012, ry: door }), false));
      return parts;
    }

    // The iron bridge over the burning fissure: a riveted black deck on
    // chains between four squat posts, embers drifting up from below.
    function buildIronBridge() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      batchPart(P(GEO.box, PALETTE.steelDark, M(0, 0.0, 0, { sx: 1.12, sy: 0.08, sz: 0.8 })), wm);
      for (let i = 0; i < 5; i++) batchPart(P(GEO.box, PALETTE.baron, M(-0.4 + i * 0.2, 0.045, 0, { sx: 0.03, sy: 0.01, sz: 0.78 }), false), wm);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 6; i++) batchPart(P(GEO.bead, PALETTE.steel, M(-0.5 + i * 0.2, 0.05, s * 0.34, { s: 0.02 }), false), wm);
        for (const e of [-1, 1]) {
          batchPart(P(GEO.box, PALETTE.baron, M(e * 0.58, 0.22, s * 0.42, { sx: 0.12, sy: 0.44, sz: 0.12 })), wm);
          batchPart(P(GEO.cone, PALETTE.steelDark, M(e * 0.58, 0.5, s * 0.42, { sx: 0.08, sy: 0.14, sz: 0.08 }), false), wm);
        }
        for (let k = 0; k < 6; k++) { const u = k / 5; batchPart(P(GEO.ring, PALETTE.steelDark, M(-0.5 + u, 0.36 - Math.sin(u * Math.PI) * 0.12, s * 0.42, { s: 0.03, ry: Math.PI / 2 }), false), wm); }
      }
      // the fissure's heat: halos and embers along its length
      const sx = worldX(level.chokepoint.streamCol);
      for (let r = 0; r < rows; r += 3) glow(sx, 0.1, worldZ(r) + 0.5, { w: 1.2, h: 0.6 });
      let t0 = 0;
      animated.push({ update(t, dt) {
        t0 -= dt;
        if (t0 <= 0) { t0 = 0.12; puff(sx + (Math.random() - 0.5) * 0.6, 0.0, worldZ(Math.random() * rows), { count: 1, color: Math.random() < 0.6 ? PALETTE.ember : PALETTE.flowerYellow, speed: 0.15, size: 0.05, up: 1.2, ttl: 1.0 }); }
      } });
    }

    // The King's standard: a ring of royal pavilions round the great
    // standard of Aldermere, braziers at the door. The banner sinks as the
    // camp is overrun.
    function buildStandard() {
      const [cx, cz] = LC.endpointCenter(kit);
      const wm = M(cx, 0, cz);
      const st = { state: 0 };
      const gx = worldX(level.endpoint.gateCell[0]) - cx;
      batchPart(P(GEO.box, kit.lerpColor(PALETTE.path, PALETTE.meadow, 0.4).getHex(), M(0, 0.01, 0, { sx: 2.3, sy: 0.02, sz: 3.1 }), false), wm);
      for (const p of pavilionParts(0.58, PALETTE.tunic, 0, 0.66)) batchPart(p, M(cx + gx, 0, cz + 0.5));
      for (const p of pavilionParts(0.32, PALETTE.capRed, 0.6)) batchPart(p, M(cx - 0.6, 0, cz - 0.95));
      for (const p of pavilionParts(0.3, PALETTE.gold, -0.4)) batchPart(p, M(cx + 0.65, 0, cz - 1.15));
      batchDecal(cx + gx, cz + 0.5, 0.65);
      // the great standard
      const SX = -0.55, SZ = 0.2, SH = 3.6;
      batchPart(P(GEO.cyl, PALETTE.wood, M(SX, SH / 2, SZ, { sx: 0.045, sy: SH, sz: 0.045 })), wm);
      batchPart(P(GEO.cyl, PALETTE.stoneDark, M(SX, 0.1, SZ, { sx: 0.2, sy: 0.2, sz: 0.2 })), wm);
      batchPart(P(GEO.sphereLo, PALETTE.gold, M(SX, SH + 0.06, SZ, { s: 0.08 })), wm);
      batchPart(P(GEO.cyl, PALETTE.gold, M(SX + 0.5, SH - 0.08, SZ, { sx: 0.015, sy: 1.0, sz: 0.015, rz: Math.PI / 2 }), false), wm);
      LC.banner(kit, cx + SX, SH - 0.45, cz + SZ, { w: 1.0, h: 0.62, field: PALETTE.tunic, stripe: PALETTE.gold, emblem: PALETTE.capRed, stateRef: st });
      // shields on a rack and braziers either side of the door
      for (let i = 0; i < 3; i++) batchPart(P(GEO.cyl, [PALETTE.tunic, PALETTE.capRed, PALETTE.gold][i], M(0.75, 0.22, 0.95 + i * 0.16, { sx: 0.1, sy: 0.02, sz: 0.1, rz: Math.PI / 2 - 0.2 })), wm);
      for (const bx of [gx - 0.5, gx + 0.5]) {
        const bz = 1.25;
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
        rubble: [[cx - 1.0, cz + 1.3], [cx + 1.0, cz + 0.4], [cx - 1.0, cz - 0.2]],
        fire: [cx - 0.6, 0.6, cz - 0.95], smoke: [cx + gx, 1.2, cz + 0.5], burst: [cx + gx, 0.6, cz + 1.2],
      });
    }

    // The Black Keep: the Baron's tower looming beyond the western rim,
    // black stone, red-lit slits, a spiked crown of battlements, his banner.
    function buildBlackKeep() {
      const x = worldX(-2.3), z = worldZ(5.5), wm = M(x, 0.3, z);
      const H = 4.6, R = 1.0;
      batchPart(P(GEO.cylTaper, PALETTE.baron, M(0, H / 2, 0, { sx: R, sy: H, sz: R })), wm);
      batchPart(P(GEO.cyl, PALETTE.hollowWood, M(0, 0.2, 0, { sx: R + 0.2, sy: 0.4, sz: R + 0.2 })), wm);
      batchPart(P(GEO.cyl, PALETTE.baron, M(0, H + 0.1, 0, { sx: R * 0.8, sy: 0.25, sz: R * 0.8 })), wm);
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; batchPart(P(GEO.cone, PALETTE.baron, M(Math.cos(a) * R * 0.75, H + 0.4, Math.sin(a) * R * 0.75, { sx: 0.1, sy: 0.4, sz: 0.1 })), wm); }
      batchPart(P(GEO.cone, PALETTE.hollowWood, M(0, H + 1.0, 0, { sx: 0.55, sy: 1.5, sz: 0.55 })), wm);
      for (let i = 0; i < 9; i++) {
        const a = -0.9 + (i % 3) * 0.9, y = 1.2 + Math.floor(i / 3) * 1.1;
        batchPart(P(GEO.box, PALETTE.baronRed, M(Math.sin(a) * R * 0.86, y, Math.cos(a) * R * 0.86, { sx: 0.1, sy: 0.3, sz: 0.04, ry: a }), false, { unlit: true }), wm);
        glow(x + Math.sin(a) * R * 0.9, 0.3 + y, z + Math.cos(a) * R * 0.9, { w: 0.5, h: 0.6 });
      }
      // two lesser towers either side
      for (const s of [-1, 1]) {
        batchPart(P(GEO.cyl, PALETTE.baron, M(0.4, 1.3, s * 1.6, { sx: 0.45, sy: 2.6, sz: 0.45 })), wm);
        batchPart(P(GEO.cone, PALETTE.hollowWood, M(0.4, 3.0, s * 1.6, { sx: 0.52, sy: 0.9, sz: 0.52 })), wm);
        batchPart(P(GEO.box, PALETTE.baronRed, M(0.4 + 0.4, 1.8, s * 1.6, { sx: 0.04, sy: 0.24, sz: 0.08 }), false, { unlit: true }), wm);
        batchPart(P(GEO.box, PALETTE.baron, M(0.2, 0.7, s * 0.9, { sx: 0.4, sy: 1.4, sz: 1.0 })), wm);
      }
      batchPart(P(GEO.cyl, PALETTE.hollowWood, M(0, H + 2.0, 0, { sx: 0.03, sy: 1.0, sz: 0.03 }), false), wm);
      LC.banner(kit, x, H + 2.2, z, { w: 0.9, h: 0.5, field: PALETTE.baron, stripe: PALETTE.baronRed, emblem: PALETTE.baronRed, tattered: 0.3 });
    }

    LC.stream(kit, { seed: 101, speed: 0.25, shallow: PALETTE.spore, deep: PALETTE.baronRed, foam: PALETTE.flowerYellow });
    buildIronBridge();
    buildStandard();
    buildBlackKeep();
    LC.knaveCamps(kit);
    const endR = level.endpoint.cells.map(([, r]) => r), endC = level.endpoint.cells.map(([c]) => c);
    LC.countryside(kit, {
      seed: 10101,
      mix: [[8, 'tree'], [6, 'bush'], [10, 'tuft'], [10, 'rock'], [4, 'fence'], [4, 'barrel'], [2, 'hay'], [56, null]],
      edge: [[24, 'tree'], [20, 'rock'], [56, null]],
      keepLow: (c, r) => c >= Math.min(...endC) - 1 && c <= Math.max(...endC) + 1 && r >= Math.min(...endR) - 2 && r <= Math.max(...endR) + 1,
    });
  }

  // the three western roads meet at (5,8), cross the fissure at (7,8) and
  // run east to the standard; the two eastern roads meet at (14,8); every
  // road ends on (11,8), just under the gate
  const westTail = [[5, 8], [8, 8], [11, 8]];
  const eastTail = [[14, 8], [11, 8]];
  return {
    id: 'black-keep',
    index: 10,
    name: 'The Black Keep',
    subtitle: 'The last battle, in the heart of Blackmoor.',
    map: { x: 130, y: 102, reclaim: 100, icon: 'pavilion' },
    grid: { cols: 22, rows: 14 },
    spawn: [0, 9],
    routes: [
      { id: 'westmid',  waypoints: [[0, 9], [2, 9], [2, 10], [5, 10], ...westTail] },
      { id: 'westhigh', waypoints: [[0, 2], [3, 2], [3, 4], [6, 4], [6, 6], [5, 6], ...westTail] },
      { id: 'westlow',  waypoints: [[0, 13], [4, 13], [4, 10], [5, 10], ...westTail] },
      { id: 'easthigh', waypoints: [[21, 3], [18, 3], [18, 1], [14, 1], [14, 4], [16, 4], [16, 6], [14, 6], ...eastTail] },
      { id: 'eastlow',  waypoints: [[21, 11], [19, 11], [19, 13], [16, 13], [16, 10], [14, 10], ...eastTail] },
    ],
    chokepoint: { cell: [7, 8], streamCol: 7 },
    endpoint: {
      name: 'the King’s standard', properName: 'The King’s Standard',
      cells: [[10, 5], [11, 5], [10, 6], [11, 6], [10, 7], [11, 7]], gateCell: [11, 7],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [8.5, 6.5], radiusOut: { x: 13, z: 9.5 }, radiusIn: 1.25, falloffWidth: 0.5,
      foothold: { center: [10.5, 6.5], radius: 3.2, falloffWidth: 2 },
      backdrop: 0x2a2224, groundMeadow: 0x7a9448, groundMeadowDark: 0x647c3a, ambient: 0.34, fill: 0xe0a080, fillIntensity: 0.16,
      motes: { embers: 48, dust: 10 } },
    spawnBlockedText: "That's Blackmoor ground. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 260, startLives: 20, starThresholds: [16, 8],
    tipTile: [1, 8],
    endScreenText: {
      3: () => 'The Black Guard is broken, the Baron is in chains and the King’s standard never dipped. The war is over.',
      2: (s) => `The Baron is beaten and Blackmoor is ours, with ${s.lives} lives to spare. Long live the King.`,
      1: (s) => `The standard is torn, but it still flies over Blackmoor, with ${s.lives} lives left.`,
      lose: (s) => `The King's standard fell on wave ${s.wave}. Hold the fissure bridge for the west roads and the junction east of the standard for the rest. Save gold for the Baron.`,
    },
    buildScene,
  };
})();
