// ===================================================================
// LEVEL 4 — Comms Ridge
// The big dish on Comms Ridge is the colony's only line home. Three roads
// climb to it from the west and the south: the highway, the ridge road and
// the fen road. They meet before the cable span over the chasm, then climb
// north to the dish. The Sky Manta glides in for the finale.
// ===================================================================
const LEVEL_4 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: "The Vanguard", flavor: "Blob drones on the highway.", groups: [g('grunt', 5, 3.2, 0, 'highway', 0)] },
    { name: "The Ridge Road", flavor: "The hairpin road down the ridge opens.", groups: [g('grunt', 5, 2.0, 0, 'highway', 0), g('grunt', 5, 2.0, 0, 'ridge', 4)] },
    { name: "Fen Runners", flavor: "Crawlers race up the fen road.", groups: [g('trickster', 6, 0.8, 0, 'fen', 0), g('grunt', 5, 1.4, 0, 'highway', 3)] },
    { name: "Shells on the Ridge", flavor: "A brute on the ridge road.", groups: [g('troll', 1, 1, 0, 'ridge', 0), g('grunt', 6, 1.2, 0, 'highway', 2), g('trickster', 5, 0.8, 0, 'fen', 6)] },
    { name: "Saucers", flavor: "Saucer scouts off the ridge.", groups: [g('bat', 4, 1.2, 0, 'ridge', 0), g('grunt', 8, 1.0, 0, 'highway', 3)] },
    { name: "Three Fronts", flavor: "Every road at once.", groups: [g('grunt', 5, 1.0, 0, 'highway', 0), g('grunt', 5, 1.0, 0, 'ridge', 0), g('trickster', 6, 0.6, 0, 'fen', 2)] },
    { name: "Shell Column", flavor: "Brutes on the highway, crawlers in the fen.", groups: [g('troll', 2, 2.6, 0, 'highway', 0), g('trickster', 7, 0.65, 0, 'fen', 3)] },
    { name: "Saucer Storm", flavor: "Saucers over the fen.", groups: [g('bat', 5, 0.9, 0, 'fen', 0), g('grunt', 8, 0.9, 0, 'ridge', 3), g('trickster', 5, 0.7, 0, 'highway', 6)] },
    { name: "The Press", flavor: "Road after road.", groups: [g('troll', 2, 2.6, 0, 'ridge', 0), g('grunt', 8, 0.8, 0, 'highway', 1), g('trickster', 6, 0.6, 0, 'fen', 6), g('bat', 4, 1.0, 0, 'highway', 10)] },
    { name: "Pincer", flavor: "Brutes on two roads, saucers on the third.", groups: [g('troll', 2, 2.4, 0, 'highway', 0), g('troll', 1, 2.4, 0, 'ridge', 2), g('bat', 6, 0.8, 0, 'fen', 4), g('grunt', 7, 0.8, 0, 'fen', 9)] },
    { name: "Signal Jam", flavor: "The ridge is full.", groups: [g('grunt', 12, 0.6, 0, 'highway', 0), g('trickster', 12, 0.45, 0, 'fen', 0), g('troll', 3, 2.0, 0, 'ridge', 0), g('bat', 6, 0.8, 0, 'ridge', 6)] },
    { name: "Night Shift", flavor: "Brutes, crawlers and saucers together.", groups: [g('troll', 4, 2.0, 0, 'ridge', 0), g('trickster', 14, 0.4, 0, 'fen', 0), g('bat', 9, 0.55, 0, 'highway', 0)] },
    { name: "The Last Charge", flavor: "Everything that is left.", groups: [g('troll', 5, 1.8, 0, 'highway', 0), g('grunt', 14, 0.5, 0, 'ridge', 0), g('bat', 8, 0.6, 0, 'fen', 4), g('trickster', 10, 0.45, 0, 'fen', 10)] },
    { name: "The Sky Manta", flavor: "The Sky Manta glides in on wings as wide as a hab. It flies: only Cryo Beams and Missile Pods reach it.", groups: [g('bat', 6, 0.9, 0, 'ridge', 0), g('grunt', 10, 0.7, 0, 'highway', 1), g('troll', 2, 2.4, 0, 'fen', 3), g('manta', 1, 1, 0, 'highway', 8)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, srand, scene, animated, puff, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;
    LC.standardScene(kit, { channel: 'chasm', bridge: 'span', outpost: 'comms', seed: 404, mix: [[14, 'tree'], [8, 'bush'], [10, 'tuft'], [6, 'flower'], [8, 'rock'], [6, 'crystal'], [4, 'antenna'], [4, 'solar'], [4, 'crater'], [2, 'barrel'], [12, null]], edge: [[20, 'tree'], [16, 'rock'], [14, 'crystal'], [6, 'antenna'], [20, null]] });

  }

  const tail = [[11, 8], [16, 8], [16, 10], [19, 10], [19, 6], [17, 6], [17, 4]];
  return {
    id: 'comms-ridge',
    index: 4,
    name: 'Comms Ridge',
    subtitle: 'Three looping roads up the ridge. Keep the dish talking.',
    map: { x: 394, y: 262, reclaim: 104, icon: 'dish' },
    grid: { cols: 22, rows: 13 },
    spawn: [0, 2],
    routes: [
      { id: 'highway', waypoints: [[0, 2], [6, 2], [6, 5], [11, 5], ...tail] },
      { id: 'ridge',   waypoints: [[0, 9], [4, 9], [4, 7], [8, 7], [8, 8], ...tail] },
      { id: 'fen',     waypoints: [[3, 12], [3, 11], [10, 11], [10, 8], ...tail] },
    ],
    chokepoint: { cell: [14, 8], streamCol: 14 },
    endpoint: {
      name: 'the comms array', properName: 'The Comms Array',
      cells: [[17, 1], [18, 1], [17, 2], [18, 2], [17, 3], [18, 3]], gateCell: [17, 3],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [0.5, 9], radiusOut: { x: 4.5, z: 6 }, radiusIn: 1.12, falloffWidth: 0.42, backdrop: 0x241526, groundMeadow: 0xc27a5a, groundMeadowDark: 0xa66248, sky: 0xffe2cc, motes: { embers: 20, dust: 18 } },
    spawnBlockedText: "That's a landing pod. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 180, startLives: 20, starThresholds: [16, 8],
    tipTile: [5, 3],
    endScreenText: {
      3: () => 'The dish never dropped a single call. Home heard every word.',
      2: (s) => `The comms array holds with ${s.lives} lives to spare. The picture is a little fuzzy.`,
      1: (s) => `The comms array holds with ${s.lives} lives left. It only gets one channel now.`,
      lose: (s) => `The comms array fell on wave ${s.wave}. The three roads join just before the span: build there, and bring Cryo Beams and Missile Pods for the Manta.`,
    },
    buildScene,
  };
})();
