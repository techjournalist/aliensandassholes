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
    // bat wing: shoulder on the hinge edge, a scalloped trailing edge, thin solid so the ink outline closes
    const wingShape = (m) => {
      const sh = new THREE.Shape();
      const pt = (x, z) => [m * x, -z];
      sh.moveTo(...pt(-0.5, 0.3));
      sh.quadraticCurveTo(...pt(-0.1, 0.5), ...pt(0.5, 0.12));
      sh.quadraticCurveTo(...pt(0.36, -0.1), ...pt(0.3, -0.34));
      sh.quadraticCurveTo(...pt(0.16, -0.16), ...pt(0.02, -0.4));
      sh.quadraticCurveTo(...pt(-0.1, -0.2), ...pt(-0.26, -0.36));
      sh.quadraticCurveTo(...pt(-0.36, -0.2), ...pt(-0.5, -0.12));
      sh.lineTo(...pt(-0.5, 0.3));
      const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, curveSegments: 5 });
      g.rotateX(-Math.PI / 2); g.translate(0, -0.5, 0);   // y thickness centred, shape lies in XZ
      return g;
    };
    GEO.wingL = wingShape(1);
    GEO.wingR = wingShape(-1);
    GEO.circle = new THREE.CircleGeometry(1, 18);
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

  // Terrain height: the play grid stays perfectly flat (picking and gameplay
  // never see it); the forest rim outside it steps up into low hills, so the
  // board reads as a valley. Everything placed outside the grid follows it.
  function rimHeight(c, r) {
    if (GameState.inGrid(c, r)) return 0;
    if (c === GameState.currentLevel().chokepoint.streamCol) return 0;
    const dc = Math.max(-c, c - (cols - 1), 0), dr = Math.max(-r, r - (rows - 1), 0);
    const d = Math.max(dc, dr);
    const base = d <= 1 ? 0.1 : d === 2 ? 0.22 : 0.32;
    return base + (RendererFX.fbm(c * 0.45 + 11.3, r * 0.45 + 4.7) - 0.4) * 0.16;
  }
  function groundYAt(x, z) {
    const c = Math.round(x + cols / 2 - 0.5), r = Math.round(z + rows / 2 - 0.5);
    return Math.max(0, rimHeight(c, r));
  }

  // Static batcher: props that never move are merged per material into a
  // handful of draw calls (one per color, one for every outline).
  const batch = { groups: new Map(), outlines: [], decals: [] };
  function batchPart(part, worldMatrix) {
    if (worldMatrix) {
      const e = worldMatrix.elements;
      worldMatrix = worldMatrix.clone();
      worldMatrix.elements[13] += groundYAt(e[12], e[14]);
    }
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
    // shadow falls away from the sun (upper left): pushed and stretched along that line
    batch.decals.push(GEO.shadowDisc.clone().applyMatrix4(M(x + radius * 0.3, groundYAt(x, z) + 0.012, z - radius * 0.34,
      { sx: radius * 0.95, sy: 1, sz: radius * 1.4, ry: Math.atan2(0.3, -0.34) })));
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
    g.position.set(x, y + groundYAt(x, z), z);
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

  // Three species keep a grove from reading as one tree repeated: a round
  // broadleaf, a stacked-cone conifer and a tall slender poplar. The last two
  // are cheaper than the broadleaf, so variety costs nothing in triangles.
  // They only use the three meadow greens, so each level's retint still works.
  function treeParts(rng) {
    const kind = rng();
    if (kind < 0.26) return coniferParts(rng);
    if (kind < 0.44) return poplarParts(rng);
    return broadleafParts(rng);
  }
  function rootFlares(parts, rng, n, ry, len) {
    const ra = rng() * 6;
    for (let i = 0; i < n; i++) {
      const a = ra + i * (Math.PI * 2 / n);
      parts.push(P(GEO.cone, PALETTE.wood, M(Math.cos(a) * 0.1, 0.05, Math.sin(a) * 0.1,
        { sx: 0.06, sy: len, sz: 0.05, rz: -Math.cos(a) * 1.25, rx: Math.sin(a) * 1.25 }), false));
    }
  }
  function coniferParts(rng) {
    const h = 0.95 + rng() * 0.6, r = 0.3 + rng() * 0.14;
    const parts = [P(GEO.cylTaper, PALETTE.wood, M(0, 0.18, 0, { sx: 0.09, sy: 0.36, sz: 0.09 }))];
    rootFlares(parts, rng, 3, 0.05, 0.18);
    const tiers = 3, cols = [PALETTE.meadowDark, PALETTE.meadow, PALETTE.meadowLight];
    for (let i = 0; i < tiers; i++) {
      const k = i / (tiers - 1), tr = r * (1.15 - k * 0.5), th = h * (0.42 - k * 0.06);
      parts.push(P(GEO.cone, cols[i], M((rng() - 0.5) * 0.03, 0.3 + k * h * 0.34 + th / 2, (rng() - 0.5) * 0.03, { sx: tr, sy: th, sz: tr, ry: rng() * 6 })));
    }
    if (rng() < 0.3) parts.push(P(GEO.bead, PALETTE.capRed, M(0.02, 0.3 + h * 0.34 + h * 0.4, 0, { s: 0.05 }), false));
    return { parts, radius: r * 0.85 };
  }
  function poplarParts(rng) {
    const h = 1.0 + rng() * 0.55, r = 0.24 + rng() * 0.1;
    const parts = [P(GEO.cylTaper, PALETTE.woodLight, M(0, 0.3, 0, { sx: 0.075, sy: 0.6, sz: 0.075 }))];
    rootFlares(parts, rng, 3, 0.05, 0.16);
    parts.push(P(GEO.sphereMid, PALETTE.meadowDark, M(0, 0.55 + h * 0.4, 0, { sx: r, sy: h * 0.45, sz: r })));
    parts.push(P(GEO.sphereLo, PALETTE.meadow, M(r * 0.3, 0.7 + h * 0.5, r * 0.15, { sx: r * 0.7, sy: h * 0.3, sz: r * 0.65 })));
    parts.push(P(GEO.sphereLo, PALETTE.meadowLight, M(-r * 0.3, 0.85 + h * 0.5, -r * 0.05, { sx: r * 0.55, sy: h * 0.24, sz: r * 0.5 })));
    return { parts, radius: r * 0.9 };
  }
  function broadleafParts(rng) {
    const h = 0.7 + rng() * 0.5, r = 0.42 + rng() * 0.28;
    const top = h * 0.62;
    const parts = [
      P(GEO.cylTaper, PALETTE.wood, M(0, h * 0.35, 0, { sx: 0.11, sy: h * 0.7, sz: 0.11 })),
    ];
    // root flares splay out where the trunk meets the ground
    rootFlares(parts, rng, 3 + Math.floor(rng() * 2), 0.05, 0.22);
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
    // a shelf fungus glowing faintly on the trunk
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
    parts.push(P(GEO.sphereLo, hollow ? PALETTE.spore : PALETTE.moss, M(-s * 0.15, s * 1.12, 0, { sx: s * 0.85, sy: s * 0.22, sz: s * 0.7, ry }), false));
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
    const vt = levelTheme();
    const topColor = new THREE.Color(), sideColor = new THREE.Color();
    const rowsMin = -border, rowsMax = rows + border, colsMin = -border, colsMax = cols + border;
    for (let r = rowsMin; r < rowsMax; r++) {
      for (let c = colsMin; c < colsMax; c++) {
        const inGrid = GameState.inGrid(c, r);
        const kind = inGrid ? GameState.cellKind(c, r) : (c === GameState.currentLevel().chokepoint.streamCol ? 'stream' : 'ground');
        const h = GameState.zoneFalloff(c, r);
        let top, side, height = tileHeight, yTop = 0;
        if (!inGrid && kind === 'ground') { yTop = rimHeight(c, r); height = tileHeight + yTop; }
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
      for (const [shape, col, y] of [[plotRim, rim, 0.058], [plotFill, fill, 0.06]]) {
        const g = shape.clone().applyMatrix4(M(worldX(c), y, worldZ(r)));
        const colors = new Float32Array(g.attributes.position.count * 3);
        for (let i = 0; i < g.attributes.position.count; i++) { colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b; }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        markers.push(g);
      }
    }
    buildPlinths();
    buildGroundPatches(vt);
    const markerMesh = new THREE.Mesh(mergeGeoms(markers), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false }));
    markerMesh.name = 'buildableMarkers';
    markerMesh.matrixAutoUpdate = false;
    scene.add(markerMesh);
    animated.push({ update(t) { markerMesh.material.opacity = 0.42 + Math.sin(t * 1.6) * 0.1; } });
  }

  // Each buildable cell stands on a low stone plinth: a real step up from the
  // meadow, so the plots read as places with depth. One merged mesh.
  const PLINTH_H = 0.05;
  function buildPlinths() {
    const shape = new THREE.Shape(), w = 0.86, h = w / 2, rad = 0.14;
    shape.moveTo(-h + rad, -h); shape.lineTo(h - rad, -h); shape.quadraticCurveTo(h, -h, h, -h + rad);
    shape.lineTo(h, h - rad); shape.quadraticCurveTo(h, h, h - rad, h);
    shape.lineTo(-h + rad, h); shape.quadraticCurveTo(-h, h, -h, h - rad);
    shape.lineTo(-h, -h + rad); shape.quadraticCurveTo(-h, -h, -h + rad, -h);
    const base = new THREE.ExtrudeGeometry(shape, { depth: PLINTH_H, bevelEnabled: false, curveSegments: 2 });
    base.rotateX(-Math.PI / 2);
    const geos = [], top = new THREE.Color(), side = new THREE.Color();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!GameState.isBuildable(c, r)) continue;
      const hz = GameState.zoneFalloff(c, r);
      top.copy(lerpColor(PALETTE.meadow, PALETTE.cobble, 0.4)).lerp(new THREE.Color(PALETTE.hollowGround), hz);
      side.copy(lerpColor(PALETTE.earth, PALETTE.hollowEarth, hz));
      const g = base.clone().applyMatrix4(M(worldX(c), 0, worldZ(r)));
      const n = g.attributes.normal, colors = new Float32Array(n.count * 3);
      for (let i = 0; i < n.count; i++) {
        const col = n.getY(i) > 0.5 ? top : side;
        colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      g.deleteAttribute('uv');
      geos.push(g);
    }
    if (!geos.length) return;
    const mesh = new THREE.Mesh(mergeGeoms(geos), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap, vertexColors: true }));
    mesh.name = 'plinths';
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
  }

  // Flat patches of moss, bare earth and clover on open meadow, so the ground
  // between the roads has hand-painted variety. Flat, merged, one draw call.
  function buildGroundPatches(vt) {
    const rng = srand(919), geos = [], col = new THREE.Color();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (GameState.cellKind(c, r) !== 'ground' || GameState.isBuildable(c, r)) continue;
      const hz = GameState.zoneFalloff(c, r);
      const n = rng() < 0.55 ? 1 : 0;
      for (let i = 0; i < n; i++) {
        const roll = rng();
        if (roll < 0.45) col.copy(lerpColor(vt.meadowDark, 0x000000, 0.12));          // deep moss
        else if (roll < 0.75) col.copy(lerpColor(vt.meadow, PALETTE.path, 0.4));        // bare earth
        else col.copy(lerpColor(vt.meadow, PALETTE.meadowLight, 0.6));                  // clover
        col.lerp(new THREE.Color(PALETTE.hollowGround), hz);
        const g = GEO.circle.clone().applyMatrix4(M(worldX(c) + (rng() - 0.5) * 0.6, 0.008 + rng() * 0.004, worldZ(r) + (rng() - 0.5) * 0.6,
          { sx: 0.16 + rng() * 0.2, sy: 1, sz: 0.1 + rng() * 0.14, ry: rng() * 3.14 }));
        const colors = new Float32Array(g.attributes.position.count * 3);
        for (let k = 0; k < g.attributes.position.count; k++) { colors[k * 3] = col.r; colors[k * 3 + 1] = col.g; colors[k * 3 + 2] = col.b; }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        g.deleteAttribute('uv');
        geos.push(g);
      }
    }
    // worn road: dark trampled mud and the odd puddle on the dirt stretches
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (GameState.cellKind(c, r) !== 'path' || GameState.isCobble(c, r)) continue;
      if (rng() > 0.5) continue;
      const hz = GameState.zoneFalloff(c, r), puddle = rng() < 0.22;
      if (puddle) col.copy(lerpColor(PALETTE.streamBed, PALETTE.path, 0.35)); else col.copy(lerpColor(PALETTE.path, PALETTE.earth, 0.42));
      col.lerp(new THREE.Color(PALETTE.hollowPath), hz * 0.8);
      const g = GEO.circle.clone().applyMatrix4(M(worldX(c) + (rng() - 0.5) * 0.4, 0.011, worldZ(r) + (rng() - 0.5) * 0.4,
        { sx: puddle ? 0.2 : 0.14 + rng() * 0.16, sy: 1, sz: puddle ? 0.12 : 0.08 + rng() * 0.1, ry: rng() * 3.14 }));
      const colors = new Float32Array(g.attributes.position.count * 3);
      for (let k = 0; k < g.attributes.position.count; k++) { colors[k * 3] = col.r; colors[k * 3 + 1] = col.g; colors[k * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      g.deleteAttribute('uv');
      geos.push(g);
    }
    if (!geos.length) return;
    const mesh = new THREE.Mesh(mergeGeoms(geos), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap, vertexColors: true }));
    mesh.name = 'groundPatches';
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
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
      dummy.position.set(b.x, groundYAt(b.x, b.z), b.z);
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

  // Ambient motes per level mood: fireflies over healthy meadow, spores
  // rising out of corruption, plus whatever the level's theme adds
  // (leaves, dust, embers).
  function buildMotes() {
    const vt = levelTheme();
    const rng = srand(77);
    const counts = Object.assign({ fireflies: 26, spores: 28 }, vt.motes);
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
  // recolored) the Cairnwatch's corrupted ooze.
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
      // secondary detail: eyes with a glint, rosy cheeks, a buckled belt,
      // a leaf tucked in the hat brim and a few stones set round the pad
      P(GEO.bead, PALETTE.outline, M(0.075, 0.77, 0.195, { s: 0.03 }), false),
      P(GEO.bead, PALETTE.outline, M(-0.075, 0.77, 0.195, { s: 0.03 }), false),
      P(GEO.bead, PALETTE.cream, M(0.083, 0.782, 0.218, { s: 0.011 }), false),
      P(GEO.bead, PALETTE.cream, M(-0.067, 0.782, 0.218, { s: 0.011 }), false),
      P(GEO.sphereLo, 0xf0a98a, M(0.13, 0.69, 0.15, { sx: 0.04, sy: 0.025, sz: 0.02 }), false),
      P(GEO.sphereLo, 0xf0a98a, M(-0.13, 0.69, 0.15, { sx: 0.04, sy: 0.025, sz: 0.02 }), false),
      P(GEO.cyl, PALETTE.acornCap, M(0, 0.33, 0, { sx: 0.245, sy: 0.045, sz: 0.225 }), false),
      P(GEO.box, PALETTE.gold, M(0, 0.33, 0.225, { sx: 0.07, sy: 0.06, sz: 0.02 }), false),
      P(GEO.sphereLo, PALETTE.meadowLight, M(-0.2, 0.9, 0.08, { sx: 0.09, sy: 0.02, sz: 0.04, ry: 0.5, rz: 0.3 }), false),
      P(GEO.rock, PALETTE.cobble, M(0.3, 0.12, -0.18, { s: 0.06 }), false),
      P(GEO.rock, PALETTE.stone, M(-0.34, 0.12, 0.06, { s: 0.05 }), false),
      P(GEO.rock, PALETTE.cobble, M(0.06, 0.12, 0.35, { s: 0.045 }), false),
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
      P(GEO.bead, PALETTE.outline, M(0.1, 0.54, 0.245, { s: 0.025 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.outline, M(-0.08, 0.54, 0.245, { s: 0.025 }), false, { unlit: true }),
      P(GEO.cone, gd, M(0, 0.47, 0.3, { sx: 0.05, sy: 0.18, sz: 0.05, rx: Math.PI / 2 }), true, { name: 'nose' }),
      P(GEO.box, PALETTE.cream, M(0.05, 0.4, 0.21, { sx: 0.04, sy: 0.05, sz: 0.02 }), false, { unlit: true }),
      P(GEO.sphereLo, g, M(0.2, 0.26, 0.06, { s: 0.06 }), true, { name: 'armL' }),
      P(GEO.sphereLo, g, M(-0.2, 0.26, 0.06, { s: 0.06 }), true, { name: 'armR' }),
      P(GEO.cyl, PALETTE.wood, pivotMatrix(-0.22, 0.26, 0.06, 0.5, 0, 0.35, 0, 0.14, 0, 0.03, 0.3, 0.03), true, { name: 'club' }),
      P(GEO.sphereLo, PALETTE.woodLight, pivotMatrix(-0.22, 0.26, 0.06, 0.5, 0, 0.35, 0, 0.3, 0, 0.06, 0.06, 0.06), true, { name: 'clubHead' }),
      // eye glints, a buckle and loincloth, a leather wrap on the club grip
      P(GEO.bead, PALETTE.cream, M(0.108, 0.556, 0.262, { s: 0.009 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.cream, M(-0.072, 0.556, 0.262, { s: 0.009 }), false, { unlit: true }),
      P(GEO.box, PALETTE.gold, M(0, 0.16, 0.195, { sx: 0.06, sy: 0.05, sz: 0.02 }), false),
      P(GEO.box, PALETTE.capBrown, M(0.02, 0.1, 0.17, { sx: 0.12, sy: 0.09, sz: 0.02, rz: 0.08 }), false),
      P(GEO.cyl, PALETTE.capBrown, pivotMatrix(-0.22, 0.26, 0.06, 0.5, 0, 0.35, 0, 0.08, 0, 0.038, 0.06, 0.038), false),
      P(GEO.cone, PALETTE.cream, pivotMatrix(-0.22, 0.26, 0.06, 0.5, 0, 0.35, 0.05, 0.33, 0, 0.018, 0.05, 0.018), false),
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
      // eyes glinting under the hood, a rope belt, leaves on the hood rim
      P(GEO.bead, PALETTE.outline, M(0.06, 0.82, 0.2, { s: 0.024 }), false),
      P(GEO.bead, PALETTE.outline, M(-0.06, 0.82, 0.2, { s: 0.024 }), false),
      P(GEO.bead, PALETTE.cream, M(0.066, 0.83, 0.219, { s: 0.009 }), false),
      P(GEO.bead, PALETTE.cream, M(-0.054, 0.83, 0.219, { s: 0.009 }), false),
      P(GEO.ring, PALETTE.woodLight, M(0, 0.42, 0, { sx: 0.19, sy: 0.18, sz: 0.19, rx: Math.PI / 2 }), false),
      P(GEO.bead, PALETTE.woodLight, M(0.06, 0.4, 0.17, { s: 0.03 }), false),
      P(GEO.cyl, PALETTE.woodLight, M(0.07, 0.33, 0.17, { sx: 0.012, sy: 0.12, sz: 0.012, rz: 0.2 }), false),
      P(GEO.sphereLo, PALETTE.meadowLight, M(0.2, 0.9, 0.1, { sx: 0.07, sy: 0.02, sz: 0.04, ry: -0.6 }), false),
      P(GEO.sphereLo, PALETTE.meadow, M(-0.19, 0.92, 0.1, { sx: 0.06, sy: 0.02, sz: 0.035, ry: 0.6 }), false),
      P(GEO.sphereLo, PALETTE.meadowLight, M(-0.05, 0.93, 0.21, { sx: 0.05, sy: 0.018, sz: 0.03 }), false),
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
      // antlers
      P(GEO.bead, PALETTE.outline, M(0.06, 0.82, 0.19, { s: 0.024 }), false),
      P(GEO.bead, PALETTE.outline, M(-0.06, 0.82, 0.19, { s: 0.024 }), false),
      P(GEO.bead, PALETTE.cream, M(0.066, 0.83, 0.209, { s: 0.009 }), false),
      P(GEO.bead, PALETTE.cream, M(-0.054, 0.83, 0.209, { s: 0.009 }), false),
      // a moss sash, leaves in the moss hair, frost crystals on the pad
      P(GEO.ring, PALETTE.moss, M(0, 0.4, 0, { sx: 0.18, sy: 0.17, sz: 0.18, rx: Math.PI / 2 }), false),
      P(GEO.sphereLo, PALETTE.moss, M(-0.08, 0.38, 0.15, { sx: 0.04, sy: 0.06, sz: 0.02 }), false),
      P(GEO.sphereLo, PALETTE.meadowLight, M(0.12, 0.95, 0.04, { sx: 0.06, sy: 0.018, sz: 0.035, ry: -0.5 }), false),
      P(GEO.bead, PALETTE.flowerPink, M(-0.1, 0.96, 0.08, { s: 0.028 }), false),
      P(GEO.cone, PALETTE.frost, M(-0.26, 0.2, 0.14, { sx: 0.035, sy: 0.12, sz: 0.035, rz: 0.3 }), false),
      P(GEO.cone, PALETTE.frost, M(-0.2, 0.18, 0.22, { sx: 0.025, sy: 0.08, sz: 0.025, rx: 0.4 }), false),
      P(GEO.cone, PALETTE.frost, M(0.18, 0.18, -0.24, { sx: 0.03, sy: 0.1, sz: 0.03, rx: -0.3 }), false),
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
      P(GEO.bead, PALETTE.gold, M(0.05, 0.84, 0.15, { s: 0.03 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.gold, M(-0.05, 0.84, 0.15, { s: 0.03 }), false, { unlit: true }),
      P(GEO.cyl, bark, M(0.34, 0.5, 0.08, { sx: 0.08, sy: 0.4, sz: 0.08, rz: -0.35 }), true, { name: 'armL', live: true }),
      P(GEO.cyl, bark, M(-0.34, 0.5, 0.08, { sx: 0.08, sy: 0.4, sz: 0.08, rz: 0.35 }), true, { name: 'armR', live: true }),
      P(GEO.rock, stone, M(0.42, 0.22, 0.14, { s: 0.17 }), true, { name: 'fistL', live: true }),
      P(GEO.rock, stone, M(-0.42, 0.22, 0.14, { s: 0.17 }), true, { name: 'fistR', live: true }),
      P(GEO.cone, PALETTE.meadowLight, M(0.1, 0.78, -0.12, { sx: 0.04, sy: 0.14, sz: 0.04, rz: -0.3 }), false),
      // gold seams in the stone, more moss, and a small flower growing on its head
      P(GEO.box, PALETTE.gold, M(0.1, 0.38, 0.27, { sx: 0.1, sy: 0.018, sz: 0.02, rz: 0.5 }), false),
      P(GEO.box, PALETTE.gold, M(-0.12, 0.3, 0.26, { sx: 0.08, sy: 0.018, sz: 0.02, rz: -0.4 }), false),
      P(GEO.sphereLo, PALETTE.moss, M(-0.18, 0.5, 0.18, { sx: 0.1, sy: 0.05, sz: 0.08 }), false),
      P(GEO.sphereLo, PALETTE.meadowLight, M(0.2, 0.22, 0.2, { sx: 0.08, sy: 0.04, sz: 0.06 }), false),
      P(GEO.cyl, PALETTE.meadowDark, M(-0.04, 0.95, 0.06, { sx: 0.012, sy: 0.08, sz: 0.012 }), false),
      P(GEO.sphereLo, PALETTE.flowerYellow, M(-0.04, 1.0, 0.06, { sx: 0.035, sy: 0.02, sz: 0.035 }), false),
      P(GEO.box, PALETTE.stoneDark, M(0, 0.84, 0.148, { sx: 0.13, sy: 0.02, sz: 0.01 }), false),
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
      // wheel hubs and spokes, iron straps and rivets on the frame
      P(GEO.cyl, PALETTE.stoneDark, M(0.34, 0.16, 0, { sx: 0.05, sy: 0.04, sz: 0.05, rz: Math.PI / 2 }), false),
      P(GEO.cyl, PALETTE.stoneDark, M(-0.34, 0.16, 0, { sx: 0.05, sy: 0.04, sz: 0.05, rz: Math.PI / 2 }), false),
      P(GEO.box, PALETTE.wood, M(0.335, 0.16, 0, { sx: 0.01, sy: 0.3, sz: 0.03 }), false),
      P(GEO.box, PALETTE.wood, M(0.335, 0.16, 0, { sx: 0.01, sy: 0.03, sz: 0.3 }), false),
      P(GEO.box, PALETTE.wood, M(-0.335, 0.16, 0, { sx: 0.01, sy: 0.3, sz: 0.03 }), false),
      P(GEO.box, PALETTE.wood, M(-0.335, 0.16, 0, { sx: 0.01, sy: 0.03, sz: 0.3 }), false),
      P(GEO.box, PALETTE.stoneDark, M(0, 0.165, 0.18, { sx: 0.52, sy: 0.11, sz: 0.04 }), false),
      P(GEO.box, PALETTE.stoneDark, M(0, 0.165, -0.18, { sx: 0.52, sy: 0.11, sz: 0.04 }), false),
      P(GEO.bead, PALETTE.gold, M(0.2, 0.17, 0.205, { s: 0.018 }), false),
      P(GEO.bead, PALETTE.gold, M(-0.2, 0.17, 0.205, { s: 0.018 }), false),
      P(GEO.bead, PALETTE.gold, M(0, 0.17, 0.205, { s: 0.018 }), false),
      P(GEO.dome, PALETTE.acornCap, M(-0.25, 0.51, 0.26, { sx: 0.09, sy: 0.05, sz: 0.09 }), false),
    ];
  }

  // Tier dressing: what an upgraded tower wears so its tier reads at a glance.
  // Specialization dressing: a tier-3 tower wears its branch so the choice
  // reads by shape, not just color. All merged into the tower's mesh.
  const ring5 = (n, r, y, fn) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return fn(Math.cos(a) * r, y, Math.sin(a) * r, a, i); });
  const BRANCH_PARTS = {
    marksman: () => [
      P(GEO.sphereLo, PALETTE.gold, M(-0.21, 1.08, -0.04, { sx: 0.045, sy: 0.22, sz: 0.05, rz: 0.4 })),
      P(GEO.sphereLo, PALETTE.capRed, M(-0.27, 1.2, -0.05, { sx: 0.03, sy: 0.12, sz: 0.035, rz: 0.6 }), false),
      P(GEO.ring, PALETTE.gold, M(0.075, 0.77, 0.212, { s: 0.036 }), false),
      P(GEO.cyl, PALETTE.wood, M(-0.12, 0.5, -0.2, { sx: 0.06, sy: 0.34, sz: 0.06, rz: 0.25 })),
      P(GEO.cone, PALETTE.cream, M(-0.17, 0.72, -0.2, { sx: 0.03, sy: 0.1, sz: 0.012, rz: 0.25 }), false),
      P(GEO.cone, PALETTE.cream, M(-0.12, 0.73, -0.24, { sx: 0.03, sy: 0.1, sz: 0.012, rz: 0.2 }), false),
    ],
    bloom: () => [
      P(GEO.cyl, PALETTE.wood, M(-0.34, 0.66, 0.12, { sx: 0.045, sy: 0.42, sz: 0.045, rz: 0.12 })),
      P(GEO.cyl, PALETTE.wood, M(-0.24, 1.0, 0.12, { sx: 0.035, sy: 0.34, sz: 0.035, rz: -0.6 })),
      P(GEO.cyl, PALETTE.wood, M(-0.48, 1.0, 0.12, { sx: 0.035, sy: 0.34, sz: 0.035, rz: 0.6 })),
      P(GEO.box, PALETTE.outline, M(-0.36, 1.13, 0.12, { sx: 0.3, sy: 0.025, sz: 0.025 }), false),
      ...ring5(6, 0.24, 0.9, (x, y, z, a, i) => P(GEO.bead, i % 2 ? PALETTE.flowerYellow : PALETTE.flowerPink, M(x, y, z, { s: 0.045 }), false)),
    ],
    thicket: () => ring5(7, 0.36, 0.2, (x, y, z, a) => P(GEO.cone, PALETTE.cloakDark, M(x, y + 0.08, z, { sx: 0.05, sy: 0.3, sz: 0.05, rz: -Math.cos(a) * 0.35, rx: Math.sin(a) * 0.35 }))),
    briarstorm: () => [
      P(GEO.cone, PALETTE.magic, M(0, 1.42, 0.03, { sx: 0.07, sy: 0.16, sz: 0.07 })),
      P(GEO.cone, PALETTE.magic, M(0, 1.3, 0.03, { sx: 0.07, sy: 0.1, sz: 0.07, rx: Math.PI }), false),
      ...ring5(3, 0.25, 0.88, (x, y, z, a) => P(GEO.cone, PALETTE.magic, M(x, y, z, { sx: 0.03, sy: 0.14, sz: 0.03, rz: -Math.cos(a) * 1.2, rx: Math.sin(a) * 1.2 }), false)),
    ],
    hoarfrost: () => [
      P(GEO.torus, PALETTE.frost, M(0, 0.1, 0, { s: 0.46, rx: Math.PI / 2 }), false),
      ...ring5(6, 0.44, 0.14, (x, y, z, a) => P(GEO.cone, PALETTE.frost, M(x, y, z, { sx: 0.04, sy: 0.18, sz: 0.04, rz: -Math.cos(a) * 0.4, rx: Math.sin(a) * 0.4 }))),
    ],
    seer: () => [
      ...ring5(5, 0.1, 1.02, (x, y, z, a) => P(GEO.cone, PALETTE.frost, M(x, y, z, { sx: 0.03, sy: 0.22, sz: 0.03, rz: -Math.cos(a) * 0.25, rx: Math.sin(a) * 0.25 }))),
      P(GEO.cyl, PALETTE.frostRobe, M(-0.3, 0.55, 0.1, { sx: 0.025, sy: 0.9, sz: 0.025 })),
      P(GEO.cone, PALETTE.frost, M(-0.3, 1.08, 0.1, { sx: 0.05, sy: 0.18, sz: 0.05 })),
    ],
    earthshaker: () => [
      ...ring5(6, 0.46, 0.06, (x, y, z, a, i) => P(GEO.rock, i % 2 ? PALETTE.stoneDark : PALETTE.stone, M(x, y, z, { sx: 0.1, sy: 0.14 + (i % 3) * 0.03, sz: 0.1, ry: a }))),
      P(GEO.cone, PALETTE.stoneDark, M(0.12, 0.8, -0.22, { sx: 0.06, sy: 0.22, sz: 0.06, rx: -0.4 })),
      P(GEO.cone, PALETTE.stoneDark, M(-0.12, 0.8, -0.22, { sx: 0.06, sy: 0.22, sz: 0.06, rx: -0.4 })),
    ],
    mountainheart: () => [
      P(GEO.cone, PALETTE.gold, M(0, 0.99, 0.06, { sx: 0.035, sy: 0.12, sz: 0.035 })),
      P(GEO.cone, PALETTE.gold, M(0.07, 0.96, 0.06, { sx: 0.03, sy: 0.09, sz: 0.03, rz: -0.3 })),
      P(GEO.cone, PALETTE.gold, M(-0.07, 0.96, 0.06, { sx: 0.03, sy: 0.09, sz: 0.03, rz: 0.3 })),
      P(GEO.cone, PALETTE.magic, M(0.1, 0.72, -0.22, { sx: 0.06, sy: 0.24, sz: 0.06, rx: -0.3 })),
      P(GEO.cone, PALETTE.magic, M(-0.08, 0.7, -0.24, { sx: 0.05, sy: 0.18, sz: 0.05, rx: -0.4 })),
    ],
    oakfall: () => [
      P(GEO.sphereLo, PALETTE.acorn, M(0.32, 0.26, 0.2, { sx: 0.1, sy: 0.12, sz: 0.1 })),
      P(GEO.sphereLo, PALETTE.acorn, M(0.3, 0.26, 0.36, { sx: 0.1, sy: 0.12, sz: 0.1 })),
      P(GEO.sphereLo, PALETTE.acorn, M(0.44, 0.26, 0.28, { sx: 0.1, sy: 0.12, sz: 0.1 })),
      P(GEO.sphereLo, PALETTE.acorn, M(0.35, 0.44, 0.28, { sx: 0.11, sy: 0.13, sz: 0.11 })),
      P(GEO.dome, PALETTE.acornCap, M(0.35, 0.53, 0.28, { sx: 0.11, sy: 0.06, sz: 0.11 }), false),
    ],
    squirrel: () => [
      P(GEO.cyl, PALETTE.woodLight, M(0.17, 0.44, 0.08, { sx: 0.05, sy: 0.3, sz: 0.05, rx: -0.85 })),
      P(GEO.cyl, PALETTE.woodLight, M(-0.17, 0.44, 0.08, { sx: 0.05, sy: 0.3, sz: 0.05, rx: -0.85 })),
      // the squirrel gunner, perched on the frame with its tail up
      P(GEO.sphereLo, PALETTE.capBrown, M(-0.2, 0.42, -0.16, { sx: 0.11, sy: 0.14, sz: 0.1 })),
      P(GEO.sphereLo, PALETTE.cream, M(-0.2, 0.4, -0.07, { sx: 0.06, sy: 0.09, sz: 0.03 }), false),
      P(GEO.sphereLo, PALETTE.capBrown, M(-0.2, 0.61, -0.1, { s: 0.09 })),
      P(GEO.cone, PALETTE.capBrown, M(-0.25, 0.71, -0.1, { sx: 0.03, sy: 0.07, sz: 0.025 })),
      P(GEO.cone, PALETTE.capBrown, M(-0.15, 0.71, -0.1, { sx: 0.03, sy: 0.07, sz: 0.025 })),
      P(GEO.bead, PALETTE.outline, M(-0.17, 0.63, -0.02, { s: 0.018 }), false),
      P(GEO.bead, PALETTE.outline, M(-0.23, 0.63, -0.02, { s: 0.018 }), false),
      P(GEO.sphereLo, PALETTE.capBrown, M(-0.26, 0.62, -0.3, { sx: 0.1, sy: 0.24, sz: 0.09, rx: 0.35 })),
      P(GEO.sphereLo, PALETTE.woodLight, M(-0.26, 0.8, -0.26, { sx: 0.08, sy: 0.08, sz: 0.07 })),
    ],
  };
  const BRANCH_PENNANT = { marksman: PALETTE.capRed, bloom: PALETTE.flowerPink, thicket: PALETTE.cloak, briarstorm: PALETTE.magic,
    hoarfrost: PALETTE.frost, seer: PALETTE.cream, earthshaker: PALETTE.stoneDark, mountainheart: PALETTE.gold, oakfall: PALETTE.acorn, squirrel: PALETTE.woodLight };
  // Tier-2 dressing, one per tower: each upgrade changes the silhouette in
  // that character's own way, so the step from tier 1 to 2 reads at a glance.
  const TIER2_PARTS = {
    // a feathered cap, a bandolier of acorns and a stack of spare ammo
    slinger: () => [
      P(GEO.cone, PALETTE.cream, M(-0.12, 1.32, -0.06, { sx: 0.04, sy: 0.3, sz: 0.03, rz: 0.7, rx: -0.2 }), true),
      P(GEO.cone, PALETTE.flowerPink, M(-0.16, 1.3, -0.06, { sx: 0.03, sy: 0.2, sz: 0.02, rz: 0.9 }), false),
      P(GEO.box, PALETTE.capBrown, M(0, 0.5, 0.15, { sx: 0.5, sy: 0.05, sz: 0.03, rz: 0.75 }), false),
      P(GEO.bead, PALETTE.gold, M(-0.1, 0.4, 0.17, { s: 0.03 }), false),
      P(GEO.bead, PALETTE.gold, M(0.1, 0.6, 0.17, { s: 0.03 }), false),
      P(GEO.sphereLo, PALETTE.acorn, M(0.28, 0.2, 0.3, { sx: 0.07, sy: 0.085, sz: 0.07 }), true),
      P(GEO.sphereLo, PALETTE.acorn, M(0.38, 0.2, 0.22, { sx: 0.07, sy: 0.085, sz: 0.07 }), true),
      P(GEO.sphereLo, PALETTE.acorn, M(0.32, 0.32, 0.26, { sx: 0.07, sy: 0.085, sz: 0.07 }), true),
    ],
    // a gold-trimmed hem, glowing thorn crystals round the pad and a taller hood tip
    warden: () => [
      P(GEO.torus, PALETTE.gold, M(0, 0.2, 0, { sx: 0.3, sy: 0.3, sz: 0.3, rx: Math.PI / 2 }), false),
      ...ring5(4, 0.42, 0.24, (x, y, z, a) => P(GEO.cone, PALETTE.magic, M(x, y, z, { sx: 0.06, sy: 0.24, sz: 0.06, rz: -Math.cos(a) * 0.3, rx: Math.sin(a) * 0.3 }), true)),
      P(GEO.cone, PALETTE.cloakDark, M(0, 1.42, -0.06, { sx: 0.1, sy: 0.3, sz: 0.1, rx: 0.5 }), true),
      P(GEO.bead, PALETTE.gold, M(0, 1.6, -0.2, { s: 0.04 }), false, { unlit: true }),
    ],
    // a taller antler crown hung with frost, and a longer moss cloak
    druid: () => [
      P(GEO.cyl, PALETTE.wood, M(0.06, 1.38, -0.02, { sx: 0.02, sy: 0.3, sz: 0.02, rz: -0.15 }), true),
      P(GEO.cyl, PALETTE.wood, M(-0.06, 1.38, -0.02, { sx: 0.02, sy: 0.3, sz: 0.02, rz: 0.15 }), true),
      P(GEO.cone, PALETTE.frost, M(0.1, 1.22, 0.0, { sx: 0.03, sy: 0.12, sz: 0.03, rz: Math.PI }), false, { unlit: true }),
      P(GEO.cone, PALETTE.frost, M(-0.1, 1.22, 0.0, { sx: 0.03, sy: 0.12, sz: 0.03, rz: Math.PI }), false, { unlit: true }),
      P(GEO.cone, PALETTE.moss, M(0, 0.4, -0.16, { sx: 0.3, sy: 0.62, sz: 0.08 }), true),
      ...ring5(5, 0.34, 0.2, (x, y, z) => P(GEO.cone, PALETTE.frost, M(x, y, z, { sx: 0.04, sy: 0.18, sz: 0.04 }), false)),
    ],
    // shoulder spikes, a gold rune on the chest and a bushy moss beard
    golem: () => [
      P(GEO.cone, PALETTE.stone, M(0.26, 0.84, 0, { sx: 0.09, sy: 0.24, sz: 0.09, rz: -0.35 }), true),
      P(GEO.cone, PALETTE.stone, M(-0.26, 0.84, 0, { sx: 0.09, sy: 0.24, sz: 0.09, rz: 0.35 }), true),
      P(GEO.box, PALETTE.gold, M(0, 0.4, 0.29, { sx: 0.1, sy: 0.1, sz: 0.02, rz: Math.PI / 4 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.moss, M(0, 0.7, 0.2, { sx: 0.16, sy: 0.08, sz: 0.06 }), false),
      P(GEO.rock, PALETTE.stoneDark, M(0.44, 0.12, -0.2, { s: 0.1 }), true),
      P(GEO.rock, PALETTE.stone, M(-0.4, 0.1, -0.24, { s: 0.09 }), true),
    ],
    // an iron-banded barrel, a lookout flag and a second ammo pile
    artillery: () => [
      P(GEO.cyl, PALETTE.stoneDark, M(0, 0.58, 0.16, { sx: 0.17, sy: 0.05, sz: 0.17, rx: -0.85 }), true),
      P(GEO.cyl, PALETTE.stoneDark, M(0, 0.7, 0.28, { sx: 0.16, sy: 0.05, sz: 0.16, rx: -0.85 }), false),
      P(GEO.cyl, PALETTE.wood, M(0.2, 0.55, -0.16, { sx: 0.02, sy: 0.6, sz: 0.02 }), false),
      P(GEO.box, PALETTE.capRed, M(0.28, 0.78, -0.16, { sx: 0.14, sy: 0.1, sz: 0.01 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.acorn, M(0.3, 0.3, 0.22, { sx: 0.09, sy: 0.11, sz: 0.09 }), true),
      P(GEO.sphereLo, PALETTE.acorn, M(0.2, 0.3, 0.3, { sx: 0.09, sy: 0.11, sz: 0.09 }), true),
    ],
  };

  function tierParts(tier, branch, type) {
    const parts = [];
    if (tier >= 2) {
      parts.push(P(GEO.torus, PALETTE.stone, M(0, 0.05, 0, { sx: 0.42, sy: 0.42, sz: 0.42, rx: Math.PI / 2 }), true, { name: 'tierRing' }));
      parts.push(P(GEO.cyl, PALETTE.wood, M(-0.36, 0.42, -0.3, { sx: 0.02, sy: 0.7, sz: 0.02 }), false, { name: 'pennantPole' }));
      parts.push(P(GEO.box, PALETTE.gold, M(-0.3, 0.68, -0.3, { sx: 0.14, sy: 0.1, sz: 0.01 }), false, { name: 'pennant', live: true, unlit: true }));
      if (TIER2_PARTS[type]) parts.push(...TIER2_PARTS[type]());
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
      P(GEO.bead, PALETTE.gold, M(0.06, 0.03, 0.17, { s: 0.035 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.gold, M(-0.06, 0.03, 0.17, { s: 0.035 }), false, { unlit: true }),
      P(GEO.box, PALETTE.cream, M(0.03, -0.05, 0.18, { sx: 0.03, sy: 0.05, sz: 0.02 }), false, { unlit: true }),
      P(GEO.sphereLo, PALETTE.bat, M(0, -0.06, 0.08, { sx: 0.1, sy: 0.08, sz: 0.1 }), false),
      P(GEO.bead, PALETTE.outline, M(0.065, 0.035, 0.195, { s: 0.015 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.outline, M(-0.055, 0.035, 0.195, { s: 0.015 }), false, { unlit: true }),
      P(GEO.wingL, PALETTE.batWing, pivotMatrix(0.12, 0.02, 0, 0, 0, 0, 0.3, 0, 0, 0.6, 0.025, 0.36), true, { name: 'wingL', live: true }),
      P(GEO.wingR, PALETTE.batWing, pivotMatrix(-0.12, 0.02, 0, 0, 0, 0, -0.3, 0, 0, 0.6, 0.025, 0.36), true, { name: 'wingR', live: true }),
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
      P(GEO.bead, PALETTE.outline, M(0.08, 0.6, 0.17, { s: 0.02 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.outline, M(-0.06, 0.6, 0.17, { s: 0.02 }), false, { unlit: true }),
      P(GEO.cone, gd, M(0, 0.54, 0.3, { sx: 0.035, sy: 0.3, sz: 0.035, rx: Math.PI / 2 }), true, { name: 'nose' }),
      P(GEO.sphereLo, PALETTE.meadowLight, M(0.04, 0.78, -0.04, { sx: 0.16, sy: 0.05, sz: 0.24, rz: -0.3, ry: 0.4 }), true, { name: 'leaf', live: true }),
      P(GEO.cyl, PALETTE.meadowDark, M(0, 0.74, 0, { sx: 0.02, sy: 0.1, sz: 0.02 }), false),
      // eye glints, freckle spots on its back, a pale belly
      P(GEO.bead, PALETTE.cream, M(0.086, 0.605, 0.184, { s: 0.008 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.cream, M(-0.054, 0.605, 0.184, { s: 0.008 }), false, { unlit: true }),
      P(GEO.sphereLo, gd, M(0.06, 0.34, -0.1, { sx: 0.035, sy: 0.035, sz: 0.015 }), false),
      P(GEO.sphereLo, gd, M(-0.05, 0.26, -0.1, { sx: 0.03, sy: 0.03, sz: 0.015 }), false),
      P(GEO.sphereLo, gd, M(0.02, 0.2, -0.1, { sx: 0.025, sy: 0.025, sz: 0.012 }), false),
      P(GEO.sphereLo, PALETTE.meadowLight, M(0, 0.26, 0.065, { sx: 0.075, sy: 0.12, sz: 0.05 }), false),
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
      P(GEO.bead, PALETTE.outline, M(0.08, 0.56, 0.49, { s: 0.02 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.outline, M(-0.08, 0.56, 0.49, { s: 0.02 }), false, { unlit: true }),
      P(GEO.cyl, t, M(0.36, 0.3, 0.14, { sx: 0.1, sy: 0.4, sz: 0.1, rz: -0.25 }), true, { name: 'armL', live: true }),
      P(GEO.cyl, t, M(-0.36, 0.3, 0.14, { sx: 0.1, sy: 0.4, sz: 0.1, rz: 0.25 }), true, { name: 'armR', live: true }),
      P(GEO.sphereLo, td, M(0.42, 0.08, 0.2, { sx: 0.14, sy: 0.09, sz: 0.14 }), true, { name: 'fistL', live: true }),
      P(GEO.sphereLo, td, M(-0.42, 0.08, 0.2, { sx: 0.14, sy: 0.09, sz: 0.14 }), true, { name: 'fistR', live: true }),
      P(GEO.sphereLo, td, M(0.14, 0.06, -0.02, { sx: 0.13, sy: 0.07, sz: 0.16 }), true, { name: 'footL', live: true }),
      P(GEO.sphereLo, td, M(-0.14, 0.06, -0.02, { sx: 0.13, sy: 0.07, sz: 0.16 }), true, { name: 'footR', live: true }),
      // eye glints, a lichen-crusted rock and a second toadstool on its back, brow ridge
      P(GEO.bead, PALETTE.cream, M(0.088, 0.568, 0.505, { s: 0.009 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.cream, M(-0.072, 0.568, 0.505, { s: 0.009 }), false, { unlit: true }),
      P(GEO.box, td, M(0, 0.62, 0.44, { sx: 0.24, sy: 0.04, sz: 0.06, rx: 0.2 }), false),
      P(GEO.rock, PALETTE.stone, M(0.18, 0.72, -0.2, { s: 0.08 }), false),
      P(GEO.sphereLo, PALETTE.flowerYellow, M(0.18, 0.79, -0.2, { sx: 0.05, sy: 0.02, sz: 0.05 }), false),
      P(GEO.cyl, PALETTE.cream, M(-0.2, 0.78, -0.02, { sx: 0.02, sy: 0.08, sz: 0.02 }), false),
      P(GEO.dome, PALETTE.capRed, M(-0.2, 0.82, -0.02, { sx: 0.06, sy: 0.045, sz: 0.06 }), false),
      P(GEO.bead, PALETTE.cream, M(-0.21, 0.86, 0.0, { s: 0.012 }), false),
    ];
  }

  // Boss silhouette: a churning core with small creatures wheeling around
  // it, peeling away as it weakens. All four bosses (the original
  // Shadow-Crow Swarm plus Levels 6-8's finales) share this one animated
  // rig (see updateBossView) — only makeBossParts' shape/color inputs
  // differ, so every boss reads as a genuinely different creature (a
  // round bird-swarm vs. a flat eel-churn vs. a plump stinging swarm vs.
  // a pale spiked shard-cloud) while reusing the exact same proven
  // orbit/rotation math, not new per-boss animation code.
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
      P(GEO.sphereLo, coreColor, M(0, 0, 0, coreScale), true, { name: 'core', live: true }),
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
  // Shadow-Crow Swarm (Level 1 / Level 5 reprise): a dark churning core
  // with crows wheeling around it. Silhouette: a big dark ball with
  // wings all round it. Unchanged from before makeBossParts existed.
  function bossParts() {
    return makeBossParts({ coreColor: PALETTE.batDark, accentColor: PALETTE.gold, orbitColor: PALETTE.batDark, wingColor: PALETTE.batDark, beakColor: PALETTE.gold });
  }
  // The Drowned Swarm (Level 6 finale): a flattened whirlpool core
  // ringed by foam, darting eel-shapes orbiting instead of birds.
  // Silhouette: a flat wide disc with a churning ring, not a round ball.
  function tidewormParts() {
    return makeBossParts({
      coreColor: PALETTE.waterDeep, coreScale: { sx: 0.42, sy: 0.26, sz: 0.42 }, accentColor: PALETTE.waterFoam,
      extra: [
        P(GEO.torus, PALETTE.waterFoam, M(0, 0.02, 0, { sx: 0.5, sy: 0.5, sz: 0.06, rx: Math.PI / 2 }), false),
        P(GEO.torus, PALETTE.water, M(0, 0.1, 0, { sx: 0.34, sy: 0.34, sz: 0.045, rx: Math.PI / 2 }), false),
      ],
      orbitScale: { sx: 0.06, sy: 0.06, sz: 0.26 }, orbitColor: PALETTE.streamBed,
      wingScale: { sx: 0.02, sy: 0.1, sz: 0.08 }, wingColor: PALETTE.water,
      beakScale: { sx: 0.02, sy: 0.05, sz: 0.02 }, beakColor: PALETTE.waterFoam,
    });
  }
  // The Hive Matriarch (Level 7 finale): a plump amber-black abdomen with
  // two big wings and a stinger of her own, drone wasps orbiting.
  // Silhouette: a fat oval body with wings and a tail spike, not a
  // smooth ball.
  function matriarchParts() {
    return makeBossParts({
      coreColor: PALETTE.hollowWood, coreScale: { sx: 0.3, sy: 0.32, sz: 0.44 }, accentColor: PALETTE.gold,
      extra: [
        P(GEO.box, PALETTE.cream, M(0.26, 0.06, -0.05, { sx: 0.28, sy: 0.01, sz: 0.16, ry: 0.5 }), false),
        P(GEO.box, PALETTE.cream, M(-0.26, 0.06, -0.05, { sx: 0.28, sy: 0.01, sz: 0.16, ry: -0.5 }), false),
        P(GEO.cone, PALETTE.hollowWood, M(0, 0, -0.5, { sx: 0.05, sy: 0.16, sz: 0.05, rx: -Math.PI / 2 }), false),
      ],
      orbitScale: { sx: 0.09, sy: 0.09, sz: 0.16 }, orbitColor: PALETTE.gold,
      wingScale: { sx: 0.32, sy: 0.015, sz: 0.12 }, wingColor: PALETTE.cream,
      beakScale: { sx: 0.025, sy: 0.06, sz: 0.025 }, beakColor: PALETTE.hollowWood,
    });
  }
  // The Rime Swarm (Level 8 finale): a pale spiky ice-crystal core,
  // slivers of frost orbiting instead of birds. Silhouette: a spiked
  // pale burst, not a smooth dark ball.
  function rimeParts() {
    const spikes = [];
    for (let i = 0; i < 5; i++) {
      const a = i * 1.257, len = 0.18 + (i % 2) * 0.06;
      spikes.push(P(GEO.cone, PALETTE.frost, M(Math.cos(a) * 0.2, Math.sin(a) * 0.12, Math.sin(a) * 0.2, { sx: 0.05, sy: len, sz: 0.05, rz: Math.cos(a), rx: -Math.sin(a) }), false));
    }
    return makeBossParts({
      coreColor: PALETTE.frostRobe, coreScale: { s: 0.32 }, accentColor: PALETTE.snow, extra: spikes,
      orbitScale: { sx: 0.05, sy: 0.05, sz: 0.24 }, orbitColor: PALETTE.frost,
      wingScale: { sx: 0.015, sy: 0.1, sz: 0.05 }, wingColor: PALETTE.frostRobe,
      beakScale: { sx: 0.02, sy: 0.05, sz: 0.02 }, beakColor: PALETTE.snow,
    });
  }

  const WALK = {
    grunt:     { freq: 7.5, bounce: 0.09, lean: 0.1, sway: 0.08 },
    trickster: { freq: 12,  bounce: 0.15, lean: 0.25, sway: 0.16 },
    troll:     { freq: 3.6, bounce: 0.05, lean: 0.06, sway: 0.05 },
  };
  const ENEMY_RECIPES = { grunt: gruntParts, trickster: tricksterParts, troll: trollParts, bat: batParts, boss: bossParts, tideworm: tidewormParts, matriarch: matriarchParts, rime: rimeParts };

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
  // Shockwave rings: one InstancedMesh, so any number of them is one draw call.
  // Additive blending, so fading the instance color to black fades the ring out.
  const RINGS = 20;
  const rings = [];
  let ringMesh = null;
  const _ringM = new THREE.Matrix4(), _ringC = new THREE.Color(), _ringQ = new THREE.Quaternion(), _ringP = new THREE.Vector3(), _ringS = new THREE.Vector3();
  function buildRings() {
    const geo = new THREE.RingGeometry(0.7, 1, 28, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    ringMesh = new THREE.InstancedMesh(geo, mat, RINGS);
    ringMesh.name = 'rings';
    ringMesh.frustumCulled = false;
    ringMesh.renderOrder = 3;
    for (let i = 0; i < RINGS; i++) {
      rings.push({ alive: false, life: 0, ttl: 0.4, x: 0, y: 0, z: 0, r: 1, color: new THREE.Color() });
      ringMesh.setColorAt(i, _ringC.setRGB(0, 0, 0));
      ringMesh.setMatrixAt(i, _ringM.makeScale(0, 0, 0));
    }
    scene.add(ringMesh);
    animated.push({
      update(t, dt) {
        for (let i = 0; i < RINGS; i++) {
          const u = rings[i];
          if (u.alive) { u.life += dt; if (u.life >= u.ttl) u.alive = false; }
          if (!u.alive) { ringMesh.setMatrixAt(i, _ringM.makeScale(0, 0, 0)); continue; }
          const k = u.life / u.ttl, e = 1 - (1 - k) * (1 - k);
          const sc = Math.max(0.01, u.r * (0.25 + 0.75 * e));
          _ringM.compose(_ringP.set(u.x, u.y, u.z), _ringQ.identity(), _ringS.set(sc, 1, sc));
          ringMesh.setMatrixAt(i, _ringM);
          ringMesh.setColorAt(i, _ringC.copy(u.color).multiplyScalar(0.9 * (1 - k) * (1 - k)));
        }
        ringMesh.instanceMatrix.needsUpdate = true;
        if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
      },
    });
  }
  function ring(x, y, z, { color = PALETTE.cream, radius = 0.8, ttl = 0.4 } = {}) {
    // reuse a free slot, else steal the oldest so a burst of impacts never drops the newest
    let pick = rings.find((u) => !u.alive);
    if (!pick) pick = rings.reduce((a, b) => (a.life / a.ttl > b.life / b.ttl ? a : b));
    Object.assign(pick, { alive: true, life: 0, ttl, x, y: Math.max(0.03, y), z, r: radius });
    pick.color.setHex(color);
  }
  function spark(x, y, z, color = PALETTE.gold, count = 3) {
    puff(x, y, z, { count, color, speed: 2.6, size: 0.045, up: 1.8, ttl: 0.28 });
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
    const parts = TOWER_RECIPES[tower.type]().concat(tierParts(tower.tier, tower.branch, tower.type));
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
      v.group.scale.multiplyScalar(TOWER_K * (1 + 0.06 * (v.tower.tier - 1)));   // each tier stands a little taller
    }
  }

  // -------- enemy views --------
  const enemyViews = new Map();
  const dying = [];   // views playing an exit animation before removal
  const BAT_HEIGHT = 0.95, BOSS_HEIGHT = 1.25;
  // display-only size boost: units read as characters beside the oversized scenery
  const TOWER_K = 1.25, ENEMY_K = 1.4;
  function addEnemyView(e) {
    const g = liveProp(ENEMY_RECIPES[e.type](), e.x, 0, e.z, { ao: !e.flying });
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
      if (!e.rooted) g.rotation.y += Math.sin(cycle) * w.sway * 0.9;   // shoulders twist against the stride
      // a footfall: the moment the hop lands, the heavy walkers kick up dust
      const step = Math.floor(cycle / Math.PI);
      if (v.lastStep !== undefined && step !== v.lastStep && !e.rooted && e.age > 0.4 && (e.type === 'troll' || e.type === 'grunt')) {
        puff(e.x, 0.05, e.z, { count: e.type === 'troll' ? 3 : 1, color: PALETTE.path, speed: 0.6, size: e.type === 'troll' ? 0.09 : 0.06, up: 0.5, ttl: 0.4 });
      }
      v.lastStep = step;
      const stretch = 0.9 + 0.22 * bounce;
      v.pop = Math.max(0, v.pop - dt * 5);
      const popK = Math.sin(Math.min(1, v.pop) * Math.PI) * 0.35;   // scale-pop when hit
      const s = born * (1 - (1 - born) * 0.5);
      g.scale.set(s * (1.06 - 0.1 * bounce + popK), s * (stretch - popK * 0.6), s * (1.06 - 0.1 * bounce + popK)).multiplyScalar(ENEMY_K);
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
    g.scale.set(born * (1 + popK), born * (1 - popK * 0.5), born * (1 + popK)).multiplyScalar(ENEMY_K);
    pivotMatrix(0.12, 0.02, 0, 0, 0, flap, 0.3, 0, 0, 0.6, 0.025, 0.36, v.wingL.matrix);
    pivotMatrix(-0.12, 0.02, 0, 0, 0, -flap, -0.3, 0, 0, 0.6, 0.025, 0.36, v.wingR.matrix);
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
          ring(g.position.x, 0.06, g.position.z, { color: v.e.boss ? PALETTE.magic : PALETTE.cream, radius: v.e.boss ? 2.2 : 0.7, ttl: v.e.boss ? 0.9 : 0.45 });
          spark(g.position.x, 0.5, g.position.z, PALETTE.gold, v.e.boss ? 8 : 3);
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
      spark(x, 0.5, z, PALETTE.gold, 2);
    });
    GameState.on('towerFired', ({ tower }) => {
      const v = towerViews.get(tower.id);
      if (v) v.recoil = 1;
      if (tower.type === 'golem') shakeCamera(0.04, 0.2);
      // muzzle flash: a tiny bright burst at the tower's business end
      const fx = tower.x + Math.sin(tower.facing) * 0.3, fz = tower.z + Math.cos(tower.facing) * 0.3;
      spark(fx, tower.type === 'artillery' ? 0.75 : 0.85, fz, tower.type === 'druid' ? PALETTE.frost : tower.type === 'warden' ? PALETTE.magic : PALETTE.cream, 2);
    });
    GameState.on('towerUpgraded', (tower) => {
      removeTowerView(tower.id);
      addTowerView(tower, true);
      puff(tower.x, 0.5, tower.z, { count: 14, color: PALETTE.gold, speed: 1.4, size: 0.09, up: 2.0, ttl: 0.8 });
      ring(tower.x, 0.06, tower.z, { color: PALETTE.gold, radius: 0.9, ttl: 0.6 });
      if (tower.branch) {
        ring(tower.x, 0.08, tower.z, { color: PALETTE.magic, radius: 1.5, ttl: 0.8 });
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
        puff(x, 0.2, z, { count: 14, color: PALETTE.magic, speed: 2.4, size: 0.08, up: 0.9, ttl: 0.5 });
        puff(x, 0.2, z, { count: 8, color: PALETTE.cloak, speed: 1.6, size: 0.1, up: 1.4, ttl: 0.6 });
        ring(x, 0.06, z, { color: PALETTE.magic, radius: 0.9, ttl: 0.45 });
        spark(x, 0.3, z, PALETTE.flowerPink, 4);
      } else if (p.kind === 'wisp') {
        puff(x, y, z, { count: 6, color: PALETTE.frost, speed: 1.2, size: 0.07, up: 0.6, ttl: 0.45 });
        ring(x, flying ? BAT_HEIGHT : 0.1, z, { color: PALETTE.frost, radius: 0.45, ttl: 0.35 });
      } else if (p.kind === 'boulder') {
        puff(x, 0.2, z, { count: 12, color: PALETTE.stone, speed: 2.0, size: 0.11, up: 1.6, ttl: 0.6 });
        ring(x, 0.06, z, { color: PALETTE.cream, radius: 1.1, ttl: 0.5 });
        spark(x, 0.3, z, PALETTE.gold, 5);
        shakeCamera(0.1, 0.3);
      } else if (p.kind === 'bigacorn') {
        puff(x, y, z, { count: 12, color: PALETTE.acorn, speed: 2.6, size: 0.1, up: 1.8, ttl: 0.6 });
        puff(x, y, z, { count: 8, color: PALETTE.cream, speed: 1.4, size: 0.12, up: 1.0, ttl: 0.7 });
        ring(x, flying ? BAT_HEIGHT : 0.06, z, { color: PALETTE.gold, radius: 0.85, ttl: 0.45 });
        spark(x, y, z, PALETTE.gold, 4);
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
      treeParts, deadTreeParts, rockParts, mushroomParts, tuftParts, flowerParts, acornParts,
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
    buildRings();
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