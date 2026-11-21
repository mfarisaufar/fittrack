// Logika perhitungan murni: nutrisi, neraca energi, estimasi Rupiah, deret data kesehatan.
import { round, sum, parseDate, ageFrom } from './util.js';

export { ageFrom };

// ---------------- Satuan rumah tangga ----------------
export const UNIT_DEFAULTS = { gram: 1, mililiter: 1, sendok: 10, centong: 100, gelas: 240, piring: 250, porsi: 200, potong: 50, buah: 50, bungkus: 50 };
export const UNITS = ['gram', 'mililiter', 'centong', 'sendok', 'potong', 'buah', 'piring', 'porsi', 'gelas', 'bungkus'];

export function unitGrams(food, unit) {
  if (unit === 'gram' || unit === 'mililiter') return 1;
  return food?.u?.[unit] ?? UNIT_DEFAULTS[unit] ?? 1;
}
/** true jika berat satuan berasal dari data makanan tersebut (bukan angka umum). */
export const unitIsSpecific = (food, unit) => unit === 'gram' || unit === 'mililiter' || food?.u?.[unit] != null;

// ---------------- Nutrisi ----------------
export const NUTR_KEYS = ['kcal', 'p', 'c', 'f', 'sat', 'sugar', 'fiber', 'na'];
export const NUTR_LABEL = { kcal: 'Kalori', p: 'Protein', c: 'Karbohidrat', f: 'Lemak total', sat: 'Lemak jenuh', sugar: 'Gula', fiber: 'Serat', na: 'Natrium' };
export const NUTR_UNIT = { kcal: 'kkal', p: 'g', c: 'g', f: 'g', sat: 'g', sugar: 'g', fiber: 'g', na: 'mg' };

export function nutrientsFor(food, grams) {
  const k = grams / 100;
  const o = {};
  for (const key of NUTR_KEYS) o[key] = round((food[key] || 0) * k, 2);
  return o;
}
const zero = () => Object.fromEntries(NUTR_KEYS.map((k) => [k, 0]));

/**
 * Jumlahkan item makanan dengan memisahkan:
 *  - confirmed : item berstatus confirmed (termasuk estimasi yang sudah disetujui)
 *  - lowKcal   : bagian dari confirmed yang keyakinannya 'rendah'
 *  - pending   : item yang belum dikonfirmasi — TIDAK dimasukkan ke total confirmed
 */
export function sumItems(items) {
  const confirmed = zero();
  const pending = { count: 0, kcalMin: 0, kcalMax: 0, unknown: 0 };
  let lowKcal = 0;
  for (const it of items) {
    if (it.status === 'pending') {
      pending.count++;
      if (Number.isFinite(it.kcalMin) && Number.isFinite(it.kcalMax)) { pending.kcalMin += it.kcalMin; pending.kcalMax += it.kcalMax; }
      else pending.unknown++;
    } else {
      for (const k of NUTR_KEYS) confirmed[k] += Number(it[k]) || 0;
      if (it.confidence === 'rendah') lowKcal += Number(it.kcal) || 0;
    }
  }
  for (const k of NUTR_KEYS) confirmed[k] = round(confirmed[k], 1);
  return { confirmed, lowKcal: round(lowKcal, 0), pending };
}

// ---------------- Estimasi berdasarkan nominal Rupiah ----------------
/**
 * Prinsip: harga TIDAK dianggap sebagai berat. Jika berat/jumlah tidak diketahui, hasilnya berupa rentang
 * berstatus pending dengan keyakinan rendah (berdasarkan asumsi harga per 100 g yang tertera di data makanan).
 */
