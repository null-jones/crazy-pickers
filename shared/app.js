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
    const root = document.body;
    root.classList.add('picker');
    if (opts.accent) root.style.setProperty('--accent', opts.accent);
    if (opts.accent2) root.style.setProperty('--accent2', opts.accent2);
    document.title = opts.title + ' — Crazy Pickers';

    /* --- top bar --- */
    const bar = el('div', 'topbar');
    bar.innerHTML = `
      <a class="home" href="../index.html">&larr; <span class="long">All pickers</span></a>
      <h1 class="title">${opts.title}</h1>
      <div class="spacer"></div>
      <button class="iconbtn" id="btnSound"></button>
      <button class="iconbtn" id="btnNames">Names</button>`;
    root.appendChild(bar);

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
      </div>`;
    root.appendChild(win);

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
    const btnGo = $('#btnGo'), btnAgain = $('#btnAgain'), btnSound = $('#btnSound');
    const txt = $('#rosterText'), chk = $('#noRepeat'), usedList = $('#usedList');

    function syncSound() { btnSound.textContent = SFX.isMuted() ? '🔇 Sound off' : '🔊 Sound on'; }
    syncSound();
    btnSound.onclick = () => { SFX.setMuted(!SFX.isMuted()); syncSound(); if (!SFX.isMuted()) SFX.click(); };

    function syncDrawer() {
      txt.value = Roster.all().join('\n');
      chk.checked = Roster.noRepeat();
      const u = Roster.used();
      usedList.textContent = Roster.noRepeat()
        ? (u.length ? 'Already went this cycle: ' + u.join(', ') : 'Nobody has gone yet this cycle.')
        : 'Pure chaos mode: anyone can be picked any day.';
    }
    function openDrawer(o) { drawer.classList.toggle('open', o); scrim.classList.toggle('show', o); if (o) syncDrawer(); }
    $('#btnNames').onclick = () => openDrawer(true);
    $('#btnCloseNames').onclick = () => { Roster.set(txt.value.split('\n')); openDrawer(false); };
    scrim.onclick = () => { Roster.set(txt.value.split('\n')); openDrawer(false); };
    txt.oninput = () => Roster.set(txt.value.split('\n'));
    chk.onchange = () => { Roster.setNoRepeat(chk.checked); syncDrawer(); };
    $('#btnClearUsed').onclick = () => { Roster.clearUsed(); syncDrawer(); SFX.click(); };

    /* --- run cycle --- */
    let running = false;
    const api = {
      caption(text) {
        if (!text) { cap.classList.remove('show'); return; }
        cap.textContent = text; cap.classList.add('show');
      },
      wait, rand, pick,
      names: () => Roster.all()
    };

    async function go() {
      if (running) return;
      running = true;
      SFX.ctx();                       // unlock audio inside the click
      gowrap.classList.add('hidden');
      win.classList.remove('show');
      const winner = Roster.pick();
      try { await opts.run(winner, api); }
      catch (e) { console.error(e); }
      api.caption(null);
      win.querySelector('.name').textContent = winner;
      const v = typeof opts.verdict === 'function' ? opts.verdict(winner) : (opts.verdict || '');
      win.querySelector('.verdict').textContent = v;
      win.querySelector('.name').style.animation = 'none';
      void win.querySelector('.name').offsetWidth;
      win.querySelector('.name').style.animation = '';
      win.classList.add('show');
      SFX.fanfare();
      running = false;
    }

    btnGo.onclick = go;
    btnAgain.onclick = async () => {
      win.classList.remove('show');
      if (opts.reset) await opts.reset();
      await wait(220);
      go();
    };
    window.addEventListener('keydown', e => {
      if (drawer.classList.contains('open')) { if (e.key === 'Escape') openDrawer(false); return; }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (win.classList.contains('show')) btnAgain.click();
        else if (!running) go();
      }
      if (e.key === 'Escape' && win.classList.contains('show')) win.classList.remove('show');
    });

    return api;
  }

  return { init, wait, rand, pick };
})();
