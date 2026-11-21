import { esc, fmt, kkal, todayStr, fmtDateLong, fmtDate, lastNDays, diffDays, signed, weekdayIdx, fmtDur, round } from '../util.js';
import { db } from '../db.js';
import { state, healthData, energyFor } from '../store.js';
import { seriesFor, latestOf, targetRows, bmi } from '../calc.js';
import { barChart } from '../charts.js';
import { MEAL_LABEL } from '../data/foods.js';

export async function render(el) {
  const today = todayStr();
  const { measurements, mcus } = await healthData();
  const p = state.profile;
  const w = latestOf(seriesFor('weight', measurements, mcus));
  const waist = latestOf(seriesFor('waist', measurements, mcus));
  const sys = latestOf(seriesFor('sys', measurements, mcus)), dia = latestOf(seriesFor('dia', measurements, mcus));
  const days7 = lastNDays(today, 7);
  const en = await energyFor(days7);
  const td = en[en.length - 1];
  const items = await db.byDate('food_log_items', today);
  const sessions = (await db.byDate('workout_sessions', today)).filter((s) => s.status === 'selesai');
  const acts = await db.byDate('activity_logs', today);
  const sleepAll = (await db.all('sleep_logs')).sort((a, b) => a.date.localeCompare(b.date));
  const sleep = sleepAll[sleepAll.length - 1];
  const imports = (await db.all('ai_imports')).sort((a, b) => b.createdAt - a.createdAt);
  const lastAI = imports.find((i) => i.status === 'saved' && i.data);
  const rows = targetRows(p, mcus, measurements);
  const sched = state.settings.schedule.find((s) => s.day === weekdayIdx(today));
  const wRow = rows.find((r) => r.key === 'weight');
  const reminders = [];
  if (!items.length) reminders.push('Belum ada catatan makanan hari ini.');
  if (!w || diffDays(today, w.date) >= 7) reminders.push('Berat badan belum dicatat 7 hari terakhir.');
  if (!sleepAll.some((s) => s.date === today)) reminders.push('Tidur semalam belum dicatat.');
  const pend = items.filter((i) => i.status === 'pending').length;
  if (pend) reminders.push(`${pend} item makanan menunggu konfirmasi kalori.`);

  const byMeal = {};
  for (const i of items) (byMeal[i.meal] ||= []).push(i);
  const mealSummary = Object.entries(byMeal).map(([m, a]) => `<li><b>${MEAL_LABEL[m] || m}</b>: ${esc(a.map((x) => x.name).join(', '))}</li>`).join('');
  const bal = td.balance;
  const hasAny = items.length || w;

  el.innerHTML = `<div class="stack">
  <div class="card hero"><small>${fmtDateLong(today)}</small>
    <div class="stats3">
      <div><span class="big">${w ? fmt(w.value) : '–'}</span><small>kg terakhir${w ? ` (${fmtDate(w.date, { year: undefined })})` : ''}</small></div>
      <div><span class="big">${waist ? fmt(waist.value) : '–'}</span><small>cm lingkar perut</small></div>
      <div><span class="big">${sys ? `${sys.value}/${dia?.value ?? '–'}` : '–'}</span><small>mmHg terakhir</small></div>
    </div>
    ${w ? `<small>BMI ${fmt(bmi(w.value, p.heightCm))}${wRow?.targetText ? ` · Target berat ${esc(wRow.targetText)}` : ''}${wRow?.pct != null ? ` · progres ${wRow.pct}%` : ''}</small>` : '<small>Catat berat badan untuk mulai memantau progres.</small>'}
  </div>
  ${reminders.length ? `<div class="card warn"><h3>Pengingat</h3><ul>${reminders.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>` : ''}
  <div class="card"><h3>Energi hari ini</h3>
    ${items.length || td.out ? `<div class="stats3">
      <div><span class="big">${items.length ? fmt(td.in.confirmed.kcal, 0) : '–'}</span><small>kkal masuk (terkonfirmasi)</small></div>
      <div><span class="big">${td.out ? fmt(td.out.total, 0) : '–'}</span><small>kkal keluar (estimasi)</small></div>
      <div><span class="big ${bal == null ? '' : bal > 0 ? 'bad' : 'good'}">${bal == null ? '–' : signed(bal, 0)}</span><small>${bal == null ? 'selisih' : bal > 0 ? 'surplus' : 'defisit'}</small></div></div>
      ${td.in.pending.count ? `<p class="hint">+ ${td.in.pending.count} item belum dikonfirmasi${td.in.pending.kcalMax ? ` (rentang ${fmt(td.in.pending.kcalMin, 0)}–${fmt(td.in.pending.kcalMax, 0)} kkal, tidak termasuk total)` : ''}.</p>` : ''}
      ${td.in.lowKcal ? `<p class="hint">Termasuk ${fmt(td.in.lowKcal, 0)} kkal dari estimasi keyakinan rendah.</p>` : ''}
      <p class="hint">Kalori keluar = BMR × faktor aktivitas + olahraga netto. Hanya estimasi.</p>
      <ul class="plain">${mealSummary}</ul>`
      : '<p class="empty">Belum ada makanan tercatat hari ini.</p>'}
    <div class="row gap wrap"><a class="btn primary" href="#/food">+ Catat makanan</a></div>
  </div>
  <div class="card"><h3>Kalori 7 hari terakhir</h3>
    ${barChart({ bars: en.map((e) => ({ label: fmtDate(e.date, { day: 'numeric', month: undefined, year: undefined }), vals: [e.hasFood ? Math.round(e.in.confirmed.kcal) : null, e.out ? e.out.total : null] })), names: ['Masuk', 'Keluar (est.)'], unit: 'kkal', label: 'Kalori masuk dan keluar 7 hari' })}
  </div>
  <div class="card"><h3>Olahraga</h3>
    <p>Jadwal hari ini: <b>${esc(sched?.label || '–')}</b></p>
    ${sessions.length || acts.length ? `<ul class="plain">${sessions.map((s) => `<li>✅ ${esc(s.name)} — ${s.durationMin} menit</li>`).join('')}${acts.map((a) => `<li>✅ ${esc(a.name)} — ${a.minutes} menit (~${a.kcal} kkal)</li>`).join('')}</ul>` : '<p class="empty">Belum ada olahraga tercatat hari ini.</p>'}
    <a class="btn" href="#/workout">Buka latihan</a></div>
  <div class="card"><h3>Tidur</h3>${sleep ? `<p><b>${fmtDur(sleep.minutes)}</b> pada ${fmtDate(sleep.date)} · kualitas ${sleep.quality}/5</p>` : '<p class="empty">Belum ada data tidur.</p>'}<a class="btn" href="#/sleep">Catat tidur</a></div>
  <div class="card"><h3>Progres target</h3>
    ${rows.length ? `<div class="tablewrap"><table><thead><tr><th></th><th>Awal</th><th>Target</th><th>Kini</th><th>Selisih</th><th>%</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.label}</td><td>${fmt(r.baseline)}</td><td>${esc(r.targetText)}</td><td>${fmt(r.current)}</td><td>${r.delta == null ? '–' : signed(r.delta)}</td><td>${r.pct == null ? '–' : r.pct + '%'}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">Target adalah sasaran pemantauan, bukan jaminan hasil. Perubahan berat badan atau olahraga tidak otomatis menyembuhkan fatty liver atau menormalkan kolesterol. Diskusikan hasil laboratorium dengan dokter.</p>` : '<p class="empty">Target belum diatur. Atur di Backup & Pengaturan → Profil.</p>'}
    <a class="btn" href="#/reports">Lihat laporan</a></div>
  <div class="card"><h3>Analisis AI terakhir</h3>${lastAI ? `<p><small>${esc(lastAI.provider)} · ${fmtDate(todayStr(new Date(lastAI.createdAt)))}</small></p><p>${esc(lastAI.data.ringkasan || '')}</p>` : '<p class="empty">Belum ada analisis AI yang disimpan.</p>'}<a class="btn" href="#/ai">AI Health Assistant</a></div>
  ${hasAny ? '' : '<div class="card info"><p>Mulai dengan mencatat makanan, berat badan, atau latihan. Dashboard hanya menampilkan data yang benar-benar Anda catat.</p></div>'}
  </div>`;
}
