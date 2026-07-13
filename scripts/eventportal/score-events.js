// Scores every unrated canonical event in eventportal/data/events.json with a
// predicted 1.0-5.0 "would this specific user go" score, blending:
//  (a) a hand-rolled feature-similarity search against the user's own rated
//      events (category/venue/title-overlap -- no embeddings API, keeps this
//      zero-dependency and free), and
//  (b) a Groq LLM call carrying a short taste-profile summary plus the
//      retrieved neighbors as few-shot context.
//
// Runs once daily via eventportal-score.yml, after the fetch workflow has
// merged that day's target-date crawl into the canonical event pool. Since
// events are now canonical (deduped/merged, not one row per showtime), this
// scores each real-world event once regardless of how many sessions it has.
//
// Designed to run for a long time unattended: paces itself off Groq's live
// x-ratelimit-remaining-tokens/reset-tokens response headers (see lib/groq.js)
// rather than a hardcoded rate assumption, and checkpoints the cache file
// every CHECKPOINT_EVERY events so a kill/crash mid-run loses at most a
// handful of calls, and a rerun picks up exactly where it left off.
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./lib/env');
loadEnv();

const { sleep } = require('./lib/util');
const { norm, tokenSet, jaccard } = require('./lib/textsim');
const { callGroq, DEFAULT_MODEL } = require('./lib/groq');

const EVENTS_JSON = path.join(__dirname, '..', '..', 'eventportal', 'data', 'events.json');
const RATINGS_CSV = path.join(__dirname, 'data', 'ratings.csv');
const CACHE_FILE = path.join(__dirname, 'data', 'taste-cache.json');
// Written every checkpoint so eventportal/status.html can poll it and render
// a live progress bar without needing to read the (much larger) events.json.
const PROGRESS_FILE = path.join(__dirname, '..', '..', 'eventportal', 'data', 'taste-progress.json');

const CHECKPOINT_EVERY = 5;
const DISCARD_PHRASE = 'bunu loglamıştım';
const TOKEN_SAFETY_MARGIN = 1500; // pause for the reset window once remaining-tokens drops below this

// Tier-2 deterministic hard exclusions (bypass the LLM call entirely -- both
// free and, per the rated data, 100% consistent with the ground truth found):
// - Stand-up: 21/21 rated stand-up shows scored 1. Unanimous, no exceptions.
// - Named-artist blocklist, scoped to Konser only (avoids short/common words
//   like "çelik" [=steel] false-matching outside a concert context): seeded
//   directly from real "dinlemiyorum" ("I don't listen to [X]") rejection
//   notes. Extend this list by hand as more such notes come in -- it is not
//   maintained automatically.
const BLOCKED_ARTISTS = [
  'pantera', 'çelik', 'bülent ersoy', 'cem özkan', 'ersin gürler akan',
  'ogün sanlısoy', 'gizem öksüz', 'asco', 'yeni türkü',
];

function similarity(target, rated) {
  let s = 0;
  if (target.category === rated.category) s += 3;
  if (target.venue && rated.venue && target.venue === rated.venue) s += 1.5;
  s += 2 * jaccard(tokenSet(target.title), tokenSet(rated.title));
  s += 0.5 * jaccard(tokenSet(target.description), tokenSet(rated.description));
  return s;
}
function topNeighbors(target, ratedList, k = 5, minSim = 1.0) {
  return ratedList
    .map(r => ({ r, sim: similarity(target, r) }))
    .filter(x => x.sim >= minSim)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, k);
}

// ---------- CSV parsing (same state-machine used across the app) ----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') { inQuotes = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function csvToObjects(text) {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  const header = rows[0];
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length === 1 && cells[0] === '') continue;
    const obj = {};
    header.forEach((col, i) => { obj[col] = cells[i]; });
    out.push(obj);
  }
  return out;
}

const TASTE_PROFILE = `Kullanıcı profili (İstanbul etkinlikleri için, kendi geçmiş oylarından çıkarıldı):
- SEVDİĞİ: Klasik edebiyat/tiyatro eserlerinin sahne uyarlamaları (Shakespeare, Dostoyevski, Stefan Zweig, Agatha Christie, Yunan trajedisi, klasik Türk romanları gibi tanınmış eserlere dayanan oyunlar). Mumla aydınlatılmış veya klasik müzik ağırlıklı "deneyim" tarzı konserler (kilise/kültür merkezi gibi atmosferik mekanlarda). El işi ve sanatsal atölyeler, özellikle heykel/resim/hat sanatı gibi somut bir eser ortaya çıkan atölyeler.
- SEVMEDİĞİ: Stand-up komedi ve açık mikrofon geceleri. Kabare/varyete/talk-show formatındaki sahne gösterileri. Orijinal/modern (klasik bir esere dayanmayan) tiyatro oyunları genelde daha az ilgi çekiyor. Jenerik gece kulübü partileri/temalı geceler.
- NÖTR/HAFİF OLUMLU: Genel atölyeler (parfüm, kokteyl gibi tüketim odaklı deneyimler) hafif olumlu ama heyecan uyandırmıyor.
Bu bir KİŞİSEL TERCİH tahmini -- objektif kalite değil, bu KULLANICIYA ne kadar hitap edeceğini tahmin et.`;

