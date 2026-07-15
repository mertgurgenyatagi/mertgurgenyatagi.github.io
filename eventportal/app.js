(() => {
'use strict';

const DATA_URL = 'data/events.json';
const PAGE_SIZE = 20;
// Below this predicted 1.0-5.0 taste score (see scripts/eventportal/score-events.js
// and research/smart-filter-analysis.md), "Bana Göre" hides an event.
const TASTE_THRESHOLD = 4;

// Score badge color: red (1.0) -> amber (3.0) -> green (5.0), piecewise-lerped
// in RGB. Stops were chosen so every point on the sweep keeps white text at
// >=4.5:1 contrast (worst point is the 3.0 amber stop, at 4.62:1) - verified
// point-by-point, not eyeballed. Going straight red->green in one lerp would
// pass through a muddy, low-contrast brown midpoint, hence the amber stop.
const SCORE_COLOR_STOPS = [[1, [0xd0, 0x3b, 0x3b]], [3, [0xa5, 0x67, 0x0f]], [5, [0x0f, 0x7a, 0x14]]];
function scoreColor(score) {
  const s = Math.max(1, Math.min(5, score));
  const [lo, hi] = s <= 3 ? [SCORE_COLOR_STOPS[0], SCORE_COLOR_STOPS[1]] : [SCORE_COLOR_STOPS[1], SCORE_COLOR_STOPS[2]];
  const t = (s - lo[0]) / (hi[0] - lo[0]);
  const rgb = lo[1].map((c, i) => Math.round(c + (hi[1][i] - c) * t));
  return `rgb(${rgb.join(',')})`;
}

const ALL_CATEGORIES = [
  'Çocuk Etkinlikleri', 'Stand-up', 'Atölye', 'Sergi', 'Tiyatro', 'Sinema',
  'Festival', 'Sosyal', 'Spor & Açık Hava', 'Parti', 'Konser', 'Diğer',
];

// ---------- localStorage ----------
const LS_FAVORITES = 'eventportal:favorites';
const LS_DISMISSED = 'eventportal:dismissed';
const LS_LISTS = 'eventportal:lists';
const LS_INTERACTIONS = 'eventportal:interactions';
const MAX_INTERACTIONS = 5000;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full/unavailable — degrade silently */ }
}

let favorites = new Set(readJson(LS_FAVORITES, []));
let dismissed = new Set(readJson(LS_DISMISSED, []));
let lists = readJson(LS_LISTS, {}); // { listId: { name, eventIds: [] } }

function saveFavorites() { writeJson(LS_FAVORITES, [...favorites]); }
function saveDismissed() { writeJson(LS_DISMISSED, [...dismissed]); }
function saveLists() { writeJson(LS_LISTS, lists); }

function logInteraction(type, eventId, extra) {
  const log = readJson(LS_INTERACTIONS, []);
  log.push({ type, eventId, ...extra, ts: new Date().toISOString() });
  if (log.length > MAX_INTERACTIONS) log.splice(0, log.length - MAX_INTERACTIONS);
  writeJson(LS_INTERACTIONS, log);
}

function toggleFavorite(id) {
  if (favorites.has(id)) { favorites.delete(id); logInteraction('unfavorite', id); }
  else { favorites.add(id); logInteraction('favorite', id); }
  saveFavorites();
}
function dismissEvent(id) {
  dismissed.add(id);
  saveDismissed();
  logInteraction('dismiss', id);
}
function undismissEvent(id) {
  dismissed.delete(id);
  saveDismissed();
  logInteraction('undismiss', id);
}
function createList(name) {
  const id = 'list-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  lists[id] = { name, eventIds: [] };
  saveLists();
  return id;
}
function listsForEvent(eventId) {
  return Object.keys(lists).filter(id => lists[id].eventIds.includes(eventId));
}
function toggleEventInList(listId, eventId) {
  const l = lists[listId];
  if (!l) return;
  const idx = l.eventIds.indexOf(eventId);
  if (idx === -1) { l.eventIds.push(eventId); logInteraction('list-add', eventId, { listId }); }
  else { l.eventIds.splice(idx, 1); logInteraction('list-remove', eventId, { listId }); }
  saveLists();
}

