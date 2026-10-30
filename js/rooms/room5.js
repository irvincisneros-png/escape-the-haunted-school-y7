// Room 5 (Cellar) extras: see ROOMS.md.
// Puzzle (Year 7 Cells, 3.2): read the Night Watchman's plant cell diagram (in the crypt coffin), pull the three
// cell-part levers from the OUTSIDE of the cell inward (cell wall, cytoplasm, nucleus) -> the generator by the
// entrance wakes up -> arcade powered (+ science card hatch).
// Side room: a crypt through the right wall. Searchables: tool chest, barrel, 2 workbench drawers, 2 coffins.
export default {
  side: { side: 1, lz: 6.4, w: 2.2 },
  powerHint: 'The arcade has no power. The generator by the cellar entrance needs its three levers pulled in the right order. Find the cell diagram!',
  build(ctx) {
    const { THREE, box, cyl, sph, plane, mat, tmat, canvasTex, state } = ctx;
    const rz = ctx.rz, G = ctx.group(), sfx = ctx.sfx, toast = ctx.toast;
    const ease = u => u * u * (3 - 2 * u);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const ticks = [], timers = [], opens = [], resets = [];
    const later = (sec, fn) => timers.push({ t: sec, fn });

    // shared materials
    const iron = mat('#1c1c22', { metalness: 0.6, roughness: 0.5 });
    const woodD = mat('#4a2e16'), woodL = tmat('wood', '#6a4a26', '#5a3c1e', 1, 1);
    const stoneM = mat('#4a4452', { roughness: 0.9 }), stoneL = mat('#5e5868', { roughness: 0.9 });
    const dark = mat('#08060a'), bone = mat('#d8cfb8', { roughness: 0.8 });
    const bottleM = mat('#1f4a2a', { emissive: '#08200f', roughness: 0.3 });

    // generic opener: apply(e) gets an eased 0..1
    function openable(apply) {
      const o = { t: 0, target: 0 };
      o.set = (v, inst) => { o.target = v ? 1 : 0; if (inst) { o.t = o.target; apply(ease(o.t)); } };
      o.apply = apply; opens.push(o); return o;
    }

    // ------------------------------------------------------------------ skeleton builder
    function skeleton(g, eyeMat, sitting) {
      box(0, 0, 0, 0.32, 0.16, 0.2, bone, { g });
      box(0, 0.16, 0, 0.07, 0.28, 0.07, bone, { g });
      for (const y of [0.22, 0.38]) box(0, y, 0, 0.38, 0.05, 0.22, bone, { g });
      box(0, 0.5, 0, 0.5, 0.06, 0.1, bone, { g });
      for (const s of [-1, 1]) box(s * 0.27, 0.1, 0, 0.07, 0.44, 0.07, bone, { g });
      if (sitting) for (const s of [-1, 1]) { box(s * 0.1, 0, 0.2, 0.09, 0.09, 0.4, bone, { g }); box(s * 0.1, 0, 0.4, 0.08, 0.4, 0.08, bone, { g }); }
      const head = new THREE.Group(); head.position.set(0, 0.62, 0); g.add(head);
      box(0, 0.02, 0, 0.3, 0.26, 0.26, bone, { g: head });
      for (const s of [-1, 1]) box(s * 0.07, 0.17, 0.135, 0.07, 0.07, 0.02, eyeMat, { g: head });
      box(0, 0.09, 0.135, 0.04, 0.05, 0.02, dark, { g: head });
      const jaw = new THREE.Group(); jaw.position.set(0, 0.04, 0.02); head.add(jaw);
      box(0, -0.05, 0, 0.22, 0.06, 0.2, bone, { g: jaw });
      return { head, jaw };
    }

    // ------------------------------------------------------------------ GENERATOR (by the entrance, right wall)
    const gz = rz(1.0), gx = 7.0;
    const genMat = mat('#3a4a3a', { roughness: 0.6, metalness: 0.3 });
    box(gx, 0, gz, 1.4, 1.4, 1.4, genMat, { solid: true, cast: true });
    box(gx, 1.4, gz, 1.5, 0.1, 1.5, iron);
    cyl(gx + 0.35, 1.5, gz - 0.35, 0.1, 1.3, iron, { seg: 6 });
    const fw = new THREE.Group(); fw.position.set(6.27, 0.85, gz); fw.rotation.y = Math.PI / 2; G.add(fw);
    const spin = new THREE.Group(); fw.add(spin);
    spin.add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 5, 12), iron));
    box(0, -0.3, 0, 0.07, 0.6, 0.07, iron, { g: spin }); box(-0.3, -0.035, 0, 0.6, 0.07, 0.07, iron, { g: spin });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xe0384a });
    sph(6.25, 1.2, gz + 0.45, 0.07, 0.07, 0.07, lampMat);
    const genTex = canvasTex(160, 56, (c, w, h) => {
      c.fillStyle = '#16102a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ff7a1a'; c.lineWidth = 3; c.strokeRect(3, 3, w - 6, h - 6);
      c.fillStyle = '#ff7a1a'; c.textAlign = 'center'; c.font = 'bold 22px Nunito, sans-serif'; c.fillText('GENERATOR', w / 2, 27);
      c.fillStyle = '#f3ead8'; c.font = 'bold 14px Nunito, sans-serif'; c.fillText('needs 3 levers', w / 2, 46);
    });
    plane(6.29, 1.15, gz - 0.2, 0.7, 0.25, new THREE.MeshBasicMaterial({ map: genTex }), -Math.PI / 2);
    // hatch (opens when powered; the science card is behind it)
    const hatch = new THREE.Group(); hatch.position.set(6.3, 0.15, rz(1.0 + 0.35)); G.add(hatch);
    box(-0.03, 0, 0.3, 0.06, 0.55, 0.6, mat('#2a3a2a'), { g: hatch });
    box(-0.07, 0.25, 0.5, 0.04, 0.06, 0.12, iron, { g: hatch });
    // NOTE: hatch panel extends toward -z (increasing lz), hinge on the edge nearest the entry
    const hatchO = openable(e => { hatch.rotation.y = -e * 1.9; });
    const genLight = ctx.light(5.6, 1.6, gz, 0xe0384a, 1.2, 5, 0.3);
    const card = ctx.dataCard(5.85, 0.95, gz - 0.2, {
      title: 'Science card: Plant and animal cells',
      html: '<p><b>All living things are made of cells</b>, and every cell comes from another cell (cell theory).</p><p>Plant AND animal cells both have a <b>cell membrane</b>, <b>cytoplasm</b>, a <b>nucleus</b> (which holds the DNA) and <b>mitochondria</b>. Only plant cells also have a <b>cell wall</b> and <b>chloroplasts</b>, where photosynthesis happens. <i>(3.2.2 / 3.2.4 Cells)</i></p>',
      hidden: !state.isFound('r5-gen'),
    });

    // ------------------------------------------------------------------ LEVERS
    const ORDER = ['wall', 'cytoplasm', 'nucleus'];       // outside -> inside of a plant cell
    const HINTS = ['Start with the part on the very OUTSIDE of a plant cell.', 'Next comes the jelly-like part that fills the cell, inside the wall and membrane.', 'Last is the control centre in the middle that holds the DNA.'];
    const LV = {}; let seq = [], solved = state.isFound('r5-gen'), blocked = false;
    function lever(key, label, hex, xw, y, lz, ry, dir, glowLight) {
      const z = rz(lz), g = new THREE.Group(); g.position.set(xw, y, z); g.rotation.y = ry; G.add(g);
      box(0, -0.5, 0.05, 0.5, 0.85, 0.1, iron, { g });
      box(0, -0.35, 0.11, 0.07, 0.7, 0.02, dark, { g });
      sph(0, 0, 0.14, 0.08, 0.08, 0.08, iron, { g });
      const arm = new THREE.Group(); arm.position.set(0, 0, 0.15); g.add(arm);
      box(0, 0, 0, 0.06, 0.55, 0.06, iron, { g: arm });
      const bm = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.7, roughness: 0.4 });
      sph(0, 0.6, 0, 0.11, 0.11, 0.11, bm, { g: arm });
      const tex = canvasTex(128, 44, (c, w, h) => {
        c.fillStyle = '#16102a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#' + hex.toString(16).padStart(6, '0'); c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
        c.fillStyle = c.strokeStyle; c.textAlign = 'center'; c.font = 'bold ' + (label.length > 7 ? 19 : 26) + 'px Nunito, sans-serif'; c.fillText(label, w / 2, 31);
      });
      plane(0, -0.78, 0.03, 0.8, 0.28, new THREE.MeshBasicMaterial({ map: tex }), 0, { g });
      if (glowLight) ctx.light(xw + dir * 0.8, y + 0.6, z, hex, 2.5, 4, 0.12);
      const L = { key, arm, bm, down: false };
      L.o = openable(e => { arm.rotation.z = 0.25 + e * 2.65; bm.emissiveIntensity = 0.7 + e * 0.8; });
      LV[key] = L;
      ctx.interact({
        x: xw + dir * 0.65, y, z, r: 1.7, label: 'Pull the ' + label.toLowerCase() + ' lever', button: 'Pull',
        active: () => !solved,
        run: () => pull(key),
      });
    }
    function setLevers(down, inst) { for (const k of ORDER) { LV[k].down = down; LV[k].o.set(down, inst); } }
    function pull(key) {
      if (solved || blocked) return;
      const L = LV[key];
      if (L.down) { toast('That lever is already pulled down.'); return; }
      L.down = true; L.o.set(true); sfx('click');
      seq.push(key);
      if (key !== ORDER[seq.length - 1]) {
        blocked = true; sfx('wrong'); ctx.shake(0.35);
        toast('Wrong order! Sparks fly and the levers clank back up. Hint: ' + HINTS[seq.length - 1]);
        later(1.1, () => { setLevers(false); seq = []; blocked = false; sfx('door'); });
      } else if (seq.length === 3) {
        solve();
      } else {
        toast('Clunk. Something deep inside the walls shifts. ' + seq.length + ' of 3.');
      }
    }
    // power-up surge
    let surge = -1;
    function solve() {
      solved = true; state.markFound('r5-gen'); state.powerArcade(5);
      toast('The levers lock down. Something big groans awake...');
      sfx('launch'); surge = 0;
    }
    function genOn(inst) {
      lampMat.color.setHex(0x7dff6a); genLight.color.set(0x7dff6a); genLight.i = 3;
      hatchO.set(true, inst);
    }
    lever('nucleus', 'NUCLEUS', 0xb48cff, -7.97, 1.5, 11.9, Math.PI / 2, 1, true);
    lever('wall', 'CELL WALL', 0x7dff6a, 7.97, 1.5, 9.8, -Math.PI / 2, -1, false);
    // (cytoplasm lever lives in the crypt, added below)
    ctx.interact({
      x: 5.7, y: 1.0, z: gz, r: 1.9, label: 'Inspect the generator', button: 'Look',
      active: () => !solved,
      run: () => {
        const n = seq.length;
        toast('A dead generator with three empty lever sockets. The levers are somewhere in this cellar... ' + (n ? n + ' pulled so far.' : ''));
      },
    });
    let spin_v = 0;
    ticks.push((t, dt) => {
      if (surge >= 0) {
        surge += dt;
        ctx.shake(0.16);
        genLight.i = 1 + Math.random() * 6; spin_v = Math.min(14, spin_v + dt * 8);
        if (surge > 3.2) {
          surge = -1; sfx('unlock'); sfx('correct'); genOn(false); card.reveal();
          toast('The generator roars to life! A hatch pops open, and the arcade on the high ledge has power.');
        }
      } else if (solved) { spin_v = 9; genLight.i = 3 + Math.sin(t * 22) * 0.5; }
      spin.rotation.z += spin_v * dt;
    });

    // ------------------------------------------------------------------ TOOL CHEST (left wall)
    {
      const cx = -7.4, cz = rz(5.0);
      box(cx, 0, cz, 0.9, 0.5, 1.2, woodL, { solid: true });
      box(cx, 0.18, cz, 0.94, 0.06, 1.24, iron);
      const lid = new THREE.Group(); lid.position.set(-7.85, 0.5, cz); G.add(lid);
      box(0.45, 0, 0, 0.9, 0.18, 1.2, woodL, { g: lid }); box(0.45, 0.18, 0, 0.1, 0.04, 1.24, iron, { g: lid });
      const o = openable(e => { lid.rotation.z = e * 1.65; });
      const cd = ctx.candy(cx, 0.95, cz, 'r5-candy2', { hidden: true });
      search('r5-chest', cx + 0.9, 0.6, cz, 'Open the chest', o, () => { cd.reveal(); toast('Creeeak! Something sweet inside.'); sfx('key'); }, () => cd.reveal());
    }
    // generic search wiring: id, interact point, animation, on first open, on restore
    function search(id, x, y, z, label, anim, first, restore, r = 1.6) {
      ctx.interact({
        x, y, z, r, label, button: 'Search', active: () => !state.isFound(id),
        run: () => { state.markFound(id); anim.set(true); sfx('door'); first(); },
      });
      if (state.isFound(id)) { anim.set(true, true); if (restore) restore(); }
    }

    // ------------------------------------------------------------------ BARREL (left, near the lever)
    {
      const bx = -6.9, bz = rz(13.6);
      cyl(bx, 0, bz, 0.5, 0.95, woodD, { solid: true, seg: 10, cast: true });
      for (const by of [0.15, 0.7]) cyl(bx, by, bz, 0.53, 0.07, iron, { seg: 10 });
      const lid = new THREE.Group(); lid.position.set(bx + 0.5, 0.96, bz); G.add(lid);
      cyl(-0.5, 0, 0, 0.5, 0.05, woodL, { g: lid, seg: 10 });
      const o = openable(e => { lid.rotation.z = -e * 1.9; });
      const cd = ctx.candy(bx, 1.45, bz, 'r5-candy3', { hidden: true });
      search('r5-barrel', bx + 1.0, 0.8, bz, 'Look inside the barrel', o, () => { cd.reveal(); toast('The lid flips off. Smells like pickles... and a sweet!'); sfx('key'); }, () => cd.reveal(), 1.4);
    }

    // ------------------------------------------------------------------ WORKBENCH with two drawers (right wall)
    {
      const wx = 7.35;
      box(wx, 0, rz(13.3), 1.0, 0.9, 1.8, woodL, { solid: true });
      box(wx, 0.9, rz(13.3), 1.1, 0.06, 1.9, woodD);
      ctx.candle(7.3, 0.96, rz(12.7), 5, false, 0.18);
      ctx.light(6.6, 1.6, rz(12.9), 0xffa850, 2.2, 4.5, 0.4);
      const mk = (lz, id, text) => {
        const g = new THREE.Group(); g.position.set(6.85, 0.5, rz(lz)); G.add(g);
        box(-0.03, -0.15, 0, 0.08, 0.3, 0.7, woodD, { g }); box(-0.08, 0, 0, 0.04, 0.05, 0.2, iron, { g });
        box(0.25, -0.17, 0, 0.5, 0.04, 0.66, woodD, { g });
        const o = openable(e => { g.position.x = 6.85 - e * 0.55; });
        search(id, 6.2, 0.8, rz(lz), 'Open the drawer', o, () => toast(text), null, 1.0);
      };
      mk(12.85, 'r5-drawer1', 'Only cobwebs and one very confused spider. He waves at you politely.');
      mk(13.75, 'r5-drawer2', 'A sticky note: "Generator by the entrance. Three levers obey the Watchman\'s cell diagram, which he hid in the crypt. Mind the coffins!"');
    }

    // ------------------------------------------------------------------ SKELETON IN THE CAGE (ask moment) + candy
    const eyeDim = new THREE.MeshBasicMaterial({ color: 0x552200 });
    const cageSk = new THREE.Group(); cageSk.position.set(-7.72, 0.05, rz(2.1)); cageSk.rotation.y = Math.PI / 2; G.add(cageSk);
    const sk = skeleton(cageSk, eyeDim, true);
    const skCandy = ctx.candy(-6.65, 1.0, rz(2.1), 'r5-candy5', { hidden: true });
    if (state.isFound('r5-skel')) skCandy.reveal();
    let skTalk = 0;
    ctx.interact({
      x: -6.5, y: 1.0, z: rz(2.1), r: 1.7, label: 'Talk to the skeleton', button: 'Talk',
      active: () => true,
      run: async () => {
        skTalk = 1.4; sfx('flap');
        if (state.isFound('r5-skel')) { toast('The skeleton rattles: "You already took my sweet. Go away... or come back for a chat."'); return; }
        const ok = await ctx.ask('The skeleton in the cage rattles: "Answer my question and I will pass you a sweet!"');
        if (ok) { state.markFound('r5-skel'); skCandy.reveal(); sfx('correct'); skTalk = 1.6; toast('"Hee hee, correct!" The skeleton slides a sweet through the bars.'); }
        else { sfx('wrong'); toast('"Wrong, wrong, wrong!" he cackles. "Try me again, I never get visitors."'); }
      },
    });
    ticks.push((t, dt, p) => {
      const dx = p.x + 7.72, dz = p.z - rz(2.1), d = Math.hypot(dx, dz);
      let yaw = 0;
      if (d < 7) { yaw = Math.atan2(p.x - cageSk.position.x, p.z - cageSk.position.z) - Math.PI / 2; yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw)); yaw = clamp(yaw, -1.1, 1.1); }
      sk.head.rotation.y += (yaw - sk.head.rotation.y) * Math.min(1, dt * 4);
      eyeDim.color.setHex(d < 4.5 ? 0xffb347 : 0x552200);
      if (skTalk > 0) { skTalk -= dt; sk.jaw.rotation.x = Math.abs(Math.sin(t * 20)) * 0.35; cageSk.position.x = -7.72 + Math.sin(t * 50) * 0.01; }
      else { sk.jaw.rotation.x *= 0.8; if (d < 4.5) sk.head.rotation.x = Math.sin(t * 1.3) * 0.05; }
    });

    // ------------------------------------------------------------------ CRATE-TOP CANDY (needs a jump)
    ctx.candy(3.0, 2.15, rz(3.2), 'r5-candy1');

    // ------------------------------------------------------------------ WATCHING EYES (they vanish when you approach)
    {
      const eyeM = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
      const spots = [[-7.5, 1.55, rz(15.55)], [7.5, 1.9, rz(15.55)]];
      const eg = new THREE.Group(); G.add(eg);
      for (const s of [-1, 1]) sph(s * 0.12, 0, 0, 0.05, 0.07, 0.04, eyeM, { g: eg });
      let at = 0, hideT = 0, nextBlink = 2, wasNear = false;
      eg.position.set(spots[0][0], spots[0][1], spots[0][2]);
      ticks.push((t, dt, p) => {
        const d = Math.hypot(p.x - eg.position.x, p.z - eg.position.z);
        if (hideT > 0) {
          hideT -= dt; eg.visible = false;
          if (hideT <= 0) {
            const other = spots[1 - at];
            if (Math.hypot(p.x - other[0], p.z - other[2]) > 7) { at = 1 - at; eg.position.set(other[0], other[1], other[2]); eg.visible = true; }
            else hideT = 0.5;
          }
          return;
        }
        if (d < 4.5) { eg.visible = false; hideT = 3; sfx('whoosh'); wasNear = true; return; }
        if (t > nextBlink) { eg.visible = !eg.visible; nextBlink = t + (eg.visible ? 2 + Math.random() * 3 : 0.15); }
      });
    }

    // ------------------------------------------------------------------ CRYPT (side room, right wall)
    const b = ctx.sideRoom({ depth: 6, lz0: 3.6, lz1: 9.2, wall: ['brick', '#5a4a52', '#221a20'], floor: ['stone', '#4e4a56', '#1c1a20'], light: 0x9a7aff });
    // candle stands by the door (they get snuffed once by a cold draught)
    const standFlames = [];
    for (const lz of [4.9, 7.9]) {
      cyl(9.2, 0, rz(lz), 0.1, 0.9, iron, { seg: 6 }); cyl(9.2, 0.9, rz(lz), 0.05, 0.22, mat('#efe3c4'), { seg: 6 });
      standFlames.push(ctx.flame(9.2, 1.2, rz(lz), 1.2));
    }
    const candleLight = ctx.light(9.6, 1.7, rz(6.4), 0xffa850, 3.5, 7, 0.35);
    let snuffed = false, snuffT = -1;
    ticks.push((t, dt, p) => {
      if (!snuffed && p.x > 9.8 && p.z < rz(3.6) && p.z > rz(9.2)) {
        snuffed = true; snuffT = 0; sfx('whoosh'); toast('A cold draught snuffs out the candles...');
        for (const f of standFlames) f.visible = false; candleLight.i = 0;
      }
      if (snuffT >= 0) {
        snuffT += dt;
        if (snuffT > 1.6) { snuffT = -1; for (const f of standFlames) f.visible = true; candleLight.i = 3.5; toast('...and they flicker back on by themselves.'); }
      }
    });

    // coffin factory
    function coffin(lz, id) {
      const cx = 11.6, cz = rz(lz);
      box(cx, 0, cz, 2.4, 0.7, 1.0, stoneM, { solid: true });
      box(cx, 0.7, cz, 2.0, 0.01, 0.6, dark);
      const lid = new THREE.Group(); lid.position.set(cx, 0.71, cz); G.add(lid);
      box(0, 0, 0, 2.4, 0.16, 1.0, stoneL, { g: lid }); box(0, 0.16, 0, 1.4, 0.03, 0.1, stoneM, { g: lid }); box(-0.4, 0.16, 0, 0.1, 0.03, 0.5, stoneM, { g: lid });
      const o = openable(e => { lid.position.x = cx - e * 1.25; lid.rotation.y = -e * 0.3; });
      o.lid = lid; o.cx = cx; o.cz = cz; return o;
    }
    // coffin 1: the plant cell diagram clue
    const lab = (x, y, t, anchor = 'start') => '<text x="' + x + '" y="' + y + '" fill="#f3ead8" font-size="12" font-weight="700" text-anchor="' + anchor + '">' + t + '</text>';
    const chartHtml = '<p class="clue">The generator wakes only if the levers are pulled in order from the OUTSIDE of a plant cell to the INSIDE. Get it wrong and every lever springs back up!</p>'
      + '<svg viewBox="0 0 340 230" width="100%" style="max-width:430px;background:#120d1c;border:1px solid #3a2d52;border-radius:10px" role="img" aria-label="Diagram of a plant cell with its parts labelled">'
      + '<rect x="30" y="30" width="200" height="170" rx="10" fill="#2f6b2a" stroke="#7dff6a" stroke-width="3"/>'
      + '<rect x="40" y="40" width="180" height="150" rx="8" fill="#6b8f4a" stroke="#d8cfb8" stroke-width="1.5"/>'
      + '<rect x="46" y="46" width="168" height="138" rx="6" fill="#c8e0a8" fill-opacity=".55"/>'
      + '<circle cx="130" cy="115" r="30" fill="#b48cff" stroke="#f3ead8" stroke-width="2"/><circle cx="130" cy="115" r="9" fill="#5a3a9a"/>'
      + '<ellipse cx="75" cy="75" rx="13" ry="7" fill="#3fae3a"/><ellipse cx="185" cy="160" rx="13" ry="7" fill="#3fae3a"/>'
      + '<line x1="230" y1="40" x2="262" y2="40" stroke="#a99fbf"/>' + lab(266, 44, 'Cell wall')
      + '<line x1="220" y1="62" x2="262" y2="70" stroke="#a99fbf"/>' + lab(266, 74, 'Cell membrane')
      + '<line x1="200" y1="100" x2="262" y2="104" stroke="#a99fbf"/>' + lab(266, 108, 'Cytoplasm')
      + '<line x1="160" y1="125" x2="262" y2="138" stroke="#a99fbf"/>' + lab(266, 142, 'Nucleus')
      + '<line x1="198" y1="163" x2="262" y2="172" stroke="#a99fbf"/>' + lab(266, 176, 'Chloroplast')
      + '<text x="130" y="218" fill="#a99fbf" font-size="11" text-anchor="middle">A plant cell</text></svg>'
      + '<p style="margin-top:8px">Each lever in the cellar is marked with a cell part and its colour: <b style="color:#7dff6a">Cell wall</b>, <b style="color:#ff7a1a">Cytoplasm</b>, <b style="color:#b48cff">Nucleus</b>. Start at the outside edge of the cell and move inwards, skipping any part that has no lever.</p>';
    const readChart = () => ctx.note({ kicker: 'Torn page from the Night Watchman', title: 'The Watchman\'s Cell Diagram', html: chartHtml, button: 'Got it' });
    const c1 = coffin(4.5, 'r5-coffin1');
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.4), new THREE.MeshBasicMaterial({
      map: canvasTex(110, 80, (c, w, h) => {
        c.fillStyle = '#d9c9a0'; c.fillRect(0, 0, w, h); c.fillStyle = '#7a5a3a';
        c.strokeStyle = '#7a5a3a'; c.lineWidth = 4; c.strokeRect(14, 10, 82, 58); c.beginPath(); c.arc(55, 39, 12, 0, 7); c.fill();
      }),
    }));
    paper.rotation.x = -Math.PI / 2; paper.position.set(12.4, 0.73, rz(4.5)); paper.visible = false; G.add(paper);
    ctx.interact({
      x: 11.6, y: 0.9, z: rz(5.55), r: 1.6, label: 'Open the coffin', button: 'Open',
      active: () => !state.isFound('r5-coffin1'),
      run: () => { state.markFound('r5-coffin1'); c1.set(true); sfx('door'); paper.visible = true; later(0.9, readChart); },
    });
    ctx.interact({
      x: 11.6, y: 0.9, z: rz(5.55), r: 1.6, label: 'Read the Watchman\'s cell diagram', button: 'Read',
      active: () => state.isFound('r5-coffin1'), run: readChart,
    });
    if (state.isFound('r5-coffin1')) { c1.set(true, true); paper.visible = true; }

    // coffin 2: rattles as you pass, a skeleton sits up when opened (funny, not a scare)
    const c2 = coffin(8.3, 'r5-coffin2');
    const popSk = new THREE.Group(); popSk.position.set(11.9, -0.4, rz(8.3)); G.add(popSk);
    const popEye = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    const pk = skeleton(popSk, popEye, false);
    let popT = -1;
    ctx.interact({
      x: 11.6, y: 0.9, z: rz(7.4), r: 1.4, label: 'Open the coffin', button: 'Open',
      active: () => !state.isFound('r5-coffin2'),
      run: () => {
        state.markFound('r5-coffin2'); c2.set(true); sfx('door'); popT = 0;
        later(0.9, () => { sfx('whoosh'); toast('A skeleton sits up: "Is it Halloween already? Sorry, wrong coffin!" He lies back down.'); });
      },
    });
    if (state.isFound('r5-coffin2')) c2.set(true, true);
    ticks.push((t, dt, p) => {
      if (popT >= 0) {
        popT += dt;
        const u = popT < 0.8 ? 0 : popT < 1.4 ? (popT - 0.8) / 0.6 : popT < 3.2 ? 1 : popT < 3.9 ? 1 - (popT - 3.2) / 0.7 : 0;
        popSk.position.y = -0.4 + ease(clamp(u, 0, 1)) * 0.95;
        if (popT > 0.8 && popT < 0.85) ctx.shake(0.2);
        if (u > 0.9) { const yaw = Math.atan2(p.x - popSk.position.x, p.z - popSk.position.z); pk.head.rotation.y = clamp(yaw, -1.2, 1.2); }
        if (popT > 4.2) popT = -1;
      } else if (!state.isFound('r5-coffin2')) {
        const d = Math.hypot(p.x - 11.6, p.z - c2.cz);
        if (d < 3.2 && Math.sin(t * 2.3) > 0.7) { c2.lid.position.x = 11.6 + Math.sin(t * 60) * 0.025; c2.lid.rotation.y = Math.sin(t * 47) * 0.015; }
        else { c2.lid.position.x = 11.6; c2.lid.rotation.y = 0; }
      }
    });

    // wine racks along the end wall. Rack A: jump on it for a candy. Rack B: a dusty bottle with a ghost in it.
    {
      const rackM = mat('#3a2412');
      box(13.85, 0, rz(4.5), 1.1, 1.2, 1.6, rackM, { solid: true });
      for (const y of [0.35, 0.8]) for (const lz of [4.0, 4.5, 5.0]) box(13.12, y, rz(lz), 0.4, 0.12, 0.12, bottleM);
      ctx.candy(14.1, 1.7, rz(4.5), 'r5-candy4');
      box(13.85, 0, rz(8.4), 1.1, 2.3, 1.8, rackM, { solid: true, cam: true });
      for (const y of [0.4, 1.5]) for (const lz of [7.9, 8.9]) box(13.12, y, rz(lz), 0.4, 0.12, 0.12, bottleM);
      const dusty = new THREE.Group(); dusty.position.set(13.1, 1.0, rz(8.4)); G.add(dusty);
      box(0, -0.07, 0, 0.5, 0.15, 0.15, mat('#1b3a28', { emissive: '#0c3a18', emissiveIntensity: 1.2 }), { g: dusty });
      ctx.light(12.6, 1.4, rz(8.4), 0x7dff6a, 1.6, 3.5, 0.3);
      const wisp = new THREE.Group(); wisp.visible = false; G.add(wisp);
      const wm = new THREE.MeshBasicMaterial({ color: 0xd6ecff, transparent: true, opacity: 0.8, depthWrite: false });
      const wb = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.05, 0.5, 8), wm); wb.position.y = -0.1; wisp.add(wb);
      const wh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), wm); wh.position.y = 0.25; wisp.add(wh);
      const wk = new THREE.MeshBasicMaterial({ color: 0x050510 });
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), wk); e.scale.set(0.035, 0.05, 0.02); e.position.set(s * 0.08, 0.3, 0.18); wisp.add(e); }
      let wT = -1;
      ctx.interact({
        x: 12.5, y: 1.0, z: rz(8.4), r: 1.3, label: 'Pull the dusty bottle', button: 'Pull',
        active: () => wT < 0,
        run: () => { wT = 0; sfx('click'); },
      });
      ticks.push((t, dt) => {
        if (wT < 0) return;
        wT += dt;
        dusty.position.x = 13.1 - Math.min(0.2, wT * 0.5) + Math.sin(wT * 70) * (wT < 0.5 ? 0.012 : 0);
        if (wT > 0.5 && !wisp.visible) { wisp.visible = true; sfx('whoosh'); toast('"Boo-ttle!" A tiny ghost pops out of the bottle, giggles and floats away.'); }
        if (wisp.visible) {
          const u = (wT - 0.5) / 3;
          wisp.position.set(12.9 - u * 1.2 + Math.sin(u * 14) * 0.3, 1.1 + u * 1.5, rz(8.4) + Math.cos(u * 14) * 0.3 + u * 1.2);
          wisp.rotation.y = u * 6; wm.opacity = 0.85 * (1 - u * u);
          if (u >= 1) { wisp.visible = false; }
        }
        if (wT > 3.8) { wT = -1; dusty.position.x = 13.1; }
      });
    }

    // third lever (Cytoplasm) on the crypt end wall, between the racks
    lever('cytoplasm', 'CYTOPLASM', 0xff7a1a, 14.47, 1.5, 6.4, -Math.PI / 2, -1, false);
    ctx.light(13.4, 2.2, rz(6.4), 0xff9a50, 2.2, 4.5, 0.2);
    // skulls on the crypt floor and a few cobwebs for mood
    for (const [x, lz] of [[9.2, 3.9], [14.0, 6.0]]) { box(x, 0, rz(lz), 0.22, 0.2, 0.2, bone); box(x, 0.2, rz(lz), 0.2, 0.12, 0.18, bone); }
    ctx.cobweb(5, 1, 'far', 1.6);

    // ------------------------------------------------------------------ restore saved progress
    if (solved) { setLevers(true, true); genOn(true); spin_v = 9; }
    ctx.on('reset', () => {
      solved = false; blocked = false; seq = []; surge = -1;
      setLevers(false, true); hatchO.set(false, true);
      lampMat.color.setHex(0xe0384a); genLight.color.set(0xe0384a); genLight.i = 1.2; spin_v = 0;
      for (const o of opens) o.set(false, true);
      paper.visible = false;
    });

    // ------------------------------------------------------------------ per-frame
    ctx.onFrame((t, dt) => {
      const p = ctx.player();
      for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } }
      for (const o of opens) {
        if (o.t === o.target) continue;
        const d = o.target - o.t; o.t += Math.sign(d) * Math.min(Math.abs(d), dt * 1.8); o.apply(ease(o.t));
      }
      for (const f of ticks) f(t, dt, p);
    });
  },
};
