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
};
