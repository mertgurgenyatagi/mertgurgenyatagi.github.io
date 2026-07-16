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

// Was 0.6 until a manual price-accuracy audit caught it false-merging
// distinct real-world events that share a templated title with only one
// differing word -- e.g. "İstanbul Workshops Vitray Atölyesi" vs "...Tezhip
// Atölyesi" vs "...Parfüm Atölyesi" (same venue, 3/5 token overlap = 0.6,
// just enough to match) collapsed into one canonical card whose price then
// came from whichever of the three got inserted first. Raised well above
// every false positive found in that audit (worst case measured: 0.667, two
// different Anka Workshop statue models) while Tier 1/2 (source+link exact,
// title+venue exact) still cover the overwhelming majority of real merges --
// Tier 3 only needs to catch genuine minor text drift, which scores much
// higher than a swapped-out subject word.
const FUZZY_TITLE_THRESHOLD = 0.8;

// tokenSet() (textsim.js) splits on non-letter characters, so it drops
// digits entirely -- two titles differing only by a number (age brackets
// like "Yaş Grubu:7-11" vs "...4-6", or "Sesimi... 6-9" vs "...7-12") come
// out token-identical (confirmed live: Jaccard 1.0) and would slip past any
// threshold. Require digit sequences to match exactly as an extra gate.
function extractDigits(title) {
  return (title.match(/\d+/g) || []).join(',');
}

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
      const rDigits = extractDigits(r.title);
      for (const ev of poolEvents) {
        if (normalize(ev.venue) !== rVenue) continue;
        if (rDigits !== extractDigits(ev.title)) continue;
        if (jaccard(rTokens, tokenSet(ev.title)) >= FUZZY_TITLE_THRESHOLD) { canonical = ev; break; }
      }
    }

    if (canonical) {
      const existingSession = canonical.sessions.find(s => s.id === session.id);
      if (!existingSession) {
        canonical.sessions.push(session);
        sessionsAdded++;
      } else if (session.price != null) {
        // Price is live, mutable fact, not a stable identifier -- it can
        // resolve for the first time on a later run (a transient failure
        // the first time this session was merged), but it can also
        // genuinely change (discount added/expired, demand pricing) even
        // once already resolved. A manual price audit caught several
        // sessions frozen at a stale value from the day they were first
        // seen (e.g. a Biletix price recorded weeks ago no longer matching
        // the site today) -- always take the latest non-null reading rather
        // than only backfilling a null once. A fetch that itself failed to
        // resolve a price (session.price == null) must NOT blank out an
        // already-known good value, so this only ever moves null -> value
        // or value -> a newer value, never value -> null.
        existingSession.price = session.price;
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
    // Cross-source merges routinely carry several genuinely different prices
    // for what's the same real-world event (e.g. the same theater showtime
    // sold through Bubilet, Biletinial and Biletix at once, or the same
    // exhibit's different daily time-slots each getting their own ticket
    // code) -- sessions[0].price picked whichever session happened to merge
    // in first, which a manual audit showed was frequently the MORE
    // expensive option while a cheaper one for the same event sat right
    // there in sessions[1+]. A real buyer would pick the cheapest available
    // ticket, so derive price as the minimum across all currently-known
    // session prices instead.
    const known = ev.sessions.map(s => s.price).filter(p => p != null);
    ev.price = known.length ? Math.min(...known) : null;
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
