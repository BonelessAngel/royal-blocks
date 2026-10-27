import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TIERED, TIERS, tierProgress, ACHIEVEMENTS, GIFT_DAYS, chestReward, dailyGift, earnedAchievements, levelFromXp, levelReward, praiseFor, xpForRound, xpToNext } from '../src/progress.js';

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

test('Jackpot: Royal Flush alles, Straight Flush ein Viertel, sonst nichts', async () => {
  const { jackpotWin } = await import('../src/progress.js');
  assert.equal(jackpotWin(9, 1000), 1000);
  assert.equal(jackpotWin(8, 1000), 250);
  assert.equal(jackpotWin(7, 1000), 0);
});

test('Rubbellos: Gewinne passen zu den Zeichen', async () => {
  const { scratchPrize } = await import('../src/progress.js');
  let r = 1;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const seen = new Set();
  for (let k = 0; k < 2000; k++) {
    const p = scratchPrize(rand);
    seen.add(p.tier);
    const same = Math.max(...p.symbols.map((s) => p.symbols.filter((x) => x === s).length));
    assert.equal(p.symbols.length, 3);
    if (p.tier >= 2) assert.equal(same, 3);
    if (p.tier === 1) assert.equal(same, 2);
    if (p.tier === 0) assert.equal(same, 1);
    assert.ok(p.chips > 0);
  }
  assert.equal(seen.size, 4, 'alle Gewinnstufen kommen vor');
});

test('Statistik zählt Hände, Reihen und Runden', async () => {
  const { emptyStats, recordMove, recordRound } = await import('../src/progress.js');
  const s = emptyStats();
  recordMove(s, { lines: [{ hand: { level: 5 } }, { hand: { level: 1 } }], golden: 1, feverStart: true, mission: {}, chips: 20 }, 4);
  recordRound(s, { score: 1234 });
  assert.equal(s.hands[5], 1);
  assert.equal(s.lines, 2);
  assert.equal(s.golden, 1);
  assert.equal(s.fevers, 1);
  assert.equal(s.missions, 1);
  assert.equal(s.bestStreak, 4);
  assert.equal(s.games, 1);
  assert.equal(s.bestScore, 1234);
});

test('Erfolge werden aus dauerhaftem Fortschritt reproduzierbar abgeleitet', () => {
  const xp25 = Array.from({ length: 24 }, (_, index) => xpToNext(index + 1)).reduce((sum, value) => sum + value, 0);
  const ids = earnedAchievements({
    stats: {
      hands: [0, 0, 0, 0, 0, 200, 100, 50, 0, 1], jackpots: 10, lines: 5000, games: 500, missions: 500,
      chipsEarned: 500_000, bestStreak: 25, golden: 500,
    },
    xp: xp25, gift: { streak: 7 }, proBest: 25_000,
    casino: { slotJackpots: 1, spent: 50_000, chests: 200 }, legendary: true, setDone: true, prestigeDone: true,
  });
  assert.deepEqual(new Set(ids), new Set(Object.keys(ACHIEVEMENTS)));
  for (const achievement of Object.values(ACHIEVEMENTS)) {
    assert.ok(achievement.name.length > 3);
    assert.equal([...achievement.icon].length <= 2, true);
    assert.ok(achievement.how.length > 5, 'jeder Erfolg sagt, wie man ihn bekommt');
  }
});

test('die vier Profil-Erfolge haben genau die mit der Webseite vereinbarten IDs', () => {
  const profile = Object.entries(ACHIEVEMENTS).filter(([, a]) => a.profile).map(([id]) => id).sort();
  assert.deepEqual(profile, ['album_set', 'highroller', 'shop_legendary', 'slot_jackpot']);
  assert.deepEqual(earnedAchievements({ casino: { spent: 49_999 } }), [], 'Highroller erst ab 50.000');
});

test('achievements.json passt zu den Erfolgen im Spiel', async () => {
  const { readFileSync } = await import('node:fs');
  const json = JSON.parse(readFileSync(new URL('../src/achievements.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(json).sort(), Object.keys(ACHIEVEMENTS).sort());
  for (const [id, a] of Object.entries(ACHIEVEMENTS)) assert.equal(json[id].name, a.name);
});

test('Erfolgsstufen: Bronze, Silber, Gold je Kategorie, jede Stufe ein eigener Erfolg mit Chips', () => {
  assert.equal(TIERED.length, 10);
  for (const cat of TIERED) {
    assert.ok(cat.goals[0] < cat.goals[1] && cat.goals[1] < cat.goals[2], cat.id);
    for (const tier of TIERS) assert.ok(ACHIEVEMENTS[`${cat.id}_${tier}`], `${cat.id}_${tier}`);
  }
  const flush = TIERED.find((c) => c.id === 'flush');
  assert.deepEqual(tierProgress(flush, { hands: [0, 0, 0, 0, 0, 12] }), { value: 12, reached: 1, next: 50 });
  assert.deepEqual(tierProgress(flush, { hands: [0, 0, 0, 0, 0, 999] }), { value: 999, reached: 3, next: null });
  const ids = earnedAchievements({ stats: { hands: [0, 0, 0, 0, 0, 60] } });
  assert.deepEqual(ids.filter((id) => id.startsWith('flush_')), ['flush_bronze', 'flush_silver']);
  assert.deepEqual([ACHIEVEMENTS.flush_bronze.chips, ACHIEVEMENTS.flush_silver.chips, ACHIEVEMENTS.flush_gold.chips], [50, 150, 500]);
  assert.deepEqual(earnedAchievements({ casino: { chests: 10 } }), ['chests_bronze'], 'Truhen zählen aus dem Casino-Stand');
});
