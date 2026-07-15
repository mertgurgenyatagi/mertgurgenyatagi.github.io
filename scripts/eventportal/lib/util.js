const crypto = require('crypto');
const { execFile } = require('child_process');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// None of the 9 sources emit a stable per-event id of their own in a form
// this app can rely on directly, so every module synthesizes one here: a
// source's natural key (its own internal event/session id) where one
// exists, falling back to a hash of the event's link when it doesn't. This
// is what the frontend uses for favorites/dismiss/dedup — it must stay
// stable across daily re-crawls for the same real-world event, which is why
// natural keys (stable site-side ids) are preferred over hashing the whole
// event object (title/venue text can get re-scraped with tiny formatting
// differences day to day).
function makeId(source, naturalKey, link) {
  const key = naturalKey != null ? String(naturalKey) : (link || '');
  const hash = crypto.createHash('sha1').update(`${source}:${key}`).digest('hex').slice(0, 12);
  return `${source.toLowerCase()}-${hash}`;
}

// Today's date in YYYY-MM-DD and the date `days` out, both as plain strings
// so window checks stay simple lexicographic string comparisons. Still used
// internally by Biletino/Biletix for their own wide cache-freshness crawl.
function wideWindow(days) {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 3600 * 1000);
  return { start: now.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function sevenDayWindow() {
  return wideWindow(7);
}

// Turkey has observed a fixed UTC+3 offset with no DST since 2016, so a flat
// +3h shift onto the current instant, then slicing the date, gives today's
// real Istanbul calendar date without needing timezone-database support.
function istanbulToday() {
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function addDaysToDateStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Replaces sevenDayWindow() for the daily fetch pipeline: instead of a
// recomputed rolling range, this targets exactly one specific calendar day,
// `days` ahead of today in Istanbul. start===end works because every
// source's fetchEvents({start,end}) filters via withinWindow(), a plain
// inclusive string compare.
function targetDayWindow(days = 8) {
  const day = addDaysToDateStr(istanbulToday(), days);
  return { start: day, end: day };
}

function withinWindow(date, start, end) {
  return typeof date === 'string' && date >= start && date <= end;
}

// Oggusto and Biletinial store event date/time as literal Istanbul wall-clock
// digits with an unreliable/decorative UTC offset suffix (+00:00 or Z) rather
// than a true UTC instant, so we deliberately slice the raw digits instead of
// letting `Date` reinterpret them through that offset.
//
// Bubilet is the exception: its `dates[]` timestamps ARE genuine UTC instants
// (confirmed by cross-checking the same real-world events against Oggusto and
// Biletinial — Bubilet was consistently exactly 3 hours behind both). Use
// splitUtcToIstanbul() for Bubilet instead of this function.
function splitIsoLike(str) {
  if (!str) return { date: null, time: null };
  const [datePart, timePart = ''] = str.split(/[T ]/);
  return { date: datePart, time: timePart.slice(0, 5) || '00:00' };
}

// Converts a true UTC ISO instant to Istanbul wall-clock date/time. Turkey
// has observed a fixed UTC+3 offset with no DST since 2016, so a flat +3h
// shift is accurate without needing timezone-database support.
function splitUtcToIstanbul(str) {
  if (!str) return { date: null, time: null };
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return { date: null, time: null };
  const istanbul = new Date(d.getTime() + 3 * 3600 * 1000);
  return { date: istanbul.toISOString().slice(0, 10), time: istanbul.toISOString().slice(11, 16) };
}

// Named entities beyond the basic set — rich-text fields from CMS-backed
// sources (e.g. Bubilet's event "summary" field) commonly use smart
// quotes/dashes and Latin-1 accented letters as named entities rather than
// numeric ones, which the numeric-entity replace below doesn't catch.
const NAMED_ENTITIES = {
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  mdash: '—', ndash: '–', hellip: '…',
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', aelig: 'æ',
  ccedil: 'ç', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë',
  igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï', ntilde: 'ñ',
  ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö', oslash: 'ø',
  ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', yacute: 'ý', yuml: 'ÿ',
  scaron: 'š', szlig: 'ß',
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä', Aring: 'Å', Aelig: 'Æ',
  Ccedil: 'Ç', Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë',
  Igrave: 'Ì', Iacute: 'Í', Icirc: 'Î', Iuml: 'Ï', Ntilde: 'Ñ',
  Ograve: 'Ò', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö', Oslash: 'Ø',
  Ugrave: 'Ù', Uacute: 'Ú', Ucirc: 'Û', Uuml: 'Ü', Yacute: 'Ý', Scaron: 'Š',
};

function decodeEntities(str) {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-zA-Z]+);/g, (full, name) => (name in NAMED_ENTITIES ? NAMED_ENTITIES[name] : full))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&'); // must run last so it doesn't re-corrupt e.g. "&amp;lt;"
}

