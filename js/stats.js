// Dates are local 'YYYY-MM-DD' strings throughout.

const pad = (n) => String(n).padStart(2, '0');

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today() {
  return toISO(new Date());
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

// Weeks run Monday to Sunday.
export function weekStart(iso) {
  const d = parseISO(iso);
  return addDays(iso, -((d.getDay() + 6) % 7));
}

export function lastDays(n, end = today()) {
  return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
}

export function lastWeeks(n, end = today()) {
  const start = weekStart(end);
  return Array.from({ length: n }, (_, i) => addDays(start, (i - n + 1) * 7));
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDay(iso) {
  const d = parseISO(iso);
  return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`;
}

export function fmtShort(iso) {
  const d = parseISO(iso);
  return `${d.getDate()} ${MO[d.getMonth()]}`;
}

export function weekdayLetter(iso) {
  return WD[parseISO(iso).getDay()][0];
}

export function relDay(iso) {
  const t = today();
  if (iso === t) return 'Today';
  if (iso === addDays(t, -1)) return 'Yesterday';
  if (iso === addDays(t, 1)) return 'Tomorrow';
  return fmtDay(iso);
}

export function sum(list, fn) {
  let t = 0;
  for (const x of list) t += fn(x) || 0;
  return t;
}

export function fmt(n, decimals = 0) {
  if (n == null || !isFinite(n)) return '–';
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals, useGrouping: false });
}

// Accepts both "72.5" and "72,5".
export function num(v) {
  const n = parseFloat(String(v ?? '').trim().replace(',', '.'));
  return isFinite(n) ? n : null;
}

// "45", "45:30" or "1:45:30" -> seconds. A bare number means minutes.
export function parseDuration(str) {
  const parts = String(str ?? '').trim().split(':').map((p) => num(p));
  if (!parts.length || parts.length > 3 || parts.some((p) => p == null || p < 0)) return null;
  let s;
  if (parts.length === 1) s = parts[0] * 60;
  else if (parts.length === 2) s = parts[0] * 60 + parts[1];
  else s = parts[0] * 3600 + parts[1] * 60 + parts[2];
  return s > 0 ? Math.round(s) : null;
}

export function fmtDuration(sec) {
  if (!sec) return '–';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function fmtPace(sec, km) {
  if (!sec || !km) return '–';
  const p = Math.round(sec / km);
  return `${Math.floor(p / 60)}:${pad(p % 60)}`;
}

// Consecutive days with activity, ending today (or yesterday if today is still open).
export function streak(dates) {
  const set = new Set(dates);
  let d = today();
  if (!set.has(d)) d = addDays(d, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
