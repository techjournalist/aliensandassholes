// ===================================================================
// LEVEL 3 — The Cairnwatch
// A genuinely contested border, roughly half lost to blight. Same
// mechanics as Levels 1-2, a switchback map and a scarred endpoint.
// ===================================================================
const LEVEL_3 = (() => {
  const g = (type, count, gap, delay = 0) => ({ type, count, gap, delay });

  const waves = [
    { name: 'First Stand',       flavor: 'Grunts test the switchback. Hold the top of the stair.',        groups: [g('grunt', 5, 3.4)] },
    { name: 'Held Ground',       flavor: 'More grunts, closer together now.',                              groups: [g('grunt', 8, 1.4)] },
    { name: 'Runners',           flavor: 'Bog-Tricksters take the low path. Slingers love them.',          groups: [g('grunt', 5, 1.2), g('trickster', 7, 0.65, 2)] },
    { name: 'Stone and Hide',    flavor: 'A Moss Troll grinds up the stair. Hit it hard.',                 groups: [g('grunt', 8, 1.0), g('troll', 1, 1, 3)] },
    { name: 'Overhead',          flavor: 'Bramble Bats clear the ravine. Druids and Artillery only.',      groups: [g('bat', 5, 1.2), g('grunt', 8, 0.9, 2)] },
    { name: 'The Narrow Stair',  flavor: 'Grunts and Tricksters together, pressing the switchback.',       groups: [g('grunt', 10, 0.8), g('trickster', 8, 0.6, 2)] },
    { name: 'Twin Trolls',       flavor: 'A column of Trolls. Rooting wins this one.',                     groups: [g('troll', 2, 2.5), g('grunt', 8, 0.7, 3)] },
    { name: 'Wings Over the Ravine', flavor: 'Bats overhead, Tricksters underfoot.',                       groups: [g('bat', 7, 0.7), g('trickster', 10, 0.5, 2)] },
    { name: 'The Cart Breaks',   flavor: 'Everything at once. The rope groans under the strain.',          groups: [g('troll', 3, 2.2), g('grunt', 12, 0.6, 2), g('bat', 6, 0.8, 5)] },
    { name: 'Pressed Hard',      flavor: 'The border bends but does not break. Not yet.',                  groups: [g('troll', 3, 2.0), g('trickster', 14, 0.45, 1), g('bat', 7, 0.65, 4)] },
    { name: 'Almost Through',    flavor: 'The last quiet before the line breaks.',                          groups: [g('grunt', 14, 0.5), g('troll', 3, 1.8, 2), g('bat', 8, 0.6, 5)] },
    { name: 'The Line Breaks',   flavor: 'A Troll column, a Trickster rush, and a Bat swarm — together, all at once.', groups: [g('troll', 4, 2.0, 0), g('trickster', 14, 0.4, 0), g('bat', 9, 0.55, 0)] },
  ];

  // -------- this level's scene (Ravine Stair chokepoint, Cairnwatch Tower endpoint) --------
  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, decal, toon, unlit,
      addOutline, srand, lerpColor, scene, animated, shakeCamera, puff,
      treeParts, deadTreeParts, rockParts, mushroomParts, tuftParts, flowerParts, acornParts,
      worldX, worldZ, cols, rows, border, level } = kit;

    // The fissure: a dark ravine crack instead of a river — no water, just
    // shadow and jagged rock, with a faint magic seep at the bottom since
    // the border has been fought over long enough for corruption to reach it.
    function buildFissure() {
      const x = worldX(level.chokepoint.streamCol);
      const length = rows + border * 2;
      // the shared water shader, slowed and recolored into a sluggish,
      // faintly glowing corrupted ooze at the bottom of the chasm
      kit.water({ x, length, width: 1.05, y: -0.16, shallow: 0x3a2448, deep: 0x120c14, foam: PALETTE.magicGlow, speed: 0.22, stripe: 0.8, foamAmt: 0.4 });
      const rng = srand(331);
      for (let i = 0; i < 18; i++) {
        const side = rng() < 0.5 ? -1 : 1;
        const z = -length / 2 + 0.3 + rng() * (length - 0.6);
        if (Math.abs(z - worldZ(level.chokepoint.cell[1])) < 0.9) continue;
        const s = 0.07 + rng() * 0.09;
        batchPart(P(GEO.rock, PALETTE.hollowRock, M(x + side * (0.5 + s * 0.5), -0.02, z, { sx: s * 1.3, sy: s * 1.4, sz: s, ry: rng() * 3 })));
      }
    }

    // The Ravine Stair: a narrow plank crossing with a rope-and-pulley cart
    // beside it — distinct from Level 1's rope bridge and Level 2's stone
    // causeway. The cart sways gently on its rope, a quiet whimsy touch.
    function buildRavineStair() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const rng = srand(343);
      const wm = M(x, 0, z);
      // stone footings and a narrow stair-plank walkway
      batchPart(P(GEO.box, PALETTE.stoneDark, M(0, -0.02, -0.32, { sx: 1.1, sy: 0.08, sz: 0.08 })), wm);
      batchPart(P(GEO.box, PALETTE.stoneDark, M(0, -0.02, 0.32, { sx: 1.1, sy: 0.08, sz: 0.08 })), wm);
      for (let i = 0; i < 6; i++) {
        const px = -0.46 + i * 0.185;
        batchPart(P(GEO.box, i % 2 ? PALETTE.woodLight : PALETTE.wood,
          M(px, 0.02 + (rng() - 0.5) * 0.015, (rng() - 0.5) * 0.04, { sx: 0.15, sy: 0.05, sz: 0.86, ry: (rng() - 0.5) * 0.06 })), wm);
      }
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const px = -0.4 + i * 0.4;
          batchPart(P(GEO.box, PALETTE.woodLight, M(px, 0.24, side * 0.42, { sx: 0.06, sy: 0.4, sz: 0.06 })), wm);
        }
        batchPart(P(GEO.box, PALETTE.wood, M(0, 0.42, side * 0.42, { sx: 1.0, sy: 0.045, sz: 0.06 })), wm);
      }
      for (const side of [-1, 1]) {
        batchPart(P(GEO.box, PALETTE.stoneDark, M(side * 0.58, -0.05, 0, { sx: 0.15, sy: 0.14, sz: 0.9 })), wm);
      }
      // the rope-and-pulley cart, off to one side, swaying gently over the fissure
      const postL = new THREE.Mesh(GEO.cyl, toon(PALETTE.wood));
      postL.position.set(x - 0.75, 0.4, z + 0.7);
      postL.scale.set(0.045, 0.8, 0.045);
      scene.add(postL);
      const postR = new THREE.Mesh(GEO.cyl, toon(PALETTE.wood));
      postR.position.set(x + 0.75, 0.4, z + 0.7);
      postR.scale.set(0.045, 0.8, 0.045);
      scene.add(postR);
      const rope = new THREE.Mesh(GEO.cyl, toon(PALETTE.stoneDark));
      rope.position.set(x, 0.78, z + 0.7);
      rope.rotation.z = Math.PI / 2;
      rope.scale.set(0.02, 1.5, 0.02);
      scene.add(rope);
      const cart = new THREE.Group();
      const cartBox = new THREE.Mesh(GEO.box, toon(PALETTE.wood));
      cartBox.scale.set(0.24, 0.18, 0.18);
      cart.add(cartBox);
      addOutline(cartBox);
      const cartRope = new THREE.Mesh(GEO.cyl, toon(PALETTE.stoneDark));
      cartRope.position.y = 0.14;
      cartRope.scale.set(0.015, 0.2, 0.015);
      cart.add(cartRope);
      cart.position.set(x, 0.63, z + 0.7);
      scene.add(cart);
      animated.push({
        update(t) {
          const sway = Math.sin(t * 0.7) * 0.35;
          cart.position.x = x + sway;
          cart.rotation.z = -sway * 0.25;
        },
      });
    }

    // Spawn dressing: a corrupted forward camp — cruder and more overtly
    // hostile than Level 2's trampled grass, since the border is half lost.
    function buildOutpost() {
      const [sc, sr] = level.spawn;
      const x = worldX(sc), z = worldZ(sr);
      const rng = srand(737);
      batchPart(P(GEO.circle, PALETTE.hollowEarth, M(x, 0.006, z, { s: 1.0 }), false));
      for (let i = 0; i < 4; i++) {
        const a = 0.6 + i * 1.5, d = 0.7;
        batchPart(P(GEO.cone, PALETTE.hollowWood, M(x + Math.cos(a) * d, 0.28, z + Math.sin(a) * d, { sx: 0.05, sy: 0.56, sz: 0.05, rz: (rng() - 0.5) * 0.3 })));
      }
      for (let i = 0; i < 6; i++) {
        const a = rng() * Math.PI * 2, d = 0.5 + rng() * 0.9;
        const cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d;
        const s = 0.09 + rng() * 0.09;
        batchPart(P(GEO.rock, PALETTE.hollowRock, M(cx, 0.02, cz, { sx: s * 1.3, sy: s, sz: s, ry: rng() * 3 })));
      }
      for (let i = 0; i < 3; i++) {
        const a = 2.4 + i * 2.1, d = 1.0;
        const { parts } = deadTreeParts(rng);
        for (const p of parts) batchPart(p, M(x + Math.cos(a) * d, 0, z + Math.sin(a) * d));
      }
      const cracks = [];
      for (let i = 0; i < 8; i++) {
        const a = rng() * Math.PI * 2, d = 0.6 + rng() * 1.6, len = 0.28 + rng() * 0.4;
        const cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d;
        const crack = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: PALETTE.magicGlow, transparent: true, opacity: 0.7, depthWrite: false }));
        crack.scale.set(len, 0.01, 0.07);
        crack.position.set(cx, 0.006, cz);
        crack.rotation.y = rng() * Math.PI;
        crack.userData.phase = rng() * 6.28;
        scene.add(crack);
        cracks.push(crack);
      }
      animated.push({
        update(t) {
          for (const c of cracks) c.material.opacity = 0.4 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + c.userData.phase));
        },
      });
    }

    // The Cairnwatch Tower: built with the Bastion/Watch-Mill's proven
    // technique, but already scarred before the player arrives — a
    // permanent collapsed section and old scorch marks baked into the
    // base geometry, on top of which the usual live damage overlay still
    // layers fresh cracks and fire as lives are lost during this fight.
    function buildCairnwatch() {
      const cells = level.endpoint.cells;
      const cx = worldX((cells[0][0] + cells[cells.length - 1][0]) / 2);
      const cz = worldZ((cells[0][1] + cells[cells.length - 1][1]) / 2);
      const wm = M(cx, 0, cz);
      const stone = PALETTE.stone, dark = PALETTE.stoneDark;
      const H = 1.7;
      batchPart(P(GEO.box, stone, M(0, H / 2, -0.1, { sx: 1.7, sy: H, sz: 2.2 })), wm);
      batchPart(P(GEO.box, dark, M(0, 0.12, -0.1, { sx: 1.78, sy: 0.24, sz: 2.28 })), wm);
      batchPart(P(GEO.box, PALETTE.moss, M(0, H + 0.03, -0.1, { sx: 1.62, sy: 0.06, sz: 2.12 }), false), wm);
      for (let i = -2; i <= 2; i++) {
        batchPart(P(GEO.box, dark, M(i * 0.36, H + 0.16, 1.06, { sx: 0.2, sy: 0.24, sz: 0.14 })), wm);
      }
      // permanent scars: a collapsed corner and old scorch, always visible
      batchPart(P(GEO.rock, dark, M(0.75, 0.35, 0.9, { sx: 0.4, sy: 0.5, sz: 0.4, ry: 0.6 })), wm);
      batchPart(P(GEO.rock, dark, M(0.55, 0.15, 1.15, { sx: 0.3, sy: 0.25, sz: 0.3, ry: 1.4 })), wm);
      batchPart(P(GEO.circle, 0x2b211b, M(0.7, H + 0.07, 0.6, { s: 0.5 }), false), wm);
      // the tall watch tower, leaning slightly from age and damage
      const KT = 2.9, kx = -0.35, kz = -0.7;
      const towerGroup = new THREE.Group();
      towerGroup.position.set(cx + kx, 0, cz + kz);
      towerGroup.rotation.z = 0.05;
      const towerBody = new THREE.Mesh(GEO.cyl, toon(stone));
      towerBody.position.y = KT / 2;
      towerBody.scale.set(0.44, KT, 0.44);
      towerGroup.add(towerBody);
      addOutline(towerBody);
      const towerCap = new THREE.Mesh(GEO.cyl, toon(dark));
      towerCap.position.y = KT;
      towerCap.scale.set(0.5, 0.1, 0.5);
      towerGroup.add(towerCap);
      const towerRoof = new THREE.Mesh(GEO.cone, toon(PALETTE.capBrown));
      towerRoof.position.y = KT + 0.32;
      towerRoof.scale.set(0.58, 0.66, 0.58);
      towerGroup.add(towerRoof);
      addOutline(towerRoof);
      scene.add(towerGroup);
      // the gate, an old iron-bound door
      const gx = -0.3, gz = 0.96;
      batchPart(P(GEO.box, 0x2b211b, M(gx, 0.36, gz, { sx: 0.58, sy: 0.72, sz: 0.08 }), false), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(gx, 0.32, gz + 0.02, { sx: 0.46, sy: 0.64, sz: 0.05 }), false), wm);
      batchPart(P(GEO.box, dark, M(gx, 0.05, gz + 0.18, { sx: 0.8, sy: 0.1, sz: 0.24 })), wm);
      const lanterns = [];
      for (const lx of [gx - 0.46, gx + 0.46]) {
        batchPart(P(GEO.cyl, PALETTE.wood, M(lx, 0.26, gz + 0.26, { sx: 0.032, sy: 0.52, sz: 0.032 })), wm);
        const l = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.windowWarm }));
        l.position.set(cx + lx, 0.54, cz + gz + 0.26);
        l.scale.setScalar(0.048);
        l.userData.phase = lx * 7;
        scene.add(l);
        lanterns.push(l);
      }
      const windows = [];
      const winSpots = [
        [-0.5, 0.95, 0.96, 'z'], [0.4, 0.65, 0.96, 'z'], [kx, 1.5, kz + 0.4, 'z'], [kx, 2.1, kz + 0.4, 'z'],
      ];
      for (const [wx, wy, wz, axis] of winSpots) {
        const w = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: PALETTE.windowWarm }));
        w.position.set(cx + wx, wy, cz + wz);
        if (axis === 'z') w.scale.set(0.15, 0.2, 0.05); else w.scale.set(0.05, 0.2, 0.15);
        w.userData.phase = wx * 3 + wz * 5;
        scene.add(w);
        windows.push(w);
      }
      // a tattered banner, half its cloth already torn away
      const pole = new THREE.Mesh(GEO.cyl, toon(PALETTE.wood));
      pole.position.set(cx + kx, KT + 0.65, cz + kz);
      pole.scale.set(0.028, 0.85, 0.028);
      scene.add(pole);
      const bannerGeo = new THREE.PlaneGeometry(0.5, 0.3, 5, 3);
      const bp = bannerGeo.attributes.position, bcols = new Float32Array(bp.count * 3);
      const gold = new THREE.Color(PALETTE.gold), troll = new THREE.Color(PALETTE.troll);
      for (let i = 0; i < bp.count; i++) {
        const col = Math.abs(bp.getY(i)) < 0.05 ? troll : gold;
        bcols[i * 3] = col.r; bcols[i * 3 + 1] = col.g; bcols[i * 3 + 2] = col.b;
      }
      bannerGeo.setAttribute('color', new THREE.BufferAttribute(bcols, 3));
      const banner = new THREE.Mesh(bannerGeo, toon(0xffffff, { vc: true, side: THREE.DoubleSide }));
      banner.position.set(cx + kx + 0.28, KT + 0.8, cz + kz);
      scene.add(banner);
      // live damage overlay: fresh cracks, rubble and fire on top of the old scars
      const dmg = { cracks: new THREE.Group(), rubble: new THREE.Group(), smokeTimer: 0, state: 0 };
      const crackSpots = [[-0.35, 0.4, 0.96, 0.2, 0.55], [0.45, 0.8, 0.96, 0.14, 0.4], [-0.8, 0.7, 0.3, 0.16, 0.45]];
      crackSpots.forEach(([wx, wy, wz, ww, wh], i) => {
        const c = new THREE.Mesh(GEO.box, unlit(0x2b211b));
        c.position.set(cx + wx, wy, cz + wz);
        c.scale.set(wz > 0.9 ? ww : 0.05, wh, wz > 0.9 ? 0.05 : ww);
        c.rotation.z = (i % 2 ? 0.5 : -0.4);
        dmg.cracks.add(c);
      });
      for (let i = 0; i < 5; i++) {
        const r = new THREE.Mesh(GEO.rock, toon(PALETTE.stoneDark));
        const a = i * 1.2, d = 0.85 + (i % 2) * 0.2;
        r.position.set(cx + (i < 3 ? -0.8 - (i % 2) * 0.15 : Math.cos(a) * 0.5), 0.08, cz + (i < 3 ? -0.4 + i * 0.4 : 1.0 + (i % 2) * 0.15));
        r.scale.set(0.17, 0.11, 0.14); r.rotation.y = a;
        addOutline(r);
        dmg.rubble.add(r);
      }
      dmg.fire = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.9 }));
      dmg.fire.position.set(cx - 0.35, 1.0, cz + 0.85); dmg.fire.scale.set(0.26, 0.35, 0.16);
      dmg.scorch = new THREE.Mesh(GEO.circle, unlit(0x2b211b, { opacity: 0.85, depthWrite: false }));
      dmg.scorch.position.set(cx - 0.2, H + 0.72, cz + 0.3); dmg.scorch.scale.setScalar(0.48);
      dmg.cracks.visible = false; dmg.rubble.visible = false; dmg.fire.visible = false; dmg.scorch.visible = false;
      scene.add(dmg.cracks, dmg.rubble, dmg.fire, dmg.scorch);
      GameState.on('endpointStateChanged', (st) => {
        dmg.state = st;
        dmg.cracks.visible = st >= 1;
        dmg.rubble.visible = st >= 2;
        dmg.fire.visible = st >= 2;
        dmg.scorch.visible = st >= 2;
        shakeCamera(0.12, 0.4);
        puff(cx - 0.4, 0.5, cz + 1.0, { count: 16, color: PALETTE.stone, speed: 2, size: 0.12, up: 1.6, ttl: 0.8 });
      });
      const base = bp.array.slice();
      animated.push({
        update(t, dt) {
          const droop = dmg.state === 2 ? 0.35 : dmg.state === 1 ? 0.7 : 1;
          banner.rotation.z = dmg.state === 2 ? -0.6 : 0;
          for (let i = 0; i < bp.count; i++) {
            const x = base[i * 3], u = (x + 0.25) / 0.5;
            bp.setZ(i, Math.sin(t * 5.5 - u * 4.5) * 0.07 * u * droop);
            bp.setY(i, base[i * 3 + 1] + Math.sin(t * 2.2 - u * 2) * 0.022 * u * droop);
          }
          if (dmg.state >= 1) {
            dmg.smokeTimer -= dt;
            if (dmg.smokeTimer <= 0) {
              dmg.smokeTimer = dmg.state === 2 ? 0.07 : 0.4;
              const heavy = dmg.state === 2;
              puff(cx - 0.2 + Math.random() * 0.5 - 0.25, H + 0.7, cz + 0.3, { count: 1, color: heavy ? 0x3a322c : 0x8c847a, speed: 0.15, size: heavy ? 0.26 : 0.16, up: heavy ? 1.3 : 0.9, ttl: heavy ? 2.2 : 1.6 });
              if (heavy && Math.random() < 0.35) puff(cx - 0.35, 1.0, cz + 0.85, { count: 1, color: 0xffb347, speed: 0.4, size: 0.05, up: 1.8, ttl: 0.7 });
            }
            if (dmg.state === 2) {
              const f = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 7.3);
              dmg.fire.scale.set(0.26 * f, 0.35 * (2 - f), 0.16 * f);
              dmg.fire.material.opacity = 0.75 + 0.2 * Math.sin(t * 23);
            }
          }
          bp.needsUpdate = true;
          bannerGeo.computeVertexNormals();
          for (const w of windows) {
            const dim = dmg.state === 2 ? 0.35 : 1;
            const f = (0.86 + 0.14 * Math.sin(t * 9 + w.userData.phase) * Math.sin(t * 3.3 + w.userData.phase * 0.7)) * dim;
            w.material.color.setHex(PALETTE.windowWarm).multiplyScalar(f);
          }
          for (const l of lanterns) {
            const f = 0.8 + 0.2 * Math.sin(t * 11 + l.userData.phase) * Math.sin(t * 2.7 + l.userData.phase);
            l.material.color.setHex(PALETTE.windowWarm).multiplyScalar(f);
            l.scale.setScalar(0.048 + 0.008 * f);
          }
        },
      });
    }

    // A trail-marker cairn, unique to this level's exposed-border dressing.
    function cairnParts(rng) {
      const s = 0.14 + rng() * 0.06;
      const parts = [];
      let y = 0;
      const layers = 3 + (rng() < 0.5 ? 1 : 0);
      for (let i = 0; i < layers; i++) {
        const ls = s * (1 - i * 0.22);
        y += ls * 0.7;
        parts.push(P(GEO.rock, i % 2 ? PALETTE.stone : PALETTE.stoneDark,
          M((rng() - 0.5) * s * 0.3, y, (rng() - 0.5) * s * 0.3, { sx: ls * 1.3, sy: ls, sz: ls * 1.1, ry: rng() * 3 })));
        y += ls * 0.55;
      }
      parts.push(P(GEO.cyl, PALETTE.wood, M(0, y, 0, { sx: 0.012, sy: 0.22, sz: 0.012 }), false));
      parts.push(P(GEO.box, PALETTE.troll, M(0.02, y + 0.1, 0, { sx: 0.09, sy: 0.07, sz: 0.01 }), false));
      return { parts, radius: s * 1.2 };
    }

    function buildCountryside() {
      const rng = srand(3131);
      const swayTrees = [];
      const spawnAt = (c, r) => {
        const inGrid = GameState.inGrid(c, r);
        const h = GameState.zoneFalloff(c, r);
        const x = worldX(c) + (rng() - 0.5) * 0.5, z = worldZ(r) + (rng() - 0.5) * 0.5;
        const roll = rng();
        if (h > 0.45) {
          if (roll < 0.35) {
            const { parts, radius } = deadTreeParts(rng);
            for (const p of parts) batchPart(p, M(x, 0, z));
            batchDecal(x, z, radius);
          } else if (roll < 0.6) {
            const { parts, radius } = rockParts(rng, true);
            for (const p of parts) batchPart(p, M(x, 0, z));
            batchDecal(x, z, radius);
          }
          return;
        }
        const nearCairnwatch = c >= 15 && r <= 7;
        if (nearCairnwatch) {
          if (roll < 0.4) {
            const { parts } = tuftParts(rng);
            for (const p of parts) batchPart(p, M(x, 0, z));
          } else if (roll < 0.65) {
            const { parts } = flowerParts(rng);
            for (const p of parts) batchPart(p, M(x, 0, z));
          }
          return;
        }
        if (!inGrid) {
          if (roll < 0.7) {
            const { parts, radius } = treeParts(rng);
            for (const p of parts) batchPart(p, M(x, 0, z));
            batchDecal(x, z, radius);
          } else if (roll < 0.8) {
            const { parts, radius } = mushroomParts(rng, true);
            for (const p of parts) batchPart(p, M(x, 0, z));
            batchDecal(x, z, radius);
          }
          return;
        }
        // Exposed mountain border: far fewer trees/mushrooms/flowers than
        // the lowland levels, rocks dominant, plus the cairn markers this
        // level introduces.
        const hidesTower = GameState.isBuildable(c, r - 1) || GameState.isBuildable(c - 1, r - 1);
        if (roll < 0.10 && !hidesTower) {
          const { parts, radius } = treeParts(rng);
          if (swayTrees.length < 8) {
            const gp = liveProp(parts, x, 0, z);
            gp.userData.phase = rng() * 6.28;
            swayTrees.push(gp);
            decal(x, z, radius);
          } else {
            for (const p of parts) batchPart(p, M(x, 0, z));
            batchDecal(x, z, radius);
          }
        } else if (roll < 0.14) {
          const { parts, radius } = mushroomParts(rng, rng() < 0.35);
          for (const p of parts) batchPart(p, M(x, 0, z));
          batchDecal(x, z, radius);
        } else if (roll < 0.30) {
          const { parts } = tuftParts(rng);
          for (const p of parts) batchPart(p, M(x, 0, z));
        } else if (roll < 0.40) {
          const { parts } = flowerParts(rng);
          for (const p of parts) batchPart(p, M(x, 0, z));
        } else if (roll < 0.62) {
          const { parts, radius } = rockParts(rng, false);
          for (const p of parts) batchPart(p, M(x, 0, z));
          batchDecal(x, z, radius);
        } else if (roll < 0.68) {
          const { parts, radius } = acornParts(rng);
          for (const p of parts) batchPart(p, M(x, 0, z));
          batchDecal(x, z, radius);
        } else if (roll < 0.80) {
          const { parts, radius } = cairnParts(rng);
          for (const p of parts) batchPart(p, M(x, 0, z));
          batchDecal(x, z, radius);
        }
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

      const rngB = srand(7);
      const butterflies = [];
      const homes = [[4, 8], [10, 10], [14, 9]];
      const colors = [PALETTE.flowerPink, PALETTE.flowerYellow, PALETTE.magic];
      homes.forEach(([c, r], i) => {
        const gp = new THREE.Group();
        const wingGeo = new THREE.PlaneGeometry(0.13, 0.18);
        const mat = unlit(colors[i], { side: THREE.DoubleSide });
        const l = new THREE.Mesh(wingGeo, mat), rr = new THREE.Mesh(wingGeo, mat);
        l.position.x = -0.065; rr.position.x = 0.065;
        const lp = new THREE.Group(), rp = new THREE.Group();
        lp.add(l); rp.add(rr); gp.add(lp, rp);
        gp.rotation.x = -Math.PI / 2;
        gp.userData = { home: [worldX(c), worldZ(r)], phase: rngB() * 6.28, lp, rp };
        scene.add(gp);
        butterflies.push(gp);
      });
      animated.push({
        update(t) {
          for (const b of butterflies) {
            const u = b.userData, p = u.phase;
            b.position.set(u.home[0] + Math.sin(t * 0.5 + p) * 1.3, 0.7 + Math.sin(t * 2.3 + p) * 0.15, u.home[1] + Math.sin(t * 0.35 + p * 2) * 1.0);
            const flap = Math.sin(t * 16 + p) * 0.9;
            u.lp.rotation.y = flap; u.rp.rotation.y = -flap;
            b.rotation.z = Math.cos(t * 0.5 + p) * 0.9;
          }
        },
      });
    }

    buildFissure();
    buildRavineStair();
    buildOutpost();
    buildCairnwatch();
    buildCountryside();
  }

  return {
    id: 'cairnwatch',
    index: 3,
    name: 'The Cairnwatch',
    subtitle: 'A border half lost. Hold the Cairnwatch Tower.',
    grid: { cols: 20, rows: 12 },
    spawn: [0, 5],
    pathWaypoints: [[0, 5], [3, 5], [3, 2], [7, 2], [7, 9], [12, 9], [12, 3], [16, 3], [16, 6], [17, 6]],
    chokepoint: { cell: [9, 9], streamCol: 9 },
    endpoint: {
      name: 'the Cairnwatch', properName: 'The Cairnwatch',
      cells: [[17, 3], [18, 3], [17, 4], [18, 4], [17, 5], [18, 5]], gateCell: [17, 5],
    },
    cobbleTailCells: 3,
    theme: {
      center: [7, 5], radiusOut: { x: 9, z: 6.2 }, radiusIn: 1.6, falloffWidth: 0.7,
      backdrop: 0x384345, groundMeadow: 0x7a9a72, groundMeadowDark: 0x62825c, ambient: 0.34,
      motes: { dust: 26, fireflies: 10, spores: 36 },
    },
    spawnBlockedText: 'This ground has already been fought over once.',
    waves, prepSeconds: 14, startGold: 150, startLives: 20, starThresholds: [16, 8],
    tipTile: [2, 6],
    endScreenText: {
      3: () => 'Twelve waves turned back and the old scars are the only ones left. The Cairnwatch stands.',
      2: (s) => `Twelve waves turned back with ${s.lives} lives to spare. The border holds, barely.`,
      1: (s) => `Twelve waves turned back with ${s.lives} lives left. The Cairnwatch holds, just.`,
      lose: (s) => `The goblins broke the stair on wave ${s.wave}. Plant towers where the road bends, and remember only Druids and Artillery reach flyers.`,
    },
    buildScene,
  };
})();
