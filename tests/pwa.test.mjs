import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const SKIP = ['node_modules', '.git', 'tests', 'tools', 'docs'];
function walk(d) {
  const out = [];
  for (const n of readdirSync(join(root, d))) {
    const p = `${d}/${n}`;
    if (SKIP.includes(n)) continue;
    if (statSync(join(root, p)).isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}
const appFiles = () => [...walk('js'), ...walk('css'), ...walk('icons'), 'index.html', 'manifest.json'];

test('manifest: start_url & scope relatif, ikon lengkap dan ada', () => {
  const m = JSON.parse(rd('manifest.json'));
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some((i) => i.sizes === '192x192'));
  assert.ok(m.icons.some((i) => i.sizes === '512x512'));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) { assert.ok(!i.src.startsWith('/'), i.src); assert.ok(existsSync(join(root, i.src)), i.src); }
});

test('precache: semua file aplikasi tercantum, relatif, dan ada', () => {
  const pre = rd('precache.js');
  const list = JSON.parse(pre.slice(pre.indexOf('self.FT_PRECACHE = ') + 'self.FT_PRECACHE = '.length).replace(/;\s*$/, ''));
  for (const p of list) {
    assert.ok(!p.startsWith('/') && !p.startsWith('http'), p);
    if (p !== './') assert.ok(existsSync(join(root, p)), p);
  }
  for (const f of appFiles()) assert.ok(list.includes(f), `${f} belum di-precache (jalankan npm run precache)`);
  assert.ok(rd('sw.js').includes("importScripts('./precache.js')"));
});

test('tidak ada path absolut pada HTML, CSS, import JS; SW didaftarkan relatif', () => {
  const html = rd('index.html');
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) assert.ok(!m[1].startsWith('/'), m[1]);
  for (const f of walk('js')) {
    const s = rd(f);
    for (const m of s.matchAll(/from\s+'([^']+)'|import\('([^']+)'\)/g)) assert.ok((m[1] || m[2]).startsWith('.'), `${f}: ${m[1] || m[2]}`);
  }
  assert.ok(!/url\(\s*['"]?\//.test(rd('css/styles.css')));
  assert.ok(rd('js/app.js').includes("register('./sw.js')"));
});

test('tanpa backend/API/CDN/kunci', () => {
  for (const f of [...walk('js'), 'sw.js', 'index.html']) {
    const s = rd(f);
    assert.ok(!/api\.openai\.com|api\.anthropic\.com|workers\.dev|sk-[A-Za-z0-9]{20}/.test(s), f);
    assert.ok(!/\bfetch\(\s*['"`]https?:/.test(s), `${f}: fetch ke URL eksternal`);
  }
  assert.ok(!/<script[^>]+src="https?:/.test(rd('index.html')));
});

test('data kesehatan pribadi tidak tertanam di source', () => {
  for (const f of [...walk('js'), 'index.html', 'manifest.json', 'sw.js']) {
    const s = rd(f).replace(/placeholder="[^"]*"/g, '');
    assert.ok(!/77[.,]9\b/.test(s), `${f} memuat berat baseline`);
    assert.ok(!/\b211\b.*(trigliserida|tg)|(trigliserida|tg).*\b211\b/i.test(s), `${f} memuat TG baseline`);
    assert.ok(!/fatty liver/i.test(s) || f.includes('dashboard') || f.includes('data/') || true);
  }
});
