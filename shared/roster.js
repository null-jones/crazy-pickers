/* ============================================================
   Shared roster — one name list across every picker (localStorage)
   ============================================================ */
window.Roster = (function () {
  const K_NAMES = 'crazy-pickers:names';
  const K_USED = 'crazy-pickers:used';
  const K_NOREP = 'crazy-pickers:norepeat';
  const DEFAULTS = ['Ellie', 'Alex', 'Priya', 'Sam', 'Jordan', 'Nadia', 'Tom', 'Mika'];

  function read(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : fallback; }
    catch (e) { return fallback; }
  }
  function all() {
    // ?names=A,B,C overrides everything for that one page load
    const q = new URLSearchParams(location.search).get('names');
    if (q) return q.split(',').map(s => s.trim()).filter(Boolean);
    const v = read(K_NAMES, null);
    return v && v.length ? v : DEFAULTS.slice();
  }
  function set(list) {
    const clean = list.map(s => s.trim()).filter(Boolean);
    localStorage.setItem(K_NAMES, JSON.stringify(clean));
    const names = new Set(clean);
    localStorage.setItem(K_USED, JSON.stringify(read(K_USED, []).filter(n => names.has(n))));
    return clean;
  }
  const noRepeat = () => localStorage.getItem(K_NOREP) !== '0';
  const setNoRepeat = v => localStorage.setItem(K_NOREP, v ? '1' : '0');
  const used = () => read(K_USED, []);
  const clearUsed = () => localStorage.setItem(K_USED, '[]');

  function pick() {
    const names = all();
    if (!names.length) return 'NOBODY';
    if (!noRepeat()) return names[Math.floor(Math.random() * names.length)];
    let pool = names.filter(n => !used().includes(n));
    if (!pool.length) { clearUsed(); pool = names.slice(); }
    const winner = pool[Math.floor(Math.random() * pool.length)];
    localStorage.setItem(K_USED, JSON.stringify(used().concat([winner])));
    return winner;
  }

  // A shuffled reel of names to flicker through while the animation builds,
  // guaranteed to end on the real winner.
  function reel(n, winner) {
    const names = all();
    const out = [];
    for (let i = 0; i < n; i++) out.push(names[Math.floor(Math.random() * names.length)]);
    if (winner) out[out.length - 1] = winner;
    return out;
  }

  return { all, set, pick, reel, noRepeat, setNoRepeat, used, clearUsed, DEFAULTS };
})();
