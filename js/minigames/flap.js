// Bat Flap: tap to flap a little bat through the gaps between haunted stone
// pillars in a moonlit library. Original art and rules, drawn with canvas
// shapes only. No imports.

const W = 400;               // virtual world width
const H = 600;               // virtual world height
const FLOOR_H = 26;          // stone floor strip at the bottom
const FLOOR_Y = H - FLOOR_H;
const PW = 54;               // pillar column width
const SPACING = 300;         // distance between pillar columns
const GOAL = 10;             // gaps to pass to win
const CHECK_GAP = 5;          // this gap carries the checkpoint (appears after gap 4)
const STEP = 1 / 60;         // fixed timestep in seconds
const GRAVITY = 900;
const FLAP_VY = -340;
const MAX_FALL = 640;
const BAT_X = 110;           // the bat stays at this x; the world scrolls past it
const BAT_R = 11;            // collision radius
const INVULN = 1.5;          // seconds of blinking after a hit
const BOUNCE_VY = -240;      // floor bounce

// Rune glyphs: lists of line segments in a [-1, 1] box.
const RUNES = [
  [[-1, -1, 1, 1], [-1, 1, 1, -1]],
  [[0, -1, 0, 1], [-1, 0, 1, 0]],
  [[-1, -1, 0, -1], [0, -1, 0, 1], [0, 1, 1, 1]],
  [[-1, 1, 0, -1], [0, -1, 1, 1], [-0.5, 0, 0.5, 0]],
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Gaps start wide and tighten slightly.
function gapSize(passes) { return Math.max(205, 260 - passes * 4); }
// Scroll speed (world units per second) ramps up slowly.
function scrollSpeed(passes) { return Math.min(95, 65 + passes * 2.5); }

function hitsRect(cx, cy, r, x, y, w, h) {
  if (h <= 0) return false;
  const nx = clamp(cx, x, x + w);
  const ny = clamp(cy, y, y + h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function orbY(o, t) { return o.y + Math.sin(t * 3 + o.ph) * 6; }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Bookcases for the middle parallax layer, generated once per game.
function makeShelves() {
  const colors = ['#4a1f2e', '#2e3b5c', '#5b3a1e', '#2f4a3a', '#5a2a5e', '#3c3c4e', '#6b4f1d', '#20404a'];
  const cases = [];
  for (let c = 0; c < 3; c++) {
    const rows = [];
    for (let r = 0; r < 3; r++) {
      const books = [];
      let bx = 0;
      while (bx < 108) {
        const bw = 4 + Math.random() * 5;
        books.push({ x: bx, w: bw, h: 30 + Math.random() * 16, c: colors[(Math.random() * colors.length) | 0] });
        bx += bw + 0.6;
      }
      rows.push(books);
    }
    cases.push({ x: c * 135, w: 118, rows });
  }
  return cases;
}

// Draws a parallax layer twice so it tiles seamlessly across the 400-unit width.
function drawTiled(offset, draw) {
  const x0 = -(((offset % W) + W) % W);
  draw(x0);
  draw(x0 + W);
}

function drawSky(ctx, stars, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  sky.addColorStop(0, '#0b0715');
  sky.addColorStop(0.5, '#241041');
  sky.addColorStop(1, '#4a1d5c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#f3ead8';
  for (const s of stars) {
    ctx.globalAlpha = clamp(0.5 + 0.4 * Math.sin(t * 1.7 + s.ph), 0.1, 1);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const mx = 290, my = 120, mr = 50;
  const glow = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3.2);
  glow.addColorStop(0, 'rgba(255,233,168,0.35)');
  glow.addColorStop(1, 'rgba(255,233,168,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(mx, my, mr * 3.2, 0, Math.PI * 2);
  ctx.fill();

  const disc = ctx.createRadialGradient(mx - 12, my - 14, 6, mx, my, mr);
  disc.addColorStop(0, '#fffbea');
  disc.addColorStop(0.6, '#ffe9a8');
  disc.addColorStop(1, '#e8c77a');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(160,110,40,0.22)';
  for (const [dx, dy, r] of [[-18, -8, 9], [12, 10, 6], [-4, 18, 4.5], [20, -18, 4]]) {
    ctx.beginPath();
    ctx.arc(mx + dx, my + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Far layer: a dark library wall with tall arched windows and moonlight shafts.
function drawFarWall(ctx, sx) {
  const top = 170;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#1a1230';
  ctx.fillRect(sx, top, W, FLOOR_Y - top);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let x = 0; x < W; x += 40) ctx.fillRect(sx + x, top, 2, FLOOR_Y - top);

  for (const wx of [30, 230]) {
    const x = sx + wx;
    const wt = 210, w = 58, h = 130;
    const shaft = ctx.createLinearGradient(0, wt + h, 0, wt + h + 160);
    shaft.addColorStop(0, 'rgba(255,233,168,0.16)');
    shaft.addColorStop(1, 'rgba(255,233,168,0)');
    ctx.fillStyle = shaft;
    ctx.beginPath();
    ctx.moveTo(x, wt + h);
    ctx.lineTo(x + w, wt + h);
    ctx.lineTo(x + w + 30, wt + h + 160);
    ctx.lineTo(x - 30, wt + h + 160);
    ctx.closePath();
    ctx.fill();

    archPath(ctx, x, wt, w, h);
    ctx.fillStyle = '#2b2150';
    ctx.fill();
    archPath(ctx, x + 4, wt + 4, w - 8, h - 4);
    const glass = ctx.createLinearGradient(0, wt, 0, wt + h);
    glass.addColorStop(0, '#5a4c8a');
    glass.addColorStop(1, '#2a2050');
    ctx.fillStyle = glass;
    ctx.fill();

    ctx.strokeStyle = '#120c1c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, wt + 4);
    ctx.lineTo(x + w / 2, wt + h);
    ctx.moveTo(x + 4, wt + h * 0.45);
    ctx.lineTo(x + w - 4, wt + h * 0.45);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Arched window outline: flat bottom, round top.
function archPath(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + w / 2);
  ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

// Middle layer: bookshelves with coloured spines.
function drawShelves(ctx, shelves, sx) {
  ctx.globalAlpha = 0.75;
  for (const cs of shelves) {
    const x0 = sx + cs.x;
    ctx.fillStyle = '#120c1c';
    ctx.fillRect(x0, 380, cs.w, FLOOR_Y - 380);
    cs.rows.forEach((books, r) => {
      const board = 442 + r * 60;
      ctx.fillStyle = '#2a1f3c';
      ctx.fillRect(x0, board, cs.w, 4);
      for (const bk of books) {
        ctx.fillStyle = bk.c;
        ctx.fillRect(x0 + bk.x, board - bk.h, bk.w, bk.h);
      }
    });
  }
  ctx.globalAlpha = 1;
}

function drawFloor(ctx, scroll) {
  ctx.fillStyle = '#1a1226';
  ctx.fillRect(0, FLOOR_Y, W, FLOOR_H);
  ctx.fillStyle = '#4a3a66';
  ctx.fillRect(0, FLOOR_Y, W, 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const off = scroll % 40;
  for (let x = -off; x < W + 40; x += 40) {
    ctx.moveTo(x, FLOOR_Y + 2);
    ctx.lineTo(x - 8, H);
  }
  ctx.stroke();
}

// Glowing green rune glyph carved into a pillar.
function drawRune(ctx, cx, cy, idx, alpha) {
  const glyph = RUNES[Math.abs(idx) % RUNES.length];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#7dff6a';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.shadowColor = '#7dff6a';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  for (const s of glyph) {
    ctx.moveTo(cx + s[0] * 5, cy + s[1] * 6);
    ctx.lineTo(cx + s[2] * 5, cy + s[3] * 6);
  }
  ctx.stroke();
  ctx.restore();
}

// One stone pillar segment. capAtBottom is true for the top half of a gap pair.
function drawColumn(ctx, x, y, w, h, capAtBottom, t, seed) {
  if (h <= 0) return;
  const body = ctx.createLinearGradient(x, 0, x + w, 0);
  body.addColorStop(0, '#221c2e');
  body.addColorStop(0.3, '#4f4362');
  body.addColorStop(0.55, '#3a3049');
  body.addColorStop(1, '#17121f');
  ctx.fillStyle = body;
  ctx.fillRect(x, y, w, h);

  // Mortar courses and one crack.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (let yy = y + 22; yy < y + h - 4; yy += 22) ctx.fillRect(x, yy, w, 1.5);
  if (h > 70) {
    const cy0 = y + 30 + ((seed * 53) % (h - 60));
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.7, cy0);
    ctx.lineTo(x + w * 0.6, cy0 + 8);
    ctx.lineTo(x + w * 0.75, cy0 + 14);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x, y, 3, h);

  // Carved runes that pulse faintly.
  const inTop = capAtBottom ? y + 8 : y + 26;
  const inBot = capAtBottom ? y + h - 26 : y + h - 8;
  for (let yy = inTop + 14; yy < inBot - 6; yy += 44) {
    const pulse = 0.55 + 0.35 * Math.sin(t * 2 + yy * 0.05 + seed);
    drawRune(ctx, x + w / 2, yy, seed + Math.round(yy / 44), pulse);
  }

  // Stone cap that overhangs the column.
  const capY = capAtBottom ? y + h - 18 : y;
  const cap = ctx.createLinearGradient(x - 6, 0, x + w + 6, 0);
  cap.addColorStop(0, '#2e2640');
  cap.addColorStop(0.35, '#6a5b80');
  cap.addColorStop(1, '#1d1729');
  ctx.fillStyle = cap;
  ctx.fillRect(x - 6, capY, w + 12, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x - 6, capY, w + 12, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x - 6, capY + 16, w + 12, 2);
}

// The checkpoint: a glowing moon-gold sigil in the gap.
function drawCheckpoint(ctx, p, t) {
  const cx = p.x + PW / 2;
  const cy = p.gy;
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, 70);
  halo.addColorStop(0, `rgba(255,233,168,${0.45 + 0.3 * pulse})`);
  halo.addColorStop(1, 'rgba(255,233,168,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, 70, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ffe9a8';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(cx, cy, 20 + pulse * 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '800 22px Nunito, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', cx, cy + 1);
  ctx.restore();
}

// Candle orb: a small flame-coloured light worth +1.
function drawOrb(ctx, o, y, t) {
  const pulse = 0.7 + 0.3 * Math.sin(t * 6 + o.ph);
  const g = ctx.createRadialGradient(o.x, y, 1, o.x, y, 16);
  g.addColorStop(0, 'rgba(255,243,196,1)');
  g.addColorStop(0.35, 'rgba(255,154,58,0.9)');
  g.addColorStop(1, 'rgba(255,122,26,0)');
  ctx.globalAlpha = pulse;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(o.x, y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff8e0';
  ctx.beginPath();
  ctx.arc(o.x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

// Bat wing outline. lift > 0 raises the tip, lift < 0 lowers it.
function wingPath(ctx, lift) {
  const tipY = -9 - lift * 18;
  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.quadraticCurveTo(-10, -7 - lift * 10, -24, tipY);
  ctx.quadraticCurveTo(-19, -4 - lift * 4, -18, 1);
  ctx.quadraticCurveTo(-15, -1, -14, 4);
  ctx.quadraticCurveTo(-10, 0, -8, 5);
  ctx.quadraticCurveTo(-5, 1, 0, 3);
  ctx.closePath();
}

function drawBat(ctx, g) {
  const b = g.bat;
  const blink = g.invuln > 0 && Math.floor(g.invuln * 12) % 2 === 0;
  const bob = g.mode === 'ready' ? Math.sin(g.t * 3) * 8 : 0;
  const angle = clamp(b.vy / 900, -0.5, 0.65);
  const lift = Math.sin(g.t * (b.vy < -60 ? 24 : 14));

  ctx.save();
  ctx.globalAlpha = blink ? 0.3 : 1;
  ctx.translate(b.x, b.y + bob);
  ctx.rotate(angle);
  // Moonlit halo so the dark bat reads against the dark library.
  const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 44);
  halo.addColorStop(0, 'rgba(255,233,168,0.35)');
  halo.addColorStop(1, 'rgba(255,233,168,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(-44, -44, 88, 88);
  ctx.scale(1.6, 1.6);

  // Far wing, darker, behind the body.
  ctx.save();
  ctx.translate(1, 1);
  ctx.scale(0.85, 0.9);
  wingPath(ctx, -lift * 0.8);
  ctx.fillStyle = '#120b1d';
  ctx.fill();
  ctx.restore();

  // Near wing.
  wingPath(ctx, lift);
  ctx.fillStyle = '#2a1d3f';
  ctx.fill();
  ctx.strokeStyle = '#6b5a8f';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Tail.
  ctx.fillStyle = '#150e20';
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.quadraticCurveTo(-12, 6, -15, 2);
  ctx.quadraticCurveTo(-11, 3, -6, 0);
  ctx.fill();

  // Body and head.
  ctx.fillStyle = '#150e20';
  ctx.strokeStyle = '#4a3a66';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(6, -3, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Ears.
  ctx.beginPath();
  ctx.moveTo(1, -6);
  ctx.lineTo(2, -13);
  ctx.lineTo(5, -7);
  ctx.closePath();
  ctx.moveTo(5, -7);
  ctx.lineTo(8, -12);
  ctx.lineTo(8, -4);
  ctx.closePath();
  ctx.fill();

  // Glowing eye.
  ctx.fillStyle = '#ffb347';
  ctx.shadowColor = '#ff7a1a';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(7.2, -3.6, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawParticles(ctx, parts) {
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHeart(ctx, x, y, s, filled) {
  ctx.beginPath();
  ctx.moveTo(x, y + s);
  ctx.bezierCurveTo(x - s * 1.4, y, x - s * 0.5, y - s * 1.2, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 1.2, x + s * 1.4, y, x, y + s);
  ctx.closePath();
  ctx.fillStyle = filled ? '#e0384a' : 'rgba(243,234,216,0.18)';
  ctx.fill();
}

function drawHUD(ctx, g) {
  ctx.save();
  roundRect(ctx, 8, 8, W - 16, 36, 10);
  ctx.fillStyle = 'rgba(13,10,20,0.7)';
  ctx.fill();
  ctx.strokeStyle = '#3a2d52';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.font = '800 15px Nunito, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f3ead8';
  ctx.fillText(`GAPS ${g.passes}/${GOAL}`, 20, 27);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(`SCORE ${g.score}`, W - 20, 27);

  const slots = clamp(Math.max(3, g.lives), 3, 6);
  const x0 = W / 2 - ((slots - 1) * 15) / 2;
  for (let i = 0; i < slots; i++) drawHeart(ctx, x0 + i * 15, 26, 5.5, i < g.lives);

  ctx.fillStyle = 'rgba(243,234,216,0.15)';
  ctx.fillRect(14, 39, W - 28, 3);
  ctx.fillStyle = '#ff7a1a';
  ctx.fillRect(14, 39, (W - 28) * clamp(g.passes / GOAL, 0, 1), 3);
  ctx.restore();
}

function drawReady(ctx, t) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4);
  ctx.font = '30px Creepster, Nunito, system-ui, sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.shadowColor = '#ff7a1a';
  ctx.shadowBlur = 12;
  ctx.fillText('Tap to start', W / 2, H * 0.66);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.8;
  ctx.font = '700 15px Nunito, system-ui, sans-serif';
  ctx.fillStyle = '#f3ead8';
  ctx.fillText('Tap, click or press Space to flap', W / 2, H * 0.66 + 34);
  ctx.restore();
}

function drawBanner(ctx, text, alpha) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.font = '800 16px Nunito, system-ui, sans-serif';
  const w = ctx.measureText(text).width + 28;
  roundRect(ctx, W / 2 - w / 2, 54, w, 30, 15);
  ctx.fillStyle = 'rgba(13,10,20,0.75)';
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, 69);
  ctx.restore();
}

export default {
  id: 'flap',
  title: 'Bat Flap',
  instructions: 'Tap, click or press Space to flap through the gaps. Pass 10 gaps to win. Grab glowing orbs for points. Hitting a pillar or the floor costs a life.',

  start(canvas, api) {
    const ctx = canvas.getContext('2d');
    const prevTouch = canvas.style.touchAction;
    canvas.style.touchAction = 'none';
    const sfx = (name) => { try { api.sfx(name); } catch (e) { /* audio is optional */ } };

    let alive = true;
    let raf = 0;
    let last = null;
    let acc = 0;
    let scaleF = 1, ox = 0, oy = 0;

    const stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * 320,
      r: 0.4 + Math.random() * 1.2,
      ph: Math.random() * Math.PI * 2,
    }));
    const shelves = makeShelves();

    const g = {
      mode: 'ready',        // 'ready' | 'play' | 'over'
      waiting: false,       // true while api.ask() is open
      t: 0,
      bat: { x: BAT_X, y: H * 0.45, vy: 0 },
      pillars: [],
      orbs: [],
      parts: [],
      passes: 0,
      score: 0,
      lives: 3,
      invuln: 0,
      scroll: 0,
      flash: 0,
      bannerT: 0,
      banner: '',
      nextIndex: 1,
      lastGy: H * 0.45,
    };

    function showBanner(text) { g.banner = text; g.bannerT = 2.5; }

    function burst(x, y, n, colors, speed, life) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.35 + Math.random() * 0.65);
        g.parts.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life, max: life,
          r: 1 + Math.random() * 2.2,
          c: colors[i % colors.length],
        });
      }
      if (g.parts.length > 260) g.parts.splice(0, g.parts.length - 260);
    }

    function spawnPillar() {
      const idx = g.nextIndex++;
      const gap = gapSize(g.passes);
      const margin = gap / 2 + 70;
      const gy = clamp(g.lastGy + (Math.random() * 2 - 1) * 150, margin, FLOOR_Y - margin);
      g.lastGy = gy;
      const prev = g.pillars[g.pillars.length - 1];
      const x = prev ? prev.x + SPACING : W + 60;
      const p = { idx, x, gy, gap, passed: false, cp: idx === CHECK_GAP, cpAsked: false };
      g.pillars.push(p);
      if (!p.cp && Math.random() < 0.5) {
        // Orb floats in the open space between this column and the next.
        g.orbs.push({
          x: x + PW + (SPACING - PW) / 2,
          y: clamp(gy + (Math.random() * 2 - 1) * 50, 80, FLOOR_Y - 80),
          ph: Math.random() * Math.PI * 2,
          got: false,
        });
      }
    }

    function end(won) {
      g.mode = 'over';
      if (won) api.win();
      else api.lose();
    }

    function loseLife(kind) {
      g.lives -= 1;
      g.invuln = INVULN;
      g.flash = 1;
      sfx('hit');
      if (kind === 'pillar') g.bat.vy = -200;
      burst(g.bat.x, g.bat.y, 22, ['#e0384a', '#ffb347', '#f3ead8'], 220, 0.8);
      if (g.lives <= 0) {
        g.lives = 0;
        showBanner('Out of lives!');
        end(false);
      } else {
        showBanner(`Ouch! ${g.lives} ${g.lives === 1 ? 'life' : 'lives'} left`);
      }
    }

    function afterAsk(ok) {
      if (!alive) return;
      g.waiting = false;
      if (ok) {
        g.lives += 1;
        showBanner('Correct! +1 life');
        sfx('correct');
      } else {
        showBanner('Not quite. Keep flying!');
        sfx('wrong');
      }
    }

    function flap() {
      if (!alive || g.waiting || g.mode === 'over') return;
      if (g.mode === 'ready') g.mode = 'play';
      g.bat.vy = FLAP_VY;
      sfx('flap');
      burst(g.bat.x - 6, g.bat.y + 4, 4, ['#c9b8e8', '#ffb347'], 70, 0.45);
    }

    function update(dt) {
      if (g.waiting) return;
      g.t += dt;
      g.flash = Math.max(0, g.flash - dt * 2.5);
      if (g.bannerT > 0) g.bannerT -= dt;
      for (const p of g.parts) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 260 * dt;
      }
      g.parts = g.parts.filter((p) => p.life > 0);
      if (g.mode !== 'play') return;

      const b = g.bat;
      if (g.invuln > 0) g.invuln = Math.max(0, g.invuln - dt);

      // Bat physics.
      b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * dt);
      b.y += b.vy * dt;
      if (b.y - BAT_R < 0) {
        b.y = BAT_R;
        if (b.vy < 0) b.vy = 0;
      }
      if (b.y + BAT_R > FLOOR_Y) {
        b.y = FLOOR_Y - BAT_R;
        if (g.invuln <= 0) loseLife('floor');
        if (g.mode !== 'play') return;
        b.vy = BOUNCE_VY;
      }

      // The world scrolls past the bat.
      const dx = scrollSpeed(g.passes) * dt;
      g.scroll += dx;
      for (const p of g.pillars) p.x -= dx;
      for (const o of g.orbs) o.x -= dx;
      g.pillars = g.pillars.filter((p) => p.x + PW > -10);
      g.orbs = g.orbs.filter((o) => o.x > -30 && !o.got);
      while (g.pillars.length === 0 || g.pillars[g.pillars.length - 1].x < W + 60) spawnPillar();

      // Gap passed: the bat is past the trailing edge of a column.
      for (const p of g.pillars) {
        if (!p.passed && p.x + PW < b.x - BAT_R) {
          p.passed = true;
          g.passes++;
          burst(p.x + PW / 2, p.gy, 8, ['#7dff6a', '#ffe9a8'], 90, 0.6);
          sfx('click');
          if (g.passes >= GOAL) {
            end(true);
            return;
          }
        }
      }

      // Checkpoint: pause and ask once the bat nears the glowing gap.
      const cp = g.pillars.find((p) => p.cp && !p.cpAsked);
      if (cp && cp.x - b.x < 130) {
        cp.cpAsked = true;
        g.waiting = true;
        acc = 0;
        showBanner('Checkpoint! Answer to earn a life');
        let asking;
        try {
          asking = Promise.resolve(api.ask());
        } catch (e) {
          asking = Promise.resolve(false);
        }
        asking.then((ok) => afterAsk(ok), () => afterAsk(false));
        return;
      }

      // Collisions: pillars, then orbs.
      if (g.invuln <= 0) {
        for (const p of g.pillars) {
          const topH = p.gy - p.gap / 2;
          const botY = p.gy + p.gap / 2;
          if (hitsRect(b.x, b.y, BAT_R, p.x, 0, PW, topH) ||
              hitsRect(b.x, b.y, BAT_R, p.x, botY, PW, FLOOR_Y - botY)) {
            loseLife('pillar');
            break;
          }
        }
        if (g.mode !== 'play') return;
      }

      for (const o of g.orbs) {
        if (o.got) continue;
        const oy = orbY(o, g.t);
        const ddx = o.x - b.x;
        const ddy = oy - b.y;
        if (ddx * ddx + ddy * ddy < (BAT_R + 12) * (BAT_R + 12)) {
          o.got = true;
          g.score++;
          sfx('key');
          burst(o.x, oy, 12, ['#ffe9a8', '#7dff6a', '#ff7a1a'], 140, 0.6);
        }
      }
    }

    function drawPillars() {
      for (const p of g.pillars) {
        const topH = p.gy - p.gap / 2;
        const botY = p.gy + p.gap / 2;
        drawColumn(ctx, p.x, 0, PW, topH, true, g.t, p.idx);
        drawColumn(ctx, p.x, botY, PW, FLOOR_Y - botY, false, g.t, p.idx);
        if (p.cp && g.passes >= CHECK_GAP - 1) drawCheckpoint(ctx, p, g.t);
      }
    }

    function render() {
      const cw = canvas.width;
      const ch = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0d0a14';
      ctx.fillRect(0, 0, cw, ch);

      ctx.setTransform(scaleF, 0, 0, scaleF, ox, oy);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();

      drawSky(ctx, stars, g.t);
      drawTiled(g.scroll * 0.15, (sx) => drawFarWall(ctx, sx));
      drawTiled(g.scroll * 0.4, (sx) => drawShelves(ctx, shelves, sx));
      drawFloor(ctx, g.scroll);
      drawPillars();
      for (const o of g.orbs) drawOrb(ctx, o, orbY(o, g.t), g.t);
      drawBat(ctx, g);
      drawParticles(ctx, g.parts);
      drawHUD(ctx, g);
      if (g.mode === 'ready') drawReady(ctx, g.t);
      if (g.bannerT > 0) drawBanner(ctx, g.banner, g.bannerT);
      if (g.flash > 0) {
        ctx.fillStyle = `rgba(224,56,74,${(g.flash * 0.35).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }

      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    function frame(now) {
      if (!alive) return;
      const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      if (g.waiting) {
        acc = 0;
      } else {
        acc += dt;
        while (acc >= STEP && alive && !g.waiting) {
          update(STEP);
          acc -= STEP;
        }
      }
      if (!alive) return;
      render();
      raf = requestAnimationFrame(frame);
    }

    function fit() {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth || W;
      const cssH = canvas.clientHeight || H;
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      scaleF = Math.min(canvas.width / W, canvas.height / H);
      ox = (canvas.width - W * scaleF) / 2;
      oy = (canvas.height - H * scaleF) / 2;
    }

    function onKey(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (!e.repeat) flap();
      }
    }

    function onPointer(e) {
      e.preventDefault();
      flap();
    }

    function onResize() { fit(); }

    // Start with the first column just off the right edge.
    while (g.pillars.length === 0 || g.pillars[g.pillars.length - 1].x < W + 60) spawnPillar();
    fit();
    window.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(frame);

    return {
      stop() {
        if (!alive) return;
        alive = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKey);
        canvas.removeEventListener('pointerdown', onPointer);
        window.removeEventListener('resize', onResize);
        canvas.style.touchAction = prevTouch;
      },
    };
  },
};
