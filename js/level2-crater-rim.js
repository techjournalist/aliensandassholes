// ===================================================================
// LEVEL 2 — Crater Rim
// The pump station on the rim of Big Crater sends water to every farm on
// the moon. The aliens land on the east rim this time. Two roads come
// west at it: the rim road, which zigzags round the lip of the crater, and
// the gully track along the bottom. They meet before the girder bridge over
// the crevasse. The Gloop King waddles in last.
// ===================================================================
const LEVEL_2 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: "Rim Scouts", flavor: "Blob drones on the rim road. Just a few, for now.", groups: [g('grunt', 5, 3.2, 0, 'rim', 0)] },
    { name: "The Gully Track", flavor: "The second road opens along the crater floor. Watch the beacons.", groups: [g('grunt', 5, 2.0, 0, 'rim', 0), g('grunt', 4, 2.4, 0, 'gully', 4)] },
    { name: "Quick Legs", flavor: "Crawlers scuttle up the gully.", groups: [g('grunt', 5, 1.5, 0, 'rim', 0), g('trickster', 5, 0.9, 0, 'gully', 4)] },
    { name: "Shell on the Rim", flavor: "A brute takes the long rim road. It is in no hurry.", groups: [g('grunt', 6, 1.2, 0, 'gully', 0), g('troll', 1, 1, 0, 'rim', 2), g('grunt', 4, 1.4, 0, 'rim', 6)] },
    { name: "Saucers over the Crater", flavor: "Saucer scouts come down the gully. Cryo Beams and Missile Pods only.", groups: [g('bat', 3, 1.3, 0, 'gully', 0), g('grunt', 6, 1.1, 0, 'rim', 3)] },
    { name: "Both Roads at Once", flavor: "Blobs on both roads, crawlers behind.", groups: [g('grunt', 6, 1.0, 0, 'rim', 0), g('grunt', 6, 1.0, 0, 'gully', 0), g('trickster', 5, 0.6, 0, 'gully', 6)] },
    { name: "Shells and Legs", flavor: "Brutes on the rim, crawlers in the gully.", groups: [g('troll', 2, 2.8, 0, 'rim', 0), g('trickster', 7, 0.7, 0, 'gully', 2)] },
    { name: "Saucer Season", flavor: "A flight of saucers and a rush of crawlers.", groups: [g('bat', 5, 0.9, 0, 'rim', 0), g('trickster', 7, 0.6, 0, 'gully', 3), g('grunt', 5, 1.0, 0, 'rim', 6)] },
    { name: "The Press", flavor: "Everything they have, one road after the other.", groups: [g('troll', 2, 2.6, 0, 'gully', 0), g('grunt', 8, 0.8, 0, 'rim', 1), g('trickster', 6, 0.6, 0, 'gully', 6), g('bat', 4, 1.0, 0, 'rim', 10)] },
    { name: "Pincer", flavor: "Brutes on both roads, saucers overhead.", groups: [g('troll', 2, 2.6, 0, 'rim', 0), g('troll', 1, 2.4, 0, 'gully', 3), g('bat', 5, 0.9, 0, 'gully', 6), g('grunt', 6, 0.9, 0, 'rim', 11)] },
    { name: "Dust Storm", flavor: "The crater fills with blobs and crawlers.", groups: [g('grunt', 10, 0.65, 0, 'rim', 0), g('trickster', 9, 0.5, 0, 'gully', 2), g('troll', 3, 2.2, 0, 'rim', 4), g('bat', 5, 0.85, 0, 'gully', 8)] },
    { name: "The Gloop King", flavor: "The Gloop King himself waddles up the rim road. Everything can hit him. Hit him a lot.", groups: [g('grunt', 8, 0.8, 0, 'gully', 0), g('bat', 4, 1.0, 0, 'rim', 1), g('gloopking', 1, 1, 0, 'rim', 6)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, srand, scene, animated, puff, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;
    LC.standardScene(kit, { channel: 'chasm', bridge: 'girder', outpost: 'pumpstation', seed: 202, mix: [[4, 'tree'], [4, 'bush'], [10, 'tuft'], [4, 'flower'], [14, 'rock'], [20, 'crater'], [8, 'crystal'], [3, 'solar'], [3, 'barrel'], [2, 'cart'], [3, 'cottage'], [2, 'well'], [14, null]], edge: [[6, 'tree'], [26, 'rock'], [16, 'crystal'], [18, 'crater'], [4, 'bush'], [20, null]] });
    // the crater wall: a ring of boulders and crystals along the north edge
    const rng = srand(77);
    for (let c = -2; c < 21; c += 1) { const x = worldX(c) + (rng() - 0.5) * 0.4, z = worldZ(-2) + rng() * 0.6; for (const p of kit.rockParts(rng, false).parts) batchPart(p, M(x, 0, z, { s: 1.6 })); }
  }

  const tail = [[11, 7], [4, 7], [4, 10], [1, 10], [1, 6]];
  return {
    id: 'crater-rim',
    index: 2,
    name: 'Crater Rim',
    subtitle: 'Two roads to the pump station. Hold the girder bridge.',
    map: { x: 600, y: 268, reclaim: 96, icon: 'pump' },
    grid: { cols: 19, rows: 12 },
    spawn: [18, 1],
    routes: [
      { id: 'rim',   waypoints: [[18, 1], [13, 1], [13, 4], [16, 4], [16, 7], ...tail] },
      { id: 'gully', waypoints: [[18, 10], [12, 10], [11, 10], [11, 9], ...tail] },
    ],
    chokepoint: { cell: [7, 7], streamCol: 7 },
    // the gully track drops into the crater floor on a ramp and climbs out on
    // another; the rim is a mesa, high ground for towers
    elevation: {
      areas: [{ from: [12, 9], to: [17, 11], h: -1 }, { from: [14, 2], to: [17, 3], h: 1 }],
      ramps: [[17, 10], [12, 10]],
    },
    endpoint: {
      name: 'the pump station', properName: 'The Pump Station',
      cells: [[1, 3], [2, 3], [1, 4], [2, 4], [1, 5], [2, 5]], gateCell: [1, 5],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [18.6, 5.5], radiusOut: { x: 3.2, z: 6.5 }, radiusIn: 1.15, falloffWidth: 0.42, backdrop: 0x1c1834, groundMeadow: 0x9a92b8, groundMeadowDark: 0x7e78a2, motes: { embers: 18, dust: 16 } },
    spawnBlockedText: "That's a landing pod. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 160, startLives: 20, starThresholds: [16, 8],
    tipTile: [14, 2],
    endScreenText: {
      3: () => 'The pump never missed a beat. Every farm on the moon still has water.',
      2: (s) => `The pump station holds with ${s.lives} lives to spare. A few pipes need welding.`,
      1: (s) => `The pump station holds with ${s.lives} lives left. It is making a funny noise now.`,
      lose: (s) => `The pump station fell on wave ${s.wave}. Build where the two roads run together before the bridge, and save Cryo Beams for the saucers.`,
    },
    buildScene,
  };
})();
