# GurgoBudget — Project Notes

Live document. The Q&A phase (6 rounds) is complete; this now reflects the settled spec. Design phase (fonts/palette, per-page exhibitions) is next and is driven separately by the user.

## Concept

A personal budget website that plans monthly transactions and tells you how much you can safely spend per day.

## Transaction Categories

1. **Base Income** — created once, persists unchanged across months until manually edited (e.g. Salary)
2. **Flex Income** — created and discarded at the end of the month (e.g. Side gig payment)
3. **Base Spend** — created once, persists unchanged across months until manually edited (e.g. Rent)
4. **Flex Spend** — created and discarded at the end of the month; necessary-but-unplanned spending, set during the first few days of the month (e.g. Car wash fee)
5. **Wishlist** — created and discarded at the end of the month; fully optional spending (e.g. New guitar). Functions as a semi-separate module — see [Wishlist & "Money Saved"](#wishlist--money-saved-needs-more-detail) below.

All items (Base and Flex/Wishlist alike) are just a **name + amount** — no due dates, categories, or notes. Amounts can be entered as rough estimates and freely edited later.

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

## Additional Stats (added Round 6)

Alongside the four allowances, also show:
- **Average daily spend, current month** — average of the raw daily logs so far this month.
- **Average daily spend, trailing 90 days** — rolling average across the last 90 days of raw daily logs (spans month boundaries).

## The Daily Log

- Once a day, the user logs a single number: the **raw, whole change in their bank balance** for that day. No mental subtraction of rent, bills, or anything else — whatever the bank shows is what gets typed in.
- A day with no entry counts as **zero spent**.
- Logged days can be corrected later, including days in past/closed months, with no confirmation warning.
- A day can have both a raw balance log **and** an independent Wishlist-purchase action (see below) — they don't conflict; each day is not restricted to "exactly one number."

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

## Screens & Design Philosophy

- Screen/section structure is delegated to Claude's judgment (a "Today" view, a Setup/Items view, and a History view are the working assumption).
- Stated design philosophy: **important/primary numbers stay easily accessible on the main screens; deeper pages exist for graphs, stats, and other detail** — nothing is permanently hidden, everything is reachable somewhere. A full day-by-day log view should exist.
- Graphs/stats page contents are delegated to Claude.
- A month closes automatically the instant the calendar flips — no manual "close month" action.
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

## Status

- Q&A phase: **complete** (6 rounds + chat follow-up). Spec is fully settled — no outstanding open questions.
- Next phase: visual design (fonts/palette, then per-page exhibitions) — driven by the user, outside this Q&A process.
- Last updated: 2026-08-26
