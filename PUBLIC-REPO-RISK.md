# Known risk: this repository is public

**Status:** accepted, deliberately, on 2026-08-10. **Not fixed. Not forgotten.**
**Fix trigger:** the first YouTuber who says yes. See "When to fix this" below.

**Update, 2026-08-22:** the four pitched forks this file originally worried
about (irishtable, zealandtable, iconictable, vizehtable) have all been
removed — none was ever accepted by a channel — along with the
`zealandtable-pivot/` questionnaire and both project handovers this file used
to point at. That collapses the specific pitch-secrecy scenario below to
essentially nothing, since there is currently no live rebrand-and-pitch
history for a stray reader to find. The risk resumes the moment a fork exists
again (`FORKING-PLAYBOOK.md` still describes how, and will again the next time
this file is generated for a new fork), so this file stays in place rather
than being deleted. The `docs_for_claude/` participant-data concern in the
caveat below is unrelated to forking and still stands regardless.

---

## The issue in three lines

This repo is public, so every file in it is readable by anyone at
`github.com/mertgurgenyatagi/mertgurgenyatagi.github.io` and
`raw.githubusercontent.com/...`. That includes `FORKING-PLAYBOOK.md` and, once
a fork exists, its handover doc — documents that describe, in plain English,
that the same product is rebranded and pitched to one channel after another.

The **website** was locked down on 2026-08-10 (the Pages deploy now publishes
an allowlist, not the repo). The **repository** was not. Those are two separate
doors.

Deleting the files would not be enough on its own — git keeps every past
version, so old commits still serve them. A real fix means making the repo
private, or splitting source from published output, or rewriting history.

## Why it is being accepted for now

- **No YouTuber has ever accepted a pitch.** Nobody has any reason to be
  looking, and as of 2026-08-22 there is not even a live fork to find.
- **Nothing points at it.** Finding these files means guessing that the repo
  exists, guessing its name, and then guessing a filename. Nobody stumbles into
  a Markdown file in a repo they were never told about.
- **The audience is zero.** Any future fork's site would be live but
  unannounced. Traffic is Mert and whoever he sends a link to.
- **No credentials are exposed.** Firebase web config is public by design —
  it ships inside the client bundle of every site on the internet that uses
  Firebase. There is nothing here to rotate.

The realistic worst case today is one specific person going looking for
evidence, and none of them has any reason to.

## When to fix this

**Fix it before the first channel announces the site to its audience.** That is
the moment the risk changes shape:

- Traffic goes from ~0 to thousands, and some fraction of any audience is
  curious and technical.
- A live product with a real user base attracts people who poke at URLs.
- The cost of being found rises sharply — it stops being "an awkward
  conversation with one person" and becomes something a viewer could screenshot.

Concretely, fix it when **any** of these happen:

1. A channel replies yes, before they post anything publicly.
2. Any link to a site goes anywhere more public than a one-to-one email.
3. Anyone asks about the repo, or you notice traffic you did not send.

## How to fix it, when the time comes

| Option | Cost | Notes |
|---|---|---|
| **Split repos** — private source, CI pushes only built output to a public repo | free | Recommended. Makes the rule structural: notes physically cannot reach the public repo. |
| Make this repo private + GitHub Pro | ~$4/mo | Simplest. Pages needs a paid plan to serve from a private repo. |
| Delete sensitive files and rewrite history | free | Fiddly, easy to get half-wrong. |

Budget roughly half an hour for the split. It is not urgent work, but it is not
five-minute work either — do not leave it until the hour you are trying to
reply to an interested channel.

## One caveat worth keeping honest

The reasoning above is about *pitch secrecy*, and it holds. One item on the
exposed list is a different kind of thing: `docs_for_claude/` contains real
participants' names and their predictions, from the kupatakip friend group.

That is third-party personal data. It has nothing to do with any pitch, those
people never agreed to it being published, and "no YouTuber will look" is not
the relevant test for it. It is also the cheapest thing on this page to fix —
it does not require the repo split, just moving that folder out of the repo and
purging it from history.

Worth doing on its own schedule, independently of everything above.

---

*This file is itself public, which is fine — it names no secrets. Keep it that
way: describe the shape of the problem here, never the contents.*
