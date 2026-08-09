# Forking the prediction game for another YouTuber

**Written:** 2026-08-09, immediately after doing it for the first time
(`irishtable` → `zealandtable`).
**Audience:** whoever runs the next fork, including me with no memory of it.

This is the repeatable procedure for standing up the same Premier League
prediction game under a new name, pointed at a new channel, without disturbing
any fork that already exists. It is written to be followed top to bottom.

**Time:** about 30 minutes of work, plus ~3 minutes of CI. Two of the steps
need a human in a browser and cannot be automated — §6.

**Cost:** £0. Each fork is a separate Firebase project on the free Spark plan.

---

## 0. The strategy this serves

Mert builds the site *first*, then cold-emails the channel. Nobody has replied
yet, so the working assumption is that most won't. That makes two properties
matter more than anything else:

1. **Every fork stays alive.** A channel that ignores the email this year might
   look next year. Never edit an existing fork to serve a new one — copy it.
2. **The recipient must not be able to tell it was built for someone else
   first.** This is why the checklist below goes past the visible wordmark into
   the page title, the logo *filename*, and the localStorage key.

If those two hold, forks are cheap and independent, and pitching six channels
costs about as much as pitching one.

---

## 1. Pick the source fork

Fork from whichever existing fork is **most current**, not necessarily the
first one. Check before copying:

```bash
git log --oneline -3 -- irishtable/
git log --oneline -3 -- zealandtable/
```

Fixes tend to land in whichever fork was being worked on, and they do **not**
propagate — there is no shared code. If the forks have diverged in behaviour
(not just branding), diff them and decide deliberately which base you want:

```bash
diff -r irishtable/src zealandtable/src
```

A clean fork should show *only* the branding differences listed in §3. Anything
else is drift that you are about to inherit.

---

## 2. Copy the tree

Set your names once:

```bash
SRC=irishtable                  # the fork you're copying
NEW=welshtable                  # new folder / site name, lowercase
CHANNEL="The Welsh Guy"         # exact channel name, as it should appear
PROJECT=welshtable-app          # Firebase project id, globally unique
```

Copy **from git, not from the filesystem**:

```bash
mkdir -p $NEW
git archive HEAD:$SRC | tar -x -C $NEW
```

This copies the *tracked tree only*. It is the whole reason no `node_modules`,
`dist`, `.firebase`, `*.tsbuildinfo` or — critically — `.env.local` comes
across. **Do not use `cp -r`**: it would drag the source fork's production
Firebase credentials into the new folder, and signups on the new site would
land in the old site's database.

Confirm the count matches, and that the source is untouched:

```bash
find $NEW -type f | wc -l          # should equal:
git ls-files $SRC/ | wc -l
git status --porcelain $SRC/       # must print nothing
```

---

## 3. The rebrand checklist

This is the complete list, derived by grepping rather than by memory. The
original plan for zealandtable listed four items and **missed four more**, each
of which would have shipped — so work the list, don't improvise.

### 3.1 Copy and wordmarks

| File | Change |
|---|---|
| `src/data/site.ts` | `SITE_NAME` → `#$NEW`, `CHANNEL_NAME` → `$CHANNEL` |
| `src/shell/AppShell.tsx` | wordmark `#OLDNAME` → `#NEWNAME` (uppercase) |
| `src/shell/MobileShell.tsx` | same |
| `src/signup/steps/WelcomeStep.tsx` | bold span — the name is split, bold prefix + regular `table — welcome.` |
| `src/home/HomeLandingLoggedOut.tsx` | credit sentence, hardcoded |
| `src/home/mobile/MobileHomeLoggedOut.tsx` | credit sentence, hardcoded |

`CHANNEL_NAME` and `SITE_NAME` auto-propagate to `aboutContent.ts`,
`AboutPage.tsx` and `MobileAboutPage.tsx`, which interpolate rather than
hardcode. **The credit sentence does not** — it is a literal string in two
files and needs its own edit in each.

### 3.2 The four that get missed

