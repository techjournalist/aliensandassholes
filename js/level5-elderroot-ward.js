// ===================================================================
// LEVEL 5 — The Elderroot Ward (climax)
// Four battles won, and the army has reached the Heart of the Hollow
// itself. A spiral path coils in past the Rootfall Chasm toward the
// Elderroot, a colossal still-living tree at the very center of the
// corruption — the last living thing this deep in, and the reason the
// Hollow exists at all. Hold its ward, and the Shadow-Crow Swarm returns
// for one final flight.
// ===================================================================
const LEVEL_5 = (() => {
  // route/at are optional: which road the group takes, and an absolute start
  // time for groups that come at once (see GameState.startWave)
  const g = (type, count, gap, delay = 0, route, at) => ({ type, count, gap, delay, route, at });

  const waves = [
    { name: 'First Roots',        flavor: 'Grunts test the outer coil. The ward waits.',                        groups: [g('grunt', 5, 3.4)] },
    { name: 'Deeper In',          flavor: 'More grunts, closer together now.',                                  groups: [g('grunt', 9, 1.3)] },
    { name: 'Quick Roots',        flavor: 'Bog-Tricksters slip through the outer ring.',                        groups: [g('grunt', 6, 1.1), g('trickster', 8, 0.6, 2)] },
    { name: 'The Old Troll',      flavor: 'A Moss Troll grinds through the chasm crossing.',                    groups: [g('grunt', 8, 0.9), g('troll', 1, 1, 3)] },
    { name: 'Wings in the Dark',  flavor: 'Bramble Bats rise over the coil. Druids and Artillery only.',        groups: [g('bat', 6, 1.1), g('grunt', 8, 0.85, 2)] },
    { name: 'The Second Ring',    flavor: 'Grunts and Tricksters press the inner coil together.',                groups: [g('grunt', 10, 0.75), g('trickster', 9, 0.55, 2)] },
    { name: 'Troll Column',       flavor: 'Three Trolls in a line. Rooting wins this one.',                     groups: [g('troll', 3, 2.3), g('grunt', 9, 0.7, 3)] },
    { name: 'The Narrow Coil',    flavor: 'The path tightens. Everything moves at once.',                       groups: [g('grunt', 12, 0.6), g('trickster', 10, 0.5, 2)] },
    { name: 'Dark Wings',         flavor: 'A swarm of bats blackens the inner ring.',                            groups: [g('bat', 10, 0.6), g('grunt', 10, 0.65, 1)] },
    { name: 'Pressed to the Root',flavor: 'Trolls, Tricksters and Bats, together now.',                          groups: [g('troll', 3, 2.1), g('trickster', 12, 0.45, 1), g('bat', 7, 0.7, 4)] },
    { name: 'The Ward Trembles',  flavor: 'The Elderroot’s light flickers. Hold it steady.',                groups: [g('grunt', 14, 0.5), g('troll', 3, 1.9, 2), g('bat', 8, 0.6, 5)] },
    { name: 'Everything at Once', flavor: 'A Troll column, a Trickster rush and a Bat swarm, all together.',    groups: [g('troll', 4, 1.9, 0), g('trickster', 15, 0.4, 0), g('bat', 9, 0.55, 0)] },
    { name: 'The Last Root',      flavor: 'One breath before the Swarm returns.',                                groups: [g('grunt', 16, 0.45), g('trickster', 12, 0.4, 2), g('troll', 4, 1.7, 4)] },
    { name: 'The Shadow-Crow Returns', flavor: 'It rises from the Heart itself. Hold the ward.',                 groups: [g('bat', 8, 0.75), g('troll', 2, 2.0, 1), g('boss', 1, 1, 7)] },
  ];

  // -------- this level's scene (Rootfall Chasm chokepoint, Elderroot Ward endpoint) --------
  function buildScene(kit) {
    const { P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, decal, toon, unlit,
      addOutline, srand, scene, animated, shakeCamera, puff,
      treeParts, deadTreeParts, rockParts, mushroomParts, tuftParts, flowerParts, acornParts,
      glow, setGlow,
      worldX, worldZ, cols, rows, border, level } = kit;

    // The Rootfall Chasm: a bounded fissure (chokepoint.streamRows), not the
    // full grid height — the spiral crosses this column only once, near the
    // entrance, so the chasm reads as a short, local scar, not a river
    // running the length of the map.
    function buildChasm() {
      const [r0, r1] = level.chokepoint.streamRows;
      const x = worldX(level.chokepoint.streamCol);
      const midZ = (worldZ(r0) + worldZ(r1)) / 2;
      const length = (r1 - r0 + 1) + border * 2;
      kit.water({ x, z: midZ, length, width: 1.05, y: -0.16, shallow: 0x3a2448, deep: 0x120c14, foam: PALETTE.magicGlow, speed: 0.22, stripe: 0.8, foamAmt: 0.4 });
      const rng = srand(551);
      for (let i = 0; i < 10; i++) {
        const side = rng() < 0.5 ? -1 : 1;
        const rz = r0 - border + rng() * (r1 - r0 + border * 2);
        const z = worldZ(rz);
        if (Math.abs(rz - level.chokepoint.cell[1]) < 0.9) continue;
        const s = 0.07 + rng() * 0.08;
        batchPart(P(GEO.rock, PALETTE.hollowRock, M(x + side * (0.5 + s * 0.5), -0.02, z, { sx: s * 1.3, sy: s * 1.4, sz: s, ry: rng() * 3 })));
      }
    }

    // A living root of the Elderroot itself reaches all the way out here,
    // grown thick enough to bridge the chasm — the one green, living thing
    // this close to the spawn.
    function buildRootBridge() {
      const [bc, br] = level.chokepoint.cell;
      const x = worldX(bc), z = worldZ(br);
      const wm = M(x, 0, z);
      const rng = srand(557);
      batchPart(P(GEO.cylTaper, PALETTE.wood, M(0, -0.05, 0, { sx: 0.22, sy: 1.5, sz: 0.34, rz: Math.PI / 2 })), wm);
      batchPart(P(GEO.box, PALETTE.woodLight, M(0, 0.06, 0, { sx: 1.5, sy: 0.05, sz: 0.4 }), false), wm);
      // gnarled bumps and small living sprouts along the root's back
      for (let i = 0; i < 6; i++) {
        const rx = -0.62 + i * 0.24 + (rng() - 0.5) * 0.06;
        batchPart(P(GEO.sphereLo, PALETTE.wood, M(rx, 0.13, (rng() - 0.5) * 0.2, { sx: 0.09, sy: 0.06, sz: 0.09 })), wm);
        if (rng() < 0.5) {
          batchPart(P(GEO.sphereLo, PALETTE.moss, M(rx, 0.17, (rng() - 0.5) * 0.2, { sx: 0.06, sy: 0.05, sz: 0.06 }), false), wm);
        }
      }
      // a few small living sprigs, the one hopeful sight this side of the map
      for (let i = 0; i < 3; i++) {
        const rx = -0.4 + i * 0.4, a = rng() * Math.PI * 2;
        batchPart(P(GEO.cone, PALETTE.meadowLight, M(rx, 0.16, 0.05, { sx: 0.03, sy: 0.14, sz: 0.03, rz: Math.cos(a) * 0.3, rx: Math.sin(a) * 0.3 }), false), wm);
      }
      // faint magic seep at the bottom of the chasm on either side
      for (const side of [-1, 1]) {
        const c = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: PALETTE.magicGlow, transparent: true, opacity: 0.55, depthWrite: false }));
        c.scale.set(0.06, 0.01, 0.5); c.position.set(x + side * 0.62, -0.14, z); c.rotation.y = 0.15 * side;
        scene.add(c);
        animated.push({ update(t) { c.material.opacity = 0.35 + 0.25 * Math.sin(t * 1.6 + side); } });
      }
    }

    // Spawn dressing: the deepest, most corrupted ground on the map — this
    // is the Heart of the Hollow's own doorstep.
    function buildSpawn() {
      const [sc, sr] = level.spawn;
      const x = worldX(sc), z = worldZ(sr);
      const rng = srand(571);
      batchPart(P(GEO.circle, PALETTE.hollowEarth, M(x, 0.006, z, { s: 1.1 }), false));
      batchPart(P(GEO.cylTaper, PALETTE.hollowWood, M(x - 0.3, 0.36, z, { sx: 0.36, sy: 0.7, sz: 0.36 })));
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26;
        batchPart(P(GEO.cone, PALETTE.hollowWood, M(x - 0.3 + Math.cos(a) * 0.34, 0.7, z + Math.sin(a) * 0.34, { sx: 0.08, sy: 0.28, sz: 0.08, rz: -Math.cos(a) * 0.5, rx: Math.sin(a) * 0.5 })));
      }
      for (let i = 0; i < 5; i++) {
        const s = 0.09 + rng() * 0.09, a = rng() * 6.28, d = 0.6 + rng() * 1.1;
        batchPart(P(GEO.rock, PALETTE.hollowRock, M(x + Math.cos(a) * d, 0.02, z + Math.sin(a) * d, { sx: s * 1.3, sy: s, sz: s, ry: rng() * 3 })));
      }
      for (let i = 0; i < 3; i++) {
        const { parts } = deadTreeParts(rng);
        const a = 1.0 + i * 2.1, d = 1.0 + rng() * 0.3;
        for (const p of parts) batchPart(p, M(x + Math.cos(a) * d, 0, z + Math.sin(a) * d));
      }
      const cracks = [];
      for (let i = 0; i < 10; i++) {
        const a = rng() * Math.PI * 2, d = 0.5 + rng() * 1.7, len = 0.3 + rng() * 0.45;
        const crack = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: PALETTE.magicGlow, transparent: true, opacity: 0.7, depthWrite: false }));
        crack.scale.set(len, 0.01, 0.07);
        crack.position.set(x + Math.cos(a) * d, 0.006, z + Math.sin(a) * d);
        crack.rotation.y = rng() * Math.PI;
        crack.userData.phase = rng() * 6.28;
        scene.add(crack);
        cracks.push(crack);
      }
      animated.push({ update(t) { for (const c of cracks) c.material.opacity = 0.4 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + c.userData.phase)); } });
    }

    // The Elderroot: a colossal still-living stump ringed by a ward-circle
    // of standing stones. Unlike the campaign's built endpoints, damage here
    // isn't masonry cracking — it's the ward's own light guttering, and
    // corruption creeping up the bark as it fails.
    function buildElderroot() {
      const cells = level.endpoint.cells;
      const cx = worldX((cells[0][0] + cells[cells.length - 1][0]) / 2);
      const cz = worldZ((cells[0][1] + cells[cells.length - 1][1]) / 2);
      const wm = M(cx, 0, cz);
      const rng = srand(577);
      const H = 2.6, R = 0.95;
      // the trunk: a huge, weathered stump, wider at the root flare
      batchPart(P(GEO.cylTaper, PALETTE.wood, M(0, H * 0.42, 0, { sx: R * 0.8, sy: H * 0.85, sz: R * 0.8 })), wm);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        batchPart(P(GEO.cone, PALETTE.wood, M(Math.cos(a) * R * 0.7, 0.14, Math.sin(a) * R * 0.7, { sx: 0.16, sy: 0.4, sz: 0.14, rz: -Math.cos(a) * 1.15, rx: Math.sin(a) * 1.15 })), wm);
      }
      // bark ridges and moss patches — old, but alive
      for (let i = 0; i < 10; i++) {
        const a = rng() * Math.PI * 2, y = 0.3 + rng() * 1.6;
        batchPart(P(GEO.box, PALETTE.hollowWood, M(Math.cos(a) * R * 0.78, y, Math.sin(a) * R * 0.78, { sx: 0.05, sy: 0.5 + rng() * 0.4, sz: 0.1, ry: a }), false), wm);
      }
      for (let i = 0; i < 6; i++) {
        const a = rng() * Math.PI * 2, y = 0.5 + rng() * 1.2;
        batchPart(P(GEO.sphereLo, PALETTE.moss, M(Math.cos(a) * R * 0.82, y, Math.sin(a) * R * 0.82, { sx: 0.16, sy: 0.1, sz: 0.14, ry: a }), false), wm);
      }
      // the flat, broken crown, with a handful of small living shoots and
      // one glowing hollow — the ward's living heart, warm and lit
      batchPart(P(GEO.cylTaper, PALETTE.hollowWood, M(0, H * 0.88, 0, { sx: R * 0.55, sy: 0.24, sz: R * 0.55 })), wm);
      const shoots = [];
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + rng();
        const s = new THREE.Mesh(GEO.cone, toon(PALETTE.meadowLight));
        s.position.set(cx + Math.cos(a) * R * 0.3, H + 0.1, cz + Math.sin(a) * R * 0.3);
        s.scale.set(0.05, 0.32 + rng() * 0.16, 0.05);
        s.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
        addOutline(s); scene.add(s);
        shoots.push(s);
      }
      const heart = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.magicGlow }));
      heart.position.set(cx + 0.1, H * 0.9, cz + 0.15);
      heart.scale.setScalar(0.1);
      scene.add(heart);
      glow(cx + 0.1, H * 0.9, cz + 0.15, { w: 0.9, h: 0.9 });
      // the ward-circle: six standing stones ringing the trunk, glowing tops,
      // with a gap on the south face where the path enters
      const stones = [];
      const N = 8;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + 0.1;
        if (Math.abs(((a % (Math.PI * 2)) - Math.PI / 2 + Math.PI * 4) % (Math.PI * 2)) < 0.5) continue; // gate gap, south face
        const d = R * 1.9, sx = cx + Math.cos(a) * d, sz = cz + Math.sin(a) * d;
        batchPart(P(GEO.rock, PALETTE.stoneDark, M(sx - cx, 0.32, sz - cz, { sx: 0.14, sy: 0.55, sz: 0.14, ry: a })), wm);
        const top = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.magic }));
        top.position.set(sx, 0.62, sz); top.scale.setScalar(0.055);
        scene.add(top);
        glow(sx, 0.62, sz, { w: 0.35, h: 0.35 });
        stones.push(top);
      }
      // the ground ring itself, a pulsing rune circle
      const ringMesh = new THREE.Mesh(new THREE.RingGeometry(R * 1.6, R * 1.75, 24), new THREE.MeshBasicMaterial({ color: PALETTE.magic, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(cx, 0.02, cz);
      scene.add(ringMesh);
      // a small rune banner on a pole beside the gate gap, marking the entrance
      const poleX = cx - R * 0.55, poleZ = cz + R * 1.95;
      const pole = new THREE.Mesh(GEO.cyl, toon(PALETTE.stoneDark));
      pole.position.set(poleX, 0.4, poleZ);
      pole.scale.set(0.035, 0.8, 0.035);
      scene.add(pole);
      const bannerGeo = kit.bannerGeo(0.34, 0.22, { field: PALETTE.magic, stripe: PALETTE.gold });
      const bp = bannerGeo.attributes.position;
      const banner = new THREE.Mesh(bannerGeo, toon(0xffffff, { vc: true, side: THREE.DoubleSide }));
      banner.position.set(poleX + 0.19, 0.68, poleZ);
      scene.add(banner);
      // damage: the ward gutters and corruption climbs the bark as lives fall
      const dmg = { creep: new THREE.Group(), state: 0, smokeTimer: 0 };
      for (let i = 0; i < 9; i++) {
        const a = rng() * Math.PI * 2;
        const c = new THREE.Mesh(GEO.box, unlit(PALETTE.spore));
        c.position.set(cx + Math.cos(a) * R * 0.76, 0.15 + rng() * 1.6, cz + Math.sin(a) * R * 0.76);
        c.scale.set(0.07, 0.7 + rng() * 0.7, 0.12);
        c.rotation.y = a; c.rotation.x = (rng() - 0.5) * 0.3;
        dmg.creep.add(c);
      }
      dmg.creep.visible = false;
      scene.add(dmg.creep);
      GameState.on('endpointStateChanged', (st) => {
        dmg.state = st;
        dmg.creep.visible = st >= 1;
        setGlow(st === 2 ? 0.3 : st === 1 ? 0.65 : 1);
        shakeCamera(0.1, 0.4);
        puff(cx, 0.6, cz, { count: 14, color: PALETTE.spore, speed: 1.8, size: 0.11, up: 1.6, ttl: 0.8 });
      });
      const base = bp.array.slice();
      animated.push({
        update(t, dt) {
          const health = dmg.state === 2 ? 0.08 : dmg.state === 1 ? 0.55 : 1;
          for (let i = 0; i < bp.count; i++) {
            const x = base[i * 3], u = (x + 0.25) / 0.5;
            bp.setZ(i, Math.sin(t * 5.2 - u * 4.5) * 0.06 * u * health);
          }
          bp.needsUpdate = true;
          bannerGeo.computeVertexNormals();
          const pulse = 0.55 + 0.35 * Math.sin(t * 1.6) * health;
          ringMesh.material.opacity = pulse * (0.15 + 0.75 * health);
          ringMesh.material.color.setHex(dmg.state === 2 ? PALETTE.spore : PALETTE.magic);
          const heartPulse = (0.85 + 0.2 * Math.sin(t * 3)) * health;
          heart.scale.setScalar(0.1 * heartPulse);
          heart.material.color.setHex(PALETTE.magicGlow).multiplyScalar(0.5 + 0.5 * health);
          for (const s of stones) {
            const f = (0.8 + 0.2 * Math.sin(t * 6 + s.position.x)) * (0.15 + 0.85 * health);
            s.material.color.setHex(dmg.state === 2 ? PALETTE.spore : PALETTE.magic).multiplyScalar(f);
          }
          for (const s of shoots) s.rotation.z = Math.sin(t * 1.4 + s.position.x) * 0.06 * health;
          if (dmg.state >= 1) {
            dmg.smokeTimer -= dt;
            if (dmg.smokeTimer <= 0) {
              dmg.smokeTimer = dmg.state === 2 ? 0.1 : 0.5;
              puff(cx + (Math.random() - 0.5) * R, 0.3, cz + (Math.random() - 0.5) * R, { count: 1, color: PALETTE.spore, speed: 0.3, size: 0.12, up: 1.0, ttl: 1.4 });
            }
          }
        },
      });
    }

    function buildCountryside() {
      const rng = srand(5151);
      const swayTrees = [];
      const endC = level.endpoint.cells.map(([c]) => c), endR = level.endpoint.cells.map(([, r]) => r);
      const spawnAt = (c, r) => {
        const inGrid = GameState.inGrid(c, r);
        const h = GameState.zoneFalloff(c, r);
        const x = worldX(c) + (rng() - 0.5) * 0.5, z = worldZ(r) + (rng() - 0.5) * 0.5;
        const roll = rng();
        const put = ({ parts, radius }) => { for (const p of parts) batchPart(p, M(x, 0, z)); if (radius) batchDecal(x, z, radius); };
        const nearWard = c >= Math.min(...endC) - 2 && c <= Math.max(...endC) + 2 && r >= Math.min(...endR) - 2 && r <= Math.max(...endR) + 2;
        if (!inGrid) {
          if (roll < 0.35) put(deadTreeParts(rng));
          else if (roll < 0.5) put(rockParts(rng, true));
          return;
        }
        if (nearWard) {
          // the ward's small living foothold: normal moss and flowers, no blight
          if (roll < 0.4) put(tuftParts(rng));
          else if (roll < 0.62) put(flowerParts(rng));
          else if (roll < 0.72) put(mushroomParts(rng, false));
          return;
        }
        // overwhelmingly corrupted ground: dead trees, blighted rock and
        // spore growths dominate; only a rare living tuft survives
        const hidesTower = GameState.isBuildable(c, r - 1) || GameState.isBuildable(c - 1, r - 1);
        if (roll < 0.16 && !hidesTower) {
          const { parts, radius } = deadTreeParts(rng);
          if (swayTrees.length < 6) {
            const gp = liveProp(parts, x, 0, z, { ao: false });
            gp.userData.phase = rng() * 6.28;
            swayTrees.push(gp);
            decal(x, z, radius);
          } else put({ parts, radius });
        } else if (roll < 0.24) put(rockParts(rng, true));
        else if (roll < 0.36) put(mushroomParts(rng, rng() < 0.4));
        else if (roll < 0.44) {
          const { parts } = tuftParts(rng);
          for (const p of parts) batchPart(p, M(x, 0, z));
        } else if (h < 0.5 && roll < 0.5) {
          const { parts } = flowerParts(rng);
          for (const p of parts) batchPart(p, M(x, 0, z));
        } else if (roll < 0.58) put(rockParts(rng, false));
      };
      for (let r = -border; r < rows + border; r++) {
        for (let c = -border; c < cols + border; c++) {
          if (GameState.inGrid(c, r)) {
            const kind = GameState.cellKind(c, r);
            if (kind !== 'ground' || GameState.isBuildable(c, r) || GameState.isSpawn(c, r)) continue;
          } else {
            const [sr0, sr1] = level.chokepoint.streamRows;
            if (c === level.chokepoint.streamCol && r >= sr0 - border && r <= sr1 + border) continue;
          }
          spawnAt(c, r);
        }
      }
      animated.push({
        update(t) {
          for (const gp of swayTrees) {
            gp.rotation.z = Math.sin(t * 0.9 + gp.userData.phase) * 0.03;
            gp.rotation.x = Math.cos(t * 0.8 + gp.userData.phase) * 0.022;
          }
        },
      });
    }

    buildChasm();
    buildRootBridge();
    buildSpawn();
    buildElderroot();
    buildCountryside();
  }

  return {
    id: 'elderroot-ward',
    index: 5,
    name: 'The Elderroot Ward',
    subtitle: 'The Heart of the Hollow. Hold the Elderroot.',
    // overworld node: position in the world map's 800x320 viewBox, and how
    // much blight a win here clears around it
    map: { x: 92, y: 92, reclaim: 130, icon: 'elderroot' },
    grid: { cols: 19, rows: 15 },
    spawn: [0, 4],
    // a rectangular spiral: two coiling rings around an open plaza at the
    // center, where the Elderroot itself stands untouched by the road
    pathWaypoints: [[0, 4], [4, 4], [4, 12], [15, 12], [15, 2], [7, 2], [7, 5], [13, 5], [13, 9], [10, 9], [10, 8]],
    chokepoint: { cell: [2, 4], streamCol: 2, streamRows: [1, 8] },
    endpoint: {
      name: 'the Elderroot', properName: 'The Elderroot',
      cells: [[9, 6], [10, 6], [11, 6], [9, 7], [10, 7], [11, 7]], gateCell: [10, 7],
    },
    cobbleTailCells: 3,
    theme: {
      // the danger zone covers nearly the whole map (overwhelmingly
      // corrupted); `foothold` then carves the one clear patch back out
      // around the Elderroot, which a single radial falloff can't do on
      // its own since the ward sits inside the spiral, not at its edge.
      center: [0, 4], radiusOut: { x: 13, z: 9 }, radiusIn: 2.15, falloffWidth: 0.55,
      foothold: { center: [10, 6.5], radius: 1.6, falloffWidth: 1.1 },
      backdrop: 0x241f2c, groundMeadow: 0x5a9a6a, groundMeadowDark: 0x487a56, ambient: 0.30,
      sun: 0.5, fill: 0x9a86c8, fillIntensity: 0.18,
      motes: { spores: 42, embers: 14, fireflies: 8 },
    },
    spawnBlockedText: 'The Heart of the Hollow breaks open here. Nothing will stand on it.',
    waves, prepSeconds: 14, startGold: 160, startLives: 20, starThresholds: [16, 8],
    tipTile: [3, 3],
    endScreenText: {
      3: () => 'Fourteen waves, and the Shadow-Crow Swarm broken a second time. The Elderroot’s light burns steady. The Hollow is beaten.',
      2: (s) => `Fourteen waves turned back with ${s.lives} lives to spare. The Elderroot holds, and the Hollow’s heart goes dark.`,
      1: (s) => `Fourteen waves turned back with ${s.lives} lives left. The ward flickers, but it holds.`,
      lose: (s) => `The ward failed on wave ${s.wave}. Build where the coil turns, keep two towers on every stretch, and remember only Druids and Artillery reach the sky.`,
    },
    buildScene,
  };
})();
