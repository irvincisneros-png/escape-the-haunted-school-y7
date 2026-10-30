// Tombstone Hop: original side-scrolling platformer mini game (canvas 2D, no assets).
// A hooded lantern-bearer hops across tombstones, crumbling ledges and coffins over a misty void.

const VH = 360;            // virtual world height
const MIN_VW = 480;        // minimum virtual width visible (keeps portrait phones playable)
const STEP = 1 / 60;
const LEN = 5200;          // level length
const GRAV = 1150;
const JUMP_V = 430;
const RUN = 135;
const COYOTE = 0.11;
const BUFFER = 0.13;
const NEED_ORBS = 4;

const hash = (n) => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function buildLevel() {
  const plats = [];
  const stone = (x, y, w) => plats.push({ t: 'stone', x, y, w });
  const crumble = (x, y, w) => plats.push({ t: 'crumble', x, y, w, st: 0, timer: 0, vy: 0, ox: x, oy: y, shake: 0 });
  const coffin = (x, y, w, ax, ay, sp, ph) => plats.push({ t: 'coffin', x, y, w, x0: x, y0: y, ax, ay, sp, ph: ph || 0, dx: 0, dy: 0 });
  stone(-60, 270, 260);
  stone(250, 265, 80); stone(380, 250, 70); crumble(490, 240, 72); stone(610, 250, 90);
  coffin(760, 235, 64, 80, 0, 1.1); stone(910, 220, 110); crumble(1070, 200, 64);
  stone(1180, 190, 70); stone(1300, 230, 320);
  stone(1670, 235, 80); coffin(1800, 170, 60, 0, 90, 1.0, 0); stone(1925, 170, 90);
  crumble(2070, 185, 60); crumble(2170, 200, 60); stone(2275, 210, 100); stone(2425, 240, 70);
  coffin(2540, 240, 64, 100, 0, 1.0); stone(2755, 225, 135); stone(2940, 200, 70); stone(3060, 175, 70);
  crumble(3180, 160, 70); stone(3300, 190, 220);
  stone(3570, 220, 80); coffin(3710, 235, 60, 90, 0, 1.2, 1.5); crumble(3900, 225, 64); crumble(4000, 210, 64);
  stone(4110, 195, 90); coffin(4270, 160, 60, 0, 90, 0.9, 1); stone(4410, 170, 100); stone(4570, 200, 70);
  stone(4690, 230, 70); stone(4810, 250, 420);
  const orbs = [[655, 212], [1215, 150], [1985, 125], [2320, 165], [3095, 132], [3380, 148], [3745, 175], [4455, 125]]
    .map((o) => ({ x: o[0], y: o[1], got: false, ph: Math.random() * 6 }));
  const bats = [[985, 160, 30, 22, 1.3], [2315, 150, 20, 22, 1.1], [2830, 165, 40, 22, 1.2], [3610, 160, 30, 22, 1.4], [4920, 190, 60, 22, 1.0]]
    .map((b, i) => ({ bx: b[0], by: b[1], rx: b[2], ry: b[3], sp: b[4], ph: i * 1.7, x: b[0], y: b[1] }));
  const cps = [{ x: 1430, y: 230, on: false, gate: true }, { x: 3410, y: 190, on: false }];
  return { plats, orbs, bats, cps, gate: { x: 1555, open: 0, opening: false }, portal: { x: 5020, y: 250 } };
}

