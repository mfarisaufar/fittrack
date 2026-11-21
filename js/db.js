// IndexedDB — semua data pribadi disimpan lokal di perangkat.
import { uid } from './util.js';

export const DB_NAME = 'fittrack';
export const DB_VERSION = 2;

export const STORES = [
  'user_profile', 'health_measurements', 'mcu_records', 'food_database', 'food_logs', 'food_log_items',
  'custom_foods', 'food_vendor_profiles', 'activity_logs', 'exercise_library', 'workout_templates',
  'template_exercises', 'workout_sessions', 'exercise_logs', 'set_logs', 'sleep_logs', 'daily_summaries',
  'ai_conversations', 'ai_messages', 'ai_imports', 'app_settings',
  'food_menus', // v2: menu favorit / paket / menu restoran
];

// Store yang punya field `date` (YYYY-MM-DD) dan diberi index untuk query rentang.
const DATE_INDEXED = new Set([
  'health_measurements', 'mcu_records', 'food_logs', 'food_log_items', 'activity_logs',
  'workout_sessions', 'sleep_logs', 'daily_summaries',
]);

/**
 * Migrasi: setiap versi hanya MENAMBAH struktur. Tidak ada migrasi yang boleh menghapus
 * object store yang berisi data pengguna, supaya pembaruan aplikasi tidak menghilangkan data.
 */
export const MIGRATIONS = {
  1(database) {
    for (const s of STORES.filter((x) => x !== 'food_menus')) { // daftar store versi 1 (food_menus ditambahkan di v2)
      if (database.objectStoreNames.contains(s)) continue;
      const os = database.createObjectStore(s, { keyPath: 'id' });
      if (DATE_INDEXED.has(s)) os.createIndex('date', 'date');
    }
  },
  // v2: hanya menambah store baru; data lama tidak tersentuh.
  2(database) {
    if (!database.objectStoreNames.contains('food_menus')) database.createObjectStore('food_menus', { keyPath: 'id' });
  },
};

let _dbPromise = null;

export function openDB(name = DB_NAME, version = DB_VERSION, migrations = MIGRATIONS) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (e) => {
      for (let v = e.oldVersion + 1; v <= e.newVersion; v++) migrations[v]?.(req.result, req.transaction);
    };
    req.onsuccess = () => {
      const d = req.result;
      d.onversionchange = () => d.close();
      resolve(d);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database terblokir oleh tab lain. Tutup tab FitTrack lain lalu muat ulang.'));
  });
}
export function getDB() {
  if (!_dbPromise) _dbPromise = openDB();
  return _dbPromise;
}
export function _resetDBForTests() { _dbPromise = null; }

const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const txDone = (tx) => new Promise((res, rej) => {
  tx.oncomplete = () => res();
  tx.onerror = () => rej(tx.error);
  tx.onabort = () => rej(tx.error || new Error('Transaksi dibatalkan'));
});

export const db = {
  async get(store, id) {
    const d = await getDB();
    return reqP(d.transaction(store).objectStore(store).get(id));
  },
  async all(store) {
    const d = await getDB();
    return reqP(d.transaction(store).objectStore(store).getAll());
  },
  async count(store) {
    const d = await getDB();
    return reqP(d.transaction(store).objectStore(store).count());
  },
  async put(store, obj) {
    const now = Date.now();
    obj.id ??= uid(store.slice(0, 3) + '_');
    obj.createdAt ??= now;
    obj.updatedAt = now;
    const d = await getDB();
    const tx = d.transaction(store, 'readwrite');
    tx.objectStore(store).put(obj);
    await txDone(tx);
    return obj;
  },
  /** raw:true = simpan apa adanya (dipakai restore agar timestamp asli tidak berubah). */
  async putMany(store, arr, { raw = false } = {}) {
    const now = Date.now();
    const d = await getDB();
    const tx = d.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const obj of arr) {
      if (!raw) {
        obj.id ??= uid(store.slice(0, 3) + '_');
        obj.createdAt ??= now;
        obj.updatedAt = now;
      }
      os.put(obj);
    }
    await txDone(tx);
    return arr;
  },
  async del(store, id) {
    const d = await getDB();
    const tx = d.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    await txDone(tx);
  },
  async delMany(store, ids) {
    const d = await getDB();
    const tx = d.transaction(store, 'readwrite');
    for (const id of ids) tx.objectStore(store).delete(id);
    await txDone(tx);
  },
  async clear(store) {
    const d = await getDB();
    const tx = d.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    await txDone(tx);
  },
  /** Semua record dengan date == tanggal */
  async byDate(store, date) {
    return db.range(store, date, date);
  },
  /** Record dengan from <= date <= to (inklusif) */
  async range(store, from, to) {
    const d = await getDB();
    const os = d.transaction(store).objectStore(store);
    if (!os.indexNames.contains('date')) throw new Error(`Store ${store} tidak memiliki index date`);
    return reqP(os.index('date').getAll(IDBKeyRange.bound(from, to)));
  },
  async where(store, pred) {
    return (await db.all(store)).filter(pred);
  },
};
