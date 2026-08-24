# FootyDraft — Exhaustive Rules & Mechanics Reference (machine-oriented)

Generated 2026-08-24 by direct source inspection of `footydraft/src/**` (not from
`PROJECT.md` alone — cross-checked against it, and against `git blame`/`git log`
where PROJECT.md's prose and the current source disagreed). This document is
written for ingestion by an LLM as ground truth for FootyDraft's rules engine,
not for human onboarding. Density > prose. Every rule below is either a direct
paraphrase of executable code or is marked `[UI-DERIVED]` / `[INFERRED]` /
`[STALE-DOC]` where it isn't.

**Ground-truth precedence used throughout this doc: source code > tests >
code comments > PROJECT.md prose.** Where PROJECT.md and the actual shipped
code disagree, this doc follows the code and flags the divergence explicitly
in §0.1. Do not trust PROJECT.md's Free Pick description without reading §0.1.

---

## 0. Meta

### 0.1 Known PROJECT.md ↔ code divergence (verified, not a guess)

`PROJECT.md` (root of `footydraft/`, written 2026-08-24, commit `411e0c0`)
states, for Free Pick: *"If the clock runs out, the engine auto-picks the
cheapest eligible player, with a constraint-ignoring fallback so a squad can
never finish incomplete."* This is **false as of the current tree**. Verified:

- `src/routes/Draft.tsx:107-112` carries an explicit comment, authored
  2026-08-22 (`git blame`, commit `5a97528b`, two days before PROJECT.md was
  written): *"No clock on this screen... The state, the tick, the mobile
  seconds badge and the cheapest-eligible auto-pick that fired on zero are all
  gone with it."*
- `timeoutChoice()` and `lastResort()` — the functions PROJECT.md's claim
  describes — still exist in `src/lib/draftEngine.ts:180-200`, fully
  implemented, but **`grep`-verified to have zero callers anywhere in `src/`**.
  They are dead code, exported but unreferenced.
- Free Pick (`DraftRoom` in `Draft.tsx`) has **no countdown, no timer state,
  no auto-pick of any kind**. A turn simply waits, indefinitely, for the seat
  on the clock to click Draft. In solo play (the only mode that currently
  exists — see §0.2) this is moot since you are always the seat on the clock.
  In multiplayer it means a drafter who walks away stalls the draft forever
  with no engine-level rescue.
- **A draft CAN in fact end incomplete under Free Pick** in the multiplayer
  case, contrary to PROJECT.md §9's blanket claim "A draft can never end
  incomplete" — that guarantee holds for Auction (backfill) and is now
  falsely generalized to Free Pick in the doc. It does NOT hold for Free Pick
  or Spin the Wheel (also no timeout/no auto-pick — see §4) or Deal or No
  Deal (round advances only on explicit player action, no timeout either).
  **Auction is the only format with a self-completing guarantee**, via
  `weakestFor` backfill (§3.8) — and that guarantee is about unfilled *slots*
  after the lot list/budgets are exhausted, not about a stalled human.
- Root cause: PROJECT.md was generated from a slightly earlier or
  incompletely-diffed reading of the tree, or the clock removal (2026-08-22)
  was miscounted as still-present when writing PROJECT.md's Free Pick
  section on 2026-08-24. Whichever it is, **treat PROJECT.md's per-format
  prose in §5 as unreliable for Free Pick specifically; treat this document's
  §4 below as canonical.**

### 0.2 Solo mode includes bots

Bots are implemented and fully active in Solo Mode. The application uses `onnxruntime-web` to load PyTorch-trained ONNX models directly in the browser via `src/lib/bot/inference.ts`. 

In formats like Deal or No Deal and Auction, bots will actively participate, make decisions, and simulate human latency (randomized between 1s, 2s, or 2.5s). The bots have been observed to exhibit optimal game-theoretic behaviors, such as always sticking in Deal or No Deal, and aggressively exhausting their budgets in Auction.

### 0.3 Other confirmed-dead code (grep-verified zero callers, beyond §0.1)

- `codeSeed()` in `src/lib/roomCode.ts:40-44` — computes a deterministic
  numeric seed from a room code string, per its own comment "so a given room
  always opens on the same draft settings." Nothing calls it. Room settings
  are in fact chosen live by the host in `MultiLobby.tsx`, not derived from
  the code.
- `src/data/lobbyPeople.ts` — hand-authored simulated-arrivals/chat data,
  zero importers, pre-Firebase leftover (per its own header comment and
  PROJECT.md §10).
- `WheelCategory`'s `'nation'` variant — typed and handled throughout
  `wheelEngine.ts` (`entityKey`, `entityLabel`, `wheelSlices`'s sort branch),
  but `categoryFor()` (the only producer of a `WheelCategory`) can only ever
  return `'league'` or `'club'`. Nation-wheel is unreachable at runtime.
- `VITE_PHOTOS_ENABLED` env var — configured, never read by `import.meta.env`
  anywhere in `src/`.

---

## 1. Domain model (exact types)

```ts
// src/data/formation.ts
type PositionCode = 'GK'|'CB'|'LB'|'RB'|'CDM'|'CM'|'AMF'|'LW'|'RW'|'ST'  // 10 codes
type SlotId = 'gk'|'lb'|'cb-l'|'cb-r'|'rb'|'cdm'|'cm'|'lw'|'amf'|'rw'|'st' // 11 slots
interface FormationSlot { id: SlotId; position: PositionCode; x: number; y: number } // x/y = pitch % coords, attacking upward, cosmetic only
const SQUAD_SIZE = 11 // formation.length

// src/lib/draftEngine.ts
type Squad = Partial<Record<SlotId, Player>>          // sparse, one per drafter
interface Drafter { id: string; name: string; kind: 'you' | 'human'; mark: string } // NOTE: no 'bot' in the union — see §0.2/§0.3
interface Pick { overall: number; seat: number; slot: SlotId; player: Player } // overall = 0-based global pick index across the whole draft
```

The **only formation** in the game is fixed 4-2-3-1. It is defined once as an
array of 11 `FormationSlot`s; `CB` is the only position with two slots
(`cb-l`, `cb-r`). Every other code has exactly one slot. There is no
formation selection anywhere in the app.

`Player` (`src/lib/players.ts:5-36`):

```ts
interface Player {
  id: string              // `${nameSlug}|${clubSlug}`, stable within a session
  name: string
  surname: string         // teamsheet form — last word, suffix-aware (see §6.3)
  nation: string
  age: number
  club: string
  clubSlug: string
  league: LeagueId | null // null ⇔ club is outside the top 5 (no crest on file)
  position: PositionCode
  ability: number         // NEVER rendered to a user; drives skew-sampling + timeout/backfill picks
  price: number            // NEVER rendered; drives auction economics + (dead) timeoutChoice
  crest: string | null    // null when club has no crest file
  portraitBase: string    // never null; see §6.5 for the 694-vs-693 asset mismatch
}
```

`ability` and `price` are separately-derived numbers from the CSV
(`Current Ability`, `Derived Price (EURm)` columns) — price is described
elsewhere in the codebase as roughly an exponential function of ability
(`auctionEngine.ts:176` comment), but the exact CSV derivation formula is
**not present anywhere in this repo** — the CSV itself is the source of
truth for both numbers, ingested verbatim.

---

## 2. Global turn-order math

Two distinct turn orders exist across the four formats — do not conflate them.

### 2.1 Snake order (Free Pick, Spin the Wheel share this)

```ts
// src/lib/draftEngine.ts
function seatAt(overall: number, seatCount: number): number {
  const round = Math.floor(overall / seatCount)
  const place = overall % seatCount
  return round % 2 === 0 ? place : seatCount - 1 - place
}
function roundAt(overall: number, seatCount: number): number {
  return Math.floor(overall / seatCount) + 1
}
```

`overall` is the 0-indexed count of picks made so far in the whole draft
(range `[0, seatCount*11)`). Round 1 (0-indexed round 0) goes seat 0→N-1;
round 2 reverses N-1→0; alternates for all 11 rounds. `roundAt` is 1-indexed.
This is the **only** order Free Pick and Spin the Wheel use — both literally
call the same `seatAt`/`roundAt` from `draftEngine.ts`.

### 2.2 Strict round-robin (Deal or No Deal only)

```ts
// src/lib/dondEngine.ts
function seatOrder(round: number, seatCount: number): number[] {
  return Array.from({ length: seatCount }, (_, i) => (round - 1 + i) % seatCount)
}
```

`round` is 1-indexed. Rotates by exactly one seat per round, **never
reverses**. E.g. 4 seats: round 1 = `[0,1,2,3]`, round 2 = `[1,2,3,0]`, round
3 = `[2,3,0,1]`. The code's own comment is explicit that `seatAt` from
`draftEngine.ts` is "explicitly wrong here" — do not apply the snake formula
to DoND.

### 2.3 No turn at all (Auction)

Auction is not turn-based. There is no `seatAt` call anywhere in
`auctionEngine.ts` or `AuctionDraft.tsx`. Any seat may bid on the open lot at
any time subject only to the lockout window (§3.5) and their own budget.
"Whose turn" is meaningless in this format; the only per-seat state that
matters is *holder* (current high bidder on the open lot) and *out*
(passed/priced-out of the current lot).

---

## 3. Format: Auction (`src/lib/auctionEngine.ts`, `src/routes/AuctionDraft.tsx`)

### 3.1 Constants

| Name | Value | Location |
|---|---|---|
| `LOTS_PER_DRAFTER` | 15 | `auctionEngine.ts:16` |
| `AUCTION_BID_SECONDS` | 7 | `auctionEngine.ts:26` — the ONLY value; no longer a lobby setting (removed 2026-08-23, see §7.4) |
| `BID_STEPS` | `[5, 10, 25]` | `auctionEngine.ts:29` — flat increments, do not scale with current price |
| `SKEW_TEMPERATURE` | 10 | `auctionEngine.ts:32` — see §3.2 |
| `LOCKOUT_MS` | 500 | `AuctionDraft.tsx:63` |
| `RESULT_HOLD` | 1900 ms | `AuctionDraft.tsx:50` — hammer-down hold before the next lot opens |

### 3.2 Ability-skewed sampling (shared shape with DoND — same formula, independently implemented)

```ts
// drawSkewed(from, count, random) — auctionEngine.ts:73-98
// Also independently reimplemented as skewedSample() in dondEngine.ts:65-92 — IDENTICAL FORMULA, separate code.
best = max(ability) over the candidate set
weight(player) = exp((player.ability - best) / 10)     // SKEW_TEMPERATURE = 10 in both files
// roulette-wheel draw without replacement: cumulative-weight roll against Σweight, remove drawn player, repeat
```

This is a softmax-style weighting against the *locally best* player in
whatever slice it's handed (position-filtered pool, or whole-pool remainder),
not against a global maximum — so the shape of the curve is scale-invariant
to which subset it's drawing from. `random` defaults to `Math.random` but is
injectable (used for deterministic tests).

### 3.3 Lot list construction (`buildLotList`, `auctionEngine.ts:113-153`)

For an `N`-seat table:

1. Target size = `15N`.
2. **Guaranteed tranche**: for every `FormationSlot` (11 of them, CB counted
   twice), draw `N` players of that slot's position via `drawSkewed`. Net:
   `N` per single-occupancy position × 9 positions + `2N` for CB = **`11N`**
   guaranteed lots, enough to fill every seat's XI off the block alone.
3. **Contested surplus**: the remaining `15N - 11N = 4N` lots are drawn via
   `drawSkewed` from the rest of the scoped pool (players not already
   claimed in step 2), position-agnostic.
4. **Full Fisher-Yates shuffle** of the combined `15N`-length list — reveal
   order is fully random, no quality curve, no position cycling (comment
   cites rule id `R6-Q1`).
5. Each lot gets `number` (1-based, its position in the shuffled list) and
   `opening = openingBid(player)`.

```ts
function openingBid(player: Player): number {
  return Math.max(5, Math.round((player.price * 0.7) / 5) * 5)  // 70% of derived price, rounded to nearest 5M, floor 5M
}
function startingBudget(pool: Player[]): number {
  const avg = mean(pool.map(p => p.price))
  return Math.max(100, Math.round((avg * 19) / 100) * 100)  // avg price × 19, rounded to nearest 100M, floor 100M
}
```

Comment cites this as `R8-Q0, amended 2026-08-19`; "Top 5 leagues comes out
at 800M" is asserted in the source comment (not independently re-verified in
this pass — treat as approximately correct, computed from the live pool at
runtime, not a hardcoded constant).

**Every seat gets the identical budget** — `startingBudget` is computed once
per draft from the scoped pool and applied uniformly; there's no per-seat
budget variance.

### 3.4 Lot lifecycle

A lot is `{ lot: Lot, price, holder: number|null, bids: Record<seat,price>, out: number[], phase: 'live'|'sold'|'unsold', resets: number }`.

- Opens at `phase: 'live'`, `price = lot.opening`, `holder = null`, empty
  `bids`/`out`.
- **First bid** on an unheld lot (`holder === null`) sets `price =
  lot.opening` regardless of which of the three step buttons was clicked —
  effectively there is one "Open the bidding" action, rendered as a single
  button showing the opening price (not `+5/+10/+25`) until someone takes it.
  UI detail: `BidBoard.tsx:79-81` — `offers = held ? BID_STEPS.map(step => {step, lands: price+step}) : [{step: 0, lands: price}]`.
- **Subsequent bids**: `price += step` where `step ∈ {5,10,25}`. Rejected
  (silently, state unchanged) if `price > budgets[seat]` or if the bidding
  seat is already `holder` or already in `out`.
- Every accepted bid: `resets += 1`, which restarts BOTH the 15s countdown
  and the 0.5s lockout (see §3.5). `bids[seat] = price` (last figure that seat
  put up, kept even after being outbid, shown greyed).

### 3.5 The lockout (`LOCKOUT_MS = 500`)

For the first 0.5 seconds of **every** countdown window (initial lot open, and
after every single bid that resets the clock), **no seat may raise** —
`armed` is `false`. This is table-wide, not per-seat: it applies identically
to every bidder including the one who just bid. **Passing is NOT
lockout-gated** — `canPass = live && !youHold && !youOut` has no `armed`
check, only raising does (`canRaise = live && armed && !youHold && !youOut`).
Purpose per source comment: prevents two bidders trading raises faster than
the room can read them, guarantees a minimum look-time on the current price.

### 3.6 Closing a lot — two independent triggers, first to fire wins

```ts
// lotIsDecided(holder, out, seatCount) — auctionEngine.ts:212-220
standing = seatCount - out.length
if (holder === null) return standing <= 0   // everyone has passed with nobody ever having opened it → unsold, no clock wait
return standing <= 1                        // holder + everyone else passed → sold instantly, no clock wait
```

Trigger A: the 7-second countdown reaches 0 with no new bid.
Trigger B: `lotIsDecided()` becomes true — everyone but the (possibly-null)
holder has explicitly clicked Pass. **A pass is final for that lot only** —
a passed seat cannot re-enter bidding on the same lot even if the price were
to somehow become attractive again (it can't rise without a bid, but the
rule is stated as absolute regardless).

On close: `phase → 'sold'` (if `holder !== null`) or `'unsold'` (if
`holder === null`, i.e. nobody ever bid even the opening price — this is the
*only* way a lot goes unsold; an outbid-then-repriced lot always has some
non-null holder at close). Sale recorded: `{lot: number, player, seat: holder, price: holder===null?0:price}`.
Idempotency: the sale-recording effect guards against double-firing (both
triggers can technically race in the same render) by checking
`sales.some(s => s.lot === lot.number)` before appending.

`RESULT_HOLD = 1900ms` display hold on the sold/unsold hammer graphic, then
`cursor += 1` advances to the next lot in the shuffled list.

### 3.7 Landing a purchase

```ts
function landingSlot(player: Player, squad: Squad) { return slotFor(player, squad) } // = draftEngine.slotFor
```

If the buyer has an open slot for that position, the player lands there
directly. **If every slot for that position is already full** (e.g. you
already own 2 CBs and buy a 3rd), the purchase goes to a per-seat **spare**
list instead (comment cites `R7.2-Q1`) — money is still spent, the player is
still "yours," just parked. The owner may **swap** a spare in for whatever
currently occupies that position's slot at any time, including after the
draft has ended (`swapIn()`, `AuctionDraft.tsx:318-348`, comment cites
`R7.3-Q2`) — this is described as "all that is left of post-draft editing
under a hard position gate." Swapping is a straight two-way exchange: the
displaced occupant goes back into the spare list.

### 3.8 Auction end + backfill

```ts
// auctionExhausted(remaining, budgets, squads) — auctionEngine.ts:227-236
if (remaining.length === 0) return true
return !remaining.some(lot => budgets.some((budget, seat) =>
  budget >= lot.opening && openSlots(squads[seat] ?? {}) > 0))
```

The auction hard-stops (checked before each new lot opens) the instant
**either** the lot list is exhausted **or** no seat with an open slot can
afford the opening price of any remaining lot (note: checked against
`lot.opening`, not current live price of anything, and against *any* open
slot count, not slot-for-this-lot's-position specifically — i.e. it does not
verify the affording seat actually still needs *that position*, only that
they have budget ≥ opening AND at least one open slot somewhere).

On stop: every seat's every still-open `FormationSlot` is filled via:

```ts
function weakestFor(position, pool, taken): Player | null {
  // linear scan of pool filtered to `position`, excluding `taken`
  // returns the player with the LOWEST ability (not lowest price)
}
```

Backfill iterates seats `0..seatCount-1` in order, and within each seat,
formation slots in formation-array order, drawing from the **whole scoped
pool minus everyone already spoken for** (picks + spares across the whole
table) — explicitly NOT limited to the `15N` lot list, and explicitly using
ability (not price) as of the 2026-08-23 rule change (previously cheapest;
changed because price ≈ f(ability) but not exactly monotonic-identical).
**This is the one hard self-completion guarantee in the whole game** — every
seat is guaranteed a full 11 regardless of how the bidding went, unless the
scoped pool itself runs out of eligible bodies for a position (not currently
possible at any offered lobby size per the viability table, §7.3).

---

## 4. Format: Free Pick (`src/lib/draftEngine.ts` directly + `src/routes/Draft.tsx`'s `DraftRoom`)

The baseline format. Snake order (§2.1) over 11 rounds. **No dedicated engine
file** — logic lives directly in `draftEngine.ts` (shared by all formats) and
inline in the route component.

### 4.1 Turn flow

On your turn (`activeSeat === youSeat`), you may pick any player from the
scoped pool (§6) for which `blockedReason(...) === null` (§5). Clicking
Draft commits the pick; there is **no automatic advancement of any kind
otherwise** — see §0.1. The engine computes the landing slot via `slotFor`
(first open `FormationSlot` matching the player's position, in formation
array order — for CB this means `cb-l` before `cb-r`).

### 4.2 UI conveniences (not rules, but behaviorally load-bearing)

- On your turn, if the currently-selected pool row is blocked, selection
  auto-jumps to the first unblocked row — but **only once per turn**
  (`armedFor` ref gates on `overall`), so you can deliberately re-select a
  blocked player to read why it's blocked without being bounced off
  immediately.
- Search/filter narrows the visible pool by name/club/nation substring
  and/or `PositionCode` — cosmetic, does not change eligibility.
- Selection survives a pick landing on your target, unless someone else
  (multiplayer) took that exact player first, in which case it re-resolves
  to the first unblocked row.

### 4.3 Constraint (Free Pick's exclusive feature — see §5)

Free Pick is the **only** format where a constraint (`club-1`/`club-3`/
`nation-1`/`nation-3`) is offered in the lobby and actually enforced against
the player. Default when unset: `'club-1'` (`Draft.tsx:106`).

---

## 5. Constraint system (`draftEngine.ts:57-171`) — shared machinery, Free-Pick-only exposure

```ts
interface TableSpend { clubs: Record<string, number>; nations: Record<string, number> }
function tableSpend(picks: Pick[]): TableSpend  // tallies every pick at the table, keyed by clubSlug / nation
```

**Constraints are tallied across the WHOLE TABLE, not per squad.** This is
called out in code as a deliberate 2026-08-23 reversal of the original
per-squad behavior, "overturning R6-Q3." Under `club-1`, the instant *any*
seat takes a Real Madrid player, Real Madrid is gone for **every** seat at
the table, not just the one who took it. There is one shared counter, no
per-drafter view of "how many of this club have I used."

```ts
function capFor(constraint): {key:'clubs'|'nations', cap:number}|null {
  'club-1' → {clubs, 1}; 'club-3' → {clubs, 3}
  'nation-1' → {nations, 1}; 'nation-3' → {nations, 3}
  default (incl. 'none') → null
}
```

`blockedReason(player, squad, constraint, taken, spend)` — checked in this
exact order, first hit wins:
1. `taken.has(player.id)` → `{key: 'Already drafted.'}`
2. `!slotFor(player, squad)` (your own squad already full at that position)
   → `{key: 'Your {position} is filled.', vars:{position}}`
3. constraint cap check against the **table-wide** `spend` (not squad) →
   `{key: '{club} is gone.'}` / `{key: 'Three from {club} already.'}` /
   nation equivalents, depending on cap value (1 vs 3).
4. Otherwise `null` (eligible).

`isEligible = blockedReason(...) === null`. **A blocked player is never
removed from any UI list** — shown, crossed out, captioned with the reason,
by design (teaches the constraint visually rather than hiding the pool
shrinking arbitrarily).

**Constraints apply to Free Pick only.** `draftViability.ts`'s
`takesConstraint(format) = format === 'free-pick'`. Auction, DoND, and Spin
the Wheel all call eligibility checks with the literal string `'none'` as
the constraint argument (or omit it, defaulting to `NO_SPEND`), which
`capFor` maps to `null` → no cap ever applies. This is enforced structurally,
not just by lobby UI hiding the chip — even if you constructed a `DraftConfig`
with a constraint set for e.g. Spin the Wheel, `SpinDraft.tsx` never reads
`config.constraint` at all and hardcodes `'none'` in every `isEligible` call.

---

## 6. Pool, scope, and player resolution (`src/lib/players.ts`, `src/data/clubs.ts`, `src/lib/i18n` N/A here)

### 6.1 Source of truth

`data/player_data.csv` (git-tracked, 694 rows) is copied verbatim by
`scripts/sync_player_data.mjs` (17 lines, `copyFileSync`, no transform, no
error handling for a missing source) into `public/player_data.csv` as a
`predev`/`prebuild` hook. **Runtime loading is a client-side `fetch`**
(`loadPool()`) of that public copy, parsed by a small hand-rolled CSV parser
(quoted-field-aware) — not a build-time import.

Columns actually read: `Name`, `Nation`, `Age`, `Club`, `Position`,
`Current Ability`, `Derived Price (EURm)`. The CSV's own `League` column is
read positionally but **discarded** — it records scrape source, not the
club's real division (e.g. it would file Fenerbahçe under "Serie A"). Real
league membership comes from `data/clubs.ts`'s 69-entry `clubLeagues` map
(club slug → `LeagueId`), generated from which clubs have a crest file in
`public/clubs/`. A club not in that map ⇒ `league: null`, `crest: null`,
still fully present in the pool (i.e. `scope: 'all'` includes it,
`scope: 'top-5'` and `scope: 'league'` exclude it).

Rows are dropped only if `!name || !club || !POSITIONS.has(position)`, or if
`${nameSlug}|${clubSlug}` has already been seen (dedup by that composite
key). Otherwise every row survives, even without a crest.

### 6.2 Scope resolution

```ts
function inScope(player, scope, league): boolean {
  scope === 'league' → player.league === league
  scope === 'top-5'  → player.league !== null
  else ('all')        → true
}
```

Applied as a `.filter()` over the loaded pool by every draft screen, exactly
once, memoized on `[pool, scope, league]`.

### 6.3 Name/id/portrait resolution

- `id = "${slugify(name)}|${slugify(club)}"`.
- `slugify`: lowercase → fold specific non-NFKD-decomposable letters (ø→o,
  ß→ss, ð→d, đ→d, ł→l, æ→ae, œ→oe, þ→th, ı→i) → NFKD normalize → strip
  combining marks → non-alnum runs → `-` → trim leading/trailing `-`.
- `surname` (teamsheet form): last whitespace-delimited word of `name`,
  **except** when that word is a generational suffix (`jr`, `jr.`, `junior`,
  `júnior`, `neto`, `filho`, `ii`, `iii`, case-insensitive), in which case
  the second-to-last word is used instead (so "Vinícius Júnior" → surname
  "Vinícius", never "Júnior").
- `portraitBase`: keyed by bare `nameSlug` UNLESS that slug is shared by ≥2
  players in the pool (e.g. two "Ederson"s), in which case it's
  `${nameSlug}-${clubSlug}` — this disambiguation is computed once over the
  whole loaded pool at parse time, not per-lookup.
- Sort order of the loaded pool: A–Z by `name`, tie-broken by `club` —
  explicitly never by `ability` (kept hidden even implicitly via sort order).

### 6.4 Displayed asset resolution

`crestUrl(clubSlug) = "${BASE_URL}clubs/${clubSlug}.svg"` (null if no
league). Portrait rendering goes through `cellGridSrc(player, density) =
"${portraitBase}--${density}.webp"` pointing into `players-cells/` (2,772 =
693 × 4 density variants), with `Dotgrid` component handling the frame-crop
and falling back to `Crest` on image load failure.

### 6.5 Known asset/data mismatch (unfixed)

CSV = 694 rows; `players-4x5`/`players-cells` assets exist for only 693
distinct players. `Player.portraitBase` is **never null** (unlike `crest`,
which is nullable and has a real fallback path) — so whichever single player
lacks assets will 404 its portrait at runtime with no graceful fallback for
that specific field (the `Dotgrid onError` handler does catch it and falls
back to `Crest`, but that's a rendering-layer catch, not a data-layer
absence-marker).

---

## 7. Lobby / configuration layer

### 7.1 `Choice` lists (`src/data/lobbyOptions.ts`)

```
scopes:      all | top-5 | league          (3 — a 4th, single-nationality, was WITHDRAWN 2026-08-18: simulation showed no nationality seats ≥3, only one seats 2 — "a scope unusable at every table size worth offering isn't a narrowing, it's a dead end")
leagues:     premier-league | la-liga | serie-a | bundesliga | ligue-1   (5, only meaningful when scope='league')
constraints: club-1 | club-3 | nation-1 | nation-3    (4 — Free Pick ONLY, exactly one active, never stacked)
wheels:      league | club                             (2 — Spin the Wheel ONLY, collapses away when scope='league' since league is already fixed)
MIN_SEATS = 2   MAX_SEATS = 5
```

`DraftConfig` shape actually threaded through router state / RTDB:
`{ format?, scope?, league?, constraint?, wheel?, drafters?, roomId? }`.

### 7.2 Defaults when a `DraftConfig` field is unset (per-route, NOT globally consistent — verified by reading each route separately)

| Field | Free Pick default | Auction default | DoND default | Spin default |
|---|---|---|---|---|
| `scope` | `'top-5'` | `'top-5'` | `'top-5'` | `'top-5'` |
| `league` | `'premier-league'` | `'premier-league'` | `'premier-league'` | `'premier-league'` |
| `constraint` | `'club-1'` | n/a (never read) | n/a (never read) | n/a — hardcoded `'none'` regardless of config |
| `wheel` | n/a | n/a | n/a | via `categoryFor(scope, config.wheel)`, falls back to `'league'` for any unrecognized/undefined value |

Lobby-side defaults (`SoloLobby.tsx`/`MultiLobby.tsx` initial state) match:
`scope='top-5'`, `league='premier-league'`, `constraint='club-1'`,
`wheel='league'`.

### 7.3 Viability table (`src/data/draftViability.ts`) — Monte-Carlo-simulated, generator script missing from repo

`maxViableLobbySize: Record<string, number>` keyed
`` `${formatId}|${scopeKey}|${constraintId}` `` where `scopeKey` is `'all'`,
`'top-5'`, or `` `league:${leagueId}` ``, and `constraintId` is one of the 4
offered constraints, or `'na'` for formats that don't take one. **A key
absent from the map means that configuration never works, at ANY size** —
the map only stores each config's ceiling; viability is monotonic in lobby
size (verified at generation time per the file's own header), so "works at
5" implies "works at 2,3,4,5" but a missing key means "works at 0 sizes."
Regenerated 2026-08-23 after constraints became table-wide and the pool grew
546→694 rows; **the generator script and its input CSV
(`draft_config_simulation_results.csv`) do not exist anywhere in this
repo** — this table cannot currently be regenerated from source, only hand-
edited or trusted as-is.

Full table as of this pass:

```
auction|all|na: 5                              deal-or-no-deal|all|na: 5
auction|league:bundesliga|na: 2                 deal-or-no-deal|league:la-liga|na: 2
auction|league:la-liga|na: 4                    deal-or-no-deal|league:premier-league|na: 3
auction|league:premier-league|na: 5             deal-or-no-deal|league:serie-a|na: 2
auction|league:serie-a|na: 5                    deal-or-no-deal|top-5|na: 5
auction|top-5|na: 5                             [deal-or-no-deal|league:bundesliga|na — ABSENT, never works, at any size]
                                                 [deal-or-no-deal|league:ligue-1|na — ABSENT]

spin-the-wheel|all|na: 5
spin-the-wheel|league:bundesliga|na: 2
spin-the-wheel|league:la-liga|na: 4
spin-the-wheel|league:premier-league|na: 5
spin-the-wheel|league:serie-a|na: 5
spin-the-wheel|top-5|na: 5
[spin-the-wheel|league:ligue-1|na — ABSENT]

free-pick|all|club-1: 5          free-pick|top-5|club-1: 3
free-pick|all|club-3: 5          free-pick|top-5|club-3: 5
free-pick|all|nation-1: 3        free-pick|top-5|nation-3: 5
free-pick|all|nation-3: 5        free-pick|top-5|none: 5
free-pick|all|none: 5            [free-pick|top-5|nation-1 — ABSENT]
free-pick|league:bundesliga|none: 2
free-pick|league:la-liga|none: 4
free-pick|league:premier-league|club-3: 2
free-pick|league:premier-league|nation-3: 2
free-pick|league:premier-league|none: 5
free-pick|league:serie-a|none: 5
[free-pick|league:bundesliga|club-1, club-3, nation-1, nation-3 — ALL ABSENT: only 'none' works there, and only up to 2 seats]
[free-pick|league:premier-league|club-1, nation-1 — ABSENT]
[free-pick|league:la-liga|{club-1,club-3,nation-1,nation-3} — ABSENT]
[free-pick|league:ligue-1|* — ABSENT entirely, every constraint AND 'none': Ligue 1 scope never works, for any format, at any size]
```

**Ligue 1 as a single-league scope is dead in every format** — no key of
shape `*|league:ligue-1|*` appears anywhere in the map. The lobby UI dims/
hides it accordingly (`isLeagueAvailable`) but the underlying reason (pool
too thin at that scope, presumably too few Ligue-1-tagged rows in the CSV
relative to positions needed) is never surfaced to the user, by design (`the
lobby reads this to decide what to offer... pool depth is implementation
state and stays off screen`).

Lookup/decision functions (`src/lib/draftViability.ts`):
- `scopeKeyOf(scope, league)` — collapses `('league', X)` → `` `league:${X}` ``, else passes `scope` through unchanged.
- `effectiveSize(seatCount) = max(seatCount, MIN_SEATS)` — a 1-seat solo table is judged against size 2 for viability-availability purposes ONLY (doesn't change the actual `seatCount` used by the engines, which stays 1 — see §0.2).
- `isConfigViable/isFormatAvailable/isScopeAvailable/isLeagueAvailable/isConstraintAvailable` — all pure lookups against the table above, gate what the lobby UI enables/dims. **Not enforced by any engine** — these are lobby-presentation-layer only; nothing stops a hand-crafted `DraftConfig` (e.g. programmatic navigation) from starting a config the table marks non-viable. The engines themselves don't consult `draftViability.ts` at all.

### 7.4 Removed setting: the bid timer

`AUCTION_BID_SECONDS` (15s) used to be a lobby-exposed setting with values
including an "Off" that never actually disabled anything (a lot with no
turn and no clock would sit open forever). Removed 2026-08-23; now a fixed
constant. Documented in a now-content-free comment block at
`lobbyOptions.ts:55-64` for historical context.

---

## 8. Format: Deal or No Deal (`src/lib/dondEngine.ts`, `src/routes/DondDraft.tsx`)

### 8.1 Structure

11 rounds, **shuffled once at draft start** (`roundOrder()`, Fisher-Yates
over the 11 `FormationSlot`s using the injectable `random`) — so which
position comes up in which round varies per draft but every draft still
covers all 11 slots exactly once, self-completing by construction (every
seat fills every position, same order as every other seat). Turn order
within a round: strict round-robin (§2.2), never reverses.

### 8.2 Per-round flow (state machine in `DondDraft.tsx`, `RoundState`)

1. **`dealRound(index)`**: draws `2 × seatCount` boxes via `drawBoxes(pool,
   position, seatCount)` → `skewedSample` (identical ability-skew formula to
   auction's `drawSkewed`, §3.2, independently coded) filtered to the
   round's designated position, no replacement, `2N` boxes numbered 1..2N.
2. **Stage `'open'`**: seats act in round-robin order (`state.order`). On
   your turn (`step:'choosing'`): pick any still-sealed box index. Opening
   reveals it (`step:'revealing'`, held `REVEAL_HOLD=2100ms`), then advances
   to `step:'deciding'`.
3. **Deciding**: two options —
   - **Stick**: keep the revealed player, ends your turn for this round.
   - **Hear the offer**: your seat is appended to `state.hearing`, your turn
     for the *opening* stage ends immediately (does NOT wait for the
     banker), you re-enter later during the `'offer'` stage.
4. Once every seat in `order` has had its opening turn (cursor exhausts
   `state.order.length`), if `hearing.length === 0` the round is `done`
   immediately. Otherwise the **banker prices the round**:
   ```ts
   bankerTarget(unopenedBoxes) = mean(box.player.ability for box in still-sealed boxes)
   ```
   Flat and position-based only — same number for every seat hearing an
   offer that round, never adjusted per-drafter for squad need/history
   (comment cites `R6-Q8`).
   ```ts
   bankerOffers(pool, position, boxes, target, count):
     candidates = pool.filter(position match, NOT already inside any box of this round)
     sort candidates by |ability - target| ascending
     return top `count`, i.e. `count` DISTINCT real undrafted players nearest the target ability
   ```
   `count = hearing.length`. Offers are assigned 1:1 in `hearing` order —
   `hearing[i]` gets `named[i]` — so **each hearing-seat gets a distinct real
   player**, never the same name twice, drawn from the live undrafted pool
   for that position, never from inside a box.
5. **Stranded-seat rule**: if the pool for that position is thinner than the
   number of seats asking to hear (`named[place]` undefined for some place),
   that seat is NOT left waiting — it keeps whatever it opened during the
   `'open'` stage automatically (same outcome as sticking), and is dropped
   from the `'offer'` stage entirely.
6. **Stage `'offer'`**: for seats that DID get a named offer, round-robin
   again in `hearing` order. Each such seat chooses **Take it** (keeps the
   named banker player) or **Back to the boxes** (only available if at least
   one box in the round is still sealed) — going back forces you to open
   another box, and **whatever that box holds is yours, no second decision**
   (`forced: true`; no "stick or hear offer" choice on the forced re-open —
   this is explicit in both a comment and the UI note "Go back and the next
   box you open is yours, whatever it holds").
7. Round ends (`step:'done'`) once every acting seat has resolved (stuck,
   took the offer, or was auto-resolved via stranding/forcing). `ROUND_HOLD
   = 1400ms` pause, then next round deals.

### 8.3 Turn-machine integrity notes (relevant for reasoning about state, not a "rule" per se)

- The whole per-round state machine was rebuilt 2026-08-23 specifically to
  fix a race condition (two state pieces updated by separate stale-closure
  updaters). All transitions now funnel through one `commit(seat, action)`
  function that reads a synchronously-written ref, validates
  `activeSeatOf(state) === seat` before applying anything, and writes both
  `round` and `picks` together. Relevant if reasoning about what "can't
  happen": a duplicated or late remote action cannot double-apply, and
  cannot act on behalf of the wrong seat.
- A box, once opened but never claimed (i.e., its opener went on to hear an
  offer and take it instead, or was forced elsewhere), simply **returns to
  the undrafted pool** — there is no separate "unclaimed box" bookkeeping;
  `availableNow()` is just "scoped pool minus everyone who has a `Pick`
  entry," so an opened-but-unkept box's player is automatically available
  again for future rounds/offers (comment cites `R8-Q6`).

### 8.4 No clock, no constraint, no scope narrowing beyond global scope/league

DoND takes only `scope`/`league` from `DraftConfig`; `constraint` and
`wheel` fields are irrelevant/unread. There is no per-turn timer of any kind
— a round advances purely on explicit action.

---

## 9. Format: Spin the Wheel (`src/lib/wheelEngine.ts`, `src/routes/SpinDraft.tsx`)

### 9.1 What's shared with Free Pick vs. what's unique

The **pick itself is a plain Free Pick**: same `seatAt`/`roundAt` snake
order (§2.1), same `slotFor` slot gate, same underlying scoped pool. What's
unique is that each turn's *choosable subset* is restricted to whatever the
wheel just landed on, and **no constraint is ever applied** — every
eligibility check in `SpinDraft.tsx` passes the literal string `'none'`,
regardless of any `config.constraint` value (which is never even read here).

### 9.2 Category — fixed once for the whole draft

```ts
function categoryFor(scope, preference?): 'league' | 'club' {
  if (scope === 'league') return 'club'      // scope already fixed league; wheel MUST be clubs
  return preference === 'club' ? 'club' : 'league'  // any other/undefined preference → league
}
```

Computed once via `useMemo(() => categoryFor(scope, config.wheel), [scope,
config.wheel])` — never recomputed mid-draft (comment cites `R5-Q1`:
"never changes between spins"). `WheelCategory` also types a `'nation'`
value with real handling in `wheelSlices`/`entityKey`/`entityLabel`, but it
is **unreachable** — `categoryFor` never returns it (§0.3).

### 9.3 Wheel construction, per-turn (`wheelSlices`)

Rebuilt **every single turn**, for whichever seat is currently on the clock
— not once for the whole table. One slice per distinct entity (league id,
or club slug) that currently has **at least one legally-takeable player**
for the active seat's current squad (`isEligible(player, activeSquad,
'none', taken)` — position-open AND not-already-taken, no constraint by
construction). An entity with only players in positions you've already
filled, or with all its players already drafted, simply isn't a slice that
turn — not a dead/unselectable slice, an absent one.

**Club wheels are capped to `TOP_WHEEL_CLUBS`** — a hardcoded 15-club list
(Real Madrid, Arsenal, Barcelona, Juventus, Tottenham, Chelsea, Liverpool,
Atlético Madrid, Bayern Munich, Manchester United, PSG, Aston Villa, Napoli,
Manchester City, Inter — "top 15 by player count in the database"). Any
player at a club outside this set is simply invisible to a club-mode wheel,
even under `scope='all'`.

**Slice ordering**: league wheels keep the lobby's own 5-league order
(stable colours across spins). Club wheels are ordered by
`hashKey(clubSlug)` (32-bit FNV-1a, deterministic, non-alphabetical,
non-league-clustered) — stable run-to-run for the same club set, but
effectively "random-looking" placement.

Under `scope='all'`, a real extra slice, `OTHER_LEAGUE = 'other'` (labelled
"Elsewhere"), appears for players at non-top-5 clubs — real players behind
it, no crest/mark to draw for it.

### 9.4 Spin mechanics

```ts
SPIN_MS = 5600  // fixed spin duration — "runs long on purpose," ~44 spins/draft at 4 seats over 11 rounds
```

```ts
function landingRotation(current, index, count, random): number {
  if (count <= 0 || index < 0) return current + 360*8
  step = 360 / count
  target = -((index + 0.5) * step) + (random() - 0.5) * step * 0.98  // SLICE_SPREAD=0.98
  next = current + 360 * 8    // always ≥8 full extra turns, regardless of how close the target already is
  return next + (((target - next) % 360) + 360) % 360
}
```

Landing point inside the winning slice is **uniformly random across the
whole slice width**, not biased to the centre (an earlier version clamped to
the middle 56%; changed so a landing near a slice boundary is possible and
unambiguous — 0.98 spread leaves a hairline clearance at each edge only).
Slice index for the spin is chosen with plain uniform `Math.random()` over
however many slices are currently live (no ability weighting — the wheel
itself is unweighted; only the ability-skew appears in Auction/DoND box
draws, NOT here).

### 9.5 Post-landing pick

Once `phase:'landed'` and `landedTurn === overall` (guards against a stale
wheel face persisting into the next turn — see the "unrepresentable window"
comment in source), the pool for that turn is:
`scoped.filter(entityKey(p,category)===landed.key).filter(isEligible(p,activeSquad,'none',taken))`.
Picking commits exactly like Free Pick. **No timeout, no auto-pick** here
either (§0.1's caveat applies equally to Spin the Wheel — verified, `SpinDraft.tsx`
has no timer state of any kind, matching its own comment "there was never
anything here for a countdown to close").

---

## 10. Post-draft: `SquadCompare` (`src/routes/SquadCompare.tsx`)

**There is no scoring, no winner, no ranking, no numeric output of any
kind.** Every seat's completed 4-2-3-1 is rendered as an equally-sized pitch
diagram, side by side (CSS grid, up to 5 columns, no scroll, shrink-to-fit
via container queries), portraits + surnames on each node. `ability` and
`price` are never surfaced anywhere on this screen (consistent with them
being flagged "never rendered" at the `Player` type level). The screen is
reached by every format's own completion check swapping it in **inline, at
whatever URL the draft was already on** — there is no dedicated
`/squad-compare` or `/results` route, and no persistence: refreshing here
loses the whole draft (confirmed — `localPicks`/room state is not written
to any durable store beyond the live RTDB room tree, which itself isn't
archived).

---

## 11. Routing (`src/App.tsx`)

`HashRouter` (deliberate — GitHub Pages has no server rewrite rules, so a
path-based deep link would 404 on refresh; the hash never round-trips to the
server). Exactly 5 registered paths:

```
/                      → Home
/solo                  → SoloLobby (no format pre-selected)
/solo/:formatId        → SoloLobby (format pre-selected from the tile clicked)
/lobby/:code           → MultiLobby
/draft/:formatId       → Draft   ← DISPATCHER, not a screen (see below)
* (catch-all)          → Home
```

`Draft.tsx`'s `Draft()` component is a pure dispatcher on `formatId`:
`'spin-the-wheel'→SpinDraft`, `'deal-or-no-deal'→DondDraft`,
`'auction'→AuctionDraft`, anything else (default, including literally
`'free-pick'`) → the local `DraftRoom` component defined in the same file.
None of `SpinDraft`/`DondDraft`/`AuctionDraft`/`DraftRoom` are independently
routed — there is no `/auction` or `/free-pick` address; they only exist as
render branches of `/draft/:formatId`. `SquadCompare` is not routed at all
(§10).

**Entry flow**: clicking a format tile on Home navigates straight to
`/solo/:id` (bypassing any solo/multi choice screen — that choice is made by
which button you click on Home: a format tile ⇒ solo, the bottom
Create/Join bar ⇒ multiplayer). Multiplayer does NOT pre-select a format —
`MultiLobby`'s host picks it fresh inside the room after the code is minted/
joined.

---

## 12. Multiplayer (`src/lib/multiplayer.ts`, `src/lib/firebase.ts`, `src/lib/seats.ts`)

### 12.1 Backend footprint

Firebase Realtime Database + Anonymous Auth only — no Firestore, Storage, or
Analytics initialized, even though a Storage bucket env var is configured
(unused). **Anonymous auth is currently verified failing on every session**
(400 `auth/admin-restricted-operation` from `identitytoolkit.googleapis.com`)
— including pure solo play, because the room-subscription hook
unconditionally attempts sign-in regardless of whether multiplayer is
actually in use. Fallback: a random `local-<id>` cached in `localStorage`
keeps the app functioning in a degraded-but-working mode. Every page load
currently eats one wasted failed network round-trip because of this.

**There is no server-side validation anywhere** — RTDB security rules
aren't checked into this repo. "Host authority" (who is allowed to advance
game state) is a pure client-side convention (`isHost = room?.host === uid`
gates which client's local state effects are allowed to write back to
Firebase), not enforced by the backend. A malicious or buggy non-host client
could in principle write directly to the room tree and nothing would stop
it.

### 12.2 Room state tree (`rooms/{code}/...`)

```
host: uid
status: 'lobby' | 'drafting' | 'complete'
config: DraftConfig
drafters: Record<uid, Drafter & {online: boolean, offlineAt?: number}>
picks: Record<pushKey, {overall, seat, slot, playerId}>   // Free Pick / Spin share this shape via `picks`... actually Free Pick uses `picks`, Spin uses its own `spinState.picks` (see below) — NOT the same field
chat: Record<pushKey, Message>
auctionBlock, auctionSales: per-format sub-state (Auction)
dondRound, dondPicks: per-format sub-state (DoND)
spinState: per-format sub-state (Spin: {picks, feed, rotation, phase, landed, landedTurn})
auctionBids / dondActions / spinActions: per-format ACTION QUEUES, drained by host via `useActionQueue`
```

Correction/clarification on `picks`: `Draft.tsx` (Free Pick) reads/writes
top-level `room.picks` via `makePick()`/direct RTDB push. `SpinDraft.tsx`
keeps its own picks array **inside** `spinState.picks`, written wholesale via
`updateSpinState()` rather than incrementally pushed — i.e. Free Pick and
Spin the Wheel do NOT share the same RTDB sub-tree for picks despite sharing
the same picking logic client-side.

### 12.3 Action-queue pattern (bids, box-opens, spin drafts)

In-draft player-initiated actions from non-host clients are `push()`ed onto
a per-format queue path (`auctionBids`, `dondActions`, `spinActions`); the
host's `useActionQueue` hook attaches `onChildAdded`, applies the payload to
its own local authoritative state via the same `commit`/`applyBid`/etc.
functions a local host-seat action would use, then `remove()`s the queue
entry. A `seen` Set covers the window between handling and the remove
landing, so a re-attachment (e.g. a re-render) doesn't replay history —
`onChildAdded` otherwise fires for every existing child on attach.

### 12.4 Seat table construction (`useSeats`, `src/lib/seats.ts`)

**Order**: host first, then remaining uids ascending lexicographically.
Deterministic across all clients, and — critically — **independent of
`Drafter.kind`**, so a seat's ordering position cannot shift under it (e.g.
if `kind` were ever toggled by some future reconnect/takeover mechanic).
`youSeat = -1` until your own uid is actually present in `room.drafters`;
`seated` flag exists precisely so screens can gate rendering until then
(`Math.max(0, indexOf(...))` would have silently aliased "not seated yet" to
seat 0 = the host, which was a real prior bug this hook fixed).

### 12.5 Firebase null/undefined stripping — a recurring source of client-vs-host state divergence

RTDB drops `null` values and empty containers (`{}`, `[]`) entirely on
write — a non-host client reading the tree back gets a **different shape**
than the host wrote. This is explicitly worked around with `normalise*()`
functions in both `AuctionDraft.tsx` (`normaliseBlock`, `normaliseSales`)
and `DondDraft.tsx` (`normaliseRound`), each re-injecting the expected
`null`/`{}`/`[]` defaults for fields whose absence would otherwise be
misread as a different game state (e.g. `holder: undefined` reads as
truthy-not-null on a naive check, which previously broke "who currently
holds this lot" on every guest client). **Any code touching raw
`room.*Block`/`room.*Round`/similar sub-state must go through these
normalisers** — reading the raw RTDB snapshot directly is a known footgun
in this codebase.

### 12.6 Presence

Each seated client writes `online:true` on join/reconnect and registers
`onDisconnect(meRef).update({online:false, offlineAt: serverTimestamp()})`.
No automatic seat removal, no bot-takeover of a disconnected seat (that
machinery was removed along with bots, §0.2/§0.3) — an offline seat just
sits there marked offline indefinitely; nothing currently un-stalls a draft
around a departed player except manual intervention outside the app (e.g.
someone else eventually acting if the stalled seat happens to not be the
active one, but if the offline seat IS on the clock, per §0.1 the draft
simply waits forever in Free Pick/Spin/DoND).

### 12.7 Room codes

5-character codes from a 33-character alphabet excluding `I,O,0,1`
(`ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'`), generated via
`crypto.getRandomValues` (falls back to `Math.random` if unavailable).
`normaliseRoomCode` uppercases and strips to the same alphabet, truncated to
8 chars (`CODE_LENGTH=5` for generation, but typed/pasted input is accepted
up to 8 before truncation — asymmetry is intentional/tolerant of manual
entry). `isRoomCode` just checks length ≥ `CODE_MIN=4` after normalization —
does not verify the room actually exists.

---

## 13. i18n (`src/lib/i18n.tsx`, `src/lib/translations.ts`)

English and Turkish only, hand-rolled Context, no library. **The English
string IS the translation key** — there's no separate key namespace.
`t(key, vars)`: if `language === 'tr'`, looks up `tr[key]`; **falls back
silently to the raw English key itself** if absent from the Turkish table
(no error marker, no visible "missing translation" indicator — a partially-
translated UI just shows English fragments inline). Every phrase with a
variable is one whole-sentence key with `{placeholder}` tokens — never
English fragments concatenated with a name at the call site — specifically
because Turkish word order (verb-final) breaks under fragment concatenation
in a way whole-sentence keys don't. `Blocked.key`/`.vars` from
`blockedReason` (§5) follow this same pattern: the rule layer emits a key +
substitution vars, never a finished sentence, so it's translatable without
the engine knowing about language at all. Persisted language choice:
`localStorage['footydraft.language']`, defaults to `'en'` if unset or
storage is unavailable (private browsing, etc. — wrapped in try/catch).

---

## 14. Tech/build facts relevant to reasoning about "what's actually running"

- `npm run build` = `tsc --noEmit && vite build` — full typecheck gate
  before bundling; a type error fails the build outright.
- `predev`/`prebuild` hooks run `scripts/sync_player_data.mjs` — if
  `data/player_data.csv` is ever moved/renamed, this fails with a raw
  unhandled `ENOENT` before Vite even starts (no error handling by design/
  omission).
- App is served under `/footydraft/` base path always (hardcoded in
  `vite.config.ts`), for GitHub Pages subpath hosting — not just in
  production; the dev server uses the same base.
- Tailwind v4, CSS-native `@theme static {...}` config (no JS config file);
  6 declared "prime" colors, everything else `color-mix(in oklab, ...)`
  derived. One fixed dark theme, no light mode, no `prefers-color-scheme`
  handling anywhere — deliberate, not an oversight (asserted by the
  deliberateness of the surrounding color-system documentation, not by an
  explicit "no light mode" comment — treat as `[INFERRED]`).
- Test suite: 12 files / 46 tests, all passing, none skipped, as of the last
  verified run in PROJECT.md's own writing pass. **No dedicated test file
  for `draftEngine.ts`** — its `seatAt`/`slotFor` are only incidentally
  exercised via `wheelEngine.test.ts`; constraint logic is tested on its
  club branch only, not nation; `timeoutChoice`/`lastResort` (already noted
  dead, §0.1) have zero coverage, unsurprisingly. `auctionExhausted` is
  untested. `SpinDraft.tsx` (636 lines) and `SquadCompare.tsx` have zero
  test coverage, direct or indirect. The real `multiplayer.ts`/`firebase.ts`
  code paths are never executed by the suite — either bypassed (no `roomId`
  in test router state) or fully faked via `src/test/fakeRoom.ts` (wired via
  `vi.mock` in exactly one test file, `MultiLobby.test.tsx`). In-draft
  realtime sync (bids, DoND actions, spin actions over the wire) has **no
  test coverage of any kind**.
- Unexplained rule-ID citations (`R6-Q3`, `R8-Q4`, `R5-Q1`, `R7.2-Q1`,
  `R6-Q8`, `R8-Q0`, `R6-Q1`, `R6-Q2`, `R5-Q7`, `R3-Q10`, `R7.3-Q2`, `R8-Q6`,
  etc.) appear throughout the engine/component comments citing an external
  review process ("the questionnaire" per removed docs) — **no document
  defining what these IDs refer to exists anywhere in this repo** (the
  2026-08-24 purge commit removed `.agents/skills/` and other non-essential
  docs that may have held this). The *decisions* these comments justify are
  independently verifiable in code (and are documented throughout this
  file); their *stated justification/provenance* is not verifiable, only
  quotable.

---

## 15. Quick cross-format comparison table

| | Auction | Deal or No Deal | Free Pick | Spin the Wheel |
|---|---|---|---|---|
| Turn structure | none (real-time) | strict round-robin, no reversal | snake, reverses/round | snake, reverses/round |
| Rounds | n/a (lot-driven) | 11, position order shuffled once | 11 | 11 |
| Constraint (club/nation cap) | never | never | **only format that has one** | never |
| Currency/budget | yes (`startingBudget`, shared across table) | no | no | no |
| Ability-skewed sampling | yes (lot list) | yes (box draws) | no (whole scoped pool, A–Z) | no (wheel category selection is uniform; underlying player pool per-slice is whatever the CSV holds) |
| Self-completion guarantee | **yes** — `weakestFor` backfill | no explicit backstop beyond stranded-seat handling (§8.2.5) filling from what's opened | **no** (dead `timeoutChoice`, §0.1) | **no** (no timer/auto-pick, §9.5) |
| Per-turn/per-lot timer | 15s inactivity clock + 3s post-bid lockout | none | none (removed 2026-08-22) | none (5.6s spin is not a decision timer, purely animation) |
| Config fields actually read | `scope`,`league` | `scope`,`league` | `scope`,`league`,`constraint` | `scope`,`league`,`wheel` |
| Post-lot/turn "final answer" mechanic | pass (final for the lot) | stick / take offer / go back (forced pick on re-open) | direct pick, no take-backs | direct pick, no take-backs |

---

## 16. If extending or reasoning about "what should happen"

- The table-wide constraint model (§5) and the ability-skew formula (§3.2)
  are the two mechanics most likely to be misremembered as per-squad/
  uniform-random respectively by anyone reasoning from genre convention
  rather than this codebase specifically — both are explicit, tested,
  2026-08-23-dated deliberate decisions, not defaults.
- Do not assume Free Pick or Spin the Wheel have any failsafe against a
  stalled turn. If designing bot-fill or reconnect-takeover (flagged in
  PROJECT.md §10 as planned), that is new functionality, not a restoration
  of something merely disabled — the removal in `87f42af` was total (types,
  hooks, default-drafter entries, all deleted, not commented out).
- `NO_SPEND = {clubs:{}, nations:{}}` is the shared empty-tally sentinel any
  new call site should use when a format doesn't want constraint checking at
  all — this is the pattern Spin the Wheel and Auction already follow
  (either passing `'none'` as constraint, or omitting the `spend` arg to let
  it default).
- Anything citing an `R#-Q#` id in a comment is asserting "this was a
  deliberate decision, verified against a process we can no longer see the
  paper trail for" — treat the decision as authoritative (it's live code)
  but do not go looking for the questionnaire; it isn't in this repo (§14).
