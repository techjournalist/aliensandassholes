// ===================================================================
// LEVEL 8 — Bloomfruit Orchard
// The orchard terraces grow the colony's bloomfruit, and the seed vault
// in the middle of the orchard keeps a copy of every seed the colonists
// brought. Two lanes cross the old aqueduct from the east and spiral in
// around the vault; the orchard lane sneaks round from the west and joins
// them for the last lap.
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

  // the extra points beside the long corners keep the rounded road on its cells
  const tail = [[17, 6], [13, 6], [13, 3], [13, 2], [12, 2], [7, 2], [6, 2], [6, 3], [6, 9], [6, 10], [7, 10], [12, 10], [12, 8], [9, 8], [9, 7]];
  return {
    id: 'bloomfruit',
    index: 8,
    name: 'Bloomfruit Orchard',
    subtitle: 'Three lanes spiral in around the seed vault.',
    map: { x: 170, y: 120, reclaim: 98, icon: 'vault' },
    grid: { cols: 20, rows: 13 },
    spawn: [19, 1],
    routes: [
      { id: 'vine',    waypoints: [[19, 1], [17, 1], ...tail] },
      { id: 'orchard', waypoints: [[0, 4], [3, 4], [3, 11], [6, 11], ...tail.slice(9)] },
      { id: 'cellar',  waypoints: [[19, 11], [17, 11], ...tail] },
    ],
    chokepoint: { cell: [15, 6], streamCol: 15 },
    // fruit-cannon launch pads on the spiral, and a raised terrace inside it
    jumpPads: [[6, 6], [13, 4]],
    elevation: { areas: [{ from: [7, 3], to: [12, 4], h: 1 }], ramps: [] },
    endpoint: {
      name: 'the seed vault', properName: 'The Seed Vault',
      cells: [[9, 5], [10, 5], [9, 6], [10, 6]], gateCell: [9, 6],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [19.6, 6], radiusOut: { x: 3, z: 7 }, radiusIn: 1.1, falloffWidth: 0.42, backdrop: 0x1e1838, groundMeadow: 0xd68aa0, groundMeadowDark: 0xbc7088, motes: { spores: 18, fireflies: 20, embers: 12 } },
    spawnBlockedText: "That's a landing pod. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 165, startLives: 20, starThresholds: [16, 8],
    tipTile: [16, 2],
    endScreenText: {
      3: () => 'Every seed safe and every tree standing. The orchard throws you a fruit party.',
      2: (s) => `The seed vault holds with ${s.lives} lives to spare. A few trees got trampled.`,
      1: (s) => `The seed vault holds with ${s.lives} lives left. Some of the seeds are now a little squashed.`,
      lose: (s) => `The seed vault fell on wave ${s.wave}. The east lanes meet before the aqueduct and the orchard lane joins them below the vault: hold the inner ring, and bring heavy hitters for the Harvester.`,
    },
    buildScene,
  };
})();
