import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GIFT_DAYS, chestReward, dailyGift, levelFromXp, levelReward, praiseFor, xpForRound, xpToNext } from '../src/progress.js';

test('Level aus Erfahrung', () => {
  assert.deepEqual(levelFromXp(0), { level: 1, into: 0, need: xpToNext(1) });
  assert.equal(levelFromXp(xpToNext(1)).level, 2);
  assert.equal(levelFromXp(xpToNext(1) + xpToNext(2) - 1).level, 2);
  for (let l = 2; l < 30; l++) assert.ok(xpToNext(l) > xpToNext(l - 1), 'später langsamer');
});

test('jede Runde bringt Erfahrung, gute Runden mehr', () => {
  assert.ok(xpForRound({ score: 0, lines: 0 }) > 0);
  assert.ok(xpForRound({ score: 90000, lines: 50 }) > xpForRound({ score: 5000, lines: 5 }));
});

test('Level-Belohnung: Chips, jedes 5. Level ein Design', () => {
  assert.ok(levelReward(2).chips > 0);
  assert.equal(levelReward(5).design, true);
  assert.equal(levelReward(6).design, false);
});

test('Truhe: mehr Chips für bessere Runden, selten Bonus', () => {
  const never = () => 0.99;
  const always = () => 0;
  const small = chestReward({ score: 2000, lines: 3 }, never);
  const big = chestReward({ score: 80000, lines: 40 }, never);
  assert.ok(big.chips > small.chips && small.chips > 0);
  assert.equal(chestReward({ score: 2000, lines: 3 }, always).chips, small.chips * 3);
  assert.ok(chestReward({ score: 1e9, lines: 1e5 }, never).chips <= 300, 'gedeckelt');
});

test('Tagesgeschenk: einmal pro Tag, wächst mit der Tagesserie', () => {
  const first = dailyGift(null, '2026-10-21');
  assert.deepEqual(first, { day: '2026-10-21', streak: 1, chips: GIFT_DAYS[0] });
  assert.equal(dailyGift(first, '2026-10-21'), null, 'heute schon abgeholt');
  const second = dailyGift(first, '2026-10-22');
  assert.equal(second.streak, 2);
  assert.equal(second.chips, GIFT_DAYS[1]);
  assert.equal(dailyGift(second, '2026-10-24').streak, 1, 'Lücke setzt zurück');
  assert.equal(dailyGift({ day: '2026-10-31', streak: 9 }, '2026-11-01').chips, GIFT_DAYS[GIFT_DAYS.length - 1]);
});

test('Lob passt zur Stärke', () => {
  assert.equal(typeof praiseFor(1, 1), 'string');
  assert.notEqual(praiseFor(1, 1), praiseFor(6, 1));
  assert.equal(praiseFor(9, 3), praiseFor(9, 1), 'nach oben begrenzt');
});
