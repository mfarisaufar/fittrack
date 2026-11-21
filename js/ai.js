// AI Bridge manual: menyusun prompt, memvalidasi jawaban, membandingkan hasil.
// Tidak ada pemanggilan API. Pengguna menyalin prompt ke ChatGPT/Claude lalu menempel jawabannya kembali.
import { addDays, ageFrom, round } from './util.js';
import { sumItems } from './calc.js';
import { METRICS } from './data/labs.js';

export const MARKER = 'FITTRACK_RESULT_JSON';
export const PROVIDERS = {
  chatgpt: { label: 'ChatGPT', url: 'https://chatgpt.com/' },
  claude: { label: 'Claude', url: 'https://claude.ai/' },
};

// kind: 'food' = hasil berisi daftar items makanan; period: 'date' | 'days' | 'none'
export const AI_TYPES = [
  { id: 'food_analysis', label: 'Analisis makanan', kind: 'food', period: 'date', task: 'Analisis makanan yang dicatat pada tanggal tersebut: kualitas gizi, porsi, gula/lemak jenuh/serat/natrium, dan saran perbaikan praktis.' },
  { id: 'food_estimate', label: 'Estimasi kalori makanan', kind: 'food', period: 'none', needsText: 'Deskripsi makanan (nama, porsi, cara masak, bahan)', task: 'Estimasikan kalori dan nutrisi makanan yang dideskripsikan pengguna. Beri rentang (min–maks) dan nilai terbaik.' },
  { id: 'food_rupiah', label: 'Analisis makanan berdasarkan nominal Rupiah', kind: 'food', period: 'none', needsPending: true, task: 'Estimasikan kalori setiap item yang dibeli berdasarkan nominal Rupiah. Harga BUKAN berat; jelaskan asumsi ukuran porsi per harga, beri rentang dan tingkat keyakinan. Jangan memberi satu angka seolah pasti.' },
  { id: 'food_photo', label: 'Analisis foto makanan', kind: 'food', period: 'none', needsText: 'Keterangan foto (opsional)', photoNote: true, task: 'Pengguna akan melampirkan foto makanan secara manual pada percakapan ini. Identifikasi makanan, perkirakan porsi, kalori dan nutrisi dengan rentang serta tingkat keyakinan. Jika foto belum dilampirkan, minta pengguna melampirkannya.' },
  { id: 'daily_calorie', label: 'Analisis kalori harian', kind: 'generic', period: 'date', task: 'Analisis neraca energi pada tanggal tersebut (kalori masuk terkonfirmasi, estimasi yang belum pasti, estimasi kalori keluar) dan komentari dengan hati-hati.' },
  { id: 'diet_eval', label: 'Evaluasi pola makan', kind: 'generic', period: 'days', defaultDays: 7, task: 'Evaluasi pola makan pada periode tersebut: konsistensi, distribusi nutrisi, sumber gula/lemak jenuh/serat/protein, dan relevansinya dengan target pengguna.' },
  { id: 'workout_analysis', label: 'Analisis aktivitas olahraga', kind: 'generic', period: 'days', defaultDays: 14, task: 'Analisis aktivitas olahraga: konsistensi, progres set/repetisi, beban latihan dan pemulihan. Saran progresi harus bertahap dan low-impact.' },
  { id: 'eval_daily', label: 'Evaluasi harian', kind: 'generic', period: 'date', task: 'Buat evaluasi harian singkat: makanan, olahraga, tidur, dan satu-dua prioritas untuk besok.' },
  { id: 'eval_weekly', label: 'Evaluasi mingguan', kind: 'generic', period: 'days', defaultDays: 7, fixedDays: 7, task: 'Buat evaluasi mingguan: tren berat/lingkar perut, rata-rata kalori, konsistensi olahraga, tidur, dan rencana minggu depan.' },
  { id: 'eval_monthly', label: 'Evaluasi bulanan', kind: 'generic', period: 'days', defaultDays: 30, fixedDays: 30, task: 'Buat evaluasi bulanan terhadap target tiga bulan: perubahan dari baseline, kebiasaan, konsistensi, dan rekomendasi periode berikutnya.' },
  { id: 'mcu_analysis', label: 'Analisis MCU', kind: 'generic', period: 'none', task: 'Jelaskan hasil MCU terbaru dengan bahasa awam: apa yang perlu diperhatikan, apa yang perlu dibahas dengan dokter, dan hubungan wajar dengan pola hidup. Jangan mendiagnosis.' },
  { id: 'mcu_compare', label: 'Perbandingan MCU lama dan baru', kind: 'generic', period: 'none', needsTwoMcu: true, task: 'Bandingkan dua hasil MCU: perubahan tiap parameter, arah perubahan, dan hal yang perlu dibahas dengan dokter. Jangan mendiagnosis.' },
  { id: 'diet_reco', label: 'Rekomendasi pola makan', kind: 'generic', period: 'days', defaultDays: 14, task: 'Berikan rekomendasi pola makan realistis dengan makanan Indonesia/Aceh yang mudah didapat, sesuai target. Hindari pantangan ekstrem atau menghilangkan seluruh kelompok makanan tanpa alasan medis.' },
  { id: 'workout_reco', label: 'Rekomendasi olahraga', kind: 'generic', period: 'days', defaultDays: 14, task: 'Berikan rekomendasi olahraga: tanpa alat, low-impact, tanpa lompatan, 20–30 menit; pertahankan jadwal sepak bola Senin dan badminton Rabu; progresi bertahap.' },
  { id: 'qa', label: 'Tanya jawab kesehatan', kind: 'generic', period: 'days', defaultDays: 7, needsText: 'Pertanyaan Anda', task: 'Jawab pertanyaan pengguna menggunakan data yang disertakan bila relevan.' },
];
export const AI_TYPE_BY_ID = Object.fromEntries(AI_TYPES.map((t) => [t.id, t]));

