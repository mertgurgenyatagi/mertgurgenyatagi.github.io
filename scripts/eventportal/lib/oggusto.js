// Oggusto's public frontend is just a monthly editorial round-up article, but
// its headless WordPress origin exposes an unauthenticated bulk dump of every
// event in its database in one request. It already carries a full
// description, so unlike Bubilet/Biletinial no per-event detail fetch is
// needed for this source.
//
// Oggusto sells nothing itself and carries no price field anywhere in its
// own data (confirmed live) — every event instead carries an
// event_ticket_link pointing at wherever it actually sends readers to buy.
// Resolved and tallied that field across the live bulk dump: ~95% of linked
// events route to a platform this app already has a working price mechanism
// for (Bubilet, Biletix, Biletinial, Passo, Biletino — directly or through
// one of two "ticketmaster"-branded affiliate-link wrappers). So this
// source's price problem reduces entirely to URL dispatch, not a new
// platform to reverse-engineer.
const { withinWindow, stripHtml, fetchWithRetry, mapLimit, makeId } = require('./util');
const bubilet = require('./bubilet');
const biletinial = require('./biletinial');
const biletix = require('./biletix');
const biletino = require('./biletino');
const passo = require('./passo');

const BULK_URL = 'https://wp.oggusto.com/wp-json/rest/v1/etkinlik/getall';
const FETCH_TIMEOUT_MS = 25000;

// Only run against events that already passed the Istanbul+window filter
// below, not the full ~2,400-event bulk dump.
const PRICE_CONCURRENCY = 15;

function isIstanbul(cityKey) {
  if (!Array.isArray(cityKey)) return false;
  return cityKey.some(c => (c.name || '').includes('İstanbul') || (c.name || '').includes('Istanbul'));
}

function pickImage(photoCredit) {
  const photo = Array.isArray(photoCredit) ? photoCredit[0] : null;
  const sizes = photo && photo.sizes;
  if (!sizes) return (photo && photo.url) || null;
  // "thumbnail" (150x150) is the smallest variant WordPress generates.
  return sizes.thumbnail || sizes.card || sizes.medium || photo.url || null;
}

// evyy.net embeds the real destination directly in its own `?u=` query
// param — no request needed, pure string decoding (confirmed live). sjv.io
// and bit.ly are opaque short codes that need one redirect hop resolved
// (confirmed live: both land on a real destination page after exactly one
// hop). Both "ticketmaster"-branded wrappers (sjv.io, evyy.net) resolved to
// Biletix on every sample checked in this app's own research — bit.ly is
// genuinely mixed and must actually be resolved per link, not assumed.
async function resolveDestination(link) {
  let u;
  try { u = new URL(link); } catch (e) { return link; }

  if (u.hostname.endsWith('evyy.net')) {
    return u.searchParams.get('u') || link;
  }
  if (u.hostname.endsWith('sjv.io') || u.hostname === 'bit.ly') {
    try {
      const res = await fetchWithRetry(link);
      return res.url || link;
    } catch (e) {
      return link;
    }
  }
  return link;
}

// Dispatches a resolved ticket-purchase URL to whichever already-solved
// source's own price mechanism matches its hostname. Anything outside these
// 5 platforms (the long tail of one-off official/venue sites, ~5% of the
// live catalog) isn't covered — returns null (price unknown), not a guess.
async function priceForDestination(url) {
  let hostname;
  try { hostname = new URL(url).hostname; } catch (e) { return null; }

  if (hostname.endsWith('bubilet.com.tr')) return bubilet.priceForLink(url).catch(() => null);
  if (hostname.endsWith('biletinial.com')) return biletinial.priceForLink(url).catch(() => null);
  if (hostname.endsWith('biletino.com')) return biletino.priceForLink(url).catch(() => null);
  if (hostname.endsWith('passo.com.tr')) {
    const parsed = passo.parseEventUrl(url);
    return parsed ? passo.priceForEvent(parsed.seoUrl, parsed.id).catch(() => null) : null;
  }
  if (hostname.endsWith('biletix.com')) {
    // ".../performance/{code}/{perf}/..." already carries a performanceCode;
    // ".../etkinlik/{code}/..." doesn't, and priceForEventCode resolves it.
    const m = url.match(/biletix\.com\/(?:performance|etkinlik)\/([A-Z0-9]{4,8})(?:\/(\d{2,4}))?/i);
    if (!m) return null;
    return biletix.priceForEventCode(m[1], m[2] || null, null).catch(() => null);
  }
  return null;
}

async function priceForTicketLink(rawLink) {
  if (!rawLink) return null;
  const destination = await resolveDestination(rawLink);
  return priceForDestination(destination);
}

async function fetchEvents({ start, end }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let data;
  try {
    const res = await fetchWithRetry(BULK_URL, { signal: controller.signal }, 2);
    data = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const out = [];
  for (const ev of data) {
    const block = Array.isArray(ev.etkinlik) ? ev.etkinlik[0] : null;
    if (!block || !block.event_beginning_date) continue;
    if (!isIstanbul(block.city_key)) continue;

    const [date, timeFull = ''] = block.event_beginning_date.split(' ');
    const time = timeFull.slice(0, 5) || '00:00';
    if (!withinWindow(date, start, end)) continue;

    const category = (Array.isArray(ev.category) && ev.category[0] && ev.category[0].name) || 'Etkinlik';
    const description = stripHtml(ev.excerpt || ev.content || '') || null;

    out.push({
      id: makeId('Oggusto', ev.id, ev.link),
      source: 'Oggusto',
      title: stripHtml(ev.title) || ev.title,
      date,
      time,
      category,
      venue: block.event_location_name || null,
      image: pickImage(ev.photoCredit),
      description,
      link: ev.link,
      price: null,
      _ticketLink: block.event_ticket_link || null,
    });
  }

  await mapLimit(out, PRICE_CONCURRENCY, async ev => {
    ev.price = await priceForTicketLink(ev._ticketLink).catch(() => null);
    delete ev._ticketLink;
  });

  return out;
}

// Description already ships in the bulk dump, so this is only here so the
// server's generic /api/description route has something to call safely if
// it's ever hit for an Oggusto item.
async function fetchDescription() {
  return null;
}

module.exports = { fetchEvents, fetchDescription };
