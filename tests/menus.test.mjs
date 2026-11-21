import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { scaleN, compFromItem, itemFromComp, menuTotals, historyFromItems, matchQuery, categorize, newMenu } from '../js/menus.js';
import { sumItems } from '../js/calc.js';
import { db, openDB, MIGRATIONS, DB_VERSION } from '../js/db.js';
import { importAll, validateBackup, exportAll } from '../js/backup.js';

const N = (kcal, p = 0, c = 0, f = 0) => ({ kcal, p, c, f, sat: 0, sugar: 0, fiber: 0, na: 0 });
const item = (name, kcal, extra = {}) => ({ name, amount: 1, unit: 'potong', ...N(kcal, 20, 10, 15), status: 'confirmed', estimated: true, confidence: 'sedang', date: '2026-11-20', createdAt: 1, ...extra });

// Paket restoran: tiap komponen disimpan terpisah
const kfc = () => newMenu({ name: 'KFC Super Besar 2', restaurant: 'KFC', comps: [
  compFromItem(item('Ayam goreng', 290, { amount: 2 })),
  compFromItem(item('Nasi', 260, { unit: 'porsi' })),
  compFromItem(item('Soda', 150, { unit: 'gelas' })),
  compFromItem({ name: 'Perkedel', amount: 1, unit: 'buah', status: 'pending', kcalMin: 80, kcalMax: 150 }),
] });

test('skala porsi: nutrisi dihitung ulang proporsional', () => {
  const s = scaleN(N(300, 10, 40, 8), 1.5);
  assert.equal(s.kcal, 450); assert.equal(s.p, 15); assert.equal(s.f, 12);
  assert.equal(scaleN(null, 2), null);
});

test('komponen menyimpan jumlah, satuan, dan nutrisi masing-masing', () => {
  const m = kfc();
  assert.equal(m.comps.length, 4);
  assert.deepEqual(m.comps.map((c) => c.name), ['Ayam goreng', 'Nasi', 'Soda', 'Perkedel']);
  assert.equal(m.comps[0].amount, 2); assert.equal(m.comps[0].n.kcal, 290);
});

test('komponen belum pasti: status unknown, tanpa angka karangan, total "sebagian"', () => {
  const m = kfc(); const t = menuTotals(m);
  assert.equal(m.comps[3].status, 'unknown'); assert.equal(m.comps[3].n, null);
  assert.equal(t.status, 'sebagian'); assert.equal(t.unknown, 1); assert.equal(t.total.kcal, 700);
  assert.equal(menuTotals(newMenu({ comps: [m.comps[3]] })).status, 'belum');
  assert.equal(menuTotals(newMenu({ comps: [m.comps[0]] })).status, 'lengkap');
});

test('ubah menu: hapus soda / tambah ayam mengubah total', () => {
  const m = kfc();
  m.comps = m.comps.filter((c) => c.name !== 'Soda');
  assert.equal(menuTotals(m).total.kcal, 550);
  m.comps.push(compFromItem(item('Ayam goreng', 290)));
  assert.equal(menuTotals(m).total.kcal, 840);
});

test('Quick Add: item jurnal dibuat dari komponen tanpa AI; pending tetap pending', () => {
  const m = kfc();
  const items = m.comps.map((c) => itemFromComp(c, 1, { menuId: 'x', compId: c.id, vendor: 'KFC' }));
  assert.equal(items[0].status, 'confirmed'); assert.equal(items[0].kcal, 290); assert.equal(items[0].estimated, true); assert.equal(items[0].menuId, 'x');
  assert.equal(items[3].status, 'pending'); assert.equal(items[3].kcal, 0); assert.equal(items[3].kcalMin, 80);
  const s = sumItems(items); // pending tidak ikut total
  assert.equal(s.confirmed.kcal, 700); assert.equal(s.pending.count, 1);
});