export const DEFAULT_INCLUDE = { profile: true, body: true, bp: true, mcu: true, food: true, activity: true, sleep: true };

function periodOf(type, o) {
  const t = AI_TYPE_BY_ID[type];
  if (t.period === 'date') return { from: o.date, to: o.date };
  if (t.period === 'days') { const n = t.fixedDays || o.days || t.defaultDays || 7; return { from: addDays(o.date, -(n - 1)), to: o.date, days: n }; }
  return null;
}
const inRange = (d, p) => d >= p.from && d <= p.to;
const compactLabs = (values) => Object.fromEntries(Object.entries(values || {}).filter(([k, v]) => METRICS[k] && Number.isFinite(v)).map(([k, v]) => [`${METRICS[k].label} (${METRICS[k].unit})`, v]));

/**
 * Bangun konteks data yang AKAN dikirim. Hanya bagian yang diizinkan (include) yang dimasukkan.
 * Tidak pernah memuat nama, email, atau tanggal lahir; hanya usia.
 */
export function buildContext(type, data, opts = {}) {
  const inc = { ...DEFAULT_INCLUDE, ...(opts.include || {}) };
  const t = AI_TYPE_BY_ID[type];
  const o = { date: opts.date || data.today, days: opts.days, question: opts.question, itemIds: opts.itemIds || [] };
  const per = periodOf(type, o);
  const ctx = { tanggal_acuan: o.date };
  if (per) ctx.periode = per.from === per.to ? per.from : `${per.from} s.d. ${per.to}`;
  const pr = data.profile;

  if (inc.profile && pr) {
    ctx.profil = { jenis_kelamin: pr.sex === 'P' ? 'Perempuan' : 'Laki-laki', usia_tahun: pr.birthDate ? ageFrom(pr.birthDate, o.date) : undefined, tinggi_cm: pr.heightCm };
    if (pr.targets && Object.keys(pr.targets).length) ctx.target_pengguna = pr.targets;
  }
  const meas = data.measurements || [], mcus = data.mcus || [];
  const upto = (arr) => arr.filter((x) => x.date <= o.date);
  if (inc.body) {
    const sel = (type) => upto(meas.filter((m) => m.type === type)).concat(upto(mcus).filter((r) => Number.isFinite(r.values?.[type])).map((r) => ({ date: r.date, value: r.values[type] })));
    const trim = (arr) => arr.sort((a, b) => a.date.localeCompare(b.date)).slice(-(per?.days > 14 ? 12 : 8)).map((x) => ({ tanggal: x.date, nilai: x.value }));
    ctx.tubuh = { berat_kg: trim(sel('weight')), lingkar_perut_cm: trim(sel('waist')) };
  }
  if (inc.bp) {
    const bp = upto(meas.filter((m) => m.type === 'bp')).sort((a, b) => a.date.localeCompare(b.date)).slice(-5).map((m) => ({ tanggal: m.date, sistolik: m.value, diastolik: m.value2 }));
    const mb = upto(mcus).filter((r) => Number.isFinite(r.values?.sys)).map((r) => ({ tanggal: r.date, sistolik: r.values.sys, diastolik: r.values.dia, sumber: 'MCU' }));
    ctx.tekanan_darah = bp.concat(mb).sort((a, b) => a.tanggal.localeCompare(b.tanggal)).slice(-5);
  }
  if (inc.mcu) {
    const sorted = upto(mcus).sort((a, b) => a.date.localeCompare(b.date));
    if (t.needsTwoMcu) {
      const a = mcus.find((m) => m.id === opts.mcuA), b = mcus.find((m) => m.id === opts.mcuB);
      ctx.mcu_lama = a && { tanggal: a.date, hasil: compactLabs(a.values), catatan: a.note || undefined };
      ctx.mcu_baru = b && { tanggal: b.date, hasil: compactLabs(b.values), catatan: b.note || undefined };
    } else if (sorted.length) {
      const last = sorted[sorted.length - 1];
      ctx.mcu_terbaru = { tanggal: last.date, hasil: compactLabs(last.values), usg_abdomen: last.usg || undefined, ekg: last.ekg || undefined, catatan: last.note || undefined };
    }
  }
  if (t.kind === 'food' && t.needsPending) {
    // Item yang dikirim memang diminta pengguna untuk dianalisis — selalu disertakan.
    ctx.item_untuk_dianalisis = (data.foodItems || []).filter((i) => o.itemIds.includes(i.id)).map((i) => ({
      ref: i.id, nama: i.name, harga_rp: i.price ?? 'tidak diketahui', penjual: i.vendor || 'tidak diketahui',
      jumlah: i.amount && i.unit && i.basis !== 'harga' ? `${i.amount} ${i.unit}` : 'tidak diketahui', berat_gram: i.grams && i.basis === 'berat' ? i.grams : 'tidak diketahui',
      catatan: i.note || undefined, rentang_kkal_aplikasi: Number.isFinite(i.kcalMin) ? `${i.kcalMin}–${i.kcalMax}` : 'belum ada',
    }));
  }
  if (t.needsText && o.question) ctx[type === 'qa' ? 'pertanyaan_pengguna' : 'deskripsi_dari_pengguna'] = o.question;

  if (inc.food && per) {
    const items = (data.foodItems || []).filter((i) => inRange(i.date, per));
    const byDay = {};
    for (const i of items) (byDay[i.date] ||= []).push(i);
    const days = Object.keys(byDay).sort();
    const detail = (per.days || 1) <= 7;
    ctx.makanan = days.map((d) => {
      const s = sumItems(byDay[d]);
      const row = { tanggal: d, total_terkonfirmasi: { kkal: round(s.confirmed.kcal, 0), protein_g: s.confirmed.p, karbo_g: s.confirmed.c, lemak_g: s.confirmed.f, lemak_jenuh_g: s.confirmed.sat, gula_g: s.confirmed.sugar, serat_g: s.confirmed.fiber, natrium_mg: s.confirmed.na }, estimasi_keyakinan_rendah_kkal: s.lowKcal, belum_dikonfirmasi: s.pending.count ? `${s.pending.count} item (rentang ${round(s.pending.kcalMin, 0)}–${round(s.pending.kcalMax, 0)} kkal${s.pending.unknown ? `, ${s.pending.unknown} tanpa estimasi` : ''}) — tidak masuk total` : undefined };
      if (detail) row.item = byDay[d].map((i) => `${i.meal}: ${i.name}${i.amount ? ` ${i.amount} ${i.unit || ''}`.trimEnd() : ''}${i.grams ? ` (~${round(i.grams, 0)} g)` : ''} = ${i.status === 'pending' ? 'PENDING' : round(i.kcal, 0) + ' kkal'}${i.estimated ? ' [estimasi]' : ''}`);
      return row;
    });
    if (!detail) {
      const cnt = {};
      for (const i of items) cnt[i.name] = (cnt[i.name] || 0) + 1;
      ctx.makanan_paling_sering = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, c]) => `${n} (${c}x)`);
    }
    if (data.energy) ctx.neraca_energi = data.energy.filter((e) => inRange(e.date, per)).map((e) => ({ tanggal: e.date, kalori_masuk_terkonfirmasi: e.in, estimasi_kalori_keluar: e.out, catatan: 'kalori keluar = BMR (Mifflin-St Jeor) × faktor aktivitas + kalori olahraga netto; hanya estimasi' }));
  }
  if (inc.activity && per) {
    ctx.olahraga = {
      aktivitas: (data.activities || []).filter((a) => inRange(a.date, per)).map((a) => ({ tanggal: a.date, nama: a.name, menit: a.minutes, kkal_estimasi: a.kcal })),
      sesi_latihan: (data.sessions || []).filter((s) => inRange(s.date, per)).map((s) => ({ tanggal: s.date, sesi: s.name, status: s.status, menit: s.durationMin, latihan: (s.exercises || []).map((e) => `${e.name}: target ${e.target}, aktual ${e.actual.join('/') || '-'}`) })),
    };
  }
  if (inc.sleep && per) {
    ctx.tidur = (data.sleep || []).filter((s) => inRange(s.date, per)).map((s) => ({ tanggal: s.date, durasi_jam: round(s.minutes / 60, 1), kualitas_1_5: s.quality, gangguan: s.disturbance || undefined }));
  }
  return ctx;
}

