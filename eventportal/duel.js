(() => {
'use strict';

const DATA_URL = 'data/events.json';
const LS_COMPARISONS = 'eventportal:duels';
const CSV_COLUMNS = ['aId', 'aTitle', 'aVenue', 'bId', 'bTitle', 'bVenue', 'winnerId', 'comparedAt'];
const MAX_RANDOM_ATTEMPTS = 300;

let pool = [];           // events available for matchups (already canonical/deduped upstream)
let byId = new Map();
let comparisons = {};    // matchKey ("id1|id2", sorted) -> { aId, bId, winnerId, comparedAt }
let current = null;      // [eventA, eventB] currently shown

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function pairKey(idA, idB) {
  return [idA, idB].sort().join('|');
}

// ---------- localStorage ----------
function loadComparisons() {
  try {
    const raw = localStorage.getItem(LS_COMPARISONS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function saveComparisons() {
  try { localStorage.setItem(LS_COMPARISONS, JSON.stringify(comparisons)); } catch (e) { /* storage full/unavailable */ }
}

// ---------- CSV ----------
function csvEscape(value) {
  return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
}
function toCsv(rows) {
  const lines = [CSV_COLUMNS.map(csvEscape).join(',')];
  for (const row of rows) lines.push(CSV_COLUMNS.map(c => csvEscape(row[c])).join(','));
  return lines.join('\r\n');
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\r') {
      // skip
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csvToComparisons(text) {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  if (rows.length === 0) return {};
  const header = rows[0];
  const aIdx = header.indexOf('aId'), bIdx = header.indexOf('bId'), wIdx = header.indexOf('winnerId');
  if (aIdx === -1 || bIdx === -1 || wIdx === -1) throw new Error('CSV başlığında aId/bId/winnerId sütunları yok');
  const out = {};
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length === 1 && cells[0] === '') continue;
    const obj = {};
    header.forEach((col, i) => { obj[col] = cells[i]; });
    if (!obj.aId || !obj.bId) continue;
    const key = pairKey(obj.aId, obj.bId);
    out[key] = obj;
  }
  return out;
}

function downloadCsv(text) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eventportal-duels-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Toast ----------
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ---------- Matchup selection ----------
// Random, with the one hard rule: never show the same matchup twice. Tries
// random sampling first (fast, and fine since the pool is large relative to
// how many matchups will ever be shown); falls back to an exhaustive scan
// only once random sampling is starting to struggle, i.e. the pool of
// remaining never-seen pairs is nearly exhausted.
function pickPair() {
  if (pool.length < 2) return null;

  for (let attempt = 0; attempt < MAX_RANDOM_ATTEMPTS; attempt++) {
    const a = pool[Math.floor(Math.random() * pool.length)];
    const b = pool[Math.floor(Math.random() * pool.length)];
    if (a.id === b.id) continue;
    if (!comparisons[pairKey(a.id, b.id)]) return [a, b];
  }

  // Random sampling kept colliding with already-seen pairs -- the pool of
  // remaining fresh matchups is small, so just scan for one exhaustively.
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      if (!comparisons[pairKey(pool[i].id, pool[j].id)]) return [pool[i], pool[j]];
    }
  }
  return null; // every possible pair has been shown
}

// ---------- Rendering ----------
function updateProgress() {
  const total = (pool.length * (pool.length - 1)) / 2;
  document.getElementById('duelProgress').textContent =
    `${Object.keys(comparisons).length} / ${total} karşılaştırma`;
}

function cardHtml(ev) {
  return `
    <div class="duel-card-media">
      ${ev.image ? `<img src="${escapeHtml(ev.image)}" alt="" loading="lazy">` : `<span class="icon icon-image"></span>`}
    </div>
    <div class="duel-card-eyebrow">${escapeHtml(ev.source)}</div>
    <h2 class="duel-card-title">${escapeHtml(ev.title)}</h2>
    <div class="duel-card-meta-row"><span class="icon icon-pin"></span>${escapeHtml(ev.venue || 'Mekan belirtilmemiş')}</div>
    <div class="duel-card-meta-row">${escapeHtml(ev.date)} · ${escapeHtml(ev.time || '--:--')}</div>
    <div class="duel-card-tags"><span>${escapeHtml(ev.category)}</span></div>
    ${ev.description ? `<div class="duel-card-desc">${escapeHtml(ev.description)}</div>` : ''}
    <div class="duel-pick-btn">Bunu Seç</div>
  `;
}

function renderPair() {
  const [a, b] = current;
  document.getElementById('cardA').innerHTML = cardHtml(a);
  document.getElementById('cardB').innerHTML = cardHtml(b);
}

function showNextPair() {
  current = pickPair();
  updateProgress();

  if (!current) {
    document.getElementById('duelPair').hidden = true;
    document.getElementById('duelDone').hidden = false;
    document.getElementById('duelDoneCount').textContent = `${Object.keys(comparisons).length} karşılaştırma yapıldı.`;
    return;
  }
  document.getElementById('duelPair').hidden = false;
  document.getElementById('duelDone').hidden = true;
  renderPair();
}

function pick(side) {
  if (!current) return;
  const [a, b] = current;
  const winner = side === 'a' ? a : b;
  const key = pairKey(a.id, b.id);
  comparisons[key] = {
    aId: a.id, aTitle: a.title, aVenue: a.venue || '',
    bId: b.id, bTitle: b.title, bVenue: b.venue || '',
    winnerId: winner.id,
    comparedAt: new Date().toISOString(),
  };
  saveComparisons();
  showNextPair();
}

// ---------- Wiring ----------
function wireEvents() {
  document.getElementById('cardA').addEventListener('click', () => pick('a'));
  document.getElementById('cardB').addEventListener('click', () => pick('b'));

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') pick('a');
    else if (e.key === 'ArrowRight') pick('b');
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const rows = Object.values(comparisons).sort((a, b) => a.comparedAt.localeCompare(b.comparedAt));
    if (rows.length === 0) { showToast('Henüz karşılaştırma yok.'); return; }
    downloadCsv(toCsv(rows));
    showToast(`${rows.length} karşılaştırma dışa aktarıldı.`);
  });

  const importFile = document.getElementById('importFile');
  document.getElementById('importBtn').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = csvToComparisons(String(reader.result));
        const importedCount = Object.keys(imported).length;
        comparisons = { ...comparisons, ...imported };
        saveComparisons();
        showToast(`${importedCount} karşılaştırma içe aktarıldı.`);
        showNextPair();
      } catch (err) {
        showToast(`İçe aktarma başarısız: ${err.message}`);
      } finally {
        importFile.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  });
}

// ---------- Init ----------
async function init() {
  wireEvents();
  comparisons = loadComparisons();
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    // Events are already canonical/deduped upstream (fetch-daily.js's
    // merge pipeline) -- no need to re-deduplicate here.
    pool = json.events || [];
    byId = new Map(pool.map(ev => [ev.id, ev]));
  } catch (e) {
    document.getElementById('duelProgress').textContent = 'Veriler yüklenemedi.';
    return;
  }
  showNextPair();
}

document.addEventListener('DOMContentLoaded', init);
})();
