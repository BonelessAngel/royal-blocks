import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CELL_POINTS, POWER_COSTS, REQUIREMENTS, SIZE, STREAK_GRACE, TABLE_CLEAR_BONUS, canPlace, createGame, findFullLines, fitsAnywhere, idx, placePiece,
  blastAt, foldTray, missionText, previewPlacement, recolorPiece, requirementFor,
} from '../src/game.js';
import { SHAPES, randomPiece, seededRng } from '../src/pieces.js';
import { FEVER_MOVES, FEVER_STREAK, GOLD_CHIPS, HELP, LOCK_MOVES, dealTray, lineHints, newMission as newMissionFor, useFreeContinue } from '../src/game.js';

const card = (r, s) => ({ r, s });
const single = (c = card(2, 0)) => ({ shape: 0, w: 1, h: 1, cells: [[0, 0]], cards: [c] });
const bar = (len) => ({ shape: 99, w: len, h: 1, cells: Array.from({ length: len }, (_, x) => [x, 0]), cards: Array.from({ length: len }, (_, x) => card(2 + x, x % 4)) });

function emptyGame(tray) {
  return {
    mode: 'free', day: null, rng: 1, board: new Array(SIZE * SIZE).fill(null), tray, score: 0, streak: 0, grace: 0, moves: 0, lines: 0,
    bestHand: -1, chips: 0, mission: null, missionsDone: 0, over: false,
  };
}

test('alle Formen sind gültig', () => {
  for (const shape of SHAPES) {
    assert.ok(shape.cells.length > 0);
    for (const [x, y] of shape.cells) assert.ok(x < shape.w && y < shape.h);
    assert.ok(shape.cells.some(([x]) => x === shape.w - 1) && shape.cells.some(([, y]) => y === shape.h - 1));
  }
});

test('neues Spiel: leeres Feld und drei Teile mit Karten', () => {
  const game = createGame(1);
  assert.equal(game.board.length, 64);
  assert.ok(game.board.every((c) => c === null));
  assert.equal(game.tray.length, 3);
  for (const piece of game.tray) assert.equal(piece.cards.length, piece.cells.length);
  assert.equal(game.over, false);
});

test('gleicher Startwert ergibt gleiches Spiel', () => {
  assert.deepEqual(createGame(42), createGame(42));
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
  const res = placePiece(game, 0, 0, 0);
  assert.equal(res.points, 3);
  assert.equal(game.score, 3);
  assert.equal(game.tray[0], null);
  assert.equal(placePiece(game, 0, 0, 1), null, 'leerer Platz kann nicht gesetzt werden');
});

test('volle Reihe wird als Pokerhand gewertet und abgeräumt', () => {
  const game = emptyGame([single(card(14, 1)), single(), single()]);
  // Reihe 0: K D B 10 von Herz + Füllkarten, das Ass fehlt noch → Royal Flush
  [card(13, 1), card(12, 1), card(11, 1), card(10, 1), card(2, 0), card(3, 2), card(4, 3)].forEach((c, x) => (game.board[idx(x, 0)] = c));
  game.board[idx(0, 5)] = card(9, 0); // damit das Feld danach nicht leer ist
  const res = placePiece(game, 0, 7, 0);
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
  const res = placePiece(game, 0, 7, 7);
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
    placePiece(game, 0, k, 3);
    assert.equal(game.streak, 2, 'Serie hält noch');
  }
  game.tray = [single(), single(), single()];
  placePiece(game, 0, 6, 3);
  assert.equal(game.streak, 0);
});

test('Serie erhöht die Punkte', () => {
  const fillRow = (game) => {
    for (let x = 1; x < 8; x++) game.board[idx(x, 0)] = card(2 + x, x % 4);
    game.board[idx(0, 7)] = card(9, 0);
  };
  const a = emptyGame([single(), single(), single()]);
  fillRow(a);
  const plain = placePiece(a, 0, 0, 0).points;
  const b = emptyGame([single(), single(), single()]);
  fillRow(b);
  b.streak = 2;
  b.grace = STREAK_GRACE;
  const boosted = placePiece(b, 0, 0, 0).points;
  assert.equal(b.streak, 3);
  assert.equal(boosted - 1, (plain - 1) * 2); // Serie 3 → ×2
});

