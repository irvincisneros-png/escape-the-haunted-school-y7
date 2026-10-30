// characters.js: Roblox-style blocky Halloween avatars (no external assets).
// createCharacter({costume, color}) -> THREE.Group, ~1.8 tall, feet at y=0, facing +Z.
// group.userData.animate(dt, {speed 0..1, grounded}) drives idle / walk / jump poses.
import * as THREE from 'three';

export const COSTUMES = [
  { id: 'pumpkin',  name: 'Pumpkin Head', emoji: '🎃' },
  { id: 'skeleton', name: 'Skeleton',     emoji: '💀' },
  { id: 'witch',    name: 'Witch',        emoji: '🧙' },
  { id: 'vampire',  name: 'Vampire',      emoji: '🧛' },
  { id: 'mummy',    name: 'Mummy',        emoji: '🧻' },
  { id: 'ghost',    name: 'Ghost',        emoji: '👻' },
];

export const COLORS = ['#ff7a1a', '#7dff6a', '#b86bff', '#ff4d6d', '#35d0ff', '#ffd84a'];

/* ---------- small helpers ---------- */
const GEO = new Map();
function box(w, h, d) {
  const k = w + ',' + h + ',' + d;
  if (!GEO.has(k)) GEO.set(k, new THREE.BoxGeometry(w, h, d));
  return GEO.get(k);
}
function cyl(rt, rb, h, seg) {
  const k = 'c' + rt + ',' + rb + ',' + h + ',' + seg;
  if (!GEO.has(k)) GEO.set(k, new THREE.CylinderGeometry(rt, rb, h, seg));
  return GEO.get(k);
}
function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
}
function add(parent, geo, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
const TEX = new Map();
function tex(key, w, h, draw) {
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  TEX.set(key, t);
  return t;
}
function tmat(t, o = {}) { return mat(0xffffff, { map: t, ...o }); }
// pivot group at (x,y); mesh hangs down from it so rotation swings the limb
function limb(parent, w, h, d, m, x, y) {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  add(g, box(w, h, d), m, 0, -h / 2, 0);
  parent.add(g);
  return g;
}
// box with a different material on the +Z (front) face
function frontMats(side, front) { return [side, side, side, side, front, side]; }
function glow(parent, color, intensity, dist, x, y, z) {
  const l = new THREE.PointLight(color, intensity, dist, 2);
  l.position.set(x, y, z);
  parent.add(l);
  return l;
}

/* ---------- shared rig: torso, head, arms, legs ---------- */
const D = { legH: 0.7, torsoH: 0.65, torsoY: 1.025, shoulderY: 1.33, headY: 1.58 };

function makeRig() {
  const root = new THREE.Group();
  const body = new THREE.Group();   // bobs/leans
  root.add(body);
  const torsoPivot = new THREE.Group();
  body.add(torsoPivot);
  return { root, body, torsoPivot, extras: {} };
}

/* ---------- face drawing ---------- */
function eyeRect(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }

function pumpkinFace(glowPass) {
  return tex('pumpkinFace' + glowPass, 128, 128, (c, w, h) => {
    if (!glowPass) {
      c.fillStyle = '#e8670d'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#c4510a';
      for (let x = 10; x < w; x += 26) c.fillRect(x, 0, 5, h);
      c.fillStyle = '#1a0a02';
    } else {
      c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffd34a';
    }
    c.beginPath(); c.moveTo(22, 52); c.lineTo(52, 52); c.lineTo(37, 24); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(76, 52); c.lineTo(106, 52); c.lineTo(91, 24); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(60, 66); c.lineTo(68, 66); c.lineTo(64, 58); c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(20, 80); c.lineTo(36, 74); c.lineTo(46, 90); c.lineTo(56, 76); c.lineTo(64, 92);
    c.lineTo(72, 76); c.lineTo(82, 90); c.lineTo(92, 74); c.lineTo(108, 80);
    c.lineTo(100, 104); c.lineTo(28, 104); c.closePath(); c.fill();
  });
}

function skullFace() {
  return tex('skullFace', 128, 128, (c, w, h) => {
    c.fillStyle = '#efe6cf'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#d6cbb0'; c.fillRect(0, 0, w, 6); c.fillRect(0, 0, 6, h); c.fillRect(w - 6, 0, 6, h);
    c.fillStyle = '#16101c';
    c.beginPath(); c.arc(40, 52, 19, 0, 7); c.fill();
    c.beginPath(); c.arc(88, 52, 19, 0, 7); c.fill();
    c.beginPath(); c.moveTo(64, 70); c.lineTo(55, 88); c.lineTo(73, 88); c.closePath(); c.fill();
    c.fillRect(34, 100, 60, 4);
    for (let x = 38; x < 94; x += 10) c.fillRect(x, 98, 3, 22);
    c.fillStyle = '#efe6cf'; c.fillRect(34, 104, 60, 0);
  });
}
function ribsTex() {
  return tex('ribs', 64, 64, (c, w, h) => {
    c.fillStyle = '#231a2c'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#efe6cf'; c.fillRect(30, 0, 4, h);
    for (let y = 8; y < h - 4; y += 11) {
      c.fillRect(8, y, 20, 5); c.fillRect(36, y, 20, 5);
      c.fillRect(6, y + 3, 4, 5); c.fillRect(54, y + 3, 4, 5);
    }
  });
}
function boneLimbTex() {
  return tex('boneLimb', 32, 64, (c, w, h) => {
    c.fillStyle = '#efe6cf'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#b9ad90'; c.fillRect(0, 30, w, 4); c.fillRect(0, 0, w, 3);
    c.fillStyle = '#d6cbb0'; c.fillRect(w - 6, 0, 6, h);
  });
}

function witchFace() {
  return tex('witchFace', 128, 128, (c, w, h) => {
    c.fillStyle = '#7fbf5a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#6aa84a'; c.fillRect(0, 0, w, 10);
    c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(38, 54, 15, 0, 7); c.arc(90, 54, 15, 0, 7); c.fill();
    c.fillStyle = '#1a0f24'; c.beginPath(); c.arc(41, 56, 8, 0, 7); c.arc(87, 56, 8, 0, 7); c.fill();
    c.strokeStyle = '#1a0f24'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(22, 34); c.lineTo(56, 42); c.moveTo(106, 34); c.lineTo(72, 42); c.stroke();
    c.lineWidth = 5; c.beginPath(); c.arc(64, 90, 22, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.fillStyle = '#4a7f33'; c.beginPath(); c.arc(90, 82, 4, 0, 7); c.fill();
  });
}

function vampFace() {
  return tex('vampFace', 128, 128, (c, w, h) => {
    c.fillStyle = '#e9e4ee'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#d4cadb'; c.fillRect(0, 100, w, 28);
    c.fillStyle = '#ff2d4a'; c.beginPath(); c.arc(40, 58, 12, 0, 7); c.arc(88, 58, 12, 0, 7); c.fill();
    c.fillStyle = '#16101c'; c.fillRect(37, 48, 6, 20); c.fillRect(85, 48, 6, 20);
    c.strokeStyle = '#16101c'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(20, 36); c.lineTo(56, 46); c.moveTo(108, 36); c.lineTo(72, 46); c.stroke();
    c.fillStyle = '#8a1a33'; c.fillRect(38, 88, 52, 8);
    c.fillStyle = '#fff'; c.beginPath();
    c.moveTo(44, 94); c.lineTo(54, 94); c.lineTo(49, 110); c.closePath();
    c.moveTo(74, 94); c.lineTo(84, 94); c.lineTo(79, 110); c.closePath(); c.fill();
  });
}
function vampTorso(accent) {
  return tex('vampTorso' + accent, 64, 64, (c, w, h) => {
    c.fillStyle = '#17121f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f1ecf5'; c.beginPath(); c.moveTo(20, 0); c.lineTo(44, 0); c.lineTo(32, 46); c.closePath(); c.fill();
    c.fillStyle = accent; c.beginPath(); c.moveTo(32, 6); c.lineTo(44, 2); c.lineTo(44, 14); c.lineTo(32, 10); c.lineTo(20, 14); c.lineTo(20, 2); c.closePath(); c.fill();
    c.fillStyle = '#fff'; for (let y = 24; y < 56; y += 10) { c.beginPath(); c.arc(32, y, 2, 0, 7); c.fill(); }
  });
}

function bandageTex(key, lit) {
  return tex(key, 64, 64, (c, w, h) => {
    c.fillStyle = '#2a2228'; c.fillRect(0, 0, w, h);
    let y = 0, i = 0;
    while (y < h) {
      const th = 7 + ((i * 5) % 6);
      const sk = ((i * 7) % 9) - 4;
      c.fillStyle = i % 2 ? '#e9dfc4' : '#d8cdaf';
      c.beginPath(); c.moveTo(0, y + sk); c.lineTo(w, y - sk); c.lineTo(w, y - sk + th - 1.5); c.lineTo(0, y + sk + th - 1.5); c.fill();
      y += th; i++;
    }
    if (lit) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 0, w, h); }
  });
}
function mummyFace(accent) {
  return tex('mummyFace' + accent, 128, 128, (c, w, h) => {
    c.fillStyle = '#d8cdaf'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 17) {
      c.fillStyle = (y / 17) % 2 ? '#e9dfc4' : '#d1c5a5';
      c.fillRect(0, y, w, 15);
    }
    c.fillStyle = '#1b141c'; c.fillRect(0, 40, w, 36);     // gap in the wraps
    c.fillStyle = accent; c.beginPath(); c.arc(40, 58, 13, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(40, 58, 5, 0, 7); c.fill();
    c.fillStyle = '#4a3f45'; c.fillRect(78, 55, 26, 7);    // closed, sleepy eye
    c.fillStyle = '#e9dfc4'; c.fillRect(0, 96, 60, 10);
  });
}