function buildPrompt(ev, neighbors) {
  const neighborLines = neighbors.length
    ? neighbors.map(({ r }) => `- "${r.title}" (${r.category}, ${r.venue || 'mekan yok'}) -> kullanıcı puanı: ${r.score}/5`).join('\n')
    : '(benzer geçmiş oy bulunamadı)';
  const desc = (ev.description || '').slice(0, 400);

  return [
    {
      role: 'system',
      content: 'Sen bir etkinlik tavsiye asistanısın. Görevin: kullanıcının geçmiş etkinlik puanlarına bakarak, yeni bir etkinliği o kullanıcının ne kadar beğenebileceğini 1.0-5.0 arası (bir ondalık basamaklı) tahmin etmek. 1.0 = kesinlikle gitmez, 5.0 = kesinlikle gider. SADECE şu JSON formatında cevap ver, başka hiçbir şey yazma: {"score": X.X, "reason": "en fazla 12 kelimelik kısa Türkçe gerekçe"}',
    },
    {
      role: 'user',
      content: `${TASTE_PROFILE}\n\nBenzer geçmiş oylar:\n${neighborLines}\n\nŞimdi puanlanacak etkinlik:\nBaşlık: ${ev.title}\nKategori: ${ev.category}\nMekan: ${ev.venue || 'belirtilmemiş'}\nAçıklama: ${desc || '(açıklama yok)'}\n\nJSON formatında puanla.`,
    },
  ];
}

function parseScoreResponse(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`unparseable Groq response: ${raw.slice(0, 200)}`);
    parsed = JSON.parse(m[0]);
  }
  if (!parsed || typeof parsed.score !== 'number') throw new Error(`no numeric score in response: ${raw.slice(0, 200)}`);
  return { score: Math.max(1, Math.min(5, parsed.score)), reason: String(parsed.reason || '').slice(0, 200) };
}

async function scoreOne(apiKey, ev, ratedList, pacingState) {
  if (pacingState.remainingTokens != null && pacingState.remainingTokens < TOKEN_SAFETY_MARGIN) {
    const wait = Number.isFinite(pacingState.resetTokensMs) ? pacingState.resetTokensMs + 500 : 5000;
    await sleep(wait);
  }

  const neighbors = topNeighbors(ev, ratedList);
  const messages = buildPrompt(ev, neighbors);
  const { content, remainingTokens, resetTokensMs } = await callGroq(apiKey, messages);
  pacingState.remainingTokens = remainingTokens;
  pacingState.resetTokensMs = resetTokensMs;

  const { score: llmScore, reason } = parseScoreResponse(content);

  let finalScore = llmScore;
  if (neighbors.length >= 2) {
    const totalSim = neighbors.reduce((s, n) => s + n.sim, 0);
    const neighborScore = neighbors.reduce((s, n) => s + n.sim * n.r.score, 0) / totalSim;
    finalScore = 0.5 * llmScore + 0.5 * neighborScore;
  }
  return {
    score: Math.round(finalScore * 10) / 10,
    tier: 'scored',
    reason,
    llmScore,
    neighborCount: neighbors.length,
    model: DEFAULT_MODEL,
    computedAt: new Date().toISOString(),
  };
}

function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return {};
  return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
}
function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
}

// Rolling-window rate tracking, module-level since one process = one run.
// A cumulative since-start average drifts toward (and understates the
// volatility of) the true steady-state rate over a long run and reads as a
// misleading "slowdown" even when recent throughput is actually fine (or
// masks a real stall by averaging it away) -- a recent window is what
// actually answers "is it moving right now."
let rateWindow = null; // { time, done }

function writeProgress(eventsData, ratedList, cache, { done, failed, toScoreTotal, isFinal }) {
  let scored = 0, excluded = 0;
  for (const c of Object.values(cache)) {
    if (c.tier === 'scored') scored++;
    else if (c.tier === 'excluded_category' || c.tier === 'excluded_artist') excluded++;
  }
  const now = Date.now();
  let ratePerMin = null;
  if (rateWindow) {
    const dMin = (now - rateWindow.time) / 60000;
    if (dMin > 0) ratePerMin = (done - rateWindow.done) / dMin;
  }
  rateWindow = { time: now, done };
  const remaining = toScoreTotal - done;
  const etaMinutes = ratePerMin ? Math.round(remaining / ratePerMin) : null;

  const progress = {
    total: eventsData.events.length,
    rated: ratedList.length,
    excluded,
    scored,
    toScoreTotal,
    doneThisRun: done,
    failedThisRun: failed,
    percentDone: toScoreTotal > 0 ? Math.round((scored / toScoreTotal) * 1000) / 10 : 100,
    ratePerMin: ratePerMin != null ? Math.round(ratePerMin * 10) / 10 : null,
    etaMinutes,
    updatedAt: new Date().toISOString(),
    done: !!isFinal,
  };
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress));
  return progress;
}

