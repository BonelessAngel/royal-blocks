// Spielregeln ohne Anzeige: Feld, Teile setzen, Reihen abräumen, Punkte, Spielende.
// Der Zustand ist reines JSON und kann direkt gespeichert werden.

import { evaluateHand } from './poker.js';
import { randomPiece } from './pieces.js';

export const SIZE = 8;
export const CELL_POINTS = 10; // Punkte pro Kästchen einer abgeräumten Reihe, mal Faktor der Pokerhand
export const STREAK_GRACE = 3; // so viele Züge ohne Abräumen beendet die Serie
export const TABLE_CLEAR_BONUS = 2000; // Feld komplett leer
const DEAL_ATTEMPTS = 25;

export const idx = (x, y) => y * SIZE + x;

export function createGame(rng) {
  const state = {
    board: new Array(SIZE * SIZE).fill(null),
    tray: [],
    score: 0,
    streak: 0,
    grace: 0,
    moves: 0,
    lines: 0,
    bestHand: -1,
    over: false,
  };
  state.tray = dealTray(state.board, rng);
  return state;
}

export function canPlace(board, piece, x, y) {
  if (x < 0 || y < 0 || x + piece.w > SIZE || y + piece.h > SIZE) return false;
  return piece.cells.every(([dx, dy]) => board[idx(x + dx, y + dy)] === null);
}

export function fitsAnywhere(board, piece) {
  for (let y = 0; y <= SIZE - piece.h; y++) {
    for (let x = 0; x <= SIZE - piece.w; x++) if (canPlace(board, piece, x, y)) return true;
  }
  return false;
}

// Drei neue Teile; mindestens eins davon soll passen (wenn das in einigen Versuchen gelingt).
export function dealTray(board, rng) {
  let tray;
  for (let attempt = 0; attempt < DEAL_ATTEMPTS; attempt++) {
    tray = [randomPiece(rng), randomPiece(rng), randomPiece(rng)];
    if (tray.some((piece) => fitsAnywhere(board, piece))) break;
  }
  return tray;
}

// Welche Reihen und Spalten wären voll? Funktioniert auf jedem Feld (auch für die Vorschau).
export function findFullLines(board) {
  const lines = [];
  for (let y = 0; y < SIZE; y++) {
    const cells = Array.from({ length: SIZE }, (_, x) => idx(x, y));
    if (cells.every((i) => board[i])) lines.push({ type: 'row', index: y, cells });
  }
  for (let x = 0; x < SIZE; x++) {
    const cells = Array.from({ length: SIZE }, (_, y) => idx(x, y));
    if (cells.every((i) => board[i])) lines.push({ type: 'col', index: x, cells });
  }
  for (const line of lines) {
    line.hand = evaluateHand(line.cells.map((i) => board[i]));
    line.handCells = line.hand.used.map((k) => line.cells[k]);
  }
  return lines;
}

export const streakMultiplier = (streak) => (streak > 1 ? 1 + 0.5 * (streak - 1) : 1);

// Vorschau für die Anzeige: welche Reihen würde dieser Zug abräumen?
export function previewPlacement(board, piece, x, y) {
  if (!canPlace(board, piece, x, y)) return null;
  const next = board.slice();
  piece.cells.forEach(([dx, dy], k) => (next[idx(x + dx, y + dy)] = piece.cards[k]));
  return findFullLines(next);
}

export function placePiece(state, slot, x, y, rng) {
  const piece = state.tray[slot];
  if (state.over || !piece || !canPlace(state.board, piece, x, y)) return null;

  const placed = piece.cells.map(([dx, dy], k) => {
    const i = idx(x + dx, y + dy);
    state.board[i] = piece.cards[k];
    return i;
  });
  state.tray[slot] = null;
  state.moves++;

  const lines = findFullLines(state.board);
  const removed = new Map(); // Index -> Karte, damit die Anzeige die verschwindenden Karten zeigen kann
  for (const line of lines) for (const i of line.cells) removed.set(i, state.board[i]);
  for (const i of removed.keys()) state.board[i] = null;

  let linePoints = 0;
  for (const line of lines) {
    line.points = CELL_POINTS * SIZE * line.hand.mult;
    linePoints += line.points;
    state.bestHand = Math.max(state.bestHand, line.hand.level);
  }

  if (lines.length) {
    state.streak++;
    state.grace = STREAK_GRACE;
    state.lines += lines.length;
  } else if (state.streak) {
    state.grace--;
    if (state.grace <= 0) state.streak = 0;
  }

  const combo = lines.length;
  const streakMult = lines.length ? streakMultiplier(state.streak) : 1;
  const tableClear = lines.length > 0 && state.board.every((c) => c === null);
  const points =
    placed.length + Math.round(linePoints * combo * streakMult) + (tableClear ? Math.round(TABLE_CLEAR_BONUS * streakMult) : 0);
  state.score += points;

  let dealt = false;
  if (state.tray.every((p) => p === null)) {
    state.tray = dealTray(state.board, rng);
    dealt = true;
  }
  state.over = !state.tray.some((p) => p && fitsAnywhere(state.board, p));

  return { placed, lines, removed, combo, streak: state.streak, streakMult, tableClear, points, dealt, over: state.over };
}
