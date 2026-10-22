// ===================================================================
// LEVEL 3 — St Wendel's Abbey
// The Baron's warlock has crept into the abbey lands from three sides:
// down the Pilgrims' Way switchback from the hills, along Mill Lane from
// the west and up the Fen Causeway from the marsh. All three roads meet
// before the covered bridge over the mill-race. The warlock's prize is the
// abbey's own stone gargoyles, and their lord wakes on the last wave.
// ===================================================================
const LEVEL_3 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: 'Down Mill Lane',      flavor: 'Brigands on the lane from the west. One road so far.',                       groups: [g('grunt', 5, 3.0, 0, 'mill')] },
    { name: 'Pilgrims, Not',       flavor: 'Something comes down the Pilgrims’ Way. It is not pilgrims.',            groups: [g('grunt', 5, 2.0, 0, 'mill', 0), g('grunt', 4, 2.2, 0, 'pilgrims', 3)] },
    { name: 'Through the Fen',     flavor: 'Cutpurses splash up the short Fen Causeway. It is a quick road.',             groups: [g('grunt', 5, 1.6, 0, 'pilgrims', 0), g('trickster', 5, 1.0, 0, 'fen', 4)] },
    { name: 'The Long Way Down',   flavor: 'A Black Knight takes the switchback. Towers between its turns hit it twice.', groups: [g('grunt', 5, 1.3, 0, 'mill', 0), g('troll', 1, 1, 0, 'pilgrims', 2), g('grunt', 4, 1.5, 0, 'fen', 8)] },
    { name: 'The Stones Stir',     flavor: 'Gargoyles from the abbey roof. The Magus and the Longbowmen reach them.',     groups: [g('bat', 3, 1.3, 0, 'fen', 0), g('grunt', 7, 1.0, 0, 'mill', 3)] },
    { name: 'Three Fronts',        flavor: 'Every road at once. Find the spots that cover two.',                         groups: [g('grunt', 5, 1.1, 0, 'mill', 0), g('grunt', 4, 1.1, 0, 'pilgrims', 0), g('grunt', 3, 1.2, 0, 'fen', 2)] },
    { name: 'Iron and Speed',      flavor: 'Knights down the switchback, Cutpurses through the fen.',                    groups: [g('troll', 2, 2.8, 0, 'pilgrims', 0), g('trickster', 6, 0.7, 0, 'fen', 3)] },
    { name: 'Vespers',             flavor: 'Gargoyles over the lane, Cutpurses in the reeds, brigands on the hill.',      groups: [g('bat', 4, 1.0, 0, 'mill', 0), g('trickster', 6, 0.65, 0, 'fen', 4), g('grunt', 5, 1.0, 0, 'pilgrims', 6)] },
    { name: 'The Press',           flavor: 'The warlock leans on every road in turn.',                                  groups: [g('troll', 2, 2.6, 0, 'pilgrims', 0), g('grunt', 8, 0.8, 0, 'mill', 1), g('trickster', 5, 0.65, 0, 'fen', 6), g('bat', 4, 1.0, 0, 'mill', 10)] },
    { name: 'Pincer',              flavor: 'Knights on both long roads, gargoyles over the fen.',                       groups: [g('troll', 2, 2.4, 0, 'pilgrims', 0), g('troll', 1, 2.4, 0, 'mill', 2), g('bat', 6, 0.8, 0, 'fen', 4), g('grunt', 6, 0.8, 0, 'fen', 9)] },
    { name: 'Compline',            flavor: 'The bell tolls. Hold the covered bridge.',                                   groups: [g('grunt', 9, 0.65, 0, 'mill', 0), g('trickster', 8, 0.5, 0, 'fen', 2), g('troll', 3, 2.2, 0, 'pilgrims', 3), g('bat', 5, 0.85, 0, 'mill', 8)] },
    { name: 'The Gargoyle Lord',   flavor: 'The warlock wakes the Gargoyle Lord and its brood. It flies: only the Magus and the Longbowmen can reach it.', groups: [g('bat', 5, 1.0, 0, 'pilgrims', 0), g('grunt', 9, 0.75, 0, 'mill', 1), g('stonelord', 1, 1, 0, 'pilgrims', 7)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, toon, unlit, srand, scene, animated, puff,
      masonry, towerCourses, roofCourses, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;

    // The covered bridge: a plank deck on stone piers under a shingled
    // gable roof, open lattice sides so you can see the road through it.
    function buildCoveredBridge() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      for (const s of [-1, 1]) batchPart(P(GEO.box, PALETTE.stoneDark, M(s * 0.56, -0.08, 0, { sx: 0.18, sy: 0.22, sz: 1.0 })), wm);
      for (let i = 0; i < 7; i++) batchPart(P(GEO.box, i % 2 ? PALETTE.woodLight : PALETTE.wood, M(-0.54 + i * 0.18, 0.03, 0, { sx: 0.17, sy: 0.05, sz: 0.9 })), wm);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) batchPart(P(GEO.box, PALETTE.wood, M(-0.5 + i * 0.333, 0.38, s * 0.44, { sx: 0.05, sy: 0.7, sz: 0.05 })), wm);
        batchPart(P(GEO.box, PALETTE.woodLight, M(0, 0.2, s * 0.44, { sx: 1.1, sy: 0.05, sz: 0.04 }), false), wm);
        for (let i = 0; i < 3; i++) batchPart(P(GEO.box, PALETTE.wood, M(-0.33 + i * 0.333, 0.38, s * 0.445, { sx: 0.04, sy: 0.42, sz: 0.02, rz: i % 2 ? 0.7 : -0.7 }), false), wm);
      }
      LC.gableRoof(kit, wm, { y: 0.74, len: 1.2, span: 0.56, rise: 0.36, color: PALETTE.roofTile, gable: PALETTE.wood });
    }

    // The abbey church: a long nave with its gable end to the road, a rose
    // window of stained glass over the great door, buttresses down the east
    // side, a cloister wall to the west, and a bell tower with a swinging
    // bell. Stone gargoyles crouch on the eaves, the warlock's prize.
    function buildAbbey() {
      const [cx, cz] = LC.endpointCenter(kit);
      const wm = M(cx, 0, cz);
      const st = { state: 0 };
      const gx = worldX(level.endpoint.gateCell[0]) - cx;
      const NW = 1.3, NH = 1.35, ND = 2.4, NZ = -0.05, front = NZ + ND / 2;
      batchPart(P(GEO.circle, kit.lerpColor(PALETTE.cobble, PALETTE.meadow, 0.3).getHex(), M(0, 0.008, 0.25, { sx: 1.45, sz: 1.6 }), false), wm);
      batchPart(P(GEO.box, PALETTE.stone, M(0, NH / 2, NZ, { sx: NW, sy: NH, sz: ND })), wm);
      batchPart(P(GEO.box, PALETTE.stoneDark, M(0, 0.08, NZ, { sx: NW + 0.08, sy: 0.16, sz: ND + 0.08 })), wm);
      LC.gableRoof(kit, wm, { y: NH, z: NZ, len: ND + 0.1, span: NW / 2 + 0.1, rise: 0.75, color: PALETTE.slate, gable: PALETTE.stone, ry: Math.PI / 2 });
      masonry(wm, { face: 'z', at: front, u0: -NW / 2, u1: NW / 2, y0: 0.16, y1: NH, seed: 31, holes: [[gx, 0.45, 0.6, 0.9], [0, 1.15, 0.5, 0.5]] });
      masonry(wm, { face: 'x', at: NW / 2, u0: NZ - ND / 2, u1: front, y0: 0.16, y1: NH, seed: 32, holes: [[0.1, 0.8, 0.3, 0.5], [-0.75, 0.8, 0.3, 0.5]] });
      // buttresses down the east side
      for (const u of [-0.95, -0.3, 0.4]) batchPart(P(GEO.box, PALETTE.stoneDark, M(NW / 2 + 0.08, 0.5, NZ + u, { sx: 0.16, sy: 1.0, sz: 0.14 })), wm);
      // the great door (the gate), a pointed arch
      batchPart(P(GEO.box, 0x2b211b, M(gx, 0.36, front + 0.005, { sx: 0.5, sy: 0.72, sz: 0.04 }), false), wm);
      batchPart(P(GEO.cone, 0x2b211b, M(gx, 0.82, front + 0.005, { sx: 0.25, sy: 0.24, sz: 0.02 }), false), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(gx, 0.34, front + 0.025, { sx: 0.42, sy: 0.66, sz: 0.03 }), false), wm);
      batchPart(P(GEO.box, PALETTE.steelDark, M(gx, 0.34, front + 0.045, { sx: 0.012, sy: 0.66, sz: 0.01 }), false), wm);
      batchPart(P(GEO.box, PALETTE.stoneDark, M(gx, 0.05, front + 0.2, { sx: 0.8, sy: 0.1, sz: 0.26 })), wm);
      // the rose window: stained glass petals in a stone ring, glowing
      batchPart(P(GEO.torus, PALETTE.stoneDark, M(0, 1.15, front + 0.02, { s: 0.24 }), false), wm);
      batchPart(P(GEO.circle, PALETTE.tunic, M(0, 1.15, front + 0.012, { s: 0.23, rx: Math.PI / 2 }), false, { unlit: true }), wm);
      batchPart(P(GEO.petals, PALETTE.magicGlow, M(0, 1.15, front + 0.018, { s: 0.2, rx: Math.PI / 2 }), false, { unlit: true }), wm);
      batchPart(P(GEO.bead, PALETTE.gold, M(0, 1.15, front + 0.03, { s: 0.05 }), false, { unlit: true }), wm);
      glow(cx, 1.15, cz + front + 0.04, { w: 0.9, h: 0.9 });
      // the bell tower at the back corner, with an open belfry and a slate spire
      const tx = 0.75, tz = -0.95, TW = 0.72, TH = 2.6;
      batchPart(P(GEO.box, PALETTE.stone, M(tx, TH / 2, tz, { sx: TW, sy: TH, sz: TW })), wm);
      masonry(wm, { face: 'z', at: tz + TW / 2, u0: tx - TW / 2, u1: tx + TW / 2, y0: NH, y1: TH - 0.6, seed: 33 });
      batchPart(P(GEO.box, 0x241c18, M(tx, TH - 0.32, tz + TW / 2 + 0.005, { sx: 0.34, sy: 0.4, sz: 0.02 }), false), wm);
      batchPart(P(GEO.box, 0x241c18, M(tx + TW / 2 + 0.005, TH - 0.32, tz, { sx: 0.02, sy: 0.4, sz: 0.34 }), false), wm);
      batchPart(P(GEO.box, PALETTE.stoneDark, M(tx, TH, tz, { sx: TW + 0.1, sy: 0.08, sz: TW + 0.1 })), wm);
      const pyr = new THREE.ConeGeometry(1, 1, 4).toNonIndexed();
      batchPart(P(pyr, PALETTE.slate, M(tx, TH + 0.6, tz, { sx: 0.62, sy: 1.2, sz: 0.62, ry: Math.PI / 4 })), wm);
      batchPart(P(GEO.cyl, PALETTE.gold, M(tx, TH + 1.32, tz, { sx: 0.015, sy: 0.28, sz: 0.015 }), false), wm);
      batchPart(P(GEO.box, PALETTE.gold, M(tx, TH + 1.36, tz, { sx: 0.14, sy: 0.02, sz: 0.02 }), false), wm);
      const bell = liveProp([
        P(GEO.cylTaper, PALETTE.gold, M(0, -0.12, 0, { sx: 0.12, sy: 0.18, sz: 0.12, rx: Math.PI })),
        P(GEO.bead, PALETTE.acornCap, M(0, -0.24, 0, { s: 0.035 }), false),
      ], cx + tx, TH - 0.12, cz + tz + 0.2);
      // the cloister wall on the west, low arches and a walk inside
      const CX = -NW / 2 - 0.42;
      batchPart(P(GEO.box, PALETTE.stone, M(CX, 0.3, NZ + 0.1, { sx: 0.12, sy: 0.6, sz: 2.0 })), wm);
      for (let i = 0; i < 4; i++) {
        batchPart(P(GEO.box, 0x3a302a, M(CX - 0.065, 0.24, NZ - 0.65 + i * 0.5, { sx: 0.01, sy: 0.3, sz: 0.24 }), false), wm);
        batchPart(P(GEO.cyl, 0x3a302a, M(CX - 0.065, 0.39, NZ - 0.65 + i * 0.5, { sx: 0.12, sy: 0.01, sz: 0.12, rz: Math.PI / 2 }), false), wm);
      }
      batchPart(P(GEO.box, PALETTE.roofTile, M(CX + 0.18, 0.66, NZ + 0.1, { sx: 0.5, sy: 0.04, sz: 2.05, rz: -0.35 })), wm);
      // stone gargoyles crouched on the eaves, looking out
      const garg = (x, y, z, ry) => {
        batchPart(P(GEO.sphereLo, PALETTE.bat, M(x, y, z, { sx: 0.08, sy: 0.09, sz: 0.1, ry })), wm);
        batchPart(P(GEO.sphereLo, PALETTE.bat, M(x + Math.sin(ry) * 0.08, y + 0.07, z + Math.cos(ry) * 0.08, { s: 0.06 })), wm);
        batchPart(P(GEO.box, PALETTE.batDark, M(x - Math.cos(ry) * 0.07, y + 0.05, z + Math.sin(ry) * 0.07, { sx: 0.1, sy: 0.015, sz: 0.08, ry, rz: 0.6 }), false), wm);
        batchPart(P(GEO.box, PALETTE.batDark, M(x + Math.cos(ry) * 0.07, y + 0.05, z - Math.sin(ry) * 0.07, { sx: 0.1, sy: 0.015, sz: 0.08, ry, rz: -0.6 }), false), wm);
      };
      garg(-NW / 2 - 0.02, NH + 0.06, front - 0.02, 0.4);
      garg(NW / 2 + 0.02, NH + 0.06, front - 0.02, -0.4);
      garg(tx + TW / 2, TH + 0.08, tz + TW / 2, 0.8);
      // a few headstones and a herb bed by the cloister
      for (let i = 0; i < 4; i++) {
        const hx = -1.2 + (i % 2) * 0.28, hz = 0.85 + Math.floor(i / 2) * 0.32;
        batchPart(P(GEO.box, PALETTE.stoneDark, M(hx, 0.1, hz, { sx: 0.12, sy: 0.2, sz: 0.04, rz: (i - 1.5) * 0.08 })), wm);
      }
      const pole = new THREE.Mesh(GEO.cyl, toon(PALETTE.wood));
      pole.position.set(cx - 0.5, NH + 1.1, cz + NZ + 0.6); pole.scale.set(0.025, 0.9, 0.025);
      scene.add(pole);
      LC.banner(kit, cx - 0.5, NH + 1.4, cz + NZ + 0.6, { w: 0.56, h: 0.36, field: PALETTE.heraldWhite, stripe: PALETTE.gold, emblem: PALETTE.capRed, stateRef: st });
      LC.windows(kit, wm, [cx, cz], [[NW / 2, 0.8, 0.05, 'x'], [NW / 2, 0.8, -0.8, 'x'], [-0.4, 0.55, front, 'z'], [0.4, 0.55, front, 'z']], st);
      // the bell rings when the abbey is hurt, and swings gently otherwise
      let ring = 0;
      animated.push({
        update(t, dt) {
          ring = Math.max(0, ring - dt * 0.6);
          bell.rotation.x = Math.sin(t * (2 + ring * 6)) * (0.08 + ring * 0.6);
        },
      });
      LC.damage(kit, {
        stateRef: st,
        cracks: [[cx + 0.35, 0.6, cz + front + 0.01, 0.2, 0.6, 'z'], [cx - 0.4, 1.0, cz + front + 0.01, 0.16, 0.45, 'z'], [cx + NW / 2 + 0.01, 0.9, cz + NZ - 0.4, 0.2, 0.6, 'x']],
        rubble: [[cx - 1.25, cz + 0.2], [cx + 1.05, cz + 1.2], [cx - 0.9, cz + 1.35], [cx + 1.2, cz - 0.2], [cx + 0.5, cz + 1.4]],
        fire: [cx + 0.1, NH + 0.3, cz + NZ + 0.4], smoke: [cx, NH + 0.6, cz + NZ], burst: [cx + gx, 0.6, cz + front + 0.2],
        onState: () => { ring = 1; },
      });
    }

    // Orchard rows and kitchen gardens tended by the monks.
    kit.extraRecipes = (rng) => ({
      orchard: () => {
        const t = kit.treeParts(rng);
        t.parts = t.parts.map((p) => (p.color === PALETTE.capRed || p.color === PALETTE.flowerYellow ? { ...p, color: PALETTE.capRed } : p));
        return t;
      },
      beds: () => ({ parts: [0, 1, 2].map((i) => P(GEO.box, i % 2 ? PALETTE.meadowLight : PALETTE.earth, M(0, 0.03, -0.25 + i * 0.25, { sx: 0.6, sy: 0.06, sz: 0.14 }), false)), radius: 0 }),
    });
    LC.stream(kit, { seed: 71, speed: 1.4, stripe: 0.6 });
    buildCoveredBridge();
    buildAbbey();
    LC.knaveCamps(kit);
    const endC = level.endpoint.cells.map(([c]) => c);
    LC.countryside(kit, {
      seed: 3133,
      mix: [[12, 'tree'], [12, 'orchard'], [10, 'bush'], [12, 'tuft'], [10, 'flower'], [5, 'beds'], [4, 'hay'], [5, 'fence'], [3, 'cottage'], [5, 'rock'], [2, 'well'], [18, null]],
      edge: [[40, 'tree'], [18, 'orchard'], [10, 'bush'], [4, 'cottage'], [6, 'rock'], [18, null]],
      keepLow: (c, r) => c >= Math.min(...endC) - 1 && r >= 3 && r <= 9,
    });
  }

  const tail = [[16, 6], [16, 8], [18, 8]];
  return {
    id: 'st-wendels',
    index: 3,
    name: "St Wendel's Abbey",
    subtitle: 'Three roads, one bridge, and gargoyles that wake.',
    map: { x: 486, y: 232, reclaim: 105, icon: 'abbey' },
    grid: { cols: 20, rows: 13 },
    spawn: [0, 7],
    // Mill Lane from the west, the Pilgrims' Way switchback from the hills
    // and the Fen Causeway from the marsh; all meet on row 6 before the bridge
    routes: [
      { id: 'mill', waypoints: [[0, 7], [3, 7], [3, 9], [7, 9], [7, 6], ...tail] },
      { id: 'pilgrims', waypoints: [[6, 0], [6, 2], [2, 2], [2, 4], [10, 4], [10, 6], ...tail] },
      { id: 'fen', waypoints: [[6, 12], [6, 11], [10, 11], [10, 8], [12, 8], [12, 6], ...tail] },
    ],
    chokepoint: { cell: [14, 6], streamCol: 14 },
    endpoint: {
      name: "St Wendel's Abbey", properName: "St Wendel's Abbey",
      cells: [[17, 5], [18, 5], [19, 5], [17, 6], [18, 6], [19, 6], [17, 7], [18, 7], [19, 7]], gateCell: [18, 7],
    },
    cobbleTailCells: 4,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [1, 6], radiusOut: { x: 7, z: 7.5 }, radiusIn: 1.25, falloffWidth: 0.5, motes: { embers: 30, fireflies: 14 },
      groundMeadow: 0x84ad52, groundMeadowDark: 0x6c9642, ambient: 0.37 },
    spawnBlockedText: "That's the Baron's camp. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 170, startLives: 20, starThresholds: [16, 8],
    tipTile: [2, 6],
    endScreenText: {
      3: () => 'Three roads, twelve waves and not a pane of glass broken. The monks will sing of this.',
      2: (s) => `Twelve waves turned back on three roads with ${s.lives} lives to spare. The abbey stands.`,
      1: (s) => `Twelve waves turned back with ${s.lives} lives left. The bell still rings, just.`,
      lose: (s) => `The abbey fell on wave ${s.wave}. Build between the switchback's turns, watch the horn posts, and keep the Magus and Longbowmen ready for the Gargoyle Lord.`,
    },
    buildScene,
  };
})();
