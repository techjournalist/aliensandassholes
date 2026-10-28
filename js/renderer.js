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
  // Pipeline switch, set in init(). Light intensities and the toon ramp were
  // tuned in display space, so in linear light they are raised to 2.2 to keep
  // the look the same before it is deliberately retuned.
  let LIN = false;
  const EXPOSURE = 1.3;
  const lin = (v) => (LIN ? Math.pow(v, 2.2) : v);
  // what the screen shows for a linear color after ACES (r128's curve) and sRGB encoding
  function displayColor(c, exposure) {
    let r = c.r, g = c.g, b = c.b;
    if (exposure) {
      const k = exposure / 0.6;
      r *= k; g *= k; b *= k;
      const r1 = 0.59719 * r + 0.35458 * g + 0.04823 * b, g1 = 0.0760 * r + 0.90834 * g + 0.01566 * b, b1 = 0.0284 * r + 0.13383 * g + 0.83777 * b;
      const fit = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
      const a = fit(r1), bb = fit(g1), cc = fit(b1);
      r = 1.60475 * a - 0.53108 * bb - 0.07367 * cc; g = -0.10208 * a + 1.10813 * bb - 0.00605 * cc; b = -0.00327 * a - 0.07276 * bb + 1.07602 * cc;
      r = Math.min(1, Math.max(0, r)); g = Math.min(1, Math.max(0, g)); b = Math.min(1, Math.max(0, b));
    }
    return new THREE.Color(r, g, b).convertLinearToSRGB();
  }


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
      sky: t.sky ?? 0xece4ff,
      bounce: t.bounce ?? 0x3e3060,
      hemi: ambient * 1.05,
      sun: t.sun ?? 0.6,
      sunColor: t.sunColor ?? 0xfff2ea,
      fill: t.fill ?? 0x7ad8ff,
      fillIntensity: t.fillIntensity ?? 0.18,
      motes: t.motes ?? {},
    };
  }

  // Lower-end touch devices get fewer grass blades and motes.
  const QUALITY = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 0.55 : 1;
  // Ambient effects (water, grass, motes) run on wall-clock time so the
  // world keeps breathing on the title screen and while paused.
  const fxTime = { value: 0 }, moteScale = { value: 1 };
  let fxLast = 0, fxT = 0, dirLast = 0, dirDt = 0;

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
  // Enemy rim glow: one shared toon material that adds a hot pink-red edge
  // light where a surface turns away from the camera. Only enemies use it (a
  // single extra shader program, no extra draw calls), so a crowd of hostile
  // silhouettes pops off the meadow while the towers keep their own colors.
  let _rimMat = null;
  const RIM_COLOR = new THREE.Color(0xff4f7a);
  function rimMat() {
    if (_rimMat) return _rimMat;
    const m = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap, vertexColors: true });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = { value: RIM_COLOR };
      sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <output_fragment>',
        `float rimK = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.2);
         outgoingLight += uRim * rimK * 0.75;
         #include <output_fragment>`);
    };
    m.customProgramCacheKey = () => 'enemy-rim';
    return (_rimMat = m);
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
    // a longbow: a 135-degree arc bulging toward +z, its tips level with the origin's z + 0.38
    GEO.bow = new THREE.TorusGeometry(1, 0.06, 5, 14, Math.PI * 0.75);
    GEO.bow.rotateZ(-Math.PI * 0.375);
    GEO.bow.rotateY(-Math.PI / 2);
    for (const k in GEO) { if (GEO[k].index) GEO[k] = GEO[k].toNonIndexed(); }
    // circle should lie flat on the ground
    GEO.circle.rotateX(-Math.PI / 2);
    // soft contact shadow: wider than the old hard disc since its edge fades
    GEO.shadowDisc = GEO.circle.clone();
    GEO.shadowDisc.scale(1.35, 1, 1.35);
  }

  // Shadows are cool violet, not brown-black, so they read as shade on a sunny
  // meadow. Round for units, trailing for things that stand still.
  let _shadowMat = null, _castMat = null;
  function shadowMat() {
    return _shadowMat || (_shadowMat = new THREE.MeshBasicMaterial({
      color: 0x2a2048, map: RendererFX.shadowTexture(), transparent: true, opacity: 0.55, depthWrite: false,
    }));
  }
  function castShadowMat() {
    return _castMat || (_castMat = new THREE.MeshBasicMaterial({
      color: 0x2a2048, map: RendererFX.castShadowTexture(), transparent: true, opacity: 0.8, depthWrite: false,
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
          #include <tonemapping_fragment>
          #include <encodings_fragment>
          #include <fog_fragment>
        }`,
      side: THREE.BackSide,
      fog: true,
    });
  }

  // ---- per-limb rig: shared GLSL plus three material factories ----
  // One rig object per enemy: pivots (constant per type) and per-slot angles
  // (updated every frame). All three materials of an enemy read the same
  // arrays, and programs are shared across enemies through constant cache keys.
  const RIG_GLSL = `
    attribute float aLimb;
    uniform vec3 uPiv[${9}];
    uniform vec4 uAng[${9}];
    vec3 rigRot(vec3 v, vec4 a) {
      float c = cos(a.x), s = sin(a.x);
      v = vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z);
      c = cos(a.y); s = sin(a.y);
      return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z);
    }
    vec3 rigP(vec3 p) {
      int id = int(aLimb + 0.5);
      if (id == 0) return p;
      vec4 a = uAng[id]; vec3 pv = uPiv[id];
      return rigRot(p - pv, a) + pv + vec3(0.0, a.z, a.w);
    }
    vec3 rigN(vec3 n) {
      int id = int(aLimb + 0.5);
      return id == 0 ? n : rigRot(n, uAng[id]);
    }`;
  function makeRig(type) {
    const piv = [], ang = [];
    for (let i = 0; i < RIG_SLOTS; i++) {
      const pv = (RIG_PIVOTS[type] || {})[i] || [0, 0, 0];
      piv.push(new THREE.Vector3(pv[0], pv[1], pv[2]));
      ang.push(new THREE.Vector4(0, 0, 0, 0));
    }
    return { piv, ang };
  }
  function rigInject(sh, rig) {
    sh.uniforms.uPiv = { value: rig.piv };
    sh.uniforms.uAng = { value: rig.ang };
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', RIG_GLSL + '\nvoid main() {')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  objectNormal = rigN(objectNormal);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed = rigP(transformed);');
  }
  function makeRigMats(rig) {
    const toonM = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap, vertexColors: true });
    toonM.onBeforeCompile = (sh) => {
      rigInject(sh, rig);
      sh.uniforms.uRim = { value: RIM_COLOR };
      sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <output_fragment>',
        `float rimK = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.2);
         outgoingLight += uRim * rimK * 0.75;
         #include <output_fragment>`);
    };
    toonM.customProgramCacheKey = () => 'rig-toon-rim';
    const unlitM = new THREE.MeshBasicMaterial({ vertexColors: true });
    unlitM.onBeforeCompile = (sh) => rigInject(sh, rig);
    unlitM.customProgramCacheKey = () => 'rig-unlit';
    // the ink outline must follow the limbs or it would be left standing behind them
    const outM = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { color: { value: new THREE.Color(PALETTE.outline) } }]),
      vertexShader: `
        uniform float thickness;
        ${RIG_GLSL}
        #include <fog_pars_vertex>
        void main() {
          vec3 n = normalize(normalMatrix * rigN(normal));
          vec4 mvPosition = modelViewMatrix * vec4(rigP(position), 1.0);
          mvPosition.xyz += n * thickness;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: outlineMat.fragmentShader,
      side: THREE.BackSide, fog: true,
    });
    outM.uniforms.thickness = outlineMat.uniforms.thickness;   // one shared width, follows zoom and resize
    outM.uniforms.uPiv = { value: rig.piv };
    outM.uniforms.uAng = { value: rig.ang };
    outM.customProgramCacheKey = () => 'rig-outline';
    return { toon: toonM, unlit: unlitM, outline: outM };
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
    const withLimb = geos.length > 0 && geos.every((g) => g.attributes.aLimb);
    const limb = withLimb ? new Float32Array(count) : null;
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
    const col = withColor ? new Float32Array(count * 3) : null;
    const uv = withUv ? new Float32Array(count * 2) : null;
    let off = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, off * 3);
      nor.set(g.attributes.normal.array, off * 3);
      if (col) col.set(g.attributes.color.array, off * 3);
      if (uv) uv.set(g.attributes.uv.array, off * 2);
      if (limb) limb.set(g.attributes.aLimb.array, off);
      off += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (limb) out.setAttribute('aLimb', new THREE.BufferAttribute(limb, 1));
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
  // The sun is at (-6, 10, 7), so shadows fall toward +x and -z. The cast
  // texture's tail runs along +u, which is local +x before rotation.
  const SUN_AWAY = Math.atan2(-7, 6);
  function batchDecal(x, z, radius, tall = 1) {
    const len = radius * (2.7 + 0.6 * tall);
    batch.decals.push(GEO.shadowDisc.clone().applyMatrix4(M(x + Math.cos(SUN_AWAY) * len * 0.34, groundYAt(x, z) + 0.012, z - Math.sin(SUN_AWAY) * len * 0.34 * -1,
      { sx: len, sy: 1, sz: radius * 1.15, ry: -SUN_AWAY })));
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
      const mesh = new THREE.Mesh(mergeGeoms(batch.decals), castShadowMat());
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
      if (opts.rig) geo.setAttribute('aLimb', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(p.limb || 0), 1));
      if (ao && !p.unlit) {
        const c = geo.attributes.color, a = aoColors(geo);
        for (let i = 0; i < c.array.length; i++) c.array[i] *= a.array[i];
      }
      (p.unlit ? unlitGeos : toonGeos).push(geo);
      if (p.outline) {
        const og = smoothedForOutline(p.geo).clone().applyMatrix4(p.m);
        if (opts.rig) og.setAttribute('aLimb', new THREE.BufferAttribute(new Float32Array(og.attributes.position.count).fill(p.limb || 0), 1));
        outlineGeos.push(og);
      }
    }
    if (toonGeos.length) { const m = new THREE.Mesh(mergeGeoms(toonGeos), opts.rig ? opts.rig.mats.toon : opts.rim ? rimMat() : toon(0xffffff, { vc: true })); m.name = 'merged'; g.add(m); }
    if (unlitGeos.length) { const m = new THREE.Mesh(mergeGeoms(unlitGeos), opts.rig ? opts.rig.mats.unlit : unlitVC()); m.name = 'mergedUnlit'; g.add(m); }
    if (outlineGeos.length) { const m = new THREE.Mesh(mergeGeoms(outlineGeos), opts.rig ? opts.rig.mats.outline : outlineMat); m.name = 'mergedOutline'; g.add(m); }
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
  // free-standing lights (lanterns, braziers, fires) face the camera, so they
  // are rebuilt whenever the player turns the view (see refreshCamGlows)
  const camGlows = [];
  let camGlowMesh = null;
  let glowMat = null, glowK = 1;
  function glow(x, y, z, { w = 0.5, h = 0.5, axis = 'cam', sign = 1 } = {}) {
    if (axis === 'cam') { camGlows.push({ x, y, z, w, h }); return; }
    const g = new THREE.PlaneGeometry(w, h).toNonIndexed();
    if (axis === 'x') g.rotateY(sign * Math.PI / 2);
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
      glow(p.x, p.y, p.z, { w: w * 4.6, h: h * 3.3, axis, sign });
    }
  }
  function setGlow(k) { glowK = k; }
  const QUAD = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  function refreshCamGlows() {
    if (!camGlowMesh) return;
    const pos = camGlowMesh.geometry.attributes.position.array;
    let o = 0;
    for (const g of camGlows) for (const [sx, sy] of QUAD) {
      const rx = sx * g.w / 2, uy = sy * g.h / 2;
      pos[o++] = g.x + camRight.x * rx + camUp.x * uy;
      pos[o++] = g.y + camRight.y * rx + camUp.y * uy;
      pos[o++] = g.z + camRight.z * rx + camUp.z * uy;
    }
    camGlowMesh.geometry.attributes.position.needsUpdate = true;
  }
  function flushGlow() {
    if (!glowGeos.length && !camGlows.length) return;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.2, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
    glowMat = new THREE.MeshBasicMaterial({
      color: PALETTE.windowWarm, map: new THREE.CanvasTexture(c), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55,
    });
    if (glowGeos.length) {
      const mesh = new THREE.Mesh(mergeGeoms(glowGeos), glowMat);
      mesh.name = 'glow';
      mesh.renderOrder = 2;
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
    }
    if (camGlows.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(camGlows.length * 18), 3));
      const uv = new Float32Array(camGlows.length * 12);
      for (let i = 0; i < camGlows.length; i++) QUAD.forEach(([sx, sy], k) => { uv[i * 12 + k * 2] = (sx + 1) / 2; uv[i * 12 + k * 2 + 1] = (sy + 1) / 2; });
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      camGlowMesh = new THREE.Mesh(geo, glowMat);
      camGlowMesh.name = 'glowCam';
      camGlowMesh.renderOrder = 2;
      camGlowMesh.frustumCulled = false;
      camGlowMesh.matrixAutoUpdate = false;
      scene.add(camGlowMesh);
      refreshCamGlows();
    }
    animated.push({ update(t) { glowMat.opacity = glowK * (0.52 + 0.07 * Math.sin(t * 7.3) * Math.sin(t * 2.9)); } });
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

  // Moon flora: three species keep a grove from reading as one plant
  // repeated: a bulb tree (a curving stalk under a fat round crown with
  // glowing seeds), a corkscrew frond (tilted discs stacked up a stalk) and a
  // coral cluster (capped tubes of different heights). Like the old trees
  // they only use the three meadow tones for their bulk, so each level's
  // retint still works, plus one glowing accent.
  function treeParts(rng) {
    const kind = rng();
    if (kind < 0.28) return frondParts(rng);
    if (kind < 0.48) return coralParts(rng);
    return bulbTreeParts(rng);
  }
  const GLOWS = () => [PALETTE.flowerPink, PALETTE.crystalTeal, PALETTE.flowerYellow, PALETTE.crystal];
  function rootFlares(parts, rng, n, ry, len) {
    const ra = rng() * 6;
    for (let i = 0; i < n; i++) {
      const a = ra + i * (Math.PI * 2 / n);
      parts.push(P(GEO.cone, PALETTE.meadowDark, M(Math.cos(a) * 0.09, 0.04, Math.sin(a) * 0.09,
        { sx: 0.05, sy: len, sz: 0.045, rz: -Math.cos(a) * 1.25, rx: Math.sin(a) * 1.25 }), false));
    }
  }
  function frondParts(rng) {
    const h = 0.9 + rng() * 0.6, lean = (rng() - 0.5) * 0.25;
    const parts = [P(GEO.cylTaper, PALETTE.meadowDark, M(0, h / 2, 0, { sx: 0.06, sy: h, sz: 0.06, rz: lean }))];
    rootFlares(parts, rng, 3, 0.04, 0.16);
    const n = 4, cols = [PALETTE.meadowDark, PALETTE.meadow, PALETTE.meadow, PALETTE.meadowLight];
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1), y = 0.3 + k * h * 0.78, r = 0.34 - k * 0.17;
      parts.push(P(GEO.cyl, cols[i], M(Math.sin(lean) * -y * 0.5, y, 0, { sx: r, sy: 0.05, sz: r * 0.82, rx: (rng() - 0.5) * 0.5, rz: 0.35 * (i % 2 ? 1 : -1), ry: rng() * 6 })));
    }
    parts.push(P(GEO.sphereLo, GLOWS()[Math.floor(rng() * 4)], M(Math.sin(lean) * -h * 0.5, h + 0.12, 0, { s: 0.07 }), false, { unlit: true }));
    return { parts, radius: 0.3 };
  }
  function coralParts(rng) {
    const parts = [], n = 3 + Math.floor(rng() * 3), cap = GLOWS()[Math.floor(rng() * 4)];
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.28, d = i ? 0.08 + rng() * 0.12 : 0, h = 0.35 + rng() * 0.55, r = 0.06 + rng() * 0.04;
      const x = Math.cos(a) * d, z = Math.sin(a) * d, tilt = (rng() - 0.5) * 0.35;
      parts.push(P(GEO.cylTaper, i % 2 ? PALETTE.meadow : PALETTE.meadowDark, M(x, h / 2, z, { sx: r, sy: h, sz: r, rz: tilt })));
      parts.push(P(GEO.torus, PALETTE.meadowLight, M(x - Math.sin(tilt) * h / 2, h, z, { sx: r * 0.95, sy: r * 0.95, sz: r * 1.6, rx: Math.PI / 2 }), false));
      parts.push(P(GEO.cyl, cap, M(x - Math.sin(tilt) * h / 2, h - 0.005, z, { sx: r * 0.72, sy: 0.02, sz: r * 0.72 }), false, { unlit: true }));
    }
    return { parts, radius: 0.25 };
  }
  function bulbTreeParts(rng) {
    const h = 0.7 + rng() * 0.5, r = 0.36 + rng() * 0.22, bend = (rng() - 0.5) * 0.5;
    const top = h * 0.7;
    const parts = [
      P(GEO.cylTaper, PALETTE.meadowDark, M(0, h * 0.2, 0, { sx: 0.1, sy: h * 0.4, sz: 0.1 })),
      P(GEO.cylTaper, PALETTE.meadowDark, M(Math.sin(bend) * h * 0.15, h * 0.52, 0, { sx: 0.07, sy: h * 0.42, sz: 0.07, rz: -bend * 0.8 })),
    ];
    rootFlares(parts, rng, 3 + Math.floor(rng() * 2), 0.04, 0.2);
    const cx = Math.sin(bend) * h * 0.3;
    // the crown: one fat round bulb, lighter toward the sun, ringed with leaf flaps
    parts.push(P(GEO.sphereMid, PALETTE.meadow, M(cx, top + r * 0.7, 0, { sx: r, sy: r * 0.85, sz: r })));
    parts.push(P(GEO.sphereLo, PALETTE.meadowLight, M(cx - r * 0.3, top + r * 1.1, -r * 0.05, { s: r * 0.55 })));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rng();
      parts.push(P(GEO.cone, PALETTE.meadowDark, M(cx + Math.cos(a) * r * 0.85, top + r * 0.35, Math.sin(a) * r * 0.85,
        { sx: r * 0.32, sy: r * 0.5, sz: r * 0.12, rz: -Math.cos(a) * 2.2, rx: Math.sin(a) * 2.2 }), false));
    }
    // glowing seeds dotted over the crown, so a grove twinkles
    if (rng() < 0.7) {
      const fc = GLOWS()[Math.floor(rng() * 4)];
      for (let i = 0; i < 4; i++) {
        const a = rng() * 6.28, el = 0.2 + rng() * 0.9;
        parts.push(P(GEO.bead, fc, M(cx + Math.cos(a) * Math.cos(el) * r * 0.98, top + r * 0.7 + Math.sin(el) * r * 0.85, Math.sin(a) * Math.cos(el) * r * 0.98, { s: 0.045 }), false, { unlit: true }));
      }
    }
    return { parts, radius: r * 0.9 };
  }
  // where the goo has spread: a withered stalk hung with goo strings and a
  // pod of acid-green spores still glowing
  function deadTreeParts(rng) {
    const h = 0.8 + rng() * 0.7, lean = (rng() - 0.5) * 0.6;
    const parts = [
      P(GEO.cylTaper, PALETTE.hollowWood, M(0, h / 2, 0, { sx: 0.1, sy: h, sz: 0.1, rz: lean })),
    ];
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + rng();
      parts.push(P(GEO.cone, PALETTE.hollowWood, M(Math.cos(a) * 0.1, 0.05, Math.sin(a) * 0.1,
        { sx: 0.05, sy: 0.22, sz: 0.045, rz: -Math.cos(a) * 1.3, rx: Math.sin(a) * 1.3 }), false));
    }
    const n = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const y = h * (0.5 + rng() * 0.4), a = rng() * Math.PI * 2, len = 0.25 + rng() * 0.3;
      const m = new THREE.Matrix4().makeTranslation(Math.sin(lean) * -y * 0.5, y, 0)
        .multiply(new THREE.Matrix4().makeRotationY(a))
        .multiply(new THREE.Matrix4().makeRotationZ(1.2 + rng() * 0.6))
        .multiply(new THREE.Matrix4().makeTranslation(0, len / 2, 0))
        .multiply(new THREE.Matrix4().makeScale(0.04, len, 0.04));
      parts.push(P(GEO.cylTaper, PALETTE.hollowWood, m));
    }
    // the spore pod, and a drip of goo down the stalk
    parts.push(P(GEO.sphereLo, PALETTE.hollowEarth, M(Math.sin(lean) * -h * 0.5, h + 0.04, 0, { sx: 0.11, sy: 0.14, sz: 0.11 })));
    if (rng() < 0.7) parts.push(P(GEO.bead, PALETTE.spore, M(Math.sin(lean) * -h * 0.5, h + 0.06, 0.08, { s: 0.045 }), false, { unlit: true }));
    parts.push(P(GEO.cyl, PALETTE.spore, M(Math.sin(lean) * -h * 0.25 + 0.06, h * 0.55, 0.05, { sx: 0.015, sy: h * 0.4, sz: 0.015, rz: lean }), false, { unlit: true }));
    return { parts, radius: 0.22 };
  }
  // a glowshroom: a pale stalk under a neon cap with glowing spots
  function mushroomParts(rng, big) {
    const s = big ? 0.55 + rng() * 0.25 : 0.22 + rng() * 0.12;
    const tilt = (rng() - 0.5) * 0.25;
    const capCol = [PALETTE.crystal, PALETTE.crystalTeal, PALETTE.flowerPink][Math.floor(rng() * 3)];
    const parts = [
      P(GEO.cylTaper, PALETTE.cream, M(0, s * 0.45, 0, { sx: s * 0.28, sy: s * 0.9, sz: s * 0.28, rz: tilt })),
      P(GEO.cyl, shade(capCol, 0.35), M(0, s * 0.79, 0, { sx: s * 0.7, sy: s * 0.04, sz: s * 0.7, rz: tilt }), false),
      P(GEO.dome, capCol, M(0, s * 0.8, 0, { sx: s * 0.75, sy: s * 0.5, sz: s * 0.75, rz: tilt })),
    ];
    if (big) parts.push(P(GEO.torus, PALETTE.cream, M(0, s * 0.6, 0, { sx: s * 0.28, sy: s * 0.28, sz: s * 0.5, rx: Math.PI / 2 }), false));
    const spots = big ? 4 + Math.floor(rng() * 3) : 2 + Math.floor(rng() * 2);
    for (let i = 0; i < spots; i++) {
      const a = rng() * Math.PI * 2, d = s * (0.2 + rng() * 0.4);
      const lift = Math.sqrt(Math.max(0, 1 - (d / (s * 0.75)) ** 2));
      parts.push(P(GEO.bead, PALETTE.cream, M(Math.cos(a) * d, s * 0.8 + s * 0.48 * lift, Math.sin(a) * d, { sx: s * 0.1, sy: s * 0.06, sz: s * 0.1 }), false, { unlit: true }));
    }
    if (rng() < 0.5) {
      const a = rng() * 6.28, ss = s * 0.35;
      parts.push(P(GEO.cyl, PALETTE.cream, M(Math.cos(a) * s * 0.4, ss * 0.4, Math.sin(a) * s * 0.4, { sx: ss * 0.3, sy: ss * 0.8, sz: ss * 0.3 }), false));
      parts.push(P(GEO.dome, capCol, M(Math.cos(a) * s * 0.4, ss * 0.75, Math.sin(a) * s * 0.4, { sx: ss * 0.7, sy: ss * 0.5, sz: ss * 0.7 })));
    }
    return { parts, radius: s * 0.75 };
  }
  function tuftParts(rng) {
    const s = 0.12 + rng() * 0.12;
    const parts = [P(GEO.sphereLo, PALETTE.meadowLight, M(0, s * 0.35, 0, { sx: s * 1.4, sy: s * 0.6, sz: s * 1.2 }), false)];
    parts.push(P(GEO.sphereLo, PALETTE.meadow, M(s * 0.7, s * 0.25, s * 0.3, { sx: s * 0.8, sy: s * 0.45, sz: s * 0.7 }), false));
    if (rng() < 0.4) parts.push(P(GEO.bead, PALETTE.crystalTeal, M(-s * 0.3, s * 0.62, 0, { s: 0.03 }), false, { unlit: true }));
    return { parts, radius: 0 };
  }
  // moon rock: a violet boulder with crystal shards growing out of it (or,
  // in the goo, a crusted lump with lime blisters)
  function rockParts(rng, hollow) {
    const s = 0.16 + rng() * 0.22, ry = rng() * 3;
    const color = hollow ? PALETTE.hollowRock : PALETTE.stone;
    const parts = [P(GEO.rock, color, M(0, s * 0.55, 0, { sx: s * 1.3, sy: s * 0.8, sz: s, ry }))];
    if (rng() < 0.6) {
      const a = rng() * 6.28;
      parts.push(P(GEO.rock, hollow ? PALETTE.hollowEarth : PALETTE.stoneDark, M(Math.cos(a) * s * 1.2, s * 0.25, Math.sin(a) * s * 1.1, { sx: s * 0.5, sy: s * 0.38, sz: s * 0.45, ry: a })));
    }
    if (hollow) {
      for (let i = 0; i < 2; i++) parts.push(P(GEO.bead, PALETTE.spore, M((rng() - 0.5) * s, s * 0.9, (rng() - 0.5) * s * 0.6, { s: 0.035 + rng() * 0.02 }), false, { unlit: true }));
    } else if (rng() < 0.55) {
      const col = rng() < 0.5 ? PALETTE.crystal : PALETTE.crystalTeal;
      for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) {
        const a = rng() * 6.28;
        parts.push(P(GEO.cone, col, M(Math.cos(a) * s * 0.35, s * 0.8, Math.sin(a) * s * 0.3, { sx: 0.05 + rng() * 0.03, sy: 0.18 + rng() * 0.14, sz: 0.05, rz: -Math.cos(a) * 0.5, rx: Math.sin(a) * 0.5 })));
      }
    } else {
      parts.push(P(GEO.sphereLo, PALETTE.moss, M(-s * 0.15, s * 1.1, 0, { sx: s * 0.85, sy: s * 0.2, sz: s * 0.7, ry }), false));
    }
    return { parts, radius: s * 1.2 };
  }
  // a crystal outcrop: a cluster of tall faceted shards, one glowing core
  function crystalParts(rng, big) {
    const s = big ? 1 + rng() * 0.5 : 0.5 + rng() * 0.35;
    const col = rng() < 0.55 ? PALETTE.crystal : PALETTE.crystalTeal, tip = lerpColor(col, 0xffffff, 0.35).getHex();
    const parts = [P(GEO.rock, PALETTE.stoneDark, M(0, 0.06 * s, 0, { sx: 0.3 * s, sy: 0.12 * s, sz: 0.26 * s }), false)];
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.28, d = i ? (0.08 + rng() * 0.1) * s : 0, h = (i ? 0.25 + rng() * 0.3 : 0.55) * s, w = (0.06 + rng() * 0.04) * s;
      const tilt = i ? 0.3 + rng() * 0.4 : 0.05;
      parts.push(P(GEO.cylTaper, col, M(Math.cos(a) * d, h * 0.42, Math.sin(a) * d, { sx: w, sy: h * 0.84, sz: w, rz: -Math.cos(a) * tilt, rx: Math.sin(a) * tilt, ry: a })));
      parts.push(P(GEO.cone, tip, M(Math.cos(a) * (d + Math.sin(tilt) * h * 0.86), h * 0.84 + w * 0.8, Math.sin(a) * (d + Math.sin(tilt) * h * 0.86), { sx: w * 0.62, sy: w * 1.8, sz: w * 0.62, rz: -Math.cos(a) * tilt, rx: Math.sin(a) * tilt }), false));
    }
    parts.push(P(GEO.bead, PALETTE.cream, M(0, 0.3 * s, 0.05 * s, { s: 0.05 * s }), false, { unlit: true }));
    return { parts, radius: 0.28 * s, glow: col };
  }
  // an alien bloom: a curling stalk and a five-petal flower in neon colors
  function flowerParts(rng) {
    const h = 0.18 + rng() * 0.12;
    const color = [PALETTE.flowerPink, PALETTE.flowerYellow, PALETTE.crystalTeal][Math.floor(rng() * 3)];
    const parts = [
      P(GEO.cyl, PALETTE.meadowDark, M(0, h / 2, 0, { sx: 0.02, sy: h, sz: 0.02 }), false),
      P(GEO.bead, PALETTE.meadowDark, M(0.05, h * 0.3, 0, { sx: 0.06, sy: 0.015, sz: 0.03, rz: 0.4 }), false),
      P(GEO.bead, PALETTE.meadowDark, M(-0.05, h * 0.5, 0.01, { sx: 0.06, sy: 0.015, sz: 0.03, rz: -0.4 }), false),
    ];
    parts.push(P(GEO.petals, color, M(0, h + 0.03, 0, { s: 0.1, rx: 0.5, ry: rng() * 6 }), false));
    parts.push(P(GEO.bead, PALETTE.cream, M(0, h + 0.045, 0.01, { s: 0.028 }), false, { unlit: true }));
    return { parts, radius: 0 };
  }
  // a seed pod (the colony's crop, ripe and ready)
  function acornParts(rng) {
    const s = 0.14 + rng() * 0.1, tilt = (rng() - 0.5) * 0.6;
    return {
      parts: [
        P(GEO.sphere, PALETTE.straw, M(0, s * 0.9, 0, { sx: s * 0.75, sy: s, sz: s * 0.75, rz: tilt })),
        P(GEO.dome, PALETTE.meadowDark, M(Math.sin(tilt) * -s * 0.4, s * 1.25, 0, { sx: s * 0.7, sy: s * 0.4, sz: s * 0.7, rz: tilt })),
        P(GEO.cyl, PALETTE.meadowDark, M(Math.sin(tilt) * -s * 0.7, s * 1.65, 0, { sx: s * 0.08, sy: s * 0.3, sz: s * 0.08, rz: tilt }), false),
      ], radius: s * 0.8,
    };
  }
  // a crop bale: a round bale of harvested moonwheat with a band
  function hayParts(rng) {
    const s = 0.2 + rng() * 0.1, ry = rng() * 3;
    const parts = [
      P(GEO.cyl, PALETTE.straw, M(0, s, 0, { sx: s, sy: s * 1.3, sz: s, rz: Math.PI / 2, ry })),
      P(GEO.torus, shade(PALETTE.straw, 0.25), M(0, s, 0, { sx: s * 1.01, sy: s * 1.01, sz: s * 0.8, ry: ry + Math.PI / 2 }), false),
      P(GEO.cyl, shade(PALETTE.straw, 0.15), M(Math.cos(ry) * s * 0.66, s, -Math.sin(ry) * s * 0.66, { sx: s * 0.6, sy: 0.01, sz: s * 0.6, rz: Math.PI / 2, ry }), false),
    ];
    return { parts, radius: s * 1.1 };
  }
  // -------- scene construction --------
  function buildGround() {
    const geos = [];
    const rng = srand(7);
    const vt = levelTheme();
    const curvy = !!GameState.currentLevel().curvyRoads;
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
        } else if ((kind === 'path' && !curvy) || kind === 'bridge') {
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
      if (GameState.currentLevel().curvyRoads || GameState.cellKind(c, r) !== 'path' || GameState.isCobble(c, r)) continue;
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
    if (GameState.currentLevel().curvyRoads) { buildCurvyRoad(vt); return; }
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


  // -------- curvy roads (levels with `curvyRoads`) --------
  // The road is a smooth ribbon laid along each route's smoothed polyline:
  // a dark grass lip, the dirt (cobble near the gate, blight-grey in the
  // Hollow), twin wheel ruts, scattered mud and pebbles. All routes go into
  // a few merged meshes. Layers sit at fixed heights and colors depend only
  // on position, so where roads share a tail they overlap invisibly.
  const roadSamples = [];      // every smoothed point of every route, for roadDist
  const roadGrid = new Map();
  function roadKey(x, z) { return Math.floor(x) + ',' + Math.floor(z); }
  function indexRoad() {
    roadSamples.length = 0; roadGrid.clear();
    for (const rt of GameState.routes) {
      const pts = rt.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.15));
        for (let k = 0; k <= n; k++) {
          const p = { x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n };
          roadSamples.push(p);
          const key = roadKey(p.x, p.z);
          if (!roadGrid.has(key)) roadGrid.set(key, []);
          roadGrid.get(key).push(p);
        }
      }
    }
  }
  // distance from a world point to the nearest road centerline (Infinity on
  // levels without curvy roads, or far from any road)
  function roadDist(x, z) {
    if (!GameState.currentLevel().curvyRoads) return Infinity;
    let best = Infinity;
    const cx = Math.floor(x), cz = Math.floor(z);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const list = roadGrid.get((cx + dx) + ',' + (cz + dz));
      if (!list) continue;
      for (const p of list) best = Math.min(best, Math.hypot(p.x - x, p.z - z));
    }
    return best;
  }
  function buildCurvyRoad(vt) {
    indexRoad();
    const lv = GameState.currentLevel();
    const [bc, br] = lv.chokepoint.cell, bx = worldX(bc), bz = worldZ(br);
    const toCell = (x, z) => [x + cols / 2 - 0.5, z + rows / 2 - 0.5];
    const inBridge = (x, z) => Math.abs(x - bx) < 0.62 && Math.abs(z - bz) < 0.62;
    const col = new THREE.Color();
    const dirt = (x, z, len, left, cobbleTail) => {
      const [c, r] = toCell(x, z), h = GameState.zoneFalloff(c, r);
      const n = RendererFX.fbm(x * 2.3 + 11, z * 2.3 + 5);
      if (cobbleTail && left < cobbleTail) col.copy(lerpColor(PALETTE.cobble, PALETTE.cobbleDark, n * 0.6));
      else col.copy(lerpColor(PALETTE.path, PALETTE.hollowPath, h)).lerp(new THREE.Color(0xf6f0ff), 0.55 * (1 - h));
      col.offsetHSL(0, 0, (n - 0.5) * 0.07);
      return col.multiplyScalar(3.2);   // flat ribbons catch less key light than the noise-lit ground
    };
    const lip = (x, z) => { const [c, r] = toCell(x, z); return col.copy(lerpColor(vt.meadowDark, PALETTE.hollowGround, GameState.zoneFalloff(c, r))).multiplyScalar(1.15); };
    const rut = (x, z) => { const [c, r] = toCell(x, z); return col.copy(lerpColor(PALETTE.path, PALETTE.earth, 0.22)).lerp(new THREE.Color(PALETTE.hollowEarth), GameState.zoneFalloff(c, r) * 0.6).multiplyScalar(1.3); };
    const layers = { lip: [], dirt: [], rut: [] };
    const ribbon = (list, pts, lens, total, half, y, offset, colorFn, cobbleTail) => {
      const L = [], R = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let tx = b.x - a.x, tz = b.z - a.z; const m = Math.hypot(tx, tz) || 1; tx /= m; tz /= m;
        const nx = -tz, nz = tx;
        L.push([pts[i].x + nx * (offset + half), pts[i].z + nz * (offset + half)]);
        R.push([pts[i].x + nx * (offset - half), pts[i].z + nz * (offset - half)]);
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2, mz = (pts[i].z + pts[i + 1].z) / 2;
        if (inBridge(mx, mz)) continue;
        const left = total - lens[i];
        const quad = [L[i], R[i], R[i + 1], L[i], R[i + 1], L[i + 1]];
        for (const [qx, qz] of quad) {
          const c = colorFn(qx, qz, lens[i], left, cobbleTail);
          list.push(qx, y, qz, c.r, c.g, c.b);
        }
      }
    };
    for (const rt of GameState.routes) {
      const pts = rt.points, total = rt.length;
      ribbon(layers.lip, pts, rt.lens, total, 0.47, 0.010, 0, lip);
      ribbon(layers.dirt, pts, rt.lens, total, 0.4, 0.014, 0, dirt, lv.cobbleTailCells);
      for (const off of [-0.17, 0.17]) ribbon(layers.rut, pts, rt.lens, total, 0.028, 0.017, off, rut);
    }
    const meshOf = (list, name) => {
      if (!list.length) return null;
      const pos = new Float32Array(list.length / 6 * 3), colr = new Float32Array(list.length / 6 * 3);
      for (let i = 0, v = 0; i < list.length; i += 6, v += 3) { pos[v] = list[i]; pos[v + 1] = list[i + 1]; pos[v + 2] = list[i + 2]; colr[v] = list[i + 3]; colr[v + 1] = list[i + 4]; colr[v + 2] = list[i + 5]; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
      g.computeVertexNormals();
      // triangles may wind either way depending on the side; face them up
      const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
      const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap, vertexColors: true, side: THREE.DoubleSide }));
      m.name = name; m.matrixAutoUpdate = false; scene.add(m);
      return m;
    };
    meshOf(layers.lip, 'roadLip'); meshOf(layers.dirt, 'roadDirt'); meshOf(layers.rut, 'roadRuts');
    // mud, puddles and pebbles along the curve (deterministic, off the bridge)
    const rng = srand(311), geos = [];
    for (const rt of GameState.routes.slice(0, 1).concat(GameState.routes.slice(1))) {
      const pts = rt.points;
      for (let i = 2; i < pts.length - 2; i += 3) {
        const a = pts[i], b = pts[i + 1];
        let tx = b.x - a.x, tz = b.z - a.z; const m = Math.hypot(tx, tz) || 1; tx /= m; tz /= m;
        if (inBridge(a.x, a.z)) continue;
        const [c, r] = toCell(a.x, a.z), h = GameState.zoneFalloff(c, r);
        if (rng() < 0.3) {
          const puddle = rng() < 0.22;
          col.copy(puddle ? lerpColor(PALETTE.streamBed, PALETTE.path, 0.35) : lerpColor(PALETTE.path, PALETTE.earth, 0.42)).lerp(new THREE.Color(PALETTE.hollowPath), h * 0.8);
          const g = GEO.circle.clone().applyMatrix4(M(a.x + (rng() - 0.5) * 0.3, 0.02, a.z + (rng() - 0.5) * 0.3, { sx: puddle ? 0.2 : 0.14 + rng() * 0.14, sy: 1, sz: puddle ? 0.12 : 0.08 + rng() * 0.08, ry: Math.atan2(tx, tz) }));
          const colors = new Float32Array(g.attributes.position.count * 3);
          for (let k = 0; k < g.attributes.position.count; k++) { colors[k * 3] = col.r; colors[k * 3 + 1] = col.g; colors[k * 3 + 2] = col.b; }
          g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.deleteAttribute('uv');
          geos.push(g);
        }
        if (rng() < 0.18) {
          const side = rng() < 0.5 ? -1 : 1, s = 0.03 + rng() * 0.03;
          batchPart(P(GEO.rock, h > 0.5 ? PALETTE.hollowRock : PALETTE.stone, M(a.x - tz * side * (0.46 + rng() * 0.1), s * 0.3, a.z + tx * side * (0.46 + rng() * 0.1), { sx: s * 1.3, sy: s * 0.6, sz: s, ry: rng() * 3 }), false));
        }
      }
    }
    if (geos.length) {
      const mud = new THREE.Mesh(mergeGeoms(geos), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap, vertexColors: true }));
      mud.name = 'roadMud'; mud.matrixAutoUpdate = false; scene.add(mud);
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
          if (roadDist(cx, cz) < 0.62) continue;
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
  // (ox,oy,oz) before scaling: used for arms and fins that swing from a joint.
  function pivotMatrix(px, py, pz, rx, ry, rz, ox, oy, oz, sx, sy, sz, out) {
    out = out || new THREE.Matrix4();
    _e.set(rx, ry, rz);
    out.makeTranslation(px, py, pz)
      .multiply(new THREE.Matrix4().makeRotationFromEuler(_e))
      .multiply(new THREE.Matrix4().makeTranslation(ox, oy, oz))
      .multiply(new THREE.Matrix4().makeScale(sx, sy, sz));
    return out;
  }

  // Every tower stands on the same round landing pad, white plating with a
  // teal ring, hazard chevrons and running lights, so the five read as one
  // colony; the machine on top carries the silhouette.
  const dais = () => {
    const parts = [
      P(GEO.cyl, PALETTE.hullDark, M(0, 0.06, 0, { sx: 0.4, sy: 0.12, sz: 0.4 }), true, { name: 'pad' }),
      P(GEO.cyl, PALETTE.cobble, M(0, 0.125, 0, { sx: 0.35, sy: 0.02, sz: 0.35 }), false),
      P(GEO.ring, PALETTE.tunic, M(0, 0.132, 0, { s: 0.3, rx: Math.PI / 2 }), false),
    ];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.26;
      parts.push(P(GEO.bead, PALETTE.neon, M(Math.cos(a) * 0.395, 0.08, Math.sin(a) * 0.395, { s: 0.024 }), false, { unlit: true }));
    }
    for (const [x, z, ry] of [[0.27, -0.2, 0.9], [-0.27, -0.2, -0.9]]) parts.push(P(GEO.box, PALETTE.hazard, M(x, 0.138, z, { sx: 0.09, sy: 0.01, sz: 0.035, ry }), false));
    return parts;
  };
  // two eyes with a glint, looking along +z from a head at (x, y, z)
  const eyes = (y, z, spread = 0.07, s = 0.028) => [
    P(GEO.bead, PALETTE.outline, M(spread, y, z, { s }), false),
    P(GEO.bead, PALETTE.outline, M(-spread, y, z, { s }), false),
    P(GEO.bead, PALETTE.cream, M(spread + 0.008, y + 0.012, z + 0.02, { s: s * 0.38 }), false),
    P(GEO.bead, PALETTE.cream, M(-spread + 0.008, y + 0.012, z + 0.02, { s: s * 0.38 }), false),
  ];
  // A colonist in a space helmet, facing +z from (x, y, z): a round face
  // framed by a white helmet shell with a teal crest and an orange visor
  // pushed up on the brow, a little antenna light on top. `s` scales it.
  function colonist(x, y, z, s = 1, { name = 'head', knob = 'helmKnob' } = {}) {
    const k = (v) => v * s;
    const at = (dx, dy, dz, o) => M(x + k(dx), y + k(dy), z + k(dz), o);
    return [
      P(GEO.sphere, PALETTE.skin, at(0, 0, 0, { s: k(0.16) }), true, { name }),
      ...eyes(y + k(0.015), z + k(0.15), k(0.055), k(0.024)).map((p) => ({ ...p, m: new THREE.Matrix4().makeTranslation(x, 0, 0).multiply(p.m) })),
      P(GEO.sphereLo, 0xf0a98a, at(0.1, -0.05, 0.11, { sx: k(0.035), sy: k(0.02), sz: k(0.018) }), false),
      P(GEO.sphereLo, 0xf0a98a, at(-0.1, -0.05, 0.11, { sx: k(0.035), sy: k(0.02), sz: k(0.018) }), false),
      P(GEO.box, PALETTE.outline, at(0, -0.07, 0.15, { sx: k(0.05), sy: k(0.011), sz: k(0.01) }), false),
      // the helmet shell, open at the front so the face shows
      P(GEO.sphereMid, PALETTE.hull, at(0, 0.03, -0.045, { sx: k(0.205), sy: k(0.2), sz: k(0.19) }), true),
      P(GEO.torus, PALETTE.hullDark, at(0, 0.0, 0.05, { sx: k(0.19), sy: k(0.2), sz: k(0.24) }), false),
      P(GEO.box, PALETTE.tunic, at(0, 0.2, -0.04, { sx: k(0.05), sy: k(0.05), sz: k(0.28) }), false),
      P(GEO.sphereLo, PALETTE.visor, at(0, 0.14, 0.08, { sx: k(0.16), sy: k(0.045), sz: k(0.08), rx: -0.4 }), false, { unlit: true }),
      P(GEO.cyl, PALETTE.steelDark, at(0.1, 0.27, -0.06, { sx: k(0.008), sy: k(0.14), sz: k(0.008), rz: -0.25 }), false),
      P(GEO.bead, PALETTE.neon, at(0.12, 0.35, -0.06, { s: k(0.022) }), false, { name: knob, live: true, unlit: true }),
    ];
  }

  // Laser Turret: a ball turret on a swivel post, a colonist gunner riding
  // on top and a long barrel wound with purple charging coils. Faces +z.
  // Silhouette: the round head and the long barrel.
  function slingerParts() {
    return [
      ...dais(),
      P(GEO.cylTaper, PALETTE.hullDark, M(0, 0.26, 0, { sx: 0.17, sy: 0.26, sz: 0.17 }), true),
      P(GEO.torus, PALETTE.steel, M(0, 0.38, 0, { s: 0.16, rx: Math.PI / 2 }), false),
      P(GEO.sphereLo, PALETTE.hull, M(0, 0.52, 0, { sx: 0.25, sy: 0.22, sz: 0.25 }), true, { name: 'body' }),
      P(GEO.ring, PALETTE.tunic, M(0, 0.52, 0, { sx: 0.255, sy: 0.255, sz: 0.255, rx: Math.PI / 2 }), false),
      P(GEO.box, PALETTE.hullDark, M(0.24, 0.52, 0.02, { sx: 0.05, sy: 0.16, sz: 0.2 }), false),
      P(GEO.box, PALETTE.hullDark, M(-0.24, 0.52, 0.02, { sx: 0.05, sy: 0.16, sz: 0.2 }), false),
      P(GEO.box, PALETTE.hazard, M(0.268, 0.52, 0.02, { sx: 0.01, sy: 0.04, sz: 0.16 }), false),
      P(GEO.box, PALETTE.hazard, M(-0.268, 0.52, 0.02, { sx: 0.01, sy: 0.04, sz: 0.16 }), false),
      // the gunner sits in a hatch on top
      P(GEO.cyl, PALETTE.steelDark, M(0, 0.72, -0.06, { sx: 0.14, sy: 0.04, sz: 0.14 }), false),
      ...colonist(0, 0.86, -0.04, 0.85),
      // the barrel, its coils and the glowing muzzle
      P(GEO.cyl, PALETTE.steelDark, M(0, 0.5, 0.36, { sx: 0.045, sy: 0.42, sz: 0.045, rx: Math.PI / 2 }), true, { name: 'barrel', live: true }),
      P(GEO.torus, PALETTE.magic, M(0, 0.5, 0.3, { s: 0.065 }), false, { name: 'coil', live: true, unlit: true }),
      P(GEO.torus, PALETTE.magic, M(0, 0.5, 0.42, { s: 0.06 }), false, { name: 'coil2', live: true, unlit: true }),
      P(GEO.sphereLo, PALETTE.capRed, M(0, 0.5, 0.58, { s: 0.045 }), false, { name: 'muzzle', live: true, unlit: true }),
      // a little sensor dish on the side
      P(GEO.cyl, PALETTE.steel, M(0.18, 0.72, -0.12, { sx: 0.012, sy: 0.16, sz: 0.012 }), false),
      P(GEO.cylTaper, PALETTE.hull, M(0.18, 0.82, -0.12, { sx: 0.07, sy: 0.03, sz: 0.07, rx: 0.5 }), true, { name: 'dish', live: true }),
    ];
  }

  // Goo Cannon: a squat tracked mortar with a tank of glowing goo on its
  // back, a driver peeking out of the hatch and a stubby barrel loaded with
  // a ball of goo. Faces +z. Silhouette: the low treads and the goo tank.
  function wardenParts() {
    const gm = PALETTE.habit;
    const parts = [
      ...dais(),
      // treads with their road wheels
      P(GEO.box, PALETTE.steelDark, M(0.2, 0.22, 0, { sx: 0.12, sy: 0.14, sz: 0.5 }), true),
      P(GEO.box, PALETTE.steelDark, M(-0.2, 0.22, 0, { sx: 0.12, sy: 0.14, sz: 0.5 }), true),
      ...[-0.16, 0, 0.16].flatMap((z) => [0.265, -0.265].map((x) => P(GEO.cyl, PALETTE.outline, M(x, 0.21, z, { sx: 0.05, sy: 0.02, sz: 0.05, rz: Math.PI / 2 }), false))),
      // the hull
      P(GEO.sphereLo, gm, M(0, 0.36, 0, { sx: 0.27, sy: 0.16, sz: 0.3 }), true, { name: 'body' }),
      P(GEO.box, PALETTE.hazard, M(0, 0.38, 0.27, { sx: 0.3, sy: 0.04, sz: 0.04 }), false),
      // the goo tank on the back: a glass drum, glowing goo inside, bubbles on top
      P(GEO.cyl, PALETTE.steel, M(0, 0.55, -0.17, { sx: 0.15, sy: 0.32, sz: 0.15 }), true),
      P(GEO.cyl, PALETTE.goo, M(0, 0.52, -0.032, { sx: 0.11, sy: 0.24, sz: 0.02 }), false, { unlit: true }),
      P(GEO.torus, PALETTE.steelDark, M(0, 0.7, -0.17, { s: 0.15, rx: Math.PI / 2 }), false),
      P(GEO.cyl, PALETTE.goo, M(0, 0.715, -0.17, { sx: 0.12, sy: 0.02, sz: 0.12 }), false, { name: 'brew', live: true, unlit: true }),
      P(GEO.cone, PALETTE.goo, M(0.16, 0.35, -0.2, { sx: 0.035, sy: 0.08, sz: 0.035, rx: Math.PI }), false, { name: 'flame', live: true, unlit: true }),
      P(GEO.cyl, PALETTE.steelDark, M(0.13, 0.42, -0.2, { sx: 0.02, sy: 0.1, sz: 0.02 }), false),
      // the driver's hatch
      P(GEO.cyl, PALETTE.steelDark, M(-0.12, 0.5, 0.06, { sx: 0.1, sy: 0.04, sz: 0.1 }), false),
      ...colonist(-0.12, 0.62, 0.07, 0.72),
      // the mortar: a fat barrel tilted up and forward with its goo ball
      P(GEO.cylTaper, gm, M(0.1, 0.6, 0.14, { sx: 0.075, sy: 0.38, sz: 0.075, rx: 0.65 }), true, { name: 'staff', live: true }),
      P(GEO.sphereLo, PALETTE.goo, M(0.1, 0.76, 0.27, { s: 0.09 }), true, { name: 'thornBall', live: true }),
      P(GEO.torus, PALETTE.steelDark, M(0.1, 0.74, 0.25, { s: 0.08, rx: Math.PI / 2 + 0.65 }), false, { name: 'thorn1', live: true }),
      P(GEO.cone, PALETTE.goo, M(0.1, 0.66, 0.34, { sx: 0.03, sy: 0.08, sz: 0.03, rx: Math.PI }), false, { name: 'thorn2', live: true, unlit: true }),
    ];
    return parts;
  }

  // Cryo Beam: a slim refrigerated column on three legs, frosted cooling
  // rings up its length and an emitter dish on top with a floating orb of
  // frost. Faces +z. Silhouette: tall and thin, the dish and the orb.
  function druidParts() {
    const parts = [
      ...dais(),
      P(GEO.cyl, PALETTE.frost, M(0, 0.14, 0, { sx: 0.3, sy: 0.012, sz: 0.3 }), false, { name: 'padFrost' }),
      P(GEO.cyl, PALETTE.hull, M(0, 0.58, 0, { sx: 0.11, sy: 0.9, sz: 0.11 }), true, { name: 'body' }),
      P(GEO.cylTaper, PALETTE.hullDark, M(0, 0.26, 0, { sx: 0.2, sy: 0.22, sz: 0.2 }), true),
      // the cryo tank strapped to the column
      P(GEO.sphereLo, PALETTE.frostRobe, M(-0.15, 0.42, -0.08, { sx: 0.1, sy: 0.16, sz: 0.1 }), true),
      P(GEO.ring, PALETTE.steelDark, M(-0.15, 0.42, -0.08, { s: 0.1, rx: Math.PI / 2 }), false),
      P(GEO.box, PALETTE.tunic, M(-0.15, 0.48, 0.02, { sx: 0.06, sy: 0.05, sz: 0.01 }), false),
      // the emitter dish, and three purple prongs focusing the frost
      P(GEO.cylTaper, PALETTE.steel, M(0, 1.06, 0.06, { sx: 0.2, sy: 0.07, sz: 0.2, rx: Math.PI / 2 - 0.35 }), true, { name: 'dish', live: true }),
      ...[0, 1, 2].map((i) => { const a = i * 2.09 + 0.5; return P(GEO.cone, PALETTE.magic, M(Math.cos(a) * 0.09, 1.1 + Math.sin(a) * 0.09, 0.2, { sx: 0.02, sy: 0.14, sz: 0.02, rx: Math.PI / 2 - 0.35 }), false, { unlit: true }); }),
      P(GEO.sphereLo, PALETTE.frost, M(0, 1.14, 0.34, { s: 0.1 }), false, { name: 'orb', live: true, unlit: true }),
      P(GEO.sphereLo, PALETTE.cream, M(0, 1.14, 0.34, { s: 0.05 }), false, { name: 'orbCore', live: true, unlit: true }),
      // frost forming on the base
      P(GEO.cone, PALETTE.frost, M(-0.24, 0.2, 0.2, { sx: 0.03, sy: 0.1, sz: 0.03, rz: 0.3 }), false),
      P(GEO.cone, PALETTE.frost, M(0.2, 0.18, -0.22, { sx: 0.03, sy: 0.09, sz: 0.03, rx: -0.3 }), false),
    ];
    // the three legs
    for (let i = 0; i < 3; i++) {
      const a = i * 2.09 + 0.3;
      parts.push(P(GEO.cyl, PALETTE.steelDark, M(Math.cos(a) * 0.2, 0.26, Math.sin(a) * 0.2, { sx: 0.025, sy: 0.32, sz: 0.025, rz: -Math.cos(a) * 0.45, rx: Math.sin(a) * 0.45 }), false));
    }
    // the frosted cooling rings, glowing faintly
    for (const y of [0.52, 0.7, 0.88]) parts.push(P(GEO.torus, PALETTE.frost, M(0, y, 0, { s: 0.13, rx: Math.PI / 2 }), false, { unlit: true }));
    return parts;
  }

  // Mech Walker: a stubby two-legged mech with a colonist in the open
  // cockpit, a blaster on the left arm and one huge piston fist on the
  // right that it fires down the road as a rocket. Faces +z. Silhouette:
  // the wide shoulders, the legs and the fist.
  // The fist and its piston swing as one piece from the right shoulder;
  // fistPose() places them for any swing angle (1.2 is the ready stance).
  const FIST_PIVOT = [-0.3, 0.66, 0.04];
  const FIST_POSE = {
    piston: [0, 0.17, 0, 0.055, 0.34, 0.055],
    fist: [0, 0.4, 0, 0.18, 0.16, 0.17],
    knuckle: [0, 0.49, 0.0, 0.19, 0.05, 0.12],
    thumb: [0.1, 0.36, 0.0, 0.05, 0.1, 0.06],
  };
  function fistPose(name, angle, out) {
    const [ox, oy, oz, sx, sy, sz] = FIST_POSE[name];
    return pivotMatrix(FIST_PIVOT[0], FIST_PIVOT[1], FIST_PIVOT[2], angle, 0, 0, ox, oy, oz, sx, sy, sz, out);
  }
  function golemParts() {
    const h = PALETTE.hull, hd = PALETTE.hullDark;
    return [
      ...dais(),
      // legs: thigh, shin, a wide foot with hazard toes
      ...[0.12, -0.12].flatMap((x) => [
        P(GEO.cyl, PALETTE.steelDark, M(x, 0.34, -0.02, { sx: 0.05, sy: 0.16, sz: 0.05, rx: 0.3 }), false),
        P(GEO.box, hd, M(x, 0.24, 0.02, { sx: 0.1, sy: 0.18, sz: 0.11 }), true),
        P(GEO.box, hd, M(x, 0.155, 0.06, { sx: 0.14, sy: 0.05, sz: 0.2 }), true),
        P(GEO.box, PALETTE.hazard, M(x, 0.155, 0.165, { sx: 0.14, sy: 0.03, sz: 0.01 }), false),
      ]),
      // the body: a rounded box with hazard stripes, exhaust stacks behind
      P(GEO.sphereLo, h, M(0, 0.54, -0.01, { sx: 0.28, sy: 0.2, sz: 0.24 }), true, { name: 'body' }),
      P(GEO.box, hd, M(0, 0.46, 0.18, { sx: 0.3, sy: 0.08, sz: 0.06 }), false),
      ...[-0.1, 0, 0.1].map((x) => P(GEO.box, PALETTE.hazard, M(x, 0.46, 0.215, { sx: 0.045, sy: 0.07, sz: 0.01, rz: 0.6 }), false)),
      P(GEO.cyl, PALETTE.steelDark, M(0.1, 0.72, -0.2, { sx: 0.035, sy: 0.2, sz: 0.035 }), false),
      P(GEO.cyl, PALETTE.steelDark, M(-0.02, 0.7, -0.22, { sx: 0.03, sy: 0.16, sz: 0.03 }), false),
      P(GEO.bead, PALETTE.ember, M(0.1, 0.83, -0.2, { s: 0.03 }), false, { unlit: true }),
      // shoulders
      P(GEO.box, h, M(0.27, 0.66, 0, { sx: 0.13, sy: 0.12, sz: 0.16 }), true, { name: 'shoulders', live: true }),
      P(GEO.box, h, M(-0.27, 0.66, 0, { sx: 0.13, sy: 0.12, sz: 0.16 }), true, { name: 'shoulders2', live: true }),
      P(GEO.bead, PALETTE.neon, M(0.27, 0.73, 0.08, { s: 0.022 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.neon, M(-0.27, 0.73, 0.08, { s: 0.022 }), false, { unlit: true }),
      // the open cockpit and its pilot
      P(GEO.cyl, hd, M(0, 0.72, 0.02, { sx: 0.15, sy: 0.06, sz: 0.14 }), false),
      ...colonist(0, 0.86, 0.04, 0.85),
      P(GEO.box, PALETTE.glass, M(0, 0.82, 0.17, { sx: 0.2, sy: 0.1, sz: 0.02, rx: -0.3 }), false, { unlit: true }),
      P(GEO.cyl, PALETTE.steel, M(0.12, 1.08, -0.08, { sx: 0.01, sy: 0.2, sz: 0.01 }), false, { name: 'crest', live: true }),
      // the left arm and its little blaster
      P(GEO.cyl, PALETTE.steelDark, M(0.32, 0.52, 0.1, { sx: 0.05, sy: 0.22, sz: 0.05, rx: 0.9 }), true, { name: 'armL', live: true }),
      P(GEO.box, hd, M(0.32, 0.46, 0.24, { sx: 0.07, sy: 0.07, sz: 0.16 }), true, { name: 'armR', live: true }),
      // the piston fist on the right
      P(GEO.cyl, PALETTE.steelDark, fistPose('piston', 1.2), true, { name: 'piston', live: true }),
      P(GEO.box, PALETTE.hazard, fistPose('fist', 1.2), true, { name: 'fist', live: true }),
      P(GEO.box, hd, fistPose('knuckle', 1.2), false, { name: 'knuckle', live: true }),
      P(GEO.box, hd, fistPose('thumb', 1.2), false, { name: 'thumb', live: true }),
    ];
  }

  // Missile Pod: a boxy four-tube launcher tilted at the sky on a turret,
  // its crew of one beside it in a headset, and a radar dish turning on a
  // mast. Faces +z. Silhouette: the tilted box and the dish.
  // where missile i's nose sits when the launcher is tipped `tilt` past its rest angle
  const POD_TUBES = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  function podTip(i, tilt, out) {
    const [u, v] = POD_TUBES[i];
    return (out || new THREE.Matrix4()).makeTranslation(0.05, 0.58, 0.02).multiply(new THREE.Matrix4().makeRotationX(-0.55 + tilt))
      .multiply(new THREE.Matrix4().makeTranslation(u * 0.075, v * 0.065, 0.22)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
      .multiply(new THREE.Matrix4().makeScale(0.045, 0.09, 0.045));
  }
  function artilleryParts() {
    const c = PALETTE.cloak, cd = PALETTE.cloakDark;
    const pod = (x, y, z, o) => M(x, y, z, { rx: -0.55, ...o });
    return [
      ...dais(),
      P(GEO.cylTaper, PALETTE.hullDark, M(0.05, 0.25, 0, { sx: 0.2, sy: 0.24, sz: 0.2 }), true),
      P(GEO.torus, PALETTE.steel, M(0.05, 0.37, 0, { s: 0.18, rx: Math.PI / 2 }), false),
      // the launcher box, its tube mouths and four missile tips
      P(GEO.box, PALETTE.hull, pod(0.05, 0.58, 0.02, { sx: 0.34, sy: 0.28, sz: 0.4 }), true, { name: 'pod', live: true }),
      P(GEO.box, PALETTE.hazard, pod(0.225, 0.58, 0.02, { sx: 0.01, sy: 0.06, sz: 0.34 }), false),
      P(GEO.box, PALETTE.hazard, pod(-0.125, 0.58, 0.02, { sx: 0.01, sy: 0.06, sz: 0.34 }), false),
      ...[0, 1, 2, 3].map((i) => P(GEO.cone, PALETTE.capRed, podTip(i, 0), false, { name: `m${i}`, live: true })),
      // the crewman, sitting at the controls with a headset on
      P(GEO.sphereLo, c, M(-0.25, 0.32, -0.08, { sx: 0.13, sy: 0.15, sz: 0.12 }), true),
      P(GEO.box, PALETTE.steelDark, M(-0.2, 0.38, 0.06, { sx: 0.1, sy: 0.08, sz: 0.06, rx: -0.4 }), false),
      P(GEO.bead, PALETTE.neon, M(-0.2, 0.41, 0.09, { s: 0.015 }), false, { unlit: true }),
      ...colonist(-0.25, 0.56, -0.06, 0.72, { name: 'hood', knob: 'feather' }),
      P(GEO.sphereLo, cd, M(-0.12, 0.3, 0.02, { s: 0.05 }), true),
      // the radar mast and its dish
      P(GEO.cyl, PALETTE.steel, M(0.24, 0.6, -0.24, { sx: 0.015, sy: 0.7, sz: 0.015 }), false),
      P(GEO.cylTaper, PALETTE.hull, M(0.24, 0.98, -0.24, { sx: 0.11, sy: 0.04, sz: 0.11, rx: 0.9 }), true, { name: 'radar', live: true }),
    ];
  }

  // Tier dressing: what an upgraded tower wears so its tier reads at a glance.
  // Specialization dressing: a tier-3 tower wears its branch so the choice
  // reads by shape, not just color. All merged into the tower's mesh.
  const ring5 = (n, r, y, fn) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return fn(Math.cos(a) * r, y, Math.sin(a) * r, a, i); });
  const BRANCH_PARTS = {
    // Railgun: two long rails beside the barrel, a scope and a red aiming beam
    marksman: () => [
      P(GEO.box, PALETTE.steelDark, M(0.07, 0.5, 0.42, { sx: 0.025, sy: 0.04, sz: 0.62 })),
      P(GEO.box, PALETTE.steelDark, M(-0.07, 0.5, 0.42, { sx: 0.025, sy: 0.04, sz: 0.62 })),
      P(GEO.box, PALETTE.magic, M(0.07, 0.52, 0.42, { sx: 0.01, sy: 0.01, sz: 0.58 }), false, { unlit: true }),
      P(GEO.box, PALETTE.magic, M(-0.07, 0.52, 0.42, { sx: 0.01, sy: 0.01, sz: 0.58 }), false, { unlit: true }),
      P(GEO.cyl, PALETTE.steelDark, M(0.14, 0.66, 0.12, { sx: 0.035, sy: 0.18, sz: 0.035, rx: Math.PI / 2 })),
      P(GEO.box, PALETTE.capRed, M(0, 0.5, 0.9, { sx: 0.008, sy: 0.008, sz: 0.5 }), false, { unlit: true }),
    ],
    // Twin Blaster: a second barrel slung under the first, and heat fins
    bloom: () => [
      P(GEO.cyl, PALETTE.steelDark, M(0, 0.4, 0.32, { sx: 0.04, sy: 0.36, sz: 0.04, rx: Math.PI / 2 })),
      P(GEO.sphereLo, PALETTE.capRed, M(0, 0.4, 0.51, { s: 0.035 }), false, { unlit: true }),
      ...[-0.06, 0, 0.06].map((z) => P(GEO.box, PALETTE.gold, M(0.27, 0.62, z, { sx: 0.06, sy: 0.12, sz: 0.012 }), false)),
      ...[-0.06, 0, 0.06].map((z) => P(GEO.box, PALETTE.gold, M(-0.27, 0.62, z, { sx: 0.06, sy: 0.12, sz: 0.012 }), false)),
    ],
    // Glue Bomber: a second fat goo tank strapped on and a goo puddle round the pad
    thicket: () => [
      P(GEO.cyl, PALETTE.steel, M(0.28, 0.42, -0.2, { sx: 0.11, sy: 0.3, sz: 0.11 })),
      P(GEO.cyl, PALETTE.goo, M(0.28, 0.42, -0.088, { sx: 0.08, sy: 0.22, sz: 0.02 }), false, { unlit: true }),
      P(GEO.torus, PALETTE.steelDark, M(0.28, 0.57, -0.2, { s: 0.11, rx: Math.PI / 2 }), false),
      P(GEO.torus, PALETTE.goo, M(0, 0.04, 0, { sx: 0.48, sy: 0.48, sz: 0.2, rx: Math.PI / 2 }), false, { unlit: true }),
    ],
    // Acid Mortar: three fizzing acid canisters round the pad and a vent stack
    briarstorm: () => [
      ...ring5(3, 0.33, 0.24, (x, y, z, a, i) => P(GEO.cyl, PALETTE.hazard, M(x, y, z + (i === 0 ? -0.08 : 0), { sx: 0.05, sy: 0.18, sz: 0.05 }))),
      ...ring5(3, 0.33, 0.35, (x, y, z, a, i) => P(GEO.sphereLo, PALETTE.spore, M(x, y, z + (i === 0 ? -0.08 : 0), { s: 0.045 }), false, { unlit: true })),
      P(GEO.cyl, PALETTE.steelDark, M(-0.22, 0.6, -0.2, { sx: 0.035, sy: 0.3, sz: 0.035 })),
      P(GEO.bead, PALETTE.spore, M(-0.22, 0.77, -0.2, { s: 0.04 }), false, { unlit: true }),
    ],
    // Blizzard Array: a ring of frost with icicles, and a second little dish
    hoarfrost: () => [
      P(GEO.torus, PALETTE.frost, M(0, 0.1, 0, { s: 0.46, rx: Math.PI / 2 }), false),
      ...ring5(6, 0.44, 0.14, (x, y, z, a) => P(GEO.cone, PALETTE.frost, M(x, y, z, { sx: 0.04, sy: 0.18, sz: 0.04, rz: -Math.cos(a) * 0.4, rx: Math.sin(a) * 0.4 }))),
      P(GEO.cylTaper, PALETTE.steel, M(0.14, 0.82, 0.04, { sx: 0.1, sy: 0.04, sz: 0.1, rx: Math.PI / 2 - 0.5 })),
    ],
    // Ice Lance: a long ice spear above the dish and a crown of ice shards
    seer: () => [
      P(GEO.cone, PALETTE.ice, M(0, 1.34, 0.08, { sx: 0.05, sy: 0.4, sz: 0.05 })),
      ...ring5(5, 0.13, 0.96, (x, y, z, a) => P(GEO.cone, PALETTE.frost, M(x, y, z, { sx: 0.03, sy: 0.14, sz: 0.03, rz: -Math.cos(a) * 0.5, rx: Math.sin(a) * 0.5 }), false, { unlit: true })),
      P(GEO.petals, PALETTE.frost, M(0, 0.3, 0.2, { s: 0.12, rx: Math.PI / 2 }), false, { unlit: true }),
    ],
    // Quake Stomper: cracked rock spurs round the pad and shock pistons on the legs
    earthshaker: () => [
      ...ring5(6, 0.46, 0.06, (x, y, z, a, i) => P(GEO.rock, i % 2 ? PALETTE.stoneDark : PALETTE.stone, M(x, y, z, { sx: 0.1, sy: 0.14 + (i % 3) * 0.03, sz: 0.1, ry: a }))),
      P(GEO.cyl, PALETTE.gold, M(0.19, 0.28, -0.04, { sx: 0.025, sy: 0.22, sz: 0.025, rz: 0.3 }), false),
      P(GEO.cyl, PALETTE.gold, M(-0.19, 0.28, -0.04, { sx: 0.025, sy: 0.22, sz: 0.025, rz: -0.3 }), false),
    ],
    // Hull Breaker: spiked shoulders and gold armor plates
    mountainheart: () => [
      P(GEO.cone, PALETTE.steelDark, M(0.3, 0.76, 0, { sx: 0.04, sy: 0.16, sz: 0.04, rz: -0.4 })),
      P(GEO.cone, PALETTE.steelDark, M(-0.3, 0.76, 0, { sx: 0.04, sy: 0.16, sz: 0.04, rz: 0.4 })),
      P(GEO.cone, PALETTE.steelDark, M(0.34, 0.7, 0.1, { sx: 0.035, sy: 0.12, sz: 0.035, rz: -0.9 })),
      P(GEO.cone, PALETTE.steelDark, M(-0.34, 0.7, 0.1, { sx: 0.035, sy: 0.12, sz: 0.035, rz: 0.9 })),
      P(GEO.box, PALETTE.gold, M(0, 0.58, 0.22, { sx: 0.2, sy: 0.12, sz: 0.02 }), false),
    ],
    // Big Boomer: one fat warhead waiting on a rack beside the pod
    oakfall: () => [
      P(GEO.box, PALETTE.steelDark, M(0.32, 0.18, 0.12, { sx: 0.12, sy: 0.06, sz: 0.36 })),
      P(GEO.cyl, PALETTE.hull, M(0.32, 0.3, 0.1, { sx: 0.08, sy: 0.28, sz: 0.08, rx: Math.PI / 2 })),
      P(GEO.cone, PALETTE.capRed, M(0.32, 0.3, 0.31, { sx: 0.08, sy: 0.14, sz: 0.08, rx: Math.PI / 2 })),
      P(GEO.ring, PALETTE.hazard, M(0.32, 0.3, 0.04, { s: 0.085 }), false),
    ],
    // Swarm Rockets: two small rocket racks bolted on either side
    squirrel: () => [
      ...[0.28, -0.18].flatMap((x) => [
        P(GEO.box, PALETTE.hullDark, M(x, 0.62, 0.0, { sx: 0.08, sy: 0.12, sz: 0.26, rx: -0.55 })),
        ...[0, 1, 2].map((i) => P(GEO.cone, PALETTE.capRed, new THREE.Matrix4().makeTranslation(x, 0.62, 0).multiply(new THREE.Matrix4().makeRotationX(-0.55)).multiply(new THREE.Matrix4().makeTranslation(0, (i - 1) * 0.035, 0.15)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).multiply(new THREE.Matrix4().makeScale(0.02, 0.05, 0.02)), false)),
      ]),
    ],
  };
  const BRANCH_PENNANT = { marksman: PALETTE.magic, bloom: PALETTE.gold, thicket: PALETTE.goo, briarstorm: PALETTE.spore,
    hoarfrost: PALETTE.frost, seer: PALETTE.ice, earthshaker: PALETTE.flowerYellow, mountainheart: PALETTE.steelDark, oakfall: PALETTE.capRed, squirrel: PALETTE.hazard };
  // Tier-2 dressing, one per tower: each upgrade changes the silhouette in
  // that machine's own way, so the step from tier 1 to 2 reads at a glance.
  const TIER2_PARTS = {
    // armor cheek plates, a second coil and a scanner light on the hatch
    slinger: () => [
      P(GEO.box, PALETTE.tunic, M(0.27, 0.6, -0.02, { sx: 0.04, sy: 0.06, sz: 0.22 }), false),
      P(GEO.box, PALETTE.tunic, M(-0.27, 0.6, -0.02, { sx: 0.04, sy: 0.06, sz: 0.22 }), false),
      P(GEO.cyl, PALETTE.gold, M(0, 0.745, -0.06, { sx: 0.145, sy: 0.012, sz: 0.145 }), false),
      P(GEO.bead, PALETTE.capRed, M(-0.15, 0.74, -0.14, { s: 0.03 }), false, { unlit: true }),
    ],
    // a spare goo canister and track skirts
    warden: () => [
      P(GEO.cyl, PALETTE.steel, M(-0.26, 0.3, -0.18, { sx: 0.06, sy: 0.16, sz: 0.06 }), true),
      P(GEO.bead, PALETTE.goo, M(-0.26, 0.4, -0.18, { s: 0.035 }), false, { unlit: true }),
      P(GEO.box, PALETTE.tunic, M(0.27, 0.3, 0, { sx: 0.02, sy: 0.06, sz: 0.46 }), false),
      P(GEO.box, PALETTE.tunic, M(-0.27, 0.3, 0, { sx: 0.02, sy: 0.06, sz: 0.46 }), false),
    ],
    // a gold collar, a fourth cooling ring and floating frost shards
    druid: () => [
      P(GEO.torus, PALETTE.gold, M(0, 0.98, 0, { s: 0.125, rx: Math.PI / 2 }), false),
      P(GEO.torus, PALETTE.frost, M(0, 0.34, 0, { s: 0.15, rx: Math.PI / 2 }), false, { unlit: true }),
      ...ring5(3, 0.34, 0.6, (x, y, z, a, i) => P(GEO.box, PALETTE.frost, M(x, y + i * 0.08, z, { s: 0.05, ry: a, rz: 0.7 }), false, { unlit: true })),
    ],
    // shoulder searchlights and a gold stripe down the chest
    golem: () => [
      P(GEO.cyl, PALETTE.steel, M(0.27, 0.76, 0.04, { sx: 0.05, sy: 0.06, sz: 0.05, rx: Math.PI / 2 })),
      P(GEO.bead, PALETTE.windowWarm, M(0.27, 0.76, 0.08, { s: 0.035 }), false, { unlit: true }),
      P(GEO.box, PALETTE.gold, M(0, 0.6, 0.235, { sx: 0.05, sy: 0.12, sz: 0.01 }), false),
    ],
    // an ammo crate and a gold rim on the launcher
    artillery: () => [
      P(GEO.box, PALETTE.hazard, M(0.3, 0.2, -0.18, { sx: 0.14, sy: 0.12, sz: 0.12, ry: 0.4 }), true),
      P(GEO.box, PALETTE.outline, M(0.3, 0.2, -0.18, { sx: 0.145, sy: 0.02, sz: 0.125, ry: 0.4 }), false),
      P(GEO.box, PALETTE.gold, M(0.05, 0.74, -0.08, { sx: 0.36, sy: 0.02, sz: 0.04, rx: -0.55 }), false),
    ],
  };

  function tierParts(tier, branch, type) {
    const parts = [];
    if (tier >= 2) {
      parts.push(P(GEO.torus, PALETTE.steel, M(0, 0.05, 0, { sx: 0.42, sy: 0.42, sz: 0.42, rx: Math.PI / 2 }), true, { name: 'tierRing' }));
      parts.push(P(GEO.cyl, PALETTE.steel, M(-0.36, 0.42, -0.3, { sx: 0.018, sy: 0.7, sz: 0.018 }), false, { name: 'pennantPole' }));
      parts.push(P(GEO.box, PALETTE.tunic, M(-0.3, 0.68, -0.3, { sx: 0.14, sy: 0.1, sz: 0.01 }), false, { name: 'pennant', live: true, unlit: true }));
      if (TIER2_PARTS[type]) parts.push(...TIER2_PARTS[type]());
    }
    if (tier >= 3) {
      parts.push(P(GEO.torus, PALETTE.gold, M(0, 0.06, 0, { sx: 0.46, sy: 0.46, sz: 0.46, rx: Math.PI / 2 }), false, { name: 'tierRingGold', unlit: true }));
      parts.push(P(GEO.cyl, PALETTE.steel, M(0.36, 0.42, -0.3, { sx: 0.018, sy: 0.7, sz: 0.018 }), false));
      parts.push(P(GEO.box, BRANCH_PENNANT[branch] ?? PALETTE.magic, M(0.42, 0.68, -0.3, { sx: 0.14, sy: 0.1, sz: 0.01 }), false, { name: 'pennant2', live: true, unlit: true }));
      if (BRANCH_PARTS[branch]) parts.push(...BRANCH_PARTS[branch]());
    }
    return parts;
  }

  const TOWER_RECIPES = { slinger: slingerParts, warden: wardenParts, druid: druidParts, golem: golemParts, artillery: artilleryParts };

  // Saucer Scout: a little flying saucer, a bubble dome with a goggle-eyed
  // pilot inside, rim lights and two wobbling stabilizer fins. Flies at
  // height. Silhouette: the disc and the dome. Limbs: 1/2 fins.
  function batParts() {
    const body = PALETTE.bat, dark = PALETTE.batDark;
    const parts = [
      P(GEO.sphereLo, body, M(0, 0, 0, { sx: 0.3, sy: 0.07, sz: 0.3 }), true, { name: 'body' }),
      P(GEO.sphereLo, dark, M(0, -0.05, 0, { sx: 0.18, sy: 0.06, sz: 0.18 }), false),
      P(GEO.ring, dark, M(0, 0.0, 0, { s: 0.29, rx: Math.PI / 2 }), false),
      // the dome and the pilot: a lime head, one big eye looking ahead
      P(GEO.dome, PALETTE.glass, M(0, 0.045, 0, { sx: 0.15, sy: 0.14, sz: 0.15 }), true),
      P(GEO.sphereLo, PALETTE.goblin, M(0, 0.1, 0.02, { s: 0.075 }), false),
      P(GEO.sphereLo, PALETTE.cream, M(0, 0.12, 0.08, { s: 0.04 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.outline, M(0, 0.12, 0.115, { s: 0.018 }), false, { unlit: true }),
      P(GEO.cyl, PALETTE.goblinDark, M(0, 0.2, 0, { sx: 0.006, sy: 0.08, sz: 0.006 }), false),
      P(GEO.bead, PALETTE.spore, M(0, 0.24, 0, { s: 0.02 }), false, { unlit: true }),
      // stabilizer fins on the back
      P(GEO.box, PALETTE.capRed, pivotMatrix(0.08, 0.02, -0.2, 0, 0, 0, 0.05, 0.05, 0, 0.1, 0.1, 0.012), true, { limb: 1 }),
      P(GEO.box, PALETTE.capRed, pivotMatrix(-0.08, 0.02, -0.2, 0, 0, 0, -0.05, 0.05, 0, 0.1, 0.1, 0.012), true, { limb: 2 }),
    ];
    // the rim lights
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push(P(GEO.bead, i % 2 ? PALETTE.neon : PALETTE.spore, M(Math.cos(a) * 0.27, 0.0, Math.sin(a) * 0.27, { s: 0.026 }), false, { unlit: true }));
    }
    return parts;
  }

  // Blob Drone: a wobbly lime blob with one huge eye, a toothy grin, an
  // antenna with a glowing bulb, stubby arms and a toy-sized ray gun.
  // Faces +z. Silhouette: the round blob and the bobbing antenna.
  // Limbs: 1 free arm, 2 gun arm, 3/4 feet, 5 antenna.
  function gruntParts() {
    const g = PALETTE.goblin, gd = PALETTE.goblinDark;
    const gun = (ox, oy, oz, sx, sy, sz) => pivotMatrix(-0.22, 0.3, 0.06, 0.8, 0, 0.2, ox, oy, oz, sx, sy, sz);
    return [
      P(GEO.sphereLo, gd, M(0.1, 0.05, 0.03, { sx: 0.08, sy: 0.05, sz: 0.1 }), true, { limb: 3 }),
      P(GEO.sphereLo, gd, M(-0.1, 0.05, 0.03, { sx: 0.08, sy: 0.05, sz: 0.1 }), true, { limb: 4 }),
      P(GEO.sphere, g, M(0, 0.32, 0, { sx: 0.25, sy: 0.27, sz: 0.24 }), true, { name: 'body' }),
      P(GEO.sphereLo, PALETTE.meadowLight, M(-0.08, 0.44, -0.06, { sx: 0.08, sy: 0.06, sz: 0.06 }), false, { unlit: true }),
      P(GEO.bead, gd, M(0.12, 0.2, 0.18, { s: 0.03 }), false),
      P(GEO.bead, gd, M(-0.15, 0.26, 0.16, { s: 0.025 }), false),
      // the big eye, its pupil and a glint
      P(GEO.sphereLo, PALETTE.cream, M(0, 0.4, 0.17, { sx: 0.12, sy: 0.12, sz: 0.08 }), true, { name: 'head' }),
      P(GEO.sphereLo, PALETTE.capBrown, M(0, 0.4, 0.235, { s: 0.055 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.outline, M(0, 0.4, 0.27, { s: 0.03 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.cream, M(0.02, 0.425, 0.285, { s: 0.012 }), false, { unlit: true }),
      P(GEO.box, gd, M(0, 0.52, 0.16, { sx: 0.16, sy: 0.025, sz: 0.04, rz: 0.15 }), false),
      // a toothy grin
      P(GEO.sphereLo, PALETTE.outline, M(0, 0.23, 0.2, { sx: 0.12, sy: 0.035, sz: 0.05 }), false, { unlit: true }),
      P(GEO.box, PALETTE.cream, M(0.035, 0.245, 0.235, { sx: 0.025, sy: 0.022, sz: 0.01 }), false, { unlit: true }),
      P(GEO.box, PALETTE.cream, M(-0.035, 0.245, 0.235, { sx: 0.025, sy: 0.022, sz: 0.01 }), false, { unlit: true }),
      // the antenna
      P(GEO.cyl, gd, M(0, 0.68, -0.02, { sx: 0.012, sy: 0.14, sz: 0.012 }), false, { limb: 5 }),
      P(GEO.sphereLo, PALETTE.spore, M(0, 0.77, -0.02, { s: 0.045 }), false, { limb: 5, unlit: true }),
      // arms and the ray gun
      P(GEO.sphereLo, g, M(0.24, 0.3, 0.06, { s: 0.06 }), true, { limb: 1 }),
      P(GEO.sphereLo, g, M(-0.24, 0.3, 0.06, { s: 0.06 }), true, { limb: 2 }),
      P(GEO.cyl, PALETTE.steel, gun(0, 0.06, 0.08, 0.025, 0.14, 0.025), true, { limb: 2 }),
      P(GEO.sphereLo, PALETTE.capRed, gun(0, 0.14, 0.08, 0.04, 0.04, 0.04), false, { limb: 2 }),
      P(GEO.box, PALETTE.steelDark, gun(0, 0.0, 0.03, 0.04, 0.06, 0.06), false, { limb: 2 }),
    ];
  }

  // Skitter Crawler: a low magenta bug, a segmented back, six spindly
  // legs, two eyes on wobbly stalks, snapping pincers and a stinger tail.
  // Faces +z. Silhouette: long and low, the legs and eyestalks.
  // Limbs: 1/2 pincers, 3/4 the two tripods of legs, 5/6 eyestalks, 8 tail.
  function tricksterParts() {
    const g = PALETTE.trickster, gd = PALETTE.tricksterDark;
    const parts = [
      P(GEO.sphereLo, g, M(0, 0.2, 0.0, { sx: 0.15, sy: 0.1, sz: 0.2 }), true, { name: 'body' }),
      P(GEO.sphereLo, gd, M(0, 0.22, -0.16, { sx: 0.12, sy: 0.085, sz: 0.12 }), true),
      P(GEO.sphereLo, g, M(0, 0.22, 0.17, { sx: 0.11, sy: 0.09, sz: 0.1 }), true, { name: 'head' }),
      ...[-0.08, 0, 0.08].map((z) => P(GEO.box, gd, M(0, 0.295, z, { sx: 0.16, sy: 0.02, sz: 0.04 }), false)),
      P(GEO.bead, PALETTE.spore, M(0, 0.31, -0.05, { s: 0.02 }), false, { unlit: true }),
      // eyestalks
      P(GEO.cyl, gd, M(0.05, 0.36, 0.2, { sx: 0.012, sy: 0.14, sz: 0.012, rz: -0.2 }), false, { limb: 5 }),
      P(GEO.sphereLo, PALETTE.cream, M(0.065, 0.44, 0.2, { s: 0.04 }), true, { limb: 5 }),
      P(GEO.bead, PALETTE.outline, M(0.067, 0.445, 0.235, { s: 0.018 }), false, { limb: 5, unlit: true }),
      P(GEO.cyl, gd, M(-0.05, 0.36, 0.2, { sx: 0.012, sy: 0.14, sz: 0.012, rz: 0.2 }), false, { limb: 6 }),
      P(GEO.sphereLo, PALETTE.cream, M(-0.065, 0.44, 0.2, { s: 0.04 }), true, { limb: 6 }),
      P(GEO.bead, PALETTE.outline, M(-0.067, 0.445, 0.235, { s: 0.018 }), false, { limb: 6, unlit: true }),
      // pincers
      P(GEO.cone, gd, M(0.07, 0.17, 0.3, { sx: 0.025, sy: 0.1, sz: 0.025, rx: Math.PI / 2, rz: 0.4 }), false, { limb: 1 }),
      P(GEO.cone, gd, M(-0.07, 0.17, 0.3, { sx: 0.025, sy: 0.1, sz: 0.025, rx: Math.PI / 2, rz: -0.4 }), false, { limb: 2 }),
      // the stinger tail
      P(GEO.cone, g, M(0, 0.3, -0.3, { sx: 0.04, sy: 0.16, sz: 0.04, rx: -0.6 }), true, { limb: 8 }),
      P(GEO.cone, PALETTE.spore, M(0, 0.39, -0.37, { sx: 0.02, sy: 0.05, sz: 0.02, rx: -0.6 }), false, { limb: 8, unlit: true }),
    ];
    // six legs in two tripods: front and back on one side with the middle on the other
    for (const [side, z, limb] of [[1, 0.1, 3], [1, -0.1, 3], [-1, 0, 3], [-1, 0.1, 4], [-1, -0.1, 4], [1, 0, 4]]) {
      parts.push(P(GEO.cyl, gd, M(side * 0.17, 0.17, z, { sx: 0.015, sy: 0.16, sz: 0.015, rz: side * 1.0 }), false, { limb }));
      parts.push(P(GEO.cyl, gd, M(side * 0.26, 0.07, z, { sx: 0.013, sy: 0.14, sz: 0.013, rz: -side * 0.3 }), false, { limb }));
    }
    return parts;
  }

  // Armored Brute: a hulking alien under a ridged violet shell, small
  // glowing eyes, two big crab claws and short tree-trunk legs. Faces +z.
  // Silhouette: wide, low, the shell ridge and the claws.
  // Limbs: 1 left claw, 2 right claw, 3/4 feet.
  function trollParts() {
    const t = PALETTE.troll, td = PALETTE.trollDark;
    const claw = (side, limb) => [
      P(GEO.cyl, td, M(side * 0.36, 0.48, 0.14, { sx: 0.07, sy: 0.24, sz: 0.07, rz: side * 0.5, rx: 0.4 }), true, { limb }),
      P(GEO.sphereLo, t, M(side * 0.44, 0.36, 0.3, { sx: 0.12, sy: 0.1, sz: 0.14 }), true, { limb }),
      P(GEO.cone, td, M(side * 0.4, 0.42, 0.42, { sx: 0.05, sy: 0.14, sz: 0.04, rx: Math.PI / 2 - 0.3 }), true, { limb }),
      P(GEO.cone, td, M(side * 0.48, 0.32, 0.42, { sx: 0.05, sy: 0.13, sz: 0.04, rx: Math.PI / 2 + 0.3 }), true, { limb }),
    ];
    return [
      P(GEO.sphereLo, PALETTE.goblin, M(0, 0.4, 0.04, { sx: 0.3, sy: 0.28, sz: 0.28 }), true, { name: 'body' }),
      // the shell: plates over the back, a ridge of horns
      P(GEO.sphereLo, t, M(0, 0.52, -0.06, { sx: 0.38, sy: 0.34, sz: 0.34 }), true),
      P(GEO.sphereLo, td, M(0, 0.48, -0.1, { sx: 0.39, sy: 0.12, sz: 0.34 }), false),
      ...[0, 1, 2].map((i) => P(GEO.cone, td, M(0, 0.84 - i * 0.06, 0.02 - i * 0.16, { sx: 0.06, sy: 0.16, sz: 0.06, rx: -0.4 }), true)),
      P(GEO.sphereLo, t, M(0.3, 0.66, 0.02, { sx: 0.16, sy: 0.12, sz: 0.16 }), true),
      P(GEO.sphereLo, t, M(-0.3, 0.66, 0.02, { sx: 0.16, sy: 0.12, sz: 0.16 }), true),
      // a stubby head with three glowing eyes and a scowl
      P(GEO.sphereLo, PALETTE.goblin, M(0, 0.6, 0.26, { sx: 0.15, sy: 0.12, sz: 0.12 }), true, { name: 'head' }),
      P(GEO.box, td, M(0, 0.69, 0.3, { sx: 0.2, sy: 0.05, sz: 0.06 }), false),
      P(GEO.bead, PALETTE.spore, M(0.06, 0.63, 0.36, { s: 0.022 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.spore, M(-0.06, 0.63, 0.36, { s: 0.022 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.spore, M(0, 0.655, 0.365, { s: 0.018 }), false, { unlit: true }),
      P(GEO.box, PALETTE.outline, M(0, 0.55, 0.37, { sx: 0.1, sy: 0.015, sz: 0.01, rz: 0.1 }), false),
      ...claw(1, 1), ...claw(-1, 2),
      P(GEO.sphereLo, td, M(0.15, 0.08, 0, { sx: 0.12, sy: 0.08, sz: 0.15 }), true, { limb: 3 }),
      P(GEO.sphereLo, td, M(-0.15, 0.08, 0, { sx: 0.12, sy: 0.08, sz: 0.15 }), true, { limb: 4 }),
    ];
  }

  // Swarm bosses: a churning core with small creatures wheeling round it,
  // peeling away as it weakens. Every flying boss but the Sky Manta uses
  // this one animated rig (updateBossView); only makeBossParts' shape and
  // color inputs differ, so each reads as a different creature.
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
  // The Spore Cloud (Level 6 finale): a purple puffball the size of a hab,
  // spotted and glowing, its spore pods wheeling round it on little wings.
  function sporecloudParts() {
    return makeBossParts({
      coreColor: PALETTE.crystal, coreScale: { sx: 0.44, sy: 0.4, sz: 0.44 }, heartColor: PALETTE.spore, heartScale: { s: 0.15 }, accentColor: PALETTE.cream,
      extra: [
        ...[0, 1, 2, 3, 4, 5].map((i) => { const a = i * 1.05, e = (i % 3) * 0.4 - 0.2; return P(GEO.sphereLo, PALETTE.flowerPink, M(Math.cos(a) * 0.4, e, Math.sin(a) * 0.4, { s: 0.08 }), false, { unlit: true }); }),
        P(GEO.sphereLo, PALETTE.outline, M(0, -0.04, 0.38, { sx: 0.16, sy: 0.07, sz: 0.06 }), false, { unlit: true }),
        P(GEO.box, PALETTE.cream, M(0.05, -0.02, 0.42, { sx: 0.035, sy: 0.035, sz: 0.01 }), false, { unlit: true }),
        P(GEO.box, PALETTE.cream, M(-0.05, -0.02, 0.42, { sx: 0.035, sy: 0.035, sz: 0.01 }), false, { unlit: true }),
      ],
      orbitScale: { sx: 0.08, sy: 0.08, sz: 0.08 }, orbitColor: PALETTE.magicGlow,
      wingScale: { sx: 0.26, sy: 0.012, sz: 0.1 }, wingColor: PALETTE.crystalTeal,
      beakScale: { sx: 0.03, sy: 0.05, sz: 0.03 }, beakColor: PALETTE.spore,
    });
  }
  // The Big Brain (Level 9 finale): a pink brain in a glass jar under a
  // spinning collar, two jelly eyes, wheeled round by guard drones.
  function brainParts() {
    return makeBossParts({
      coreColor: PALETTE.flowerPink, coreScale: { sx: 0.34, sy: 0.3, sz: 0.38 }, heartColor: PALETTE.magicGlow, heartScale: { s: 0.12 }, accentColor: PALETTE.spore,
      extra: [
        ...[-0.12, 0, 0.12].map((x) => P(GEO.torus, PALETTE.capBrown, M(x, 0.12, 0, { sx: 0.2, sy: 0.26, sz: 0.3, ry: Math.PI / 2 }), false)),
        P(GEO.ring, PALETTE.glass, M(0, 0.05, 0, { sx: 0.46, sy: 0.4, sz: 0.46 }), false, { unlit: true }),
        P(GEO.ring, PALETTE.glass, M(0, 0.05, 0, { sx: 0.46, sy: 0.4, sz: 0.46, ry: Math.PI / 2 }), false, { unlit: true }),
        P(GEO.cyl, PALETTE.steelDark, M(0, -0.12, 0, { sx: 0.5, sy: 0.1, sz: 0.5 })),
        P(GEO.ring, PALETTE.neon, M(0, -0.12, 0, { s: 0.5, rx: Math.PI / 2 }), false, { unlit: true }),
        P(GEO.cone, PALETTE.steelDark, M(0, -0.32, 0, { sx: 0.2, sy: 0.28, sz: 0.2, rx: Math.PI })),
        P(GEO.sphereLo, PALETTE.cream, M(0.12, 0.0, 0.36, { s: 0.06 }), false, { unlit: true }),
        P(GEO.sphereLo, PALETTE.cream, M(-0.12, 0.0, 0.36, { s: 0.06 }), false, { unlit: true }),
      ],
      orbitScale: { sx: 0.09, sy: 0.04, sz: 0.09 }, orbitColor: PALETTE.bat,
      wingScale: { sx: 0.22, sy: 0.012, sz: 0.06 }, wingColor: PALETTE.batDark,
      beakScale: { sx: 0.02, sy: 0.05, sz: 0.02 }, beakColor: PALETTE.neon,
    });
  }
  // The Mothership (the finale): a vast saucer, dome lit, rim lights round
  // its edge and a tractor beam underneath, ringed by escort scouts that
  // peel away as it is shot down.
  function mothershipParts() {
    const parts = makeBossParts({
      coreColor: PALETTE.bat, coreScale: { sx: 0.7, sy: 0.14, sz: 0.7 }, heartColor: PALETTE.spore, heartScale: { sx: 0.3, sy: 0.08, sz: 0.3 }, accentColor: PALETTE.neon,
      extra: [
        P(GEO.dome, PALETTE.glass, M(0, 0.08, 0, { sx: 0.32, sy: 0.26, sz: 0.32 }), true),
        P(GEO.sphereLo, PALETTE.goblin, M(0, 0.16, 0.05, { s: 0.11 }), false),
        P(GEO.sphereLo, PALETTE.cream, M(0, 0.2, 0.14, { s: 0.05 }), false, { unlit: true }),
        P(GEO.bead, PALETTE.outline, M(0, 0.2, 0.185, { s: 0.022 }), false, { unlit: true }),
        P(GEO.sphereLo, PALETTE.batDark, M(0, -0.1, 0, { sx: 0.42, sy: 0.08, sz: 0.42 })),
        P(GEO.cyl, PALETTE.steelDark, M(0, 0.4, -0.05, { sx: 0.012, sy: 0.24, sz: 0.012 }), false),
        P(GEO.bead, PALETTE.capRed, M(0, 0.53, -0.05, { s: 0.035 }), false, { unlit: true }),
        P(GEO.cone, PALETTE.spore, M(0, -0.62, 0, { sx: 0.34, sy: 0.9, sz: 0.34 }), false, { name: 'beam', live: true, unlit: true }),
      ],
      orbitScale: { sx: 0.12, sy: 0.04, sz: 0.12 }, orbitColor: PALETTE.bat,
      wingScale: { sx: 0.06, sy: 0.06, sz: 0.06 }, wingColor: PALETTE.glass,
      beakScale: { sx: 0.02, sy: 0.04, sz: 0.02 }, beakColor: PALETTE.spore,
    });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      parts.push(P(GEO.bead, i % 2 ? PALETTE.neon : PALETTE.capRed, M(Math.cos(a) * 0.69, 0, Math.sin(a) * 0.69, { s: 0.04 }), false, { unlit: true }));
    }
    return parts;
  }

  // The Drill Tank (Level 1 finale): a squat violet tank on four fat
  // tread drums, a giant spinning drill on the nose, a goo exhaust and an
  // alien banner on a whip aerial; two blob drones push it from behind.
  // Faces +z. Silhouette: the long low hull and the drill cone.
  function drilltankParts() {
    const hl = PALETTE.troll, hd = PALETTE.trollDark;
    const parts = [
      P(GEO.box, hd, M(0, 0.26, 0, { sx: 0.66, sy: 0.12, sz: 1.1 }), true, { name: 'body' }),
      P(GEO.sphereLo, hl, M(0, 0.46, -0.06, { sx: 0.4, sy: 0.24, sz: 0.56 }), true),
      P(GEO.box, PALETTE.spore, M(0, 0.46, 0.3, { sx: 0.3, sy: 0.05, sz: 0.06 }), false, { unlit: true }),
      P(GEO.dome, PALETTE.glass, M(0, 0.66, 0.0, { sx: 0.16, sy: 0.14, sz: 0.16 }), true),
      P(GEO.sphereLo, PALETTE.goblin, M(0, 0.7, 0.02, { s: 0.08 }), false),
      P(GEO.bead, PALETTE.outline, M(0, 0.72, 0.09, { s: 0.022 }), false, { unlit: true }),
      ...[-0.3, 0, 0.3].map((z) => P(GEO.box, PALETTE.hazard, M(0.335, 0.3, z, { sx: 0.01, sy: 0.04, sz: 0.12 }), false)),
      ...[-0.3, 0, 0.3].map((z) => P(GEO.box, PALETTE.hazard, M(-0.335, 0.3, z, { sx: 0.01, sy: 0.04, sz: 0.12 }), false)),
      // the exhaust stack, belching goo smoke
      P(GEO.cyl, PALETTE.steelDark, M(0.18, 0.66, -0.36, { sx: 0.05, sy: 0.28, sz: 0.05 }), false),
      P(GEO.bead, PALETTE.spore, M(0.18, 0.81, -0.36, { s: 0.05 }), false, { unlit: true }),
      // the whip aerial and its banner
      P(GEO.cyl, PALETTE.steel, M(-0.2, 1.1, -0.4, { sx: 0.012, sy: 0.8, sz: 0.012 }), false),
      P(GEO.box, PALETTE.baron, M(-0.06, 1.36, -0.4, { sx: 0.28, sy: 0.2, sz: 0.01 }), true, { name: 'flag', live: true }),
      P(GEO.box, PALETTE.baronRed, M(-0.06, 1.36, -0.395, { sx: 0.28, sy: 0.05, sz: 0.01 }), false, { name: 'flagStripe', live: true, unlit: true }),
      // the drill: a mount and a spinning cone with a spiral groove
      P(GEO.cyl, PALETTE.steelDark, M(0, 0.4, 0.6, { sx: 0.2, sy: 0.12, sz: 0.2, rx: Math.PI / 2 }), true, { name: 'ram', live: true }),
      P(GEO.cone, PALETTE.steel, M(0, 0.4, 0.86, { sx: 0.2, sy: 0.42, sz: 0.2, rx: Math.PI / 2 }), true, { name: 'ramHead', live: true }),
      // two blob drones shoving from behind
      P(GEO.sphereLo, PALETTE.goblin, M(0.18, 0.14, -0.66, { sx: 0.12, sy: 0.13, sz: 0.11 }), true, { name: 'footL', live: true }),
      P(GEO.sphereLo, PALETTE.goblin, M(-0.18, 0.14, -0.66, { sx: 0.12, sy: 0.13, sz: 0.11 }), true, { name: 'footR', live: true }),
    ];
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 ? 1 : -1, sz = i < 2 ? -0.36 : 0.36;
      parts.push(P(GEO.cyl, PALETTE.steelDark, M(sx * 0.38, 0.2, sz, { sx: 0.2, sy: 0.12, sz: 0.2, rz: Math.PI / 2 }), true, { name: `wheel${i}`, live: true }));
      parts.push(P(GEO.cyl, PALETTE.spore, M(sx * 0.445, 0.2, sz, { sx: 0.06, sy: 0.02, sz: 0.06, rz: Math.PI / 2 }), false, { unlit: true }));
    }
    return parts;
  }
  // The Harvester (Level 8 finale): a stolen combine harvester the aliens
  // have rebuilt, a spinning reel on the front, a hopper of stolen crops,
  // big wheels and a crawler crew. Faces +z. Silhouette: tall and wide.
  function harvesterParts() {
    const parts = [
      P(GEO.box, PALETTE.hazard, M(0, 0.52, -0.1, { sx: 0.7, sy: 0.5, sz: 0.9 }), true, { name: 'body' }),
      P(GEO.box, PALETTE.troll, M(0, 0.52, -0.1, { sx: 0.72, sy: 0.12, sz: 0.92 }), false),
      P(GEO.box, PALETTE.trollDark, M(0, 0.3, -0.1, { sx: 0.6, sy: 0.08, sz: 0.86 }), false),
      // the cab with its alien driver
      P(GEO.box, PALETTE.glass, M(0.12, 0.98, 0.18, { sx: 0.3, sy: 0.28, sz: 0.28 }), true),
      P(GEO.box, PALETTE.hazard, M(0.12, 1.14, 0.18, { sx: 0.34, sy: 0.04, sz: 0.32 }), false),
      P(GEO.sphereLo, PALETTE.trickster, M(0.12, 0.98, 0.2, { s: 0.09 }), false),
      P(GEO.bead, PALETTE.cream, M(0.15, 1.0, 0.28, { s: 0.025 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.cream, M(0.09, 1.0, 0.28, { s: 0.025 }), false, { unlit: true }),
      // the hopper heaped with stolen crops
      P(GEO.box, PALETTE.troll, M(-0.14, 0.92, -0.32, { sx: 0.36, sy: 0.26, sz: 0.4 }), true),
      P(GEO.dome, PALETTE.straw, M(-0.14, 1.05, -0.32, { sx: 0.17, sy: 0.12, sz: 0.19 }), false),
      P(GEO.cyl, PALETTE.steelDark, M(0.3, 1.0, -0.4, { sx: 0.06, sy: 0.4, sz: 0.06, rz: -0.5 }), false),
      // the reel: a spinning drum with bats, and its mount
      P(GEO.box, PALETTE.steelDark, M(0, 0.32, 0.46, { sx: 0.84, sy: 0.08, sz: 0.2 }), true),
      P(GEO.cyl, PALETTE.steel, M(0, 0.5, 0.58, { sx: 0.2, sy: 0.82, sz: 0.2, rz: Math.PI / 2 }), true, { name: 'ram', live: true }),
      P(GEO.box, PALETTE.capRed, M(0, 0.5, 0.58, { sx: 0.84, sy: 0.42, sz: 0.04 }), false, { name: 'ramHead', live: true }),
      // the alien banner
      P(GEO.cyl, PALETTE.steel, M(-0.28, 1.4, -0.5, { sx: 0.012, sy: 0.6, sz: 0.012 }), false),
      P(GEO.box, PALETTE.baron, M(-0.14, 1.6, -0.5, { sx: 0.28, sy: 0.2, sz: 0.01 }), true, { name: 'flag', live: true }),
      P(GEO.box, PALETTE.baronRed, M(-0.14, 1.6, -0.495, { sx: 0.28, sy: 0.05, sz: 0.01 }), false, { name: 'flagStripe', live: true, unlit: true }),
      // crawlers riding the back step
      P(GEO.sphereLo, PALETTE.trickster, M(0.18, 0.22, -0.64, { sx: 0.1, sy: 0.07, sz: 0.12 }), true, { name: 'footL', live: true }),
      P(GEO.sphereLo, PALETTE.trickster, M(-0.18, 0.22, -0.64, { sx: 0.1, sy: 0.07, sz: 0.12 }), true, { name: 'footR', live: true }),
    ];
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 ? 1 : -1, sz = i < 2 ? -0.38 : 0.22, r = i < 2 ? 0.2 : 0.26;
      parts.push(P(GEO.cyl, PALETTE.trollDark, M(sx * 0.4, r, sz, { sx: r, sy: 0.1, sz: r, rz: Math.PI / 2 }), true, { name: `wheel${i}`, live: true }));
      parts.push(P(GEO.cyl, PALETTE.hazard, M(sx * 0.455, r, sz, { sx: r * 0.4, sy: 0.02, sz: r * 0.4, rz: Math.PI / 2 }), false));
    }
    return parts;
  }

  // The Sky Manta (Level 4 finale): a vast blue ray gliding on wide purple
  // wings, two horn lobes, glowing spots down its back and a whip tail. It
  // sprays sparkling stardust now and then (see updateDragonView).
  // Faces +z. Silhouette: the wingspan.
  function mantaParts() {
    const d = PALETTE.dragon, dw = PALETTE.dragonWing, belly = PALETTE.dragonBelly;
    const parts = [
      P(GEO.sphereLo, d, M(0, 0, 0, { sx: 0.36, sy: 0.14, sz: 0.56 }), true, { name: 'core' }),
      P(GEO.sphereLo, belly, M(0, -0.06, 0.04, { sx: 0.28, sy: 0.08, sz: 0.46 }), false),
      // horn lobes and the mouth (the jaw opens for the spray)
      P(GEO.cone, d, M(0.16, 0.0, 0.58, { sx: 0.06, sy: 0.24, sz: 0.04, rx: Math.PI / 2 - 0.2, rz: -0.3 }), true),
      P(GEO.cone, d, M(-0.16, 0.0, 0.58, { sx: 0.06, sy: 0.24, sz: 0.04, rx: Math.PI / 2 - 0.2, rz: 0.3 }), true),
      P(GEO.sphereLo, d, M(0, 0.02, 0.5, { sx: 0.18, sy: 0.08, sz: 0.12 }), true, { name: 'head' }),
      P(GEO.box, belly, M(0, -0.04, 0.56, { sx: 0.16, sy: 0.03, sz: 0.08 }), true, { name: 'jaw', live: true }),
      P(GEO.bead, PALETTE.flowerYellow, M(0.15, 0.06, 0.48, { s: 0.035 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.flowerYellow, M(-0.15, 0.06, 0.48, { s: 0.035 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.outline, M(0.155, 0.065, 0.51, { s: 0.015 }), false),
      P(GEO.bead, PALETTE.outline, M(-0.155, 0.065, 0.51, { s: 0.015 }), false),
      // the whip tail with a glowing tip
      P(GEO.cone, d, M(0, 0.0, -0.8, { sx: 0.06, sy: 0.6, sz: 0.04, rx: -Math.PI / 2 }), true, { name: 'tail' }),
      P(GEO.bead, PALETTE.neon, M(0, 0.0, -1.1, { s: 0.04 }), false, { unlit: true }),
      // the wings, each flapping from the shoulder
      P(GEO.wingL, dw, pivotMatrix(0.2, 0.0, 0.05, 0, 0, 0, 0.55, 0, -0.05, 1.1, 0.035, 1.0), true, { name: 'wingL', live: true }),
      P(GEO.wingR, dw, pivotMatrix(-0.2, 0.0, 0.05, 0, 0, 0, -0.55, 0, -0.05, 1.1, 0.035, 1.0), true, { name: 'wingR', live: true }),
    ];
    for (let i = 0; i < 5; i++) parts.push(P(GEO.bead, i % 2 ? PALETTE.neon : PALETTE.flowerPink, M(0, 0.13, 0.3 - i * 0.15, { s: 0.04 }), false, { unlit: true }));
    return parts;
  }

  // The Gloop King (Level 2 finale): an enormous lime blob in a tin crown,
  // one great eye, a grin full of teeth, wobbling on stubby feet and
  // waving two pseudopod arms. Faces +z. Silhouette: a huge round blob.
  // Limbs: 1/2 arms, 3/4 feet, 8 the crown.
  function gloopkingParts() {
    const g = PALETTE.goblin, gd = PALETTE.goblinDark;
    return [
      P(GEO.sphere, g, M(0, 0.6, 0, { sx: 0.5, sy: 0.52, sz: 0.48 }), true, { name: 'body' }),
      P(GEO.sphereLo, PALETTE.meadowLight, M(-0.18, 0.86, -0.12, { sx: 0.12, sy: 0.09, sz: 0.08 }), false, { unlit: true }),
      ...[[0.25, 0.35, 0.36], [-0.3, 0.5, 0.32], [0.32, 0.72, 0.28], [-0.1, 0.3, 0.44]].map(([x, y, z]) => P(GEO.bead, gd, M(x, y, z, { s: 0.05 }), false)),
      // things it swallowed, floating inside
      P(GEO.box, PALETTE.steel, M(0.18, 0.5, 0.1, { sx: 0.1, sy: 0.06, sz: 0.06, rz: 0.6 }), false),
      // the eye
      P(GEO.sphereLo, PALETTE.cream, M(0, 0.78, 0.36, { sx: 0.2, sy: 0.2, sz: 0.12 }), true, { name: 'head' }),
      P(GEO.sphereLo, PALETTE.capBrown, M(0, 0.78, 0.46, { s: 0.09 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.outline, M(0, 0.78, 0.52, { s: 0.05 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.cream, M(0.03, 0.82, 0.55, { s: 0.02 }), false, { unlit: true }),
      P(GEO.box, gd, M(0, 0.98, 0.34, { sx: 0.28, sy: 0.04, sz: 0.06, rz: -0.12 }), false),
      // the grin
      P(GEO.sphereLo, PALETTE.outline, M(0, 0.44, 0.42, { sx: 0.24, sy: 0.07, sz: 0.08 }), false, { unlit: true }),
      ...[-0.12, -0.04, 0.04, 0.12].map((x) => P(GEO.cone, PALETTE.cream, M(x, 0.48, 0.48, { sx: 0.025, sy: 0.05, sz: 0.012, rx: Math.PI }), false, { unlit: true })),
      // feet and arms
      P(GEO.sphereLo, gd, M(0.2, 0.08, 0.04, { sx: 0.14, sy: 0.08, sz: 0.18 }), true, { limb: 3 }),
      P(GEO.sphereLo, gd, M(-0.2, 0.08, 0.04, { sx: 0.14, sy: 0.08, sz: 0.18 }), true, { limb: 4 }),
      P(GEO.sphereLo, g, M(0.52, 0.56, 0.06, { sx: 0.12, sy: 0.18, sz: 0.12, rz: 0.4 }), true, { limb: 1 }),
      P(GEO.sphereLo, g, M(-0.52, 0.56, 0.06, { sx: 0.12, sy: 0.18, sz: 0.12, rz: -0.4 }), true, { limb: 2 }),
      // the crown
      P(GEO.cyl, PALETTE.gold, M(0, 1.12, -0.02, { sx: 0.2, sy: 0.08, sz: 0.2 }), true, { limb: 8 }),
      ...[0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2; return P(GEO.cone, PALETTE.gold, M(Math.sin(a) * 0.17, 1.22, -0.02 + Math.cos(a) * 0.17, { sx: 0.035, sy: 0.12, sz: 0.035 }), false, { limb: 8 }); }),
      P(GEO.bead, PALETTE.capRed, M(0, 1.12, 0.19, { s: 0.035 }), false, { limb: 8, unlit: true }),
    ];
  }

  // The Hive Queen (Level 3 finale): a towering insect queen, a long
  // swollen abdomen trailing behind, four legs, two scythe arms raised, a
  // crested head with antennae and buzzing glassy wings. Faces +z.
  // Limbs: 1/2 scythes, 3/4 front legs, 5/6 hind legs, 7 wings, 8 abdomen.
  function hivequeenParts() {
    const c = PALETTE.trickster, cd = PALETTE.tricksterDark, sh = PALETTE.troll;
    const parts = [
      P(GEO.sphereLo, c, M(0, 0.62, 0.08, { sx: 0.24, sy: 0.22, sz: 0.3 }), true, { name: 'body' }),
      P(GEO.sphereLo, sh, M(0, 0.72, 0.06, { sx: 0.25, sy: 0.12, sz: 0.28 }), false),
      // the abdomen, banded and glowing at the tip
      P(GEO.sphereLo, cd, M(0, 0.56, -0.42, { sx: 0.3, sy: 0.26, sz: 0.42 }), true, { limb: 8 }),
      ...[-0.25, -0.42, -0.59].map((z) => P(GEO.torus, c, M(0, 0.56, z, { sx: 0.28, sy: 0.24, sz: 0.3 }), false, { limb: 8 })),
      P(GEO.sphereLo, PALETTE.spore, M(0, 0.52, -0.82, { s: 0.08 }), false, { limb: 8, unlit: true }),
      // the head: a crest, antennae and a row of eyes
      P(GEO.sphereLo, c, M(0, 0.9, 0.36, { sx: 0.16, sy: 0.15, sz: 0.15 }), true, { name: 'head' }),
      P(GEO.cone, sh, M(0, 1.12, 0.3, { sx: 0.16, sy: 0.24, sz: 0.06, rx: -0.4 }), true),
      P(GEO.cyl, cd, M(0.08, 1.1, 0.46, { sx: 0.01, sy: 0.26, sz: 0.01, rz: -0.5, rx: 0.4 }), false),
      P(GEO.cyl, cd, M(-0.08, 1.1, 0.46, { sx: 0.01, sy: 0.26, sz: 0.01, rz: 0.5, rx: 0.4 }), false),
      P(GEO.bead, PALETTE.spore, M(0.15, 1.2, 0.52, { s: 0.03 }), false, { unlit: true }),
      P(GEO.bead, PALETTE.spore, M(-0.15, 1.2, 0.52, { s: 0.03 }), false, { unlit: true }),
      ...[-0.07, 0, 0.07].map((x) => P(GEO.bead, PALETTE.spore, M(x, 0.93, 0.5, { s: 0.028 }), false, { unlit: true })),
      P(GEO.cone, cd, M(0.04, 0.8, 0.5, { sx: 0.02, sy: 0.08, sz: 0.02, rx: 2.6 }), false),
      P(GEO.cone, cd, M(-0.04, 0.8, 0.5, { sx: 0.02, sy: 0.08, sz: 0.02, rx: 2.6 }), false),
      // scythe arms
      ...[[1, 1], [-1, 2]].flatMap(([s, limb]) => [
        P(GEO.cyl, cd, M(s * 0.22, 0.86, 0.34, { sx: 0.03, sy: 0.3, sz: 0.03, rz: s * -0.5, rx: 0.3 }), false, { limb }),
        P(GEO.cone, sh, M(s * 0.32, 1.02, 0.5, { sx: 0.04, sy: 0.3, sz: 0.02, rx: 1.4 }), true, { limb }),
      ]),
      // wings
      P(GEO.wingL, PALETTE.glass, pivotMatrix(0.1, 0.82, -0.06, 0.3, 0, 0.3, 0.3, 0, -0.2, 0.6, 0.02, 0.5), true, { limb: 7, unlit: true }),
      P(GEO.wingR, PALETTE.glass, pivotMatrix(-0.1, 0.82, -0.06, 0.3, 0, -0.3, -0.3, 0, -0.2, 0.6, 0.02, 0.5), true, { limb: 7, unlit: true }),
    ];
    // four legs, each a thigh and a shin ending in a point
    for (const [limb, x, z] of [[3, 0.18, 0.24], [4, -0.18, 0.24], [5, 0.18, -0.08], [6, -0.18, -0.08]]) {
      const s = Math.sign(x);
      parts.push(P(GEO.cyl, cd, M(x + s * 0.1, 0.52, z, { sx: 0.03, sy: 0.24, sz: 0.03, rz: s * 1.0 }), false, { limb }));
      parts.push(P(GEO.cone, cd, M(x + s * 0.22, 0.22, z, { sx: 0.035, sy: 0.4, sz: 0.035, rx: Math.PI }), true, { limb }));
    }
    return parts;
  }

  // The Tripod (Level 7 finale): a domed walking war machine on three long
  // jointed legs, a glowing eye under the dome, two heat-ray arms and an
  // aerial. Faces +z. Silhouette: the high dome on stilts.
  // Limbs: 1/2 ray arms, 3/4/5 the three legs, 8 aerial.
  function tripodParts() {
    const h = PALETTE.bat, hd = PALETTE.batDark;
    const parts = [
      P(GEO.sphereLo, h, M(0, 1.2, 0, { sx: 0.4, sy: 0.2, sz: 0.4 }), true, { name: 'body' }),
      P(GEO.dome, PALETTE.glass, M(0, 1.3, 0, { sx: 0.26, sy: 0.22, sz: 0.26 }), true),
      P(GEO.sphereLo, PALETTE.trickster, M(0, 1.36, 0.02, { s: 0.1 }), false),
      P(GEO.ring, hd, M(0, 1.2, 0, { s: 0.4, rx: Math.PI / 2 }), false),
      P(GEO.sphereLo, hd, M(0, 1.08, 0, { sx: 0.26, sy: 0.1, sz: 0.26 }), false),
      // the big eye on the front, and running lights
      P(GEO.sphereLo, PALETTE.spore, M(0, 1.16, 0.36, { sx: 0.12, sy: 0.09, sz: 0.06 }), false, { name: 'head', unlit: true }),
      P(GEO.bead, PALETTE.outline, M(0, 1.16, 0.41, { s: 0.04 }), false, { unlit: true }),
      ...[0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2 + 0.5; return P(GEO.bead, PALETTE.neon, M(Math.cos(a) * 0.38, 1.21, Math.sin(a) * 0.38, { s: 0.03 }), false, { unlit: true }); }),
      // aerial
      P(GEO.cyl, PALETTE.steel, M(0.1, 1.6, -0.1, { sx: 0.012, sy: 0.3, sz: 0.012 }), false, { limb: 8 }),
      P(GEO.bead, PALETTE.capRed, M(0.1, 1.76, -0.1, { s: 0.035 }), false, { limb: 8, unlit: true }),
      // the heat-ray arms
      ...[[1, 1], [-1, 2]].flatMap(([s, limb]) => [
        P(GEO.cyl, hd, M(s * 0.4, 1.06, 0.12, { sx: 0.03, sy: 0.28, sz: 0.03, rx: 1.0, rz: s * 0.4 }), false, { limb }),
        P(GEO.cylTaper, h, M(s * 0.46, 0.98, 0.32, { sx: 0.06, sy: 0.18, sz: 0.06, rx: Math.PI / 2 }), true, { limb }),
        P(GEO.bead, PALETTE.capRed, M(s * 0.46, 0.98, 0.42, { s: 0.035 }), false, { limb, unlit: true }),
      ]),
    ];
    // three legs: a thigh down and out, a shin back to the ground, a foot pad
    [[3, 0], [4, 2.09], [5, 4.19]].forEach(([limb, a]) => {
      const dx = Math.sin(a), dz = Math.cos(a);
      parts.push(P(GEO.cyl, hd, M(dx * 0.32, 0.92, dz * 0.32, { sx: 0.04, sy: 0.5, sz: 0.04, rz: -dx * 0.8, rx: dz * 0.8 }), true, { limb }));
      parts.push(P(GEO.sphereLo, h, M(dx * 0.5, 0.74, dz * 0.5, { s: 0.06 }), true, { limb }));
      parts.push(P(GEO.cyl, h, M(dx * 0.52, 0.38, dz * 0.52, { sx: 0.035, sy: 0.72, sz: 0.035 }), true, { limb }));
      parts.push(P(GEO.cyl, hd, M(dx * 0.52, 0.03, dz * 0.52, { sx: 0.1, sy: 0.05, sz: 0.1 }), false, { limb }));
    });
    return parts;
  }

  // The Sand Worm (Level 5 finale): a giant segmented worm swimming through
  // the sand, a ring of three jaws and teeth at the head, glowing spots down
  // its back. Its segments trail along the road behind its head (see
  // updateWormView), so it is drawn as a head plus loose segments.
  const WORM_SEGS = 8;
  function sandwormParts() {
    const s = PALETTE.sand, sd = PALETTE.sandDark;
    const parts = [
      P(GEO.sphereLo, s, M(0, 0, 0, { sx: 0.34, sy: 0.32, sz: 0.36 }), true, { name: 'head', live: true }),
      P(GEO.sphereLo, PALETTE.capBrown, M(0, 0, 0, { s: 0.2 }), false, { name: 'maw', live: true, unlit: true }),
    ];
    for (let j = 0; j < 3; j++) parts.push(P(GEO.cone, sd, M(0, 0, 0, { sx: 0.14, sy: 0.3, sz: 0.08 }), true, { name: `jaw${j}`, live: true }));
    for (let i = 0; i < WORM_SEGS; i++) {
      const k = 1 - i / (WORM_SEGS + 2);
      parts.push(P(GEO.sphereLo, i % 2 ? sd : s, M(0, 0, 0, { sx: 0.32 * k, sy: 0.3 * k, sz: 0.28 * k }), true, { name: `seg${i}`, live: true }));
      parts.push(P(GEO.bead, i % 2 ? PALETTE.spore : PALETTE.crystalTeal, M(0, 0, 0, { s: 0.05 * k }), false, { name: `spot${i}`, live: true, unlit: true }));
    }
    return parts;
  }

  const WALK = {
    grunt:     { freq: 7.5, bounce: 0.09, lean: 0.1, sway: 0.08 },
    trickster: { freq: 12,  bounce: 0.1,  lean: 0.08, sway: 0.1 },
    troll:     { freq: 3.6, bounce: 0.05, lean: 0.04, sway: 0.06 },
    drilltank: { freq: 2.4, bounce: 0.02, lean: 0, sway: 0.025 },
    harvester: { freq: 2.0, bounce: 0.012, lean: 0, sway: 0.035 },
    gloopking: { freq: 2.4, bounce: 0.08, lean: 0.04, sway: 0.1 },
    hivequeen: { freq: 4.0, bounce: 0.05, lean: 0.03, sway: 0.04 },
    tripod:    { freq: 2.2, bounce: 0.06, lean: 0.02, sway: 0.05 },
  };
  // Per-limb rigging. Every walker's limbs live in its one merged mesh, tagged
  // with a limb slot (aLimb); a vertex shader swings each slot about its
  // pivot. Slots: 1 armL, 2 armR, 3 legL, 4 legR, 5/6 extra pair (antennae,
  // eyestalks, hind legs), 7 wings, 8 extra (tail, crown, aerial).
  const RIG_SLOTS = 9;
  const RIG_PIVOTS = {
    grunt:     { 1: [0.22, 0.32, 0.06], 2: [-0.22, 0.32, 0.06], 3: [0.1, 0.14, 0.02], 4: [-0.1, 0.14, 0.02], 5: [0, 0.6, -0.02] },
    trickster: { 1: [0.06, 0.18, 0.24], 2: [-0.06, 0.18, 0.24], 3: [0, 0.2, 0], 4: [0, 0.2, 0], 5: [0.04, 0.3, 0.2], 6: [-0.04, 0.3, 0.2], 8: [0, 0.24, -0.22] },
    troll:     { 1: [0.32, 0.58, 0.06], 2: [-0.32, 0.58, 0.06], 3: [0.15, 0.18, 0], 4: [-0.15, 0.18, 0] },
    bat:       { 1: [0.08, 0.02, -0.2], 2: [-0.08, 0.02, -0.2] },
    gloopking: { 1: [0.44, 0.66, 0.04], 2: [-0.44, 0.66, 0.04], 3: [0.2, 0.2, 0], 4: [-0.2, 0.2, 0], 8: [0, 1.08, -0.02] },
    hivequeen: { 1: [0.18, 0.84, 0.34], 2: [-0.18, 0.84, 0.34], 3: [0.18, 0.56, 0.24], 4: [-0.18, 0.56, 0.24], 5: [0.18, 0.56, -0.08], 6: [-0.18, 0.56, -0.08], 7: [0, 0.82, -0.06], 8: [0, 0.6, -0.18] },
    tripod:    { 1: [0.36, 1.12, 0.06], 2: [-0.36, 1.12, 0.06], 3: [0, 1.12, 0], 4: [0, 1.12, 0], 5: [0, 1.12, 0], 8: [0.1, 1.44, -0.1] },
  };
  // ground bosses that walk on the limb rig like the rank and file
  const WALKER_BOSSES = new Set(['gloopking', 'hivequeen', 'tripod']);
  // ground bosses that roll on wheels (updateRamView)
  const ROLLERS = new Set(['drilltank', 'harvester']);
  const ENEMY_RECIPES = { grunt: gruntParts, trickster: tricksterParts, troll: trollParts, bat: batParts,
    drilltank: drilltankParts, gloopking: gloopkingParts, hivequeen: hivequeenParts, manta: mantaParts, sandworm: sandwormParts,
    sporecloud: sporecloudParts, tripod: tripodParts, harvester: harvesterParts, brain: brainParts, mothership: mothershipParts };
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
          #include <tonemapping_fragment>
          #include <encodings_fragment>
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
  // Effects draw from their own random stream, never Math.random: gameplay
  // (lane jitter) uses Math.random, and how many sparks or puffs the renderer
  // happens to spawn must never change what an enemy does.
  let _fxSeed = 20260929;
  const fxRand = () => ((_fxSeed = (_fxSeed * 16807) % 2147483647) / 2147483647);

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
      const a = fxRand() * Math.PI * 2, s = speed * (0.5 + fxRand() * 0.5);
      Object.assign(u, { alive: true, life: 0, ttl: ttl * (0.7 + fxRand() * 0.5), x, y, z, vx: Math.cos(a) * s, vy: up * (0.4 + fxRand() * 0.6), vz: Math.sin(a) * s, size: size * (0.6 + fxRand() * 0.8) });
      u.color.setHex(color);
      if (++n >= count) break;
    }
  }

  // -------- projectile views: pooled laser bolts, goo balls, frost shards, rocket fists, missiles --------
  // Bolts, fists and missiles fly nose-first along their arc (AIMED); goo tumbles.
  const projPools = {};
  const projViews = new Map();
  // a small missile pointing along +z: a body, a red nose cone, fins and a flame
  const missile = (len, r, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    const s = new THREE.Mesh(GEO.cyl, toon(PALETTE.hull));
    s.scale.set(r, len, r); s.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(GEO.cone, toon(PALETTE.capRed));
    tip.scale.set(r * 1.05, len * 0.35, r * 1.05); tip.rotation.x = Math.PI / 2; tip.position.z = len * 0.66;
    const fin = new THREE.Mesh(GEO.box, toon(PALETTE.hazard));
    fin.scale.set(r * 4, r * 0.4, len * 0.25); fin.position.z = -len * 0.4;
    const flame = new THREE.Mesh(GEO.cone, unlit(PALETTE.ember));
    flame.scale.set(r * 1.1, len * 0.5, r * 1.1); flame.rotation.x = -Math.PI / 2; flame.position.z = -len * 0.75;
    g.add(s, tip, fin, flame);
    g.position.set(x, y, z);
    return g;
  };
  const PROJ_MAKERS = {
    acorn() {   // a laser bolt: a hot coral core in a purple glow
      const g = new THREE.Group();
      const core = new THREE.Mesh(GEO.sphereLo, unlit(PALETTE.cream));
      core.scale.set(0.035, 0.035, 0.2);
      const halo = new THREE.Mesh(GEO.sphereLo, unlit(PALETTE.capRed, { opacity: 0.75, depthWrite: false }));
      halo.scale.set(0.06, 0.06, 0.3);
      g.add(core, halo);
      return g;
    },
    bigacorn() {   // a salvo of three little missiles
      const g = new THREE.Group();
      for (const [x, y, z] of [[0, 0.06, 0.05], [-0.1, -0.03, -0.04], [0.1, -0.02, 0]]) g.add(missile(0.26, 0.03, x, y, z));
      return g;
    },
    thorn() {   // a wobbling ball of goo with a couple of drips
      const g = new THREE.Group();
      const blob = new THREE.Mesh(GEO.sphereLo, toon(PALETTE.goo));
      blob.scale.set(0.11, 0.1, 0.11); addOutline(blob);
      const glow = new THREE.Mesh(GEO.sphereLo, unlit(PALETTE.goo, { opacity: 0.45, depthWrite: false }));
      glow.scale.setScalar(0.16);
      const d1 = new THREE.Mesh(GEO.sphereLo, toon(PALETTE.gooDark)); d1.scale.setScalar(0.04); d1.position.set(0.09, -0.06, 0.02);
      const d2 = new THREE.Mesh(GEO.sphereLo, toon(PALETTE.goo)); d2.scale.setScalar(0.035); d2.position.set(-0.07, 0.07, -0.03);
      g.add(blob, glow, d1, d2);
      return g;
    },
    wisp() {   // a frost shard
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
    boulder() {   // the mech's rocket fist, knuckles first, a jet behind it
      const g = new THREE.Group();
      const fist = new THREE.Mesh(GEO.box, toon(PALETTE.hazard));
      fist.scale.set(0.2, 0.17, 0.18); addOutline(fist);
      const knuckle = new THREE.Mesh(GEO.box, toon(PALETTE.hullDark));
      knuckle.scale.set(0.21, 0.13, 0.05); knuckle.position.z = 0.1;
      const cuff = new THREE.Mesh(GEO.cyl, toon(PALETTE.steelDark));
      cuff.scale.set(0.07, 0.12, 0.07); cuff.rotation.x = Math.PI / 2; cuff.position.z = -0.14;
      const jet = new THREE.Mesh(GEO.cone, unlit(PALETTE.ember));
      jet.scale.set(0.07, 0.22, 0.07); jet.rotation.x = -Math.PI / 2; jet.position.z = -0.3;
      g.add(fist, knuckle, cuff, jet);
      return g;
    },
  };
  const AIMED = { acorn: true, bigacorn: true, boulder: true };
  const PROJ_ARC = { acorn: 0.08, bigacorn: 1.6, thorn: 0.7, wisp: 0.15, boulder: 0.2 };
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

  // -------- living world: birds, butterflies, drifting cloud shadows --------
  // Birds and butterflies are instanced wing triangles (two draw calls each
  // species, however many there are) flapped by rewriting instance matrices.
  // Cloud shadows are one big soft-noise quad. Levels that are mostly blight
  // get fewer or none, so the mood stays right.
  function wingGeo(len, front, back, sign) {
    const g = new THREE.BufferGeometry();
    const v = new Float32Array([0, 0, front, 0, 0, -back, sign * len, 0, -back * 0.25]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }
  // average corruption of the play grid: 0 is a bright meadow, 1 is all blight
  function levelMood() {
    let sum = 0, n = 0;
    for (let r = 0; r < rows; r += 2) for (let c = 0; c < cols; c += 2) { sum += GameState.zoneFalloff(c, r); n++; }
    return sum / Math.max(1, n);
  }
  function buildLife() {
    const vt = levelTheme();
    let sum = 0, n = 0;
    for (let r = 0; r < rows; r += 2) for (let c = 0; c < cols; c += 2) { sum += GameState.zoneFalloff(c, r); n++; }
    const corrupt = sum / Math.max(1, n);
    const rng = srand(2468);
    const _q = new THREE.Quaternion(), _qf = new THREE.Quaternion(), _p = new THREE.Vector3(), _sc = new THREE.Vector3(1, 1, 1), _m = new THREE.Matrix4();
    const yAxis = new THREE.Vector3(0, 1, 0), zAxis = new THREE.Vector3(0, 0, 1);
    const flock = (count, len, front, back, color, colored) => {
      if (count < 1) return null;
      const mat = new THREE.MeshBasicMaterial({ color: colored ? 0xffffff : color, side: THREE.DoubleSide });
      const L = new THREE.InstancedMesh(wingGeo(len, front, back, 1), mat, count);
      const R = new THREE.InstancedMesh(wingGeo(len, front, back, -1), mat, count);
      for (const m of [L, R]) { m.frustumCulled = false; scene.add(m); }
      const tints = [PALETTE.flowerPink, PALETTE.neon, PALETTE.crystalTeal, PALETTE.magic];
      const items = [];
      for (let i = 0; i < count; i++) {
        items.push({ cx: (rng() - 0.5) * cols * 0.8, cz: (rng() - 0.5) * rows * 0.8, rx: 1.5 + rng() * 3.5, rz: 1 + rng() * 2.5, sp: 0.25 + rng() * 0.3, ph: rng() * 6.28, h: 0.5 + rng() });
        if (colored) { const c = new THREE.Color(tints[i % tints.length]); L.setColorAt(i, c); R.setColorAt(i, c); }
      }
      if (colored) { L.instanceColor.needsUpdate = true; R.instanceColor.needsUpdate = true; }
      return { L, R, items };
    };
    const place = (fl, i, x, y, z, yaw, flap, s) => {
      _q.setFromAxisAngle(yAxis, yaw);
      _sc.set(s, s, s); _p.set(x, y, z);
      _qf.setFromAxisAngle(zAxis, -flap); _m.compose(_p, _q.clone().multiply(_qf), _sc); fl.L.setMatrixAt(i, _m);
      _qf.setFromAxisAngle(zAxis, flap); _m.compose(_p, _q.clone().multiply(_qf), _sc); fl.R.setMatrixAt(i, _m);
    };
    if (corrupt < 0.72) {
      const birds = flock(Math.round(5 * QUALITY + 0.5), 0.34, 0.11, 0.11, 0x2a2048, false);
      if (birds) animated.push({ update(t) {
        birds.items.forEach((b, i) => {
          const a = t * b.sp + b.ph, x = b.cx + Math.cos(a) * b.rx * 2.4, z = b.cz + Math.sin(a) * b.rz * 2.4;
          const yaw = Math.atan2(-Math.sin(a) * b.rx, Math.cos(a) * b.rz);
          place(birds, i, x, 3.2 + b.h + Math.sin(t * 1.1 + b.ph) * 0.2, z, yaw, Math.sin(t * 9 + b.ph * 3) * 0.6, 1.6);
        });
        birds.L.instanceMatrix.needsUpdate = birds.R.instanceMatrix.needsUpdate = true;
      } });
    }
    if (corrupt < 0.45) {
      const flies = flock(Math.round(9 * QUALITY), 0.13, 0.08, 0.08, 0xffffff, true);
      if (flies) animated.push({ update(t) {
        flies.items.forEach((b, i) => {
          const a = t * (0.5 + b.sp) + b.ph;
          const x = b.cx * 0.6 + Math.sin(a * 0.9) * b.rx * 0.5, z = b.cz * 0.6 + Math.cos(a * 0.7) * b.rz * 0.5;
          const yaw = Math.atan2(Math.cos(a * 0.9) * b.rx * 0.45, -Math.sin(a * 0.7) * b.rz * 0.35);
          place(flies, i, x, 0.42 + Math.sin(a * 1.9) * 0.14, z, yaw, 0.15 + (Math.sin(t * 22 + b.ph * 5) * 0.5 + 0.5) * 1.1, 1.4);
        });
        flies.L.instanceMatrix.needsUpdate = flies.R.instanceMatrix.needsUpdate = true;
      } });
    }
    // cloud shadows: soft noise scrolling over the ground, under every unit
    const w = cols + border * 2, h = rows + border * 2;
    const cloudMat = new THREE.ShaderMaterial({
      uniforms: { uTime: fxTime },
      transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec2 vP; uniform float uTime;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
        void main(){ vec2 q = vP * 0.11 + vec2(uTime * 0.018, uTime * 0.007);
          float n = vn(q) * 0.62 + vn(q * 2.3 + 7.0) * 0.38;
          float a = smoothstep(0.5, 0.72, n) * 0.25;
          gl_FragColor = vec4(0.06, 0.09, 0.16, a);
          #include <encodings_fragment>
        }`,
    });
    const cloud = new THREE.Mesh(new THREE.PlaneGeometry(w + 8, h + 8), cloudMat);
    cloud.rotation.x = -Math.PI / 2; cloud.position.y = 0.045; cloud.renderOrder = 0; cloud.name = 'cloudShadows';
    if (corrupt < 0.72) scene.add(cloud);
  }

  // -------- hit-triggered health bars --------
  // A bar appears above an enemy when it is hit and shrinks away about two
  // seconds later, so a big wave stays clean and only the fights that matter
  // show numbers. Two InstancedMeshes (dark backing, colored fill), drawn on
  // top of the scene and oriented to the fixed camera. Bosses keep their own bar.
  const BAR_POOL = 36, BAR_SHOW = 2.2;
  const BAR_LIFT = { grunt: 1.35, trickster: 1.55, troll: 2.0, bat: 0.55 };
  const BAR_W = { grunt: 0.62, trickster: 0.6, troll: 0.95, bat: 0.55 };
  let barBack = null, barFill = null;
  const _bq = new THREE.Quaternion(), _bp = new THREE.Vector3(), _bs = new THREE.Vector3(), _bm = new THREE.Matrix4(), _bc = new THREE.Color();
  function buildHealthBars() {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mk = (color, order) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true, fog: false }), BAR_POOL);
      m.frustumCulled = false; m.renderOrder = order;
      m.setColorAt(0, _bc.set(0xffffff));   // creates the color buffer at full pool size...
      m.count = 0;                          // ...so shrink the drawn count only afterwards
      scene.add(m);
      return m;
    };
    barBack = mk(0x1b1410, 5);
    barFill = mk(0xffffff, 6);
  }
  function updateHealthBars(dt) {
    if (!barBack) return;
    _bq.copy(camera.quaternion);
    let n = 0;
    for (const v of enemyViews.values()) {
      if (v.barT === undefined || v.barT <= 0) continue;
      v.barT -= dt;
      const e = v.e;
      if (e.boss || n >= BAR_POOL) continue;
      const w = BAR_W[e.type] || 0.6, hgt = 0.11;
      const frac = Math.max(0, Math.min(1, e.hp / e.maxHp));
      const open = Math.min(1, v.barT / 0.35, (BAR_SHOW - v.barT) / 0.12 + 0.2);   // grows in fast, shrinks out at the end
      const k = Math.max(0.001, Math.min(1, open));
      const lift = BAR_LIFT[e.type] || 1.4;
      _bp.set(v.group.position.x, (e.flying ? BAT_HEIGHT : 0) + lift, v.group.position.z);
      _bs.set((w + 0.06) * k, (hgt + 0.05) * k, 1);
      _bm.compose(_bp, _bq, _bs); barBack.setMatrixAt(n, _bm);
      // fill is left-anchored: shift it along the camera's right axis
      const off = -(w * (1 - frac)) / 2;
      _bp.addScaledVector(camRight, off * k);
      _bs.set(Math.max(0.001, w * frac * k), hgt * k, 1);
      _bm.compose(_bp, _bq, _bs); barFill.setMatrixAt(n, _bm);
      barFill.setColorAt(n, _bc.setHex(frac > 0.6 ? 0x6fd15a : frac > 0.3 ? 0xf2c14e : 0xe0503e));
      n++;
    }
    barBack.count = barFill.count = n;
    if (n) {
      barBack.instanceMatrix.needsUpdate = barFill.instanceMatrix.needsUpdate = true;
      if (barFill.instanceColor) barFill.instanceColor.needsUpdate = true;
    }
  }

  // -------- drifting clouds --------
  // Soft flat-shaded puffs riding high above the far and near edges of the
  // valley (never over the towers, so play stays readable). One instanced
  // mesh; they also give the cloud shadows on the ground something to belong to.
  function buildClouds() {
    let sum = 0, cnt = 0;
    for (let r = 0; r < rows; r += 2) for (let c = 0; c < cols; c += 2) { sum += GameState.zoneFalloff(c, r); cnt++; }
    const corrupt = sum / Math.max(1, cnt);
    const vt = levelTheme();
    const rng = srand(31337);
    const clouds = [], PUFFS_PER = 6, N = Math.max(3, Math.round(5 * QUALITY + 0.5));
    for (let i = 0; i < N; i++) {
      const far = i % 2 === 0;
      const puffs = [];
      for (let k = 0; k < PUFFS_PER; k++) puffs.push({ dx: (k - 2.5) * 0.9 + (rng() - 0.5) * 0.4, dy: (rng() - 0.3) * 0.35, dz: (rng() - 0.5) * 0.7, r: 0.85 + rng() * 0.7 - Math.abs(k - 2.5) * 0.12 });
      // u: along the screen's horizontal; vr: how far beyond the valley's far or near edge
      clouds.push({ u: (rng() - 0.5) * (Math.max(cols, rows) + 26), far, vr: rng(), y: 4.6 + rng() * 1.2, sp: 0.16 + rng() * 0.12, puffs });
    }
    const total = N * PUFFS_PER;
    const tint = lerpColor(0xf6f9ff, vt.backdrop, Math.min(0.5, corrupt * 0.6));
    const mat = new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.7, depthWrite: false, fog: false });
    const mesh = new THREE.InstancedMesh(GEO.sphereLo, mat, total);
    mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.name = 'clouds';
    scene.add(mesh);
    const span = Math.max(cols, rows) + 26, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    animated.push({ update(t) {
      // the layout turns with the view, so the clouds always ride the screen's far and near edges
      const yaw = THREE.MathUtils.degToRad(CONFIG.cameraYaw + view.deg);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const ext = Math.abs(fx) * cols / 2 + Math.abs(fz) * rows / 2;
      let i = 0;
      for (const c of clouds) {
        const u = ((c.u + t * c.sp + span / 2) % span + span) % span - span / 2;
        // near clouds sit high, so at a low tilt they project up over the valley unless they sit further out
        const v = c.far ? ext + 3 + c.vr * 2.5 : -(ext + 2 + c.y / Math.tan(THREE.MathUtils.degToRad(tilt.deg)) + c.vr * 2);
        for (const pf of c.puffs) {
          const pu = u + pf.dx, pv = v + pf.dz;
          p.set(rx * pu + fx * pv, c.y + pf.dy, rz * pu + fz * pv); sc.set(pf.r * 1.25, pf.r * 0.75, pf.r * 0.9);
          m4.compose(p, q, sc); mesh.setMatrixAt(i++, m4);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    } });
  }

  // -------- camera director --------
  // Everything the camera does beyond shake: a slow drift on the title
  // screen, a push-in on a boss entrance and a punch on a boss death. It moves
  // by panning along the camera's own axes and zooming the ortho frustum, so
  // picking and outlines follow automatically. Runs on wall-clock time.
  const dir = { shot: null, punch: 0, punchDur: 1, punchAmt: 0 };
  const _cv = new THREE.Vector3();
  const easeS = (x) => x * x * (3 - 2 * x);
  function bossShot(e) { dir.shot = { e, t: 0, dur: 2.8, zoom: 1.34 }; }
  function zoomPunch(amt, dur = 0.7) { dir.punchAmt = amt; dir.punchDur = dur; dir.punch = dur; }
  const camState = { zoom: 1, px: 0, py: 0 };
  function updateCameraDirector(dt) {
    let zoom = 1, px = 0, py = 0;
    if (GameState.state.phase === 'title') {
      zoom = 1.035 + Math.sin(fxT * 0.13) * 0.018;
      px = Math.sin(fxT * 0.11) * 0.8; py = Math.sin(fxT * 0.083 + 1) * 0.35;
    }
    const sh = dir.shot;
    if (sh) {
      sh.t += dt;
      const k = sh.t / sh.dur;
      if (k >= 1) dir.shot = null;
      else {
        const env = k < 0.3 ? easeS(k / 0.3) : k < 0.62 ? 1 : 1 - easeS((k - 0.62) / 0.38);
        zoom += (sh.zoom - 1) * env;
        _cv.set(sh.e.x, 0.9, sh.e.z).applyMatrix4(camera.matrixWorldInverse);
        px += (_cv.x - (camera.left + camera.right) / 2) * env * 0.8;
        py += (_cv.y - (camera.top + camera.bottom) / 2) * env * 0.8;
      }
    }
    if (dir.punch > 0) {
      dir.punch = Math.max(0, dir.punch - dt);
      const k = dir.punch / dir.punchDur;
      zoom += dir.punchAmt * k * k;
    }
    // leaving the title drops the drift at once (the map screen covers the cut),
    // so the first tap of a game never lands on a still-easing camera
    const onTitle = GameState.state.phase === 'title';
    if (dir.wasTitle && !onTitle) { camState.zoom = zoom; camState.px = px; camState.py = py; }
    dir.wasTitle = onTitle;
    // ease toward the target so nothing snaps when a shot starts or ends
    const f = 1 - Math.exp(-dt * 9);
    camState.zoom += (zoom - camState.zoom) * f; camState.px += (px - camState.px) * f; camState.py += (py - camState.py) * f;
    updateLook(dt);
    const zTotal = camState.zoom * look.zoom;
    if (Math.abs(camera.zoom - zTotal) > 1e-4) {
      camera.zoom = zTotal; camera.updateProjectionMatrix();
      outlineMat.uniforms.thickness.value = CONFIG.outlinePx * unitsPerPixel / zTotal;
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
    { // a tower throws a trailing shadow away from the sun, like the props do
      const sh = new THREE.Mesh(GEO.shadowDisc, castShadowMat());
      sh.renderOrder = 1; sh.position.set(0.3, 0.012, -0.22); sh.rotation.y = -SUN_AWAY; sh.scale.set(0.78, 1, 0.42);
      g.add(sh);
    }
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
    // the coils spin up and the muzzle swells as the turret charges, then the
    // barrel kicks back with the shot; the gunner's helmet light wobbles
    slinger(v, pull, recoil, t) {
      v.live.barrel.position.z = v.base.barrel.p.z - recoil * 0.1;
      v.live.muzzle.position.z = v.base.muzzle.p.z - recoil * 0.1;
      v.live.muzzle.scale.setScalar(v.base.muzzle.s.x * (1 + pull * 1.6 + recoil * 0.8));
      v.live.coil.rotation.z += 0.02 + pull * 0.4;
      v.live.coil2.rotation.z -= 0.02 + pull * 0.4;
      for (const n of ['coil', 'coil2']) v.live[n].position.z = v.base[n].p.z - recoil * 0.1;
      v.live.dish.rotation.y = t * 1.6 + v.tower.id;
      v.live.helmKnob.scale.setScalar(v.base.helmKnob.s.x * (0.8 + 0.4 * Math.abs(Math.sin(t * 3 + v.tower.id))));
      v.group.rotation.x = -pull * 0.06 + recoil * 0.12;
    },
    // the mortar tips back as it loads, then lobs its goo ball; the tank
    // bubbles and its drip light pulses the whole time
    warden(v, pull, recoil, t) {
      const raise = pull * 0.9 - recoil * 0.5;
      for (const n of ['staff', 'thornBall', 'thorn1', 'thorn2']) {
        const b = v.base[n];
        v.live[n].position.y = b.p.y + raise * 0.1;
        v.live[n].position.z = b.p.z - raise * 0.12;
        v.live[n].rotation.x = b.r.x - raise * 0.3;
      }
      const thrown = recoil > 0.5;
      v.live.thornBall.visible = v.live.thorn2.visible = !thrown;
      v.live.thornBall.scale.setScalar(v.base.thornBall.s.x * (1 + Math.sin(t * 9 + v.tower.id) * 0.06));
      v.live.brew.position.y = v.base.brew.p.y + Math.abs(Math.sin(t * 5 + v.tower.id)) * 0.012;
      const fl = 0.75 + 0.35 * Math.abs(Math.sin(t * 6 + v.tower.id) * Math.sin(t * 2.3));
      v.live.flame.scale.set(v.base.flame.s.x, v.base.flame.s.y * fl, v.base.flame.s.z);
      v.group.rotation.x = -pull * 0.08 + recoil * 0.12;
    },
    // the frost orb swells as it gathers cold, then lurches as it fires
    druid(v, pull, recoil, t) {
      const hover = Math.sin(t * 3 + v.tower.id) * 0.03;
      const rise = pull * 0.06 - recoil * 0.04;
      for (const n of ['orb', 'orbCore']) {
        const b = v.base[n];
        v.live[n].position.y = b.p.y + hover + rise;
        v.live[n].position.z = b.p.z + recoil * 0.15;
      }
      v.live.orb.scale.setScalar(v.base.orb.s.x * (1 + pull * 0.6 + Math.sin(t * 8) * 0.08));
      v.live.orb.rotation.y = t * 3;
      v.live.dish.rotation.z = Math.sin(t * 1.3 + v.tower.id) * 0.15;
      v.group.rotation.x = recoil * 0.08;
    },
    // the mech draws its fist back over its shoulder, then fires it down the
    // road as a rocket; a fresh fist slides out as it comes back to guard
    golem(v, pull, recoil, t) {
      const ang = 1.2 - pull * 1.3 + recoil * 0.5;
      for (const n of ['piston', 'fist', 'knuckle', 'thumb']) {
        v.live[n].matrixAutoUpdate = false;
        fistPose(n, ang, v.live[n].matrix);
      }
      v.live.fist.visible = v.live.knuckle.visible = v.live.thumb.visible = recoil < 0.35;
      v.live.armL.rotation.x = v.base.armL.r.x + Math.sin(t * 1.6 + v.tower.id) * 0.06;
      v.live.armR.rotation.x = v.base.armR.r.x + Math.sin(t * 1.6 + v.tower.id) * 0.06;
      const breathe = 1 + Math.sin(t * 1.4 + v.tower.id) * 0.03;
      for (const n of ['shoulders', 'shoulders2']) v.live[n].scale.set(v.base[n].s.x * breathe, v.base[n].s.y, v.base[n].s.z * breathe);
      v.live.crest.rotation.z = Math.sin(t * 2 + v.tower.id) * 0.12 - pull * 0.2;
      v.group.rotation.x = -pull * 0.06 + recoil * 0.14;
    },
    // the launcher tips up to aim high, then the salvo leaves the tubes; the
    // radar dish never stops turning
    artillery(v, pull, recoil, t) {
      const tip = -pull * 0.25 + recoil * 0.1;
      v.live.pod.rotation.x = v.base.pod.r.x + tip;
      for (let i = 0; i < 4; i++) {
        const m = v.live[`m${i}`];
        m.matrixAutoUpdate = false;
        podTip(i, tip, m.matrix);
        m.visible = recoil < 0.25;
      }
      v.live.radar.rotation.y = t * 2.2 + v.tower.id;
      v.live.feather.scale.setScalar(v.base.feather.s.x * (0.8 + 0.4 * Math.abs(Math.sin(t * 2.6 + v.tower.id))));
      v.group.rotation.x = -pull * 0.08 + recoil * 0.1;
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
    // walkers and saucers are rigged (limbs animated in the shader); other bosses keep their own rig
    let rig = null;
    if ((!e.boss || WALKER_BOSSES.has(e.type)) && RIG_PIVOTS[e.type]) { rig = makeRig(e.type); rig.mats = makeRigMats(rig); }
    const g = liveProp(ENEMY_RECIPES[e.type](), e.x, 0, e.z, { ao: !e.flying, rim: true, rig });
    g.name = `enemy-${e.id}`;
    const big = e.type === 'troll' ? 0.45 : ROLLERS.has(e.type) ? 0.85 : WALKER_BOSSES.has(e.type) ? 0.62 : e.type === 'sandworm' ? 0.7 : 0.3;
    const v = { group: g, e, rig, decal: decal(0, 0, big, g), decalR: big, pop: 0, live: {} };
    g.traverse((o) => { if (o.name && o !== g) v.live[o.name] = o; });
    if (ROLLERS.has(e.type)) {
      // the rolling ground bosses: live wheels, nose and flag, no limb rig
      v.walk = WALK[e.type];
      v.base = {};
      for (const k in v.live) v.base[k] = { p: v.live[k].position.clone(), r: v.live[k].rotation.clone() };
    } else if (WALKER_BOSSES.has(e.type)) {
      v.walk = WALK[e.type];
    } else if (e.type === 'sandworm') {
      v.trail = [];
    } else if (e.boss) {
      v.decal.scale.setScalar(e.type === 'manta' ? 0.8 : e.type === 'mothership' ? 1.0 : 0.7);
      v.k = e.type === 'mothership' ? 1.35 : 1;
      v.breath = 2 + fxRand() * 2;
      v.heart0 = v.live.heart ? v.live.heart.scale.clone() : null;
      if (v.live.wingL) { v.live.wingL.matrixAutoUpdate = false; v.live.wingR.matrixAutoUpdate = false; }
      if (v.live.beam) { v.live.beam.material = unlit(PALETTE.spore, { opacity: 0.22, depthWrite: false }); v.live.beam.renderOrder = 3; }
    } else if (e.flying) {
      v.decal.scale.setScalar(0.22);
    } else {
      v.walk = WALK[e.type];
    }
    // status effect dressing: frost crystals when chilled, a goo puddle when stuck
    v.frost = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(GEO.cone, unlit(PALETTE.frost));
      const a = i * 2.1;
      c.position.set(Math.cos(a) * 0.2, 0.25 + i * 0.08, Math.sin(a) * 0.2);
      c.scale.set(0.05, 0.14, 0.05); c.rotation.z = Math.cos(a) * 0.5; c.rotation.x = Math.sin(a) * 0.5;
      v.frost.add(c);
    }
    v.frost.visible = false; g.add(v.frost);
    // stuck in a goo cannon's goo: a lime puddle with a few bubbles
    v.roots = new THREE.Group();
    const pool = new THREE.Mesh(GEO.circle, unlit(PALETTE.goo));
    pool.position.y = 0.02; pool.scale.setScalar(0.3);
    v.roots.add(pool);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(GEO.bead, toon(PALETTE.gooDark));
      b.position.set(Math.cos(i * 2.3) * 0.2, 0.04, Math.sin(i * 2.3) * 0.18); b.scale.set(0.05, 0.035, 0.05);
      v.roots.add(b);
    }
    v.roots.visible = false; g.add(v.roots);
    enemyViews.set(e.id, v);
    puff(e.x, e.flying ? BAT_HEIGHT : 0.3, e.z, { count: e.boss ? 24 : 7, color: e.flying ? PALETTE.batDark : PALETTE.spore, speed: e.boss ? 2 : 0.8, size: e.boss ? 0.16 : 0.09, up: 1.2 });
    return v;
  }
  // per-limb walk poses for the walking bosses: (rig angles, the stride's sine, wall time, cycle)
  const BOSS_GAIT = {
    // a wobbling waddle: arms wave, feet slap, the crown tips
    gloopking(rig, sn, t, cycle) {
      rig[1].set(-sn * 0.4, 0.3 + Math.sin(t * 3) * 0.2, 0, 0); rig[2].set(sn * 0.4, -0.3 - Math.sin(t * 3 + 1) * 0.2, 0, 0);
      rig[3].set(sn * 0.5, 0, Math.max(0, sn) * 0.06, 0); rig[4].set(-sn * 0.5, 0, Math.max(0, -sn) * 0.06, 0);
      rig[8].set(0, Math.sin(cycle + 0.6) * 0.25, 0, 0);
    },
    // four legs in diagonal pairs, the scythes raised and chopping, wings buzzing
    hivequeen(rig, sn, t) {
      rig[3].set(sn * 0.5, 0, 0, 0); rig[6].set(sn * 0.5, 0, 0, 0);
      rig[4].set(-sn * 0.5, 0, 0, 0); rig[5].set(-sn * 0.5, 0, 0, 0);
      rig[1].set(-0.3 + Math.sin(t * 2.6) * 0.4, 0, 0, 0); rig[2].set(-0.3 + Math.sin(t * 2.6 + 1.6) * 0.4, 0, 0, 0);
      rig[7].set(Math.sin(t * 40) * 0.12, 0, 0, 0);
      rig[8].set(Math.sin(t * 1.7) * 0.08, Math.sin(t * 1.3) * 0.12, 0, 0);
    },
    // three legs stepping in turn, the ray arms sweeping, the aerial nodding
    tripod(rig, sn, t, cycle) {
      for (let k = 0; k < 3; k++) { const ph = Math.sin(cycle * 0.67 + k * 2.09); rig[3 + k].set(ph * 0.22, 0, Math.max(0, ph) * 0.05, 0); }
      rig[1].set(Math.sin(t * 1.4) * 0.3, 0, 0, 0); rig[2].set(Math.sin(t * 1.4 + 2) * 0.3, 0, 0, 0);
      rig[8].set(0, Math.sin(t * 2.2) * 0.3, 0, 0);
    },
  };
  function updateEnemyViews(t, dt) {
    for (const v of enemyViews.values()) {
      const e = v.e, g = v.group;
      v.frost.visible = !!e.chilled;
      v.roots.visible = !!e.rooted;
      if (e.chilled) v.frost.rotation.y = t * 2;
      if (e.type === 'manta') { updateDragonView(v, t, dt); continue; }
      if (e.type === 'sandworm') { updateWormView(v, t, dt); continue; }
      if (ROLLERS.has(e.type)) { updateRamView(v, t, dt); continue; }
      if (e.boss && !WALKER_BOSSES.has(e.type)) { updateBossView(v, t, dt); continue; }
      if (e.flying) { updateBatView(v, t, dt); continue; }
      const w = v.walk;
      const cycle = e.dist * w.freq;
      const bounce = e.rooted ? 0 : Math.abs(Math.sin(cycle));
      const struggle = e.rooted ? Math.sin(t * 30) * 0.03 : 0;
      const born = Math.min(1, e.age / 0.35);   // pop out of the pod
      g.position.set(e.x + struggle, w.bounce * bounce, e.z);
      g.rotation.y = Math.atan2(e.dirX, e.dirZ);
      g.rotation.x = w.lean;
      g.rotation.z = Math.sin(cycle) * w.sway + struggle * 4;
      if (!e.rooted) g.rotation.y += Math.sin(cycle) * w.sway * 0.9;   // shoulders twist against the stride
      // a footfall: the moment the hop lands, the heavy walkers kick up dust
      const step = Math.floor(cycle / Math.PI);
      if (v.lastStep !== undefined && step !== v.lastStep && !e.rooted && e.age > 0.4 && (e.type === 'troll' || e.type === 'grunt' || e.boss)) {
        const heavy = e.type === 'troll' || e.boss;
        puff(e.x, 0.05, e.z, { count: e.boss ? 6 : heavy ? 3 : 1, color: PALETTE.path, speed: e.boss ? 1 : 0.6, size: e.boss ? 0.14 : heavy ? 0.09 : 0.06, up: 0.5, ttl: 0.4 });
        if (e.type === 'gloopking' || e.type === 'tripod') shakeCamera(0.035, 0.18);   // the ground shakes under each step
      }
      v.lastStep = step;
      // a blob squashes and stretches far more than anything with bones
      const squishy = e.type === 'grunt' || e.type === 'gloopking' ? 1.6 : 1;
      const stretch = 0.9 + 0.22 * bounce * squishy;
      v.pop = Math.max(0, v.pop - dt * 5);
      const popK = Math.sin(Math.min(1, v.pop) * Math.PI) * 0.35;   // scale-pop when hit
      const s = born * (1 - (1 - born) * 0.5);
      g.scale.set(s * (1.06 - 0.1 * bounce * squishy + popK), s * (stretch - popK * 0.6), s * (1.06 - 0.1 * bounce * squishy + popK)).multiplyScalar(ENEMY_K);
      const flap = 0.35 + 0.45 * bounce;
      // per-limb pose: arms swing against the legs, legs swing and lift, antennae wave.
      // Angles are (about X, about Z, lift Y, shift Z) at each limb's pivot.
      const sn = Math.sin(cycle), rig = v.rig.ang;
      if (e.rooted) {
        // stuck in the goo: everything flails
        const f = Math.sin(t * 26 + e.id);
        rig[1].set(f * 1.1, 0.3, 0, 0); rig[2].set(-f * 1.1, -0.3, 0, 0);
        rig[3].set(-f * 0.4, 0, 0, 0); rig[4].set(f * 0.4, 0, 0, 0);
      } else if (BOSS_GAIT[e.type]) {
        BOSS_GAIT[e.type](rig, sn, t, cycle);
      } else if (e.type === 'troll') {
        // a heavy armored stomp: the claws swing and snap against the stride
        rig[1].set(-sn * 0.4, 0.1 + Math.max(0, Math.sin(t * 5 + e.id)) * 0.2, 0, 0); rig[2].set(sn * 0.4, -0.1 - Math.max(0, Math.sin(t * 5 + e.id + 2)) * 0.2, 0, 0);
        rig[3].set(sn * 0.5, 0, Math.max(0, sn) * 0.04, 0); rig[4].set(-sn * 0.5, 0, Math.max(0, -sn) * 0.04, 0);
      } else if (e.type === 'trickster') {
        // a scuttle: the two tripods of legs swing in turn, pincers snap, the tail sways
        rig[1].set(0, Math.max(0, Math.sin(t * 14 + e.id)) * 0.5, 0, 0); rig[2].set(0, -Math.max(0, Math.sin(t * 14 + e.id + 1)) * 0.5, 0, 0);
        rig[3].set(sn * 0.55, 0, Math.max(0, sn) * 0.04, 0); rig[4].set(-sn * 0.55, 0, Math.max(0, -sn) * 0.04, 0);
        rig[8].set(0, sn * 0.25, 0, 0);
      } else {
        // blob drone: the gun arm bobs its ray gun up and down, the other arm counter-swings
        rig[1].set(-sn * 0.9, 0.1, 0, 0);
        rig[2].set(sn * 0.45 - 0.2, -0.1, 0, 0);
        rig[3].set(sn * 0.8, 0, Math.max(0, sn) * 0.05, 0); rig[4].set(-sn * 0.8, 0, Math.max(0, -sn) * 0.05, 0);
      }
      if (e.type === 'grunt' || e.type === 'trickster') {
        const k = e.type === 'trickster' ? 0.8 : 1;
        rig[5].set(0, flap * k * (e.type === 'grunt' ? Math.sin(cycle * 0.5) : 1), 0, 0); rig[6].set(0, -flap * k, 0, 0);
      }
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
    const ship = e.type === 'mothership';
    g.position.set(e.x, BOSS_HEIGHT + bob + (ship ? 0.35 : 0), e.z);
    g.rotation.y = Math.atan2(e.dirX, e.dirZ);
    g.rotation.z = ship ? Math.sin(t * 0.9) * 0.06 : 0;
    g.scale.setScalar(born * (1 + popK) * (v.k || 1));
    v.live.heart.scale.copy(v.heart0).multiplyScalar(1 + Math.sin(t * 9) * 0.2 + popK * 5);
    v.live.core.rotation.y = t * (ship ? 1.6 : 0.8); v.live.core.rotation.x = ship ? 0 : Math.sin(t) * 0.3;
    if (v.live.beam) {
      // the tractor beam flickers and sweeps the ground under the ship
      v.live.beam.scale.set(0.34 * (1 + Math.sin(t * 7) * 0.08), 0.9, 0.34 * (1 + Math.sin(t * 7) * 0.08));
      v.live.beam.material.opacity = 0.16 + 0.08 * Math.sin(t * 11) * Math.sin(t * 3.7);
    }
    const alive = Math.max(1, Math.ceil(BOSS_CROWS * e.hp / e.maxHp));
    for (let i = 0; i < BOSS_CROWS; i++) {
      const show = i < alive;
      const a = t * (ship ? 1.1 : 2.2) + i * (Math.PI * 2 / BOSS_CROWS);
      const r = (ship ? 0.95 : 0.55) + Math.sin(t * 3 + i) * 0.08, y = Math.sin(t * 4 + i * 1.3) * 0.16;
      const body = v.live[`crow${i}`], wing = v.live[`crowWing${i}`], beak = v.live[`crowBeak${i}`];
      body.visible = wing.visible = beak.visible = show;
      if (!show) continue;
      body.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      body.rotation.y = -a;   // nose along the orbit
      wing.position.copy(body.position);
      if (ship) { wing.position.y += 0.03; wing.rotation.set(0, 0, 0); }
      else { wing.rotation.y = -a; wing.rotation.z = Math.sin(t * 20 + i) * 0.7; }
      beak.position.set(Math.cos(a) * r - Math.sin(a) * 0.14, y, Math.sin(a) * r + Math.cos(a) * 0.14);
      beak.rotation.set(Math.PI / 2, 0, 0); beak.rotation.y = -a;
    }
    v.decal.position.y = -(g.position.y) / Math.max(0.01, g.scale.y) + 0.012;
    v.decal.scale.setScalar(0.7 - bob * 0.5);
  }
  // The Sky Manta glides with slow heavy wingbeats, its body rising on each
  // downstroke, and every few seconds it opens its mouth and sprays stardust.
  function updateDragonView(v, t, dt) {
    const e = v.e, g = v.group;
    const born = Math.min(1, e.age / 0.8);
    v.pop = Math.max(0, v.pop - dt * 5);
    const popK = Math.sin(Math.min(1, v.pop) * Math.PI) * 0.12;
    const beat = Math.sin(t * 3.4);
    const bob = -beat * 0.1 + Math.sin(t * 1.3) * 0.06;
    g.position.set(e.x, BOSS_HEIGHT + 0.15 + bob, e.z);
    g.rotation.y = Math.atan2(e.dirX, e.dirZ);
    g.rotation.x = beat * 0.04;
    g.rotation.z = Math.sin(t * 0.8) * 0.08;
    g.scale.set(born * (1 + popK), born * (1 - popK * 0.5), born * (1 + popK)).multiplyScalar(v.k || 1);
    const flap = beat * 0.55 + 0.05;
    pivotMatrix(0.2, 0.0, 0.05, 0, 0, flap, 0.55, 0, -0.05, 1.1, 0.035, 1.0, v.live.wingL.matrix);
    pivotMatrix(-0.2, 0.0, 0.05, 0, 0, -flap, -0.55, 0, -0.05, 1.1, 0.035, 1.0, v.live.wingR.matrix);
    v.breath -= dt;
    const open = v.breath < 0.6 ? Math.sin(Math.max(0, v.breath) / 0.6 * Math.PI) : 0;
    v.live.jaw.position.y = -0.04 - open * 0.05;
    v.live.jaw.rotation.x = open * 0.5;
    if (v.breath < 0.45 && v.breath > 0 && fxRand() < 0.6) {
      const fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y);
      puff(e.x + fx * 0.9, g.position.y, e.z + fz * 0.9, { count: 2, color: fxRand() < 0.5 ? PALETTE.neon : PALETTE.flowerPink, speed: 0.9, size: 0.1, up: 0.4, ttl: 0.5 });
    }
    if (v.breath <= 0) v.breath = 2.5 + fxRand() * 1.5;
    v.decal.position.y = -(g.position.y) + 0.012;
    v.decal.scale.setScalar(0.8 - bob * 0.5);
  }
  // The rolling bosses: wheels turn with the distance covered, the Drill
  // Tank's drill spins (the Harvester's reel turns), the crew shuffles.
  function updateRamView(v, t, dt) {
    const e = v.e, g = v.group, w = v.walk;
    const cycle = e.dist * w.freq;
    const bounce = e.rooted ? 0 : Math.abs(Math.sin(cycle));
    const struggle = e.rooted ? Math.sin(t * 30) * 0.02 : 0;
    const born = Math.min(1, e.age / 0.5);
    g.position.set(e.x + struggle, w.bounce * bounce, e.z);
    g.rotation.y = Math.atan2(e.dirX, e.dirZ);
    g.rotation.z = Math.sin(cycle) * w.sway;
    v.pop = Math.max(0, v.pop - dt * 5);
    const popK = Math.sin(Math.min(1, v.pop) * Math.PI) * 0.12;
    g.scale.set(born * (1 + popK), born * (1 - popK * 0.5), born * (1 + popK));
    for (let i = 0; i < 4; i++) v.live[`wheel${i}`].rotation.x = -e.dist * 4.5;
    if (e.type === 'drilltank') {
      v.live.ramHead.rotation.y = t * 14;   // the drill spins about its own axis
      v.live.ram.rotation.y = -t * 3;
      if (fxRand() < 0.25) puff(e.x + e.dirX * 1.1, 0.25, e.z + e.dirZ * 1.1, { count: 1, color: PALETTE.path, speed: 0.8, size: 0.08, up: 0.8, ttl: 0.4 });
    } else {
      v.live.ram.rotation.x = t * 5;   // the reel turns over
      v.live.ramHead.rotation.x = t * 5;
    }
    v.live.flag.rotation.y = Math.sin(t * 5) * 0.4;
    v.live.flagStripe.rotation.y = v.live.flag.rotation.y;
    v.live.footL.position.z = v.base.footL.p.z + Math.sin(cycle * 3) * 0.08;
    v.live.footR.position.z = v.base.footR.p.z - Math.sin(cycle * 3) * 0.08;
    v.decal.scale.setScalar(v.decalR);
  }
  // The Sand Worm swims: its head rides the road with its three jaws
  // opening and closing, and every segment follows the head's own track a
  // little way behind, rising and dipping through the sand like a wave.
  const _wp = { x: 0, z: 0 };
  function updateWormView(v, t, dt) {
    const e = v.e, g = v.group;
    const born = Math.min(1, e.age / 0.8);
    v.pop = Math.max(0, v.pop - dt * 5);
    const popK = Math.sin(Math.min(1, v.pop) * Math.PI) * 0.12;
    g.position.set(e.x, 0, e.z);
    g.rotation.set(0, 0, 0);
    g.scale.setScalar(1);
    const route = GameState.routes[e.route];
    const yaw = Math.atan2(e.dirX, e.dirZ), wave = e.dist * 2.4;
    const head = v.live.head, maw = v.live.maw;
    const hy = (0.36 + Math.sin(wave) * 0.08) * born;
    head.position.set(0, hy, 0); head.rotation.set(-0.25, yaw, 0, 'YXZ');
    head.scale.set(0.34 * born * (1 + popK), 0.32 * born * (1 - popK * 0.5), 0.36 * born * (1 + popK));
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    maw.position.set(fx * 0.3 * born, hy, fz * 0.3 * born); maw.scale.setScalar(0.17 * born);
    const open = 0.45 + 0.35 * Math.sin(t * 4);
    for (let j = 0; j < 3; j++) {
      const jaw = v.live[`jaw${j}`], a = j * 2.09;
      // each jaw hinges at the mouth's rim and splays outward as it opens
      const ox = Math.cos(a) * 0.17, oy = Math.sin(a) * 0.17;
      const wx = Math.cos(yaw) * ox, wz = -Math.sin(yaw) * ox;
      jaw.position.set((fx * 0.38 + wx) * born, hy + oy * born, (fz * 0.38 + wz) * born);
      jaw.rotation.set(Math.PI / 2 - Math.sin(a) * open, yaw, Math.cos(a) * open, 'YXZ');
      jaw.scale.set(0.14 * born, 0.3 * born, 0.08 * born);
    }
    for (let i = 0; i < WORM_SEGS; i++) {
      const d = e.dist - (i + 1) * 0.36 * born;
      GameState.pathPosAt(d, _wp, route);
      const seg = v.live[`seg${i}`], spot = v.live[`spot${i}`];
      const k = 1 - i / (WORM_SEGS + 2);
      const up = Math.sin(wave - (i + 1) * 0.9);
      const y = (0.12 + 0.18 * k + up * 0.1) * born;
      seg.position.set(_wp.x - e.x, y, _wp.z - e.z);
      seg.visible = born > 0.15 && d > -0.2;
      spot.position.set(_wp.x - e.x, y + 0.27 * k, _wp.z - e.z);
      spot.visible = seg.visible;
    }
    // sand sprays where the head breaks the surface
    if (fxRand() < 0.3) puff(e.x + fx * 0.3, 0.08, e.z + fz * 0.3, { count: 1, color: PALETTE.sand, speed: 0.9, size: 0.1, up: 0.9, ttl: 0.5 });
    if (Math.floor(wave / Math.PI) !== v.lastStep) { v.lastStep = Math.floor(wave / Math.PI); shakeCamera(0.03, 0.15); }
    v.decal.position.set(0, 0.012, 0);
    v.decal.scale.setScalar(0.7);
  }
  function updateBatView(v, t, dt) {
    const e = v.e, g = v.group;
    const born = Math.min(1, e.age / 0.35);
    const flap = Math.sin(t * 9 + e.id) * 0.35;
    const bob = Math.sin(t * 4 + e.id) * 0.08;
    v.pop = Math.max(0, v.pop - dt * 5);
    const popK = Math.sin(Math.min(1, v.pop) * Math.PI) * 0.35;
    g.position.set(e.x, BAT_HEIGHT + bob, e.z);
    g.rotation.y = Math.atan2(e.dirX, e.dirZ);
    // a saucer banks into its turns and wobbles as it hovers
    g.rotation.z = Math.sin(t * 2.5 + e.id) * 0.18;
    g.rotation.x = Math.sin(t * 3.1 + e.id) * 0.1 + 0.08;
    g.scale.set(born * (1 + popK), born * (1 - popK * 0.5), born * (1 + popK)).multiplyScalar(ENEMY_K);
    v.rig.ang[1].set(0, flap, 0, 0);
    v.rig.ang[2].set(0, -flap, 0, 0);
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
          puff(g.position.x, 0.4, g.position.z, { count: 6 * big, color: v.e.flying ? PALETTE.neon : v.e.type === 'trickster' ? PALETTE.trickster : PALETTE.goo, speed: 2.2, size: 0.08, up: 2.2, ttl: 0.6 });
          ring(g.position.x, 0.06, g.position.z, { color: v.e.boss ? PALETTE.gold : PALETTE.cream, radius: v.e.boss ? 2.2 : 0.7, ttl: v.e.boss ? 0.9 : 0.45 });
          spark(g.position.x, 0.5, g.position.z, PALETTE.gold, v.e.boss ? 8 : 3);
          if (v.e.boss) { puff(g.position.x, 0.6, g.position.z, { count: 16, color: PALETTE.gold, speed: 3, size: 0.1, up: 2.5, ttl: 0.9 }); shakeCamera(0.16, 0.6); }
        }
      },
    });
  }

  // Leak: the invader barges through the gate with a spin and a puff.
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
    puff(gate.x, 0.3, gate.z + 0.1, { count: 10, color: PALETTE.hullDark, speed: 1.4, size: 0.11 });
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
    GameState.on('enemyKilled', (e) => { removeEnemyView(e, deathExit); if (e.boss) zoomPunch(0.16, 0.8); });
    GameState.on('enemySpawned', (e) => { if (e.boss) { bossShot(e); shakeCamera(0.14, 1.1); } });
    GameState.on('enemyHit', ({ enemy, x, z }) => {
      const v = enemyViews.get(enemy.id);
      if (v) { v.pop = 1; v.barT = BAR_SHOW; }
      puff(x, 0.45, z, { count: 3, color: PALETTE.cream, speed: 1.0, size: 0.06, up: 1.0, ttl: 0.35 });
      spark(x, 0.5, z, enemy.armor ? PALETTE.steel : PALETTE.goo, 2);
    });
    GameState.on('towerFired', ({ tower }) => {
      const v = towerViews.get(tower.id);
      if (v) v.recoil = 1;
      if (tower.type === 'golem') shakeCamera(0.04, 0.2);
      // muzzle flash: a tiny bright burst at the tower's business end
      const fx = tower.x + Math.sin(tower.facing) * 0.3, fz = tower.z + Math.cos(tower.facing) * 0.3;
      spark(fx, tower.type === 'artillery' ? 0.75 : tower.type === 'slinger' ? 0.6 : 0.85, fz, tower.type === 'druid' ? PALETTE.frost : tower.type === 'warden' ? PALETTE.goo : tower.type === 'slinger' ? PALETTE.capRed : tower.type === 'artillery' ? PALETTE.ember : PALETTE.cream, 2);
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
        // the goo ball bursts: a splat of lime goo and a few bubbles
        puff(x, 0.2, z, { count: 14, color: PALETTE.goo, speed: 2.2, size: 0.09, up: 0.9, ttl: 0.55 });
        puff(x, 0.25, z, { count: 6, color: PALETTE.gooDark, speed: 1.4, size: 0.08, up: 1.6, ttl: 0.45 });
        ring(x, 0.06, z, { color: PALETTE.goo, radius: 0.9, ttl: 0.45 });
        spark(x, 0.3, z, PALETTE.cream, 4);
      } else if (p.kind === 'wisp') {
        puff(x, y, z, { count: 6, color: PALETTE.frost, speed: 1.2, size: 0.07, up: 0.6, ttl: 0.45 });
        ring(x, flying ? BAT_HEIGHT : 0.1, z, { color: PALETTE.frost, radius: 0.45, ttl: 0.35 });
      } else if (p.kind === 'boulder') {
        // the rocket fist lands: dust, sparks and a shockwave
        puff(x, 0.2, z, { count: 12, color: PALETTE.path, speed: 2.0, size: 0.11, up: 1.6, ttl: 0.6 });
        ring(x, 0.06, z, { color: PALETTE.hazard, radius: 1.1, ttl: 0.5 });
        spark(x, 0.3, z, PALETTE.ember, 5);
        shakeCamera(0.1, 0.3);
      } else if (p.kind === 'bigacorn') {
        // the salvo detonates: a pink-orange fireball and smoke
        puff(x, y, z, { count: 10, color: PALETTE.ember, speed: 2.4, size: 0.09, up: 1.8, ttl: 0.55 });
        puff(x, y, z, { count: 8, color: PALETTE.flowerPink, speed: 1.4, size: 0.12, up: 1.0, ttl: 0.7 });
        ring(x, flying ? BAT_HEIGHT : 0.06, z, { color: PALETTE.hazard, radius: 0.85, ttl: 0.45 });
        spark(x, y, z, PALETTE.gold, 4);
        shakeCamera(0.06, 0.25);
      } else if (p.kind === 'acorn') {
        spark(x, y, z, PALETTE.capRed, 3);
      }
    });
  }

  // -------- camera --------
  const camBase = new THREE.Vector3(), camRight = new THREE.Vector3(), camUp = new THREE.Vector3();
  // -------- player zoom and pan --------
  // Layered on top of the camera director: `look.zoom` multiplies the director's
  // zoom, and `look.px/py` pan along the camera's own axes (world units). The
  // `t*` fields are targets the live values ease toward. Zooming out past 1 shows
  // the valley's surroundings; zooming in lets the player drag around, but never
  // past the edge of the original framing.
  const ZOOM_MIN = 0.75, ZOOM_MAX = 2.5;
  const look = { zoom: 1, tz: 1, px: 0, py: 0, tx: 0, ty: 0 };
  const fit = { hw: 1, hh: 1 };
  function clampLook() {
    look.tz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, look.tz));
    const z = Math.max(1, look.tz), mx = fit.hw * (1 - 1 / z), my = fit.hh * (1 - 1 / z);
    look.tx = Math.min(mx, Math.max(-mx, look.tx));
    look.ty = Math.min(my, Math.max(-my, look.ty));
  }
  // zoom by `factor` keeping the point under screen (sx, sy) where it is
  function zoomAt(factor, sx = cssW / 2, sy = cssH / 2) {
    const old = look.tz;
    look.tz = old * factor;
    clampLook();
    const k = 1 / old - 1 / look.tz;
    look.tx += ((sx / cssW) * 2 - 1) * fit.hw * k;
    look.ty += (-(sy / cssH) * 2 + 1) * fit.hh * k;
    clampLook();
    return look.tz;
  }
  // drag the map by (dx, dy) screen pixels; follows the finger at once
  function panBy(dx, dy) {
    if (look.tz <= 1.001) return;
    look.tx -= dx * unitsPerPixel / look.zoom; look.ty += dy * unitsPerPixel / look.zoom;
    clampLook();
    look.px = look.tx; look.py = look.ty;
  }
  function resetLook() { look.tz = 1; look.tx = look.ty = 0; }
  function updateLook(dt) {
    const f = 1 - Math.exp(-dt * 12);
    look.zoom += (look.tz - look.zoom) * f; look.px += (look.tx - look.px) * f; look.py += (look.ty - look.py) * f;
    if (Math.abs(look.tz - look.zoom) < 1e-4) look.zoom = look.tz;
    if (Math.abs(look.tx - look.px) < 1e-4) look.px = look.tx;
    if (Math.abs(look.ty - look.py) < 1e-4) look.py = look.ty;
  }

  // The player can turn the view in four fixed steps of 90 degrees around the
  // valley. `deg` is the extra yaw on top of CONFIG.cameraYaw, eased while it
  // turns; `idx` (0 to 3) is the step, saved so a reload keeps it.
  const VIEW_KEY = 'aa-view';
  const view = { idx: 0, deg: 0, from: 0, to: 0, t: 1, dur: 0.55 };
  // The tilt is the camera's elevation above the ground: low shows the valley
  // from the side, high looks nearly straight down. It eases like a turn does,
  // follows a drag at once, and is saved like the view.
  const TILT_KEY = 'aa-tilt', TILT_MIN = 30, TILT_MAX = 80, TILT_STEP = 6;
  const tilt = { deg: 50, from: 50, to: 50, t: 1, dur: 0.4 };
  const clampTilt = (d) => Math.min(TILT_MAX, Math.max(TILT_MIN, d));
  function savedTilt() { try { const v = parseFloat(localStorage.getItem(TILT_KEY)); return Number.isFinite(v) ? clampTilt(v) : CONFIG.cameraElevation; } catch (e) { return CONFIG.cameraElevation; } }
  function saveTilt() { try { localStorage.setItem(TILT_KEY, String(Math.round(tilt.to * 10) / 10)); } catch (e) { /* storage may be blocked */ } }
  // degrees to add; `instant` follows a drag with no easing
  function tiltBy(d, instant = false) {
    const to = clampTilt(tilt.to + d);
    if (instant) { tilt.deg = tilt.from = tilt.to = to; tilt.t = 1; placeCamera(); fitCamera(); }
    else { tilt.from = tilt.deg; tilt.to = to; tilt.t = 0; }
    saveTilt();
    return tilt.to;
  }
  function resetTilt() { return tiltBy(CONFIG.cameraElevation - tilt.to); }
  function savedView() { try { const v = parseInt(localStorage.getItem(VIEW_KEY), 10); return v >= 0 && v < 4 ? v : 0; } catch (e) { return 0; } }
  function saveView() { try { localStorage.setItem(VIEW_KEY, String(view.idx)); } catch (e) { /* storage may be blocked */ } }
  // dir +1 turns the valley clockwise as seen from above, -1 anticlockwise
  function rotateView(dir) {
    dir = dir < 0 ? -1 : 1;
    view.idx = (view.idx + dir + 4) % 4;
    view.from = view.deg; view.to = view.to + dir * 90; view.t = 0;
    look.tx = look.ty = 0;   // the pan belongs to the old angle
    saveView();
    return view.idx;
  }
  function setView(idx, instant = true) {
    idx = ((idx % 4) + 4) % 4;
    if (instant) { view.idx = idx; view.deg = view.from = view.to = idx * 90; view.t = 1; saveView(); placeCamera(); fitCamera(); return idx; }
    let step = idx - view.idx; if (step === 3) step = -1; if (step === -3) step = 1;
    for (let k = 0; k < Math.abs(step); k++) rotateView(Math.sign(step));
    return view.idx;
  }
  function updateView(dt) {
    if (view.t >= 1 && tilt.t >= 1) return;
    if (view.t < 1) {
      view.t = Math.min(1, view.t + dt / view.dur);
      view.deg = view.from + (view.to - view.from) * easeS(view.t);
      if (view.t >= 1) { view.deg = view.to = view.from = view.idx * 90; }   // keep the angle from drifting over many turns
    }
    if (tilt.t < 1) {
      tilt.t = Math.min(1, tilt.t + dt / tilt.dur);
      tilt.deg = tilt.from + (tilt.to - tilt.from) * easeS(tilt.t);
      if (tilt.t >= 1) tilt.deg = tilt.from = tilt.to;
    }
    placeCamera();
    fitCamera();
  }
  // The fog starts just past the valley's far edge. How far that edge is from the
  // camera depends on the turn and the tilt, so it is refreshed with them; at the
  // default view it is exactly the distance the look was tuned with.
  let fogBase = 0, fogRef = 0;
  const farDepth = (yawDeg, elDeg) => {
    const y = THREE.MathUtils.degToRad(yawDeg), e = THREE.MathUtils.degToRad(elDeg);
    return (Math.abs(Math.sin(y)) * cols / 2 + Math.abs(Math.cos(y)) * rows / 2) * Math.cos(e);
  };
  function placeCamera() {
    const el = THREE.MathUtils.degToRad(tilt.deg);
    const yaw = THREE.MathUtils.degToRad(CONFIG.cameraYaw + view.deg);
    if (scene && scene.fog) {
      if (!fogRef) { fogBase = scene.fog.near; fogRef = farDepth(CONFIG.cameraYaw, CONFIG.cameraElevation); }
      scene.fog.near = fogBase + farDepth(CONFIG.cameraYaw + view.deg, tilt.deg) - fogRef;
      scene.fog.far = scene.fog.near + 7;
    }
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el));
    camera.position.copy(dir.multiplyScalar(40));
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    camBase.copy(camera.position);
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    camUp.setFromMatrixColumn(camera.matrixWorld, 1);
    refreshCamGlows();
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
    fit.hw = hw; fit.hh = hh;
    clampLook();
    outlineMat.uniforms.thickness.value = CONFIG.outlinePx * unitsPerPixel / camera.zoom;
    moteScale.value = renderer.getPixelRatio() / unitsPerPixel;
  }

  function resize() {
    cssW = Math.max(1, window.innerWidth);
    cssH = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio) * pixelScale);
    renderer.setSize(cssW, cssH, false);
    fitCamera();
  }
  // Frame-rate safety net (see boot.js): a device that cannot hold its frame
  // rate renders at a slightly lower resolution. The picture keeps the same
  // look, just a touch softer; nothing is ever switched off.
  let pixelScale = 1;
  function setPixelScale(k) {
    k = Math.max(0.6, Math.min(1, k));
    if (Math.abs(k - pixelScale) < 0.01) return pixelScale;
    pixelScale = k;
    resize();
    return pixelScale;
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
      treeParts, deadTreeParts, rockParts, mushroomParts, tuftParts, flowerParts, acornParts, hayParts, crystalParts, colonist, pivotMatrix,
      water, masonry, towerCourses, roofCourses, windowDress, glow, setGlow, bannerGeo, shade,
      worldX, worldZ, cols, rows, border, roadDist,
      scene, animated,
      level: GameState.currentLevel(),
    };
  }

  // -------- incoming-road markers (multi-road levels only) --------
  // A warning beacon at the head of every road the next wave will use: shown
  // through prep and the first seconds of a wave, flashing when that road's
  // first enemy appears. Single-road levels never build these.
  function buildRouteMarkers() {
    const markers = GameState.routes.map((rt) => {
      const a = rt.points[0], b = rt.points[1];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1, dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
      const x = a.x - dx * 0.9, z = a.z - dz * 0.9;   // just outside the road's mouth, facing in
      const yaw = Math.atan2(dx, dz);
      const g = liveProp([
        // a colony warning beacon: a striped mast, a hazard sign, a spinning lamp
        P(GEO.cyl, PALETTE.steel, M(0, 0.6, 0, { sx: 0.045, sy: 1.2, sz: 0.045 })),
        ...[0.25, 0.55, 0.85].map((y) => P(GEO.cyl, PALETTE.hazard, M(0, y, 0, { sx: 0.05, sy: 0.08, sz: 0.05 }), false)),
        P(GEO.box, PALETTE.hazard, M(0.2, 1.02, 0, { sx: 0.36, sy: 0.24, sz: 0.03 }), true, { name: 'flag', live: true }),
        P(GEO.cylTaper, PALETTE.capRed, M(0, 1.28, 0, { sx: 0.07, sy: 0.12, sz: 0.07 }), false, { name: 'lamp', live: true, unlit: true }),
        P(GEO.box, PALETTE.capRed, M(0, 1.28, 0.06, { sx: 0.02, sy: 0.06, sz: 0.1 }), false),
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
          m.live.flag.rotation.y = Math.sin(t * 2 + i) * 0.15;
          m.live.lamp.rotation.y = t * 6;
          m.live.lamp.scale.setScalar(1 + 0.25 * Math.max(0, Math.sin(t * 12)));
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
    // Colour pipeline: linear lighting, ACES filmic tone mapping, sRGB output.
    // js/color-pipeline.js converts the authored sRGB hexes on the way in.
    const q = new URLSearchParams(location.search);
    LIN = !!(THREE.ColorPipeline && THREE.ColorPipeline.on);
    if (LIN) {
      renderer.outputEncoding = THREE.sRGBEncoding;
      if (q.get('tm') !== 'none') {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = +(q.get('exp') || EXPOSURE);
      }
    }
    // the clear color is written to the screen untouched, so it gets the same
    // tone mapping and encoding the fogged scene does and the two meet seamlessly
    renderer.setClearColor(LIN ? displayColor(new THREE.Color(vt.backdrop), renderer.toneMapping !== THREE.NoToneMapping ? renderer.toneMappingExposure : 0) : vt.backdrop);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 100);

    // Five crisp light bands instead of three: still hand-inked steps, but
    // enough of them to model a rounded form.
    gradientMap = new THREE.DataTexture(new Uint8Array([124, 166, 204, 234, 255].map((v) => Math.round(255 * lin(v / 255)))), 5, 1, THREE.LuminanceFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.generateMipmaps = false;
    gradientMap.needsUpdate = true;
    outlineMat = makeOutlineMaterial();
    buildPrimitives();

    scene.add(new THREE.HemisphereLight(vt.sky, vt.bounce, lin(vt.hemi)));
    const sun = new THREE.DirectionalLight(vt.sunColor, lin(vt.sun));
    sun.position.set(-6, 10, 7);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(vt.fill, lin(vt.fillIntensity));
    fill.position.set(7, 4, -6);
    scene.add(fill);

    cols = GameState.cols; rows = GameState.rows;
    // Atmospheric depth: the far rows of the map melt gently into the
    // level's backdrop. Camera sits 40 units out; view depth grows ~0.63
    // per unit of -z, so this starts just past the grid's top edge.
    const fogNear = 40 + (rows / 2 - 0.5) * 0.63;
    scene.fog = new THREE.Fog(vt.backdrop, fogNear, fogNear + 7);
    view.idx = savedView(); view.deg = view.from = view.to = view.idx * 90; view.t = 1;
    tilt.deg = tilt.from = tilt.to = savedTilt(); tilt.t = 1;
    placeCamera();
    buildGround();
    GameState.currentLevel().buildScene(makeKit());
    if (GameState.routes.length > 1) buildRouteMarkers();
    buildGrass();
    buildMotes();
    buildParticles();
    buildRings();
    buildLife();
    if (levelMood() < 0.72) buildClouds();
    buildHealthBars();
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
    dirDt = dirLast ? Math.min(0.25, now - dirLast) : 0; dirLast = now;   // camera moves in real time, even on a slow frame
    fxLast = now; fxT += fxDt;
    fxTime.value = fxT;
    for (const a of animated) a.update(fxT, fxDt);
    updateTowerViews(t, dt);
    updateEnemyViews(t, dt);
    updateProjectileViews();
    if (shake.amp > 0) {
      shake.amp = Math.max(0, shake.amp - shake.decay * dt);
      shake.x = (fxRand() - 0.5) * 2 * shake.amp;
      shake.y = (fxRand() - 0.5) * 2 * shake.amp;
    } else { shake.x = shake.y = 0; }
    updateView(dirDt);
    updateHealthBars(dirDt);
    updateCameraDirector(dirDt);
    camera.position.copy(camBase).addScaledVector(camRight, shake.x + camState.px + look.px).addScaledVector(camUp, shake.y + camState.py + look.py);
    renderer.render(scene, camera);
  }

  function stats() {
    const r = renderer.info.render;
    return { calls: r.calls, triangles: r.triangles };
  }

  return { init, render, resize, tiltBy, tiltStep: (dir) => tiltBy(dir * TILT_STEP), resetTilt, tiltDeg: () => tilt.to, tiltTurning: () => tilt.t < 1, TILT_MIN, TILT_MAX, zoomAt, zoomStep: (dir) => zoomAt(dir > 0 ? 1.25 : 0.8), panBy, resetLook, zoomLevel: () => look.tz, debugLook: () => ({ zoom: look.zoom, tz: look.tz, px: look.px, py: look.py, tx: look.tx, ty: look.ty, hw: fit.hw, hh: fit.hh, cam: camera.zoom }), ZOOM_MIN, ZOOM_MAX, rotateView, setView, viewIndex: () => view.idx, viewTurning: () => view.t < 1, debugCamera: () => ({ x: camBase.x, y: camBase.y, z: camBase.z, deg: view.deg, idx: view.idx, tilt: tilt.deg, fogNear: scene.fog.near }), setPixelScale, pixelScale: () => pixelScale, screenToCell, worldToScreen, stats, shakeCamera, puff, debugScene: () => scene, debugViews: () => ({ bars: barBack ? barBack.count : -1, enemyViews: enemyViews.size, dying: dying.map((d) => [+d.t.toFixed(3), d.dur]), towerViews: towerViews.size }) };
})();