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

Aesthetics/mood/branding are intentionally on hold for now (user's call) — later rounds will return to that. Round 5 stays on structure/architecture:
- What are the app's main screens/sections (Today, Setup/Items, History, etc.)?
- Does a month close automatically at the calendar flip, or via a manual action?
- Are closed/past months frozen permanently, or can later Base item edits ever reach back into them?
- Can a logged day be corrected only within the current month, or in past closed months too?
- Do Base Income/Base Spend items need more than name + monthly amount (e.g. a due date)?
- Do Flex Income/Flex Spend/Wishlist items need more than name + amount?
- Is a day-by-day log list wanted, or is the aggregate ahead/behind number enough?
- Should ahead/behind be a single number, or a simple day-by-day trend?
- Can a Wishlist item be added with an estimated/unknown price, or always an exact amount?
- Is "buying" a Wishlist item a distinct status change, or just deleting it and logging the spend?

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

## Status

- Round: 5 of 20 (in progress)
- Last updated: 2026-08-26
