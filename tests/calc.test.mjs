import test from 'node:test';
import assert from 'node:assert/strict';
import { bmr, bmi, exerciseKcal, energyOut, sumItems, rupiahEstimate, unitGrams, nutrientsFor, progressPct, seriesFor, dayEnergy, targetRows } from '../js/calc.js';
import { FOOD_BY_ID } from '../js/data/foods.js';
import { parseNum, parseRupiah, ageFrom, sleepMinutes, weekdayIdx, addDays } from '../js/util.js';

test('parseNum & parseRupiah', () => {
  assert.equal(parseNum('77,9'), 77.9);
  assert.equal(parseNum('1.234,5'), 1234.5);
  assert.ok(Number.isNaN(parseNum('')));
  assert.equal(parseRupiah('Rp 10.000'), 10000);
});

test('BMR Mifflin-St Jeor & BMI', () => {
  assert.equal(bmr({ sex: 'L', weightKg: 80, heightCm: 170, age: 30 }), 1718); // 800+1062.5-150+5 = 1717.5
  assert.equal(bmr({ sex: 'P', weightKg: 60, heightCm: 160, age: 30 }), 1289); // 600+1000-150-161
  assert.equal(bmi(77.9, 167), 27.9);
});

test('olahraga netto tidak menghitung ganda MET istirahat', () => {
  assert.equal(exerciseKcal(1, 70, 60), 0);
  assert.equal(exerciseKcal(7, 70, 60), 420);
  const o = energyOut({ bmrKcal: 1700, pal: 1.3, exercise: 300 });
  assert.equal(o.base, 2210);
  assert.equal(o.total, 2510);
});

test('nasi goreng + ayam + ikan dijumlahkan', () => {
  const mk = (id, amount, unit) => {
    const f = FOOD_BY_ID[id];
    return { ...nutrientsFor(f, amount * unitGrams(f, unit)), status: 'confirmed', confidence: 'sedang' };
  };
  const s = sumItems([mk('nasi-goreng', 1, 'porsi'), mk('ayam-goreng', 1, 'potong'), mk('ikan-goreng', 1, 'potong')]);
  const expected = 190 * 2.5 + 260 * 0.85 + 210 * 0.8;
  assert.ok(Math.abs(s.confirmed.kcal - expected) < 3, `${s.confirmed.kcal} vs ${expected}`);
});

test('Pentol Rp10.000 tanpa jumlah/berat -> pending, rentang, keyakinan rendah, tidak masuk total', () => {
  const est = rupiahEstimate(FOOD_BY_ID.pentol, 10000, {});
  assert.equal(est.status, 'pending');
  assert.equal(est.confidence, 'rendah');
  assert.ok(est.kcal.min < est.kcal.max);
  assert.ok(est.assumptions.length >= 2);
  const pend = { status: 'pending', kcal: 0, kcalMin: est.kcal.min, kcalMax: est.kcal.max };
  const conf = { status: 'confirmed', kcal: 300, p: 0, c: 0, f: 0, sat: 0, sugar: 0, fiber: 0, na: 0, confidence: 'rendah' };
  const s = sumItems([pend, conf]);
  assert.equal(s.confirmed.kcal, 300);
  assert.equal(s.pending.count, 1);
  assert.equal(s.lowKcal, 300);
  assert.ok(s.pending.kcalMax > s.pending.kcalMin);
});

test('Rupiah: berat/jumlah yang diketahui dipakai, harga bukan berat', () => {
  const byWeight = rupiahEstimate(FOOD_BY_ID.pentol, 10000, { grams: 100 });
  assert.equal(byWeight.status, 'confirmed');
  assert.equal(byWeight.kcal.best, 150);
  const byQty = rupiahEstimate(FOOD_BY_ID['bakso-goreng'], 10000, { qty: 5, unit: 'buah' });
  assert.equal(byQty.status, 'confirmed');
  assert.equal(byQty.grams.best, 125);
});

test('Rupiah: makanan tanpa asumsi harga -> pending tanpa angka (tidak mengarang)', () => {
  const est = rupiahEstimate(FOOD_BY_ID['nasi-putih'], 10000, {});
  assert.equal(est.status, 'pending');
  assert.equal(est.kcal, undefined);
  assert.equal(rupiahEstimate(null, 5000, {}).status, 'pending');
});

test('progres menuju target & seriesFor menggabungkan MCU + catatan', () => {
  assert.equal(progressPct(77.9, 76.4, 75), 52);
  const s = seriesFor('weight', [{ type: 'weight', date: '2026-11-20', value: 77, id: 'a' }], [{ id: 'm', date: '2026-11-16', values: { weight: 77.9 } }]);
  assert.deepEqual(s.map((x) => x.value), [77.9, 77]);
  assert.equal(seriesFor('dia', [{ type: 'bp', date: '2026-11-20', value: 120, value2: 80 }], [])[0].value, 80);
});

test('targetRows memakai baseline tanpa menimpanya', () => {
  const mcus = [
    { id: 'b', isBaseline: true, date: '2026-11-16', values: { weight: 78, tg: 210 } },
    { id: 'n', date: '2027-02-16', values: { weight: 75.5, tg: 160 } },
  ];
  const rows = targetRows({ targets: { weightMin: 74, weightMax: 75, tg: 150 } }, mcus, []);
  const w = rows.find((r) => r.key === 'weight');
  const tg = rows.find((r) => r.key === 'tg');
  assert.equal(w.baseline, 78);
  assert.equal(w.current, 75.5);
  assert.equal(w.delta, -2.5);
  assert.equal(tg.pct, Math.round((210 - 160) / (210 - 150) * 100));
});

test('dayEnergy: selisih hanya dihitung jika ada makanan terkonfirmasi', () => {
  const e = dayEnergy({ items: [], activities: [], sessions: [], bmrKcal: 1700, pal: 1.3 });
  assert.equal(e.balance, null);
  assert.equal(e.out.total, 2210);
  const item = { status: 'confirmed', kcal: 2000, p: 0, c: 0, f: 0, sat: 0, sugar: 0, fiber: 0, na: 0 };
  const e2 = dayEnergy({ items: [item], activities: [{ kcal: 300 }], sessions: [{ status: 'selesai', kcal: 100 }, { status: 'berjalan', kcal: 999 }], bmrKcal: 1700, pal: 1.3 });
  assert.equal(e2.exercise, 400);
  assert.equal(e2.balance, 2000 - 2610);
});

test('tanggal & tidur', () => {
  assert.equal(ageFrom('1997-11-20', '2026-11-16'), 28);
  assert.equal(ageFrom('1997-11-10', '2026-11-16'), 29);
  assert.equal(sleepMinutes('23:00', '06:30'), 450);
  assert.equal(sleepMinutes('01:00', '07:00'), 360);
  assert.equal(weekdayIdx('2026-11-23'), 0);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
