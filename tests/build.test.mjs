// Prüft den Build gegen die Anforderungen der Plattform (NEUES-SPIEL-UEBERGABE.md, Abschnitt 3).

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { BUILD_DIR, BUILD_FILES, GAME_ID } from '../scripts/files.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, BUILD_DIR);
const read = (file) => readFileSync(join(dist, file), 'utf8');
const TEXT_FILES = BUILD_FILES.filter((f) => !f.endsWith('.png'));
const build = () => execFileSync(process.execPath, [join(root, 'scripts', 'build.mjs')], { stdio: 'pipe' });
const digest = () => Object.fromEntries(BUILD_FILES.map((f) => [f, createHash('sha256').update(readFileSync(join(dist, f))).digest('hex')]));

before(build);

test('Spiel-ID ist gültig', () => {
  assert.match(GAME_ID, /^[a-z0-9-]+$/);
});

test('der Build enthält genau die Dateien der Liste', () => {
  assert.deepEqual(readdirSync(dist).sort(), [...BUILD_FILES].sort());
});

test('Manifest: scope und start_url zeigen auf den Spielordner, Symbole 192 und 512', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.scope, `/games/${GAME_ID}/`);
  assert.equal(manifest.start_url, `/games/${GAME_ID}/`);
  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  for (const icon of manifest.icons) assert.ok(BUILD_FILES.includes(icon.src), `${icon.src} fehlt im Build`);
});

test('App-Symbole haben die angegebene Größe', () => {
  for (const size of [180, 192, 512]) {
    const png = readFileSync(join(dist, `icon-${size}.png`));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});

test('keine externen Adressen und nichts unter /icons/', () => {
  for (const file of TEXT_FILES) {
    const text = read(file);
    assert.doesNotMatch(text, /https?:\/\//, `${file} enthält eine externe Adresse`);
    assert.doesNotMatch(text, /(?:src|href)=["']\/\/|url\(\s*["']?\/\/|["']\/\/[a-z0-9-]+\./i, `${file} enthält eine protokoll-relative Adresse`);
    assert.doesNotMatch(text, /\/icons\//, `${file} verweist auf /icons/`);
  }
});

test('index.html lädt eigene Dateien nur relativ', () => {
  const html = read('index.html');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 5);
  for (const ref of refs) {
    if (ref === `/ranglisten/?spiel=${GAME_ID}`) continue;
    assert.ok(!ref.startsWith('/'), `${ref} ist nicht relativ`);
    assert.ok(BUILD_FILES.includes(ref), `${ref} fehlt im Build`);
  }
  assert.ok(refs.includes(`/ranglisten/?spiel=${GAME_ID}`), 'Ranglisten-Link fehlt');
  assert.match(html, /data-version="\d+\.\d+\.\d+"/);
});

test('JavaScript-Module importieren nur Dateien aus dem Build', () => {
  for (const file of BUILD_FILES.filter((f) => f.endsWith('.js') && f !== 'sw.js')) {
    for (const [, ref] of read(file).matchAll(/from '([^']+)'/g)) {
      assert.ok(ref.startsWith('./'), `${file}: ${ref} ist nicht relativ`);
      assert.ok(BUILD_FILES.includes(ref.slice(2)), `${file}: ${ref} fehlt im Build`);
    }
  }
});

test('Service Worker: eigener Cache-Name, alle Dateien vorgemerkt, fremde Caches bleiben', () => {
  const sw = read('sw.js');
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  assert.ok(cache.startsWith(`${GAME_ID}-v`), cache);
  const files = JSON.parse(sw.match(/const FILES = (\[[^\]]*\]);/)[1]);
  assert.deepEqual([...files].sort(), ['./', ...BUILD_FILES.filter((f) => f !== 'sw.js')].sort());
  assert.match(sw, /key\.startsWith\('royal-blocks-'\) && key !== CACHE/);
  assert.doesNotMatch(sw, /caches\.delete\((?!key)/);
});

test('der Build ist reproduzierbar', () => {
  const first = digest();
  build();
  assert.deepEqual(digest(), first);
});
