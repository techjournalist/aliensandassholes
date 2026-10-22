// ===================================================================
// LEVEL 5 — Highcrag Pass
// The Baron fled west over the mountains, and the King's host follows.
// The knaves hold the high ground now: one road zigzags down the goat
// track from the northern crags, another climbs the low pass from the
// east. Both cross the frozen gorge on one rope bridge before Highcrag
// Fort, the last royal outpost before Blackmoor.
// ===================================================================
const LEVEL_5 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: 'Up the Goat Track',     flavor: 'Brigands pick their way down the switchbacks. One road so far.',               groups: [g('grunt', 5, 3.2, 0, 'goat')] },
    { name: 'The Low Pass',          flavor: 'More climb the low pass from the east. Watch the horn posts.',                 groups: [g('grunt', 5, 2.0, 0, 'goat', 0), g('grunt', 4, 2.4, 0, 'low', 4)] },
    { name: 'Light on Their Feet',   flavor: 'Cutpurses scramble up the low pass.',                                          groups: [g('grunt', 5, 1.5, 0, 'goat', 0), g('trickster', 5, 0.9, 0, 'low', 4)] },
    { name: 'Plate in the Snow',     flavor: 'A Black Knight on the switchbacks. Towers inside the bends hit it twice.',     groups: [g('grunt', 6, 1.2, 0, 'low', 0), g('troll', 1, 1, 0, 'goat', 2), g('grunt', 4, 1.4, 0, 'goat', 6)] },
    { name: 'Off the Crags',         flavor: 'Gargoyles glide down the low pass. Only the Magus and the Longbowmen reach them.', groups: [g('bat', 3, 1.3, 0, 'low', 0), g('grunt', 6, 1.1, 0, 'goat', 3)] },
    { name: 'Both Trails',           flavor: 'Both roads at once. The ground just east of the gorge covers both.',          groups: [g('grunt', 6, 1.0, 0, 'goat', 0), g('grunt', 6, 1.0, 0, 'low', 0), g('trickster', 5, 0.6, 0, 'low', 6)] },
    { name: 'Iron and Ice',          flavor: 'Black Knights down the goat track, Cutpurses up the pass.',                   groups: [g('troll', 2, 2.8, 0, 'goat', 0), g('trickster', 7, 0.7, 0, 'low', 2)] },
    { name: 'The Crag Flock',        flavor: 'Gargoyles over the switchbacks, Cutpurses below, brigands behind.',            groups: [g('bat', 5, 0.9, 0, 'goat', 0), g('trickster', 7, 0.6, 0, 'low', 3), g('grunt', 5, 1.0, 0, 'goat', 6)] },
    { name: 'The Press',             flavor: 'The knaves lean on both roads in turn.',                                       groups: [g('troll', 2, 2.6, 0, 'low', 0), g('grunt', 8, 0.8, 0, 'goat', 1), g('trickster', 6, 0.6, 0, 'low', 6), g('bat', 4, 1.0, 0, 'goat', 10)] },
    { name: 'Pincer',                flavor: 'Knights down both roads, gargoyles over the pass.',                           groups: [g('troll', 2, 2.6, 0, 'goat', 0), g('troll', 1, 2.4, 0, 'low', 3), g('bat', 5, 0.9, 0, 'low', 6), g('grunt', 6, 0.9, 0, 'goat', 11)] },
    { name: 'Avalanche',             flavor: 'They pour down the mountain. Hold the rope bridge.',                           groups: [g('grunt', 10, 0.65, 0, 'goat', 0), g('trickster', 9, 0.5, 0, 'low', 2), g('troll', 3, 2.2, 0, 'goat', 4), g('bat', 5, 0.85, 0, 'low', 8)] },
    { name: 'Whiteout',              flavor: 'Knights, Cutpurses and gargoyles, all at the same moment.',                    groups: [g('troll', 3, 2.2, 0, 'goat', 0), g('trickster', 11, 0.45, 0, 'low', 0), g('bat', 7, 0.6, 0, 'goat', 0)] },
    { name: 'The Hill Giant',        flavor: 'The Baron has bribed a giant. It walks, so every tower can hit it, but it is huge and wears iron.', groups: [g('grunt', 6, 0.9, 0, 'low', 0), g('bat', 4, 1.0, 0, 'goat', 1), g('giant', 1, 1, 0, 'goat', 6)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, toon, srand, scene, animated, puff,
      masonry, towerCourses, roofCourses, glow, worldX, worldZ, level, cols } = kit;
    const LC = LevelCommon;

    // A snow-laden fir: three stacked tiers of dark pine, each capped in snow.
    function firParts(rng) {
      const s = 0.8 + rng() * 0.45;
      const parts = [P(GEO.cyl, PALETTE.wood, M(0, 0.12 * s, 0, { sx: 0.05 * s, sy: 0.24 * s, sz: 0.05 * s }))];
      for (let i = 0; i < 3; i++) {
        const r = (0.36 - i * 0.09) * s, y = (0.34 + i * 0.25) * s;
        parts.push(P(GEO.cone, PALETTE.pine, M(0, y, 0, { sx: r, sy: 0.42 * s, sz: r, ry: rng() })));
        parts.push(P(GEO.cone, PALETTE.snow, M(0, y + 0.11 * s, 0, { sx: r * 0.68, sy: 0.2 * s, sz: r * 0.68 }), false));
      }
      return { parts, radius: 0.34 * s };
    }
    // a low drift of snow
    function driftParts(rng) {
      const s = 0.16 + rng() * 0.16, ry = rng() * 3;
      return { parts: [
        P(GEO.dome, PALETTE.snow, M(0, 0, 0, { sx: s * 1.6, sy: s * 0.45, sz: s, ry }), false),
        P(GEO.dome, PALETTE.frostRobe, M(s * 0.7, 0, s * 0.3, { sx: s * 0.8, sy: s * 0.3, sz: s * 0.7, ry }), false),
      ], radius: 0 };
    }
    // a boulder with a cap of snow
    function snowRockParts(rng) {
      const made = kit.rockParts(rng, false), s = made.radius / 1.2;
      made.parts.push(P(GEO.dome, PALETTE.snow, M(0, s * 1.05, 0, { sx: s * 1.1, sy: s * 0.4, sz: s * 0.85 }), false));
      return made;
    }
    kit.extraRecipes = (rng) => ({ fir: () => firParts(rng), drift: () => driftParts(rng), snowrock: () => snowRockParts(rng) });

    // The rope bridge over the frozen gorge: a sagging plank deck on two
    // ropes slung between posts, icicles hanging underneath, a string of
    // little royal pennants that flap in the mountain wind.
    function buildRopeBridge() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      const sag = (u) => -0.07 * (1 - u * u);   // u from -1 to 1 across the gorge
      for (let i = 0; i < 9; i++) {
        const u = -1 + i / 4, px = u * 0.56;
        batchPart(P(GEO.box, i % 2 ? PALETTE.woodLight : PALETTE.wood, M(px, sag(u), 0, { sx: 0.11, sy: 0.04, sz: 0.78, rz: (i % 3 - 1) * 0.04 })), wm);
        if (i % 2) batchPart(P(GEO.cone, PALETTE.frost, M(px, sag(u) - 0.12, (i % 4 - 1.5) * 0.18, { sx: 0.025, sy: 0.18, sz: 0.025, rx: Math.PI }), false, { unlit: true }), wm);
      }
      for (const s of [-1, 1]) {
        for (const e of [-1, 1]) {
          batchPart(P(GEO.cyl, PALETTE.wood, M(e * 0.62, 0.22, s * 0.42, { sx: 0.04, sy: 0.6, sz: 0.04 })), wm);
          batchPart(P(GEO.dome, PALETTE.snow, M(e * 0.62, 0.52, s * 0.42, { sx: 0.05, sy: 0.04, sz: 0.05 }), false), wm);
        }
        // the hand rope, in short straight pieces following the sag
        for (let i = 0; i < 6; i++) {
          const u0 = -1 + i / 3, u1 = u0 + 1 / 3, y0 = 0.42 + sag(u0) * 1.6, y1 = 0.42 + sag(u1) * 1.6;
          const len = Math.hypot((u1 - u0) * 0.62, y1 - y0);
          batchPart(P(GEO.cyl, PALETTE.straw, M((u0 + u1) / 2 * 0.62, (y0 + y1) / 2, s * 0.42, { sx: 0.012, sy: len, sz: 0.012, rz: Math.PI / 2 + Math.atan2(y1 - y0, (u1 - u0) * 0.62) }), false), wm);
        }
      }
      // pennants on the north rope, each flapping on its own
      const flags = [];
      for (let i = 0; i < 5; i++) {
        const u = -0.66 + i * 0.33;
        flags.push(P(GEO.cone, [PALETTE.tunic, PALETTE.gold, PALETTE.capRed][i % 3], M(u * 0.62, 0.36 + sag(u) * 1.6, -0.42, { sx: 0.045, sy: 0.1, sz: 0.012, rx: Math.PI }), false, { name: `pennant${i}`, live: true }));
      }
      const fg = liveProp(flags, x, 0, z);
      animated.push({ update(t) { for (let i = 0; i < 5; i++) { const f = fg.getObjectByName(`pennant${i}`); if (f) f.rotation.x = Math.PI + Math.sin(t * 6 + i * 1.3) * 0.35; } } });
    }

    // Highcrag Fort: a square keep of grey mountain stone under a snowy slate
    // roof, a round watch tower at its north-west corner flying the King's
    // banner, and a crenellated wall with the gatehouse facing the road.
    function buildFort() {
      const [cx, cz] = LC.endpointCenter(kit);
      const wm = M(cx, 0, cz);
      const st = { state: 0 };
      const gx = worldX(level.endpoint.gateCell[0]) - cx;
      batchPart(P(GEO.box, kit.lerpColor(PALETTE.cobble, PALETTE.snow, 0.35).getHex(), M(0, 0.01, 0, { sx: 2.8, sy: 0.02, sz: 2.8 }), false), wm);
      // the keep
      const KX = 0.15, KZ = -0.45, KW = 1.5, KD = 1.2, KH = 2.1;
      batchPart(P(GEO.box, PALETTE.stone, M(KX, KH / 2, KZ, { sx: KW, sy: KH, sz: KD })), wm);
      batchPart(P(GEO.box, PALETTE.stoneDark, M(KX, 0.1, KZ, { sx: KW + 0.1, sy: 0.2, sz: KD + 0.1 })), wm);
      masonry(wm, { face: 'z', at: KZ + KD / 2, u0: KX - KW / 2, u1: KX + KW / 2, y0: 1.0, y1: KH, seed: 51, holes: [[KX - 0.35, 1.55, 0.26, 0.36], [KX + 0.35, 1.55, 0.26, 0.36]] });
      masonry(wm, { face: 'x', at: KX + KW / 2, u0: KZ - KD / 2, u1: KZ + KD / 2, y0: 0.2, y1: KH, seed: 52, holes: [[KZ, 1.5, 0.26, 0.36]] });
      const pyr = new THREE.ConeGeometry(1, 1, 4).toNonIndexed();
      batchPart(P(pyr, PALETTE.slate, M(KX, KH + 0.42, KZ, { sx: 1.12, sy: 0.85, sz: 0.92, ry: Math.PI / 4 })), wm);
      batchPart(P(pyr, PALETTE.snow, M(KX, KH + 0.62, KZ, { sx: 0.7, sy: 0.5, sz: 0.58, ry: Math.PI / 4 }), false), wm);
      batchPart(P(GEO.box, PALETTE.snow, M(KX, KH + 0.02, KZ + KD / 2 + 0.02, { sx: KW + 0.1, sy: 0.05, sz: 0.1 }), false), wm);
      // the round watch tower
      const TX = -0.95, TZ = -0.95, TR = 0.38, TH = 2.8;
      batchPart(P(GEO.cyl, PALETTE.stone, M(TX, TH / 2, TZ, { sx: TR, sy: TH, sz: TR })), wm);
      batchPart(P(GEO.cyl, PALETTE.stoneDark, M(TX, TH, TZ, { sx: TR + 0.08, sy: 0.12, sz: TR + 0.08 })), wm);
      towerCourses(wm, { x: TX, z: TZ, r: TR, y0: 0.15, y1: TH - 0.1, seed: 53, holes: [[0, 2.1, 0.34]] });
      batchPart(P(GEO.cone, PALETTE.slate, M(TX, TH + 0.5, TZ, { sx: TR + 0.12, sy: 1.0, sz: TR + 0.12 })), wm);
      roofCourses(wm, { x: TX, y: TH + 0.05, z: TZ, r: TR + 0.12, h: 1.0, color: PALETTE.slate, kind: 'cone', rings: 3 });
      batchPart(P(GEO.cone, PALETTE.snow, M(TX, TH + 0.78, TZ, { sx: TR * 0.65, sy: 0.5, sz: TR * 0.65 }), false), wm);
      const pole = new THREE.Mesh(GEO.cyl, toon(PALETTE.wood));
      pole.position.set(cx + TX, TH + 1.3, cz + TZ); pole.scale.set(0.03, 1.0, 0.03);
      scene.add(pole);
      LC.banner(kit, cx + TX, TH + 1.62, cz + TZ, { w: 0.62, h: 0.36, field: PALETTE.tunic, stripe: PALETTE.gold, emblem: PALETTE.heraldWhite, stateRef: st });
      // the front wall and the gatehouse, merlons capped with snow
      const WZ = 1.05, WH = 0.85;
      const wallSeg = (x0, x1) => {
        const w = x1 - x0, mx = (x0 + x1) / 2;
        batchPart(P(GEO.box, PALETTE.stone, M(mx, WH / 2, WZ, { sx: w, sy: WH, sz: 0.26 })), wm);
        for (let u = x0 + 0.1; u < x1 - 0.05; u += 0.26) {
          batchPart(P(GEO.box, PALETTE.stoneDark, M(u, WH + 0.08, WZ, { sx: 0.13, sy: 0.16, sz: 0.28 })), wm);
          batchPart(P(GEO.box, PALETTE.snow, M(u, WH + 0.175, WZ, { sx: 0.14, sy: 0.035, sz: 0.29 }), false), wm);
        }
      };
      wallSeg(-1.35, gx - 0.42); wallSeg(gx + 0.42, 1.35);
      batchPart(P(GEO.box, PALETTE.stone, M(-1.25, WH / 2, 0, { sx: 0.24, sy: WH, sz: 2.1 })), wm);
      batchPart(P(GEO.box, PALETTE.stone, M(1.25, WH / 2, 0, { sx: 0.24, sy: WH, sz: 2.1 })), wm);
      masonry(wm, { face: 'z', at: WZ + 0.13, u0: -1.35, u1: 1.35, y0: 0.05, y1: WH, seed: 54, holes: [[gx, 0.5, 0.86, 1.1]] });
      batchPart(P(GEO.box, PALETTE.stone, M(gx, 0.75, WZ + 0.02, { sx: 0.84, sy: 1.5, sz: 0.4 })), wm);
      batchPart(P(GEO.box, PALETTE.stoneDark, M(gx, 1.54, WZ + 0.02, { sx: 0.92, sy: 0.1, sz: 0.46 })), wm);
      batchPart(P(pyr, PALETTE.slate, M(gx, 1.82, WZ + 0.02, { sx: 0.66, sy: 0.5, sz: 0.36, ry: Math.PI / 4 })), wm);
      batchPart(P(pyr, PALETTE.snow, M(gx, 1.94, WZ + 0.02, { sx: 0.42, sy: 0.3, sz: 0.24, ry: Math.PI / 4 }), false), wm);
      batchPart(P(GEO.box, 0x241c18, M(gx, 0.34, WZ + 0.225, { sx: 0.4, sy: 0.68, sz: 0.02 }), false), wm);
      batchPart(P(GEO.cyl, 0x241c18, M(gx, 0.68, WZ + 0.225, { sx: 0.2, sy: 0.02, sz: 0.2, rx: Math.PI / 2 }), false), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(gx, 0.32, WZ + 0.24, { sx: 0.34, sy: 0.6, sz: 0.03 }), false), wm);
      for (let i = 0; i < 3; i++) batchPart(P(GEO.box, PALETTE.steelDark, M(gx, 0.15 + i * 0.2, WZ + 0.26, { sx: 0.36, sy: 0.025, sz: 0.01 }), false), wm);
      // snow heaped against the walls
      const rng = srand(55);
      for (let i = 0; i < 9; i++) {
        const u = -1.2 + rng() * 2.4;
        if (Math.abs(u - gx) < 0.55) continue;
        batchPart(P(GEO.dome, PALETTE.snow, M(u, 0, WZ + 0.2, { sx: 0.22 + rng() * 0.12, sy: 0.12, sz: 0.14 }), false), wm);
      }
      LC.windows(kit, wm, [cx, cz], [[KX - 0.35, 1.55, KZ + KD / 2, 'z'], [KX + 0.35, 1.55, KZ + KD / 2, 'z'], [KX + KW / 2, 1.5, KZ, 'x'], [TX, 2.1, TZ + TR, 'z']], st);
      // a brazier by the gate for the sentries' cold hands
      const bx = gx + 0.68, bz = WZ + 0.42;
      batchPart(P(GEO.cyl, PALETTE.steelDark, M(bx, 0.18, bz, { sx: 0.03, sy: 0.36, sz: 0.03 }), false), wm);
      batchPart(P(GEO.cylTaper, PALETTE.steelDark, M(bx, 0.4, bz, { sx: 0.11, sy: 0.1, sz: 0.11, rx: Math.PI }), false), wm);
      const flame = new THREE.Mesh(GEO.cone, new THREE.MeshBasicMaterial({ color: PALETTE.ember }));
      flame.position.set(cx + bx, 0.52, cz + bz); flame.scale.set(0.07, 0.16, 0.07);
      scene.add(flame);
      glow(cx + bx, 0.55, cz + bz, { w: 0.6, h: 0.6 });
      animated.push({ update(t) { const k = 0.8 + 0.2 * Math.sin(t * 14) * Math.sin(t * 5.1); flame.scale.set(0.07 * (2 - k), 0.16 * k * (st.state === 2 ? 0.5 : 1), 0.07 * (2 - k)); } });
      LC.damage(kit, {
        stateRef: st,
        cracks: [[cx + KX + 0.3, 1.2, cz + KZ + KD / 2 + 0.01, 0.2, 0.6, 'z'], [cx - 0.75, 0.45, cz + WZ + 0.14, 0.18, 0.4, 'z'], [cx + KX + KW / 2 + 0.01, 1.0, cz + KZ - 0.2, 0.18, 0.5, 'x']],
        rubble: [[cx - 1.5, cz + 1.4], [cx + 1.5, cz + 1.2], [cx + 1.55, cz - 0.6], [cx - 0.6, cz + 1.55]],
        fire: [cx + KX, KH + 0.3, cz + KZ + 0.2], smoke: [cx + KX, KH + 0.6, cz + KZ], burst: [cx + gx, 0.6, cz + WZ + 0.4],
      });
    }

    // the high peaks behind the pass, beyond the north and east rims
    function buildPeaks() {
      const rng = srand(56);
      const peak = (x, z, h, r) => {
        batchPart(P(GEO.cone, PALETTE.stoneDark, M(x, h / 2 - 0.2, z, { sx: r, sy: h, sz: r * 0.8, ry: rng() })));
        batchPart(P(GEO.cone, PALETTE.slate, M(x + r * 0.25, h * 0.4 - 0.2, z + 0.2, { sx: r * 0.7, sy: h * 0.8, sz: r * 0.6, ry: rng() })));
        batchPart(P(GEO.cone, PALETTE.snow, M(x, h * 0.78 - 0.2, z, { sx: r * 0.42, sy: h * 0.45, sz: r * 0.36 }), false));
      };
      for (let i = 0; i < 6; i++) peak(worldX(1 + i * 3.4 + rng()), worldZ(-2.6) - rng() * 0.6, 2.6 + rng() * 1.6, 1.3 + rng() * 0.5);
      for (let i = 0; i < 3; i++) peak(worldX(cols + 1.6 + rng() * 0.4), worldZ(2 + i * 4.2), 2.2 + rng() * 1.2, 1.1 + rng() * 0.4);
    }

    LC.stream(kit, { seed: 51, speed: 0.35, shallow: PALETTE.frost, deep: PALETTE.waterDeep, foam: PALETTE.snow });
    buildRopeBridge();
    buildFort();
    buildPeaks();
    LC.knaveCamps(kit);
    const endR = level.endpoint.cells.map(([, r]) => r), endC = level.endpoint.cells.map(([c]) => c);
    LC.countryside(kit, {
      seed: 5151,
      mix: [[24, 'fir'], [10, 'snowrock'], [12, 'drift'], [6, 'bush'], [5, 'tuft'], [3, 'fence'], [2, 'cottage'], [2, 'barrel'], [22, null]],
      edge: [[58, 'fir'], [14, 'snowrock'], [10, 'drift'], [18, null]],
      keepLow: (c, r) => c <= Math.max(...endC) + 1 && r >= Math.min(...endR) - 1 && r <= Math.max(...endR) + 2,
    });
  }

  // the trunk: west from the junction at (11,7), over the rope bridge at
  // (6,7), then round the fort's south side to its gate (collinear points
  // keep runs short)
  const tail = [[11, 7], [8, 7], [5, 7], [5, 9], [2, 9]];
  return {
    id: 'highcrag-pass',
    index: 5,
    name: 'Highcrag Pass',
    subtitle: 'The road into the mountains. The knaves hold the heights.',
    map: { x: 606, y: 70, reclaim: 95, icon: 'fort' },
    grid: { cols: 20, rows: 14 },
    spawn: [17, 0],
    routes: [
      { id: 'goat', waypoints: [[17, 0], [17, 2], [12, 2], [12, 4], [16, 4], [16, 7], ...tail] },
      { id: 'low', waypoints: [[19, 11], [15, 11], [15, 9], [11, 9], ...tail] },
    ],
    chokepoint: { cell: [6, 7], streamCol: 6 },
    endpoint: {
      name: 'Highcrag Fort', properName: 'Highcrag Fort',
      cells: [[1, 6], [2, 6], [3, 6], [1, 7], [2, 7], [3, 7], [1, 8], [2, 8], [3, 8]], gateCell: [2, 8],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [19.5, 5], radiusOut: { x: 7, z: 9 }, radiusIn: 1.2, falloffWidth: 0.5, motes: { embers: 20, dust: 26 },
      backdrop: 0x3a4a52, groundMeadow: 0x8fae86, groundMeadowDark: 0x76967a, ambient: 0.36, fill: 0xb8d8e8, fillIntensity: 0.18 },
    spawnBlockedText: "That's the Baron's camp. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 165, startLives: 20, starThresholds: [16, 8],
    tipTile: [17, 3],
    endScreenText: {
      3: () => 'Thirteen waves, a giant felled in the snow, and not one knave reached the gate. The pass is ours.',
      2: (s) => `The giant is down and the pass is open, with ${s.lives} lives to spare. Highcrag Fort holds.`,
      1: (s) => `The fort's gate is splintered, but it holds, with ${s.lives} lives left.`,
      lose: (s) => `Highcrag Fort fell on wave ${s.wave}. Build inside the goat track's bends, cover the ground east of the gorge where both roads meet, and save gold for the giant.`,
    },
    buildScene,
  };
})();
