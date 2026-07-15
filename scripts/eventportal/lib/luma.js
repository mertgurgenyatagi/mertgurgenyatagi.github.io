// Luma's city discovery page (https://luma.com/istanbul) only server-renders
// a small schema.org ItemList JSON-LD snapshot meant for a fast first paint —
// confirmed live it was capped at 6 events while the real catalog is much
// bigger. That page's own __NEXT_DATA__ embeds `place.api_id`, which unlocks
// Luma's real public discovery API and returns the full catalog directly in
// one unauthenticated call (confirmed live: 25 events via the API vs. 6 in
// the JSON-LD snapshot, `has_more: false` so no cursor pagination is even
// needed today). That API is used here instead of scraping the SSR HTML.
const { withinWindow, splitUtcToIstanbul, fetchWithRetry, mapLimit, makeId, lowestOfferPrice } = require('./util');

// Istanbul's place id on Luma — read off luma.com/istanbul's own
// __NEXT_DATA__, not guessed.
const ISTANBUL_PLACE_API_ID = 'discplace-0vKyo1D6kdT4ml6';
const DISCOVER_URL = `https://api.lu.ma/discover/get-paginated-events?place_api_id=${ISTANBUL_PLACE_API_ID}`;

// The discover payload doesn't include description text at all, so it's
// resolved per-event from each event's own detail-page JSON-LD — cheap here
// since Luma's Istanbul catalog is small (tens of events, not hundreds).
const DETAIL_CONCURRENCY = 10;

function extractJsonLdEvent(html) {
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  for (const b of blocks) {
    try {
      const d = JSON.parse(b[1]);
      if (d && d['@type'] === 'Event') return d;
    } catch (e) { /* skip malformed block */ }
  }
  return null;
}

// The detail page's JSON-LD carries a complete `offers` array right next to
// `description` this module already reads (confirmed live) — the discover
// API's own `ticket_info.is_free` flag is unreliable (mislabels some real
// ₺0 events as non-free, confirmed live on 3 samples), so the detail page's
// offers is the one authoritative source, not a fallback.
async function fetchDetail(link) {
  const res = await fetchWithRetry(link);
  const html = await res.text();
  const event = extractJsonLdEvent(html);
  return {
    description: (event && event.description) || null,
    price: event ? lowestOfferPrice(event.offers) : null,
  };
}

async function fetchDescription(link) {
  return (await fetchDetail(link)).description;
}

// Used by oggusto.js when it only has a bare Luma event link.
async function priceForLink(link) {
  return (await fetchDetail(link)).price;
}

async function fetchEvents({ start, end }) {
  const res = await fetchWithRetry(DISCOVER_URL);
  const json = await res.json();

  const out = [];
  for (const entry of json.entries || []) {
    const ev = entry.event;
    if (!ev || !ev.start_at) continue;

    // start_at is a true UTC instant (timezone field reads "Europe/Istanbul"
    // separately, and the value itself carries a bare "Z" suffix) — unlike
    // the JSON-LD startDate this module used to read, which already carried
    // a +03:00 offset. Needs the same UTC->Istanbul shift as Bubilet/Bugece.
    const { date, time } = splitUtcToIstanbul(ev.start_at);
    if (!withinWindow(date, start, end)) continue;

    const geo = ev.geo_address_info;
    const link = ev.url ? `https://luma.com/${ev.url}` : null;

    out.push({
      id: makeId('Luma', ev.api_id, link),
      source: 'Luma',
      title: ev.name,
      date,
      time,
      category: 'Topluluk', // no structured category exists on this source
      venue: (geo && geo.short_address) || null,
      image: ev.cover_url || null,
      description: null,
      link,
      price: null,
    });
  }

  await mapLimit(out, DETAIL_CONCURRENCY, async ev => {
    if (!ev.link) return;
    const detail = await fetchDetail(ev.link).catch(() => ({ description: null, price: null }));
    ev.description = detail.description;
    ev.price = detail.price;
  });

  return out;
}

module.exports = { fetchEvents, fetchDescription, priceForLink };
