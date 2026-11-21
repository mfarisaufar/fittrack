import { esc, fmt, kkal, rp, todayStr, addDays, fmtDateLong, parseNum, parseRupiah, round, uid } from '../util.js';
import { db } from '../db.js';
import { state, saveSettings, allFoods, getFood, energyFor, addFoodItem } from '../store.js';
import { renderQuick, saveItemAsFavorite, saveItemToMenu, saveMealAsMenu, openManager } from './menus.js';
import { MEALS, MEAL_LABEL, CATEGORIES } from '../data/foods.js';
import { UNITS, unitGrams, unitIsSpecific, nutrientsFor, NUTR_KEYS, NUTR_LABEL, NUTR_UNIT, rupiahEstimate } from '../calc.js';
import { modal, toast, confirmDialog, on, resizeImage } from '../ui.js';

let date = todayStr();

export async function render(el, ctx) {
  if (ctx?.params?.date) date = ctx.params.date;
  const draw = async () => {
    const items = (await db.byDate('food_log_items', date)).sort((a, b) => a.createdAt - b.createdAt);
    const [en] = await energyFor([date]);
    const s = en.in;
    const byMeal = Object.fromEntries(MEALS.map(([k]) => [k, []]));
    for (const i of items) (byMeal[i.meal] ||= []).push(i);
    const c = s.confirmed;
    const satPct = c.kcal ? round(c.sat * 9 / c.kcal * 100, 0) : null;

    el.innerHTML = `<div class="stack">
    <div class="datebar"><button class="icon-btn" data-d="-1" aria-label="Hari sebelumnya">‹</button>
      <label><input type="date" id="fdate" value="${date}"><span>${fmtDateLong(date)}</span></label>
      <button class="icon-btn" data-d="1" aria-label="Hari berikutnya">›</button></div>
    <div class="card"><h3>Ringkasan hari ini</h3>
      <div class="stats3">
        <div><span class="big">${fmt(c.kcal, 0)}</span><small>kkal masuk</small></div>
        <div><span class="big">${en.out ? fmt(en.out.total, 0) : '–'}</span><small>kkal keluar (est.)</small></div>
        <div><span class="big ${en.balance == null ? '' : en.balance > 0 ? 'bad' : 'good'}">${en.balance == null ? '–' : (en.balance > 0 ? '+' : '−') + fmt(Math.abs(en.balance), 0)}</span><small>${en.balance == null ? 'selisih' : en.balance > 0 ? 'surplus' : 'defisit'}</small></div>
      </div>
      ${s.lowKcal ? `<p class="hint">Dari total, ${fmt(s.lowKcal, 0)} kkal berasal dari estimasi <b>keyakinan rendah</b>.</p>` : ''}
      ${s.pending.count ? `<p class="hint warnbg">⏳ ${s.pending.count} item <b>menunggu konfirmasi</b>${s.pending.kcalMax ? ` — kira-kira ${fmt(s.pending.kcalMin, 0)}–${fmt(s.pending.kcalMax, 0)} kkal` : ''}. Tidak dihitung dalam total di atas.</p>` : ''}
      ${en.out ? `<p class="hint">Kalori keluar: BMR ${fmt(en.out.bmr, 0)} × faktor aktivitas ${state.settings.pal} = ${fmt(en.out.base, 0)}, + olahraga netto ${fmt(en.out.exercise, 0)}. Estimasi, bukan pengukuran; defisit satu hari bukan bukti penurunan lemak.</p>` : '<p class="hint">Catat berat badan agar estimasi kalori keluar dapat dihitung.</p>'}
    </div>
    ${MEALS.map(([k, label]) => `<div class="card"><div class="row between"><h3>${label}</h3><div class="row gap">${byMeal[k].length ? `<button class="btn small" data-savemeal="${k}" title="Simpan semua item sebagai satu menu">Simpan menu</button>` : ''}<button class="btn small primary" data-add="${k}">+ Tambah</button></div></div>
      ${byMeal[k].length ? `<ul class="items">${byMeal[k].map(itemRow).join('')}</ul>` : '<p class="empty">Belum ada item.</p>'}</div>`).join('')}
    <div class="card"><h3>Ringkasan nutrisi</h3>
      <div class="nutr">${NUTR_KEYS.map((k) => `<div><b>${fmt(c[k], k === 'na' ? 0 : 1)}</b><small>${NUTR_LABEL[k]} (${NUTR_UNIT[k]})</small></div>`).join('')}</div>
      <ul class="plain hint"><li>Lemak jenuh: ${satPct == null ? '–' : satPct + '% dari kalori'} (acuan umum: di bawah ±10%).</li>
      <li>Gula: ${fmt(c.sugar, 0)} g (acuan umum gula tambahan: ≤ ±50 g/hari). Termasuk gula alami buah/susu.</li>
      <li>Serat: ${fmt(c.fiber, 0)} g (acuan umum ±25–30 g/hari). Natrium: ${fmt(c.na, 0)} mg (acuan umum ≤ 2.000 mg/hari).</li></ul>
      <p class="hint">Perhatikan gula tambahan, karbohidrat olahan, lemak jenuh, serat, dan kualitas protein. Ini pola umum, bukan saran medis; diskusikan target dengan dokter/ahli gizi.</p>
      <div class="row gap wrap"><button class="btn" data-manage>Menu &amp; Favorit</button><a class="btn" href="#/ai?type=food_analysis&date=${date}">Analisis makanan dengan AI</a></div></div>
    </div>`;
  };

  const itemRow = (i) => {
    const pending = i.status === 'pending';
    const tags = [i.estimated ? '<span class="tag">estimasi</span>' : '', i.confidence ? `<span class="tag ${i.confidence === 'rendah' ? 'low' : ''}">keyakinan ${i.confidence}</span>` : '', pending ? '<span class="tag pend">pending</span>' : ''].join('');
    return `<li data-id="${i.id}">
      ${i.photo ? `<img class="thumb" src="${i.photo}" alt="Foto ${esc(i.name)}">` : ''}
      <div class="grow"><b>${esc(i.name)}</b>
        <small>${i.amount ? `${fmt(i.amount)} ${esc(i.unit || '')}` : ''}${i.grams ? ` · ~${fmt(i.grams, 0)} g` : ''}${i.price ? ` · ${rp(i.price)}` : ''}${i.vendor ? ` · ${esc(i.vendor)}` : ''}</small>
        <div>${tags}</div>
        ${pending ? `<small class="warnbg">${Number.isFinite(i.kcalMin) ? `Rentang perkiraan ${fmt(i.kcalMin, 0)}–${fmt(i.kcalMax, 0)} kkal (belum dihitung)` : 'Kalori belum diketahui (estimasi belum cukup)'}</small>` : ''}
        ${i.assumptions?.length ? `<details><summary>Asumsi</summary><ul class="plain">${i.assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></details>` : ''}
      </div>
      <div class="right"><b>${pending ? '⏳' : kkal(i.kcal)}</b>
        <div class="row gap wrap end">${pending ? '<button class="btn small primary" data-approve>Setujui</button><button class="btn small" data-askai>AI</button>' : ''}<button class="btn small" data-fav aria-label="Simpan ke favorit">★</button>${i.menuId && !pending ? '<button class="btn small" data-tomenu title="Simpan estimasi ke menu">↻ Menu</button>' : ''}<button class="btn small" data-edit>Edit</button><button class="btn small danger" data-del>Hapus</button></div></div></li>`;
  };

  el.onclick = null;
  el.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.d) { date = addDays(date, Number(t.dataset.d)); draw(); return; }
    if (t.dataset.add) { openAdd(t.dataset.add, draw); return; }
    if (t.dataset.savemeal) { saveMealAsMenu(date, t.dataset.savemeal); return; }
    if (t.hasAttribute('data-manage')) { openManager(draw); return; }
    const li = t.closest('li[data-id]');
    if (!li) return;
    const item = await db.get('food_log_items', li.dataset.id);
    if (!item) return;
    if (t.hasAttribute('data-del')) { if (await confirmDialog(`Hapus "${item.name}"?`, { okText: 'Hapus', danger: true })) { await db.del('food_log_items', item.id); toast('Item dihapus'); draw(); } }
    else if (t.hasAttribute('data-edit')) editItem(item, draw);
    else if (t.hasAttribute('data-approve')) approveItem(item, draw);
    else if (t.hasAttribute('data-fav')) { await saveItemAsFavorite(item); }
    else if (t.hasAttribute('data-tomenu')) { await saveItemToMenu(item); }
    else if (t.hasAttribute('data-askai')) ctx.navigate(`#/ai?type=food_rupiah&item=${item.id}`);
  });
  el.addEventListener('change', (e) => { if (e.target.id === 'fdate' && e.target.value) { date = e.target.value; draw(); } });
  await draw();
}

