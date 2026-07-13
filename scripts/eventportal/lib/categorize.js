// Assigns exactly one custom category per event, replacing each source's own
// (wildly inconsistent — see research/event-category-analysis.md) category
// tag. First-match-wins cascade; order is load-bearing, not cosmetic (e.g.
// Children must be checked before Workshop/Theater/Concert, StandUp before
// Theater — see the analysis doc for why).
//
// Runs per-event, before any cross-source deduplication exists. The same
// real-world event scraped by two sources can therefore still land in two
// different categories until a dedup pass groups sessions together first.

const CATEGORIES = {
  CHILDREN: 'Çocuk Etkinlikleri',
  STANDUP: 'Stand-up',
  WORKSHOP: 'Atölye',
  EXHIBITION: 'Sergi',
  THEATER: 'Tiyatro',
  CINEMA: 'Sinema',
  FESTIVAL: 'Festival',
  SOCIAL: 'Sosyal',
  SPORTS: 'Spor & Açık Hava',
  PARTY: 'Parti',
  CONCERT: 'Konser',
  MISC: 'Diğer',
};

function norm(s) {
  return (s || '').toLocaleLowerCase('tr');
}

// Unicode-aware tokenizer. Deliberately not a plain regex \b word-boundary
// check: JS's \b is ASCII-only and silently breaks on Turkish text (e.g.
// /yat\b/i false-matches inside "Hayatımın" because JS doesn't treat "ı" as
// a word character, so it sees a boundary right after "yat").
function tokens(s) {
  return norm(s).split(/[^\p{L}]+/u).filter(Boolean);
}

function hasWord(text, word) {
  return tokens(text).includes(word);
}

// Stem/prefix match for Turkish's agglutinative suffixing (sinema/sinemanın/
// sinemada all need to match on "sinema"). Only use with long, distinctive
// stems (5+ letters) — short stems like "parti"/"gece" stay exact-word to
// avoid over-matching unrelated words.
function hasStem(text, stem) {
  return tokens(text).some(t => t.startsWith(stem));
}

function hasPhrase(text, phrase) {
  return norm(text).includes(norm(phrase));
}

const KID_VENUES = ['dolphinarium', 'nickelodeon play'];
const EXHIBITION_VENUES = [
  'x media art museum', 'diyalog müzesi', 'borusan contemporary', 'arter',
  'müze gazhane', 'şerefiye sarnıcı', 'sakıp sabancı müzesi',
];
const MUSIC_GENRE_CATEGORIES = new Set([
  'konser', 'pop', 'rock', 'müzik', 'diğer müzik', 'heavy metal', 'alternatif',
  'türk sanat - halk müziği', 'caz', 'jazz', 'dans - elektronik', 'concert',
]);

