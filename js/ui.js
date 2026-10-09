import { esc } from './stats.js';

const $ = (id) => document.getElementById(id);

let refreshFn = () => {};
export function onRefresh(fn) { refreshFn = fn; }
export function refresh() { refreshFn(); }

// --- bottom sheet ---

export function openSheet(html, mount) {
  const sheet = $('sheet');
  sheet.innerHTML = `<div class="grab" aria-hidden="true"></div>${html}`;
  sheet.hidden = false;
  $('scrim').hidden = false;
  $('toast').hidden = true;
  sheet.scrollTop = 0;
  requestAnimationFrame(() => document.body.classList.add('sheet-open'));
  if (mount) mount(sheet);
  // must stay inside the tap handler or iOS will not raise the keyboard
  sheet.querySelector('[data-focus]')?.focus();
}

export function closeSheet() {
  document.body.classList.remove('sheet-open');
  document.activeElement?.blur?.();
  $('sheet').hidden = true;
  $('scrim').hidden = true;
}

export function confirmSheet({ title, text, action, onConfirm }) {
  openSheet(`
    <h2>${esc(title)}</h2>
    <p class="lead">${esc(text)}</p>
    <div class="actions">
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn danger" id="confirm-go">${esc(action)}</button>
    </div>`, (el) => {
    el.querySelector('#confirm-go').onclick = () => { closeSheet(); onConfirm(); };
  });
}

// --- toast ---

let toastTimer;
export function toast(message, undo) {
  const el = $('toast');
  el.innerHTML = `<span>${esc(message)}</span>${undo ? '<button type="button">Undo</button>' : ''}`;
  el.hidden = false;
  if (undo) el.querySelector('button').onclick = () => { el.hidden = true; undo(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, undo ? 5000 : 2500);
}

// --- form bits ---

export function field({ label, name, value = '', unit = '', mode = 'decimal', type = 'text', placeholder = '', focus = false, attrs = '' }) {
  return `<label class="field">
    <span>${esc(label)}</span>
    <div class="input">
      <input name="${name}" type="${type}" ${type === 'text' ? `inputmode="${mode}"` : ''} value="${esc(value ?? '')}"
        placeholder="${esc(placeholder)}" autocomplete="off" autocorrect="off" ${focus ? 'data-focus' : ''} ${attrs}>
      ${unit ? `<em>${esc(unit)}</em>` : ''}
    </div>
  </label>`;
}

export function stat(value, label) {
  return `<div class="stat"><b>${value}</b><span>${esc(label)}</span></div>`;
}

export function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function initGlobalUI() {
  // Lift the sheet above the on-screen keyboard so Save stays reachable.
  const vv = window.visualViewport;
  if (vv) {
    const lift = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', `${kb > 60 ? kb : 0}px`);
    };
    vv.addEventListener('resize', lift);
    vv.addEventListener('scroll', lift);
  }

  $('scrim').addEventListener('click', closeSheet);
  $('sheet').addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeSheet();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('sheet').hidden) closeSheet();
  });
  // chart marks report their value in the chart's readout line
  document.addEventListener('click', (e) => {
    const mark = e.target.closest('[data-tip]');
    if (!mark) return;
    const chart = mark.closest('.chart');
    chart.querySelectorAll('.is-on').forEach((m) => m.classList.remove('is-on'));
    mark.classList.add('is-on');
    chart.querySelector('.readout').textContent = mark.dataset.tip;
  });
}