// ---------- util ----------
const addItem = addFoodItem;
const zeroN = () => Object.fromEntries(NUTR_KEYS.map((k) => [k, 0]));
const numOrNull = (v) => { const n = parseNum(v); return Number.isFinite(n) ? n : null; };

// ---------- Tambah makanan ----------
async function openAdd(meal, done) {
  const foods = await allFoods();
  const m = modal(`Tambah — ${MEAL_LABEL[meal]}`, '<div id="addbody"></div>', { wide: true });
  const body = m.el.querySelector('#addbody');
  let tab = 'cepat', cat = 'all', q = '', photo = null;
  const sel = { food: null };

  const freq = await (async () => {
    const recent = await db.range('food_log_items', addDays(date, -60), date);
    const cnt = {};
    for (const i of recent) if (i.foodId) cnt[i.foodId] = (cnt[i.foodId] || 0) + 1;
    return cnt;
  })();
  const vendors = await db.all('food_vendor_profiles');

  const tabs = () => `<div class="seg">${[['cepat', '⚡ Cepat'], ['cari', 'Cari'], ['rupiah', 'Rupiah'], ['manual', 'Manual']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>`;
  const photoField = `<label class="field"><span>Foto makanan (opsional)</span><input type="file" accept="image/*" capture="environment" id="photo"></label><div id="photoprev"></div>`;
  const bindPhoto = () => {
    const inp = body.querySelector('#photo');
    if (!inp) return;
    inp.onchange = async () => { if (!inp.files[0]) return; try { photo = await resizeImage(inp.files[0]); body.querySelector('#photoprev').innerHTML = `<img class="thumb big" src="${photo}" alt="Pratinjau foto">`; } catch (err) { toast(err.message, 'err'); } };
  };

  const draw = () => {
    body.innerHTML = tabs() + `<div id="pane"></div>`;
    ({ cepat: paneCepat, cari: paneCari, rupiah: paneRupiah, manual: paneManual })[tab]();
  };

  // --- Cepat (favorit, riwayat, menu restoran) ---
  function paneCepat() { renderQuick(body.querySelector('#pane'), { date, meal, onAdded: done }); }

  // --- Cari ---
  function paneCari() {
    const pane = body.querySelector('#pane');
    if (sel.food) return paneAmount(pane);
    const favs = new Set(state.settings.favorites);
    let list = foods.filter((f) => {
      if (cat === 'fav') return favs.has(f.id);
      if (cat === 'freq') return freq[f.id];
      if (cat === 'custom') return f.custom;
      if (cat !== 'all' && f.cat !== cat) return false;
      return true;
    });
    if (q) list = list.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
    if (cat === 'freq') list.sort((a, b) => freq[b.id] - freq[a.id]);
    else list.sort((a, b) => (favs.has(b.id) - favs.has(a.id)) || a.name.localeCompare(b.name));
    pane.innerHTML = `<input type="search" id="q" placeholder="Cari makanan…" value="${esc(q)}" autocomplete="off">
      <div class="chips">${[['all', 'Semua'], ['fav', '★ Favorit'], ['freq', 'Sering'], ['custom', 'Custom'], ...Object.entries(CATEGORIES)].map(([k, l]) => `<button class="chip ${cat === k ? 'on' : ''}" data-cat="${k}">${l}</button>`).join('')}</div>
      <ul class="results">${list.slice(0, 60).map((f) => `<li><button class="pick" data-food="${f.id}"><b>${esc(f.name)}</b><small>${f.kcal} kkal/100${f.cat === 'minuman' ? 'ml' : 'g'}${f.estimate ? ' · estimasi' : ''}${f.custom ? ' · custom' : ''}</small></button><button class="star" data-fav="${f.id}" aria-label="Favorit">${favs.has(f.id) ? '★' : '☆'}</button></li>`).join('') || '<li class="empty">Tidak ditemukan. Gunakan tab Manual untuk menambah makanan sendiri.</li>'}</ul>`;
    const inp = pane.querySelector('#q');
    inp.oninput = () => { q = inp.value; const pos = inp.selectionStart; paneCari(); const n = body.querySelector('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  }

  function paneAmount(pane, existing) {
    const f = sel.food;
    const defUnit = f.cat === 'minuman' ? 'gelas' : f.u?.porsi ? 'porsi' : Object.keys(f.u || {})[0] || 'gram';
    pane.innerHTML = `<form class="stack" id="amtform"><div class="row between"><b>${esc(f.name)}</b><button type="button" class="btn small" id="back">Ganti</button></div>
      <div class="grid2"><label class="field"><span>Jumlah</span><input name="amount" inputmode="decimal" value="1" required></label>
      <label class="field"><span>Satuan</span><select name="unit">${UNITS.map((u) => `<option value="${u}" ${u === defUnit ? 'selected' : ''}>${u}${unitIsSpecific(f, u) ? '' : ' (umum)'}</option>`).join('')}</select></label></div>
      <div class="card inner" id="preview"></div>
      <label class="field"><span>Catatan</span><input name="note"></label>${photoField}
      <button class="btn primary block" type="submit">Simpan</button></form>`;
    const form = pane.querySelector('form');
    const calc = () => {
      const amount = parseNum(form.amount.value), unit = form.unit.value;
      const g = amount * unitGrams(f, unit);
      const n = nutrientsFor(f, g);
      pane.querySelector('#preview').innerHTML = Number.isFinite(g) && g > 0 ? `<b>${kkal(n.kcal)}</b> · ~${fmt(g, 0)} ${f.cat === 'minuman' ? 'ml' : 'g'}<br><small>1 ${unit} ≈ ${fmt(unitGrams(f, unit))} g${unitIsSpecific(f, unit) ? '' : ' (angka umum, bisa berbeda)'} · P ${fmt(n.p)} g · K ${fmt(n.c)} g · L ${fmt(n.f)} g</small>${f.estimate ? '<br><small>Nilai gizi adalah estimasi.</small>' : ''}` : '<small>Masukkan jumlah.</small>';
      return { amount, unit, g, n };
    };
    form.oninput = calc; calc();
    pane.querySelector('#back').onclick = () => { sel.food = null; draw(); };
    bindPhoto();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const { amount, unit, g, n } = calc();
      if (!(amount > 0) || !(g > 0)) { toast('Jumlah tidak valid', 'err'); return; }
      const specific = unitIsSpecific(f, unit);
      await addItem(date, meal, { name: f.name, foodId: f.id, amount, unit, grams: round(g, 1), ...n, status: 'confirmed', estimated: !!f.estimate || !specific, confidence: specific ? 'sedang' : 'rendah', basis: 'database', note: form.note.value.trim() || undefined, photo: photo || undefined });
      toast('Tersimpan', 'ok'); m.close(); done();
    };
  }

  // --- Rupiah ---
  function paneRupiah() {
    const pane = body.querySelector('#pane');
    pane.innerHTML = `<form class="stack" id="rpform" autocomplete="off">
      <p class="hint">Harga bukan berat. Jika berat/jumlah tidak diketahui, hasil berupa <b>rentang berstatus pending</b> dan tidak dihitung sebagai kalori pasti sampai Anda menyetujuinya.</p>
      <label class="field"><span>Nama makanan *</span><input name="name" list="foodlist" required placeholder="mis. pentol"><datalist id="foodlist">${foods.map((f) => `<option value="${esc(f.name)}">`).join('')}</datalist></label>
      <div class="grid2"><label class="field"><span>Nominal (Rp) *</span><input name="price" inputmode="numeric" required placeholder="10.000"></label>
      <label class="field"><span>Penjual (jika tahu)</span><input name="vendor" list="vendorlist"><datalist id="vendorlist">${vendors.map((v) => `<option value="${esc(v.name)}">`).join('')}</datalist></label></div>
      <div class="grid3"><label class="field"><span>Jumlah (jika tahu)</span><input name="qty" inputmode="decimal"></label>
      <label class="field"><span>Satuan</span><select name="unit">${UNITS.filter((u) => u !== 'gram' && u !== 'mililiter').map((u) => `<option>${u}</option>`).join('')}</select></label>
      <label class="field"><span>Berat (g, jika tahu)</span><input name="grams" inputmode="decimal"></label></div>
      <label class="field"><span>Kalori manual (jika tahu dari label)</span><input name="kcal" inputmode="decimal"></label>
      <label class="field"><span>Catatan</span><input name="note"></label>
      <div id="prev" class="card inner"></div><div id="prevpurch"></div>${photoField}
      <button class="btn primary block" type="submit">Simpan</button></form>`;
    const form = pane.querySelector('form');
    const findFood = (name) => { const n = name.trim().toLowerCase(); return foods.find((f) => f.name.toLowerCase() === n) || foods.find((f) => f.name.toLowerCase().startsWith(n) && n.length >= 3) || null; };
    const read = () => ({ name: form.name.value.trim(), price: parseRupiah(form.price.value), qty: numOrNull(form.qty.value), unit: form.unit.value, grams: numOrNull(form.grams.value), kcal: numOrNull(form.kcal.value), vendor: form.vendor.value.trim() });
    const calc = () => {
      const r = read(); const food = findFood(r.name);
      const est = r.kcal != null ? null : rupiahEstimate(food, r.price, { qty: r.qty, unit: r.unit, grams: r.grams });
      let html;
      if (r.kcal != null) html = `<b>${kkal(r.kcal)}</b> <span class="tag">dari input Anda</span>`;
      else if (est.status === 'confirmed') html = `<b>${kkal(est.kcal.best)}</b> <span class="tag">estimasi</span> <span class="tag">keyakinan ${est.confidence}</span><br><small>${est.assumptions.map(esc).join('<br>')}</small>`;
      else if (est.kcal) html = `<span class="tag pend">pending</span> Perkiraan <b>${fmt(est.kcal.min, 0)}–${fmt(est.kcal.max, 0)} kkal</b> (≈ ${fmt(est.grams.min, 0)}–${fmt(est.grams.max, 0)} g). Keyakinan <b>rendah</b>.<br><small>${est.assumptions.map(esc).join('<br>')}</small>`;
      else html = `<span class="tag pend">pending</span> Estimasi belum cukup. <small>${est.assumptions.map(esc).join(' ')}</small>`;
      pane.querySelector('#prev').innerHTML = html + (food ? `<br><small>Data acuan: ${esc(food.name)}</small>` : r.name ? '<br><small>Makanan tidak ada di database.</small>' : '');
      const pur = vendors.find((v) => r.vendor && v.name.toLowerCase() === r.vendor.toLowerCase())?.purchases?.filter((p) => r.name && p.food.toLowerCase() === r.name.toLowerCase()) || [];
      pane.querySelector('#prevpurch').innerHTML = pur.length ? `<div class="card inner"><b>Pembelian sebelumnya dari penjual ini</b><small> (nominal sama belum tentu ukuran sama)</small>${pur.slice(-3).map((p, i) => `<div class="row between"><small>${rp(p.price)} → ${p.grams ? fmt(p.grams, 0) + ' g' : p.qty ? p.qty + ' ' + p.unit : 'tanpa ukuran'}${p.kcal ? ` · ${fmt(p.kcal, 0)} kkal` : ''}</small><button type="button" class="btn small" data-use="${i}">Pakai</button></div>`).join('')}</div>` : '';
      pane.querySelectorAll('[data-use]').forEach((b) => { b.onclick = () => { const p = pur.slice(-3)[b.dataset.use]; if (p.grams) form.grams.value = p.grams; if (p.qty) { form.qty.value = p.qty; form.unit.value = p.unit; } calc(); }; });
    };
    form.oninput = calc; calc(); bindPhoto();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const r = read();
      if (!r.name || !(r.price > 0)) { toast('Isi nama dan nominal', 'err'); return; }
      const food = findFood(r.name);
      const base = { name: r.name, foodId: food?.id, price: r.price, vendor: r.vendor || undefined, note: form.note.value.trim() || undefined, photo: photo || undefined };
      let rec;
      if (r.kcal != null) {
        rec = { ...zeroN(), kcal: r.kcal, status: 'confirmed', estimated: false, confidence: 'sedang', basis: 'manual', grams: r.grams ?? undefined, amount: r.qty ?? undefined, unit: r.qty ? r.unit : undefined };
      } else {
        const est = rupiahEstimate(food, r.price, { qty: r.qty, unit: r.unit, grams: r.grams });
        if (est.status === 'confirmed') rec = { ...est.nutrients, status: 'confirmed', estimated: true, confidence: est.confidence, basis: est.basis, grams: est.grams.best, amount: r.qty ?? undefined, unit: r.qty ? r.unit : undefined, assumptions: est.assumptions };
        else rec = { ...zeroN(), status: 'pending', estimated: true, confidence: 'rendah', basis: est.basis, assumptions: est.assumptions, kcalMin: est.kcal?.min, kcalMax: est.kcal?.max, est: est.kcal ? { grams: est.grams, kcal: est.kcal, nutrients: est.nutrients } : undefined };
      }
      await addItem(date, meal, { ...base, ...rec });
      if (r.vendor) {
        const prof = vendors.find((v) => v.name.toLowerCase() === r.vendor.toLowerCase()) || { name: r.vendor, purchases: [] };
        prof.purchases = [...(prof.purchases || []), { food: r.name, price: r.price, qty: r.qty, unit: r.unit, grams: r.grams, kcal: rec.status === 'confirmed' ? rec.kcal : null, date }].slice(-30);
        await db.put('food_vendor_profiles', prof);
      }
      toast(rec.status === 'pending' ? 'Tersimpan sebagai PENDING (belum masuk total)' : 'Tersimpan', 'ok'); m.close(); done();
    };
  }

  // --- Manual / label ---
  function paneManual() {
    const pane = body.querySelector('#pane');
    const nf = (k, l) => `<label class="field"><span>${l}</span><input name="${k}" inputmode="decimal"></label>`;
    pane.innerHTML = `<form class="stack" id="mform"><p class="hint">Isi nilai per sajian seperti pada label kemasan, lalu jumlah sajian yang Anda makan.</p>
      <label class="field"><span>Nama makanan *</span><input name="name" required></label>
      <div class="grid2">${nf('kcal', 'Kalori per sajian (kkal) *')}${nf('p', 'Protein (g)')}${nf('c', 'Karbohidrat (g)')}${nf('f', 'Lemak total (g)')}${nf('sat', 'Lemak jenuh (g)')}${nf('sugar', 'Gula (g)')}${nf('fiber', 'Serat (g)')}${nf('na', 'Natrium (mg)')}</div>
      <div class="grid2">${nf('servings', 'Jumlah sajian dimakan')}${nf('servingGrams', 'Berat 1 sajian (g/ml, opsional)')}</div>
      <label class="check"><input type="checkbox" name="saveCustom"> Simpan sebagai makanan custom (butuh berat 1 sajian)</label>
      <label class="check"><input type="checkbox" name="fav"> Tandai favorit</label>
      <label class="field"><span>Catatan</span><input name="note"></label>${photoField}
      <button class="btn primary block" type="submit">Simpan</button></form>`;
    bindPhoto();
    pane.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const v = (k) => numOrNull(f[k].value) ?? 0;
      const kc = numOrNull(f.kcal.value);
      const sv = numOrNull(f.servings.value) ?? 1, sg = numOrNull(f.servingGrams.value);
      if (kc == null || kc < 0 || kc > 5000) { toast('Kalori tidak valid', 'err'); return; }
      const per = { kcal: kc, p: v('p'), c: v('c'), f: v('f'), sat: v('sat'), sugar: v('sugar'), fiber: v('fiber'), na: v('na') };
      const tot = Object.fromEntries(NUTR_KEYS.map((k) => [k, round(per[k] * sv, 2)]));
      let foodId;
      if (f.saveCustom.checked) {
        if (!(sg > 0)) { toast('Isi berat 1 sajian untuk menyimpan custom food', 'err'); return; }
        const k100 = 100 / sg;
        const cf = await db.put('custom_foods', { id: uid('cf_'), name: f.name.value.trim(), cat: 'jajanan', ...Object.fromEntries(NUTR_KEYS.map((k) => [k, round(per[k] * k100, 2)])), u: { porsi: sg }, source: 'Label kemasan / input pengguna', estimate: false });
        foodId = cf.id;
        if (f.fav.checked) await saveSettings({ favorites: [...new Set([...state.settings.favorites, cf.id])] });
      }
      await addItem(date, meal, { name: f.name.value.trim(), foodId, amount: sv, unit: 'porsi', grams: sg ? round(sg * sv, 1) : undefined, ...tot, status: 'confirmed', estimated: false, confidence: 'sedang', basis: 'manual', note: f.note.value.trim() || undefined, photo: photo || undefined });
      toast('Tersimpan', 'ok'); m.close(); done();
    };
  }

  body.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tab) { tab = b.dataset.tab; sel.food = null; draw(); }
    else if (b.dataset.cat) { cat = b.dataset.cat; paneCari(); }
    else if (b.dataset.food) { sel.food = foods.find((f) => f.id === b.dataset.food); paneCari(); }
    else if (b.dataset.fav) {
      const fav = new Set(state.settings.favorites);
      fav.has(b.dataset.fav) ? fav.delete(b.dataset.fav) : fav.add(b.dataset.fav);
      await saveSettings({ favorites: [...fav] }); paneCari();
    }
  });
  draw();
}