test('porsi berubah: jumlah, gram, dan nutrisi ikut dihitung ulang', () => {
  const c = compFromItem(item('Nasi', 260, { unit: 'porsi', grams: 200 }));
  const half = itemFromComp(c, 0.5);
  assert.equal(half.amount, 0.5); assert.equal(half.grams, 100); assert.equal(half.kcal, 130);
  const dbl = itemFromComp(c, 2, {});
  assert.equal(dbl.kcal, 520); assert.equal(dbl.p, 40);
  const t = menuTotals(newMenu({ comps: [c] }), { [c.id]: 1.5 });
  assert.equal(t.total.kcal, 390);
  assert.equal(menuTotals(newMenu({ comps: [c] }), { skip: new Set([c.id]) }).total.kcal, 0);
});

test('riwayat otomatis: dikelompokkan, terbaru dipakai, hitung pemakaian', () => {
  const h = historyFromItems([
    item('Bakso goreng', 200, { date: '2026-11-01', createdAt: 1 }), item('Bakso goreng', 260, { date: '2026-11-10', createdAt: 2 }),
    item('Nasi', 130, { date: '2026-11-05', createdAt: 3, vendor: 'Warung A' }),
  ]);
  assert.equal(h.length, 2);
  const bg = h.find((x) => x.name === 'Bakso goreng');
  assert.equal(bg.uses, 2); assert.equal(bg.comps[0].n.kcal, 260); assert.equal(h[0].name, 'Bakso goreng'); // terbaru lebih dulu
  assert.equal(h.find((x) => x.name === 'Nasi').restaurant, 'Warung A');
});

test('pencarian nama makanan & nama restoran, serta kategori', () => {
  const k = kfc(), fav = newMenu({ name: 'Nasi goreng favorit', comps: [compFromItem(item('Nasi goreng', 475))] });
  assert.ok(matchQuery(k, 'kfc')); assert.ok(matchQuery(k, 'super')); assert.ok(matchQuery(k, 'perkedel')); assert.ok(!matchQuery(k, 'pizza'));
  assert.ok(matchQuery(k, ''));
  const hist = historyFromItems([item('Pentol', 150)]);
  assert.deepEqual(categorize([k, fav], hist, 'restoran').map((m) => m.name), ['KFC Super Besar 2']);
  assert.equal(categorize([k, fav], hist, 'favorit').length, 2);
  assert.equal(categorize([k, fav], hist, 'riwayat').length, 1);
});

test('perbarui estimasi & simpan: komponen yang sudah pasti dipakai tanpa AI lagi', () => {
  const m = kfc();
  const unknown = m.comps[3];
  const confirmed = { ...unknown, status: 'confirmed', n: N(120), estimated: true, confidence: 'rendah', range: undefined };
  m.comps[3] = confirmed;
  assert.equal(menuTotals(m).status, 'lengkap');
  assert.equal(itemFromComp(confirmed, 1).status, 'confirmed');
});

test('IndexedDB: menu tersimpan lokal, ikut backup, dan restore backup lama (v1) tetap valid', async () => {
  const saved = await db.put('food_menus', kfc());
  assert.equal((await db.get('food_menus', saved.id)).comps.length, 4);
  const b = await exportAll();
  assert.equal(b.schema, DB_VERSION); assert.equal(b.stores.food_menus.length, 1);
  const old = { app: 'FitTrack', schema: 1, stores: { sleep_logs: [{ id: 's', date: '2026-11-01', minutes: 400 }] } };
  assert.equal(validateBackup(old).length, 0);
  await importAll(old);
  assert.equal((await db.all('sleep_logs')).length, 1); assert.equal((await db.all('food_menus')).length, 0);
});

test('migrasi v1 -> v2 menambah food_menus tanpa menghapus data', async () => {
  const name = 'mig-v2';
  const d1 = await openDB(name, 1, { 1: MIGRATIONS[1] });
  assert.ok(!d1.objectStoreNames.contains('food_menus'));
  await new Promise((r) => { const tx = d1.transaction('food_log_items', 'readwrite'); tx.objectStore('food_log_items').put({ id: 'a', date: '2026-11-01', name: 'Nasi' }); tx.oncomplete = r; });
  d1.close();
  const d2 = await openDB(name, 2, MIGRATIONS);
  assert.ok(d2.objectStoreNames.contains('food_menus'));
  const row = await new Promise((r) => { const q = d2.transaction('food_log_items').objectStore('food_log_items').get('a'); q.onsuccess = () => r(q.result); });
  assert.equal(row.name, 'Nasi'); d2.close();
});
