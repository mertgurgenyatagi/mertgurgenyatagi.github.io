# zealandtable

A season-long Premier League prediction game, built to be pitched to the
football YouTuber **Zealandism**. Participants rank all 20 clubs for the
2026/27 table, call both domestic cups and six individual awards, and are
scored against real outcomes.

**This is a fork of `irishtable/`**, copy-and-adapt, taken 2026-08-09. The two
directories share no code and neither imports from the other — the same
relationship `irishtable` has with the `kupatakipucl` parent it came from.
`irishtable/` remains independently deployable and must not be edited to serve
this fork. Only branding and channel-name copy differ; see
`../zealandtable-pivot/HANDOVER-DELTA.md` for the decision trail.

**Handover — read this first:** [`ZEALANDTABLE_HANDOVER.md`](ZEALANDTABLE_HANDOVER.md)
— inherited from the parent and still accurate for everything except the
branding. Why everything is the way it is, what's already been tried, and where
the traps are.

Develop on **localhost** (`npm run dev`). Hosting is automated — see below.

**Live at https://mertgurgenyatagi.github.io/zealandtable/**

## What this is, relative to the repo it sits in

This directory is a **fully self-contained application**. It lives in the
`mertgurgenyatagi.github.io` repo alongside three siblings — `irishtable/`,
`kupatakip/` and `eventportal/` — but shares nothing with any of them: its own
`package.json`, `node_modules`, build config, Firebase project and deploy. No
module is imported across those boundaries in either direction. Code that came
from a sibling came by copy-and-adapt.

Run every command from inside `zealandtable/`, not the repo root.

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
firebase deploy --only firestore:rules,database --project zealandtable-app
```

Hosting is **GitHub Pages**, not Firebase Hosting — it deploys from
`.github/workflows/deploy.yml` on push to `main`. Don't `firebase deploy
--only hosting`.

The workflow publishes an **explicit allowlist** into `_site/`, not the repo.
Only `dist/` is copied, so nothing in `src/` or any `.md` here is public —
that is deliberate and load-bearing, see `ZEALANDTABLE_HANDOVER.md` §22. To
publish something new, add a line to the assemble step.

## Firebase

**Own project: `zealandtable-app`.** Entirely separate from `irishtable-app` —
separate Firestore, separate RTDB, separate users. Nothing is shared, and
signups here cannot reach irishtable's data. Spark plan, billing off.

| Service | State |
|---|---|
| Firestore | **live** — `eur3`, rules deployed |
| Realtime Database | **live** — `europe-west1`, rules deployed |
| Google sign-in | **working** — enabled by hand in the console, 2026-08-09 |
| Storage | **not set up** — needs Blaze; photos off |

Never repoint `.firebaserc` at `irishtable-app`. The two apps would share one
Firestore and one user pool.

## Setup from scratch

1. `npm install`
2. `.env.local` holds this project's real config and is gitignored, so it
   won't exist on a fresh clone. Regenerate it with:

   ```bash
   firebase apps:sdkconfig WEB --project zealandtable-app
   ```

   (These values aren't secret — Firebase web config ships in the client
   bundle by design — they're just environment-specific.)
3. `npm run dev`

## Known gaps

**Nobody has signed in yet.** Google sign-in is enabled and the authorized
domains are set, both verified by API — but no human has walked sign in → quiz
→ predict against this project's backend, and `zealandtable-app` holds zero
profiles, zero survey responses and zero predictions. An empty participant list
is expected, not a bug. This is the highest-value hour available; see
`ZEALANDTABLE_HANDOVER.md` §14 item 2.

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
`ZEALANDTABLE_HANDOVER.md` §10.)

**Mobile is a separate tree, not a reflow.** The fork is at 1024px, in one
place: `useIsMobile`. Never read a media query anywhere else.

**A green suite doesn't prove a layout or a loading fix.** Render-timing,
Firestore `fromCache` behaviour and flexbox sizing don't reproduce in jsdom.
Five of the seven bugs in `ZEALANDTABLE_HANDOVER.md` §11 were found by clicking,
none by a test. Anything touching a live listener or a full-viewport
composition needs a real browser at a real viewport — and **measure block
heights, don't read screenshots**.

**Never restate a scoring number in copy.** Import it from `src/data/scoring.ts`.
Tests enforce this on the intro beats and the About text.