test('nach drei gesetzten Teilen kommen drei neue', () => {
  const game = emptyGame([single(), null, null]);
  const res = placePiece(game, 0, 0, 0);
  assert.equal(res.dealt, true);
  assert.equal(game.tray.filter(Boolean).length, 3);
});

test('Spielende, wenn kein Teil mehr passt', () => {
  // Schachbrett: nur einzelne Lücken, keine Reihe ist voll
  const game = emptyGame([single(), bar(2), null]);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if ((x + y) % 2) game.board[idx(x, y)] = card(4, 1);
  assert.ok(fitsAnywhere(game.board, single()));
  assert.ok(!fitsAnywhere(game.board, bar(2)));
  const res = placePiece(game, 0, 0, 0);
  assert.equal(res.over, true);
  assert.equal(game.over, true);
  assert.equal(placePiece(game, 1, 2, 0), null, 'nach dem Ende keine Züge mehr');
});

test('findFullLines markiert die Karten der Hand', () => {
  const board = new Array(64).fill(null);
  [card(9, 0), card(9, 1), card(2, 2), card(3, 3), card(5, 0), card(7, 1), card(11, 2), card(13, 3)].forEach((c, x) => (board[idx(x, 2)] = c));
  const [line] = findFullLines(board);
  assert.equal(line.hand.id, 'pair');
  assert.deepEqual([...line.handCells].sort((a, b) => a - b), [idx(0, 2), idx(1, 2)]);
});

test('jedes Teil hat genau eine Farbe', () => {
  const rng = seededRng(9);
  for (let k = 0; k < 200; k++) {
    const piece = randomPiece(rng);
    assert.ok(new Set(piece.cards.filter((c) => !c.j).map((c) => c.s)).size <= 1);
    assert.ok(piece.cards.filter((c) => !c.j).every((c) => c.s === piece.s));
  }
});

test('Mindesthand steigt mit den abgeräumten Reihen', () => {
  assert.equal(requirementFor(0).level, 1);
  for (const step of REQUIREMENTS) assert.equal(requirementFor(step.lines).level, step.level);
  assert.equal(requirementFor(REQUIREMENTS[1].lines - 1).level, REQUIREMENTS[0].level);
  assert.deepEqual(requirementFor(0).next, REQUIREMENTS[1]);
  assert.equal(requirementFor(9999).next, null);
  for (let k = 1; k < REQUIREMENTS.length; k++) {
    assert.ok(REQUIREMENTS[k].lines > REQUIREMENTS[k - 1].lines && REQUIREMENTS[k].level > REQUIREMENTS[k - 1].level);
  }
});

// Reihe 0 mit lauter verschiedenen Werten und Farben → nur "Hohe Karte"
const weakRow = [card(2, 0), card(4, 1), card(6, 2), card(8, 3), card(10, 0), card(12, 1), card(3, 2)];

test('zu schwache Reihe bleibt gesperrt liegen', () => {
  const game = emptyGame([single(card(13, 3)), single(), single()]);
  weakRow.forEach((c, x) => (game.board[idx(x, 0)] = c));
  const res = placePiece(game, 0, 7, 0);
  assert.equal(res.lines.length, 0);
  assert.equal(res.blocked.length, 1);
  assert.equal(res.blocked[0].hand.id, 'high');
  assert.ok(Array.from({ length: 8 }, (_, x) => game.board[idx(x, 0)]).every(Boolean), 'Reihe ist noch da');
  assert.equal(game.lines, 0);
  assert.equal(res.points, 1);
});

test('Vorschau meldet, ob die Hand reicht', () => {
  const game = emptyGame([single(card(13, 3)), single(card(2, 3)), single()]);
  weakRow.forEach((c, x) => (game.board[idx(x, 0)] = c));
  const [weak] = previewPlacement(game, game.tray[0], 7, 0);
  assert.equal(weak.ok, false);
  const [pair] = previewPlacement(game, game.tray[1], 7, 0);
  assert.equal(pair.hand.id, 'pair');
  assert.equal(pair.ok, true);
});

test('höhere Mindesthand sperrt ein Paar', () => {
  const game = emptyGame([single(card(2, 3)), single(), single()]);
  game.lines = REQUIREMENTS[1].lines; // Zwei Paare nötig
  weakRow.forEach((c, x) => (game.board[idx(x, 0)] = c));
  const res = placePiece(game, 0, 7, 0);
  assert.equal(res.blocked.length, 1);
  assert.equal(res.blocked[0].hand.id, 'pair');
});

