// Pokerhände erkennen: Aus beliebig vielen Karten (eine volle Reihe hat 8) wird die beste Hand aus 5 Karten gesucht.
// Eine Karte ist { r, s }: r = Wert 2..14 (11 Bube, 12 Dame, 13 König, 14 Ass), s = Farbe 0..3 (siehe SUITS).

export const SUITS = ['♠', '♥', '♦', '♣'];
export const SUIT_NAMES = ['Pik', 'Herz', 'Karo', 'Kreuz'];
const RANK_LABELS = { 11: 'B', 12: 'D', 13: 'K', 14: 'A' };

export const rankLabel = (r) => RANK_LABELS[r] ?? String(r);

// Reihenfolge = Stärke. mult ist der Faktor für die Punkte einer abgeräumten Reihe.
export const HANDS = [
  { id: 'high', name: 'Hohe Karte', mult: 1 },
  { id: 'pair', name: 'Paar', mult: 2 },
  { id: 'two-pair', name: 'Zwei Paare', mult: 3 },
  { id: 'trips', name: 'Drilling', mult: 4 },
  { id: 'straight', name: 'Straße', mult: 5 },
  { id: 'flush', name: 'Flush', mult: 6 },
  { id: 'full-house', name: 'Full House', mult: 8 },
  { id: 'quads', name: 'Vierling', mult: 12 },
  { id: 'straight-flush', name: 'Straight Flush', mult: 20 },
  { id: 'royal-flush', name: 'Royal Flush', mult: 50 },
];

const result = (level, used) => ({ level, ...HANDS[level], used });

// Sucht in einer Liste von Karten-Indizes die höchste Straße. Das Ass zählt auch als 1 (A-2-3-4-5).
// Gibt die Indizes der 5 Karten zurück (höchste zuerst) oder null.
function findStraight(cards, indices) {
  const byRank = new Map();
  for (const i of indices) if (!byRank.has(cards[i].r)) byRank.set(cards[i].r, i);
  for (let top = 14; top >= 5; top--) {
    const run = [];
    for (let r = top; r > top - 5; r--) {
      const rank = r === 1 ? 14 : r;
      if (!byRank.has(rank)) break;
      run.push(byRank.get(rank));
    }
    if (run.length === 5) return { top, used: run };
  }
  return null;
}

export function evaluateHand(cards) {
  const all = cards.map((_, i) => i);
  const byHigh = (a, b) => cards[b].r - cards[a].r;

  const bySuit = [[], [], [], []];
  for (const i of all) bySuit[cards[i].s].push(i);
  const flushSuits = bySuit.filter((list) => list.length >= 5);

  let straightFlush = null;
  for (const list of flushSuits) {
    const found = findStraight(cards, list);
    if (found && (!straightFlush || found.top > straightFlush.top)) straightFlush = found;
  }
  if (straightFlush) return result(straightFlush.top === 14 ? 9 : 8, straightFlush.used);

  const byRank = new Map();
  for (const i of [...all].sort(byHigh)) {
    if (!byRank.has(cards[i].r)) byRank.set(cards[i].r, []);
    byRank.get(cards[i].r).push(i);
  }
  // Gruppen: größte zuerst, bei Gleichstand der höhere Wert
  const groups = [...byRank.values()].sort((a, b) => b.length - a.length || cards[b[0]].r - cards[a[0]].r);

  if (groups[0].length >= 4) return result(7, groups[0].slice(0, 4));
  if (groups[0].length >= 3 && groups[1]?.length >= 2) {
    return result(6, [...groups[0].slice(0, 3), ...groups[1].slice(0, 2)]);
  }
  if (flushSuits.length) {
    const best = flushSuits.map((list) => [...list].sort(byHigh).slice(0, 5)).sort((a, b) => {
      for (let k = 0; k < 5; k++) if (cards[a[k]].r !== cards[b[k]].r) return cards[b[k]].r - cards[a[k]].r;
      return 0;
    })[0];
    return result(5, best);
  }
  const straight = findStraight(cards, all);
  if (straight) return result(4, straight.used);
  if (groups[0].length === 3) return result(3, groups[0]);
  if (groups[0].length === 2 && groups[1]?.length === 2) return result(2, [...groups[0], ...groups[1]]);
  if (groups[0].length === 2) return result(1, groups[0]);
  return result(0, [groups[0][0]]);
}
