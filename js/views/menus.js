// UI Menu Favorit, Riwayat Makanan, Menu Restoran + Quick Add. Semua data di IndexedDB (store food_menus + food_log_items).
import { esc, fmt, kkal, todayStr, addDays, parseNum, round, uid } from '../util.js';
import { db } from '../db.js';
import { addFoodItem, allFoods } from '../store.js';
import { UNITS, NUTR_KEYS, NUTR_LABEL, NUTR_UNIT, nutrientsFor, unitGrams } from '../calc.js';
import { MEAL_LABEL } from '../data/foods.js';
import { scaleN, compFromItem, itemFromComp, menuTotals, historyFromItems, matchQuery, categorize, newMenu, describeUnknown } from '../menus.js';
import { modal, toast, confirmDialog } from '../ui.js';

const CATS = [['favorit', '★ Menu Favorit'], ['riwayat', 'Riwayat Makanan'], ['restoran', 'Menu Restoran'], ['semua', 'Semua']];
const numOrNull = (v) => { const n = parseNum(v); return Number.isFinite(n) ? n : null; };

const summary = (e) => {
  const t = menuTotals(e);
  if (t.status === 'lengkap') return `<b>${kkal(t.total.kcal)}</b> ${t.estimated ? '<span class="tag">estimasi</span>' : ''}`;
  if (t.status === 'sebagian') return `<b>≥ ${kkal(t.total.kcal)}</b> <span class="tag pend">${t.unknown} komponen belum pasti</span>`;
  return '<span class="tag pend">belum ada estimasi</span>';
};
const compsLine = (e) => esc(e.comps.map((c) => `${c.amount != null ? fmt(c.amount) + ' ' + c.unit + ' ' : ''}${c.name}`).join(' · '));

// ---------------------------------------------------------------- Tab "Cepat" (Quick Add)
export async function renderQuick(pane, { date, meal, onAdded }) {
  let cat = 'favorit', q = '';
  const load = async () => {
    const menus = (await db.all('food_menus')).sort((a, b) => (b.lastUsed || '').localeCompare(a.lastUsed || '') || b.uses - a.uses);
    const recent = await db.range('food_log_items', addDays(todayStr(), -365), todayStr());
    return { menus, history: historyFromItems(recent) };
  };
  let data = await load();
  if (!data.menus.some((m) => m.favorite)) cat = data.history.length ? 'riwayat' : 'favorit';

  const draw = () => {
    const list = categorize(data.menus, data.history, cat).filter((e) => matchQuery(e, q));
    pane.innerHTML = `<input type="search" id="mq" placeholder="Cari nama makanan atau restoran…" value="${esc(q)}" autocomplete="off">
      <div class="chips">${CATS.map(([k, l]) => `<button class="chip ${cat === k ? 'on' : ''}" data-mcat="${k}">${l}</button>`).join('')}</div>
      <div class="row gap wrap"><button class="btn small" data-newmenu>+ Menu/paket baru</button><button class="btn small" data-manage>Kelola menu</button></div>
      <ul class="results">${list.slice(0, 80).map((e) => `<li class="qa" data-eid="${esc(e.id)}"><div class="grow"><b>${esc(e.name)}</b>${e.restaurant ? ` <span class="tag">${esc(e.restaurant)}</span>` : ''}${e.comps.length > 1 ? ` <span class="tag">${e.comps.length} komponen</span>` : ''}<small>${compsLine(e)}</small><div>${summary(e)}${e.uses ? `<small>dipakai ${e.uses}×${e.lastUsed ? ' · terakhir ' + e.lastUsed : ''}</small>` : ''}</div></div>
        <div class="col"><button class="btn small primary" data-qadd>+ Tambah</button><button class="btn small" data-port>Porsi…</button>${e.history ? '' : ''}</div></li>`).join('') || `<li class="empty">${cat === 'riwayat' ? 'Belum ada riwayat. Makanan yang Anda catat otomatis muncul di sini.' : cat === 'favorit' ? 'Belum ada menu favorit. Tekan ★ pada item di jurnal, atau buat menu baru.' : 'Tidak ada yang cocok.'}</li>`}</ul>
      <p class="hint">Satu ketukan “+ Tambah” memasukkan makanan ke jurnal tanpa analisis ulang. Komponen yang belum pasti masuk sebagai <b>pending</b>, bukan angka pasti.</p>`;
    const inp = pane.querySelector('#mq');
    inp.oninput = () => { q = inp.value; const pos = inp.selectionStart; draw(); const n = pane.querySelector('#mq'); n.focus(); n.setSelectionRange(pos, pos); };
  };
  const find = (id) => [...data.menus, ...data.history].find((e) => e.id === id);

  pane.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mcat) { cat = b.dataset.mcat; draw(); return; }
    if (b.hasAttribute('data-newmenu')) { openEditor(newMenu(), async () => { data = await load(); draw(); }); return; }
    if (b.hasAttribute('data-manage')) { openManager(async () => { data = await load(); draw(); onAdded?.(); }); return; }
    const li = b.closest('[data-eid]');
    const entry = li && find(li.dataset.eid);
    if (!entry) return;
    if (b.hasAttribute('data-qadd')) { await addEntry(entry, date, meal, {}); onAdded?.(); data = await load(); draw(); }
    else if (b.hasAttribute('data-port')) openPortion(entry, date, meal, async () => { onAdded?.(); data = await load(); draw(); });
  };
  draw();
}

