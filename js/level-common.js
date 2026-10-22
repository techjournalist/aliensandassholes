// ===================================================================
// LevelCommon — medieval set dressing shared by every level's
// buildScene(kit): the Black Baron's war camps at each road mouth, the
// kingdom's cottages, fences, haystacks and carts, a waving banner, a
// streamside bank, a filler-prop scatter and the endpoint damage overlay.
// Everything static goes through kit.batchPart, so a busy village costs a
// handful of draw calls, not hundreds.
// ===================================================================
const LevelCommon = (() => {
  // a gabled roof running along local x: two slanted planes meeting at a
  // ridge, gable triangles filled in, shingle lines across both slopes
  function gableRoof(kit, wm, { x = 0, y, z = 0, len, span, rise, color, gable = PALETTE.plaster, ry = 0 }) {
    const { P, M, GEO, batchPart, shade } = kit;
    const slope = Math.hypot(span, rise), ang = Math.atan2(rise, span);
    const place = (m) => new THREE.Matrix4().makeTranslation(x, 0, z).multiply(new THREE.Matrix4().makeRotationY(ry)).multiply(m);
    for (const s of [-1, 1]) {
      batchPart(P(GEO.box, s > 0 ? color : shade(color, 0.12), place(M(0, y + rise / 2, s * span / 2, { sx: len + 0.1, sy: 0.045, sz: slope + 0.08, rx: s * ang }))), wm);
      for (let i = 1; i < 4; i++) {
        const k = i / 4;
        batchPart(P(GEO.box, shade(color, 0.25), place(M(0, y + rise * (1 - k) + 0.026, s * span * k, { sx: len + 0.1, sy: 0.012, sz: 0.02, rx: s * ang })), false), wm);
      }
    }
    for (const e of [-1, 1]) {
      const d = Math.SQRT1_2 * span * 2;
      batchPart(P(GEO.box, gable, place(M(e * (len / 2 - 0.02), y, 0, { sx: 0.03, sy: d * 0.98, sz: d * 0.98, rx: Math.PI / 4 })), false), wm);
    }
    batchPart(P(GEO.cyl, shade(color, 0.3), place(M(0, y + rise + 0.015, 0, { sx: 0.035, sy: len + 0.14, sz: 0.035, rz: Math.PI / 2 })), false), wm);
  }

  // A timber-framed cottage: plaster walls with dark beams, a thatched or
  // tiled gable roof, a door, a warm window and a chimney.
  function cottageParts(kit, rng, { thatch = rng() < 0.6 } = {}) {
    const { P, M, GEO, shade } = kit;
    const w = 0.5 + rng() * 0.15, d = 0.38 + rng() * 0.08, h = 0.36 + rng() * 0.08;
    const parts = [
      P(GEO.box, PALETTE.plaster, M(0, h / 2, 0, { sx: w, sy: h, sz: d })),
      P(GEO.box, PALETTE.stoneDark, M(0, 0.04, 0, { sx: w + 0.03, sy: 0.08, sz: d + 0.03 }), false),
      // timber framing on the front face
      P(GEO.box, PALETTE.timber, M(0, h - 0.02, d / 2 + 0.005, { sx: w, sy: 0.035, sz: 0.012 }), false),
      P(GEO.box, PALETTE.timber, M(-w / 2 + 0.02, h / 2, d / 2 + 0.005, { sx: 0.035, sy: h, sz: 0.012 }), false),
      P(GEO.box, PALETTE.timber, M(w / 2 - 0.02, h / 2, d / 2 + 0.005, { sx: 0.035, sy: h, sz: 0.012 }), false),
      P(GEO.box, PALETTE.timber, M(w * 0.18, h / 2, d / 2 + 0.005, { sx: 0.03, sy: h * 1.1, sz: 0.012, rz: 0.6 }), false),
      P(GEO.box, PALETTE.wood, M(-w * 0.22, 0.13, d / 2 + 0.01, { sx: 0.1, sy: 0.18, sz: 0.012 }), false),
      P(GEO.box, PALETTE.windowWarm, M(w * 0.22, h * 0.55, d / 2 + 0.008, { sx: 0.08, sy: 0.08, sz: 0.01 }), false, { unlit: true }),
      P(GEO.box, PALETTE.timber, M(w * 0.22, h * 0.55, d / 2 + 0.012, { sx: 0.012, sy: 0.08, sz: 0.008 }), false),
    ];
    const roof = thatch ? PALETTE.thatch : PALETTE.roofTile, span = d / 2 + 0.07, rise = 0.24;
    const tmp = [];
    const fake = { ...kit, batchPart: (p) => tmp.push(p) };
    gableRoof(fake, null, { y: h, len: w + 0.06, span, rise, color: roof });
    parts.push(...tmp);
    parts.push(P(GEO.box, PALETTE.stoneDark, M(-w * 0.32, h + 0.22, -0.06, { sx: 0.08, sy: 0.24, sz: 0.08 })));
    if (thatch) parts.push(P(GEO.box, shade(roof, 0.2), M(0, h + 0.02, span + 0.01, { sx: w + 0.12, sy: 0.04, sz: 0.04 }), false));
    return { parts, radius: w * 0.75, chimney: [-w * 0.32, h + 0.36, -0.06] };
  }
  function bushParts(kit, rng) {
    const { P, M, GEO } = kit;
    const s = 0.14 + rng() * 0.1;
    const parts = [
      P(GEO.sphereLo, PALETTE.meadowDark, M(0, s * 0.8, 0, { sx: s * 1.4, sy: s, sz: s * 1.2 })),
      P(GEO.sphereLo, PALETTE.meadow, M(s * 0.5, s * 1.1, s * 0.2, { s: s * 0.7 })),
    ];
    if (rng() < 0.5) for (let i = 0; i < 3; i++) parts.push(P(GEO.bead, rng() < 0.5 ? PALETTE.capRed : PALETTE.heraldWhite, M((rng() - 0.5) * s * 2, s * (0.9 + rng() * 0.6), s * 0.9, { s: 0.03 }), false));
    return { parts, radius: s * 1.2 };
  }
  function fenceParts(kit, rng, len = 0.8, ry = rng() < 0.5 ? 0 : Math.PI / 2) {
    const { P, M, GEO } = kit;
    const parts = [];
    const n = Math.max(2, Math.round(len / 0.26));
    for (let i = 0; i < n; i++) {
      const u = -len / 2 + (i / (n - 1)) * len;
      parts.push(P(GEO.box, PALETTE.wood, M(Math.cos(ry) * u, 0.12, -Math.sin(ry) * u, { sx: 0.04, sy: 0.24, sz: 0.04, ry, rz: (rng() - 0.5) * 0.1 })));
    }
    for (const y of [0.09, 0.19]) parts.push(P(GEO.box, PALETTE.woodLight, M(0, y, 0, { sx: len, sy: 0.03, sz: 0.025, ry }), false));
    return { parts, radius: 0 };
  }
  function barrelParts(kit, rng) {
    const { P, M, GEO } = kit;
    const parts = [P(GEO.cyl, PALETTE.wood, M(0, 0.12, 0, { sx: 0.09, sy: 0.24, sz: 0.09 })), P(GEO.ring, PALETTE.steelDark, M(0, 0.17, 0, { s: 0.092, rx: Math.PI / 2 }), false), P(GEO.ring, PALETTE.steelDark, M(0, 0.07, 0, { s: 0.092, rx: Math.PI / 2 }), false)];
    if (rng() < 0.6) parts.push(P(GEO.box, PALETTE.woodLight, M(0.17, 0.08, 0.04, { sx: 0.16, sy: 0.16, sz: 0.16, ry: rng() * 2 })));
    return { parts, radius: 0.16 };
  }
  function cartParts(kit, rng, broken = false) {
    const { P, M, GEO } = kit;
    const ry = rng() * 6, c = Math.cos(ry), s = Math.sin(ry);
    const at = (x, y, z, o) => M(x * c + z * s, y, -x * s + z * c, { ...o, ry: (o.ry || 0) + ry });
    const wood = broken ? PALETTE.hollowWood : PALETTE.wood;
    const parts = [
      P(GEO.box, wood, at(0, 0.2, 0, { sx: 0.5, sy: 0.05, sz: 0.3, rz: broken ? 0.3 : 0 })),
      P(GEO.box, wood, at(0, 0.28, 0.14, { sx: 0.5, sy: 0.12, sz: 0.02, rz: broken ? 0.3 : 0 }), false),
      P(GEO.box, wood, at(0, 0.28, -0.14, { sx: 0.5, sy: 0.12, sz: 0.02, rz: broken ? 0.3 : 0 }), false),
      P(GEO.cyl, PALETTE.woodLight, at(0.05, 0.13, 0.19, { sx: 0.13, sy: 0.03, sz: 0.13, rx: Math.PI / 2 })),
      P(GEO.cyl, wood, at(0.4, 0.12, 0, { sx: 0.02, sy: 0.4, sz: 0.02, rz: Math.PI / 2 - 0.25 }), false),
    ];
    if (broken) parts.push(P(GEO.cyl, PALETTE.hollowWood, at(0.0, 0.03, -0.32, { sx: 0.13, sy: 0.03, sz: 0.13 })));
    else {
      parts.push(P(GEO.cyl, PALETTE.woodLight, at(0.05, 0.13, -0.19, { sx: 0.13, sy: 0.03, sz: 0.13, rx: Math.PI / 2 })));
      if (rng() < 0.6) parts.push(P(GEO.dome, PALETTE.straw, at(-0.02, 0.24, 0, { sx: 0.22, sy: 0.16, sz: 0.13 })));
    }
    return { parts, radius: 0.3 };
  }
  function stumpParts(kit, rng) {
    const { P, M, GEO } = kit;
    const s = 0.1 + rng() * 0.06;
    return { parts: [
      P(GEO.cylTaper, PALETTE.hollowWood, M(0, s * 0.8, 0, { sx: s, sy: s * 1.6, sz: s })),
      P(GEO.cyl, PALETTE.hollowEarth, M(0, s * 1.6, 0, { sx: s * 0.85, sy: 0.01, sz: s * 0.85 }), false),
      P(GEO.bead, PALETTE.spore, M(s * 0.4, s * 1.62, 0, { s: 0.025 }), false, { unlit: true }),
    ], radius: s * 1.2 };
  }
  function wellParts(kit) {
    const { P, M, GEO } = kit;
    return { parts: [
      P(GEO.cyl, PALETTE.stone, M(0, 0.14, 0, { sx: 0.18, sy: 0.28, sz: 0.18 })),
      P(GEO.cyl, PALETTE.waterDeep, M(0, 0.285, 0, { sx: 0.14, sy: 0.01, sz: 0.14 }), false),
      P(GEO.cyl, PALETTE.wood, M(0.16, 0.42, 0, { sx: 0.02, sy: 0.4, sz: 0.02 }), false),
      P(GEO.cyl, PALETTE.wood, M(-0.16, 0.42, 0, { sx: 0.02, sy: 0.4, sz: 0.02 }), false),
      P(GEO.cone, PALETTE.roofTile, M(0, 0.7, 0, { sx: 0.26, sy: 0.18, sz: 0.2 })),
    ], radius: 0.22 };
  }

  // A banner cloth that waves on its own and droops as the endpoint takes
  // damage. Returns the mesh; `stateRef.state` (0-2) drives the droop.
  function banner(kit, x, y, z, { w = 0.6, h = 0.36, field = PALETTE.tunic, stripe = PALETTE.gold, emblem, tattered = 0, stateRef = { state: 0 }, phase = 0 } = {}) {
    const g = kit.bannerGeo(w, h, { field, stripe, emblem, tattered });
    const bp = g.attributes.position, base = bp.array.slice();
    const mesh = new THREE.Mesh(g, kit.toon(0xffffff, { vc: true, side: THREE.DoubleSide }));
    mesh.position.set(x + w / 2, y, z);
    kit.scene.add(mesh);
    kit.animated.push({
      update(t) {
        const droop = stateRef.state === 2 ? 0.35 : stateRef.state === 1 ? 0.7 : 1;
        mesh.rotation.z = stateRef.state === 2 ? -0.5 : 0;
        for (let i = 0; i < bp.count; i++) {
          const bx = base[i * 3], u = (bx + w / 2) / w;
          bp.setZ(i, Math.sin(t * 5.5 + phase - u * 4.5) * 0.12 * w * u * droop);
          bp.setY(i, base[i * 3 + 1] + Math.sin(t * 2.2 + phase - u * 2) * 0.04 * w * u * droop);
        }
        bp.needsUpdate = true;
        g.computeVertexNormals();
      },
    });
    return mesh;
  }

  // The Black Baron's war camp at every road mouth: scorched ground, a black
  // tent, the Baron's banner, a campfire and a few sharpened stakes, so each
  // entry reads at a glance as where the knaves come from.
  function knaveCamps(kit) {
    const { P, M, GEO, batchPart, batchDecal, srand, worldX, worldZ, scene, animated, cols, rows } = kit;
    const tentGeo = new THREE.ConeGeometry(1, 1, 5).toNonIndexed();
    GameState.routes.forEach((rt, n) => {
      const rng = srand(613 + n * 7);
      const [sc, sr] = rt.cells[0], [nc, nr] = rt.cells[1];
      const dx = nc - sc, dz = nr - sr;   // the road leaves the camp this way
      const x = worldX(sc) - dx * 0.6, z = worldZ(sr) - dz * 0.6;
      const sx = -dz, sz = dx;   // sideways, along the map edge
      batchPart(P(GEO.circle, PALETTE.hollowEarth, M(x, 0.006, z, { s: 0.95 }), false));
      // the tent, off to one side of the road
      const tx = x + sx * 0.75 - dx * 0.35, tz = z + sz * 0.75 - dz * 0.35;
      batchPart(P(tentGeo, PALETTE.baron, M(tx, 0.32, tz, { sx: 0.42, sy: 0.64, sz: 0.42, ry: rng() })));
      batchPart(P(GEO.ring, PALETTE.baronRed, M(tx, 0.16, tz, { s: 0.33, rx: Math.PI / 2 }), false));
      batchPart(P(GEO.box, 0x120c0c, M(tx - sx * 0.1 + dx * 0.32, 0.12, tz - sz * 0.1 + dz * 0.32, { sx: 0.16, sy: 0.22, sz: 0.16 }), false));
      batchPart(P(GEO.cyl, PALETTE.wood, M(tx, 0.7, tz, { sx: 0.015, sy: 0.16, sz: 0.015 }), false));
      batchDecal(tx, tz, 0.45);
      // sharpened stakes along the other side
      for (let i = 0; i < 4; i++) {
        const u = -0.5 + i * 0.33;
        const px = x - sx * 0.7 + dx * u, pz = z - sz * 0.7 + dz * u;
        batchPart(P(GEO.cyl, PALETTE.hollowWood, M(px, 0.16, pz, { sx: 0.035, sy: 0.32, sz: 0.035, rx: dz * 0.4, rz: -dx * 0.4 })));
        batchPart(P(GEO.cone, PALETTE.woodLight, M(px + dx * 0.06, 0.34, pz + dz * 0.06, { sx: 0.035, sy: 0.08, sz: 0.035, rx: dz * 0.4, rz: -dx * 0.4 }), false));
      }
      // the Baron's banner on a tall pole
      const bx = x - sx * 0.55 - dx * 0.55, bz = z - sz * 0.55 - dz * 0.55;
      batchPart(P(GEO.cyl, PALETTE.hollowWood, M(bx, 0.6, bz, { sx: 0.025, sy: 1.2, sz: 0.025 })));
      batchPart(P(GEO.cone, PALETTE.steelDark, M(bx, 1.25, bz, { sx: 0.04, sy: 0.1, sz: 0.04 }), false));
      banner(kit, bx, 1.0, bz, { w: 0.42, h: 0.28, field: PALETTE.baron, stripe: PALETTE.baronRed, emblem: PALETTE.baronRed, tattered: 0.25, phase: n * 1.7 });
      // a campfire with a ring of stones, live flames and a smoke trail
      const fx = x + sx * 0.45 - dx * 0.7, fz = z + sz * 0.45 - dz * 0.7;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        batchPart(P(GEO.rock, PALETTE.hollowRock, M(fx + Math.cos(a) * 0.14, 0.03, fz + Math.sin(a) * 0.14, { s: 0.045 }), false));
      }
      const flame = new THREE.Mesh(GEO.cone, new THREE.MeshBasicMaterial({ color: PALETTE.ember, transparent: true, opacity: 0.9 }));
      flame.position.set(fx, 0.12, fz); flame.scale.set(0.09, 0.2, 0.09);
      const core = new THREE.Mesh(GEO.cone, new THREE.MeshBasicMaterial({ color: PALETTE.flowerYellow }));
      core.position.set(fx, 0.09, fz); core.scale.set(0.05, 0.11, 0.05);
      scene.add(flame, core);
      kit.glow(fx, 0.18, fz, { w: 0.7, h: 0.7 });
      let smoke = rng();
      animated.push({
        update(t, dt) {
          const k = 0.8 + 0.2 * Math.sin(t * 13 + n) * Math.sin(t * 4.7 + n * 2);
          flame.scale.set(0.09 * (2 - k), 0.2 * k, 0.09 * (2 - k));
          core.scale.set(0.05, 0.11 * (2 - k * 0.8), 0.05);
          smoke -= dt;
          if (smoke <= 0) { smoke = 0.35 + Math.random() * 0.3; kit.puff(fx, 0.3, fz, { count: 1, color: 0x5a524c, speed: 0.1, size: 0.13, up: 0.8, ttl: 1.8 }); }
        },
      });
    });
  }

  // Filler props over every free ground cell. `mix` is a list of
  // [weight, recipe] for open in-grid ground; `edge` for the framing ring
  // outside the grid; ravaged cells (falloff > 0.45) get charred stumps,
  // ash-grey rocks and burnt carts. `keepLow(c, r)` marks cells near the
  // endpoint where only low props may go, so its skyline stays clear.
  function countryside(kit, { seed, mix, edge, keepLow = () => false, sway = 8 }) {
    const { M, batchPart, batchDecal, liveProp, decal, srand, worldX, worldZ, cols, rows, border, level, animated } = kit;
    const rng = srand(seed);
    const swayTrees = [];
    const mouths = GameState.routes.map((rt) => rt.cells[0]);
    const R = {
      tree: () => kit.treeParts(rng), bush: () => bushParts(kit, rng), tuft: () => kit.tuftParts(rng),
      flower: () => kit.flowerParts(rng), rock: () => kit.rockParts(rng, false), hay: () => kit.hayParts(rng),
      fence: () => fenceParts(kit, rng), barrel: () => barrelParts(kit, rng), cart: () => cartParts(kit, rng),
      cottage: () => cottageParts(kit, rng), mushroom: () => kit.mushroomParts(rng, false), well: () => wellParts(kit),
      ...(kit.extraRecipes ? kit.extraRecipes(rng) : {}),
    };
    const pick = (list) => {
      let roll = rng() * list.reduce((a, [w]) => a + w, 0);
      for (const [w, name] of list) { roll -= w; if (roll <= 0) return name; }
      return null;
    };
    const chimneys = [];
    for (let r = -border; r < rows + border; r++) {
      for (let c = -border; c < cols + border; c++) {
        const inGrid = GameState.inGrid(c, r);
        if (inGrid) {
          if (GameState.cellKind(c, r) !== 'ground' || GameState.isBuildable(c, r) || GameState.isSpawn(c, r)) continue;
        } else if (c === level.chokepoint.streamCol) continue;
        // leave room for the war camps around every road mouth
        if (mouths.some(([mc, mr]) => Math.max(Math.abs(c - mc), Math.abs(r - mr)) <= (inGrid ? 1 : 2))) continue;
        const h = GameState.zoneFalloff(c, r);
        const x = worldX(c) + (rng() - 0.5) * 0.5, z = worldZ(r) + (rng() - 0.5) * 0.5;
        const put = ({ parts, radius }) => { for (const p of parts) batchPart(p, M(x, 0, z)); if (radius) batchDecal(x, z, radius); };
        if (h > 0.45) {
          const roll = rng();
          if (roll < 0.26) put(kit.deadTreeParts(rng));
          else if (roll < 0.46) put(kit.rockParts(rng, true));
          else if (roll < 0.6) put(stumpParts(kit, rng));
          else if (roll < 0.66) put(cartParts(kit, rng, true));
          continue;
        }
        let list = inGrid ? mix : edge;
        if (inGrid && keepLow(c, r)) list = [[3, 'tuft'], [2, 'flower'], [1, 'barrel'], [4, null]];
        // never stand a tall prop right in front of a build plot (it would hide the tower)
        const hides = inGrid && (GameState.isBuildable(c, r - 1) || GameState.isBuildable(c - 1, r - 1));
        let name = pick(list);
        if (hides && (name === 'tree' || name === 'cottage')) name = 'bush';
        if (!name || !R[name]) continue;
        const made = R[name]();
        if (name === 'tree' && swayTrees.length < sway) {
          const gp = liveProp(made.parts, x, 0, z);
          gp.userData.phase = rng() * 6.28;
          swayTrees.push(gp);
          decal(x, z, made.radius);
        } else put(made);
        if (made.chimney && chimneys.length < 6) chimneys.push([x + made.chimney[0], made.chimney[1], z + made.chimney[2]]);
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
    chimneySmoke(kit, chimneys);
  }
  function chimneySmoke(kit, spots) {
    if (!spots.length) return;
    const timers = spots.map(() => Math.random());
    kit.animated.push({
      update(t, dt) {
        spots.forEach(([x, y, z], i) => {
          timers[i] -= dt;
          if (timers[i] <= 0) { timers[i] = 0.9 + Math.random() * 0.6; kit.puff(x, y, z, { count: 1, color: 0xcfc6b8, speed: 0.08, size: 0.09, up: 0.6, ttl: 1.8 }); }
        });
      },
    });
  }

  // A stream down the level's chokepoint column, with bank stones and reeds
  // kept clear of the crossing.
  function stream(kit, { seed = 21, speed, stripe, shallow, deep, foam } = {}) {
    const { P, M, GEO, batchPart, srand, worldX, worldZ, rows, border, level } = kit;
    const x = worldX(level.chokepoint.streamCol), length = rows + border * 2;
    kit.water({ x, length, speed, stripe, shallow, deep, foam });
    const rng = srand(seed);
    for (let i = 0; i < 22; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const z = -length / 2 + 0.3 + rng() * (length - 0.6);
      if (Math.abs(z - worldZ(level.chokepoint.cell[1])) < 0.9) continue;
      const s = 0.06 + rng() * 0.07;
      batchPart(P(GEO.rock, PALETTE.stone, M(x + side * (0.5 + s * 0.6), -0.02, z, { sx: s * 1.4, sy: s, sz: s, ry: rng() * 3 }), false));
      if (rng() < 0.5) for (let k = 0; k < 3; k++) batchPart(P(GEO.cyl, PALETTE.meadowDark, M(x + side * (0.42 + rng() * 0.08), 0.06, z + (rng() - 0.5) * 0.2, { sx: 0.012, sy: 0.24 + rng() * 0.1, sz: 0.012, rz: side * 0.15 }), false));
    }
  }

  // Endpoint damage overlay: cracks at state 1, rubble, fire and heavy
  // smoke at state 2, a camera thump and a dust burst on every change.
  // `cracks` [[x, y, z, w, h, axis]], `rubble` [[x, z]], `fire` [x, y, z],
  // `smoke` [x, y, z], `burst` [x, y, z]; all in world space.
  function damage(kit, { cracks = [], rubble = [], fire, smoke, burst, stateRef, onState }) {
    const { GEO, scene, animated, toon, unlit, addOutline, puff, setGlow, shakeCamera } = kit;
    const dmg = { cracks: new THREE.Group(), rubble: new THREE.Group(), smokeTimer: 0 };
    cracks.forEach(([x, y, z, w, h, axis], i) => {
      const c = new THREE.Mesh(GEO.box, unlit(0x2b211b));
      c.position.set(x, y, z);
      if (axis === 'x') c.scale.set(0.05, h, w); else c.scale.set(w, h, 0.05);
      c.rotation[axis === 'x' ? 'x' : 'z'] = i % 2 ? 0.5 : -0.4;
      dmg.cracks.add(c);
    });
    rubble.forEach(([x, z], i) => {
      const r = new THREE.Mesh(GEO.rock, toon(i % 2 ? PALETTE.stoneDark : PALETTE.stone));
      r.position.set(x, 0.07, z); r.scale.set(0.18, 0.12, 0.15); r.rotation.y = i * 1.3;
      addOutline(r);
      dmg.rubble.add(r);
    });
    dmg.fire = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.ember, transparent: true, opacity: 0.9 }));
    dmg.fire.position.set(...fire); dmg.fire.scale.set(0.3, 0.42, 0.2);
    dmg.cracks.visible = dmg.rubble.visible = dmg.fire.visible = false;
    scene.add(dmg.cracks, dmg.rubble, dmg.fire);
    GameState.on('endpointStateChanged', (st) => {
      stateRef.state = st;
      dmg.cracks.visible = st >= 1;
      dmg.rubble.visible = dmg.fire.visible = st >= 2;
      setGlow(st >= 2 ? 0.35 : 1);
      shakeCamera(0.12, 0.4);
      puff(burst[0], burst[1], burst[2], { count: 16, color: PALETTE.stone, speed: 2, size: 0.12, up: 1.6, ttl: 0.8 });
      if (onState) onState(st);
    });
    animated.push({
      update(t, dt) {
        if (stateRef.state < 1) return;
        dmg.smokeTimer -= dt;
        if (dmg.smokeTimer <= 0) {
          const heavy = stateRef.state === 2;
          dmg.smokeTimer = heavy ? 0.07 : 0.4;
          puff(smoke[0] + Math.random() * 0.5 - 0.25, smoke[1], smoke[2], { count: 1, color: heavy ? 0x3a322c : 0x8c847a, speed: 0.15, size: heavy ? 0.26 : 0.16, up: heavy ? 1.3 : 0.9, ttl: heavy ? 2.2 : 1.6 });
          if (heavy && Math.random() < 0.35) puff(fire[0], fire[1] + 0.1, fire[2], { count: 1, color: 0xffb347, speed: 0.4, size: 0.05, up: 1.8, ttl: 0.7 });
        }
        if (stateRef.state === 2) {
          const f = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 7.3);
          dmg.fire.scale.set(0.3 * f, 0.42 * (2 - f), 0.2 * f);
          dmg.fire.material.opacity = 0.75 + 0.2 * Math.sin(t * 23);
        }
      },
    });
    return dmg;
  }

  // Warm windows that flicker, dimming when the endpoint is nearly lost.
  // spots: [[x, y, z, axis, sign]] in the endpoint's local frame `wm`.
  function windows(kit, wm, origin, spots, stateRef) {
    const { GEO, scene, animated, windowDress } = kit;
    const lit = spots.map(([x, y, z, axis, sign = 1]) => {
      const w = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: PALETTE.windowWarm }));
      w.position.set(origin[0] + x, y, origin[1] + z);
      if (axis === 'z') w.scale.set(0.16, 0.24, 0.05); else w.scale.set(0.05, 0.24, 0.16);
      w.userData.phase = x * 3 + z * 5;
      scene.add(w);
      windowDress(wm, x, y, z, axis, { sign });
      return w;
    });
    animated.push({
      update(t) {
        const dim = stateRef.state === 2 ? 0.35 : 1;
        for (const w of lit) {
          const f = (0.86 + 0.14 * Math.sin(t * 9 + w.userData.phase) * Math.sin(t * 3.3 + w.userData.phase * 0.7)) * dim;
          w.material.color.setHex(PALETTE.windowWarm).multiplyScalar(f);
        }
      },
    });
  }

  // the center of an endpoint's cell block, in world space
  function endpointCenter(kit) {
    const cells = kit.level.endpoint.cells;
    const cs = cells.map(([c]) => c), rs = cells.map(([, r]) => r);
    return [kit.worldX((Math.min(...cs) + Math.max(...cs)) / 2), kit.worldZ((Math.min(...rs) + Math.max(...rs)) / 2)];
  }

  return { gableRoof, cottageParts, bushParts, fenceParts, barrelParts, cartParts, stumpParts, wellParts, banner, knaveCamps, countryside, chimneySmoke, stream, damage, windows, endpointCenter };
})();