const FOOD_ITEM_SCHEMA = `{
  "type": "<id analisis>",
  "ringkasan": "string",
  "analisis": ["string"],
  "items": [
    { "ref": "<ref dari data jika ada, jika tidak kosongkan>", "nama": "string",
      "grams_min": 0, "grams_best": 0, "grams_max": 0,
      "kcal_min": 0, "kcal_best": 0, "kcal_max": 0,
      "protein_g": 0, "carbs_g": 0, "fat_g": 0, "sat_fat_g": 0, "sugar_g": 0, "fiber_g": 0, "sodium_mg": 0,
      "keyakinan": "rendah|sedang|tinggi", "asumsi": ["string"] }
  ],
  "asumsi": ["string"],
  "keyakinan": "rendah|sedang|tinggi",
  "rekomendasi": ["string"],
  "perlu_konfirmasi": ["string"]
}`;
const GENERIC_SCHEMA = `{
  "type": "<id analisis>",
  "ringkasan": "string",
  "analisis": ["string"],
  "asumsi": ["string"],
  "keyakinan": "rendah|sedang|tinggi",
  "rekomendasi": ["string"],
  "perlu_konfirmasi": ["string"]
}`;

export function buildPrompt(type, data, opts = {}) {
  const t = AI_TYPE_BY_ID[type];
  const ctx = buildContext(type, data, opts);
  const schema = (t.kind === 'food' ? FOOD_ITEM_SCHEMA : GENERIC_SCHEMA).replace('<id analisis>', type);
  return `Kamu adalah asisten analisis gizi dan kebugaran untuk aplikasi pencatatan pribadi "FitTrack". Jawab dalam Bahasa Indonesia.

ATURAN PENTING
- Kamu BUKAN dokter dan tidak memberi diagnosis. Untuk hasil laboratorium, obat, atau keputusan medis, arahkan pengguna berkonsultasi dengan dokter.
- Bedakan data AKTUAL (hasil pencatatan/pengukuran) dari ESTIMASI. Jangan mengarang data yang tidak ada; jika data kurang, katakan apa yang kurang.
- Jangan menyarankan pantangan ekstrem atau menghapus seluruh kelompok makanan tanpa alasan medis. Rekomendasi harus realistis, bertahap, dan memakai makanan yang lazim di Indonesia/Aceh.
- Untuk estimasi kalori, beri rentang (min–maks), nilai terbaik, asumsi, dan tingkat keyakinan. Jangan menyajikan estimasi sebagai angka pasti.
- Kalori keluar adalah estimasi, bukan pengukuran. Satu hari defisit bukan bukti penurunan lemak.

TUGAS: ${t.label}
${t.task}

DATA PENGGUNA (JSON; hanya data yang diizinkan pengguna)
${JSON.stringify(ctx, null, 1)}

FORMAT JAWABAN (urut)
1. Ringkasan
2. Analisis
3. Estimasi kalori dan nutrisi (jika relevan)
4. Asumsi perhitungan
5. Tingkat keyakinan
6. Rekomendasi
7. Hal yang perlu dikonfirmasi

Setelah jawaban di atas, WAJIB akhiri dengan satu baris berisi persis ${MARKER} diikuti satu blok kode json yang valid (tanpa komentar, angka memakai titik desimal, satuan seperti pada nama field) dengan skema:
${MARKER}
\`\`\`json
${schema}
\`\`\``;
}

