import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ALL_ITEMS, CHARMS, FREE_ITEMS, RARITY, SETS, SHOP_ITEMS, SHOP_LABELS, SHOP_SETTING, START_BONUS, THEMES, TILE_STYLES,
  buyable, setBonus, setItems, setProgress,
} from '../src/shop.js';
import {
  CHESTS, SLOT_BETS, SLOT_DAILY_SPINS, TICKETS, TICKET_ODDS, WHEEL, WHEEL_TOTAL, casinoDay, charmBonus, dropPool, openChestRoll,
  rollRarity, slotResult, slotReturn, spinSlot, spinWheel, ticketPrize, wheelAngle, withCharm,
} from '../src/casino.js';

// Zufallsfolge zum Nachrechnen
function seq(...values) {
  let i = 0;
  return () => values[i++ % values.length];
}
function seeded(seed = 1) {
  let s = seed;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0) / 2 ** 32;
}

test('bestehende Shop-IDs und Preise bleiben erhalten (alte Käufe gehen nicht verloren)', () => {
  assert.deepEqual(THEMES.slice(0, 4).map((item) => [item.id, item.price]), [['neon', 0], ['gold', 2100], ['ice', 4200], ['retro', 7000]]);
  assert.deepEqual(TILE_STYLES.slice(0, 4).map((item) => [item.id, item.price]), [['standard', 0], ['glass', 1400], ['pixel', 2800], ['chip', 5600]]);
  for (const id of ['effect-confetti', 'effect-pixel', 'effect-fireworks', 'effect-sparks', 'bg-felt', 'bg-stars', 'bg-royal', 'card-casino', 'card-minimal', 'card-neon']) {
    assert.ok(ALL_ITEMS.some((item) => item.id === id), `${id} fehlt`);
  }
  assert.equal(START_BONUS.price, 350);
});

test('Katalog: eindeutige IDs, jeder Bereich hat Name, Einstellung und einen Gratis-Artikel', () => {
  const ids = ALL_ITEMS.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, 'IDs doppelt');
  for (const kind of Object.keys(SHOP_ITEMS)) {
    assert.ok(SHOP_LABELS[kind], `${kind} ohne Namen`);
    if (kind === 'extras') continue;
    assert.ok(SHOP_SETTING[kind], `${kind} ohne Einstellung`);
    assert.ok(SHOP_ITEMS[kind].some((item) => FREE_ITEMS.includes(item.id)), `${kind} ohne Gratis-Artikel`);
  }
  for (const item of ALL_ITEMS) {
    if (item.rarity) assert.ok(RARITY[item.rarity], `${item.id}: unbekannte Seltenheit`);
    if (item.set) assert.ok(SETS[item.set], `${item.id}: unbekanntes Set`);
  }
});

test('Legendäres und Set-Boni kann man nicht direkt kaufen', () => {
  for (const item of ALL_ITEMS) {
    if (item.rarity === 'legendary' || item.bonus) assert.equal(buyable(item), false, item.id);
    if (item.price > 0 && item.rarity !== 'legendary' && !item.bonus) assert.equal(buyable(item), true, item.id);
  }
  assert.ok(ALL_ITEMS.filter((item) => item.rarity === 'legendary' && !item.bonus).length >= 5);
});

test('Sammelalbum: jedes Set hat genau einen Bonus und lässt sich vervollständigen', () => {
  for (const id of Object.keys(SETS)) {
    assert.ok(setItems(id).length >= 5, `${id} hat zu wenig Teile`);
    assert.ok(setBonus(id), `${id} ohne Bonus`);
    assert.ok(setItems(id).every((item) => buyable(item) || dropPool(item.rarity).includes(item)), `${id}: Teil nicht erhältlich`);
    const owned = new Set(setItems(id).slice(1).map((item) => item.id));
    assert.equal(setProgress(id, owned).complete, false);
    owned.add(setItems(id)[0].id);
    assert.deepEqual(setProgress(id, owned), { have: setItems(id).length, total: setItems(id).length, complete: true });
  }
});

