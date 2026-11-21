// Form profil & baseline (dipakai onboarding dan pengaturan). Semua data disimpan lokal; tidak ada nilai bawaan pribadi.
import { esc, parseNum, todayStr, fmt } from '../util.js';
import { db } from '../db.js';
import { state, saveProfile, saveSettings } from '../store.js';
import { PAL_OPTIONS, bmi } from '../calc.js';
import { METRICS, LAB_FIELDS, checkRange } from '../data/labs.js';
import { toast, formData } from '../ui.js';

const val = (v) => (v == null ? '' : String(v).replace('.', ','));

export async function renderProfileForm(el, { onDone, editing = false } = {}) {
  const p = state.profile || {};
  const base = (await db.all('mcu_records')).find((m) => m.isBaseline) || { values: {}, date: todayStr() };
  const t = p.targets || {};
  const bv = base.values || {};
  const labInputs = LAB_FIELDS.map((k) => `<label class="field"><span>${METRICS[k].label} (${METRICS[k].unit})</span><input name="lab_${k}" inputmode="decimal" value="${val(bv[k])}"></label>`).join('');
  el.innerHTML = `
  <form class="stack" id="profile-form" autocomplete="off">
    ${editing ? '' : `<div class="card info"><h2>Selamat datang di FitTrack</h2>
    <p>Isi data baseline Anda. Semua data disimpan <b>hanya di perangkat ini</b> (IndexedDB), tidak dikirim ke server mana pun dan tidak ada di kode aplikasi. Anda bisa melewatkan hasil lab dan mengisinya nanti.</p></div>`}
    <div class="card stack"><h3>Profil</h3>
      <div class="grid2">
        <label class="field"><span>Jenis kelamin</span><select name="sex"><option value="L" ${p.sex !== 'P' ? 'selected' : ''}>Laki-laki</option><option value="P" ${p.sex === 'P' ? 'selected' : ''}>Perempuan</option></select></label>
        <label class="field"><span>Tanggal lahir *</span><input type="date" name="birthDate" required value="${esc(p.birthDate || '')}"></label>
        <label class="field"><span>Tinggi badan (cm) *</span><input name="heightCm" inputmode="decimal" required value="${val(p.heightCm)}"></label>
        <label class="field"><span>Aktivitas harian (di luar olahraga)</span><select name="pal">${PAL_OPTIONS.map(([v, l]) => `<option value="${v}" ${Number(state.settings.pal) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      </div></div>
    <div class="card stack"><h3>Baseline pengukuran / MCU</h3>
      <label class="field"><span>Tanggal pemeriksaan/pengukuran *</span><input type="date" name="bdate" required value="${esc(base.date)}"></label>
      <div class="grid2">
        <label class="field"><span>Berat badan (kg) *</span><input name="lab_weight" inputmode="decimal" required value="${val(bv.weight)}"></label>
        <label class="field"><span>Lingkar perut (cm)</span><input name="lab_waist" inputmode="decimal" value="${val(bv.waist)}"></label>
        <label class="field"><span>Tekanan sistolik (mmHg)</span><input name="lab_sys" inputmode="numeric" value="${val(bv.sys)}"></label>
        <label class="field"><span>Tekanan diastolik (mmHg)</span><input name="lab_dia" inputmode="numeric" value="${val(bv.dia)}"></label>
      </div>
      <p class="hint">Pastikan lingkar perut diukur dengan benar (di sekitar pusar, saat napas biasa).</p>
      <details><summary>Hasil laboratorium (opsional)</summary><div class="grid2 mt">${labInputs}</div></details>
      <label class="field"><span>USG abdomen (catatan)</span><input name="usg" value="${esc(base.usg || '')}"></label>
      <label class="field"><span>EKG (catatan)</span><input name="ekg" value="${esc(base.ekg || '')}"></label>
    </div>
    <div class="card stack"><h3>Target pemantauan</h3>
      <p class="hint">Target adalah sasaran pemantauan, bukan jaminan hasil. Kosongkan jika belum ada.</p>
      <div class="grid2">
        <label class="field"><span>Berat min (kg)</span><input name="t_weightMin" inputmode="decimal" value="${val(t.weightMin)}"></label>
        <label class="field"><span>Berat maks (kg)</span><input name="t_weightMax" inputmode="decimal" value="${val(t.weightMax)}"></label>
        <label class="field"><span>Lingkar perut min (cm)</span><input name="t_waistMin" inputmode="decimal" value="${val(t.waistMin)}"></label>
        <label class="field"><span>Lingkar perut maks (cm)</span><input name="t_waistMax" inputmode="decimal" value="${val(t.waistMax)}"></label>
        <label class="field"><span>Trigliserida: di bawah (mg/dL)</span><input name="t_tg" inputmode="decimal" value="${val(t.tg)}"></label>
        <label class="field"><span>LDL: di bawah (mg/dL)</span><input name="t_ldl" inputmode="decimal" value="${val(t.ldl)}"></label>
      </div></div>
    <button class="btn primary block" type="submit">${editing ? 'Simpan perubahan' : 'Simpan & mulai'}</button>
  </form>`;

  el.querySelector('#profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = formData(e.target);
    const num = (k) => parseNum(f[k]);
    const values = {};
    const problems = [];
    for (const k of ['weight', 'waist', 'sys', 'dia', ...LAB_FIELDS]) {
      const n = num('lab_' + k);
      if (Number.isFinite(n)) { const m = checkRange(k, n); if (m) problems.push(m); values[k] = n; }
    }
    if (!Number.isFinite(values.weight)) problems.push('Berat badan wajib diisi.');
    const h = num('heightCm');
    if (!(h >= 100 && h <= 250)) problems.push('Tinggi badan tidak wajar (100–250 cm).');
    if (problems.length) { toast(problems[0], 'err'); return; }
    const t2 = {};
    for (const k of ['weightMin', 'weightMax', 'waistMin', 'waistMax', 'tg', 'ldl']) { const n = num('t_' + k); if (Number.isFinite(n)) t2[k] = n; }
    await saveProfile({ ...(state.profile || {}), sex: f.sex, birthDate: f.birthDate, heightCm: h, targets: t2, onboardedAt: state.profile?.onboardedAt || Date.now() });
    await saveSettings({ pal: Number(f.pal) });
    const old = (await db.all('mcu_records')).find((m) => m.isBaseline);
    await db.put('mcu_records', { ...(old || {}), isBaseline: true, date: f.bdate, label: 'Baseline', values, usg: f.usg, ekg: f.ekg });
    toast(`Tersimpan. BMI awal ${fmt(bmi(values.weight, h))}.`, 'ok');
    onDone?.();
  });
}