1. **`SITE_NAME`** — easy to change only `CHANNEL_NAME` and miss this. It
   renders on the About page and as the logo `alt`.
2. **`index.html`** — `<title>`, `og:site_name`, `og:title`, `twitter:title`,
   and the favicon `href`. A pitch email is a *link*, so the Open Graph preview
   is one of the first things the recipient sees. Highest-visibility miss.
3. **`src/lib/sessionCache.ts`** — the localStorage `PREFIX`. **Not
   cosmetic.** Every fork is served from `mertgurgenyatagi.github.io`, so they
   all share one origin and one localStorage. Two forks with the same prefix
   read and write each other's cached data in the same browser.
4. **The logo filename** — `public/brand/OLDNAME-logo.svg`. The path is visible
   in the DOM and the network tab. Rename the file and update all five
   references plus the favicon.

> **Generalise #3:** anything keyed by origin collides between forks —
> localStorage, sessionStorage, IndexedDB, cookies, service workers. Grep for
> storage keys on every fork.

### 3.3 Assets and config

| File | Change |
|---|---|
| `public/brand/OLDNAME-logo.svg` | rename to `$NEW-logo.svg` |
| `src/shell/AppShell.tsx`, `MobileShell.tsx`, `pages/AboutPage.tsx`, `mobile/MobileAboutPage.tsx`, `profile/deletedAccount.ts` | logo path ×5 |
| `index.html` | favicon `href` |
| `scripts/import-crests.mjs` | `BRAND_MAP` output filename |
| `package.json`, `package-lock.json` | `name` field |
| `.firebaserc` | `$PROJECT` |
| `README.md` | channel, fork relationship, live URL |

**`vite.config.ts` needs no change.** `base: "./"` is already relative, which
is what makes subfolder hosting work for any fork without a build edit.

### 3.4 Inside jokes and per-fork content

The `season → susan` glitch (`src/components/ui/GlitchSeason.tsx`) was an
irishtable in-joke and was **cut entirely** for zealandtable — component
deleted, all five call sites replaced with plain text. Check whether the source
fork carries anything similar before copying it into a pitch for someone who
won't get the joke.

If it is present, the call sites are `HomeLandingLoggedOut`,
`MobileHomeLoggedOut`, `AboutPage` (×2) and `AwardPickerStage`. In
`AwardPickerStage` the whole `label.includes("Season")` ternary collapses to
`{award.label}` — output is identical because `.type-display` is
`text-transform: uppercase`.

### 3.5 What to leave alone

Internal code comments and test fixtures naming earlier forks
(`kupatakipucl`, `irishtable`, `"The Irish Guy"` as a display-name fixture).
They are dev-facing, unreachable from the deployed site, and rewriting them is
churn that risks breaking tests for zero pitch benefit.

Carry the handover doc across and rename it, but **do not rewrite its history**
— it documents how the codebase works and stays accurate through a branding-only
fork. Add a fork section at the end instead.

---

## 4. Firebase

Every fork gets its **own project**. Never share one.

```bash
firebase projects:create $PROJECT --display-name "$NEW"
firebase apps:create WEB $NEW --project $PROJECT
# note the App ID it prints
```

Enable the APIs. **This must run outside the agent sandbox** — `gcloud` cannot
reach `serviceusage.googleapis.com` from inside it even though DNS resolves,
and the failure looks like a DNS error rather than a permissions one:

```bash
gcloud services enable \
  firestore.googleapis.com \
  firebasedatabase.googleapis.com \
  identitytoolkit.googleapis.com \
  --project $PROJECT
```

Firestore — match the existing forks' region:

```bash
firebase firestore:databases:create "(default)" --location eur3 --project $PROJECT
```

Realtime Database. `firebase database:instances:create` **fails on a fresh
project** ("run `firebase init database`", which is interactive). Use the REST
API, and note the `x-goog-user-project` header — without it the call fails as
`SERVICE_DISABLED`, which misleadingly sends you off enabling an already-enabled
API:

