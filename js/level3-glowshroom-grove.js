// ===================================================================
// LEVEL 3 — Glowshroom Grove
// The colony's research lab sits in a grove of giant glowing mushrooms.
// The pods came down in the north woods, so three roads wind south through
// the caps: the lane, the ridge path and the fen track. They meet before a
// fallen mushroom stalk over the goo creek that cuts the grove in two.
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

  const tail = [[10, 4], [10, 7], [4, 7], [4, 11], [14, 11]];
  return {
    id: 'glowshroom-grove',
    index: 3,
    name: 'Glowshroom Grove',
    subtitle: 'Three roads through the mushrooms. Guard the lab.',
    map: { x: 486, y: 214, reclaim: 98, icon: 'lab' },
    grid: { cols: 20, rows: 13 },
    spawn: [3, 0],
    routes: [
      { id: 'lane',  waypoints: [[3, 0], [3, 2], [6, 2], [6, 4], ...tail] },
      { id: 'ridge', waypoints: [[11, 0], [11, 2], [9, 2], [9, 4], ...tail] },
      { id: 'fen',   waypoints: [[17, 0], [17, 3], [14, 3], [14, 4], ...tail] },
    ],
    chokepoint: { cell: [10, 5], streamRow: 5 },
    // spore-puffer launch pads on the road below the creek: walkers that step on one fly for a moment
    jumpPads: [[7, 7], [8, 11]],
    endpoint: {
      name: 'the lab', properName: 'The Research Lab',
      cells: [[14, 8], [15, 8], [14, 9], [15, 9], [14, 10], [15, 10]], gateCell: [14, 10],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [10, -0.6], radiusOut: { x: 9, z: 3.2 }, radiusIn: 1.12, falloffWidth: 0.42, backdrop: 0x1a1430, groundMeadow: 0x7a58b0, groundMeadowDark: 0x644498, ambient: 0.34, motes: { embers: 22, spores: 20, fireflies: 16 } },
    spawnBlockedText: "That's a landing pod. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 170, startLives: 20, starThresholds: [16, 8],
    tipTile: [4, 3],
    endScreenText: {
      3: () => 'Not one sample jar broken. The lab names a new mushroom after you.',
      2: (s) => `The lab holds with ${s.lives} lives to spare. Something escaped from a jar, but it was probably fine.`,
      1: (s) => `The lab holds with ${s.lives} lives left. The scientists are hiding under their desks.`,
      lose: (s) => `The lab fell on wave ${s.wave}. All three roads meet before the stalk bridge: build there, and keep a Cryo Beam by the creek for the saucers.`,
    },
    buildScene,
  };
})();
