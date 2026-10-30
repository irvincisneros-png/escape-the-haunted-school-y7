// All DOM screens: start, HUD, lock modals, mini-game overlay, toasts, time-up, win.
import { S, startRun, timeLeft, fmt, useHint, markLock, lockDone, victoryCode, resetAll, on, HINT_COST } from './state.js';
// Room interactions (notes, quick questions, choices) live in openNote/askQuestion/choose below.
import { LOCKS, MINI_QUESTIONS } from './questions.js';
import { sfx, setMuted } from './audio.js';
import { COSTUMES, COLORS } from './characters.js';

let root, hooks = {};
let hudEl, toastsEl, startEl, timeupEl;
let hud = {};
let pauseCount = 0;
const modals = [];
let muted = false;

/* ---------- helpers ---------- */
const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const click = () => { try { sfx('click'); } catch (e) {} };
const play = n => { try { sfx(n); } catch (e) {} };

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const k in (attrs || {})) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const btn = (label, cls, fn, attrs) => h('button', Object.assign({ type: 'button', class: 'ui-btn ' + (cls || ''), onclick: e => { click(); fn && fn(e); } }, attrs), label);

function setPause(on_) {
  const was = pauseCount > 0;
  pauseCount = Math.max(0, pauseCount + (on_ ? 1 : -1));
  const now = pauseCount > 0;
  if (was !== now) { try { hooks.setPaused && hooks.setPaused(now); } catch (e) {} }
}

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,a[href],[tabindex]:not([tabindex="-1"])';

