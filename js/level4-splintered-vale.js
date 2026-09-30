// ===================================================================
// LEVEL 4 — The Splintered Vale
// Three battles won, the forward army pushes toward the Heart, and the
// Hollow's roots splinter three ways to hit the camp from every side.
// The campaign's first multi-road battle: a Shortcut and a Long Way from
// the north-west and a South Road, all converging on one contested trunk
// that crosses the Fallen Oak to the Forward Camp.
// ===================================================================
const LEVEL_4 = (() => {
  // route/at are optional: which road the group takes, and an absolute start
  // time for groups that come at once (see GameState.startWave)
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: 'Scouts on the Shortcut', flavor: 'Grunts feel out the nearest road. Only one road so far.',          groups: [g('grunt', 5, 3.2, 0, 'shortcut')] },
    { name: 'A Second Road',       flavor: 'Watch the South Road too. The horn shows where they come from.',     groups: [g('grunt', 5, 2.0, 0, 'shortcut', 0), g('grunt', 3, 2.4, 0, 'south', 4)] },
    { name: 'Quick Feet South',    flavor: 'Bog-Tricksters rush the South Road.',                               groups: [g('grunt', 5, 1.4, 0, 'shortcut', 0), g('trickster', 6, 0.8, 0, 'south', 3)] },
    { name: 'The Long Way Round',  flavor: 'A Moss Troll takes the long road north. It has time to spare.',     groups: [g('grunt', 6, 1.2, 0, 'shortcut', 0), g('troll', 1, 1, 0, 'long', 2), g('grunt', 4, 1.4, 0, 'south', 6)] },
    { name: 'Wings over the South', flavor: 'Bramble Bats follow the South Road. Druids and Artillery only.',  groups: [g('bat', 5, 1.2, 0, 'south', 0), g('grunt', 7, 1.0, 0, 'shortcut', 3)] },
    { name: 'Three Fronts',        flavor: 'Every road at once. Find the spots that cover two.',                groups: [g('grunt', 5, 1.0, 0, 'shortcut', 0), g('grunt', 5, 1.0, 0, 'long', 0), g('grunt', 5, 1.0, 0, 'south', 0)] },
    { name: 'Stone and Speed',     flavor: 'Trolls on the long road, Tricksters on the short one.',             groups: [g('troll', 2, 2.6, 0, 'long', 0), g('trickster', 9, 0.6, 0, 'shortcut', 2)] },
    { name: 'Swarm Season',        flavor: 'Bats south, Tricksters north, grunts on the long road.',            groups: [g('bat', 7, 0.8, 0, 'south', 0), g('trickster', 10, 0.5, 0, 'shortcut', 2), g('grunt', 6, 0.9, 0, 'long', 4)] },
    { name: 'The Press',           flavor: 'The Hollow leans on every road in turn.',                           groups: [g('troll', 2, 2.4, 0, 'long', 0), g('grunt', 10, 0.7, 0, 'shortcut', 1), g('trickster', 8, 0.55, 0, 'south', 5), g('bat', 5, 0.9, 0, 'south', 9)] },
    { name: 'Pincer',              flavor: 'Trolls down both northern roads, bats over the south.',             groups: [g('troll', 2, 2.2, 0, 'long', 0), g('troll', 2, 2.2, 0, 'shortcut', 1), g('bat', 8, 0.7, 0, 'south', 3), g('grunt', 8, 0.7, 0, 'south', 8)] },
    { name: 'Every Road at Once',  flavor: 'The camp shakes. Hold the Fallen Oak.',                             groups: [g('grunt', 12, 0.6, 0, 'shortcut', 0), g('trickster', 12, 0.45, 0, 'south', 0), g('troll', 3, 2.0, 0, 'long', 0), g('bat', 6, 0.8, 0, 'long', 6)] },
    { name: 'The Vale Splinters',  flavor: 'A Troll column, a Trickster rush and a Bat swarm, all at the same moment.', groups: [g('troll', 4, 2.0, 0, 'long', 0), g('trickster', 14, 0.4, 0, 'shortcut', 0), g('bat', 9, 0.55, 0, 'south', 0)] },
    { name: 'The Leaf-Storm Breaks', flavor: 'The autumn wind is not wind at all. Only Druids and Artillery reach it.', groups: [g('bat', 3, 1.0, 0, 'south', 0), g('grunt', 4, 0.9, 0, 'shortcut', 1), g('leafstorm', 1, 1, 0, 'long', 8)] },
  ];

  // -------- this level's scene (Fallen Oak chokepoint, Forward Camp endpoint) --------
  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, decal, toon, unlit,
      addOutline, srand, scene, animated, shakeCamera, puff,
      treeParts, deadTreeParts, rockParts, mushroomParts, tuftParts, flowerParts, acornParts,
      glow, setGlow,
      worldX, worldZ, cols, rows, border, level } = kit;
    const tentGeo = new THREE.ConeGeometry(1, 1, 6).toNonIndexed();

    // A cold, quick stream down the east of the vale.
    function buildStream() {
      kit.water({ x: worldX(level.chokepoint.streamCol), length: rows + border * 2, speed: 1.35, stripe: 0.62 });
      const rng = srand(441);
      const x = worldX(level.chokepoint.streamCol), length = rows + border * 2;
      for (let i = 0; i < 16; i++) {
        const side = rng() < 0.5 ? -1 : 1;
        const z = -length / 2 + 0.3 + rng() * (length - 0.6);
        if (Math.abs(z - worldZ(level.chokepoint.cell[1])) < 1.0) continue;
        const s = 0.07 + rng() * 0.08;
        batchPart(P(GEO.rock, PALETTE.stone, M(x + side * (0.5 + s * 0.5), -0.02, z, { sx: s * 1.3, sy: s, sz: s, ry: rng() * 3 })));
      }
    }

    // The Fallen Oak: a colossal autumn oak that came down across the stream
    // and was hewn flat on top to carry the road. Its torn root plate stands
    // up on the north bank and its last russet leaves pile on the south.
    function buildFallenOak() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      const rng = srand(457);
      // the trunk: bark sides below a flat, adzed walkway
      batchPart(P(GEO.cyl, PALETTE.wood, M(0, -0.07, 0, { sx: 0.2, sy: 1.7, sz: 0.3, rz: Math.PI / 2 })), wm);
      batchPart(P(GEO.box, PALETTE.woodLight, M(0, 0.02, 0, { sx: 1.62, sy: 0.04, sz: 0.46 }), false), wm);
      for (let i = 0; i < 5; i++) batchPart(P(GEO.box, PALETTE.wood, M(-0.6 + i * 0.3, 0.043, (rng() - 0.5) * 0.3, { sx: 0.012, sy: 0.006, sz: 0.24 + rng() * 0.1 }), false), wm);
      // growth rings on the sawn west end
      batchPart(P(GEO.cyl, PALETTE.woodLight, M(-0.86, -0.07, 0, { sx: 0.19, sy: 0.03, sz: 0.28, rz: Math.PI / 2 }), false), wm);
      batchPart(P(GEO.ring, PALETTE.wood, M(-0.875, -0.07, 0, { sx: 0.12, sy: 0.18, sz: 0.12, ry: Math.PI / 2 }), false), wm);
      // broken branch stubs along both flanks
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
        const bx = -0.5 + i * 0.5 + (rng() - 0.5) * 0.15;
        batchPart(P(GEO.cylTaper, PALETTE.wood, M(bx, -0.04, side * 0.42, { sx: 0.05, sy: 0.3, sz: 0.05, rx: side * 1.45, rz: (rng() - 0.5) * 0.5 })), wm);
      }
      // the torn root plate, standing up on the north bank
      batchPart(P(GEO.cyl, PALETTE.earth, M(-0.55, 0.28, -0.95, { sx: 0.5, sy: 0.12, sz: 0.42, rx: Math.PI / 2 })), wm);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        batchPart(P(GEO.cone, PALETTE.wood, M(-0.55 + Math.cos(a) * 0.45, 0.28 + Math.sin(a) * 0.36, -0.9, { sx: 0.04, sy: 0.3, sz: 0.04, rz: a - Math.PI / 2 })), wm);
      }
      for (let i = 0; i < 4; i++) batchPart(P(GEO.rock, PALETTE.stoneDark, M(-0.55 + (rng() - 0.5) * 0.6, 0.12 + rng() * 0.3, -0.84, { s: 0.06 + rng() * 0.04 }), false), wm);
      // the crown's last leaves, heaped on the south bank downstream
      for (let i = 0; i < 6; i++) {
        const c = i % 3 === 0 ? PALETTE.autumnDark : PALETTE.autumn;
        batchPart(P(GEO.sphereLo, c, M(0.7 + (rng() - 0.5) * 0.6, 0.12 + rng() * 0.14, 0.85 + (rng() - 0.5) * 0.4, { s: 0.18 + rng() * 0.1 })), wm);
      }
      batchDecal(x + 0.7, z + 0.85, 0.55);
    }

    // Three blighted stumps, one at the head of every road, so each entry
    // reads as a place the Hollow breaks through, not just the primary one.
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
        // a faint crack of magic in the stump that pulses
        const crack = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: PALETTE.magicGlow, transparent: true, opacity: 0.7, depthWrite: false }));
        crack.scale.set(0.5, 0.01, 0.06); crack.position.set(x - 0.35, 0.45, z - 0.55); crack.rotation.y = 0.6 + n;
        scene.add(crack);
        animated.push({ update(t) { crack.material.opacity = 0.4 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.2 + n * 2)); } });
      });
    }

    // The Forward Camp: a sharpened-log palisade around a command tent, two
    // smaller tents, a stilted watch platform and gate braziers. Damage:
    // splintered stakes and smoke at state 1, a burning, sagging tent at 2.
    function buildCamp() {
      const cells = level.endpoint.cells;
      const cx = worldX((cells[0][0] + cells[cells.length - 1][0]) / 2);
      const cz = worldZ((cells[0][1] + cells[cells.length - 1][1]) / 2);
      const wm = M(cx, 0, cz);
      const rng = srand(463);
      const gx = worldX(level.endpoint.gateCell[0]) - cx;   // gate opening, on the south face
      batchPart(P(GEO.circle, PALETTE.path, M(0, 0.008, 0.1, { sx: 1.05, sz: 1.6 }), false), wm);
      // the palisade: sharpened stakes around the perimeter, open at the gate
      const stake = (px, pz, h) => {
        batchPart(P(GEO.cyl, PALETTE.wood, M(px, h / 2, pz, { sx: 0.07, sy: h, sz: 0.07, rz: (rng() - 0.5) * 0.08 })), wm);
        batchPart(P(GEO.cone, PALETTE.woodLight, M(px, h + 0.07, pz, { sx: 0.07, sy: 0.14, sz: 0.07 })), wm);
      };
      const W = 0.95, D = 1.45;
      for (let px = -W; px <= W + 0.01; px += 0.15) {
        if (Math.abs(px - gx) > 0.34) stake(px, D, 0.62 + rng() * 0.14);
        stake(px, -D, 0.62 + rng() * 0.14);
      }
      for (let pz = -D + 0.15; pz < D; pz += 0.15) { stake(-W, pz, 0.62 + rng() * 0.14); stake(W, pz, 0.62 + rng() * 0.14); }
      // a lashing rail around the stakes
      batchPart(P(GEO.box, PALETTE.earth, M(0, 0.42, D + 0.045, { sx: W * 2, sy: 0.035, sz: 0.02 }), false), wm);
      batchPart(P(GEO.box, PALETTE.earth, M(W + 0.045, 0.42, 0, { sx: 0.02, sy: 0.035, sz: D * 2 }), false), wm);
      // the gate: two tall posts and a crossbeam
      for (const s of [-1, 1]) batchPart(P(GEO.cyl, PALETTE.wood, M(gx + s * 0.34, 0.5, D, { sx: 0.09, sy: 1.0, sz: 0.09 })), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(gx, 0.98, D, { sx: 0.86, sy: 0.08, sz: 0.1 })), wm);
      // tents: canvas cones with a colored band, a dark door flap and a pole
      const tent = (tx, tz, r, h, band) => {
        batchPart(P(tentGeo, PALETTE.canvas, M(tx, h / 2, tz, { sx: r, sy: h, sz: r })), wm);
        batchPart(P(GEO.ring, band, M(tx, h * 0.28, tz, { s: r * 0.74, rx: Math.PI / 2 }), false), wm);
        batchPart(P(GEO.box, 0x2b211b, M(tx, h * 0.18, tz + r * 0.78, { sx: r * 0.34, sy: h * 0.34, sz: 0.02, rx: -0.5 }), false), wm);
        batchPart(P(GEO.cyl, PALETTE.wood, M(tx, h + 0.08, tz, { sx: 0.02, sy: 0.18, sz: 0.02 }), false), wm);
      };
      tent(-0.5, -0.9, 0.34, 0.62, PALETTE.tunic);
      tent(0.52, 0.72, 0.32, 0.58, PALETTE.capRed);
      // the command tent is live so it can sag when the camp is nearly lost
      const cmd = liveProp([
        P(tentGeo, PALETTE.canvas, M(0, 0.75, 0, { sx: 0.66, sy: 1.5, sz: 0.66 })),
        P(GEO.ring, PALETTE.gold, M(0, 0.36, 0, { s: 0.47, rx: Math.PI / 2 }), false),
        P(GEO.ring, PALETTE.capRed, M(0, 0.28, 0, { s: 0.52, rx: Math.PI / 2 }), false),
        P(GEO.box, 0x2b211b, M(0, 0.24, 0.49, { sx: 0.22, sy: 0.42, sz: 0.02, rx: -0.45 }), false),
        P(GEO.cyl, PALETTE.wood, M(0, 1.7, 0, { sx: 0.025, sy: 0.5, sz: 0.025 })),
        P(GEO.sphereLo, PALETTE.gold, M(0, 1.96, 0, { s: 0.05 })),
      ], cx + 0.3, 0, cz - 0.35);
      decal(cx + 0.3, cz - 0.35, 0.62);
      // the stilted watch platform with a lantern and a little roof
      const wx = -0.55, wz = 0.3;
      for (const [ox, oz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
        batchPart(P(GEO.cyl, PALETTE.wood, M(wx + ox, 0.85, wz + oz, { sx: 0.03, sy: 1.7, sz: 0.03 })), wm);
      }
      batchPart(P(GEO.box, PALETTE.woodLight, M(wx, 1.7, wz, { sx: 0.5, sy: 0.06, sz: 0.5 })), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(wx, 1.83, wz + 0.24, { sx: 0.5, sy: 0.04, sz: 0.02 }), false), wm);
      batchPart(P(GEO.cone, PALETTE.capBrown, M(wx, 2.23, wz, { sx: 0.4, sy: 0.3, sz: 0.4 })), wm);
      for (const [ox, oz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
        batchPart(P(GEO.cyl, PALETTE.wood, M(wx + ox, 1.93, wz + oz, { sx: 0.02, sy: 0.4, sz: 0.02 }), false), wm);
      }
      const lamp = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.windowWarm }));
      lamp.position.set(cx + wx, 1.9, cz + wz); lamp.scale.setScalar(0.06);
      scene.add(lamp);
      glow(cx + wx, 1.9, cz + wz, { w: 0.6, h: 0.6 });
      // crates and barrels of supplies
      for (const [bx, bz] of [[0.72, -0.2], [0.78, 0.05]]) {
        batchPart(P(GEO.cyl, PALETTE.wood, M(bx, 0.13, bz, { sx: 0.1, sy: 0.26, sz: 0.1 })), wm);
        batchPart(P(GEO.ring, PALETTE.stoneDark, M(bx, 0.2, bz, { s: 0.1, rx: Math.PI / 2 }), false), wm);
      }
      batchPart(P(GEO.box, PALETTE.woodLight, M(-0.62, 0.1, -0.35, { sx: 0.22, sy: 0.2, sz: 0.22, ry: 0.3 })), wm);
      batchPart(P(GEO.box, PALETTE.woodLight, M(-0.6, 0.29, -0.33, { sx: 0.16, sy: 0.16, sz: 0.16, ry: 0.8 })), wm);
      // gate braziers: stone bowls with live flames and warm halos
      const flames = [];
      for (const s of [-1, 1]) {
        const bx = gx + s * 0.58, bz = D + 0.28;
        batchPart(P(GEO.cylTaper, PALETTE.stoneDark, M(bx, 0.2, bz, { sx: 0.1, sy: 0.4, sz: 0.1, rx: Math.PI })), wm);
        batchPart(P(GEO.cyl, PALETTE.stone, M(bx, 0.42, bz, { sx: 0.14, sy: 0.06, sz: 0.14 })), wm);
        const f = new THREE.Mesh(GEO.cone, new THREE.MeshBasicMaterial({ color: 0xff9a3d, transparent: true, opacity: 0.92 }));
        f.position.set(cx + bx, 0.56, cz + bz); f.scale.set(0.09, 0.2, 0.09);
        f.userData.phase = s * 3;
        scene.add(f);
        flames.push(f);
        glow(cx + bx, 0.56, cz + bz, { w: 0.6, h: 0.6 });
      }
      // a banner over the command tent
      const bannerGeo = kit.bannerGeo(0.5, 0.3, { field: PALETTE.tunic, stripe: PALETTE.autumn });
      const bp = bannerGeo.attributes.position;
      const banner = new THREE.Mesh(bannerGeo, toon(0xffffff, { vc: true, side: THREE.DoubleSide }));
      banner.position.set(cx + 0.3 + 0.27, 1.78, cz - 0.35);
      scene.add(banner);
      // damage overlay
      const dmg = { broken: new THREE.Group(), debris: new THREE.Group(), smokeTimer: 0, state: 0 };
      for (let i = 0; i < 5; i++) {
        // splintered stakes lying where they fell
        const s = new THREE.Mesh(GEO.cyl, toon(PALETTE.wood));
        const px = -0.8 + i * 0.4;
        s.position.set(cx + px + 0.1, 0.05, cz + D + 0.25 + (i % 2) * 0.1);
        s.rotation.set(Math.PI / 2, 0, 0.4 + i);
        s.scale.set(0.06, 0.55, 0.06);
        addOutline(s);
        dmg.broken.add(s);
      }
      for (let i = 0; i < 6; i++) {
        const r = new THREE.Mesh(GEO.box, toon(i % 2 ? PALETTE.canvas : PALETTE.woodLight));
        r.position.set(cx + (rng() - 0.5) * 1.6, 0.04, cz + (rng() - 0.3) * 2.2);
        r.scale.set(0.16, 0.06, 0.12); r.rotation.y = rng() * 3;
        dmg.debris.add(r);
      }
      dmg.fire = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.9 }));
      dmg.fire.position.set(cx + 0.3, 0.8, cz - 0.1); dmg.fire.scale.set(0.28, 0.4, 0.2);
      dmg.broken.visible = false; dmg.debris.visible = false; dmg.fire.visible = false;
      scene.add(dmg.broken, dmg.debris, dmg.fire);
      GameState.on('endpointStateChanged', (st) => {
        dmg.state = st;
        dmg.broken.visible = st >= 1;
        dmg.debris.visible = st >= 2;
        dmg.fire.visible = st >= 2;
        setGlow(st >= 2 ? 0.35 : 1);
        shakeCamera(0.12, 0.4);
        puff(cx + gx, 0.5, cz + D, { count: 16, color: PALETTE.woodLight, speed: 2, size: 0.12, up: 1.6, ttl: 0.8 });
      });
      const base = bp.array.slice();
      animated.push({
        update(t, dt) {
          const droop = dmg.state === 2 ? 0.35 : dmg.state === 1 ? 0.7 : 1;
          for (let i = 0; i < bp.count; i++) {
            const x = base[i * 3], u = (x + 0.25) / 0.5;
            bp.setZ(i, Math.sin(t * 5.5 - u * 4.5) * 0.07 * u * droop);
            bp.setY(i, base[i * 3 + 1] + Math.sin(t * 2.2 - u * 2) * 0.022 * u * droop);
          }
          bp.needsUpdate = true;
          bannerGeo.computeVertexNormals();
          // the command tent breathes in the wind, and sags when nearly lost
          const sag = dmg.state === 2 ? 1 : 0;
          cmd.rotation.z = Math.sin(t * 1.3) * 0.015 + sag * 0.16;
          cmd.scale.y = 1 + Math.sin(t * 1.7) * 0.012 - sag * 0.1;
          banner.rotation.z = sag * -0.5;
          for (const f of flames) {
            const k = 0.85 + 0.15 * Math.sin(t * 13 + f.userData.phase) * Math.sin(t * 5.1 + f.userData.phase);
            f.scale.set(0.09 * (2 - k), 0.2 * k, 0.09 * (2 - k));
            f.material.opacity = (0.8 + 0.15 * Math.sin(t * 19 + f.userData.phase)) * (dmg.state === 2 ? 0.5 : 1);
          }
          lamp.material.color.setHex(PALETTE.windowWarm).multiplyScalar((0.85 + 0.15 * Math.sin(t * 7)) * (dmg.state === 2 ? 0.4 : 1));
          if (dmg.state >= 1) {
            dmg.smokeTimer -= dt;
            if (dmg.smokeTimer <= 0) {
              dmg.smokeTimer = dmg.state === 2 ? 0.07 : 0.4;
              const heavy = dmg.state === 2;
              puff(cx + 0.3 + Math.random() * 0.3 - 0.15, 1.6, cz - 0.35, { count: 1, color: heavy ? 0x3a322c : 0x8c847a, speed: 0.15, size: heavy ? 0.26 : 0.16, up: heavy ? 1.3 : 0.9, ttl: heavy ? 2.2 : 1.6 });
              if (heavy && Math.random() < 0.35) puff(cx + 0.3, 0.8, cz - 0.1, { count: 1, color: 0xffb347, speed: 0.4, size: 0.05, up: 1.8, ttl: 0.7 });
            }
            if (dmg.state === 2) {
              const f = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 7.3);
              dmg.fire.scale.set(0.28 * f, 0.4 * (2 - f), 0.2 * f);
              dmg.fire.material.opacity = 0.75 + 0.2 * Math.sin(t * 23);
            }
          }
        },
      });
    }

    // Autumn dressing unique to this level: russet trees, leaf piles and
    // fallen logs. Trees are the shared recipe re-leafed in autumn colors.
    const LEAF = { [PALETTE.meadowDark]: PALETTE.autumnDark, [PALETTE.meadow]: PALETTE.autumn, [PALETTE.meadowLight]: PALETTE.flowerYellow };
    function autumnTreeParts(rng) {
      const t = treeParts(rng);
      if (rng() < 0.75) t.parts = t.parts.map((p) => (LEAF[p.color] ? { ...p, color: LEAF[p.color] } : p));
      return t;
    }
    function leafPileParts(rng) {
      const parts = [];
      for (let i = 0; i < 3; i++) {
        parts.push(P(GEO.sphereLo, i === 1 ? PALETTE.autumnDark : PALETTE.autumn, M((rng() - 0.5) * 0.2, 0.04, (rng() - 0.5) * 0.2, { sx: 0.13, sy: 0.05, sz: 0.11 }), false));
      }
      return { parts, radius: 0 };
    }
    function logParts(rng) {
      const len = 0.5 + rng() * 0.3, ry = rng() * 3;
      return {
        parts: [
          P(GEO.cyl, PALETTE.wood, M(0, 0.07, 0, { sx: 0.07, sy: len, sz: 0.07, rz: Math.PI / 2, ry })),
          P(GEO.sphereLo, PALETTE.moss, M(0, 0.13, 0, { sx: len * 0.3, sy: 0.02, sz: 0.05, ry }), false),
        ], radius: len * 0.5,
      };
    }

    function buildCountryside() {
      const rng = srand(4141);
      const swayTrees = [];
      const endpointC = level.endpoint.cells.map(([c]) => c), endpointR = level.endpoint.cells.map(([, r]) => r);
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
          else if (roll < 0.55) put(rockParts(rng, true));
          else if (roll < 0.62) put(logParts(rng));
          return;
        }
        const nearCamp = c >= Math.min(...endpointC) - 1 && r >= Math.min(...endpointR) - 1 && r <= Math.max(...endpointR) + 1;
        if (nearCamp) {
          if (roll < 0.4) put(tuftParts(rng));
          else if (roll < 0.6) put(leafPileParts(rng));
          return;
        }
        if (!inGrid) {
          if (roll < 0.72) put(autumnTreeParts(rng));
          else if (roll < 0.8) put(mushroomParts(rng, true));
          else if (roll < 0.86) put(logParts(rng));
          return;
        }
        // an autumn vale: trees thinner than the home forest, leaf piles
        // and fallen logs everywhere between the roads
        const hidesTower = GameState.isBuildable(c, r - 1) || GameState.isBuildable(c - 1, r - 1);
        if (roll < 0.14 && !hidesTower) {
          const { parts, radius } = autumnTreeParts(rng);
          if (swayTrees.length < 8) {
            const gp = liveProp(parts, x, 0, z);
            gp.userData.phase = rng() * 6.28;
            swayTrees.push(gp);
            decal(x, z, radius);
          } else put({ parts, radius });
        } else if (roll < 0.19) put(mushroomParts(rng, rng() < 0.3));
        else if (roll < 0.36) put(tuftParts(rng));
        else if (roll < 0.52) put(leafPileParts(rng));
        else if (roll < 0.6) put(flowerParts(rng));
        else if (roll < 0.7) put(rockParts(rng, false));
        else if (roll < 0.78) put(logParts(rng));
        else if (roll < 0.84) put(acornParts(rng));
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

    buildStream();
    buildFallenOak();
    buildSpawns();
    buildCamp();
    buildCountryside();
  }

  const tail = [[15, 6], [15, 8], [17, 8]];
  return {
    id: 'splintered-vale',
    index: 4,
    name: 'The Splintered Vale',
    subtitle: 'The roots split three ways. Hold the Forward Camp.',
    // overworld node: position in the world map's 800x320 viewBox, and how
    // much blight a win here clears around it
    map: { x: 204, y: 196, reclaim: 100, icon: 'camp' },
    grid: { cols: 20, rows: 13 },
    spawn: [0, 3],
    // three roads that meet on the row-6 trunk, then cross the Fallen Oak
    routes: [
      { id: 'shortcut', waypoints: [[0, 3], [5, 3], [5, 6], ...tail] },
      { id: 'long', waypoints: [[0, 1], [11, 1], [11, 4], [9, 4], [9, 6], ...tail] },
      { id: 'south', waypoints: [[0, 10], [7, 10], [7, 6], ...tail] },
    ],
    chokepoint: { cell: [13, 6], streamCol: 13 },
    endpoint: {
      name: 'the Forward Camp', properName: 'The Forward Camp',
      cells: [[17, 5], [18, 5], [17, 6], [18, 6], [17, 7], [18, 7]], gateCell: [17, 7],
    },
    cobbleTailCells: 3,
    theme: {
      center: [2, 6], radiusOut: { x: 10, z: 8 }, radiusIn: 1.5, falloffWidth: 0.6,
      backdrop: 0x3a3530, groundMeadow: 0x9a9a4e, groundMeadowDark: 0x807f3f, ambient: 0.36,
      sun: 0.56, fill: 0xa8bcd8, fillIntensity: 0.16,
      motes: { leaves: 42, spores: 24, fireflies: 6 },
    },
    spawnBlockedText: 'The Hollow breaks through here. Nothing will stand on it.',
    waves, prepSeconds: 14, startGold: 170, startLives: 20, starThresholds: [16, 8],
    tipTile: [3, 2],
    endScreenText: {
      3: () => 'Three roads, twelve waves, and not a stake of the palisade lost. The Forward Camp stands.',
      2: (s) => `Twelve waves turned back on three roads with ${s.lives} lives to spare. The camp holds.`,
      1: (s) => `Twelve waves turned back with ${s.lives} lives left. The camp holds, just.`,
      lose: (s) => `The camp fell on wave ${s.wave}. Watch the horn markers for the next road, build where two roads pass, and remember only Druids and Artillery reach flyers.`,
    },
    buildScene,
  };
})();