test('eine quer abgeräumte Reihe öffnet die gesperrte Reihe wieder', () => {
  const game = emptyGame([single(card(9, 1)), single(), single()]);
  // gesperrte Reihe 0
  weakRow.forEach((c, x) => (game.board[idx(x, 0)] = c));
  game.board[idx(7, 0)] = card(13, 3);
  // Spalte 7 fast voll mit Herz → Flush, wenn Feld (7,7) gesetzt wird
  for (let y = 1; y < 7; y++) game.board[idx(7, y)] = card(2 + y, 1);
  const res = placePiece(game, 0, 7, 7);
  assert.equal(res.lines.length, 1);
  assert.equal(res.lines[0].type, 'col');
  assert.equal(game.board[idx(7, 0)], null, 'Lücke in der gesperrten Reihe');
  assert.equal(res.blocked.length, 0, 'alte gesperrte Reihe wird nicht erneut gemeldet');
});

test('Aufstieg der Mindesthand wird gemeldet', () => {
  const game = emptyGame([single(card(14, 3)), single(), single()]);
  game.lines = REQUIREMENTS[1].lines - 1;
  [card(14, 0), card(14, 1), card(5, 2), card(5, 3), card(9, 0), card(11, 1), card(3, 2)].forEach((c, x) => (game.board[idx(x, 0)] = c));
  game.board[idx(0, 5)] = card(7, 0);
  const res = placePiece(game, 0, 7, 0);
  assert.equal(res.lines.length, 1);
  assert.equal(res.levelUp, true);
});

test('der Zufall steckt im Spielstand: gespeichert und geladen geht es gleich weiter', () => {
  const a = createGame(777, 'daily', '2026-10-21');
  const b = JSON.parse(JSON.stringify(a));
  assert.deepEqual(foldTray(a) && a.tray, foldTray(b) && b.tray);
});

test('Joker kommen vor, aber selten', () => {
  const rng = seededRng(3);
  let jokers = 0;
  for (let k = 0; k < 5000; k++) if (randomPiece(rng).cards.some((c) => c.j)) jokers++;
  assert.ok(jokers > 120 && jokers < 300, `${jokers} von 5000`);
});

test('Joker in einer Reihe macht die beste Hand', () => {
  const game = emptyGame([single({ j: 1 }), single(), single()]);
  [card(10, 1), card(11, 1), card(12, 1), card(13, 1), card(2, 0), card(5, 2), card(7, 3)].forEach((c, x) => (game.board[idx(x, 0)] = c));
  game.board[idx(0, 5)] = card(9, 0);
  const res = placePiece(game, 0, 7, 0);
  assert.equal(res.lines[0].hand.id, 'royal-flush');
  assert.ok(res.lines[0].handCells.includes(idx(7, 0)), 'Joker gehört zur Hand');
});

test('Chips: Faktor der Hand pro Reihe, plus Auftrag', () => {
  const game = emptyGame([single(card(14, 3)), single(), single()]);
  game.mission = { kind: 'hand', level: 1, reward: 20 };
  [card(14, 0), card(4, 1), card(6, 2), card(8, 3), card(10, 0), card(12, 1), card(3, 2)].forEach((c, x) => (game.board[idx(x, 0)] = c));
  game.board[idx(0, 5)] = card(9, 0);
  const res = placePiece(game, 0, 7, 0);
  assert.equal(res.lines[0].hand.id, 'pair');
  assert.equal(res.mission.reward, 20);
  assert.equal(res.chips, 2 + 20);
  assert.equal(game.chips, 22);
  assert.equal(game.missionsDone, 1);
  assert.ok(game.mission && missionText(game.mission).length > 0, 'neuer Auftrag');
});

test('Auftrag "Flush in Farbe" zählt nur die richtige Farbe', () => {
  const setup = (suit) => {
    const game = emptyGame([single(card(14, suit)), single(), single()]);
    game.mission = { kind: 'flush', suit: 1, reward: 40 };
    [card(2, suit), card(5, suit), card(8, suit), card(11, suit), card(3, 0), card(6, 2), card(9, 3)].forEach((c, x) => (game.board[idx(x, 0)] = c));
    game.board[idx(0, 5)] = card(9, 0);
    return placePiece(game, 0, 7, 0);
  };
  assert.equal(setup(1).mission?.kind, 'flush');
  assert.equal(setup(2).mission, null);
});

