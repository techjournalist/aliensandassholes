// ===================================================================
// Renderer  (all three.js; reads GameState, never writes it; level-
// specific set dressing lives in each level's buildScene(), see
// js/level1-hollybrook.js and js/level-common.js for the pattern)
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

  // A level's `theme` object can override the "healthy ground" palette and
  // mood; the corruption blend itself always targets the shared
  // PALETTE.hollowGround, so danger reads the same everywhere.
  function levelTheme() {
    const t = GameState.currentLevel().theme;
    const ambient = t.ambient ?? 0.38;
    return {
      backdrop: t.backdrop ?? PALETTE.backdrop,
      meadow: t.groundMeadow ?? PALETTE.meadow,
      meadowDark: t.groundMeadowDark ?? PALETTE.meadowDark,
      ambient,
      // warm sky over earthy bounce light, a warm key sun and a cool fill
      // from the opposite side: shadows read cool, lit faces read warm
      sky: t.sky ?? 0xfff4e2,
      bounce: t.bounce ?? 0x6e5b3e,
      hemi: ambient * 1.05,
      sun: t.sun ?? 0.6,
      fill: t.fill ?? 0x9db4dc,
      fillIntensity: t.fillIntensity ?? 0.14,
      motes: t.motes ?? {},
    };
  }

  // Lower-end touch devices get fewer grass blades and motes.
  const QUALITY = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 0.55 : 1;
  // Ambient effects (water, grass, motes) run on wall-clock time so the
  // world keeps breathing on the title screen and while paused.
  const fxTime = { value: 0 }, moteScale = { value: 1 };
  let fxLast = 0, fxT = 0;

  // Baked ambient occlusion: vertex shade darkens where geometry meets the
  // ground, less so on upward faces (a plank lying flat isn't a crevice).
  function aoAt(y, ny) {
    const k = Math.min(1, Math.max(0, y / 0.42));
    const ao = 0.7 + 0.3 * k * k * (3 - 2 * k);
    const up = Math.max(0, ny);
    return ao + (1 - ao) * up * up * 0.7;
  }
  function aoColors(g) {
    const p = g.attributes.position, n = g.attributes.normal;
    const arr = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const a = aoAt(p.getY(i), n.getY(i));
      arr[i * 3] = a; arr[i * 3 + 1] = a; arr[i * 3 + 2] = a;
    }
    return new THREE.BufferAttribute(arr, 3);
  }

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
    GEO.ring = new THREE.TorusGeometry(1, 0.045, 4, 20);
    GEO.bead = new THREE.SphereGeometry(1, 6, 4);   // tiny details: eyes, spots, fruit, scallops
    const petal = new THREE.Shape();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2, rr = 0.55 + 0.45 * Math.abs(Math.cos(a * 2.5));
      if (i === 0) petal.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else petal.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    GEO.petals = new THREE.ShapeGeometry(petal);
    GEO.petals.rotateX(-Math.PI / 2);
    GEO.circle = new THREE.CircleGeometry(1, 18);
    // a longbow: a 135-degree arc bulging toward +z, its tips level with the origin's z + 0.38
    GEO.bow = new THREE.TorusGeometry(1, 0.06, 5, 14, Math.PI * 0.75);
    GEO.bow.rotateZ(-Math.PI * 0.375);
    GEO.bow.rotateY(-Math.PI / 2);
    // a leathery wing with a scalloped trailing edge, spanning +x from the
    // shoulder (wingR mirrors it), 1 unit thick so a matrix sets its thickness
    const wingPts = [[0, 0.16], [0.45, 0.34], [1, 0.26], [0.82, -0.08], [0.7, 0.02], [0.5, -0.24], [0.4, -0.08], [0.2, -0.3], [0, -0.2]];
    for (const [k, sgn] of [['wingL', 1], ['wingR', -1]]) {
      const pts = wingPts.map(([x, y]) => new THREE.Vector2(x * sgn, y));
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(sgn > 0 ? pts : pts.reverse()), { depth: 1, bevelEnabled: false });
      g.rotateX(Math.PI / 2);
      g.translate(0, 0.5, 0);
      g.computeVertexNormals();
      GEO[k] = g;
    }
    for (const k in GEO) { if (GEO[k].index) GEO[k] = GEO[k].toNonIndexed(); }
    // circle should lie flat on the ground
    GEO.circle.rotateX(-Math.PI / 2);
    // soft contact shadow: wider than the old hard disc since its edge fades
    GEO.shadowDisc = GEO.circle.clone();
    GEO.shadowDisc.scale(1.35, 1, 1.35);
  }

  let _shadowMat = null;
  function shadowMat() {
    return _shadowMat || (_shadowMat = new THREE.MeshBasicMaterial({
      color: 0x1b120a, map: RendererFX.shadowTexture(), transparent: true, opacity: 0.5, depthWrite: false,
    }));
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
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        thickness: { value: 0.04 },
        color: { value: new THREE.Color(PALETTE.outline) },
      }]),
      vertexShader: `
        uniform float thickness;
        #include <fog_pars_vertex>
        void main() {
          vec3 n = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          mvPosition.xyz += n * thickness;   // view-space push: constant width under an ortho camera
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 color;
        #include <fog_pars_fragment>
        void main() {
          gl_FragColor = vec4(color, 1.0);
          #include <fog_fragment>
        }`,
      side: THREE.BackSide,
      fog: true,
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
    const withUv = geos.length > 0 && geos.every((g) => g.attributes.uv);
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
    const col = withColor ? new Float32Array(count * 3) : null;
    const uv = withUv ? new Float32Array(count * 2) : null;
    let off = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, off * 3);
      nor.set(g.attributes.normal.array, off * 3);
      if (col) col.set(g.attributes.color.array, off * 3);
      if (uv) uv.set(g.attributes.uv.array, off * 2);
      off += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
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
    if (!grp) { grp = { mat: part.unlit ? unlit(part.color) : toon(part.color, { vc: true }), geos: [], ao: !part.unlit }; batch.groups.set(matKey, grp); }
    if (grp.ao) g.setAttribute('color', aoColors(g));
    grp.geos.push(g);
    if (part.outline) batch.outlines.push(smoothedForOutline(part.geo).clone().applyMatrix4(m));
  }
  function batchDecal(x, z, radius) {
    batch.decals.push(GEO.shadowDisc.clone().applyMatrix4(M(x, 0.012, z, { s: radius })));
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
      const mesh = new THREE.Mesh(mergeGeoms(batch.decals), shadowMat());
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = 1;
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
  function liveProp(parts, x, y, z, opts = {}) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const ao = opts.ao !== false;
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
      const geo = colored(p.geo.clone().applyMatrix4(p.m), p.color);
      if (ao && !p.unlit) {
        const c = geo.attributes.color, a = aoColors(geo);
        for (let i = 0; i < c.array.length; i++) c.array[i] *= a.array[i];
      }
      (p.unlit ? unlitGeos : toonGeos).push(geo);
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
    const d = new THREE.Mesh(GEO.shadowDisc, shadowMat());
    d.renderOrder = 1;
    d.position.set(x, 0.012, z);
    d.scale.setScalar(radius);
    (parent || scene).add(d);
    return d;
  }

  // -------- architectural detail (shared by every level's endpoint) --------
  // All of it goes through batchPart, so a building gains texture without
  // gaining draw calls; the glow halos share one additive mesh.
  const shade = (c, k) => lerpColor(c, PALETTE.outline, k).getHex();

  // Masonry: staggered, slightly proud blocks across a flat wall face so it
  // reads as laid courses, not one smooth box. `face` is 'z' (u runs along x)
  // or 'x' (u runs along z); `at` is the face's coordinate, `sign` its normal.
  // `holes` ([u, y, w, h]) keeps blocks off windows and doors.
  function masonry(wm, { face, at, sign = 1, u0, u1, y0, y1, holes = [], seed = 1 }) {
    const rng = srand(seed), course = 0.2;
    let row = 0;
    for (let y = y0 + course / 2; y < y1 - course * 0.3; y += course, row++) {
      let u = u0 + (row % 2 ? 0.13 : 0.02);
      for (;;) {
        const w = 0.2 + rng() * 0.16, uc = u + w / 2;
        u += w + 0.03;
        if (uc + w / 2 > u1) break;
        if (rng() < 0.42) continue;
        if (holes.some(([hu, hy, hw, hh]) => Math.abs(uc - hu) < (hw + w) / 2 + 0.03 && Math.abs(y - hy) < (hh + course) / 2 + 0.02)) continue;
        const col = rng() < 0.55 ? PALETTE.cobble : PALETTE.stoneDark;
        const off = at + sign * 0.006, h = course - 0.045;
        const m = face === 'z' ? M(uc, y, off, { sx: w, sy: h, sz: 0.025 }) : M(off, y, uc, { sx: 0.025, sy: h, sz: w });
        batchPart(P(GEO.box, col, m, false), wm);
      }
    }
  }
  // The same idea wrapped around a round tower, on the half facing the camera.
  function towerCourses(wm, { x, z, r, y0, y1, holes = [], seed = 1 }) {
    const rng = srand(seed), course = 0.2;
    let row = 0;
    for (let y = y0 + course / 2; y < y1 - course * 0.3; y += course, row++) {
      for (let a = -1.7 + (row % 2) * 0.25; a < 1.7; a += 0.5) {
        if (rng() < 0.45) continue;
        if (holes.some(([ha, hy, hh]) => Math.abs(a - ha) < 0.55 && Math.abs(y - hy) < hh / 2 + course * 0.6)) continue;
        const col = rng() < 0.55 ? PALETTE.cobble : PALETTE.stoneDark;
        const rr = r * 0.985;
        batchPart(P(GEO.box, col, M(x + Math.sin(a) * rr, y, z + Math.cos(a) * rr, { sx: r * 0.42, sy: course - 0.045, sz: 0.04, ry: a }), false), wm);
      }
    }
  }
  // Shingle courses on a dome or cone roof: darker rings stepping down the
  // roof, plus a scalloped eave. `y` is the roof's base, `h` its height.
  function roofCourses(wm, { x, y, z, r, h, color, kind = 'dome', rings = 3, ez = 1 }) {
    const ring = shade(color, 0.2), eave = shade(color, 0.1);
    for (let i = 1; i <= rings; i++) {
      const k = i / (rings + 1);
      let rad, ry;
      if (kind === 'dome') { const phi = k * Math.PI / 2; rad = r * Math.sin(phi); ry = y + h * Math.cos(phi); }
      else { rad = r * k; ry = y + h * (1 - k); }
      batchPart(P(GEO.ring, ring, M(x, ry, z, { sx: rad * 1.015, sy: rad * 1.015 * ez, sz: rad * 1.015, rx: Math.PI / 2 }), false), wm);
    }
    const n = Math.max(8, Math.round(r * 22 * (1 + ez) / 2)), sc = Math.min(r * 0.2, 0.11);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      batchPart(P(GEO.bead, eave, M(x + Math.cos(a) * r * 0.97, y + 0.01, z + Math.sin(a) * r * 0.97 * ez, { sx: sc, sy: 0.045, sz: sc }), false), wm);
    }
  }
  // Window dressing: a wooden frame, stone sill and lintel, a cross of
  // leading, and a warm halo spilling onto the wall. `axis` is the wall's
  // normal axis ('z' or 'x'), `sign` its direction.
  const glowGeos = [];
  let glowMat = null, glowK = 1;
  function glow(x, y, z, { w = 0.5, h = 0.5, axis = 'cam', sign = 1 } = {}) {
    const g = new THREE.PlaneGeometry(w, h).toNonIndexed();
    if (axis === 'cam') g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(camera.quaternion));
    else if (axis === 'x') g.rotateY(sign * Math.PI / 2);
    else if (sign < 0) g.rotateY(Math.PI);
    g.translate(x, y, z);
    glowGeos.push(g);
  }
  function windowDress(wm, x, y, z, axis, { w = 0.16, h = 0.24, sign = 1, halo = true } = {}) {
    const d = (n) => (axis === 'z' ? [0, 0, n * sign] : [n * sign, 0, 0]);
    const at = (du, dy, dn, sx, sy, sn) => {
      const [ox, , oz] = d(dn);
      return axis === 'z'
        ? M(x + du + ox, y + dy, z + oz, { sx, sy, sz: sn })
        : M(x + ox, y + dy, z + du + oz, { sx: sn, sy, sz: sx });
    };
    const fw = 0.035;
    batchPart(P(GEO.box, PALETTE.wood, at(-(w + fw) / 2, 0, 0.02, fw, h + fw * 2, 0.04), false), wm);
    batchPart(P(GEO.box, PALETTE.wood, at((w + fw) / 2, 0, 0.02, fw, h + fw * 2, 0.04), false), wm);
    batchPart(P(GEO.box, PALETTE.stoneDark, at(0, h / 2 + fw, 0.025, w + fw * 3.4, fw * 1.4, 0.05)), wm);
    batchPart(P(GEO.box, PALETTE.cobble, at(0, -h / 2 - fw * 0.8, 0.04, w + fw * 3, fw, 0.08)), wm);
    batchPart(P(GEO.box, PALETTE.outline, at(0, 0, 0.03, 0.014, h, 0.012), false), wm);
    batchPart(P(GEO.box, PALETTE.outline, at(0, h * 0.08, 0.03, w, 0.014, 0.012), false), wm);
    if (halo) {
      const p = new THREE.Vector3(...d(0.02)).add(new THREE.Vector3(x, y, z)).applyMatrix4(wm);
      glow(p.x, p.y, p.z, { w: w * 3.6, h: h * 2.6, axis, sign });
    }
  }
  function setGlow(k) { glowK = k; }
  function flushGlow() {
    if (!glowGeos.length) return;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.4)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
    glowMat = new THREE.MeshBasicMaterial({
      color: PALETTE.windowWarm, map: new THREE.CanvasTexture(c), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5,
    });
    const mesh = new THREE.Mesh(mergeGeoms(glowGeos), glowMat);
    mesh.name = 'glow';
    mesh.renderOrder = 2;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    animated.push({ update(t) { glowMat.opacity = glowK * (0.44 + 0.06 * Math.sin(t * 7.3) * Math.sin(t * 2.9)); } });
  }
  // Banner cloth: a swallowtailed field with a trim border, a stripe and a
  // round emblem, painted in vertex color. Centered on its origin, `w` wide,
  // so a level's existing wave animation keeps working unchanged. `tattered`
  // tears ragged holes out of the fly end.
  function bannerGeo(w, h, { field, stripe, trim = PALETTE.gold, emblem = PALETTE.cream, tattered = 0, seed = 3 }) {
    const g = new THREE.PlaneGeometry(w, h, 20, 10);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    const notch = w * 0.16;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), u = (x + w / 2) / w, v = Math.abs(y) / (h / 2);
      let hex = field;
      if (v < 0.2) hex = stripe;
      const ex = (u - 0.38) * w, er = Math.hypot(ex, y) / (h * 0.3);
      if (er < 1) hex = er < 0.55 ? stripe : emblem;
      if (u < 0.07 || v > 0.84) hex = trim;
      c.setHex(hex);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      p.setX(i, x - notch * u ** 4 * (1 - v));
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    if (tattered) {
      const rng = srand(seed), idx = g.index.array, keep = [];
      for (let f = 0; f < idx.length; f += 3) {
        const u = (p.getX(idx[f]) + w / 2) / w;
        if (u > 0.5 && rng() < tattered * (u - 0.5) * 2) continue;
        keep.push(idx[f], idx[f + 1], idx[f + 2]);
      }
      g.setIndex(keep);
    }
    return g;
  }

  // -------- prop recipes (each returns a parts list in local space) --------
  const P = (geo, color, m, outline = true, extra = {}) => ({ geo, color, m, outline, ...extra });

  function treeParts(rng) {
    const h = 0.7 + rng() * 0.5, r = 0.42 + rng() * 0.28;
    const top = h * 0.62;
    const parts = [
      P(GEO.cylTaper, PALETTE.wood, M(0, h * 0.35, 0, { sx: 0.11, sy: h * 0.7, sz: 0.11 })),
    ];
    // root flares splay out where the trunk meets the ground
    const roots = 3 + Math.floor(rng() * 2), ra = rng() * 6;
    for (let i = 0; i < roots; i++) {
      const a = ra + i * (Math.PI * 2 / roots);
      parts.push(P(GEO.cone, PALETTE.wood, M(Math.cos(a) * 0.1, 0.05, Math.sin(a) * 0.1,
        { sx: 0.06, sy: 0.22, sz: 0.05, rz: -Math.cos(a) * 1.25, rx: Math.sin(a) * 1.25 }), false));
    }
    // canopy: a dark core, then lighter lobes toward the sun (upper left)
    parts.push(P(GEO.sphereMid, PALETTE.meadowDark, M(0, top + r * 0.7, 0, { sx: r, sy: r * 0.9, sz: r })));
    const lobes = 3, la = rng() * 6;
    for (let i = 0; i < lobes; i++) {
      const a = la + i * (Math.PI * 2 / lobes), d = r * (0.55 + rng() * 0.15);
      parts.push(P(GEO.sphereLo, PALETTE.meadowDark, M(Math.cos(a) * d, top + r * (0.5 + rng() * 0.3), Math.sin(a) * d, { s: r * (0.48 + rng() * 0.12) })));
    }
    parts.push(P(GEO.sphereLo, PALETTE.meadow, M(r * 0.4, top + r * 1.15, r * 0.2, { s: r * 0.7 })));
    parts.push(P(GEO.sphereLo, PALETTE.meadowLight, M(-r * 0.38, top + r * 1.28, -r * 0.05, { s: r * 0.58 })));
    // the odd fruit or blossom, so a grove isn't a wall of identical green
    if (rng() < 0.45) {
      const fc = rng() < 0.5 ? PALETTE.capRed : PALETTE.flowerYellow;
      for (let i = 0; i < 3; i++) {
        const a = rng() * 6.28, d = r * 0.9;
        parts.push(P(GEO.bead, fc, M(Math.cos(a) * d, top + r * (0.6 + rng() * 0.6), Math.sin(a) * d, { s: 0.045 }), false));
      }
    }
    return { parts, radius: r * 0.9 };
  }
  function deadTreeParts(rng) {
    const h = 0.9 + rng() * 0.7, lean = (rng() - 0.5) * 0.5;
    const parts = [
      P(GEO.cylTaper, PALETTE.hollowWood, M(0, h / 2, 0, { sx: 0.12, sy: h, sz: 0.12, rz: lean })),
    ];
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + rng();
      parts.push(P(GEO.cone, PALETTE.hollowWood, M(Math.cos(a) * 0.11, 0.05, Math.sin(a) * 0.11,
        { sx: 0.06, sy: 0.24, sz: 0.05, rz: -Math.cos(a) * 1.3, rx: Math.sin(a) * 1.3 }), false));
    }
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
    // a smoldering ember still glowing in the charred trunk
    if (rng() < 0.6) parts.push(P(GEO.dome, PALETTE.spore, M(Math.sin(lean) * -h * 0.15, h * 0.3, 0.1, { sx: 0.1, sy: 0.04, sz: 0.08 }), false));
    return { parts, radius: 0.25 };
  }
  function mushroomParts(rng, big) {
    const s = big ? 0.55 + rng() * 0.25 : 0.22 + rng() * 0.12;
    const tilt = (rng() - 0.5) * 0.25;
    const parts = [
      P(GEO.cylTaper, PALETTE.cream, M(0, s * 0.45, 0, { sx: s * 0.3, sy: s * 0.9, sz: s * 0.3, rz: tilt })),
      // gills: a pale disc tucked under the cap
      P(GEO.cyl, PALETTE.skin, M(0, s * 0.79, 0, { sx: s * 0.7, sy: s * 0.04, sz: s * 0.7, rz: tilt }), false),
      P(GEO.dome, PALETTE.capRed, M(0, s * 0.8, 0, { sx: s * 0.75, sy: s * 0.55, sz: s * 0.75, rz: tilt })),
    ];
    // a skirt ring on the bigger ones
    if (big) parts.push(P(GEO.torus, PALETTE.cream, M(0, s * 0.6, 0, { sx: s * 0.3, sy: s * 0.3, sz: s * 0.5, rx: Math.PI / 2 }), false));
    const spots = big ? 4 + Math.floor(rng() * 3) : 2 + Math.floor(rng() * 2);
    for (let i = 0; i < spots; i++) {
      const a = rng() * Math.PI * 2, d = s * (0.2 + rng() * 0.4);
      const lift = Math.sqrt(Math.max(0, 1 - (d / (s * 0.75)) ** 2));
      parts.push(P(GEO.bead, PALETTE.cream, M(Math.cos(a) * d, s * 0.8 + s * 0.52 * lift, Math.sin(a) * d, { sx: s * 0.11, sy: s * 0.06, sz: s * 0.11 }), false));
    }
    // a tiny sibling at the foot
    if (rng() < 0.5) {
      const a = rng() * 6.28, ss = s * 0.35;
      parts.push(P(GEO.cyl, PALETTE.cream, M(Math.cos(a) * s * 0.4, ss * 0.4, Math.sin(a) * s * 0.4, { sx: ss * 0.3, sy: ss * 0.8, sz: ss * 0.3 }), false));
      parts.push(P(GEO.dome, PALETTE.capRed, M(Math.cos(a) * s * 0.4, ss * 0.75, Math.sin(a) * s * 0.4, { sx: ss * 0.7, sy: ss * 0.5, sz: ss * 0.7 })));
    }
    return { parts, radius: s * 0.75 };
  }
  function tuftParts(rng) {
    const s = 0.12 + rng() * 0.12;
    const parts = [P(GEO.sphereLo, PALETTE.meadowLight, M(0, s * 0.35, 0, { sx: s * 1.4, sy: s * 0.6, sz: s * 1.2 }), false)];
    parts.push(P(GEO.sphereLo, PALETTE.meadow, M(s * 0.7, s * 0.25, s * 0.3, { sx: s * 0.8, sy: s * 0.45, sz: s * 0.7 }), false));
    if (rng() < 0.4) parts.push(P(GEO.bead, PALETTE.cream, M(-s * 0.3, s * 0.62, 0, { s: 0.035 }), false));
    return { parts, radius: 0 };
  }
  function rockParts(rng, hollow) {
    const s = 0.16 + rng() * 0.22, ry = rng() * 3;
    const color = hollow ? PALETTE.hollowRock : PALETTE.stone;
    const parts = [P(GEO.rock, color, M(0, s * 0.55, 0, { sx: s * 1.3, sy: s * 0.8, sz: s, ry }))];
    // a smaller companion stone, and a cap of moss (or blight) on top
    if (rng() < 0.6) {
      const a = rng() * 6.28;
      parts.push(P(GEO.rock, hollow ? PALETTE.hollowEarth : PALETTE.stoneDark, M(Math.cos(a) * s * 1.2, s * 0.25, Math.sin(a) * s * 1.1, { sx: s * 0.5, sy: s * 0.38, sz: s * 0.45, ry: a })));
    }
    parts.push(P(GEO.sphereLo, hollow ? PALETTE.hollowEarth : PALETTE.moss, M(-s * 0.15, s * 1.12, 0, { sx: s * 0.85, sy: s * 0.22, sz: s * 0.7, ry }), false));
    return { parts, radius: s * 1.2 };
  }
  function flowerParts(rng) {
    const h = 0.18 + rng() * 0.12;
    const color = rng() < 0.5 ? PALETTE.flowerPink : PALETTE.flowerYellow;
    const parts = [
      P(GEO.cyl, PALETTE.meadowDark, M(0, h / 2, 0, { sx: 0.02, sy: h, sz: 0.02 }), false),
      P(GEO.bead, PALETTE.meadowDark, M(0.05, h * 0.3, 0, { sx: 0.06, sy: 0.015, sz: 0.03, rz: 0.4 }), false),
      P(GEO.bead, PALETTE.meadowDark, M(-0.05, h * 0.5, 0.01, { sx: 0.06, sy: 0.015, sz: 0.03, rz: -0.4 }), false),
    ];
    // a five-petal head (one flat shape, cheap) tilted toward the camera, around a gold eye
    parts.push(P(GEO.petals, color, M(0, h + 0.03, 0, { s: 0.1, rx: 0.5, ry: rng() * 6 }), false));
    parts.push(P(GEO.bead, color === PALETTE.flowerYellow ? PALETTE.acorn : PALETTE.flowerYellow, M(0, h + 0.045, 0.01, { s: 0.028 }), false));
    return { parts, radius: 0 };
  }
  // a haystack: a domed heap of straw with a darker band and a few loose wisps
  function hayParts(rng) {
    const s = 0.22 + rng() * 0.12, ry = rng() * 3;
    const parts = [
      P(GEO.dome, PALETTE.straw, M(0, 0, 0, { sx: s * 1.15, sy: s * 1.5, sz: s * 1.05, ry })),
      P(GEO.ring, shade(PALETTE.straw, 0.22), M(0, s * 0.45, 0, { sx: s * 1.02, sy: s * 0.92, sz: s * 1.02, rx: Math.PI / 2 }), false),
      P(GEO.cone, shade(PALETTE.straw, 0.1), M(0, s * 1.55, 0, { sx: s * 0.25, sy: s * 0.35, sz: s * 0.25 }), false),
    ];
    for (let i = 0; i < 3; i++) {
      const a = rng() * 6.28;
      parts.push(P(GEO.box, PALETTE.straw, M(Math.cos(a) * s * 1.3, 0.01, Math.sin(a) * s * 1.2, { sx: 0.12, sy: 0.01, sz: 0.015, ry: a }), false));
    }
    return { parts, radius: s * 1.1 };
  }

  // -------- scene construction --------
  function buildGround() {
    const geos = [];
    const rng = srand(7);
    const vt = levelTheme();
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
          // spatially coherent patches of light and dark meadow, not a
          // salt-and-pepper checkerboard; the shader adds the fine brushwork
          const patch = Math.min(1, Math.max(0, RendererFX.fbm(c * 0.31 + 3.1, r * 0.31 + 7.7) * 1.5 - 0.25));
          topColor.copy(lerpColor(vt.meadow, vt.meadowDark, patch)).lerp(new THREE.Color(PALETTE.hollowGround), h);
          topColor.offsetHSL(0, 0, (rng() - 0.5) * 0.022 - (inGrid ? 0 : 0.03));
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
    const lv = GameState.currentLevel();
    const groundMat = RendererFX.patchGround(new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap, vertexColors: true }),
      { ...lv.theme, cols, rows }, fxTime);
    const ground = new THREE.Mesh(mergeGeoms(geos), groundMat);
    ground.name = 'ground';
    ground.matrixAutoUpdate = false;
    scene.add(ground);

    // A wide floor so the world never shows the void, tinted to the level's
    // own backdrop so the fog blends the edge into it.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(cols + border * 2 + 40, rows + border * 2 + 40), unlit(lerpColor(vt.backdrop, 0x000000, 0.14).getHex()));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -tileHeight - 0.02;
    scene.add(floor);

    buildRoadEdges(vt);

    // Buildable plots: a rounded, softly framed pad on every cell that
    // touches the road, so tower spots read as places, not grid squares.
    // One merged mesh, one draw call.
    const markers = [];
    const plotRim = roundedRectGeo(0.86, 0.14), plotFill = roundedRectGeo(0.74, 0.11);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!GameState.isBuildable(c, r)) continue;
      const h = GameState.zoneFalloff(c, r);
      const fill = lerpColor(PALETTE.meadowLight, 0x8f86a3, h).offsetHSL(0, 0, 0.08);
      const rim = fill.clone().offsetHSL(0, -0.08, -0.16);
      for (const [shape, col, y] of [[plotRim, rim, 0.005], [plotFill, fill, 0.007]]) {
        const g = shape.clone().applyMatrix4(M(worldX(c), y, worldZ(r)));
        const colors = new Float32Array(g.attributes.position.count * 3);
        for (let i = 0; i < g.attributes.position.count; i++) { colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b; }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        markers.push(g);
      }
    }
    const markerMesh = new THREE.Mesh(mergeGeoms(markers), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false }));
    markerMesh.name = 'buildableMarkers';
    markerMesh.matrixAutoUpdate = false;
    scene.add(markerMesh);
    animated.push({ update(t) { markerMesh.material.opacity = 0.42 + Math.sin(t * 1.6) * 0.1; } });
  }

  function roundedRectGeo(w, rad) {
    const h = w / 2, s = new THREE.Shape();
    s.moveTo(-h + rad, -h); s.lineTo(h - rad, -h); s.quadraticCurveTo(h, -h, h, -h + rad);
    s.lineTo(h, h - rad); s.quadraticCurveTo(h, h, h - rad, h);
    s.lineTo(-h + rad, h); s.quadraticCurveTo(-h, h, -h, h - rad);
    s.lineTo(-h, -h + rad); s.quadraticCurveTo(-h, -h, -h + rad, -h);
    const g = new THREE.ShapeGeometry(s, 3).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    return g;
  }

  // Road edges: a soft lip of darker grass where the road meets meadow, and
  // pebbles kicked to the sides, so the road reads hand-painted rather than
  // as a row of flat tiles. Colors are bucketed so it stays a few draw calls.
  function buildRoadEdges(vt) {
    const rng = srand(311);
    const isGround = (c, r) => !GameState.inGrid(c, r) || GameState.cellKind(c, r) === 'ground';
    const lipColor = (h) => lerpColor(vt.meadowDark, PALETTE.hollowGround, Math.round(h * 2) / 2).multiplyScalar(0.84).getHex();
    const isRoad = (c, r) => GameState.inGrid(c, r) && ['path', 'bridge'].includes(GameState.cellKind(c, r));
    const rutColor = [lerpColor(PALETTE.path, PALETTE.earth, 0.32).getHex(), lerpColor(PALETTE.hollowPath, PALETTE.hollowEarth, 0.4).getHex()];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (GameState.cellKind(c, r) !== 'path') continue;
      const x = worldX(c), z = worldZ(r), h = GameState.zoneFalloff(c, r);
      // twin wheel ruts worn along the direction of travel
      if (!GameState.isCobble(c, r)) {
        // half-strips toward each connected neighbour, so a corner reads as
        // one turning pair of ruts instead of a cross-hatch
        const rc = rutColor[h > 0.5 ? 1 : 0];
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!isRoad(c + dc, r + dr)) continue;
          for (const off of [-0.17, 0.17]) {
            if (dc) batchPart(P(GEO.box, rc, M(x + dc * 0.25, 0.003, z + off, { sx: 0.53, sy: 0.006, sz: 0.06 }), false));
            else batchPart(P(GEO.box, rc, M(x + off, 0.003, z + dr * 0.25, { sx: 0.06, sy: 0.006, sz: 0.53 }), false));
          }
        }
      }
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!isGround(c + dc, r + dr)) continue;
        const along = dr !== 0;
        const ex = x + dc * 0.47, ez = z + dr * 0.47;
        batchPart(P(GEO.sphereLo, lipColor(h), M(ex, 0.008, ez, along
          ? { sx: 0.56, sy: 0.035, sz: 0.07 } : { sx: 0.07, sy: 0.035, sz: 0.56 }), false));
        if (rng() < 0.55) {
          const t = (rng() - 0.5) * 0.8, s = 0.03 + rng() * 0.03;
          const px = along ? x + t : ex - dc * 0.1, pz = along ? ez - dr * 0.1 : z + t;
          batchPart(P(GEO.rock, h > 0.5 ? PALETTE.hollowRock : PALETTE.stone, M(px, s * 0.3, pz, { sx: s * 1.3, sy: s * 0.6, sz: s, ry: rng() * 3 }), false));
        }
      }
    }
  }

  // Wind-blown grass on open meadow: one instanced draw call. Skips the
  // road, build plots and deep corruption, thins out as corruption rises.
  function buildGrass() {
    const vt = levelTheme();
    const rng = srand(4242);
    const streamCol = GameState.currentLevel().chokepoint.streamCol;
    const blades = [];
    for (let r = -border; r < rows + border; r++) {
      for (let c = -border; c < cols + border; c++) {
        const inGrid = GameState.inGrid(c, r);
        if (inGrid) {
          if (GameState.cellKind(c, r) !== 'ground' || GameState.isBuildable(c, r) || GameState.isSpawn(c, r)) continue;
        } else if (c === streamCol) continue;
        const h = GameState.zoneFalloff(c, r);
        if (h > 0.62) continue;
        const tufts = Math.floor((inGrid ? 3.4 : 2.4) * (1 - h * 0.9) * QUALITY + rng());
        for (let t = 0; t < tufts; t++) {
          const cx = worldX(c) + (rng() - 0.5) * 0.84, cz = worldZ(r) + (rng() - 0.5) * 0.84;
          const n = 5 + Math.floor(rng() * 5);
          const tint = lerpColor(vt.meadow, PALETTE.meadowLight, 0.2 + rng() * 0.55).lerp(new THREE.Color(PALETTE.hollowGround), Math.min(1, h * 1.2));
          const tall = 0.16 + rng() * 0.12;
          for (let b = 0; b < n; b++) {
            blades.push({ x: cx + (rng() - 0.5) * 0.2, z: cz + (rng() - 0.5) * 0.2, h: tall * (0.7 + rng() * 0.5) * (1 - h * 0.4), ry: rng() * Math.PI, lean: (rng() - 0.5) * 0.6, tint: tint.clone().offsetHSL(0, 0, (rng() - 0.5) * 0.07) });
          }
        }
      }
    }
    if (!blades.length) return;
    const mesh = new THREE.InstancedMesh(RendererFX.grassBladeGeometry(), RendererFX.grassMaterial(fxTime), blades.length);
    const dummy = new THREE.Object3D();
    blades.forEach((b, i) => {
      dummy.position.set(b.x, 0, b.z);
      dummy.rotation.set(b.lean * 0.4, b.ry, b.lean);
      dummy.scale.set(1, b.h, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, b.tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.name = 'grass';
    scene.add(mesh);
  }

  // Ambient motes per level mood: fireflies over healthy meadow, embers
  // rising off the ravaged ground, plus whatever the level's theme adds
  // (leaves, dust, embers).
  function buildMotes() {
    const vt = levelTheme();
    const rng = srand(77);
    const counts = Object.assign({ fireflies: 26, embers: 22 }, vt.motes);
    for (const kind of Object.keys(counts)) {
      if (!RendererFX.MOTE_KINDS[kind]) continue;
      const n = Math.round(counts[kind] * QUALITY);
      const pos = [];
      for (let guard = 0; pos.length < n * 3 && guard < n * 80; guard++) {
        const c = -1 + rng() * (cols + 2), r = -1 + rng() * (rows + 2);
        const h = GameState.zoneFalloff(Math.floor(c), Math.floor(r));
        if ((kind === 'spores' || kind === 'embers') && h < 0.35) continue;
        if (kind === 'fireflies' && h > 0.25) continue;
        const y = kind === 'fireflies' ? 0.25 + rng() * 0.9 : kind === 'leaves' ? rng() * 2.6 : kind === 'dust' ? 0.3 + rng() * 1.2 : rng() * 2;
        pos.push(c - cols / 2, y, r - rows / 2);
      }
      if (pos.length) scene.add(RendererFX.motes(kind, pos, moteScale, fxTime));
    }
  }

  // Shared animated water for any level: a stream, a millrace, or (slowed and
  // recolored) a slow dark castle moat.
  function water({ x, z = 0, width = 0.98, length, y = -0.12, shallow = PALETTE.water, deep = PALETTE.waterDeep, foam = PALETTE.waterFoam, speed, stripe, foamAmt }) {
    const mat = RendererFX.waterMaterial({ shallow, deep, foam, speed, stripe, foamAmt });
    mat.uniforms.uTime = fxTime;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.name = 'water';
    scene.add(mesh);
    return mesh;
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

  // Every tower stands on the same round stone dais, so the five read as one
  // army; the character on top carries the silhouette.
  const dais = () => [
    P(GEO.cyl, PALETTE.stoneDark, M(0, 0.06, 0, { sx: 0.38, sy: 0.12, sz: 0.38 }), true, { name: 'pad' }),
    P(GEO.cyl, PALETTE.cobble, M(0, 0.125, 0, { sx: 0.34, sy: 0.02, sz: 0.34 }), false),
    P(GEO.rock, PALETTE.stone, M(0.3, 0.12, -0.18, { s: 0.05 }), false),
    P(GEO.rock, PALETTE.cobble, M(-0.33, 0.12, 0.08, { s: 0.045 }), false),
  ];
  // two eyes with a glint, looking along +z from a head at (x, y, z)
  const eyes = (y, z, spread = 0.07, s = 0.028) => [
    P(GEO.bead, PALETTE.outline, M(spread, y, z, { s }), false),
    P(GEO.bead, PALETTE.outline, M(-spread, y, z, { s }), false),
    P(GEO.bead, PALETTE.cream, M(spread + 0.008, y + 0.012, z + 0.02, { s: s * 0.38 }), false),
    P(GEO.bead, PALETTE.cream, M(-spread + 0.008, y + 0.012, z + 0.02, { s: s * 0.38 }), false),
  ];

  // Javelin Squire: a stout young squire in a wide kettle helm and the
  // King's tabard, a javelin cocked over his shoulder and a red buckler on
  // his arm. Faces +z. Silhouette: the helm brim and the raised javelin.
  function slingerParts() {
    const jx = 0.27, jy = 1.0, jr = Math.PI / 2 - 0.25;
    return [
      ...dais(),
      P(GEO.sphereLo, PALETTE.acornCap, M(0.1, 0.18, 0.06, { sx: 0.09, sy: 0.06, sz: 0.12 }), true),
      P(GEO.sphereLo, PALETTE.acornCap, M(-0.1, 0.18, 0.06, { sx: 0.09, sy: 0.06, sz: 0.12 }), true),
      P(GEO.sphereLo, PALETTE.tunic, M(0, 0.42, 0, { sx: 0.25, sy: 0.23, sz: 0.23 }), true, { name: 'body' }),
      // the white tabard with a red cross, the kingdom's colors at a glance
      P(GEO.box, PALETTE.heraldWhite, M(0, 0.42, 0.2, { sx: 0.2, sy: 0.26, sz: 0.04 }), false),
      P(GEO.box, PALETTE.capRed, M(0, 0.43, 0.223, { sx: 0.045, sy: 0.22, sz: 0.01 }), false),
      P(GEO.box, PALETTE.capRed, M(0, 0.46, 0.223, { sx: 0.17, sy: 0.04, sz: 0.01 }), false),
      P(GEO.cyl, PALETTE.acornCap, M(0, 0.31, 0, { sx: 0.24, sy: 0.04, sz: 0.22 }), false),
      P(GEO.box, PALETTE.gold, M(0, 0.31, 0.215, { sx: 0.06, sy: 0.05, sz: 0.02 }), false),
      P(GEO.sphere, PALETTE.skin, M(0, 0.72, 0.01, { s: 0.2 }), true, { name: 'head' }),
      ...eyes(0.74, 0.19),
      P(GEO.bead, 0xe9a283, M(0, 0.7, 0.215, { s: 0.04 }), false),
      P(GEO.sphereLo, 0xf0a98a, M(0.12, 0.67, 0.14, { sx: 0.04, sy: 0.025, sz: 0.02 }), false),
      P(GEO.sphereLo, 0xf0a98a, M(-0.12, 0.67, 0.14, { sx: 0.04, sy: 0.025, sz: 0.02 }), false),
      P(GEO.box, PALETTE.outline, M(0, 0.63, 0.19, { sx: 0.06, sy: 0.012, sz: 0.01 }), false),
      // the kettle helm: a steel dome and a wide brim
      P(GEO.dome, PALETTE.steel, M(0, 0.8, 0, { sx: 0.22, sy: 0.17, sz: 0.22 }), true, { name: 'hat', live: true }),
      P(GEO.cyl, PALETTE.steel, M(0, 0.8, 0, { sx: 0.35, sy: 0.025, sz: 0.35 }), true, { name: 'brim', live: true }),
      P(GEO.bead, PALETTE.gold, M(0, 0.98, 0, { s: 0.035 }), false, { name: 'helmKnob', live: true }),
      // the buckler on the off arm
      P(GEO.sphereLo, PALETTE.skin, M(-0.24, 0.42, 0.08, { s: 0.06 }), true),
      P(GEO.cyl, PALETTE.capRed, M(-0.3, 0.44, 0.06, { sx: 0.15, sy: 0.03, sz: 0.15, rz: Math.PI / 2 }), true),
      P(GEO.ring, PALETTE.gold, M(-0.318, 0.44, 0.06, { s: 0.13, ry: Math.PI / 2 }), false),
      P(GEO.bead, PALETTE.gold, M(-0.322, 0.44, 0.06, { s: 0.035 }), false),
      // spare javelins in a quiver on the back
      P(GEO.cyl, PALETTE.acornCap, M(-0.08, 0.5, -0.2, { sx: 0.06, sy: 0.3, sz: 0.06, rz: 0.3 })),
      P(GEO.cyl, PALETTE.woodLight, M(-0.15, 0.74, -0.2, { sx: 0.014, sy: 0.3, sz: 0.014, rz: 0.3 }), false),
      P(GEO.cone, PALETTE.steel, M(-0.2, 0.9, -0.2, { sx: 0.025, sy: 0.07, sz: 0.025, rz: 0.3 }), false),
      // the throwing arm and the javelin, cocked back over the shoulder
      P(GEO.sphereLo, PALETTE.skin, M(jx, 0.94, 0, { s: 0.065 }), true, { name: 'hand', live: true }),
      P(GEO.cyl, PALETTE.tunic, M(0.24, 0.72, 0, { sx: 0.06, sy: 0.3, sz: 0.06, rz: 0.15 }), true, { name: 'arm', live: true }),
      P(GEO.cyl, PALETTE.woodLight, M(jx, jy, 0.06, { sx: 0.03, sy: 0.95, sz: 0.03, rx: jr }), true, { name: 'javelin', live: true }),
      P(GEO.cone, PALETTE.steel, M(jx, jy + 0.475 * Math.cos(jr) + 0.02, 0.06 + 0.475 * Math.sin(jr) + 0.04, { sx: 0.035, sy: 0.11, sz: 0.035, rx: jr }), true, { name: 'tip', live: true }),
    ];
  }

  // Brigand: a squat footpad, mostly head, a hood with a floppy tail, a
  // black scarf masking his face, and a knobbly cudgel. Faces +z.
  // Silhouette: the hood tail flopping behind.
  function gruntParts() {
    const g = PALETTE.goblin, gd = PALETTE.goblinDark;
    return [
      P(GEO.sphereLo, g, M(0, 0.2, 0, { sx: 0.2, sy: 0.17, sz: 0.18 }), true, { name: 'body' }),
      P(GEO.box, PALETTE.acornCap, M(0, 0.16, 0, { sx: 0.42, sy: 0.06, sz: 0.38 }), false, { name: 'belt' }),
      P(GEO.box, PALETTE.steelDark, M(0, 0.16, 0.195, { sx: 0.06, sy: 0.05, sz: 0.02 }), false),
      P(GEO.sphereLo, gd, M(0.1, 0.05, 0.02, { sx: 0.09, sy: 0.05, sz: 0.11 }), true, { name: 'footL', live: true }),
      P(GEO.sphereLo, gd, M(-0.1, 0.05, 0.02, { sx: 0.09, sy: 0.05, sz: 0.11 }), true, { name: 'footR', live: true }),
      P(GEO.sphere, PALETTE.skin, M(0, 0.5, 0.02, { sx: 0.22, sy: 0.21, sz: 0.21 }), true, { name: 'head' }),
      // the hood, pulled low, and its long tail
      P(GEO.sphereLo, gd, M(0, 0.56, -0.02, { sx: 0.25, sy: 0.22, sz: 0.24 }), true, { name: 'hood' }),
      P(GEO.cone, gd, pivotMatrix(0, 0.66, -0.16, -1.9, 0, 0, 0, 0.14, 0, 0.08, 0.3, 0.06), true, { name: 'earL', live: true }),
      P(GEO.sphereLo, gd, M(0, 0.4, 0.04, { sx: 0.26, sy: 0.06, sz: 0.22 }), false),
      // the face: beady eyes over a black scarf, a big red nose poking out
      P(GEO.sphereLo, PALETTE.cream, M(0.08, 0.53, 0.19, { s: 0.05 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.cream, M(-0.08, 0.53, 0.19, { s: 0.05 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.outline, M(0.09, 0.53, 0.232, { s: 0.024 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.outline, M(-0.07, 0.53, 0.232, { s: 0.024 }), false, { unlit: true }),
      P(GEO.box, PALETTE.outline, M(0, 0.6, 0.2, { sx: 0.2, sy: 0.025, sz: 0.02, rz: 0.12 }), false),
      P(GEO.sphereLo, PALETTE.pitch, M(0, 0.43, 0.12, { sx: 0.2, sy: 0.08, sz: 0.13 }), false, { name: 'mask' }),
      P(GEO.sphereLo, 0xd47a64, M(0, 0.49, 0.24, { sx: 0.05, sy: 0.045, sz: 0.06 }), true, { name: 'nose' }),
      P(GEO.sphereLo, g, M(0.2, 0.26, 0.06, { s: 0.06 }), true, { name: 'armL' }),
      P(GEO.sphereLo, g, M(-0.2, 0.26, 0.06, { s: 0.06 }), true, { name: 'armR' }),
      P(GEO.cyl, PALETTE.wood, pivotMatrix(-0.22, 0.26, 0.06, 0.5, 0, 0.35, 0, 0.14, 0, 0.03, 0.3, 0.03), true, { name: 'club' }),
      P(GEO.sphereLo, PALETTE.woodLight, pivotMatrix(-0.22, 0.26, 0.06, 0.5, 0, 0.35, 0, 0.3, 0, 0.065, 0.065, 0.065), true, { name: 'clubHead' }),
      P(GEO.cone, PALETTE.steelDark, pivotMatrix(-0.22, 0.26, 0.06, 0.5, 0, 0.35, 0.05, 0.33, 0, 0.018, 0.05, 0.018), false),
      P(GEO.cone, PALETTE.steelDark, pivotMatrix(-0.22, 0.26, 0.06, 0.5, 0, 0.35, -0.05, 0.3, 0.02, 0.018, 0.05, 0.018), false),
      // a stolen coin pouch on the belt
      P(GEO.sphereLo, PALETTE.acorn, M(0.17, 0.12, 0.1, { s: 0.055 }), true),
    ];
  }

  // Pitchpot Friar: a round, jolly friar in a brown habit with a tonsure,
  // swinging a smoking pot of pitch on a long ladle, his own little cauldron
  // bubbling on a fire beside him. Faces +z. Silhouette: the round belly and
  // the cauldron.
  function wardenParts() {
    const h = PALETTE.habit;
    return [
      ...dais(),
      // the cauldron on its fire
      P(GEO.cylTaper, PALETTE.pitch, M(-0.22, 0.24, 0.18, { sx: 0.13, sy: 0.16, sz: 0.13, rx: Math.PI }), true, { name: 'cauldron' }),
      P(GEO.torus, PALETTE.steelDark, M(-0.22, 0.32, 0.18, { s: 0.12, rx: Math.PI / 2 }), false),
      P(GEO.cyl, 0x3a2e26, M(-0.22, 0.31, 0.18, { sx: 0.1, sy: 0.02, sz: 0.1 }), false, { name: 'brew', live: true }),
      P(GEO.cone, PALETTE.ember, M(-0.22, 0.17, 0.18, { sx: 0.07, sy: 0.12, sz: 0.07 }), false, { name: 'flame', live: true, unlit: true }),
      P(GEO.cyl, PALETTE.wood, M(-0.16, 0.14, 0.24, { sx: 0.02, sy: 0.16, sz: 0.02, rz: 1.3 }), false),
      P(GEO.cyl, PALETTE.wood, M(-0.28, 0.14, 0.12, { sx: 0.02, sy: 0.16, sz: 0.02, rx: 1.3 }), false),
      // the friar: a round habit, a rope belt, sandals
      P(GEO.sphereLo, h, M(0.04, 0.4, -0.02, { sx: 0.28, sy: 0.3, sz: 0.26 }), true, { name: 'body' }),
      P(GEO.cylTaper, h, M(0.04, 0.2, -0.02, { sx: 0.25, sy: 0.16, sz: 0.24 }), false),
      P(GEO.ring, PALETTE.straw, M(0.04, 0.38, -0.02, { sx: 0.27, sy: 0.26, sz: 0.27, rx: Math.PI / 2 }), false),
      P(GEO.cyl, PALETTE.straw, M(0.12, 0.28, 0.22, { sx: 0.012, sy: 0.16, sz: 0.012 }), false),
      P(GEO.bead, PALETTE.straw, M(0.12, 0.19, 0.22, { s: 0.022 }), false),
      P(GEO.sphereLo, PALETTE.acornCap, M(0.04, 0.6, -0.1, { sx: 0.24, sy: 0.08, sz: 0.2 }), false),
      // round face, rosy cheeks, the tonsure ring of hair
      P(GEO.sphere, PALETTE.skin, M(0.04, 0.78, 0.02, { s: 0.19 }), true, { name: 'head' }),
      P(GEO.torus, PALETTE.woodLight, M(0.04, 0.84, 0.02, { sx: 0.17, sy: 0.17, sz: 0.3, rx: Math.PI / 2 }), false),
      ...eyes(0.8, 0.19, 0.065).map((p) => ({ ...p, m: new THREE.Matrix4().makeTranslation(0.04, 0, 0).multiply(p.m) })),
      P(GEO.sphereLo, 0xe08c76, M(0.15, 0.73, 0.15, { sx: 0.045, sy: 0.03, sz: 0.02 }), false),
      P(GEO.sphereLo, 0xe08c76, M(-0.07, 0.73, 0.15, { sx: 0.045, sy: 0.03, sz: 0.02 }), false),
      P(GEO.bead, 0xe9a283, M(0.04, 0.76, 0.21, { s: 0.042 }), false),
      P(GEO.box, PALETTE.outline, M(0.04, 0.69, 0.18, { sx: 0.08, sy: 0.014, sz: 0.01, rz: 0 }), false),
      P(GEO.sphereLo, h, M(0.29, 0.46, 0.08, { s: 0.08 }), true),
      // the long ladle with its pot of pitch, a wisp of flame on top
      P(GEO.cyl, PALETTE.wood, M(0.32, 0.72, 0.1, { sx: 0.025, sy: 0.7, sz: 0.025, rz: -0.25 }), true, { name: 'staff', live: true }),
      P(GEO.sphereLo, PALETTE.pitch, M(0.41, 1.08, 0.1, { s: 0.11 }), true, { name: 'thornBall', live: true }),
      P(GEO.torus, PALETTE.steelDark, M(0.41, 1.17, 0.1, { s: 0.07, rx: Math.PI / 2 }), false, { name: 'thorn1', live: true }),
      P(GEO.cone, PALETTE.ember, M(0.41, 1.25, 0.1, { sx: 0.04, sy: 0.1, sz: 0.04 }), false, { name: 'thorn2', live: true, unlit: true }),
    ];
  }

  // Court Magus: a lanky court wizard in a starry purple robe and a tall
  // blue hat, a long white beard, a crooked staff and a frost orb hovering
  // by one hand. Faces +z. Silhouette: the tall bent hat and the orb.
  function druidParts() {
    return [
      ...dais(),
      P(GEO.cyl, PALETTE.frost, M(0, 0.14, 0, { sx: 0.3, sy: 0.012, sz: 0.3 }), false, { name: 'padFrost' }),
      P(GEO.cone, PALETTE.magic, M(0, 0.48, 0, { sx: 0.28, sy: 0.72, sz: 0.26 }), true, { name: 'body' }),
      P(GEO.ring, PALETTE.gold, M(0, 0.18, 0, { sx: 0.26, sy: 0.24, sz: 0.26, rx: Math.PI / 2 }), false),
      P(GEO.bead, PALETTE.gold, M(0.1, 0.32, 0.17, { s: 0.025 }), false),
      P(GEO.bead, PALETTE.gold, M(-0.12, 0.25, 0.15, { s: 0.02 }), false),
      P(GEO.bead, PALETTE.gold, M(0.02, 0.5, 0.13, { s: 0.022 }), false),
      P(GEO.sphere, PALETTE.skin, M(0, 0.8, 0.04, { s: 0.17 }), true, { name: 'head' }),
      ...eyes(0.83, 0.19, 0.06, 0.024),
      P(GEO.box, PALETTE.cream, M(0.06, 0.88, 0.18, { sx: 0.07, sy: 0.022, sz: 0.02, rz: -0.25 }), false),
      P(GEO.box, PALETTE.cream, M(-0.06, 0.88, 0.18, { sx: 0.07, sy: 0.022, sz: 0.02, rz: 0.25 }), false),
      P(GEO.bead, 0xe9a283, M(0, 0.79, 0.21, { s: 0.04 }), false),
      // the long beard, past his belt
      P(GEO.cone, PALETTE.cream, M(0, 0.58, 0.15, { sx: 0.13, sy: 0.36, sz: 0.07, rx: Math.PI + 0.15 }), true, { name: 'beard' }),
      // the tall hat, bent at the tip, with a gold band and stars
      P(GEO.cyl, PALETTE.tunic, M(0, 0.92, 0.02, { sx: 0.3, sy: 0.03, sz: 0.3 }), true, { name: 'brim', live: true }),
      P(GEO.cone, PALETTE.tunic, M(0.03, 1.2, 0.0, { sx: 0.2, sy: 0.58, sz: 0.2, rz: -0.12 }), true, { name: 'hat', live: true }),
      P(GEO.cone, PALETTE.tunic, M(0.16, 1.5, 0.0, { sx: 0.07, sy: 0.18, sz: 0.07, rz: -0.9 }), true, { name: 'hatTip', live: true }),
      P(GEO.ring, PALETTE.gold, M(0.0, 0.98, 0.02, { sx: 0.18, sy: 0.18, sz: 0.18, rx: Math.PI / 2 }), false),
      P(GEO.bead, PALETTE.gold, M(0.05, 1.12, 0.14, { s: 0.03 }), false),
      P(GEO.bead, PALETTE.gold, M(-0.06, 1.24, 0.1, { s: 0.024 }), false),
      // the crooked staff in the other hand
      P(GEO.cyl, PALETTE.wood, M(-0.27, 0.6, 0.12, { sx: 0.028, sy: 1.0, sz: 0.028 }), true),
      P(GEO.torus, PALETTE.wood, M(-0.21, 1.12, 0.12, { sx: 0.07, sy: 0.07, sz: 0.25 }), false),
      P(GEO.sphereLo, PALETTE.magic, M(-0.27, 0.62, 0.15, { s: 0.055 }), true),
      P(GEO.sphereLo, PALETTE.magic, M(0.26, 0.5, 0.14, { s: 0.06 }), true, { name: 'hand' }),
      P(GEO.sphereLo, PALETTE.frost, M(0.3, 0.74, 0.18, { s: 0.1 }), false, { name: 'orb', live: true, unlit: true }),
      P(GEO.sphereLo, PALETTE.cream, M(0.3, 0.74, 0.18, { s: 0.05 }), false, { name: 'orbCore', live: true, unlit: true }),
      P(GEO.cone, PALETTE.frost, M(-0.24, 0.2, 0.2, { sx: 0.03, sy: 0.1, sz: 0.03, rz: 0.3 }), false),
      P(GEO.cone, PALETTE.frost, M(0.2, 0.18, -0.22, { sx: 0.03, sy: 0.09, sz: 0.03, rx: -0.3 }), false),
    ];
  }

  // Hammer Knight: a broad knight in full plate under a royal-blue tabard,
  // a bucket great-helm with a gold crest, a kite shield slung on his back
  // and a huge warhammer in both fists. Faces +z. Silhouette: the square
  // helm, the wide pauldrons and the hammer.
  // The hammer and fists swing as one piece from a pivot at the shoulders;
  // hammerPose() places them for any swing angle (0.5 is the ready stance).
  const HAMMER_PIVOT = [0, 0.62, 0.06];
  const HAMMER_POSE = {
    handle: [0, 0.2, 0.3, 0.035, 0.6, 0.035],
    hammerHead: [0, 0.52, 0.3, 0.3, 0.18, 0.18],
    fistL: [0.07, 0.0, 0.3, 0.075, 0.075, 0.075],
    fistR: [-0.07, 0.06, 0.3, 0.075, 0.075, 0.075],
  };
  function hammerPose(name, angle, out) {
    const [ox, oy, oz, sx, sy, sz] = HAMMER_POSE[name];
    return pivotMatrix(HAMMER_PIVOT[0], HAMMER_PIVOT[1], HAMMER_PIVOT[2], angle, 0, 0, ox, oy, oz, sx, sy, sz, out);
  }
  function golemParts() {
    const st = PALETTE.steel, sd = PALETTE.steelDark;
    return [
      ...dais(),
      P(GEO.box, sd, M(0.11, 0.2, 0.04, { sx: 0.13, sy: 0.12, sz: 0.2 }), true),
      P(GEO.box, sd, M(-0.11, 0.2, 0.04, { sx: 0.13, sy: 0.12, sz: 0.2 }), true),
      P(GEO.cylTaper, st, M(0, 0.36, 0, { sx: 0.27, sy: 0.24, sz: 0.24, rx: Math.PI }), true),
      P(GEO.sphereLo, st, M(0, 0.5, -0.01, { sx: 0.3, sy: 0.24, sz: 0.25 }), true, { name: 'body' }),
      P(GEO.box, PALETTE.tunic, M(0, 0.42, 0.2, { sx: 0.26, sy: 0.3, sz: 0.06 }), false),
      P(GEO.box, PALETTE.gold, M(0, 0.47, 0.235, { sx: 0.07, sy: 0.07, sz: 0.01, rz: Math.PI / 4 }), false),
      P(GEO.box, PALETTE.gold, M(0, 0.28, 0.232, { sx: 0.26, sy: 0.025, sz: 0.01 }), false),
      // pauldrons
      P(GEO.sphereLo, st, M(0.26, 0.64, 0, { sx: 0.15, sy: 0.11, sz: 0.15 }), true, { name: 'shoulders', live: true }),
      P(GEO.sphereLo, st, M(-0.26, 0.64, 0, { sx: 0.15, sy: 0.11, sz: 0.15 }), true, { name: 'shoulders2', live: true }),
      P(GEO.ring, PALETTE.gold, M(0.26, 0.6, 0, { s: 0.14, rx: Math.PI / 2 }), false),
      P(GEO.ring, PALETTE.gold, M(-0.26, 0.6, 0, { s: 0.14, rx: Math.PI / 2 }), false),
      // the great helm, eye slit and breaths, a gold crest on top
      P(GEO.cyl, st, M(0, 0.86, 0.02, { sx: 0.17, sy: 0.27, sz: 0.17 }), true, { name: 'head' }),
      P(GEO.dome, st, M(0, 0.995, 0.02, { sx: 0.17, sy: 0.06, sz: 0.17 }), false),
      P(GEO.box, PALETTE.outline, M(0, 0.9, 0.19, { sx: 0.24, sy: 0.03, sz: 0.01 }), false, { unlit: true }),
      P(GEO.box, PALETTE.outline, M(0, 0.84, 0.19, { sx: 0.012, sy: 0.08, sz: 0.01 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.gold, M(0.05, 0.79, 0.188, { s: 0.012 }), false),
      P(GEO.bead, PALETTE.gold, M(-0.05, 0.79, 0.188, { s: 0.012 }), false),
      P(GEO.box, PALETTE.gold, M(0, 1.06, 0.0, { sx: 0.035, sy: 0.12, sz: 0.24 }), true, { name: 'crest', live: true }),
      // the kite shield slung on his back
      P(GEO.box, PALETTE.tunic, M(0, 0.55, -0.27, { sx: 0.32, sy: 0.4, sz: 0.04 })),
      P(GEO.box, PALETTE.gold, M(0, 0.55, -0.295, { sx: 0.05, sy: 0.36, sz: 0.01 }), false),
      // arms down to the swinging fists
      P(GEO.cyl, st, M(0.28, 0.5, 0.12, { sx: 0.065, sy: 0.24, sz: 0.065, rx: 0.9 }), true, { name: 'armL', live: true }),
      P(GEO.cyl, st, M(-0.28, 0.5, 0.12, { sx: 0.065, sy: 0.24, sz: 0.065, rx: 0.9 }), true, { name: 'armR', live: true }),
      P(GEO.cyl, PALETTE.wood, hammerPose('handle', 0.5), true, { name: 'handle', live: true }),
      P(GEO.box, 0x4e535c, hammerPose('hammerHead', 0.5), true, { name: 'hammerHead', live: true }),
      P(GEO.sphereLo, sd, hammerPose('fistL', 0.5), true, { name: 'fistL', live: true }),
      P(GEO.sphereLo, sd, hammerPose('fistR', 0.5), true, { name: 'fistR', live: true }),
    ];
  }

  // Longbowman: a hooded yeoman in forest green with a feather in his
  // hood, a quiver at his hip and a longbow taller than he is. Faces +z.
  // Silhouette: the tall bow arc.
  function artilleryParts() {
    const c = PALETTE.cloak, cd = PALETTE.cloakDark;
    return [
      ...dais(),
      // a barrel of spare arrows at his side
      P(GEO.cyl, PALETTE.wood, M(-0.25, 0.25, -0.12, { sx: 0.1, sy: 0.24, sz: 0.1 }), true),
      P(GEO.ring, PALETTE.steelDark, M(-0.25, 0.32, -0.12, { s: 0.1, rx: Math.PI / 2 }), false),
      ...[0, 1, 2, 3].map((i) => P(GEO.cyl, PALETTE.woodLight, M(-0.25 + (i % 2 - 0.5) * 0.06, 0.48, -0.12 + (i > 1 ? 0.03 : -0.03), { sx: 0.01, sy: 0.24, sz: 0.01, rz: (i - 1.5) * 0.12 }), false)),
      ...[0, 1, 2].map((i) => P(GEO.box, PALETTE.cream, M(-0.25 + (i - 1) * 0.04, 0.6, -0.12, { sx: 0.03, sy: 0.06, sz: 0.005 }), false)),
      P(GEO.sphereLo, cd, M(0.09, 0.18, 0.04, { sx: 0.08, sy: 0.06, sz: 0.11 }), true),
      P(GEO.sphereLo, cd, M(-0.09, 0.18, 0.04, { sx: 0.08, sy: 0.06, sz: 0.11 }), true),
      P(GEO.cylTaper, c, M(0, 0.32, 0, { sx: 0.22, sy: 0.22, sz: 0.2, rx: Math.PI }), false),
      P(GEO.sphereLo, c, M(0, 0.46, 0, { sx: 0.22, sy: 0.24, sz: 0.2 }), true, { name: 'body' }),
      P(GEO.cyl, PALETTE.acornCap, M(0, 0.36, 0, { sx: 0.21, sy: 0.04, sz: 0.19 }), false),
      P(GEO.box, PALETTE.gold, M(0, 0.36, 0.19, { sx: 0.05, sy: 0.045, sz: 0.02 }), false),
      // head and the pointed green hood with its feather
      P(GEO.sphere, PALETTE.skin, M(0, 0.76, 0.04, { s: 0.17 }), true, { name: 'head' }),
      ...eyes(0.78, 0.19, 0.06, 0.024),
      P(GEO.bead, 0xe9a283, M(0, 0.74, 0.21, { s: 0.036 }), false),
      P(GEO.box, PALETTE.acornCap, M(0, 0.68, 0.18, { sx: 0.1, sy: 0.04, sz: 0.02 }), false),
      P(GEO.sphereLo, c, M(0, 0.82, -0.02, { sx: 0.2, sy: 0.19, sz: 0.2 }), true, { name: 'hood' }),
      P(GEO.cone, c, M(0, 1.02, -0.1, { sx: 0.13, sy: 0.3, sz: 0.13, rx: -0.55 }), true, { name: 'hat', live: true }),
      P(GEO.sphereLo, PALETTE.capRed, M(0.14, 0.98, -0.02, { sx: 0.025, sy: 0.16, sz: 0.04, rz: -0.5 }), true, { name: 'feather', live: true }),
      P(GEO.sphereLo, cd, M(0, 0.66, 0.0, { sx: 0.2, sy: 0.06, sz: 0.19 }), false),
      P(GEO.sphereLo, c, M(-0.2, 0.52, 0.12, { s: 0.06 }), true),
      // the longbow, its string and a nocked arrow: all live so they draw and snap
      P(GEO.bow, PALETTE.woodLight, M(0.16, 0.82, -0.22, { s: 0.58 }), true, { name: 'bow', live: true }),
      P(GEO.box, PALETTE.cream, M(0.16, 0.82, -0.22 + 0.58 * 0.38, { sx: 0.008, sy: 0.58 * 1.84, sz: 0.008 }), false, { name: 'string', live: true, unlit: true }),
      P(GEO.cyl, PALETTE.woodLight, M(0.16, 0.82, 0.2, { sx: 0.012, sy: 0.5, sz: 0.012, rx: Math.PI / 2 }), false, { name: 'arrow', live: true }),
      P(GEO.cone, PALETTE.steel, M(0.16, 0.82, 0.47, { sx: 0.025, sy: 0.06, sz: 0.025, rx: Math.PI / 2 }), false, { name: 'arrowTip', live: true }),
    ];
  }

  // Tier dressing: what an upgraded tower wears so its tier reads at a glance.
  // Specialization dressing: a tier-3 tower wears its branch so the choice
  // reads by shape, not just color. All merged into the tower's mesh.
  const ring5 = (n, r, y, fn) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return fn(Math.cos(a) * r, y, Math.sin(a) * r, a, i); });
  const BRANCH_PARTS = {
    // Huntsman: a red plume on the helm, a boar-spear on the back, a horn at the hip
    marksman: () => [
      P(GEO.sphereLo, PALETTE.capRed, M(0, 1.05, -0.06, { sx: 0.05, sy: 0.14, sz: 0.11, rx: -0.4 })),
      P(GEO.cyl, PALETTE.wood, M(0.05, 0.7, -0.24, { sx: 0.02, sy: 1.1, sz: 0.02, rz: -0.25 })),
      P(GEO.cone, PALETTE.steel, M(0.2, 1.28, -0.24, { sx: 0.06, sy: 0.2, sz: 0.02, rz: -0.25 })),
      P(GEO.box, PALETTE.steelDark, M(0.17, 1.15, -0.24, { sx: 0.14, sy: 0.02, sz: 0.02, rz: -0.25 }), false),
      P(GEO.cylTaper, PALETTE.cream, M(0.22, 0.28, 0.08, { sx: 0.04, sy: 0.16, sz: 0.04, rz: 1.2 })),
    ],
    // Skirmisher: a second javelin in the off hand and a full bundle on the back
    bloom: () => [
      P(GEO.cyl, PALETTE.woodLight, M(-0.32, 0.62, 0.14, { sx: 0.02, sy: 0.8, sz: 0.02, rx: 0.2 })),
      P(GEO.cone, PALETTE.steel, M(-0.32, 1.03, 0.22, { sx: 0.03, sy: 0.09, sz: 0.03, rx: 0.2 }), false),
      ...[0, 1, 2].map((i) => P(GEO.cyl, PALETTE.woodLight, M(-0.06 + i * 0.06, 0.7, -0.22, { sx: 0.014, sy: 0.6, sz: 0.014, rz: 0.2 - i * 0.2 }), false)),
      P(GEO.ring, PALETTE.gold, M(0, 0.42, 0, { sx: 0.25, sy: 0.24, sz: 0.25, rx: Math.PI / 2 + 0.4 }), false),
    ],
    // Tar Abbot: an abbot's mitre and a tar barrel at his feet
    thicket: () => [
      P(GEO.cone, PALETTE.cream, M(0.04, 1.04, 0.02, { sx: 0.15, sy: 0.3, sz: 0.1 })),
      P(GEO.box, PALETTE.gold, M(0.04, 1.02, 0.11, { sx: 0.03, sy: 0.24, sz: 0.01 }), false),
      P(GEO.cyl, PALETTE.wood, M(0.28, 0.24, -0.2, { sx: 0.12, sy: 0.24, sz: 0.12 })),
      P(GEO.ring, PALETTE.steelDark, M(0.28, 0.18, -0.2, { s: 0.12, rx: Math.PI / 2 }), false),
      P(GEO.ring, PALETTE.steelDark, M(0.28, 0.3, -0.2, { s: 0.12, rx: Math.PI / 2 }), false),
      P(GEO.cyl, PALETTE.pitch, M(0.28, 0.365, -0.2, { sx: 0.1, sy: 0.01, sz: 0.1 }), false),
    ],
    // Firepot Friar: three lit pots ready round the dais, and a red scarf
    briarstorm: () => [
      ...ring5(3, 0.3, 0.2, (x, y, z, a, i) => P(GEO.sphereLo, PALETTE.pitch, M(x, y, z + (i === 0 ? -0.1 : 0), { s: 0.07 }))),
      ...ring5(3, 0.3, 0.3, (x, y, z, a, i) => P(GEO.cone, PALETTE.ember, M(x, y, z + (i === 0 ? -0.1 : 0), { sx: 0.03, sy: 0.08, sz: 0.03 }), false, { unlit: true })),
      P(GEO.torus, PALETTE.capRed, M(0.04, 0.63, 0.0, { sx: 0.16, sy: 0.16, sz: 0.26, rx: Math.PI / 2 }), false),
    ],
    // Winter Magus: a ring of frost on the ground with icicles around it
    hoarfrost: () => [
      P(GEO.torus, PALETTE.frost, M(0, 0.1, 0, { s: 0.46, rx: Math.PI / 2 }), false),
      ...ring5(6, 0.44, 0.14, (x, y, z, a) => P(GEO.cone, PALETTE.frost, M(x, y, z, { sx: 0.04, sy: 0.18, sz: 0.04, rz: -Math.cos(a) * 0.4, rx: Math.sin(a) * 0.4 }))),
    ],
    // Star Seer: a crown of gold stars on the hat and a star atop the staff
    seer: () => [
      ...ring5(5, 0.14, 1.04, (x, y, z, a) => P(GEO.cone, PALETTE.gold, M(x, y, z + 0.02, { sx: 0.025, sy: 0.12, sz: 0.025, rz: -Math.cos(a) * 0.5, rx: Math.sin(a) * 0.5 }), false)),
      P(GEO.petals, PALETTE.gold, M(-0.27, 1.22, 0.12, { s: 0.14, rx: Math.PI / 2 })),
      P(GEO.bead, PALETTE.cream, M(-0.27, 1.22, 0.13, { s: 0.03 }), false),
    ],
    // Thunder Knight: the ground cracked into spurs around him, a gold bolt crest
    earthshaker: () => [
      ...ring5(6, 0.46, 0.06, (x, y, z, a, i) => P(GEO.rock, i % 2 ? PALETTE.stoneDark : PALETTE.stone, M(x, y, z, { sx: 0.1, sy: 0.14 + (i % 3) * 0.03, sz: 0.1, ry: a }))),
      P(GEO.cone, PALETTE.gold, M(0.1, 1.08, 0.0, { sx: 0.03, sy: 0.16, sz: 0.03, rz: -0.6 }), false),
      P(GEO.cone, PALETTE.gold, M(-0.1, 1.08, 0.0, { sx: 0.03, sy: 0.16, sz: 0.03, rz: 0.6 }), false),
    ],
    // Armorbreaker: spiked pauldrons and a gold crown on the helm
    mountainheart: () => [
      P(GEO.cone, PALETTE.steelDark, M(0.3, 0.75, 0, { sx: 0.04, sy: 0.16, sz: 0.04, rz: -0.4 })),
      P(GEO.cone, PALETTE.steelDark, M(-0.3, 0.75, 0, { sx: 0.04, sy: 0.16, sz: 0.04, rz: 0.4 })),
      P(GEO.cone, PALETTE.steelDark, M(0.34, 0.7, 0.1, { sx: 0.035, sy: 0.12, sz: 0.035, rz: -0.9 })),
      P(GEO.cone, PALETTE.steelDark, M(-0.34, 0.7, 0.1, { sx: 0.035, sy: 0.12, sz: 0.035, rz: 0.9 })),
      P(GEO.cyl, PALETTE.gold, M(0, 1.0, 0.02, { sx: 0.18, sy: 0.05, sz: 0.18 }), false),
      ...ring5(5, 0.17, 1.06, (x, y, z) => P(GEO.cone, PALETTE.gold, M(x, y, z + 0.02, { sx: 0.03, sy: 0.08, sz: 0.03 }), false)),
    ],
    // Fire Archers: a brazier to light the arrows
    oakfall: () => [
      P(GEO.cylTaper, PALETTE.steelDark, M(0.3, 0.22, 0.18, { sx: 0.1, sy: 0.22, sz: 0.1, rx: Math.PI })),
      P(GEO.cyl, PALETTE.pitch, M(0.3, 0.33, 0.18, { sx: 0.09, sy: 0.02, sz: 0.09 }), false),
      P(GEO.cone, PALETTE.ember, M(0.3, 0.42, 0.18, { sx: 0.07, sy: 0.18, sz: 0.07 }), false, { unlit: true }),
      P(GEO.cone, PALETTE.flowerYellow, M(0.3, 0.4, 0.18, { sx: 0.035, sy: 0.1, sz: 0.035 }), false, { unlit: true }),
    ],
    // Volley Captain: a rack of arrows and a captain's red plume
    squirrel: () => [
      P(GEO.box, PALETTE.wood, M(0.3, 0.3, -0.12, { sx: 0.05, sy: 0.36, sz: 0.24 })),
      ...[0, 1, 2, 3, 4].map((i) => P(GEO.cyl, PALETTE.woodLight, M(0.3, 0.5, -0.2 + i * 0.04, { sx: 0.01, sy: 0.3, sz: 0.01 }), false)),
      ...[0, 1, 2, 3, 4].map((i) => P(GEO.box, PALETTE.cream, M(0.3, 0.64, -0.2 + i * 0.04, { sx: 0.005, sy: 0.06, sz: 0.03 }), false)),
      P(GEO.sphereLo, PALETTE.capRed, M(-0.05, 1.12, -0.12, { sx: 0.04, sy: 0.16, sz: 0.08, rx: -0.6 })),
    ],
  };
  const BRANCH_PENNANT = { marksman: PALETTE.capRed, bloom: PALETTE.gold, thicket: PALETTE.pitch, briarstorm: PALETTE.ember,
    hoarfrost: PALETTE.frost, seer: PALETTE.magic, earthshaker: PALETTE.flowerYellow, mountainheart: PALETTE.steelDark, oakfall: PALETTE.capRed, squirrel: PALETTE.cloak };
  function tierParts(tier, branch) {
    const parts = [];
    if (tier >= 2) {
      parts.push(P(GEO.torus, PALETTE.stone, M(0, 0.05, 0, { sx: 0.42, sy: 0.42, sz: 0.42, rx: Math.PI / 2 }), true, { name: 'tierRing' }));
      parts.push(P(GEO.cyl, PALETTE.wood, M(-0.36, 0.42, -0.3, { sx: 0.02, sy: 0.7, sz: 0.02 }), false, { name: 'pennantPole' }));
      parts.push(P(GEO.box, PALETTE.tunic, M(-0.3, 0.68, -0.3, { sx: 0.14, sy: 0.1, sz: 0.01 }), false, { name: 'pennant', live: true, unlit: true }));
    }
    if (tier >= 3) {
      parts.push(P(GEO.torus, PALETTE.gold, M(0, 0.06, 0, { sx: 0.46, sy: 0.46, sz: 0.46, rx: Math.PI / 2 }), false, { name: 'tierRingGold', unlit: true }));
      parts.push(P(GEO.cyl, PALETTE.wood, M(0.36, 0.42, -0.3, { sx: 0.02, sy: 0.7, sz: 0.02 }), false));
      parts.push(P(GEO.box, BRANCH_PENNANT[branch] ?? PALETTE.magic, M(0.42, 0.68, -0.3, { sx: 0.14, sy: 0.1, sz: 0.01 }), false, { name: 'pennant2', live: true, unlit: true }));
      if (BRANCH_PARTS[branch]) parts.push(...BRANCH_PARTS[branch]());
    }
    return parts;
  }

  const TOWER_RECIPES = { slinger: slingerParts, warden: wardenParts, druid: druidParts, golem: golemParts, artillery: artilleryParts };

  // Gargoyle: a hunched stone imp with horns, a toothy grin, ember eyes,
  // a pointed tail and wide bat wings. Flies at height. Silhouette: the
  // wings and horns.
  function batParts() {
    const body = PALETTE.bat, dark = PALETTE.batDark;
    return [
      P(GEO.sphereLo, body, M(0, 0, 0, { sx: 0.17, sy: 0.15, sz: 0.2 }), true, { name: 'body' }),
      P(GEO.sphereLo, body, M(0, 0.08, 0.13, { sx: 0.13, sy: 0.12, sz: 0.11 }), true),
      P(GEO.cone, dark, M(0.07, 0.2, 0.1, { sx: 0.035, sy: 0.12, sz: 0.035, rz: -0.5, rx: -0.3 }), true),
      P(GEO.cone, dark, M(-0.07, 0.2, 0.1, { sx: 0.035, sy: 0.12, sz: 0.035, rz: 0.5, rx: -0.3 }), true),
      P(GEO.bead, PALETTE.spore, M(0.05, 0.1, 0.23, { s: 0.03 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.spore, M(-0.05, 0.1, 0.23, { s: 0.03 }), false, { unlit: true }),
      P(GEO.box, PALETTE.cream, M(0, 0.02, 0.235, { sx: 0.09, sy: 0.025, sz: 0.01 }), false, { unlit: true }),
      P(GEO.box, PALETTE.outline, M(0, 0.035, 0.238, { sx: 0.1, sy: 0.008, sz: 0.008 }), false, { unlit: true }),
      P(GEO.cone, dark, M(0, -0.02, -0.26, { sx: 0.03, sy: 0.2, sz: 0.03, rx: -Math.PI / 2 - 0.3 }), false),
      P(GEO.cone, dark, M(0, -0.07, -0.37, { sx: 0.05, sy: 0.07, sz: 0.015, rx: -Math.PI / 2 }), false),
      P(GEO.sphereLo, dark, M(0.08, -0.12, 0.06, { sx: 0.05, sy: 0.04, sz: 0.06 }), false),
      P(GEO.sphereLo, dark, M(-0.08, -0.12, 0.06, { sx: 0.05, sy: 0.04, sz: 0.06 }), false),
      P(GEO.wingL, dark, pivotMatrix(0.12, 0.02, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.03, 0.5), true, { name: 'wingL', live: true }),
      P(GEO.wingR, dark, pivotMatrix(-0.12, 0.02, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.03, 0.5), true, { name: 'wingR', live: true }),
    ];
  }

  // Cutpurse: a lanky pickpocket in a plum doublet, a jaunty cap with a
  // long feather, a pointy nose and a bulging sack of loot over one
  // shoulder. Faces +z. Silhouette: tall and thin with the sack and feather.
  function tricksterParts() {
    const g = PALETTE.trickster, gd = PALETTE.tricksterDark;
    return [
      P(GEO.sphereLo, g, M(0, 0.3, 0, { sx: 0.12, sy: 0.19, sz: 0.11 }), true, { name: 'body' }),
      P(GEO.sphereLo, gd, M(0.09, 0.05, 0.05, { sx: 0.08, sy: 0.04, sz: 0.15 }), true, { name: 'footL', live: true }),
      P(GEO.sphereLo, gd, M(-0.09, 0.05, 0.05, { sx: 0.08, sy: 0.04, sz: 0.15 }), true, { name: 'footR', live: true }),
      P(GEO.cyl, PALETTE.acornCap, M(0.07, 0.14, 0.02, { sx: 0.03, sy: 0.16, sz: 0.03 }), false),
      P(GEO.cyl, PALETTE.acornCap, M(-0.07, 0.14, 0.02, { sx: 0.03, sy: 0.16, sz: 0.03 }), false),
      P(GEO.cyl, PALETTE.acornCap, M(0, 0.26, 0, { sx: 0.12, sy: 0.03, sz: 0.11 }), false),
      P(GEO.sphere, PALETTE.skin, M(0, 0.58, 0.01, { sx: 0.15, sy: 0.16, sz: 0.14 }), true, { name: 'head' }),
      P(GEO.bead, PALETTE.outline, M(0.06, 0.61, 0.135, { s: 0.022 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.outline, M(-0.06, 0.61, 0.135, { s: 0.022 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.cream, M(0.066, 0.618, 0.153, { s: 0.008 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.cream, M(-0.054, 0.618, 0.153, { s: 0.008 }), false, { unlit: true }),
      P(GEO.cone, 0xe9a283, M(0, 0.56, 0.24, { sx: 0.03, sy: 0.2, sz: 0.03, rx: Math.PI / 2 - 0.2 }), true, { name: 'nose' }),
      P(GEO.box, PALETTE.outline, M(0.02, 0.5, 0.13, { sx: 0.07, sy: 0.012, sz: 0.01, rz: -0.25 }), false),
      // the cap, cocked, and its feather
      P(GEO.sphereLo, gd, M(0.02, 0.72, -0.01, { sx: 0.17, sy: 0.07, sz: 0.16, rz: -0.2 }), true, { name: 'cap' }),
      P(GEO.sphereLo, PALETTE.flowerYellow, M(-0.04, 0.82, -0.08, { sx: 0.025, sy: 0.17, sz: 0.04, rx: -0.6, rz: 0.5 }), true, { name: 'leaf', live: true }),
      // the bulging loot sack over the shoulder, a gold coin peeking out
      P(GEO.sphereLo, PALETTE.canvas, M(0.12, 0.5, -0.12, { sx: 0.13, sy: 0.14, sz: 0.12 }), true, { name: 'earL', live: true }),
      P(GEO.bead, PALETTE.gold, M(0.12, 0.64, -0.08, { s: 0.035 }), false, { name: 'earR', live: true }),
      P(GEO.sphereLo, g, M(0.12, 0.42, 0.04, { s: 0.045 }), true),
      P(GEO.sphereLo, g, M(-0.12, 0.3, 0.04, { s: 0.045 }), true),
    ];
  }

  // Black Knight: a hulking renegade knight in black plate, a bucket helm
  // with glowing red eye-slits and a blood-red plume, a black kite shield
  // and a spiked mace. Faces +z. Silhouette: wide, low, plume and shield.
  function trollParts() {
    const t = PALETTE.troll, td = PALETTE.trollDark;
    return [
      P(GEO.sphereLo, t, M(0, 0.44, -0.02, { sx: 0.36, sy: 0.34, sz: 0.32 }), true, { name: 'body' }),
      P(GEO.cylTaper, td, M(0, 0.22, -0.02, { sx: 0.32, sy: 0.2, sz: 0.3, rx: Math.PI }), false),
      P(GEO.sphereLo, t, M(0.32, 0.64, 0, { sx: 0.17, sy: 0.12, sz: 0.17 }), true),
      P(GEO.sphereLo, t, M(-0.32, 0.64, 0, { sx: 0.17, sy: 0.12, sz: 0.17 }), true),
      P(GEO.ring, PALETTE.baronRed, M(0.32, 0.6, 0, { s: 0.16, rx: Math.PI / 2 }), false),
      P(GEO.ring, PALETTE.baronRed, M(-0.32, 0.6, 0, { s: 0.16, rx: Math.PI / 2 }), false),
      // the helm, eye slit glowing red
      P(GEO.cyl, t, M(0, 0.86, 0.05, { sx: 0.19, sy: 0.3, sz: 0.19 }), true, { name: 'head' }),
      P(GEO.dome, t, M(0, 1.01, 0.05, { sx: 0.19, sy: 0.07, sz: 0.19 }), false),
      P(GEO.box, PALETTE.baronRed, M(0, 0.9, 0.24, { sx: 0.26, sy: 0.035, sz: 0.01 }), false, { unlit: true }),
      P(GEO.box, td, M(0, 0.82, 0.24, { sx: 0.012, sy: 0.1, sz: 0.01 }), false),
      P(GEO.sphereLo, PALETTE.baronRed, M(0, 1.1, -0.02, { sx: 0.06, sy: 0.12, sz: 0.2, rx: 0.3 }), true, { name: 'plume', live: true }),
      // the kite shield on the left arm
      P(GEO.box, PALETTE.baron, M(0.34, 0.42, 0.24, { sx: 0.06, sy: 0.44, sz: 0.3, ry: -0.5 }), true, { name: 'shield' }),
      P(GEO.box, PALETTE.baronRed, M(0.37, 0.44, 0.255, { sx: 0.012, sy: 0.4, sz: 0.06, ry: -0.5 }), false),
      // arms, the mace hand and the mace
      P(GEO.cyl, t, M(-0.36, 0.38, 0.14, { sx: 0.09, sy: 0.32, sz: 0.09, rz: 0.25 }), true, { name: 'armR', live: true }),
      P(GEO.sphereLo, td, M(-0.42, 0.2, 0.2, { sx: 0.1, sy: 0.09, sz: 0.1 }), true, { name: 'fistR', live: true }),
      P(GEO.cyl, PALETTE.wood, M(-0.42, 0.32, 0.3, { sx: 0.025, sy: 0.3, sz: 0.025, rx: 0.7 }), false, { name: 'maceHandle', live: true }),
      P(GEO.sphereLo, PALETTE.steelDark, M(-0.42, 0.42, 0.42, { s: 0.09 }), true, { name: 'maceHead', live: true }),
      P(GEO.sphereLo, td, M(0.14, 0.06, -0.02, { sx: 0.13, sy: 0.07, sz: 0.17 }), true, { name: 'footL', live: true }),
      P(GEO.sphereLo, td, M(-0.14, 0.06, -0.02, { sx: 0.13, sy: 0.07, sz: 0.17 }), true, { name: 'footR', live: true }),
      P(GEO.box, PALETTE.baronRed, M(0, 0.44, 0.31, { sx: 0.16, sy: 0.22, sz: 0.02 }), false),
      P(GEO.box, PALETTE.baron, M(0, 0.47, 0.322, { sx: 0.05, sy: 0.12, sz: 0.01 }), false),
    ];
  }

  // Siege Ram (ground boss): a timber frame on four wheels under a peaked
  // roof of hides, swinging an iron-headed ram log, the Baron's banner on a
  // pole at the back. Faces +z. Silhouette: the long low house on wheels.
  function ramParts() {
    const w = PALETTE.wood, wl = PALETTE.woodLight;
    const parts = [
      P(GEO.box, w, M(0, 0.24, 0, { sx: 0.7, sy: 0.08, sz: 1.2 }), true, { name: 'body' }),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => P(GEO.cyl, w, M(sx * 0.33, 0.6, sz * 0.52, { sx: 0.04, sy: 0.72, sz: 0.04 }), true)),
      // the gabled roof of hides, a ridge pole and lashings
      P(GEO.box, PALETTE.acorn, M(0.19, 1.05, 0, { sx: 0.48, sy: 0.04, sz: 1.32, rz: -0.72 }), true),
      P(GEO.box, PALETTE.acornCap, M(-0.19, 1.05, 0, { sx: 0.48, sy: 0.04, sz: 1.32, rz: 0.72 }), true),
      P(GEO.cyl, w, M(0, 1.22, 0, { sx: 0.035, sy: 1.4, sz: 0.035, rx: Math.PI / 2 }), false),
      ...[-0.4, 0, 0.4].map((z) => P(GEO.box, PALETTE.straw, M(0, 1.06, z, { sx: 0.68, sy: 0.02, sz: 0.03 }), false)),
      // iron straps and studs
      P(GEO.box, PALETTE.steelDark, M(0, 0.29, 0.6, { sx: 0.72, sy: 0.06, sz: 0.03 }), false),
      P(GEO.bead, PALETTE.gold, M(0.25, 0.29, 0.62, { s: 0.02 }), false),
      P(GEO.bead, PALETTE.gold, M(-0.25, 0.29, 0.62, { s: 0.02 }), false),
      // the Baron's black banner at the back
      P(GEO.cyl, w, M(0, 1.5, -0.56, { sx: 0.02, sy: 0.7, sz: 0.02 }), false),
      P(GEO.box, PALETTE.baron, M(0.14, 1.66, -0.56, { sx: 0.28, sy: 0.2, sz: 0.01 }), true, { name: 'flag', live: true }),
      P(GEO.box, PALETTE.baronRed, M(0.14, 1.66, -0.555, { sx: 0.28, sy: 0.05, sz: 0.01 }), false, { name: 'flagStripe', live: true }),
      // the ram log hung on chains, with its iron head
      P(GEO.cyl, wl, M(0, 0.62, 0.1, { sx: 0.1, sy: 1.25, sz: 0.1, rx: Math.PI / 2 }), true, { name: 'ram', live: true }),
      P(GEO.cylTaper, PALETTE.steelDark, M(0, 0.62, 0.8, { sx: 0.13, sy: 0.2, sz: 0.13, rx: Math.PI / 2 }), true, { name: 'ramHead', live: true }),
      P(GEO.cyl, PALETTE.steelDark, M(0, 0.85, -0.2, { sx: 0.01, sy: 0.4, sz: 0.01 }), false),
      P(GEO.cyl, PALETTE.steelDark, M(0, 0.85, 0.4, { sx: 0.01, sy: 0.4, sz: 0.01 }), false),
      // the brigands' boots shuffling underneath
      P(GEO.sphereLo, PALETTE.goblinDark, M(0.18, 0.06, -0.3, { sx: 0.08, sy: 0.05, sz: 0.11 }), true, { name: 'footL', live: true }),
      P(GEO.sphereLo, PALETTE.goblinDark, M(-0.18, 0.06, 0.1, { sx: 0.08, sy: 0.05, sz: 0.11 }), true, { name: 'footR', live: true }),
    ];
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 ? 1 : -1, sz = i < 2 ? -0.42 : 0.42;
      parts.push(P(GEO.cyl, wl, M(sx * 0.38, 0.2, sz, { sx: 0.2, sy: 0.07, sz: 0.2, rz: Math.PI / 2 }), true, { name: `wheel${i}`, live: true }));
      parts.push(P(GEO.cyl, PALETTE.steelDark, M(sx * 0.42, 0.2, sz, { sx: 0.05, sy: 0.04, sz: 0.05, rz: Math.PI / 2 }), false));
    }
    return parts;
  }

  // Swarm-rig boss: a churning core with small creatures wheeling around
  // it, peeling away as it weakens (see updateBossView). The Gargoyle Lord
  // uses it: a great horned lump of abbey stone, its brood of imps around it.
  const BOSS_CROWS = 7;
  function makeBossParts(cfg) {
    const {
      coreColor, coreScale = { s: 0.36 }, heartColor = PALETTE.magic, heartScale = { s: 0.2 },
      accentColor, extra = [],
      orbitScale = { sx: 0.1, sy: 0.08, sz: 0.14 }, orbitColor,
      wingScale = { sx: 0.4, sy: 0.02, sz: 0.14 }, wingColor,
      beakScale = { sx: 0.03, sy: 0.08, sz: 0.03 }, beakColor,
    } = cfg;
    const parts = [
      P(GEO.rock, coreColor, M(0, 0, 0, coreScale), true, { name: 'core', live: true }),
      P(GEO.sphereLo, heartColor, M(0, 0, 0, heartScale), false, { name: 'heart', live: true, unlit: true }),
      P(GEO.sphereLo, accentColor, M(0.12, 0.08, 0.32, { s: 0.05 }), false, { unlit: true }),
      P(GEO.sphereLo, accentColor, M(-0.12, 0.08, 0.32, { s: 0.05 }), false, { unlit: true }),
      ...extra,
    ];
    for (let i = 0; i < BOSS_CROWS; i++) {
      parts.push(P(GEO.sphereLo, orbitColor, M(0, 0, 0, orbitScale), true, { name: `crow${i}`, live: true }));
      parts.push(P(GEO.box, wingColor, M(0, 0, 0, wingScale), true, { name: `crowWing${i}`, live: true }));
      parts.push(P(GEO.cone, beakColor, M(0, 0, 0, beakScale), false, { name: `crowBeak${i}`, live: true, unlit: true }));
    }
    return parts;
  }
  function stonelordParts() {
    return makeBossParts({
      coreColor: PALETTE.bat, coreScale: { sx: 0.4, sy: 0.36, sz: 0.38 }, heartColor: PALETTE.spore, heartScale: { s: 0.16 }, accentColor: PALETTE.spore,
      extra: [
        P(GEO.cone, PALETTE.batDark, M(0.18, 0.36, 0.1, { sx: 0.07, sy: 0.26, sz: 0.07, rz: -0.5 })),
        P(GEO.cone, PALETTE.batDark, M(-0.18, 0.36, 0.1, { sx: 0.07, sy: 0.26, sz: 0.07, rz: 0.5 })),
        P(GEO.box, PALETTE.batDark, M(0.55, 0.12, -0.08, { sx: 0.6, sy: 0.025, sz: 0.36, rz: 0.35 })),
        P(GEO.box, PALETTE.batDark, M(-0.55, 0.12, -0.08, { sx: 0.6, sy: 0.025, sz: 0.36, rz: -0.35 })),
        P(GEO.box, PALETTE.cream, M(0, -0.02, 0.36, { sx: 0.2, sy: 0.04, sz: 0.02 }), false, { unlit: true }),
      ],
      orbitScale: { sx: 0.08, sy: 0.08, sz: 0.1 }, orbitColor: PALETTE.bat,
      wingScale: { sx: 0.34, sy: 0.015, sz: 0.12 }, wingColor: PALETTE.batDark,
      beakScale: { sx: 0.02, sy: 0.05, sz: 0.02 }, beakColor: PALETTE.spore,
    });
  }

  // The Black Dragon (final boss): a long-necked wyrm with ember eyes, a
  // ridge of red spines, a spade-tipped tail and vast leathery wings.
  // Faces +z. Silhouette: the wingspan and the neck.
  function dragonParts() {
    const d = PALETTE.dragon, dw = PALETTE.dragonWing;
    const parts = [
      P(GEO.sphereLo, d, M(0, 0, 0, { sx: 0.3, sy: 0.27, sz: 0.5 }), true, { name: 'core' }),
      P(GEO.sphereLo, PALETTE.dragonBelly, M(0, -0.1, 0.04, { sx: 0.22, sy: 0.15, sz: 0.42 }), false),
      // neck, head, snout, horns and eyes
      P(GEO.cylTaper, d, M(0, 0.18, 0.46, { sx: 0.11, sy: 0.42, sz: 0.11, rx: 0.9 }), true),
      P(GEO.sphereLo, d, M(0, 0.36, 0.68, { sx: 0.15, sy: 0.13, sz: 0.17 }), true, { name: 'head' }),
      P(GEO.box, d, M(0, 0.32, 0.84, { sx: 0.14, sy: 0.08, sz: 0.2 }), true),
      P(GEO.box, PALETTE.dragonBelly, M(0, 0.26, 0.82, { sx: 0.12, sy: 0.04, sz: 0.18 }), true, { name: 'jaw', live: true }),
      P(GEO.cone, PALETTE.cream, M(0.08, 0.48, 0.62, { sx: 0.03, sy: 0.16, sz: 0.03, rx: -0.9 }), false),
      P(GEO.cone, PALETTE.cream, M(-0.08, 0.48, 0.62, { sx: 0.03, sy: 0.16, sz: 0.03, rx: -0.9 }), false),
      P(GEO.bead, PALETTE.spore, M(0.09, 0.4, 0.78, { s: 0.03 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.spore, M(-0.09, 0.4, 0.78, { s: 0.03 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.outline, M(0.04, 0.35, 0.94, { s: 0.015 }), false),
      P(GEO.bead, PALETTE.outline, M(-0.04, 0.35, 0.94, { s: 0.015 }), false),
      // the tail and its spade
      P(GEO.cone, d, M(0, -0.02, -0.66, { sx: 0.12, sy: 0.5, sz: 0.12, rx: -Math.PI / 2 - 0.15 }), true, { name: 'tail' }),
      P(GEO.cone, PALETTE.baronRed, M(0, -0.06, -0.96, { sx: 0.1, sy: 0.12, sz: 0.02, rx: -Math.PI / 2 }), false),
      // little legs tucked up
      P(GEO.sphereLo, d, M(0.18, -0.2, 0.18, { sx: 0.07, sy: 0.06, sz: 0.09 }), false),
      P(GEO.sphereLo, d, M(-0.18, -0.2, 0.18, { sx: 0.07, sy: 0.06, sz: 0.09 }), false),
      P(GEO.sphereLo, d, M(0.16, -0.2, -0.22, { sx: 0.07, sy: 0.06, sz: 0.09 }), false),
      P(GEO.sphereLo, d, M(-0.16, -0.2, -0.22, { sx: 0.07, sy: 0.06, sz: 0.09 }), false),
      // the wings: a leathery membrane and a bony leading edge, each flapping from the shoulder
      P(GEO.wingL, dw, pivotMatrix(0.2, 0.14, 0.1, 0, 0, 0, 0, 0, 0, 1.15, 0.035, 1.0), true, { name: 'wingL', live: true }),
      P(GEO.wingR, dw, pivotMatrix(-0.2, 0.14, 0.1, 0, 0, 0, 0, 0, 0, 1.15, 0.035, 1.0), true, { name: 'wingR', live: true }),
    ];
    for (let i = 0; i < 5; i++) parts.push(P(GEO.cone, PALETTE.baronRed, M(0, 0.25 - i * 0.02, 0.28 - i * 0.18, { sx: 0.04, sy: 0.12, sz: 0.06, rx: -0.3 }), false));
    return parts;
  }

  const WALK = {
    grunt:     { freq: 7.5, bounce: 0.09, lean: 0.1, sway: 0.08 },
    trickster: { freq: 12,  bounce: 0.15, lean: 0.25, sway: 0.16 },
    troll:     { freq: 3.6, bounce: 0.05, lean: 0.04, sway: 0.06 },
    ram:       { freq: 2.4, bounce: 0.02, lean: 0, sway: 0.025 },
  };
  const ENEMY_RECIPES = { grunt: gruntParts, trickster: tricksterParts, troll: trollParts, bat: batParts, ram: ramParts, stonelord: stonelordParts, dragon: dragonParts };

  // -------- particles: a pooled dust puff --------
  // The whole pool is one Points draw call: each puff is a flat round
  // sprite (what an unlit sphere looked like anyway), however many are alive.
  const PUFFS = 64;
  const particles = [];
  let puffGeo = null;
  function buildParticles() {
    for (let i = 0; i < PUFFS; i++) particles.push({ alive: false, life: 0, ttl: 1, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, size: 0.1, color: new THREE.Color() });
    puffGeo = new THREE.BufferGeometry();
    puffGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PUFFS * 3), 3));
    puffGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(PUFFS * 3), 3));
    puffGeo.setAttribute('pSize', new THREE.BufferAttribute(new Float32Array(PUFFS), 1));
    puffGeo.setAttribute('pAlpha', new THREE.BufferAttribute(new Float32Array(PUFFS), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: moteScale },
      vertexShader: `
        attribute vec3 color; attribute float pSize, pAlpha;
        uniform float uScale;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = color; vAlpha = pAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pAlpha > 0.0 ? pSize * 2.0 * uScale : 0.0;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          if (r > 0.5) discard;
          gl_FragColor = vec4(vColor * (1.0 - r * 0.35), vAlpha * (1.0 - smoothstep(0.42, 0.5, r)));
        }`,
      transparent: true, depthWrite: false,
    });
    const pts = new THREE.Points(puffGeo, mat);
    pts.frustumCulled = false;
    pts.name = 'puffs';
    pts.renderOrder = 2;
    scene.add(pts);
    animated.push({
      update(t, dt) {
        const pos = puffGeo.attributes.position.array, col = puffGeo.attributes.color.array;
        const siz = puffGeo.attributes.pSize.array, alp = puffGeo.attributes.pAlpha.array;
        particles.forEach((u, i) => {
          if (u.alive) {
            u.life += dt;
            if (u.life >= u.ttl) u.alive = false;
          }
          if (!u.alive) { alp[i] = 0; return; }
          const k = u.life / u.ttl;
          u.vy -= 1.6 * dt;
          u.x += u.vx * dt; u.y += u.vy * dt; u.z += u.vz * dt;
          if (u.y < 0.03) { u.y = 0.03; u.vy = Math.abs(u.vy) * 0.3; }
          pos[i * 3] = u.x; pos[i * 3 + 1] = u.y; pos[i * 3 + 2] = u.z;
          col[i * 3] = u.color.r; col[i * 3 + 1] = u.color.g; col[i * 3 + 2] = u.color.b;
          siz[i] = u.size * (1 - k * 0.6);
          alp[i] = 0.85 * (1 - k);
        });
        for (const k in puffGeo.attributes) puffGeo.attributes[k].needsUpdate = true;
      },
    });
  }
  function puff(x, y, z, { count = 8, color = PALETTE.cream, speed = 1.2, size = 0.1, up = 1.4, ttl = 0.6 } = {}) {
    let n = 0;
    for (const u of particles) {
      if (u.alive) continue;
      const a = Math.random() * Math.PI * 2, s = speed * (0.5 + Math.random() * 0.5);
      Object.assign(u, { alive: true, life: 0, ttl: ttl * (0.7 + Math.random() * 0.5), x, y, z, vx: Math.cos(a) * s, vy: up * (0.4 + Math.random() * 0.6), vz: Math.sin(a) * s, size: size * (0.6 + Math.random() * 0.8) });
      u.color.setHex(color);
      if (++n >= count) break;
    }
  }

  // -------- projectile views: pooled javelins, pots, bolts, hammers, arrows --------
  // Javelins and arrows fly point-first along their arc (AIMED); the rest tumble.
  const projPools = {};
  const projViews = new Map();
  const shaft = (len, r, color, tipColor, z = 0, x = 0, y = 0) => {
    const g = new THREE.Group();
    const s = new THREE.Mesh(GEO.cyl, toon(color));
    s.scale.set(r, len, r); s.rotation.x = Math.PI / 2; s.position.set(x, y, z);
    const tip = new THREE.Mesh(GEO.cone, toon(tipColor));
    tip.scale.set(r * 2.2, len * 0.22, r * 2.2); tip.rotation.x = Math.PI / 2; tip.position.set(x, y, z + len * 0.55);
    g.add(s, tip);
    return { g, s };
  };
  const PROJ_MAKERS = {
    acorn() {   // a javelin
      const { g, s } = shaft(0.5, 0.02, PALETTE.woodLight, PALETTE.steel);
      addOutline(s);
      return g;
    },
    bigacorn() {   // a volley of three arrows with white fletching
      const g = new THREE.Group();
      for (const [x, y, z] of [[0, 0.06, 0.05], [-0.1, -0.03, -0.04], [0.1, -0.02, 0]]) {
        const a = shaft(0.42, 0.014, PALETTE.woodLight, PALETTE.steel, z, x, y);
        const f = new THREE.Mesh(GEO.box, toon(PALETTE.cream));
        f.scale.set(0.05, 0.005, 0.08); f.position.set(x, y, z - 0.17);
        a.g.add(f);
        g.add(a.g);
      }
      return g;
    },
    thorn() {   // a clay pot of pitch with a lit rag
      const g = new THREE.Group();
      const pot = new THREE.Mesh(GEO.sphereLo, toon(PALETTE.pitch));
      pot.scale.set(0.1, 0.09, 0.1); addOutline(pot);
      const rim = new THREE.Mesh(GEO.torus, toon(PALETTE.steelDark));
      rim.scale.setScalar(0.06); rim.rotation.x = Math.PI / 2; rim.position.y = 0.08;
      const flame = new THREE.Mesh(GEO.cone, unlit(PALETTE.ember));
      flame.scale.set(0.04, 0.1, 0.04); flame.position.y = 0.14;
      g.add(pot, rim, flame);
      return g;
    },
    wisp() {   // a frost bolt
      const g = new THREE.Group();
      const core = new THREE.Mesh(GEO.sphereLo, unlit(PALETTE.cream));
      core.scale.setScalar(0.05);
      const halo = new THREE.Mesh(GEO.sphereLo, unlit(PALETTE.frost, { opacity: 0.6, depthWrite: false }));
      halo.scale.setScalar(0.1);
      g.add(core, halo);
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(GEO.cone, unlit(PALETTE.frost));
        c.scale.set(0.02, 0.09, 0.02); c.rotation.z = i * 2.1; c.position.set(Math.sin(i * 2.1) * -0.06, Math.cos(i * 2.1) * 0.06, 0);
        g.add(c);
      }
      return g;
    },
    boulder() {   // a thrown warhammer, end over end
      const g = new THREE.Group();
      const h = new THREE.Mesh(GEO.cyl, toon(PALETTE.wood));
      h.scale.set(0.03, 0.4, 0.03);
      const head = new THREE.Mesh(GEO.box, toon(PALETTE.steelDark));
      head.scale.set(0.22, 0.13, 0.13); head.position.y = 0.2; addOutline(head);
      g.add(h, head);
      return g;
    },
  };
  const AIMED = { acorn: true, bigacorn: true };
  const PROJ_ARC = { acorn: 0.45, bigacorn: 1.6, thorn: 0.7, wisp: 0.15, boulder: 0.3 };
  const _aim = new THREE.Vector3();
  function updateProjectileViews() {
    const live = new Set();
    for (const p of GameState.state.projectiles) {
      live.add(p.id);
      let g = projViews.get(p.id);
      let fresh = false;
      if (!g) {
        const pool = projPools[p.kind] || (projPools[p.kind] = []);
        g = pool.pop();
        if (!g) { g = PROJ_MAKERS[p.kind](); g.userData.kind = p.kind; scene.add(g); }
        g.visible = true;
        projViews.set(p.id, g);
        fresh = true;
      }
      const targetY = p.targetBoss ? BOSS_HEIGHT : BAT_HEIGHT;
      const baseY = p.targetFlying ? 0.75 + p.t * (targetY - 0.75) : 0.75;
      const px = g.position.x, py = g.position.y, pz = g.position.z;
      g.position.set(p.x, baseY + Math.sin(p.t * Math.PI) * PROJ_ARC[p.kind], p.z);
      if (AIMED[p.kind]) {
        if (!fresh && (px !== g.position.x || pz !== g.position.z)) {
          _aim.set(g.position.x * 2 - px, g.position.y * 2 - py, g.position.z * 2 - pz);
          g.lookAt(_aim);
        }
      } else { g.rotation.x += 0.4; g.rotation.z += 0.25; }
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
    const parts = TOWER_RECIPES[tower.type]().concat(tierParts(tower.tier, tower.branch));
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
    // the squire cocks the javelin back, then throws: his hand snaps
    // forward empty and a fresh javelin is in it a beat later
    slinger(v, pull, recoil, t) {
      const back = pull * 0.18 - recoil * 0.2;
      for (const n of ['hand', 'javelin', 'tip']) {
        v.live[n].position.z = v.base[n].p.z - back;
        v.live[n].position.y = v.base[n].p.y + pull * 0.06;
      }
      v.live.arm.rotation.x = v.base.arm.r.x + back * 1.6;
      v.live.javelin.visible = v.live.tip.visible = recoil < 0.45;
      const wob = Math.sin(t * 2.2 + v.tower.id + 0.5) * 0.05;
      for (const n of ['hat', 'brim', 'helmKnob']) v.live[n].rotation.z = v.base[n].r.z + wob;
      v.group.rotation.x = -pull * 0.1 + recoil * 0.16;
    },
    // the friar heaves the pot up and back on its ladle, then lobs it; the
    // cauldron bubbles and its fire licks the whole time
    warden(v, pull, recoil, t) {
      const raise = pull * 0.9 - recoil * 0.5;
      for (const n of ['staff', 'thornBall', 'thorn1', 'thorn2']) {
        const b = v.base[n];
        v.live[n].position.y = b.p.y + raise * 0.22;
        v.live[n].position.z = b.p.z - raise * 0.14;
        v.live[n].rotation.x = b.r.x - raise * 0.5;
      }
      const thrown = recoil > 0.5;
      v.live.thornBall.visible = v.live.thorn1.visible = v.live.thorn2.visible = !thrown;
      v.live.thorn2.scale.set(v.base.thorn2.s.x, v.base.thorn2.s.y * (0.8 + 0.4 * Math.abs(Math.sin(t * 14 + v.tower.id))), v.base.thorn2.s.z);
      v.live.brew.position.y = v.base.brew.p.y + Math.abs(Math.sin(t * 5 + v.tower.id)) * 0.012;
      const fl = 0.75 + 0.35 * Math.abs(Math.sin(t * 11 + v.tower.id) * Math.sin(t * 4.3));
      v.live.flame.scale.set(v.base.flame.s.x * (1.6 - fl * 0.6), v.base.flame.s.y * fl, v.base.flame.s.z * (1.6 - fl * 0.6));
      v.group.rotation.x = -pull * 0.08 + recoil * 0.12;
    },
    // the magus's orb swells as he gathers frost, then lurches as it fires
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
      v.live.hatTip.rotation.z = v.base.hatTip.r.z + Math.sin(t * 1.8 + v.tower.id) * 0.12 + pull * 0.2;
      v.group.rotation.x = recoil * 0.08;
    },
    // the knight swings the hammer back over his helm, then hurls it down
    // the road; a new one is in his fists as he comes back to guard
    golem(v, pull, recoil, t) {
      const ang = 0.5 - pull * 2.2 + recoil * 1.0;
      for (const n of ['handle', 'hammerHead', 'fistL', 'fistR']) {
        v.live[n].matrixAutoUpdate = false;
        hammerPose(n, ang, v.live[n].matrix);
      }
      v.live.handle.visible = v.live.hammerHead.visible = recoil < 0.35;
      for (const side of ['L', 'R']) v.live['arm' + side].rotation.x = v.base['arm' + side].r.x + (ang - 0.5) * 0.9;
      const breathe = 1 + Math.sin(t * 1.4 + v.tower.id) * 0.03;
      for (const n of ['shoulders', 'shoulders2']) v.live[n].scale.set(v.base[n].s.x * breathe, v.base[n].s.y, v.base[n].s.z * breathe);
      v.live.crest.rotation.x = Math.sin(t * 2 + v.tower.id) * 0.06 - pull * 0.2;
      v.group.rotation.x = -pull * 0.06 + recoil * 0.14;
    },
    // the yeoman aims high, draws the string back, and looses
    artillery(v, pull, recoil, t) {
      const draw = pull * 0.13 - recoil * 0.04;
      for (const n of ['string', 'arrow', 'arrowTip']) v.live[n].position.z = v.base[n].p.z - draw;
      v.live.arrow.visible = v.live.arrowTip.visible = recoil < 0.25;
      v.live.bow.scale.set(v.base.bow.s.x, v.base.bow.s.y * (1 - pull * 0.05), v.base.bow.s.z * (1 - pull * 0.08));
      v.live.feather.rotation.z = v.base.feather.r.z + Math.sin(t * 2.6 + v.tower.id) * 0.18;
      v.live.hat.rotation.x = v.base.hat.r.x + Math.sin(t * 1.7 + v.tower.id) * 0.06;
      v.group.rotation.x = -pull * 0.16 + recoil * 0.1;
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
    const g = liveProp(ENEMY_RECIPES[e.type](), e.x, 0, e.z, { ao: !e.flying });
    g.name = `enemy-${e.id}`;
    const big = e.type === 'troll' ? 0.45 : e.type === 'ram' ? 0.85 : 0.3;
    const v = { group: g, e, decal: decal(0, 0, big, g), decalR: big, pop: 0, live: {} };
    g.traverse((o) => { if (o.name && o !== g) v.live[o.name] = o; });
    if (e.flying) {
      v.wingL = v.live.wingL; v.wingR = v.live.wingR;
      if (v.wingL) { v.wingL.matrixAutoUpdate = false; v.wingR.matrixAutoUpdate = false; }
      v.decal.scale.setScalar(e.boss ? 0.7 : 0.22);
      v.breath = 2 + Math.random() * 2;
    } else {
      v.earL = v.live.earL; v.earR = v.live.earR;
      v.footL = v.live.footL; v.footR = v.live.footR;
      if (e.type === 'grunt') v.earL.matrixAutoUpdate = false;
      v.baseFootY = v.footL.position.y;
      v.walk = WALK[e.type];
      v.base = {};
      for (const k in v.live) v.base[k] = { p: v.live[k].position.clone(), r: v.live[k].rotation.clone() };
    }
    // status dressing: frost crystals when chilled, a puddle of pitch when stuck
    v.frost = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(GEO.cone, unlit(PALETTE.frost));
      const a = i * 2.1;
      c.position.set(Math.cos(a) * 0.2, 0.25 + i * 0.08, Math.sin(a) * 0.2);
      c.scale.set(0.05, 0.14, 0.05); c.rotation.z = Math.cos(a) * 0.5; c.rotation.x = Math.sin(a) * 0.5;
      v.frost.add(c);
    }
    v.frost.visible = false; g.add(v.frost);
    v.roots = new THREE.Group();
    const pool = new THREE.Mesh(GEO.circle, toon(PALETTE.pitch));
    pool.position.y = 0.02; pool.scale.setScalar(0.34);
    v.roots.add(pool);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(GEO.bead, toon(PALETTE.pitch));
      b.position.set(Math.cos(i * 2.3) * 0.22, 0.04, Math.sin(i * 2.3) * 0.2); b.scale.set(0.06, 0.04, 0.06);
      v.roots.add(b);
    }
    v.roots.visible = false; g.add(v.roots);
    enemyViews.set(e.id, v);
    puff(e.x, e.flying ? BAT_HEIGHT : 0.3, e.z, { count: e.boss ? 24 : 7, color: e.flying ? PALETTE.batDark : 0x8c847a, speed: e.boss ? 2 : 0.8, size: e.boss ? 0.16 : 0.09, up: 1.2 });
    return v;
  }
  function updateEnemyViews(t, dt) {
    for (const v of enemyViews.values()) {
      const e = v.e, g = v.group;
      v.frost.visible = !!e.chilled;
      v.roots.visible = !!e.rooted;
      if (e.chilled) v.frost.rotation.y = t * 2;
      if (e.type === 'dragon') { updateDragonView(v, t, dt); continue; }
      if (e.boss && e.flying) { updateBossView(v, t, dt); continue; }
      if (e.flying) { updateBatView(v, t, dt); continue; }
      const w = v.walk;
      const cycle = e.dist * w.freq;
      const bounce = e.rooted ? 0 : Math.abs(Math.sin(cycle));
      const struggle = e.rooted ? Math.sin(t * 30) * 0.03 : 0;
      const born = Math.min(1, e.age / 0.35);   // stride out of the camp
      g.position.set(e.x + struggle, w.bounce * bounce, e.z);
      g.rotation.y = Math.atan2(e.dirX, e.dirZ);
      g.rotation.x = w.lean;
      g.rotation.z = Math.sin(cycle) * w.sway + struggle * 4;
      const stretch = 0.9 + 0.22 * bounce;
      v.pop = Math.max(0, v.pop - dt * 5);
      const popK = Math.sin(Math.min(1, v.pop) * Math.PI) * (e.boss ? 0.15 : 0.35);   // scale-pop when hit
      const s = born * (1 - (1 - born) * 0.5);
      const sq = e.boss ? 0.3 : 1;
      g.scale.set(s * (1 + (0.06 - 0.1 * bounce) * sq + popK), s * (1 + (stretch - 1) * sq - popK * 0.6), s * (1 + (0.06 - 0.1 * bounce) * sq + popK));
      const flap = 0.35 + 0.45 * bounce;
      if (e.type === 'grunt') {
        // the hood tail flops behind with every step
        pivotMatrix(0, 0.66, -0.16, -1.9 + flap * 0.7, 0, Math.sin(cycle) * 0.3, 0, 0.14, 0, 0.08, 0.3, 0.06, v.earL.matrix);
      } else if (e.type === 'trickster') {
        // the loot sack bounces on his shoulder, the feather whips about
        v.earL.position.y = v.base.earL.p.y + bounce * 0.05;
        v.earR.position.y = v.base.earR.p.y + bounce * 0.07;
        v.live.leaf.rotation.z = v.base.leaf.r.z + Math.sin(cycle) * 0.35;
      } else if (e.type === 'troll') {
        // a heavy stomp: the mace swings, the plume bobs
        v.live.armR.rotation.x = -Math.sin(cycle) * 0.3;
        v.live.fistR.position.z = v.base.fistR.p.z + Math.sin(cycle) * 0.08;
        v.live.maceHandle.position.z = v.base.maceHandle.p.z + Math.sin(cycle) * 0.08;
        v.live.maceHead.position.z = v.base.maceHead.p.z + Math.sin(cycle) * 0.1;
        v.live.plume.rotation.x = v.base.plume.r.x + bounce * 0.3;
      } else if (e.type === 'ram') {
        // wheels roll with the distance covered, the ram log swings on its chains
        for (let i = 0; i < 4; i++) v.live[`wheel${i}`].rotation.x = -e.dist * 4.5;
        const swing = Math.sin(t * 2.4) * 0.12;
        v.live.ram.position.z = v.base.ram.p.z + swing;
        v.live.ramHead.position.z = v.base.ramHead.p.z + swing;
        v.live.flag.rotation.y = Math.sin(t * 5) * 0.4;
        v.live.flagStripe.rotation.y = v.live.flag.rotation.y;
      }
      const stride = e.type === 'troll' ? 0.1 : 0.12;
      v.footL.position.z = v.base.footL.p.z + Math.sin(cycle) * stride;
      v.footR.position.z = v.base.footR.p.z - Math.sin(cycle) * stride;
      v.footL.position.y = v.baseFootY + Math.max(0, Math.sin(cycle)) * 0.06 - w.bounce * bounce;
      v.footR.position.y = v.baseFootY + Math.max(0, -Math.sin(cycle)) * 0.06 - w.bounce * bounce;
      v.decal.scale.setScalar(v.decalR * (1 - 0.3 * bounce));
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
    v.live.heart.scale.setScalar(0.16 + Math.sin(t * 9) * 0.04 + popK);
    v.live.core.rotation.y = Math.sin(t * 0.8) * 0.4; v.live.core.rotation.x = Math.sin(t) * 0.15;
    const alive = Math.max(1, Math.ceil(BOSS_CROWS * e.hp / e.maxHp));
    for (let i = 0; i < BOSS_CROWS; i++) {
      const show = i < alive;
      const a = t * 2.2 + i * (Math.PI * 2 / BOSS_CROWS);
      const r = 0.7 + Math.sin(t * 3 + i) * 0.08, y = Math.sin(t * 4 + i * 1.3) * 0.16;
      const body = v.live[`crow${i}`], wing = v.live[`crowWing${i}`], beak = v.live[`crowBeak${i}`];
      body.visible = wing.visible = beak.visible = show;
      if (!show) continue;
      body.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      body.rotation.y = -a;   // nose along the orbit
      wing.position.copy(body.position);
      wing.rotation.y = -a; wing.rotation.z = Math.sin(t * 20 + i) * 0.7;
      beak.position.set(Math.cos(a) * r - Math.sin(a) * 0.1, y + 0.03, Math.sin(a) * r + Math.cos(a) * 0.1);
      beak.rotation.set(Math.PI / 2, 0, 0); beak.rotation.y = -a;
    }
    v.decal.position.y = -(BOSS_HEIGHT + bob) + 0.012;
    v.decal.scale.setScalar(0.7 - bob * 0.5);
  }
  // The dragon glides with slow heavy wingbeats, its body rising on each
  // downstroke, and every few seconds it opens its jaws and breathes embers.
  function updateDragonView(v, t, dt) {
    const e = v.e, g = v.group;
    const born = Math.min(1, e.age / 0.8);
    v.pop = Math.max(0, v.pop - dt * 5);
    const popK = Math.sin(Math.min(1, v.pop) * Math.PI) * 0.12;
    const beat = Math.sin(t * 6.5);
    const bob = -beat * 0.08 + Math.sin(t * 1.3) * 0.06;
    g.position.set(e.x, BOSS_HEIGHT + 0.15 + bob, e.z);
    g.rotation.y = Math.atan2(e.dirX, e.dirZ);
    g.rotation.x = beat * 0.05;
    g.scale.set(born * (1 + popK), born * (1 - popK * 0.5), born * (1 + popK));
    const flap = beat * 0.7 + 0.1;
    pivotMatrix(0.2, 0.14, 0.1, 0, 0, flap, 0, 0, 0, 1.15, 0.035, 1.0, v.wingL.matrix);
    pivotMatrix(-0.2, 0.14, 0.1, 0, 0, -flap, 0, 0, 0, 1.15, 0.035, 1.0, v.wingR.matrix);
    v.breath -= dt;
    const open = v.breath < 0.6 ? Math.sin(Math.max(0, v.breath) / 0.6 * Math.PI) : 0;
    v.live.jaw.position.y = 0.26 - open * 0.08;
    v.live.jaw.rotation.x = open * 0.5;
    if (v.breath < 0.45 && v.breath > 0 && Math.random() < 0.6) {
      const fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y);
      puff(e.x + fx * 1.0, g.position.y + 0.25, e.z + fz * 1.0, { count: 2, color: Math.random() < 0.5 ? PALETTE.ember : PALETTE.flowerYellow, speed: 0.9, size: 0.1, up: 0.4, ttl: 0.5 });
    }
    if (v.breath <= 0) v.breath = 2.5 + Math.random() * 1.5;
    v.decal.position.y = -(g.position.y) + 0.012;
    v.decal.scale.setScalar(0.8 - bob * 0.5);
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
    pivotMatrix(0.12, 0.02, 0, 0, 0, flap, 0, 0, 0, 0.5, 0.03, 0.5, v.wingL.matrix);
    pivotMatrix(-0.12, 0.02, 0, 0, 0, -flap, 0, 0, 0, 0.5, 0.03, 0.5, v.wingR.matrix);
    v.decal.position.y = -(BAT_HEIGHT + bob) + 0.012;   // shadow stays on the ground
  }
  // Exit animations are capped: if more than this many are playing at once
  // (never in real play), the oldest simply finish, so a pile-up of deaths
  // can't stall the page on one enormous frame.
  const MAX_DYING = 60;
  function removeEnemyView(e, exit) {
    const v = enemyViews.get(e.id);
    if (!v) return;
    enemyViews.delete(e.id);
    exit(v);
    while (dying.length > MAX_DYING) scene.remove(dying.shift().group);
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
          if (v.e.boss) { puff(g.position.x, 0.6, g.position.z, { count: 16, color: PALETTE.gold, speed: 3, size: 0.1, up: 2.5, ttl: 0.9 }); shakeCamera(0.16, 0.6); }
        }
      },
    });
  }

  // Leak: the knave barges through the gate with a spin and a puff.
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
      if (tower.branch) {
        // a specialization is a bigger moment: a second, magic burst and a thump
        puff(tower.x, 0.9, tower.z, { count: 18, color: PALETTE.magic, speed: 2.2, size: 0.1, up: 2.6, ttl: 1.0 });
        shakeCamera(0.06, 0.25);
      }
    });
    GameState.on('towerSold', ({ tower }) => {
      removeTowerView(tower.id);
      puff(tower.x, 0.2, tower.z, { count: 10, color: PALETTE.path, speed: 1.4, size: 0.11, up: 1.0 });
      puff(tower.x, 0.5, tower.z, { count: 5, color: PALETTE.gold, speed: 1.0, size: 0.08, up: 1.8 });
    });
    GameState.on('projectileHit', ({ projectile: p, x, z, flying }) => {
      const y = flying ? BAT_HEIGHT : 0.45;
      if (p.kind === 'thorn') {
        // the pot bursts: a splat of black pitch and a lick of flame
        puff(x, 0.2, z, { count: 14, color: PALETTE.pitch, speed: 2.2, size: 0.09, up: 0.9, ttl: 0.55 });
        puff(x, 0.25, z, { count: 6, color: PALETTE.ember, speed: 1.4, size: 0.08, up: 1.6, ttl: 0.45 });
      } else if (p.kind === 'wisp') {
        puff(x, y, z, { count: 6, color: PALETTE.frost, speed: 1.2, size: 0.07, up: 0.6, ttl: 0.45 });
      } else if (p.kind === 'boulder') {
        puff(x, 0.2, z, { count: 12, color: PALETTE.path, speed: 2.0, size: 0.11, up: 1.6, ttl: 0.6 });
        puff(x, 0.4, z, { count: 5, color: PALETTE.flowerYellow, speed: 2.6, size: 0.06, up: 1.4, ttl: 0.35 });
        shakeCamera(0.1, 0.3);
      } else if (p.kind === 'bigacorn') {
        puff(x, y, z, { count: 10, color: PALETTE.woodLight, speed: 2.4, size: 0.08, up: 1.8, ttl: 0.55 });
        puff(x, y, z, { count: 8, color: PALETTE.cream, speed: 1.4, size: 0.12, up: 1.0, ttl: 0.7 });
        shakeCamera(0.05, 0.22);
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
    moteScale.value = renderer.getPixelRatio() / unitsPerPixel;
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
      treeParts, deadTreeParts, rockParts, mushroomParts, tuftParts, flowerParts, hayParts, pivotMatrix,
      water, masonry, towerCourses, roofCourses, windowDress, glow, setGlow, bannerGeo, shade,
      worldX, worldZ, cols, rows, border,
      scene, animated,
      level: GameState.currentLevel(),
    };
  }

  // -------- incoming-road markers (multi-road levels only) --------
  // A war-horn post at the head of every road the next wave will use: shown
  // through prep and the first seconds of a wave, flashing when that road's
  // first enemy appears. Single-road levels never build these.
  function buildRouteMarkers() {
    const markers = GameState.routes.map((rt) => {
      const a = rt.points[0], b = rt.points[1];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1, dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
      const x = a.x - dx * 0.9, z = a.z - dz * 0.9;   // just outside the road's mouth, facing in
      const yaw = Math.atan2(dx, dz);
      const g = liveProp([
        P(GEO.cyl, PALETTE.wood, M(0, 0.6, 0, { sx: 0.05, sy: 1.2, sz: 0.05 })),
        P(GEO.box, PALETTE.capRed, M(0.2, 1.02, 0, { sx: 0.36, sy: 0.24, sz: 0.03 }), true, { name: 'flag', live: true }),
        P(GEO.cone, PALETTE.gold, M(0, 1.28, 0, { sx: 0.07, sy: 0.14, sz: 0.07 })),
        // the war horn hanging from the post
        P(GEO.cylTaper, PALETTE.cream, M(-0.13, 0.78, 0.03, { sx: 0.08, sy: 0.3, sz: 0.08, rz: 1.1 })),
        P(GEO.ring, PALETTE.gold, M(0, 0.04, 0, { s: 0.5, rx: Math.PI / 2 }), false, { name: 'ring', live: true, unlit: true }),
        P(GEO.cone, PALETTE.gold, M(0, 0.06, 0.7, { sx: 0.2, sy: 0.34, sz: 0.06, rx: Math.PI / 2 }), true, { name: 'arrow', live: true, unlit: true }),
      ], x, 0, z, { ao: true });
      g.rotation.y = yaw;
      g.name = `route-marker-${rt.id}`;
      g.visible = false;
      const live = {};
      g.traverse((o) => { if (o.name) live[o.name] = o; });
      return { g, live, show: 0, flash: 0, pending: false, hideAt: 0, x, z, dx, dz };
    });
    // during a wave each marker stays up until its own road's first enemy
    // appears (groups can start late), flashes, then fades two seconds later
    GameState.on('waveStarted', (n) => {
      const used = new Set(GameState.routesForWave(n));
      markers.forEach((m, i) => { m.pending = used.has(i); m.hideAt = 0; });
    });
    GameState.on('enemySpawned', (e) => {
      const m = markers[e.route];
      if (!m || !m.pending) return;
      m.pending = false; m.flash = 1; m.hideAt = GameState.state.waveTime + 2;
      puff(m.x, 0.8, m.z, { count: 10, color: PALETTE.gold, speed: 1.4, size: 0.08, up: 1.8, ttl: 0.7 });
    });
    animated.push({
      update(t, dt) {
        const S = GameState.state;
        const playing = S.phase === 'playing';
        const next = new Set(GameState.routesForWave(S.wave + 1));
        markers.forEach((m, i) => {
          const on = playing && (S.waveActive ? (m.pending || S.waveTime < m.hideAt) : next.has(i));
          m.show = Math.max(0, Math.min(1, m.show + (on ? dt * 4 : -dt * 3)));
          m.flash = Math.max(0, m.flash - dt * 1.5);
          m.g.visible = m.show > 0.01;
          if (!m.g.visible) return;
          // pop in with a little overshoot, then bob; the flash kicks it bigger
          const k = m.show, pop = k < 1 ? Math.sin(k * Math.PI * 0.5) * (1 + 0.2 * Math.sin(k * Math.PI)) : 1;
          const s = pop * (1 + 0.25 * m.flash);
          m.g.scale.set(s * (1 - 0.03 * Math.sin(t * 4)), s * (1 + 0.05 * Math.sin(t * 4)), s);
          m.live.flag.rotation.y = Math.sin(t * 6 + i) * 0.5;
          m.live.ring.scale.setScalar(0.5 * (1 + 0.45 * ((t * 1.2 + i * 0.3) % 1)));
          m.live.arrow.position.z = 0.7 + 0.15 * Math.sin(t * 5);
        });
      },
    });
  }

  // -------- init / frame --------
  function init(canvasEl) {
    canvas = canvasEl;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    const vt = levelTheme();
    renderer.setClearColor(vt.backdrop);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 100);

    // Five crisp light bands instead of three: still hand-inked steps, but
    // enough of them to model a rounded form.
    gradientMap = new THREE.DataTexture(new Uint8Array([124, 166, 204, 234, 255]), 5, 1, THREE.LuminanceFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.generateMipmaps = false;
    gradientMap.needsUpdate = true;
    outlineMat = makeOutlineMaterial();
    buildPrimitives();

    scene.add(new THREE.HemisphereLight(vt.sky, vt.bounce, vt.hemi));
    const sun = new THREE.DirectionalLight(0xfff0d8, vt.sun);
    sun.position.set(-6, 10, 7);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(vt.fill, vt.fillIntensity);
    fill.position.set(7, 4, -6);
    scene.add(fill);

    cols = GameState.cols; rows = GameState.rows;
    // Atmospheric depth: the far rows of the map melt gently into the
    // level's backdrop. Camera sits 40 units out; view depth grows ~0.63
    // per unit of -z, so this starts just past the grid's top edge.
    const fogNear = 40 + (rows / 2 - 0.5) * 0.63;
    scene.fog = new THREE.Fog(vt.backdrop, fogNear, fogNear + 7);
    placeCamera();
    buildGround();
    GameState.currentLevel().buildScene(makeKit());
    if (GameState.routes.length > 1) buildRouteMarkers();
    buildGrass();
    buildMotes();
    buildParticles();
    buildSelection();
    flushBatch();
    flushGlow();

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 60));
  }

  function render(t, dt) {
    // ambient set dressing runs on wall-clock time: banners, water, grass and
    // motes keep moving on the title screen and through a pause
    const now = performance.now() / 1000;
    const fxDt = fxLast ? Math.min(0.05, now - fxLast) : 0;
    fxLast = now; fxT += fxDt;
    fxTime.value = fxT;
    for (const a of animated) a.update(fxT, fxDt);
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