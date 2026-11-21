// Definisi metrik kesehatan (bukan data pribadi). Rentang min/max hanya untuk validasi input (nilai tidak masuk akal).
export const METRICS = {
  weight: { label: 'Berat badan', unit: 'kg', min: 20, max: 300, dec: 1 },
  waist: { label: 'Lingkar perut', unit: 'cm', min: 30, max: 250, dec: 1 },
  sys: { label: 'Tekanan sistolik', unit: 'mmHg', min: 60, max: 260, dec: 0 },
  dia: { label: 'Tekanan diastolik', unit: 'mmHg', min: 30, max: 160, dec: 0 },
  hr: { label: 'Detak jantung', unit: 'bpm', min: 30, max: 220, dec: 0 },
  chol: { label: 'Kolesterol total', unit: 'mg/dL', min: 50, max: 600, dec: 0 },
  ldl: { label: 'LDL', unit: 'mg/dL', min: 10, max: 500, dec: 0 },
  hdl: { label: 'HDL', unit: 'mg/dL', min: 10, max: 200, dec: 0 },
  tg: { label: 'Trigliserida', unit: 'mg/dL', min: 20, max: 2000, dec: 0 },
  apob: { label: 'ApoB', unit: 'mg/dL', min: 20, max: 300, dec: 0 },
  nonhdl: { label: 'Non-HDL', unit: 'mg/dL', min: 20, max: 500, dec: 0 },
  fbg: { label: 'Gula darah puasa', unit: 'mg/dL', min: 30, max: 600, dec: 0 },
  hba1c: { label: 'HbA1c', unit: '%', min: 3, max: 18, dec: 1 },
  uric: { label: 'Asam urat', unit: 'mg/dL', min: 1, max: 20, dec: 1 },
  creat: { label: 'Kreatinin', unit: 'mg/dL', min: 0.1, max: 15, dec: 2 },
  egfr: { label: 'eGFR', unit: 'mL/mnt', min: 5, max: 200, dec: 0 },
  ast: { label: 'AST/GOT', unit: 'U/L', min: 5, max: 1000, dec: 0 },
  alt: { label: 'ALT/GPT', unit: 'U/L', min: 5, max: 1000, dec: 0 },
};
export const MCU_FIELDS = ['weight', 'waist', 'sys', 'dia', 'chol', 'ldl', 'hdl', 'tg', 'apob', 'nonhdl', 'fbg', 'hba1c', 'uric', 'creat', 'egfr', 'ast', 'alt'];
export const LAB_FIELDS = ['chol', 'ldl', 'hdl', 'tg', 'apob', 'nonhdl', 'fbg', 'hba1c', 'uric', 'creat', 'egfr', 'ast', 'alt'];
/** Jenis catatan cepat di halaman Health Monitoring ('bp' menyimpan sistolik + diastolik). */
export const QUICK_TYPES = ['weight', 'waist', 'bp', 'hr', ...LAB_FIELDS];

export function checkRange(key, v) {
  const m = METRICS[key];
  if (!m) return null;
  if (!Number.isFinite(v)) return `${m.label}: nilai tidak valid`;
  if (v < m.min || v > m.max) return `${m.label}: ${v} ${m.unit} di luar rentang wajar (${m.min}–${m.max}). Periksa kembali.`;
  return null;
}
