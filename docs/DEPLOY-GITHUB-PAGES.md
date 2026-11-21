# Panduan Deploy ke GitHub Pages

FitTrack adalah situs statis: semua path relatif, sehingga berjalan di `https://USERNAME.github.io/fittrack/` (subpath) maupun custom domain. Tidak ada server, VPS, atau biaya tambahan.

## 1. Buat repository

1. Di GitHub: **New repository** → nama `fittrack` → **Public** (GitHub Pages gratis memerlukan repo publik, kecuali akun berbayar) → **jangan** centang README/.gitignore (sudah ada).
2. **Penting:** repository publik hanya berisi kode. Jangan pernah meng-commit file backup (`fittrack-backup*.json`) atau CSV ekspor. `.gitignore` sudah mencegahnya.

## 2. Upload

**Opsi A — lewat web (paling mudah, tanpa git):**
1. Ekstrak `fittrack-source.zip`.
2. Di repo: **Add file → Upload files**. Seret **isi folder** hasil ekstrak (bukan foldernya). Pastikan `index.html` berada di akar repo.
3. File `.nojekyll` bersifat tersembunyi; bila tidak terunggah, buat file kosong bernama `.nojekyll` lewat **Add file → Create new file**.
4. **Commit changes**.

**Opsi B — git:**
```powershell
cd fittrack
git init
git add .
git commit -m "FitTrack awal"
git branch -M main
git remote add origin https://github.com/USERNAME/fittrack.git
git push -u origin main
```
(Folder `node_modules` tidak ikut karena ada di `.gitignore`.)

## 3. Aktifkan Pages

1. **Settings → Pages**.
2. **Source:** *Deploy from a branch* → Branch `main`, folder `/ (root)` → **Save**.
3. Tunggu 1–3 menit. Alamat: `https://USERNAME.github.io/fittrack/`.

## 4. Pasang di Android (Chrome)

1. Buka alamat di Chrome Android, tunggu halaman termuat penuh (kunjungan pertama menyimpan cache).
2. Menu ⋮ → **Instal aplikasi** (atau *Tambahkan ke layar utama*). Atau tombol **Pasang aplikasi** di Pengaturan bila muncul.
3. Buka dari ikon layar utama; tampil standalone.
4. Isi onboarding (data baseline Anda tersimpan hanya di HP).

## 5. Checklist uji setelah publikasi

- [ ] Halaman terbuka tanpa layar kosong di `https://USERNAME.github.io/fittrack/` (huruf besar/kecil pada nama repo harus sama).
- [ ] Chrome DevTools (desktop) → Application → Manifest: tidak ada error, `start_url`/`scope` = `/fittrack/`.
- [ ] Application → Service Workers: status *activated*.
- [ ] Aktifkan mode pesawat, buka ulang aplikasi: tampil, dan pencatatan makanan/olahraga/kesehatan tetap berjalan.
- [ ] Catat satu data, tutup aplikasi, buka lagi: data masih ada.
- [ ] Pengaturan → Unduh backup, lalu uji Restore.
- [ ] Salin prompt di AI Health Assistant, buka ChatGPT/Claude (butuh internet).

## 6. Memperbarui aplikasi

1. Ubah file, lalu jalankan `npm run precache` (menghitung ulang versi cache di `precache.js`).
2. Upload/commit ulang. Service Worker baru akan terpasang pada kunjungan berikutnya dan menggantikan cache lama.
3. **Data di IndexedDB tidak terhapus oleh pembaruan.** Perubahan struktur database ditangani lewat `MIGRATIONS` di `js/db.js`.
4. Jika layar tidak berubah: tutup semua tab/aplikasi lalu buka lagi (Service Worker baru aktif setelah tab lama ditutup), atau muat ulang paksa.

## 7. Custom domain (opsional)

Settings → Pages → Custom domain. Karena path relatif, tidak ada yang perlu diubah.

## 8. Catatan penting

- **Backup rutin.** Data lokal hilang jika data browser dibersihkan atau aplikasi di-uninstall/ganti perangkat. Aplikasi mengingatkan tiap 7 hari.
- Data dibagi per *origin*: `username.github.io/fittrack` dan `localhost` memiliki database terpisah. Pindahkan data lewat Backup → Restore.
- Jika memakai nama repo lain, tidak perlu mengubah apa pun.
- Data yang Anda tempel ke ChatGPT/Claude tunduk pada kebijakan privasi masing-masing layanan.

## 9. Pemecahan masalah

| Gejala | Penyebab/solusi |
|---|---|
| 404 pada alamat | Pages belum aktif, atau `index.html` tidak di akar repo |
| Halaman kosong, error 404 untuk `js/...` | Folder diunggah bertingkat; pindahkan isi ke akar |
| Tombol Instal tidak muncul | Buka lewat HTTPS, tunggu cache selesai, gunakan menu ⋮ → Instal aplikasi |
| Versi lama terus tampil | Tutup semua tab; pastikan `npm run precache` dijalankan sebelum upload |
| Data hilang | Cek apakah memakai browser/profil/alamat berbeda; restore dari backup |
