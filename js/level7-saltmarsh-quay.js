// ===================================================================
// LEVEL 7 — Saltmarsh Quay
// The Baron's corsairs land on the south beaches. The shore road and the
// dune path cross the tidal inlet on the old pier bridge; the beach track
// stays east of the water, winds through the dunes and joins them on the
// headland. Everything ends at the lighthouse, whose lamp guides the royal
// fleet in.
// ===================================================================
const LEVEL_7 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: 'Landing Party',       flavor: 'Brigands come up the shore road from the west. One road so far.',               groups: [g('grunt', 5, 3.0, 0, 'shore')] },
    { name: 'Through the Dunes',   flavor: 'More wind through the dunes. Both cross the pier bridge.',                      groups: [g('grunt', 5, 2.0, 0, 'shore', 0), g('grunt', 4, 2.2, 0, 'dunes', 3)] },
    { name: 'Up the Beach',        flavor: 'Cutpurses run up the beach track. It never crosses the inlet.',                 groups: [g('grunt', 6, 1.6, 0, 'dunes', 0), g('trickster', 6, 1.0, 0, 'beach', 4)] },
    { name: 'Boarding Plate',      flavor: 'A Black Knight in the dunes. Towers inside the loops hit it twice.',            groups: [g('grunt', 6, 1.3, 0, 'shore', 0), g('troll', 1, 1, 0, 'dunes', 2), g('grunt', 5, 1.5, 0, 'beach', 8)] },
    { name: 'Gulls of Stone',      flavor: 'Gargoyles off the beach. The Magus and the Longbowmen reach them.',              groups: [g('bat', 4, 1.3, 0, 'beach', 0), g('grunt', 9, 1.0, 0, 'shore', 3)] },
    { name: 'Three Landings',      flavor: 'Every road at once. The headland covers two of them.',                          groups: [g('grunt', 6, 1.1, 0, 'shore', 0), g('grunt', 5, 1.1, 0, 'dunes', 0), g('grunt', 4, 1.2, 0, 'beach', 2)] },
    { name: 'Iron and Spray',      flavor: 'Knights through the dunes, Cutpurses up the beach.',                            groups: [g('troll', 4, 2.6, 0, 'dunes', 0), g('trickster', 10, 0.6, 0, 'beach', 3)] },
    { name: 'High Tide',           flavor: 'Gargoyles over the shore, Cutpurses on the sand, brigands in the dunes.',        groups: [g('bat', 6, 0.9, 0, 'shore', 0), g('trickster', 10, 0.6, 0, 'beach', 4), g('grunt', 9, 0.9, 0, 'dunes', 6)] },
    { name: 'The Press',           flavor: 'The corsairs lean on every road in turn.',                                      groups: [g('troll', 4, 2.4, 0, 'dunes', 0), g('grunt', 13, 0.7, 0, 'shore', 1), g('trickster', 9, 0.6, 0, 'beach', 6), g('bat', 6, 0.9, 0, 'shore', 10)] },
    { name: 'Pincer',              flavor: 'Knights on both western roads, gargoyles over the beach.',                      groups: [g('troll', 4, 2.2, 0, 'dunes', 0), g('troll', 3, 2.4, 0, 'shore', 2), g('bat', 8, 0.8, 0, 'beach', 4), g('grunt', 10, 0.7, 0, 'beach', 9)] },
    { name: 'Storm Tide',          flavor: 'The storm drives them in. Keep the lamp lit.',                                  groups: [g('grunt', 16, 0.55, 0, 'shore', 0), g('trickster', 13, 0.45, 0, 'beach', 2), g('troll', 5, 2.0, 0, 'dunes', 3), g('bat', 8, 0.8, 0, 'shore', 8)] },
    { name: 'All Hands',           flavor: 'Knights, Cutpurses and gargoyles, all at the same moment.',                     groups: [g('troll', 5, 2.0, 0, 'dunes', 0), g('trickster', 16, 0.4, 0, 'beach', 0), g('bat', 9, 0.6, 0, 'shore', 0), g('grunt', 10, 0.7, 0, 'shore', 6)] },
    { name: 'The Sea Wyvern',      flavor: 'A wyvern rises from the waves. It flies and wears scales: the Magus and the Longbowmen, now.', groups: [g('bat', 5, 1.0, 0, 'beach', 0), g('grunt', 8, 0.75, 0, 'shore', 1), g('wyvern', 1, 1, 0, 'dunes', 7)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, toon, srand, scene, animated, puff,
      roofCourses, glow, worldX, worldZ, level, rows } = kit;
    const LC = LevelCommon;

    // Beach dressing: an upturned rowboat, a net drying on poles, a stack of
    // crab pots, a driftwood log, a clump of marram grass.
    function boatParts(rng) {
      const ry = rng() * 6, c = Math.cos(ry), sn = Math.sin(ry);
      const at = (x, y, z, o = {}) => M(x * c + z * sn, y, -x * sn + z * c, { ...o, ry: (o.ry || 0) + ry });
      return { parts: [
        P(GEO.sphereLo, PALETTE.wood, at(0, 0.02, 0, { sx: 0.16, sy: 0.12, sz: 0.4 })),
        P(GEO.box, PALETTE.capRed, at(0, 0.1, 0, { sx: 0.3, sy: 0.02, sz: 0.62 }), false),
        P(GEO.cyl, PALETTE.woodLight, at(0.24, 0.03, 0.1, { sx: 0.012, sy: 0.5, sz: 0.012, rx: Math.PI / 2 }), false),
      ], radius: 0.35 };
    }
    function netParts(rng) {
      const parts = [];
      for (const x of [-0.25, 0.25]) parts.push(P(GEO.cyl, PALETTE.wood, M(x, 0.25, 0, { sx: 0.02, sy: 0.5, sz: 0.02 })));
      parts.push(P(GEO.box, PALETTE.canvas, M(0, 0.32, 0, { sx: 0.48, sy: 0.3, sz: 0.01 }), false));
      for (let i = 0; i < 4; i++) parts.push(P(GEO.box, PALETTE.acornCap, M(-0.18 + i * 0.12, 0.32, 0.006, { sx: 0.006, sy: 0.3, sz: 0.006 }), false));
      parts.push(P(GEO.sphereLo, PALETTE.gold, M(0.1, 0.2, 0.02, { s: 0.03 }), false));
      return { parts, radius: 0 };
    }
    function potsParts(rng) {
      const parts = [];
      for (let i = 0; i < 3; i++) parts.push(P(GEO.cyl, PALETTE.woodLight, M((i - 1) * 0.13, 0.06 + (i === 1 ? 0.1 : 0), 0, { sx: 0.06, sy: 0.12, sz: 0.06 })));
      parts.push(P(GEO.cyl, PALETTE.straw, M(0.2, 0.01, 0.1, { sx: 0.1, sy: 0.02, sz: 0.1 }), false));
      return { parts, radius: 0.15 };
    }
    function marramParts(rng) {
      const parts = [];
      for (let i = 0; i < 6; i++) { const a = rng() * 6.28; parts.push(P(GEO.cone, PALETTE.straw, M(Math.cos(a) * 0.05, 0.12, Math.sin(a) * 0.05, { sx: 0.012, sy: 0.24 + rng() * 0.1, sz: 0.012, rx: Math.sin(a) * 0.3, rz: Math.cos(a) * 0.3 }), false)); }
      parts.push(P(GEO.dome, PALETTE.straw, M(0, 0, 0, { sx: 0.1, sy: 0.04, sz: 0.1 }), false));
      return { parts, radius: 0 };
    }
    kit.extraRecipes = (rng) => ({ boat: () => boatParts(rng), net: () => netParts(rng), pots: () => potsParts(rng), marram: () => marramParts(rng) });

    // The pier bridge: a plank deck on tarred piles over the inlet, rope
    // rails, mooring bollards and a lantern post.
    function buildPier() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      batchPart(P(GEO.box, PALETTE.wood, M(0, 0.0, 0, { sx: 1.14, sy: 0.06, sz: 0.84 })), wm);
      for (let i = 0; i < 7; i++) batchPart(P(GEO.box, i % 2 ? PALETTE.woodLight : PALETTE.wood, M(-0.48 + i * 0.16, 0.035, 0, { sx: 0.13, sy: 0.015, sz: 0.82 }), false), wm);
      for (const s of [-1, 1]) for (const e of [-0.5, 0, 0.5]) {
        batchPart(P(GEO.cyl, PALETTE.timber, M(e, -0.1, s * 0.4, { sx: 0.05, sy: 0.4, sz: 0.05 })), wm);
        batchPart(P(GEO.cyl, PALETTE.timber, M(e, 0.18, s * 0.4, { sx: 0.035, sy: 0.32, sz: 0.035 }), false), wm);
      }
      for (const s of [-1, 1]) batchPart(P(GEO.cyl, PALETTE.straw, M(0, 0.3, s * 0.4, { sx: 0.012, sy: 1.04, sz: 0.012, rz: Math.PI / 2 }), false), wm);
      batchPart(P(GEO.cyl, PALETTE.steelDark, M(-0.56, 0.06, 0.44, { sx: 0.05, sy: 0.12, sz: 0.05 }), false), wm);
      batchPart(P(GEO.cyl, PALETTE.steelDark, M(0.56, 0.06, -0.44, { sx: 0.05, sy: 0.12, sz: 0.05 }), false), wm);
      batchPart(P(GEO.cyl, PALETTE.wood, M(0.56, 0.42, 0.46, { sx: 0.02, sy: 0.84, sz: 0.02 }), false), wm);
      batchPart(P(GEO.box, PALETTE.windowWarm, M(0.56, 0.86, 0.46, { sx: 0.07, sy: 0.09, sz: 0.07 }), false, { unlit: true }), wm);
      glow(x + 0.56, 0.86, z + 0.46, { w: 0.45, h: 0.45 });
    }

    // A royal cog riding at anchor in the inlet: a round-bellied hull, one
    // mast with a striped sail and a pennant, bobbing on the swell.
    function buildCog() {
      const x = worldX(level.chokepoint.streamCol), z = worldZ(2.2);
      const parts = [
        P(GEO.sphereLo, PALETTE.wood, M(0, 0.0, 0, { sx: 0.3, sy: 0.22, sz: 0.85 })),
        P(GEO.box, PALETTE.woodLight, M(0, 0.17, 0, { sx: 0.5, sy: 0.04, sz: 1.3 })),
        P(GEO.box, PALETTE.wood, M(0, 0.3, -0.52, { sx: 0.46, sy: 0.24, sz: 0.3 })),
        P(GEO.box, PALETTE.wood, M(0, 0.26, 0.56, { sx: 0.4, sy: 0.16, sz: 0.2 })),
        P(GEO.box, PALETTE.tunic, M(0, 0.12, 0, { sx: 0.52, sy: 0.04, sz: 1.36 }), false),
        P(GEO.cyl, PALETTE.wood, M(0, 0.9, 0, { sx: 0.03, sy: 1.5, sz: 0.03 })),
        P(GEO.cyl, PALETTE.wood, M(0, 1.3, 0, { sx: 0.015, sy: 0.7, sz: 0.015, rx: Math.PI / 2, rz: Math.PI / 2 }), false),
        P(GEO.box, PALETTE.heraldWhite, M(0, 0.95, 0.03, { sx: 0.66, sy: 0.66, sz: 0.02 })),
        ...[-0.22, 0, 0.22].map((u, i) => P(GEO.box, i === 1 ? PALETTE.capRed : PALETTE.tunic, M(u, 0.95, 0.045, { sx: 0.08, sy: 0.64, sz: 0.01 }), false)),
        P(GEO.box, PALETTE.gold, M(0.12, 1.7, 0, { sx: 0.24, sy: 0.08, sz: 0.01 }), true, { name: 'pennant', live: true }),
      ];
      const ship = liveProp(parts, x, -0.05, z, { ao: true });
      const pen = ship.getObjectByName('pennant');
      animated.push({ update(t) {
        ship.position.y = -0.05 + Math.sin(t * 1.3) * 0.03;
        ship.rotation.z = Math.sin(t * 1.1) * 0.05; ship.rotation.x = Math.sin(t * 0.8 + 1) * 0.03;
        if (pen) pen.rotation.y = Math.sin(t * 5) * 0.4;
      } });
    }

    // The Saltmarsh lighthouse: a tall white tower banded in red, a gallery
    // and a glazed lamp room under a red cap, its beam sweeping the sea, and
    // the keeper's cottage at its foot with the door the road climbs to.
    function buildLighthouse() {
      const [cx, cz] = LC.endpointCenter(kit);
      const wm = M(cx, 0, cz);
      const st = { state: 0 };
      const gx = worldX(level.endpoint.gateCell[0]) - cx;
      batchPart(P(GEO.box, kit.lerpColor(PALETTE.stone, PALETTE.straw, 0.25).getHex(), M(0, 0.01, 0, { sx: 2.9, sy: 0.02, sz: 2.9 }), false), wm);
      const LX = 0.3, LZ = -0.55, R = 0.5, H = 3.3;
      batchPart(P(GEO.cylTaper, PALETTE.heraldWhite, M(LX, H / 2, LZ, { sx: R, sy: H, sz: R })), wm);
      batchPart(P(GEO.cyl, PALETTE.stoneDark, M(LX, 0.12, LZ, { sx: R + 0.1, sy: 0.24, sz: R + 0.1 })), wm);
      for (const y of [0.9, 1.75, 2.55]) batchPart(P(GEO.cylTaper, PALETTE.capRed, M(LX, y, LZ, { sx: R * (1 - y / H * 0.4) + 0.012, sy: 0.32, sz: R * (1 - y / H * 0.4) + 0.012 }), false), wm);
      // gallery, railing, glazed lamp room and red cap
      const GY = H + 0.02, LR = R * 0.62;
      batchPart(P(GEO.cyl, PALETTE.stoneDark, M(LX, GY, LZ, { sx: LR + 0.2, sy: 0.08, sz: LR + 0.2 })), wm);
      batchPart(P(GEO.ring, PALETTE.steelDark, M(LX, GY + 0.18, LZ, { s: LR + 0.18, rx: Math.PI / 2 }), false), wm);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; batchPart(P(GEO.cyl, PALETTE.steelDark, M(LX + Math.cos(a) * (LR + 0.18), GY + 0.09, LZ + Math.sin(a) * (LR + 0.18), { sx: 0.01, sy: 0.18, sz: 0.01 }), false), wm); }
      batchPart(P(GEO.cyl, PALETTE.windowWarm, M(LX, GY + 0.28, LZ, { sx: LR * 0.8, sy: 0.42, sz: LR * 0.8 }), false, { unlit: true }), wm);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; batchPart(P(GEO.box, PALETTE.steelDark, M(LX + Math.cos(a) * LR * 0.82, GY + 0.28, LZ + Math.sin(a) * LR * 0.82, { sx: 0.025, sy: 0.44, sz: 0.025 }), false), wm); }
      batchPart(P(GEO.cone, PALETTE.capRed, M(LX, GY + 0.72, LZ, { sx: LR + 0.04, sy: 0.5, sz: LR + 0.04 })), wm);
      roofCourses(wm, { x: LX, y: GY + 0.48, z: LZ, r: LR + 0.04, h: 0.5, color: PALETTE.capRed, kind: 'cone', rings: 2 });
      batchPart(P(GEO.sphereLo, PALETTE.gold, M(LX, GY + 1.0, LZ, { s: 0.05 })), wm);
      glow(cx + LX, GY + 0.3, cz + LZ, { w: 1.4, h: 1.4 });
      // the turning beam: a long faint wedge of light
      const beamMat = new THREE.MeshBasicMaterial({ color: PALETTE.windowWarm, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const beamGeo = new THREE.ConeGeometry(0.5, 4.2, 12, 1, true); beamGeo.translate(0, -2.1, 0); beamGeo.rotateX(Math.PI / 2);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(cx + LX, GY + 0.3, cz + LZ);
      scene.add(beam);
      animated.push({ update(t) {
        beam.rotation.y = t * 0.9;
        beam.material.opacity = st.state === 2 ? 0.06 : 0.22;
      } });
      // the keeper's cottage, door to the south
      const CX = gx, CZ = 0.55, CW = 1.0, CD = 0.8, CH = 0.55;
      batchPart(P(GEO.box, PALETTE.plaster, M(CX, CH / 2, CZ, { sx: CW, sy: CH, sz: CD })), wm);
      batchPart(P(GEO.box, PALETTE.stoneDark, M(CX, 0.04, CZ, { sx: CW + 0.05, sy: 0.08, sz: CD + 0.05 })), wm);
      LC.gableRoof(kit, wm, { x: CX, y: CH, z: CZ, len: CW + 0.1, span: CD / 2 + 0.08, rise: 0.36, color: PALETTE.slate });
      batchPart(P(GEO.box, PALETTE.stoneDark, M(CX - 0.32, CH + 0.3, CZ - 0.1, { sx: 0.1, sy: 0.3, sz: 0.1 })), wm);
      batchPart(P(GEO.box, 0x2b211b, M(gx, 0.25, CZ + CD / 2 + 0.005, { sx: 0.24, sy: 0.46, sz: 0.02 }), false), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(gx, 0.24, CZ + CD / 2 + 0.015, { sx: 0.2, sy: 0.42, sz: 0.02 }), false), wm);
      LC.windows(kit, wm, [cx, cz], [[CX + 0.3, 0.3, CZ + CD / 2, 'z'], [CX - 0.3, 0.3, CZ + CD / 2, 'z'], [LX, 2.1, LZ + R * 0.72, 'z']], st);
      LC.chimneySmoke(kit, [[cx + CX - 0.32, CH + 0.5, cz + CZ - 0.1]]);
      // the King's banner on a mast by the cottage
      batchPart(P(GEO.cyl, PALETTE.wood, M(-0.95, 0.9, 0.85, { sx: 0.025, sy: 1.8, sz: 0.025 })), wm);
      LC.banner(kit, cx - 0.95, 1.6, cz + 0.85, { w: 0.56, h: 0.32, field: PALETTE.tunic, stripe: PALETTE.gold, emblem: PALETTE.heraldWhite, stateRef: st });
      // rocks round the headland
      const rng = srand(77);
      for (let i = 0; i < 8; i++) {
        const a = rng() * Math.PI * 2, d = 1.25 + rng() * 0.2;
        if (Math.sin(a) > 0.5) continue;   // keep the road side clear
        const r = kit.rockParts(rng, false);
        for (const p of r.parts) batchPart(p, M(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d));
      }
      LC.damage(kit, {
        stateRef: st,
        cracks: [[cx + LX + 0.1, 1.4, cz + LZ + R * 0.8, 0.16, 0.6, 'z'], [cx + CX + 0.1, 0.3, cz + CZ + CD / 2 + 0.01, 0.16, 0.3, 'z'], [cx + LX, 2.4, cz + LZ + R * 0.7, 0.14, 0.4, 'z']],
        rubble: [[cx - 1.3, cz + 1.2], [cx + 1.3, cz + 1.1], [cx + 1.35, cz - 1.1], [cx - 1.2, cz - 1.0]],
        fire: [cx + CX, CH + 0.3, cz + CZ], smoke: [cx + CX, CH + 0.6, cz + CZ], burst: [cx + gx, 0.5, cz + 1.3],
      });
    }

    LC.stream(kit, { seed: 71, speed: 0.6, shallow: PALETTE.water, deep: PALETTE.waterDeep, foam: PALETTE.waterFoam });
    buildPier();
    buildCog();
    buildLighthouse();
    LC.knaveCamps(kit);
    const endR = level.endpoint.cells.map(([, r]) => r), endC = level.endpoint.cells.map(([c]) => c);
    LC.countryside(kit, {
      seed: 7171,
      mix: [[6, 'tree'], [6, 'bush'], [8, 'tuft'], [12, 'marram'], [7, 'rock'], [5, 'boat'], [4, 'net'], [4, 'pots'], [4, 'barrel'], [4, 'cottage'], [3, 'fence'], [20, null]],
      edge: [[26, 'tree'], [12, 'rock'], [10, 'marram'], [8, 'cottage'], [6, 'boat'], [38, null]],
      keepLow: (c, r) => c >= Math.min(...endC) - 1 && c <= Math.max(...endC) + 1 && r <= Math.max(...endR) + 1,
    });
  }

  // the shore road and the dune path meet at (10,6), cross the inlet on the
  // pier bridge at (12,6) and run east to climb the headland at (18,6)
  const tail = [[10, 6], [14, 6], [18, 6], [18, 4]];
  return {
    id: 'saltmarsh-quay',
    index: 7,
    name: 'Saltmarsh Quay',
    subtitle: 'Corsairs on the beaches. Keep the lighthouse burning.',
    map: { x: 346, y: 280, reclaim: 95, icon: 'lighthouse' },
    grid: { cols: 22, rows: 13 },
    spawn: [0, 2],
    routes: [
      { id: 'shore', waypoints: [[0, 2], [4, 2], [4, 6], [7, 6], ...tail] },
      { id: 'dunes', waypoints: [[2, 12], [2, 10], [6, 10], [6, 8], [10, 8], ...tail] },
      { id: 'beach', waypoints: [[14, 12], [14, 10], [16, 10], [16, 12], [20, 12], [20, 9], [15, 9], [15, 6], [18, 6], [18, 4]] },
    ],
    chokepoint: { cell: [12, 6], streamCol: 12 },
    endpoint: {
      name: 'the Saltmarsh lighthouse', properName: 'The Saltmarsh Lighthouse',
      cells: [[17, 1], [18, 1], [19, 1], [17, 2], [18, 2], [19, 2], [17, 3], [18, 3], [19, 3]], gateCell: [18, 3],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [6, 13.5], radiusOut: { x: 9, z: 6 }, radiusIn: 1.2, falloffWidth: 0.5, motes: { embers: 18, dust: 20 },
      backdrop: 0x2d4a58, groundMeadow: 0x9cb563, groundMeadowDark: 0x84a052, ambient: 0.4, fill: 0xbfe0ee, fillIntensity: 0.18 },
    spawnBlockedText: "That's the corsairs' landing. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 165, startLives: 20, starThresholds: [16, 8],
    tipTile: [3, 3],
    endScreenText: {
      3: () => 'Thirteen waves, a wyvern sent back to the deep, and the lamp never flickered. The fleet comes home.',
      2: (s) => `The wyvern is gone and the lamp still burns, with ${s.lives} lives to spare. Saltmarsh holds.`,
      1: (s) => `The lighthouse is battered, but its lamp still burns, with ${s.lives} lives left.`,
      lose: (s) => `The lighthouse fell on wave ${s.wave}. The pier bridge covers two roads; the beach track needs its own towers on the headland. Save gold for the wyvern.`,
    },
    buildScene,
  };
})();