/** Masukkan menu/riwayat ke jurnal. factors: { all?, [compId]: faktor, skip?: Set }. */
async function addEntry(entry, date, meal, factors) {
  let n = 0, pending = 0;
  for (const c of entry.comps) {
    if (factors.skip?.has(c.id)) continue;
    const f = factors[c.id] ?? factors.all ?? 1;
    const item = itemFromComp(c, f, { vendor: entry.restaurant || undefined, ...(entry.history ? {} : { menuId: entry.id, compId: c.id }) });
    await addFoodItem(date, meal, item);
    n++; if (item.status === 'pending') pending++;
  }
  if (!entry.history) await db.put('food_menus', { ...(await db.get('food_menus', entry.id)), uses: (entry.uses || 0) + 1, lastUsed: todayStr() });
  toast(`Ditambahkan: ${entry.name} (${n} item${pending ? `, ${pending} belum pasti → pending` : ''})`, pending ? '' : 'ok');
}

function openPortion(entry, date, meal, done) {
  const m = modal(`Atur porsi — ${entry.name}`, `<form class="stack"><div class="row gap wrap"><span>Pengali porsi:</span>${[0.5, 1, 1.5, 2].map((x) => `<button type="button" class="chip" data-mult="${x}">${x}×</button>`).join('')}<input name="mult" inputmode="decimal" value="1" style="width:5rem"></div>
    <ul class="items">${entry.comps.map((c) => `<li data-cid="${c.id}"><label class="check"><input type="checkbox" data-inc checked></label><div class="grow"><b>${esc(c.name)}</b><small>${c.status === 'confirmed' ? kkal(c.n.kcal) + ' per ' + fmt(c.amount) + ' ' + c.unit + (c.estimated !== false ? ' · estimasi' : '') : 'belum pasti'}</small></div><input class="num" inputmode="decimal" data-amt value="${c.amount ?? 1}" aria-label="Jumlah ${esc(c.name)}"><small>${esc(c.unit)}</small></li>`).join('')}</ul>
    <div class="card inner" id="pv"></div><button class="btn primary block">Tambahkan ke ${MEAL_LABEL[meal]}</button></form>`);
  const form = m.el.querySelector('form');
  const factors = () => {
    const mult = numOrNull(form.mult.value) ?? 1, f = { skip: new Set() };
    for (const li of form.querySelectorAll('[data-cid]')) {
      const c = entry.comps.find((x) => x.id === li.dataset.cid), amt = numOrNull(li.querySelector('[data-amt]').value);
      if (!li.querySelector('[data-inc]').checked) f.skip.add(c.id);
      f[c.id] = (c.amount > 0 && amt != null ? amt / c.amount : 1) * mult;
    }
    return f;
  };
  const upd = () => { const t = menuTotals(entry, factors()); m.el.querySelector('#pv').innerHTML = `Perkiraan total: ${t.status === 'belum' ? '<span class="tag pend">belum ada estimasi</span>' : `<b>${t.status === 'sebagian' ? '≥ ' : ''}${kkal(t.total.kcal)}</b>`}${t.unknown ? `<br><small>${t.unknown} komponen belum pasti — masuk sebagai pending.</small>` : ''}<br><small>Nilai dihitung ulang proporsional dari jumlah.</small>`; };
  form.oninput = upd;
  form.addEventListener('click', (e) => { const b = e.target.closest('[data-mult]'); if (b) { form.mult.value = b.dataset.mult; upd(); } });
  upd();
  form.onsubmit = async (e) => { e.preventDefault(); const f = factors(); if (f.skip.size === entry.comps.length) { toast('Pilih minimal satu komponen', 'err'); return; } await addEntry(entry, date, meal, f); m.close(); done(); };
}