function categorize(ev) {
  const title = ev.title || '';
  const desc = ev.description || '';
  const venue = ev.venue || '';
  const cat = norm(ev.category);
  const titleAndDesc = title + '\n' + desc;

  // 1. Children — highest priority so kids' workshops/plays/concerts never
  // fall into the generic adult bucket for the same format.
  // The age-range regex is TITLE-ONLY on purpose: in descriptions it fires on
  // child-ticket pricing fine print ("0-4 yaş arası çocuklar ücretsiz") on
  // ordinary adult events, which is a pricing clause, not a signal that the
  // event itself is for children.
  if (cat === 'çocuk aktiviteleri' || cat === 'theme park') return CATEGORIES.CHILDREN;
  if (/\d+\s*[-–]\s*\d+\s*yaş/.test(title) || hasPhrase(titleAndDesc, 'yaş grubu')) return CATEGORIES.CHILDREN;
  if (hasWord(title, 'çocuk') || hasWord(title, 'çocuklar') || hasPhrase(title, 'çocuk tiyatrosu')) return CATEGORIES.CHILDREN;
  if (KID_VENUES.some(v => hasPhrase(venue, v))) return CATEGORIES.CHILDREN;

  // 2. Stand-up — must run before Theater: Biletinial has no Stand-Up value
  // in its own taxonomy and dumps every one of its stand-up shows into
  // "Tiyatro" instead.
  if (/stand-up|stand up/i.test(cat)) return CATEGORIES.STANDUP;
  if (/stand[\s-]?up/i.test(title)) return CATEGORIES.STANDUP;
  if (hasPhrase(title, 'açık mikrofon') || hasWord(title, 'komedyen') || hasPhrase(title, 'komedi gecesi')) return CATEGORIES.STANDUP;

  // 3. Workshops
  if (cat === 'atölye' || cat === 'workshop' || cat === 'meb onaylı eğitim') return CATEGORIES.WORKSHOP;
  if (hasStem(title, 'atölye') || hasWord(title, 'workshop')) return CATEGORIES.WORKSHOP;
  if (hasPhrase(venue, 'workshop') || hasPhrase(venue, 'atölye') || hasPhrase(venue, 'akademi')) return CATEGORIES.WORKSHOP;

  // 4. Exhibitions
  if (cat === 'sergi' || cat === 'müze') return CATEGORIES.EXHIBITION;
  if (EXHIBITION_VENUES.some(v => hasPhrase(venue, v)) || hasPhrase(title, 'astra lumina')) return CATEGORIES.EXHIBITION;
  if (hasStem(title, 'sergi') || /exhibition|museum/i.test(title)) return CATEGORIES.EXHIBITION;

  // 5. Theater (ballet/opera folded in — combined volume is only ~6 events
  // across the whole corpus, not enough to justify a separate bucket)
  if (['tiyatro', 'bale', 'bale - dans', 'operabale', 'gösteri'].includes(cat)) return CATEGORIES.THEATER;
  if (hasStem(title, 'tiyatro') || hasWord(title, 'oyunu') || hasStem(title, 'müzikal')) return CATEGORIES.THEATER;

  // 6. Cinema
  if (cat === 'sinema') return CATEGORIES.CINEMA;
  if (hasStem(title, 'sinema') || hasStem(venue, 'sinema') || hasPhrase(title, 'film gösterimi')) return CATEGORIES.CINEMA;

  // 7. Boat parties fold into Parties (per explicit product decision — boats
  // are a party format, not a distinct audience)
  if (cat === 'boat party') return CATEGORIES.PARTY;
  if (hasWord(title, 'tekne') || hasWord(title, 'teknede') || hasWord(venue, 'gemisi') ||
      hasPhrase(title, 'boat party') || hasPhrase(title, 'yacht party')) return CATEGORIES.PARTY;

  // 8. Festivals
  if (cat === 'festival') return CATEGORIES.FESTIVAL;
  if (hasStem(title, 'festival') || hasWord(title, 'fest')) return CATEGORIES.FESTIVAL;

  // 9. Social (quiz nights, meetups, networking, game nights)
  if (cat === 'quiz night' || cat === 'sosyal') return CATEGORIES.SOCIAL;
  if (hasPhrase(title, 'quiz night') || hasPhrase(title, 'pub quiz') || hasWord(title, 'trivia') ||
      hasPhrase(title, 'kutu oyun') || hasWord(title, 'networking') || hasWord(title, 'meetup') ||
      hasWord(title, 'buluşuyor') || hasWord(title, 'tanışma')) return CATEGORIES.SOCIAL;

  // 10. Sports & outdoor — must run before the generic Party keyword check
  // (a "run club" or "yoga" session must not fall through to Party on some
  // unrelated word).
  if (/(koşu|koşusu|run club|yoga|pilates|bisiklet|kano|trail|cycling|zindebike)/i.test(title)) {
    return CATEGORIES.SPORTS;
  }

  // 11. Parties
  // Luma-sourced events skip the bare keyword check: Luma's own category is
  // always the meaningless "Topluluk" catch-all, and it has real events like
  // "AI Haters Party: A Night for Real People" that use the word "party" for
  // a tech-community discussion night at a co-working/social venue, not
  // nightlife. Without a nightlife-source signal, "party" alone isn't enough.
  if (['club night', 'day party', 'rooftop', 'parti'].includes(cat)) return CATEGORIES.PARTY;
  if (ev.source !== 'Luma') {
    if (hasWord(title, 'parti') || hasWord(title, 'party') || hasWord(title, 'gece') ||
        hasWord(title, 'gecesi') || hasWord(title, 'rooftop') || hasWord(title, 'night')) {
      return CATEGORIES.PARTY;
    }
  }

  // 12. Concerts — residual bucket for whatever's left in the music-genre
  // categories once festivals/parties/boats/kids' music workshops have
  // already been peeled off above. No genre subdivision is kept.
  if (MUSIC_GENRE_CATEGORIES.has(cat)) return CATEGORIES.CONCERT;

  // 13. Miscellaneous — true catch-all.
  return CATEGORIES.MISC;
}

module.exports = { categorize, CATEGORIES };
