// Wie lange dauert es, bis man im Casino-Shop alles hat?
// 1) Ein einfacher Bot spielt echte Runden (Regeln aus src/game.js) und misst Chips, Punkte und Züge pro Runde.
// 2) Simulierte Spieler sammeln Tag für Tag Chips (Runden, Truhe am Rundenende, Level, Tagesgeschenk, Glücksrad,
//    Rubbellose) und kaufen: erst alles direkt Kaufbare (günstigstes zuerst), dann Gold-Truhen für Legendäres.
// Aufruf: node scripts/simulation-shop.mjs [Runden für den Bot]

import { createGame, canPlace, placePiece, previewPlacement, useFreeContinue } from '../src/game.js';
import { chestReward, dailyGift, levelFromXp, levelReward, scratchPrize, SCRATCH_EVERY, xpForRound, jackpotWin, JACKPOT_START, JACKPOT_GROWTH } from '../src/progress.js';
import { ALL_ITEMS, FREE_ITEMS, SETS, buyable, setBonus, setProgress } from '../src/shop.js';
import { CHESTS, WHEEL, WHEEL_TOTAL, openChestRoll, spinWheel, ticketPrize, withCharm } from '../src/casino.js';

const SECONDS_PER_MOVE = 4; // gemütliches Tempo am Handy
// Wie „menschlich“ der Bot spielt: Zufallsanteil bei der Bewertung (größer = mehr Fehler). Eingestellt auf echte Runden.
const NOISE = Number(process.env.NOISE ?? 120);

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0) / 2 ** 32;
}

// Bot: bewertet jede mögliche Stelle für jedes Teil und nimmt die beste
function bestMove(state) {
  let best = null;
  state.tray.forEach((piece, slot) => {
    if (!piece) return;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (!canPlace(state.board, piece, x, y)) continue;
        const lines = previewPlacement(state, piece, x, y) ?? [];
        let value = 0;
        for (const line of lines) value += line.ok ? 40 + line.hand.mult * 25 : -60;
        if (lines.filter((l) => l.ok).length > 1) value += 80;
        // Nachbarn: lieber kompakt bauen als Löcher lassen
        for (const [dx, dy] of piece.cells) {
          for (const [nx, ny] of [[x + dx + 1, y + dy], [x + dx - 1, y + dy], [x + dx, y + dy + 1], [x + dx, y + dy - 1]]) {
            if (nx < 0 || ny < 0 || nx > 7 || ny > 7 || state.board[ny * 8 + nx]) value += 2;
          }
        }
        value += Math.random() * NOISE;
        if (!best || value > best.value) best = { slot, x, y, value };
      }
    }
  });
  return best;
}

function playRound(seed) {
  const state = createGame(seed, 'free');
  const hands = [];
  let freeUsed = false;
  while (true) {
    if (state.over) {
      if (!freeUsed && useFreeContinue(state)) { freeUsed = true; continue; }
      break;
    }
    const move = bestMove(state);
    if (!move) break;
    const res = placePiece(state, move.slot, move.x, move.y);
    if (!res) break;
    for (const line of res.lines) hands.push(line.hand.level);
    if (state.moves > 2000) break;
  }
  return { score: state.score, lines: state.lines, chips: state.chips, moves: state.moves, hands };
}