function ghostFront() {
  return tex('ghostFront', 128, 192, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d4dcff');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#120d1e';
    c.beginPath(); c.ellipse(40, 62, 13, 20, 0, 0, 7); c.ellipse(88, 62, 13, 20, 0, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(44, 54, 4, 0, 7); c.arc(92, 54, 4, 0, 7); c.fill();
    c.fillStyle = '#120d1e'; c.beginPath(); c.ellipse(64, 106, 10, 14, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,130,170,.55)'; c.beginPath(); c.ellipse(22, 90, 10, 6, 0, 0, 7); c.ellipse(106, 90, 10, 6, 0, 0, 7); c.fill();
  });
}

/* ---------- costume builders ---------- */
// Each returns { ...parts, sway: fn(t, walk) , armBase, hover }
function standardBody(rig, o) {
  const { torsoPivot } = rig;
  const tw = o.torsoW || 0.72, td = o.torsoD || 0.38;
  const torso = add(torsoPivot, box(tw, D.torsoH, td), o.torsoMat, 0, D.torsoY, 0);
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.35, 0);
  torsoPivot.add(headGroup);
  const aw = o.armW || 0.22, ax = tw / 2 + aw / 2 + 0.01;
  const armL = limb(torsoPivot, aw, 0.66, aw, o.armMat, -ax, D.shoulderY);
  const armR = limb(torsoPivot, aw, 0.66, aw, o.armMat, ax, D.shoulderY);
  const lw = o.legW || 0.3;
  const legL = limb(rig.body, lw, D.legH, lw, o.legMat, -lw / 2 - 0.02, D.legH);
  const legR = limb(rig.body, lw, D.legH, lw, o.legMat, lw / 2 + 0.02, D.legH);
  // shoes
  if (o.shoeMat) {
    add(legL, box(lw + 0.02, 0.12, lw + 0.12), o.shoeMat, 0, -D.legH + 0.06, 0.05);
    add(legR, box(lw + 0.02, 0.12, lw + 0.12), o.shoeMat, 0, -D.legH + 0.06, 0.05);
  }
  return { torso, headGroup, armL, armR, legL, legR };
}

