// ===================================================================
// LEVEL 10 — Terraformer Prime
// The last battle. Terraformer Prime makes the air the whole colony
// breathes, and the Mothership has come for it. Three roads cross the
// plasma rift from the west on a hard-light bridge; two more come in from
// the east. On the last wave the Mothership itself comes down.
// ===================================================================
const LEVEL_10 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: "The Pods Open", flavor: "Blob drones on the middle road. One road so far.", groups: [g('grunt', 5, 3.2, 0, 'westmid', 0)] },
    { name: "The High Road", flavor: "The north-west road opens. Watch the beacons.", groups: [g('grunt', 4, 2.3, 0, 'westmid', 0), g('grunt', 3, 2.6, 0, 'westhigh', 4)] },
    { name: "Quick Legs", flavor: "Crawlers dash up the low road.", groups: [g('grunt', 4, 1.6, 0, 'westmid', 0), g('trickster', 3, 1.2, 0, 'westlow', 3)] },
    { name: "From Behind", flavor: "The east pods send their own. They come in behind you.", groups: [g('grunt', 4, 2.0, 0, 'easthigh', 0), g('grunt', 4, 1.6, 0, 'westmid', 3)] },
    { name: "Saucers in the Smoke", flavor: "Saucers from the east. Cryo Beams and Missile Pods only.", groups: [g('bat', 2, 1.5, 0, 'eastlow', 0), g('grunt', 6, 1.1, 0, 'westhigh', 3)] },
    { name: "Both Fronts", flavor: "Every road at once, from both sides of the dome.", groups: [g('grunt', 3, 1.3, 0, 'westhigh', 0), g('grunt', 2, 1.3, 0, 'westmid', 0), g('grunt', 3, 1.3, 0, 'westlow', 0), g('grunt', 3, 1.3, 0, 'easthigh', 2), g('grunt', 2, 1.3, 0, 'eastlow', 2)] },
    { name: "Shell on the High Road", flavor: "A brute on the high road, a rush from the south-east.", groups: [g('troll', 1, 1, 0, 'westhigh', 0), g('trickster', 4, 0.9, 0, 'eastlow', 2), g('grunt', 5, 1.2, 0, 'westmid', 4)] },
    { name: "Smoke and Saucers", flavor: "Saucers in the north-east, crawlers on the low road.", groups: [g('bat', 4, 1.1, 0, 'easthigh', 0), g('trickster', 7, 0.6, 0, 'westlow', 1), g('grunt', 5, 1.0, 0, 'eastlow', 3)] },
    { name: "The Dome Between", flavor: "They lean on both fronts in turn.", groups: [g('troll', 2, 2.4, 0, 'eastlow', 0), g('grunt', 6, 0.9, 0, 'westmid', 1), g('trickster', 5, 0.65, 0, 'westhigh', 2), g('bat', 3, 1.2, 0, 'easthigh', 6)] },
    { name: "Pincer", flavor: "Brutes from the low road and the north-east, saucers over the high road.", groups: [g('troll', 2, 2.4, 0, 'westlow', 0), g('troll', 1, 2.3, 0, 'easthigh', 1), g('bat', 3, 1.2, 0, 'westhigh', 3), g('grunt', 5, 0.9, 0, 'eastlow', 4)] },
    { name: "Five Roads at Once", flavor: "Every pod at once. The ground shakes.", groups: [g('grunt', 8, 0.8, 0, 'westmid', 0), g('trickster', 8, 0.55, 0, 'eastlow', 0), g('troll', 2, 2.0, 0, 'westhigh', 0), g('grunt', 6, 0.9, 0, 'westlow', 0), g('bat', 3, 1.2, 0, 'easthigh', 6)] },
    { name: "The Long Night", flavor: "Brutes, crawlers and saucers, all at once.", groups: [g('troll', 3, 2.1, 0, 'easthigh', 0), g('trickster', 8, 0.55, 0, 'westlow', 0), g('bat', 4, 1.0, 0, 'westhigh', 0), g('grunt', 6, 0.8, 0, 'eastlow', 0)] },
    { name: "The Escort", flavor: "The Mothership sends its guard ahead: brutes, saucers and crawlers.", groups: [g('troll', 4, 2.2, 0, 'westhigh', 0), g('bat', 4, 1.0, 0, 'easthigh', 2), g('trickster', 8, 0.5, 0, 'westlow', 4), g('grunt', 8, 0.7, 0, 'eastlow', 6)] },
    { name: "The Mothership", flavor: "The Mothership comes down over the dome. It flies: Cryo Beams and Missile Pods only. Bring everything.", groups: [g('grunt', 6, 0.8, 0, 'easthigh', 0), g('trickster', 6, 0.6, 0, 'westlow', 1), g('mothership', 1, 1, 0, 'westmid', 5)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, srand, scene, animated, puff, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;
    LC.standardScene(kit, { channel: 'plasma', bridge: 'force', outpost: 'terraformer', seed: 1010, mix: [[10, 'tree'], [6, 'rock'], [6, 'crystal'], [6, 'crater'], [4, 'tuft'], [4, 'solar'], [3, 'antenna'], [3, 'silo'], [2, 'cart'], [16, null]], edge: [[14, 'rock'], [12, 'crystal'], [12, 'tree'], [20, null]] });
    const sx = worldX(level.chokepoint.streamCol);
    for (let r = 0; r < level.grid.rows; r += 3) glow(sx, 0.1, worldZ(r) + 0.5, { w: 1.2, h: 0.6 });
  }

  const westTail = [[5, 9], [9, 9], [9, 7], [12, 7]];
  const eastTail = [[16, 9], [14, 9], [14, 7], [12, 7]];
  return {
    id: 'terraformer-prime',
    index: 10,
    name: 'Terraformer Prime',
    subtitle: 'The last battle. Save the air.',
    map: { x: 92, y: 236, reclaim: 102, icon: 'terraformer' },
    grid: { cols: 22, rows: 14 },
    spawn: [0, 9],
    routes: [
      { id: 'westmid',  waypoints: [[0, 9], [2, 9], [2, 11], [5, 11], ...westTail] },
      { id: 'westhigh', waypoints: [[0, 2], [3, 2], [3, 5], [6, 5], [6, 7], [5, 7], ...westTail] },
      { id: 'westlow',  waypoints: [[0, 13], [4, 13], [4, 11], [5, 11], ...westTail] },
      { id: 'easthigh', waypoints: [[21, 2], [17, 2], [17, 5], [19, 5], [19, 9], ...eastTail] },
      { id: 'eastlow',  waypoints: [[21, 12], [17, 12], [17, 11], [16, 11], ...eastTail] },
    ],
    chokepoint: { cell: [7, 9], streamCol: 7 },
    endpoint: {
      name: 'Terraformer Prime', properName: 'Terraformer Prime',
      cells: [[12, 4], [13, 4], [12, 5], [13, 5], [12, 6], [13, 6]], gateCell: [12, 6],
    },
    cobbleTailCells: 3,
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    curveKeepsPace: true,   // shorter road, proportionally slower walkers: same time spawn to gate as the straight road
    theme: { center: [10.5, 7], radiusOut: { x: 13, z: 9.5 }, radiusIn: 1.25, falloffWidth: 0.5, foothold: { center: [12.5, 5], radius: 3.2, falloffWidth: 2 }, backdrop: 0x160e26, groundMeadow: 0x3a9a90, groundMeadowDark: 0x2c7c76, ambient: 0.34, fill: 0xd080ff, fillIntensity: 0.2, motes: { embers: 48, spores: 14 } },
    spawnBlockedText: "That's a landing pod. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 260, startLives: 20, starThresholds: [16, 8],
    tipTile: [1, 8],
    endScreenText: {
      3: () => 'The Mothership is down and Terraformer Prime never missed a breath. The moon is yours.',
      2: (s) => `The Mothership is beaten with ${s.lives} lives to spare. The air smells a bit funny, but it is air.`,
      1: (s) => `The terraformer still runs, with ${s.lives} lives left. Everyone breathe slowly for a while.`,
      lose: (s) => `Terraformer Prime fell on wave ${s.wave}. Hold the rift bridge for the west roads and the junction east of the dome for the rest. Save Missile Pods for the Mothership.`,
    },
    buildScene,
  };
})();