// ---------- Icons (real asset files — see styles.css .icon-* rules) ----------
function icon(name) {
  return `<span class="icon icon-${name}" aria-hidden="true"></span>`;
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---------- Date formatting ----------
const WEEKDAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function todayStr() { return new Date().toISOString().slice(0, 10); }
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function dateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (dateStr === todayStr()) return 'Bugün';
  if (dateStr === addDaysStr(todayStr(), 1)) return 'Yarın';
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
function formatDateTime(dateStr, timeStr) {
  return `${dateLabel(dateStr)} · ${timeStr || '--:--'}`;
}

function truncateText(str, maxLen) {
  if (!str) return '';
  const trimmed = str.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen).trimEnd() + '…';
}

// price is TRY, or null when unknown (not every source resolves it — see
// scripts/eventportal/lib/*.js and EVENTPORTAL-PRICING-RESEARCH.md). Free
// events resolve to a real 0, not null, so they get their own label rather
// than silently rendering as "₺0".
function formatPrice(price) {
  if (price == null) return null;
  if (price === 0) return 'Ücretsiz';
  return `₺${price.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
}

// ---------- Sorting ----------
const SORT_COMPARATORS = {
  'date-asc': (a, b) => (a.date + a.time).localeCompare(b.date + b.time),
  'score-desc': (a, b) => (b.tasteScore ?? -1) - (a.tasteScore ?? -1) || (a.date + a.time).localeCompare(b.date + b.time),
};
const DEFAULT_SORT = 'score-desc';

// ---------- State ----------
const state = {
  events: [],
  filtered: [],
  page: 1,
  search: '',
  sort: DEFAULT_SORT,
  filters: {
    dateFrom: null,
    dateTo: null,
    categories: new Set(),
    list: '',
    favOnly: false,
    showDismissed: false,
    tasteOnly: false,
    weekendOnly: false,
    freeOnly: false,
  },
};
let windowBounds = { start: null, end: null };

function defaultFilters() {
  return {
    dateFrom: windowBounds.start, dateTo: windowBounds.end,
    categories: new Set(), list: '',
    favOnly: false, showDismissed: false, tasteOnly: true, weekendOnly: false, freeOnly: false,
  };
}

// Friday 17:00 through (exclusive) Monday 00:00, Istanbul wall-clock -- date/
// time on every event are already Istanbul local values (see lib/util.js),
// so plain Date#getDay() on a bare "YYYY-MM-DD" (parsed as local midnight)
// gives the right weekday without any timezone conversion.
function isWeekendSession(date, time) {
  const day = new Date(date + 'T00:00:00').getDay(); // 0=Sun ... 5=Fri, 6=Sat
  if (day === 6 || day === 0) return true;
  if (day === 5) return (time || '00:00') >= '17:00';
  return false;
}

// ---------- Data load ----------
async function loadEvents(bustCache) {
  const url = bustCache ? `${DATA_URL}?t=${Date.now()}` : DATA_URL;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  state.events = json.events || [];
  // windowBounds drives the default date filter and the date-input min/max,
  // so it must span the whole accumulated pool -- json.window is only the
  // single day that day's fetch run targeted (see fetch-daily.js), and using
  // it directly here made every earlier accumulated day invisible by default
  // as soon as a newer day was merged in.
  if (state.events.length) {
    const dates = state.events.map(ev => ev.date).sort();
    windowBounds = { start: dates[0], end: dates[dates.length - 1] };
  } else {
    windowBounds = { start: json.window.start, end: json.window.end };
  }
  document.getElementById('lastUpdated').textContent = json.generatedAt
    ? `son güncelleme: ${new Date(json.generatedAt).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}`
    : '';
}

// ---------- Filtering ----------
function matchesSearch(ev, q) {
  if (!q) return true;
  const hay = `${ev.title} ${ev.description || ''} ${ev.venue || ''}`.toLocaleLowerCase('tr');
  return hay.includes(q);
}

// skipCategory lets category-chip counts be computed against every other
// active filter (dates, taste, favorites, dismissed, list, search) without
// a chip's own category filtering itself out of its count.
function eventMatchesFilters(ev, f, q, { skipCategory = false } = {}) {
  if (!f.showDismissed && dismissed.has(ev.id)) return false;
  if (f.favOnly && !favorites.has(ev.id)) return false;
  if (f.tasteOnly && (ev.tasteScore == null || ev.tasteScore < TASTE_THRESHOLD)) return false;
  if (f.dateFrom && ev.date < f.dateFrom) return false;
  if (f.dateTo && ev.date > f.dateTo) return false;
  if (f.weekendOnly && !isWeekendSession(ev.date, ev.time)) return false;
  // "Ücretsiz" means "not a known paid event" -- genuinely free (price 0)
  // and price-undetermined (null, e.g. a source this app can't resolve
  // price for) both pass, since neither is confirmed to cost money.
  if (f.freeOnly && !(ev.price === 0 || ev.price == null)) return false;
  if (!skipCategory && f.categories.size && !f.categories.has(ev.category)) return false;
  if (f.list && !listsForEvent(ev.id).includes(f.list)) return false;
  if (!matchesSearch(ev, q)) return false;
  return true;
}

function applyFilters() {
  const f = state.filters;
  const q = state.search.trim().toLocaleLowerCase('tr');

  state.filtered = state.events.filter(ev => eventMatchesFilters(ev, f, q));
  state.filtered.sort(SORT_COMPARATORS[state.sort] || SORT_COMPARATORS[DEFAULT_SORT]);

  state.page = Math.min(state.page, Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE)));
  render();
}

function categoryCounts() {
  const f = state.filters;
  const q = state.search.trim().toLocaleLowerCase('tr');
  const counts = new Map();
  for (const ev of state.events) {
    if (!eventMatchesFilters(ev, f, q, { skipCategory: true })) continue;
    counts.set(ev.category, (counts.get(ev.category) || 0) + 1);
  }
  return counts;
}

// ---------- Rendering ----------
function render() {
  closePopover();
  document.getElementById('resultCount').textContent = `${state.filtered.length} etkinlik`;
  renderRows();
  renderPagination();
  renderCategoryChips();
  syncToolbarControls();
}

function eventRowHtml(ev) {
  const isFav = favorites.has(ev.id);
  const isDismissed = dismissed.has(ev.id);
  const inList = listsForEvent(ev.id).length > 0;
  const dismissBtn = isDismissed
    ? `<button class="action-btn active" data-action="undismiss" title="Geri yükle">${icon('undo')}</button>`
    : `<button class="action-btn" data-action="dismiss" title="Gizle">${icon('x')}</button>`;
  const moreDatesHtml = ev.sessions && ev.sessions.length > 1
    ? `<span class="sub-item event-more-dates">+${ev.sessions.length - 1} tarih daha</span>`
    : '';
  const scorePill = ev.tasteScore != null
    ? `<span class="score-pill" title="Bana Göre tahmini puan" style="background-color:${scoreColor(ev.tasteScore)}">${ev.tasteScore.toFixed(1)}</span>`
    : '';
  const priceLabel = formatPrice(ev.price);
  const pricePill = priceLabel
    ? `<span class="price-pill${ev.price === 0 ? ' is-free' : ''}">${escapeHtml(priceLabel)}</span>`
    : '';
  const descSnippet = truncateText(ev.description, 90);

  // Tiered by importance: photo/date/title (1) > price/rating (2) >
  // description/hour (3) > venue/extra dates/source/category (4, footer).
  return `
    <article class="event-row${isDismissed ? ' dismissed' : ''}" data-id="${ev.id}">
      <div class="event-thumb">${ev.image ? `<img src="${escapeHtml(ev.image)}" alt="" loading="lazy">` : icon('image')}</div>
      <div class="event-main">
        <div class="event-meta">${dateLabel(ev.date)}<span class="event-time">${ev.time || '--:--'}</span></div>
        <h3 class="event-title">${escapeHtml(ev.title)}</h3>
        ${descSnippet ? `<p class="event-desc">${escapeHtml(descSnippet)}</p>` : ''}
        <div class="event-footer">
          ${ev.venue ? `<span class="sub-item">${icon('pin')}${escapeHtml(ev.venue)}</span>` : ''}
          <span class="sub-item tag-cat">${escapeHtml(ev.category)}</span>
          <span class="sub-item tag-src">${escapeHtml(ev.source)}</span>
          ${moreDatesHtml}
        </div>
      </div>
      <div class="event-badges">${pricePill}${scorePill}</div>
      <div class="event-actions">
        <button class="action-btn${isFav ? ' active' : ''}" data-action="favorite" title="Favorile">${icon('heart')}</button>
        <button class="action-btn${inList ? ' active' : ''}" data-action="list" title="Listeye ekle">${icon('bookmark')}</button>
        ${dismissBtn}
      </div>
    </article>`;
}

function renderRows() {
  const list = document.getElementById('eventList');

  if (state.filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><p>Filtrelerinize uyan etkinlik yok.</p><button type="button" id="emptyClearBtn">Filtreleri temizle</button></div>`;
    return;
  }

  const start = (state.page - 1) * PAGE_SIZE;
  const pageItems = state.filtered.slice(start, start + PAGE_SIZE);
  list.innerHTML = pageItems.map(eventRowHtml).join('');
}

