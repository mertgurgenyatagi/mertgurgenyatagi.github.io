// Biletix (Ticketmaster Turkey) has no documented public API, and static
// analysis of its Angular bundle initially pointed at the wrong endpoint
// shape entirely — every guessed path 301'd into a Varnish-level "unknown
// route" redirect, which looked like blocking but was actually just a wrong
// URL. Reading the *exact* call site in the bundle's event service (not just
// grepping isolated strings) revealed the real one:
//
//   GET {host}/api/v1/bxcached/event/getEventDetail/{eventCode}/{channel}/{lang}
//
// with channel defaulting to "INTERNET" (a sales-channel code, unrelated to
// the "TURKIYE"/"ISTANBUL" region segment used in page URLs — that mismatch
// is what made every earlier guess fail). Verified live: fully stateless (no
// cookies/session needed), works identically via curl and Node's fetch (no
// TLS-fingerprint issue like Biletino), and returns a very rich per-event
// payload. The one confirmed anti-bot control is a plain User-Agent
// blocklist (python-requests-style UAs get a 403 `{"response":"block"}`); a
// normal browser UA (or even curl's bare default) passes every time.
//
// Coverage note: Biletix has no discovered "list events in city X" endpoint
// (the Angular app's own search call lives in a lazy-loaded chunk not
// reachable via static analysis, and the one guess made at its request body
// shape 301'd). The original approach here harvested candidate event codes
// from Biletix's own curated homepage + category pages, which only surfaced
// 33 unique codes — those pages skew toward big touring/arena shows booked
// weeks out. The real fix: `robots.txt` declares `Sitemap:
// {host}/wbtxapi/api/v1/siteMap/index`, a sitemap index whose `event`
// sub-sitemap (`.../wbtxapi/api/v1/siteMap/event`, plain XML `<urlset>`) lists
// **2,338** event codes directly — confirmed live, ~40-60% of which resolve
// to Istanbul venues once enriched via the detail endpoint below. Unlike
// Biletino, this endpoint needs no curl workaround (plain `fetch` sustains
// ~70+ req/sec here with 100% success, confirmed live) and a full crawl of
// all 2,338 codes takes well under a minute — still registered with
// lib/cache.js rather than run inline per-request, both so a UI click never
// triggers ~2,300 outbound requests and so /api/events stays instant.
const { withinWindow, wideWindow, stripHtml, fetchWithRetry, mapLimit, makeId } = require('./util');
const cache = require('./cache');

const IMAGE_BASE = 'https://www.biletix.com/static/images/live/event/eventimages/';
const SITEMAP_URL = 'https://www.biletix.com/wbtxapi/api/v1/siteMap/event';
const CHANNEL = 'INTERNET';

// No subprocess overhead on this origin (unlike Biletino), so a higher
// concurrency is fine — measured live with 100% success up to 40.
const DETAIL_CONCURRENCY = 30;

// Price resolution is 2 extra requests per kept event (getPerformanceList +
// getPriceByProfiles, on top of the getEventDetail already fetched above),
// only run against events that already passed the Istanbul+window filter —
// same concurrency ballpark as DETAIL_CONCURRENCY, both endpoints confirmed
// live to be as cheap/stateless as getEventDetail.
const PRICE_CONCURRENCY = 30;

// Cache stores a wide raw pool so a refresh doesn't need to land exactly at
// local-midnight — fetchEvents() below re-filters to the real window.
const CACHE_WINDOW_DAYS = 35;

// A full crawl measured well under a minute, so this can refresh often
// without being impolite — still not every request, to keep /api/events
// instant and avoid a burst of ~2,300 requests per button click.
const REFRESH_INTERVAL_MS = 20 * 60 * 1000;

function isIstanbul(venueCity) {
  const c = venueCity || '';
  return c.includes('İstanbul') || c.includes('Istanbul');
}

// eventCategory comes back shouting-case ("MÜZİK"); subCategory is normal
// case and more specific when present ("Diğer Müzik") — prefer that, else
// lightly re-case the primary category instead of showing it all-caps.
function pickCategory(d) {
  if (d.subCategory) return d.subCategory;
  if (!d.eventCategory) return 'Etkinlik';
  const lower = d.eventCategory.toLocaleLowerCase('tr');
  return lower.charAt(0).toLocaleUpperCase('tr') + lower.slice(1);
}

