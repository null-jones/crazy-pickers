/* ============================================================
   Picker chrome — top bar, GO button, captions, winner card,
   roster drawer. Every picker page boots through Picker.init().
   ============================================================ */
window.Picker = (function () {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function init(opts) {
    // title/colours come from the shared manifest; the page only names its key
    const meta = (window.PICKERS || []).find(p => p.key === opts.key) || {};
    const title = opts.title || meta.title || 'Picker';
    const root = document.body;
    root.classList.add('picker');
    root.style.setProperty('--accent', opts.accent || meta.accent || '#ff2e6d');
    root.style.setProperty('--accent2', opts.accent2 || meta.accent2 || '#00e5ff');
    document.title = title + ' — Crazy Pickers';
    // compile every shader while the loading screen is still up
    try { Kit.prewarm(null, opts.prewarm); } catch (e) { console.error(e); }
    const boot = document.querySelector('.boot');
    if (boot) setTimeout(() => { boot.classList.add('gone'); setTimeout(() => boot.remove(), 500); }, 80);

    /* --- top bar --- */
    const bar = el('div', 'topbar');
    bar.innerHTML = `
      <a class="home" href="../index.html">&larr; <span class="long">All pickers</span></a>
      <h1 class="title">${title}</h1>
      <div class="spacer"></div>
      <input class="vol" id="vol" type="range" min="0" max="1" step="0.05" aria-label="Volume">
      <button class="iconbtn" id="btnSound"></button>
      <button class="iconbtn" id="btnNames">Names</button>`;
    root.appendChild(bar);
    const remainingEl = el('div', 'remaining');
    root.appendChild(remainingEl);

    /* --- go screen --- */
    const gowrap = el('div', 'gowrap');
    gowrap.innerHTML = `<p class="tag">${opts.tagline || ''}</p>
      <button class="go" id="btnGo">${opts.goLabel || 'GO'}</button>`;
    root.appendChild(gowrap);

    /* --- caption + winner --- */
    const cap = el('div', 'caption');
    root.appendChild(cap);

    const win = el('div', 'winner');
    win.innerHTML = `<p class="kicker">${opts.kicker || 'Today you are first'}</p>
      <h2 class="name"></h2>
      <p class="verdict"></p>
      <div class="row">
        <button class="btn" id="btnAgain">${opts.againLabel || 'Again'}</button>
        <a class="btn ghost" href="../index.html">Other pickers</a>
      </div>
      <p class="peekhint">Esc hides this</p>`;
    root.appendChild(win);
    const peekback = el('button', 'btn ghost peekback', 'Show result');
    root.appendChild(peekback);

    /* --- roster drawer --- */
    const scrim = el('div', 'scrim');
    const drawer = el('div', 'drawer');
    drawer.innerHTML = `
      <h2>The Roster</h2>
      <p>One name per line. Shared by every picker on this machine.</p>
      <textarea id="rosterText" spellcheck="false"></textarea>
      <label class="chk"><input type="checkbox" id="noRepeat">
        <span>No repeats &mdash; everybody goes once before anyone goes twice</span></label>
      <div class="used" id="usedList"></div>
      <div class="actions">
        <button class="iconbtn" id="btnClearUsed">Reset cycle</button>
        <button class="iconbtn" id="btnCloseNames">Done</button>
      </div>`;
    root.appendChild(scrim);
    root.appendChild(drawer);

    const $ = s => document.querySelector(s);
    const btnGo = $('#btnGo'), btnAgain = $('#btnAgain'), btnSound = $('#btnSound'), vol = $('#vol');
    const txt = $('#rosterText'), chk = $('#noRepeat'), usedList = $('#usedList');

    /* --- sound --- */
    function syncSound() { btnSound.textContent = SFX.isMuted() ? '🔇 Sound off' : '🔊 Sound on'; }
    syncSound();
    vol.value = SFX.getVolume();
    btnSound.onclick = () => { SFX.setMuted(!SFX.isMuted()); syncSound(); if (!SFX.isMuted()) SFX.click(); };
    vol.oninput = () => {
      SFX.setVolume(+vol.value);
      if (SFX.isMuted() && +vol.value > 0) { SFX.setMuted(false); syncSound(); }
    };
    vol.onchange = () => { if (!SFX.isMuted()) SFX.tick(); };

    /* --- roster --- */
    function syncRemaining() {
      if (!Roster.noRepeat() || Roster.isOverride()) { remainingEl.textContent = ''; return; }
      const left = Roster.remaining().length, total = Roster.all().length;
      remainingEl.textContent = left === total ? `${total} names, nobody has gone yet`
        : left === 0 ? 'Everyone has gone — the cycle resets on the next pick'
        : `${left} of ${total} still to go`;
    }
    function syncDrawer() {
      if (Roster.isOverride()) {
        txt.value = Roster.all().join('\n');
        txt.disabled = true;
        usedList.textContent = 'Using the ?names= list from the URL. The saved roster is untouched.';
      } else {
        txt.value = Roster.all().join('\n');
        txt.disabled = false;
        chk.checked = Roster.noRepeat();
        const u = Roster.used();
        usedList.textContent = Roster.noRepeat()
          ? (u.length ? 'Already went this cycle: ' + u.join(', ') : 'Nobody has gone yet this cycle.')
          : 'Pure chaos mode: anyone can be picked any day.';
      }
      syncRemaining();
    }
    function openDrawer(o) { drawer.classList.toggle('open', o); scrim.classList.toggle('show', o); if (o) syncDrawer(); }
    function saveDrawer() { if (!Roster.isOverride()) Roster.set(txt.value.split('\n')); syncRemaining(); }
    $('#btnNames').onclick = () => openDrawer(true);
    $('#btnCloseNames').onclick = () => { saveDrawer(); openDrawer(false); };
    scrim.onclick = () => { saveDrawer(); openDrawer(false); };
    txt.oninput = saveDrawer;
    chk.onchange = () => { Roster.setNoRepeat(chk.checked); syncDrawer(); };
    $('#btnClearUsed').onclick = () => { Roster.clearUsed(); syncDrawer(); SFX.click(); };
    syncRemaining();

    /* --- run cycle --- */
    let running = false, hasResult = false;
    const api = {
      caption(text) {
        if (!text) { cap.classList.remove('show'); return; }
        cap.textContent = text; cap.classList.add('show');
      },
      wait, rand, pick,
      names: () => Roster.all()
    };

    function showCard() { win.classList.add('show'); peekback.classList.remove('show'); }
    function peek() { win.classList.remove('show'); if (hasResult) peekback.classList.add('show'); }

    async function go() {
      if (running) return;
      running = true;
      hasResult = false;
      peekback.classList.remove('show');
      SFX.ctx();                       // unlock audio inside the click
      gowrap.classList.add('hidden');
      win.classList.remove('show');
      const winner = Roster.pick();
      try { await opts.run(winner, api); }
      catch (e) { console.error(e); }
      Roster.commit(winner);           // only now does the pick count
      syncRemaining();
      api.caption(null);
      // let the payoff shot land before anything covers it
      await wait(opts.hold ?? 1100);
      win.querySelector('.name').textContent = winner;
      const v = typeof opts.verdict === 'function' ? opts.verdict(winner) : (opts.verdict || '');
      win.querySelector('.verdict').textContent = v;
      win.querySelector('.name').style.animation = 'none';
      void win.querySelector('.name').offsetWidth;
      win.querySelector('.name').style.animation = '';
      hasResult = true;
      showCard();
      try { (opts.stinger || SFX.fanfare)(); } catch (e) { SFX.fanfare(); }
      running = false;
    }

    btnGo.onclick = go;
    btnAgain.onclick = async () => {
      win.classList.remove('show');
      hasResult = false;
      if (opts.reset) await opts.reset();
      await wait(220);
      go();
    };
    win.addEventListener('click', e => { if (e.target === win) peek(); });
    peekback.onclick = showCard;

    window.addEventListener('keydown', e => {
      if (e.target === txt || e.target === vol) return;
      if (drawer.classList.contains('open')) { if (e.key === 'Escape') openDrawer(false); return; }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (win.classList.contains('show')) btnAgain.click();
        else if (hasResult) showCard();
        else if (!running) go();
      }
      if (e.key === 'Escape') {
        if (win.classList.contains('show')) peek();
        else if (hasResult) showCard();
      }
    });

    return api;
  }

  return { init, wait, rand, pick };
})();