// ---------------- Parser & validasi ----------------
function balancedObject(text, start) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

/** Cari blok setelah penanda FITTRACK_RESULT_JSON dan parse. Tidak pernah melempar error. */
export function extractResult(text) {
  if (!text || !text.trim()) return { ok: false, error: 'Teks jawaban kosong.' };
  const idx = text.lastIndexOf(MARKER);
  if (idx < 0) return { ok: false, error: `Penanda ${MARKER} tidak ditemukan dalam jawaban.` };
  const rest = text.slice(idx + MARKER.length);
  const open = rest.indexOf('{');
  if (open < 0) return { ok: false, error: 'Tidak ada objek JSON setelah penanda.' };
  const raw = balancedObject(rest, open);
  if (!raw) return { ok: false, error: 'JSON tidak lengkap (kurung kurawal tidak seimbang). Jawaban mungkin terpotong.' };
  try { return { ok: true, data: JSON.parse(raw), rawJson: raw }; }
  catch (e) { return { ok: false, error: `JSON tidak valid: ${e.message}` }; }
}

const CONF = ['rendah', 'sedang', 'tinggi'];
const NUMF = ['grams_min', 'grams_best', 'grams_max', 'kcal_min', 'kcal_best', 'kcal_max', 'protein_g', 'carbs_g', 'fat_g', 'sat_fat_g', 'sugar_g', 'fiber_g', 'sodium_mg'];
const LIMITS = { kcal_best: 5000, kcal_max: 8000, grams_max: 3000, protein_g: 250, carbs_g: 600, fat_g: 300, sat_fat_g: 150, sugar_g: 400, fiber_g: 100, sodium_mg: 10000 };

