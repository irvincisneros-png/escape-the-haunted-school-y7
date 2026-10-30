// Room 2 (Library) extras: secret reading room behind a bookshelf, a book-pulling puzzle,
// a fuse for the arcade, searchable furniture, candy, one science card and some spooky surprises.
export default {
  side: { side: -1, lz: 10.3, w: 2.0 },
  powerHint: 'The arcade has no fuse. Maybe one is hidden in this library.',
  build(ctx) {
    const { THREE, state, mat, basic, box, cyl, sph, plane, canvasTex } = ctx;
    const Z = ctx.rz, G = ctx.group(), room = ctx.room;
    const UB = new THREE.BoxGeometry(1, 1, 1);
    const ease = u => u * u * (3 - 2 * u);
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const found = id => state.isFound(id);

    // ---------- small helpers ----------
    // box centred at (x,y,z) inside group g
    const part = (g, x, y, z, w, h, d, m) => { const k = new THREE.Mesh(UB, m); k.scale.set(w, h, d); k.position.set(x, y, z); g.add(k); return k; };
    const grp = (x, y, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; G.add(g); return g; };
    // tweens: o.t is the target 0..1, apply(eased) is called while moving
    const tw = [];
    const tween = (apply, dur = 0.6, start = 0) => { const o = { a: start, t: start, dur, apply }; apply(ease(start)); tw.push(o); return o; };
    const timers = [];
    const later = (sec, fn) => timers.push({ s: sec, fn });
    const wait = sec => new Promise(res => later(sec, res));

    const wood = mat('#4a2e18'), darkWood = mat('#35200f'), lightWood = mat('#7a5230'), brass = mat('#c9a13a', { metalness: 0.6, roughness: 0.4 });
    const paper = mat('#e8dcb8'), black = basic(0x050505);

    // ---------- the pulled-book puzzle: titles ----------
    const TITLES = ['Geocentric Model', 'Lunar Phases', 'Tides and the Moon', 'Heliocentric Model', 'Solar Eclipses'];
    const RIGHT = 3;
    const BOOKCOL = ['#7a2a3a', '#2a5a6a', '#4a6a2a', '#8a5a1a', '#5a3a7a'];

    // ---------- 1. the secret bookshelf (a movable shelf in the left wall doorway) ----------
    const shelfTex = canvasTex(512, 256, (g, w, h) => {
      let s = 7; const R = (a, b) => a + ((s = (s * 16807) % 2147483647) / 2147483647) * (b - a);
      g.fillStyle = '#2a1a10'; g.fillRect(0, 0, w, h);
      for (let r = 0; r < 5; r++) {
        let x = 4; const rh = h / 5;
        while (x < w - 8) { const bw = R(9, 18), bh = rh - R(10, 22); g.fillStyle = `hsl(${R(0, 360)},${R(25, 55)}%,${R(18, 38)}%)`; g.fillRect(x, r * rh + rh - 6 - bh, bw, bh); g.fillStyle = 'rgba(230,200,120,.4)'; g.fillRect(x + 2, r * rh + rh - 6 - bh + 6, bw - 4, 2); x += bw + 1; }
        g.fillStyle = '#4a3220'; g.fillRect(0, r * rh + rh - 6, w, 6);
      }
    });
    const secret = grp(-7.55, 0, Z(11.3));
    part(secret, 0, 1.85, 1.0, 0.9, 3.7, 2.0, darkWood);
    const secretFace = plane(0.46, 1.85, 1.0, 1.8, 3.5, new THREE.MeshStandardMaterial({ map: shelfTex, roughness: 0.9 }), Math.PI / 2, { g: secret });
    const secClosed = ctx.addSolid(-7.55, 0, Z(10.3), 0.9, 4, 2.0, { cam: true });
    const secOpen = ctx.addSolid(-6.55, 0, Z(11.3), 2.0, 4, 0.9, { cam: true }); secOpen.on = false;
    const secretTw = tween(e => { secret.rotation.y = e * 1.5708; }, 1.8);
    const setSecret = open => { secClosed.on = !open; secOpen.on = open; };

    // ---------- 2. the pull-a-book rack on the left wall ----------
    const RX = -7.5, RLZ = 5.95;
    box(RX, 0, Z(RLZ), 0.8, 1.0, 1.9, wood, { solid: true, cast: true });
    box(RX, 1.0, Z(RLZ), 0.86, 0.06, 1.96, lightWood);
    ctx.candle(RX, 1.06, Z(4.95), room, true, 0.22);
    const wobble = [];
    const books = TITLES.map((title, i) => {
      const bz = Z(5.3 + i * 0.34);
      const g = grp(RX + 0.1, 1.06, bz);
      part(g, 0, 0.28, 0, 0.4, 0.56, 0.24, mat(BOOKCOL[i]));
      part(g, -0.02, 0.28, 0, 0.36, 0.5, 0.2, paper).position.x = -0.03;
      const label = title.toUpperCase();
      const spine = canvasTex(64, 160, (c, w, h) => {
        c.fillStyle = BOOKCOL[i]; c.fillRect(0, 0, w, h);
        c.fillStyle = '#e9c76a'; c.fillRect(0, 10, w, 4); c.fillRect(0, h - 14, w, 4);
        c.save(); c.translate(w / 2 + 5, h / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.font = 'bold 15px Nunito, sans-serif'; c.fillStyle = '#f3ead8'; c.fillText(label.length > 14 ? label.split(' ')[0] : label, 0, 0); c.restore();
      });
      plane(0.201, 0.28, 0, 0.24, 0.56, new THREE.MeshBasicMaterial({ map: spine }), Math.PI / 2, { g });
      const b = { g, title, i, pulled: false, wob: 0, base: g.position.x };
      b.tw = tween(e => { g.rotation.z = -0.6 * e; g.position.x = b.base + 0.06 * e; }, 0.35);
      wobble.push(b);
      return b;
    });
    let solved = found('r2-shelf-open');
    if (solved) { books[RIGHT].tw.a = books[RIGHT].tw.t = 1; books[RIGHT].tw.apply(ease(1)); secretTw.a = secretTw.t = 1; secretTw.apply(ease(1)); setSecret(true); }

    const WRONG = [
      ['Geocentric means Earth-centred. That is the OLD model. The book shoves itself back in. Try the newer one!', 'wrong'],
      ['A tiny Moon on the cover waxes and wanes. Good book, but it is not about a model of the Solar System.', 'wrong'],
      ['It flaps its covers like a bird, then snaps shut. Tides are not a model of the Solar System.', 'wrong'],
      null,
      ['This book yawns and goes back to sleep. Eclipses are not the model with the Sun at the centre.', 'wrong'],
    ];
    books.forEach(b => {
      ctx.interact({
        x: RX + 0.65, y: 1.2, z: Z(5.3 + b.i * 0.34), r: 0.5, label: 'Pull “' + b.title + '”', button: 'Pull',
        active: () => !solved && !b.pulled,
        run: async () => {
          if (solved) return;
          b.pulled = true; b.tw.t = 1; ctx.sfx('click');
          if (b.i === RIGHT) {
            solved = true; state.markFound('r2-shelf-open');
            await wait(0.45);
            ctx.sfx('unlock'); ctx.shake(0.35); await wait(0.35);
            ctx.sfx('door'); secretTw.t = 1; setSecret(true);
            ctx.toast('CLICK! A bookshelf by the arcade swings open. A secret room!');
          } else {
            b.wob = 1.1; ctx.toast(WRONG[b.i][0]); ctx.sfx('wrong');
            await wait(0.8); b.tw.t = 0; b.pulled = false;
          }
        },
      });
    });

    // ---------- 3. librarian's desk with a drawer (holds the clue note) ----------
    // dir +1: drawer faces deeper into the room (higher local depth); -1 the other way.
    function deskWithDrawer(x, lz, dir) {
      const zc = Z(lz), s = -dir;          // world z direction the drawer slides out
      box(x, 0.78, zc, 1.8, 0.07, 0.95, lightWood, { solid: false });
      for (const dx of [-0.8, 0.8]) for (const dz of [-0.4, 0.4]) box(x + dx, 0, zc + dz, 0.1, 0.78, 0.1, wood);
      box(x, 0.3, zc - s * 0.42, 1.7, 0.5, 0.06, wood);          // back panel
      ctx.addSolid(x, 0, zc, 1.8, 0.85, 0.95, {});
      const d = grp(x, 0, zc + s * 0.4);
      part(d, 0, 0.55, 0, 0.9, 0.2, 0.06, lightWood); part(d, 0, 0.55, s * 0.07, 0.08, 0.05, 0.08, brass);
      part(d, 0, 0.47, -s * 0.34, 0.8, 0.03, 0.66, wood);
      part(d, -0.4, 0.53, -s * 0.34, 0.03, 0.12, 0.66, wood); part(d, 0.4, 0.53, -s * 0.34, 0.03, 0.12, 0.66, wood);
      const o = { x, zc, s, d, z0: zc + s * 0.4 };
      o.tw = tween(e => { d.position.z = o.z0 + s * 0.55 * e; }, 0.7);
      return o;
    }

    const deskA = deskWithDrawer(-5.2, 1.2, 1);
    ctx.candle(-5.7, 0.85, Z(1.2), room, true, 0.22);
    part(G, -4.6, 0.84, Z(1.25), 0.5, 0.06, 0.38, mat('#a62a3a'));
    const noteHtml = '<p>Found in the librarian\'s drawer, in wobbly handwriting:</p>' +
      '<p class="clue">"Long ago, people believed the Earth was the centre of everything: the <b>geocentric</b> model. Then telescope observations, like Galileo seeing the moons of Jupiter and the phases of Venus, did not fit that model. Scientists changed it."</p>' +
      '<table class="q-table"><tr><th>Model</th><th>What is at the centre?</th></tr><tr><td>Geocentric (geo = Earth)</td><td>The Earth</td></tr><tr><td>Heliocentric (helio = Sun)</td><td>The Sun</td></tr></table>' +
      '<p class="clue">The secret reading room opens when you pull the book named after the model scientists use TODAY, with the Sun at the centre. It is on the little shelf by the arcade. (P.S. Pull books gently. They bite.)</p>';
    const readNote = () => ctx.note({ kicker: 'Torn note', title: 'The Librarian\'s Torn Note', html: noteHtml, button: 'Got it' });
    let deskOpen = found('r2-desk');
    if (deskOpen) { deskA.tw.a = deskA.tw.t = 1; deskA.tw.apply(ease(1)); }
    const noteSheet = grp(-5.2, 0, deskA.zc + deskA.s * 0.6);
    part(noteSheet, 0, 0.5, 0, 0.3, 0.01, 0.4, paper).rotation.y = 0.3;
    noteSheet.visible = deskOpen;
    const deskIt = ctx.interact({
      x: -5.2, y: 0.9, z: Z(2.3), r: 1.5, label: 'Open the desk drawer', button: 'Use',
      active: () => true,
      run: async () => {
        if (!deskOpen) {
          deskOpen = true; state.markFound('r2-desk'); deskA.tw.t = 1; noteSheet.visible = true; ctx.sfx('door'); deskIt.label = 'Read the librarian\'s note';
          await wait(0.6);
        }
        await readNote();
      },
    });

    if (deskOpen) deskIt.label = 'Read the librarian\'s note';

    // ---------- 4. grandfather clock (empty, with a surprise) + book-stack steps + candy on top ----------
    const CX = 7.6, CLZ = 0.65;
    const clock = grp(CX, 0, Z(CLZ), -Math.PI / 2);
    const clockTex = canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = '#efe6c8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a2a14'; c.lineWidth = 6; c.beginPath(); c.arc(64, 64, 52, 0, 7); c.stroke();
      c.fillStyle = '#3a2a14'; c.font = 'bold 15px Nunito, sans-serif'; c.textAlign = 'center';
      for (let n = 1; n <= 12; n++) { const a = n / 12 * Math.PI * 2; c.fillText(String(n), 64 + Math.sin(a) * 40, 69 - Math.cos(a) * 40); }
      c.lineWidth = 5; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + 24 * Math.sin(-0.15), 64 - 24 * Math.cos(-0.15)); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + 36 * Math.sin(-0.5), 64 - 36 * Math.cos(-0.5)); c.stroke();
    });
    part(clock, 0, 0.06, 0, 0.84, 0.12, 0.74, darkWood);
    part(clock, 0, 0.8, -0.3, 0.8, 1.5, 0.06, darkWood);                     // back
    part(clock, -0.37, 0.8, 0, 0.06, 1.5, 0.7, wood); part(clock, 0.37, 0.8, 0, 0.06, 1.5, 0.7, wood);
    part(clock, 0, 1.55, 0, 0.8, 0.06, 0.7, darkWood);                       // ceiling of the case
    part(clock, 0, 1.82, 0, 0.84, 0.56, 0.7, wood);                          // clock head
    part(clock, 0, 2.14, 0, 0.9, 0.1, 0.76, darkWood);
    plane(0, 1.82, 0.356, 0.6, 0.6, new THREE.MeshBasicMaterial({ map: clockTex }), 0, { g: clock });
    const pend = grp(0, 1.4, -0.1); clock.add(pend);
    part(pend, 0, -0.55, 0, 0.04, 1.1, 0.03, brass); part(pend, 0, -1.05, 0, 0.26, 0.26, 0.05, brass);
    const skull = grp(0, 0.8, -0.1); clock.add(skull);
    part(skull, 0, 0, 0, 0.3, 0.3, 0.3, mat('#efe9d6')); part(skull, -0.07, 0.03, 0.151, 0.07, 0.08, 0.02, black); part(skull, 0.07, 0.03, 0.151, 0.07, 0.08, 0.02, black);
    part(skull, 0, -0.12, 0.05, 0.2, 0.07, 0.2, mat('#efe9d6'));
    skull.visible = false;
    const cdoor = grp(-0.36, 0, 0.34); clock.add(cdoor);                      // hinged on the left edge, swings open
    part(cdoor, 0.36, 0.8, 0, 0.72, 1.46, 0.05, lightWood); part(cdoor, 0.6, 0.8, 0.04, 0.05, 0.1, 0.04, brass);
    part(cdoor, 0.36, 0.8, 0.03, 0.5, 1.2, 0.02, mat('#2a1a10'));
    const clockTw = tween(e => { cdoor.rotation.y = -e * 1.9; }, 0.7);
    ctx.addSolid(CX, 0, Z(CLZ), 0.76, 2.2, 0.9, { cam: true });
    let clockOpen = found('r2-clock');
    if (clockOpen) { clockTw.a = clockTw.t = 1; clockTw.apply(ease(1)); }
    let skullT = -1;
    ctx.interact({
      x: CX - 1.2, y: 1.2, z: Z(CLZ + 0.9), r: 1.6, label: 'Open the grandfather clock', button: 'Open',
      active: () => !clockOpen,
      run: async () => {
        clockOpen = true; state.markFound('r2-clock'); clockTw.t = 1; ctx.sfx('door');
        await wait(0.5);
        skull.visible = true; skullT = 0; ctx.sfx('whoosh');
        ctx.toast('A tiny skull springs out: "TIME\'S UP!" ...just kidding. The clock is empty.');
      },
    });
    // book-stack steps up to the clock top
    const stack = (x, lz, slabs, w) => {
      const h = 0.18; let y = 0; const cols = ['#7a2a3a', '#2a5a6a', '#4a6a2a', '#8a5a1a', '#5a3a7a'];
      for (let i = 0; i < slabs; i++) { box(x + (i % 2 ? 0.03 : -0.03), y, Z(lz), w - (i % 3) * 0.04, h, 0.62, mat(cols[(i + slabs) % 5]), { ry: i * 0.12 }); y += h; }
      ctx.addSolid(x, 0, Z(lz), w, y, 0.62, {});
    };
    stack(5.6, CLZ, 3, 0.62); stack(6.25, CLZ, 6, 0.62);
    ctx.candy(CX, 2.55, Z(CLZ), 'r2-candy3');

    // ---------- 5. treasure chest (candy) ----------
    const chest = grp(6.7, 0, Z(14.5), -Math.PI / 2);
    const gold = mat('#d6a82a', { metalness: 0.6, roughness: 0.4, emissive: '#3a2a00' });
    part(chest, 0, 0.03, 0, 1.0, 0.06, 0.6, darkWood);
    part(chest, 0, 0.25, 0.28, 1.0, 0.5, 0.05, wood); part(chest, 0, 0.25, -0.28, 1.0, 0.5, 0.05, wood);
    part(chest, -0.47, 0.25, 0, 0.05, 0.5, 0.6, wood); part(chest, 0.47, 0.25, 0, 0.05, 0.5, 0.6, wood);
    for (const dx of [-0.2, 0, 0.18]) part(chest, dx, 0.09, 0.05, 0.14, 0.05, 0.14, gold);
    part(chest, 0, 0.5, 0.29, 1.04, 0.05, 0.04, gold);
    const lidPivot = grp(0, 0.5, -0.3, 0); chest.add(lidPivot);
    part(lidPivot, 0, 0.08, 0.3, 1.04, 0.16, 0.64, lightWood); part(lidPivot, 0, 0.0, 0.58, 0.14, 0.14, 0.04, gold);
    const lidTw = tween(e => { lidPivot.rotation.x = -e * 1.9; }, 0.6);
    ctx.addSolid(6.7, 0, Z(14.5), 0.7, 0.55, 1.05, {});
    const chestCandy = ctx.candy(6.7, 0.7, Z(14.5), 'r2-candy2', { hidden: true });
    let chestOpen = found('r2-chest');
    if (chestOpen) { lidTw.a = lidTw.t = 1; lidTw.apply(ease(1)); chestCandy.reveal(); }
    ctx.interact({
      x: 5.7, y: 0.8, z: Z(14.5), r: 1.3, label: 'Open the chest', button: 'Open', active: () => !chestOpen,
      run: async () => { chestOpen = true; state.markFound('r2-chest'); lidTw.t = 1; ctx.sfx('door'); await wait(0.45); chestCandy.reveal(); ctx.toast('Creeeak... a sweet is tucked inside, plus some very old gold stickers.'); },
    });

    // ---------- 6. hollow book on the reading table (candy) ----------
    const hb = grp(3.8, 0.93, Z(10.6)); hb.rotation.y = 0.25;
    part(hb, 0, 0.02, 0, 0.44, 0.04, 0.32, mat('#2a5a2a')); part(hb, 0, 0.1, 0, 0.4, 0.12, 0.28, paper);
    const hbLid = grp(-0.22, 0.17, 0); hb.add(hbLid);
    part(hbLid, 0.22, 0.02, 0, 0.44, 0.04, 0.32, mat('#2a5a2a')); part(hbLid, 0.22, 0.045, 0, 0.18, 0.012, 0.1, gold);
    const hbTw = tween(e => { hbLid.rotation.z = e * 2.3; }, 0.5);
    const hbCandy = ctx.candy(3.8, 1.2, Z(10.6), 'r2-candy1', { hidden: true });
    let hbOpen = found('r2-hollow');
    if (hbOpen) { hbTw.a = hbTw.t = 1; hbTw.apply(ease(1)); hbCandy.reveal(); }
    ctx.interact({
      x: 3.8, y: 1.0, z: Z(10.6), r: 1.3, label: 'Open the odd little book', button: 'Open', active: () => !hbOpen,
      run: async () => { hbOpen = true; state.markFound('r2-hollow'); hbTw.t = 1; ctx.sfx('click'); await wait(0.3); hbCandy.reveal(); ctx.toast('A hollow book! Someone hid a sweet in the pages.'); },
    });

    // ---------- 7. fuse box beside the arcade ----------
    const fx = -7.82, fy = 1.2, flz = 8.98;
    box(fx - 0.04, fy, Z(flz), 0.12, 0.8, 0.66, mat('#4a4f5c', { metalness: 0.5, roughness: 0.5 }));
    box(fx + 0.02, fy + 0.06, Z(flz), 0.02, 0.62, 0.5, mat('#14141a'));
    const fuseModel = (g, s) => {
      part(g, 0, 0, 0, 0.09 * s, 0.26 * s, 0.09 * s, new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffa010, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }));
      part(g, 0, 0.14 * s, 0, 0.11 * s, 0.05 * s, 0.11 * s, brass); part(g, 0, -0.14 * s, 0, 0.11 * s, 0.05 * s, 0.11 * s, brass);
      part(g, 0, 0, 0, 0.012 * s, 0.24 * s, 0.012 * s, black);
    };
    const socketFuse = grp(fx + 0.06, fy + 0.35, Z(flz)); fuseModel(socketFuse, 1.1); socketFuse.visible = false;
    for (const dy of [-0.18, 0.18]) box(fx + 0.04, fy + 0.35 + dy - 0.02, Z(flz) - 0.07, 0.03, 0.04, 0.14, brass);
    const led = sph(fx + 0.04, fy + 0.72, Z(flz), 0.035, 0.035, 0.035, new THREE.MeshBasicMaterial({ color: 0xe0384a }));
    const fdoor = grp(fx + 0.06, fy, Z(flz - 0.33));
    part(fdoor, 0.0, 0.4, -0.33, 0.05, 0.78, 0.64, mat('#6a3a3a', { metalness: 0.4 }));
    plane(0.03, 0.4, -0.33, 0.5, 0.6, new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#e0b020'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1010'; for (let i = -2; i < 6; i++) { c.beginPath(); c.moveTo(i * 30, 0); c.lineTo(i * 30 + 14, 0); c.lineTo(i * 30 + 14 + h, h); c.lineTo(i * 30 + h, h); c.fill(); } c.fillStyle = '#e0384a'; c.fillRect(14, 36, 100, 56); c.fillStyle = '#fff'; c.font = 'bold 26px Nunito, sans-serif'; c.textAlign = 'center'; c.fillText('FUSE', 64, 62); c.font = 'bold 15px Nunito, sans-serif'; c.fillText('ARCADE', 64, 84); }) }), Math.PI / 2, { g: fdoor });
    const fdoorTw = tween(e => { fdoor.rotation.y = -e * 1.9; }, 0.6);
    const fuseLight = ctx.light(-6.8, 1.7, Z(flz), 0xff6a3a, 1.6, 4, 0.3);
    const sparks = [];
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(UB, basic(0xffe060)); s.scale.setScalar(0.05); s.visible = false; G.add(s); sparks.push({ s, vx: 0, vy: 0, vz: 0, t: 0 }); }
    let sparkT = -1;
    const showPowered = () => { socketFuse.visible = true; led.material = new THREE.MeshBasicMaterial({ color: 0x7dff6a }); fuseLight.i = 1.2; };
    if (state.hasPower(2)) { fdoorTw.a = fdoorTw.t = 1; fdoorTw.apply(ease(1)); showPowered(); }
    ctx.interact({
      x: -7.0, y: 1.3, z: Z(flz), r: 1.4, label: 'Check the fuse box', button: 'Use',
      active: () => !state.hasPower(2),
      run: async () => {
        fdoorTw.t = 1;
        if (state.hasItem('r2-fuse')) {
          await wait(0.3);
          state.useItem('r2-fuse'); socketFuse.visible = true; ctx.sfx('key'); await wait(0.35);
          sparkT = 0; ctx.sfx('unlock'); ctx.shake(0.3);
          state.powerArcade(2); showPowered();
          ctx.toast('ZZZAP! The arcade machine hums to life. Time to play!');
        } else {
          ctx.sfx('wrong'); ctx.toast('The fuse box is empty. The arcade needs a fuse... maybe it is hidden in this library.');
        }
      },
    });

    // ---------- 8. talking portrait (ctx.ask moment) ----------
    const PX = -5.6, PLZ = 15.66;
    ctx.portrait(room, PX, 3.9, Z(PLZ), 0, 30);
    const portraitCandy = ctx.candy(PX, 1.3, Z(15.0), 'r2-candy5', { hidden: true });
    let asked = found('r2-portrait');
    if (asked) portraitCandy.reveal();
    ctx.interact({
      x: PX, y: 1.6, z: Z(15.0), r: 2.4, label: 'Talk to the portrait', button: 'Talk', active: () => !asked,
      run: async () => {
        await ctx.note({ kicker: 'The portrait whispers...', title: 'Old Mr Grimsby', html: '<p class="clue">"Pssst! I was the librarian here for 200 years. Answer one riddle for me and I will drop you a sweet."</p>', button: 'Okay...' });
        const ok = await ctx.ask('Mr Grimsby\'s riddle');
        if (ok) { asked = true; state.markFound('r2-portrait'); ctx.sfx('whoosh'); portraitCandy.reveal(); ctx.toast('"Well done!" A sweet drops out of the frame.'); }
        else ctx.toast('"Tsk! Not quite. Ask me again any time..."');
      },
    });

    // ---------- 9. spooky: a book that creeps out of the shelf when you walk by ----------
    const creeper = grp(7.3, 1.35, Z(7.6));
    part(creeper, 0.0, 0, 0, 0.5, 0.5, 0.2, mat('#8a1a2a', { emissive: '#300008' })); part(creeper, -0.05, 0, 0, 0.5, 0.44, 0.17, paper);
    part(creeper, -0.27, 0, 0, 0.02, 0.5, 0.2, gold);
    let creepAmt = 0, creepSeen = false;

    // ---------- 10. the secret reading room ----------
    const sr = ctx.sideRoom({ depth: 6, lz0: 7.2, lz1: 14.0, wall: ['paper', '#2c1a36', '#3a2448'], floor: ['wood', '#2a1c12', '#3a2616'], light: 0xb89aff });
    box(sr.xm, 0.02, sr.zm, 4.5, 0.03, 4.5, mat('#4a1a2a'));
    ctx.light(-11.8, 2.6, Z(10.3), 0x7dff6a, 2.5, 6, 0.15);

    // pedestal with glass dome and the fuse
    const px = -11.8, pz = Z(10.3);
    box(px, 0, pz, 0.8, 0.95, 0.8, mat('#3c3550', { roughness: 0.6 }), { solid: true });
    box(px, 0.95, pz, 0.95, 0.08, 0.95, mat('#2a2438'));
    const dome = grp(px, 1.03, pz);
    const domeM = new THREE.MeshStandardMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1 });
    const dm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.6, 12, 1, true), domeM); dm1.position.y = 0.3; dome.add(dm1);
    const dm2 = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 6, 0, 6.283, 0, 1.5708), domeM); dm2.position.y = 0.6; dome.add(dm2);
    const fuseObj = grp(px, 1.3, pz); fuseModel(fuseObj, 1.8);
    const domeTw = tween(e => { dome.position.y = 1.03 + e * 1.1; }, 0.8);
    const took = () => found('r2-fuse-taken') || state.hasItem('r2-fuse') || state.hasPower(2);
    // eyes that appear in the dark for a moment
    const eyes = grp(-14.2, 2.7, Z(10.3), Math.PI / 2); eyes.visible = false;
    const eyeM = basic(0xb8ff9a);
    part(eyes, -0.35, 0, 0, 0.3, 0.16, 0.04, eyeM); part(eyes, 0.35, 0, 0, 0.3, 0.16, 0.04, eyeM);
    if (took()) { domeTw.a = domeTw.t = 1; domeTw.apply(ease(1)); fuseObj.visible = false; }
    let eyesT = -1;

    // skeleton librarian on a chair (head follows you)
    const sk = grp(-13.1, 0, Z(8.5), Math.PI / 2);
    const bone = mat('#e8e2cf', { roughness: 0.7 });
    part(sk, 0, 0.22, 0, 0.5, 0.45, 0.5, darkWood); part(sk, 0, 0.8, -0.26, 0.5, 0.8, 0.06, darkWood);
    part(sk, 0, 0.55, 0, 0.3, 0.12, 0.2, bone); part(sk, 0, 0.8, 0, 0.07, 0.4, 0.07, bone);
    for (const y of [0.78, 0.9, 1.02]) part(sk, 0, y, 0.02, 0.34, 0.05, 0.2, bone);
    for (const x of [-0.2, 0.2]) { part(sk, x, 0.55, 0.28, 0.09, 0.09, 0.45, bone); part(sk, x, 0.25, 0.5, 0.08, 0.5, 0.08, bone); part(sk, x, 0.85, 0.12, 0.07, 0.07, 0.4, bone); }
    part(sk, 0, 0.75, 0.38, 0.4, 0.06, 0.3, mat('#a62a3a'));
    const head = grp(0, 1.28, 0); sk.add(head);
    part(head, 0, 0.12, 0, 0.26, 0.26, 0.26, bone);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
    for (const x of [-0.06, 0.06]) { const e = new THREE.Mesh(UB, eyeMat); e.scale.set(0.07, 0.07, 0.02); e.position.set(x, 0.14, 0.131); head.add(e); }
    const jaw = grp(0, 0, 0.02); head.add(jaw); part(jaw, 0, -0.02, 0.03, 0.18, 0.06, 0.2, bone);
    let jawT = -1;
    const skeletonGlowing = () => { eyeMat.color.set(0x7dff6a); };
    if (found('r2-fuse-taken')) skeletonGlowing();
    ctx.addSolid(-13.1, 0, Z(8.5), 0.6, 1, 0.6, {});
    let skelSearched = found('r2-skel');
    ctx.interact({
      x: -11.9, y: 1.0, z: Z(8.5), r: 1.6, label: 'Search the skeleton\'s pockets', button: 'Search', active: () => !skelSearched,
      run: async () => {
        skelSearched = true; state.markFound('r2-skel'); jawT = 0; ctx.sfx('click');
        ctx.toast('You find one library card, overdue by 200 years. The skeleton\'s jaw clacks: "Late fees!"');
      },
    });

    // archive cabinet: holds the science card
    const ax = -14.05, alz = 11.6;
    box(ax - 0.33, 0, Z(alz), 0.06, 2.3, 1.5, darkWood, { solid: false });
    box(ax, 2.3, Z(alz), 0.8, 0.1, 1.6, wood); box(ax, 0, Z(alz), 0.8, 0.08, 1.5, wood);
    for (const dz of [-0.72, 0.72]) box(ax, 0, Z(alz) + dz, 0.8, 2.3, 0.06, wood);
    for (const y of [0.9, 1.7]) box(ax, y, Z(alz), 0.76, 0.04, 1.4, lightWood);
    for (let i = 0; i < 4; i++) box(ax + 0.02, 0.94 + (i % 2) * 0.8, Z(alz) + (i < 2 ? -0.5 : 0.5), 0.3, 0.36 - (i % 3) * 0.05, 0.2, mat(BOOKCOL[i]));
    ctx.addSolid(ax, 0, Z(alz), 0.8, 2.3, 1.6, {});
    const leafM = mat('#5a3a20');
    const leafA = grp(ax + 0.42, 0, Z(alz - 0.74)); part(leafA, 0.0, 1.1, -0.37, 0.05, 2.1, 0.72, leafM); part(leafA, 0.04, 1.1, -0.68, 0.04, 0.12, 0.04, brass);
    const leafB = grp(ax + 0.42, 0, Z(alz + 0.74)); part(leafB, 0.0, 1.1, 0.37, 0.05, 2.1, 0.72, leafM); part(leafB, 0.04, 1.1, 0.68, 0.04, 0.12, 0.04, brass);
    const arTw = tween(e => { leafA.rotation.y = -e * 1.9; leafB.rotation.y = e * 1.9; }, 0.8);
    const card = ctx.dataCard(ax + 0.1, 1.3, Z(alz), {
      title: 'Science card: Moon phases', hidden: true,
      html: '<p>The Moon does not make its own light. It always has one half lit by the Sun. As the Moon orbits the Earth (about every 29.5 days from full moon to full moon), we see different amounts of the lit half. These are the <b>phases</b> of the Moon.</p><p>Aboriginal and Torres Strait Islander Peoples have observed the Moon for many thousands of years, and many communities link the Moon\'s phases with the tides.</p><small>1.3.3 and 1.4.1</small>',
    });
    let archiveOpen = found('r2-archive');
    if (archiveOpen) { arTw.a = arTw.t = 1; arTw.apply(ease(1)); card.reveal(); }
    ctx.interact({
      x: ax + 1.0, y: 1.2, z: Z(alz), r: 1.4, label: 'Open the archive cabinet', button: 'Open', active: () => !archiveOpen,
      run: async () => { archiveOpen = true; state.markFound('r2-archive'); arTw.t = 1; ctx.sfx('door'); await wait(0.5); card.reveal(); ctx.sfx('whoosh'); ctx.toast('The cabinet doors creak open. A glowing science card floats inside!'); },
    });

    // secret room desk with drawer (candy)
    const deskB = deskWithDrawer(-11.0, 13.35, -1);
    ctx.candle(-11.6, 0.85, Z(13.35), room, true, 0.22);
    part(G, -10.5, 0.83, Z(13.4), 0.4, 0.05, 0.3, mat('#2a5a2a')).rotation.y = 0.4;
    const deskCandy = ctx.candy(-11.0, 0.6, Z(12.74), 'r2-candy4', { hidden: true });
    let deskBOpen = found('r2-desk2');
    if (deskBOpen) { deskB.tw.a = deskB.tw.t = 1; deskB.tw.apply(ease(1)); deskCandy.reveal(); }
    ctx.interact({
      x: -11.0, y: 0.9, z: Z(12.1), r: 1.4, label: 'Open the desk drawer', button: 'Open', active: () => !deskBOpen,
      run: async () => { deskBOpen = true; state.markFound('r2-desk2'); deskB.tw.t = 1; ctx.sfx('door'); await wait(0.5); deskCandy.reveal(); ctx.toast('A sweet, hidden under a very old bookmark.'); },
    });

    // fuse pickup
    ctx.interact({
      x: px + 0.9, y: 1.3, z: pz, r: 1.5, label: 'Lift the glass and take the fuse', button: 'Take', active: () => !took(),
      run: async () => {
        state.markFound('r2-fuse-taken'); domeTw.t = 1; ctx.sfx('door'); await wait(0.5);
        fuseObj.visible = false; state.addItem({ id: 'r2-fuse', name: 'Fuse', emoji: '🔌' }); ctx.sfx('key');
        ctx.toast('You got the FUSE! Take it to the fuse box by the arcade.');
        // small spooky jump: green eyes in the dark, skeleton wakes up
        await wait(0.8);
        skeletonGlowing(); eyes.visible = true; eyesT = 0; jawT = 0; ctx.sfx('scare'); ctx.shake(0.35);
      },
    });

    // ---------- per-frame animation ----------
    ctx.onFrame((t, dt) => {
      for (const o of tw) if (o.a !== o.t) { const d = dt / o.dur; o.a = o.t > o.a ? Math.min(o.t, o.a + d) : Math.max(o.t, o.a - d); o.apply(ease(o.a)); }
      for (let i = timers.length - 1; i >= 0; i--) { const k = timers[i]; k.s -= dt; if (k.s <= 0) { timers.splice(i, 1); k.fn(); } }
      const p = ctx.player();
      // wrong-book shudder
      for (const b of wobble) if (b.wob > 0) { b.wob = Math.max(0, b.wob - dt); b.g.rotation.y = Math.sin(t * 50) * 0.25 * b.wob; } else if (b.g.rotation.y) b.g.rotation.y = 0;
      // clock: pendulum ticks, skull pops
      pend.rotation.z = Math.sin(t * 3) * 0.3;
      if (skullT >= 0) {
        skullT += dt; const u = skullT / 1.8;
        skull.position.z = -0.1 + Math.sin(clamp(u, 0, 1) * Math.PI) * 0.62; skull.rotation.z = Math.sin(t * 30) * 0.15 * (1 - clamp(u, 0, 1));
        if (u >= 1) { skullT = -1; skull.visible = false; }
      }
      // creeping book on the right shelf
      const nearC = Math.hypot(p.x - 6.5, p.z - Z(7.6)) < 2.6;
      if (nearC && !creepSeen) { creepSeen = true; ctx.sfx('whoosh'); }
      if (!nearC && Math.hypot(p.x - 6.5, p.z - Z(7.6)) > 6) creepSeen = false;
      creepAmt += ((nearC ? 1 : 0) - creepAmt) * Math.min(1, dt * 3);
      creeper.position.x = 7.3 - 0.3 * creepAmt - (nearC ? Math.abs(Math.sin(t * 6)) * 0.03 : 0);
      creeper.rotation.z = nearC ? Math.sin(t * 9) * 0.08 : 0;
      // skeleton head follows the player; jaw clacks
      if (Math.hypot(p.x + 12, p.z - Z(9.5)) < 7) {
        let ang = Math.atan2(p.x - sk.position.x, p.z - sk.position.z) - Math.PI / 2; if (ang < -Math.PI) ang += 6.2832;
        head.rotation.y += (clamp(ang, -1.2, 1.2) - head.rotation.y) * Math.min(1, dt * 4);
      }
      if (jawT >= 0) { jawT += dt; jaw.rotation.x = Math.abs(Math.sin(jawT * 16)) * 0.45 * (jawT < 1.2 ? 1 : 0); if (jawT > 1.3) { jawT = -1; jaw.rotation.x = 0; } }
      if (eyesT >= 0) { eyesT += dt; eyes.visible = eyesT < 1.6 && (eyesT < 1.0 || Math.sin(eyesT * 40) > 0); if (eyesT > 1.6) { eyesT = -1; eyes.visible = false; } }
      // fuse spins gently while waiting under the glass
      if (fuseObj.visible) fuseObj.rotation.y = t * 1.5;
      // sparks at the fuse box
      if (sparkT >= 0) {
        if (sparkT === 0) for (const s of sparks) { s.t = 0; s.s.visible = true; s.s.position.set(fx + 0.1, fy + 0.35, Z(flz)); s.vx = 0.5 + Math.random() * 1.2; s.vy = 0.5 + Math.random() * 2; s.vz = (Math.random() - 0.5) * 2.5; }
        sparkT += dt;
        for (const s of sparks) { s.vy -= 6 * dt; s.s.position.x += s.vx * dt; s.s.position.y += s.vy * dt; s.s.position.z += s.vz * dt; }
        if (sparkT > 0.8) { sparkT = -1; for (const s of sparks) s.s.visible = false; }
      }
    });
  },
};
