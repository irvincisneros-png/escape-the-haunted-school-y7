// Pumpkin Fling: original slingshot-physics mini game (canvas 2D, own tiny physics engine).
// Fling jack-o'-lanterns at wobbly bone/coffin/crate towers and knock out the cackling goblins.

const GROUND = 620;          // world y of the ground surface
const GRAV = 1500;           // px/s^2
const ANCH = { x: 260, y: 470 };
const PULL_MAX = 120;
const LAUNCH_K = 12;         // launch speed = pull * K
const STEP = 1 / 120;
const ITER = 12;
const FONT_T = '"Creepster", "Nunito", system-ui, cursive';
const FONT_B = '"Nunito", system-ui, sans-serif';

export default {
  id: 'sling',
  title: 'Pumpkin Fling',
  instructions: 'Drag back and release to fling pumpkins (or Up/Down = aim, Left/Right = power, Space = fire). Smash every goblin!',

  start(canvas, api) {
    const ctx = canvas.getContext('2d');
    let dead = false;
    let raf = 0;
    const prevTouch = canvas.style.touchAction;
    canvas.style.touchAction = 'none';

    const view = { x0: 120, y0: 0, W: 1120, H: 720, s: 1 };
    let cssScale = 1;
    let bgCanvas = null;

    // ---------- helpers ----------
    const rnd = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    function seeded(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
    function rrect(c, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
      c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
      c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
    }
    function sfx(n) { try { api.sfx(n); } catch (e) { /* ignore */ } }

    // ---------- sprites ----------
    function makeSprite(size, fn) {
      const c = document.createElement('canvas'); c.width = c.height = size;
      fn(c.getContext('2d'), size); return c;
    }
    const pumpkinSprite = makeSprite(160, (g, S) => {
      const cx = S / 2, cy = S * 0.56;
      // stem
      g.fillStyle = '#4a7a2a'; g.strokeStyle = '#1f3510'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx - 7, cy - 52); g.quadraticCurveTo(cx - 4, cy - 70, cx + 10, cy - 76);
      g.lineTo(cx + 15, cy - 68); g.quadraticCurveTo(cx + 6, cy - 62, cx + 8, cy - 50); g.closePath(); g.fill(); g.stroke();
      // body lobes
      const lobes = [[-34, 40], [34, 40], [-17, 46], [17, 46], [0, 48]];
      for (const [dx, rx] of lobes) {
        const gr = g.createRadialGradient(cx + dx * 0.5 - 6, cy - 14, 6, cx + dx * 0.4, cy, 62);
        gr.addColorStop(0, '#ffc15a'); gr.addColorStop(0.55, '#ff7a1a'); gr.addColorStop(1, '#b53c06');
        g.fillStyle = gr; g.strokeStyle = '#7a2a04'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(cx + dx, cy, rx, 50, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      // face glow + carving
      g.fillStyle = '#3a1400';
      const tri = (x, y, w, h, up) => { g.beginPath(); g.moveTo(x - w, y + (up ? h : 0)); g.lineTo(x + w, y + (up ? h : 0)); g.lineTo(x, y + (up ? 0 : h)); g.closePath(); g.fill(); };
      tri(cx - 20, cy - 20, 11, 17, true); tri(cx + 20, cy - 20, 11, 17, true);
      tri(cx, cy + 2, 6, 10, true);
      g.beginPath(); g.moveTo(cx - 32, cy + 14); g.lineTo(cx - 20, cy + 26); g.lineTo(cx - 10, cy + 16); g.lineTo(cx, cy + 28);
      g.lineTo(cx + 10, cy + 16); g.lineTo(cx + 20, cy + 26); g.lineTo(cx + 32, cy + 14); g.lineTo(cx + 22, cy + 38);
      g.lineTo(cx, cy + 42); g.lineTo(cx - 22, cy + 38); g.closePath(); g.fill();
      // inner candle glow
      g.fillStyle = 'rgba(255,230,110,0.95)';
      const tri2 = (x, y, w, h) => { g.beginPath(); g.moveTo(x - w, y + h); g.lineTo(x + w, y + h); g.lineTo(x, y); g.closePath(); g.fill(); };
      tri2(cx - 20, cy - 15, 6.5, 10); tri2(cx + 20, cy - 15, 6.5, 10);
      g.beginPath(); g.moveTo(cx - 20, cy + 22); g.lineTo(cx - 10, cy + 17); g.lineTo(cx, cy + 25); g.lineTo(cx + 10, cy + 17);
      g.lineTo(cx + 20, cy + 22); g.lineTo(cx + 14, cy + 34); g.lineTo(cx - 14, cy + 34); g.closePath(); g.fill();
    });
    const glowSprite = makeSprite(128, (g, S) => {
      const gr = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
      gr.addColorStop(0, 'rgba(255,170,60,0.55)'); gr.addColorStop(1, 'rgba(255,120,20,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    });
    const goblinSprite = makeSprite(128, (g, S) => {
      const cx = S / 2, cy = S * 0.58;
      // ears
      g.fillStyle = '#7dff6a'; g.strokeStyle = '#2b5a22'; g.lineWidth = 3;
      for (const sx of [-1, 1]) {
        g.beginPath(); g.moveTo(cx + sx * 36, cy - 6); g.lineTo(cx + sx * 58, cy - 26); g.lineTo(cx + sx * 40, cy + 8); g.closePath(); g.fill(); g.stroke();
      }
      // head
      const gr = g.createRadialGradient(cx - 10, cy - 14, 6, cx, cy, 42);
      gr.addColorStop(0, '#fffdf0'); gr.addColorStop(1, '#d6c9a0');
      g.fillStyle = gr; g.strokeStyle = '#3a2d52'; g.lineWidth = 3.5;
      g.beginPath(); g.arc(cx, cy, 38, 0, Math.PI * 2); g.fill(); g.stroke();
      // tiny party hat
      g.fillStyle = '#8a3fd0'; g.strokeStyle = '#3a2d52'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx - 17, cy - 33); g.lineTo(cx + 3, cy - 62); g.lineTo(cx + 19, cy - 31); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff7a1a'; g.beginPath(); g.arc(cx + 3, cy - 62, 5, 0, Math.PI * 2); g.fill();
      // eyes
      for (const sx of [-1, 1]) {
        g.fillStyle = '#1a0f2a'; g.beginPath(); g.ellipse(cx + sx * 14, cy - 6, 11, 13, sx * -0.15, 0, Math.PI * 2); g.fill();
        const eg = g.createRadialGradient(cx + sx * 14, cy - 5, 1, cx + sx * 14, cy - 5, 8);
        eg.addColorStop(0, '#eaffd8'); eg.addColorStop(0.5, '#7dff6a'); eg.addColorStop(1, 'rgba(125,255,106,0)');
        g.fillStyle = eg; g.beginPath(); g.arc(cx + sx * 14, cy - 5, 8, 0, Math.PI * 2); g.fill();
      }
      // nose
      g.fillStyle = '#2a1a3a'; g.beginPath(); g.moveTo(cx, cy + 4); g.lineTo(cx - 5, cy + 15); g.lineTo(cx + 5, cy + 15); g.closePath(); g.fill();
    });
    const hurtSprite = makeSprite(128, (g, S) => { g.drawImage(goblinSprite, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(0, 0, S, S); });

    function drawPumpkin(x, y, r, a, glow, scale) {
      scale = scale || 1;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(scale, scale);
      if (glow) {
        ctx.globalCompositeOperation = 'lighter';
        const gs = r * 5.2; ctx.globalAlpha = 0.5 + 0.2 * Math.sin(time * 5 + x);
        ctx.drawImage(glowSprite, -gs / 2, -gs / 2, gs, gs);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      const d = r * 2 * 1.42;
      ctx.drawImage(pumpkinSprite, -d / 2, -d * 0.56, d, d);
      ctx.restore();
    }

    // ---------- background ----------
    function buildBg() {
      const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
      const g = c.getContext('2d');
      g.setTransform(view.s, 0, 0, view.s, -view.x0 * view.s, -view.y0 * view.s);
      const x0 = view.x0 - 60, x1 = view.x0 + view.W + 60, y0 = view.y0, W = x1 - x0;
      const sky = g.createLinearGradient(0, y0, 0, GROUND);
      sky.addColorStop(0, '#0c0728'); sky.addColorStop(0.55, '#2c1659'); sky.addColorStop(0.85, '#6a2f86'); sky.addColorStop(1, '#a1478a');
      g.fillStyle = sky; g.fillRect(x0, y0 - 10, W, 720 - y0 + 20);
      const rand = seeded(777);
      // stars
      g.fillStyle = '#fff';
      for (let i = 0; i < 110; i++) {
        const sx = x0 + rand() * W, sy = y0 + rand() * (GROUND - y0 - 120);
        g.globalAlpha = 0.25 + rand() * 0.6; g.fillRect(sx, sy, rand() < 0.15 ? 2.5 : 1.5, rand() < 0.15 ? 2.5 : 1.5);
      }
      g.globalAlpha = 1;
      // moon
      const mx = view.x0 + view.W * 0.8, my = Math.min(y0 + (GROUND - y0) * 0.2, 170) + (y0 < -100 ? 40 : 0), mr = 62;
      const mg = g.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4);
      mg.addColorStop(0, 'rgba(255,233,168,0.35)'); mg.addColorStop(1, 'rgba(255,233,168,0)');
      g.fillStyle = mg; g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
      g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(200,170,110,0.4)';
      for (const [dx, dy, rr] of [[-18, -12, 12], [16, 10, 15], [-6, 26, 8], [22, -24, 7]]) { g.beginPath(); g.arc(mx + dx, my + dy, rr, 0, Math.PI * 2); g.fill(); }
      // far hills + graveyard
      function hills(base, amp, f, ph, col) {
        g.fillStyle = col; g.beginPath(); g.moveTo(x0, 760);
        for (let x = x0; x <= x1; x += 10) g.lineTo(x, base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 2) * amp * 0.4);
        g.lineTo(x1, 760); g.closePath(); g.fill();
      }
      const hy = (base, amp, f, ph, x) => base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 2) * amp * 0.4;
      hills(540, 30, 0.006, 1, '#3a1d62');
      // haunted house on far hill
      const hx = view.x0 + view.W * 0.5, hb = hy(540, 30, 0.006, 1, hx) + 4;
      g.fillStyle = '#2a1450';
      g.fillRect(hx - 40, hb - 70, 80, 70); g.fillRect(hx - 52, hb - 50, 16, 50);
      g.beginPath(); g.moveTo(hx - 48, hb - 70); g.lineTo(hx, hb - 118); g.lineTo(hx + 48, hb - 70); g.closePath(); g.fill();
      g.fillRect(hx + 22, hb - 110, 10, 30);
      g.fillStyle = 'rgba(255,200,90,0.85)'; g.fillRect(hx - 24, hb - 54, 10, 14); g.fillRect(hx + 8, hb - 54, 10, 14); g.fillRect(hx - 8, hb - 28, 9, 12);
      hills(575, 22, 0.009, 3, '#241247');
      // graveyard silhouettes
      g.fillStyle = '#150a2c'; g.strokeStyle = '#150a2c'; g.lineCap = 'round';
      for (let x = x0 + 20; x < x1; x += 55 + rand() * 70) {
        const by = hy(575, 22, 0.009, 3, x) + 6, t = rand();
        if (x > view.x0 + view.W * 0.55 && x < view.x0 + view.W * 0.97) { if (rand() < 0.5) continue; }
        if (t < 0.4) { g.beginPath(); g.moveTo(x - 9, by); g.lineTo(x - 9, by - 24); g.quadraticCurveTo(x, by - 36, x + 9, by - 24); g.lineTo(x + 9, by); g.closePath(); g.fill(); }
        else if (t < 0.7) { g.lineWidth = 5; g.beginPath(); g.moveTo(x, by); g.lineTo(x, by - 34); g.moveTo(x - 11, by - 24); g.lineTo(x + 11, by - 24); g.stroke(); }
        else if (t < 0.88) {
          g.lineWidth = 4; g.beginPath(); g.moveTo(x, by); g.lineTo(x + 2, by - 50);
          g.moveTo(x + 2, by - 36); g.lineTo(x - 16, by - 56); g.moveTo(x + 2, by - 44); g.lineTo(x + 18, by - 62); g.moveTo(x - 10, by - 49); g.lineTo(x - 14, by - 62); g.stroke();
        } else { g.beginPath(); g.moveTo(x - 8, by); g.lineTo(x - 6, by - 20); g.lineTo(x + 6, by - 17); g.lineTo(x + 9, by); g.closePath(); g.fill(); }
      }
      hills(600, 14, 0.012, 5, '#1a0d38');
      // mist
      const mist = g.createLinearGradient(0, 520, 0, 640);
      mist.addColorStop(0, 'rgba(150,100,200,0)'); mist.addColorStop(1, 'rgba(170,120,210,0.25)');
      g.fillStyle = mist; g.fillRect(x0, 520, W, 120);
      // ground
      const gg = g.createLinearGradient(0, GROUND, 0, 740);
      gg.addColorStop(0, '#2d2352'); gg.addColorStop(0.08, '#1d1538'); gg.addColorStop(1, '#0f0a20');
      g.fillStyle = gg; g.fillRect(x0, GROUND, W, 740 - GROUND + 100);
      g.fillStyle = '#3d5a3a'; g.fillRect(x0, GROUND - 3, W, 6);
      g.fillStyle = '#2a4028';
      for (let x = x0; x < x1; x += 9 + rand() * 8) { const hh = 4 + rand() * 9; g.beginPath(); g.moveTo(x, GROUND); g.lineTo(x + 3, GROUND - hh); g.lineTo(x + 6, GROUND); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(x0 + rand() * W, GROUND + 14 + rand() * 90, 10 + rand() * 24, 2 + rand() * 3, 0, 0, Math.PI * 2); g.fill(); }
      bgCanvas = c;
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = canvas.clientWidth || 800, ch = canvas.clientHeight || 450;
      canvas.width = Math.max(2, Math.round(cw * dpr)); canvas.height = Math.max(2, Math.round(ch * dpr));
      const asp = cw / ch; let W = 1120, H = 720;
      if (asp > W / H) W = H * asp; else H = W / asp;
      view.W = W; view.H = H; view.x0 = 120 - (W - 1120) / 2; view.y0 = 720 - H; view.s = canvas.width / W;
      cssScale = cw / W;
      buildBg();
    }

    // ---------- physics ----------
    const bodies = [];
    const contacts = [];
    const ground = { type: 'box', kind: 'ground', static: true, asleep: true, x: 700, y: GROUND + 150, a: 0, c: 1, s: 0, vx: 0, vy: 0, w: 0, hw: 4000, hh: 150, rad: 1e9, invM: 0, invI: 0, mu: 0.8, e: 0.1 };

    function mkBox(cx, cy, w, h, kind) {
      const dens = kind === 'crate' ? 0.0011 : kind === 'coffin' ? 0.0012 : 0.001;
      const m = w * h * dens;
      return { type: 'box', kind, x: cx, y: cy, a: 0, vx: 0, vy: 0, w: 0, hw: w / 2, hh: h / 2, r: 0, rad: Math.hypot(w, h) / 2, invM: 1 / m, invI: 1 / (m * (w * w + h * h) / 12), mu: 0.7, e: 0.12, asleep: true, sleepT: 0, static: false, c: 1, s: 0, touch: false };
    }
    function mkCircle(cx, cy, r, kind) {
      const m = Math.PI * r * r * (kind === 'pumpkin' ? 0.004 : 0.0022);
      return { type: 'circle', kind, x: cx, y: cy, a: 0, vx: 0, vy: 0, w: 0, hw: 0, hh: 0, r, rad: r, invM: 1 / m, invI: 1 / (0.5 * m * r * r), mu: kind === 'pumpkin' ? 0.5 : 0.6, e: kind === 'pumpkin' ? 0.35 : 0.2, asleep: kind !== 'pumpkin', sleepT: 0, static: false, c: 1, s: 0, touch: false, hp: 1, flash: 0, cackleT: rnd(1.5, 4), cackle: 0, bobSeed: Math.random() * 6 };
    }
    function wake(b) { if (!b.static && b.asleep) { b.asleep = false; b.sleepT = 0; } }
    function wakeAll() { for (const b of bodies) wake(b); }

    function pushContact(a, b, nx, ny, px, py, pen) {
      contacts.push({ a, b, nx, ny, px, py, pen, e: Math.max(a.e, b.e), mu: Math.sqrt(a.mu * b.mu), jn: 0, jt: 0 });
    }
    function inside(A, vx, vy) {
      const dx = vx - A.x, dy = vy - A.y;
      const lx = dx * A.c + dy * A.s, ly = -dx * A.s + dy * A.c;
      return Math.abs(lx) <= A.hw + 1 && Math.abs(ly) <= A.hh + 1;
    }
    function verts(A) {
      const out = [];
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const lx = sx * A.hw, ly = sy * A.hh;
        out.push([A.x + lx * A.c - ly * A.s, A.y + lx * A.s + ly * A.c]);
      }
      return out;
    }
    function boxBox(A, B) {
      const dx = B.x - A.x, dy = B.y - A.y;
      const axes = [[A.c, A.s], [-A.s, A.c], [B.c, B.s], [-B.s, B.c]];
      let best = 1e9, nx = 0, ny = 0;
      for (let i = 0; i < 4; i++) {
        const ax = axes[i][0], ay = axes[i][1];
        const rA = A.hw * Math.abs(ax * A.c + ay * A.s) + A.hh * Math.abs(-ax * A.s + ay * A.c);
        const rB = B.hw * Math.abs(ax * B.c + ay * B.s) + B.hh * Math.abs(-ax * B.s + ay * B.c);
        const d = dx * ax + dy * ay, ov = rA + rB - Math.abs(d);
        if (ov < 0) return;
        if (ov < best - (i > 0 ? 0.4 : 0)) { best = ov; nx = d < 0 ? -ax : ax; ny = d < 0 ? -ay : ay; }
      }
      const rAn = A.hw * Math.abs(nx * A.c + ny * A.s) + A.hh * Math.abs(-nx * A.s + ny * A.c);
      const rBn = B.hw * Math.abs(nx * B.c + ny * B.s) + B.hh * Math.abs(-nx * B.s + ny * B.c);
      const dA = A.x * nx + A.y * ny + rAn, dBmin = B.x * nx + B.y * ny - rBn;
      const n0 = contacts.length;
      if (!B.static) for (const v of verts(B)) if (inside(A, v[0], v[1])) pushContact(A, B, nx, ny, v[0], v[1], Math.max(0, dA - (v[0] * nx + v[1] * ny)));
      if (!A.static) for (const v of verts(A)) if (inside(B, v[0], v[1])) pushContact(A, B, nx, ny, v[0], v[1], Math.max(0, v[0] * nx + v[1] * ny - dBmin));
      if (contacts.length === n0) pushContact(A, B, nx, ny, (A.x + B.x) / 2, (A.y + B.y) / 2, best);
    }
    function circleBox(C, B) {
      const dx = C.x - B.x, dy = C.y - B.y;
      const lx = dx * B.c + dy * B.s, ly = -dx * B.s + dy * B.c;
      const qx = clamp(lx, -B.hw, B.hw), qy = clamp(ly, -B.hh, B.hh);
      const ex = lx - qx, ey = ly - qy, d2 = ex * ex + ey * ey;
      if (d2 > C.r * C.r) return;
      let nlx, nly, pen, plx, ply;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); nlx = ex / d; nly = ey / d; pen = C.r - d; plx = qx; ply = qy; }
      else {
        const px = B.hw - Math.abs(lx), py = B.hh - Math.abs(ly);
        if (px < py) { nlx = lx < 0 ? -1 : 1; nly = 0; pen = px + C.r; } else { nlx = 0; nly = ly < 0 ? -1 : 1; pen = py + C.r; }
        plx = lx; ply = ly;
      }
      const nx = nlx * B.c - nly * B.s, ny = nlx * B.s + nly * B.c;
      const wx = B.x + plx * B.c - ply * B.s, wy = B.y + plx * B.s + ply * B.c;
      pushContact(B, C, nx, ny, wx, wy, pen);
    }
    function circleCircle(A, B) {
      const dx = B.x - A.x, dy = B.y - A.y, rr = A.r + B.r, d2 = dx * dx + dy * dy;
      if (d2 > rr * rr) return;
      const d = Math.sqrt(d2) || 0.001;
      const nx = dx / d, ny = dy / d;
      pushContact(A, B, nx, ny, A.x + nx * A.r, A.y + ny * A.r, rr - d);
    }

    let hitCool = 0, shake = 0;
    const speedOf = (b) => Math.hypot(b.vx, b.vy);

    function step(dt) {
      const list = bodies;
      for (const b of list) { b.c = Math.cos(b.a); b.s = Math.sin(b.a); b.touch = false; if (!b.asleep) b.vy += GRAV * dt; }
      contacts.length = 0;
      const all = list.concat([ground]);
      for (let i = 0; i < all.length; i++) {
        const A = all[i];
        for (let j = i + 1; j < all.length; j++) {
          const B = all[j];
          if ((A.static || A.asleep) && (B.static || B.asleep)) continue;
          if (A.static) { if (B.y + B.rad < GROUND - 2) continue; }
          else if (B.static) { if (A.y + A.rad < GROUND - 2) continue; }
          else { const dx = B.x - A.x, dy = B.y - A.y, rr = A.rad + B.rad; if (dx * dx + dy * dy > rr * rr) continue; }
          const n0 = contacts.length;
          if (A.type === 'box' && B.type === 'box') boxBox(A, B);
          else if (A.type === 'box') circleBox(B, A);
          else if (B.type === 'box') circleBox(A, B);
          else circleCircle(A, B);
          if (contacts.length > n0) {
            // wake sleepers touched by fast awake bodies
            if (A.asleep && !A.static && !B.asleep && (speedOf(B) > 25 || Math.abs(B.w) > 1.5)) wake(A);
            else if (B.asleep && !B.static && !A.asleep && (speedOf(A) > 25 || Math.abs(A.w) > 1.5)) wake(B);
          }
        }
      }
      // presolve
      for (const c of contacts) {
        const a = c.a, b = c.b;
        c.ima = (a.static || a.asleep) ? 0 : a.invM; c.iia = (a.static || a.asleep) ? 0 : a.invI;
        c.imb = (b.static || b.asleep) ? 0 : b.invM; c.iib = (b.static || b.asleep) ? 0 : b.invI;
        if (!a.static) a.touch = true; if (!b.static) b.touch = true;
        c.rax = c.px - a.x; c.ray = c.py - a.y; c.rbx = c.px - b.x; c.rby = c.py - b.y;
        const tx = -c.ny, ty = c.nx;
        const rnA = c.rax * c.ny - c.ray * c.nx, rnB = c.rbx * c.ny - c.rby * c.nx;
        c.mn = 1 / (c.ima + c.imb + rnA * rnA * c.iia + rnB * rnB * c.iib || 1);
        const rtA = c.rax * ty - c.ray * tx, rtB = c.rbx * ty - c.rby * tx;
        c.mt = 1 / (c.ima + c.imb + rtA * rtA * c.iia + rtB * rtB * c.iib || 1);
        const rvx = b.vx - b.w * c.rby - (a.vx - a.w * c.ray), rvy = b.vy + b.w * c.rbx - (a.vy + a.w * c.rax);
        const vn = rvx * c.nx + rvy * c.ny;
        c.impact = vn < 0 ? -vn : 0;
        c.bounce = vn < -220 ? -c.e * vn : 0;
        c.bias = Math.min(Math.max(0, c.pen - 0.8) * 0.1 / dt, 60);
        c.tx = tx; c.ty = ty;
      }
      for (let it = 0; it < ITER; it++) {
        for (const c of contacts) {
          const a = c.a, b = c.b;
          let rvx = b.vx - b.w * c.rby - (a.vx - a.w * c.ray), rvy = b.vy + b.w * c.rbx - (a.vy + a.w * c.rax);
          const vn = rvx * c.nx + rvy * c.ny;
          let lam = (Math.max(c.bias, c.bounce) - vn) * c.mn;
          const nj = Math.max(c.jn + lam, 0); lam = nj - c.jn; c.jn = nj;
          let px = lam * c.nx, py = lam * c.ny;
          a.vx -= px * c.ima; a.vy -= py * c.ima; a.w -= (c.rax * py - c.ray * px) * c.iia;
          b.vx += px * c.imb; b.vy += py * c.imb; b.w += (c.rbx * py - c.rby * px) * c.iib;
          rvx = b.vx - b.w * c.rby - (a.vx - a.w * c.ray); rvy = b.vy + b.w * c.rbx - (a.vy + a.w * c.rax);
          const vt = rvx * c.tx + rvy * c.ty;
          let lt = -vt * c.mt;
          const mx = c.mu * c.jn, nt = clamp(c.jt + lt, -mx, mx); lt = nt - c.jt; c.jt = nt;
          px = lt * c.tx; py = lt * c.ty;
          a.vx -= px * c.ima; a.vy -= py * c.ima; a.w -= (c.rax * py - c.ray * px) * c.iia;
          b.vx += px * c.imb; b.vy += py * c.imb; b.w += (c.rbx * py - c.rby * px) * c.iib;
        }
      }
      // impacts: damage, sound, effects
      let maxImp = 0, mix = 0, miy = 0, mpump = false;
      for (const c of contacts) {
        const imp = c.impact;
        if (imp <= 0) continue;
        if (imp > maxImp) { maxImp = imp; mix = c.px; miy = c.py; mpump = c.a.kind === 'pumpkin' || c.b.kind === 'pumpkin'; }
        for (const [g, o] of [[c.a, c.b], [c.b, c.a]]) {
          if (g.kind !== 'goblin' || g.dead) continue;
          let dmg = 0;
          if (o.kind === 'pumpkin') { if (imp > 90) dmg = 1; }
          else if (imp > 230) dmg = (imp - 170) / 260;
          if (dmg > 0) hurt(g, dmg, o.kind === 'pumpkin');
        }
      }
      hitCool -= dt;
      if (maxImp > 240 && hitCool <= 0) {
        hitCool = 0.12; sfx('hit');
        shake = Math.min(14, shake + maxImp / 110);
        dust(mix, miy, maxImp, mpump);
      }
      // integrate
      for (const b of list) {
        if (b.asleep) continue;
        b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt;
        b.w /= 1 + 0.25 * dt;
        if (b.type === 'circle' && b.touch) { b.w /= 1 + 1.5 * dt; b.vx /= 1 + 0.7 * dt; }
        if (b.touch && b.vx * b.vx + b.vy * b.vy < 100 && Math.abs(b.w) < 0.25) {
          b.sleepT += dt;
          if (b.sleepT > 0.5) { b.asleep = true; b.vx = b.vy = b.w = 0; }
        } else b.sleepT = 0;
      }
      // cull
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i];
        if (b.dead || b.x < -600 || b.x > 2200 || b.y > 1300) {
          if (b.kind === 'goblin' && !b.dead) { b.dead = true; goblinDown(b, true); }
          list.splice(i, 1); wakeAll();
        }
      }
    }

    // ---------- particles / popups ----------
    const parts = [], pops = [];
    function addPart(p) { if (parts.length < 260) parts.push(p); }
    function dust(x, y, imp, orange) {
      const n = Math.min(7, 2 + (imp / 200) | 0);
      for (let i = 0; i < n; i++) {
        const a = rnd(-Math.PI, 0);
        addPart({ x, y, vx: Math.cos(a) * rnd(40, 200), vy: Math.sin(a) * rnd(60, 260), life: rnd(0.35, 0.7), max: 0.7, size: rnd(2, 5), col: orange ? '#ff9a2a' : (Math.random() < 0.5 ? '#d9c9a0' : '#a98558'), g: 900, shape: 'chip', a: rnd(0, 6), va: rnd(-12, 12) });
      }
    }
    function popup(x, y, text, col, size) { pops.push({ x, y, t: 0, text, col: col || '#ffe9a8', size: size || 26 }); }

    let score = 0, combo = 0, comboT = 0;
    function hurt(g, dmg, byPumpkin) {
      g.hp -= dmg; g.flash = 0.25;
      if (g.hp <= 0 && !g.dead) { g.dead = true; goblinDown(g, false, byPumpkin); }
    }
    function goblinDown(g, fell, byPumpkin) {
      sfx('hit');
      for (let i = 0; i < 14; i++) {
        const a = rnd(0, Math.PI * 2), sp = rnd(80, 380);
        addPart({ x: g.x, y: g.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: rnd(0.6, 1.2), max: 1.2, size: rnd(3, 7), col: i % 3 === 0 ? '#7dff6a' : '#f3ead8', g: 900, shape: i % 2 ? 'bone' : 'chip', a: rnd(0, 6), va: rnd(-14, 14) });
      }
      for (let i = 0; i < 8; i++) addPart({ x: g.x + rnd(-14, 14), y: g.y + rnd(-14, 14), vx: rnd(-40, 40), vy: rnd(-90, -20), life: rnd(0.7, 1.3), max: 1.3, size: rnd(14, 28), col: 'rgba(125,255,106,0.35)', g: -30, shape: 'smoke', a: 0, va: 0 });
      shake = Math.min(16, shake + 6);
      combo = comboT > 0 ? combo + 1 : 1; comboT = 1.4;
      const pts = 100 + (combo > 1 ? 50 * (combo - 1) : 0);
      score += pts;
      popup(g.x, g.y - 30, '+' + pts, '#ffe9a8', 30);
      if (combo > 1) popup(g.x, g.y - 64, 'COMBO x' + combo + '!', '#7dff6a', 26);
      else if (!fell) popup(g.x, g.y - 62, 'Boo-hoo!', '#a99fbf', 20);
    }

    // ---------- levels ----------
    const LEVELS = [
      { name: 'Creepy Cottage', pumpkins: 5, build(B, G) {
        B(860, 0, 26, 100, 'bone'); B(990, 0, 26, 100, 'bone'); B(925, 100, 170, 22, 'bone'); G(925, 122);
        B(1085, 0, 60, 60, 'crate'); G(1170, 0);
      } },
      { name: 'Twin Towers', pumpkins: 5, build(B, G) {
        B(800, 0, 56, 56, 'crate'); B(856, 0, 56, 56, 'crate'); B(828, 56, 140, 20, 'bone'); G(828, 76);
        B(1000, 0, 36, 110, 'coffin'); B(1130, 0, 36, 110, 'coffin'); B(1065, 110, 190, 22, 'bone');
        G(1040, 132); B(1110, 132, 44, 44, 'crate'); G(1065, 0);
      } },
      { name: 'Goblin Fortress', pumpkins: 5, build(B, G) {
        B(800, 0, 26, 90, 'bone'); B(920, 0, 26, 90, 'bone'); B(1040, 0, 26, 90, 'bone'); B(1160, 0, 26, 90, 'bone');
        B(860, 90, 150, 20, 'bone'); B(1100, 90, 150, 20, 'bone');
        B(980, 0, 40, 110, 'coffin');
        B(835, 110, 50, 50, 'crate'); G(895, 110);
        B(1060, 110, 24, 80, 'bone'); B(1140, 110, 24, 80, 'bone'); B(1100, 190, 130, 20, 'coffin'); G(1100, 210);
        G(860, 0); G(1100, 0);
      } },
    ];

    // ---------- game state ----------
    let level = 0, state = 'ready', pumpkinsLeft = 0, askedThisLevel = false, shots = 0;
    let time = 0, acc = 0, last = performance.now();
    let pull = { x: 0, y: 0 }, dragging = null, mode = 'none', kAngle = 45, kPower = 0.7;
    let current = null, flightT = 0, settleT = 0, clearT = 0, bannerT = 0, overT = 0, introT = 0, loadT = 1;
    let snapT = 9, snapP = { x: 0, y: 0 }, whooshT = -1, trailT = 0;
    let banner = null, winCalled = false, loseCalled = false;
    const keys = {};

    function loadLevel(i) {
      level = i; bodies.length = 0; parts.length = 0; pops.length = 0;
      const def = LEVELS[i];
      const B = (cx, bottom, w, h, kind) => { const b = mkBox(cx, GROUND - bottom - h / 2, w, h, kind); bodies.push(b); return b; };
      const G = (cx, bottom) => { const g = mkCircle(cx, GROUND - bottom - 22, 22, 'goblin'); bodies.push(g); return g; };
      def.build(B, G);
      pumpkinsLeft = def.pumpkins; askedThisLevel = false; current = null;
      state = 'ready'; pull = { x: 0, y: 0 }; dragging = null; mode = 'none'; clearT = 0; introT = 2.4; loadT = 0; snapT = 9;
    }
    const goblinsAlive = () => { let n = 0; for (const b of bodies) if (b.kind === 'goblin' && !b.dead) n++; return n; };

    function aimVec() {
      if (mode === 'kb') { const a = kAngle * Math.PI / 180; return { x: -Math.cos(a) * kPower * PULL_MAX, y: Math.sin(a) * kPower * PULL_MAX }; }
      return pull;
    }
    function fire(p) {
      const len = Math.hypot(p.x, p.y) || 1;
      const k = Math.min(1, PULL_MAX / len);
      const pv = { x: p.x * k, y: p.y * k };
      const pk = mkCircle(ANCH.x + pv.x, ANCH.y + pv.y, 24, 'pumpkin');
      pk.vx = -pv.x * LAUNCH_K; pk.vy = -pv.y * LAUNCH_K; pk.w = rnd(-4, 4);
      bodies.push(pk); current = pk; pumpkinsLeft--; shots++;
      state = 'flying'; flightT = 0; snapT = 0; snapP = pv; pull = { x: 0, y: 0 }; dragging = null; whooshT = 0.08; trailT = 0;
      sfx('launch'); shake = Math.min(14, shake + 3);
    }
    function pumpkinDone() {
      if (current) {
        for (let i = 0; i < 12; i++) {
          const a = rnd(0, Math.PI * 2), sp = rnd(60, 240);
          addPart({ x: current.x, y: current.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100, life: rnd(0.4, 0.9), max: 0.9, size: rnd(3, 6), col: i % 2 ? '#ff9a2a' : '#ffd15a', g: 800, shape: 'chip', a: rnd(0, 6), va: rnd(-10, 10) });
        }
        const i = bodies.indexOf(current); if (i >= 0) bodies.splice(i, 1);
        wakeAll(); current = null;
      }
      state = 'settle'; settleT = 0;
    }
    function afterSettle() {
      if (goblinsAlive() === 0) { levelClear(); return; }
      if (pumpkinsLeft > 0) { state = 'ready'; loadT = 0; return; }
      outOfPumpkins();
    }
    function outOfPumpkins() {
      if (!askedThisLevel) {
        askedThisLevel = true; state = 'asking';
        let p;
        try { p = Promise.resolve(api.ask()); } catch (e) { p = Promise.resolve(false); }
        p.then((ok) => {
          if (dead) return;
          const add = ok ? 2 : 1; pumpkinsLeft += add;
          popup(ANCH.x + 120, ANCH.y - 120, '+' + add + ' pumpkin' + (add > 1 ? 's' : '') + '!', ok ? '#7dff6a' : '#ffe9a8', 34);
          state = 'ready'; loadT = 0; last = performance.now(); draw();
        }).catch(() => {
          if (dead) return;
          pumpkinsLeft += 1; state = 'ready'; loadT = 0; last = performance.now();
        });
      } else {
        state = 'over'; overT = 1.6; banner = { text: 'Out of pumpkins!', sub: 'The goblins escaped...', col: '#e0384a' };
      }
    }
    function levelClear() {
      state = 'banner';
      const bonus = pumpkinsLeft * 50; score += bonus;
      banner = { text: level === 2 ? 'All goblins smashed!' : 'Level clear!', sub: bonus ? '+' + bonus + ' for spare pumpkins' : '', col: '#7dff6a' };
      bannerT = level === 2 ? 2.0 : 1.8;
      sfx('whoosh');
      for (let i = 0; i < 40; i++) addPart({ x: rnd(view.x0, view.x0 + view.W), y: rnd(view.y0 + 100, GROUND - 100), vx: rnd(-30, 30), vy: rnd(-120, -20), life: rnd(0.8, 1.6), max: 1.6, size: rnd(2, 4), col: i % 2 ? '#ffe9a8' : '#ff9a2a', g: 60, shape: 'chip', a: 0, va: 0 });
    }

    // ---------- update ----------
    function update(dt) {
      time += dt;
      if (state === 'ready') {
        let ch = false;
        if (keys.ArrowUp) { kAngle = clamp(kAngle + 45 * dt, 5, 85); ch = true; }
        if (keys.ArrowDown) { kAngle = clamp(kAngle - 45 * dt, 5, 85); ch = true; }
        if (keys.ArrowRight) { kPower = clamp(kPower + 0.55 * dt, 0.25, 1); ch = true; }
        if (keys.ArrowLeft) { kPower = clamp(kPower - 0.55 * dt, 0.25, 1); ch = true; }
        if (ch && !dragging) mode = 'kb';
      }
      if (state !== 'asking') {
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 5) { step(STEP); acc -= STEP; n++; }
        if (acc > STEP * 5) acc = 0;
      }
      for (const b of bodies) if (b.kind === 'goblin') {
        b.flash = Math.max(0, b.flash - dt);
        b.cackleT -= dt;
        if (b.cackleT <= 0) { b.cackle = 0.7; b.cackleT = rnd(2.5, 6); if (Math.random() < 0.4) popup(b.x + 10, b.y - 50, Math.random() < 0.5 ? 'hee hee!' : 'heh heh', '#c8ffb8', 16); }
        b.cackle = Math.max(0, b.cackle - dt);
      }
      // remove dead goblins after physics
      for (let i = bodies.length - 1; i >= 0; i--) if (bodies[i].dead) { bodies.splice(i, 1); wakeAll(); }
      comboT -= dt; if (comboT <= 0) combo = 0;
      shake *= Math.exp(-9 * dt);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
        if (p.shape !== 'smoke' && p.y > GROUND - 2 && p.vy > 0) { p.y = GROUND - 2; p.vy *= -0.3; p.vx *= 0.6; p.va *= 0.5; }
      }
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t > 1.4) pops.splice(i, 1); }
      snapT += dt; loadT = Math.min(1, loadT + dt * 3.5); introT = Math.max(0, introT - dt);

      if (state === 'flying') {
        flightT += dt;
        if (whooshT > 0) { whooshT -= dt; if (whooshT <= 0) sfx('whoosh'); }
        if (current && !current.asleep && flightT < 3) {
          trailT -= dt;
          if (trailT <= 0) { trailT = 0.02; addPart({ x: current.x, y: current.y, vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.45, max: 0.45, size: rnd(3, 6), col: 'rgba(255,170,60,0.7)', g: 0, shape: 'smoke', a: 0, va: 0 }); }
        }
        const out = current && (current.x > view.x0 + view.W + 120 || current.x < view.x0 - 200 || current.y > GROUND + 200);
        if (flightT > 0.8 && (!current || current.asleep || out) || flightT > 6) pumpkinDone();
      } else if (state === 'settle') {
        settleT += dt;
        let busy = false;
        for (const b of bodies) if (!b.asleep && !b.static) busy = true;
        if ((settleT > 0.6 && !busy) || settleT > 3.5) afterSettle();
      } else if (state === 'banner') {
        bannerT -= dt;
        if (bannerT <= 0) {
          if (level === 2) { state = 'over'; overT = 0.6; banner = null; if (!winCalled) { winCalled = true; api.win(); } }
          else { banner = null; loadLevel(level + 1); }
        }
      } else if (state === 'over') {
        overT -= dt;
        if (overT <= 0 && banner && !winCalled && !loseCalled) { loseCalled = true; api.lose(); }
      }
      if ((state === 'flying' || state === 'settle' || state === 'ready') && goblinsAlive() === 0 && bodies.length) {
        clearT += dt; if (clearT > 1.0) { clearT = 0; if (current) { const i = bodies.indexOf(current); if (i >= 0) bodies.splice(i, 1); current = null; } levelClear(); }
      } else clearT = 0;
    }

    // ---------- drawing ----------
    function drawBlock(b) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
      let w = b.hw * 2, h = b.hh * 2;
      ctx.lineJoin = 'round';
      if (b.kind === 'bone') {
        const t = Math.min(w, h), horiz = w >= h;
        ctx.fillStyle = '#efe3c6'; ctx.strokeStyle = '#3a2d52'; ctx.lineWidth = 2.5;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          const kx = horiz ? sx * b.hw : sy * t * 0.28, ky = horiz ? sy * t * 0.28 : sx * b.hh;
          ctx.beginPath(); ctx.arc(kx, ky, t * 0.52, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        rrect(ctx, -b.hw, -b.hh, w, h, Math.min(6, t / 2)); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(110,80,150,0.18)';
        if (horiz) ctx.fillRect(-b.hw + 3, 0, w - 6, b.hh - 3); else ctx.fillRect(0, -b.hh + 3, b.hw - 3, h - 6);
        ctx.strokeStyle = 'rgba(90,70,60,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath();
        if (horiz) { ctx.moveTo(-w * 0.15, -b.hh + 3); ctx.lineTo(-w * 0.1, 0); ctx.moveTo(w * 0.2, b.hh - 3); ctx.lineTo(w * 0.24, 2); }
        else { ctx.moveTo(-b.hw + 3, -h * 0.15); ctx.lineTo(0, -h * 0.1); ctx.moveTo(b.hw - 3, h * 0.2); ctx.lineTo(2, h * 0.24); }
        ctx.stroke();
      } else if (b.kind === 'coffin') {
        if (w > h) { ctx.rotate(Math.PI / 2); const t = w; w = h; h = t; }
        const hw = w / 2, hh = h / 2;
        ctx.fillStyle = '#5b3a2c'; ctx.strokeStyle = '#1f1226'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-hw * 0.62, -hh); ctx.lineTo(hw * 0.62, -hh); ctx.lineTo(hw, -hh * 0.62); ctx.lineTo(hw * 0.74, hh); ctx.lineTo(-hw * 0.74, hh); ctx.lineTo(-hw, -hh * 0.62); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#8a5c42'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-hw * 0.4, -hh * 0.82); ctx.lineTo(hw * 0.4, -hh * 0.82); ctx.lineTo(hw * 0.64, -hh * 0.55); ctx.lineTo(hw * 0.48, hh * 0.86); ctx.lineTo(-hw * 0.48, hh * 0.86); ctx.lineTo(-hw * 0.64, -hh * 0.55); ctx.closePath(); ctx.stroke();
        ctx.strokeStyle = '#efe3c6'; ctx.lineWidth = Math.max(2, hw * 0.16); ctx.lineCap = 'round';
        const cy = -hh * 0.28, cr = Math.min(hw * 0.5, 9);
        ctx.beginPath(); ctx.moveTo(0, cy - cr * 1.4); ctx.lineTo(0, cy + cr * 1.8); ctx.moveTo(-cr, cy - cr * 0.3); ctx.lineTo(cr, cy - cr * 0.3); ctx.stroke();
      } else { // crate
        ctx.fillStyle = '#a2723c'; ctx.strokeStyle = '#3d2410'; ctx.lineWidth = 2.5;
        rrect(ctx, -b.hw, -b.hh, w, h, 3); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#6d4722'; ctx.lineWidth = 2;
        ctx.strokeRect(-b.hw + 5, -b.hh + 5, w - 10, h - 10);
        ctx.beginPath(); ctx.moveTo(-b.hw + 5, -b.hh + 5); ctx.lineTo(b.hw - 5, b.hh - 5); ctx.moveTo(b.hw - 5, -b.hh + 5); ctx.lineTo(-b.hw + 5, b.hh - 5); ctx.stroke();
        ctx.fillStyle = '#3d2410';
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.beginPath(); ctx.arc(sx * (b.hw - 5), sy * (b.hh - 5), 1.8, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-b.hw + 2, -b.hh + 2, w - 4, 4);
      }
      ctx.restore();
    }
    function drawGoblin(g) {
      ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.a * 0.3);
      const d = 44 * 1.45 * (128 / 128);
      const bob = g.asleep ? Math.sin(time * 3 + g.bobSeed) * 0.8 : 0;
      ctx.drawImage(g.flash > 0 ? hurtSprite : goblinSprite, -d * 0.5, -d * 0.58 + bob, d, d);
      // jaw / mouth
      const open = g.cackle > 0 ? (0.5 + 0.5 * Math.sin(g.cackle * 28)) : 0.12;
      ctx.fillStyle = '#1a0f2a'; ctx.strokeStyle = '#3a2d52'; ctx.lineWidth = 1.5;
      rrect(ctx, -10, 11 + bob, 20, 4 + open * 9, 3); ctx.fill();
      ctx.fillStyle = '#f3ead8';
      ctx.fillRect(-8, 11 + bob, 4, 3); ctx.fillRect(-2, 11 + bob, 4, 3); ctx.fillRect(4, 11 + bob, 4, 3);
      ctx.restore();
    }
    function drawText(txt, x, y, px, col, font, align, stroke) {
      ctx.font = Math.round(px) + 'px ' + (font || FONT_B); ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = px * 0.18; ctx.strokeStyle = stroke || 'rgba(15,8,30,0.9)';
      ctx.strokeText(txt, x, y); ctx.fillStyle = col; ctx.fillText(txt, x, y);
    }
    function drawSling(front) {
      const lx = ANCH.x - 26, rx = ANCH.x + 26, ty = ANCH.y;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const arm = (tipx) => { ctx.beginPath(); ctx.moveTo(ANCH.x, ty + 80); ctx.quadraticCurveTo(ANCH.x + (tipx - ANCH.x) * 0.2, ty + 40, tipx, ty); };
      let pp = { x: ANCH.x, y: ANCH.y + 10 }, loaded = false;
      const av = aimVec();
      if (state === 'ready') { pp = { x: ANCH.x + av.x, y: ANCH.y + av.y }; loaded = true; }
      else if (snapT < 0.6) { const f = Math.exp(-snapT * 10) * Math.cos(snapT * 46); pp = { x: ANCH.x + snapP.x * f, y: ANCH.y + snapP.y * f }; }
      const slack = !loaded && snapT >= 0.6;
      if (!front) {
        // trunk + left arm + back band
        ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 20; ctx.beginPath(); ctx.moveTo(ANCH.x, GROUND + 4); ctx.lineTo(ANCH.x, ty + 80); ctx.stroke();
        arm(lx); ctx.stroke();
        ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(ANCH.x, GROUND + 4); ctx.lineTo(ANCH.x, ty + 80); ctx.stroke();
        arm(lx); ctx.stroke();
        ctx.strokeStyle = '#a56a35'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ANCH.x - 3, GROUND); ctx.lineTo(ANCH.x - 3, ty + 84); ctx.stroke();
        ctx.strokeStyle = '#3a1a1a'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(lx, ty); if (slack) ctx.quadraticCurveTo(ANCH.x, ty + 22, rx, ty); else ctx.lineTo(pp.x, pp.y); ctx.stroke();
        // base rocks
        ctx.fillStyle = '#3a3358'; ctx.strokeStyle = '#1a1230'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(ANCH.x - 22, GROUND + 2, 18, 9, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(ANCH.x + 24, GROUND + 2, 14, 7, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      } else {
        ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 20; arm(rx); ctx.stroke();
        ctx.strokeStyle = '#8a5528'; ctx.lineWidth = 13; arm(rx); ctx.stroke();
        ctx.strokeStyle = '#4a2020'; ctx.lineWidth = 7;
        if (!slack) { ctx.beginPath(); ctx.moveTo(rx, ty); ctx.lineTo(pp.x, pp.y); ctx.stroke(); }
        // skull ornament
        ctx.fillStyle = '#efe3c6'; ctx.strokeStyle = '#3a2d52'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ANCH.x, ty + 100, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1a0f2a'; ctx.beginPath(); ctx.arc(ANCH.x - 3.5, ty + 99, 2.2, 0, Math.PI * 2); ctx.arc(ANCH.x + 3.5, ty + 99, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      return { pp, loaded };
    }
    function drawPreview() {
      const av = aimVec(), len = Math.hypot(av.x, av.y);
      if (len < 8) return;
      const x0 = ANCH.x + av.x, y0 = ANCH.y + av.y, vx = -av.x * LAUNCH_K, vy = -av.y * LAUNCH_K;
      for (let i = 1; i < 40; i++) {
        const t = i * 0.055, x = x0 + vx * t, y = y0 + vy * t + 0.5 * GRAV * t * t;
        if (y > GROUND - 4 || x > view.x0 + view.W + 40) break;
        ctx.globalAlpha = Math.max(0.15, 0.95 - i * 0.022);
        ctx.fillStyle = i % 2 ? '#ffe9a8' : '#ffb347';
        ctx.beginPath(); ctx.arc(x, y, Math.max(2, 5 - i * 0.07), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function draw() {
      const s = view.s;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0);
      const sx = shake > 0.3 ? rnd(-shake, shake) : 0, sy = shake > 0.3 ? rnd(-shake, shake) : 0;
      ctx.setTransform(s, 0, 0, s, (-view.x0 + sx) * s, (-view.y0 + sy) * s);
      // twinkles + bats + clouds
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 14; i++) {
        const tx = view.x0 + ((i * 197) % 1000) / 1000 * view.W, ty = view.y0 + ((i * 331) % 1000) / 1000 * Math.max(60, GROUND - view.y0 - 200);
        ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(time * 1.5 + i)); ctx.fillRect(tx, ty, 2.5, 2.5);
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 3; i++) {
        const bx = view.x0 + ((time * (30 + i * 12) + i * 400) % (view.W + 200)) - 100, by = Math.max(view.y0 + 80, 90) + i * 50 + Math.sin(time * 2 + i) * 14, fl = Math.sin(time * 14 + i) * 7;
        ctx.fillStyle = '#0e0720'; ctx.beginPath(); ctx.moveTo(bx - 14, by - fl); ctx.quadraticCurveTo(bx - 6, by - 6, bx, by); ctx.quadraticCurveTo(bx + 6, by - 6, bx + 14, by - fl);
        ctx.quadraticCurveTo(bx + 7, by + 3, bx, by + 6); ctx.quadraticCurveTo(bx - 7, by + 3, bx - 14, by - fl); ctx.fill();
      }
      // sling back
      const sl = drawSling(false);
      // blocks, goblins, pumpkin
      for (const b of bodies) if (b.type === 'box') drawBlock(b);
      for (const b of bodies) if (b.kind === 'goblin') drawGoblin(b);
      if (current) drawPumpkin(current.x, current.y, current.r, current.a, true);
      if (sl.loaded && (pumpkinsLeft > 0 || state === 'ready')) {
        const sc = loadT < 1 ? 0.3 + 0.7 * (1 - Math.pow(1 - loadT, 3)) * 1.0 : 1;
        drawPumpkin(sl.pp.x, sl.pp.y, 24, 0, true, sc);
      }
      drawSling(true);
      if (state === 'ready' && (mode !== 'none')) drawPreview();
      // particles
      for (const p of parts) {
        const f = clamp(p.life / p.max, 0, 1);
        ctx.globalAlpha = p.shape === 'smoke' ? f * 0.8 : Math.min(1, f * 2);
        ctx.fillStyle = p.col;
        if (p.shape === 'smoke') { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.4 - f * 0.6), 0, Math.PI * 2); ctx.fill(); }
        else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); if (p.shape === 'bone') ctx.fillRect(-p.size * 1.4, -p.size * 0.4, p.size * 2.8, p.size * 0.8); else ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore(); }
      }
      ctx.globalAlpha = 1;
      for (const p of pops) {
        const f = p.t / 1.4; ctx.globalAlpha = f > 0.7 ? 1 - (f - 0.7) / 0.3 : 1;
        const pz = 1 + Math.max(0, 0.3 - p.t) * 2;
        drawText(p.text, p.x, p.y - p.t * 46, p.size * pz, p.col, FONT_T);
      }
      ctx.globalAlpha = 1;
      drawHUD();
    }
    function drawHUD() {
      const hu = 1 / Math.max(cssScale, 0.05), vl = view.x0, vt = view.y0, vr = view.x0 + view.W, vb = 720;
      const pad = 14 * hu;
      drawText('Level ' + (level + 1) + '/3', vl + pad, vt + 26 * hu, 26 * hu, '#ffb347', FONT_T, 'left');
      // goblins left
      const gl = goblinsAlive();
      for (let i = 0; i < gl; i++) {
        const gx = vl + pad + 10 * hu + i * 24 * hu, gy = vt + 58 * hu, r = 9 * hu;
        ctx.fillStyle = '#efe3c6'; ctx.strokeStyle = '#3a2d52'; ctx.lineWidth = 1.5 * hu;
        ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4fbf3a'; ctx.beginPath(); ctx.arc(gx - r * 0.35, gy - r * 0.1, r * 0.22, 0, Math.PI * 2); ctx.arc(gx + r * 0.35, gy - r * 0.1, r * 0.22, 0, Math.PI * 2); ctx.fill();
      }
      drawText('Score ' + score, vr - pad, vt + 26 * hu, 22 * hu, '#f3ead8', FONT_B, 'right');
      // ammo
      const ammo = pumpkinsLeft - (state === 'ready' ? 1 : 0);
      for (let i = 0; i < ammo; i++) drawPumpkin(vl + 26 * hu + i * 30 * hu, vb - 24 * hu, 11 * hu, 0, false);
      if (state === 'ready' && pumpkinsLeft === 1) drawText('Last pumpkin!', vl + pad, vb - 24 * hu, 14 * hu, '#ffe9a8', FONT_B, 'left');
      // help
      if (state === 'ready' && shots === 0 && introT < 1.6) {
        const a = 0.6 + 0.4 * Math.sin(time * 4);
        ctx.globalAlpha = a;
        drawText('Drag back and let go to fling!', view.x0 + view.W / 2, vb - 44 * hu, 17 * hu, '#f3ead8', FONT_B);
        drawText('Keys: Up/Down aim, Left/Right power, Space fires', view.x0 + view.W / 2, vb - 22 * hu, 13 * hu, '#a99fbf', FONT_B);
        ctx.globalAlpha = 1;
      }
      if (introT > 0) {
        const f = Math.min(1, introT / 0.5, (2.4 - introT) / 0.3);
        ctx.globalAlpha = clamp(f, 0, 1);
        const cx = view.x0 + view.W / 2, cy = vt + (GROUND - vt) * 0.3;
        drawText(LEVELS[level].name, cx, cy, 52 * Math.max(0.8, Math.min(hu, 2.2)), '#ffb347', FONT_T);
        drawText('Smash all ' + goblinsAlive() + ' goblins!', cx, cy + 40 * Math.max(0.8, Math.min(hu, 2.2)), 20 * hu, '#f3ead8', FONT_B);
        ctx.globalAlpha = 1;
      }
      if (banner) {
        const cx = view.x0 + view.W / 2, cy = vt + (GROUND - vt) * 0.4, k = Math.max(0.8, Math.min(hu, 2.2));
        ctx.fillStyle = 'rgba(10,5,25,0.5)'; ctx.fillRect(vl, cy - 70 * k, view.W, 140 * k);
        drawText(banner.text, cx, cy - 8 * k, 56 * k, banner.col, FONT_T);
        if (banner.sub) drawText(banner.sub, cx, cy + 40 * k, 20 * hu, '#f3ead8', FONT_B);
      }
    }

    // ---------- input ----------
    function toWorld(e) {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * view.W + view.x0, y: (e.clientY - r.top) / r.height * view.H + view.y0 };
    }
    function onDown(e) {
      if (state !== 'ready') return;
      e.preventDefault();
      const p = toWorld(e);
      const near = Math.hypot(p.x - ANCH.x, p.y - ANCH.y) < 80;
      dragging = { id: e.pointerId, ox: near ? ANCH.x : p.x, oy: near ? ANCH.y : p.y };
      mode = 'mouse';
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      onMove(e);
    }
    function onMove(e) {
      if (!dragging || e.pointerId !== dragging.id) return;
      const p = toWorld(e);
      let dx = p.x - dragging.ox, dy = p.y - dragging.oy;
      const l = Math.hypot(dx, dy);
      if (l > PULL_MAX) { dx *= PULL_MAX / l; dy *= PULL_MAX / l; }
      pull = { x: dx, y: dy };
    }
    function onUp(e) {
      if (!dragging || e.pointerId !== dragging.id) return;
      dragging = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (state === 'ready' && Math.hypot(pull.x, pull.y) >= 22) fire(pull);
      else { pull = { x: 0, y: 0 }; mode = 'none'; }
    }
    function onCancel(e) { if (dragging && e.pointerId === dragging.id) { dragging = null; pull = { x: 0, y: 0 }; mode = 'none'; } }
    const ARROWS = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1 };
    function onKeyDown(e) {
      if (ARROWS[e.key]) { keys[e.key] = true; e.preventDefault(); if (state === 'ready' && !dragging) mode = 'kb'; }
      else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (e.repeat || state !== 'ready' || dragging) return;
        if (mode !== 'kb') { mode = 'kb'; return; }
        fire(aimVec());
      }
    }
    function onKeyUp(e) { if (ARROWS[e.key]) { keys[e.key] = false; e.preventDefault(); } }
    function onBlur() { for (const k in keys) keys[k] = false; }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', resize);
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => { resize(); }); ro.observe(canvas); }

    // ---------- main loop ----------
    function frame(t) {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      if (state === 'asking') { last = t; return; }
      const dt = Math.min(0.033, Math.max(0, (t - last) / 1000)); last = t;
      update(dt);
      if (!dead) draw();
    }

    resize();
    loadLevel(0);
    last = performance.now();
    raf = requestAnimationFrame(frame);

    return {
      stop() {
        dead = true;
        cancelAnimationFrame(raf);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('resize', resize);
        if (ro) ro.disconnect();
        canvas.style.touchAction = prevTouch;
      },
    };
  },
};