function buildPumpkin(rig, color) {
  const shirt = mat(color, { roughness: 0.7 });
  const dark = mat(0x2a1a2e);
  const p = standardBody(rig, { torsoMat: shirt, armMat: shirt, legMat: dark, shoeMat: mat(0x1a1020) });
  // sleeves end in skin-tone-less dark gloves
  add(p.armL, box(0.24, 0.16, 0.24), dark, 0, -0.58, 0);
  add(p.armR, box(0.24, 0.16, 0.24), dark, 0, -0.58, 0);
  const orange = mat(0xe8670d, { roughness: 0.55 });
  const faceMat = mat(0xffffff, { map: pumpkinFace(0), emissive: 0xffffff, emissiveMap: pumpkinFace(1), emissiveIntensity: 1.1, roughness: 0.55 });
  const head = add(p.headGroup, box(0.54, 0.5, 0.5), frontMats(orange, faceMat), 0, 0.23, 0);
  add(p.headGroup, box(0.2, 0.46, 0.46), orange, -0.33, 0.23, 0);
  add(p.headGroup, box(0.2, 0.46, 0.46), orange, 0.33, 0.23, 0);
  const stem = new THREE.Group(); stem.position.set(0, 0.48, 0); p.headGroup.add(stem);
  add(stem, box(0.1, 0.16, 0.1), mat(0x4b7a2a), 0, 0.06, 0);
  add(stem, box(0.1, 0.08, 0.1), mat(0x4b7a2a), 0.06, 0.15, 0).rotation.z = -0.5;
  add(p.headGroup, box(0.2, 0.04, 0.12), mat(0x3a6a22), 0.14, 0.5, 0.1).rotation.z = 0.5;
  glow(p.headGroup, 0xff9a2a, 0.9, 4, 0, 0.23, 0.1);
  p.sway = (t, w) => { stem.rotation.z = Math.sin(t * 3) * 0.08 * (0.3 + w); stem.rotation.x = Math.sin(t * 2.1) * 0.05; };
  return p;
}

