// world.js - 3D haunted building, player, camera, controls, interactions, escape sequence.
import * as THREE from 'three';
import { createCharacter } from './characters.js';
import * as state from './state.js';
import { S, hasKey, lockDone, markLock, giveKey, finish, on, save, hasPower } from './state.js';
import room1x from './rooms/room1.js';
import room2x from './rooms/room2.js';
import room3x from './rooms/room3.js';
import room4x from './rooms/room4.js';
import room5x from './rooms/room5.js';
import room6x from './rooms/room6.js';
import { buildSecret } from './secret.js';
const EXTRAS = { 1: room1x, 2: room2x, 3: room3x, 4: room4x, 5: room5x, 6: room6x };

// ---------------------------------------------------------------- constants
const ROOM_L = 16, HALF = 8, WALL_H = 6, DOOR_W = 3.4, DOOR_H = 3.8;
const COARSE = matchMedia('(pointer: coarse)').matches;
const OUT_Z = -96;            // z of the house front wall (door 6)
const GATE_Z = -124;          // graveyard gate
const WIN_Z = -125.6;
const SPEED = 5.4, JUMP_V = 8.8, GRAV = 25, STEP = 0.32, PR = 0.35, PH = 1.7;
const ROOM_NAMES = ['', 'Entrance Hall', 'Library', 'Dining Hall', 'Ballroom', 'Cellar', 'Clock Tower Hall'];
const GAMES = { 2: ['flap', 'BAT FLAP', '#7fb0ff'], 3: ['sling', 'PUMPKIN FLING', '#ff9a2a'], 4: ['platform', 'TOMBSTONE HOP', '#c58bff'], 5: ['maze', 'GHOST SNEAK', '#7dff6a'] };
const THEMES = {
  0: { fog: 0x150b1d, d: 0.030, hemi: 2.5 },
  1: { fog: 0x1b0e22, d: 0.028, hemi: 2.5 },
  2: { fog: 0x170f12, d: 0.030, hemi: 2.4 },
  3: { fog: 0x0f1a16, d: 0.030, hemi: 2.4 },
  4: { fog: 0x14162b, d: 0.026, hemi: 2.5 },
  5: { fog: 0x07100a, d: 0.048, hemi: 1.6 },
  6: { fog: 0x101a2e, d: 0.025, hemi: 2.6 },
  7: { fog: 0x0d1530, d: 0.011, hemi: 3.0 },
};
const rz = (room, lz) => -(room - 1) * ROOM_L - lz;       // room-local depth -> world z
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
let seedv = 1;
const srand = n => { seedv = (n * 9301 + 49297) % 2147483647 || 1; };
const rand = () => (seedv = (seedv * 16807) % 2147483647) / 2147483647;
const R = (a, b) => a + rand() * (b - a);

// ---------------------------------------------------------------- module state
let hooks, renderer, scene, camera, moon, hemi, canvasEl;
let G;                                   // group currently being built
const roomGroups = {};                   // 1..6, 7 = outdoors
const solids = [];
const interactables = [];
const spots = [];
const flames = [];
const anims = [];                        // per-frame callbacks (t, dt)
const redraws = [];
const doors = {};
const terminals = {};
const cabinets = {};
const portraits = [];
const holes = [];
let pool = [];
let dustPts, fireflies, fireflyBase;
let mode = 'menu';                       // menu | play | cinematic
let paused = false, busy = false, cooldown = 0;
let player = null, preview = null, previewKey = '', pedestal = [];
const P = { x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, grounded: true, air: 0, coyote: 0, jbuf: 0, face: 0, steps: 0 };
const cam = { yaw: 0, pitch: 0.34, dist: 7.2, cur: 7.2, tgt: new THREE.Vector3(), init: false };
const keys = new Set();
const joy = { x: 0, y: 0, id: null };
let curRoom = 1, shownRoom = -1, shake = 0, scare = null, scareDelay = -1, escapeT = -1, flyKeys = [];
let theme = { fog: new THREE.Color(THEMES[0].fog), d: THEMES[0].d, hemi: THEMES[0].hemi };
let clockHands = null, promptEl, touchEl, actBtn, jumpBtn, joyBase, joyKnob, curIt = null, pendingPreview = null;
const tmpV = new THREE.Vector3();

// ---------------------------------------------------------------- textures and materials
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const run = () => { g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; };
  run(); t.userData.redraw = run;
  return t;
}
const textTex = (w, h, draw) => { const t = canvasTex(w, h, draw); redraws.push(t.userData.redraw); return t; };
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mulHex = (h, f) => { const [r, g, b] = hexRgb(h); return `rgb(${clamp(r * f, 0, 255) | 0},${clamp(g * f, 0, 255) | 0},${clamp(b * f, 0, 255) | 0})`; };

const PAT = {
  wood(g, w, h, a, b) {
    const n = 6, ph = h / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? b : a; g.fillRect(0, i * ph, w, ph);
      g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1;
      for (let k = 0; k < 6; k++) { const y = i * ph + R(3, ph - 3); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * .3, y + R(-3, 3), w * .6, y + R(-3, 3), w, y + R(-2, 2)); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, i * ph, w, 2); g.fillRect((i * 83) % w, i * ph, 2, ph);
    }
  },
  stone(g, w, h, a, b) {
    g.fillStyle = b; g.fillRect(0, 0, w, h);
    const rows = 4, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -R(0, 50);
      while (x < w) { const bw = R(60, 110); g.fillStyle = mulHex(a, R(.8, 1.2)); g.fillRect(x + 2, r * rh + 2, bw - 4, rh - 4); x += bw; }
    }
    for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(0,0,0,${R(.05, .18)})`; g.fillRect(R(0, w), R(0, h), R(1, 3), R(1, 3)); }
  },
  brick(g, w, h, a, b) {
    g.fillStyle = b; g.fillRect(0, 0, w, h);
    const rows = 8, rh = h / rows, bw = w / 4;
    for (let r = 0; r < rows; r++) for (let i = -1; i < 5; i++) {
      g.fillStyle = mulHex(a, R(.75, 1.2)); g.fillRect(i * bw + (r % 2) * bw / 2 + 2, r * rh + 2, bw - 4, rh - 4);
    }
    for (let i = 0; i < 150; i++) { g.fillStyle = `rgba(0,0,0,${R(.05, .2)})`; g.fillRect(R(0, w), R(0, h), R(1, 3), R(1, 3)); }
  },
  paper(g, w, h, a, b) {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += w / 4) { g.fillStyle = b; g.fillRect(x, 0, w / 8, h); }
    g.fillStyle = 'rgba(255,255,255,.07)';
    for (let y = 16; y < h; y += 32) for (let x = 16; x < w; x += 32) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,.25)'); gr.addColorStop(.3, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.3)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  },
  checker(g, w, h, a, b) {
    const n = 4, s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = (x + y) % 2 ? a : b; g.fillRect(x * s, y * s, s, s); }
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${R(.04, .14)})`; g.fillRect(R(0, w), R(0, h), R(1, 4), R(1, 4)); }
  },
  carpet(g, w, h, a, b) {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.strokeStyle = b; g.lineWidth = 12; g.strokeRect(8, 8, w - 16, h - 16);
    g.lineWidth = 3; g.strokeRect(34, 34, w - 68, h - 68);
    g.beginPath(); g.moveTo(w / 2, 60); g.lineTo(w - 60, h / 2); g.lineTo(w / 2, h - 60); g.lineTo(60, h / 2); g.closePath(); g.stroke();
  },
  grass(g, w, h, a, b) {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { g.fillStyle = mulHex(b, R(.6, 1.3)); g.fillRect(R(0, w), R(0, h), R(1, 3), R(2, 6)); }
  },
};
const baseTex = new Map();
function patTex(kind, a, b) {
  const k = kind + a + b; let t = baseTex.get(k);
  if (!t) { srand(k.length * 7 + a.charCodeAt(2) * 13 + b.charCodeAt(3)); t = canvasTex(256, 256, (g, w, h) => PAT[kind](g, w, h, a, b)); baseTex.set(k, t); }
  return t;
}
const matCache = new Map();
function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  let m = matCache.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0 }, o)); matCache.set(k, m); }
  return m;
}
function tmat(kind, a, b, rx, ry, o = {}) {
  const k = [kind, a, b, rx.toFixed(2), ry.toFixed(2), JSON.stringify(o)].join('|');
  let m = matCache.get(k);
  if (!m) {
    const t = patTex(kind, a, b).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.needsUpdate = true;
    m = new THREE.MeshStandardMaterial(Object.assign({ map: t, roughness: 0.9, metalness: 0 }, o)); matCache.set(k, m);
  }
  return m;
}
const basic = (color, o = {}) => { const k = 'b' + color + JSON.stringify(o); let m = matCache.get(k); if (!m) { m = new THREE.MeshBasicMaterial(Object.assign({ color }, o)); matCache.set(k, m); } return m; };

// ---------------------------------------------------------------- geometry helpers
const BOX = new THREE.BoxGeometry(1, 1, 1);
const cylCache = new Map();
const cylGeo = seg => { let g = cylCache.get(seg); if (!g) { g = new THREE.CylinderGeometry(1, 1, 1, seg); cylCache.set(seg, g); } return g; };
const SPH = new THREE.SphereGeometry(1, 10, 8);

function addSolid(x, y, z, w, h, d, o = {}) {
  const s = { x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + h, z0: z - d / 2, z1: z + d / 2, cam: !!o.cam, on: true };
  solids.push(s); return s;
}
function box(x, y, z, w, h, d, m, o = {}) {
  const mesh = new THREE.Mesh(BOX, m);
  mesh.scale.set(w, h, d); mesh.position.set(x, y + h / 2, z);
  if (o.ry) mesh.rotation.y = o.ry;
  if (o.rz) mesh.rotation.z = o.rz;
  if (o.rx) mesh.rotation.x = o.rx;
  if (o.cast) mesh.castShadow = true;
  (o.g || G).add(mesh);
  if (o.solid) mesh.userData.solid = addSolid(x, y, z, w, h, d, o);
  return mesh;
}
function cyl(x, y, z, r, h, m, o = {}) {
  const mesh = new THREE.Mesh(cylGeo(o.seg || 10), m);
  mesh.scale.set(r, h, r); mesh.position.set(x, y + h / 2, z);
  if (o.cast) mesh.castShadow = true;
  (o.g || G).add(mesh);
  if (o.solid) addSolid(x, y, z, r * 2, h, r * 2, o);
  return mesh;
}
function sph(x, y, z, sx, sy, sz, m, o = {}) {
  const mesh = new THREE.Mesh(SPH, m); mesh.scale.set(sx, sy, sz); mesh.position.set(x, y, z); (o.g || G).add(mesh); return mesh;
}
function plane(x, y, z, w, h, m, ry = 0, o = {}) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.position.set(x, y, z); mesh.rotation.y = ry; if (o.rx) mesh.rotation.x = o.rx; (o.g || G).add(mesh); return mesh;
}
function floorPlane(x, z, w, d, m) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0, z); mesh.receiveShadow = true; G.add(mesh); return mesh;
}
const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
function flame(x, y, z, s = 1) {
  const m = new THREE.Mesh(BOX, flameMat); m.scale.set(0.07 * s, 0.14 * s, 0.07 * s); m.position.set(x, y, z);
  m.userData = { base: 0.14 * s, ph: Math.random() * 9 }; flames.push(m); G.add(m); return m;
}
function addSpot(room, x, y, z, color, i, dist = 12, flick = 0.25) {
  const s = { room, x, y, z, color: new THREE.Color(color), i, dist, flick, ph: Math.random() * 20 };
  spots.push(s); return s;
}
function candle(x, y, z, room, light = true, h = 0.2) {
  cyl(x, y, z, 0.04, h, mat('#efe3c4', { roughness: 0.6 }), { seg: 6 });
  flame(x, y + h + 0.07, z);
  if (light) addSpot(room, x, y + h + 0.3, z, 0xffa850, 7, 9, 0.35);
}
function candelabra(x, y, z, room, light = true) {
  const brass = mat('#8a6a2a', { metalness: 0.5, roughness: 0.45 });
  cyl(x, y, z, 0.16, 0.06, brass, { seg: 8 }); cyl(x, y, z, 0.04, 0.55, brass, { seg: 6 });
  box(x, y + 0.5, z, 0.6, 0.04, 0.04, brass);
  for (const dx of [-0.28, 0, 0.28]) candle(x + dx, y + 0.54, z, room, false, 0.22);
  if (light) addSpot(room, x, y + 1.2, z, 0xffa040, 14, 11, 0.3);
}

