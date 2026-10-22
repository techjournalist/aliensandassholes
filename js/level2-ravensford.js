// ===================================================================
// LEVEL 2 — Ravensford
// The knaves come two ways now: down the King's Road from the burnt
// farms to the north-west, and up the Forest Track out of the southern
// woods. Both roads meet before the river and cross it at the ford, under
// the old watchtower whose beacon warns the realm.
// ===================================================================
const LEVEL_2 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: "Scouts on the King's Road", flavor: 'Brigands feel out the main road. Only one road so far.',                  groups: [g('grunt', 5, 3.2, 0, 'kings')] },
    { name: 'The Forest Track',    flavor: 'Watch the woods too. The horn post shows where they come from.',               groups: [g('grunt', 5, 2.0, 0, 'kings', 0), g('grunt', 4, 2.4, 0, 'forest', 4)] },
    { name: 'Quick Feet',          flavor: 'Cutpurses dash up the Forest Track.',                                          groups: [g('grunt', 5, 1.5, 0, 'kings', 0), g('trickster', 5, 0.9, 0, 'forest', 4)] },
    { name: 'Plate and Pike',      flavor: "A Black Knight takes the long King's Road. It's in no hurry.",                 groups: [g('grunt', 6, 1.2, 0, 'forest', 0), g('troll', 1, 1, 0, 'kings', 2), g('grunt', 4, 1.4, 0, 'kings', 6)] },
    { name: 'Wings over the Woods', flavor: 'Gargoyles follow the Forest Track. Only the Magus and the Longbowmen reach them.', groups: [g('bat', 3, 1.3, 0, 'forest', 0), g('grunt', 6, 1.1, 0, 'kings', 3)] },
    { name: 'Both Roads at Once',  flavor: 'Find the spots that watch both roads before they meet.',                        groups: [g('grunt', 6, 1.0, 0, 'kings', 0), g('grunt', 6, 1.0, 0, 'forest', 0), g('trickster', 5, 0.6, 0, 'forest', 6)] },
    { name: 'Iron and Speed',      flavor: "Black Knights on the King's Road, Cutpurses in the woods.",                    groups: [g('troll', 2, 2.8, 0, 'kings', 0), g('trickster', 7, 0.7, 0, 'forest', 2)] },
    { name: 'Gargoyle Season',     flavor: 'Gargoyles on the road, Cutpurses in the trees, brigands behind.',              groups: [g('bat', 5, 0.9, 0, 'kings', 0), g('trickster', 7, 0.6, 0, 'forest', 3), g('grunt', 5, 1.0, 0, 'kings', 6)] },
    { name: 'The Press',           flavor: 'The Baron leans on both roads in turn.',                                       groups: [g('troll', 2, 2.6, 0, 'forest', 0), g('grunt', 8, 0.8, 0, 'kings', 1), g('trickster', 6, 0.6, 0, 'forest', 6), g('bat', 4, 1.0, 0, 'kings', 10)] },
    { name: 'Pincer',              flavor: 'Black Knights down both roads, gargoyles over the trees.',                     groups: [g('troll', 2, 2.6, 0, 'kings', 0), g('troll', 1, 2.4, 0, 'forest', 3), g('bat', 5, 0.9, 0, 'forest', 6), g('grunt', 6, 0.9, 0, 'kings', 11)] },
    { name: 'Light the Beacon',    flavor: 'The watch lights the beacon. Hold the ford.',                                  groups: [g('grunt', 10, 0.65, 0, 'kings', 0), g('trickster', 9, 0.5, 0, 'forest', 2), g('troll', 3, 2.2, 0, 'kings', 4), g('bat', 5, 0.85, 0, 'forest', 8)] },
    { name: 'Ravensford Stands',   flavor: 'A column of knights, a rush of cutpurses and a flock of gargoyles, all together.', groups: [g('troll', 3, 2.2, 0, 'kings', 0), g('trickster', 11, 0.45, 0, 'forest', 0), g('bat', 7, 0.6, 0, 'kings', 0)] },
  ];

  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, toon, srand, scene, animated, puff,
      masonry, roofCourses, glow, worldX, worldZ, level } = kit;
    const LC = LevelCommon;

    // The ford: a shallow cobbled crossing the water runs over, flat
    // stepping stones on top, rope-and-post markers either side.
    function buildFord() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      const rng = srand(57);
      batchPart(P(GEO.box, kit.lerpColor(PALETTE.cobble, PALETTE.streamBed, 0.45).getHex(), M(0, -0.14, 0, { sx: 1.0, sy: 0.04, sz: 0.8 }), false), wm);
      for (let i = 0; i < 5; i++) for (const zz of [-0.2, 0.18]) {
        batchPart(P(GEO.cyl, i % 2 ? PALETTE.stone : PALETTE.cobble, M(-0.4 + i * 0.2, -0.07, zz + (rng() - 0.5) * 0.08, { sx: 0.09, sy: 0.08, sz: 0.08, ry: rng() })), wm);
      }
      for (const side of [-1, 1]) {
        for (const u of [-0.48, 0.48]) batchPart(P(GEO.cyl, PALETTE.wood, M(u, 0.1, side * 0.42, { sx: 0.035, sy: 0.5, sz: 0.035 })), wm);
        batchPart(P(GEO.cyl, PALETTE.straw, M(0, 0.26, side * 0.42, { sx: 0.012, sy: 0.96, sz: 0.012, rz: Math.PI / 2 }), false), wm);
      }
      let t0 = 0;
      animated.push({
        update(t, dt) {
          t0 -= dt;
          if (t0 <= 0) { t0 = 0.18; puff(x + (Math.random() - 0.5) * 0.8, -0.05, z + 0.3, { count: 1, color: PALETTE.waterFoam, speed: 0.25, size: 0.07, up: 0.4, ttl: 0.45 }); }
        },
      });
    }

    // The watchtower: a tall square keep of grey stone with a timber
    // hoarding round its top, a beacon fire burning in an iron basket and
    // the King's banner; a thatched guardhouse with the gate sits in front.
    function buildWatchtower() {
      const [cx, cz] = LC.endpointCenter(kit);
      const wm = M(cx, 0, cz);
      const st = { state: 0 };
      const gx = worldX(level.endpoint.gateCell[0]) - cx;
      const TX = 0.1, TZ = -0.5, TW = 1.2, TH = 3.1;
      batchPart(P(GEO.circle, kit.lerpColor(PALETTE.path, PALETTE.meadow, 0.4).getHex(), M(0, 0.008, 0.3, { sx: 1.2, sz: 1.6 }), false), wm);
      batchPart(P(GEO.box, PALETTE.stone, M(TX, TH / 2, TZ, { sx: TW, sy: TH, sz: TW })), wm);
      batchPart(P(GEO.box, PALETTE.stoneDark, M(TX, 0.1, TZ, { sx: TW + 0.1, sy: 0.2, sz: TW + 0.1 })), wm);
      masonry(wm, { face: 'z', at: TZ + TW / 2, u0: TX - TW / 2, u1: TX + TW / 2, y0: 1.0, y1: TH, seed: 21, holes: [[TX, 2.3, 0.3, 0.4]] });
      masonry(wm, { face: 'x', at: TX + TW / 2, u0: TZ - TW / 2, u1: TZ + TW / 2, y0: 0.2, y1: TH, seed: 22, holes: [[TZ, 1.7, 0.3, 0.4]] });
      // the timber hoarding gallery round the top
      batchPart(P(GEO.box, PALETTE.wood, M(TX, TH + 0.2, TZ, { sx: TW + 0.3, sy: 0.4, sz: TW + 0.3 })), wm);
      for (let i = 0; i < 5; i++) {
        const u = -0.6 + i * 0.3;
        batchPart(P(GEO.box, PALETTE.timber, M(TX + u, TH + 0.2, TZ + TW / 2 + 0.155, { sx: 0.04, sy: 0.4, sz: 0.01 }), false), wm);
        batchPart(P(GEO.box, PALETTE.timber, M(TX + TW / 2 + 0.155, TH + 0.2, TZ + u, { sx: 0.01, sy: 0.4, sz: 0.04 }), false), wm);
        batchPart(P(GEO.box, PALETTE.wood, M(TX + u, TH - 0.12, TZ + TW / 2 + 0.08, { sx: 0.05, sy: 0.24, sz: 0.05, rx: 0.6 }), false), wm);
      }
      // a pyramid roof of slate, the beacon basket on a post beside it
      const pyr = new THREE.ConeGeometry(1, 1, 4).toNonIndexed();
      batchPart(P(pyr, PALETTE.slate, M(TX, TH + 0.75, TZ, { sx: 1.0, sy: 0.7, sz: 1.0, ry: Math.PI / 4 })), wm);
      batchPart(P(GEO.sphereLo, PALETTE.gold, M(TX, TH + 1.14, TZ, { s: 0.05 })), wm);
      const bx = TX + 0.62, bz = TZ + 0.62;
      batchPart(P(GEO.cyl, PALETTE.steelDark, M(bx, TH + 0.6, bz, { sx: 0.03, sy: 0.5, sz: 0.03 })), wm);
      batchPart(P(GEO.cylTaper, PALETTE.steelDark, M(bx, TH + 0.9, bz, { sx: 0.16, sy: 0.16, sz: 0.16, rx: Math.PI })), wm);
      const beacon = new THREE.Mesh(GEO.cone, new THREE.MeshBasicMaterial({ color: PALETTE.ember, transparent: true, opacity: 0.92 }));
      beacon.position.set(cx + bx, TH + 1.1, cz + bz); beacon.scale.set(0.14, 0.32, 0.14);
      const beaconCore = new THREE.Mesh(GEO.cone, new THREE.MeshBasicMaterial({ color: PALETTE.flowerYellow }));
      beaconCore.position.set(cx + bx, TH + 1.05, cz + bz); beaconCore.scale.set(0.08, 0.18, 0.08);
      scene.add(beacon, beaconCore);
      glow(cx + bx, TH + 1.1, cz + bz, { w: 1.1, h: 1.1 });
      let smoke = 0;
      animated.push({
        update(t, dt) {
          const k = 0.8 + 0.2 * Math.sin(t * 12) * Math.sin(t * 4.1);
          const dim = st.state === 2 ? 0.55 : 1;
          beacon.scale.set(0.14 * (2 - k), 0.32 * k * dim, 0.14 * (2 - k));
          beaconCore.scale.set(0.08, 0.18 * (2 - k * 0.8) * dim, 0.08);
          smoke -= dt;
          if (smoke <= 0) { smoke = 0.3; puff(cx + bx, TH + 1.35, cz + bz, { count: 1, color: 0x6a625a, speed: 0.12, size: 0.12, up: 0.9, ttl: 1.6 }); }
        },
      });
      const pole = new THREE.Mesh(GEO.cyl, toon(PALETTE.wood));
      pole.position.set(cx + TX - 0.5, TH + 0.95, cz + TZ - 0.5); pole.scale.set(0.03, 1.1, 0.03);
      scene.add(pole);
      LC.banner(kit, cx + TX - 0.5, TH + 1.3, cz + TZ - 0.5, { w: 0.62, h: 0.38, field: PALETTE.tunic, stripe: PALETTE.gold, emblem: PALETTE.heraldWhite, stateRef: st });
      // the guardhouse in front, with the gate
      const HZ = 0.62, HW = 1.6, HD = 0.9, HH = 0.62;
      batchPart(P(GEO.box, PALETTE.stone, M(0, HH / 2, HZ, { sx: HW, sy: HH, sz: HD })), wm);
      masonry(wm, { face: 'z', at: HZ + HD / 2, u0: -HW / 2, u1: HW / 2, y0: 0.05, y1: HH, seed: 23, holes: [[gx, 0.32, 0.5, 0.64], [0.45, 0.36, 0.26, 0.3]] });
      LC.gableRoof(kit, wm, { y: HH, z: HZ, len: HW + 0.08, span: HD / 2 + 0.08, rise: 0.38, color: PALETTE.thatch, gable: PALETTE.stone });
      batchPart(P(GEO.box, 0x2b211b, M(gx, 0.28, HZ + HD / 2 + 0.005, { sx: 0.42, sy: 0.56, sz: 0.04 }), false), wm);
      batchPart(P(GEO.cyl, 0x2b211b, M(gx, 0.56, HZ + HD / 2 + 0.005, { sx: 0.21, sy: 0.04, sz: 0.21, rx: Math.PI / 2 }), false), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(gx, 0.27, HZ + HD / 2 + 0.03, { sx: 0.34, sy: 0.5, sz: 0.03 }), false), wm);
      batchPart(P(GEO.box, PALETTE.steelDark, M(gx, 0.38, HZ + HD / 2 + 0.05, { sx: 0.34, sy: 0.035, sz: 0.01 }), false), wm);
      LC.windows(kit, wm, [cx, cz], [[0.45, 0.36, HZ + HD / 2 + 0.005, 'z'], [TX, 2.3, TZ + TW / 2, 'z'], [TX + TW / 2, 1.7, TZ, 'x'], [TX + TW / 2, 2.6, TZ - 0.3, 'x']], st);
      // a weapons rack and barrels by the door
      batchPart(P(GEO.box, PALETTE.wood, M(-0.62, 0.25, HZ + HD / 2 + 0.16, { sx: 0.3, sy: 0.04, sz: 0.04 }), false), wm);
      for (let i = 0; i < 3; i++) batchPart(P(GEO.cyl, PALETTE.woodLight, M(-0.72 + i * 0.1, 0.32, HZ + HD / 2 + 0.14, { sx: 0.012, sy: 0.6, sz: 0.012, rx: -0.15 }), false), wm);
      batchPart(P(GEO.cyl, PALETTE.wood, M(0.72, 0.12, HZ + HD / 2 + 0.2, { sx: 0.09, sy: 0.24, sz: 0.09 })), wm);
      LC.damage(kit, {
        stateRef: st,
        cracks: [[cx + TX + 0.2, 1.6, cz + TZ + TW / 2 + 0.01, 0.2, 0.7, 'z'], [cx + TX + TW / 2 + 0.01, 2.2, cz + TZ + 0.3, 0.18, 0.6, 'x'], [cx + 0.3, 0.35, cz + HZ + HD / 2 + 0.01, 0.2, 0.4, 'z']],
        rubble: [[cx - 0.9, cz + 0.3], [cx + 0.85, cz + 1.2], [cx - 0.75, cz + 1.25], [cx + 0.85, cz - 0.4]],
        fire: [cx - 0.3, HH + 0.2, cz + HZ + 0.2], smoke: [cx, HH + 0.4, cz + HZ], burst: [cx + gx, 0.5, cz + 1.2],
      });
    }

    LC.stream(kit, { seed: 61, speed: 1.0 });
    buildFord();
    buildWatchtower();
    LC.knaveCamps(kit);
    const endC = level.endpoint.cells.map(([c]) => c);
    LC.countryside(kit, {
      seed: 2112,
      mix: [[26, 'tree'], [12, 'bush'], [12, 'tuft'], [8, 'flower'], [5, 'hay'], [5, 'fence'], [5, 'cottage'], [7, 'rock'], [2, 'barrel'], [2, 'cart'], [16, null]],
      edge: [[66, 'tree'], [10, 'bush'], [5, 'cottage'], [6, 'rock'], [13, null]],
      keepLow: (c, r) => c >= Math.min(...endC) - 2 && r >= 3 && r <= 9,
    });
  }

  const tail = [[15, 6], [15, 8], [17, 8]];
  return {
    id: 'ravensford',
    index: 2,
    name: 'Ravensford',
    subtitle: 'Two roads meet at the ford. Keep the beacon burning.',
    map: { x: 318, y: 132, reclaim: 100, icon: 'watchtower' },
    grid: { cols: 20, rows: 12 },
    spawn: [0, 2],
    // two roads that join at (11,6), then cross the ford to the watchtower
    routes: [
      { id: 'kings', waypoints: [[0, 2], [5, 2], [5, 5], [8, 5], [8, 2], [11, 2], [11, 6], ...tail] },
      { id: 'forest', waypoints: [[3, 11], [3, 8], [7, 8], [7, 10], [11, 10], [11, 6], ...tail] },
    ],
    chokepoint: { cell: [13, 6], streamCol: 13 },
    endpoint: {
      name: 'the Ravensford watchtower', properName: 'The Ravensford Watchtower',
      cells: [[17, 5], [18, 5], [17, 6], [18, 6], [17, 7], [18, 7]], gateCell: [17, 7],
    },
    cobbleTailCells: 3,
    theme: { center: [0.5, 6.5], radiusOut: { x: 5.5, z: 6.2 }, radiusIn: 1.2, falloffWidth: 0.5, motes: { embers: 26, fireflies: 18 },
      groundMeadow: 0x78a84c, groundMeadowDark: 0x5f8f3e },
    spawnBlockedText: "That's the Baron's camp. Nothing of ours stands there.",
    waves, prepSeconds: 14, startGold: 160, startLives: 20, starThresholds: [16, 8],
    tipTile: [4, 3],
    endScreenText: {
      3: () => 'Two roads, twelve waves, and the beacon never wavered. Ravensford stands.',
      2: (s) => `Twelve waves turned back on two roads with ${s.lives} lives to spare. The ford holds.`,
      1: (s) => `Twelve waves turned back with ${s.lives} lives left. The beacon still burns, just.`,
      lose: (s) => `The watchtower fell on wave ${s.wave}. Watch the horn posts for the next road, build where both roads pass, and remember only the Magus and Longbowmen reach flyers.`,
    },
    buildScene,
  };
})();
