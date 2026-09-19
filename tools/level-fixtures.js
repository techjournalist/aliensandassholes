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
};
