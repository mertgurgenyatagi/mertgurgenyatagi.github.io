// Bubilet embeds full event data server-side as a React Server Components
// stream (self.__next_f.push(...) chunks). There's no public JSON API, so we
// decode that stream and pull out the "events":[...] arrays it contains.
const { withinWindow, splitUtcToIstanbul, stripHtml, fetchWithRetry, mapLimit, makeId } = require('./util');

const CDN = 'https://cdn.bubilet.com.tr';

// The homepage alone only surfaces a small curated set of events, so we also
// pull a handful of category pages and merge+dedupe by event id to get
// meaningfully close to full week coverage without crawling all 600+ detail
// pages individually.
const LISTING_PAGES = [
  'https://www.bubilet.com.tr/istanbul',
  'https://www.bubilet.com.tr/istanbul/etiket/konser',
  'https://www.bubilet.com.tr/istanbul/etiket/tiyatro',
  'https://www.bubilet.com.tr/istanbul/etiket/stand-up',
  'https://www.bubilet.com.tr/istanbul/etiket/festival',
  'https://www.bubilet.com.tr/istanbul/etiket/cocuk-aktiviteleri',
  'https://www.bubilet.com.tr/istanbul/etiket/eglence',
  'https://www.bubilet.com.tr/istanbul/etiket/elektronik-muzik',
];

function extractJsonArray(text, startIndex) {
  let depth = 0, inString = false, escape = false;
  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return text.slice(startIndex, i + 1);
    }
  }
  return null;
}

// Finds every `"events":[ ... ]` block in the decoded RSC stream and parses
// each as standalone JSON (the event objects themselves don't contain any
// React-fiber references, only their surrounding wrapper does).
function extractEventObjects(combined) {
  const events = new Map();
  const marker = '"events":[';
  let idx = 0;
  while ((idx = combined.indexOf(marker, idx)) !== -1) {
    const arrStart = idx + marker.length - 1;
    const arrText = extractJsonArray(combined, arrStart);
    idx += marker.length;
    if (!arrText) continue;
    try {
      const arr = JSON.parse(arrText);
      for (const ev of arr) if (ev && ev.id != null) events.set(ev.id, ev);
    } catch (e) { /* malformed chunk boundary, skip */ }
  }
  return [...events.values()];
}

function decodeRscStream(html) {
  const regex = /self\.__next_f\.push\(\[1,(".*?")\]\)/gs;
  let m, combined = '';
  while ((m = regex.exec(html)) !== null) {
    try { combined += JSON.parse(m[1]); } catch (e) { /* skip */ }
  }
  return combined;
}

async function decodePage(url) {
  const res = await fetchWithRetry(url);
  const html = await res.text();
  return extractEventObjects(decodeRscStream(html));
}

// Reads a JSON string value out of the raw (not-fully-valid-JSON) RSC text,
// starting the search at `fromIndex`. Returns both the decoded value and
// where to resume searching, since a key like "summary" can appear more than
// once on a page for unrelated components.
function extractJsonStringValue(text, key, fromIndex) {
  const marker = `"${key}":"`;
  const idx = text.indexOf(marker, fromIndex);
  if (idx === -1) return null;
  const start = idx + marker.length;
  let i = start, escape = false;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') break;
  }
  let value = null;
  try { value = JSON.parse(`"${text.slice(start, i)}"`); } catch (e) { /* malformed escape, skip */ }
  return { value, nextIndex: i + 1 };
}

// Detail pages embed a "summary" field with real marketing prose (HTML),
// separate from — and much richer than — the JSON-LD Event.description
// field, which Bubilet fills with just the event title. "summary" isn't
// unique to the event, though: the same key is reused by an unrelated
// review-aggregation widget, and either occurrence can be an unresolved
// React Server Component reference token (e.g. "$41:props:...") rather than
// real text if that part of the page wasn't inlined. Scan every occurrence
// and take the first one that's actually real prose.
function findRealSummary(combined) {
  let idx = 0;
  for (;;) {
    const found = extractJsonStringValue(combined, 'summary', idx);
    if (!found) return null;
    idx = found.nextIndex;
    if (found.value && !found.value.startsWith('$') && found.value.trim().length > 20) {
      return found.value;
    }
  }
}

