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
    waveCount: 13, hasBossOnWave: 13,
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
    waveCount: 13, hasBossOnWave: 13,
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
    // wave 13 (added): The Drowned Swarm, a new finale boss.
    waveCount: 13, hasBossOnWave: 13,
  },
  'amber-terraces': {
    roadTile: [9, 7], streamTile: [15, 2], farTile: [1, 11],
    firstSlingerTile: [2, 2],
    laneSlingerTiles: { 'grove-path': [2, 2], 'hollow-way': [3, 2], 'basket-road': [3, 11] },
    // tip first, then the trunk between the junctions and the tram line,
    // then each road's own entry (same druid-before-warden lesson as
    // sunken-market: 3 Slingers leave 109 gold, one short of a Warden).
    // [10,8] is 4th on purpose: that's where the plan's first Druid lands,
    // and it's the one spot in range of the whole Basket Road approach
    // (col 9, rows 7-10) — anywhere else left every bat on wave 5 untouched.
    botBuildSpots: [[2, 2], [6, 6], [6, 8], [10, 8], [8, 8], [10, 6], [8, 6], [12, 6], [12, 8], [14, 6], [14, 8], [3, 2], [3, 11], [11, 2], [9, 5], [16, 6]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    // wave 13 (added): The Hive Matriarch, a new finale boss.
    waveCount: 13, hasBossOnWave: 13,
  },
  'frostpine-camp': {
    roadTile: [9, 10], streamTile: [11, 2], farTile: [14, 3],
    firstSlingerTile: [2, 5],
    laneSlingerTiles: { 'scree-path': [2, 5], 'high-trail': [10, 1], 'frozen-draw': [2, 14] },
    // tip first, then trunk spots either side of the shared row-10 run and
    // the ice-log crossing, then each road's own entry. [5,12] is 4th on
    // purpose: that's where the plan's first Druid lands, and it's the one
    // spot in range of the whole Frozen Draw's vertical approach (col 4,
    // rows 10-13) — same druid-before-warden gold-cliff lesson as the
    // other two levels (3 Slingers leave 109 gold, one short of a Warden).
    // [10,8] (2nd druid, position 7) covers High Trail's own vertical
    // approach (col 9, rows 6-10) for wave 11's bats on that road.
    botBuildSpots: [[2, 5], [6, 9], [12, 9], [5, 12], [13, 9], [8, 9], [14, 9], [10, 8], [10, 1], [2, 14], [7, 7], [10, 11], [7, 2], [4, 5], [1, 5], [14, 11]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    // wave 13 (added): The Rime Swarm, a new finale boss.
    waveCount: 13, hasBossOnWave: 13,
  },
  'flanked-keep': {
    roadTile: [9, 7], streamTile: [14, 4], farTile: [20, 2],
    firstSlingerTile: [2, 6],
    laneSlingerTiles: { 'west': [2, 6], 'north-west': [1, 2], 'north': [9, 1], 'south-west': [2, 12], 'far-south': [11, 13], 'east-flank': [20, 12] },
    // trunk first: five of the six roads share the row-8 run from (12,8),
    // so towers around the junction cover them all (the Level 4 lesson).
    // [13,9] is 4th on purpose: that's where the plan's first Druid lands,
    // with the far-south road's whole vertical approach (col 12, rows 10-12)
    // in range; [16,9] (3rd) covers the flank's last steps and [19,9] (5th, where
    // the plan's Warden lands, then the anti-air the bot adds for bat waves)
    // sees 8 cells of the flank road.
    botBuildSpots: [[13, 7], [11, 7], [16, 9], [13, 9], [19, 9], [15, 7], [11, 9], [16, 7], [17, 7], [13, 10], [11, 6], [10, 9], [16, 10], [19, 8], [13, 6], [20, 9]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 13, hasBossOnWave: 13,
  },
  'keep-between': {
    roadTile: [5, 7], streamTile: [8, 4], farTile: [20, 7],
    firstSlingerTile: [1, 7],
    laneSlingerTiles: { 'west-mid': [1, 7], 'west-high': [1, 2], 'west-low': [1, 12], 'east-high': [20, 2], 'east-low': [20, 12] },
    // two trunks (west run from (5,8), east run from (13,8)) and the gate
    // between them. [14,9] is 4th on purpose: the plan's first Druid there has
    // the whole east-low approach (cols 13-15, rows 10-11) in range, which a
    // central Druid left uncovered; [14,7] (6th) does the same for east-high, and [5,4] (6th, the first spot the
    // bot's bat-wave anti-air reaches; the 5th is a ground tower) covers the high road's corner at (3,3)-(6,5), which bats use
    // (from [7,7] only the last four cells of that road were in range).
    botBuildSpots: [[6, 7], [6, 9], [12, 7], [14, 9], [11, 9], [5, 4], [14, 7], [7, 7], [9, 9], [9, 7], [12, 9], [4, 7], [14, 8], [12, 6], [4, 10], [3, 8]],
    botPlan: ['slinger', 'slinger', 'slinger', 'druid', 'warden', 'artillery', 'golem', 'druid', 'warden', 'slinger', 'golem', 'artillery', 'warden', 'druid', 'slinger', 'golem'],
    waveCount: 13, hasBossOnWave: 13,
  },
};