/** Validasi struktur, satuan, dan nilai tidak masuk akal. errors = tidak boleh disimpan; warnings = periksa. */
export function validateResult(obj, expectedType) {
  const errors = [], warnings = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: ['Hasil bukan objek JSON.'], warnings };
  const t = AI_TYPE_BY_ID[obj.type];
  if (!obj.type) errors.push('Field "type" tidak ada.');
  else if (!t) errors.push(`Jenis analisis "${obj.type}" tidak dikenal.`);
  else if (expectedType && obj.type !== expectedType) warnings.push(`Jenis hasil (${obj.type}) berbeda dari yang diminta (${expectedType}).`);
  if (typeof obj.ringkasan !== 'string' || !obj.ringkasan.trim()) errors.push('Field "ringkasan" (teks) wajib ada.');
  for (const f of ['analisis', 'asumsi', 'rekomendasi', 'perlu_konfirmasi']) {
    if (obj[f] != null && !(Array.isArray(obj[f]) && obj[f].every((x) => typeof x === 'string'))) errors.push(`Field "${f}" harus berupa daftar teks.`);
  }
  if (obj.keyakinan != null && !CONF.includes(obj.keyakinan)) warnings.push(`Nilai keyakinan "${obj.keyakinan}" tidak standar (rendah/sedang/tinggi).`);
  const isFood = t?.kind === 'food';
  if (isFood) {
    if (!Array.isArray(obj.items) || !obj.items.length) errors.push('Analisis makanan harus memiliki daftar "items".');
    else obj.items.forEach((it, i) => {
      const nm = `items[${i}]${it?.nama ? ` (${it.nama})` : ''}`;
      if (!it || typeof it !== 'object') { errors.push(`${nm}: bukan objek.`); return; }
      if (typeof it.nama !== 'string' || !it.nama.trim()) errors.push(`${nm}: "nama" wajib ada.`);
      for (const f of NUMF) {
        if (it[f] == null) continue;
        if (typeof it[f] !== 'number' || !Number.isFinite(it[f])) errors.push(`${nm}: "${f}" harus angka (tanpa satuan/teks).`);
        else if (it[f] < 0) errors.push(`${nm}: "${f}" tidak boleh negatif.`);
        else if (LIMITS[f] && it[f] > LIMITS[f]) warnings.push(`${nm}: ${f}=${it[f]} tampak tidak masuk akal (> ${LIMITS[f]}). Periksa satuan.`);
      }
      if (typeof it.kcal_best !== 'number') errors.push(`${nm}: "kcal_best" wajib ada.`);
      else {
        if (it.kcal_min != null && it.kcal_max != null && !(it.kcal_min <= it.kcal_best && it.kcal_best <= it.kcal_max)) warnings.push(`${nm}: urutan rentang kkal tidak konsisten (min ≤ terbaik ≤ maks).`);
        const calc = 4 * (it.protein_g || 0) + 4 * (it.carbs_g || 0) + 9 * (it.fat_g || 0);
        if (calc > 0 && it.kcal_best > 0 && Math.abs(calc - it.kcal_best) / it.kcal_best > 0.45) warnings.push(`${nm}: kkal (${it.kcal_best}) tidak sejalan dengan makronutrien (≈${Math.round(calc)} kkal).`);
      }
      if (it.keyakinan != null && !CONF.includes(it.keyakinan)) warnings.push(`${nm}: keyakinan "${it.keyakinan}" tidak standar.`);
    });
  }
  return { ok: errors.length === 0, errors, warnings };
}

