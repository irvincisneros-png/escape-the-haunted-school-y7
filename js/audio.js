// Procedural WebAudio for Escape the Haunted School.
// No audio files: every sound is built from oscillators, noise buffers,
// filters and envelopes. Public API (see CONTRACT.md):
//   initAudio(), sfx(name), ambience(roomIndex), setMuted(bool)
// Everything except initAudio() is a safe no-op before initAudio() runs.

let ctx = null;
let master = null;
let sfxBus = null;
let ambBus = null;
let noiseBuf = null;

let muted = false;
let wantAmbience = -1;   // last requested bed, played once the context exists
let currentIndex = -1;   // bed index currently playing (or fading in)
let bed = null;          // the bed that is playing

const MASTER_VOL = 0.6;
const FADE_S = 2;

const rnd = (a, b) => a + Math.random() * (b - a);
const now = () => ctx.currentTime;

// ---------- low-level helpers ----------

// Gain envelope: quick attack to `peak`, exponential decay to silence at t + dur.
function env(g, t, attack, peak, dur) {
  const a = Math.min(attack, dur * 0.9);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + Math.max(a, 0.001));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

// One-shot oscillator with envelope, optional lowpass/bandpass filter.
function tone({ type = 'sine', f, f2, t, dur, peak = 0.2, attack = 0.005,
                dest = sfxBus, lp, bp, q = 1, detune = 0 }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  if (detune) o.detune.value = detune;
  const g = ctx.createGain();
  env(g, t, attack, peak, dur);
  let last = o;
  if (lp || bp) {
    const flt = ctx.createBiquadFilter();
    flt.type = lp ? 'lowpass' : 'bandpass';
    flt.frequency.value = lp || bp;
    flt.Q.value = q;
    o.connect(flt);
    last = flt;
  }
  last.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// One-shot filtered noise with envelope (filter frequency can glide to f2).
function noise({ t, dur, peak = 0.2, type = 'bandpass', f = 1000, f2, q = 1,
                 attack = 0.01, dest = sfxBus }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const flt = ctx.createBiquadFilter();
  flt.type = type;
  flt.frequency.setValueAtTime(f, t);
  if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + dur);
  flt.Q.value = q;
  const g = ctx.createGain();
  env(g, t, attack, peak, dur);
  src.connect(flt);
  flt.connect(g);
  g.connect(dest);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}

// Creaky door or floorboard: pitch-bent sawtooth through a bandpass, plus filtered friction noise.
function creak(dest, t, dur, base, peak) {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(base, t);
  o.frequency.linearRampToValueAtTime(base * 1.5, t + dur * 0.5);
  o.frequency.linearRampToValueAtTime(base * 1.1, t + dur);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 380;
  bp.Q.value = 5;
  const g = ctx.createGain();
  env(g, t, dur * 0.3, peak, dur);
  o.connect(bp);
  bp.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
  noise({ t, dur, peak: peak * 0.6, f: 300, f2: 800, q: 6, attack: dur * 0.3, dest });
}

function makeNoise() {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// ---------- public API ----------

export function initAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER_VOL;
      // Gentle limiter so stacked sounds (like the scare) never clip.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      master.connect(comp);
      comp.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 1;
      sfxBus.connect(master);
      ambBus = ctx.createGain();
      ambBus.gain.value = 0.7;
      ambBus.connect(master);
      noiseBuf = makeNoise();
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (wantAmbience >= 0 && currentIndex !== wantAmbience) ambience(wantAmbience);
  } catch (e) {}
}

