// Ghost Sneak: top-down maze stealth mini game for the Escape the Haunted School arcade.
// Canvas 2D only. No imports. Fixed-timestep simulation, darkness with a candle light,
// ghost vision cones that stop at walls, and a gate that needs api.ask().

const STEP = 1 / 60;          // fixed simulation step (seconds)
const PLAYER_SPEED = 3.2;     // tiles per second
const GHOST_SPEED = 1.25;     // tiles per second
const GHOST_PAUSE = 0.7;      // seconds a ghost waits at each waypoint
const GHOST_RANGE = 4.5;      // vision range in tiles
const GHOST_HALF = 0.5;       // half the cone angle in radians (about 29 degrees)
const RAYS = 21;              // rays that build each cone (rays stop at walls)
const ALERT_TIME = 0.6;       // seconds inside a cone before the ghost spots you
const TOUCH_DIST = 0.6;       // ghost body touch distance in tiles
const FREEZE_MS = 5000;       // ghosts frozen after a correct gate answer
const GRACE_MS = 1500;        // no detection right after a respawn
const LIVES_START = 4;
const KEYS_TO_EXIT = 3;
const KEYS_TO_GATE = 2;
const LIGHT_TILES = 2.7;      // candle light radius in tiles
const INK = '#0d0a14';
const SLIME = '125,255,106';
const BLOOD = '224,56,74';
const ICE = '140,220,255';

// '#' wall, '.' floor, 'S' start, 'K' skeleton key, 'G' locked gate, 'E' exit hatch.
const MAP = [
  '#############',
  '#S..#...#.K.#',
  '###.#.#.#.#.#',
  '#...#.#...#.#',
  '#.#.#.###.#.#',
  '#.....#.#...#',
  '#.#####.#.#.#',
  '#...#.....K.#',
  '#########G###',
  '#.#.#...#...#',
  '#.#...###.#.#',
  '#.....K...E.#',
  '#############',
];

// Ghost patrol routes in tile coordinates [x, y]. Each leg is straight and on floor.
// Ghosts walk the list and ping-pong back along it.
const GHOST_ROUTES = [
  [[5, 1], [5, 5], [1, 5]],
  [[11, 1], [11, 7]],
  [[3, 9], [3, 11]],
];

const KEY_DIRS = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

const ROWS = MAP.length;
const COLS = MAP[0].length;

function tileChar(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return '#';
  return MAP[y][x];
}

function findTiles(ch) {
  const out = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (MAP[y][x] === ch) out.push({ x, y });
    }
  }
  return out;
}

