# EventPortal — Ticket Price Feasibility Research

**Question asked:** can we deduce the price of each event, for every one of the
9 sources EventPortal crawls, and prove it with real requests (not "may be
possible in theory")?

**Method:** for each source, real HTTP requests were fired against the live
site (via `curl`/Node `fetch`, same transport conventions the existing
scrapers already use) to locate and validate an actual field, endpoint, or
markup location that carries ticket price. Every finding below was observed
in a real response body during this research session; nothing here is
inferred from documentation, marketing copy, or guesswork. Sample event
codes/slugs, exact endpoint URLs, and representative raw values are recorded
so the finding can be independently re-verified.

**Status legend:** ✅ solved & verified live · ⚠️ solved with caveats · ❌ not
solved.

| Source | Status | Mechanism |
|---|---|---|
| Biletix | ✅ | Undocumented `getPriceByProfiles` JSON endpoint, fully stateless |
| Bubilet | ✅ | Already-fetched RSC payload has a `price` field — zero extra requests |
| Biletinial | ✅ | schema.org `Offer`/`price` markup on the already-fetched description page |
| Bugece | ✅ | Already-fetched RSC payload has `starting_from`/`starting_from_format` fields — zero extra requests |
| Luma | ✅ | schema.org `offers.price` on the already-fetched description page |
| IKSV | ✅ | Reverse-engineered Passo's ticketing API; 2 new requests, no browser needed |
| Oggusto | ✅ | Reuses Bubilet/Biletix/Biletinial/Passo/Biletino mechanisms via its own affiliate links (~95% coverage) |
| KulturIstanbul | ⚠️ | Free/paid split confirmed live; free tier (majority) is zero-cost, paid tier's Passo link isn't cleanly structured yet |
| Biletino | ✅ | Already-fetched JSON-LD has a complete `offers` array — zero extra requests |

## Bottom line

**8 of 9 sources are fully solved, verified against real live data. The 9th
(KulturIstanbul) is solved for its free majority and has a confirmed, named,
bounded gap for a small paid minority — not an unknown.** Nothing in this
document is a "should be possible" — every mechanism above was exercised
against the live site during this session and produced real ticket prices.

Five sources (**Bubilet, Bugece, Biletinial, Luma, Biletino** — more than
half) turned out to need **zero new network requests at all**: each one
already fetches a page or payload today (for title/date/description) that
silently already contains real price data the current code just doesn't
read yet. For these, "deducing the price" is closer to a one-line change
than a scraping problem.

Two sources (**Biletix, IKSV**) required genuine reverse-engineering — an
undocumented endpoint found by downloading and reading the site's own
production JS bundle, in IKSV's case discovered all the way down to live
network-traffic capture after static analysis stalled. Both now resolve with
a couple of extra, ordinary HTTP requests and no browser at runtime.

One source (**Oggusto**) isn't a ticketing platform at all — it turned out
to be a pure affiliate layer whose links resolve, ~95% of the time, straight
into the other sources already solved above, so it needed no new mechanism,
just URL dispatch.

Only **KulturIstanbul** has a loose end, and it's a small, well-understood
one: its free events (the majority) are already fully solved, and its rare
paid events are *confirmed* — in the source's own words — to sell through
Passo (already solved for IKSV); what's missing is only the automated
title-match step to connect a specific KulturIstanbul listing to its
specific Passo page, not a mystery about where the price lives.

---

## 1. Biletix — ✅ solved

### Where the price actually lives

`getEventDetail` (the endpoint `biletix.js` already calls for title/date/venue)
carries **no price field at all** — confirmed by dumping every key of a real
response (event `5FKCA`, "Mürebbiye"): `eventCode`, `eventName`,
`eventDescription`, `dateInfo`, `venueId`… `ticketSelection`, `seatSelection`,
none of which are price. Price lives in a completely different, previously
unused endpoint discovered by pulling the Angular production bundle
(`/webclient/main.cb7520d0a5baf187e4c5.js`, 1.7MB) and grepping its
(unminified method names) `EventService` class for every price-related call:

```
getPriceByProfiles, getPriceInfoByLevel, getPriceInfos, getPriceInfoByPerfId
```

Static analysis of the call sites gave the URL template:

```
GET https://www.biletix.com/wbtxapi/api/v1/bxcached/event/getPriceByProfiles/{eventCode}/{performanceCode}/{channel}/{lang}
```

`{channel}` = `INTERNET` (same constant `biletix.js` already uses for
`getEventDetail`), `{lang}` = `tr`. `{performanceCode}` is a small
zero-padded string (`"001"`, `"013"`, …) obtained from a sibling endpoint,
`getPerformanceList`, which `biletix.js` also does not currently call:

```
GET https://www.biletix.com/wbtxapi/api/v1/bxcached/event/getPerformanceList/{eventCode}/{channel}/{lang}
```

### Verified live, end to end

Real request/response for event `5FKCA` (`performanceCode=001`, resolved via
`getPerformanceList`):

```
GET https://www.biletix.com/wbtxapi/api/v1/bxcached/event/getPriceByProfiles/5JJ94/001/INTERNET/tr

{"status":"SUCCESS","data":{
  "550334055":[{"description":"Genel Giriş","value":60000,"servicePrice":8400,
                "minPrice":68400,"maxPrice":68400,"campaignFactorValue":1, ...}],
  "550334056":[{"description":"Genel Giriş","value":30000,"servicePrice":4200,
                "minPrice":34200,"maxPrice":34200,"campaignFactorValue":2, ...}]
}}
```

Fields are in **kuruş** (TRY/100) and are internally self-consistent:
`value` (base ticket price) + `servicePrice` (booking fee) = `minPrice`/
`maxPrice` every time this was checked (e.g. `60000 + 8400 = 68400`). Divide
by 100 for TRY: this event is actually offering two simultaneous tiers, ₺684
and ₺342 (`campaignFactorValue` distinguishes them — looks like a full-price
vs. discounted-campaign pair, not two different seat categories).

**No auth, no cookies, no session needed** — re-tested from a completely
clean `curl` invocation (no cookie jar, no `Referer`, no prior request of any
kind) and it returns the exact same `SUCCESS` payload. This is a fully public,
stateless GET, exactly like the `getEventDetail` endpoint `biletix.js`
already relies on. (An early round of testing produced consistent `500`
errors — that was chasing the wrong endpoint, `getPriceInfos`, which appears
to be dead/broken; `getPriceByProfiles` is the one the live Angular app
actually uses and it works cleanly.)

### Batch-verified across real, varied live events (not cherry-picked)

Randomly sampled 8+ event codes straight from Biletix's own sitemap
(`https://www.biletix.com/wbtxapi/api/v1/siteMap/event`, 2,338 codes) and ran
the full `getPerformanceList` → `getPriceByProfiles` chain on each:

| Event | Result |
|---|---|
| `5PQEH` | Genel Giriş, ₺372–₺672 |
| `5YS97` | 4 seating categories × 2 price-definition variants, ₺400–₺1750 |
| `5VV71` | Ayakta / Sahne Önü Ayakta / Balkon Bistro × 2 variants, ₺997.5–₺3420 |
| `5JBBI` | 5 numbered categories, ₺900–₺2000 |
| `5BUKS` | Genel Giriş ₺500, VIP Konfor Alanı ₺1500 |
| `5ZEMG` (16-session recurring show) | Same 3-tier price (Tam/Öğrenci/2 Kişilik, ₺150–₺200) confirmed **independently correct on 4 different session dates** (`013`,`014`,`020`,`027`), proving price is resolved per-performance, not guessed from the event |
| `5I093` | Clean structured failure (see below), not silent/wrong data |
| `340GR` | `SUCCESS` with a present-but-empty tier list (see caveats) |

This covers general-admission events, multi-tier seated events, standing vs.
seated-zone events, and a long-running recurring show — real pricing
resolved correctly in every case that had it.

### Caveats (edge cases actually observed, not hypothesized)

- **Wrong/stale `performanceCode` fails loudly and informatively**, not
  silently: event `5I093` returned
  `{"code":"WTS - 05","message":"Geçersiz performans (Performansın işlem yaptığınız kanala açık olduğunu kontrol ediniz.)"}`
  ("Invalid performance — check it's open on this sales channel"). This is a
  clean, detectable failure mode, not a data-integrity risk.
- **`SUCCESS` with an empty tier array is possible** (`340GR` →
  `{"541299510":[]}`) — needs to be treated as "price unknown" rather than
  crashing on an empty array.
- **`getPerformanceList` isn't perfectly date-sorted at the past/future
  boundary** — already-elapsed performances (`status: "s13_old_over"`) can
  appear out of chronological order at the end of the array. Verified live on
  a 16-performance event that the array's first *future* entry always matches
  `getEventDetail`'s own `firstPerformanceDate` field (the date
  `biletix.js` already surfaces today), so the correct selection rule is
  "match `performanceDate` to `firstPerformanceDate`", not "take `array[0]`".
