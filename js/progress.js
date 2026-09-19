// ===================================================================
// Progress  (localStorage: unlocked levels + best star rating per level)
// ===================================================================
const Progress = (() => {
  const KEY = 'bb-progress';

  function defaults() {
    const levels = {};
    LEVELS.forEach((lv, i) => { levels[lv.id] = { unlocked: i === 0, stars: 0, bestLives: null }; });
    return { v: 1, levels };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const data = JSON.parse(raw);
      if (!data || data.v !== 1 || !data.levels) return defaults();
      // fill in any level added since the save was written
      const base = defaults();
      for (const id in base.levels) if (!data.levels[id]) data.levels[id] = base.levels[id];
      return data;
    } catch (e) {
      return defaults();
    }
  }
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage may be blocked */ }
  }

  function isUnlocked(id) { return !!load().levels[id]?.unlocked; }
  function starsFor(id) { return load().levels[id]?.stars || 0; }

  function recordWin(id, stars, lives) {
    const data = load();
    const entry = data.levels[id] || { unlocked: true, stars: 0, bestLives: null };
    entry.unlocked = true;
    entry.stars = Math.max(entry.stars, stars);
    entry.bestLives = entry.bestLives === null ? lives : Math.max(entry.bestLives, lives);
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