test('Aufträge sind beschreibbar und werden schwerer', () => {
  const state = { rng: 5, missionsDone: 0 };
  for (let k = 0; k < 200; k++) {
    const m = newMissionFor(state);
    assert.ok(m.reward > 0);
    assert.ok(missionText(m).length > 3);
    if (m.kind === 'hand') assert.ok(m.level <= Math.min(7, 3 + Math.floor(state.missionsDone / 2)));
    state.missionsDone = Math.floor(k / 20);
  }
});

test('"Fast!" meldet einen knapp verpassten Flush', () => {
  const game = emptyGame([single(card(13, 0)), single(), single()]);
  game.lines = 0;
  [card(2, 1), card(6, 1), card(9, 1), card(12, 1), card(3, 0), card(5, 2), card(13, 3)].forEach((c, x) => (game.board[idx(x, 0)] = c));
  game.board[idx(0, 5)] = card(9, 0);
  const res = placePiece(game, 0, 7, 0);
  assert.equal(res.lines[0].hand.id, 'pair');
  assert.equal(res.near?.id, 'flush');
});

test('Spezialzüge: Sprengen, Farbe tauschen, Passen', () => {
  assert.ok(POWER_COSTS.fold > 0 && POWER_COSTS.blast > 0 && POWER_COSTS.recolor > 0);
  const game = emptyGame([bar(3), single(), single()]);
  weakRow.forEach((c, x) => (game.board[idx(x, 0)] = c));
  game.board[idx(7, 0)] = card(13, 3);
  assert.equal(blastAt(game, idx(3, 3)), null, 'kein gesperrtes Kästchen');
  const blast = blastAt(game, idx(3, 0));
  assert.equal(blast.removed.size, 8);
  assert.ok(game.board.every((c) => c === null));

  assert.equal(recolorPiece(game, 0, 2), true);
  assert.ok(game.tray[0].cards.every((c) => c.s === 2) && game.tray[0].s === 2);
  assert.equal(recolorPiece(game, 0, 2), false, 'gleiche Farbe ändert nichts');

  const before = JSON.stringify(game.tray);
  foldTray(game);
  assert.notEqual(JSON.stringify(game.tray), before);
  assert.equal(game.tray.filter(Boolean).length, 3);
});

test('Spielende lässt sich mit einem Spezialzug abwenden', () => {
  const game = emptyGame([null, bar(2), null]);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if ((x + y) % 2) game.board[idx(x, y)] = card(4, 1);
  // eine gesperrte Reihe ganz unten
  weakRow.forEach((c, x) => (game.board[idx(x, 7)] = c));
  game.board[idx(7, 7)] = card(13, 3);
  game.over = true;
  blastAt(game, idx(0, 7));
  assert.equal(game.over, false, 'nach dem Sprengen passt das Teil wieder');
});

test('Hinweise kommen nur aus fast vollen Reihen', () => {
  const board = new Array(64).fill(null);
  // Reihe 0: 6 Karten (fast voll), Reihe 4: nur 2 Karten
  for (let x = 0; x < 6; x++) board[idx(x, 0)] = card(7, 2);
  board[idx(0, 4)] = card(13, 0);
  board[idx(1, 4)] = card(13, 0);
  const hints = lineHints(board);
  assert.ok(hints.ranks.length >= 6 && hints.ranks.every((r) => r === 7 || r === 13));
  assert.ok(hints.ranks.filter((r) => r === 7).length >= 6);
  assert.ok(hints.suits.includes(2));
});