const SFX = {
  click: t => tone({ type: 'triangle', f: 1400, f2: 700, t, dur: 0.04, peak: 0.15 }),

  correct: t => {
    tone({ f: 880, t, dur: 0.22, peak: 0.2 });
    tone({ f: 1320, t: t + 0.1, dur: 0.4, peak: 0.22 });
    tone({ f: 2640, t: t + 0.1, dur: 0.25, peak: 0.04 });
  },

  wrong: t => {
    tone({ type: 'sawtooth', f: 120, f2: 80, t, dur: 0.4, peak: 0.18, lp: 350, q: 2 });
    tone({ type: 'square', f: 60, f2: 55, t, dur: 0.4, peak: 0.1, lp: 200 });
  },

  unlock: t => {
    noise({ type: 'lowpass', t, dur: 0.08, peak: 0.5, f: 700, attack: 0.002 });   // metal clunk
    tone({ f: 220, f2: 90, t, dur: 0.18, peak: 0.4 });
    tone({ f: 660, t: t + 0.16, dur: 0.3, peak: 0.2 });                            // chime
    tone({ f: 990, t: t + 0.24, dur: 0.45, peak: 0.2 });
  },

  door: t => {
    creak(sfxBus, t, 1.4, 85, 0.22);
    noise({ t, dur: 1.4, peak: 0.08, f: 300, f2: 700, q: 6, attack: 0.3 });
  },

  key: t => {
    [1047, 1319, 1568, 2093].forEach((f, i) => {
      tone({ f, t: t + i * 0.06, dur: 0.25, peak: 0.16 });
      tone({ type: 'triangle', f: f * 2, t: t + i * 0.06, dur: 0.15, peak: 0.04 });
    });
  },

  step: t => {
    tone({ f: rnd(90, 130), f2: 40, t, dur: 0.14, peak: 0.35, attack: 0.002 });
    noise({ type: 'lowpass', t, dur: 0.05, peak: 0.12, f: 400, attack: 0.002 });
  },

  jump: t => {
    tone({ f: 260, f2: 620, t, dur: 0.2, peak: 0.2 });
    noise({ t, dur: 0.12, peak: 0.08, f: 900, f2: 1800, q: 1 });
  },

  land: t => {
    tone({ f: 150, f2: 50, t, dur: 0.18, peak: 0.4 });
    noise({ type: 'lowpass', t, dur: 0.1, peak: 0.2, f: 300, attack: 0.002 });
  },

  flap: t => {
    noise({ t, dur: 0.25, peak: 0.35, f: 900, f2: 2400, q: 1.5, attack: 0.05 });
    noise({ t: t + 0.12, dur: 0.15, peak: 0.2, f: 700, f2: 1900, q: 1.5, attack: 0.03 });
  },

  launch: t => {
    tone({ type: 'sawtooth', f: 380, f2: 110, t, dur: 0.35, peak: 0.22, lp: 1800 });
    tone({ type: 'triangle', f: 300, f2: 180, t, dur: 0.5, peak: 0.18 });               // twang
    tone({ f: 110, f2: 60, t, dur: 0.3, peak: 0.2 });
  },

  hit: t => {
    tone({ f: 160, f2: 40, t, dur: 0.25, peak: 0.6 });
    noise({ type: 'lowpass', t, dur: 0.12, peak: 0.35, f: 350, attack: 0.002 });
  },

  whoosh: t => {
    noise({ t, dur: 0.6, peak: 0.3, f: 300, f2: 1800, q: 0.8, attack: 0.15 });
  },

  // Loud, dissonant sting (under one second). 220 Hz and 233 Hz clash on purpose.
  scare: t => {
    tone({ type: 'sawtooth', f: 220, f2: 180, t, dur: 0.7, peak: 0.35, lp: 1400 });
    tone({ type: 'sawtooth', f: 233, t, dur: 0.7, peak: 0.3, lp: 1400 });
    tone({ type: 'square', f: 311, t, dur: 0.5, peak: 0.15, lp: 1200 });
    noise({ t, dur: 0.35, peak: 0.5, f: 2000, f2: 600, q: 0.7, attack: 0.005 });
  },

  // Spooky-happy: rising triangle arpeggio, then a sustained chord with a eerie glide.
  win: t => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, t: t + i * 0.13, dur: 0.25, peak: 0.22 }));
    [523, 659, 784, 1047].forEach(f => tone({ f, t: t + 0.6, dur: 1.6, peak: 0.14, attack: 0.05 }));
    tone({ f: 880, f2: 1100, t: t + 0.6, dur: 1.6, peak: 0.08, attack: 0.3 });
  },

  // Descending minor notes that fall away.
  lose: t => {
    [392, 349, 311, 262].forEach((f, i) => tone({ type: 'sawtooth', f, t: t + i * 0.22, dur: 0.3, peak: 0.18, lp: 900 }));
    tone({ f: 130, t: t + 0.9, dur: 0.6, peak: 0.2 });
  },

  tick: t => tone({ type: 'square', f: 1800, t, dur: 0.02, peak: 0.05, lp: 2500 })
};