export function rupiahEstimate(food, price, { qty, unit, grams } = {}) {
  const assumptions = [];
  if (!food) return { status: 'pending', confidence: 'rendah', basis: 'tidak-diketahui', range: null, assumptions: ['Makanan tidak ada di database; nilai kalori belum diketahui.'] };
  let g = null, basis, confidence;
  if (grams > 0) { g = grams; basis = 'berat'; confidence = 'sedang'; assumptions.push(`Menggunakan berat yang Anda masukkan: ${g} g.`); }
  else if (qty > 0 && unit) {
    g = qty * unitGrams(food, unit); basis = 'jumlah';
    confidence = unitIsSpecific(food, unit) ? 'sedang' : 'rendah';
    assumptions.push(`1 ${unit} ≈ ${unitGrams(food, unit)} g (perkiraan; ukuran sebenarnya dapat berbeda).`);
  }
  if (g != null) {
    return { status: 'confirmed', confidence, basis, grams: { min: g, max: g, best: g }, kcal: { min: round(food.kcal * g / 100, 0), max: round(food.kcal * g / 100, 0), best: round(food.kcal * g / 100, 0) }, assumptions, nutrients: nutrientsFor(food, g) };
  }
  if (food.idr && price > 0) {
    const [lo, hi] = food.idr;
    const gMin = price / hi * 100, gMax = price / lo * 100, gBest = (gMin + gMax) / 2;
    assumptions.push(`Harga dianggap berkisar Rp${lo.toLocaleString('id-ID')}–Rp${hi.toLocaleString('id-ID')} per 100 g (asumsi umum, bukan data penjual Anda).`);
    assumptions.push('Berat dan jumlah tidak diketahui, sehingga hasil berupa rentang dan belum dihitung sebagai kalori pasti.');
    return {
      status: 'pending', confidence: 'rendah', basis: 'harga',
      grams: { min: round(gMin, 0), max: round(gMax, 0), best: round(gBest, 0) },
      kcal: { min: round(food.kcal * gMin / 100, 0), max: round(food.kcal * gMax / 100, 0), best: round(food.kcal * gBest / 100, 0) },
      assumptions, nutrients: nutrientsFor(food, gBest),
    };
  }
  return { status: 'pending', confidence: 'rendah', basis: 'tidak-diketahui', range: null, assumptions: ['Informasi belum cukup untuk estimasi (belum ada berat/jumlah dan tidak ada asumsi harga untuk makanan ini). Isi manual atau minta bantuan AI.'] };
}

// ---------------- Energi ----------------
/** Mifflin-St Jeor. sex: 'L' (laki-laki) / 'P' (perempuan). */
export function bmr({ sex, weightKg, heightCm, age }) {
  return round(10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'P' ? -161 : 5), 0);
}
export const bmi = (w, hCm) => (w && hCm ? round(w / (hCm / 100) ** 2, 1) : null);
/**
 * Kalori olahraga NETTO = (MET − 1) × kg × jam. Dikurangi 1 MET karena energi istirahat sudah ada di BMR×PAL
 * (menghindari penghitungan ganda).
 */
export function exerciseKcal(met, weightKg, minutes) {
  return round(Math.max(0, met - 1) * weightKg * minutes / 60, 0);
}
/** Total pengeluaran = BMR × PAL (aktivitas harian non-olahraga) + kalori olahraga netto. Estimasi, bukan pengukuran. */
export function energyOut({ bmrKcal, pal, exercise }) {
  const base = Math.round(bmrKcal * pal);
  return { bmr: bmrKcal, base, exercise: Math.round(exercise), total: base + Math.round(exercise) };
}
export const PAL_OPTIONS = [
  [1.2, 'Sangat ringan (duduk/kerja meja, sedikit jalan)'],
  [1.3, 'Ringan (sedikit berdiri/berjalan)'],
  [1.4, 'Sedang (sering berdiri/berjalan)'],
  [1.5, 'Aktif (pekerjaan fisik)'],
];
export const SPORT_MET = {
  sepakbola: { label: 'Sepak bola', levels: [['Santai', 5], ['Umum', 7], ['Kompetitif', 10]] },
  badminton: { label: 'Badminton', levels: [['Santai', 4.5], ['Umum', 5.5], ['Kompetitif', 7]] },
  jalan: { label: 'Jalan kaki', levels: [['Pelan', 2.8], ['Sedang', 3.5], ['Cepat', 4.5]] },
  lain: { label: 'Aktivitas lain', levels: [['Ringan', 3], ['Sedang', 4.5], ['Berat', 6.5]] },
};
export const HOME_WORKOUT_MET = 3.5;

