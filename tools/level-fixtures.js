// Per-level test fixtures for tools/playtest.js and tools/bot-runner.js: the
// tile coordinates, gold amounts and wave counts that are literal to one
// level's own geometry and wave table. Level 1's entry also drives the
// mechanic-level suite (tile rules, placing, upgrades, the flying rule,
// rooting, branch duels); every level then gets the same lone-tower, mixed-bot
// and single-type checks. botBuildSpots start with the tip tile, then the
// plots that see the most road (ranked by a coverage scan, later stretches of
// road weighted higher); laneSlingerTiles hold one plot near each road's entry.
module.exports = {
  'greenhope': {
    roadTile: [5, 9], streamTile: [10, 3], farTile: [0, 9],
    firstSlingerTile: [4, 5], secondSlingerTile: [6, 4], brokeTile: [11, 4],
    towerSpots: { warden: [6, 7], druid: [8, 5], golem: [8, 8], artillery: [13, 5] },
    // two tiles for the branch duels, by the last stretch before the homestead
    duelTiles: [[16, 9], [16, 10]],
    bossStagePlacements: { druid: [[8, 5], [4, 5]], artillery: [[13, 5], [6, 7]], golem: [[8, 8]], warden: [[11, 8]] },
    botBuildSpots: [[4, 5], [13, 7], [13, 5], [7, 7], [5, 2], [13, 8], [8, 7], [13, 6], [6, 2], [7, 8], [13, 4], [2, 2], [13, 9], [8, 8], [6, 3], [2, 3]],
    botPlan: ['slinger', 'slinger', 'warden', 'druid', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem', 'artillery'],
    waveCount: 12, hasBossOnWave: 12, bossType: 'drilltank',
  },
  'crater-rim': {
    firstSlingerTile: [4, 3],
    laneSlingerTiles: {rim: [3,3], gully: [5,9]},
    botBuildSpots: [[4, 3], [15, 5], [16, 5], [8, 8], [18, 9], [10, 7], [3, 9], [16, 11], [15, 6], [7, 8], [3, 3], [15, 4], [11, 7], [4, 9], [17, 11], [4, 5]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 12, hasBossOnWave: 12, bossType: 'gloopking',
  },
  'glowshroom-grove': {
    firstSlingerTile: [2, 5],
    laneSlingerTiles: {lane: [4,4], ridge: [11,4], fen: [4,11]},
    botBuildSpots: [[2, 5], [16, 5], [16, 6], [19, 10], [11, 8], [17, 5], [18, 12], [9, 6], [17, 7], [11, 6], [17, 12], [8, 3], [5, 10], [17, 4], [9, 8], [16, 7]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 12, hasBossOnWave: 12, bossType: 'hivequeen',
  },
  'comms-ridge': {
    firstSlingerTile: [2, 7],
    laneSlingerTiles: {highway: [4,9], ridge: [3,2], fen: [2,11]},
    botBuildSpots: [[2, 7], [19, 5], [18, 5], [21, 10], [13, 7], [18, 6], [19, 12], [11, 5], [8, 10], [4, 2], [18, 7], [13, 8], [4, 11], [20, 12], [9, 4], [18, 4]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 14, hasBossOnWave: 14, bossType: 'manta',
  },
  'dune-sea': {
    firstSlingerTile: [3, 2],
    laneSlingerTiles: {caravan: [5,2], wash: [6,10]},
    botBuildSpots: [[3, 2], [14, 4], [16, 7], [8, 8], [15, 3], [18, 10], [12, 6], [7, 10], [7, 3], [16, 12], [16, 4], [10, 6], [4, 9], [18, 8], [6, 4], [12, 5]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 13, hasBossOnWave: 13, bossType: 'sandworm',
  },
  'spaceport': {
    firstSlingerTile: [2, 3],
    laneSlingerTiles: {west: [1,4], mill: [5,10], east: [18,4]},
    botBuildSpots: [[2, 3], [11, 6], [11, 7], [6, 8], [16, 9], [10, 5], [3, 9], [17, 4], [13, 7], [3, 6], [9, 7], [5, 9], [17, 9], [18, 4], [1, 4], [2, 9]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 13, hasBossOnWave: 13, bossType: 'sporecloud',
  },
  'glacier-shelf': {
    firstSlingerTile: [2, 3],
    laneSlingerTiles: {shore: [1,4], floe: [2,10], ridge: [17,2]},
    botBuildSpots: [[2, 3], [14, 8], [12, 5], [15, 8], [11, 5], [3, 7], [14, 9], [7, 6], [12, 4], [2, 10], [7, 8], [17, 2], [15, 9], [3, 8], [11, 4], [1, 4]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 13, hasBossOnWave: 13, bossType: 'tripod',
  },
  'bloomfruit': {
    firstSlingerTile: [3, 2],
    laneSlingerTiles: {vine: [2,2], orchard: [3,7], cellar: [4,11]},
    botBuildSpots: [[3, 2], [15, 11], [15, 3], [10, 5], [16, 10], [16, 4], [6, 7], [11, 4], [16, 8], [14, 11], [16, 3], [6, 8], [13, 4], [3, 11], [16, 7], [4, 5]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 13, hasBossOnWave: 13, bossType: 'harvester',
  },
  'hive-front': {
    firstSlingerTile: [2, 6],
    laneSlingerTiles: {west: [4,8], northwest: [2,2], north: [10,5], southwest: [4,11], farsouth: [11,9], flank: [20,11]},
    botBuildSpots: [[2, 6], [17, 9], [17, 10], [12, 9], [8, 9], [17, 8], [11, 7], [15, 10], [8, 7], [4, 11], [12, 10], [18, 12], [8, 6], [16, 7], [3, 3], [5, 11]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 13, hasBossOnWave: 13, bossType: 'brain',
  },
  'terraformer-prime': {
    firstSlingerTile: [1, 8],
    laneSlingerTiles: {westmid: [3,9], westhigh: [2,3], westlow: [2,12], easthigh: [19,4], eastlow: [17,10]},
    botBuildSpots: [[1, 8], [10, 8], [12, 8], [6, 8], [17, 10], [4, 10], [11, 8], [19, 4], [16, 8], [8, 7], [3, 12], [2, 4], [18, 10], [13, 8], [6, 10], [18, 4]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 14, hasBossOnWave: 14, bossType: 'mothership',
  },
};
