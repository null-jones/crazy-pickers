/* ============================================================
   Three.js helpers shared by every picker: stage + loop,
   promise tweens, name textures, camera shake, debris bursts.
   ============================================================ */
window.Kit = (function () {
  const T = () => window.THREE;
  const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- easing ---------- */
  const ease = {
    linear: t => t,
    inQuad: t => t * t,
    outQuad: t => 1 - (1 - t) * (1 - t),
    inOutQuad: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    inCubic: t => t * t * t,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    inQuart: t => t * t * t * t,
    outQuart: t => 1 - Math.pow(1 - t, 4),
    outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    inExpo: t => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
    outBack: t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
    outElastic: t => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1,
    outBounce: t => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375;
      return n * (t -= 2.625 / d) * t + .984375;
    }
  };

  const tweens = [];
  /** Promise tween driven by the render loop. fn(t01, dt) each frame. */
  function tween(dur, fn, easing) {
    const e = typeof easing === 'string' ? ease[easing] : (easing || ease.linear);
    return new Promise(resolve => tweens.push({ t: 0, dur, fn, e, resolve }));
  }
  function tickTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur);
      try { tw.fn(tw.e(p), dt, p); } catch (err) { console.error(err); }
      if (p >= 1) { tweens.splice(i, 1); tw.resolve(); }
    }
  }
  function clearTweens() { while (tweens.length) { const tw = tweens.pop(); tw.resolve(); } }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pickOne = a => a[Math.floor(Math.random() * a.length)];

  /* ---------- stage ---------- */
  function stage(o) {
    o = o || {};
    const THREE = T();
    let canvas = document.getElementById('stage');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'stage';
      document.body.appendChild(canvas);
    }
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: !!o.alpha });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = o.shadows !== false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = o.toneMapping ?? THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = o.exposure ?? 1;

    const scene = new THREE.Scene();
    if (o.bg) scene.background = new THREE.Color(o.bg);
    if (o.fog) scene.fog = new THREE.Fog(o.fog.color ?? o.bg ?? 0x000000, o.fog.near ?? 10, o.fog.far ?? 90);

    const camera = new THREE.PerspectiveCamera(o.fov ?? 52, 1, o.near ?? 0.1, o.far ?? 500);
    const rig = new THREE.Object3D();
    rig.add(camera);
    scene.add(rig);

    const updates = [];
    const clock = new THREE.Clock();
    const _lookM = new THREE.Matrix4();
    const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
    let shakeAmt = 0, shakeDecay = 1, running = true;

    // Keep the *horizontal* field of view constant on narrow/portrait screens,
    // so a shot framed on a laptop still contains the action on a phone.
    const baseFov = o.fov ?? 52, refAspect = o.refAspect ?? 16 / 9;
    function resize() {
      const w = innerWidth, h = innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = camera.aspect >= refAspect ? baseFov
        : 2 * Math.atan(Math.tan(baseFov * Math.PI / 360) * (refAspect / camera.aspect)) * 180 / Math.PI;
      camera.updateProjectionMatrix();
    }
    addEventListener('resize', resize);
    resize();
    // rAF stops while the tab is hidden; without this the first frame back
    // would apply one clamped 50ms step while setTimeout-based waits had
    // carried on, so swallow the gap.
    addEventListener('visibilitychange', () => { if (!document.hidden) clock.getDelta(); });

    function frame() {
      if (!running) return;
      requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      tickTweens(dt);
      for (let i = updates.length - 1; i >= 0; i--) {
        const u = updates[i];
        if (u(dt) === false) updates.splice(i, 1);
      }
      if (shakeAmt > 0.0005) {
        camera.position.set(rnd(-1, 1) * shakeAmt, rnd(-1, 1) * shakeAmt, rnd(-1, 1) * shakeAmt * .5);
        camera.rotation.z = rnd(-1, 1) * shakeAmt * 0.06;
        shakeAmt *= Math.pow(shakeDecay, dt * 60);
      } else if (shakeAmt !== 0) {
        shakeAmt = 0; camera.position.set(0, 0, 0); camera.rotation.z = 0;
      }
      renderer.render(scene, camera);
    }
    frame();

    const api = {
      THREE, renderer, scene, camera, rig, clock,
      add: fn => updates.push(fn),
      remove: fn => { const i = updates.indexOf(fn); if (i >= 0) updates.splice(i, 1); },
      shake(amount = 0.4, decay = 0.92) { if (reduceMotion) return; shakeAmt = Math.max(shakeAmt, amount); shakeDecay = decay; },
      /** place the camera rig and aim it.
          NB: Object3D.lookAt points +Z at the target, but a camera looks down
          -Z — so build the orientation with Matrix4.lookAt (camera convention). */
      look(pos, target) {
        rig.position.set(pos[0], pos[1], pos[2]);
        _lookM.lookAt(_v1.set(pos[0], pos[1], pos[2]), _v2.set(target[0], target[1], target[2]), _up);
        rig.quaternion.setFromRotationMatrix(_lookM);
      },
      dispose() { running = false; }
    };
    if (/[?&]debug/.test(location.search)) window.__stage = api;   // console handle, ?debug=1
    return api;
  }

  /**
   * Prefilter an equirect texture into a real environment map.
   * Without this, metalness>0 materials have nothing to reflect and render black.
   */
  function env(st, texture, intensity) {
    const THREE = T();
    const pmrem = new THREE.PMREMGenerator(st.renderer);
    pmrem.compileEquirectangularShader();
    const rt = pmrem.fromEquirectangular(texture);
    st.scene.environment = rt.texture;
    if (intensity != null && 'environmentIntensity' in st.scene) st.scene.environmentIntensity = intensity;
    pmrem.dispose();
    return rt.texture;
  }

  /** Vertical gradient equirect texture — sky + cheap IBL in one. */
  function gradientSky(stops) {
    const [c, x] = makeCanvas(8, 512);
    const g = x.createLinearGradient(0, 0, 0, 512);
    stops.forEach(([p, col]) => g.addColorStop(p, col));
    x.fillStyle = g; x.fillRect(0, 0, 8, 512);
    const t = texFromCanvas(c);
    t.mapping = T().EquirectangularReflectionMapping;
    return t;
  }

  /**
   * A damped chase camera. You give it somewhere to aim for and it eases there,
   * so a shot can be re-aimed from inside a loop without the camera cutting.
   * `rate` is 1/seconds — higher follows more tightly.
   */
  function chase(st, o) {
    const THREE = T();
    o = o || {};
    const pos = st.rig.position.clone();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(st.rig.quaternion);
    const aim = pos.clone().addScaledVector(fwd, o.dist ?? 10);
    const want = { pos: pos.clone(), aim: aim.clone(), rate: o.rate ?? 4 };
    const fn = dt => {
      const k = 1 - Math.exp(-want.rate * dt);   // frame-rate independent
      pos.lerp(want.pos, k);
      aim.lerp(want.aim, k);
      st.look([pos.x, pos.y, pos.z], [aim.x, aim.y, aim.z]);
      return true;
    };
    st.add(fn);
    return {
      to(p, a, rate) {
        want.pos.set(p[0], p[1], p[2]);
        want.aim.set(a[0], a[1], a[2]);
        if (rate != null) want.rate = rate;
      },
      rate(r) { want.rate = r; },
      snap(p, a) { pos.set(p[0], p[1], p[2]); aim.set(a[0], a[1], a[2]); this.to(p, a); },
      stop() { st.remove(fn); }
    };
  }

  /* ---------- textures ---------- */
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
  }
  function fitFont(x, text, maxW, start, family, weight) {
    let size = start;
    do {
      x.font = `${weight || 'bold'} ${size}px ${family}`;
      if (x.measureText(text).width <= maxW) break;
      size -= 2;
    } while (size > 8);
    return size;
  }
  function texFromCanvas(c) {
    const THREE = T();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }

  /** Generic name plate texture. Returns {texture, canvas, draw(text)} so it can be re-drawn live. */
  function nameTexture(text, o) {
    o = o || {};
    const w = o.w || 640, h = o.h || 320;
    const [c, x] = makeCanvas(w, h);
    const family = o.font || "Impact, 'Arial Black', sans-serif";
    function draw(str) {
      x.clearRect(0, 0, w, h);
      if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, w, h); }
      if (o.bgGrad) {
        const g = x.createLinearGradient(0, 0, 0, h);
        o.bgGrad.forEach((col, i) => g.addColorStop(i / (o.bgGrad.length - 1), col));
        x.fillStyle = g; x.fillRect(0, 0, w, h);
      }
      if (o.noiseAmt) {
        for (let i = 0; i < o.noiseAmt; i++) {
          x.fillStyle = `rgba(0,0,0,${Math.random() * .12})`;
          x.fillRect(Math.random() * w, Math.random() * h, Math.random() * 24, Math.random() * 3);
        }
      }
      if (o.border) {
        x.strokeStyle = o.border; x.lineWidth = o.borderWidth || 12;
        const r = o.radius || 0, bw = x.lineWidth;
        x.beginPath();
        if (x.roundRect) x.roundRect(bw / 2 + (o.inset || 0), bw / 2 + (o.inset || 0), w - bw - 2 * (o.inset || 0), h - bw - 2 * (o.inset || 0), r);
        else x.rect(bw / 2, bw / 2, w - bw, h - bw);
        x.stroke();
      }
      const s = String(str == null ? '' : str).toUpperCase();
      const size = fitFont(x, s, w * (o.fill || 0.82), o.size || h * 0.55, family, o.weight);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `${o.weight || 'bold'} ${size}px ${family}`;
      if (o.letterSpacing && 'letterSpacing' in x) x.letterSpacing = o.letterSpacing;
      const cy = h / 2 + (o.dy || 0);
      if (o.shadow) { x.shadowColor = o.shadow; x.shadowBlur = o.shadowBlur || 18; }
      x.fillStyle = o.fg || '#111';
      x.fillText(s, w / 2, cy);
      x.shadowBlur = 0;
      if (o.stroke) { x.strokeStyle = o.stroke; x.lineWidth = o.strokeWidth || 4; x.strokeText(s, w / 2, cy); }
      if (o.after) o.after(x, w, h, s);
    }
    draw(text);
    const texture = texFromCanvas(c);
    return { texture, canvas: c, ctx: x, draw(str) { draw(str); texture.needsUpdate = true; } };
  }

  /** Soft round sprite used for glow / smoke / sparks. */
  let sparkTex = null;
  function spark(colorInner = 'rgba(255,255,255,1)', colorOuter = 'rgba(255,255,255,0)') {
    const [c, x] = makeCanvas(128, 128);
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, colorInner); g.addColorStop(0.35, colorInner.replace(/[\d.]+\)$/, '0.55)')); g.addColorStop(1, colorOuter);
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return texFromCanvas(c);
  }
  function softSprite() { if (!sparkTex) sparkTex = spark(); return sparkTex; }

  /* ---------- particles ---------- */
  /**
   * Chunky 3D debris burst using an InstancedMesh — good for crashes,
   * eruptions, explosions, splatter. Auto-updates and self-removes.
   */
  function burst(st, o) {
    const THREE = T();
    o = o || {};
    const n = o.count || 60;
    const geo = o.geometry || new THREE.TetrahedronGeometry(o.size || 0.16);
    const mat = o.material || new THREE.MeshStandardMaterial({ color: o.color ?? 0xffffff, roughness: .7, metalness: o.metalness ?? .1, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1 });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.castShadow = !!o.shadows;
    mesh.frustumCulled = false;
    st.scene.add(mesh);
    const org = o.origin || new THREE.Vector3();
    const P = [], V = [], R = [], W = [], S = [];
    const dir = o.dir || null, spread = o.spread ?? 1;
    for (let i = 0; i < n; i++) {
      P.push(new THREE.Vector3(org.x + rnd(-1, 1) * (o.jitter || 0), org.y + rnd(-1, 1) * (o.jitter || 0), org.z + rnd(-1, 1) * (o.jitter || 0)));
      let v;
      if (dir) {
        v = dir.clone().normalize().multiplyScalar(o.speed ?? 6)
          .add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar((o.speed ?? 6) * spread * 0.5));
      } else {
        v = new THREE.Vector3(rnd(-1, 1), rnd(-.2, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(0.4, 1) * (o.speed ?? 6));
      }
      V.push(v);
      R.push(new THREE.Euler(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)));
      W.push(new THREE.Vector3(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9)));
      S.push(rnd(o.scaleMin ?? .5, o.scaleMax ?? 1.5));
    }
    const dummy = new THREE.Object3D();
    const life = o.life ?? 2.2, g = o.gravity ?? -14, floor = o.floor;
    let age = 0;
    st.add(dt => {
      age += dt;
      const k = Math.min(1, age / life);
      for (let i = 0; i < n; i++) {
        V[i].y += g * dt;
        if (o.drag) V[i].multiplyScalar(1 - o.drag * dt);
        P[i].addScaledVector(V[i], dt);
        if (floor != null && P[i].y < floor) { P[i].y = floor; V[i].y *= -(o.bounce ?? 0.35); V[i].x *= .7; V[i].z *= .7; }
        R[i].x += W[i].x * dt; R[i].y += W[i].y * dt; R[i].z += W[i].z * dt;
        dummy.position.copy(P[i]);
        dummy.rotation.copy(R[i]);
        const sc = S[i] * (o.shrink === false ? 1 : (1 - k * k));
        dummy.scale.setScalar(Math.max(0.0001, sc));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (age >= life) {
        st.scene.remove(mesh);
        geo.dispose(); mat.dispose();
        return false;
      }
    });
    return mesh;
  }

  /** Additive glow sprites — smoke, fire, magic, bubbles. */
  function puffs(st, o) {
    const THREE = T();
    o = o || {};
    const n = o.count || 30;
    const tex = o.texture || softSprite();
    const mat = new THREE.SpriteMaterial({
      map: tex, color: o.color ?? 0xffffff, transparent: true,
      opacity: o.opacity ?? .8, depthWrite: false,
      blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending
    });
    // Every sprite in a burst is the same age, so they can share one material.
    // Only a staggered burst needs per-sprite opacity, and therefore clones.
    const shared = !o.stagger;
    const group = new THREE.Group();
    st.scene.add(group);
    const items = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(shared ? mat : mat.clone());
      const org = o.origin || new THREE.Vector3();
      s.position.set(org.x + rnd(-1, 1) * (o.jitter ?? .2), org.y + rnd(-1, 1) * (o.jitter ?? .2), org.z + rnd(-1, 1) * (o.jitter ?? .2));
      const base = o.dir ? o.dir.clone().normalize().multiplyScalar(o.speed ?? 2) : new THREE.Vector3();
      const v = base.add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar((o.speed ?? 2) * (o.spread ?? .5)));
      s.scale.setScalar(rnd(o.sizeMin ?? .5, o.sizeMax ?? 1.6));
      group.add(s);
      items.push({ s, v, grow: rnd(o.growMin ?? .4, o.growMax ?? 1.6), delay: Math.random() * (o.stagger || 0) });
    }
    const life = o.life ?? 1.8;
    let age = 0;
    const fade = k => (o.opacity ?? .8) * (1 - k) * (k < .1 ? k / .1 : 1);
    st.add(dt => {
      age += dt;
      if (shared) mat.opacity = fade(Math.min(1, age / life));
      items.forEach(it => {
        if (age < it.delay) { it.s.material.opacity = 0; return; }
        const k = Math.min(1, (age - it.delay) / life);
        it.v.y += (o.gravity ?? 1.4) * dt;
        it.v.multiplyScalar(1 - (o.drag ?? 1.2) * dt);
        it.s.position.addScaledVector(it.v, dt);
        it.s.scale.addScalar(it.grow * dt);
        if (!shared) it.s.material.opacity = fade(k);
      });
      if (age >= life + (o.stagger || 0)) {
        if (shared) mat.dispose(); else group.traverse(c => c.material && c.material.dispose());
        st.scene.remove(group);
        return false;
      }
    });
    return group;
  }

  /* ---------- little builders ---------- */
  function box(w, h, d, color, opts) {
    const THREE = T();
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .55, metalness: .1 }, opts || {}))
    );
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function cyl(rt, rb, h, color, seg, opts) {
    const THREE = T();
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(rt, rb, h, seg || 24),
      new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .55, metalness: .1 }, opts || {}))
    );
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function ball(r, color, seg, opts) {
    const THREE = T();
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(r, seg || 24, (seg || 24) / 2),
      new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .5, metalness: .05 }, opts || {}))
    );
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  return {
    stage, chase, tween, ease, wait, rnd, pickOne, nameTexture, spark, softSprite, env, gradientSky,
    burst, puffs, box, cyl, ball, clearTweens, texFromCanvas, makeCanvas, reduceMotion
  };
})();
