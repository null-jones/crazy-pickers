/* ============================================================
   CRAZY PICKERS — synthesised sound effects (WebAudio, no files)
   Everything here is generated from oscillators + noise buffers,
   so the pages work offline and weigh nothing.
   ============================================================ */
window.SFX = (function () {
  let AC = null;
  let master = null;
  let muted = localStorage.getItem('crazy-pickers:muted') === '1';
  let volume = parseFloat(localStorage.getItem('crazy-pickers:volume'));
  if (!(volume >= 0 && volume <= 1)) volume = 0.8;

  function ctx() {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(AC.destination);
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  const now = () => ctx().currentTime;

  function applyMaster() { if (master) master.gain.setTargetAtTime(muted ? 0 : Math.max(1e-4, volume), now(), 0.02); }
  function setMuted(m) {
    muted = m;
    localStorage.setItem('crazy-pickers:muted', m ? '1' : '0');
    applyMaster();
  }
  const isMuted = () => muted;
  function setVolume(v) {
    volume = Math.min(1, Math.max(0, v));
    localStorage.setItem('crazy-pickers:volume', String(volume));
    applyMaster();
  }
  const getVolume = () => volume;

  /* ---------- primitives ---------- */

  let noiseBuf = null;
  function noiseBuffer() {
    if (!noiseBuf) {
      const c = ctx();
      noiseBuf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  // A single oscillator blip with an ADSR-ish envelope and optional pitch sweep.
  function tone(o) {
    const c = ctx();
    const t = (o.at || 0) + c.currentTime;
    const dur = o.dur ?? 0.2;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq ?? 440, t);
    if (o.to != null) {
      if (o.exp === false) osc.frequency.linearRampToValueAtTime(o.to, t + dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + dur);
    }
    const peak = Math.max(1e-4, o.gain ?? 0.3);   // exponential ramps cannot target 0
    const atk = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.filter) {
      const f = c.createBiquadFilter();
      f.type = o.filter;
      f.frequency.value = o.filterFreq ?? 900;
      f.Q.value = o.Q ?? 1;
      node.connect(f); node = f;
    }
    node.connect(g); g.connect(o.dest || master);
    osc.start(t); osc.stop(t + dur + 0.05);
    return { osc, gain: g, t };
  }

  // Filtered noise burst — the workhorse for crashes, splats, fire, water.
  function noise(o) {
    o = o || {};
    const c = ctx();
    const t = (o.at || 0) + c.currentTime;
    const dur = o.dur ?? 0.3;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer();
    src.loop = true;
    src.playbackRate.value = o.rate ?? 1;
    const f = c.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.freq ?? 1200, t);
    if (o.to != null) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    f.Q.value = o.Q ?? 1;
    const g = c.createGain();
    const peak = Math.max(1e-4, o.gain ?? 0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || master);
    src.start(t); src.stop(t + dur + 0.05);
    return { src, gain: g, filter: f, t };
  }

  // Sustained looping source you stop by hand (engines, water, sizzling).
  function drone(o) {
    o = o || {};
    const c = ctx();
    const t = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(1e-4, o.gain ?? 0.2), t + (o.attack ?? 0.15));
    g.connect(master);
    let src, filter = null;
    if (o.noise) {
      src = c.createBufferSource();
      src.buffer = noiseBuffer(); src.loop = true;
      src.playbackRate.value = o.rate ?? 1;
      filter = c.createBiquadFilter();
      filter.type = o.type || 'lowpass';
      filter.frequency.value = o.freq ?? 800;
      filter.Q.value = o.Q ?? 1;
      src.connect(filter); filter.connect(g);
    } else {
      src = c.createOscillator();
      src.type = o.type || 'sawtooth';
      src.frequency.value = o.freq ?? 90;
      src.connect(g);
    }
    src.start(t);
    return {
      node: src, gain: g, filter,
      freq(v, time = 0.1) {
        const p = src.frequency || (filter && filter.frequency);
        if (p) p.setTargetAtTime(v, ctx().currentTime, time);
      },
      filterTo(v, time = 0.1) { if (filter) filter.frequency.setTargetAtTime(v, ctx().currentTime, time); },
      vol(v, time = 0.1) { g.gain.setTargetAtTime(Math.max(1e-5, v), ctx().currentTime, time); },
      stop(fade = 0.2) {
        const tt = ctx().currentTime;
        g.gain.setTargetAtTime(0.0001, tt, fade / 3);
        try { src.stop(tt + fade + 0.2); } catch (e) {}
      }
    };
  }

  /* ---------- named effects ---------- */

  const S = {
    ctx, setMuted, isMuted, setVolume, getVolume, tone, noise, drone,

    click(v = 0.25) { tone({ freq: 900, to: 300, dur: 0.06, type: 'square', gain: v }); },
    tick() { noise({ dur: 0.03, freq: 4000, type: 'highpass', gain: 0.15 }); },

    ding(f = 1180) {
      tone({ freq: f, dur: 0.9, type: 'sine', gain: 0.28 });
      tone({ freq: f * 2.01, dur: 0.6, type: 'sine', gain: 0.1 });
    },

    beep(f = 660, d = 0.14) { tone({ freq: f, dur: d, type: 'square', gain: 0.18 }); },

    whoosh(dur = 0.5, gain = 0.3) {
      noise({ dur, freq: 300, to: 3000, type: 'bandpass', Q: 1.2, gain });
      noise({ at: dur * 0.35, dur: dur * 0.8, freq: 2600, to: 200, type: 'bandpass', Q: 1.2, gain: gain * 0.8 });
    },

    thud(gain = 0.5) {
      tone({ freq: 150, to: 35, dur: 0.28, type: 'sine', gain });
      noise({ dur: 0.14, freq: 500, to: 90, gain: gain * 0.5 });
    },

    boing() {
      tone({ freq: 500, to: 120, dur: 0.28, type: 'triangle', gain: 0.3 });
      tone({ at: 0.12, freq: 300, to: 700, dur: 0.2, type: 'triangle', gain: 0.2 });
      tone({ at: 0.3, freq: 600, to: 200, dur: 0.2, type: 'triangle', gain: 0.12 });
    },

    crash(gain = 0.6) {
      // metal impact: low body + bright shrapnel + long metallic ring
      tone({ freq: 90, to: 28, dur: 0.5, type: 'sine', gain: gain });
      noise({ dur: 0.5, freq: 6000, to: 300, gain: gain * 0.8 });
      noise({ dur: 1.2, freq: 3000, type: 'bandpass', Q: 6, gain: gain * 0.25 });
      for (let i = 0; i < 7; i++) {
        tone({ at: 0.02 + Math.random() * 0.35, freq: 1600 + Math.random() * 2800, dur: 0.12 + Math.random() * 0.3, type: 'square', gain: 0.05 });
      }
    },

    glass() {
      for (let i = 0; i < 22; i++) {
        tone({ at: Math.random() * 0.5, freq: 2400 + Math.random() * 5200, dur: 0.06 + Math.random() * 0.18, type: 'triangle', gain: 0.07 });
      }
      noise({ dur: 0.6, freq: 7000, type: 'highpass', gain: 0.2 });
    },

    explosion(gain = 0.8) {
      tone({ freq: 120, to: 18, dur: 1.1, type: 'sine', gain });
      noise({ dur: 1.4, freq: 1800, to: 60, gain: gain * 0.9 });
      noise({ at: 0.05, dur: 0.25, freq: 9000, to: 1200, type: 'highpass', gain: gain * 0.5 });
    },

    rumble(dur = 2, gain = 0.4) {
      noise({ dur, freq: 130, to: 60, type: 'lowpass', gain, attack: dur * 0.3 });
      tone({ freq: 40, to: 26, dur, type: 'sine', gain: gain * 0.7, attack: dur * 0.3 });
    },

    skid(dur = 0.8) {
      noise({ dur, freq: 1800, to: 900, type: 'bandpass', Q: 8, gain: 0.28, rate: 1.4 });
      noise({ dur, freq: 2600, to: 1400, type: 'bandpass', Q: 12, gain: 0.16, rate: 0.8 });
    },

    splat(gain = 0.5) {
      noise({ dur: 0.22, freq: 900, to: 120, type: 'lowpass', gain });
      tone({ freq: 260, to: 60, dur: 0.24, type: 'sawtooth', gain: gain * 0.4, filter: 'lowpass', filterFreq: 600 });
      noise({ at: 0.12, dur: 0.35, freq: 400, to: 90, type: 'lowpass', gain: gain * 0.35 });
    },

    squelch(dur = 0.5) {
      tone({ freq: 180, to: 520, dur: dur * 0.6, type: 'sawtooth', gain: 0.14, filter: 'lowpass', filterFreq: 700, Q: 6 });
      tone({ at: dur * 0.5, freq: 460, to: 130, dur: dur * 0.6, type: 'sawtooth', gain: 0.12, filter: 'lowpass', filterFreq: 600, Q: 6 });
      noise({ dur, freq: 700, to: 200, type: 'bandpass', Q: 3, gain: 0.12 });
    },

    retch(i = 0) {
      const base = 150 - i * 14;
      tone({ freq: base, to: base * 2.4, dur: 0.3, type: 'sawtooth', gain: 0.2, filter: 'lowpass', filterFreq: 780, Q: 4 });
      tone({ at: 0.26, freq: base * 2.2, to: base * 0.8, dur: 0.3, type: 'sawtooth', gain: 0.18, filter: 'lowpass', filterFreq: 700, Q: 4 });
      noise({ dur: 0.55, freq: 600, to: 220, type: 'bandpass', Q: 2, gain: 0.14 });
    },

    purr(dur = 1.4) {
      const c = ctx(), t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), f = c.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 52;
      f.type = 'lowpass'; f.frequency.value = 380;
      lfo.frequency.value = 26; lg.gain.value = 0.09;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.11, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
    },

    meow(pitch = 1) {
      tone({ freq: 640 * pitch, to: 900 * pitch, dur: 0.18, type: 'sawtooth', gain: 0.14, filter: 'bandpass', filterFreq: 1100, Q: 4 });
      tone({ at: 0.17, freq: 900 * pitch, to: 420 * pitch, dur: 0.42, type: 'sawtooth', gain: 0.16, filter: 'bandpass', filterFreq: 1000, Q: 4 });
    },

    flush(dur = 2.6) {
      const w = drone({ noise: true, type: 'bandpass', freq: 700, Q: 1.1, gain: 0.3, rate: 1.1, attack: 0.1 });
      const c = ctx(), t = c.currentTime;
      w.filter.frequency.setValueAtTime(500, t);
      w.filter.frequency.linearRampToValueAtTime(1900, t + dur * 0.45);
      w.filter.frequency.linearRampToValueAtTime(240, t + dur);
      w.gain.gain.setValueAtTime(0.0001, t);
      w.gain.gain.exponentialRampToValueAtTime(0.34, t + 0.25);
      w.gain.gain.setValueAtTime(0.34, t + dur * 0.7);
      w.gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      setTimeout(() => w.stop(0.3), dur * 1000);
      for (let i = 0; i < 14; i++) S.bubble(Math.random() * dur * 0.9);
      return w;
    },

    bubble(at = 0) {
      const f = 300 + Math.random() * 700;
      tone({ at, freq: f, to: f * 2.6, dur: 0.09, type: 'sine', gain: 0.09 });
    },

    zap() {
      tone({ freq: 3800, to: 160, dur: 0.16, type: 'sawtooth', gain: 0.22 });
      noise({ dur: 0.2, freq: 5000, to: 900, type: 'bandpass', Q: 3, gain: 0.22 });
    },

    sizzle(dur = 1) { noise({ dur, freq: 5200, type: 'highpass', gain: 0.11 }); },

    laser() { tone({ freq: 1800, to: 120, dur: 0.35, type: 'sawtooth', gain: 0.2 }); },

    alarm(times = 3) {
      for (let i = 0; i < times; i++) {
        tone({ at: i * 0.42, freq: 720, to: 980, dur: 0.2, type: 'square', gain: 0.1 });
        tone({ at: i * 0.42 + 0.2, freq: 980, to: 720, dur: 0.2, type: 'square', gain: 0.1 });
      }
    },

    engine() {
      const d = drone({ type: 'sawtooth', freq: 70, gain: 0.13 });
      const c = ctx();
      const f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 700;
      return d;
    },

    creak(dur = 1.1) {
      const c = ctx(), t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(70, t);
      for (let i = 0; i < 16; i++) o.frequency.setValueAtTime(60 + Math.random() * 90, t + (i / 16) * dur);
      f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 9;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.13, t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.05);
    },

    chomp() {
      tone({ freq: 200, to: 60, dur: 0.1, type: 'square', gain: 0.3, filter: 'lowpass', filterFreq: 500 });
      noise({ dur: 0.12, freq: 1500, to: 200, gain: 0.35 });
      tone({ at: 0.09, freq: 160, to: 45, dur: 0.14, type: 'square', gain: 0.25, filter: 'lowpass', filterFreq: 400 });
    },

    splash() {
      noise({ dur: 0.5, freq: 4000, to: 400, type: 'bandpass', Q: 0.8, gain: 0.4 });
      for (let i = 0; i < 10; i++) S.bubble(Math.random() * 0.4);
    },

    ghost(dur = 2) {
      tone({ freq: 300, to: 620, dur: dur * 0.5, type: 'sine', gain: 0.1, filter: 'bandpass', filterFreq: 800, Q: 3 });
      tone({ at: dur * 0.4, freq: 620, to: 210, dur: dur * 0.6, type: 'sine', gain: 0.12, filter: 'bandpass', filterFreq: 700, Q: 3 });
      noise({ dur, freq: 900, to: 300, type: 'bandpass', Q: 5, gain: 0.06 });
    },

    heartbeat(at = 0) {
      tone({ at, freq: 62, to: 34, dur: 0.16, type: 'sine', gain: 0.4 });
      tone({ at: at + 0.22, freq: 55, to: 30, dur: 0.2, type: 'sine', gain: 0.3 });
    },

    drumroll(dur = 1.5) {
      let t = 0;
      while (t < dur) {
        noise({ at: t, dur: 0.05, freq: 2600, type: 'bandpass', Q: 1.5, gain: 0.09 + (t / dur) * 0.1 });
        t += 0.035 + (1 - t / dur) * 0.02;
      }
      noise({ at: dur, dur: 0.4, freq: 3000, type: 'bandpass', Q: 1, gain: 0.3 });
    },

    countdown(n) { tone({ freq: n === 0 ? 900 : 520, dur: n === 0 ? 0.6 : 0.18, type: 'square', gain: 0.16 }); },

    fanfare() {
      const seq = [523.25, 659.25, 783.99, 1046.5];
      seq.forEach((f, i) => {
        tone({ at: i * 0.11, freq: f, dur: 0.5, type: 'square', gain: 0.13 });
        tone({ at: i * 0.11, freq: f * 2, dur: 0.4, type: 'triangle', gain: 0.06 });
      });
      tone({ at: 0.46, freq: 1567.98, dur: 1.1, type: 'square', gain: 0.14 });
      noise({ at: 0.46, dur: 1, freq: 6000, type: 'highpass', gain: 0.08 });
    },

    // A crowd: detuned voices through vowel formants, each whooping up and
    // back down, over a breathy bed and scattered claps. (The old version was
    // filtered noise with random blips and sounded like a detuned radio.)
    cheer(dur = 1.8) {
      const c = ctx(), t0 = c.currentTime;
      noise({ dur, freq: 700, type: 'bandpass', Q: 1.2, gain: .08, attack: .25 });
      noise({ dur: dur * .9, freq: 1700, type: 'bandpass', Q: 1.6, gain: .045, attack: .3 });
      const vowels = [[730, 1090], [570, 840], [300, 870], [530, 1840], [640, 1190], [400, 2000]];
      for (let i = 0; i < 18; i++) {
        const t = t0 + Math.random() * dur * .3, len = dur * (.45 + Math.random() * .55);
        const o = c.createOscillator(); o.type = 'sawtooth';
        const f0 = 150 + Math.random() * 280;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.linearRampToValueAtTime(f0 * (1.25 + Math.random() * .3), t + len * .3);
        o.frequency.linearRampToValueAtTime(f0 * 1.02, t + len);
        const vib = c.createOscillator(), vg = c.createGain();
        vib.frequency.value = 5 + Math.random() * 2; vg.gain.value = f0 * .025;
        vib.connect(vg); vg.connect(o.frequency);
        const [F1, F2] = vowels[i % vowels.length];
        const b1 = c.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = F1; b1.Q.value = 5;
        const b2 = c.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = F2; b2.Q.value = 7;
        const g = c.createGain();
        g.gain.setValueAtTime(.0001, t);
        g.gain.exponentialRampToValueAtTime(.05, t + .1 + Math.random() * .1);
        g.gain.exponentialRampToValueAtTime(.0001, t + len);
        o.connect(b1); o.connect(b2); b1.connect(g); b2.connect(g); g.connect(master);
        o.start(t); vib.start(t); o.stop(t + len + .05); vib.stop(t + len + .05);
      }
      for (let i = 0; i < 34; i++) {
        noise({ at: .12 + Math.random() * dur * .85, dur: .03, freq: 1400 + Math.random() * 1400, type: 'bandpass', Q: 1.1, gain: .06 });
      }
    },

    // mmm-OOO: a saw through a lowpass that opens and closes, pitch sagging
    moo(pitch = 1) {
      const c = ctx(), t = c.currentTime, dur = 1.3;
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(128 * pitch, t);
      o.frequency.linearRampToValueAtTime(122 * pitch, t + .4);
      o.frequency.linearRampToValueAtTime(92 * pitch, t + dur);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 5;
      f.frequency.setValueAtTime(240, t);
      f.frequency.linearRampToValueAtTime(950, t + .45);
      f.frequency.linearRampToValueAtTime(360, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(.24, t + .15);
      g.gain.setValueAtTime(.22, t + dur * .7);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + .05);
    },

    /* ---- endings: one per picker, so the result is not the same fanfare twelve times ---- */
    jingle() {                               // arcade prize win
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) =>
        tone({ at: i * .075, freq: f, dur: .14, type: 'square', gain: .1 }));
      [1046.5, 1318.5, 1567.98].forEach(f => tone({ at: .56, freq: f, dur: .7, type: 'square', gain: .07 }));
    },
    jaws() {                                 // the two notes, accelerating
      let at = 0, gap = .42;
      for (let i = 0; i < 8; i++) {
        tone({ at, freq: i % 2 ? 87.31 : 82.41, dur: .28, type: 'sawtooth', gain: .2, filter: 'lowpass', filterFreq: 420 });
        at += gap; gap *= .8;
      }
      S.splash && setTimeout(() => S.splash(), at * 1000);
    },
    theremin() {
      const c = ctx(), t = c.currentTime, dur = 2.2;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(520, t);
      o.frequency.linearRampToValueAtTime(880, t + .7);
      o.frequency.linearRampToValueAtTime(610, t + 1.4);
      o.frequency.linearRampToValueAtTime(990, t + dur);
      const vib = c.createOscillator(), vg = c.createGain();
      vib.frequency.value = 6.5; vg.gain.value = 16;
      vib.connect(vg); vg.connect(o.frequency);
      const g = c.createGain();
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + .3); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); vib.start(t); o.stop(t + dur + .05); vib.stop(t + dur + .05);
    },
    gong() {                                 // inharmonic partials, long tail
      [[72, .3], [118, .18], [163, .12], [231, .08], [319, .05]].forEach(([f, g]) =>
        tone({ freq: f, to: f * .985, dur: 3.2, type: 'sine', gain: g, attack: .004, exp: false }));
      noise({ dur: .25, freq: 2400, to: 300, gain: .12 });
    },
    microwaveDone() { [0, .4, .8].forEach(at => tone({ at, freq: 1000, dur: .28, type: 'square', gain: .12 })); },
    bubbleUp() {
      for (let i = 0; i < 9; i++) tone({ at: i * .07, freq: 300 + i * 90, to: 700 + i * 140, dur: .1, type: 'sine', gain: .12 });
      tone({ at: .7, freq: 1320, dur: .8, type: 'sine', gain: .16 });
    },

    groan(pitch = 1) {
      const c = ctx(), t = c.currentTime, dur = 1.1 + Math.random() * .6;
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      const lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(78 * pitch, t);
      o.frequency.linearRampToValueAtTime(58 * pitch, t + dur);
      lfo.frequency.value = 5 + Math.random() * 3; lg.gain.value = 6;
      lfo.connect(lg); lg.connect(o.frequency);
      f.type = 'lowpass'; f.frequency.setValueAtTime(260, t); f.frequency.linearRampToValueAtTime(520, t + dur * .5); f.Q.value = 4;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + .25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); lfo.start(t); o.stop(t + dur + .05); lfo.stop(t + dur + .05);
    },

    scream(pitch = 1) {
      tone({ freq: 700 * pitch, to: 1500 * pitch, dur: .22, type: 'sawtooth', gain: .12, filter: 'bandpass', filterFreq: 1400, Q: 3 });
      tone({ at: .2, freq: 1500 * pitch, to: 520 * pitch, dur: .5, type: 'sawtooth', gain: .14, filter: 'bandpass', filterFreq: 1200, Q: 3 });
      noise({ dur: .6, freq: 2400, type: 'bandpass', Q: 1.5, gain: .06 });
    },

    // rotor thud: noise whose loudness is chopped by a low-frequency LFO
    helicopter() {
      const c = ctx(), t = c.currentTime;
      const src = c.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
      const chop = c.createGain(); chop.gain.value = .5;
      const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 12;
      const lg = c.createGain(); lg.gain.value = .5;
      lfo.connect(lg); lg.connect(chop.gain);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(.3, t + 1.2);
      src.connect(f); f.connect(chop); chop.connect(g); g.connect(master);
      src.start(t); lfo.start(t);
      return {
        gain: g,
        stop(fade = 1) {
          const tt = ctx().currentTime;
          g.gain.setTargetAtTime(0.0001, tt, fade / 3);
          try { src.stop(tt + fade + .2); lfo.stop(tt + fade + .2); } catch (e) {}
        }
      };
    },

    crack() {
      noise({ dur: .09, freq: 5200, to: 900, type: 'bandpass', Q: 1.2, gain: .55 });
      tone({ freq: 900, to: 180, dur: .12, type: 'square', gain: .22 });
      tone({ freq: 2400, dur: .35, type: 'triangle', gain: .08 });
    },

    // the three-note ballpark organ, then the "charge" rise
    organ(charge = true) {
      const seq = [[392, 0], [523.25, .22], [659.25, .44]];
      seq.forEach(([f, at]) => {
        tone({ at, freq: f, dur: .3, type: 'square', gain: .09 });
        tone({ at, freq: f * 2, dur: .3, type: 'sine', gain: .05 });
      });
      if (charge) {
        [[392, .8], [523.25, .95], [659.25, 1.1], [783.99, 1.25], [1046.5, 1.45]].forEach(([f, at]) => {
          tone({ at, freq: f, dur: at > 1.4 ? .9 : .17, type: 'square', gain: .1 });
        });
      }
    },

    bonk() {
      tone({ freq: 620, to: 140, dur: .18, type: 'triangle', gain: .32 });
      tone({ at: .02, freq: 240, to: 70, dur: .25, type: 'sine', gain: .3 });
      noise({ dur: .08, freq: 1800, to: 400, gain: .25 });
    },

    sadTrombone() {
      const seq = [[311.13, 0], [293.66, 0.22], [277.18, 0.44], [261.63, 0.66]];
      seq.forEach(([f, at]) => tone({ at, freq: f, to: f * 0.97, dur: at === 0.66 ? 0.9 : 0.24, type: 'sawtooth', gain: 0.13, filter: 'lowpass', filterFreq: 900 }));
    }
  };
  return S;
})();