// ---------------------------------------------------------------- Simpan dari jurnal
export async function saveItemAsFavorite(item) {
  const menus = await db.all('food_menus');
  const key = (s) => String(s || '').trim().toLowerCase();
  const ex = menus.find((m) => m.comps.length === 1 && key(m.name) === key(item.name) && key(m.restaurant) === key(item.vendor));
  if (ex) {
    await db.put('food_menus', { ...ex, favorite: !ex.favorite });
    toast(ex.favorite ? 'Dihapus dari favorit' : '★ Ditambahkan ke Menu Favorit', 'ok');
    return;
  }
  await db.put('food_menus', newMenu({ name: item.name, restaurant: item.vendor || '', comps: [{ ...compFromItem(item), id: uid('c_') }] }));
  toast(item.status === 'pending' ? '★ Disimpan (estimasi belum pasti)' : '★ Disimpan ke Menu Favorit', 'ok');
}

/** Perbarui komponen menu dari item jurnal yang sudah dikonfirmasi/diubah, agar dipakai pada penambahan berikutnya. */
export async function saveItemToMenu(item) {
  const menu = item.menuId && (await db.get('food_menus', item.menuId));
  if (!menu) { toast('Menu asal tidak ditemukan (mungkin sudah dihapus)', 'err'); return false; }
  if (item.status === 'pending') { toast('Setujui/isi kalori item terlebih dahulu', 'err'); return false; }
  const i = menu.comps.findIndex((c) => c.id === item.compId);
  if (i < 0) { toast('Komponen tidak ditemukan di menu', 'err'); return false; }
  const old = menu.comps[i];
  menu.comps[i] = { ...old, amount: item.amount ?? old.amount, unit: item.unit || old.unit, grams: item.grams ?? old.grams, status: 'confirmed', n: Object.fromEntries(NUTR_KEYS.map((k) => [k, Number(item[k]) || 0])), estimated: item.estimated !== false, confidence: item.confidence, basis: item.basis === 'menu' ? old.basis : item.basis, range: undefined, assumptions: item.assumptions };
  await db.put('food_menus', menu);
  toast(`Estimasi disimpan ke menu “${menu.name}”`, 'ok');
  return true;
}

export async function saveMealAsMenu(date, meal, done) {
  const items = (await db.byDate('food_log_items', date)).filter((i) => i.meal === meal);
  if (!items.length) { toast('Belum ada item pada waktu makan ini', 'err'); return; }
  const m = modal('Simpan sebagai menu/paket', `<form class="stack"><label class="field"><span>Nama menu *</span><input name="name" required value="${esc(MEAL_LABEL[meal])} favorit" placeholder="mis. KFC Super Besar 2"></label>
    <label class="field"><span>Nama restoran (opsional)</span><input name="restaurant" placeholder="mis. KFC"></label>
    <label class="check"><input type="checkbox" name="fav" checked> Tandai sebagai Menu Favorit</label>
    <div class="field"><span>Komponen yang disimpan</span>${items.map((i) => `<label class="check"><input type="checkbox" data-i="${i.id}" checked> ${esc(i.name)} <small>${i.status === 'pending' ? 'belum pasti' : kkal(i.kcal)}</small></label>`).join('')}</div>
    <button class="btn primary block">Simpan menu</button></form>`);
  m.el.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, ids = [...f.querySelectorAll('[data-i]:checked')].map((x) => x.dataset.i);
    if (!ids.length) { toast('Pilih minimal satu komponen', 'err'); return; }
    await db.put('food_menus', newMenu({ name: f.name.value.trim(), restaurant: f.restaurant.value.trim(), favorite: f.fav.checked, comps: items.filter((i) => ids.includes(i.id)).map(compFromItem) }));
    toast('Menu tersimpan', 'ok'); m.close(); done?.();
  };
}

