// Menghasilkan precache.js: daftar file aplikasi + versi cache (hash isi). Jalankan sebelum deploy: npm run precache
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const INCLUDE_DIRS = ['css', 'js', 'icons'];
const INCLUDE_FILES = ['index.html', 'manifest.json'];
const files = [...INCLUDE_FILES];
const walk = (d) => { for (const n of readdirSync(join(root, d))) { const p = join(d, n); statSync(join(root, p)).isDirectory() ? walk(p) : files.push(p.split('\\').join('/')); } };
INCLUDE_DIRS.forEach(walk);
files.sort();
const h = createHash('sha1');
for (const f of files) { h.update(f); h.update(readFileSync(join(root, f))); }
const version = h.digest('hex').slice(0, 10);
writeFileSync(join(root, 'precache.js'), `// DIHASILKAN OTOMATIS oleh tools/gen-precache.mjs — jangan edit manual.\nself.FT_VERSION = '${version}';\nself.FT_PRECACHE = ${JSON.stringify(['./', ...files], null, 2)};\n`);
console.log(`precache.js: ${files.length + 1} entri, versi ${version}`);
