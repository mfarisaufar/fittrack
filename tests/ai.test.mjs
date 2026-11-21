import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, buildContext, extractResult, validateResult, compareResults, buildSynthesisPrompt, MARKER, AI_TYPES } from '../js/ai.js';

const data = {
  today: '2026-11-21',
  profile: { sex: 'L', birthDate: '1997-03-04', heightCm: 167, name: 'RAHASIA', targets: { weightMax: 75 } },
  measurements: [{ type: 'weight', date: '2026-11-20', value: 77.5 }, { type: 'bp', date: '2026-11-20', value: 118, value2: 76 }],
  mcus: [{ id: 'm1', date: '2026-11-16', values: { weight: 77.9, tg: 211, ldl: 136 }, usg: 'catatan usg' }],
  foodItems: [
    { id: 'f1', date: '2026-11-21', meal: 'siang', name: 'Nasi goreng', amount: 1, unit: 'porsi', grams: 250, kcal: 475, status: 'confirmed', p: 12, c: 62, f: 20, sat: 4, sugar: 2, fiber: 2, na: 1250 },
    { id: 'p1', date: '2026-11-21', meal: 'camilan', name: 'Pentol', price: 10000, basis: 'harga', kcalMin: 160, kcalMax: 400, status: 'pending' },
  ],
  activities: [], sessions: [], sleep: [],
};
const opts = { date: '2026-11-21', itemIds: ['p1'], question: 'apa kabar' };

test('15 jenis prompt: ada marker + skema, tanpa identitas', () => {
  assert.equal(AI_TYPES.length, 15);
  for (const t of AI_TYPES) {
    const p = buildPrompt(t.id, data, { ...opts, mcuA: 'm1', mcuB: 'm1' });
    assert.ok(p.includes(MARKER), t.id);
    assert.ok(p.includes('"type": "' + t.id + '"'), t.id);
    assert.ok(!p.includes('RAHASIA') && !p.includes('1997-03-04'), 'nama/tanggal lahir bocor');
    assert.ok(/BUKAN dokter/.test(p));
  }
});

test('opsi privasi: MCU, tubuh, profil, makanan dapat dikecualikan', () => {
  const full = JSON.stringify(buildContext('eval_daily', data, { ...opts, include: {} }));
  assert.ok(full.includes('211'));
  assert.ok(full.includes('usia_tahun'));
  const s = JSON.stringify(buildContext('eval_daily', data, { ...opts, include: { mcu: false, body: false, bp: false, profile: false, food: false } }));
  for (const x of ['211', '77.5', 'usia_tahun', 'Nasi goreng', 'catatan usg']) assert.ok(!s.includes(x), x);
});

test('item pending dikirim sebagai "tidak diketahui"; total terkonfirmasi terpisah', () => {
  const it = buildContext('food_rupiah', data, opts).item_untuk_dianalisis[0];
  assert.equal(it.harga_rp, 10000);
  assert.equal(it.berat_gram, 'tidak diketahui');
  assert.equal(it.jumlah, 'tidak diketahui');
  assert.equal(it.ref, 'p1');
  const day = buildContext('eval_daily', data, opts).makanan[0];
  assert.equal(day.total_terkonfirmasi.kkal, 475);
  assert.ok(day.belum_dikonfirmasi.includes('tidak masuk total'));
});

const good = {
  type: 'food_rupiah', ringkasan: 'ok', analisis: ['a'],
  items: [{ ref: 'p1', nama: 'Pentol', grams_min: 80, grams_best: 120, grams_max: 160, kcal_min: 120, kcal_best: 180, kcal_max: 240, protein_g: 9, carbs_g: 22, fat_g: 6, keyakinan: 'rendah' }],
  asumsi: ['x'], keyakinan: 'rendah', rekomendasi: ['kurangi gorengan'], perlu_konfirmasi: ['jumlah buah'],
};

test('parser: blok setelah marker, code fence, kurung di dalam string', () => {
  const text = `Ringkasan...\n{"palsu":1}\n${MARKER}\n\`\`\`json\n${JSON.stringify(good, null, 2)}\n\`\`\`\nSelesai`;
  const r = extractResult(text);
  assert.ok(r.ok);
  assert.equal(r.data.items[0].nama, 'Pentol');
  assert.ok(validateResult(r.data, 'food_rupiah').ok);
  const tricky = extractResult(`${MARKER}\n{"type":"qa","ringkasan":"kurung } di dalam string { ok","analisis":[]}`);
  assert.ok(tricky.ok);
  assert.equal(tricky.data.ringkasan, 'kurung } di dalam string { ok');
});

test('parser: JSON tidak valid / marker hilang / terpotong -> ditolak', () => {
  assert.equal(extractResult('tidak ada').ok, false);
  assert.equal(extractResult(`${MARKER}\n{"type": "qa", `).ok, false);
  assert.equal(extractResult(`${MARKER}\n{"type": qa}`).ok, false);
  assert.equal(extractResult('').ok, false);
});

test('validator: struktur, tipe angka, negatif, tidak masuk akal', () => {
  assert.equal(validateResult({ type: 'qa' }).ok, false);
  const bad = structuredClone(good); bad.items[0].kcal_best = '180 kkal';
  assert.ok(validateResult(bad).errors.some((e) => e.includes('kcal_best')));
  const neg = structuredClone(good); neg.items[0].protein_g = -5;
  assert.equal(validateResult(neg).ok, false);
  const huge = structuredClone(good); huge.items[0].kcal_best = 90000;
  assert.ok(validateResult(huge).warnings.length > 0);
  const ord = structuredClone(good); ord.items[0].kcal_min = 300;
  assert.ok(validateResult(ord).warnings.some((w) => w.includes('urutan')));
  assert.equal(validateResult({ ...good, type: 'tidak_ada' }).ok, false);
  assert.equal(validateResult({ ...good, items: [] }).ok, false);
});

test('perbandingan dua hasil + prompt sintesis', () => {
  const b = structuredClone(good);
  Object.assign(b.items[0], { kcal_best: 320, kcal_min: 250, kcal_max: 400 });
  b.rekomendasi = ['Kurangi gorengan berminyak', 'Tambah sayur'];
  b.keyakinan = 'sedang';
  const c = compareResults(good, b);
  assert.ok(c.numericDiffs.some((n) => n.field === 'kcal_best' && n.diffPct >= 40));
  assert.equal(c.recommendations.common.length, 1);
  assert.equal(c.recommendations.onlyB.length, 1);
  assert.deepEqual(c.confidence, { a: 'rendah', b: 'sedang' });
  const syn = buildSynthesisPrompt(good, b);
  assert.ok(syn.includes(MARKER) && syn.includes('CHATGPT') && syn.includes('CLAUDE'));
});