// Generic modal with focus trap. opts: {cls, label, onClose, noEsc, passKeys}
function openModal(content, opts = {}) {
  const back = h('div', { class: 'ui-backdrop ' + (opts.back || '') });
  const box = h('div', { class: 'ui-modal ' + (opts.cls || ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.label || 'Dialog' }, content);
  back.append(box);
  if (!opts.passKeys) {
    for (const t of ['keydown', 'keyup']) back.addEventListener(t, e => { if (e.key !== 'Tab' && e.key !== 'Escape') e.stopPropagation(); });
  }
  const m = { el: back, box, opts, prev: document.activeElement, closed: false };
  m.close = () => {
    if (m.closed) return;
    m.closed = true;
    const i = modals.indexOf(m);
    if (i >= 0) modals.splice(i, 1);
    back.classList.add('out');
    setTimeout(() => back.remove(), 160);
    try { m.prev && m.prev.focus && m.prev.isConnected && m.prev.focus({ preventScroll: true }); } catch (e) {}
    opts.onClose && opts.onClose();
  };
  modals.push(m);
  root.append(back);
  setTimeout(() => {
    const f = opts.focus ? box.querySelector(opts.focus) : box.querySelector('input,select,.ui-primary,' + FOCUSABLE);
    (f || box).focus({ preventScroll: true });
  }, 30);
  return m;
}

addEventListener('keydown', e => {
  const top = modals[modals.length - 1];
  if (!top) return;
  if (e.key === 'Escape') {
    if (!top.opts.noEsc) { e.preventDefault(); e.stopPropagation(); top.opts.onEsc ? top.opts.onEsc() : top.close(); }
  } else if (e.key === 'Tab') {
    const f = [...top.box.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null || x === document.activeElement);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1];
    if (!top.box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}, true);

/* ---------- init ---------- */
export function initUI(h_) {
  hooks = h_ || {};
  root = document.getElementById('ui');
  try { muted = localStorage.getItem('haunted-muted') === '1'; } catch (e) {}
  try { setMuted(muted); } catch (e) {}
  buildHud();
  toastsEl = h('div', { class: 'ui-toasts', 'aria-live': 'polite' });
  root.append(toastsEl);
  on('timeup', showTimeUp);
  on('hint', updateHud);
  on('lock', updateHud);
  on('key', updateHud);
  for (const ev of ['candy', 'card', 'items']) on(ev, updateHud);
  on('start', updateHud);
  on('reset', () => { hudEl.hidden = true; });
  setInterval(updateHud, 250);
  showStart();
}

/* ---------- toast ---------- */
export function toast(text) {
  if (!toastsEl) return;
  const t = h('div', { class: 'ui-toast', role: 'status' }, text);
  toastsEl.append(t);
  while (toastsEl.children.length > 4) toastsEl.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3000);
}

/* ---------- HUD ---------- */
function buildHud() {
  hud.time = h('span', { class: 'hud-time' }, '00:00');
  hud.room = h('span', { class: 'hud-room' }, 'Room 1 / 6');
  hud.hints = h('span', { class: 'hud-hints', title: 'Hints used' }, '');
  hud.keys = [2, 3, 4, 5].map(n => h('span', { class: 'hud-key', title: 'Key for room ' + n, 'aria-label': 'Key ' + n }, h('i', {}, '🔑'), h('b', {}, n)));
  hud.candy = h('span', { class: 'hud-candy' }, '0');
  hud.cards = h('span', { class: 'hud-cards' }, '0/6');
  hud.items = h('span', { class: 'hud-items' }, '');
  hud.mute = h('button', { type: 'button', class: 'hud-btn', 'aria-label': 'Toggle sound', onclick: () => { muted = !muted; try { setMuted(muted); localStorage.setItem('haunted-muted', muted ? '1' : '0'); } catch (e) {} click(); updateHud(); } });
  hud.help = h('button', { type: 'button', class: 'hud-btn', 'aria-label': 'Help and pause', onclick: () => { click(); openHelp(); } }, '?');
  hudEl = h('div', { class: 'ui-hud', hidden: true },
    h('div', { class: 'hud-left' }, h('div', { class: 'hud-pill hud-clock' }, '⏱', hud.time), h('div', { class: 'hud-pill' }, hud.room), h('div', { class: 'hud-pill hud-keys' }, hud.keys), h('div', { class: 'hud-pill hud-hintpill' }, '💡', hud.hints), h('div', { class: 'hud-pill', title: 'Candy found' }, '🍬', hud.candy), h('div', { class: 'hud-pill', title: 'Science cards found (each adds 1 minute)' }, '🃏', hud.cards), h('div', { class: 'hud-pill hud-itempill', title: 'Your bag' }, hud.items)),
    h('div', { class: 'hud-right' }, hud.mute, hud.help));
  root.append(hudEl);
}

function updateHud() {
  if (!hudEl || hudEl.hidden) return;
  const left = timeLeft();
  hud.time.textContent = fmt(left);
  const clock = hud.time.parentElement;
  clock.classList.toggle('low', left < 180000 && left > 0);
  clock.classList.toggle('over', left <= 0);
  hud.room.textContent = 'Room ' + Math.min(6, S.room || 1) + ' / 6';
  hud.hints.textContent = S.hintsUsed || 0;
  hud.keys.forEach((k, i) => k.classList.toggle('got', S.keys.includes(i + 2)));
  hud.candy.textContent = S.candy || 0;
  hud.cards.textContent = (S.cards || []).length + '/6';
  const bag = (S.items || []).map(i => i.emoji).join(' ');
  hud.items.textContent = bag; hud.items.parentElement.hidden = !bag;
  hud.items.parentElement.title = 'Your bag: ' + ((S.items || []).map(i => i.name).join(', ') || 'empty');
  hud.mute.textContent = muted ? '🔇' : '🔊';
  hud.mute.setAttribute('aria-pressed', muted ? 'true' : 'false');
}

function showHud() { hudEl.hidden = false; updateHud(); }

/* ---------- help ---------- */
function helpBody() {
  return h('div', { class: 'ui-help' },
    h('p', {}, h('b', {}, 'Keyboard: '), 'WASD or arrow keys to move, Space to jump, E to interact (doors, terminals, arcade machines). Drag the mouse to look around.'),
    h('p', {}, h('b', {}, 'Touch: '), 'left thumb joystick to move, jump and interact buttons on the right, drag the screen to turn the camera.'),
    h('p', {}, h('b', {}, 'Goal: '), 'Solve the lock beside each door. In rooms 2 to 5 the door also needs a key from the arcade machine, and each machine has no power until you solve a puzzle in that room.'),
    h('p', {}, h('b', {}, 'Explore: '), 'Search drawers, chests, books and side rooms. Clues, tools and candy are hidden everywhere. Each room hides one science card 🃏 that adds a minute to your clock.'),
    h('p', {}, h('b', {}, 'Hints: '), 'each hint takes 1 minute off the clock. Every lock has 3 hints if you get stuck.'),
    h('p', {}, h('b', {}, 'Victory code: '), 'escape before midnight to earn a code. Show it to your teacher. After time runs out you can keep playing for practice, but there is no code.'));
}

function openHelp() {
  setPause(true);
  const m = openModal([
    h('div', { class: 'ui-mhead' }, h('h2', {}, 'Paused'), h('button', { type: 'button', class: 'ui-x', 'aria-label': 'Close', onclick: () => { click(); m.close(); } }, '✕')),
    h('div', { class: 'ui-mbody' }, helpBody()),
    h('div', { class: 'ui-mfoot' }, btn('Back to the game', 'ui-primary', () => m.close()))
  ], { cls: 'ui-narrow', label: 'Help', onClose: () => setPause(false) });
}

/* ---------- start screen ---------- */
function showStart() {
  const saved = !!(S.name && S.started);
  let costume = S.costume || 'pumpkin', color = S.color || COLORS[0], minutes = S.minutes || 40;
  if (![30, 40, 50].includes(minutes)) minutes = 40;
  const preview = () => { try { hooks.onPreview && hooks.onPreview({ costume, color }); } catch (e) {} };

  const nameIn = h('input', { class: 'ui-input', type: 'text', maxlength: '16', placeholder: 'Your name', autocomplete: 'off', 'aria-label': 'Your name', value: saved ? '' : '' });
  const err = h('p', { class: 'ui-err', role: 'alert' });

  const costumeBtns = COSTUMES.map(c => h('button', { type: 'button', class: 'ui-chip', 'aria-pressed': String(c.id === costume), onclick: () => { click(); costume = c.id; costumeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(COSTUMES[i].id === costume))); preview(); } }, h('span', { class: 'em' }, c.emoji), h('span', {}, c.name)));
  const colorBtns = COLORS.map(c => h('button', { type: 'button', class: 'ui-swatch', style: 'background:' + c, 'aria-label': 'Colour ' + c, 'aria-pressed': String(c === color), onclick: () => { click(); color = c; colorBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(COLORS[i] === color))); preview(); } }));
  const minBtns = [30, 40, 50].map(m => h('button', { type: 'button', class: 'ui-chip small', 'aria-pressed': String(m === minutes), onclick: () => { click(); minutes = m; minBtns.forEach((b, i) => b.setAttribute('aria-pressed', String([30, 40, 50][i] === minutes))); } }, m + ' min'));

  const go = () => {
    const name = nameIn.value.trim();
    if (!name) { err.textContent = 'Type your name first so your victory code is yours.'; shake(nameIn); nameIn.focus(); play('wrong'); return; }
    play('unlock');
    startRun({ name, costume, color, minutes });
    close();
    showHud();
    try { hooks.onStart && hooks.onStart(); } catch (e) { console.error(e); }
    toast('Find the glowing lock on the door. Good luck, ' + name + '!');
  };
  nameIn.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); });
  nameIn.addEventListener('keyup', e => e.stopPropagation());

  const form = h('div', { class: 'ui-form' },
    h('label', { class: 'ui-label' }, 'Your name', nameIn), err,
    h('div', { class: 'ui-label' }, 'Costume'), h('div', { class: 'ui-chips' }, costumeBtns),
    h('div', { class: 'ui-label' }, 'Colour'), h('div', { class: 'ui-swatches' }, colorBtns),
    h('div', { class: 'ui-label' }, 'Time limit'), h('div', { class: 'ui-chips row' }, minBtns),
    h('details', { class: 'ui-details' }, h('summary', {}, 'How to play'), helpBody()),
    btn('Enter if you dare', 'ui-primary big', go));

  const cont = h('div', { class: 'ui-continue' },
    h('p', {}, 'A run is in progress.'),
    btn(S.finishedAt ? 'See results for ' + S.name : 'Continue as ' + S.name, 'ui-primary big', () => {
      close();
      if (S.finishedAt) { showWin(); return; }
      showHud();
      try { hooks.onStart && hooks.onStart(); } catch (e) { console.error(e); }
    }),
    btn('New game', 'ui-ghost', () => { cont.hidden = true; form.hidden = false; nameIn.focus(); }));
  form.hidden = saved;
  cont.hidden = !saved;

  const panel = h('div', { class: 'ui-panel' },
    h('h1', { class: 'ui-title' }, 'Escape the Haunted School'),
    h('p', { class: 'ui-story' }, 'It is Halloween night and you are locked inside the school. Crack six science locks and beat the arcade machines to win the keys. Escape before midnight or you will be stuck here forever.'),
    cont, form);
  startEl = h('div', { class: 'ui-start' }, panel);
  root.append(startEl);
  function close() { startEl.classList.add('out'); const el = startEl; setTimeout(() => el.remove(), 250); }
  preview();
  if (!saved) setTimeout(() => nameIn.focus({ preventScroll: true }), 100);
}

