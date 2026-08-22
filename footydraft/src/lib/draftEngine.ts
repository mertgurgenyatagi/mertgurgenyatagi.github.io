import { type SlotId, formation } from '../data/formation'
import type { Player } from './players'

export type Squad = Partial<Record<SlotId, Player>>

export interface Drafter {
  id: string
  /** Set in Oswald, uppercase, on the strip and on the board tabs. */
  name: string
  kind: 'you' | 'human' | 'bot'
  /** One character in the disc. Bots get their number — never a face. */
  mark: string
}

export interface Pick {
  /** Zero-based position in the whole draft, so a pick knows its own round. */
  overall: number
  seat: number
  slot: SlotId
  player: Player
}

/* ------------------------------------------------------------------ order -- */

/**
 * Snake. The order reverses at the end of every round, so seat 0 picks first
 * and last in a two-round pair and nobody's seat is worth more than anyone
 * else's over eleven of them.
 */
export function seatAt(overall: number, seatCount: number): number {
  const round = Math.floor(overall / seatCount)
  const place = overall % seatCount
  return round % 2 === 0 ? place : seatCount - 1 - place
}

export function roundAt(overall: number, seatCount: number): number {
  return Math.floor(overall / seatCount) + 1
}

/* -------------------------------------------------------------- the squad -- */

/** Where this footballer would go. Null when that part of the shape is full. */
export function slotFor(player: Player, squad: Squad): SlotId | null {
  for (const slot of formation) {
    if (slot.position === player.position && !squad[slot.id]) return slot.id
  }
  return null
}

export function squadPlayers(squad: Squad): Player[] {
  return formation.map((slot) => squad[slot.id]).filter((player): player is Player => Boolean(player))
}

export function countBy(squad: Squad, key: 'clubSlug' | 'nation', value: string): number {
  return squadPlayers(squad).filter((player) => player[key] === value).length
}

/* ------------------------------------------------------------ eligibility -- */

/**
 * Why this footballer cannot be taken, phrased for the row that carries it —
 * or null when nothing stops you.
 *
 * A blocked player is never removed from the list. Seeing the best remaining
 * names crossed out, each captioned with the reason, is what teaches a
 * per-squad constraint; deleting them silently would just make the pool look
 * arbitrarily smaller.
 */
export function blockedReason(
  player: Player,
  squad: Squad,
  constraint: string,
  taken: ReadonlySet<string>,
): string | null {
  if (taken.has(player.id)) return 'Already drafted.'
  if (!slotFor(player, squad)) return `Your ${player.position} is filled.`

  switch (constraint) {
    case 'club-1':
      return countBy(squad, 'clubSlug', player.clubSlug) >= 1 ? `${player.club} is spent.` : null
    case 'club-3':
      return countBy(squad, 'clubSlug', player.clubSlug) >= 3
        ? `Three from ${player.club} already.`
        : null
    case 'nation-1':
      return countBy(squad, 'nation', player.nation) >= 1 ? `${player.nation} is spent.` : null
    case 'nation-3':
      return countBy(squad, 'nation', player.nation) >= 3
        ? `Three from ${player.nation} already.`
        : null
    default:
      return null
  }
}

export function isEligible(
  player: Player,
  squad: Squad,
  constraint: string,
  taken: ReadonlySet<string>,
): boolean {
  return blockedReason(player, squad, constraint, taken) === null
}

/* ---------------------------------------------------------------- picking -- */

/**
 * What a bot does with its turn.
 *
 * It reads ability, which the screen never does, and takes one of the strongest
 * few rather than the single strongest — a table of bots that all agree on the
 * board order is a table that plays the same draft every time. Positional need
 * only bites at the end, when the rounds left stop outnumbering the holes.
 */
export function botChoice(
  pool: Player[],
  squad: Squad,
  constraint: string,
  taken: ReadonlySet<string>,
  roundsLeft: number,
  random: () => number = Math.random,
): Player | null {
  const eligible = pool.filter((player) => isEligible(player, squad, constraint, taken))
  if (eligible.length === 0) return lastResort(pool, squad, taken)

  const openPositions = formation
    .filter((slot) => !squad[slot.id])
    .map((slot) => slot.position)

  const scarce = new Set(
    openPositions.filter((position) => {
      const supply = eligible.filter((player) => player.position === position).length
      return supply <= roundsLeft
    }),
  )

  const shortlist = scarce.size > 0 ? eligible.filter((p) => scarce.has(p.position)) : eligible
  const ranked = [...(shortlist.length > 0 ? shortlist : eligible)].sort(
    (a, b) => b.ability - a.ability,
  )
  const spread = Math.min(5, ranked.length)
  return ranked[Math.floor(random() * spread)]
}

/**
 * On timeout the system takes the cheapest eligible footballer for an open
 * slot. Cheapest rather than best: an auto-pick should never be the pick you
 * would have made, or the clock stops meaning anything.
 */
export function timeoutChoice(
  pool: Player[],
  squad: Squad,
  constraint: string,
  taken: ReadonlySet<string>,
): Player | null {
  const eligible = pool.filter((player) => isEligible(player, squad, constraint, taken))
  if (eligible.length === 0) return lastResort(pool, squad, taken)
  return eligible.reduce((cheapest, player) => (player.price < cheapest.price ? player : cheapest))
}

/**
 * A draft can never end with an unfilled slot, so if a constraint ever painted
 * a drafter into a corner the constraint is what gives way — not the shape.
 * With five hundred footballers and forty-four picks this should not fire; it
 * exists so that "should not" is not the only thing holding the rule up.
 */
function lastResort(pool: Player[], squad: Squad, taken: ReadonlySet<string>): Player | null {
  return pool.find((player) => !taken.has(player.id) && slotFor(player, squad)) ?? null
}
