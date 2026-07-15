// Daily fetch: crawls all 9 sources for exactly ONE calendar day -- the day
// that is 8 days ahead of today in Istanbul -- and merges the results into a
// persisted, accumulating pool of canonical (deduped, multi-session) events
// at eventportal/data/events.json. Replaces the old build-snapshot.js, which
// recomputed a full 7-day window from scratch on every run.
//
// Runs via eventportal-fetch.yml at 04:00 Istanbul daily. Each calendar date
// is targeted exactly once, ever -- there is no later run that re-checks a
// date once its day+8 crawl has happened, so an event a source lists only
// after that point is permanently missed for that date. This is intentional
// (see the migration plan), not a bug.
//
// EPA_SKIP_CACHE_AUTOSTART must be set before any lib/* module is required:
// biletino.js/biletix.js call cache.register() at require-time, which would
// otherwise kick off its own background crawl racing the explicit crawlAll()
// call below -- doubling load on those two origins for nothing.
process.env.EPA_SKIP_CACHE_AUTOSTART = '1';

const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./lib/env');
loadEnv();

const { targetDayWindow, istanbulToday } = require('./lib/util');
const { categorize } = require('./lib/categorize');
const { mergeDay, pruneAndDerive, pruneIndex } = require('./lib/canonical');

const SOURCES = [
  { name: 'Bubilet', module: require('./lib/bubilet'), mode: 'fetchEvents' },
  { name: 'Biletinial', module: require('./lib/biletinial'), mode: 'fetchEvents' },
  { name: 'Oggusto', module: require('./lib/oggusto'), mode: 'fetchEvents' },
  { name: 'Luma', module: require('./lib/luma'), mode: 'fetchEvents' },
  { name: 'IKSV', module: require('./lib/iksv'), mode: 'fetchEvents' },
  { name: 'Biletino', module: require('./lib/biletino'), mode: 'crawlAll' },
  { name: 'Bugece', module: require('./lib/bugece'), mode: 'fetchEvents' },
  { name: 'KulturIstanbul', module: require('./lib/kulturistanbul'), mode: 'fetchEvents' },
  { name: 'Biletix', module: require('./lib/biletix'), mode: 'crawlAll' },
];

const OUT_DIR = path.join(__dirname, '..', '..', 'eventportal', 'data');
const EVENTS_JSON = path.join(OUT_DIR, 'events.json');
const INDEX_JSON = path.join(__dirname, 'data', 'canonical-index.json');

async function runSource({ name, module, mode }, window) {
  const t0 = Date.now();
  try {
    const raw = mode === 'crawlAll' ? await module.crawlAll() : await module.fetchEvents(window);
    const events =
      mode === 'crawlAll' ? raw.filter(ev => ev.date >= window.start && ev.date <= window.end) : raw;
    return { name, ok: true, count: events.length, durationMs: Date.now() - t0, error: null, events };
  } catch (err) {
    return { name, ok: false, count: 0, durationMs: Date.now() - t0, error: String((err && err.message) || err), events: [] };
  }
}

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function main() {
  const targetDay = process.env.TARGET_DATE || targetDayWindow(8).start;
  const window = { start: targetDay, end: targetDay };
  const startedAt = new Date().toISOString();
  console.log(`[fetch-daily] target day ${targetDay}`);

  // Briefly changed this to run sources one at a time, suspecting cross-
  // source resource contention was degrading price-resolution sub-requests
  // -- live diagnostics disproved that (Biletinial/Biletix both resolved
  // price reliably from this same CI environment at full internal
  // concurrency, run in isolation and in bursts). The real bug was in
  // mergeDay() silently no-op'ing already-seen sessions instead of
  // backfilling a newly-resolved price (see lib/canonical.js) -- reverted
  // back to the original concurrent design now that that's fixed.
  const results = await Promise.all(SOURCES.map(src => runSource(src, window)));

  const rawEvents = [];
  const sourcesStatus = {};
  for (const r of results) {
    rawEvents.push(...r.events);
    sourcesStatus[r.name] = { ok: r.ok, count: r.count, durationMs: r.durationMs, error: r.error };
    const line = r.ok
      ? `[fetch-daily] ${r.name}: ${r.count} events in ${(r.durationMs / 1000).toFixed(1)}s`
      : `[fetch-daily] ${r.name}: FAILED after ${(r.durationMs / 1000).toFixed(1)}s -- ${r.error}`;
    console.log(line);
  }

  // Replace each source's own inconsistent category tag with our custom
  // classification (see research/event-category-analysis.md) before merging.
  for (const ev of rawEvents) {
    ev.sourceCategory = ev.category;
    ev.category = categorize(ev);
  }

  const anyFailed = results.some(r => !r.ok);
  if (rawEvents.length === 0 && anyFailed) {
    console.error('[fetch-daily] zero events produced and at least one source failed -- aborting without writing, to avoid pruning the pool against a broken/empty day.');
    process.exit(1);
  }

  const pool = loadJson(EVENTS_JSON, { events: [] });
  const index = loadJson(INDEX_JSON, {});
  const poolSizeBefore = pool.events.length;

  const { created, sessionsAdded } = mergeDay(pool.events, rawEvents, index);
  const today = istanbulToday();
  const { survivors, sessionsPruned } = pruneAndDerive(pool.events, today);
  pruneIndex(index, survivors);

  const finishedAt = new Date().toISOString();
  const status = {
    generatedAt: finishedAt,
    startedAt,
    window,
    totalEvents: survivors.length,
    anyFailed,
    sources: sourcesStatus,
    poolSizeBefore,
    poolSizeAfter: survivors.length,
    canonicalEventsCreatedThisRun: created,
    sessionsAddedThisRun: sessionsAdded,
    sessionsPrunedThisRun: sessionsPruned,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(EVENTS_JSON, JSON.stringify({ generatedAt: finishedAt, window, events: survivors }));
  fs.writeFileSync(path.join(OUT_DIR, 'status.json'), JSON.stringify(status, null, 2));
  fs.writeFileSync(INDEX_JSON, JSON.stringify(index));

  console.log(`[fetch-daily] pool ${poolSizeBefore} -> ${survivors.length} events (+${created} new, +${sessionsAdded} sessions, -${sessionsPruned} pruned sessions) -- wrote ${OUT_DIR}`);
}

main().catch(err => {
  console.error('[fetch-daily] fatal error:', err);
  process.exit(1);
});
