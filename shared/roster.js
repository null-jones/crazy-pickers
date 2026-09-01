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
  function dedupe(list) {
    const seen = new Set(), out = [];
    list.map(s => s.trim()).filter(Boolean).forEach(n => {
      const k = n.toLowerCase();
      if (!seen.has(k)) { seen.add(k); out.push(n); }
    });
    return out;
  }

  // ?names=A,B,C overrides the saved list for one page load and never touches it
  const override = (() => {
    const q = new URLSearchParams(location.search).get('names');
    return q ? dedupe(q.split(',')) : null;
  })();
  const isOverride = () => !!override;

  function all() {
    if (override) return override.slice();
    const v = read(K_NAMES, null);
    return v && v.length ? v : DEFAULTS.slice();
  }
  function set(list) {
    const clean = dedupe(list);
    localStorage.setItem(K_NAMES, JSON.stringify(clean));
    const names = new Set(clean);
    localStorage.setItem(K_USED, JSON.stringify(read(K_USED, []).filter(n => names.has(n))));
    return clean;
  }
  const noRepeat = () => localStorage.getItem(K_NOREP) !== '0';
  const setNoRepeat = v => localStorage.setItem(K_NOREP, v ? '1' : '0');
  const used = () => override ? [] : read(K_USED, []);
  const clearUsed = () => localStorage.setItem(K_USED, '[]');
  const remaining = () => { const u = new Set(used()); return all().filter(n => !u.has(n)); };

  /** Choose a name. Nothing is written until commit(), so a run that is
      abandoned half-way (reload, tab closed) does not burn the pick. */
  function pick() {
    const names = all();
    if (!names.length) return 'NOBODY';
    if (!noRepeat()) return names[Math.floor(Math.random() * names.length)];
    let pool = remaining();
    if (!pool.length) { clearUsed(); pool = names.slice(); }
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function commit(winner) {
    if (!noRepeat() || override) return;
    const u = used();
    if (!u.includes(winner)) localStorage.setItem(K_USED, JSON.stringify(u.concat([winner])));
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

  return { all, set, pick, commit, reel, noRepeat, setNoRepeat, used, remaining, clearUsed, isOverride, DEFAULTS };
})();
