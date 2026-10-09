import * as food from './views/food.js';
import * as run from './views/run.js';
import * as train from './views/train.js';
import * as settings from './views/settings.js';
import { onRefresh, refresh, initGlobalUI } from './ui.js';

const views = { food, run, train, settings };
const root = document.getElementById('view');
const tabs = [...document.querySelectorAll('.tabbar button')];

let current = 'food';
try {
  const saved = sessionStorage.getItem('tracker.tab');
  if (views[saved]) current = saved;
} catch {}

function show(tab) {
  current = tab;
  try { sessionStorage.setItem('tracker.tab', tab); } catch {}
  refresh();
  window.scrollTo(0, 0);
}

onRefresh(() => {
  root.innerHTML = views[current].render();
  root.dataset.view = current;
  tabs.forEach((b) => b.setAttribute('aria-current', b.dataset.tab === current ? 'page' : 'false'));
});

tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el) views[current].handle(el.dataset.action, el);
});

root.addEventListener('submit', (e) => {
  e.preventDefault();
  views[current].submit?.(e.target);
});

root.addEventListener('input', (e) => {
  if (e.target.type !== 'file') views[current].change?.(e.target);
});
root.addEventListener('change', (e) => {
  if (e.target.type === 'file') views[current].change?.(e.target);
});

// A day can roll over while the app sits in the background.
document.addEventListener('visibilitychange', () => {
  const editing = root.contains(document.activeElement) && document.activeElement.matches('input, select');
  if (!document.hidden && document.getElementById('sheet').hidden && !editing) refresh();
});

initGlobalUI();
refresh();

navigator.storage?.persist?.();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
