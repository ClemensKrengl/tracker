import { state, save, uid } from '../store.js';
import { today, addDays, lastDays, relDay, fmtDay, fmtShort, weekdayLetter, sum, fmt, num, esc } from '../stats.js';
import { ring, meter, bars, line } from '../charts.js';
import { openSheet, closeSheet, refresh, toast, field, stat, formData } from '../ui.js';

let day = today();

const kcalOn = (d) => sum(state.foods.filter((f) => f.date === d), (f) => f.kcal);
const signed = (n, dec = 1) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n), dec);

export function render() {
  const s = state.settings;
  const entries = state.foods.filter((f) => f.date === day);
  const kcal = sum(entries, (f) => f.kcal);
  const left = s.kcalGoal - kcal;

  const macros = [
    ['Protein', sum(entries, (f) => f.protein), s.proteinGoal],
    ['Carbs', sum(entries, (f) => f.carbs), s.carbsGoal],
    ['Fat', sum(entries, (f) => f.fat), s.fatGoal],
  ];

  return `
  <header class="daynav">
    <button class="icon" data-action="prev" aria-label="Previous day"><svg viewBox="0 0 24 24"><path d="M14.5 6l-6 6 6 6"/></svg></button>
    <button class="daylabel" data-action="today">
      <b>${relDay(day)}</b>
      <span>${day === today() ? fmtDay(day) : 'Tap for today'}</span>
    </button>
    <button class="icon" data-action="next" aria-label="Next day"><svg viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6"/></svg></button>
  </header>

  <section class="summary">
    <div class="ringwrap">
      ${ring(kcal, s.kcalGoal)}
      <div class="ringtext">
        <b>${s.kcalGoal ? fmt(Math.abs(left)) : fmt(kcal)}</b>
        <span>${s.kcalGoal ? (left >= 0 ? 'kcal left' : 'kcal over') : 'kcal'}</span>
      </div>
    </div>
    <dl class="pairs">
      <div><dt>Eaten</dt><dd>${fmt(kcal)}</dd></div>
      <div><dt>Goal</dt><dd>${s.kcalGoal ? fmt(s.kcalGoal) : '–'}</dd></div>
    </dl>
  </section>

  <section class="macros">
    ${macros.map(([name, v, goal]) => `
      <div class="macro">
        <div class="row"><span>${name}</span><span class="n">${fmt(v)}${goal ? ` <i>/ ${fmt(goal)}</i>` : ''} g</span></div>
        ${meter(v, goal)}
      </div>`).join('')}
  </section>

  <div class="addrow">
    <button class="btn primary" data-action="add">Add food</button>
    <button class="btn" data-action="paste">Paste JSON</button>
  </div>

  <section>
    <h2>Logged</h2>
    ${entries.length ? `<ul class="list">${entries.map((f) => `
      <li><button data-action="edit" data-id="${f.id}">
        <div><b>${esc(f.name)}</b><span>P ${fmt(f.protein)} · C ${fmt(f.carbs)} · F ${fmt(f.fat)}</span></div>
        <em>${fmt(f.kcal)}</em>
      </button></li>`).join('')}</ul>`
    : `<p class="empty">Nothing logged ${day === today() ? 'yet today' : 'on this day'}.</p>`}
  </section>

  ${weightSection()}
  ${weekSection()}`;
}

function weightSection() {
  const s = state.settings;
  const sorted = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const onDay = sorted.find((w) => w.date === day);

  let sub = 'Log your weight to see the trend.';
  if (latest) {
    const parts = [];
    const cutoff = addDays(latest.date, -7);
    const prev = [...sorted].reverse().find((w) => w.date <= cutoff);
    if (prev) parts.push(`${signed(latest.kg - prev.kg)} kg since ${fmtShort(prev.date)}`);
    if (s.goalWeight) {
      const diff = latest.kg - s.goalWeight;
      parts.push(Math.abs(diff) < 0.05 ? 'at goal' : `${fmt(Math.abs(diff), 1)} kg to goal`);
    }
    sub = parts.join(' · ') || `Last logged ${fmtShort(latest.date)}`;
  }

  const days = lastDays(30);
  const points = sorted.filter((w) => w.date >= days[0] && w.date <= days[29])
    .map((w) => ({ i: days.indexOf(w.date), value: w.kg, tip: `${fmtDay(w.date)} · ${fmt(w.kg, 1)} kg` }));

  return `
  <section>
    <h2>Weight</h2>
    ${latest ? `<div class="hero">
      <b>${fmt(latest.kg, 1)}<i> kg</i></b>
      <span>${esc(sub)}</span>
    </div>` : `<p class="hint">${esc(sub)}</p>`}
    <form class="inline" data-form="weight">
      ${field({ label: `Weight ${day === today() ? 'today' : 'on ' + fmtShort(day)}`, name: 'kg', value: onDay ? onDay.kg : '', unit: 'kg', placeholder: latest ? fmt(latest.kg, 1) : '' })}
      <button class="btn" type="submit">Save</button>
    </form>
    ${points.length >= 2 ? line({
      points, count: 30,
      goal: s.goalWeight || null, goalLabel: s.goalWeight ? `Goal ${fmt(s.goalWeight, 1)}` : '',
      readout: 'Last 30 days', startLabel: fmtShort(days[0]), endLabel: 'Today',
    }) : ''}
  </section>`;
}