function mergeIntoEventsJson(eventsData, ratedScoreById, cache) {
  for (const ev of eventsData.events) {
    if (ratedScoreById.has(ev.id)) {
      ev.tasteScore = ratedScoreById.get(ev.id);
      ev.tasteTier = 'rated';
    } else if (cache[ev.id]) {
      ev.tasteScore = cache[ev.id].score;
      ev.tasteTier = cache[ev.id].tier;
    } else {
      ev.tasteScore = null;
      ev.tasteTier = 'unscored';
    }
  }
}

async function main() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) { console.error('[score-events] GROQ_API_KEY not set (check .env / repo secret)'); process.exit(1); }

  if (!fs.existsSync(EVENTS_JSON)) {
    console.log(`[score-events] ${EVENTS_JSON} does not exist yet (fetch pipeline hasn't run) -- nothing to score.`);
    return;
  }

  const ratingsRaw = csvToObjects(fs.readFileSync(RATINGS_CSV, 'utf8'))
    .filter(r => !(r.note || '').includes(DISCARD_PHRASE));

  const eventsData = JSON.parse(fs.readFileSync(EVENTS_JSON, 'utf8'));
  const byId = new Map(eventsData.events.map(e => [e.id, e]));

  const ratedList = [];
  const ratedScoreById = new Map();
  for (const r of ratingsRaw) {
    const ev = byId.get(r.id);
    if (!ev) continue;
    const score = Number(r.score);
    ratedScoreById.set(r.id, score);
    ratedList.push({ ...ev, score });
  }
  console.log(`[score-events] ${ratedList.length} rated events loaded as ground truth (of ${ratingsRaw.length} CSV rows after discarding duplicate-fatigue)`);

  const cache = loadCache();

  const toScore = [];
  let newlyExcluded = 0;
  for (const ev of eventsData.events) {
    if (ratedScoreById.has(ev.id)) continue;
    if (cache[ev.id]) continue;

    if (ev.category === 'Stand-up') {
      cache[ev.id] = { score: 1.0, tier: 'excluded_category', reason: 'stand-up (hard exclude)', computedAt: new Date().toISOString() };
      newlyExcluded++;
      continue;
    }
    if (ev.category === 'Konser' && BLOCKED_ARTISTS.some(a => norm(ev.title).includes(a))) {
      cache[ev.id] = { score: 1.0, tier: 'excluded_artist', reason: 'blocked artist (hard exclude)', computedAt: new Date().toISOString() };
      newlyExcluded++;
      continue;
    }
    toScore.push(ev);
  }
  if (newlyExcluded) {
    console.log(`[score-events] ${newlyExcluded} events hard-excluded this run (Stand-up / blocked artist) -- no LLM call needed`);
    saveCache(cache);
  }
  // Fixed for the life of this run (and stable across future runs, since all
  // exclusions happen in the classification pass above before any LLM
  // scoring starts) -- this is the correct denominator for a progress bar,
  // as opposed to toScore.length which shrinks every run as work completes.
  const excludedTotal = Object.values(cache).filter(c => c.tier === 'excluded_category' || c.tier === 'excluded_artist').length;
  const toScoreTotal = eventsData.events.length - ratedList.length - excludedTotal;
  console.log(`[score-events] ${Object.keys(cache).length} total cached, ${toScore.length} remaining to score via LLM (of ${toScoreTotal} total eligible)`);

  const pacingState = { remainingTokens: null, resetTokensMs: null };
  let done = 0, failed = 0;
  writeProgress(eventsData, ratedList, cache, { done, failed, toScoreTotal, isFinal: toScore.length === 0 });

  for (const ev of toScore) {
    try {
      cache[ev.id] = await scoreOne(apiKey, ev, ratedList, pacingState);
      console.log(`[score-events] ${cache[ev.id].score} <- ${ev.title}`);
    } catch (e) {
      failed++;
      console.error(`[score-events] FAILED ${ev.id} (${ev.title}): ${e.message}`);
    }
    done++;
    if (done % CHECKPOINT_EVERY === 0) {
      saveCache(cache);
      mergeIntoEventsJson(eventsData, ratedScoreById, cache);
      fs.writeFileSync(EVENTS_JSON, JSON.stringify(eventsData));
      const progress = writeProgress(eventsData, ratedList, cache, { done, failed, toScoreTotal, isFinal: false });
      console.log(`[score-events] progress ${done}/${toScore.length} (${failed} failed) -- ${progress.ratePerMin ?? '?'}/min (recent), ETA ~${progress.etaMinutes ?? '?'}min -- checkpointed to events.json`);
    }
  }
  saveCache(cache);
  mergeIntoEventsJson(eventsData, ratedScoreById, cache);
  fs.writeFileSync(EVENTS_JSON, JSON.stringify(eventsData));
  writeProgress(eventsData, ratedList, cache, { done, failed, toScoreTotal, isFinal: true });
  console.log(`[score-events] run complete: ${done - failed} scored, ${failed} failed this run -- final write to ${EVENTS_JSON}`);
}

main().catch(err => {
  console.error('[score-events] fatal:', err);
  process.exit(1);
});
