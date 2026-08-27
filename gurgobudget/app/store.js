/* GurgoBudget — persistence.
 *
 * One seam, two implementations. Today runs on localStorage because the
 * Firebase project does not exist yet (no project id, no config — that needs
 * the console). When it does, only `load` and `save` below change: swap the
 * body for a Firestore document read/write on
 *   users/{uid}/budget/state
 * with security rules pinning uid to the single hardcoded account, and keep
 * the rest of the app untouched. The shape written here is the shape Firestore
 * should hold.
 */

import { SEED } from './seed.js';

const KEY = 'gurgobudget:v1';

let state = null;
const listeners = new Set();

export function load() {
  if (state) return state;
  let stored = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {
    stored = null;
  }
  state = stored || structuredClone(SEED);
  return state;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode — the screen still holds the value in memory */
  }
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* --- month container ------------------------------------------------- */

export function month(key) {
  const s = load();
  if (!s.months[key]) s.months[key] = {};
  const m = s.months[key];
  m.flexIncome ??= [];
  m.flexSpend ??= [];
  m.wishlist ??= [];
  m.logs ??= {};
  return m;
}

/* --- the daily log ---------------------------------------------------- */

export function setLog(monthKey, day, amount) {
  month(monthKey).logs[day] = amount;
  save();
}

export function clearLog(monthKey, day) {
  delete month(monthKey).logs[day];
  save();
}

/* --- the six-way projection choice ------------------------------------ */

export function projection(monthKey) {
  return load().projection[monthKey] || 'daily';
}

export function setProjection(monthKey, key) {
  load().projection[monthKey] = key;
  save();
}

/* --- escape hatch for a wedged local copy ----------------------------- */

export function reset() {
  state = structuredClone(SEED);
  save();
}
