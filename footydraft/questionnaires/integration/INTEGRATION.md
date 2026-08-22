# #footydraft — Integration Rules

Living source of truth for turning the finished, fully-simulated front end recorded in
`PROJECT.md` into a real, shared, live multiplayer game. Starts empty and gets filled in
as each questionnaire round in this folder is answered — `integration_questionnaire_1.md`,
`_2.md`, ... — the same round-by-round pattern `PROJECT.md` itself used for its own R1–R10
questionnaires.

**Status:** the front end is complete (see `PROJECT.md`). Nothing below exists yet — no
backend, no real bot wiring, no live sync between two people looking at the same lobby.
This document tracks what gets decided and built as that changes, round by round.

**Live questionnaire artifact:** https://claude.ai/code/artifact/cd579320-6111-4b5f-baa2-9db039f1c953
— every round reuses this same URL; redeploying it with a new `ROUND` object is how the
next set of questions goes out. Source shell: `integration-questionnaire.html` (rebuilt
fresh from this URL each round via the Artifact tool's update flow — not checked into the
repo, since it's a tool, not a game screen).

## Round 1 — asked and answered 2026-08-22

20 questions covering the shape of the integration. Answers in `integration_questionnaire_1.md`;
settled:

- **Lobbies go fully, genuinely live** — shared chat, shared seats, not a nicer simulation.
- **No accounts.** Name-only, as today.
- **Wire the four real trained bot models in** — they exist, unused, per-format.
- **No real anti-tamper effort** — casual game for friends, not worth guarding.
- **Finished lobbies auto-clear after about a day.** No draft history kept — one-off by design.
- **Build squad comparison, keep it simple** — but explicitly **not** squad sharing/export
  (declined, not deferred — see Q7's answer, "build only the first one").
- **The whole project moves into `mertgurgenyatagi.github.io`** — Mert's personal multi-project
  GitHub Pages repo, where all his other sites already live. See
  [[project-footydraft-integration-move]] in memory and round 2 below for what that repo's
  own `FORKING-PLAYBOOK.md` says about doing this properly.
- **Write the Turkish translations now**, while the language switch is already being touched.
- **Real disconnect/reconnect (45s bot takeover, hands back on return) is a must-have**, not
  deferred.
- **No pre-integration visual QA pass needed** — Mert checked the recent unverified changes
  himself, they're fine.
- **Known small rough edges** (missing photo, some awkward crops, unchecked Safari) stay on
  their own separate list — don't fold into this push.
- **One format at a time, not all four together.** **Free Pick goes first** (simplest, safest
  to prove the pattern on).
- **Room codes stay easy-to-share, not hardened** — nothing sensitive in a lobby.
- **A real spending ceiling gets set up, via Google Cloud.**
- **A live dry-run with real friends before calling it done** — left as "your call," taken as
  yes.
- **Short status notes after each meaningful chunk of work.**
- **A stale/cleared lobby link redirects home** (not an error page).
- **Framing that shapes everything above:** this is explicitly **not a commercial project** —
  a personal project, no monetization, no scale concerns. See
  [[project-footydraft-not-commercial]] in memory. Favor cheap and simple over rigorous
  wherever the two trade off.

## Round 2 — asked 2026-08-22

Before writing it, read `FORKING-PLAYBOOK.md` and `PUBLIC-REPO-RISK.md` in
`mertgurgenyatagi.github.io` (Mert's destination repo) — it already has a three-times-proven
pattern for adding a project there: one shared CI workflow that assembles an explicit
`dist/`-only allowlist per project (never the raw repo), one Firebase project per site on the
free tier, fixed server regions. Confirmed live in that repo, not assumed: no CI path filter
exists yet (every push rebuilds all ~15 sites), and the repo itself is fully public on
GitHub — separate from the locked-down site output — which raises a real question about
footydraft's own planning docs, including the personal note in round 1's last answer.

20 questions: git history for the move, the actual URL path, whether the planning docs
(this file included) go public or stay out, an invisible per-device ID vs. none at all,
fixing the shared CI's blast radius, reusing the other projects' Firebase defaults, how the
squad-comparison screen should actually open, Turkish tone (casual vs. formal), the spending
ceiling figure, dry-run timing (after Free Pick vs. at the very end), bringing Free Pick's
pieces live one at a time vs. all together, joining a lobby mid-draft, joining a full lobby,
a quick same-device reconnect vs. the uniform 45s rule, real chat's starting state, whether
the real trained bots keep their artificial thinking pause, developing against the real
Firebase project vs. a practice one, and any remaining worry about the move itself.
**Answered same day** — see `integration_questionnaire_2.md`. Settled, beyond what's already
in memory ([[project-footydraft-integration-move]]):

- **Public docs are fine** — no special handling needed, push everything.
- **Squad comparison is bigger than first scoped**: not a pairwise picker — Mert wants
  **all squads shown side by side simultaneously** ("Just show all squads side by side" /
  "All."). This conflicts with the app's standing never-scroll rule at a full 5-drafter
  table and needed a follow-up — see round 3.
- **Turkish translation: neutral/formal tone**, not casual (overturns the round 1
  recommendation).
- **Spending: as close to $0 as configurable** ("Zero spending... like 0.01 USD") — stricter
  than the "small default ceiling" recommended. Turned out to mostly resolve itself — see
  round 3.
- **One big dry-run at the very end**, not after the first format (overturns the
  recommendation — matches the reckless-implementation stance below).
- **Free Pick goes live all at once** — real picks, chat and presence together, not staged
  (overturns the recommendation, same reason).
- Mid-draft joiners watch live; a full lobby shows a clear message; a quick same-device
  reopen quietly resumes without the bot takeover; chat opens with one system line; bots
  keep their thinking pause; development happens directly against the real Firebase
  project. All as recommended.
- **Framing that lands on top of everything above** (Q20, and repeated unprompted right
  after as a mid-turn interrupt): *"I want reckless and direct implementation... I'm happy
  to do questionnaires til the cows come home."* Thorough planning, fast/unhedged building
  once something's decided. See [[feedback-reckless-implementation]] in memory.

## Round 3 — asked 2026-08-22

Round 2 resolved almost everything decisively, so this round is short on purpose — three
things that were genuinely still open, not padded to any target length (per the
reckless-implementation steer: no process for its own sake). Covers: whether the new
"all squads at once" comparison screen breaks the app's never-scroll rule or shrinks
everyone to fit instead; confirmation that reusing the other projects' free-tier setup
means there's no payment method attached at all (so "spending alert" mostly doesn't apply
— flagged as a finding, framed as one remaining choice: get warned before the free tier's
usage limits are hit, or let it just stop working); and an explicit go-ahead specifically
for the git-history merge, since that's the one step touching a repo Mert's other live
projects also depend on. Answers pending in `integration_questionnaire_3.md`. Once this
round is in, implementation starts — further rounds remain welcome any time something real
comes up, per Mert's own stated preference.

## Open Questions Log

_(empty — round 1 not yet answered)_

## Decisions

_(empty — round 1 not yet answered)_
