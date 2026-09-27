// Per-level test fixtures for tools/playtest.js: the tile coordinates, gold
// amounts, and wave counts that are literal to one level's own geometry and
// wave table. Filled in by hand during that level's own build turn (P3-M1,
// P3-M2, ...); tools/playtest.js currently drives Level 1 directly rather
// than looping this table, since there is only one entry so far. Once a
// second level exists, playtest.js should iterate this table instead of
// repeating Level 1's literals inline.
module.exports = {
  'shadow-hollow': {
    roadTile: [6, 6], streamTile: [8, 2], farTile: [1, 8],
    firstSlingerTile: [7, 5], secondSlingerTile: [9, 5],
    towerSpots: { warden: [7, 5], druid: [9, 5], golem: [12, 4], artillery: [13, 7] },
    upgradeProbeTile: [7, 5],
    botBuildSpots: [[7, 5], [6, 5], [9, 5], [7, 7], [10, 5], [12, 4], [13, 7], [15, 8], [5, 5], [3, 3], [13, 4], [15, 10], [5, 7], [12, 7], [3, 1], [15, 4]],
    bossStagePlacements: { druid: [[9, 5], [7, 5]], artillery: [[13, 7], [5, 5]], golem: [[12, 4]], warden: [[10, 5]] },
    waveCount: 12, hasBossOnWave: 12,
  },
  'millbrook-watch': {
    roadTile: [4, 3], streamTile: [9, 2], farTile: [1, 9],
    firstSlingerTile: [2, 4], secondSlingerTile: [3, 2],
    towerSpots: { warden: [10, 5], druid: [10, 7], golem: [12, 5], artillery: [14, 7] },
    upgradeProbeTile: [2, 4],
    botBuildSpots: [[2, 4], [3, 2], [5, 7], [6, 7], [10, 3], [10, 5], [10, 7], [12, 3], [12, 5], [12, 7], [14, 5], [14, 7], [15, 3], [16, 3], [16, 4], [6, 9]],
    waveCount: 10, hasBossOnWave: null,
  },
  'cairnwatch': {
    roadTile: [3, 5], streamTile: [9, 2], farTile: [0, 11],
    firstSlingerTile: [2, 6], secondSlingerTile: [2, 4],
    towerSpots: { warden: [8, 4], druid: [8, 7], golem: [13, 5], artillery: [13, 7] },
    upgradeProbeTile: [2, 6],
    botBuildSpots: [[2, 4], [2, 6], [4, 1], [5, 1], [8, 4], [8, 7], [6, 7], [10, 10], [11, 8], [13, 5], [13, 7], [14, 2], [15, 4], [15, 5], [16, 7], [18, 7]],
    waveCount: 12, hasBossOnWave: null,
  },
  'splintered-vale': {
    roadTile: [5, 6], streamTile: [13, 2], farTile: [19, 12],
    firstSlingerTile: [3, 2],
    // one lone Slinger per road, near that road's entry (per-road wave-1 check)
    laneSlingerTiles: { shortcut: [3, 2], long: [5, 0], south: [3, 9] },
    // the tip tile for wave 1, then the junction and shared trunk (every
    // road passes there), then the lane entries. Entry-first lost at wave 9:
    // covering three roads separately costs three times as much.
    botBuildSpots: [[3, 2], [8, 5], [8, 7], [10, 5], [6, 7], [10, 7], [12, 5], [12, 7], [4, 4], [3, 9], [10, 3], [14, 5], [14, 7], [8, 2], [5, 2], [16, 7]],
    // three Slingers first, one per lane's early threat
    botPlan: ['slinger', 'slinger', 'slinger', 'warden', 'druid', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 12, hasBossOnWave: null,
  },
  'elderroot-ward': {
    roadTile: [4, 4], streamTile: [2, 4], farTile: [18, 13],
    firstSlingerTile: [3, 3],
    botBuildSpots: [[0, 5], [5, 4], [5, 8], [3, 12], [8, 13], [12, 13], [16, 11], [16, 7], [16, 3], [12, 3], [8, 3], [6, 5], [11, 4], [14, 7], [11, 10]],
    botPlan: ['slinger', 'slinger', 'warden', 'druid', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 14, hasBossOnWave: 14,
  },
  'sunken-market': {
    roadTile: [8, 5], streamTile: [12, 2], farTile: [17, 10],
    firstSlingerTile: [2, 4],
    // one lone Slinger per road, near that road's entry (per-road wave-1 check)
    laneSlingerTiles: { 'market-row': [2, 4], 'north-docks': [6, 1], 'south-docks': [6, 9] },
    // the tip tile first, then the junction and shared trunk (every road
    // passes there once merged), then each road's own entry
    botBuildSpots: [[2, 4], [7, 4], [7, 6], [9, 4], [9, 6], [11, 4], [11, 6], [13, 4], [13, 6], [6, 1], [6, 9], [4, 1], [4, 9], [14, 4], [3, 6], [3, 4]],
    // druid before warden: at 109 gold after 3 Slingers, a 110-cost Warden
    // was one gold short and stalled the whole build queue for two waves
    // (the bot only tries the next planned type, never skips to a cheaper
    // one); a 90-cost Druid clears that gap and keeps towers coming.
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 12, hasBossOnWave: null,
  },
};
