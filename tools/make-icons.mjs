// Membuat ikon PNG (tanpa dependensi) + SVG. Jalankan: npm run icons
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
mkdirSync('icons', { recursive: true });

function crc32(buf) { let c, crc = ~0; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(size, rgba) { const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; const raw = Buffer.alloc((size * 4 + 1) * size); for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); } return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); }

// Garis denyut (pulse) putih pada latar teal. Koordinat 0..1 dalam area aman (maskable: 80% tengah).
const PULSE = [[0.14, 0.52], [0.34, 0.52], [0.42, 0.34], [0.52, 0.72], [0.60, 0.44], [0.66, 0.52], [0.86, 0.52]];
const distSeg = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy)); };

function draw(size, { rounded }) {
  const buf = Buffer.alloc(size * size * 4), SS = 3;
  const bg = [15, 118, 110], bg2 = [17, 94, 89], fg = [255, 255, 255];
  const r = rounded ? 0.22 : 0, hw = 0.045;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let cov = 0, line = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const u = (x + (sx + 0.5) / SS) / size, v = (y + (sy + 0.5) / SS) / size;
      let inside = true;
      if (rounded) { const cx = Math.min(Math.max(u, r), 1 - r), cy = Math.min(Math.max(v, r), 1 - r); inside = Math.hypot(u - cx, v - cy) <= r; }
      if (!inside) continue;
      cov++;
      let d = 9; for (let i = 0; i < PULSE.length - 1; i++) d = Math.min(d, distSeg(u, v, PULSE[i], PULSE[i + 1]));
      if (d <= hw) line++;
    }
    const n = SS * SS, t = y / size, o = (y * size + x) * 4;
    const base = bg.map((c, i) => c + (bg2[i] - c) * t);
    const a = line / Math.max(1, cov);
    for (let i = 0; i < 3; i++) buf[o + i] = Math.round(base[i] * (1 - a) + fg[i] * a);
    buf[o + 3] = Math.round((cov / n) * 255);
  }
  return buf;
}
writeFileSync('icons/icon-192.png', png(192, draw(192, { rounded: true })));
writeFileSync('icons/icon-512.png', png(512, draw(512, { rounded: true })));
writeFileSync('icons/icon-maskable-512.png', png(512, draw(512, { rounded: false })));
writeFileSync('icons/apple-touch-icon.png', png(180, draw(180, { rounded: false })));
const pts = PULSE.map(([x, y]) => `${Math.round(x * 512)},${Math.round(y * 512)}`).join(' ');
writeFileSync('icons/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0f766e"/><polyline points="${pts}" fill="none" stroke="#fff" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/></svg>\n`);
console.log('ikon dibuat');