// ---------------- Perbandingan ----------------
const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
function jaccard(a, b) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}
function matchLists(a = [], b = []) {
  const common = [], usedB = new Set();
  const onlyA = [];
  for (const x of a) {
    let best = -1, bs = 0;
    b.forEach((y, j) => { if (usedB.has(j)) return; const s = jaccard(x, y); if (s > bs) { bs = s; best = j; } });
    if (best >= 0 && bs >= 0.35) { usedB.add(best); common.push({ a: x, b: b[best], sim: round(bs, 2) }); } else onlyA.push(x);
  }
  return { common, onlyA, onlyB: b.filter((_, j) => !usedB.has(j)) };
}

/** Bandingkan dua hasil terstruktur (A, B). Perbandingan dilakukan lokal; tidak memanggil AI. */
export function compareResults(a, b) {
  const out = { numeric: [], recommendations: matchLists(a.rekomendasi, b.rekomendasi), analysis: matchLists(a.analisis, b.analisis), assumptions: { a: a.asumsi || [], b: b.asumsi || [] }, confirm: { a: a.perlu_konfirmasi || [], b: b.perlu_konfirmasi || [] }, confidence: { a: a.keyakinan, b: b.keyakinan } };
  const norm = (s) => String(s).toLowerCase().trim();
  for (const ia of a.items || []) {
    const ib = (b.items || []).find((x) => (ia.ref && x.ref === ia.ref) || norm(x.nama) === norm(ia.nama)) || (a.items.length === 1 && b.items?.length === 1 ? b.items[0] : null);
    if (!ib) { out.numeric.push({ name: ia.nama, field: 'kcal_best', a: ia.kcal_best, b: null, diffPct: null }); continue; }
    for (const f of ['kcal_best', 'kcal_min', 'kcal_max', 'grams_best', 'protein_g', 'carbs_g', 'fat_g', 'sugar_g', 'sodium_mg']) {
      if (ia[f] == null && ib[f] == null) continue;
      const base = Math.max(Math.abs(ia[f] ?? 0), Math.abs(ib[f] ?? 0));
      out.numeric.push({ name: ia.nama, field: f, a: ia[f], b: ib[f], diffPct: base ? round(Math.abs((ia[f] ?? 0) - (ib[f] ?? 0)) / base * 100, 0) : 0 });
    }
  }
  for (const ib of b.items || []) if (!(a.items || []).some((x) => (ib.ref && x.ref === ib.ref) || norm(x.nama) === norm(ib.nama)) && !(a.items?.length === 1 && b.items.length === 1)) out.numeric.push({ name: ib.nama, field: 'kcal_best', a: null, b: ib.kcal_best, diffPct: null });
  out.numericDiffs = out.numeric.filter((n) => n.diffPct == null || n.diffPct >= 15);
  return out;
}

