// ===================================================================
// LEVEL 8 — The Frostpine Camp
// The kingdom's cold northern highlands, first snow already down. Two
// direct roads and one genuine switchback push through snow-heavy pines
// toward a lone timber outpost. Reuses the multi-route engine exactly as
// Level 4 built it — no engine changes, only geography, theme and waves.
// ===================================================================
const LEVEL_8 = (() => {
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: 'Scouts on the Scree', flavor: 'Grunts feel out the nearest path. Only one road so far.',            groups: [g('grunt', 5, 3.2, 0, 'scree-path')] },
    { name: 'The Frozen Draw Opens', flavor: 'Watch the Frozen Draw too. The horn shows where they come from.',   groups: [g('grunt', 4, 2.3, 0, 'scree-path', 0), g('grunt', 2, 2.7, 0, 'frozen-draw', 4)] },
    { name: 'Quick Feet on the Ice', flavor: 'Bog-Tricksters rush the Frozen Draw.',                              groups: [g('grunt', 4, 1.6, 0, 'scree-path', 0), g('trickster', 5, 0.9, 0, 'frozen-draw', 3)] },
    { name: 'The High Trail Opens', flavor: 'A Moss Troll takes the High Trail. It has time to spare.',           groups: [g('grunt', 5, 1.35, 0, 'scree-path', 0), g('troll', 1, 1, 0, 'high-trail', 2), g('grunt', 3, 1.6, 0, 'frozen-draw', 6)] },
    { name: 'Wings Through the Pines', flavor: 'Bramble Bats skim the Frozen Draw. Druids and Artillery only.',   groups: [g('bat', 3, 1.5, 0, 'frozen-draw', 0), g('grunt', 6, 1.1, 0, 'scree-path', 3)] },
    { name: 'Three Trails at Once', flavor: 'Every trail at once. Find the spots that cover two.',                 groups: [g('grunt', 5, 1.0, 0, 'scree-path', 0), g('grunt', 5, 1.0, 0, 'high-trail', 0), g('grunt', 5, 1.0, 0, 'frozen-draw', 0)] },
    { name: 'Ice and Speed',       flavor: 'Trolls on the High Trail, Tricksters on the Scree.',                   groups: [g('troll', 2, 2.6, 0, 'high-trail', 0), g('trickster', 7, 0.7, 0, 'scree-path', 2)] },
    { name: 'Swarm Season',        flavor: 'Bats over the draw, Tricksters on the scree, grunts on the trail.',    groups: [g('bat', 5, 0.95, 0, 'frozen-draw', 0), g('trickster', 8, 0.6, 0, 'scree-path', 2), g('grunt', 5, 1.0, 0, 'high-trail', 4)] },
    { name: 'The Frost Presses',   flavor: 'The Hollow leans on every trail in turn.',                            groups: [g('troll', 2, 2.4, 0, 'high-trail', 0), g('grunt', 8, 0.8, 0, 'scree-path', 1), g('trickster', 6, 0.65, 0, 'frozen-draw', 5), g('bat', 4, 1.0, 0, 'frozen-draw', 9)] },
    { name: 'Pincer',              flavor: 'Trolls down both northern trails, bats over the draw.',               groups: [g('troll', 2, 2.2, 0, 'high-trail', 0), g('troll', 2, 2.2, 0, 'scree-path', 1), g('bat', 6, 0.8, 0, 'frozen-draw', 3), g('grunt', 6, 0.8, 0, 'frozen-draw', 8)] },
    { name: 'Every Trail at Once', flavor: 'The camp shakes. Hold the ice-log crossing.',                         groups: [g('grunt', 10, 0.7, 0, 'scree-path', 0), g('trickster', 10, 0.5, 0, 'frozen-draw', 0), g('troll', 3, 2.0, 0, 'high-trail', 0), g('bat', 5, 0.9, 0, 'high-trail', 6)] },
    { name: 'The Long Night',      flavor: 'A Troll column, a Trickster rush and a Bat swarm, all at once.',      groups: [g('troll', 4, 2.0, 0, 'high-trail', 0), g('trickster', 14, 0.4, 0, 'scree-path', 0), g('bat', 9, 0.55, 0, 'frozen-draw', 0)] },
  ];

  // -------- this level's scene (ice-log crossing, Frostpine Camp) --------
  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, decal, toon,
      addOutline, srand, scene, animated, shakeCamera, puff,
      treeParts, deadTreeParts, rockParts, mushroomParts, tuftParts, flowerParts, acornParts,
      masonry, roofCourses, windowDress, glow, setGlow, bannerGeo,
      worldX, worldZ, cols, rows, border, level } = kit;

    // The half-frozen creek at the bottom of the draw.
    function buildCreek() {
      kit.water({ x: worldX(level.chokepoint.streamCol), length: rows + border * 2, speed: 0.35, stripe: 0.4, shallow: PALETTE.frost, deep: PALETTE.stone, foam: PALETTE.snow });
    }

    // The ice-log crossing: snow-capped logs lashed over the creek.
    function buildIceCrossing() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      const rng = srand(619);
      for (let i = 0; i < 5; i++) {
        batchPart(P(GEO.cyl, PALETTE.wood, M(-0.7 + i * 0.35, 0.06, (rng() - 0.5) * 0.15, { sx: 0.09, sy: 1.9, sz: 0.09, rz: Math.PI / 2, ry: (rng() - 0.5) * 0.2 })), wm);
        batchPart(P(GEO.cyl, PALETTE.snow, M(-0.7 + i * 0.35, 0.11, (rng() - 0.5) * 0.15, { sx: 0.05, sy: 1.7, sz: 0.05, rz: Math.PI / 2 }), false), wm);
      }
      for (const s of [-1, 1]) batchPart(P(GEO.box, PALETTE.snow, M(0, 0.14, s * 0.42, { sx: 1.8, sy: 0.03, sz: 0.06 }), false), wm);
      batchDecal(x, z, 0.6);
    }

    // Three snowbound trailheads, one at the head of every route.
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

    // The Frostpine Camp: a snow-capped timber watch-post with a lit
    // bonfire, fur banner, icicles off every eave. Damage: guttering fire
    // and a fallen icicle scatter at state 1, a collapsed wall corner and
    // a smothered fire at state 2.
    function buildCamp() {
      const cells = level.endpoint.cells;
      const cx = worldX((cells[0][0] + cells[cells.length - 1][0]) / 2);
      const cz = worldZ((cells[0][1] + cells[cells.length - 1][1]) / 2);
      const wm = M(cx, 0, cz);
      const rng = srand(647);
      const W = 0.75, D = 0.55;
      batchPart(P(GEO.circle, PALETTE.snow, M(0, 0.008, 0.05, { sx: 1.5, sz: 1.7 }), false), wm);
      const y0 = 0.05, y1 = 0.62;
      masonry(wm, { face: 'z', at: -D, sign: -1, u0: -W, u1: W, y0, y1, holes: [[0.2, 0.4, 0.24, 0.32]], seed: 31 });
      masonry(wm, { face: 'z', at: D, sign: 1, u0: -W, u1: W, y0, y1, holes: [[-0.15, 0.35, 0.26, 0.3]], seed: 32 });
      masonry(wm, { face: 'x', at: -W, sign: -1, u0: -D, u1: D, y0, y1, holes: [], seed: 33 });
      masonry(wm, { face: 'x', at: W, sign: 1, u0: -D, u1: D, y0, y1, holes: [], seed: 34 });
      // a peaked timber roof, snow-capped
      batchPart(P(GEO.box, PALETTE.wood, M(0, y1 + 0.18, 0, { sx: W * 2.1, sy: 0.06, sz: D * 2.1, rz: 0.28 })), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(0, y1 + 0.18, 0, { sx: W * 2.1, sy: 0.06, sz: D * 2.1, rz: -0.28 })), wm);
      batchPart(P(GEO.box, PALETTE.snow, M(0, y1 + 0.3, 0, { sx: W * 2.0, sy: 0.04, sz: D * 1.2, rz: 0.28 }), false), wm);
      batchPart(P(GEO.box, PALETTE.snow, M(0, y1 + 0.3, 0, { sx: W * 2.0, sy: 0.04, sz: D * 1.2, rz: -0.28 }), false), wm);
      windowDress(wm, 0.2, 0.4, D, 'z', { sign: 1, w: 0.2, h: 0.26 });
      // icicles hanging off the eaves
      for (let i = 0; i < 8; i++) {
        const u = -W + (i + 0.5) * (W * 2 / 8);
        const len = 0.06 + rng() * 0.07;
        batchPart(P(GEO.cone, PALETTE.frost, M(u, y1 + 0.05 - len / 2, D + 0.02, { sx: 0.025, sy: len, sz: 0.025, rx: Math.PI }), false), wm);
      }
      // the bonfire: a stacked log pile with a live flame and warm halo
      const fx = 0, fz = D + 0.5;
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26;
        batchPart(P(GEO.cyl, PALETTE.wood, M(Math.cos(a) * 0.12, 0.05, Math.sin(a) * 0.12, { sx: 0.05, sy: 0.24, sz: 0.05, rz: Math.PI / 2, ry: a })), M(cx + fx, 0, cz + fz));
      }
      const flame = new THREE.Mesh(GEO.cone, new THREE.MeshBasicMaterial({ color: 0xff9a3d, transparent: true, opacity: 0.92 }));
      flame.position.set(cx + fx, 0.24, cz + fz); flame.scale.set(0.11, 0.24, 0.11);
      scene.add(flame);
      glow(cx + fx, 0.3, cz + fz, { w: 0.7, h: 0.7 });
      // a fur banner by the door
      const bg = bannerGeo(0.4, 0.24, { field: PALETTE.pine, stripe: PALETTE.snow });
      const bp = bg.attributes.position;
      const banner = new THREE.Mesh(bg, toon(0xffffff, { vc: true, side: THREE.DoubleSide }));
      banner.position.set(cx - W - 0.08, 0.9, cz);
      banner.rotation.y = Math.PI / 2;
      scene.add(banner);
      batchPart(P(GEO.cyl, PALETTE.wood, M(-W - 0.08, 0.55, 0, { sx: 0.02, sy: 1.1, sz: 0.02 })), wm);
      // damage overlay
      const dmg = { icicles: new THREE.Group(), corner: new THREE.Group(), state: 0, smokeTimer: 0 };
      for (let i = 0; i < 6; i++) {
        const s = new THREE.Mesh(GEO.cone, toon(PALETTE.frost));
        s.position.set(cx + (rng() - 0.5) * 1.4, 0.03, cz + (rng() - 0.2) * 1.4);
        s.scale.set(0.03, 0.12, 0.03); s.rotation.x = Math.PI;
        dmg.icicles.add(s);
      }
      const corner = new THREE.Mesh(GEO.box, toon(PALETTE.stoneDark));
      corner.position.set(cx + W * 0.7, 0.15, cz - D * 0.7); corner.scale.set(0.22, 0.3, 0.22); corner.rotation.set(0.3, 0.4, 0.2);
      dmg.corner.add(corner);
      dmg.icicles.visible = false; dmg.corner.visible = false;
      scene.add(dmg.icicles, dmg.corner);
      GameState.on('endpointStateChanged', (st) => {
        dmg.state = st;
        dmg.icicles.visible = st >= 1;
        dmg.corner.visible = st >= 2;
        setGlow(st >= 2 ? 0.35 : 1);
        shakeCamera(0.12, 0.4);
        puff(cx, 0.5, cz, { count: 16, color: PALETTE.snow, speed: 1.6, size: 0.1, up: 1.2, ttl: 0.8 });
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
          const k = dmg.state === 2 ? 0.35 : 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 5.1);
          flame.scale.set(0.11 * (2 - k), 0.24 * k, 0.11 * (2 - k));
          flame.material.opacity = (0.8 + 0.15 * Math.sin(t * 19)) * (dmg.state === 2 ? 0.4 : 1);
          if (dmg.state >= 1) {
            dmg.smokeTimer -= dt;
            if (dmg.smokeTimer <= 0) {
              dmg.smokeTimer = dmg.state === 2 ? 0.5 : 1.1;
              puff(cx + fx + (rng() - 0.5) * 0.2, 0.5, cz + fz, { count: 1, color: 0x8c847a, speed: 0.15, size: 0.14, up: 0.9, ttl: 1.5 });
            }
          }
        },
      });
    }

    // Snow-dusted pines, this level's re-tinted signature look, plus a
    // small drift/snowbank filler prop.
    const FROST = { [PALETTE.meadowDark]: PALETTE.pine, [PALETTE.meadow]: PALETTE.pine, [PALETTE.meadowLight]: PALETTE.snow };
    function frostPineParts(rng) {
      const t = treeParts(rng);
      t.parts = t.parts.map((p) => (FROST[p.color] ? { ...p, color: FROST[p.color] } : p));
      if (rng() < 0.6) t.parts.push(P(GEO.sphereLo, PALETTE.snow, M(0.06, t.radius * 1.6, 0.02, { sx: t.radius * 0.7, sy: 0.05, sz: t.radius * 0.6 }), false));
      return t;
    }
    function snowdriftParts(rng) {
      const parts = [];
      for (let i = 0; i < 3; i++) {
        parts.push(P(GEO.sphereLo, PALETTE.snow, M((rng() - 0.5) * 0.2, 0.03, (rng() - 0.5) * 0.2, { sx: 0.14, sy: 0.04, sz: 0.12 }), false));
      }
      return { parts, radius: 0.1 };
    }

    function buildCountryside() {
      const rng = srand(823);
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
          if (roll < 0.4) put(deadTreeParts(rng));
          else if (roll < 0.7) put(rockParts(rng, true));
          else if (roll < 0.82) put(snowdriftParts(rng));
          return;
        }
        if (!inGrid) {
          if (roll < 0.7) put(frostPineParts(rng));
          else if (roll < 0.85) put(rockParts(rng, false));
          else if (roll < 0.93) put(snowdriftParts(rng));
          return;
        }
        const hidesTower = GameState.isBuildable(c, r - 1) || GameState.isBuildable(c - 1, r - 1);
        if (roll < 0.2 && !hidesTower) {
          const { parts, radius } = frostPineParts(rng);
          if (swayTrees.length < 8) {
            const gp = liveProp(parts, x, 0, z);
            gp.userData.phase = rng() * 6.28;
            swayTrees.push(gp);
            decal(x, z, radius);
          } else put({ parts, radius });
        } else if (roll < 0.3) put(rockParts(rng, false));
        else if (roll < 0.55) put(snowdriftParts(rng));
        else if (roll < 0.7) put(tuftParts(rng));
        else if (roll < 0.8) put(mushroomParts(rng, rng() < 0.4));
        else if (roll < 0.88) put(flowerParts(rng));
        else if (roll < 0.94) put(acornParts(rng));
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

    buildCreek();
    buildIceCrossing();
    buildSpawns();
    buildCamp();
    buildCountryside();
  }

  // the shared trunk stays east of the endpoint's own columns (12-14) and
  // south of its rows (12-13) until the very last step, approaching from
  // outside the block the same way every earlier level's tail does
  const tail = [[15, 10], [15, 14], [13, 14]];
  return {
    id: 'frostpine-camp',
    index: 8,
    name: 'The Frostpine Camp',
    subtitle: 'First snow, and the Hollow rides in on it. Hold the crossing.',
    map: { x: 430, y: 68, reclaim: 100, icon: 'camp' },
    grid: { cols: 16, rows: 15 },
    spawn: [0, 4],
    // two direct trails (scree-path, frozen-draw) and one genuine
    // switchback (high-trail) all merge onto the row-10 trunk before the
    // ice-log crossing. high-trail is banded through columns 6-9 (rows
    // 0-10) specifically so its zigzag never crosses scree-path's column-5
    // descent (rows 4-10) or frozen-draw's column-4 descent (rows 10-13) —
    // an earlier draft crossed scree-path at (5,7) and was caught by
    // tools/validate-levels.js's "routes stay merged once they meet" check.
    routes: [
      { id: 'scree-path', waypoints: [[0, 4], [5, 4], [5, 10], ...tail] },
      { id: 'high-trail', waypoints: [[9, 0], [9, 3], [6, 3], [6, 6], [9, 6], [9, 10], ...tail] },
      { id: 'frozen-draw', waypoints: [[0, 13], [4, 13], [4, 10], ...tail] },
    ],
    chokepoint: { cell: [11, 10], streamCol: 11 },
    endpoint: {
      name: 'the Frostpine Camp', properName: 'The Frostpine Camp',
      cells: [[12, 12], [13, 12], [14, 12], [12, 13], [13, 13], [14, 13]], gateCell: [13, 13],
    },
    cobbleTailCells: 3,
    theme: {
      center: [1, 8], radiusOut: { x: 14, z: 12 }, radiusIn: 0.55, falloffWidth: 0.45,
      backdrop: 0x27343a, groundMeadow: 0x6a9488, groundMeadowDark: 0x557a70, ambient: 0.32,
      sun: 0.5, fill: 0xaed4dd, fillIntensity: 0.16,
      motes: { embers: 10, dust: 30 },
    },
    spawnBlockedText: 'Nothing but frozen, cracked ground here.',
    waves, prepSeconds: 14, startGold: 170, startLives: 20, starThresholds: [16, 8],
    tipTile: [2, 5],
    endScreenText: {
      3: () => 'Twelve waves through the first snow, and the fire never went out. The Frostpine Camp stands.',
      2: (s) => `Twelve waves across three frozen trails, ${s.lives} lives to spare. The camp holds.`,
      1: (s) => `The fire gutters but holds, with ${s.lives} lives to spare.`,
      lose: (s) => `The Frostpine Camp went dark on wave ${s.wave}. Watch the horn markers for the next trail, and remember only Druids and Artillery reach the bats.`,
    },
    buildScene,
  };
})();
