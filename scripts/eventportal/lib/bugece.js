// Bugece's visible listing pages (/en/browse/all/events etc.) only
// server-render ~25 of its 11,000+ sitemap events — same thin-homepage
// problem as everywhere else. But its calendar view for a specific city
// (/en/browse/istanbul/calendar) embeds a much larger, already
// Istanbul-filtered dataset directly in the page's React Server Component
// stream: a `dateEvents` object grouping ~160 events by day, each with
// name, a true-UTC start time, venue, category, image, and (usually) a
// description — all in one request, no per-event crawl needed.
const { withinWindow, splitUtcToIstanbul, fetchWithRetry, mapLimit, makeId } = require('./util');

const CALENDAR_URL = 'https://bugece.co/en/browse/istanbul/calendar';

// Most events already carry a real description inline (see pickDescription
// below) — this only covers the minority that come back empty/unresolved,
// so a low concurrency is plenty. Needed at all because a static build has
// no live backend left to serve the old lazy /api/description call from.
const DESCRIPTION_CONCURRENCY = 10;

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

async function decodeCalendarPayload() {
  const res = await fetchWithRetry(CALENDAR_URL);
  const html = await res.text();
  const regex = /self\.__next_f\.push\(\[1,(".*?")\]\)/gs;
  let m, combined = '';
  while ((m = regex.exec(html)) !== null) {
    try { combined += JSON.parse(m[1]); } catch (e) { /* skip malformed chunk */ }
  }
  return combined;
}

// `dateEvents.data` is an array of {title: "YYYY-MM-DD", data: [event, ...]}
// groups. This locates that array in the decoded stream and parses it
// directly — the array content itself is plain JSON, only its surroundings
// carry React-fiber references.
function extractDateGroups(combined) {
  const marker = '"dateEvents":{"data":[';
  const idx = combined.indexOf(marker);
  if (idx === -1) return [];
  const arrText = extractJsonArray(combined, idx + marker.length - 1);
  if (!arrText) return [];
  try {
    return JSON.parse(arrText);
  } catch (e) {
    return [];
  }
}

function pickCategory(ev) {
  const cat = (ev.categories && ev.categories[0]) || (ev.music_categories && ev.music_categories[0]);
  return (cat && cat.name) || 'Etkinlik';
}

// `desc` is sometimes a real string, sometimes empty, and sometimes an
// unresolved React Server Component reference token like "$6f" (the actual
// text lives in another part of the stream this doesn't attempt to
// resolve) — treat anything not looking like real text as missing.
function pickDescription(desc) {
  if (!desc || typeof desc !== 'string') return null;
  const trimmed = desc.trim();
  if (!trimmed || trimmed.startsWith('$')) return null;
  return trimmed;
}

async function fetchEvents({ start, end }) {
  const combined = await decodeCalendarPayload();
  const dateGroups = extractDateGroups(combined);

  const out = [];
  const seen = new Set();
  for (const group of dateGroups) {
    for (const ev of group.data || []) {
      if (seen.has(ev.slug)) continue;
      seen.add(ev.slug);

      // start_time is a genuine UTC instant (confirmed live by cross-checking
      // against the detail page's JSON-LD startDate, which carries an
      // explicit +03:00 offset for the same event).
      const { date, time } = splitUtcToIstanbul(ev.start_time);
      if (!withinWindow(date, start, end)) continue;

      const link = `https://bugece.co/en/event/${ev.slug}`;
      out.push({
        id: makeId('Bugece', ev.slug, link),
        source: 'Bugece',
        title: ev.name,
        date,
        time,
        category: pickCategory(ev),
        venue: (ev.venue && ev.venue.name) || null,
        image: ev.image || null,
        description: pickDescription(ev.desc),
        link,
      });
    }
  }

  const needsDescription = out.filter(ev => !ev.description);
  await mapLimit(needsDescription, DESCRIPTION_CONCURRENCY, async ev => {
    ev.description = await fetchDescription(ev.link).catch(() => null);
  });

  return out;
}

async function fetchDescription(link) {
  const res = await fetchWithRetry(link);
  const html = await res.text();
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const b of blocks) {
    try {
      const data = JSON.parse(b[1]);
      if (data && data.description) return data.description;
    } catch (e) { /* skip malformed block */ }
  }
  return null;
}

module.exports = { fetchEvents, fetchDescription };
