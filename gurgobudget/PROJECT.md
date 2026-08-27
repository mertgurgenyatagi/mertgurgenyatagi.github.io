# GurgoBudget — Project Notes

Live document. The Q&A phase (6 rounds) is complete; this now reflects the settled spec. The visual design direction is also chosen — see [Visual Design](#visual-design) — and the next phase is building the real dashboard.

## Concept

A personal budget website that plans monthly transactions and tells you how much you can safely spend per day.

## Transaction Categories

1. **Base Income** — created once, persists unchanged across months until manually edited (e.g. Salary)
2. **Flex Income** — created and discarded at the end of the month (e.g. Side gig payment)
3. **Base Spend** — created once, persists unchanged across months until manually edited (e.g. Rent)
4. **Flex Spend** — created and discarded at the end of the month; necessary-but-unplanned spending, set during the first few days of the month (e.g. Car wash fee)
5. **Wishlist** — created and discarded at the end of the month; fully optional spending (e.g. New guitar). Functions as a semi-separate module — see [Wishlist & "Money Saved"](#wishlist--money-saved-needs-more-detail) below.

All items (Base and Flex/Wishlist alike) are just a **name + amount** — no due dates, categories, or notes. Amounts can be entered as rough estimates and freely edited later.

**Currency formatting:** every TRY figure displays as **whole lira** — no kuruş, no decimals, anywhere in the app (added Dashboard Round 3).

## Core Formula

```
Surplus = Base Income + Flex Income - Base Spend - Flex Spend
```

Surplus is the total left over that's free to spend on other things. A negative Surplus (and therefore negative allowances) is allowed and shown as-is — no special warning/treatment.

## Daily Allowance Variants

| Name | Formula |
|---|---|
| Max Allowance | Surplus / days in month |
| Daily Allowance *(primary/headline number)* | (Surplus / days in month) − Buffer |
| Strict Allowance *(renamed from "Relaxed")* | (Surplus − Wishlist) / days in month |
| Minimum Allowance | ((Surplus − Wishlist) / days in month) − Buffer |

All four are shown together; Daily gets the most visual weight (~37%), the other three ~21% each (user's own proportions). The Buffer is a single fixed amount, set once, permanent.

The Wishlist figure used here is the sum of whatever is **currently in the Wishlist list** — it only changes when items are added, deleted, or moved to/from Flex Spend. Marking a Wishlist item "purchased" (see below) does **not** change this total.

## Ahead/Behind Indicator (added Dashboard Round 1)

- There are **six candidate figures** for "how much should I be spending" going forward: the four allowances (Max, Daily, Strict, Minimum) plus the two averages (this-month average, trailing-90-day average). The user selects which one drives the projection for the remaining days of the month.
- **Decided (Dashboard Exhibuild, 2026-08-27):** all six values sit visible at once, tapped directly to select — resolved in favor of option (b) from the original fork. Rendered as a **segmented control** (06 Sürgü's component, not a stacked list) — six cells in one bar, tap any cell to project at that rate.
- Ahead/behind should surface **three always-visible states**, stacked rather than toggled: a **bankruptcy** threshold, a **buffer** threshold, and an **"affords the full current Wishlist"** threshold. **Decided:** rendered as 06 Sürgü's progress-track bars — a label, a filled track, and a paired "needs X / have Y" caption, one per threshold.
- This six-way selector is **independent** from Money Saved's own "single global toggle" for its remaining-days projection (added Dashboard Round 2) — two separate settings, not one dial driving both.
- The six-way selection **resets to Daily Allowance** (the default) at the start of every new month — it does not carry over from the prior month (added Dashboard Round 2).

## Additional Stats (added Round 6)

Alongside the four allowances, also show:
- **Average daily spend, current month** — average of the raw daily logs so far this month.
- **Average daily spend, trailing 90 days** — rolling average across the last 90 days of raw daily logs (spans month boundaries).

## The Daily Log

- Once a day, the user logs a single number: the **raw, whole change in their bank balance** for that day. No mental subtraction of rent, bills, or anything else — whatever the bank shows is what gets typed in.
- A day with no entry counts as **zero spent**.
- Logged days can be corrected later, including days in past/closed months, with no confirmation warning.
- A day can have both a raw balance log **and** an independent Wishlist-purchase action (see below) — they don't conflict; each day is not restricted to "exactly one number."
- **Logging is the app's single most frequent action and must be near-frictionless.** The primary entry point is a tap that jumps straight to the earliest unlogged day — no date picking, no navigating a calendar to find where you left off.
- The user will **never** log the current day in real time (e.g. late-night orders land after the day is functionally "closed" for them) — logging is inherently retrospective, catching up on past unlogged days. No same-day "log today" fast path is needed; the earliest-unlogged-day flow above is the actual fast path.
- After submitting one day's entry, the flow returns to the main/Today screen — it does **not** auto-advance straight into the next unlogged day (added Dashboard Round 2). Catching up on a backlog is a repeated tap-log-return, not one continuous streak.

## Retroactive Recalculation & Data Model

- Base Income/Base Spend keep a quiet, unsurfaced history of amount changes (old value + date only, no reason/note).
- Editing a Base item's amount, or a Flex/Wishlist item, is treated as if the new value had been true since 00:00 on day 1 of whatever month it applies to — it retroactively recalculates that month's figures. This applies even to closed/past months (the user has full agency, no locking, no warning prompts).
- **Deletion is scoped differently from editing**: a Base Income/Base Spend item can be deleted outright, but only going forward — current and future months stop including it, while past months keep showing it exactly as it was. (Practically: the app should model this as historical values-over-time, not just current-value-plus-audit-log, so any month — past, present, or future — is computed from whatever was true during that specific month.)
- Practical implication: since Firestore has no "months are closed" concept enforced by the data model, the UI distinction between "current month" and "history" is a display concept only, not a data-locking one.

## Wishlist & "Money Saved"

A distinct sub-system, deliberately semi-separate from the core allowance math ("a playground, not in terms of feel, but in terms of function"):

- The **only** way the Wishlist list itself changes is items being added, deleted, or moved to/from Flex Spend.
- Separately, there's a **"Money Saved"** figure: `Surplus − (sum of actual daily logs so far) − (projected spend for remaining days of the month)`. The projection is a **single global toggle** applying the same assumption to every remaining day of the month at once (not per-day). Money Saved resets to a zero basis each month — computed purely from that month's own Surplus, no carry-over from prior months.
- **Money Saved lives within the Wishlist page** — not a separate screen.
- Within that view, the user can mark a Wishlist item as **purchased**. This consumes some of the projected Money Saved, but does **not** touch the Wishlist total used in the Strict/Minimum Allowance formula, and does not touch the daily log.
- A purchased item **stays visible in the Wishlist list**, shown crossed out — it isn't moved to a separate list.
- Marking a Wishlist item purchased is **reversible** — it can be un-marked/uncrossed if done by mistake.
- Marking purchased simply deducts the item's **existing stored amount** from Money Saved — no separate "confirm/adjust actual amount paid" step. If the estimate was off, edit the item's amount the normal way, same as any other item (added Dashboard Round 2).

## Screens & Design Philosophy

- **"The dashboard" means the Today screen alone** (clarified Dashboard Round 3). Item lists and Wishlist↔Flex Spend conversion, the Graphs/Stats page, and History each live on their **own separate page**. Pages are designed and built **independently**, then joined in a later **integration run** — cross-page navigation and interaction are deliberately not specified while a single page is being designed.
- Screen/section structure is delegated to Claude's judgment (a "Today" view, a Setup/Items view, and a History view are the working assumption).
- Stated design philosophy: **important/primary numbers stay easily accessible on the main screens; deeper pages exist for graphs, stats, and other detail** — nothing is permanently hidden, everything is reachable somewhere. A full day-by-day log view should exist.
- **The dashboard should not feel busy** — a deliberately low-density, uncluttered read on the main screens (added Dashboard Round 1, sharpens the philosophy above).
- **Copy is minimal, permanently, on every screen from here on** (set 2026-08-27, applies to all future design work, not just Today): labels and bare words only. **No sentences, ever.** Strip everything down — if a phrase can lose a word and still be understood, lose it.
- Editing a Base or Flex item (e.g. bumping rent): tapping the value opens a small separate editor for that item, rather than editing inline in place (added Dashboard Round 1).
- The Setup/Items screen's five lists (Base Income, Flex Income, Base Spend, Flex Spend, Wishlist) live across **separate tabs/pages**, not stacked on one scrolling screen (added Dashboard Round 2).
- Graphs/stats page contents are delegated to Claude.
- A month closes automatically the instant the calendar flips — no manual "close month" action.
- Offline behavior: if the app can't reach Firestore, a plain "can't reach the server" message is sufficient — no requirement to fall back to cached/last-known numbers (added Dashboard Round 1).
- Aesthetics/mood/branding are intentionally deferred by the user to a later, separate design phase (fonts/palette, then per-page design exhibitions) — not part of this document's scope.

## Platform & Auth

- **Firebase** backend with **Google Sign-In**, restricted to a single hardcoded account: `thisisfootballstuff@gmail.com` (the repo/site is public, so this must be enforced both client-side and via Firestore security rules).
- Cross-device sync required; single user only, no multi-user support needed.
- Plain browser use is fine — no installable/offline PWA requirement, no daily reminder notifications.
- Currency: **TRY** (Turkish Lira).
- Heavy **mobile-first** usage — this is the dominant device context.
- Data export (e.g. to spreadsheet) is a soft "nice to have," not a requirement.

## Decisions Log

**Round 1:**
- Base Income/Base Spend amounts don't shrink automatically — "subside" was a wording slip. They persist unchanged until manually edited.
- When a Base Income/Base Spend amount is edited (e.g. rent increases), the app should remember the old value rather than silently overwrite it.
- Flex Spend is philosophically "mandatory" spending (vs. Wishlist, which is optional) — exact mechanics still being worked out.
- The Buffer is a single fixed amount (not variable day-to-day within a month).
- **Daily Allowance is the primary number** shown to the user.
- Allowance numbers are fixed for the whole month — actual daily spending does **not** recalculate tomorrow's number.
- Actual spending is tracked as a single daily bank-balance-delta log (not itemized purchases), compared against the plan.
- Single-user app, no multi-user/auth-for-others requirement — but must sync across the user's own devices.
- Month resets on the 1st of the calendar month.
- Needs real cross-device persistence — plain browser-only storage (no server) is not sufficient.

**Round 2:**
- Base Income/Base Spend history is stored quietly — not surfaced in the UI.
- Confirmed: Flex Spend = necessary-but-unplanned spending, Wishlist = fully optional. New wrinkle: Flex Spend is set during the first few days of the month, so in practice it's known before the month's allowances are calculated (not a mid-month surprise).
- "Relaxed Allowance" renamed to **Strict Allowance**.
- The Buffer is fixed permanently (not just per-month).
- All four allowance numbers are shown at once; Daily gets the most visual weight (~37%), the other three ~21% each.
- The daily log should feed an active "ahead/behind for the month" indicator, not just sit as a passive record.
- Backend: **Firebase, with Google Sign-In** for auth (single user, cross-device sync).
- New months start with a blank slate — no carry-over/quick-pick of last month's Flex/Wishlist items.
- Expect no more than ~7 items in any given list (Base Income/Spend, Flex/Wishlist) — a simple list UI is sufficient, no need for a table.

**Round 3:**
- The daily log is the **raw whole bank balance change** for the day — no mental subtraction of Base/Flex categories before typing it in.
- Flex Income, Flex Spend, and Wishlist items can be added or edited at any point in the month, but any edit is treated as if it had been true since 00:00 on day 1 — it retroactively recalculates the month's allowance figures.
- New feature: a Wishlist item can be **converted** to a Flex Spend item, and vice versa.
- The ahead/behind indicator should be "versatile" rather than pinned to one allowance number.
- A day with no logged entry counts as **zero spent**.
- Previously logged days can be corrected later.
- Auth is restricted to a single hardcoded Google account: `thisisfootballstuff@gmail.com`.
- Currency: **TRY** (Turkish Lira).
- Heavy **mobile-first** usage — this is the dominant device.
- Month-over-month/historical view: delegated to Claude's design judgment.

**Round 4:**
- Retroactive recalculations apply silently — no visible "recalculated because..." flag needed.
- Editing a Base Income/Base Spend amount retroactively recalculates the rest of the current month, same as Flex/Wishlist edits.
- Base item amount history needs no reason/note — just the old value and the date it changed.
- No daily reminder notification wanted.
- Plain browser use is fine — no installable/offline PWA requirement.
- Wishlist ↔ Flex Spend conversion carries the name and amount over as-is, no edit step.
- No "running low" warning wanted beyond the ahead/behind number.
- Month-over-month comparison specifics, visual mood, and name/logo are all deliberately deferred — user wants to sidestep aesthetics/feel for now and will return to it later.

**Round 5:**
- App section/screen structure is delegated to Claude's design judgment.
- A month closes automatically the instant the calendar flips — no manual action.
- The user wants **full agency**: editing a Base item (or a logged day) can reach back and alter a closed/past month's numbers. Nothing is permanently frozen.
- Base Income/Base Spend items: just name + amount, no due date or extra fields.
- Flex Income/Flex Spend/Wishlist items: just name + amount, no extra fields.
- Wants a full day-by-day log view available — nothing permanently hidden, everything reachable somewhere.
- Design philosophy stated directly: important/primary numbers stay easily accessible on the main screens, while deeper pages exist for graphs, stats, and other detail.
- All item amounts (not just Wishlist) can start as rough estimates and be edited freely later.
- Buying a Wishlist item: it gets crossed out (not deleted) and its amount is deducted from "money saved up this month."

**Round 6 (final):**
- Clarified: Wishlist and "Money Saved" are a semi-separate sub-system. The Wishlist total used in the Strict/Minimum Allowance formulas only changes via add/delete/convert-to-Flex-Spend — **not** via marking an item purchased.
- "Money Saved" = Surplus − actual logs so far − projected spend for remaining days (projections adjustable via toggles, mechanism TBD — see Open Questions).
- Marking a Wishlist item "purchased" happens within the Money Saved view/flow and is **reversible** (can be un-marked if done by mistake).
- Retroactive edits into closed/past months apply instantly, no warning prompt.
- Base Income/Base Spend items can be deleted, but only for current/future months — past months keep showing the deleted item as it was.
- Graphs/stats page contents: delegated to Claude.
- Data export: a soft nice-to-have, not required.
- A day can have both a raw balance log entry and a separate Wishlist-purchase action — not mutually exclusive.
- Negative Surplus/negative allowances are fine as-is, no special handling.
- New stats to add: **average daily spend this month**, and **average daily spend over the trailing 90 days**.

**Round 6 follow-up (chat, resolved the last 4 open questions):**
- The remaining-days spending projection is one **global toggle**, not per-day.
- Money Saved is a section within the **Wishlist page**, not a separate screen.
- A purchased Wishlist item **stays visible in the Wishlist list**, shown crossed out.
- Money Saved resets to a **zero basis each month** — no carry-over from prior months.

## Visual Design

- An exhibition of hand-built dashboard variants was drawn at `gurgobudget/exhibition.html` — 36 distinct type/palette/structure directions, each a real phone-viewport (390×844) rendering of the same sample data, built individually rather than templated.
- A single-elimination bracket tool at `gurgobudget/tournament.html` was used to pick a winner from the 36 by direct head-to-head comparison.
- **Winner: Yosun** — sage paper with a deep moss/olive accent, a dark hero band (today's daily allowance) over a rounded-top light "sheet" panel holding the month ledger and wishlist. This is the direction going forward.
- **Typeface override:** Hallmark's font catalog defaults to banning Inter as a generic AI-default face, but the user explicitly asked for it across all 36 specimens regardless — it reads as more legible to them. All specimens (including Yosun) now render in Inter. This preference should carry into the real build.

## Dashboard Build — Round Notes

A second, shorter Q&A pass (5 questions/round, ~7 rounds anticipated) covering the real dashboard build — screens, interactions, and edge cases the original spec left to Claude's judgment. Raw round-by-round record lives in `gurgobudget/dashboard-questionnaires/`; settled answers are folded into the relevant sections above as they land.

**Round 1 — Screens, edits, and blank slates:**
- Empty Today screen (no items set up yet): not important, can be rough/unstyled — no dedicated design effort warranted.
- Editing a Base/Flex item opens a small separate editor on tap (folded into [Screens & Design Philosophy](#screens--design-philosophy)).
- Ahead/behind indicator and remaining-days projection fully specified — see new [Ahead/Behind Indicator](#aheadbehind-indicator-added-dashboard-round-1) section.
- New-month rollover: answer ("yeah sure") was ambiguous between "drop straight into blank Today" and "show a one-time recap first" — needs a follow-up confirmation, not yet folded into spec.
- Offline behavior: plain error is fine, no cached fallback (folded into [Screens & Design Philosophy](#screens--design-philosophy)).
- Primary daily action is logging spend, which must jump straight to the earliest unlogged day; the user never logs same-day (folded into [The Daily Log](#the-daily-log)).

**Round 2 — One dial or two, and the daily grind:**
- The ahead/behind six-way selector and Money Saved's remaining-days projection toggle are independent settings, not one dial (folded into [Ahead/Behind Indicator](#aheadbehind-indicator-added-dashboard-round-1)).
- The six-way selector resets to Daily Allowance at the start of every new month (folded into [Ahead/Behind Indicator](#aheadbehind-indicator-added-dashboard-round-1)).
- Setup/Items screen's five lists live on separate tabs/pages, not one scroll (folded into [Screens & Design Philosophy](#screens--design-philosophy)).
- Marking a Wishlist item purchased just deducts its existing stored amount — no confirm/adjust-actual-paid step (folded into [Wishlist & Money Saved](#wishlist--money-saved-needs-more-detail)).
- After logging a day, the flow returns to the main screen rather than auto-advancing to the next unlogged day (folded into [The Daily Log](#the-daily-log)).

**Round 3 — Money format, motion between screens:**
- All TRY figures display as whole lira, no kuruş (folded into [Transaction Categories](#transaction-categories)).
- Two questions were rejected as out of scope — item conversion and the Graphs/Stats page "won't be on the dashboard." This established that **the dashboard = the Today screen only**, and that pages are built separately then integrated (folded into [Screens & Design Philosophy](#screens--design-philosophy)).
- Month navigation in History, and whether the two averages belong on Today: both answered "try different things in the exhib" — deliberately deferred to an Exhibuild rather than decided in Q&A. The averages question is now live across the dashboard specimens; History month-nav belongs to a later Exhibuild for that page.

## The Exhibuild

The project's standing method for settling a visual/structural question: **build the options, don't describe them.** Named by the user, 2026-08-27.

**How it runs:**
1. A questionnaire round hits a question best answered by seeing it. The answer is *"try different things in the exhib"* — the question is deliberately left open rather than guessed at.
2. Those open questions are collected into a single-page HTML exhibition of **hand-built specimens** — each with its own token block and markup, laid out in a gallery. See `exhibition.html` (36 specimens, chose the Yosun identity) and `dashboard-exhibition.html` (20 specimens, dashboard structure).
3. The user picks a winner — by eye, or via a head-to-head bracket like `tournament.html` when the field is large. **The pick doesn't have to be a single specimen** — the dashboard round was resolved as a hybrid, naming individual components from different specimens plus one component neither had.
4. The winning palette, scale and component voice carry into the real build — never a specimen's literal markup.

### Dashboard Exhibuild — outcome (2026-08-27)

No single winner. The Today screen build combines:
- **From 06 Sürgü:** the six-way segmented control (all values visible in one bar, tap any cell to project at that rate), and the three threshold bars (label, filled track, paired "needs X / have Y" caption).
- **From 15 Tırtıl:** the whole top block — day-track strip across the month (logged / missing / today / future), the log-gap button folded into that strip, and the daily-allowance hero line.
- **New, in neither specimen:** a box grid showing every day's spend for the month at once — past, current, and future together. Distinct from the day-track strip above, which only encodes logged/missing/today, not amounts.

This combination, plus the permanent minimal-copy rule below, is the actual Today-screen build target. See `gurgobudget/HANDOVER.md` for the build brief.

**Standing rules (set by the user, apply to every Exhibuild):**
- **Hand-built only.** No templating, no loops, no generating specimens from a data array. Each one is written out individually — that's the entire point; templated variants converge on the same design.
- **One page per Exhibuild.** Scope is a single screen. Cross-page flow is not designed here and not speculated about.
- **Locked constants stay locked.** Inter throughout (standing user override of the usual Inter ban); the settled Yosun palette; whatever the questionnaires have already decided. Only the genuinely open question varies.
- **Every specimen carries the full load.** Same sample data, same required elements, same viewport (390×844, clipped) — so differences between specimens are real design differences, not different content.
- **No animation, no tests, no browser verification** unless asked. These are static specimens for looking at.
- Sample data is invented but **internally consistent**, so a specimen can be read for sense as well as feel.

## Status

- Q&A phase: **complete** (6 rounds + chat follow-up). Spec is fully settled — no outstanding open questions.
- Identity Exhibuild: **complete** — Yosun chosen (sage/moss, dark-band-plus-sheet, Inter) from 36 specimens via `tournament.html`.
- Dashboard questionnaire phase: **closed after 3 rounds** (user called it: *"I think that's enough"*) — see [Dashboard Build — Round Notes](#dashboard-build--round-notes). Rounds 4–7 were never run; the remaining questions were better answered by building.
- Dashboard Exhibuild: **decided** — hybrid pick from `dashboard-exhibition.html`'s 20 specimens (06 Sürgü + 15 Tırtıl + one new component). See [Dashboard Exhibuild — outcome](#dashboard-exhibuild--outcome-2026-08-27) and `gurgobudget/HANDOVER.md`.
- Standing rule set (applies everywhere from here on): **copy is minimal, no sentences ever.**
- One open item still pending user confirmation: new-month rollover behavior (blank Today vs. one-time recap) — Round 1 Q4 was ambiguous.
- Next: **build the real Today screen** per `gurgobudget/HANDOVER.md`. After that, repeat the cycle per remaining page (Items, Wishlist, Log, History, Stats), then the integration run.
- Last updated: 2026-08-27