function weekSection() {
  const s = state.settings;
  const days = lastDays(7);
  const totals = days.map(kcalOn);
  const avg = (list) => {
    const logged = list.filter((v) => v > 0);
    return logged.length ? sum(logged, (v) => v) / logged.length : null;
  };
  const month = lastDays(30).map(kcalOn);
  // "on target" = within 10% of the goal
  const onTarget = s.kcalGoal ? totals.filter((v) => v > 0 && Math.abs(v - s.kcalGoal) <= s.kcalGoal * 0.1).length : null;

  return `
  <section>
    <h2>Last 7 days</h2>
    ${bars({
      items: days.map((d, i) => ({
        label: weekdayLetter(d),
        tip: `${fmtDay(d)} · ${fmt(totals[i])} kcal`,
        segments: [{ value: totals[i], color: s.kcalGoal && totals[i] > s.kcalGoal * 1.1 ? 'var(--over)' : 'var(--accent)' }],
      })),
      goal: s.kcalGoal, goalLabel: s.kcalGoal ? `Goal ${fmt(s.kcalGoal)}` : '',
      readout: 'Tap a bar for the day’s total',
    })}
    <div class="stats">
      ${stat(fmt(avg(totals)), '7-day avg')}
      ${stat(fmt(avg(month)), '30-day avg')}
      ${stat(onTarget == null ? '–' : `${onTarget}<i>/7</i>`, 'within 10%')}
    </div>
  </section>`;
}

export function handle(action, el) {
  if (action === 'prev') day = addDays(day, -1);
  else if (action === 'next') day = addDays(day, 1);
  else if (action === 'today') day = today();
  else if (action === 'add') return foodSheet();
  else if (action === 'paste') return pasteSheet();
  else if (action === 'edit') return foodSheet(state.foods.find((f) => f.id === el.dataset.id));
  refresh();
}

export function submit(form) {
  if (form.dataset.form !== 'weight') return;
  const kg = num(formData(form).kg);
  state.weights = state.weights.filter((w) => w.date !== day);
  if (kg && kg > 0) state.weights.push({ date: day, kg });
  save();
  refresh();
  toast(kg ? `Weight saved: ${fmt(kg, 1)} kg` : 'Weight removed');
}

// Most recent version of each distinct food name, for one-tap re-logging.
function knownFoods() {
  const seen = new Map();
  for (let i = state.foods.length - 1; i >= 0; i--) {
    const f = state.foods[i];
    const key = f.name.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, f);
  }
  return [...seen.values()];
}

function foodSheet(entry) {
  const known = knownFoods();
  openSheet(`
    <h2>${entry ? 'Edit food' : 'Add food'}</h2>
    <form id="food-form">
      ${field({ label: 'Name', name: 'name', value: entry?.name, mode: 'text', placeholder: 'e.g. Oats with milk', focus: !entry })}
      <div class="chips" id="suggest"></div>
      ${field({ label: 'Calories', name: 'kcal', value: entry?.kcal, unit: 'kcal' })}
      <div class="cols3">
        ${field({ label: 'Protein', name: 'protein', value: entry?.protein || '', unit: 'g' })}
        ${field({ label: 'Carbs', name: 'carbs', value: entry?.carbs || '', unit: 'g' })}
        ${field({ label: 'Fat', name: 'fat', value: entry?.fat || '', unit: 'g' })}
      </div>
      <div class="actions">
        ${entry ? '<button type="button" class="btn danger" id="food-del">Delete</button>' : '<button type="button" class="btn" data-close>Cancel</button>'}
        <button type="submit" class="btn primary">Save</button>
      </div>
    </form>`, (el) => {
    const form = el.querySelector('#food-form');
    const box = el.querySelector('#suggest');
    const estimate = () => {
      const d = formData(form);
      return Math.round((num(d.protein) || 0) * 4 + (num(d.carbs) || 0) * 4 + (num(d.fat) || 0) * 9);
    };

    const suggest = () => {
      if (entry) return;
      const q = form.name.value.trim().toLowerCase();
      const hits = known.filter((f) => f.name.toLowerCase().includes(q) && f.name.toLowerCase() !== q).slice(0, 5);
      box.innerHTML = hits.map((f) => `<button type="button" data-pick="${f.id}">${esc(f.name)} <i>${fmt(f.kcal)}</i></button>`).join('');
    };
    suggest();

    box.onclick = (e) => {
      const f = known.find((k) => k.id === e.target.closest('[data-pick]')?.dataset.pick);
      if (!f) return;
      form.name.value = f.name;
      form.kcal.value = f.kcal;
      form.protein.value = f.protein || '';
      form.carbs.value = f.carbs || '';
      form.fat.value = f.fat || '';
      box.innerHTML = '';
    };

    form.oninput = (e) => {
      if (e.target.name === 'name') suggest();
      else form.kcal.placeholder = estimate() ? `≈ ${estimate()}` : '';
    };

    form.onsubmit = (e) => {
      e.preventDefault();
      const d = formData(form);
      const kcal = num(d.kcal) ?? estimate();
      if (!kcal || kcal < 0) { form.kcal.focus(); return toast('Enter calories or macros'); }
      const data = {
        name: d.name.trim() || 'Food',
        kcal: Math.round(kcal),
        protein: num(d.protein) || 0,
        carbs: num(d.carbs) || 0,
        fat: num(d.fat) || 0,
      };
      if (entry) Object.assign(entry, data);
      else state.foods.push({ id: uid(), date: day, ...data });
      save();
      closeSheet();
      refresh();
    };

    const del = el.querySelector('#food-del');
    if (del) del.onclick = () => {
      const idx = state.foods.indexOf(entry);
      state.foods.splice(idx, 1);
      save(); closeSheet(); refresh();
      toast(`Deleted ${entry.name}`, () => { state.foods.splice(idx, 0, entry); save(); refresh(); });
    };
  });
}

