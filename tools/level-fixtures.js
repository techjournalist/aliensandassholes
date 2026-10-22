// Per-level test fixtures for tools/playtest.js: the tile coordinates, gold
// amounts and wave counts that are literal to one level's own geometry and
// wave table. Level 1's entry also drives the mechanic-level suite (tile
// rules, placing, upgrades, the flying rule, rooting, branch duels); every
// level then gets the same lone-tower, mixed-bot and single-type checks.
// `node /path/to/scratchpad/gridmap.js`-style maps of the grids are worth
// printing before picking tiles: '+' must be buildable, '#' road, '~' water.
module.exports = {
  hollybrook: {
    roadTile: [3, 4], streamTile: [10, 2], farTile: [1, 9],
    firstSlingerTile: [4, 6], secondSlingerTile: [7, 5], brokeTile: [11, 4],
    towerSpots: { warden: [5, 6], druid: [7, 4], golem: [8, 4], artillery: [13, 4] },
    // two tiles for the branch duels, by the cobbled last stretch before the
    // manor gate. Duel scores swing with how much road the pair can see:
    // beside the doubled-back bends everything scores ~100% and nothing
    // separates. Picked by scanning every adjacent pair on the curved road
    // over six lane seeds: here every tower's two branches each win a
    // scenario by at least 31% on every seed (the old pair [2,4],[2,5] fell
    // to 5% on some seeds, and the browser's Hammer Knight duel tied).
    duelTiles: [[17, 10], [16, 10]],
    // the tip tile first, then spots inside the road's own doubled-back bends
    botBuildSpots: [[4, 6], [5, 6], [7, 4], [4, 3], [8, 5], [7, 6], [11, 5], [13, 4], [2, 3], [11, 3], [13, 7], [8, 4], [11, 7], [14, 4], [16, 4], [14, 9]],
    botPlan: ['slinger', 'slinger', 'warden', 'druid', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem', 'artillery'],
    bossStagePlacements: { druid: [[7, 4], [4, 6]], artillery: [[13, 4], [5, 6]], golem: [[8, 4]], warden: [[11, 5]] },
    waveCount: 12, hasBossOnWave: 12, bossType: 'ram',
  },
  ravensford: {
    roadTile: [5, 3], streamTile: [13, 2], farTile: [18, 10],
    firstSlingerTile: [4, 3],
    // one lone Squire per road, near that road's entry (per-road wave-1 check)
    laneSlingerTiles: { kings: [4, 3], forest: [2, 10] },
    // the tip tile, then the junction where both roads meet, then each
    // road's loops. [2,10] is 4th on purpose: the plan's first Magus lands
    // there, right where wave 5's gargoyles come in on the Forest Track.
    botBuildSpots: [[4, 3], [10, 7], [12, 5], [2, 10], [6, 9], [12, 7], [7, 4], [10, 5], [14, 7], [6, 3], [10, 9], [14, 5], [9, 3], [12, 9], [16, 7], [2, 7]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 12, hasBossOnWave: null,
  },
  'st-wendels': {
    roadTile: [5, 4], streamTile: [14, 2], farTile: [18, 11],
    firstSlingerTile: [2, 6],
    laneSlingerTiles: { mill: [2, 6], pilgrims: [5, 1], fen: [7, 12] },
    // tip first, then the junction stretch of row 6, then the switchback's
    // pockets. [13,7] (4th) is where the first Magus lands: beside the
    // bridge, which every road's gargoyles cross.
    botBuildSpots: [[2, 6], [11, 7], [9, 5], [13, 7], [8, 7], [11, 5], [6, 5], [3, 3], [13, 5], [9, 10], [5, 8], [15, 7], [15, 5], [8, 8], [7, 12], [4, 1]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 12, hasBossOnWave: 12, bossType: 'stonelord',
  },
  'castle-aldermere': {
    roadTile: [3, 9], streamTile: [16, 2], farTile: [2, 5],
    firstSlingerTile: [2, 8],
    laneSlingerTiles: { highway: [2, 8], ridge: [3, 1], fen: [13, 9] },
    // tip first, then the row-6 trunk where all three roads run together
    // ([12,7] is the first Magus, covering every road's gargoyles), then the
    // Ridge Road's hairpin pockets and the Fen loop.
    botBuildSpots: [[2, 8], [9, 7], [10, 5], [12, 7], [13, 9], [7, 5], [13, 5], [8, 3], [15, 7], [12, 9], [9, 10], [15, 5], [3, 1], [18, 7], [7, 10], [18, 5]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 14, hasBossOnWave: 14, bossType: 'dragon',
  },
  'highcrag-pass': {
    roadTile: [12, 2], streamTile: [6, 2], farTile: [1, 1],
    firstSlingerTile: [17, 3],
    laneSlingerTiles: { goat: [17, 3], low: [16, 10] },
    // tip first (the goat track's first bend), then the ground east of the
    // gorge where both roads run together; [13,8] (4th, the first Magus)
    // sees the low pass, where wave 5's gargoyles come in
    botBuildSpots: [[17, 3], [9, 8], [16, 10], [13, 8], [7, 8], [10, 8], [12, 6], [14, 6], [4, 8], [13, 3], [8, 6], [14, 5], [11, 6], [15, 3], [12, 8], [4, 10]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 13, hasBossOnWave: 13, bossType: 'giant',
  },
  'wickham-fair': {
    roadTile: [1, 5], streamTile: [7, 2], farTile: [15, 2],
    firstSlingerTile: [2, 3],
    laneSlingerTiles: { west: [2, 3], mill: [2, 9], east: [18, 10] },
    // tip first, then the market square where all three roads meet; [9,6]
    // (4th, the first Magus) sees every road's last stretch, so every
    // road's gargoyles pass it
    botBuildSpots: [[2, 3], [8, 6], [11, 6], [9, 6], [9, 5], [11, 8], [12, 6], [6, 8], [4, 8], [9, 8], [11, 5], [3, 6], [10, 8], [14, 10], [2, 9], [5, 6]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 13, hasBossOnWave: 13, bossType: 'ravens',
  },
  'saltmarsh-quay': {
    roadTile: [4, 4], streamTile: [12, 2], farTile: [8, 1],
    firstSlingerTile: [3, 3],
    laneSlingerTiles: { shore: [3, 3], dunes: [3, 11], beach: [15, 11] },
    // tip first, then [11,7] where the shore road and the dune path meet,
    // then the headland below the lighthouse where the beach track joins
    // them; [17,7] (4th, the first Magus) sees all three roads
    botBuildSpots: [[3, 3], [11, 7], [16, 5], [17, 7], [16, 8], [17, 5], [14, 7], [16, 7], [9, 7], [17, 8], [18, 7], [13, 5], [19, 5], [3, 11], [7, 9], [8, 7]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 13, hasBossOnWave: 13, bossType: 'wyvern',
  },
  'amberlea-vineyards': {
    roadTile: [3, 4], streamTile: [8, 6], farTile: [1, 1],
    firstSlingerTile: [2, 5],
    laneSlingerTiles: { vine: [2, 5], orchard: [2, 10], cellar: [10, 12] },
    // tip first, then the hillside beside the mill, where a tower sees the
    // Vine Road twice; [16,10] (4th, the first Magus) also watches the
    // Cellar Lane, wave 5's gargoyle road
    botBuildSpots: [[2, 5], [16, 8], [15, 11], [16, 10], [16, 7], [16, 4], [5, 4], [15, 4], [18, 8], [14, 10], [7, 4], [16, 5], [18, 9], [16, 11], [10, 12], [2, 10]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 13, hasBossOnWave: 13, bossType: 'siegetower',
  },
  'blackmoor-lines': {
    roadTile: [3, 8], streamTile: [14, 2], farTile: [20, 1],
    firstSlingerTile: [2, 6],
    laneSlingerTiles: { west: [2, 6], northwest: [3, 1], north: [10, 1], southwest: [3, 12], farsouth: [10, 12], flank: [20, 12] },
    // tip first, then the junction before the ditch where five roads run
    // together; [13,8] (4th, the first Magus) also sees the far-south road
    botBuildSpots: [[2, 6], [11, 6], [11, 8], [13, 8], [15, 8], [13, 6], [15, 6], [16, 8], [9, 6], [11, 9], [9, 8], [13, 5], [16, 6], [18, 8], [11, 5], [8, 8]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 13, hasBossOnWave: 13, bossType: 'warlock',
  },
  'black-keep': {
    roadTile: [5, 9], streamTile: [7, 2], farTile: [10, 1],
    firstSlingerTile: [1, 8],
    laneSlingerTiles: { westmid: [1, 8], westhigh: [2, 1], westlow: [2, 12], easthigh: [20, 2], eastlow: [20, 12] },
    // tip first, then the western junction and the eastern one; [12,9]
    // (4th, the first Magus) sees both eastern roads, where the first
    // gargoyles come; [15,5] sits inside the High Road's last bend
    botBuildSpots: [[1, 8], [6, 9], [12, 7], [12, 9], [6, 7], [9, 7], [15, 5], [9, 9], [4, 8], [13, 6], [10, 9], [8, 7], [15, 11], [4, 9], [6, 10], [17, 4]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 14, hasBossOnWave: 14, bossType: 'baron',
  },
};
