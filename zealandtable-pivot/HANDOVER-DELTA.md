# zealandtable pivot — handover delta

> ## ⚠️ Superseded — folded into the real handover
>
> This was the working document *during* the pivot. It has since been folded
> into **`../zealandtable/ZEALANDTABLE_HANDOVER.md` §21**, which is now the
> canonical account of the fork and is kept current. The reusable procedure
> extracted from it lives in **`../FORKING-PLAYBOOK.md`**.
>
> Kept for the decision trail only. **Do not use it as instructions** — several
> statements below were reversed the same day they were written (see §5b, §5c),
> and the §5 checklist is known to be incomplete. The raw questionnaire answers
> in this folder remain the primary record of what Mert actually asked for.

**Written:** 2026-08-09, mid-session, handed off early to avoid context bloat.
**Read this after:** `irishtable/IRISHTABLE_HANDOVER.md` — this file assumes that
context and only records what's new. Where the two disagree about what's
*decided*, this file wins; it's newer. Where this file is silent, nothing
about irishtable has changed.

**Nothing in `irishtable/` has been touched.** No code has been written yet.
This whole session so far is discovery: a 3-round questionnaire, run through
published Artifact pages with a copy-to-clipboard button, answers pasted back
into this folder. That's the house style for this repo (see
`IRISHTABLE_HANDOVER.md` §16) — quick rounds through a browser artifact
rather than one-question-at-a-time chat.

---

## 1. What this is

Mert wants to shamelessly reuse the irishtable pitch for a second YouTuber,
**Zealandism**, under the name **zealandtable**. Same playbook as irishtable
itself: build it, then cold-email the channel.

## 2. The three rounds, answers in full

Raw pasted answers live in this folder: `round1-answers.md`,
`round2-answers.md`, `round3-answers.md`. Summarized:

**Round 1 — Scope & identity**
- Still English Premier League, same as the Irish Guy. Not rugby, not a
  different competition.
- Same structure — 20-club table, 2 cups, 6 awards. Explicitly **not** a full
  reskin like the kupatakipucl→irishtable clone was — just targeted rewrites
  of specific parts.
- Name confirmed: `#zealandtable`.
- Zealandism hasn't replied to anything yet — this is being built before an
  email goes out, not in response to one.
- Dates unchanged: predictions close 21 Aug 2026, season starts 22 Aug 2026.
- How much gets deployed this round: undecided, deferred until after
  Zealandism responds.

**Round 2 — What actually changes**

I grepped `irishtable/src` for everything actually specific to "The Irish
Guy" rather than just internal comments naming the project. It was a short
list, and it became the checklist. Result — **changes:**
- Nav wordmark, `#IRISHTABLE` → `#ZEALANDTABLE`
- Welcome-screen split wordmark (`"irish"` bold / `"table — welcome."`
  regular) → `"zealand"` bold, same tail
- The literal credit sentence `"Made for the Irish Guy YouTube channel."` →
  `"Made for the Zealandism YouTube channel."` (confirmed literal swap is
  fine, Round 2 Q2)
- The `"season → susan"` glitch inside joke

**Stays unchanged:**
- The logo (`public/brand/irishtable-logo.svg`, the literal PL lion) — same
  file, carried over as-is
- Palette, fonts, ruled-grid background — all untouched
- ~~Repo folder / package name / Firebase project id~~ — **superseded, see
  §4 below.** Round 2's Q4 answer ("no, leave scaffolding as irishtable")
  was given on the assumption of editing `irishtable/` in place. That
  assumption no longer holds.

**Round 3 — Closing the loop**
- The susan glitch: **cut entirely, no replacement.** Not swapped for a new
  word pair — just gone.
- `CHANNEL_NAME` confirmed as the exact string `"Zealandism"`.
- Explicit steer: **keep it minimal.** Zealandism shouldn't be able to tell
  this was built for someone else first.
- Then a late addition that changes the technical approach — see §4.

## 3. `CHANNEL_NAME` auto-propagation, already verified

`src/data/site.ts` exports `CHANNEL_NAME`, imported by `aboutContent.ts`,
`AboutPage.tsx`, and `MobileAboutPage.tsx` — all three already interpolate
it rather than hardcoding the channel name. Changing the one constant is
enough to fix the About page and its mobile twin; nothing else to hunt down
there. `SITE_NAME` works the same way.

The one thing that does **not** go through a constant is the credit-line
sentence in `HomeLandingLoggedOut.tsx` / `MobileHomeLoggedOut.tsx` — that's
a literal hardcoded string in each file and needs its own edit.

## 4. The late pivot: this is a fork, not an in-place edit

At the end of Round 3, Mert added a requirement that overrides part of
Round 2's answer:

> "The dream would be if the irish guy version could stay as is, so if he
> eventually looks at it, we could keep that alive. Is that achievable?"

