// Zeichnet die App-Symbole (Neon-Krone über vier Karten-Blöcken) ohne fremde Werkzeuge als PNG.
// Aufruf: npm run icons  → src/icon-180.png, src/icon-192.png, src/icon-512.png

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const src = fileURLToPath(new URL('../src', import.meta.url));

const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
const SUITS = ['#3ee8ff', '#ff3d8b', '#ffb52e', '#4dff88'].map(hex);
const GOLD = hex('#ffd34d');

// Alles in Einheiten 0..1, Inhalt innerhalb des sicheren Kreises für "maskable" Symbole.
const TILE = 0.19;
const TILE_GAP = 0.04;
const TILE_X = 0.5 - TILE - TILE_GAP / 2;
const TILE_Y = 0.4;
const tiles = [0, 1, 2, 3].map((k) => ({
  x: TILE_X + (k % 2) * (TILE + TILE_GAP),
  y: TILE_Y + Math.floor(k / 2) * (TILE + TILE_GAP),
  color: SUITS[k],
}));
const CROWN = [[0.31, 0.35], [0.29, 0.19], [0.4, 0.27], [0.5, 0.14], [0.6, 0.27], [0.71, 0.19], [0.69, 0.35]];

function sdRoundRect(px, py, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const qx = Math.abs(px - cx) - w / 2 + r;
  const qy = Math.abs(py - cy) - h / 2 + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdPolygon(px, py, pts) {
  let d = Infinity;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j];
    const [bx, by] = pts[i];
    const ex = bx - ax;
    const ey = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey)));
    d = Math.min(d, Math.hypot(px - ax - ex * t, py - ay - ey * t));
    if ((ay > py) !== (by > py) && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside ? -d : d;
}

function shade(u, v) {
  // Hintergrund: violetter Verlauf
  const dist = Math.hypot(u - 0.5, v - 0.45);
  const k = Math.min(1, dist / 0.75);
  let c = [0.17 * (1 - k) + 0.05 * k, 0.05 * (1 - k) + 0.016 * k, 0.34 * (1 - k) + 0.125 * k];

  const add = (col, a) => (c = c.map((x, i) => x + col[i] * a));
  const over = (col, a) => (c = c.map((x, i) => x * (1 - a) + col[i] * a));

  // Leuchten
  for (const t of tiles) {
    const d = sdRoundRect(u, v, t.x, t.y, TILE, TILE, 0.035);
    if (d > 0) add(t.color, 0.55 * Math.exp(-d / 0.025));
  }
  const dc = sdPolygon(u, v, CROWN);
  if (dc > 0) add(GOLD, 0.6 * Math.exp(-dc / 0.025));

  // Flächen
  for (const t of tiles) {
    const d = sdRoundRect(u, v, t.x, t.y, TILE, TILE, 0.035);
    if (d <= 0) {
      const g = (v - t.y) / TILE; // oben heller
      const col = t.color.map((x) => x * (1.15 - 0.55 * g));
      over(col, 1);
      if (d > -0.012 && v < t.y + 0.03) over([1, 1, 1], 0.35); // Glanzkante
    }
  }
  if (dc <= 0) {
    const g = (v - 0.14) / 0.21;
    over(GOLD.map((x) => x * (1.15 - 0.4 * g)), 1);
  }
  // Juwelen auf den Kronenspitzen
  for (const [jx, jy] of [[0.29, 0.19], [0.5, 0.14], [0.71, 0.19]]) {
    const d = Math.hypot(u - jx, v - jy) - 0.022;
    if (d <= 0) over([1, 1, 1], 1);
    else add([1, 0.9, 0.6], 0.5 * Math.exp(-d / 0.015));
  }
  return c.map((x) => Math.max(0, Math.min(1, x)));
}

function render(size) {
  const SS = 4; // Kantenglättung
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = shade((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          acc[0] += c[0];
          acc[1] += c[1];
          acc[2] += c[2];
        }
      }
      const o = (y * size + x) * 4;
      for (let i = 0; i < 3; i++) px[o + i] = Math.round((acc[i] / (SS * SS)) * 255);
      px[o + 3] = 255;
    }
  }
  return png(size, size, px);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [180, 192, 512]) {
  writeFileSync(join(src, `icon-${size}.png`), render(size));
  console.log(`src/icon-${size}.png`);
}