async function harvestSitemapCodes() {
  const res = await fetchWithRetry(SITEMAP_URL);
  const xml = await res.text();
  const codes = new Set();
  for (const m of xml.matchAll(/\/etkinlik\/([A-Z0-9]{4,8})\//g)) codes.add(m[1]);
  return [...codes];
}

async function fetchEventDetail(code) {
  const url = `https://www.biletix.com/wbtxapi/api/v1/bxcached/event/getEventDetail/${code}/${CHANNEL}/tr`;
  const res = await fetchWithRetry(url);
  const json = await res.json();
  return json.status === 'SUCCESS' ? json.data : null;
}

async function fetchPerformanceList(code) {
  const url = `https://www.biletix.com/wbtxapi/api/v1/bxcached/event/getPerformanceList/${code}/${CHANNEL}/tr`;
  const res = await fetchWithRetry(url);
  const json = await res.json();
  return json.status === 'SUCCESS' && Array.isArray(json.data) ? json.data : [];
}

// getPriceByProfiles is the endpoint the live Angular app actually uses
// (found by reading its production bundle) — a same-named-but-different
// endpoint, getPriceInfos, looked plausible from the bundle's method names
// too but returns nothing but 500s live; getPriceByProfiles is fully public
// and stateless, confirmed live with a clean curl, no cookies/session. A
// single event/performance can expose more than one simultaneous price key
// (seat category × campaign/discount variant, confirmed live on 6 of 8
// sampled events) — this takes the lowest maxPrice across all of them as the
// "starting from" figure, mirroring what Biletix's own detail page would
// headline. Values are kuruş (TRY/100); a present-but-empty tier list is a
// real, observed possibility (not an error) and just yields no price.
async function fetchPriceByProfiles(code, performanceCode) {
  const url = `https://www.biletix.com/wbtxapi/api/v1/bxcached/event/getPriceByProfiles/${code}/${performanceCode}/${CHANNEL}/tr`;
  const res = await fetchWithRetry(url);
  const json = await res.json();
  if (json.status !== 'SUCCESS' || !json.data) return null;
  let min = null;
  for (const tiers of Object.values(json.data)) {
    for (const tier of tiers || []) {
      const n = typeof tier.maxPrice === 'number' ? tier.maxPrice / 100 : null;
      if (n != null && (min === null || n < min)) min = n;
    }
  }
  return min;
}

// Resolves price for a specific performance if performanceCode is already
// known, else picks the event's earliest still-relevant performance first.
// getPerformanceList isn't perfectly date-sorted at the past/future boundary
// (already-elapsed performances can appear out of order at the end of the
// array, confirmed live) — matching by exact performanceDate against
// firstPerformanceDate (when available, e.g. from getEventDetail) is the
// correct selection rule; falling back to "first non-elapsed entry" when no
// target date is known (e.g. when called from oggusto.js with only a bare
// link). Exported for oggusto.js's own Biletix-affiliate-link dispatch.
async function priceForEventCode(code, performanceCode, firstPerformanceDate) {
  let perfCode = performanceCode;
  if (!perfCode) {
    const performances = await fetchPerformanceList(code);
    const match =
      (firstPerformanceDate != null && performances.find(p => p.performanceDate === firstPerformanceDate)) ||
      performances.find(p => p.status !== 's13_old_over');
    if (!match) return null;
    perfCode = match.performanceCode;
  }
  return fetchPriceByProfiles(code, perfCode);
}

// The full crawl: sitemap-wide code discovery, then resolve every candidate
// via the detail endpoint, keeping only Istanbul events inside the wide
// cache window. This is what lib/cache.js runs in the background.
async function crawlAll() {
  const codes = await harvestSitemapCodes();
  const { start, end } = wideWindow(CACHE_WINDOW_DAYS);
  const details = await mapLimit(codes, DETAIL_CONCURRENCY, c => fetchEventDetail(c));

  const out = [];
  // {ev, code, firstPerformanceDate} kept alongside `out` so the price pass
  // below can resolve the correct performance without re-deriving it from
  // the already-normalized event shape.
  const pending = [];
  for (const d of details) {
    if (!d || !d.firstPerformanceDate) continue;
    if (!isIstanbul(d.venueCity)) continue;

    // firstPerformanceDate is a true UTC epoch-ms instant (confirmed live by
    // cross-checking against the "15.00–00.00" start time written directly
    // in that event's own description text after +3h conversion).
    const istanbul = new Date(d.firstPerformanceDate + 3 * 3600 * 1000);
    const date = istanbul.toISOString().slice(0, 10);
    const time = istanbul.toISOString().slice(11, 16);
    if (!withinWindow(date, start, end)) continue;

    const ev = {
      id: makeId('Biletix', d.eventCode, null),
      source: 'Biletix',
      title: d.eventName,
      date,
      time,
      category: pickCategory(d),
      venue: d.venueName || null,
      image: d.image ? `${IMAGE_BASE}${d.image}` : null,
      description: stripHtml(d.eventDescription) || null,
      link: `https://www.biletix.com/etkinlik/${d.eventCode}/TURKIYE/tr`,
      price: null,
    };
    out.push(ev);
    pending.push({ ev, code: d.eventCode, firstPerformanceDate: d.firstPerformanceDate });
  }

  // Only price-resolve events that survived the Istanbul+window filter above
  // (not all ~2,300 sitemap candidates) — 2 extra requests each, but against
  // a much smaller, already-relevant set.
  await mapLimit(pending, PRICE_CONCURRENCY, async p => {
    p.ev.price = await priceForEventCode(p.code, null, p.firstPerformanceDate).catch(() => null);
  });

  return out;
}

cache.register('biletix', { fetchAll: crawlAll, intervalMs: REFRESH_INTERVAL_MS });

async function fetchEvents({ start, end }) {
  const { events, lastUpdated, lastError } = cache.getState('biletix');
  if (events.length === 0 && lastUpdated === null && lastError) throw lastError;
  return events.filter(ev => withinWindow(ev.date, start, end));
}

// Description already ships with the detail fetch above, so this only
// exists for /api/description symmetry — it re-fetches by parsing the
// event code back out of the link rather than requiring a cache.
async function fetchDescription(link) {
  const m = link.match(/\/etkinlik\/([A-Z0-9]{4,8})\//);
  if (!m) return null;
  const d = await fetchEventDetail(m[1]);
  return (d && stripHtml(d.eventDescription)) || null;
}

// crawlAll is also exported directly (not just registered with cache.js) so
// the one-shot export script can await one full crawl synchronously instead
// of going through the interval-based background-refresh machinery, which
// is built for a long-running server process, not a fresh-each-run job.
module.exports = { fetchEvents, fetchDescription, crawlAll, priceForEventCode };