// ---------------- Deret data kesehatan ----------------
/** Gabungkan health_measurements + mcu_records menjadi deret terurut tanggal untuk satu metrik. */
export function seriesFor(key, measurements, mcus) {
  const out = [];
  for (const m of measurements) {
    if (m.type === key) out.push({ date: m.date, value: m.value, src: 'catatan', id: m.id });
    else if (m.type === 'bp' && key === 'sys') out.push({ date: m.date, value: m.value, src: 'catatan', id: m.id });
    else if (m.type === 'bp' && key === 'dia' && m.value2 != null) out.push({ date: m.date, value: m.value2, src: 'catatan', id: m.id });
  }
  for (const r of mcus) {
    const v = r.values?.[key];
    if (Number.isFinite(v)) out.push({ date: r.date, value: v, src: 'mcu', id: r.id });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.src === 'mcu' ? -1 : 1));
}
export const latestOf = (series) => (series.length ? series[series.length - 1] : null);

/** Persentase perkembangan menuju target. baseline→target; 100% = target tercapai. */
export function progressPct(baseline, current, target) {
  if (![baseline, current, target].every(Number.isFinite) || baseline === target) return null;
  return round((baseline - current) / (baseline - target) * 100, 0);
}

/** Baris tabel progres tiga bulan: baseline, target, terkini, selisih, persen. */
export function targetRows(profile, mcus, measurements) {
  const t = profile?.targets || {};
  const base = (mcus.find((m) => m.isBaseline) || {}).values || {};
  const rows = [];
  const add = (key, label, unit, baseline, targetText, targetVal, cur, note) => {
    rows.push({ key, label, unit, baseline, targetText, current: cur, delta: Number.isFinite(cur) && Number.isFinite(baseline) ? round(cur - baseline, 1) : null, pct: progressPct(baseline, cur, targetVal), note });
  };
  const cur = (k) => latestOf(seriesFor(k, measurements, mcus))?.value;
  if (t.weightMax || t.weightMin) add('weight', 'Berat badan', 'kg', base.weight, `${t.weightMin ?? '?'}–${t.weightMax ?? '?'} kg`, t.weightMax ?? t.weightMin, cur('weight'));
  if (t.waistMax || t.waistMin) add('waist', 'Lingkar perut', 'cm', base.waist, `${t.waistMin ?? '?'}–${t.waistMax ?? '?'} cm`, t.waistMax ?? t.waistMin, cur('waist'));
  if (t.tg) add('tg', 'Trigliserida', 'mg/dL', base.tg, `< ${t.tg} mg/dL`, t.tg, cur('tg'));
  if (t.ldl) add('ldl', 'LDL', 'mg/dL', base.ldl, `< ${t.ldl} mg/dL (bahas dengan dokter)`, t.ldl, cur('ldl'));
  if (base.hdl != null) add('hdl', 'HDL', 'mg/dL', base.hdl, 'Dipantau', null, cur('hdl'));
  return rows;
}

// ---------------- Agregasi harian ----------------
/**
 * Hitung ringkasan satu hari. Semua masukan berasal dari data tercatat.
 * @returns {{in:object, out:object|null, balance:number|null}}
 */
export function dayEnergy({ items, activities, sessions, bmrKcal, pal }) {
  const s = sumItems(items);
  const ex = sum(activities.map((a) => a.kcal)) + sum(sessions.filter((x) => x.status === 'selesai').map((x) => x.kcal));
  const out = bmrKcal ? energyOut({ bmrKcal, pal, exercise: ex }) : null;
  const balance = out && s.confirmed.kcal > 0 ? Math.round(s.confirmed.kcal - out.total) : null; // + surplus, − defisit
  return { in: s, out, balance, exercise: Math.round(ex) };
}
export const isValidDateStr = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime());
