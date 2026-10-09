const KEY = 'tracker.v1';

export const RUN_TYPES = ['Intervals', 'Longrun', 'Zone 2', 'Other'];

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaults() {
  return {
    version: 1,
    settings: {
      kcalGoal: 2200,
      proteinGoal: 140,
      carbsGoal: 250,
      fatGoal: 70,
      startWeight: null,
      goalWeight: null,
      runWeeklyKm: 20,
      runWeeklyCount: 3,
      exercises: [
        { id: 'pushups', name: 'Push ups', usesWeight: false, weeklyRepsGoal: 200 },
        { id: 'pullups', name: 'Pull ups', usesWeight: false, weeklyRepsGoal: 60 },
        { id: 'curls', name: 'Biceps curls', usesWeight: true, weeklyRepsGoal: 90 },
      ],
    },
    foods: [],
    weights: [],
    runs: [],
    sets: [],
  };
}

// Fills anything missing so older or hand-edited exports still load.
function normalize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const s = { ...d.settings, ...(raw.settings || {}) };
  if (!Array.isArray(s.exercises)) s.exercises = d.settings.exercises;
  const list = (v) => (Array.isArray(v) ? v : []);
  return {
    version: 1,
    settings: s,
    foods: list(raw.foods),
    weights: list(raw.weights),
    runs: list(raw.runs),
    sets: list(raw.sets),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : defaults();
  } catch {
    return defaults();
  }
}

export let state = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== 'object' || !raw.settings) throw new Error('Not a tracker backup');
  state = normalize(raw);
  save();
}

export function resetAll() {
  state = defaults();
  save();
}
