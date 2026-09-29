// ===================================================================
// TitleArt  (the illustrated title backdrop and its parallax)
// ===================================================================
// A dawn over the valley painted as layered SVG: distant mountains, rolling
// hills, the blighted Shadow Hollow on the left, the lit Bastion on the
// right, a road winding between them and a meadow in front. Each layer
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
    const meadow = hex(P.meadow || 0x6fae4a), meadowDark = hex(P.meadowDark || 0x3f7a3a), meadowLight = hex(P.meadowLight || 0x9ad06a);
    const stone = hex(P.cobble || 0xc9c2b0), capRed = hex(P.capRed || 0xd94f3a), cream = hex(P.cream || 0xf6ecd4), gold = hex(P.gold || 0xf2c14e);
    const r = rng(77);

    // ---- far mountains: jagged, hazy, purple-blue ----
    const mtn = (base, amp, step, fill, seed, snow) => {
      const q = rng(seed); let d = `M -120 ${H} L -120 ${base}`; let pts = [];
      for (let x = -120; x <= W + 140; x += step) { const y = base - (q() * amp) * (((x / step) | 0) % 2 ? 0.45 : 1); pts.push([x, y]); d += ` L ${x} ${y.toFixed(1)}`; }
      d += ` L ${W + 140} ${H} Z`;
      let caps = '';
      if (snow) for (const [x, y] of pts) if (y < base - amp * 0.7) caps += `<path d="M ${x} ${y.toFixed(1)} l -22 34 l 14 -8 l 8 12 l 8 -12 l 14 8 Z" fill="#f4eef8" opacity="0.85"/>`;
      return `<path d="${d}" fill="${fill}"/>${caps}`;
    };

    // ---- trees along the mid ridge ----
    let trees = '';
    for (let x = -60; x < W + 80; x += 34 + r() * 40) {
      const y = ridge(x, 690, [34, 16], [190, 71], [0.4, 1.1]);
      const s = 0.8 + r() * 0.9, dark = x < 560, fill = dark ? '#2a2233' : meadowDark;
      trees += r() < 0.4
        ? `<path d="M ${x} ${(y - 62 * s).toFixed(1)} l ${-20 * s} ${52 * s} h ${40 * s} Z M ${x} ${(y - 42 * s).toFixed(1)} l ${-26 * s} ${48 * s} h ${52 * s} Z" fill="${fill}"/>`
        : `<circle cx="${x}" cy="${(y - 34 * s).toFixed(1)}" r="${(26 * s).toFixed(1)}" fill="${fill}"/><rect x="${x - 3}" y="${(y - 10 * s).toFixed(1)}" width="6" height="${12 * s}" fill="#3a2a1c"/>`;
    }

    // ---- the Shadow Hollow: a cracked, glowing stump with dead trees ----
    const hx = 250, hy = ridge(hx, 690, [34, 16], [190, 71], [0.4, 1.1]);
    const hollow = `
      <ellipse cx="${hx}" cy="${hy}" rx="210" ry="46" fill="url(#ts-glow)" opacity="0.8"/>
      <path d="M ${hx - 70} ${hy + 10} C ${hx - 66} ${hy - 60}, ${hx - 44} ${hy - 96}, ${hx - 34} ${hy - 150} L ${hx - 14} ${hy - 118} L ${hx + 6} ${hy - 168} L ${hx + 26} ${hy - 124} L ${hx + 52} ${hy - 152} C ${hx + 54} ${hy - 90}, ${hx + 68} ${hy - 40}, ${hx + 76} ${hy + 10} Z" fill="#241c30"/>
      <path d="M ${hx - 6} ${hy - 120} l 10 34 l -8 20 l 12 40" stroke="#c861e0" stroke-width="4" fill="none" stroke-linecap="round"/>
      <ellipse cx="${hx + 4}" cy="${hy - 56}" rx="13" ry="22" fill="#c861e0" opacity="0.9"/>
      <ellipse cx="${hx + 4}" cy="${hy - 56}" rx="6" ry="12" fill="#f6d9ff"/>
      <g stroke="#1b1424" stroke-width="7" stroke-linecap="round" fill="none">
        <path d="M ${hx - 120} ${hy + 4} l 6 -78 l -22 -30 M ${hx - 114} ${hy - 50} l 24 -22"/>
        <path d="M ${hx + 130} ${hy + 6} l -8 -92 l 24 -34 M ${hx + 124} ${hy - 60} l -26 -20"/>
        <path d="M ${hx + 200} ${hy + 14} l 4 -60 l 18 -22"/>
      </g>
      <g fill="#c861e0" opacity="0.55">${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${hx - 150 + i * 62 + r() * 20}" cy="${hy - 24 - r() * 120}" r="${2 + r() * 3}"/>`).join('')}</g>`;

    // ---- the Bastion: warm stone, red mushroom-cap roofs, lit windows, a banner ----
    const bx = 1330, by = ridge(bx, 690, [34, 16], [190, 71], [0.4, 1.1]) + 6;
    const tower = (x, top, w, h) => `
      <rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${stone}"/>
      <rect x="${x}" y="${top}" width="${w * 0.28}" height="${h}" fill="#000" opacity="0.13"/>
      <path d="M ${x - 12} ${top} Q ${x + w / 2} ${top - w * 0.95} ${x + w + 12} ${top} Z" fill="${capRed}"/>
      <path d="M ${x - 12} ${top} Q ${x + w / 2} ${top - w * 0.95} ${x + w + 12} ${top} Q ${x + w / 2} ${top - 8} ${x - 12} ${top} Z" fill="#000" opacity="0.14"/>
      <circle cx="${x + w * 0.3}" cy="${top - w * 0.3}" r="4" fill="${cream}"/><circle cx="${x + w * 0.68}" cy="${top - w * 0.42}" r="3.4" fill="${cream}"/>
      <rect x="${x + w / 2 - 6}" y="${top + 22}" width="12" height="22" rx="6" fill="#ffd678"/>
      <rect x="${x + w / 2 - 6}" y="${top + 62}" width="12" height="22" rx="6" fill="#ffd678"/>`;
    const bastion = `
      <ellipse cx="${bx + 60}" cy="${by}" rx="200" ry="30" fill="#2b4a2a" opacity="0.5"/>
      <rect x="${bx - 30}" y="${by - 96}" width="180" height="96" fill="${stone}"/>
      <rect x="${bx - 30}" y="${by - 96}" width="52" height="96" fill="#000" opacity="0.1"/>
      ${Array.from({ length: 7 }, (_, i) => `<rect x="${bx - 30 + i * 28}" y="${by - 110}" width="16" height="14" fill="${stone}"/>`).join('')}
      <path d="M ${bx + 40} ${by} v -46 a 20 20 0 0 1 40 0 v 46 Z" fill="#3a2a1c"/>
      <rect x="${bx + 8}" y="${by - 70}" width="12" height="20" rx="6" fill="#ffd678"/><rect x="${bx + 100}" y="${by - 70}" width="12" height="20" rx="6" fill="#ffd678"/>
      ${tower(bx - 62, by - 190, 60, 190)}${tower(bx + 128, by - 214, 64, 214)}${tower(bx + 34, by - 246, 56, 150)}
      <path d="M ${bx + 62} ${by - 342} v -34" stroke="#3a2a1c" stroke-width="3"/>
      <path d="M ${bx + 62} ${by - 376} l 46 10 l -14 10 l 14 10 l -46 -8 Z" fill="${gold}"><animate attributeName="d" dur="2.6s" repeatCount="indefinite" values="M ${bx + 62} ${by - 376} l 46 10 l -14 10 l 14 10 l -46 -8 Z;M ${bx + 62} ${by - 376} l 40 4 l -10 12 l 12 8 l -42 -2 Z;M ${bx + 62} ${by - 376} l 46 10 l -14 10 l 14 10 l -46 -8 Z"/></path>
      <ellipse cx="${bx + 60}" cy="${by - 60}" rx="120" ry="90" fill="url(#ts-warm)" opacity="0.55"/>`;

    // ---- the road from the Hollow to the Bastion ----
    const road = `<path d="M 300 ${hy + 34} C 480 ${hy + 90}, 520 ${hy + 60}, 720 ${hy + 100} S 1020 ${by + 70} ${bx + 60} ${by + 6}" fill="none" stroke="#5b4526" stroke-width="30" stroke-linecap="round" opacity="0.5"/>
      <path d="M 300 ${hy + 30} C 480 ${hy + 86}, 520 ${hy + 56}, 720 ${hy + 96} S 1020 ${by + 66} ${bx + 60} ${by + 2}" fill="none" stroke="#e0bf86" stroke-width="22" stroke-linecap="round"/>
      <path d="M 300 ${hy + 30} C 480 ${hy + 86}, 520 ${hy + 56}, 720 ${hy + 96} S 1020 ${by + 66} ${bx + 60} ${by + 2}" fill="none" stroke="#f3dcae" stroke-width="3" stroke-dasharray="14 18" stroke-linecap="round" opacity="0.8"/>`;

    // ---- the meadow in front: flowers, mushrooms, tufts ----
    let meadowBits = '';
    for (let i = 0; i < 46; i++) {
      const x = r() * W, y = ridge(x, 790, [22, 10], [160, 53], [2.2, 0.3]) + 26 + r() * 110;
      if (y > H + 10) continue;
      const roll = r();
      if (roll < 0.5) meadowBits += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${4 + r() * 4}" fill="${['#ff8fb3', '#ffe27a', '#ffffff', '#c861e0'][i % 4]}"/><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="2" fill="#f2c14e"/>`;
      else if (roll < 0.7) meadowBits += `<rect x="${(x - 3).toFixed(0)}" y="${y.toFixed(0)}" width="6" height="14" fill="${cream}"/><path d="M ${(x - 16).toFixed(0)} ${y.toFixed(0)} Q ${x.toFixed(0)} ${(y - 26).toFixed(0)} ${(x + 16).toFixed(0)} ${y.toFixed(0)} Z" fill="${capRed}"/><circle cx="${(x - 5).toFixed(0)}" cy="${(y - 8).toFixed(0)}" r="2.4" fill="${cream}"/><circle cx="${(x + 6).toFixed(0)}" cy="${(y - 11).toFixed(0)}" r="2" fill="${cream}"/>`;
      else meadowBits += `<path d="M ${x.toFixed(0)} ${(y + 8).toFixed(0)} l -6 -22 M ${x.toFixed(0)} ${(y + 8).toFixed(0)} l 2 -26 M ${x.toFixed(0)} ${(y + 8).toFixed(0)} l 9 -20" stroke="${meadowDark}" stroke-width="3" stroke-linecap="round"/>`;
    }

    // ---- foreground leaves framing the corners ----
    const leaf = (x, y, rot, s, fill) => `<path d="M 0 0 C 30 -40, 90 -50, 130 -10 C 90 20, 30 30, 0 0 Z" transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" fill="${fill}"/>`;
    const frame = [
      leaf(-30, 930, -55, 2.4, '#1c3524'), leaf(40, 950, -20, 2.0, '#234230'), leaf(-10, 720, -80, 1.6, '#1a2f20'),
      leaf(1630, 940, -125, 2.4, '#1c3524'), leaf(1560, 960, -160, 2.0, '#234230'), leaf(1610, 730, -100, 1.6, '#1a2f20'),
      leaf(-20, -10, 55, 1.7, '#1a2f20'), leaf(1620, -10, 125, 1.7, '#1a2f20'),
    ].join('');

    svg.innerHTML = `
      <defs>
        <linearGradient id="ts-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2c4468"/><stop offset="0.42" stop-color="#8a6f86"/><stop offset="0.7" stop-color="#eaa470"/><stop offset="1" stop-color="#ffd98e"/>
        </linearGradient>
        <radialGradient id="ts-sun"><stop offset="0" stop-color="#fff3c8"/><stop offset="0.35" stop-color="#ffd67a" stop-opacity="0.9"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
        <radialGradient id="ts-glow"><stop offset="0" stop-color="#c861e0" stop-opacity="0.75"/><stop offset="1" stop-color="#c861e0" stop-opacity="0"/></radialGradient>
        <radialGradient id="ts-warm"><stop offset="0" stop-color="#ffd678" stop-opacity="0.9"/><stop offset="1" stop-color="#ffd678" stop-opacity="0"/></radialGradient>
        <linearGradient id="ts-blight" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1f3a" stop-opacity="0.85"/><stop offset="0.55" stop-color="#2a1f3a" stop-opacity="0.3"/><stop offset="1" stop-color="#2a1f3a" stop-opacity="0"/></linearGradient>
      </defs>
      <g class="tl" data-d="0.05">
        <rect x="-120" y="-60" width="${W + 240}" height="${H + 120}" fill="url(#ts-sky)"/>
        <circle cx="1120" cy="560" r="260" fill="url(#ts-sun)"/>
        <circle cx="1120" cy="560" r="64" fill="#fff4cc"/>
        <g class="ts-rays"><path d="M 1120 560 L 700 -80 L 800 -80 Z M 1120 560 L 1000 -80 L 1100 -80 Z M 1120 560 L 1300 -80 L 1400 -80 Z M 1120 560 L 1600 -20 L 1680 60 Z" fill="#fff0c0" opacity="0.13"/></g>
        <g class="ts-cloud c1" fill="#ffe7c4" opacity="0.6"><ellipse cx="200" cy="170" rx="150" ry="34"/><ellipse cx="280" cy="150" rx="100" ry="30"/><ellipse cx="130" cy="150" rx="80" ry="24"/></g>
        <g class="ts-cloud c2" fill="#ffd9b0" opacity="0.5"><ellipse cx="700" cy="270" rx="190" ry="38"/><ellipse cx="800" cy="248" rx="110" ry="30"/></g>
        <g class="ts-cloud c3" fill="#fff0d6" opacity="0.55"><ellipse cx="1300" cy="120" rx="130" ry="28"/><ellipse cx="1370" cy="102" rx="80" ry="24"/></g>
      </g>
      <g class="tl" data-d="0.2">${mtn(560, 150, 90, '#7a6f98', 11, true)}${mtn(640, 120, 80, '#655f8c', 29, false)}
        <rect x="-120" y="380" width="900" height="520" fill="url(#ts-blight)"/></g>
      <g class="tl" data-d="0.45"><path d="${hillPath(690, [34, 16], [190, 71], [0.4, 1.1])}" fill="#4d8a48"/>${trees}${hollow}${bastion}</g>
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