// canvas-drawn decals ----------------------------------------------------------
const pumpkinFace = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#ffd24a'; g.shadowColor = '#ff9a1a'; g.shadowBlur = 14;
  g.beginPath(); g.moveTo(22, 52); g.lineTo(52, 52); g.lineTo(37, 24); g.fill();
  g.beginPath(); g.moveTo(76, 52); g.lineTo(106, 52); g.lineTo(91, 24); g.fill();
  g.beginPath(); g.moveTo(64, 62); g.lineTo(54, 78); g.lineTo(74, 78); g.fill();
  g.beginPath(); g.moveTo(20, 86); g.lineTo(36, 82); g.lineTo(46, 100); g.lineTo(58, 86); g.lineTo(70, 100); g.lineTo(82, 86); g.lineTo(92, 100); g.lineTo(108, 86); g.lineTo(100, 112); g.lineTo(28, 112); g.fill();
});
const faceMat = new THREE.MeshBasicMaterial({ map: pumpkinFace, transparent: true, depthWrite: false });
function pumpkin(x, y, z, s, ry, room, light = true) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); G.add(g);
  const o = { g };
  sph(0, 0.4, 0, 0.55, 0.42, 0.55, mat('#e8650c', { roughness: 0.6, emissive: '#5a2000' }), o);
  box(0, 0.74, 0, 0.12, 0.18, 0.12, mat('#4a5a1c'), o);
  plane(0, 0.42, 0.5, 0.7, 0.7, faceMat, 0, o);
  if (light) addSpot(room, x, y + 0.5, z + Math.cos(ry) * 0.4, 0xff8a24, 8 * s, 8, 0.4);
  return g;
}
const webTex = canvasTex(128, 128, (g, w, h) => {
  g.strokeStyle = 'rgba(235,235,245,.7)'; g.lineWidth = 1.2;
  for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 180, Math.sin(a) * 180); g.stroke(); }
  for (let r = 18; r < 130; r += 17) { g.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2, rr = r - (i % 2 ? 5 : 0); const px = Math.cos(a) * rr, py = Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
});
function cobweb(room, side, corner, size = 2.2) {
  const m = plane(side * (HALF - 0.03), WALL_H - size / 2, rz(room, corner === 'far' ? 15.65 - size / 2 : 0.35 + size / 2),
    size, size, new THREE.MeshBasicMaterial({ map: webTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.8 }), -side * Math.PI / 2);
  if ((side < 0) === (corner === 'far')) m.scale.x = -1;
}
function windowW(room, side, lz, w, h, y0, tint = 0x5f7fc0) {
  const x = side * (HALF - 0.04), z = rz(room, lz), ry = -side * Math.PI / 2;
  const frame = mat('#2a1c14');
  plane(x, y0 + h / 2, z, w, h, basic(tint), ry);
  const o = {};
  box(x, y0 - 0.08, z, 0.25, 0.16, w + 0.3, frame, o); box(x, y0 + h, z, 0.25, 0.16, w + 0.3, frame, o);
  box(x, y0, z - w / 2 - 0.08, 0.25, h, 0.16, frame, o); box(x, y0, z + w / 2 + 0.08, 0.25, h, 0.16, frame, o);
  box(x, y0 + h / 2 - 0.04, z, 0.2, 0.08, w, frame, o); box(x, y0, z, 0.2, h, 0.08, frame, o);
  addSpot(room, x - side * 1.2, y0 + h * 0.5, z, 0x7a9cff, 7, 9, 0.05);
}
function portrait(room, x, y, z, ry, hue) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; G.add(g);
  const o = { g };
  box(0, -0.85, -0.04, 1.45, 1.85, 0.12, mat('#6a4a1c', { metalness: 0.4, roughness: 0.5 }), o);
  const tex = canvasTex(128, 160, (c, w, h) => {
    c.fillStyle = `hsl(${hue},30%,16%)`; c.fillRect(0, 0, w, h);
    c.fillStyle = `hsl(${hue},25%,10%)`; c.beginPath(); c.ellipse(64, 175, 62, 70, 0, 0, 7); c.fill();
    c.fillStyle = '#1b1218'; c.beginPath(); c.ellipse(64, 66, 34, 42, 0, 0, 7); c.fill();
    c.fillStyle = '#cdbf9e'; c.beginPath(); c.ellipse(64, 72, 27, 34, 0, 0, 7); c.fill();
    c.fillStyle = '#f4f0e4'; for (const ex of [50, 78]) { c.beginPath(); c.ellipse(ex, 68, 8, 5, 0, 0, 7); c.fill(); }
    c.strokeStyle = '#3a2a22'; c.lineWidth = 2; c.beginPath(); c.moveTo(52, 92); c.quadraticCurveTo(64, 98, 76, 92); c.stroke();
    c.beginPath(); c.moveTo(60, 74); c.lineTo(58, 84); c.lineTo(64, 84); c.stroke();
  });
  plane(0, -0.85, 0.03, 1.2, 1.5, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: '#201418', emissiveMap: tex, emissiveIntensity: 0.4 }), 0, o);
  const pm = basic(0x050505), pupils = [];
  for (const ex of [50, 78]) { const p = new THREE.Mesh(BOX, pm); p.scale.set(0.075, 0.075, 0.02); p.position.set((ex / 128 - 0.5) * 1.2, (0.5 - 68 / 160) * 1.5 - 0.85, 0.045); g.add(p); pupils.push(p); }
  portraits.push({ room, g, pupils, base: pupils.map(p => p.position.clone()) });
}
function armour(x, z, ry, room) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; G.add(g);
  const m = mat('#8a909c', { metalness: 0.55, roughness: 0.4 }), dk = mat('#3a3f4a', { metalness: 0.4 }), o = { g };
  box(-0.17, 0, 0, 0.26, 0.85, 0.3, m, o); box(0.17, 0, 0, 0.26, 0.85, 0.3, m, o);
  box(0, 0.85, 0, 0.7, 0.8, 0.4, m, o); box(0, 1.0, 0.21, 0.4, 0.4, 0.04, dk, o);
  box(-0.5, 0.85, 0, 0.3, 0.7, 0.3, m, o); box(0.5, 0.85, 0, 0.3, 0.7, 0.3, m, o);
  box(0, 1.65, 0, 0.5, 0.5, 0.5, m, o); box(0, 1.75, 0.26, 0.38, 0.07, 0.04, basic(0x7dff6a), o);
  box(0, 2.15, 0, 0.1, 0.25, 0.3, mat('#b03030'), o);
  box(0.62, 0.2, 0.1, 0.06, 2.2, 0.06, mat('#5a3a20'), o); box(0.62, 2.1, 0.1, 0.05, 0.3, 0.3, m, o);
  box(0, 0, 0, 0.9, 0.12, 0.7, dk, o);
  addSolid(x, 0, z, 1.0, 2.2, 0.8, {});
}
function bookTex(len) {
  return canvasTex(256, 256, (g, w, h) => {
    srand(len * 11 + 3);
    g.fillStyle = '#2a1a10'; g.fillRect(0, 0, w, h);
    const rows = 5, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = 4;
      while (x < w - 6) { const bw = R(8, 17), bh = rh - R(10, 22); g.fillStyle = `hsl(${R(0, 360)},${R(25, 55)}%,${R(18, 38)}%)`; g.fillRect(x, r * rh + rh - 6 - bh, bw, bh); g.fillStyle = 'rgba(230,200,120,.4)'; g.fillRect(x + 2, r * rh + rh - 6 - bh + 6, bw - 4, 2); x += bw + 1; }
      g.fillStyle = '#4a3220'; g.fillRect(0, r * rh + rh - 6, w, 6);
    }
  });
}
function bookshelf(room, side, lz, len) {
  const x = side * (HALF - 0.45), z = rz(room, lz);
  box(x, 0, z, 0.9, 3.7, len, mat('#35200f'), { solid: true, cam: true });
  const t = bookTex(len), m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(len / 2.2, 1);
  plane(x - side * 0.46, 1.85, z, len - 0.2, 3.5, m, -side * Math.PI / 2);
}
function pillar(x, z, h = WALL_H, r = 0.5, m) {
  cyl(x, 0, z, r, h, m || mat('#8d8a96'), { solid: true, cam: true, seg: 12 });
  cyl(x, 0, z, r * 1.35, 0.35, m || mat('#7a7783'), { seg: 12 }); cyl(x, h - 0.3, z, r * 1.35, 0.3, m || mat('#7a7783'), { seg: 12 });
}
function gear(x, y, z, r, teeth, axis, speed, room) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  if (axis === 'x') g.rotation.y = Math.PI / 2;
  G.add(g);
  const spin = new THREE.Group(); g.add(spin);
  const m = mat('#9a7a32', { metalness: 0.6, roughness: 0.45 });
  const body = new THREE.Mesh(cylGeo(16), m); body.scale.set(r, 0.25, r); body.rotation.x = Math.PI / 2; spin.add(body);
  const hole = new THREE.Mesh(cylGeo(8), mat('#2a2018')); hole.scale.set(r * 0.25, 0.27, r * 0.25); hole.rotation.x = Math.PI / 2; spin.add(hole);
  for (let i = 0; i < teeth; i++) {
    const a = i / teeth * Math.PI * 2, t = new THREE.Mesh(BOX, m);
    t.scale.set(r * 0.22, r * 0.28, 0.25); t.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); t.rotation.z = a - Math.PI / 2; spin.add(t);
  }
  anims.push((t) => { spin.rotation.z = t * speed; });
}