export function sfx(name) {
  if (!ctx || !SFX[name]) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    SFX[name](now() + 0.01);
  } catch (e) {}
}

// ---------- ambience beds ----------

// Random one-shot sounds that fire inside a bed. Each takes the bed's output node.
const EV = {
  creak: dest => creak(dest, now() + 0.02, rnd(1.2, 2), rnd(70, 110), 0.07),
  wind: dest => noise({ type: 'lowpass', t: now() + 0.02, dur: 3.5, peak: 0.1, f: 500, attack: 1.4, dest }),
  bell: dest => {
    const t = now() + 0.02;
    tone({ f: 660, t, dur: 3, peak: 0.04, attack: 0.01, dest });
    tone({ f: 990, t, dur: 2.2, peak: 0.02, attack: 0.01, dest });
    tone({ f: 1320, t, dur: 1.4, peak: 0.01, attack: 0.01, dest });
  },
  drip: dest => tone({ f: rnd(1400, 2100), f2: rnd(600, 800), t: now() + 0.02, dur: 0.2, peak: 0.07, dest }),
  owl: dest => {
    const t = now() + 0.02;
    tone({ f: 430, f2: 400, t, dur: 0.45, peak: 0.07, attack: 0.05, dest });
    tone({ f: 360, f2: 340, t: t + 0.6, dur: 0.6, peak: 0.06, attack: 0.05, dest });
  }
};

// Per-area settings. root/cut set pitch and filter, pool = random events, gap = seconds between them.
const ROOMS = {
  1: { root: 55,   cut: 320, pool: [EV.creak, EV.wind],          gap: [7, 14] },
  2: { root: 65.4, cut: 260, pool: [EV.creak, EV.bell],          gap: [8, 16] },
  3: { root: 73.4, cut: 420, pool: [EV.creak, EV.wind, EV.bell],  gap: [7, 15] },
  4: { root: 49,   cut: 380, pool: [EV.bell, EV.creak],          gap: [9, 18] },
  5: { root: 41.2, cut: 170, pool: [EV.drip, EV.drip, EV.creak],  gap: [2.5, 6] },   // darker, drips
  6: { root: 61.7, cut: 300, pool: [EV.bell, EV.creak],          gap: [9, 16], clock: true }
};

