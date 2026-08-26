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

Open after Round 3, being explored in Round 4 (shifting toward UX/build-shape now that core logic is mostly settled):
- Should a retroactive recalculation (from editing a Flex/Wishlist/Base item mid-month) be flagged visibly, or applied silently?
- Does editing Base Income/Base Spend trigger the same retroactive recalculation of the current month as Flex/Wishlist edits do?
- How much detail does Base item history need — old value + date, or also a reason/note?
- Daily reminder notification to log the balance number, given missed days silently count as zero?
- Should GurgoBudget be an installable/offline-capable app (PWA), given heavy mobile use?
- During a Wishlist ↔ Flex Spend conversion, does the name/amount carry over as-is or become editable?
- Anything specific wanted from the (delegated) month-over-month view, or fully open to design judgment?
- Any desire for a "running low" warning/alert before month-end, beyond the ahead/behind number?
- Desired visual mood (calm/minimal vs. playful vs. other) and any reference apps/products.
- Any existing name/logo direction for GurgoBudget, or fully open for the design phase?

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

## Status

- Round: 4 of 20 (in progress)
- Last updated: 2026-08-26
