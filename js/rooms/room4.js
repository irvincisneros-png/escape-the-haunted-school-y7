// Room 4 extras: the Ballroom. See ROOMS.md.
// Puzzle (Year 7 Classification, 3.1): the sheet music in the music room shows 5 creatures and a
// dichotomous key. Classify each creature (mammal, bird, insect, fish...), look up the note for its group,
// then play the 5 notes in order on the glowing floor keys. The music box on the pedestal springs open with the arcade's power crank,
// which is fitted into the socket on the side of the arcade machine.

const NOTES = [
  { n: 'C', f: 261.63, c: '#ff4d5e' }, { n: 'D', f: 293.66, c: '#ff8f2a' }, { n: 'E', f: 329.63, c: '#ffd84a' },
  { n: 'F', f: 349.23, c: '#7dff6a' }, { n: 'G', f: 392.0, c: '#3fe0d0' }, { n: 'A', f: 440.0, c: '#5aa0ff' },
  { n: 'B', f: 493.88, c: '#b57aff' },
];
const TUNE = [2, 4, 5, 4, 1];   // E G A G D  = Bat (mammal), Owl (bird), Butterfly (insect), Duck (bird), Shark (fish)
const DECOY = [0, 2, 4, 2, 0];  // the gramophone plays a different waltz so it does not give the answer away