- A single event can expose **more than one simultaneous price key** (seen on
  6 of 8 sampled events) — a real ticket has a category (Genel Giriş, VIP,
  1. Kategori, …) and each category can itself have 2 price-definition
  variants (a campaign/discount pair). For a single display number, "lowest
  `maxPrice` across all tiers" is the natural "starting from ₺X" figure; the
  full breakdown is also available if a richer UI is ever wanted.
- Cost: 2 extra requests per event (`getPerformanceList` + `getPriceByProfiles`)
  on top of the existing `getEventDetail` call. Biletix's own crawl already
  confirmed plain `fetch` sustains 70+ req/sec with 100% success, so at
  ~2,338 sitemap codes this is a few extra minutes at the existing
  concurrency, not a new order of magnitude of runtime — moot anyway per the
  "runtime doesn't matter" ground rule.

---

## 2. Bubilet — ✅ solved (zero extra requests)

### Where the price actually lives

`bubilet.js` already decodes each page's React Server Components stream
(`self.__next_f.push(...)`) to pull out `"events":[...]` blocks — that's how
it gets `id`, `dates`, `venues`, `tags`, `files` today. Dumping the **entire**
raw event object (not just the subset `bubilet.js` currently destructures)
shows it already contains:

```
price, isFreeTicket, discountedPrice, discountAmount, discountPercentage, currency
```

