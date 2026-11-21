export function render(el) {
  const tiles = [
    ['sleep', '😴', 'Sleep Monitoring', 'Catat jam tidur & kualitas'],
    ['reports', '📈', 'Progress & Laporan', 'Harian, mingguan, bulanan'],
    ['ai', '🤖', 'AI Health Assistant', 'ChatGPT & Claude via salin-tempel'],
    ['settings', '⚙️', 'Backup & Pengaturan', 'Backup, restore, profil, privasi'],
  ];
  el.innerHTML = `<div class="stack">${tiles.map(([k, i, t, d]) => `<a class="card tile" href="#/${k}"><span class="tile-ic">${i}</span><span><b>${t}</b><br><small>${d}</small></span></a>`).join('')}</div>`;
}
