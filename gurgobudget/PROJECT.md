# GurgoBudget — Project Notes

Live document. Updated after every questionnaire round.

## Concept

A personal budget website that plans monthly transactions and tells you how much you can safely spend per day.

## Transaction Categories

1. **Base Income** — created once, recurs and persists across months (e.g. Salary)
2. **Flex Income** — created and discarded at the end of the month (e.g. Side gig payment)
3. **Base Spend** — created once, recurs and persists across months (e.g. Rent)
4. **Flex Spend** — created and discarded at the end of the month (e.g. Car wash fee)
5. **Wishlist** — created and discarded at the end of the month; behaves slightly differently from Flex Spend (e.g. New guitar)

## Core Formula

```
Surplus = Base Income + Flex Income - Base Spend - Flex Spend
```

Surplus = the total amount left over that's free to spend on other things.

## Daily Allowance Variants

| Name | Formula |
|---|---|
| Max Allowance | Surplus / days in month |
| Daily Allowance | (Surplus / days in month) − Buffer |
| Strict Allowance *(renamed from "Relaxed")* | (Surplus − Wishlist) / days in month |
| Minimum Allowance | ((Surplus − Wishlist) / days in month) − Buffer |

Daily Allowance is the primary/headline number. All four are shown, with Daily given roughly 37% visual weight and the other three ~21% each (per user's own proportions).

## Open Questions

Tracked and resolved via the `questionnaires/` folder — one questionnaire per round, 10 questions each, answered by the user, then folded back into this document.

**Round 6 is the final questionnaire.** After it, the project moves to a separate design phase (font/palette selection, then per-page design exhibitions) that the user will drive — not part of this Q&A process.

Open after Round 5, being closed out in Round 6:
- Does buying a Wishlist item shrink the Wishlist total used in the Strict/Minimum Allowance formula, or does that total stay fixed regardless of purchases? (Correctness-critical — risk of double-counting the same money otherwise.)
- Is "money saved up this month" (mentioned re: Wishlist purchases) the same number as the ahead/behind total, or a separate figure?
- Can a mistakenly-bought Wishlist item be un-marked, or only deleted and re-added?
- Should editing data that affects a closed/past month show any warning, or apply instantly with no friction?
- Can Base Income/Base Spend items be deleted outright, and do past months keep showing a deleted item as it was?
- What should the planned graphs/stats pages actually contain?
- Any desire to export raw data out of the app?
- Can more than one thing happen to a single day's log, or is it always exactly one number?
- How should a negative Surplus/negative daily allowance be handled or displayed?
- Catch-all: anything not yet covered in five rounds.

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
- The ahead/behind indicator should be "versatile" rather than pinned to one allowance number — Claude's call on the exact mechanism (leaning toward tracking against all four simultaneously, or a user-selectable target).
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
- The user wants **full agency**: editing a Base item (or a logged day) can reach back and alter a closed/past month's numbers. Nothing is permanently frozen. (This resolves cleanly with the amount-history/versioning model — any month, open or closed, is calculated dynamically from whatever historical values apply to it.)
- Base Income/Base Spend items: just name + amount, no due date or extra fields.
- Flex Income/Flex Spend/Wishlist items: just name + amount, no extra fields.
- Wants a full day-by-day log view available — nothing permanently hidden, everything reachable somewhere.
- Design philosophy stated directly: important/primary numbers stay easily accessible on the main screens, while deeper pages exist for graphs, stats, and other detail.
- All item amounts (not just Wishlist) can start as rough estimates and be edited freely later.
- Buying a Wishlist item: it gets crossed out (not deleted) and its amount is deducted from "money saved up this month" — exact relationship to the ahead/behind figure being confirmed in round 6.

## Status

- Round: 6 of 20 (final questionnaire)
- Last updated: 2026-08-26
