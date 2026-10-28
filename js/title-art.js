// ===================================================================
// TitleArt  (the illustrated title backdrop and its parallax)
// ===================================================================
// Dusk on the moon painted as layered SVG: a ringed gas giant in the sky,
// crystal ridges, moss hills, the crashed alien hive oozing goo on the left,
// the colony's glass dome on the right, a road between them and glowing
// flora in front. Each layer
// drifts by a different amount as the pointer moves (and sways slowly on its
// own), which is what makes a flat picture read as depth. Pure DOM and CSS
// transforms: no canvas, no extra WebGL work, and it only animates while the
// title screen is showing.
const TitleArt = (() => {
  const W = 1600, H = 900;
  let built = false;

  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
  const ridge = (x, base, a, w, p) => base + a[0] * Math.sin(x / w[0] + p[0]) + a[1] * Math.sin(x / w[1] + p[1]);
  function hillPath(base, a, w, p, bottom = H + 40) {
    let d = `M -120 ${bottom} L -120 ${ridge(-120, base, a, w, p).toFixed(1)}`;
    for (let x = -100; x <= W + 120; x += 40) d += ` L ${x} ${ridge(x, base, a, w, p).toFixed(1)}`;
    return d + ` L ${W + 120} ${bottom} Z`;
  }

  function build(svg) {
    const P = window.PALETTE || {};
    const meadow = hex(P.meadow || 0x3aa89a), meadowDark = hex(P.meadowDark || 0x2a8a84), meadowLight = hex(P.meadowLight || 0x5fd0b8);
    const hull = hex(P.hull || 0xe6eaf4), teal = hex(P.tunic || 0x2bb3a8), gold = hex(P.gold || 0xffc84a), goo = hex(P.goo || 0x9dff4a);
    const r = rng(77);

    // ---- stars, twinkling ----
    let stars = '';
    for (let i = 0; i < 90; i++) {
      const x = r() * W, y = r() * 520, s = 0.8 + r() * 2;
      stars += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${s.toFixed(1)}" fill="#f4f0fc" opacity="${(0.3 + r() * 0.7).toFixed(2)}">${i % 4 ? '' : `<animate attributeName="opacity" dur="${(2 + r() * 3).toFixed(1)}s" repeatCount="indefinite" values="0.2;1;0.2"/>`}</circle>`;
    }

    // ---- far ridges: jagged crystal peaks, hazy violet ----
    const mtn = (base, amp, step, fill, seed, tips) => {
      const q = rng(seed); let d = `M -120 ${H} L -120 ${base}`; const pts = [];
      for (let x = -120; x <= W + 140; x += step) { const y = base - (q() * amp) * (((x / step) | 0) % 2 ? 0.45 : 1); pts.push([x, y]); d += ` L ${x} ${y.toFixed(1)}`; }
      d += ` L ${W + 140} ${H} Z`;
      let caps = '';
      if (tips) for (const [x, y] of pts) if (y < base - amp * 0.7) caps += `<path d="M ${x} ${y.toFixed(1)} l -10 30 l 10 -6 l 10 6 Z" fill="${tips}" opacity="0.85"/>`;
      return `<path d="${d}" fill="${fill}"/>${caps}`;
    };

    // ---- moon flora along the mid ridge: bulb trees and coral tubes ----
    let trees = '';
    for (let x = -60; x < W + 80; x += 34 + r() * 40) {
      const y = ridge(x, 690, [34, 16], [190, 71], [0.4, 1.1]);
      const s = 0.8 + r() * 0.9, dark = x < 560, fill = dark ? '#251838' : meadowDark;
      trees += r() < 0.4
        ? `<rect x="${x - 4}" y="${(y - 54 * s).toFixed(1)}" width="8" height="${54 * s}" rx="4" fill="${fill}"/><rect x="${x + 6}" y="${(y - 36 * s).toFixed(1)}" width="7" height="${36 * s}" rx="3.5" fill="${fill}"/><circle cx="${x}" cy="${(y - 56 * s).toFixed(1)}" r="5" fill="${dark ? goo : '#ff6fd8'}"/>`
        : `<circle cx="${x}" cy="${(y - 36 * s).toFixed(1)}" r="${(26 * s).toFixed(1)}" fill="${fill}"/><rect x="${x - 3}" y="${(y - 12 * s).toFixed(1)}" width="6" height="${14 * s}" fill="#2a2048"/><circle cx="${x + 8 * s}" cy="${(y - 44 * s).toFixed(1)}" r="3" fill="${dark ? goo : '#45f0d8'}"/>`;
    }

    // ---- the hive: a crashed alien ship oozing goo, a saucer circling it ----
    const hx = 260, hy = ridge(hx, 690, [34, 16], [190, 71], [0.4, 1.1]);
    const hive = `
      <ellipse cx="${hx}" cy="${hy}" rx="230" ry="50" fill="url(#ts-glow)" opacity="0.85"/>
      <ellipse cx="${hx}" cy="${hy - 40}" rx="130" ry="36" fill="#2a1c40" transform="rotate(-14 ${hx} ${hy - 40})"/>
      <ellipse cx="${hx}" cy="${hy - 48}" rx="130" ry="12" fill="#3a2a5a" transform="rotate(-14 ${hx} ${hy - 40})"/>
      <path d="M ${hx - 30} ${hy - 70} q 30 -60 60 -14 Z" fill="#bff4ff" opacity="0.5" transform="rotate(-14 ${hx} ${hy - 40})"/>
      ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${hx - 100 + i * 50}" cy="${hy - 30 - (2 - Math.abs(i - 2)) * 6 + i * 12}" r="6" fill="${goo}"><animate attributeName="opacity" dur="${1.2 + i * 0.3}s" repeatCount="indefinite" values="0.4;1;0.4"/></circle>`).join('')}
      <path d="M ${hx - 60} ${hy + 6} q 60 -24 140 0 q -70 18 -140 0 Z" fill="${goo}" opacity="0.7"/>
      <g fill="${goo}" opacity="0.6">${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${hx - 150 + i * 62 + r() * 20}" cy="${hy - 24 - r() * 120}" r="${2 + r() * 3}"/>`).join('')}</g>
      <g class="ts-saucer"><ellipse cx="0" cy="0" rx="34" ry="9" fill="#bfc7dc"/><path d="M -14 -4 a 14 12 0 0 1 28 0 Z" fill="#bff4ff"/><circle cx="0" cy="-8" r="5" fill="${goo}"/>
        <circle cx="-22" cy="2" r="2.5" fill="#39f0ff"/><circle cx="0" cy="4" r="2.5" fill="${goo}"/><circle cx="22" cy="2" r="2.5" fill="#39f0ff"/>
        <path d="M -12 9 L -30 70 L 30 70 L 12 9 Z" fill="${goo}" opacity="0.18"/>
        <animateTransform attributeName="transform" type="translate" dur="9s" repeatCount="indefinite" values="${hx - 160} ${hy - 230};${hx + 120} ${hy - 260};${hx - 160} ${hy - 230}"/></g>`;

    // ---- the colony: a glass crop dome, habs and a terraformer stack ----
    const bx = 1300, by = ridge(bx, 690, [34, 16], [190, 71], [0.4, 1.1]) + 6;
    const colony = `
      <ellipse cx="${bx + 60}" cy="${by}" rx="220" ry="30" fill="#1e5a5a" opacity="0.5"/>
      <rect x="${bx + 150}" y="${by - 250}" width="34" height="250" fill="${hull}"/><rect x="${bx + 150}" y="${by - 250}" width="10" height="250" fill="#000" opacity="0.12"/>
      <rect x="${bx + 146}" y="${by - 170}" width="42" height="10" fill="${teal}"/><rect x="${bx + 146}" y="${by - 110}" width="42" height="10" fill="${teal}"/>
      <rect x="${bx + 160}" y="${by - 140}" width="14" height="28" fill="#39f0ff" opacity="0.8"/>
      <g><animateTransform attributeName="transform" type="rotate" dur="3s" repeatCount="indefinite" values="0 ${bx + 167} ${by - 200};360 ${bx + 167} ${by - 200}"/>
        <rect x="${bx + 127}" y="${by - 204}" width="80" height="8" rx="4" fill="#c4ccdc"/><rect x="${bx + 163}" y="${by - 240}" width="8" height="80" rx="4" fill="#c4ccdc"/></g>
      <path d="M ${bx + 167} ${by - 250} v -40" stroke="#c4ccdc" stroke-width="3"/><circle cx="${bx + 167}" cy="${by - 292}" r="6" fill="#ff5d73"><animate attributeName="opacity" dur="1.4s" repeatCount="indefinite" values="1;0.2;1"/></circle>
      <rect x="${bx - 40}" y="${by - 30}" width="200" height="30" fill="#5fd0b8"/>
      <rect x="${bx - 30}" y="${by - 26}" width="180" height="10" fill="#e8c25a"/>
      <path d="M ${bx - 60} ${by} A 120 110 0 0 1 ${bx + 180} ${by} Z" fill="#bff4ff" opacity="0.35"/>
      <path d="M ${bx - 60} ${by} A 120 110 0 0 1 ${bx + 180} ${by}" fill="none" stroke="#eef1f8" stroke-width="4"/>
      <path d="M ${bx + 60} ${by - 110} V ${by} M ${bx - 25} ${by - 76} Q ${bx + 60} ${by - 40} ${bx + 145} ${by - 76}" fill="none" stroke="#eef1f8" stroke-width="3" opacity="0.8"/>
      <path d="M ${bx - 20} ${by - 90} Q ${bx + 10} ${by - 108} ${bx + 40} ${by - 104}" fill="none" stroke="#fff" stroke-width="6" opacity="0.5" stroke-linecap="round"/>
      <rect x="${bx - 150}" y="${by - 56}" width="100" height="56" rx="8" fill="${hull}"/><path d="M ${bx - 150} ${by - 56} a 50 22 0 0 1 100 0 Z" fill="#ff8a4c"/>
      <rect x="${bx - 130}" y="${by - 40}" width="14" height="14" rx="7" fill="#ffd678"/><rect x="${bx - 95}" y="${by - 30}" width="20" height="30" rx="4" fill="#3e3a5e"/>
      <ellipse cx="${bx + 60}" cy="${by - 60}" rx="140" ry="90" fill="url(#ts-warm)" opacity="0.4"/>`;

    // ---- the road from the hive to the colony ----
    const road = `<path d="M 330 ${hy + 34} C 480 ${hy + 90}, 520 ${hy + 60}, 720 ${hy + 100} S 1020 ${by + 70} ${bx + 40} ${by + 6}" fill="none" stroke="#3a2a5a" stroke-width="30" stroke-linecap="round" opacity="0.5"/>
      <path d="M 330 ${hy + 30} C 480 ${hy + 86}, 520 ${hy + 56}, 720 ${hy + 96} S 1020 ${by + 66} ${bx + 40} ${by + 2}" fill="none" stroke="#cab8e6" stroke-width="22" stroke-linecap="round"/>
      <path d="M 330 ${hy + 30} C 480 ${hy + 86}, 520 ${hy + 56}, 720 ${hy + 96} S 1020 ${by + 66} ${bx + 40} ${by + 2}" fill="none" stroke="#f4f0fc" stroke-width="3" stroke-dasharray="14 18" stroke-linecap="round" opacity="0.8"/>`;

    // ---- the moss in front: glowshrooms, blooms and crystals ----
    let meadowBits = '';
    for (let i = 0; i < 46; i++) {
      const x = r() * W, y = ridge(x, 790, [22, 10], [160, 53], [2.2, 0.3]) + 26 + r() * 110;
      if (y > H + 10) continue;
      const roll = r();
      if (roll < 0.45) meadowBits += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${4 + r() * 4}" fill="${['#ff6fd8', '#ffe36e', '#45f0d8', '#c77dff'][i % 4]}"/><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="2" fill="#f4f0fc"/>`;
      else if (roll < 0.7) { const c = ['#c77dff', '#45f0d8', '#ff6fd8'][i % 3]; meadowBits += `<rect x="${(x - 3).toFixed(0)}" y="${y.toFixed(0)}" width="6" height="14" fill="#f4f0fc"/><path d="M ${(x - 16).toFixed(0)} ${y.toFixed(0)} Q ${x.toFixed(0)} ${(y - 26).toFixed(0)} ${(x + 16).toFixed(0)} ${y.toFixed(0)} Z" fill="${c}"/><circle cx="${(x - 5).toFixed(0)}" cy="${(y - 8).toFixed(0)}" r="2.4" fill="#f4f0fc"/><circle cx="${(x + 6).toFixed(0)}" cy="${(y - 11).toFixed(0)}" r="2" fill="#f4f0fc"/>`; }
      else if (roll < 0.82) meadowBits += `<path d="M ${(x - 8).toFixed(0)} ${(y + 8).toFixed(0)} l 4 -26 l 5 26 Z M ${x.toFixed(0)} ${(y + 8).toFixed(0)} l 5 -18 l 5 18 Z" fill="#c77dff" stroke="#150f24" stroke-width="1.5"/>`;
      else meadowBits += `<path d="M ${x.toFixed(0)} ${(y + 8).toFixed(0)} l -6 -22 M ${x.toFixed(0)} ${(y + 8).toFixed(0)} l 2 -26 M ${x.toFixed(0)} ${(y + 8).toFixed(0)} l 9 -20" stroke="${meadowDark}" stroke-width="3" stroke-linecap="round"/>`;
    }

    // ---- foreground fronds framing the corners ----
    const leaf = (x, y, rot, s, fill) => `<path d="M 0 0 C 30 -40, 90 -50, 130 -10 C 90 20, 30 30, 0 0 Z" transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" fill="${fill}"/>`;
    const frame = [
      leaf(-30, 930, -55, 2.4, '#14303a'), leaf(40, 950, -20, 2.0, '#1a4048'), leaf(-10, 720, -80, 1.6, '#122a34'),
      leaf(1630, 940, -125, 2.4, '#14303a'), leaf(1560, 960, -160, 2.0, '#1a4048'), leaf(1610, 730, -100, 1.6, '#122a34'),
      leaf(-20, -10, 55, 1.7, '#1a1236'), leaf(1620, -10, 125, 1.7, '#1a1236'),
    ].join('');

    svg.innerHTML = `
      <defs>
        <linearGradient id="ts-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0e0a24"/><stop offset="0.45" stop-color="#2a1a54"/><stop offset="0.72" stop-color="#6a3a8a"/><stop offset="1" stop-color="#ff8fb0"/>
        </linearGradient>
        <radialGradient id="ts-sun"><stop offset="0" stop-color="#ffe8f4"/><stop offset="0.35" stop-color="#ff9ad0" stop-opacity="0.5"/><stop offset="1" stop-color="#ff6fd8" stop-opacity="0"/></radialGradient>
        <linearGradient id="ts-planet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7ad8ff"/><stop offset="0.5" stop-color="#4a6ad8"/><stop offset="1" stop-color="#2a1a6a"/></linearGradient>
        <radialGradient id="ts-glow"><stop offset="0" stop-color="#9dff4a" stop-opacity="0.55"/><stop offset="1" stop-color="#9dff4a" stop-opacity="0"/></radialGradient>
        <radialGradient id="ts-warm"><stop offset="0" stop-color="#ffd678" stop-opacity="0.9"/><stop offset="1" stop-color="#ffd678" stop-opacity="0"/></radialGradient>
        <linearGradient id="ts-blight" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a0e2a" stop-opacity="0.85"/><stop offset="0.55" stop-color="#1a0e2a" stop-opacity="0.3"/><stop offset="1" stop-color="#1a0e2a" stop-opacity="0"/></linearGradient>
      </defs>
      <g class="tl" data-d="0.05">
        <rect x="-120" y="-60" width="${W + 240}" height="${H + 120}" fill="url(#ts-sky)"/>
        ${stars}
        <circle cx="1120" cy="560" r="260" fill="url(#ts-sun)"/>
        <g transform="translate(1080 250) rotate(-18)">
          <circle r="150" fill="url(#ts-planet)"/>
          <path d="M -150 -20 Q 0 10 150 -20 M -146 30 Q 0 60 146 30 M -120 -80 Q 0 -60 120 -80" stroke="#bff4ff" stroke-width="10" fill="none" opacity="0.25"/>
          <ellipse rx="250" ry="38" fill="none" stroke="#e8d4ff" stroke-width="10" opacity="0.6"/>
          <ellipse rx="230" ry="32" fill="none" stroke="#c77dff" stroke-width="4" opacity="0.5"/>
          <path d="M -150 0 A 150 150 0 0 0 150 0" fill="url(#ts-planet)"/>
        </g>
        <circle cx="340" cy="170" r="36" fill="#d8d0f4"/><circle cx="352" cy="160" r="8" fill="#b8b0d8"/><circle cx="328" cy="182" r="5" fill="#b8b0d8"/>
      </g>
      <g class="tl" data-d="0.2">${mtn(560, 150, 90, '#4a3a7a', 11, '#c77dff')}${mtn(640, 120, 80, '#3a2e66', 29, '#45f0d8')}
        <rect x="-120" y="380" width="900" height="520" fill="url(#ts-blight)"/></g>
      <g class="tl" data-d="0.45"><path d="${hillPath(690, [34, 16], [190, 71], [0.4, 1.1])}" fill="#2a8078"/>${trees}${hive}${colony}</g>
      <g class="tl" data-d="0.85"><path d="${hillPath(780, [26, 12], [230, 67], [1.3, 2.0])}" fill="${meadowDark}"/>${road}</g>
      <g class="tl" data-d="1.4"><path d="${hillPath(806, [22, 10], [160, 53], [2.2, 0.3])}" fill="${meadow}"/>
        <path d="${hillPath(806, [22, 10], [160, 53], [2.2, 0.3])}" fill="none" stroke="${meadowLight}" stroke-width="5" opacity="0.7"/>${meadowBits}</g>
      <g class="tl" data-d="2.4">${frame}</g>`;
  }

  function init() {
    const svg = document.getElementById('t-scene');
    if (!svg || built) return;
    built = true;
    try { build(svg); } catch (e) { console.warn('title art failed', e); return; }
    const layers = [...svg.querySelectorAll('.tl')];
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const title = document.getElementById('title');
    let tx = 0, ty = 0, cx = 0, cy = 0;
    if (!reduced) window.addEventListener('pointermove', (e) => { tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
    function frame(t) {
      if (title && title.classList.contains('show') && !reduced) {
        const sx = tx + Math.sin(t / 4200) * 0.28, sy = ty * 0.6 + Math.sin(t / 5600) * 0.14;
        cx += (sx - cx) * 0.06; cy += (sy - cy) * 0.06;
        for (const l of layers) {
          const d = +l.dataset.d;
          l.style.transform = `translate(${(-cx * d * 30).toFixed(1)}px, ${(-cy * d * 12).toFixed(1)}px)`;
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    // the world map card tilts a few degrees toward the pointer, like a table map
    const mapCard = document.querySelector('#worldmap .card.wide');
    if (mapCard && !reduced && window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', (e) => {
        if (!document.getElementById('worldmap').classList.contains('show')) return;
        mapCard.style.setProperty('--tilt-y', ((e.clientX / innerWidth - 0.5) * 3).toFixed(2) + 'deg');
        mapCard.style.setProperty('--tilt-x', ((0.5 - e.clientY / innerHeight) * 2).toFixed(2) + 'deg');
      }, { passive: true });
    }
  }
  return { init };
})();