// ---------- 1) Runden messen ----------
const ROUNDS = Number(process.argv[2]) || 120;
const rounds = [];
const t0 = Date.now();
for (let k = 0; k < ROUNDS; k++) rounds.push(playRound(1000 + k));
const avg = (key) => rounds.reduce((s, r) => s + r[key], 0) / rounds.length;
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
console.log(`Bot: ${ROUNDS} Runden in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`  Ø Punkte ${Math.round(avg('score'))}, Ø Reihen ${avg('lines').toFixed(1)}, Ø Züge ${Math.round(avg('moves'))}` +
  ` (≈ ${Math.round((avg('moves') * SECONDS_PER_MOVE) / 60)} min), Ø Chips in der Runde ${Math.round(avg('chips'))}, Median Punkte ${median(rounds.map((r) => r.score))}`);

// ---------- 2) Spieler simulieren ----------
const everything = ALL_ITEMS.filter((item) => item.kind !== 'extras');
const wheelEV = WHEEL.reduce((s, f) => s + (f.chips ?? 0) * f.weight, 0) / WHEEL_TOTAL;

function simulatePlayer(roundsPerDay, rand) {
  const owned = new Set(FREE_ITEMS);
  let wallet = 0;
  let xp = 0;
  let games = 0;
  let jackpot = JACKPOT_START;
  let gift = null;
  let charm = 'charm-none';
  let spent = 0;
  let minutes = 0;
  const milestones = {};
  const day = (d) => {
    const date = new Date(Date.UTC(2026, 0, 1) + d * 86400000);
    return date.toISOString().slice(0, 10);
  };
  const ownsAll = () => everything.every((item) => owned.has(item.id));
  const giveChest = (type) => {
    const r = openChestRoll(type, owned, rand);
    if (r.duplicate) wallet += r.chips;
    else owned.add(r.item.id);
  };
  for (let d = 0; d < 3650; d++) {
    // Tagesgeschenk und Glücksrad
    const g = dailyGift(gift, day(d));
    gift = { day: g.day, streak: g.streak };
    wallet += g.chips;
    const field = WHEEL[spinWheel(rand)];
    if (field.chips) wallet += field.chips;
    else if (field.chest) giveChest(field.chest);
    else if (field.ticket) wallet += ticketPrize(field.ticket, rand).chips;
    for (let k = 0; k < roundsPerDay; k++) {
      const round = rounds[Math.floor(rand() * rounds.length)];
      minutes += (round.moves * SECONDS_PER_MOVE) / 60;
      wallet += withCharm(round.chips, charm);
      for (const level of round.hands) {
        const win = jackpotWin(level, jackpot);
        if (win) { wallet += win; jackpot = level >= 9 ? JACKPOT_START : jackpot - win; }
      }
      wallet += withCharm(chestReward(round, rand).chips, charm);
      const before = levelFromXp(xp).level;
      xp += xpForRound(round);
      for (let level = before + 1; level <= levelFromXp(xp).level; level++) {
        const lr = levelReward(level);
        wallet += lr.chips;
        if (lr.design) {
          const gift5 = everything.filter((i) => buyable(i) && !owned.has(i.id) && i.kind !== 'charms').sort((a, b) => a.price - b.price)[0];
          if (gift5) owned.add(gift5.id);
          else wallet += 250;
        }
      }
      games++;
      jackpot += JACKPOT_GROWTH;
      if (games % SCRATCH_EVERY === 0) wallet += scratchPrize(rand).chips;
    }
    // Einkaufen: Glücksbringer zuerst (bringt mehr Chips), dann alles Kaufbare, günstigstes zuerst
    const shopping = everything.filter((i) => buyable(i) && !owned.has(i.id))
      .sort((a, b) => (a.kind === 'charms' ? -1 : 0) - (b.kind === 'charms' ? -1 : 0) || a.price - b.price);
    for (const item of shopping) {
      if (wallet < item.price) break;
      wallet -= item.price;
      spent += item.price;
      owned.add(item.id);
      if (item.kind === 'charms' && item.bonus_chips > (ALL_ITEMS.find((c) => c.id === charm)?.bonus_chips ?? 0)) charm = item.id;
    }
    const legendaryLeft = everything.some((i) => i.rarity === 'legendary' && !i.bonus && !owned.has(i.id));
    if (!shopping.some((i) => !owned.has(i.id)) && legendaryLeft) {
      while (wallet >= CHESTS.gold.price && everything.some((i) => i.rarity === 'legendary' && !i.bonus && !owned.has(i.id))) {
        wallet -= CHESTS.gold.price;
        spent += CHESTS.gold.price;
        giveChest('gold');
      }
    }
    if (owned.has('charm-dice')) charm = 'charm-dice';
    // Sets abholen
    for (const id of Object.keys(SETS)) if (setProgress(id, owned).complete) owned.add(setBonus(id).id);
    const buyableDone = everything.filter(buyable).every((i) => owned.has(i.id));
    if (buyableDone && !milestones.buyable) milestones.buyable = { days: d + 1, games, hours: minutes / 60 };
    if (spent >= 50_000 && !milestones.highroller) milestones.highroller = { days: d + 1, games, hours: minutes / 60 };
    if (ownsAll()) return { ...milestones, all: { days: d + 1, games, hours: minutes / 60 } };
  }
  return { ...milestones, all: null };
}

console.log(`\nKatalog: ${everything.length} Sachen, davon ${everything.filter(buyable).length} direkt kaufbar ` +
  `(zusammen ${everything.filter(buyable).reduce((s, i) => s + i.price, 0).toLocaleString('de-DE')} Chips), ` +
  `${everything.filter((i) => i.rarity === 'legendary' && !i.bonus).length} nur aus Truhen, ${Object.keys(SETS).length} Set-Boni. Glücksrad Ø ${Math.round(wheelEV)} Chips + Truhen/Lose.`);

const fmtStep = (m) => (m ? `${m.days} Tage · ${m.games} Runden · ${Math.round(m.hours)} Std.` : '–');
for (const perDay of [3, 8, 15, 30]) {
  const results = Array.from({ length: 200 }, (_, k) => simulatePlayer(perDay, seeded(77 + k * 13)));
  const pick = (key) => {
    const list = results.map((r) => r[key]).filter(Boolean);
    return list.length ? { days: median(list.map((m) => m.days)), games: median(list.map((m) => m.games)), hours: median(list.map((m) => m.hours)) } : null;
  };
  console.log(`\n${perDay} Runden pro Tag (Median aus 200 Spielern):`);
  console.log(`  alles Kaufbare:  ${fmtStep(pick('buyable'))}`);
  console.log(`  Highroller:      ${fmtStep(pick('highroller'))}`);
  console.log(`  wirklich alles:  ${fmtStep(pick('all'))}`);
}
