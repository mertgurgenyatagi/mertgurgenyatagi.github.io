# irishtable — Handover

**Written:** 2026-08-07, at the end of the session that built it.
**Rewritten:** 2026-08-08, after the frontend was replaced wholesale (§17-§20).
**Audience:** whoever picks this up next, including me with no memory of it.

This is the deep document. `README.md` is the quick orientation; this is the
one that explains *why* things are the way they are, what has already been
tried and rejected, and where the traps are. Where the two disagree, this file
is more detailed but the code is always ground truth.

---

## Table of contents

1. [What this is, in one screen](#1-what-this-is-in-one-screen)
2. [Status right now](#2-status-right-now)
3. [Why it exists, and why the scope is so small](#3-why-it-exists-and-why-the-scope-is-so-small)
4. [Running it](#4-running-it)
5. [Architecture](#5-architecture)
6. [Module by module](#6-module-by-module)
7. [The data layer](#7-the-data-layer)
8. [Scoring, in full](#8-scoring-in-full)
9. [The design system](#9-the-design-system)
10. [Decisions, and what they cost](#10-decisions-and-what-they-cost)
11. [The bugs that actually happened](#11-the-bugs-that-actually-happened)
12. [What is deliberately not built](#12-what-is-deliberately-not-built)
13. [Firebase and infrastructure](#13-firebase-and-infrastructure)
14. [Open items, ranked](#14-open-items-ranked)
15. [Traps](#15-traps)
16. [How this got built](#16-how-this-got-built)
17. [The frontend clone — why, and the framing that made it possible](#17-the-frontend-clone--why-and-the-framing-that-made-it-possible)
18. [How ~90 files ported without being edited](#18-how-90-files-ported-without-being-edited)
19. [Where the clone deliberately diverges from the parent](#19-where-the-clone-deliberately-diverges-from-the-parent)
20. [What the clone deleted, and what replaced it](#20-what-the-clone-deleted-and-what-replaced-it)

---

## 1. What this is, in one screen

**irishtable** is an English-language Premier League prediction game for the
2026/27 season. A participant signs in with Google, answers a five-question
quiz, ranks all 20 clubs from 1st to 20th, picks the winners of the FA Cup and
the Carabao Cup, and names six individual award winners. They're scored against
what actually happens. There's a live chat room and a forum.

It lives in `irishtable/` **inside the `kupatakipucl` repository** but is a
completely separate application: its own `package.json`, `node_modules`, build
config, Firebase project and deploy. **No module is imported across that
boundary in either direction.** Code that came from the parent project came by
copy-and-adapt, never by import.

Run every command from inside `irishtable/`. Running `npm test` at the repo
root runs the *other* project's suite.

**Scale:** 55 source files, ~5,950 lines in `src/`, 90 tests across 10 files.

---

## 2. Status right now

> **The frontend was replaced wholesale on 2026-08-08**, on the branch
> `frontend-clone`. The first build was written *in the style of* kupatakipucl
> rather than copied from it; this one is the real port. §5, §6, §9, §10, §11
> and §15 have been rewritten to match. §17-§20 are new and cover the clone
> itself. Everything about the data layer, scoring, Firebase and scope is
> unchanged and was already accurate.

| Thing | State |
|---|---|
| Frontend | **cloned from kupatakipucl**, 2026-08-08 (§17-§20) |
| Tests | **424 passing**, 48 files |
| `tsc -b --force` | **0 errors** |
| `vite build` | clean |
| Browser pass | 1536×712 and 390×844, every page, zero overflow (§20) |
| Firebase project | `irishtable-app`, Firestore Native in `eur3` |
| Billing | **Spark (free tier)** |
| Google sign-in | **working** — Mert signed in and completed the name step |
| Firestore writes | **working** — see §11.2, this was broken and is now fixed |
| Realtime Database | **live** — `europe-west1`, presence + typing, rules deployed |
| Storage | **not set up** — needs Blaze; photos are switched off |
| Hosting | **GitHub Pages** — live at `https://mertgurgenyatagi.github.io/irishtable/` via CI |

**What has *not* been verified end to end:** the signed-in screens were
checked in a browser through a temporary harness that mounted the
presentational components with fixture props (§20). The component trees are
real, but the **data wiring** on those pages — `LoggedInHome`'s listeners,
`ProfilePage`'s writes, the live prediction submit — has only been exercised by
the test suite. Nobody has walked sign in → quiz → predict → appear in the
participant list against the real backend, not once. That is open item #2 and
it is the single most valuable hour anyone could spend on this next.

**Real data in production:** one profile (`displayName: "asdasd"`, written
2026-08-07 20:07 UTC — Mert's own test), no survey responses, no predictions.
That profile is the proof the write path works; it was written minutes after
the long-polling fix landed.

**A thing that looks like a bug and isn't:** an unauthenticated REST read of
`surveyResponses` returns `403 PERMISSION_DENIED`. That is the rules working
exactly as designed — quiz answers are readable by signed-in users only.
`profiles` and `predictions` are publicly readable and will return data.

### On hosting

The site is hosted on **GitHub Pages** under `https://mertgurgenyatagi.github.io/irishtable/` inside the `mertgurgenyatagi.github.io` repository.

Deployment is fully automated via GitHub Actions (`.github/workflows/deploy.yml`). Pushing changes to the `main` branch automatically installs dependencies (`npm ci`), executes `npm run build`, and publishes the output to GitHub Pages.

Two things support subfolder hosting seamlessly:
- `HashRouter`, so deep links need no server rewrite rules.
- `base: "./"` in `vite.config.ts`, so the build works from a subfolder.

---

## 3. Why it exists, and why the scope is so small

Mert built kupatakipucl for a Turkish friend group following the Champions
League. He wanted the same idea for the Premier League, but his own audience
doesn't follow the Prem closely — so the plan is to pitch it to a football
YouTuber, **The Irish Guy**, and ask whether he'd run it with his audience.

His reasoning, verbatim, and it governs everything:

> *"if I send this to The Irish Guy via email, and tell him like, oh, here, I
> built this thing, are you interested in... and he says no, then I won't need
> to build the rest of it."*

So **only the pre-season phase exists.** Sign up, quiz, predict, chat, forum.
There is no leaderboard, no scoring engine, no results ingestion, no
post-deadline experience. When asked whether to scope the "he says yes" branch
now, he chose: *"Genuinely stop — not started only, don't let the rest of the
build creep into these questions."*

**Hold that line.** The single most likely way to waste effort here is to start
building the league phase because it feels incomplete. It is *deliberately*
incomplete.

### The dates

- **Predictions close:** 21 August 2026, end of day UK time (`2026-08-21T23:59:59+01:00`)
- **Season starts:** 22 August 2026

Both are real, from Mert. The exact closing *time* is my interpretation of
"predictions will close at August 21" — end of that day, which lands before the
first fixture either way. One constant in `src/data/deadlines.ts`.

### It is not the reskin it was originally described as

Intake round 1 said *"Same engine with a few tweaks. Nothing wildly different,
different color scheme and logo is all."* The scoring Mert then wrote is not
that. kupatakipucl scores one way (within 2 places = 3 points, flat). irishtable
has tiered position accuracy, a champion bonus, an order-insensitive relegation
bonus, two cup picks and six award picks. Different data model, different
prediction flow, different UI. Don't let the "it's basically a copy" framing
lead you to expect the parent's shapes.

---

## 4. Running it

```bash
cd irishtable
npm install
npm run dev            # http://localhost:5173 by default
npm test               # 90 tests
npm run build          # tsc -b && vite build
npm run crests         # re-import crests from ../docs/pl-fork/assets/
```

`.env.local` is gitignored and won't exist on a fresh clone. Regenerate it:

```bash
firebase apps:sdkconfig WEB --project irishtable-app
```

then add `VITE_PHOTOS_ENABLED=false`. The Firebase web config is not secret —
it ships in the client bundle by design — it's just environment-specific.

**`npm run dev` alone gets you a fully working logged-out site.** Sign-in needs
the real project, which `.env.local` already points at.

---

## 5. Architecture

A single-page client. No server, no Cloud Functions, nothing to precompute —
there's no leaderboard, which is the only thing the parent needed a server for.

```
<ErrorBoundary>                    catches render crashes
  <AuthProvider>                   Firebase onAuthStateChanged + sign-in
    <ProfileGate>                  blocks everything until profile + quiz exist
      <HashRouter>
        <AppShell>                 forks: DesktopShell | MobileShell
          <Suspense>               all routes but Home are lazy
            /           HomePage           (in the main bundle)
            /about      AboutPage          lazy
            /scoring    ScoringPage        lazy
            /forum      ForumPage          lazy
            /predictions PredictionsPage   lazy
            /profile    ProfilePage        lazy
```

### The fixed viewport

**`html`, `body` and `#root` are `height: 100%; overflow: hidden`.** The page
does not scroll. Anything that genuinely overflows gets its own internal
scroll container — the forum feed, the ranker's slot list, the scoring page,
each popup's body.

This is the parent's model and it is load-bearing, not stylistic. It is what
gives every page below a **definite** height to divide, which is the only way a
composition like Home's four-cell bento can size its cells at all. `min-h-dvh`
cannot do it: a child of an auto-height parent has no percentage to resolve
against, so `flex-1` silently becomes "as tall as my content" and the layout
grows off-screen instead of dividing. Two of the four bugs the browser pass
caught (§11.5, §11.6) are exactly that failure in miniature.

**The first build did the opposite**, deliberately and with a written
rationale — see §10, where the reversal is recorded rather than quietly
overwritten.

### The mobile fork

Below 1024px (`useIsMobile`, matching `(max-width: 1023px)`) the app renders a
**separate tree**, not a reflow:

| Surface | Desktop | Mobile |
|---|---|---|
| Shell | `DesktopShell` — nav bar, account slot | `MobileShell` — hamburger sheet, chat drawer trigger |
| Home, signed out | `HomeLandingLoggedOut` | `MobileHomeLoggedOut` |
| Home, signed in | `HomeLandingLoggedIn` (4-cell bento) | `MobileHomeLoggedIn` (3 stacked frames) |
| Chat | a cell in Home's bento | a right-edge drawer reachable from every page |
| About | two-column poster | vertical stack, vertical timeline |
| Club pool | `TeamGrid` | `MobileClubPool` (crest grid, names under badges) |
| Popups | rendered by each page | hoisted into `MobilePopupHost` in the shell |

The two logged-in Home branches fork one level *deeper* than the others —
inside `LoggedInHome`, after the data fetching — so every listener and handler
is written once and only the layout differs.

`MobilePopupHost` exists because a drawer or a popup opened from the shell has
no page to hold its state. Pages check `isMobile` and route participant/club
taps to the host instead of their own local state; rendering both would give a
phone two competing dialog layers.

### Access control is one boolean

The parent derives an eight-state `VisibilityState` from
`logged-in × four tournament phases`. Here there is one phase, so the entire
model is "are you signed in?" — `src/shell/navLinks.ts` holds the table, and a
test asserts the nav never links somewhere the viewer would be blocked.

Every ported component still carries its `tournamentStarted` prop and **every
call site passes a literal `false`**. Nothing was deleted to make the parent's
components fit; the league-phase branches simply aren't reachable. That is what
keeps a future league phase a matter of flipping a flag rather than
re-porting.

### Bundle shape

Gzipped: `firebase` ~115KB, `react` ~53KB, app ~165KB, CSS ~15KB.
`PredictionSequence` (~22KB, mostly `@dnd-kit` and `motion`) is split out and
loads only when someone actually predicts or edits. Home ships in the main
bundle deliberately — it's the page every link lands on, and a loading flash
there is the first impression.

The main chunk is over Vite's 500KB warning threshold. That is known and not
currently worth chasing: it is one app-sized chunk on a site whose audience
arrives once.

---

## 6. Module by module

### `src/data/` — everything that isn't behaviour

The most important directory. All of it is plain data plus pure functions, all
of it is unit tested, and none of it imports React.

- **`clubs.ts`** — the 20 clubs. Mert supplied both the list and the crest
  SVGs, so this roster is authoritative. **Unlike the parent, crests map to
  their real clubs** (kupatakipucl deliberately hash-assigns wrong badges
  pending a roster swap — that is *not* carried over here).
  Sorted alphabetically by `name`; the ranker seeds from this order so nobody's
  starting position flatters a club. AFC Bournemouth sorts first, on "AFC".
- **`people.ts`** — **⚠️ drafted, not verified.** Player and manager pool. Squads
  predate the season, several entries have certainly transferred, and the three
  promoted clubs (Coventry, Hull, Ipswich) carry literal `PLACEHOLDER` entries.
  It carries a review banner saying so. **This is deliberately the only file
  that needs correcting** — every shortlist derives from it.
- **`awards.ts`** — the eight non-table picks. Shortlists are *derived* from
  `clubs.ts` + `people.ts`, never hand-listed: Golden Glove is the goalkeepers,
  Young Player is the U23s, Golden Boot and Best Playmaker are forwards and
  midfielders, Manager is one per club. Fixing a squad in one place fixes every
  picker.
- **`scoring.ts`** — the rulebook **as data**, plus two pure functions. The
  Scoring page renders from these constants rather than restating them, so the
  page cannot drift from the rules. A future scoring engine imports the same
  constants — which is precisely the maintenance risk the parent carries, where
  `functions/leaderboard` holds a hand-copied duplicate kept in sync by comment.
- **`deadlines.ts`** — one constant and a countdown. Takes an injectable `now`
  so tests never depend on the wall clock.
- **`countries.ts`** — ISO 3166-1, ~195 entries, accent-insensitive search.
  **No flag emoji on purpose:** Windows doesn't render regional-indicator pairs
  as flags, it shows the bare letters, so a flag column would be broken for a
  large share of a general audience.
- **`site.ts`** — the channel name and site name, in one place because they
  appear on two pages and are exactly the kind of thing corrected once and
  missed in the second location.

### `src/auth/`

`AuthProvider` owns sign-in. Note `signInErrorMessage` is exported and tested
separately from the component — see §11.1 for why that matters.

### `src/profile/`

`ProfileGate` blocks the whole app until a signed-in user has **both** a
profile document and a quiz response, rendering `SignupFlow` otherwise.
Deliberately not resumable: closing the tab mid-quiz restarts from the top, and
a half-finished profile is simply overwritten. One forward path, no partial
states to reason about.

`useProfile` also exports `usePlayers`, which carries the parent's hard-won
`fromCache` guard — see §15.

### `src/shell/`

`AppShell` forks immediately into `DesktopShell` or `MobileShell` — see §5.
Neither root carries `bg-background`: the ruled grid is painted on `body`, and
an opaque shell root hides it completely. That exact line, copied faithfully
from the parent, is bug §11.4.

`navLinks.ts` keys the nav off one boolean and orders links Home · Forum ·
Scoring · About, with About last by the parent's convention. There is no Dev
Panel link — there is no phase to override.

`MobileShell` additionally owns `MobileChatDrawer` (a right-edge sheet that
mounts its Firestore and RTDB listeners only while open — chat's are the most
expensive in the app) and `MobilePopupHost`.

### `src/signup/`

The parent's full-viewport animated step machine, ported whole: `AutoAdvance`,
`BounceCheck`, `ChoiceStep`, and `transitions.ts` (`welcomeVariants` for the
one-time welcome scale-up, `sharpVariants` for everything else). A persistent
progress bar sits *outside* the per-step `AnimatePresence` swap so it changes
width rather than resetting between steps.

Order: welcome → photo → name → "you're in" bounce → five quiz questions →
"all set" bounce. Back **steps over** the auto-advancing screens, so one press
always lands on the previous *answerable* step.

Two steps have no parent equivalent:

- **`NameStep`** collects one `displayName`. The parent's locked first + last
  pair feeds a public/private profile split that irishtable has no use for.
- **`CountryStep`** is irishtable's own question — a Turkish project could
  assume where its audience lived. It is the one step whose options can't all
  be on screen (202 of them), so it is the one step with a filter box, in
  `ChoiceStep`'s pill geometry and select-then-confirm rule.

The photo step only exists when `VITE_PHOTOS_ENABLED=true`; when off it drops
out of the step order **and out of the progress denominator**, otherwise the
bar would never reach the end.

`ProfileGate` carries a `completed` latch. Without it the profile listener
lands before the closing checkmark finishes and yanks the overlay away
mid-animation.

### `src/predictions/`

`PredictionSequence` is the whole state machine: intro → table → eight award
pickers → review → done. **Two hosts render it and there is only one of it:**
`/predictions` passes `mode="create"`; ProfilePage's dialog passes
`mode="edit"`, which opens straight on the review with everything seeded. The
parent has two separate implementations of its ranker's host, which is how its
two paths drifted.

Stage is a discriminated position, not a string union with eight near-identical
members — `awardIndex` indexes `AWARDS` directly, which is what lets the review
stage's per-row "edit" jump straight back to one award and return to review
rather than marching through the rest.

The ranker family — `TeamRanker`, `TeamGrid`, `TeamDropList`, `MobileClubPool`,
`RankingList` — is the parent's. Five things in it are worth not undoing:

- **Touch drags activate on press-and-hold** (200ms delay, 8px tolerance), not
  on movement. A distance threshold claims the very gesture the page needs for
  scrolling, making both panels unscrollable the moment a finger lands on a
  club.
- **The slot list is a plain `<li>`, not `<motion.li layout>`.** The layout
  animation re-measured every slot's bounding box on every render — and the
  list re-renders on every pointer move during a drag — while never animating
  anything, since slots are keyed by index and never move. It was the single
  biggest cost in the parent's predictions page.
- **`TeamGrid` cells don't transition `transform`.** Twenty cells each
  animating one put the whole grid on its own compositing layers during a drag.
  Colour and opacity only.
- **Up/down buttons on every filled slot** (Mert's call). They go through
  `moveSlot`, the same primitive the drag path's list-to-list branch calls, and
  a test asserts both produce identical state. The drag listeners sit on the
  grip and crest rather than the whole row — a row-wide drag handler swallows
  every click before a button sees it.
- **`snapCenterToCursor`** centres the drag overlay under the pointer wherever
  the item was actually grabbed.

`AwardPickerStage` and `ReviewStage` have no parent template at all — a table
is kupatakipucl's entire prediction. Both are built out of the flow's existing
idiom rather than a third one. The picker picks its own shape from its own
shortlist size: clubs (24 or fewer) get a crest grid, players (hundreds) get a
filter box.

`predictionBoundary.ts` derives `BOUNDARY_SPAN` from `tablePointsFor()` rather
than hard-coding it — see §19.

### `src/leaderboard/`

Misleadingly named: there is no leaderboard. It holds the two dossier popups
(`ParticipantPopup`, `TeamPopup`), `TeamCrest`, `HeroCarousel` and the ranking
types the popups need. The name is the parent's and was kept so that roughly
fifteen cloned components' imports resolve unedited.

Both popups take `entries={[]}` and `results={{}}` from every call site,
because nothing has been played. Both diverge from the parent — §19, rows 2
and 3.

### `src/home/`

`HomePage` gates the whole page on its own image preload and forks
desktop/mobile. `LoggedInHome` holds every listener once and forks one level
deeper. `HomeLandingLoggedIn` is the four-cell bento at the parent's exact
column ratios (`13.409345fr_14.7953275fr_300px_14.7953275fr` — the hero is
pinned at 300px and Forum and Chat give up the width it gains).

### `src/chat/`, `src/forum/`

Windowed live listeners (50 messages, 200 posts). Replies are posts with a
`parentId` in one flat collection — no real nesting, ever, so a thread is
always two levels deep and costs one filter to render. Likes are denormalised
onto the post and toggled atomically, so there's no read-then-write race.
`searchMessages` keeps the parent's 2,000-message window and its explicit
"the window was full" empty state.

**Presence and typing live in the Realtime Database**, not Firestore — §7.

`chatMentions.ts` carries the one genuine logic fix in the whole port:
`mentionHandle()` strips a `displayName` down to letters, digits and
underscores so it can *be* a mention token. The parent mentions by first name,
always one word; a name here can contain spaces and a mention token cannot.

`forum/threadStats.ts` also owns `replyCountLabel()`. Turkish "yanıt" has no
plural marker, so the parent never needed one and a straight translation
produced "1 replies" — see §11.7.

### `src/mobile/`

`MobileAboutPage` only. The desktop About is a poster, not a responsive
layout, so mobile gets its own screen rather than a reflow of something that
was never meant to bend. Home's mobile pair lives in `src/home/mobile/`
alongside its desktop siblings.

### `src/components/ui/`

shadcn on `@base-ui/react`. `frame` is the workhorse — the two-part mat with a
banded navy header that every widget on the site renders inside.
`responsive-dialog` swaps a `Dialog` for a `Sheet` below 1024px, which is how
the two popups work on a phone without a second implementation.

### `src/lib/`

- **`withTimeout.ts`** — exists because of a real bug. See §11.2.
- **`useDoc.ts`** — single-document live listener. Deliberately does *not* wait
  for a server-confirmed snapshot the way the collection listeners do; a single
  document is atomic, so there's no "some of N" state to get stuck in.
- **`useImagePreload.ts`** — resolves when every URL given has loaded or
  failed. Pages gate their first paint on it so a bento reveals whole instead
  of popping avatars and crests in one at a time.
- **`useIsMobile.ts`** — the single `(max-width: 1023px)` match. Nothing else
  in the app should read a media query directly.
- **`timeAgo.ts`** — guards non-finite and *future* timestamps, because
  `createdAt` is written from the poster's own clock and a skewed device can
  genuinely produce a future value.
- **`compressImage.ts`** — the parent's, taking `maxDimension` and exporting
  `IMMUTABLE_CACHE_CONTROL`. irishtable's original was a 256px square-crop
  avatar helper that could not serve forum images.

---

## 7. The data layer

### Firestore collections

| Collection | Read | Write |
|---|---|---|
| `profiles/{uid}` | public | owner; name ≤20 chars, fields whitelisted |
| `surveyResponses/{uid}` | signed-in | owner, **create only** — no update, ever |
| `predictions/{uid}` | public | owner; `table` must be exactly 20 entries |
| `forumPosts/{id}` | public | owner-attributed create; author edits own text; anyone toggles **only their own** like |
| `messages/{id}` | signed-in | owner-attributed create, own delete, no edit |

Everything else is denied by a catch-all.

**Posture differs from the parent deliberately.** kupatakipucl's rules state an
explicit "trust the friend group, no adversarial threat model" stance and carry
two known holes (`results` and `tournamentState` writable by any signed-in
user) as dev-panel scaffolding. This is a public game with open sign-up, so the
rules assume a visitor may be adversarial, and **there are no temporary holes** —
neither of those collections exists here.

The forum like rule is the only intricate one: it allows an update that changes
`likedByUids` only, and only if the sole difference is the requester's own uid,
in either direction. That prevents liking on someone else's behalf and prevents
wiping the list.

**The rules have been tested for real**, not just eyeballed — through the
Firebase Rules API against the deployed ruleset. The script is described in
§11.2 and is worth re-running after any rules change.

### Storage

`profile-photos/{uid}-{timestamp}` only. No forum images. Every upload gets a
fresh timestamped path so an immutable cache header is always safe: a cached URL
is either current or an orphan, never stale.

**There is no bucket.** Storage needs Blaze.

### Realtime Database

**Reversed on 2026-08-08.** The first build dropped RTDB entirely, reasoning
that a pre-season chat room doesn't need to tell you who's typing, and removed
the SDK to save ~35KB gzipped. The clone put it back, because presence and
typing are part of what makes the parent's chat feel alive and that liveness is
most of the point of a room people sit in for nine months before anything
happens.

Instance `irishtable-app-default-rtdb` in **`europe-west1`**. Two paths, both
readable by any signed-in user:

| Path | Write rule |
|---|---|
| `presence/$uid` | `auth.uid === $uid`, value must be `true` |
| `typingStatus/$uid` | `auth.uid === $uid`, shape `{updatedAt}`, with a **server-side 1s rate floor** |

`database.rules.json` is the parent's file, copied verbatim, and is deployed.
The rate floor is enforced in the rules rather than the client, so a modified
client cannot spam the path.

**Provisioning it took four attempts** and none of them was obvious, so:
`firebase database:instances:create` demands an interactive `firebase init
database` first; the management API returns 403 without a quota project; adding
`x-goog-user-project` returns 403 because the API is disabled; the sequence
that actually works is

```bash
gcloud services enable firebasedatabase.googleapis.com --project irishtable-app
# then the REST POST to the management API
firebase deploy --only database --project irishtable-app
```

---

## 8. Scoring, in full

Mert wrote these rules. `src/data/scoring.ts` is the machine-readable copy.

| Prediction | Points |
|---|---|
| Exact table position | 6 |
| Off by one, either direction | 4 |
| Two or more out | 0 |
| Champion bonus (on top of position points) | +8 |
| Relegation bonus, per club | +2 |
| FA Cup winner | 4 |
| Carabao Cup winner | 4 |
| Young Player of the Season | 3 |
| Best Playmaker | 3 |
| Player of the Season | 2 |
| Manager of the Season | 2 |
| Golden Boot | 2 |
| Golden Glove | 2 |

**Maximum possible score: 156.** (20×6 = 120 table, +8 champion, +6 relegation,
+8 cups, +6 tier-one awards, +8 tier-two awards.) A test asserts both the
number and that it adds up from its parts.

**The relegation bonus is order-insensitive**: a club predicted 18th that
finishes 20th still scores it. Naming all three in any arrangement scores it
three times. This is the rule most likely to be implemented wrongly later.

**Cup winners are picked from the 20 PL clubs only.** A club from outside the
league can genuinely win either cup; if that happens nobody scores it. That's
noted in the page copy rather than modelled.

**No scoring engine exists.** Nothing has been played. When one is written it
must import these constants rather than restating them.

---

## 9. The design system

Mert's brief, assembled across two questionnaire rounds and one direct note:
Premier League colours (*"It's the prem colors. Dark purple and shit."*), the
ruled-grid ground and condensed title face he liked from the intake
questionnaire artifact, Inter for body, and *"I don't want serif"* — which
rules out a serif role anywhere.

**Palette** (`src/styles/colors.css` is the single source of truth):

| Token | Hex | Role |
|---|---|---|
| `--color_main` | `#17021b` | page ground |
| `--color_secondary` | `#26092c` | panels |
| `--color_band` | `#37003c` | the canonical PL purple — nav, header bands |
| `--color_text` | `#f4ecf5` | text, white with a faint purple cast |
| `--color_accent` | `#00ff87` | PL green — CTAs, focus, selection |
| `--color_cyan` | `#04f5ff` | rank 1, counts, "you" markers |
| `--color_remove` | `#e90052` | PL magenta — destructive, relegation places |

Dimmer text, borders and hover fills derive via `color-mix()` off `color_text`.
Single fixed dark theme; the OS setting is never consulted.

**Type:** Oswald Variable for display (titles, rank numerals, column labels,
uppercase eyebrows) and Inter Variable for everything a person reads. Both
vendored via `@fontsource-variable`, so there's no network font dependency.

**The grid ground** is the page background, not a decorative flourish — this is
a league table, so a ruled field *is* the subject. It's at 8% alpha; it was 5%
and read as almost nothing.

**Two inherited conventions:**
- **Cursorify** — the root resets to a default cursor and only genuinely
  interactive elements opt into a pointer. Never an I-beam outside real text
  entry.
- **Non-busyness** — when a page is undecided, cut the element. This is the
  tie-break, not just taste.

**Crests carry a hairline light halo** (`drop-shadow`). Several badges are
near-black or deep navy — Spurs worst of all — and simply disappear into the
purple ground without it. A plate behind all twenty was the alternative and
read as twenty boxes rather than twenty clubs.

### The motion system (2026-08-08)

Everything animates on one curve. `--ease-cotton: cubic-bezier(0.22, 0.61,
0.36, 1)`, declared in `index.css` and re-declared as a literal tuple in the
three files that hand it to `motion` — kept in sync by name, deliberately, so
a CSS keyframe reveal and a `motion` stagger read as one system rather than
two vocabularies.

| Mechanism | Where |
|---|---|
| `cotton-rise` / `cotton-fade` keyframes | frames entering a page, staggered by inline `animationDelay` (60ms, 120ms, 180ms, 240ms across Home's four cells) |
| `motion` stagger | the two hero landings and About — `staggerChildren: 0.09` |
| `welcomeVariants` | one use: signup's welcome message, a near-imperceptible scale-up |
| `sharpVariants` | every other full-viewport stage swap, 1.1s in / 0.6s out |
| `seam-breathe` | the ambient wash |

`useReducedMotion` is honoured on every `motion` tree by starting at the
`visible` variant rather than by disabling the component.

### The Frame vocabulary

Every widget on the site is a `Frame`: a two-part mat with a banded header.
`tone="navy"` gives the header the canonical PL purple, which is how the band
colour reaches the page — **as each cell's header, never as a full-width strip
under the shell's own band**. Stacking two full-bleed bars is the "corporate
masthead" silhouette the parent rejected once already, and it would look
exactly as wrong here.

### Typography roles, after the clone

The parent's three roles map onto irishtable's two faces:

| Role | Face | Used for |
|---|---|---|
| `--font-display` | Oswald Variable | titles, headlines |
| `--font-heading` | Oswald Variable | frame titles |
| `--font-mono` | **Oswald Variable** | eyebrows, meta labels, numerals |
| `--font-sans` | Inter Variable | everything a person reads |

`--font-mono` is *not* a monospace face. The parent uses a mono for its
plaque-engraving voice — uppercase, letterspaced, tabular; Oswald condensed
does that job in this palette and adding a third family for it would have been
a fourth font download for a handful of labels. `.tnum` (`font-variant-numeric:
tabular-nums`) does the actual column-alignment work wherever numbers stack.

---

## 10. Decisions, and what they cost

### ~~Responsive-first, no fixed viewport, no mobile fork~~ — REVERSED 2026-08-08

**This decision no longer holds.** It is kept in full because the reasoning was
sound, the reversal was a *scope* change rather than a correction, and anyone
who reads only the current code will otherwise re-litigate it from scratch.

**What was decided on 2026-08-07.** No fixed viewport, no mobile fork,
responsive-first, with four hard rules: the document scrolls (never
`overflow:hidden` on `html`/`body`/`#root`); hooks return data, never layout;
page compositions live in separate files from the routed page so a later fork
is a one-line change; and no `hidden lg:block` for structural content.

Mert questioned it directly at the time: *"Will it screw us going forward, when
we actually build the league phase, or is it actually the smartest way to go?"*

The reasoning was that what made mobile expensive in the parent wasn't the fork
— it was the **dead zone**: `html/body/#root` pinned to `overflow:hidden` above
1024px, so sub-1024 rendered a fixed-viewport composition inside a scrolling
document, producing three browser-only bugs the test suite could not see.

**Why it was reversed.** Not because the reasoning was wrong, but because the
brief changed. Mert asked for the parent's frontend *exactly*, and the fixed
viewport is not a detail of that frontend — it is the substrate the whole
layout system stands on. Home's four-cell bento divides a definite height;
without one, `flex-1` degrades to "as tall as my content" and the composition
grows off-screen instead of dividing. There is no version of "clone it exactly"
that keeps a scrolling document.

**What that bought and what it cost.** It bought a genuinely faithful clone and
it eliminated the lowest-common-denominator risk the original decision named as
its own downside — each size now gets a composition designed for it. It cost
the thing the original decision was protecting against: **the dead zone is
back, in principle**. The mitigation is that the fork boundary and the viewport
boundary are now the *same* number (1024px, in one place, `useIsMobile`), which
is precisely what the parent got wrong. Rule 4 above still holds and is worth
keeping: no `hidden lg:block` for structural content, ever.

### The parent's league-phase branches were kept, not deleted

Every ported component still carries `tournamentStarted` and every call site
passes a literal `false`. It would have been tidier to strip them. Keeping them
means a future league phase is a matter of threading a real value through
rather than re-porting from the parent a second time — and it means the
divergences in §19 are visible as divergences instead of dissolving into
"that's just how irishtable works".

### One display name, not first + last

The parent collects a permanently locked first and last name, which later forced
an entire `publicProfiles`/`profiles` split so surnames wouldn't leak to
logged-out visitors. A public audience makes that worse and nothing here needs a
legal name. One field, editable, no privacy split to build.

### No phase machine

Eight `VisibilityState`s collapse to one boolean plus one deadline constant.

### Route-level code splitting

Follows through on the mobile-first commitment: `@dnd-kit` and `motion` stay off
the critical path for someone who only reads the landing page.

### The logo is the actual Premier League lion

The design spec reasoned the other way — own wordmark, League colours but not
the League's mark, so it reads as a fan project. What Mert supplied as
`irishtable-logo.svg` is the PL lion, sourced from football-logos.cc. Built as
supplied, because he gave it explicitly and it's his call. Flagged only because
the spec had argued otherwise: a fan project carrying the League's trademarked
mark in its header and favicon is a different risk posture than one wearing only
its colours. One file to swap: `public/brand/irishtable-logo.svg`.

---

## 11. The bugs that actually happened

Seven now. The first three were found by Mert in a real click-through, the last
four by a scripted browser pass — **every one of them after the work had been
reported "verified", and every one of them with a green test suite and a clean
`tsc`.** This is the most useful section in this document.

The pattern across all seven: *the thing that fails is never the thing the
tests are pointed at.* Two are timezone/locale, two are CSS layout, one is an
API contract, one is a swallowed error code, one is a plural.

### 11.1 "Signing in with Google took three tries"

**Cause.** `LoginButton` disabled only during the *initial auth-state load*,
never while a popup was actually in flight. So a second click while the first
popup was opening aborted it with `auth/cancelled-popup-request` — and that
code was being **swallowed silently**. Two clicks produced no popup, no error,
and no change, which is indistinguishable from a dead button, so he clicked a
third time.

**Fix.** A `pending` state that disables the button and shows "Opening Google…".
`auth/popup-blocked` now falls back to `signInWithRedirect` rather than
erroring. Provider-not-enabled and unauthorised-domain say what's actually
wrong. **The only code that stays silent is the user genuinely closing the
popup themselves** — and a test pins that rule, because silent failure was the
entire bug.

**The lesson:** an error nobody can see is worse than an error. `signInErrorMessage`
is exported and tested independently of React for exactly this reason.

### 11.2 "Entered the name. Saving forever."

**This one I got wrong twice, and the wrong turns are the instructive part.**

**First diagnosis (wrong).** Profile photos upload to Firebase Storage; there is
no bucket, because Storage needs Blaze. The SDK doesn't fail fast on that — it
retries on a backoff for a **two-minute default**. That looked like a complete
explanation, and it was even a real problem: my "optional, non-fatal" handling
only kicked in *after* that window expired. So I removed the photo affordance
entirely behind `VITE_PHOTOS_ENABLED` and cut the retry window to 10 seconds.

**It still hung.** Which was the useful result: with the photo path gone, the
hang had to be in the Firestore write itself.

**What I did second, and should have done first — verify before hypothesising:**

- Confirmed the database is **Firestore Native mode** in `eur3` (a Datastore-mode
  database would explain a total failure).
- Tested the **deployed ruleset** through the Firebase Rules API — a real
  evaluation, not a reading of the file. `create` on `profiles/{uid}` and
  `surveyResponses/{uid}` both returned **ALLOW** for an authenticated user.

So the write was permitted and simply never settling.

**The decisive clue.** Reads plainly worked — `ProfileGate` only renders the
signup flow *after* both its listeners have reported, so he couldn't have
reached the name step otherwise. Yet writes never returned.

That asymmetry is the signature of a **stalled WebChannel**. Firestore's
streaming connection opens, something on the network path silently drops its
traffic, reads keep flowing off the already-established stream, and `setDoc`
waits forever on a server acknowledgement that never arrives. **The SDK has no
write timeout**, so nothing ever errors — the promise just stays pending.

**Fix.** `initializeFirestore(app, { experimentalAutoDetectLongPolling: true })`.
The SDK notices a stalled stream and falls back to plain HTTP long-polling,
which such networks pass through fine. Costs nothing on a healthy connection.
Common behind VPNs, corporate proxies, some antivirus and some mobile carriers.

**Confirmed working:** a real profile document was written three minutes after
the fix went in.

**And independently of the cause,** every write in the app now goes through
`withTimeout()` with a 12-second bound, and failures surface the real reason —
a timeout says the connection may be blocked, `permission-denied` says refused,
`unauthenticated` says the session expired, and **an unrecognised code is
printed rather than swallowed**. That last part is what made the original bug
unreportable: there was nothing on screen or in the console for either of us to
go on.

**Three lessons worth carrying:**

1. **A promise with no timeout is a hang waiting to happen.** `setDoc` resolves
   only on server ack and has no bound of its own. Anything user-visible that
   awaits a network promise needs its own deadline.
2. **Verify the environment before theorising about the code.** Database mode
   and a real rules evaluation took two minutes and would have ruled out both of
   my wrong turns immediately.
3. **Reads working while writes hang is diagnostic, not confusing.** It points
   at transport, not permissions — permissions reject, they don't hang.

### 11.3 "Two failures from Mert's first real click-through"

Recorded in commit `e7acc18`. Kept as a line in the count because it is the
same pattern: a real person clicking found what the suite did not.

---

The next four came out of the scripted browser pass at the end of the clone
(§20). All four were green in `vitest` and clean in `tsc -b`. They are grouped
because each is a *class* of failure, not a one-off, and the class is the
useful part.

### 11.4 The ruled grid was invisible — a faithful copy that was still wrong

`AppShell`'s root carried `bg-background`, copied verbatim from the parent.

The parent paints one there because its backdrop lives on a `.ground-radiance`
layer **inside** the shell. irishtable's ruled grid is painted on `body`. So an
opaque shell root sat directly on top of it and hid it completely — and the
background is one of the exactly three things Mert asked to keep.

**The class:** a line copied correctly can still be wrong when what sits
underneath it differs. When porting, the question is never "did I copy this
line" but "does the thing this line assumes still exist here". The token bridge
in §18 is the systematic answer to that question; this was the one place it
didn't reach, because `bg-background` is a real token in both projects and
resolves fine in both. It failed on *stacking order*, which no token can catch.

**How it was found:** not by looking. By dumping `getComputedStyle(body)` and
walking the ancestor chain for anything with a non-transparent background. The
screenshot alone had already been read as "fine" once.

### 11.5 The ranker overflowed its box by 414px

The 20-slot ranker measured **1034px** tall inside a **620px** box. The
instruction line and the whole Reset/Continue footer were clipped away, and
the list appeared to start at slot 5.

**Cause.** Both hosts centre the stage with `items-center` on a
**row**-direction flex. A flex item in a row container gets `height: auto` from
`align-items: center` — it is *not* stretched or bounded by the parent. When I
extracted `PredictionSequence` out of `PredictionsPage` I dropped the parent's
explicit `max-h-[calc(100dvh-5rem)]` and relied on `flex-1` instead, which only
controls height when the parent is a **column**. Fixed with `max-h-full`.

**The class:** `flex-1` and `min-h-0` are not interchangeable with an explicit
bound. In a column they do the job; in a row under `items-center` they do
nothing at all and the failure is silent — the parent's `overflow-hidden` clips
the result, so the page looks *cropped* rather than *broken*, which reads as a
styling choice.

**How it was found:** by walking the DOM chain from the `<ol>` outward,
printing `height`, `scrollHeight`, `clientHeight`, `min-height`, `flex` and
`overflow-y` at every level, and looking for the first ancestor whose child was
taller than itself. That is the measurement worth reaching for first, ahead of
any screenshot.

A second, smaller version of the same thing: the progress bar and back chevron
are absolutely positioned and were sitting **on** the instruction line at both
viewport sizes. Fixed by reserving a `pt-14` chrome band. The parent gets away
without one because its stages are three short sentences with slack to spare.

### 11.6 The About timeline showed "22 Aug" twice

Entries close and season start rendered as the same date.

**Cause.** `formatChipDate` used `getDate()`/`getMonth()`, which read the
**viewer's** timezone. Entries close at `2026-08-21T23:59:59+01:00` — one
second short of midnight. Anywhere east of the UK that is the 22nd, so two
genuinely different instants collapsed onto one label.

**Mert is in UTC+3.** He would have been the first person to see this and the
last person able to explain it, because it is invisible in the source, correct
in every test that runs in UTC, and correct for anyone in the UK.

Now pinned to `Europe/London` via `Intl.DateTimeFormat`, matching what
`formatDeadline()` in `deadlines.ts` already did. Nine tests in
`aboutContent.test.ts` cover it, including the specific 21st/22nd case.

**The class:** any date rendered with a local getter is a bug on somebody's
machine. If the underlying instant is anchored to a timezone — and every date
in this app is anchored to UK football — the formatter has to be too.

### 11.7 "1 replies"

Turkish "yanıt" has no plural marker, so the parent never needed a pluraliser
and a straight translation produced it at three call sites.
`replyCountLabel()` in `threadStats.ts` now owns it.

**The class:** translating *out* of a language with fewer grammatical
distinctions than the target silently drops the distinction. Plurals, gendered
agreement and formality all vanish this way, and none of them typecheck.

### The related near-miss: substring clobbering

Not a shipped bug, but it was one commit away. The forum translation replaced
`" yanıt"` with `" replies"` by plain `str.replace` across 26 files, which also
matched *inside* longer words: `"yanıtlamak"` became `"replieslamak"`, and
`"Henüz yanıt yok."` became `"Henüz replies yok."` — a string that is now
half-translated and no longer matches either language's search.

It was caught by re-reading the verification output rather than the summary
line. The recovery was to re-copy all 26 files clean from the parent and redo
the pass with bounded regex. **Never `str.replace` a UI string** — see §15.

---

## 12. What is deliberately not built

Do not treat any of these as oversights.

- **The entire league phase** — leaderboard, live scoring, results ingestion,
  rank history, stats, anything post-deadline. The parent's components for it
  are *present* and gated behind `tournamentStarted={false}`; nothing computes.
- **A scoring engine.** The rulebook is data; nothing computes with it yet.
- **Special Lobbies.** The parent's invite-only sub-groups with their own chat,
  switcher and management panel. Never part of this pitch, and the single
  largest thing the clone left behind. Where a lobby control used to sit in a
  ported component, the header is simply emptier — that is deliberate rather
  than unfinished, and Home's Players and Chat cells are where it shows.
- **A dev panel.** No phase to override, no fixtures to step through.
- **Cloud Functions.** Nothing to precompute.
- **Forum images.** `ForumImageThumb` ports and will render an existing
  `imageURL`; `PostForm`'s upload stays behind the photos flag, since there is
  no bucket.
- **Profile photos** — built but switched off, see §13.
- **European qualification bands.** `qualification.ts` models champion / mid /
  relegation only. How many PL clubs qualify for what varies by season and this
  project has no source for it, so it is deliberately not guessed at.
- **A custom domain.** Mert: *"a working link is a working link, buy the domain
  only if he says yes."*
- **The pitch email itself.**

### No longer on this list, as of 2026-08-08

Three things the first build listed here are now built, by the clone:

- **Team and participant popups** — both present, both diverging from the
  parent (§19).
- **Presence and typing indicators** — live, on RTDB (§7).
- **A mobile fork** — the shell, both Homes, About and the club pool (§5).

---

## 13. Firebase and infrastructure

Project `irishtable-app`, created via CLI during the build. Firestore Native in
`eur3`. **Spark plan — billing is off.**

### What that costs

| Service | Works on Spark? |
|---|---|
| Auth (Google) | yes |
| Firestore | yes |
| Hosting | yes |
| **Storage** | **no — needs Blaze** |
| **Identity Platform admin API** | **no — needs Blaze** |

Two consequences worth understanding:

**Photos are off.** `VITE_PHOTOS_ENABLED` defaults to false. When false the
signup photo step is skipped entirely and Profile shows a plain avatar with no
upload control — because offering a picker that cannot work is worse than not
offering one (§11.2). To switch on: enable Blaze, set up Storage in the console,
deploy `storage.rules`, set `VITE_PHOTOS_ENABLED=true`. No code changes.

**Enabling the Google provider could not be automated.** The Identity Platform
admin API returns `BILLING_NOT_ENABLED` on a Spark project, so it had to be done
by hand in the console. It has been done. If a second environment is ever set
up, expect the same manual step.

### Deploys

```bash
firebase deploy --only firestore:rules --project irishtable-app
firebase deploy --only database --project irishtable-app    # RTDB rules
firebase deploy --only hosting --project irishtable-app     # ONLY WHEN ASKED
```

There is no CI. Every deploy is a hand-run command.

**Hosting has been deployed exactly once, without being asked, and Mert said
so.** Don't. Work on localhost. The only thing this branch deployed was the
RTDB rules file, which the plan explicitly called for.

---

## 14. Open items, ranked

1. **Review the award shortlists.** `src/data/people.ts` is drafted, not
   verified — transfers, and literal `PLACEHOLDER` entries for Coventry, Hull
   and Ipswich. It's the only file that needs it; everything derives from it.
   **This is still the biggest gap between "works" and "ready to send".**
2. **Walk the happy path once, for real.** Sign in → quiz → predict → appear in
   the participant list, against the live backend, on a real device. As of
   writing one profile exists and **no quiz response or prediction has ever
   been written**. The clone verified geometry and logic; the *data wiring* on
   the signed-in pages has only been exercised by the test suite, because the
   browser pass reached those screens through a fixture harness (§20). Given
   that five of the seven bugs in §11 were found this way and none by a test,
   this is the highest-value hour available.
3. **Mert's Scoring page prose.** He said he'd write the body text. The
   structured rules and a worked example are already on the page.
4. **Hosting on GitHub Pages.** Done — live at `https://mertgurgenyatagi.github.io/irishtable/` via automated GitHub Actions CI workflow.
5. **Storage/Blaze**, if photos matter. Note the clone made photos *more*
   optional, not less: the picker is hidden entirely when the flag is off, in
   signup and on Profile.
6. **The logo question** (§10), if the trademark posture matters.
7. **Landscape phone and tablet are untuned.** Tablets get the phone tree, since
   the fork boundary is 1024px. Deliberate, not designed — and a 1024px-wide
   tablet getting `MobileHomeLoggedIn` is a plausible thing to want to change.
8. **The 17 hero portraits are the parent's**, carried over as-is on Mert's
   instruction ("Copy all 17 as-is for now"). They are Champions League players
   in non-PL kits. Fine for a pitch, wrong for a launch.
9. **The main JS chunk is over Vite's 500KB warning.** Known, not chased.
10. **`DialogClose` logs a `forwardRef` warning** whenever a popup with a close
    button mounts. Inherited — `dialog.tsx` diffs clean against the parent, so
    it is not something the port introduced. React 18 doesn't accept a ref on a
    function component; `Button` would need `forwardRef`.

---

## 15. Traps

**Run every command from `irishtable/`.** `npm test` at the repo root runs the
other project's suite — and worse, `npx tsc -b` at the root **silently
type-checks kupatakipucl and reports success**. A shell that reverts to the
repo root mid-session therefore produces "0 errors" for a project you never
compiled. Several "clean typecheck" results on the clone branch meant exactly
nothing until this was noticed. Check `pwd` first, or confirm the error paths
name files that exist here.

**`npm test` does not typecheck.** Vitest transpiles without type-checking, so
`tsc -b` catches things the suite can't. A test-file type error slipped through
exactly this way during the build. Run both.

**A green suite doesn't prove a loading fix.** Render-timing and Firestore
`fromCache` behaviour don't reproduce in jsdom. Anything touching a live
listener needs a real browser at a real viewport. The parent logged this five
times and it held here too.

**`innerText` reflects CSS `text-transform`.** A scripted browser check asserted
`includes("Check it over")` against a heading rendered uppercase and reported a
failure that wasn't real. Use `textContent` for assertions. *The app was right
and the measurement was wrong* — assume that's possible before "fixing"
anything.

**Collection listeners must ignore cache-only snapshots.** `usePlayers`,
`useMessages` and `usePosts` all skip snapshots where `metadata.fromCache` is
true until the first server-confirmed one arrives. Another listener on
`profiles/{me}` primes Firestore's watch cache, so a collection listener can
receive a fast partial snapshot containing only the viewer's own document —
releasing the loading gate on that paints a one-person list that then pops to
fifty. Single-document listeners are exempt: a lone doc is atomic.

**Don't restate a scoring number in copy.** Import it from `src/data/scoring.ts`.
The whole point of the rules-as-data shape is that the page cannot drift.

**The award shortlists are derived, not listed.** To change who's eligible for
Golden Glove, change a player's `position` in `people.ts` — don't hand-edit a
list in `awards.ts`.

**`CLUBS` order is load-bearing.** The ranker seeds from it. It's alphabetical
by `name` and a test enforces that; it was ordered by `id` at first, which put
AFC Bournemouth in the wrong place and would have given every entrant a subtly
wrong starting alphabet.

---

The rest came out of the clone, 2026-08-08.

**Turkish is not always accented.** A sweep keyed on diacritics missed
`"Sohbette ara"` — pure ASCII Turkish — and it survived a fully green test run.
Extract strings by **position** (JSX text nodes, `aria-label`, `placeholder`,
error sinks), never by character class. And watch for multi-line JSX text: a
single-line `>text<` regex misses a string sitting alone on its own line, which
is how `"Tahminini Yap"` survived a second pass.

**Never `str.replace` a UI string.** `" yanıt"` → `" replies"` also matched
inside `"yanıtlamak"`. Use bounded regex, and **assert the search string is
present before writing** — every scripted patch on this branch does. One silent
no-op is how the parent shipped a 2439px block inside a 787px viewport.

**A width override on `DialogContent` must carry the `sm:` prefix.**
`DialogContent`'s own base class ends in `sm:max-w-sm`, which is emitted *after*
any unprefixed `max-w-*` in the stylesheet — so `max-w-5xl` never applies above
640px and the dialog silently renders at ~384px. This made the parent's 36-club
ranker unusable for weeks. `ProfilePage`'s edit dialog uses
`sm:max-w-[1344px]`.

**`flex-1` is not a height bound in a row.** A flex item under
`align-items: center` in a **row** container gets `height: auto` and will
happily grow past its parent, which then clips it — so the page looks cropped
rather than broken. Use an explicit `max-h-*`. This is §11.5 and it is the
single easiest layout mistake to make in this codebase, because every
full-viewport stage host is exactly that shape.

**Never format a date with `getDate()`/`getMonth()`.** Every date in this app
is anchored to UK football time; a local getter reads the viewer's timezone and
silently produces a different day. Pin `timeZone: "Europe/London"`. §11.6.

**Measure block heights, don't look at screenshots.** A screenshot of §11.5 was
read as "fine" once. Walk the ancestor chain printing `height`, `scrollHeight`,
`clientHeight`, `min-height`, `flex` and `overflow-y`, and assert
`scrollHeight === clientHeight` on `documentElement`. The measurement finds it;
the eye does not.

**The parent is ground truth for layout, not for copy.** When something in a
ported component looks wrong, diff it against `../src/` before rewriting it —
several "bugs" during the port were faithful copies working correctly. But the
reverse also holds: §11.4 was a faithful copy that was genuinely wrong, because
what it assumed underneath had changed. Diff first, then ask what the line
depends on.

---

## 16. How this got built

One session, 2026-08-07.

Two questionnaire rounds first, through a browser artifact — the house style
for this repo. Round 1 established the shape (fork the engine, new colours and
logo, the name "irishtable", a Scoring tab, keep the editorial tone, real
dates). Round 2 went concrete and Mert cut it short:

> *"We don't really need these lateral questions. This is basically a copy of
> kupatakipucl."*

Worth internalising: **the vague, playful, many-round questionnaire pacing that
suits a greenfield design does not suit a fork.** For a derivative project the
visual identity is mostly inherited and there's no blank-canvas ambiguity to
draw out, so mood-board questions read as padding. Go concrete.

He then handed over the quiz questions and the full scoring system as written
text, granted full autonomy (*"You're an AI, you're smart... If you have any
questions, use the QA tool"*), and later: *"Do not prompt me again until
everything is totally done. If you are unsure about data at any point, use
placeholders. If you are unsure about implementation, use your own judgement."*

Four questions were asked via the QA tool before building: how award picks work
(curated shortlists), where the club list comes from (he supplied clubs and
crests), how much of the account surface to port (minimal profile, no lobbies),
and who creates the Firebase project (me, via CLI).

Then the build, then two rounds of real-world bug reports (§11) — both of which
found things no amount of automated testing had, which is the pattern this
project's parent has now logged six times.

### Session two, 2026-08-08: the frontend clone

A second session, on the branch `frontend-clone`, fourteen commits. It exists
because of one message:

> *"Here is what I like about it: 1. The color palette 2. The fonts 3. The
> background — These were all the things (and the only things) that I
> explicitly told Claude to change while directly cloning from kupatakipucl's
> frontend. Here is what I don't like about it: 1. Pretty much everything else
> — The reason for this is simple: **It didn't clone it. It recreated it, or
> rather mirrored it.** However, the layout, the animations, everything was
> very optimized and to my liking in kupatakipucl. [...] Just copy
> kupatakipucl's frontend exactly, while only changing the three things above.
> Seriously. As direct a clone as possible."*

That diagnosis is exactly right and worth sitting with, because the first
session did nothing wrong by its own lights. It read the parent, understood
the design language, and wrote irishtable **in that language**. The result was
coherent, tested, and not the thing that was asked for. *Understanding a design
well enough to reproduce its logic is not the same as copying it*, and when
someone says "clone", they mean the second thing.

The practical lesson for a fork: **copy the file, then change what must
change.** Do not read the file and write an equivalent one. The parent's
files carry a decade of small corrections in their class lists and their
comments — the `<li>` that isn't a `<motion.li>`, the transition list that
omits `transform`, the `sm:` on a max-width — and every one of those is lost by
paraphrase and invisible in review.

Process for the session: brainstorm → spec (14 numbered decisions, a token
bridge table, a ~90-file port inventory) → plan (13 tasks in dependency order)
→ build task by task, committing each. Mert answered fifteen design questions
up front, then granted full autonomy: *"Proceed. Do not prompt me until
everything is done (including implementation)."*

Two things about that intake are worth repeating: he explicitly lifted the
question limit (*"You can ask 10 questions if you want. There's no limit to
this"*), and for a **fork** the right question style is concrete and
functional, not the vague/playful pacing that suits a greenfield design —
same lesson as round 2 of session one, learned again.

---

## 17. The frontend clone — why, and the framing that made it possible

**Branch:** `frontend-clone`, 14 commits, merged intent.
**Spec:** `../docs/pl-fork/specs/2026-08-07-irishtable-frontend-clone-design.md`
**Plan:** `../docs/superpowers/plans/2026-08-07-irishtable-frontend-clone.md`

Three things were kept from the first build and nothing else: the **colour
palette**, the **fonts**, and the **background**. Everything else on screen is
now kupatakipucl's.

### The framing that made ~90 files tractable

**irishtable's entire app is kupatakipucl's `notstarted` VisibilityState
slice.**

That one sentence is what turned an intimidating port into a mechanical one.
The parent has an eight-state visibility matrix crossed with a four-phase
tournament machine; irishtable is permanently pre-season by design. So for any
component in the parent, the question "what does this look like in irishtable?"
has a single answer: *whatever it looks like when `tournamentStarted` is
false*. No judgement required, no design work, no risk of drift.

The corollary is that **nothing was deleted to make the parent's components
fit**. Every one still carries its `tournamentStarted` prop; every call site
passes a literal `false`. The league-phase branches are present and
unreachable. That is what makes a future league phase a matter of threading a
real value through rather than porting from the parent a second time.

### What that framing did *not* solve

Two places where a literal copy would have shipped a permanently empty screen,
because the parent gates a whole widget on `tournamentStarted` and irishtable
never flips it. Those became deliberate divergences — §19, rows 2 and 3. The
framing tells you what a component looks like; it doesn't tell you whether
that's a screen worth shipping.

---

## 18. How ~90 files ported without being edited

Two shims. Between them, roughly ninety cloned files resolve their imports
unchanged, which is the difference between a port and a rewrite.

### The token bridge — `src/styles/colors.css`

The parent's components reference the parent's token names. Rather than edit
ninety files, `colors.css` aliases them onto irishtable's palette:

```css
--color_green:         var(--color_accent);
--color_gold:          var(--color_cyan);
--color_qualification: var(--color_cyan);
--color_idk:           var(--color_scrim);
--color_hover:         #ffffff;
--color_pitch:         #0b5f38;
--color_statsbar:      var(--color_accent);
```

**`--color_blob1/2/3` and `--color_faintglow` are deliberately NOT defined.**
They belong to the parent's `DustHaze` and `.ground-radiance`, neither of which
is carried over — the ruled grid is already the background and stacking a
radiance on a ruled field is two competing textures. Leaving them undefined
means a stray reference renders visibly wrong instead of quietly transparent.
That is the bridge doing double duty: it ports what should port and traps what
shouldn't.

### The name shim — `src/predictions/teams.ts`

The parent keeps its 36 Champions League teams in `predictions/teams.ts` and
roughly fifteen components import `TEAMS`, `TEAM_BY_ID` and `teamCrestSrc` from
that path. This module re-exports `src/data/clubs.ts` under those names.
`clubs.ts` stays the single source of truth; nothing here adds data, it only
renames.

`src/leaderboard/` is the same trick at directory scale — the name is kept
purely so imports resolve, even though there is no leaderboard in it.

### What the bridge could not catch

`bg-background` on the shell root (§11.4). It is a real token in both projects
and resolves correctly in both. It failed on *stacking order*, which no
aliasing scheme can see. Worth remembering when the next port feels safe
because the tokens all resolve.

---

## 19. Where the clone deliberately diverges from the parent

Nine places. Each is a decision with a reason, not an omission — and each is
somewhere a future reader would otherwise "fix" the code back toward the parent
and break something.

| # | Divergence | Why |
|---|---|---|
| 1 | **`mentionHandle()`** strips `displayName` to one token | The parent mentions by first name, always one word. irishtable has one `displayName` that can contain spaces, and a mention token cannot contain one. The only genuine logic fix in the port. |
| 2 | **`ParticipantPopup`'s quiz answers are ungated** | The parent gates every widget on `tournamentStarted` together. In a permanently pre-season app that leaves the popup showing a name and two empty boxes *forever*. Quiz answers aren't predictions and the deadline has no bearing on them. **The predicted table stays gated** — that one really is secret until the deadline, and ungating it would let entries be copied. |
| 3 | **`TeamPopup` shows the real squad; the pitch diagram is gone** | The parent invents both a formation and an XI with a seeded PRNG — its own comment calls it "dummy squad data". Nothing has been played here, so there are no scorers to rank. The three fabricated stat lists are replaced with the club's actual squad from `people.ts`, grouped by position. |
| 4 | **Up/down buttons on every filled ranker slot** | Mert's call. Dragging twenty clubs into place is fine once and miserable when you only want to swap 7th and 8th. They route through `moveSlot`, the same primitive the drag path calls, and a test asserts both produce identical state. Drag listeners moved off the row onto the grip and crest, since a row-wide handler swallows every click. |
| 5 | **`MobileClubPool` is a crest grid with names under the badges** | The parent falls back to a plain text list on mobile for two reasons, *neither of which holds here*: its crests are deliberately hash-assigned to the wrong clubs pending a roster swap, and its names live in a 750ms **hover** tooltip that a touchscreen never fires. irishtable's crests are Mert's own and each is on its real club. Mert chose the grid explicitly. |
| 6 | **`BOUNDARY_SPAN` is derived, not hard-coded** | The parent's literal `2` matches its "within 2 places" rule. irishtable pays 6 exact / 4 off-by-one / 0 beyond, so the band is one row. `predictionBoundary.ts` computes it from `tablePointsFor()`, so the intro diagram, the ranker's hover bracket and the rulebook cannot disagree. |
| 7 | **`AwardPickerStage`, `ReviewStage`, `ScoringPage`, `CountryStep`** | No parent template exists for any of them — a table is kupatakipucl's whole prediction, its scoring is one sentence inside the intro, and a Turkish project could assume where its audience lived. All four are built in the cloned idiom rather than inventing a fifth one. |
| 8 | **One `PredictionSequence`, two hosts** | The parent has two separate implementations of its ranker's host — a page and a dialog — which is precisely how its two paths drifted. `/predictions` renders `mode="create"`; ProfilePage's dialog renders `mode="edit"`, opening on the review with everything seeded. |
| 9 | **`displayName` editable; rank and points gone from the profile card** | The parent locks the name because its first/last split feeds a public/private profile divide that doesn't exist here. And nothing has been played, so a rank would be noise — the deadline is the only status this page can honestly report. |

Two smaller ones worth knowing: `qualification.ts` models champion / mid /
relegation and deliberately does not model European places (no source for how
many PL clubs qualify for what); and every scoring figure in copy is
interpolated from `scoring.ts`, with tests asserting it, where the parent's
equivalent files hard-code theirs.

---

## 20. What the clone deleted, and what replaced it

### Deleted outright

`PredictionFlow.tsx` · `TableRanker.tsx` · `StepShell.tsx` · `ChoiceList.tsx` ·
`PostCard.tsx` · `CrestBand.tsx` · `CountdownStrip.tsx` ·
`components/ui/{panel,blocked,crest,deadline-passed,searchable-list,table}.tsx`

Everything the first build wrote to stand in for a parent component it hadn't
copied. `ui/table.tsx` went last, as dead weight — it was ported in good faith
and nothing ever imported it, because irishtable has no standings table.

### Added

Roughly ninety files, listed in the spec's port inventory. The load-bearing
ones: the whole `shell/` directory, `components/ui/frame`, the ranker family,
the signup step machine, `PredictionSequence`, both popups, the full chat with
RTDB, the entire forum, and the mobile tree.

### Verification, as measured

```
cd irishtable
npx tsc -b --force   → 0 errors      (first time on this branch)
npx vitest run       → 424 passed, 48 files
npm run build        → clean
```

Browser pass at **1536×712** and **390×844** across the landing page,
`/scoring`, `/about`, the signed-in Home bento, the forum, and every stage of
the prediction sequence. `scrollHeight === clientHeight` on `documentElement`
at both sizes on every page, and block heights were **measured** — walking the
ancestor chain — rather than eyeballed from screenshots. That is what caught
§11.5, which a screenshot had already been read past once.

### The harness, and what it does not prove

The signed-in screens cannot be reached headlessly — sign-in needs a Google
popup. They were reached through a temporary `#/harness` route that mounted
`HomeLandingLoggedIn`, `MobileHomeLoggedIn`, `PredictionSequence` and `Forum`
directly with fixture props. It faked nothing about Firebase: those components
already take their data as props, so what rendered was the real component tree.
The route and its file were removed before the final commit.

**What that proves:** layout, geometry, motion, copy, and every interaction
that lives inside a component — including that the up/down buttons reorder and
disable correctly, and that the review's per-row edit returns to review.

**What it does not prove:** that the data wrappers above those components work.
`LoggedInHome`'s listener composition, `ProfilePage`'s writes, the real
`savePrediction` round-trip and the `ProfileGate` handoff have been exercised
by the test suite and by nothing else. Five of the seven bugs in §11 were found
by someone actually clicking. See open item #2.

### Nothing was deployed

Hosting is untouched. The only thing that went out was `database.rules.json`,
which the plan called for.
