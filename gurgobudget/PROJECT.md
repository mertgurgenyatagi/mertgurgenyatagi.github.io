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
| Relaxed Allowance | (Surplus − Wishlist) / days in month |
| Minimum Allowance | ((Surplus − Wishlist) / days in month) − Buffer |

## Open Questions

Tracked and resolved via the `questionnaires/` folder — one questionnaire per round, 10 questions each, answered by the user, then folded back into this document.

Open after Round 1, being explored in Round 2:
- Should Base Income/Base Spend history be visible in the UI, or just stored quietly?
- Confirm the Flex Spend vs. Wishlist philosophy (mandatory-but-unplanned vs. fully optional).
- New name needed for "Relaxed Allowance" (the current name is misleading — it's the more cautious number, not the looser one).
- Does the Buffer amount ever change between months, or is it one number forever?
- Should Max/Minimum (and the renamed third variant) be shown as secondary numbers, or tucked away?
- What should the app actually do with the logged daily balance number, beyond storing it?
- Is the logged daily balance the raw bank delta, or discretionary spend only?
- Backend/hosting approach for cross-device sync, single-user (Firebase/Supabase/other?).
- Should new months start blank, or pre-fill Flex/Wishlist items from last month as quick-picks?
- Expected volume of items per month (a handful vs. 10+) — affects list vs. table layout.

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

## Status

- Round: 2 of 20 (in progress)
- Last updated: 2026-08-26