// ---------------------------------------------------------------- Kelola menu
export async function openManager(onChange) {
  let cat = 'semua', q = '';
  const m = modal('Kelola menu', '<div id="mgr"></div>', { wide: true, onClose: onChange });
  const body = m.el.querySelector('#mgr');
  const draw = async () => {
    const menus = (await db.all('food_menus')).sort((a, b) => a.name.localeCompare(b.name));
    const list = categorize(menus, [], cat === 'semua' ? 'semua' : cat).filter((e) => matchQuery(e, q));
    body.innerHTML = `<input type="search" id="gq" placeholder="Cari menu atau restoran…" value="${esc(q)}"><div class="chips">${[['semua', 'Semua'], ['favorit', '★ Favorit'], ['restoran', 'Restoran']].map(([k, l]) => `<button class="chip ${cat === k ? 'on' : ''}" data-gcat="${k}">${l}</button>`).join('')}</div>
      <button class="btn primary small" data-new>+ Menu baru</button>
      <ul class="items">${list.map((e) => `<li data-mid="${e.id}"><div class="grow"><b>${esc(e.name)}</b>${e.restaurant ? ` <span class="tag">${esc(e.restaurant)}</span>` : ''}<small>${compsLine(e)}</small>${summary(e)}</div><div class="col"><button class="btn small" data-fav>${e.favorite ? '★' : '☆'}</button><button class="btn small" data-edit>Ubah</button><button class="btn small danger" data-del>Hapus</button></div></li>`).join('') || '<li class="empty">Belum ada menu.</li>'}</ul>`;
    const inp = body.querySelector('#gq');
    inp.oninput = () => { q = inp.value; const p = inp.selectionStart; draw().then(() => { const n = body.querySelector('#gq'); n.focus(); n.setSelectionRange(p, p); }); };
  };
  body.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.gcat) { cat = b.dataset.gcat; draw(); return; }
    if (b.hasAttribute('data-new')) { openEditor(newMenu(), draw); return; }
    const li = b.closest('[data-mid]');
    if (!li) return;
    const menu = await db.get('food_menus', li.dataset.mid);
    if (b.hasAttribute('data-fav')) { await db.put('food_menus', { ...menu, favorite: !menu.favorite }); draw(); }
    else if (b.hasAttribute('data-edit')) openEditor(menu, draw);
    else if (b.hasAttribute('data-del') && (await confirmDialog(`Hapus menu “${menu.name}”? Item yang sudah ada di jurnal tidak ikut terhapus.`, { okText: 'Hapus', danger: true }))) { await db.del('food_menus', menu.id); draw(); }
  };
  draw();
}

