import { esc, fmt, todayStr, fmtDate, parseNum, round, addDays } from '../util.js';
import { db } from '../db.js';
import { state, saveSettings, aiData } from '../store.js';
import { AI_TYPES, AI_TYPE_BY_ID, PROVIDERS, MARKER, buildPrompt, extractResult, validateResult, compareResults, buildSynthesisPrompt, AI_PRIVACY_NOTE, DEFAULT_INCLUDE } from '../ai.js';
import { NUTR_KEYS } from '../calc.js';
import { modal, toast, copyText, confirmDialog } from '../ui.js';

const S = { tab: 'siapkan', provider: 'chatgpt', type: 'eval_daily', date: todayStr(), days: 7, question: '', itemIds: [], mcuA: null, mcuB: null, prompt: '', cmpA: null, cmpB: null, parsed: null, raw: '', origin: 'chatgpt', convId: '' };
const PROV_LABEL = { chatgpt: 'ChatGPT', claude: 'Claude', both: 'Keduanya', compare: 'Perbandingan hasil' };
const INC_LABEL = { profile: 'Profil dasar (jenis kelamin, usia, tinggi)', body: 'Berat & lingkar perut', bp: 'Tekanan darah', mcu: 'Hasil MCU / laboratorium', food: 'Makanan & nutrisi', activity: 'Olahraga', sleep: 'Tidur' };