// ---------------------------------------------------------------- room shell, doors, terminals, cabinets
function shell(r, o) {
  const g = new THREE.Group(); roomGroups[r] = g; scene.add(g); G = g;
  const zc = rz(r, 8), zf = rz(r, 16);
  const wm = (len, h) => tmat(o.wall[0], o.wall[1], o.wall[2], len / 4, h / 4);
  floorPlane(0, zc, 16.2, 16.6, tmat(o.floor[0], o.floor[1], o.floor[2], 6, 6));
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(16.2, 16.6), tmat('wood', '#1f1410', '#2a1a12', 4, 4));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, WALL_H, zc); g.add(ceil);
  const sd = EXTRAS[r]?.side;   // optional doorway in a side wall leading to a side room
  for (const s of [-1, 1]) {
    if (!sd || sd.side !== s) { box(s * 8.25, 0, zc, 0.5, WALL_H, 16.8, wm(16.8, WALL_H), { solid: true, cam: true }); continue; }
    const w = sd.w || 2.6, a = sd.lz - w / 2, b = sd.lz + w / 2;   // gap from room-local depth a to b
    const l1 = a + 0.4, l2 = 16.4 - b;
    box(s * 8.25, 0, rz(r, -0.4 + l1 / 2), 0.5, WALL_H, l1, wm(l1, WALL_H), { solid: true, cam: true });
    box(s * 8.25, 0, rz(r, b + l2 / 2), 0.5, WALL_H, l2, wm(l2, WALL_H), { solid: true, cam: true });
    box(s * 8.25, DOOR_H, rz(r, sd.lz), 0.5, WALL_H - DOOR_H, w, wm(w, 2.2), { solid: true, cam: true });
    const frame = mat('#6e6a78');
    box(s * 8.25, DOOR_H, rz(r, sd.lz), 0.7, 0.22, w + 0.4, frame);
    for (const k of [-1, 1]) box(s * 8.25, 0, rz(r, sd.lz + k * (w / 2 + 0.1)), 0.7, DOOR_H, 0.2, frame);
  }
  const seg = wm(6.8, WALL_H);
  box(-5.1, 0, zf, 6.8, WALL_H, 0.6, seg, { solid: true, cam: true });
  box(5.1, 0, zf, 6.8, WALL_H, 0.6, seg, { solid: true, cam: true });
  box(0, DOOR_H, zf, DOOR_W, WALL_H - DOOR_H, 0.6, wm(3.4, 2.2), { solid: true, cam: true });
  if (r === 1) box(0, 0, 0.25, 17, WALL_H, 0.5, wm(17, WALL_H), { solid: true, cam: true });
  // baseboard + door trim
  const trim = mat('#22150e');
  for (const s of [-1, 1]) box(s * (HALF - 0.08), 0, zc, 0.16, 0.45, 16, trim);
  box(0, DOOR_H, zf, DOOR_W + 0.5, 0.25, 0.8, mat('#6e6a78'));
  for (const s of [-1, 1]) box(s * (DOOR_W / 2 + 0.12), 0, zf, 0.25, DOOR_H, 0.8, mat('#6e6a78'));
  // heavy door (slides up into the lintel)
  const pivot = new THREE.Group(); pivot.position.set(-DOOR_W / 2, 0, zf); g.add(pivot);
  const wood = tmat('wood', '#3a2414', '#2f1c0f', 1, 1.3);
  const door = new THREE.Mesh(BOX, wood); door.scale.set(DOOR_W - 0.06, DOOR_H - 0.05, 0.25); door.position.set(DOOR_W / 2, DOOR_H / 2, 0); pivot.add(door);
  const iron = mat('#1c1c22', { metalness: 0.6, roughness: 0.5 });
  for (const y of [0.6, 1.9, 3.2]) { const b = new THREE.Mesh(BOX, iron); b.scale.set(DOOR_W - 0.1, 0.16, 0.3); b.position.set(DOOR_W / 2, y, 0); pivot.add(b); }
  for (const s of [-1, 1]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 12), iron); ring.position.set(DOOR_W - 0.4, 1.7, s * 0.17); pivot.add(ring); }
  const ds = addSolid(0, 0, zf, DOOR_W, DOOR_H, 0.3, { cam: true });
  doors[r] = { pivot, open: 0, target: 0, solid: ds, z: zf };
  return g;
}
function lockTex(done, n) {
  return textTex(160, 120, (g, w, h) => {
    const c = done ? '#7dff6a' : '#ff7a1a';
    g.fillStyle = '#0b0710'; g.fillRect(0, 0, w, h);
    g.strokeStyle = c; g.lineWidth = 4; g.shadowColor = c; g.shadowBlur = 10; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = c;
    for (let i = 0; i < 9; i++) { g.fillRect(24 + (i % 3) * 22, 40 + Math.floor(i / 3) * 20, 14, 12); }
    g.font = 'bold 22px Creepster, Impact, sans-serif'; g.textAlign = 'center';
    g.fillText(done ? 'OPEN' : 'LOCK ' + n, 118, 60); g.font = '14px Nunito, sans-serif';
    g.fillText(done ? 'unlocked' : 'press E', 118, 84);
  });
}
function terminal(r) {
  const x = 3.4, z = rz(r, 15.1), stone = mat('#3c3550', { roughness: 0.6 });
  box(x, 0, z, 0.9, 0.25, 0.9, mat('#2a2438'), { solid: true });
  box(x, 0.25, z, 0.6, 0.85, 0.6, stone, { solid: true });
  const lt = lockTex(false, r), dt = lockTex(true, r);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.46), new THREE.MeshBasicMaterial({ map: lt }));
  scr.position.set(x, 1.28, z + 0.12); scr.rotation.x = -0.55; G.add(scr);
  box(x, 1.1, z, 0.66, 0.1, 0.66, mat('#1d1830'));
  const spot = addSpot(r, x, 1.8, z + 0.8, 0xff7a1a, 7, 7, 0.2);
  terminals[r] = { scr, lt, dt, spot, x, z };
  interactables.push({
    room: r, x, y: 1.1, z, r: 2.4, label: 'Use lock',
    active: () => !lockDone(r),
    run: async () => {
      if (lockDone(r)) return;
      if (!hasKey(r)) { hooks.toast('This lock needs the key from the arcade machine in this room'); return; }
      const ok = await hooks.openLock(r);
      if (ok && !lockDone(r)) markLock(r);
      if (lockDone(r)) { openDoor(r, false); }
    },
  });
}
function setTerminalState(r) {
  const t = terminals[r]; if (!t) return;
  const done = lockDone(r);
  t.scr.material.map = done ? t.dt : t.lt; t.scr.material.needsUpdate = true;
  t.spot.color.set(done ? 0x7dff6a : 0xff7a1a);
}
function arcadeTex(title, color) {
  return textTex(256, 200, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#120a1e'); gr.addColorStop(1, '#2a1244');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.07)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
    g.textAlign = 'center'; g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 16;
    g.font = 'bold 44px Creepster, Impact, sans-serif';
    const words = title.split(' '); words.forEach((wd, i) => g.fillText(wd, w / 2, 76 + i * 48 - (words.length - 1) * 10));
    g.shadowBlur = 0; g.fillStyle = '#f3ead8'; g.font = 'bold 15px Nunito, sans-serif'; g.fillText('PRESS E TO PLAY', w / 2, 182);
  });
}
function keyMesh() {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0x9a6a00, metalness: 0.7, roughness: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 12), m); ring.position.y = 0.4; g.add(ring);
  const shaft = new THREE.Mesh(BOX, m); shaft.scale.set(0.07, 0.55, 0.07); g.add(shaft);
  for (const y of [-0.2, -0.08]) { const t = new THREE.Mesh(BOX, m); t.scale.set(0.2, 0.07, 0.07); t.position.set(0.1, y, 0); g.add(t); }
  return g;
}
function cabinet(r, x, lz, y0 = 0) {
  const [id, title, color] = GAMES[r];
  const z = rz(r, lz);
  const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = Math.PI / 2; G.add(g);
  const o = { g }, body = mat('#2a1a44', { roughness: 0.6 }), trim = mat(color, { emissive: color, emissiveIntensity: 0.5 });
  box(0, 0, 0, 1.0, 1.0, 0.9, body, o); box(0, 1.0, -0.1, 1.0, 0.7, 0.7, body, o); box(0, 1.7, -0.05, 1.0, 0.3, 0.8, body, o);
  box(0, 1.9, -0.05, 1.04, 0.22, 0.86, trim, o);
  const onTex = arcadeTex(title, color), offTex = arcadeOffTex();
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.62), new THREE.MeshBasicMaterial({ map: hasPower(r) ? onTex : offTex }));
  scr.position.set(0, 1.35, 0.26); scr.rotation.x = -0.2; g.add(scr);
  box(0, 0.95, 0.36, 0.95, 0.1, 0.45, mat('#16102a'), { g, rx: 0.2 });
  sph(-0.2, 1.08, 0.45, 0.05, 0.05, 0.05, mat('#e0384a'), o); sph(0.1, 1.04, 0.47, 0.045, 0.045, 0.045, mat('#7dff6a'), o); sph(0.25, 1.04, 0.47, 0.045, 0.045, 0.045, mat('#ffd24a'), o);
  addSolid(x, y0, z, 1.15, 2.0, 1.1, {});
  const cspot = addSpot(r, x + 1.0, y0 + 1.5, z, color, 7, 8, 0.15);
  const key = keyMesh(); key.position.set(x, y0 + 2.7, z); G.add(key);
  anims.push(t => { key.rotation.y = t * 1.8; key.position.y = y0 + 2.7 + Math.sin(t * 2) * 0.08; });
  cabinets[r] = { key, x, y: y0, z, scr, onTex, offTex, spot: cspot, color };
  setCabinetPower(r);
  interactables.push({
    room: r, x: x + 0.9, y: y0 + 1.0, z, r: 2.3, get label() { return hasPower(r) ? 'Play arcade game' : 'Check arcade machine'; },
    active: () => !hasKey(r),
    run: async () => {
      if (!hasPower(r)) { hooks.sfx('wrong'); hooks.toast(EXTRAS[r]?.powerHint || 'The machine is dead. Search this room for a way to power it.'); return; }
      const ok = await hooks.openMinigame(id);
      if (ok) {
        giveKey(r); hooks.sfx('key'); cabinets[r].key.visible = false; flyKey(cabinets[r]);
        hooks.toast('You won the key for the ' + ROOM_NAMES[r] + ' door!');
      }
    },
  });
}
function arcadeOffTex() {
  return canvasTex(256, 200, (g, w, h) => {
    g.fillStyle = '#07060b'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.04)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
    g.textAlign = 'center'; g.fillStyle = '#5a5168'; g.font = 'bold 20px Nunito, sans-serif'; g.fillText('NO POWER', w / 2, h / 2 + 7);
  });
}
function setCabinetPower(r) {
  const c = cabinets[r]; if (!c) return;
  const p = hasPower(r);
  c.scr.material.map = p ? c.onTex : c.offTex; c.scr.material.needsUpdate = true;
  if (c.spot) c.spot.i = p ? 7 : 0.6;
}
function flyKey(c) {
  const k = keyMesh(); k.scale.setScalar(1.2); k.position.set(c.x, c.y + 2.7, c.z); scene.add(k);
  flyKeys.push({ k, t: 0, from: k.position.clone() });
}
function openDoor(r, instant) {
  const d = doors[r]; if (!d) return;
  setTerminalState(r);
  if (d.target === 1) { if (instant) { d.open = 1; d.solid.on = false; d.pivot.position.y = 3.6; } return; }
  d.target = 1;
  if (instant) { d.open = 1; d.solid.on = false; d.pivot.position.y = 3.6; }
  else { hooks.sfx('door'); shake = Math.max(shake, 0.15); }
}
function syncState(instant) {
  for (let r = 1; r <= 6; r++) {
    const d = doors[r];
    if (lockDone(r)) openDoor(r, instant);
    else { d.target = 0; d.open = 0; d.solid.on = true; d.pivot.position.y = 0; }
    setTerminalState(r);
    if (cabinets[r]) { cabinets[r].key.visible = !hasKey(r); setCabinetPower(r); }
  }
}