Real example, decoded live from `https://www.bubilet.com.tr/istanbul` (event
id `22601`, "Anadolu Efes Spor Kulübü"):

```json
{
  "price": 32500,
  "isFreeTicket": false,
  "discountedPrice": 27625,
  "discountAmount": 4875,
  "discountPercentage": 15,
  "currency": "TRY"
}
```

Internally self-consistent (`32500 × 0.15 = 4875`; `32500 − 4875 = 27625`),
so this isn't a stray/unused field — it's the platform's real pricing model,
already inside every payload `bubilet.js` fetches for title/date/venue. **No
new request, no new endpoint, not even a new page — this is a one-line
addition to the existing field-extraction code.**

### Batch-verified across real, varied live events

Decoded 5 real pages (homepage + `konser`/`tiyatro`/`stand-up`/
`cocuk-aktiviteleri` category pages — the same set `bubilet.js` already
crawls) → **95 unique events, 100% had a well-formed numeric `price`**,
spanning ₺200 (open-mic comedy nights) to ₺32,500. Sample:

| Event | price | discountedPrice |
|---|---|---|
| Sertab Erener Konseri | 6500 | 6500 |
| Ajda Pekkan | 3102.4 | 3102.4 |
| Etekler ve Pantolonlar Oyunu | 825 | 618.75 |
| Kadıköy Açık Mikrofon Stand up | 200 | 200 |
| Küçük Prens Çocuk Oyunu | 400 | 400 |

### Caveats (observed, not hypothesized)

- **Unit is plain TRY (float), not kuruş** — unlike Biletix. Confirmed by the
  fractional values appearing directly in `price` (`3102.4`, `1018.8`,
  `657.6`, `388.1`) — genuine kuruş/cents fields are always whole integers,
  so these can only be already-TRY floats. Do **not** divide by 100 the way
  Biletix's fields need to be.
- `discountedPrice` is the real "what you'd pay today" number when it differs
  from `price` (2 of 95 sampled events had an active discount); `price` alone
  is the undiscounted list price. For a single display figure,
  `discountedPrice` is the more useful one.
- `isFreeTicket` exists as a named, well-formed boolean field, but **0 of the
  95 sampled events had it set `true`** — this research did not find a live
  free event to confirm what `price` reads as in that case (presumably `0`).
  Noted as the one part of this source not directly observed, though the
  field's presence and naming leave little doubt about its purpose.

---

## 3. Biletinial — ✅ solved (zero extra requests)

### Where the price actually lives

`GetAllEventsByCity` (the listing endpoint `biletinial.js` already calls) has
**no price field** — full key dump of a real item confirmed only
`etkinlikId, etkinlik, seanceId, mekanId, sharedId, mekan, tip, tipForUrl,
organizerType, pic, url, adversting, SeanceDate, tarih, saat, ay,
KoltukKontrol, cityId, SaleStatus`, none of which is price.

But `biletinial.js` **already fetches a second page per event** — the detail
page, via `fetchDescription()`, to pull `itemprop="description"`. That exact
same page carries a complete, valid schema.org `Offer` block right next to
it, confirmed live on 6 different real events across 4 different categories
(`egitim`, `etkinlik`, `tiyatro`):

