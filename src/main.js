// Anzeige und Bedienung von Royal Blocks.

import { SIZE, STREAK_GRACE, canPlace, createGame, fitsAnywhere, idx, placePiece, previewPlacement, streakMultiplier } from './game.js';
import { HANDS, SUITS, rankLabel } from './poker.js';
import { setSoundEnabled, setVibrationEnabled, sounds, unlockAudio, vibrate } from './audio.js';
import { SUIT_COLORS, burst, chips, initFx } from './fx.js';
import { load, remove, save } from './storage.js';

const $ = (id) => document.getElementById(id);
const version = document.documentElement.dataset.version;
const rng = Math.random;

const els = {
  app: $('app'),
  board: $('board'),
  tray: $('tray'),
  slots: [...document.querySelectorAll('.slot')],
  drag: $('drag'),
  score: $('score'),
  best: $('best'),
  streak: $('streak'),
  preview: $('preview'),
  banner: $('banner'),
};

// ---------- Zustand ----------

const settings = { sound: true, vibration: true, seenHelp: false, ...load('settings', {}) };
setSoundEnabled(settings.sound);
setVibrationEnabled(settings.vibration);

let best = Number(load('best', 0)) || 0;
let state = loadGame() ?? createGame(rng);
let bestAtStart = best;
let shownScore = state.score;

function loadGame() {
  const saved = load('game', null);
  const valid =
    saved && Array.isArray(saved.board) && saved.board.length === SIZE * SIZE && Array.isArray(saved.tray) && !saved.over;
  if (!valid) return null;
  saved.over = !saved.tray.some((p) => p && fitsAnywhere(saved.board, p));
  return saved;
}

function persist() {
  if (state.over) remove('game');
  else save('game', state);
}

// ---------- Größe ----------

let cell = 40;
let gap = 3;

function layout() {
  const w = Math.min(window.innerWidth, 560) - 24;
  const h = window.innerHeight - 64 - 30 - 8 - 34; // Kopfzeile, Vorschau, Abstände
  gap = window.innerWidth < 380 ? 2 : 3;
  const byWidth = (w - 2 - 9 * gap) / 8;
  const byHeight = (h - 2 - 9 * gap) / 11.4; // 8 Feld-Reihen + 3,4 für die Ablage
  cell = Math.max(24, Math.floor(Math.min(byWidth, byHeight, 62)));
  document.documentElement.style.setProperty('--cell', `${cell}px`);
  document.documentElement.style.setProperty('--gap', `${gap}px`);
}

// ---------- Darstellung ----------

function tile(card) {
  const el = document.createElement('div');
  el.className = `tile s${card.s}`;
  const r = document.createElement('span');
  r.className = 'r';
  r.textContent = rankLabel(card.r);
  const s = document.createElement('span');
  s.className = 's';
  s.textContent = SUITS[card.s];
  el.append(r, s);
  return el;
}

const cellEls = [];
function buildBoard() {
  for (let i = 0; i < SIZE * SIZE; i++) {
    const el = document.createElement('div');
    el.className = 'cell';
    els.board.append(el);
    cellEls.push(el);
  }
}

const cardKey = (card) => (card ? `${card.r}${card.s}` : '');

function renderBoard(popCells = []) {
  state.board.forEach((card, i) => {
    const el = cellEls[i];
    const key = cardKey(card);
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.replaceChildren();
    if (card) {
      const t = tile(card);
      if (popCells.includes(i)) t.classList.add('pop');
      el.append(t);
    }
  });
}

function pieceEl(piece) {
  const el = document.createElement('div');
  el.className = 'piece';
  piece.cells.forEach(([x, y], k) => {
    const t = tile(piece.cards[k]);
    t.style.gridColumn = String(x + 1);
    t.style.gridRow = String(y + 1);
    el.append(t);
  });
  return el;
}

function renderTray(deal = false) {
  els.slots.forEach((slot, i) => {
    const piece = state.tray[i];
    slot.replaceChildren();
    slot.classList.toggle('empty', !piece);
    slot.classList.remove('dragging');
    slot.classList.toggle('no-fit', Boolean(piece) && !fitsAnywhere(state.board, piece));
    if (piece) {
      const el = pieceEl(piece);
      if (deal) el.classList.add('deal');
      slot.append(el);
    }
  });
}