// ---------- Edit ----------
function editItem(item, done) {
  const fields = NUTR_KEYS.map((k) => `<label class="field"><span>${NUTR_LABEL[k]} (${NUTR_UNIT[k]})</span><input name="${k}" inputmode="decimal" value="${item[k] ?? 0}"></label>`).join('');
  const m = modal('Edit item', `<form class="stack"><label class="field"><span>Nama</span><input name="name" value="${esc(item.name)}" required></label>
    <div class="grid3"><label class="field"><span>Jumlah</span><input name="amount" inputmode="decimal" value="${item.amount ?? ''}"></label>
    <label class="field"><span>Satuan</span><select name="unit"><option value=""></option>${UNITS.map((u) => `<option ${u === item.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
    <label class="field"><span>Berat (g)</span><input name="grams" inputmode="decimal" value="${item.grams ?? ''}"></label></div>
    ${item.foodId ? '<button type="button" class="btn small" id="recalc">Hitung ulang dari database</button>' : ''}
    <div class="grid2">${fields}</div>
    <div class="grid2"><label class="field"><span>Status</span><select name="status"><option value="confirmed" ${item.status !== 'pending' ? 'selected' : ''}>Terkonfirmasi</option><option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option></select></label>
    <label class="field"><span>Keyakinan</span><select name="confidence">${['', 'rendah', 'sedang', 'tinggi'].map((c) => `<option ${c === (item.confidence || '') ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
    <label class="field"><span>Catatan</span><input name="note" value="${esc(item.note || '')}"></label>
    <button class="btn primary block">Simpan</button></form>`);
  const form = m.el.querySelector('form');
  const rc = m.el.querySelector('#recalc');
  if (rc) rc.onclick = async () => {
    const f = await getFood(item.foodId);
    if (!f) { toast('Data makanan tidak ditemukan', 'err'); return; }
    let g = parseNum(form.grams.value);
    const a = parseNum(form.amount.value);
    if (a > 0 && form.unit.value) g = a * unitGrams(f, form.unit.value);
    if (!(g > 0)) { toast('Isi jumlah+satuan atau berat', 'err'); return; }
    form.grams.value = round(g, 1);
    const n = nutrientsFor(f, g);
    for (const k of NUTR_KEYS) form[k].value = n[k];
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const upd = { ...item, name: form.name.value.trim(), amount: numOrNull(form.amount.value) ?? undefined, unit: form.unit.value || undefined, grams: numOrNull(form.grams.value) ?? undefined, status: form.status.value, confidence: form.confidence.value || undefined, note: form.note.value.trim() || undefined, estimated: item.estimated || true };
    for (const k of NUTR_KEYS) upd[k] = numOrNull(form[k].value) ?? 0;
    if (upd.status === 'confirmed' && upd.kcal < 0) { toast('Kalori tidak boleh negatif', 'err'); return; }
    await db.put('food_log_items', upd);
    toast('Diperbarui', 'ok'); m.close(); done();
  };
}

// ---------- Setujui pending ----------
function approveItem(item, done) {
  const est = item.est;
  const opts = est ? [['min', 'Bawah', est.kcal.min], ['best', 'Tengah', est.kcal.best], ['max', 'Atas', est.kcal.max]] : [];
  const m = modal(`Setujui: ${item.name}`, `<form class="stack"><p>Pilih nilai yang menurut Anda paling mendekati. Setelah disetujui, item masuk total sebagai <b>estimasi keyakinan rendah</b>.</p>
    ${opts.map(([k, l, v], i) => `<label class="check"><input type="radio" name="opt" value="${k}" ${i === 1 ? 'checked' : ''}> ${l}: ${fmt(v, 0)} kkal</label>`).join('')}
    <label class="check"><input type="radio" name="opt" value="manual" ${est ? '' : 'checked'}> Isi sendiri: <input name="manual" inputmode="decimal" style="width:6rem"> kkal</label>
    <button class="btn primary block">Setujui & hitung</button></form>`);
  m.el.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, opt = f.opt.value;
    let kcal, nut = zeroN();
    if (opt === 'manual') { kcal = numOrNull(f.manual.value); if (kcal == null || kcal < 0 || kcal > 5000) { toast('Isi kalori yang valid', 'err'); return; } if (est) { const r = kcal / (est.kcal.best || 1); for (const k of NUTR_KEYS) nut[k] = round(est.nutrients[k] * r, 2); } }
    else { kcal = est.kcal[opt]; const r = kcal / (est.kcal.best || 1); for (const k of NUTR_KEYS) nut[k] = round(est.nutrients[k] * r, 2); }
    nut.kcal = kcal;
    await db.put('food_log_items', { ...item, ...nut, status: 'confirmed', estimated: true, confidence: 'rendah', approvedAt: Date.now(), grams: est ? est.grams[opt === 'manual' ? 'best' : opt] : item.grams });
    toast('Disetujui — masuk total', 'ok'); m.close(); done();
  };
}
