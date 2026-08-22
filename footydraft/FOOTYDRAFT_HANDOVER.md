# footydraft — Handover

**Written:** 2026-08-22, immediately after moving the project into this repo.
**Audience:** whoever picks this up next, including a fresh Claude Code session with no
memory of any of it — this document is written to stand on its own.

This is the entry point for continuing the **integration** work — turning a finished,
fully-simulated front end into a real, shared, live multiplayer game. It is not the game's
own design document (that's `PROJECT.md`, in this same folder — read it for every rule
about how a draft actually works) and it is not the decision log (that's
`questionnaires/integration/INTEGRATION.md`, also in this folder — read it for the full
reasoning behind every choice below). This document is the "what do I do next" layer on
top of both.

---

## 1. What this is, in one screen

**#footydraft** is a site where friends draft football players together across four game
formats (Auction, Deal or No Deal, Free Pick, Spin the Wheel). No scoring — squads are
compared and shared. The front end is complete: home page, both lobbies, all four draft
screens, a full design system, generated dot-grid player portraits, ~546 real footballers.
**Nothing is wired to a real backend yet.** Every "opponent," every chat message, every
lobby is simulated client-side. That's what this integration effort is turning real.

It now lives at `footydraft/` inside **your** multi-project GitHub Pages repo
(`mertgurgenyatagi.github.io`), alongside `irishtable/`, `zealandtable/`, `iconictable/`,
`vizehtable/`, and a couple of static sites. Served at `mertgurgenyatagi.github.io/footydraft/`.

Run every command from inside `footydraft/`. It has its own `package.json`,
`node_modules`, build config — nothing is shared with the other projects in this repo, and
nothing here should ever import from or edit them (same rule the other forks already
follow, from `FORKING-PLAYBOOK.md` §1: "never edit an existing fork to serve a new one" —
here read as "never touch another project's folder to build this one").

---

## 2. Status right now (2026-08-22)

**Done:**
- Full commit history (55 commits) grafted into `footydraft/` via `git subtree` —
  verified: file count matches the source repo exactly (3,176), all 55 commits reachable
  and checked against the source's own count, other projects in this repo untouched.
- Builds and passes from this new location: `npm install && npm run build && npm test` —
  40/40 tests green.
- Wired into the shared `.github/workflows/deploy.yml` — builds and publishes to
  `/footydraft/`. **No `.env` yet** — nothing in `src/` reads a Firebase config, so there's
  nothing to inject. Add the same heredoc pattern the other four projects use once that
  changes (see §6).
- Every project in this repo's deploy (footydraft included) now caches its build against a
  hash of its own source tree, so one project's commit no longer forces a rebuild of the
  other four. First run after this landed rebuilds everyone regardless (cold cache); the
  skip only pays off from the second run on.
