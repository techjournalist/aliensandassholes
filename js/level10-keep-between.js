// ===================================================================
// LEVEL 10 — The Keep Between
// The Bastion stands mid-valley with the Hollow on both sides of it.
// Three curving roads converge from the west and cross the brook; two
// more come in from the east, behind the keep, and meet them at the
// gate. Two fronts, two merge points, one keep. Reuses the multi-route
// engine exactly as Level 4 built it; the scene comes from js/dawn-kit.js.
// ===================================================================
const LEVEL_10 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: 'First Light',            flavor: 'Grunts trudge in on the west road. The rest are still quiet.',            groups: [g('grunt', 5, 3.2, 0, 'west-mid')] },
    { name: 'The High Road Stirs',    flavor: 'The high road opens. Watch for the horn.',                                 groups: [g('grunt', 4, 2.3, 0, 'west-mid', 0), g('grunt', 3, 2.6, 0, 'west-high', 4)] },
    { name: 'Quick Feet at Dawn',     flavor: 'Bog-Tricksters dash up the low road.',                                     groups: [g('grunt', 4, 1.6, 0, 'west-mid', 0), g('trickster', 3, 1.2, 0, 'west-low', 3)] },
    { name: 'The Far Side',           flavor: 'A crack opens east of the keep. They come in behind you.',                 groups: [g('grunt', 4, 2.0, 0, 'east-high', 0), g('grunt', 4, 1.6, 0, 'west-mid', 3)] },
    { name: 'Wings at Sunrise',       flavor: 'Bramble Bats rise in the east. Druids and Artillery only.',               groups: [g('bat', 2, 1.5, 0, 'east-low', 0), g('grunt', 6, 1.1, 0, 'west-high', 3)] },
    { name: 'Both Fronts',            flavor: 'Every road at once, from both sides of the keep.',                        groups: [g('grunt', 3, 1.3, 0, 'west-high', 0), g('grunt', 2, 1.3, 0, 'west-mid', 0), g('grunt', 3, 1.3, 0, 'west-low', 0), g('grunt', 3, 1.3, 0, 'east-high', 2), g('grunt', 2, 1.3, 0, 'east-low', 2)] },
    { name: 'The Troll Crosses',      flavor: 'A Troll on the high road, a rush from the south-east.',                   groups: [g('troll', 1, 1, 0, 'west-high', 0), g('trickster', 6, 0.7, 0, 'east-low', 2), g('grunt', 5, 1.2, 0, 'west-mid', 4)] },
    { name: 'Dawn Chorus',            flavor: 'Bats in the north-east, Tricksters from the low road.',                   groups: [g('bat', 3, 1.1, 0, 'east-high', 0), g('trickster', 7, 0.6, 0, 'west-low', 1), g('grunt', 5, 1.0, 0, 'east-low', 3)] },
    { name: 'The Keep Between',       flavor: 'The Hollow leans on both fronts in turn.',                                groups: [g('troll', 2, 2.4, 0, 'east-low', 0), g('grunt', 6, 0.9, 0, 'west-mid', 1), g('trickster', 5, 0.65, 0, 'west-high', 2), g('bat', 2, 1.2, 0, 'east-high', 6)] },
    { name: 'Pincer',                 flavor: 'Trolls down the low road and the north-east, bats over the high road.',   groups: [g('troll', 2, 2.4, 0, 'west-low', 0), g('troll', 1, 2.3, 0, 'east-high', 1), g('bat', 2, 1.2, 0, 'west-high', 3), g('grunt', 5, 0.9, 0, 'east-low', 4)] },
    { name: 'Five Gates at Once',     flavor: 'Every gate at once. The keep shakes.',                                    groups: [g('grunt', 8, 0.8, 0, 'west-mid', 0), g('trickster', 8, 0.55, 0, 'east-low', 0), g('troll', 2, 2.0, 0, 'west-high', 0), g('grunt', 6, 0.9, 0, 'west-low', 0), g('bat', 2, 1.2, 0, 'east-high', 6)] },
    { name: 'The Long Dawn',          flavor: 'A Troll column, a Trickster rush and a Bat swarm, all at once.',          groups: [g('troll', 3, 2.1, 0, 'east-high', 0), g('trickster', 10, 0.5, 0, 'west-low', 0), g('bat', 3, 1.0, 0, 'west-high', 0), g('grunt', 6, 0.8, 0, 'east-low', 0)] },
    { name: 'The Heartbloom Opens',   flavor: 'The Hollow grows a heart of its own. Only Druids and Artillery reach it.', groups: [g('bat', 3, 1.0, 0, 'west-high', 0), g('grunt', 4, 0.9, 0, 'west-low', 1), g('heartbloom', 1, 1, 0, 'east-high', 4)] },
  ];

  function buildScene(kit) {
    DawnKit.brook(kit);
    DawnKit.spawns(kit);
    DawnKit.bastion(kit, { bannerField: kit.PALETTE.magic, bannerStripe: kit.PALETTE.gold });
    DawnKit.meadow(kit, 10101);
  }

  // west roads share the row-8 run from (5,8), east roads the run from
  // (13,8); both end on (10,8), just under the gate
  const westTail = [[5, 8], [10, 8]];
  const eastTail = [[13, 8], [10, 8]];
  return {
    id: 'keep-between',
    index: 10,
    name: 'The Keep Between',
    subtitle: 'The Hollow on both sides, and the Bastion in the middle.',
    map: { x: 380, y: 252, reclaim: 90, icon: 'sunkeep' },
    grid: { cols: 22, rows: 14 },
    curvyRoads: true,   // the road is a smooth ribbon and enemies follow the curve
    spawn: [0, 8],
    routes: [
      { id: 'west-mid',  waypoints: [[0, 8], [2, 8], [2, 9], [4, 9], [4, 8], ...westTail] },
      { id: 'west-high', waypoints: [[0, 1], [3, 1], [3, 3], [6, 3], [6, 5], [5, 5], ...westTail] },
      { id: 'west-low',  waypoints: [[0, 13], [3, 13], [3, 11], [5, 11], ...westTail] },
      { id: 'east-high', waypoints: [[21, 1], [18, 1], [18, 3], [15, 3], [15, 5], [13, 5], ...eastTail] },
      { id: 'east-low',  waypoints: [[21, 13], [18, 13], [18, 11], [15, 11], [15, 10], [13, 10], ...eastTail] },
    ],
    chokepoint: { cell: [8, 8], streamCol: 8, streamRows: [4, 12] },
    endpoint: {
      name: 'the Bastion', properName: 'The Bastion',
      cells: [[10, 5], [11, 5], [10, 6], [11, 6], [10, 7], [11, 7]], gateCell: [10, 7],
    },
    cobbleTailCells: 3,
    theme: {
      center: [0, 7], radiusOut: { x: 14, z: 11 }, radiusIn: 0.8, falloffWidth: 0.5,
      foothold: { center: [10.5, 6], radius: 4, falloffWidth: 2 },
      backdrop: 0x4a2f5a, groundMeadow: 0x93c45a, groundMeadowDark: 0x79ab48, ambient: 0.42,
      sky: 0xffd8b8, bounce: 0x80566a, sun: 0.8, fill: 0xc09ae0, fillIntensity: 0.2,
      motes: { fireflies: 20, spores: 6 },
    },
    spawnBlockedText: 'The Hollow is seeping up through this ground.',
    waves, prepSeconds: 14, startGold: 260, startLives: 20, starThresholds: [16, 8],
    tipTile: [1, 7],
    endScreenText: {
      3: () => 'Thirteen waves, two fronts, and the Heartbloom withered at the gate. The keep between the cracks stands, bright as morning.',
      2: (s) => `Both fronts held, ${s.lives} lives to spare. The Bastion stands in full daylight.`,
      1: (s) => `The Heartbloom nearly reached the door, but the Bastion holds, with ${s.lives} lives to spare.`,
      lose: (s) => `The Bastion fell on wave ${s.wave}. Watch both sides of the keep, and remember only Druids and Artillery reach the bats.`,
    },
    buildScene,
  };
})();
