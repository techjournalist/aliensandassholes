// ===================================================================
// LEVEL 3 — Glowshroom Grove
// The colony's research lab sits in a grove of giant glowing mushrooms.
// Three roads wind in through the caps: the lane from the west, the ridge
// path that switchbacks down from the north and the fen track from the
// south. They meet before a fallen mushroom stalk over the goo creek.
// The Hive Queen stalks in on the last wave.
// ===================================================================
const LEVEL_3 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: "Down the Lane", flavor: "Blob drones wander in from the west.", groups: [g('grunt', 5, 3.0, 0, 'lane', 0)] },
    { name: "The Ridge Path", flavor: "Something is coming down the switchback from the north.", groups: [g('grunt', 5, 2.0, 0, 'lane', 0), g('grunt', 4, 2.2, 0, 'ridge', 3)] },
    { name: "Through the Fen", flavor: "Crawlers in the fen.", groups: [g('grunt', 5, 1.6, 0, 'ridge', 0), g('trickster', 5, 1.0, 0, 'fen', 4)] },
    { name: "The Long Way Down", flavor: "A brute picks its way down the ridge.", groups: [g('grunt', 5, 1.3, 0, 'lane', 0), g('troll', 1, 1, 0, 'ridge', 2), g('grunt', 4, 1.5, 0, 'fen', 8)] },
    { name: "Spore Lights", flavor: "Saucers drift over the fen.", groups: [g('bat', 3, 1.3, 0, 'fen', 0), g('grunt', 7, 1.0, 0, 'lane', 3)] },
    { name: "Three Fronts", flavor: "All three roads at once.", groups: [g('grunt', 5, 1.1, 0, 'lane', 0), g('grunt', 4, 1.1, 0, 'ridge', 0), g('grunt', 3, 1.2, 0, 'fen', 2)] },
    { name: "Shell and Scuttle", flavor: "Brutes on the ridge, crawlers in the fen.", groups: [g('troll', 2, 2.8, 0, 'ridge', 0), g('trickster', 6, 0.7, 0, 'fen', 3)] },
    { name: "Glowfall", flavor: "Saucers in the caps, crawlers underneath.", groups: [g('bat', 4, 1.0, 0, 'lane', 0), g('trickster', 6, 0.65, 0, 'fen', 4), g('grunt', 5, 1.0, 0, 'ridge', 6)] },
    { name: "The Press", flavor: "One road after another.", groups: [g('troll', 2, 2.6, 0, 'ridge', 0), g('grunt', 8, 0.8, 0, 'lane', 1), g('trickster', 5, 0.65, 0, 'fen', 6), g('bat', 4, 1.0, 0, 'lane', 10)] },
    { name: "Pincer", flavor: "Brutes from the north and west, saucers from the south.", groups: [g('troll', 2, 2.4, 0, 'ridge', 0), g('troll', 1, 2.4, 0, 'lane', 2), g('bat', 6, 0.8, 0, 'fen', 4), g('grunt', 6, 0.8, 0, 'fen', 9)] },
    { name: "Spore Storm", flavor: "The grove is crawling.", groups: [g('grunt', 9, 0.65, 0, 'lane', 0), g('trickster', 8, 0.5, 0, 'fen', 2), g('troll', 3, 2.2, 0, 'ridge', 3), g('bat', 5, 0.85, 0, 'lane', 8)] },
    { name: "The Hive Queen", flavor: "The Hive Queen comes down the lane, her guards around her. Everything can hit her.", groups: [g('bat', 4, 1.0, 0, 'ridge', 0), g('grunt', 8, 0.75, 0, 'fen', 1), g('hivequeen', 1, 1, 0, 'lane', 7)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, srand, scene, animated, puff, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;
    LC.standardScene(kit, { channel: 'goo', bridge: 'log', outpost: 'lab', flag: PALETTE.magic, seed: 303, mix: [[10, 'tree'], [14, 'mushroom'], [8, 'bigshroom'], [8, 'bush'], [10, 'tuft'], [10, 'flower'], [4, 'rock'], [3, 'crystal'], [2, 'barrel'], [2, 'greenhouse'], [12, null]], edge: [[22, 'bigshroom'], [18, 'tree'], [16, 'mushroom'], [6, 'crystal'], [6, 'bush'], [16, null]] });

  }

  const tail = [[10, 7], [15, 7], [15, 3], [18, 3], [18, 11], [16, 11]];
  return {
    id: 'glowshroom-grove',
    index: 3,
    name: 'Glowshroom Grove',
    subtitle: 'Three roads through the mushrooms. Guard the lab.',
    map: { x: 486, y: 214, reclaim: 98, icon: 'lab' },
    grid: { cols: 20, rows: 13 },
    spawn: [0, 6],
    routes: [
      { id: 'lane',  waypoints: [[0, 6], [3, 6], [3, 3], [7, 3], [7, 7], ...tail] },
      { id: 'ridge', waypoints: [[11, 0], [11, 2], [9, 2], [9, 5], [10, 5], ...tail] },
      { id: 'fen',   waypoints: [[0, 12], [6, 12], [6, 9], [10, 9], ...tail] },
    ],
    chokepoint: { cell: [13, 7], streamCol: 13 },
    endpoint: {
      name: 'the lab', properName: 'The Research Lab',
      cells: [[16, 8], [17, 8], [16, 9], [17, 9], [16, 10], [17, 10]], gateCell: [16, 10],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [2, 9], radiusOut: { x: 4, z: 7 }, radiusIn: 1.12, falloffWidth: 0.42, backdrop: 0x1a1430, groundMeadow: 0x3a9c96, groundMeadowDark: 0x2a7e80, ambient: 0.34, motes: { embers: 22, spores: 20, fireflies: 16 } },
    spawnBlockedText: "That's a landing pod. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 170, startLives: 20, starThresholds: [16, 8],
    tipTile: [2, 5],
    endScreenText: {
      3: () => 'Not one sample jar broken. The lab names a new mushroom after you.',
      2: (s) => `The lab holds with ${s.lives} lives to spare. Something escaped from a jar, but it was probably fine.`,
      1: (s) => `The lab holds with ${s.lives} lives left. The scientists are hiding under their desks.`,
      lose: (s) => `The lab fell on wave ${s.wave}. All three roads meet before the stalk bridge: build there, and keep a Cryo Beam by the creek for the saucers.`,
    },
    buildScene,
  };
})();
