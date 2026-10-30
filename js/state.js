// Shared game state, persistence, timer and victory code.
const STORE = 'haunted-school-y7-v1';
export const HINT_COST = 60000;

const fresh = () => ({
  name: '', costume: 'pumpkin', color: '#ff7a1a', minutes: 40,
  started: 0, endAt: 0, finishedAt: 0, overtime: false,
  room: 1, locks: [], keys: [], hints: {}, hintsUsed: 0,
  power: [], found: [], items: [], candy: 0, cards: [],
});

export let S = fresh();
try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (saved && saved.name) S = Object.assign(fresh(), saved);
} catch (e) {}

export const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} };

export function resetAll() {
  S = fresh();
  try { localStorage.removeItem(STORE); } catch (e) {}
  emit('reset');
}

export function startRun({ name, costume, color, minutes }) {
  Object.assign(S, fresh(), { name, costume, color, minutes, started: Date.now() });
  S.endAt = S.started + minutes * 60000;
  save();
  emit('start');
}

export const timeLeft = () => S.endAt - (S.finishedAt || Date.now());
export const fmt = ms => {
  const s = Math.max(0, Math.round(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};

// Each hint takes HINT_COST off the clock. Returns how many hints this lock has used.
export function useHint(n) {
  S.hints[n] = (S.hints[n] || 0) + 1;
  S.hintsUsed++;
  S.endAt -= HINT_COST;
  save();
  emit('hint', n);
  return S.hints[n];
}

export function markLock(n) {
  if (!S.locks.includes(n)) S.locks.push(n);
  if (n < 6) S.room = Math.max(S.room, n + 1);
  save();
  emit('lock', n);
}
export const lockDone = n => S.locks.includes(n);

export function giveKey(room) {
  if (!S.keys.includes(room)) S.keys.push(room);
  save();
  emit('key', room);
}
export const hasKey = room => room === 1 || room === 6 || S.keys.includes(room);

export function finish() {
  if (S.finishedAt) return;
  S.finishedAt = Date.now();
  if (S.endAt - S.finishedAt <= 0) S.overtime = true;
  save();
  emit('finish');
}

// Arcade machines in rooms 2-5 need power before they can be played.
export function powerArcade(room) {
  if (!S.power.includes(room)) S.power.push(room);
  save();
  emit('power', room);
}
export const hasPower = room => S.power.includes(room);

// One-off things the player has found or done, by id (e.g. 'r2-book', 'r3-candy4').
export function markFound(id) { if (!S.found.includes(id)) { S.found.push(id); save(); emit('found', id); } }
export const isFound = id => S.found.includes(id);

// Inventory items: { id, name, emoji }.
export function addItem(item) { if (!S.items.some(i => i.id === item.id)) { S.items.push(item); save(); emit('items'); } }
export const hasItem = id => S.items.some(i => i.id === id);
export function useItem(id) { S.items = S.items.filter(i => i.id !== id); save(); emit('items'); }

export function addCandy(id) {
  if (isFound(id)) return false;
  S.found.push(id); S.candy++; save(); emit('candy', S.candy); return true;
}
export const CARD_BONUS = 60000;
// Science cards: one hidden per room, each adds a minute to the clock.
export function collectCard(room) {
  if (S.cards.includes(room)) return false;
  S.cards.push(room);
  if (!S.finishedAt && !S.overtime) S.endAt += CARD_BONUS;
  save(); emit('card', room); return true;
}

const hash = s => { let x = 0x811c9dc5; for (const c of s) { x ^= c.codePointAt(0); x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(16); };
export const victoryCode = () => S.overtime || !S.finishedAt
  ? 'PRACTICE'
  : 'BOO-' + hash(S.name.trim().toLowerCase() + '|' + S.finishedAt).toUpperCase().slice(-4).padStart(4, '0');

// Tiny event bus: start, reset, hint, lock, key, finish, timeup, power, found, items, candy, card.
const bus = new EventTarget();
export const on = (ev, fn) => bus.addEventListener(ev, e => fn(e.detail));
export const emit = (ev, detail) => bus.dispatchEvent(new CustomEvent(ev, { detail }));

setInterval(() => {
  if (S.started && !S.finishedAt && !S.overtime && timeLeft() <= 0) {
    S.overtime = true;
    save();
    emit('timeup');
  }
}, 1000);
