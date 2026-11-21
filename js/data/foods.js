// Database makanan awal (statis, bukan data pribadi).
//
// PENTING: seluruh angka di sini adalah PERKIRAAN per 100 g/100 ml yang dibulatkan dari kisaran umum
// pada sumber seperti Tabel Komposisi Pangan Indonesia (TKPI) dan USDA FoodData Central. Angka belum
// diverifikasi per produk/penjual. Masakan rumahan dan jajanan sangat bervariasi, jadi semua entri
// ditandai estimate:true. Gunakan "Makanan Custom" dengan label kemasan bila ingin akurasi lebih baik.
//
// Kolom: id, nama, kategori, kkal, protein, karbo, lemak, lemak jenuh, gula, serat, natrium(mg), opsi
// opsi.u   = berat (g/ml) per satuan rumah tangga untuk makanan tersebut
// opsi.idr = rentang asumsi harga jajanan (Rupiah per 100 g) — HANYA asumsi untuk estimasi nominal
export const CATEGORIES = {
  pokok: 'Makanan pokok',
  protein: 'Protein',
  jajanan: 'Jajanan & lokal',
  sayur: 'Sayur',
  buah: 'Buah',
  minuman: 'Minuman',
};

const SRC = 'Perkiraan dibulatkan dari kisaran umum TKPI/USDA — belum diverifikasi per produk';