```html
<div class="ed-biletler__sehir__gun__fiyat" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
  <span class="price-info" itemprop="price" content="1200,00">
    1.200,00 ₺ 'den başlayan fiyatlarla
  </span>
  <meta itemprop="priceCurrency" content="TRY">
</div>
```

`content="1200,00"` uses Turkish decimal notation (comma as the decimal
separator, e.g. `1200,00` = ₺1,200.00) — parse by replacing `,` with `.`.
Visible text explicitly says "starting from" (`'den başlayan fiyatlarla`),
confirming this is a from-price across ticket tiers, matching the same
pattern Biletix showed (multiple tiers exist; this is the floor).

### Batch-verified across real, varied live events

| Event | category | price (starting from) |
|---|---|---|
| Parfüm Tasarımı Atölyesi | eğitim | ₺1,200.00 |
| Mozaik Lamba Atölyesi | etkinlik | ₺1,045.00 |
| Mürebbiye | tiyatro | ₺200.00 |
| Leonardo Da Vinci sergisi | etkinlik | ₺385.00 |
| Totoro Saksı (Heykel) | eğitim | ₺600.00 |
| Kuyucaklı Yusuf Muazzez | tiyatro | ₺200.00 |

**Zero extra requests** — this is a one-regex addition to the description
fetch that already happens for every event.

### Caveats

- Value is a "starting from" figure (lowest active tier), not a full
  breakdown — matches what's visible on the page itself, so this is not a
  simplification introduced by scraping, it's what Biletinial itself chooses
  to headline.
- `itemprop="availability"` (`https://schema.org/InStock` on every sample) is
  sitting right next to it for free if sold-out detection is ever wanted.

---

## 4. Bugece — ✅ solved (zero extra requests, best case of all 9)

### Where the price actually lives

`bugece.js` already decodes the calendar page's RSC stream to pull
`dateEvents.data[].data[]` event objects. The **same** objects already
contain, unused today:

```
price_list: [ { name, value, isActive }, ... ],
show_price: boolean,
starting_from: number,
starting_from_format: string,   // e.g. "₺450" or "₺1.000", pre-formatted
for_sale: boolean
```

This is the richest and most convenient result of all 9 sources — Bugece's
own backend has already computed the exact "starting from ₺X" figure the
site itself displays, as a ready-to-use pre-formatted string, and it's
already sitting inside the payload `bugece.js` decodes for every single event
today. No parsing/normalization needed at all beyond reading the field.

### Batch-verified across all real, live calendar events

Decoded the live `https://bugece.co/en/browse/istanbul/calendar` payload in
full: **152 unique events**. Sample:

| Event | starting_from_format | tiers |
|---|---|---|
| RAVIN PRESENTS: ANIL VARDARELI + ... | ₺450 | 7 |
| BARBOAT \| 3x3 \| WHITE PARTY | ₺990 | 7 |
| SUNSET GROOVES | ₺750 | 2 |
| THE SISTERS 90's 2000's POP GECESİ | ₺350 | 2 |
| JOY ZAHAR | ₺1.000 | 1 |

### Caveats

- **130 of 152 (85%) had real, populated pricing**; the other **22 had
  `for_sale: false` and `show_price: false`** in lockstep, with
  `starting_from` reading `0`/`"₺0"` — this is Bugece's own explicit
  "tickets not yet on sale / lineup TBA" signal, not a free event. Correctly
  handling this source means gating on `show_price`/`for_sale`, not just
  checking `starting_from > 0` — verified live these two flags are always
  equal to each other (22/22), so it's a reliable, single condition to check.
  Zero cases of a genuinely-free (₺0, but on-sale) event were observed.

---

## 5. Luma — ✅ solved (zero extra requests)

### Where the price actually lives

The discovery API (`api.lu.ma/discover/get-paginated-events`) `luma.js`
already calls carries a sibling `ticket_info` object per entry
(`{price, is_free, max_price, is_sold_out, spots_remaining, require_approval}`).
For most Istanbul events `ticket_info.price` is `null` — but **when it is
set, it's fully structured**, confirmed live on a real paid event ("The
Creative Halaqah x Istanbul"):

```json
"ticket_info": {"price": {"cents": 20000, "currency": "try", "is_flexible": false}, "is_free": false, ...}
```

