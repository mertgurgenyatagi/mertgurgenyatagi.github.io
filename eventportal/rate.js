(() => {
'use strict';

const DATA_URL = 'data/events.json';
const LS_RATINGS = 'eventportal:ratings';
const CSV_COLUMNS = ['id', 'source', 'category', 'date', 'time', 'venue', 'title', 'score', 'note', 'ratedAt'];

let allEvents = [];
let ratings = {}; // id -> { id, source, category, date, time, venue, title, score, note, ratedAt }
let current = null; // the event currently being rated
let selectedScore = null;

const SCORE_LABELS = {
  1: 'o kadar gitmem ki',
  2: '100 kez olsa 1 kez giderim belki',
  3: 'yani fena değil olabilitesi var ama zannetmiyorum',
  4: 'olabilir lan. durum uygun olursa',
  5: 'ben gidicem buna',
};

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---------- localStorage ----------
function loadRatings() {
  try {
    const raw = localStorage.getItem(LS_RATINGS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function saveRatings() {
  try { localStorage.setItem(LS_RATINGS, JSON.stringify(ratings)); } catch (e) { /* storage full/unavailable */ }
}

// ---------- CSV ----------
// Every field is quoted and internal quotes are doubled — the simplest rule
// that's always correct, rather than only quoting fields that "need" it.
function csvEscape(value) {
  return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
}
function toCsv(rows) {
  const lines = [CSV_COLUMNS.map(csvEscape).join(',')];
  for (const row of rows) lines.push(CSV_COLUMNS.map(c => csvEscape(row[c])).join(','));
  return lines.join('\r\n');
}

// Small state-machine parser — handles quoted fields containing commas,
// newlines, and escaped ("") quotes, which a naive split(',') would corrupt.
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
      // skip — paired \n (or a lone \r, rare) handles the row break
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csvToRatings(text) {
  const rows = parseCsv(text.replace(/^﻿/, '')); // strip BOM if present (Excel-saved CSVs)
  if (rows.length === 0) return {};
  const header = rows[0];
  const idIdx = header.indexOf('id');
  if (idIdx === -1) throw new Error('CSV başlığında "id" sütunu yok');
  const out = {};
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length === 1 && cells[0] === '') continue; // trailing blank line
    const obj = {};
    header.forEach((col, i) => { obj[col] = cells[i]; });
    if (!obj.id) continue;
    obj.score = Number(obj.score);
    out[obj.id] = obj;
  }
  return out;
}

function downloadCsv(text) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8;' }); // BOM so Excel opens Turkish text correctly
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eventportal-ratings-${new Date().toISOString().slice(0, 10)}.csv`;
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

// ---------- Rendering ----------
function updateProgress() {
  const ratedCount = Object.keys(ratings).length;
  document.getElementById('rateProgress').textContent = `${ratedCount} / ${allEvents.length} değerlendirildi`;
}

function pickRandomUnrated() {
  const pool = allEvents.filter(ev => !ratings[ev.id]);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function renderEvent(ev) {
  const wrap = document.getElementById('rateEvent');
  wrap.innerHTML = `
    <div class="rate-event-media">
      ${ev.image ? `<img src="${escapeHtml(ev.image)}" alt="">` : `<span class="icon icon-image"></span>`}
    </div>
    <div class="rate-event-eyebrow">${escapeHtml(ev.source)}</div>
    <h2 class="rate-event-title">${escapeHtml(ev.title)}</h2>
    <div class="rate-event-meta-row"><span class="icon icon-pin"></span>${escapeHtml(ev.venue || 'Mekan belirtilmemiş')}</div>
    <div class="rate-event-meta-row">${escapeHtml(ev.date)} · ${escapeHtml(ev.time || '--:--')}</div>
    <div class="rate-event-tags">
      <span>${escapeHtml(ev.category)}</span>
    </div>
    ${ev.description ? `<div class="rate-event-desc">${escapeHtml(ev.description)}</div>` : ''}
    ${ev.link ? `<a class="rate-event-link" href="${escapeHtml(ev.link)}" target="_blank" rel="noopener noreferrer">Orijinal İlan →</a>` : ''}
  `;
}

function showNextEvent() {
  selectedScore = null;
  document.getElementById('noteInput').value = '';
  renderScoreButtons();
  updateSubmitState();

  current = pickRandomUnrated();
  updateProgress();

  if (!current) {
    document.getElementById('rateBody').hidden = true;
    document.getElementById('rateDone').hidden = false;
    document.getElementById('rateDoneCount').textContent = `${Object.keys(ratings).length} etkinlik değerlendirildi.`;
    return;
  }
  document.getElementById('rateBody').hidden = false;
  document.getElementById('rateDone').hidden = true;
  renderEvent(current);
}

function renderScoreButtons() {
  const row = document.getElementById('scoreRow');
  row.innerHTML = Object.keys(SCORE_LABELS).map(n => `
    <button type="button" class="score-opt" data-score="${n}">
      <span class="score-num">${n}</span>
      <span class="score-label">${escapeHtml(SCORE_LABELS[n])}</span>
    </button>`).join('');
}

function updateSubmitState() {
  document.getElementById('submitBtn').disabled = selectedScore === null;
}

function selectScore(n) {
  selectedScore = n;
  document.querySelectorAll('.score-opt').forEach(btn => {
    btn.classList.toggle('selected', Number(btn.dataset.score) === n);
  });
  updateSubmitState();
}

function submitRating() {
  if (selectedScore === null || !current) return;
  const note = document.getElementById('noteInput').value.trim();
  ratings[current.id] = {
    id: current.id,
    source: current.source,
    category: current.category,
    date: current.date,
    time: current.time,
    venue: current.venue || '',
    title: current.title,
    score: selectedScore,
    note,
    ratedAt: new Date().toISOString(),
  };
  saveRatings();
  showNextEvent();
}

// ---------- Wiring ----------
function wireEvents() {
  document.getElementById('scoreRow').addEventListener('click', e => {
    const btn = e.target.closest('.score-opt');
    if (btn) selectScore(Number(btn.dataset.score));
  });

  document.getElementById('submitBtn').addEventListener('click', submitRating);

  document.addEventListener('keydown', e => {
    const inNote = document.activeElement === document.getElementById('noteInput');
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submitRating();
      return;
    }
    if (inNote) return; // don't hijack digit typing inside the notes field
    if (e.key >= '1' && e.key <= '5') selectScore(Number(e.key));
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const rows = Object.values(ratings).sort((a, b) => a.ratedAt.localeCompare(b.ratedAt));
    if (rows.length === 0) { showToast('Henüz değerlendirme yok.'); return; }
    downloadCsv(toCsv(rows));
    showToast(`${rows.length} değerlendirme dışa aktarıldı.`);
  });

  const importFile = document.getElementById('importFile');
  document.getElementById('importBtn').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = csvToRatings(String(reader.result));
        const importedCount = Object.keys(imported).length;
        ratings = { ...ratings, ...imported };
        saveRatings();
        showToast(`${importedCount} değerlendirme içe aktarıldı.`);
        showNextEvent();
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
  ratings = loadRatings();
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    allEvents = json.events || [];
  } catch (e) {
    document.getElementById('rateProgress').textContent = 'Veriler yüklenemedi.';
    return;
  }
  showNextEvent();
}

document.addEventListener('DOMContentLoaded', init);
})();