const START = findTiles('S')[0] || { x: 1, y: 1 };
const EXIT = findTiles('E')[0] || { x: COLS - 2, y: ROWS - 2 };
const GATE = findTiles('G')[0] || { x: -1, y: -1 };
const KEYS_LIST = findTiles('K');

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function hash2(x, y, salt) {
  const v = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

function angleTo(a, b) { return Math.atan2(b[1] - a[1], b[0] - a[0]); }

function makeGhost(route) {
  return {
    route,
    x: route[0][0], y: route[0][1],
    i: 0, n: 1, d: 1,
    pause: 0.5,
    face: route.length > 1 ? angleTo(route[0], route[1]) : 0,
    rays: new Float64Array(RAYS),
    alert: 0,
  };
}

function resetGhost(g) {
  g.x = g.route[0][0];
  g.y = g.route[0][1];
  g.i = 0; g.n = 1; g.d = 1;
  g.pause = 0.5;
  g.alert = 0;
  g.face = angleTo(g.route[0], g.route[1]);
}

// Rounded heart outline, used by the lives display.
function heartPath(ctx, x, y, sz) {
  ctx.beginPath();
  ctx.moveTo(x, y + sz * 0.9);
  ctx.bezierCurveTo(x - sz * 1.3, y + sz * 0.1, x - sz * 0.6, y - sz * 0.9, x, y - sz * 0.25);
  ctx.bezierCurveTo(x + sz * 0.6, y - sz * 0.9, x + sz * 1.3, y + sz * 0.1, x, y + sz * 0.9);
  ctx.closePath();
}

// Skeleton key icon: ring, shaft and two teeth. sz is the overall size in pixels.
function drawKeyIcon(ctx, cx, cy, sz, col) {
  ctx.save();
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineWidth = sz * 0.16;
  ctx.beginPath();
  ctx.arc(cx - sz * 0.45, cy, sz * 0.32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillRect(cx - sz * 0.13, cy - sz * 0.08, sz * 0.93, sz * 0.16);
  ctx.fillRect(cx + sz * 0.55, cy - sz * 0.08, sz * 0.12, sz * 0.3);
  ctx.fillRect(cx + sz * 0.36, cy - sz * 0.08, sz * 0.1, sz * 0.22);
  ctx.restore();
}

function drawFloorTile(g, x, y, c) {
  const px = x * c, py = y * c;
  const h = hash2(x, y, 1), h2 = hash2(x, y, 2);
  g.fillStyle = '#141019';
  g.fillRect(px, py, c, c);
  const shades = ['#2c2438', '#312840', '#29213a'];
  g.fillStyle = shades[Math.floor(h * 3) % 3];
  g.fillRect(px + 0.8, py + 0.8, c - 1.6, c - 1.6);
  g.fillStyle = 'rgba(255,240,220,0.06)';
  g.fillRect(px + 0.8, py + 0.8, c - 1.6, 1.5);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(px + 0.8, py + c - 2.3, c - 1.6, 1.5);
  if (h2 > 0.7) {
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(px + c * 0.2, py + c * 0.3);
    g.lineTo(px + c * 0.45, py + c * 0.5);
    g.lineTo(px + c * 0.38, py + c * 0.75);
    g.stroke();
  }
}

function drawWallTile(g, x, y, c, isOpen) {
  const px = x * c, py = y * c;
  g.fillStyle = '#1b1218';
  g.fillRect(px, py, c, c);
  const rows = 4;
  const bh = c / rows;
  const bw = c * 0.5;
  const colors = ['#5a3a40', '#4c3038', '#63434a'];
  g.save();
  g.beginPath();
  g.rect(px, py, c, c);
  g.clip();
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) ? c * 0.25 : 0;
    for (let k = -1; k < 3; k++) {
      const bx = px + off + k * bw;
      const col = colors[Math.floor(hash2(x * 7 + k, y * 5 + r, 3) * 3) % 3];
      g.fillStyle = col;
      g.fillRect(bx + 0.6, py + r * bh + 0.6, bw - 1.2, bh - 1.2);
    }
  }
  g.restore();
  // soft top light and bottom shade
  g.fillStyle = 'rgba(255,220,200,0.07)';
  g.fillRect(px, py, c, 2);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(px, py + c - 2, c, 2);
  // moss on the edges that touch a floor tile
  const mossCols = ['#2e5b2c', '#3f7a36', '#24461f'];
  const edges = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (let e = 0; e < edges.length; e++) {
    const dx = edges[e][0], dy = edges[e][1];
    if (!isOpen(x + dx, y + dy)) continue;
    if (hash2(x, y, 5 + e) < 0.3) continue;
    for (let k = 0; k < 4; k++) {
      const u = (0.12 + 0.76 * hash2(x * 3 + k, y * 5 + e, 9)) * c;
      const rx = c * (0.07 + 0.05 * hash2(x + k, y - k, 11));
      const ry = c * (0.05 + 0.07 * hash2(x - k, y + e, 13));
      let cx, cy;
      if (dy === 1) { cx = px + u; cy = py + c - ry * 0.3; }
      else if (dy === -1) { cx = px + u; cy = py + ry * 0.3; }
      else if (dx === 1) { cx = px + c - rx * 0.3; cy = py + u; }
      else { cx = px + rx * 0.3; cy = py + u; }
      g.fillStyle = mossCols[k % mossCols.length];
      g.beginPath();
      g.ellipse(cx, cy, dy === 0 ? ry : rx, dy === 0 ? rx : ry, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
}

export default {
  id: 'maze',
  title: 'Ghost Sneak',
  instructions: 'Arrows/WASD or swipe (D-pad on phones) to sneak. Get 3 skeleton keys, answer the gate question after key 2, then reach the exit hatch. Stay out of ghost cones.',

  start(canvas, api) {
    const ctx = canvas.getContext('2d');
    const lightCv = document.createElement('canvas');
    const lctx = lightCv.getContext('2d');
    const bgCv = document.createElement('canvas');
    const bctx = bgCv.getContext('2d');
    const isTouch = ('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      (!!window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    const prevTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';

    const lay = {
      W: 0, H: 0, dpr: 1, hudH: 44, rb: 28, sp: 60, cell: 20,
      ox: 0, oy: 0, pad: null, padBtns: [],
    };

    const s = {
      px: START.x, py: START.y,
      tx: START.x, ty: START.y,
      fx: START.x, fy: START.y,
      mx: 0, my: 0, moving: false, walk: 0,
      cpX: START.x, cpY: START.y,
      lives: LIVES_START, keys: 0,
      got: KEYS_LIST.map(() => false),
      gateOpen: false, gateAsked: false, asking: false, over: false,
      ms: 0, freezeUntil: 0, graceUntil: 0,
      toast: '', toastUntil: 0, lastGateSay: -1e9,
      flash: 0, shake: 0, lastStep: -1e9,
      ghosts: GHOST_ROUTES.map(makeGhost),
    };

    const keyStack = [];           // keyboard presses, last one wins
    const ptrs = new Map();        // pointerId -> { type: 'pad', dir } or { type: 'swipe', sx, sy }
    let stickyDir = null;          // set by a swipe, cleared at walls
    let stopped = false;
    let raf = 0;
    let last = 0;
    let acc = 0;

    const sfx = (name) => { try { if (api && api.sfx) api.sfx(name); } catch (_) { /* audio optional */ } };
    const say = (text, ms) => { s.toast = text; s.toastUntil = s.ms + (ms || 2000); };

    function isSolid(x, y) {
      const ch = tileChar(x, y);
      return ch === '#' || (ch === 'G' && !s.gateOpen);
    }

    function clearInput() {
      keyStack.length = 0;
      stickyDir = null;
    }

    function inputDir() {
      if (keyStack.length) return keyStack[keyStack.length - 1].d;
      for (const rec of ptrs.values()) {
        if (rec.type === 'pad' && rec.dir) return rec.dir;
      }
      return stickyDir;
    }

    function stepSfx() {
      if (s.ms - s.lastStep > 210) {
        s.lastStep = s.ms;
        sfx('step');
      }
    }

    // ---- Gate and exit ----------------------------------------------------

    function openGate(right) {
      s.asking = false;
      s.gateOpen = true;
      clearInput();
      sfx('unlock');
      s.cpX = GATE.x;
      s.cpY = GATE.y;
      if (right) {
        s.freezeUntil = s.ms + FREEZE_MS;
        say('Gate open! Ghosts frozen for 5 seconds.', 2600);
      } else {
        say('Gate open, but the ghosts are still awake!', 2600);
      }
    }

    function askGate() {
      s.asking = true;
      s.gateAsked = true;
      clearInput();
      let p;
      try {
        p = Promise.resolve(api.ask());
      } catch (_) {
        p = Promise.resolve(false);
      }
      p.then(
        (ok) => { if (!stopped) openGate(!!ok); },
        () => { if (!stopped) openGate(false); }
      );
    }

    function tryGate() {
      if (s.gateAsked || s.asking) return;
      if (s.keys < KEYS_TO_GATE) {
        if (s.ms - s.lastGateSay > 1500) {
          s.lastGateSay = s.ms;
          say('This gate needs 2 skeleton keys first.', 1800);
        }
        return;
      }
      askGate();
    }

    // Called each time the player reaches the centre of a tile.
    function arrive(x, y) {
      const ch = tileChar(x, y);
      if (ch === 'K') {
        const idx = KEYS_LIST.findIndex((k) => k.x === x && k.y === y);
        if (idx >= 0 && !s.got[idx]) {
          s.got[idx] = true;
          s.keys++;
          s.cpX = x;
          s.cpY = y;
          sfx('key');
          say('Skeleton key ' + s.keys + ' of ' + KEYS_TO_EXIT + ' collected!', 2200);
        }
      }
      if (ch === 'E') {
        if (s.keys >= KEYS_TO_EXIT) {
          s.over = true;
          api.win();
        } else {
          say('The hatch is sealed. Find all 3 skeleton keys first.', 2200);
        }
      }
    }

    // ---- Player -------------------------------------------------------------

    function updatePlayer(dt) {
      const d = inputDir();

      if (s.moving) {
        // Reverse mid-tile if the player turns back.
        if (d && d[0] === -s.mx && d[1] === -s.my) {
          const ox = s.tx, oy = s.ty;
          s.tx = s.fx; s.ty = s.fy;
          s.fx = ox; s.fy = oy;
          s.mx = -s.mx; s.my = -s.my;
        }
        const dx = s.tx - s.px, dy = s.ty - s.py;
        const dist = Math.hypot(dx, dy);
        const step = PLAYER_SPEED * dt;
        if (dist <= step) {
          s.px = s.tx; s.py = s.ty;
          s.moving = false;
          arrive(s.px, s.py);
          if (s.over) return;
        } else {
          s.px += dx / dist * step;
          s.py += dy / dist * step;
          return;
        }
      }

      // Not moving: start a new tile move if the input allows it.
      if (!d) return;
      const nx = s.px + d[0], ny = s.py + d[1];
      if (tileChar(nx, ny) === 'G' && !s.gateOpen) {
        clearInput();
        tryGate();
        return;
      }
      if (isSolid(nx, ny)) {
        stickyDir = null;
        return;
      }
      s.fx = s.px; s.fy = s.py;
      s.tx = nx; s.ty = ny;
      s.mx = d[0]; s.my = d[1];
      s.moving = true;
      stepSfx();
    }

    // ---- Ghosts -------------------------------------------------------------

    function moveGhost(g, dt) {
      if (g.pause > 0) { g.pause -= dt; return; }
      const t = g.route[g.n];
      const dx = t[0] - g.x, dy = t[1] - g.y;
      const dist = Math.hypot(dx, dy);
      const step = GHOST_SPEED * dt;
      if (dist <= step) {
        g.x = t[0]; g.y = t[1];
        g.i = g.n;
        let nn = g.i + g.d;
        if (nn < 0 || nn >= g.route.length) {
          g.d = -g.d;
          nn = g.i + g.d;
        }
        g.n = nn;
        g.pause = GHOST_PAUSE;
      } else {
        g.x += dx / dist * step;
        g.y += dy / dist * step;
      }
    }

    function turnGhost(g, dt) {
      const t = g.route[g.n];
      const want = Math.atan2(t[1] - g.y, t[0] - g.x);
      const diff = wrapAngle(want - g.face);
      const maxTurn = 5 * dt;
      g.face += clamp(diff, -maxTurn, maxTurn);
    }

    function castRays(g) {
      for (let k = 0; k < RAYS; k++) {
        const a = g.face - GHOST_HALF + (2 * GHOST_HALF * k) / (RAYS - 1);
        const cs = Math.cos(a), sn = Math.sin(a);
        let dOut = GHOST_RANGE;
        for (let t = 0.1; t <= GHOST_RANGE; t += 0.05) {
          if (isSolid(Math.round(g.x + cs * t), Math.round(g.y + sn * t))) {
            dOut = Math.max(0, t - 0.05);
            break;
          }
        }
        g.rays[k] = dOut;
      }
    }

    function inCone(g, px, py) {
      const dx = px - g.x, dy = py - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist > GHOST_RANGE) return false;
      const diff = wrapAngle(Math.atan2(dy, dx) - g.face);
      if (Math.abs(diff) > GHOST_HALF) return false;
      const k = clamp(Math.round((diff + GHOST_HALF) / (2 * GHOST_HALF) * (RAYS - 1)), 0, RAYS - 1);
      return dist <= g.rays[k] + 0.25;
    }

    function caught() {
      s.lives--;
      s.flash = 0.7;
      s.shake = 0.4;
      sfx('scare');
      if (s.lives <= 0) {
        s.lives = 0;
        s.over = true;
        api.lose();
        return;
      }
      s.px = s.cpX; s.py = s.cpY;
      s.tx = s.px; s.ty = s.py;
      s.fx = s.px; s.fy = s.py;
      s.moving = false;
      clearInput();
      for (const g of s.ghosts) resetGhost(g);
      s.graceUntil = s.ms + GRACE_MS;
      say('Spotted! ' + s.lives + (s.lives === 1 ? ' life' : ' lives') + ' left.', 2000);
    }

    function checkCaught(dt) {
      const safe = s.ms < s.graceUntil || s.ms < s.freezeUntil;
      for (const g of s.ghosts) {
        if (safe) { g.alert = Math.max(0, g.alert - dt * 0.6); continue; }
        if (Math.hypot(s.px - g.x, s.py - g.y) < TOUCH_DIST) { caught(); return; }
        if (inCone(g, s.px, s.py)) g.alert += dt;
        else g.alert = Math.max(0, g.alert - dt * 0.6);
        if (g.alert >= ALERT_TIME) { caught(); return; }
      }
    }

    // ---- Update -------------------------------------------------------------

    function update() {
      s.ms += STEP * 1000;
      s.walk += STEP;
      if (s.flash > 0) s.flash -= STEP;
      if (s.shake > 0) s.shake -= STEP;
      updatePlayer(STEP);
      if (s.over) return;
      const frozen = s.ms < s.freezeUntil;
      for (const g of s.ghosts) {
        if (!frozen) moveGhost(g, STEP);
        turnGhost(g, STEP);
        castRays(g);
      }
      checkCaught(STEP);
    }

    // ---- Layout -------------------------------------------------------------

    function computeLayout() {
      const W = lay.W, H = lay.H;
      lay.hudH = Math.round(clamp(H * 0.075, 40, 56));
      lay.rb = clamp(Math.min(W, H) * 0.085, 24, 34);
      lay.sp = lay.rb * 2.2;
      const padBox = lay.sp * 2 + lay.rb * 2 + 16;
      let aw = W, ah = H - lay.hudH;
      const ay = lay.hudH;
      lay.pad = null;
      if (isTouch) {
        if (H >= W) {
          ah -= padBox;
          lay.pad = { cx: W / 2, cy: H - padBox / 2 };
        } else {
          aw -= padBox;
          lay.pad = { cx: W - padBox / 2, cy: ay + ah / 2 };
        }
      }
      lay.cell = Math.max(8, Math.floor(Math.min((aw - 12) / COLS, (ah - 12) / ROWS)));
      lay.ox = (aw - lay.cell * COLS) / 2;
      lay.oy = ay + (ah - lay.cell * ROWS) / 2;
      lay.padBtns = [];
      if (lay.pad) {
        const p = lay.pad, sp = lay.sp;
        lay.padBtns = [
          { dir: [0, -1], x: p.cx, y: p.cy - sp },
          { dir: [0, 1], x: p.cx, y: p.cy + sp },
          { dir: [-1, 0], x: p.cx - sp, y: p.cy },
          { dir: [1, 0], x: p.cx + sp, y: p.cy },
        ];
      }
    }

    function buildStatic() {
      const c = lay.cell;
      bctx.setTransform(lay.dpr, 0, 0, lay.dpr, 0, 0);
      bctx.clearRect(0, 0, c * COLS, c * ROWS);
      const isOpen = (x, y) => tileChar(x, y) !== '#';
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (MAP[y][x] === '#') drawWallTile(bctx, x, y, c, isOpen);
          else drawFloorTile(bctx, x, y, c);
        }
      }
    }

    function ensureLayout() {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (!W || !H) return;
      if (W === lay.W && H === lay.H && dpr === lay.dpr) return;
      lay.W = W; lay.H = H; lay.dpr = dpr;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      lightCv.width = canvas.width;
      lightCv.height = canvas.height;
      computeLayout();
      bgCv.width = Math.round(lay.cell * COLS * dpr);
      bgCv.height = Math.round(lay.cell * ROWS * dpr);
      buildStatic();
    }

    const cxOf = (x) => lay.ox + (x + 0.5) * lay.cell;
    const cyOf = (y) => lay.oy + (y + 0.5) * lay.cell;

    // ---- Drawing ------------------------------------------------------------

    function drawGate(t) {
      const c = lay.cell;
      const gx = lay.ox + GATE.x * c, gy = lay.oy + GATE.y * c;
      if (GATE.x < 0) return;
      if (s.gateOpen) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(gx + c * 0.1, gy + c * 0.1, c * 0.8, c * 0.8);
        return;
      }
      ctx.fillStyle = '#231d2a';
      ctx.fillRect(gx, gy, c, c);
      for (let i = 0; i < 4; i++) {
        const bx = gx + c * (0.16 + i * 0.22);
        const grd = ctx.createLinearGradient(bx, gy, bx + 3, gy);
        grd.addColorStop(0, '#c9ced9');
        grd.addColorStop(1, '#4a4e5c');
        ctx.fillStyle = grd;
        ctx.fillRect(bx, gy + c * 0.06, c * 0.07, c * 0.88);
      }
      ctx.fillStyle = '#6b4a3a';
      ctx.fillRect(gx, gy + c * 0.12, c, c * 0.06);
      ctx.fillRect(gx, gy + c * 0.82, c, c * 0.06);
      // padlock: pumpkin and pulsing when the gate is ready to ask
      const ready = s.keys >= KEYS_TO_GATE;
      const pulse = 0.5 + 0.5 * Math.sin(t * 4);
      const mx = gx + c / 2, my = gy + c / 2;
      if (ready) {
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, c * (0.7 + 0.2 * pulse));
        glow.addColorStop(0, 'rgba(255,122,26,0.45)');
        glow.addColorStop(1, 'rgba(255,122,26,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(gx - c * 0.4, gy - c * 0.4, c * 1.8, c * 1.8);
      }
      ctx.fillStyle = ready ? '#ff7a1a' : '#6f6685';
      ctx.fillRect(mx - c * 0.16, my - c * 0.02, c * 0.32, c * 0.26);
      ctx.strokeStyle = ready ? '#ff7a1a' : '#6f6685';
      ctx.lineWidth = c * 0.07;
      ctx.beginPath();
      ctx.arc(mx, my - c * 0.04, c * 0.11, Math.PI, 0);
      ctx.stroke();
    }

    function drawExit(t) {
      const c = lay.cell;
      const ex = lay.ox + EXIT.x * c, ey = lay.oy + EXIT.y * c;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
      const cx = ex + c / 2, cy = ey + c / 2;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, c * (0.9 + 0.15 * pulse));
      glow.addColorStop(0, s.keys >= KEYS_TO_EXIT ? 'rgba(125,255,106,0.45)' : 'rgba(169,159,191,0.25)');
      glow.addColorStop(1, 'rgba(125,255,106,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(ex - c * 0.9, ey - c * 0.9, c * 2.8, c * 2.8);
      const inset = c * 0.12;
      ctx.fillStyle = '#5a3b22';
      ctx.fillRect(ex + inset, ey + inset, c - inset * 2, c - inset * 2);
      ctx.fillStyle = '#3a2415';
      ctx.fillRect(ex + inset, ey + c * 0.33, c - inset * 2, c * 0.05);
      ctx.fillRect(ex + inset, ey + c * 0.62, c - inset * 2, c * 0.05);
      ctx.strokeStyle = '#9aa0ad';
      ctx.lineWidth = c * 0.06;
      ctx.beginPath();
      ctx.arc(cx, cy, c * 0.12, 0, Math.PI * 2);
      ctx.stroke();
    }

    function drawKeys(t) {
      const c = lay.cell;
      for (let i = 0; i < KEYS_LIST.length; i++) {
        if (s.got[i]) continue;
        const k = KEYS_LIST[i];
        const cx = cxOf(k.x), cy = cyOf(k.y);
        const pulse = 0.5 + 0.5 * Math.sin(t * 4 + k.x);
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, c * 0.8);
        glow.addColorStop(0, 'rgba(255,233,168,' + (0.35 + 0.2 * pulse).toFixed(3) + ')');
        glow.addColorStop(1, 'rgba(255,233,168,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(cx - c, cy - c, c * 2, c * 2);
        drawKeyIcon(ctx, cx - c * 0.1, cy, c * 0.5, '#ffe9a8');
      }
    }

    function drawDarkness(t, px, py) {
      const c = lay.cell, W = lay.W, H = lay.H, dpr = lay.dpr;
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, lightCv.width, lightCv.height);
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.globalCompositeOperation = 'source-over';
      lctx.fillStyle = 'rgba(5,3,10,0.8)';
      lctx.fillRect(0, 0, W, H);
      lctx.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, a) => {
        const grd = lctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(0,0,0,' + a + ')');
        grd.addColorStop(0.55, 'rgba(0,0,0,' + (a * 0.8).toFixed(3) + ')');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = grd;
        lctx.beginPath();
        lctx.arc(x, y, r, 0, Math.PI * 2);
        lctx.fill();
      };
      const flick = 1 + 0.035 * Math.sin(t * 13.1) + 0.025 * Math.sin(t * 27.3 + 1);
      const R = LIGHT_TILES * c * flick;
      hole(px, py, R, 1);
      for (let i = 0; i < KEYS_LIST.length; i++) {
        if (!s.got[i]) hole(cxOf(KEYS_LIST[i].x), cyOf(KEYS_LIST[i].y), c * 1.0, 0.55);
      }
      hole(cxOf(EXIT.x), cyOf(EXIT.y), c * 1.1, 0.5);
      lctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(lightCv, 0, 0, W, H);

      // warm candle tint over the lit area
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const warm = ctx.createRadialGradient(px, py, 0, px, py, R * 1.05);
      warm.addColorStop(0, 'rgba(255,170,80,0.16)');
      warm.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = warm;
      ctx.fillRect(px - R * 1.1, py - R * 1.1, R * 2.2, R * 2.2);
      ctx.restore();
    }

    function drawCones(t) {
      const c = lay.cell;
      const frozen = s.ms < s.freezeUntil;
      for (const g of s.ghosts) {
        const gx = cxOf(g.x), gy = cyOf(g.y);
        const frac = Math.min(1, g.alert / ALERT_TIME);
        const col = frozen ? ICE : (frac > 0.02 ? BLOOD : SLIME);
        const a = frozen ? 0.3 : 0.2 + 0.28 * frac;
        const R = GHOST_RANGE * c;
        const grd = ctx.createRadialGradient(gx, gy, c * 0.2, gx, gy, R);
        grd.addColorStop(0, 'rgba(' + col + ',' + a.toFixed(3) + ')');
        grd.addColorStop(0.7, 'rgba(' + col + ',' + (a * 0.5).toFixed(3) + ')');
        grd.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        for (let k = 0; k < RAYS; k++) {
          const ang = g.face - GHOST_HALF + (2 * GHOST_HALF * k) / (RAYS - 1);
          const d = g.rays[k] * c;
          ctx.lineTo(gx + Math.cos(ang) * d, gy + Math.sin(ang) * d);
        }
        ctx.closePath();
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.strokeStyle = 'rgba(' + col + ',0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    function drawGhost(g, t) {
      const c = lay.cell;
      const r = c * 0.36;
      const gx = cxOf(g.x), gy = cyOf(g.y) + Math.sin(t * 3 + g.route[0][0]) * c * 0.04;
      const frozen = s.ms < s.freezeUntil;
      ctx.save();
      ctx.translate(gx, gy);
      const halo = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.2);
      halo.addColorStop(0, frozen ? 'rgba(140,220,255,0.25)' : 'rgba(125,255,106,0.16)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(-r * 2.2, -r * 2.2, r * 4.4, r * 4.4);

      // wavy sheet body
      const bottom = r * 0.75;
      ctx.beginPath();
      ctx.arc(0, -r * 0.15, r, Math.PI, 0);
      ctx.lineTo(r, bottom);
      const n = 3, seg = (2 * r) / n;
      for (let i = 0; i < n; i++) {
        const xEnd = r - (i + 1) * seg;
        const ctrlX = r - i * seg - seg / 2;
        const wob = Math.sin(t * 6 + i) * r * 0.1;
        ctx.quadraticCurveTo(ctrlX, bottom + r * 0.35 + wob, xEnd, bottom);
      }
      ctx.closePath();
      const body = ctx.createLinearGradient(0, -r, 0, r);
      body.addColorStop(0, frozen ? '#e8f6ff' : '#f6f2ff');
      body.addColorStop(1, frozen ? '#8fb9d6' : '#b3aacb');
      ctx.fillStyle = body;
      ctx.globalAlpha = 0.94;
      ctx.fill();
      ctx.globalAlpha = 1;

      // glowing eyes
      const eyeCol = frozen ? '#bfeaff' : '#7dff6a';
      ctx.shadowColor = eyeCol;
      ctx.shadowBlur = r * 0.8;
      ctx.fillStyle = eyeCol;
      ctx.beginPath();
      ctx.ellipse(-r * 0.36, -r * 0.2, r * 0.17, r * 0.22, 0, 0, Math.PI * 2);
      ctx.ellipse(r * 0.36, -r * 0.2, r * 0.17, r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0d0a14';
      ctx.beginPath();
      ctx.arc(-r * 0.36, -r * 0.16, r * 0.07, 0, Math.PI * 2);
      ctx.arc(r * 0.36, -r * 0.16, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
      // mouth: open when alerted
      const frac = Math.min(1, g.alert / ALERT_TIME);
      ctx.beginPath();
      ctx.ellipse(0, r * 0.3, r * 0.14, r * (0.05 + 0.12 * frac), 0, 0, Math.PI * 2);
      ctx.fill();

      // alert bubble
      if (frac > 0.02 && !frozen) {
        ctx.fillStyle = 'rgba(224,56,74,' + (0.5 + 0.5 * frac).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(r * 0.9, -r * 1.25, r * 0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '900 ' + Math.round(r * 0.6) + 'px Nunito, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', r * 0.9, -r * 1.22);
      }
      ctx.restore();
    }

    function drawPlayer(t, px, py) {
      const c = lay.cell;
      const r = c * 0.3;
      const bob = Math.abs(Math.sin(s.walk * 16)) * c * 0.05 * (s.moving ? 1 : 0);
      const x = cxOf(px), y = cyOf(py) - bob;
      ctx.save();
      ctx.translate(x, y);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, r * 1.05, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      // cloak
      ctx.fillStyle = '#ff7a1a';
      ctx.strokeStyle = '#8a3a10';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.5, r * 0.8, r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // head and hair
      ctx.fillStyle = '#f1c7a0';
      ctx.beginPath();
      ctx.arc(0, -r * 0.45, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a1d33';
      ctx.beginPath();
      ctx.arc(0, -r * 0.45, r * 0.52, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      ctx.fillStyle = '#2a1d33';
      ctx.beginPath();
      ctx.arc(-r * 0.18, -r * 0.45, r * 0.06, 0, Math.PI * 2);
      ctx.arc(r * 0.18, -r * 0.45, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
      // candle in the right hand
      const hx = r * 0.85, hy = r * 0.15;
      ctx.fillStyle = '#f3ead8';
      ctx.fillRect(hx - r * 0.1, hy - r * 0.2, r * 0.2, r * 0.5);
      const flick = Math.sin(t * 20) * r * 0.05 + Math.sin(t * 9) * r * 0.03;
      const fh = r * 0.5 + flick;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.moveTo(hx, hy - r * 0.2 - fh);
      ctx.quadraticCurveTo(hx + r * 0.22, hy - r * 0.2 - fh * 0.3, hx, hy - r * 0.2);
      ctx.quadraticCurveTo(hx - r * 0.22, hy - r * 0.2 - fh * 0.3, hx, hy - r * 0.2 - fh);
      ctx.fill();
      ctx.restore();
    }

    function drawHud(W, t) {
      const hh = lay.hudH;
      ctx.fillStyle = 'rgba(26,20,38,0.88)';
      ctx.fillRect(6, 5, W - 12, hh - 10);
      ctx.strokeStyle = 'rgba(58,45,82,0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(6.5, 5.5, W - 13, hh - 11);
      const mid = hh / 2;
      // lives
      for (let i = 0; i < LIVES_START; i++) {
        heartPath(ctx, 24 + i * 24, mid + 1, 7);
        ctx.fillStyle = i < s.lives ? '#e0384a' : '#3a2d52';
        ctx.fill();
      }
      // keys
      const keyX = 100;
      for (let i = 0; i < KEYS_TO_EXIT; i++) {
        const got = i < s.keys;
        drawKeyIcon(ctx, keyX + i * 30, mid + 1, 16, got ? '#ffe9a8' : '#3a2d52');
      }
      // gate status
      ctx.font = '800 12px Nunito, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      let label, col;
      if (s.gateOpen) { label = 'GATE OPEN'; col = '#7dff6a'; }
      else if (s.keys >= KEYS_TO_GATE) { label = 'GATE READY'; col = '#ff7a1a'; }
      else { label = 'GATE LOCKED'; col = '#a99fbf'; }
      ctx.fillStyle = col;
      ctx.fillText(label, W - 18, mid + 1);
      ctx.textAlign = 'left';
    }

    function drawPad(t) {
      if (!lay.pad) return;
      const rb = lay.rb;
      const active = new Set();
      for (const rec of ptrs.values()) {
        if (rec.type === 'pad' && rec.dir) active.add(rec.dir[0] + ',' + rec.dir[1]);
      }
      for (const b of lay.padBtns) {
        const on = active.has(b.dir[0] + ',' + b.dir[1]);
        ctx.beginPath();
        ctx.arc(b.x, b.y, rb, 0, Math.PI * 2);
        ctx.fillStyle = on ? 'rgba(255,122,26,0.55)' : 'rgba(26,20,38,0.6)';
        ctx.fill();
        ctx.strokeStyle = on ? '#ff7a1a' : 'rgba(169,159,191,0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // arrow triangle
        const dx = b.dir[0], dy = b.dir[1];
        const tipX = b.x + dx * rb * 0.5, tipY = b.y + dy * rb * 0.5;
        const baseX = b.x - dx * rb * 0.2, baseY = b.y - dy * rb * 0.2;
        const pxp = -dy * rb * 0.35, pyp = dx * rb * 0.35;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(baseX + pxp, baseY + pyp);
        ctx.lineTo(baseX - pxp, baseY - pyp);
        ctx.closePath();
        ctx.fillStyle = '#f3ead8';
        ctx.fill();
      }
    }

    function drawToast(W) {
      if (s.ms >= s.toastUntil || !s.toast) return;
      const alpha = clamp((s.toastUntil - s.ms) / 500, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '800 15px Nunito, system-ui, sans-serif';
      const tw = ctx.measureText(s.toast).width + 28;
      const y = lay.hudH + 22;
      ctx.fillStyle = 'rgba(13,10,20,0.85)';
      ctx.strokeStyle = 'rgba(255,122,26,0.7)';
      ctx.lineWidth = 1.5;
      const x0 = (W - tw) / 2;
      ctx.beginPath();
      ctx.rect(x0, y - 14, tw, 28);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f3ead8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.toast, W / 2, y);
      ctx.restore();
      ctx.textAlign = 'left';
    }

    function render(t) {
      const W = lay.W, H = lay.H, dpr = lay.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, W, H);

      const sx = s.shake > 0 ? (Math.random() - 0.5) * 8 * s.shake : 0;
      const sy = s.shake > 0 ? (Math.random() - 0.5) * 8 * s.shake : 0;
      ctx.save();
      ctx.translate(sx, sy);

      // static floor and walls
      ctx.drawImage(bgCv, lay.ox, lay.oy, lay.cell * COLS, lay.cell * ROWS);
      drawGate(t);
      drawExit(t);
      drawKeys(t);

      // the player's pool of light, then cones and ghosts on top
      const pxS = cxOf(s.px), pyS = cyOf(s.py);
      drawDarkness(t, pxS, pyS);
      drawCones(t);
      for (const g of s.ghosts) drawGhost(g, t);
      drawPlayer(t, s.px, s.py);
      ctx.restore();

      // frozen tint and red flash
      if (s.ms < s.freezeUntil) {
        ctx.fillStyle = 'rgba(120,200,255,0.06)';
        ctx.fillRect(0, 0, W, H);
      }
      if (s.flash > 0) {
        ctx.fillStyle = 'rgba(224,56,74,' + (s.flash * 0.4).toFixed(3) + ')';
        ctx.fillRect(0, 0, W, H);
      }

      drawHud(W, t);
      drawToast(W);
      drawPad(t);
    }

    // ---- Input --------------------------------------------------------------

    function padHit(x, y) {
      for (const b of lay.padBtns) {
        if (Math.hypot(x - b.x, y - b.y) <= lay.rb * 1.2) return b;
      }
      return null;
    }

    function localXY(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    const onKeyDown = (e) => {
      const d = KEY_DIRS[e.code];
      if (!d) return;
      e.preventDefault();
      if (!keyStack.some((k) => k.code === e.code)) keyStack.push({ code: e.code, d });
    };
    const onKeyUp = (e) => {
      const i = keyStack.findIndex((k) => k.code === e.code);
      if (i >= 0) keyStack.splice(i, 1);
    };
    const onBlur = () => {
      keyStack.length = 0;
      ptrs.clear();
      stickyDir = null;
    };
    const onPointerDown = (e) => {
      const p = localXY(e);
      const b = padHit(p.x, p.y);
      ptrs.set(e.pointerId, b ? { type: 'pad', dir: b.dir } : { type: 'swipe', sx: p.x, sy: p.y });
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      e.preventDefault();
    };
    const onPointerMove = (e) => {
      const rec = ptrs.get(e.pointerId);
      if (!rec) return;
      const p = localXY(e);
      if (rec.type === 'pad') {
        const b = padHit(p.x, p.y);
        rec.dir = b ? b.dir : null;
        return;
      }
      const dx = p.x - rec.sx, dy = p.y - rec.sy;
      if (Math.hypot(dx, dy) >= 22) {
        stickyDir = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
        rec.sx = p.x;
        rec.sy = p.y;
      }
    };
    const onPointerUp = (e) => { ptrs.delete(e.pointerId); };
    const onResize = () => { lay.W = 0; };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    // ---- Loop ---------------------------------------------------------------

    function frame(now) {
      if (stopped) return;
      ensureLayout();
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      if (lay.W) {
        acc += dt;
        while (acc >= STEP && !stopped) {
          acc -= STEP;
          if (!s.asking && !s.over) update();
        }
        if (!stopped && lay.W) render(now / 1000);
      }
      if (!stopped) raf = requestAnimationFrame(frame);
    }

    // Opening toast
    say('Sneak past the ghosts and collect 3 skeleton keys.', 3200);

    last = performance.now();
    raf = requestAnimationFrame(frame);

    function stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.style.touchAction = prevTouchAction;
      keyStack.length = 0;
      ptrs.clear();
      stickyDir = null;
    }

    return { stop };
  },
};
