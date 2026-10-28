// ===================================================================
// LEVEL 6 — Spaceport Bazaar
// The colony's spaceport, where the supply shuttles land and the Sunday
// bazaar spreads out under the monorail. Two roads come in from the west
// and cross the coolant canal under the monorail; the third comes round
// from the east without crossing water. The Spore Cloud drifts in last.
// ===================================================================
const LEVEL_6 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: "Arrivals", flavor: "Blob drones on the west road.", groups: [g('grunt', 5, 3.2, 0, 'west', 0)] },
    { name: "Down the Mill Road", flavor: "The southern road opens.", groups: [g('grunt', 5, 2.0, 0, 'west', 0), g('grunt', 5, 2.0, 0, 'mill', 4)] },
    { name: "From Behind", flavor: "Crawlers come round from the east. They never cross the canal.", groups: [g('trickster', 6, 0.8, 0, 'east', 0), g('grunt', 5, 1.4, 0, 'west', 3)] },
    { name: "Shell at the Gate", flavor: "A brute on the mill road.", groups: [g('troll', 1, 1, 0, 'mill', 0), g('grunt', 6, 1.2, 0, 'west', 2), g('trickster', 5, 0.8, 0, 'east', 6)] },
    { name: "Unscheduled Flights", flavor: "Saucers on the mill road.", groups: [g('bat', 2, 1.5, 0, 'mill', 0), g('grunt', 8, 1.0, 0, 'west', 3)] },
    { name: "Three Gates", flavor: "All three roads.", groups: [g('grunt', 5, 1.0, 0, 'west', 0), g('grunt', 5, 1.0, 0, 'mill', 0), g('trickster', 6, 0.6, 0, 'east', 2)] },
    { name: "Shell Column", flavor: "Brutes on the west road, crawlers in the east.", groups: [g('troll', 2, 2.6, 0, 'west', 0), g('trickster', 7, 0.65, 0, 'east', 3)] },
    { name: "Rush Hour", flavor: "Saucers from the east, blobs from the south.", groups: [g('bat', 3, 1.1, 0, 'east', 0), g('grunt', 8, 0.9, 0, 'mill', 3), g('trickster', 5, 0.7, 0, 'west', 6)] },
    { name: "The Press", flavor: "Road after road.", groups: [g('troll', 2, 2.6, 0, 'mill', 0), g('grunt', 8, 0.8, 0, 'west', 1), g('trickster', 6, 0.6, 0, 'east', 6), g('bat', 2, 1.3, 0, 'west', 10)] },
    { name: "Pincer", flavor: "Brutes west and south, saucers east.", groups: [g('troll', 2, 2.4, 0, 'west', 0), g('troll', 1, 2.4, 0, 'mill', 2), g('bat', 4, 1.0, 0, 'east', 4), g('grunt', 7, 0.8, 0, 'east', 9)] },
    { name: "Sale Day", flavor: "Everybody wants in.", groups: [g('grunt', 12, 0.6, 0, 'west', 0), g('trickster', 12, 0.45, 0, 'east', 0), g('troll', 3, 2.0, 0, 'mill', 0), g('bat', 4, 1.0, 0, 'mill', 6)] },
    { name: "Riot", flavor: "Brutes, crawlers and saucers.", groups: [g('troll', 4, 2.0, 0, 'mill', 0), g('trickster', 14, 0.4, 0, 'east', 0), g('bat', 4, 0.9, 0, 'west', 0)] },
    { name: "The Spore Cloud", flavor: "A Spore Cloud as big as a hab drifts in from the east. It flies: Cryo Beams and Missile Pods only.", groups: [g('bat', 3, 1.0, 0, 'mill', 0), g('grunt', 8, 0.7, 0, 'west', 1), g('sporecloud', 1, 1, 0, 'east', 7)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, srand, scene, animated, puff, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;
    LC.standardScene(kit, { channel: 'coolant', bridge: 'mono', outpost: 'spaceport', seed: 606, mix: [[10, 'tree'], [8, 'bush'], [10, 'tuft'], [8, 'flower'], [6, 'barrel'], [5, 'cart'], [5, 'cottage'], [4, 'solar'], [3, 'silo'], [3, 'antenna'], [2, 'crater'], [12, null]], edge: [[22, 'tree'], [8, 'cottage'], [6, 'silo'], [6, 'rock'], [4, 'antenna'], [18, null]] });
    // bazaar stalls: striped awnings over crates along the square
    const cols = [PALETTE.flowerPink, PALETTE.tunic, PALETTE.hazard, PALETTE.crystal];
    [[10, 2], [14, 6], [11, 9], [16, 7]].forEach(([c, r], i) => {
      if (GameState.cellKind(c, r) !== 'ground' || GameState.isBuildable(c, r)) return;
      const x = worldX(c), z = worldZ(r);
      for (const [dx, dz] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) batchPart(P(GEO.cyl, PALETTE.steel, M(x + dx, 0.2, z + dz, { sx: 0.015, sy: 0.4, sz: 0.015 }), false));
      batchPart(P(GEO.box, cols[i % 4], M(x, 0.42, z, { sx: 0.62, sy: 0.04, sz: 0.5, rx: 0.15 })));
      batchPart(P(GEO.box, PALETTE.straw, M(x, 0.1, z, { sx: 0.4, sy: 0.16, sz: 0.24 })));
    });
  }

  const tail = [[10, 6], [10, 8], [12, 8], [12, 5]];
  return {
    id: 'spaceport',
    index: 6,
    name: 'Spaceport Bazaar',
    subtitle: 'Three roads to the control tower. One comes from behind.',
    map: { x: 222, y: 268, reclaim: 100, icon: 'tower' },
    grid: { cols: 20, rows: 12 },
    spawn: [0, 2],
    routes: [
      { id: 'west', waypoints: [[0, 2], [3, 2], [3, 5], [1, 5], [1, 8], [5, 8], [5, 6], ...tail] },
      { id: 'mill', waypoints: [[0, 11], [7, 11], [7, 6], ...tail] },
      { id: 'east', waypoints: [[19, 2], [16, 2], [16, 5], [18, 5], [18, 10], [14, 10], [14, 8], [12, 8], [12, 5]] },
    ],
    chokepoint: { cell: [8, 6], streamCol: 8 },
    endpoint: {
      name: 'the spaceport', properName: 'The Spaceport',
      cells: [[12, 3], [13, 3], [12, 4], [13, 4]], gateCell: [12, 4],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [0, 6], radiusOut: { x: 3, z: 7 }, radiusIn: 1.1, falloffWidth: 0.42, foothold: { center: [12.5, 4], radius: 3, falloffWidth: 2 }, backdrop: 0x1c1838, motes: { embers: 16, fireflies: 14 } },
    spawnBlockedText: "That's a landing pod. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 180, startLives: 20, starThresholds: [16, 8],
    tipTile: [2, 3],
    endScreenText: {
      3: () => 'Not a stall knocked over. The bazaar opens on time on Sunday.',
      2: (s) => `The spaceport holds with ${s.lives} lives to spare. The shuttles land a little late.`,
      1: (s) => `The spaceport holds with ${s.lives} lives left. The control tower is held together with tape.`,
      lose: (s) => `The spaceport fell on wave ${s.wave}. The east road comes in behind the canal: give it its own towers, and keep anti-air for the Spore Cloud.`,
    },
    buildScene,
  };
})();
