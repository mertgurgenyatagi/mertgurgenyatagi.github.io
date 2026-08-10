# Paste this into a new session to fork again

Copy everything inside the fenced block, fill in the two placeholders on the
first lines, and send it as the opening message.

---

```text
I want to fork the Premier League prediction game for another YouTuber.

Channel name: <EXACT channel name, styled as it should appear on the page>
New site name: <lowercase, no spaces, e.g. foobartable>

Read these first, in this order:

- FORKING-PLAYBOOK.md — the step-by-step procedure. Follow it top to bottom.
  It is authoritative and it is current: it was updated after the last fork.
- vizehtable/VIZEHTABLE_HANDOVER.md — §24 is how the last fork went. Read
  §24.8 (a real hole in the audit method) and §24.10 (what "it works" did and
  did not prove) before you touch anything. Skim §1–§2 for what the app is.
  §21–§23 are older forks' history — read §22 if you touch the deploy,
  otherwise reference.
- PUBLIC-REPO-RISK.md — a known, accepted risk. Don't re-litigate it, but
  check whether its fix trigger has been hit.

Key things the playbook will tell you, so you don't undo them:

- Copy with `git archive`, never `cp -r`.
- The deploy publishes an allowlist into `_site/`. Never `path: '.'`.
- Each fork gets its own Firebase project.
- Don't edit any existing fork to serve the new one.
- Fork from vizehtable/ — it is the most current, and the only one whose auth
  is confirmed working.

Start by reading the playbook, then tell me your plan before writing code.
```

---

## Why the prompt says what it says

**Fork from `vizehtable/`.** Playbook §1 says take the most current fork, and
as of 2026-08-10 that is vizehtable: it is the newest, it already has the
`GlitchSeason` in-joke cut, and it is the only one whose Google sign-in has
been verified end to end. Confirm it is still the most current before copying —
`git log --oneline -3 -- <fork>/` for each — because that changes as soon as
anyone works on a different folder.

**§24.8 before touching anything.** `sed` and `grep` are both line-based, so a
two-word channel name wrapped across a line break survives the substitution
*and* the check meant to catch it. That happened last time and the audit
reported clean while the old channel name was still in the document. Re-scan
with newlines flattened.

**§24.10 before trusting "it works".** Last fork, sign-in was reported working
and it genuinely was — but `predictions` was empty. Check the database, not the
screen.

## Open items the next session should know

1. **The app itself is proven — the risk on a new fork is configuration, not
   code.** vizehtable was walked end to end on 2026-08-10 (sign in → quiz →
   predictions → editing a submitted prediction) against its own Firebase
   project and everything works. Nothing in that path is fork-specific, so a
   new fork inherits a known-good code path and only its own Firebase setup can
   be wrong. That is exactly what the playbook §6 API checks cover. Walk it
   anyway — ten minutes, and it is the only real end-to-end signal.

   The three older forks (irishtable, zealandtable, iconictable) have still
   never had a single sign-in.

2. **The deadline is stale-ish.** `src/data/deadlines.ts` closes predictions on
   **21 August 2026**. Any fork made after that date is pitching a game whose
   entry window has shut, and the date needs moving before the copy makes
   sense.

3. **Every fork ships the same logo and the same 17 inherited hero portraits**
   (Champions League players in the wrong kits). Fine for a pitch, wrong for a
   launch. A genuinely distinct logo is the one branding change the playbook
   cannot automate.

4. **CI rebuilds every fork on every push to `main`.** With five forks this is
   already the slowest part of the loop, and one broken build fails the deploy
   for all of them. Playbook §5 suggests a path filter at four or five — that
   threshold has now been reached, so consider it before adding a sixth.

5. **`PUBLIC-REPO-RISK.md` is still unfixed by choice.** Trigger is the first
   channel that says yes, *before* they announce. Budget half an hour for the
   repo split; don't leave it until the hour you are replying to an interested
   channel.

## The forks that exist, as of 2026-08-10

| Folder | Published at | Channel | Firebase | Auth walked |
|---|---|---|---|---|
| `irishtable/` | `/theirishtable/` | The Irish Guy | `irishtable-app` | no |
| `zealandtable/` | `/zealandtable/` | Zealandism | `zealandtable-app` | no |
| `iconictable/` | `/iconictable/` | Football Iconic | `iconictable-app` | no |
| `vizehtable/` | `/vizehtable/` | Vizeh | `vizehtable-app` | **yes** |

`/irishtable/` is **burned permanently** and serves a redirect to `/not-found/`
— a sent email points at it. Never serve an app there again (§22.5).
