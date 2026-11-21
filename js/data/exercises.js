// Pustaka gerakan latihan rumahan (tanpa alat, low-impact, tanpa lompat).
// Ilustrasi dibuat sebagai SVG figur garis yang digambar oleh kode (legal, stabil, bekerja offline).
//
// Pose = [kepala, leher, panggul, siku, tangan, lutut, kaki] (viewBox 120x90, tanah y=80, menghadap kanan)
// extra = garis tambahan [x1,y1,x2,y2] untuk anggota badan lain; wall = posisi dinding.

const S = [50, 12], N = [50, 21];
const STAND = { p: [S, N, [49, 46], [60, 34], [68, 42], [52, 62], [50, 80]] };

export const EXERCISES = [
  {
    id: 'wall-pushup', name: 'Wall Push-up', muscles: 'Dada, bahu, triceps, core', level: 'Pemula', met: 3.5,
    benefit: 'Melatih otot dada dan lengan dengan beban ringan; cocok untuk membangun dasar sebelum push-up lantai.',
    start: 'Berdiri menghadap dinding sejauh satu langkah, telapak tangan di dinding setinggi dada selebar bahu.',
    steps: ['Jaga tubuh lurus dari kepala sampai tumit.', 'Tekuk siku perlahan hingga dada mendekati dinding.', 'Dorong dinding hingga lengan hampir lurus.', 'Ulangi dengan gerakan terkontrol.'],
    breath: 'Tarik napas saat mendekat ke dinding, hembuskan saat mendorong.',
    mistakes: ['Pinggang melengkung atau pantat menonjol', 'Siku terbuka terlalu lebar', 'Gerakan terlalu cepat'],
    mod: 'Berdiri lebih dekat ke dinding agar lebih ringan; jauhkan kaki untuk menambah tantangan.',
    sets: 2, reps: 10, unit: 'reps', rest: 45,
    poses: [{ p: [[66, 22], [62, 30], [42, 50], [80, 33], [98, 32], [36, 66], [30, 80]], wall: 100 }, { p: [[85, 28], [80, 36], [52, 52], [90, 45], [98, 36], [42, 67], [30, 80]], wall: 100 }],
  },
  {
    id: 'pushup-mod', name: 'Push-up Modifikasi (lutut)', muscles: 'Dada, bahu, triceps, core', level: 'Pemula–Menengah', met: 3.8,
    benefit: 'Menguatkan tubuh bagian atas dan core dengan beban lebih ringan daripada push-up penuh.',
    start: 'Posisi plank dengan lutut di lantai, tangan sedikit lebih lebar dari bahu, tubuh lurus dari kepala ke lutut.',
    steps: ['Kencangkan perut dan bokong.', 'Turunkan dada ke arah lantai dengan siku sekitar 45° dari badan.', 'Dorong kembali ke atas tanpa mengunci siku.'],
    breath: 'Tarik napas saat turun, hembuskan saat naik.',
    mistakes: ['Pinggul turun atau naik', 'Leher menunduk/menengadah berlebihan', 'Rentang gerak terlalu pendek'],
    mod: 'Gunakan sandaran lebih tinggi (sofa/meja kokoh) atau kembali ke wall push-up.',
    sets: 2, reps: 6, unit: 'reps', rest: 60,
    poses: [{ p: [[88, 44], [82, 50], [50, 60], [82, 66], [84, 80], [32, 79], [16, 68]] }, { p: [[90, 62], [84, 66], [50, 68], [72, 74], [84, 80], [32, 79], [16, 70]] }],
  },
  {
    id: 'squat', name: 'Squat', muscles: 'Paha depan, bokong, hamstring, core', level: 'Pemula', met: 3.8,
    benefit: 'Gerakan dasar kaki dan bokong yang berguna untuk aktivitas sehari-hari.',
    start: 'Berdiri, kaki selebar bahu, ujung kaki sedikit keluar, dada terbuka.',
    steps: ['Dorong pinggul ke belakang seperti akan duduk.', 'Turun hingga paha mendekati sejajar lantai (sesuai kemampuan).', 'Lutut searah ujung kaki, tumit tetap menapak.', 'Dorong lantai dengan tumit untuk berdiri.'],
    breath: 'Tarik napas saat turun, hembuskan saat berdiri.',
    mistakes: ['Lutut masuk ke dalam', 'Tumit terangkat', 'Punggung membungkuk'],
    mod: 'Squat ke kursi: duduk ringan lalu berdiri; kurangi kedalaman jika lutut tidak nyaman.',
    sets: 2, reps: 10, unit: 'reps', rest: 45,
    poses: [STAND, { p: [[38, 34], [40, 42], [26, 62], [52, 46], [64, 44], [52, 62], [48, 80]] }],
  },
  {
    id: 'reverse-lunge', name: 'Reverse Lunge', muscles: 'Paha, bokong, keseimbangan', level: 'Pemula–Menengah', met: 3.8,
    benefit: 'Melatih kaki satu per satu dengan tekanan lutut lebih ringan dibanding lunge ke depan.',
    start: 'Berdiri tegak, tangan di pinggang atau depan dada.',
    steps: ['Langkahkan satu kaki ke belakang.', 'Turunkan pinggul hingga kedua lutut menekuk sekitar 90° (sesuai kemampuan).', 'Dorong kaki depan untuk kembali berdiri.', 'Ganti kaki.'],
    breath: 'Tarik napas saat turun, hembuskan saat naik.',
    mistakes: ['Langkah terlalu pendek', 'Badan condong ke depan', 'Lutut depan melewati ujung kaki terlalu jauh'],
    mod: 'Berpegangan pada dinding/kursi, atau kurangi kedalaman.',
    sets: 2, reps: 8, unit: 'reps', rest: 45, perSide: true,
    poses: [STAND, { p: [[48, 20], [48, 29], [48, 52], [52, 40], [54, 50], [62, 64], [60, 80]], extra: [[48, 52, 34, 74], [34, 74, 22, 78]] }],
  },
  {
    id: 'glute-bridge', name: 'Glute Bridge', muscles: 'Bokong, hamstring, punggung bawah', level: 'Pemula', met: 3.3,
    benefit: 'Menguatkan bokong dan menstabilkan panggul dengan beban rendah pada lutut.',
    start: 'Berbaring telentang, lutut ditekuk, telapak kaki rata di lantai selebar pinggul, lengan di samping tubuh.',
    steps: ['Kencangkan perut dan bokong.', 'Angkat pinggul hingga tubuh membentuk garis dari bahu ke lutut.', 'Tahan 1–2 detik.', 'Turunkan perlahan.'],
    breath: 'Hembuskan napas saat mengangkat, tarik napas saat turun.',
    mistakes: ['Punggung bawah terlalu melengkung', 'Mengangkat terlalu tinggi', 'Mendorong dengan ujung kaki'],
    mod: 'Kurangi ketinggian dan tahan lebih singkat.',
    sets: 2, reps: 12, unit: 'reps', rest: 40,
    poses: [{ p: [[14, 74], [22, 76], [48, 76], [34, 76], [46, 77], [66, 56], [72, 78]] }, { p: [[14, 74], [22, 76], [48, 60], [34, 76], [46, 77], [68, 54], [72, 78]] }],
  },
  {
    id: 'bird-dog', name: 'Bird Dog', muscles: 'Core, punggung bawah, bokong, bahu', level: 'Pemula', met: 3.0,
    benefit: 'Melatih stabilitas tulang belakang dan koordinasi tanpa tekanan tinggi.',
    start: 'Posisi merangkak: tangan di bawah bahu, lutut di bawah pinggul, punggung netral.',
    steps: ['Kencangkan perut.', 'Luruskan satu lengan ke depan dan kaki berlawanan ke belakang secara bersamaan.', 'Tahan 2 detik tanpa memutar pinggul.', 'Kembali dan ganti sisi.'],
    breath: 'Hembuskan napas saat meluruskan, tarik napas saat kembali.',
    mistakes: ['Pinggul berputar', 'Punggung melengkung', 'Mengangkat kaki terlalu tinggi'],
    mod: 'Luruskan lengan saja atau kaki saja secara bergantian.',
    sets: 2, reps: 8, unit: 'reps', rest: 40, perSide: true,
    poses: [{ p: [[30, 46], [36, 50], [72, 52], [38, 66], [40, 80], [74, 80], [86, 80]] }, { p: [[30, 46], [36, 50], [72, 52], [24, 48], [10, 46], [90, 52], [108, 50]], extra: [[36, 50, 38, 66], [38, 66, 40, 80], [72, 52, 74, 80], [74, 80, 86, 80]] }],
  },
  {
    id: 'dead-bug', name: 'Dead Bug', muscles: 'Core dalam, perut', level: 'Pemula', met: 3.0,
    benefit: 'Melatih perut dalam sambil menjaga punggung bawah tetap stabil.',
    start: 'Telentang, lengan lurus ke atas, paha tegak lurus dan lutut ditekuk 90° (posisi meja).',
    steps: ['Tekan punggung bawah ke lantai.', 'Turunkan lengan kanan ke belakang kepala dan luruskan kaki kiri.', 'Kembali ke awal lalu ganti sisi.'],
    breath: 'Hembuskan napas saat meluruskan, tarik napas saat kembali.',
    mistakes: ['Punggung bawah terangkat dari lantai', 'Bergerak terlalu cepat'],
    mod: 'Gerakkan kaki saja dengan lengan tetap di atas, atau sentuhkan tumit ke lantai bergantian.',
    sets: 2, reps: 8, unit: 'reps', rest: 40, perSide: true,
    poses: [{ p: [[16, 74], [24, 76], [50, 76], [24, 62], [24, 48], [50, 54], [70, 54]] }, { p: [[16, 74], [24, 76], [50, 76], [12, 70], [2, 76], [70, 70], [90, 76]], extra: [[24, 76, 24, 62], [24, 62, 24, 48], [50, 76, 50, 54], [50, 54, 70, 54]] }],
  },
  {
    id: 'crunch', name: 'Crunch (sesuai kemampuan)', muscles: 'Perut', level: 'Pemula', met: 3.0,
    benefit: 'Melatih otot perut bagian depan dengan rentang gerak kecil.',
    start: 'Telentang, lutut ditekuk, telapak kaki di lantai, tangan ringan di samping kepala atau menyilang di dada.',
    steps: ['Kencangkan perut.', 'Angkat bahu dari lantai beberapa sentimeter (bukan duduk penuh).', 'Turunkan perlahan.'],
    breath: 'Hembuskan napas saat naik, tarik napas saat turun.',
    mistakes: ['Menarik leher dengan tangan', 'Menggunakan ayunan', 'Menahan napas'],
    mod: 'Angkat sedikit saja, atau lakukan dead bug sebagai gantinya jika leher/punggung tidak nyaman.',
    sets: 2, reps: 10, unit: 'reps', rest: 40,
    poses: [{ p: [[16, 74], [24, 76], [50, 76], [18, 68], [16, 72], [64, 56], [72, 78]] }, { p: [[32, 58], [36, 64], [50, 76], [28, 58], [32, 60], [64, 56], [72, 78]] }],
  },
  {
    id: 'side-leg-raise', name: 'Side Leg Raise (berdiri)', muscles: 'Bokong samping, paha luar', level: 'Pemula', met: 2.8,
    benefit: 'Menguatkan otot penstabil panggul dengan beban ringan; versi berdiri sehingga tidak butuh matras.',
    start: 'Berdiri tegak berpegangan dinding/kursi bila perlu, kaki sedikit rapat.',
    steps: ['Kencangkan perut.', 'Angkat satu kaki ke samping dengan lutut menghadap depan.', 'Turunkan perlahan tanpa memiringkan badan.', 'Ulangi lalu ganti kaki. Alternatif: lakukan berbaring miring jika nyaman.'],
    breath: 'Hembuskan napas saat mengangkat, tarik napas saat turun.',
    mistakes: ['Badan miring ke samping', 'Mengayunkan kaki', 'Mengangkat terlalu tinggi'],
    mod: 'Berpegangan pada penyangga dan angkat lebih rendah.',
    sets: 2, reps: 10, unit: 'reps', rest: 30, perSide: true,
    poses: [STAND, { p: [S, N, [49, 46], [46, 34], [44, 46], [68, 62], [84, 72]], extra: [[49, 46, 50, 62], [50, 62, 50, 80]] }],
  },
  {
    id: 'marching', name: 'Marching in Place', muscles: 'Kaki, core, kardio ringan', level: 'Pemula', met: 3.0,
    benefit: 'Pemanasan kardio ringan tanpa lompatan.',
    start: 'Berdiri tegak, bahu rileks.',
    steps: ['Angkat satu lutut setinggi pinggul (sesuai kemampuan).', 'Ayunkan lengan berlawanan.', 'Ganti sisi dengan ritme stabil.'],
    breath: 'Bernapas alami; ritme teratur.',
    mistakes: ['Membungkuk', 'Kaki menghentak keras'],
    mod: 'Angkat lutut lebih rendah.',
    sets: 1, reps: 60, unit: 'detik', rest: 20,
    poses: [STAND, { p: [S, N, [49, 46], [58, 33], [64, 28], [66, 46], [66, 64]], extra: [[49, 46, 50, 62], [50, 62, 50, 80]] }],
  },
  {
    id: 'step-touch', name: 'Step Touch', muscles: 'Kaki, kardio ringan', level: 'Pemula', met: 3.0,
    benefit: 'Pemanasan atau kardio ringan berirama tanpa lompatan.',
    start: 'Berdiri, kaki rapat.',
    steps: ['Langkahkan satu kaki ke samping.', 'Dekatkan kaki lainnya hingga menyentuh.', 'Ulangi ke sisi sebaliknya sambil mengayun lengan.'],
    breath: 'Bernapas alami.',
    mistakes: ['Melompat', 'Langkah terlalu lebar'],
    mod: 'Perlambat ritme dan perkecil langkah.',
    sets: 1, reps: 60, unit: 'detik', rest: 20,
    poses: [STAND, { p: [S, N, [49, 46], [58, 34], [66, 40], [60, 62], [70, 80]], extra: [[49, 46, 42, 62], [42, 62, 36, 80]] }],
  },
  {
    id: 'knee-to-elbow', name: 'Standing Knee-to-Elbow', muscles: 'Perut samping, core, panggul', level: 'Pemula', met: 3.2,
    benefit: 'Melatih core dan koordinasi dalam posisi berdiri.',
    start: 'Berdiri tegak, tangan di belakang kepala, siku terbuka.',
    steps: ['Angkat satu lutut sambil memiringkan badan.', 'Dekatkan siku sisi berlawanan ke lutut.', 'Kembali ke awal lalu ganti sisi.'],
    breath: 'Hembuskan napas saat lutut naik, tarik napas saat kembali.',
    mistakes: ['Menarik kepala dengan tangan', 'Membungkuk dari pinggang'],
    mod: 'Berpegangan dinding, atau cukup angkat lutut tanpa menyentuh siku.',
    sets: 2, reps: 10, unit: 'reps', rest: 30, perSide: true,
    poses: [STAND, { p: [[54, 14], [52, 23], [50, 46], [58, 36], [52, 28], [62, 42], [58, 58]], extra: [[50, 46, 50, 62], [50, 62, 50, 80]] }],
  },
  {
    id: 'plank-mod', name: 'Plank Modifikasi (lutut/lengan bawah)', muscles: 'Core, bahu', level: 'Pemula', met: 3.0,
    benefit: 'Melatih daya tahan core dengan beban lebih ringan daripada plank penuh.',
    start: 'Bertumpu pada lengan bawah dan lutut, siku di bawah bahu.',
    steps: ['Kencangkan perut dan bokong.', 'Jaga tubuh lurus dari kepala ke lutut.', 'Tahan sesuai durasi target lalu turun.'],
    breath: 'Bernapas dalam dan teratur; jangan menahan napas.',
    mistakes: ['Pinggul turun', 'Pinggul terlalu naik', 'Menahan napas'],
    mod: 'Mulai 10–15 detik; atau bertumpu pada telapak tangan di meja kokoh.',
    sets: 2, reps: 20, unit: 'detik', rest: 40,
    poses: [{ p: [[88, 50], [80, 56], [50, 64], [76, 78], [88, 78], [32, 79], [16, 70]] }],
  },
  {
    id: 'stretch', name: 'Peregangan', muscles: 'Seluruh tubuh', level: 'Pemula', met: 2.3,
    benefit: 'Melemaskan otot dan membantu pemulihan setelah latihan.',
    start: 'Berdiri tegak, kaki selebar pinggul.',
    steps: ['Angkat kedua lengan ke atas dan regangkan tubuh.', 'Miringkan badan ke samping perlahan, tahan 15–20 detik per sisi.', 'Lanjutkan peregangan paha depan, betis, dan bahu sesuai kebutuhan.'],
    breath: 'Napas dalam dan panjang saat menahan peregangan.',
    mistakes: ['Menghentak/memantul', 'Meregang sampai nyeri'],
    mod: 'Kurangi jangkauan; berhenti bila ada nyeri tajam.',
    sets: 1, reps: 30, unit: 'detik', rest: 10,
    poses: [{ p: [[50, 16], [50, 25], [50, 48], [53, 14], [52, 4], [50, 63], [50, 80]] }, { p: [[60, 18], [56, 26], [49, 48], [68, 12], [80, 12], [50, 63], [50, 80]] }],
  },
  {
    id: 'cooldown', name: 'Pendinginan', muscles: 'Seluruh tubuh', level: 'Pemula', met: 2.0,
    benefit: 'Menurunkan detak jantung secara bertahap dan menenangkan tubuh setelah latihan.',
    start: 'Berdiri rileks.',
    steps: ['Berjalan pelan di tempat 1–2 menit.', 'Tarik napas dalam lewat hidung 4 hitungan, hembuskan lewat mulut 6 hitungan, ulangi 5–8 kali.', 'Putar bahu dan leher perlahan.'],
    breath: 'Napas dalam dan lambat.',
    mistakes: ['Langsung berhenti total setelah latihan berat', 'Napas terlalu cepat'],
    mod: 'Duduk di kursi bila pusing.',
    sets: 1, reps: 120, unit: 'detik', rest: 0,
    poses: [{ p: [S, N, [49, 46], [58, 32], [68, 40], [50, 62], [50, 80]] }],
  },
];
export const EX_BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

