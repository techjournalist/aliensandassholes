// ===================================================================
// RendererFX — shader-driven detail the Renderer layers onto every level:
// painterly ground noise, animated water, wind-blown grass, ambient motes,
// soft contact shadows. Pure factories: no scene state lives here, the
// Renderer owns every mesh these return and drives their `uTime`.
// ===================================================================
const RendererFX = (() => {
  // 2D value noise + fbm, shared by the GLSL and JS sides so CPU-placed
  // color patches and GPU texture agree on where the "patches" are.
  const NOISE_GLSL = `
    float fxHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float fxNoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(fxHash(i), fxHash(i + vec2(1.0, 0.0)), u.x), mix(fxHash(i + vec2(0.0, 1.0)), fxHash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fxFbm(vec2 p) { return fxNoise(p) * 0.62 + fxNoise(p * 2.07 + 11.3) * 0.38; }
  `;
  function hash(x, y) {
    let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  }
  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
  }
  function fbm(x, y) { return noise(x, y) * 0.62 + noise(x * 2.07 + 11.3, y * 2.07 + 11.3) * 0.38; }

  // Ground: world-space brush noise on top of the per-tile vertex colors,
  // plus warm sun-dappled patches. Patched into a MeshToonMaterial so the
  // ground keeps the same stepped lighting as everything standing on it.
  // Blight: the level's corruption falloff is re-evaluated per pixel (same
  // formula as GameState.zoneFalloff, but continuous instead of per tile),
  // and where it's strong the ground splits into dark, faintly pulsing cracks.
  function patchGround(material, zone, timeUniform) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform;
      shader.uniforms.uZone = { value: new THREE.Vector4(zone.center[0], zone.center[1], zone.radiusOut.x, zone.radiusOut.z) };
      shader.uniforms.uZone2 = { value: new THREE.Vector4(zone.radiusIn, zone.falloffWidth, zone.cols, zone.rows) };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFxWorld;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFxWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vFxWorld;\nuniform float uTime;\nuniform vec4 uZone, uZone2;\n${NOISE_GLSL}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float fxBroad = fxFbm(vFxWorld.xz * 0.55);
          float fxFine = fxFbm(vFxWorld.xz * 3.4 + 7.3);
          float fxStroke = fxNoise(vec2(vFxWorld.x * 7.0 + vFxWorld.z * 2.0, vFxWorld.z * 1.4));
          diffuseColor.rgb *= 0.85 + 0.26 * fxBroad + 0.14 * (fxFine - 0.5) + 0.07 * (fxStroke - 0.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 1.05, 0.86), smoothstep(0.58, 0.82, fxBroad));
          vec2 fxCell = vec2(vFxWorld.x + uZone2.z * 0.5 - 0.5, vFxWorld.z + uZone2.w * 0.5 - 0.5);
          vec2 fxD = (fxCell - uZone.xy) / uZone.zw;
          float fxH = clamp((uZone2.x - length(fxD)) / uZone2.y, 0.0, 1.0);
          float fxCr = abs(fxNoise(vFxWorld.xz * 2.2) - 0.5) + abs(fxNoise(vFxWorld.xz * 4.7 + 3.1) - 0.5) * 0.55;
          float fxCrack = (1.0 - smoothstep(0.03, 0.075, fxCr)) * smoothstep(0.3, 0.75, fxH);
          float fxCore = (1.0 - smoothstep(0.0, 0.03, fxCr)) * smoothstep(0.3, 0.75, fxH);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.4, fxCrack);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(0.62, 0.3, 0.95) * (fxCrack * 0.25 + fxCore * 0.6) * (0.55 + 0.45 * sin(uTime * 1.7 + vFxWorld.x * 1.3 + vFxWorld.z));`);
    };
    material.customProgramCacheKey = () => 'fx-ground';
    return material;
  }

  // Water: toon-banded current streaks drifting downstream (+z), a lighter
  // shallow band near each bank and a wobbling foam line at the edge.
  // The same shader, slowed and recolored, is the Cairnwatch's ooze.
  function waterMaterial({ shallow, deep, foam, speed = 0.7, stripe = 0.74, foamAmt = 0.55 }) {
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTime: { value: 0 }, uShallow: { value: new THREE.Color(shallow) }, uDeep: { value: new THREE.Color(deep) },
        uFoam: { value: new THREE.Color(foam) }, uSpeed: { value: speed }, uStripe: { value: stripe }, uFoamAmt: { value: foamAmt },
      }]),
      vertexShader: `
        varying vec2 vUv; varying vec3 vW;
        #include <fog_pars_vertex>
        void main() {
          vUv = uv;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vec4 mvPosition = viewMatrix * w;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float uTime, uSpeed, uStripe, uFoamAmt;
        uniform vec3 uShallow, uDeep, uFoam;
        varying vec2 vUv; varying vec3 vW;
        #include <fog_pars_fragment>
        ${NOISE_GLSL}
        void main() {
          float edge = abs(vUv.x - 0.5) * 2.0;
          vec3 col = mix(uDeep, uShallow, smoothstep(0.3, 1.0, edge));
          float flow = vW.z * 1.3 - uTime * uSpeed;
          float n = fxFbm(vec2(vW.x * 4.5 + sin(flow * 0.7) * 0.3, flow * 1.7));
          float streak = step(uStripe, n) * (1.0 - smoothstep(0.65, 0.95, edge));
          col = mix(col, uFoam, streak * uFoamAmt);
          float n2 = fxNoise(vec2(vW.x * 9.0, flow * 3.0 + 4.0));
          col = mix(col, uShallow, step(0.8, n2) * 0.35);
          float bank = step(0.84 - 0.07 * sin(vW.z * 8.0 + uTime * 1.9), edge);
          col = mix(col, uFoam, bank * 0.85);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
          #include <fog_fragment>
        }`,
      fog: true,
    });
  }

  // Grass: one InstancedMesh of tapered blades, gradient base-to-tip, a
  // per-instance tint, and wind sway computed on the GPU from the blade's
  // own world position so neighbouring tufts ripple together.
  function grassBladeGeometry() {
    const hs = [0, 0.42, 0.76, 1], ws = [0.05, 0.04, 0.022, 0];
    const pos = [], col = [];
    const shade = (y) => 0.52 + 0.62 * y;
    for (let i = 0; i < 3; i++) {
      const y0 = hs[i], y1 = hs[i + 1], w0 = ws[i], w1 = ws[i + 1];
      const quad = [[-w0, y0], [w0, y0], [w1, y1], [-w0, y0], [w1, y1], [-w1, y1]];
      for (const [x, y] of quad) { pos.push(x, y, 0); const s = shade(y); col.push(s, s, s * 0.95); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  function grassMaterial(timeUniform) {
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 fxIp = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #else
            vec3 fxIp = vec3(0.0);
          #endif
          float fxBend = position.y * position.y;
          float fxGust = sin(uTime * 0.7 + fxIp.x * 0.35) * 0.5 + 0.5;
          transformed.x += sin(uTime * 1.9 + fxIp.x * 0.9 + fxIp.z * 0.6) * (0.1 + 0.12 * fxGust) * fxBend;
          transformed.z += cos(uTime * 1.4 + fxIp.x * 0.5 + fxIp.z * 0.8) * 0.06 * fxBend;`);
    };
    m.customProgramCacheKey = () => 'fx-grass';
    return m;
  }

  // Ambient motes: GPU-animated points (fireflies blink and wander, spores
  // and embers rise, leaves tumble down, dust drifts). One draw call each.
  const MOTE_KINDS = {
    fireflies: { color: 0xfff1a0, size: 0.11, additive: true },
    spores:    { color: 0xb07ae0, size: 0.09, additive: true },
    embers:    { color: 0xffa04a, size: 0.08, additive: true },
    leaves:    { color: 0xd9953c, size: 0.12, additive: false },
    dust:      { color: 0xe8dcc0, size: 0.06, additive: false },
  };
  function motes(kind, positions, scaleUniform, timeUniform) {
    const spec = MOTE_KINDS[kind];
    const n = positions.length / 3;
    const seeds = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      seeds[i * 3] = hash(i, 3.1 + kind.length);
      seeds[i * 3 + 1] = 0.6 + hash(i, 7.7) * 0.8;
      seeds[i * 3 + 2] = 0.7 + hash(i, 13.3) * 0.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
    const motion = {
      fireflies: `p.x += sin(uTime * 0.5 * seed.y + seed.x * 6.28) * 0.55;
                  p.z += cos(uTime * 0.42 * seed.y + seed.x * 4.1) * 0.45;
                  p.y += sin(uTime * 1.2 + seed.x * 9.0) * 0.14;
                  vAlpha = pow(0.5 + 0.5 * sin(uTime * 1.9 * seed.y + seed.x * 23.0), 3.0);`,
      spores:    `p.y = mod(p.y + uTime * 0.22 * seed.y, 2.0);
                  p.x += sin(uTime * 0.8 + seed.x * 6.0) * 0.18;
                  vAlpha = smoothstep(0.0, 0.35, p.y) * (1.0 - smoothstep(1.4, 2.0, p.y)) * 0.8;`,
      embers:    `p.y = mod(p.y + uTime * 0.45 * seed.y, 2.4);
                  p.x += sin(uTime * 2.1 + seed.x * 6.0) * 0.12;
                  vAlpha = smoothstep(0.0, 0.2, p.y) * (1.0 - smoothstep(1.2, 2.4, p.y));`,
      leaves:    `float fall = mod(uTime * 0.28 * seed.y + seed.x * 2.6, 2.6);
                  p.y = 2.6 - fall;
                  p.x += sin(uTime * 1.6 * seed.y + seed.x * 9.0) * 0.28 + fall * 0.5;
                  p.z += cos(uTime * 1.1 + seed.x * 5.0) * 0.18;
                  vAlpha = smoothstep(0.0, 0.25, p.y) * (1.0 - smoothstep(2.2, 2.6, p.y));`,
      dust:      `p.x += sin(uTime * 0.3 * seed.y + seed.x * 6.28) * 0.7;
                  p.z += cos(uTime * 0.25 * seed.y + seed.x * 3.0) * 0.5;
                  p.y += sin(uTime * 0.6 + seed.x * 11.0) * 0.2;
                  vAlpha = 0.35 + 0.25 * sin(uTime * 0.9 + seed.x * 17.0);`,
    }[kind];
    const shape = kind === 'leaves'
      ? `vec2 d = gl_PointCoord - 0.5; d = mat2(0.8, -0.6, 0.6, 0.8) * d; float a = 1.0 - smoothstep(0.18, 0.26, length(d * vec2(1.0, 2.1)));`
      : `float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.08, r);`;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: timeUniform, uScale: scaleUniform, uSize: { value: spec.size }, uColor: { value: new THREE.Color(spec.color) } },
      vertexShader: `
        attribute vec3 seed;
        uniform float uTime, uScale, uSize;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          ${motion}
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * seed.z * uScale;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          ${shape}
          if (a * vAlpha < 0.01) discard;
          gl_FragColor = vec4(uColor, a * vAlpha);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: spec.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.name = 'motes-' + kind;
    return pts;
  }

  // Soft contact shadow: a radial alpha falloff instead of a hard disc.
  let shadowTex = null;
  function shadowTexture() {
    if (shadowTex) return shadowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.8)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
    return shadowTex;
  }

  // Cast shadow: a dark contact blob at the base that trails off into a long,
  // soft tail, so a tree or building reads as throwing a shadow away from the
  // sun instead of sitting on a round puddle. The tail runs along +u.
  let castTex = null;
  function castShadowTexture() {
    if (castTex) return castTex;
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const ctx = c.getContext('2d');
    const blob = (cx, rx, ry, a0) => {
      ctx.save(); ctx.translate(cx, 32); ctx.scale(rx / ry, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
      g.addColorStop(0, `rgba(255,255,255,${a0})`); g.addColorStop(0.55, `rgba(255,255,255,${a0 * 0.6})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, ry, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    };
    blob(46, 44, 28, 0.95);     // the body of the shadow, near the base
    blob(80, 46, 20, 0.5);      // the tail, thinner and fainter
    castTex = new THREE.CanvasTexture(c);
    return castTex;
  }

  return { noise, fbm, patchGround, waterMaterial, grassBladeGeometry, grassMaterial, motes, shadowTexture, castShadowTexture, MOTE_KINDS };
})();
