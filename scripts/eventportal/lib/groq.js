// Minimal Groq chat-completions client -- plain fetch, no SDK dependency.
// Reads and respects Groq's x-ratelimit-* response headers so the caller can
// self-pace against the real, currently-live budget instead of a hardcoded
// guess. Verified live: llama-3.3-70b-versatile carries a generous 12000
// tokens/minute budget but only 1000 REQUESTS/DAY on the free tier -- far too
// low to score ~1000+ backlog events in one day. llama-3.1-8b-instant's
// 14400 requests/day has no such problem, at some cost in reasoning quality,
// so that's the default for bulk scoring runs.
const { sleep } = require('./util');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const REQUEST_TIMEOUT_MS = 25000;

// Parses Groq's duration strings ("659ms", "6s", "1m26.4s") into milliseconds.
function parseDuration(str) {
  if (!str) return NaN;
  if (str.endsWith('ms') && !str.includes('s', str.length - 2)) {
    const m = str.match(/^(\d+(?:\.\d+)?)ms$/);
    return m ? Number(m[1]) : NaN;
  }
  const m = str.match(/^(?:(\d+)m)?(\d+(?:\.\d+)?)s$/);
  if (!m) return NaN;
  const minutes = Number(m[1] || 0);
  const seconds = Number(m[2]);
  return (minutes * 60 + seconds) * 1000;
}

// Thrown for a deliberate, already-final API-level outcome (a real HTTP
// status/response Groq sent us) so the catch below can tell it apart from a
// network/abort failure and rethrow it immediately instead of retrying.
class ApiError extends Error {}

async function callGroq(apiKey, messages, { model = DEFAULT_MODEL, temperature = 0.2, maxAttempts = 6, maxTokens = 200, jsonMode = true } = {}) {
  let attempt = 0;
  while (true) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res, bodyText;
    try {
      res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      });
      // Always read the body inside the same try/abort-signal scope as the
      // fetch call, success or error -- fetch() resolves once headers
      // arrive, not once the body is fully read, so a stall in the body
      // stream itself (as opposed to connection setup) was previously
      // unprotected by the timeout entirely. That's what caused an earlier
      // run to go completely silent with zero errors and zero progress.
      bodyText = await res.text();
    } catch (err) {
      // Network failure (DNS hiccup, connection reset) or an abort from a
      // stall anywhere in the request/response cycle, including the body
      // read above.
      if (attempt >= maxAttempts) throw err;
      await sleep(Math.min(15000, 1000 * 2 ** attempt));
      continue;
    } finally {
      // Cleared as soon as the network round-trip itself is done -- must NOT
      // stay armed through the 429/5xx backoff sleeps below, or a legitimate
      // multi-ten-second retry-after wait (routine under a tight per-minute
      // token budget) fires a spurious abort on an already-finished request.
      clearTimeout(timer);
    }

    const remainingTokens = Number(res.headers.get('x-ratelimit-remaining-tokens'));
    const resetTokensMs = parseDuration(res.headers.get('x-ratelimit-reset-tokens'));

    if (res.status === 429) {
      if (attempt >= maxAttempts) throw new ApiError(`Groq rate-limited after ${attempt} attempts`);
      const retryAfter = Number(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 + 250
        : Number.isFinite(resetTokensMs) ? resetTokensMs + 500
        : Math.min(30000, 1000 * 2 ** attempt);
      await sleep(waitMs);
      continue;
    }
    if (res.status >= 500) {
      if (attempt >= maxAttempts) throw new ApiError(`Groq server error after ${attempt} attempts: HTTP ${res.status}`);
      await sleep(Math.min(15000, 1000 * 2 ** attempt));
      continue;
    }
    if (!res.ok) {
      throw new ApiError(`Groq API error HTTP ${res.status}: ${bodyText.slice(0, 300)}`);
    }

    let json;
    try {
      json = JSON.parse(bodyText);
    } catch (e) {
      throw new ApiError(`Groq API returned non-JSON body: ${bodyText.slice(0, 300)}`);
    }
    const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    if (!content) throw new ApiError('Groq API returned no content');
    return { content, remainingTokens, resetTokensMs };
  }
}

module.exports = { callGroq, parseDuration, DEFAULT_MODEL };
