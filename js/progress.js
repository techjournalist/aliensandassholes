// ===================================================================
// Progress  (localStorage: unlocked levels + best star rating per level and tier)
//
// Format: { v: 1, levels: { id: { unlocked, stars, bestLives, bramble: { stars,
// bestLives } } } }. stars and bestLives are the Meadow tier (the only tier
// before difficulty tiers existed), so an old save is already a valid one; a
// missing bramble entry is filled in by defaults() like any other field.
//
// A win must never be lost. Three copies are kept and merged on every read:
// localStorage (the saved one), sessionStorage (survives a reload even when
// localStorage will not take a write) and this page's own memory (survives a
// failed or stale storage read). Merging only ever adds: a level stays unlocked
// if any copy says so, stars and best lives take the highest. A level with
// stars always opens the next one, so a half-saved win heals itself.
// ===================================================================
const Progress = (() => {
  const KEY = 'bb-progress', BACKUP = 'bb-progress-session', TIER_KEY = 'bb-difficulty';
  const TIERS = ['meadow', 'bramble'];
  let mem = null;

  function defaults() {
    const levels = {};
    LEVELS.forEach((lv, i) => { levels[lv.id] = { unlocked: i === 0, stars: 0, bestLives: null, bramble: { stars: 0, bestLives: null } }; });
    return { v: 1, levels };
  }

  function parse(raw) {
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return data && data.v === 1 && data.levels ? data : null;
    } catch (e) { return null; }
  }
  function readStore(store) {
    try { return parse(store.getItem(store === sessionStorage ? BACKUP : KEY)); } catch (e) { return null; }
  }
  const bestOf = (a, b) => (b === null || b === undefined ? a : a === null || a === undefined ? b : Math.max(a, b));
  // fold `src` into `into`: never takes anything away
  function merge(into, src) {
    for (const id in src.levels) {
      const a = into.levels[id], b = src.levels[id];
      if (!a || !b) continue;
      a.unlocked = !!(a.unlocked || b.unlocked);
      a.stars = Math.max(a.stars || 0, b.stars || 0);
      a.bestLives = bestOf(a.bestLives, b.bestLives);
      if (b.bramble && typeof b.bramble === 'object') {
        a.bramble.stars = Math.max(a.bramble.stars || 0, b.bramble.stars || 0);
        a.bramble.bestLives = bestOf(a.bramble.bestLives, b.bramble.bestLives);
      }
    }
    return into;
  }
  const tierOf = (e, tier) => (tier === 'bramble' ? e.bramble : e);
  const anyStars = (e) => (e.stars || 0) > 0 || ((e.bramble && e.bramble.stars) || 0) > 0;

  function load() {
    const data = defaults();
    for (const src of [readStore(localStorage), readStore(sessionStorage), mem]) if (src) merge(data, src);
    // a won level always opens the next one
    for (const lv of LEVELS) {
      if (anyStars(data.levels[lv.id])) {
        const next = LEVELS.find((l) => l.index === lv.index + 1);
        if (next) data.levels[next.id].unlocked = true;
      }
    }
    return data;
  }
  function save(data) {
    mem = data;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage may be blocked */ }
    try { sessionStorage.setItem(BACKUP, JSON.stringify(data)); } catch (e) { /* storage may be blocked */ }
  }

  function isUnlocked(id) { return !!load().levels[id]?.unlocked; }
  // stars on one tier (Meadow when no tier is given)
  function starsFor(id, tier) { const e = load().levels[id]; return (e && tierOf(e, tier).stars) || 0; }
  // won on any tier
  function isWon(id) { const e = load().levels[id]; return !!e && anyStars(e); }

  // safe to call more than once for the same win: it only ever adds
  function recordWin(id, stars, lives, tier) {
    const data = load();
    const entry = data.levels[id] || { unlocked: true, stars: 0, bestLives: null, bramble: { stars: 0, bestLives: null } };
    entry.unlocked = true;
    const t = tierOf(entry, tier);
    t.stars = Math.max(t.stars || 0, stars || 0);
    t.bestLives = bestOf(t.bestLives, lives);
    data.levels[id] = entry;
    const lv = LEVELS.find((l) => l.id === id);
    if (lv) {
      const next = LEVELS.find((l) => l.index === lv.index + 1);
      if (next) data.levels[next.id] = { ...(data.levels[next.id] || { stars: 0, bestLives: null }), unlocked: true };
    }
    save(data);
    return data;
  }

  // ---- save code: your campaign progress as a short piece of text ----
  // "BB1-" then, per level in order, two characters (0 locked, 1 open, 2 to 4 for
  // one to three stars; then best lives in base 36), then two check characters,
  // all in groups of four. Loading a code only ever adds, like every other merge.
  const CODE = 'BB1';
  const check = (str) => { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 1296; return h.toString(36).toUpperCase().padStart(2, '0'); };
  function exportCode() {
    const data = load();
    let body = '';
    for (const lv of LEVELS) {
      const e = data.levels[lv.id];
      const st = !e.unlocked ? 0 : e.stars >= 3 ? 4 : e.stars === 2 ? 3 : e.stars === 1 ? 2 : 1;
      body += st + Math.max(0, Math.min(35, e.bestLives || 0)).toString(36).toUpperCase();
    }
    return CODE + '-' + (body + check(CODE + body)).match(/.{1,4}/g).join('-');
  }
  // { ok: true, changed: levels that gained something } or { ok: false, reason }
  function importCode(raw) {
    const text = String(raw || '').toUpperCase().replace(/[\s_]/g, '');
    if (!text) return { ok: false, reason: 'empty' };
    if (!text.startsWith(CODE + '-')) return { ok: false, reason: 'format' };
    const all = text.slice(CODE.length + 1).replace(/-/g, '');
    if (!/^[0-9A-Z]+$/.test(all) || all.length < 4 || all.length % 2) return { ok: false, reason: 'check' };
    const body = all.slice(0, -2);
    if (check(CODE + body) !== all.slice(-2)) return { ok: false, reason: 'check' };
    const incoming = defaults();
    for (let i = 0; i < LEVELS.length && i * 2 < body.length; i++) {
      const st = parseInt(body[i * 2], 10), lives = parseInt(body[i * 2 + 1], 36);
      if (!(st >= 0 && st <= 4)) return { ok: false, reason: 'check' };
      incoming.levels[LEVELS[i].id] = { unlocked: st >= 1, stars: st >= 2 ? st - 1 : 0, bestLives: st >= 2 && lives > 0 ? lives : null };
    }
    const before = load();
    const data = load();
    merge(data, incoming);
    let changed = 0;
    for (const lv of LEVELS) {
      const a = before.levels[lv.id], b = data.levels[lv.id];
      if ((b.unlocked && !a.unlocked) || b.stars > a.stars) changed++;
    }
    save(data);
    return { ok: true, changed };
  }

  // the difficulty tier the player last picked on the world map
  function tier() {
    let t = null;
    try { t = localStorage.getItem(TIER_KEY); } catch (e) { /* storage may be blocked */ }
    return TIERS.includes(t) ? t : 'meadow';
  }
  function setTier(t) {
    const v = TIERS.includes(t) ? t : 'meadow';
    try { localStorage.setItem(TIER_KEY, v); } catch (e) { /* storage may be blocked */ }
    return v;
  }

  return { load, isUnlocked, isWon, starsFor, recordWin, exportCode, importCode, tier, setTier };
})();
