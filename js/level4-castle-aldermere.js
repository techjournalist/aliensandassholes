// ===================================================================
// LEVEL 4 — Castle Aldermere
// The Baron throws everything at the King's own castle. Three long roads
// loop through the royal demesne: the King's Highway from the west, the
// Ridge Road hairpinning down from the north hills, and a short dash up
// from the Fen. All three join before the drawbridge over the moat, and
// on the last wave the Baron unleashes his Black Dragon.
// ===================================================================
const LEVEL_4 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: 'The Vanguard',        flavor: 'Brigands march up the King’s Highway. The siege begins.',                    groups: [g('grunt', 5, 3.2, 0, 'highway')] },
    { name: 'The Ridge Road',      flavor: 'More come down the hairpins from the north hills.',                               groups: [g('grunt', 5, 2.0, 0, 'highway', 0), g('grunt', 5, 2.0, 0, 'ridge', 4)] },
    { name: 'Fen Runners',         flavor: 'Cutpurses dash up the short Fen road. It is the quickest way in.',               groups: [g('trickster', 6, 0.8, 0, 'fen', 0), g('grunt', 5, 1.4, 0, 'highway', 3)] },
    { name: 'Knights on the Ridge', flavor: 'A Black Knight on the hairpins. Towers inside the bends hit it twice.',          groups: [g('troll', 1, 1, 0, 'ridge', 0), g('grunt', 6, 1.2, 0, 'highway', 2), g('trickster', 5, 0.8, 0, 'fen', 6)] },
    { name: 'Gargoyles',           flavor: 'Gargoyles over the Ridge Road. The Magus and the Longbowmen reach them.',        groups: [g('bat', 4, 1.2, 0, 'ridge', 0), g('grunt', 8, 1.0, 0, 'highway', 3)] },
    { name: 'Three Fronts',        flavor: 'Every road at once. The junctions are where you win.',                           groups: [g('grunt', 5, 1.0, 0, 'highway', 0), g('grunt', 5, 1.0, 0, 'ridge', 0), g('trickster', 6, 0.6, 0, 'fen', 2)] },
    { name: 'Iron Column',         flavor: 'Three Black Knights on the Highway, Cutpurses through the Fen.',                 groups: [g('troll', 2, 2.6, 0, 'highway', 0), g('trickster', 7, 0.65, 0, 'fen', 3)] },
    { name: 'Gargoyle Storm',      flavor: 'Gargoyles up the Fen, brigands down the Ridge.',                                 groups: [g('bat', 5, 0.9, 0, 'fen', 0), g('grunt', 8, 0.9, 0, 'ridge', 3), g('trickster', 5, 0.7, 0, 'highway', 6)] },
    { name: 'The Press',           flavor: 'The Baron leans on every road in turn.',                                        groups: [g('troll', 2, 2.6, 0, 'ridge', 0), g('grunt', 8, 0.8, 0, 'highway', 1), g('trickster', 6, 0.6, 0, 'fen', 6), g('bat', 4, 1.0, 0, 'highway', 10)] },
    { name: 'Pincer',              flavor: 'Knights down both long roads, gargoyles over the Fen.',                         groups: [g('troll', 2, 2.4, 0, 'highway', 0), g('troll', 1, 2.4, 0, 'ridge', 2), g('bat', 6, 0.8, 0, 'fen', 4), g('grunt', 7, 0.8, 0, 'fen', 9)] },
    { name: 'Siege Lines',         flavor: 'Ladders and torches on every road. Hold the drawbridge.',                       groups: [g('grunt', 12, 0.6, 0, 'highway', 0), g('trickster', 12, 0.45, 0, 'fen', 0), g('troll', 3, 2.0, 0, 'ridge', 0), g('bat', 6, 0.8, 0, 'ridge', 6)] },
    { name: 'Night Assault',       flavor: 'Knights, cutpurses and gargoyles, all at the same moment.',                      groups: [g('troll', 4, 2.0, 0, 'ridge', 0), g('trickster', 14, 0.4, 0, 'fen', 0), g('bat', 9, 0.55, 0, 'highway', 0)] },
    { name: 'The Last Charge',     flavor: 'The Baron’s whole host comes on. The King is watching from the walls.',     groups: [g('troll', 5, 1.8, 0, 'highway', 0), g('grunt', 14, 0.5, 0, 'ridge', 0), g('bat', 8, 0.6, 0, 'fen', 4), g('trickster', 10, 0.45, 0, 'fen', 10)] },
    { name: 'The Black Dragon',    flavor: 'The Baron unleashes his dragon. It flies and wears scale armor: Star Seers and Longbowmen, now.', groups: [g('bat', 6, 0.9, 0, 'ridge', 0), g('grunt', 10, 0.7, 0, 'highway', 1), g('troll', 2, 2.4, 0, 'fen', 3), g('dragon', 1, 1, 0, 'highway', 8)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, toon, srand, scene, animated, puff,
      masonry, towerCourses, roofCourses, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;

    // The drawbridge: a heavy plank deck lowered over the moat on two
    // chains from a pair of stone gate posts on the castle bank.
    function buildDrawbridge() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      batchPart(P(GEO.box, PALETTE.wood, M(0, 0.0, 0, { sx: 1.16, sy: 0.08, sz: 0.8 })), wm);
      for (let i = 0; i < 6; i++) batchPart(P(GEO.box, PALETTE.woodLight, M(-0.5 + i * 0.2, 0.045, 0, { sx: 0.17, sy: 0.02, sz: 0.76 }), false), wm);
      for (const s of [-1, 1]) batchPart(P(GEO.box, PALETTE.steelDark, M(0, 0.05, s * 0.36, { sx: 1.16, sy: 0.03, sz: 0.05 }), false), wm);
      for (const s of [-1, 1]) {
        // gate posts on the far (castle) bank and the chains up to them
        batchPart(P(GEO.box, PALETTE.stone, M(0.66, 0.5, s * 0.5, { sx: 0.24, sy: 1.0, sz: 0.24 })), wm);
        batchPart(P(GEO.box, PALETTE.stoneDark, M(0.66, 1.03, s * 0.5, { sx: 0.3, sy: 0.08, sz: 0.3 })), wm);
        batchPart(P(GEO.cone, PALETTE.tunic, M(0.66, 1.24, s * 0.5, { sx: 0.2, sy: 0.34, sz: 0.2 })), wm);
        for (let k = 0; k < 6; k++) {
          const u = k / 5;
          batchPart(P(GEO.ring, PALETTE.steelDark, M(-0.5 + u * 1.1, 0.06 + u * u * 0.8, s * 0.42, { s: 0.035, ry: Math.PI / 2 }), false), wm);
        }
      }
      batchPart(P(GEO.box, PALETTE.stoneDark, M(-0.62, -0.06, 0, { sx: 0.14, sy: 0.18, sz: 0.9 })), wm);
    }

    // Castle Aldermere: a curtain wall with four corner towers and a
    // twin-towered gatehouse, a tall square keep inside with blue-roofed
    // turrets flying the royal standard. The portcullis drops when the
    // castle is nearly lost.
    function buildCastle() {
      const [cx, cz] = LC.endpointCenter(kit);
      const wm = M(cx, 0, cz);
      const st = { state: 0 };
      const gx = worldX(level.endpoint.gateCell[0]) - cx;
      const W = 1.3, D = 2.1, WH = 1.1;   // half-extents of the curtain wall, its height
      batchPart(P(GEO.box, kit.lerpColor(PALETTE.cobble, PALETTE.meadow, 0.25).getHex(), M(0, 0.01, 0, { sx: W * 2, sy: 0.02, sz: D * 2 }), false), wm);
      // the curtain walls, with a wall-walk of crenellations
      const wall = (x, z, sx, sz) => {
        batchPart(P(GEO.box, PALETTE.stone, M(x, WH / 2, z, { sx, sy: WH, sz })), wm);
        const n = Math.round(Math.max(sx, sz) / 0.24);
        for (let i = 0; i < n; i++) {
          const u = -Math.max(sx, sz) / 2 + (i + 0.5) * (Math.max(sx, sz) / n);
          if (i % 2) continue;
          batchPart(P(GEO.box, PALETTE.stoneDark, sx > sz ? M(x + u, WH + 0.09, z, { sx: 0.14, sy: 0.18, sz: sz + 0.02 }) : M(x, WH + 0.09, z + u, { sx: sx + 0.02, sy: 0.18, sz: 0.14 })), wm);
        }
      };
      wall(0, -D, W * 2, 0.22); wall(-W, 0, 0.22, D * 2); wall(W, 0, 0.22, D * 2);
      wall(-W / 2 - 0.36, D, W - 0.72, 0.22); wall(W / 2 + 0.36, D, W - 0.72, 0.22);
      masonry(wm, { face: 'x', at: W + 0.11, u0: -D, u1: D, y0: 0.05, y1: WH, seed: 41, holes: [[0.3, 0.6, 0.3, 0.4]] });
      masonry(wm, { face: 'z', at: D + 0.11, u0: -W, u1: W, y0: 0.05, y1: WH, seed: 42, holes: [[gx, 0.5, 1.4, 1.2]] });
      // round towers at the four corners
      const tower = (tx, tz, r, th, roof) => {
        batchPart(P(GEO.cyl, PALETTE.stone, M(tx, th / 2, tz, { sx: r, sy: th, sz: r })), wm);
        batchPart(P(GEO.cyl, PALETTE.stoneDark, M(tx, th, tz, { sx: r + 0.07, sy: 0.1, sz: r + 0.07 })), wm);
        batchPart(P(GEO.cone, roof, M(tx, th + 0.45, tz, { sx: r + 0.1, sy: 0.9, sz: r + 0.1 })), wm);
        roofCourses(wm, { x: tx, y: th + 0.03, z: tz, r: r + 0.1, h: 0.9, color: roof, kind: 'cone', rings: 3 });
        towerCourses(wm, { x: tx, z: tz, r, y0: 0.1, y1: th - 0.08, seed: Math.round(tx * 17 + tz * 5), holes: tz > 0 ? [[0, th * 0.65, 0.34]] : [] });
        batchPart(P(GEO.sphereLo, PALETTE.gold, M(tx, th + 0.92, tz, { s: 0.04 })), wm);
      };
      tower(-W, -D, 0.34, 1.7, PALETTE.slate); tower(W, -D, 0.34, 1.7, PALETTE.slate);
      tower(-W, D, 0.34, 1.6, PALETTE.slate); tower(W, D, 0.34, 1.6, PALETTE.slate);
      // the gatehouse: two drum towers flanking the arch
      tower(gx - 0.42, D + 0.08, 0.28, 1.6, PALETTE.tunic); tower(gx + 0.42, D + 0.08, 0.28, 1.6, PALETTE.tunic);
      batchPart(P(GEO.box, PALETTE.stone, M(gx, 0.95, D + 0.06, { sx: 0.6, sy: 0.7, sz: 0.36 })), wm);
      batchPart(P(GEO.box, 0x241c18, M(gx, 0.36, D + 0.245, { sx: 0.42, sy: 0.72, sz: 0.02 }), false), wm);
      batchPart(P(GEO.cyl, 0x241c18, M(gx, 0.72, D + 0.245, { sx: 0.21, sy: 0.02, sz: 0.21, rx: Math.PI / 2 }), false), wm);
      // the portcullis: raised normally, dropped at the worst damage state
      const bars = [];
      for (let i = 0; i < 4; i++) bars.push(P(GEO.box, PALETTE.steelDark, M(-0.15 + i * 0.1, 0, 0, { sx: 0.025, sy: 0.7, sz: 0.025 })));
      for (let i = 0; i < 3; i++) bars.push(P(GEO.box, PALETTE.steelDark, M(0, -0.25 + i * 0.25, 0, { sx: 0.4, sy: 0.025, sz: 0.025 })));
      const portcullis = liveProp(bars, cx + gx, 1.05, cz + D + 0.27);
      // the keep: a tall square tower with four blue-roofed corner turrets
      const KX = 0.1, KZ = -0.55, KW = 1.2, KH = 2.9;
      batchPart(P(GEO.box, PALETTE.stone, M(KX, KH / 2, KZ, { sx: KW, sy: KH, sz: KW })), wm);
      masonry(wm, { face: 'z', at: KZ + KW / 2, u0: KX - KW / 2, u1: KX + KW / 2, y0: WH + 0.2, y1: KH, seed: 43, holes: [[KX, 2.1, 0.3, 0.4], [KX - 0.3, 1.5, 0.26, 0.34], [KX + 0.3, 1.5, 0.26, 0.34]] });
      masonry(wm, { face: 'x', at: KX + KW / 2, u0: KZ - KW / 2, u1: KZ + KW / 2, y0: WH + 0.2, y1: KH, seed: 44, holes: [[KZ, 2.1, 0.3, 0.4]] });
      for (let i = -2; i <= 2; i++) {
        batchPart(P(GEO.box, PALETTE.stoneDark, M(KX + i * 0.24, KH + 0.1, KZ + KW / 2, { sx: 0.13, sy: 0.2, sz: 0.12 })), wm);
        batchPart(P(GEO.box, PALETTE.stoneDark, M(KX + KW / 2, KH + 0.1, KZ + i * 0.24, { sx: 0.12, sy: 0.2, sz: 0.13 })), wm);
      }
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const tx = KX + ox * KW / 2, tz = KZ + oz * KW / 2;
        batchPart(P(GEO.cyl, PALETTE.stone, M(tx, KH + 0.15, tz, { sx: 0.2, sy: 0.7, sz: 0.2 })), wm);
        batchPart(P(GEO.cone, PALETTE.tunic, M(tx, KH + 0.85, tz, { sx: 0.26, sy: 0.7, sz: 0.26 })), wm);
        roofCourses(wm, { x: tx, y: KH + 0.5, z: tz, r: 0.26, h: 0.7, color: PALETTE.tunic, kind: 'cone', rings: 2 });
        batchPart(P(GEO.sphereLo, PALETTE.gold, M(tx, KH + 1.22, tz, { s: 0.035 })), wm);
      }
      const pole = new THREE.Mesh(GEO.cyl, toon(PALETTE.wood));
      pole.position.set(cx + KX, KH + 0.75, cz + KZ); pole.scale.set(0.035, 1.5, 0.035);
      scene.add(pole);
      LC.banner(kit, cx + KX, KH + 1.3, cz + KZ, { w: 0.9, h: 0.52, field: PALETTE.tunic, stripe: PALETTE.gold, emblem: PALETTE.capRed, stateRef: st });
      for (const [px, pz, ph] of [[-W, D, 1.6], [W, D, 1.6]]) {
        batchPart(P(GEO.cyl, PALETTE.wood, M(px, ph + 1.1, pz, { sx: 0.015, sy: 0.4, sz: 0.015 }), false), wm);
        LC.banner(kit, cx + px, ph + 1.2, cz + pz, { w: 0.3, h: 0.16, field: PALETTE.capRed, stripe: PALETTE.gold, stateRef: st, phase: px });
      }
      LC.windows(kit, wm, [cx, cz], [
        [KX, 2.1, KZ + KW / 2, 'z'], [KX - 0.3, 1.5, KZ + KW / 2, 'z'], [KX + 0.3, 1.5, KZ + KW / 2, 'z'], [KX + KW / 2, 2.1, KZ, 'x'],
        [W + 0.11, 0.6, 0.3, 'x'], [-W, 1.05, D + 0.34, 'z'], [W, 1.05, D + 0.34, 'z'],
      ], st);
      // torches either side of the gate
      for (const lx of [gx - 0.72, gx + 0.72]) {
        batchPart(P(GEO.cyl, PALETTE.wood, M(lx, 0.55, D + 0.3, { sx: 0.025, sy: 0.3, sz: 0.025, rx: 0.3 }), false), wm);
        const f = new THREE.Mesh(GEO.cone, new THREE.MeshBasicMaterial({ color: PALETTE.ember }));
        f.position.set(cx + lx, 0.76, cz + D + 0.36); f.scale.set(0.05, 0.12, 0.05);
        scene.add(f);
        animated.push({ update(t) { const k = 0.8 + 0.2 * Math.sin(t * 15 + lx * 9); f.scale.set(0.05 * (2 - k), 0.12 * k, 0.05 * (2 - k)); } });
        glow(cx + lx, 0.76, cz + D + 0.4, { w: 0.5, h: 0.5 });
      }
      LC.damage(kit, {
        stateRef: st,
        cracks: [[cx + 0.6, 0.6, cz + D + 0.12, 0.2, 0.6, 'z'], [cx - 0.75, 0.55, cz + D + 0.12, 0.18, 0.5, 'z'], [cx + W + 0.12, 0.6, cz - 0.9, 0.2, 0.5, 'x'], [cx + KX + 0.2, 2.3, cz + KZ + KW / 2 + 0.01, 0.18, 0.6, 'z']],
        rubble: [[cx - 1.5, cz + 1.0], [cx + 1.55, cz + 1.4], [cx - 0.9, cz + 2.45], [cx + 1.55, cz - 1.0], [cx + 0.85, cz + 2.45]],
        fire: [cx + KX, KH + 0.2, cz + KZ + 0.3], smoke: [cx + KX, KH + 0.5, cz + KZ], burst: [cx + gx, 0.7, cz + D + 0.4],
        onState: (s) => { portcullis.userData.down = s >= 2; },
      });
      animated.push({
        update(t, dt) {
          const target = portcullis.userData.down ? 0.36 : 1.05;
          portcullis.position.y += (target - portcullis.position.y) * Math.min(1, dt * 6);
        },
      });
    }

    // Tournament pavilions in the royal meadow: striped tents with pennants.
    const pavGeo = new THREE.ConeGeometry(1, 1, 8).toNonIndexed();
    kit.extraRecipes = (rng) => ({
      pavilion: () => {
        const col = [PALETTE.tunic, PALETTE.capRed, PALETTE.gold][Math.floor(rng() * 3)];
        return { parts: [
          P(GEO.cyl, PALETTE.heraldWhite, M(0, 0.22, 0, { sx: 0.24, sy: 0.44, sz: 0.24 })),
          ...[0, 1, 2, 3].map((i) => P(GEO.box, col, M(Math.cos(i * 0.785 + 0.4) * 0.243, 0.22, Math.sin(i * 0.785 + 0.4) * 0.243, { sx: 0.07, sy: 0.44, sz: 0.01, ry: -(i * 0.785 + 0.4) + Math.PI / 2 }), false)),
          P(GEO.box, 0x2b211b, M(0, 0.17, 0.235, { sx: 0.1, sy: 0.34, sz: 0.01 }), false),
          P(pavGeo, col, M(0, 0.64, 0, { sx: 0.3, sy: 0.4, sz: 0.3 })),
          P(GEO.cyl, PALETTE.wood, M(0, 0.92, 0, { sx: 0.012, sy: 0.2, sz: 0.012 }), false),
          P(GEO.box, PALETTE.gold, M(0.06, 0.98, 0, { sx: 0.1, sy: 0.05, sz: 0.01 }), false),
        ], radius: 0.32 };
      },
    });
    LC.stream(kit, { seed: 81, speed: 0.45, stripe: 0.8, shallow: 0x3f8aa8, deep: 0x2c6680 });
    buildDrawbridge();
    buildCastle();
    LC.knaveCamps(kit);
    const endC = level.endpoint.cells.map(([c]) => c);
    LC.countryside(kit, {
      seed: 4144,
      mix: [[16, 'tree'], [10, 'bush'], [12, 'tuft'], [9, 'flower'], [5, 'pavilion'], [4, 'hay'], [6, 'fence'], [5, 'cottage'], [5, 'rock'], [3, 'barrel'], [2, 'cart'], [18, null]],
      edge: [[52, 'tree'], [10, 'bush'], [7, 'cottage'], [5, 'pavilion'], [5, 'rock'], [16, null]],
      keepLow: (c, r) => c >= Math.min(...endC) - 2,
    });
  }

  const tail = [[17, 6], [17, 9], [20, 9]];
  return {
    id: 'castle-aldermere',
    index: 4,
    name: 'Castle Aldermere',
    subtitle: "Three roads to the King's gate. Here the Baron brings his dragon.",
    map: { x: 664, y: 140, reclaim: 110, icon: 'castle' },
    grid: { cols: 22, rows: 13 },
    spawn: [0, 9],
    // the Highway (west), the Ridge Road hairpins (north) and the Fen dash
    // (south) meet on row 6, then cross the drawbridge to the castle gate
    routes: [
      { id: 'highway', waypoints: [[0, 9], [5, 9], [5, 11], [8, 11], [8, 6], ...tail] },
      { id: 'ridge', waypoints: [[0, 2], [10, 2], [10, 4], [6, 4], [6, 6], ...tail] },
      { id: 'fen', waypoints: [[12, 12], [12, 10], [14, 10], [14, 8], [11, 8], [11, 6], ...tail] },
    ],
    chokepoint: { cell: [16, 6], streamCol: 16 },
    endpoint: {
      name: 'Castle Aldermere', properName: 'Castle Aldermere',
      cells: [[19, 4], [20, 4], [21, 4], [19, 5], [20, 5], [21, 5], [19, 6], [20, 6], [21, 6], [19, 7], [20, 7], [21, 7], [19, 8], [20, 8], [21, 8]],
      gateCell: [20, 8],
    },
    cobbleTailCells: 6,
    theme: { center: [0.5, 5.5], radiusOut: { x: 8.5, z: 7.5 }, radiusIn: 1.2, falloffWidth: 0.5, motes: { embers: 34, fireflies: 16 },
      groundMeadow: 0x7cab4e, groundMeadowDark: 0x64933f },
    spawnBlockedText: "That's the Baron's camp. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 180, startLives: 20, starThresholds: [16, 8],
    tipTile: [2, 8],
    endScreenText: {
      3: () => 'The dragon is down, the Baron has fled and the King’s banner never dipped. The realm is yours to keep.',
      2: (s) => `Fourteen waves and a dragon turned back with ${s.lives} lives to spare. Castle Aldermere stands.`,
      1: (s) => `Fourteen waves and a dragon turned back with ${s.lives} lives left. The castle holds, just.`,
      lose: (s) => `The castle fell on wave ${s.wave}. Hold the junctions on row 6, build inside the Ridge Road's hairpins, and save gold for Star Seers before the dragon.`,
    },
    buildScene,
  };
})();