function renderStreak() {
  if (state.streak >= 2) {
    els.streak.textContent = `SERIE ${state.streak} · ×${streakMultiplier(state.streak)}`;
    els.streak.classList.toggle('fading', state.grace < STREAK_GRACE);
  } else {
    els.streak.textContent = '';
  }
}

const fmt = (n) => n.toLocaleString('de-DE');

function renderScore() {
  els.best.textContent = fmt(best);
  const from = shownScore;
  const to = state.score;
  shownScore = to;
  if (from === to) {
    els.score.textContent = fmt(to);
    return;
  }
  els.score.classList.add('bump');
  const t0 = performance.now();
  const dur = Math.min(900, 250 + (to - from) / 4);
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    els.score.textContent = fmt(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(step);
    else els.score.classList.remove('bump');
  };
  requestAnimationFrame(step);
}

function renderAll() {
  layout();
  renderBoard();
  renderTray();
  renderStreak();
  renderScore();
}

// ---------- Ziehen ----------

let drag = null;
let ghost = { cells: [], marked: [] };

function clearGhost() {
  for (const i of ghost.cells) cellEls[i].classList.remove('ghost', 'g0', 'g1', 'g2', 'g3');
  for (const i of ghost.marked) cellEls[i].classList.remove('will-clear', 'hand-card');
  ghost = { cells: [], marked: [] };
  els.preview.replaceChildren();
}

function showGhost(piece, x, y) {
  clearGhost();
  piece.cells.forEach(([dx, dy], k) => {
    const i = idx(x + dx, y + dy);
    cellEls[i].classList.add('ghost', `g${piece.cards[k].s}`);
    ghost.cells.push(i);
  });
  const lines = previewPlacement(state.board, piece, x, y) ?? [];
  for (const line of lines) {
    for (const i of line.cells) cellEls[i].classList.add('will-clear');
    for (const i of line.handCells) cellEls[i].classList.add('hand-card');
    ghost.marked.push(...line.cells);
    const tag = document.createElement('span');
    tag.className = `tag t${line.hand.level >= 4 ? 2 : line.hand.level >= 1 ? 1 : 0}`;
    tag.textContent = `${line.hand.name} ×${line.hand.mult}`;
    els.preview.append(tag);
  }
}

function boardOrigin() {
  const r = els.board.getBoundingClientRect();
  return { x: r.left + 1 + gap, y: r.top + 1 + gap };
}

function moveDrag(e) {
  const { piece } = drag;
  const pw = piece.w * cell + (piece.w - 1) * gap;
  const ph = piece.h * cell + (piece.h - 1) * gap;
  const left = e.clientX - pw / 2;
  // Mit dem Finger schwebt das Teil darüber, damit man sieht, wohin es kommt.
  const top = drag.touch ? e.clientY - ph - cell * 1.1 : e.clientY - ph / 2;
  els.drag.style.transform = `translate(${left}px, ${top}px)`;

  const o = boardOrigin();
  const pitch = cell + gap;
  const x = Math.round((left - o.x) / pitch);
  const y = Math.round((top - o.y) / pitch);
  const valid = canPlace(state.board, piece, x, y);
  if (valid && (drag.x !== x || drag.y !== y || !drag.valid)) showGhost(piece, x, y);
  if (!valid && drag.valid) clearGhost();
  Object.assign(drag, { x, y, valid });
}

function startDrag(e) {
  const slotEl = e.currentTarget;
  const slot = Number(slotEl.dataset.slot);
  const piece = state.tray[slot];
  if (!piece || drag || state.over || document.querySelector('.overlay:not([hidden])')) return;
  e.preventDefault();
  unlockAudio();
  sounds.pickup();
  drag = { slot, piece, pointerId: e.pointerId, touch: e.pointerType !== 'mouse', valid: false, x: null, y: null };
  els.drag.className = 'drag on';
  els.drag.replaceChildren(pieceEl(piece));
  slotEl.classList.add('dragging');
  try {
    slotEl.setPointerCapture(e.pointerId);
  } catch {
    // nicht schlimm, die Fenster-Ereignisse reichen
  }
  moveDrag(e);
}

