// ===================================================================
// Progress  (localStorage: unlocked levels + best star rating per level)
//
// A win must never be lost. Three copies are kept and merged on every read:
// localStorage (the saved one), sessionStorage (survives a reload even when
// localStorage will not take a write) and this page's own memory (survives a
// failed or stale storage read). Merging only ever adds: a level stays unlocked
// if any copy says so, stars and best lives take the highest. A level with
// stars always opens the next one, so a half-saved win heals itself.
// ===================================================================
const Progress = (() => {
  const KEY = 'bb-progress', BACKUP = 'bb-progress-session';
  let mem = null;

  function defaults() {
    const levels = {};
    LEVELS.forEach((lv, i) => { levels[lv.id] = { unlocked: i === 0, stars: 0, bestLives: null }; });
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
  // fold `src` into `into`: never takes anything away
  function merge(into, src) {
    for (const id in src.levels) {
      const a = into.levels[id], b = src.levels[id];
      if (!a || !b) continue;
      a.unlocked = !!(a.unlocked || b.unlocked);
      a.stars = Math.max(a.stars || 0, b.stars || 0);
      if (b.bestLives !== null && b.bestLives !== undefined) a.bestLives = a.bestLives === null || a.bestLives === undefined ? b.bestLives : Math.max(a.bestLives, b.bestLives);
    }
    return into;
  }

  function load() {
    const data = defaults();
    for (const src of [readStore(localStorage), readStore(sessionStorage), mem]) if (src) merge(data, src);
    // a won level always opens the next one
    for (const lv of LEVELS) {
      if ((data.levels[lv.id].stars || 0) > 0) {
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
  function starsFor(id) { return load().levels[id]?.stars || 0; }

  // safe to call more than once for the same win: it only ever adds
  function recordWin(id, stars, lives) {
    const data = load();
    const entry = data.levels[id] || { unlocked: true, stars: 0, bestLives: null };
    entry.unlocked = true;
    entry.stars = Math.max(entry.stars || 0, stars || 0);
    entry.bestLives = entry.bestLives === null || entry.bestLives === undefined ? lives : Math.max(entry.bestLives, lives);
    data.levels[id] = entry;
    const lv = LEVELS.find((l) => l.id === id);
    if (lv) {
      const next = LEVELS.find((l) => l.index === lv.index + 1);
      if (next) data.levels[next.id] = { ...(data.levels[next.id] || { stars: 0, bestLives: null }), unlocked: true };
    }
    save(data);
    return data;
  }

  return { load, isUnlocked, starsFor, recordWin };
})();
