// ===================================================================
// DAWN KIT — shared scene pieces for the two "dawn" levels (9 and 10),
// which carry the title splash's look into play: a warm sunrise over
// purple haze, a blighted Hollow at the edges, the lit Bastion, and a
// flower-and-mushroom meadow between. The Bastion is Level 1's own keep
// (same masonry, mushroom-cap towers, banner and 3 damage states), so the
// home the player defends in the splash is the one they defend here.
// ===================================================================
const DawnKit = (() => {
  // The Bastion on its endpoint block (2 columns x 3 rows, gate at the
  // bottom-left cell, roads arriving from the south).
  function bastion(kit, cfg = {}) {
    const { P, M, GEO, PALETTE, batchPart, toon, unlit, addOutline, scene, animated, shakeCamera, puff,
      masonry, towerCourses, roofCourses, windowDress, glow, setGlow, worldX, worldZ, level } = kit;
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
      const bannerGeoM = kit.bannerGeo(0.8, 0.46, { field: cfg.bannerField ?? PALETTE.tunic, stripe: cfg.bannerStripe ?? PALETTE.gold });
      const bp = bannerGeoM.attributes.position;
      const banner = new THREE.Mesh(bannerGeoM, toon(0xffffff, { vc: true, side: THREE.DoubleSide }));
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
          bannerGeoM.computeVertexNormals();
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

  // A cracked Hollow stump at the head of every road, facing outward from
  // the map edge it stands on, with a pulsing glow and drifting spores.
  function spawns(kit) {
    const { P, M, GEO, PALETTE, batchPart, srand, scene, animated, deadTreeParts, worldX, worldZ, cols, rows } = kit;
    const rng = srand(419);
    GameState.routes.forEach((rt, n) => {
      const [sc, sr] = rt.cells[0];
      const ox = sc === 0 ? -1 : sc === cols - 1 ? 1 : 0, oz = sr === 0 ? -1 : sr === rows - 1 ? 1 : 0;
      const x = worldX(sc) + ox * 0.55, z = worldZ(sr) + oz * 0.55;
      const wm = M(x, 0, z);
      batchPart(P(GEO.circle, PALETTE.hollowEarth, M(0, 0.006, 0, { s: 0.95 }), false), wm);
      batchPart(P(GEO.cylTaper, PALETTE.hollowWood, M(0, 0.26, 0, { sx: 0.34, sy: 0.52, sz: 0.36 })), wm);
      batchPart(P(GEO.cyl, 0x5a4d52, M(0, 0.52, 0, { sx: 0.3, sy: 0.02, sz: 0.32 }), false), wm);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + rng() * 0.4, h = 0.18 + rng() * 0.3;
        batchPart(P(GEO.cone, PALETTE.hollowWood, M(Math.cos(a) * 0.3, 0.52 + h / 2, Math.sin(a) * 0.32, { sx: 0.08, sy: h, sz: 0.08, rz: -Math.cos(a) * 0.3, rx: Math.sin(a) * 0.3 })), wm);
      }
      for (let i = 0; i < 3; i++) {
        const s = 0.07 + rng() * 0.06, a = rng() * 6.28;
        batchPart(P(GEO.rock, PALETTE.hollowRock, M(Math.cos(a) * 0.62, 0.02, Math.sin(a) * 0.62, { sx: s * 1.3, sy: s, sz: s, ry: rng() * 3 })), wm);
      }
      const { parts } = deadTreeParts(rng);
      for (const p of parts) batchPart(p, M(x - ox * 0.6 + 0.3, 0, z - oz * 0.6 + 0.35));
      const eye = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.magicGlow, transparent: true, opacity: 0.85 }));
      eye.position.set(x, 0.34, z); scene.add(eye);
      const crack = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: PALETTE.magicGlow, transparent: true, opacity: 0.7, depthWrite: false }));
      crack.scale.set(0.55, 0.01, 0.06); crack.position.set(x, 0.012, z); crack.rotation.y = 0.6 + n;
      scene.add(crack);
      const spores = [];
      for (let i = 0; i < 4; i++) {
        const s = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.spore, transparent: true, opacity: 0.8 }));
        s.userData = { a: rng() * 6.28, r: 0.2 + rng() * 0.3, speed: 0.25 + rng() * 0.25, y: rng() * 1.2, size: 0.03 + rng() * 0.025 };
        scene.add(s); spores.push(s);
      }
      animated.push({
        update(t, dt) {
          const pulse = 0.9 + 0.15 * Math.sin(t * 3.2 + n);
          eye.scale.setScalar(0.15 * pulse);
          eye.material.opacity = 0.6 + 0.3 * Math.sin(t * 3.2 + n);
          crack.material.opacity = 0.4 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.2 + n * 2));
          for (const s of spores) {
            const u = s.userData; u.y += u.speed * dt; u.a += dt * 0.8;
            if (u.y > 1.4) u.y = 0;
            s.position.set(x + Math.cos(u.a) * u.r, 0.45 + u.y, z + Math.sin(u.a) * u.r * 0.7);
            const fade = Math.min(1, u.y * 3) * Math.max(0, 1 - u.y / 1.4);
            s.material.opacity = 0.75 * fade; s.scale.setScalar(u.size * (0.7 + 0.6 * fade));
          }
        },
      });
    });
  }

  // The brook with a plank bridge at the chokepoint (same crossing idea as
  // Level 1, sized for a short stream run).
  function brook(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, srand, worldX, worldZ, rows, border, level } = kit;
    const rs = level.chokepoint.streamRows;
    const r0 = rs ? rs[0] : 0, r1 = rs ? rs[1] : rows - 1;
    const len = (r1 - r0 + 1) + (rs ? 0 : border * 2);
    kit.water({ x: worldX(level.chokepoint.streamCol), z: rs ? worldZ((r0 + r1) / 2) : undefined, length: len, speed: 0.6, stripe: 0.4 });
    const [bc, br] = level.chokepoint.cell;
    const x = worldX(bc), z = worldZ(br), wm = M(x, 0, z), rng = srand(733);
    for (let i = 0; i < 6; i++) {
      batchPart(P(GEO.box, i % 2 ? PALETTE.wood : PALETTE.woodLight, M(-0.75 + i * 0.3, 0.1, (rng() - 0.5) * 0.03, { sx: 0.27, sy: 0.05, sz: 0.46 })), wm);
    }
    for (const s of [-1, 1]) {
      batchPart(P(GEO.box, PALETTE.wood, M(0, 0.2, s * 0.26, { sx: 1.8, sy: 0.05, sz: 0.05 })), wm);
      for (const bx of [-0.8, 0, 0.8]) batchPart(P(GEO.cylTaper, PALETTE.wood, M(bx, 0.14, s * 0.26, { sx: 0.04, sy: 0.28, sz: 0.04 })), wm);
    }
    batchDecal(x, z, 0.6);
  }

  // The splash meadow: lots of flowers and mushrooms, light trees, the
  // Hollow's dead wood only where the blight is. `wide` = the region the
  // spawn mouths keep clear. Returns nothing; adds batched props.
  function meadow(kit, seed) {
    const { M, batchPart, batchDecal, liveProp, decal, srand, animated, border, cols, rows, worldX, worldZ, level,
      treeParts, deadTreeParts, rockParts, mushroomParts, tuftParts, flowerParts, acornParts } = kit;
    const rng = srand(seed);
    const swayTrees = [];
    const mouths = GameState.routes.map((rt) => rt.cells[0]);
    const nearMouth = (c, r) => mouths.some(([mc, mr]) => Math.abs(c - mc) <= 2 && Math.abs(r - mr) <= 2);
    const spawnAt = (c, r) => {
      if (nearMouth(c, r)) return;
      const inGrid = GameState.inGrid(c, r);
      const h = GameState.zoneFalloff(c, r);
      const x = worldX(c) + (rng() - 0.5) * 0.5, z = worldZ(r) + (rng() - 0.5) * 0.5;
      const roll = rng();
      const put = ({ parts, radius }) => { for (const p of parts) batchPart(p, M(x, 0, z)); if (radius) batchDecal(x, z, radius); };
      if (h > 0.45) {
        if (roll < 0.4) put(deadTreeParts(rng)); else if (roll < 0.7) put(rockParts(rng, true));
        return;
      }
      if (!inGrid) {
        if (roll < 0.62) put(treeParts(rng)); else if (roll < 0.74) put(rockParts(rng, false));
        else if (roll < 0.86) put(mushroomParts(rng, rng() < 0.5)); else if (roll < 0.95) put(flowerParts(rng));
        return;
      }
      const hidesTower = GameState.isBuildable(c, r - 1) || GameState.isBuildable(c - 1, r - 1);
      if (roll < 0.12 && !hidesTower) {
        const { parts, radius } = treeParts(rng);
        if (swayTrees.length < 8) {
          const gp = liveProp(parts, x, 0, z); gp.userData.phase = rng() * 6.28; swayTrees.push(gp); decal(x, z, radius);
        } else put({ parts, radius });
      } else if (roll < 0.2) put(rockParts(rng, false));
      else if (roll < 0.4) put(flowerParts(rng));
      else if (roll < 0.58) put(mushroomParts(rng, rng() < 0.45));
      else if (roll < 0.76) put(tuftParts(rng));
      else if (roll < 0.84) put(acornParts(rng));
    };
    for (let r = -border; r < rows + border; r++) {
      for (let c = -border; c < cols + border; c++) {
        if (GameState.inGrid(c, r)) {
          const kind = GameState.cellKind(c, r);
          if (kind !== 'ground' || GameState.isBuildable(c, r) || GameState.isSpawn(c, r)) continue;
        } else if (c === level.chokepoint.streamCol && !level.chokepoint.streamRows) continue;
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

  return { bastion, spawns, brook, meadow };
})();
