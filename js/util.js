// Utilitas murni (tanpa DOM) — dapat dipakai di browser dan di Node (test).

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Parsing angka desimal gaya Indonesia: koma atau titik desimal. Kembalikan NaN jika kosong/tidak valid. */
export function parseNum(v) {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  let t = String(v).trim().replace(/\s/g, '');
  if (!t) return NaN;
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Parsing Rupiah: "10.000", "10000", "Rp 10.000" -> 10000 */
export function parseRupiah(v) {
  if (v == null) return NaN;
  const digits = String(v).replace(/[^\d]/g, '');
  return digits ? Number(digits) : NaN;
}

export function fmt(n, d = 1) {
  if (n == null || Number.isNaN(Number(n))) return '–';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(n);
}
export const kkal = (n) => (n == null || Number.isNaN(n) ? '–' : fmt(Math.round(n), 0) + ' kkal');
export const rp = (n) => (n == null || Number.isNaN(n) ? '–' : 'Rp' + new Intl.NumberFormat('id-ID').format(Math.round(n)));
export const signed = (n, d = 1) => (n == null || Number.isNaN(n) ? '–' : (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n), d));

export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const round = (n, d = 1) => { const m = 10 ** d; return Math.round((n + Number.EPSILON) * m) / m; };
export const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);
export const avg = (arr) => { const a = arr.filter((x) => Number.isFinite(x)); return a.length ? sum(a) / a.length : null; };

// ---------- Tanggal (selalu tanggal lokal "YYYY-MM-DD") ----------
const p2 = (n) => String(n).padStart(2, '0');
export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
export function addDays(str, n) { const d = parseDate(str); d.setDate(d.getDate() + n); return todayStr(d); }
export function diffDays(a, b) { return Math.round((parseDate(a) - parseDate(b)) / 86400000); }
/** 0 = Senin ... 6 = Minggu */
export function weekdayIdx(str) { return (parseDate(str).getDay() + 6) % 7; }
export const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
export function fmtDate(str, opts = {}) {
  if (!str) return '–';
  return parseDate(str).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', ...opts });
}
export function fmtDateLong(str) { return `${DAY_NAMES[weekdayIdx(str)]}, ${fmtDate(str, { month: 'long' })}`; }
export function weekStart(str) { return addDays(str, -weekdayIdx(str)); }
export function lastNDays(endStr, n) { return Array.from({ length: n }, (_, i) => addDays(endStr, i - (n - 1))); }
export function ageFrom(birthDate, onDate = todayStr()) {
  const b = parseDate(birthDate), t = parseDate(onDate);
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}
export const timeToMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
/** Durasi tidur dalam menit (melewati tengah malam jika jam bangun < jam tidur). */
export function sleepMinutes(bed, wake) {
  let d = timeToMin(wake) - timeToMin(bed);
  if (d <= 0) d += 1440;
  return d;
}
export const fmtDur = (min) => `${Math.floor(min / 60)} j ${p2(Math.round(min % 60))} m`;
