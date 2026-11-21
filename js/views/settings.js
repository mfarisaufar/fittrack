import { esc, todayStr, fmtDate } from '../util.js';
import { db, STORES, DB_VERSION } from '../db.js';
import { state, saveSettings } from '../store.js';
import { exportAll, importAll, validateBackup, backupSummary, encryptBackup, decryptBackup, toCSV, downloadBlob, wipeAll } from '../backup.js';
import { renderProfileForm } from './profile.js';
import { applyTheme } from '../app.js';
import { toast, modal, confirmDialog } from '../ui.js';
import { AI_PRIVACY_NOTE } from '../ai.js';

let deferredInstall = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });

export async function render(el) {
  const stamp = () => todayStr();
  const draw = async () => {
    const s = state.settings;
    const persisted = (await navigator.storage?.persisted?.()) ?? null;
    const est = await navigator.storage?.estimate?.().catch(() => null);
    el.innerHTML = `<div class="stack">
    <div class="card stack"><h3>Backup</h3>
      <p class="hint">Data hanya ada di perangkat ini. Backup terakhir: <b>${s.lastBackupAt ? fmtDate(todayStr(new Date(s.lastBackupAt))) : 'belum pernah'}</b>. Simpan file di tempat aman (mis. Google Drive pribadi). FitTrack tidak mengunggah apa pun secara otomatis.</p>
      <button class="btn primary" id="bk">Unduh backup (JSON)</button>
      <button class="btn" id="bke">Unduh backup terenkripsi (password)</button>
      <label class="check"><input type="checkbox" id="rem" ${s.backupReminder ? 'checked' : ''}> Ingatkan backup mingguan saat aplikasi dibuka</label></div>
    <div class="card stack"><h3>Restore</h3><p class="hint">Restore <b>mengganti seluruh data</b> di perangkat ini dengan isi file.</p>
      <input type="file" id="rf" accept=".json,application/json"></div>
    <div class="card stack"><h3>Ekspor CSV per kategori</h3><div class="row gap wrap">${['food_log_items', 'health_measurements', 'mcu_records', 'activity_logs', 'workout_sessions', 'set_logs', 'sleep_logs'].map((k) => `<button class="btn small" data-csv="${k}">${k}</button>`).join('')}</div></div>
    <div class="card stack"><h3>Tampilan</h3><label class="field"><span>Tema</span><select id="theme">${[['auto', 'Otomatis'], ['light', 'Terang'], ['dark', 'Gelap']].map(([k, l]) => `<option value="${k}" ${s.theme === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${deferredInstall ? '<button class="btn" id="inst">Pasang aplikasi di layar utama</button>' : '<p class="hint">Untuk memasang: menu Chrome (⋮) → “Instal aplikasi”/“Tambahkan ke layar utama”.</p>'}</div>
    <div class="card"><h3>Profil &amp; baseline</h3><div id="pf"></div></div>
    <div class="card stack"><h3>Privasi</h3><ul class="plain hint"><li>Semua data kesehatan disimpan di IndexedDB perangkat ini. Tidak ada server, akun, atau API berbayar.</li><li>Tidak ada pengiriman otomatis ke ChatGPT/Claude; Anda menyalin prompt sendiri.</li><li>${esc(AI_PRIVACY_NOTE)}</li></ul>
      <button class="btn danger" id="clrai">Hapus riwayat AI lokal</button><button class="btn danger" id="wipe">Hapus SEMUA data</button></div>
    <div class="card"><h3>Info</h3><p class="hint">FitTrack · skema database v${DB_VERSION} · penyimpanan persisten: ${persisted == null ? 'tidak diketahui' : persisted ? 'ya' : 'belum (browser dapat menghapus data saat ruang penuh)'}${est ? ` · terpakai ${(est.usage / 1048576).toFixed(1)} MB` : ''}<br>FitTrack adalah alat pencatatan, bukan alat diagnosis atau pengganti saran dokter.</p></div></div>`;
    renderProfileForm(el.querySelector('#pf'), { editing: true, onDone: () => { toast('Profil diperbarui', 'ok'); } });
    const g = (id) => el.querySelector(id);
    g('#rem').onchange = (e) => saveSettings({ backupReminder: e.target.checked });
    g('#theme').onchange = async (e) => { await saveSettings({ theme: e.target.value }); applyTheme(); };
    if (g('#inst')) g('#inst').onclick = async () => { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; draw(); };
    g('#bk').onclick = async () => { const b = await exportAll(); downloadBlob(`fittrack-backup-${stamp()}.json`, JSON.stringify(b)); await saveSettings({ lastBackupAt: Date.now() }); toast('Backup diunduh', 'ok'); draw(); };
    g('#bke').onclick = () => {
      const m = modal('Backup terenkripsi', `<form class="stack"><p class="hint">Password tidak disimpan dan <b>tidak dapat dipulihkan</b>. Jika lupa, file tidak bisa dibuka.</p><label class="field"><span>Password</span><input type="password" name="p1" minlength="8" required autocomplete="new-password"></label><label class="field"><span>Ulangi password</span><input type="password" name="p2" required autocomplete="new-password"></label><button class="btn primary block">Enkripsi &amp; unduh</button></form>`);
      m.el.querySelector('form').onsubmit = async (e) => {
        e.preventDefault(); const f = e.target;
        if (f.p1.value !== f.p2.value) { toast('Password tidak sama', 'err'); return; }
        const env = await encryptBackup(await exportAll(), f.p1.value);
        downloadBlob(`fittrack-backup-${stamp()}.enc.json`, JSON.stringify(env)); await saveSettings({ lastBackupAt: Date.now() }); toast('Backup terenkripsi diunduh', 'ok'); m.close(); draw();
      };
    };
    g('#rf').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        let obj = JSON.parse(await file.text());
        if (obj?.encrypted) {
          const pw = await askPassword(); if (!pw) return;
          obj = await decryptBackup(obj, pw);
        }
        const errs = validateBackup(obj);
        if (errs.length) { toast(errs[0], 'err'); return; }
        if (!(await confirmDialog(`Ganti SEMUA data saat ini dengan backup tanggal ${obj.exportedAt?.slice(0, 10) || '?'}?\nIsi: ${backupSummary(obj)}\n\nTindakan ini tidak dapat dibatalkan. Disarankan backup data saat ini dahulu.`, { okText: 'Ya, restore', danger: true }))) return;
        await importAll(obj);
        toast('Restore berhasil. Memuat ulang…', 'ok'); setTimeout(() => location.reload(), 900);
      } catch (err) { toast('Restore gagal: ' + err.message, 'err'); }
      e.target.value = '';
    };
    el.querySelectorAll('[data-csv]').forEach((b) => { b.onclick = async () => { const rows = await db.all(b.dataset.csv); if (!rows.length) { toast('Tidak ada data', 'err'); return; } downloadBlob(`fittrack-${b.dataset.csv}-${stamp()}.csv`, '﻿' + toCSV(rows), 'text/csv'); }; });
    g('#clrai').onclick = async () => { if (await confirmDialog('Hapus semua riwayat AI lokal?', { okText: 'Hapus', danger: true })) { for (const s2 of ['ai_conversations', 'ai_messages', 'ai_imports']) await db.clear(s2); toast('Riwayat AI dihapus', 'ok'); } };
    g('#wipe').onclick = async () => {
      if (!(await confirmDialog('Hapus SEMUA data FitTrack di perangkat ini (makanan, kesehatan, MCU, latihan, tidur, profil)? Tidak dapat dibatalkan. Unduh backup dahulu bila perlu.', { okText: 'Lanjut', danger: true }))) return;
      if (!(await confirmDialog('Yakin? Ini konfirmasi terakhir.', { okText: 'Hapus semuanya', danger: true }))) return;
      await wipeAll(); toast('Semua data dihapus', 'ok'); setTimeout(() => location.reload(), 800);
    };
  };
  await draw();
}

function askPassword() {
  return new Promise((resolve) => {
    const m = modal('Password backup', `<form class="stack"><label class="field"><span>Password</span><input type="password" name="p" required></label><button class="btn primary block">Buka</button></form>`, { onClose: () => resolve(null) });
    m.el.querySelector('form').onsubmit = (e) => { e.preventDefault(); const v = e.target.p.value; m.root.remove(); document.body.classList.remove('no-scroll'); resolve(v); };
  });
}