// The prompt to give Claude along with a food photo; its reply pastes straight in.
const CLAUDE_PROMPT = `Estimate the nutrition of the food in this photo. Reply with only a JSON array in a code block, no other text. Use one object per distinct food item with exactly these keys: "name" (short string), "kcal" (number), "protein", "carbs", "fat" (numbers, in grams). Example:
[{"name": "Oats with milk", "kcal": 420, "protein": 18, "carbs": 60, "fat": 9}]`;

// Accepts one object or an array, with or without a code fence or text around it.
export function parseFoods(text) {
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
  if (start < 0 || end < start) return { items: [], error: 'No JSON found yet.' };
  let raw;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { items: [], error: 'That is not valid JSON.' };
  }
  if (raw && !Array.isArray(raw)) raw = raw.foods || raw.items || [raw];
  if (!Array.isArray(raw)) return { items: [], error: 'Expected a list of foods.' };

  const pick = (o, ...keys) => {
    for (const k of keys) if (o[k] != null && num(o[k]) != null) return Math.max(0, num(o[k]));
    return 0;
  };
  const items = [];
  for (const o of raw) {
    if (!o || typeof o !== 'object') continue;
    const protein = pick(o, 'protein', 'protein_g');
    const carbs = pick(o, 'carbs', 'carbs_g', 'carbohydrates');
    const fat = pick(o, 'fat', 'fat_g');
    const kcal = Math.round(pick(o, 'kcal', 'calories', 'kcals') || protein * 4 + carbs * 4 + fat * 9);
    if (!kcal) continue;
    items.push({ name: String(o.name ?? o.food ?? '').trim() || 'Food', kcal, protein, carbs, fat });
  }
  return items.length ? { items } : { items, error: 'No foods with calories found.' };
}

function pasteSheet() {
  openSheet(`
    <h2>Paste food JSON</h2>
    <p class="lead">Send Claude a photo with the prompt below, then paste its reply here.</p>
    <button type="button" class="btn wide" id="copy-prompt">Copy prompt for Claude</button>
    <form id="paste-form">
      <label class="field">
        <span>JSON</span>
        <textarea name="json" rows="6" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"
          placeholder='[{"name": "Oats with milk", "kcal": 420, "protein": 18, "carbs": 60, "fat": 9}]'></textarea>
      </label>
      <div id="paste-preview"></div>
      <div class="actions">
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="submit" class="btn primary" id="paste-go" disabled>Add</button>
      </div>
    </form>`, (el) => {
    const form = el.querySelector('#paste-form');
    const preview = el.querySelector('#paste-preview');
    const go = el.querySelector('#paste-go');
    let items = [];

    const update = () => {
      const text = form.json.value.trim();
      const res = text ? parseFoods(text) : { items: [] };
      items = res.items;
      go.disabled = !items.length;
      go.textContent = items.length ? `Add ${items.length} to ${relDay(day).toLowerCase()}` : 'Add';
      preview.innerHTML = items.length
        ? `<ul class="list compact">${items.map((f) => `
            <li><div class="item">
              <div><b>${esc(f.name)}</b><span>P ${fmt(f.protein)} · C ${fmt(f.carbs)} · F ${fmt(f.fat)}</span></div>
              <em>${fmt(f.kcal)}</em>
            </div></li>`).join('')}</ul>`
        : (res.error ? `<p class="hint">${esc(res.error)}</p>` : '');
    };
    form.oninput = update;

    el.querySelector('#copy-prompt').onclick = () => {
      (navigator.clipboard?.writeText(CLAUDE_PROMPT) ?? Promise.reject())
        .then(() => toast('Prompt copied'))
        .catch(() => toast('Could not copy here'));
    };

    form.onsubmit = (e) => {
      e.preventDefault();
      if (!items.length) return;
      const added = items.map((f) => ({ id: uid(), date: day, ...f }));
      state.foods.push(...added);
      save(); closeSheet(); refresh();
      toast(`${added.length} ${added.length === 1 ? 'food' : 'foods'} added`, () => {
        state.foods = state.foods.filter((f) => !added.includes(f));
        save(); refresh();
      });
    };
  });
}
