// ===================================================================
// LEVEL 1 — The Shadow Hollow
// Holding the Bastion at home, the first night the corruption reaches
// the valley. This is the level the original single-map game shipped
// with; its data and scene-building code just moved into its own file.
// ===================================================================
const LEVEL_1 = (() => {
  const g = (type, count, gap, delay = 0) => ({ type, count, gap, delay });

  // The twelve waves. Each group spawns after `delay` seconds, one enemy
  // every `gap` seconds. Flavor lines teach the new threat in-world.
  const waves = [
    { name: 'Scouts',           flavor: 'A few grunts, bumbling down the road.',                          groups: [g('grunt', 5, 3.4)] },
    { name: 'The Rabble',       flavor: 'More grunts. They travel in bunches.',                            groups: [g('grunt', 8, 1.4)] },
    { name: 'Tricksters',       flavor: 'Bog-Tricksters: fast, flimsy, and annoying. Slingers love them.', groups: [g('grunt', 5, 1.2), g('trickster', 7, 0.65, 2)] },
    { name: 'The Big One',      flavor: 'A Moss Troll. Thick hide shrugs off small hits. Hit it hard.',   groups: [g('grunt', 8, 1.0), g('troll', 1, 1, 3)] },
    { name: 'Wings',            flavor: 'Bramble Bats take wing. Only Druids and Artillery can reach them.', groups: [g('bat', 5, 1.2), g('grunt', 8, 0.9, 2)] },
    { name: 'Bog Rush',         flavor: 'A flood of Tricksters, with Trolls lumbering behind.',            groups: [g('trickster', 10, 0.55), g('troll', 2, 3, 3)] },
    { name: 'Mixed Company',    flavor: 'Grunts on the ground, bats overhead. Cover both.',                groups: [g('grunt', 12, 0.8), g('bat', 6, 0.9, 1)] },
    { name: 'Troll Column',     flavor: 'Four Trolls. Rooting and heavy hits win this one.',              groups: [g('troll', 4, 2.4), g('trickster', 8, 0.5, 4)] },
    { name: 'Dark Sky',         flavor: 'A swarm of bats. The valley grows dim.',                          groups: [g('bat', 10, 0.65), g('grunt', 10, 0.7, 1)] },
    { name: 'The Push',         flavor: 'Everything at once. Hold the bridge.',                            groups: [g('troll', 5, 2), g('grunt', 14, 0.55, 1), g('bat', 6, 0.8, 4)] },
    { name: 'Last Light',       flavor: 'The Hollow empties itself onto the road.',                        groups: [g('trickster', 16, 0.42), g('troll', 4, 2.2, 3), g('bat', 8, 0.7, 2)] },
    { name: 'The Shadow-Crow',  flavor: 'The Shadow-Crow Swarm rises from the Hollow. Hold the line.',    groups: [g('bat', 6, 0.9), g('grunt', 10, 0.7, 1), g('boss', 1, 1, 6)] },
  ];

  // -------- this level's scene (ported from the original single-file Renderer) --------
  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, decal, toon, unlit,
      addOutline, srand, lerpColor, scene, animated, shakeCamera, puff,
      treeParts, deadTreeParts, rockParts, mushroomParts, tuftParts, flowerParts, acornParts,
      masonry, towerCourses, roofCourses, windowDress, glow, setGlow, bannerGeo,
      worldX, worldZ, cols, rows, border, level } = kit;

    function buildStream() {
      const x = worldX(level.chokepoint.streamCol);
      const length = rows + border * 2;
      kit.water({ x, length });
      const rng = srand(21);
      // Bank stones along the water's edge.
      for (let i = 0; i < 16; i++) {
        const side = rng() < 0.5 ? -1 : 1;
        const z = -length / 2 + 0.3 + rng() * (length - 0.6);
        if (Math.abs(z - worldZ(level.chokepoint.cell[1])) < 0.9) continue;
        const s = 0.06 + rng() * 0.07;
        batchPart(P(GEO.rock, PALETTE.stone, M(x + side * (0.5 + s * 0.6), -0.02, z, { sx: s * 1.4, sy: s, sz: s, ry: rng() * 3 }), false));
      }
    }

    function buildBridge() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const rng = srand(33);
      const wm = M(x, 0, z);
      // support beams
      batchPart(P(GEO.box, PALETTE.wood, M(0, -0.02, -0.34, { sx: 1.3, sy: 0.08, sz: 0.09 })), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(0, -0.02, 0.34, { sx: 1.3, sy: 0.08, sz: 0.09 })), wm);
      // planks laid across the walking direction, a little uneven
      for (let i = 0; i < 7; i++) {
        const px = -0.54 + i * 0.18;
        batchPart(P(GEO.box, i % 2 ? PALETTE.woodLight : PALETTE.wood,
          M(px, 0.03 + (rng() - 0.5) * 0.015, (rng() - 0.5) * 0.04, { sx: 0.16, sy: 0.05, sz: 0.94, ry: (rng() - 0.5) * 0.08 })), wm);
      }
      // railings, one post leaning because it's rickety
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const px = -0.5 + i * 0.5, lean = (i === 1 && side === 1) ? 0.25 : (rng() - 0.5) * 0.08;
          batchPart(P(GEO.box, PALETTE.woodLight, M(px, 0.25, side * 0.46, { sx: 0.07, sy: 0.42, sz: 0.07, rx: lean * side })), wm);
        }
        batchPart(P(GEO.box, PALETTE.wood, M(0, 0.44, side * 0.46, { sx: 1.15, sy: 0.05, sz: 0.06, rz: (rng() - 0.5) * 0.05 })), wm);
      }
      // stone footings on each bank
      for (const side of [-1, 1]) {
        batchPart(P(GEO.box, PALETTE.stoneDark, M(side * 0.62, -0.05, 0, { sx: 0.16, sy: 0.14, sz: 1.0 })), wm);
      }
    }

    function buildHollow() {
      const [sc, sr] = level.spawn;
      const x = worldX(sc), z = worldZ(sr);
      const rng = srand(99);
      const wm = M(x, 0, z);
      // the cracked stump itself
      batchPart(P(GEO.cyl, PALETTE.hollowWood, M(0, 0.36, 0, { sx: 0.58, sy: 0.72, sz: 0.62 })), wm);
      batchPart(P(GEO.cyl, 0x5a4d52, M(0, 0.72, 0, { sx: 0.5, sy: 0.02, sz: 0.54 }), false), wm);   // pale cut face
      for (let i = 0; i < 6; i++) {   // jagged splinters around the rim
        const a = (i / 6) * Math.PI * 2 + rng() * 0.4;
        if (Math.abs(a - Math.PI / 4) < 0.7) continue;   // leave the crack side open
        const h = 0.25 + rng() * 0.45;
        batchPart(P(GEO.cone, PALETTE.hollowWood, M(Math.cos(a) * 0.5, 0.72 + h / 2, Math.sin(a) * 0.54, { sx: 0.12, sy: h, sz: 0.12, rz: -Math.cos(a) * 0.3, rx: Math.sin(a) * 0.3 })), wm);
      }
      // a dark crack facing the road and the camera, where the horde will come from
      const ca = Math.PI / 4, cx0 = Math.cos(ca) * 0.5, cz0 = Math.sin(ca) * 0.52;
      batchPart(P(GEO.box, 0x120c14, M(cx0, 0.3, cz0, { sx: 0.26, sy: 0.58, sz: 0.36, ry: -ca }), false), wm);
      batchPart(P(GEO.cyl, 0x120c14, M(cx0, 0.58, cz0, { sx: 0.18, sy: 0.26, sz: 0.18, rz: Math.PI / 2, ry: -ca }), false), wm);
      // gnarled roots reaching out over the ground
      for (let i = 0; i < 4; i++) {
        const a = 1.3 + i * 1.05 + rng() * 0.3, len = 0.45 + rng() * 0.4;
        const m = new THREE.Matrix4().makeRotationY(-a)
          .multiply(new THREE.Matrix4().makeTranslation(0.45 + len / 2, 0.06, 0))
          .multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2))
          .multiply(new THREE.Matrix4().makeScale(0.08, len, 0.1));
        batchPart(P(GEO.cylTaper, PALETTE.hollowWood, m), wm);
      }
      // corruption cracks seeping across the blighted ground, pulsing
      const cracks = [];
      for (let i = 0; i < 12; i++) {
        const a = rng() * Math.PI * 2, d = 0.9 + rng() * 2.4, len = 0.35 + rng() * 0.5;
        const cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d;
        if (GameState.zoneFalloff(Math.round(cx + cols / 2 - 0.5), Math.round(cz + rows / 2 - 0.5)) < 0.3) continue;
        const crack = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: PALETTE.magicGlow, transparent: true, opacity: 0.8, depthWrite: false }));
        crack.scale.set(len, 0.01, 0.08);
        crack.position.set(cx, 0.008, cz);
        crack.rotation.y = rng() * Math.PI;
        crack.userData.phase = rng() * 6.28;
        scene.add(crack);
        cracks.push(crack);
      }
      // the glow inside the crack
      const glow = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.magicGlow, transparent: true, opacity: 0.85 }));
      glow.position.set(x + Math.cos(Math.PI / 4) * 0.58, 0.34, z + Math.sin(Math.PI / 4) * 0.6);
      scene.add(glow);
      // spores drifting up out of the stump
      const spores = [];
      for (let i = 0; i < 9; i++) {
        const s = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.spore, transparent: true, opacity: 0.8 }));
        s.userData = { a: rng() * 6.28, r: 0.3 + rng() * 0.6, speed: 0.25 + rng() * 0.25, y: rng() * 1.6, size: 0.035 + rng() * 0.03 };
        scene.add(s);
        spores.push(s);
      }
      animated.push({
        update(t, dt) {
          for (const c of cracks) c.material.opacity = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.1 + c.userData.phase));
          const pulse = 0.9 + 0.15 * Math.sin(t * 3.2);
          glow.scale.setScalar(0.2 * pulse);
          glow.material.opacity = 0.6 + 0.3 * Math.sin(t * 3.2);
          for (const s of spores) {
            const u = s.userData;
            u.y += u.speed * dt; u.a += dt * 0.8;
            if (u.y > 1.8) u.y = 0;
            s.position.set(x + Math.cos(u.a) * u.r, 0.55 + u.y, z + Math.sin(u.a) * u.r * 0.7);
            const fade = Math.min(1, u.y * 3) * Math.max(0, 1 - u.y / 1.8);
            s.material.opacity = 0.75 * fade;
            s.scale.setScalar(u.size * (0.7 + 0.6 * fade));
          }
        },
      });
    }

    function buildBastion() {
      const cells = level.endpoint.cells;
      const cx = worldX((cells[0][0] + cells[cells.length - 1][0]) / 2);
      const cz = worldZ((cells[0][1] + cells[cells.length - 1][1]) / 2);
      const wm = M(cx, 0, cz);
      const stone = PALETTE.stone, dark = PALETTE.stoneDark;
      const H = 1.9;   // keep wall height: tall enough that the walls read from the camera angle
      // main keep body, a moss line along the top and a darker stone footing
      batchPart(P(GEO.box, stone, M(0, H / 2, -0.1, { sx: 1.9, sy: H, sz: 2.5 })), wm);
      batchPart(P(GEO.box, dark, M(0, 0.12, -0.1, { sx: 1.98, sy: 0.24, sz: 2.58 })), wm);
      batchPart(P(GEO.box, PALETTE.moss, M(0, H + 0.03, -0.1, { sx: 1.82, sy: 0.07, sz: 2.42 }), false), wm);
      // moss creeping up the walls, so it reads as an old mossy keep and not a fresh one
      batchPart(P(GEO.box, PALETTE.moss, M(0.15, 0.32, 1.17, { sx: 0.5, sy: 0.36, sz: 0.04 }), false), wm);
      batchPart(P(GEO.box, PALETTE.moss, M(0.62, 0.55, 1.17, { sx: 0.22, sy: 0.7, sz: 0.04 }), false), wm);
      batchPart(P(GEO.box, PALETTE.moss, M(-0.97, 0.36, -0.2, { sx: 0.04, sy: 0.44, sz: 0.7 }), false), wm);
      batchPart(P(GEO.box, PALETTE.moss, M(-0.97, 1.2, 0.7, { sx: 0.04, sy: 0.3, sz: 0.3 }), false), wm);
      // crenellations along the roof edge
      for (let i = -2; i <= 2; i++) {
        batchPart(P(GEO.box, dark, M(i * 0.4, H + 0.17, 1.17, { sx: 0.22, sy: 0.26, sz: 0.16 })), wm);
        batchPart(P(GEO.box, dark, M(i * 0.4, H + 0.17, -1.37, { sx: 0.22, sy: 0.26, sz: 0.16 })), wm);
      }
      for (let i = -2; i <= 2; i++) {
        batchPart(P(GEO.box, dark, M(-0.92, H + 0.17, -0.1 + i * 0.5, { sx: 0.16, sy: 0.26, sz: 0.22 })), wm);
        batchPart(P(GEO.box, dark, M(0.92, H + 0.17, -0.1 + i * 0.5, { sx: 0.16, sy: 0.26, sz: 0.22 })), wm);
      }
      // corner towers with mushroom-cap roofs: two at the front, one at the back
      const towers = [[-0.95, 1.15, 2.5], [0.95, 1.15, 2.5], [-0.95, -1.35, 2.3]];
      for (const [tx, tz, th] of towers) {
        batchPart(P(GEO.cyl, stone, M(tx, th / 2, tz, { sx: 0.38, sy: th, sz: 0.38 })), wm);
        batchPart(P(GEO.cyl, dark, M(tx, th, tz, { sx: 0.45, sy: 0.1, sz: 0.45 })), wm);
        batchPart(P(GEO.dome, PALETTE.capBrown, M(tx, th + 0.03, tz, { sx: 0.56, sy: 0.46, sz: 0.56 })), wm);
        towerCourses(wm, { x: tx, z: tz, r: 0.38, y0: 0.1, y1: th - 0.08, holes: tz > 0 ? [[0, 1.9, 0.36]] : [], seed: Math.round(tx * 10 + tz * 3) });
        roofCourses(wm, { x: tx, y: th + 0.03, z: tz, r: 0.56, h: 0.46, color: PALETTE.capBrown });
        for (let i = 0; i < 3; i++) {
          const a = i * 2.1 + tx, d = 0.32;
          batchPart(P(GEO.sphereLo, PALETTE.cream, M(tx + Math.cos(a) * d, th + 0.36, tz + Math.sin(a) * d, { s: 0.08 }), false), wm);
        }
      }
      // the tall central keep tower behind, with the banner on top
      const KT = 3.3, kx = 0.35, kz = -0.55;
      batchPart(P(GEO.cyl, stone, M(kx, KT / 2, kz, { sx: 0.48, sy: KT, sz: 0.48 })), wm);
      batchPart(P(GEO.cyl, dark, M(kx, KT, kz, { sx: 0.56, sy: 0.1, sz: 0.56 })), wm);
      batchPart(P(GEO.dome, PALETTE.capRed, M(kx, KT + 0.03, kz, { sx: 0.7, sy: 0.6, sz: 0.7 })), wm);
      towerCourses(wm, { x: kx, z: kz, r: 0.48, y0: H + 0.3, y1: KT - 0.08, holes: [[0, 2.6, 0.36]], seed: 9 });
      roofCourses(wm, { x: kx, y: KT + 0.03, z: kz, r: 0.7, h: 0.6, color: PALETTE.capRed, rings: 4 });
      // a gold finial crowning the banner pole
      batchPart(P(GEO.sphereLo, PALETTE.gold, M(kx, KT + 1.52, kz, { s: 0.06 })), wm);
      for (let i = 0; i < 4; i++) {
        const a = i * 1.6, d = 0.4;
        batchPart(P(GEO.sphereLo, PALETTE.cream, M(kx + Math.cos(a) * d, KT + 0.45, kz + Math.sin(a) * d, { s: 0.09 }), false), wm);
      }
      // the gate on the road side (south face), an arch with a wooden door
      const gx = -0.5, gz = 1.16;
      batchPart(P(GEO.box, 0x2b211b, M(gx, 0.4, gz, { sx: 0.66, sy: 0.8, sz: 0.08 }), false), wm);
      batchPart(P(GEO.cyl, 0x2b211b, M(gx, 0.8, gz, { sx: 0.33, sy: 0.08, sz: 0.33, rx: Math.PI / 2 }), false), wm);
      batchPart(P(GEO.box, PALETTE.wood, M(gx, 0.36, gz + 0.02, { sx: 0.54, sy: 0.72, sz: 0.05 }), false), wm);
      batchPart(P(GEO.cyl, PALETTE.wood, M(gx, 0.72, gz + 0.02, { sx: 0.27, sy: 0.05, sz: 0.27, rx: Math.PI / 2 }), false), wm);
      batchPart(P(GEO.box, PALETTE.woodLight, M(gx, 0.2, gz + 0.045, { sx: 0.5, sy: 0.06, sz: 0.03 }), false), wm);
      batchPart(P(GEO.box, PALETTE.woodLight, M(gx, 0.56, gz + 0.045, { sx: 0.5, sy: 0.06, sz: 0.03 }), false), wm);
      // stone steps and a doormat of flagstones leading down to the road
      batchPart(P(GEO.box, dark, M(gx, 0.05, gz + 0.2, { sx: 0.9, sy: 0.1, sz: 0.28 })), wm);
      batchPart(P(GEO.box, PALETTE.cobble, M(gx, 0.02, gz + 0.42, { sx: 0.8, sy: 0.04, sz: 0.2 }), false), wm);
      // lantern posts flanking the gate, warm and glowing
      const lanterns = [];
      for (const lx of [gx - 0.55, gx + 0.55]) {
        batchPart(P(GEO.cyl, PALETTE.wood, M(lx, 0.3, gz + 0.3, { sx: 0.035, sy: 0.6, sz: 0.035 })), wm);
        batchPart(P(GEO.box, dark, M(lx, 0.66, gz + 0.3, { sx: 0.12, sy: 0.16, sz: 0.12 })), wm);
        const l = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.windowWarm }));
        l.position.set(cx + lx, 0.66, cz + gz + 0.3);
        l.scale.setScalar(0.05);
        l.userData.phase = lx * 7;
        scene.add(l);
        lanterns.push(l);
        glow(cx + lx, 0.66, cz + gz + 0.3, { w: 0.5, h: 0.5 });
      }
      // laid-stone courses on the faces the camera sees (south, and east
      // since the camera yaws slightly that way)
      masonry(wm, { face: 'z', at: 1.15, u0: -0.95, u1: 0.95, y0: 0.24, y1: H, seed: 11,
        holes: [[gx, 0.55, 0.72, 1.2], [-0.5, 1.35, 0.3, 0.38], [0.4, 0.75, 0.3, 0.38], [0.4, 1.4, 0.3, 0.38]] });
      masonry(wm, { face: 'x', at: 0.95, u0: -1.35, u1: 0.8, y0: 0.24, y1: H, seed: 12 });
      // warm lit windows, live so they can flicker
      const windows = [];
      const winSpots = [
        [-0.5, 1.35, 1.16, 'z'], [0.4, 0.75, 1.16, 'z'], [0.4, 1.4, 1.16, 'z'],
        [-0.96, 0.9, 0.2, 'x'], [-0.96, 1.4, -0.6, 'x'],
        [-0.95, 1.9, 1.5, 'z'], [0.95, 1.9, 1.5, 'z'], [kx, 2.6, kz + 0.45, 'z'],
      ];
      for (const [wx, wy, wz, axis] of winSpots) {
        const w = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: PALETTE.windowWarm }));
        w.position.set(cx + wx, wy, cz + wz);
        if (axis === 'z') w.scale.set(0.16, 0.24, 0.05); else w.scale.set(0.05, 0.24, 0.16);
        w.userData.phase = wx * 3 + wz * 5;
        scene.add(w);
        windows.push(w);
        windowDress(wm, wx, wy, wz, axis, { sign: axis === 'x' ? -1 : 1 });
      }
      // banner: pole + a waving cloth built from a segmented plane
      const pole = new THREE.Mesh(GEO.cyl, toon(PALETTE.wood));
      pole.position.set(cx + kx, KT + 0.9, cz + kz);
      pole.scale.set(0.035, 1.2, 0.035);
      scene.add(pole);
      const bannerGeo = kit.bannerGeo(0.8, 0.46, { field: PALETTE.tunic, stripe: PALETTE.gold });
      const bp = bannerGeo.attributes.position;
      const banner = new THREE.Mesh(bannerGeo, toon(0xffffff, { vc: true, side: THREE.DoubleSide }));
      banner.position.set(cx + kx + 0.4, KT + 1.2, cz + kz);
      scene.add(banner);
      // damage overlay: cracks appear when hurt, rubble and smoke when nearly lost
      const dmg = { cracks: new THREE.Group(), rubble: new THREE.Group(), smokeTimer: 0, state: 0 };
      const crackSpots = [[-0.4, 0.5, 1.17, 0.25, 0.7], [0.55, 1.1, 1.17, 0.18, 0.5], [-0.97, 0.9, 0.6, 0.2, 0.6], [-0.97, 1.5, -0.4, 0.14, 0.45], [0.2, 1.5, 1.17, 0.2, 0.5]];
      crackSpots.forEach(([wx, wy, wz, ww, wh], i) => {
        const c = new THREE.Mesh(GEO.box, unlit(0x2b211b));
        c.position.set(cx + wx, wy, cz + wz);
        c.scale.set(wz > 1 ? ww : 0.05, wh, wz > 1 ? 0.05 : ww);
        c.rotation.z = (i % 2 ? 0.5 : -0.4);
        dmg.cracks.add(c);
      });
      for (let i = 0; i < 6; i++) {
        const r = new THREE.Mesh(GEO.rock, toon(PALETTE.stoneDark));
        const a = i * 1.1, d = 1.05 + (i % 2) * 0.25;
        r.position.set(cx + (i < 3 ? -0.98 - (i % 2) * 0.2 : Math.cos(a) * 0.6), 0.08, cz + (i < 3 ? -0.6 + i * 0.5 : 1.3 + (i % 2) * 0.2));
        r.scale.set(0.2, 0.13, 0.17); r.rotation.y = a;
        addOutline(r);
        dmg.rubble.add(r);
      }
      // a fire glow in the breach above the gate, plus a scorch on the roof, for the worst state
      dmg.fire = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.9 }));
      dmg.fire.position.set(cx - 0.5, 1.3, cz + 1.05); dmg.fire.scale.set(0.3, 0.42, 0.2);
      dmg.scorch = new THREE.Mesh(GEO.circle, unlit(0x2b211b, { opacity: 0.85, depthWrite: false }));
      dmg.scorch.position.set(cx - 0.3, H + 0.08, cz + 0.4); dmg.scorch.scale.setScalar(0.55);
      dmg.cracks.visible = false; dmg.rubble.visible = false; dmg.fire.visible = false; dmg.scorch.visible = false;
      scene.add(dmg.cracks, dmg.rubble, dmg.fire, dmg.scorch);
      GameState.on('endpointStateChanged', (st) => {
        dmg.state = st;
        dmg.cracks.visible = st >= 1;
        dmg.rubble.visible = st >= 2;
        dmg.fire.visible = st >= 2;
        dmg.scorch.visible = st >= 2;
        setGlow(st >= 2 ? 0.35 : 1);
        shakeCamera(0.12, 0.4);
        puff(cx - 0.6, 0.6, cz + 1.2, { count: 16, color: PALETTE.stone, speed: 2, size: 0.12, up: 1.6, ttl: 0.8 });
      });
      const base = bp.array.slice();
      animated.push({
        update(t, dt) {
          const droop = dmg.state === 2 ? 0.35 : dmg.state === 1 ? 0.7 : 1;
          banner.rotation.z = dmg.state === 2 ? -0.6 : 0;
          for (let i = 0; i < bp.count; i++) {
            const x = base[i * 3], u = (x + 0.4) / 0.8;
            bp.setZ(i, Math.sin(t * 5.5 - u * 4.5) * 0.1 * u * droop);
            bp.setY(i, base[i * 3 + 1] + Math.sin(t * 2.2 - u * 2) * 0.03 * u * droop);
          }
          if (dmg.state >= 1) {
            dmg.smokeTimer -= dt;
            if (dmg.smokeTimer <= 0) {
              dmg.smokeTimer = dmg.state === 2 ? 0.07 : 0.4;
              const heavy = dmg.state === 2;
              puff(cx - 0.3 + Math.random() * 0.5 - 0.25, H + 0.2, cz + 0.4, { count: 1, color: heavy ? 0x3a322c : 0x8c847a, speed: 0.15, size: heavy ? 0.26 : 0.16, up: heavy ? 1.3 : 0.9, ttl: heavy ? 2.2 : 1.6 });
              if (heavy && Math.random() < 0.35) puff(cx - 0.5, 1.4, cz + 1.05, { count: 1, color: 0xffb347, speed: 0.4, size: 0.05, up: 1.8, ttl: 0.7 });
            }
            if (dmg.state === 2) {
              const f = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 7.3);
              dmg.fire.scale.set(0.3 * f, 0.42 * (2 - f), 0.2 * f);
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
      const rng = srand(2026);
      const swayTrees = [];
      const spawnAt = (c, r) => {
        const inGrid = GameState.inGrid(c, r);
        const h = GameState.zoneFalloff(c, r);
        const x = worldX(c) + (rng() - 0.5) * 0.5, z = worldZ(r) + (rng() - 0.5) * 0.5;
        const roll = rng();
        if (h > 0.45) {
          // blighted ground: dead trees, pale rocks, very little else
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
        const nearBastion = c >= 14 && r >= 4;
        if (nearBastion) {
          // keep the keep's skyline clear: only low props around it
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
          // the framing forest outside the grid is dense
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
            const g = liveProp(parts, x, 0, z);
            g.userData.phase = rng() * 6.28;
            swayTrees.push(g);
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
          for (const g of swayTrees) {
            g.rotation.z = Math.sin(t * 1.1 + g.userData.phase) * 0.035;
            g.rotation.x = Math.cos(t * 0.9 + g.userData.phase) * 0.025;
          }
        },
      });

      // Butterflies over the meadow: small flapping planes on lazy loops.
      const rngB = srand(5);
      const butterflies = [];
      const homes = [[6, 4], [12, 8], [10, 1]];
      const colors = [PALETTE.flowerPink, PALETTE.flowerYellow, PALETTE.magic];
      homes.forEach(([c, r], i) => {
        const g = new THREE.Group();
        const wingGeo = new THREE.PlaneGeometry(0.13, 0.18);
        const mat = unlit(colors[i], { side: THREE.DoubleSide });
        const l = new THREE.Mesh(wingGeo, mat), rr = new THREE.Mesh(wingGeo, mat);
        l.position.x = -0.065; rr.position.x = 0.065;
        const lp = new THREE.Group(), rp = new THREE.Group();
        lp.add(l); rp.add(rr); g.add(lp, rp);
        g.rotation.x = -Math.PI / 2;
        g.userData = { home: [worldX(c), worldZ(r)], phase: rngB() * 6.28, lp, rp };
        scene.add(g);
        butterflies.push(g);
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
    buildBridge();
    buildHollow();
    buildBastion();
    buildCountryside();
  }

  return {
    id: 'shadow-hollow',
    index: 1,
    name: 'The Shadow Hollow',
    subtitle: 'The corruption has cracked open. Hold the Bastion.',
    // overworld node: position in the world map's 800x320 viewBox, and how
    // much blight a win here clears around it
    map: { x: 640, y: 248, reclaim: 110, icon: 'keep' },
    grid: { cols: 18, rows: 11 },
    spawn: [0, 2],
    pathWaypoints: [[0, 2], [4, 2], [4, 6], [8, 6], [11, 6], [11, 3], [14, 3], [14, 9], [16, 9]],
    chokepoint: { cell: [8, 6], streamCol: 8 },
    endpoint: {
      name: 'the Bastion', properName: 'The Bastion',
      cells: [[16, 6], [17, 6], [16, 7], [17, 7], [16, 8], [17, 8]], gateCell: [16, 8],
    },
    cobbleTailCells: 3,
    theme: { center: [0.6, 2.1], radiusOut: { x: 4.1, z: 3.4 }, radiusIn: 1.18, falloffWidth: 0.42 },
    spawnBlockedText: 'Nothing grows on the Hollow stump.',
    waves, prepSeconds: 14, startGold: 150, startLives: 20, starThresholds: [16, 8],
    tipTile: [7, 5],
    endScreenText: {
      3: () => 'Twelve waves turned back and the walls barely scratched. The valley sings your name.',
      2: (s) => `Twelve waves turned back with ${s.lives} lives to spare. The masons have some work to do.`,
      1: (s) => `Twelve waves turned back with ${s.lives} lives left. The Bastion holds, just.`,
      lose: (s) => `The goblins got through on wave ${s.wave}. Plant towers where the road bends, and remember only Druids and Artillery reach flyers.`,
    },
    buildScene,
  };
})();