/* ---------- lock modal ---------- */
const WRONG_MSGS = ['Not quite. Read the clues again.', 'Hmm, the lock stays shut. Have another look.', 'Close, but not yet. Check the clues carefully.', 'The lock rattles but does not open. Try again.'];
let wrongIx = 0;

export function openLock(n) {
  const lock = LOCKS[n];
  if (!lock) return Promise.resolve(false);
  if (lockDone(n)) return Promise.resolve(true);
  return new Promise(resolve => {
    setPause(true);
    let solved = false;
    const feedback = h('p', { class: 'ui-feedback', 'aria-live': 'polite' });
    const hintBox = h('div', { class: 'ui-hints' });
    const body = h('div', { class: 'ui-mbody' });
    const foot = h('div', { class: 'ui-mfoot' });
    const title = h('h2', {}, `Lock ${n} of 6 · ${lock.title}`);
    let m;
    const finish = v => { resolve(v); };

    const hintBtn = btn('Get a hint (−1 min)', 'ui-ghost', () => {
      const used = S.hints[n] || 0;
      if (used >= (lock.hints || []).length) return;
      useHint(n);
      renderHints();
      updateHud();
    });
    function renderHints() {
      const used = Math.min(S.hints[n] || 0, (lock.hints || []).length);
      hintBox.innerHTML = '';
      for (let i = 0; i < used; i++) hintBox.append(h('div', { class: 'ui-hint', html: '<b>Hint ' + (i + 1) + '</b> ' + lock.hints[i] }));
      const left = (lock.hints || []).length - used;
      hintBtn.hidden = left <= 0;
      hintBtn.textContent = 'Get a hint (−1 min)';
    }

    // input UIs: each returns { el, check() -> {ok, msg} }
    const ui = buildInputs(lock);
    const submit = () => {
      const r = ui.check();
      if (r.ok) return success();
      feedback.textContent = r.msg || WRONG_MSGS[wrongIx++ % WRONG_MSGS.length];
      feedback.className = 'ui-feedback bad';
      shake(m.box);
      play('wrong');
    };
    ui.el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); submit(); } });
    const go = btn('Try the lock', 'ui-primary', submit);

    function success() {
      solved = true;
      play('correct');
      markLock(n);
      updateHud();
      const l = lock.lesson || {};
      title.textContent = 'Unlocked!';
      body.innerHTML = '';
      body.append(h('div', { class: 'ui-lesson' },
        h('div', { class: 'ui-kicker' }, 'What you just learned'),
        h('h3', {}, l.title || ''),
        h('p', { html: l.text || '' }),
        l.dot ? h('p', { class: 'ui-dot' }, h('span', { class: 'ui-badge' }, 'Syllabus ' + l.dot)) : null));
      foot.innerHTML = '';
      foot.append(btn('Continue', 'ui-primary', () => m.close()));
      setTimeout(() => foot.querySelector('button').focus(), 30);
    }

    body.append(
      h('p', { class: 'ui-lockstory', html: lock.story || '' }),
      h('div', { class: 'ui-prompt', html: lock.prompt || '' }),
      ui.el, feedback, hintBox);
    foot.append(hintBtn, go);
    m = openModal([
      h('div', { class: 'ui-mhead' }, title, h('button', { type: 'button', class: 'ui-x', 'aria-label': 'Close', onclick: () => { click(); m.close(); } }, '✕')),
      body, foot
    ], { cls: 'ui-lockmodal', label: 'Lock ' + n, onClose: () => { setPause(false); finish(solved); } });
    renderHints();
  });
}

