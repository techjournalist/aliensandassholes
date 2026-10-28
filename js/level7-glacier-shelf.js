// ===================================================================
// LEVEL 7 — The Glacier Shelf
// High on the ice, the colony mines water ice for the whole moon. Two
// roads come across the shelf from the west and cross the meltwater on a
// bridge of solid ice; a third drops off the ridge to the north-east.
// A Tripod strides in on the last wave.
// ===================================================================
const LEVEL_7 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: "Landing Party", flavor: "Blob drones along the shore road.", groups: [g('grunt', 5, 3.0, 0, 'shore', 0)] },
    { name: "Across the Floe", flavor: "The floe road from the south opens.", groups: [g('grunt', 5, 2.0, 0, 'shore', 0), g('grunt', 4, 2.2, 0, 'floe', 3)] },
    { name: "Off the Ridge", flavor: "Crawlers slide down the ridge road. It never crosses the water.", groups: [g('grunt', 6, 1.6, 0, 'floe', 0), g('trickster', 6, 1.0, 0, 'ridge', 4)] },
    { name: "Shell on Ice", flavor: "A brute on the floe road.", groups: [g('grunt', 6, 1.3, 0, 'shore', 0), g('troll', 1, 1, 0, 'floe', 2), g('grunt', 5, 1.5, 0, 'ridge', 8)] },
    { name: "Ice Glare", flavor: "Saucers off the ridge.", groups: [g('bat', 4, 1.3, 0, 'ridge', 0), g('grunt', 9, 1.0, 0, 'shore', 3)] },
    { name: "Three Landings", flavor: "All three roads.", groups: [g('grunt', 6, 1.1, 0, 'shore', 0), g('grunt', 5, 1.1, 0, 'floe', 0), g('grunt', 4, 1.2, 0, 'ridge', 2)] },
    { name: "Shells and Slides", flavor: "Brutes on the floe, crawlers on the ridge.", groups: [g('troll', 4, 2.6, 0, 'floe', 0), g('trickster', 10, 0.6, 0, 'ridge', 3)] },
    { name: "Whiteout", flavor: "Saucers over the shore road.", groups: [g('bat', 6, 0.9, 0, 'shore', 0), g('trickster', 10, 0.6, 0, 'ridge', 4), g('grunt', 9, 0.9, 0, 'floe', 6)] },
    { name: "The Press", flavor: "Road after road.", groups: [g('troll', 4, 2.4, 0, 'floe', 0), g('grunt', 13, 0.7, 0, 'shore', 1), g('trickster', 9, 0.6, 0, 'ridge', 6), g('bat', 6, 0.9, 0, 'shore', 10)] },
    { name: "Pincer", flavor: "Brutes from the west, saucers from the ridge.", groups: [g('troll', 4, 2.2, 0, 'floe', 0), g('troll', 3, 2.4, 0, 'shore', 2), g('bat', 8, 0.8, 0, 'ridge', 4), g('grunt', 10, 0.7, 0, 'ridge', 9)] },
    { name: "Avalanche", flavor: "Everything slides down at once.", groups: [g('grunt', 16, 0.55, 0, 'shore', 0), g('trickster', 13, 0.45, 0, 'ridge', 2), g('troll', 5, 2.0, 0, 'floe', 3), g('bat', 8, 0.8, 0, 'shore', 8)] },
    { name: "Deep Freeze", flavor: "Brutes, crawlers and saucers.", groups: [g('troll', 5, 2.0, 0, 'floe', 0), g('trickster', 16, 0.4, 0, 'ridge', 0), g('bat', 9, 0.6, 0, 'shore', 0), g('grunt', 10, 0.7, 0, 'shore', 6)] },
    { name: "The Tripod", flavor: "A Tripod strides across the ice. It walks, so every tower can hit it.", groups: [g('bat', 5, 1.0, 0, 'ridge', 0), g('grunt', 8, 0.75, 0, 'shore', 1), g('tripod', 1, 1, 0, 'floe', 7)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, srand, scene, animated, puff, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;
    LC.standardScene(kit, { channel: 'meltwater', bridge: 'ice', outpost: 'icemine', seed: 707, mix: [[10, 'tree'], [14, 'rock'], [10, 'crystal'], [6, 'crater'], [4, 'tuft'], [3, 'barrel'], [3, 'cart'], [3, 'cottage'], [2, 'antenna'], [20, null]], edge: [[20, 'rock'], [14, 'crystal'], [10, 'tree'], [24, null]] });
    // ice blocks and frozen pools scattered over the shelf
    const rng = srand(17);
    for (let i = 0; i < 18; i++) {
      const c = Math.floor(rng() * level.grid.cols), r = Math.floor(rng() * level.grid.rows);
      if (GameState.cellKind(c, r) !== 'ground' || GameState.isBuildable(c, r) || GameState.zoneFalloff(c, r) > 0.3) continue;
      const x = worldX(c) + (rng() - 0.5) * 0.4, z = worldZ(r) + (rng() - 0.5) * 0.4;
      batchPart(P(GEO.circle, PALETTE.ice, M(x, 0.008, z, { sx: 0.3, sz: 0.2, ry: rng() * 3 }), false));
      if (rng() < 0.5) batchPart(P(GEO.box, PALETTE.frost, M(x + 0.1, 0.07, z, { s: 0.14, ry: rng() * 3 })));
    }
  }

  const tail = [[4, 7], [10, 7], [10, 3], [13, 3], [13, 10], [16, 10], [16, 8]];
  return {
    id: 'glacier-shelf',
    index: 7,
    name: 'The Glacier Shelf',
    subtitle: 'Three roads across the ice. Keep the mine running.',
    map: { x: 140, y: 214, reclaim: 96, icon: 'derrick' },
    grid: { cols: 21, rows: 13 },
    spawn: [0, 2],
    routes: [
      { id: 'shore', waypoints: [[0, 2], [3, 2], [3, 5], [1, 5], [1, 9], [4, 9], ...tail] },
      { id: 'floe',  waypoints: [[0, 12], [3, 12], [3, 9], [4, 9], ...tail] },
      { id: 'ridge', waypoints: [[20, 1], [15, 1], [15, 3], [13, 3], [13, 10], [16, 10], [16, 8]] },
    ],
    chokepoint: { cell: [6, 7], streamCol: 6 },
    endpoint: {
      name: 'the ice mine', properName: 'The Ice Mine',
      cells: [[16, 5], [17, 5], [16, 6], [17, 6], [16, 7], [17, 7]], gateCell: [16, 7],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [0, 7], radiusOut: { x: 3, z: 7 }, radiusIn: 1.1, falloffWidth: 0.42, foothold: { center: [16.5, 6], radius: 3, falloffWidth: 2 }, backdrop: 0x1a2036, groundMeadow: 0xc4dcf0, groundMeadowDark: 0xa6c2dc, sky: 0xeaf4ff, motes: { dust: 24, embers: 12 } },
    spawnBlockedText: "That's a landing pod. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 165, startLives: 20, starThresholds: [16, 8],
    tipTile: [2, 3],
    endScreenText: {
      3: () => 'The drills never stopped. Ice for everyone.',
      2: (s) => `The ice mine holds with ${s.lives} lives to spare. Someone left the door open.`,
      1: (s) => `The ice mine holds with ${s.lives} lives left. It is very cold in there now.`,
      lose: (s) => `The ice mine fell on wave ${s.wave}. The ridge road never crosses the meltwater: it needs its own towers by the mine.`,
    },
    buildScene,
  };
})();
