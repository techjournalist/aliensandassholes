// ===================================================================
// BattleSky — the night sky behind the battlefield
// ===================================================================
// The board is a slab of moon floating in the sky the title screen paints:
// a deep violet gradient full of twinkling stars, the ringed gas giant, a
// small cratered moon and a UFO drifting across with its tractor beam on.
// It is one SVG behind the (transparent) game canvas, animated with SVG and
// CSS only, so it costs the WebGL side nothing. The sky does not turn with
// the camera: it is far enough away that it would barely move anyway.
const BattleSky = (() => {
  const W = 1600, H = 900;
  function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

  function build(host) {
    const r = rng(311);
    let stars = '';
    for (let i = 0; i < 160; i++) {
      const x = r() * W, y = r() * H, s = 0.6 + r() * 1.8;
      stars += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${s.toFixed(1)}" fill="#f4f0fc" opacity="${(0.25 + r() * 0.7).toFixed(2)}">${i % 5 ? '' : `<animate attributeName="opacity" dur="${(2 + r() * 4).toFixed(1)}s" repeatCount="indefinite" values="0.15;1;0.15"/>`}</circle>`;
    }
    // a UFO: dome, disc, running lights and a soft beam; the whole group drifts
    const ufo = (scale, beam) => `
      <g transform="scale(${scale})">
        ${beam ? '<path d="M -26 8 L 26 8 L 70 190 L -70 190 Z" fill="url(#bs-beam)"/>' : ''}
        <ellipse cy="-6" rx="20" ry="16" fill="#bff4ff" opacity="0.85"/>
        <ellipse rx="54" ry="13" fill="#8a94b8"/>
        <ellipse cy="-3" rx="54" ry="7" fill="#c8d0e8"/>
        ${[-36, -12, 12, 36].map((x, i) => `<circle cx="${x}" cy="4" r="4" fill="#9dff4a"><animate attributeName="opacity" dur="1.2s" begin="${(i * 0.3).toFixed(1)}s" repeatCount="indefinite" values="1;0.2;1"/></circle>`).join('')}
      </g>`;
    host.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="bs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#0b0820"/><stop offset="0.5" stop-color="#1e1440"/><stop offset="0.82" stop-color="#3a2462"/><stop offset="1" stop-color="#5a2f74"/>
          </linearGradient>
          <linearGradient id="bs-planet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7ad8ff"/><stop offset="0.5" stop-color="#4a6ad8"/><stop offset="1" stop-color="#2a1a6a"/></linearGradient>
          <radialGradient id="bs-halo"><stop offset="0" stop-color="#6a8aff" stop-opacity="0.35"/><stop offset="1" stop-color="#6a8aff" stop-opacity="0"/></radialGradient>
          <linearGradient id="bs-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8ffb0" stop-opacity="0.55"/><stop offset="1" stop-color="#9dff4a" stop-opacity="0"/></linearGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#bs-sky)"/>
        ${stars}
        <circle cx="1440" cy="380" r="260" fill="url(#bs-halo)"/>
        <g transform="translate(1440 380) rotate(-18)">
          <circle r="140" fill="url(#bs-planet)"/>
          <path d="M -140 -20 Q 0 10 140 -20 M -136 30 Q 0 60 136 30 M -112 -76 Q 0 -56 112 -76" stroke="#bff4ff" stroke-width="9" fill="none" opacity="0.22"/>
          <ellipse rx="236" ry="36" fill="none" stroke="#e8d4ff" stroke-width="9" opacity="0.55"/>
          <ellipse rx="216" ry="30" fill="none" stroke="#c77dff" stroke-width="4" opacity="0.45"/>
          <path d="M -140 0 A 140 140 0 0 0 140 0" fill="url(#bs-planet)"/>
        </g>
        <g transform="translate(120 300)">
          <circle r="44" fill="#d8d0f4"/><circle cx="14" cy="-12" r="10" fill="#b8b0d8"/><circle cx="-14" cy="14" r="7" fill="#b8b0d8"/><circle cx="18" cy="18" r="5" fill="#b8b0d8"/>
        </g>
        <g class="bs-ufo bs-ufo-a">${ufo(1, true)}</g>
        <g class="bs-ufo bs-ufo-b">${ufo(0.55, false)}</g>
      </svg>`;
  }

  let built = false;
  function init() {
    const host = document.getElementById('battle-sky');
    if (!host || built) return;
    built = true;
    try { build(host); } catch (e) { console.warn('battle sky failed', e); }
  }
  return { init };
})();
