// State aplikasi + akses data tingkat tinggi (gabungan beberapa object store).
import { db } from './db.js';
import { DEFAULT_SCHEDULE, DEFAULT_TEMPLATES } from './data/exercises.js';
import { FOOD_BY_ID } from './data/foods.js';
import { DEFAULT_INCLUDE } from './ai.js';
import { bmr, dayEnergy, seriesFor, latestOf } from './calc.js';
import { ageFrom, addDays, todayStr, sum } from './util.js';

export const state = { profile: null, settings: null };

export const DEFAULT_SETTINGS = {
  id: 'main', pal: 1.3, theme: 'auto', aiInclude: { ...DEFAULT_INCLUDE }, schedule: DEFAULT_SCHEDULE,
  favorites: [], lastBackupAt: null, backupReminder: true, templatesSeeded: false,
};

export async function loadState() {
  state.profile = (await db.get('user_profile', 'me')) || null;
  state.settings = { ...DEFAULT_SETTINGS, ...((await db.get('app_settings', 'main')) || {}) };
  state.settings.aiInclude = { ...DEFAULT_INCLUDE, ...state.settings.aiInclude };
  if (!state.settings.templatesSeeded) await seedTemplates();
}
export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch, id: 'main' };
  await db.put('app_settings', state.settings);
}
export async function saveProfile(p) {
  state.profile = await db.put('user_profile', { ...p, id: 'me' });
  return state.profile;
}

/** Salin templat bawaan ke IndexedDB sekali (agar set/repetisi bisa diubah). Tidak menimpa templat yang sudah ada. */
export async function seedTemplates() {
  for (const t of DEFAULT_TEMPLATES) {
    if (await db.get('workout_templates', t.id)) continue;
    await db.put('workout_templates', { id: t.id, name: t.name, desc: t.desc, builtin: true });
    await db.putMany('template_exercises', t.items.map(([exerciseId, sets, reps], i) => ({ id: `${t.id}-${i}`, templateId: t.id, exerciseId, order: i, sets, reps })));
  }
  await saveSettings({ templatesSeeded: true });
}

// ---------------- Data kesehatan ----------------
export async function healthData() {
  const [measurements, mcus] = await Promise.all([db.all('health_measurements'), db.all('mcu_records')]);
  return { measurements, mcus };
}
export async function currentWeight(onDate) {
  const { measurements, mcus } = await healthData();
  const s = seriesFor('weight', measurements, mcus).filter((x) => !onDate || x.date <= onDate);
  return latestOf(s)?.value ?? null;
}

// ---------------- Makanan ----------------
export async function getFood(id) {
  const custom = await db.get('custom_foods', id);
  if (custom) return custom;
  const ov = await db.get('food_database', id); // koreksi pengguna terhadap data bawaan
  return ov ? { ...FOOD_BY_ID[id], ...ov } : FOOD_BY_ID[id] || null;
}
export async function allFoods() {
  const [custom, overrides] = await Promise.all([db.all('custom_foods'), db.all('food_database')]);
  const ov = Object.fromEntries(overrides.map((o) => [o.id, o]));
  const base = Object.values(FOOD_BY_ID).map((f) => (ov[f.id] ? { ...f, ...ov[f.id] } : f));
  return [...custom.map((c) => ({ ...c, custom: true })), ...base];
}

/** Ambil/buat jurnal (tanggal+waktu makan) lalu tambahkan satu item. */
export async function addFoodItem(date, meal, data) {
  const log = (await db.byDate('food_logs', date)).find((l) => l.meal === meal) || (await db.put('food_logs', { date, meal }));
  return db.put('food_log_items', { logId: log.id, date, meal, ...data });
}

// ---------------- Energi ----------------
export function bmrFor(weightKg, onDate) {
  const p = state.profile;
  if (!p || !weightKg || !p.birthDate || !p.heightCm) return null;
  return bmr({ sex: p.sex, weightKg, heightCm: p.heightCm, age: ageFrom(p.birthDate, onDate) });
}
export async function energyFor(dates) {
  const from = dates[0], to = dates[dates.length - 1];
  const [items, acts, sess] = await Promise.all([db.range('food_log_items', from, to), db.range('activity_logs', from, to), db.range('workout_sessions', from, to)]);
  const { measurements, mcus } = await healthData();
  const wSeries = seriesFor('weight', measurements, mcus);
  return dates.map((d) => {
    const w = latestOf(wSeries.filter((x) => x.date <= d))?.value ?? latestOf(wSeries)?.value ?? null;
    const di = items.filter((i) => i.date === d);
    const e = dayEnergy({ items: di, activities: acts.filter((a) => a.date === d), sessions: sess.filter((s) => s.date === d), bmrKcal: bmrFor(w, d), pal: state.settings.pal });
    return { date: d, hasFood: di.length > 0, ...e, weight: w };
  });
}

// ---------------- Konteks AI ----------------
export async function aiData(from, to, today = todayStr()) {
  const [measurements, mcus, foodItems, activities, sessions, sleep] = await Promise.all([
    db.all('health_measurements'), db.all('mcu_records'), db.range('food_log_items', from, to),
    db.range('activity_logs', from, to), db.range('workout_sessions', from, to), db.range('sleep_logs', from, to),
  ]);
  const [exLogs, setLogs] = await Promise.all([db.all('exercise_logs'), db.all('set_logs')]);
  const sess = sessions.map((s) => ({
    ...s,
    exercises: exLogs.filter((e) => e.sessionId === s.id).sort((a, b) => a.order - b.order).map((e) => ({
      name: e.name, target: `${e.targetSets}x${e.targetReps}`,
      actual: setLogs.filter((x) => x.exerciseLogId === e.id).sort((a, b) => a.setNo - b.setNo).filter((x) => x.actual != null).map((x) => x.actual),
    })),
  }));
  const dates = []; for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  const energy = (await energyFor(dates)).filter((e) => e.hasFood || e.exercise).map((e) => ({ date: e.date, in: Math.round(e.in.confirmed.kcal), out: e.out?.total ?? null }));
  return { today, profile: state.profile, measurements, mcus, foodItems, activities, sessions: sess, sleep, energy };
}

export const totalKcalOut = (e) => (e.out ? e.out.total : null);
export { sum };
