// ===================================================================
// LEVEL 2 — The Millbrook Watch
// The first ground reclaimed from the Hollow: a border mill the
// gnome-engineers are turning into a watch-post. Same mechanics as
// Level 1, a new map and a lighter touch of corruption.
// ===================================================================
const LEVEL_2 = (() => {
  const g = (type, count, gap, delay = 0) => ({ type, count, gap, delay });

  const waves = [
    { name: 'First Watch',      flavor: 'A handful of grunts, testing the new line.',                     groups: [g('grunt', 5, 3.6)] },
    { name: 'More Watchers',    flavor: 'More grunts, closer together now.',                                groups: [g('grunt', 8, 1.4)] },
    { name: 'Quick and Flimsy', flavor: 'Bog-Tricksters: fast, flimsy, and annoying. Slingers love them.', groups: [g('grunt', 5, 1.2), g('trickster', 7, 0.65, 2)] },
    { name: 'Heavy Water',      flavor: 'A Moss Troll wades the sluice. Hit it hard.',                     groups: [g('grunt', 8, 1.0), g('troll', 1, 1, 3)] },
    { name: 'Overhead',         flavor: 'Bramble Bats take wing over the millrace. Druids and Artillery only.', groups: [g('bat', 5, 1.2), g('grunt', 8, 0.9, 2)] },
    { name: 'Press the Sluice', flavor: 'Grunts and Tricksters together, pressing the gate.',              groups: [g('grunt', 10, 0.8), g('trickster', 8, 0.6, 2)] },
    { name: 'The Second Troll', flavor: 'A small column of Trolls. Rooting wins this one.',                groups: [g('troll', 2, 2.5), g('grunt', 8, 0.7, 3)] },
    { name: 'Wings and Mud',    flavor: 'Bats overhead, Tricksters underfoot.',                             groups: [g('bat', 7, 0.7), g('trickster', 10, 0.5, 2)] },
    { name: 'All Hands',        flavor: 'Everything at once. The wheel groans under the strain.',           groups: [g('troll', 3, 2.2), g('grunt', 12, 0.6, 2), g('bat', 6, 0.8, 5)] },
    { name: 'Break the Gate',   flavor: 'A Troll column and a Bat swarm, together. Hold the sluice.',       groups: [g('troll', 4, 2.2, 0), g('bat', 8, 0.6, 0), g('trickster', 10, 0.45, 1)] },
  ];

  // -------- this level's scene (Sluice Gate chokepoint, Watch-Mill endpoint) --------
  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, decal, toon, unlit,
      addOutline, srand, lerpColor, scene, animated, shakeCamera, puff,
      treeParts, deadTreeParts, rockParts, mushroomParts, tuftParts, flowerParts, acornParts,
      worldX, worldZ, cols, rows, border, level } = kit;

    function buildStream() {
      const x = worldX(level.chokepoint.streamCol);
      const length = rows + border * 2;
      const water = new THREE.Mesh(new THREE.PlaneGeometry(0.98, length), unlit(PALETTE.water));
      water.rotation.x = -Math.PI / 2;
      water.position.set(x, -0.12, 0);
      scene.add(water);
      const waterColor = new THREE.Color(PALETTE.water), deep = new THREE.Color(PALETTE.waterDeep);
      const streaks = [];
      const rng = srand(221);
      for (let i = 0; i < 14; i++) {
        const s = new THREE.Mesh(GEO.box, unlit(PALETTE.waterFoam, { opacity: 0.55, depthWrite: false }));
        s.scale.set(0.05 + rng() * 0.04, 0.01, 0.25 + rng() * 0.3);
        s.position.set(x + (rng() - 0.5) * 0.7, -0.11, -length / 2 + rng() * length);
        s.userData.speed = 0.5 + rng() * 0.5;
        scene.add(s);
        streaks.push(s);
      }
      for (let i = 0; i < 16; i++) {
        const side = rng() < 0.5 ? -1 : 1;
        const z = -length / 2 + 0.3 + rng() * (length - 0.6);
        if (Math.abs(z - worldZ(level.chokepoint.cell[1])) < 0.9) continue;
        const s = 0.06 + rng() * 0.07;
        batchPart(P(GEO.rock, PALETTE.stone, M(x + side * (0.5 + s * 0.6), -0.02, z, { sx: s * 1.4, sy: s, sz: s, ry: rng() * 3 }), false));
      }
      animated.push({
        update(t, dt) {
          water.material.color.copy(waterColor).lerp(deep, 0.5 + Math.sin(t * 1.3) * 0.5);
          for (const s of streaks) {
            s.position.z += s.userData.speed * dt;
            if (s.position.z > length / 2) s.position.z -= length;
          }
        },
      });
    }

    // The Sluice Gate: a stone millrace lock narrowed to a plank-and-iron
    // causeway. Same structural technique as a rope bridge, reskinned in
    // cut stone and iron bracing instead of wood and rope.
    function buildSluice() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const rng = srand(233);
      const wm = M(x, 0, z);
      // stone lock walls either side of the narrowed channel
      batchPart(P(GEO.box, PALETTE.stoneDark, M(0, 0.1, -0.5, { sx: 1.3, sy: 0.22, sz: 0.14 })), wm);
      batchPart(P(GEO.box, PALETTE.stoneDark, M(0, 0.1, 0.5, { sx: 1.3, sy: 0.22, sz: 0.14 })), wm);
      // stone causeway slabs laid across the walking direction
      for (let i = 0; i < 6; i++) {
        const px = -0.5 + i * 0.2;
        batchPart(P(GEO.box, i % 2 ? PALETTE.stone : PALETTE.cobble,
          M(px, 0.03 + (rng() - 0.5) * 0.01, (rng() - 0.5) * 0.03, { sx: 0.19, sy: 0.06, sz: 0.92, ry: (rng() - 0.5) * 0.05 })), wm);
      }
      // iron-braced railings: dark, angular, distinct from the bridge's wood-and-rope
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const px = -0.55 + i * (1.1 / 3);
          batchPart(P(GEO.box, PALETTE.stoneDark, M(px, 0.24, side * 0.47, { sx: 0.045, sy: 0.4, sz: 0.045 })), wm);
        }
        batchPart(P(GEO.box, PALETTE.stoneDark, M(0, 0.42, side * 0.47, { sx: 1.15, sy: 0.035, sz: 0.05 })), wm);
      }
      // stone footings on each bank
      for (const side of [-1, 1]) {
        batchPart(P(GEO.box, PALETTE.stoneDark, M(side * 0.62, -0.05, 0, { sx: 0.16, sy: 0.14, sz: 1.0 })), wm);
      }
      // the sluice gate itself: a raised iron grate at the upstream end
      batchPart(P(GEO.box, PALETTE.stoneDark, M(-0.68, 0.32, 0, { sx: 0.09, sy: 0.56, sz: 1.12 })), wm);
      for (let i = -2; i <= 2; i++) {
        batchPart(P(GEO.box, PALETTE.stoneDark, M(-0.68, 0.32, i * 0.2, { sx: 0.11, sy: 0.5, sz: 0.03 }), false), wm);
      }
    }

    // Spawn dressing: reclaimed ground, so lighter than the Hollow's cracked
    // stump — trampled grass and a few corruption-touched stones at the
    // treeline, not a glowing wound in the earth.
    function buildOutpost() {
      const [sc, sr] = level.spawn;
      const x = worldX(sc), z = worldZ(sr);
      const rng = srand(717);
      batchPart(P(GEO.circle, PALETTE.earth, M(x, 0.006, z, { s: 0.9 }), false));
      for (let i = 0; i < 5; i++) {
        const a = rng() * Math.PI * 2, d = 0.5 + rng() * 0.6;
        const cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d;
        const s = 0.09 + rng() * 0.08;
        batchPart(P(GEO.rock, PALETTE.hollowRock, M(cx, 0.02, cz, { sx: s * 1.3, sy: s, sz: s, ry: rng() * 3 })));
      }
      for (let i = 0; i < 2; i++) {
        const a = 2.0 + i * 2.4, d = 0.9;
        const { parts } = deadTreeParts(rng);
        for (const p of parts) batchPart(p, M(x + Math.cos(a) * d, 0, z + Math.sin(a) * d));
      }
      const cracks = [];
      for (let i = 0; i < 6; i++) {
        const a = rng() * Math.PI * 2, d = 0.6 + rng() * 1.4, len = 0.25 + rng() * 0.35;
        const cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d;
        const crack = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: PALETTE.magicGlow, transparent: true, opacity: 0.5, depthWrite: false }));
        crack.scale.set(len, 0.01, 0.06);
        crack.position.set(cx, 0.006, cz);
        crack.rotation.y = rng() * Math.PI;
        crack.userData.phase = rng() * 6.28;
        scene.add(crack);
        cracks.push(crack);
      }
      animated.push({
        update(t) {
          for (const c of cracks) c.material.opacity = 0.28 + 0.24 * (0.5 + 0.5 * Math.sin(t * 1.6 + c.userData.phase));
        },
      });
    }

    // The Watch-Mill: built with the Bastion's proven batched-props +
    // damage-overlay technique, traded down from martial (fewer
    // crenellations) toward civilian mill-house massing, plus a
    // continuously turning mill wheel — the one new animation idea here.
    function buildWatchMill() {
      const cells = level.endpoint.cells;
      const cx = worldX((cells[0][0] + cells[cells.length - 1][0]) / 2);
      const cz = worldZ((cells[0][1] + cells[cells.length - 1][1]) / 2);
      const wm = M(cx, 0, cz);
      const stone = PALETTE.stone, dark = PALETTE.stoneDark;
      const H = 1.6;
      // main mill house body, a moss line at the top, dark footing
      batchPart(P(GEO.box, stone, M(0, H / 2, -0.1, { sx: 1.8, sy: H, sz: 2.3 })), wm);
      batchPart(P(GEO.box, dark, M(0, 0.12, -0.1, { sx: 1.88, sy: 0.24, sz: 2.38 })), wm);
      batchPart(P(GEO.dome, PALETTE.capBrown, M(0, H + 0.02, -0.1, { sx: 1.35, sy: 0.7, sz: 1.62 })), wm);
      batchPart(P(GEO.box, PALETTE.moss, M(0.5, 0.4, 1.06, { sx: 0.4, sy: 0.5, sz: 0.04 }), false), wm);
      batchPart(P(GEO.box, PALETTE.moss, M(-0.9, 0.5, -0.4, { sx: 0.04, sy: 0.6, sz: 0.5 }), false), wm);
      // the grain tower behind, taller, with a conical cap
      const KT = 2.5, kx = -0.4, kz = -0.75;
      batchPart(P(GEO.cyl, stone, M(kx, KT / 2, kz, { sx: 0.46, sy: KT, sz: 0.46 })), wm);
      batchPart(P(GEO.cyl, dark, M(kx, KT, kz, { sx: 0.53, sy: 0.1, sz: 0.53 })), wm);
      batchPart(P(GEO.cone, PALETTE.capRed, M(kx, KT + 0.35, kz, { sx: 0.62, sy: 0.7, sz: 0.62 })), wm);
      // the mill wheel, mounted on the east flank, turning continuously
      const wheelX = cx + 1.05, wheelY = 0.62, wheelZ = cz + 0.2;
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(wheelX, wheelY, wheelZ);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 6, 14), toon(PALETTE.wood));
      wheelGroup.add(rim);
      addOutline(rim);
      const hub = new THREE.Mesh(GEO.cyl, toon(PALETTE.stoneDark));
      hub.scale.set(0.09, 0.14, 0.09);
      hub.rotation.z = Math.PI / 2;
      wheelGroup.add(hub);
      const paddles = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const paddle = new THREE.Mesh(GEO.box, toon(PALETTE.woodLight));
        paddle.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0);
        paddle.rotation.z = a;
        paddle.scale.set(0.16, 0.05, 0.22);
        paddles.add(paddle);
      }
      wheelGroup.add(paddles);
      wheelGroup.rotation.y = Math.PI / 2;
      scene.add(wheelGroup);
      // a small decorative millrace channel feeding the wheel (visual only)
      const race = new THREE.Mesh(GEO.box, unlit(PALETTE.water, { opacity: 0.85 }));
      race.position.set(wheelX, -0.08, wheelZ);
      race.scale.set(0.3, 0.02, 1.1);
      scene.add(race);
      // the gate on the road side (south face), an arch with a wooden door
      const gx = -0.3, gz = 1.06;
      batchPart(P(GEO.box, 0x2b211b, M(gx, 0.38, gz, { sx: 0.62, sy: 0.76, sz: 0.08 }), false), wm);
      batchPart(P(GEO.cyl, 0x2b211b, M(gx, 0.76, gz, { sx: 0.31, sy: 0.08, sz: 0.31, rx: Math.PI / 2 }), false), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(gx, 0.34, gz + 0.02, { sx: 0.5, sy: 0.68, sz: 0.05 }), false), wm);
      batchPart(P(GEO.cyl, PALETTE.wood, M(gx, 0.68, gz + 0.02, { sx: 0.25, sy: 0.05, sz: 0.25, rx: Math.PI / 2 }), false), wm);
      batchPart(P(GEO.box, dark, M(gx, 0.05, gz + 0.2, { sx: 0.85, sy: 0.1, sz: 0.26 })), wm);
      batchPart(P(GEO.box, PALETTE.cobble, M(gx, 0.02, gz + 0.4, { sx: 0.75, sy: 0.04, sz: 0.18 }), false), wm);
      // lanterns flanking the gate
      const lanterns = [];
      for (const lx of [gx - 0.5, gx + 0.5]) {
        batchPart(P(GEO.cyl, PALETTE.wood, M(lx, 0.28, gz + 0.28, { sx: 0.035, sy: 0.56, sz: 0.035 })), wm);
        batchPart(P(GEO.box, dark, M(lx, 0.6, gz + 0.28, { sx: 0.12, sy: 0.16, sz: 0.12 })), wm);
        const l = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.windowWarm }));
        l.position.set(cx + lx, 0.6, cz + gz + 0.28);
        l.scale.setScalar(0.05);
        l.userData.phase = lx * 7;
        scene.add(l);
        lanterns.push(l);
      }
      // warm lit windows
      const windows = [];
      const winSpots = [
        [-0.55, 1.05, 1.06, 'z'], [0.35, 0.7, 1.06, 'z'], [0.35, 1.15, 1.06, 'z'],
        [-0.86, 0.85, 0.1, 'x'], [kx, 1.8, kz + 0.42, 'z'],
      ];
      for (const [wx, wy, wz, axis] of winSpots) {
        const w = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: PALETTE.windowWarm }));
        w.position.set(cx + wx, wy, cz + wz);
        if (axis === 'z') w.scale.set(0.16, 0.22, 0.05); else w.scale.set(0.05, 0.22, 0.16);
        w.userData.phase = wx * 3 + wz * 5;
        scene.add(w);
        windows.push(w);
      }
      // a small pennant on the grain tower
      const pole = new THREE.Mesh(GEO.cyl, toon(PALETTE.wood));
      pole.position.set(cx + kx, KT + 0.7, cz + kz);
      pole.scale.set(0.03, 0.9, 0.03);
      scene.add(pole);
      const bannerGeo = new THREE.PlaneGeometry(0.6, 0.36, 6, 3);
      const bp = bannerGeo.attributes.position, bcols = new Float32Array(bp.count * 3);
      const gold = new THREE.Color(PALETTE.gold), teal = new THREE.Color(PALETTE.trickster);
      for (let i = 0; i < bp.count; i++) {
        const col = Math.abs(bp.getY(i)) < 0.06 ? teal : gold;
        bcols[i * 3] = col.r; bcols[i * 3 + 1] = col.g; bcols[i * 3 + 2] = col.b;
      }
      bannerGeo.setAttribute('color', new THREE.BufferAttribute(bcols, 3));
      const banner = new THREE.Mesh(bannerGeo, toon(0xffffff, { vc: true, side: THREE.DoubleSide }));
      banner.position.set(cx + kx + 0.32, KT + 0.9, cz + kz);
      scene.add(banner);
      // damage overlay: cracks appear when hurt, rubble and fire when nearly lost
      const dmg = { cracks: new THREE.Group(), rubble: new THREE.Group(), smokeTimer: 0, state: 0 };
      const crackSpots = [[-0.4, 0.45, 1.06, 0.22, 0.6], [0.5, 0.9, 1.06, 0.16, 0.45], [-0.87, 0.8, 0.4, 0.18, 0.5]];
      crackSpots.forEach(([wx, wy, wz, ww, wh], i) => {
        const c = new THREE.Mesh(GEO.box, unlit(0x2b211b));
        c.position.set(cx + wx, wy, cz + wz);
        c.scale.set(wz > 1 ? ww : 0.05, wh, wz > 1 ? 0.05 : ww);
        c.rotation.z = (i % 2 ? 0.5 : -0.4);
        dmg.cracks.add(c);
      });
      for (let i = 0; i < 5; i++) {
        const r = new THREE.Mesh(GEO.rock, toon(PALETTE.stoneDark));
        const a = i * 1.2, d = 0.95 + (i % 2) * 0.2;
        r.position.set(cx + (i < 3 ? -0.9 - (i % 2) * 0.15 : Math.cos(a) * 0.5), 0.08, cz + (i < 3 ? -0.5 + i * 0.4 : 1.1 + (i % 2) * 0.15));
        r.scale.set(0.18, 0.12, 0.15); r.rotation.y = a;
        addOutline(r);
        dmg.rubble.add(r);
      }
      dmg.fire = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.9 }));
      dmg.fire.position.set(cx - 0.4, 1.1, cz + 0.95); dmg.fire.scale.set(0.28, 0.38, 0.18);
      dmg.scorch = new THREE.Mesh(GEO.circle, unlit(0x2b211b, { opacity: 0.85, depthWrite: false }));
      dmg.scorch.position.set(cx - 0.2, H + 0.72, cz + 0.3); dmg.scorch.scale.setScalar(0.5);
      dmg.cracks.visible = false; dmg.rubble.visible = false; dmg.fire.visible = false; dmg.scorch.visible = false;
      scene.add(dmg.cracks, dmg.rubble, dmg.fire, dmg.scorch);
      GameState.on('endpointStateChanged', (st) => {
        dmg.state = st;
        dmg.cracks.visible = st >= 1;
        dmg.rubble.visible = st >= 2;
        dmg.fire.visible = st >= 2;
        dmg.scorch.visible = st >= 2;
        shakeCamera(0.12, 0.4);
        puff(cx - 0.5, 0.5, cz + 1.1, { count: 16, color: PALETTE.stone, speed: 2, size: 0.12, up: 1.6, ttl: 0.8 });
      });
      const base = bp.array.slice();
      let wheelSpin = 0;
      animated.push({
        update(t, dt) {
          wheelSpin += dt * (dmg.state === 2 ? 0.25 : 1.1);
          rim.rotation.z = wheelSpin;
          paddles.rotation.z = wheelSpin;
          const droop = dmg.state === 2 ? 0.35 : dmg.state === 1 ? 0.7 : 1;
          banner.rotation.z = dmg.state === 2 ? -0.6 : 0;
          for (let i = 0; i < bp.count; i++) {
            const x = base[i * 3], u = (x + 0.3) / 0.6;
            bp.setZ(i, Math.sin(t * 5.5 - u * 4.5) * 0.08 * u * droop);
            bp.setY(i, base[i * 3 + 1] + Math.sin(t * 2.2 - u * 2) * 0.025 * u * droop);
          }
          if (dmg.state >= 1) {
            dmg.smokeTimer -= dt;
            if (dmg.smokeTimer <= 0) {
              dmg.smokeTimer = dmg.state === 2 ? 0.07 : 0.4;
              const heavy = dmg.state === 2;
              puff(cx - 0.2 + Math.random() * 0.5 - 0.25, H + 0.7, cz + 0.3, { count: 1, color: heavy ? 0x3a322c : 0x8c847a, speed: 0.15, size: heavy ? 0.26 : 0.16, up: heavy ? 1.3 : 0.9, ttl: heavy ? 2.2 : 1.6 });
              if (heavy && Math.random() < 0.35) puff(cx - 0.4, 1.1, cz + 0.95, { count: 1, color: 0xffb347, speed: 0.4, size: 0.05, up: 1.8, ttl: 0.7 });
            }
            if (dmg.state === 2) {
              const f = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 7.3);
              dmg.fire.scale.set(0.28 * f, 0.38 * (2 - f), 0.18 * f);
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
            l.scale.setScalar(0.05 + 0.008 * f);
          }
        },
      });
    }

    function buildCountryside() {
      const rng = srand(3031);
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
        const nearWatchMill = c >= 14 && r >= 3;
        if (nearWatchMill) {
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
        const hidesTower = GameState.isBuildable(c, r - 1) || GameState.isBuildable(c - 1, r - 1);
        if (roll < 0.22 && !hidesTower) {
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
        } else if (roll < 0.36) {
          const { parts, radius } = mushroomParts(rng, rng() < 0.35);
          for (const p of parts) batchPart(p, M(x, 0, z));
          batchDecal(x, z, radius);
        } else if (roll < 0.5) {
          const { parts } = tuftParts(rng);
          for (const p of parts) batchPart(p, M(x, 0, z));
        } else if (roll < 0.62) {
          const { parts } = flowerParts(rng);
          for (const p of parts) batchPart(p, M(x, 0, z));
        } else if (roll < 0.72) {
          const { parts, radius } = rockParts(rng, false);
          for (const p of parts) batchPart(p, M(x, 0, z));
          batchDecal(x, z, radius);
        } else if (roll < 0.8) {
          const { parts, radius } = acornParts(rng);
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

      const rngB = srand(6);
      const butterflies = [];
      const homes = [[6, 2], [12, 6], [8, 9]];
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

    buildStream();
    buildSluice();
    buildOutpost();
    buildWatchMill();
    buildCountryside();
  }

  return {
    id: 'millbrook-watch',
    index: 2,
    name: 'The Millbrook Watch',
    subtitle: 'The first ground reclaimed. Hold the Watch-Mill.',
    grid: { cols: 18, rows: 11 },
    spawn: [0, 3],
    pathWaypoints: [[0, 3], [4, 3], [4, 8], [11, 8], [11, 4], [15, 4], [15, 8], [16, 8]],
    chokepoint: { cell: [9, 8], streamCol: 9 },
    endpoint: {
      name: 'the Watch-Mill', properName: 'The Watch-Mill',
      cells: [[16, 5], [17, 5], [16, 6], [17, 6], [16, 7], [17, 7]], gateCell: [16, 7],
    },
    cobbleTailCells: 3,
    theme: { center: [0.5, 3.5], radiusOut: { x: 5.5, z: 4.2 }, radiusIn: 1.3, falloffWidth: 0.5 },
    spawnBlockedText: 'Nothing but trampled grass grows here.',
    waves, prepSeconds: 14, startGold: 150, startLives: 20, starThresholds: [16, 8],
    tipTile: [2, 4],
    endScreenText: {
      3: () => 'Ten waves turned back and the wheel never stopped turning. The Watch-Mill stands.',
      2: (s) => `Ten waves turned back with ${s.lives} lives to spare. The millwrights have work to do.`,
      1: (s) => `Ten waves turned back with ${s.lives} lives left. The Watch-Mill holds, just.`,
      lose: (s) => `The goblins broke the sluice on wave ${s.wave}. Plant towers where the road bends, and remember only Druids and Artillery reach flyers.`,
    },
    buildScene,
  };
})();
