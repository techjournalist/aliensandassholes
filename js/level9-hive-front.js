// ===================================================================
// LEVEL 9 — The Hive Front
// The colony has pushed out to the edge of the alien hive and set up a
// shield generator to hold the line. Five roads come out of the hive in
// the west and meet before the gantry over the plasma trench; a sixth
// creeps round behind from the east. The Big Brain floats in last.
// ===================================================================
const LEVEL_9 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: "First Sortie", flavor: "Blob drones out of the hive on the west road.", groups: [g('grunt', 5, 3.2, 0, 'west', 0)] },
    { name: "A Second Road", flavor: "The north-west road opens.", groups: [g('grunt', 4, 2.3, 0, 'west', 0), g('grunt', 3, 2.6, 0, 'northwest', 4)] },
    { name: "Quick Legs", flavor: "Crawlers on the south-west road.", groups: [g('grunt', 4, 1.6, 0, 'west', 0), g('trickster', 5, 0.9, 0, 'southwest', 3)] },
    { name: "The North Road", flavor: "A brute from the north.", groups: [g('grunt', 4, 1.5, 0, 'west', 0), g('troll', 1, 1, 0, 'north', 6), g('grunt', 3, 1.6, 0, 'farsouth', 3)] },
    { name: "Saucers over the Hive", flavor: "Saucers on the far-south road.", groups: [g('bat', 2, 1.5, 0, 'farsouth', 0), g('grunt', 6, 1.1, 0, 'northwest', 3)] },
    { name: "Five Roads", flavor: "Every western road at once.", groups: [g('grunt', 3, 1.2, 0, 'northwest', 0), g('grunt', 3, 1.2, 0, 'north', 1), g('grunt', 3, 1.2, 0, 'west', 0), g('grunt', 3, 1.2, 0, 'southwest', 1), g('grunt', 3, 1.2, 0, 'farsouth', 0)] },
    { name: "Round the Back", flavor: "Something comes round the back on the flank road.", groups: [g('grunt', 3, 1.8, 0, 'flank', 0), g('trickster', 5, 0.8, 0, 'west', 2), g('troll', 1, 1, 0, 'north', 4)] },
    { name: "Night Raid", flavor: "Saucers, crawlers and the flank.", groups: [g('bat', 3, 1.0, 0, 'farsouth', 0), g('trickster', 7, 0.6, 0, 'northwest', 1), g('grunt', 3, 1.4, 0, 'flank', 3)] },
    { name: "Every Road in Turn", flavor: "Road after road.", groups: [g('troll', 2, 2.4, 0, 'west', 0), g('grunt', 6, 0.9, 0, 'north', 1), g('trickster', 5, 0.65, 0, 'southwest', 2), g('bat', 2, 1.2, 0, 'farsouth', 6)] },
    { name: "Pincer and Flank", flavor: "Brutes from two sides, the flank again.", groups: [g('troll', 2, 2.3, 0, 'northwest', 0), g('troll', 2, 2.3, 0, 'southwest', 1), g('bat', 3, 1.0, 0, 'farsouth', 3), g('grunt', 4, 1.1, 0, 'flank', 4)] },
    { name: "Six Roads at Once", flavor: "The hive empties.", groups: [g('grunt', 7, 0.9, 0, 'west', 0), g('trickster', 7, 0.6, 0, 'northwest', 0), g('troll', 2, 2.0, 0, 'north', 0), g('grunt', 5, 1.0, 0, 'southwest', 0), g('bat', 4, 1.0, 0, 'farsouth', 6), g('grunt', 3, 1.4, 0, 'flank', 4)] },
    { name: "The Long Night", flavor: "Brutes, crawlers, saucers and the flank.", groups: [g('troll', 3, 2.1, 0, 'west', 0), g('trickster', 12, 0.45, 0, 'northwest', 0), g('bat', 6, 0.7, 0, 'farsouth', 0), g('grunt', 5, 1.1, 0, 'flank', 0)] },
    { name: "The Big Brain", flavor: "The Big Brain floats out of the hive with its guard drones. It flies: Cryo Beams and Missile Pods only.", groups: [g('bat', 4, 1.0, 0, 'farsouth', 0), g('grunt', 5, 0.9, 0, 'north', 1), g('brain', 1, 1, 0, 'northwest', 8), g('grunt', 4, 0.9, 0, 'flank', 2)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, srand, scene, animated, puff, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;
    LC.standardScene(kit, { channel: 'plasma', bridge: 'gantry', outpost: 'shieldgen', flag: PALETTE.magic, seed: 909, mix: [[8, 'tree'], [8, 'rock'], [8, 'crystal'], [6, 'crater'], [4, 'tuft'], [4, 'antenna'], [3, 'barrel'], [2, 'cart'], [2, 'solar'], [18, null]], edge: [[14, 'rock'], [12, 'crystal'], [10, 'tree'], [20, null]] });
    // the trench glows: halos along its length
    const sx = worldX(level.chokepoint.streamCol);
    for (let r = 0; r < level.grid.rows; r += 3) glow(sx, 0.1, worldZ(r) + 0.5, { w: 1.2, h: 0.6 });
  }

  const tail = [[9, 8], [16, 8], [16, 11], [18, 11], [18, 8]];
  return {
    id: 'hive-front',
    index: 9,
    name: 'The Hive Front',
    subtitle: 'Six roads out of the hive. Keep the shield up.',
    map: { x: 316, y: 92, reclaim: 102, icon: 'shield' },
    grid: { cols: 22, rows: 14 },
    spawn: [0, 7],
    routes: [
      { id: 'west',      waypoints: [[0, 7], [3, 7], [3, 10], [6, 10], [6, 8], ...tail] },
      { id: 'northwest', waypoints: [[0, 1], [4, 1], [4, 4], [7, 4], [7, 8], ...tail] },
      { id: 'north',     waypoints: [[11, 0], [11, 3], [9, 3], ...tail] },
      { id: 'southwest', waypoints: [[0, 13], [6, 13], [6, 10], [6, 8], ...tail] },
      { id: 'farsouth',  waypoints: [[11, 13], [11, 10], [9, 10], ...tail] },
      { id: 'flank',     waypoints: [[21, 13], [19, 13], [19, 10], [18, 10], [18, 8]] },
    ],
    chokepoint: { cell: [14, 8], streamCol: 14 },
    endpoint: {
      name: 'the shield generator', properName: 'The Shield Generator',
      cells: [[18, 6], [19, 6], [18, 7], [19, 7]], gateCell: [18, 7],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [2, 7], radiusOut: { x: 6, z: 8.5 }, radiusIn: 1.2, falloffWidth: 0.5, foothold: { center: [18.5, 7], radius: 3.4, falloffWidth: 2 }, backdrop: 0x1a1028, groundMeadow: 0x3a8c88, groundMeadowDark: 0x2c706e, ambient: 0.34, motes: { embers: 40, spores: 20 } },
    spawnBlockedText: "That's a landing pod. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 240, startLives: 20, starThresholds: [16, 8],
    tipTile: [2, 6],
    endScreenText: {
      3: () => 'The shield never flickered. The hive has learned to fear the colony.',
      2: (s) => `The shield holds with ${s.lives} lives to spare. It buzzes louder than it should.`,
      1: (s) => `The shield holds with ${s.lives} lives left. It is running on its last fuse.`,
      lose: (s) => `The shield fell on wave ${s.wave}. Five roads meet before the trench gantry and the flank comes in behind: guard both.`,
    },
    buildScene,
  };
})();
