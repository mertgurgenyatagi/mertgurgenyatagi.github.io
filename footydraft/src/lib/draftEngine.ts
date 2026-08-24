import { type SlotId, formation } from '../data/formation'
import type { Player } from './players'

export type Squad = Partial<Record<SlotId, Player>>

export interface Drafter {
  id: string
  /** Set in Oswald, uppercase, on the strip and on the board tabs. */
  name: string
  kind: 'you' | 'human'
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

/* ------------------------------------------------------------- constraints -- */

/**
 * **Constraints are shared across the table, not held per squad** *(set by
 * Mert, 2026-08-23, overturning R6-Q3).* Under `1 per club`, one Real Madrid
 * footballer going anywhere at the table takes Real Madrid off the board for
 * everybody — it is a property of the draft rather than of your own eleven.
 *
 * That makes the count a table-wide tally rather than a scan of one squad,
 * which is what this carries. It is derived from every pick made so far, so
 * there is one counter and no possibility of two seats disagreeing about
 * what is left.
 */
export interface TableSpend {
  clubs: Record<string, number>
  nations: Record<string, number>
}

export const NO_SPEND: TableSpend = { clubs: {}, nations: {} }

export function tableSpend(picks: readonly Pick[]): TableSpend {
  const clubs: Record<string, number> = {}
  const nations: Record<string, number> = {}
  for (const pick of picks) {
    clubs[pick.player.clubSlug] = (clubs[pick.player.clubSlug] ?? 0) + 1
    nations[pick.player.nation] = (nations[pick.player.nation] ?? 0) + 1
  }
  return { clubs, nations }
}

/** The cap a constraint sets, or null when it does not count this axis. */
function capFor(constraint: string): { key: 'clubs' | 'nations'; cap: number } | null {
  switch (constraint) {
    case 'club-1':
      return { key: 'clubs', cap: 1 }
    case 'club-3':
      return { key: 'clubs', cap: 3 }
    case 'nation-1':
      return { key: 'nations', cap: 1 }
    case 'nation-3':
      return { key: 'nations', cap: 3 }
    default:
      return null
  }
}

/* ------------------------------------------------------------ eligibility -- */

/**
 * A reason a footballer cannot be taken, as a key and its substitutions rather
 * than as a finished English sentence.
 *
 * The rule lives here and the wording lives in the translation table, which is
 * the only arrangement that works once there are two languages: `Your CB is
 * filled.` and `Manchester City is gone.` both put a noun in the middle of an
 * English sentence, and Turkish will not take that noun in the same place.
 */
export interface Blocked {
  key: string
  vars?: Record<string, string>
}

/**
 * Why this footballer cannot be taken, phrased for the row that carries it —
 * or null when nothing stops you.
 *
 * A blocked player is never removed from the list. Seeing the best remaining
 * names crossed out, each captioned with the reason, is what teaches a
 * constraint; deleting them silently would just make the pool look arbitrarily
 * smaller.
 *
 * `spend` is the table's own tally — see `TableSpend`. A caller that passes
 * nothing is saying there is no constraint to check, which is what the two
 * formats that don't take one (Spin the Wheel, and Free Pick with `none`) are
 * doing.
 */
export function blockedReason(
  player: Player,
  squad: Squad,
  constraint: string,
  taken: ReadonlySet<string>,
  spend: TableSpend = NO_SPEND,
): Blocked | null {
  if (taken.has(player.id)) return { key: 'Already drafted.' }
  if (!slotFor(player, squad)) {
    return { key: 'Your {position} is filled.', vars: { position: player.position } }
  }

  const limit = capFor(constraint)
  if (!limit) return null

  if (limit.key === 'clubs') {
    const used = spend.clubs[player.clubSlug] ?? 0
    if (used < limit.cap) return null
    return limit.cap === 1
      ? { key: '{club} is gone.', vars: { club: player.club } }
      : { key: 'Three from {club} already.', vars: { club: player.club } }
  }

  const used = spend.nations[player.nation] ?? 0
  if (used < limit.cap) return null
  return limit.cap === 1
    ? { key: '{nation} is gone.', vars: { nation: player.nation } }
    : { key: 'Three from {nation} already.', vars: { nation: player.nation } }
}

export function isEligible(
  player: Player,
  squad: Squad,
  constraint: string,
  taken: ReadonlySet<string>,
  spend: TableSpend = NO_SPEND,
): boolean {
  return blockedReason(player, squad, constraint, taken, spend) === null
}

/* ---------------------------------------------------------------- picking -- */

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
  spend: TableSpend = NO_SPEND,
): Player | null {
  const eligible = pool.filter((player) => isEligible(player, squad, constraint, taken, spend))
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