function buildSkeleton(rig, color) {
  const bone = mat(0xefe6cf, { roughness: 0.7 });
  const limbM = tmat(boneLimbTex(), { roughness: 0.7 });
  const torsoM = mat(0xffffff, { map: ribsTex() });
  const p = standardBody(rig, {
    torsoMat: frontMats(mat(0x231a2c), torsoM).map((m, i) => (i === 4 || i === 5 ? torsoM : m)),
    armMat: limbM, legMat: limbM, armW: 0.17, legW: 0.19, torsoW: 0.66, shoeMat: mat(0xd6cbb0),
  });
  // spine highlight + pelvis
  add(rig.body, box(0.58, 0.12, 0.3), bone, 0, 0.72, 0);
  const skullMat = tmat(skullFace(), { roughness: 0.7 });
  add(p.headGroup, box(0.48, 0.46, 0.46), frontMats(bone, skullMat), 0, 0.23, 0);
  add(p.headGroup, box(0.34, 0.1, 0.3), bone, 0, -0.04, 0);   // jaw/neck
  // glowing pupils in eye sockets
  const pup = mat(color, { emissive: color, emissiveIntensity: 1.6 });
  add(p.headGroup, box(0.05, 0.05, 0.02), pup, -0.115, 0.27, 0.236);
  add(p.headGroup, box(0.05, 0.05, 0.02), pup, 0.115, 0.27, 0.236);
  // scarf in accent colour
  const scarf = mat(color, { roughness: 0.9 });
  add(p.torso, box(0.52, 0.12, 0.34), scarf, 0, 0.3, 0.02);
  const tail = new THREE.Group(); tail.position.set(0.14, 0.3, 0.2); p.torso.add(tail);
  add(tail, box(0.12, 0.4, 0.04), scarf, 0, -0.2, 0);
  p.sway = (t, w) => { tail.rotation.x = 0.1 + w * 0.5 + Math.sin(t * 4) * 0.06; };
  return p;
}

