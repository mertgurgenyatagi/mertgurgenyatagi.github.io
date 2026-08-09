# zealandtable pivot — handover delta

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