// Build a looping bed for area i. Returns { out, nodes, timer, interval, active }.
function buildBed(i, t0) {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(ambBus);
  const b = { out, nodes: [], timer: 0, interval: 0, active: true };
  const keep = n => { b.nodes.push(n); return n; };

  const oscNode = (type, freq, dest, peak) => {
    const o = keep(ctx.createOscillator());
    o.type = type;
    o.frequency.value = freq;
    const g = keep(ctx.createGain());
    g.gain.value = peak;
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    return { osc: o, gain: g };
  };
  // Slow LFO into any AudioParam (filter cutoff, gain, etc).
  const lfo = (freq, depth, param) => {
    const o = keep(ctx.createOscillator());
    o.frequency.value = freq;
    const g = keep(ctx.createGain());
    g.gain.value = depth;
    o.connect(g);
    g.connect(param);
    o.start(t0);
  };
  const noiseLoop = (type, freq, q, dest, peak) => {
    const s = keep(ctx.createBufferSource());
    s.buffer = noiseBuf;
    s.loop = true;
    const f = keep(ctx.createBiquadFilter());
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = keep(ctx.createGain());
    g.gain.value = peak;
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    s.start(t0, Math.random() * 2);
    return { filter: f, gain: g };
  };

  if (i === 0) {
    // Menu: soft eerie pad (A minor with a dissonant hint).
    const lp = keep(ctx.createBiquadFilter());
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.7;
    lp.connect(out);
    oscNode('triangle', 110, lp, 0.09).osc.detune.value = -6;
    oscNode('triangle', 165, lp, 0.06).osc.detune.value = 5;
    oscNode('sine', 220.6, lp, 0.05).osc.detune.value = 4;
    oscNode('sine', 277.2, lp, 0.02);
    lfo(0.09, 350, lp.frequency);
    schedule(b, [EV.bell], [12, 25]);
  } else if (i === 7) {
    // Outside: wind, crickets and the odd owl.
    const wind = noiseLoop('lowpass', 500, 0.7, out, 0.2);
    lfo(0.13, 250, wind.filter.frequency);
    lfo(0.07, 0.08, wind.gain.gain);
    const c1 = oscNode('sine', 4300, out, 0.012);
    lfo(9, 0.01, c1.gain.gain);
    const c2 = oscNode('sine', 5200, out, 0.01);
    lfo(13, 0.008, c2.gain.gain);
    schedule(b, [EV.owl, EV.wind], [12, 22]);
  } else if (ROOMS[i]) {
    // Rooms 1-6: low drone with its own pitch and filter, plus random creaks, wind, bells or drips.
    const r = ROOMS[i];
    const lp = keep(ctx.createBiquadFilter());
    lp.type = 'lowpass';
    lp.frequency.value = r.cut;
    lp.Q.value = 2;
    lp.connect(out);
    oscNode('sawtooth', r.root, lp, 0.07);
    oscNode('triangle', r.root * 1.5, lp, 0.045).osc.detune.value = 6;
    oscNode('sine', r.root * 2, lp, 0.025).osc.detune.value = -5;
    lfo(0.05, r.cut * 0.35, lp.frequency);
    schedule(b, r.pool, r.gap);
    if (r.clock) {
      // Clock tower: a steady tick, alternating pitch every second.
      let n = 0;
      b.interval = setInterval(() => {
        if (!b.active) return;
        tone({ type: 'square', f: n++ % 2 ? 1500 : 1800, t: now(), dur: 0.02, peak: 0.03, lp: 2500, dest: out });
      }, 1000);
    }
  }
  return b;
}

// Fire a random event from `pool` every gap[0]..gap[1] seconds while the bed is active.
function schedule(b, pool, gap) {
  const loop = () => {
    if (!b.active) return;
    try {
      pool[Math.floor(Math.random() * pool.length)](b.out);
    } catch (e) {}
    b.timer = setTimeout(loop, rnd(gap[0], gap[1]) * 1000);
  };
  b.timer = setTimeout(loop, rnd(gap[0], gap[1]) * 500);
}

// Stop a bed's timers and nodes after `delayS` seconds (once it has faded out).
function stopBed(b, delayS) {
  b.active = false;
  clearTimeout(b.timer);
  clearInterval(b.interval);
  setTimeout(() => {
    b.nodes.forEach(n => {
      try { if (n.stop) n.stop(); } catch (e) {}
      try { n.disconnect(); } catch (e) {}
    });
    try { b.out.disconnect(); } catch (e) {}
  }, delayS * 1000);
}

export function ambience(i) {
  wantAmbience = i;
  if (!ctx || i === currentIndex) return;
  try {
    currentIndex = i;
    const t = now();
    if (bed) {
      // Cross-fade: ramp the old bed down, then stop it.
      const old = bed;
      old.out.gain.cancelScheduledValues(t);
      old.out.gain.setValueAtTime(old.out.gain.value, t);
      old.out.gain.linearRampToValueAtTime(0, t + FADE_S);
      stopBed(old, FADE_S + 0.2);
    }
    bed = buildBed(i, t);
    bed.out.gain.setValueAtTime(0, t);
    bed.out.gain.linearRampToValueAtTime(1, t + FADE_S);
  } catch (e) {}
}

export function setMuted(m) {
  muted = !!m;
  if (!ctx) return;
  try {
    const t = now();
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, t, 0.05);
  } catch (e) {}
}
