// Kleiner Testserver. Das Spiel liegt wie auf der Plattform unter /games/royal-blocks/.
// Aufruf: npm run dev      (Quelltext aus src/, ohne Offline-Cache)
//         npm run preview  (gebautes Spiel aus dist/, mit Service Worker)

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_ID } from './files.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = join(root, process.argv[2] === 'dist' ? 'dist' : 'src');
const port = Number(process.argv[3] || 5173);
const base = `/games/${GAME_ID}/`;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.json': 'application/json',
};

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (!path.startsWith(base)) {
    res.writeHead(302, { Location: base });
    res.end();
    return;
  }
  const rel = normalize(path.slice(base.length) || 'index.html');
  const file = join(dir, rel);
  if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden');
    return;
  }
  const body = readFileSync(file);
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': 'no-cache',
  });
  res.end(body);
}).listen(port, () => {
  console.log(`Royal Blocks (${dir}) läuft auf http://localhost:${port}${base}`);
});
