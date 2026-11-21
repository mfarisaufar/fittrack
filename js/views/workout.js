import { esc, fmt, todayStr, fmtDate, weekdayIdx, DAY_NAMES, addDays, parseNum, round, sum } from '../util.js';
import { db } from '../db.js';
import { state, currentWeight } from '../store.js';
import { EXERCISES, EX_BY_ID, figureSVG } from '../data/exercises.js';
import { exerciseKcal, HOME_WORKOUT_MET, SPORT_MET } from '../calc.js';
import { lineChart } from '../charts.js';
import { modal, toast, confirmDialog } from '../ui.js';

let tab = 'jadwal', chartEx = 'wall-pushup';

export async function render(el, ctx) {
  let timer = null;
  const active = (await db.all('workout_sessions')).find((s) => s.status === 'berjalan');
  if (ctx.params.tab) tab = ctx.params.tab;

  const draw = async () => {
    clearInterval(timer);
    const act = (await db.all('workout_sessions')).find((s) => s.status === 'berjalan');
    if (act && tab === 'sesi') return drawSession(act);
    if (tab === 'sesi') tab = 'jadwal';
    const tabs = [['jadwal', 'Jadwal'], ['pustaka', 'Pustaka'], ['template', 'Template'], ['riwayat', 'Riwayat']];
    el.innerHTML = `<div class="stack"><div class="seg">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      ${act ? `<div class="card info row between"><span>Sesi <b>${esc(act.name)}</b> sedang berjalan.</span><button class="btn primary small" data-resume>Lanjutkan</button></div>` : ''}
      <div id="pane" class="stack"></div></div>`;
    const pane = el.querySelector('#pane');
    await ({ jadwal: paneJadwal, pustaka: panePustaka, template: paneTemplate, riwayat: paneRiwayat }[tab])(pane);
  };

  // ---------- Jadwal ----------
  async function paneJadwal(pane) {
    const today = todayStr(), wd = weekdayIdx(today);
    const sched = state.settings.schedule;
    const tpls = await db.all('workout_templates');
    const week = [];
    for (let i = 0; i < 7; i++) week.push(addDays(today, i - wd));
    const done = new Set([...(await db.range('workout_sessions', week[0], week[6])).filter((s) => s.status === 'selesai').map((s) => s.date), ...(await db.range('activity_logs', week[0], week[6])).map((a) => a.date)]);
    const t = sched.find((s) => s.day === wd);
    pane.innerHTML = `<div class="card"><h3>Hari ini — ${DAY_NAMES[wd]}</h3><p><b>${esc(t.label)}</b></p>
      <div class="row gap wrap">${t.kind === 'template' ? `<button class="btn primary" data-start="${t.templateId}">Mulai latihan</button>` : ''}
      ${t.kind === 'sport' ? `<button class="btn primary" data-sport="${t.sport}" data-min="${t.minutes}">Catat ${SPORT_MET[t.sport].label}</button>` : ''}
      ${t.kind === 'rest' && t.templateId ? `<button class="btn" data-start="${t.templateId}">Pemulihan ringan (opsional)</button>` : ''}
      <button class="btn" data-sport="">Catat olahraga lain</button></div></div>
      <div class="card"><h3>Jadwal minggu ini</h3><ul class="items">${sched.map((s) => `<li class="${s.day === wd ? 'today' : ''}"><div class="grow"><b>${DAY_NAMES[s.day]}</b> <small>${fmtDate(week[s.day], { year: undefined })}</small><br>${esc(s.label)}</div><div>${done.has(week[s.day]) ? '✅' : s.kind === 'rest' ? '😌' : ''}</div></li>`).join('')}</ul>
      <p class="hint">Jadwal: sepak bola Senin, badminton Rabu, Home Workout A Selasa dan B Jumat. Mulai ringan dan tingkatkan bertahap; hentikan bila nyeri tajam, pusing, atau sesak.</p></div>
      <div class="card"><h3>Mulai dari template</h3><div class="row gap wrap">${tpls.map((x) => `<button class="btn" data-start="${x.id}">${esc(x.name)}</button>`).join('')}</div></div>`;
  }

  // ---------- Pustaka ----------
  function panePustaka(pane) {
    pane.innerHTML = `<ul class="exlist">${EXERCISES.map((e) => `<li><button class="card exitem" data-ex="${e.id}"><div class="figbox">${figureSVG(e, 0)}</div><div><b>${esc(e.name)}</b><small>${esc(e.muscles)}</small><small>${e.sets} set × ${e.reps}${e.unit === 'detik' ? ' detik' : ''} · ${esc(e.level)}</small></div></button></li>`).join('')}</ul>`;
  }
  const showEx = (id) => {
    const e = EX_BY_ID[id];
    modal(e.name, `<div class="figs">${e.poses.map((_, i) => `<div class="figbox">${figureSVG(e, i)}<small>${e.poses.length > 1 ? (i === 0 ? 'Posisi awal' : 'Posisi akhir') : 'Posisi tahan'}</small></div>`).join('')}</div>
      <p class="hint">Ilustrasi garis disederhanakan; ikuti panduan teks.</p>
      <dl class="exdl"><dt>Kelompok otot</dt><dd>${esc(e.muscles)}</dd><dt>Manfaat</dt><dd>${esc(e.benefit)}</dd><dt>Posisi awal</dt><dd>${esc(e.start)}</dd>
      <dt>Langkah</dt><dd><ol>${e.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></dd><dt>Pernapasan</dt><dd>${esc(e.breath)}</dd>
      <dt>Kesalahan umum</dt><dd><ul>${e.mistakes.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></dd><dt>Tingkat kesulitan</dt><dd>${esc(e.level)}</dd>
      <dt>Modifikasi pemula</dt><dd>${esc(e.mod)}</dd><dt>Set / repetisi awal</dt><dd>${e.sets} set × ${e.reps}${e.unit === 'detik' ? ' detik' : ' repetisi'}${e.perSide ? ' per sisi' : ''}</dd><dt>Istirahat</dt><dd>${e.rest} detik</dd></dl>`, { wide: true });
  };

  // ---------- Template ----------
  async function paneTemplate(pane) {
    const tpls = await db.all('workout_templates');
    const tex = await db.all('template_exercises');
    pane.innerHTML = tpls.map((t) => {
      const list = tex.filter((x) => x.templateId === t.id).sort((a, b) => a.order - b.order);
      return `<div class="card" data-tpl="${t.id}"><div class="row between"><div><h3>${esc(t.name)}</h3><small>${esc(t.desc || '')}</small></div><button class="btn small primary" data-start="${t.id}">Mulai</button></div>
      <ul class="items">${list.map((x) => { const e = EX_BY_ID[x.exerciseId]; return `<li data-tex="${x.id}"><div class="grow"><b>${esc(e?.name || x.exerciseId)}</b></div>
        <input class="num" inputmode="numeric" data-f="sets" value="${x.sets}" aria-label="Set"> × <input class="num" inputmode="numeric" data-f="reps" value="${x.reps}" aria-label="${e?.unit === 'detik' ? 'Detik' : 'Repetisi'}"><small>${e?.unit === 'detik' ? 'dtk' : 'rep'}</small>
        <button class="btn small danger" data-rmtex="${x.id}" aria-label="Hapus">✕</button></li>`; }).join('')}</ul>
      <div class="row gap"><select data-addsel>${EXERCISES.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select><button class="btn small" data-addtex="${t.id}">+ Tambah</button></div></div>`;
    }).join('') + '<p class="hint">Ubah set/repetisi langsung pada kolom; tersimpan otomatis. Mulai ringan, naikkan bertahap.</p>';
  }

  // ---------- Riwayat ----------
  async function paneRiwayat(pane) {
    const sess = (await db.all('workout_sessions')).filter((s) => s.status === 'selesai').sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const acts = (await db.all('activity_logs')).sort((a, b) => b.date.localeCompare(a.date));
    const exLogs = await db.all('exercise_logs'), sets = await db.all('set_logs');
    const series = sess.map((s) => {
      const xl = exLogs.find((e) => e.sessionId === s.id && e.exerciseId === chartEx);
      if (!xl) return null;
      const ss = sets.filter((x) => x.exerciseLogId === xl.id && x.actual != null);
      return ss.length ? { x: s.date, y: sum(ss.map((x) => x.actual)) } : null;
    }).filter(Boolean);
    const exName = EX_BY_ID[chartEx]?.name;
    pane.innerHTML = `<div class="card"><h3>Grafik progres</h3><label class="field"><span>Gerakan</span><select id="chartex">${EXERCISES.map((e) => `<option value="${e.id}" ${e.id === chartEx ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
      ${lineChart({ series: [{ name: `Total ${EX_BY_ID[chartEx]?.unit === 'detik' ? 'detik' : 'repetisi'} per sesi`, pts: series }], unit: EX_BY_ID[chartEx]?.unit === 'detik' ? 'dtk' : 'rep', label: `Progres ${exName}` })}</div>
      <div class="card"><h3>Sesi latihan</h3>${sess.length ? `<ul class="items">${sess.map((s) => { const xs = exLogs.filter((e) => e.sessionId === s.id).sort((a, b) => a.order - b.order); return `<li data-sid="${s.id}"><div class="grow"><b>${esc(s.name)}</b> <small>${fmtDate(s.date)} · ${s.durationMin} menit · ~${s.kcal} kkal</small>
        <details><summary>Detail</summary><table><tbody>${xs.map((x) => `<tr><td>${esc(x.name)}</td><td>${x.targetSets}×${x.targetReps}</td><td>${sets.filter((y) => y.exerciseLogId === x.id).sort((a, b) => a.setNo - b.setNo).map((y) => y.actual ?? '–').join(', ')}</td></tr>`).join('')}</tbody></table>${s.note ? `<small>Catatan: ${esc(s.note)}</small>` : ''}</details></div><button class="btn small danger" data-delsess="${s.id}">Hapus</button></li>`; }).join('')}</ul>` : '<p class="empty">Belum ada sesi latihan yang diselesaikan.</p>'}</div>
      <div class="card"><h3>Olahraga lain (sepak bola, badminton, dll.)</h3>${acts.length ? `<ul class="items">${acts.map((a) => `<li><div class="grow"><b>${esc(a.name)}</b> <small>${fmtDate(a.date)} · ${a.minutes} menit · ~${a.kcal} kkal (MET ${a.met})</small>${a.note ? `<br><small>${esc(a.note)}</small>` : ''}</div><button class="btn small danger" data-delact="${a.id}">Hapus</button></li>`).join('')}</ul>` : '<p class="empty">Belum ada.</p>'}</div>
      <a class="btn" href="#/ai?type=workout_analysis">Analisis olahraga dengan AI</a>`;
  }

  // ---------- Sesi aktif ----------
  async function startSession(templateId) {
    const t = await db.get('workout_templates', templateId);
    const list = (await db.all('template_exercises')).filter((x) => x.templateId === templateId).sort((a, b) => a.order - b.order);
    const s = await db.put('workout_sessions', { date: todayStr(), templateId, name: t.name, status: 'berjalan', startedAt: Date.now() });
    for (const [i, x] of list.entries()) {
      const e = EX_BY_ID[x.exerciseId];
      const xl = await db.put('exercise_logs', { sessionId: s.id, exerciseId: x.exerciseId, name: e.name, order: i, targetSets: x.sets, targetReps: x.reps, unit: e.unit, rest: e.rest, perSide: !!e.perSide });
      await db.putMany('set_logs', Array.from({ length: x.sets }, (_, k) => ({ exerciseLogId: xl.id, sessionId: s.id, setNo: k + 1, target: x.reps, actual: null, weight: null, done: false })));
    }
    tab = 'sesi'; draw();
  }

  async function drawSession(s) {
    const exLogs = (await db.all('exercise_logs')).filter((e) => e.sessionId === s.id).sort((a, b) => a.order - b.order);
    const sets = (await db.all('set_logs')).filter((x) => x.sessionId === s.id);
    el.innerHTML = `<div class="stack"><div class="card sticky"><div class="row between"><div><h3>${esc(s.name)}</h3><small>Durasi <b id="elapsed">0:00</b></small></div><div id="rest" class="resttimer" hidden></div></div></div>
      ${exLogs.map((x) => { const e = EX_BY_ID[x.exerciseId]; return `<div class="card" data-xl="${x.id}"><div class="row gap"><div class="figbox sm">${figureSVG(e, 0)}</div><div><b>${esc(x.name)}</b><br><small>Target ${x.targetSets} set × ${x.targetReps}${x.unit === 'detik' ? ' detik' : ' rep'}${x.perSide ? ' per sisi' : ''} · istirahat ${x.rest} dtk</small><br><button class="btn small" data-ex="${x.exerciseId}">Panduan</button></div></div>
        <table class="settable"><thead><tr><th>Set</th><th>Target</th><th>Aktual</th><th>Beban (kg)</th><th>Selesai</th></tr></thead><tbody>${sets.filter((y) => y.exerciseLogId === x.id).sort((a, b) => a.setNo - b.setNo).map((y) => `<tr data-set="${y.id}"><td>${y.setNo}</td><td>${y.target}</td><td><input class="num" inputmode="numeric" data-f="actual" value="${y.actual ?? ''}" aria-label="Aktual set ${y.setNo}"></td><td><input class="num" inputmode="decimal" data-f="weight" value="${y.weight ?? ''}" aria-label="Beban"></td><td><input type="checkbox" data-f="done" ${y.done ? 'checked' : ''} aria-label="Selesai set ${y.setNo}"></td></tr>`).join('')}</tbody></table></div>`; }).join('')}
      <div class="card stack"><label class="field"><span>Catatan kondisi tubuh (opsional)</span><textarea id="snote" rows="2" placeholder="mis. lutut nyaman, napas ringan"></textarea></label>
      <button class="btn primary block" data-finish>Selesaikan sesi</button><button class="btn danger block" data-cancel>Batalkan sesi</button>
      <p class="hint">Jika hanya mencapai 8 dari target 10, isi 8 — hasil aktual yang dicatat. Jangan memaksakan target.</p></div></div>`;
    const tick = () => { const sec = Math.floor((Date.now() - s.startedAt) / 1000); const n = el.querySelector('#elapsed'); if (n) n.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
    tick(); timer = setInterval(tick, 1000);
    let restEnd = 0, restTimer = null;
    el._startRest = (sec) => {
      if (!sec) return;
      restEnd = Date.now() + sec * 1000; const r = el.querySelector('#rest'); r.hidden = false;
      clearInterval(restTimer);
      const upd = () => { const left = Math.ceil((restEnd - Date.now()) / 1000); if (left <= 0) { r.textContent = 'Istirahat selesai ✓'; clearInterval(restTimer); setTimeout(() => { r.hidden = true; }, 3000); navigator.vibrate?.(200); } else r.textContent = `Istirahat ${left} dtk`; };
      upd(); restTimer = setInterval(upd, 500);
      const prev = timer; timer = setInterval(() => { tick(); }, 1000); clearInterval(prev);
      el._restTimer = restTimer;
    };
  }

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tab) { tab = b.dataset.tab; draw(); }
    else if (b.hasAttribute('data-resume')) { tab = 'sesi'; draw(); }
    else if (b.dataset.start) {
      const act = (await db.all('workout_sessions')).find((s) => s.status === 'berjalan');
      if (act) { toast('Selesaikan atau batalkan sesi yang berjalan dahulu', 'err'); tab = 'sesi'; draw(); return; }
      startSession(b.dataset.start);
    }
    else if (b.dataset.ex) showEx(b.dataset.ex);
    else if (b.dataset.sport !== undefined) logSport(b.dataset.sport, Number(b.dataset.min) || 45, draw);
    else if (b.dataset.rmtex) { await db.del('template_exercises', b.dataset.rmtex); draw(); }
    else if (b.dataset.addtex) {
      const card = b.closest('[data-tpl]'), exId = card.querySelector('[data-addsel]').value;
      const list = (await db.all('template_exercises')).filter((x) => x.templateId === b.dataset.addtex);
      const e = EX_BY_ID[exId];
      await db.put('template_exercises', { templateId: b.dataset.addtex, exerciseId: exId, order: list.length ? Math.max(...list.map((x) => x.order)) + 1 : 0, sets: e.sets, reps: e.reps });
      draw();
    }
    else if (b.dataset.delsess) { if (await confirmDialog('Hapus sesi ini beserta set-nya?', { okText: 'Hapus', danger: true })) { const id = b.dataset.delsess; const xl = (await db.all('exercise_logs')).filter((x) => x.sessionId === id); await db.delMany('set_logs', (await db.all('set_logs')).filter((x) => x.sessionId === id).map((x) => x.id)); await db.delMany('exercise_logs', xl.map((x) => x.id)); await db.del('workout_sessions', id); draw(); } }
    else if (b.dataset.delact) { if (await confirmDialog('Hapus catatan ini?', { okText: 'Hapus', danger: true })) { await db.del('activity_logs', b.dataset.delact); draw(); } }
    else if (b.hasAttribute('data-finish')) finish();
    else if (b.hasAttribute('data-cancel')) {
      if (!(await confirmDialog('Batalkan sesi? Data set sesi ini akan dihapus.', { okText: 'Batalkan sesi', danger: true }))) return;
      const act = (await db.all('workout_sessions')).find((s) => s.status === 'berjalan');
      await db.delMany('set_logs', (await db.all('set_logs')).filter((x) => x.sessionId === act.id).map((x) => x.id));
      await db.delMany('exercise_logs', (await db.all('exercise_logs')).filter((x) => x.sessionId === act.id).map((x) => x.id));
      await db.del('workout_sessions', act.id); tab = 'jadwal'; draw();
    }
  });

  async function finish() {
    const act = (await db.all('workout_sessions')).find((s) => s.status === 'berjalan');
    const sets = (await db.all('set_logs')).filter((x) => x.sessionId === act.id);
    if (!sets.some((x) => x.done || x.actual != null)) { if (!(await confirmDialog('Belum ada set yang dicatat. Tetap selesaikan?'))) return; }
    const minutes = Math.max(1, Math.round((Date.now() - act.startedAt) / 60000));
    const w = (await currentWeight()) || 70;
    await db.put('workout_sessions', { ...act, status: 'selesai', durationMin: minutes, kcal: exerciseKcal(HOME_WORKOUT_MET, w, minutes), met: HOME_WORKOUT_MET, note: el.querySelector('#snote')?.value.trim() || undefined, endedAt: Date.now() });
    toast(`Sesi selesai (${minutes} menit)`, 'ok'); tab = 'riwayat'; draw();
  }

  el.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 'chartex') { chartEx = t.value; draw(); return; }
    const tr = t.closest('[data-set]');
    if (tr && t.dataset.f) {
      const rec = await db.get('set_logs', tr.dataset.set);
      if (t.dataset.f === 'done') {
        rec.done = t.checked;
        if (t.checked && rec.actual == null) { rec.actual = rec.target; tr.querySelector('[data-f=actual]').value = rec.target; }
        if (t.checked) { const xl = await db.get('exercise_logs', rec.exerciseLogId); el._startRest?.(xl.rest); }
      } else { const n = parseNum(t.value); rec[t.dataset.f] = Number.isFinite(n) && n >= 0 ? n : null; if (t.dataset.f === 'actual' && rec.actual != null) { rec.done = true; tr.querySelector('[data-f=done]').checked = true; } }
      await db.put('set_logs', rec); return;
    }
    const tx = t.closest('[data-tex]');
    if (tx && t.dataset.f) {
      const rec = await db.get('template_exercises', tx.dataset.tex);
      const n = Math.round(parseNum(t.value));
      if (!(n >= 1 && n <= 999)) { toast('Nilai tidak valid', 'err'); t.value = rec[t.dataset.f]; return; }
      rec[t.dataset.f] = n; await db.put('template_exercises', rec); toast('Tersimpan', 'ok');
    }
  });

  await draw();
  if (active && !ctx.params.tab) { /* tetap di jadwal dengan banner lanjutkan */ }
  return () => { clearInterval(timer); clearInterval(el._restTimer); };
}

async function logSport(sport, minutes, done) {
  const keys = Object.keys(SPORT_MET);
  const first = sport && SPORT_MET[sport] ? sport : 'jalan';
  const m = modal('Catat olahraga', `<form class="stack"><label class="field"><span>Jenis</span><select name="sport">${keys.map((k) => `<option value="${k}" ${k === first ? 'selected' : ''}>${SPORT_MET[k].label}</option>`).join('')}</select></label>
    <label class="field"><span>Nama (opsional)</span><input name="name" placeholder="mis. futsal malam"></label>
    <label class="field"><span>Intensitas</span><select name="lvl"></select></label>
    <div class="grid2"><label class="field"><span>Durasi (menit)</span><input name="minutes" inputmode="numeric" value="${minutes}" required></label>
    <label class="field"><span>Tanggal</span><input type="date" name="date" value="${todayStr()}"></label></div>
    <label class="field"><span>Catatan</span><input name="note"></label>
    <p class="hint" id="kc"></p><button class="btn primary block">Simpan</button></form>`);
  const f = m.el.querySelector('form');
  const w = (await currentWeight()) || 70;
  const fillLvl = () => { f.lvl.innerHTML = SPORT_MET[f.sport.value].levels.map(([l, met], i) => `<option value="${met}" ${i === 1 ? 'selected' : ''}>${l} (MET ${met})</option>`).join(''); };
  const kc = () => { const mn = parseNum(f.minutes.value); m.el.querySelector('#kc').textContent = mn > 0 ? `Estimasi ±${exerciseKcal(Number(f.lvl.value), w, mn)} kkal netto (berat ${fmt(w)} kg). Estimasi kasar.` : ''; };
  f.sport.onchange = () => { fillLvl(); kc(); }; f.oninput = kc; fillLvl(); kc();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const mn = parseNum(f.minutes.value), met = Number(f.lvl.value);
    if (!(mn > 0 && mn <= 600)) { toast('Durasi tidak valid', 'err'); return; }
    await db.put('activity_logs', { date: f.date.value, type: f.sport.value, name: f.name.value.trim() || SPORT_MET[f.sport.value].label, minutes: mn, met, kcal: exerciseKcal(met, w, mn), note: f.note.value.trim() || undefined });
    toast('Tersimpan', 'ok'); m.close(); done();
  };
}