function pickImage(files) {
  const file = (files || []).find(f => f.displayArea === 'yatayResim') || (files || [])[0];
  if (!file) return null;
  // Bubilet serves images through Cloudflare's image-resizing proxy; ask for
  // a small, heavily-compressed webp instead of the original.
  return `${CDN}/cdn-cgi/image/width=200,quality=45,format=webp${file.url}`;
}

// The 8 listing pages above are each individually capped at ~20-55 curated
// events with no pagination mechanism (confirmed live: no loadMore/nextPage/
// currentPage/infiniteScroll markers anywhere in the embedded RSC data), so
// they alone only surface a small fraction of the site's real catalog. Venue
// pages don't have that cap — each one bulk-embeds every event happening at
// that venue — so after the initial harvest we additionally crawl every
// venue referenced by an already-known event, which raised measured coverage
// from ~164 to ~513 of the site's ~620 sitemap-listed Istanbul events.
const VENUE_CONCURRENCY = 15;

// Resolving descriptions requires a second fetch per event (see
// fetchDescription below) — this used to be lazy/on-demand only, but a
// static build has no live backend left to serve that second call from, so
// every event needs it resolved up front now.
const DESCRIPTION_CONCURRENCY = 15;

async function fetchEvents({ start, end }) {
  const perPage = await Promise.all(
    LISTING_PAGES.map(u => decodePage(u).catch(() => []))
  );
  const byId = new Map();
  for (const arr of perPage) for (const ev of arr) byId.set(ev.id, ev);

  const venueSlugs = new Set();
  for (const ev of byId.values()) {
    const slug = ev.venues && ev.venues[0] && ev.venues[0].slug;
    if (slug) venueSlugs.add(slug);
  }
  const venuePages = await mapLimit(
    [...venueSlugs],
    VENUE_CONCURRENCY,
    slug => decodePage(`https://www.bubilet.com.tr/mekan/${slug}`)
  );
  for (const arr of venuePages) for (const ev of arr || []) byId.set(ev.id, ev);

  const out = [];
  for (const ev of byId.values()) {
    if (!Array.isArray(ev.dates)) continue;
    const image = pickImage(ev.files);
    const category = (ev.tags && ev.tags[0] && ev.tags[0].name) || 'Etkinlik';
    const title = (ev.name || '').trim();
    const venue = (ev.venues && ev.venues[0] && ev.venues[0].name) || null;
    const link = `https://www.bubilet.com.tr/istanbul/etkinlik/${ev.slug}`;
    for (const iso of ev.dates) {
      // Bubilet's dates[] are true UTC instants, unlike the other two
      // sources — see splitUtcToIstanbul() for why this differs from them.
      const { date, time } = splitUtcToIstanbul(iso);
      if (!withinWindow(date, start, end)) continue;
      // One ev.id can produce several output rows (one per session date), so
      // the date/session instant has to be part of the id, not just ev.id.
      const id = makeId('Bubilet', `${ev.id}-${iso}`, link);
      out.push({ id, source: 'Bubilet', title, date, time, category, venue, image, description: null, link });
    }
  }

  // Resolve descriptions once per unique link (a multi-date event shares one
  // link across several output rows) rather than once per row, then fan the
  // result back out — avoids redundant fetches for recurring showtimes.
  const uniqueLinks = [...new Set(out.map(ev => ev.link))];
  const descByLink = new Map();
  await mapLimit(uniqueLinks, DESCRIPTION_CONCURRENCY, async link => {
    descByLink.set(link, await fetchDescription(link).catch(() => null));
  });
  for (const ev of out) ev.description = descByLink.get(ev.link) || null;

  return out;
}

async function fetchDescription(link) {
  const res = await fetchWithRetry(link);
  const html = await res.text();

  const summary = findRealSummary(decodeRscStream(html));
  if (summary) return stripHtml(summary);

  // Fall back to the thin JSON-LD Event.description (usually just the
  // event title) for the events where "summary" wasn't real inline text.
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const b of blocks) {
    try {
      const data = JSON.parse(b[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type'] === 'Event' && item.description) return item.description;
      }
    } catch (e) { /* skip malformed block */ }
  }
  return null;
}

module.exports = { fetchEvents, fetchDescription };
