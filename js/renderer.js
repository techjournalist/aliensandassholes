// ===================================================================
// Renderer  (all three.js; reads GameState, never writes it; level-
// specific set dressing lives in each level's buildScene(), see
// js/level1-shadow-hollow.js for the pattern)
// ===================================================================
const Renderer = (() => {
  const border = CONFIG.border, tileHeight = CONFIG.tileHeight;
  let cols, rows;
  let renderer, scene, camera, canvas, cssW = 1, cssH = 1;
  const animated = [];          // { update(t, dt) }
  const materialCache = new Map();
  let gradientMap, outlineMat;
  let selectionRing, rejectRing;
  let rejectTimer = 0, rejectCell = null;
  let unitsPerPixel = 0.02;

  // -------- small helpers --------
  function srand(seed) {   // mulberry32, deterministic set dressing
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const { worldX, worldZ } = GameState;
  const lerpColor = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

  function toon(color, opts = {}) {
    const k = `t${color}${opts.side || ''}${opts.vc ? 'v' : ''}${opts.emissive || ''}`;
    if (materialCache.has(k)) return materialCache.get(k);
    const m = new THREE.MeshToonMaterial({
      color, gradientMap,
      vertexColors: !!opts.vc,
      side: opts.side || THREE.FrontSide,
      emissive: opts.emissive || 0x000000,
    });
    materialCache.set(k, m);
    return m;
  }
  function unlit(color, opts = {}) {
    const k = `u${color}${opts.opacity ?? 1}${opts.side || ''}`;
    if (materialCache.has(k)) return materialCache.get(k);
    const m = new THREE.MeshBasicMaterial({
      color, transparent: opts.opacity !== undefined && opts.opacity < 1,
      opacity: opts.opacity ?? 1, side: opts.side || THREE.FrontSide,
      depthWrite: opts.depthWrite ?? true,
    });
    materialCache.set(k, m);
    return m;
  }

  // Unit primitives; every prop is one of these scaled by a matrix.
  const GEO = {};
  function buildPrimitives() {
    GEO.sphere = new THREE.SphereGeometry(1, 12, 9);
    GEO.sphereLo = new THREE.SphereGeometry(1, 8, 6);
    GEO.sphereMid = new THREE.SphereGeometry(1, 10, 7);
    GEO.dome = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    GEO.box = new THREE.BoxGeometry(1, 1, 1);
    GEO.cone = new THREE.ConeGeometry(1, 1, 10);
    GEO.cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
    GEO.cylTaper = new THREE.CylinderGeometry(0.6, 1, 1, 9);
    GEO.rock = new THREE.DodecahedronGeometry(1, 0);
    GEO.torus = new THREE.TorusGeometry(1, 0.16, 6, 12);
    GEO.circle = new THREE.CircleGeometry(1, 18);
    for (const k in GEO) { if (GEO[k].index) GEO[k] = GEO[k].toNonIndexed(); }
    // circle should lie flat on the ground
    GEO.circle.rotateX(-Math.PI / 2);
  }

  // Outline geometry: same shape, but with normals averaged across every
  // vertex that shares a position, so the inverted hull has no gaps at
  // hard edges (boxes, cone rims, cylinder caps).
  const smoothCache = new Map();
  function smoothedForOutline(geo) {
    if (smoothCache.has(geo.uuid)) return smoothCache.get(geo.uuid);
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const pos = g.attributes.position, nor = g.attributes.normal;
    const sums = new Map();
    const keyOf = (i) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    for (let i = 0; i < pos.count; i++) {
      const k = keyOf(i);
      let s = sums.get(k);
      if (!s) { s = [0, 0, 0]; sums.set(k, s); }
      s[0] += nor.getX(i); s[1] += nor.getY(i); s[2] += nor.getZ(i);
    }
    for (let i = 0; i < pos.count; i++) {
      const s = sums.get(keyOf(i));
      const l = Math.hypot(s[0], s[1], s[2]) || 1;
      nor.setXYZ(i, s[0] / l, s[1] / l, s[2] / l);
    }
    nor.needsUpdate = true;
    smoothCache.set(geo.uuid, g);
    return g;
  }

  function makeOutlineMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        thickness: { value: 0.04 },
        color: { value: new THREE.Color(PALETTE.outline) },
      },
      vertexShader: `
        uniform float thickness;
        void main() {
          vec3 n = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          mv.xyz += n * thickness;   // view-space push: constant width under an ortho camera
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 color;
        void main() { gl_FragColor = vec4(color, 1.0); }`,
      side: THREE.BackSide,
    });
  }

  function addOutline(mesh) {
    const o = new THREE.Mesh(smoothedForOutline(mesh.geometry), outlineMat);
    o.name = 'outline';
    mesh.add(o);
    return o;
  }

  // Merge non-indexed geometries (position + normal, optional color).
  function mergeGeoms(geos) {
    let count = 0;
    geos.forEach((g) => { count += g.attributes.position.count; });
    const withColor = geos.length > 0 && geos.every((g) => g.attributes.color);
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
    const col = withColor ? new Float32Array(count * 3) : null;
    let off = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, off * 3);
      nor.set(g.attributes.normal.array, off * 3);
      if (col) col.set(g.attributes.color.array, off * 3);
      off += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return out;
  }

  // Matrix builder: M(x, y, z, {rx, ry, rz, sx, sy, sz, s})
  const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  function M(x, y, z, o = {}) {
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    const s = o.s ?? 1;
    _s.set(o.sx ?? s, o.sy ?? s, o.sz ?? s);
    return new THREE.Matrix4().compose(_p, _q, _s);
  }

  // Static batcher: props that never move are merged per material into a
  // handful of draw calls (one per color, one for every outline).
  const batch = { groups: new Map(), outlines: [], decals: [] };
  function batchPart(part, worldMatrix) {
    const m = worldMatrix ? worldMatrix.clone().multiply(part.m) : part.m;
    const g = part.geo.clone().applyMatrix4(m);
    const matKey = (part.unlit ? 'u' : 't') + part.color;
    let grp = batch.groups.get(matKey);
    if (!grp) { grp = { mat: part.unlit ? unlit(part.color) : toon(part.color), geos: [] }; batch.groups.set(matKey, grp); }
    grp.geos.push(g);
    if (part.outline) batch.outlines.push(smoothedForOutline(part.geo).clone().applyMatrix4(m));
  }
  function batchDecal(x, z, radius) {
    batch.decals.push(GEO.circle.clone().applyMatrix4(M(x, 0.012, z, { s: radius })));
  }
  function flushBatch() {
    for (const grp of batch.groups.values()) {
      const mesh = new THREE.Mesh(mergeGeoms(grp.geos), grp.mat);
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
    }
    if (batch.outlines.length) {
      const mesh = new THREE.Mesh(mergeGeoms(batch.outlines), outlineMat);
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
    }
    if (batch.decals.length) {
      const mesh = new THREE.Mesh(mergeGeoms(batch.decals), unlit(PALETTE.shadow, { opacity: 0.22, depthWrite: false }));
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
    }
  }

  // Live props: a Group we can animate (squash, sway, bob). Parts flagged
  // `live` stay separate meshes so they can move on their own; the rest are
  // merged into one vertex-colored mesh plus one outline mesh, which keeps a
  // character at roughly 4 draw calls plus 2 per live part.
  function colored(geo, color) {
    const c = new THREE.Color(color), n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  }
  function liveProp(parts, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const toonGeos = [], unlitGeos = [], outlineGeos = [];
    for (const p of parts) {
      if (p.live) {
        const mat = p.unlit ? unlit(p.color) : toon(p.color, p.matOpts);
        const mesh = new THREE.Mesh(p.geo, mat);
        mesh.applyMatrix4(p.m);
        if (p.name) mesh.name = p.name;
        if (p.outline) addOutline(mesh);
        g.add(mesh);
        continue;
      }
      (p.unlit ? unlitGeos : toonGeos).push(colored(p.geo.clone().applyMatrix4(p.m), p.color));
      if (p.outline) outlineGeos.push(smoothedForOutline(p.geo).clone().applyMatrix4(p.m));
    }
    if (toonGeos.length) { const m = new THREE.Mesh(mergeGeoms(toonGeos), toon(0xffffff, { vc: true })); m.name = 'merged'; g.add(m); }
    if (unlitGeos.length) { const m = new THREE.Mesh(mergeGeoms(unlitGeos), unlitVC()); m.name = 'mergedUnlit'; g.add(m); }
    if (outlineGeos.length) { const m = new THREE.Mesh(mergeGeoms(outlineGeos), outlineMat); m.name = 'mergedOutline'; g.add(m); }
    scene.add(g);
    return g;
  }
  let _unlitVC = null;
  function unlitVC() { return _unlitVC || (_unlitVC = new THREE.MeshBasicMaterial({ vertexColors: true })); }
  function decal(x, z, radius, parent) {
    const d = new THREE.Mesh(GEO.circle, unlit(PALETTE.shadow, { opacity: 0.22, depthWrite: false }));
    d.position.set(x, 0.012, z);
    d.scale.setScalar(radius);
    (parent || scene).add(d);
    return d;
  }

  // -------- prop recipes (each returns a parts list in local space) --------
  const P = (geo, color, m, outline = true, extra = {}) => ({ geo, color, m, outline, ...extra });

  function treeParts(rng) {
    const h = 0.7 + rng() * 0.5, r = 0.42 + rng() * 0.28;
    const parts = [
      P(GEO.cyl, PALETTE.wood, M(0, h * 0.35, 0, { sx: 0.13, sy: h * 0.7, sz: 0.13 })),
      P(GEO.sphereMid, PALETTE.meadowDark, M(0, h * 0.62 + r * 0.7, 0, { sx: r, sy: r * 0.9, sz: r })),
      P(GEO.sphereMid, PALETTE.meadow, M(r * 0.45, h * 0.62 + r * 1.15, r * 0.2, { s: r * 0.72 })),
      P(GEO.sphereMid, PALETTE.meadowLight, M(-r * 0.4, h * 0.62 + r * 1.25, -r * 0.1, { s: r * 0.6 })),
    ];
    return { parts, radius: r * 0.9 };
  }
  function deadTreeParts(rng) {
    const h = 0.9 + rng() * 0.7, lean = (rng() - 0.5) * 0.5;
    const parts = [
      P(GEO.cylTaper, PALETTE.hollowWood, M(0, h / 2, 0, { sx: 0.12, sy: h, sz: 0.12, rz: lean })),
    ];
    const n = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const y = h * (0.45 + rng() * 0.45), a = rng() * Math.PI * 2, len = 0.3 + rng() * 0.35;
      const tilt = 0.9 + rng() * 0.6;
      const m = new THREE.Matrix4().makeTranslation(Math.sin(lean) * -y * 0.5, y, 0)
        .multiply(new THREE.Matrix4().makeRotationY(a))
        .multiply(new THREE.Matrix4().makeRotationZ(tilt))
        .multiply(new THREE.Matrix4().makeTranslation(0, len / 2, 0))
        .multiply(new THREE.Matrix4().makeScale(0.05, len, 0.05));
      parts.push(P(GEO.cylTaper, PALETTE.hollowWood, m));
    }
    return { parts, radius: 0.25 };
  }
  function mushroomParts(rng, big) {
    const s = big ? 0.55 + rng() * 0.25 : 0.22 + rng() * 0.12;
    const tilt = (rng() - 0.5) * 0.25;
    const parts = [
      P(GEO.cyl, PALETTE.cream, M(0, s * 0.45, 0, { sx: s * 0.3, sy: s * 0.9, sz: s * 0.3, rz: tilt })),
      P(GEO.dome, PALETTE.capRed, M(0, s * 0.8, 0, { sx: s * 0.75, sy: s * 0.55, sz: s * 0.75, rz: tilt })),
    ];
    const spots = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < spots; i++) {
      const a = rng() * Math.PI * 2, d = s * (0.25 + rng() * 0.3);
      parts.push(P(GEO.sphereLo, PALETTE.cream, M(Math.cos(a) * d, s * 0.8 + s * 0.42, Math.sin(a) * d, { s: s * 0.11 }), false));
    }
    return { parts, radius: s * 0.75 };
  }
  function tuftParts(rng) {
    const s = 0.12 + rng() * 0.12;
    return { parts: [P(GEO.sphereLo, PALETTE.meadowLight, M(0, s * 0.35, 0, { sx: s * 1.4, sy: s * 0.6, sz: s * 1.2 }), false)], radius: 0 };
  }
  function rockParts(rng, hollow) {
    const s = 0.16 + rng() * 0.22;
    const color = hollow ? PALETTE.hollowRock : PALETTE.stone;
    return {
      parts: [P(GEO.rock, color, M(0, s * 0.55, 0, { sx: s * 1.3, sy: s * 0.8, sz: s, ry: rng() * 3 }))],
      radius: s * 1.2,
    };
  }
  function flowerParts(rng) {
    const h = 0.18 + rng() * 0.12;
    const color = rng() < 0.5 ? PALETTE.flowerPink : PALETTE.flowerYellow;
    return {
      parts: [
        P(GEO.cyl, PALETTE.meadowDark, M(0, h / 2, 0, { sx: 0.02, sy: h, sz: 0.02 }), false),
        P(GEO.sphereLo, color, M(0, h + 0.04, 0, { s: 0.07 })),
      ], radius: 0,
    };
  }
  function acornParts(rng) {
    const s = 0.14 + rng() * 0.1, tilt = (rng() - 0.5) * 0.6;
    return {
      parts: [
        P(GEO.sphere, PALETTE.acorn, M(0, s * 0.9, 0, { sx: s * 0.75, sy: s, sz: s * 0.75, rz: tilt })),
        P(GEO.dome, PALETTE.acornCap, M(Math.sin(tilt) * -s * 0.4, s * 1.25, 0, { sx: s * 0.85, sy: s * 0.5, sz: s * 0.85, rz: tilt })),
        P(GEO.cyl, PALETTE.acornCap, M(Math.sin(tilt) * -s * 0.7, s * 1.75, 0, { sx: s * 0.1, sy: s * 0.35, sz: s * 0.1, rz: tilt }), false),
      ], radius: s * 0.8,
    };
  }

  // -------- scene construction --------
  function buildGround() {
    const geos = [];
    const rng = srand(7);
    const topColor = new THREE.Color(), sideColor = new THREE.Color();
    const rowsMin = -border, rowsMax = rows + border, colsMin = -border, colsMax = cols + border;
    for (let r = rowsMin; r < rowsMax; r++) {
      for (let c = colsMin; c < colsMax; c++) {
        const inGrid = GameState.inGrid(c, r);
        const kind = inGrid ? GameState.cellKind(c, r) : (c === GameState.currentLevel().chokepoint.streamCol ? 'stream' : 'ground');
        const h = GameState.zoneFalloff(c, r);
        let top, side, height = tileHeight, yTop = 0;
        if (kind === 'stream') {
          height = 0.12; yTop = -0.2;
          topColor.set(PALETTE.streamBed); sideColor.set(PALETTE.streamBed);
        } else if (kind === 'path' || kind === 'bridge') {
          const cob = GameState.isCobble(c, r);
          topColor.copy(cob ? lerpColor(PALETTE.cobble, PALETTE.cobbleDark, rng() * 0.5) : lerpColor(PALETTE.path, PALETTE.hollowPath, h));
          topColor.offsetHSL(0, 0, (rng() - 0.5) * 0.04);
          sideColor.copy(lerpColor(PALETTE.earth, PALETTE.hollowEarth, h));
          if (kind === 'bridge') { height = 0.12; yTop = -0.2; topColor.set(PALETTE.streamBed); sideColor.set(PALETTE.streamBed); }
        } else if (kind === 'bastion') {
          topColor.copy(lerpColor(PALETTE.cobble, PALETTE.moss, 0.35));
          sideColor.set(PALETTE.earth);
        } else {
          const base = rng() < 0.5 ? PALETTE.meadow : PALETTE.meadowDark;
          topColor.copy(lerpColor(base, PALETTE.hollowGround, h));
          topColor.offsetHSL(0, 0, (rng() - 0.5) * 0.05 - (inGrid ? 0 : 0.03));
          sideColor.copy(lerpColor(PALETTE.earth, PALETTE.hollowEarth, h));
        }
        top = topColor; side = sideColor;
        const g = GEO.box.clone().applyMatrix4(M(worldX(c), yTop - height / 2, worldZ(r), { sx: 1, sy: height, sz: 1 }));
        const n = g.attributes.normal, colors = new Float32Array(n.count * 3);
        for (let i = 0; i < n.count; i++) {
          const col = n.getY(i) > 0.5 ? top : side;
          colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geos.push(g);
      }
    }
    const ground = new THREE.Mesh(mergeGeoms(geos), toon(0xffffff, { vc: true }));
    ground.name = 'ground';
    ground.matrixAutoUpdate = false;
    scene.add(ground);

    // A wide dark-green floor so the world never shows the void.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(cols + border * 2 + 40, rows + border * 2 + 40), unlit(0x27402b));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -tileHeight - 0.02;
    scene.add(floor);

    // Buildable tile markers: a soft lighter inset square on every cell
    // that touches the road. One merged mesh, one draw call.
    const markers = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!GameState.isBuildable(c, r)) continue;
      const h = GameState.zoneFalloff(c, r);
      const g = new THREE.PlaneGeometry(0.8, 0.8).toNonIndexed();
      g.rotateX(-Math.PI / 2);
      g.applyMatrix4(M(worldX(c), 0.006, worldZ(r)));
      const col = lerpColor(PALETTE.meadowLight, 0x8f86a3, h).offsetHSL(0, 0, 0.08);
      const colors = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < g.attributes.position.count; i++) { colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      markers.push(g);
    }
    const markerMesh = new THREE.Mesh(mergeGeoms(markers), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false }));
    markerMesh.name = 'buildableMarkers';
    markerMesh.matrixAutoUpdate = false;
    scene.add(markerMesh);
    animated.push({ update(t) { markerMesh.material.opacity = 0.42 + Math.sin(t * 1.6) * 0.1; } });
  }

  // -------- characters --------
  // A part whose matrix pivots at (px,py,pz), rotates, then offsets by
  // (ox,oy,oz) before scaling: used for ears and arms that swing from a joint.
  function pivotMatrix(px, py, pz, rx, ry, rz, ox, oy, oz, sx, sy, sz, out) {
    out = out || new THREE.Matrix4();
    _e.set(rx, ry, rz);
    out.makeTranslation(px, py, pz)
      .multiply(new THREE.Matrix4().makeRotationFromEuler(_e))
      .multiply(new THREE.Matrix4().makeTranslation(ox, oy, oz))
      .multiply(new THREE.Matrix4().makeScale(sx, sy, sz));
    return out;
  }

  // Sprout Slinger: a small gnome-knight on a mossy stone pad, holding a
  // forked slingshot up and ready. Faces +z. Silhouette: the raised fork.
  function slingerParts() {
    return [
      P(GEO.cyl, PALETTE.stoneDark, M(0, 0.06, 0, { sx: 0.38, sy: 0.12, sz: 0.38 }), true, { name: 'pad' }),
      P(GEO.cyl, PALETTE.moss, M(0, 0.13, 0, { sx: 0.34, sy: 0.04, sz: 0.34 }), false, { name: 'padMoss' }),
      P(GEO.cone, PALETTE.meadowLight, M(0.3, 0.2, 0.18, { sx: 0.05, sy: 0.12, sz: 0.05, rz: -0.3 }), false),
      P(GEO.cone, PALETTE.meadowLight, M(-0.28, 0.2, -0.2, { sx: 0.05, sy: 0.1, sz: 0.05, rz: 0.3 }), false),
      P(GEO.sphereLo, PALETTE.tunic, M(0, 0.42, 0, { sx: 0.25, sy: 0.22, sz: 0.23 }), true, { name: 'body' }),
      P(GEO.sphereLo, PALETTE.woodLight, M(0.1, 0.18, 0.08, { sx: 0.09, sy: 0.05, sz: 0.11 }), true),
      P(GEO.sphereLo, PALETTE.woodLight, M(-0.1, 0.18, 0.08, { sx: 0.09, sy: 0.05, sz: 0.11 }), true),
      P(GEO.sphere, PALETTE.skin, M(0, 0.72, 0, { s: 0.22 }), true, { name: 'head' }),
      P(GEO.sphereLo, PALETTE.cream, M(0, 0.6, 0.14, { sx: 0.17, sy: 0.15, sz: 0.11 }), true, { name: 'beard' }),
      P(GEO.sphereLo, 0xf0a98a, M(0, 0.72, 0.21, { s: 0.055 }), false),
      P(GEO.cyl, PALETTE.capRed, M(0, 0.86, 0, { sx: 0.26, sy: 0.05, sz: 0.26 }), true, { name: 'brim' }),
      P(GEO.cone, PALETTE.capRed, M(0.02, 1.1, -0.02, { sx: 0.22, sy: 0.52, sz: 0.22, rz: -0.14 }), true, { name: 'hat', live: true }),
      P(GEO.sphereLo, PALETTE.meadowLight, M(0.09, 1.38, -0.02, { sx: 0.07, sy: 0.04, sz: 0.1, rz: -0.5 }), true, { name: 'sprout', live: true }),
      // the slingshot: a wooden Y with a dark band, held out to the right
      P(GEO.cyl, PALETTE.wood, M(0.34, 0.66, 0.12, { sx: 0.045, sy: 0.42, sz: 0.045, rz: -0.12 }), true, { name: 'slingHandle', live: true }),
      P(GEO.cyl, PALETTE.wood, M(0.24, 1.0, 0.12, { sx: 0.035, sy: 0.34, sz: 0.035, rz: 0.6 }), true, { name: 'prongL', live: true }),
      P(GEO.cyl, PALETTE.wood, M(0.48, 1.0, 0.12, { sx: 0.035, sy: 0.34, sz: 0.035, rz: -0.6 }), true, { name: 'prongR', live: true }),
      P(GEO.box, PALETTE.outline, M(0.36, 1.13, 0.12, { sx: 0.3, sy: 0.025, sz: 0.025 }), false, { name: 'band', live: true, unlit: true }),
      P(GEO.sphereLo, PALETTE.acorn, M(-0.2, 0.36, 0.14, { s: 0.07 }), true, { name: 'pouch' }),
    ];
  }

  // Goblin Grunt: mostly head, huge ears, a carrot nose, a stubby club.
  // Faces +z. Silhouette: the ears.
  function gruntParts() {
    const g = PALETTE.goblin, gd = PALETTE.goblinDark;
    return [
      P(GEO.sphereLo, g, M(0, 0.2, 0, { sx: 0.2, sy: 0.17, sz: 0.18 }), true, { name: 'body' }),
      P(GEO.box, PALETTE.acornCap, M(0, 0.16, 0, { sx: 0.42, sy: 0.06, sz: 0.38 }), false, { name: 'belt' }),
      P(GEO.sphereLo, gd, M(0.1, 0.05, 0.02, { sx: 0.09, sy: 0.05, sz: 0.11 }), true, { name: 'footL', live: true }),
      P(GEO.sphereLo, gd, M(-0.1, 0.05, 0.02, { sx: 0.09, sy: 0.05, sz: 0.11 }), true, { name: 'footR', live: true }),
      P(GEO.sphere, g, M(0, 0.5, 0, { sx: 0.25, sy: 0.23, sz: 0.24 }), true, { name: 'head' }),
      P(GEO.cone, g, pivotMatrix(0.2, 0.56, 0, 0, 0, -1.2, 0, 0.13, 0, 0.07, 0.26, 0.05), true, { name: 'earL', live: true }),
      P(GEO.cone, g, pivotMatrix(-0.2, 0.56, 0, 0, 0, 1.2, 0, 0.13, 0, 0.07, 0.26, 0.05), true, { name: 'earR', live: true }),
      P(GEO.sphereLo, PALETTE.cream, M(0.09, 0.54, 0.2, { s: 0.055 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.cream, M(-0.09, 0.54, 0.2, { s: 0.055 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.outline, M(0.1, 0.54, 0.245, { s: 0.025 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.outline, M(-0.08, 0.54, 0.245, { s: 0.025 }), false, { unlit: true }),
      P(GEO.cone, gd, M(0, 0.47, 0.3, { sx: 0.05, sy: 0.18, sz: 0.05, rx: Math.PI / 2 }), true, { name: 'nose' }),
      P(GEO.box, PALETTE.cream, M(0.05, 0.4, 0.21, { sx: 0.04, sy: 0.05, sz: 0.02 }), false, { unlit: true }),
      P(GEO.sphereLo, g, M(0.2, 0.26, 0.06, { s: 0.06 }), true, { name: 'armL' }),
      P(GEO.sphereLo, g, M(-0.2, 0.26, 0.06, { s: 0.06 }), true, { name: 'armR' }),
      P(GEO.cyl, PALETTE.wood, pivotMatrix(-0.22, 0.26, 0.06, 0.5, 0, 0.35, 0, 0.14, 0, 0.03, 0.3, 0.03), true, { name: 'club' }),
      P(GEO.sphereLo, PALETTE.woodLight, pivotMatrix(-0.22, 0.26, 0.06, 0.5, 0, 0.35, 0, 0.3, 0, 0.06, 0.06, 0.06), true, { name: 'clubHead' }),
    ];
  }

  // Bramblecast Warden: a hedge-wizard in a tall hood, staff topped with a
  // thorn ball, standing in a ring of brambles. Faces +z. Silhouette: hood + staff.
  function wardenParts() {
    const cloak = PALETTE.cloak, hood = PALETTE.cloakDark;
    return [
      P(GEO.cyl, PALETTE.stoneDark, M(0, 0.06, 0, { sx: 0.38, sy: 0.12, sz: 0.38 }), true, { name: 'pad' }),
      P(GEO.torus, PALETTE.cloakDark, M(0, 0.14, 0, { sx: 0.34, sy: 0.34, sz: 0.34, rx: Math.PI / 2 }), true, { name: 'brambles' }),
      P(GEO.cone, PALETTE.magic, M(0.3, 0.2, 0.12, { sx: 0.04, sy: 0.12, sz: 0.04, rz: -0.5 }), false),
      P(GEO.cone, PALETTE.magic, M(-0.26, 0.2, -0.2, { sx: 0.04, sy: 0.1, sz: 0.04, rz: 0.4 }), false),
      P(GEO.cone, PALETTE.magic, M(-0.1, 0.2, 0.32, { sx: 0.04, sy: 0.11, sz: 0.04, rx: 0.4 }), false),
      P(GEO.cone, cloak, M(0, 0.5, 0, { sx: 0.3, sy: 0.75, sz: 0.28 }), true, { name: 'body' }),
      P(GEO.sphere, PALETTE.skin, M(0, 0.78, 0.06, { s: 0.17 }), true, { name: 'head' }),
      P(GEO.sphereLo, PALETTE.cream, M(0, 0.68, 0.16, { sx: 0.12, sy: 0.14, sz: 0.09 }), true, { name: 'beard' }),
      P(GEO.sphereLo, 0xf0a98a, M(0, 0.79, 0.22, { s: 0.045 }), false),
      P(GEO.cone, hood, M(0, 1.02, -0.02, { sx: 0.27, sy: 0.62, sz: 0.27, rx: 0.12 }), true, { name: 'hood' }),
      P(GEO.sphereLo, hood, M(0, 0.86, 0.04, { sx: 0.26, sy: 0.14, sz: 0.26 }), true, { name: 'hoodRim' }),
      P(GEO.cyl, PALETTE.wood, M(0.3, 0.55, 0.16, { sx: 0.035, sy: 0.95, sz: 0.035, rz: -0.1 }), true, { name: 'staff', live: true }),
      P(GEO.sphereLo, PALETTE.magic, M(0.34, 1.06, 0.16, { s: 0.11 }), true, { name: 'thornBall', live: true }),
      P(GEO.cone, PALETTE.magic, M(0.34, 1.2, 0.16, { sx: 0.03, sy: 0.1, sz: 0.03 }), false, { name: 'thorn1', live: true }),
      P(GEO.cone, PALETTE.magic, M(0.44, 1.08, 0.16, { sx: 0.03, sy: 0.1, sz: 0.03, rz: -1.3 }), false, { name: 'thorn2', live: true }),
    ];
  }

  // Frostmoss Druid: pale robe, mossy antler crown, a frost orb hovering by
  // one hand. Faces +z. Silhouette: antlers + the floating orb.
  function druidParts() {
    return [
      P(GEO.cyl, PALETTE.stoneDark, M(0, 0.06, 0, { sx: 0.38, sy: 0.12, sz: 0.38 }), true, { name: 'pad' }),
      P(GEO.cyl, PALETTE.frost, M(0, 0.13, 0, { sx: 0.34, sy: 0.04, sz: 0.34 }), false, { name: 'padFrost' }),
      P(GEO.cone, PALETTE.frostRobe, M(0, 0.48, 0, { sx: 0.28, sy: 0.7, sz: 0.26 }), true, { name: 'body' }),
      P(GEO.sphere, PALETTE.skin, M(0, 0.78, 0.04, { s: 0.18 }), true, { name: 'head' }),
      P(GEO.sphereLo, PALETTE.moss, M(0, 0.92, -0.02, { sx: 0.2, sy: 0.1, sz: 0.2 }), true, { name: 'mossHair' }),
      P(GEO.sphereLo, PALETTE.cream, M(0, 0.66, 0.15, { sx: 0.11, sy: 0.16, sz: 0.08 }), true, { name: 'beard' }),
      P(GEO.sphereLo, 0xf0a98a, M(0, 0.79, 0.21, { s: 0.045 }), false),
      // antlers: two forked twigs
      P(GEO.cyl, PALETTE.wood, M(0.12, 1.08, -0.02, { sx: 0.025, sy: 0.3, sz: 0.025, rz: -0.35 }), true, { name: 'antlerL' }),
      P(GEO.cyl, PALETTE.wood, M(0.2, 1.2, -0.02, { sx: 0.02, sy: 0.16, sz: 0.02, rz: -1.1 }), true),
      P(GEO.cyl, PALETTE.wood, M(-0.12, 1.08, -0.02, { sx: 0.025, sy: 0.3, sz: 0.025, rz: 0.35 }), true, { name: 'antlerR' }),
      P(GEO.cyl, PALETTE.wood, M(-0.2, 1.2, -0.02, { sx: 0.02, sy: 0.16, sz: 0.02, rz: 1.1 }), true),
      P(GEO.sphereLo, PALETTE.frostRobe, M(0.26, 0.5, 0.14, { s: 0.06 }), true, { name: 'hand' }),
      P(GEO.sphereLo, PALETTE.frost, M(0.3, 0.72, 0.18, { s: 0.1 }), false, { name: 'orb', live: true, unlit: true }),
      P(GEO.sphereLo, PALETTE.cream, M(0.3, 0.72, 0.18, { s: 0.05 }), false, { name: 'orbCore', live: true, unlit: true }),
    ];
  }

  // Stonebark Golem: a squat boulder-and-bark brute with huge fists and a
  // tiny head. Faces +z. Silhouette: wide shoulders, fists on the ground.
  function golemParts() {
    const bark = PALETTE.earth, stone = PALETTE.stone;
    return [
      P(GEO.rock, stone, M(0, 0.36, 0, { sx: 0.34, sy: 0.32, sz: 0.3 }), true, { name: 'body' }),
      P(GEO.box, bark, M(0, 0.62, 0, { sx: 0.56, sy: 0.2, sz: 0.42, ry: 0.1 }), true, { name: 'shoulders', live: true }),
      P(GEO.sphereLo, PALETTE.moss, M(-0.2, 0.74, -0.04, { sx: 0.16, sy: 0.07, sz: 0.14 }), false),
      P(GEO.sphereLo, PALETTE.moss, M(0.16, 0.73, 0.08, { sx: 0.12, sy: 0.06, sz: 0.12 }), false),
      P(GEO.box, stone, M(0, 0.82, 0.06, { sx: 0.18, sy: 0.16, sz: 0.16 }), true, { name: 'head' }),
      P(GEO.sphereLo, PALETTE.gold, M(0.05, 0.84, 0.15, { s: 0.03 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.gold, M(-0.05, 0.84, 0.15, { s: 0.03 }), false, { unlit: true }),
      P(GEO.cyl, bark, M(0.34, 0.5, 0.08, { sx: 0.08, sy: 0.4, sz: 0.08, rz: -0.35 }), true, { name: 'armL', live: true }),
      P(GEO.cyl, bark, M(-0.34, 0.5, 0.08, { sx: 0.08, sy: 0.4, sz: 0.08, rz: 0.35 }), true, { name: 'armR', live: true }),
      P(GEO.rock, stone, M(0.42, 0.22, 0.14, { s: 0.17 }), true, { name: 'fistL', live: true }),
      P(GEO.rock, stone, M(-0.42, 0.22, 0.14, { s: 0.17 }), true, { name: 'fistR', live: true }),
      P(GEO.cone, PALETTE.meadowLight, M(0.1, 0.78, -0.12, { sx: 0.04, sy: 0.14, sz: 0.04, rz: -0.3 }), false),
    ];
  }

  // Acorn Artillery: a log mortar on a wheeled wooden frame with a giant
  // acorn loaded. Faces +z. Silhouette: the tilted barrel and the wheels.
  function artilleryParts() {
    const wood = PALETTE.wood, light = PALETTE.woodLight;
    return [
      P(GEO.box, wood, M(0, 0.16, 0, { sx: 0.5, sy: 0.1, sz: 0.5 }), true, { name: 'frame' }),
      P(GEO.cyl, light, M(0.3, 0.16, 0, { sx: 0.17, sy: 0.06, sz: 0.17, rz: Math.PI / 2 }), true, { name: 'wheelL' }),
      P(GEO.cyl, light, M(-0.3, 0.16, 0, { sx: 0.17, sy: 0.06, sz: 0.17, rz: Math.PI / 2 }), true, { name: 'wheelR' }),
      P(GEO.box, wood, M(0, 0.3, -0.1, { sx: 0.3, sy: 0.22, sz: 0.2 }), true, { name: 'mount' }),
      P(GEO.cyl, light, M(0, 0.5, 0.1, { sx: 0.13, sy: 0.62, sz: 0.13, rx: -0.85 }), true, { name: 'barrel', live: true }),
      P(GEO.cyl, wood, M(0, 0.5, 0.1, { sx: 0.15, sy: 0.12, sz: 0.15, rx: -0.85 }), true, { name: 'band', live: true }),
      P(GEO.sphereLo, PALETTE.acorn, M(0, 0.72, 0.36, { sx: 0.11, sy: 0.13, sz: 0.11, rx: -0.85 }), true, { name: 'loaded', live: true }),
      P(GEO.dome, PALETTE.acornCap, M(0, 0.79, 0.4, { sx: 0.12, sy: 0.06, sz: 0.12, rx: -0.85 }), true, { name: 'loadedCap', live: true }),
      P(GEO.sphereLo, PALETTE.acorn, M(-0.3, 0.3, 0.22, { sx: 0.09, sy: 0.11, sz: 0.09 }), true),
      P(GEO.sphereLo, PALETTE.acorn, M(-0.2, 0.3, 0.3, { sx: 0.09, sy: 0.11, sz: 0.09 }), true),
      P(GEO.sphereLo, PALETTE.acorn, M(-0.25, 0.44, 0.26, { sx: 0.09, sy: 0.11, sz: 0.09 }), true),
    ];
  }

  // Tier dressing: what an upgraded tower wears so its tier reads at a glance.
  function tierParts(tier) {
    const parts = [];
    if (tier >= 2) {
      parts.push(P(GEO.torus, PALETTE.stone, M(0, 0.05, 0, { sx: 0.42, sy: 0.42, sz: 0.42, rx: Math.PI / 2 }), true, { name: 'tierRing' }));
      parts.push(P(GEO.cyl, PALETTE.wood, M(-0.36, 0.42, -0.3, { sx: 0.02, sy: 0.7, sz: 0.02 }), false, { name: 'pennantPole' }));
      parts.push(P(GEO.box, PALETTE.gold, M(-0.3, 0.68, -0.3, { sx: 0.14, sy: 0.1, sz: 0.01 }), false, { name: 'pennant', live: true, unlit: true }));
    }
    if (tier >= 3) {
      parts.push(P(GEO.torus, PALETTE.gold, M(0, 0.06, 0, { sx: 0.46, sy: 0.46, sz: 0.46, rx: Math.PI / 2 }), false, { name: 'tierRingGold', unlit: true }));
      parts.push(P(GEO.cyl, PALETTE.wood, M(0.36, 0.42, -0.3, { sx: 0.02, sy: 0.7, sz: 0.02 }), false));
      parts.push(P(GEO.box, PALETTE.magic, M(0.42, 0.68, -0.3, { sx: 0.14, sy: 0.1, sz: 0.01 }), false, { name: 'pennant2', live: true, unlit: true }));
    }
    return parts;
  }

  const TOWER_RECIPES = { slinger: slingerParts, warden: wardenParts, druid: druidParts, golem: golemParts, artillery: artilleryParts };

  // Bramble Bat: a dark-purple pest with wide membrane wings, stubby ears and
  // bramble thorns on its back. Flies at height. Silhouette: the wings.
  function batParts() {
    const body = PALETTE.bat, dark = PALETTE.batDark;
    return [
      P(GEO.sphereLo, body, M(0, 0, 0, { sx: 0.17, sy: 0.14, sz: 0.2 }), true, { name: 'body' }),
      P(GEO.cone, dark, M(0.08, 0.12, -0.02, { sx: 0.05, sy: 0.14, sz: 0.04, rz: -0.4 }), true),
      P(GEO.cone, dark, M(-0.08, 0.12, -0.02, { sx: 0.05, sy: 0.14, sz: 0.04, rz: 0.4 }), true),
      P(GEO.cone, PALETTE.magic, M(0, 0.1, -0.08, { sx: 0.03, sy: 0.1, sz: 0.03, rx: -0.6 }), false),
      P(GEO.cone, PALETTE.magic, M(0.05, 0.09, -0.12, { sx: 0.03, sy: 0.08, sz: 0.03, rx: -0.8 }), false),
      P(GEO.sphereLo, PALETTE.gold, M(0.06, 0.03, 0.17, { s: 0.035 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.gold, M(-0.06, 0.03, 0.17, { s: 0.035 }), false, { unlit: true }),
      P(GEO.box, PALETTE.cream, M(0.03, -0.05, 0.18, { sx: 0.03, sy: 0.05, sz: 0.02 }), false, { unlit: true }),
      P(GEO.box, dark, pivotMatrix(0.12, 0.02, 0, 0, 0, 0, 0.26, 0, 0, 0.52, 0.02, 0.3), true, { name: 'wingL', live: true }),
      P(GEO.box, dark, pivotMatrix(-0.12, 0.02, 0, 0, 0, 0, -0.26, 0, 0, 0.52, 0.02, 0.3), true, { name: 'wingR', live: true }),
    ];
  }

  // Bog-Trickster: lanky, teal, a leaf cap and a long nose, all feet and
  // elbows. Faces +z. Silhouette: tall thin with a big leaf on top.
  function tricksterParts() {
    const g = PALETTE.trickster, gd = PALETTE.tricksterDark;
    return [
      P(GEO.sphereLo, g, M(0, 0.28, 0, { sx: 0.12, sy: 0.2, sz: 0.11 }), true, { name: 'body' }),
      P(GEO.sphereLo, gd, M(0.09, 0.05, 0.04, { sx: 0.1, sy: 0.04, sz: 0.15 }), true, { name: 'footL', live: true }),
      P(GEO.sphereLo, gd, M(-0.09, 0.05, 0.04, { sx: 0.1, sy: 0.04, sz: 0.15 }), true, { name: 'footR', live: true }),
      P(GEO.cyl, g, M(0.08, 0.14, 0.02, { sx: 0.03, sy: 0.16, sz: 0.03 }), false),
      P(GEO.cyl, g, M(-0.08, 0.14, 0.02, { sx: 0.03, sy: 0.16, sz: 0.03 }), false),
      P(GEO.sphere, g, M(0, 0.56, 0, { sx: 0.17, sy: 0.19, sz: 0.16 }), true, { name: 'head' }),
      P(GEO.cone, g, pivotMatrix(0.13, 0.62, 0, 0, 0, -1.4, 0, 0.12, 0, 0.05, 0.24, 0.04), true, { name: 'earL', live: true }),
      P(GEO.cone, g, pivotMatrix(-0.13, 0.62, 0, 0, 0, 1.4, 0, 0.12, 0, 0.05, 0.24, 0.04), true, { name: 'earR', live: true }),
      P(GEO.sphereLo, PALETTE.cream, M(0.07, 0.6, 0.13, { s: 0.045 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.cream, M(-0.07, 0.6, 0.13, { s: 0.045 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.outline, M(0.08, 0.6, 0.17, { s: 0.02 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.outline, M(-0.06, 0.6, 0.17, { s: 0.02 }), false, { unlit: true }),
      P(GEO.cone, gd, M(0, 0.54, 0.3, { sx: 0.035, sy: 0.3, sz: 0.035, rx: Math.PI / 2 }), true, { name: 'nose' }),
      P(GEO.sphereLo, PALETTE.meadowLight, M(0.04, 0.78, -0.04, { sx: 0.16, sy: 0.05, sz: 0.24, rz: -0.3, ry: 0.4 }), true, { name: 'leaf', live: true }),
      P(GEO.cyl, PALETTE.meadowDark, M(0, 0.74, 0, { sx: 0.02, sy: 0.1, sz: 0.02 }), false),
    ];
  }

  // Moss Troll: a hunched boulder of a beast, mossy back, tusks and
  // knuckles on the ground. Faces +z. Silhouette: wide hump, low head.
  function trollParts() {
    const t = PALETTE.troll, td = PALETTE.trollDark;
    return [
      P(GEO.sphereLo, t, M(0, 0.42, -0.04, { sx: 0.4, sy: 0.4, sz: 0.36 }), true, { name: 'body' }),
      P(GEO.sphereLo, PALETTE.moss, M(0, 0.68, -0.12, { sx: 0.34, sy: 0.16, sz: 0.28 }), true, { name: 'mossBack' }),
      P(GEO.sphereLo, PALETTE.meadowLight, M(0.14, 0.78, -0.16, { sx: 0.08, sy: 0.05, sz: 0.08 }), false),
      P(GEO.cone, PALETTE.capRed, M(-0.12, 0.84, -0.1, { sx: 0.06, sy: 0.1, sz: 0.06 }), false),
      P(GEO.sphereLo, t, M(0, 0.5, 0.3, { sx: 0.24, sy: 0.2, sz: 0.2 }), true, { name: 'head' }),
      P(GEO.sphereLo, td, M(0, 0.44, 0.44, { sx: 0.12, sy: 0.07, sz: 0.1 }), true, { name: 'snout' }),
      P(GEO.cone, PALETTE.cream, M(0.09, 0.42, 0.44, { sx: 0.03, sy: 0.1, sz: 0.03 }), false, { unlit: true }),
      P(GEO.cone, PALETTE.cream, M(-0.09, 0.42, 0.44, { sx: 0.03, sy: 0.1, sz: 0.03 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.cream, M(0.08, 0.56, 0.46, { s: 0.04 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.cream, M(-0.08, 0.56, 0.46, { s: 0.04 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.outline, M(0.08, 0.56, 0.49, { s: 0.02 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.outline, M(-0.08, 0.56, 0.49, { s: 0.02 }), false, { unlit: true }),
      P(GEO.cyl, t, M(0.36, 0.3, 0.14, { sx: 0.1, sy: 0.4, sz: 0.1, rz: -0.25 }), true, { name: 'armL', live: true }),
      P(GEO.cyl, t, M(-0.36, 0.3, 0.14, { sx: 0.1, sy: 0.4, sz: 0.1, rz: 0.25 }), true, { name: 'armR', live: true }),
      P(GEO.sphereLo, td, M(0.42, 0.08, 0.2, { sx: 0.14, sy: 0.09, sz: 0.14 }), true, { name: 'fistL', live: true }),
      P(GEO.sphereLo, td, M(-0.42, 0.08, 0.2, { sx: 0.14, sy: 0.09, sz: 0.14 }), true, { name: 'fistR', live: true }),
      P(GEO.sphereLo, td, M(0.14, 0.06, -0.02, { sx: 0.13, sy: 0.07, sz: 0.16 }), true, { name: 'footL', live: true }),
      P(GEO.sphereLo, td, M(-0.14, 0.06, -0.02, { sx: 0.13, sy: 0.07, sz: 0.16 }), true, { name: 'footR', live: true }),
    ];
  }

  // Shadow-Crow Swarm: a dark churning core with crows wheeling around it.
  // The crows peel away as it weakens. Flies. Silhouette: a big dark ball
  // with wings all round it.
  const BOSS_CROWS = 7;
  function bossParts() {
    const parts = [
      P(GEO.sphereLo, PALETTE.batDark, M(0, 0, 0, { s: 0.36 }), true, { name: 'core', live: true }),
      P(GEO.sphereLo, PALETTE.magic, M(0, 0, 0, { s: 0.2 }), false, { name: 'heart', live: true, unlit: true }),
      P(GEO.sphereLo, PALETTE.gold, M(0.12, 0.08, 0.32, { s: 0.05 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.gold, M(-0.12, 0.08, 0.32, { s: 0.05 }), false, { unlit: true }),
    ];
    for (let i = 0; i < BOSS_CROWS; i++) {
      parts.push(P(GEO.sphereLo, PALETTE.batDark, M(0, 0, 0, { sx: 0.1, sy: 0.08, sz: 0.14 }), true, { name: `crow${i}`, live: true }));
      parts.push(P(GEO.box, PALETTE.batDark, M(0, 0, 0, { sx: 0.4, sy: 0.02, sz: 0.14 }), true, { name: `crowWing${i}`, live: true }));
      parts.push(P(GEO.cone, PALETTE.gold, M(0, 0, 0, { sx: 0.03, sy: 0.08, sz: 0.03 }), false, { name: `crowBeak${i}`, live: true, unlit: true }));
    }
    return parts;
  }

  const WALK = {
    grunt:     { freq: 7.5, bounce: 0.09, lean: 0.1, sway: 0.08 },
    trickster: { freq: 12,  bounce: 0.15, lean: 0.25, sway: 0.16 },
    troll:     { freq: 3.6, bounce: 0.05, lean: 0.06, sway: 0.05 },
  };
  const ENEMY_RECIPES = { grunt: gruntParts, trickster: tricksterParts, troll: trollParts, bat: batParts, boss: bossParts };

  // -------- particles: a pooled dust puff --------
  const particles = [];
  function buildParticles() {
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(GEO.sphereLo, new THREE.MeshBasicMaterial({ color: PALETTE.cream, transparent: true, opacity: 0 }));
      m.visible = false;
      m.userData = { life: 0, ttl: 1, vx: 0, vy: 0, vz: 0, size: 0.1 };
      scene.add(m);
      particles.push(m);
    }
    animated.push({
      update(t, dt) {
        for (const p of particles) {
          const u = p.userData;
          if (!p.visible) continue;
          u.life += dt;
          if (u.life >= u.ttl) { p.visible = false; continue; }
          const k = u.life / u.ttl;
          u.vy -= 1.6 * dt;
          p.position.x += u.vx * dt; p.position.y += u.vy * dt; p.position.z += u.vz * dt;
          if (p.position.y < 0.03) { p.position.y = 0.03; u.vy = Math.abs(u.vy) * 0.3; }
          p.scale.setScalar(u.size * (1 - k * 0.6));
          p.material.opacity = 0.85 * (1 - k);
        }
      },
    });
  }
  function puff(x, y, z, { count = 8, color = PALETTE.cream, speed = 1.2, size = 0.1, up = 1.4, ttl = 0.6 } = {}) {
    let n = 0;
    for (const p of particles) {
      if (p.visible) continue;
      const a = Math.random() * Math.PI * 2, s = speed * (0.5 + Math.random() * 0.5);
      p.position.set(x, y, z);
      p.userData = { life: 0, ttl: ttl * (0.7 + Math.random() * 0.5), vx: Math.cos(a) * s, vy: up * (0.4 + Math.random() * 0.6), vz: Math.sin(a) * s, size: size * (0.6 + Math.random() * 0.8) };
      p.material.color.setHex(color);
      p.visible = true;
      if (++n >= count) break;
    }
  }

  // -------- projectile views: pooled acorns flying in a small arc --------
  const projPools = {};
  const projViews = new Map();
  const PROJ_MAKERS = {
    acorn() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(GEO.sphereLo, toon(PALETTE.acorn));
      body.scale.set(0.07, 0.09, 0.07); addOutline(body);
      const cap = new THREE.Mesh(GEO.dome, toon(PALETTE.acornCap));
      cap.scale.set(0.08, 0.05, 0.08); cap.position.y = 0.04;
      g.add(body, cap);
      return g;
    },
    bigacorn() {
      const g = PROJ_MAKERS.acorn();
      g.scale.setScalar(2.1);
      return g;
    },
    thorn() {
      const g = new THREE.Group();
      const ball = new THREE.Mesh(GEO.sphereLo, toon(PALETTE.magic));
      ball.scale.setScalar(0.1); addOutline(ball);
      g.add(ball);
      for (let i = 0; i < 4; i++) {
        const c = new THREE.Mesh(GEO.cone, toon(PALETTE.cloakDark));
        c.scale.set(0.03, 0.1, 0.03);
        c.position.set(Math.cos(i * 1.6) * 0.1, Math.sin(i * 1.6) * 0.1, 0);
        c.rotation.z = -i * 1.6 + Math.PI / 2;
        g.add(c);
      }
      return g;
    },
    wisp() {
      const g = new THREE.Group();
      const core = new THREE.Mesh(GEO.sphereLo, unlit(PALETTE.cream));
      core.scale.setScalar(0.05);
      const halo = new THREE.Mesh(GEO.sphereLo, unlit(PALETTE.frost, { opacity: 0.6, depthWrite: false }));
      halo.scale.setScalar(0.1);
      g.add(core, halo);
      return g;
    },
    boulder() {
      const g = new THREE.Group();
      const rock = new THREE.Mesh(GEO.rock, toon(PALETTE.stone));
      rock.scale.set(0.14, 0.12, 0.13); addOutline(rock);
      g.add(rock);
      return g;
    },
  };
  const PROJ_ARC = { acorn: 0.45, bigacorn: 1.6, thorn: 0.7, wisp: 0.15, boulder: 0.3 };
  function updateProjectileViews() {
    const live = new Set();
    for (const p of GameState.state.projectiles) {
      live.add(p.id);
      let g = projViews.get(p.id);
      if (!g) {
        const pool = projPools[p.kind] || (projPools[p.kind] = []);
        g = pool.pop();
        if (!g) { g = PROJ_MAKERS[p.kind](); g.userData.kind = p.kind; scene.add(g); }
        g.visible = true;
        projViews.set(p.id, g);
      }
      const targetY = p.targetBoss ? BOSS_HEIGHT : BAT_HEIGHT;
      const baseY = p.targetFlying ? 0.75 + p.t * (targetY - 0.75) : 0.75;
      g.position.set(p.x, baseY + Math.sin(p.t * Math.PI) * PROJ_ARC[p.kind], p.z);
      g.rotation.x += 0.4; g.rotation.z += 0.25;
    }
    for (const [id, g] of projViews) {
      if (live.has(id)) continue;
      g.visible = false;
      projViews.delete(id);
      projPools[g.userData.kind || 'x'] = projPools[g.userData.kind || 'x'] || [];
      projPools[g.userData.kind || 'x'].push(g);
    }
  }

  // -------- camera shake --------
  const shake = { amp: 0, decay: 0, x: 0, y: 0 };
  function shakeCamera(amp, dur = 0.3) {
    shake.amp = Math.max(shake.amp, amp);
    shake.decay = amp / dur;
  }

  // -------- tower views --------
  const towerViews = new Map();
  function addTowerView(tower, quiet) {
    const parts = TOWER_RECIPES[tower.type]().concat(tierParts(tower.tier));
    const g = liveProp(parts, tower.x, 0, tower.z);
    g.name = `tower-${tower.id}`;
    decal(0, 0, 0.36, g);
    const live = {};
    g.traverse((o) => { if (o.name && o !== g && o.name !== 'outline') live[o.name] = o; });
    const base = {};
    for (const k in live) base[k] = { p: live[k].position.clone(), r: live[k].rotation.clone(), s: live[k].scale.clone() };
    const v = { group: g, tower, born: GameState.state.time, live, base, windup: 0, recoil: 0 };
    towerViews.set(tower.id, v);
    if (!quiet) puff(tower.x, 0.1, tower.z, { count: 12, color: PALETTE.path, speed: 1.6, size: 0.12, up: 1.0 });
    return v;
  }
  function removeTowerView(id) {
    const v = towerViews.get(id);
    if (!v) return;
    scene.remove(v.group);
    towerViews.delete(id);
  }

  // Per-type anticipation and recoil: pull is 0..1 through the wind-up,
  // recoil is 1 right after the shot and decays.
  const TOWER_ANIM = {
    slinger(v, pull, recoil, t) {
      const back = pull * 0.16 - recoil * 0.1;
      for (const n of ['slingHandle', 'prongL', 'prongR', 'band']) {
        v.live[n].position.z = v.base[n].p.z - back;
        v.live[n].position.y = v.base[n].p.y - pull * 0.05;
      }
      v.live.hat.rotation.z = v.base.hat.r.z + Math.sin(t * 2.2 + v.tower.id + 0.5) * 0.05;
      v.live.sprout.rotation.z = -0.5 + Math.sin(t * 3 + v.tower.id) * 0.25;
      v.group.rotation.x = -pull * 0.12 + recoil * 0.18;
    },
    warden(v, pull, recoil, t) {
      const raise = pull * 0.9 - recoil * 0.5;
      for (const n of ['staff', 'thornBall', 'thorn1', 'thorn2']) {
        const b = v.base[n];
        v.live[n].position.y = b.p.y + raise * 0.22;
        v.live[n].position.z = b.p.z - raise * 0.12;
        v.live[n].rotation.x = b.r.x - raise * 0.5;
      }
      const grow = 1 + pull * 0.6 + Math.sin(t * 6) * 0.06;
      v.live.thornBall.scale.setScalar(v.base.thornBall.s.x * grow);
      v.group.rotation.x = -pull * 0.08 + recoil * 0.12;
    },
    druid(v, pull, recoil, t) {
      const hover = Math.sin(t * 3 + v.tower.id) * 0.03;
      const rise = pull * 0.25 - recoil * 0.12;
      for (const n of ['orb', 'orbCore']) {
        const b = v.base[n];
        v.live[n].position.y = b.p.y + hover + rise;
        v.live[n].position.z = b.p.z + recoil * 0.15;
      }
      v.live.orb.scale.setScalar(v.base.orb.s.x * (1 + pull * 0.5 + Math.sin(t * 8) * 0.08));
      v.live.orb.rotation.y = t * 3;
      v.group.rotation.x = recoil * 0.08;
    },
    golem(v, pull, recoil, t) {
      // fists rise high overhead, then slam down
      const lift = pull * 0.75 - recoil * 0.35;
      for (const side of ['L', 'R']) {
        const fist = v.live['fist' + side], arm = v.live['arm' + side];
        fist.position.y = v.base['fist' + side].p.y + lift;
        fist.position.z = v.base['fist' + side].p.z - lift * 0.1 + recoil * 0.2;
        arm.rotation.z = v.base['arm' + side].r.z * (1 - pull * 0.9) + (side === 'L' ? -1 : 1) * pull * 0.1;
        arm.position.y = v.base['arm' + side].p.y + lift * 0.4;
      }
      const breathe = 1 + Math.sin(t * 1.4 + v.tower.id) * 0.02;
      v.live.shoulders.scale.set(v.base.shoulders.s.x * breathe, v.base.shoulders.s.y, v.base.shoulders.s.z * breathe);
      v.group.rotation.x = -pull * 0.06 + recoil * 0.14;
    },
    artillery(v, pull, recoil, t) {
      const dip = pull * 0.35, kick = recoil * 0.3;
      for (const n of ['barrel', 'band']) {
        v.live[n].rotation.x = v.base[n].r.x + dip - kick;
        v.live[n].position.z = v.base[n].p.z - kick * 0.2;
      }
      const shown = pull > 0 || recoil < 0.2;
      v.live.loaded.visible = v.live.loadedCap.visible = shown;
      v.live.loaded.rotation.x = v.live.loadedCap.rotation.x = v.base.loaded.r.x + dip - kick;
      v.group.rotation.x = recoil * 0.1;
    },
  };
  function updateTowerViews(t, dt) {
    for (const v of towerViews.values()) {
      const age = t - v.born;
      // placement pop: sprout up from nothing with an overshoot, then settle
      let pop = 1;
      if (age < 0.5) {
        const k = age / 0.5;
        pop = 1 + Math.sin(k * Math.PI) * 0.35 * (1 - k) ;
        const grow = Math.min(1, age / 0.22);
        v.group.scale.set(grow * (2 - pop), grow * pop, grow * (2 - pop));
      } else {
        const bob = Math.sin(t * 2.2 + v.tower.id);
        v.group.scale.set(1 - 0.015 * bob, 1 + 0.03 * bob, 1 - 0.015 * bob);
      }
      const idleLook = v.tower.targetId ? 0 : Math.sin(t * 0.8 + v.tower.id * 1.7) * 0.2;
      v.group.rotation.y = v.tower.facing + idleLook;
      const type = GameState.TOWER_TYPES[v.tower.type];
      const pull = v.tower.windup > 0 ? 1 - v.tower.windup / type.windup : 0;
      v.recoil = Math.max(0, v.recoil - dt * 6);
      TOWER_ANIM[v.tower.type](v, pull, v.recoil, t);
      if (v.live.pennant) v.live.pennant.rotation.y = Math.sin(t * 6 + v.tower.id) * 0.5;
      if (v.live.pennant2) v.live.pennant2.rotation.y = Math.sin(t * 6.5 + v.tower.id) * 0.5;
      if (age >= 0.5) {
        const sq = 1 + v.recoil * 0.12;
        v.group.scale.x *= sq; v.group.scale.z *= sq; v.group.scale.y /= sq;
      }
    }
  }

  // -------- enemy views --------
  const enemyViews = new Map();
  const dying = [];   // views playing an exit animation before removal
  const BAT_HEIGHT = 0.95, BOSS_HEIGHT = 1.25;
  function addEnemyView(e) {
    const g = liveProp(ENEMY_RECIPES[e.type](), e.x, 0, e.z);
    g.name = `enemy-${e.id}`;
    const v = { group: g, e, decal: decal(0, 0, e.type === 'troll' ? 0.45 : 0.3, g), pop: 0, live: {} };
    g.traverse((o) => { if (o.name && o !== g) v.live[o.name] = o; });
    if (e.boss) {
      v.decal.scale.setScalar(0.7);
    } else if (e.flying) {
      v.wingL = v.live.wingL; v.wingR = v.live.wingR;
      v.wingL.matrixAutoUpdate = false; v.wingR.matrixAutoUpdate = false;
      v.decal.scale.setScalar(0.22);
    } else {
      v.earL = v.live.earL; v.earR = v.live.earR;
      v.footL = v.live.footL; v.footR = v.live.footR;
      if (v.earL) { v.earL.matrixAutoUpdate = false; v.earR.matrixAutoUpdate = false; }
      v.baseFootY = v.footL.position.y;
      v.walk = WALK[e.type];
    }
    // status effect dressing: frost crystals when chilled, a thorn ring when rooted
    v.frost = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(GEO.cone, unlit(PALETTE.frost));
      const a = i * 2.1;
      c.position.set(Math.cos(a) * 0.2, 0.25 + i * 0.08, Math.sin(a) * 0.2);
      c.scale.set(0.05, 0.14, 0.05); c.rotation.z = Math.cos(a) * 0.5; c.rotation.x = Math.sin(a) * 0.5;
      v.frost.add(c);
    }
    v.frost.visible = false; g.add(v.frost);
    v.roots = new THREE.Mesh(GEO.torus, toon(PALETTE.cloakDark));
    v.roots.rotation.x = Math.PI / 2; v.roots.position.y = 0.05; v.roots.scale.setScalar(0.28);
    v.roots.visible = false; g.add(v.roots);
    enemyViews.set(e.id, v);
    puff(e.x, e.flying ? BAT_HEIGHT : 0.3, e.z, { count: e.boss ? 24 : 7, color: PALETTE.spore, speed: e.boss ? 2 : 0.8, size: e.boss ? 0.16 : 0.09, up: 1.2 });
    return v;
  }
  function updateEnemyViews(t, dt) {
    for (const v of enemyViews.values()) {
      const e = v.e, g = v.group;
      v.frost.visible = !!e.chilled;
      v.roots.visible = !!e.rooted;
      if (e.chilled) v.frost.rotation.y = t * 2;
      if (e.boss) { updateBossView(v, t, dt); continue; }
      if (e.flying) { updateBatView(v, t, dt); continue; }
      const w = v.walk;
      const cycle = e.dist * w.freq;
      const bounce = e.rooted ? 0 : Math.abs(Math.sin(cycle));
      const struggle = e.rooted ? Math.sin(t * 30) * 0.03 : 0;
      const born = Math.min(1, e.age / 0.35);   // pop out of the crack
      g.position.set(e.x + struggle, w.bounce * bounce, e.z);
      g.rotation.y = Math.atan2(e.dirX, e.dirZ);
      g.rotation.x = w.lean;
      g.rotation.z = Math.sin(cycle) * w.sway + struggle * 4;
      const stretch = 0.9 + 0.22 * bounce;
      v.pop = Math.max(0, v.pop - dt * 5);
      const popK = Math.sin(Math.min(1, v.pop) * Math.PI) * 0.35;   // scale-pop when hit
      const s = born * (1 - (1 - born) * 0.5);
      g.scale.set(s * (1.06 - 0.1 * bounce + popK), s * (stretch - popK * 0.6), s * (1.06 - 0.1 * bounce + popK));
      const flap = 0.35 + 0.45 * bounce;
      if (e.type === 'grunt') {
        pivotMatrix(0.2, 0.56, 0, 0, 0, -1.2 + flap, 0, 0.13, 0, 0.07, 0.26, 0.05, v.earL.matrix);
        pivotMatrix(-0.2, 0.56, 0, 0, 0, 1.2 - flap, 0, 0.13, 0, 0.07, 0.26, 0.05, v.earR.matrix);
      } else if (e.type === 'trickster') {
        pivotMatrix(0.13, 0.62, 0, 0, 0, -1.4 + flap * 0.8, 0, 0.12, 0, 0.05, 0.24, 0.04, v.earL.matrix);
        pivotMatrix(-0.13, 0.62, 0, 0, 0, 1.4 - flap * 0.8, 0, 0.12, 0, 0.05, 0.24, 0.04, v.earR.matrix);
        v.live.leaf.rotation.z = -0.3 + Math.sin(cycle) * 0.2;
      } else if (e.type === 'troll') {
        // knuckle-walk: fists swing opposite the feet
        v.live.fistL.position.z = 0.2 - Math.sin(cycle) * 0.16;
        v.live.fistR.position.z = 0.2 + Math.sin(cycle) * 0.16;
        v.live.armL.rotation.x = -Math.sin(cycle) * 0.3; v.live.armR.rotation.x = Math.sin(cycle) * 0.3;
      }
      const stride = e.type === 'troll' ? 0.1 : 0.12;
      v.footL.position.z = 0.02 + Math.sin(cycle) * stride;
      v.footR.position.z = 0.02 - Math.sin(cycle) * stride;
      v.footL.position.y = v.baseFootY + Math.max(0, Math.sin(cycle)) * 0.06 - w.bounce * bounce;
      v.footR.position.y = v.baseFootY + Math.max(0, -Math.sin(cycle)) * 0.06 - w.bounce * bounce;
      v.decal.scale.setScalar((e.type === 'troll' ? 0.45 : 0.3) * (1 - 0.3 * bounce));
      v.decal.position.y = 0.012 - w.bounce * bounce;   // keep the shadow flat on the ground while the body hops
    }
    for (let i = dying.length - 1; i >= 0; i--) {
      const d = dying[i];
      d.t += dt;
      const k = d.t / d.dur;
      if (k >= 1) { scene.remove(d.group); dying.splice(i, 1); continue; }
      d.update(k);
    }
  }
  function updateBossView(v, t, dt) {
    const e = v.e, g = v.group;
    const born = Math.min(1, e.age / 0.6);
    v.pop = Math.max(0, v.pop - dt * 5);
    const popK = Math.sin(Math.min(1, v.pop) * Math.PI) * 0.2;
    const bob = Math.sin(t * 2.2) * 0.1;
    g.position.set(e.x, BOSS_HEIGHT + bob, e.z);
    g.rotation.y = Math.atan2(e.dirX, e.dirZ);
    g.scale.setScalar(born * (1 + popK));
    v.live.heart.scale.setScalar(0.2 + Math.sin(t * 9) * 0.04 + popK);
    v.live.core.rotation.y = t * 0.8; v.live.core.rotation.x = Math.sin(t) * 0.3;
    const alive = Math.max(1, Math.ceil(BOSS_CROWS * e.hp / e.maxHp));
    for (let i = 0; i < BOSS_CROWS; i++) {
      const show = i < alive;
      const a = t * 2.2 + i * (Math.PI * 2 / BOSS_CROWS);
      const r = 0.55 + Math.sin(t * 3 + i) * 0.08, y = Math.sin(t * 4 + i * 1.3) * 0.16;
      const body = v.live[`crow${i}`], wing = v.live[`crowWing${i}`], beak = v.live[`crowBeak${i}`];
      body.visible = wing.visible = beak.visible = show;
      if (!show) continue;
      body.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      body.rotation.y = -a;   // nose along the orbit
      wing.position.copy(body.position);
      wing.rotation.y = -a; wing.rotation.z = Math.sin(t * 20 + i) * 0.7;
      beak.position.set(Math.cos(a) * r - Math.sin(a) * 0.14, y, Math.sin(a) * r + Math.cos(a) * 0.14);
      beak.rotation.set(Math.PI / 2, 0, 0); beak.rotation.y = -a;
    }
    v.decal.position.y = -(BOSS_HEIGHT + bob) + 0.012;
    v.decal.scale.setScalar(0.7 - bob * 0.5);
  }
  function updateBatView(v, t, dt) {
    const e = v.e, g = v.group;
    const born = Math.min(1, e.age / 0.35);
    const flap = Math.sin(t * 18 + e.id) * 0.75;
    const bob = Math.sin(t * 4 + e.id) * 0.08;
    v.pop = Math.max(0, v.pop - dt * 5);
    const popK = Math.sin(Math.min(1, v.pop) * Math.PI) * 0.35;
    g.position.set(e.x, BAT_HEIGHT + bob, e.z);
    g.rotation.y = Math.atan2(e.dirX, e.dirZ);
    g.rotation.z = Math.sin(t * 2.5 + e.id) * 0.15;
    g.scale.set(born * (1 + popK), born * (1 - popK * 0.5), born * (1 + popK));
    pivotMatrix(0.12, 0.02, 0, 0, 0, flap, 0.26, 0, 0, 0.52, 0.02, 0.3, v.wingL.matrix);
    pivotMatrix(-0.12, 0.02, 0, 0, 0, -flap, -0.26, 0, 0, 0.52, 0.02, 0.3, v.wingR.matrix);
    v.decal.position.y = -(BAT_HEIGHT + bob) + 0.012;   // shadow stays on the ground
  }
  function removeEnemyView(e, exit) {
    const v = enemyViews.get(e.id);
    if (!v) return;
    enemyViews.delete(e.id);
    exit(v);
  }
  // Silly death: a surprised hop, a fast spin, a stretch, then a puff of smoke.
  function deathExit(v) {
    const g = v.group;
    const y0 = g.position.y, s0 = g.scale.clone();
    let puffed = false;
    dying.push({
      group: g, t: 0, dur: 0.55,
      update(k) {
        const hop = Math.sin(Math.min(1, k * 1.6) * Math.PI);
        g.position.y = v.e.flying ? Math.max(0.1, y0 - k * k * (v.e.boss ? 1.4 : 1.1)) : y0 + hop * 0.5;
        g.rotation.y += 0.7;
        g.rotation.x = 0.1 + k * 0.4;
        const shrink = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        g.scale.set(s0.x * (1 - k * 0.35) * shrink, s0.y * (1 + hop * 0.6) * shrink, s0.z * (1 - k * 0.35) * shrink);
        if (k > 0.62 && !puffed) {
          puffed = true;
          const big = v.e.boss ? 3 : 1;
          puff(g.position.x, 0.45, g.position.z, { count: 12 * big, color: PALETTE.cream, speed: 1.6 * big, size: 0.13, up: 1.2, ttl: 0.7 });
          puff(g.position.x, 0.4, g.position.z, { count: 6 * big, color: v.e.flying ? PALETTE.batDark : PALETTE.goblin, speed: 2.2, size: 0.08, up: 2.2, ttl: 0.6 });
          if (v.e.boss) { puff(g.position.x, 0.6, g.position.z, { count: 16, color: PALETTE.magic, speed: 3, size: 0.1, up: 2.5, ttl: 0.9 }); shakeCamera(0.16, 0.6); }
        }
      },
    });
  }

  // Leak: the goblin squeezes through the gate with a spin and a puff.
  function leakExit(v) {
    const g = v.group;
    const x0 = g.position.x, z0 = g.position.z;
    const gate = GameState.gate;
    dying.push({
      group: g, t: 0, dur: 0.38,
      update(k) {
        g.position.x = x0 + (gate.x - x0) * k;
        g.position.z = z0 + (gate.z - 0.25 - z0) * k;
        g.position.y = 0.15 * Math.sin(k * Math.PI);
        g.rotation.y += 0.6;
        const s = (1 - k) * (1 + 0.3 * Math.sin(k * Math.PI));
        g.scale.set(s * 1.1, s * 0.8, s * 1.1);
      },
    });
    puff(gate.x, 0.3, gate.z + 0.1, { count: 10, color: PALETTE.stone, speed: 1.4, size: 0.11 });
    shakeCamera(0.09, 0.35);
  }

  // -------- selection, range preview --------
  let rangeRing, rangeDisc;
  function buildSelection() {
    const ringGeo = new THREE.RingGeometry(0.34, 0.44, 24);
    ringGeo.rotateX(-Math.PI / 2);
    selectionRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.95, depthWrite: false }));
    selectionRing.position.y = 0.02;
    selectionRing.visible = false;
    scene.add(selectionRing);
    rejectRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff5a6e, transparent: true, opacity: 0.9, depthWrite: false }));
    rejectRing.position.y = 0.02;
    rejectRing.visible = false;
    scene.add(rejectRing);
    // range preview: a thin ring plus a faint disc, sized per tower type
    const rg = new THREE.RingGeometry(0.96, 1, 64);
    rg.rotateX(-Math.PI / 2);
    rangeRing = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: PALETTE.cream, transparent: true, opacity: 0.7, depthWrite: false }));
    rangeRing.position.y = 0.016;
    rangeRing.visible = false;
    scene.add(rangeRing);
    rangeDisc = new THREE.Mesh(GEO.circle, new THREE.MeshBasicMaterial({ color: PALETTE.cream, transparent: true, opacity: 0.1, depthWrite: false }));
    rangeDisc.position.y = 0.014;
    rangeDisc.visible = false;
    scene.add(rangeDisc);

    animated.push({
      update(t, dt) {
        const sel = GameState.state.selected;
        selectionRing.visible = !!sel;
        rangeRing.visible = rangeDisc.visible = !!sel;
        if (sel) {
          const x = worldX(sel.c), z = worldZ(sel.r);
          selectionRing.position.x = x; selectionRing.position.z = z;
          const s = 1 + 0.06 * Math.sin(t * 5);
          selectionRing.scale.set(s, 1, s);
          selectionRing.rotation.y = t * 0.6;
          const range = sel.kind === 'tower'
            ? (GameState.state.towers.find((tw) => tw.id === sel.id) || { range: 0 }).range
            : GameState.TOWER_TYPES[UI.previewType()].range;
          rangeRing.position.x = rangeDisc.position.x = x;
          rangeRing.position.z = rangeDisc.position.z = z;
          rangeRing.scale.set(range, 1, range);
          rangeDisc.scale.set(range, 1, range);
          rangeRing.material.opacity = sel.kind === 'tower' ? 0.75 : 0.45 + 0.15 * Math.sin(t * 4);
        }
        if (rejectTimer > 0) {
          rejectTimer -= dt;
          rejectRing.visible = rejectTimer > 0;
          const k = Math.max(0, rejectTimer / 0.4);
          rejectRing.material.opacity = k;
          rejectRing.position.x = worldX(rejectCell.c) + Math.sin(rejectTimer * 60) * 0.05 * k;
          rejectRing.position.z = worldZ(rejectCell.r);
          rejectRing.scale.setScalar(1.2 - 0.2 * k);
        }
      },
    });
    GameState.on('tileRejected', (res) => {
      if (!GameState.inGrid(res.c, res.r)) return;
      rejectTimer = 0.4;
      rejectCell = res;
    });
    GameState.on('towerPlaced', addTowerView);
    GameState.on('enemySpawned', addEnemyView);
    GameState.on('enemyLeaked', (e) => removeEnemyView(e, leakExit));
    GameState.on('enemyKilled', (e) => removeEnemyView(e, deathExit));
    GameState.on('enemyHit', ({ enemy, x, z }) => {
      const v = enemyViews.get(enemy.id);
      if (v) v.pop = 1;
      puff(x, 0.45, z, { count: 3, color: PALETTE.cream, speed: 1.0, size: 0.06, up: 1.0, ttl: 0.35 });
    });
    GameState.on('towerFired', ({ tower }) => {
      const v = towerViews.get(tower.id);
      if (v) v.recoil = 1;
      if (tower.type === 'golem') shakeCamera(0.04, 0.2);
    });
    GameState.on('towerUpgraded', (tower) => {
      removeTowerView(tower.id);
      addTowerView(tower, true);
      puff(tower.x, 0.5, tower.z, { count: 14, color: PALETTE.gold, speed: 1.4, size: 0.09, up: 2.0, ttl: 0.8 });
    });
    GameState.on('towerSold', ({ tower }) => {
      removeTowerView(tower.id);
      puff(tower.x, 0.2, tower.z, { count: 10, color: PALETTE.path, speed: 1.4, size: 0.11, up: 1.0 });
      puff(tower.x, 0.5, tower.z, { count: 5, color: PALETTE.gold, speed: 1.0, size: 0.08, up: 1.8 });
    });
    GameState.on('projectileHit', ({ projectile: p, x, z, flying }) => {
      const y = flying ? BAT_HEIGHT : 0.45;
      if (p.kind === 'thorn') {
        puff(x, 0.2, z, { count: 14, color: PALETTE.magic, speed: 2.4, size: 0.08, up: 0.9, ttl: 0.5 });
        puff(x, 0.2, z, { count: 8, color: PALETTE.cloak, speed: 1.6, size: 0.1, up: 1.4, ttl: 0.6 });
      } else if (p.kind === 'wisp') {
        puff(x, y, z, { count: 6, color: PALETTE.frost, speed: 1.2, size: 0.07, up: 0.6, ttl: 0.45 });
      } else if (p.kind === 'boulder') {
        puff(x, 0.2, z, { count: 12, color: PALETTE.stone, speed: 2.0, size: 0.11, up: 1.6, ttl: 0.6 });
        shakeCamera(0.1, 0.3);
      } else if (p.kind === 'bigacorn') {
        puff(x, y, z, { count: 12, color: PALETTE.acorn, speed: 2.6, size: 0.1, up: 1.8, ttl: 0.6 });
        puff(x, y, z, { count: 8, color: PALETTE.cream, speed: 1.4, size: 0.12, up: 1.0, ttl: 0.7 });
        shakeCamera(0.06, 0.25);
      }
    });
  }

  // -------- camera --------
  const camBase = new THREE.Vector3(), camRight = new THREE.Vector3(), camUp = new THREE.Vector3();
  function placeCamera() {
    const el = THREE.MathUtils.degToRad(CONFIG.cameraElevation);
    const yaw = THREE.MathUtils.degToRad(CONFIG.cameraYaw);
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el));
    camera.position.copy(dir.multiplyScalar(40));
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    camBase.copy(camera.position);
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    camUp.setFromMatrixColumn(camera.matrixWorld, 1);
  }
  function fitCamera() {
    const aspect = cssW / cssH;
    const box = new THREE.Box3(
      new THREE.Vector3(-cols / 2 - 0.9, -tileHeight, -rows / 2 - 0.6),
      new THREE.Vector3(cols / 2 + 0.9, 4.6, rows / 2 + 0.6),
    );
    const inv = camera.matrixWorldInverse;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const v = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(inv);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    let hw = (maxX - minX) / 2, hh = (maxY - minY) / 2;
    if (hw / hh > aspect) hh = hw / aspect; else hw = hh * aspect;
    camera.left = cx - hw; camera.right = cx + hw;
    camera.top = cy + hh; camera.bottom = cy - hh;
    camera.near = 1; camera.far = 100;
    camera.updateProjectionMatrix();
    unitsPerPixel = (hw * 2) / cssW;
    outlineMat.uniforms.thickness.value = CONFIG.outlinePx * unitsPerPixel;
  }

  function resize() {
    cssW = Math.max(1, window.innerWidth);
    cssH = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio));
    renderer.setSize(cssW, cssH, false);
    fitCamera();
  }

  // -------- picking --------
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  function screenToCell(x, y) {
    const ndc = new THREE.Vector2((x / cssW) * 2 - 1, -(y / cssH) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
    return { c: Math.floor(hit.x + cols / 2), r: Math.floor(hit.z + rows / 2) };
  }

  function worldToScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: (v.x + 1) / 2 * cssW, y: (1 - v.y) / 2 * cssH };
  }

  // Handed to a level's buildScene(): the private Renderer primitives a
  // level needs to build its own set-pieces, plus its own data. Anything
  // already public on GameState (isBuildable, cellKind, zoneFalloff, on, ...)
  // is available to level files directly as a global, no kit needed.
  function makeKit() {
    return {
      P, M, GEO, PALETTE, batchPart, batchDecal, liveProp, decal, colored,
      toon, unlit, addOutline, srand, lerpColor, shakeCamera, puff,
      treeParts, deadTreeParts, rockParts, mushroomParts, tuftParts, flowerParts, acornParts,
      worldX, worldZ, cols, rows, border,
      scene, animated,
      level: GameState.currentLevel(),
    };
  }

  // -------- init / frame --------
  function init(canvasEl) {
    canvas = canvasEl;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(PALETTE.backdrop);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 100);

    gradientMap = new THREE.DataTexture(new Uint8Array([128, 199, 255]), 3, 1, THREE.LuminanceFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.generateMipmaps = false;
    gradientMap.needsUpdate = true;
    outlineMat = makeOutlineMaterial();
    buildPrimitives();

    scene.add(new THREE.AmbientLight(0xffffff, 0.38));
    const sun = new THREE.DirectionalLight(0xfff0d8, 0.68);
    sun.position.set(-6, 10, 7);
    scene.add(sun);

    cols = GameState.cols; rows = GameState.rows;
    placeCamera();
    buildGround();
    GameState.currentLevel().buildScene(makeKit());
    buildParticles();
    buildSelection();
    flushBatch();

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 60));
  }

  function render(t, dt) {
    for (const a of animated) a.update(t, dt);
    updateTowerViews(t, dt);
    updateEnemyViews(t, dt);
    updateProjectileViews();
    if (shake.amp > 0) {
      shake.amp = Math.max(0, shake.amp - shake.decay * dt);
      shake.x = (Math.random() - 0.5) * 2 * shake.amp;
      shake.y = (Math.random() - 0.5) * 2 * shake.amp;
    } else { shake.x = shake.y = 0; }
    camera.position.copy(camBase).addScaledVector(camRight, shake.x).addScaledVector(camUp, shake.y);
    renderer.render(scene, camera);
  }

  function stats() {
    const r = renderer.info.render;
    return { calls: r.calls, triangles: r.triangles };
  }

  return { init, render, resize, screenToCell, worldToScreen, stats, shakeCamera, puff, debugScene: () => scene, debugViews: () => ({ enemyViews: enemyViews.size, dying: dying.map((d) => [+d.t.toFixed(3), d.dur]), towerViews: towerViews.size }) };
})();