test('Truhen: Chancen ergeben 100 %, Gold garantiert mindestens Episch, Doppeltes wird zu Chips', () => {
  for (const chest of Object.values(CHESTS)) {
    assert.ok(Math.abs(Object.values(chest.odds).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  }
  assert.deepEqual(Object.keys(CHESTS.gold.odds), ['epic', 'legendary']);
  assert.equal(rollRarity(CHESTS.bronze.odds, () => 0.69), 'common');
  assert.equal(rollRarity(CHESTS.bronze.odds, () => 0.71), 'rare');
  assert.equal(rollRarity(CHESTS.bronze.odds, () => 0.99), 'epic');

  const first = openChestRoll('gold', new Set(), seq(0.9, 0));
  assert.equal(first.rarity, 'legendary');
  assert.equal(first.duplicate, false);
  assert.equal(first.chips, 0);
  const again = openChestRoll('gold', new Set([first.item.id]), seq(0.9, 0));
  assert.equal(again.duplicate, true);
  assert.equal(again.chips, RARITY.legendary.dupe);
  // Truhen geben nie Gratis-Artikel, Extras oder Set-Boni
  const rand = seeded(7);
  for (let k = 0; k < 500; k++) {
    const r = openChestRoll(['bronze', 'silver', 'gold'][k % 3], new Set(), rand);
    assert.ok(r.item.rarity && !r.item.bonus && r.item.kind !== 'extras', r.item.id);
  }
});

test('Truhen lohnen sich nicht zum Chip-Vermehren (Wert doppelter Sachen unter dem Preis)', () => {
  for (const chest of Object.values(CHESTS)) {
    const dupeValue = Object.entries(chest.odds).reduce((sum, [rarity, p]) => sum + p * RARITY[rarity].dupe, 0);
    assert.ok(dupeValue < chest.price, `${chest.name}: ${dupeValue} ≥ ${chest.price}`);
  }
});

test('Rubbellose: Chancen ergeben 100 % und man verliert auf lange Sicht leicht', () => {
  assert.ok(Math.abs(TICKET_ODDS.reduce((s, r) => s + r.chance, 0) - 1) < 1e-9);
  const expected = TICKET_ODDS.reduce((s, r) => s + r.chance * r.times, 0);
  assert.ok(expected < 1 && expected > 0.5, `Rückgabe ${expected}`);
  assert.deepEqual(ticketPrize('bronze', seq(0.01)), { chips: 500, symbols: ['♛', '♛', '♛'], tier: 3 });
  assert.equal(ticketPrize('silver', seq(0.05, 0)).chips, 450);
  assert.equal(ticketPrize('gold', seq(0.2, 0, 0)).chips, 400);
  const nothing = ticketPrize('bronze', seq(0.9, 0));
  assert.equal(nothing.chips, 0);
  assert.equal(new Set(nothing.symbols).size, 3, 'Niete zeigt drei verschiedene Zeichen');
  // Gezeigte Zeichen passen zum Gewinn
  const rand = seeded(3);
  for (let k = 0; k < 300; k++) {
    const p = ticketPrize('bronze', rand);
    const same = 4 - new Set(p.symbols).size;
    assert.equal(p.chips, [0, 50, 150, 500][p.tier]);
    assert.equal(same, p.tier === 0 ? 1 : p.tier === 1 ? 2 : 3);
  }
  assert.equal(ticketPrize('unbekannt', Math.random), null);
  assert.deepEqual(Object.values(TICKETS).map((t) => t.price), [50, 150, 400]);
});

test('Glücksrad: Felder so groß wie ihre Chance, Treffer passt zur Zeigerstellung', () => {
  assert.equal(WHEEL_TOTAL, 100);
  assert.equal(spinWheel(() => 0), 0);
  assert.equal(spinWheel(() => 0.999), WHEEL.length - 1);
  for (let index = 0; index < WHEEL.length; index++) {
    const before = WHEEL.slice(0, index).reduce((s, f) => s + f.weight, 0);
    const mid = (before + WHEEL[index].weight / 2) / WHEEL_TOTAL;
    assert.equal(spinWheel(() => mid), index);
    assert.ok(Math.abs(wheelAngle(index) - mid * 360) < 1e-9);
  }
});

test('Spielautomat: Auszahlung unter 100 %, ehrliche Walzen, Tageslimit 20', () => {
  const rtp = slotReturn();
  assert.ok(rtp > 0.6 && rtp < 0.95, `Rückgabe ${rtp}`);
  assert.equal(SLOT_DAILY_SPINS, 20);
  assert.deepEqual(slotResult(['crown', 'crown', 'crown'], 10), { win: 2000, jackpot: true });
  assert.deepEqual(slotResult(['seven', 'seven', 'seven'], 25), { win: 1250, jackpot: false });
  assert.deepEqual(slotResult(['cherry', 'bell', 'cherry'], 10), { win: 20, jackpot: false });
  assert.deepEqual(slotResult(['cherry', 'bell', 'heart'], 10), { win: 0, jackpot: false });
  assert.equal(spinSlot(13, Math.random), null, 'nur erlaubte Einsätze');
  // Gemessene Auszahlung passt zur berechneten
  const rand = seeded(11);
  let paid = 0;
  const n = 60_000;
  for (let k = 0; k < n; k++) paid += spinSlot(SLOT_BETS[0], rand).win;
  assert.ok(Math.abs(paid / (n * SLOT_BETS[0]) - rtp) < 0.06, `gemessen ${paid / (n * SLOT_BETS[0])}, berechnet ${rtp}`);
});

test('Tageswerte: Glücksrad und Automat setzen sich am neuen Tag zurück, Zähler bleiben', () => {
  const day1 = casinoDay({}, '2026-10-27');
  assert.deepEqual([day1.wheel, day1.spins, day1.spent], [false, 0, 0]);
  const used = { ...day1, wheel: true, spins: 20, spent: 900, slotJackpots: 1, sets: ['vegas'] };
  assert.equal(casinoDay(used, '2026-10-27').spins, 20);
  const day2 = casinoDay(used, '2026-10-28');
  assert.deepEqual([day2.wheel, day2.spins, day2.spent, day2.slotJackpots, day2.sets], [false, 0, 900, 1, ['vegas']]);
});

test('Glücksbringer erhöhen nur Chips', () => {
  assert.equal(charmBonus('charm-none'), 0);
  assert.equal(withCharm(100, 'charm-clover'), 105);
  assert.equal(withCharm(100, 'charm-dice'), 115);
  assert.equal(withCharm(0, 'charm-dice'), 0);
  assert.equal(withCharm(100, 'gibt-es-nicht'), 100);
  assert.ok(CHARMS.every((c) => c.bonus_chips <= 0.15));
  // Punkte werden in game.js berechnet – dort darf kein Glücksbringer vorkommen
  const game = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');
  assert.doesNotMatch(game, /charm/i);
});

test('jeder Stil hat ein Aussehen im Stylesheet', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const has = (selector) => css.includes(selector);
  for (const item of SHOP_ITEMS.backgrounds) assert.ok(has(`[data-background="${item.id}"]`), item.id);
  for (const item of SHOP_ITEMS.frames) assert.ok(has(`[data-frame="${item.id}"]`), item.id);
  for (const item of SHOP_ITEMS.chips) assert.ok(has(`[data-chip="${item.id}"]`), item.id);
  for (const item of SHOP_ITEMS.cards) assert.ok(has(`[data-cards="${item.id}"]`), item.id);
  for (const item of SHOP_ITEMS.theme.slice(1)) assert.ok(has(`[data-theme='${item.id}']`), item.id);
  for (const item of SHOP_ITEMS.tiles.slice(1)) assert.ok(has(`.tile.t-${item.id}`), item.id);
});
