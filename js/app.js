// Shell aplikasi: inisialisasi, router hash, navigasi, service worker, pengingat backup.
import { loadState, state } from './store.js';
import { esc, todayStr, diffDays } from './util.js';
import { db } from './db.js';
import { toast, $ } from './ui.js';
import { renderProfileForm } from './views/profile.js';

const ROUTES = {
  dashboard: ['Dashboard', () => import('./views/dashboard.js')],
  food: ['Food & Kalori', () => import('./views/food.js')],
  workout: ['Workout & Latihan', () => import('./views/workout.js')],
  health: ['Health Monitoring', () => import('./views/health.js')],
  sleep: ['Sleep Monitoring', () => import('./views/sleep.js')],
  reports: ['Progress & Laporan', () => import('./views/reports.js')],
  ai: ['AI Health Assistant', () => import('./views/ai.js')],
  settings: ['Backup & Pengaturan', () => import('./views/settings.js')],
  more: ['Menu', () => import('./views/more.js')],
};
const TABS = [['dashboard', '🏠', 'Beranda'], ['food', '🍽️', 'Makan'], ['workout', '💪', 'Latihan'], ['health', '❤️', 'Kesehatan'], ['more', '☰', 'Lainnya']];
const MORE_GROUP = new Set(['sleep', 'reports', 'ai', 'settings', 'more']);

let cleanup = null, renderToken = 0;

export function navigate(hash) { location.hash = hash; }

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  const name = path || 'dashboard';
  return { name: ROUTES[name] ? name : 'dashboard', params: Object.fromEntries(new URLSearchParams(qs)) };
}

async function route() {
  const token = ++renderToken;
  const view = $('#view');
  if (typeof cleanup === 'function') { try { cleanup(); } catch { /* abaikan */ } }
  cleanup = null;
  document.querySelectorAll('.modal-wrap').forEach((m) => m.remove());
  document.body.classList.remove('no-scroll');
  if (!state.profile) { $('#title').textContent = 'Mulai'; $('#tabbar').hidden = true; await renderProfileForm(view, { onDone: () => { $('#tabbar').hidden = false; location.hash = '#/dashboard'; route(); } }); return; }
  const { name, params } = parseHash();
  $('#title').textContent = ROUTES[name][0];
  $('#tabbar').innerHTML = TABS.map(([k, ic, lb]) => `<a href="#/${k}" class="${k === name || (k === 'more' && MORE_GROUP.has(name)) ? 'on' : ''}" ${k === name ? 'aria-current="page"' : ''}><span>${ic}</span>${lb}</a>`).join('');
  view.innerHTML = '<div class="loading">Memuat…</div>';
  try {
    const mod = await ROUTES[name][1]();
    if (token !== renderToken) return;
    view.innerHTML = '';
    const host = document.createElement('div'); // wadah baru per halaman agar event listener tidak menumpuk
    view.appendChild(host);
    cleanup = (await mod.render(host, { params, navigate })) || null;
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="card err"><h3>Terjadi kesalahan</h3><p>${esc(err.message)}</p><a class="btn" href="#/dashboard">Kembali ke beranda</a></div>`;
  }
}

function applyTheme() {
  const t = state.settings?.theme || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}
export { applyTheme };

async function backupBanner() {
  const b = $('#banner');
  b.innerHTML = '';
  const s = state.settings;
  if (!s.backupReminder) return;
  const hasData = (await db.count('food_log_items')) + (await db.count('health_measurements')) + (await db.count('workout_sessions')) + (await db.count('sleep_logs')) > 0;
  if (!hasData) return;
  const last = s.lastBackupAt ? diffDays(todayStr(), todayStr(new Date(s.lastBackupAt))) : Infinity;
  if (last >= 7) b.innerHTML = `<div class="banner">⚠️ ${s.lastBackupAt ? `Backup terakhir ${last} hari lalu.` : 'Anda belum pernah membuat backup.'} Data hanya ada di perangkat ini. <a href="#/settings">Backup sekarang</a></div>`;
}

function netStatus() {
  const el = $('#net');
  const upd = () => { el.hidden = navigator.onLine; };
  addEventListener('online', upd); addEventListener('offline', upd); upd();
}

async function init() {
  try {
    await loadState();
    applyTheme();
    netStatus();
    navigator.storage?.persist?.().catch(() => {});
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW gagal:', e));
    await backupBanner();
    addEventListener('hashchange', () => { route(); backupBanner(); });
    await route();
  } catch (err) {
    console.error(err);
    $('#view').innerHTML = `<div class="card err"><h3>Aplikasi gagal dimulai</h3><p>${esc(err.message)}</p><p>Pastikan browser mengizinkan penyimpanan situs (bukan mode penyamaran).</p></div>`;
    toast('Gagal memulai aplikasi', 'err');
  }
}
init();