/** Prompt sintesis untuk ditempel ke ChatGPT atau Claude. */
export function buildSynthesisPrompt(a, b, labels = { a: 'ChatGPT', b: 'Claude' }) {
  return `Berikut dua hasil analisis untuk pertanyaan yang sama dari dua asisten AI berbeda (${labels.a} dan ${labels.b}). Bandingkan dengan teliti dan buat sintesis. Jawab dalam Bahasa Indonesia; kamu bukan dokter dan tidak mendiagnosis.

HASIL ${labels.a.toUpperCase()}
${JSON.stringify(a)}

HASIL ${labels.b.toUpperCase()}
${JSON.stringify(b)}

LAKUKAN
1. Sebutkan poin yang disepakati keduanya.
2. Sebutkan perbedaan nilai/angka dan penyebab yang mungkin (asumsi berbeda).
3. Tentukan nilai atau rekomendasi gabungan yang paling masuk akal beserta alasannya; jangan menyajikan estimasi sebagai angka pasti.
4. Sebutkan hal yang harus dikonfirmasi pengguna.

Akhiri dengan satu baris ${MARKER} diikuti blok kode json valid dengan skema yang sama seperti kedua hasil di atas (field "type" sama; tambahkan "sintesis": true).`;
}

export const AI_PRIVACY_NOTE = 'Data yang Anda tempel ke ChatGPT atau Claude tunduk pada kebijakan privasi dan pengaturan akun layanan masing-masing. FitTrack tidak dapat mengontrol penyimpanannya di sana dan tidak mengklaim data tersebut otomatis tidak disimpan.';