// ---------------------------------------------------------------- rooms
function room1() {
  shell(1, { wall: ['paper', '#4a2438', '#5c2d46'], floor: ['wood', '#3b2616', '#4a301c'] });
  box(0, 0.02, rz(1, 8), 3, 0.04, 15, tmat('carpet', '#6b1226', '#c9a24a', 1, 5), {});
  // preview pedestal
  pedestal = [cyl(0, 0, rz(1, 8), 1.0, 0.5, mat('#4a4458'), { seg: 16 }), cyl(0, 0.5, rz(1, 8), 0.85, 0.1, mat('#6a6478'), { seg: 16 })];
  // grand stairs and landing on the left
  const wood = tmat('wood', '#3b2616', '#4a301c', 1, 1);
  for (let i = 0; i < 5; i++) box(-6.7, 0, rz(1, 4.5 + i), 2.6, (i + 1) * 0.5, 1.0, wood, { solid: true, cast: true });
  box(-6.7, 0, rz(1, 11.5), 2.6, 2.5, 5, wood, { solid: true });
  const rail = mat('#2a1810');
  for (let i = 0; i < 6; i++) box(-5.45, 0.3 + (i < 5 ? i * 0.5 : 2.5), rz(1, 4.5 + Math.min(i, 5) * 1.0), 0.08, 0.7, 0.08, rail);
  box(-5.45, 2.9, rz(1, 11.5), 0.1, 0.1, 5, rail); box(-5.45, 2.5, rz(1, 11.5), 0.08, 0.5, 0.08, rail);
  box(-5.45, 2.4, rz(1, 7), 0.1, 0.1, 6.2, rail, { rx: 0.0, rz: 0 });
  pumpkin(-7.0, 2.5, rz(1, 12.5), 0.9, Math.PI / 2, 1);
  windowW(1, -1, 7, 1.8, 2.4, 3.2, 0x5f7fc0);
  portrait(1, -7.88, 4.3, rz(1, 12.5), Math.PI / 2, 280);
  portrait(1, 7.88, 3.7, rz(1, 4.5), -Math.PI / 2, 20);
  portrait(1, 7.88, 3.7, rz(1, 9), -Math.PI / 2, 200);
  portrait(1, 7.88, 3.7, rz(1, 13.5), -Math.PI / 2, 120);
  portrait(1, -5.6, 3.9, rz(1, 15.66), 0, 340);
  portrait(1, 5.6, 3.9, rz(1, 15.66), 0, 60);
  for (const lz of [2.5, 6.5, 11]) armour(7.0, rz(1, lz), -Math.PI / 2, 1);
  armour(-2.7, rz(1, 15.0), 0, 1);
  pumpkin(-3.6, 0, rz(1, 14.9), 1, 0.3, 1); pumpkin(5.2, 0, rz(1, 3.0), 0.9, -0.4, 1);
  for (const [x, z, ry] of [[7.85, 6.5, -Math.PI / 2], [-7.85, 3.0, Math.PI / 2]]) { /* wall sconces */
    box(x, 3.0, rz(1, z), 0.12, 0.1, 0.3, mat('#2a2a30', { metalness: 0.6 })); candle(x - Math.sign(x) * 0.15, 3.1, rz(1, z), 1, true, 0.25);
  }
  for (const x of [-2.9, 2.9]) { box(x, 3.0, rz(1, 15.5), 0.3, 0.1, 0.12, mat('#2a2a30', { metalness: 0.6 })); candle(x, 3.1, rz(1, 15.4), 1, true, 0.25); }
  addSpot(1, 0, 4.8, rz(1, 8), 0xffc890, 9, 16, 0.12);
  cobweb(1, 1, 'far'); cobweb(1, -1, 'near'); cobweb(1, 1, 'near', 1.6);
  terminal(1);
}
function room2() {
  shell(2, { wall: ['wood', '#5e3a1f', '#4c2e18'], floor: ['wood', '#5a4026', '#6a4a2e'] });
  for (const lz of [3, 7.2, 11.4]) bookshelf(2, 1, lz, 3.6);
  bookshelf(2, -1, 3, 3.6); bookshelf(2, -1, 13.2, 3.6);
  cyl(0, 0.02, rz(2, 8.5), 3.2, 0.03, tmat('carpet', '#2c1a3a', '#9a7a3a', 1, 1), { seg: 24 });
  for (const [x, lz] of [[-3.0, 5.5], [3.0, 10.5]]) {
    box(x, 0, rz(2, lz), 2.2, 0.9, 1.1, mat('#4a2e18'), { solid: true, cast: true });
    candle(x - 0.4, 0.9, rz(2, lz), 2, true, 0.25); box(x + 0.3, 0.9, rz(2, lz), 0.5, 0.06, 0.4, mat('#a62a3a'));
    for (const s of [-1, 1]) box(x + s * 1.9, 0, rz(2, lz) + 0.3, 0.7, 0.5, 0.7, mat('#5a2230'), {});
  }
  // floating books and candles
  const books = [];
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    const b1 = new THREE.Mesh(BOX, mat(`hsl(${i * 47},45%,32%)`)); b1.scale.set(0.38, 0.08, 0.28); g.add(b1);
    const b2 = new THREE.Mesh(BOX, mat('#e8dcb8')); b2.scale.set(0.34, 0.06, 0.25); b2.position.set(0.02, 0, 0); g.add(b2);
    G.add(g); books.push(g);
  }
  const cx = 0, cz = rz(2, 8);
  anims.push(t => books.forEach((b, i) => {
    const a = t * 0.35 + i * 0.785, rr = 2.3 + (i % 3) * 0.7;
    b.position.set(cx + Math.cos(a) * rr, 2.4 + (i % 4) * 0.45 + Math.sin(t * 1.3 + i) * 0.18, cz + Math.sin(a) * rr);
    b.rotation.set(Math.sin(t + i) * 0.4, -a, Math.cos(t * 0.8 + i) * 0.5);
  }));
  for (const [x, lz] of [[-1.2, 3.8], [1.8, 12.5]]) {
    const g = new THREE.Group(); G.add(g);
    const c = new THREE.Mesh(cylGeo(6), mat('#efe3c4')); c.scale.set(0.05, 0.3, 0.05); g.add(c);
    const f = flame(0, 0.22, 0, 1.2); G.remove(f); g.add(f);
    g.position.set(x, 2.2, rz(2, lz)); anims.push(t => { g.position.y = 2.2 + Math.sin(t * 1.5 + x) * 0.12; });
    addSpot(2, x, 2.4, rz(2, lz), 0xffa850, 9, 9, 0.35);
  }
  pumpkin(-5.2, 0, rz(2, 14.5), 0.9, 0.4, 2); pumpkin(5.4, 0, rz(2, 1.8), 0.8, -0.5, 2);
  addSpot(2, 0, 4.5, rz(2, 8), 0xffb070, 10, 16, 0.1);
  cobweb(2, 1, 'far'); cobweb(2, -1, 'far'); cobweb(2, 1, 'near');
  cabinet(2, -7.3, 8);
  terminal(2);
}
function chair(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; G.add(g);
  const w = mat('#3a2010'), o = { g };
  box(0, 0.45, 0, 0.6, 0.1, 0.6, w, o); box(0, 0.55, -0.27, 0.6, 0.9, 0.08, w, o);
  for (const [a, b] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) box(a, 0, b, 0.07, 0.45, 0.07, w, o);
}
function room3() {
  shell(3, { wall: ['paper', '#1f3a2e', '#2a4a3a'], floor: ['wood', '#3b2a1c', '#4a3524'] });
  const zc = rz(3, 8.5);
  box(0, 0, zc, 2.2, 0.95, 8, mat('#3a2012'), { solid: true, cast: true });
  box(0, 0.95, zc, 1.0, 0.03, 8.1, mat('#6a1a2a'));
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) chair(s * 1.7, rz(3, 5.8 + i * 1.9), s > 0 ? -Math.PI / 2 : Math.PI / 2);
  chair(0, rz(3, 3.9), Math.PI); chair(0, rz(3, 13.1), 0);
  candelabra(0, 0.98, rz(3, 6), 3); candelabra(0, 0.98, rz(3, 8.5), 3, false); candelabra(0, 0.98, rz(3, 11), 3);
  for (const lz of [5.2, 7.2, 9.8, 11.8]) for (const s of [-1, 1]) cyl(s * 0.75, 0.98, rz(3, lz), 0.2, 0.03, mat('#cfc8b8', { roughness: 0.4 }), { seg: 10 });
  for (const lz of [6.8, 10.2]) cyl(0.5, 0.98, rz(3, lz), 0.07, 0.16, mat('#b8962e', { metalness: 0.6, roughness: 0.4 }), { seg: 8 });
  pumpkin(-0.3, 0.98, rz(3, 7.3), 0.45, 0, 3, false);
  // fireplace on the right wall
  const st = tmat('stone', '#6b6672', '#2e2a34', 2, 2);
  box(7.2, 0, rz(3, 8), 1.6, 3.4, 4.2, st, { solid: true, cam: true });
  box(6.3, 0, rz(3, 8), 0.2, 1.0, 1.9, basic(0xff6a1a), {});
  box(6.31, 0.05, rz(3, 8), 0.15, 0.25, 1.5, basic(0xffb347), {});
  box(6.35, 1.0, rz(3, 8), 0.4, 0.12, 4.6, mat('#3a3440'));
  const fl = []; for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(BOX, basic(0xffa030)); f.scale.set(0.1, 0.5, 0.25); f.position.set(6.25, 0.55, rz(3, 7.4 + i * 0.6)); G.add(f); fl.push(f); }
  anims.push(t => fl.forEach((f, i) => { f.scale.y = 0.4 + Math.abs(Math.sin(t * 9 + i * 2)) * 0.45; f.position.y = f.scale.y / 2 + 0.2; }));
  addSpot(3, 5.4, 0.8, rz(3, 8), 0xff7a2a, 22, 14, 0.4);
  for (const lz of [3, 13]) windowW(3, -1, lz, 1.8, 2.6, 1.8);
  box(-7.1, 0, rz(3, 8), 0.5, 0.01, 0.5, mat('#000'));
  pumpkin(-5.0, 0, rz(3, 14.5), 1, 0.5, 3); pumpkin(5.2, 0, rz(3, 2.2), 0.8, -0.5, 3, false);
  // hanging skull-lights (spooky green orbs over the table)
  addSpot(3, 0, 3.5, rz(3, 8.5), 0xffb878, 8, 14, 0.12);
  cobweb(3, 1, 'far'); cobweb(3, -1, 'far'); cobweb(3, 1, 'near'); cobweb(3, -1, 'near', 1.7);
  cabinet(3, -7.3, 8);
  terminal(3);
}
function room4() {
  const g = shell(4, { wall: ['paper', '#2a3550', '#3a4868'], floor: ['checker', '#d8d0bc', '#1c1a22'] });
  // collapsed section: replace the middle of the floor with a pit
  g.children.forEach(m => { if (m.isMesh && m.geometry.type === 'PlaneGeometry' && m.rotation.x === -Math.PI / 2) { m.visible = false; } });
  const fm = tmat('checker', '#d8d0bc', '#1c1a22', 3, 1.4);
  floorPlane(0, rz(4, 2.8), 16.2, 5.6, fm); floorPlane(0, rz(4, 14.2), 16.2, 3.6, fm);
  const pit = new THREE.Mesh(BOX, new THREE.MeshStandardMaterial({ map: patTex('stone', '#3a3340', '#15111a'), side: THREE.BackSide, roughness: 1, color: 0x8a7a9a }));
  pit.scale.set(16.2, 6, 6.8); pit.position.set(0, -3, rz(4, 9)); g.add(pit);
  box(0, -5.6, rz(4, 9), 16, 0.1, 6.8, basic(0x2a0f44));
  addSpot(4, 0, -2.5, rz(4, 9), 0x9a5aff, 14, 10, 0.3);
  holes.push({ x0: -8.2, x1: 8.2, z0: rz(4, 12.4), z1: rz(4, 5.6) });
  // Broken stone pillars to hop across, with a glowing rim so they read against the floor.
  const sm = tmat('stone', '#7a7088', '#3a3448', 1, 1), rim = basic('#c58bff');
  for (const [x, lz] of [[-2.5, 6.8], [1.5, 9.0], [-1.8, 11.6]]) {
    box(x, -2.5, rz(4, lz), 2.4, 3.0, 2.4, sm, { solid: true, cast: true });
    for (const [dx, dz, w, d] of [[0, 1.2, 2.44, 0.06], [0, -1.2, 2.44, 0.06], [1.2, 0, 0.06, 2.44], [-1.2, 0, 0.06, 2.44]]) box(x + dx, 0.47, rz(4, lz) + dz, w, 0.05, d, rim);
  }
  // Eerie violet mist glowing up from the pit.
  const mist = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(160,90,255,.85)'); g.addColorStop(1, 'rgba(160,90,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  plane(0, -2.4, rz(4, 9), 16, 7, new THREE.MeshBasicMaterial({ map: mist, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0, { rx: -Math.PI / 2 });
  // chandelier
  const ch = new THREE.Group(); ch.position.set(0, 4.7, rz(4, 9)); G.add(ch);
  const brass = mat('#8a6a2a', { metalness: 0.6, roughness: 0.4 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.07, 6, 16), brass); ring.rotation.x = Math.PI / 2; ch.add(ring);
  const ch2 = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 6, 12), brass); ch2.rotation.x = Math.PI / 2; ch2.position.y = 0.3; ch.add(ch2);
  const chain = new THREE.Mesh(cylGeo(6), brass); chain.scale.set(0.05, 1.4, 0.05); chain.position.y = 1.0; ch.add(chain);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, c = new THREE.Mesh(cylGeo(6), mat('#efe3c4')); c.scale.set(0.05, 0.25, 0.05); c.position.set(Math.cos(a) * 1.3, 0.15, Math.sin(a) * 1.3); ch.add(c);
    const f = new THREE.Mesh(BOX, flameMat); f.scale.set(0.07, 0.14, 0.07); f.position.set(Math.cos(a) * 1.3, 0.36, Math.sin(a) * 1.3); f.userData = { base: 0.14, ph: i }; flames.push(f); ch.add(f);
  }
  anims.push(t => { ch.rotation.z = Math.sin(t * 0.7) * 0.05; ch.rotation.x = Math.cos(t * 0.5) * 0.04; ch.rotation.y = t * 0.1; });
  addSpot(4, 0, 4.2, rz(4, 9), 0xffd090, 18, 18, 0.2);
  // piano
  const pk = mat('#17141c', { roughness: 0.35, metalness: 0.2 });
  box(6.3, 0, rz(4, 3.4), 1.7, 0.95, 2.5, pk, { solid: true, cast: true });
  box(6.35, 0.95, rz(4, 3.6), 1.4, 0.06, 2.2, pk, { rz: 0 });
  box(6.9, 1.0, rz(4, 3.4), 0.1, 0.9, 2.3, pk, { rz: -0.5 });
  for (const lz of [2.5, 4.3]) box(6.0, 0, rz(4, lz), 0.1, 0.5, 0.1, pk);
  const keysTex = canvasTex(128, 32, (c, w, h) => { c.fillStyle = '#e8e0cc'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; for (let i = 0; i < 16; i++) { c.fillRect(i * 8, 0, 1, h); if (i % 7 !== 2 && i % 7 !== 6) c.fillRect(i * 8 + 5, 0, 5, 18); } });
  plane(5.44, 0.85, rz(4, 3.4), 2.0, 0.2, new THREE.MeshBasicMaterial({ map: keysTex, color: 0x998f99 }), -Math.PI / 2);
  box(4.6, 0, rz(4, 3.4), 0.6, 0.5, 1.2, mat('#3a2415'), { solid: true });
  candle(6.3, 0.95 + 0.06, rz(4, 4.4), 4, true, 0.25);
  pillar(-5.8, rz(4, 14.2), WALL_H, 0.5, mat('#9a96a6')); pillar(5.8, rz(4, 14.2), WALL_H, 0.5, mat('#9a96a6'));
  for (const [s, lz] of [[1, 9], [1, 13], [-1, 11]]) {
    windowW(4, s, lz, 1.6, 3.2, 1.6, 0x6a88d0);
    for (const k of [-1, 1]) box(s * 7.8, 0, rz(4, lz + k * 1.4), 0.2, 4.6, 0.7, mat('#6a1a2a'));
  }
  cobweb(4, 1, 'far'); cobweb(4, -1, 'far'); cobweb(4, -1, 'near'); cobweb(4, 1, 'near', 1.8);
  pumpkin(-5.5, 0, rz(4, 1.6), 0.9, 0.4, 4);
  cabinet(4, -7.3, 4);
  terminal(4);
}
function room5() {
  shell(5, { wall: ['brick', '#6a4a3a', '#2a2018'], floor: ['stone', '#55505a', '#1e1c22'] });
  const wood = mat('#4a2e16'), band = mat('#1c1c22', { metalness: 0.5 });
  function barrel(x, y, z) {
    cyl(x, y, z, 0.45, 0.95, wood, { solid: y === 0, seg: 10, cast: true });
    for (const by of [0.15, 0.7]) cyl(x, y + by, z, 0.48, 0.07, band, { seg: 10 });
  }
  for (const [x, y, lz] of [[7.0, 0, 2.6], [7.0, 0, 3.7], [6.2, 0, 3.1], [7.0, 0, 4.8], [6.6, 0.95, 3.2]]) barrel(x, y, rz(5, lz));
  barrel(-7.0, 0, rz(5, 14.8)); barrel(-6.0, 0, rz(5, 14.9));
  // slime barrel + puddles
  const slime = new THREE.MeshBasicMaterial({ color: 0x7dff6a });
  cyl(6.9, 0, rz(5, 11.5), 0.5, 0.95, mat('#2c4a22', { emissive: '#0e3a08' }), { solid: true, seg: 10 });
  cyl(6.9, 0.94, rz(5, 11.5), 0.4, 0.03, slime, { seg: 10 });
  for (const [x, lz, r] of [[5.6, 11.5, 0.8], [4.6, 12.2, 0.5], [-1, 3, 0.6], [2, 6.5, 0.45]]) cyl(x, 0.02, rz(5, lz), r, 0.02, slime, { seg: 12 });
  addSpot(5, 6.4, 1.1, rz(5, 11.5), 0x5fff4a, 20, 10, 0.25); addSpot(5, -1, 0.6, rz(5, 3), 0x5fff4a, 7, 7, 0.3);
  // crates, stack to climb, ledge
  const crate = tmat('wood', '#6a4a26', '#5a3c1e', 1, 1);
  box(-6.0, 0, rz(5, 8.5), 4.0, 2.7, 5, tmat('stone', '#5a5560', '#2a2630', 2, 1), { solid: true, cam: true });
  box(-3.7, 0, rz(5, 8.5), 1.4, 1.8, 1.4, crate, { solid: true, cast: true });
  box(-2.2, 0, rz(5, 8.5), 1.4, 0.9, 1.4, crate, { solid: true, cast: true });
  box(2.8, 0, rz(5, 11.2), 1.1, 1.1, 1.1, crate, { solid: true, cast: true }); box(3.2, 1.1, rz(5, 11.0), 0.8, 0.8, 0.8, crate, { solid: false });
  box(3.0, 0, rz(5, 3.2), 1.2, 1.2, 1.2, crate, { solid: true, cast: true });
  for (const [x, lz] of [[-4.4, 4], [4.4, 7.5]]) pillar(x, rz(5, lz), WALL_H, 0.45, mat('#5a5560'));
  pillar(-4.6, rz(5, 13), WALL_H, 0.45, mat('#5a5560'));
  // pipes
  const pipe = mat('#3a3a42', { metalness: 0.6, roughness: 0.5 });
  const p1 = cyl(0, 5.2, rz(5, 5), 0.15, 15.6, pipe, { seg: 8 }); p1.rotation.z = Math.PI / 2; p1.position.set(0, 5.65, rz(5, 5));
  const p2 = cyl(0, 5.2, rz(5, 13), 0.15, 15.6, pipe, { seg: 8 }); p2.rotation.z = Math.PI / 2; p2.position.set(0, 5.65, rz(5, 13));
  // chains
  const chains = [];
  for (const [x, lz] of [[2, 8], [-1.5, 12], [4.5, 4.5]]) {
    const g = new THREE.Group(); g.position.set(x, WALL_H, rz(5, lz)); G.add(g);
    for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(BOX, band); l.scale.set(i % 2 ? 0.07 : 0.2, 0.28, i % 2 ? 0.2 : 0.07); l.position.y = -0.2 - i * 0.24; g.add(l); }
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 5, 8, Math.PI * 1.5), band); hook.position.y = -2.5; g.add(hook);
    chains.push(g);
  }
  anims.push(t => chains.forEach((c, i) => { c.rotation.z = Math.sin(t * 0.8 + i * 2) * 0.06; }));
  // torches
  for (const [s, lz] of [[1, 8], [-1, 2]]) {
    box(s * 7.85, 2.5, rz(5, lz), 0.2, 0.6, 0.12, band); flame(s * 7.7, 3.15, rz(5, lz), 2.2);
    addSpot(5, s * 7.0, 3.0, rz(5, lz), 0xff8a30, 9, 8, 0.45);
  }
  // iron bars cage in the corner
  for (let i = 0; i < 6; i++) box(-7.2 + 0, 0, rz(5, 0.9 + i * 0.5), 0.06, 2.4, 0.06, band);
  cobweb(5, 1, 'far'); cobweb(5, -1, 'far'); cobweb(5, 1, 'near'); cobweb(5, -1, 'near');
  pumpkin(4.6, 0, rz(5, 14.6), 0.8, 0.5, 5);
  cabinet(5, -7.3, 8.5, 2.7);
  terminal(5);
}
function room6() {
  shell(6, { wall: ['stone', '#5a6278', '#262c3c'], floor: ['wood', '#2a1e1a', '#34261e'] });
  // giant clock face on the right wall
  const clockTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d9cfae'; g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill();
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 14; g.beginPath(); g.arc(256, 256, 244, 0, 7); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.arc(256, 256, 196, 0, 7); g.stroke();
    g.fillStyle = '#2a1a10'; g.font = 'bold 52px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const rom = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    rom.forEach((t, i) => { const a = i / 12 * Math.PI * 2 - Math.PI / 2; g.fillText(t, 256 + Math.cos(a) * 214 * 0.9, 256 + Math.sin(a) * 214 * 0.9); });
  });
  const clockG = new THREE.Group(); clockG.position.set(7.95, 3.3, rz(6, 8)); clockG.rotation.y = -Math.PI / 2; G.add(clockG);
  plane(0, 0, 0, 5.4, 5.4, new THREE.MeshStandardMaterial({ map: clockTex, roughness: 0.8, emissive: '#403830', emissiveMap: clockTex, emissiveIntensity: 0.5 }), 0, { g: clockG });
  const hm = mat('#17110c');
  const minute = new THREE.Group(), hour = new THREE.Group(); clockG.add(minute, hour);
  const mh = new THREE.Mesh(BOX, hm); mh.scale.set(0.12, 2.0, 0.06); mh.position.y = 0.9; minute.add(mh); minute.position.z = 0.07;
  const hh = new THREE.Mesh(BOX, hm); hh.scale.set(0.2, 1.4, 0.06); hh.position.y = 0.6; hour.add(hh); hour.position.z = 0.05;
  const hub = new THREE.Mesh(cylGeo(8), hm); hub.scale.set(0.2, 0.12, 0.2); hub.rotation.x = Math.PI / 2; hub.position.z = 0.09; clockG.add(hub);
  clockHands = { minute, hour };
  // gears
  gear(-7.6, 4.6, rz(6, 3), 1.5, 14, 'x', 0.5, 6); gear(-7.6, 3.0, rz(6, 12.8), 1.0, 10, 'x', -0.75, 6);
  gear(3.5, 5.7, rz(6, 3), 1.2, 12, 'z', 0.4, 6); gear(5.0, 5.2, rz(6, 3), 0.8, 8, 'z', -0.6, 6);
  gear(-3.5, 5.7, rz(6, 15.5), 1.3, 12, 'z', 0.45, 6);
  // pendulum
  const pend = new THREE.Group(); pend.position.set(-4.8, 5.9, rz(6, 3.8)); G.add(pend);
  const gm = mat('#9a7a32', { metalness: 0.6, roughness: 0.4 });
  const rod = new THREE.Mesh(BOX, gm); rod.scale.set(0.08, 4.0, 0.08); rod.position.y = -2; pend.add(rod);
  const bob = new THREE.Mesh(cylGeo(14), gm); bob.scale.set(0.7, 0.14, 0.7); bob.rotation.x = Math.PI / 2; bob.position.y = -4.1; pend.add(bob);
  anims.push(t => { pend.rotation.z = Math.sin(t * 1.6) * 0.38; });
  // big moon window
  const wx = -7.97, wz = rz(6, 8);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.8), basic(0x8aa8e8)); pane.position.set(wx + 0.03, 3.3, wz); pane.rotation.y = Math.PI / 2; G.add(pane);
  const moonD = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), basic(0xfff3c4)); moonD.position.set(wx + 0.05, 3.9, wz - 0.7); moonD.rotation.y = Math.PI / 2; G.add(moonD);
  const fr = mat('#1c1410');
  box(wx, 1.35, wz, 0.3, 0.15, 4.9, fr); box(wx, 5.2, wz, 0.3, 0.15, 4.9, fr);
  box(wx, 1.35, wz - 2.35, 0.3, 3.9, 0.18, fr); box(wx, 1.35, wz + 2.35, 0.3, 3.9, 0.18, fr);
  box(wx, 3.2, wz, 0.25, 0.1, 4.6, fr); box(wx, 1.35, wz, 0.25, 3.9, 0.1, fr);
  const beamTex = canvasTex(16, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(170,196,255,0)'); gr.addColorStop(.5, 'rgba(170,196,255,.9)'); gr.addColorStop(1, 'rgba(170,196,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const bm = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const dx = 6.0, dy = -3.3, len = Math.hypot(dx, dy);
  for (const o of [-1.4, 0, 1.4]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.2, len), bm);
    b.position.set(wx + dx / 2, 3.3 + dy / 2, wz + o); b.rotation.z = Math.atan2(-dx / len, dy / len); G.add(b);
  }
  addSpot(6, -5.5, 3.2, wz, 0x8aa8ff, 22, 14, 0.04);
  // floor sigil
  const sig = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.6, 28), basic(0x6a3aa8, { transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  sig.rotation.x = -Math.PI / 2; sig.position.set(0, 0.03, rz(6, 8)); G.add(sig);
  const sig2 = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.35, 5), basic(0x6a3aa8, { transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  sig2.rotation.x = -Math.PI / 2; sig2.position.set(0, 0.031, rz(6, 8)); G.add(sig2);
  anims.push(t => { sig2.rotation.z = t * 0.3; });
  // braziers
  for (const x of [-5.5, 5.5]) {
    cyl(x, 0, rz(6, 14.2), 0.1, 0.8, mat('#2a2a30', { metalness: 0.6 }), { seg: 6 });
    cyl(x, 0.8, rz(6, 14.2), 0.4, 0.25, mat('#2a2a30', { metalness: 0.6 }), { seg: 8, solid: false });
    flame(x, 1.2, rz(6, 14.2), 3.2); addSpot(6, x, 1.8, rz(6, 14.2), 0xff8030, 12, 10, 0.4);
  }
  pillar(-5.5, rz(6, 7), WALL_H, 0.5, mat('#7a7f94'));
  pumpkin(5.2, 0, rz(6, 2.0), 0.9, -0.5, 6); pumpkin(-2.8, 0, rz(6, 15.0), 0.8, 0.3, 6, false);
  cobweb(6, 1, 'far'); cobweb(6, -1, 'near'); cobweb(6, 1, 'near', 1.8);
  terminal(6);
}

// graveyard path after door 6
let gateLeaves = [];
function outdoors() {
  const g = new THREE.Group(); roomGroups[7] = g; scene.add(g); G = g;
  const gz = (OUT_Z + -132) / 2;
  const ground = new THREE.Mesh(BOX, tmat('grass', '#16301c', '#2c5a30', 10, 8)); ground.scale.set(60, 0.4, 40); ground.position.set(0, -0.23, OUT_Z - 20); ground.receiveShadow = true; g.add(ground);
  box(0, 0, OUT_Z - 14, 4.2, 0.06, 30, tmat('stone', '#6a6672', '#2a2630', 1, 6), {});
  box(0, 0, OUT_Z - 1.2, 3.6, 0.04, 2.4, mat('#3a3340'));
  // fences and bounds
  const iron = mat('#15151c', { metalness: 0.6, roughness: 0.5 });
  const wall = (x0, x1, z0, z1) => addSolid((x0 + x1) / 2, 0, (z0 + z1) / 2, Math.abs(x1 - x0), 4, Math.abs(z1 - z0), { cam: false });
  wall(-12.6, -12.3, OUT_Z, -132); wall(12.3, 12.6, OUT_Z, -132); wall(-12.6, 12.6, -132.3, -132);
  for (const s of [-1, 1]) {
    box(s * 12.4, 0, OUT_Z - 15, 0.1, 0.1, 30, iron); box(s * 12.4, 1.4, OUT_Z - 15, 0.1, 0.1, 30, iron);
    for (let z = OUT_Z - 1; z > -125; z -= 1.5) box(s * 12.4, 0, z, 0.1, 1.7, 0.1, iron);
  }
  // gate wall across, with gap
  const stoneM = tmat('stone', '#7a7682', '#2a2630', 1, 1.5);
  for (const s of [-1, 1]) {
    box(s * 3.4, 0, GATE_Z, 1.0, 3.6, 1.0, stoneM, { solid: true, cam: false }); box(s * 3.4, 3.6, GATE_Z, 1.2, 0.25, 1.2, stoneM);
    const o = box(s * 3.4, 3.85, GATE_Z, 0.5, 0.5, 0.5, stoneM);
    for (let x = 4.1; x < 12.4; x += 1.4) box(s * x, 0, GATE_Z, 0.1, 1.8, 0.1, iron);
    box(s * 8.3, 0.5, GATE_Z, 8.4, 0.1, 0.1, iron); box(s * 8.3, 1.5, GATE_Z, 8.4, 0.1, 0.1, iron);
    addSolid(s * 8.3, 0, GATE_Z, 8.4, 2, 0.4, {});
    // gate leaf
    const piv = new THREE.Group(); piv.position.set(s * 2.9, 0, GATE_Z); g.add(piv);
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(BOX, iron); b.scale.set(0.07, 2.6, 0.07); b.position.set(-s * (0.15 + i * 0.4), 1.3, 0); piv.add(b); }
    for (const y of [0.4, 1.4, 2.4]) { const b = new THREE.Mesh(BOX, iron); b.scale.set(2.4, 0.08, 0.08); b.position.set(-s * 1.2, y, 0); piv.add(b); }
    gateLeaves.push({ piv, s });
  }
  const signT = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#2a1a10'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffe9a8'; c.font = 'bold 40px Creepster, Impact, sans-serif'; c.textAlign = 'center'; c.fillText('FREEDOM', w / 2, 46); });
  redraws.push(signT.userData.redraw);
  box(0, 3.9, GATE_Z, 5.2, 0.9, 0.2, mat('#2a1a10'));
  plane(0, 4.35, GATE_Z + 0.12, 5.0, 0.8, new THREE.MeshBasicMaterial({ map: signT }), 0);
  // gravestones
  srand(77);
  const gm = mat('#6e6c78');
  for (let i = 0; i < 18; i++) {
    const s = rand() < 0.5 ? -1 : 1, x = s * R(3.6, 11), z = OUT_Z - R(5, 26);
    if (Math.abs(z - GATE_Z) < 2) continue;
    const ry = R(-0.3, 0.3), h = R(0.9, 1.5);
    box(x, 0, z, 0.9, h, 0.25, gm, { solid: true, ry, cast: true });
    if (rand() < 0.5) cyl(x, h, z, 0.45, 0.25, gm, { seg: 8 }).rotation.x = Math.PI / 2; else box(x, h, z, 0.9, 0.06, 0.25, gm, { ry });
    if (rand() < 0.4) box(x, 0, z + 0.6, 0.6, 0.12, 0.9, mat('#2e5a2c'));
  }
  // crosses
  for (let i = 0; i < 4; i++) { const x = (i < 2 ? -1 : 1) * R(5, 10), z = OUT_Z - R(8, 22); box(x, 0, z, 0.15, 1.5, 0.15, gm, { solid: true }); box(x, 1.0, z, 0.8, 0.14, 0.15, gm); }
  // dead trees
  const bark = mat('#1e1612');
  for (const [x, z] of [[-9.5, -102], [10, -108], [-10, -116], [9, -120], [-6.5, -99.5]]) {
    cyl(x, 0, z, 0.35, 4.2, bark, { solid: true, seg: 6 });
    for (let k = 0; k < 4; k++) { const b = box(x + (k % 2 ? 0.7 : -0.7), 3.2 + k * 0.3, z, 0.12, 1.8, 0.12, bark); b.rotation.z = (k % 2 ? -1 : 1) * (0.8 + k * 0.1); b.rotation.y = k * 1.3; }
  }
  // lamp posts
  for (const [x, z] of [[-2.6, -104], [2.6, -112], [-2.6, -119]]) {
    box(x, 0, z, 0.12, 2.6, 0.12, iron); box(x, 2.6, z, 0.4, 0.4, 0.4, basic(0xffcf70)); box(x, 3.0, z, 0.5, 0.1, 0.5, iron);
    addSpot(7, x, 2.4, z, 0xffb860, 14, 12, 0.2);
  }
  // sky: moon, glow, stars
  const moonM = new THREE.Mesh(new THREE.SphereGeometry(7, 18, 14), new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }));
  moonM.position.set(-16, 34, -170); g.add(moonM);
  const glowT = canvasTex(128, 128, (c, w, h) => { const gr = c.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, 'rgba(255,240,190,.8)'); gr.addColorStop(1, 'rgba(255,240,190,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(60, 60, 1); glow.position.copy(moonM.position); g.add(glow);
  const sp = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.15, r = 220; sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r * 0.7 + 10; sp[i * 3 + 2] = -100 + Math.sin(a) * Math.cos(e) * r - 80; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })); stars.frustumCulled = false; g.add(stars);
  // fireflies
  const N = 40; fireflyBase = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { fireflyBase[i * 3] = R(-11, 11); fireflyBase[i * 3 + 1] = R(0.5, 2.8); fireflyBase[i * 3 + 2] = OUT_Z - R(3, 30); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const dotT = canvasTex(32, 32, (c, w, h) => { const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,200,1)'); gr.addColorStop(1, 'rgba(200,255,80,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  fireflies = new THREE.Points(fg, new THREE.PointsMaterial({ map: dotT, size: 0.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xdfff70 }));
  fireflies.frustumCulled = false; g.add(fireflies);
  addSpot(7, 0, 6, OUT_Z - 12, 0x9ab4ff, 30, 40, 0.02);
  // exterior roofline so the house reads from outside
  box(0, WALL_H, OUT_Z + 8, 17, 0.6, 16.4, mat('#1a1420'));
}

// ---------------------------------------------------------------- lights and atmosphere
function setupLights() {
  hemi = new THREE.HemisphereLight(0x9aa8e0, 0x4a3050, 1.5); scene.add(hemi);
  moon = new THREE.DirectionalLight(0x9db4ff, 0.9); scene.add(moon, moon.target);
  if (!COARSE) {
    moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024);
    const sc = moon.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 40; moon.shadow.bias = -0.0008;
  }
  const n = COARSE ? 3 : 4;
  for (let i = 0; i < n; i++) { const l = new THREE.PointLight(0xffaa55, 0, 12, 2); scene.add(l); pool.push({ l, spot: null, k: 0 }); }
}
function assignLights() {
  const vis = spots.filter(s => Math.abs(s.room - curRoom) <= 1 || (curRoom >= 5 && s.room === 7));
  const px = P.x, py = P.y + 1, pz = P.z;
  const camPos = mode === 'play' ? { x: px, y: py, z: pz } : { x: camera.position.x, y: 1.5, z: camera.position.z - 3 };
  vis.forEach(s => { s._d = ((s.x - camPos.x) ** 2 + (s.y - camPos.y) ** 2 + (s.z - camPos.z) ** 2 + 4) / s.i; });
  vis.sort((a, b) => a._d - b._d);
  const chosen = vis.slice(0, pool.length), free = [];
  for (const p of pool) { if (p.spot && chosen.includes(p.spot)) chosen.splice(chosen.indexOf(p.spot), 1); else free.push(p); }
  free.forEach((p, i) => { p.spot = chosen[i] || null; p.k = 0; if (p.spot) { p.l.position.set(p.spot.x, p.spot.y, p.spot.z); p.l.color.copy(p.spot.color); p.l.distance = p.spot.dist; } });
}
function setupDust() {
  const N = COARSE ? 50 : 90, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = R(-8, 8); pos[i * 3 + 1] = R(0.2, 5.5); pos[i * 3 + 2] = R(-8, 8); }
  const gm = new THREE.BufferGeometry(); gm.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const t = canvasTex(32, 32, (c, w, h) => { const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,240,210,.9)'); gr.addColorStop(1, 'rgba(255,240,210,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  dustPts = new THREE.Points(gm, new THREE.PointsMaterial({ map: t, size: 0.09, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  dustPts.frustumCulled = false; scene.add(dustPts);
}

// ---------------------------------------------------------------- DOM: prompt and touch controls
function buildDom() {
  const ui = document.getElementById('ui') || document.body;
  promptEl = document.createElement('div'); promptEl.className = 'w-prompt';
  promptEl.style.cssText = 'position:absolute;left:0;top:0;transform:translate(-50%,-50%);display:none;pointer-events:none;padding:6px 14px;border-radius:20px;background:rgba(13,10,20,.82);border:2px solid #ff7a1a;color:#f3ead8;font:800 15px Nunito,sans-serif;white-space:nowrap;box-shadow:0 0 14px rgba(255,122,26,.5)';
  ui.appendChild(promptEl);
  touchEl = document.createElement('div'); touchEl.className = 'w-touch';
  touchEl.style.cssText = 'position:absolute;inset:0;display:none;pointer-events:none;touch-action:none;user-select:none;-webkit-user-select:none';
  const zone = document.createElement('div'); zone.className = 'w-joy';
  zone.style.cssText = 'position:absolute;left:0;bottom:0;width:46%;height:60%;pointer-events:auto;touch-action:none';
  joyBase = document.createElement('div'); joyBase.className = 'w-joybase';
  joyBase.style.cssText = 'position:absolute;width:120px;height:120px;border-radius:50%;border:2px solid rgba(243,234,216,.4);background:rgba(26,20,38,.35);left:26px;bottom:34px;pointer-events:none';
  joyKnob = document.createElement('div'); joyKnob.className = 'w-joyknob';
  joyKnob.style.cssText = 'position:absolute;width:56px;height:56px;border-radius:50%;background:rgba(255,122,26,.55);border:2px solid rgba(243,234,216,.6);left:32px;top:32px;pointer-events:none';
  joyBase.appendChild(joyKnob); zone.appendChild(joyBase);
  const btn = (cls, txt, css) => { const b = document.createElement('button'); b.className = cls; b.textContent = txt; b.style.cssText = 'position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;border:2px solid rgba(243,234,216,.6);color:#f3ead8;font:900 15px Nunito,sans-serif;text-transform:uppercase;-webkit-tap-highlight-color:transparent;' + css; return b; };
  jumpBtn = btn('w-jump', 'Jump', 'right:22px;bottom:30px;width:84px;height:84px;background:rgba(255,122,26,.45)');
  actBtn = btn('w-act', 'Use', 'right:116px;bottom:84px;width:84px;height:84px;background:rgba(125,255,106,.4);display:none');
  touchEl.append(zone, jumpBtn, actBtn); ui.appendChild(touchEl);
  // joystick logic
  const base = { x: 0, y: 0 };
  zone.addEventListener('pointerdown', e => {
    if (joy.id !== null) return; joy.id = e.pointerId; zone.setPointerCapture(e.pointerId);
    const r = zone.getBoundingClientRect(); base.x = e.clientX; base.y = e.clientY;
    joyBase.style.left = (e.clientX - r.left - 60) + 'px'; joyBase.style.bottom = (r.bottom - e.clientY - 60) + 'px'; e.preventDefault();
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== joy.id) return;
    let dx = e.clientX - base.x, dy = e.clientY - base.y; const l = Math.hypot(dx, dy), m = 50;
    if (l > m) { dx = dx / l * m; dy = dy / l * m; }
    joy.x = dx / m; joy.y = dy / m; joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
  });
  const end = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; joyKnob.style.transform = ''; };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  jumpBtn.addEventListener('pointerdown', e => { e.preventDefault(); P.jbuf = 0.15; });
  actBtn.addEventListener('pointerdown', e => { e.preventDefault(); tryInteract(); });
}
function updateTouchVis() { if (touchEl) touchEl.style.display = (COARSE && mode === 'play' && !paused && !busy) ? 'block' : 'none'; }

// ---------------------------------------------------------------- input
const isTyping = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '');
const canControl = () => mode === 'play' && !paused && !busy;
function clearInput() { keys.clear(); joy.x = joy.y = 0; joy.id = null; if (joyKnob) joyKnob.style.transform = ''; }
function setupInput() {
  addEventListener('keydown', e => {
    if (isTyping(e) || !canControl()) return;
    const c = e.code;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) { keys.add(c); e.preventDefault(); }
    else if (c === 'Space') { if (!e.repeat) P.jbuf = 0.15; e.preventDefault(); }
    else if ((c === 'KeyE' || c === 'Enter') && !e.repeat) {
      if (c === 'Enter' && /^(BUTTON|A)$/.test(document.activeElement?.tagName || '')) return;
      tryInteract();
    }
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', clearInput);
  let drag = null;
  canvasEl.addEventListener('pointerdown', e => {
    if (!canControl() || drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { canvasEl.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvasEl.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const k = e.pointerType === 'touch' ? 0.007 : 0.005;
    cam.yaw -= (e.clientX - drag.x) * k; cam.pitch = clamp(cam.pitch + (e.clientY - drag.y) * k * 0.8, 0.05, 1.3);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const up = e => { if (drag && e.pointerId === drag.id) drag = null; };
  canvasEl.addEventListener('pointerup', up); canvasEl.addEventListener('pointercancel', up);
  canvasEl.addEventListener('wheel', e => { if (canControl()) { cam.dist = clamp(cam.dist + e.deltaY * 0.004, 3, 8); } }, { passive: true });
}
async function tryInteract() {
  if (!canControl() || cooldown > 0 || !curIt) return;
  const it = curIt; busy = true; clearInput(); updateTouchVis(); promptEl.style.display = 'none';
  try { await it.run(); } catch (err) { console.error(err); }
  busy = false; cooldown = 0.6; clearInput(); updateTouchVis();
}

// ---------------------------------------------------------------- physics
const inHole = (x, z) => holes.some(h => x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1);
function moveAxis(axis, d) {
  if (!d) return;
  P[axis] += d;
  for (const s of solids) {
    if (!s.on) continue;
    if (P.x + PR <= s.x0 || P.x - PR >= s.x1 || P.z + PR <= s.z0 || P.z - PR >= s.z1) continue;
    if (P.y + PH <= s.y0 || P.y + 0.02 >= s.y1) continue;
    if (s.y1 - P.y <= STEP) continue;
    if (axis === 'x') P.x = d > 0 ? s.x0 - PR - 0.001 : s.x1 + PR + 0.001;
    else P.z = d > 0 ? s.z0 - PR - 0.001 : s.z1 + PR + 0.001;
  }
}
function spawnPoint(r) { return { x: 0, z: rz(r, r === 1 ? 6.5 : 4.6) }; }
function respawn() {
  const sp = spawnPoint(curRoom > 6 ? 6 : curRoom);
  P.x = sp.x; P.z = sp.z; P.y = 0; P.vx = P.vz = P.vy = 0; cam.init = false; hooks.sfx('land');
  hooks.toast('Oops! Back to the start of the room.');
}
function updatePlayer(dt) {
  let ix = 0, iz = 0;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix++;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix--;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz++;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iz--;
  ix += joy.x; iz -= joy.y;
  const l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; }
  const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
  const wx = -sy * iz + cy * ix, wz = -cy * iz - sy * ix;
  const k = 1 - Math.exp(-(P.grounded ? 16 : 7) * dt);
  P.vx += (wx * SPEED - P.vx) * k; P.vz += (wz * SPEED - P.vz) * k;
  moveAxis('x', P.vx * dt); moveAxis('z', P.vz * dt);
  // jump
  P.jbuf -= dt; P.coyote -= dt;
  if (P.grounded) P.coyote = 0.1;
  if (P.jbuf > 0 && P.coyote > 0) { P.vy = JUMP_V; P.grounded = false; P.coyote = 0; P.jbuf = 0; hooks.sfx('jump'); }
  // vertical
  const prevY = P.y; P.vy = Math.max(P.vy - GRAV * dt, -30); P.y += P.vy * dt;
  const was = P.grounded; P.grounded = false;
  if (P.vy <= 0) {
    let top = -Infinity;
    for (const s of solids) {
      if (!s.on || P.x + PR <= s.x0 || P.x - PR >= s.x1 || P.z + PR <= s.z0 || P.z - PR >= s.z1) continue;
      if ((prevY >= s.y1 - 0.03 && P.y < s.y1) || (P.y >= s.y1 - STEP && P.y < s.y1)) top = Math.max(top, s.y1);
    }
    const fl = inHole(P.x, P.z) ? -Infinity : 0;
    if (fl > top && P.y <= fl && prevY >= -0.05) top = fl;
    if (top > -Infinity) { P.y = top; P.vy = 0; P.grounded = true; }
  } else {
    for (const s of solids) {
      if (!s.on || P.x + PR <= s.x0 || P.x - PR >= s.x1 || P.z + PR <= s.z0 || P.z - PR >= s.z1) continue;
      if (s.y0 >= prevY + PH - 0.03 && P.y + PH > s.y0) { P.y = s.y0 - PH; P.vy = 0; }
    }
  }
  if (P.grounded) { if (!was && P.air > 0.25) hooks.sfx('land'); P.air = 0; } else P.air += dt;
  if (P.y < -7) respawn();
  const sp = Math.hypot(P.vx, P.vz);
  if (sp > 0.6 && P.grounded) { P.steps += sp * dt; if (P.steps > 2.1) { P.steps = 0; hooks.sfx('step'); } }
  if (sp > 0.4) { const ta = Math.atan2(P.vx, P.vz); let da = ta - P.face; da = Math.atan2(Math.sin(da), Math.cos(da)); P.face += da * (1 - Math.exp(-14 * dt)); }
  if (player) {
    player.position.set(P.x, P.y, P.z); player.rotation.y = P.face;
    player.userData.animate?.(dt, { speed: clamp(sp / SPEED, 0, 1), grounded: P.grounded });
  }
}

// ---------------------------------------------------------------- camera
function rayClip(o, d, maxT) {
  let best = maxT;
  for (const s of solids) {
    if (!s.cam || !s.on) continue;
    let t0 = 0, t1 = best;
    const sl = (oo, dd, a, b) => {
      if (Math.abs(dd) < 1e-6) return oo >= a && oo <= b;
      let ta = (a - oo) / dd, tb = (b - oo) / dd; if (ta > tb) { const q = ta; ta = tb; tb = q; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); return t0 <= t1;
    };
    if (sl(o.x, d.x, s.x0, s.x1) && sl(o.y, d.y, s.y0, s.y1) && sl(o.z, d.z, s.z0, s.z1) && t0 > 0.001 && t0 < best) best = t0;
  }
  return best;
}
const offV = new THREE.Vector3();
function updateCamera(dt) {
  const k = 1 - Math.exp(-12 * dt);
  const tx = P.x, ty = P.y + 1.45, tz = P.z;
  if (!cam.init) { cam.tgt.set(tx, ty, tz); cam.cur = cam.dist; cam.init = true; }
  cam.tgt.x += (tx - cam.tgt.x) * k; cam.tgt.y += (ty - cam.tgt.y) * (1 - Math.exp(-8 * dt)); cam.tgt.z += (tz - cam.tgt.z) * k;
  // Against a wall, tilt the camera up over the player instead of zooming into their back.
  let pitch = cam.pitch, allowed = 0;
  for (let i = 0; i < 5; i++) {
    pitch = Math.min(cam.pitch + i * 0.16, 0.95);
    const cp = Math.cos(pitch);
    offV.set(Math.sin(cam.yaw) * cp, Math.sin(pitch), Math.cos(cam.yaw) * cp);
    allowed = rayClip(cam.tgt, offV, cam.dist) - 0.3;
    if (allowed >= Math.min(cam.dist, 4.2)) break;
  }
  cam.ep = cam.ep == null ? pitch : cam.ep + (pitch - cam.ep) * (1 - Math.exp(-6 * dt));
  { const cp = Math.cos(cam.ep); offV.set(Math.sin(cam.yaw) * cp, Math.sin(cam.ep), Math.cos(cam.yaw) * cp); }
  allowed = rayClip(cam.tgt, offV, cam.dist) - 0.3;
  const want = clamp(allowed, 0.9, cam.dist);
  if (want < cam.cur) cam.cur = want; else cam.cur += (want - cam.cur) * (1 - Math.exp(-3 * dt));
  camera.position.copy(cam.tgt).addScaledVector(offV, cam.cur);
  camera.position.y = clamp(camera.position.y, 0.35, WALL_H - 0.75);
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake * 0.5; camera.position.y += (Math.random() - 0.5) * shake * 0.5; shake = Math.max(0, shake - dt * 1.2); }
  camera.lookAt(cam.tgt.x, cam.tgt.y + 0.7, cam.tgt.z);
}

// ---------------------------------------------------------------- scare
function makeGhost() {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xd6ecff, transparent: true, opacity: 0.85, fog: false });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.15, 1.8, 10), m); body.position.y = -0.5; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), m); head.position.y = 0.5; g.add(head);
  const blk = new THREE.MeshBasicMaterial({ color: 0x050510, fog: false });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(SPH, blk); e.scale.set(0.12, 0.22, 0.05); e.position.set(s * 0.25, 0.6, 0.58); g.add(e); }
  const mo = new THREE.Mesh(SPH, blk); mo.scale.set(0.16, 0.3, 0.05); mo.position.set(0, 0.15, 0.6); g.add(mo);
  for (const s of [-1, 1]) { const a = new THREE.Mesh(BOX, m); a.scale.set(0.2, 0.2, 1.2); a.position.set(s * 0.8, 0.1, 0.4); a.rotation.y = s * 0.5; g.add(a); }
  g.scale.setScalar(1.5); return g;
}
function startScare() {
  hooks.sfx('scare'); shake = 0.9;
  const ghost = makeGhost(); scene.add(ghost);
  const f = camera.getWorldDirection(new THREE.Vector3()); f.y = 0; f.normalize();
  const side = new THREE.Vector3(-f.z, 0, f.x);
  const cp = camera.position;
  const from = cp.clone().addScaledVector(f, 14).addScaledVector(side, 3); from.y = 1.8;
  const to = cp.clone().addScaledVector(f, -3).addScaledVector(side, -0.4); to.y = 1.9;
  scare = { ghost, from, to, t: 0 };
}

