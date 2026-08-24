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
 * **The bid timer is no longer a setting** *(removed by Mert, 2026-08-23)*.
 *
 * It had already narrowed from five values to two, and the surviving `Off`
 * never switched anything off: with no turns, a lot that runs no clock stays
 * open forever, so the Auction screen fell back to fifteen seconds either way.
 * A control whose two positions do the same thing is not a setting, so the
 * group is gone from both lobbies and the Auction simply runs at the default.
 * `AUCTION_BID_SECONDS` in `auctionEngine` is where that number lives now.
 */

/**
 * **Spin the Wheel only.** What the wheel's slices are: the five leagues, or
 * one wedge per club *(added 2026-08-23)*.
 *
 * The category is still fixed once, at the start, and still never changes
 * between spins *(R5-Q1)* — this only chooses which of the two open axes it
 * gets fixed to. A single-league Scope has already fixed league, so the group
 * collapses away there and the wheel is clubs by construction.
 */
export const wheels: Choice[] = [
  { id: 'league', name: 'By league' },
  { id: 'club', name: 'By club' },
]

export const MIN_SEATS = 2
export const MAX_SEATS = 5
