// kultur.istanbul is a classic WordPress site running the WP Event Manager
// plugin. There's no single endpoint with everything: the WP REST API has
// full descriptions but no date/time field at all, while the plugin's own
// AJAX listing endpoint (/em-ajax/get_listings/, which the site's own page
// uses for its "load more" — not disallowed in robots.txt, unlike
// Biletino's /search) renders date/time/venue/category as an HTML fragment
// with no structured JSON. So: pull the AJAX fragment for the card fields,
// and lazily hit the REST API by slug for the description on demand.
const { withinWindow, stripHtml, fetchWithRetry, mapLimit, makeId } = require('./util');

// Resolving descriptions requires a second fetch per event (see
// fetchDescription below) — this used to be lazy/on-demand only, but a
// static build has no live backend left to serve that second call from, so
// every event needs it resolved up front now. Catalog is small (~10-15
// events), so a modest concurrency is plenty.
const DESCRIPTION_CONCURRENCY = 10;

const AJAX_URL = 'https://kultur.istanbul/em-ajax/get_listings/?per_page=100&page=1';
const REST_BASE = 'https://kultur.istanbul/wp-json/wp/v2/event_listing';

// "14-07-2026 19:30", "08-07-2026" (no time), or a range like
// "16-06-2026 - 30-08-2026" / "12-06-2026 10:00 - 31-08-2026 18:00" for
// exhibitions that run for weeks — split on " - " and parse each side.
function parseDatePart(s) {
  const m = s.trim().match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi] = m;
  return { date: `${yyyy}-${mm}-${dd}`, time: hh ? `${hh}:${mi}` : null };
}

function parseDateTimeText(raw) {
  const parts = raw.split(' - ').map(s => s.trim()).filter(Boolean);
  return { start: parseDatePart(parts[0]), end: parts[1] ? parseDatePart(parts[1]) : null };
}

function slugFromLink(link) {
  const m = link.match(/\/etkinlik\/([^/]+)\/?$/);
  return m ? m[1] : null;
}

function extractCards(html) {
  // Every card starts with this marker; split on it and drop the preamble.
  return html.split('<div class="wpem-event-box-col').slice(1);
}

function parseCard(card) {
  const link = (card.match(/<a href="(https:\/\/kultur\.istanbul\/etkinlik\/[^"]+)"/) || [])[1];
  const title = (card.match(/wpem-heading-text">([^<]+)</) || [])[1];
  const dateTimeRaw = (card.match(/wpem-event-date-time-text">([\s\S]*?)<\/span>/) || [])[1];
  const venue = (card.match(/wpem-event-location-text">\s*([^<]+?)\s*</) || [])[1];
  const image = (card.match(/background-image:\s*url\('([^']+)'\)/) || [])[1];
  const category = (card.match(/wpem-event-type-text event-type [^"]*">([^<]+)</) || [])[1];

  if (!link || !title || !dateTimeRaw) return null;
  return {
    link,
    title: stripHtml(title),
    category: category ? stripHtml(category) : 'Etkinlik',
    venue: venue ? stripHtml(venue) : null,
    image: image || null,
    dateTime: parseDateTimeText(dateTimeRaw.replace(/\s+/g, ' ')),
  };
}

async function fetchEvents({ start, end }) {
  const res = await fetchWithRetry(AJAX_URL);
  const data = await res.json();
  const cards = extractCards(data.html || '');

  const out = [];
  for (const raw of cards) {
    const ev = parseCard(raw);
    if (!ev || !ev.dateTime.start) continue;

    let date, time;
    if (ev.dateTime.end) {
      // Multi-day/ongoing event (e.g. an exhibition) — include it if the
      // run overlaps the window at all, displayed as starting "today" if
      // it's already underway rather than showing a start date that may be
      // weeks in the past.
      if (ev.dateTime.end.date < start || ev.dateTime.start.date > end) continue;
      date = ev.dateTime.start.date < start ? start : ev.dateTime.start.date;
      time = ev.dateTime.start.time || '00:00';
    } else {
      if (!withinWindow(ev.dateTime.start.date, start, end)) continue;
      date = ev.dateTime.start.date;
      time = ev.dateTime.start.time || '00:00';
    }

    out.push({
      id: makeId('KulturIstanbul', slugFromLink(ev.link), ev.link),
      source: 'KulturIstanbul',
      title: ev.title,
      date,
      time,
      category: ev.category,
      venue: ev.venue,
      image: ev.image,
      description: null,
      link: ev.link,
    });
  }

  await mapLimit(out, DESCRIPTION_CONCURRENCY, async ev => {
    ev.description = await fetchDescription(ev.link).catch(() => null);
  });

  return out;
}

async function fetchDescription(link) {
  const slug = slugFromLink(link);
  if (!slug) return null;
  const res = await fetchWithRetry(`${REST_BASE}?slug=${encodeURIComponent(slug)}`);
  const data = await res.json();
  const post = Array.isArray(data) && data[0];
  return (post && stripHtml(post.content && post.content.rendered)) || null;
}

module.exports = { fetchEvents, fetchDescription };