// ---------------------------------------------------------------- escape
function startEscape() {
  mode = 'cinematic'; escapeT = 0; clearInput(); updateTouchVis(); promptEl.style.display = 'none';
  hooks.sfx('win'); hooks.ambience(7);
  escapeT = { t: 0, p0: camera.position.clone(), done: false };
}
const MOON = new THREE.Vector3(-16, 34, -170);
function updateEscape(dt) {
  const e = escapeT; e.t += dt;
  const u = clamp(e.t / 4.2, 0, 1), ease = u * u * (3 - 2 * u);
  if (player) { player.position.set(P.x, P.y + Math.abs(Math.sin(e.t * 6)) * 0.45, P.z); player.rotation.y += dt * 3; player.userData.animate?.(dt, { speed: 0, grounded: false }); }
  const tgt = new THREE.Vector3(P.x, P.y + 14, P.z + 14);
  camera.position.lerpVectors(e.p0, tgt, ease);
  const look = new THREE.Vector3(P.x, P.y + 1.5, P.z).lerp(MOON, ease * 0.7);
  camera.lookAt(look);
  if (e.t > 4.6 && !e.done) { e.done = true; finish(); hooks.onEscape(); }
}

// ---------------------------------------------------------------- per-frame update
function applyTheme(dt, room) {
  const th = THEMES[room] || THEMES[0], k = 1 - Math.exp(-2.5 * dt);
  theme.fog.lerp(tmpCol.setHex(th.fog), k); theme.d += (th.d - theme.d) * k; theme.hemi += (th.hemi - theme.hemi) * k;
  scene.fog.color.copy(theme.fog); scene.fog.density = theme.d; scene.background.copy(theme.fog); hemi.intensity = theme.hemi;
  moon.intensity = room === 7 ? 2.0 : room === 5 ? 0.5 : 1.2;
}
const tmpCol = new THREE.Color();
function setVisibleRooms(r) {
  if (shownRoom === r) return; shownRoom = r;
  for (let i = 1; i <= 7; i++) { const g = roomGroups[i]; if (g) g.visible = i === 7 ? r >= 5 : Math.abs(i - r) <= 1; }
}
function roomAt(z) { return z < OUT_Z - 0.4 ? 7 : clamp(Math.ceil(-z / ROOM_L), 1, 6); }
function updateWorld(dt, t) {
  for (const f of flames) f.scale.y = f.userData.base * (0.8 + 0.5 * Math.sin(t * 12 + f.userData.ph) * Math.sin(t * 7.3 + f.userData.ph * 2));
  for (const a of anims) a(t, dt);
  // clock
  if (clockHands) { const s = Math.floor(t) + Math.min(1, (t % 1) * 6); clockHands.minute.rotation.z = -s * 0.1047; clockHands.hour.rotation.z = -s * 0.1047 / 12; }
  // doors
  for (let r = 1; r <= 6; r++) {
    const d = doors[r];
    if (mode === 'play' && lockDone(r) && d.target === 0) openDoor(r, false);
    if (d.open < d.target) { d.open = Math.min(1, d.open + dt * 0.55); const e = 1 - (1 - d.open) ** 3; d.pivot.position.y = e * 3.6; d.pivot.position.x = -DOOR_W / 2 + (d.open < 1 ? Math.sin(t * 60) * 0.012 : 0); d.solid.on = d.open < 0.45; }
  }
  // gate leaves
  const near = mode !== 'menu' && P.z < GATE_Z + 10 && lockDone(6);
  for (const gl of gateLeaves) gl.piv.rotation.y += ((near ? gl.s * 1.6 : 0) - gl.piv.rotation.y) * (1 - Math.exp(-3 * dt));
  // portraits: eyes follow
  const fx = mode === 'play' || mode === 'cinematic' ? P : camera.position;
  for (const p of portraits) {
    if (Math.abs(p.room - curRoom) > 0) continue;
    tmpV.set(fx.x, (fx.y || 0) + 1.4, fx.z); p.g.worldToLocal(tmpV);
    const l = Math.hypot(tmpV.x, tmpV.y + 0.85, tmpV.z) || 1;
    p.pupils.forEach((pp, i) => { pp.position.x = p.base[i].x + clamp(tmpV.x / l * 0.1, -0.06, 0.06); pp.position.y = p.base[i].y + clamp((tmpV.y + 0.85) / l * 0.1, -0.05, 0.05); });
  }
  // dust
  const dp = dustPts.geometry.attributes.position, cx = mode === 'menu' ? camera.position.x : P.x, cz = mode === 'menu' ? camera.position.z - 4 : P.z;
  dustPts.visible = curRoom <= 6;
  for (let i = 0; i < dp.count; i++) {
    let x = dp.getX(i), y = dp.getY(i), z = dp.getZ(i);
    x += Math.sin(t * 0.3 + i) * 0.1 * dt; y += Math.cos(t * 0.5 + i * 2) * 0.12 * dt - 0.03 * dt; z += Math.cos(t * 0.2 + i * 3) * 0.1 * dt;
    if (x - cx > 8) x -= 16; if (x - cx < -8) x += 16; if (z - cz > 8) z -= 16; if (z - cz < -8) z += 16; if (y < 0.1) y = 5.5; if (y > 5.6) y = 0.2;
    dp.setXYZ(i, x, y, z);
  }
  dp.needsUpdate = true;
  if (curRoom >= 5 && fireflies) {
    const fp = fireflies.geometry.attributes.position;
    for (let i = 0; i < fp.count; i++) fp.setXYZ(i, fireflyBase[i * 3] + Math.sin(t * 0.7 + i) * 1.2, fireflyBase[i * 3 + 1] + Math.sin(t * 1.1 + i * 2) * 0.5, fireflyBase[i * 3 + 2] + Math.cos(t * 0.6 + i * 3) * 1.2);
    fp.needsUpdate = true;
  }
  // flying keys
  for (let i = flyKeys.length - 1; i >= 0; i--) {
    const f = flyKeys[i]; f.t += dt; const u = f.t / 1.3;
    const target = camera.position.clone().add(new THREE.Vector3(1.2, 0.8, 0).applyQuaternion(camera.quaternion)).addScaledVector(camera.getWorldDirection(tmpV), 2.5);
    f.k.position.lerpVectors(f.from, target, u * u); f.k.rotation.y += dt * 8; f.k.scale.setScalar(1.2 * (1 - u * 0.6));
    if (u >= 1) { scene.remove(f.k); flyKeys.splice(i, 1); }
  }
  // point light pool
  lightTimer -= dt; if (lightTimer <= 0) { lightTimer = 0.25; assignLights(); }
  for (const p of pool) {
    if (!p.spot) { p.l.intensity = 0; continue; }
    p.k = Math.min(1, p.k + dt * 2.5);
    const s = p.spot, fl = 1 + s.flick * (Math.sin(t * 13 + s.ph) * 0.5 + Math.sin(t * 7.1 + s.ph * 2) * 0.5) * 0.6 + (Math.random() - 0.5) * s.flick * 0.25;
    p.l.intensity = s.i * fl * p.k * 2.6; p.l.color.copy(s.color);
  }
}
let lightTimer = 0;

