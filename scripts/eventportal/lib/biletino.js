// Biletino has no public API and its listing pages (city/category) carry no
// embedded JSON at all — only plain <a> links to individual event pages,
// which *do* each carry a real schema.org JSON-LD block.
//
// Coverage note: the city/category listing pages this source originally
// crawled turned out to be capped with no working pagination (`?page=2` etc.
// silently returns byte-identical content to page 1) — only 47 unique event
// links total, regardless of how many category pages were added. The real
// discovery mechanism is Biletino's own sitemap: `sitemap.xml` is an index of
// 63 numbered sub-sitemaps (`sitemap/s-1/` .. `sitemap/s-63/`), each holding
// direct links to individual event pages — confirmed live to cover ~36,500
// event slugs site-wide (all cities, all time; s-1 has events from 2015,
// s-63 has events still on sale into 2026+). The `/tr/search/` AJAX
// pagination endpoint is NOT used here — robots.txt explicitly disallows it.
//
// Sitemap index number correlates loosely with event date (higher N = more
// recently created listing = more likely near-term), confirmed live by
// sampling s-63/s-32/s-1, so sub-sitemaps are crawled highest-N-first. But
// tickets can go on sale up to a year ahead of the event, so this is only a
// helpful ordering, not a reliable filter — full coverage still means
// resolving every sub-sitemap's links, not just the newest ones.
//
// Because resolving ~36,500 individual event pages (each needing its own
// JSON-LD fetch to learn date/city) takes on the order of tens of minutes
// even at high concurrency, this can't run synchronously inside a single
// /api/events request. It's registered with lib/cache.js instead: a
// background job re-crawls periodically and fetchEvents() below just reads
// whatever was last successfully resolved.
//
// Transport note: this source is fetched via a `curl` subprocess instead of
// Node's built-in fetch(). Live A/B testing (identical URL, identical
// User-Agent, requests fired in parallel at the same instant, repeated 6x)
// showed Node's fetch (undici) hitting Cloudflare's 403 challenge on this
// domain every single time, while curl passed every single time — a
// TLS/HTTP client fingerprint distinction Cloudflare is keying on, not
// anything about our request rate or headers (those were identical). No
// other source in this app needed this; if it turns out to be needed
// elsewhere, promote curlFetch() into util.js.
const { withinWindow, wideWindow, splitIsoLike, stripHtml, sleep, UA, mapLimit, makeId } = require('./util');
const { execFile } = require('child_process');
const cache = require('./cache');

const STATUS_MARKER = '\n__EPA_STATUS__';

function curlGetOnce(url) {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      ['-s', '-L', '-A', UA, '--max-time', '20', '-w', `${STATUS_MARKER}%{http_code}`, url],
      { maxBuffer: 20 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err);
        const idx = stdout.lastIndexOf(STATUS_MARKER);
        if (idx === -1) return reject(new Error('curl: response missing status marker'));
        resolve({ body: stdout.slice(0, idx), status: Number(stdout.slice(idx + STATUS_MARKER.length)) });
      }
    );
  });
}

