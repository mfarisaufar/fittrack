import { esc, fmt, todayStr, fmtDate, parseNum, signed } from '../util.js';
import { db } from '../db.js';
import { state, healthData } from '../store.js';
import { seriesFor, latestOf, targetRows, bmi } from '../calc.js';
import { METRICS, MCU_FIELDS, QUICK_TYPES, checkRange } from '../data/labs.js';
import { lineChart } from '../charts.js';
import { modal, toast, confirmDialog } from '../ui.js';

let tab = 'ringkasan', chartKey = 'weight', cmp = { a: null, b: null };

export async function render(el, ctx) {
  if (ctx.params.tab) tab = ctx.params.tab;
  const draw = async () => {
    const { measurements, mcus } = await healthData();
    const tabs = [['ringkasan', 'Ringkasan'], ['catat', 'Catat'], ['mcu', 'MCU'], ['grafik', 'Grafik']];
    el.innerHTML = `<div class="stack"><div class="seg">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div id="pane" class="stack"></div></div>`;
    const pane = el.querySelector('#pane');
    ({ ringkasan: ringkasan, catat: catat, mcu: mcuPane, grafik: grafik }[tab])(pane, measurements, mcus);
  };

  function ringkasan(pane, measurements, mcus) {
    const rows = targetRows(state.profile, mcus, measurements);
    const w = latestOf(seriesFor('weight', measurements, mcus));
    const keys = ['weight', 'waist', 'sys', 'hr', 'tg', 'ldl', 'hdl', 'chol', 'fbg', 'hba1c', 'uric', 'creat', 'egfr', 'ast', 'alt'];
    pane.innerHTML = `<div class="card"><h3>Nilai terakhir</h3><div class="nutr">${keys.map((k) => {
      const l = latestOf(seriesFor(k, measurements, mcus));
      const extra = k === 'sys' ? `/${latestOf(seriesFor('dia', measurements, mcus))?.value ?? '–'}` : '';
      return `<div><b>${l ? fmt(l.value, METRICS[k].dec) + extra : '–'}</b><small>${METRICS[k].label} (${METRICS[k].unit})${l ? '<br>' + fmtDate(l.date) : ''}</small></div>`;
    }).join('')}</div>${w ? `<p class="hint">BMI ${fmt(bmi(w.value, state.profile.heightCm))} (tinggi ${state.profile.heightCm} cm)</p>` : ''}</div>
    <div class="card"><h3>Baseline vs target</h3>${rows.length ? `<div class="tablewrap"><table><thead><tr><th></th><th>Awal</th><th>Target</th><th>Kini</th><th>Selisih</th><th>%</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.label}</td><td>${fmt(r.baseline)}</td><td>${esc(r.targetText)}</td><td>${fmt(r.current)}</td><td>${r.delta == null ? '–' : signed(r.delta)}</td><td>${r.pct == null ? '–' : r.pct + '%'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Target belum diatur (Pengaturan → Profil).</p>'}
    <p class="hint">Aplikasi tidak membuat diagnosis. Satu nilai tidak cukup untuk menyimpulkan kondisi; bahas hasil laboratorium dengan dokter.</p></div>
    <div class="card"><h3>Riwayat catatan</h3>${measurements.length ? `<ul class="items">${[...measurements].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 30).map((m) => `<li><div class="grow"><b>${m.type === 'bp' ? `Tekanan darah ${m.value}/${m.value2}` : `${METRICS[m.type]?.label || m.type} ${fmt(m.value, METRICS[m.type]?.dec ?? 1)}`}</b> ${m.type === 'bp' ? 'mmHg' : METRICS[m.type]?.unit || ''}<br><small>${fmtDate(m.date)}${m.source ? ' · ' + esc(m.source) : ''}${m.note ? ' · ' + esc(m.note) : ''}</small></div><button class="btn small danger" data-delm="${m.id}">Hapus</button></li>`).join('')}</ul>` : '<p class="empty">Belum ada catatan.</p>'}</div>`;
  }

  function catat(pane) {
    pane.innerHTML = `<form class="card stack" id="mform"><h3>Catat pengukuran</h3>
      <label class="field"><span>Jenis</span><select name="type">${QUICK_TYPES.map((k) => `<option value="${k}">${k === 'bp' ? 'Tekanan darah' : METRICS[k].label}</option>`).join('')}</select></label>
      <div class="grid2" id="vals"></div>
      <div class="grid2"><label class="field"><span>Tanggal</span><input type="date" name="date" value="${todayStr()}" required></label>
      <label class="field"><span>Sumber pengukuran</span><input name="source" placeholder="mis. timbangan rumah, lab" list="srcs"><datalist id="srcs"><option value="Timbangan rumah"><option value="Tensimeter"><option value="Pita ukur"><option value="Laboratorium"><option value="Smartwatch (manual)"></datalist></label></div>
      <label class="field"><span>Catatan</span><input name="note"></label>
      <button class="btn primary block">Simpan</button></form>`;
    const f = pane.querySelector('form');
    const fields = () => {
      const t = f.type.value;
      pane.querySelector('#vals').innerHTML = t === 'bp'
        ? `<label class="field"><span>Sistolik (mmHg)</span><input name="v1" inputmode="numeric" required></label><label class="field"><span>Diastolik (mmHg)</span><input name="v2" inputmode="numeric" required></label>`
        : `<label class="field"><span>Nilai (${METRICS[t].unit})</span><input name="v1" inputmode="decimal" required></label>`;
    };
    f.type.onchange = fields; fields();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const t = f.type.value, v1 = parseNum(f.v1.value), v2 = t === 'bp' ? parseNum(f.v2.value) : undefined;
      const msg = t === 'bp' ? checkRange('sys', v1) || checkRange('dia', v2) : checkRange(t, v1);
      if (msg) { toast(msg, 'err'); return; }
      if (t === 'bp' && v2 >= v1) { toast('Diastolik harus lebih rendah dari sistolik', 'err'); return; }
      await db.put('health_measurements', { type: t, date: f.date.value, value: v1, value2: v2, unit: t === 'bp' ? 'mmHg' : METRICS[t].unit, source: f.source.value.trim() || undefined, note: f.note.value.trim() || undefined });
      toast('Tersimpan', 'ok'); tab = 'ringkasan'; draw();
    };
  }

  function mcuPane(pane, measurements, mcus) {
    const sorted = [...mcus].sort((a, b) => b.date.localeCompare(a.date));
    if (!cmp.a || !mcus.some((m) => m.id === cmp.a)) cmp = { a: sorted[1]?.id || sorted[0]?.id, b: sorted[0]?.id };
    const A = mcus.find((m) => m.id === cmp.a), B = mcus.find((m) => m.id === cmp.b);
    pane.innerHTML = `<div class="card"><div class="row between"><h3>Catatan MCU</h3><button class="btn primary small" data-newmcu>+ MCU baru</button></div>
      <p class="hint">Hasil baru disimpan sebagai catatan baru dan tidak menimpa hasil sebelumnya.</p>
      ${sorted.length ? `<ul class="items">${sorted.map((m) => `<li><div class="grow"><b>${fmtDate(m.date)}</b> ${m.isBaseline ? '<span class="tag">baseline</span>' : ''}<br><small>${Object.keys(m.values || {}).length} parameter${m.facility ? ' · ' + esc(m.facility) : ''}</small></div><button class="btn small" data-editmcu="${m.id}">Lihat/Edit</button>${m.isBaseline ? '' : `<button class="btn small danger" data-delmcu="${m.id}">Hapus</button>`}</li>`).join('')}</ul>` : '<p class="empty">Belum ada.</p>'}</div>
      ${sorted.length >= 2 ? `<div class="card"><h3>Bandingkan</h3><div class="grid2"><label class="field"><span>Lama</span><select id="ca">${sorted.map((m) => `<option value="${m.id}" ${m.id === cmp.a ? 'selected' : ''}>${fmtDate(m.date)}</option>`).join('')}</select></label>
      <label class="field"><span>Baru</span><select id="cb">${sorted.map((m) => `<option value="${m.id}" ${m.id === cmp.b ? 'selected' : ''}>${fmtDate(m.date)}</option>`).join('')}</select></label></div>
      <div class="tablewrap"><table><thead><tr><th></th><th>${fmtDate(A.date)}</th><th>${fmtDate(B.date)}</th><th>Selisih</th></tr></thead><tbody>${MCU_FIELDS.filter((k) => A.values?.[k] != null || B.values?.[k] != null).map((k) => { const a = A.values?.[k], b = B.values?.[k]; return `<tr><td>${METRICS[k].label} <small>${METRICS[k].unit}</small></td><td>${fmt(a, METRICS[k].dec)}</td><td>${fmt(b, METRICS[k].dec)}</td><td>${Number.isFinite(a) && Number.isFinite(b) ? signed(b - a, METRICS[k].dec) : '–'}</td></tr>`; }).join('')}</tbody></table></div>
      <a class="btn" href="#/ai?type=mcu_compare&a=${cmp.a}&b=${cmp.b}">Bandingkan dengan AI</a></div>` : ''}
      <a class="btn" href="#/ai?type=mcu_analysis">Analisis MCU dengan AI</a>`;
    const sa = pane.querySelector('#ca'), sb = pane.querySelector('#cb');
    if (sa) { sa.onchange = () => { cmp.a = sa.value; draw(); }; sb.onchange = () => { cmp.b = sb.value; draw(); }; }
  }

  function grafik(pane, measurements, mcus) {
    const s = seriesFor(chartKey, measurements, mcus);
    const t = state.profile?.targets || {};
    const band = chartKey === 'weight' && t.weightMin && t.weightMax ? { min: t.weightMin, max: t.weightMax } : chartKey === 'waist' && t.waistMin && t.waistMax ? { min: t.waistMin, max: t.waistMax } : null;
    const ref = chartKey === 'tg' ? t.tg : chartKey === 'ldl' ? t.ldl : null;
    const series = [{ name: METRICS[chartKey].label, pts: s.map((x) => ({ x: x.date, y: x.value })) }];
    if (chartKey === 'sys') series.push({ name: 'Diastolik', pts: seriesFor('dia', measurements, mcus).map((x) => ({ x: x.date, y: x.value })) });
    pane.innerHTML = `<div class="card"><label class="field"><span>Metrik</span><select id="ck">${MCU_FIELDS.concat('hr').map((k) => `<option value="${k}" ${k === chartKey ? 'selected' : ''}>${METRICS[k].label} (${METRICS[k].unit})</option>`).join('')}</select></label>
      ${lineChart({ series, band, ref, unit: METRICS[chartKey].unit, label: `Tren ${METRICS[chartKey].label}` })}
      ${band ? '<p class="hint">Area berwarna = rentang target.</p>' : ref ? '<p class="hint">Garis putus-putus = target (di bawah).</p>' : ''}
      ${s.length ? `<ul class="plain hint">${s.slice(-6).map((x) => `<li>${fmtDate(x.date)}: ${fmt(x.value, METRICS[chartKey].dec)} ${METRICS[chartKey].unit} <small>(${x.src})</small></li>`).join('')}</ul>` : ''}</div>`;
    pane.querySelector('#ck').onchange = (e) => { chartKey = e.target.value; draw(); };
  }

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tab) { tab = b.dataset.tab; draw(); }
    else if (b.dataset.delm) { if (await confirmDialog('Hapus catatan ini?', { okText: 'Hapus', danger: true })) { await db.del('health_measurements', b.dataset.delm); draw(); } }
    else if (b.dataset.delmcu) { if (await confirmDialog('Hapus catatan MCU ini? Tidak dapat dibatalkan.', { okText: 'Hapus', danger: true })) { await db.del('mcu_records', b.dataset.delmcu); draw(); } }
    else if (b.hasAttribute('data-newmcu')) mcuForm(null, draw);
    else if (b.dataset.editmcu) mcuForm(await db.get('mcu_records', b.dataset.editmcu), draw);
  });
  await draw();
}

function mcuForm(rec, done) {
  const v = rec?.values || {};
  const m = modal(rec ? 'MCU ' + fmtDate(rec.date) : 'MCU baru', `<form class="stack"><label class="field"><span>Tanggal pemeriksaan *</span><input type="date" name="date" required value="${rec?.date || todayStr()}"></label>
    <label class="field"><span>Fasilitas/Lab</span><input name="facility" value="${esc(rec?.facility || '')}"></label>
    <div class="grid2">${MCU_FIELDS.map((k) => `<label class="field"><span>${METRICS[k].label} (${METRICS[k].unit})</span><input name="v_${k}" inputmode="decimal" value="${v[k] ?? ''}"></label>`).join('')}</div>
    <label class="field"><span>USG</span><input name="usg" value="${esc(rec?.usg || '')}"></label><label class="field"><span>EKG</span><input name="ekg" value="${esc(rec?.ekg || '')}"></label>
    <label class="field"><span>Catatan</span><textarea name="note" rows="2">${esc(rec?.note || '')}</textarea></label><button class="btn primary block">Simpan</button></form>`, { wide: true });
  m.el.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, values = {};
    for (const k of MCU_FIELDS) { const raw = f['v_' + k].value; if (!raw.trim()) continue; const n = parseNum(raw); const msg = checkRange(k, n); if (msg) { toast(msg, 'err'); return; } values[k] = n; }
    if (!Object.keys(values).length) { toast('Isi minimal satu nilai', 'err'); return; }
    await db.put('mcu_records', { ...(rec || {}), date: f.date.value, facility: f.facility.value.trim() || undefined, values, usg: f.usg.value.trim() || undefined, ekg: f.ekg.value.trim() || undefined, note: f.note.value.trim() || undefined });
    toast('MCU tersimpan', 'ok'); m.close(); done();
  };
}
