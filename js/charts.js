import { esc } from './stats.js';

const W = 343; // content width at 375px; SVGs scale via viewBox

export function ring(value, goal, size = 124) {
  const sw = 7;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const frac = goal > 0 ? Math.min(value / goal, 1) : 0;
  const over = goal > 0 && value > goal;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${sw}"/>
    ${frac > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(${over ? '--over' : '--accent'})"
      stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c * frac} ${c}"
      transform="rotate(-90 ${size / 2} ${size / 2})"/>` : ''}
  </svg>`;
}

export function meter(value, goal) {
  const frac = goal > 0 ? Math.min(value / goal, 1) : 0;
  return `<div class="meter"><i style="width:${(frac * 100).toFixed(1)}%"></i></div>`;
}

// items: [{ label, tip, segments: [{ value, color }] }]. Tapping a bar writes its tip to the readout.
export function bars({ items, goal = 0, goalLabel = '', height = 132, readout = '' }) {
  const top = 14, bottom = 20;
  const plot = height - top - bottom;
  const totals = items.map((it) => it.segments.reduce((t, s) => t + s.value, 0));
  const max = Math.max(goal, ...totals, 1) * 1.08;
  const slot = W / items.length;
  const bw = Math.min(28, slot - 10);
  const y = (v) => top + plot - (v / max) * plot;

  const marks = items.map((it, i) => {
    const x = i * slot + (slot - bw) / 2;
    let acc = 0;
    const segs = it.segments.filter((s) => s.value > 0);
    const rects = segs.map((s, j) => {
      const y1 = y(acc + s.value);
      const h = Math.max(y(acc) - y1 - (j < segs.length - 1 ? 2 : 0), 1);
      acc += s.value;
      const last = j === segs.length - 1;
      // only the outer end is rounded; the baseline end stays square
      return last
        ? `<path d="M${x} ${y1 + h}V${y1 + Math.min(3, h)}q0-${Math.min(3, h)} 3-${Math.min(3, h)}h${bw - 6}q3 0 3 ${Math.min(3, h)}V${y1 + h}Z" fill="${s.color}"/>`
        : `<rect x="${x}" y="${y1}" width="${bw}" height="${h}" fill="${s.color}"/>`;
    }).join('');
    const empty = segs.length ? '' : `<rect x="${x}" y="${top + plot - 2}" width="${bw}" height="2" fill="var(--track)"/>`;
    return `<g class="bar" data-tip="${esc(it.tip)}">
      <rect x="${i * slot}" y="0" width="${slot}" height="${height}" fill="transparent"/>
      ${rects}${empty}
      <text x="${i * slot + slot / 2}" y="${height - 4}" text-anchor="middle">${esc(it.label)}</text>
    </g>`;
  }).join('');

  const goalLine = goal > 0
    ? `<line class="goal" x1="0" x2="${W}" y1="${y(goal)}" y2="${y(goal)}"/>
       <text class="goal-label" x="${W}" y="${y(goal) - 4}" text-anchor="end">${esc(goalLabel)}</text>`
    : '';

  return `<figure class="chart">
    <figcaption class="readout">${esc(readout)}</figcaption>
    <svg viewBox="0 0 ${W} ${height}" role="img">
      <line class="base" x1="0" x2="${W}" y1="${top + plot}" y2="${top + plot}"/>
      ${marks}${goalLine}
    </svg>
  </figure>`;
}

// points: [{ i, value, tip }] with i in 0..count-1
export function line({ points, count, goal = null, goalLabel = '', height = 132, readout = '', startLabel = '', endLabel = '' }) {
  const top = 12, bottom = 20, left = 0, right = 8;
  const plot = height - top - bottom;
  const vals = points.map((p) => p.value).concat(goal != null ? [goal] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const padY = Math.max((hi - lo) * 0.15, 0.5);
  lo -= padY; hi += padY;
  const x = (i) => left + (i / Math.max(count - 1, 1)) * (W - left - right);
  const y = (v) => top + plot - ((v - lo) / (hi - lo)) * plot;
  const d = points.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.value).toFixed(1)}`).join('');
  const last = points[points.length - 1];

  const hits = points.map((p) => `<g class="pt" data-tip="${esc(p.tip)}">
      <circle cx="${x(p.i)}" cy="${y(p.value)}" r="12" fill="transparent"/>
      <circle class="dot" cx="${x(p.i)}" cy="${y(p.value)}" r="4"/>
    </g>`).join('');

  const goalLine = goal != null
    ? `<line class="goal" x1="0" x2="${W}" y1="${y(goal)}" y2="${y(goal)}"/>
       <text class="goal-label" x="0" y="${y(goal) - 4}">${esc(goalLabel)}</text>`
    : '';

  return `<figure class="chart">
    <figcaption class="readout">${esc(readout)}</figcaption>
    <svg viewBox="0 0 ${W} ${height}" role="img">
      ${goalLine}
      <path class="series" d="${d}"/>
      ${hits}
      <circle class="end" cx="${x(last.i)}" cy="${y(last.value)}" r="4"/>
      <text x="0" y="${height - 4}">${esc(startLabel)}</text>
      <text x="${W}" y="${height - 4}" text-anchor="end">${esc(endLabel)}</text>
    </svg>
  </figure>`;
}

export function legend(entries) {
  return `<ul class="legend">${entries.map((e) => `<li><i style="background:${e.color}"></i>${esc(e.name)}</li>`).join('')}</ul>`;
}
