# EventPortal — Handover

Personal, zero-budget Istanbul event aggregator. Crawls 9 ticketing/listing
sites, merges recurring showtimes into single cards, scores them against
your own taste with an LLM, and serves the result as a static site. Runs
entirely on GitHub Actions cron + committed JSON — there is no live backend.

This doc is for picking the project back up cold: architecture, file map,
daily lifecycle, how to run things locally, and what's known-unfinished.

**Live site**: `https://mertgurgenyatagi.github.io/eventportal/`
**This repo**: `mertgurgenyatagi.github.io` (this project lives alongside
`kupatakip/`, untouched, at repo root — see `index.html`, which still just
redirects to `/kupatakip/` and was deliberately left that way).

**Predecessor repo**: `EventPortal` (separate GitHub repo, same account).
That repo is where this project originally lived and was prototyped. It is
now superseded but not deleted — see "Things left behind in the old repo"
below for what's still only there.

---

## 1. Architecture, in one paragraph

Two independent GitHub Actions crons write to a shared, persisted JSON file
(`eventportal/data/events.json`) that the static frontend reads directly —
no API, no database. **Fetch** (`eventportal-fetch.yml`, 04:00 Istanbul
daily) crawls all 9 sources for exactly one calendar day (today+8), merges
any matching events into the existing pool by a dedup/merge algorithm, and
prunes anything whose date has passed. **Score** (`eventportal-score.yml`,
09:00 Istanbul daily) finds events in that pool with no taste score yet and
scores them via Groq (Llama 3.1), blended with a hand-rolled similarity
search against your own past ratings. Both workflows commit their output
straight to `main` and then trigger `deploy.yml` (the existing Pages
deployment workflow, shared with kupatakip, unmodified) to republish.

```
09 sources (lib/*.js)
        │  fetchEvents({start: day, end: day})  ← single day, not a range
        ▼
fetch-daily.js  →  categorize()  →  canonical.js mergeDay()/pruneAndDerive()
        │
        ▼
eventportal/data/events.json   (persisted accumulating pool — this IS the state)
        │
        ▼
score-events.js  →  Groq API + ratings.csv similarity  →  writes tasteScore back
        │
        ▼
eventportal/app.js  (static frontend, reads events.json directly)
```

---

## 2. File map

### `eventportal/` — static frontend, served as-is by GitHub Pages

