/* GurgoBudget — Today, drawn.
 *
 * Pure: a snapshot in, HTML out. No DOM, no events — those live in app.js.
 * Four pieces, arranged band-then-sheet so the dark half carries the state of
 * the month and the light half carries what to do about it:
 *
 *   band   brand · day track · log gap · daily allowance
 *   sheet  six-way projection · three thresholds · spend grid
 *
 * Items, Wishlist, Log, History and Stats are separate pages; no cross-page
 * navigation is drawn here — that belongs to the integration run.
 *
 * Copy rule: labels and bare words. No sentences.
 */

import { RATES } from './compute.js';

const NUM = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });

/* Whole lira everywhere, never kurus. A minus sign, not a hyphen. */
export const plain = (n) => NUM.format(Math.round(n)).replace('-', '−');
export const money = (n) => (n < 0 ? '−₺' : '₺') + NUM.format(Math.abs(Math.round(n)));

function dateOf(s, day) {
  const [y, m] = s.key.split('-').map(Number);
  return new Date(y, m - 1, day);
}

/* ══════════════ band ══════════════ */

export function band(s) {
  /* The day track carries status only — logged, missing, today, still to come.
   * The amounts are the spend grid's job, further down the sheet. */
  const cells = [];
  for (let d = 1; d <= s.days; d++) {
    const [state, said] =
      d === s.todayDay ? ['is-today', 'today']
      : s.logs[d] !== undefined ? ['is-logged', 'logged']
      : d < s.todayDay ? ['is-missing', 'missing']
      : ['', 'later'];
    cells.push(
      `<button type="button" class="${state}" data-day="${d}" aria-label="${d} ${said}"${
        d > s.todayDay ? ' disabled' : ''
      }></button>`
    );
  }

  const tally = s.missing.length
    ? `${s.logged.length} logged · ${s.missing.length} missing`
    : `${s.logged.length} logged`;

  /* The gap in the strip is the log button — it exists only while there is a
   * gap to close, and always points at the earliest unlogged day. */
  const gap = s.missing.length
    ? `<button class="gap" type="button" data-day="${s.missing[0]}">
         <b>Log ${DAY.format(dateOf(s, s.missing[0]))}</b>
         <em>${s.missing.length} missing →</em>
       </button>`
    : '';

  const behind = s.ahead < 0;

  return `
    <div class="band">
      <div class="brand">
        <span class="mark">GurgoBudget</span>
        <span class="mo">${MONTH.format(dateOf(s, 1))}</span>
      </div>

      <div class="strip">
        <div class="days" style="grid-template-columns:repeat(${s.days},1fr)">${cells.join('')}</div>
        <p class="leg"><span>1</span><span>${tally}</span><span>${s.days}</span></p>
        ${gap}
      </div>

      <div class="hero">
        <p class="k">Daily allowance</p>
        <p class="fig num"><i>₺</i>${plain(s.allowances.daily)}</p>
        <p class="delta">
          <span>${s.unlogged} unlogged</span>
          <b${behind ? ' class="behind"' : ''}>${money(Math.abs(s.ahead))} ${behind ? 'behind' : 'ahead'}</b>
        </p>
      </div>
    </div>`;
}

/* ══════════════ sheet ══════════════ */

export function sheet(s) {
  const seg = RATES.map(
    (r) => `
      <button type="button" class="${r.key === s.chosen ? 'on' : ''}" data-rate="${r.key}">
        ${r.label}<b>${plain(s.rates[r.key])}</b>
      </button>`
  ).join('');

  const bars = s.thresholds
    .map(
      (b) => `
      <div class="bar${b.ok ? '' : ' no'}">
        <div class="lg">
          <span>${b.label}</span>
          <em>${money(Math.abs(b.gap))} ${b.ok ? 'clear' : 'short'}</em>
        </div>
        <div class="trk"><i style="width:${(b.fill * 100).toFixed(1)}%"></i></div>
        <div class="cap"><span>need ${money(b.need)}</span><span>have ${money(b.have)}</span></div>
      </div>`
    )
    .join('');

  /* Every day of the month at once — past, current and future together, with
   * the amount, which is what the status strip above deliberately omits. */
  const boxes = [];
  for (let d = 1; d <= s.days; d++) {
    const v = s.logs[d];
    let cls;
    if (d === s.todayDay) cls = 'now';
    else if (v !== undefined) cls = v === 0 ? 'zero' : 'logged';
    else if (d < s.todayDay) cls = 'missing';
    else cls = 'later';

    boxes.push(
      `<button type="button" class="${cls}" data-day="${d}"${cls === 'later' ? ' disabled' : ''}>
         <i>${d}</i><b class="num">${v === undefined ? '—' : plain(v)}</b>
       </button>`
    );
  }

  return `
    <div class="sheet">
      <h2><span>Project · ${s.unlogged} days</span></h2>
      <div class="seg">${seg}</div>

      <div class="bars">
        <h2><span>Month-end</span><b class="num${s.monthEnd < 0 ? ' short' : ''}">${money(s.monthEnd)}</b></h2>
        ${bars}
      </div>

      <div class="grid-wrap">
        <h2><span>Spend</span><b class="num">${money(s.spent)}</b></h2>
        <div class="grid">${boxes.join('')}</div>
      </div>
    </div>`;
}

/* ══════════════ log editor ══════════════ */

export function editorBody(s, day) {
  const date = dateOf(s, day);
  const existing = s.logs[day];

  return `
    <div>
      <div class="eh">
        <b>${DAY.format(date)}</b>
        <span>${WEEKDAY.format(date)}</span>
      </div>
      <div class="field">
        <i>₺</i>
        <input type="text" inputmode="numeric" autocomplete="off" placeholder="0" value="${existing ?? ''}">
      </div>
      <div class="acts">
        <button class="save" type="button" data-act="save">Save</button>
        ${existing !== undefined ? '<button class="clear" type="button" data-act="clear">Clear</button>' : ''}
        <button class="cancel" type="button" data-act="cancel">Cancel</button>
      </div>
    </div>`;
}