// Entities must be decoded before tags are stripped, since some sources
// (e.g. Biletinial) store description HTML double-escaped in an attribute:
// stripping "<...>" first would miss tags that only become real "<...>"
// after &lt;/&gt; are unescaped.
function stripHtml(html) {
  const decoded = decodeEntities(String(html || ''));
  return decoded
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Concurrency-limited map that also (optionally) staggers each worker's
// requests, rather than just capping how many run at once — capping alone
// still lets `limit` requests fire in the same instant, which tripped
// Biletino's rate heuristic in testing when this first lived there.
async function mapLimit(items, limit, fn, staggerMs = 0) {
  const results = new Array(items.length);
  let next = 0;
  async function worker(workerIndex) {
    if (staggerMs) await sleep(staggerMs * workerIndex);
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]).catch(() => null);
      if (staggerMs) await sleep(staggerMs);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, (_, w) => worker(w)));
  return results;
}

// Lowest numeric price across a schema.org offers[] array (JSON-LD
// Event.offers), used by sources whose already-fetched detail-page JSON-LD
// includes real ticket pricing (confirmed live on Luma and Biletino).
// Offer.price can be a string ("1660.00") or a number depending on source;
// both coerce fine through Number(). A genuinely free event's offer already
// reads price 0 numerically, so no separate currency-code special-casing is
// needed to detect "free".
function lowestOfferPrice(offers) {
  if (!Array.isArray(offers) || offers.length === 0) return null;
  let min = null;
  for (const offer of offers) {
    const n = Number(offer && offer.price);
    if (!Number.isFinite(n)) continue;
    if (min === null || n < min) min = n;
  }
  return min;
}

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    // Brief backoff before a retry (not before the first attempt) — observed
    // live that some sources (Biletino) return a transient 403 under bursty
    // request volume that clears within a couple of seconds on its own; an
    // immediate retry with no delay tends to just hit the same window.
    if (i > 0) await sleep(300 * i);
    try {
      const res = await fetch(url, {
        ...options,
        redirect: 'follow',
        headers: { 'User-Agent': UA, ...(options.headers || {}) },
      });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} for ${url}`);
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

const CURL_STATUS_MARKER = '\n__EPA_CURL_STATUS__';

// Some origins (confirmed live: Biletino, Passo) fingerprint Node's native
// fetch (undici) at the TLS/HTTP-client level and block it via Cloudflare —
// a plain 403 from fetch() that a curl replay of the *identical* URL and
// headers doesn't reproduce (verified live: alternating fetch() vs curl
// requests to the same Passo endpoint back to back, fetch() blocked every
// time, curl passed every time). Use this instead of fetchWithRetry for any
// origin that shows the same split. execFile (not exec) passes each arg to
// the process directly with no shell involved, so header values containing
// quotes (e.g. a `sec-ch-ua` client-hint value) don't need any escaping.
function curlFetchOnce(url, headers) {
  const args = ['-s', '-L', '-A', UA, '--max-time', '20', '-w', `${CURL_STATUS_MARKER}%{http_code}`];
  for (const [k, v] of Object.entries(headers || {})) args.push('-H', `${k}: ${v}`);
  args.push(url);
  return new Promise((resolve, reject) => {
    execFile('curl', args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      const idx = stdout.lastIndexOf(CURL_STATUS_MARKER);
      if (idx === -1) return reject(new Error('curl: response missing status marker'));
      resolve({ body: stdout.slice(0, idx), status: Number(stdout.slice(idx + CURL_STATUS_MARKER.length)) });
    });
  });
}

async function curlFetchJson(url, headers, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(300 * i);
    try {
      const { body, status } = await curlFetchOnce(url, headers);
      if (status >= 200 && status < 300) return JSON.parse(body);
      lastErr = new Error(`curl HTTP ${status} for ${url}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

module.exports = {
  UA, sevenDayWindow, wideWindow, istanbulToday, addDaysToDateStr, targetDayWindow,
  withinWindow, splitIsoLike, splitUtcToIstanbul, stripHtml, fetchWithRetry, sleep, mapLimit, makeId,
  lowestOfferPrice, curlFetchJson,
};
