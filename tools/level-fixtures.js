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
    towerSpots: { warden: [2, 3], druid: [8, 5], golem: [8, 8], artillery: [13, 5] },
    // two tiles for the branch duels, picked by scanning every adjacent pair: each
    // tower's two branches each win a scenario by 12%+ on three lane seeds
    duelTiles: [[8, 4], [8, 3]],
    bossStagePlacements: { druid: [[8, 5], [4, 5]], artillery: [[13, 5], [6, 7]], golem: [[8, 8]], warden: [[11, 8]] },
    botBuildSpots: [[4, 5], [13, 7], [13, 5], [7, 7], [5, 2], [13, 8], [8, 7], [13, 6], [6, 2], [7, 8], [13, 4], [2, 2], [13, 9], [8, 8], [6, 3], [2, 3]],
    botPlan: ['slinger', 'slinger', 'warden', 'druid', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem', 'artillery'],
    waveCount: 12, hasBossOnWave: 12, bossType: 'drilltank',
  },
  'crater-rim': {
    firstSlingerTile: [14, 2],
    laneSlingerTiles: {rim: [15,2], gully: [13,9]},
    botBuildSpots: [[14, 2], [3, 8], [2, 8], [9, 8], [13, 8], [3, 7], [8, 8], [14, 5], [3, 9], [16, 8], [10, 8], [15, 3], [6, 8], [15, 9], [2, 9], [16, 3]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 12, hasBossOnWave: 12, bossType: 'gloopking',
  },
  'glowshroom-grove': {
    firstSlingerTile: [4, 3],
    laneSlingerTiles: {lane: [5,3], ridge: [11,3], fen: [15,2]},
    botBuildSpots: [[4, 3], [6, 8], [11, 10], [6, 10], [8, 6], [12, 10], [9, 6], [7, 10], [11, 3], [5, 9], [12, 12], [15, 2], [9, 10], [7, 6], [10, 3], [5, 10]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 12, hasBossOnWave: 12, bossType: 'hivequeen',
  },
  'comms-ridge': {
    firstSlingerTile: [5, 3],
    laneSlingerTiles: {highway: [4,3], ridge: [3,7], fen: [8,10]},
    botBuildSpots: [[5, 3], [17, 8], [17, 7], [12, 7], [18, 8], [10, 7], [16, 6], [5, 9], [11, 9], [17, 9], [19, 5], [9, 7], [3, 10], [7, 9], [15, 9], [4, 3]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 14, hasBossOnWave: 14, bossType: 'manta',
  },
  'dune-sea': {
    firstSlingerTile: [3, 11],
    laneSlingerTiles: {caravan: [4,11], wash: [17,3]},
    botBuildSpots: [[3, 11], [4, 4], [11, 3], [8, 4], [5, 4], [12, 3], [16, 3], [9, 4], [7, 8], [4, 6], [14, 3], [9, 3], [8, 8], [17, 3], [5, 3], [4, 11]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 13, hasBossOnWave: 13, bossType: 'sandworm',
  },
  'spaceport': {
    firstSlingerTile: [2, 3],
    laneSlingerTiles: {west: [1,4], mill: [5,10], east: [18,4]},
    botBuildSpots: [[2, 3], [13, 7], [11, 6], [15, 9], [17, 8], [11, 7], [17, 4], [6, 9], [15, 8], [2, 9], [10, 5], [1, 4], [9, 8], [17, 7], [18, 4], [13, 6]],
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
    firstSlingerTile: [16, 2],
    laneSlingerTiles: {vine: [18,3], orchard: [2,6], cellar: [16,8]},
    botBuildSpots: [[16, 2], [10, 9], [8, 9], [7, 4], [8, 8], [12, 7], [11, 3], [5, 9], [8, 3], [11, 9], [14, 4], [4, 5], [16, 7], [4, 9], [9, 9], [12, 3]],
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
    laneSlingerTiles: {westmid: [3,9], westhigh: [2,3], westlow: [2,12], easthigh: [19,3], eastlow: [17,10]},
    botBuildSpots: [[1, 8], [8, 7], [10, 8], [6, 8], [12, 8], [4, 10], [4, 6], [11, 8], [17, 10], [6, 10], [2, 4], [3, 12], [19, 3], [13, 8], [8, 8], [18, 11]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 14, hasBossOnWave: 14, bossType: 'mothership',
  },
};