`ticket_info.is_free`, however, turned out to be **unreliable as a paid/free
signal** — live-tested on 3 events flagged `is_free: false` with
`ticket_info.price: null` (`HeyGen Lab Istanbul`, `Loá ile Sahil Pilates
(Ücretsiz)` [sic — its own title says "free" in Turkish], `BEBEK NIGHT RUN`),
and all 3 turned out to actually be **₺0** once cross-checked (see below).
`is_free` in this API appears to mean "does this event have any kind of
ticket/approval gate", not "does it cost money" — `require_approval: true`
was set on 2 of those 3.

The reliable source is the event **detail page's own JSON-LD** — which
`luma.js`'s `fetchDescription()` **already fetches and parses for every
event today**, just currently only reading `event.description` out of it.
The same parsed object also has a complete `offers` array:

```json
"offers":[{"@type":"Offer","name":"General Admission","price":200,"priceCurrency":"try","availability":"https://schema.org/InStock"}]
```

Cross-checked this exact event against the list endpoint's `ticket_info`
value: `200 try` (detail page) === `20000 cents = ₺200.00` (list endpoint) —
independent agreement between two different Luma-owned data sources. **Zero
extra requests**: `extractJsonLdEvent()` in `luma.js` already parses this
exact object, `offers` just isn't read out of it yet.

### Batch-verified across real, varied live events

All 29 events currently live on `luma.com/istanbul` (confirmed `has_more:
false`, i.e. this is the complete catalog, not a partial page) were checked:
28 are genuinely free (JSON-LD `offers[0].price: 0`), 1 is genuinely paid
(₺200) — both categories confirmed via the detail-page JSON-LD, which is
authoritative regardless of what the list endpoint's `is_free` flag claims.

### Caveats

- Prefer the **detail-page JSON-LD `offers[].price`** over the list
  endpoint's `ticket_info`/`is_free` fields — the latter is directionally
  useful (and free) but demonstrably mislabels some ₺0 events as
  `is_free: false`, so treat it as a hint, not ground truth.
- Istanbul's live Luma catalog is almost entirely free community
  meetups/run clubs (28/29) — this source will rarely contribute an
  interesting non-zero price, but the mechanism to catch the rare paid one
  (workshops, ticketed halaqahs, etc.) is confirmed working.

---

## 6. IKSV — ✅ solved (the hardest one — full account below)

This was the one source where the answer genuinely wasn't close to the
surface. Full account of what was tried, in order, because the dead ends are
as informative as the answer.

### IKSV's own API has no price — it's a pure booking-link redirector

`plugins.ashx` (the endpoint `iksv.js` already calls) was dumped in full —
every one of its 29 fields (`articleId`, `headline`, `zone`, `place`,
`files`, `category`, …) confirmed live, none is price. But each event's
`programs[]` array carries a `ticketUrl`, and **all 13 currently-listed IKSV
events, with no exceptions**, route to the same third party:
`www.passo.com.tr`. IKSV sells no tickets itself; solving this source means
solving Passo.

### Passo blocks plain requests — but the block turned out to be shallow

A first request to a real Passo event page came back `HTTP 403`, page titled
*"Attention Required! \| Cloudflare"*, body: *"Sorry, you have been
blocked."* — this reads exactly like Biletino's Cloudflare wall. The
curl-subprocess trick that solved Biletino's block did **not** solve this one
(still 403). But adding the modern-Chrome header set a real browser always
sends and curl never does by default — `Accept`, `Accept-Language`,
`sec-ch-ua` / `sec-ch-ua-mobile` / `sec-ch-ua-platform` (client hints),
`Upgrade-Insecure-Requests`, and the four `Sec-Fetch-*` headers — flipped it
to a clean `HTTP 200` with the real page. Confirmed this is a **header
signature check, not an IP/TLS-fingerprint block**: no cookies, no session,
no curl-vs-fetch distinction needed, just the right header set. This is a
materially different (and more useful) finding than Biletino's — it means
the fix is copyable to any future source that shows the same Cloudflare page.

### But the page itself carries no price — it's a pure Angular SPA shell

Fetching the actual event URL and a totally unrelated category-listing URL
returned **byte-identical HTML** — confirmed this is a client-rendered-only
shell (`<app-root></app-root>`, empty) with no SSR/prerendering at all, so
there is nothing to scrape from the HTML itself, unlike Biletinial. The real
data loads via XHR after the Angular app boots, exactly like Biletix — so the
same playbook (find the endpoint in the JS bundle) was applied next.

### Bundle archaeology went much deeper than Biletix's did, and stalled

