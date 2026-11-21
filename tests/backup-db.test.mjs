import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { db, STORES, DB_VERSION, openDB, MIGRATIONS } from '../js/db.js';
import { exportAll, importAll, validateBackup, encryptBackup, decryptBackup, toCSV, wipeAll } from '../js/backup.js';

test('CRUD, id/timestamp otomatis, query rentang tanggal', async () => {
  const a = await db.put('health_measurements', { type: 'weight', date: '2026-11-20', value: 77 });
  assert.ok(a.id && a.createdAt && a.updatedAt);
  await db.put('health_measurements', { type: 'weight', date: '2026-11-25', value: 76.5 });
  await db.put('health_measurements', { type: 'weight', date: '2026-12-25', value: 75 });
  assert.equal((await db.range('health_measurements', '2026-11-01', '2026-11-30')).length, 2);
  assert.equal((await db.byDate('health_measurements', '2026-11-20')).length, 1);
  await db.del('health_measurements', a.id);
  assert.equal(await db.count('health_measurements'), 2);
});

test('semua 22 object store ada', async () => {
  assert.equal(STORES.length, 22);
  for (const s of STORES) assert.equal(Array.isArray(await db.all(s)), true, s);
});

test('MCU baru tidak menimpa MCU lama', async () => {
  const old = await db.put('mcu_records', { date: '2026-11-16', isBaseline: true, values: { tg: 211 } });
  await db.put('mcu_records', { date: '2027-02-16', values: { tg: 140 } });
  assert.equal((await db.all('mcu_records')).length, 2);
  assert.equal((await db.get('mcu_records', old.id)).values.tg, 211);
});

test('backup -> hapus -> restore mengembalikan semua data', async () => {
  await db.put('food_log_items', { date: '2026-11-21', name: 'Nasi', kcal: 130, status: 'confirmed' });
  const b = await exportAll();
  assert.equal(validateBackup(b).length, 0);
  const nonEmpty = (x) => JSON.stringify(Object.fromEntries(Object.entries(x.stores).filter(([, r]) => r.length)));
  const before = nonEmpty(b);
  await wipeAll();
  assert.equal(await db.count('food_log_items'), 0);
  await importAll(JSON.parse(JSON.stringify(b)));
  assert.equal(nonEmpty(await exportAll()), before);
});

test('validasi backup menolak file salah / versi lebih baru', () => {
  assert.ok(validateBackup({ app: 'Lain' }).length);
  assert.ok(validateBackup({ app: 'FitTrack', schema: DB_VERSION + 1, stores: {} }).some((e) => e.includes('lebih baru')));
  assert.ok(validateBackup({ app: 'FitTrack', schema: 1, stores: { sleep_logs: [{ foo: 1 }] } }).length);
  assert.ok(validateBackup({ app: 'FitTrack', schema: 1, stores: { bukan_store: [] } }).length);
});

test('enkripsi AES-GCM: roundtrip & password salah ditolak', async () => {
  const obj = { app: 'FitTrack', schema: 1, stores: {}, rahasia: 'data' };
  const env = await encryptBackup(obj, 'kata-sandi-kuat');
  assert.equal(env.encrypted, true);
  assert.ok(!JSON.stringify(env).includes('rahasia'));
  assert.deepEqual(await decryptBackup(env, 'kata-sandi-kuat'), obj);
  await assert.rejects(() => decryptBackup(env, 'salah'), /Password salah/);
});

test('migrasi: upgrade versi tidak menghapus data', async () => {
  const name = 'mig-test';
  const d1 = await openDB(name, 1, MIGRATIONS);
  await new Promise((res) => { const tx = d1.transaction('sleep_logs', 'readwrite'); tx.objectStore('sleep_logs').put({ id: 's1', date: '2026-11-20', minutes: 420 }); tx.oncomplete = res; });
  d1.close();
  const d2 = await openDB(name, 2, { ...MIGRATIONS, 2(database, tx) { tx.objectStore('sleep_logs').createIndex('quality', 'quality'); } });
  const row = await new Promise((res) => { const r = d2.transaction('sleep_logs').objectStore('sleep_logs').get('s1'); r.onsuccess = () => res(r.result); });
  assert.equal(row.minutes, 420);
  assert.ok(d2.transaction('sleep_logs').objectStore('sleep_logs').indexNames.contains('quality'));
  d2.close();
});

test('CSV meng-escape koma, kutip, baris baru', () => {
  const csv = toCSV([{ a: 'x,y', b: 'ia "bilang"', c: { k: 1 } }, { a: 'l\nbaris', d: 5 }]);
  assert.ok(csv.startsWith('a,b,c,d'));
  assert.ok(csv.includes('"x,y"'));
  assert.ok(csv.includes('"ia ""bilang"""'));
});