test('hilfreiches Austeilen gibt öfter Teile, die eine Reihe abräumen', () => {
  // Reihe 7 bis auf ein Feld voll, mit einem Paar Asse → jedes Teil, das passt, räumt ab
  const board = new Array(64).fill(null);
  [card(14, 0), card(14, 1), card(3, 2), card(5, 3), card(7, 0), card(9, 1), card(11, 2)].forEach((c, x) => (board[idx(x, 7)] = c));
  for (let y = 0; y < 7; y++) for (let x = 0; x < 8; x++) if (x !== 7 && (x + y) % 2) board[idx(x, y)] = card(2, 0);
  const canClear = (tray) => tray.some((p) => p.cells.length === 1 || (p.w === 1 && p.cells.length <= 8));
  const count = (chance) => {
    HELP.chance = chance;
    let hits = 0;
    for (let s = 1; s <= 150; s++) if (canClear(dealTray(board, seededRng(s), 1))) hits++;
    return hits;
  };
  const without = count(0);
  const withHelp = count(1);
  HELP.chance = 0.6;
  assert.ok(withHelp > without, `${withHelp} mit Hilfe, ${without} ohne`);
});

test('gesperrte Reihe zerbröselt nach einigen Zügen', () => {
  const game = emptyGame([single(card(13, 3)), single(), single()]);
  game.locked = {};
  weakRow.forEach((c, x) => (game.board[idx(x, 0)] = c));
  placePiece(game, 0, 7, 0);
  assert.equal(game.locked['row:0'], LOCK_MOVES);
  let crumbled = null;
  for (let k = 0; k < LOCK_MOVES; k++) {
    game.tray = [single(), single(), single()];
    const res = placePiece(game, 0, k, 4);
    if (res.crumbled) crumbled = { res, k };
  }
  assert.ok(crumbled, 'Reihe ist zerbröselt');
  assert.equal(crumbled.k, LOCK_MOVES - 1);
  assert.equal(crumbled.res.crumbled.removed.size, 8);
  assert.ok(Array.from({ length: 8 }, (_, x) => game.board[idx(x, 0)]).every((c) => c === null));
  assert.deepEqual(game.locked, {});
});

test('einmal pro Runde gratis weiterspielen', () => {
  const game = createGame(3);
  assert.equal(useFreeContinue(game), true);
  assert.equal(game.tray.filter(Boolean).length, 3);
  assert.equal(useFreeContinue(game), false);
});

test('Mindesthand endet bei Zwei Paaren (Casual)', () => {
  assert.equal(requirementFor(100000).level, 2);
});

const pairRow = (game) => {
  [card(14, 0), card(14, 1), card(5, 2), card(7, 3), card(9, 0), card(11, 1), card(3, 2)].forEach((c, x) => (game.board[idx(x, 0)] = c));
  game.board[idx(0, 5)] = card(9, 0);
};

test('goldene Karte verdoppelt die Punkte der Reihe und bringt Chips', () => {
  const plain = emptyGame([single(card(2, 3)), single(), single()]);
  pairRow(plain);
  const a = placePiece(plain, 0, 7, 0);
  const gold = emptyGame([single({ r: 2, s: 3, g: 1 }), single(), single()]);
  pairRow(gold);
  const b = placePiece(gold, 0, 7, 0);
  assert.equal(b.golden, 1);
  assert.equal(b.points - 1, (a.points - 1) * 2);
  assert.equal(b.chips, a.chips + GOLD_CHIPS);
});

test('Fieber startet bei Serie 5 und verdoppelt einige Züge lang', () => {
  const game = emptyGame([single(card(2, 3)), single(), single()]);
  game.streak = FEVER_STREAK - 1;
  game.grace = STREAK_GRACE;
  pairRow(game);
  const res = placePiece(game, 0, 7, 0);
  assert.equal(res.feverStart, true);
  assert.equal(res.feverMult, 2);
  assert.equal(game.fever, FEVER_MOVES);
  let ended = false;
  for (let k = 0; k < FEVER_MOVES; k++) {
    game.tray = [single(), single(), single()];
    const r = placePiece(game, 0, k, 3);
    assert.equal(r.feverMult, 2);
    if (r.feverEnd) ended = true;
  }
  assert.equal(game.fever, 0);
  assert.ok(ended);
});

test('Farbe tauschen behält die goldene Karte', () => {
  const game = emptyGame([{ shape: 1, w: 2, h: 1, s: 0, cells: [[0, 0], [1, 0]], cards: [{ r: 5, s: 0, g: 1 }, { r: 6, s: 0 }] }, null, null]);
  recolorPiece(game, 0, 2);
  assert.deepEqual(game.tray[0].cards[0], { r: 5, s: 2, g: 1 });
});
