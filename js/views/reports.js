import { esc, fmt, kkal, todayStr, addDays, fmtDate, fmtDateLong, lastNDays, avg, sum, round, signed, fmtDur, weekdayIdx } from '../util.js';
import { db } from '../db.js';
import { state, healthData, energyFor } from '../store.js';
import { seriesFor, latestOf, targetRows, NUTR_KEYS, NUTR_LABEL, NUTR_UNIT, sumItems } from '../calc.js';
import { barChart, lineChart } from '../charts.js';
import { MEAL_LABEL } from '../data/foods.js';
import { toCSV, downloadBlob } from '../backup.js';
import { toast } from '../ui.js';

let mode = 'harian', anchor = todayStr();

export async function render(el) {
  const draw = async () => {
    const n = mode === 'harian' ? 1 : mode === 'mingguan' ? 7 : 30;
    const dates = lastNDays(anchor, n), from = dates[0], to = anchor;
    const en = await energyFor(dates);
    const [items, acts, sess, sleep, notes] = await Promise.all([db.range('food_log_items', from, to), db.range('activity_logs', from, to), db.range('workout_sessions', from, to), db.range('sleep_logs', from, to), db.range('daily_summaries', from, to)]);
    const { measurements, mcus } = await healthData();
    const wS = seriesFor('weight', measurements, mcus).filter((x) => x.date >= from && x.date <= to);
    const waS = seriesFor('waist', measurements, mcus).filter((x) => x.date >= from && x.date <= to);
    const foodDays = en.filter((e) => e.hasFood);
    const avgIn = avg(foodDays.map((e) => e.in.confirmed.kcal));
    const avgOut = avg(en.filter((e) => e.out).map((e) => e.out.total));
    const doneSess = sess.filter((s) => s.status === 'selesai');
    const workoutDays = new Set([...doneSess.map((s) => s.date), ...acts.map((a) => a.date)]);
    const planned = dates.filter((d) => state.settings.schedule.find((s) => s.day === weekdayIdx(d))?.kind !== 'rest').length;
    const total = sumItems(items);
    const note = notes.find((x) => x.date === anchor);
    const cnt = {}; for (const i of items) cnt[i.name] = (cnt[i.name] || 0) + 1;
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const pend = total.pending;

    el.innerHTML = `<div class="stack"><div class="seg">${['harian', 'mingguan', 'bulanan'].map((m) => `<button class="${mode === m ? 'on' : ''}" data-mode="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>
    <div class="datebar"><button class="icon-btn" data-shift="-1">‹</button><label><input type="date" id="adate" value="${anchor}"><span>${n === 1 ? fmtDateLong(anchor) : `${fmtDate(from)} – ${fmtDate(to)}`}</span></label><button class="icon-btn" data-shift="1">›</button></div>
    <div class="card"><h3>Energi</h3>
      <div class="stats3"><div><span class="big">${avgIn == null ? '–' : fmt(avgIn, 0)}</span><small>${n === 1 ? 'kkal masuk' : 'rata-rata masuk/hari'}</small></div><div><span class="big">${avgOut == null ? '–' : fmt(avgOut, 0)}</span><small>${n === 1 ? 'kkal keluar (est.)' : 'rata-rata keluar (est.)'}</small></div>
      <div><span class="big">${avgIn != null && avgOut != null ? signed(avgIn - avgOut, 0) : '–'}</span><small>selisih</small></div></div>
      <p class="hint">${n === 1 ? '' : `Rata-rata masuk dihitung hanya dari ${foodDays.length} hari yang punya catatan makanan. `}Kalori keluar adalah estimasi.${pend.count ? ` ${pend.count} item pending tidak dihitung.` : ''}${total.lowKcal ? ` Termasuk ${fmt(total.lowKcal, 0)} kkal estimasi keyakinan rendah.` : ''}</p>
      ${n > 1 ? barChart({ bars: en.map((e) => ({ label: fmtDate(e.date, { day: 'numeric', month: undefined, year: undefined }), vals: [e.hasFood ? Math.round(e.in.confirmed.kcal) : null, e.out ? e.out.total : null] })), names: ['Masuk', 'Keluar (est.)'], unit: 'kkal', label: 'Kalori masuk dan keluar' }) : ''}</div>
    ${n === 1 ? `<div class="card"><h3>Makanan</h3>${items.length ? ['sarapan', 'siang', 'malam', 'camilan', 'minuman'].map((m) => { const a = items.filter((i) => i.meal === m); return a.length ? `<p><b>${MEAL_LABEL[m]}</b></p><ul class="plain">${a.map((i) => `<li>${esc(i.name)} — ${i.status === 'pending' ? '⏳ pending' : kkal(i.kcal)}</li>`).join('')}</ul>` : ''; }).join('') : '<p class="empty">Tidak ada makanan tercatat.</p>'}</div>` : `<div class="card"><h3>Pola makanan</h3>${top.length ? `<p>Paling sering: ${top.map(([a, c]) => `${esc(a)} (${c}×)`).join(', ')}</p>` : '<p class="empty">Belum ada data makanan.</p>'}</div>`}
    <div class="card"><h3>Nutrisi ${n === 1 ? 'hari ini' : 'total periode'} (terkonfirmasi)</h3><div class="nutr">${NUTR_KEYS.map((k) => `<div><b>${fmt(n === 1 ? total.confirmed[k] : avg(foodDays.map((e) => e.in.confirmed[k])), k === 'na' ? 0 : 1)}</b><small>${NUTR_LABEL[k]} (${NUTR_UNIT[k]})${n === 1 ? '' : ' /hari'}</small></div>`).join('')}</div></div>
    <div class="card"><h3>Olahraga</h3><p>${doneSess.length} sesi latihan + ${acts.length} aktivitas lain · hari aktif ${workoutDays.size}${n > 1 ? ` dari ${planned} hari terjadwal` : ''}</p>
      <ul class="plain">${doneSess.map((s) => `<li>${fmtDate(s.date)} ${esc(s.name)} — ${s.durationMin} mnt</li>`).join('')}${acts.map((a) => `<li>${fmtDate(a.date)} ${esc(a.name)} — ${a.minutes} mnt</li>`).join('')}</ul></div>
    <div class="card"><h3>Tubuh & tidur</h3>
      <p>Berat: ${wS.length ? `${fmt(wS[0].value)} → ${fmt(wS[wS.length - 1].value)} kg${wS.length > 1 ? ` (${signed(wS[wS.length - 1].value - wS[0].value)} kg)` : ''}` : 'tidak dicatat pada periode ini'}</p>
      <p>Lingkar perut: ${waS.length ? `${fmt(waS[0].value)} → ${fmt(waS[waS.length - 1].value)} cm` : 'tidak dicatat'}</p>
      <p>Tidur: ${sleep.length ? `rata-rata ${fmtDur(avg(sleep.map((s) => s.minutes)))}, kualitas ${fmt(avg(sleep.map((s) => s.quality)))}/5 (${sleep.length} malam)` : 'tidak dicatat'}</p>
      ${n > 1 && wS.length > 1 ? lineChart({ series: [{ name: 'Berat', pts: wS.map((x) => ({ x: x.date, y: x.value })) }], unit: 'kg', label: 'Berat badan' }) : ''}</div>
    ${mode === 'bulanan' ? monthly(mcus, measurements) : ''}
    ${n === 1 ? `<div class="card stack"><label class="field"><span>Catatan harian</span><textarea id="dnote" rows="3">${esc(note?.note || '')}</textarea></label><button class="btn" data-savenote>Simpan catatan</button></div>` : ''}
    <div class="card row gap wrap noprint"><button class="btn" data-csv>Ekspor CSV</button><button class="btn" data-print>Cetak / simpan PDF</button><a class="btn" href="#/ai?type=${mode === 'harian' ? 'eval_daily' : mode === 'mingguan' ? 'eval_weekly' : 'eval_monthly'}&date=${anchor}">Evaluasi dengan AI</a></div></div>`;
    el._csv = () => toCSV(en.map((e) => ({ tanggal: e.date, kalori_masuk_terkonfirmasi: Math.round(e.in.confirmed.kcal), kalori_pending_min: e.in.pending.kcalMin, kalori_pending_maks: e.in.pending.kcalMax, kalori_keluar_estimasi: e.out?.total ?? '', olahraga_kkal: e.exercise, protein_g: e.in.confirmed.p, karbo_g: e.in.confirmed.c, lemak_g: e.in.confirmed.f, gula_g: e.in.confirmed.sugar, serat_g: e.in.confirmed.fiber, natrium_mg: e.in.confirmed.na })));
  };
  const monthly = (mcus, meas) => {
    const rows = targetRows(state.profile, mcus, meas);
    return `<div class="card"><h3>Progres target tiga bulan</h3>${rows.length ? `<div class="tablewrap"><table><thead><tr><th></th><th>Awal</th><th>Target</th><th>Kini</th><th>Selisih</th><th>%</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.label}</td><td>${fmt(r.baseline)}</td><td>${esc(r.targetText)}</td><td>${fmt(r.current)}</td><td>${r.delta == null ? '–' : signed(r.delta)}</td><td>${r.pct == null ? '–' : r.pct + '%'}</td></tr>`).join('')}</tbody></table></div><p class="hint">Hasil laboratorium (TG, LDL, HDL) hanya berubah saat Anda memasukkan hasil MCU baru. Fatty liver perlu evaluasi medis ulang. Bahas dengan dokter.</p>` : '<p class="empty">Target belum diatur.</p>'}</div>`;
  };
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mode) { mode = b.dataset.mode; draw(); }
    else if (b.dataset.shift) { anchor = addDays(anchor, Number(b.dataset.shift) * (mode === 'harian' ? 1 : mode === 'mingguan' ? 7 : 30)); draw(); }
    else if (b.hasAttribute('data-csv')) { downloadBlob(`fittrack-laporan-${mode}-${anchor}.csv`, '﻿' + el._csv(), 'text/csv'); }
    else if (b.hasAttribute('data-print')) window.print();
    else if (b.hasAttribute('data-savenote')) { const ex = (await db.byDate('daily_summaries', anchor))[0]; await db.put('daily_summaries', { ...(ex || {}), date: anchor, note: el.querySelector('#dnote').value.trim() }); toast('Catatan tersimpan', 'ok'); }
  });
  el.addEventListener('change', (e) => { if (e.target.id === 'adate' && e.target.value) { anchor = e.target.value; draw(); } });
  await draw();
}