function buildWitch(rig, color) {
  const robe = mat(0x3a2160, { roughness: 0.85 });
  const trim = mat(color, { roughness: 0.6 });
  const p = standardBody(rig, { torsoMat: robe, armMat: robe, legMat: mat(0x1a1022), shoeMat: mat(0x120a18) });
  add(p.torso, box(0.74, 0.1, 0.4), trim, 0, -0.18, 0);           // belt
  add(p.armL, box(0.24, 0.1, 0.24), trim, 0, -0.55, 0);
  add(p.armR, box(0.24, 0.1, 0.24), trim, 0, -0.55, 0);
  const skirt = new THREE.Group(); skirt.position.set(0, 0.74, 0); rig.body.add(skirt);
  add(skirt, box(0.82, 0.3, 0.56), robe, 0, 0, 0);
  add(skirt, box(0.86, 0.06, 0.6), trim, 0, -0.17, 0);
  const faceM = tmat(witchFace(), { roughness: 0.8 });
  const skin = mat(0x7fbf5a);
  add(p.headGroup, box(0.46, 0.46, 0.46), frontMats(skin, faceM), 0, 0.23, 0);
  add(p.headGroup, box(0.1, 0.12, 0.14), skin, 0, 0.2, 0.28);     // nose
  const hair = mat(0x14091c);
  add(p.headGroup, box(0.5, 0.2, 0.1), hair, 0, 0.36, -0.2);
  add(p.headGroup, box(0.08, 0.34, 0.1), hair, -0.25, 0.14, -0.1);
  add(p.headGroup, box(0.08, 0.34, 0.1), hair, 0.25, 0.14, -0.1);
  // hat
  const hat = new THREE.Group(); hat.position.set(0, 0.44, 0); p.headGroup.add(hat);
  const hatM = mat(0x1e1030, { roughness: 0.9 });
  add(hat, box(0.9, 0.05, 0.9), hatM, 0, 0, 0);
  add(hat, box(0.5, 0.3, 0.5), hatM, 0, 0.17, 0);
  add(hat, box(0.52, 0.07, 0.52), trim, 0, 0.1, 0);               // band
  const mid = new THREE.Group(); mid.position.set(0, 0.32, 0); hat.add(mid);
  add(mid, box(0.34, 0.28, 0.34), hatM, 0, 0.12, 0);
  const tip = new THREE.Group(); tip.position.set(0, 0.26, 0); mid.add(tip);
  add(tip, box(0.2, 0.26, 0.2), hatM, 0, 0.12, 0);
  const tip2 = new THREE.Group(); tip2.position.set(0, 0.24, 0); tip.add(tip2);
  add(tip2, box(0.1, 0.2, 0.1), hatM, 0, 0.09, 0);
  mid.rotation.z = -0.12; tip.rotation.z = -0.3; tip2.rotation.z = -0.5; mid.rotation.x = 0.05;
  // broom on back
  const broom = new THREE.Group(); broom.position.set(0.12, 1.0, -0.3); broom.rotation.set(0.25, 0, -0.5); p.torso.parent.add(broom);
  add(broom, box(0.06, 1.5, 0.06), mat(0x7a4a22), 0, 0, 0);
  add(broom, box(0.24, 0.34, 0.24), mat(0xc9a24a), 0, -0.85, 0);
  add(broom, box(0.26, 0.05, 0.26), trim, 0, -0.68, 0);
  p.sway = (t, w) => {
    hat.rotation.z = Math.sin(t * 2.2) * 0.03 + w * Math.sin(t * 9) * 0.03;
    tip.rotation.z = -0.3 + Math.sin(t * 3) * 0.08;
    tip2.rotation.z = -0.5 + Math.sin(t * 3.7) * 0.1;
    skirt.rotation.x = w * 0.08;
  };
  return p;
}

function buildVampire(rig, color) {
  const black = mat(0x17121f, { roughness: 0.75 });
  const p = standardBody(rig, {
    torsoMat: frontMats(black, tmat(vampTorso(color))), armMat: black, legMat: mat(0x241a30), shoeMat: mat(0x0c0810),
  });
  const pale = mat(0xe9e4ee);
  add(p.armL, box(0.24, 0.12, 0.24), pale, 0, -0.57, 0);       // cuffs / pale hands
  add(p.armR, box(0.24, 0.12, 0.24), pale, 0, -0.57, 0);
  add(p.headGroup, box(0.46, 0.46, 0.46), frontMats(pale, tmat(vampFace())), 0, 0.23, 0);
  const hair = mat(0x0c0810, { roughness: 0.5 });
  add(p.headGroup, box(0.5, 0.1, 0.5), hair, 0, 0.5, -0.02);
  add(p.headGroup, box(0.5, 0.4, 0.1), hair, 0, 0.26, -0.22);
  add(p.headGroup, box(0.1, 0.2, 0.4), hair, -0.24, 0.38, 0);
  add(p.headGroup, box(0.1, 0.2, 0.4), hair, 0.24, 0.38, 0);
  const peak = add(p.headGroup, box(0.1, 0.12, 0.1), hair, 0, 0.5, 0.25);   // widow's peak
  peak.rotation.x = 0.5;
  // tall collar
  const lining = mat(color, { roughness: 0.55 });
  add(p.torso, box(0.1, 0.34, 0.3), frontMats(black, black).map((m, i) => (i === 0 ? lining : m)), -0.3, 0.42, -0.04);
  add(p.torso, box(0.1, 0.34, 0.3), black, 0.3, 0.42, -0.04);
  add(p.torso, box(0.7, 0.34, 0.08), black, 0, 0.42, -0.18);
  // cape
  const cape = new THREE.Group(); cape.position.set(0, 0.3, -0.22); p.torso.add(cape);
  const out = mat(0x17121f, { side: THREE.DoubleSide });
  const inn = mat(color, { roughness: 0.6 });
  add(cape, box(0.86, 1.05, 0.05), [out, out, out, out, inn, out], 0, -0.5, -0.02);
  add(cape, box(0.9, 0.08, 0.1), black, 0, 0.0, 0);
  p.sway = (t, w) => { cape.rotation.x = 0.08 + w * 0.38 + Math.sin(t * 2.4) * 0.05 + Math.abs(Math.sin(t * 7)) * w * 0.1; };
  return p;
}

