// Merges raw per-source/per-showtime events into canonical, cross-run-stable
// "one card per real-world event" records with a sessions[] array, instead
// of today's one-object-per-showtime explosion. See the migration plan for
// the full rationale.
const crypto = require('crypto');
const { jaccard, tokenSet } = require('./textsim');

function normalize(s) {
  return (s || '')
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/\s+/g, ' ')
    .replace(/^["'“”‘’(\[]+|["'“”‘’)\]]+$/g, '');
}

function canonicalKey(title, venue) {
  return `${normalize(title)}|${normalize(venue)}`;
}

function canonicalId(key) {
  return 'evt-' + crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);
}

const FUZZY_TITLE_THRESHOLD = 0.6;

// index: plain object, "<source>::<link>" -> canonicalId, persisted across
// runs in canonical-index.json. Mutated in place.
// poolEvents: array of canonical event objects, mutated in place (new events
// pushed, existing ones gain sessions).
function mergeDay(poolEvents, rawEvents, index) {
  const byId = new Map(poolEvents.map(ev => [ev.id, ev]));
  const byKey = new Map(poolEvents.map(ev => [canonicalKey(ev.title, ev.venue), ev]));

  let created = 0, sessionsAdded = 0;

  for (const r of rawEvents) {
    // price lives per-session, not first-seen-wins like title/venue/etc:
    // it's tied to a specific source's specific showtime (confirmed live,
    // e.g. Biletix resolves price per performanceCode), so a different
    // source or a later date for the same canonical event can genuinely
    // have a different price.
    const session = { id: r.id, date: r.date, time: r.time, source: r.source, link: r.link, price: r.price ?? null };
    const indexKey = `${r.source}::${r.link}`;

    let canonical = null;

    // Tier 1: exact (source, link) hit -- the common case, a recurring show
    // on the same source across many nights, robust to title text drift.
    const existingId = index[indexKey];
    if (existingId && byId.has(existingId)) canonical = byId.get(existingId);

    // Tier 2: exact normalized title+venue key -- first cross-source merge.
    if (!canonical) {
      const key = canonicalKey(r.title, r.venue);
      if (byKey.has(key)) canonical = byKey.get(key);
    }

    // Tier 3: fuzzy fallback -- same venue, high title token overlap. Safety
    // net for a source's very first sighting having drifted title text.
    if (!canonical && r.venue) {
      const rVenue = normalize(r.venue);
      const rTokens = tokenSet(r.title);
      for (const ev of poolEvents) {
        if (normalize(ev.venue) !== rVenue) continue;
        if (jaccard(rTokens, tokenSet(ev.title)) >= FUZZY_TITLE_THRESHOLD) { canonical = ev; break; }
      }
    }

    if (canonical) {
      if (!canonical.sessions.some(s => s.id === session.id)) {
        canonical.sessions.push(session);
        sessionsAdded++;
      }
      index[indexKey] = canonical.id;
    } else {
      const id = canonicalId(canonicalKey(r.title, r.venue));
      const newEv = {
        id,
        title: r.title,
        description: r.description,
        image: r.image,
        category: r.category,
        sourceCategory: r.sourceCategory,
        venue: r.venue,
        source: r.source,
        link: r.link,
        tasteScore: null,
        tasteTier: 'unscored',
        date: r.date,
        time: r.time,
        price: session.price,
        sessions: [session],
      };
      poolEvents.push(newEv);
      byId.set(id, newEv);
      byKey.set(canonicalKey(r.title, r.venue), newEv);
      index[indexKey] = id;
      created++;
      sessionsAdded++;
    }
  }

  return { created, sessionsAdded };
}

// Drops past sessions and canonical events left with none, recomputes the
// derived date/time (= earliest remaining session), sorts everything.
function pruneAndDerive(poolEvents, today) {
  const survivors = [];
  let sessionsPruned = 0;

  for (const ev of poolEvents) {
    const before = ev.sessions.length;
    ev.sessions = ev.sessions
      .filter(s => s.date >= today)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    sessionsPruned += before - ev.sessions.length;

    if (ev.sessions.length === 0) continue;
    ev.date = ev.sessions[0].date;
    ev.time = ev.sessions[0].time;
    ev.price = ev.sessions[0].price ?? null;
    survivors.push(ev);
  }

  survivors.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return { survivors, sessionsPruned };
}

function pruneIndex(index, poolEvents) {
  const liveIds = new Set(poolEvents.map(ev => ev.id));
  for (const key of Object.keys(index)) {
    if (!liveIds.has(index[key])) delete index[key];
  }
}

module.exports = { normalize, canonicalKey, canonicalId, mergeDay, pruneAndDerive, pruneIndex };