// ---------------------------------------------------------------- Editor menu & komponen
export function openEditor(menu, onSaved) {
  const draft = structuredClone(menu);
  const m = modal(draft.id ? 'Ubah menu' : 'Menu/paket baru', '<div id="ed"></div>', { wide: true });
  const body = m.el.querySelector('#ed');
  const draw = () => {
    const t = menuTotals(draft);
    body.innerHTML = `<form class="stack" id="edform"><label class="field"><span>Nama menu *</span><input name="name" required value="${esc(draft.name)}" placeholder="mis. KFC Super Besar 2 tanpa soda"></label>
      <label class="field"><span>Nama restoran (opsional)</span><input name="restaurant" value="${esc(draft.restaurant || '')}" placeholder="mis. KFC"></label>
      <label class="check"><input type="checkbox" name="fav" ${draft.favorite ? 'checked' : ''}> Menu Favorit</label>
      <div><b>Komponen</b> <small>Hapus atau ubah komponen (mis. tanpa soda, tambah ayam). Nutrisi dihitung ulang dari jumlah.</small>
      <ul class="items">${draft.comps.map((c, i) => `<li><div class="grow"><b>${esc(c.name)}</b><small>${c.amount != null ? fmt(c.amount) + ' ' + c.unit : ''}${c.grams ? ` · ~${fmt(c.grams, 0)} g` : ''}</small>${c.status === 'confirmed' ? `<small>${kkal(c.n.kcal)} · P ${fmt(c.n.p)} K ${fmt(c.n.c)} L ${fmt(c.n.f)} ${c.estimated !== false ? '· <span class="tag">estimasi</span>' : ''}</small>` : `<span class="tag pend">belum pasti</span>${c.range ? `<small>perkiraan ${fmt(c.range.min, 0)}–${fmt(c.range.max, 0)} kkal</small>` : ''}`}</div><div class="col"><button type="button" class="btn small" data-ce="${i}">Ubah</button><button type="button" class="btn small danger" data-cd="${i}">Hapus</button></div></li>`).join('') || '<li class="empty">Belum ada komponen.</li>'}</ul>
      <button type="button" class="btn small" data-ca>+ Tambah komponen</button></div>
      <div class="card inner">Total saat ini: ${t.status === 'belum' ? '<span class="tag pend">belum ada estimasi</span>' : `<b>${t.status === 'sebagian' ? '≥ ' : ''}${kkal(t.total.kcal)}</b> · P ${fmt(t.total.p)} g · K ${fmt(t.total.c)} g · L ${fmt(t.total.f)} g`}${t.unknown ? `<br><small>${t.unknown} komponen belum pasti — total belum lengkap.</small>` : ''}</div>
      ${t.unknown ? `<a class="btn small" id="askai" href="#/ai?type=food_estimate&q=${encodeURIComponent(`${draft.restaurant ? draft.restaurant + ' — ' : ''}${draft.name}: ${describeUnknown(draft)}`)}">Minta estimasi AI (sekali saja)</a><small>Setelah jawaban diimpor, pilih komponen menu ini pada daftar “Terapkan ke”, lalu estimasi tersimpan untuk seterusnya.</small>` : ''}
      <button class="btn primary block">Simpan menu</button></form>`;
    const f = body.querySelector('#edform');
    const sync = () => { draft.name = f.name.value; draft.restaurant = f.restaurant.value.trim(); draft.favorite = f.fav.checked; };
    f.oninput = sync;
    f.onclick = async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      sync();
      if (b.hasAttribute('data-ca')) compEditor(null, (c) => { draft.comps.push(c); draw(); });
      else if (b.dataset.ce) compEditor(draft.comps[b.dataset.ce], (c) => { draft.comps[b.dataset.ce] = c; draw(); });
      else if (b.dataset.cd && (await confirmDialog(`Hapus komponen “${draft.comps[b.dataset.cd].name}” dari menu?`, { okText: 'Hapus', danger: true }))) { draft.comps.splice(b.dataset.cd, 1); draw(); }
    };
    f.onsubmit = async (e) => {
      e.preventDefault(); sync();
      if (!draft.name.trim()) { toast('Isi nama menu', 'err'); return; }
      if (!draft.comps.length) { toast('Tambahkan minimal satu komponen', 'err'); return; }
      await db.put('food_menus', { ...draft, name: draft.name.trim() });
      toast('Menu tersimpan', 'ok'); m.close(); onSaved?.();
    };
    const ai = body.querySelector('#askai');
    if (ai) ai.addEventListener('click', () => { sync(); });
  };
  draw();
}

