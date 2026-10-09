import { state, save, uid } from '../store.js';
import { today, addDays, weekStart, lastWeeks, relDay, fmtShort, sum, fmt, num, esc, streak } from '../stats.js';
import { meter, bars } from '../charts.js';
import { openSheet, closeSheet, refresh, toast, field, stat, formData } from '../ui.js';

const setsOf = (id) => state.sets.filter((x) => x.exerciseId === id);
const lastKg = (id) => [...setsOf(id)].reverse().find((x) => x.kg)?.kg ?? null;

function log(ex, reps, kg, date = today()) {
  const entry = { id: uid(), date, exerciseId: ex.id, reps };
  if (ex.usesWeight && kg) entry.kg = kg;
  state.sets.push(entry);
  save();
  refresh();
  toast(`${reps} ${ex.name.toLowerCase()} logged`, () => {
    state.sets = state.sets.filter((x) => x !== entry);
    save(); refresh();
  });
}

export function render() {
  const exercises = state.settings.exercises;
  const wk = weekStart(today());
  const week = state.sets.filter((x) => x.date >= wk && x.date < addDays(wk, 7));
  const hit = exercises.filter((ex) => ex.weeklyRepsGoal && sum(week.filter((x) => x.exerciseId === ex.id), (x) => x.reps) >= ex.weeklyRepsGoal).length;
  const withGoal = exercises.filter((ex) => ex.weeklyRepsGoal).length;

  return `
  <header class="title"><h1>Workouts</h1></header>

  <div class="stats">
    ${stat(week.length, week.length === 1 ? 'set this week' : 'sets this week')}
    ${stat(`${new Set(week.map((x) => x.date)).size}<i>/7</i>`, 'active days')}
    ${stat(withGoal ? `${hit}<i>/${withGoal}</i>` : '–', 'goals reached')}
  </div>

  ${exercises.length ? exercises.map((ex) => {
    const mine = setsOf(ex.id);
    const todayReps = sum(mine.filter((x) => x.date === today()), (x) => x.reps);
    const weekReps = sum(mine.filter((x) => x.date >= wk), (x) => x.reps);
    const kg = ex.usesWeight ? lastKg(ex.id) : null;
    return `
    <section class="exercise">
      <button class="exhead" data-action="detail" data-id="${ex.id}">
        <div><b>${esc(ex.name)}</b><span>${todayReps ? `${todayReps} today` : 'None today'}${kg ? ` · ${fmt(kg, 1)} kg` : ''}</span></div>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 6l6 6-6 6"/></svg>
      </button>
      <div class="row"><span>This week</span><span class="n">${weekReps}${ex.weeklyRepsGoal ? ` <i>/ ${ex.weeklyRepsGoal}</i>` : ''} reps</span></div>
      ${meter(weekReps, ex.weeklyRepsGoal)}
      <div class="quick">
        <button class="btn" data-action="quick" data-id="${ex.id}" data-reps="5">+5</button>
        <button class="btn" data-action="quick" data-id="${ex.id}" data-reps="10">+10</button>
        <button class="btn" data-action="quick" data-id="${ex.id}" data-reps="20">+20</button>
        <button class="btn" data-action="custom" data-id="${ex.id}">Other</button>
      </div>
    </section>`;
  }).join('') : '<p class="empty">No exercises yet. Add some in Settings.</p>'}`;
}

export function handle(action, el) {
  const ex = state.settings.exercises.find((x) => x.id === el.dataset.id);
  if (!ex) return;
  if (action === 'quick') log(ex, Number(el.dataset.reps), lastKg(ex.id));
  else if (action === 'custom') setSheet(ex);
  else if (action === 'detail') detailSheet(ex);
}

function setSheet(ex) {
  openSheet(`
    <h2>${esc(ex.name)}</h2>
    <form id="set-form">
      <div class="${ex.usesWeight ? 'cols2' : ''}">
        ${field({ label: 'Reps', name: 'reps', mode: 'numeric', focus: true })}
        ${ex.usesWeight ? field({ label: 'Weight', name: 'kg', value: lastKg(ex.id) ?? '', unit: 'kg' }) : ''}
      </div>
      ${field({ label: 'Date', name: 'date', type: 'date', value: today(), attrs: `max="${today()}"` })}
      <div class="actions">
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="submit" class="btn primary">Log set</button>
      </div>
    </form>`, (el) => {
    const form = el.querySelector('#set-form');
    form.onsubmit = (e) => {
      e.preventDefault();
      const d = formData(form);
      const reps = Math.round(num(d.reps) || 0);
      if (reps <= 0) { form.reps.focus(); return toast('Enter the number of reps'); }
      closeSheet();
      log(ex, reps, num(d.kg), d.date || today());
    };
  });
}

function detailSheet(ex) {
  const mine = setsOf(ex.id);
  const weeks = lastWeeks(8);
  const perWeek = weeks.map((w) => sum(mine.filter((x) => x.date >= w && x.date < addDays(w, 7)), (x) => x.reps));
  const byDay = new Map();
  for (const x of mine) byDay.set(x.date, (byDay.get(x.date) || 0) + x.reps);
  const bestSet = Math.max(0, ...mine.map((x) => x.reps));
  const bestDay = Math.max(0, ...byDay.values());
  const maxKg = Math.max(0, ...mine.map((x) => x.kg || 0));
  const recent = [...mine].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  openSheet(`
    <h2>${esc(ex.name)}</h2>
    ${bars({
      items: weeks.map((w, i) => ({
        label: fmtShort(w).replace(' ', ' '),
        tip: `Week of ${fmtShort(w)} · ${perWeek[i]} reps`,
        segments: [{ value: perWeek[i], color: 'var(--accent)' }],
      })),
      goal: ex.weeklyRepsGoal, goalLabel: ex.weeklyRepsGoal ? `Goal ${ex.weeklyRepsGoal}` : '',
      readout: 'Reps per week, last 8 weeks',
    })}
    <div class="stats">
      ${stat(bestSet || '–', 'best set')}
      ${stat(bestDay || '–', 'best day')}
      ${stat(`${streak([...byDay.keys()])}<i> d</i>`, 'streak')}
    </div>
    <div class="stats">
      ${stat(sum(mine, (x) => x.reps), 'total reps')}
      ${stat(byDay.size, 'days trained')}
      ${stat(ex.usesWeight && maxKg ? `${fmt(maxKg, 1)}<i> kg</i>` : mine.length, ex.usesWeight && maxKg ? 'heaviest' : 'sets')}
    </div>
    <h3>Recent sets</h3>
    ${recent.length ? `<ul class="list compact">${recent.map((x) => `
      <li><div class="item">
        <div><b>${x.reps} reps${x.kg ? ` · ${fmt(x.kg, 1)} kg` : ''}</b><span>${relDay(x.date)}</span></div>
        <button class="icon" data-del="${x.id}" aria-label="Delete set"><svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg></button>
      </div></li>`).join('')}</ul>` : '<p class="empty">No sets logged yet.</p>'}
    <div class="actions">
      <button type="button" class="btn wide" data-close>Done</button>
    </div>`, (el) => {
    el.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = () => {
        state.sets = state.sets.filter((x) => x.id !== b.dataset.del);
        save(); refresh();
        detailSheet(ex);
      };
    });
  });
}
