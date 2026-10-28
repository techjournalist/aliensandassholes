// ===================================================================
// LEVEL 8 — Bloomfruit Orchard
// The orchard terraces grow the colony's bloomfruit, and the seed vault
// in the hill keeps a copy of every seed the colonists brought. Three
// lanes run down through the trees and meet before the old aqueduct.
// The aliens have stolen a harvester for the last wave.
// ===================================================================
const LEVEL_8 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: "Fruit Thieves", flavor: "Blob drones in the vine lane.", groups: [g('grunt', 5, 3.0, 0, 'vine', 0)] },
    { name: "The Orchard Path", flavor: "The orchard lane opens.", groups: [g('grunt', 5, 2.0, 0, 'vine', 0), g('grunt', 4, 2.2, 0, 'orchard', 3)] },
    { name: "Down the Cellar Lane", flavor: "Crawlers in the cellar lane.", groups: [g('grunt', 5, 1.6, 0, 'orchard', 0), g('trickster', 5, 1.0, 0, 'cellar', 4)] },
    { name: "Shell in the Trees", flavor: "A brute in the orchard.", groups: [g('grunt', 7, 1.3, 0, 'vine', 0), g('troll', 1, 1, 0, 'orchard', 2), g('grunt', 6, 1.5, 0, 'cellar', 8)] },
    { name: "Over the Rows", flavor: "Saucers over the cellar lane.", groups: [g('bat', 3, 1.3, 0, 'cellar', 0), g('grunt', 10, 1.0, 0, 'vine', 3)] },
    { name: "Three Rows", flavor: "All three lanes.", groups: [g('grunt', 10, 0.88, 0, 'vine', 0), g('grunt', 9, 0.88, 0, 'orchard', 0), g('grunt', 6, 0.96, 0, 'cellar', 2)] },
    { name: "Hard Harvest", flavor: "Brutes in the orchard, crawlers in the cellar lane.", groups: [g('troll', 4, 2.24, 0, 'orchard', 0), g('trickster', 12, 0.56, 0, 'cellar', 3)] },
    { name: "The Crush", flavor: "Saucers, crawlers and blobs.", groups: [g('bat', 6, 1.0, 0, 'vine', 0), g('trickster', 12, 0.52, 0, 'cellar', 4), g('grunt', 10, 0.8, 0, 'orchard', 6)] },
    { name: "The Press", flavor: "Lane after lane.", groups: [g('troll', 4, 2.08, 0, 'orchard', 0), g('grunt', 16, 0.64, 0, 'vine', 1), g('trickster', 10, 0.52, 0, 'cellar', 6), g('bat', 6, 1.0, 0, 'vine', 10)] },
    { name: "Pincer", flavor: "Brutes on two lanes, saucers on the third.", groups: [g('troll', 4, 1.92, 0, 'orchard', 0), g('troll', 2, 1.92, 0, 'vine', 2), g('bat', 8, 0.8, 0, 'cellar', 4), g('grunt', 12, 0.64, 0, 'cellar', 9)] },
    { name: "Bumper Crop", flavor: "The orchard is crawling.", groups: [g('grunt', 20, 0.52, 0, 'vine', 0), g('trickster', 16, 0.4, 0, 'cellar', 2), g('troll', 6, 1.76, 0, 'orchard', 3), g('bat', 7, 0.85, 0, 'vine', 8)] },
    { name: "Last Picking", flavor: "Brutes, crawlers and saucers.", groups: [g('troll', 6, 1.76, 0, 'orchard', 0), g('trickster', 21, 0.36, 0, 'cellar', 0), g('bat', 8, 0.65, 0, 'vine', 0)] },
    { name: "The Harvester", flavor: "The aliens roll out a stolen Harvester. Every tower can hit it.", groups: [g('bat', 5, 1.0, 0, 'cellar', 0), g('grunt', 16, 0.6, 0, 'orchard', 1), g('harvester', 1, 1, 0, 'vine', 7)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, srand, scene, animated, puff, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;
    LC.standardScene(kit, { channel: 'canal', bridge: 'aqueduct', outpost: 'seedvault', flag: PALETTE.flowerPink, seed: 808, mix: [[22, 'tree'], [6, 'bush'], [8, 'tuft'], [10, 'flower'], [4, 'hay'], [4, 'fence'], [3, 'barrel'], [3, 'cart'], [2, 'greenhouse'], [2, 'cottage'], [10, null]], edge: [[40, 'tree'], [8, 'bush'], [4, 'cottage'], [16, null]] });

  }

  const tail = [[7, 6], [12, 6], [12, 2], [16, 2], [17, 2], [17, 3], [17, 12], [13, 12], [13, 11]];
  return {
    id: 'bloomfruit',
    index: 8,
    name: 'Bloomfruit Orchard',
    subtitle: 'Three lanes through the orchard. Guard the seed vault.',
    map: { x: 170, y: 120, reclaim: 98, icon: 'vault' },
    grid: { cols: 20, rows: 13 },
    spawn: [0, 1],
    routes: [
      { id: 'vine',    waypoints: [[0, 1], [4, 1], [4, 4], [2, 4], [2, 6], ...tail] },
      { id: 'orchard', waypoints: [[0, 9], [5, 9], [5, 6], ...tail] },
      { id: 'cellar',  waypoints: [[0, 12], [8, 12], [8, 8], [7, 8], ...tail] },
    ],
    chokepoint: { cell: [9, 6], streamCol: 9 },
    endpoint: {
      name: 'the seed vault', properName: 'The Seed Vault',
      cells: [[13, 9], [14, 9], [13, 10], [14, 10]], gateCell: [13, 10],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [0, 7], radiusOut: { x: 3, z: 7 }, radiusIn: 1.1, falloffWidth: 0.42, backdrop: 0x1e1838, groundMeadow: 0x48b090, groundMeadowDark: 0x349274, motes: { leaves: 20, fireflies: 20, embers: 12 } },
    spawnBlockedText: "That's a landing pod. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 165, startLives: 20, starThresholds: [16, 8],
    tipTile: [3, 2],
    endScreenText: {
      3: () => 'Every seed safe and every tree standing. The orchard throws you a fruit party.',
      2: (s) => `The seed vault holds with ${s.lives} lives to spare. A few trees got trampled.`,
      1: (s) => `The seed vault holds with ${s.lives} lives left. Some of the seeds are now a little squashed.`,
      lose: (s) => `The seed vault fell on wave ${s.wave}. All three lanes meet before the aqueduct: hold them there, and bring heavy hitters for the Harvester.`,
    },
    buildScene,
  };
})();
