/**
 * Everything the single-player lobby can be set to. One shape for all of it —
 * the settings panel renders any of these lists the same way.
 */
export interface Choice {
  id: string
  /** Set in Oswald, uppercase, on the chip. */
  name: string
}

/**
 * Three values. The configuration rules also describe a fourth — one specific
 * nationality — which was **withdrawn on 2026-08-18** rather than shipped
 * disabled: simulating every configuration against the real pool showed no
 * nationality can seat three drafters, and only one can seat two. A scope that
 * is unusable at every table size worth offering isn't a narrowing, it's a
 * dead end, so it isn't drawn at all.
 *
 * The per-nationality *constraints* are unaffected and still offered — those
 * cap how many of one nationality a squad may hold, which is a different
 * setting from scoping the whole pool to one country.
 *
 * Only `league` narrows further below.
 */
export const scopes: Choice[] = [
  { id: 'all', name: 'All players' },
  { id: 'top-5', name: 'Top 5 leagues' },
  { id: 'league', name: 'One league' },
]

/**
 * The five leagues that have a mark in `public/leagues/`. The crest is the
 * label — these are the identifier, and they render full colour and unfiltered
 * because a recoloured badge is a falsified badge. Selection is drawn on the
 * chip around the mark, never on the mark itself.
 */
export type LeagueId = 'premier-league' | 'la-liga' | 'serie-a' | 'bundesliga' | 'ligue-1'

export const leagues: Choice[] = [
  { id: 'premier-league', name: 'Premier League' },
  { id: 'la-liga', name: 'La Liga' },
  { id: 'serie-a', name: 'Serie A' },
  { id: 'bundesliga', name: 'Bundesliga' },
  { id: 'ligue-1', name: 'Ligue 1' },
]

/** Exactly one is active per draft — they don't stack. Free Pick only. */
export const constraints: Choice[] = [
  { id: 'club-1', name: '1 per club' },
  { id: 'club-3', name: '3 per club' },
  { id: 'nation-1', name: '1 per nation' },
  { id: 'nation-3', name: '3 per nation' },
]

/**
 * **Auction only, and two values.**
 *
 * It was once a turn timer offered in every format; it is a *bid* timer now,
 * and a bid timer is a thing only one of the four formats has. What it
 * measures there is inactivity rather than anybody's window — any bid from any
 * seat sends it back to full — so it is the auction's own closing mechanism
 * and has no counterpart in a format where turns simply pass to the next
 * person. The other three no longer run a clock at all.
 *
 * Fifteen seconds or none. The intermediate lengths were never a decision
 * anybody was making; they were a slider drawn as chips.
 */
export const timers: Choice[] = [
  { id: '15', name: '15 s' },
  { id: 'off', name: 'Off' },
]

/** Humans plus bots. The empty seats stay on screen either way. */
export const MIN_SEATS = 2
export const MAX_SEATS = 5
