# Frontend & Backend Inspiration

Two references, two different jobs. Both examined 2026-08-15.

1. **Visual design** — lifted from **#irishtable** (`https://mertgurgenyatagi.github.io/theirishtable/`), a live, deployed site. Examined via browser at desktop (1536px) and mobile (390px) widths across its Home, Scoring, and About pages, including computed-style extraction (exact colors/fonts/spacing, not eyeballed).
2. **Backend flow** — lifted from **kupatakipucl** (`C:\Users\Mert\Desktop\repos\kupatakipucl`), an unreleased, more complex project the user says has the synchronization/optimization "flow" they want to not have to rediscover. Examined via its two prior-session handover docs (`HANDOVER.md`, `PROJECT_STATE.md`) cross-checked against actual source (Firestore/RTDB rules, Cloud Functions, sync hooks).

Section 3 connects both back to the specific mechanics already decided in `PROJECT.md`.

---

## 1. Visual Design Language — from #irishtable

### 1.1 Overall feel
Dark, branded, editorial sports-app aesthetic — not a generic SaaS look. A near-black *tinted* background (never pure black or gray), exactly one loud saturated accent color, big condensed uppercase display type for anything that needs to grab attention, and a quiet neutral sans for anything meant to be read.

### 1.2 Color palette (exact values, via computed styles)

| Token | Value | Used for |
|---|---|---|
| Page background | `#17021B` | `<body>` — near-black eggplant, not pure black |
| Header / raised surface | `#37003C` | site header bar |
| Card / panel surface | `#26092C` | content cards (one step lighter than page bg) |
| Card border | off-white @ ~10% opacity | hairline separation, not a hard line |
| Primary text | `#F4ECF5` | headings, primary copy — off-white with a lavender tint, never pure `#fff` |
| Secondary/body text | same off-white @ 58% opacity | paragraph copy — a whole text hierarchy from one color + opacity, no second gray needed |
| Accent | `#00FF87` | CTAs, active nav state, links, eyebrow labels |

Worth flagging: `#37003C`/`#00FF87` are (near enough to be deliberate) the Premier League's actual brand purple/green. irishtable earns that by being PL-specific. **footydraft spans multiple leagues, so don't reuse those literal hex values** — but the *formula* transfers directly: near-black tinted background + exactly one saturated accent + off-white-not-pure-white text. Pick footydraft its own accent (something tied to the "#" mark, or a pitch green distinct from the PL green above).

### 1.3 Typography
- **Oswald** (variable), condensed + uppercase — every piece of UI chrome: H1/H2s, eyebrow labels, nav links, all button text, countdown-timer digits. Weight ranges 500–700 by role.
- **Inter** (variable) — body copy only. Long-form paragraphs run 18px text / 29px line-height, deliberately generous for legibility against a dark background.
- The pairing logic is simple and reusable as-is: one loud condensed font for anything short/functional, one quiet grotesk for anything read at length. Maps cleanly onto footydraft's own split (position labels, bid amounts, formation slot names vs. rules text, chat, lobby messages).

