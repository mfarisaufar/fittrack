// Grafik SVG sederhana tanpa pustaka eksternal (bekerja offline).
import { esc, fmt, parseDate, fmtDate } from './util.js';

const W = 320, H = 170, PL = 38, PR = 10, PT = 12, PB = 26;

function niceRange(vals, extra = []) {
  const all = [...vals, ...extra].filter(Number.isFinite);
  if (!all.length) return [0, 1];
  let lo = Math.min(...all), hi = Math.max(...all);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12;
  return [lo - pad, hi + pad];
}
const empty = (msg) => `<div class="chart-empty">${esc(msg || 'Belum ada data untuk grafik.')}</div>`;

/** series: [{name, cls, pts:[{x:'YYYY-MM-DD', y:number}]}], band:{min,max}, ref:number */
export function lineChart({ series, band, ref, unit = '', label = '' }) {
  const pts = series.flatMap((s) => s.pts);
  if (!pts.length) return empty();
  const xs = pts.map((p) => parseDate(p.x).getTime());
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 86400000 * 3; x1 += 86400000 * 3; }
  const [y0, y1] = niceRange(pts.map((p) => p.y), [band?.min, band?.max, ref]);
  const sx = (t) => PL + ((t - x0) / (x1 - x0)) * (W - PL - PR);
  const sy = (v) => PT + (1 - (v - y0) / (y1 - y0)) * (H - PT - PB);
  const grid = [0, 0.5, 1].map((f) => { const v = y0 + f * (y1 - y0); return `<line x1="${PL}" x2="${W - PR}" y1="${sy(v)}" y2="${sy(v)}" class="ch-grid"/><text x="${PL - 4}" y="${sy(v) + 3}" class="ch-tick" text-anchor="end">${fmt(v, 1)}</text>`; }).join('');
  const bandEl = band ? `<rect x="${PL}" width="${W - PL - PR}" y="${sy(band.max)}" height="${Math.max(1, sy(band.min) - sy(band.max))}" class="ch-band"/>` : '';
  const refEl = ref != null ? `<line x1="${PL}" x2="${W - PR}" y1="${sy(ref)}" y2="${sy(ref)}" class="ch-ref"/>` : '';
  const lines = series.map((s, i) => {
    const sorted = [...s.pts].sort((a, b) => a.x.localeCompare(b.x));
    const d = sorted.map((p) => `${sx(parseDate(p.x).getTime()).toFixed(1)},${sy(p.y).toFixed(1)}`);
    return `<polyline points="${d.join(' ')}" class="ch-line c${i + 1}"/>` + sorted.map((p) => `<circle cx="${sx(parseDate(p.x).getTime()).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3" class="ch-dot c${i + 1}"><title>${esc(s.name)} ${fmtDate(p.x)}: ${fmt(p.y, 1)} ${esc(unit)}</title></circle>`).join('');
  }).join('');
  const dates = [...new Set(pts.map((p) => p.x))].sort();
  const axis = `<text x="${PL}" y="${H - 8}" class="ch-tick">${fmtDate(dates[0], { year: '2-digit' })}</text><text x="${W - PR}" y="${H - 8}" class="ch-tick" text-anchor="end">${fmtDate(dates[dates.length - 1], { year: '2-digit' })}</text>`;
  const legend = series.length > 1 ? `<div class="legend">${series.map((s, i) => `<span><i class="sw c${i + 1}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${bandEl}${grid}${refEl}${lines}${axis}</svg>${legend}</figure>`;
}

/** bars: [{label, vals:[a,b?]}], names: ['Masuk','Keluar'] */
export function barChart({ bars, names = [], ref, unit = '', label = '' }) {
  if (!bars.length || bars.every((b) => b.vals.every((v) => v == null))) return empty();
  const max = Math.max(...bars.flatMap((b) => b.vals.filter(Number.isFinite)), ref || 0) * 1.1 || 1;
  const n = bars.length, k = Math.max(...bars.map((b) => b.vals.length));
  const gw = (W - PL - PR) / n, bw = Math.min(22, (gw * 0.8) / k);
  const sy = (v) => PT + (1 - v / max) * (H - PT - PB);
  const grid = [0, 0.5, 1].map((f) => `<line x1="${PL}" x2="${W - PR}" y1="${sy(f * max)}" y2="${sy(f * max)}" class="ch-grid"/><text x="${PL - 4}" y="${sy(f * max) + 3}" class="ch-tick" text-anchor="end">${fmt(f * max, 0)}</text>`).join('');
  const rects = bars.map((b, i) => {
    const gx = PL + i * gw + gw / 2 - (bw * b.vals.length) / 2;
    const r = b.vals.map((v, j) => (Number.isFinite(v) ? `<rect x="${(gx + j * bw).toFixed(1)}" y="${sy(v).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${Math.max(0, H - PB - sy(v)).toFixed(1)}" rx="2" class="ch-bar c${j + 1}"><title>${esc(b.label)} ${esc(names[j] || '')}: ${fmt(v, 0)} ${esc(unit)}</title></rect>` : '')).join('');
    return r + `<text x="${PL + i * gw + gw / 2}" y="${H - 8}" class="ch-tick" text-anchor="middle">${esc(b.label)}</text>`;
  }).join('');
  const refEl = ref != null ? `<line x1="${PL}" x2="${W - PR}" y1="${sy(ref)}" y2="${sy(ref)}" class="ch-ref"/>` : '';
  const legend = names.length > 1 ? `<div class="legend">${names.map((s, i) => `<span><i class="sw c${i + 1}"></i>${esc(s)}</span>`).join('')}</div>` : '';
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${grid}${refEl}${rects}</svg>${legend}</figure>`;
}
