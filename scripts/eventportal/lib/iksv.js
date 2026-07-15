// IKSV (Istanbul Foundation for Culture and Arts) runs its listing through an
// internal AngularJS app that pulls JSON from a shared ASP.NET AJAX handler
// (plugins.ashx) rather than exposing a documented API — the request
// parameters below (program IDs, zone_id) were reverse-engineered from the
// site's own inline controller script and confirmed working directly.
const { withinWindow, stripHtml, fetchWithRetry, mapLimit, makeId } = require('./util');
const passo = require('./passo');

// Price resolution is one extra request per event, but only against
// ticketing.passo.com.tr, which is stateless and fast (see lib/passo.js) —
// same modest concurrency as description resolution is plenty.
const PRICE_CONCURRENCY = 10;

// Resolving descriptions requires a second fetch per event (see
// fetchDescription below) — this used to be lazy/on-demand only, but a
// static build has no live backend left to serve that second call from, so
// every event needs it resolved up front now. IKSV's catalog is small, so a
// modest concurrency is plenty.
const DESCRIPTION_CONCURRENCY = 10;

const ENDPOINT = 'https://www.iksv.org/plugins/iksv/plugins.ashx';
// One request covers every sub-festival (Music/Film/Jazz/Biennial/Theatre/
// Design/Salon) since they all share this same handler on the main domain.
const EVENTS_BODY =
  'plugin=events&programMusic=735&programFilm=1188&programCaz=3143&programBienal=4154' +
  '&programAltkat=11669&programTasarim=8635&programTiyatro=9223&programSalon=4873' +
  '&zone_id=66,67&itemCount=200&currentPage=0&lang=en&month=&category=&year=&day=';

function epochToIstanbul(dateFormatted) {
  const m = dateFormatted && dateFormatted.match(/\/Date\((\d+)\)\//);
  if (!m) return { date: null, time: null };
  // dateFormatted is a true UTC instant (.NET JSON date), same situation as
  // Bubilet — confirmed live by cross-checking against the sibling `time`
  // field, which is always exactly +3h ahead of the raw epoch.
  const istanbul = new Date(Number(m[1]) + 3 * 3600 * 1000);
  return { date: istanbul.toISOString().slice(0, 10), time: istanbul.toISOString().slice(11, 16) };
}

function pickImage(files, articleId) {
  const thumb = (files || []).find(f => String(f.type) === '15') || (files || [])[0];
  if (!thumb || !thumb.file1) return null;
  // Discovered in the site's own Angular controller: $scope.getThumb().
  return `https://www.iksv.org/i/content/${thumb.articleid || articleId}_${thumb.file1}`;
}

// IKSV's own API carries no price anywhere — every event, with no
// exceptions in the current catalog, routes ticket sales to Passo via this
// field (confirmed live). Solving this source's price meant reverse-
// engineering Passo instead; see lib/passo.js.
function pickTicketUrl(ev) {
  for (const p of ev.programs || []) {
    if (p && p.ticketUrl) return p.ticketUrl;
  }
  return null;
}

async function fetchEvents({ start, end }) {
  const res = await fetchWithRetry(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: EVENTS_BODY,
  });
  const data = await res.json();
  if (!data.status || !Array.isArray(data.data)) return [];

  const out = [];
  for (const ev of data.data) {
    const { date, time } = epochToIstanbul(ev.dateFormatted);
    if (!withinWindow(date, start, end)) continue;

    const link = `https://${ev.alias}`;
    out.push({
      id: makeId('IKSV', ev.articleId, link),
      source: 'IKSV',
      title: ev.headline,
      date,
      time,
      category: ev.category || 'Etkinlik',
      venue: ev.place || null,
      image: pickImage(ev.files, ev.articleId),
      description: null,
      link,
      price: null,
      _ticketUrl: pickTicketUrl(ev),
    });
  }

  await mapLimit(out, DESCRIPTION_CONCURRENCY, async ev => {
    ev.description = await fetchDescription(ev.link).catch(() => null);
  });

  await mapLimit(out, PRICE_CONCURRENCY, async ev => {
    const parsed = ev._ticketUrl && passo.parseEventUrl(ev._ticketUrl);
    ev.price = parsed ? await passo.priceForEvent(parsed.seoUrl, parsed.id).catch(() => null) : null;
    delete ev._ticketUrl;
  });

  return out;
}

// IKSV has no structured description field anywhere in its API (confirmed:
// the `programs[].description` slot in the events response is always empty).
// The real marketing copy is only present as plain <p> paragraphs rendered
// server-side into the detail page, mixed in with session-time/artist-credit
// lines and unrelated boilerplate — this heuristically picks out the
// prose-like ones.
async function fetchDescription(link) {
  const res = await fetchWithRetry(link);
  const html = await res.text();
  const blocks = [...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)];

  const paragraphs = [];
  for (const b of blocks) {
    const text = stripHtml(b[1]);
    if (!text || text.length < 40) continue; // drop short captions/labels
    if (/^\d{1,2}[.:]\d{2}\s*\|/.test(text)) continue; // drop "17.30 | Artist Name ..." credit lines
    if (/lorem ipsum/i.test(text)) continue; // stray unused CMS placeholder seen on live pages
    if (/meetings on the bridge/i.test(text)) continue; // film-festival credit boilerplate that leaks onto unrelated event types
    if (/^©|all rights reserved|foundation for culture and arts/i.test(text)) continue; // site-wide footer/copyright line
    paragraphs.push(text);
  }
  return paragraphs.slice(0, 4).join('\n\n') || null;
}

module.exports = { fetchEvents, fetchDescription };
