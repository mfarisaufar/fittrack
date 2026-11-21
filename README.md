# FitTrack — Personal Health & Fitness Tracker

PWA *local-first* untuk memantau makanan, kalori, olahraga, kesehatan, tidur, dan laporan. Berjalan offline, dapat dipasang di Android (Chrome), dan **tidak memakai backend, API berbayar, maupun CDN**.

- Data pribadi disimpan di **IndexedDB perangkat Anda**. Repository ini hanya berisi kode dan aset; **tidak ada data MCU atau data kesehatan** di dalamnya.
- ChatGPT dan Claude dipakai lewat **salin-tempel manual** (AI Bridge). Tidak ada API key, scraping, atau otomatisasi login.

> FitTrack adalah alat pencatatan, **bukan** alat diagnosis. Untuk hasil laboratorium, obat, dan keputusan medis, konsultasikan dokter.

## Fitur

| Menu | Isi |
|---|---|
| Dashboard | Ringkasan hari ini, progres target, pengingat, analisis AI terakhir |
| Food & Calorie | Cari makanan, kategori, gram, satuan rumah tangga, **nominal Rupiah**, foto, manual/label kemasan, custom food, favorit, penjual |
| **Favorit & Quick Add** | Di dialog tambah makanan, tab ⚡ Cepat: kategori *Menu Favorit*, *Riwayat Makanan* (otomatis dari jurnal), *Menu Restoran*; cari nama makanan/restoran; satu ketukan “+ Tambah” ke jurnal tanpa AI; paket (mis. restoran) disimpan per komponen yang dapat diubah/dihapus/ditambah; porsi diubah → nutrisi dihitung ulang; komponen belum pasti tetap berstatus pending/“belum pasti”; estimasi dapat diperbarui dan disimpan ke menu (tombol ↻ Menu atau lewat impor AI) |
| Workout | Jadwal mingguan, 15 gerakan beserta ilustrasi dan panduan, template (A, B, pemanasan, pendinginan, pemulihan), pencatatan set/repetisi aktual, timer istirahat, riwayat dan grafik, olahraga lain (sepak bola, badminton, jalan) |
| Health | Berat, lingkar perut, tekanan darah, detak jantung, lab; MCU sebagai catatan terpisah (tidak menimpa), perbandingan, grafik |
| Sleep | Jam tidur/bangun, kualitas, gangguan, grafik |
| Laporan | Harian/mingguan/bulanan, ekspor CSV, cetak/simpan PDF |
| AI Health Assistant | 15 jenis prompt, pilih data yang dikirim, pratinjau, salin, buka ChatGPT/Claude, impor JSON `FITTRACK_RESULT_JSON`, perbandingan, prompt sintesis |
| Backup & Pengaturan | Backup/restore JSON (opsional dienkripsi AES-GCM), CSV, pengingat mingguan, tema, profil |

## Cara menghitung kalori (satu metode, terdokumentasi)

- **Masuk**: hanya item berstatus *terkonfirmasi*. Estimasi keyakinan rendah ditampilkan terpisah; item **pending** (mis. “pentol Rp10.000” tanpa jumlah/berat) tampil sebagai rentang dan **tidak ikut total** sampai Anda menyetujuinya.
- **Keluar** = BMR (Mifflin-St Jeor) × faktor aktivitas harian *di luar olahraga* + kalori olahraga **netto** `(MET − 1) × kg × jam`. Pengurangan 1 MET mencegah penghitungan ganda dengan BMR. Ini estimasi, bukan pengukuran.
- **Rupiah**: harga tidak dianggap berat. Tanpa berat/jumlah, hasilnya rentang berdasar *asumsi harga per 100 g* yang tercantum pada data makanan (asumsi umum, bukan harga penjual Anda) dengan keyakinan rendah.

## Data makanan

Angka gizi adalah **perkiraan yang dibulatkan dari kisaran umum** sumber seperti TKPI dan USDA, dan **belum diverifikasi per produk**. Semua entri diberi tanda `estimate: true`. Makanan rumahan/jajanan bervariasi; gunakan *Manual/Label* untuk akurasi lebih baik, atau perbaiki lewat estimasi AI.

## Struktur proyek

```
index.html  manifest.json  sw.js  precache.js(otomatis)  .nojekyll
css/styles.css
js/        app.js (router) db.js (IndexedDB + migrasi v2) store.js calc.js menus.js ai.js backup.js charts.js ui.js util.js
js/data/   foods.js exercises.js labs.js
js/views/  dashboard food menus workout health sleep reports ai settings profile more
icons/     ikon PNG + SVG
tools/     gen-precache.mjs make-icons.mjs serve.mjs
tests/     *.test.mjs
docs/      DEPLOY-GITHUB-PAGES.md
```

## Pengembangan

```powershell
npm install          # hanya untuk test (fake-indexeddb)
npm test             # meregenerasi precache.js lalu menjalankan 46 test
node tools/serve.mjs 8766 /fittrack   # server lokal meniru subpath GitHub Pages
```

Buka `http://localhost:8766/fittrack/`. **Setiap kali file aplikasi berubah, jalankan `npm run precache`** (atau `npm test`) agar Service Worker memperbarui cache. Jika lupa, test PWA akan gagal.

Migrasi database ada di `js/db.js` (`MIGRATIONS`). Aturannya: hanya menambah struktur, tidak menghapus store berisi data pengguna.

## Status

**Sudah dibangun dan diuji (otomatis, 46 test; termasuk menu/favorit, skala porsi, migrasi DB v1→v2):** perhitungan kalori/energi, estimasi Rupiah, database dan gerakan, prompt AI + privasi, parser/validator/perbandingan hasil AI, IndexedDB (CRUD, rentang tanggal, migrasi), backup/restore dan enkripsi, konsistensi PWA (path relatif, manifest, precache, tanpa API/CDN, tanpa data pribadi).

**Diuji manual di browser (lokal, subpath `/fittrack/`, ukuran HP):** onboarding, dashboard, tambah makanan (cari + Rupiah pending), persetujuan, alur AI Bridge sampai impor dan penerapan hasil, sesi latihan dengan set/repetisi aktual, semua halaman termuat tanpa error.

**Belum terverifikasi di sini (perlu Anda cek di HP):**
- Pendaftaran Service Worker, offline setelah dipublikasikan, dan tombol *Instal* di Chrome Android (panel browser pengembangan tidak mendaftarkan Service Worker). Lihat checklist di `docs/DEPLOY-GITHUB-PAGES.md`.
- Menyalin ke clipboard (di HP berfungsi lewat izin gestur pengguna; ada kotak teks sebagai cadangan).
- Ilustrasi gerakan berupa figur garis sederhana buatan kode, bukan foto/video; ikuti panduan teks.
- Detak jantung dari jam tangan **tidak** terintegrasi; input manual saja.

Penyimpanan `exercise_library` dan `food_database` disiapkan untuk koreksi pengguna terhadap data bawaan; saat ini `food_database` dipakai sebagai lapisan koreksi (belum ada antarmuka untuk mengubahnya).
