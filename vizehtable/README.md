# vizehtable

A season-long Premier League prediction game, built to be pitched to the
football YouTuber **Vizeh**. Participants rank all 20 clubs for the
2026/27 table, call both domestic cups and six individual awards, and are
scored against real outcomes.

**This is a fork of `iconictable/`**, copy-and-adapt, taken 2026-08-10.
`iconictable` was itself forked from `zealandtable`, which came from
`irishtable`, which came from `kupatakipucl`. No two of those directories share
code or import from each other. Every one of them remains independently
deployable and **none may be edited to serve this fork** — the whole point is
that a channel which ignores the pitch this year can still be shown a live site
next year.

Only branding and channel-name copy differ from `iconictable/`;
`diff -r --strip-trailing-cr ../iconictable/src src` is the fastest way to audit
that, and it should return 15 lines across 10 files. The procedure that produced
this fork is `../FORKING-PLAYBOOK.md`.

**Handover — read this first:** [`VIZEHTABLE_HANDOVER.md`](VIZEHTABLE_HANDOVER.md)
— inherited from the parent and still accurate for everything except the
branding. Why everything is the way it is, what's already been tried, and where
the traps are.

Develop on **localhost** (`npm run dev`). Hosting is automated — see below.

**Will be live at https://mertgurgenyatagi.github.io/vizehtable/** — not yet
deployed at the time this line was written.

## What this is, relative to the repo it sits in

This directory is a **fully self-contained application**. It lives in the
`mertgurgenyatagi.github.io` repo alongside five siblings — `irishtable/`,
`zealandtable/`, `iconictable/`, `kupatakip/` and `eventportal/` — but shares
nothing with any of them: its own
`package.json`, `node_modules`, build config, Firebase project and deploy. No
module is imported across those boundaries in either direction. Code that came
from a sibling came by copy-and-adapt.

Run every command from inside `vizehtable/`, not the repo root.

## Scope

Only the **pre-season phase** is built: sign up, answer a five-question quiz,
submit predictions, talk in the chat and the forum. There is no leaderboard,
no live scoring, no results ingestion and no post-deadline experience — if the
pitch is declined, none of that ever needs building.

Predictions close **21 August 2026**; the season starts the 22nd.

## Commands

```bash
npm install
npm run dev          # dev server
npm test             # 420 tests, vitest
npm run build        # tsc -b && vite build
npm run crests       # re-import club crests from docs/pl-fork/assets/
firebase deploy --only firestore:rules,database --project vizehtable-app
```

Hosting is **GitHub Pages**, not Firebase Hosting — it deploys from
`.github/workflows/deploy.yml` on push to `main`. Don't `firebase deploy
--only hosting`.

The workflow publishes an **explicit allowlist** into `_site/`, not the repo.
Only `dist/` is copied, so nothing in `src/` or any `.md` here is public —
that is deliberate and load-bearing, see `VIZEHTABLE_HANDOVER.md` §22. To
publish something new, add a line to the assemble step.

## Firebase

**Own project: `vizehtable-app`.** Entirely separate from `irishtable-app`,
`zealandtable-app` and `iconictable-app` — separate Firestore, separate RTDB,
separate users. Nothing is shared, and signups here cannot reach any sibling's
data. Spark plan, billing off.

| Service | State |
|---|---|
| Firestore | **pending** — not yet created |
| Realtime Database | **pending** — not yet created |
| Google sign-in | **pending** — provider enable is a manual console step (Spark blocks it by API) |
| Storage | **not set up** — needs Blaze; photos off |

This table is updated as each piece is genuinely verified, not when it is
attempted. If a row still says pending, treat it as pending.

Never repoint `.firebaserc` at a sibling project. The two apps would share one
Firestore and one user pool.

## Setup from scratch

1. `npm install`
2. `.env.local` holds this project's real config and is gitignored, so it
   won't exist on a fresh clone. Regenerate it with:

   ```bash
   firebase apps:sdkconfig WEB --project vizehtable-app
   ```

   (These values aren't secret — Firebase web config ships in the client
   bundle by design — they're just environment-specific.)
3. `npm run dev`

## Known gaps

**Nobody has signed in yet.** `vizehtable-app` holds zero profiles, zero
survey responses and zero predictions, so an empty participant list is
expected, not a bug. Walking sign in → quiz → predict against *this* project's
backend is the highest-value hour available; see `VIZEHTABLE_HANDOVER.md` §14
item 2.

**Auth is not set up yet.** When it is, remember that *configured* is not the
same as *working*, and that it takes two steps on two different console
screens. On the parent fork the provider came back `enabled: true` while the
authorized-domain list was still the three defaults — sign-in perfect on
localhost, `auth/unauthorized-domain` for every real visitor, which would have
broken the pitch for the channel and its entire audience. See
`VIZEHTABLE_HANDOVER.md` §23.9. Verify both by API, and specifically verify
*after* someone tells you the auth is done — that is exactly when the check
gets skipped.

**Profile photos need a paid plan.** Firebase Storage requires Blaze on new
projects. The photo step is optional and its upload failure is non-fatal, so
signup works fine without it — avatars fall back to an initial. Enable billing
and set up Storage if photos matter.

**The award shortlists are drafted, not verified.** `src/data/people.ts`
carries a review banner: squads are pre-2026/27 and will contain players who
have since moved, plus explicit `PLACEHOLDER` entries for the three promoted
clubs. Correcting that one file fixes every picker, because the shortlists are
derived rather than hand-listed.

## Layout

```
src/
  data/        clubs, countries, people, awards, scoring rules, deadlines
  auth/        AuthProvider, LoginButton
  profile/     ProfileGate, profile types and hooks
  signup/      the step machine; steps/ for the individual steps
  predictions/ the ranker family, PredictionSequence, prediction types
  chat/        live room, RTDB presence and typing
  forum/       threads, popup, composer, preview
  home/        the bento, both landings; home/mobile/ for the phone tree
  leaderboard/ no leaderboard — the two dossier popups and TeamCrest
  mobile/      MobileAboutPage
  shell/       AppShell (forks desktop/mobile), nav table, popup host
  pages/       one file per route
  components/  ui primitives (shadcn on @base-ui/react)
scripts/       crest importer
```

## Four rules worth not breaking

**The page does not scroll.** `html`, `body` and `#root` are
`height: 100%; overflow: hidden`. Anything that overflows gets its own internal
scroll container. This is the substrate the whole layout system stands on — it
gives every page a *definite* height to divide. (The first build did the
opposite, deliberately; the reversal and what it cost are in
`VIZEHTABLE_HANDOVER.md` §10.)

**Mobile is a separate tree, not a reflow.** The fork is at 1024px, in one
place: `useIsMobile`. Never read a media query anywhere else.

**A green suite doesn't prove a layout or a loading fix.** Render-timing,
Firestore `fromCache` behaviour and flexbox sizing don't reproduce in jsdom.
Five of the seven bugs in `VIZEHTABLE_HANDOVER.md` §11 were found by clicking,
none by a test. Anything touching a live listener or a full-viewport
composition needs a real browser at a real viewport — and **measure block
heights, don't read screenshots**.

**Never restate a scoring number in copy.** Import it from `src/data/scoring.ts`.
Tests enforce this on the intro beats and the About text.
