// Backup & restore seluruh IndexedDB ke file JSON (opsional terenkripsi AES-GCM). Tidak ada pengiriman ke server.
import { db, STORES, DB_VERSION } from './db.js';

export async function exportAll() {
  const stores = {};
  for (const s of STORES) stores[s] = await db.all(s);
  return { app: 'FitTrack', schema: DB_VERSION, exportedAt: new Date().toISOString(), stores };
}

/** Validasi struktur dan versi; kembalikan daftar kesalahan (kosong = valid). */
export function validateBackup(obj) {
  const errs = [];
  if (!obj || obj.app !== 'FitTrack') return ['Bukan file backup FitTrack.'];
  if (!Number.isInteger(obj.schema)) errs.push('Versi database tidak tercantum.');
  else if (obj.schema > DB_VERSION) errs.push(`Backup dibuat oleh versi aplikasi yang lebih baru (skema ${obj.schema}, aplikasi ini ${DB_VERSION}). Perbarui aplikasi dahulu.`);
  if (!obj.stores || typeof obj.stores !== 'object') return [...errs, 'Isi "stores" tidak ada.'];
  for (const [name, rows] of Object.entries(obj.stores)) {
    if (!STORES.includes(name)) { errs.push(`Store tidak dikenal: ${name}`); continue; }
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== 'object' || r.id == null)) errs.push(`Data store ${name} tidak valid.`);
  }
  return errs;
}

export function backupSummary(obj) {
  return Object.entries(obj.stores).filter(([, r]) => r.length).map(([s, r]) => `${s}: ${r.length}`).join(', ') || '(kosong)';
}

/** Ganti seluruh data lokal dengan isi backup. Panggil HANYA setelah konfirmasi pengguna. */
export async function importAll(obj) {
  const errs = validateBackup(obj);
  if (errs.length) throw new Error(errs.join('\n'));
  for (const s of STORES) {
    await db.clear(s);
    const rows = obj.stores[s];
    if (rows?.length) await db.putMany(s, rows, { raw: true });
  }
}

export async function wipeAll() { for (const s of STORES) await db.clear(s); }

// ---------------- Enkripsi opsional ----------------
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function keyFrom(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptBackup(obj, password) {
  if (!password) throw new Error('Password kosong.');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iterations = 250000;
  const key = await keyFrom(password, salt, iterations);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { app: 'FitTrack', encrypted: true, kdf: 'PBKDF2-SHA256', iterations, salt: b64(salt), iv: b64(iv), data: b64(data) };
}
export async function decryptBackup(env, password) {
  try {
    const key = await keyFrom(password, unb64(env.salt), env.iterations);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, key, unb64(env.data));
    return JSON.parse(dec.decode(plain));
  } catch { throw new Error('Password salah atau file rusak.'); }
}

// ---------------- CSV ----------------
export function toCSV(rows) {
  if (!rows.length) return '';
  const keys = [...rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set())];
  const cell = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(','), ...rows.map((r) => keys.map((k) => cell(r[k])).join(','))].join('\r\n');
}

export function downloadBlob(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