export default {
  id: 'platform',
  title: 'Tombstone Hop',
  instructions: 'Reach the portal and grab 4+ orbs! A/D or arrows move, Space/W/Up jump (hold for higher). On touch: left/right buttons and the jump button.',
  start(canvas, api) {
    const ctx = canvas.getContext('2d');
    let stopped = false, raf = 0, last = 0, acc = 0;
    let dpr = 1, scale = 1, vw = MIN_VW, vh = VH, offY = 0;
    let L = buildLevel();
    const sfx = (n) => { try { api.sfx && api.sfx(n); } catch (e) { /* ignore */ } };

    // ---- input ----
    const keys = { left: false, right: false, jump: false };
    const touch = { left: false, right: false, jump: false };
    const pointers = new Map();
    let touchSeen = (navigator.maxTouchPoints || 0) > 0 || !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    let jumpPressed = false;
    const keyMap = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump' };
    const onKeyDown = (e) => {
      const k = keyMap[e.code];
      if (!k) return;
      e.preventDefault();
      if (k === 'jump' && !keys.jump) jumpPressed = true;
      keys[k] = true;
    };
    const onKeyUp = (e) => { const k = keyMap[e.code]; if (k) { e.preventDefault(); keys[k] = false; } };
    const clearInput = () => {
      keys.left = keys.right = keys.jump = false;
      touch.left = touch.right = touch.jump = false;
      pointers.clear();
    };
    const btns = () => {
      const r = clamp(Math.min(canvas.width, canvas.height) * 0.11, 30 * dpr, 70 * dpr);
      const m = r * 0.45, y = canvas.height - m - r * 1.2;
      return {
        r,
        left: { x: m + r, y: canvas.height - m - r, r },
        right: { x: m + r * 3.3, y: canvas.height - m - r, r },
        jump: { x: canvas.width - m - r * 1.3, y, r: r * 1.3 },
      };
    };
    const zoneAt = (px, py) => {
      const b = btns(), pad = 1.3;
      const hit = (c) => Math.hypot(px - c.x, py - c.y) <= c.r * pad;
      if (hit(b.left)) return 'left';
      if (hit(b.right)) return 'right';
      if (hit(b.jump)) return 'jump';
      return px > canvas.width * 0.55 && py < canvas.height - b.r * 3 ? 'jump' : null;
    };
    const recalcTouch = () => {
      touch.left = touch.right = touch.jump = false;
      pointers.forEach((z) => { if (z) touch[z] = true; });
    };
    const ptPos = (e) => {
      const rc = canvas.getBoundingClientRect();
      return [(e.clientX - rc.left) * canvas.width / (rc.width || 1), (e.clientY - rc.top) * canvas.height / (rc.height || 1)];
    };
    const onDown = (e) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') touchSeen = true;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const [x, y] = ptPos(e); const z = zoneAt(x, y);
      pointers.set(e.pointerId, z);
      if (z === 'jump' && !touch.jump) jumpPressed = true;
      recalcTouch();
    };
    const onMove = (e) => {
      if (!pointers.has(e.pointerId)) return;
      const [x, y] = ptPos(e); const z = zoneAt(x, y);
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, z);
      if (z === 'jump' && prev !== 'jump' && !touch.jump) jumpPressed = true;
      recalcTouch();
    };
    const onUp = (e) => { pointers.delete(e.pointerId); recalcTouch(); };
    const onBlur = () => clearInput();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    const onCtx = (e) => e.preventDefault();
    canvas.addEventListener('contextmenu', onCtx);
    const prevTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';

    // ---- resize ----
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      const w = Math.max(2, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(2, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      scale = Math.min(h / VH, w / (h > w ? 340 : MIN_VW));
      vw = w / scale; vh = h / scale;
      offY = (vh - VH) * 0.55;
    };
    window.addEventListener('resize', resize);
    resize();

    // ---- state ----
    const pl = { x: 40, y: 270, vx: 0, vy: 0, hw: 6.5, h: 22, face: 1, ground: null, coyote: 0, buffer: 0, wasGround: false, anim: 0, squash: 0, invuln: 0 };
    const G = {
      lives: 4, orbs: 0, shield: false, cp: null, safe: { x: 40, y: 270 }, sinceSpawn: 0,
      awaiting: false, ending: 0, endType: '', done: false, time: 0, shake: 0, camX: 0, msg: '', msgT: 0, flash: 0,
    };
    const parts = [];
    let cpStart = { x: 40, y: 270 };
    const toast = (m, t) => { G.msg = m; G.msgT = t || 2.2; };
    toast('Collect 5+ orbs and reach the portal!', 3.5);

    const burst = (x, y, n, col, sp, life, g, size) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = sp * (0.3 + Math.random() * 0.7);
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - sp * 0.2, life: life * (0.6 + Math.random() * 0.4), max: life, col, g: g || 0, sz: size || 2 });
      }
    };

    const respawn = (x, y, resetFog) => {
      pl.x = x; pl.y = y; pl.vx = 0; pl.vy = 0; pl.ground = null; pl.coyote = 0;
      if (resetFog) G.sinceSpawn = 0;
      G.camX = clamp(x - vw * 0.38, 0, Math.max(0, LEN - vw));
    };

    const finish = (type) => {
      if (G.done || G.ending) return;
      G.ending = 1.0; G.endType = type;
    };

    const damage = (why) => {
      if ((pl.invuln > 0 && why !== 'fall') || G.ending) return;
      sfx('hit');
      G.shake = 9; G.flash = 0.35;
      burst(pl.x, pl.y - 11, 16, '#e0384a', 160, 0.7, 300, 2);
      G.lives -= 1;
      if (G.lives <= 0) { finish('lose'); return; }
      const c = G.cp || { x: cpStart.x, y: cpStart.y };
      respawn(c.x, c.y, true);
      pl.invuln = 1.6;
      toast(why === 'bat' ? 'A bat got you! Back to the checkpoint.' : 'You fell! Back to the checkpoint.');
    };

    const fall = () => {
      if (G.shield) {
        G.shield = false; sfx('hit');
        burst(pl.x, pl.y - 20, 18, '#7dff6a', 140, 0.8, 0, 2.5);
        respawn(G.safe.x, G.safe.y, false);
        pl.invuln = 1.2; G.sinceSpawn = Math.max(0, G.sinceSpawn - 6);
        toast('Shield saved you from the fall!');
      } else damage('fall');
    };

    const doGate = async () => {
      G.awaiting = true; clearInput();
      let ok = false;
      try { ok = !!(await api.ask()); } catch (e) { ok = false; }
      if (stopped) return;
      G.awaiting = false; last = 0;
      L.gate.opening = true;
      if (ok) { G.shield = true; sfx('key'); toast('Correct! Shield gained: one free fall.', 3); burst(pl.x, pl.y - 12, 20, '#7dff6a', 150, 0.9, 0, 2.5); }
      else toast('Not quite, but the gate opens anyway.', 3);
    };

    // ---- update ----
    function update(dt) {
      G.time += dt;
      if (G.shake > 0) G.shake = Math.max(0, G.shake - 30 * dt);
      if (G.flash > 0) G.flash -= dt;
      if (G.msgT > 0) G.msgT -= dt;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      }
      // gate
      if (L.gate.opening && L.gate.open < 1) L.gate.open = Math.min(1, L.gate.open + dt * 1.2);
      // platforms
      for (const p of L.plats) {
        if (p.t === 'coffin') {
          const s = 0.5 + 0.5 * Math.sin(G.time * p.sp + p.ph);
          const nx = p.x0 + p.ax * s, ny = p.y0 + p.ay * s;
          p.dx = nx - p.x; p.dy = ny - p.y; p.x = nx; p.y = ny;
        } else if (p.t === 'crumble') {
          if (p.st === 1) { p.timer -= dt; p.shake = 1.6; if (p.timer <= 0) { p.st = 2; p.vy = 0; p.timer = 2.8; burst(p.x + p.w / 2, p.y + 6, 10, '#6b5d7a', 90, 0.8, 300, 2.5); } }
          else if (p.st === 2) { p.vy += 700 * dt; p.y += p.vy * dt; p.timer -= dt; if (p.timer <= 0) { p.st = 0; p.y = p.oy; p.shake = 0; } }
        }
      }
      if (G.ending > 0) {
        G.ending -= dt;
        if (G.endType === 'win') { pl.x += (L.portal.x - pl.x) * 3 * dt; pl.y += (L.portal.y - 12 - pl.y) * 3 * dt; burst(L.portal.x, L.portal.y - 24, 2, '#a98bff', 90, 0.8, 0, 2); }
        if (G.ending <= 0) { G.done = true; if (G.endType === 'win') api.win(); else api.lose(); }
        return;
      }
      G.sinceSpawn += dt;
      if (pl.invuln > 0) pl.invuln -= dt;

      // carry
      if (pl.ground && pl.ground.t === 'coffin') { pl.x += pl.ground.dx; pl.y += pl.ground.dy; }
      // horizontal
      const dir = (keys.right || touch.right ? 1 : 0) - (keys.left || touch.left ? 1 : 0);
      const target = dir * RUN, acc2 = pl.ground ? 1500 : 1000;
      if (dir !== 0) { pl.face = dir; pl.vx += clamp(target - pl.vx, -acc2 * dt, acc2 * dt); }
      else pl.vx += clamp(-pl.vx, -(pl.ground ? 1700 : 500) * dt, (pl.ground ? 1700 : 500) * dt);
      pl.x += pl.vx * dt;
      if (pl.x < 10) { pl.x = 10; pl.vx = 0; }
      if (L.gate.open < 1 && pl.x + pl.hw > L.gate.x) { pl.x = L.gate.x - pl.hw; pl.vx = 0; }

      // jump input
      const jumpHeld = keys.jump || touch.jump;
      if (jumpPressed) { pl.buffer = BUFFER; jumpPressed = false; }
      pl.buffer -= dt; pl.coyote -= dt;
      if (pl.buffer > 0 && pl.coyote > 0) {
        pl.vy = -JUMP_V; pl.buffer = 0; pl.coyote = 0; pl.ground = null;
        sfx('jump'); burst(pl.x, pl.y, 5, '#8e82a6', 60, 0.4, 100, 1.8); pl.squash = -0.2;
      }
      if (!jumpHeld && pl.vy < -170) pl.vy = -170; // variable height: cut when released

      // vertical
      const prevFeet = pl.y;
      pl.vy = Math.min(pl.vy + GRAV * dt, 720);
      pl.y += pl.vy * dt;
      let landed = null;
      if (pl.vy >= 0) {
        for (const p of L.plats) {
          if (p.t === 'crumble' && p.st === 2) continue;
          if (pl.x + pl.hw > p.x && pl.x - pl.hw < p.x + p.w && prevFeet <= p.y + 7 && pl.y >= p.y) {
            if (!landed || p.y < landed.y) landed = p;
          }
        }
      }
      if (landed) {
        if (!pl.wasGround && pl.vy > 260) { sfx('land'); burst(pl.x, landed.y, 6, '#8e82a6', 70, 0.4, 120, 1.8); pl.squash = 0.3; }
        pl.y = landed.y; pl.vy = 0; pl.ground = landed; pl.coyote = COYOTE;
        if (landed.t === 'crumble' && landed.st === 0) { landed.st = 1; landed.timer = 0.55; }
        if (landed.t === 'stone') {
          G.safe.x = clamp(pl.x, landed.x + 14, landed.x + landed.w - 14); G.safe.y = landed.y;
        }
      } else pl.ground = null;
      pl.wasGround = !!landed;
      pl.squash *= Math.pow(0.001, dt);
      if (pl.ground && Math.abs(pl.vx) > 20) {
        pl.anim += Math.abs(pl.vx) * dt * 0.1;
        if (Math.random() < 0.08) burst(pl.x - pl.face * 5, pl.y, 1, '#8e82a6', 25, 0.35, 0, 1.4);
      }

      // fog / fall
      const fy = fogY();
      if (pl.y > fy + 8 || pl.y > VH + 120) fall();

      // checkpoints
      for (const c of L.cps) {
        if (!c.on && Math.abs(pl.x - c.x) < 24 && Math.abs(pl.y - c.y) < 50) {
          c.on = true; G.cp = c; G.sinceSpawn = 0; sfx('key');
          burst(c.x, c.y - 20, 22, '#7dff6a', 130, 1, 0, 2.2);
          toast('Checkpoint!');
          if (c.gate) doGate();
        }
      }
      // orbs
      for (const o of L.orbs) {
        if (!o.got && Math.hypot(pl.x - o.x, pl.y - 11 - o.y) < 17) {
          o.got = true; G.orbs++; sfx('key');
          burst(o.x, o.y, 14, '#7dffe0', 130, 0.7, 0, 2);
          toast('Spirit orb ' + G.orbs + '/8', 1.4);
        }
      }
      // bats
      for (const b of L.bats) {
        b.x = b.bx + Math.sin(G.time * b.sp + b.ph) * b.rx;
        b.y = b.by + Math.sin(G.time * b.sp * 1.7 + b.ph) * b.ry;
        if (pl.invuln <= 0 && Math.abs(b.x - pl.x) < 12 && Math.abs(b.y - (pl.y - 11)) < 13) damage('bat');
      }
      // portal
      const P = L.portal;
      if (Math.abs(pl.x - P.x) < 24 && Math.abs(pl.y - P.y) < 50) {
        if (G.orbs >= NEED_ORBS) { finish('win'); sfx('key'); toast('Portal open!', 2); }
        else if (G.msgT <= 0 || G.msg.indexOf('orbs') < 0) toast('The portal needs ' + NEED_ORBS + ' orbs (you have ' + G.orbs + ').', 2.5);
      }
      // lantern ember
      if (Math.random() < 0.15) parts.push({ x: pl.x + pl.face * 9, y: pl.y - 7, vx: (Math.random() - 0.5) * 12, vy: -18 - Math.random() * 14, life: 0.8, max: 0.8, col: '#ffcf6a', g: 0, sz: 1.3 });
      G.camX += (clamp(pl.x - vw * 0.38 + pl.face * 30, 0, Math.max(0, LEN - vw)) - G.camX) * (1 - Math.exp(-6 * dt));
    }

    function fogY() { return Math.max(284, 410 - G.sinceSpawn * 3.2); }

    // ---- drawing helpers ----
    function drawTree(x, base, len, seedBase) {
      const branch = (bx, by, l, ang, d, idx) => {
        const ex = bx + Math.sin(ang) * l, ey = by - Math.cos(ang) * l;
        ctx.lineWidth = d * 1.3 + 0.6;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
        if (d <= 0) return;
        const a1 = 0.35 + hash(seedBase + idx) * 0.5, a2 = 0.35 + hash(seedBase + idx + 50) * 0.5;
        branch(ex, ey, l * (0.68 + hash(seedBase + idx + 9) * 0.12), ang - a1, d - 1, idx * 2 + 1);
        if (hash(seedBase + idx + 20) > 0.15) branch(ex, ey, l * 0.72, ang + a2, d - 1, idx * 2 + 2);
      };
      branch(x, base, len, (hash(seedBase) - 0.5) * 0.2, 4, 1);
    }

    function drawBackground() {
      const cam = G.camX, top = -offY - 10, bot = vh - offY + 10;
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, '#080616'); g.addColorStop(0.5, '#1a1230'); g.addColorStop(0.85, '#2b1d45'); g.addColorStop(1, '#201638');
      ctx.fillStyle = g; ctx.fillRect(0, top, vw, bot - top);
      // stars
      for (let i = 0; i < 70; i++) {
        const sx = ((hash(i) * 1400 - cam * 0.03) % 1400 + 1400) % 1400 * (vw / 1400), sy = top + hash(i + 99) * (VH * 0.65 + offY);
        ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(G.time * (0.6 + hash(i + 5)) + i));
        ctx.fillStyle = '#f3ead8'; ctx.fillRect(sx, sy, 1.4, 1.4);
      }
      ctx.globalAlpha = 1;
      // moon
      const mx = vw * 0.76, my = 70;
      const mg = ctx.createRadialGradient(mx, my, 10, mx, my, 130);
      mg.addColorStop(0, 'rgba(255,233,168,0.35)'); mg.addColorStop(1, 'rgba(255,233,168,0)');
      ctx.fillStyle = mg; ctx.fillRect(mx - 140, my - 140, 280, 280);
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(mx, my, 32, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(200,170,110,0.35)';
      for (const c of [[-10, -6, 7], [11, 10, 5], [6, -14, 3.5]]) { ctx.beginPath(); ctx.arc(mx + c[0], my + c[1], c[2], 0, 7); ctx.fill(); }
      // drifting cloud
      ctx.fillStyle = 'rgba(30,22,50,0.8)';
      const cx = ((G.time * 6 + 200) % (vw + 300)) - 150;
      ctx.beginPath(); ctx.ellipse(cx, my + 8, 90, 9, 0, 0, 7); ctx.ellipse(cx + 40, my + 2, 60, 8, 0, 0, 7); ctx.fill();
      // far hills
      ctx.fillStyle = '#17102a';
      ctx.beginPath(); ctx.moveTo(0, bot);
      for (let x = 0; x <= vw + 20; x += 20) ctx.lineTo(x, 262 - 22 * Math.sin((x + cam * 0.08) * 0.008) - 10 * Math.sin((x + cam * 0.08) * 0.021));
      ctx.lineTo(vw, bot); ctx.fill();
      // manor
      const per = 1100, f = 0.14;
      for (let k = Math.floor(cam * f / per); k <= Math.floor((cam * f + vw) / per); k++) {
        const x = k * per + 380 - cam * f, b = 268;
        ctx.fillStyle = '#120c20';
        ctx.fillRect(x, b - 78, 190, 78); ctx.fillRect(x - 28, b - 118, 34, 118); ctx.fillRect(x + 184, b - 100, 30, 100);
        ctx.beginPath(); ctx.moveTo(x - 6, b - 78); ctx.lineTo(x + 95, b - 126); ctx.lineTo(x + 196, b - 78); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 34, b - 118); ctx.lineTo(x - 11, b - 158); ctx.lineTo(x + 12, b - 118); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 178, b - 100); ctx.lineTo(x + 199, b - 136); ctx.lineTo(x + 220, b - 100); ctx.fill();
        for (let w = 0; w < 7; w++) {
          const lit = hash(k * 13 + w) > 0.45;
          if (!lit) continue;
          const fl = 0.7 + 0.3 * Math.sin(G.time * (2 + w) + k);
          ctx.fillStyle = 'rgba(255,170,60,' + (0.55 * fl).toFixed(2) + ')';
          const wx = w < 5 ? x + 14 + w * 36 : (w === 5 ? x - 20 : x + 192);
          const wy = w < 5 ? b - 58 : b - 90;
          ctx.fillRect(wx, wy, 8, 12);
        }
      }
      // dead trees
      ctx.strokeStyle = '#0e0a1a'; ctx.lineCap = 'round';
      const tp = 330, tf = 0.32;
      for (let k = Math.floor(cam * tf / tp) - 1; k <= Math.floor((cam * tf + vw) / tp) + 1; k++) {
        if (hash(k * 3.1) < 0.25) continue;
        drawTree(k * tp + hash(k) * 150 - cam * tf, 300, 46 + hash(k + 7) * 22, k * 17.3);
      }
      // distant gravestones silhouettes
      ctx.fillStyle = '#150e24';
      const sp = 150, sf = 0.55;
      for (let k = Math.floor(cam * sf / sp) - 1; k <= Math.floor((cam * sf + vw) / sp) + 1; k++) {
        const x = k * sp + hash(k + 40) * 80 - cam * sf, h = 26 + hash(k + 3) * 22;
        if (hash(k + 8) > 0.5) { ctx.fillRect(x, 318 - h, 6, h); ctx.fillRect(x - 7, 318 - h * 0.72, 20, 5); }
        else { ctx.beginPath(); ctx.moveTo(x - 9, 318); ctx.lineTo(x - 9, 318 - h + 9); ctx.arc(x, 318 - h + 9, 9, Math.PI, 0); ctx.lineTo(x + 9, 318); ctx.fill(); }
      }
      // mist bands
      for (let i = 0; i < 4; i++) {
        const y = 285 + i * 22;
        ctx.fillStyle = 'rgba(150,135,190,' + (0.07 + i * 0.03) + ')';
        ctx.beginPath(); ctx.moveTo(0, bot);
        for (let x = 0; x <= vw + 20; x += 24) ctx.lineTo(x, y + 6 * Math.sin((x + cam * (0.4 + i * 0.15)) * 0.012 + G.time * (0.4 + i * 0.2)));
        ctx.lineTo(vw, bot); ctx.fill();
      }
    }

    function drawPlatform(p) {
      let x = p.x, y = p.y;
      if (p.t === 'crumble') {
        if (p.st === 2 && p.timer < 0.6) ctx.globalAlpha = Math.max(0, p.timer / 0.6);
        if (p.st === 1) { x += (Math.random() - 0.5) * 2; y += (Math.random() - 0.5) * 1.5; }
      }
      const w = p.w;
      if (p.t === 'coffin') {
        ctx.fillStyle = '#3a2418';
        ctx.beginPath(); ctx.moveTo(x + 7, y); ctx.lineTo(x + w - 7, y); ctx.lineTo(x + w, y + 8); ctx.lineTo(x + w - 9, y + 24); ctx.lineTo(x + 9, y + 24); ctx.lineTo(x, y + 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#6a4630'; ctx.fillRect(x + 6, y, w - 12, 4);
        ctx.strokeStyle = '#a98b5c'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x + w / 2, y + 7); ctx.lineTo(x + w / 2, y + 19); ctx.moveTo(x + w / 2 - 4, y + 11); ctx.lineTo(x + w / 2 + 4, y + 11); ctx.stroke();
        // chains
        ctx.strokeStyle = 'rgba(120,110,140,0.5)'; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + 10, y - 40); ctx.moveTo(x + w - 10, y); ctx.lineTo(x + w - 10, y - 40); ctx.stroke(); ctx.setLineDash([]);
      } else {
        const crum = p.t === 'crumble';
        // hanging rock
        ctx.fillStyle = crum ? '#4a3d4f' : '#2a2338';
        ctx.beginPath(); ctx.moveTo(x + 2, y + 10); ctx.lineTo(x + w - 2, y + 10);
        ctx.lineTo(x + w * 0.7, y + 26 + (w % 13)); ctx.lineTo(x + w * 0.5, y + 38 + (w % 7)); ctx.lineTo(x + w * 0.3, y + 24); ctx.closePath(); ctx.fill();
        // slab
        ctx.fillStyle = crum ? '#7a6a78' : '#5d5675';
        ctx.fillRect(x, y, w, 12);
        ctx.fillStyle = crum ? '#9b8a94' : '#7b7498'; ctx.fillRect(x, y, w, 3);
        ctx.fillStyle = crum ? '#554856' : '#3f3a56';
        ctx.fillRect(x, y + 10, w, 2);
        if (crum) {
          ctx.strokeStyle = '#2a2030'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x + w * 0.3, y); ctx.lineTo(x + w * 0.38, y + 6); ctx.lineTo(x + w * 0.32, y + 12); ctx.moveTo(x + w * 0.7, y + 2); ctx.lineTo(x + w * 0.62, y + 9); ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(90,150,80,0.55)'; // moss
          for (let m = 0; m < w; m += 17) ctx.fillRect(x + m + (p.x % 5), y, 6 + (m % 4), 2);
          if (w >= 80) { // engraved cross
            ctx.fillStyle = '#3a3552'; const cx = x + w / 2; ctx.fillRect(cx - 1, y + 3, 2, 8); ctx.fillRect(cx - 3, y + 5, 6, 2);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawCheckpoint(c) {
      const on = c.on, x = c.x, y = c.y;
      ctx.fillStyle = on ? '#8cc58a' : '#6c6a84';
      ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x - 8, y - 22); ctx.arc(x, y - 22, 8, Math.PI, 0); ctx.lineTo(x + 8, y); ctx.fill();
      ctx.fillStyle = on ? '#29442b' : '#3a3552'; ctx.fillRect(x - 1, y - 24, 2, 11); ctx.fillRect(x - 4, y - 20, 8, 2);
    }
    function drawCheckpointGlow(c) {
      const a = c.on ? 0.8 : 0.28, x = c.x, y = c.y - 18;
      const r = 28 + 4 * Math.sin(G.time * 3);
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, 'rgba(125,255,106,' + a + ')'); g.addColorStop(1, 'rgba(125,255,106,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    function drawGate() {
      const gt = L.gate, x = gt.x, open = gt.open;
      if (open >= 1) return;
      const bot = 330, topY = -offY - 10, lift = open * 260;
      ctx.save();
      ctx.fillStyle = '#2b2740'; ctx.fillRect(x - 12, topY, 24, bot - topY); // pillar frame hint
      ctx.fillStyle = '#1b1830'; ctx.fillRect(x - 10, topY, 20, 0);
      ctx.beginPath(); ctx.rect(x - 14, topY, 28, bot - topY); ctx.clip();
      ctx.translate(0, -lift);
      ctx.strokeStyle = '#6f6a8e'; ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 8, topY - 300); ctx.lineTo(x + i * 8, bot); ctx.stroke(); }
      for (let yy = 40; yy < bot; yy += 40) { ctx.beginPath(); ctx.moveTo(x - 12, yy); ctx.lineTo(x + 12, yy); ctx.stroke(); }
      ctx.restore();
    }

    function drawBat(b) {
      const fl = Math.sin(G.time * 14 + b.ph), x = b.x, y = b.y;
      ctx.fillStyle = '#1a1226';
      ctx.beginPath(); ctx.ellipse(x, y, 5, 6, 0, 0, 7); ctx.fill();
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(x + s * 3, y - 2);
        ctx.quadraticCurveTo(x + s * 14, y - 12 - fl * 7, x + s * 22, y - 2 - fl * 9);
        ctx.quadraticCurveTo(x + s * 17, y + 2, x + s * 14, y + 4 - fl * 3);
        ctx.quadraticCurveTo(x + s * 9, y + 1, x + s * 6, y + 6);
        ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + s * 2, y - 4); ctx.lineTo(x + s * 4, y - 10); ctx.lineTo(x + s * 5, y - 3); ctx.fill();
      }
      ctx.fillStyle = '#ff3a50'; ctx.fillRect(x - 3, y - 2, 2, 2); ctx.fillRect(x + 1, y - 2, 2, 2);
      const g = ctx.createRadialGradient(x, y, 1, x, y, 18);
      g.addColorStop(0, 'rgba(255,60,80,0.25)'); g.addColorStop(1, 'rgba(255,60,80,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 18, y - 18, 36, 36);
    }

    function drawPlayer() {
      if (pl.invuln > 0 && Math.floor(G.time * 14) % 2 === 0) return;
      const moving = pl.ground && Math.abs(pl.vx) > 20;
      const bob = moving ? Math.abs(Math.sin(pl.anim)) * 1.6 : Math.sin(G.time * 2.5) * 0.5;
      let sx = 1 + pl.squash * 0.5, sy = 1 - pl.squash * 0.5;
      if (!pl.ground) { sy += clamp(-pl.vy / 1800, -0.1, 0.12); sx -= clamp(-pl.vy / 3600, -0.05, 0.06); }
      const fade = G.ending > 0 && G.endType === 'win' ? clamp(G.ending, 0, 1) : 1;
      ctx.save(); ctx.globalAlpha = fade;
      ctx.translate(pl.x, pl.y); ctx.scale(pl.face * sx, sy);
      // feet
      const sw = moving ? Math.sin(pl.anim) * 3.5 : 0, lift = pl.ground ? 0 : 2;
      ctx.fillStyle = '#120d1c';
      ctx.fillRect(-4 + sw, -3 - lift, 4, 3); ctx.fillRect(1 - sw, -3 - (moving && Math.cos(pl.anim) > 0.5 ? 1.5 : 0) - lift, 4, 3);
      // cloak
      ctx.translate(0, -bob);
      ctx.fillStyle = '#2f2450';
      ctx.beginPath(); ctx.moveTo(-7, -2);
      const hem = moving ? Math.sin(pl.anim * 2) * 1.5 : 0;
      ctx.lineTo(-8 - (moving ? 1.5 : 0), -2 + hem); ctx.quadraticCurveTo(-7, -14, -3, -19); ctx.lineTo(3, -19); ctx.quadraticCurveTo(7, -14, 7, -2);
      ctx.lineTo(0, -1 - hem); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5c4a8a'; ctx.lineWidth = 1; ctx.stroke();
      // hood
      ctx.fillStyle = '#3b2d63';
      ctx.beginPath(); ctx.arc(0.5, -18, 6.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-4, -22); ctx.quadraticCurveTo(-8, -20, -7, -15); ctx.lineTo(-5, -15); ctx.fill();
      ctx.fillStyle = '#07050b'; ctx.beginPath(); ctx.ellipse(2.5, -18, 3.6, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe9a8'; ctx.fillRect(1.2, -19, 1.5, 2); ctx.fillRect(4, -19, 1.5, 2);
      // arm + lantern
      const swing = Math.sin(G.time * 5) * 0.12 + (-pl.vx / 900) + (pl.ground ? 0 : 0.3);
      ctx.strokeStyle = '#2f2450'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(4, -12); ctx.lineTo(8, -9 - (pl.ground ? 0 : 3)); ctx.stroke();
      ctx.save(); ctx.translate(8, -10 - (pl.ground ? 0 : 3)); ctx.rotate(swing);
      ctx.strokeStyle = '#8a7f9e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 3); ctx.stroke();
      ctx.fillStyle = '#ffcf6a'; ctx.fillRect(-2.5, 3, 5, 6);
      ctx.strokeStyle = '#4a3a22'; ctx.strokeRect(-2.5, 3, 5, 6);
      ctx.fillStyle = '#fff3c0'; ctx.fillRect(-1, 4.5, 2, 3);
      ctx.restore();
      ctx.restore();
    }

    function lanternPos() {
      return { x: pl.x + pl.face * 9, y: pl.y - 7 };
    }

    function drawFog(top) {
      const fy = fogY(), bot = vh - offY + 20;
      for (let i = 0; i < 4; i++) {
        const y = fy + i * 14;
        const g = ctx.createLinearGradient(0, y - 14, 0, y + 70);
        g.addColorStop(0, 'rgba(175,160,215,0)'); g.addColorStop(0.25, 'rgba(165,150,205,' + (0.45 - i * 0.07) + ')'); g.addColorStop(1, 'rgba(110,95,150,0.75)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(G.camX - 10, bot);
        for (let x = 0; x <= vw + 30; x += 24) {
          const wx = G.camX + x;
          ctx.lineTo(wx, y + 7 * Math.sin(wx * 0.018 + G.time * (0.8 + i * 0.5) + i * 2) + 3 * Math.sin(wx * 0.05 - G.time * 1.3));
        }
        ctx.lineTo(G.camX + vw + 30, bot); ctx.closePath(); ctx.fill();
      }
      // warning wisp when fog is close
      if (fy < 330) {
        ctx.fillStyle = 'rgba(180,170,230,' + (0.08 + 0.06 * Math.sin(G.time * 4)) + ')';
        ctx.fillRect(G.camX, fy - 30, vw, 30);
      }
    }

    function drawOrb(o) {
      const bob = Math.sin(G.time * 2.5 + o.ph) * 3, x = o.x, y = o.y + bob;
      const g = ctx.createRadialGradient(x, y, 1, x, y, 22);
      g.addColorStop(0, 'rgba(125,255,224,0.7)'); g.addColorStop(1, 'rgba(125,255,224,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 22, y - 22, 44, 44);
      ctx.fillStyle = '#c9fff3'; ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7dffe0'; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 3, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 3, y); ctx.closePath(); ctx.fill();
    }

    function drawPortal() {
      const P = L.portal, ready = G.orbs >= NEED_ORBS, x = P.x, y = P.y - 30;
      const col = ready ? '169,139,255' : '110,100,140';
      const g = ctx.createRadialGradient(x, y, 4, x, y, 70);
      g.addColorStop(0, 'rgba(' + col + ',' + (ready ? 0.7 : 0.3) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = g; ctx.fillRect(x - 70, y - 70, 140, 140);
      ctx.strokeStyle = 'rgb(' + col + ')'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x, y, 20, 32, 0, 0, 7); ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = 'rgba(' + (ready ? '230,210,255' : '150,140,170') + ',' + (0.6 - i * 0.12) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, y, 14 - i * 3 + Math.sin(G.time * 3 + i) * 2, 26 - i * 5, G.time * (0.6 + i * 0.4), 0, 5); ctx.stroke();
      }
      if (ready && Math.random() < 0.4) parts.push({ x: x + (Math.random() - 0.5) * 30, y: y + 30, vx: 0, vy: -30 - Math.random() * 30, life: 1, max: 1, col: '#c9b5ff', g: 0, sz: 1.6 });
    }

    function drawHUD() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const u = dpr * Math.min(1.25, Math.max(0.8, canvas.height / dpr / 420));
      const m = 10 * u;
      // hearts
      for (let i = 0; i < 4; i++) {
        const x = m + i * 24 * u + 9 * u, y = m + 10 * u, s = 9 * u;
        ctx.fillStyle = i < G.lives ? '#e0384a' : 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
        ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
        ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9); ctx.fill();
      }
      if (G.shield) {
        const x = m + 3 * 24 * u + 9 * u, y = m + 10 * u, s = 9 * u;
        ctx.fillStyle = '#7dff6a'; ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y); ctx.quadraticCurveTo(x + s, y + s, x, y + s * 1.2); ctx.quadraticCurveTo(x - s, y + s, x - s, y); ctx.fill();
      }
      // orbs counter
      ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
      ctx.font = 'bold ' + 16 * u + 'px Nunito, system-ui, sans-serif';
      const label = G.orbs + '/8 orbs';
      const tx = canvas.width - m;
      ctx.fillStyle = 'rgba(13,10,20,0.55)'; const tw = ctx.measureText(label).width;
      ctx.fillRect(tx - tw - 30 * u, m - 2 * u, tw + 36 * u, 24 * u);
      ctx.fillStyle = G.orbs >= NEED_ORBS ? '#7dffe0' : '#f3ead8'; ctx.fillText(label, tx - 4 * u, m + 10 * u);
      ctx.fillStyle = '#7dffe0'; ctx.beginPath(); const ox = tx - tw - 20 * u, oy = m + 10 * u;
      ctx.moveTo(ox, oy - 6 * u); ctx.lineTo(ox + 5 * u, oy); ctx.lineTo(ox, oy + 6 * u); ctx.lineTo(ox - 5 * u, oy); ctx.fill();
      // message
      if (G.msgT > 0 && G.msg) {
        ctx.textAlign = 'center'; ctx.font = 'bold ' + 17 * u + 'px Nunito, system-ui, sans-serif';
        const mw = Math.min(canvas.width - 20 * u, ctx.measureText(G.msg).width + 28 * u);
        ctx.globalAlpha = clamp(G.msgT * 2, 0, 1);
        ctx.fillStyle = 'rgba(13,10,20,0.7)'; ctx.fillRect((canvas.width - mw) / 2, 46 * u, mw, 30 * u);
        ctx.fillStyle = '#f3ead8'; ctx.fillText(G.msg, canvas.width / 2, 61 * u, mw - 10 * u);
        ctx.globalAlpha = 1;
      }
      // touch buttons
      if (touchSeen) {
        const b = btns();
        const draw = (c, on, fn) => {
          ctx.fillStyle = on ? 'rgba(255,122,26,0.55)' : 'rgba(243,234,216,0.18)';
          ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill();
          ctx.strokeStyle = on ? 'rgba(255,200,120,0.9)' : 'rgba(243,234,216,0.45)'; ctx.lineWidth = 2 * dpr; ctx.stroke();
          ctx.fillStyle = 'rgba(243,234,216,0.85)'; fn(c);
        };
        draw(b.left, touch.left, (c) => { ctx.beginPath(); ctx.moveTo(c.x + c.r * 0.3, c.y - c.r * 0.4); ctx.lineTo(c.x - c.r * 0.35, c.y); ctx.lineTo(c.x + c.r * 0.3, c.y + c.r * 0.4); ctx.fill(); });
        draw(b.right, touch.right, (c) => { ctx.beginPath(); ctx.moveTo(c.x - c.r * 0.3, c.y - c.r * 0.4); ctx.lineTo(c.x + c.r * 0.35, c.y); ctx.lineTo(c.x - c.r * 0.3, c.y + c.r * 0.4); ctx.fill(); });
        draw(b.jump, touch.jump, (c) => { ctx.beginPath(); ctx.moveTo(c.x - c.r * 0.4, c.y + c.r * 0.25); ctx.lineTo(c.x, c.y - c.r * 0.35); ctx.lineTo(c.x + c.r * 0.4, c.y + c.r * 0.25); ctx.lineTo(c.x + c.r * 0.4, c.y + c.r * 0.5); ctx.lineTo(c.x, c.y); ctx.lineTo(c.x - c.r * 0.4, c.y + c.r * 0.5); ctx.fill(); });
      }
    }

    function render() {
      const sh = G.shake;
      const shx = sh ? (Math.random() - 0.5) * sh : 0, shy = sh ? (Math.random() - 0.5) * sh : 0;
      ctx.setTransform(scale, 0, 0, scale, shx * scale, (offY + shy) * scale);
      drawBackground();
      ctx.save(); ctx.translate(-Math.round(G.camX * 4) / 4, 0);
      const x0 = G.camX - 40, x1 = G.camX + vw + 40;
      for (const p of L.plats) if (p.x + p.w > x0 && p.x < x1) drawPlatform(p);
      for (const c of L.cps) drawCheckpoint(c);
      drawGate();
      drawPlayer();
      drawFog();
      ctx.restore();
      // lantern darkness
      const lp = lanternPos();
      const sxp = lp.x - G.camX, syp = lp.y;
      const fl = 1 + 0.04 * Math.sin(G.time * 9) + 0.03 * Math.sin(G.time * 23);
      const R = 290 * fl;
      const dg = ctx.createRadialGradient(sxp, syp, 20, sxp, syp, R);
      dg.addColorStop(0, 'rgba(6,3,14,0)'); dg.addColorStop(0.4, 'rgba(6,3,14,0.12)'); dg.addColorStop(1, 'rgba(6,3,14,0.74)');
      ctx.fillStyle = dg; ctx.fillRect(-4, -offY - 4, vw + 8, vh + 8);
      // warm glow
      ctx.globalCompositeOperation = 'lighter';
      const wg = ctx.createRadialGradient(sxp, syp, 2, sxp, syp, 95 * fl);
      wg.addColorStop(0, 'rgba(255,190,90,0.38)'); wg.addColorStop(1, 'rgba(255,150,40,0)');
      ctx.fillStyle = wg; ctx.fillRect(sxp - 100, syp - 100, 200, 200);
      ctx.globalCompositeOperation = 'source-over';
      // bright layer
      ctx.save(); ctx.translate(-Math.round(G.camX * 4) / 4, 0);
      for (const c of L.cps) drawCheckpointGlow(c);
      drawPortal();
      for (const o of L.orbs) if (!o.got && o.x > x0 && o.x < x1) drawOrb(o);
      for (const b of L.bats) if (b.x > x0 - 30 && b.x < x1 + 30) drawBat(b);
      for (const p of parts) {
        ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.col;
        ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      // damage flash
      if (G.flash > 0) { ctx.fillStyle = 'rgba(224,56,74,' + clamp(G.flash, 0, 0.35) + ')'; ctx.fillRect(-4, -offY - 4, vw + 8, vh + 8); }
      drawHUD();
    }

    function frame(now) {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      if (canvas.clientWidth * dpr - canvas.width > 1.5 || canvas.width - canvas.clientWidth * dpr > 1.5 ||
          Math.abs(canvas.clientHeight * dpr - canvas.height) > 1.5) resize();
      if (!last) last = now;
      let dt = (now - last) / 1000; last = now;
      if (dt > 0.1) dt = 0.1;
      if (!G.awaiting && !G.done) {
        acc += dt;
        while (acc >= STEP) { update(STEP); acc -= STEP; }
      } else acc = 0;
      render();
    }

    respawn(pl.x, pl.y, true);
    raf = requestAnimationFrame(frame);

    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('resize', resize);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('contextmenu', onCtx);
        canvas.style.touchAction = prevTouchAction;
        clearInput();
      },
    };
  },
};
