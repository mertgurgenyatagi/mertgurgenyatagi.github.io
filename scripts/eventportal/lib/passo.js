// Passo is IKSV's exclusive ticketing partner (100% of its current catalog's
// ticketUrl fields point here) and a common destination for Oggusto's
// affiliate links. Plain requests get a Cloudflare "Sorry, you have been
// blocked" page. Getting past it turned out to need two independent fixes,
// not one:
//   1. The modern-Chrome header set a real browser always sends (client
//      hints, Sec-Fetch-*, Accept-Language) — without these, even curl gets
//      blocked.
//   2. Even *with* those headers, Node's native fetch (undici) still gets
//      blocked while curl passes every time (confirmed live, alternating
//      fetch()/curl requests to the identical URL+headers back to back) —
//      the same client-fingerprint split Biletino already needed a curl
//      workaround for. Skipping this step was tried first and measured
//      live: ~3/13 real IKSV events resolved, the rest 403'd silently
//      through the .catch(() => null) fallback.
// The pricing endpoint itself (undocumented, not discoverable via static
// bundle analysis — this app is far more code-split than Biletix's) was
// only found by capturing live network traffic from a real, non-headless
// browser session after static analysis stalled; once known, it works from
// a plain stateless GET (given both fixes above), same as every other
// source here.
const { curlFetchJson } = require('./util');

const BROWSER_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
  'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  Referer: 'https://www.passo.com.tr/',
};

// Read live off Passo's own getlanguages response; only the Turkish id is
// actually used below, kept as a lookup in case an English-keyed call is
// ever useful (the price values themselves don't differ by language).
const LANG_ID_TR = 118;

// A single event can expose more than one simultaneous price category
// (confirmed live, e.g. general admission + a discounted "Genç Bilet" youth
// tier) — this takes the lowest as the "starting from" figure.
async function priceForEvent(seoUrl, id) {
  const url = `https://ticketingweb.passo.com.tr/api/passoweb/geteventdetails/${seoUrl}/${id}/${LANG_ID_TR}`;
  const json = await curlFetchJson(url, BROWSER_HEADERS);
  const categories = (json && json.value && json.value.categories) || [];
  let min = null;
  for (const c of categories) {
    const n = Number(c && c.price);
    if (Number.isFinite(n) && (min === null || n < min)) min = n;
  }
  return min;
}

// Passo's own event URLs use two different localized path segments for the
// same shape — "event" ("/en/event/{seoUrl}/{id}") and "etkinlik"
// ("/tr/etkinlik/{seoUrl}/{id}") — confirmed live on real links from both
// IKSV's own ticketUrl field and an Oggusto bit.ly redirect target. Returns
// null for anything that isn't a Passo event-detail URL.
function parseEventUrl(url) {
  const m = String(url || '').match(/passo\.com\.tr\/[a-z]{2}\/(?:event|etkinlik)\/([^/?]+)\/(\d+)/i);
  return m ? { seoUrl: m[1], id: m[2] } : null;
}

module.exports = { priceForEvent, parseEventUrl };
