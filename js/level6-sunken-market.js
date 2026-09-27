// ===================================================================
// LEVEL 6 — The Sunken Market
// A trade-town square, flooded since the Hollow's corruption backed the
// river up. Three flooded quays funnel into one junction, then a long
// lashed-plank causeway carries everyone across the square to the
// stilt-raised Counting-House. Reuses the multi-route engine exactly as
// Level 4 built it — no engine changes, only geography, theme and waves.
// ===================================================================
const LEVEL_6 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: 'Wading In',              flavor: 'Grunts wade up the Market Row. Only one quay open so far.',        groups: [g('grunt', 5, 3.2, 0, 'market-row')] },
    { name: 'The North Quay Opens',   flavor: 'Watch the North Docks too. The horn shows where they come from.',  groups: [g('grunt', 5, 2.0, 0, 'market-row', 0), g('grunt', 3, 2.4, 0, 'north-docks', 4)] },
    { name: 'Quick Feet on the Water', flavor: 'Bog-Tricksters splash up the South Docks.',                       groups: [g('grunt', 4, 1.6, 0, 'market-row', 0), g('trickster', 4, 0.9, 0, 'south-docks', 3)] },
    { name: 'The Old Troll Wades In', flavor: 'A Moss Troll takes the North Docks. It has time to spare.',        groups: [g('grunt', 4, 1.4, 0, 'market-row', 0), g('troll', 1, 1, 0, 'north-docks', 2), g('grunt', 2, 1.6, 0, 'south-docks', 6)] },
    { name: 'Wings Over the Water',   flavor: 'Bramble Bats skim the South Docks. Druids and Artillery only.',    groups: [g('bat', 2, 1.8, 0, 'south-docks', 0), g('grunt', 7, 1.0, 0, 'market-row', 3)] },
    { name: 'Three Quays at Once',    flavor: 'Every quay at once. Find the spots that cover two.',                groups: [g('grunt', 5, 1.0, 0, 'market-row', 0), g('grunt', 5, 1.0, 0, 'north-docks', 0), g('grunt', 5, 1.0, 0, 'south-docks', 0)] },
    { name: 'Barrels and Speed',      flavor: 'A Troll on the North Docks, Tricksters on the Market Row.',        groups: [g('troll', 2, 2.6, 0, 'north-docks', 0), g('trickster', 7, 0.7, 0, 'market-row', 2)] },
    { name: 'Flooded Swarm',          flavor: 'Bats south, Tricksters through the market, grunts from the north.', groups: [g('bat', 6, 0.9, 0, 'south-docks', 0), g('trickster', 8, 0.6, 0, 'market-row', 2), g('grunt', 5, 1.0, 0, 'north-docks', 4)] },
    { name: 'The Market Presses',     flavor: 'The Hollow leans on every quay in turn.',                          groups: [g('troll', 2, 2.7, 0, 'north-docks', 0), g('grunt', 7, 0.8, 0, 'market-row', 1), g('trickster', 5, 0.65, 0, 'south-docks', 5), g('bat', 3, 1.0, 0, 'south-docks', 9)] },
    { name: 'Pincer on the Quays',    flavor: 'Trolls down both northern quays, bats over the south.',            groups: [g('troll', 2, 2.2, 0, 'north-docks', 0), g('troll', 2, 2.2, 0, 'market-row', 1), g('bat', 6, 0.85, 0, 'south-docks', 3), g('grunt', 6, 0.85, 0, 'south-docks', 8)] },
    { name: 'Every Quay at Once',     flavor: 'The square shakes. Hold the causeway.',                            groups: [g('grunt', 10, 0.7, 0, 'market-row', 0), g('trickster', 10, 0.55, 0, 'south-docks', 0), g('troll', 2, 2.0, 0, 'north-docks', 0), g('bat', 4, 1.0, 0, 'north-docks', 6)] },
    { name: 'The Market Floods',      flavor: 'A Troll column, a Trickster rush and a Bat swarm, all at once.',   groups: [g('troll', 4, 2.0, 0, 'north-docks', 0), g('trickster', 14, 0.4, 0, 'market-row', 0), g('bat', 9, 0.55, 0, 'south-docks', 0)] },
  ];

  // -------- this level's scene (barrel-and-plank Causeway, Counting-House) --------
  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, decal, toon,
      addOutline, srand, scene, animated, shakeCamera, puff,
      treeParts, deadTreeParts, rockParts, mushroomParts, tuftParts, flowerParts, acornParts,
      masonry, roofCourses, windowDress, glow, setGlow, bannerGeo,
      worldX, worldZ, cols, rows, border, level } = kit;

    // The flooded square, backed up since the Hollow choked the river.
    function buildFlood() {
      kit.water({ x: worldX(level.chokepoint.streamCol), length: rows + border * 2, speed: 0.7, stripe: 0.42 });
    }

    // The Causeway: barrels lashed under long planks, the only dry crossing.
    function buildCauseway() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      const rng = srand(511);
      batchPart(P(GEO.box, PALETTE.woodLight, M(0, 0.1, 0, { sx: 1.7, sy: 0.05, sz: 0.42 }), false), wm);
      for (let i = 0; i < 6; i++) batchPart(P(GEO.box, PALETTE.wood, M(-0.75 + i * 0.3, 0.108, (rng() - 0.5) * 0.3, { sx: 0.02, sy: 0.006, sz: 0.3 }), false), wm);
      for (const bx of [-0.7, -0.2, 0.3, 0.8]) {
        for (const bz of [-0.14, 0.14]) {
          batchPart(P(GEO.cyl, PALETTE.wood, M(bx, -0.02, bz, { sx: 0.13, sy: 0.16, sz: 0.13 })), wm);
          batchPart(P(GEO.ring, PALETTE.stoneDark, M(bx, 0.02, bz, { s: 0.13, rx: Math.PI / 2 }), false), wm);
        }
      }
      // a rope rail along one side
      for (const s of [-1, 1]) for (const bx of [-0.85, -0.15, 0.55]) {
        batchPart(P(GEO.cylTaper, PALETTE.wood, M(bx, 0.32, s * 0.24, { sx: 0.025, sy: 0.32, sz: 0.025 })), wm);
      }
      batchPart(P(GEO.cyl, PALETTE.earth, M(0, 0.44, 0.24, { sx: 0.012, sy: 1.45, sz: 0.012, rz: Math.PI / 2 }), false), wm);
      batchDecal(x, z, 0.6);
    }

    // Three flooded quay-mouths, one at the head of every route.
    function buildSpawns() {
      const rng = srand(419);
      GameState.routes.forEach((rt, n) => {
        const [sc, sr] = rt.cells[0];
        const x = worldX(sc) - 0.35, z = worldZ(sr);
        batchPart(P(GEO.circle, PALETTE.hollowEarth, M(x + 0.2, 0.006, z, { s: 0.85 }), false));
        batchPart(P(GEO.cylTaper, PALETTE.hollowWood, M(x - 0.35, 0.22, z - 0.55, { sx: 0.3, sy: 0.44, sz: 0.3 })));
        for (let i = 0; i < 4; i++) {
          const a = i * 1.57 + n;
          batchPart(P(GEO.cone, PALETTE.hollowWood, M(x - 0.35 + Math.cos(a) * 0.3, 0.44, z - 0.55 + Math.sin(a) * 0.3, { sx: 0.07, sy: 0.22, sz: 0.07, rz: -Math.cos(a) * 0.5, rx: Math.sin(a) * 0.5 })));
        }
        for (let i = 0; i < 3; i++) {
          const s = 0.08 + rng() * 0.07, a = rng() * 6.28;
          batchPart(P(GEO.rock, PALETTE.hollowRock, M(x + Math.cos(a) * 0.6, 0.02, z + Math.sin(a) * 0.7, { sx: s * 1.3, sy: s, sz: s, ry: rng() * 3 })));
        }
        const { parts } = deadTreeParts(rng);
        for (const p of parts) batchPart(p, M(x - 0.2, 0, z + 0.75));
        const crack = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: PALETTE.magicGlow, transparent: true, opacity: 0.7, depthWrite: false }));
        crack.scale.set(0.5, 0.01, 0.06); crack.position.set(x - 0.35, 0.45, z - 0.55); crack.rotation.y = 0.6 + n;
        scene.add(crack);
        animated.push({ update(t) { crack.material.opacity = 0.4 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.2 + n * 2)); } });
      });
    }

    // The Counting-House: a modest timber office raised on stilts above the
    // waterline, lantern-lit windows and a faded merchant banner. Damage:
    // a cracked stilt and listing tilt at state 1, a snapped leg and a
    // half-sunk floor at state 2.
    function buildCountingHouse() {
      const cells = level.endpoint.cells;
      const cx = worldX((cells[0][0] + cells[cells.length - 1][0]) / 2);
      const cz = worldZ((cells[0][1] + cells[cells.length - 1][1]) / 2);
      const gz = worldZ(level.endpoint.gateCell[1]) - cz;   // the door faces the gate side
      const rng = srand(547);
      const houseGroup = new THREE.Group();
      houseGroup.position.set(cx, 0, cz);
      scene.add(houseGroup);
      const wm = new THREE.Matrix4();
      const legs = [];
      for (const [lx, lz] of [[-0.55, -0.5], [0.55, -0.5], [-0.55, 0.5], [0.55, 0.5]]) {
        const leg = new THREE.Mesh(GEO.cyl, toon(PALETTE.wood));
        leg.scale.set(0.06, 0.5, 0.06); leg.position.set(lx, 0.25, lz);
        addOutline(leg);
        houseGroup.add(leg);
        legs.push(leg);
      }
      // the floor platform
      const floor = new THREE.Mesh(GEO.box, toon(PALETTE.woodLight));
      floor.scale.set(1.3, 0.06, 1.15); floor.position.set(0, 0.53, 0);
      addOutline(floor);
      houseGroup.add(floor);
      // walls (masonry-style timber courses) and roof
      const y0 = 0.56, y1 = 1.1;
      masonry(wm.identity().multiply(new THREE.Matrix4().makeTranslation(cx, 0, cz)), { face: 'z', at: -0.58, sign: -1, u0: -0.58, u1: 0.58, y0, y1, holes: [[0.3, 0.85, 0.22, 0.3]], seed: 7 });
      masonry(wm, { face: 'z', at: 0.58, sign: 1, u0: -0.58, u1: 0.58, y0, y1, holes: [[-gz * 0 - 0.15, 0.78, 0.24, 0.34]], seed: 8 });
      masonry(wm, { face: 'x', at: -0.58, sign: -1, u0: -0.5, u1: 0.5, y0, y1, holes: [[0.05, 0.85, 0.2, 0.28]], seed: 9 });
      masonry(wm, { face: 'x', at: 0.58, sign: 1, u0: -0.5, u1: 0.5, y0, y1, holes: [], seed: 10 });
      roofCourses(wm, { x: cx, y: y1, z: cz, r: 0.75, h: 0.34, color: PALETTE.capBrown, kind: 'cone', rings: 3 });
      windowDress(wm, cx - 0.15, 0.83, cz + 0.583, 'z', { sign: 1, w: 0.2, h: 0.28 });
      windowDress(wm, cx + 0.15, 0.85, cz - 0.583, 'z', { sign: -1, w: 0.18, h: 0.24 });
      // a hanging lantern by the door and a live warm glow
      const lamp = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.windowWarm }));
      lamp.position.set(cx - 0.15, 0.92, cz + gz > 0 ? cz + 0.68 : cz - 0.68);
      lamp.scale.setScalar(0.055);
      scene.add(lamp);
      glow(lamp.position.x, lamp.position.y, lamp.position.z, { w: 0.5, h: 0.5 });
      // a merchant banner over the door
      const bg = bannerGeo(0.42, 0.26, { field: PALETTE.wood, stripe: PALETTE.gold });
      const bp = bg.attributes.position;
      const banner = new THREE.Mesh(bg, toon(0xffffff, { vc: true, side: THREE.DoubleSide }));
      banner.position.set(cx + 0.32, 1.28, cz);
      banner.rotation.y = Math.PI / 2;
      scene.add(banner);
      // rope-and-crate dock clutter at the base
      for (const [bx, bz] of [[-0.75, 0.7], [0.7, -0.7]]) {
        batchPart(P(GEO.cyl, PALETTE.wood, M(bx, 0.09, bz, { sx: 0.09, sy: 0.18, sz: 0.09 })), new THREE.Matrix4().makeTranslation(cx, 0, cz));
      }
      // damage overlay: a cracked, listing stilt and a half-sunk floor
      const dmg = { crack: new THREE.Group(), sag: 0, state: 0, smokeTimer: 0 };
      for (let i = 0; i < 4; i++) {
        const c = new THREE.Mesh(GEO.box, toon(PALETTE.hollowWood));
        c.scale.set(0.5, 0.012, 0.03);
        c.position.set(legs[i % 2 ? 1 : 0].position.x, 0.3 + i * 0.04, legs[i].position.z + (rng() - 0.5) * 0.1);
        c.rotation.y = rng() * 3;
        dmg.crack.add(c);
      }
      dmg.crack.visible = false;
      scene.add(dmg.crack);
      GameState.on('endpointStateChanged', (st) => {
        dmg.state = st;
        dmg.crack.visible = st >= 1;
        setGlow(st >= 2 ? 0.35 : 1);
        shakeCamera(0.12, 0.4);
        puff(cx, 0.5, cz, { count: 16, color: PALETTE.stoneDark, speed: 1.6, size: 0.1, up: 1.2, ttl: 0.8 });
      });
      const base = bp.array.slice();
      animated.push({
        update(t, dt) {
          const droop = dmg.state === 2 ? 0.35 : dmg.state === 1 ? 0.7 : 1;
          for (let i = 0; i < bp.count; i++) {
            const x = base[i * 3], u = (x + 0.21) / 0.42;
            bp.setZ(i, Math.sin(t * 5.2 - u * 4.5) * 0.06 * u * droop);
          }
          bp.needsUpdate = true;
          bg.computeVertexNormals();
          const tilt = dmg.state === 2 ? 0.09 : dmg.state === 1 ? 0.03 : 0;
          houseGroup.rotation.z = Math.sin(t * 0.7) * 0.008 + tilt;
          houseGroup.position.y = dmg.state === 2 ? -0.05 + Math.sin(t * 0.9) * 0.005 : Math.sin(t * 0.9) * 0.005;
          lamp.material.color.setHex(PALETTE.windowWarm).multiplyScalar((0.85 + 0.15 * Math.sin(t * 7)) * (dmg.state === 2 ? 0.4 : 1));
          if (dmg.state >= 1) {
            dmg.smokeTimer -= dt;
            if (dmg.smokeTimer <= 0) {
              dmg.smokeTimer = dmg.state === 2 ? 0.5 : 1.1;
              puff(cx + (rng() - 0.5) * 0.4, 0.6, cz + (rng() - 0.5) * 0.4, { count: 1, color: 0x8c847a, speed: 0.12, size: 0.14, up: 0.7, ttl: 1.4 });
            }
          }
        },
      });
    }

    // Reed clusters, this level's one new signature prop: a few tall thin
    // blades and a cattail head, used near water and damp ground.
    function reedClusterParts(rng) {
      const parts = [], h = 0.22 + rng() * 0.1;
      for (let i = 0; i < 4; i++) {
        const lean = (rng() - 0.5) * 0.4;
        parts.push(P(GEO.cylTaper, i % 2 ? PALETTE.moss : PALETTE.meadowDark, M((rng() - 0.5) * 0.12, h * 0.5, (rng() - 0.5) * 0.12, { sx: 0.012, sy: h, sz: 0.012, rz: lean }), false));
      }
      parts.push(P(GEO.sphereLo, PALETTE.wood, M(0.02, h * 0.85, 0, { sx: 0.025, sy: 0.06, sz: 0.025 }), false));
      return { parts, radius: 0.1 };
    }

    function buildCountryside() {
      const rng = srand(6161);
      const swayTrees = [];
      const mouths = GameState.routes.map((rt) => rt.cells[0]);
      const spawnAt = (c, r) => {
        if (mouths.some(([mc, mr]) => Math.abs(c - mc) <= 2 && Math.abs(r - mr) <= 1 && c <= mc)) return;
        const inGrid = GameState.inGrid(c, r);
        const h = GameState.zoneFalloff(c, r);
        const x = worldX(c) + (rng() - 0.5) * 0.5, z = worldZ(r) + (rng() - 0.5) * 0.5;
        const roll = rng();
        const put = ({ parts, radius }) => { for (const p of parts) batchPart(p, M(x, 0, z)); if (radius) batchDecal(x, z, radius); };
        const nearWater = Math.abs(c - level.chokepoint.streamCol) <= 2;
        if (h > 0.45) {
          if (roll < 0.32) put(deadTreeParts(rng));
          else if (roll < 0.58) put(rockParts(rng, true));
          else if (roll < 0.66) put(reedClusterParts(rng));
          return;
        }
        if (!inGrid) {
          if (roll < 0.6) put(treeParts(rng));
          else if (roll < 0.72) put(mushroomParts(rng, true));
          else if (roll < 0.82) put(reedClusterParts(rng));
          return;
        }
        if (nearWater && roll < 0.4) { put(reedClusterParts(rng)); return; }
        const hidesTower = GameState.isBuildable(c, r - 1) || GameState.isBuildable(c - 1, r - 1);
        if (roll < 0.13 && !hidesTower) {
          const { parts, radius } = treeParts(rng);
          if (swayTrees.length < 8) {
            const gp = liveProp(parts, x, 0, z);
            gp.userData.phase = rng() * 6.28;
            swayTrees.push(gp);
            decal(x, z, radius);
          } else put({ parts, radius });
        } else if (roll < 0.2) put(mushroomParts(rng, rng() < 0.3));
        else if (roll < 0.4) put(tuftParts(rng));
        else if (roll < 0.5) put(reedClusterParts(rng));
        else if (roll < 0.62) put(flowerParts(rng));
        else if (roll < 0.76) put(rockParts(rng, false));
        else if (roll < 0.86) put(acornParts(rng));
      };
      for (let r = -border; r < rows + border; r++) {
        for (let c = -border; c < cols + border; c++) {
          if (GameState.inGrid(c, r)) {
            const kind = GameState.cellKind(c, r);
            if (kind !== 'ground' || GameState.isBuildable(c, r) || GameState.isSpawn(c, r)) continue;
          } else if (c === level.chokepoint.streamCol) continue;
          spawnAt(c, r);
        }
      }
      animated.push({
        update(t) {
          for (const gp of swayTrees) {
            gp.rotation.z = Math.sin(t * 1.1 + gp.userData.phase) * 0.035;
            gp.rotation.x = Math.cos(t * 0.9 + gp.userData.phase) * 0.025;
          }
        },
      });
    }

    buildFlood();
    buildCauseway();
    buildSpawns();
    buildCountingHouse();
    buildCountryside();
  }

  const tail = [[14, 5], [14, 6], [15, 6]];
  return {
    id: 'sunken-market',
    index: 6,
    name: 'The Sunken Market',
    subtitle: 'The square is flooded. Hold the Causeway to the Counting-House.',
    map: { x: 60, y: 232, reclaim: 100, icon: 'market' },
    grid: { cols: 18, rows: 11 },
    spawn: [0, 5],
    // three flooded quays that meet at (8,5), then a long shared causeway
    routes: [
      { id: 'market-row', waypoints: [[0, 5], ...tail] },
      { id: 'north-docks', waypoints: [[5, 0], [5, 3], [8, 3], [8, 5], ...tail] },
      { id: 'south-docks', waypoints: [[5, 10], [5, 7], [8, 7], [8, 5], ...tail] },
    ],
    chokepoint: { cell: [12, 5], streamCol: 12 },
    endpoint: {
      name: 'the Counting-House', properName: 'The Counting-House',
      cells: [[15, 4], [16, 4], [15, 5], [16, 5]], gateCell: [15, 5],
    },
    cobbleTailCells: 3,
    theme: {
      center: [1, 5], radiusOut: { x: 8, z: 6 }, radiusIn: 1.1, falloffWidth: 0.5,
      backdrop: 0x33463f, groundMeadow: 0x6a9a86, groundMeadowDark: 0x557d68, ambient: 0.35,
      sun: 0.55, fill: 0x9fc9d1, fillIntensity: 0.16,
      motes: { dust: 40, fireflies: 8, spores: 16 },
    },
    spawnBlockedText: 'Nothing but dark water and rot floats here.',
    waves, prepSeconds: 14, startGold: 170, startLives: 20, starThresholds: [16, 8],
    tipTile: [2, 4],
    endScreenText: {
      3: () => 'Every quay held, and the Counting-House never took on water. The Sunken Market is dry ground again.',
      2: (s) => `Twelve waves across three flooded quays, ${s.lives} lives to spare. The Counting-House stands.`,
      1: (s) => `The water rose to the door, but ${s.lives} lives held it back. The Counting-House stands, just.`,
      lose: (s) => `The Counting-House went under on wave ${s.wave}. Watch the horn markers for the next quay, and remember only Druids and Artillery reach the bats.`,
    },
    buildScene,
  };
})();