function endDrag(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const d = drag;
  drag = null;
  clearGhost();
  if (e.type === 'pointerup' && d.valid) {
    els.drag.className = 'drag';
    place(d.slot, d.x, d.y);
    return;
  }
  // zurück in die Ablage
  if (e.type === 'pointerup') sounds.invalid();
  const r = els.slots[d.slot].getBoundingClientRect();
  const pw = d.piece.w * cell;
  const ph = d.piece.h * cell;
  els.drag.classList.add('back');
  els.drag.style.transform = `translate(${r.left + r.width / 2 - pw / 2}px, ${r.top + r.height / 2 - ph / 2}px) scale(0.56)`;
  setTimeout(() => {
    els.drag.className = 'drag';
    els.slots[d.slot].classList.remove('dragging');
  }, 180);
}

// ---------- Zug ausführen ----------

function cellCenter(i) {
  const r = cellEls[i].getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
}

function place(slot, x, y) {
  const res = placePiece(state, slot, x, y, rng);
  if (!res) return;
  sounds.place();
  vibrate(8);

  // verschwindende Karten als Effekt-Kopien über das Feld legen, bevor das Feld neu gezeichnet wird
  if (res.lines.length) clearEffects(res);
  renderBoard(res.placed.filter((i) => !res.removed.has(i)));
  renderTray(res.dealt);
  renderStreak();

  if (state.score > best) {
    if (best > 0 && bestAtStart === best) sounds.record();
    best = state.score;
    save('best', best);
  }
  renderScore();
  persist();

  if (res.over) setTimeout(gameOver, res.lines.length ? 1300 : 700);
}

function clearEffects(res) {
  const handCells = new Set(res.lines.flatMap((l) => l.handCells));
  const top = res.lines.reduce((a, b) => (b.hand.level > a.hand.level ? b : a));
  const level = top.hand.level;

  for (const [i, card] of res.removed) {
    const { x, y, r } = cellCenter(i);
    const el = tile(card);
    el.classList.add('fx-tile');
    if (handCells.has(i)) el.classList.add('hand');
    el.style.setProperty('--size', `${r.width}px`);
    el.style.left = `${r.left}px`;
    el.style.top = `${r.top}px`;
    el.style.width = `${r.width}px`;
    el.style.height = `${r.height}px`;
    // Welle entlang der Reihe
    const delay = (i % SIZE) * 22 + Math.floor(i / SIZE) * 22;
    el.style.animationDelay = `${delay}ms`;
    document.body.append(el);
    setTimeout(() => el.remove(), 900 + delay);
    setTimeout(() => burst(x, y, SUIT_COLORS[card.s], 1 + level * 0.25), (handCells.has(i) ? 450 : 200) + delay);
  }

  const center = els.board.getBoundingClientRect();
  const cx = center.left + center.width / 2;
  const cy = center.top + center.height / 2;
  if (level >= 4) setTimeout(() => chips(cx, cy, 8 + level * 3), 350);
  if (res.tableClear) setTimeout(() => chips(cx, cy, 40), 500);

  showBanner(res, top.hand);

  sounds.clear(level, res.streak, res.combo);
  if (res.tableClear) setTimeout(() => sounds.tableClear(), 400);
  vibrate(level >= 4 || res.combo > 1 ? [25, 40, 45] : 22);

  const shake = level >= 7 || res.tableClear ? 'shake-big' : level >= 4 || res.combo > 1 ? 'shake' : null;
  if (shake) {
    els.app.classList.remove('shake', 'shake-big');
    void els.app.offsetWidth;
    els.app.classList.add(shake);
    setTimeout(() => els.app.classList.remove(shake), 800);
  }
}

function showBanner(res, hand) {
  const tier = hand.level >= 7 ? 3 : hand.level >= 4 ? 2 : hand.level >= 2 ? 1 : 0;
  const name = document.createElement('div');
  name.className = `hand-name tier${tier}`;
  name.textContent = hand.name;
  els.banner.replaceChildren(name);

  const extras = [];
  if (res.lines.length > 1) extras.push(`Kombo ×${res.combo}`);
  if (res.streak > 1) extras.push(`Serie ×${res.streakMult}`);
  if (res.tableClear) extras.push('Tisch leer!');
  if (extras.length) {
    const ex = document.createElement('div');
    ex.className = 'extra';
    ex.textContent = extras.join(' · ').toUpperCase();
    els.banner.append(ex);
  }
  const pts = document.createElement('div');
  pts.className = 'points';
  pts.textContent = `+${fmt(res.points)}`;
  els.banner.append(pts);

  clearTimeout(showBanner.timer);
  showBanner.timer = setTimeout(() => els.banner.replaceChildren(), tier === 3 ? 1900 : 1200);
}

