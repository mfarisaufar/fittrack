// Server statis lokal untuk uji: node tools/serve.mjs [port] [/subpath]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2]) || 8080;
const base = (process.argv[3] || '').replace(/\/$/, ''); // mis. /fittrack untuk meniru GitHub Pages
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (base) { if (!p.startsWith(base)) { res.writeHead(404); return res.end('404'); } p = p.slice(base.length) || '/'; }
  if (p.endsWith('/')) p += 'index.html';
  try { const b = await readFile(join(root, p)); res.writeHead(200, { 'Content-Type': T[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(b); }
  catch { res.writeHead(404); res.end('404'); }
}).listen(port, () => console.log(`http://localhost:${port}${base}/`));
