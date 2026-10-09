import { state, save, uid, exportJSON, importJSON, resetAll } from '../store.js';
import { today, num, esc } from '../stats.js';
import { refresh, toast, confirmSheet, field } from '../ui.js';

const goal = (label, key, unit) => field({
  label, name: key, value: state.settings[key] ?? '', unit, attrs: `data-key="${key}"`,
});

export function render() {
  const s = state.settings;
  return `
  <header class="title"><h1>Settings</h1></header>

  <section>
    <h2>Nutrition goals</h2>
    ${goal('Daily calories', 'kcalGoal', 'kcal')}
    <div class="cols3">
      ${goal('Protein', 'proteinGoal', 'g')}
      ${goal('Carbs', 'carbsGoal', 'g')}
      ${goal('Fat', 'fatGoal', 'g')}
    </div>
  </section>

  <section>
    <h2>Weight</h2>
    <div class="cols2">
      ${goal('Start weight', 'startWeight', 'kg')}
      ${goal('Goal weight', 'goalWeight', 'kg')}
    </div>
  </section>

  <section>
    <h2>Running goals</h2>
    <div class="cols2">
      ${goal('Weekly distance', 'runWeeklyKm', 'km')}
      ${goal('Runs per week', 'runWeeklyCount', '')}
    </div>
  </section>

  <section>
    <h2>Exercises</h2>
    ${s.exercises.map((ex) => `
    <div class="exedit">
      <div class="exname">
        ${field({ label: 'Name', name: `n-${ex.id}`, value: ex.name, mode: 'text', attrs: `data-ex="${ex.id}" data-f="name"` })}
        <button class="icon" data-action="remove" data-id="${ex.id}" aria-label="Remove ${esc(ex.name)}"><svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg></button>
      </div>
      <div class="cols2">
        ${field({ label: 'Weekly goal', name: `g-${ex.id}`, value: ex.weeklyRepsGoal || '', unit: 'reps', mode: 'numeric', attrs: `data-ex="${ex.id}" data-f="weeklyRepsGoal"` })}
        <label class="switch">
          <span>Track weight</span>
          <input type="checkbox" data-ex="${ex.id}" data-f="usesWeight" ${ex.usesWeight ? 'checked' : ''}>
          <i aria-hidden="true"></i>
        </label>
      </div>
    </div>`).join('')}
    <button class="btn wide" data-action="add-ex">Add exercise</button>
  </section>

  <section>
    <h2>Data</h2>
    <p class="hint">Everything is stored on this device only. Export a backup now and then.</p>
    <div class="cols2">
      <button class="btn" data-action="export">Export backup</button>
      <label class="btn filebtn">Import backup<input type="file" accept="application/json,.json" data-import></label>
    </div>
    <button class="btn wide danger" data-action="reset">Erase all data</button>
  </section>`;
}

export function handle(action, el) {
  const s = state.settings;
  if (action === 'add-ex') {
    const ex = { id: uid(), name: 'New exercise', usesWeight: false, weeklyRepsGoal: 100 };
    s.exercises.push(ex);
    save(); refresh();
    const input = document.querySelector(`[data-ex="${ex.id}"][data-f="name"]`);
    input?.focus(); input?.select();
  } else if (action === 'remove') {
    const ex = s.exercises.find((x) => x.id === el.dataset.id);
    const n = state.sets.filter((x) => x.exerciseId === ex.id).length;
    confirmSheet({
      title: `Remove ${ex.name}?`,
      text: n ? `This also deletes its ${n} logged ${n === 1 ? 'set' : 'sets'}.` : 'No sets have been logged for it yet.',
      action: 'Remove',
      onConfirm: () => {
        s.exercises = s.exercises.filter((x) => x !== ex);
        state.sets = state.sets.filter((x) => x.exerciseId !== ex.id);
        save(); refresh();
      },
    });
  } else if (action === 'export') {
    const url = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `tracker-backup-${today()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else if (action === 'reset') {
    confirmSheet({
      title: 'Erase all data?',
      text: 'Food, weight, runs, workouts and goals are deleted from this device. This cannot be undone.',
      action: 'Erase everything',
      onConfirm: () => { resetAll(); refresh(); toast('All data erased'); },
    });
  }
}

// Settings save as you type; no re-render, so the keyboard and focus stay put.
export function change(el) {
  const s = state.settings;
  if (el.dataset.key) {
    const v = num(el.value);
    s[el.dataset.key] = v != null && v > 0 ? v : null;
    save();
  } else if (el.dataset.ex) {
    const ex = s.exercises.find((x) => x.id === el.dataset.ex);
    const f = el.dataset.f;
    if (f === 'name') ex.name = el.value.trim() || 'Exercise';
    else if (f === 'usesWeight') ex.usesWeight = el.checked;
    else ex.weeklyRepsGoal = Math.round(num(el.value) || 0);
    save();
  } else if ('import' in el.dataset && el.files[0]) {
    el.files[0].text().then((text) => {
      importJSON(text);
      refresh();
      toast('Backup imported');
    }).catch(() => toast('That file is not a tracker backup'));
  }
}
