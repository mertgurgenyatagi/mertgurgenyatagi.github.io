// Generic in-memory background-refresh registry for sources whose full crawl
// is too slow/heavy to run synchronously inside a single /api/events request
// (Biletino and Biletix both need to resolve thousands of individual event
// pages just to know which ones are Istanbul + in the date window). Each
// registered source refreshes itself on an interval; requests always read
// whatever was last successfully crawled instead of waiting on a live fetch.
const stores = new Map();

function refresh(name) {
  const entry = stores.get(name);
  if (!entry || entry.refreshing) return;
  entry.refreshing = true;
  entry.fetchAll()
    .then(events => {
      entry.events = events;
      entry.lastUpdated = Date.now();
      entry.lastError = null;
    })
    .catch(err => {
      // Leave entry.events untouched — stale-but-good data keeps serving.
      entry.lastError = err;
      console.error(`[cache] ${name} refresh failed:`, err);
    })
    .finally(() => {
      entry.refreshing = false;
    });
}

// Registers a source's crawl function and kicks off the first (cold-start)
// refresh immediately, fire-and-forget — the HTTP server does not wait on
// this, so it starts serving right away and this source's cached results
// simply fill in once the first crawl completes.
//
// The one-shot export script (scripts/build-snapshot.js) requires these same
// source modules but calls crawlAll() directly and awaits it — it has no use
// for interval-based background refresh, and if this auto-start ran there
// too, every module require() would kick off a second, redundant full crawl
// racing the explicit one. That script sets EPA_SKIP_CACHE_AUTOSTART=1
// before requiring any lib/* modules so register() only records the entry.
function register(name, { fetchAll, intervalMs }) {
  stores.set(name, { fetchAll, events: [], lastUpdated: null, lastError: null, refreshing: false });
  if (process.env.EPA_SKIP_CACHE_AUTOSTART === '1') return;
  refresh(name);
  setInterval(() => refresh(name), intervalMs);
}

function getState(name) {
  const entry = stores.get(name);
  if (!entry) throw new Error(`cache: no source registered as "${name}"`);
  return { events: entry.events, lastUpdated: entry.lastUpdated, lastError: entry.lastError, refreshing: entry.refreshing };
}

module.exports = { register, getState };