// Templat bawaan (sets/reps dapat diubah pengguna dan disimpan di IndexedDB)
export const DEFAULT_TEMPLATES = [
  { id: 'tpl-a', name: 'Home Workout A', desc: 'Dorong & kaki — sekitar 20–25 menit', items: [['marching', 1, 60], ['wall-pushup', 2, 10], ['squat', 2, 10], ['glute-bridge', 2, 12], ['bird-dog', 2, 8], ['dead-bug', 2, 8], ['stretch', 1, 30]] },
  { id: 'tpl-b', name: 'Home Workout B', desc: 'Core & kaki — sekitar 20–25 menit', items: [['step-touch', 1, 60], ['pushup-mod', 2, 6], ['reverse-lunge', 2, 8], ['side-leg-raise', 2, 10], ['crunch', 2, 10], ['plank-mod', 2, 20], ['knee-to-elbow', 2, 10], ['cooldown', 1, 120]] },
  { id: 'tpl-warmup', name: 'Pemanasan', desc: 'Sekitar 5 menit', items: [['marching', 1, 60], ['step-touch', 1, 60], ['stretch', 1, 30]] },
  { id: 'tpl-cooldown', name: 'Pendinginan', desc: 'Sekitar 5 menit', items: [['cooldown', 1, 120], ['stretch', 1, 30]] },
  { id: 'tpl-recovery', name: 'Pemulihan', desc: 'Hari istirahat aktif, sangat ringan', items: [['marching', 1, 60], ['stretch', 2, 30], ['cooldown', 1, 120]] },
];

