import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SHOP_ITEMS, START_BONUS, THEMES, TILE_STYLES } from '../src/shop.js';

test('bestehende Shop-IDs bleiben erhalten und Preise steigen um 40 Prozent', () => {
  const oldThemePrices = { gold: 1500, ice: 3000, retro: 5000 };
  const oldTilePrices = { glass: 1000, pixel: 2000, chip: 4000 };
  for (const item of [...THEMES, ...TILE_STYLES]) {
    const old = oldThemePrices[item.id] ?? oldTilePrices[item.id];
    if (old) assert.equal(item.price, old * 1.4);
  }
  assert.deepEqual(THEMES.map((item) => item.id), ['neon', 'gold', 'ice', 'retro']);
  assert.deepEqual(TILE_STYLES.map((item) => item.id), ['standard', 'glass', 'pixel', 'chip']);
});

test('Shop enthält alle sechs Bereiche ohne Musik- oder Soundpakete', () => {
  assert.deepEqual(Object.keys(SHOP_ITEMS), ['theme', 'tiles', 'effects', 'backgrounds', 'cards', 'extras']);
  assert.equal(START_BONUS.price, 350);
  assert.ok(Object.values(SHOP_ITEMS).flat().every((item) => !/musik|sound/i.test(item.name)));
});