// ---------- Fenster ----------

function openOverlay(id) {
  for (const el of document.querySelectorAll('.overlay')) el.hidden = el.id !== id;
}
function closeOverlays() {
  for (const el of document.querySelectorAll('.overlay')) el.hidden = true;
}

function renderSettings() {
  $('sound-state').textContent = settings.sound ? 'an' : 'aus';
  $('vibration-state').textContent = settings.vibration ? 'an' : 'aus';
}

function newGame() {
  state = createGame(rng);
  bestAtStart = best;
  shownScore = 0;
  remove('game');
  persist();
  closeOverlays();
  els.banner.replaceChildren();
  renderBoard();
  renderTray(true);
  renderStreak();
  renderScore();
}

function gameOver() {
  if (!state.over) return;
  sounds.gameOver();
  vibrate([40, 60, 40]);
  $('final-score').textContent = fmt(state.score);
  $('final-best').textContent = fmt(best);
  $('final-hand').textContent = state.bestHand >= 0 ? HANDS[state.bestHand].name : '–';
  $('final-lines').textContent = fmt(state.lines);
  $('new-record').hidden = !(state.score > bestAtStart && state.score > 0);
  openOverlay('gameover');
}

const actions = {
  resume() {
    closeOverlays();
    if (!settings.seenHelp) {
      settings.seenHelp = true;
      save('settings', settings);
    }
  },
  help: () => openOverlay('help'),
  sound() {
    settings.sound = !settings.sound;
    setSoundEnabled(settings.sound);
    save('settings', settings);
    renderSettings();
  },
  vibration() {
    settings.vibration = !settings.vibration;
    setVibrationEnabled(settings.vibration);
    save('settings', settings);
    renderSettings();
    vibrate(20);
  },
  new: () => openOverlay('confirm-new'),
  'new-confirm': newGame,
};

const EXAMPLES = {
  'royal-flush': [[10, 1], [11, 1], [12, 1], [13, 1], [14, 1]],
  'straight-flush': [[5, 0], [6, 0], [7, 0], [8, 0], [9, 0]],
  quads: [[9, 0], [9, 1], [9, 2], [9, 3]],
  'full-house': [[13, 0], [13, 1], [13, 2], [4, 3], [4, 1]],
  flush: [[2, 2], [6, 2], [9, 2], [11, 2], [14, 2]],
  straight: [[6, 3], [7, 1], [8, 0], [9, 2], [10, 3]],
  trips: [[7, 0], [7, 1], [7, 2]],
  'two-pair': [[5, 0], [5, 1], [12, 2], [12, 3]],
  pair: [[14, 0], [14, 1]],
  high: [[13, 3]],
};

function buildHandTable() {
  const table = $('hand-table');
  for (const hand of [...HANDS].reverse()) {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = hand.name;
    const ex = document.createElement('td');
    const row = document.createElement('div');
    row.className = 'ex';
    for (const [r, s] of EXAMPLES[hand.id]) row.append(tile({ r, s }));
    ex.append(row);
    const mult = document.createElement('td');
    mult.textContent = `×${hand.mult}`;
    tr.append(name, ex, mult);
    table.append(tr);
  }
}

// ---------- Start ----------

buildBoard();
buildHandTable();
initFx($('fx'));
renderSettings();
$('version').textContent = version === 'dev' ? '(Entwicklung)' : `v${version}`;
renderAll();

for (const slot of els.slots) slot.addEventListener('pointerdown', startDrag);
window.addEventListener('pointermove', (e) => {
  if (drag && e.pointerId === drag.pointerId) moveDrag(e);
});
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
window.addEventListener('resize', () => {
  layout();
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

$('menu-btn').addEventListener('click', () => {
  unlockAudio();
  openOverlay('menu');
});
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (btn) {
    unlockAudio();
    actions[btn.dataset.action]?.();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.over) return;
    if (document.querySelector('.overlay:not([hidden])')) actions.resume();
    else openOverlay('menu');
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persist();
});

if (state.over) gameOver();
else if (!settings.seenHelp) openOverlay('help');

// Offline-Betrieb (nur im gebauten Spiel; beim Entwickeln würde der Cache stören)
if (version !== 'dev' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  });
}
