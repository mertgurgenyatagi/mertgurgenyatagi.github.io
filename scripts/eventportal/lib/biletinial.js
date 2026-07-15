// Biletinial exposes a same-origin JSON endpoint (GetAllEventsByCity) that the
// site's own front-end uses for its infinite-scroll listing. It sits behind a
// load-balanced ASP.NET app where some backend nodes redirect the bare path
// to a locale-prefixed one that 404s — the redirect is intermittent per-node,
// not a real block, so fetchWithRetry (with a Referer set) is used to ride it out.
const { withinWindow, splitIsoLike, fetchWithRetry, stripHtml, mapLimit, makeId } = require('./util');

// Resolving descriptions requires a second fetch per event (see
// fetchDescription below) — this used to be lazy/on-demand only, but a
// static build has no live backend left to serve that second call from, so
// every event needs it resolved up front now.
const DESCRIPTION_CONCURRENCY = 20;

const CDN = 'https://b6s54eznn8xq.merlincdn.net';
const ISTANBUL_CITY_ID = 147;
const PAGE_SIZE = 20; // the site's own front-end default; larger values were
// observed to intermittently trip a server-side fallback that returns the
// homepage's HTML (still HTTP 200) instead of JSON.
// The feed is sorted chronologically ascending by SeanceDate. Confirmed live
// that a fixed 15-page cap (300 sessions) doesn't even reach the app's own
// 7-day window end — the real per-request stop condition below is "this
// page's items are already past the window", not a page count. MAX_PAGES is
// now just a runaway-loop safety net (the full feed runs to ~page 143).
const MAX_PAGES = 60;

// The endpoint occasionally returns a 200 OK carrying an HTML fallback page
// instead of JSON (a backend routing quirk, not a hard block) — retry a
// handful of times whenever that happens before giving up on a page.
async function fetchJsonPage(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetchWithRetry(url, {
      headers: {
        Referer: 'https://biletinial.com/tr-tr/sehrineozel/istanbul',
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('json')) return res.json();
  }
  throw new Error('biletinial: endpoint kept returning non-JSON fallback');
}

async function fetchEvents({ start, end }) {
  const out = [];
  const seen = new Set();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://biletinial.com/GetAllEventsByCity?cityId=${ISTANBUL_CITY_ID}&langId=1&countryId=3&langCode=tr&pageNumber=${page}&pageSize=${PAGE_SIZE}&initial=${page === 1}`;
    let data;
    try {
      data = await fetchJsonPage(url);
    } catch (e) {
      break; // give up on further pages, keep what we have
    }

    const items = data.Data || [];
    if (items.length === 0) break;

    // Since the feed is date-sorted ascending, once every item on a page is
    // past the window's end we can stop — no later page can contain an
    // in-window event. A null/unparseable date is treated as ambiguous
    // (doesn't count as "past"), so it never triggers an early stop on its
    // own. This must be computed from every item's date regardless of
    // dedup status — confirmed live that the backend occasionally serves a
    // page whose items all overlap an earlier page (a real backend
    // flakiness, not a window boundary: an independent re-fetch of the same
    // page number returned entirely different, still-in-window data). If the
    // dedup `continue` ran first, every item on such a page would be
    // skipped before its date was ever inspected, leaving allPastWindow
    // stuck at its initial `true` and truncating the crawl dozens of pages
    // early.
    let allPastWindow = true;

    for (const it of items) {
      const { date, time } = splitIsoLike(it.SeanceDate);
      if (!date || date <= end) allPastWindow = false;

      const key = `${it.etkinlikId}-${it.seanceId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (!withinWindow(date, start, end)) continue;

      out.push({
        id: makeId('Biletinial', key, `https://biletinial.com/tr-tr/${it.tipForUrl}/${it.url}`),
        source: 'Biletinial',
        title: it.etkinlik,
        date,
        time,
        category: it.tip || 'Etkinlik',
        venue: it.mekan || null,
        image: it.pic ? `${CDN}${it.pic}` : null,
        description: null,
        link: `https://biletinial.com/tr-tr/${it.tipForUrl}/${it.url}`,
      });
    }

    if (allPastWindow) break;
    if (!data.HasMore) break;
  }

  // Resolve description+price once per unique link (an event's several
  // showtime sessions all share one link, and both fields live on the same
  // detail page) rather than once per row or per field — avoids redundant
  // fetches across a multi-session event and keeps price genuinely free
  // (same page load already needed for the description).
  const uniqueLinks = [...new Set(out.map(ev => ev.link))];
  const detailByLink = new Map();
  await mapLimit(uniqueLinks, DESCRIPTION_CONCURRENCY, async link => {
    detailByLink.set(link, await fetchDetailPage(link).catch(() => ({ description: null, price: null })));
  });
  for (const ev of out) {
    const detail = detailByLink.get(ev.link) || { description: null, price: null };
    ev.description = detail.description;
    ev.price = detail.price;
  }

  return out;
}

// The detail page carries a complete schema.org Offer block right next to
// the itemprop="description" meta this module already reads (confirmed live
// across 6 real events in 4 categories): `<span itemprop="price"
// content="1200,00">` — Turkish decimal notation (comma), "starting from"
// the lowest active ticket tier, matching what the page itself headlines.
function extractPrice(html) {
  const m = html.match(/itemprop="price"[\s\S]*?content="([^"]*)"/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function fetchDetailPage(link) {
  const res = await fetchWithRetry(link);
  const html = await res.text();
  const descMatch = html.match(/itemprop="description"\s+content="([^"]*)"/);
  return {
    description: descMatch ? stripHtml(descMatch[1]) || null : null,
    price: extractPrice(html),
  };
}

async function fetchDescription(link) {
  return (await fetchDetailPage(link)).description;
}

// Used by oggusto.js when it only has a bare Biletinial event link.
async function priceForLink(link) {
  return (await fetchDetailPage(link)).price;
}

module.exports = { fetchEvents, fetchDescription, priceForLink };