- Pushed to `origin/main` — commit `90f8bdc`. **The live deploy (GitHub Actions run #150)
  was still in progress when this was written.** Check
  `github.com/mertgurgenyatagi/mertgurgenyatagi.github.io/actions` before assuming
  `/footydraft/` is actually serving anything yet.

**Not started:** everything backend. No Firebase project provisioned for footydraft yet.
No real lobby sync, no real chat, no real bot wiring, no squad comparison screen, no
Turkish translation, no real disconnect/reconnect. All of §5 below.

**The old repo** (`c:\Users\Mert\Desktop\repos\hashtagfootydraft`, still on GitHub at
`mertgurgenyatagi/hashtagfootydraft`) still exists, untouched, as a historical copy — it
was never deleted, just superseded. Nothing should be built there going forward.

---

## 3. Running it

```
cd footydraft
npm install
npm run dev       # local dev server
npm run build     # tsc --noEmit && vite build (runs scripts/sync_player_data.mjs first)
npm test          # vitest run — 40 tests, 11 files
```

---

## 4. Where to find things

| Question | Read |
|---|---|
| What are the actual game rules — formats, scope, constraints, timers, bot logic? | `PROJECT.md` (this folder) |
| Why was a given integration decision made, and what did Mert actually say? | `questionnaires/integration/INTEGRATION.md` (this folder) — three rounds so far, all answered |
| How does *this* repo's deploy/Firebase/CI convention work in general? | `../FORKING-PLAYBOOK.md` and `../PUBLIC-REPO-RISK.md` (repo root) — written for the prediction-game forks, but the deploy/Firebase/CI mechanics apply directly here too |
| What's the current build/deploy status? | `../.github/workflows/deploy.yml`, and the Actions tab on GitHub |

---

## 5. The decisions already made — condensed spec

Three questionnaire rounds (2026-08-22), all in `INTEGRATION.md` with full reasoning.
This is the settled shape of the work, not open for re-litigation unless something real
comes up (Mert's own words: "happy to do questionnaires til the cows come home" if a real
question surfaces — but don't manufacture ones that don't need asking).

- **Lobbies go fully, genuinely live.** Shared chat, shared seats, real presence — not a
  nicer simulation.
- **No visible accounts.** Name-only, as today. But: give each browser an **invisible
  per-device ID** under the hood (not a login, nothing the player sees) so reconnecting is
  reliable. Firebase Anonymous Auth is the natural fit — **not independently verified that
  it avoids the Identity-Platform-needs-billing restriction `FORKING-PLAYBOOK.md` §6
  describes for Google Sign-In; that restriction is specifically about the *Google*
  provider, and anonymous auth is a base Firebase Auth feature, but confirm this before
  assuming it's frictionless.**
- **No real anti-cheat effort.** Casual game for friends — see
  [[project-footydraft-not-commercial]] framing (Mert: *"This is not a serious project...
  I'm just autistic. This has absolutely no commercial aspirations."*). Favor cheap and
  simple over rigorous wherever the two trade off.
- **Wire the four real trained bot models in.** `src/data/botModels/*.json` — small
  actor-critic nets (shared trunk + actor/critic heads), PyTorch state-dict shaped, **not**
  ONNX. Nothing currently loads them; no inference library is installed. Given how small
  they are (539 KB–5 MB of plain weights), a hand-rolled matrix-multiply forward pass is
  likely simpler than pulling in an ONNX runtime — worth confirming shape/architecture
  against `scripts/training/models.py` in the old repo's history before writing it.
- **Finished lobbies auto-clear after about a day.** No draft history kept anywhere —
  one-off by design, matches today's behavior.
- **Build a squad comparison screen — but bigger than first scoped.** Not pairwise: **all
  squads shown side by side simultaneously**, post-draft. Must **not** scroll — this app's
  standing rule is that no screen ever scrolls (`PROJECT.md` → Interaction rules), and
  Mert confirmed explicitly (round 3): shrink everyone down to fit, don't break that rule.
  No numbers, no leaderboard, per the existing game rule in `PROJECT.md` → Comparing
  Squads.
- **Squad sharing/export is explicitly declined**, not deferred (round 1, Q7: "build only
  the first one"). Don't build it unless asked again.
- **Turkish translation: neutral/formal tone**, not casual. The `LanguageSwitch` component
  already exists on every screen and is currently inert — wire it up, write the
  translations.
- **Real disconnect/reconnect is a must-have**, not deferred: the existing 45-second
  bot-takeover rule (`PROJECT.md` → Disconnection & Reconnection) needs to actually work.
  One refinement from round 2: a quick same-device tab close/reopen (say, within a normal
  page-reload timeframe) should **quietly resume** without triggering the bot takeover at
  all — that's a different case from a real drop.
- **No spending alert needed.** Reusing the other projects' setup means footydraft runs on
  the same Spark (free) tier they do — no payment method attached at all. Mert confirmed
  (round 3): fine if it ever just stops working from hitting a free-tier limit, no need to
  proactively flag it.
- **Free Pick goes first**, and — per round 2's reversal of the staged recommendation —
  **all of it goes live together**: real picks, real chat, real presence, all at once, not
  incrementally. Once Free Pick is solid, repeat the pattern for the other three formats.
- **One big dry-run with real friends, at the very end** — once all four formats are real,
  not after just the first one.
- **New-situation rules for real lobbies**, settled round 2: joining a lobby whose draft
  already started → let them watch live (every board is already open to everyone, nothing
  to hide). Joining a full 5-person lobby → clear "this lobby is full" message. A stale/
  cleared lobby link → redirect home. Chat opens with one small system line ("lobby
  created"), not fully blank. Bots keep their couple-second thinking pause even with real
  models behind them — it's part of what makes it feel like people, not a script.
- **Develop directly against the real (empty) Firebase project.** No separate
  practice/staging backend — Mert's call, it's free at this scale.
- **Reuse the other projects' exact infra defaults**: Spark/free tier, Firestore region
  `eur3`, Realtime Database region `europe-west1`.
- **Public docs are fine.** This repo is already fully public on GitHub (a known, accepted
  risk recorded in `../PUBLIC-REPO-RISK.md`, for unrelated reasons); Mert confirmed
  (round 2) he doesn't mind footydraft's own planning docs — including this one — being
  public too. No special exclusion needed anywhere.
- **Implementation stance: reckless.** Mert's words, stated twice, once as a direct answer
  and once unprompted right after: *"I want reckless and direct implementation... If
  issues arise we deal with them."* Thorough planning (as many questionnaire rounds as it
  takes) but fast, unhedged building once something's decided — don't add defensive
  coding or ask permission for small implementation choices that don't change already-
  decided behavior. The one carve-out: anything touching this repo's *other* live
  projects gets the same care the move itself got (verify before pushing) — reckless is
  about footydraft's own code, not about the neighbors.

---

## 6. What's next, concretely

Suggested order, but not gospel — reprioritize if something makes more sense once you're
actually looking at the code:

1. **Provision a Firebase project for footydraft.** Follow `../FORKING-PLAYBOOK.md` §4
   almost exactly (own project, Spark plan, Firestore `eur3`, RTDB `europe-west1`) — but
   skip the Identity Platform / Google Sign-In parts of §4 and §6 entirely, since there
   are no visible accounts here. Enable Anonymous Auth instead (verify it doesn't hit the
   same Spark billing wall §6 describes — that wall is specifically about the Identity
   Platform *admin API* for the Google provider, so it likely doesn't apply, but confirm
   rather than assume). Once the project exists, add footydraft's `.env` heredoc to
   `.github/workflows/deploy.yml`'s "Build footydraft" step, matching the other four
   projects' exact pattern.
2. **Wire Free Pick's real state**: picks, chat, and presence together, via Firestore
   (or RTDB — `player_pool.py`-style low-latency writes might favor RTDB for the fast-
   moving stuff; Firestore for anything that benefits from querying. Not decided yet,
   your call to make and just build it, per the reckless-implementation stance).
3. **Wire the four trained bot models in** for whichever screen(s) that touches first.
4. **Real disconnect/reconnect**, with the same-device quick-resume case.
5. **Build the squad comparison screen** — all squads, side by side, shrink to fit.
6. **Turkish translations**, neutral/formal tone, wire up the existing language switch.
7. **Repeat steps 2–4 for the other three formats.**
8. **The dry run with real friends**, once everything above is done.

---

## 7. Traps worth not rediscovering

- **The footydraft build step in `deploy.yml` has no `.env` yet.** Don't forget to add one
  the moment Firebase is wired in — copy the exact heredoc shape the other four projects
  use, just above `npm ci`.
- **Don't touch `irishtable/`, `zealandtable/`, `iconictable/`, or `vizehtable/`.** Nothing
  here should ever import from or edit them.
- **The deploy cache is source-hash-keyed and self-healing** — any real commit to
  `footydraft/` changes its cache key automatically, so there's no manual cache-busting
  step to remember.
- **This repo has no root `CLAUDE.md`** — only `.claude/settings.json` (permissions, not
  memory). There's no single file that auto-points a fresh session at `footydraft/`
  specifically; that's what this document is for.
- **Verify the Actions run, don't assume.** `git push` succeeding only means GitHub
  accepted the commits — check the Actions tab for the actual deploy result before
  treating `/footydraft/` as live.