function buildMummy(rig, color) {
  const wrap = tmat(bandageTex('wrapA'), { roughness: 0.95 });
  const wrapDark = tmat(bandageTex('wrapB', true), { roughness: 0.95 });
  const p = standardBody(rig, { torsoMat: wrap, armMat: wrapDark, legMat: wrapDark, shoeMat: wrap, torsoW: 0.7, armW: 0.23, legW: 0.3 });
  const faceM = tmat(mummyFace(color), { roughness: 0.9, emissive: 0xffffff, emissiveMap: tex('mummyGlow' + color, 128, 128, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    c.fillStyle = color; c.beginPath(); c.arc(40, 58, 13, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(40, 58, 6, 0, 7); c.fill();
  }), emissiveIntensity: 1.3 });
  add(p.headGroup, box(0.48, 0.46, 0.46), frontMats(wrap, faceM), 0, 0.23, 0);
  add(p.headGroup, box(0.5, 0.1, 0.48), wrapDark, 0, 0.44, 0);
  // accent: glowing sash around the waist + loose bandage ends
  const sash = mat(color, { emissive: color, emissiveIntensity: 0.55, roughness: 0.7 });
  add(p.torso, box(0.74, 0.1, 0.42), sash, 0, -0.1, 0);
  add(p.torso, box(0.1, 0.46, 0.4), sash, 0.1, 0.05, 0).rotation.z = 0.7;
  const dang = new THREE.Group(); dang.position.set(-0.3, 0.2, 0.2); p.torso.add(dang);
  add(dang, box(0.08, 0.4, 0.03), wrap, 0, -0.2, 0);
  const dang2 = new THREE.Group(); dang2.position.set(0.1, 0.5, -0.2); p.headGroup.add(dang2);
  add(dang2, box(0.07, 0.3, 0.03), wrap, 0, -0.15, 0);
  glow(p.headGroup, new THREE.Color(color), 0.5, 3, -0.1, 0.25, 0.3);
  p.armBase = -0.35;
  p.sway = (t, w) => { dang.rotation.x = Math.sin(t * 3) * 0.1 + w * 0.5; dang2.rotation.x = 0.3 + Math.sin(t * 2.5) * 0.15 + w * 0.5; };
  return p;
}

function buildGhost(rig, color) {
  const sheet = mat(0xf2f5ff, { roughness: 0.6, emissive: 0x8fa0ff, emissiveIntensity: 0.25, transparent: true, opacity: 0.93 });
  const front = mat(0xffffff, { map: ghostFront(), roughness: 0.6, emissive: 0x8fa0ff, emissiveIntensity: 0.22, transparent: true, opacity: 0.95 });
  const g = rig.torsoPivot; // everything hangs from the body group; no legs
  const H = 1.2, base = 0.55;
  add(g, box(0.82, H, 0.6), frontMats(sheet, front), 0, base + H / 2, 0);
  add(g, box(0.56, 0.1, 0.46), sheet, 0, base + H + 0.05, 0);
  // tattered hem
  const hem = [];
  const xs = [-0.31, -0.1, 0.1, 0.31];
  xs.forEach((x, i) => {
    const h = 0.16 + (i % 2) * 0.1;
    const piece = new THREE.Group(); piece.position.set(x, base, 0); g.add(piece);
    add(piece, box(0.2, h, 0.58), sheet, 0, -h / 2 + 0.02, 0);
    hem.push(piece);
  });
  // stubby arms
  const armL = limb(g, 0.16, 0.5, 0.16, sheet, -0.5, 1.45);
  const armR = limb(g, 0.16, 0.5, 0.16, sheet, 0.5, 1.45);
  // aura shell + coloured sash/glow
  const aura = mat(color, { transparent: true, opacity: 0.1, side: THREE.BackSide, depthWrite: false });
  const shell = add(g, box(0.98, H + 0.18, 0.76), aura, 0, base + H / 2 + 0.04, 0);
  shell.castShadow = false;
  const ring = mat(color, { emissive: color, emissiveIntensity: 0.9 });
  add(g, box(0.86, 0.06, 0.64), ring, 0, base + 0.02, 0);
  glow(g, new THREE.Color(color), 0.35, 3.5, 0, 0.7, -0.3);
  return {
    armL, armR, legL: null, legR: null, ghost: true, hem,
    sway: (t) => { hem.forEach((h, i) => { h.scale.y = 1 + Math.sin(t * 5 + i * 1.7) * 0.25; }); },
  };
}

