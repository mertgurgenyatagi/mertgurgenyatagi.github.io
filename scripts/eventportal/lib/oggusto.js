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

// evyy.net *sometimes* embeds the real destination directly in its own
// `?u=` query param — no request needed, pure string decoding (confirmed
// live on links shaped like that). But a manual price audit found evyy.net
// links that are instead a bare opaque short path (e.g.
// "ticketmaster.evyy.net/xLVbzd", no query string at all) which only reveal
// their `u=` param a couple of redirect hops later, through an intermediate
// ojrq.net bounce — confirmed live by following the chain with curl. The
// param shortcut silently returned the *unresolved* short link itself for
// these (empty searchParams.get('u') falling back to `link`), which then
// matched none of the 5 known ticketing hostnames below and gave up with a
// wrongly-null price. Fall back to actually following the redirect chain
// (same mechanism already used for sjv.io/bit.ly below) whenever the
// shortcut isn't available. sjv.io and bit.ly are opaque short codes that
// need one-or-more redirect hops resolved regardless (confirmed live).
async function resolveDestination(link) {
  let u;
  try { u = new URL(link); } catch (e) { return link; }

  if (u.hostname.endsWith('evyy.net')) {
    const embedded = u.searchParams.get('u');
    if (embedded) return embedded;
  }
  if (u.hostname.endsWith('evyy.net') || u.hostname.endsWith('sjv.io') || u.hostname === 'bit.ly') {
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

// Occasionally the price actually lives in the venue/location text instead
// of anywhere ticket-related — confirmed live on an event with no
// event_ticket_link at all whose event_location_name read "Yapı Kredi
// bomontiada (Ücretsiz Konser)" ("Ücretsiz Konser" = free concert). Too
// one-off a placement to generalize beyond this literal "(Ücretsiz ...)"
// marker, but it's a free, zero-risk check to make before giving up.
function freePriceFromLocation(locationName) {
  return /\(Ücretsiz\b/i.test(locationName || '') ? 0 : null;
}

// Anything still unresolved after dispatch is either a genuinely postponed/
// cancelled event ("ertelendi" — confirmed live: a Black Label Society link
// that resolves cleanly to a real Biletix event with no scheduled
// performance date at all, i.e. nothing to price), or one of the ~5% of
// links to a platform outside the 5 this app can dispatch to. Oggusto's
// entire price story is "dispatch to somewhere else that might work", so an
// event that falls all the way through is exactly as indeterminate as the
// sentinel-default cases in the other sources — default to the same 1000 TRY
// sentinel per the same user direction, rather than leaving it null.
const UNPRICED_SENTINEL = 1000;

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
    const resolved = await priceForTicketLink(ev._ticketLink).catch(() => null);
    ev.price = resolved ?? freePriceFromLocation(ev.venue) ?? UNPRICED_SENTINEL;
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
