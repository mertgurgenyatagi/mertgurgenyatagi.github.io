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

Open after Round 2, being explored in Round 3:
- Exact content of the daily log: raw bank balance change, or discretionary-only? (Round 2's answer was ambiguous — re-asking with a concrete example.)
- Can Flex Income/Flex Spend/Wishlist items be added or edited after the first few days of the month, or are they locked in once set?
- Exact formula for the "ahead/behind for the month" indicator.
- What happens on a day the user forgets to log a balance number — gap, zero, or counted as exactly the allowance?
- Can a previously logged day be corrected after the fact?
- When a Wishlist item is actually bought, does it count against the daily discretionary number like a normal purchase, or is it tracked separately?
- Since the repo/site is public, should sign-in be restricted to the user's own Google account specifically?
- Currency for displayed amounts.
- Primarily a phone-use app (logged daily on the go) or fine as desktop/browser-first?
- Any month-over-month/historical view, or strictly current-month-only?

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

## Status

- Round: 3 of 20 (in progress)
- Last updated: 2026-08-26
