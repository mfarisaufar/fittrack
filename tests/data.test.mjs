import test from 'node:test';
import assert from 'node:assert/strict';
import { FOODS, CATEGORIES } from '../js/data/foods.js';
import { EXERCISES, DEFAULT_TEMPLATES, EX_BY_ID, DEFAULT_SCHEDULE, figureSVG } from '../js/data/exercises.js';

test('food database: unik, lengkap, ditandai estimasi, konsisten', () => {
  assert.equal(new Set(FOODS.map((f) => f.id)).size, FOODS.length);
  for (const f of FOODS) {
    assert.ok(CATEGORIES[f.cat], f.id);
    for (const k of ['kcal', 'p', 'c', 'f', 'sat', 'sugar', 'fiber', 'na']) assert.ok(Number.isFinite(f[k]) && f[k] >= 0, `${f.id}.${k}`);
    assert.ok(f.source && f.estimate === true, f.id);
    assert.ok(f.sat <= f.f + 0.01, `${f.id}: lemak jenuh <= lemak total`);
    assert.ok(f.sugar <= f.c + 0.01, `${f.id}: gula <= karbo`);
    const atwater = 4 * f.p + 4 * f.c + 9 * f.f;
    if (f.kcal > 30) assert.ok(Math.abs(atwater - f.kcal) / f.kcal < 0.4, `${f.id}: kkal ${f.kcal} vs makro ${Math.round(atwater)}`);
  }
});

test('food database memuat makanan & kategori yang diwajibkan', () => {
  const names = FOODS.map((f) => f.name.toLowerCase()).join('|');
  const required = ['nasi putih', 'nasi goreng', 'nasi gurih', 'nasi uduk', 'mie goreng', 'mie aceh', 'roti', 'kentang', 'ayam goreng', 'ayam bakar', 'ikan goreng', 'ikan bakar', 'telur', 'daging sapi', 'tempe', 'tahu', 'bakso', 'pentol', 'bakso goreng', 'gorengan', 'martabak', 'rendang', 'soto', 'kue tradisional', 'pisang', 'apel', 'jeruk', 'pepaya', 'semangka', 'air putih', 'kopi hitam', 'kopi susu', 'teh manis', 'jus buah', 'minuman kemasan'];
  for (const n of required) assert.ok(names.includes(n), n);
  for (const c of Object.keys(CATEGORIES)) assert.ok(FOODS.some((f) => f.cat === c), c);
});

test('pustaka gerakan: 15 gerakan dengan field wajib & ilustrasi valid', () => {
  assert.equal(EXERCISES.length, 15);
  for (const e of EXERCISES) {
    for (const k of ['name', 'muscles', 'benefit', 'start', 'breath', 'level', 'mod']) assert.ok(String(e[k]).length > 3, `${e.id}.${k}`);
    assert.ok(e.steps.length >= 2 && e.mistakes.length >= 1);
    assert.ok(e.sets >= 1 && e.reps >= 1 && e.rest >= 0);
    for (let i = 0; i < e.poses.length; i++) {
      assert.equal(e.poses[i].p.length, 7);
      const svg = figureSVG(e, i);
      assert.ok(svg.startsWith('<svg') && !svg.includes('NaN') && !svg.includes('undefined'), e.id);
    }
  }
});

test('template & jadwal sesuai spesifikasi', () => {
  for (const t of DEFAULT_TEMPLATES) for (const [id] of t.items) assert.ok(EX_BY_ID[id], `${t.id}:${id}`);
  assert.deepEqual(DEFAULT_SCHEDULE.map((s) => s.kind), ['sport', 'template', 'sport', 'rest', 'template', 'rest', 'rest']);
  assert.equal(DEFAULT_SCHEDULE[0].sport, 'sepakbola');
  assert.equal(DEFAULT_SCHEDULE[2].sport, 'badminton');
});
