// ===================================================================
// LEVEL 9 — The Flanked Keep
// The splash screen's own valley at first light: the Bastion on the
// right, the Hollow cracking open along every other edge. Six roads
// start far apart and curve in from the west, north and south, joining
// only at the last junction before the brook bridge. A sixth road
// circles behind the keep and never crosses the brook at all, so no
// single choke point wins the level. Reuses the multi-route engine
// exactly as Level 4 built it; the scene comes from js/dawn-kit.js.
// ===================================================================
const LEVEL_9 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: 'First Light',            flavor: 'Grunts trudge up the west road. The other gates are still quiet.',       groups: [g('grunt', 5, 3.2, 0, 'west')] },
    { name: 'A Second Gate',          flavor: 'The north-west road opens. Watch for the horn.',                          groups: [g('grunt', 4, 2.3, 0, 'west', 0), g('grunt', 3, 2.6, 0, 'north-west', 4)] },
    { name: 'Quick Feet at Dawn',     flavor: 'Bog-Tricksters dash up the south-west road.',                              groups: [g('grunt', 4, 1.6, 0, 'west', 0), g('trickster', 5, 0.9, 0, 'south-west', 3)] },
    { name: 'The Old Troll Wakes',    flavor: 'A Moss Troll lumbers down from the north.',                                groups: [g('grunt', 4, 1.5, 0, 'west', 0), g('troll', 1, 1, 0, 'north', 6), g('grunt', 3, 1.6, 0, 'far-south', 3)] },
    { name: 'Wings at Sunrise',       flavor: 'Bramble Bats rise over the far south road. Druids and Artillery only.',   groups: [g('bat', 2, 1.5, 0, 'far-south', 0), g('grunt', 6, 1.1, 0, 'north-west', 3)] },
    { name: 'Five Gates',             flavor: 'Every western road at once. Find the junction.',                          groups: [g('grunt', 3, 1.2, 0, 'north-west', 0), g('grunt', 3, 1.2, 0, 'north', 1), g('grunt', 3, 1.2, 0, 'west', 0), g('grunt', 3, 1.2, 0, 'south-west', 1), g('grunt', 3, 1.2, 0, 'far-south', 0)] },
    { name: 'The Road Behind the Keep', flavor: 'A new crack opens in the south-east. They will reach the gate without crossing the brook.', groups: [g('grunt', 4, 1.5, 0, 'east-flank', 0), g('trickster', 5, 0.8, 0, 'west', 2), g('troll', 1, 1, 0, 'north', 4)] },
    { name: 'Dawn Chorus',            flavor: 'Bats from the far south, a rush from the north-west, grunts round the back.', groups: [g('bat', 3, 1.0, 0, 'far-south', 0), g('trickster', 7, 0.6, 0, 'north-west', 1), g('grunt', 3, 1.4, 0, 'east-flank', 3)] },
    { name: 'Every Gate in Turn',     flavor: 'The Hollow leans on each road in turn.',                                   groups: [g('troll', 2, 2.4, 0, 'west', 0), g('grunt', 6, 0.9, 0, 'north', 1), g('trickster', 5, 0.65, 0, 'south-west', 2), g('bat', 2, 1.2, 0, 'far-south', 6)] },
    { name: 'Pincer and Flank',       flavor: 'Trolls on two roads, grunts round the back, bats from the far south.',                                groups: [g('troll', 2, 2.3, 0, 'north-west', 0), g('troll', 2, 2.3, 0, 'south-west', 1), g('bat', 3, 1.0, 0, 'far-south', 3), g('grunt', 6, 0.85, 0, 'east-flank', 4)] },
    { name: 'Six Roads at Once',      flavor: 'All six gates open together. The keep shakes.',                            groups: [g('grunt', 7, 0.9, 0, 'west', 0), g('trickster', 7, 0.6, 0, 'north-west', 0), g('troll', 2, 2.0, 0, 'north', 0), g('grunt', 5, 1.0, 0, 'south-west', 0), g('bat', 4, 1.0, 0, 'far-south', 6), g('grunt', 5, 1.0, 0, 'east-flank', 0)] },
    { name: 'The Long Dawn',          flavor: 'A Troll column, a Trickster rush, a Bat swarm and a flank, all at once.', groups: [g('troll', 3, 2.1, 0, 'west', 0), g('trickster', 12, 0.45, 0, 'north-west', 0), g('bat', 6, 0.7, 0, 'far-south', 0), g('grunt', 8, 0.8, 0, 'east-flank', 0)] },
    { name: 'The Gloam-Moths Rise',   flavor: 'Something vast unfolds over the Hollow. Only Druids and Artillery reach it.', groups: [g('bat', 4, 1.0, 0, 'far-south', 0), g('grunt', 5, 0.9, 0, 'north', 1), g('gloam', 1, 1, 0, 'north-west', 8), g('grunt', 4, 0.9, 0, 'east-flank', 2)] },
  ];

  function buildScene(kit) {
    DawnKit.brook(kit);
    DawnKit.spawns(kit);
    DawnKit.bastion(kit, { bannerField: kit.PALETTE.tunic, bannerStripe: kit.PALETTE.gold });
    DawnKit.meadow(kit, 9091);
  }

  // every western road joins the row-8 trunk at (12,8), then one shared
  // tail crosses the brook at (14,8) to the gate; the east flank is the
  // exception and reaches the gate cell directly from the south-east
  const tail = [[12, 8], [18, 8]];
  return {
    id: 'flanked-keep',
    index: 9,
    name: 'The Flanked Keep',
    subtitle: 'Six roads out of the Hollow, and one circles behind the keep.',
    map: { x: 592, y: 138, reclaim: 90, icon: 'sunkeep' },
    grid: { cols: 22, rows: 14 },
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    spawn: [0, 7],
    routes: [
      { id: 'west',       waypoints: [[0, 7], [3, 7], [3, 9], [6, 9], [6, 7], [9, 7], [9, 8], ...tail] },
      { id: 'north-west', waypoints: [[0, 1], [4, 1], [4, 3], [8, 3], [8, 5], [12, 5], ...tail] },
      { id: 'north',      waypoints: [[10, 0], [10, 1], [11, 1], [11, 3], [12, 3], ...tail] },
      { id: 'south-west', waypoints: [[0, 13], [4, 13], [4, 11], [8, 11], [8, 10], [12, 10], ...tail] },
      { id: 'far-south',  waypoints: [[10, 13], [10, 12], [12, 12], [12, 10], ...tail] },
      { id: 'east-flank', waypoints: [[21, 13], [21, 11], [19, 11], [19, 10], [17, 10], [17, 9], [18, 9], [18, 8]] },
    ],
    chokepoint: { cell: [14, 8], streamCol: 14, streamRows: [4, 12] },
    endpoint: {
      name: 'the Bastion', properName: 'The Bastion',
      cells: [[18, 5], [19, 5], [18, 6], [19, 6], [18, 7], [19, 7]], gateCell: [18, 7],
    },
    cobbleTailCells: 3,
    theme: {
      center: [0, 7], radiusOut: { x: 13, z: 11 }, radiusIn: 0.7, falloffWidth: 0.5,
      foothold: { center: [18.5, 6], radius: 4, falloffWidth: 2 },
      backdrop: 0x3d2f5c, groundMeadow: 0x8cc055, groundMeadowDark: 0x74a845, ambient: 0.42,
      sky: 0xffe2c2, bounce: 0x7a5a6e, sun: 0.78, fill: 0xb59adf, fillIntensity: 0.2,
      motes: { fireflies: 18, spores: 8 },
    },
    spawnBlockedText: 'The Hollow is seeping up through this ground.',
    waves, prepSeconds: 14, startGold: 240, startLives: 20, starThresholds: [16, 8],
    tipTile: [2, 6],
    endScreenText: {
      3: () => 'Thirteen waves, six gates, and a dawn that stayed gold. The Gloam-Moths scattered and the Bastion never flinched.',
      2: (s) => `Six roads and one flank, ${s.lives} lives to spare. The Bastion holds, and the sun is fully up.`,
      1: (s) => `The keep took a beating, and the Gloam-Moths nearly reached the door, but the Bastion holds, with ${s.lives} lives to spare.`,
      lose: (s) => `The Bastion fell on wave ${s.wave}. Watch the horns for which gate opens next, and guard the road behind the keep.`,
    },
    buildScene,
  };
})();