// Jadwal mingguan bawaan: indeks 0 = Senin
export const DEFAULT_SCHEDULE = [
  { day: 0, label: 'Sepak bola 45–60 menit', kind: 'sport', sport: 'sepakbola', minutes: 60 },
  { day: 1, label: 'Home Workout A (20–25 menit)', kind: 'template', templateId: 'tpl-a' },
  { day: 2, label: 'Badminton 45–60 menit', kind: 'sport', sport: 'badminton', minutes: 60 },
  { day: 3, label: 'Istirahat / pemulihan', kind: 'rest', templateId: 'tpl-recovery' },
  { day: 4, label: 'Home Workout B (20–25 menit)', kind: 'template', templateId: 'tpl-b' },
  { day: 5, label: 'Istirahat', kind: 'rest' },
  { day: 6, label: 'Istirahat', kind: 'rest' },
];

/** Gambar SVG figur garis. poseIdx memilih pose awal/akhir. */
export function figureSVG(ex, poseIdx = 0) {
  const pose = ex.poses[Math.min(poseIdx, ex.poses.length - 1)];
  const [h, n, pv, el, hd, kn, ft] = pose.p;
  const L = (a, b, c) => `<polyline points="${a.join(',')} ${b.join(',')}${c ? ' ' + c.join(',') : ''}" />`;
  const extra = (pose.extra || []).map(([a, b, c, d]) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`).join('');
  const wall = pose.wall ? `<line x1="${pose.wall}" y1="6" x2="${pose.wall}" y2="80" class="fig-wall"/>` : '';
  return `<svg viewBox="0 0 120 90" class="fig" role="img" aria-label="${ex.name} — posisi ${poseIdx + 1}" xmlns="http://www.w3.org/2000/svg">
<line x1="2" y1="81" x2="118" y2="81" class="fig-ground"/>${wall}
<g class="fig-body" fill="none" stroke-linecap="round" stroke-linejoin="round">${L(n, pv)}${L(n, el, hd)}${L(pv, kn, ft)}${extra}</g>
<circle cx="${h[0]}" cy="${h[1]}" r="5.5" class="fig-head"/></svg>`;
}