function renderPagination() {
  const el = document.getElementById('pagination');
  const total = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
  if (total <= 1) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;

  const cur = state.page;
  const delta = 2;
  const nums = new Set([1, total]);
  for (let i = Math.max(1, cur - delta); i <= Math.min(total, cur + delta); i++) nums.add(i);
  const sorted = [...nums].sort((a, b) => a - b);

  let html = `<button class="page-btn" data-page="${cur - 1}" ${cur === 1 ? 'disabled' : ''} aria-label="Önceki">${icon('chevron-left')}</button>`;
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) html += `<span class="page-ellipsis">···</span>`;
    html += `<button class="page-btn${n === cur ? ' current' : ''}" data-page="${n}">${n}</button>`;
    prev = n;
  }
  html += `<button class="page-btn" data-page="${cur + 1}" ${cur === total ? 'disabled' : ''} aria-label="Sonraki">${icon('chevron-right')}</button>`;
  el.innerHTML = html;
}

// ---------- Toolbar ----------
function renderCategoryChips() {
  const counts = categoryCounts();
  const active = state.filters.categories;
  document.getElementById('categoryStrip').innerHTML = ALL_CATEGORIES.map(c => {
    const n = counts.get(c) || 0;
    const classes = ['category-chip', n === 0 ? 'zero' : '', active.has(c) ? 'active' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${classes}" data-category="${escapeHtml(c)}">${escapeHtml(c)}<span class="count">${n}</span></button>`;
  }).join('');
}

function renderToolbarOptions() {
  renderListOptions();
}

function renderListOptions() {
  const wrap = document.getElementById('listSelectWrap');
  const ids = Object.keys(lists);
  wrap.hidden = ids.length === 0;
  if (ids.length === 0) return;
  document.getElementById('listSelect').innerHTML =
    `<option value="">Tüm listeler</option>` +
    ids.map(id => `<option value="${id}">${escapeHtml(lists[id].name)} (${lists[id].eventIds.length})</option>`).join('');
}

function syncToolbarControls() {
  const f = state.filters;
  document.getElementById('sortSelect').value = state.sort;
  if (!document.getElementById('listSelectWrap').hidden) document.getElementById('listSelect').value = f.list;
  document.getElementById('favOnlyChip').classList.toggle('active', f.favOnly);
  document.getElementById('showDismissedChip').classList.toggle('active', f.showDismissed);
  document.getElementById('tasteOnlyChip').classList.toggle('active', f.tasteOnly);
  document.getElementById('weekendOnlyChip').classList.toggle('active', f.weekendOnly);
  document.getElementById('freeOnlyChip').classList.toggle('active', f.freeOnly);
}

// ---------- List popover ----------
function closePopover() {
  const p = document.getElementById('listPopover');
  if (p) p.remove();
}

function openListPopover(anchorEl, eventId) {
  closePopover();
  const pop = document.createElement('div');
  pop.className = 'popover';
  pop.id = 'listPopover';
  document.body.appendChild(pop);

  const r = anchorEl.getBoundingClientRect();
  const popW = 210;
  let left = r.left + window.scrollX;
  if (left + popW > window.scrollX + document.documentElement.clientWidth - 8) {
    left = window.scrollX + document.documentElement.clientWidth - popW - 8;
  }
  pop.style.top = `${r.bottom + window.scrollY + 6}px`;
  pop.style.left = `${left}px`;
  pop.addEventListener('click', e => e.stopPropagation());

  function refreshContents() {
    const memberOf = new Set(listsForEvent(eventId));
    const ids = Object.keys(lists);
    const itemsHtml = ids.length
      ? ids.map(id => `
          <label class="popover-item">
            <input type="checkbox" data-list-id="${id}" ${memberOf.has(id) ? 'checked' : ''}>
            ${escapeHtml(lists[id].name)}
          </label>`).join('')
      : '<div style="color:var(--color-muted); font-size:12px; padding:4px;">Henüz liste yok</div>';

    pop.innerHTML = `
      ${itemsHtml}
      <div class="popover-new">
        <input type="text" placeholder="Yeni liste adı" maxlength="40">
        <button type="button">Ekle</button>
      </div>`;

    pop.querySelectorAll('input[data-list-id]').forEach(cb => {
      cb.addEventListener('change', () => toggleEventInList(cb.dataset.listId, eventId));
    });
    const newInput = pop.querySelector('.popover-new input');
    const addBtn = pop.querySelector('.popover-new button');
    function commitNewList() {
      const name = newInput.value.trim();
      if (!name) return;
      const id = createList(name);
      toggleEventInList(id, eventId);
      renderListOptions();
      refreshContents();
    }
    addBtn.addEventListener('click', commitNewList);
    newInput.addEventListener('keydown', e => { if (e.key === 'Enter') commitNewList(); });
  }
  refreshContents();

  setTimeout(() => document.addEventListener('click', closePopoverOnce), 0);
  function closePopoverOnce(e) {
    if (!pop.contains(e.target)) { closePopover(); document.removeEventListener('click', closePopoverOnce); }
  }
}

// ---------- Toast ----------
let toastTimer = null;
function showToast(msg, actionLabel, onAction) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  const btn = document.getElementById('toastAction');
  if (actionLabel) {
    btn.hidden = false;
    btn.textContent = actionLabel;
    btn.onclick = () => { onAction(); toast.classList.remove('show'); };
  } else {
    btn.hidden = true;
    btn.onclick = null;
  }
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 5000);
}

