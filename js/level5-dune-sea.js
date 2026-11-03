// ===================================================================
// LEVEL 5 — The Dune Sea
// Out in the Dune Sea the moisture farm pulls water out of thin air. The
// pods landed in the southern dunes. The caravan road and the dry wash
// wind north and meet before the pipeline that bridges the river of
// quicksand. Something very big swims under the sand on the last wave.
// ===================================================================
const LEVEL_5 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: "Up the Caravan Road", flavor: "Blob drones on the winding caravan road.", groups: [g('grunt', 5, 3.2, 0, 'caravan', 0)] },
    { name: "The Dry Wash", flavor: "The wash from the south opens. It dives into an old worm tunnel and comes out north of the quicksand, past the bridge.", groups: [g('grunt', 5, 2.0, 0, 'caravan', 0), g('grunt', 4, 2.4, 0, 'wash', 4)] },
    { name: "Hot Feet", flavor: "Crawlers race up the wash.", groups: [g('grunt', 5, 1.5, 0, 'caravan', 0), g('trickster', 5, 0.9, 0, 'wash', 4)] },
    { name: "Shell in the Sand", flavor: "A brute on the caravan road.", groups: [g('grunt', 6, 1.2, 0, 'wash', 0), g('troll', 1, 1, 0, 'caravan', 2), g('grunt', 4, 1.4, 0, 'caravan', 6)] },
    { name: "Heat Shimmer", flavor: "Saucers over the wash.", groups: [g('bat', 3, 1.3, 0, 'wash', 0), g('grunt', 6, 1.1, 0, 'caravan', 3)] },
    { name: "Both Trails", flavor: "Both roads at once.", groups: [g('grunt', 6, 1.0, 0, 'caravan', 0), g('grunt', 6, 1.0, 0, 'wash', 0), g('trickster', 5, 0.6, 0, 'wash', 6)] },
    { name: "Shells and Sand", flavor: "Brutes on the caravan road, crawlers in the wash.", groups: [g('troll', 2, 2.8, 0, 'caravan', 0), g('trickster', 7, 0.7, 0, 'wash', 2)] },
    { name: "Mirage", flavor: "A flight of saucers.", groups: [g('bat', 5, 0.9, 0, 'caravan', 0), g('trickster', 7, 0.6, 0, 'wash', 3), g('grunt', 5, 1.0, 0, 'caravan', 6)] },
    { name: "The Press", flavor: "Road after road.", groups: [g('troll', 2, 2.6, 0, 'wash', 0), g('grunt', 8, 0.8, 0, 'caravan', 1), g('trickster', 6, 0.6, 0, 'wash', 6), g('bat', 4, 1.0, 0, 'caravan', 10)] },
    { name: "Pincer", flavor: "Brutes on both roads, saucers in the wash.", groups: [g('troll', 2, 2.6, 0, 'caravan', 0), g('troll', 1, 2.4, 0, 'wash', 3), g('bat', 5, 0.9, 0, 'wash', 6), g('grunt', 6, 0.9, 0, 'caravan', 11)] },
    { name: "Sandstorm", flavor: "The dunes are moving.", groups: [g('grunt', 10, 0.65, 0, 'caravan', 0), g('trickster', 9, 0.5, 0, 'wash', 2), g('troll', 3, 2.2, 0, 'caravan', 4), g('bat', 5, 0.85, 0, 'wash', 8)] },
    { name: "Dry Season", flavor: "Brutes, crawlers and saucers all at once.", groups: [g('troll', 3, 2.2, 0, 'caravan', 0), g('trickster', 11, 0.45, 0, 'wash', 0), g('bat', 7, 0.6, 0, 'caravan', 0)] },
    { name: "The Sand Worm", flavor: "The ground shakes. A Sand Worm swims up the caravan road. Every tower can hit it.", groups: [g('grunt', 6, 0.9, 0, 'wash', 0), g('bat', 4, 1.0, 0, 'caravan', 1), g('sandworm', 1, 1, 0, 'caravan', 6)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, srand, scene, animated, puff, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;
    LC.standardScene(kit, { channel: 'quicksand', bridge: 'pipe', outpost: 'moisture', flag: PALETTE.hazard, seed: 505, mix: [[6, 'tree'], [14, 'rock'], [8, 'crystal'], [6, 'crater'], [4, 'tuft'], [4, 'bush'], [3, 'barrel'], [3, 'cart'], [3, 'solar'], [2, 'well'], [24, null]], edge: [[16, 'rock'], [12, 'crystal'], [8, 'tree'], [6, 'crater'], [30, null]] });
    // the pipeline running east and west from the bridge along the quicksand, on little trestles
    const sz = worldZ(level.chokepoint.streamRow), bx = worldX(level.chokepoint.cell[0]);
    for (let c = -2; c < level.grid.cols + 2; c++) {
      const x = worldX(c); if (Math.abs(x - bx) < 0.6) continue;
      batchPart(P(GEO.cyl, PALETTE.steel, M(x, 0.22, sz - 0.62, { sx: 0.1, sy: 1.0, sz: 0.1, rz: Math.PI / 2 }), false));
      batchPart(P(GEO.box, PALETTE.steelDark, M(x, 0.08, sz - 0.62, { sx: 0.04, sy: 0.16, sz: 0.04 }), false));
    }
  }

  const tail = [[9, 9], [9, 5], [13, 5], [13, 2], [6, 2], [6, 5], [2, 5]];
  return {
    id: 'dune-sea',
    index: 5,
    name: 'The Dune Sea',
    subtitle: 'Two roads across the sand. Mind the quicksand.',
    map: { x: 300, y: 214, reclaim: 98, icon: 'vaporator' },
    grid: { cols: 20, rows: 13 },
    spawn: [2, 12],
    routes: [
      { id: 'caravan', waypoints: [[2, 12], [2, 10], [6, 10], [6, 9], ...tail] },
      // the wash runs into an old worm tunnel at [16, 10] and comes out north of the quicksand at [18, 5]
      { id: 'wash',    waypoints: [[16, 12], [16, 10], 'warp', [18, 5], [18, 2], [13, 2], [6, 2], [6, 5], [2, 5]] },
    ],
    chokepoint: { cell: [9, 7], streamRow: 7 },
    endpoint: {
      name: 'the moisture farm', properName: 'The Moisture Farm',
      cells: [[2, 2], [3, 2], [2, 3], [3, 3], [2, 4], [3, 4]], gateCell: [2, 4],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [9, 12.6], radiusOut: { x: 9, z: 3.2 }, radiusIn: 1.1, falloffWidth: 0.42, backdrop: 0x2a1c34, groundMeadow: 0xc8a272, groundMeadowDark: 0xb08a5c, sky: 0xfff0e0, motes: { dust: 30, embers: 14 } },
    spawnBlockedText: "That's a landing pod. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 165, startLives: 20, starThresholds: [16, 8],
    tipTile: [3, 11],
    endScreenText: {
      3: () => 'Not a drop lost. The vaporators hum on across the dunes.',
      2: (s) => `The moisture farm holds with ${s.lives} lives to spare. There is sand in everything.`,
      1: (s) => `The moisture farm holds with ${s.lives} lives left. Water is rationed for a while.`,
      lose: (s) => `The moisture farm fell on wave ${s.wave}. Both roads meet before the pipeline: build there, and save up for the worm. Everything can hit it.`,
    },
    buildScene,
  };
})();
