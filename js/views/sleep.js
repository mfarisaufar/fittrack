import { esc, fmt, todayStr, fmtDate, sleepMinutes, fmtDur, parseNum, lastNDays, avg, round, addDays } from '../util.js';
import { db } from '../db.js';
import { barChart } from '../charts.js';
import { toast, confirmDialog } from '../ui.js';

const DIST = ['Sulit tidur', 'Sering terbangun', 'Mendengkur', 'Mimpi buruk', 'Terlalu panas/bising', 'Lainnya'];

export async function render(el) {
  const draw = async () => {
    const all = (await db.all('sleep_logs')).sort((a, b) => b.date.localeCompare(a.date));
    const days = lastNDays(todayStr(), 14);
    const bars = days.map((d) => ({ label: fmtDate(d, { day: 'numeric', month: undefined, year: undefined }), vals: [all.find((s) => s.date === d) ? round(all.find((s) => s.date === d).minutes / 60, 1) : null] }));
    const last7 = all.filter((s) => s.date > addDays(todayStr(), -7));
    const a7 = avg(last7.map((s) => s.minutes));
    el.innerHTML = `<div class="stack"><form class="card stack" id="sform"><h3>Catat tidur</h3>
      <label class="field"><span>Tanggal bangun</span><input type="date" name="date" value="${todayStr()}" required></label>
      <div class="grid2"><label class="field"><span>Jam tidur</span><input type="time" name="bed" value="23:00" required></label><label class="field"><span>Jam bangun</span><input type="time" name="wake" value="06:00" required></label></div>
      <p class="hint" id="dur"></p>
      <label class="field"><span>Kualitas tidur (1 buruk – 5 sangat baik)</span><input type="range" name="quality" min="1" max="5" value="3"><output id="qv">3</output></label>
      <fieldset class="chips">${DIST.map((d) => `<label class="chip"><input type="checkbox" name="dist" value="${d}"> ${d}</label>`).join('')}</fieldset>
      <label class="field"><span>Detak jantung saat tidur (bpm, jika tersedia)</span><input name="hr" inputmode="numeric"></label>
      <label class="field"><span>Catatan</span><input name="note"></label><button class="btn primary block">Simpan</button>
      <p class="hint">Input manual. FitTrack tidak terhubung otomatis ke jam tangan pintar apa pun.</p></form>
      <div class="card"><h3>14 hari terakhir</h3>${barChart({ bars, ref: 7, unit: 'jam', label: 'Durasi tidur 14 hari' })}<p class="hint">Garis putus-putus = 7 jam (acuan umum bagi dewasa 7–9 jam). Rata-rata 7 hari: <b>${a7 ? fmtDur(a7) : '–'}</b></p></div>
      <div class="card"><h3>Riwayat</h3>${all.length ? `<ul class="items">${all.slice(0, 30).map((s) => `<li><div class="grow"><b>${fmtDate(s.date)}</b> — ${fmtDur(s.minutes)}<br><small>${s.bed}–${s.wake} · kualitas ${s.quality}/5${s.disturbance ? ' · ' + esc(s.disturbance) : ''}${s.hr ? ` · ${s.hr} bpm` : ''}${s.note ? ' · ' + esc(s.note) : ''}</small></div><button class="btn small danger" data-del="${s.id}">Hapus</button></li>`).join('')}</ul>` : '<p class="empty">Belum ada data tidur.</p>'}</div></div>`;
    const f = el.querySelector('#sform');
    const upd = () => { el.querySelector('#dur').textContent = `Durasi: ${fmtDur(sleepMinutes(f.bed.value, f.wake.value))}`; el.querySelector('#qv').textContent = f.quality.value; };
    f.oninput = upd; upd();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const min = sleepMinutes(f.bed.value, f.wake.value);
      if (min > 16 * 60) { toast('Durasi lebih dari 16 jam — periksa jam tidur/bangun', 'err'); return; }
      const hr = parseNum(f.hr.value);
      if (f.hr.value && !(hr >= 30 && hr <= 200)) { toast('Detak jantung tidak wajar', 'err'); return; }
      const dist = [...f.querySelectorAll('[name=dist]:checked')].map((c) => c.value).join(', ');
      const existing = all.find((s) => s.date === f.date.value);
      if (existing && !(await confirmDialog('Sudah ada catatan tidur pada tanggal ini. Timpa?'))) return;
      await db.put('sleep_logs', { ...(existing || {}), date: f.date.value, bed: f.bed.value, wake: f.wake.value, minutes: min, quality: Number(f.quality.value), disturbance: dist || undefined, hr: Number.isFinite(hr) ? hr : undefined, note: f.note.value.trim() || undefined });
      toast('Tersimpan', 'ok'); draw();
    };
  };
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (b && (await confirmDialog('Hapus catatan tidur ini?', { okText: 'Hapus', danger: true }))) { await db.del('sleep_logs', b.dataset.del); draw(); }
  });
  await draw();
}
