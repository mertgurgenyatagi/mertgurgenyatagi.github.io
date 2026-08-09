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

**Handover — read this first:** [`IRISHTABLE_HANDOVER.md`](IRISHTABLE_HANDOVER.md)
— inherited from the parent and still accurate for everything except the
branding. Why everything is the way it is, what's already been tried, and where
the traps are.

Develop on **localhost** (`npm run dev`). The site was deployed to Firebase
Hosting once during the build, but Mert hadn't asked for that and leans towards
GitHub Pages — don't deploy without being asked.

## What this is, relative to the repo it sits in

This directory is a **fully self-contained application**. It lives inside the
`kupatakipucl` repo but shares nothing with it — its own `package.json`,
`node_modules`, build config, Firebase project and deploy. No module is
imported across the boundary in either direction. Code that came from the
parent came by copy-and-adapt.

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
npm test             # 424 tests, vitest
npm run build        # tsc -b && vite build
npm run crests       # re-import club crests from docs/pl-fork/assets/
firebase deploy      # WILL FAIL — see "Firebase is not provisioned" below
```

## Firebase is not provisioned

**This fork has no backend yet, by decision.** `.firebaserc` points at
`zealandtable-app`, a project that does not exist — so `firebase deploy` fails
loudly rather than silently deploying over irishtable's live site. That is
deliberate. Do not repoint it at `irishtable-app`; the two apps would share one
Firestore, and signups here would land in irishtable's real data.

Provisioning a real project was deferred until Zealandism actually responds.
Until then this folder is a local pitch artifact.

## Setup from scratch

1. `npm install`
2. `.env.local` here currently holds **placeholder values, not real
   credentials** — enough for `npm run dev` to boot the UI and for `npm test`
   to pass (without it, 4 test files fail at import with
   `auth/invalid-api-key`, because `src/firebase.ts` calls `getAuth()` at
   module load). Anything that actually talks to Firebase — sign-in, chat,
   submitting a prediction — will not work until this is filled in from a real
   project of this fork's own.

   irishtable's real `.env.local` was deliberately **not** copied over: it
   points at irishtable's production project, so signups here would land in
   irishtable's live Firestore.

   (Firebase web config isn't secret — it ships in the client bundle by
   design — it's just environment-specific.)
3. `npm run dev`

## Known gaps

**Google sign-in is not enabled yet.** This is the one thing standing between
the site and a working sign-up. The Identity Platform admin API refuses
configuration writes on a free-tier project, so it has to be done by hand:

> Firebase console → this fork's own project → Authentication → Get started →
> Sign-in method → Google → Enable → set a support email → Save.

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
`IRISHTABLE_HANDOVER.md` §10.)

**Mobile is a separate tree, not a reflow.** The fork is at 1024px, in one
place: `useIsMobile`. Never read a media query anywhere else.

**A green suite doesn't prove a layout or a loading fix.** Render-timing,
Firestore `fromCache` behaviour and flexbox sizing don't reproduce in jsdom.
Five of the seven bugs in `IRISHTABLE_HANDOVER.md` §11 were found by clicking,
none by a test. Anything touching a live listener or a full-viewport
composition needs a real browser at a real viewport — and **measure block
heights, don't read screenshots**.

**Never restate a scoring number in copy.** Import it from `src/data/scoring.ts`.
Tests enforce this on the intro beats and the About text.
