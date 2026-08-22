# Paste this into a new session to fork again

Copy everything inside the fenced block, fill in the two placeholders on the
first lines, and send it as the opening message.

**Status as of 2026-08-22: no prediction-game forks currently exist.** The
four that were pitched (irishtable, zealandtable, iconictable, vizehtable)
were all removed — none had been accepted by a channel, and their Firebase
projects have been deleted. Forking again means picking a new source with
step 0 below; there is no default "most current fork" anymore.

---

```text
I want to fork the Premier League prediction game for another YouTuber.

Channel name: <EXACT channel name, styled as it should appear on the page>
New site name: <lowercase, no spaces, e.g. foobartable>

Read these first, in this order:

- FORKING-PLAYBOOK.md — the step-by-step procedure. Follow it top to bottom.
- PUBLIC-REPO-RISK.md — a known, accepted risk. Don't re-litigate it, but
  check whether its fix trigger has been hit.

Key things the playbook will tell you, so you don't undo them:

- Copy with `git archive`, never `cp -r`.
- The deploy publishes an allowlist into `_site/`. Never `path: '.'`.
- Each fork gets its own Firebase project.
- Don't edit any existing fork to serve the new one.

Start by reading the playbook, then tell me your plan before writing code.
```

---

## Why the prompt says what it says

**No default source fork anymore.** Playbook §1 says take the most current
fork, but as of 2026-08-22 there is no living fork to copy from — pick a base
deliberately (an existing sibling project if one is close enough in shape, or
build the first tree from scratch) and record the decision in the new fork's
handover doc so the next person isn't guessing.

**Re-verify residual references before shipping.** `sed` and `grep` are both
line-based, so a two-word channel name wrapped across a line break can survive
a substitution *and* the check meant to catch it. This has happened before —
an audit reported clean while the old channel name was still sitting in the
handover doc. Re-scan with newlines flattened (playbook §7 has the snippet).

**Verify "it works" against the database, not the screen.** A prediction
flow reported as fully working once turned out to have been checked against
an empty collection mid-test — an accurate read, but the wrong inference.
Check the database *after* a full walkthrough, not mid-walkthrough.

## Open items the next session should know

1. **There is no proven-working fork to inherit from right now.** Whichever
   fork was most recently walked end-to-end (sign in → quiz → predictions →
   editing a submission) is now gone along with its Firebase project. A new
   fork should get the same full walkthrough against its own project before
   being trusted — see playbook §8.

2. **Any deadline data (`src/data/deadlines.ts`) in a copied source tree will
   be stale.** Move the date before the copy makes sense.

3. **A genuinely distinct logo is the one branding change the playbook cannot
   automate.** Every past fork shipped the same inherited hero portraits.
   Fine for a pitch, wrong for a launch.

4. **`PUBLIC-REPO-RISK.md` is still unfixed by choice.** Trigger is the first
   channel that says yes, *before* they announce. Budget half an hour for the
   repo split; don't leave it until the hour you are replying to an interested
   channel.

## `/irishtable/` stays retired permanently

`/irishtable/` serves a redirect to `/not-found/` and always will, even with
the irishtable project itself gone — a past pitch email points at that URL
and email cannot be recalled. Never serve an app at that path again. See
`.github/workflows/deploy.yml` and `FORKING-PLAYBOOK.md` §5.