async function compEditor(comp, onOk) {
  const foods = await allFoods();
  const c = comp || { id: uid('c_'), name: '', amount: 1, unit: 'porsi', status: 'unknown', n: null, estimated: true, confidence: 'sedang' };
  const n = c.n || {};
  const nf = (k) => `<label class="field"><span>${NUTR_LABEL[k]} (${NUTR_UNIT[k]})</span><input name="n_${k}" inputmode="decimal" value="${n[k] ?? ''}"></label>`;
  const m = modal(comp ? 'Ubah komponen' : 'Tambah komponen', `<form class="stack"><label class="field"><span>Nama komponen *</span><input name="name" list="cfoods" required value="${esc(c.name)}" placeholder="mis. ayam goreng, nasi, soda"><datalist id="cfoods">${foods.map((x) => `<option value="${esc(x.name)}">`).join('')}</datalist></label>
    <div class="grid3"><label class="field"><span>Jumlah</span><input name="amount" inputmode="decimal" value="${c.amount ?? 1}" required></label><label class="field"><span>Satuan</span><select name="unit">${UNITS.map((u) => `<option ${u === c.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label><label class="field"><span>Berat (g)</span><input name="grams" inputmode="decimal" value="${c.grams ?? ''}"></label></div>
    <button type="button" class="btn small" id="fromdb">Hitung dari database makanan</button>
    <label class="field"><span>Status nutrisi</span><select name="status"><option value="confirmed" ${c.status === 'confirmed' ? 'selected' : ''}>Ada estimasi/nilai</option><option value="unknown" ${c.status !== 'confirmed' ? 'selected' : ''}>Belum diketahui (belum pasti)</option></select></label>
    <div id="nutr" class="stack">${comp && c.status === 'confirmed' ? '<label class="check"><input type="checkbox" id="resc" checked> Skalakan nutrisi otomatis saat jumlah diubah</label>' : ''}<div class="grid2">${NUTR_KEYS.map(nf).join('')}</div>
      <label class="check"><input type="checkbox" name="est" ${c.estimated !== false ? 'checked' : ''}> Ini estimasi (bukan dari label kemasan)</label>
      <label class="field"><span>Keyakinan</span><select name="conf">${['rendah', 'sedang', 'tinggi'].map((x) => `<option ${x === (c.confidence || 'sedang') ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
    <div id="rng" class="grid2"><label class="field"><span>Perkiraan kkal min (opsional)</span><input name="rmin" inputmode="decimal" value="${c.range?.min ?? ''}"></label><label class="field"><span>Perkiraan kkal maks</span><input name="rmax" inputmode="decimal" value="${c.range?.max ?? ''}"></label></div>
    <label class="field"><span>Catatan</span><input name="note" value="${esc(c.note || '')}"></label><button class="btn primary block">OK</button></form>`);
  const f = m.el.querySelector('form'), oldN = c.n, oldAmt = c.amount;
  const toggle = () => { const conf = f.status.value === 'confirmed'; f.querySelector('#nutr').hidden = !conf; f.querySelector('#rng').hidden = conf; };
  f.status.onchange = toggle; toggle();
  const resc = f.querySelector('#resc');
  f.amount.oninput = () => { const a = numOrNull(f.amount.value); if (resc?.checked && oldN && oldAmt > 0 && a != null) { const s = scaleN(oldN, a / oldAmt); for (const k of NUTR_KEYS) f['n_' + k].value = s[k]; if (c.grams) f.grams.value = round(c.grams * a / oldAmt, 1); } };
  const findFood = () => { const s = f.name.value.trim().toLowerCase(); return foods.find((x) => x.name.toLowerCase() === s) || (s.length >= 3 ? foods.find((x) => x.name.toLowerCase().startsWith(s)) : null); };
  f.querySelector('#fromdb').onclick = () => {
    const fd = findFood(), a = numOrNull(f.amount.value);
    if (!fd || !(a > 0)) { toast('Makanan tidak ada di database atau jumlah kosong', 'err'); return; }
    const g = a * unitGrams(fd, f.unit.value), nn = nutrientsFor(fd, g);
    f.grams.value = round(g, 1); for (const k of NUTR_KEYS) f['n_' + k].value = nn[k];
    f.status.value = 'confirmed'; f.est.checked = true; f.conf.value = 'sedang'; toggle(); c.foodId = fd.id;
    toast('Nilai dari database (estimasi) — silakan periksa', 'ok');
  };
  f.onsubmit = (e) => {
    e.preventDefault();
    const amount = numOrNull(f.amount.value);
    if (!(amount > 0)) { toast('Jumlah tidak valid', 'err'); return; }
    const out = { ...c, name: f.name.value.trim(), amount, unit: f.unit.value, grams: numOrNull(f.grams.value) ?? undefined, note: f.note.value.trim() || undefined, status: f.status.value };
    if (out.status === 'confirmed') {
      const nn = Object.fromEntries(NUTR_KEYS.map((k) => [k, numOrNull(f['n_' + k].value) ?? 0]));
      if (!(nn.kcal >= 0 && nn.kcal <= 5000)) { toast('Kalori tidak valid (0–5000)', 'err'); return; }
      Object.assign(out, { n: nn, estimated: f.est.checked, confidence: f.conf.value, range: undefined });
    } else {
      const lo = numOrNull(f.rmin.value), hi = numOrNull(f.rmax.value);
      Object.assign(out, { n: null, estimated: true, confidence: 'rendah', range: lo != null && hi != null && hi >= lo ? { min: lo, max: hi } : undefined });
    }
    m.close(); onOk(out);
  };
}
