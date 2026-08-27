# GurgoBudget — Handover

Personal budget tracker. Plans monthly income/spend, tells the user a safe
daily allowance, logs actual spend one raw balance-delta per day. Single
hardcoded user, Firebase + Google Sign-In, TRY, mobile-first. Nothing is
built yet — this repo has spec and design artifacts only, no app code.

This doc is for picking up the build cold. `PROJECT.md` is the authoritative
spec and decision log; this file is the narrower "what to build right now"
brief. If the two ever disagree, `PROJECT.md` wins — update this file to
match, not the other way around.

---

## 1. Where things stand

- **Spec**: settled, 6 Q&A rounds + follow-up. See `PROJECT.md` top to
  bottom — formulas, data model, retroactive recalculation, Wishlist/Money
  Saved, platform/auth.
- **Visual identity**: settled. **Yosun** — sage paper, moss/olive accent,
  dark hero band over a rounded-top light sheet. **Inter** everywhere
  (explicit standing override of the usual anti-Inter default). Picked from
  36 hand-built specimens in `exhibition.html` via the bracket in
  `tournament.html`.
- **Dashboard questionnaires**: 3 rounds, then closed early — remaining
  structural questions were better answered by building than asking. See
  `dashboard-questionnaires/questionnaire-0{1,2,3}.md` for the raw record,
  `PROJECT.md`'s "Dashboard Build — Round Notes" for what got folded in.
- **Dashboard Exhibuild**: 20 hand-built Today-screen structures in
  `dashboard-exhibition.html`. No single winner — see below.
- **Nothing coded yet.** No framework, no Firebase project, no repo
  scaffolding for the actual app. This handover is the bridge from "design
  decided" to "first line of app code."

---

## 2. What to build: the Today screen

This is the only screen in scope right now. Per `PROJECT.md`, "the
dashboard" = Today alone; Items, Wishlist, Log, History, and Stats are
separate pages, each built and (eventually) Exhibuild'd on its own, joined
in a later integration run. Don't design cross-page nav yet.

The build is a **hybrid** of two Exhibuild specimens plus one new piece —
picked component-by-component, not a single winning screen:

### From `dashboard-exhibition.html`, specimen 06 (Sürgü)
- The **six-way segmented control**: all six projection sources in one
  bar — Max, Daily, Strict, Minimum, Avg this month, Avg 90 days — tap any
  cell directly to project the rest of the month at that rate. This
  resolves the toggle-vs-list fork from `PROJECT.md`'s Ahead/Behind
  Indicator section in favor of "all visible, direct tap."
- The **three threshold bars**: one row each for solvent / buffer /
  wishlist-covered, each a label + filled progress track + a "needs X /
  have Y" caption pair.

### From specimen 15 (Tırtıl)
- The **whole top block**: brand/date header, the day-track strip (one
  cell per day of the month, showing logged / missing / today / future),
  the log-gap button folded directly into that strip, and the daily-
  allowance hero line underneath it.

### New — not in either specimen
- A **spend grid**: every day of the month as a box in a grid, all at
  once — past, current, and future together. Shows actual amount per
  logged day. Distinct from the day-track strip above, which only encodes
  status (logged/missing/today), not the number. Reference sketch: a plain
  grid of day-boxes, no other structure implied — build it in the Yosun
  system, not copied from anywhere.

**Layout order isn't decided** — the four pieces above need arranging on
one 390×844 screen. That's implementation judgment, not an open question to
re-ask.

### Copy rule — permanent, all screens from here on
**No sentences. Ever.** Labels and bare words only. If a phrase can lose a
word and still be understood, lose it. This applies retroactively to how
you word anything new, but the 20 existing Exhibuild specimens were built
before this rule and haven't been rewritten — don't assume their copy is a
model to match.

---

## 3. Reference material, in priority order

1. **`PROJECT.md`** — the spec. Formulas, data model, every settled
   decision, the Exhibuild outcome, the copy rule.
2. **`dashboard-exhibition.html`** — the 20 specimens. Look at 06 and 15
   specifically for the components above; the other 18 are discarded but
   still useful for seeing what didn't work.
3. **`exhibition.html`** — the 36 identity specimens, for Yosun's exact
   tokens (colors, radii, spacing) as originally drawn.
4. **`dashboard-questionnaires/`** — raw Q&A record, only useful if
   `PROJECT.md`'s summary of a round is unclear.

---

## 4. What's genuinely still open

- **New-month rollover**: blank Today screen vs. a one-time recap of last
  month, the first time the app opens in a new month. Round 1's answer
  ("yeah sure") was ambiguous and never resolved — ask before building it,
  don't guess.
- **Layout arrangement** of the four Today-screen pieces (see above) —
  this is a build decision, not a question.
- **Everything past Today** — Items, Wishlist, Log, History, Stats have no
  structural decisions at all yet. Each gets its own Exhibuild if/when a
  structural question comes up worth seeing rather than describing.
- **No backend work has started.** Firebase project, Firestore schema,
  security rules restricting to the single hardcoded account, Google
  Sign-In wiring — none of it exists yet.

---

## 5. Standing process rules (apply beyond this handover)

- **Exhibuild**: when a structural/visual question is worth seeing rather
  than describing, hand-build multiple full specimens (no templating, no
  generated variants) in one gallery page, one page per Exhibuild. Full
  rules in `PROJECT.md` under "The Exhibuild."
- **Git**: don't commit or push without being told, except where the user
  gives blanket approval for a specific piece of work.
- **Don't overthink settled philosophy**: if a question's answer is
  already implied by an established principle (no confirmation dialogs, no
  extra fields, items are just name+amount), don't ask it — apply the
  principle.
