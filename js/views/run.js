import { state, save, uid, RUN_TYPES } from '../store.js';
import { today, addDays, weekStart, lastWeeks, relDay, fmtShort, sum, fmt, num, esc, parseDuration, fmtDuration, fmtPace } from '../stats.js';
import { meter, bars, legend } from '../charts.js';
import { openSheet, closeSheet, refresh, toast, field, stat, formData } from '../ui.js';

const COLORS = {
  Intervals: 'var(--c-intervals)',
  Longrun: 'var(--c-longrun)',
  'Zone 2': 'var(--c-zone2)',
  Other: 'var(--c-other)',
};

let range = '8w'; // '8w' | 'all'
let showAll = false;

export function render() {
  const s = state.settings;
  const runs = [...state.runs].sort((a, b) => b.date.localeCompare(a.date));
  const wk = weekStart(today());
  const thisWeek = runs.filter((r) => r.date >= wk && r.date < addDays(wk, 7));
  const weekKm = sum(thisWeek, (r) => r.km);

  const weeks = lastWeeks(8);
  const inWeek = (w) => runs.filter((r) => r.date >= w && r.date < addDays(w, 7));

  const scoped = range === 'all' ? runs : runs.filter((r) => r.date >= weeks[0]);
  const timed = scoped.filter((r) => r.seconds && r.km);
  const longest = scoped.reduce((best, r) => (!best || r.km > best.km ? r : best), null);
  const fastest = timed.filter((r) => r.km >= 1).reduce((best, r) => (!best || r.seconds / r.km < best.seconds / best.km ? r : best), null);

  const visible = showAll ? runs : runs.slice(0, 8);

  return `
  <header class="title"><h1>Running</h1></header>

  <section class="goals">
    <div class="goal">
      <div class="row"><span>Distance this week</span><span class="n">${fmt(weekKm, 1)}${s.runWeeklyKm ? ` <i>/ ${fmt(s.runWeeklyKm, 1)}</i>` : ''} km</span></div>
      ${meter(weekKm, s.runWeeklyKm)}
    </div>
    <div class="goal">
      <div class="row"><span>Runs this week</span><span class="n">${thisWeek.length}${s.runWeeklyCount ? ` <i>/ ${fmt(s.runWeeklyCount)}</i>` : ''}</span></div>
      ${meter(thisWeek.length, s.runWeeklyCount)}
    </div>
  </section>

  <button class="btn primary wide" data-action="add">Log run</button>

  <section>
    <h2>Last 8 weeks</h2>
    ${bars({
      items: weeks.map((w) => {
        const list = inWeek(w);
        return {
          label: fmtShort(w).replace(' ', ' '),
          tip: `Week of ${fmtShort(w)} · ${fmt(sum(list, (r) => r.km), 1)} km · ${list.length} ${list.length === 1 ? 'run' : 'runs'}`,
          segments: RUN_TYPES.map((t) => ({ value: sum(list.filter((r) => r.type === t), (r) => r.km), color: COLORS[t] })),
        };
      }),
      goal: s.runWeeklyKm, goalLabel: s.runWeeklyKm ? `Goal ${fmt(s.runWeeklyKm, 1)} km` : '',
      readout: 'Kilometres per week, by type',
    })}
    ${legend(RUN_TYPES.map((t) => ({ name: t, color: COLORS[t] })))}
  </section>

  <section>
    <div class="headrow">
      <h2>Statistics</h2>
      <div class="seg" role="group" aria-label="Period">
        <button data-action="range" data-v="8w" aria-pressed="${range === '8w'}">8 weeks</button>
        <button data-action="range" data-v="all" aria-pressed="${range === 'all'}">All time</button>
      </div>
    </div>
    <div class="stats">
      ${stat(`${fmt(sum(scoped, (r) => r.km), 1)}<i> km</i>`, `${scoped.length} ${scoped.length === 1 ? 'run' : 'runs'}`)}
      ${stat(longest ? `${fmt(longest.km, 1)}<i> km</i>` : '–', 'longest')}
      ${stat(fastest ? `${fmtPace(fastest.seconds, fastest.km)}<i> /km</i>` : '–', 'best pace')}
    </div>
    <table class="table">
      <thead><tr><th>Type</th><th>Runs</th><th>km</th><th>Avg pace</th></tr></thead>
      <tbody>
      ${RUN_TYPES.map((t) => {
        const list = scoped.filter((r) => r.type === t);
        const tl = list.filter((r) => r.seconds && r.km);
        return `<tr>
          <td><i class="key" style="background:${COLORS[t]}"></i>${t}</td>
          <td>${list.length}</td>
          <td>${fmt(sum(list, (r) => r.km), 1)}</td>
          <td>${fmtPace(sum(tl, (r) => r.seconds), sum(tl, (r) => r.km))}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
  </section>

  <section>
    <h2>History</h2>
    ${runs.length ? `<ul class="list">${visible.map((r) => `
      <li><button data-action="edit" data-id="${r.id}">
        <div><b><i class="key" style="background:${COLORS[r.type]}"></i>${esc(r.type)}</b>
          <span>${relDay(r.date)}${r.seconds ? ` · ${fmtDuration(r.seconds)} · ${fmtPace(r.seconds, r.km)} /km` : ''}${r.note ? ` · ${esc(r.note)}` : ''}</span></div>
        <em>${fmt(r.km, 2)}<i> km</i></em>
      </button></li>`).join('')}</ul>
      ${runs.length > 8 && !showAll ? `<button class="btn wide quiet" data-action="more">Show all ${runs.length} runs</button>` : ''}`
    : '<p class="empty">No runs logged yet.</p>'}
  </section>`;
}

export function handle(action, el) {
  if (action === 'add') return runSheet();
  if (action === 'edit') return runSheet(state.runs.find((r) => r.id === el.dataset.id));
  if (action === 'range') range = el.dataset.v;
  if (action === 'more') showAll = true;
  refresh();
}

function runSheet(entry) {
  openSheet(`
    <h2>${entry ? 'Edit run' : 'Log run'}</h2>
    <form id="run-form">
      <label class="field">
        <span>Type</span>
        <div class="input select">
          <select name="type">
            ${RUN_TYPES.map((t) => `<option${(entry?.type || 'Zone 2') === t ? ' selected' : ''}>${t}</option>`).join('')}
          </select>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>
        </div>
      </label>
      <div class="cols2">
        ${field({ label: 'Distance', name: 'km', value: entry?.km, unit: 'km', focus: !entry })}
        ${field({ label: 'Time', name: 'time', value: entry?.seconds ? fmtDuration(entry.seconds) : '', mode: 'text', placeholder: 'mm:ss' })}
      </div>
      <p class="hint" id="pace">&nbsp;</p>
      ${field({ label: 'Date', name: 'date', type: 'date', value: entry?.date || today(), attrs: `max="${today()}"` })}
      ${field({ label: 'Note', name: 'note', value: entry?.note, mode: 'text', placeholder: 'Optional' })}
      <div class="actions">
        ${entry ? '<button type="button" class="btn danger" id="run-del">Delete</button>' : '<button type="button" class="btn" data-close>Cancel</button>'}
        <button type="submit" class="btn primary">Save</button>
      </div>
    </form>`, (el) => {
    const form = el.querySelector('#run-form');
    const pace = el.querySelector('#pace');
    const showPace = () => {
      const km = num(form.km.value), sec = parseDuration(form.time.value);
      pace.textContent = km && sec ? `Pace ${fmtPace(sec, km)} /km` : ' ';
    };
    showPace();
    form.oninput = showPace;

    form.onsubmit = (e) => {
      e.preventDefault();
      const d = formData(form);
      const km = num(d.km);
      if (!km || km <= 0) { form.km.focus(); return toast('Enter a distance'); }
      const seconds = d.time.trim() ? parseDuration(d.time) : null;
      if (d.time.trim() && !seconds) { form.time.focus(); return toast('Time looks off, use mm:ss or h:mm:ss'); }
      const data = { date: d.date || today(), type: d.type, km, seconds, note: d.note.trim() };
      if (entry) Object.assign(entry, data);
      else state.runs.push({ id: uid(), ...data });
      save();
      closeSheet();
      refresh();
    };

    const del = el.querySelector('#run-del');
    if (del) del.onclick = () => {
      const idx = state.runs.indexOf(entry);
      state.runs.splice(idx, 1);
      save(); closeSheet(); refresh();
      toast('Run deleted', () => { state.runs.splice(idx, 0, entry); save(); refresh(); });
    };
  });
}
