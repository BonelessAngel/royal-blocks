import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportSnapshot, hasProgress, importSnapshot, snapshotSummary } from '../src/storage.js';

class MemoryStorage {
  constructor(entries = {}) { this.data = new Map(Object.entries(entries)); }
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

test('Snapshot übernimmt alle alten royal-blocks-Schlüssel unverändert', () => {
  globalThis.localStorage = new MemoryStorage({
    'royal-blocks:chips': '1234',
    'royal-blocks:owned': '["neon","gold"]',
    'royal-blocks:settings': '{"sound":false,"theme":"gold"}',
    'royal-blocks:future-key': '{"bleibt":true}',
    'fremdes-spiel:key': 'nicht mitsichern',
  });
  const snapshot = exportSnapshot();
  assert.equal(snapshot.values.chips, '1234');
  assert.equal(snapshot.values['future-key'], '{"bleibt":true}');
  assert.equal('key' in snapshot.values, false);
  assert.equal(hasProgress(snapshot), true);

  globalThis.localStorage = new MemoryStorage({ 'royal-blocks:local-only': '"behalten"' });
  assert.equal(importSnapshot(snapshot, 999), true);
  assert.equal(localStorage.getItem('royal-blocks:future-key'), '{"bleibt":true}');
  assert.equal(localStorage.getItem('royal-blocks:local-only'), '"behalten"', 'Import löscht keine unbekannten lokalen Daten');
  assert.equal(JSON.parse(localStorage.getItem('royal-blocks:sync-t')), 999);
});

test('ungültige oder zu große Konto-Spielstände werden abgewiesen', () => {
  globalThis.localStorage = new MemoryStorage();
  assert.equal(importSnapshot({ version: 1, values: { '../falsch': '1' } }), false);
  assert.equal(importSnapshot({ version: 1, values: { game: 'x'.repeat(500_001) } }), false);
  assert.deepEqual(snapshotSummary({ t: 12, values: { xp: '400', chips: '75' } }), { xp: 400, chips: 75, t: 12 });
});