// ---------- Modal ----------
function openModal(ev) {
  logInteraction('view', ev.id);
  const isFav = favorites.has(ev.id);
  const isDismissed = dismissed.has(ev.id);
  const modal = document.getElementById('modal');
  const otherSessions = (ev.sessions || []).slice(1);
  const sessionsHtml = otherSessions.length
    ? `<div class="modal-sessions"><div class="modal-sessions-label">Diğer tarihler</div>${otherSessions
        .map(s => `<div class="modal-session-row">${formatDateTime(s.date, s.time)} · ${escapeHtml(s.source)}</div>`)
        .join('')}</div>`
    : '';
  const primaryLink = (ev.sessions && ev.sessions[0] && ev.sessions[0].link) || ev.link;
  const modalPriceLabel = formatPrice(ev.price);
  modal.innerHTML = `
    <div class="modal-media">
      ${ev.image ? `<img src="${escapeHtml(ev.image)}" alt="">` : icon('image')}
      <button class="modal-close" id="modalCloseBtn" aria-label="Kapat">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="modal-eyebrow">${formatDateTime(ev.date, ev.time)}</div>
      <h2 class="modal-title">${escapeHtml(ev.title)}</h2>
      ${ev.venue ? `<div class="modal-meta-row">${icon('pin')}${escapeHtml(ev.venue)}</div>` : ''}
      <div class="modal-tags">${escapeHtml(ev.category)}${modalPriceLabel ? ` · <span class="tag-price${ev.price === 0 ? ' is-free' : ''}">${escapeHtml(modalPriceLabel)}</span>` : ''} · ${escapeHtml(ev.source)}${ev.tasteScore != null ? ` · <span class="score-pill" style="background-color:${scoreColor(ev.tasteScore)}">${ev.tasteScore.toFixed(1)}</span>` : ''}</div>
      ${ev.description ? `<div class="modal-desc">${escapeHtml(ev.description)}</div>` : ''}
      ${sessionsHtml}
      <div class="modal-actions">
        <button class="action-btn${isFav ? ' active' : ''}" data-action="favorite" data-id="${ev.id}" title="Favorile">${icon('heart')}</button>
        <button class="action-btn" data-action="list" data-id="${ev.id}" title="Listeye ekle">${icon('bookmark')}</button>
        <button class="action-btn${isDismissed ? ' active' : ''}" data-action="${isDismissed ? 'undismiss' : 'dismiss'}" data-id="${ev.id}" title="${isDismissed ? 'Geri yükle' : 'Gizle'}">${isDismissed ? icon('undo') : icon('x')}</button>
        ${primaryLink ? `<a class="btn btn-primary" style="flex:1" href="${escapeHtml(primaryLink)}" target="_blank" rel="noopener noreferrer">${icon('external')}Orijinal İlana Git</a>` : ''}
      </div>
    </div>`;

  document.getElementById('modalBackdrop').classList.add('open');
  modal.querySelector('#modalCloseBtn').addEventListener('click', closeModal);
  modal.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      handleAction(btn.dataset.action, ev.id, btn, ev);
    });
  });
}
function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
}

