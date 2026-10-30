// Room 6 extras: Clock Tower Hall (finale).
// Puzzle (Year 7 Matter, 4.1): nine "ghost kettle log" posters hang around the hall. Each shows the tower clock time and the
// thermometer reading as a kettle of ice was heated. The Clockmaker's note (in the gear room) says to set the great clock to
// the time the water FIRST reached 100 C (boiling point): 2:30. Turn the hour and minute cranks, pull the great lever, the
// bell tolls and the bell altar opens to reveal the science card and a bonus candy.
export default {
  side: { side: 1, lz: 12.6, w: 2.6 },
  build(ctx) {
    const { THREE, state, box, cyl, sph, plane, mat, basic, canvasTex, interact, onFrame, candy } = ctx;
    const Z = ctx.rz, grp = ctx.group(), TAU = Math.PI * 2;
    const found = id => state.isFound(id), mark = id => state.markFound(id);
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const solved0 = found('r6-solved');
    const ANSWER = { h: 2, m: 30 };
    // the kettle log (clock time -> thermometer reading, deg C); the posters below show these nine readings
    const LOG = { '2:00': -5, '2:05': 0, '2:10': 0, '2:15': 25, '2:20': 55, '2:25': 85, '2:30': 100, '2:35': 100, '2:40': 100 };

    // ---------------------------------------------------------------- tiny tween helper
    const tws = [];
    const tween = (apply, v0 = 0, k = 7) => { const w = { v: v0, to: v0, k, apply }; apply(v0); tws.push(w); return w; };
    const brass = mat('#9a7a32', { metalness: 0.6, roughness: 0.4 });
    const darkWood = mat('#2a1a10'), wood = mat('#4a3020'), woodLt = mat('#5e4128');
    const iron = mat('#2a2a34', { metalness: 0.6, roughness: 0.5 });

    // ---------------------------------------------------------------- the great clock (our own face and hands, set by the player)
    const CX = 7.8, CY = 3.3, CZ = Z(8);
    const faceTex = canvasTex(512, 512, (g) => {
      g.fillStyle = '#9a7a32'; g.beginPath(); g.arc(256, 256, 256, 0, 7); g.fill();
      g.fillStyle = '#e6dcc0'; g.beginPath(); g.arc(256, 256, 238, 0, 7); g.fill();
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 6; g.beginPath(); g.arc(256, 256, 238, 0, 7); g.stroke();
      for (let i = 0; i < 60; i++) {
        const a = i / 60 * TAU, big = i % 5 === 0, r0 = big ? 222 : 230;
        g.lineWidth = big ? 6 : 2; g.beginPath(); g.moveTo(256 + Math.sin(a) * r0, 256 - Math.cos(a) * r0); g.lineTo(256 + Math.sin(a) * 236, 256 - Math.cos(a) * 236); g.stroke();
      }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 1; i <= 12; i++) {
        const a = i / 12 * TAU;
        g.fillStyle = '#2a1a10'; g.font = 'bold 58px Nunito, sans-serif'; g.fillText(String(i), 256 + Math.sin(a) * 168, 256 - Math.cos(a) * 168);
        g.fillStyle = '#a02838'; g.font = 'bold 22px Nunito, sans-serif'; g.fillText(String(i * 5), 256 + Math.sin(a) * 206, 256 - Math.cos(a) * 206);
      }
    });
    plane(CX, CY, CZ, 5.6, 5.6, new THREE.MeshStandardMaterial({ map: faceTex, transparent: true, alphaTest: 0.5, roughness: 0.8, emissive: '#ffffff', emissiveMap: faceTex, emissiveIntensity: 0.35 }), -Math.PI / 2);
    const hg = new THREE.Group(); hg.position.set(CX - 0.04, CY, CZ); hg.rotation.y = -Math.PI / 2; grp.add(hg);
    const minute = new THREE.Group(), hour = new THREE.Group(); hg.add(minute, hour);
    const handM = mat('#1a120c');
    box(0, -0.4, 0.09, 0.13, 2.3, 0.05, handM, { g: minute }); box(0, -0.3, 0.05, 0.24, 1.55, 0.05, handM, { g: hour });
    box(0, 1.5, 0.05, 0.3, 0.1, 0.04, mat('#a02838'), { g: hour });
    const hub = cyl(0, 0, 0.1, 0.16, 0.1, brass, { seg: 12 }); hub.rotation.x = Math.PI / 2; hg.add(hub); hub.position.z = 0.11;

    // clock state (decoupled: hour crank sets the hour, minute crank sets the minutes)
    const clk = { h: solved0 ? ANSWER.h : 0, m: solved0 ? ANSWER.m : 0, aM: 0, aH: 0, spin: false, jitter: 0 };
    const wantM = () => clk.m / 60 * TAU, wantH = () => (clk.h + clk.m / 60) / 12 * TAU;
    clk.aM = wantM(); clk.aH = wantH();
    const wrap = d => { d %= TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

    // ---------------------------------------------------------------- control console (two cranks + great lever + display)
    const KX = 6.4;
    box(KX, 0, Z(8), 0.9, 0.9, 3.2, darkWood, { solid: true, cam: false });
    box(KX, 0.9, Z(8), 1.0, 0.08, 3.3, brass);
    box(KX + 0.4, 0.98, Z(8), 0.08, 0.62, 1.7, iron);
    const dispTex = (() => { let dg = null; const t = canvasTex(256, 112, (g) => { dg = g; }); t.userData = { draw: () => {
      const g = dg, solved = found('r6-solved');
      g.fillStyle = solved ? '#0e2a1a' : '#0b1a1a'; g.fillRect(0, 0, 256, 112); g.strokeStyle = '#7dffc0'; g.lineWidth = 4; g.strokeRect(3, 3, 250, 106);
      g.textAlign = 'center'; g.fillStyle = '#7dffc0'; g.font = 'bold 18px Nunito, sans-serif'; g.fillText(solved ? 'BOILING TIME LOCKED' : 'BOILING TIME?', 128, 28);
      g.font = 'bold 54px Nunito, sans-serif'; g.fillText((clk.h === 0 ? 12 : clk.h) + ':' + String(clk.m).padStart(2, '0'), 128, 78);
      g.font = '14px Nunito, sans-serif'; g.fillStyle = '#a99fbf'; g.fillText('hour crank +1 h · minute crank +5 min', 128, 102);
      t.needsUpdate = true; } }; return t; })();
    plane(KX + 0.35, 1.28, Z(8), 1.6, 0.7, new THREE.MeshBasicMaterial({ map: dispTex }), -Math.PI / 2);
    dispTex.userData.draw();
    const lamp = ctx.light(5.6, 2.2, Z(8), 0x7dffc0, 3, 6, 0.1);

    function wheel(lz, color) {
      const g = new THREE.Group(); g.position.set(KX - 0.05, 0.98, Z(lz)); grp.add(g);
      cyl(0, 0, 0, 0.08, 0.14, iron, { g, seg: 8 });
      const w = new THREE.Group(); w.position.y = 0.16; g.add(w);
      const m = mat(color, { emissive: color, emissiveIntensity: 0.25 });
      cyl(0, 0, 0, 0.36, 0.05, m, { g: w, seg: 12 });
      box(0, 0.02, 0, 0.84, 0.05, 0.07, brass, { g: w }); box(0, 0.02, 0, 0.07, 0.05, 0.84, brass, { g: w });
      box(0.4, 0.02, 0, 0.07, 0.3, 0.07, brass, { g: w }); sph(0.4, 0.34, 0, 0.07, 0.07, 0.07, basic('#ffe9a8'), { g: w });
      return tween(v => { w.rotation.y = -v; }, 0, 8);
    }
    const hourWheel = wheel(6.75, '#ff7a1a'), minWheel = wheel(8.0, '#4ac0c0');
    // great lever
    const lvG = new THREE.Group(); lvG.position.set(KX - 0.05, 0.98, Z(9.3)); grp.add(lvG);
    box(-0.25, 0, -0.18, 0.5, 0.1, 0.36, iron, { g: lvG });
    const arm = new THREE.Group(); arm.position.y = 0.1; lvG.add(arm);
    box(-0.04, 0, -0.04, 0.08, 0.95, 0.08, brass, { g: arm }); sph(0, 1.0, 0, 0.14, 0.14, 0.14, mat('#e0384a', { emissive: '#e0384a', emissiveIntensity: 0.5 }), { g: arm });
    const lever = tween(v => { arm.rotation.z = -0.55 + v * 1.1; }, solved0 ? 1 : 0, 6);
    const labelH = () => 'Turn the hour crank (now ' + (clk.h === 0 ? 12 : clk.h) + ')';
    const labelM = () => 'Turn the minute crank (now :' + String(clk.m).padStart(2, '0') + ')';
    let busyFinale = false;
    const hourIt = interact({ x: 5.7, y: 1.1, z: Z(6.75), r: 1.0, label: labelH(), button: 'Turn', active: () => !found('r6-solved') && !busyFinale, run: async () => {
      clk.h = (clk.h + 1) % 12; hourWheel.to += Math.PI / 6; ctx.sfx('click'); hourIt.label = labelH(); dispTex.userData.draw();
    } });
    const minIt = interact({ x: 5.7, y: 1.1, z: Z(8.0), r: 1.0, label: labelM(), button: 'Turn', active: () => !found('r6-solved') && !busyFinale, run: async () => {
      clk.m = (clk.m + 5) % 60; minWheel.to += Math.PI / 6; ctx.sfx('click'); minIt.label = labelM(); dispTex.userData.draw();
    } });
    const levIt = interact({ x: 5.7, y: 1.1, z: Z(9.3), r: 1.0, label: 'Pull the great lever', button: 'Pull', active: () => !found('r6-solved') && !busyFinale, run: pullLever });
    interact({ x: 5.7, y: 1.1, z: Z(8.0), r: 1.0, label: 'Read the console', button: 'Read', active: () => found('r6-solved'), run: async () => {
      ctx.toast('The great clock is set. The tower is at peace... for now.');
    } });

    // ---------------------------------------------------------------- the bell altar (hidden compartment with the science card)
    const AX = -4.4, AZ = Z(12.6);
    box(AX, 0, AZ, 1.2, 1.1, 1.4, mat('#5a5568', { roughness: 0.7 }), { solid: true });
    box(AX, 1.1, AZ, 1.4, 0.12, 1.6, mat('#7a7588'));
    const panel = new THREE.Group(); panel.position.set(AX + 0.62, 0.1, AZ); grp.add(panel);
    box(0, 0, 0, 0.06, 0.9, 1.0, mat('#3a3548'), { g: panel }); box(0.04, 0.35, 0, 0.04, 0.12, 0.5, brass, { g: panel });
    const panelTw = tween(v => { panel.position.y = 0.1 - v * 0.92; }, solved0 ? 1 : 0, 3);
    // bell frame
    for (const dz of [-0.95, 0.95]) box(AX - 0.05, 0, AZ + dz, 0.12, 3.3, 0.12, wood);
    box(AX - 0.05, 3.2, AZ, 0.14, 0.14, 2.1, wood);
    const bellG = new THREE.Group(); bellG.position.set(AX, 3.2, AZ); grp.add(bellG);
    cyl(0, -0.15, 0, 0.1, 0.18, iron, { g: bellG, seg: 6 });
    sph(0, -0.75, 0, 0.44, 0.55, 0.44, brass, { g: bellG }); cyl(0, -1.28, 0, 0.58, 0.14, brass, { g: bellG, seg: 12 });
    sph(0, -1.34, 0, 0.1, 0.1, 0.1, iron, { g: bellG });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.15, 28), basic(0xffe9a8, { transparent: true, opacity: 0.0, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(AX, 0.04, AZ); grp.add(ring);
    const altarLight = ctx.light(AX + 0.3, 1.6, AZ, 0xffe9a8, solved0 ? 6 : 0, 9, 0.1);
    const cardFact = '<b>Boiling, melting and changes of state</b><br>At sea level, pure water <b>melts at 0 °C</b> and <b>boils at 100 °C</b>. While ice is melting or water is boiling, the temperature stays the <i>same</i> (a flat part on a heating graph) because the heat energy is used to change how the particles are arranged, not to speed them up. Boiling turns a liquid into a gas (steam). <small>(4.1.1 / 4.1.2 Properties of matter)</small>';
    const card = ctx.dataCard(AX + 0.05, 0.62, AZ - 0.1, { title: 'Science card: Changes of state', html: cardFact, hidden: !solved0 });
    const bonus = candy(AX + 0.35, 0.55, AZ + 0.3, 'r6-candy5', { hidden: !solved0 });
    // bell sways a little by itself, and shivers the first time you come close (spooky)
    let bellAmp = 0.04, bellSpooked = found('r6-spook-bell');
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.9 });

    // ---------------------------------------------------------------- kettle log posters (the readings)
    const POSTERS = [
      // [x, lz-or-null, wall, time]  wall: 'e' entry, 'l' left, 'r' right
      [-6.0, 0.36, 'e', '2:20'], [-3.6, 0.36, 'e', '2:40'], [3.6, 0.36, 'e', '2:05'], [6.0, 0.36, 'e', '2:30'],
      [-7.95, 2.2, 'l', '2:00'], [-7.95, 4.2, 'l', '2:35'], [-7.95, 11.0, 'l', '2:10'],
      [7.95, 2.4, 'r', '2:25'], [7.95, 4.2, 'r', '2:15'],
    ];
    POSTERS.forEach(([x, lz, wall, time], i) => {
      const tex = canvasTex(256, 340, (g, w, h) => {
        g.fillStyle = '#d8c9a0'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#5a3a20'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
        const deg = LOG[time];
        g.textAlign = 'center'; g.fillStyle = '#5a1a20'; g.font = 'bold 30px Nunito, sans-serif'; g.fillText('GHOST\'S KETTLE', w / 2, 44);
        g.fillStyle = '#e8e2d4'; g.beginPath(); g.arc(w / 2, 90, 26, Math.PI, 0); g.lineTo(w / 2 + 26, 118); g.lineTo(w / 2 + 13, 110); g.lineTo(w / 2, 118); g.lineTo(w / 2 - 13, 110); g.lineTo(w / 2 - 26, 118); g.closePath(); g.fill();
        g.fillStyle = '#222'; g.beginPath(); g.arc(w / 2 - 9, 86, 5, 0, 7); g.arc(w / 2 + 9, 86, 5, 0, 7); g.fill();
        g.fillStyle = '#2a1a10'; g.font = 'bold 20px Nunito, sans-serif'; g.fillText('Tower clock showed', w / 2, 154);
        g.font = 'bold 54px Nunito, sans-serif'; g.fillText(time, w / 2, 206);
        g.font = 'bold 20px Nunito, sans-serif'; g.fillText('Thermometer read', w / 2, 240);
        g.fillStyle = deg >= 100 ? '#b0202c' : deg <= 0 ? '#1f5fa8' : '#2a1a10'; g.font = 'bold 50px Nunito, sans-serif'; g.fillText(deg + ' °C', w / 2, 292);
        g.font = '15px Nunito, sans-serif'; g.fillStyle = '#6a5438'; g.fillText('Reading ' + (i + 1) + ' of 9', w / 2, 324);
      });
      const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.5 });
      const ry = wall === 'e' ? Math.PI : wall === 'l' ? Math.PI / 2 : -Math.PI / 2;
      const p = plane(x, 2.15, wall === 'e' ? Z(lz) : Z(lz), 1.1, 1.45, m, ry);
      p.rotation.z = ((i * 37) % 7 - 3) * 0.012;
    });
    ctx.light(0, 2.4, Z(1.5), 0xffd29a, 3, 8, 0.2);

    // ---------------------------------------------------------------- searchable helper
    function searchable(id, x, z, label, apply, after, o = {}) {
      const tw = tween(apply, found(id) ? 1 : 0, 6);
      interact({ x, y: o.y || 0.9, z, r: o.r || 1.7, label, button: 'Search', active: () => !found(id), run: async () => {
        mark(id); tw.to = 1; ctx.sfx(o.sound || 'door'); await after();
      } });
      return tw;
    }

    // --- 1. tool chest (left wall) with a hidden candy
    {
      const cx = -7.25, cz = Z(6.3);
      box(cx, 0, cz, 0.9, 0.55, 1.5, wood, { solid: true });
      box(cx + 0.46, 0.2, cz, 0.04, 0.12, 0.3, brass); box(cx, 0.1, cz - 0.55, 0.94, 0.08, 0.1, brass); box(cx, 0.1, cz + 0.55, 0.94, 0.08, 0.1, brass);
      const lid = new THREE.Group(); lid.position.set(cx - 0.45, 0.55, cz); grp.add(lid);
      box(0.45, 0, 0, 0.9, 0.2, 1.5, woodLt, { g: lid }); box(0.45, 0.2, 0, 0.9, 0.04, 0.2, brass, { g: lid });
      const c1 = candy(cx + 0.35, 0.95, cz, 'r6-candy1', { hidden: true });
      searchable('r6-chest', cx + 0.9, cz, 'Open the tool chest', v => { lid.rotation.z = v * 1.9; }, async () => {
        c1.reveal(); ctx.toast('Cogs, springs, and a wrapped sweet!');
      });
      if (found('r6-chest')) c1.reveal();
    }

    // --- 2. grandfather cabinet (right wall): a ghost pops out (the one scare in this room)
    const popGhost = new THREE.Group(), pg1 = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), ghostMat);
    pg1.scale.set(0.32, 0.4, 0.32); popGhost.add(pg1);
    for (const k of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), basic('#101018')); e.scale.set(0.06, 0.09, 0.05); e.position.set(-0.26, 0.08, k * 0.12); popGhost.add(e); }
    popGhost.visible = false; grp.add(popGhost);
    let ghostT = -1;
    const cabX = 7.4;
    {
      const kx = cabX, kz = Z(15.0);
      box(kx, 0, kz, 0.8, 2.4, 1.0, darkWood, { solid: true });
      box(kx - 0.45, 2.4, kz, 1.0, 0.25, 1.2, woodLt);
      plane(kx - 0.401, 1.0, kz, 0.8, 1.5, basic('#07050a'), -Math.PI / 2).position.y = 1.0;
      const dial = cyl(kx - 0.42, 2.0, kz, 0.3, 0.05, mat('#e6dcc0'), { seg: 14 }); dial.rotation.z = Math.PI / 2; dial.position.set(kx - 0.42, 2.0, kz);
      box(kx - 0.45, 2.0, kz, 0.04, 0.22, 0.04, handM); box(kx - 0.45, 2.0, kz, 0.04, 0.04, 0.16, handM);
      const door = new THREE.Group(); door.position.set(kx - 0.43, 0.25, kz + 0.47); grp.add(door);
      box(0, 0, -0.9, 0.06, 1.5, 0.9, woodLt, { g: door }); box(0.04, 0.6, -0.8, 0.04, 0.2, 0.06, brass, { g: door });
      // the door hinge is on the +z side of the cabinet; it extends toward -z and swings out into the room
      searchable('r6-cabinet', kx - 1.2, kz, 'Open the clock cabinet', v => { door.rotation.y = v * 1.9; }, async () => {
        ghostT = 0; popGhost.visible = true; popGhost.position.set(kx - 0.5, 1.2, kz); ctx.sfx('scare'); ctx.shake(0.25);
        await sleep(1700);
        ctx.toast('Boo! Just a tiny ghost on a spring. The cabinet is otherwise empty.');
      }, { y: 1.2 });
      if (found('r6-cabinet')) { /* already open; ghost stays gone */ }
    }

    // --- 3. crate stack with a candy on top (needs a jump)
    box(7.0, 0, Z(1.2), 1.2, 0.8, 1.2, wood, { solid: true }); box(7.0, 0.3, Z(1.2) - 0.61, 1.0, 0.06, 0.02, brass);
    box(7.2, 0.8, Z(1.2), 0.7, 0.55, 0.7, woodLt, { solid: true });
    candy(7.2, 1.75, Z(1.2), 'r6-candy2');

    // ---------------------------------------------------------------- decor in the main hall
    ctx.candelabra(-2.6, 0, Z(11.5), 6, true);
    ctx.candelabra(2.6, 0, Z(4.5), 6, true);

    // ---------------------------------------------------------------- the gear room (side room)
    const sr = ctx.sideRoom({ depth: 6, lz0: 10.3, lz1: 15.3, wall: ['brick', '#3a2c2a', '#4e3a34'], floor: ['wood', '#2a1c12', '#37251a'], light: 0xffc080 });
    const zb = Z(15.3), za = Z(10.3);
    // wall gears (spinning decor)
    const gears = [];
    function wallGear(x, y, z, r, teeth, speed) {
      const g = new THREE.Group(); g.position.set(x, y, z); grp.add(g);
      const b = cyl(0, 0, 0, r, 0.22, iron, { g, seg: 14 }); b.rotation.x = Math.PI / 2; b.position.y = 0;
      for (let i = 0; i < teeth; i++) { const a = i / teeth * TAU; const t = box(Math.cos(a) * (r + 0.1), Math.sin(a) * (r + 0.1), -0.11, 0.22, 0.22, 0.22, iron, { g }); t.rotation.z = a; }
      const hub2 = cyl(0, 0, 0, r * 0.3, 0.3, brass, { g, seg: 8 }); hub2.rotation.x = Math.PI / 2; hub2.position.y = 0;
      gears.push({ g, speed });
    }
    wallGear(10.2, 3.7, zb + 0.15, 1.1, 10, 0.5); wallGear(12.3, 4.1, zb + 0.15, 0.75, 7, -0.7);
    // portrait of the Clockmaker (eyes follow you)
    ctx.portrait(6, 14.42, 3.5, Z(12.6), -Math.PI / 2, 40);
    box(14.05, 0, Z(12.6), 0.8, 1.0, 1.6, wood, { solid: true });
    box(14.05, 1.0, Z(12.6), 0.9, 0.06, 1.7, woodLt);
    ctx.candle(14.1, 1.06, Z(12.6) + 0.55, 6, true, 0.22);
    const askCandy = candy(13.85, 1.4, Z(12.6) - 0.1, 'r6-candy4', { hidden: !found('r6-ask') });
    interact({ x: 13.1, y: 1.4, z: Z(12.6), r: 1.8, label: 'Talk to the Clockmaker\'s portrait', button: 'Talk', active: () => !found('r6-ask'), run: async () => {
      await ctx.note({ kicker: 'The portrait stirs', title: 'The Clockmaker', html: '<p class="clue">"Ah, a visitor. Answer me this about science and I will give you a sweet."</p><p>Wrong answers are fine: you can ask again any time.</p>', button: 'Okay' });
      const ok = await ctx.ask('The Clockmaker asks');
      if (ok) { mark('r6-ask'); askCandy.reveal(); ctx.sfx('correct'); ctx.toast('"Splendid! A sweet for you." A candy appears on the table.'); }
      else ctx.toast('"Hmm. Come back and try again whenever you like."');
    } });

    // workbench with two drawers (clue note in one, a candy in the other)
    const bx = 11.8, bz = zb + 0.45;
    box(bx, 0, bz, 2.7, 0.95, 0.9, darkWood, { solid: true }); box(bx, 0.95, bz, 2.9, 0.08, 1.0, woodLt);
    ctx.candle(13.0, 1.03, bz, 6, true, 0.2);
    box(10.7, 1.03, bz - 0.05, 0.5, 0.05, 0.38, mat('#d8c9a0'));
    function drawer(id, dx) {
      const g = new THREE.Group(); g.position.set(dx, 0.4, zb + 0.9); grp.add(g);
      box(0, 0, 0.03, 1.0, 0.38, 0.06, woodLt, { g }); box(0, 0.12, 0.08, 0.3, 0.07, 0.05, brass, { g });
      box(0, 0.02, -0.3, 0.9, 0.2, 0.6, wood, { g });
      return tween(v => { g.position.z = zb + 0.9 + v * 0.55; }, found(id) ? 1 : 0, 6);
    }
    const NOTE = () => ctx.note({ kicker: 'A note from the Clockmaker', title: 'The Clockmaker\'s rule', html:
      '<p class="clue">If you are reading this, you want to leave the tower. So did I.</p>' +
      '<p>I heated a kettle of ice. Nine kettle-log posters hang on the walls of the great hall. Each one shows the <b>time on the tower clock</b> and the <b>temperature</b> on my thermometer.</p>' +
      '<p>Find the time the water <b>FIRST reached 100 °C</b> (its boiling point). Set the great clock to that time, then pull the great lever. The bell will toll and the altar will open.</p>' +
      '<p class="clue">Tip: write the nine times in order, earliest first, and put the temperature next to each one. Look for the first 100 °C.</p>' +
      '<div class="card">Hour crank = +1 hour. Minute crank = +5 minutes.</div>', button: 'Got it' });
    const d1 = drawer('r6-drawer1', 11.2), d2 = drawer('r6-drawer2', 12.4);
    const dz = zb + 0.9 + 0.55 - 0.25;
    const c3 = candy(12.4, 0.8, dz, 'r6-candy3', { hidden: true });
    interact({ x: 11.2, y: 0.9, z: zb + 1.35, r: 1.3, label: 'Open the left drawer', button: 'Search', active: () => !found('r6-drawer1'), run: async () => {
      mark('r6-drawer1'); d1.to = 1; ctx.sfx('door'); await sleep(350); await NOTE(); mark('r6-note');
    } });
    interact({ x: 11.2, y: 0.9, z: zb + 1.35, r: 1.3, label: 'Read the Clockmaker\'s note again', button: 'Read', active: () => found('r6-drawer1'), run: async () => { await NOTE(); } });
    interact({ x: 12.4, y: 0.9, z: zb + 1.35, r: 0.9, label: 'Open the right drawer', button: 'Search', active: () => !found('r6-drawer2'), run: async () => {
      mark('r6-drawer2'); d2.to = 1; ctx.sfx('door'); c3.reveal(); ctx.toast('A sweet, rolling about among the screws.');
    } });
    if (found('r6-drawer2')) c3.reveal();

    // parts crate with a hinged lid (empty, funny line)
    {
      const cz = za - 0.55, cx = 13.2;
      box(cx, 0, cz, 1.3, 0.8, 0.9, wood, { solid: true }); box(cx, 0.3, cz - 0.46, 1.1, 0.06, 0.02, brass);
      const lid = new THREE.Group(); lid.position.set(cx, 0.8, za - 0.08); grp.add(lid);
      box(0, 0, -0.45, 1.3, 0.12, 0.9, woodLt, { g: lid });
      searchable('r6-crate', cx, cz - 1.0, 'Open the parts crate', v => { lid.rotation.x = v * 1.9; }, async () => {
        ctx.toast('One spring, one sock, and a note: "Time flies. Socks do not."');
      }, { r: 1.4 });
    }
    // shelf of old clock parts (decor) and a cuckoo clock that pops out (spooky)
    box(9.6, 1.6, za - 0.22, 1.8, 0.08, 0.4, woodLt);
    for (let i = 0; i < 4; i++) { const c = cyl(8.95 + i * 0.42, 1.68, za - 0.22, 0.14, 0.22, i % 2 ? brass : iron, { seg: 8 }); }
    const cuckX = 11.4, cuckY = 2.3, cuckZ = za - 0.22;
    box(cuckX, cuckY, cuckZ, 0.8, 0.9, 0.4, woodLt); box(cuckX, cuckY + 0.9, cuckZ, 1.0, 0.18, 0.5, darkWood);
    box(cuckX, cuckY + 0.45, cuckZ - 0.205, 0.26, 0.3, 0.02, basic('#07050a'));
    const bird = new THREE.Group(); bird.position.set(cuckX, cuckY + 0.5, cuckZ); grp.add(bird);
    sph(0, 0, 0, 0.1, 0.1, 0.1, mat('#e8e2d4'), { g: bird }); box(-0.05, -0.02, -0.1, 0.1, 0.05, 0.1, mat('#e0384a'), { g: bird });
    for (const k of [-1, 1]) sph(k * 0.05, 0.03, -0.08, 0.025, 0.03, 0.02, basic('#101018'), { g: bird });
    bird.visible = false;

    // ---------------------------------------------------------------- the great lever: check the answer, grand finale
    async function pullLever() {
      busyFinale = true; lever.to = 1; ctx.sfx('door'); await sleep(450);
      if (clk.h === ANSWER.h && clk.m === ANSWER.m) { await finale(); }
      else {
        ctx.sfx('wrong'); ctx.shake(0.3); clk.jitter = 1.4; redFlash = 1;
        const key = (clk.h === 0 ? 12 : clk.h) + ':' + String(clk.m).padStart(2, '0'), deg = LOG[key];
        const partly = clk.h === ANSWER.h || clk.m === ANSWER.m;
        ctx.toast(deg === 100 ? 'The hands shudder. At ' + key + ' the water was already boiling, but it reached 100 °C EARLIER. Find the first 100 °C reading.'
          : deg !== undefined ? 'The hands shudder. At ' + key + ' the water was only ' + deg + ' °C. Find the first 100 °C reading on the posters.'
          : partly ? 'The hands shudder. One of them feels right, but not both. Check the posters.' : 'The hands shudder and the gears grind. That is not on any poster. Find the first time the thermometer read 100 °C.');
        await sleep(900); lever.to = 0; busyFinale = false;
      }
    }
    let redFlash = 0, flashT = 0;
    const redL = ctx.light(0, 3.5, Z(8), 0xff3040, 0, 14, 0);
    async function finale() {
      mark('r6-solved'); dispTex.userData.draw();
      clk.spin = true; ctx.sfx('unlock'); ctx.shake(0.2);
      await sleep(1600); clk.spin = false;
      for (let i = 0; i < 3; i++) {
        bellAmp = 0.7; flashT = 1; ctx.shake(0.45); ctx.sfx(i < 2 ? 'door' : 'win');
        ctx.toast(['BONG...', 'BONG...', 'BONG!'][i]);
        await sleep(1250);
      }
      panelTw.to = 1; ctx.sfx('unlock'); altarLight.i = 6; ring.material.opacity = 0.7;
      card.reveal(); bonus.reveal();
      await ctx.note({ kicker: 'The great bell has tolled', title: 'The altar opens!', html:
        '<p>The water first reached <b>100 °C</b> at <b>2:30</b>. That is the <b>boiling point</b> of water, and the temperature stayed at 100 °C while it boiled. The ghost is satisfied.</p>' +
        '<p class="clue">A hidden compartment in the bell altar has slid open. Look inside for a science card and a sweet.</p>' +
        '<p>Then head to the lock terminal by the far door. Nearly there!</p>', button: 'On with it' });
      busyFinale = false;
    }

    // ---------------------------------------------------------------- per-frame animation
    let cuckT = 0, cuckState = 0;
    const nearAltar = () => { const p = ctx.player(); return Math.hypot(p.x - AX, p.z - AZ) < 4.2; };
    onFrame((t, dt) => {
      // tweens
      for (const w of tws) if (w.v !== w.to) { const d = w.to - w.v; w.v = Math.abs(d) < 0.001 ? w.to : w.v + d * Math.min(1, dt * w.k); w.apply(w.v); }
      // clock hands
      if (clk.spin) { clk.aM += dt * 14; clk.aH += dt * 1.2; }
      else {
        clk.aM += wrap(wantM() - clk.aM) * Math.min(1, dt * 5); clk.aH += wrap(wantH() - clk.aH) * Math.min(1, dt * 5);
      }
      const jx = clk.jitter > 0 ? Math.sin(t * 60) * 0.08 * clk.jitter : 0; if (clk.jitter > 0) clk.jitter = Math.max(0, clk.jitter - dt);
      minute.rotation.z = -(clk.aM + jx); hour.rotation.z = -(clk.aH - jx * 0.6);
      // lamp, red alarm flash, bell flash
      lamp.i = 3 + Math.sin(t * 3) * 0.4;
      if (redFlash > 0) { redFlash = Math.max(0, redFlash - dt * 1.4); redL.i = redFlash * 10 * (0.5 + 0.5 * Math.sin(t * 30)); } else redL.i = 0;
      if (flashT > 0) { flashT = Math.max(0, flashT - dt * 1.2); altarLight.i = 6 + flashT * 14; }
      // bell
      if (!bellSpooked && !found('r6-solved') && nearAltar()) { bellSpooked = true; mark('r6-spook-bell'); bellAmp = 0.6; ctx.sfx('tick'); ctx.toast('The old bell shivers by itself...'); }
      bellAmp += (0.04 - bellAmp) * Math.min(1, dt * 0.7);
      bellG.rotation.z = Math.sin(t * 4.2) * bellAmp;
      if (ring.material.opacity > 0) { ring.rotation.z = t * 0.5; ring.material.opacity = 0.5 + Math.sin(t * 3) * 0.2; }
      // wall gears
      for (const g of gears) g.g.rotation.z = t * g.speed;
      // popped ghost
      if (ghostT >= 0) {
        ghostT += dt; const s = Math.min(1, ghostT * 5);
        popGhost.scale.setScalar(s); popGhost.position.x = cabX - 0.5 - ghostT * 0.7; popGhost.position.y = 1.2 + ghostT * 0.5 + Math.sin(ghostT * 9) * 0.05;
        ghostMat.opacity = ghostT > 1.3 ? Math.max(0, 0.9 - (ghostT - 1.3) * 1.3) : 0.9;
        if (ghostT > 2.4) { popGhost.visible = false; ghostT = -1; }
      }
      // cuckoo: pops out when you are in the gear room
      const p = ctx.player();
      if (p.x > sr.x0 && p.x < sr.x1 && p.z > sr.z0 && p.z < sr.z1) {
        cuckT += dt;
        if (cuckState === 0 && cuckT > 5) { cuckState = 1; cuckT = 0; bird.visible = true; ctx.sfx('tick'); }
        else if (cuckState === 1) {
          bird.position.z = cuckZ - Math.min(1, cuckT * 4) * 0.3; bird.rotation.z = Math.sin(cuckT * 18) * 0.25;
          if (cuckT > 1.6) { cuckState = 0; cuckT = 0; bird.visible = false; bird.position.z = cuckZ; }
        }
      }
    });
    // restore finished state
    if (solved0) { ring.material.opacity = 0.7; }
  },
};
