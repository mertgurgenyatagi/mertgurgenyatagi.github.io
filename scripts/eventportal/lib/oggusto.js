// Oggusto's public frontend is just a monthly editorial round-up article, but
// its headless WordPress origin exposes an unauthenticated bulk dump of every
// event in its database in one request. It already carries a full
// description, so unlike Bubilet/Biletinial no per-event detail fetch is
// needed for this source.
const { withinWindow, stripHtml, fetchWithRetry, makeId } = require('./util');

const BULK_URL = 'https://wp.oggusto.com/wp-json/rest/v1/etkinlik/getall';
const FETCH_TIMEOUT_MS = 25000;

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
    });
  }
  return out;
}

// Description already ships in the bulk dump, so this is only here so the
// server's generic /api/description route has something to call safely if
// it's ever hit for an Oggusto item.
async function fetchDescription() {
  return null;
}

module.exports = { fetchEvents, fetchDescription };