| File | Purpose |
|---|---|
| `index.html` | Main page. Toolbar (search/date/category/venue/**sort**/toggle chips), event list container, modal, toast. |
| `app.js` | All frontend logic: load `data/events.json`, filter, **sort**, render rows/modal, favorites/dismiss/lists (all in `localStorage`), pagination. |
| `styles.css` | All styling. Dark theme, CSS custom properties in `:root`. |
| `duel.html` / `duel.js` / `duel.css` | Standalone pairwise-comparison tool (not linked from nav — open directly). Shows two random events, pick the better one, never repeats a matchup. Exports/imports CSV. |
| `rate.html` / `rate.js` / `rate.css` | Standalone one-at-a-time rating tool (not linked from nav). This is how `scripts/eventportal/data/ratings.csv` — the taste ground-truth — gets built/extended. |
| `status.html` | Password-gated (`istanbul7gun`, client-side obscurity only, see the page's own disclaimer) diagnostics page: last crawl summary, per-source pass/fail + timing, pool accumulate/prune stats, live-polling scoring progress bar. |
| `assets/` | Icons (SVG, used via CSS mask so any monochrome line-art works) + favicon. |
| `data/` | **Generated at runtime by the two workflows** — not hand-edited. `events.json` (the pool + frontend data source), `status.json` (last fetch run's diagnostics), `taste-progress.json` (live scoring progress for `status.html`). Starts empty; these files won't exist until the fetch workflow has run at least once. |

### `scripts/eventportal/` — Node backend (zero npm dependencies, only `fs`/`path`/`crypto`/`fetch`)

| File | Purpose |
|---|---|
| `fetch-daily.js` | Entry point for the fetch cron. Crawls all 9 sources for one target day, categorizes, merges into the pool, prunes past sessions, writes `eventportal/data/{events,status}.json` + `scripts/eventportal/data/canonical-index.json`. |
| `score-events.js` | Entry point for the score cron. Finds unscored pool events, scores via Groq + similarity blend, writes back into `events.json`'s `tasteScore`/`tasteTier` fields, checkpoints `taste-cache.json` + `taste-progress.json` every 5 events. |
| `lib/canonical.js` | **The new piece, most likely place you'll need to debug.** Dedup/merge key (`canonicalKey`, `canonicalId`), the 3-tier matching algorithm (`mergeDay`), and pruning (`pruneAndDerive`, `pruneIndex`). See §4 below. |
| `lib/util.js` | Shared helpers: `istanbulToday()` / `targetDayWindow(days)` (the new Istanbul-timezone-correct day targeting), `wideWindow(days)` (legacy, still used internally by Biletino/Biletix's own cache-freshness crawl), `withinWindow`, `makeId`, HTML entity/tag stripping, `mapLimit` (concurrency-limited map), `fetchWithRetry`. |
| `lib/textsim.js` | Turkish-locale-aware tokenization + Jaccard similarity (`norm`, `tokenSet`, `jaccard`). Shared by `canonical.js`'s fuzzy matching and `score-events.js`'s neighbor retrieval. |
| `lib/categorize.js` | Rule-based classifier: raw source category → one of the app's 12 custom categories (Tiyatro, Konser, Stand-up, Atölye, etc). Runs once per raw event in `fetch-daily.js`, before merging. |
| `lib/cache.js` | Generic in-memory background-refresh registry (`register`/`refresh`/`getState`), used only by `biletino.js`/`biletix.js` for their own wide (~35-day) internal crawl cache. Irrelevant to `fetch-daily.js`'s own accumulation logic — don't confuse the two caches. |
| `lib/env.js` | Tiny `.env` loader, no npm dependency. Looks for `.env` at the **repo root** (`mertgurgenyatagi.github.io/.env`) — see §6. |
| `lib/groq.js` | Groq chat-completions client. `DEFAULT_MODEL='llama-3.1-8b-instant'`, 25s per-attempt timeout, up to 6 retries with backoff, reads `x-ratelimit-*` headers for self-pacing. |
| `lib/bubilet.js`, `biletinial.js`, `oggusto.js`, `luma.js`, `iksv.js`, `biletino.js`, `bugece.js`, `kulturistanbul.js`, `biletix.js` | One module per source. Each exports `fetchEvents({start,end})` (all but Biletino/Biletix) or `crawlAll()` (Biletino/Biletix — full-catalog crawl, filtered post-hoc by date in the caller). Unchanged from the old repo — no logic here was touched by this migration. |
| `data/ratings.csv` | Your ~200 manually rated events — the taste ground truth. **Ids were migrated** during cutover (old per-showtime ids → new canonical ids); see §7. Extend this via `rate.html`. |
| `data/canonical-index.json` | **New.** Persisted `"source::link" → canonicalId` side table so recurring shows keep resolving to the same canonical event across daily runs even if title text drifts slightly. Generated/maintained entirely by `fetch-daily.js` — don't hand-edit. |
| `data/taste-cache.json` | Scored-event cache (score/tier/reason per canonical id), maintained by `score-events.js`. Starts empty in this repo (old repo's 860-entry cache was intentionally not carried over). |
| `scripts/migrate-ratings-ids.js` | One-time cutover script, already run once. Only re-run this if you ever change the canonical id scheme again (it would need re-running against the then-current `ratings.csv`). |

### `.github/workflows/`

| File | Purpose |
|---|---|
| `eventportal-fetch.yml` | `cron: '0 1 * * *'` (01:00 UTC = 04:00 Istanbul) + manual `workflow_dispatch` with an optional `date` input for backfilling a missed day. Runs `fetch-daily.js`, commits, triggers deploy. |
| `eventportal-score.yml` | `cron: '0 6 * * *'` (06:00 UTC = 09:00 Istanbul) + manual dispatch. Runs `score-events.js` with `GROQ_API_KEY` from secrets, commits, triggers deploy. |
| `deploy.yml` | **Pre-existing, shared with kupatakip, not modified.** Triggers on any push to `main`; uploads the whole repo root as the Pages artifact (`path: '.'`) — this is why nothing needed to change here when `eventportal/` was added. |
| `update-scores.yml` | kupatakip's own cron, unrelated, untouched. |

---

## 3. Daily lifecycle, concretely

**04:00 Istanbul** — `eventportal-fetch.yml` fires:
1. Compute `targetDay = istanbulToday() + 8 days` (or `TARGET_DATE` env override if manually dispatched with one).
2. Crawl all 9 sources for `{start: targetDay, end: targetDay}` only.
3. `categorize()` each raw event.
4. Load the existing `events.json` pool (empty array if this is the very first run) + `canonical-index.json`.
5. `mergeDay()`: for each raw event, find or create its canonical event (see §4), attach the session.
6. `pruneAndDerive()`: drop sessions dated before today, drop canonical events left with zero sessions, recompute each survivor's derived `date`/`time` = its earliest remaining session.
7. Write `events.json`, `status.json`, `canonical-index.json`; commit; dispatch `deploy.yml`.

**09:00 Istanbul** — `eventportal-score.yml` fires:
1. Load `ratings.csv` (ground truth) and `events.json` (current pool).
2. Anything already in `ratings.csv` or already cached in `taste-cache.json` is skipped.
3. Hard-exclude Stand-up category and the blocked-artist list (scoped to Konser) at score `1.0`, no LLM call.
4. Everything else: Jaccard-similarity search against `ratings.csv` for top-5 neighbors → Groq call with taste profile + neighbors as few-shot context → blend 50/50 with neighbor-weighted average if ≥2 neighbors found.
5. Checkpoints every 5 scored events (cache + `events.json` + progress file), so a mid-run failure loses at most a handful of calls and picks up cleanly next run.
6. Commit, dispatch deploy.

Because each calendar day is only ever targeted once by step 1 above, **an
event a source lists after its day+8 crawl already happened is permanently
missed for that date** — there's no later run that re-checks it. This was
an explicit, deliberate request, not a bug — just remember it if event
counts look lower than expected for a specific date.

---

## 4. The canonical/merge algorithm (`lib/canonical.js`) — likely debug target

Every raw event from every source becomes one **session** on a **canonical
event**:

```js
{
  id: "evt-3f9a2b7c1e08",        // sha1(normalized title+venue).slice(0,12), prefixed
  title, description, image, category, sourceCategory, venue, source, link,
  // ^ all "first-seen-wins" — set once when the canonical event is first
  //   created, NEVER overwritten by a later merge, even from a different source
  tasteScore, tasteTier,          // set by score-events.js, once per canonical event
  date, time,                     // DERIVED = sessions[0].{date,time} (earliest remaining)
  sessions: [ { id, date, time, source, link }, ... ]  // sorted ascending, future-only
}
```

`mergeDay(poolEvents, rawEvents, index)` tries three tiers per incoming raw
event, in order, first match wins:

1. **Exact `(source, link)` hit** in `canonical-index.json` → same canonical
   event. The common case: a play running many nights on the same source,
   robust even if the site's title text wobbles between crawls.
2. **Exact normalized `title+venue` key** matches an existing canonical
   event → attach. Handles the first time a second source lists the same
   show.
3. **Fuzzy fallback**: same venue (normalized) + Jaccard token-overlap on
   title ≥ `0.6` → attach. Safety net for a source's very first sighting
   having slightly different title text than another source already knows
   about. This threshold is a judgment call — if you find real recurring
   shows splitting into duplicates, or unrelated shows wrongly merging,
   `FUZZY_TITLE_THRESHOLD` in `lib/canonical.js` is the first thing to
   tune. (Verified locally with synthetic multi-day tests during the
   migration — see §8 for how to re-run something similar.)
4. No match on any tier → mint a new canonical event.

`pruneAndDerive(poolEvents, today)` then drops past sessions and empty
canonical events, and `pruneIndex(index, survivors)` garbage-collects
`canonical-index.json` entries pointing at ids that no longer exist.

---

## 5. Frontend specifics (`eventportal/app.js`)

- `state.filters` — search, date range, category, venue, sources, list,
  favorites-only, show-dismissed, "Bana Göre" (taste ≥ `TASTE_THRESHOLD =
  3.5`).
- `state.sort` — **new**. `'date-asc'` (default) or `'score-desc'`, via
  `SORT_COMPARATORS`, applied in `applyFilters()` right before pagination.
  UI is `#sortSelect` in the toolbar, same `tb-select`/`select-wrap` markup
  pattern as category/venue.
- Score badge — **new position**: a dedicated `.event-score` block, a flex
  sibling between `.event-main` and `.event-actions` in each row (fixed
  44px width so scored/unscored rows stay visually aligned), not inline
  among the category/source tags like before.
- `sessions[]` awareness — list rows show only the next/earliest session
  (via the derived `date`/`time` fields) plus a `+N tarih daha` tag if
  there are more; the modal (`openModal()`) lists every other session with
  its own source, and the "Orijinal İlana Git" link resolves to
  `sessions[0].link` (falls back to the top-level `link` field).
- `favorites`/`dismissed`/`lists`/interaction log all live in `localStorage`
  and are keyed by canonical event id — unaffected by this migration except
  that ids from the *old* per-showtime scheme are now meaningless (see §7).

---

## 6. Running things locally

All scripts are zero-dependency Node (no `npm install` needed, confirmed no
`package.json` dependencies anywhere in `scripts/eventportal/`).

**`.env` setup**: create `mertgurgenyatagi.github.io/.env` (repo root, next
to this file) containing:
```
GROQ_API_KEY=<your key>
```
This is already covered by the repo's `.gitignore` (`.env` + `node_modules/`
— added during migration). `lib/env.js` looks for it at
`path.join(__dirname, '..', '..', '..', '.env')` from `lib/`, i.e. repo
root — three `..` because `lib/` now sits one level deeper
(`scripts/eventportal/lib/`) than it did in the old repo
(`eventportalalpha/lib/`). If you ever move these files again, this is the
first thing that will silently break (the loader just no-ops if the path is
wrong — no error, `GROQ_API_KEY` will simply read as `undefined` and
`score-events.js` will exit immediately with a clear message, so it's easy
to notice, just not immediately obvious why).

**Manual fetch run** (from `scripts/eventportal/`):
```
node fetch-daily.js
```
Targets `today+8` by default. To backfill or test a specific day:
```
TARGET_DATE=2026-07-25 node fetch-daily.js
```
Note: Biletino and Biletix each do a full-catalog crawl internally
(~30-40 min combined) regardless of the target day, so a local run takes
that long too — this is unchanged from the old repo's behavior and is the
reason the workflow has a 90-minute timeout.

**Manual score run** (from `scripts/eventportal/`):
```
node score-events.js
```
Only scores whatever's currently unscored in `eventportal/data/events.json`
— safe to run repeatedly, it's fully incremental.

**Testing the merge logic without a real 40-minute crawl**: `lib/canonical.js`'s
`mergeDay`/`pruneAndDerive` are pure functions you can exercise directly
with fabricated data, e.g.:
```js
const { mergeDay, pruneAndDerive } = require('./lib/canonical');
let pool = [], index = {};
mergeDay(pool, [{ id: 'x', source: 'Bubilet', title: 'Test', date: '2026-08-01',
  time: '20:00', category: 'Tiyatro', sourceCategory: 'Tiyatro', venue: 'V',
  image: null, description: null, link: 'https://x/y' }], index);
console.log(pool);
```
This is exactly how the merge/prune/tiered-matching logic was verified
during the migration (no real network calls needed).

---

## 7. Things to know that aren't obvious from the code

- **Canonical ids are structurally different from the old per-showtime
  ids.** Old scheme: `makeId(source, nativeKey||link)`. New scheme:
  `sha1(normalizedTitle + '|' + normalizedVenue)`. `ratings.csv`'s `id`
  column was migrated once (`scripts/migrate-ratings-ids.js`) during
  cutover — 200/200 rows changed. If you ever import an old CSV export or
  old `localStorage` favorites/duel-history from the previous repo/site,
  the ids won't match anything and will just silently not apply — not a
  crash, just inert data.
- **Two different "cache" concepts exist, don't conflate them**:
  `lib/cache.js` is a generic background-refresh registry used only
  internally by `biletino.js`/`biletix.js` for their own ~35-day
  crawl-freshness window (`EPA_SKIP_CACHE_AUTOSTART=1` disables its
  auto-start, set at the top of `fetch-daily.js` so the one-shot script
  doesn't race its own explicit `crawlAll()` call). `taste-cache.json` is
  the *scoring* cache, unrelated. `canonical-index.json` is the *merge*
  index, also unrelated to either.
- **GROQ_API_KEY must be a repository secret, not an environment secret** —
  `eventportal-score.yml`'s job doesn't declare an `environment:` block
  (unlike `deploy.yml`, which uses the `github-pages` environment), so an
  environment-scoped secret wouldn't be visible to it.
- **`data/` files don't exist yet until the fetch workflow runs at least
  once.** `score-events.js` handles this gracefully (checks
  `fs.existsSync(EVENTS_JSON)` and no-ops with a clear log line rather than
  crashing), but the frontend will show "Veriler yüklenemedi." until then.

---

## 8. Outstanding / not yet done

- [ ] **Add `GROQ_API_KEY` as a repo secret** in `mertgurgenyatagi.github.io`
      (Settings → Secrets and variables → Actions → Repository secrets).
      Without this, `eventportal-score.yml` runs but exits immediately.
- [ ] **Trigger both new workflows manually once** (Actions tab →
      select workflow → Run workflow) before trusting the cron blindly —
      especially the fetch workflow, since a full real crawl from this new
      location hasn't been run yet (only dry-run tested with synthetic
      data + a syntax/wiring smoke test, not a live 9-source network run).
- [ ] **Archive the old `EventPortal` repo** (Settings → Archive) once
      you've confirmed the new one is working — it's superseded but was
      deliberately not deleted (see below for what's still only there).
- [ ] **`FUZZY_TITLE_THRESHOLD` (0.6) in `lib/canonical.js` is untested
      against real cross-source drift** — only synthetic test cases so
      far. Watch `status.html`'s pool stats after a few real days of
      fetches; if a known recurring show splits into duplicate canonical
      events, or two unrelated events wrongly merge, this threshold (or
      the matching tiers themselves) is the place to revisit.
- [ ] The permanent-miss tradeoff from targeting each day exactly once
      (§3) is accepted/intentional, but if it ever turns out to bite in
      practice, the cheap mitigation is re-fetching a short trailing
      window (e.g. day+1..day+8) instead of only day+8 — discussed but not
      implemented, since it reintroduces some of the redundant-refetch
      cost the single-day model was designed to avoid.

## Things left behind in the old `EventPortal` repo (not migrated, still only there)

- `research/event-category-analysis.md`, `research/event-dedup-analysis.md`,
  `research/five-field-feasibility.md`, `research/smart-filter-analysis.md`
  — the analysis docs behind the 12-category system and the taste-profile
  design referenced in code comments here (`categorize.js`, `score-events.js`).
  Worth copying over if you want them alongside the code they justify;
  wasn't done automatically since they weren't explicitly in scope for the
  migration.
- `DESIGN-cursor.md` — the visual design spec `styles.css` derives from.
- The old accumulated `docs/data/events.json` (1393 events) and
  `eventportalalpha/data/taste-cache.json` (860 entries) — deliberately
  **not** carried forward, per the "let the backlog go" decision.
- The abandoned batching/zero-memory scoring experiments
  (`score-events-batch.js`, `score-events-experiment.js`,
  `recategorize-snapshot.js` and their cache files) — dead ends, not part
  of the production pipeline, intentionally left behind.
- `eventportalalpha/server.js` + `eventportalalpha/public/` — the old
  long-running local dev server. Not migrated; local development now means
  running `fetch-daily.js`/`score-events.js` directly and serving
  `eventportal/` with any static file server if you want to preview in a
  browser (e.g. `npx serve eventportal` from the repo root).

## Where the full design rationale lives

The implementation plan this migration was built from (repo layout
decisions, the canonical data model design, the tiered-matching rationale,
workflow structure) is at:
`C:\Users\Mert\.claude\plans\steady-roaming-forest.md`
