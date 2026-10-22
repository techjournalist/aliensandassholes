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
    // two tiles beside a straight stretch of road, for the branch duels.
    // Duel scores swing with how much road the pair can see: beside the
    // doubled-back bends everything scores ~100% and nothing separates.
    // Watch the Pitchpot Friar here: Tar Abbot only out-scores Firepot Friar
    // on the mixed stream (~98 vs 88) and ties on Black Knights, a thin edge.
    duelTiles: [[2, 4], [2, 5]],
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
};