const clock = new THREE.Clock();
let totalT = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05); totalT += dt;
  cooldown = Math.max(0, cooldown - dt);
  if (mode === 'play') {
    if (!paused && !busy) updatePlayer(dt);
    else if (player) player.userData.animate?.(dt, { speed: 0, grounded: true });
    updateCamera(dt);
    const r = roomAt(P.z);
    if (r !== curRoom) {
      const prev = curRoom; curRoom = r; hooks.ambience(r);
      if (r <= 6 && r > S.room) { S.room = r; save(); }
      if (r === 5 && !S.scared) scareDelay = 0.9;
    }
    if (scareDelay >= 0) { scareDelay -= dt; if (scareDelay < 0 && curRoom === 5 && !S.scared) { S.scared = true; save(); startScare(); } }
    if (P.z < WIN_Z && lockDone(6)) startEscape();
    // interaction detection
    curIt = null;
    if (!busy && !paused) {
      let bd = 1e9;
      for (const it of interactables) {
        if (it.room !== curRoom || !it.active()) continue;
        const d = Math.hypot(P.x - it.x, P.z - it.z);
        if (d < it.r && Math.abs(P.y + 0.9 - it.y) < 2.2 && d < bd) { bd = d; curIt = it; }
      }
    }
    if (curIt) {
      tmpV.set(curIt.x, curIt.y + 1.0, curIt.z).project(camera);
      if (tmpV.z < 1) {
        promptEl.style.display = 'block';
        promptEl.style.left = ((tmpV.x * 0.5 + 0.5) * innerWidth) + 'px'; promptEl.style.top = ((-tmpV.y * 0.5 + 0.5) * innerHeight) + 'px';
        promptEl.textContent = COARSE ? curIt.label : 'E: ' + curIt.label;
      } else promptEl.style.display = 'none';
    } else promptEl.style.display = 'none';
    if (actBtn) { actBtn.style.display = curIt ? 'block' : 'none'; if (curIt) actBtn.textContent = curIt.button || (curIt.label.startsWith('Use') ? 'Lock' : curIt.label.startsWith('Play') ? 'Play' : 'Use'); }
  } else if (mode === 'cinematic') {
    updateEscape(dt);
  } else {
    // menu: slowly rotating preview, gentle camera sway
    if (preview) preview.rotation.y += dt * 0.7;
    // Match ui.css: side panel on wide screens, bottom sheet on phones in portrait.
    const sheet = matchMedia('(max-width: 700px) and (orientation: portrait), (max-width: 520px)').matches;
    const W = innerWidth, H = innerHeight, shiftX = sheet ? 0 : -Math.min(460, W) / 2, shiftY = sheet ? H * 0.22 : 0;
    if (camera.view?.offsetX !== shiftX || camera.view?.offsetY !== shiftY || camera.view?.fullWidth !== W) { camera.setViewOffset(W, H, shiftX, shiftY, W, H); }
    const cz = rz(1, 3.0), sway = Math.sin(totalT * 0.25) * 0.25;
    camera.position.set(sway, 1.75, cz);
    camera.lookAt(0, 1.25, rz(1, 8));
    curRoom = 1;
  }
  if (scare) {
    scare.t += dt; const u = clamp(scare.t / 1.1, 0, 1), e = u * u * (0.6 + 0.4 * u);
    scare.ghost.position.lerpVectors(scare.from, scare.to, e); scare.ghost.position.y += Math.sin(u * 9) * 0.25;
    scare.ghost.lookAt(camera.position);
    if (u >= 1) { scene.remove(scare.ghost); scare = null; }
    else if (u > 0.55) shake = Math.max(shake, 0.5);
  }
  setVisibleRooms(curRoom);
  applyTheme(dt, mode === 'menu' ? 0 : curRoom);
  updateWorld(dt, totalT);
  if (mode !== 'menu' || true) { moon.position.set((mode === 'menu' ? 0 : P.x) + 4, 12, (mode === 'menu' ? rz(1, 8) : P.z) + 6); moon.target.position.set(mode === 'menu' ? 0 : P.x, 0, mode === 'menu' ? rz(1, 8) : P.z); }
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- room extras (js/rooms/roomN.js)
// Each room file gets a small toolkit (ctx) to add searchable furniture, puzzles, collectibles and spooky reactions.
const CANDY_COLS = ['#ff7a1a', '#e0384a', '#7dff6a', '#c58bff', '#7fd4ff', '#ffd24a'];
const candyGeo = new THREE.SphereGeometry(0.13, 10, 8), wrapGeo = new THREE.ConeGeometry(0.09, 0.14, 6);
function makeCtx(r) {
  const lrz = lz => rz(r, lz);
  const interact = o => { const it = Object.assign({ room: r, y: 1.0, r: 1.9, active: () => true }, o); interactables.push(it); return it; };
  const onFrame = fn => anims.push((t, dt) => { if (curRoom === r || Math.abs(curRoom - r) <= 1) fn(t, dt); });
  // Spinning wrapped sweet, picked up by walking into it. id must be unique, e.g. 'r2-candy1'.
  function candy(x, y, z, id, o = {}) {
    const g = new THREE.Group(), col = CANDY_COLS[(id.length + id.charCodeAt(id.length - 1)) % CANDY_COLS.length];
    const m = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.55, roughness: 0.35 });
    const b = new THREE.Mesh(candyGeo, m); b.scale.set(1.3, 1, 1); g.add(b);
    for (const k of [-1, 1]) { const w = new THREE.Mesh(wrapGeo, m); w.rotation.z = k * Math.PI / 2; w.position.x = k * 0.22; g.add(w); }
    g.position.set(x, y, z); G.add(g);
    const it = { id, g, taken: state.isFound(id), hidden: !!o.hidden };
    g.visible = !it.taken && !it.hidden;
    anims.push(t => {
      if (!g.visible) return;
      g.rotation.y = t * 2 + x; g.position.y = y + Math.sin(t * 2.5 + z) * 0.06;
      if (mode === 'play' && Math.hypot(P.x - x, P.z - z) < 0.9 && Math.abs(P.y + 0.7 - y) < 1.4) {
        if (state.addCandy(id)) { hooks.sfx('key'); hooks.toast('🍬 Candy! (' + S.candy + ' found)'); }
        g.visible = false; it.taken = true;
      }
    });
    // reveal() shows a hidden candy (e.g. when a drawer opens).
    it.reveal = () => { if (!it.taken && !state.isFound(id)) { it.hidden = false; g.visible = true; } };
    return it;
  }
  // The room's one science card: a glowing card that shows a science fact and adds 1 minute.
  function dataCard(x, y, z, { title, html, hidden } = {}) {
    const tex = canvasTex(128, 176, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#24402a'); gr.addColorStop(1, '#101a14');
      c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = '#7dff6a'; c.lineWidth = 6; c.strokeRect(5, 5, w - 10, h - 10);
      c.fillStyle = '#7dff6a'; c.font = 'bold 19px Nunito, sans-serif'; c.textAlign = 'center'; c.fillText('SCIENCE', w / 2, 70); c.fillText('CARD', w / 2, 96);
      c.font = 'bold 40px Nunito, sans-serif'; c.fillText(String(r), w / 2, 148);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.58), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    m.position.set(x, y, z); G.add(m);
    const glow = { room: r, x, y, z, color: new THREE.Color('#7dff6a'), i: 2.5, dist: 4, flick: 0.1, ph: 0 }; spots.push(glow);
    const card = { m, hidden: !!hidden };
    const sync = () => { const got = S.cards.includes(r); m.visible = !got && !card.hidden; glow.i = m.visible ? 2.5 : 0; };
    sync();
    anims.push(t => { if (m.visible) { m.rotation.y = t * 1.5; m.position.y = y + Math.sin(t * 2) * 0.08; } });
    interact({ x, y, z, r: 1.6, label: 'Take science card', button: 'Take', active: () => m.visible, run: async () => {
      state.collectCard(r); sync(); hooks.sfx('unlock');
      await hooks.openNote({ kicker: 'Science card ' + r + ' of 6 · +1 minute', title: title || 'Science card', html: '<div class="card">' + (html || '') + '</div>' });
    } });
    card.reveal = () => { card.hidden = false; sync(); };
    on('reset', sync);
    return card;
  }
  // Walls, floor, ceiling and a light for a side room beyond this room's side doorway (from `side` in the room file).
  function sideRoom({ depth = 6, lz0, lz1, wall = ['paper', '#3a2030', '#4a2a3a'], floor = ['wood', '#2e1e12', '#3a2616'], light = 0xffb070 } = {}) {
    const sd = EXTRAS[r].side, sx = sd.side;
    const xa = sx * 8.5, xb = sx * (8.5 + depth), xm = (xa + xb) / 2;
    const za = rz(r, lz0), zb = rz(r, lz1), zm = (za + zb) / 2, len = Math.abs(lz1 - lz0);
    const wm = (l, hh) => tmat(wall[0], wall[1], wall[2], l / 4, hh / 4);
    floorPlane(xm, zm, depth + 0.2, len + 0.2, tmat(floor[0], floor[1], floor[2], depth / 2.5, len / 2.5));
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(depth + 0.2, len + 0.2), tmat('wood', '#1f1410', '#2a1a12', 2, 2));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(xm, WALL_H, zm); G.add(ceil);
    box(xb + sx * 0.25, 0, zm, 0.5, WALL_H, len + 0.5, wm(len, WALL_H), { solid: true, cam: true });
    for (const zz of [za, zb]) box(xm, 0, zz + (zz === za ? 0.25 : -0.25), depth + 0.5, WALL_H, 0.5, wm(depth, WALL_H), { solid: true, cam: true });
    addSpot(r, xm, WALL_H - 1.2, zm, light, 5, 9, 0.3);
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: Math.min(za, zb), z1: Math.max(za, zb), xm, zm };
  }
  return {
    THREE, room: r, rz: lrz, WALL_H, HALF, DOOR_W,
    group: () => G,
    box, cyl, sph, plane, mat, tmat, basic, canvasTex, addSolid,
    flame, candle, candelabra, pumpkin, cobweb, portrait, bookshelf, armour, windowW,
    light: (x, y, z, color, i = 5, dist = 8, flick = 0.25) => addSpot(r, x, y, z, color, i, dist, flick),
    interact, onFrame, candy, dataCard, sideRoom,
    player: () => ({ x: P.x, y: P.y, z: P.z }),
    teleport: (x, y, z) => { P.x = x; P.y = y; P.z = z; P.vx = P.vz = P.vy = 0; cam.init = false; },
    shake: n => { shake = Math.max(shake, n); },
    sfx: n => hooks.sfx(n), toast: t => hooks.toast(t),
    note: o => hooks.openNote(o), ask: k => hooks.askQuestion(k), choose: o => hooks.choose(o),
    state, S: () => S, on,
  };
}
function buildExtras() {
  for (let r = 1; r <= 6; r++) {
    const ex = EXTRAS[r]; if (!ex || !ex.build) continue;
    G = roomGroups[r];
    try { ex.build(makeCtx(r)); } catch (err) { console.error('Room ' + r + ' extras failed', err); }
  }
  try { buildSecret(r => { G = roomGroups[r]; return makeCtx(r); }); } catch (err) { console.error('Secret failed', err); }
}

