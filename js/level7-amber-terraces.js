// ===================================================================
// LEVEL 7 — The Amber Terraces
// Sunlit orchard hillsides, the kingdom's breadbasket, defended before the
// Hollow ever reaches it — the brightest, least-corrupted battle in the
// campaign. Reuses the multi-route engine exactly as Level 4 built it:
// three roads of different length join a shared trunk at three separate
// points, then cross a rope-and-basket tram to the Apiary Tower.
// ===================================================================
const LEVEL_7 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: 'Scouts on the Grove Path', flavor: 'Grunts feel out the nearest path. Only one road so far.',        groups: [g('grunt', 5, 3.2, 0, 'grove-path')] },
    { name: 'The Basket Road Opens',  flavor: 'Watch the Basket Road too. The horn shows where they come from.',  groups: [g('grunt', 4, 2.3, 0, 'grove-path', 0), g('grunt', 2, 2.7, 0, 'basket-road', 4)] },
    { name: 'Quick Feet in the Rows', flavor: 'Bog-Tricksters rush the Basket Road.',                             groups: [g('grunt', 4, 1.6, 0, 'grove-path', 0), g('trickster', 5, 0.9, 0, 'basket-road', 3)] },
    { name: 'The Long Way Round',     flavor: 'A Moss Troll takes the Hollow Way. It has time to spare.',         groups: [g('grunt', 5, 1.35, 0, 'grove-path', 0), g('troll', 1, 1, 0, 'hollow-way', 2), g('grunt', 3, 1.6, 0, 'basket-road', 6)] },
    { name: 'Wings Over the Orchard', flavor: 'Bramble Bats follow the Basket Road. Druids and Artillery only.',  groups: [g('bat', 4, 1.35, 0, 'basket-road', 0), g('grunt', 6, 1.1, 0, 'grove-path', 3)] },
    { name: 'Three Rows at Once',     flavor: 'Every road at once. Find the spots that cover two.',                groups: [g('grunt', 5, 1.0, 0, 'grove-path', 0), g('grunt', 5, 1.0, 0, 'hollow-way', 0), g('grunt', 5, 1.0, 0, 'basket-road', 0)] },
    { name: 'Stone and Speed',        flavor: 'Trolls on the Hollow Way, Tricksters on the Grove Path.',           groups: [g('troll', 2, 2.6, 0, 'hollow-way', 0), g('trickster', 7, 0.7, 0, 'grove-path', 2)] },
    { name: 'Swarm Season',           flavor: 'Bats south, Tricksters north, grunts on the Hollow Way.',           groups: [g('bat', 6, 0.9, 0, 'basket-road', 0), g('trickster', 8, 0.6, 0, 'grove-path', 2), g('grunt', 5, 1.0, 0, 'hollow-way', 4)] },
    { name: 'The Orchard Presses',    flavor: 'The Hollow leans on every road in turn.',                          groups: [g('troll', 2, 2.4, 0, 'hollow-way', 0), g('grunt', 8, 0.8, 0, 'grove-path', 1), g('trickster', 6, 0.65, 0, 'basket-road', 5), g('bat', 4, 1.0, 0, 'basket-road', 9)] },
    { name: 'Pincer',                 flavor: 'Trolls down both northern roads, bats over the south.',            groups: [g('troll', 2, 2.2, 0, 'hollow-way', 0), g('troll', 2, 2.2, 0, 'grove-path', 1), g('bat', 6, 0.8, 0, 'basket-road', 3), g('grunt', 6, 0.8, 0, 'basket-road', 8)] },
    { name: 'Every Row at Once',      flavor: 'The hives shake. Hold the tram line.',                             groups: [g('grunt', 10, 0.7, 0, 'grove-path', 0), g('trickster', 10, 0.5, 0, 'basket-road', 0), g('troll', 3, 2.0, 0, 'hollow-way', 0), g('bat', 5, 0.9, 0, 'hollow-way', 6)] },
    { name: 'The Orchard Falls Silent', flavor: 'A Troll column, a Trickster rush and a Bat swarm, all at once.', groups: [g('troll', 4, 2.0, 0, 'hollow-way', 0), g('trickster', 14, 0.4, 0, 'grove-path', 0), g('bat', 9, 0.55, 0, 'basket-road', 0)] },
  ];

  // -------- this level's scene (rope-and-basket tram, Apiary Tower) --------
  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, decal, toon,
      addOutline, srand, scene, animated, shakeCamera, puff,
      treeParts, deadTreeParts, rockParts, mushroomParts, tuftParts, flowerParts, acornParts,
      towerCourses, roofCourses, windowDress, glow, setGlow, bannerGeo,
      worldX, worldZ, cols, rows, border, level } = kit;

    // A shallow, calm stream at the bottom of the ravine.
    function buildRavine() {
      kit.water({ x: worldX(level.chokepoint.streamCol), length: rows + border * 2, speed: 0.55, stripe: 0.5 });
    }

    // The tram: two posts, a taut rope, and a hanging basket that swings
    // gently on its pulley. This level's one new animation idea.
    function buildTram() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      for (const s of [-1, 1]) {
        batchPart(P(GEO.cyl, PALETTE.wood, M(s * 0.85, 0.55, 0, { sx: 0.05, sy: 1.1, sz: 0.05 })), wm);
        batchPart(P(GEO.box, PALETTE.woodLight, M(s * 0.85, 1.08, 0, { sx: 0.14, sy: 0.05, sz: 0.14 })), wm);
        for (let i = 0; i < 3; i++) batchPart(P(GEO.cylTaper, PALETTE.wood, M(s * (0.85 - s * 0.13 * (i + 1)), 0.3 + i * 0.08, 0, { sx: 0.025, sy: 0.2, sz: 0.025, rz: -s * 0.9 })), wm);
      }
      batchPart(P(GEO.cyl, PALETTE.earth, M(0, 1.0, 0, { sx: 0.012, sy: 1.7, sz: 0.012, rz: Math.PI / 2 })), wm);
      const rope = new THREE.Mesh(GEO.box, toon(PALETTE.earth));
      rope.scale.set(1.7, 0.015, 0.015); rope.position.set(x, 0.6, z);
      addOutline(rope);
      scene.add(rope);
      const basket = liveProp([
        P(GEO.cyl, PALETTE.wood, M(0, 0, 0, { sx: 0.16, sy: 0.14, sz: 0.16 })),
        P(GEO.ring, PALETTE.woodLight, M(0, 0.07, 0, { s: 0.16, rx: Math.PI / 2 }), false),
        P(GEO.sphereLo, PALETTE.acorn, M(0.03, 0.1, 0.02, { s: 0.06 }), false),
        P(GEO.sphereLo, PALETTE.flowerYellow, M(-0.04, 0.11, -0.03, { s: 0.05 }), false),
        P(GEO.cyl, PALETTE.earth, M(-0.1, 0.26, 0, { sx: 0.012, sy: 0.24, sz: 0.012, rz: 0.5 })),
        P(GEO.cyl, PALETTE.earth, M(0.1, 0.26, 0, { sx: 0.012, sy: 0.24, sz: 0.012, rz: -0.5 })),
      ], x - 0.15, 0.42, z);
      decal(x, z, 0.55);
      animated.push({
        update(t) {
          basket.position.x = x - 0.15 + Math.sin(t * 0.6) * 0.25;
          basket.rotation.z = Math.sin(t * 0.6) * 0.12 + Math.sin(t * 1.7) * 0.03;
          rope.rotation.z = Math.sin(t * 0.6) * 0.02;
        },
      });
    }

    // Three orchard gates, one at the head of every route.
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

    // The Apiary Tower: a round granary tower under a beehive-textured
    // dome, bees looping lazily. Damage: dimming glow and a fallen shingle
    // scatter at state 1, cracked masonry and a listing dome at state 2.
    function buildApiaryTower() {
      const cells = level.endpoint.cells;
      const cx = worldX((cells[0][0] + cells[cells.length - 1][0]) / 2);
      const cz = worldZ((cells[0][1] + cells[cells.length - 1][1]) / 2);
      const wm = M(cx, 0, cz);
      const rng = srand(571);
      const r = 0.62;
      batchPart(P(GEO.cyl, PALETTE.stone, M(0, 0.02, 0, { sx: r * 1.08, sy: 0.04, sz: r * 1.08 })), wm);
      batchPart(P(GEO.cyl, PALETTE.woodLight, M(0, 0.55, 0, { sx: r, sy: 1.05, sz: r })), wm);
      towerCourses(wm, { x: cx, z: cz, r, y0: 0.06, y1: 1.05, holes: [[0, 0.85, 0.4], [Math.PI, 0.85, 0.4]], seed: 21 });
      windowDress(wm, 0, 0.85, r, 'z', { sign: 1, w: 0.2, h: 0.28 });
      // the beehive dome: warm gold, with small bead bumps for texture
      const domeColor = PALETTE.gold;
      batchPart(P(GEO.dome, domeColor, M(0, 1.06, 0, { sx: r * 1.05, sy: r * 0.95, sz: r * 1.05 })), wm);
      roofCourses(wm, { x: cx, y: 1.06, z: cz, r: r * 1.05, h: r * 0.95, color: domeColor, kind: 'dome', rings: 4 });
      for (let i = 0; i < 30; i++) {
        const a = rng() * Math.PI * 2, phi = rng() * Math.PI * 0.42;
        const rr = r * 1.02 * Math.sin(phi);
        batchPart(P(GEO.bead, PALETTE.capBrown, M(Math.sin(a) * rr, 1.06 + r * 0.92 * Math.cos(phi), Math.cos(a) * rr, { s: 0.045 }), false), wm);
      }
      batchPart(P(GEO.sphereLo, PALETTE.wood, M(0, 1.06 + r * 0.93, 0, { s: 0.06 })), wm);
      // three lazy bees looping the tower
      const bees = [];
      for (let i = 0; i < 3; i++) {
        const bee = new THREE.Mesh(GEO.sphereLo, toon(0x2b211b));
        bee.scale.setScalar(0.035);
        addOutline(bee);
        bee.userData.phase = i * 2.1;
        scene.add(bee);
        bees.push(bee);
      }
      const lamp = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.windowWarm }));
      lamp.position.set(cx, 0.92, cz + r + 0.03);
      lamp.scale.setScalar(0.05);
      scene.add(lamp);
      glow(cx, 0.92, cz + r, { w: 0.5, h: 0.5 });
      const bg = bannerGeo(0.4, 0.24, { field: PALETTE.gold, stripe: PALETTE.tunic });
      const bp = bg.attributes.position;
      const banner = new THREE.Mesh(bg, toon(0xffffff, { vc: true, side: THREE.DoubleSide }));
      banner.position.set(cx + r + 0.24, 1.3, cz);
      banner.rotation.y = Math.PI / 2;
      scene.add(banner);
      // damage overlay
      const dmg = { shingles: new THREE.Group(), cracks: new THREE.Group(), state: 0, smokeTimer: 0 };
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(GEO.box, toon(PALETTE.gold));
        s.position.set(cx + (rng() - 0.5) * 1.2, 0.03, cz + (rng() - 0.3) * 1.2);
        s.scale.set(0.1, 0.02, 0.14); s.rotation.y = rng() * 3;
        dmg.shingles.add(s);
      }
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(GEO.box, toon(PALETTE.stoneDark));
        c.position.set(cx + Math.sin(i * 2) * r * 0.9, 0.6 + i * 0.15, cz + Math.cos(i * 2) * r * 0.9);
        c.scale.set(0.5, 0.012, 0.03); c.rotation.y = i * 2;
        dmg.cracks.add(c);
      }
      dmg.shingles.visible = false; dmg.cracks.visible = false;
      scene.add(dmg.shingles, dmg.cracks);
      GameState.on('endpointStateChanged', (st) => {
        dmg.state = st;
        dmg.shingles.visible = st >= 1;
        dmg.cracks.visible = st >= 2;
        setGlow(st >= 2 ? 0.35 : 1);
        shakeCamera(0.12, 0.4);
        puff(cx, 1.0, cz, { count: 16, color: PALETTE.gold, speed: 1.6, size: 0.1, up: 1.2, ttl: 0.8 });
      });
      const base = bp.array.slice();
      animated.push({
        update(t, dt) {
          const droop = dmg.state === 2 ? 0.35 : dmg.state === 1 ? 0.7 : 1;
          for (let i = 0; i < bp.count; i++) {
            const x = base[i * 3], u = (x + 0.2) / 0.4;
            bp.setZ(i, Math.sin(t * 5.2 - u * 4.5) * 0.06 * u * droop);
          }
          bp.needsUpdate = true;
          bg.computeVertexNormals();
          const tilt = dmg.state === 2 ? 0.06 : 0;
          for (const bee of bees) {
            const a = t * (dmg.state === 2 ? 0.5 : 1.4) + bee.userData.phase;
            bee.position.set(cx + Math.sin(a) * (r + 0.18), 1.15 + Math.sin(a * 3) * 0.06, cz + Math.cos(a) * (r + 0.18) * (1 + tilt));
          }
          lamp.material.color.setHex(PALETTE.windowWarm).multiplyScalar((0.85 + 0.15 * Math.sin(t * 7)) * (dmg.state === 2 ? 0.4 : 1));
        },
      });
    }

    // Blossom trees, this level's re-tinted signature look: the shared tree
    // recipe with canopy colors swapped for orchard blossom.
    const BLOSSOM = { [PALETTE.meadowDark]: PALETTE.flowerPink, [PALETTE.meadow]: PALETTE.meadowLight, [PALETTE.meadowLight]: PALETTE.cream };
    function blossomTreeParts(rng) {
      const t = treeParts(rng);
      if (rng() < 0.7) t.parts = t.parts.map((p) => (BLOSSOM[p.color] ? { ...p, color: BLOSSOM[p.color] } : p));
      return t;
    }
    function beehiveBoxParts(rng) {
      const h = 0.14 + rng() * 0.05;
      return {
        parts: [
          P(GEO.box, PALETTE.woodLight, M(0, h / 2, 0, { sx: 0.16, sy: h, sz: 0.16 }), false),
          P(GEO.box, PALETTE.gold, M(0, h + 0.02, 0, { sx: 0.18, sy: 0.04, sz: 0.18 }), false),
        ], radius: 0.1,
      };
    }

    function buildCountryside() {
      const rng = srand(717);
      const swayTrees = [];
      const mouths = GameState.routes.map((rt) => rt.cells[0]);
      const spawnAt = (c, r) => {
        if (mouths.some(([mc, mr]) => Math.abs(c - mc) <= 2 && Math.abs(r - mr) <= 1 && c <= mc)) return;
        const inGrid = GameState.inGrid(c, r);
        const h = GameState.zoneFalloff(c, r);
        const x = worldX(c) + (rng() - 0.5) * 0.5, z = worldZ(r) + (rng() - 0.5) * 0.5;
        const roll = rng();
        const put = ({ parts, radius }) => { for (const p of parts) batchPart(p, M(x, 0, z)); if (radius) batchDecal(x, z, radius); };
        if (h > 0.45) {
          if (roll < 0.32) put(deadTreeParts(rng));
          else if (roll < 0.6) put(rockParts(rng, true));
          return;
        }
        if (!inGrid) {
          if (roll < 0.65) put(blossomTreeParts(rng));
          else if (roll < 0.78) put(flowerParts(rng));
          else if (roll < 0.86) put(mushroomParts(rng, true));
          return;
        }
        const hidesTower = GameState.isBuildable(c, r - 1) || GameState.isBuildable(c - 1, r - 1);
        if (roll < 0.16 && !hidesTower) {
          const { parts, radius } = blossomTreeParts(rng);
          if (swayTrees.length < 8) {
            const gp = liveProp(parts, x, 0, z);
            gp.userData.phase = rng() * 6.28;
            swayTrees.push(gp);
            decal(x, z, radius);
          } else put({ parts, radius });
        } else if (roll < 0.24) put(beehiveBoxParts(rng));
        else if (roll < 0.5) put(flowerParts(rng));
        else if (roll < 0.68) put(tuftParts(rng));
        else if (roll < 0.78) put(mushroomParts(rng, rng() < 0.2));
        else if (roll < 0.87) put(rockParts(rng, false));
        else if (roll < 0.93) put(acornParts(rng));
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

    buildRavine();
    buildTram();
    buildSpawns();
    buildApiaryTower();
    buildCountryside();
  }

  // the trunk stays one column short of the tower (col 16) until it's past
  // the endpoint's own rows, then steps in from the south at row 8
  const tail = [[16, 7], [16, 8], [17, 8]];
  return {
    id: 'amber-terraces',
    index: 7,
    name: 'The Amber Terraces',
    subtitle: "The kingdom's breadbasket, defended before the storm reaches it.",
    map: { x: 230, y: 285, reclaim: 100, icon: 'apiary' },
    grid: { cols: 20, rows: 13 },
    spawn: [0, 3],
    // three roads of different length join the trunk at three points, then
    // share the tail across the tram line
    routes: [
      { id: 'grove-path', waypoints: [[0, 3], [5, 3], [5, 7], ...tail] },
      { id: 'hollow-way', waypoints: [[0, 1], [11, 1], [11, 4], [7, 4], [7, 7], ...tail] },
      { id: 'basket-road', waypoints: [[0, 10], [9, 10], [9, 7], ...tail] },
    ],
    chokepoint: { cell: [15, 7], streamCol: 15 },
    endpoint: {
      name: 'the Apiary Tower', properName: 'The Apiary Tower',
      cells: [[17, 6], [18, 6], [17, 7], [18, 7]], gateCell: [17, 7],
    },
    cobbleTailCells: 3,
    theme: {
      center: [1, 4], radiusOut: { x: 16, z: 12 }, radiusIn: 0.4, falloffWidth: 0.45,
      backdrop: 0x4a3f1f, groundMeadow: 0x9ac25c, groundMeadowDark: 0x7fa83f, ambient: 0.42,
      sun: 0.62, fill: 0xffe0a0, fillIntensity: 0.14,
      motes: { fireflies: 14, dust: 10 },
    },
    spawnBlockedText: 'Nothing but bare, cracked ground here.',
    waves, prepSeconds: 14, startGold: 170, startLives: 20, starThresholds: [16, 8],
    tipTile: [2, 2],
    endScreenText: {
      3: () => 'Twelve waves and not a single hive lost. The Amber Terraces are still the sweetest ground in the kingdom.',
      2: (s) => `Twelve waves across three orchard roads, ${s.lives} lives to spare. The Apiary Tower stands.`,
      1: (s) => `The bees are rattled but the tower stands, with ${s.lives} lives to spare.`,
      lose: (s) => `The Apiary Tower fell on wave ${s.wave}. Watch the horn markers for the next road, and remember only Druids and Artillery reach the bats.`,
    },
    buildScene,
  };
})();
