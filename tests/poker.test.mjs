import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateHand } from '../src/poker.js';

// Kurzschreibweise: 'Ah' = Herz-Ass, 'Ts' = Pik-10. Farben: s Pik, h Herz, d Karo, c Kreuz
const RANKS = { T: 10, J: 11, Q: 12, K: 13, A: 14 };
const SUIT = { s: 0, h: 1, d: 2, c: 3 };
const cards = (str) => str.split(' ').map((c) => ({ r: RANKS[c[0]] ?? Number(c[0]), s: SUIT[c[1]] }));
const hand = (str) => evaluateHand(cards(str));

test('erkennt alle Pokerhände in 8 Karten', () => {
  const cases = [
    ['Th Jh Qh Kh Ah 2s 3d 4c', 'royal-flush'],
    ['5s 6s 7s 8s 9s Kh 2d 2c', 'straight-flush'],
    ['9s 9h 9d 9c 2s 3h 5d Kc', 'quads'],
    ['Ks Kh Kd 4c 4h 2s 7d 9c', 'full-house'],
    ['2d 6d 9d Jd Ad 3s 4h 8c', 'flush'],
    ['6c 7h 8s 9d Tc 2s 2h Kd', 'straight'],
    ['7s 7h 7d 2c 4h 9s Jd Kc', 'trips'],
    ['5s 5h Qd Qc 2h 7s 9d Kc', 'two-pair'],
    ['As Ah 2d 4c 6h 8s Td Qc', 'pair'],
    ['2s 4h 6d 8c Th Qs 3d 9c', 'high'],
  ];
  for (const [str, id] of cases) assert.equal(hand(str).id, id, str);
});

test('Ass zählt auch niedrig (A-2-3-4-5)', () => {
  assert.equal(hand('As 2h 3d 4c 5h 9s Jd Kc').id, 'straight');
  assert.equal(hand('Ah 2h 3h 4h 5h 9s Jd Kc').id, 'straight-flush');
});

test('keine Straße über das Ass hinweg (Q-K-A-2-3)', () => {
  assert.equal(hand('Qs Kh Ad 2c 3h 7s 9d 9c').id, 'pair');
});

test('nimmt die beste Hand, nicht die erste', () => {
  // Flush und Straße gleichzeitig, aber kein Straight Flush → Flush ist stärker
  assert.equal(hand('5h 6h 7h 8h 9s 2h Kd Kc').id, 'flush');
  // zwei Drillinge → Full House
  assert.equal(hand('8s 8h 8d 3c 3h 3s Jd Kc').id, 'full-house');
  // Straight Flush in einer Farbe, obwohl eine andere Farbe ebenfalls eine Straße ergäbe
  assert.equal(hand('9c Tc Jc Qc Kc Ah 2d 3s').id, 'straight-flush');
});

test('gibt die Karten der Hand zurück', () => {
  const list = cards('Ks 2h Kd 4c 9h 7s Jd 3c');
  const result = evaluateHand(list);
  assert.equal(result.id, 'pair');
  assert.deepEqual(result.used.map((i) => list[i].r), [13, 13]);

  const royal = evaluateHand(cards('Th Jh Qh Kh Ah 2s 3d 4c'));
  assert.deepEqual([...royal.used].sort(), [0, 1, 2, 3, 4]);
});

test('Faktoren steigen mit der Stärke', () => {
  const ids = ['high', 'pair', 'two-pair', 'trips', 'straight', 'flush', 'full-house', 'quads', 'straight-flush', 'royal-flush'];
  const mults = ids.map((id) => {
    const examples = {
      high: '2s 4h 6d 8c Th Qs 3d 9c',
      pair: 'As Ah 2d 4c 6h 8s Td Qc',
      'two-pair': '5s 5h Qd Qc 2h 7s 9d Kc',
      trips: '7s 7h 7d 2c 4h 9s Jd Kc',
      straight: '6c 7h 8s 9d Tc 2s 2h Kd',
      flush: '2d 6d 9d Jd Ad 3s 4h 8c',
      'full-house': 'Ks Kh Kd 4c 4h 2s 7d 9c',
      quads: '9s 9h 9d 9c 2s 3h 5d Kc',
      'straight-flush': '5s 6s 7s 8s 9s Kh 2d 2c',
      'royal-flush': 'Th Jh Qh Kh Ah 2s 3d 4c',
    };
    return hand(examples[id]).mult;
  });
  for (let k = 1; k < mults.length; k++) assert.ok(mults[k] > mults[k - 1]);
});