// ---------------------------------------------------------------- public API
export function initWorld(canvas, h) {
  hooks = Object.assign({ openLock: async () => false, openMinigame: async () => false, openNote: async () => {}, askQuestion: async () => false, choose: async () => -1, toast() {}, onEscape() {}, sfx() {}, ambience() {} }, h);
  canvasEl = canvas;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.55;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !COARSE; renderer.shadowMap.type = THREE.PCFShadowMap;
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(THEMES[0].fog, THEMES[0].d); scene.background = new THREE.Color(THEMES[0].fog);
  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  const resize = () => { const w = innerWidth, hh = innerHeight; renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.fov = w / hh < 0.8 ? 72 : 60; camera.updateProjectionMatrix(); };
  resize(); addEventListener('resize', resize);
  setupLights();
  room1(); room2(); room3(); room4(); room5(); room6(); outdoors();
  buildExtras();
  setupDust(); buildDom(); setupInput();
  document.fonts?.load('40px Creepster').then(() => document.fonts.ready).then(() => redraws.forEach(f => f())).catch(() => {});
  on('power', r => { setCabinetPower(r); });
  on('reset', () => {
    mode = 'menu'; busy = false; clearInput(); updateTouchVis();
    if (player) { scene.remove(player); player = null; }
    syncState(true); scare = null; curRoom = 1; shownRoom = -1; escapeT = -1; flyKeys.forEach(f => scene.remove(f.k)); flyKeys = [];
    pedestal.forEach(m => m.visible = true); showPreview(S.costume, S.color); hooks.ambience(0);
  });
  showPreview(S.costume, S.color);
  syncState(true);
  setVisibleRooms(1);
  frame();
}
function showPreview(costume, color) {
  const k = costume + color; if (preview && previewKey === k) return;
  if (preview) { const ry = preview.rotation.y; scene.remove(preview); preview = createCharacter({ costume, color }); preview.rotation.y = ry; }
  else preview = createCharacter({ costume, color });
  previewKey = k; preview.position.set(0, 0.6, rz(1, 8)); scene.add(preview);
  preview.traverse(o => { if (o.isMesh) o.castShadow = true; });
}
export function previewCharacter({ costume, color } = {}) {
  if (!scene) return;
  showPreview(costume || S.costume, color || S.color);
}
export function startGame() {
  if (!scene) return;
  if (player) scene.remove(player);
  player = createCharacter({ costume: S.costume, color: S.color });
  player.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(player);
  if (preview) { scene.remove(preview); preview = null; previewKey = ''; }
  pedestal.forEach(m => m.visible = false);
  camera.clearViewOffset();
  const r = clamp(S.room || 1, 1, 6), sp = spawnPoint(r);
  P.x = sp.x; P.z = sp.z; P.y = 0; P.vx = P.vz = P.vy = 0; P.face = Math.PI; P.grounded = true; P.air = 0;
  curRoom = r; shownRoom = -1; paused = false; busy = false; cooldown = 0.3; scare = null; scareDelay = -1;
  cam.yaw = 0; cam.pitch = 0.34; cam.init = false; clearInput();
  syncState(true);
  if (r === 5 && !S.scared) scareDelay = 1.5;
  mode = 'play'; updateTouchVis();
  hooks.ambience(r);
  if (r === 1) hooks.toast(COARSE ? 'Find a way out! Move with the left stick, drag to look, tap the buttons to jump and use things.' : 'Find a way out! Move with WASD, jump with Space, use things with E, drag to look.');
}
export function setPaused(v) {
  paused = !!v; clearInput(); updateTouchVis();
  if (paused && promptEl) promptEl.style.display = 'none';
}
// keep touch overlay in sync with busy/paused/mode changes
setInterval(() => { try { updateTouchVis(); } catch (e) {} }, 300);
