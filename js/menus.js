// Logika murni Menu Favorit / Riwayat / Menu Restoran (tanpa DOM, dapat dites di Node).
//
// menu = { id, name, restaurant?, favorite, note?, uses, lastUsed?, comps: [comp] }
// comp = { id, name, foodId?, amount, unit, grams?, status:'confirmed'|'unknown',
//          n:{kcal,p,c,f,sat,sugar,fiber,na}|null   (nutrisi untuk jumlah dasar `amount`),
//          estimated, confidence, basis, range?:{min,max}, assumptions?, note? }
import { NUTR_KEYS } from './calc.js';
import { round, uid } from './util.js';

export const zeroN = () => Object.fromEntries(NUTR_KEYS.map((k) => [k, 0]));

/** Skalakan nutrisi secara proporsional (porsi baru → hitung ulang). */
export function scaleN(n, factor) {
  if (!n) return null;
  return Object.fromEntries(NUTR_KEYS.map((k) => [k, round((Number(n[k]) || 0) * factor, 2)]));
}

/** Faktor skala komponen untuk jumlah baru; jika jumlah dasar tidak ada, pakai pengali menu. */
export function compFactor(comp, newAmount, multiplier = 1) {
  if (newAmount != null && comp.amount > 0 && Number.isFinite(newAmount)) return newAmount / comp.amount;
  return multiplier;
}

/** Ubah item jurnal menjadi komponen menu. Item pending menjadi komponen 'unknown' (tidak dikarang). */
export function compFromItem(it) {
  const confirmed = it.status !== 'pending';
  const n = confirmed ? Object.fromEntries(NUTR_KEYS.map((k) => [k, Number(it[k]) || 0])) : null;
  return {
    id: uid('c_'), name: it.name, foodId: it.foodId, amount: it.amount ?? 1, unit: it.unit || 'porsi', grams: it.grams,
    status: confirmed ? 'confirmed' : 'unknown', n,
    estimated: confirmed ? it.estimated !== false : true, confidence: it.confidence, basis: it.basis,
    range: !confirmed && Number.isFinite(it.kcalMin) ? { min: it.kcalMin, max: it.kcalMax } : undefined,
    assumptions: it.assumptions, note: it.note,
  };
}

/** Buat data item jurnal dari komponen dengan faktor skala. Komponen tak diketahui → item pending (tanpa angka). */
export function itemFromComp(comp, factor, extra = {}) {
  const base = {
    name: comp.name, foodId: comp.foodId, unit: comp.unit,
    amount: comp.amount != null ? round(comp.amount * factor, 2) : undefined,
    grams: comp.grams != null ? round(comp.grams * factor, 1) : undefined,
    note: comp.note, assumptions: comp.assumptions, ...extra,
  };
  if (comp.status === 'confirmed' && comp.n) {
    return { ...base, ...scaleN(comp.n, factor), status: 'confirmed', estimated: comp.estimated !== false, confidence: comp.confidence || 'sedang', basis: 'menu' };
  }
  return {
    ...base, ...zeroN(), status: 'pending', estimated: true, confidence: 'rendah', basis: 'menu',
    kcalMin: comp.range ? round(comp.range.min * factor, 0) : undefined, kcalMax: comp.range ? round(comp.range.max * factor, 0) : undefined,
  };
}

/** Total menu dari komponen terkonfirmasi. status: 'lengkap' | 'sebagian' | 'belum'. */
export function menuTotals(menu, factors = {}) {
  const total = zeroN();
  let unknown = 0, estimated = 0, confirmed = 0;
  for (const c of menu.comps) {
    if (factors.skip?.has(c.id)) continue;
    const f = factors[c.id] ?? factors.all ?? 1;
    if (c.status === 'confirmed' && c.n) {
      confirmed++;
      if (c.estimated !== false) estimated++;
      for (const k of NUTR_KEYS) total[k] += (Number(c.n[k]) || 0) * f;
    } else unknown++;
  }
  for (const k of NUTR_KEYS) total[k] = round(total[k], 1);
  return { total, unknown, estimated, confirmed, status: !confirmed ? 'belum' : unknown ? 'sebagian' : 'lengkap' };
}

/** Riwayat: item jurnal dikelompokkan per makanan (nama+penjual); data terbaru dipakai. Tanpa duplikasi. */
export function historyFromItems(items) {
  const map = new Map();
  for (const it of [...items].sort((a, b) => (a.date + (a.createdAt || 0)).localeCompare(b.date + (b.createdAt || 0)))) {
    const key = `${(it.name || '').trim().toLowerCase()}|${(it.vendor || '').trim().toLowerCase()}`;
    const prev = map.get(key);
    map.set(key, { key, name: it.name, vendor: it.vendor, last: it, lastDate: it.date, count: (prev?.count || 0) + 1 });
  }
  return [...map.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.count - a.count).map((h) => ({
    id: 'h:' + h.key, history: true, name: h.name, restaurant: h.vendor || undefined, favorite: false, uses: h.count, lastUsed: h.lastDate, comps: [compFromItem(h.last)],
  }));
}

/** Cari berdasarkan nama menu, nama restoran/penjual, atau nama komponen. */
export function matchQuery(entry, q) {
  const s = (q || '').trim().toLowerCase();
  if (!s) return true;
  return [entry.name, entry.restaurant, ...entry.comps.map((c) => c.name)].some((x) => String(x || '').toLowerCase().includes(s));
}

/** Filter kategori: 'favorit' | 'riwayat' | 'restoran' | 'semua'. */
export function categorize(menus, history, cat) {
  if (cat === 'favorit') return menus.filter((m) => m.favorite);
  if (cat === 'restoran') return menus.filter((m) => m.restaurant);
  if (cat === 'riwayat') return history;
  const names = new Set(menus.map((m) => m.name.toLowerCase()));
  return [...menus, ...history.filter((h) => !names.has(h.name.toLowerCase()))];
}

export const newMenu = (p = {}) => ({ name: '', restaurant: '', favorite: true, uses: 0, comps: [], ...p });
export const describeUnknown = (menu) => menu.comps.filter((c) => c.status !== 'confirmed').map((c) => `${c.amount ?? 1} ${c.unit} ${c.name}`).join('; ');