// ---------- Actions ----------
function handleAction(action, id, btnEl, evObj) {
  const ev = evObj || state.events.find(e => e.id === id);
  if (action === 'favorite') {
    toggleFavorite(id);
    render();
    if (document.getElementById('modalBackdrop').classList.contains('open')) openModal(ev);
  } else if (action === 'dismiss') {
    dismissEvent(id);
    render();
    showToast('Etkinlik listeden gizlendi.', 'Geri Al', () => { undismissEvent(id); render(); });
    if (document.getElementById('modalBackdrop').classList.contains('open')) closeModal();
  } else if (action === 'undismiss') {
    undismissEvent(id);
    render();
    if (document.getElementById('modalBackdrop').classList.contains('open')) openModal(ev);
  } else if (action === 'list') {
    openListPopover(btnEl, id);
  }
}

// ---------- Wiring ----------
function wireEvents() {
  let searchDebounce = null;
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.search = e.target.value;
      state.page = 1;
      applyFilters();
    }, 100);
  });

  document.getElementById('dateFrom').addEventListener('change', e => {
    state.filters.dateFrom = e.target.value || windowBounds.start;
    state.page = 1; applyFilters();
  });
  document.getElementById('dateTo').addEventListener('change', e => {
    state.filters.dateTo = e.target.value || windowBounds.end;
    state.page = 1; applyFilters();
  });
  document.getElementById('sortSelect').addEventListener('change', e => {
    state.sort = e.target.value; state.page = 1; applyFilters();
  });
  document.getElementById('listSelect').addEventListener('change', e => {
    state.filters.list = e.target.value; state.page = 1; applyFilters();
  });
  document.getElementById('favOnlyChip').addEventListener('click', () => {
    state.filters.favOnly = !state.filters.favOnly; state.page = 1; applyFilters();
  });
  document.getElementById('showDismissedChip').addEventListener('click', () => {
    state.filters.showDismissed = !state.filters.showDismissed; state.page = 1; applyFilters();
  });
  document.getElementById('tasteOnlyChip').addEventListener('click', () => {
    state.filters.tasteOnly = !state.filters.tasteOnly; state.page = 1; applyFilters();
  });
  document.getElementById('weekendOnlyChip').addEventListener('click', () => {
    state.filters.weekendOnly = !state.filters.weekendOnly; state.page = 1; applyFilters();
  });
  document.getElementById('freeOnlyChip').addEventListener('click', () => {
    state.filters.freeOnly = !state.filters.freeOnly; state.page = 1; applyFilters();
  });
  document.getElementById('categoryStrip').addEventListener('click', e => {
    const chip = e.target.closest('.category-chip');
    if (!chip) return;
    const c = chip.dataset.category;
    if (state.filters.categories.has(c)) state.filters.categories.delete(c); else state.filters.categories.add(c);
    state.page = 1; applyFilters();
  });

  function clearAll() {
    state.filters = defaultFilters();
    state.sort = DEFAULT_SORT;
    state.search = '';
    document.getElementById('searchInput').value = '';
    document.getElementById('dateFrom').value = windowBounds.start;
    document.getElementById('dateTo').value = windowBounds.end;
    state.page = 1;
    applyFilters();
  }
  document.getElementById('clearFiltersBtn').addEventListener('click', clearAll);
  document.getElementById('eventList').addEventListener('click', e => {
    if (e.target.id === 'emptyClearBtn') clearAll();
  });

  document.getElementById('eventList').addEventListener('click', e => {
    const actionBtn = e.target.closest('[data-action]');
    const row = e.target.closest('.event-row');
    if (!row) return;
    const id = row.dataset.id;
    if (actionBtn) {
      e.stopPropagation();
      handleAction(actionBtn.dataset.action, id, actionBtn);
    } else {
      const ev = state.events.find(x => x.id === id);
      if (ev) openModal(ev);
    }
  });

  document.getElementById('pagination').addEventListener('click', e => {
    const btn = e.target.closest('.page-btn');
    if (!btn || btn.disabled) return;
    state.page = Number(btn.dataset.page);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('modalBackdrop').addEventListener('click', e => {
    if (e.target.id === 'modalBackdrop') closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closePopover(); }
  });

  document.getElementById('refreshBtn').addEventListener('click', async () => {
    try {
      await loadEvents(true);
      renderToolbarOptions();
      applyFilters();
      showToast('Veriler güncellendi.');
    } catch (e) {
      showToast('Güncelleme başarısız oldu.');
    }
  });
}

// ---------- Init ----------
async function init() {
  wireEvents();
  try {
    await loadEvents(false);
  } catch (e) {
    document.getElementById('resultCount').textContent = 'Veriler yüklenemedi.';
    return;
  }
  state.filters = defaultFilters();
  state.sort = DEFAULT_SORT;
  document.getElementById('dateFrom').value = windowBounds.start;
  document.getElementById('dateFrom').min = windowBounds.start;
  document.getElementById('dateFrom').max = windowBounds.end;
  document.getElementById('dateTo').value = windowBounds.end;
  document.getElementById('dateTo').min = windowBounds.start;
  document.getElementById('dateTo').max = windowBounds.end;
  renderToolbarOptions();
  applyFilters();
}

document.addEventListener('DOMContentLoaded', init);
})();
