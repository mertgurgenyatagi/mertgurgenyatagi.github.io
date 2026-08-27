/* GurgoBudget — the arithmetic.
 *
 * Everything the Today screen shows is derived here from stored values only;
 * no figure is cached. That is what makes retroactive edits work: change a
 * value, recompute the month, done — including closed months.
 *
 *   Surplus = Base Income + Flex Income - Base Spend - Flex Spend
 *   Max     =  Surplus / days
 *   Daily   = (Surplus / days) - Buffer          <- the headline
 *   Strict  = (Surplus - Wishlist) / days
 *   Minimum = ((Surplus - Wishlist) / days) - Buffer
 */

import { load, month, projection } from './store.js';

export const monthKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const daysInMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

/* Base items resolved to what was true during `key`: the latest history entry
 * at or before that month, and nothing at all once `until` has passed. */
function resolveBase(items, key) {
  return items
    .filter((it) => !it.until || key < it.until)
    .map((it) => {
      const entry = it.history
        .filter((h) => h.from <= key)
        .sort((a, b) => (a.from < b.from ? 1 : -1))[0];
      return entry ? { id: it.id, name: it.name, amount: entry.amount } : null;
    })
    .filter(Boolean);
}

const total = (items) => items.reduce((sum, it) => sum + it.amount, 0);

/* Trailing-90-day window: the 90 calendar days ending the day before `today`.
 * Spans month boundaries, so it reads across stored months. */
function trailing90(today) {
  const s = load();
  let sum = 0;
  let logged = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  for (let i = 0; i < 90; i++) {
    const m = s.months[monthKey(cursor)];
    const v = m?.logs?.[cursor.getDate()];
    if (v !== undefined) {
      sum += v;
      logged++;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return logged ? Math.round(sum / logged) : 0;
}

export const RATES = [
  { key: 'max',    label: 'Max' },
  { key: 'daily',  label: 'Daily' },
  { key: 'strict', label: 'Strict' },
  { key: 'min',    label: 'Min' },
  { key: 'avgMo',  label: 'Mo.' },
  { key: 'avg90',  label: '90d' }
];

export function snapshot(today = new Date()) {
  const s = load();
  const key = monthKey(today);
  const m = month(key);
  const days = daysInMonth(key);
  const buffer = s.buffer;

  const baseIncome = resolveBase(s.baseIncome, key);
  const baseSpend = resolveBase(s.baseSpend, key);

  const surplus =
    total(baseIncome) + total(m.flexIncome) - total(baseSpend) - total(m.flexSpend);
  const wishlist = total(m.wishlist);

  /* Whole lira is a real quantum here, not just a display filter: the app
   * states an allowance, and every figure derived from it has to reconcile
   * against that stated number if the user checks it by hand. So the division
   * rounds once, and the buffer — already whole — comes off the rounded value. */
  const max = Math.round(surplus / days);
  const strict = Math.round((surplus - wishlist) / days);
  const allowances = {
    max,
    daily: max - buffer,
    strict,
    min: strict - buffer
  };

  /* Day states. The current day is never counted as missing — the user logs
   * retrospectively and today is not yet due. */
  const todayDay = today.getDate();
  const logged = [];
  const missing = [];
  const future = [];
  for (let d = 1; d <= days; d++) {
    if (m.logs[d] !== undefined) logged.push(d);
    else if (d < todayDay) missing.push(d);
    else if (d > todayDay) future.push(d);
  }

  const spent = logged.reduce((sum, d) => sum + m.logs[d], 0);
  const avgMo = logged.length ? Math.round(spent / logged.length) : 0;
  const avg90 = trailing90(today);

  const rates = { ...allowances, avgMo, avg90 };
  const chosen = projection(key);
  const rate = rates[chosen] ?? allowances.daily;

  /* Every unlogged day gets projected at the chosen rate — including days
   * already past but not yet caught up on.
   *
   * The rate is floored at zero here and only here. A negative Surplus gives
   * negative allowances, which the spec says to show as-is — and the hero and
   * the six-way control do. But projecting the rest of the month at a negative
   * rate means assuming every remaining day pays the user, which turns the
   * worst possible month into a healthy month-end figure. Nothing is spent
   * below zero, so nothing is projected below zero. */
  const unlogged = days - logged.length;
  const monthEnd = surplus - spent - Math.max(0, rate) * unlogged;

  /* Measured against Daily, the headline number — not against the projection
   * choice, which only governs the days still to come. */
  const ahead = allowances.daily * logged.length - spent;

  const bar = (label, need) => ({
    label,
    need,
    have: monthEnd,
    gap: monthEnd - need,
    ok: monthEnd >= need,
    fill: need <= 0 ? (monthEnd >= 0 ? 1 : 0) : Math.max(0, Math.min(1, monthEnd / need))
  });

  return {
    key,
    days,
    todayDay,
    buffer,
    baseIncome,
    baseSpend,
    flexIncome: m.flexIncome,
    flexSpend: m.flexSpend,
    wishlist: m.wishlist,
    logs: m.logs,
    surplus,
    wishlistTotal: wishlist,
    allowances,
    rates,
    chosen,
    logged,
    missing,
    future,
    spent,
    avgMo,
    avg90,
    unlogged,
    monthEnd,
    ahead,
    thresholds: [
      bar('Solvent', 0),
      bar('Buffer', buffer * days),
      bar('Wishlist', wishlist)
    ]
  };
}
