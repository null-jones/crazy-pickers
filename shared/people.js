/* ============================================================
   Little low-poly people. Built once for the crash-site crowd,
   shared so the zombies can use the same rig.

   p = People.make({ x, z, facing })       -> adds p.g to nothing; you add it
   People.animate(p, t, dt)                -> poses limbs for p.mode
   modes: idle | startle | run | shamble | bitten | cheer
   ============================================================ */
window.People = (function () {
  const T = () => window.THREE;
  const SKIN = [0xf0c8a0, 0xd9a273, 0xa9714b, 0x7a4a2c, 0x5a3620, 0xffd9b8];
  const CLOTH = [0xff5a5f, 0x2ec4b6, 0xffd166, 0x8f7bff, 0xef476f, 0x06d6a0, 0xf78c6b, 0x4cc9f0, 0xe0e0e6, 0x333a56];
  const HAIR = [0x2a1b12, 0x120c0a, 0x6b4423, 0xc9a227, 0x8e2f3f];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pickOne = a => a[Math.floor(Math.random() * a.length)];

  function make(o) {
    const THREE = T();
    o = o || {};
    const g = new THREE.Group();
    g.position.set(o.x || 0, o.y ?? .3, o.z || 0);
    g.rotation.y = o.facing || 0;
    const shirt = o.shirt ?? pickOne(CLOTH), legs = o.legs ?? pickOne(CLOTH), skin = o.skin ?? pickOne(SKIN);
    g.scale.setScalar(o.scale ?? rnd(.88, 1.12));

    const hips = new THREE.Group();
    g.add(hips);
    const torso = Kit.cyl(.21, .26, .62, shirt, 10, { roughness: .85 });
    torso.position.y = 1.02;
    hips.add(torso);
    const head = Kit.ball(.17, skin, 12, { roughness: .8 });
    head.position.y = 1.48;
    hips.add(head);
    const hair = Kit.ball(.175, o.hair ?? pickOne(HAIR), 12, { roughness: .95 });
    hair.scale.set(1, .62, 1);
    hair.position.y = 1.56;
    hips.add(hair);
    const eyes = [];
    [-1, 1].forEach(sx => {
      const e = Kit.ball(.028, 0x14141c, 6, { roughness: .3 });
      e.position.set(sx * .06, 1.5, .155);
      e.castShadow = false;
      hips.add(e); eyes.push(e);
    });

    const arms = [], hands = [];
    [-1, 1].forEach(sx => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * .26, 1.28, 0);
      hips.add(pivot);
      const arm = Kit.cyl(.065, .06, .58, shirt, 8, { roughness: .85 });
      arm.position.y = -.29;
      pivot.add(arm);
      const hand = Kit.ball(.075, skin, 8, { roughness: .8 });
      hand.position.y = -.6;
      pivot.add(hand);
      arms.push(pivot); hands.push(hand);
      pivot.userData.arm = arm;
    });

    const legPivots = [], legMeshes = [];
    [-1, 1].forEach(sx => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * .12, .72, 0);
      hips.add(pivot);
      const leg = Kit.cyl(.085, .08, .72, legs, 8, { roughness: .85 });
      leg.position.y = -.36;
      pivot.add(leg);
      const shoe = Kit.box(.16, .1, .28, 0x1c1626, { roughness: .8 });
      shoe.position.set(0, -.72, .05);
      pivot.add(shoe);
      legPivots.push(pivot); legMeshes.push(leg);
    });

    // only the big parts cast shadows — halves the shadow-pass draw calls
    g.traverse(m => { if (m.isMesh) m.castShadow = false; });
    [torso, head, ...legMeshes].forEach(m => { m.castShadow = true; });

    return {
      g, hips, head, torso, arms, legPivots, eyes,
      mats: { skin: [head, ...hands].map(m => m.material), shirt: [torso, ...arms.map(a => a.userData.arm)].map(m => m.material), legs: legMeshes.map(m => m.material) },
      mode: 'idle', startle: 0, phase: Math.random() * 6.28, facing: o.facing || 0,
      home: g.position.clone(), speed: 1, name: o.name
    };
  }

  function animate(p, t, dt) {
    const tt = t + p.phase;
    const A = p.arms, L = p.legPivots, H = p.hips;
    switch (p.mode) {
      case 'run': {
        const s = Math.sin(tt * 16 * p.speed);
        L[0].rotation.x = s * .9; L[1].rotation.x = -s * .9;
        A[0].rotation.x = -s * 1.1; A[1].rotation.x = s * 1.1;
        A[0].rotation.z = A[1].rotation.z = 0;
        H.position.y = Math.abs(s) * .09;
        H.rotation.x = .18; H.rotation.z = 0;
        break;
      }
      case 'shamble': {
        // stiff, lurching, arms out front
        const s = Math.sin(tt * 4.2 * p.speed);
        L[0].rotation.x = s * .45 - .1; L[1].rotation.x = -s * .45 - .1;
        A[0].rotation.x = -1.35 + Math.sin(tt * 2.1) * .12;
        A[1].rotation.x = -1.25 + Math.cos(tt * 1.7) * .12;
        A[0].rotation.z = .12; A[1].rotation.z = -.12;
        H.position.y = Math.abs(s) * .03;
        H.rotation.x = .32;
        H.rotation.z = Math.sin(tt * 2.1) * .14;
        p.head.rotation.z = .45;
        break;
      }
      case 'startle': {
        p.startle = Math.max(0, p.startle - dt * 1.6);
        const k = p.startle;
        A.forEach(a => { a.rotation.x = -2.4 * k; a.rotation.z = 0; });
        H.position.y = Math.sin((1 - k) * Math.PI) * .22;
        H.rotation.x = -.3 * k;
        p.g.rotation.y = p.facing + Math.sin(t * 18) * .12 * k;
        if (k <= 0) p.mode = 'idle';
        break;
      }
      case 'bitten': {
        // flailing, then the caller zombifies
        A[0].rotation.x = -2.2 + Math.sin(tt * 30) * .5;
        A[1].rotation.x = -2.2 + Math.cos(tt * 27) * .5;
        A[0].rotation.z = -.6; A[1].rotation.z = .6;
        H.position.y = Math.abs(Math.sin(tt * 22)) * .14;
        H.rotation.z = Math.sin(tt * 26) * .18;
        L[0].rotation.x = Math.sin(tt * 20) * .4; L[1].rotation.x = -Math.sin(tt * 20) * .4;
        break;
      }
      case 'cheer': {
        A[0].rotation.x = -2.6 + Math.sin(tt * 9) * .3;
        A[1].rotation.x = -2.6 + Math.cos(tt * 9) * .3;
        A[0].rotation.z = -.3; A[1].rotation.z = .3;
        H.position.y = Math.abs(Math.sin(tt * 9)) * .16;
        H.rotation.x = -.08;
        break;
      }
      default: {
        // idle: shift weight, glance about
        H.position.y = Math.sin(tt * 1.6) * .012;
        H.rotation.z = Math.sin(tt * .9) * .03;
        H.rotation.x = 0;
        A[0].rotation.x = Math.sin(tt * 1.1) * .1;
        A[1].rotation.x = -Math.sin(tt * 1.1 + .6) * .1;
        A[0].rotation.z = A[1].rotation.z = 0;
        L[0].rotation.x = L[1].rotation.x = 0;
        p.g.rotation.y = p.facing + Math.sin(tt * .4) * .18;
      }
    }
  }

  function zombify(p) {
    p.mats.skin.forEach(m => m.color.set(0x8fbf6a));
    p.mats.shirt.forEach(m => m.color.multiplyScalar(.45));
    p.mats.legs.forEach(m => m.color.multiplyScalar(.5));
    p.eyes.forEach(e => { e.material.color.set(0xff2a2a); e.material.emissive.set(0xff1a1a); e.material.emissiveIntensity = 2.2; e.scale.setScalar(1.35); });
    p.mode = 'shamble';
    p.speed = rnd(.8, 1.2);
  }

  function reset(p) {
    p.mode = 'idle'; p.startle = 0;
    p.g.position.copy(p.home);
    p.g.rotation.y = p.facing;
    p.hips.position.y = 0; p.hips.rotation.set(0, 0, 0);
    p.head.rotation.set(0, 0, 0);
    p.arms.forEach(a => a.rotation.set(0, 0, 0));
    p.legPivots.forEach(l => l.rotation.set(0, 0, 0));
  }

  return { make, animate, zombify, reset, SKIN, CLOTH, HAIR };
})();