const BUILDERS = { pumpkin: buildPumpkin, skeleton: buildSkeleton, witch: buildWitch, vampire: buildVampire, mummy: buildMummy, ghost: buildGhost };

/* ---------- public ---------- */
export function createCharacter({ costume = 'pumpkin', color = COLORS[0] } = {}) {
  const id = BUILDERS[costume] ? costume : 'pumpkin';
  const rig = makeRig();
  const parts = BUILDERS[id](rig, color);
  const { root, body, torsoPivot } = rig;
  const { armL, armR, legL, legR } = parts;
  const armBase = parts.armBase || 0;
  const ghost = !!parts.ghost;
  let t = Math.random() * 10, phase = 0, walk = 0, air = 0, lastSpeed = 0;

  root.userData.animate = (dt, st = {}) => {
    dt = Math.min(dt || 0, 0.1);
    t += dt;
    const speed = Math.max(0, Math.min(1, st.speed || 0));
    const grounded = st.grounded !== false;
    const k = 1 - Math.exp(-dt * 12);
    walk += (speed - walk) * k;
    air += ((grounded ? 0 : 1) - air) * k;
    phase += dt * (5 + walk * 6);
    const w = walk * (1 - air);
    const swing = Math.sin(phase);
    const breathe = Math.sin(t * 2.2);

    if (ghost) {
      body.position.y = 0.14 + Math.sin(t * 2) * 0.07 + air * 0.12;
      torsoPivot.rotation.x = w * 0.22 + air * -0.1;
      torsoPivot.rotation.z = Math.sin(t * 1.3) * 0.04 + w * Math.sin(phase * 0.5) * 0.05;
      const flap = Math.sin(t * 2.6) * 0.18;
      armL.rotation.set(-0.15 - air * 2.4 - w * 0.5, 0, 0.35 + flap + air * 0.3);
      armR.rotation.set(-0.15 - air * 2.4 - w * 0.5, 0, -0.35 - flap - air * 0.3);
      parts.sway(t, w);
      return;
    }

    body.position.y = Math.abs(swing) * 0.05 * w + breathe * 0.006;
    torsoPivot.rotation.x = w * 0.08 - air * 0.05;
    torsoPivot.rotation.y = swing * 0.12 * w;
    torsoPivot.scale.y = 1 + breathe * 0.012 * (1 - w);

    const idleArm = breathe * 0.04;
    armL.rotation.x = armBase + (-swing * 0.95) * w + idleArm;
    armR.rotation.x = armBase + (swing * 0.95) * w - idleArm;
    armL.rotation.z = 0.04 + breathe * 0.015;
    armR.rotation.z = -0.04 - breathe * 0.015;
    legL.rotation.x = swing * 0.9 * w;
    legR.rotation.x = -swing * 0.9 * w;

    if (air > 0.001) {
      armL.rotation.x += (-2.5 - armL.rotation.x) * air;
      armR.rotation.x += (-2.5 - armR.rotation.x) * air;
      armL.rotation.z += (0.8 - armL.rotation.z) * air;
      armR.rotation.z += (-0.8 - armR.rotation.z) * air;
      legL.rotation.x += (-0.9 - legL.rotation.x) * air;
      legR.rotation.x += (0.35 - legR.rotation.x) * air;
    }
    parts.sway(t, w);
  };
  root.userData.animate(0, { speed: 0, grounded: true });
  root.userData.costume = id;
  root.name = 'character-' + id;
  return root;
}