```bash
TOKEN=$(gcloud auth print-access-token)
curl -sS -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-goog-user-project: $PROJECT" \
  -H "Content-Type: application/json" \
  -d '{"type":"DEFAULT_DATABASE"}' \
  "https://firebasedatabase.googleapis.com/v1beta/projects/$PROJECT/locations/europe-west1/instances?databaseId=$PROJECT-default-rtdb"
```

Write the config and deploy the rules:

```bash
firebase apps:sdkconfig WEB <APP_ID> --project $PROJECT   # → .env.local
cd $NEW && firebase deploy --only firestore:rules,database --project $PROJECT
```

`.env.local` format — add `VITE_PHOTOS_ENABLED=false`, which
`apps:sdkconfig` does not emit:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=$PROJECT.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=$PROJECT
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_STORAGE_BUCKET=$PROJECT.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_PHOTOS_ENABLED=false
VITE_FIREBASE_DATABASE_URL=https://$PROJECT-default-rtdb.europe-west1.firebasedatabase.app
```

---

## 5. CI deploy

Two edits to `.github/workflows/deploy.yml`:

1. A **build step** — `cd $NEW`, write `.env` via heredoc, `npm ci`,
   `npm run build`. Copy the existing one.
2. A line in the **assemble step**:

   ```bash
   mkdir -p _site/$NEW && cp -r $NEW/dist/* _site/$NEW/
   ```

Also add the new lockfile to `cache-dependency-path`.

**Folder name and published path need not match.** `irishtable/` publishes to
`/theirishtable/`, because a pitch email sent to a *different* channel contains
a hyperlink to `/irishtable/` and email cannot be recalled — that path is burned
forever and serves a neutral 404. If you ever send a wrong link, the fix is a
new path, never reusing the old one. See `ZEALANDTABLE_HANDOVER.md` §22.

**Update the publish guard** when you add a fork: it asserts that no fork's
bundle contains another's branding, and it needs to know about yours.

> ### ⚠️ Never publish the repo
>
> The workflow assembles an explicit allowlist into `_site/` and uploads only
> that. **It must stay that way.** It previously used
> `upload-pages-artifact` with `path: '.'`, which served every tracked file
> publicly — both handovers, this playbook, all application source, and
> participants' real names and predictions. That went unnoticed for months.
> The full account is in `zealandtable/ZEALANDTABLE_HANDOVER.md` §22.
>
> Copy **`dist/` only**, never the project folder. If you ever find yourself
> writing `path: '.'` or `cp -r $NEW _site/`, stop.
>
> There is a verification step that fails the build if a handover, this
> playbook, any `src/` or the predictions folder reaches `_site/`. **Add your
> new fork's private paths to it.**

The Firebase web config goes in the workflow **in plaintext, deliberately**. It
is not secret — it ships in the client bundle by design. Do not move it to
repository secrets; you will only make it harder to debug.

**Every push to `main` rebuilds every fork.** CI time grows linearly with the
number of forks, and a build break in one fails the deploy for all of them. At
four or five forks, consider a path filter.

---

## 6. The two manual steps

**These cannot be automated on the free tier.** The Identity Platform admin API
returns `BILLING_NOT_ENABLED : Identity Platform feature requires billing to be
enabled` on Spark. This is a real platform limit — it was hit on irishtable,
and re-confirmed on zealandtable. Budget for it; don't burn time looking for a
CLI flag.

In the Firebase console for the new project:

1. **Authentication → Sign-in method → Google →** Enable, set a support email.
2. **Authentication → Settings → Authorized domains →** add
   `mertgurgenyatagi.github.io`.

Miss (2) and sign-in works on localhost but fails **only in production** with
`auth/unauthorized-domain`.

Verify both by API rather than trusting that the clicks landed:

```bash
TOKEN=$(gcloud auth print-access-token)
curl -s -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/config" \
  | grep -o '"authorizedDomains":\[[^]]*\]'
curl -s -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/defaultSupportedIdpConfigs" \
  | tr -d '\n' | grep -o '"enabled": *[a-z]*'
```

---

## 7. Verify before you ship

Local:

```bash
cd $NEW && npm install && npm run build && npm test
```

Expect a clean `tsc -b` and a full green suite. `tsc -b` is the check that
catches leftover imports from anything you deleted — the test suite alone will
not.

**If exactly four test files fail at import** with `auth/invalid-api-key` and
zero individual tests fail, you are missing `.env.local` — `src/firebase.ts`
calls `getAuth()` at module load. That is not a regression.

Audit the diff against the source fork. It should contain the §3 list and
nothing else:

```bash
diff -r $SRC/src $NEW/src
```

After deploying, verify the **served bundle**, not just your working tree —
this catches a CI step that silently used the wrong `.env`:

```bash
curl -s https://mertgurgenyatagi.github.io/$NEW/ -o /tmp/p.html
JS=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' /tmp/p.html | head -1)
curl -s "https://mertgurgenyatagi.github.io/$NEW/$JS" -o /tmp/p.js
for s in NEWNAME OLDNAME "$CHANNEL" "Old Channel" $PROJECT oldproject-app; do
  printf "%-24s " "$s"; grep -qF "$s" /tmp/p.js && echo PRESENT || echo absent
done
```

New name and project **present**; old name and old project **absent**.

Then confirm every *previous* fork is still serving what you expect — this is
the whole point of forking rather than editing:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://mertgurgenyatagi.github.io/theirishtable/
```

### Confirm nothing private is public

**Run this every time.** It is the check that was skipped for months:

```bash
for u in "$NEW/README.md" "$NEW/src/data/site.ts" "FORKING-PLAYBOOK.md" \
         "$NEW/${NEW^^}_HANDOVER.md" "docs_for_claude/list_of_participants.txt"; do
  printf "%-46s " "$u"
  curl -s -o /dev/null -w "%{http_code}\n" "https://mertgurgenyatagi.github.io/$u"
done
```

**Every one must be 404.** A `200` anywhere means the artifact is publishing
the repository again — stop and fix the workflow before sending any email.

### Check the link you are about to send

Trivial, and skipping it caused a live incident (`ZEALANDTABLE_HANDOVER.md`
§22): a pitch email went out whose visible text said `/zealandtable/` while the
hyperlink behind it still pointed at `/irishtable/`, copied from the previous
pitch.

Before sending, in the actual email client:

1. **Click your own link.** Do not read it — click it. Confirm the address bar
   lands on `/$NEW/` and the page shows the right wordmark.
2. Check the **hyperlink target**, not just the text. Pasting a URL over an
   old one often keeps the old href.
3. Send yourself a copy first if the client makes hover-inspection awkward.

---

## 8. Still on you, every time

Automation gets you a correct, deployed, empty site. It does not get you a
pitch. After every fork:

- **Sign in once, for real.** Walk sign in → quiz → predict → appear in the
  participant list against the new project. Config verified by API proves it is
  *configured*, not that it *works*. This has never been done on zealandtable.
- **Write and send the email.** The site is not the deliverable.
- **Reconsider the shared assets.** Every fork currently ships the same
  Premier League lion logo and the same 17 inherited hero portraits (Champions
  League players in the wrong kits). Fine for a pitch, wrong for a launch, and
  a genuinely distinct logo is the one branding change this playbook cannot
  automate.
- **Consider whether the joke lands.** Per-channel in-jokes are a good idea and
  a per-fork decision (§3.4).

---

## 9. Quick reference

| Thing | Answer |
|---|---|
| Copy command | `git archive HEAD:$SRC \| tar -x -C $NEW` |
| Files that change | ~18, all listed in §3 |
| Build config change | none — `base: "./"` handles it |
| Firebase projects | one per fork, never shared |
| Firestore region | `eur3` |
| RTDB region | `europe-west1` |
| Manual console steps | 2, unavoidable on Spark (§6) |
| Cost per fork | £0 |
| Photos | off everywhere — needs Blaze |
| Deployed surface | `_site/` allowlist only — **never** `path: '.'` |
| Last thing before sending | click your own link (§7) |
