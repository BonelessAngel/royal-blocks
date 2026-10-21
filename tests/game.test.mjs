import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CELL_POINTS, SIZE, STREAK_GRACE, TABLE_CLEAR_BONUS, canPlace, createGame, findFullLines, fitsAnywhere, idx, placePiece,
} from '../src/game.js';
import { SHAPES, seededRng } from '../src/pieces.js';

const card = (r, s) => ({ r, s });
const single = (c = card(2, 0)) => ({ shape: 0, w: 1, h: 1, cells: [[0, 0]], cards: [c] });
const bar = (len) => ({ shape: 99, w: len, h: 1, cells: Array.from({ length: len }, (_, x) => [x, 0]), cards: Array.from({ length: len }, (_, x) => card(2 + x, x % 4)) });

function emptyGame(tray) {
  return { board: new Array(SIZE * SIZE).fill(null), tray, score: 0, streak: 0, grace: 0, moves: 0, lines: 0, bestHand: -1, over: false };
}

test('alle Formen sind gültig', () => {
  for (const shape of SHAPES) {
    assert.ok(shape.cells.length > 0);
    for (const [x, y] of shape.cells) assert.ok(x < shape.w && y < shape.h);
    assert.ok(shape.cells.some(([x]) => x === shape.w - 1) && shape.cells.some(([, y]) => y === shape.h - 1));
  }
});

test('neues Spiel: leeres Feld und drei Teile mit Karten', () => {
  const game = createGame(seededRng(1));
  assert.equal(game.board.length, 64);
  assert.ok(game.board.every((c) => c === null));
  assert.equal(game.tray.length, 3);
  for (const piece of game.tray) assert.equal(piece.cards.length, piece.cells.length);
  assert.equal(game.over, false);
});

test('gleicher Startwert ergibt gleiches Spiel', () => {
  assert.deepEqual(createGame(seededRng(42)), createGame(seededRng(42)));
});

test('Teile dürfen nicht über den Rand oder auf belegte Felder', () => {
  const board = new Array(64).fill(null);
  const piece = bar(3);
  assert.ok(canPlace(board, piece, 5, 0));
  assert.ok(!canPlace(board, piece, 6, 0));
  assert.ok(!canPlace(board, piece, -1, 0));
  board[idx(6, 2)] = card(5, 1);
  assert.ok(!canPlace(board, piece, 4, 2));
});

test('Setzen gibt einen Punkt pro Kästchen', () => {
  const game = emptyGame([bar(3), single(), single()]);
  const res = placePiece(game, 0, 0, 0, seededRng(1));
  assert.equal(res.points, 3);
  assert.equal(game.score, 3);
  assert.equal(game.tray[0], null);
  assert.equal(placePiece(game, 0, 0, 1, seededRng(1)), null, 'leerer Platz kann nicht gesetzt werden');
});

test('volle Reihe wird als Pokerhand gewertet und abgeräumt', () => {
  const game = emptyGame([single(card(14, 1)), single(), single()]);
  // Reihe 0: K D B 10 von Herz + Füllkarten, das Ass fehlt noch → Royal Flush
  [card(13, 1), card(12, 1), card(11, 1), card(10, 1), card(2, 0), card(3, 2), card(4, 3)].forEach((c, x) => (game.board[idx(x, 0)] = c));
  game.board[idx(0, 5)] = card(9, 0); // damit das Feld danach nicht leer ist
  const res = placePiece(game, 0, 7, 0, seededRng(1));
  assert.equal(res.lines.length, 1);
  assert.equal(res.lines[0].hand.id, 'royal-flush');
  assert.equal(res.points, 1 + CELL_POINTS * SIZE * 50);
  assert.ok(Array.from({ length: 8 }, (_, x) => game.board[idx(x, 0)]).every((c) => c === null));
  assert.equal(game.bestHand, 9);
  assert.equal(res.tableClear, false);
});

test('Reihe und Spalte gleichzeitig: Kombo verdoppelt, Feld leer gibt Bonus', () => {
  const game = emptyGame([single(card(2, 3)), single(), single()]);
  for (let k = 0; k < 7; k++) {
    game.board[idx(k, 7)] = card(2 + k, 0);
    game.board[idx(7, k)] = card(2 + k, 1);
  }
  const res = placePiece(game, 0, 7, 7, seededRng(1));
  assert.equal(res.lines.length, 2);
  assert.equal(res.combo, 2);
  assert.equal(res.tableClear, true);
  const lineSum = res.lines.reduce((sum, l) => sum + CELL_POINTS * SIZE * l.hand.mult, 0);
  assert.equal(res.points, 1 + lineSum * 2 + TABLE_CLEAR_BONUS);
});

test('Serie steigt beim Abräumen und endet nach mehreren Zügen ohne', () => {
  const game = emptyGame([single(), single(), single()]);
  game.streak = 2;
  game.grace = STREAK_GRACE;
  for (let k = 0; k < STREAK_GRACE - 1; k++) {
    game.tray = [single(), single(), single()];
    placePiece(game, 0, k, 3, seededRng(1));
    assert.equal(game.streak, 2, 'Serie hält noch');
  }
  game.tray = [single(), single(), single()];
  placePiece(game, 0, 6, 3, seededRng(1));
  assert.equal(game.streak, 0);
});

test('Serie erhöht die Punkte', () => {
  const fillRow = (game) => {
    for (let x = 1; x < 8; x++) game.board[idx(x, 0)] = card(2 + x, x % 4);
    game.board[idx(0, 7)] = card(9, 0);
  };
  const a = emptyGame([single(), single(), single()]);
  fillRow(a);
  const plain = placePiece(a, 0, 0, 0, seededRng(1)).points;
  const b = emptyGame([single(), single(), single()]);
  fillRow(b);
  b.streak = 2;
  b.grace = STREAK_GRACE;
  const boosted = placePiece(b, 0, 0, 0, seededRng(1)).points;
  assert.equal(b.streak, 3);
  assert.equal(boosted - 1, (plain - 1) * 2); // Serie 3 → ×2
});

test('nach drei gesetzten Teilen kommen drei neue', () => {
  const game = emptyGame([single(), null, null]);
  const res = placePiece(game, 0, 0, 0, seededRng(5));
  assert.equal(res.dealt, true);
  assert.equal(game.tray.filter(Boolean).length, 3);
});

test('Spielende, wenn kein Teil mehr passt', () => {
  // Schachbrett: nur einzelne Lücken, keine Reihe ist voll
  const game = emptyGame([single(), bar(2), null]);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if ((x + y) % 2) game.board[idx(x, y)] = card(4, 1);
  assert.ok(fitsAnywhere(game.board, single()));
  assert.ok(!fitsAnywhere(game.board, bar(2)));
  const res = placePiece(game, 0, 0, 0, seededRng(3));
  assert.equal(res.over, true);
  assert.equal(game.over, true);
  assert.equal(placePiece(game, 1, 2, 0, seededRng(3)), null, 'nach dem Ende keine Züge mehr');
});

test('findFullLines markiert die Karten der Hand', () => {
  const board = new Array(64).fill(null);
  [card(9, 0), card(9, 1), card(2, 2), card(3, 3), card(5, 0), card(7, 1), card(11, 2), card(13, 3)].forEach((c, x) => (board[idx(x, 2)] = c));
  const [line] = findFullLines(board);
  assert.equal(line.hand.id, 'pair');
  assert.deepEqual([...line.handCells].sort((a, b) => a - b), [idx(0, 2), idx(1, 2)]);
});