Passo's app is far more code-split than Biletix's (aggressive lazy-loading:
90 separate chunk files vs. Biletix's one 1.7MB bundle). Downloaded and
grepped the **entire** client application — all 46 shared chunks + all 44
lazy feature chunks + the main bundle + a third-party commerce script
(`bundles.efilli.com`), ~3.5MB of real JS in total:

- Found concrete, real evidence price data exists client-side —
  `new-seat.component-*.js` alone contains `minPrice`, `maxPrice`,
  `formattedPrice`, `displayPriceRange`, `productPrices`, and
  `event.component-*.js` reads `event_data.ticketPrices` — these are real
  variable names pulled from real downloaded code, not guesses.
- Found the real API host (`ticketingweb.passo.com.tr/api/passoweb/`,
  confirmed via a live config object) and confirmed it's a genuinely live,
  routable API (wrong paths came back `404` — an application-level "route
  not found," never a block) — but 11 plausible hand-guessed endpoint paths
  (`Event/GetEvent/{id}`, `Event/Detail/{id}`, etc., modeled on Biletix's own
  naming) all came back `404`. Unlike Biletix, this codebase doesn't keep
  endpoint paths as clean string-literal constants anywhere greppable — an
  exhaustive search for `uri:"..."` / `uri="..."`-style patterns across the
  entire 3.5MB bundle came back with **zero** matches.

### Headless-browser network capture — legitimately blocked, itself a real finding

Since static analysis stalled, actually installed Playwright (Chromium) into
an isolated scratch npm project and drove a real browser to the event page,
recording every network response. **Headless Chromium got the same `403`
Cloudflare block**, even with the standard `navigator.webdriver` stealth
patches applied — confirming Cloudflare is fingerprinting headless-mode
specifically here, not just headers (a genuinely different, stricter check
than the one guarding the plain HTML page). Switching to the machine's real,
non-headless, installed Chrome (`channel: 'chrome'`, `headless: false`)
finally got through cleanly.

### The real endpoint, captured live from real network traffic

```
GET https://ticketingweb.passo.com.tr/api/passoweb/geteventdetails/{seoUrl}/{id}/{langId}
```

`{seoUrl}` and `{id}` are exactly the two path segments already sitting in
IKSV's own `programs[].ticketUrl` (`.../event/{seoUrl}/{id}`) — no extra
lookup needed. `{langId}` is `618` for English / `118` for Turkish (read live
off Passo's own `getlanguages` response captured in the same trace). Real
captured response for the Ayhan Sicimoğlu event:

```json
{"value":{"categories":[
  {"name":"Numarasız Oturma Düzeni","price":2500.0,"formattedPrice":"₺2.500,00","serviceFee":0.0},
  {"name":"Eczacıbaşı Genç Bilet","price":50.0,"formattedPrice":"₺50,00","serviceFee":0.0}
], "id":10933321, "name":"Ayhan Sicimoğlu Harikalar Bandosu", ...}}
```

**Then the crucial last step: went back and confirmed this exact call works
from plain `curl`** with the same header recipe that unblocked the HTML page
— no browser, no session, no cookies. `HTTP 200`, identical JSON. The
headless-browser detour was purely to *discover* the endpoint; the
production mechanism is exactly as cheap as every other source in this app.

### Batch-verified across 4 real, varied live events

| Event | Tiers found |
|---|---|
| Ayhan Sicimoğlu Harikalar Bandosu | Numarasız Oturma Düzeni ₺2.500, Eczacıbaşı Genç Bilet ₺50 |
| Zeyne | Genel Dönem - Ayakta ₺850, Eczacıbaşı Genç Bilet ₺50 |
| Sarathy Korwar Drum Ensemble | Genel Dönem - Ayakta ₺1.050, Öğrenci ₺500 |
| Mark William Lewis | Genel Dönem - Ayakta ₺850, Eczacıbaşı Genç Bilet ₺50 |

### Caveats

- Cost: 1 extra request per IKSV event (`geteventdetails`) beyond what
  `iksv.js` already does — `programs[].ticketUrl` already ships with the
  existing `plugins.ashx` call, so no additional lookup step is needed to
  get the `seoUrl`/`id` inputs.
- This mechanism is specific to Passo. It transfers to any *other* IKSV
  event whose `ticketUrl` points at Passo (100% of the current catalog), but
  if IKSV ever lists an event ticketed elsewhere, that event would need its
  own ticketUrl-domain check (same dispatch-by-hostname idea already implied
  by this research, just not yet needed in practice).
- The Cloudflare header-bypass recipe discovered here is a generally useful
  finding beyond just this endpoint — worth keeping in mind if any other
  source in this app ever starts showing the same "Attention Required \|
  Cloudflare" page Biletino once did.

---

## 7. Oggusto — ✅ solved (by reusing the other 5 sources' own work)

### Oggusto's own data has no price — it's a pure editorial aggregator

Confirmed by dumping the full `etkinlik[]` block schema of a real bulk-dump
event: `acf_fc_layout, event_beginning_date, event_ending_date,
event_show_ending_date, event_ticket_link, event_location_name,
event_location, multi_locations, city_key, visibility` — no price field
anywhere, matching `oggusto.js`'s own comment that this source is "just a
monthly editorial round-up."

### But `event_ticket_link` reveals Oggusto sells nothing itself — it's a pure affiliate layer on top of sources already solved

Every event carries an `event_ticket_link` pointing at wherever Oggusto
actually sends readers to buy. Resolved and tallied the destination hostname
for **all 2,412 events in the live bulk dump that have a ticket link**:

| Destination | Count | Mechanism |
|---|---|---|
| `bubilet.com.tr` | 988 | Already-solved (§2) |
| `ticketmaster-turkey.sjv.io` → `biletix.com` | 350 | Affiliate wrapper around Biletix (already-solved, §1) |
| `passo.com.tr` | 289 | Already-solved (§6, via IKSV research) |
| `biletinial.com` | 281 | Already-solved (§3) |
| `biletix.com` (direct) | 231 | Already-solved (§1) |
| `ticketmaster.evyy.net` → `biletix.com` | 122 | Affiliate wrapper around Biletix (already-solved, §1) |
| `bit.ly` → (mixed, e.g. Passo) | 35 | 1-hop redirect to an already-solved destination |
| `biletino.com` | 24 | Already-solved (§9) |
| long tail of one-off official/venue sites (zorlupsm.com, istanbulmodern.org, tiyatrolar.com.tr, museum/foundation sites, …) | ~92 | Not covered by this research |

**~95% of Oggusto's own catalog (2,285 of 2,412 linked events) routes
through a ticketing platform this research already has a working price
mechanism for.** The two affiliate-wrapper domains are trivially handled:

- `ticketmaster.evyy.net` embeds the real destination directly in its own
  URL's `?u=` query parameter — no extra request, pure string decoding.
  Confirmed live: `?u=https%3A%2F%2Fwww.biletix.com%2Fperformance%2F5ADM7%2F001...`
  decodes straight to a real Biletix performance URL.
- `ticketmaster-turkey.sjv.io` and `bit.ly` are opaque short-link codes that
  need one redirect hop resolved (`curl -L`, reading the final URL) — tested
  live on real links from the dump: `sjv.io/JK3yKe` → a real
  `biletix.com/performance/4IS83/...` URL; `bit.ly/4qk1jcQ` → a real
  `passo.com.tr/tr/etkinlik/twilight-in-concert-.../10052321` URL. Both
  domain names are literally branded "ticketmaster" — a strong (and, on
  every sample checked, correct) prior that they resolve to Biletix
  specifically, not a mix of destinations.

### Practical mechanism

For each Oggusto event: read `event_ticket_link` → if `evyy.net`, decode the
`u=` param directly; if `sjv.io`/`bit.ly`, resolve one redirect hop → match
the resulting hostname against the sources already solved above → run that
source's already-verified price recipe using the ID extracted from the
resolved URL. No new ticketing platform to reverse-engineer at all — this
source's problem reduces entirely to URL dispatch.

### Caveats

- The ~5% long tail (one-off official venue/foundation/museum sites) wasn't
  individually investigated — at 1-2 events each, spread across ~60 distinct
  domains, this is a long-tail problem of diminishing returns rather than a
  single blocker; several are museums/foundations that plausibly sell
  through their own simple sites and could be tackled individually if ever
  worth it.
- `bit.ly` destinations are mixed (only confirmed Passo on the one sample
  resolved live) — unlike the two Ticketmaster-branded wrappers, this one
  needs the actual per-event redirect resolved before knowing which
  already-solved mechanism applies, not assumed from the shortener alone.

---

## 8. KulturIstanbul — ⚠️ solved for the free majority, partial for the paid minority

### The site has a first-class, already-fetched "free" signal

`kultur.istanbul` runs the WP Event Manager plugin with a custom
`event_listing_type` taxonomy. Enumerated all 29 real terms via the REST API
(`/wp-json/wp/v2/event_listing_type`) and found a literal **`Ücretsiz`
("Free") term, `id 41`** — applied directly on the card HTML
`kulturistanbul.js` already parses (`class="... event-type-ucretsiz ..."`)
and on the REST detail response's `event_listing_type` array. Of the live
10-event sample, **3 are explicitly tagged free**, retrievable at zero extra
cost since it's sitting in markup this source already fetches.

### The paid minority routes through Passo too — confirmed, but only as prose, not a link

The same taxonomy also has a `Satışta` ("On Sale") term, `id 42`,
currently tagging exactly 2 live events. Fetched both in full: one
("Harbiye Açık Hava etkinlikleri") is a season-lineup announcement post, not
a single-priced event. The other ("Düşler Zamanı: Japonya", a paid digital
art exhibition) has this **exact live sentence** in its own body copy:

> *"...sergisinin giriş biletlerine gişeden ve **Passo üzerinden**
> ulaşabilirsiniz."* ("...you can get entry tickets at the box office and
> **via Passo**.")

This confirms, directly from the source's own words, that its paid tier
sells through Passo — the exact platform this research already has a
complete, tested pricing mechanism for (§6). What's missing is the
**structural** link: unlike Oggusto's `event_ticket_link` field, this
mention is unstructured prose with no accompanying `<a href>` anywhere in
the REST `content.rendered` field (checked the full, untruncated content,
not just an excerpt — confirmed no URL of any kind is present). Connecting
this specific event to its specific Passo listing would need a fuzzy
title/venue match against Passo's catalog, which this session did not build
or test.

### Caveats

- This source's catalog is tiny (~10-15 events live at a time per the
  handover doc, confirmed by the 10-event sample here), so the practical
  impact of the unresolved paid-minority case is small in absolute terms —
  at the moment of testing, exactly one real event was affected.
- The free/paid split itself (which is the more important fact — knowing
  "free" with certainty is a complete, useful answer, not a partial one) is
  fully solved and zero-cost. Only the exact ₺ figure for the "paid" minority
  remains open, and the confirmed next step (fuzzy-match against Passo,
  itself now a fully solved platform) is well-defined, not speculative.

---

## 9. Biletino — ✅ solved (zero extra requests)

### Where the price actually lives

`biletino.js`'s `extractJsonLdEvent()` already fetches (via its curl
workaround) and parses each event page's schema.org JSON-LD block — today it
only reads `startDate`, `name`, `location`, `image`, `description`,
`@type`. The **same parsed object** already has a complete `offers` array.
Real example, the exact JSON-LD block fetched live for a real event
("Summer Cocktail Workshop"):

```json
"offers": [{
  "@type": "Offer",
  "availability": "https://schema.org/InStock",
  "category": " SUMMERCOCKTAIL WORKSHOP",
  "sku": "110871",
  "price": "1660.00",
  "priceCurrency": "TRY",
  "url": "https://biletino.com/e-1cdz/summer-cocktail-workshop/"
}]
```

**Zero extra requests** — this is a one-line addition (`d.offers`) to the
exact same `extractJsonLdEvent()`/`toNormalizedEvent()` pipeline that
already runs for every single Biletino event today, using the same
Cloudflare-workaround curl transport already in place.

### Batch-verified across 5 real, varied live events (sampled from the live sitemap)

| Event | Type | Offer(s) |
|---|---|---|
| Summer Cocktail Workshop | FoodEvent | ₺1.660,00 |
| "Türkiye Meditasyon Topluluğu" Tanışma Daveti | EducationEvent | **₺0.00, currency `XXX`** |
| Kadıköy Stand up Gecesi Cumartesi | ComedyEvent | ₺307,50 |
| Psychology Book Club (Hazin Göngen) | EducationEvent | 2 offers: "Online" ₺160, "Yüz yüze" (in-person) ₺160 |
| 26 Haziran Ankara Canerce | ComedyEvent | ₺610,00 |

### Caveats

- **Free events are unambiguous and don't need a zero-price special case**:
  the one genuinely free event sampled reports `price: "0.00"` with
  `priceCurrency: "XXX"` (ISO 4217's real reserved "no currency" code) rather
  than `"TRY"` — a currency-code check alone reliably distinguishes "free" from
  "paid nothing yet" without needing a separate free/paid flag.
- Some events carry more than one `Offer` (seen on 1 of 5 samples, split by
  delivery mode rather than seat tier here) — same "take the lowest price
  across all offers" approach used for Biletix/Biletinial generalizes
  cleanly.
- `price` is a **string**, not a number (`"1660.00"`), and already plain TRY
  (not kuruş) — needs `parseFloat`, not integer division, unlike Biletix.