const ROWS = [
  // ---- Makanan pokok ----
  ['nasi-putih', 'Nasi putih', 'pokok', 130, 2.7, 28, 0.3, 0.1, 0, 0.4, 1, { u: { centong: 100, piring: 250, porsi: 200 } }],
  ['nasi-goreng', 'Nasi goreng', 'pokok', 190, 5, 25, 8, 1.8, 1, 1, 500, { u: { porsi: 250, piring: 300, centong: 100 } }],
  ['nasi-gurih', 'Nasi gurih (santan)', 'pokok', 170, 3, 27, 5.5, 4, 0.5, 0.6, 250, { u: { porsi: 250, piring: 300, centong: 100 } }],
  ['nasi-uduk', 'Nasi uduk', 'pokok', 175, 3, 27, 6, 4.5, 0.5, 0.6, 300, { u: { porsi: 250, piring: 300, centong: 100 } }],
  ['mie-goreng', 'Mie goreng', 'pokok', 200, 5, 28, 8, 2, 2, 1.5, 600, { u: { porsi: 250, piring: 300 } }],
  ['mie-aceh', 'Mie Aceh', 'pokok', 195, 8, 25, 7, 2.5, 3, 1.5, 550, { u: { porsi: 300, piring: 350 } }],
  ['mie-ayam', 'Mie ayam (dengan topping)', 'pokok', 150, 7, 22, 4, 1.2, 1, 1, 550, { u: { porsi: 350 } }],
  ['mie-instan', 'Mie instan (kering, belum dimasak)', 'pokok', 440, 9, 60, 18, 8, 3, 2, 1800, { u: { bungkus: 80, porsi: 80 } }],
  ['roti-tawar', 'Roti tawar', 'pokok', 265, 9, 49, 3.2, 0.7, 5, 2.7, 490, { u: { potong: 28, buah: 28 } }],
  ['roti-manis', 'Roti manis/isi', 'pokok', 300, 7, 50, 8, 3, 15, 2, 300, { u: { buah: 60, potong: 60 } }],
  ['kentang-rebus', 'Kentang rebus', 'pokok', 87, 1.9, 20, 0.1, 0, 0.9, 1.8, 6, { u: { buah: 100, porsi: 150 } }],
  ['kentang-goreng', 'Kentang goreng', 'pokok', 312, 3.4, 41, 15, 2.3, 0.3, 3.8, 210, { u: { porsi: 100, bungkus: 100 } }],
  ['ubi-rebus', 'Ubi rebus', 'pokok', 90, 1.6, 21, 0.1, 0, 6.5, 3, 36, { u: { buah: 130, potong: 80 } }],
  ['lontong', 'Lontong', 'pokok', 130, 2.5, 29, 0.3, 0.1, 0, 0.5, 5, { u: { potong: 60, porsi: 150 } }],
  ['bubur-ayam', 'Bubur ayam', 'pokok', 90, 4, 14, 2, 0.6, 0.3, 0.4, 300, { u: { porsi: 300, piring: 300 } }],
  ['oatmeal', 'Oatmeal (matang, tanpa gula)', 'pokok', 70, 2.5, 12, 1.4, 0.3, 0.3, 1.7, 4, { u: { porsi: 200 } }],

  // ---- Protein ----
  ['ayam-goreng', 'Ayam goreng', 'protein', 260, 22, 6, 16, 4.3, 0, 0.3, 400, { u: { potong: 85, porsi: 85 } }],
  ['ayam-bakar', 'Ayam bakar', 'protein', 190, 25, 2, 9, 2.5, 1, 0, 350, { u: { potong: 85, porsi: 85 } }],
  ['ayam-rebus', 'Dada ayam rebus/panggang tanpa kulit', 'protein', 165, 31, 0, 3.6, 1, 0, 0, 74, { u: { potong: 100, porsi: 100 } }],
  ['sate-ayam', 'Sate ayam (tanpa bumbu kacang)', 'protein', 180, 23, 3, 8, 2.2, 2, 0, 400, { u: { buah: 25, porsi: 125 } }],
  ['ikan-goreng', 'Ikan goreng', 'protein', 210, 22, 4, 12, 2.5, 0, 0, 300, { u: { potong: 80, porsi: 80 } }],
  ['ikan-bakar', 'Ikan bakar', 'protein', 150, 24, 0, 5.5, 1.3, 0, 0, 250, { u: { potong: 100, porsi: 100 } }],
  ['telur-rebus', 'Telur rebus', 'protein', 155, 13, 1.1, 11, 3.3, 1.1, 0, 124, { u: { buah: 50 } }],
  ['telur-dadar', 'Telur dadar', 'protein', 190, 12, 1.5, 15, 4.5, 1, 0, 200, { u: { buah: 60, porsi: 60 } }],
  ['telur-ceplok', 'Telur mata sapi', 'protein', 196, 13, 1, 15, 4.2, 1, 0, 200, { u: { buah: 50, porsi: 50 } }],
  ['daging-sapi', 'Daging sapi (masak)', 'protein', 220, 26, 0, 12, 5, 0, 0, 70, { u: { potong: 50, porsi: 100 } }],
  ['rendang', 'Rendang', 'protein', 200, 22, 4, 11, 6, 1, 1, 500, { u: { potong: 40, porsi: 80 } }],
  ['tempe-goreng', 'Tempe goreng', 'protein', 300, 17, 14, 21, 3.5, 0.5, 4, 10, { u: { potong: 25, buah: 25 } }],
  ['tempe-kukus', 'Tempe rebus/kukus', 'protein', 190, 18, 9, 11, 2.2, 0, 5, 9, { u: { potong: 40 } }],
  ['tahu-goreng', 'Tahu goreng', 'protein', 270, 16, 8, 20, 3, 0.5, 1, 15, { u: { buah: 25, potong: 25 } }],
  ['tahu-putih', 'Tahu putih (rebus/kukus)', 'protein', 80, 8, 2, 4.8, 0.7, 0.5, 0.3, 7, { u: { potong: 80 } }],
  ['bakso', 'Bakso sapi (rebus)', 'protein', 180, 11, 12, 10, 4, 0.5, 0.5, 550, { u: { buah: 30, porsi: 180 } }],
  ['pentol', 'Pentol (bakso aci/ikan)', 'protein', 150, 8, 18, 5, 1.5, 0.5, 0.5, 500, { u: { buah: 20, porsi: 100 }, idr: [2500, 6500] }],
  ['sosis', 'Sosis', 'protein', 280, 12, 4, 24, 8, 1, 0, 800, { u: { buah: 40 } }],

  // ---- Jajanan & lokal ----
  ['bakso-goreng', 'Bakso goreng', 'jajanan', 260, 9, 22, 15, 4, 1, 0.8, 500, { u: { buah: 25, porsi: 100 }, idr: [2500, 5500] }],
  ['gorengan', 'Gorengan campur (rata-rata)', 'jajanan', 270, 3, 28, 16, 3, 3, 2, 300, { u: { buah: 50, porsi: 100 }, idr: [1500, 3500] }],
  ['bakwan', 'Bakwan sayur', 'jajanan', 250, 3, 26, 15, 2.5, 2, 2, 280, { u: { buah: 50 }, idr: [1500, 3500] }],
  ['pisang-goreng', 'Pisang goreng', 'jajanan', 240, 2, 36, 11, 2.5, 12, 2, 80, { u: { buah: 60 }, idr: [1500, 3500] }],
  ['tahu-isi', 'Tahu isi', 'jajanan', 260, 8, 20, 17, 3, 2, 1.5, 350, { u: { buah: 60 }, idr: [1500, 3500] }],
  ['risoles', 'Risoles', 'jajanan', 230, 6, 25, 11, 3.5, 2, 1, 300, { u: { buah: 70 }, idr: [2000, 4500] }],
  ['martabak-manis', 'Martabak manis', 'jajanan', 330, 7, 45, 14, 6, 22, 1, 200, { u: { potong: 80, porsi: 160 }, idr: [4000, 9000] }],
  ['martabak-telur', 'Martabak telur', 'jajanan', 240, 10, 19, 14, 4, 1, 1, 500, { u: { potong: 90, porsi: 180 }, idr: [4000, 9000] }],
  ['soto-ayam', 'Soto ayam (berkuah, dengan isi)', 'jajanan', 70, 6, 5, 3, 1, 0.5, 0.4, 380, { u: { porsi: 350, piring: 350 } }],
  ['makanan-berkuah', 'Sop/kuah bening (dengan isi)', 'jajanan', 45, 4, 4, 1.5, 0.5, 1, 0.8, 350, { u: { porsi: 300 } }],
  ['gulai', 'Gulai/kari santan', 'jajanan', 140, 9, 4, 10, 7, 1, 1, 450, { u: { porsi: 150 } }],
  ['gado-gado', 'Gado-gado', 'jajanan', 150, 6, 13, 8, 2, 4, 3, 350, { u: { porsi: 250, piring: 250 } }],
  ['siomay', 'Siomay/batagor', 'jajanan', 180, 10, 18, 7, 1.5, 1, 0.5, 450, { u: { porsi: 150, buah: 30 }, idr: [3000, 6000] }],
  ['seblak', 'Seblak', 'jajanan', 130, 5, 16, 5, 1, 1, 1, 800, { u: { porsi: 250 } }],
  ['kue-tradisional', 'Kue tradisional basah (rata-rata)', 'jajanan', 220, 3, 40, 6, 4, 18, 1, 100, { u: { buah: 50, potong: 50 }, idr: [2500, 5500] }],
  ['timphan', 'Timphan', 'jajanan', 210, 3, 40, 5, 3, 15, 1, 80, { u: { buah: 60 }, idr: [2500, 5500] }],
  ['donat', 'Donat', 'jajanan', 400, 5, 48, 20, 8, 20, 1.5, 300, { u: { buah: 60 }, idr: [4000, 9000] }],
  ['keripik', 'Makanan ringan (keripik/snack kemasan)', 'jajanan', 520, 6, 55, 31, 12, 2, 3, 600, { u: { bungkus: 30, porsi: 30 } }],
  ['biskuit', 'Biskuit', 'jajanan', 450, 6, 70, 16, 7, 20, 2, 400, { u: { buah: 10, bungkus: 30 } }],
  ['cokelat', 'Cokelat batang', 'jajanan', 540, 6, 58, 31, 19, 52, 3, 50, { u: { potong: 10, bungkus: 40 } }],
  ['kacang-goreng', 'Kacang tanah goreng', 'jajanan', 590, 25, 16, 49, 7, 4, 8, 5, { u: { porsi: 30, sendok: 10 } }],

  // ---- Sayur ----
  ['bayam', 'Bayam (rebus)', 'sayur', 23, 2.9, 3.6, 0.4, 0.1, 0.4, 2.2, 79, { u: { porsi: 100, centong: 80 } }],
  ['kangkung', 'Kangkung (rebus)', 'sayur', 29, 3, 5, 0.3, 0.1, 1, 2, 113, { u: { porsi: 100, centong: 80 } }],
  ['wortel', 'Wortel', 'sayur', 41, 0.9, 10, 0.2, 0, 4.7, 2.8, 69, { u: { buah: 60, porsi: 100 } }],
  ['brokoli', 'Brokoli (rebus)', 'sayur', 35, 2.4, 7, 0.4, 0.1, 1.7, 3.3, 33, { u: { porsi: 100 } }],
  ['kol', 'Kol/kubis', 'sayur', 25, 1.3, 6, 0.1, 0, 3.2, 2.5, 18, { u: { porsi: 100 } }],
  ['timun', 'Timun', 'sayur', 15, 0.7, 3.6, 0.1, 0, 1.7, 0.5, 2, { u: { buah: 150, porsi: 100 } }],
  ['tomat', 'Tomat', 'sayur', 18, 0.9, 3.9, 0.2, 0, 2.6, 1.2, 5, { u: { buah: 100 } }],
  ['sayur-tumis', 'Sayur tumis (dengan minyak)', 'sayur', 70, 2, 6, 4.5, 0.7, 2, 2.5, 300, { u: { porsi: 100 } }],
  ['sayur-santan', 'Sayur lodeh/santan', 'sayur', 100, 2, 7, 7, 5, 2, 2, 300, { u: { porsi: 150 } }],

  // ---- Buah ----
  ['pisang', 'Pisang', 'buah', 89, 1.1, 23, 0.3, 0.1, 12, 2.6, 1, { u: { buah: 100 } }],
  ['apel', 'Apel', 'buah', 52, 0.3, 14, 0.2, 0, 10, 2.4, 1, { u: { buah: 150 } }],
  ['jeruk', 'Jeruk', 'buah', 47, 0.9, 12, 0.1, 0, 9, 2.4, 0, { u: { buah: 130 } }],
  ['pepaya', 'Pepaya', 'buah', 43, 0.5, 11, 0.3, 0.1, 7.8, 1.7, 8, { u: { potong: 150, porsi: 150 } }],
  ['semangka', 'Semangka', 'buah', 30, 0.6, 7.6, 0.2, 0, 6.2, 0.4, 1, { u: { potong: 200, porsi: 200 } }],
  ['mangga', 'Mangga', 'buah', 60, 0.8, 15, 0.4, 0.1, 14, 1.6, 1, { u: { buah: 150 } }],
  ['salak', 'Salak', 'buah', 82, 0.4, 21, 0, 0, 14, 2, 0, { u: { buah: 35 } }],
  ['alpukat', 'Alpukat', 'buah', 160, 2, 9, 15, 2.1, 0.7, 7, 7, { u: { buah: 150, potong: 50 } }],
  ['nanas', 'Nanas', 'buah', 50, 0.5, 13, 0.1, 0, 10, 1.4, 1, { u: { potong: 100 } }],
  ['melon', 'Melon', 'buah', 34, 0.8, 8, 0.2, 0, 8, 0.9, 16, { u: { potong: 150 } }],
  ['anggur', 'Anggur', 'buah', 69, 0.7, 18, 0.2, 0, 16, 0.9, 2, { u: { porsi: 100 } }],

  // ---- Minuman (per 100 ml) ----
  ['air-putih', 'Air putih', 'minuman', 0, 0, 0, 0, 0, 0, 0, 0, { u: { gelas: 240 } }],
  ['kopi-hitam', 'Kopi hitam (tanpa gula)', 'minuman', 2, 0.3, 0, 0, 0, 0, 0, 2, { u: { gelas: 200 } }],
  ['kopi-manis', 'Kopi hitam + gula', 'minuman', 25, 0.2, 6.3, 0, 0, 6.2, 0, 2, { u: { gelas: 200 } }],
  ['kopi-susu', 'Kopi susu (bergula)', 'minuman', 55, 1.5, 9, 1.5, 1, 8.5, 0, 25, { u: { gelas: 250 } }],
  ['teh-tawar', 'Teh tawar', 'minuman', 1, 0, 0.2, 0, 0, 0, 0, 3, { u: { gelas: 240 } }],
  ['teh-manis', 'Teh manis', 'minuman', 32, 0, 8, 0, 0, 8, 0, 2, { u: { gelas: 240 } }],
  ['es-teh-manis', 'Es teh manis', 'minuman', 30, 0, 7.5, 0, 0, 7.5, 0, 3, { u: { gelas: 300 } }],
  ['jus-gula', 'Jus buah (dengan gula)', 'minuman', 50, 0.5, 12, 0.1, 0, 10, 0.5, 5, { u: { gelas: 250 } }],
  ['jus-tanpa-gula', 'Jus buah (tanpa gula tambahan)', 'minuman', 40, 0.5, 9.5, 0.1, 0, 8.5, 0.5, 3, { u: { gelas: 250 } }],
  ['susu', 'Susu sapi full cream', 'minuman', 61, 3.2, 5, 3.3, 2, 5, 0, 43, { u: { gelas: 240 } }],
  ['yogurt', 'Yogurt plain', 'minuman', 60, 3.5, 5, 3.3, 2, 5, 0, 46, { u: { porsi: 150, gelas: 200 } }],
  ['minuman-kemasan', 'Minuman kemasan manis (teh/soda)', 'minuman', 40, 0, 10, 0, 0, 10, 0, 10, { u: { bungkus: 330, gelas: 240 } }],
  ['boba', 'Milk tea/boba', 'minuman', 90, 1, 17, 2, 1, 15, 0, 40, { u: { gelas: 350 } }],
  ['sirup', 'Es sirup/minuman berpemanis', 'minuman', 45, 0, 11, 0, 0, 11, 0, 5, { u: { gelas: 300 } }],
];

export const FOODS = ROWS.map(([id, name, cat, kcal, p, c, f, sat, sugar, fiber, na, opt = {}]) => ({
  id, name, cat, kcal, p, c, f, sat, sugar, fiber, na,
  u: opt.u || {}, idr: opt.idr || null,
  source: SRC, estimate: true,
}));

export const FOOD_BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]));
export const MEALS = [
  ['sarapan', 'Sarapan'], ['siang', 'Makan siang'], ['malam', 'Makan malam'], ['camilan', 'Camilan'], ['minuman', 'Minuman'],
];
export const MEAL_LABEL = Object.fromEntries(MEALS);