Reasoning given: keep it minimal so Zealandism can't tell this was recycled,
*and* preserve the option to still pitch the Irish Guy version later if he
ever does respond, *and* preserve the option to fork a third time for
someone else if Zealandism also passes.

**My recommendation, given but not yet actioned:** don't edit
`irishtable/` in place. Copy the whole directory to a new `zealandtable/`
folder — mirroring exactly how irishtable itself came from `kupatakipucl`
(copy-and-adapt, no cross-imports, its own `package.json` name). Apply the
four Round 2/3 content edits only inside the copy. `irishtable/` stays
byte-for-byte untouched and still deployable. Explicitly do **not**
provision a new Firebase project or hosting path yet — Round 1 already
deferred that decision until Zealandism responds, and a plain local copy
doesn't need live infrastructure to exist as a pitch artifact.

**This directly supersedes Round 2 Q4** ("leave the scaffolding as
irishtable for now") — that answer assumed a single in-place folder. A
`zealandtable/` copy needs at least its own `package.json` name by
necessity (two folders can't both claim to be `irishtable`), even though no
new Firebase project is being set up yet.

**I asked Mert to confirm this approach and haven't gotten an answer yet.**
That confirmation is the actual next step, not the copy itself — don't
start copying without it landing first.

## 5. Open items, ranked

1. **Get explicit go-ahead on the copy-fork approach** (§4), or an
   alternative if Mert wants something else. Nothing should be written to
   disk before this lands.
2. **Once approved:** copy `irishtable/` → `zealandtable/` wholesale, rename
   `package.json`'s `name` field at minimum. Do not touch anything inside
   `irishtable/`.
3. **Apply the four confirmed edits inside `zealandtable/` only:**
   - `src/data/site.ts` — `CHANNEL_NAME` → `"Zealandism"`
   - `src/shell/AppShell.tsx`, `src/shell/MobileShell.tsx` — wordmark text
     `#IRISHTABLE` → `#ZEALANDTABLE`
   - `src/signup/steps/WelcomeStep.tsx` — bold span `"irish"` → `"zealand"`
   - `src/home/HomeLandingLoggedOut.tsx`,
     `src/home/mobile/MobileHomeLoggedOut.tsx` — credit sentence →
     `"Made for the Zealandism YouTube channel."`
4. **Cut the susan glitch.** Not yet scoped — nobody has grepped where
   `GlitchSeason` (`src/components/ui/GlitchSeason.tsx`) is actually
   invoked. "Cut entirely" most likely means removing the call site(s) so
   affected text renders as plain static text, not just leaving the
   component unused. Find the usages before touching this.
5. **Unresolved detail, not asked yet:** does the logo file itself get
   renamed from `irishtable-logo.svg` to `zealandtable-logo.svg` inside the
   copy (same PL lion asset, just a filename), or does the literal filename
   also stay `irishtable-logo.svg` inside the `zealandtable/` tree? Cosmetic
   either way, but worth a quick check rather than assuming.
6. **No Round 4 or 5 currently planned.** Scope converged after Round 3 —
   only run another round if something genuinely new comes up during
   implementation. `round4-answers.md` and `round5-answers.md` exist as
   empty placeholders and probably won't get used.
7. **Deferred, not blocking anything now:** new Firebase project id, GitHub
   Pages hosting path (`mertgurgenyatagi.github.io/zealandtable/`), and any
   GitHub Actions workflow changes for a second deploy target. All of this
   waits until Zealandism actually responds, per Round 1.

## 5b. DONE — approved and executed, 2026-08-09

Mert confirmed the §4 copy-fork approach. It is now built. **§5's open items 1–5
are closed**; items 6–7 still stand.

`zealandtable/` was created from `git archive HEAD:irishtable` — the tracked
tree only, so no `node_modules`, `dist`, `.firebase`, `*.tsbuildinfo` or
`.env.local` came across. 245/245 tracked files. **`irishtable/` was not
touched** — verified clean via `git status` before and after.

Verified: `npm run build` (tsc -b) clean, `npm test` **420/420 passing, 48/48
files**.

**The §5 checklist was incomplete.** These were found by grepping the copy and
also changed, because each is user-visible or a real collision risk:

- `SITE_NAME` — §5 listed only `CHANNEL_NAME`, but `SITE_NAME` was
  `"#irishtable"` and renders on the About page via `{SITE_NAME}`. Now
  `"#zealandtable"`.
- `index.html` — `<title>`, `og:site_name`, `og:title`, `twitter:title`,
  favicon href. This is the browser tab and every link preview in a pitch
  email; it would have been the loudest tell.
- **GlitchSeason had 5 call sites, not the 2 §5 assumed** — also
  `AboutPage.tsx` ×2 and `AwardPickerStage.tsx`. All cut, the component file
  deleted, all imports removed. In `AwardPickerStage` the whole
  `label.includes("Season")` split-and-splice ternary collapsed to
  `{award.label}`; output is character-identical because `.type-display` is
  `text-transform: uppercase`.
- `sessionCache.ts` `PREFIX` → `zealandtable-cache:`. **Not cosmetic** —
  `mertgurgenyatagi.github.io/irishtable/` and `/zealandtable/` would share one
  origin, so both apps would have read and written each other's localStorage
  cache entries.
- Logo renamed `irishtable-logo.svg` → `zealandtable-logo.svg` (same PL lion
  asset — this closes §5 item 5). The path is visible in the DOM and network
  tab, so it was a tell. 5 references updated plus the favicon and
  `scripts/import-crests.mjs`'s `BRAND_MAP`.
- `package.json` + `package-lock.json` name, and `README.md` rewritten for the
  new channel and fork relationship.

**One deliberate safety change, worth knowing about:** `.firebaserc` now says
`zealandtable-app`, **a project that does not exist**. Left as `irishtable-app`,
a stray `firebase deploy` from inside `zealandtable/` would have overwritten
irishtable's live hosting — the exact outcome this fork exists to prevent. It
now fails loudly instead. Repointing it at `irishtable-app` would also make the
two apps share one Firestore. Per Round 1, no real project is provisioned yet.

**`.env.local` holds placeholder values, not real credentials.** It was not
copied from irishtable (those point at production). The placeholders exist
because `src/firebase.ts` calls `getAuth()` at module load, so without *some*
value 4 test files fail to import. UI boots and tests pass; nothing that
actually talks to Firebase works.

**Left alone on purpose:** internal code comments and test fixtures still
mention irishtable/kupatakipucl/"The Irish Guy" (e.g. `chatMentions.test.ts`),
per the Round 2 decision that internal references stay. Dev-facing only, not
reachable from the deployed site. `IRISHTABLE_HANDOVER.md` was copied in
unchanged — it documents how this codebase works and is still accurate for
everything but branding; renaming it would make its contents lie.

## 5c. Backend provisioned, 2026-08-09 — reverses Round 1's deferral

Mert asked for zealandtable to be "as functional as irishtable", which
overrides Round 1's decision to defer all infrastructure until Zealandism
replied. §5 item 7 is therefore closed, not deferred.

**Note the README was stale on this point** and cost some reasoning: it said
Google sign-in was "not enabled yet" on irishtable. `IRISHTABLE_HANDOVER.md`
§ status table (newer) says sign-in is **working** and the site is **live on
GitHub Pages** at `mertgurgenyatagi.github.io/irishtable/`. Trust the handover
over the README.

**Provisioned via CLI, all done:**
- Firebase project `zealandtable-app` (Spark, billing off) — its own project,
  no shared state with `irishtable-app`
- Web app → real config now in `zealandtable/.env.local` (gitignored)
- Firestore, `eur3`, rules deployed
- Realtime Database, `europe-west1`, rules deployed —
  `https://zealandtable-app-default-rtdb.europe-west1.firebasedatabase.app`
- `.github/workflows/deploy.yml` — added a `Build zealandtable` step mirroring
  irishtable's, so Pages serves it from `/zealandtable/`. Verified the file
  still parses and irishtable's own step is untouched.
- Re-verified after wiring the real config: build clean, **420/420 tests**.

**`vite.config.ts` needed no change** — `base: "./"` is already relative, so
the subfolder deploy works as-is.

**Two gotchas hit, recorded so nobody re-derives them:**
1. `gcloud` cannot reach `serviceusage.googleapis.com` from inside the agent
   sandbox even though DNS resolves; API enablement has to run unsandboxed.
2. The Firebase Database Management REST API rejects user credentials without
   an `x-goog-user-project` header (`SERVICE_DISABLED`, misleadingly).

**Blocked on Blaze, genuinely — not a workaround away:** enabling Google
sign-in returns `BILLING_NOT_ENABLED : Identity Platform feature requires
billing to be enabled`. This confirms the handover's claim rather than
contradicting it. It must be clicked in the console, exactly as irishtable's
was. Until then the site builds and renders but nobody can sign in.

## 6. Artifacts published this session

Three questionnaire rounds, published as Claude Artifacts (private, not part
of the repo — the `.md` answer files in this folder are the durable record,
these links are just for reference if useful):

- Round 1: `https://claude.ai/code/artifact/001b60ee-bd5c-4e08-a419-6ed4baaaa48c`
- Round 2: `https://claude.ai/code/artifact/0c6fa3a2-999b-4c9b-bb5d-36cada53bc00`
- Round 3: `https://claude.ai/code/artifact/1154cbc4-6851-447a-83d0-3920298be4ae`

## 7. Nothing has been committed

Every file mentioned here (`round1-answers.md` through `round5-answers.md`,
this delta) is new and untracked. No git add, commit, or push has happened
this session. Worth deciding explicitly whether `zealandtable-pivot/`
belongs in version control before the next session starts touching code.