export async function render(el, ctx) {
  const p = ctx.params;
  if (p.type && AI_TYPE_BY_ID[p.type]) { S.type = p.type; S.tab = 'siapkan'; S.prompt = ''; }
  if (p.date) S.date = p.date;
  if (p.item) S.itemIds = [p.item];
  if (p.q) S.question = p.q;
  if (p.a) { S.mcuA = p.a; S.mcuB = p.b; }

  const draw = async () => {
    const tabs = [['siapkan', '1. Siapkan prompt'], ['impor', '2. Impor jawaban'], ['bandingkan', 'Bandingkan'], ['riwayat', 'Riwayat']];
    el.innerHTML = `<div class="stack"><div class="card info"><b>Cara kerja (manual, tanpa API):</b> FitTrack menyusun prompt → Anda salin &amp; kirim sendiri di ChatGPT/Claude → salin jawabannya → tempel di tab Impor. FitTrack tidak mengirim atau membaca apa pun secara otomatis.</div>
      <div class="seg wrap">${tabs.map(([k, l]) => `<button class="${S.tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div id="pane" class="stack"></div></div>`;
    const pane = el.querySelector('#pane');
    await ({ siapkan, impor, bandingkan, riwayat }[S.tab])(pane);
  };

  // ---------- Siapkan ----------
  async function siapkan(pane) {
    const t = AI_TYPE_BY_ID[S.type];
    const inc = { ...DEFAULT_INCLUDE, ...state.settings.aiInclude };
    const pending = t.needsPending ? (await db.all('food_log_items')).filter((i) => i.status === 'pending').sort((a, b) => b.date.localeCompare(a.date)) : [];
    const mcus = t.needsTwoMcu ? (await db.all('mcu_records')).sort((a, b) => b.date.localeCompare(a.date)) : [];
    if (t.needsTwoMcu && (!S.mcuA || !mcus.some((m) => m.id === S.mcuA))) { S.mcuA = mcus[1]?.id || mcus[0]?.id; S.mcuB = mcus[0]?.id; }
    pane.innerHTML = `<div class="card stack"><h3>Pilih AI</h3><div class="chips">${Object.entries(PROV_LABEL).map(([k, l]) => `<label class="chip ${S.provider === k ? 'on' : ''}"><input type="radio" name="prov" value="${k}" ${S.provider === k ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      <label class="field"><span>Jenis analisis</span><select id="atype">${AI_TYPES.map((x) => `<option value="${x.id}" ${x.id === S.type ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>
      ${t.period === 'date' ? `<label class="field"><span>Tanggal</span><input type="date" id="adate" value="${S.date}"></label>` : ''}
      ${t.period === 'days' ? `<div class="grid2"><label class="field"><span>Tanggal akhir</span><input type="date" id="adate" value="${S.date}"></label>${t.fixedDays ? `<div class="field"><span>Periode</span><b>${t.fixedDays} hari</b></div>` : `<label class="field"><span>Periode (hari)</span><select id="adays">${[7, 14, 30].map((d) => `<option ${d === (S.days || t.defaultDays) ? 'selected' : ''}>${d}</option>`).join('')}</select></label>`}</div>` : ''}
      ${t.needsText ? `<label class="field"><span>${esc(t.needsText)}</span><textarea id="aq" rows="3">${esc(S.question)}</textarea></label>` : ''}
      ${t.needsPending ? `<div class="field"><span>Item yang dianalisis (status pending)</span>${pending.length ? pending.map((i) => `<label class="check"><input type="checkbox" data-item="${i.id}" ${S.itemIds.includes(i.id) ? 'checked' : ''}> ${esc(i.name)} — Rp${fmt(i.price || 0, 0)} <small>${fmtDate(i.date)}</small></label>`).join('') : '<p class="empty">Tidak ada item pending. Catat makanan dengan nominal Rupiah di menu Makan.</p>'}</div>` : ''}
      ${t.needsTwoMcu ? `<div class="grid2"><label class="field"><span>MCU lama</span><select id="ma">${mcus.map((m) => `<option value="${m.id}" ${m.id === S.mcuA ? 'selected' : ''}>${fmtDate(m.date)}</option>`).join('')}</select></label><label class="field"><span>MCU baru</span><select id="mb">${mcus.map((m) => `<option value="${m.id}" ${m.id === S.mcuB ? 'selected' : ''}>${fmtDate(m.date)}</option>`).join('')}</select></label></div>` : ''}
      ${t.photoNote ? '<p class="hint">Lampirkan foto makanan sendiri pada percakapan AI setelah menempel prompt. FitTrack tidak mengirim foto.</p>' : ''}</div>
      <div class="card stack"><h3>Data yang boleh disertakan</h3><p class="hint">Hapus centang pada data sensitif yang tidak ingin dikirim (mis. hasil MCU). Tidak ada nama, email, atau tanggal lahir yang dikirim — hanya usia.</p>
      ${Object.entries(INC_LABEL).map(([k, l]) => `<label class="check"><input type="checkbox" data-inc="${k}" ${inc[k] ? 'checked' : ''}> ${l}</label>`).join('')}
      <button class="btn primary block" id="gen">Buat prompt &amp; pratinjau</button></div>
      <div id="out"></div>`;
    if (S.prompt) showPrompt(pane.querySelector('#out'));
    const g = (id) => pane.querySelector(id);
    g('#atype').onchange = (e) => { S.type = e.target.value; S.prompt = ''; S.itemIds = []; draw(); };
    pane.querySelectorAll('[name=prov]').forEach((r) => { r.onchange = () => { S.provider = r.value; S.tab = 'siapkan'; draw(); }; });
    pane.querySelectorAll('[data-inc]').forEach((c) => { c.onchange = async () => { await saveSettings({ aiInclude: { ...inc, ...Object.fromEntries([...pane.querySelectorAll('[data-inc]')].map((x) => [x.dataset.inc, x.checked])) } }); S.prompt = ''; g('#out').innerHTML = ''; }; });
    pane.querySelectorAll('[data-item]').forEach((c) => { c.onchange = () => { S.itemIds = [...pane.querySelectorAll('[data-item]:checked')].map((x) => x.dataset.item); }; });
    if (g('#adate')) g('#adate').onchange = (e) => { S.date = e.target.value; };
    if (g('#adays')) g('#adays').onchange = (e) => { S.days = Number(e.target.value); };
    if (g('#aq')) g('#aq').oninput = (e) => { S.question = e.target.value; };
    if (g('#ma')) { g('#ma').onchange = (e) => { S.mcuA = e.target.value; }; g('#mb').onchange = (e) => { S.mcuB = e.target.value; }; }
    g('#gen').onclick = async () => {
      if (t.needsPending && !S.itemIds.length) { toast('Pilih minimal satu item pending', 'err'); return; }
      if (t.needsText && t.id !== 'food_photo' && !S.question.trim()) { toast('Isi teks yang diminta', 'err'); return; }
      const days = t.fixedDays || S.days || t.defaultDays || 1;
      const from = t.period === 'days' ? addDays(S.date, -(days - 1)) : S.date;
      const data = await aiData(from, S.date);
      S.prompt = buildPrompt(S.type, data, { include: state.settings.aiInclude, date: S.date, days, question: S.question, itemIds: S.itemIds, mcuA: S.mcuA, mcuB: S.mcuB });
      showPrompt(g('#out'));
      g('#out').scrollIntoView({ behavior: 'smooth' });
    };
  }

  function showPrompt(out) {
    const provs = S.provider === 'both' || S.provider === 'compare' ? ['chatgpt', 'claude'] : [S.provider];
    out.innerHTML = `<div class="card stack"><h3>Pratinjau prompt</h3><p class="hint">Inilah seluruh teks yang akan Anda salin (${fmt(S.prompt.length, 0)} karakter). Periksa dahulu — hanya data terpilih yang ada di dalamnya.</p>
      <textarea id="ptxt" rows="12" readonly>${esc(S.prompt)}</textarea>
      ${provs.map((k) => `<div class="row gap wrap"><button class="btn primary" data-copy="${k}">Salin Prompt ${PROVIDERS[k].label}</button><button class="btn" data-open="${k}">Buka ${PROVIDERS[k].label}</button></div>`).join('')}
      ${S.provider === 'compare' ? '<p class="hint">Mode perbandingan: kirim prompt yang sama ke kedua AI, impor kedua jawaban di tab Impor, lalu buka tab Bandingkan.</p>' : ''}
      <p class="hint">${esc(AI_PRIVACY_NOTE)}</p>
      <button class="btn" data-goimport>Sudah mendapat jawaban → Impor</button></div>`;
    out.onclick = async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.copy) {
        const ok = await copyText(S.prompt);
        const conv = await db.put('ai_conversations', { type: S.type, provider: b.dataset.copy, prompt: S.prompt, date: S.date });
        S.convId = conv.id;
        toast(ok ? `Prompt disalin. Buka ${PROVIDERS[b.dataset.copy].label}, tempel, lalu kirim.` : 'Gagal menyalin otomatis — pilih teks di kotak dan salin manual.', ok ? 'ok' : 'err');
      } else if (b.dataset.open) window.open(PROVIDERS[b.dataset.open].url, '_blank', 'noopener');
      else if (b.hasAttribute('data-goimport')) { S.tab = 'impor'; S.origin = S.provider === 'claude' ? 'claude' : 'chatgpt'; draw(); }
    };
  }

  // ---------- Impor ----------
  async function impor(pane) {
    const convs = (await db.all('ai_conversations')).sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
    pane.innerHTML = `<div class="card stack"><h3>Impor jawaban AI</h3>
      <div class="grid2"><label class="field"><span>Jawaban dari</span><select id="origin">${[['chatgpt', 'ChatGPT'], ['claude', 'Claude'], ['lain', 'Lainnya']].map(([k, l]) => `<option value="${k}" ${k === S.origin ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>Untuk prompt (opsional)</span><select id="conv"><option value="">–</option>${convs.map((c) => `<option value="${c.id}" ${c.id === S.convId ? 'selected' : ''}>${esc(AI_TYPE_BY_ID[c.type]?.label || c.type)} · ${PROVIDERS[c.provider]?.label || ''} · ${fmtDate(todayStr(new Date(c.createdAt)))}</option>`).join('')}</select></label></div>
      <label class="field"><span>Tempel jawaban lengkap dari AI (termasuk blok ${MARKER})</span><textarea id="raw" rows="9">${esc(S.raw)}</textarea></label>
      <button class="btn primary block" id="val">Validasi &amp; pratinjau</button></div><div id="res"></div>`;
    const g = (id) => pane.querySelector(id);
    g('#origin').onchange = (e) => { S.origin = e.target.value; };
    g('#conv').onchange = (e) => { S.convId = e.target.value; };
    g('#raw').oninput = (e) => { S.raw = e.target.value; };
    g('#val').onclick = async () => { S.parsed = null; await showResult(g('#res')); };
    if (S.raw && S.parsed) showResult(g('#res'));
  }

  async function showResult(out) {
    const r = extractResult(S.raw);
    const conv = S.convId ? await db.get('ai_conversations', S.convId) : null;
    const v = r.ok ? validateResult(r.data, conv?.type) : null;
    const origin = PROV_LABEL[S.origin] || (S.origin === 'lain' ? 'Lainnya' : S.origin);
    S.parsed = r.ok ? { r, v } : { r };
    if (!r.ok || !v.ok) {
      const errs = r.ok ? v.errors : [r.error];
      out.innerHTML = `<div class="card err"><h3>Jawaban tidak dapat disimpan otomatis</h3><ul>${errs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <p>Pilihan: minta AI memperbaiki (kirim ulang pesan: "Tolong ulangi blok ${MARKER} dengan JSON valid sesuai skema"), simpan sebagai catatan teks, atau input manual.</p>
        <div class="row gap wrap"><button class="btn" data-savetext>Simpan sebagai catatan teks</button><a class="btn" href="#/food">Input manual (Makan)</a></div></div>`;
      out.onclick = async (e) => { if (e.target.closest('[data-savetext]')) { if (!S.raw.trim()) return; const msg = await db.put('ai_messages', { conversationId: S.convId || undefined, provider: S.origin, role: 'answer', text: S.raw }); await db.put('ai_imports', { conversationId: S.convId || undefined, messageId: msg.id, provider: origin, type: conv?.type, status: 'text', raw: S.raw }); toast('Disimpan sebagai catatan teks', 'ok'); S.raw = ''; S.parsed = null; S.tab = 'riwayat'; draw(); } };
      return;
    }
    const d = r.data, t = AI_TYPE_BY_ID[d.type];
    const pending = t.kind === 'food' ? (await db.all('food_log_items')).filter((i) => i.status === 'pending') : [];
    const compOpts = t.kind === 'food' ? (await db.all('food_menus')).flatMap((mn) => mn.comps.filter((c) => c.status !== 'confirmed').map((c) => ({ v: `comp:${mn.id}:${c.id}`, name: c.name, label: `Menu “${mn.name}” → ${c.name}` }))) : [];
    out.innerHTML = `<div class="card stack"><h3>Pratinjau hasil</h3><p><span class="tag">${esc(origin)}</span> <span class="tag">${esc(t.label)}</span> ${d.keyakinan ? `<span class="tag">keyakinan ${esc(d.keyakinan)}</span>` : ''}</p>
      ${v.warnings.length ? `<div class="card warn"><b>Periksa:</b><ul>${v.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
      ${resultHTML(d)}
      ${t.kind === 'food' ? `<div class="card inner"><b>Terapkan ke item makanan?</b><p class="hint">Jika dipilih, nilai kkal/nutrisi “terbaik” dari AI diterapkan ke item dan <b>dihitung sebagai estimasi</b> (keyakinan sesuai AI). Jika tidak, hasil hanya disimpan sebagai referensi.</p>
        ${d.items.map((it, i) => { const guess = pending.find((p) => p.id === it.ref) || pending.find((p) => p.name.toLowerCase() === String(it.nama).toLowerCase()); const cg = !guess && compOpts.find((c) => c.name.toLowerCase() === String(it.nama).toLowerCase()); return `<label class="field"><span>${esc(it.nama)} (${fmt(it.kcal_best, 0)} kkal)</span><select data-map="${i}"><option value="">Jangan terapkan</option>${pending.map((p) => `<option value="${p.id}" ${guess?.id === p.id ? 'selected' : ''}>Jurnal: ${esc(p.name)} — ${fmtDate(p.date)}</option>`).join('')}${compOpts.map((c) => `<option value="${c.v}" ${cg?.v === c.v ? 'selected' : ''}>${esc(c.label)} (disimpan untuk seterusnya)</option>`).join('')}</select></label>`; }).join('')}</div>` : ''}
      <button class="btn primary block" id="confirm">Konfirmasi &amp; simpan</button></div>`;
    out.querySelector('#confirm').onclick = async () => {
      const msg = await db.put('ai_messages', { conversationId: S.convId || undefined, provider: S.origin, role: 'answer', text: S.raw });
      await db.put('ai_imports', { conversationId: S.convId || undefined, messageId: msg.id, provider: origin, providerKey: S.origin, type: d.type, status: 'saved', data: d, raw: S.raw });
      let applied = 0;
      for (const sel of out.querySelectorAll('[data-map]')) {
        if (!sel.value) continue;
        const it = d.items[Number(sel.dataset.map)];
        if (sel.value.startsWith('comp:')) {
          const [, mid, cid] = sel.value.split(':'), mn = await db.get('food_menus', mid), ci = mn?.comps.findIndex((c) => c.id === cid);
          if (mn && ci >= 0) {
            mn.comps[ci] = { ...mn.comps[ci], status: 'confirmed', n: { kcal: it.kcal_best, p: it.protein_g ?? 0, c: it.carbs_g ?? 0, f: it.fat_g ?? 0, sat: it.sat_fat_g ?? 0, sugar: it.sugar_g ?? 0, fiber: it.fiber_g ?? 0, na: it.sodium_mg ?? 0 }, grams: it.grams_best ?? mn.comps[ci].grams, estimated: true, confidence: it.keyakinan || d.keyakinan || 'rendah', basis: 'ai', range: undefined, assumptions: it.asumsi };
            await db.put('food_menus', mn); applied++;
          }
          continue;
        }
        const target = await db.get('food_log_items', sel.value);
        if (!target) continue;
        const upd = { ...target, status: 'confirmed', estimated: true, confidence: it.keyakinan || d.keyakinan || 'rendah', basis: 'ai', aiProvider: origin, approvedAt: Date.now(), kcal: it.kcal_best, p: it.protein_g ?? 0, c: it.carbs_g ?? 0, f: it.fat_g ?? 0, sat: it.sat_fat_g ?? 0, sugar: it.sugar_g ?? 0, fiber: it.fiber_g ?? 0, na: it.sodium_mg ?? 0, grams: it.grams_best ?? target.grams, kcalMin: it.kcal_min, kcalMax: it.kcal_max, assumptions: [...(it.asumsi || []), ...(target.assumptions || [])] };
        await db.put('food_log_items', upd); applied++;
      }
      toast(applied ? `Disimpan; ${applied} item diperbarui` : 'Hasil disimpan', 'ok');
      S.raw = ''; S.parsed = null; S.tab = 'riwayat'; draw();
    };
  }

  // ---------- Bandingkan ----------
  async function bandingkan(pane) {
    const imps = (await db.all('ai_imports')).filter((i) => i.status === 'saved' && i.data).sort((a, b) => b.createdAt - a.createdAt);
    if (imps.length < 2) { pane.innerHTML = '<div class="card"><p class="empty">Perlu minimal dua jawaban yang sudah diimpor (mis. satu dari ChatGPT dan satu dari Claude untuk prompt yang sama). Gunakan tab Siapkan → pilih “Perbandingan hasil”.</p></div>'; return; }
    if (!imps.some((i) => i.id === S.cmpA)) { const a = imps.find((i) => i.providerKey === 'chatgpt') || imps[0]; S.cmpA = a.id; S.cmpB = (imps.find((i) => i.providerKey === 'claude' && i.type === a.type) || imps.find((i) => i.id !== a.id)).id; }
    const A = imps.find((i) => i.id === S.cmpA), B = imps.find((i) => i.id === S.cmpB) || imps[1];
    const opt = (sel) => imps.map((i) => `<option value="${i.id}" ${i.id === sel ? 'selected' : ''}>${esc(i.provider)} · ${esc(AI_TYPE_BY_ID[i.type]?.label || i.type)} · ${fmtDate(todayStr(new Date(i.createdAt)))}</option>`).join('');
    const c = compareResults(A.data, B.data);
    const list = (a) => (a.length ? `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="empty">–</p>');
    pane.innerHTML = `<div class="card stack"><div class="grid2"><label class="field"><span>Hasil A</span><select id="ca">${opt(A.id)}</select></label><label class="field"><span>Hasil B</span><select id="cb">${opt(B.id)}</select></label></div>
      <p class="hint">Perbandingan dilakukan lokal dari hasil yang Anda impor. Tidak ada pemanggilan AI.</p></div>
      <div class="card"><h3>Berdampingan</h3><div class="side"><div><h4>${esc(A.provider)}</h4>${resultHTML(A.data)}</div><div><h4>${esc(B.provider)}</h4>${resultHTML(B.data)}</div></div></div>
      <div class="card"><h3>Persamaan</h3>${c.recommendations.common.length ? `<ul>${c.recommendations.common.map((x) => `<li>${esc(x.a)}</li>`).join('')}</ul>` : '<p class="empty">Tidak ada rekomendasi yang mirip.</p>'}
        <p class="hint">Keyakinan: ${esc(A.provider)} ${esc(c.confidence.a || '–')} · ${esc(B.provider)} ${esc(c.confidence.b || '–')}</p></div>
      <div class="card"><h3>Perbedaan</h3><b>Hanya ${esc(A.provider)}</b>${list(c.recommendations.onlyA)}<b>Hanya ${esc(B.provider)}</b>${list(c.recommendations.onlyB)}
        ${c.numeric.length ? `<h4>Nilai</h4><div class="tablewrap"><table><thead><tr><th>Item</th><th>Bidang</th><th>${esc(A.provider)}</th><th>${esc(B.provider)}</th><th>Beda</th></tr></thead><tbody>${c.numeric.map((n) => `<tr class="${n.diffPct == null || n.diffPct >= 15 ? 'diff' : ''}"><td>${esc(n.name)}</td><td>${n.field}</td><td>${n.a ?? '–'}</td><td>${n.b ?? '–'}</td><td>${n.diffPct == null ? '–' : n.diffPct + '%'}</td></tr>`).join('')}</tbody></table></div>` : ''}
        <h4>Asumsi</h4><div class="side"><div>${list(c.assumptions.a)}</div><div>${list(c.assumptions.b)}</div></div>
        <h4>Perlu dikonfirmasi</h4><div class="side"><div>${list(c.confirm.a)}</div><div>${list(c.confirm.b)}</div></div></div>
      <div class="card stack"><h3>Prompt sintesis</h3><p class="hint">Salin dan tempel ke ChatGPT atau Claude agar menyatukan kedua hasil.</p>
        <div class="row gap wrap"><button class="btn primary" data-syn="chatgpt">Salin sintesis ChatGPT</button><button class="btn" data-open="chatgpt">Buka ChatGPT</button><button class="btn primary" data-syn="claude">Salin sintesis Claude</button><button class="btn" data-open="claude">Buka Claude</button></div></div>`;
    pane.querySelector('#ca').onchange = (e) => { S.cmpA = e.target.value; draw(); };
    pane.querySelector('#cb').onchange = (e) => { S.cmpB = e.target.value; draw(); };
    pane.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.syn) { const ok = await copyText(buildSynthesisPrompt(A.data, B.data, { a: A.provider, b: B.provider })); toast(ok ? 'Prompt sintesis disalin' : 'Gagal menyalin', ok ? 'ok' : 'err'); }
      else if (b.dataset.open) window.open(PROVIDERS[b.dataset.open].url, '_blank', 'noopener');
    };
  }

  // ---------- Riwayat ----------
  async function riwayat(pane) {
    const imps = (await db.all('ai_imports')).sort((a, b) => b.createdAt - a.createdAt);
    const convs = await db.all('ai_conversations');
    pane.innerHTML = `<div class="card"><div class="row between"><h3>Jawaban tersimpan</h3><button class="btn small danger" data-clear>Hapus semua riwayat AI</button></div>
      ${imps.length ? `<ul class="items">${imps.map((i) => `<li><div class="grow"><b>${esc(AI_TYPE_BY_ID[i.type]?.label || 'Catatan teks')}</b> <span class="tag">${esc(i.provider)}</span> ${i.status === 'text' ? '<span class="tag">teks</span>' : ''}<br><small>${fmtDate(todayStr(new Date(i.createdAt)))}</small><details><summary>${esc((i.data?.ringkasan || i.raw || '').slice(0, 90))}…</summary><p>${esc(i.data?.ringkasan || '')}</p><pre class="raw">${esc(i.raw)}</pre></details></div><button class="btn small danger" data-delimp="${i.id}">Hapus</button></li>`).join('')}</ul>` : '<p class="empty">Belum ada.</p>'}
      <p class="hint">${convs.length} prompt tersimpan lokal.</p></div>`;
    pane.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.delimp) { await db.del('ai_imports', b.dataset.delimp); draw(); }
      else if (b.hasAttribute('data-clear')) { if (await confirmDialog('Hapus semua riwayat AI lokal (prompt, jawaban, hasil)? Data makanan yang sudah diterapkan tidak berubah.', { okText: 'Hapus', danger: true })) { for (const s of ['ai_conversations', 'ai_messages', 'ai_imports']) await db.clear(s); toast('Riwayat AI dihapus', 'ok'); draw(); } }
    };
  }

  el.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { S.tab = b.dataset.tab; draw(); } });
  await draw();
}

function resultHTML(d) {
  const ul = (a) => (a?.length ? `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  return `<div class="result"><p><b>Ringkasan:</b> ${esc(d.ringkasan)}</p>${d.analisis?.length ? `<b>Analisis</b>${ul(d.analisis)}` : ''}
    ${d.items?.length ? `<div class="tablewrap"><table><thead><tr><th>Item</th><th>Gram</th><th>kkal (min–maks)</th><th>P/K/L</th><th>Yakin</th></tr></thead><tbody>${d.items.map((i) => `<tr><td>${esc(i.nama)}</td><td>${i.grams_best != null ? fmt(i.grams_best, 0) : '–'}</td><td><b>${fmt(i.kcal_best, 0)}</b> (${i.kcal_min != null ? fmt(i.kcal_min, 0) : '?'}–${i.kcal_max != null ? fmt(i.kcal_max, 0) : '?'})</td><td>${fmt(i.protein_g, 0)}/${fmt(i.carbs_g, 0)}/${fmt(i.fat_g, 0)}</td><td>${esc(i.keyakinan || '–')}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${d.asumsi?.length ? `<b>Asumsi</b>${ul(d.asumsi)}` : ''}${d.rekomendasi?.length ? `<b>Rekomendasi</b>${ul(d.rekomendasi)}` : ''}${d.perlu_konfirmasi?.length ? `<b>Perlu dikonfirmasi</b>${ul(d.perlu_konfirmasi)}` : ''}</div>`;
}
