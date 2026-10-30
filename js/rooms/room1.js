// Room 1 extras: Entrance Hall. Cloakroom side room, searchable furniture, the knights puzzle,
// a talking portrait and a few spooky surprises. See ROOMS.md.
export default {
  side: { side: -1, lz: 1.8, w: 2.2 },
  build(ctx) {
    const { THREE, box, cyl, sph, plane, mat, canvasTex, interact, candy, state, sfx, toast } = ctx;
    const Z = ctx.rz, G = ctx.group();

    // ------------------------------------------------------------ helpers
    const tweens = [];
    const smooth = k => k * k * (3 - 2 * k);
    const elastic = k => (k >= 1 ? 1 : 1 - Math.pow(2, -9 * k) * Math.cos(k * Math.PI * 3.2));
    const tween = (dur, fn, done) => tweens.push({ t: 0, dur, fn, done });
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const pivot = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); G.add(g); return g; };

    const wood = mat('#4a2e18'), dark = mat('#2e1c10'), light = mat('#6a4a2a'), brass = mat('#b08a3a', { metalness: 0.5, roughness: 0.4 });
    const felt = mat('#1a0f14');

    // A drawer that slides out. (x, y, z) = centre of its front face when closed; sign = direction it opens along x.
    function drawer(x, y, z, len, sign, h = 0.26) {
      const g = pivot(x, y, z);
      box(sign * 0.03, 0, 0, 0.05, h, len, wood, { g });
      box(sign * 0.075, h + 0.005, 0, 0.04, 0.05, 0.18, brass, { g }).position.y = h / 2;
      box(-sign * 0.22, 0.02, 0, 0.4, h - 0.06, len - 0.1, light, { g });
      return { g, x0: x, slide: k => { g.position.x = x + sign * 0.42 * k; } };
    }

    // Makes a searchable thing. set(k) poses it (0 closed, 1 open). after() runs once when first opened.
    function searchable({ id, x, z, y = 0.8, r = 1.3, label, again, set, after }) {
      let open = state.isFound(id);
      const reopen = 'Look again';
      const it = interact({
        x, y, z, r, label: open ? reopen : label, button: open ? 'Look' : 'Search',
        run: async () => {
          if (open) { await again(); return; }
          open = true; state.markFound(id); it.label = reopen; it.button = 'Look';
          sfx('door'); tween(0.6, k => set(smooth(k)));
          await wait(450); await after();
        },
      });
      if (open) set(1);
      return it;
    }

    // ------------------------------------------------------------ candies (5)
    const c1 = candy(-6.3, 3.05, Z(10.2), 'r1-candy1');                                              // stair landing
    const c2 = candy(7.62, 1.28, Z(4.2), 'r1-candy2');                                               // on the console table
    const c3 = candy(-5.6, 0.85, Z(0.35), 'r1-candy3', { hidden: !state.isFound('r1-clock') });      // inside the clock
    const c4 = candy(-11.5, 0.6, Z(6.1), 'r1-candy4', { hidden: !state.isFound('r1-wardrobe') });    // inside the wardrobe
    const c5 = candy(7.5, 1.12, Z(13.5), 'r1-candy5', { hidden: !state.isFound('r1-portrait') });    // portrait's reward

    // ------------------------------------------------------------ side room: cloakroom
    ctx.sideRoom({ depth: 6, lz0: 0.6, lz1: 6.6, wall: ['paper', '#2f2a44', '#3b3456'], floor: ['wood', '#2e1e12', '#3a2616'], light: 0xffc890 });
    box(-11.5, 0.02, Z(3.6), 3.2, 0.04, 2.6, ctx.tmat('carpet', '#3a1a34', '#b08a3a', 1, 1), {});

    // coat rail and swaying coats
    box(-14.25, 2.05, Z(3.6), 0.06, 0.06, 5.2, dark);
    const coatCols = ['#3a2a44', '#2a3a44', '#5a2a30', '#2a2a2a', '#44402a', '#2a443a', '#4a2a44'];
    const coats = [];
    for (let i = 0; i < 7; i++) {
      const p = pivot(-14.2, 2.05, Z(1.4 + i * 0.72));
      box(0, -1.45, 0, 0.16, 1.45, 0.5, mat(coatCols[i]), { g: p });
      box(0, -1.7, 0, 0.17, 0.3, 0.52, mat(coatCols[(i + 3) % 7]), { g: p });
      coats.push(p);
    }
    box(-14.35, 0.0, Z(3.6), 0.3, 0.08, 4.4, dark);   // little boot shelf under the coats
    for (let i = 0; i < 5; i++) box(-14.3, 0.08, Z(2.0 + i * 0.85), 0.28, 0.16, 0.2, mat('#1c1412'));

    // wardrobe (searchable, candy)
    const wx = -11.5, wzf = 5.9, wzb = 6.6;
    box(wx, 0, Z(6.55), 2.0, 2.3, 0.1, dark);
    box(wx - 0.95, 0, Z(6.25), 0.1, 2.3, 0.7, wood); box(wx + 0.95, 0, Z(6.25), 0.1, 2.3, 0.7, wood);
    box(wx, 2.2, Z(6.25), 2.0, 0.14, 0.76, wood); box(wx, 0, Z(6.25), 1.9, 0.12, 0.7, wood);
    box(wx, 2.34, Z(6.25), 2.14, 0.08, 0.84, light);
    for (const dx of [-0.55, 0.55]) box(wx + dx, 0.12, Z(6.4), 0.5, 1.9, 0.04, mat('#0c0709'));
    ctx.addSolid(wx, 0, Z(6.25), 2.0, 2.3, 0.7);
    const wdoors = [];
    for (const s of [-1, 1]) {
      const p = pivot(wx + s * 1.0, 0.12, Z(wzf) );
      box(-s * 0.49, 0, 0, 0.98, 2.08, 0.06, wood, { g: p });
      box(-s * 0.49, 0.2, -0.02 * 0 + 0.0, 0.7, 0.04, 0.07, light, { g: p }).position.y = 1.5;
      box(-s * 0.08, 0.95, 0.05, 0.05, 0.22, 0.05, brass, { g: p });
      wdoors.push(p);
    }
    // creepy eyes in the door slits
    const slit = mat('#000000');
    for (const dx of [-0.34, 0.34]) box(wx + dx, 1.62, Z(wzf) + 0.05, 0.32, 0.1, 0.02, slit);
    const eyeM = ctx.basic(0xffe84a), eyes = [];
    for (const dx of [-0.34, 0.34]) for (const ex of [-0.07, 0.07]) { const e = box(wx + dx + ex, 1.64, Z(wzf) + 0.07, 0.05, 0.05, 0.02, eyeM); eyes.push(e); e.visible = false; }
    let wardOpen = state.isFound('r1-wardrobe');
    searchable({
      id: 'r1-wardrobe', x: wx, z: Z(5.0), y: 1.2, r: 1.6, label: 'Open the wardrobe',
      set: k => { wdoors[0].rotation.y = -1.9 * k; wdoors[1].rotation.y = 1.9 * k; if (k > 0.3) eyes.forEach(e => e.visible = false); wardOpen = k > 0; },
      after: async () => { c4.reveal(); toast('Something was hiding in there... a sweet!'); },
      again: async () => { toast('Only old coats and a faint smell of mothballs.'); },
    });

    // trunk with the clue note
    const tz = 1.05, tx = -11.5;
    box(tx, 0, Z(tz), 1.2, 0.5, 0.7, wood, { solid: true });
    box(tx - 0.4, 0, Z(tz), 0.08, 0.52, 0.72, brass); box(tx + 0.4, 0, Z(tz), 0.08, 0.52, 0.72, brass);
    box(tx, 0.28, Z(tz) + 0.36, 0.14, 0.14, 0.04, brass);
    const tlid = pivot(tx, 0.5, Z(tz - 0.35));
    box(0, 0, -0.35, 1.2, 0.14, 0.7, light, { g: tlid }); box(-0.4, 0, -0.35, 0.08, 0.16, 0.72, brass, { g: tlid }); box(0.4, 0, -0.35, 0.08, 0.16, 0.72, brass, { g: tlid });
    const paper = box(tx, 0.5, Z(tz), 0.36, 0.02, 0.5, mat('#f3ead8', { emissive: '#e8c870', emissiveIntensity: 0.35 }), { ry: 0.3 });
    paper.visible = false;
    const tally = () => ctx.note({
      kicker: 'Found in the trunk', title: "The Scientist's Notebook",
      html: '<p>Three pages from a science experiment, all mixed up! Work out which page came <b>first</b>, <b>second</b> and <b>third</b>.</p>' +
        '<div class="card"><p><b>Page A:</b> "We put one bean plant on a sunny windowsill and one in a dark cupboard. Both got the same water."</p>' +
        '<p><b>Page B:</b> "After 10 days the plant in the light was 12 cm tall. The plant in the dark was 3 cm tall. So plants need light to grow well."</p>' +
        '<p><b>Page C:</b> "Does light change how tall a bean plant grows?"</p></div>' +
        '<p class="clue">Each knight in the hall holds a sign with one job of a scientist. Turn the knights one at a time, in the same order as the pages, and the hall will show you its secret.</p>',
      button: 'Got it',
    });
    searchable({
      id: 'r1-trunk', x: tx, z: Z(2.35), y: 0.6, r: 1.5, label: 'Open the trunk',
      set: k => { tlid.rotation.x = 1.95 * k; paper.visible = k > 0.5 && !state.isFound('r1-tallyread'); },
      after: async () => { await tally(); state.markFound('r1-tallyread'); paper.visible = false; },
      again: async () => { await tally(); },
    });

    // dresser with two drawers and a hat box
    const dx0 = -8.85;
    box(dx0, 0, Z(4.3), 0.7, 0.86, 1.8, wood, { solid: true });
    box(dx0, 0.86, Z(4.3), 0.8, 0.06, 1.9, light, { solid: true });
    ctx.candle(dx0, 0.92, Z(3.5), 1, false, 0.22);
    const dr = [drawer(-9.2, 0.45, Z(3.8), 0.78, -1), drawer(-9.2, 0.45, Z(4.8), 0.78, -1)];
    box(-9.2, 0.1, Z(4.3), 0.04, 0.3, 1.7, wood);
    const dLines = [
      ['A single left glove. It gives you a thumbs up.', 'Just the glove. Still giving the thumbs up.'],
      ['Mothballs. Lots of mothballs. Even the moths are scared of them.', 'Still mothballs. Still scary to moths.'],
    ];
    dr.forEach((d, i) => searchable({
      id: 'r1-drawer' + (i + 1), x: -9.9, z: Z(3.8 + i * 1.0), y: 0.6, r: 0.85, label: 'Open the drawer',
      set: k => d.slide(k), after: async () => { toast(dLines[i][0]); }, again: async () => { toast(dLines[i][1]); },
    }));

    // hat box with a jack-in-the-box skull (the room's one small scare)
    const hx = -9.75, hz = 6.05;
    cyl(hx, 0, Z(hz), 0.34, 0.4, mat('#7a2a4a'), { seg: 12 });
    const hlid = pivot(hx, 0.4, Z(hz));
    cyl(0, 0, 0, 0.37, 0.07, mat('#a03a62'), { seg: 12, g: hlid });
    const jack = pivot(hx, 0.4, Z(hz));
    const spring = cyl(0, 0, 0, 0.035, 1, mat('#9a9aa8', { metalness: 0.6 }), { seg: 6, g: jack });
    const skull = new THREE.Group(); jack.add(skull);
    const bone = mat('#efe6cc', { emissive: '#3a3020', emissiveIntensity: 0.4 });
    sph(0, 0, 0, 0.17, 0.18, 0.17, bone, { g: skull }); box(0, -0.27, 0.0, 0.18, 0.08, 0.14, bone, { g: skull });
    for (const ex of [-0.07, 0.07]) box(ex, -0.04, 0.14, 0.06, 0.07, 0.04, ctx.basic(0x050505), { g: skull });
    const hatSet = k => {
      const e = elastic(k), len = 0.04 + 0.96 * e;
      spring.scale.y = len; spring.position.y = len / 2; skull.position.y = len + 0.16; skull.visible = k > 0.02;
      hlid.position.set(-0.55 * k, k * (1 - k) * 2.2, 0); hlid.rotation.z = 2.4 * k;
    };
    hatSet(0);
    let hatDone = state.isFound('r1-hatbox');
    if (hatDone) hatSet(1);
    const hit = interact({
      x: hx, y: 0.5, z: Z(hz - 0.8), r: 1.1, label: hatDone ? 'Look at the skull' : 'Open the hat box', button: 'Open',
      run: async () => {
        if (hatDone) { toast('The skull grins. It is still springing a little.'); return; }
        hatDone = true; state.markFound('r1-hatbox'); hit.label = 'Look at the skull';
        sfx('click'); await wait(350);
        sfx('scare'); ctx.shake(0.22);
        tween(0.9, k => hatSet(k));
        await wait(900); toast('A jack-in-the-box skull! It was just a toy... right?');
      },
    });

    // ------------------------------------------------------------ hall: grandfather clock (searchable, candy)
    const cx = -5.6, cz = 0.4;
    const cg = pivot(cx, 0, Z(cz));
    box(0, 0, 0, 0.95, 0.5, 0.64, wood, { g: cg });
    box(0, 0.5, 0.22, 0.7, 1.5, 0.06, dark, { g: cg });
    box(-0.32, 0.5, 0, 0.06, 1.5, 0.5, wood, { g: cg }); box(0.32, 0.5, 0, 0.06, 1.5, 0.5, wood, { g: cg });
    box(0, 0.5, 0, 0.7, 0.04, 0.5, wood, { g: cg });
    box(0, 1.7, 0, 0.85, 0.1, 0.6, light, { g: cg });
    box(0, 1.8, 0.04, 0.85, 0.75, 0.5, wood, { g: cg });
    box(0, 2.55, 0, 1.0, 0.14, 0.68, light, { g: cg });
    box(0, 2.69, 0, 0.6, 0.12, 0.5, wood, { g: cg });
    const faceTex = canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = '#e8dcb8'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill(); c.strokeStyle = '#3a2a1a'; c.lineWidth = 4; c.stroke();
      c.fillStyle = '#3a2a1a'; c.font = 'bold 16px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2; c.fillText(String(i), 64 + Math.sin(a) * 46, 64 - Math.cos(a) * 46); }
    });
    plane(0, 2.17, -0.215, 0.62, 0.62, new THREE.MeshBasicMaterial({ map: faceTex }), Math.PI, { g: cg });
    const minute = pivot(0, 2.17, -0.23), hour = pivot(0, 2.17, -0.225);
    cg.add(minute, hour);
    box(0, 0, 0, 0.03, 0.26, 0.012, mat('#111'), { g: minute }); box(0, 0, 0, 0.04, 0.17, 0.012, mat('#111'), { g: hour });
    hour.rotation.z = 2.6; minute.rotation.z = 0.5;
    const cdoor = pivot(cx - 0.3, 0.55, Z(cz) - 0.27);
    box(0.3, 0, 0, 0.6, 1.4, 0.04, mat('#5a381c'), { g: cdoor });
    box(0.3, 0.2, -0.03, 0.4, 0.8, 0.02, mat('#7a9cff', { emissive: '#223466', emissiveIntensity: 0.5, transparent: true, opacity: 0.55 }), { g: cdoor });
    box(0.5, 0.65, -0.03, 0.05, 0.14, 0.04, brass, { g: cdoor });
    const pend = pivot(cx, 1.95, Z(cz) + 0.05);
    box(0, -1.1, 0, 0.03, 1.1, 0.02, brass, { g: pend }); cyl(0, -1.35, 0, 0.16, 0.03, brass, { g: pend, seg: 12 }).rotation.x = Math.PI / 2;
    ctx.addSolid(cx, 0, Z(cz), 0.95, 2.7, 0.64);
    const clockSet = k => { cdoor.rotation.y = 1.75 * k; };
    searchable({
      id: 'r1-clock', x: cx, z: Z(1.4), y: 1.2, r: 1.4, label: 'Open the clock case', set: clockSet,
      after: async () => { c3.reveal(); toast('Tick, tock... and a sweet rolling around at the bottom!'); },
      again: async () => { toast('Tick. Tock. Tick. The pendulum swings and swings.'); },
    });
    let spin = 0, spun = false;
    const lamp = ctx.light(cx, 2.2, Z(cz + 1.2), 0xffd890, 2.5, 5, 0.1);

    // ------------------------------------------------------------ hall: console table with drawer
    box(7.5, 0, Z(4.6), 0.7, 0.9, 1.8, wood, { solid: true });
    box(7.5, 0.9, Z(4.6), 0.8, 0.06, 1.9, light, { solid: true });
    box(7.84, 0.96, Z(5.1), 0.08, 0.28, 0.28, mat('#2a1c14'));      // little frame
    ctx.candle(7.6, 0.96, Z(5.05), 1, false, 0.22);
    const cd = drawer(7.15, 0.6, Z(4.6), 1.5, -1);
    box(7.15, 0.08, Z(4.6), 0.04, 0.4, 1.7, wood);
    searchable({
      id: 'r1-console', x: 6.55, z: Z(4.6), y: 0.8, r: 1.1, label: 'Open the drawer',
      set: k => cd.slide(k),
      after: async () => { toast('A takeaway menu from 1823 and one very confused moth.'); },
      again: async () => { toast('Just the old menu. The moth waves.'); },
    });

    // ------------------------------------------------------------ hall: treasure chest
    const chz = 8.6;
    box(7.5, 0, Z(chz), 0.7, 0.5, 1.1, wood, { solid: true });
    box(7.5, 0, Z(chz - 0.35), 0.74, 0.52, 0.08, brass); box(7.5, 0, Z(chz + 0.35), 0.74, 0.52, 0.08, brass);
    box(7.14, 0.3, Z(chz), 0.05, 0.16, 0.14, brass);
    const chlid = pivot(7.85, 0.5, Z(chz));
    box(-0.35, 0, 0, 0.72, 0.15, 1.12, light, { g: chlid }); box(-0.35, 0.15, 0, 0.5, 0.06, 1.12, wood, { g: chlid });
    box(-0.35, 0, -0.35, 0.74, 0.17, 0.08, brass, { g: chlid }); box(-0.35, 0, 0.35, 0.74, 0.17, 0.08, brass, { g: chlid });
    const duck = pivot(7.5, 0.5, Z(chz)); duck.visible = false;
    sph(0, 0.1, 0, 0.14, 0.11, 0.17, mat('#ffd21a', { emissive: '#553a00', emissiveIntensity: 0.4 }), { g: duck });
    sph(-0.08, 0.26, 0, 0.09, 0.09, 0.09, mat('#ffd21a'), { g: duck }); box(-0.17, 0.24, 0, 0.07, 0.03, 0.05, mat('#ff7a1a'), { g: duck });
    box(-0.08, 0.34, 0, 0.12, 0.07, 0.12, mat('#111'), { g: duck });
    searchable({
      id: 'r1-chest', x: 6.55, z: Z(chz), y: 0.8, r: 1.4, label: 'Open the chest',
      set: k => { chlid.rotation.z = -2.0 * k; duck.visible = k > 0.5; },
      after: async () => { toast('Treasure! It is a rubber duck wearing a tiny top hat. It judges you silently.'); },
      again: async () => { toast('The duck stares at you. You stare back. It wins.'); },
    });

    // ------------------------------------------------------------ hall: portrait Q&A table
    box(7.55, 0, Z(13.5), 0.6, 0.8, 1.0, wood, { solid: true });
    box(7.55, 0.8, Z(13.5), 0.7, 0.06, 1.1, light, { solid: true });
    ctx.candle(7.6, 0.86, Z(13.0), 1, false, 0.25);
    let asked = state.isFound('r1-portrait');
    const pit = interact({
      x: 6.6, y: 1.5, z: Z(13.5), r: 1.7, label: 'Talk to the portrait', button: 'Talk',
      active: () => !asked,
      run: async () => {
        sfx('whoosh');
        await ctx.note({ kicker: 'A voice from the frame', title: 'The Portrait Speaks', html: '<p>The painted eyes blink. A dusty voice whispers:</p><p class="clue">"Psst, young one. Answer my riddle and I shall leave you a sweet. Get it wrong and I shall simply laugh."</p>', button: 'Listen' });
        const ok = await ctx.ask('The Portrait\'s riddle');
        if (ok) { asked = true; state.markFound('r1-portrait'); c5.reveal(); sfx('correct'); toast('"Hmph. Clever." A sweet appears on the table below.'); }
        else toast('"Ha ha ha!" Come back and try again any time.');
      },
    });

    // ------------------------------------------------------------ hall: welcome lectern
    box(3.4, 0, Z(9.0), 0.5, 1.0, 0.5, dark, { solid: true });
    box(3.4, 1.0, Z(9.0), 0.8, 0.07, 0.7, wood, { rz: 0.35 });
    const wpaper = box(3.34, 1.07, Z(9.0), 0.6, 0.01, 0.5, mat('#f3ead8', { emissive: '#7dff6a', emissiveIntensity: 0.4 }), { rz: 0.35 });
    ctx.light(3.4, 1.7, Z(9.0), 0x7dff6a, 2.5, 4.5, 0.15);
    let welcomed = state.isFound('r1-welcome'), hinted = welcomed;
    interact({
      x: 2.6, y: 1.0, z: Z(9.0), r: 1.6, label: 'Read the glowing note', button: 'Read',
      run: async () => {
        state.markFound('r1-welcome'); welcomed = true;
        await ctx.note({
          kicker: 'Welcome, brave student', title: 'How to Escape',
          html: '<p>You are locked inside the haunted school! Walk up to things and press <b>E</b> (or tap the button) to use them.</p>' +
            '<div class="card"><p><b>Search everything.</b> Drawers, chests, wardrobes and clocks open when you search them.</p>' +
            '<p><b>Candy.</b> Walk into sweets to collect them. Some hide inside furniture or high up. Try jumping!</p>' +
            '<p><b>Science cards.</b> One is hidden in every room. Each adds a minute to your clock and teaches a science fact.</p>' +
            '<p><b>Power.</b> In Rooms 2 to 5, solve the room puzzle to power the arcade machine, then win its game to get a key.</p></div>' +
            '<p class="clue">This room has a side room, a secret and a puzzle with knights. Look for a clue.</p>',
          button: 'Let\'s go',
        });
      },
    });

    // ------------------------------------------------------------ the knights puzzle
    const findKnight = lz => G.children.find(o => o.isGroup && Math.abs(o.position.x - 7) < 1e-3 && Math.abs(o.position.y) < 1e-3 && Math.abs(o.position.z - Z(lz)) < 1e-3);
    const kdef = [{ lz: 2.5, col: '#ff3b4a', name: 'red' }, { lz: 6.5, col: '#4dff7a', name: 'green' }, { lz: 11, col: '#4da6ff', name: 'blue' }];
    const ORDER = [1, 2, 0];   // green 'Ask a question', blue 'Do the experiment', red 'Draw a conclusion'
    const SIGNS = [['Draw a', 'conclusion'], ['Ask a', 'question'], ['Do the', 'experiment']];
    const BASE = -Math.PI / 2, TURN = BASE + Math.PI / 2;
    let seq = [], solved = state.isFound('r1-knights');
    const turned = [false, false, false], knights = [];
    const kangle = [BASE, BASE, BASE];
    kdef.forEach((d, i) => {
      const g = findKnight(d.lz);
      if (!g) { console.error('Room 1: knight not found at lz', d.lz); knights.push(null); return; }
      const gm = mat(d.col, { emissive: d.col, emissiveIntensity: 0.6 });
      box(0, 1.1, 0.25, 0.26, 0.26, 0.06, gm, { g });
      const sg = canvasTex(128, 64, (c, w, h) => {
        c.fillStyle = '#e8dcb8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#4a2e18'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
        c.fillStyle = '#2a1a10'; c.font = 'bold 24px Nunito, sans-serif'; c.textAlign = 'center'; c.fillText(SIGNS[i][0], w / 2, 28); c.fillText(SIGNS[i][1], w / 2, 54);
      });
      plane(0, 0.78, 0.29, 0.62, 0.31, new THREE.MeshBasicMaterial({ map: sg }), 0, { g });
      knights.push({ g, gm });
      interact({
        x: 6.0, y: 1.3, z: Z(d.lz), r: 1.5, label: 'Turn the knight', button: 'Turn',
        active: () => !solved && !turned[i],
        run: async () => press(i),
      });
    });
    const turnKnight = (i, on, instant) => {
      const kn = knights[i]; if (!kn) return;
      turned[i] = on;
      const from = kangle[i], to = on ? TURN : BASE;
      if (instant) { kangle[i] = to; kn.g.rotation.y = to; return; }
      tween(0.55, k => { kangle[i] = from + (to - from) * smooth(k); kn.g.rotation.y = kangle[i]; });
    };

    // hidden panel on the entrance wall holding the science card
    const bx = 4.8;
    const wall = ctx.tmat('wood', '#3a2414', '#4a301c', 1, 1);
    box(bx - 0.75, 0, Z(0.2), 0.1, 2.2, 0.4, dark); box(bx + 0.75, 0, Z(0.2), 0.1, 2.2, 0.4, dark);
    box(bx, 2.1, Z(0.2), 1.6, 0.1, 0.4, dark); box(bx, 0, Z(0.2), 1.6, 0.1, 0.4, dark);
    box(bx, 0.1, Z(0.03), 1.4, 2.0, 0.04, felt);
    box(bx, 0.6, Z(0.2), 1.3, 0.05, 0.3, dark);
    const doorTex = canvasTex(128, 192, (c, w, h) => {
      c.fillStyle = '#4a301c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2e1c10'; c.lineWidth = 4;
      for (let y = 20; y < h; y += 28) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 5; c.strokeRect(14, 14, w - 28, h - 28);
      c.fillStyle = '#6a4a2a'; c.fillRect(54, 42, 20, 26); c.fillRect(46, 62, 36, 12); c.fillRect(58, 74, 12, 40);
    });
    const sdoor = pivot(bx, 0.1, Z(0.45));
    box(0, 0, 0, 1.4, 2.0, 0.1, wall, { g: sdoor });
    plane(0, 1.0, -0.06, 1.2, 1.8, new THREE.MeshBasicMaterial({ map: doorTex }), Math.PI, { g: sdoor });
    box(bx + 0.85, 0.1, Z(0.55), 1.55, 2.0, 0.1, wall);
    box(bx + 0.85, 0.1, Z(0.57), 1.45, 0.05, 0.04, dark);
    const cardGlow = ctx.light(bx, 1.4, Z(0.6), 0x7dff6a, 0, 4, 0.1);
    const card = ctx.dataCard(bx, 1.25, Z(0.3), {
      hidden: true, title: 'Science card: Fair tests',
      html: '<p>Scientists test ideas with <b>fair tests</b>. In a fair test you change only <b>one thing</b> (the independent variable), measure what happens (the dependent variable) and keep everything else the same. In the bean plant notebook, light was changed and height was measured.</p><p>Science builds on the work of others, so scientists share their results.</p><small>1.2.6</small>',
    });
    const slideDoor = k => { sdoor.position.x = bx + 1.5 * k; };
    function openSecret(instant) {
      knights.forEach((_, i) => turnKnight(i, true, instant));
      if (instant) slideDoor(1); else tween(1.2, k => slideDoor(smooth(k)));
      cardGlow.i = 4; card.reveal();
    }
    async function press(i) {
      seq.push(i); sfx('click');
      turnKnight(i, true);
      const n = seq.length;
      if (seq[n - 1] !== ORDER[n - 1]) {
        sfx('wrong'); ctx.shake(0.15);
        toast(n === 1 ? 'Clank! That job does not come first. What does a scientist do before testing anything?' : 'Clank! The first knight was right, but that job is not second. The knights creak back into place.');
        const bad = seq.slice(); seq = [];
        await wait(650);
        bad.forEach(j => turnKnight(j, false));
        return;
      }
      if (n < 3) { toast('Clunk! Knight ' + n + ' of 3 turned. Keep going.'); return; }
      solved = true; state.markFound('r1-knights');
      sfx('unlock'); ctx.shake(0.3);
      toast('A hidden panel slides open on the entrance wall behind you!');
      await wait(500); sfx('door'); openSecret(false);
    }
    if (solved) openSecret(true);

    // ------------------------------------------------------------ per-frame animation
    const pend0 = Math.random() * 6;
    ctx.onFrame((t, dt) => {
      for (let i = tweens.length - 1; i >= 0; i--) {
        const w = tweens[i]; w.t += dt; const k = Math.min(1, w.t / w.dur); w.fn(k);
        if (k >= 1) { tweens.splice(i, 1); if (w.done) w.done(); }
      }
      const p = ctx.player();
      pend.rotation.z = Math.sin(t * 2.2 + pend0) * 0.3;
      wpaper.position.y = 1.07 + Math.sin(t * 2) * 0.01;
      // knight gems pulse; a turned knight glows bright
      for (let i = 0; i < knights.length; i++) if (knights[i]) knights[i].gm.emissiveIntensity = turned[i] ? 2.2 : 0.6 + Math.sin(t * 2.5 + i) * 0.3;
      // coats sway; those near the player swing more, as if something brushed past
      for (let i = 0; i < coats.length; i++) {
        const c = coats[i], d = Math.hypot(p.x - c.position.x, p.z - c.position.z);
        const amp = 0.03 + 0.45 * Math.max(0, 1 - d / 2.6);
        c.rotation.z = Math.sin(t * 2.4 + i * 1.7) * amp;
      }
      // wardrobe eyes blink in the slits while the doors are shut
      if (!wardOpen) {
        const near = p.x < -9 && Math.hypot(p.x - wx, p.z - Z(6.25)) < 5.5, on = near && (t % 4.5) < 2.6 && (t % 0.9) > 0.12;
        for (let i = 0; i < eyes.length; i++) eyes[i].visible = on;
      }
      // the clock strikes thirteen the first time you come close
      if (!spun && p.x > -9 && p.x < -3 && Math.hypot(p.x - cx, p.z - Z(cz)) < 2.6) {
        spun = true; spin = 2.4; sfx('tick'); toast('The old clock strikes... THIRTEEN?');
      }
      if (spin > 0) {
        spin -= dt; minute.rotation.z += dt * 18; hour.rotation.z += dt * 1.5;
        if (Math.floor(spin * 5) !== Math.floor((spin + dt) * 5)) sfx('tick');
      }
      // gently point out the glowing note once
      if (!hinted && Math.hypot(p.x - 3.4, p.z - Z(9.0)) < 4.5) { hinted = true; toast('A glowing note sits on the lectern. Press E near it to read it!'); }
    });
  },
};