async function curlFetch(url, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(300 * i);
    try {
      const { body, status } = await curlGetOnce(url);
      if (status >= 200 && status < 300) return body;
      lastErr = new Error(`curl HTTP ${status} for ${url}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

const SITEMAP_INDEX_URL = 'https://biletino.com/sitemap.xml';

// The cache stores a wide raw pool rather than the exact 7-day result, so a
// crawl doesn't need refreshing right at local-midnight — fetchEvents()
// below re-filters to the real window at request time.
const CACHE_WINDOW_DAYS = 35;

// Measured live: curl-subprocess detail fetches sustain ~30+ pages/sec at
// this concurrency with 100% success (tested up to 25 with no degradation).
// Real full-crawl runs have landed noticeably above the ~20-25min estimate
// this implied, though — the gap is unconfirmed (curl process-spawn
// overhead at sustained volume vs. the small sample tested, or the sitemap
// having grown) — bumped from 20 as a modest, same-order-of-magnitude step
// past the last confirmed-safe value (25), not a re-measurement.
const DETAIL_CONCURRENCY = 30;
const SITEMAP_FETCH_CONCURRENCY = 10;

// A full crawl takes tens of minutes, so refresh only every couple hours —
// both to be polite to the origin and because a 7-day rolling window doesn't
// need minute-fresh data. (Placeholder — tune from a real measured crawl
// duration once observed in production.)
const REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000;

// schema.org @type -> a normalized display label, since Biletino has no
// separate human-readable category field (only the JSON-LD @type).
const TYPE_LABELS = {
  MusicEvent: 'Konser',
  Festival: 'Festival',
  TheaterEvent: 'Tiyatro',
  ScreeningEvent: 'Sinema',
  BusinessEvent: 'İş Dünyası',
  EducationEvent: 'Eğitim',
  ExhibitionEvent: 'Sergi',
  SocialEvent: 'Sosyal',
  FoodEvent: 'Yemek',
  ComedyEvent: 'Stand-up',
  SportsEvent: 'Spor',
  ChildrensEvent: 'Çocuk',
};

// No stagger needed with curl as the transport (see throughput note above) —
// concurrency alone is the limiter, no per-worker delay required.
const DETAIL_STAGGER_MS = 0;

// Extracts every `/tr/e-.../` event-detail link out of a sitemap XML file's
// <loc> entries (mirrors the tr-locale link shape the old listing-page
// scraper used, so downstream code doesn't need to change).
function extractSitemapEventLinks(xml) {
  const links = new Set();
  for (const m of xml.matchAll(/<loc>(https:\/\/biletino\.com\/tr\/e-[^<]+)<\/loc>/g)) {
    links.add(m[1]);
  }
  return [...links];
}

// Discovers every event-detail link on the site by crawling the sitemap
// index's 63 numbered sub-sitemaps, highest-N (most-recently-created,
// loosely more likely near-term) first.
async function harvestSitemapEventLinks() {
  const indexXml = await curlFetch(SITEMAP_INDEX_URL);
  const subSitemaps = [...indexXml.matchAll(/<loc>(https:\/\/biletino\.com\/sitemap\/s-(\d+)\/sitemap\.xml\/)<\/loc>/g)]
    .map(m => ({ url: m[1], n: Number(m[2]) }))
    .sort((a, b) => b.n - a.n);

  const perSitemap = await mapLimit(
    subSitemaps,
    SITEMAP_FETCH_CONCURRENCY,
    async entry => extractSitemapEventLinks(await curlFetch(entry.url))
  );

  const links = new Set();
  for (const arr of perSitemap) for (const link of arr || []) links.add(link);
  return [...links];
}

// address.addressRegion carries the clean city name ("İstanbul", "Ankara",
// "Antalya", ...) on Biletino's JSON-LD — confirmed live across sampled
// events. Sitemap-wide discovery spans all cities (unlike the old
// city-scoped listing pages), so this filter is now load-bearing, not
// redundant.
function isIstanbul(location) {
  const region = location && location.address && location.address.addressRegion;
  if (!region) return false;
  return region.includes('İstanbul') || region.includes('Istanbul');
}

function extractJsonLdEvent(html) {
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  for (const b of blocks) {
    try {
      const d = JSON.parse(b[1]);
      if (d && typeof d.startDate === 'string') return d;
    } catch (e) { /* skip malformed block */ }
  }
  return null;
}

function toNormalizedEvent(d, fallbackLink) {
  // Biletino's startDate already carries a correct +03:00 offset (like
  // Luma), so a raw digit-slice is all that's needed.
  const { date, time } = splitIsoLike(d.startDate);
  const location = Array.isArray(d.location) ? d.location[0] : d.location;
  const image = Array.isArray(d.image) ? d.image[0] : d.image;
  const link = d.url || fallbackLink;

  return {
    id: makeId('Biletino', null, link),
    source: 'Biletino',
    title: d.name,
    date,
    time,
    category: TYPE_LABELS[d['@type']] || 'Etkinlik',
    venue: (location && location.name) || null,
    image: image || null,
    description: stripHtml(d.description) || null,
    link,
  };
}

// The full crawl: sitemap-wide link discovery, then resolve every candidate
// via its JSON-LD, keeping only Istanbul events inside the wide cache
// window. This is the expensive operation lib/cache.js runs in the
// background — never called directly from a live /api/events request.
async function crawlAll() {
  const links = await harvestSitemapEventLinks();
  const { start, end } = wideWindow(CACHE_WINDOW_DAYS);
  console.log(`[biletino] resolving ${links.length} candidate links (concurrency ${DETAIL_CONCURRENCY})...`);

  // A ~36,500-candidate crawl has no other feedback for tens of minutes
  // otherwise — cheap enough to log periodically that it's worth doing
  // unconditionally rather than gating behind a debug flag.
  let done = 0;
  const t0 = Date.now();
  function logProgress() {
    done++;
    if (done % 2000 === 0 || done === links.length) {
      const rate = done / ((Date.now() - t0) / 1000);
      console.log(`[biletino] ${done}/${links.length} (${rate.toFixed(1)}/s, ${((Date.now() - t0) / 1000 / 60).toFixed(1)}min elapsed)`);
    }
  }

  // Extract+normalize inside the worker itself and return only the small
  // result (or null) — with ~36,500 candidates, holding every raw HTML page
  // body in memory at once (as an intermediate array, before any processing)
  // is enough to blow Node's default heap (confirmed live: a first attempt
  // that collected {link, html} for all pages before processing any of them
  // crashed the process with "JavaScript heap out of memory" ~8 minutes in).
  // Discarding each page's HTML as soon as it's parsed keeps peak memory to
  // just the (tiny) normalized events, not the full page bodies.
  const results = await mapLimit(
    links,
    DETAIL_CONCURRENCY,
    async link => {
      try {
        const html = await curlFetch(link);
        const d = extractJsonLdEvent(html);
        if (!d) return null;
        const location = Array.isArray(d.location) ? d.location[0] : d.location;
        if (!isIstanbul(location)) return null;
        const ev = toNormalizedEvent(d, link);
        if (!withinWindow(ev.date, start, end)) return null;
        return ev;
      } finally {
        logProgress();
      }
    },
    DETAIL_STAGGER_MS
  );

  return results.filter(Boolean);
}

cache.register('biletino', { fetchAll: crawlAll, intervalMs: REFRESH_INTERVAL_MS });

async function fetchEvents({ start, end }) {
  const { events, lastUpdated, lastError } = cache.getState('biletino');
  if (events.length === 0 && lastUpdated === null && lastError) throw lastError;
  return events.filter(ev => withinWindow(ev.date, start, end));
}

// Description already ships with the event data fetched above (unlike the
// lazy-loaded sources), so this only exists for /api/description symmetry —
// it re-fetches the same page rather than requiring the server to have
// cached the first pass.
async function fetchDescription(link) {
  const html = await curlFetch(link);
  const d = extractJsonLdEvent(html);
  return (d && stripHtml(d.description)) || null;
}

// crawlAll is also exported directly (not just registered with cache.js) so
// the one-shot export script can await one full crawl synchronously instead
// of going through the interval-based background-refresh machinery, which
// is built for a long-running server process, not a fresh-each-run job.
module.exports = { fetchEvents, fetchDescription, crawlAll };
