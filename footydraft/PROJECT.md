# FootyDraft

A browser-based football (soccer) squad-drafting party game. This document
describes what's actually in the codebase today — it was written by reading
the source, running the dev server, and running the test suite, not from
design docs or history (there weren't any to read; this folder was
deliberately cleaned of legacy docs before this was written).

## 1. What this is

You build an 11-player squad, in a fixed 4-2-3-1 formation, by drafting from
a pool of 694 real footballers pulled from the top-5 European leagues (real
clubs, crests, and photos). You can play solo against nobody in particular
(effectively a single-player builder) or with friends in a shareable-code
multiplayer lobby synced live through Firebase.

There are four distinct draft formats — not reskins of one engine, four
different mechanics:

- **Auction** — real-time bidding against a shared budget, no turns.
- **Deal or No Deal** — sealed boxes per round, each with a "take it or take
  the banker's offer" choice.
- **Free Pick** — a classic snake draft.
- **Spin the Wheel** — a wheel narrows the pool each turn, then it's a free
  pick within whatever it landed on.

The flow: Home → pick a format → a Solo lobby or a Multiplayer lobby (room
code) → configure scope/constraints → into `/draft/:formatId`. That route is
a **dispatcher**, not a screen — see [§4](#4-directory-structure-and-a-quirk-worth-knowing)
for why that matters if you go looking for files. On completion, a
`SquadCompare` results view is swapped in at the same URL; there's no
dedicated results route and no persistence, so refreshing mid-draft or after
one finishes loses everything.

It's built to be hosted on GitHub Pages under a `/footydraft/` subpath — that
constraint shapes several decisions documented below.

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite 8 |
| Routing | react-router-dom v7, `HashRouter` |
| Styling | Tailwind CSS v4, CSS-native config (no `tailwind.config.js`) |
| Backend | Firebase — Realtime Database + Anonymous Auth only (client SDK) |
| Testing | Vitest + React Testing Library + jsdom |
| i18n | Hand-rolled React Context, no library — English and Turkish |
| State | No global state library — component `useState`, plus a direct RTDB subscription for multiplayer sync |

Notable choices and why, as far as the code itself explains:

- **`HashRouter`, deliberately.** A comment at `src/App.tsx:9-15` spells it
  out: GitHub Pages serves static files with no server-side rewrite rules, so
  a path-based deep link would 404 on refresh. Both lobby routes keep their
  identity in the URL path rather than app state, so `#/solo/free-pick` and
  `#/lobby/KX7QD` are real, shareable addresses.
- **Tailwind v4's CSS-native config**, via `@tailwindcss/vite` — the entire
  theme is a `@theme static { ... }` block at the top of
  `src/styles/index.css`, not a JS config file. `static` is used on purpose
  so Tailwind doesn't tree-shake tokens that hand-written CSS reads directly
  instead of through a utility class (comment at `index.css:13-14`). Six
  "prime" colors are declared; everything else is derived from them via
  `color-mix(in oklab, ...)`. There's one fixed dark theme — no light mode,
  no `prefers-color-scheme` handling — which reads as an intentional
  aesthetic choice given how deliberately the rest of the color system is
  documented, not an oversight.
- **Firebase's footprint is deliberately minimal**: only Realtime Database
  and Anonymous Auth are initialized (`src/lib/firebase.ts`) — no Firestore,
  Storage SDK, or Analytics, even though a `VITE_FIREBASE_STORAGE_BUCKET`
  value is configured and unused. See [§7](#7-multiplayer--firebase).
- **No global state library.** Each draft screen owns its own state; the only
  cross-cutting shared piece is the Firebase RTDB subscription in
  `lib/multiplayer.ts`, consumed via a `useSeats`/`useMultiplayerRoom`-style
  hook pattern rather than a store.

## 3. Running it locally

```bash
cd footydraft
npm install        # node_modules isn't committed
npm run dev         # starts the dev server
npm run build        # typecheck + production build
npm run preview       # serve the production build locally
npm test            # vitest run (one-shot, not watch mode)
```

`dev` and `build` each run a `predev`/`prebuild` hook first
(`node scripts/sync_player_data.mjs`) that copies the player CSV into
`public/` — see [§6](#6-data-pipeline). `build` itself is
`tsc --noEmit && vite build`: a full typecheck gate before Vite/Rollup ever
runs, so a type error fails the build before bundling starts.

The dev server is served under `/footydraft/` (Vite's `base` is hard-set to
that in `vite.config.ts:9`, for the GitHub Pages subpath) — e.g.
`http://localhost:5173/footydraft/`, not the bare root.

### Environment variables

There is **no `.env.example`** in the repo. A fresh checkout needs a
`.env.local` with these `VITE_*` variables (names only — discoverable today
only by reading `src/lib/firebase.ts`):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_STORAGE_BUCKET` — configured but nothing in the app uses Storage
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_PHOTOS_ENABLED` — set locally, but `import.meta.env` for this key is never read anywhere in `src/`; currently dead

The app degrades gracefully without a working Firebase project — see
[§7](#7-multiplayer--firebase) — but multiplayer lobbies won't sync without one.

## 4. Directory structure, and a quirk worth knowing

```
footydraft/
├── data/
│   └── player_data.csv        # source of truth for all 694 players
├── scripts/
│   └── sync_player_data.mjs   # copies data/player_data.csv -> public/, nothing else
├── public/
│   ├── clubs/                 # 69 club crest SVGs
│   ├── leagues/                # 5 league mark SVGs
│   ├── faces/                  # 12 "wall of faces" portraits (Home screen)
│   ├── players-4x5/            # 693 player photos, one per player
│   ├── players-cells/          # 2,772 WebPs = 693 players x 4 density variants (what's actually rendered)
│   ├── stadium.webp, favicon.svg
│   └── player_data.csv         # generated copy, fetched at runtime — not the source of truth
├── src/
│   ├── main.tsx                # StrictMode > I18nProvider > App
│   ├── App.tsx                 # HashRouter + the 5 real routes
│   ├── routes/                 # see the callout below — not every file here is routed
│   ├── components/
│   │   ├── home/                # Home screen only
│   │   ├── lobby/                 # shared: Solo + Multi lobby
│   │   ├── draft/                  # shared draft chrome + per-format pieces
│   │   ├── layout/                  # app-wide chrome: AppShell, AmbientBackdrop, ErrorBoundary
│   │   └── ui/                       # generic primitives: Button, Crest, LanguageSwitch...
│   ├── lib/                    # engines, Firebase/multiplayer, data loading, i18n
│   ├── data/                   # static/generated data tables — see §6
│   ├── styles/index.css        # Tailwind v4 entry + ~1,800 lines of hand-written CSS
│   └── test/                   # setup.ts (jsdom polyfills) + fakeRoom.ts (multiplayer test double)
├── vite.config.ts / tsconfig.json / package.json / index.html
```

**`src/routes/` holds more files than there are routes.** `App.tsx` registers
exactly five paths: `/`, `/solo`, `/solo/:formatId`, `/lobby/:code`, and
`/draft/:formatId`. `Draft.tsx` — the component behind `/draft/:formatId` —
is a *dispatcher*: it reads `formatId` and renders one of four other
components, none of which are routed on their own:

| `formatId` | Renders |
|---|---|
| `'auction'` | `AuctionDraft.tsx` |
| `'deal-or-no-deal'` | `DondDraft.tsx` |
| `'spin-the-wheel'` | `SpinDraft.tsx` |
| anything else (default `'free-pick'`) | a local `DraftRoom` inside `Draft.tsx` |

`SquadCompare.tsx` isn't reachable by any route at all — every format screen
swaps it in inline once its local completion flag flips, at whatever URL the
draft was already on. If you go looking for a `/auction` or `/squad-compare`
address, it doesn't exist.

## 5. Domain model

**`Player`** (`lib/players.ts`) — id, name/surname (teamsheet-formatted,
suffix-aware), nation, age, club/clubSlug, `league: LeagueId | null`
(derived from `clubSlug` via `data/clubs.ts` — deliberately *not* the CSV's
own `League` column, which records the scrape source rather than the club's
real division), position, `ability` and `price` (both explicitly documented
as "never rendered" — they exist purely to drive auto-pick and auction
economics), crest, portrait references.

**`Formation`** (`data/formation.ts`) — one fixed shape, 4-2-3-1, 11
`FormationSlot`s (one position, CB, gets two slots). `SQUAD_SIZE = 11`.

**`Squad`** (`lib/draftEngine.ts`) — a sparse `SlotId → Player` map, one per
drafter.

**`Drafter`** (`lib/draftEngine.ts`) — `{ id, name, kind: 'you' | 'human', mark }`.
Note there is no `'bot'` in that union today — see
[§10](#10-known-issues--rough-edges).

**`Club`** — not a rich type, just `clubLeagues: Record<slug, LeagueId>`, a
generated 69-entry map, one per crest file.

**Constraints and `TableSpend`.** This is the single most counter-intuitive
rule in the app and worth knowing before reading anything else: club/nation
draft constraints (e.g. "max 1 per club") are tallied **across the whole
table, not per squad** — a doc comment at `draftEngine.ts:59-69` calls this
out explicitly as a deliberate reversal of the original per-squad behavior.
One seat taking the last Real Madrid player removes Real Madrid for
*everyone* at the table. In the lobby UI, the constraint option itself is
only exposed for Free Pick (per `SoloLobby.test.tsx`) — the shared logic
supports it generally, but it isn't clear from the tests that the other three
formats exercise it.

### The four formats

*(Listed in the order `data/formats.ts` declares them — see the note at the
end of this section.)*

**Auction** (`lib/auctionEngine.ts`, `routes/AuctionDraft.tsx`) — not
turn-based. A lot list of up to 15×(seat count) players is built: 11×(seats)
guaranteed via per-position, ability-skewed draws (biased toward stronger
players) so every table can fill its XI off the block, plus 4×(seats)
contested surplus, all shuffled together. Each lot opens at 70% of its
derived price (rounded to the nearest 5M, floor 5M); every seat shares a
budget of roughly 19× the pool's average player price, rounded to the
nearest 100M. A lot closes on a 15-second inactivity clock, or instantly once
everyone but the current bidder has explicitly passed. The whole auction
hard-stops the moment no remaining seat can afford *any* remaining lot with
an open slot, or the lot list runs out. Any slot nobody won is backfilled
with the single weakest (lowest-ability, not cheapest) still-available
player for that position.

**Deal or No Deal** (`lib/dondEngine.ts`, `routes/DondDraft.tsx`) — its own
doc comment says `seatAt` (the snake-order helper) "is explicitly wrong here"
— this format doesn't snake. Eleven rounds, one per formation slot, but which
position comes up each round is shuffled once at the start. Turn order is a
strict round-robin that rotates and never reverses. Each round, sealed boxes
are drawn for that position (two per drafter, same ability-skewed sampling as
the auction). On your turn: open one box, then choose the revealed player, or
the "banker" alternative — a real, undrafted pool player whose ability is
nearest the exact average ability of whatever's still sealed.

**Free Pick** (`lib/draftEngine.ts` directly, `routes/Draft.tsx`) — the
baseline: a straight snake draft over 11 rounds, direction reversing each
round. On your turn, pick any eligible player for an open slot from the
scoped pool. If the clock runs out, the engine auto-picks the cheapest
eligible player, with a constraint-ignoring fallback so a squad can never
finish incomplete.

**Spin the Wheel** (`lib/wheelEngine.ts`, `routes/SpinDraft.tsx`) — the pick
itself is a plain free pick (it reuses `draftEngine`'s eligibility logic
directly); the wheel only restricts *which slice of the pool* you may choose
from. The wheel's category — league or club — is fixed once for the whole
draft. Each turn it computes only the slices that currently have a legal
player for the seat on the clock, so an exhausted league or club simply isn't
a slice anymore. Club wheels are capped to the top 15 clubs by player count,
placed via a deterministic hash rather than sorted, so placement is stable
run-to-run but not clustered by league.

A comment in `data/formats.ts:7` reads "The four formats, in the order
PROJECT.md lists them" — referring to a file that didn't exist until this
one. The order above matches it, so that comment is accurate again.

## 6. Data pipeline

**Source of truth**: `footydraft/data/player_data.csv` — 694 player rows,
git-tracked. `scripts/sync_player_data.mjs` is 17 lines and does exactly one
thing: `copyFileSync` that file to `public/player_data.csv`. No network call,
no transform, no env vars — and no error handling, so if the source file is
ever moved, `predev`/`prebuild` fails with a raw unhandled `ENOENT` before
Vite even starts.

At runtime, `lib/players.ts`'s `loadPool()` does a **client-side `fetch`**
of `public/player_data.csv` (not a build-time import) and parses it with a
small hand-rolled CSV parser. It only reads Name/Nation/Age/Club/Position/
Current Ability/Derived Price — the CSV's own `League` column is read and
discarded, because it records the scrape source, not the club's actual
division; league is instead cross-referenced from `data/clubs.ts`.

### `src/data/` — generated vs. hand-authored

| File | Status |
|---|---|
| `clubs.ts` | Generated — 69 entries, one per crest in `public/clubs/` |
| `draftViability.ts` | Generated — self-labeled "do not edit by hand," says it's produced by `scripts/generate_viability_data.mjs` from `draft_config_simulation_results.csv`. **Neither the generator script nor its input CSV exists anywhere in the repo.** It exports `maxViableLobbySize`, a table of Monte-Carlo-simulated max table sizes per format/scope/constraint combination — checked in as a static snapshot with no way to regenerate it from what's here. |
| `formation.ts`, `formats.ts`, `lobbyOptions.ts`, `wallFaces.ts` | Hand-authored — small fixed lists with editorial comments |
| `lobbyPeople.ts` | Hand-authored, but currently unused by anything — see [§10](#10-known-issues--rough-edges) |

**On the two `draftViability.ts` files**: `src/data/draftViability.ts` (the
generated table above) and `src/lib/draftViability.ts` (hand-written logic —
`maxSizeForConfig`, `isScopeAvailable`, etc. — that wraps it) share a
basename in different folders. It looks like duplication on a directory
listing; it isn't. `lib/draftViability.ts:1` imports directly from
`../data/draftViability`, and `lib/draftViability.ts` is in turn the only
thing routes (`SoloLobby.tsx`, `MultiLobby.tsx`) import. It's a real
data/logic split, just confusingly named.

`wallFaces.ts` and `players.ts` each separately reference a companion
generator for their image assets (`make_face_crops.py`,
`make_dotgrid_cells.py`) — like the viability generator, **neither exists in
the repo**. All three derived-data generators are referenced only in
comments; only the trivial CSV-copy script actually ships.

### Static assets (`public/`)

69 club crests, 5 league marks, 12 face portraits, 693 player photos
(`players-4x5/`), and 2,772 density-variant portrait crops (`players-cells/`,
693 players × 4 sizes — these are what actually gets rendered on screen, via
`cellGridSrc()`).

**Known mismatch**: the CSV has 694 player rows, but only 693 players have
matching `players-4x5`/`players-cells` assets. `Player.portraitBase` is
never null (unlike the `crest` field, which is nullable), so whichever one
player lacks image assets will most likely 404 on its portrait at runtime
rather than falling back to a placeholder.

## 7. Multiplayer & Firebase

`lib/firebase.ts` initializes **only** Realtime Database and Anonymous Auth
— no Firestore, Storage, or Analytics. If anonymous sign-in fails, it falls
back to a random `local-<id>` cached in `localStorage`, so the app keeps
working in a degraded mode rather than hard-failing.

**Verified live**: anonymous auth currently fails on *every* session — a 400
from `identitytoolkit.googleapis.com` (`auth/admin-restricted-operation`) —
including pure solo play with no room involved, because the room-subscription
hook attempts sign-in unconditionally regardless of whether multiplayer is
actually in use. The fallback handles it and nothing visibly breaks, but
every page load currently pays for a failed network round-trip it can't use.
Whether this is an accepted state of a public/demo Firebase project or an
oversight isn't something the code can answer — flagging it rather than
guessing.

`lib/multiplayer.ts` is a thin Realtime Database wrapper syncing a whole
draft-room state tree under `rooms/{code}/...`: host uid, status, draft
config, per-uid drafter presence (with `onDisconnect` flipping the presence
flag off), picks, chat, and per-format sub-states for auction/deal-or-no-deal/
spin. In-draft actions (bids, box opens, etc.) are appended to per-format
queues via `push()` and drained by a generic action-queue hook using
`onChildAdded` + `remove` — a host-authoritative consume-and-delete pattern.

There is **no server-side validation** anywhere in this repo — that would
live in Realtime Database security rules, which aren't checked in here. Host
authority (who can advance state) is a client-side convention only, not
enforced by the backend.

## 8. Testing

`npm test` runs Vitest once (not watch mode). Verified by actually running
it:

```
Test Files  12 passed (12)
     Tests  46 passed (46)
```

No skipped or `.only`-restricted tests anywhere in the suite.

- **Engines** (`lib/*.test.ts`): pure-logic tests for auction, deal-or-no-deal,
  and wheel behavior. `rules2026-08-23.test.ts` is a deliberate,
  self-explained convention, not a stray file — its header says it's one
  regression-pinning test per behavioral rule *decided* on that date (auction
  pass-to-close, lowest-ability backfill, table-wide constraints, wheel
  category fallback), so an accidental revert of any of those four decisions
  trips an obviously-named test.
- **Routes** (`routes/*.test.tsx`): render via React Testing Library.
  `AuctionDraft.test.tsx` and `DondDraft.test.tsx` both import `{ Draft }`
  from `./Draft`, not their own named files — they render the dispatcher at
  a given `formatId`, which matches how the app actually routes, but is easy
  to misread as testing the wrong file.
- **`test/fakeRoom.ts`** is a full in-memory stand-in for `lib/multiplayer.ts`,
  with its own header explaining why it exists: the real multiplayer client
  never resolves under jsdom. It's wired in via `vi.mock` in exactly **one**
  test file, `MultiLobby.test.tsx`. The other room-capable tests avoid the
  problem a different way — by never putting a `roomId` in router state, so
  the multiplayer subscription never opens at all.
- **Net effect**: the real `lib/multiplayer.ts`/`lib/firebase.ts` code is
  never executed by the suite, either bypassed or fully faked. In-draft
  realtime sync (auction bids, D-o-N-D actions, spin actions) has no
  coverage of any kind — the fake's stubs for those actions are empty and
  never asserted against.

**Coverage gaps worth knowing about:**
- `lib/draftEngine.ts` — the base every format builds on — has **no
  dedicated test file**. `seatAt`/`slotFor` are only incidentally exercised
  via `wheelEngine.test.ts`'s simulation; the constraint logic is tested only
  on its club branch, not nation; and `timeoutChoice`/`lastResort` — the
  production auto-pick-on-timeout path — has zero test coverage anywhere.
- `auctionExhausted`, the auction's hard-stop condition, is untested.
- `routes/SpinDraft.tsx` (636 lines, the largest route file) and
  `routes/SquadCompare.tsx` have no test coverage, direct or indirect.

## 9. Deliberate design decisions worth knowing

- **Constraints are table-wide, not per-squad** — see [§5](#5-domain-model).
  Counter-intuitive, and explicitly called out as a reversal in the code.
- **The four engines are framework-free by design.** `draftEngine.ts`,
  `auctionEngine.ts`, `dondEngine.ts`, and `wheelEngine.ts` have no React or
  Firebase/multiplayer imports at all — their own header comments say so,
  and it holds up. Network and room state live only in `lib/multiplayer.ts`
  and the route files.
- **A draft can never end incomplete.** The Free Pick timeout path and the
  auction's backfill path both guarantee every slot fills — one via a
  constraint-ignoring last-resort pick, the other via a lowest-ability
  backfill.
- **Auction backfill picks the lowest-*ability* player, not the cheapest**,
  as of the 2026-08-23 rule change — a quality-over-cost decision for slots
  nobody won.
- **i18n falls back silently.** A missing Turkish translation key falls
  through to the English key itself rather than rendering an error marker
  (`lib/i18n.tsx`).
- **Single fixed dark theme, on purpose** — see [§2](#2-tech-stack).

## 10. Known issues / rough edges

### Bots were removed, not just never built

`Drafter.kind` (`lib/draftEngine.ts`) is typed as `'you' | 'human'` — no
`'bot'` option. Grepping the entire `src/` tree for bot-related identifiers
(`addBot`, `isBot`, `BotSeat`) turns up nothing in any actual application
code. The only surviving trace is a single negative test assertion,
`SoloLobby.test.tsx:55`, which checks that an "Add a bot" button is *absent*
in solo mode — a button that no longer exists anywhere in the app, in any
mode, so that assertion is now trivially true rather than meaningfully
testing anything. **According to the project owner, this was a deliberate
removal, not an oversight: the app currently expects a bot-filling feature
that doesn't exist yet, and it's planned to be rebuilt.** That's a statement
of intent from outside this document's own evidence, not something derivable
from the code — worth keeping distinct from the verified facts above it.

### Data/asset generators referenced but missing

Three generator scripts are named in code comments but don't exist anywhere
in the repo: `scripts/generate_viability_data.mjs` (for
`data/draftViability.ts`), `make_face_crops.py`, and `make_dotgrid_cells.py`.
Their outputs are checked in; regenerating any of them from scratch isn't
currently possible with what's here.

### Orphaned code

- **`src/data/lobbyPeople.ts`** is hand-authored and fully wired (people
  list, arrival delays, chat lines) but has **zero importers anywhere** in
  the current `src/` tree (verified by grep). Its own doc comment explains
  what it was for: simulating other people arriving and chatting in a
  friends lobby "since there is no server yet" — but a real, Firebase-backed
  multiplayer lobby now exists (`lib/multiplayer.ts`). This reads like a
  pre-Firebase placeholder that was superseded and never deleted.
- **`WheelCategory`'s `'nation'` value** is typed and has real handling
  throughout `wheelEngine.ts`, but `categoryFor` — the only function that
  ever produces a `WheelCategory` — can only return `'league'` or `'club'`.
  Unreachable code: either unshipped scaffolding for a third wheel mode, or
  a leftover branch.
- **`VITE_PHOTOS_ENABLED`** is a configured env var that's never read by
  anything in `src/`.

### Unexplained provenance

Comments across `draftEngine.ts`, `auctionEngine.ts`, `dondEngine.ts`,
`wheelEngine.ts`, `lobbyOptions.ts`, and several components cite rule IDs
like "R6-Q3" or "R8-Q4" to justify specific decisions (e.g. "overturning
R6-Q3" for the table-wide constraint change). No document defining what
these IDs refer to exists anywhere in the repo — they appear to cite an
external review process that isn't checked in. The decisions themselves are
verifiable in code; their stated justifications aren't.

### Runtime rough edges

- Firebase anonymous auth fails on every session (see [§7](#7-multiplayer--firebase)).
- The CSV/portrait asset count mismatch (see [§6](#6-data-pipeline)).
- `sync_player_data.mjs` has no error handling for a missing source file.
- No `.env.example` — required env vars are only discoverable by reading
  `firebase.ts` source.

### Cosmetic

- `package.json`'s `name` is `"hashtagfootydraft"`; the app, folder, and
  window title all say `footydraft` / `#footydraft`. No functional effect.
- `vite.config.ts` includes a dev-only middleware plugin,
  `terminal-game-narrator`, that opens a `POST /api/log` route which just
  `console.log`s whatever's posted to it during `npm run dev`. It's harmless
  (dev-server only, absent from the production build), but nothing in the
  current `src/` tree posts to `/api/log` — grepped and confirmed zero
  callers. Its purpose isn't evidenced anywhere in this repo.
