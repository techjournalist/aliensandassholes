// ===================================================================
// UI  (DOM overlay; reads GameState)
// ===================================================================
const UI = (() => {
  const $ = (id) => document.getElementById(id);
  // true while a key press is going into a text box or slider (game hotkeys must stay out of the way)
  const typingTarget = (e) => { const t = e.target; return !!(t && t.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); };
  let toastTimer = 0;
  let debugOn = false, fpsAcc = 0, fpsFrames = 0, fpsShown = 0;
  const shown = { gold: null, lives: null, wave: null, waveBtn: null, bossName: null };

  function updateHud() {
    const s = GameState.state, total = GameState.totalWaves();
    if (shown.gold !== s.gold) { $('hud-gold').textContent = s.gold; shown.gold = s.gold; }
    if (shown.lives !== s.lives) { $('hud-lives').textContent = s.lives; shown.lives = s.lives; }
    const wave = s.wave > 0 ? `Wave ${s.wave}/${total}` : 'Prep';
    if (shown.wave !== wave) { $('hud-wave').textContent = wave; shown.wave = wave; }
    const btn = $('wave-btn');
    let main, sub = '';
    if (s.waveActive) main = `${GameState.enemiesLeft()} coming`;
    else if (s.wave === 0) main = 'Send the first wave';
    else if (s.wave >= total) main = 'The valley is quiet';
    else if (s.prep > 0) { main = `Send wave ${s.wave + 1}`; sub = `auto in ${Math.ceil(s.prep)}s · now for +${Math.round(s.prep * 1.5)} gold`; }
    else main = `Send wave ${s.wave + 1}`;
    // Written to two persistent child spans via textContent, never btn.innerHTML:
    // rebuilding the button's own subtree mid-tap can drop the click on touch
    // devices if the node the gesture started on no longer exists by touchend.
    const label = main + '|' + sub;
    if (shown.waveBtn !== label) {
      $('wave-btn-main').textContent = main;
      $('wave-btn-sub').textContent = sub;
      btn.disabled = s.waveActive || s.wave >= total;
      shown.waveBtn = label;
    }
    const boss = s.enemies.find((e) => e.boss);
    $('boss-bar').classList.toggle('show', !!boss);
    if (boss) {
      $('boss-bar').querySelector('.boss-fill').style.width = Math.max(0, 100 * boss.hp / boss.maxHp) + '%';
      if (shown.bossName !== boss.name) { $('boss-name').textContent = boss.name; shown.bossName = boss.name; }
    }
  }

  function toast(text, bad) {
    const el = $('toast');
    el.textContent = text;
    el.classList.toggle('bad', !!bad);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function flash(cls) {
    const el = $('flash');
    el.classList.remove('leak');
    void el.offsetWidth;   // restart the CSS animation
    el.classList.add(cls);
  }

  // The panel in the corner: what you can do with the selected thing.
  let preview = 'slinger';   // the tower type whose range the tile preview shows
  let armed = { tower: null, branch: null };   // a specialization card tapped once, awaiting confirmation
  function previewType() { return preview; }
  const rangeWord = (r) => (r < 2.4 ? 'short' : r < 3.2 ? 'medium' : 'long');
  const rateWord = (cd) => (cd < 0.8 ? 'fast' : cd < 1.8 ? 'steady' : 'slow');
  function renderPanel() {
    const sel = GameState.state.selected;
    const panel = $('panel');
    if (!sel) { panel.classList.remove('show'); panel.innerHTML = ''; return; }
    panel.classList.add('show');
    if (sel.kind === 'tile') {
      const rows = GameState.TOWER_ORDER.map((id) => {
        const t = GameState.TOWER_TYPES[id];
        const afford = GameState.canAfford(id);
        return `
        <button class="build-btn ${id === preview ? 'previewing' : ''}" data-tower="${id}" ${afford ? '' : 'disabled'} aria-label="${t.name}, ${t.cost} gold">
          <span class="build-icon">${t.icon}</span>
          <span class="build-text"><span class="build-name">${t.name}</span><span class="build-blurb">${t.blurb}</span></span>
          <span class="build-cost ${afford ? '' : 'poor'}">&#9679; ${t.cost}</span>
        </button>`;
      }).join('');
      panel.innerHTML = `<div class="panel-title">Build here <span class="hint">${GameState.TOWER_TYPES[preview].name}'s reach is shown</span></div><div class="build-grid">${rows}</div>`;
    } else {
      const tower = GameState.towerById(sel.id);
      if (!tower) { panel.classList.remove('show'); return; }
      const t = GameState.TOWER_TYPES[tower.type];
      const st = GameState.towerStats(tower);
      const up = GameState.upgradeCost(tower);
      const affordUp = up !== null && GameState.state.gold >= up;
      const flyers = t.hitsFlying ? 'Hits flyers' : 'Ground only';
      const br = tower.branch ? GameState.BRANCHES[tower.type][tower.branch] : null;
      const tags = (st.pierce ? '<span><b>Pierces armor</b></span>' : '') + (st.shots > 1 ? `<span><b>${st.shots} targets</b></span>` : '');
      // the last upgrade is a permanent fork: two cards, tap once to arm, again to commit
      const branching = up !== null && tower.tier + 1 >= GameState.TIERS.length;
      if (!branching || armed.tower !== tower.id) armed = { tower: null, branch: null };
      const sell = `<button class="act-btn sell" data-sell="${tower.id}">Sell <span class="build-cost">&#9679; ${GameState.sellValue(tower)}</span></button>`;
      let actions;
      if (branching) {
        const cards = Object.entries(GameState.BRANCHES[tower.type]).map(([id, b]) => {
          const on = armed.branch === id;
          return `<button class="branch-btn ${on ? 'armed' : ''}" data-branch="${id}" data-tower-id="${tower.id}" ${affordUp ? '' : 'disabled'} aria-label="${b.name}, ${up} gold${on ? ', tap again to confirm' : ''}">
            <span class="branch-head"><span class="build-icon">${b.icon}</span><span class="build-name">${b.name}</span></span>
            <span class="build-blurb">${on ? 'Tap again to confirm' : b.blurb}</span>
            <span class="build-cost ${affordUp ? '' : 'poor'}">&#9679; ${up}</span>
          </button>`;
        }).join('');
        actions = `<div class="branch-label">Choose one. This is permanent.</div><div class="branch-grid">${cards}</div><div class="actions">${sell}</div>`;
      } else {
        actions = `<div class="actions">
          ${up === null
            ? '<button class="act-btn" disabled>Full strength</button>'
            : `<button class="act-btn upgrade" data-upgrade="${tower.id}" ${affordUp ? '' : 'disabled'}>Upgrade <span class="build-cost ${affordUp ? '' : 'poor'}">&#9679; ${up}</span></button>`}
          ${sell}
        </div>`;
      }
      panel.innerHTML = `
        <div class="panel-title">${br ? br.icon : t.icon} ${br ? br.name : t.name} <span class="tier">${br ? t.name : `Tier ${tower.tier}`}</span></div>
        <div class="stats">
          <span>Hit <b>${st.damage}</b>${st.splash ? ' splash' : ''}</span>
          <span>Rate <b>${rateWord(st.cooldown)}</b></span>
          <span>Reach <b>${rangeWord(st.range)}</b></span>
          <span><b>${flyers}</b></span>${tags}
        </div>
        ${actions}`;
    }
  }

  // Floating numbers: damage in cream, gold in gold, anchored to a world point.
  function floater(x, y, z, text, cls) {
    const p = Renderer.worldToScreen(x, y, z);
    const el = document.createElement('div');
    el.className = 'floater' + (cls ? ' ' + cls : '');
    el.textContent = text;
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    const host = $('floaters');
    host.appendChild(el);
    if (host.childElementCount > 40) host.removeChild(host.firstElementChild);
    el.addEventListener('animationend', () => el.remove());
  }

  // Onboarding: one tip at a time, anchored to the thing to tap next.
  function tipState() {
    const s = GameState.state;
    if (s.phase !== 'playing' || s.paused) return null;
    if (s.towers.length === 0) return 'build';
    if (s.wave === 0) return 'wave';
    return null;
  }
  function updateTip() {
    const st = tipState();
    const tip = $('tip');
    if (!st) { tip.classList.remove('show'); return; }
    tip.classList.add('show');
    if (st === 'build') {
      const sel = GameState.state.selected;
      const tipTile = GameState.currentLevel().tipTile;
      const p = Renderer.worldToScreen(GameState.worldX(tipTile[0]), 0, GameState.worldZ(tipTile[1]));
      const text = sel && sel.kind === 'tile' ? 'Now pick a tower to plant' : 'Tap here to plant a tower';
      if (sel && sel.kind === 'tile') {
        const bb = $('panel').getBoundingClientRect();
        tip.classList.add('up');
        tip.style.left = (bb.left + bb.width / 2) + 'px';
        tip.style.top = (bb.top - 52) + 'px';
        tip.style.transform = 'translate(-50%, -100%)';
      } else {
        tip.classList.remove('up');
        tip.style.left = p.x + 'px';
        tip.style.top = (p.y - 60) + 'px';
        tip.style.transform = 'translate(-50%, -100%)';
      }
      $('tip').querySelector('.tip-text').textContent = text;
    } else {
      const bb = $('wave-btn').getBoundingClientRect();
      tip.classList.add('up');
      tip.style.left = (bb.left + bb.width / 2) + 'px';
      tip.style.top = (bb.bottom + 8) + 'px';
      tip.style.transform = 'translate(-50%, 0)';
      $('tip').querySelector('.tip-text').textContent = 'Send the first wave';
    }
  }

  // A win has just happened (not a reopened end screen): play the star
  // bells and firework sounds once, not every time the screen comes back.
  let celebrateFresh = false;
  function countUp(el, to, ms, delay) {
    el.textContent = '0';
    if (!to || reducedMotion()) { el.textContent = String(to); return; }
    const t0 = performance.now() + delay;
    const tick = (now) => {
      if (!el.isConnected) return;
      const k = Math.max(0, Math.min(1, (now - t0) / ms));
      el.textContent = String(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(tick); else el.textContent = String(to);
    };
    requestAnimationFrame(tick);
  }
  const RIBBON = { 3: 'Flawless!', 2: 'Well held!', 1: 'Victory!' };
  function fillFinale() {
    const data = Progress.load().levels;
    let total = 0;
    const badges = LEVELS.map((lv) => {
      const n = (data[lv.id] && data[lv.id].stars) || 0;
      total += n;
      return `<div class="fb" title="${lv.name}"><b>${lv.index}</b><i>${[1, 2, 3].map((k) => `<span class="${k <= n ? 'on' : ''}">&#9733;</span>`).join('')}</i></div>`;
    });
    const max = LEVELS.length * 3;
    $('finale-line').textContent = 'The last shadow-bloom has withered. Light pours back into every cracked stump and the whole valley wakes to a fine, warm morning.';
    $('finale-badges').innerHTML = badges.join('');
    $('finale-total').textContent = total === max
      ? `${total} of ${max} stars. A perfect campaign. Every Bastion stood untouched.`
      : `${total} of ${max} stars across the campaign. Replay any level to earn the rest.`;
  }
  function showEnd(won) {
    const s = GameState.state, level = GameState.currentLevel();
    // Right after a win, the next level is already unlocked: offer to
    // continue straight to it instead of a generic "pick something" label.
    const next = LEVELS.find((l) => l.index === level.index + 1);
    const finale = won && !next;     // the last level of the campaign gets the big one
    // Showing a win records it again. recordWin only ever adds, so this is harmless when the
    // gameWon listener already did it, and it saves the win if that listener failed to run.
    if (won) { try { Progress.recordWin(level.id, GameState.stars(), s.lives); } catch (e) { /* never block the win screen */ } }
    const end = $('end');
    $('end-title').textContent = finale ? 'The Hollow is healed!' : won ? `${level.endpoint.properName} holds!` : `${level.endpoint.properName} has fallen`;
    const stars = won ? GameState.stars() : 0;
    const text = won ? level.endScreenText[stars](s) : level.endScreenText.lose(s);
    $('end-text').textContent = text;
    $('stars').classList.toggle('show', won);
    $('stars').querySelectorAll('span').forEach((el, i) => el.classList.toggle('lit', i < stars));
    $('end-ribbon-text').textContent = finale ? 'Dawn breaks!' : (RIBBON[stars] || 'Victory!');
    const mapBtn = $('end-map-btn');
    if (won && next) {
      mapBtn.textContent = 'Continue';
      mapBtn.dataset.nextLevel = next.id;
    } else {
      mapBtn.textContent = 'Choose another battle';
      delete mapBtn.dataset.nextLevel;
    }
    if (finale) fillFinale();
    // restart the entrance animations each time the screen opens
    end.classList.toggle('win', won);
    end.classList.toggle('finale', finale);
    end.classList.remove('show');
    void end.offsetWidth;
    end.classList.add('show');
    if (won) {
      const fresh = celebrateFresh; celebrateFresh = false;
      countUp($('stat-lives'), s.lives, 900, 700);
      countUp($('stat-kills'), s.kills || 0, 1100, 800);
      countUp($('stat-waves'), GameState.totalWaves(), 700, 900);
      Celebrate.start({ mode: finale ? 'finale' : 'win', stars, onBurst: fresh && finale ? () => { try { Audio.sfx.firework(); } catch (e) { /* audio is optional */ } } : null });
      if (fresh) {
        for (let i = 0; i < stars; i++) setTimeout(() => { if (end.classList.contains('show')) { try { Audio.sfx.star(i); } catch (e) { /* audio is optional */ } } }, 800 + i * 450);
        if (stars === 3 && !finale) for (let i = 0; i < 3; i++) setTimeout(() => { if (end.classList.contains('show')) { try { Audio.sfx.firework(); } catch (e) { /* audio is optional */ } } }, 900 + i * 700);
      }
    } else Celebrate.stop();
  }
  function waveBanner(n) {
    const info = GameState.waveInfo(n);
    const el = $('wave-banner');
    el.querySelector('.wb-title').textContent = `Wave ${n}: ${info.name}`;
    el.querySelector('.wb-flavor').textContent = info.flavor;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function updateOrientation() {
    const portrait = window.innerHeight > window.innerWidth;
    const mobile = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || window.innerWidth < 720;
    $('rotate').classList.toggle('show', portrait && mobile);
  }

  // -------- world map: pick a level, see stars/locks, commit --------
  // Static art (land, river, mountains, the blight and the Hollow's heart)
  // lives in index.html. This draws what depends on progress: roads, the
  // ground each won battle has reclaimed from the blight, and the nodes.
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}, cls) => {
    const el = document.createElementNS(SVGNS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (cls) el.setAttribute('class', cls);
    return el;
  };
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // where a level sits on the map; levels without hand-placed data fall back to a spread
  function mapPos(lv, i) {
    if (lv.map) return lv.map;
    return { x: 90 + i * (620 / Math.max(1, LEVELS.length - 1)), y: 210 + Math.sin(i * 1.3) * 60, reclaim: 90 };
  }
  // tiny landmarks matching each level's real endpoint
  const GLYPHS = {
    keep: '<rect class="st" x="-9" y="-6" width="18" height="12"></rect><rect class="st" x="-12" y="-12" width="7" height="18"></rect><rect class="st" x="5" y="-12" width="7" height="18"></rect>'
      + '<path class="rf" d="M -13 -12 A 4.5 4.5 0 0 1 -4 -12 Z"></path><path class="rf" d="M 4 -12 A 4.5 4.5 0 0 1 13 -12 Z"></path><rect class="wn" x="-2" y="-2" width="4" height="5"></rect>',
    mill: '<rect class="st" x="-10" y="-5" width="15" height="11"></rect><path class="rb" d="M -12 -5 L -2.5 -13 L 7 -5 Z"></path>'
      + '<circle class="wd" cx="9" cy="2" r="6"></circle><path class="wd" d="M 3 2 H 15 M 9 -4 V 8"></path>',
    camp: '<path class="st" d="M -13 7 L -13 -3 M -9 7 L -9 -4 M 9 7 L 9 -4 M 13 7 L 13 -3" style="fill:none;stroke:var(--bark);stroke-width:2.2"></path>'
      + '<path class="tn" d="M -7 6 L 0 -10 L 7 6 Z"></path><path class="wd" d="M 0 -10 V -15"></path><path class="rf" d="M 0 -15 L 6 -13 L 0 -11 Z"></path><rect class="wn" x="-1.5" y="1" width="3" height="5"></rect>',
    elderroot: '<circle class="er-ring" cx="0" cy="4" r="15" style="fill:none;stroke:var(--magic);stroke-width:2;opacity:0.75"></circle>'
      + '<path class="wd" d="M -6 8 L -4 -2 L -1 3 L 1 -6 L 4 1 L 7 -4 L 9 8 Z" style="fill:var(--bark);stroke:var(--ink);stroke-width:1.4"></path>'
      + '<circle class="wn" cx="1" cy="-1" r="2.4" style="fill:var(--magic)"></circle>',
    tower: '<rect class="st" x="-5" y="-10" width="10" height="17"></rect><path class="rb" d="M -7 -10 L 0 -20 L 7 -10 Z"></path><rect class="wn" x="-1.5" y="-5" width="3" height="4"></rect>',
    market: '<path class="wd" d="M -13 6 L -13 -4 M 13 6 L 13 -4" style="fill:none;stroke:var(--bark);stroke-width:2.2"></path>'
      + '<path class="rf" d="M -15 -4 L 0 -12 L 15 -4 Z"></path><path class="rf" d="M -15 -4 L -8 -1 L -8 -8 Z" style="fill:var(--gold);opacity:0.8"></path>'
      + '<rect class="wn" x="-9" y="0" width="18" height="6" style="fill:var(--water)"></rect>',
    sunkeep: '<circle cx="9" cy="-9" r="4.5" style="fill:var(--gold);stroke:var(--ink);stroke-width:1"></circle><rect class="st" x="-9" y="-6" width="18" height="12"></rect><rect class="st" x="-12" y="-12" width="7" height="18"></rect><rect class="st" x="5" y="-12" width="7" height="18"></rect>'
      + '<path class="rf" d="M -13 -12 A 4.5 4.5 0 0 1 -4 -12 Z"></path><path class="rf" d="M 4 -12 A 4.5 4.5 0 0 1 13 -12 Z"></path><rect class="wn" x="-2" y="-2" width="4" height="5"></rect>',
    apiary: '<rect class="st" x="-6" y="-2" width="12" height="14"></rect>'
      + '<path class="rf" d="M -6 -2 A 6 5 0 0 1 6 -2 Z" style="fill:var(--gold)"></path>'
      + '<rect class="wn" x="-2" y="4" width="4" height="5"></rect>',
  };
  const HOME_TREES = [[720, 108], [742, 160], [700, 88], [738, 226], [714, 268], [668, 68], [750, 118], [690, 290]];
  const DEADWOOD = [[150, 160], [92, 228], [204, 268], [380, 282], [462, 118], [250, 212], [520, 272], [176, 70], [412, 60]];
  let artDrawn = false;
  function drawMapArt() {
    if (artDrawn) return;
    artDrawn = true;
    const trees = $('wm-trees');
    for (const [x, y] of HOME_TREES) {
      trees.appendChild(svgEl('circle', { cx: x, cy: y, r: 11 }, 'wm-tree'));
      trees.appendChild(svgEl('circle', { cx: x - 3, cy: y - 4, r: 5 }, 'wm-tree-lit'));
    }
    const dead = $('wm-deadwood');
    for (const [x, y] of DEADWOOD) {
      dead.appendChild(svgEl('path', { d: `M ${x} ${y + 8} L ${x} ${y - 8} M ${x} ${y - 2} L ${x - 6} ${y - 9} M ${x} ${y - 5} L ${x + 5} ${y - 11}` }, 'wm-deadtree'));
    }
  }
  // Where one road crosses another, the later road goes over on a small wooden
  // bridge and the earlier road passes beneath in its shadow, so a crossing
  // reads as depth and not as a four-way junction.
  function drawBridges(layer, curves, ordered) {
    const pt = (k, t) => ({
      x: (1 - t) * (1 - t) * k.a.x + 2 * (1 - t) * t * k.c.x + t * t * k.b.x,
      y: (1 - t) * (1 - t) * k.a.y + 2 * (1 - t) * t * k.c.y + t * t * k.b.y,
    });
    const N = 48, polys = curves.map((k) => Array.from({ length: N + 1 }, (_, n) => pt(k, n / N)));
    const nodes = ordered.map((lv, i) => mapPos(lv, i));
    for (let m = 0; m < curves.length; m++) for (let n = m + 2; n < curves.length; n++) {
      // road n (the later one) crosses road m
      for (let u = 0; u < N; u++) for (let v = 0; v < N; v++) {
        const p1 = polys[m][u], p2 = polys[m][u + 1], q1 = polys[n][v], q2 = polys[n][v + 1];
        const rx = p2.x - p1.x, ry = p2.y - p1.y, sx = q2.x - q1.x, sy = q2.y - q1.y;
        const den = rx * sy - ry * sx;
        if (Math.abs(den) < 1e-9) continue;
        const tt = ((q1.x - p1.x) * sy - (q1.y - p1.y) * sx) / den, uu = ((q1.x - p1.x) * ry - (q1.y - p1.y) * rx) / den;
        if (tt < 0 || tt >= 1 || uu < 0 || uu >= 1) continue;
        const x = p1.x + rx * tt, y = p1.y + ry * tt;
        if (nodes.some((nd) => Math.hypot(nd.x - x, nd.y - y) < 22)) continue;   // never under a level marker
        const ang = Math.atan2(sy, sx) * 180 / Math.PI;
        const lowerAng = Math.atan2(ry, rx) * 180 / Math.PI;
        const g = svgEl('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, 'wm-bridge');
        const shadow = svgEl('ellipse', { cx: 2, cy: 4, rx: 18, ry: 5.5, transform: `rotate(${lowerAng.toFixed(1)})` }, 'wm-bridge-shadow');
        const deck = svgEl('g', { transform: `rotate(${ang.toFixed(1)})` }, 'wm-bridge-deck');
        deck.appendChild(svgEl('rect', { x: -14, y: -7.5, width: 28, height: 15, rx: 2.5 }, 'wm-bridge-wood'));
        for (const px of [-7, 0, 7]) deck.appendChild(svgEl('path', { d: `M ${px} -7 V 7` }, 'wm-bridge-plank'));
        deck.appendChild(svgEl('path', { d: 'M -14 -7.5 H 14 M -14 7.5 H 14' }, 'wm-bridge-rail'));
        g.appendChild(shadow); g.appendChild(deck);
        layer.appendChild(g);
      }
    }
  }
  let mapSelected = null, firstWin = null;
  function renderWorldMap() {
    drawMapArt();
    const svg = $('wm-svg');
    svg.querySelectorAll('.wm-node').forEach((n) => n.remove());
    const cuts = $('wm-cuts'), roads = $('wm-roads');
    cuts.innerHTML = ''; roads.innerHTML = '';
    const won = (lv) => Progress.starsFor(lv.id) > 0;
    const ordered = LEVELS.slice().sort((a, b) => a.index - b.index);
    // the next battle to fight: the first unlocked level not yet won
    const next = ordered.find((lv) => Progress.isUnlocked(lv.id) && !won(lv));
    // reclaimed ground: a soft hole in the blight around every won battle
    ordered.forEach((lv, i) => {
      if (!won(lv)) return;
      const p = mapPos(lv, i);
      cuts.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: p.reclaim, fill: 'url(#wm-soft)', 'data-level': lv.id }, 'wm-cut'));
    });
    // roads between consecutive battles: claimed, open (the way forward) or locked
    const curves = [];   // each road's quadratic curve, for the bridges below
    for (let i = 0; i < ordered.length - 1; i++) {
      const a = mapPos(ordered[i], i), b = mapPos(ordered[i + 1], i + 1);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const bend = (i % 2 ? -1 : 1) * 16;
      const cx = mx - (b.y - a.y) / len * bend, cy = my + (b.x - a.x) / len * bend;
      const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
      curves.push({ a, c: { x: cx, y: cy }, b, i });
      const state = won(ordered[i]) && won(ordered[i + 1]) ? 'claimed'
        : Progress.isUnlocked(ordered[i + 1].id) ? 'open' : 'locked';
      if (state === 'claimed') roads.appendChild(svgEl('path', { d }, 'wm-seg wm-seg-edge'));
      roads.appendChild(svgEl('path', { d, 'data-from': ordered[i].id, 'data-to': ordered[i + 1].id }, `wm-seg ${state}`));
    }
    drawBridges(roads, curves, ordered);
    ordered.forEach((lv, i) => {
      const unlocked = Progress.isUnlocked(lv.id);
      const stars = Progress.starsFor(lv.id);
      const { x, y } = mapPos(lv, i);
      const cls = 'wm-node' + (unlocked ? '' : ' locked') + (lv.id === mapSelected ? ' selected' : '') + (next && lv.id === next.id ? ' next' : '');
      const g = svgEl('g', { 'data-level': lv.id, transform: `translate(${x}, ${y})`, tabindex: unlocked ? '0' : '-1', role: 'button' }, cls);
      g.setAttribute('aria-label', unlocked ? `${lv.name}, ${stars} stars` : `${lv.name}, locked`);
      const starDots = unlocked
        ? [0, 1, 2].map((k) => `<circle class="wm-star ${k < stars ? 'lit' : ''}" cx="${(k - 1) * 11}" cy="34" r="4"></circle>`).join('')
        : '';
      const glyph = lv.map && GLYPHS[lv.map.icon] ? `<g class="wm-glyph" transform="translate(-36 -16)">${GLYPHS[lv.map.icon]}</g>` : '';
      const pennant = stars > 0 ? '<line class="wm-pennant-pole" x1="17" y1="-14" x2="17" y2="-40"></line><path class="wm-pennant" d="M 17 -40 L 33 -35 L 17 -30 Z"></path>' : '';
      g.innerHTML = `
        <circle class="wm-node-hit" r="46"></circle>
        ${next && lv.id === next.id ? '<circle class="wm-next-ring" r="24"></circle>' : ''}
        ${glyph}${pennant}
        <circle class="wm-node-badge" r="20"></circle>
        ${unlocked ? `<text class="wm-node-label" text-anchor="middle" dy="6">${lv.index}</text>` : `<text class="wm-lock-icon" text-anchor="middle" dy="6">&#128274;</text>`}
        ${starDots}`;
      svg.appendChild(g);
    });
    const sel = LEVELS.find((l) => l.id === mapSelected);
    const blurb = $('wm-blurb');
    blurb.textContent = '';
    if (sel) {
      const name = document.createElement('span');
      name.className = 'wm-name';
      name.textContent = sel.name;
      blurb.append(name, sel.subtitle);
    } else blurb.textContent = 'Pick a battle on the map.';
    $('wm-play-btn').disabled = !sel;
    const here = sel && sel.id === GameState.currentLevel().id, phase = GameState.state.phase;
    $('wm-play-btn').textContent = !sel ? 'Choose a battle'
      : !here ? `March to ${sel.name}`
      : phase === 'title' ? `Hold ${sel.name}`
      : phase === 'playing' ? `Return to ${sel.name}`
      : `Play ${sel.name} again`;
  }
  // The payoff for a first win: the blight visibly pulls back from the
  // battlefield, with a burst of spores and a chime.
  function playReclaim(id) {
    const cut = $('wm-cuts').querySelector(`[data-level="${id}"]`);
    if (!cut || reducedMotion()) return;
    const full = +cut.getAttribute('r'), cx = +cut.getAttribute('cx'), cy = +cut.getAttribute('cy');
    const t0 = performance.now(), dur = 1100;
    cut.setAttribute('r', 0);
    const step = (now) => {
      if (!cut.isConnected) return;
      const k = Math.max(0, Math.min(1, (now - t0) / dur)), e = 1 - (1 - k) ** 3;   // the frame timestamp can precede t0 by a few ms
      cut.setAttribute('r', (full * e).toFixed(1));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    const fx = $('wm-fx');
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, d = full * (0.35 + 0.4 * Math.random());
      const p = svgEl('circle', { cx: (cx + Math.cos(a) * d).toFixed(1), cy: (cy + Math.sin(a) * d * 0.8).toFixed(1), r: 3 + Math.random() * 3 }, 'wm-puff');
      p.style.animationDelay = `${(i * 0.06).toFixed(2)}s`;
      fx.appendChild(p);
      setTimeout(() => p.remove(), 1800);
    }
    try { Audio.sfx.bonus(); } catch (e) { /* audio is optional */ }
  }
  function enterWorldMap(preselectId, reclaimedId) {
    mapSelected = preselectId || GameState.currentLevel().id;
    renderWorldMap();
    $('worldmap').classList.add('show');
    if (reclaimedId) playReclaim(reclaimedId);
  }
  function commitLevel(id) {
    const phase = GameState.state.phase;
    if (id === GameState.currentLevel().id && phase === 'title') {
      $('worldmap').classList.remove('show');
      GameState.startGame();
      return;
    }
    // a battle in progress (opened from the pause menu): go back to it
    if (id === GameState.currentLevel().id && phase === 'playing') {
      $('worldmap').classList.remove('show');
      if (GameState.state.paused) $('pause').classList.add('show');
      return;
    }
    // A different level, or a finished one played again: both need a clean
    // start. (A won or lost level can't restart in place; calling startGame
    // there did nothing and left the player on a dead battlefield.)
    // Switching to a level that isn't loaded needs a reload (see P3-M0's
    // no-disposal-code rationale). The player already chose and confirmed
    // this level once, so the reload should drop them straight into play,
    // not replay the title screen and world map a second time.
    try {
      sessionStorage.setItem('bb-active-level', id);
      sessionStorage.setItem('bb-enter-play', '1');
    } catch (e) { /* ignore */ }
    location.reload();
  }

  // The boss entrance: a ribbon banner and dark screen edges. Restarting the
  // CSS animation needs a forced reflow between removing and adding the class.
  function bossIntro(name) {
    const b = $('boss-intro'), v = $('boss-vig');
    $('boss-intro-name').textContent = name || 'The Boss';
    for (const el of [b, v]) { el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }
  }
  function seedFireflies() {
    const host = $('t-flies');
    if (!host || host.childElementCount) return;
    for (let i = 0; i < 16; i++) {
      const f = document.createElement('i');
      f.style.cssText = `left:${Math.round(Math.random() * 100)}%;top:${Math.round(20 + Math.random() * 70)}%;--dur:${(6 + Math.random() * 6).toFixed(1)}s;--tw:${(2 + Math.random() * 3).toFixed(1)}s;--dl:-${(Math.random() * 8).toFixed(1)}s`;
      host.appendChild(f);
    }
  }
  function init() {
    debugOn = /[?&]debug\b/.test(location.search);
    $('debug').classList.toggle('show', debugOn);
    updateHud();
    updateOrientation();
    renderPanel();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', () => setTimeout(updateOrientation, 60));

    $('panel').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      // a tap on the map can open this panel under the same finger; the browser's
      // follow-up click must not buy anything the player never aimed at
      if (performance.now() - Input.lastTapAt() < 120) return;
      Audio.unlock();
      let res = null;
      if (btn.dataset.tower) { preview = btn.dataset.tower; res = GameState.placeTower(btn.dataset.tower); }
      else if (btn.dataset.upgrade) res = GameState.upgradeTower(+btn.dataset.upgrade);
      else if (btn.dataset.branch) {
        const id = +btn.dataset.towerId;
        if (armed.tower === id && armed.branch === btn.dataset.branch) { armed = { tower: null, branch: null }; res = GameState.upgradeTower(id, btn.dataset.branch); }
        else { armed = { tower: id, branch: btn.dataset.branch }; Audio.sfx.select(); }
      }
      else if (btn.dataset.sell) res = GameState.sellTower(+btn.dataset.sell);
      if (res && !res.ok && res.reason) toast(res.reason, true);
      renderPanel();
    });
    // Send on press-and-release of the pointer as well as on click: a click is only
    // delivered when the press and release land on the same element, and the label
    // under the finger changes every second, so some taps were lost. sendWave is
    // idempotent (it refuses while a wave is active), so firing from both is safe.
    // The wave goes first and sound last, so an audio error can never eat a tap.
    {
      const wb = $('wave-btn');
      let armed = false;
      const send = () => { GameState.sendWave(); try { Audio.unlock(); } catch (err) { /* sound must never block the wave */ } };
      wb.addEventListener('pointerdown', () => { armed = true; });
      wb.addEventListener('pointerup', () => { if (armed) { armed = false; send(); } });
      wb.addEventListener('pointercancel', () => { armed = false; });
      wb.addEventListener('click', send);
    }
    let skipToPlay = false;
    try { skipToPlay = sessionStorage.getItem('bb-enter-play') === '1'; sessionStorage.removeItem('bb-enter-play'); } catch (e) { /* ignore */ }
    if (skipToPlay) GameState.startGame(); else $('title').classList.add('show');
    $('start-btn').addEventListener('click', () => { Audio.unlock(); $('title').classList.remove('show'); enterWorldMap(); });
    const pickNode = (e) => {
      const node = e.target.closest('.wm-node');
      if (!node) return;
      const id = node.dataset.level;
      if (!Progress.isUnlocked(id)) {
        const target = LEVELS.find((l) => l.id === id);
        const prev = LEVELS.find((l) => l.index === target.index - 1);
        toast(prev ? `Hold ${prev.name} first.` : 'Not open yet.', true);
        return;
      }
      Audio.unlock();
      if (mapSelected !== id) Audio.sfx.select();
      mapSelected = id;
      renderWorldMap();
      // keep keyboard focus on the node the player just picked
      if (e.type === 'keydown') { const again = $('wm-svg').querySelector(`.wm-node[data-level="${id}"]`); if (again) again.focus(); }
    };
    $('wm-svg').addEventListener('click', pickNode);
    $('wm-svg').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      pickNode(e);
    });
    $('wm-play-btn').addEventListener('click', () => { if (mapSelected) commitLevel(mapSelected); });
    $('restart-btn').addEventListener('click', () => location.reload());
    $('end-map-btn').addEventListener('click', () => {
      const nextId = $('end-map-btn').dataset.nextLevel;
      $('end').classList.remove('show');
      enterWorldMap(nextId || undefined, firstWin);
      firstWin = null;
    });
    $('pause-restart-btn').addEventListener('click', () => location.reload());
    // never a dead button: once a level is won or lost, it brings back the end screen
    $('pause-btn').addEventListener('click', () => {
      Audio.unlock();
      const phase = GameState.state.phase;
      if (phase === 'won' || phase === 'lost') showEnd(phase === 'won');
      else GameState.pause();
    });
    $('pause-map-btn').addEventListener('click', () => { $('pause').classList.remove('show'); enterWorldMap(); });
    $('resume-btn').addEventListener('click', () => { Audio.unlock(); GameState.resume(); });
    const NEXT_SPEED = { 1: 2, 2: 4, 4: 1 };   // the speed button cycles 1x, 2x, 4x
    // four fixed views of the valley; the angle is remembered between visits
    const turnView = (dir) => { Audio.unlock(); try { Audio.sfx.select(); } catch (e) { /* audio is optional */ } Renderer.rotateView(dir); };
    $('rot-left-btn').addEventListener('click', () => turnView(-1));
    $('rot-right-btn').addEventListener('click', () => turnView(1));
    // zoom the camera; wheel, pinch and drag are in input.js
    const zoomView = (dir) => { Audio.unlock(); try { Audio.sfx.select(); } catch (e) { /* audio is optional */ } Renderer.zoomStep(dir); };
    $('zoom-in-btn').addEventListener('click', () => zoomView(1));
    $('zoom-out-btn').addEventListener('click', () => zoomView(-1));
    // tilt the camera (higher = looking more from above); right-drag and a two-finger swipe are in input.js
    const tiltView = (dir) => { Audio.unlock(); try { Audio.sfx.select(); } catch (e) { /* audio is optional */ } Renderer.tiltStep(dir); };
    $('tilt-up-btn').addEventListener('click', () => tiltView(1));
    $('tilt-down-btn').addEventListener('click', () => tiltView(-1));
    $('speed-btn').addEventListener('click', () => { Audio.unlock(); GameState.setSpeed(NEXT_SPEED[GameState.state.speed] || 1); });
    GameState.on('paused', () => {
      const s = GameState.state;
      $('pause-text').textContent = s.waveActive
        ? `Wave ${s.wave} is on the road with ${GameState.enemiesLeft()} still coming.`
        : (s.wave === 0 ? 'The road is quiet. The first wave waits for you.' : `Wave ${s.wave} turned back. ${s.lives} lives left.`);
      $('pause').classList.add('show');
      updateTip();
    });
    GameState.on('resumed', () => $('pause').classList.remove('show'));
    GameState.on('speedChanged', (x) => {
      $('speed-btn').textContent = x + '×';
      $('speed-btn').classList.toggle('fast', x === 2);
      $('speed-btn').classList.toggle('faster', x === 4);
      $('speed-btn').setAttribute('aria-label', `Game speed ${x}×`);
    });
    // the tab going away pauses the fight, so nobody comes back to an empty endpoint
    document.addEventListener('visibilitychange', () => { if (document.hidden) GameState.pause(); });
    window.addEventListener('blur', () => GameState.pause());
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (typingTarget(e)) return;   // typing a save code must never turn the camera or send a wave
      const s = GameState.state;
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (s.phase !== 'playing') return;
        e.preventDefault();
        if (s.paused) GameState.resume(); else GameState.pause();
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (s.phase === 'title') { e.preventDefault(); $('start-btn').click(); }
        else if (s.phase === 'playing' && !s.paused && !s.waveActive) { e.preventDefault(); Audio.unlock(); GameState.sendWave(); }
      } else if (e.key === 'f' || e.key === 'F') {
        if (s.phase === 'playing') GameState.setSpeed({ 1: 2, 2: 4, 4: 1 }[s.speed] || 1);
      } else if (e.key === 'q' || e.key === 'Q' || e.key === 'e' || e.key === 'E') {
        if (s.phase === 'playing') turnView(e.key === 'q' || e.key === 'Q' ? -1 : 1);
      } else if (e.key === '+' || e.key === '=') {
        if (s.phase === 'playing') zoomView(1);
      } else if (e.key === '-' || e.key === '_') {
        if (s.phase === 'playing') zoomView(-1);
      } else if (e.key === ']' || e.key === '[') {
        if (s.phase === 'playing') tiltView(e.key === ']' ? 1 : -1);
      } else if (e.key === '0') {
        if (s.phase === 'playing') { Renderer.resetLook(); Renderer.resetTilt(); }
      }
    });
    const syncMute = () => { const m = Audio.isMuted(); $('mute-btn').classList.toggle('muted', m); $('mute-btn').querySelector('.icon').innerHTML = m ? '&#128263;' : '&#128266;'; $('mute-btn').setAttribute('aria-label', m ? 'Sound off' : 'Sound on'); };
    $('mute-btn').addEventListener('click', () => { Audio.unlock(); Audio.setMuted(!Audio.isMuted()); syncMute(); });
    try { if (localStorage.getItem('bb-muted') === '1') { Audio.setMuted(true); } } catch (e) { /* ignore */ }
    syncMute();

    // ---- settings: master mute, effects and music each get a switch and a volume ----
    const settingsEl = $('settings');
    const setChecked = (btn, on) => btn.setAttribute('aria-checked', on ? 'true' : 'false');
    function syncSettings() {
      const a = Audio.getSettings();
      setChecked($('set-camui'), !document.body.classList.contains('hide-camui'));
      setChecked($('set-master'), !Audio.isMuted());
      setChecked($('set-sfx'), a.sfxOn);
      setChecked($('set-music'), a.musicOn);
      $('set-sfx-vol').value = Math.round(a.sfxVol * 100);
      $('set-music-vol').value = Math.round(a.musicVol * 100);
      $('set-sfx-vol').disabled = !a.sfxOn || Audio.isMuted();
      $('set-music-vol').disabled = !a.musicOn || Audio.isMuted();
      syncMute();
    }
    // the camera buttons in the top bar can be hidden; the choice is saved (keys and gestures stay on)
    const CAMUI_KEY = 'bb-camui';
    function setCamUi(show, save) {
      document.body.classList.toggle('hide-camui', !show);
      setChecked($('set-camui'), show);
      if (save) { try { localStorage.setItem(CAMUI_KEY, show ? '1' : '0'); } catch (e) { /* storage may be blocked */ } }
    }
    try { if (localStorage.getItem(CAMUI_KEY) === '0') setCamUi(false, false); } catch (e) { /* ignore */ }
    $('set-camui').addEventListener('click', () => { Audio.unlock(); setCamUi(document.body.classList.contains('hide-camui'), true); try { Audio.sfx.select(); } catch (e) { /* audio is optional */ } });
    function openSettings() {
      Audio.unlock();
      // opening it mid-battle pauses first, so the screen never covers a live fight
      if (GameState.state.phase === 'playing' && !GameState.state.paused) GameState.pause();
      syncSettings();
      settingsEl.classList.add('show');
      $('settings-done').focus();
    }
    function closeSettings() { settingsEl.classList.remove('show'); }
    $('settings-btn').addEventListener('click', openSettings);
    $('title-settings-btn').addEventListener('click', openSettings);
    $('pause-settings-btn').addEventListener('click', openSettings);
    $('settings-done').addEventListener('click', closeSettings);
    settingsEl.addEventListener('pointerdown', (e) => { if (e.target === settingsEl) closeSettings(); });
    $('set-master').addEventListener('click', () => { Audio.unlock(); Audio.setMuted(!Audio.isMuted()); syncSettings(); });
    $('set-sfx').addEventListener('click', () => { Audio.unlock(); Audio.setSfxOn(!Audio.getSettings().sfxOn); syncSettings(); if (Audio.getSettings().sfxOn) Audio.sfx.select(); });
    $('set-music').addEventListener('click', () => { Audio.unlock(); Audio.setMusicOn(!Audio.getSettings().musicOn); syncSettings(); });
    $('set-sfx-vol').addEventListener('input', (e) => Audio.setSfxVolume(e.target.value / 100));
    $('set-sfx-vol').addEventListener('change', () => Audio.sfx.select());   // a sample, so the level can be judged
    $('set-music-vol').addEventListener('input', (e) => Audio.setMusicVolume(e.target.value / 100));
    // ---- save code: campaign progress as text, to keep or to carry to another device ----
    const codeEl = $('savecode');
    const codeMsg = (text, kind) => { const m = $('savecode-msg'); m.textContent = text; m.className = 'sc-msg' + (kind ? ' ' + kind : ''); };
    function openSaveCode() {
      Audio.unlock();
      $('savecode-out').value = Progress.exportCode();
      $('savecode-in').value = '';
      codeMsg('');
      codeEl.classList.add('show');
      $('savecode-copy').focus();
    }
    function closeSaveCode() { codeEl.classList.remove('show'); const b = $('savecode-btn'); if (settingsEl.classList.contains('show') && b) b.focus(); }
    function copySaveCode() {
      const out = $('savecode-out'), text = out.value;
      const fallback = () => {
        try { out.focus(); out.select(); out.setSelectionRange(0, text.length); return document.execCommand && document.execCommand('copy'); } catch (e) { return false; }
      };
      const done = (ok) => codeMsg(ok ? 'Copied. Keep it somewhere safe.' : 'Could not copy. Select the code and copy it by hand.', ok ? 'ok' : 'bad');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), () => done(fallback()));
      else done(fallback());
    }
    function loadSaveCode() {
      const r = Progress.importCode($('savecode-in').value);
      if (!r.ok) {
        codeMsg({ empty: 'Paste a code first.', format: "That doesn't look like a Briar & Bastion save code.", check: "That code doesn't match. Check for a typo or a missing character." }[r.reason], 'bad');
        return;
      }
      $('savecode-out').value = Progress.exportCode();
      $('savecode-in').value = '';
      if (r.changed) { codeMsg(`Loaded. ${r.changed} ${r.changed === 1 ? 'level' : 'levels'} updated.`, 'ok'); try { Audio.sfx.select(); } catch (e) { /* audio is optional */ } }
      else codeMsg('That code has nothing new for this device.', 'ok');
      if ($('worldmap').classList.contains('show')) renderWorldMap();
    }
    $('savecode-btn').addEventListener('click', openSaveCode);
    $('savecode-done').addEventListener('click', closeSaveCode);
    $('savecode-copy').addEventListener('click', copySaveCode);
    $('savecode-load').addEventListener('click', loadSaveCode);
    $('savecode-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); loadSaveCode(); } });
    $('savecode-out').addEventListener('focus', (e) => e.target.select());
    codeEl.addEventListener('pointerdown', (e) => { if (e.target === codeEl) closeSaveCode(); });
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (codeEl.classList.contains('show')) { e.preventDefault(); e.stopImmediatePropagation(); closeSaveCode(); }
      else if (settingsEl.classList.contains('show')) { e.preventDefault(); e.stopImmediatePropagation(); closeSettings(); }
    }, true);
    GameState.on('enemyHit', ({ enemy, amount, armored, x, z }) => floater(x, enemy.boss ? 1.6 : enemy.flying ? 1.2 : 0.7, z, armored ? `${amount} clink` : amount, armored ? 'armored' : ''));
    GameState.on('waveEnded', ({ bonus }) => floater(GameState.gate.x, 1.4, GameState.gate.z, `+${bonus} wave bonus`, 'bonus'));
    GameState.on('earlyBonus', (b) => floater(GameState.gate.x, 1.4, GameState.gate.z, `+${b} for courage`, 'bonus'));
    GameState.on('endpointStateChanged', (st) => {
      const name = GameState.currentLevel().endpoint.properName;
      toast(st === 2 ? `${name} is crumbling!` : `${name} is taking damage!`, true);
    });
    GameState.on('enemyKilled', (e) => floater(e.x, 0.9, e.z, `+${e.bounty}`, 'gold'));
    GameState.on('gameWon', () => {
      celebrateFresh = true;
      firstWin = Progress.starsFor(GameState.currentLevel().id) === 0 ? GameState.currentLevel().id : null;
      Progress.recordWin(GameState.currentLevel().id, GameState.stars(), GameState.state.lives);
      // only if the result still stands when the timer fires (a stale
      // timer must never put an end screen over a game that's running)
      setTimeout(() => { if (GameState.state.phase === 'won') showEnd(true); }, 900);
    });
    GameState.on('gameLost', () => setTimeout(() => { if (GameState.state.phase === 'lost') showEnd(false); }, 900));

    // a half-made permanent choice never survives looking away
    GameState.on('selectionCleared', () => { armed = { tower: null, branch: null }; });
    GameState.on('tileSelected', () => { armed = { tower: null, branch: null }; });
    GameState.on('tileSelected', renderPanel);
    GameState.on('towerSelected', renderPanel);
    GameState.on('selectionCleared', renderPanel);
    GameState.on('towerPlaced', renderPanel);
    GameState.on('towerUpgraded', renderPanel);
    GameState.on('goldChanged', renderPanel);
    GameState.on('towerSold', ({ value }) => toast(`Sold for ${value} gold.`));
    GameState.on('towerUpgraded', (tw) => toast(tw.branch
      ? `${GameState.TOWER_TYPES[tw.type].name} becomes a ${GameState.BRANCHES[tw.type][tw.branch].name}!`
      : `${GameState.TOWER_TYPES[tw.type].name} grows to tier ${tw.tier}!`));
    GameState.on('tileRejected', (res) => { renderPanel(); toast(res.reason, true); });
    GameState.on('placeRejected', (res) => toast(res.reason, true));
    GameState.on('enemyLeaked', (e) => { flash('leak'); toast(`A ${e.name} slipped into ${GameState.currentLevel().endpoint.name}!`, true); });
    GameState.on('waveStarted', (w) => { updateHud(); waveBanner(w); });
    GameState.on('enemySpawned', (e) => { if (e.boss) bossIntro(e.name); });
    seedFireflies();
    if (typeof TitleArt !== 'undefined') TitleArt.init();
    GameState.on('waveEnded', ({ wave }) => { updateHud(); if (wave < GameState.totalWaves()) toast('The road is quiet. Build, upgrade, breathe.'); });
  }

  // Safety net: a finished level must always show its end screen (or some
  // other screen). If nothing is up for a moment after a win or loss, bring
  // the end screen back, so the player is never left on a dead battlefield.
  // Measured in wall-clock time: frame dt is clamped, so on a slow device
  // it would run far slower than real seconds.
  let noScreenSince = 0;
  function guardEnd() {
    const phase = GameState.state.phase;
    if ((phase === 'won' || phase === 'lost') && !document.querySelector('.screen.show')) {
      const now = performance.now();
      if (!noScreenSince) noScreenSince = now;
      else if (now - noScreenSince > 1500) { noScreenSince = 0; showEnd(phase === 'won'); }
    } else noScreenSince = 0;
  }
  function frame(dt) {
    updateHud();
    updateTip();
    guardEnd();
    if (!debugOn) return;
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc >= 0.5) {
      fpsShown = Math.round(fpsFrames / fpsAcc);
      fpsAcc = 0; fpsFrames = 0;
      const s = Renderer.stats();
      $('debug').textContent = `${fpsShown} fps\n${s.calls} draw calls\n${s.triangles} tris\n${window.innerWidth}x${window.innerHeight} @${Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio)}x`;
    }
  }

  return { init, frame, updateHud, toast, renderPanel, previewType };
})();
