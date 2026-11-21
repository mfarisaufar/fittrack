// Helper UI (browser saja): toast, modal, konfirmasi, clipboard, foto.
import { esc } from './util.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function toast(msg, type = '') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  el.setAttribute('role', 'status');
  box.appendChild(el);
  setTimeout(() => el.remove(), type === 'err' ? 6000 : 3200);
}

/** Modal bottom-sheet. Mengembalikan {el, close}. */
export function modal(title, html, { wide = false, onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Tutup">✕</button></div>
    <div class="modal-body">${html}</div></div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  const close = () => { wrap.remove(); if (!$('.modal-wrap')) document.body.classList.remove('no-scroll'); onClose?.(); };
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  return { el: $('.modal-body', wrap), root: wrap, close };
}

export function confirmDialog(message, { okText = 'Ya', cancelText = 'Batal', danger = false } = {}) {
  return new Promise((resolve) => {
    const m = modal('Konfirmasi', `<p>${esc(message).replace(/\n/g, '<br>')}</p>
      <div class="row end gap"><button class="btn" data-no>${esc(cancelText)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(okText)}</button></div>`, { onClose: () => resolve(false) });
    m.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-yes]')) { resolve(true); m.root.remove(); if (!$('.modal-wrap')) document.body.classList.remove('no-scroll'); }
      else if (e.target.closest('[data-no]')) m.close();
    });
  });
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fallback */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

/** Perkecil foto ke dataURL JPEG (maks. 800px) agar ringan di IndexedDB. */
export function resizeImage(file, max = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gagal membaca foto.')); };
    img.src = url;
  });
}

/** Ambil nilai form sebagai objek (FormData). */
export const formData = (form) => Object.fromEntries(new FormData(form).entries());

export function on(root, type, selector, handler) {
  root.addEventListener(type, (e) => {
    const t = e.target.closest(selector);
    if (t && root.contains(t)) handler(e, t);
  });
}