### 1.4 Components observed
- **Primary CTA** — fully pill-shaped (`border-radius` effectively 9999px), solid accent fill with page-background-colored text (inverted contrast so it's the brightest thing on the page), generous 32px horizontal padding.
- **Nav links** — pill-shaped; inactive = transparent + off-white text; active = translucent accent background (~15% opacity) + accent text. A soft wash instead of an underline for "current page."
- **Secondary/utility button** (e.g. "Share") — smaller rounded-rect, not a full pill, dark surface fill. Two distinct button shapes signal primary vs. utility action without needing a third color.
- **Cards** — surface one step lighter than page bg, hairline border, ~15px corner radius, and a genuinely offset drop shadow (`6px 6px 10px` black @ 45%) rather than a soft ambient blur — reads as a "lifted card" with real direction, not a generic soft glow.
- **Countdown timer** — big bold Oswald digits (~45px) over small uppercase unit labels (DAYS/HOURS/MINS/SECS). Directly reusable for footydraft's per-turn/per-bid countdown.
- **Horizontal crest strip** — scrolling row of club badges under the hero. Reusable for a Scope-selection screen or a squad summary strip.
- **Timeline/stepper** (About page) — horizontal row of dots on a connecting line, filled = current/passed, hollow = future, date + label under each. Maps well onto a "draft phase" indicator (lobby setup → drafting → complete) or a lobby's format/scope confirmation flow.
- **Background texture** — a literal 1px-line CSS grid overlaid across the whole page at ~8% opacity (two overlapping `linear-gradient`s, no images). Cheap, adds texture without competing with content.

### 1.5 Responsive behavior
- Full nav collapses to a hamburger icon opening a **left slide-in drawer** at mobile widths (confirmed at 390px).
- The drawer's active item swaps the pill treatment for a left-edge accent bar — same "you are here" language, adapted to a vertical list.
- Hero content stacks to a single column; the countdown moves above the CTA.

---

## 2. Backend / Data-Flow Architecture — from kupatakipucl

### 2.1 Stack
| Layer | Technology |
|---|---|
| Frontend | React 18.3 + TypeScript (strict), Vite |
| Routing | react-router-dom v6, `HashRouter` (chosen specifically so static hosting needs no server rewrite rules for deep links — relevant since footydraft is also GitHub Pages) |
| State management | **No global store.** No Redux/Zustand/Context-as-store. Small custom hooks, each owning one Firestore/RTDB subscription, called directly in components. |
| Styling | Tailwind CSS v4, shadcn, Framer-Motion-successor for animation, `@dnd-kit` for drag-and-drop |
| Backend | Firebase: Auth (Google), **Firestore** (store of record), **Realtime Database** (presence/typing only), Storage |
| Server compute | Firebase Cloud Functions (Node 20) |
| Testing | Vitest/RTL for units; a separate suite runs against real `firebase emulators:exec` specifically for concurrency-sensitive logic |

### 2.2 Core principle: no hand-rolled optimistic state
Every write is a plain fire-and-forget `setDoc`/`updateDoc`/`writeBatch`. Every piece of UI reads live data through a direct `onSnapshot` listener — one hook per data need. The pattern is **write, then let the listener bring the truth back**; the only "optimism" present is the Firestore SDK's own local-echo, not anything hand-built. This is a real simplification worth carrying over: don't build a client-side optimistic-update layer for footydraft unless a specific interaction (e.g. bid button) proves the SDK echo isn't fast enough.

### 2.3 Firestore vs. Realtime Database split
- **Firestore** = anything that's a durable *document*: profiles, predictions, results, posts, messages, lobbies.
- **Realtime Database** = exactly two ephemeral, high-churn signals: **presence** and **typing indicators**. Nothing else touches it.

This split was a deliberate migration *away* from doing presence on Firestore, for a measured reason: a 20-second heartbeat write watched by a collection-wide listener costs `O(writers × listeners)` — every heartbeat fans out as a read to every other watching client, and this alone could exhaust a free-tier read budget in minutes at real concurrency. RTDB's presence mechanism has **no heartbeat at all** — it registers a server-side `onDisconnect().remove()` hook *before* writing the presence flag, so a dropped connection is cleaned up by Firebase's own servers, not a client-side timeout. No staleness window to reason about.

Typing status layers three independent rate limits, worth reusing verbatim anywhere "who's about to act" matters: a 6s client-side staleness cutoff for readers, a 1s minimum-write-interval enforced client-side, and a matching ≥1s write-gap enforced **server-side in the RTDB rules themselves** — the rule-level check is a spam/cost backstop that survives a buggy or malicious client, not just a UX debounce.

**Direct footydraft mapping:** lobby member online/offline, host-transfer-on-disconnect (`PROJECT.md` R6-Q6), and the 45-second disconnect-to-bot-replacement (R3-Q6/R4-Q3) are exactly the shape RTDB + `onDisconnect()` solves cleanly — no heartbeat polling, no client-side timeout guessing.

### 2.4 Server-authoritative computed state — the single most reusable pattern here
kupatakipucl's leaderboard is never computed by clients. A Cloud Function triggers on every write to the underlying data, recomputes the full standings, and writes the result to **one cache document** that clients only ever read (security rules deny client writes to it outright). The general rule: **shared derived state is always server-computed and read-only to clients; only a client's own local UI state is locally derived.**

The interesting part is *how* it stays correct under concurrent writes. A single admin action can rewrite 36 documents in one batch, and naively each write independently triggers its own overlapping recompute — with no concurrency control, an older in-flight read could finish *after* a newer one and silently clobber a fresher result, with nothing scheduled to ever fix it. The fix is a two-layer scheme, implemented as pure, independently unit-tested functions:

1. **Early stand-down** — before doing any work, check whether a finished recompute already read data *after* this trigger's own write committed; if so, skip entirely. This is what makes coalescing work even when triggers run strictly sequentially (the emulator's actual behavior) — a debounce alone was proven to collapse *nothing* under sequential execution, only under real overlapping concurrency.
2. **Debounce + "newest wins" + a staleness ceiling** — each request tags a control document with its own random token, waits briefly, then only proceeds if it still holds the newest token *or* the last real compute has aged past a ceiling (the ceiling exists specifically so a sustained write stream can't starve every request forever).
3. **Transactional commit guard** — a computed result is only stored if, inside a Firestore transaction on the control doc, no newer request has started and no fresher-read compute has already landed. This is the actual correctness guarantee: stored results are monotonic in read freshness under any interleaving, independent of whether the debounce/token layer behaves as hoped.
4. **A scheduled safety net** (every 5 minutes) recomputes if the control doc shows unincorporated changes — self-healing against any dropped trigger, because "the shared state is silently wrong" was judged the worst possible failure mode.

Measured effect in production: a 36-document batch write went from ~36 recomputes to 3; a 200-write burst went from a race-prone flood to 2 recomputes with no lost updates.

**Direct footydraft mapping:** this is structurally identical to Auction's "current highest bid on a footballer" and the hard, global "auction has run its course" stop (`PROJECT.md` R3-Q10) — multiple players can bid near-simultaneously, and *who's winning* / *has the auction ended* must be one server-computed, race-free answer that every client just reads, never resolves independently. Same shape applies to Deal or No Deal's box/offer state.

### 2.5 Turn/timer handling — a gap, not a pattern to copy
kupatakipucl has **no live turn-timer mechanism**. Its closest analog — "tournament phase" — is a single, manually admin-set Firestore document that all clients subscribe to, with transitions triggered by a human, not a clock. footydraft's timers (15s default bid/pick timer, DoND stick/take defaults, 45s disconnect-to-bot) are genuinely new territory here. The right foundation to build on is 2.4's shape: a written "turn deadline" timestamp plus a scheduled/triggered Cloud Function that force-resolves on timeout the same way the recompute-guard force-resolves stale state — but this needs its own design pass, nothing in kupatakipucl already does it.

### 2.6 Disconnection & reconnection
- **Presence/typing**: fully server-side via RTDB `onDisconnect()`, as above.
- **Firestore data**: **no offline persistence was enabled** (no `enableIndexedDbPersistence`/`persistentLocalCache` anywhere) — the app relies on the SDK's default in-memory cache and retry. A write queued while offline is only held as long as the tab stays open; nothing survives a hard reload. This was an accepted gap there. Worth deciding *deliberately* for footydraft rather than inheriting silently — a bidder's in-flight action not surviving a reload is a worse failure mode in a live auction than in a prediction-entry form.
- **`fromCache` guard convention** — a real, documented bug: Firestore can synthesize a fast, partial, cache-only snapshot from documents an *unrelated* listener already cached elsewhere in the app, so a collection listener can briefly report "loaded" with 1 of N real documents. The fix, now a standing convention across every listener hook: ignore snapshots where `metadata.fromCache === true` until the first server-confirmed snapshot arrives, only then flip loading to false. Worth adopting from day one in footydraft's own hooks — a lobby's live participant list or an auction's live bid list is exactly the shape vulnerable to this.

### 2.7 Concrete optimization techniques worth reusing verbatim
1. **Server-precompute + single-cache-doc read** for anything leaderboard/draft-board-shaped.
2. **Debounced, monotonic-commit coalescing** (2.4) for any high-fan-out shared-state recompute.
3. **Bounded live window + on-demand pagination** for chat/feeds — one shared module doing `onSnapshot(orderBy(...).limit(50))` for the live tail plus a separate one-shot `getDocs` with `startAfter` for "load older," reused across three different chat/feed surfaces rather than rewritten each time. Maps directly onto footydraft's always-on lobby chat requirement.
4. **Two-layer client cache** — an in-memory `Map` (survives in-session navigation) plus a `localStorage` layer with a short TTL (survives a reload) — every data hook reads this synchronously for *initial* state so a repeat visit paints instantly instead of flashing a skeleton, while the live listener still reconciles over it. Cache read/write failures degrade silently to memory-only.
5. **Denormalize onto the parent doc specifically to save a read on the security-rule hot path** — e.g. mirroring membership onto a lobby document so the security rule checking access doesn't need a second `get()` per read (this was found to have silently doubled read cost before being fixed).
6. **Denormalize toggle state (likes) via `arrayUnion`/`arrayRemove`** instead of a subcollection — avoids a read-then-write race entirely, since no read is needed to toggle.
7. **`.select()` projection** on server reads — cuts payload/latency, and doubles as a privacy mechanism (keeps fields the function has no business touching out of memory).
8. **Batch-size chunking around Firestore's per-batch rule-call ceiling** — a concrete number worth knowing: cascading deletes were chunked to 15 members at a time because a security rule doing an in-batch `get()` per delete hits Firestore's 20-rule-call-per-batch limit above that.
9. **`writeBatch` for multi-doc atomic invariants** (e.g. creating a lobby writes the lobby doc + member doc + system chat message atomically), paired with `existsAfter()`/`getAfter()` in security rules — not `exists()`/`get()` — so a rule can see the rest of its *own batch's* pending writes rather than only pre-batch state. Directly relevant to footydraft's lobby-join/lobby-create flow.
10. **Immutable, timestamped asset paths** so a cached URL is always safe to mark `immutable` — either current or an orphan nobody links to, never stale.
11. **Compositor-only CSS animation** (no per-frame JS/RAF) for any continuous ambient effect, so it costs the compositor thread, not the main thread that real-time updates need.

### 2.8 Lessons learned worth carrying over as standing rules
- **Don't trust a green test suite for anything touching a live Firestore listener.** jsdom's mocked Firestore doesn't reproduce real `fromCache`/timing behavior; multiple loading-state and race-condition bugs there passed the full automated suite while being functionally inert in a real browser. Verify listener-dependent behavior against a real backend, not just tests.
- **A coalescing scheme that silently degrades to "no coalescing" under an unlucky concurrency model isn't safe to ship.** The debounce-alone design looked sufficient until the emulator's strictly-sequential trigger execution proved it collapsed nothing — hence the independent early-stand-down layer in 2.4.
- **Prefer failure modes that are visibly broken over ones that quietly do nothing.** Two separate bugs there shipped and stayed "green" for days while silently doing nothing, because the defect was in *when* state updated, not *whether* it eventually did.
- **At this kind of scale, cost is rarely the real risk — correctness and responsiveness under concurrent action are.** Firebase's Blaze-tier cost projection stayed negligible even under the worst pre-fix read storm; the actual engineering effort went into the lost-update race and unbounded-query cost, not the bill.

---

## 3. Where the two meet — mapped onto footydraft's actual mechanics

| `PROJECT.md` mechanic | Pattern to apply |
|---|---|
| Auction current-highest-bid + hard global "runs its course" stop (R3-Q10) | Server-authoritative recompute-guard (§2.4) — never let clients resolve who's winning or whether the auction has ended |
| Lobby host-transfer-on-disconnect (R6-Q6), 45s disconnect-to-bot (R3-Q6/R4-Q3) | RTDB presence + `onDisconnect()`, no heartbeat (§2.3) |
| Per-turn/bid timers, default ~15s (R1-Q6/R6-Q5); DoND stick/take timeout defaults | New design, built on §2.4's shape: a written deadline timestamp + scheduled function that force-resolves — nothing in kupatakipucl to copy directly, see §2.5 |
| Persistent, always-on lobby chat (R4-Q7) | Bounded live window + pagination, one shared module (§2.7.3) |
| Squad-share export, side-by-side comparison (R2-Q9, R6-Q9) | Low-contention, one-shot reads — no special concurrency pattern needed, this is the "simple" side of the app |
| Draft-phase / format-scope-constraint confirmation flow | Timeline/stepper component (§1.4) |
| Countdown for bid/turn timers | Countdown-timer component styling (§1.4) — reuse the visual, not the "hardcoded deadline, display-only" logic behind it (§2.5 gap) |
| Overall look — dark canvas, one accent, pill buttons/nav, card styling | Lift directly from §1.2–§1.4, with footydraft's own accent color, not the literal PL palette |

## 4. Open items this doc doesn't resolve

~~footydraft's own accent color~~ **Resolved 2026-08-15.** The palette came from a
different source than expected: the dark theme of the "27 Ledger" valuation artifact
built earlier in this project. Near-black green ground `#101613`, surface `#182019`,
off-white ink `#ecefe8`, sage muted `#93a599`, and **gold `#d9a54a`** as the single
saturated accent and primary CTA fill — no relation to the PL purple/green, as required
above. Mint `#6cc397` is held back for "secured" states only. Typography did carry over
from irishtable as-is: Oswald for chrome and numbers, Inter for body. Full token table
and standing rules now live in `PROJECT.md` → Frontend.

Still open:

- Whether to enable Firestore offline persistence this time — kupatakipucl didn't, but a bidder's in-flight action not surviving a reload is a worse failure mode in a live auction than it was there.
- The turn-timer force-resolve mechanism has no prior implementation to lean on; needs its own design pass once backend work starts.
- §1.4's countdown timer and stepper components are described here but not built. Of that
  section, the marquee (the crest-strip idea, applied to players) and the background grid
  (64px cells, 1px lines, 8% — copied at irishtable's exact metrics) both exist now.