// ---- tiny WebAudio helper (pitched notes; the shared sfx() has none) ----
let ac = null;
function audio() {
  try {
    if (localStorage.getItem('haunted-muted') === '1') return null;
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  } catch (e) { return null; }
}
function tone(f, dur = 0.5, delay = 0, type = 'triangle', vol = 0.13, f2 = 0) {
  const a = audio(); if (!a) return;
  try {
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.linearRampToValueAtTime(f2, t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
  } catch (e) {}
}
const playTune = (gap = 0.55, type = 'triangle', vol = 0.12, seq = TUNE) => seq.forEach((n, i) => tone(NOTES[n].f, 0.7, i * gap, type, vol));

export default {
  side: { side: -1, lz: 1.8, w: 2.0 },
  powerHint: 'The arcade has no power. Its crank is missing. Maybe something in this ballroom has it.',
  build(ctx) {
    const { THREE, box, cyl, sph, plane, mat, tmat, basic, canvasTex, state } = ctx;
    const Z = ctx.rz, grp = ctx.group(), room = ctx.room, PI = Math.PI;
    const found = id => state.isFound(id);
    const ease = p => p * p * (3 - 2 * p);

    // ---- shared materials ----
    const wood = mat('#3a2415'), wood2 = mat('#5a3a20'), dark = mat('#17141c', { roughness: 0.4 });
    const brass = mat('#c9a24a', { metalness: 0.6, roughness: 0.35, emissive: '#3a2a05' });
    const stone = mat('#6a6478');
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.5, depthWrite: false });
    const black = basic(0x101018);

    // ---- tiny helpers: animated "movers" (lids, drawers, doors) and a timer list ----
    const movers = [], timers = [];
    const mover = (apply, open) => { const m = { p: open ? 1 : 0, to: open ? 1 : 0, apply }; apply(ease(m.p)); movers.push(m); return m; };
    const later = (s, fn) => timers.push({ s, fn });
    const pivot = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); grp.add(g); return g; };

    // A searchable: once searched it stays open (saved), reveals its candy, shows a line.
    function searchable(o) {
      ctx.interact({
        x: o.x, y: o.y ?? 1.0, z: o.z, r: o.r ?? 1.3, label: o.label, button: 'Search',
        active: () => !found(o.id),
        run: async () => {
          state.markFound(o.id); o.mv.to = 1; ctx.sfx('door');
          if (o.candy) o.candy.reveal();
          if (o.after) o.after();
          if (o.line) ctx.toast(o.line);
        },
      });
      if (found(o.id) && o.candy) o.candy.reveal();
    }

    // =====================================================================
    // SIDE ROOM: the music room (left wall, doorway at local depth 1.8)
    // =====================================================================
    ctx.sideRoom({ depth: 6, lz0: 0.5, lz1: 6.0, wall: ['paper', '#2e2038', '#3c2a4c'], floor: ['wood', '#2e1e12', '#3a2616'], light: 0xffc890 });
    box(-11.5, 0, Z(3.3), 4.2, 0.03, 3.4, tmat('carpet', '#5a1626', '#c9a24a', 2, 2));   // rug

    // Music stand + sheet music (the clue)
    const staffTex = canvasTex(128, 96, (c, w, h) => {
      c.fillStyle = '#efe3c4'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#3a2a1c'; c.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(8, 28 + i * 8); c.lineTo(w - 8, 28 + i * 8); c.stroke(); }
      c.fillStyle = '#3a2a1c';
      [[24, 60], [44, 44], [64, 36], [84, 44], [104, 68]].forEach(([x, y]) => { c.beginPath(); c.ellipse(x, y, 5, 3.6, -0.3, 0, 7); c.fill(); c.fillRect(x + 4, y - 22, 1.5, 22); });
    });
    box(-11.6, 0, Z(2.3), 0.5, 0.04, 0.5, dark);
    cyl(-11.6, 0.04, Z(2.3), 0.035, 1.15, dark, { seg: 6 });
    box(-11.62, 1.12, Z(2.3), 0.05, 0.5, 0.66, dark);
    plane(-11.58, 1.37, Z(2.3), 0.6, 0.45, new THREE.MeshBasicMaterial({ map: staffTex }), PI / 2);
    ctx.candelabra(-12.5, 0, Z(3.6), room, false);
    ctx.light(-12.2, 1.7, Z(2.3), 0xffb060, 6, 7, 0.35);
    ctx.interact({
      x: -11.2, z: Z(2.3), r: 1.4, label: 'Read the sheet music', button: 'Read', run: async () => {
        state.markFound('r4-sheet');
        const GROUPS = [['Amphibian', 0], ['Fish', 1], ['Mammal', 2], ['Reptile', 3], ['Bird', 4], ['Insect', 5], ['Spider', 6]];
        const CREATURES = [['🦇', 'Bat'], ['🦉', 'Owl'], ['🦋', 'Butterfly'], ['🦆', 'Duck'], ['🦈', 'Shark']];
        const chip = n => `<span style="display:inline-block;min-width:1.5em;text-align:center;border-radius:50%;padding:2px 6px;font-weight:800;color:#2a1a10;background:${NOTES[n].c}">${NOTES[n].n}</span>`;
        const creatures = '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:8px 0">' + CREATURES.map(([e, n], i) => `<div style="text-align:center;background:#efe3c4;color:#2a1a10;border-radius:8px;padding:6px 10px"><div style="font-size:12px;font-weight:800">${i + 1}</div><div style="font-size:30px">${e}</div><div style="font-size:13px;font-weight:700">${n}</div></div>`).join('') + '</div>';
        const key = '<div class="card"><b>Dichotomous key</b> (answer each question YES or NO)<br>'
          + '<b>1.</b> Has a backbone? YES go to 2. NO go to 5.<br>'
          + '<b>2.</b> Has feathers? YES it is a <b>Bird</b>. NO go to 3.<br>'
          + '<b>3.</b> Has fur or hair, and feeds its babies milk? YES it is a <b>Mammal</b>. NO go to 4.<br>'
          + '<b>4.</b> Has gills and fins, and lives in water? YES it is a <b>Fish</b>. NO: dry scaly skin is a <b>Reptile</b>; moist smooth skin is an <b>Amphibian</b>.<br>'
          + '<b>5.</b> Six legs and three body parts? YES it is an <b>Insect</b>. NO (eight legs) it is a <b>Spider</b>.</div>';
        const chart = '<p><b>Note for each group:</b></p><p style="line-height:2">' + GROUPS.map(([g, n]) => g + ' ' + chip(n)).join(' &nbsp; ') + '</p>';
        await ctx.note({
          kicker: 'Music room', title: 'The Ballroom Waltz',
          html: '<p class="clue">“First line of the waltz. Use the key to find which group each creature belongs to. Each group has its own note. Play one note for each creature, in creature order 1 to 5, on the glowing floor keys in the ballroom. One wrong step and you must begin again!”</p>' + creatures + key + chart + '<p style="opacity:.8">The old gramophone in this room plays a different waltz, so do not copy it!</p>',
          button: 'Got it',
        });
        ctx.toast('Now find the glowing floor keys in the ballroom.');
      },
    });

    // Gramophone: starts crackling when you first walk in (spooky), and plays the tune when wound.
    const gx = -9.8, gz = Z(1.1);
    box(gx, 0, gz, 0.7, 0.75, 0.7, wood2, { solid: true });
    const record = cyl(gx, 0.75, gz, 0.27, 0.04, black, { seg: 12 });
    cyl(gx + 0.28, 0.79, gz, 0.04, 0.45, brass, { seg: 6 });
    cyl(gx + 0.28, 1.2, gz, 0.22, 0.1, brass, { seg: 10 });
    let gramT = 0;
    const gramPlay = () => { gramT = DECOY.length * 0.8 + 1; playTune(0.8, 'sine', 0.1, DECOY); };
    ctx.interact({ x: gx + 0.9, z: gz, r: 1.1, label: 'Wind the gramophone', button: 'Wind', run: async () => { gramPlay(); ctx.toast('It crackles, then hums an old waltz. (It is not the tune on the sheet music.)'); } });

    // Wardrobe (doors swing). Empty, funny, drops a hint.
    box(-14.1, 0, Z(4.2), 0.8, 2.4, 1.7, wood, { solid: true });
    plane(-13.69, 1.2, Z(4.2), 1.6, 2.2, black, PI / 2);
    box(-14.0, 0.5, Z(4.0), 0.1, 1.5, 0.5, mat('#7a1a2a'));   // a cape
    cyl(-14.0, 1.9, Z(4.6), 0.2, 0.15, black, { seg: 8 });    // a top hat
    const wdL = pivot(-13.69, 0.1, Z(3.4)), wdR = pivot(-13.69, 0.1, Z(5.0));
    box(0.02, 0, -0.4, 0.04, 2.2, 0.78, wood2, { g: wdL }); box(0.02, 0, 0.4, 0.04, 2.2, 0.78, wood2, { g: wdR });
    sph(0.08, 1.1, -0.7, 0.05, 0.05, 0.05, brass, { g: wdL }); sph(0.08, 1.1, 0.7, 0.05, 0.05, 0.05, brass, { g: wdR });
    const wdMv = mover(p => { wdL.rotation.y = -1.9 * p; wdR.rotation.y = 1.9 * p; }, found('r4-wardrobe'));
    searchable({ id: 'r4-wardrobe', mv: wdMv, x: -13.0, z: Z(4.2), label: 'Open the wardrobe', line: 'Capes, boas and a moth in a tiny tuxedo. The moth whispers: “The lady in the painting loves science questions.”' });

    // Cello case (lid lifts), candy inside
    const cx = -11.0;
    box(cx, 0, Z(5.55), 1.7, 0.3, 0.55, dark, { solid: true });
    const celloLid = pivot(cx, 0.3, Z(5.85));
    box(0, 0, 0.275, 1.7, 0.07, 0.55, mat('#4a2e1c'), { g: celloLid });
    const celloMv = mover(p => { celloLid.rotation.x = -1.9 * p; }, found('r4-cello'));
    const candy4 = ctx.candy(cx, 0.85, Z(5.5), 'r4-candy4', { hidden: true });
    searchable({ id: 'r4-cello', mv: celloMv, x: cx, z: Z(5.0), label: 'Open the cello case', candy: candy4, line: 'No cello, just a sleepy bat in a bow tie. It left you a sweet.' });

    // Painting that quizzes you; a right answer swings it open to reveal the science card.
    const lady = canvasTex(128, 180, (c, w, h) => {
      c.fillStyle = '#241a34'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#4a2a5a'; c.beginPath(); c.ellipse(64, 180, 56, 60, 0, 0, 7); c.fill();
      c.fillStyle = '#e8e0cc'; c.beginPath(); c.ellipse(64, 78, 38, 15, 0, 0, 7); c.fill();   // powdered wig
      c.fillRect(30, 70, 68, 30);
      c.fillStyle = '#d8d0bc'; c.beginPath(); c.ellipse(64, 92, 26, 32, 0, 0, 7); c.fill();
      c.fillStyle = '#ffe9a8'; for (const ex of [53, 75]) { c.beginPath(); c.ellipse(ex, 88, 5, 7, 0, 0, 7); c.fill(); }
      c.fillStyle = '#7a1a2a'; c.beginPath(); c.ellipse(64, 112, 8, 3, 0, 0, 7); c.fill();
    });
    const px = -14.41, pz = Z(1.25);
    plane(-14.49, 2.1, Z(1.9), 1.4, 1.8, black, PI / 2);   // dark niche behind the painting
    const pp = pivot(px, 1.2, pz);
    box(0.02, 0, -0.65, 0.08, 1.8, 1.3, mat('#6a4a1c', { metalness: 0.4, roughness: 0.5 }), { g: pp });
    plane(0.07, 0.9, -0.65, 1.1, 1.55, new THREE.MeshBasicMaterial({ map: lady }), PI / 2, { g: pp });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.3 });
    for (const ez of [-0.74, -0.56]) { const e = plane(0.075, 1.0, ez, 0.07, 0.1, eyeMat, PI / 2, { g: pp }); e.position.y = 1.0; }
    const ppMv = mover(p => { pp.rotation.y = -1.85 * p; }, found('r4-painting-open'));
    const card = ctx.dataCard(-14.1, 2.1, Z(1.9), {
      title: 'Science card: Sorting living things', hidden: !found('r4-painting-open'),
      html: '<p><b>Scientists sort (classify) living things into groups so they can study millions of species.</b></p><p>The groups get smaller and smaller: <b>kingdom, phylum, class, order, family, genus, species</b>. (A handy memory trick: King Philip Came Over For Good Soup.)</p><p>A bat has wings, but it has fur and feeds its babies milk, so it is a <b>mammal</b>, not a bird. <i>(3.1.3 Classification)</i></p>',
    });
    ctx.interact({
      x: -13.4, z: Z(1.9), r: 1.5, label: 'Talk to the painted lady', button: 'Talk',
      active: () => !found('r4-painting-open'),
      run: async () => {
        tone(300, 0.8, 0, 'sine', 0.08, 220);
        const ok = await ctx.ask('The painted lady narrows her glowing eyes: “Answer me this, darling…”');
        if (ok) {
          state.markFound('r4-painting-open'); ppMv.to = 1; ctx.sfx('unlock'); card.reveal();
          ctx.toast('“Delightful!” The painting swings open. A science card is hidden behind it.');
        } else ctx.toast('“Wrong, darling!” she hisses. “Ask me again when you have thought about it.”');
      },
    });

    // =====================================================================
    // MAIN HALL
    // =====================================================================

    // ---- floor keys (the puzzle) ----
    const TX = 2.9, solved0 = found('r4-tune');
    let solved = solved0, prog = solved0 ? TUNE.length : 0, freeze = 0, glare = 0;
    const lampOn = new THREE.Color('#7dff6a'), lampOff = new THREE.Color('#2a2438'), lampBad = new THREE.Color('#ff3a4a');
    const lamps = TUNE.map((_, k) => {
      const m = new THREE.MeshBasicMaterial({ color: lampOff });
      sph(TX - 0.7 + k * 0.35, 1.95, Z(0.46), 0.09, 0.09, 0.09, m);
      return m;
    });
    box(TX, 1.65, Z(0.36), 1.9, 0.75, 0.08, mat('#241a30'));
    plane(TX, 2.2, Z(0.41), 1.7, 0.3, new THREE.MeshBasicMaterial({ map: canvasTex(256, 44, (c, w, h) => { c.fillStyle = '#ffd24a'; c.font = 'bold 30px Nunito, sans-serif'; c.textAlign = 'center'; c.fillText('♪ THE WALTZ ♪', w / 2, 33); }), transparent: true }), PI);
    const setLamps = () => lamps.forEach((m, k) => m.color.copy(k < prog ? lampOn : lampOff));
    setLamps();

    const tiles = NOTES.map((nt, i) => {
      const lz = 0.9 + i * 0.65, z = Z(lz);
      const m = new THREE.MeshStandardMaterial({ color: nt.c, emissive: nt.c, emissiveIntensity: 0.18, roughness: 0.5 });
      const body = box(TX, 0, z, 0.56, 0.05, 0.56, m);
      const tex = canvasTex(64, 64, (c, w, h) => { c.fillStyle = 'rgba(20,10,30,.7)'; c.font = 'bold 44px Nunito, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(nt.n, w / 2, h / 2 + 3); });
      plane(TX, 0.056, z, 0.56, 0.56, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), 0, { rx: -PI / 2 });
      const tl = { m, body, glow: 0 };
      ctx.interact({ x: TX, z, y: 0.3, r: 0.5, label: 'Play note ' + nt.n, button: 'Play', run: async () => press(i) });
      return tl;
    });

    function press(i) {
      const nt = NOTES[i]; tone(nt.f, 0.9, 0, 'triangle', 0.16); tone(nt.f * 2, 0.5, 0, 'sine', 0.04);
      tiles[i].glow = 1;
      if (solved) return;
      if (i === TUNE[prog]) {
        prog++; setLamps(); ctx.sfx('tick');
        if (prog >= TUNE.length) solve();
      } else {
        const need = prog + 1;
        prog = i === TUNE[0] ? 1 : 0; setLamps(); ctx.sfx('wrong'); ctx.shake(0.12);
        lamps.forEach(m => m.color.copy(lampBad)); later(0.35, setLamps);
        freeze = 1.4; glare = 1.4;
        ctx.toast('Wrong step! The ghosts stop dancing and glare at you. Check creature number ' + need + ' on the sheet music, then start again.');
      }
    }

    // ---- music box on a pedestal ----
    const bx = 4.0, bz = Z(1.0);
    box(bx, 0, bz, 0.5, 0.85, 0.5, stone, { solid: true });
    box(bx, 0.85, bz, 0.5, 0.05, 0.5, brass);
    box(bx, 0.9, bz, 0.46, 0.2, 0.34, wood2);
    const lid = pivot(bx, 1.1, Z(0.83));
    box(0, 0, -0.17, 0.46, 0.05, 0.34, wood2, { g: lid });
    box(0, 0.05, -0.17, 0.3, 0.02, 0.2, brass, { g: lid });
    const dancer = new THREE.Group(); dancer.position.set(bx, 1.0, bz); grp.add(dancer);
    cyl(0, 0, 0, 0.04, 0.1, brass, { g: dancer, seg: 6 }); sph(0, 0.14, 0, 0.035, 0.035, 0.035, brass, { g: dancer });
    const boxMv = mover(p => { lid.rotation.x = 1.9 * p; }, solved0);
    function makeCrank() {
      const g = new THREE.Group();
      box(0, -0.025, -0.14, 0.05, 0.05, 0.28, brass, { g }); box(0, -0.025, -0.28, 0.05, 0.22, 0.05, brass, { g });
      sph(0, 0.19, -0.28, 0.06, 0.06, 0.06, mat('#e0384a'), { g });
      grp.add(g); return g;
    }
    const crankItem = makeCrank();
    crankItem.scale.setScalar(1.1); crankItem.position.set(bx, 1.25, bz + 0.1);
    crankItem.visible = solved0 && !found('r4-crank-taken');
    ctx.light(bx, 1.7, bz, 0xffd070, 3, 4, 0.2);
    ctx.interact({
      x: bx, z: bz, r: 1.3, label: 'Inspect the music box', button: 'Look', active: () => !solved,
      run: async () => { ctx.sfx('click'); ctx.toast('A locked music box. A tiny plaque: “Play my tune on the dance floor keys.” Find the sheet music!'); },
    });
    ctx.interact({
      x: bx, z: bz, r: 1.3, label: 'Take the power crank', button: 'Take',
      active: () => solved && !found('r4-crank-taken'),
      run: async () => {
        state.markFound('r4-crank-taken'); state.addItem({ id: 'r4-crank', name: 'Arcade power crank', emoji: '🔧' });
        crankItem.visible = false; ctx.sfx('key');
        ctx.toast('Power crank collected! Fit it into the socket on the side of the arcade machine.');
      },
    });
    function solve() {
      solved = true; state.markFound('r4-tune'); freeze = 0;
      lamps.forEach(m => m.color.copy(lampOn));
      later(0.9, () => playTune(0.22, 'triangle', 0.14));
      later(2.3, () => {
        boxMv.to = 1; crankItem.visible = !found('r4-crank-taken'); ctx.sfx('unlock'); ctx.shake(0.15);
        tone(523.25, 0.5, 0, 'triangle', 0.12); tone(659.25, 0.6, 0.12, 'triangle', 0.12); tone(783.99, 0.9, 0.24, 'triangle', 0.12);
        ctx.toast('Bravo! The music box springs open. There is a power crank inside.');
      });
    }

    // ---- arcade crank socket (side of the cabinet) ----
    const sockX = -7.3, sockZ = Z(4.56);
    box(sockX, 0.6, sockZ, 0.24, 0.24, 0.1, black);
    const sockLed = new THREE.MeshBasicMaterial({ color: state.hasPower(4) ? 0x7dff6a : 0xe0384a });
    sph(sockX, 0.86, sockZ + 0.0, 0.04, 0.04, 0.04, sockLed);
    const sockCrank = makeCrank();
    sockCrank.position.set(sockX, 0.72, sockZ); sockCrank.scale.setScalar(0.9);
    sockCrank.visible = state.hasPower(4);
    ctx.interact({
      x: sockX, z: Z(4.95), y: 0.9, r: 1.15, label: 'Fit the power crank', button: 'Fit',
      active: () => state.hasItem('r4-crank') && !state.hasPower(4),
      run: async () => {
        state.useItem('r4-crank'); state.powerArcade(4);
        sockCrank.visible = true; sockLed.color.set(0x7dff6a); ctx.sfx('unlock');
        ctx.toast('The crank clicks in. The arcade machine hums to life!');
      },
    });

    // ---- piano bench (lid lifts, candy inside) ----
    const benchLid = pivot(4.9, 0.5, Z(3.4));
    box(-0.3, 0, 0, 0.6, 0.07, 1.2, mat('#4a2e1c'), { g: benchLid });
    const benchMv = mover(p => { benchLid.rotation.z = -1.8 * p; }, found('r4-bench'));
    const candy1 = ctx.candy(4.6, 1.15, Z(3.4), 'r4-candy1', { hidden: true });
    searchable({ id: 'r4-bench', mv: benchMv, x: 4.3, z: Z(3.4), label: 'Lift the bench lid', candy: candy1, line: 'Sheet music for “Chopsticks”, a metronome… and a sweet.' });
    ctx.candy(6.0, 1.5, Z(3.0), 'r4-candy2');   // on top of the piano (jump from the bench)
    ctx.candy(1.5, 1.0, Z(9.0), 'r4-candy3');   // above the middle pillar of the pit

    // ---- dresser with two drawers + portrait ----
    box(-4.0, 0, Z(0.7), 2.0, 1.0, 0.7, wood, { solid: true });
    box(-4.0, 1.0, Z(0.7), 2.1, 0.05, 0.8, wood2);
    ctx.candle(-3.2, 1.05, Z(0.7), room, true, 0.22);
    ctx.portrait(room, -4.0, 3.1, Z(0.36), PI, 270);
    function drawer(x, id, line, candyObj) {
      const g = pivot(x, 0, Z(1.06)), base = Z(1.06);
      box(0, 0.55, 0, 0.85, 0.3, 0.06, wood2, { g }); box(0, 0.62, -0.05, 0.3, 0.05, 0.05, brass, { g });
      box(0, 0.5, 0.3, 0.8, 0.2, 0.55, dark, { g });
      const mv = mover(p => { g.position.z = base - 0.5 * p; }, found(id));
      searchable({ id, mv, x, z: Z(1.5), r: 0.8, label: 'Open the drawer', candy: candyObj, line });
    }
    const candy5 = ctx.candy(-3.5, 1.05, Z(1.4), 'r4-candy5', { hidden: true });
    drawer(-4.5, 'r4-drawer1', 'Two left dance shoes. Nobody here ever danced well.', null);
    drawer(-3.5, 'r4-drawer2', 'A name tag that says “HELLO, I AM DEAD” and a sweet.', candy5);

    // ---- chest on the right wall: a ghost pops out ----
    const chestLid = pivot(7.75, 0.5, Z(0.95));
    box(-0.45, 0, 0, 0.9, 0.14, 1.0, wood2, { g: chestLid });
    box(7.3, 0, Z(0.95), 0.9, 0.5, 1.0, wood, { solid: true });
    box(6.86, 0.3, Z(0.95), 0.05, 0.15, 0.15, brass);
    const boo = new THREE.Group(); boo.position.set(7.3, 0.5, Z(0.95)); boo.visible = false; grp.add(boo);
    const booMat = new THREE.MeshBasicMaterial({ color: 0xf4f0ff });
    sph(0, 0.35, 0, 0.26, 0.34, 0.26, booMat, { g: boo });
    box(-0.1, 0.45, 0.22, 0.07, 0.1, 0.04, black, { g: boo }); box(0.1, 0.45, 0.22, 0.07, 0.1, 0.04, black, { g: boo }); box(0, 0.28, 0.24, 0.1, 0.12, 0.03, black, { g: boo });
    let booT = -1;
    const chestMv = mover(p => { chestLid.rotation.z = -1.9 * p; }, found('r4-chest'));
    searchable({
      id: 'r4-chest', mv: chestMv, x: 6.5, z: Z(0.95), label: 'Open the chest', after: () => {
        booT = 0; boo.visible = true; ctx.sfx('whoosh'); ctx.shake(0.12);
        tone(200, 0.12, 0, 'square', 0.07, 520); tone(520, 0.2, 0.1, 'square', 0.05, 300);
      }, line: 'BOO! …Sorry. That is Gary the ghost. He lives in the chest. No treasure, just Gary.',
    });

    // ---- haunted mirror (right wall, above the chest) ----
    const mirrorTex = canvasTex(128, 256, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#16303a'); g.addColorStop(1, '#0a1a22');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(190,230,240,.12)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(60, 0); c.lineTo(0, 120); c.fill();
      c.strokeStyle = 'rgba(200,230,240,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(90, 40); c.lineTo(70, 90); c.lineTo(100, 120); c.stroke();
    });
    const faceTex = canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = 'rgba(225,238,255,.9)'; c.beginPath(); c.ellipse(64, 66, 34, 46, 0, 0, 7); c.fill();
      c.fillStyle = '#0a0a14'; for (const ex of [50, 78]) { c.beginPath(); c.ellipse(ex, 56, 8, 12, 0, 0, 7); c.fill(); }
      c.beginPath(); c.ellipse(64, 92, 9, 14, 0, 0, 7); c.fill();
    });
    box(7.93, 0.9, Z(1.3), 0.1, 3.0, 1.7, mat('#6a4a1c', { metalness: 0.4, roughness: 0.5 }));
    const glass = plane(7.87, 2.4, Z(1.3), 1.45, 2.7, new THREE.MeshBasicMaterial({ map: mirrorTex }), -PI / 2);
    const faceMat = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, opacity: 0, depthWrite: false });
    const face = plane(7.86, 2.6, Z(1.3), 0.95, 0.95, faceMat, -PI / 2);
    const mirrorLight = ctx.light(7.0, 2.4, Z(1.3), 0x6ad8e8, 0, 6, 0.3);
    let mBoost = 0;
    ctx.interact({
      x: 6.9, z: Z(1.8), r: 1.2, y: 1.6, label: 'Touch the mirror', button: 'Touch', run: async () => {
        mBoost = 1.6;
        if (!found('r4-mirror')) {
          state.markFound('r4-mirror'); ctx.sfx('scare'); ctx.shake(0.3);
          ctx.toast('A cold hand presses back from the other side of the glass!');
        } else { ctx.sfx('whoosh'); ctx.toast(['“Nice outfit,” whispers the reflection.', 'Your reflection waves a second late.', 'The mirror fogs up: “BOO”.'][Math.floor(Math.random() * 3)]); }
      },
    });

    // ---- buffet table at the far end ----
    box(-4.0, 0, Z(15.1), 2.2, 0.85, 0.7, wood, { solid: true });
    box(-4.0, 0.85, Z(15.1), 2.3, 0.05, 0.8, mat('#6a1a2a'));
    cyl(-4.0, 0.9, Z(15.1), 0.3, 0.22, mat('#4a5a6a', { metalness: 0.5 }), { seg: 10 });
    const punch = cyl(-4.0, 1.08, Z(15.1), 0.25, 0.05, basic(0x7dff6a), { seg: 10 });
    ctx.candle(-4.8, 0.9, Z(15.1), room, false, 0.3); ctx.candle(-3.2, 0.9, Z(15.1), room, false, 0.3);
    ctx.light(-4.0, 1.6, Z(14.7), 0x7dff6a, 3, 5, 0.3);
    const bubbles = [0, 1, 2].map(k => sph(-4.0 + (k - 1) * 0.12, 1.15, Z(15.1), 0.035, 0.035, 0.035, basic(0xc8ffb8)));
    ctx.interact({ x: -4.0, z: Z(14.4), r: 1.3, label: 'Taste the punch', button: 'Sip', run: async () => { ctx.sfx('click'); ctx.toast('Ghost-berry punch! Your tongue glows green for a moment.'); } });

    // ---- waltzing ghost couple floating over the pit ----
    const couple = new THREE.Group(); grp.add(couple);
    const gh = (x, ry) => { const g = new THREE.Group(); g.position.x = x; g.rotation.y = ry; couple.add(g); return g; };
    const man = gh(-0.5, PI / 2), lad = gh(0.5, -PI / 2);
    cyl(0, 0, 0, 0.3, 1.25, ghostMat, { g: man, seg: 8 }); sph(0, 1.5, 0, 0.27, 0.27, 0.27, ghostMat, { g: man });
    cyl(0, 1.7, 0, 0.19, 0.32, black, { g: man, seg: 8 }); cyl(0, 1.7, 0, 0.3, 0.04, black, { g: man, seg: 8 });
    cyl(0, 0, 0, 0.55, 1.0, ghostMat, { g: lad, seg: 10 }); cyl(0, 0.9, 0, 0.3, 0.5, ghostMat, { g: lad, seg: 8 });
    sph(0, 1.55, 0, 0.26, 0.26, 0.26, ghostMat, { g: lad }); sph(0, 1.85, -0.05, 0.14, 0.14, 0.14, ghostMat, { g: lad });
    for (const g of [man, lad]) for (const ex of [-0.09, 0.09]) box(ex, 1.5, 0.24, 0.07, 0.09, 0.04, black, { g });
    box(0, 1.1, 0, 0.7, 0.08, 0.08, ghostMat, { g: couple });
    const danceLight = ctx.light(0, 1.8, Z(9), 0x9ab8ff, 5, 8, 0.2);
    let dAng = 0, dSpin = 0;

    // ---- floating music notes drifting up from the piano ----
    const noteTex = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#ffe9a8'; c.shadowColor = '#ffb347'; c.shadowBlur = 8; c.font = 'bold 48px serif'; c.textAlign = 'center'; c.fillText('♪', w / 2, 48); });
    const noteMat = new THREE.MeshBasicMaterial({ map: noteTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const floaters = [0, 1, 2, 3, 4, 5].map(k => ({ m: plane(6.3, 1.2, Z(3.4), 0.35, 0.35, noteMat), ph: k / 6, ox: 5.7 + (k % 3) * 0.5, oz: 2.5 + (k % 2) * 1.6 }));
    let pianoSpooked = false, gramSpooked = false;

    // ---- per-frame life ----
    const sockSpin = sockCrank;
    ctx.onFrame((t, dt) => {
      const p = ctx.player();
      for (const m of movers) if (m.p !== m.to) { const d = m.to - m.p, st = dt * 2.5; m.p += Math.abs(d) < st ? d : Math.sign(d) * st; m.apply(ease(m.p)); }
      for (let i = timers.length - 1; i >= 0; i--) { const tm = timers[i]; tm.s -= dt; if (tm.s <= 0) { timers.splice(i, 1); tm.fn(); } }
      // floor keys glow
      for (const tl of tiles) { if (tl.glow > 0) tl.glow = Math.max(0, tl.glow - dt * 1.8); tl.m.emissiveIntensity = 0.18 + tl.glow * 1.3; tl.body.position.y = 0.025 - tl.glow * 0.012; }
      // waltzing couple
      if (freeze > 0) freeze -= dt;
      if (glare > 0) glare -= dt;
      const sp = freeze > 0 ? 0 : (solved ? 0.55 : 0.34);
      dAng += dt * sp; dSpin += dt * (freeze > 0 ? 0 : 1.7);
      couple.position.set(Math.cos(dAng) * 4.2, 0.95 + Math.sin(t * 2.1) * 0.12, Z(9) + Math.sin(dAng) * 2.7);
      couple.rotation.y = freeze > 0 ? Math.atan2(p.x - couple.position.x, p.z - couple.position.z) - PI / 2 : dSpin;
      ghostMat.opacity = 0.42 + Math.sin(t * 1.3) * 0.08 + (glare > 0 ? 0.25 : 0);
      danceLight.x = couple.position.x; danceLight.z = couple.position.z; danceLight.i = glare > 0 ? 2 + Math.random() * 6 : 5;
      // floating notes
      for (const f of floaters) {
        const q = (t * 0.18 + f.ph) % 1;
        f.m.position.set(f.ox + Math.sin(t + f.ph * 9) * 0.25, 1.2 + q * 2.4, Z(f.oz));
        f.m.scale.setScalar(Math.sin(q * PI) * (pianoSpooked ? 1.3 : 1) + 0.01); f.m.rotation.y = t * 1.5 + f.ph * 6;
      }
      // piano spooks the first time you walk up to it
      if (!pianoSpooked && !solved && Math.hypot(p.x - 5.0, p.z - Z(3.4)) < 3.3) {
        pianoSpooked = true; tone(110, 2.4, 0, 'sine', 0.1); tone(164.8, 2.4, 0.05, 'sine', 0.08); tone(220, 2.4, 0.1, 'sine', 0.07);
        ctx.toast('The piano plays a lonely chord all by itself…');
      }
      // mirror ghost fades in as you get close
      const md = Math.hypot(p.x - 7, p.z - Z(1.3));
      if (mBoost > 0) mBoost -= dt;
      const near = md < 6 ? 1 - md / 6 : 0;
      faceMat.opacity = mBoost > 0 ? 0.95 : near * (0.5 + 0.25 * Math.sin(t * 3));
      face.scale.setScalar(mBoost > 0 ? 1.35 : 1);
      face.position.x = mBoost > 0 ? 7.78 : 7.86 - near * 0.04;
      mirrorLight.i = mBoost > 0 ? 6 : near * 2;
      // chest ghost
      if (booT >= 0) {
        booT += dt;
        boo.position.y = 0.5 + 1.1 * Math.sin(Math.min(booT / 0.35, 1) * PI / 2) - (booT > 2.6 ? (booT - 2.6) * 2.7 : 0);
        boo.rotation.z = Math.sin(booT * 14) * 0.2; boo.rotation.y = Math.atan2(p.x - 7.3, p.z - Z(0.95));
        if (booT > 3.0) { boo.visible = false; booT = -1; }
      }
      // punch bubbles
      bubbles.forEach((b, k) => { const q = (t * 0.6 + k / 3) % 1; b.position.y = 1.1 + q * 0.5; b.scale.setScalar(0.035 * (1 - q * 0.5)); });
      punch.scale.x = punch.scale.z = 0.25 + Math.sin(t * 3) * 0.008;
      // music box dancer + gramophone record + socket crank
      if (solved) dancer.rotation.y = t * 2.5;
      if (crankItem.visible) { crankItem.rotation.y = t * 2; crankItem.position.y = 1.25 + Math.sin(t * 3) * 0.04; }
      if (sockSpin.visible) sockSpin.rotation.z = t * 1.2;
      if (gramT > 0) { gramT -= dt; record.rotation.y += dt * 5; }
      if (!gramSpooked && p.x < -9.4 && Math.abs(p.z - Z(2.5)) < 3) {
        gramSpooked = true; gramPlay(); ctx.toast('A crackly gramophone starts playing a waltz by itself…');
      }
      // painting eyes glow when you are in the music room
      eyeMat.opacity = p.x < -9 ? 0.55 + 0.35 * Math.sin(t * 2.2) : 0.25;
    });
  },
};
