/* GurgoBudget — mount and wiring for the Today screen.
 * The drawing lives in view.js, the arithmetic in compute.js, the bytes in
 * store.js. This file only connects them to the page.
 */

import { snapshot } from './compute.js';
import { band, sheet, editorBody } from './view.js';
import { setLog, clearLog, setProjection, subscribe } from './store.js';

const app = document.getElementById('app');
const scrim = document.getElementById('scrim');
const editor = document.getElementById('editor');

const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

let now = new Date();
let open = null; // the day currently in the editor

function render() {
  now = new Date();
  const s = snapshot(now);
  app.replaceChildren(el(band(s)), el(sheet(s)));
}

/* ══════════════ the log editor ══════════════ */

function openEditor(day) {
  open = day;
  editor.replaceChildren(el(editorBody(snapshot(now), day)));
  scrim.hidden = false;
  const input = editor.querySelector('input');
  input.focus();
  input.select();
}

function closeEditor() {
  scrim.hidden = true;
  open = null;
}

function commit() {
  const raw = editor.querySelector('input').value.trim().replace(/[.\s]/g, '');
  const n = raw === '' ? 0 : Number(raw);
  if (!Number.isFinite(n)) return;
  setLog(snapshot(now).key, open, Math.round(n));
  closeEditor();
}

/* ══════════════ wiring ══════════════ */

app.addEventListener('click', (e) => {
  const rate = e.target.closest('[data-rate]');
  if (rate) return setProjection(snapshot(now).key, rate.dataset.rate);

  const day = e.target.closest('[data-day]');
  if (day && !day.disabled) openEditor(Number(day.dataset.day));
});

scrim.addEventListener('click', (e) => {
  if (e.target === scrim) return closeEditor();
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'save') commit();
  else if (act === 'cancel') closeEditor();
  else if (act === 'clear') {
    clearLog(snapshot(now).key, open);
    closeEditor();
  }
});

scrim.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') commit();
  else if (e.key === 'Escape') closeEditor();
});

subscribe(render);
render();

/* The calendar flipping closes the month on its own — nothing to press. */
setInterval(() => {
  if (new Date().getDate() !== now.getDate()) render();
}, 60_000);
