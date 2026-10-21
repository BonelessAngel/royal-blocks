// Baut das Spiel nach dist/ – direkt lauffähig unter /games/royal-blocks/.
// Aufruf: npm run build
// Der Build ist reproduzierbar: gleicher Stand → byte-gleiche Dateien (kein Zeitstempel).

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_DIR, BUILD_FILES, GAME_ID } from './files.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'src');
const out = join(root, BUILD_DIR);
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function fail(message) {
  console.error(`Build abgebrochen: ${message}`);
  process.exit(1);
}

// Jede Datei in src/ muss in der Dateiliste stehen und umgekehrt.
const srcFiles = readdirSync(src).sort();
const missing = BUILD_FILES.filter((f) => !srcFiles.includes(f));
const extra = srcFiles.filter((f) => !BUILD_FILES.includes(f));
if (missing.length) fail(`fehlt in src/: ${missing.join(', ')}`);
if (extra.length) fail(`nicht in scripts/files.mjs eingetragen: ${extra.join(', ')}`);

rmSync(out, { recursive: true, force: true });
mkdirSync(out);

for (const file of BUILD_FILES) {
  if (file === 'sw.js' || file === 'index.html') continue;
  copyFileSync(join(src, file), join(out, file));
}

const html = readFileSync(join(src, 'index.html'), 'utf8');
if (!html.includes('data-version="dev"')) fail('index.html enthält kein data-version="dev"');
writeFileSync(join(out, 'index.html'), html.replace('data-version="dev"', `data-version="${version}"`));

// Cache-Name aus Version und Inhalt: ändert sich eine Datei, lädt der Service Worker alles neu.
const precache = BUILD_FILES.filter((f) => f !== 'sw.js');
const hash = createHash('sha256');
for (const file of precache) hash.update(file).update(readFileSync(join(out, file)));
const cache = `${GAME_ID}-v${version}-${hash.digest('hex').slice(0, 10)}`;

const sw = readFileSync(join(src, 'sw.js'), 'utf8');
const swBuilt = sw
  .replace(`const CACHE = '${GAME_ID}-dev';`, `const CACHE = '${cache}';`)
  .replace('const FILES = [];', `const FILES = ${JSON.stringify(['./', ...precache])};`);
if (swBuilt === sw || !swBuilt.includes(cache) || swBuilt.includes('const FILES = [];')) fail('Platzhalter in sw.js nicht gefunden');
writeFileSync(join(out, 'sw.js'), swBuilt);

for (const file of BUILD_FILES) if (!existsSync(join(out, file))) fail(`${file} wurde nicht erzeugt`);
console.log(`Royal Blocks v${version} gebaut → ${BUILD_DIR}/ (${BUILD_FILES.length} Dateien, Cache ${cache})`);