function buildInputs(lock) {
  const wrap = h('div', { class: 'ui-inputs ' + lock.type });
  if (lock.type === 'text') {
    const i = h('input', { class: 'ui-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'Type your answer', 'aria-label': 'Answer' });
    wrap.append(i);
    return { el: wrap, check: () => ({ ok: lock.answer.map(norm).includes(norm(i.value)) }) };
  }
  if (lock.type === 'multi') {
    const ins = lock.fields.map((f, k) => {
      const i = h('input', { class: 'ui-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', id: 'mf' + k });
      wrap.append(h('label', { class: 'ui-field' }, h('span', { html: f.label }), i));
      return i;
    });
    return { el: wrap, check: () => {
      const right = lock.fields.filter((f, k) => f.answer.map(norm).includes(norm(ins[k].value))).length;
      if (right === lock.fields.length) return { ok: true };
      return { ok: false, msg: right ? `${right} of ${lock.fields.length} boxes are right. Fix the others.` : null };
    } };
  }
  if (lock.type === 'sort') {
    const pick = lock.items.map(() => -1);
    lock.items.forEach((it, k) => {
      const bs = lock.bins.map((b, bi) => h('button', { type: 'button', class: 'ui-bin', 'aria-pressed': 'false', onclick: () => {
        click(); pick[k] = bi; bs.forEach((x, j) => x.setAttribute('aria-pressed', String(j === bi)));
      } }, b));
      wrap.append(h('div', { class: 'ui-sortrow' }, h('span', { class: 'ui-sorttext', html: it.text }), h('div', { class: 'ui-bins' }, bs)));
    });
    return { el: wrap, check: () => {
      if (pick.includes(-1)) return { ok: false, msg: 'Sort every item first. Tap a button on each row.' };
      const right = lock.items.filter((it, k) => it.bin === pick[k]).length;
      if (right === lock.items.length) return { ok: true };
      return { ok: false, msg: `${right} of ${lock.items.length} are in the right place. Move the others.` };
    } };
  }
  if (lock.type === 'select') {
    const sels = lock.items.map(it => {
      const s = h('select', { class: 'ui-input ui-select', 'aria-label': 'Choose for ' + it.text.replace(/<[^>]+>/g, '') },
        h('option', { value: '' }, 'Choose…'), ...it.options.map(o => h('option', { value: o }, o)));
      wrap.append(h('label', { class: 'ui-field' }, h('span', { html: it.text }), s));
      return s;
    });
    return { el: wrap, check: () => {
      if (sels.some(s => !s.value)) return { ok: false, msg: 'Choose an answer for every row.' };
      const right = lock.items.filter((it, k) => norm(sels[k].value) === norm(it.answer)).length;
      if (right === lock.items.length) return { ok: true };
      return { ok: false, msg: `${right} of ${lock.items.length} are right. Change the others.` };
    } };
  }
  return { el: wrap, check: () => ({ ok: false }) };
}

/* ---------- mini games ---------- */
let deck = [];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const nextQuestion = () => { if (!deck.length) deck = shuffle(MINI_QUESTIONS); return deck.pop(); };

export function openMinigame(id) {
  return new Promise(async resolve => {
    let mod;
    try { mod = (await import('./minigames/' + id + '.js')).default; } catch (e) { console.error(e); toast('This arcade machine is out of order.'); resolve(false); return; }
    setPause(true);
    let token = 0, handle = null, canvas = null, playing = false, done = false, askPending = null, over = null;
    const stage = h('div', { class: 'ui-stage' });
    const m = openModal([
      h('div', { class: 'ui-cab-top' }, h('h2', {}, mod.title || id), h('button', { type: 'button', class: 'ui-x', 'aria-label': 'Leave arcade', onclick: () => { click(); leave(); } }, '✕')),
      stage
    ], { cls: 'ui-cab', back: 'ui-arcade', label: mod.title || 'Arcade', passKeys: true, onEsc: () => leave(), onClose: () => { halt(); setPause(false); resolve(won); } });
    let won = false;

    function halt() {
      token++; playing = false;
      if (askPending) { askPending(false); askPending = null; }
      try { handle && handle.stop && handle.stop(); } catch (e) { console.error(e); }
      handle = null;
    }
    function leave() { halt(); m.close(); }

    function overlay(inner) {
      if (over) over.remove();
      over = h('div', { class: 'ui-over' }, h('div', { class: 'ui-overbox' }, inner));
      stage.append(over);
      return over;
    }
    function clearOver() { if (over) { over.remove(); over = null; } }

    function intro() {
      overlay([
        h('h3', {}, mod.title || id),
        h('p', {}, mod.instructions || ''),
        h('p', { class: 'ui-small' }, 'Questions pop up during the game. Think carefully!'),
        btn('Start', 'ui-primary big', begin),
        btn('Leave', 'ui-ghost', leave)]);
      over.querySelector('.ui-primary').focus();
    }

    function begin() {
      clearOver();
      if (handle) { try { handle.stop(); } catch (e) {} handle = null; }
      if (canvas) canvas.remove();
      canvas = h('canvas', { class: 'ui-canvas', tabindex: '-1' });
      stage.prepend(canvas);
      const my = ++token;
      playing = true;
      const api = {
        sfx: play,
        ask: () => new Promise(res => {
          if (my !== token) return res(false);
          askPending = res;
          showAsk(r => { if (askPending === res) askPending = null; res(r); }, my);
        }),
        win: () => {
          if (my !== token || !playing) return;
          playing = false;
          play('win');
          const o = overlay([h('div', { class: 'ui-keyfound' }, h('div', { class: 'big-key' }, '🔑'), h('h3', {}, 'KEY FOUND!'))]);
          o.classList.add('celebrate');
          setTimeout(() => { if (my !== token) return; won = true; halt(); m.close(); }, 1900);
        },
        lose: () => {
          if (my !== token || !playing) return;
          playing = false;
          play('lose');
          overlay([h('h3', {}, 'Game over'), h('p', {}, 'The ghosts got you. Try again?'), btn('Try again', 'ui-primary big', () => { halt(); begin(); }), btn('Leave', 'ui-ghost', leave)]).querySelector('.ui-primary').focus();
        }
      };
      requestAnimationFrame(() => {
        if (my !== token) return;
        try { handle = mod.start(canvas, api) || null; } catch (e) { console.error(e); toast('The arcade machine glitched.'); leave(); }
      });
    }

    function showAsk(done_, my) {
      const q = nextQuestion();
      const order = shuffle(q.options.map((t, i) => i));
      const fb = h('p', { class: 'ui-askfb', 'aria-live': 'polite' });
      let answered = false;
      const bs = order.map((oi, k) => h('button', { type: 'button', class: 'ui-opt', onclick: () => choose(oi, bs[k]) }, h('b', {}, k + 1), h('span', { html: q.options[oi] })));
      const box = h('div', { class: 'ui-askbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Quick question' }, h('div', { class: 'ui-kicker' }, 'Quick question'), h('h3', { html: q.q }), h('div', { class: 'ui-opts' }, bs), fb);
      const ov = h('div', { class: 'ui-over ask' }, box);
      stage.append(ov);
      const key = e => {
        e.stopPropagation();
        const k = parseInt(e.key, 10);
        if (k >= 1 && k <= bs.length) { e.preventDefault(); bs[k - 1].click(); }
      };
      box.addEventListener('keydown', key);
      box.addEventListener('keyup', e => e.stopPropagation());
      bs[0].focus();
      function choose(oi, el) {
        if (answered) return;
        answered = true;
        const ok = oi === q.answer;
        play(ok ? 'correct' : 'wrong');
        bs.forEach(b => b.disabled = true);
        el.classList.add(ok ? 'right' : 'wrong');
        if (!ok) bs[order.indexOf(q.answer)].classList.add('right');
        fb.className = 'ui-askfb ' + (ok ? 'good' : 'bad');
        fb.innerHTML = (ok ? 'Correct! ' : 'Not quite. ') + (q.explain || '');
        setTimeout(() => { ov.remove(); if (my === token) { done_(ok); if (canvas) canvas.focus({ preventScroll: true }); } }, 1500);
      }
    }
    // if overlay closed mid-question, remove popups
    intro();
  });
}

/* ---------- room interactions ---------- */
// A note, clue or discovery card. Resolves when closed.
export function openNote({ title, html, kicker, button } = {}) {
  return new Promise(res => {
    setPause(true);
    let m;
    const done = () => { m.close(); };
    m = openModal([
      h('div', { class: 'ui-mhead' }, h('div', {}, kicker ? h('div', { class: 'ui-kicker' }, kicker) : null, h('h2', {}, title || '')), h('button', { type: 'button', class: 'ui-x', 'aria-label': 'Close', onclick: () => { click(); done(); } }, '×')),
      h('div', { class: 'ui-mbody ui-note', html: html || '' }),
      h('div', { class: 'ui-mfoot' }, btn(button || 'Got it', 'ui-primary', done)),
    ], { label: title || 'Note', cls: 'ui-narrow note', onClose: () => { setPause(false); res(); } });
  });
}

// A quick multiple-choice science question outside the arcade. Resolves true if right.
export function askQuestion(kicker) {
  return new Promise(res => {
    setPause(true);
    const q = nextQuestion();
    const order = shuffle(q.options.map((t, i) => i));
    const fb = h('p', { class: 'ui-askfb', 'aria-live': 'polite' });
    let answered = false, ok = false, m;
    const bs = order.map((oi, k) => h('button', { type: 'button', class: 'ui-opt', onclick: () => pick(oi, bs[k]) }, h('b', {}, k + 1), h('span', { html: q.options[oi] })));
    m = openModal([h('div', { class: 'ui-askbox' }, h('div', { class: 'ui-kicker' }, kicker || 'Quick question'), h('h3', { html: q.q }), h('div', { class: 'ui-opts' }, bs), fb)],
      { label: 'Quick question', cls: 'ui-narrow askmodal', noEsc: true, onClose: () => { setPause(false); res(ok); } });
    m.box.addEventListener('keydown', e => { const k = parseInt(e.key, 10); if (k >= 1 && k <= bs.length) { e.preventDefault(); bs[k - 1].click(); } });
    function pick(oi, el) {
      if (answered) return;
      answered = true; ok = oi === q.answer;
      play(ok ? 'correct' : 'wrong');
      bs.forEach(b => b.disabled = true);
      el.classList.add(ok ? 'right' : 'wrong');
      if (!ok) bs[order.indexOf(q.answer)].classList.add('right');
      fb.className = 'ui-askfb ' + (ok ? 'good' : 'bad');
      fb.innerHTML = (ok ? 'Correct! ' : 'Not quite. ') + (q.explain || '');
      setTimeout(() => m.close(), 1800);
    }
  });
}

// Pick one of several options (e.g. which book to pull). Resolves the index, or -1 if closed.
export function choose({ title, html, options = [] } = {}) {
  return new Promise(res => {
    setPause(true);
    let pickIx = -1, m;
    const bs = options.map((o, i) => h('button', { type: 'button', class: 'ui-opt', onclick: () => { click(); pickIx = i; m.close(); } }, h('b', {}, i + 1), h('span', { html: o })));
    m = openModal([
      h('div', { class: 'ui-mhead' }, h('h2', {}, title || 'Choose'), h('button', { type: 'button', class: 'ui-x', 'aria-label': 'Close', onclick: () => { click(); m.close(); } }, '×')),
      h('div', { class: 'ui-mbody' }, html ? h('div', { class: 'ui-note', html }) : null, h('div', { class: 'ui-opts' }, bs)),
    ], { label: title || 'Choose', cls: 'ui-narrow choose', onClose: () => { setPause(false); res(pickIx); } });
    m.box.addEventListener('keydown', e => { const k = parseInt(e.key, 10); if (k >= 1 && k <= bs.length) { e.preventDefault(); bs[k - 1].click(); } });
  });
}

/* ---------- time up ---------- */
function showTimeUp() {
  if (timeupEl) return;
  timeupEl = h('div', { class: 'ui-timeup', role: 'alertdialog', 'aria-label': 'Time is up' },
    h('b', {}, 'Midnight has struck…'),
    h('span', {}, ' you can keep playing for practice, but there\'s no prize.'),
    btn('OK', 'ui-primary small', () => { timeupEl.remove(); timeupEl = null; }));
  root.append(timeupEl);
  play('lose');
}

/* ---------- win ---------- */
export function showWin() {
  if (document.querySelector('.ui-win')) return;
  try { hooks.setPaused && hooks.setPaused(true); } catch (e) {}
  if (hudEl) hudEl.hidden = true;
  if (timeupEl) { timeupEl.remove(); timeupEl = null; }
  const practice = victoryCode() === 'PRACTICE';
  const c = COSTUMES.find(x => x.id === S.costume) || { emoji: '', name: S.costume };
  const left = Math.max(0, timeLeft());
  const taken = Math.max(0, (S.finishedAt || Date.now()) - S.started + (S.hintsUsed || 0) * HINT_COST);
  const clock = new Date(S.finishedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let armed = false, timer = 0;
  const reset = h('button', { type: 'button', class: 'ui-tiny', onclick: () => {
    if (!armed) { armed = true; reset.textContent = 'Click again to wipe this run'; timer = setTimeout(() => { armed = false; reset.textContent = 'Start over'; }, 4000); return; }
    clearTimeout(timer); resetAll(); location.reload();
  } }, 'Start over');
  const stat = (k, v) => h('div', { class: 'ui-stat' }, h('span', {}, k), h('b', {}, v));
  const el = h('div', { class: 'ui-win' + (practice ? ' practice' : '') },
    h('div', { class: 'ui-wincard' },
      h('h1', { class: 'ui-title' }, 'You escaped!'),
      h('p', { class: 'ui-winsub' }, practice ? 'Well done for finishing. The clock had run out, so this one was for practice.' : 'The gates creak open and the moon lights your way home.'),
      h('div', { class: 'ui-code', 'aria-label': 'Victory code' }, h('span', {}, practice ? 'No code' : 'Victory code'), h('b', {}, victoryCode())),
      h('div', { class: 'ui-stats' },
        stat('Name', S.name), stat('Costume', c.emoji + ' ' + c.name), stat('Time left', fmt(left)),
        stat('Time taken', fmt(taken)), stat('Hints used', String(S.hintsUsed || 0)), stat('Finished at', clock),
        stat('Candy found', String(S.candy || 0)), stat('Science cards', (S.cards || []).length + ' / 6')),
      h('p', { class: 'ui-show' }, 'Show this screen to your teacher.'),
      reset));
  root.append(el);
  play('win');
}
