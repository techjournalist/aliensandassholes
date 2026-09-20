// ===================================================================
// UI  (DOM overlay; reads GameState)
// ===================================================================
const UI = (() => {
  const $ = (id) => document.getElementById(id);
  let toastTimer = 0;
  let debugOn = false, fpsAcc = 0, fpsFrames = 0, fpsShown = 0;
  const shown = { gold: null, lives: null, wave: null, waveBtn: null };

  function updateHud() {
    const s = GameState.state, total = GameState.totalWaves();
    if (shown.gold !== s.gold) { $('hud-gold').textContent = s.gold; shown.gold = s.gold; }
    if (shown.lives !== s.lives) { $('hud-lives').textContent = s.lives; shown.lives = s.lives; }
    const wave = s.wave > 0 ? `Wave ${s.wave}/${total}` : 'Prep';
    if (shown.wave !== wave) { $('hud-wave').textContent = wave; shown.wave = wave; }
    const btn = $('wave-btn');
    let label;
    if (s.waveActive) label = `${GameState.enemiesLeft()} coming`;
    else if (s.wave === 0) label = 'Send the first wave';
    else if (s.wave >= total) label = 'The valley is quiet';
    else if (s.prep > 0) label = `Send wave ${s.wave + 1}<span class="sub">auto in ${Math.ceil(s.prep)}s &middot; now for +${Math.round(s.prep * 1.5)} gold</span>`;
    else label = `Send wave ${s.wave + 1}`;
    if (shown.waveBtn !== label) {
      btn.innerHTML = label;
      btn.disabled = s.waveActive || s.wave >= total;
      shown.waveBtn = label;
    }
    const boss = s.enemies.find((e) => e.boss);
    $('boss-bar').classList.toggle('show', !!boss);
    if (boss) $('boss-bar').querySelector('.boss-fill').style.width = Math.max(0, 100 * boss.hp / boss.maxHp) + '%';
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
      panel.innerHTML = `
        <div class="panel-title">${t.icon} ${t.name} <span class="tier">Tier ${tower.tier}</span></div>
        <div class="stats">
          <span>Hit <b>${st.damage}</b>${st.splash ? ' splash' : ''}</span>
          <span>Rate <b>${rateWord(st.cooldown)}</b></span>
          <span>Reach <b>${rangeWord(st.range)}</b></span>
          <span><b>${flyers}</b></span>
        </div>
        <div class="actions">
          ${up === null
            ? '<button class="act-btn" disabled>Full strength</button>'
            : `<button class="act-btn upgrade" data-upgrade="${tower.id}" ${affordUp ? '' : 'disabled'}>Upgrade <span class="build-cost ${affordUp ? '' : 'poor'}">&#9679; ${up}</span></button>`}
          <button class="act-btn sell" data-sell="${tower.id}">Sell <span class="build-cost">&#9679; ${GameState.sellValue(tower)}</span></button>
        </div>`;
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

  function showEnd(won) {
    const s = GameState.state, level = GameState.currentLevel();
    $('end-title').textContent = won ? `${level.endpoint.properName} holds!` : `${level.endpoint.properName} has fallen`;
    const stars = won ? GameState.stars() : 0;
    const text = won ? level.endScreenText[stars](s) : level.endScreenText.lose(s);
    $('end-text').textContent = text;
    $('stars').classList.toggle('show', won);
    $('stars').querySelectorAll('span').forEach((el, i) => el.classList.toggle('lit', i < stars));
    // Right after a win, the next level is already unlocked: offer to
    // continue straight to it instead of a generic "pick something" label.
    const next = LEVELS.find((l) => l.index === level.index + 1);
    const mapBtn = $('end-map-btn');
    if (won && next) {
      mapBtn.textContent = 'Continue';
      mapBtn.dataset.nextLevel = next.id;
    } else {
      mapBtn.textContent = 'Choose another battle';
      delete mapBtn.dataset.nextLevel;
    }
    $('end').classList.add('show');
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
  let mapSelected = null;
  function renderWorldMap() {
    const svg = $('wm-svg');
    svg.querySelectorAll('.wm-node').forEach((n) => n.remove());
    const n = LEVELS.length;
    LEVELS.forEach((lv, i) => {
      const unlocked = Progress.isUnlocked(lv.id);
      const stars = Progress.starsFor(lv.id);
      const x = 90 + i * (620 / Math.max(1, n - 1 || 1));
      const y = 210 + Math.sin(i * 1.3) * 60;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'wm-node' + (unlocked ? '' : ' locked') + (lv.id === mapSelected ? ' selected' : ''));
      g.setAttribute('data-level', lv.id);
      g.setAttribute('transform', `translate(${x}, ${y})`);
      g.setAttribute('tabindex', unlocked ? '0' : '-1');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', unlocked ? `${lv.name}, ${stars} stars` : `${lv.name}, locked`);
      const starDots = unlocked
        ? [0, 1, 2].map((k) => `<circle class="wm-star ${k < stars ? 'lit' : ''}" cx="${(k - 1) * 11}" cy="34" r="4"></circle>`).join('')
        : '';
      g.innerHTML = `
        <circle class="wm-node-hit" r="46"></circle>
        <circle class="wm-node-badge" r="20"></circle>
        ${unlocked ? `<text class="wm-node-label" text-anchor="middle" dy="6">${lv.index}</text>` : `<text class="wm-lock-icon" text-anchor="middle" dy="6">&#128274;</text>`}
        ${starDots}`;
      svg.appendChild(g);
    });
    const sel = LEVELS.find((l) => l.id === mapSelected);
    $('wm-blurb').textContent = sel ? sel.subtitle : 'Pick a battle on the map.';
    $('wm-play-btn').disabled = !sel;
    $('wm-play-btn').textContent = sel && sel.id === GameState.currentLevel().id ? `Hold ${sel.name}` : sel ? `March to ${sel.name}` : 'Choose a battle';
  }
  function enterWorldMap(preselectId) {
    mapSelected = preselectId || GameState.currentLevel().id;
    renderWorldMap();
    $('worldmap').classList.add('show');
  }
  function commitLevel(id) {
    if (id === GameState.currentLevel().id) {
      $('worldmap').classList.remove('show');
      GameState.startGame();
      return;
    }
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
      else if (btn.dataset.sell) res = GameState.sellTower(+btn.dataset.sell);
      if (res && !res.ok && res.reason) toast(res.reason, true);
      renderPanel();
    });
    $('wave-btn').addEventListener('click', () => { Audio.unlock(); GameState.sendWave(); });
    let skipToPlay = false;
    try { skipToPlay = sessionStorage.getItem('bb-enter-play') === '1'; sessionStorage.removeItem('bb-enter-play'); } catch (e) { /* ignore */ }
    if (skipToPlay) GameState.startGame(); else $('title').classList.add('show');
    $('start-btn').addEventListener('click', () => { Audio.unlock(); $('title').classList.remove('show'); enterWorldMap(); });
    $('wm-svg').addEventListener('click', (e) => {
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
      mapSelected = id;
      renderWorldMap();
    });
    $('wm-play-btn').addEventListener('click', () => { if (mapSelected) commitLevel(mapSelected); });
    $('restart-btn').addEventListener('click', () => location.reload());
    $('end-map-btn').addEventListener('click', () => {
      const nextId = $('end-map-btn').dataset.nextLevel;
      $('end').classList.remove('show');
      enterWorldMap(nextId || undefined);
    });
    $('pause-restart-btn').addEventListener('click', () => location.reload());
    $('pause-btn').addEventListener('click', () => { Audio.unlock(); GameState.pause(); });
    $('resume-btn').addEventListener('click', () => { Audio.unlock(); GameState.resume(); });
    $('speed-btn').addEventListener('click', () => { Audio.unlock(); GameState.setSpeed(GameState.state.speed === 1 ? 2 : 1); });
    GameState.on('paused', () => {
      const s = GameState.state;
      $('pause-text').textContent = s.waveActive
        ? `Wave ${s.wave} is on the road with ${GameState.enemiesLeft()} still coming.`
        : (s.wave === 0 ? 'The road is quiet. The first wave waits for you.' : `Wave ${s.wave} turned back. ${s.lives} lives left.`);
      $('pause').classList.add('show');
      updateTip();
    });
    GameState.on('resumed', () => $('pause').classList.remove('show'));
    GameState.on('speedChanged', (x) => { $('speed-btn').textContent = x + '×'; $('speed-btn').classList.toggle('fast', x === 2); });
    // the tab going away pauses the fight, so nobody comes back to an empty endpoint
    document.addEventListener('visibilitychange', () => { if (document.hidden) GameState.pause(); });
    window.addEventListener('blur', () => GameState.pause());
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const s = GameState.state;
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (s.phase !== 'playing') return;
        e.preventDefault();
        if (s.paused) GameState.resume(); else GameState.pause();
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (s.phase === 'title') { e.preventDefault(); $('start-btn').click(); }
        else if (s.phase === 'playing' && !s.paused && !s.waveActive) { e.preventDefault(); Audio.unlock(); GameState.sendWave(); }
      } else if (e.key === 'f' || e.key === 'F') {
        if (s.phase === 'playing') GameState.setSpeed(s.speed === 1 ? 2 : 1);
      }
    });
    const syncMute = () => { const m = Audio.isMuted(); $('mute-btn').classList.toggle('muted', m); $('mute-btn').querySelector('.icon').innerHTML = m ? '&#128263;' : '&#128266;'; $('mute-btn').setAttribute('aria-label', m ? 'Sound off' : 'Sound on'); };
    $('mute-btn').addEventListener('click', () => { Audio.unlock(); Audio.setMuted(!Audio.isMuted()); syncMute(); });
    try { if (localStorage.getItem('bb-muted') === '1') { Audio.setMuted(true); } } catch (e) { /* ignore */ }
    syncMute();
    GameState.on('enemyHit', ({ enemy, amount, armored, x, z }) => floater(x, enemy.boss ? 1.6 : enemy.flying ? 1.2 : 0.7, z, armored ? `${amount} clink` : amount, armored ? 'armored' : ''));
    GameState.on('waveEnded', ({ bonus }) => floater(GameState.gate.x, 1.4, GameState.gate.z, `+${bonus} wave bonus`, 'bonus'));
    GameState.on('earlyBonus', (b) => floater(GameState.gate.x, 1.4, GameState.gate.z, `+${b} for courage`, 'bonus'));
    GameState.on('endpointStateChanged', (st) => {
      const name = GameState.currentLevel().endpoint.properName;
      toast(st === 2 ? `${name} is crumbling!` : `${name} is taking damage!`, true);
    });
    GameState.on('enemyKilled', (e) => floater(e.x, 0.9, e.z, `+${e.bounty}`, 'gold'));
    GameState.on('gameWon', () => {
      Progress.recordWin(GameState.currentLevel().id, GameState.stars(), GameState.state.lives);
      setTimeout(() => showEnd(true), 900);
    });
    GameState.on('gameLost', () => setTimeout(() => showEnd(false), 900));

    GameState.on('tileSelected', renderPanel);
    GameState.on('towerSelected', renderPanel);
    GameState.on('selectionCleared', renderPanel);
    GameState.on('towerPlaced', renderPanel);
    GameState.on('towerUpgraded', renderPanel);
    GameState.on('goldChanged', renderPanel);
    GameState.on('towerSold', ({ value }) => toast(`Sold for ${value} gold.`));
    GameState.on('towerUpgraded', (tw) => toast(`${GameState.TOWER_TYPES[tw.type].name} grows to tier ${tw.tier}!`));
    GameState.on('tileRejected', (res) => { renderPanel(); toast(res.reason, true); });
    GameState.on('placeRejected', (res) => toast(res.reason, true));
    GameState.on('enemyLeaked', (e) => { flash('leak'); toast(`A ${e.name} slipped into ${GameState.currentLevel().endpoint.name}!`, true); });
    GameState.on('waveStarted', (w) => { updateHud(); waveBanner(w); });
    GameState.on('waveEnded', ({ wave }) => { updateHud(); if (wave < GameState.totalWaves()) toast('The road is quiet. Build, upgrade, breathe.'); });
  }

  function frame(dt) {
    updateHud();
    updateTip();
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
