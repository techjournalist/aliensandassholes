// ===================================================================
// LevelCommon — colony and alien set dressing shared by every level's
// buildScene(kit): the crashed alien landing pods at each road mouth, the
// colony's habs, greenhouses, silos, solar arrays, crop rows, rovers and
// supply crates, glass domes, a waving colony flag, a canal with glowing
// reeds, a filler-prop scatter and the endpoint damage overlay.
// Everything static goes through kit.batchPart, so a busy colony costs a
// handful of draw calls, not hundreds.
// ===================================================================
const LevelCommon = (() => {
  // a gabled roof running along local x: two slanted planes meeting at a
  // ridge, gable triangles filled in, seam lines across both slopes
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

  // A colony hab: a white drum under a domed roof, a teal band, a round
  // door, a warm porthole, a little antenna and a vent that puffs steam.
  function habParts(kit, rng, { r = 0.24 + rng() * 0.08, roof = rng() < 0.5 ? PALETTE.thatch : PALETTE.roofTile } = {}) {
    const { P, M, GEO, shade } = kit;
    const h = 0.28 + rng() * 0.1, door = rng() * 6.28;
    const parts = [
      P(GEO.cyl, PALETTE.plaster, M(0, h / 2, 0, { sx: r, sy: h, sz: r })),
      P(GEO.cyl, PALETTE.hullDark, M(0, 0.03, 0, { sx: r + 0.03, sy: 0.06, sz: r + 0.03 }), false),
      P(GEO.ring, PALETTE.tunic, M(0, h * 0.72, 0, { s: r * 1.01, rx: Math.PI / 2 }), false),
      P(GEO.dome, roof, M(0, h, 0, { sx: r * 1.02, sy: r * 0.7, sz: r * 1.02 })),
      P(GEO.ring, shade(roof, 0.25), M(0, h + r * 0.3, 0, { s: r * 0.82, rx: Math.PI / 2 }), false),
      P(GEO.box, PALETTE.timber, M(Math.sin(door) * r, 0.12, Math.cos(door) * r, { sx: 0.1, sy: 0.2, sz: 0.03, ry: door }), false),
      P(GEO.cyl, PALETTE.windowWarm, M(Math.sin(door + 1.2) * r * 1.0, h * 0.5, Math.cos(door + 1.2) * r * 1.0, { sx: 0.045, sy: 0.02, sz: 0.045, rx: Math.PI / 2, ry: door + 1.2 }), false, { unlit: true }),
      P(GEO.cyl, PALETTE.steel, M(-r * 0.4, h + r * 0.75, -r * 0.2, { sx: 0.01, sy: 0.2, sz: 0.01 }), false),
      P(GEO.bead, PALETTE.neon, M(-r * 0.4, h + r * 0.86, -r * 0.2, { s: 0.022 }), false, { unlit: true }),
      P(GEO.cyl, PALETTE.steelDark, M(r * 0.35, h + r * 0.55, r * 0.1, { sx: 0.035, sy: 0.12, sz: 0.035 }), false),
    ];
    return { parts, radius: r * 1.1, chimney: [r * 0.35, h + r * 0.65, r * 0.1] };
  }
  // A greenhouse: a long arched glass tunnel over rows of moonwheat, its
  // frame of white ribs, glass panes catching the light at each end.
  function greenhouseParts(kit, rng, { len = 0.7 + rng() * 0.3, ry = rng() < 0.5 ? 0 : Math.PI / 2 } = {}) {
    const { P, M, GEO } = kit;
    const c = Math.cos(ry), s = Math.sin(ry), r = 0.22;
    const at = (x, y, z, o = {}) => M(x * c + z * s, y, -x * s + z * c, { ...o, ry: (o.ry || 0) + ry });
    const parts = [P(GEO.box, PALETTE.hullDark, at(0, 0.02, 0, { sx: len + 0.06, sy: 0.04, sz: r * 2 + 0.06 }), false)];
    for (let i = 0; i < 3; i++) parts.push(P(GEO.box, i === 1 ? PALETTE.meadowLight : PALETTE.straw, at(0, 0.07, (i - 1) * 0.12, { sx: len - 0.06, sy: 0.07, sz: 0.06 }), false));
    const n = Math.max(3, Math.round(len / 0.18));
    for (let i = 0; i < n; i++) {
      const u = -len / 2 + (i / (n - 1)) * len;
      parts.push(P(GEO.torus, PALETTE.plaster, at(u, 0.03, 0, { sx: r, sy: r * 1.1, sz: 0.3, ry: Math.PI / 2 }), false));
    }
    parts.push(P(GEO.box, PALETTE.plaster, at(0, r * 1.12, 0, { sx: len, sy: 0.025, sz: 0.04 }), false));
    for (const e of [-1, 1]) parts.push(P(GEO.dome, PALETTE.glass, at(e * len / 2, 0.03, 0, { sx: 0.02, sy: r * 1.08, sz: r, rz: 0 }), false, { unlit: true }));
    // a few glass panes on the arch, so it reads as glass and not a cage
    for (let i = 0; i < n - 1; i += 2) {
      const u = -len / 2 + ((i + 0.5) / (n - 1)) * len;
      parts.push(P(GEO.box, PALETTE.glass, at(u, r * 0.92, r * 0.42, { sx: len / (n - 1) * 0.9, sy: 0.01, sz: r * 0.6, rx: -0.75 }), false, { unlit: true }));
    }
    return { parts, radius: Math.max(len, r * 2) * 0.55 };
  }
  // A solar array: a tilted panel of blue cells on a post, its frame white.
  function solarParts(kit, rng) {
    const { P, M, GEO } = kit;
    const ry = rng() * 0.6 - 0.3 + Math.PI, parts = [];
    parts.push(P(GEO.cyl, PALETTE.steelDark, M(0, 0.12, 0, { sx: 0.025, sy: 0.24, sz: 0.025 }), false));
    const tilt = { rx: -0.6, ry };
    parts.push(P(GEO.box, PALETTE.plaster, M(0, 0.27, 0, { sx: 0.5, sy: 0.025, sz: 0.3, ...tilt })));
    parts.push(P(GEO.box, PALETTE.solar, M(0, 0.285, 0, { sx: 0.46, sy: 0.01, sz: 0.26, ...tilt }), false));
    for (const u of [-0.115, 0, 0.115]) parts.push(P(GEO.box, PALETTE.slate, M(Math.cos(ry) * u, 0.29, -Math.sin(ry) * u, { sx: 0.01, sy: 0.012, sz: 0.26, ...tilt }), false));
    return { parts, radius: 0.22 };
  }
  // A grain silo: a tall drum with a domed cap, hazard band and a ladder.
  function siloParts(kit, rng) {
    const { P, M, GEO } = kit;
    const h = 0.7 + rng() * 0.3, r = 0.16 + rng() * 0.04;
    return { parts: [
      P(GEO.cyl, PALETTE.hull, M(0, h / 2, 0, { sx: r, sy: h, sz: r })),
      P(GEO.dome, PALETTE.tunic, M(0, h, 0, { sx: r, sy: r * 0.8, sz: r })),
      P(GEO.ring, PALETTE.hazard, M(0, h * 0.3, 0, { s: r * 1.01, rx: Math.PI / 2 }), false),
      P(GEO.box, PALETTE.steelDark, M(0, h / 2, r + 0.01, { sx: 0.05, sy: h, sz: 0.01 }), false),
      P(GEO.bead, PALETTE.capRed, M(0, h + r * 0.8, 0, { s: 0.025 }), false, { unlit: true }),
    ], radius: r * 1.2 };
  }
  // A radio mast: a slim lattice of struts, a dish and a blinking tip.
  function antennaParts(kit, rng) {
    const { P, M, GEO } = kit;
    const h = 0.9 + rng() * 0.4;
    const parts = [];
    for (let i = 0; i < 3; i++) { const a = i * 2.09; parts.push(P(GEO.cyl, PALETTE.steel, M(Math.cos(a) * 0.06, h / 2, Math.sin(a) * 0.06, { sx: 0.012, sy: h, sz: 0.012 }), false)); }
    for (let y = 0.2; y < h; y += 0.25) parts.push(P(GEO.ring, PALETTE.steelDark, M(0, y, 0, { s: 0.07, rx: Math.PI / 2 }), false));
    parts.push(P(GEO.cylTaper, PALETTE.hull, M(0.06, h * 0.7, 0.08, { sx: 0.12, sy: 0.04, sz: 0.12, rx: 1.0, ry: rng() * 6 })));
    parts.push(P(GEO.bead, PALETTE.capRed, M(0, h + 0.03, 0, { s: 0.03 }), false, { unlit: true }));
    return { parts, radius: 0.1 };
  }
  // A moss shrub with glowing berries.
  function bushParts(kit, rng) {
    const { P, M, GEO } = kit;
    const s = 0.14 + rng() * 0.1;
    const parts = [
      P(GEO.sphereLo, PALETTE.meadowDark, M(0, s * 0.8, 0, { sx: s * 1.4, sy: s, sz: s * 1.2 })),
      P(GEO.sphereLo, PALETTE.meadow, M(s * 0.5, s * 1.1, s * 0.2, { s: s * 0.7 })),
    ];
    if (rng() < 0.6) for (let i = 0; i < 3; i++) parts.push(P(GEO.bead, rng() < 0.5 ? PALETTE.flowerPink : PALETTE.crystalTeal, M((rng() - 0.5) * s * 2, s * (0.9 + rng() * 0.6), s * 0.9, { s: 0.03 }), false, { unlit: true }));
    return { parts, radius: s * 1.2 };
  }
  // A run of low colony fence: white posts with a light on top and a cable between.
  function fenceParts(kit, rng, len = 0.8, ry = rng() < 0.5 ? 0 : Math.PI / 2) {
    const { P, M, GEO } = kit;
    const parts = [];
    const n = Math.max(2, Math.round(len / 0.3));
    for (let i = 0; i < n; i++) {
      const u = -len / 2 + (i / (n - 1)) * len;
      parts.push(P(GEO.box, PALETTE.hull, M(Math.cos(ry) * u, 0.12, -Math.sin(ry) * u, { sx: 0.04, sy: 0.24, sz: 0.04, ry })));
      parts.push(P(GEO.bead, PALETTE.neon, M(Math.cos(ry) * u, 0.25, -Math.sin(ry) * u, { s: 0.022 }), false, { unlit: true }));
    }
    parts.push(P(GEO.box, PALETTE.steelDark, M(0, 0.18, 0, { sx: len, sy: 0.012, sz: 0.012, ry }), false));
    return { parts, radius: 0 };
  }
  // Supply crates and a canister.
  function crateParts(kit, rng) {
    const { P, M, GEO } = kit;
    const parts = [
      P(GEO.cyl, PALETTE.hull, M(0, 0.12, 0, { sx: 0.08, sy: 0.24, sz: 0.08 })),
      P(GEO.ring, PALETTE.hazard, M(0, 0.17, 0, { s: 0.082, rx: Math.PI / 2 }), false),
      P(GEO.dome, PALETTE.steelDark, M(0, 0.24, 0, { sx: 0.08, sy: 0.03, sz: 0.08 }), false),
    ];
    if (rng() < 0.7) {
      const ry = rng() * 2;
      parts.push(P(GEO.box, PALETTE.tunic, M(0.17, 0.08, 0.04, { sx: 0.16, sy: 0.16, sz: 0.16, ry })));
      parts.push(P(GEO.box, PALETTE.plaster, M(0.17, 0.08, 0.04, { sx: 0.165, sy: 0.04, sz: 0.165, ry }), false));
    }
    return { parts, radius: 0.16 };
  }
  // A six-wheeled farm rover with a cargo bed (or a wreck, rolled in the goo).
  function roverParts(kit, rng, broken = false) {
    const { P, M, GEO } = kit;
    const ry = rng() * 6, c = Math.cos(ry), s = Math.sin(ry);
    const at = (x, y, z, o) => M(x * c + z * s, y, -x * s + z * c, { ...o, ry: (o.ry || 0) + ry });
    const body = broken ? PALETTE.hollowWood : PALETTE.hull;
    const tilt = broken ? 0.5 : 0;
    const parts = [
      P(GEO.box, body, at(0, 0.18, 0, { sx: 0.5, sy: 0.1, sz: 0.28, rz: tilt })),
      P(GEO.box, broken ? PALETTE.hollowEarth : PALETTE.tunic, at(0.15, 0.27, 0, { sx: 0.16, sy: 0.12, sz: 0.24, rz: tilt })),
      P(GEO.box, PALETTE.glass, at(0.235, 0.28, 0, { sx: 0.01, sy: 0.07, sz: 0.18, rz: tilt }), false, { unlit: !broken }),
    ];
    for (const u of [-0.17, 0, 0.17]) for (const v of [-1, 1]) {
      if (broken && v > 0 && u > 0) continue;
      parts.push(P(GEO.cyl, PALETTE.outline, at(u, 0.08, v * 0.16, { sx: 0.07, sy: 0.05, sz: 0.07, rx: Math.PI / 2 }), false));
    }
    if (!broken && rng() < 0.6) parts.push(P(GEO.dome, PALETTE.straw, at(-0.1, 0.23, 0, { sx: 0.15, sy: 0.1, sz: 0.11 })));
    if (broken) parts.push(P(GEO.bead, PALETTE.spore, at(0, 0.3, 0.1, { s: 0.04 }), false, { unlit: true }));
    return { parts, radius: 0.3 };
  }
  // where a pod burst: a cracked shell in a little goo puddle
  function stumpParts(kit, rng) {
    const { P, M, GEO } = kit;
    const s = 0.1 + rng() * 0.06;
    return { parts: [
      P(GEO.circle, PALETTE.hollowEarth, M(0, 0.006, 0, { s: s * 2.2 }), false),
      P(GEO.dome, PALETTE.hollowWood, M(0, 0, 0, { sx: s * 1.1, sy: s * 1.3, sz: s * 1.1 })),
      P(GEO.cone, PALETTE.hollowRock, M(s * 0.5, s * 1.2, 0, { sx: s * 0.3, sy: s * 0.6, sz: s * 0.2, rz: -0.4 }), false),
      P(GEO.cyl, PALETTE.spore, M(0, s * 1.1, 0, { sx: s * 0.7, sy: 0.01, sz: s * 0.7 }), false, { unlit: true }),
    ], radius: s * 1.2 };
  }
  // A water pump: a squat housing over a wellhead, a pipe and a glowing gauge.
  function pumpParts(kit) {
    const { P, M, GEO } = kit;
    return { parts: [
      P(GEO.cyl, PALETTE.hull, M(0, 0.12, 0, { sx: 0.17, sy: 0.24, sz: 0.17 })),
      P(GEO.cyl, PALETTE.water, M(0, 0.245, 0, { sx: 0.13, sy: 0.01, sz: 0.13 }), false, { unlit: true }),
      P(GEO.box, PALETTE.hullDark, M(0.16, 0.36, 0, { sx: 0.1, sy: 0.22, sz: 0.12 })),
      P(GEO.cyl, PALETTE.steelDark, M(-0.12, 0.3, 0.04, { sx: 0.03, sy: 0.3, sz: 0.03, rz: 0.8 }), false),
      P(GEO.bead, PALETTE.neon, M(0.215, 0.4, 0, { s: 0.025 }), false, { unlit: true }),
    ], radius: 0.22 };
  }
  // An old crater: a low raised rim round a darker floor (lies flat, never hides a tower).
  function craterParts(kit, rng) {
    const { P, M, GEO, shade } = kit;
    const r = 0.22 + rng() * 0.18;
    return { parts: [
      P(GEO.circle, shade(PALETTE.meadowDark, 0.35), M(0, 0.007, 0, { s: r * 0.86 }), false),
      P(GEO.torus, PALETTE.stoneDark, M(0, 0.012, 0, { sx: r, sy: r, sz: 0.5, rx: Math.PI / 2 }), false),
      P(GEO.rock, PALETTE.stone, M(r * 0.8, 0.03, -r * 0.3, { s: 0.05 }), false),
    ], radius: 0 };
  }

  // A colony flag that waves on its own and droops as the endpoint takes
  // damage. Returns the mesh; `stateRef.state` (0-2) drives the droop.
  function banner(kit, x, y, z, { w = 0.6, h = 0.36, field = PALETTE.tunic, stripe = PALETTE.plaster, emblem, tattered = 0, stateRef = { state: 0 }, phase = 0 } = {}) {
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

  // A glass dome: a see-through shell (one transparent mesh), white ribs and
  // a base ring through the batch. Whatever is built under it stays visible.
  function glassDome(kit, x, y, z, r, { ribs = 6, h = r * 0.85, tint = PALETTE.glass, opacity = 0.26 } = {}) {
    const { P, M, GEO, batchPart, scene } = kit;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity, depthWrite: false }));
    mesh.position.set(x, y, z); mesh.scale.set(r, h, r); mesh.renderOrder = 2; mesh.name = 'dome';
    scene.add(mesh);
    // a bright rim of light along the dome's edge, facing the sun
    const shine = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0.6, 1.4, 0.15, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }));
    shine.position.set(x, y, z); shine.scale.set(r * 1.005, h * 1.005, r * 1.005); shine.renderOrder = 2;
    scene.add(shine);
    batchPart(P(GEO.torus, PALETTE.hullDark, M(x, y + 0.02, z, { sx: r, sy: r, sz: 0.6, rx: Math.PI / 2 }), false));
    for (let i = 0; i < ribs; i++) {
      const a = (i / ribs) * Math.PI;
      batchPart(P(GEO.ring, PALETTE.plaster, M(x, y, z, { sx: r * 1.003, sy: h * 1.003, sz: r * 1.003, ry: a }), false));
    }
    batchPart(P(GEO.ring, PALETTE.plaster, M(x, y + h * 0.55, z, { sx: r * 0.84, sy: r * 0.84, sz: r * 0.84, rx: Math.PI / 2 }), false));
    return mesh;
  }
  // Rows of moonwheat and leafy greens in a rectangle (centered, local frame `wm`).
  function cropRows(kit, wm, { x = 0, z = 0, w, d, rows = 4, ry = 0 }) {
    const { P, M, GEO, batchPart } = kit;
    const c = Math.cos(ry), s = Math.sin(ry);
    const at = (u, y, v, o) => M(x + u * c + v * s, y, z - u * s + v * c, { ...o, ry });
    batchPart(P(GEO.box, PALETTE.earth, at(0, 0.006, 0, { sx: w, sy: 0.012, sz: d }), false), wm);
    for (let i = 0; i < rows; i++) {
      const v = -d / 2 + (i + 0.5) * (d / rows);
      batchPart(P(GEO.box, i % 2 ? PALETTE.meadowLight : PALETTE.straw, at(0, 0.05, v, { sx: w * 0.92, sy: 0.08, sz: d / rows * 0.5 }), false), wm);
      if (i % 2 === 0) for (let k = 0; k < 3; k++) batchPart(P(GEO.bead, PALETTE.flowerYellow, at(-w * 0.3 + k * w * 0.3, 0.1, v, { s: 0.025 }), false, { unlit: true }), wm);
    }
  }
  // A terraformer stack: a tall drum with glowing vents, a spinning ring of
  // fans near the top and a beacon. Returns the live ring for levels that
  // want to slow or stop it as the endpoint takes damage.
  function terraformerTower(kit, x, z, { h = 2.0, r = 0.26, stateRef = { state: 0 }, color = PALETTE.hull } = {}) {
    const { P, M, GEO, batchPart, liveProp, animated, glow } = kit;
    batchPart(P(GEO.cylTaper, color, M(x, h / 2, z, { sx: r, sy: h, sz: r })));
    batchPart(P(GEO.cyl, PALETTE.hullDark, M(x, 0.08, z, { sx: r * 1.5, sy: 0.16, sz: r * 1.5 })));
    for (const y of [h * 0.3, h * 0.55]) batchPart(P(GEO.ring, PALETTE.tunic, M(x, y, z, { s: r * 0.86, rx: Math.PI / 2 }), false));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      batchPart(P(GEO.box, PALETTE.neon, M(x + Math.sin(a) * r * 0.82, h * 0.42, z + Math.cos(a) * r * 0.82, { sx: 0.05, sy: 0.22, sz: 0.01, ry: a }), false, { unlit: true }));
    }
    batchPart(P(GEO.cyl, PALETTE.steelDark, M(x, h + 0.04, z, { sx: r * 0.6, sy: 0.08, sz: r * 0.6 })));
    batchPart(P(GEO.cone, PALETTE.steel, M(x, h + 0.3, z, { sx: 0.03, sy: 0.4, sz: 0.03 })));
    batchPart(P(GEO.bead, PALETTE.capRed, M(x, h + 0.5, z, { s: 0.04 }), false, { unlit: true }));
    glow(x, h + 0.5, z, { w: 0.5, h: 0.5 });
    // the fan ring: four blades on a hub, turning
    const blades = [P(GEO.torus, PALETTE.steel, M(0, 0, 0, { s: r * 1.6, rx: Math.PI / 2 })), P(GEO.cyl, PALETTE.hullDark, M(0, 0, 0, { sx: r * 0.9, sy: 0.08, sz: r * 0.9 }))];
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; blades.push(P(GEO.box, PALETTE.plaster, M(Math.cos(a) * r * 1.2, 0, Math.sin(a) * r * 1.2, { sx: r * 0.8, sy: 0.02, sz: 0.1, ry: -a, rx: 0.4 }))); }
    const ring = liveProp(blades, x, h * 0.8, z);
    let spin = 0;
    animated.push({ update(t, dt) { spin += dt * (stateRef.state === 2 ? 0.25 : stateRef.state === 1 ? 1.2 : 2.4); ring.rotation.y = spin; } });
    return ring;
  }

  // The invaders' landing pod at every road mouth: a cracked violet egg of
  // a capsule half sunk in a pool of goo, its shell lid thrown aside, a
  // blinking aerial, a tattered alien banner and a goo geyser that bubbles
  // and puffs, so each entry reads at a glance as where the invaders come from.
  function alienPods(kit) {
    const { P, M, GEO, batchPart, batchDecal, srand, worldX, worldZ, scene, animated } = kit;
    GameState.routes.forEach((rt, n) => {
      const rng = srand(613 + n * 7);
      const [sc, sr] = rt.cells[0], [nc, nr] = rt.cells[1];
      const dx = nc - sc, dz = nr - sr;   // the road leaves the pod this way
      const x = worldX(sc) - dx * 0.6, z = worldZ(sr) - dz * 0.6;
      const sx = -dz, sz = dx;   // sideways, along the map edge
      batchPart(P(GEO.circle, PALETTE.hollowEarth, M(x, 0.006, z, { s: 0.95 }), false));
      batchPart(P(GEO.circle, PALETTE.gooDark, M(x - dx * 0.3, 0.009, z - dz * 0.3, { sx: 0.5, sy: 1, sz: 0.4 }), false));
      // the pod itself, off to one side of the road
      const tx = x + sx * 0.72 - dx * 0.35, tz = z + sz * 0.72 - dz * 0.35;
      batchPart(P(GEO.sphereMid, PALETTE.baron, M(tx, 0.32, tz, { sx: 0.32, sy: 0.42, sz: 0.32, rz: 0.15 })));
      batchPart(P(GEO.ring, PALETTE.baronRed, M(tx, 0.34, tz, { s: 0.325, rx: Math.PI / 2 + 0.15 }), false, { unlit: true }));
      batchPart(P(GEO.box, PALETTE.spore, M(tx + dx * 0.3, 0.3, tz + dz * 0.3, { sx: 0.12, sy: 0.16, sz: 0.12, ry: Math.atan2(dx, dz) }), false, { unlit: true }));
      batchPart(P(GEO.dome, PALETTE.hollowWood, M(tx - sx * 0.35 + dx * 0.15, 0.04, tz - sz * 0.35 + dz * 0.15, { sx: 0.22, sy: 0.14, sz: 0.22, rx: 2.6 })));
      for (let i = 0; i < 3; i++) {
        const a = rng() * 6.28;
        batchPart(P(GEO.cone, PALETTE.hollowRock, M(tx + Math.cos(a) * 0.36, 0.06, tz + Math.sin(a) * 0.36, { sx: 0.05, sy: 0.14, sz: 0.05, rz: Math.cos(a) * 0.6, rx: -Math.sin(a) * 0.6 }), false));
      }
      batchDecal(tx, tz, 0.4);
      // the blinking aerial on top of the pod
      batchPart(P(GEO.cyl, PALETTE.steelDark, M(tx, 0.85, tz, { sx: 0.012, sy: 0.3, sz: 0.012 }), false));
      const tipMat = new THREE.MeshBasicMaterial({ color: PALETTE.spore });
      const tip = new THREE.Mesh(GEO.sphereLo, tipMat);
      tip.position.set(tx, 1.02, tz); tip.scale.setScalar(0.045);
      scene.add(tip);
      // the tattered banner
      const bx = x - sx * 0.6 - dx * 0.5, bz = z - sz * 0.6 - dz * 0.5;
      batchPart(P(GEO.cyl, PALETTE.hollowWood, M(bx, 0.6, bz, { sx: 0.022, sy: 1.2, sz: 0.022 })));
      batchPart(P(GEO.sphereLo, PALETTE.spore, M(bx, 1.22, bz, { s: 0.04 }), false, { unlit: true }));
      banner(kit, bx, 1.0, bz, { w: 0.42, h: 0.28, field: PALETTE.baron, stripe: PALETTE.baronRed, emblem: PALETTE.baronRed, tattered: 0.25, phase: n * 1.7 });
      // a goo geyser: a ring of crusted rocks round a glowing pool that puffs
      const fx = x + sx * 0.45 - dx * 0.75, fz = z + sz * 0.45 - dz * 0.75;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        batchPart(P(GEO.rock, PALETTE.hollowRock, M(fx + Math.cos(a) * 0.14, 0.03, fz + Math.sin(a) * 0.14, { s: 0.045 }), false));
      }
      const pool = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.spore, transparent: true, opacity: 0.9 }));
      pool.position.set(fx, 0.04, fz); pool.scale.set(0.11, 0.05, 0.11);
      scene.add(pool);
      kit.glow(fx, 0.15, fz, { w: 0.7, h: 0.7 });
      let bubble = rng();
      animated.push({
        update(t, dt) {
          const k = 0.8 + 0.2 * Math.sin(t * 6 + n) * Math.sin(t * 2.7 + n * 2);
          pool.scale.set(0.11 * (2 - k), 0.05 + 0.04 * k, 0.11 * (2 - k));
          tipMat.color.setHex(Math.sin(t * 4 + n) > 0.2 ? PALETTE.spore : PALETTE.gooDark);
          bubble -= dt;
          if (bubble <= 0) { bubble = 0.35 + Math.random() * 0.3; kit.puff(fx, 0.15, fz, { count: 1, color: Math.random() < 0.7 ? PALETTE.spore : PALETTE.crystal, speed: 0.1, size: 0.1, up: 0.9, ttl: 1.4 }); }
        },
      });
    });
  }

  // Filler props over every free ground cell. `mix` is a list of
  // [weight, recipe] for open in-grid ground; `edge` for the framing ring
  // outside the grid; goo-crusted cells (falloff > 0.45) get withered
  // stalks, crusted rocks, burst pods and wrecked rovers. `keepLow(c, r)`
  // marks cells near the endpoint where only low props may go, so its
  // skyline stays clear.
  function countryside(kit, { seed, mix, edge, keepLow = () => false, sway = 8 }) {
    const { M, batchPart, batchDecal, liveProp, decal, srand, worldX, worldZ, cols, rows, border, level, animated } = kit;
    const rng = srand(seed);
    const swayTrees = [];
    const mouths = GameState.routes.map((rt) => rt.cells[0]);
    const R = {
      tree: () => kit.treeParts(rng), bush: () => bushParts(kit, rng), tuft: () => kit.tuftParts(rng),
      flower: () => kit.flowerParts(rng), rock: () => kit.rockParts(rng, false), hay: () => kit.hayParts(rng),
      fence: () => fenceParts(kit, rng), barrel: () => crateParts(kit, rng), cart: () => roverParts(kit, rng),
      cottage: () => habParts(kit, rng), mushroom: () => kit.mushroomParts(rng, false), well: () => pumpParts(kit),
      crystal: () => kit.crystalParts(rng, false), solar: () => solarParts(kit, rng), crater: () => craterParts(kit, rng),
      silo: () => siloParts(kit, rng), greenhouse: () => greenhouseParts(kit, rng), antenna: () => antennaParts(kit, rng),
      bigshroom: () => kit.mushroomParts(rng, true),
      ...(kit.extraRecipes ? kit.extraRecipes(rng) : {}),
    };
    const TALL = new Set(['tree', 'cottage', 'silo', 'greenhouse', 'antenna', 'bigshroom', 'crystal']);
    const pick = (list) => {
      let roll = rng() * list.reduce((a, [w]) => a + w, 0);
      for (const [w, name] of list) { roll -= w; if (roll <= 0) return name; }
      return null;
    };
    const vents = [];
    for (let r = -border; r < rows + border; r++) {
      for (let c = -border; c < cols + border; c++) {
        const inGrid = GameState.inGrid(c, r);
        if (inGrid) {
          if (GameState.cellKind(c, r) !== 'ground' || GameState.isBuildable(c, r) || GameState.isSpawn(c, r)) continue;
        } else if (c === level.chokepoint.streamCol) continue;
        // leave room for the landing pods around every road mouth
        if (mouths.some(([mc, mr]) => Math.max(Math.abs(c - mc), Math.abs(r - mr)) <= (inGrid ? 1 : 2))) continue;
        const h = GameState.zoneFalloff(c, r);
        const x = worldX(c) + (rng() - 0.5) * 0.5, z = worldZ(r) + (rng() - 0.5) * 0.5;
        const put = ({ parts, radius }) => { for (const p of parts) batchPart(p, M(x, 0, z)); if (radius) batchDecal(x, z, radius); };
        if (h > 0.45) {
          const roll = rng();
          if (roll < 0.26) put(kit.deadTreeParts(rng));
          else if (roll < 0.46) put(kit.rockParts(rng, true));
          else if (roll < 0.6) put(stumpParts(kit, rng));
          else if (roll < 0.66) put(roverParts(kit, rng, true));
          continue;
        }
        let list = inGrid ? mix : edge;
        if (inGrid && keepLow(c, r)) list = [[3, 'tuft'], [2, 'flower'], [1, 'barrel'], [1, 'crater'], [4, null]];
        // never stand a tall prop right in front of a build plot (it would hide the tower)
        const hides = inGrid && (GameState.isBuildable(c, r - 1) || GameState.isBuildable(c - 1, r - 1));
        let name = pick(list);
        if (hides && TALL.has(name)) name = 'bush';
        if (!name || !R[name]) continue;
        const made = R[name]();
        if (name === 'tree' && swayTrees.length < sway) {
          const gp = liveProp(made.parts, x, 0, z);
          gp.userData.phase = rng() * 6.28;
          swayTrees.push(gp);
          decal(x, z, made.radius);
        } else put(made);
        if (made.chimney && vents.length < 6) vents.push([x + made.chimney[0], made.chimney[1], z + made.chimney[2]]);
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
    chimneySmoke(kit, vents);
  }
  // steam from hab vents and stacks: soft lilac puffs drifting up
  function chimneySmoke(kit, spots) {
    if (!spots.length) return;
    const timers = spots.map(() => Math.random());
    kit.animated.push({
      update(t, dt) {
        spots.forEach(([x, y, z], i) => {
          timers[i] -= dt;
          if (timers[i] <= 0) { timers[i] = 0.9 + Math.random() * 0.6; kit.puff(x, y, z, { count: 1, color: 0xe4def4, speed: 0.08, size: 0.09, up: 0.6, ttl: 1.8 }); }
        });
      },
    });
  }

  // A canal down the level's chokepoint column (or whatever runs there:
  // goo, coolant, meltwater, quicksand), with bank stones and glowing reeds
  // kept clear of the crossing.
  function stream(kit, { seed = 21, speed, stripe, shallow, deep, foam, foamAmt, reeds = true, rock = PALETTE.stone } = {}) {
    const { P, M, GEO, batchPart, srand, worldX, worldZ, rows, border, level } = kit;
    const x = worldX(level.chokepoint.streamCol), length = rows + border * 2;
    kit.water({ x, length, speed, stripe, shallow, deep, foam, foamAmt });
    const rng = srand(seed);
    for (let i = 0; i < 22; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const z = -length / 2 + 0.3 + rng() * (length - 0.6);
      if (Math.abs(z - worldZ(level.chokepoint.cell[1])) < 0.9) continue;
      const s = 0.06 + rng() * 0.07;
      batchPart(P(GEO.rock, rock, M(x + side * (0.5 + s * 0.6), -0.02, z, { sx: s * 1.4, sy: s, sz: s, ry: rng() * 3 }), false));
      if (reeds && rng() < 0.5) for (let k = 0; k < 3; k++) {
        const rx = x + side * (0.42 + rng() * 0.08), rz = z + (rng() - 0.5) * 0.2, h = 0.24 + rng() * 0.1;
        batchPart(P(GEO.cyl, PALETTE.meadowDark, M(rx, 0.06, rz, { sx: 0.012, sy: h, sz: 0.012, rz: side * 0.15 }), false));
        if (k === 0) batchPart(P(GEO.bead, PALETTE.crystalTeal, M(rx - side * h * 0.07, 0.06 + h / 2, rz, { s: 0.022 }), false, { unlit: true }));
      }
    }
  }

  // Endpoint damage overlay: cracks at state 1, debris, fire and heavy
  // smoke at state 2, a camera thump and a dust burst on every change.
  // `cracks` [[x, y, z, w, h, axis]], `rubble` [[x, z]], `fire` [x, y, z],
  // `smoke` [x, y, z], `burst` [x, y, z]; all in world space.
  function damage(kit, { cracks = [], rubble = [], fire, smoke, burst, stateRef, onState }) {
    const { GEO, scene, animated, toon, unlit, addOutline, puff, setGlow, shakeCamera } = kit;
    const dmg = { cracks: new THREE.Group(), rubble: new THREE.Group(), smokeTimer: 0 };
    cracks.forEach(([x, y, z, w, h, axis], i) => {
      const c = new THREE.Mesh(GEO.box, unlit(0x1d1530));
      c.position.set(x, y, z);
      if (axis === 'x') c.scale.set(0.05, h, w); else c.scale.set(w, h, 0.05);
      c.rotation[axis === 'x' ? 'x' : 'z'] = i % 2 ? 0.5 : -0.4;
      dmg.cracks.add(c);
    });
    rubble.forEach(([x, z], i) => {
      const r = new THREE.Mesh(i % 3 === 2 ? GEO.box : GEO.rock, toon(i % 2 ? PALETTE.hullDark : PALETTE.hull));
      r.position.set(x, 0.07, z); r.scale.set(0.18, 0.1, 0.15); r.rotation.y = i * 1.3; r.rotation.z = i * 0.4;
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
      puff(burst[0], burst[1], burst[2], { count: 16, color: PALETTE.hull, speed: 2, size: 0.12, up: 1.6, ttl: 0.8 });
      if (onState) onState(st);
    });
    animated.push({
      update(t, dt) {
        if (stateRef.state < 1) return;
        dmg.smokeTimer -= dt;
        if (dmg.smokeTimer <= 0) {
          const heavy = stateRef.state === 2;
          dmg.smokeTimer = heavy ? 0.07 : 0.4;
          puff(smoke[0] + Math.random() * 0.5 - 0.25, smoke[1], smoke[2], { count: 1, color: heavy ? 0x2e2640 : 0x8a84a0, speed: 0.15, size: heavy ? 0.26 : 0.16, up: heavy ? 1.3 : 0.9, ttl: heavy ? 2.2 : 1.6 });
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

  // A round airlock door set in a wall facing the road (+z), with a lit
  // frame, a hazard step and two lamps; `gx` is its x, `gz` its z.
  function airlock(kit, wm, origin, gx, gz, { y = 0, w = 0.44, h = 0.56 } = {}) {
    const { P, M, GEO, batchPart, glow } = kit;
    batchPart(P(GEO.box, PALETTE.hullDark, M(gx, y + h / 2, gz, { sx: w + 0.12, sy: h + 0.08, sz: 0.06 }), false), wm);
    batchPart(P(GEO.box, PALETTE.timber, M(gx, y + h / 2 - 0.02, gz + 0.025, { sx: w, sy: h - 0.04, sz: 0.03 }), false), wm);
    batchPart(P(GEO.box, PALETTE.hull, M(gx - w / 4, y + h / 2 - 0.02, gz + 0.04, { sx: w / 2 - 0.02, sy: h - 0.08, sz: 0.02 }), false), wm);
    batchPart(P(GEO.box, PALETTE.hull, M(gx + w / 4, y + h / 2 - 0.02, gz + 0.04, { sx: w / 2 - 0.02, sy: h - 0.08, sz: 0.02 }), false), wm);
    batchPart(P(GEO.box, PALETTE.neon, M(gx, y + h + 0.02, gz + 0.04, { sx: w, sy: 0.03, sz: 0.01 }), false, { unlit: true }), wm);
    batchPart(P(GEO.box, PALETTE.hazard, M(gx, y + 0.03, gz + 0.16, { sx: w + 0.3, sy: 0.06, sz: 0.24 })), wm);
    for (const lx of [gx - w / 2 - 0.12, gx + w / 2 + 0.12]) {
      batchPart(P(GEO.box, PALETTE.steelDark, M(lx, y + h * 0.8, gz + 0.05, { sx: 0.08, sy: 0.1, sz: 0.08 })), wm);
      batchPart(P(GEO.box, PALETTE.windowWarm, M(lx, y + h * 0.8, gz + 0.095, { sx: 0.05, sy: 0.06, sz: 0.01 }), false, { unlit: true }), wm);
      glow(origin[0] + lx, y + h * 0.8, origin[1] + gz + 0.12, { w: 0.45, h: 0.45 });
    }
  }


  // ---- shared level kit: what runs down the chokepoint column, the bridge
  // over it and the colony outpost at the end of the road. Each level picks
  // its own style of each, so no two levels share a crossing or an endpoint.
  const STREAMS = {
    canal:     {},
    goo:       { shallow: 0x9dff4a, deep: 0x4c9a24, foam: 0xe8ffc8, speed: 0.35, stripe: 0.8 },
    chasm:     { shallow: 0x3a2a66, deep: 0x160f2c, foam: 0xb45cff, speed: 0.15, stripe: 0.9, foamAmt: 0.25, reeds: false, rock: PALETTE.stoneDark },
    coolant:   { shallow: 0x7af6ff, deep: 0x2a8ac8, foam: 0xffffff, speed: 1.0 },
    quicksand: { shallow: 0xe4c08a, deep: 0xb88c5a, foam: 0xf6e4c0, speed: 0.12, stripe: 0.9, foamAmt: 0.2, reeds: false, rock: PALETTE.sandDark },
    meltwater: { shallow: 0xbff0ff, deep: 0x5ab0e0, foam: 0xffffff, speed: 0.6, reeds: false, rock: PALETTE.ice },
    plasma:    { shallow: 0xff4fd0, deep: 0x8a1a8a, foam: 0xffd0f4, speed: 0.5, reeds: false, rock: PALETTE.hollowRock },
  };
  function channel(kit, kind) { stream(kit, { ...(STREAMS[kind] || {}) }); }

  function bridge(kit, style) {
    const { P, M, GEO, batchPart, worldX, worldZ, level, liveProp, animated, scene, glow } = kit;
    const [bc, br] = level.chokepoint.cell;
    const x = worldX(bc), z = worldZ(br), wm = M(x, 0, z);
    const deck = { girder: PALETTE.steelDark, log: PALETTE.cream, span: PALETTE.hullDark, pipe: PALETTE.steel, mono: PALETTE.hull, ice: PALETTE.ice, aqueduct: PALETTE.stone, gantry: PALETTE.slate, force: PALETTE.hullDark }[style] || PALETTE.hullDark;
    batchPart(P(GEO.box, deck, M(0, 0, 0, { sx: 1.16, sy: 0.08, sz: 0.84 })), wm);
    const rail = (col, y = 0.2, lights = true) => {
      for (const sd of [-1, 1]) {
        batchPart(P(GEO.box, col, M(0, y, sd * 0.42, { sx: 1.16, sy: 0.03, sz: 0.03 })), wm);
        for (let i = 0; i < 4; i++) {
          const u = -0.54 + i * 0.36;
          batchPart(P(GEO.box, col, M(u, y / 2, sd * 0.42, { sx: 0.035, sy: y, sz: 0.035 }), false), wm);
          if (lights) batchPart(P(GEO.bead, PALETTE.neon, M(u, y + 0.03, sd * 0.42, { s: 0.022 }), false, { unlit: true }), wm);
        }
      }
    };
    if (style === 'girder') {
      // a steel girder bridge: I-beam sides with X bracing
      for (const sd of [-1, 1]) {
        batchPart(P(GEO.box, PALETTE.hazard, M(0, 0.16, sd * 0.42, { sx: 1.2, sy: 0.06, sz: 0.05 })), wm);
        for (let i = 0; i < 3; i++) batchPart(P(GEO.box, PALETTE.steelDark, M(-0.38 + i * 0.38, 0.09, sd * 0.42, { sx: 0.44, sy: 0.025, sz: 0.025, rz: i % 2 ? 0.35 : -0.35 }), false), wm);
      }
      for (let i = 0; i < 6; i++) batchPart(P(GEO.box, PALETTE.steel, M(-0.45 + i * 0.18, 0.045, 0, { sx: 0.02, sy: 0.01, sz: 0.8 }), false), wm);
    } else if (style === 'log') {
      // a fallen giant glowshroom stalk, its cap still glowing on the far bank
      batchPart(P(GEO.cyl, PALETTE.cream, M(0, 0.02, 0, { sx: 0.44, sy: 1.3, sz: 0.4, rz: Math.PI / 2 })), wm);
      batchPart(P(GEO.dome, PALETTE.crystal, M(0.72, 0.02, -0.5, { sx: 0.5, sy: 0.32, sz: 0.5, rz: -1.2 })), wm);
      for (let i = 0; i < 4; i++) batchPart(P(GEO.bead, PALETTE.crystalTeal, M(-0.4 + i * 0.26, 0.42, 0.3 - (i % 2) * 0.6, { s: 0.04 }), false, { unlit: true }), wm);
      rail(PALETTE.woodLight, 0.18, false);
    } else if (style === 'span') {
      // a cable-stayed span: two masts, cables to the deck
      rail(PALETTE.plaster);
      for (const e of [-1, 1]) {
        batchPart(P(GEO.box, PALETTE.plaster, M(e * 0.62, 0.45, 0, { sx: 0.08, sy: 0.9, sz: 0.08 })), wm);
        batchPart(P(GEO.bead, PALETTE.capRed, M(e * 0.62, 0.93, 0, { s: 0.04 }), false, { unlit: true }), wm);
        for (const sd of [-1, 1]) batchPart(P(GEO.box, PALETTE.steel, M(e * 0.36, 0.5, sd * 0.2, { sx: 0.55, sy: 0.01, sz: 0.01, rz: e * 0.8 }), false), wm);
      }
    } else if (style === 'pipe') {
      // the colony pipeline doubles as a bridge: a fat pipe under a grate deck
      batchPart(P(GEO.cyl, PALETTE.steel, M(0, -0.12, 0, { sx: 0.3, sy: 1.6, sz: 0.3, rz: Math.PI / 2 })), wm);
      for (const u of [-0.5, 0, 0.5]) batchPart(P(GEO.ring, PALETTE.hazard, M(u, -0.12, 0, { s: 0.31, ry: Math.PI / 2 }), false), wm);
      rail(PALETTE.hazard, 0.18);
    } else if (style === 'mono') {
      // under the monorail: the deck runs below a white track on pylons
      rail(PALETTE.plaster);
      for (const e of [-1, 1]) batchPart(P(GEO.box, PALETTE.plaster, M(0, 0.7, e * 0.6, { sx: 0.12, sy: 1.4, sz: 0.12 }), true), wm);
      batchPart(P(GEO.box, PALETTE.hull, M(0, 1.42, 0, { sx: 0.16, sy: 0.1, sz: 2.4 })), wm);
      batchPart(P(GEO.box, PALETTE.neon, M(0, 1.36, 0, { sx: 0.17, sy: 0.02, sz: 2.4 }), false, { unlit: true }), wm);
    } else if (style === 'ice') {
      // a natural arch of blue ice with icicles hanging off it
      batchPart(P(GEO.sphereLo, PALETTE.ice, M(0, -0.05, 0, { sx: 0.72, sy: 0.16, sz: 0.5 })), wm);
      for (let i = 0; i < 5; i++) batchPart(P(GEO.cone, PALETTE.frost, M(-0.4 + i * 0.2, -0.16, (i % 2 ? 1 : -1) * 0.38, { sx: 0.04, sy: 0.18, sz: 0.04, rx: Math.PI }), false), wm);
      rail(PALETTE.frost, 0.14, false);
    } else if (style === 'aqueduct') {
      // a stone aqueduct of three arches, water glinting along its top
      for (let i = 0; i < 3; i++) batchPart(P(GEO.box, PALETTE.stone, M(-0.4 + i * 0.4, -0.12, 0, { sx: 0.1, sy: 0.24, sz: 0.84 })), wm);
      for (const sd of [-1, 1]) batchPart(P(GEO.box, PALETTE.stoneDark, M(0, 0.12, sd * 0.42, { sx: 1.2, sy: 0.16, sz: 0.08 })), wm);
      batchPart(P(GEO.box, PALETTE.water, M(0, 0.21, 0.42, { sx: 1.18, sy: 0.01, sz: 0.04 }), false, { unlit: true }), wm);
    } else if (style === 'gantry') {
      // a crane gantry spanning the trench, its trolley sliding to and fro
      rail(PALETTE.hazard);
      for (const e of [-1, 1]) for (const sd of [-1, 1]) batchPart(P(GEO.box, PALETTE.hazard, M(e * 0.56, 0.55, sd * 0.42, { sx: 0.06, sy: 1.1, sz: 0.06 })), wm);
      for (const sd of [-1, 1]) batchPart(P(GEO.box, PALETTE.hazard, M(0, 1.1, sd * 0.42, { sx: 1.2, sy: 0.07, sz: 0.06 })), wm);
      const trolley = liveProp([P(GEO.box, PALETTE.steelDark, M(0, 0, 0, { sx: 0.2, sy: 0.12, sz: 0.9 })), P(GEO.cyl, PALETTE.steel, M(0, -0.2, 0, { sx: 0.01, sy: 0.3, sz: 0.01 }), false), P(GEO.box, PALETTE.hazard, M(0, -0.36, 0, { sx: 0.12, sy: 0.04, sz: 0.12 }))], x, 1.04, z);
      animated.push({ update(t) { trolley.position.x = x + Math.sin(t * 0.5) * 0.45; } });
    } else if (style === 'force') {
      // a hard-light bridge: a glowing violet deck between two emitter posts
      for (const e of [-1, 1]) {
        batchPart(P(GEO.cyl, PALETTE.hullDark, M(e * 0.6, 0.2, 0, { sx: 0.1, sy: 0.4, sz: 0.1 })), wm);
        batchPart(P(GEO.sphereLo, PALETTE.magic, M(e * 0.6, 0.44, 0, { s: 0.08 }), false, { unlit: true }), wm);
        glow(x + e * 0.6, 0.44, z, { w: 0.6, h: 0.6 });
      }
      const sheet = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: PALETTE.magicGlow, transparent: true, opacity: 0.55, depthWrite: false }));
      sheet.position.set(x, 0.05, z); sheet.scale.set(1.1, 0.02, 0.8); sheet.renderOrder = 2;
      scene.add(sheet);
      animated.push({ update(t) { sheet.material.opacity = 0.45 + 0.15 * Math.sin(t * 3); } });
    } else rail(PALETTE.plaster);
  }

  // The colony outpost at the end of the road. Every style shares a deck,
  // an airlock facing the road, lit windows and the damage overlay; what
  // stands on the deck is the level's own landmark.
  function outpost(kit, style, { flag = PALETTE.tunic } = {}) {
    const { P, M, GEO, batchPart, batchDecal, liveProp, animated, scene, toon, glow, worldX, level, srand, puff } = kit;
    const [cx, cz] = endpointCenter(kit);
    const wm = M(cx, 0, cz), st = { state: 0 };
    const cells = level.endpoint.cells, rs = cells.map(([, r]) => r);
    const depth = (Math.max(...rs) - Math.min(...rs) + 1) / 2;
    const gx = worldX(level.endpoint.gateCell[0]) - cx, gz = depth + 0.06;
    batchPart(P(GEO.box, PALETTE.cobbleDark, M(0, 0.02, 0, { sx: 1.9, sy: 0.04, sz: depth * 2 - 0.05 }), false), wm);
    // the front module the airlock is set in
    const front = (w, h, color = PALETTE.plaster) => {
      batchPart(P(GEO.box, color, M(gx, h / 2, gz - 0.3, { sx: w, sy: h, sz: 0.6 })), wm);
      batchPart(P(GEO.box, PALETTE.tunic, M(gx, h - 0.04, gz - 0.3, { sx: w + 0.03, sy: 0.06, sz: 0.62 }), false), wm);
      airlock(kit, wm, [cx, cz], gx, gz, { w: 0.4, h: Math.min(0.52, h - 0.08) });
    };
    let smoke = [cx, 1.4, cz], fire = [cx + gx, 0.5, cz + gz - 0.3];
    const win = [];
    if (style === 'pumpstation') {
      front(0.9, 0.6);
      for (const [dx, dz] of [[-0.55, -0.6], [0.55, -0.6], [-0.55, -1.2], [0.55, -1.2]]) batchPart(P(GEO.cyl, PALETTE.steelDark, M(dx * 0.6, 0.6, -0.9 + dz * 0.2, { sx: 0.04, sy: 1.2, sz: 0.04 })), wm);
      batchPart(P(GEO.cyl, PALETTE.hull, M(0, 1.4, -0.95, { sx: 0.5, sy: 0.55, sz: 0.5 })), wm);
      batchPart(P(GEO.dome, PALETTE.tunic, M(0, 1.67, -0.95, { sx: 0.5, sy: 0.25, sz: 0.5 })), wm);
      batchPart(P(GEO.cyl, PALETTE.water, M(0, 1.35, -0.44, { sx: 0.3, sy: 0.35, sz: 0.02, rx: Math.PI / 2 }), false, { unlit: true }), wm);
      for (const y of [1.2, 1.5]) batchPart(P(GEO.ring, PALETTE.steelDark, M(0, y, -0.95, { s: 0.505, rx: Math.PI / 2 }), false), wm);
      batchPart(P(GEO.cyl, PALETTE.steel, M(0.75, 0.3, 0.2, { sx: 0.08, sy: 1.4, sz: 0.08, rx: Math.PI / 2 })), wm);
      smoke = [cx, 1.9, cz - 0.95];
    } else if (style === 'lab') {
      front(1.0, 0.55);
      glassDome(kit, cx - 0.4, 0.04, cz - 0.6, 0.5, { h: 0.5 });
      glassDome(kit, cx + 0.45, 0.04, cz - 0.75, 0.4, { h: 0.42 });
      for (const p of kit.mushroomParts(srand(9), true).parts) batchPart(p, M(cx - 0.4, 0.04, cz - 0.6));
      batchPart(P(GEO.cyl, PALETTE.steelDark, M(0.75, 0.1, 0.0, { sx: 0.16, sy: 0.2, sz: 0.16 })), wm);
      const tank = new THREE.Mesh(GEO.cyl, new THREE.MeshBasicMaterial({ color: PALETTE.goo, transparent: true, opacity: 0.6 }));
      tank.position.set(cx + 0.75, 0.6, cz); tank.scale.set(0.13, 0.8, 0.13); scene.add(tank);
      batchPart(P(GEO.cyl, PALETTE.steelDark, M(0.75, 1.02, 0.0, { sx: 0.16, sy: 0.06, sz: 0.16 })), wm);
      animated.push({ update(t) { tank.material.opacity = 0.5 + 0.15 * Math.sin(t * 2); if (Math.random() < 0.03) puff(cx + 0.75, 0.4, cz, { count: 1, color: PALETTE.goo, speed: 0.05, size: 0.04, up: 0.8, ttl: 0.8 }); } });
    } else if (style === 'comms') {
      front(0.9, 0.6);
      batchPart(P(GEO.cylTaper, PALETTE.hull, M(0.1, 0.9, -0.6, { sx: 0.18, sy: 1.8, sz: 0.18 })), wm);
      batchPart(P(GEO.ring, PALETTE.tunic, M(0.1, 1.2, -0.6, { s: 0.15, rx: Math.PI / 2 }), false), wm);
      const dish = liveProp([
        P(GEO.dome, PALETTE.plaster, M(0, 0, 0.1, { sx: 0.7, sy: 0.22, sz: 0.7, rx: Math.PI / 2 })),
        P(GEO.cyl, PALETTE.steelDark, M(0, 0, 0.35, { sx: 0.02, sy: 0.5, sz: 0.02, rx: Math.PI / 2 }), false),
        P(GEO.sphereLo, PALETTE.capRed, M(0, 0, 0.6, { s: 0.05 }), false, { unlit: true }),
      ], cx + 0.1, 1.95, cz - 0.6);
      animated.push({ update(t) { const k = st.state === 2 ? 0.2 : 1; dish.rotation.y = Math.sin(t * 0.3 * k) * 1.2 + 0.4; dish.rotation.x = -0.6; } });
      smoke = [cx + 0.1, 1.6, cz - 0.6];
    } else if (style === 'moisture') {
      front(1.0, 0.5, PALETTE.sand);
      for (const [dx, dz, h] of [[-0.6, -0.8, 1.5], [0.15, -1.0, 1.9], [0.7, -0.5, 1.3]]) {
        batchPart(P(GEO.cyl, PALETTE.steel, M(dx, h / 2, dz, { sx: 0.07, sy: h, sz: 0.07 })), wm);
        for (let k = 0; k < 3; k++) batchPart(P(GEO.cyl, PALETTE.hull, M(dx, h * (0.4 + k * 0.2), dz, { sx: 0.16 - k * 0.03, sy: 0.05, sz: 0.16 - k * 0.03 })), wm);
        batchPart(P(GEO.bead, PALETTE.neon, M(dx, h + 0.03, dz, { s: 0.035 }), false, { unlit: true }), wm);
      }
      smoke = [cx, 1.2, cz - 0.6];
    } else if (style === 'spaceport') {
      front(1.0, 0.6);
      batchPart(P(GEO.cyl, PALETTE.hull, M(-0.6, 0.85, -0.7, { sx: 0.14, sy: 1.7, sz: 0.14 })), wm);
      batchPart(P(GEO.cyl, PALETTE.glass, M(-0.6, 1.75, -0.7, { sx: 0.3, sy: 0.22, sz: 0.3 }), false, { unlit: true }), wm);
      batchPart(P(GEO.cyl, PALETTE.tunic, M(-0.6, 1.9, -0.7, { sx: 0.34, sy: 0.06, sz: 0.34 })), wm);
      batchPart(P(GEO.cyl, PALETTE.slate, M(0.35, 0.05, -0.75, { sx: 0.55, sy: 0.04, sz: 0.55 })), wm);
      batchPart(P(GEO.ring, PALETTE.hazard, M(0.35, 0.08, -0.75, { s: 0.45, rx: Math.PI / 2 }), false), wm);
      // the parked shuttle
      batchPart(P(GEO.sphereLo, PALETTE.hull, M(0.35, 0.3, -0.75, { sx: 0.2, sy: 0.16, sz: 0.45 })), wm);
      batchPart(P(GEO.box, PALETTE.hullDark, M(0.35, 0.22, -0.85, { sx: 0.7, sy: 0.03, sz: 0.25 })), wm);
      batchPart(P(GEO.box, PALETTE.tunic, M(0.35, 0.42, -1.05, { sx: 0.03, sy: 0.22, sz: 0.16 })), wm);
      batchPart(P(GEO.box, PALETTE.glass, M(0.35, 0.36, -0.42, { sx: 0.16, sy: 0.06, sz: 0.06 }), false, { unlit: true }), wm);
      const beacon = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.capRed }));
      beacon.position.set(cx - 0.6, 2.0, cz - 0.7); beacon.scale.setScalar(0.06); scene.add(beacon);
      animated.push({ update(t) { beacon.visible = Math.sin(t * 5) > 0; } });
      smoke = [cx - 0.6, 1.8, cz - 0.7];
    } else if (style === 'icemine') {
      front(0.9, 0.55);
      for (const e of [-1, 1]) for (const f of [-1, 1]) batchPart(P(GEO.cyl, PALETTE.hazard, M(0.2 + e * 0.3, 0.9, -0.7 + f * 0.3, { sx: 0.03, sy: 1.9, sz: 0.03, rz: -e * 0.13, rx: f * 0.13 }), false), wm);
      batchPart(P(GEO.box, PALETTE.hazard, M(0.2, 1.8, -0.7, { sx: 0.22, sy: 0.1, sz: 0.22 })), wm);
      const drill = liveProp([P(GEO.cyl, PALETTE.steel, M(0, 0.5, 0, { sx: 0.04, sy: 1.0, sz: 0.04 })), P(GEO.cone, PALETTE.steelDark, M(0, -0.05, 0, { sx: 0.1, sy: 0.2, sz: 0.1, rx: Math.PI }))], cx + 0.2, 0.25, cz - 0.7);
      animated.push({ update(t) { drill.rotation.y = t * (st.state === 2 ? 1 : 6); drill.position.y = 0.25 + Math.sin(t * 0.8) * 0.08; } });
      for (const [dx, dz] of [[-0.6, -0.5], [-0.7, -0.95], [-0.45, -1.1]]) batchPart(P(GEO.box, PALETTE.ice, M(dx, 0.12, dz, { sx: 0.22, sy: 0.2, sz: 0.22, ry: dx * 3 })), wm);
      smoke = [cx + 0.2, 1.4, cz - 0.7];
    } else if (style === 'seedvault') {
      batchPart(P(GEO.dome, PALETTE.meadowDark, M(0, 0.02, -0.4, { sx: 0.95, sy: 0.7, sz: depth + 0.2 })), wm);
      batchPart(P(GEO.box, PALETTE.hullDark, M(gx, 0.36, gz - 0.25, { sx: 0.8, sy: 0.72, sz: 0.5 })), wm);
      batchPart(P(GEO.cyl, PALETTE.steel, M(gx, 0.38, gz, { sx: 0.3, sy: 0.05, sz: 0.3, rx: Math.PI / 2 })), wm);
      batchPart(P(GEO.ring, PALETTE.hazard, M(gx, 0.38, gz + 0.03, { s: 0.3 }), false), wm);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; batchPart(P(GEO.bead, PALETTE.steelDark, M(gx + Math.cos(a) * 0.22, 0.38 + Math.sin(a) * 0.22, gz + 0.03, { s: 0.03 }), false), wm); }
      batchPart(P(GEO.box, PALETTE.hazard, M(gx, 0.03, gz + 0.16, { sx: 0.6, sy: 0.06, sz: 0.24 })), wm);
      for (let i = 0; i < 3; i++) for (const p of kit.treeParts(srand(40 + i)).parts) batchPart(p, M(cx - 0.5 + i * 0.5, 0.5, cz - 0.7 - (i % 2) * 0.2, { s: 0.6 }));
      smoke = [cx, 0.9, cz - 0.3]; fire = [cx + gx, 0.6, cz + gz - 0.2];
    } else if (style === 'shieldgen') {
      front(0.9, 0.55);
      batchPart(P(GEO.cylTaper, PALETTE.hullDark, M(0.1, 0.8, -0.6, { sx: 0.16, sy: 1.6, sz: 0.16 })), wm);
      for (const y of [0.5, 0.9, 1.3]) batchPart(P(GEO.torus, PALETTE.magic, M(0.1, y, -0.6, { s: 0.18, rx: Math.PI / 2 }), false, { unlit: true }), wm);
      batchPart(P(GEO.sphereLo, PALETTE.magicGlow, M(0.1, 1.7, -0.6, { s: 0.14 }), false, { unlit: true }), wm);
      glow(cx + 0.1, 1.7, cz - 0.6, { w: 0.9, h: 0.9 });
      const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: PALETTE.magicGlow, transparent: true, opacity: 0.16, depthWrite: false }));
      shield.position.set(cx, 0.02, cz - 0.1); shield.scale.set(1.25, 1.2, depth + 0.35); shield.renderOrder = 2; scene.add(shield);
      animated.push({ update(t) { const k = st.state === 2 ? 0.35 : st.state === 1 ? 0.7 : 1; shield.material.opacity = (0.12 + 0.05 * Math.sin(t * 2.4)) * k; } });
      smoke = [cx + 0.1, 1.5, cz - 0.6];
    } else if (style === 'terraformer') {
      front(1.0, 0.6);
      cropRows(kit, wm, { x: 0, z: -0.65, w: 1.5, d: 0.9, rows: 4 });
      glassDome(kit, cx, 0.02, cz - 0.65, 0.95, { h: 0.85, ribs: 6 });
      terraformerTower(kit, cx + 0.55, cz - 0.7, { h: 2.6, r: 0.25, stateRef: st });
      terraformerTower(kit, cx - 0.6, cz - 0.9, { h: 1.8, r: 0.18, stateRef: st });
      smoke = [cx, 1.6, cz - 0.6];
    }
    if (style !== 'seedvault') win.push([gx + 0.32, 0.34, gz - 0.0, 'z']);
    windows(kit, wm, [cx, cz], win, st);
    const pole = new THREE.Mesh(GEO.cyl, toon(PALETTE.steel));
    pole.position.set(cx + 0.82, 0.9, cz + depth - 0.3); pole.scale.set(0.025, 1.8, 0.025); scene.add(pole);
    banner(kit, cx + 0.82, 1.62, cz + depth - 0.3, { w: 0.56, h: 0.34, field: flag, stripe: PALETTE.plaster, emblem: PALETTE.flowerYellow, stateRef: st });
    batchDecal(cx, cz - 0.3, 0.9);
    damage(kit, {
      stateRef: st,
      cracks: [[cx + gx - 0.3, 0.3, cz + gz - 0.0, 0.18, 0.4, 'z'], [cx + gx + 0.32, 0.4, cz + gz - 0.0, 0.16, 0.36, 'z']],
      rubble: [[cx - 0.85, cz + depth - 0.2], [cx + 0.85, cz + depth], [cx + 0.2, cz + depth + 0.25], [cx - 0.9, cz - 0.2], [cx + 0.95, cz - 0.4]],
      fire, smoke, burst: [cx + gx, 0.6, cz + gz + 0.2],
    });
    return st;
  }

  // Everything a level shares: what fills its chokepoint column, its bridge,
  // its outpost, the landing pods and the scatter. Levels add their own set
  // pieces around this.
  function standardScene(kit, { channel: ch = 'canal', bridge: br = 'girder', outpost: op, flag, seed, mix, edge, endpointGap = 2 }) {
    channel(kit, ch);
    bridge(kit, br);
    outpost(kit, op, { flag });
    alienPods(kit);
    const cells = kit.level.endpoint.cells, endC = cells.map(([c]) => c), endR = cells.map(([, r]) => r);
    const near = (c, r) => c >= Math.min(...endC) - endpointGap && c <= Math.max(...endC) + endpointGap && r >= Math.min(...endR) - endpointGap && r <= Math.max(...endR) + endpointGap;
    countryside(kit, { seed, mix, edge, keepLow: near });
  }

  return { channel, bridge, outpost, standardScene, gableRoof, habParts, greenhouseParts, solarParts, siloParts, antennaParts, bushParts, fenceParts, crateParts, roverParts, stumpParts, pumpParts, craterParts,
    banner, glassDome, cropRows, terraformerTower, alienPods, countryside, chimneySmoke, stream, damage, windows, endpointCenter, airlock };
})();
