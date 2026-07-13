// Hand-rolled text similarity helpers (Turkish-locale-aware tokenization,
// Jaccard overlap) shared by score-events.js's neighbor retrieval and
// canonical.js's fuzzy dedup fallback.
function norm(s) {
  return (s || '').toLocaleLowerCase('tr');
}

function tokenSet(text) {
  return new Set(norm(text).split(/[^\p{L}]+/u).filter(w => w.length >= 3));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

module.exports = { norm, tokenSet, jaccard };
